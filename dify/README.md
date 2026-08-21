# Dify workflow

> **Current rollback decision (2026-08-22):** the slim/flash v8 experiment is not the active baseline. Restore and validate the pre-slim `v8-revised` workflow first. The canonical rollback artifact and acceptance gate are in [`dify/v8/README.md`](./v8/README.md).
>
> Do not optimize node count/latency by removing the action-planning and post-action-gap semantics. Runtime behavior must remain `explain -> act -> encounter gap -> repair`.

# Dify v6 setup — Progressive World + Explicit Teaching

v6 keeps the architectural boundary visible in the Chatflow:

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

A partial world is valid. The AI should not make the interface artificially complete by guessing a missing rule.

## Visible pedagogy routing

Global guardrails run first:

1. ASR uncertainty → ask to repeat; do not create a communication-teaching failure from recognizer uncertainty.
2. Off topic → brief redirect.
3. Correction → global repair, regardless of lesson phase.
   - specific world correction → patch the rendered world
   - specific action correction → restore the pre-action scene and replay
   - first vague correction → ask which part was wrong
   - repeated vague correction → show the actual build/action trace

Then route by lesson phase:

- `experience`: keep building/acting until the first real blocking communication gap. At that first gap, show the main Teach Moment immediately rather than entering an indefinite clarification loop.
- `teach`: let the child apply the listener-centered principle immediately, then move to guided practice.
- `practice`: allow at most one additional micro-teach. After sufficient successful guided application, preserve the playable world, clear Jamie's learned rules, reset the physical state, and introduce a fresh listener.
- `independent`: no teaching scaffold. Jamie gives only natural listener feedback. One sufficiently complete fresh-listener performance can move to transfer.
- `transfer`: ask what the child should think about before explaining a different game to someone new; finish when the response shows listener-centered transfer.

## World Engine

Copy `lesson-engine.py` into the deterministic Code node *after* the selected pedagogy-policy aggregator.

The engine may:

- sanitize/merge the declarative world patch;
- merge only student-taught semantic rule updates;
- validate object IDs and atomic actions;
- capture the first playable baseline before play mutates it;
- preserve the exact pre-action scene for replay;
- build the repair trace;
- execute the Dify-selected policy's permitted actions;
- reset the world for the fresh-listener performance.

It must not decide whether to teach, micro-teach, fade scaffolds, transfer, or finish. Those decisions remain visible Dify branches.

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
