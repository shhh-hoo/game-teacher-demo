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

async function evaluateTrace(tracePath) {
  const trace = JSON.parse(await fs.readFile(tracePath, 'utf8'));
  const evaluation = await judgeTrace(trace);
  const gate = evalGate(evaluation);
  const output = {
    trace: tracePath,
    hard_status: trace.status || null,
    hard_failures: trace.hardFailures || [],
    completion: trace.completion || null,
    evaluation,
    gate,
    evaluated_at: new Date().toISOString(),
  };
  const evalPath = tracePath.replace(/\.json$/, '__eval.json');
  await fs.writeFile(evalPath, JSON.stringify(output, null, 2), 'utf8');
  return { trace, evaluation, gate, evalPath };
}

const results = [];
let allPassed = true;

console.log(`AI test + eval · runs=${runs}`);
console.log(`Eval gate · overall>=${minOverall}, every dimension>=${minDimension}, no critical failure`);
console.log('');

for (let index = 1; index <= runs; index += 1) {
  console.log(`=== AI run ${index}/${runs} ===`);
  const startedAt = Date.now();
  const runResult = await runFullGame();
  const tracePath = await newestTraceSince(startedAt);

  if (!tracePath) {
    console.error('No AI full-game trace was produced.');
    results.push({ run: index, hardExitCode: runResult.code, error: 'missing trace' });
    allPassed = false;
    continue;
  }

  let judged;
  try {
    judged = await evaluateTrace(tracePath);
  } catch (error) {
    console.error(`AI evaluator error: ${error?.message || error}`);
    results.push({ run: index, hardExitCode: runResult.code, tracePath, error: String(error?.message || error) });
    allPassed = false;
    continue;
  }

  const hardPassed = runResult.code === 0 && judged.trace?.status === 'passed' && !(judged.trace?.hardFailures || []).length;
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
  console.log(`Trace · ${tracePath}`);
  console.log(`Eval · ${judged.evalPath}`);
  console.log('');

  results.push({
    run: index,
    passed,
    hardPassed,
    hardExitCode: runResult.code,
    evalPassed,
    tracePath,
    evalPath: judged.evalPath,
    overall: judged.evaluation?.overall ?? null,
    scores: judged.evaluation?.scores || null,
    criticalIssues: judged.evaluation?.critical_issues || [],
  });
}

const summaryPath = path.join(traceRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}__ai-eval-summary.json`);
await fs.writeFile(summaryPath, JSON.stringify({
  runs,
  minOverall,
  minDimension,
  passed: allPassed,
  results,
  createdAt: new Date().toISOString(),
}, null, 2), 'utf8');

console.log(allPassed ? 'PASS · AI behavior and learner-experience eval' : 'FAIL · AI behavior and/or learner-experience eval');
console.log(`Summary · ${summaryPath}`);
process.exitCode = allPassed ? 0 : 1;
