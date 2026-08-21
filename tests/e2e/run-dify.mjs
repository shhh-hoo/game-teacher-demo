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
const scenariosPath = path.join(here, 'scenarios.json');
const scenarios = JSON.parse(await fs.readFile(scenariosPath, 'utf8'));

const args = process.argv.slice(2);
const getArg = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

if (args.includes('--list')) {
  for (const scenario of scenarios) console.log(scenario.name);
  process.exit(0);
}

const apiKey = process.env.DIFY_API_KEY;
const baseUrl = (process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');
const versionLabel = getArg('--label') || process.env.DIFY_TEST_VERSION;
const requestedScenario = getArg('--scenario');
const repeat = Math.max(1, Number(getArg('--repeat') || 1));

if (!apiKey) {
  console.error('Missing DIFY_API_KEY.');
  process.exit(1);
}
if (!versionLabel) {
  console.error('Missing version label. Use --label v7-fixed2 (or set DIFY_TEST_VERSION).');
  console.error('The label is recorded in traces so runs cannot silently become anonymous/mis-versioned.');
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

function classifyRuntimeError(error) {
  const message = String(error?.message || error || '');
  if (/fetch failed/i.test(message)) return 'infra';
  if (/Model .* not exist/i.test(message)) return 'infra';
  if (/provider|credential|api key|rate limit|quota|service unavailable|gateway|timeout/i.test(message)) return 'infra';
  return 'runtime';
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

const traceRoot = path.resolve(process.cwd(), '.artifacts', 'dify-e2e');
await fs.mkdir(traceRoot, { recursive: true });

let totalBehaviorFailures = 0;
let totalInfraErrors = 0;
let totalRuntimeErrors = 0;
let totalTurns = 0;
const aggregateMetrics = { elapsedMs: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, successfulTurns: 0 };
const runSummary = [];

console.log('Dify E2E regression run');
console.log(`Version label: ${versionLabel}`);
console.log(`Scenarios: ${selected.length} × ${repeat}`);
console.log(`Base URL: ${baseUrl}\n`);

for (let iteration = 1; iteration <= repeat; iteration += 1) {
  for (const scenario of selected) {
    const user = `game-teacher-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let conversationId = '';
    let world = blankWorld();
    let baseline = null;
    const turnsTrace = [];
    let scenarioBehaviorFailures = 0;
    let scenarioInfraErrors = 0;
    let scenarioRuntimeErrors = 0;
    const scenarioMetrics = { elapsedMs: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, successfulTurns: 0 };

    console.log(`▶ ${scenario.name}${repeat > 1 ? ` [${iteration}/${repeat}]` : ''}`);

    for (let index = 0; index < scenario.turns.length; index += 1) {
      totalTurns += 1;
      const turn = scenario.turns[index];
      const previousWorld = JSON.parse(JSON.stringify(world));
      try {
        const result = await sendTurn({ query: turn.query, conversationId, user });
        conversationId = result.data.conversation_id || conversationId;
        const payload = result.payload;
        const actions = flattenActions(payload.ui_action);
        const worldAfterPatch = applyWorldPatch(world, payload.world_patch);
        if (payload.capture_baseline && !baseline) baseline = JSON.parse(JSON.stringify(worldAfterPatch));
        world = applyActions(worldAfterPatch, actions, baseline);
        const assertionResults = runAssertions({
          expected: turn.assert || {},
          payload,
          previousWorld,
          worldAfterPatch,
          actions,
        });
        const failures = assertionResults.filter(result => !result.ok);
        scenarioBehaviorFailures += failures.length;
        totalBehaviorFailures += failures.length;
        const turnUsage = usageFrom(result.data);
        addMetrics(scenarioMetrics, result.elapsedMs, turnUsage);
        addMetrics(aggregateMetrics, result.elapsedMs, turnUsage);
        const mark = failures.length ? 'FAIL' : 'PASS';
        console.log(`  ${mark} ${index + 1}. ${turn.query} (${(result.elapsedMs / 1000).toFixed(1)}s, ${turnUsage.totalTokens.toLocaleString()} tok)`);
        for (const failure of failures) console.log(`       ✗ ${failure.name}: ${failure.detail}`);

        turnsTrace.push({
          index: index + 1,
          query: turn.query,
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
      } catch (error) {
        const category = classifyRuntimeError(error);
        if (category === 'infra') {
          scenarioInfraErrors += 1;
          totalInfraErrors += 1;
        } else {
          scenarioRuntimeErrors += 1;
          totalRuntimeErrors += 1;
        }
        console.log(`  ${category === 'infra' ? 'INFRA' : 'ERROR'} ${index + 1}. ${turn.query}`);
        console.log(`       ✗ ${category}: ${error.message}`);
        turnsTrace.push({
          index: index + 1,
          query: turn.query,
          errorCategory: category,
          runtimeError: error.stack || error.message,
        });
        break;
      }
    }

    const trace = {
      versionLabel,
      scenario: scenario.name,
      description: scenario.description,
      manualReview: scenario.manualReview || [],
      iteration,
      startedUser: user,
      finalConversationId: conversationId,
      failures: scenarioBehaviorFailures,
      behaviorFailures: scenarioBehaviorFailures,
      infraErrors: scenarioInfraErrors,
      runtimeErrors: scenarioRuntimeErrors,
      metrics: scenarioMetrics,
      turns: turnsTrace,
    };
    const traceName = `${safeStamp()}__${versionLabel.replace(/[^a-zA-Z0-9_.-]/g, '_')}__${scenario.name}__${iteration}.json`;
    const tracePath = path.join(traceRoot, traceName);
    await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
    console.log(`  → trace: ${path.relative(process.cwd(), tracePath)}`);
    if (scenario.manualReview?.length) {
      console.log(`  → manual review: ${scenario.manualReview.join(' | ')}`);
    }
    if (scenarioMetrics.successfulTurns) {
      console.log(`  → metrics: ${(scenarioMetrics.elapsedMs / 1000).toFixed(1)}s, ${scenarioMetrics.totalTokens.toLocaleString()} tokens`);
    }
    console.log('');
    runSummary.push({
      scenario: scenario.name,
      iteration,
      behaviorFailures: scenarioBehaviorFailures,
      infraErrors: scenarioInfraErrors,
      runtimeErrors: scenarioRuntimeErrors,
      metrics: scenarioMetrics,
      tracePath,
    });
  }
}

const averageMs = aggregateMetrics.successfulTurns ? aggregateMetrics.elapsedMs / aggregateMetrics.successfulTurns : 0;
const averageTokens = aggregateMetrics.successfulTurns ? aggregateMetrics.totalTokens / aggregateMetrics.successfulTurns : 0;
console.log(`Finished: ${runSummary.length} scenario run(s), ${totalTurns} attempted turn(s).`);
console.log(`Behavior failures: ${totalBehaviorFailures}; infra errors: ${totalInfraErrors}; runtime errors: ${totalRuntimeErrors}.`);
if (aggregateMetrics.successfulTurns) {
  console.log(`Successful turns: ${aggregateMetrics.successfulTurns}; avg ${(averageMs / 1000).toFixed(1)}s/turn; avg ${Math.round(averageTokens).toLocaleString()} tokens/turn; total ${aggregateMetrics.totalTokens.toLocaleString()} tokens.`);
}
if (totalBehaviorFailures || totalInfraErrors || totalRuntimeErrors) process.exit(1);
