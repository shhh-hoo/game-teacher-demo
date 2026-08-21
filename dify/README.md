# Dify workflow — Progressive World + v8 experiment contracts

> **Current experiment policy (2026-08-22):** generated Dify workflow exports are local/deployment artifacts and are not stored in this repository. The durable v8 behavioral/runtime contract is in [`dify/v8/README.md`](./v8/README.md), with optimization priorities in [`dify/v8/SLIMMING.md`](./v8/SLIMMING.md).
>
> Optimize serial LLM work and context size without weakening the action-first loop, listener/world authority boundaries, runtime identity, or learner-facing acceptance.

## Historical progressive-world setup

The readable source below documents the progressive-world architecture that the current v8 line evolved from. It is useful context, not a claim that a generated v8 DSL lives in Git.

```text
Student speech / game click
        ↓
AI Listener + World Builder
        ↓
Dify guardrails + phase routing
        ↓
Visible Pedagogy Policy
        ↓
World Engine + Global Repair
        ↓
Save deterministic lesson state
        ↓
AI Jamie response
        ↓
Frontend JSON
```

Do not collapse the phase routing into the Code node. **Dify chooses pedagogy; the Code node validates world reality.**

## Conversation variables

- `phase` — `experience` → `teach` → `practice` → `independent` → `transfer` → `complete`
- `world_json` — current declarative game world
- `listener_model_json` — only rules/instructions the current Jamie has actually been taught
- `baseline_world_json` — first playable setup, retained for the fresh-listener reset
- `scene_snapshot_json` — exact world immediately before the latest physical action sequence
- `last_action_trace_json` — recent world-construction / play trace for global repair
- `repair_count` — repeated vague corrections
- `teach_count` — main Teach Moment plus at most one extra micro-teach
- `practice_success_count` — successful guided applications
- `independent_success_count` — optional fresh-listener performance evidence

The current v8 contract strengthens one important point: `listener_model_json` is resettable Jamie memory and must not be reconstructed each turn by blindly copying all durable student evidence back into it.

## AI Listener + World Builder

Use `interpreter-prompt.md` in a Parameter Extractor. It should expose:

- `student_intent`
- `correction_specificity`
- `repair_target`
- `off_topic`
- `asr_uncertain`
- `communication_blocking`
- `communication_focus`
- `gap_reason`
- `world_patch_json`
- `rule_updates_json`
- `listener_summary`
- `jamie_can_act`
- `proposed_actions_json`
- `world_ready`
- `guided_success`
- `independent_success`
- `transfer_evidence`

The important semantic rule is:

> AI may infer incidental presentation details. It may not invent gameplay-relevant logic.

A partial world is valid. The AI should not make the interface artificially complete by guessing a missing rule. Visible `status`, gameplay state, readiness, ownership, score/turn meaning, and action affordances are semantic outputs and require grounding; they are not automatically harmless presentation details.

## Visible pedagogy routing

Global guardrails run first:

1. ASR uncertainty → ask to repeat; do not create a communication-teaching failure from recognizer uncertainty.
2. Off topic → brief redirect.
3. Correction → global repair, regardless of lesson phase.
   - specific world correction → patch the rendered world
   - specific action correction → restore the pre-action scene and replay
   - first vague correction → ask which part was wrong
   - repeated vague correction → show the actual build/action trace

A specific correction must supersede the contradictory active listener rule rather than merely appending another conflicting instruction.

Then route by lesson phase:

- `experience`: keep building/acting until the first real blocking communication gap.
- `teach`: let the child apply one listener-centered idea, then move back toward play.
- `practice`: allow limited scaffolding; count success by learner turn/episode, not by the number of atomic animation actions.
- `independent`: clear Jamie's learned rules while preserving the play environment and baseline; no teaching scaffold.
- `transfer`: ask what the child should think about before explaining a different game to someone new.

## World Engine

Copy `lesson-engine.py` into the deterministic Code node *after* the selected pedagogy-policy aggregator when using this historical source layout.

The engine may:

- sanitize/merge declarative world patches;
- merge only student-taught semantic rule updates;
- validate object IDs and atomic actions;
- capture the first playable baseline before play mutates it;
- preserve the exact pre-action scene for replay;
- build the repair trace;
- execute permitted atomic actions;
- reset the world for fresh-listener performance.

It must not manufacture pedagogy or game rules.

## Browser world protocol

The world is declarative. Supported surface types are `table` and `grid`. Supported object types are `card`, `token`, `piece`, `cell`, `marker`, and generic `object`.

Supported atomic actions are:

- `update_object`
- `reveal_object`
- `hide_object`
- `remove_object`
- `set_turn`
- `set_counter`
- `set_status`
- `wait`
- `reset_to_baseline`

The browser also sends object clicks back as `[[GAME_TEACHER_EVENT]]` requests so the rendered world can become genuinely playable during guided or independent play.
