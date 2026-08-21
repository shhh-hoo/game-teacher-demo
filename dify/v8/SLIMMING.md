# v8 semantic-preserving slimming plan

## Goal

Reduce latency and token usage without changing the learner-facing state machine or the authority boundary between the child, Jamie, and the rendered world.

`v8-revised` contains 21 graph nodes and 10 LLM nodes. A normal learner turn currently executes roughly seven serial LLM calls:

`Listener Interpreter -> World Builder -> World Leakage Guard -> Action Planner -> Gap Evaluator -> one response generator -> Response Leakage Guard`

The optimization target is **executed LLM work**, not the visual number of nodes in the Dify graph. The response branch contains several LLM nodes, but only one response generator runs per turn, so merging those nodes would mostly make the graph look smaller without materially improving latency.

## Phase 1 — low-risk structural pruning

### 1. Skip Gap Evaluator when there is no previous pending gap

This is behaviorally exact. The Gap Evaluator prompt already requires `outcome=none` when no previous pending gap exists.

Add a cheap deterministic gate before Gap Evaluator:

- `gap_state.pending != null` -> run Gap Evaluator;
- otherwise -> go directly to Pedagogy Controller, whose parser already defaults missing gap evaluation to `{ "outcome": "none" }`.

Do **not** remove `post_action_gap` from Action Planner. The Controller must still be able to open a new pending gap after Jamie acts.

### 2. Skip World Builder + World Guard on turns that cannot change world definition

The world pass is unnecessary for many runtime-action turns such as:

- `flip any two cards`;
- `turn those two cards face down again`;
- ordinary turn/counter/status actions that act on already-rendered objects.

Extend the deterministic grounding step with a conservative `needs_world_update` flag. Run the world path only when the current grounded contribution can change world definition, for example:

- new entities / relations / board structure;
- explicit setup or persistent state changes;
- a specific correction to the rendered world.

If the turn contains only runtime instructions on existing objects, go directly to Action Planner with an empty current-turn world patch.

The gate must be conservative: when uncertain, run the world path.

### 3. Skip Action Planner only in the trivially impossible case

A safe initial rule is:

- if the grounded listener model contains no instructions at all and the current turn adds no instructions, there is nothing that can justify a runtime action;
- otherwise keep Action Planner.

Do not broadly infer `no action` from the current message alone because an earlier stored conditional instruction may become executable after a later world change.

## Phase 1 — context slimming

### 4. Stop feeding raw 20-turn message history through `student_model_json`

`Ground Student + Listener Model` currently stores the last 20 raw student messages inside the same model that is repeatedly injected into Interpreter, World Builder, World Guard, Action Planner and other prompts.

Facts and instructions already retain grounded semantic content, evidence and turn numbers. Keep raw transcript evidence separately if needed for evaluation/debugging, but pass a compact grounded model to reasoning nodes:

```json
{
  "facts": [],
  "instructions": [],
  "turn_count": 0
}
```

The current user query remains available independently, so this does not remove current-turn language.

### 5. Give Action Planner one compact actionable-world view

Action Planner currently receives both `render_model_json` and `game_state_json`, which duplicates object data and can expose presentation/hidden fields that should not drive player choice.

Build a deterministic compact planner view containing only action-relevant / authorized fields, for example:

```json
{
  "objects": [
    {"id":"card1","kind":"card","state":"face_down","owner":null,"row":1,"column":1}
  ],
  "turn": null,
  "counters": []
}
```

For hidden objects, omit hidden `symbol` / `caption` information. This both reduces tokens and strengthens the existing rule that Jamie must not use hidden identity to choose a face-down card.

### 6. Cap output budgets per role

All v8-revised LLM nodes currently specify temperature but no explicit completion cap. Add conservative role-specific caps after measuring real outputs. Suggested starting ranges, not hard requirements:

- Listener Interpreter: 512–768 tokens;
- World Builder / World Guard: 1024–1536 when object creation is possible;
- Action Planner: 1024–1536;
- Gap Evaluator: 384–512;
- Jamie/repair/scaffold/reflection text: 128–256;
- Response Guard: 384–512.

Do not cap a node below the observed valid output size for the six-card golden path.

## Phase 2 — conditional guards

After Phase 1 passes E2E repeatedly, reduce unconditional validation calls rather than deleting safety semantics.

### 7. Make World Leakage Guard risk-triggered

Keep deterministic patch invariants in code at all times. Run the semantic LLM guard only for a patch with meaningful leakage risk, such as:

- changing existing gameplay state without direct student provenance;
- enabling interaction / turn / score / ready semantics;
- adding status/caption text that contains gameplay claims;
- correction paths where authority is ambiguous.

Presentation-only object creation can use a cheaper deterministic validation path.

When uncertain, run the semantic guard.

### 8. Make Response Leakage Guard risk-triggered

Do not remove the leakage contract. First add deterministic risk detection and run the semantic guard when the draft:

- asks a game-specific question;
- proposes an action/outcome/goal;
- occurs during a gap, scaffold, reflection, or ambiguous branch;
- otherwise contains gameplay verbs/claims not directly licensed by the controller state.

Terminal/redirect language and clearly non-game-specific copy may bypass the LLM guard.

## Phase 3 — only then consider role merging

Do not start by merging Listener + World + Planner into one opaque LLM pass. That was the dangerous direction in the failed slim experiment because a malformed or underspecified plan could erase the distinction between:

- world definition;
- runtime action;
- `blocked_now`;
- non-blocking player choice;
- `post_action_gap`;
- pending-gap resolution.

If later experiments merge roles, the merged output must preserve these typed fields and pass a deterministic schema validator before the Controller sees it.

## Failure handling contract

The failed slim run demonstrated a critical anti-pattern: invalid planner output was parsed with an empty-object fallback, after which the Controller treated the turn as ordinary `ask_open_next` behavior.

For any slim candidate:

- malformed planner JSON is not a valid empty plan;
- missing required planner fields is not a successful no-action turn;
- schema failure must produce a diagnostic/fail-closed path that is distinguishable from a learner communication gap;
- model/runtime failure must not increment pedagogical gap/repair evidence.

## Expected first-pass call reduction

For the four-turn Matching Pairs golden path, conservative Phase 1 gating should reduce the typical serial LLM work without changing core semantics:

- world-description/setup turns: skip unnecessary Gap Evaluator;
- runtime `flip two` turn: skip World Builder, World Guard and Gap Evaluator;
- repair turn with an existing pending gap: skip World Builder and World Guard but keep Gap Evaluator.

This is intentionally less aggressive than a three-LLM rewrite. It gives a measurable latency win while keeping each behavioral responsibility intact.

## Acceptance

Every candidate must be compared with `v8-revised` and with the stronger learner-facing golden path in PR #14.

Minimum checks:

1. executable taught instructions still execute;
2. action count and targets are correct;
3. action and `post_action_gap` can coexist;
4. the first genuine gap remains listener-centered and non-leading;
5. repairing the gap changes visible reality;
6. non-blocking player choice is not escalated into failure;
7. child-defined variants override familiar-game priors;
8. invalid model output cannot silently degrade to a pedagogically meaningful response;
9. latency and token metrics improve on the same scenario, not on a weakened test.
