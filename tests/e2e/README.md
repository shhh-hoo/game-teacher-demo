# Teach Me a Game acceptance harness

This harness replays fixed multi-turn child-language scenarios against the currently published Dify app and stores the complete response trace for every turn.

The scenarios are written from the Lesson Card PRD first. The primary question is not whether a particular node emitted a particular JSON shape; it is whether a Grade 3–4 learner gets the intended experience: explain → world forms → Jamie acts → a real communication gap appears → the child repairs it → reality changes → learning can transfer.

Protocol assertions such as atomic actions, delta semantics and baseline capture remain important, but they are implementation safeguards underneath the product behavior.

## Run

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v8'
node tests/e2e/run-dify.mjs
```

Run one scenario to save tokens:

```bash
node tests/e2e/run-dify.mjs --label v8 --scenario experience-clear-enough-to-act
```

List scenarios:

```bash
node tests/e2e/run-dify.mjs --list
```

Repeat a selected scenario when checking nondeterminism:

```bash
node tests/e2e/run-dify.mjs --label v8 --scenario actionable-underspecification --repeat 3
```

Generated traces are written to `.artifacts/dify-e2e/` and should not be committed.

## PRD-first API scenarios

Each scenario in `scenarios.json` contains a `prd` block with the lesson stage, MVP hypothesis, learning purpose and acceptance criteria. The executable assertions are deliberately narrower than the product criteria; anything not yet safe to automate is kept in `manualReview` rather than silently disappearing.

The current core scenarios are:

- `experience-clear-enough-to-act`: progressive world construction and natural action when enough is known.
- `actionable-underspecification`: harmless underspecification may lead to an ordinary player choice or a natural clarification; neither is automatically a learner failure.
- `real-breakdown-repair-teach`: Jamie acts until a real gap, the child repairs it, reality changes, and the resulting Teach Moment should be listener-centered.
- `child-defined-version-over-standard-knowledge`: the child's version wins over familiar-game priors.

Extended probes cover vague repair, messy child speech/self-correction, and relevance/priority of information.

## Manual PRD scenarios

Some essential product requirements are not represented well by the current text-only Dify API harness. They are documented in `prd-manual-scenarios.md` instead of being forced into weak automated checks:

- fresh-listener Independent Performance;
- final Transfer beyond the current game;
- voice ASR vs communication-gap separation;
- the full 8–10 minute learning-loop review.

## What the implementation checks protect

Every API response is still checked for the current frontend action contract and valid object targets. Scenario-specific assertions may also protect:

- no unstated gameplay-rule leakage;
- world-definition vs runtime-action separation;
- baseline capture on the first executable action;
- true delta semantics where relevant;
- no legacy action types such as `reveal`, `collect`, or `switch_turn`;
- natural self-correction;
- non-blocking choice ambiguity;
- child-defined variants.

These checks are evidence for the PRD acceptance criteria, not the test-case purpose by themselves.

## Runtime vs behavior failures

The runner reports behavior failures separately from infrastructure/provider and other runtime errors. This prevents a model-provider outage or missing model configuration from being mistaken for a lesson-design regression.

## Performance metrics

Each successful turn records elapsed time plus Dify prompt/completion/total token usage when available. The final summary prints average seconds and average tokens per successful turn so DSL changes can be compared for both behavior and efficiency.

## Version labels

`DIFY_TEST_VERSION` / `--label` is required. The harness cannot prove which imported or unpublished DSL is selected in the Dify UI, but it refuses anonymous runs so traces cannot silently lose their intended version context.
