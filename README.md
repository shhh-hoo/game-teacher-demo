# Game Teacher Demo — V12

A short AI-native Lesson Card prototype for US Grade 3–4 learners.

The lesson trains one communication skill: **organize and revise an executable explanation around what the listener currently understands and needs next.** The learner first experiences the task from the listener side, then reverses roles and guides Raku, then transfers the same skill into teaching a complete game.

The learner-facing progression is:

```text
Follow Raku's directions
    ↓
See what information a listener actually needs
    ↓
Switch roles and guide Raku to a hidden target
    ↓
Observe Raku's real interpretation and repair mismatches
    ↓
Choose a familiar game
    ↓
Teach Raku while the game becomes playable
    ↓
Keep explaining / repairing as new states appear
    ↓
Reach a learner-taught ending
    ↓
One short transfer question
```

## V12 lesson stages

### 1. Follow — listener perspective

Raku can see a simple target arrangement that the learner cannot see. The learner manipulates shapes while Raku gives only the next information needed. The first instruction is deliberately compatible with more than one reasonable action; when that matters, Raku becomes more specific. The task ends by revealing the target and comparing the result.

### 2. Guide — role reversal

The learner sees a new target that Raku cannot see. The learner gives directions in ordinary language. Raku acts only from those words and its current board state. The AI listener never receives the hidden target. A deterministic controller executes the interpreted instruction and separately checks whether the visible board matches the target.

### 3. Game — integrated transfer

The learner chooses a familiar simple game. The selected game name is context only and never supplies rules. The existing runtime-first semantic core then handles learner-grounded listener memory, Rule IR, world construction, validated actions, real communication gaps, repair, continued play, and grounded completion.

The Game Guide starts visible with five light prompts — **Goal / Start / Turn / Special / Ending** — then fades as play succeeds. The learner does not need to explain every rule before play starts; Raku acts as soon as the current information supports an action and asks only when the next state truly needs more information.

## Runtime identity

The V12 deployment candidate should emit:

```text
debug.dsl_version = v12
debug.build_id = v12-listener-reconstruction-game-r7-20260823
```

The Dify workflow export remains a deployment artifact and is intentionally not committed to this repository.

## Core authority boundary

During the final game, learner-taught rules are the only source of gameplay semantics. The selected game label may help resolve ordinary nouns or references, but it is never evidence for an omitted rule, state, legal move, consequence, goal, or ending. Presentation details may be inferred; legal moves, outcomes, turn logic, repetition, scores, and ending conditions remain learner-authored.

Regression scenarios are acceptance evidence, not implementation instructions. Scenario-specific phrases or familiar-game branches must not be copied into LLM prompts or narrow fallbacks merely to make a test pass; the runtime should encode general semantic contracts and be validated against unchanged scenarios.

## Run locally

Create `.env.local` from `.env.example`, point it at the published V12 Dify app, then run:

```bash
set -a
source .env.local
set +a
npx vercel dev
```

## Validation

Focused deterministic runs:

```bash
export DIFY_TEST_VERSION='v12-r7'
export DIFY_EXPECT_DSL_VERSION='v12'

node tests/e2e/run-dify.mjs --scenario follow-listener-perspective --verbose
node tests/e2e/run-dify.mjs --scenario guide-role-reversal --verbose
node tests/e2e/run-dify.mjs --scenario golden-path-learning-loop --verbose
node tests/e2e/run-dify.mjs --scenario faithful-listener-not-answer-key --verbose
node tests/e2e/run-dify.mjs --scenario smart-listener-not-pedantic --verbose
```

Then run `repair-locate-not-guess`, the `breadth-*` probes, and finally `run-ai-full-game.mjs --verbose`.

## Source of truth

- `dify/README.md` — V12 runtime responsibilities and authority boundaries.
- `tests/e2e/README.md` — deterministic V12 acceptance sequence.
- `tests/e2e/AI_FULL_GAME.md` — unscripted full-game smoke after the two foundation tasks.
- `AGENTS.md` — repository discipline and non-negotiable runtime invariants.
