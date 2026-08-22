export const RULE_IR_SCHEMA_VERSION = 'v10.1-shadow-1';

const RULE_STATUSES = new Set(['active', 'superseded', 'inactive']);
const COMPILE_STATUSES = new Set(['ok', 'partial', 'unsupported', 'error']);
const ACTION_SOURCES = new Set([
  'deterministic_runtime',
  'bounded_semantic_resolver',
  'legacy_planner',
  'none',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function pass(name, detail = '') {
  return { name, ok: true, detail };
}

function fail(name, detail) {
  return { name, ok: false, detail };
}

function valueAt(debug, ...keys) {
  for (const key of keys) {
    if (debug[key] !== undefined) return debug[key];
  }
  return null;
}

export function extractArchitectureTelemetry(payload) {
  const debug = isObject(payload?.debug) ? payload.debug : {};
  const ruleShadow = isObject(debug.rule_ir_shadow) ? debug.rule_ir_shadow : {};
  const runtimeShadow = isObject(debug.runtime_shadow) ? debug.runtime_shadow : {};

  return {
    rule_ir_schema_version: ruleShadow.schema_version || null,
    rule_compile_status: ruleShadow.status || 'not_reported',
    compiled_rule_delta: isObject(ruleShadow.delta) ? ruleShadow.delta : null,
    active_rule_count: Array.isArray(ruleShadow.rules)
      ? ruleShadow.rules.filter(rule => rule?.status === 'active').length
      : null,
    runtime_status: runtimeShadow.status || 'not_reported',
    runtime_action_candidate: runtimeShadow.action_candidate || null,
    action_source: valueAt(debug, 'action_source') || runtimeShadow.action_source || 'not_reported',
    runtime_gap: valueAt(debug, 'runtime_gap') || runtimeShadow.gap || null,
    fallback_reason: valueAt(debug, 'fallback_reason') || runtimeShadow.fallback_reason || null,
    gap_resolution_mode: valueAt(debug, 'gap_resolution_mode') || runtimeShadow.gap_resolution_mode || null,
  };
}

function validateEvidence(rule, studentTurns) {
  const results = [];
  const provenance = rule?.provenance;

  if (!isObject(provenance) || provenance.source !== 'student') {
    return [fail(
      'architecture.rule-ir-student-provenance',
      `Rule ${JSON.stringify(rule?.id || null)} must have provenance.source="student".`,
    )];
  }

  if (!Array.isArray(provenance.evidence) || provenance.evidence.length === 0) {
    return [fail(
      'architecture.rule-ir-evidence',
      `Rule ${JSON.stringify(rule?.id || null)} has no student evidence.`,
    )];
  }

  for (const evidence of provenance.evidence) {
    const turnIndex = Number(evidence?.turn_index);
    const quote = normalizeText(evidence?.quote);
    const turn = normalizeText(studentTurns[turnIndex - 1]);

    if (!Number.isInteger(turnIndex) || turnIndex < 1 || !quote) {
      results.push(fail(
        'architecture.rule-ir-evidence-shape',
        `Rule ${rule.id} has invalid evidence ${JSON.stringify(evidence)}.`,
      ));
      continue;
    }

    if (!turn) {
      results.push(fail(
        'architecture.rule-ir-evidence-turn',
        `Rule ${rule.id} cites unavailable student turn ${turnIndex}.`,
      ));
      continue;
    }

    if (!turn.includes(quote)) {
      results.push(fail(
        'architecture.rule-ir-evidence-quote',
        `Rule ${rule.id} cites text not found in student turn ${turnIndex}: ${JSON.stringify(evidence.quote)}.`,
      ));
    }
  }

  return results;
}

function validateDelta(shadow, rulesById) {
  const results = [];
  const delta = shadow.delta;
  if (!isObject(delta)) {
    return [fail('architecture.rule-ir-delta', 'rule_ir_shadow.delta must be an object.')];
  }

  for (const field of ['added_rule_ids', 'superseded_rule_ids', 'deactivated_rule_ids']) {
    if (!Array.isArray(delta[field])) {
      results.push(fail('architecture.rule-ir-delta-shape', `rule_ir_shadow.delta.${field} must be an array.`));
      continue;
    }

    for (const id of delta[field]) {
      if (!rulesById.has(String(id))) {
        results.push(fail(
          'architecture.rule-ir-delta-reference',
          `rule_ir_shadow.delta.${field} references missing rule ${JSON.stringify(id)}.`,
        ));
      }
    }
  }

  for (const id of delta.superseded_rule_ids || []) {
    if (rulesById.get(String(id))?.status !== 'superseded') {
      results.push(fail(
        'architecture.rule-ir-superseded-status',
        `Superseded rule ${JSON.stringify(id)} must have status="superseded".`,
      ));
    }
  }

  for (const id of delta.deactivated_rule_ids || []) {
    if (rulesById.get(String(id))?.status !== 'inactive') {
      results.push(fail(
        'architecture.rule-ir-deactivated-status',
        `Deactivated rule ${JSON.stringify(id)} must have status="inactive".`,
      ));
    }
  }

  return results;
}

export function validateRuleIrShadow(shadow, studentTurns = []) {
  const results = [];

  if (!isObject(shadow)) {
    return [fail('architecture.rule-ir-shadow-present', 'debug.rule_ir_shadow is missing.')];
  }

  results.push(shadow.schema_version === RULE_IR_SCHEMA_VERSION
    ? pass('architecture.rule-ir-schema', shadow.schema_version)
    : fail(
      'architecture.rule-ir-schema',
      `Expected ${RULE_IR_SCHEMA_VERSION}; got ${JSON.stringify(shadow.schema_version || null)}.`,
    ));

  results.push(COMPILE_STATUSES.has(shadow.status)
    ? pass('architecture.rule-ir-compile-status', shadow.status)
    : fail('architecture.rule-ir-compile-status', `Unknown compile status ${JSON.stringify(shadow.status)}.`));

  if (!Array.isArray(shadow.rules)) {
    results.push(fail('architecture.rule-ir-rules', 'rule_ir_shadow.rules must be an array.'));
    return results;
  }

  const rulesById = new Map();
  for (const rule of shadow.rules) {
    const id = String(rule?.id || '').trim();
    if (!id) {
      results.push(fail('architecture.rule-ir-rule-id', 'Every rule must have a non-empty id.'));
      continue;
    }
    if (rulesById.has(id)) {
      results.push(fail('architecture.rule-ir-rule-id-unique', `Duplicate rule id ${JSON.stringify(id)}.`));
      continue;
    }
    rulesById.set(id, rule);

    if (!RULE_STATUSES.has(rule.status)) {
      results.push(fail('architecture.rule-ir-rule-status', `Rule ${id} has invalid status ${JSON.stringify(rule.status)}.`));
    }
    if (!isObject(rule.when) || Object.keys(rule.when).length === 0) {
      results.push(fail('architecture.rule-ir-rule-trigger', `Rule ${id} must have a non-empty when object.`));
    }
    if (!Array.isArray(rule.effects) || rule.effects.length === 0 || rule.effects.some(effect => !isObject(effect) || !effect.type)) {
      results.push(fail('architecture.rule-ir-rule-effects', `Rule ${id} must have typed effects.`));
    }
    results.push(...validateEvidence(rule, studentTurns));
  }

  results.push(...validateDelta(shadow, rulesById));

  const added = new Set((shadow.delta?.added_rule_ids || []).map(String));
  const supersededNow = new Set((shadow.delta?.superseded_rule_ids || []).map(String));
  const replacementRefs = new Set();
  for (const rule of shadow.rules) {
    for (const oldId of rule?.supersedes || []) {
      replacementRefs.add(String(oldId));
      const oldRule = rulesById.get(String(oldId));
      if (!oldRule) {
        results.push(fail('architecture.rule-ir-supersedes-reference', `Rule ${rule.id} supersedes missing rule ${JSON.stringify(oldId)}.`));
      } else if (oldRule.status !== 'superseded') {
        results.push(fail('architecture.rule-ir-supersedes-status', `Rule ${oldId} must be marked superseded by replacement ${rule.id}.`));
      }
      if (supersededNow.has(String(oldId)) && !added.has(String(rule.id))) {
        results.push(fail('architecture.rule-ir-correction-delta', `Replacement rule ${rule.id} must appear in added_rule_ids.`));
      }
    }
  }
  for (const oldId of supersededNow) {
    if (!replacementRefs.has(oldId)) {
      results.push(fail('architecture.rule-ir-correction-replacement', `Superseded rule ${oldId} has no replacement rule reference.`));
    }
  }

  if (shadow.status === 'error' && !Array.isArray(shadow.errors)) {
    results.push(fail('architecture.rule-ir-errors', 'Compile status "error" must include an errors array.'));
  }

  if (!results.some(result => !result.ok)) {
    results.push(pass('architecture.rule-ir-shadow-contract', `${shadow.rules.length} rule(s)`));
  }
  return results;
}

export function validateArchitectureTelemetry(payload, studentTurns = []) {
  const debug = isObject(payload?.debug) ? payload.debug : {};
  const results = validateRuleIrShadow(debug.rule_ir_shadow, studentTurns);
  const telemetry = extractArchitectureTelemetry(payload);

  if (debug.rule_ir_shadow?.status === 'error') {
    results.push(fail(
      'architecture.rule-ir-compile-error',
      `Rule IR shadow compiler failed: ${JSON.stringify(debug.rule_ir_shadow.errors || [])}.`,
    ));
  }

  if (telemetry.action_source !== 'not_reported' && !ACTION_SOURCES.has(telemetry.action_source)) {
    results.push(fail(
      'architecture.action-source',
      `Unknown action source ${JSON.stringify(telemetry.action_source)}.`,
    ));
  }

  return results;
}
