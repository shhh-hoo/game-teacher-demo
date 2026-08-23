# Game Teacher Demo

A short AI-native Lesson Card prototype for US Grade 3–4 learners.

## v11 learner experience

v11 is a continuous lesson, not a reset-and-retest flow:

**Raku teaches → child teaches Raku with a guide → real play exposes a genuine gap → child repairs → the same game continues while the guide fades → child-taught ending → short transfer → complete**

The central design boundary remains:

> **AI may complete presentation details, but it must not complete the child's game logic.**

`main` remains the locked v10 behavioural fallback. This branch is the direct v11 delivery path; intermediate v10.1/v10.2/v10.3 artifacts are architecture references, not deployment milestones.

Target runtime identity:

```text
debug.dsl_version = v11
debug.build_id = v11-runtime-first-continuous-play-r2-20260823
```

All LLM nodes use `thinking=false`.

## Part 1 — Raku teaches first

The lesson opens with a real game rather than asking the child to teach immediately. Raku proposes **Tic-Tac-Toe**, asks how familiar the learner is, and adapts the introduction accordingly.

Raku introduces the game in visible chunks:

**Goal → Start → Turn → Ending**

For a learner who already knows a part, Raku skips it. For an unfamiliar learner, Raku explains one small chunk and moves on. The learner then actually plays Tic-Tac-Toe with Raku. The model therefore demonstrates two ideas before role reversal: a game explanation has structure, and a good explainer responds to what the listener already knows.

## Part 2 — child teaches Raku

The child then teaches a game they already know. This preserves the successful v10 mechanism:

- the visible game world builds progressively from the child's language;
- Raku uses only child-taught gameplay rules;
- ordinary player choice is allowed when the child delegates it;
- a genuine blocking gap may be exposed, but the system does not manufacture friction;
- a repair must change executable reality and let play continue.

A persistent **Game Teaching Guide** is visible while the child first teaches:

- Goal — What are we trying to do?
- Start — What do we need before we begin?
- Turn — What happens on a turn?
- Special rules — Is there anything unusual?
- Ending — How do we know it is over?

The guide is a thinking frame, not a checklist. The child can explain naturally in any order.

## Scaffold fade

After a genuine gap is repaired, Raku keeps playing the **same game with the same memory and world**. There is no learner-facing fresh-listener reset and no request to teach everything again.

The guide fades only as a UX scaffold:

1. full guide while first teaching;
2. compact guide after the repair becomes executable;
3. compact reminder during the first successful continuation;
4. persistent guide disappears after continued success, but remains available as an optional reminder;
5. a later real gap can temporarily surface a small contextual hint.

Successful-action count is never a mastery or completion condition. The game ends only when a child-taught ending condition is actually satisfied with grounded completion evidence.

## Runtime architecture

- **Listener Interpreter** extracts only what the child communicated.
- **World Builder + World Guard** materialize a visible world without inventing gameplay semantics.
- **Executable Rule Compiler + Validator** compile grounded rules into stable Rule IR; corrections supersede contradictory rules.
- **Deterministic Runtime Primary** owns supported physical transitions.
- **Bounded Semantic Resolver** is used only when deterministic Runtime cannot safely execute an existing grounded transition.
- **Gap Evaluator + Full-Lesson Controller** separate real communication gaps from ordinary player choice, continuation, and technical failure.
- **Raku response + Response Guard** may not narrate a physical action that the validated plan did not authorize.
- **Browser UI** renders world definition separately from physical runtime effects.

The v11 controller never uses learner-facing `reset_listener`, `reset_rules`, or `reset_world` transitions.

## Completion and transfer

`game_complete` and `lesson_complete` are separate.

A game completes only when the child taught an ending condition, the authorized world actually reaches it, and completion evidence is non-empty. The final grounded action still executes visibly. The lesson then enters a short transfer question such as what the learner would check or explain when teaching another player in the future. A trivial response does not complete the lesson; a short substantive response can.

## Run locally

```bash
set -a
source .env.local
set +a
npx vercel dev
```

Dify workflow exports remain deployment artifacts and are intentionally not committed to the repository.

## Validation

After importing and publishing the continuous-play v11 DSL:

```bash
export DIFY_TEST_VERSION='v11-continuous-play'
export DIFY_EXPECT_DSL_VERSION='v11'
export DIFY_EXPECT_BUILD_ID='v11-runtime-first-continuous-play-r2-20260823'

node tests/e2e/run-v11-lesson-contract.mjs --verbose
node tests/e2e/run-dify.mjs --version v11 --scenario golden-path-learning-loop
node tests/e2e/run-dify.mjs --version v11 --scenario faithful-listener-not-answer-key
node tests/e2e/run-dify.mjs --version v11 --scenario smart-listener-not-pedantic
```

`run-v11-lesson-contract.mjs` is the authoritative v11 lesson gate. It verifies continuous state, scaffold fade, no fresh-listener reset, grounded game completion, transfer retry, and lesson completion.

`run-ai-full-game.mjs` is still useful as broad architecture evidence, but its current v10-shaped stop condition should not be reported as a v11 full-lesson pass until it is updated for the new transfer semantics.
