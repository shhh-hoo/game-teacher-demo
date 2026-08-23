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

function encodeGameTeacherEvent(event) {
  return `[[GAME_TEACHER_EVENT]]\n${JSON.stringify(event)}`;
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
      thinking: { type: 'disabled' },
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

const GAME_DESIGN_PROMPT = `You design one very small original game for a Grade 3–4 child to teach to Raku.

The purpose is to test whether a game-teaching AI can reach a real, child-taught ending. Keep the game easy enough to finish in 6–10 conversational turns.

Hard constraints:
- Use only a small visible set of cards, tokens, markers, tiles, or pieces (2–8 objects).
- Prefer actions that can be expressed as reveal, hide, remove, change an object's visible state, set a turn, or update a simple counter/status.
- Do not require dice, external randomness, arithmetic beyond small counting, timers, physics, or hidden information that the visible world cannot represent.
- Do not copy a famous game's canonical rules. Invent a simple game so Raku cannot rely on pretrained rule knowledge.
- The ending condition must be objectively observable in the visible world and achievable within the turn budget.
- The child should be able to teach the rules naturally, one or two ideas at a time.
- Do not invent a game that depends on the child physically taking turns inside this harness. Prefer a game Raku can advance through its visible state by itself once taught.

Return JSON only:
{
  "name": "short original game name",
  "objects": "what physically exists at the start",
  "setup": ["setup facts/rules"],
  "procedure": ["ordered playable rules"],
  "ending_condition": "observable child-taught ending",
  "notes": "brief explanation of why this is finishable"
}`;

const CHILD_PROMPT = `You are simulating a believable Grade 3–4 child teaching Raku ONE fixed game.

You know the hidden game specification. Raku does not. Your job is to teach naturally and help the interaction actually play the game to its ending.

Behavior:
- Never change the hidden game rules.
- Speak like a child in short, ordinary sentences, not like a test harness.
- Teach only information Raku needs.
- If Raku asks a real question, answer it directly.
- If Raku already knows enough to continue, use a natural cue such as "keep going", "your turn", or a short reminder rather than re-teaching everything.
- If Raku repeats a question that you already clearly answered, you may restate it once, but flag this in repeat_due_to_jamie.
- Teach the ending condition before it is reached.
- Never claim that an object moved, disappeared, matched, scored, or otherwise changed unless that is visible in the supplied world state.
- Never say the game is over merely to force completion. The world must actually satisfy the taught ending condition.
- If Raku says it performed a physical move but the supplied world state did not change, point that out naturally once. Do not experiment with capitalization, magic phrases, exact command syntax, or alternate trigger words.
- If last_jamie_result.phase is "transfer", answer Raku's transfer question substantively in one short sentence about what you would make sure a new player knows. Do not teach a new game rule or continue gameplay.
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
      row: o.row ?? null,
      column: o.column ?? null,
    })),
  };
}

function compactJamie(payload) {
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

async function sendDifyTurn({ message = '', event = null, conversationId, userId }) {
  const startedAt = Date.now();
  let response;

  if (proxyUrl) {
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, event, conversationId, userId }),
    });
  } else {
    const query = event ? encodeGameTeacherEvent(event) : message;
    response = await fetch(`${difyBaseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query,
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

function currentCompletion(payload) {
  const debug = payload?.debug || {};
  const controller = debug?.controller || {};
  return {
    gameComplete: debug.game_complete === true || controller.game_complete === true,
    phaseComplete: String(payload?.phase || '') === 'complete',
    evidence: debug.completion_evidence || controller.completion_evidence || [],
    pendingGap: controller.pending_gap ?? debug?.gap_state?.pending ?? null,
    pipelineErrors: Array.isArray(debug.pipeline_errors) ? debug.pipeline_errors : [],
  };
}

function looksLikePhysicalActionClaim(reply) {
  const text = String(reply || '').toLowerCase();
  return /\b(?:i(?:'ll| will| have| just)?|let me)\s+(?:flip|flipped|reveal|revealed|hide|hid|remove|removed|take|took|collect|collected|move|moved|put|place|placed|turn|turned|swap|swapped)\b/.test(text);
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
const bootstrapTurns = [];
const hardFailures = [];
const pipelineErrorsSeen = [];
let groundedGameComplete = false;
let groundedCompletionEvidence = [];
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
    bootstrapTurns,
    groundedGameComplete,
    groundedCompletionEvidence,
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

function bootstrapPosition(world, id) {
  const object = (world?.objects || []).find(item => String(item?.id) === String(id));
  return { row: object?.row ?? null, column: object?.column ?? null };
}

function assertFoundationStep(index, payload, actions, worldAfterActions) {
  const failures = [];
  const phase = String(payload?.phase || '');
  const supportType = String(payload?.support?.type || '');
  if (expectedDslVersion) {
    const actual = String(payload?.debug?.dsl_version || '').trim();
    if (actual !== expectedDslVersion) failures.push(`runtime DSL mismatch: expected ${expectedDslVersion}, got ${JSON.stringify(actual || null)}`);
  }
  const expectPos = (id,row,column,label) => {
    const pos=bootstrapPosition(worldAfterActions,id);
    if (pos.row!==row || pos.column!==column) failures.push(`${label}: expected ${id} at ${row},${column}; got ${JSON.stringify(pos)}`);
  };
  if (index===1) {
    if (phase!=='follow') failures.push(`lesson_start phase=${phase}`);
    if (worldAfterActions?.name!=='Can You Follow Me?') failures.push(`follow world=${JSON.stringify(worldAfterActions?.name)}`);
    if (supportType!=='listener_task') failures.push(`follow support=${supportType}`);
  }
  if (index===3) {
    expectPos('follow_triangle',1,3,'vague direction choice');
    const instruction=String(payload?.support?.instruction || '').toLowerCase();
    if (!instruction.includes('top-left')) failures.push('Raku did not add the missing top-left detail');
  }
  if (index===5) expectPos('follow_triangle',1,1,'specific repair');
  if (index===7) expectPos('follow_circle',1,2,'circle placement');
  if (index===9) {
    expectPos('follow_square',2,2,'square placement');
    if (supportType!=='reconstruction_result') failures.push(`follow completion support=${supportType}`);
  }
  if (index===10) {
    if (phase!=='guide') failures.push(`role reversal phase=${phase}`);
    if (supportType!=='reconstruction_task') failures.push(`guide support=${supportType}`);
  }
  if (index===11) expectPos('guide_circle',2,2,'ambiguous learner direction');
  if (index===12) expectPos('guide_circle',2,1,'learner repair');
  if (index===13) expectPos('guide_square',1,1,'guide square');
  if (index===14) {
    expectPos('guide_triangle',1,2,'guide triangle');
    if (phase!=='game_select') failures.push(`guide completion phase=${phase}`);
    if (supportType!=='game_picker') failures.push(`game picker support=${supportType}`);
  }
  if (index===15) {
    if (phase!=='student_teaching') failures.push(`game selection phase=${phase}`);
    if (supportType!=='game_guide') failures.push(`game guide support=${supportType}`);
    if ((worldAfterActions?.objects || []).length) failures.push('game selection did not reset to a blank learner-authored world');
  }
  const pipelineErrors = Array.isArray(payload?.debug?.pipeline_errors) ? payload.debug.pipeline_errors : [];
  if (pipelineErrors.length) failures.push(`pipeline_errors=${pipelineErrors.join(', ')}`);
  return failures;
}

async function runV12Foundations() {
  const steps = [
    { event:{type:'lesson_start'}, label:'follow · start' },
    { event:{type:'object_click',object_id:'follow_triangle'}, label:'follow · select triangle' },
    { event:{type:'object_click',object_id:'follow_tr'}, label:'follow · vague top choice' },
    { event:{type:'object_click',object_id:'follow_triangle'}, label:'follow · reselect triangle' },
    { event:{type:'object_click',object_id:'follow_tl'}, label:'follow · repair triangle' },
    { event:{type:'object_click',object_id:'follow_circle'}, label:'follow · select circle' },
    { event:{type:'object_click',object_id:'follow_tc'}, label:'follow · place circle' },
    { event:{type:'object_click',object_id:'follow_square'}, label:'follow · select square' },
    { event:{type:'object_click',object_id:'follow_bc'}, label:'follow · complete target' },
    { event:{type:'continue_stage'}, label:'guide · role reversal' },
    { message:'Put the circle at the bottom.', label:'guide · ambiguous bottom' },
    { message:'No, put the circle in the bottom-left spot.', label:'guide · repair circle' },
    { message:'Put the square in the top-left spot.', label:'guide · square' },
    { message:'Put the triangle to the right of the square.', label:'guide · complete target' },
    { event:{type:'game_choice_selected',choice:'Another simple game'}, label:'game · choose generated game' },
  ];

  console.log('V12 foundations');
  for (let index=0; index<steps.length; index+=1) {
    const step=steps[index]; const previousWorld=structuredClone(world);
    const result=await sendDifyTurn({ message:step.message || '', event:step.event || null, conversationId, userId });
    conversationId=result.conversationId; const payload=result.payload;
    const worldAfterPatch=applyWorldPatch(world,payload?.world_patch || {});
    const actions=flattenActions(payload?.ui_action); const worldAfterActions=applyActions(worldAfterPatch,actions,baseline); world=worldAfterActions;
    const failures=assertFoundationStep(index+1,payload,actions,worldAfterActions);
    bootstrapTurns.push({index:index+1,label:step.label,event:step.event || null,message:step.message || null,elapsed_ms:result.elapsedMs,failures,payload,world_before:previousWorld,world_after:worldAfterActions});
    await checkpoint({type:'v12_foundation_turn',turn:index+1,label:step.label,failures,payload,world_before:previousWorld,world_after:worldAfterActions});
    await appendConversation([`Foundation: ${step.label}`, `Student: ${step.message || (step.event ? `[${step.event.type}]` : '')}`, `Raku: ${payload?.reply || '(no reply)'}`, `Actions: ${actions.map(a=>a.type).join(', ') || 'none'}`, '']);
    console.log(`  ${failures.length ? '✗' : '✓'} ${step.label}`);
    if (failures.length) {
      for (const failure of failures) console.log(`    ${failure}`);
      hardFailures.push(...failures.map(failure=>`Foundations: ${failure}`));
      throw new Error(`V12 foundations failed: ${failures.join('; ')}`);
    }
    lastJamie=compactJamie(payload);
  }
  baseline=null;
  console.log('  ✓ ready for learner-authored game');
  console.log('');
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

  await runV12Foundations();

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
      await appendConversation([`Student: ${child.message}`, `Raku: [DIFY ERROR] ${String(error?.message || error)}`, '']);
      throw error;
    }

    conversationId = result.conversationId;
    const payload = result.payload;

    if (expectedDslVersion) {
      const actual = String(payload?.debug?.dsl_version || '').trim();
      if (actual !== expectedDslVersion) hardFailures.push(`Turn ${turnIndex}: runtime DSL mismatch: expected ${expectedDslVersion}, got ${JSON.stringify(actual || null)}.`);
    }

    const current = currentCompletion(payload);
    if (current.pipelineErrors.length) {
      hardFailures.push(`Turn ${turnIndex}: pipeline_errors=${current.pipelineErrors.join(', ')}`);
      pipelineErrorsSeen.push(...current.pipelineErrors);
    }
    if (current.gameComplete && Array.isArray(current.evidence) && current.evidence.length) {
      groundedGameComplete = true;
      groundedCompletionEvidence = [...new Set([...groundedCompletionEvidence, ...current.evidence.map(String)])];
    }

    const worldAfterPatch = applyWorldPatch(world, payload?.world_patch || {});
    if (payload?.capture_baseline) baseline = structuredClone(worldAfterPatch);
    const actions = flattenActions(payload?.ui_action);
    world = applyActions(worldAfterPatch, actions, baseline);

    const jamie = compactJamie(payload);
    lastJamie = jamie;

    const phantomAction = actions.length === 0 && looksLikePhysicalActionClaim(payload?.reply) && !['transfer', 'complete'].includes(String(payload?.phase || ''));
    if (phantomAction) hardFailures.push(`Turn ${turnIndex}: Raku claimed a physical action but ui_action contained no executable actions.`);

    dialogue.push({ student: child.message, jamie: payload?.reply || '' });
    turns.push({ index: turnIndex, student: child.message, child_reason: child.reason, repeat_due_to_jamie: child.repeatDueToJamie, jamie: payload?.reply || '', elapsed_ms: result.elapsedMs, phantom_action: phantomAction, payload, world_before: previousWorld, world_after: world });

    completion = {
      gameComplete: groundedGameComplete,
      phaseComplete: current.phaseComplete,
      evidence: groundedCompletionEvidence,
      pendingGap: current.pendingGap,
      pipelineErrors: [...pipelineErrorsSeen],
      ok: groundedGameComplete
        && current.phaseComplete
        && groundedCompletionEvidence.length > 0
        && current.pendingGap == null
        && pipelineErrorsSeen.length === 0,
    };

    await checkpoint({ type: 'dify_turn', turn: turnIndex, elapsed_ms: result.elapsedMs, payload, world_before: previousWorld, world_after: world, phantom_action: phantomAction, grounded_game_complete: groundedGameComplete, grounded_completion_evidence: groundedCompletionEvidence });
    await appendConversation([`Student: ${child.message}`, `Raku: ${payload?.reply || '(no reply)'}`, `Phase: ${payload?.phase || 'unknown'}`, `Actions: ${actions.map(a => a.type).join(', ') || 'none'}`, `Pipeline errors: ${current.pipelineErrors.join(', ') || 'none'}`, '']);

    console.log(`${turnIndex}. Student: ${child.message}`);
    console.log(`   Raku: ${payload?.reply || '(no reply)'}`);
    console.log(`   Phase: ${payload?.phase || 'unknown'}`);
    if (verbose) {
      console.log(`   Actions: ${actions.map(a => a.type).join(', ') || 'none'}`);
      console.log(`   Pending gap: ${JSON.stringify(payload?.debug?.controller?.pending_gap || null)}`);
      console.log(`   Grounded game complete: ${groundedGameComplete}`);
      console.log(`   Pipeline errors: ${current.pipelineErrors.join(', ') || 'none'}`);
      if (payload?.debug?.action_plan?._validation) console.log(`   Planner validation: ${JSON.stringify(payload.debug.action_plan._validation)}`);
    }

    if (completion.phaseComplete) break;

    if (!keepGoing && current.pipelineErrors.length) {
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

  if (!completion) {
    completion = {
      ok: false,
      gameComplete: groundedGameComplete,
      phaseComplete: false,
      evidence: groundedCompletionEvidence,
      pendingGap: null,
      pipelineErrors: [...pipelineErrorsSeen],
    };
  }
  if (!completion.ok) {
    if (!completion.gameComplete) hardFailures.push('Never reached grounded child-taught game completion.');
    if (!completion.phaseComplete) hardFailures.push('Never reached phase=complete after transfer.');
    if (!Array.isArray(completion.evidence) || !completion.evidence.length) hardFailures.push('Grounded completion evidence is empty.');
    if (completion.pendingGap != null) hardFailures.push('A pending listener gap remains at completion.');
  }
  if (turns.length >= maxTurns && !completion.ok) hardFailures.push(`Exceeded max turn budget (${maxTurns}).`);

  const passed = hardFailures.length === 0 && completion.ok;
  finalStatus = passed ? 'passed' : 'failed';
  await checkpoint({ type: 'run_end', passed, completion, hardFailures });

  console.log('');
  console.log(passed ? 'PASS · grounded game completion + transfer completion reached' : 'FAIL · full lesson completion not reached');
  console.log(`Turns · ${turns.length}/${maxTurns} (+ 15 foundation turns)`);
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
