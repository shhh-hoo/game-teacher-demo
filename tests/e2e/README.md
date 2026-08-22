# Teach Me a Game acceptance harness

This harness supports the take-home prototype and deliberately separates **hard behavioral contracts** from **soft learner-experience quality**.

The v11 product question is:

> Can a Grade 3–4 child first experience a clear procedure, then teach Jamie a game, see that explanation become executable, repair a real listener gap, complete one supported replay, and finally teach a fresh listener without Jamie importing an answer key?

The lesson loop is:

**Model → Experience → Real gap → Teach/Repair → Guided replay → Fresh-listener independent replay → Transfer → Complete**

## Current runtime target

`main` keeps the locked v10 runtime as the behavioural fallback. This branch validates the direct v11 target. Intermediate v10.1/v10.2/v10.3 artifacts are architecture references, not deployment gates.

```text
debug.dsl_version = v11
debug.build_id = v11-runtime-first-mastery-gate-r1-20260823
```

`DIFY_EXPECT_BUILD_ID` should be set for the final run so a stale publication cannot produce false behavioral evidence.

## Run the deterministic gates

After importing and publishing the final v11 DSL, run the dedicated full-lesson contract first:

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v11-direct'
export DIFY_EXPECT_DSL_VERSION='v11'
export DIFY_EXPECT_BUILD_ID='v11-runtime-first-mastery-gate-r1-20260823'

node tests/e2e/run-v11-lesson-contract.mjs --verbose
```

This runner is authoritative for the v11 mastery transition. In particular, it deliberately executes two successful guided actions and requires the learner to remain in `practice`; only the subsequently grounded child-taught ending may enter `independent`.

Once that gate passes, run the existing semantic regressions against v11:

```bash
node tests/e2e/run-dify.mjs --version v11 --scenario golden-path-learning-loop
node tests/e2e/run-dify.mjs --version v11 --scenario faithful-listener-not-answer-key
node tests/e2e/run-dify.mjs --version v11 --scenario smart-listener-not-pedantic
```

The older `v11-full-lesson-fresh-listener` entry inside `scenarios.json` was written during the staged prototype and encodes the superseded two-action mastery gate. Do not use it as v11 acceptance evidence; `run-v11-lesson-contract.mjs` replaces that contract while the shared semantic scenarios remain useful regressions.

## What the gates prove

- `run-v11-lesson-contract.mjs` — first real gap earns teaching; repair changes executable reality; ordinary guided actions cannot graduate the learner; one complete grounded guided replay triggers the fresh-listener reset; old listener knowledge and Rule IR cannot authorize a bare `Go ahead`; independent completion reaches transfer; trivial transfer answers do not finish the lesson.
- `golden-path-learning-loop` — progressive world creation, delegated player choice, a genuine post-action gap, child repair, and visible reality change without immediate lecture/reflection.
- `faithful-listener-not-answer-key` — a child-defined rule overrides familiar-game priors.
- `smart-listener-not-pedantic` — normal Grade 3–4 disfluency and self-correction do not manufacture a fake communication failure.
- `repair-locate-not-guess` — optional design-depth evidence.
- `breadth-*` — architecture probes; they should not drive bespoke special-casing before the primary lesson path is credible.

## Hard vs soft

Hard checks affect the exit code. They cover things the product cannot get wrong:

- valid frontend/protocol shape and strict runtime identity;
- no unrecoverable internal pipeline failure masquerading as normal pedagogy;
- no hidden/candidate rules leaking into listener-gap state;
- no untaught gameplay state or logic appearing in the visible world;
- delegated choices such as `any two` execute without unnecessary clarification;
- action targets exist and runtime effects are not pre-applied in `world_patch`;
- child repair applies to the actual current world state;
- child-defined rules outrank familiar-game priors;
- supported v11 transitions are owned by Runtime Primary, with bounded fallback only when needed;
- practice cannot graduate from a count of ordinary actions; one complete grounded guided replay is required;
- the fresh listener cannot use durable student history, old listener facts, or old executable rules as active knowledge;
- `game_complete` is distinct from `lesson_complete`;
- Jamie may not claim a physical move that the validated plan did not authorize.

Soft quality does not fail the deterministic run. Examples include exact wording and general conversational smoothness.

A harness problem must not be converted into a guessed runtime failure, and a provider/runtime problem must not be converted into a learner communication failure.

## v11 lesson semantics

The direct lesson runner enforces these boundaries:

1. The first genuine blocking gap in `experience` earns `teach` and a `teach_moment`.
2. Once the missing information becomes executable, the lesson moves to scaffolded `practice`.
3. Practice may contain any number of successful intermediate actions. **Only a child-grounded `game_complete` with non-empty `completion_evidence` counts as the one successful guided replay.**
4. That completed replay enters `independent`, clears active listener knowledge + executable Rule IR + pending gap state, and resets physical progress to the preserved baseline.
5. Independent has no scaffold. A bare `Go ahead` immediately after reset must produce no game action based on the previous listener's knowledge.
6. A grounded independent game ending enters `transfer`, not `complete`.
7. A trivial response such as `what?` does not complete transfer. A short substantive transfer response can complete the lesson.

The Dify packer has a separate static/micro contract for the reset boundary: when a replay-ending turn contains a final physical action, the browser receives `final action(s) → short wait → reset_to_baseline`, so reset cannot erase the causal evidence before the learner sees it.

## Golden path semantics

`golden-path-learning-loop` intentionally stops after proving the core repair loop; it is not the full lesson test.

1. The child describes a card game with matching pictures. The world may appear provisionally, but gameplay rules may not be invented.
2. The child teaches the face-down setup.
3. The child says `flip any two cards`. Jamie chooses two eligible cards and actually reveals exactly two.
4. Because the child has not yet taught the outcome branch, a grounded post-action listener gap is allowed.
5. The harness inspects the revealed pair and supplies only the branch needed for the state Jamie actually encountered.
6. Jamie immediately applies the repair to the same pair.
7. The old gap is resolved and play continues. A repair may earn internal teaching evidence, but there should be no immediate lesson-summary speech.

Pair identity is derived from visible identity fields such as `symbol` / `caption`, never from a generic label such as `Card`.

## AI full-game smoke

`run-ai-full-game.mjs` is still useful as v10/broad architecture evidence, but its current stop condition is v10-shaped: it stops when the first `game_complete` appears and its final check expects game and lesson completion to coincide. Therefore it must **not** be reported as a v11 full-lesson pass yet.

After the deterministic v11 lesson gate and semantic regressions are green, update that runner to continue through fresh-listener independent teaching and transfer; only then use it as broad v11 evidence.

See [`AI_FULL_GAME.md`](./AI_FULL_GAME.md) for its existing setup and [`LIVE_TRACE.md`](./LIVE_TRACE.md) for crash-safe live logging.

## Optional whole-scenario AI judge

For semantic qualities that do not have one exact correct wording, add `--judge` after deterministic correctness is established:

```bash
export AI_EVAL_API_KEY='...'
export AI_EVAL_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_EVAL_MODEL='your-evaluator-model'

node tests/e2e/run-dify.mjs \
  --version v11 \
  --scenario golden-path-learning-loop \
  --judge
```

The judge is soft-only: its result is saved in the trace but never changes the deterministic exit code.

## Failure categories

The deterministic runner distinguishes:

- **behavior** — a hard learner-facing/protocol contract failed;
- **infra** — provider/network/model configuration failure;
- **runtime** — Dify/workflow returned an unexpected runtime result;
- **harness** — the test cannot make a reliable determination;
- **soft quality signal** — useful interaction feedback that does not fail the run.

Generated artifacts stay under `.artifacts/dify-e2e/` and should not be committed.

The standalone hidden-gap audit can still be run against older traces:

```bash
node tests/e2e/check-internal-gap-leakage.mjs .artifacts/dify-e2e/<trace>.json
```
