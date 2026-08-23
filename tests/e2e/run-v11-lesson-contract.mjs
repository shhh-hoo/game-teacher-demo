#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { applyActions, applyWorldPatch, blankWorld, flattenActions } from './assertions.mjs';

const expectedDslVersion = process.env.DIFY_EXPECT_DSL_VERSION || 'v11';
const expectedBuildId = process.env.DIFY_EXPECT_BUILD_ID || 'v11-runtime-first-continuous-play-r2-20260823';
const versionLabel = process.env.DIFY_TEST_VERSION || 'v11-continuous-play';
const apiKey = String(process.env.DIFY_API_KEY || '').trim();
const baseUrl = String(process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').trim().replace(/\/$/, '');
const proxyUrl = String(process.env.GAME_TEACHER_PROXY_URL || '').trim().replace(/\/$/, '');
const verbose = process.argv.includes('--verbose');
if (!proxyUrl && !apiKey) { console.error('Need either GAME_TEACHER_PROXY_URL or DIFY_API_KEY.'); process.exit(2); }

function parseObject(text) {
  if (text && typeof text === 'object' && !Array.isArray(text)) return text;
  const raw = String(text || '').trim(); const candidates = [raw];
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i); if (fenced) candidates.push(fenced[1].trim());
  const a = raw.indexOf('{'); const b = raw.lastIndexOf('}'); if (a !== -1 && b > a) candidates.push(raw.slice(a, b + 1));
  for (const candidate of [...new Set(candidates)]) { try { const value = JSON.parse(candidate); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch {} }
  throw new Error(`Dify answer was not JSON: ${raw.slice(0, 800)}`);
}
function c(payload) { return payload?.debug?.controller || {}; }
function actions(payload) { return flattenActions(payload?.ui_action).filter(action => !['wait', 'reset_to_baseline'].includes(action.type)); }
function assert(ok, message) { if (!ok) throw new Error(message); }
function assertNoReset(payload, turn) {
  assert(c(payload).reset_listener !== true, `turn ${turn}: listener reset is forbidden`);
  assert(c(payload).reset_rules !== true, `turn ${turn}: rule reset is forbidden`);
  assert(c(payload).reset_world !== true, `turn ${turn}: world reset is forbidden`);
  assert(c(payload).fresh_listener !== true, `turn ${turn}: fresh listener is forbidden`);
  assert(!(payload?.debug?.architecture_trace?.events || []).some(event => event?.event === 'fresh_listener_reset'), `turn ${turn}: fresh_listener_reset trace is forbidden`);
}
async function send(message, conversationId, userId) {
  const started = Date.now(); let response;
  if (proxyUrl) response = await fetch(proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, conversationId, userId }) });
  else response = await fetch(`${baseUrl}/chat-messages`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs: {}, query: message, response_mode: 'blocking', conversation_id: conversationId || '', user: userId }) });
  const raw = await response.text(); if (!response.ok) throw new Error(`Game Teacher ${response.status}: ${raw.slice(0, 4000)}`);
  const data = JSON.parse(raw); return { elapsedMs: Date.now() - started, conversationId: proxyUrl ? (data.conversationId || conversationId) : (data.conversation_id || conversationId), payload: proxyUrl ? data : parseObject(data.answer) };
}

const script = [
  ['Make five available tokens named A, B, C, D, and E. Remove token A now.', p => { assert(p.phase === 'experience', 'turn 1: expected experience'); assert(p.support?.type === 'game_guide' && p.support?.mode === 'full', 'turn 1: full guide required'); assert(actions(p).some(a => a.type === 'remove_object'), 'turn 1: A must be removed'); }],
  ['Continue.', p => { assert(p.phase === 'teach', 'turn 2: expected teach'); assert(p.support?.type === 'teach_moment', 'turn 2: real gap must earn teach_moment'); assert(c(p).response_intent === 'main_teach', 'turn 2: expected main_teach'); }],
  ['Next remove token B. Keep removing one token at a time. The game ends when no available tokens are left.', p => { assert(p.phase === 'practice', 'turn 3: repair should enter practice'); assert(p.support?.type === 'game_guide' && p.support?.mode === 'compact', 'turn 3: guide should become compact'); assert(actions(p).some(a => a.type === 'remove_object'), 'turn 3: B must be removed'); }],
  ['Remove token C now.', p => { assert(p.phase === 'practice', 'turn 4: same game must continue'); assert(p.support?.type === 'game_guide' && p.support?.mode === 'compact', 'turn 4: compact guide should remain once'); assert(c(p).scaffold_fade_step === 1, 'turn 4: expected fade step 1'); }],
  ['Remove token D now.', p => { assert(p.phase === 'practice', 'turn 5: same game must continue'); assert(p.support == null, 'turn 5: persistent guide should fade away'); assert(c(p).scaffold_faded === true, 'turn 5: scaffold_faded must be true'); }],
  ['Remove token E now.', p => { assert(p.phase === 'transfer', 'turn 6: grounded ending should go directly to transfer'); assert(p.support == null, 'turn 6: no guide at transfer'); assert(actions(p).some(a => a.type === 'remove_object'), 'turn 6: final physical action must execute'); assert(c(p).game_complete === true && (c(p).completion_evidence || []).length > 0, 'turn 6: grounded completion evidence required'); assert(c(p).lesson_complete === false, 'turn 6: game end is not lesson end'); assert(c(p).response_intent === 'transfer_prompt', 'turn 6: expected transfer_prompt'); }],
  ['what?', p => { assert(p.phase === 'transfer', 'turn 7: trivial response should stay transfer'); assert(actions(p).length === 0, 'turn 7: transfer must not mutate gameplay'); assert(c(p).response_intent === 'transfer_retry', 'turn 7: expected transfer_retry'); }],
  ['Next time I will first check what the other player already knows, then explain what they still need before the next move.', p => { assert(p.phase === 'complete', 'turn 8: substantive transfer should complete'); assert(actions(p).length === 0, 'turn 8: completion must not mutate gameplay'); assert(c(p).lesson_complete === true && c(p).response_intent === 'lesson_complete', 'turn 8: lesson_complete required'); }],
];

const userId = `v11-continuous-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let conversationId = ''; let world = blankWorld(); let baseline = null; const trace = [];
try {
  console.log(`v11 continuous-play contract · ${versionLabel}`); console.log(`Expected runtime · ${expectedDslVersion} / ${expectedBuildId}`); console.log('');
  for (let i = 0; i < script.length; i += 1) {
    const turn = i + 1; const [message, check] = script[i]; const before = structuredClone(world); const result = await send(message, conversationId, userId); conversationId = result.conversationId; const payload = result.payload;
    assert(payload?.debug?.dsl_version === expectedDslVersion, `turn ${turn}: DSL mismatch`); assert(payload?.debug?.build_id === expectedBuildId, `turn ${turn}: build mismatch`); assert((payload?.debug?.pipeline_errors || []).length === 0, `turn ${turn}: pipeline error`); assert(payload?.debug?.action_plan_source === '1540-runtime-first', `turn ${turn}: expected Runtime-first path`); assertNoReset(payload, turn);
    const afterPatch = applyWorldPatch(world, payload.world_patch || {}); if (payload.capture_baseline) baseline = structuredClone(afterPatch); world = applyActions(afterPatch, flattenActions(payload.ui_action), baseline); check(payload);
    trace.push({ turn, student: message, raku: payload.reply || '', elapsed_ms: result.elapsedMs, phase: payload.phase, support: payload.support || null, actions: flattenActions(payload.ui_action), controller: c(payload), world_before: before, world_after: structuredClone(world) });
    console.log(`${turn}. ${message}`); console.log(`   ${payload.phase} · ${payload.support?.type || 'no guide'} · ${actions(payload).map(a => a.type).join(', ') || 'no gameplay action'}`); if (verbose) console.log(`   ${payload.reply || '(no reply)'}\n   controller=${JSON.stringify(c(payload))}`);
  }
  const dir = path.resolve(process.cwd(), '.artifacts', 'dify-e2e'); await fs.mkdir(dir, { recursive: true }); const out = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}__${versionLabel}__v11-continuous-contract.json`); await fs.writeFile(out, JSON.stringify({ passed: true, expectedDslVersion, expectedBuildId, trace }, null, 2)); console.log('\nPASS · v11 continuous-play lesson reached complete'); console.log(`Trace · ${out}`);
} catch (error) {
  const dir = path.resolve(process.cwd(), '.artifacts', 'dify-e2e'); await fs.mkdir(dir, { recursive: true }); const out = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}__${versionLabel}__v11-continuous-contract__FAILED.json`); await fs.writeFile(out, JSON.stringify({ passed: false, expectedDslVersion, expectedBuildId, error: String(error?.stack || error), trace }, null, 2)); console.error(`\nFAIL · ${String(error?.message || error)}`); console.error(`Trace · ${out}`); process.exitCode = 1;
}
