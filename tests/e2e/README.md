# Teach Me a Game acceptance harness

This harness supports the take-home prototype. It deliberately separates **hard behavioral contracts** from **soft learner-experience quality**.

The primary question is learner-facing: does a Grade 3–4 child experience a believable loop of explain → world forms → Jamie acts → a real communication gap appears → the child repairs it → reality changes?

## Run the deterministic acceptance first

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v8-semantic-slim-v6'
export DIFY_EXPECT_DSL_VERSION='v8-semantic-slim-v6'

node tests/e2e/run-dify.mjs --scenario golden-path-learning-loop
```

`DIFY_TEST_VERSION` is only a trace label. `DIFY_EXPECT_DSL_VERSION` checks the workflow's emitted `debug.dsl_version` so the harness can verify what Dify actually ran.

## Hard vs soft

Hard checks affect the exit code. They cover things the product really cannot get wrong:

- valid frontend/protocol shape and runtime identity;
- no hidden pipeline failure masquerading as pedagogy;
- no candidate game rules leaking into internal listener-gap state;
- no untaught gameplay state/rules appearing in the world;
- `any two` produces exactly two legal reveals;
- a real internal post-action gap exists when the next transition has not been taught;
- the child's repair is applied to the actual revealed pair;
- child-defined house rules override familiar-game priors.

Soft quality signals do **not** fail the run. For example, after Jamie correctly flips two cards and internally reaches a real gap, this reply is acceptable:

```text
Okay, I'll flip these two.
```

An explicit `Now what?` may make the learning mechanism clearer, but its absence is an interaction-quality note rather than a core behavior failure. The trace records this as `quality.listener-gap-visible`.

This distinction prevents stylistic preferences from stopping the scenario before we can test the actual repair.

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

The evaluator is provider-agnostic as long as the endpoint supports an OpenAI-compatible `/chat/completions` request.

The judge runs **once after the whole scenario**, not once per turn. It scores 1–5 on:

- conversational naturalness;
- listener-centered communication;
- child agency;
- grounded repair;
- overall learning-loop coherence.

It also flags serious semantic failures such as answer-key leakage, ignored child rules, or repair that does not change reality.

The AI judge is intentionally **soft only**: its score and notes are saved under `trace.aiEval`, but they never change the process exit code. Deterministic invariants remain the acceptance gate.

If `--judge` is supplied without `AI_EVAL_API_KEY`, `AI_EVAL_BASE_URL`, or `AI_EVAL_MODEL`, the trace reports the evaluator as `skipped` rather than failing the Dify test.

You can also judge an existing saved trace directly:

```bash
node tests/e2e/judge.mjs .artifacts/dify-e2e/<trace>.json
```

The rubric lives in `tests/e2e/judge-rubric.md`.

## Golden path

`golden-path-learning-loop` does not prescribe one exact Jamie sentence.

1. The child says the game has cards with matching pictures. The world may begin visually or stay provisional, but it may not invent gameplay state or rules.
2. The child says the cards start face down. A concrete face-down card world must now exist.
3. The child says `flip any two cards`. `Any two` delegates the ordinary player choice, so Jamie chooses two eligible cards and reveals exactly two.
4. After acting, a grounded internal listener gap must exist if the outcome rule is still missing. Whether Jamie immediately verbalizes that gap is a soft quality signal.
5. The harness inspects the actually revealed pair and supplies only the branch needed for that state.
6. Jamie must immediately apply the child's repair to the same pair.

Pair identity is derived only from visible identity fields such as `symbol` / `caption`, never from a generic label such as `Card`.

## Other probes

Run the two AI-behavior probes after the golden path:

```bash
node tests/e2e/run-dify.mjs --scenario smart-listener-not-pedantic
node tests/e2e/run-dify.mjs --scenario faithful-listener-not-answer-key
```

`smart-listener-not-pedantic` checks that normal Grade 3–4 disfluency does not manufacture a fake learning problem.

`faithful-listener-not-answer-key` gives a currently observable house rule that conflicts with conventional Matching Pairs and verifies that Jamie executes the child's version.

`repair-locate-not-guess` is optional design-depth evidence. The `breadth-*` scenarios are secondary architecture probes and should not drive special-casing before the primary path is credible.

## Failure categories

The runner distinguishes:

- **behavior** — a hard learner-facing/protocol contract failed;
- **infra** — provider/network/model configuration failure;
- **runtime** — Dify/workflow returned an unexpected runtime result;
- **harness** — the test itself cannot make a reliable determination;
- **soft quality signal** — useful interaction feedback that does not fail the run.

A harness error must never be converted into a guessed product failure.

## Output

Every scenario writes:

- `*.json` — complete technical trace, hard assertions, soft quality signals, and optional `aiEval`;
- `*__conversation.txt` — Student/Jamie dialogue for quick review.

Add `--verbose` for detailed terminal diagnostics. Generated artifacts stay under `.artifacts/dify-e2e/` and should not be committed.

The standalone hidden-gap audit can also be run against older traces:

```bash
node tests/e2e/check-internal-gap-leakage.mjs .artifacts/dify-e2e/<trace>.json
```
