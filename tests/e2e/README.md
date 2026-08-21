# Teach Me a Game acceptance harness

This harness exists to support the take-home prototype, not to prove that the project is a production-grade game engine.

The demo has three jobs:

1. show that the product idea in the PRD is credible;
2. show why AI is useful in this learning experience;
3. show that the idea can be prototyped into a coherent student-facing interaction.

The primary question is therefore learner-facing: does a Grade 3–4 child experience a believable loop of explain → world forms → Jamie acts → a real communication gap appears → repair changes reality → learning becomes explicit? Protocol checks remain underneath that product behavior as smoke tests.

## Run

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v8'
```

The recommended first run is the single golden path:

```bash
node tests/e2e/run-dify.mjs --label v8 --scenario golden-path-learning-loop
```

Only after that path looks like the intended Lesson Card should the two AI-behavior probes be run:

```bash
node tests/e2e/run-dify.mjs --label v8 --scenario smart-listener-not-pedantic
node tests/e2e/run-dify.mjs --label v8 --scenario faithful-listener-not-answer-key
```

The repair probe is optional:

```bash
node tests/e2e/run-dify.mjs --label v8 --scenario repair-locate-not-guess
```

List scenarios:

```bash
node tests/e2e/run-dify.mjs --list
```

Generated traces are written to `.artifacts/dify-e2e/` and should not be committed.

## What the three must-run scenarios prove

### 1. `golden-path-learning-loop`

This is the actual demo acceptance path. It should make the core product mechanism visible in a few turns:

child explains → progressive world forms → Jamie can act → Jamie reaches a real missing next step → child repairs the explanation → reality changes → a short listener-centered Teach Moment can occur.

This path is the most important evidence for H1 and H2. If it does not feel like a plausible learning interaction, passing lower-level protocol assertions does not make the prototype successful.

### 2. `smart-listener-not-pedantic`

This shows one side of the AI value proposition: Jamie can understand messy, age-appropriate speech and self-correction without manufacturing fake learning problems. Normal child language should not be treated as a bad answer simply because it is not formally complete.

Jamie may make an ordinary player choice or ask a natural clarification when the ambiguity is non-blocking.

### 3. `faithful-listener-not-answer-key`

This shows the other side of the AI value proposition: the model may know the familiar game from pretraining, but the product deliberately constrains it to the child's explanation. The child's version of the game wins over a canonical answer key.

Together, scenarios 2 and 3 support the central AI design claim: Jamie should be smart enough to understand a child, but constrained enough to behave like the listener the child is actually teaching.

## Optional depth probe

`repair-locate-not-guess` demonstrates the global Notice → Locate → Repair design. When the child only says “No, that's wrong,” Jamie should help locate the mismatch rather than guess the intended rule. It is useful evidence of interaction-design depth, but it is not required before the take-home demo is credible.

## Manual PRD acceptance

Some important PRD requirements are intentionally not forced into this text-only API harness. They remain in `prd-manual-scenarios.md`:

- fresh-listener Independent Performance;
- final Transfer beyond the current game;
- voice ASR vs communication-gap separation;
- the full 8–10 minute Lesson review.

These belong in the design story even if the take-home prototype does not implement all of them completely.

## Implementation smoke checks

The runner still protects obvious technical contradictions where they directly damage the learner experience, including:

- unsupported or legacy action types;
- actions targeting missing objects;
- runtime actions being pre-applied in `world_patch`;
- a clarification question while the world has already silently made the supposedly unresolved choice;
- obvious unstated gameplay-rule leakage;
- basic baseline/action consistency.

These checks are evidence underneath the demo, not the reason the demo exists.

## Runtime and performance

The runner separates behavior failures from infrastructure/provider and other runtime errors. It also records latency and token usage so obvious prototype-performance problems remain visible without becoming the central success criterion.

## Version labels

`DIFY_TEST_VERSION` / `--label` is required. The harness cannot prove which imported or unpublished DSL is selected in the Dify UI, but it refuses anonymous runs so traces retain their intended version context.
