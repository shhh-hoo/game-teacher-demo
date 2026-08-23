# Teach Me a Game acceptance harness

The v11 product question is:

> Can a Grade 3–4 child experience a listener-aware game introduction, then teach Raku a game, repair a real communication gap, keep playing the same game as scaffolding fades, reach a child-taught ending, and transfer the idea without Raku importing an answer key?

The learner-facing loop is:

**Raku models → child teaches with guide → genuine gap → repair → same game continues → guide fades → grounded ending → transfer → complete**

There is no learner-facing fresh-listener reset in the current v11 contract.

## Runtime target

```text
debug.dsl_version = v11
debug.build_id = v11-runtime-first-continuous-play-r2-20260823
```

## Primary v11 gate

After importing and publishing the continuous-play v11 DSL:

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v11-continuous-play'
export DIFY_EXPECT_DSL_VERSION='v11'
export DIFY_EXPECT_BUILD_ID='v11-runtime-first-continuous-play-r2-20260823'

node tests/e2e/run-v11-lesson-contract.mjs --verbose
```

The dedicated lesson contract verifies:

- initial teaching returns the full `game_guide`;
- the first genuine blocking gap earns `teach_moment` rather than a fake tutoring checklist;
- a successful repair changes executable reality and moves into `practice`;
- the guide becomes compact after repair;
- continued successful play fades the persistent guide, but **does not** reset listener memory, Rule IR, or world state;
- `reset_listener`, `reset_rules`, `reset_world`, and `fresh_listener` remain false throughout the learner flow;
- the final child-grounded action still executes on the ending turn;
- `game_complete` with non-empty `completion_evidence` enters `transfer` directly;
- a trivial transfer answer such as `what?` does not complete the lesson;
- a short substantive transfer response can produce `phase=complete` and `lesson_complete=true`.

Scaffold fade is a UX heuristic only. Successful-action count is never used as mastery or game-completion evidence.

## Semantic regressions

Once the full lesson gate is green, run the existing semantic checks against v11:

```bash
node tests/e2e/run-dify.mjs --version v11 --scenario golden-path-learning-loop
node tests/e2e/run-dify.mjs --version v11 --scenario faithful-listener-not-answer-key
node tests/e2e/run-dify.mjs --version v11 --scenario smart-listener-not-pedantic
```

- `golden-path-learning-loop` protects progressive world creation, delegated player choice, a real post-action gap, child repair, and visible reality change.
- `faithful-listener-not-answer-key` protects child rule authority over familiar-game priors.
- `smart-listener-not-pedantic` protects normal Grade 3–4 disfluency from becoming fake communication failure.
- `repair-locate-not-guess` remains optional design-depth evidence.
- `breadth-*` remain architecture probes, not reasons to add game-specific code.

The older `v11-full-lesson-fresh-listener` scenario in `scenarios.json` belongs to the abandoned staged prototype and must not be used as current v11 acceptance evidence. `run-v11-lesson-contract.mjs` is authoritative for the learner flow.

## Hard boundaries

Hard checks protect:

- strict runtime/build identity;
- valid frontend protocol shape;
- no internal provider/parser failure presented as learner failure;
- no untaught gameplay logic leaking into the world or listener;
- no phantom physical action claims;
- Runtime Primary ownership of supported actions;
- bounded fallback rather than a second hidden compiler;
- child corrections superseding contradictory rules;
- `game_complete` grounded in child-taught ending evidence;
- `game_complete` remaining distinct from `lesson_complete`.

Exact wording and general conversational smoothness remain soft unless they violate one of those boundaries.

## AI full-game smoke

`run-ai-full-game.mjs` is still useful as broad architecture evidence, but its current v10-shaped stop condition expects the first `game_complete` to coincide with lesson completion. Do not report it as a v11 lesson pass until its stop condition is updated for the current transfer phase.

Generated traces stay under `.artifacts/dify-e2e/` and should not be committed.
