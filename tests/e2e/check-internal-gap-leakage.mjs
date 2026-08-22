#!/usr/bin/env node

import fs from 'node:fs/promises';
import process from 'node:process';

const CANDIDATE_PATTERNS = [
  /\be\.g\./i,
  /\bfor example\b/i,
  /\bsuch as\b/i,
  /\b(?:keep|take|collect|remove) (?:them|the cards?|the pair)\b/i,
  /\b(?:flip|turn) (?:them|the cards?) back\b/i,
  /\bstay face up\b/i,
  /\b(?:get|score|earn) (?:a |one )?(?:point|points)\b/i,
  /\b(?:another|extra) turn\b/i,
  /\b(?:win|winner)\b/i,
];

function gapText(gap) {
  if (!gap || typeof gap !== 'object') return '';
  return [gap.context, gap.missing_for_next_action, gap.reason]
    .filter(Boolean)
    .map(String)
    .join(' ');
}

export function findInternalGapLeakage(payload) {
  const gaps = [
    payload?.debug?.action_plan?.post_action_gap,
    payload?.debug?.action_plan?.blocked_now,
    payload?.debug?.controller?.pending_gap,
  ].filter(Boolean);

  const failures = [];
  for (const gap of gaps) {
    const text = gapText(gap);
    const matched = CANDIDATE_PATTERNS.filter(pattern => pattern.test(text)).map(pattern => pattern.source);
    if (matched.length) failures.push({ text, matched });
  }
  return failures;
}

async function main() {
  const tracePath = process.argv[2];
  if (!tracePath) {
    console.error('Usage: node tests/e2e/check-internal-gap-leakage.mjs <trace.json>');
    process.exit(2);
  }

  const trace = JSON.parse(await fs.readFile(tracePath, 'utf8'));
  let failed = false;
  for (const turn of trace.turns || []) {
    const failures = findInternalGapLeakage(turn?.payload);
    for (const failure of failures) {
      failed = true;
      console.error(`turn ${turn.index}: internal gap proposes candidate gameplay: ${failure.text}`);
    }
  }

  if (failed) process.exit(1);
  console.log('internal-gap leakage: PASS');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error.stack || error.message || String(error));
    process.exit(2);
  });
}
