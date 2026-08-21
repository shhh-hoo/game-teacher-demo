# Teach Me a Game acceptance harness

This harness exists to support the take-home prototype, not to prove that the project is a production-grade game engine.

The demo has three jobs:

1. show that the product idea in the PRD is credible;
2. show why AI is useful in this learning experience;
3. show that the idea can be prototyped into a coherent student-facing interaction.

The primary question is therefore learner-facing: does a Grade 3–4 child experience a believable loop of explain → world forms → Jamie acts → a real communication gap appears → Notice & Teach → repair changes reality → guided play resumes? Protocol checks remain underneath that product behavior as smoke tests.

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

The `breadth-*` scenarios are secondary architecture probes. Do not optimize the take-home around them before the learner-facing golden path is credible.

List scenarios:

```bash
node tests/e2e/run-dify.mjs --list
```

## Output

Default terminal output is intentionally concise. It shows only turn status, short failure/error summaries, artifact paths, and one overall performance summary. Provider HTML error pages and full raw responses stay in the JSON trace instead of flooding the terminal.

For detailed terminal diagnostics, add:

```bash
--verbose
```

Every scenario writes two artifacts under `.artifacts/dify-e2e/`:

- `*.json` — complete technical trace for debugging and review;
- `*__conversation.txt` — only the Student/Jamie dialogue, ready to copy into the take-home as an example.

When exactly one scenario is run, the same clean conversation is also printed at the very end of the terminal output.

Generated artifacts should not be committed.

## What the three must-run scenarios prove

### 1. `golden-path-learning-loop`

This is the actual demo acceptance path, not a card-animation smoke test.

The scripted learner now explicitly supplies the gameplay-relevant setup: six cards, with every picture appearing exactly twice. AI may choose harmless symbols or layout, but the test no longer asks AI to invent an unspecified card count just to make the world render.

The intended path is:

child describes concrete setup → world forms → child teaches one executable move → Jamie flips exactly two cards → Jamie reaches the first genuine missing outcome rule → the lesson enters Notice & Teach → the child supplies the missing matching/non-matching branches → Jamie immediately applies the correct branch to the currently revealed cards → guided practice resumes.

The automated assertions deliberately check learner-facing state, not only protocol mechanics:

- exactly six visible game objects after the learner supplies six cards;
- all six cards become face down when the learner teaches setup;
- exactly two cards are revealed for the taught move;
- the first genuine blockage moves the frontend to `phase=teach`;
- `support.type=teach_moment`, with `focus=completeness` and a non-empty listener gap;
- Jamie's dialogue must naturally expose that it does not know the next step, without proposing a candidate Matching Pairs rule;
- after the child teaches both outcome branches, Jamie must either remove the matching pair or hide the non-matching pair, depending on the actual revealed cards;
- the repaired turn must move the lesson into `phase=practice`.

This path is the most important evidence for H1 and H2. If it does not feel like a plausible learning interaction, passing lower-level protocol assertions does not make the prototype successful.

### 2. `smart-listener-not-pedantic`

This shows one side of the AI value proposition: Jamie can understand messy, age-appropriate speech and self-correction without manufacturing fake learning problems. Normal child language should not be treated as a bad answer simply because it is not formally complete.

Jamie may make an ordinary player choice or ask a natural clarification when the ambiguity is non-blocking.

The setup also explicitly supplies six cards so this probe does not depend on the model inventing an arbitrary game size.

### 3. `faithful-listener-not-answer-key`

This shows the other side of the AI value proposition: the model may know the familiar game from pretraining, but the product deliberately constrains it to the child's explanation. The child's version of the game wins over a canonical answer key.

Together, scenarios 2 and 3 support the central AI design claim: Jamie should be smart enough to understand a child, but constrained enough to behave like the listener the child is actually teaching.

## Optional depth probe

`repair-locate-not-guess` demonstrates the global Notice → Locate → Repair design. When the child only says “No, that's wrong,” Jamie should help locate the mismatch rather than guess the intended rule. It is useful evidence of interaction-design depth, but it is not required before the take-home demo is credible.

Its setup likewise supplies a concrete six-card world rather than relying on AI to invent an unspecified card count.

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

The harness also supports product-facing expectations such as exact object counts, phase transitions, teaching-support type/focus, a grounded listener gap, natural positive dialogue evidence, and one-of action branches when the correct physical result depends on the current world state.

These checks are evidence underneath the demo, not the reason the demo exists.

## Runtime and performance

The runner separates behavior failures from infrastructure/provider and other runtime errors. It also records latency and token usage so obvious prototype-performance problems remain visible without becoming the central success criterion.

## Version labels

`DIFY_TEST_VERSION` / `--label` is required. The harness cannot prove which imported or unpublished DSL is selected in the Dify UI, but it refuses anonymous runs so traces retain their intended version context.
