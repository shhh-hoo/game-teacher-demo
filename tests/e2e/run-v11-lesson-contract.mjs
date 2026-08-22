#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { applyActions, applyWorldPatch, blankWorld, flattenActions } from './assertions.mjs';

const expectedDslVersion = process.env.DIFY_EXPECT_DSL_VERSION || 'v11';
const expectedBuildId = process.env.DIFY_EXPECT_BUILD_ID || 'v11-runtime-first-mastery-gate-r1-20260823';
const versionLabel = process.env.DIFY_TEST_VERSION || 'v11-lesson-contract';
const difyApiKey = String(process.env.DIFY_API_KEY || '').trim();
const difyBaseUrl = String(process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').trim().replace(/\/$/, '');
const proxyUrl = String(process.env.GAME_TEACHER_PROXY_URL || '').trim().replace(/\/$/, '');
const verbose = process.argv.includes('--verbose');

if (!proxyUrl && !difyApiKey) {
  console.error('Need either GAME_TEACHER_PROXY_URL or DIFY_API_KEY.');
  process.exit(2);
}

function parseJsonObject(text, label = 'JSON') {
  if (text && typeof text === 'object' && !Array.isArray(text)) return text;
  const raw = String(text || '').trim();
  const candidates = [raw];
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidates.push(fenced[1].trim());
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1));
  for (const candidate of [...new Set(candidates)]) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch {
      // Try another candidate.
    }
  }
  throw new Error(`${label} was not valid JSON: ${raw.slice(0, 800)}`);
}

function normalizeCounterMap(world) {
  return Object.fromEntries((world?.counters || []).map(item => [String(item.id), item.value]));
}

function nonWaitActionTypes(payload) {
  return flattenActions(payload?.ui_action)
    .filter(action => !['wait', 'reset_to_baseline'].includes(action.type))
    .map(action => action.type);
}

function activeRules(payload) {
  return (payload?.debug?.executable_rules?.rules || []).filter(rule => rule?.status === 'active');
}

function controller(payload) {
  return payload?.debug?.controller || {};
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sendTurn({ message, conversationId, userId }) {
  const startedAt = Date.now();
  let response;
  if (proxyUrl) {
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId, userId }),
    });
  } else {
    response = await fetch(`${difyBaseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: 'blocking',
        conversation_id: conversationId || '',
        user: userId,
      }),
    });
  }

  const raw = await response.text();
  if (!response.ok) throw new Error(`Game Teacher ${response.status}: ${raw.slice(0, 4000)}`);
  const data = JSON.parse(raw);
  const payload = proxyUrl ? data : parseJsonObject(data.answer, 'Dify answer');
  return {
    elapsedMs: Date.now() - startedAt,
    conversationId: proxyUrl ? (data.conversationId || conversationId) : (data.conversation_id || conversationId),
    payload,
  };
}

const turns = [
  {
    message: 'Make three available tokens named A, B, and C. The turn starts on Jamie and the move counter starts at zero. Remove token A now.',
    check(payload) {
      assert(payload.phase === 'experience', `turn 1: expected experience, got ${payload.phase}`);
      assert(payload.support == null, 'turn 1: support must be absent before a real gap.');
      assert(nonWaitActionTypes(payload).includes('remove_object'), 'turn 1: token A must actually be removed.');
      assert(controller(payload).lesson_complete === false, 'turn 1: lesson cannot already be complete.');
    },
  },
  {
    message: 'Continue.',
    check(payload) {
      assert(payload.phase === 'teach', `turn 2: expected teach, got ${payload.phase}`);
      assert(payload.support?.type === 'teach_moment', 'turn 2: first real gap must earn teach_moment.');
      assert(controller(payload).response_intent === 'main_teach', `turn 2: expected main_teach, got ${controller(payload).response_intent}`);
      assert(controller(payload).lesson_complete === false, 'turn 2: lesson cannot be complete.');
    },
  },
  {
    message: 'The next step is to remove token B now. The game ends when no available tokens are left.',
    check(payload) {
      assert(payload.phase === 'practice', `turn 3: repair should enter practice, got ${payload.phase}`);
      assert(payload.support?.type === 'micro_teach', 'turn 3: practice scaffold must be visible.');
      assert(nonWaitActionTypes(payload).includes('remove_object'), 'turn 3: repair must change executable reality by removing B.');
      assert(controller(payload).lesson_complete === false, 'turn 3: lesson cannot be complete.');
    },
  },
  {
    message: 'Remove token C now.',
    check(payload) {
      assert(payload.phase === 'practice', `turn 4: intermediate action must stay in practice; got ${payload.phase}`);
      assert(payload.support?.type === 'micro_teach', 'turn 4: scaffold must remain during guided replay.');
      assert(nonWaitActionTypes(payload).includes('remove_object'), 'turn 4: token C must be removed.');
      assert(controller(payload).fresh_listener !== true, 'turn 4: two ordinary actions must NOT graduate the learner.');
      assert(controller(payload).lesson_complete === false, 'turn 4: lesson cannot be complete.');
    },
  },
  {
    message: 'Continue.',
    check(payload) {
      assert(payload.phase === 'independent', `turn 5: grounded guided ending should enter independent, got ${payload.phase}`);
      assert(payload.support == null, 'turn 5: support must disappear for independent practice.');
      assert(controller(payload).game_complete === true, 'turn 5: transition requires grounded game_complete evidence.');
      assert((controller(payload).completion_evidence || []).length > 0, 'turn 5: completion evidence must be non-empty.');
      assert(controller(payload).fresh_listener === true, 'turn 5: fresh listener reset must be explicit.');
      assert(controller(payload).reset_listener === true && controller(payload).reset_rules === true && controller(payload).reset_world === true,
        'turn 5: listener, rules, and physical progress must reset together.');
      assert(controller(payload).lesson_complete === false, 'turn 5: game completion is not lesson completion.');
      assert((payload.debug?.listener_instruction_count || 0) === 0, 'turn 5: active listener instructions must be cleared.');
      assert(activeRules(payload).length === 0, 'turn 5: active executable Rule IR must be cleared.');
    },
  },
  {
    message: 'Go ahead.',
    check(payload) {
      assert(payload.phase === 'independent', `turn 6: should remain independent, got ${payload.phase}`);
      assert(payload.support == null, 'turn 6: independent must remain unscaffolded.');
      assert(nonWaitActionTypes(payload).length === 0, 'turn 6: fresh Jamie must not act from old rules.');
      assert((payload.debug?.listener_instruction_count || 0) === 0, 'turn 6: bare continuation must not restore old listener rules.');
      assert(activeRules(payload).length === 0, 'turn 6: bare continuation must not restore old Rule IR.');
      assert(controller(payload).lesson_complete === false, 'turn 6: lesson cannot be complete.');
    },
  },
  {
    message: 'For this fresh game, remove token A now. The game ends when no available tokens are left.',
    check(payload) {
      assert(payload.phase === 'independent', `turn 7: should stay independent, got ${payload.phase}`);
      assert(payload.support == null, 'turn 7: no scaffold in independent.');
      assert(nonWaitActionTypes(payload).includes('remove_object'), 'turn 7: fresh re-teaching must authorize A removal.');
    },
  },
  {
    message: 'Next remove token B now.',
    check(payload) {
      assert(payload.phase === 'independent', `turn 8: should stay independent, got ${payload.phase}`);
      assert(nonWaitActionTypes(payload).includes('remove_object'), 'turn 8: B must be removed from fresh teaching.');
    },
  },
  {
    message: 'Finally remove token C now.',
    check(payload) {
      assert(payload.phase === 'independent', `turn 9: final physical action alone should still be independent, got ${payload.phase}`);
      assert(nonWaitActionTypes(payload).includes('remove_object'), 'turn 9: C must be removed from fresh teaching.');
    },
  },
  {
    message: 'Continue.',
    check(payload) {
      assert(payload.phase === 'transfer', `turn 10: independent game ending should enter transfer, got ${payload.phase}`);
      assert(payload.support == null, 'turn 10: transfer has no gameplay scaffold.');
      assert(controller(payload).game_complete === true, 'turn 10: transfer requires grounded independent game completion.');
      assert((controller(payload).completion_evidence || []).length > 0, 'turn 10: independent completion evidence must be non-empty.');
      assert(controller(payload).lesson_complete === false, 'turn 10: transfer is not yet lesson completion.');
      assert(controller(payload).response_intent === 'transfer_prompt', `turn 10: expected transfer_prompt, got ${controller(payload).response_intent}`);
    },
  },
  {
    message: 'what?',
    check(payload) {
      assert(payload.phase === 'transfer', `turn 11: trivial response must remain transfer, got ${payload.phase}`);
      assert(nonWaitActionTypes(payload).length === 0, 'turn 11: transfer must suppress gameplay actions.');
      assert(controller(payload).lesson_complete === false, 'turn 11: trivial transfer response must not complete lesson.');
      assert(controller(payload).response_intent === 'transfer_retry', `turn 11: expected transfer_retry, got ${controller(payload).response_intent}`);
    },
  },
  {
    message: 'Next time I will think about what the new player needs before their next move.',
    check(payload) {
      assert(payload.phase === 'complete', `turn 12: substantive transfer should complete lesson, got ${payload.phase}`);
      assert(nonWaitActionTypes(payload).length === 0, 'turn 12: lesson completion must not mutate gameplay.');
      assert(controller(payload).lesson_complete === true, 'turn 12: lesson_complete must be true.');
      assert(controller(payload).response_intent === 'lesson_complete', `turn 12: expected lesson_complete, got ${controller(payload).response_intent}`);
    },
  },
];

const userId = `v11-lesson-contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let conversationId = '';
let world = blankWorld();
let baseline = null;
const trace = [];
let baselineSnapshot = null;

try {
  console.log(`v11 full-lesson contract · ${versionLabel}`);
  console.log(`Expected runtime · ${expectedDslVersion} / ${expectedBuildId}`);
  console.log('');

  for (let index = 0; index < turns.length; index += 1) {
    const turnNumber = index + 1;
    const step = turns[index];
    const before = structuredClone(world);
    const result = await sendTurn({ message: step.message, conversationId, userId });
    conversationId = result.conversationId;
    const payload = result.payload;

    assert(payload?.debug?.dsl_version === expectedDslVersion,
      `turn ${turnNumber}: runtime DSL mismatch; expected ${expectedDslVersion}, got ${JSON.stringify(payload?.debug?.dsl_version || null)}`);
    assert(payload?.debug?.build_id === expectedBuildId,
      `turn ${turnNumber}: build mismatch; expected ${expectedBuildId}, got ${JSON.stringify(payload?.debug?.build_id || null)}`);
    assert((payload?.debug?.pipeline_errors || []).length === 0,
      `turn ${turnNumber}: pipeline_errors=${JSON.stringify(payload?.debug?.pipeline_errors || [])}`);
    assert(payload?.debug?.action_plan_source === '1540-runtime-first',
      `turn ${turnNumber}: expected runtime-first action_plan_source, got ${JSON.stringify(payload?.debug?.action_plan_source || null)}`);

    const afterPatch = applyWorldPatch(world, payload.world_patch || {});
    if (payload.capture_baseline) {
      baseline = structuredClone(afterPatch);
      baselineSnapshot = structuredClone(afterPatch);
    }
    const actions = flattenActions(payload.ui_action);
    world = applyActions(afterPatch, actions, baseline);

    step.check(payload);

    if (turnNumber === 5) {
      assert(baselineSnapshot != null, 'turn 5: no baseline was captured before fresh reset.');
      assert(world.turn === baselineSnapshot.turn,
        `turn 5: reset changed baseline turn (${JSON.stringify(baselineSnapshot.turn)} -> ${JSON.stringify(world.turn)}).`);
      assert(JSON.stringify(normalizeCounterMap(world)) === JSON.stringify(normalizeCounterMap(baselineSnapshot)),
        'turn 5: reset changed baseline counters.');
    }

    trace.push({
      turn: turnNumber,
      student: step.message,
      jamie: payload.reply || '',
      elapsed_ms: result.elapsedMs,
      phase: payload.phase,
      actions,
      controller: controller(payload),
      build_id: payload?.debug?.build_id || null,
      action_source: payload?.debug?.action_source || null,
      world_before: before,
      world_after: structuredClone(world),
    });

    console.log(`${turnNumber}. ${step.message}`);
    console.log(`   ${payload.phase} · ${payload?.debug?.action_source || 'no action source'} · ${nonWaitActionTypes(payload).join(', ') || 'no gameplay action'}`);
    if (verbose) console.log(`   ${payload.reply || '(no reply)'}\n   controller=${JSON.stringify(controller(payload))}`);
  }

  const dir = path.resolve(process.cwd(), '.artifacts', 'dify-e2e');
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(dir, `${stamp}__${versionLabel}__v11-lesson-contract.json`);
  await fs.writeFile(out, JSON.stringify({ passed: true, expectedDslVersion, expectedBuildId, trace }, null, 2), 'utf8');

  console.log('');
  console.log('PASS · v11 full-lesson contract reached complete');
  console.log(`Trace · ${out}`);
} catch (error) {
  const dir = path.resolve(process.cwd(), '.artifacts', 'dify-e2e');
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(dir, `${stamp}__${versionLabel}__v11-lesson-contract__FAILED.json`);
  await fs.writeFile(out, JSON.stringify({ passed: false, expectedDslVersion, expectedBuildId, error: String(error?.stack || error), trace }, null, 2), 'utf8');
  console.error('');
  console.error(`FAIL · ${String(error?.message || error)}`);
  console.error(`Trace · ${out}`);
  process.exitCode = 1;
}
