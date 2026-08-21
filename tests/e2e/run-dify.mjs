#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  applyActions,
  applyWorldPatch,
  blankWorld,
  flattenActions,
  runAssertions,
} from './assertions.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const scenarios = JSON.parse(await fs.readFile(path.join(here, 'scenarios.json'), 'utf8'));
const args = process.argv.slice(2);
const getArg = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const verbose = args.includes('--verbose');

if (args.includes('--list')) {
  for (const scenario of scenarios) console.log(scenario.name);
  process.exit(0);
}

const apiKey = process.env.DIFY_API_KEY;
const baseUrl = (process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');
const versionLabel = getArg('--label') || process.env.DIFY_TEST_VERSION;
const expectedDslVersion = process.env.DIFY_EXPECT_DSL_VERSION || '';
const requestedScenario = getArg('--scenario');
const repeat = Math.max(1, Number(getArg('--repeat') || 1));

if (!apiKey) {
  console.error('Missing DIFY_API_KEY.');
  process.exit(1);
}
if (!versionLabel) {
  console.error('Missing version label. Use --label v8 (or set DIFY_TEST_VERSION).');
  process.exit(1);
}

const selected = requestedScenario
  ? scenarios.filter(scenario => scenario.name === requestedScenario)
  : scenarios;
if (!selected.length) {
  console.error(`Unknown scenario: ${requestedScenario}`);
  console.error('Use --list to see available scenario names.');
  process.exit(1);
}

class HarnessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HarnessError';
  }
}

function parseDifyAnswer(answer) {
  if (answer && typeof answer === 'object') return answer;
  if (typeof answer !== 'string') throw new Error(`Unexpected Dify answer type: ${typeof answer}`);
  const trimmed = answer.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidates.push(fenced[1].trim());
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  for (const candidate of [...new Set(candidates)]) {
    try {
      let parsed = JSON.parse(candidate);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // Try another candidate.
    }
  }
  throw new Error(`Dify answer is not frontend JSON: ${answer.slice(0, 800)}`);
}

async function sendTurn({ query, conversationId, user }) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/chat-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: 'blocking',
      conversation_id: conversationId || '',
      user,
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Dify ${response.status}: ${raw}`);
  const data = JSON.parse(raw);
  return {
    elapsedMs: Date.now() - startedAt,
    data,
    payload: parseDifyAnswer(data.answer),
  };
}

function safeStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function classifyError(error) {
  if (error instanceof HarnessError) return 'harness';
  const message = String(error?.message || error || '');
  if (/fetch failed/i.test(message)) return 'infra';
  if (/Model .* not exist/i.test(message)) return 'infra';
  if (/provider|credential|api key|rate limit|quota|service unavailable|gateway|timeout/i.test(message)) return 'infra';
  return 'runtime';
}

function conciseError(error) {
  const message = String(error?.message || error || '');
  const difyStatus = message.match(/\bDify\s+(\d{3})\b/i);
  const jsonMessage = message.match(/"message"\s*:\s*"([^"]+)"/i);
  if (difyStatus && jsonMessage) return `Dify ${difyStatus[1]} · ${jsonMessage[1]}`;
  const htmlTitle = message.match(/<title>\s*[^|<]*\|\s*(?:\d{3}:\s*)?([^<]+)<\/title>/i);
  if (difyStatus && htmlTitle) return `Dify ${difyStatus[1]} · ${htmlTitle[1].trim()}`;
  if (difyStatus) return `Dify ${difyStatus[1]}`;
  if (/fetch failed/i.test(message)) return 'fetch failed';
  const firstLine = message.split('\n').find(line => line.trim()) || 'Unknown error';
  return firstLine.trim().slice(0, 220);
}

function usageFrom(data) {
  const usage = data?.metadata?.usage || {};
  return {
    promptTokens: Number(usage.prompt_tokens || 0),
    completionTokens: Number(usage.completion_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0),
    modelLatencyMs: Number(usage.latency || 0) * 1000,
    timeToFirstTokenMs: Number(usage.time_to_first_token || 0) * 1000,
  };
}

function addMetrics(target, elapsedMs, usage) {
  target.elapsedMs += Number(elapsedMs || 0);
  target.promptTokens += usage.promptTokens;
  target.completionTokens += usage.completionTokens;
  target.totalTokens += usage.totalTokens;
  target.successfulTurns += 1;
}

function transcriptText(dialogue) {
  return dialogue.map(turn => `Student: ${turn.student}\nJamie: ${turn.jamie}`).join('\n\n');
}

function normalizedActionTypes(actions) {
  return actions.filter(action => action.type !== 'wait').map(action => action.type);
}

function pairIdentity(object) {
  // label is deliberately excluded: generic labels such as "Card" are not pair identity.
  for (const key of ['symbol', 'caption']) {
    const value = String(object?.[key] ?? '').trim();
    if (value) return `${key}:${value}`;
  }
  return null;
}

function visiblePair(world) {
  const revealed = (world?.objects || []).filter(object => object?.state === 'face_up');
  if (revealed.length !== 2) {
    throw new HarnessError(`Expected exactly two revealed objects before state-dependent repair; got ${revealed.length}.`);
  }
  const identities = revealed.map(pairIdentity);
  if (identities.some(value => !value)) {
    throw new HarnessError('Cannot determine whether the revealed pair matches: revealed objects have no symbol/caption identity.');
  }
  return { objects: revealed, matches: identities[0] === identities[1], identity: identities };
}

function resolveTurnQuery(turn, world) {
  if (typeof turn.query === 'string') return turn.query;
  const pair = visiblePair(world);
  if (turn.queryFromWorld === 'repair-revealed-pair') {
    return pair.matches
      ? 'If they match, take both cards out.'
      : "If they don't match, turn both cards face down again.";
  }
  if (turn.queryFromWorld === 'variant-revealed-pair') {
    return pair.matches
      ? 'In my version, if they match, turn both cards face down again.'
      : "In my version, if they don't match, take both cards out.";
  }
  throw new HarnessError(`Turn has no supported query source: ${JSON.stringify(turn)}`);
}

function visibleWorldText(patch) {
  const text = [];
  for (const key of ['name', 'status']) {
    if (patch?.[key] != null) text.push(String(patch[key]));
  }
  for (const listName of ['add_objects', 'update_objects']) {
    for (const object of patch?.[listName] || []) {
      for (const key of ['label', 'caption']) {
        if (object?.[key] != null) text.push(String(object[key]));
      }
    }
  }
  return text.join(' ');
}

function replyExposesOpenGap(reply) {
  const text = String(reply || '').trim();
  if (!text) return false;
  if (text.includes('?')) return true;
  return /\b(?:don['’]?t know|do not know|not sure|need to know|what happens|what next|now what)\b/i.test(text);
}

function extraAssertions({ expected, payload, previousWorld, worldAfterPatch, actions }) {
  const results = [];
  const pass = (name, detail = '') => ({ name, ok: true, detail });
  const fail = (name, detail) => ({ name, ok: false, detail });

  if (expectedDslVersion) {
    const actual = String(payload?.debug?.dsl_version || '').trim();
    results.push(actual === expectedDslVersion
      ? pass('protocol.dsl-version', actual)
      : fail('protocol.dsl-version', `Expected runtime DSL ${expectedDslVersion}; got ${JSON.stringify(actual || null)}.`));
  }

  if (Array.isArray(expected.worldTextMustNotContain)) {
    const text = visibleWorldText(payload?.world_patch || {});
    const lower = text.toLowerCase();
    const bad = expected.worldTextMustNotContain.filter(token => lower.includes(String(token).toLowerCase()));
    results.push(bad.length
      ? fail('turn.world-visible-text-leakage', `Visible world text contains unstated gameplay language: ${bad.join(', ')}. Text=${JSON.stringify(text)}`)
      : pass('turn.world-visible-text-leakage'));
  }

  if (expected.worldGameplayStateMustBeNeutral) {
    const allowed = new Set(['', 'available', 'empty']);
    const bad = (worldAfterPatch?.objects || []).filter(object => !allowed.has(String(object?.state ?? '')));
    results.push(bad.length
      ? fail('turn.world-gameplay-state-leakage', `World contains gameplay state before it was taught: ${bad.map(object => `${object.id}:${object.state}`).join(', ')}`)
      : pass('turn.world-gameplay-state-leakage'));
  }

  if (expected.worldReadyMustBeFalse) {
    results.push(worldAfterPatch?.ready === false
      ? pass('turn.world-ready-false')
      : fail('turn.world-ready-false', `Expected ready=false before an executable/setup instruction; got ${JSON.stringify(worldAfterPatch?.ready)}.`));
  }

  if (expected.listenerGapAfterAction) {
    const actionPlanGap = payload?.debug?.action_plan?.post_action_gap;
    const pendingGap = payload?.debug?.controller?.pending_gap;
    const gap = actionPlanGap || pendingGap;
    const missing = String(gap?.missing_for_next_action || '').trim();
    results.push(missing
      ? pass('turn.listener-gap-internal', missing)
      : fail('turn.listener-gap-internal', 'Jamie acted, but no grounded post-action/pending listener gap was recorded.'));
    results.push(replyExposesOpenGap(payload?.reply)
      ? pass('turn.listener-gap-visible', String(payload?.reply || ''))
      : fail('turn.listener-gap-visible', `A real internal gap must also be exposed to the learner. Got reply=${JSON.stringify(payload?.reply || '')}`));
  }

  if (expected.actionTypesMatchRevealedPair || expected.actionTypesMatchVariantPair) {
    let pair;
    try {
      pair = visiblePair(previousWorld);
    } catch (error) {
      throw error instanceof HarnessError ? error : new HarnessError(String(error?.message || error));
    }
    const expectedTypes = expected.actionTypesMatchVariantPair
      ? (pair.matches ? ['hide_object', 'hide_object'] : ['remove_object', 'remove_object'])
      : (pair.matches ? ['remove_object', 'remove_object'] : ['hide_object', 'hide_object']);
    const actual = normalizedActionTypes(actions);
    const name = expected.actionTypesMatchVariantPair ? 'turn.variant-branch' : 'turn.repair-branch';
    results.push(JSON.stringify(actual) === JSON.stringify(expectedTypes)
      ? pass(name, `${pair.matches ? 'matching' : 'non-matching'} pair → ${actual.join(', ')}`)
      : fail(name, `Revealed pair was ${pair.matches ? 'matching' : 'non-matching'} (${pair.identity.join(' vs ')}); expected ${JSON.stringify(expectedTypes)}, got ${JSON.stringify(actual)}`));
  }

  return results;
}

const traceRoot = path.resolve(process.cwd(), '.artifacts', 'dify-e2e');
await fs.mkdir(traceRoot, { recursive: true });

let totalBehaviorFailures = 0;
let totalAssertionFailures = 0;
let totalInfraErrors = 0;
let totalRuntimeErrors = 0;
let totalHarnessErrors = 0;
const aggregateMetrics = { elapsedMs: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, successfulTurns: 0 };
const completedDialogues = [];

console.log(`Dify E2E · ${versionLabel}`);
if (expectedDslVersion) console.log(`Runtime DSL expected · ${expectedDslVersion}`);
if (verbose) {
  console.log(`Scenarios: ${selected.length} × ${repeat}`);
  console.log(`Base URL: ${baseUrl}`);
}
console.log('');

for (let iteration = 1; iteration <= repeat; iteration += 1) {
  for (const scenario of selected) {
    const user = `game-teacher-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let conversationId = '';
    let world = blankWorld();
    let baseline = null;
    const turnsTrace = [];
    const dialogue = [];
    let scenarioBehaviorFailures = 0;
    let scenarioAssertionFailures = 0;
    let scenarioInfraErrors = 0;
    let scenarioRuntimeErrors = 0;
    let scenarioHarnessErrors = 0;
    const scenarioMetrics = { elapsedMs: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, successfulTurns: 0 };

    console.log(`▶ ${scenario.name}${repeat > 1 ? ` [${iteration}/${repeat}]` : ''}`);

    for (let index = 0; index < scenario.turns.length; index += 1) {
      const turn = scenario.turns[index];
      const previousWorld = JSON.parse(JSON.stringify(world));
      let query = '';
      try {
        query = resolveTurnQuery(turn, previousWorld);
        const result = await sendTurn({ query, conversationId, user });
        conversationId = result.data.conversation_id || conversationId;
        const payload = result.payload;
        const actions = flattenActions(payload.ui_action);
        const worldAfterPatch = applyWorldPatch(world, payload.world_patch);
        if (payload.capture_baseline && !baseline) baseline = JSON.parse(JSON.stringify(worldAfterPatch));
        world = applyActions(worldAfterPatch, actions, baseline);

        const assertionResults = [
          ...runAssertions({ expected: turn.assert || {}, payload, previousWorld, worldAfterPatch, actions }),
          ...extraAssertions({ expected: turn.assert || {}, payload, previousWorld, worldAfterPatch, actions }),
        ];
        const failures = assertionResults.filter(resultItem => !resultItem.ok);
        if (failures.length) {
          scenarioBehaviorFailures += 1;
          totalBehaviorFailures += 1;
          scenarioAssertionFailures += failures.length;
          totalAssertionFailures += failures.length;
        }

        const turnUsage = usageFrom(result.data);
        addMetrics(scenarioMetrics, result.elapsedMs, turnUsage);
        addMetrics(aggregateMetrics, result.elapsedMs, turnUsage);
        const mark = failures.length ? '✗' : '✓';
        const perf = verbose
          ? `${(result.elapsedMs / 1000).toFixed(1)}s · ${turnUsage.totalTokens.toLocaleString()} tok`
          : `${(result.elapsedMs / 1000).toFixed(1)}s`;
        console.log(`  ${mark} turn ${index + 1} · ${perf}`);
        if (failures.length) {
          for (const failure of failures) console.log(`    ${failure.name}: ${failure.detail}`);
        } else if (verbose) {
          console.log(`    Student: ${query}`);
          console.log(`    Jamie: ${String(payload?.reply || '')}`);
        }

        const jamieReply = String(payload?.reply || '');
        dialogue.push({ student: query, jamie: jamieReply });
        turnsTrace.push({
          index: index + 1,
          query,
          querySource: turn.queryFromWorld || 'literal',
          elapsedMs: result.elapsedMs,
          usage: turnUsage,
          conversationId,
          messageId: result.data.message_id,
          rawDifyResponse: result.data,
          payload,
          assertions: assertionResults,
          previousWorld,
          worldAfterPatch,
          worldAfterActions: world,
          baseline,
        });

        if (failures.length && turn.stopScenarioOnFailure) {
          console.log('  ↳ stop · prerequisite turn failed; later state-dependent turns skipped');
          break;
        }
      } catch (error) {
        const category = classifyError(error);
        if (category === 'infra') {
          scenarioInfraErrors += 1;
          totalInfraErrors += 1;
        } else if (category === 'harness') {
          scenarioHarnessErrors += 1;
          totalHarnessErrors += 1;
        } else {
          scenarioRuntimeErrors += 1;
          totalRuntimeErrors += 1;
        }
        const mark = category === 'infra' ? '!' : '✗';
        console.log(`  ${mark} turn ${index + 1} · ${category} · ${conciseError(error)}`);
        if (verbose) console.log(`    ${String(error?.message || error).slice(0, 1200)}`);
        turnsTrace.push({
          index: index + 1,
          query: query || turn.query || `[${turn.queryFromWorld || 'unresolved query'}]`,
          errorCategory: category,
          runtimeError: error.stack || error.message,
        });
        break;
      }
    }

    const trace = {
      versionLabel,
      expectedDslVersion: expectedDslVersion || null,
      observedDslVersion: turnsTrace.find(turn => turn?.payload?.debug?.dsl_version)?.payload?.debug?.dsl_version || null,
      scenario: scenario.name,
      description: scenario.description,
      manualReview: scenario.manualReview || [],
      iteration,
      startedUser: user,
      finalConversationId: conversationId,
      failures: scenarioBehaviorFailures,
      behaviorFailures: scenarioBehaviorFailures,
      assertionFailures: scenarioAssertionFailures,
      infraErrors: scenarioInfraErrors,
      runtimeErrors: scenarioRuntimeErrors,
      harnessErrors: scenarioHarnessErrors,
      metrics: scenarioMetrics,
      conversation: dialogue,
      turns: turnsTrace,
    };

    const stem = `${safeStamp()}__${versionLabel.replace(/[^a-zA-Z0-9_.-]/g, '_')}__${scenario.name}__${iteration}`;
    const tracePath = path.join(traceRoot, `${stem}.json`);
    const conversationPath = path.join(traceRoot, `${stem}__conversation.txt`);
    await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
    await fs.writeFile(conversationPath, `${transcriptText(dialogue)}${dialogue.length ? '\n' : ''}`);

    console.log(`  trace · ${path.relative(process.cwd(), tracePath)}`);
    console.log(`  text  · ${path.relative(process.cwd(), conversationPath)}`);
    if (verbose && scenario.manualReview?.length) console.log(`  manual review · ${scenario.manualReview.length} item(s)`);
    console.log('');
    completedDialogues.push(dialogue);
  }
}

const averageMs = aggregateMetrics.successfulTurns ? aggregateMetrics.elapsedMs / aggregateMetrics.successfulTurns : 0;
const averageTokens = aggregateMetrics.successfulTurns ? aggregateMetrics.totalTokens / aggregateMetrics.successfulTurns : 0;
console.log(`Result · ${totalBehaviorFailures} behavior · ${totalInfraErrors} infra · ${totalRuntimeErrors} runtime · ${totalHarnessErrors} harness`);
if (totalAssertionFailures) console.log(`Checks · ${totalAssertionFailures} failed assertion${totalAssertionFailures === 1 ? '' : 's'}`);
if (aggregateMetrics.successfulTurns) {
  console.log(`Perf   · ${(averageMs / 1000).toFixed(1)}s/turn · ${Math.round(averageTokens).toLocaleString()} tok/turn`);
}
if (completedDialogues.length === 1 && completedDialogues[0].length) {
  console.log('\nConversation\n');
  console.log(transcriptText(completedDialogues[0]));
}

if (totalBehaviorFailures || totalInfraErrors || totalRuntimeErrors || totalHarnessErrors) process.exit(1);
