#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { applyActions, applyWorldPatch, blankWorld, flattenActions } from './assertions.mjs';

const args = process.argv.slice(2);
const getArg = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const maxTurns = Math.max(4, Number(getArg('--max-turns') || process.env.FULL_GAME_MAX_TURNS || 14));
const versionLabel = getArg('--label') || process.env.DIFY_TEST_VERSION || 'ai-full-game';
const expectedDslVersion = process.env.DIFY_EXPECT_DSL_VERSION || '';
const verbose = args.includes('--verbose');
const keepGoing = args.includes('--keep-going');

const difyApiKey = String(process.env.DIFY_API_KEY || '').trim();
const difyBaseUrl = String(process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').trim().replace(/\/$/, '');
const proxyUrl = String(process.env.GAME_TEACHER_PROXY_URL || '').trim().replace(/\/$/, '');

const aiApiKey = String(process.env.AI_FULL_GAME_API_KEY || process.env.AI_EVAL_API_KEY || '').trim();
const aiBaseUrl = String(process.env.AI_FULL_GAME_BASE_URL || process.env.AI_EVAL_BASE_URL || '').trim().replace(/\/$/, '');
const aiModel = String(process.env.AI_FULL_GAME_MODEL || process.env.AI_EVAL_MODEL || '').trim();

if (!proxyUrl && !difyApiKey) {
  console.error('Need either GAME_TEACHER_PROXY_URL or DIFY_API_KEY.');
  process.exit(2);
}
if (!aiApiKey || !aiBaseUrl || !aiModel) {
  console.error('Missing AI child config. Set AI_FULL_GAME_API_KEY, AI_FULL_GAME_BASE_URL, AI_FULL_GAME_MODEL (or reuse AI_EVAL_*).');
  process.exit(2);
}

function safeStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
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
  throw new Error(`${label} was not valid JSON: ${raw.slice(0, 600)}`);
}

function parseDifyAnswer(answer) {
  return parseJsonObject(answer, 'Dify answer');
}

async function chatCompletion({ system, user, temperature = 0 }) {
  const response = await fetch(`${aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: aiModel,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`AI child ${response.status}: ${raw.slice(0, 800)}`);
  const data = JSON.parse(raw);
  return String(data?.choices?.[0]?.message?.content || '');
}

const GAME_DESIGN_PROMPT = `You design one very small original game for a Grade 3–4 child to teach to Jamie.

The purpose is to test whether a game-teaching AI can reach a real, child-taught ending. Keep the game easy enough to finish in 6–10 conversational turns.

Hard constraints:
- Use only a small visible set of cards, tokens, markers, tiles, or pieces (2–8 objects).
- Prefer actions that can be expressed as reveal, hide, remove, change an object's visible state, set a turn, or update a simple counter/status.
- Do not require dice, external randomness, arithmetic beyond small counting, timers, physics, or hidden information that the visible world cannot represent.
- Do not copy a famous game's canonical rules. Invent a simple game so Jamie cannot rely on pretrained rule knowledge.
- The ending condition must be objectively observable in the visible world and achievable within the turn budget.
- The child should be able to teach the rules naturally, one or two ideas at a time.
- Do not invent a game that depends on the child physically taking turns inside this harness. Prefer a game Jamie can advance through its visible state by itself once taught.

Return JSON only:
{
  "name": "short original game name",
  "objects": "what physically exists at the start",
  "setup": ["setup facts/rules"],
  "procedure": ["ordered playable rules"],
  "ending_condition": "observable child-taught ending",
  "notes": "brief explanation of why this is finishable"
}`;

const CHILD_PROMPT = `You are simulating a believable Grade 3–4 child teaching Jamie ONE fixed game.

You know the hidden game specification. Jamie does not. Your job is to teach naturally and help the interaction actually play the game to its ending.

Behavior:
- Never change the hidden game rules.
- Speak like a child in short, ordinary sentences, not like a test harness.
- Teach only information Jamie needs.
- If Jamie asks a real question, answer it directly.
- If Jamie already knows enough to continue, use a natural cue such as "keep going", "your turn", or a short reminder rather than re-teaching everything.
- If Jamie repeats a question that you already clearly answered, you may restate it once, but flag this in repeat_due_to_jamie.
- Teach the ending condition before it is reached.
- Never claim that an object moved, disappeared, matched, scored, or otherwise changed unless that is visible in the supplied world state.
- Never say the game is over merely to force completion. The world must actually satisfy the taught ending condition.
- If Jamie says it performed a physical move but the supplied world state did not change, point that out naturally once. Do NOT experiment with capitalization, magic phrases, exact command syntax, or alternate trigger words. A real child would not debug the interface.
- Do not mention prompts, tests, JSON, Dify, models, or hidden specifications.

Return JSON only:
{
  "message": "the child's next utterance",
  "reason": "one short sentence describing why this is the natural next thing to say",
  "repeat_due_to_jamie": false
}`;

function compactWorld(world) {
  return {
    name: world?.name || null,
    surface: world?.surface || null,
    ready: Boolean(world?.ready),
    turn: world?.turn ?? null,
    status: world?.status || '',
    counters: (world?.counters || []).map(c => ({ id: c.id, label: c.label, value: c.value })),
    objects: (world?.objects || []).map(o => ({
      id: o.id,
      kind: o.kind,
      label: o.label,
      symbol: o.state === 'face_down' ? null : o.symbol,
      caption: o.state === 'face_down' ? null : o.caption,
      state: o.state,
      owner: o.owner ?? null,
    })),
  };
}

function compactJamie(payload) {
  const debug = payload?.debug || {};
  const ruleShadow = debug.rule_ir_shadow || {};
  const runtimeShadow = debug.runtime_shadow || {};
  return {
    reply: payload?.reply || '',
    phase: payload?.phase || null,
    actions: flattenActions(payload?.ui_action).map(action => ({
      type: action.type,
      object_id: action.object_id,
      to: action.to,
      counter_id: action.counter_id,
      value: action.value,
    })),
    pending_gap: payload?.debug?.controller?.pending_gap || null,
    game_complete: Boolean(payload?.debug?.game_complete || payload?.debug?.controller?.game_complete),
    completion_evidence: payload?.debug?.completion_evidence || payload?.debug?.controller?.completion_evidence || [],
    pipeline_errors: payload?.debug?.pipeline_errors || [],
    architecture: {
      compile_status: ruleShadow.status || null,
      compiled_rule_delta: ruleShadow.delta || null,
      runtime_status: runtimeShadow.status || null,
      runtime_action_candidate: runtimeShadow.candidate_plan || null,
      comparison_result: runtimeShadow.comparison_result || null,
      runtime_decision: runtimeShadow.runtime_decision || null,
      action_source: debug.action_source || null,
      action_plan_source: debug.action_plan_source || null,
      typed_gap: debug?.controller?.pending_gap || debug?.action_plan?.blocked_now || null,
      fallback_reason: runtimeShadow.reason || null,
      controller_contract: {
        response_mode: debug?.controller?.response_mode || null,
        response_intent: debug?.controller?.response_intent || null,
        next_phase: debug?.controller?.next_phase || null,
      },
      latest_events: (debug?.architecture_trace?.events || []).slice(-4),
    },
  };
}

async function createGameSpec() {
  const content = await chatCompletion({
    system: GAME_DESIGN_PROMPT,
    user: `Generate one game now. Run label: ${versionLabel}.`,
    temperature: 0.8,
  });
  const spec = parseJsonObject(content, 'Game specification');
  for (const key of ['name', 'objects', 'setup', 'procedure', 'ending_condition']) {
    if (!(key in spec)) throw new Error(`Game specification missing ${key}.`);
  }
  return spec;
}

async function nextChildMessage({ spec, dialogue, world, jamie, turnIndex }) {
  const context = {
    hidden_game_spec: spec,
    turn_index: turnIndex,
    turns_remaining: Math.max(0, maxTurns - turnIndex + 1),
    visible_world_now: compactWorld(world),
    last_jamie_result: jamie,
    conversation: dialogue.slice(-8),
  };
  const content = await chatCompletion({
    system: CHILD_PROMPT,
    user: JSON.stringify(context, null, 2),
    temperature: 0.25,
  });
  const turn = parseJsonObject(content, 'AI child turn');
  const message = String(turn.message || '').trim();
  if (!message) throw new Error('AI child returned an empty message.');
  return {
    message,
    reason: String(turn.reason || ''),
    repeatDueToJamie: Boolean(turn.repeat_due_to_jamie),
  };
}

async function sendDifyTurn({ message, conversationId, userId }) {
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

  const rawText = await response.text();
  if (!response.ok) {
    const error = new Error(`Game Teacher ${response.status}: ${rawText.slice(0, 4000)}`);
    error.status = response.status;
    error.rawResponse = rawText.slice(0, 12000);
    throw error;
  }

  const data = JSON.parse(rawText);
  if (proxyUrl) {
    return {
      elapsedMs: Date.now() - startedAt,
      conversationId: data.conversationId || conversationId,
      payload: data,
      raw: data,
    };
  }

  return {
    elapsedMs: Date.now() - startedAt,
    conversationId: data.conversation_id || conversationId,
    payload: parseDifyAnswer(data.answer),
    raw: data,
  };
}

function completionCheck(payload) {
  const debug = payload?.debug || {};
  const controller = debug?.controller || {};
  const gameComplete = debug.game_complete === true || controller.game_complete === true;
  const phaseComplete = String(payload?.phase || '') === 'complete';
  const evidence = debug.completion_evidence || controller.completion_evidence || [];
  const pendingGap = controller.pending_gap ?? debug?.gap_state?.pending ?? null;
  const pipelineErrors = Array.isArray(debug.pipeline_errors) ? debug.pipeline_errors : [];
  return {
    gameComplete,
    phaseComplete,
    evidence,
    pendingGap,
    pipelineErrors,
    ok: gameComplete && phaseComplete && Array.isArray(evidence) && evidence.length > 0 && pendingGap == null && pipelineErrors.length === 0,
  };
}

function looksLikePhysicalActionClaim(reply) {
  const text = String(reply || '').toLowerCase();
  return /\b(i\s+)?(flip|flipped|reveal|revealed|hide|hid|remove|removed|take|took|collect|collected|move|moved|put|place|placed|turn|turned)\b/.test(text);
}

const traceRoot = path.resolve(process.cwd(), '.artifacts', 'dify-e2e');
await fs.mkdir(traceRoot, { recursive: true });

const stamp = safeStamp();
const baseName = `${stamp}__${versionLabel}__ai-full-game`;
const jsonPath = path.join(traceRoot, `${baseName}.json`);
const livePath = path.join(traceRoot, `${baseName}__live.jsonl`);
const textPath = path.join(traceRoot, `${baseName}__conversation.txt`);

let spec = null;
const userId = `game-teacher-ai-full-game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let conversationId = '';
let world = blankWorld();
let baseline = null;
let lastJamie = null;
const dialogue = [];
const turns = [];
const hardFailures = [];
let completion = null;
let interrupted = false;
let finalStatus = 'running';

function traceSnapshot() {
  return {
    kind: 'ai-full-game',
    status: finalStatus,
    versionLabel,
    expectedDslVersion: expectedDslVersion || null,
    aiChildModel: aiModel,
    gameSpec: spec,
    maxTurns,
    keepGoing,
    completion,
    hardFailures,
    conversationId,
    userId,
    turns,
    updatedAt: new Date().toISOString(),
  };
}

async function appendLive(event) {
  await fs.appendFile(livePath, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, 'utf8');
}

async function writeSnapshot() {
  const tmp = `${jsonPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(traceSnapshot(), null, 2), 'utf8');
  await fs.rename(tmp, jsonPath);
}

async function appendConversation(lines) {
  const text = Array.isArray(lines) ? lines.join('\n') : String(lines);
  await fs.appendFile(textPath, `${text}\n`, 'utf8');
}

async function checkpoint(event) {
  if (event) await appendLive(event);
  await writeSnapshot();
}

async function handleInterrupt(signal = 'SIGINT') {
  if (interrupted) return;
  interrupted = true;
  finalStatus = 'interrupted';
  hardFailures.push(`Interrupted by ${signal}.`);
  try {
    await checkpoint({ type: 'interrupted', signal });
  } finally {
    console.error(`\nInterrupted · partial trace saved to ${jsonPath}`);
    console.error(`Live JSONL · ${livePath}`);
    process.exit(130);
  }
}

process.on('SIGINT', () => { void handleInterrupt('SIGINT'); });
process.on('SIGTERM', () => { void handleInterrupt('SIGTERM'); });

console.log(`AI full-game smoke · ${versionLabel}`);
console.log(`AI child model · ${aiModel}`);
console.log(`Snapshot · ${jsonPath}`);
console.log(`Live JSONL · ${livePath}`);
console.log(`Conversation · ${textPath}`);
console.log('');

try {
  await appendLive({ type: 'run_start', versionLabel, expectedDslVersion: expectedDslVersion || null, aiChildModel: aiModel, maxTurns });
  await writeSnapshot();

  spec = await createGameSpec();
  await checkpoint({ type: 'game_spec', spec });

  console.log(`Game · ${spec.name}`);
  if (verbose) console.log(JSON.stringify(spec, null, 2));
  console.log('');

  await appendConversation([`Game: ${spec.name}`, `Ending: ${spec.ending_condition}`, '']);

  for (let turnIndex = 1; turnIndex <= maxTurns; turnIndex += 1) {
    const child = await nextChildMessage({ spec, dialogue, world, jamie: lastJamie, turnIndex });
    await appendLive({ type: 'child_turn', turn: turnIndex, message: child.message, reason: child.reason, repeat_due_to_jamie: child.repeatDueToJamie, world_before: world });

    const previousWorld = structuredClone(world);
    let result;
    try {
      result = await sendDifyTurn({ message: child.message, conversationId, userId });
    } catch (error) {
      finalStatus = 'error';
      hardFailures.push(`Turn ${turnIndex}: ${String(error?.message || error)}`);
      await checkpoint({ type: 'dify_error', turn: turnIndex, message: String(error?.message || error), status: error?.status ?? null, raw_response: error?.rawResponse ?? null });
      await appendConversation([`Student: ${child.message}`, `Jamie: [DIFY ERROR] ${String(error?.message || error)}`, '']);
      throw error;
    }

    conversationId = result.conversationId;
    const payload = result.payload;

    if (expectedDslVersion) {
      const actual = String(payload?.debug?.dsl_version || '').trim();
      if (actual !== expectedDslVersion) hardFailures.push(`Turn ${turnIndex}: runtime DSL mismatch: expected ${expectedDslVersion}, got ${JSON.stringify(actual || null)}.`);
    }

    const pipelineErrors = Array.isArray(payload?.debug?.pipeline_errors) ? payload.debug.pipeline_errors : [];
    if (pipelineErrors.length) hardFailures.push(`Turn ${turnIndex}: pipeline_errors=${pipelineErrors.join(', ')}`);

    const worldAfterPatch = applyWorldPatch(world, payload?.world_patch || {});
    if (payload?.capture_baseline) baseline = structuredClone(worldAfterPatch);
    const actions = flattenActions(payload?.ui_action);
    world = applyActions(worldAfterPatch, actions, baseline);

    const jamie = compactJamie(payload);
    lastJamie = jamie;

    const phantomAction = actions.length === 0 && looksLikePhysicalActionClaim(payload?.reply);
    if (phantomAction) hardFailures.push(`Turn ${turnIndex}: Jamie claimed a physical action but ui_action contained no executable actions.`);

    dialogue.push({ student: child.message, jamie: payload?.reply || '' });
    turns.push({ index: turnIndex, student: child.message, child_reason: child.reason, repeat_due_to_jamie: child.repeatDueToJamie, jamie: payload?.reply || '', elapsed_ms: result.elapsedMs, phantom_action: phantomAction, payload, world_before: previousWorld, world_after: world });

    await checkpoint({ type: 'dify_turn', turn: turnIndex, elapsed_ms: result.elapsedMs, payload, world_before: previousWorld, world_after: world, phantom_action: phantomAction });
    await appendConversation([`Student: ${child.message}`, `Jamie: ${payload?.reply || '(no reply)'}`, `Actions: ${actions.map(a => a.type).join(', ') || 'none'}`, `Action source: ${jamie.architecture.action_source || 'none'}`, `Runtime: ${jamie.architecture.runtime_status || 'not reported'} · ${jamie.architecture.comparison_result || 'not compared'}`, `Typed gap: ${jamie.architecture.typed_gap?.type || 'none'}`, `Pipeline errors: ${pipelineErrors.join(', ') || 'none'}`, '']);

    console.log(`${turnIndex}. Student: ${child.message}`);
    console.log(`   Jamie: ${payload?.reply || '(no reply)'}`);
    if (verbose) {
      console.log(`   Actions: ${actions.map(a => a.type).join(', ') || 'none'}`);
      console.log(`   Pending gap: ${JSON.stringify(payload?.debug?.controller?.pending_gap || null)}`);
      console.log(`   Architecture: ${JSON.stringify(jamie.architecture)}`);
      console.log(`   Pipeline errors: ${pipelineErrors.join(', ') || 'none'}`);
      if (payload?.debug?.action_plan?._validation) console.log(`   Planner validation: ${JSON.stringify(payload.debug.action_plan._validation)}`);
    }

    completion = completionCheck(payload);
    if (completion.gameComplete || completion.phaseComplete) break;

    if (!keepGoing && pipelineErrors.length) {
      finalStatus = 'failed';
      await checkpoint({ type: 'fail_fast', turn: turnIndex, reason: 'pipeline_error' });
      break;
    }
    if (!keepGoing && phantomAction) {
      finalStatus = 'failed';
      await checkpoint({ type: 'fail_fast', turn: turnIndex, reason: 'phantom_action' });
      break;
    }
  }

  if (!completion) completion = { ok: false, gameComplete: false, phaseComplete: false, evidence: [], pendingGap: null, pipelineErrors: [] };
  if (!completion.ok) {
    if (!completion.gameComplete) hardFailures.push('Never reached debug.game_complete=true.');
    if (!completion.phaseComplete) hardFailures.push('Never reached phase=complete.');
    if (!Array.isArray(completion.evidence) || !completion.evidence.length) hardFailures.push('Completion evidence is empty.');
    if (completion.pendingGap != null) hardFailures.push('A pending listener gap remains at completion.');
  }
  if (turns.length >= maxTurns && !completion.ok) hardFailures.push(`Exceeded max turn budget (${maxTurns}).`);

  const passed = hardFailures.length === 0 && completion.ok;
  finalStatus = passed ? 'passed' : 'failed';
  await checkpoint({ type: 'run_end', passed, completion, hardFailures });

  console.log('');
  console.log(passed ? 'PASS · grounded full-game completion reached' : 'FAIL · full-game completion not reached');
  console.log(`Turns · ${turns.length}/${maxTurns}`);
  console.log(`Completion evidence · ${JSON.stringify(completion.evidence || [])}`);
  if (hardFailures.length) for (const failure of hardFailures) console.log(`- ${failure}`);
  console.log(`Snapshot · ${jsonPath}`);
  console.log(`Live JSONL · ${livePath}`);
  console.log(`Conversation · ${textPath}`);
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  if (!interrupted) {
    finalStatus = 'error';
    if (!hardFailures.some(item => item.includes(String(error?.message || error)))) hardFailures.push(String(error?.message || error));
    try {
      await checkpoint({ type: 'run_error', message: String(error?.message || error), stack: String(error?.stack || '') });
    } catch {
      // Best effort: the original error is more important.
    }
    console.error('');
    console.error(`ERROR · ${String(error?.message || error)}`);
    console.error(`Partial snapshot · ${jsonPath}`);
    console.error(`Live JSONL · ${livePath}`);
    console.error(`Conversation · ${textPath}`);
    process.exitCode = 2;
  }
}
