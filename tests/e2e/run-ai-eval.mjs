#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { judgeTrace } from './judge.mjs';

const args = process.argv.slice(2);
const getArg = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const runs = Math.max(1, Number(getArg('--runs') || process.env.AI_EVAL_RUNS || 1));
const minOverall = Number(process.env.AI_EVAL_MIN_OVERALL || 4.0);
const minDimension = Number(process.env.AI_EVAL_MIN_DIMENSION || 3.0);
const childOutputRetries = Math.max(0, Number(process.env.AI_CHILD_OUTPUT_RETRIES ?? 1));
const traceRoot = path.resolve(process.cwd(), '.artifacts', 'dify-e2e');

function isTraceFile(name) {
  return /__ai-full-game\.json$/.test(name);
}

async function newestTraceSince(startedAt) {
  const names = await fs.readdir(traceRoot).catch(() => []);
  const candidates = [];
  for (const name of names.filter(isTraceFile)) {
    const full = path.join(traceRoot, name);
    const stat = await fs.stat(full).catch(() => null);
    if (stat && stat.mtimeMs >= startedAt - 2000) candidates.push({ full, mtimeMs: stat.mtimeMs });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.full || null;
}

function runFullGame(extraArgs = []) {
  return new Promise(resolve => {
    const child = spawn(
      process.execPath,
      ['tests/e2e/run-ai-full-game.mjs', '--keep-going', '--verbose', ...extraArgs],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      },
    );
    child.on('exit', (code, signal) => resolve({ code: code ?? 2, signal }));
  });
}

function traceFailures(trace) {
  return Array.isArray(trace?.hardFailures) ? trace.hardFailures.map(String) : [];
}

function classifyInconclusive(trace) {
  const failures = traceFailures(trace);
  const text = failures.join('\n');

  if (/AI child (?:turn was not valid JSON|returned an empty message)/i.test(text)) {
    return {
      classification: 'harness/ai-child-output',
      retryable: true,
      reason: failures.find(item => /AI child (?:turn was not valid JSON|returned an empty message)/i.test(item)) || 'AI child output was unusable.',
    };
  }

  if (/\b(?:502|503|504)\b|gateway(?: time-out| timeout)?|fetch failed|service unavailable|upstream timeout|timed out/i.test(text)) {
    return {
      classification: 'infra',
      retryable: false,
      reason: failures.find(item => /\b(?:502|503|504)\b|gateway(?: time-out| timeout)?|fetch failed|service unavailable|upstream timeout|timed out/i.test(item)) || 'Infrastructure failure.',
    };
  }

  return null;
}

function evalGate(result) {
  if (!result || result.status !== 'ok') {
    return { ok: false, reasons: [result?.reason || 'AI evaluator did not return a usable result.'] };
  }
  const reasons = [];
  if (result.critical_failure) {
    reasons.push(`critical failure: ${(result.critical_issues || []).join(', ') || 'unspecified'}`);
  }
  if (Number(result.overall) < minOverall) {
    reasons.push(`overall ${result.overall} < ${minOverall}`);
  }
  for (const [key, value] of Object.entries(result.scores || {})) {
    if (Number(value) < minDimension) reasons.push(`${key} ${value} < ${minDimension}`);
  }
  return { ok: reasons.length === 0, reasons };
}

async function evaluateTrace(tracePath, trace = null) {
  const loadedTrace = trace || JSON.parse(await fs.readFile(tracePath, 'utf8'));
  const evaluation = await judgeTrace(loadedTrace);
  const gate = evalGate(evaluation);
  const output = {
    trace: tracePath,
    hard_status: loadedTrace.status || null,
    hard_failures: loadedTrace.hardFailures || [],
    completion: loadedTrace.completion || null,
    evaluation,
    gate,
    evaluated_at: new Date().toISOString(),
  };
  const evalPath = tracePath.replace(/\.json$/, '__eval.json');
  await fs.writeFile(evalPath, JSON.stringify(output, null, 2), 'utf8');
  return { trace: loadedTrace, evaluation, gate, evalPath };
}

async function runAttempt(runIndex, attemptIndex) {
  const startedAt = Date.now();
  const runResult = await runFullGame();
  const tracePath = await newestTraceSince(startedAt);

  if (!tracePath) {
    return {
      runResult,
      tracePath: null,
      trace: null,
      classification: {
        classification: 'harness/missing-trace',
        retryable: false,
        reason: 'No AI full-game trace was produced.',
      },
    };
  }

  const trace = JSON.parse(await fs.readFile(tracePath, 'utf8'));
  const classification = classifyInconclusive(trace);
  return { runResult, tracePath, trace, classification, runIndex, attemptIndex };
}

const results = [];
let allPassed = true;
let anyInconclusive = false;

console.log(`AI test + eval · runs=${runs}`);
console.log(`Eval gate · overall>=${minOverall}, every dimension>=${minDimension}, no critical failure`);
console.log(`AI child output retry · ${childOutputRetries}`);
console.log('');

for (let index = 1; index <= runs; index += 1) {
  console.log(`=== AI run ${index}/${runs} ===`);
  const attempts = [];
  let attemptResult = null;

  for (let attemptIndex = 0; attemptIndex <= childOutputRetries; attemptIndex += 1) {
    attemptResult = await runAttempt(index, attemptIndex + 1);
    attempts.push({
      attempt: attemptIndex + 1,
      hardExitCode: attemptResult.runResult.code,
      tracePath: attemptResult.tracePath,
      classification: attemptResult.classification?.classification || null,
      reason: attemptResult.classification?.reason || null,
    });

    const retryChildOutput = attemptResult.classification?.classification === 'harness/ai-child-output'
      && attemptResult.classification.retryable
      && attemptIndex < childOutputRetries;

    if (!retryChildOutput) break;

    console.log('');
    console.log(`HARNESS RETRY · AI child output was invalid/empty (attempt ${attemptIndex + 1}/${childOutputRetries + 1}).`);
    console.log('Retrying the full-game harness once; DSL behavior has not been evaluated yet.');
    console.log('');
  }

  if (!attemptResult?.tracePath || !attemptResult?.trace) {
    const classification = attemptResult?.classification || {
      classification: 'harness/missing-trace',
      reason: 'No AI full-game trace was produced.',
    };
    console.error(`INCONCLUSIVE · ${classification.classification} · ${classification.reason}`);
    results.push({
      run: index,
      passed: false,
      inconclusive: true,
      classification: classification.classification,
      reason: classification.reason,
      attempts,
    });
    allPassed = false;
    anyInconclusive = true;
    continue;
  }

  if (attemptResult.classification) {
    const { classification, reason } = attemptResult.classification;
    console.log('');
    console.log(`INCONCLUSIVE · ${classification}`);
    console.log(`  ${reason}`);
    console.log('  Learner-experience evaluator skipped because there is no valid completed interaction to score.');
    console.log(`Trace · ${attemptResult.tracePath}`);
    console.log('');

    results.push({
      run: index,
      passed: false,
      inconclusive: true,
      classification,
      reason,
      hardExitCode: attemptResult.runResult.code,
      tracePath: attemptResult.tracePath,
      attempts,
    });
    allPassed = false;
    anyInconclusive = true;
    continue;
  }

  let judged;
  try {
    judged = await evaluateTrace(attemptResult.tracePath, attemptResult.trace);
  } catch (error) {
    console.error(`AI evaluator error: ${error?.message || error}`);
    results.push({
      run: index,
      hardExitCode: attemptResult.runResult.code,
      tracePath: attemptResult.tracePath,
      attempts,
      error: String(error?.message || error),
    });
    allPassed = false;
    continue;
  }

  const hardPassed = attemptResult.runResult.code === 0
    && judged.trace?.status === 'passed'
    && !(judged.trace?.hardFailures || []).length;
  const evalPassed = judged.gate.ok;
  const passed = hardPassed && evalPassed;
  allPassed &&= passed;

  console.log('');
  console.log(`Hard checks · ${hardPassed ? 'PASS' : 'FAIL'}`);
  console.log(`AI eval · ${evalPassed ? 'PASS' : 'FAIL'} · overall ${judged.evaluation?.overall ?? 'n/a'}`);
  for (const [key, value] of Object.entries(judged.evaluation?.scores || {})) {
    console.log(`  ${key}: ${value}/5`);
  }
  if (judged.evaluation?.critical_issues?.length) {
    console.log(`  critical: ${judged.evaluation.critical_issues.join(', ')}`);
  }
  if (judged.gate.reasons.length) {
    for (const reason of judged.gate.reasons) console.log(`  gate: ${reason}`);
  }
  if (judged.evaluation?.summary) console.log(`  summary: ${judged.evaluation.summary}`);
  console.log(`Trace · ${attemptResult.tracePath}`);
  console.log(`Eval · ${judged.evalPath}`);
  console.log('');

  results.push({
    run: index,
    passed,
    inconclusive: false,
    hardPassed,
    hardExitCode: attemptResult.runResult.code,
    evalPassed,
    tracePath: attemptResult.tracePath,
    evalPath: judged.evalPath,
    overall: judged.evaluation?.overall ?? null,
    scores: judged.evaluation?.scores || null,
    criticalIssues: judged.evaluation?.critical_issues || [],
    attempts,
  });
}

const summaryPath = path.join(traceRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}__ai-eval-summary.json`);
await fs.writeFile(summaryPath, JSON.stringify({
  runs,
  minOverall,
  minDimension,
  childOutputRetries,
  passed: allPassed,
  inconclusive: anyInconclusive,
  results,
  createdAt: new Date().toISOString(),
}, null, 2), 'utf8');

if (allPassed) {
  console.log('PASS · AI behavior and learner-experience eval');
} else if (anyInconclusive) {
  console.log('INCONCLUSIVE · harness and/or infrastructure prevented a valid learner-experience evaluation');
} else {
  console.log('FAIL · AI behavior and/or learner-experience eval');
}
console.log(`Summary · ${summaryPath}`);
process.exitCode = allPassed ? 0 : (anyInconclusive ? 2 : 1);
