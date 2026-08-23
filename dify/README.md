# Dify workflow - V12 lesson contract

The final V12 lesson has two short foundation tasks followed by the learner-authored game runtime:

```text
Follow
  learner acts from Raku's instructions
        ↓
Guide
  Raku acts from learner instructions
        ↓
Game
  learner teaches a complete game
        ↓
Transfer → Complete
```

Expected runtime marker:

```text
debug.dsl_version = v12
debug.build_id = v12-listener-reconstruction-game-r24-final-20260824
```

Final model allocation:

- `AI · Raku Listener Interpreter` -> `deepseek-v4-pro`
- `AI · Executable Rule Compiler` -> `deepseek-v4-pro`
- all other LLM nodes -> `deepseek-v4-flash`
- Thinking disabled everywhere

The exported Dify YAML is a deployment/submission artifact and is not committed to the repository.

## Stage 1 - Follow

This stage is authored and deterministic. Raku owns a hidden target arrangement. The learner sees movable shapes and possible positions.

Raku gives only the next instruction needed. The first direction is intentionally compatible with more than one reasonable action. If the learner chooses a different reasonable position from the hidden target, Raku acknowledges that the action was reasonable from the words and adds only the missing detail.

The stage ends by revealing the target. No LLM is required because Raku owns both the target and the instructional sequence.

## Stage 2 - Guide

The learner sees a new target arrangement; Raku does not.

### AI · Raku Reconstruction Listener

The LLM receives the learner's current utterance plus Raku's current board state and recent placement history. It does **not** receive the hidden target.

The interpreter returns grounded placement semantics such as shape, explicit slot, row-only information, or a spatial relation.

### Deterministic Reconstruction Controller

The controller converts those semantics into one visible placement. When language supports multiple positions but does not block action, the controller makes one reasonable choice rather than turning the moment into a tutoring question.

The hidden target is used only to determine whether the reconstruction task is complete. A mismatch is visible to the learner; a specific correction moves the shape immediately.

## Game selection

After the Guide target is reproduced, the learner chooses a familiar game. The workflow stores only the game label, resets to a blank learner-authored world, and shows the Game Guide.

The game label is context only. It never supplies rules.

## Stage 3 - learner-authored game runtime

```text
Learner message / game event
        ↓
AI · Listener Interpreter
        ↓
Grounded listener memory + student evidence
        ↓
AI · World Builder
        ↓
Deterministic World Grounding Guard
        ↓
AI · Executable Rule Compiler / Rule IR
        ↓
Deterministic Runtime Primary
        ↓
AI · Bounded Semantic Resolver when needed
        ↓
Gap Evaluator
        ↓
Full-Lesson Controller
        ↓
Raku response + response guard
        ↓
Frontend JSON
```

### Product truth / authority boundary

**The child's utterances are the game.**

Truth order:

1. current explicit learner correction;
2. current explicit learner statement;
3. prior learner-taught evidence;
4. AI interpretation, presentation inference, and defaults.

AI-inferred world state is provisional. A mismatch between a clear learner statement and an older AI guess is a model-reconciliation problem, not a learner communication failure.

### Listener memory and corrections

The listener model stores only learner-grounded meaning. Corrections supersede conflicting earlier evidence. Raku must not import canonical rules from a familiar game name.

### Runtime and player agency

Raku acts as soon as current taught rules and world state support an action. Multiple legal choices are not automatically communication gaps: if the learner has delegated a choice to Raku, Raku chooses.

A real gap opens only when the next transition genuinely requires information the learner has not supplied.

### Game Guide and scaffold fade

The initial Game Guide exposes five light prompts:

`Goal / Start / Turn / Special / Ending`

They are attention support, not a required checklist. The learner may explain in any natural order and play may begin before all five have been covered. After successful play/repair the guide compacts and fades.

### World reconciliation

Presentation inference may choose visual labels, symbols, or layout, but these choices are provisional. Explicit learner setup, position, state, vacancy, or correction can revise the rendered world. Deterministic validation must not protect an older AI guess against newer learner evidence.

### Grounded completion

`game_complete=true` requires a learner-taught ending condition, a visible state that satisfies it, and non-empty learner-grounded evidence. Completion then advances to one short transfer question and `complete`.

## Frontend protocol

Supported atomic actions include:

- `update_object`
- `reveal_object`
- `hide_object`
- `remove_object`
- `set_turn`
- `set_counter`
- `set_status`
- `wait`
- `reset_to_baseline` where applicable

The browser applies `world_patch` first, then `ui_action`.

V12 support payloads include `listener_task`, `reconstruction_result`, `reconstruction_task`, `game_picker`, `game_guide`, `repair_coaching`, and `locate_step`.

## Validation policy

Fixed learner-facing E2E/browser probes were used throughout development. The unscripted AI full-game runner remains available as high-cost diagnostic fuzzing, but is intentionally not a submission/freeze gate: it repeatedly invokes the full semantic pipeline with growing context and tests beyond the bounded core Lesson Card path.
