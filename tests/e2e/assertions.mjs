export const ALLOWED_ACTION_TYPES = new Set([
  'update_object',
  'reveal_object',
  'hide_object',
  'remove_object',
  'set_turn',
  'set_counter',
  'set_status',
  'wait',
  'reset_to_baseline',
]);

const GAMEPLAY_LEAK_PATTERNS = [
  /\bflip\b/i,
  /\bturn (?:the )?(?:cards?|them) over\b/i,
  /\bfind (?:the )?pairs?\b/i,
  /\btry to find\b/i,
  /\bkeep (?:the )?(?:matching )?(?:cards?|pairs?)\b/i,
  /\bmost pairs? wins?\b/i,
  /\bwho wins?\b/i,
];

const CANDIDATE_RULE_PATTERNS = [
  /\b(?:keep|take|collect|remove) (?:them|the cards?|the pair)\b/i,
  /\b(?:flip|turn) (?:them|the cards?) back\b/i,
  /\b(?:get|score|earn) (?:a |one )?(?:point|points)\b/i,
  /\b(?:go|play|take) again\b/i,
  /\b(?:another|extra) turn\b/i,
  /\b(?:win|winner)\b/i,
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function blankWorld() {
  return {
    name: 'Your game',
    surface: { type: 'table', rows: 0, columns: 0 },
    objects: [],
    counters: [],
    turn: null,
    status: '',
    ready: false,
  };
}

function objectMap(world) {
  return new Map((world.objects || []).map(object => [String(object.id), object]));
}

export function flattenActions(uiAction) {
  if (!uiAction || uiAction.type === 'none') return [];
  if (uiAction.type === 'action_sequence') {
    return Array.isArray(uiAction.payload?.actions) ? uiAction.payload.actions : [];
  }
  if (uiAction.type === 'reset_to_baseline') return [{ type: 'reset_to_baseline' }];
  if (uiAction.type === 'lesson_complete') return [];
  return [{ type: uiAction.type, ...(uiAction.payload || {}) }];
}

export function applyWorldPatch(world, patch) {
  const next = clone(world || blankWorld());
  if (!patch || typeof patch !== 'object') return next;
  if (patch.replace && typeof patch.replace === 'object') return clone(patch.replace);

  for (const key of ['name', 'status', 'ready', 'turn']) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = clone(patch[key]);
  }
  if (patch.surface && typeof patch.surface === 'object') {
    next.surface = { ...(next.surface || {}), ...clone(patch.surface) };
  }

  const objects = objectMap(next);
  for (const id of patch.remove_object_ids || []) objects.delete(String(id));
  for (const object of patch.add_objects || []) {
    if (object?.id != null) objects.set(String(object.id), clone(object));
  }
  for (const delta of patch.update_objects || []) {
    if (delta?.id == null) continue;
    const id = String(delta.id);
    if (!objects.has(id)) continue;
    objects.set(id, { ...objects.get(id), ...clone(delta) });
  }
  next.objects = [...objects.values()];
  if (Array.isArray(patch.counters)) next.counters = clone(patch.counters);
  return next;
}

export function applyActions(world, actions, baseline = null) {
  let next = clone(world);
  for (const action of actions) {
    const objects = objectMap(next);
    const id = action.object_id == null ? null : String(action.object_id);
    switch (action.type) {
      case 'reveal_object':
        if (objects.has(id)) objects.get(id).state = 'face_up';
        break;
      case 'hide_object':
        if (objects.has(id)) objects.get(id).state = 'face_down';
        break;
      case 'remove_object':
        if (objects.has(id)) objects.get(id).state = 'removed';
        break;
      case 'update_object':
        if (objects.has(id)) objects.set(id, { ...objects.get(id), ...(action.patch || {}) });
        break;
      case 'set_turn':
        next.turn = action.to ?? null;
        break;
      case 'set_counter': {
        const counters = new Map((next.counters || []).map(counter => [String(counter.id), counter]));
        counters.set(String(action.counter_id), {
          id: String(action.counter_id),
          label: action.label || String(action.counter_id),
          value: action.value ?? 0,
        });
        next.counters = [...counters.values()];
        break;
      }
      case 'set_status':
        next.status = String(action.text || '');
        break;
      case 'reset_to_baseline':
        if (baseline) {
          next = clone(baseline);
          continue;
        }
        break;
      case 'wait':
        break;
      default:
        break;
    }
    next.objects = [...objects.values()];
  }
  return next;
}

function pass(name, detail = '') {
  return { name, ok: true, detail };
}

function fail(name, detail) {
  return { name, ok: false, detail };
}

function assertProtocol(payload, actions, worldAfterPatch) {
  const results = [];
  if (!payload || typeof payload !== 'object') {
    return [fail('protocol.payload-object', 'Parsed answer is not an object.')];
  }
  for (const key of ['reply', 'phase', 'world_patch', 'ui_action', 'capture_baseline']) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      results.push(fail(`protocol.${key}`, `Missing top-level field: ${key}`));
    }
  }
  for (const action of actions) {
    if (!ALLOWED_ACTION_TYPES.has(action.type)) {
      results.push(fail('protocol.allowed-action-type', `Unsupported/legacy action type: ${action.type}`));
    }
  }
  for (const action of actions) {
    if (['reveal_object', 'hide_object', 'remove_object', 'update_object'].includes(action.type)) {
      const exists = (worldAfterPatch.objects || []).some(object => String(object.id) === String(action.object_id));
      if (!exists) results.push(fail('protocol.action-target-exists', `${action.type} targets missing object ${action.object_id}`));
    }
  }
  if (!results.length) results.push(pass('protocol.core'));
  return results;
}

function assertTrueDelta(previousWorld, patch) {
  const results = [];
  const previousObjects = objectMap(previousWorld);
  for (const delta of patch?.update_objects || []) {
    const previous = previousObjects.get(String(delta.id));
    if (!previous) continue;
    for (const [key, value] of Object.entries(delta)) {
      if (key === 'id') continue;
      if (JSON.stringify(previous[key]) === JSON.stringify(value)) {
        results.push(fail('turn.true-delta', `update_objects.${delta.id}.${key} restates an unchanged value.`));
      }
    }
  }
  if (patch?.surface && previousWorld?.surface) {
    for (const [key, value] of Object.entries(patch.surface)) {
      if (JSON.stringify(previousWorld.surface[key]) === JSON.stringify(value)) {
        results.push(fail('turn.true-delta', `surface.${key} restates an unchanged value.`));
      }
    }
  }
  return results.length ? results : [pass('turn.true-delta')];
}

function assertNoRuntimeActionEffectsInPatch(patch, actions) {
  const failures = [];
  const updates = new Map((patch?.update_objects || []).map(item => [String(item.id), item]));
  const removed = new Set((patch?.remove_object_ids || []).map(String));

  for (const action of actions) {
    const id = String(action.object_id || '');
    const delta = updates.get(id) || {};
    if (action.type === 'reveal_object' && delta.state === 'face_up') {
      failures.push(fail('turn.world-action-separation', `${id} is face_up in world_patch before reveal_object executes.`));
    }
    if (action.type === 'hide_object' && delta.state === 'face_down') {
      failures.push(fail('turn.world-action-separation', `${id} is face_down in world_patch before hide_object executes.`));
    }
    if (action.type === 'remove_object' && removed.has(id)) {
      failures.push(fail('turn.world-action-separation', `${id} is removed in world_patch before remove_object executes.`));
    }
    if (action.type === 'update_object') {
      for (const [key, value] of Object.entries(action.patch || {})) {
        if (JSON.stringify(delta[key]) === JSON.stringify(value)) {
          failures.push(fail('turn.world-action-separation', `${id}.${key} is pre-applied in world_patch and repeated by update_object.`));
        }
      }
    }
  }
  return failures.length ? failures : [pass('turn.world-action-separation')];
}

function looksLikeChoiceClarification(reply, expectedCount) {
  const lower = String(reply || '').toLowerCase();
  if (!/[?]|\bwhich\b|\bwhat\b|\bchoose\b|\bpick\b/.test(lower)) return false;
  if (expectedCount === 1) {
    return /\bwhich (?:one|card)\b/.test(lower)
      || /\bwhat card\b/.test(lower)
      || /\bwhich one should i\b/.test(lower)
      || (/\bone card\b/.test(lower) && /[?]/.test(lower));
  }
  if (expectedCount === 2) {
    return /\bwhich two\b/.test(lower)
      || /\bwhat two\b/.test(lower)
      || (/\btwo cards?\b/.test(lower) && /[?]/.test(lower));
  }
  return lower.includes(String(expectedCount)) && /[?]/.test(lower);
}

function assertActionOrClarifyCount(reply, actions, expectedCount, patch) {
  const reveals = actions.filter(action => action.type === 'reveal_object');
  const otherActions = actions.filter(action => action.type !== 'reveal_object' && action.type !== 'wait');

  if (reveals.length === expectedCount && otherActions.length === 0) {
    return pass('turn.action-or-clarify-count', `executed ${expectedCount} reveal_object action(s)`);
  }

  if (actions.length === 0 && looksLikeChoiceClarification(reply, expectedCount)) {
    const runtimeStateUpdates = (patch?.update_objects || []).filter(update =>
      update?.state === 'face_up' || update?.state === 'removed'
    );
    if (runtimeStateUpdates.length || (patch?.remove_object_ids || []).length) {
      return fail(
        'turn.action-or-clarify-count',
        `Jamie asked for a choice clarification but world_patch already applied a runtime choice/effect: ${JSON.stringify(runtimeStateUpdates.length ? runtimeStateUpdates : patch.remove_object_ids)}`,
      );
    }
    return pass('turn.action-or-clarify-count', `clarified an underspecified choice for ${expectedCount} card(s) without pre-applying the choice`);
  }

  return fail(
    'turn.action-or-clarify-count',
    `Expected either ${expectedCount} reveal_object action(s) or a natural clarification preserving count=${expectedCount}; got actions=${JSON.stringify(actions.map(action => action.type))}, reply=${JSON.stringify(reply)}`,
  );
}

function normalizedActionTypes(actions) {
  return actions.filter(action => action.type !== 'wait').map(action => action.type);
}

export function runAssertions({ expected = {}, payload, previousWorld, worldAfterPatch, actions }) {
  const results = [...assertProtocol(payload, actions, worldAfterPatch)];
  const reply = String(payload?.reply || '');

  if (expected.noGameplayLeakage) {
    const leaked = GAMEPLAY_LEAK_PATTERNS.filter(pattern => pattern.test(reply)).map(pattern => pattern.source);
    results.push(leaked.length
      ? fail('turn.no-gameplay-leakage', `Reply appears to propose unstated gameplay: ${reply}`)
      : pass('turn.no-gameplay-leakage'));
  }

  if (expected.noCandidateRuleLeakage) {
    const leaked = CANDIDATE_RULE_PATTERNS.filter(pattern => pattern.test(reply)).map(pattern => pattern.source);
    results.push(leaked.length
      ? fail('turn.no-candidate-rule-leakage', `Clarification appears to supply a candidate gameplay rule: ${reply}`)
      : pass('turn.no-candidate-rule-leakage'));
  }

  if (Array.isArray(expected.actionTypes)) {
    const actual = actions.map(action => action.type);
    results.push(JSON.stringify(actual) === JSON.stringify(expected.actionTypes)
      ? pass('turn.action-types', actual.join(', ') || 'none')
      : fail('turn.action-types', `Expected ${JSON.stringify(expected.actionTypes)}; got ${JSON.stringify(actual)}`));
  }

  if (Array.isArray(expected.actionTypesOneOf)) {
    const actual = normalizedActionTypes(actions);
    const options = expected.actionTypesOneOf.filter(Array.isArray);
    const matched = options.some(option => JSON.stringify(option) === JSON.stringify(actual));
    results.push(matched
      ? pass('turn.action-types-one-of', actual.join(', ') || 'none')
      : fail('turn.action-types-one-of', `Expected one of ${JSON.stringify(options)}; got ${JSON.stringify(actual)}`));
  }

  if (Number.isFinite(expected.actionOrClarifyCount)) {
    results.push(assertActionOrClarifyCount(reply, actions, expected.actionOrClarifyCount, payload?.world_patch || {}));
  }

  if (typeof expected.captureBaseline === 'boolean') {
    results.push(Boolean(payload?.capture_baseline) === expected.captureBaseline
      ? pass('turn.capture-baseline', String(expected.captureBaseline))
      : fail('turn.capture-baseline', `Expected ${expected.captureBaseline}; got ${Boolean(payload?.capture_baseline)}`));
  }

  if (typeof expected.phase === 'string') {
    results.push(payload?.phase === expected.phase
      ? pass('turn.phase', expected.phase)
      : fail('turn.phase', `Expected phase=${expected.phase}; got ${JSON.stringify(payload?.phase)}`));
  }

  if (typeof expected.supportType === 'string') {
    const actual = payload?.support?.type ?? null;
    results.push(actual === expected.supportType
      ? pass('turn.support-type', expected.supportType)
      : fail('turn.support-type', `Expected support.type=${expected.supportType}; got ${JSON.stringify(actual)}`));
  }

  if (typeof expected.supportFocus === 'string') {
    const actual = payload?.support?.focus ?? null;
    results.push(actual === expected.supportFocus
      ? pass('turn.support-focus', expected.supportFocus)
      : fail('turn.support-focus', `Expected support.focus=${expected.supportFocus}; got ${JSON.stringify(actual)}`));
  }

  if (expected.supportListenerGapNonEmpty) {
    const gap = String(payload?.support?.listener_gap || '').trim();
    results.push(gap
      ? pass('turn.support-listener-gap', gap)
      : fail('turn.support-listener-gap', 'Expected a non-empty support.listener_gap grounded in Jamie\'s current blockage.'));
  }

  if (Number.isFinite(expected.minObjects)) {
    const count = worldAfterPatch.objects?.length || 0;
    results.push(count >= expected.minObjects
      ? pass('turn.min-objects', String(count))
      : fail('turn.min-objects', `Expected at least ${expected.minObjects} objects; got ${count}`));
  }

  if (Number.isFinite(expected.exactObjectCount)) {
    const count = worldAfterPatch.objects?.length || 0;
    results.push(count === expected.exactObjectCount
      ? pass('turn.exact-object-count', String(count))
      : fail('turn.exact-object-count', `Expected exactly ${expected.exactObjectCount} objects from learner-supplied setup; got ${count}`));
  }

  if (Number.isFinite(expected.minObjectUpdates)) {
    const count = payload?.world_patch?.update_objects?.length || 0;
    results.push(count >= expected.minObjectUpdates
      ? pass('turn.min-object-updates', String(count))
      : fail('turn.min-object-updates', `Expected at least ${expected.minObjectUpdates} object updates; got ${count}`));
  }

  if (expected.trueDelta) results.push(...assertTrueDelta(previousWorld, payload?.world_patch || {}));
  if (expected.noRuntimeActionEffectsInPatch) results.push(...assertNoRuntimeActionEffectsInPatch(payload?.world_patch || {}, actions));

  if (expected.actionTargetsExist) {
    const ids = new Set((worldAfterPatch.objects || []).map(object => String(object.id)));
    const bad = actions.filter(action => ['reveal_object', 'hide_object', 'remove_object', 'update_object'].includes(action.type) && !ids.has(String(action.object_id)));
    results.push(bad.length
      ? fail('turn.action-targets-exist', bad.map(action => `${action.type}:${action.object_id}`).join(', '))
      : pass('turn.action-targets-exist'));
  }

  if (Array.isArray(expected.allObjectUpdatesOnly)) {
    const allowed = new Set(['id', ...expected.allObjectUpdatesOnly]);
    const bad = [];
    for (const update of payload?.world_patch?.update_objects || []) {
      const extras = Object.keys(update).filter(key => !allowed.has(key));
      if (extras.length) bad.push(`${update.id}: ${extras.join(', ')}`);
    }
    results.push(bad.length
      ? fail('turn.object-update-fields', `Unexpected update fields: ${bad.join('; ')}`)
      : pass('turn.object-update-fields'));
  }

  if (expected.allUpdatedStates) {
    const updates = payload?.world_patch?.update_objects || [];
    const bad = updates.filter(update => update.state !== expected.allUpdatedStates);
    results.push(updates.length > 0 && bad.length === 0
      ? pass('turn.updated-states', expected.allUpdatedStates)
      : fail('turn.updated-states', `Expected all object state updates to be ${expected.allUpdatedStates}.`));
  }

  if (Array.isArray(expected.replyMustContainAny)) {
    const lower = reply.toLowerCase();
    const matched = expected.replyMustContainAny.find(text => lower.includes(String(text).toLowerCase()));
    results.push(matched
      ? pass('turn.reply-required-any', String(matched))
      : fail('turn.reply-required-any', `Reply must naturally expose the listener gap using at least one of: ${expected.replyMustContainAny.join(', ')}. Got: ${JSON.stringify(reply)}`));
  }

  if (Array.isArray(expected.replyMustNotContain)) {
    const lower = reply.toLowerCase();
    const bad = expected.replyMustNotContain.filter(text => lower.includes(String(text).toLowerCase()));
    results.push(bad.length
      ? fail('turn.reply-forbidden-text', `Reply contains forbidden text: ${bad.join(', ')}`)
      : pass('turn.reply-forbidden-text'));
  }

  return results;
}
