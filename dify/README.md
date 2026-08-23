# Dify workflow — V12 three-stage lesson contract

The V12 product has two short foundation tasks followed by the learner-authored game runtime:

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
debug.build_id = v12-listener-reconstruction-game-r7-20260823
```

The exported Dify YAML is a deployment artifact and is not committed to the repository.

## Stage 1 — Follow

This stage is fully authored and deterministic. Raku owns a hidden target arrangement. The learner sees movable shapes and six possible positions.

Raku gives only the next instruction needed. The first direction is intentionally compatible with multiple reasonable actions. If the learner chooses a different reasonable position from the hidden target, Raku acknowledges that the action was reasonable from the words and adds only the missing detail. Later steps use clear relational instructions.

The stage ends by revealing the target. No LLM is needed because Raku owns both the target and the instructional sequence.

## Stage 2 — Guide

The learner sees a new target arrangement; Raku does not.

### AI · Raku Reconstruction Listener

The LLM receives:

- the learner's current utterance;
- Raku's current board state and recent placement history;
- the fixed vocabulary of shapes and board positions.

It does **not** receive the hidden target.

The interpreter returns grounded placement semantics such as shape, explicit slot, row-only information, or a spatial relation.

### Deterministic Reconstruction Controller

The controller converts those semantics into one visible placement. When language supports multiple positions but does not block action, the controller makes a deterministic reasonable choice rather than turning the moment into a tutoring question.

The hidden target is used only here to determine whether the reconstruction task is complete. A mismatch is visible to the learner; when the learner corrects Raku, the same shape is moved immediately. A vague rejection produces a locate prompt rather than a guessed correction.

## Game selection

After the Guide target is genuinely reproduced, the learner chooses a familiar game. The workflow stores only the game label. It resets to a blank learner-authored world and shows the Game Guide.

The game label is never a source of rules.

## Stage 3 — learner-authored game runtime

The semantic-core responsibilities remain:

```text
Learner message / game event
        ↓
Listener Interpreter
        ↓
Grounded listener memory + student evidence
        ↓
World Builder
        ↓
World Grounding Guard
        ↓
Executable Rule Compiler / Rule IR
        ↓
Deterministic Runtime Primary
        ↓
Bounded Semantic Resolver only when needed
        ↓
Gap Evaluator
        ↓
Full-Lesson Controller
        ↓
Raku response + response guard
        ↓
Frontend JSON
```

### Authority boundary

The learner owns gameplay semantics. The selected game label may resolve ordinary nouns or references, but it cannot supply omitted gameplay state, legal moves, consequences, scores, turn structure, goals, repetition, or endings.

Presentation inference may choose visual labels, symbols, layout, and small representative quantities where quantity is not itself gameplay. It may not invent gameplay semantics.

### Generalization discipline

Regression scenarios are acceptance evidence, not a source of implementation examples. LLM prompts must express domain-level contracts rather than quote regression phrases or expected branches. Deterministic fallbacks must ground general semantics such as:

- explicit initial-state assignment → world state;
- explicit delegated atomic action + count → eligible observable targets;
- explicit observable condition + learner-stated consequence → current-state effect;
- missing later consequence → post-action gap.

A regression is meaningful only when those general contracts are validated against the unchanged scenario.

### Listener memory and corrections

The Listener Interpreter stores only current learner-grounded meaning. Corrections supersede conflicting active instructions. Previously taught procedures remain available later in the game.

### Runtime and gaps

Raku acts as soon as the current taught rules and world state support an action. A temporary execution boundary is not automatically a communication gap. A real gap is opened only when the next move genuinely requires an untaught transition.

Ordinary delegated choices remain Raku's player agency. Hidden object identity is unavailable while hidden.

### Game Guide and repair

The initial Game Guide exposes five light prompts:

`Goal / Start / Turn / Special / Ending`

They are attention support, not a required checklist. The learner may explain in any natural order and may begin play before all five have been covered. After successful play/repair the guide compacts and fades.

The first earned repair may connect briefly to the listener idea practiced in Follow/Guide. Later repairs stay local to the current game.

### Grounded completion and transfer

`game_complete=true` requires:

1. a learner-taught ending condition;
2. a world state that actually satisfies it; and
3. non-empty grounded completion evidence.

After grounded game completion, the lesson enters `transfer`. Raku asks one short question tied to the just-completed experience. A substantive learner response advances to `complete`.

## Frontend protocol

Supported atomic actions remain:

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

New V12 support payloads used before the game runtime:

- `listener_task`
- `reconstruction_result`
- `reconstruction_task`
- `game_picker`

Game-stage payloads remain `game_guide`, `repair_coaching`, and `locate_step`.
