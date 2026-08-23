# Teach Me a Game — V12 acceptance harness

V12 tests three progressively harder jobs:

1. **Follow** — can the learner experience what information a listener actually needs?
2. **Guide** — can the learner direct Raku, observe the interpretation, and repair it?
3. **Game** — can those skills support a complete learner-taught game through a grounded ending?

Expected runtime marker:

```text
debug.dsl_version = v12
debug.build_id = v12-listener-reconstruction-game-r7-20260823
```

## Must-run sequence

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v12-r7'
export DIFY_EXPECT_DSL_VERSION='v12'

node tests/e2e/run-dify.mjs --scenario follow-listener-perspective --verbose
node tests/e2e/run-dify.mjs --scenario guide-role-reversal --verbose
node tests/e2e/run-dify.mjs --scenario golden-path-learning-loop --verbose
node tests/e2e/run-dify.mjs --scenario faithful-listener-not-answer-key --verbose
node tests/e2e/run-dify.mjs --scenario smart-listener-not-pedantic --verbose
```

`repair-locate-not-guess` remains optional depth evidence. `breadth-*` remain architecture probes.

## Generalization requirement

Regression scenarios must stay unchanged while the runtime is repaired. Do not move a scenario phrase, expected branch, or familiar-game answer into an LLM prompt or narrow fallback. A valid fix should express a reusable semantic invariant and then pass the same scenario.

## Follow contract

The harness runs the authored hidden-target task:

- `lesson_start` creates the reconstruction board;
- the learner selects the triangle and chooses a reasonable but unintended top position;
- Raku adds the missing positional detail rather than blaming the learner;
- the learner repairs the triangle placement;
- clear relational instructions place the circle and square;
- the stage ends only when the hidden target is genuinely reproduced and revealed.

Hard checks protect the actual board positions and the support payload type.

## Guide contract

The harness then reverses roles:

- the learner sees a target Raku cannot see;
- an underspecified placement produces a real reasonable action rather than a fake clarification;
- the learner corrects it precisely;
- explicit and relational directions place the other shapes;
- the stage reaches `game_select` only when the deterministic hidden-target check confirms an exact match.

The AI interpreter never receives the target. The target exists only in deterministic task logic and frontend support.

## Game bootstrap

Every existing game scenario automatically runs both foundation tasks first, then selects an appropriate game label:

- Matching Pairs scenarios → `Matching Pairs`
- Tic-Tac-Toe breadth → `Tic-Tac-Toe`
- Rock Paper Scissors breadth → `Rock Paper Scissors`
- Token Race breadth → `Another simple game`

The game label is context only; all existing Game assertions continue to protect rule authority, real actions, grounded gaps, repair, and prior-knowledge suppression.

## Existing final-game regressions

- `golden-path-learning-loop` — progressive world creation, delegated player choice, a real post-action gap, repair, and visible reality change.
- `faithful-listener-not-answer-key` — learner-defined rules override familiar-game priors.
- `smart-listener-not-pedantic` — ordinary Grade 3–4 disfluency does not manufacture fake communication failures.
- `repair-locate-not-guess` — vague rejection leads to locating the mismatch rather than guessed correction.
- `breadth-*` — generic architecture probes only.

## AI full-game smoke

`run-ai-full-game.mjs` runs the same Follow and Guide tasks, selects `Another simple game`, then lets the AI child invent and teach an original game. Foundation turns do not consume the final-game turn budget.

The run passes only when the learner-authored game reaches a grounded ending with completion evidence and the lesson subsequently reaches `phase=complete` after transfer, with no pending gap, pipeline error, or phantom physical-action claim.

Artifacts remain under `.artifacts/dify-e2e/` and must not be committed.
