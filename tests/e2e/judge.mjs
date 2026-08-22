#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RUBRIC_PATH = path.join(here, 'judge-rubric.md');
const SCORE_KEYS = [
  'naturalness',
  'listener_centeredness',
  'child_agency',
  'grounded_repair',
  'loop_coherence',
];

function flattenActionTypes(uiAction) {
  if (!uiAction || uiAction.type === 'none' || uiAction.type === 'lesson_complete') return [];
  if (uiAction.type === 'action_sequence') {
    return Array.isArray(uiAction.payload?.actions)
      ? uiAction.payload.actions.map(action => String(action?.type || '')).filter(Boolean)
      : [];
  }
  return [String(uiAction.type || '')].filter(Boolean);
}

function gapSummary(payload) {
  const gap = payload?.debug?.controller?.pending_gap
    || payload?.debug?.action_plan?.post_action_gap
    || payload?.debug?.action_plan?.blocked_now;
  if (!gap || typeof gap !== 'object') return null;
  return {
    context: String(gap.context || ''),
    missing_for_next_action: String(gap.missing_for_next_action || ''),
    reason: String(gap.reason || ''),
  };
}

export function compactTraceForJudge(trace) {
  return {
    scenario: trace?.scenario || null,
    description: trace?.description || null,
    turns: (trace?.turns || []).map(turn => ({
      index: turn?.index ?? null,
      student: turn?.query || '',
      jamie: turn?.payload?.reply || '',
      actions: flattenActionTypes(turn?.payload?.ui_action),
      internal_gap: gapSummary(turn?.payload),
      phase: turn?.payload?.phase || null,
      hard_assertions_failed: (turn?.assertions || [])
        .filter(item => item && item.ok === false)
        .map(item => item.name),
      soft_quality_signals: turn?.qualitySignals || [],
    })),
  };
}

export function parseJudgeJson(text) {
  const raw = String(text || '').trim();
  const candidates = [raw];
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidates.push(fenced[1].trim());
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1));

  let parsed = null;
  for (const candidate of [...new Set(candidates)]) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed = value;
        break;
      }
    } catch {
      // Try another candidate.
    }
  }
  if (!parsed) throw new Error('AI evaluator did not return valid JSON.');

  const scores = {};
  for (const key of SCORE_KEYS) {
    const value = Number(parsed?.scores?.[key]);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      throw new Error(`AI evaluator returned invalid score for ${key}: ${JSON.stringify(parsed?.scores?.[key])}`);
    }
    scores[key] = value;
  }
  const overall = SCORE_KEYS.reduce((sum, key) => sum + scores[key], 0) / SCORE_KEYS.length;

  return {
    status: 'ok',
    scores,
    overall: Number(overall.toFixed(2)),
    critical_failure: Boolean(parsed.critical_failure),
    critical_issues: Array.isArray(parsed.critical_issues) ? parsed.critical_issues.map(String) : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map(String) : [],
    summary: String(parsed.summary || ''),
  };
}

function evaluatorConfig(env = process.env) {
  const apiKey = String(env.AI_EVAL_API_KEY || '').trim();
  const baseUrl = String(env.AI_EVAL_BASE_URL || '').trim().replace(/\/$/, '');
  const model = String(env.AI_EVAL_MODEL || '').trim();
  if (!apiKey || !baseUrl || !model) {
    return {
      ready: false,
      reason: 'Set AI_EVAL_API_KEY, AI_EVAL_BASE_URL, and AI_EVAL_MODEL to enable --judge.',
    };
  }
  return { ready: true, apiKey, baseUrl, model };
}

export async function judgeTrace(trace, { fetchImpl = fetch, env = process.env } = {}) {
  const config = evaluatorConfig(env);
  if (!config.ready) return { status: 'skipped', reason: config.reason };

  const rubric = await fs.readFile(RUBRIC_PATH, 'utf8');
  const compact = compactTraceForJudge(trace);
  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      messages: [
        { role: 'system', content: rubric },
        { role: 'user', content: JSON.stringify(compact, null, 2) },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`AI evaluator ${response.status}: ${raw.slice(0, 600)}`);
  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content;
  const parsed = parseJudgeJson(content);
  return { ...parsed, model: config.model };
}

async function main() {
  const tracePath = process.argv[2];
  if (!tracePath) {
    console.error('Usage: node tests/e2e/judge.mjs <trace.json>');
    process.exit(2);
  }
  const trace = JSON.parse(await fs.readFile(tracePath, 'utf8'));
  const result = await judgeTrace(trace);
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error.stack || error.message || String(error));
    process.exit(2);
  });
}
