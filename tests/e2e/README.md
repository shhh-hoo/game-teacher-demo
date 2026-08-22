# Teach Me a Game acceptance harness

This harness supports the take-home prototype and deliberately separates **hard behavioral contracts** from **soft learner-experience quality**.

The current product question is:

> Can a Grade 3–4 child explain a game, see that explanation become executable, encounter a real listener gap, repair it, continue playing, and eventually reach a child-taught ending without Jamie importing an answer key?

The core loop is:

**Explain → Act → Encounter gap → Repair → Reality changes → Continue → Grounded ending**

## Current runtime target

The staged DSL scenarios use `versions` tags for `v10.1`, `v10.2`, `v10.3`, and `v11`. Select one version without splitting the scenario catalog:

```bash
node tests/e2e/run-dify.mjs --version v10.3
```

`DIFY_TEST_VERSION` remains a human trace label. `DIFY_EXPECT_DSL_VERSION` checks what the published Dify runtime actually emitted.

The current deployment baselines are the four formal filenames under `.artifacts/dify-deliverables/`. They contain the audited `*-fixed.yml` work; do not import an older generated copy or keep a parallel `-fixed` artifact in the repo.

## Run the deterministic regressions

After importing and publishing the fixed v10.1 DSL, run only the golden path first:

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v10.1-fixed-local'
export DIFY_EXPECT_DSL_VERSION='v10.1'
export DIFY_EXPECT_BUILD_ID='v10.1-rule-ir-shadow-fixed-20260823'

node tests/e2e/run-dify.mjs \
  --version v10.1 \
  --scenario golden-path-learning-loop \
  --verbose
```

Treat assertions as valid only if Dify returned a frontend response payload and its `debug.dsl_version` is `v10.1` (the runner enforces this when `DIFY_EXPECT_DSL_VERSION` is set). The expected fixed build is `v10.1-rule-ir-shadow-fixed-20260823`. If turn 1 still returns HTTP 500, investigate the Dify import/runtime/schema failure before running more scenarios or changing teaching behavior.

Once that gate passes, the other existing regressions can be selected in the same way:

```bash
node tests/e2e/run-dify.mjs --version v10.1 --scenario faithful-listener-not-answer-key
node tests/e2e/run-dify.mjs --version v10.1 --scenario smart-listener-not-pedantic
```

The three scenarios have different jobs:

- `golden-path-learning-loop` — prove progressive world creation, delegated player choice, a genuine post-action gap, child repair, and visible reality change without immediate lecture/reflection.
- `faithful-listener-not-answer-key` — prove that a child-defined rule overrides familiar-game priors.
- `smart-listener-not-pedantic` — prove that normal Grade 3–4 disfluency and self-correction do not manufacture a fake communication failure.

`repair-locate-not-guess` is optional design-depth evidence. `breadth-*` scenarios remain architecture probes and should not drive bespoke special-casing before the primary path is credible.

## Hard vs soft

Hard checks affect the exit code. They cover things the product cannot get wrong:

- valid frontend/protocol shape and strict runtime identity;
- no unrecoverable internal pipeline failure masquerading as normal pedagogy;
- no hidden/candidate rules leaking into listener-gap state;
- no untaught gameplay state or logic appearing in the visible world;
- delegated choices such as `any two` execute without unnecessary clarification;
- action targets exist and runtime effects are not pre-applied in `world_patch`;
- a genuine missing transition may coexist with an action that is executable now;
- child repair applies to the actual current world state;
- child-defined rules outrank familiar-game priors;
- Jamie may not claim a physical move that the validated plan did not authorize.

Soft quality does not fail the deterministic run. Examples include exact wording, whether Jamie says `Now what?` on every appropriate turn, and general conversational smoothness.

A harness problem must not be converted into a guessed runtime failure, and a provider/runtime problem must not be converted into a learner communication failure.

## Golden path semantics

`golden-path-learning-loop` intentionally stops after proving the core repair loop; it is not the full-game completion test.

1. The child describes a card game with matching pictures. The world may appear provisionally, but gameplay rules may not be invented.
2. The child teaches the face-down setup.
3. The child says `flip any two cards`. Jamie chooses two eligible cards and actually reveals exactly two.
4. Because the child has not yet taught the outcome branch, a grounded post-action listener gap is allowed.
5. The harness inspects the revealed pair and supplies only the branch needed for the state Jamie actually encountered.
6. Jamie immediately applies the repair to the same pair.
7. The old gap is resolved and play continues. A repair may earn an internal reflection candidate, but there should be no immediate lesson-summary speech.

Pair identity is derived from visible identity fields such as `symbol` / `caption`, never from a generic label such as `Card`.

## Grounded completion: AI full-game smoke

Use [`run-ai-full-game.mjs`](./run-ai-full-game.mjs) to test whether the same architecture can finish an unscripted original game rather than only a fixed regression transcript.

```bash
export DIFY_TEST_VERSION='v10-r4'
export DIFY_EXPECT_DSL_VERSION='v10'

export GAME_TEACHER_PROXY_URL='https://game-teacher-demo.vercel.app/api/chat'
export AI_FULL_GAME_API_KEY='...'
export AI_FULL_GAME_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_FULL_GAME_MODEL='your-model'

node tests/e2e/run-ai-full-game.mjs --verbose
```

The full-game smoke passes only when:

- `game_complete=true`;
- `phase=complete`;
- `completion_evidence` is non-empty;
- `pending_gap=null`;
- no `pipeline_errors` occurred in the run.

The current no-thinking v10 r4 runtime has passed this smoke on an AI-generated original game, including visible state progression and a grounded child-taught ending. This is broad smoke evidence, not proof of production-ready arbitrary-game breadth.

See [`AI_FULL_GAME.md`](./AI_FULL_GAME.md) for setup and [`LIVE_TRACE.md`](./LIVE_TRACE.md) for crash-safe live logging.

## Optional whole-scenario AI judge

For semantic qualities that do not have one exact correct wording, add `--judge`:

```bash
export AI_EVAL_API_KEY='...'
export AI_EVAL_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_EVAL_MODEL='your-evaluator-model'

node tests/e2e/run-dify.mjs \
  --scenario golden-path-learning-loop \
  --judge
```

The judge runs once after the complete deterministic scenario and scores:

- conversational naturalness;
- listener-centered communication;
- child agency;
- grounded repair;
- overall loop coherence.

It is intentionally soft-only: its result is saved in the trace but never changes the deterministic exit code.

## Failure categories

The deterministic runner distinguishes:

- **behavior** — a hard learner-facing/protocol contract failed;
- **infra** — provider/network/model configuration failure;
- **runtime** — Dify/workflow returned an unexpected runtime result;
- **harness** — the test cannot make a reliable determination;
- **soft quality signal** — useful interaction feedback that does not fail the run.

The AI full-game runner additionally fails fast by default on pipeline errors or phantom physical-action claims because either already makes the hard full-game acceptance impossible. Use `--keep-going` only when deliberately collecting more diagnostic behavior.

## Output

Deterministic scenarios write:

- `*.json` — complete technical trace, hard assertions, soft quality signals, and optional `aiEval`;
- `*__conversation.txt` — Student/Jamie dialogue for quick review.

AI full-game runs maintain three files from the beginning of the run:

- `*__ai-full-game.json` — rolling full snapshot;
- `*__ai-full-game__live.jsonl` — append-only event stream for live/crash-safe inspection;
- `*__ai-full-game__conversation.txt` — concise conversation appended per completed turn.

Generated artifacts stay under `.artifacts/dify-e2e/` and should not be committed.

The standalone hidden-gap audit can still be run against older traces:

```bash
node tests/e2e/check-internal-gap-leakage.mjs .artifacts/dify-e2e/<trace>.json
```
