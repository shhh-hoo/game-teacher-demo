# Game Teacher Demo

A short AI-native Lesson Card prototype for US Grade 3–4 learners.

The child first plays a familiar game with Raku. Raku checks what the learner already knows, introduces only the missing parts in a clear structure, and plays with them. The roles then reverse: the child teaches Raku a game they know, Raku acts only on child-taught rules, real play exposes genuine missing information, and the child repairs the explanation while the same game continues.

The v11 learner loop is:

**Raku teaches → Child teaches with a guide → Real gap → Repair → Same game continues → Guide fades → Child-taught ending → Transfer → Complete**

The central design boundary is:

> **AI may complete presentation details, but it must not complete the child's game logic.**

Jamie/Raku may use ordinary player agency inside rules the child has taught. It may not use pretrained knowledge of a familiar game as a hidden answer key.

## Runtime status

`main` remains the locked v10 behavioural fallback:

```text
debug.dsl_version = v10
debug.build_id = v10-no-thinking-r4-20260822
```

This branch is the direct v11 continuous-play delivery path. Intermediate v10.x migration workflows and the abandoned fresh-listener lesson are historical only.

Current target:

```text
debug.dsl_version = v11
debug.build_id = v11-runtime-first-continuous-play-r4-20260823
debug.action_plan._validation.decision_version = 1540-r4-direct-query
```

All LLM nodes run with `thinking=false`.

Dify workflow exports are deployment artifacts and are intentionally not committed to this repository.

## v11 runtime responsibilities

- **Listener Interpreter** extracts only what the child communicated.
- **World Builder + World Guard** progressively materialize a visible world while separating presentation inference from gameplay semantics.
- **Executable Rule Compiler + Validator** compile current child-taught gameplay meaning into limited Rule IR.
- **Deterministic Runtime Primary** owns supported physical transitions.
- **Bounded Semantic Resolver** is used only when Runtime cannot safely execute an existing grounded transition.
- **Runtime/Fallback Selector (1540)** distinguishes a real execution request from a teaching/setup turn. A setup turn may build the visible world and idle without opening a learner gap.
- **Gap Evaluator + Full-Lesson Controller** open teaching moments only for genuine blocking gaps.
- **Browser UI** renders the game, teaching guide, scaffold fade, and transfer experience.

## Critical false-gap boundary

A child is allowed to explain a game progressively. `no_applicable_supported_rule` does **not** mean a communication breakdown by itself.

Examples that should remain ordinary teaching/world-building:

- `Make five available tokens named A, B, C, D, and E.`
- `Put all the cards face down to start.`
- `We both choose rock, paper, or scissors at the same time.`

Examples that explicitly request execution/continuation and therefore may open a typed blocking gap if Raku cannot proceed:

- `Remove token A now.`
- `Pick one now.`
- `Continue.`
- `Your turn.`
- a physical world interaction event

r4 derives this boundary directly from the current raw query inside node 1540, instead of depending on an upstream semantic summary. The decision is exposed in `debug.action_plan._validation.runtime_request_expected` and the exact selector version is exposed as `decision_version`.

## Learner experience

### Raku teaches first

Raku proposes Tic-Tac-Toe, asks learner familiarity, and introduces **Goal / Start / Turn / Ending** adaptively. Learners may skip parts they already know. The learner then actually plays before roles reverse.

### Child teaches Raku

The child teaches naturally. A persistent Game Teaching Guide shows **Goal / Start / Turn / Special rules / Ending** as a thinking frame, not a checklist.

A genuine blocking gap earns the teach/repair moment. Repair must change executable reality and play continues in the same world.

### Scaffold fade

The full guide is visible during initial teaching, becomes compact after repair, and fades during successful continued play. It remains available as an optional reminder. Action count changes only guide presentation; it does not determine mastery or lesson completion.

### Completion

`game_complete` requires a child-taught ending plus grounded world evidence. The game ending leads directly to a short transfer prompt. `lesson_complete` is separate and requires a substantive transfer response.

## Run locally

```bash
set -a
source .env.local
set +a
npx vercel dev
```

## Validation

After importing and publishing the current r4 DSL:

```bash
export DIFY_TEST_VERSION='v11-continuous-r4'
export DIFY_EXPECT_DSL_VERSION='v11'
export DIFY_EXPECT_BUILD_ID='v11-runtime-first-continuous-play-r4-20260823'

node tests/e2e/run-v11-lesson-contract.mjs --verbose
```

The lesson runner also requires:

```text
debug.action_plan._validation.decision_version = 1540-r4-direct-query
```

so a stale 1540 node cannot masquerade as a new build merely because the packer build id changed.

After that passes, run the active v11-only scenario catalog:

```bash
node tests/e2e/run-dify.mjs --version v11 --scenario golden-path-learning-loop
node tests/e2e/run-dify.mjs --version v11 --scenario faithful-listener-not-answer-key
node tests/e2e/run-dify.mjs --version v11 --scenario smart-listener-not-pedantic
```

`tests/e2e/scenarios.json` intentionally contains only active v11 scenarios; abandoned fresh-listener and staged migration-only tests remain available through Git history rather than the executable catalog.
