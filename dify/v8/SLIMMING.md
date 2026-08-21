# v8 semantic-preserving slimming plan

## Goal

Reduce latency and token usage without changing the learner-facing state machine or the authority boundary between the child, Jamie, and the rendered world.

Optimize **executed work and context size**, not the visual number of Dify nodes. Do not merge roles merely to make the graph look smaller.

Generated Dify DSL is a local/deployment artifact. The repo stores durable contracts, tests, observability rules, and implementation code only.

## Preconditions for every candidate

Before performance work, make the candidate identifiable and auditable:

1. Emit `debug.dsl_version` on every response; add a stable `build_id` when useful.
2. Validate structured model outputs for both JSON parseability and required schema shape.
3. Make downstream nodes consume the validated/sanitized result, not the raw model result.
4. Treat internal failures as technical errors. Never turn them into learner communication gaps or fallback language that asks the child to repeat because the pipeline failed.
5. Keep student evidence, current listener memory, render model, physical game state, and pedagogy/eval state distinct.

## Phase 1 — fix state and authority boundaries

These are correctness work, not optional optimizations.

### 1. Make listener memory genuinely resettable

`student_model` is a durable evidence record. `listener_model` is what the current Jamie knows.

A fresh-listener reset must clear Jamie's learned rules and keep them cleared on the next turn. Do not rebuild `listener_model` each turn by copying every historical student fact/instruction back into it.

### 2. Make corrections supersede contradictory rules

When the child specifically corrects an earlier instruction, update/deactivate the relevant listener rule. Do not retain both the old and corrected instruction as simultaneously active rules.

### 3. Build a compact actionable-world view for the planner

The Action Planner should not receive full render/game objects when those contain presentation or hidden data it is not authorized to use.

A planner view should contain only fields needed for legal action selection, for example:

```json
{
  "objects": [
    {"id":"card1","kind":"card","state":"face_down","owner":null,"row":1,"column":1}
  ],
  "turn": null,
  "counters": []
}
```

If an object is hidden, omit hidden identity such as `symbol` and `caption` entirely. Prompt instructions alone are not an adequate hidden-information boundary.

### 4. Treat visible status/state as semantic output

Harmless presentation inference can choose layout, art, symbols, and a small demo quantity. It cannot freely infer `status`, face-up/down state, ownership, readiness, action affordances, scoring, turn meaning, or win conditions.

Prefer deterministic status derived from grounded state over free-form World Builder status when possible.

## Phase 2 — low-risk structural pruning

### 5. Skip Gap Evaluator when there is no pending gap

When `gap_state.pending == null`, deterministic `outcome=none` is enough. Do not spend an LLM call proving that no old gap was repaired.

`post_action_gap` remains the Action Planner's responsibility for opening a **new** gap after an action.

When a pending gap does exist, resolution must compare the child's new contribution with that **specific pending gap**. `action_ready + some evidence` is not sufficient proof that the old gap was repaired.

### 6. Skip World Builder on pure runtime-action turns

Turns such as:

- `flip any two cards`;
- `turn those two face down again`;
- actions on already-rendered tokens/pieces;

normally do not need a new world-definition pass. Add a conservative deterministic `needs_world_update` gate. When uncertain, run the World Builder.

### 7. Skip Action Planner only when actionability is trivially impossible

Do not infer `no action` from the current message alone: a previously stored conditional instruction may become executable after a later state change.

## Phase 3 — context and output slimming

### 8. Keep raw transcript history out of reasoning prompts

Reasoning nodes should receive compact grounded facts/instructions plus the current child message. Keep raw transcript evidence separately for trace/debug if needed.

### 9. Keep inferred worlds small by default

When the child has not specified quantity, use the smallest representation sufficient to make the stated relationship visible/playable. Do not create large card/token sets merely because the renderer can.

This is a performance heuristic, not a test requirement. Explicit learner-supplied quantities win.

### 10. Cap completion budgets per role

Use measured role-specific caps. Never cap below known valid golden-path output sizes.

## Phase 4 — guards and response generation

### 11. Keep deterministic invariants always on

Always enforce:

- action targets exist;
- runtime action effects are not pre-applied in `world_patch`;
- a `clarify` resolution does not silently execute the deferred choice;
- planner output has the required typed shape;
- world gameplay state is student-grounded;
- child-defined rules outrank canonical game priors.

### 12. Make semantic guards conditional only after behavior is stable

World/response LLM guards can become risk-triggered once deterministic invariants and E2E behavior are stable. Do not delete the safety contract to save one model call.

If a response guard fails, preserve the already-valid Jamie draft when safe and record the technical error. Never replace it with learner-blaming fallback copy.

## Player choice contract

Keep three cases distinct:

- `any one` / `any two` — explicit delegation; Jamie should choose among equivalent eligible options and act;
- `one/two of them` without delegation — ordinary non-blocking underspecification; Jamie may choose or naturally clarify;
- a missing detail that changes legality, ownership, state transition, scoring, turn structure, or termination — blocking ambiguity.

Do not turn ordinary player agency into a teaching failure.

## Pedagogy accounting

Count progress at the learner-turn / episode level, not by the number of atomic animation actions. Two `reveal_object` actions in one spoken move are one learner-success event, not two practice successes.

## Acceptance before any further role merging

A candidate is not an improvement unless the same acceptance harness shows:

1. executable taught instructions still execute;
2. `any two` produces exactly two eligible reveals without unnecessary clarification;
3. action and `post_action_gap` can coexist;
4. the post-action gap is grounded, non-leading, and actually exposed to the learner;
5. a repair changes the same visible world state;
6. child-defined variants override familiar-game priors;
7. a fresh listener truly forgets prior rules;
8. corrections do not leave contradictory active rules behind;
9. hidden identity cannot affect player choice;
10. invalid model output cannot silently become normal pedagogy;
11. strict runtime identity confirms the intended DSL was actually tested;
12. latency/token metrics improve on the same scenario rather than on weakened acceptance.

Only after these pass repeatedly should Listener + World + Planner role merging be considered.
