import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractArchitectureTelemetry,
  RULE_IR_SCHEMA_VERSION,
  validateArchitectureTelemetry,
  validateRuleIrShadow,
} from './architecture-telemetry.mjs';

function validShadow() {
  return {
    schema_version: RULE_IR_SCHEMA_VERSION,
    status: 'ok',
    rules: [
      {
        id: 'water_seed',
        status: 'active',
        when: { event: 'water_flower', state: 'seed' },
        condition: null,
        effects: [{ type: 'update_object', state: 'sprout' }],
        provenance: {
          source: 'student',
          evidence: [{ turn_index: 1, quote: 'If a flower is a seed, it turns into a sprout.' }],
        },
        supersedes: [],
      },
    ],
    delta: {
      added_rule_ids: ['water_seed'],
      superseded_rule_ids: [],
      deactivated_rule_ids: [],
    },
    errors: [],
  };
}

test('accepts a student-grounded executable-rule shadow', () => {
  const results = validateRuleIrShadow(validShadow(), [
    'If a flower is a seed, it turns into a sprout.',
  ]);
  assert.deepEqual(results.filter(result => !result.ok), []);
});

test('rejects provenance that is not present in the cited student turn', () => {
  const shadow = validShadow();
  shadow.rules[0].provenance.evidence[0].quote = 'Seeds become blooms immediately.';
  const failures = validateRuleIrShadow(shadow, [
    'If a flower is a seed, it turns into a sprout.',
  ]).filter(result => !result.ok);
  assert.ok(failures.some(result => result.name === 'architecture.rule-ir-evidence-quote'));
});

test('requires corrections to supersede the old rule explicitly', () => {
  const shadow = validShadow();
  shadow.rules[0].status = 'superseded';
  shadow.rules.push({
    id: 'water_seed_corrected',
    status: 'active',
    when: { event: 'water_flower', state: 'seed' },
    effects: [{ type: 'update_object', state: 'leaf' }],
    provenance: {
      source: 'student',
      evidence: [{ turn_index: 2, quote: 'Sorry, seeds turn into leaves.' }],
    },
    supersedes: ['water_seed'],
  });
  shadow.delta = {
    added_rule_ids: ['water_seed_corrected'],
    superseded_rule_ids: ['water_seed'],
    deactivated_rule_ids: [],
  };

  const results = validateRuleIrShadow(shadow, [
    'If a flower is a seed, it turns into a sprout.',
    'Sorry, seeds turn into leaves.',
  ]);
  assert.deepEqual(results.filter(result => !result.ok), []);

  shadow.delta = {
    added_rule_ids: [],
    superseded_rule_ids: [],
    deactivated_rule_ids: [],
  };
  assert.deepEqual(validateRuleIrShadow(shadow, [
    'If a flower is a seed, it turns into a sprout.',
    'Sorry, seeds turn into leaves.',
    'Now water the next flower.',
  ]).filter(result => !result.ok), []);
});

test('extracts a stable architecture snapshot without requiring runtime shadow yet', () => {
  const payload = {
    debug: {
      rule_ir_shadow: validShadow(),
      action_source: 'legacy_planner',
    },
  };
  assert.deepEqual(extractArchitectureTelemetry(payload), {
    rule_ir_schema_version: RULE_IR_SCHEMA_VERSION,
    rule_compile_status: 'ok',
    compiled_rule_delta: payload.debug.rule_ir_shadow.delta,
    active_rule_count: 1,
    runtime_status: 'not_reported',
    runtime_action_candidate: null,
    action_source: 'legacy_planner',
    runtime_gap: null,
    fallback_reason: null,
    gap_resolution_mode: null,
  });
  assert.deepEqual(validateArchitectureTelemetry(payload, [
    'If a flower is a seed, it turns into a sprout.',
  ]).filter(result => !result.ok), []);
});

test('treats a shadow compiler error as architecture failure, not learner pipeline failure', () => {
  const shadow = validShadow();
  shadow.status = 'error';
  shadow.errors = ['compiler output was not valid JSON'];
  const payload = { debug: { rule_ir_shadow: shadow, pipeline_errors: [] } };
  const failures = validateArchitectureTelemetry(payload, [
    'If a flower is a seed, it turns into a sprout.',
  ]).filter(result => !result.ok);
  assert.ok(failures.some(result => result.name === 'architecture.rule-ir-compile-error'));
  assert.deepEqual(payload.debug.pipeline_errors, []);
});
