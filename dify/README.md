# Dify workflow — v10 semantic-core contract

> **Current experiment policy (2026-08-22):** generated Dify workflow exports are local/deployment artifacts and are not stored in this repository. This document describes the durable behavioral/runtime contract that the published v10 workflow is expected to satisfy.

The current validated runtime family is:

```text
debug.dsl_version = v10
debug.build_id = v10-no-thinking-r4-20260822
```

The build identifier may change as the deployment artifact is revised. The durable contract below should change only when product semantics change.

## Product loop

The current product is not a fixed lesson-state machine. The learner-facing loop is:

```text
Child explains
    ↓
World progressively materializes
    ↓
Jamie acts on child-taught rules
    ↓
Real play either continues or exposes one genuine communication gap
    ↓
Child repairs the explanation
    ↓
Repair changes visible reality
    ↓
Jamie continues using the taught procedure
    ↓
World reaches a child-taught ending
```

The core heuristic is listener-centered: **what does Jamie still need before it can make the next move?** That heuristic must not become a checklist or a reason to manufacture gaps when normal language is already actionable.

## Authority boundary

The child is the rule authority for the current game. Jamie is an ordinary player inside those rules.

- Familiar-game pretraining is never evidence that the child taught a rule.
- The child owns legal moves, outcomes, turn structure, repetition, scores, strategy constraints, and ending conditions.
- Jamie may make ordinary delegated player choices. `any one`, `any two`, `you choose`, and equivalent language authorize a choice among currently eligible equivalent options.
- Hidden object identity must not be available to player-choice planning while the object is hidden.
- Presentation inference may choose harmless visual details, but it may not create gameplay state or logic.

## Current semantic-core pipeline

The published Dify graph may evolve internally, but the current v10 responsibilities are separated approximately as follows:

```text
Child message / game event
        ↓
Listener Interpreter
        ↓
Listener memory / student evidence
        ↓
World Builder
        ↓
World Guard + actionable-world view
        ↓
Action Planner
        ↓
Action-plan Validator
        ↓
Gap Evaluator
        ↓
Controller
        ↓
Jamie response
        ↓
Response Guard
        ↓
Frontend JSON pack
```

### Listener Interpreter

Use normal semantic understanding rather than a library of game-specific phrase patterns. The interpreter should understand fragments, ordinary child language, self-correction, pronouns, sequence, conditions, repetition, and endings while preserving one hard boundary: it may only store rules the child actually communicated.

Student evidence is durable across the conversation. Listener memory is the grounded procedural knowledge Jamie is allowed to use now. Corrections should supersede contradictory active instructions rather than accumulating both versions as simultaneously true rules.

### World Builder and World Guard

The World Builder proposes a declarative delta. It may infer presentation details such as symbols, labels, layout, and a small demonstration quantity when quantity was not itself taught as gameplay.

The guard must reject or sanitize ungrounded gameplay semantics, including inferred interactive affordances, state transitions, ownership, turn meaning, scores, readiness, or endings.

`world_patch` defines the world. It must not pre-apply the same physical effect that `ui_action` is about to execute.

### Action Planner

The planner reasons over:

1. child-taught listener memory;
2. the current child message;
3. the authorized actionable-world view;
4. current gap/recent action context.

Treat taught instructions as a coherent reusable procedure. Previously taught rules remain usable on later turns; the child should not have to re-teach a rule on every iteration.

The planner currently runs in normal non-thinking JSON mode. This is intentional. The current DeepSeek/Dify reasoning-output path proved unreliable for structured planner output, while the no-thinking semantic-core planner has produced stable schema-valid actions and grounded full-game completion.

A temporary inability to decide the next branch because the world has not yet revealed the relevant state is an **execution boundary**, not automatically a communication gap. If the child already taught what to do after that state becomes observable, preserve it as continuation evidence instead of opening a new gap.

### Action-plan Validator

Downstream code must consume the validated planner result, never raw model output.

Hard checks include:

- valid JSON and required planner shape;
- allowed atomic action types;
- action targets exist;
- no frontend-response wrapper masquerading as a planner result unless it can be safely recovered;
- structured-output failures become pipeline errors, not learner failures.

Diagnostics such as `raw_type`, `raw_keys`, and `raw_preview` exist to distinguish provider/format failures from semantic planning failures.

### Gap Evaluator and Controller

A pending communication gap is a specific missing rule-relevant need. It is resolved only when the child's contribution actually makes the relevant transition actionable.

Pipeline/parser failures are never evidence that the child explained badly. On system failure:

- preserve the learner gap as-is;
- do not increment learner repair attempts or scaffolding counters;
- do not generate learner-blaming feedback.

Repair may create an internal `reflection_candidate`, but the controller does not immediately turn repair into a lesson summary. Play continues.

### Jamie response and Response Guard

Jamie should sound like a capable same-age friend, not a tutor or parser.

- Do not grade the child.
- Do not recite a communication principle after every repair.
- Do not force a question when a brief acknowledgement is enough.
- Do not guess unstated rules through leading questions.
- Never claim that a physical action happened unless the validated plan actually contains the corresponding executable action.

## Grounded completion

`game_complete=true` is about the child's game, not an arbitrary lesson progression counter.

Completion requires all three:

1. the child taught an ending condition;
2. the authorized world after the planned actions satisfies it; and
3. `completion_evidence` cites the child-taught ending rule.

At grounded completion the controller emits `phase=complete`, clears any pending listener gap, and closes naturally. If a meaningful earlier repair earned a reflection candidate, one short specific reflection may be surfaced here; it is optional and must not become a general lecture such as `When you teach someone...`.

## Current frontend protocol

Supported atomic actions are:

- `update_object`
- `reveal_object`
- `hide_object`
- `remove_object`
- `set_turn`
- `set_counter`
- `set_status`
- `wait`
- `reset_to_baseline` where still supported by the browser/runtime

The browser applies `world_patch`, then executes `ui_action`. The two channels must remain semantically separate.

## Failure and recovery philosophy

The runtime distinguishes learner/product behavior from provider/runtime faults.

- Successful wrapper recovery belongs in `debug.recoveries`, not `pipeline_errors`.
- Unrecoverable structured-output/provider failures belong in `pipeline_errors`.
- A system error must never be translated into `you did not explain clearly enough`.
- Learner-facing physical claims must stay faithful to the validated action plan.

## Validation evidence

The deterministic scenarios under `tests/e2e/` protect the core loop, child authority, player agency, grounded repair, and prior-knowledge suppression.

`tests/e2e/run-ai-full-game.mjs` provides broader unscripted evidence: an AI child invents a small original game, teaches it turn by turn, and the run passes only when the world reaches a child-taught ending with `game_complete=true`, `phase=complete`, non-empty completion evidence, no pending gap, and no pipeline errors.

The no-thinking v10 r4 runtime has completed such an original full-game smoke successfully. This is broad smoke evidence, not proof that arbitrary games are production-ready.

## v10.1 local candidate

The reviewable first migration stage is documented under [`v10_1/`](./v10_1/). It compiles current-turn, child-taught instructions into a separately persisted executable-rule shadow with deterministic provenance and correction validation. The legacy planner remains the sole action source, so this stage can be compared against v10 without changing learner-facing authority.

The candidate is not described as published until its generated artifact has been imported and activated in Dify. Generated workflow YAML stays outside version control.

## Historical files

The following are retained for design history only and are not active workflow source:

- [`interpreter-prompt.md`](./interpreter-prompt.md) — old v6 combined interpreter/world/action prompt.
- [`lesson-engine.py`](./lesson-engine.py) — old v6 deterministic lesson-state engine.
- [`v8/`](./v8/) — v8 behavioral/slimming experiments that informed later invariants.

Do not copy these historical files into a new Dify graph as if they were the current v10 architecture.
