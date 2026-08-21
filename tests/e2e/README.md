# Teach Me a Game acceptance harness

This harness exists to support the take-home prototype, not to prove that the project is a production-grade game engine.

The demo has three jobs:

1. show that the product idea in the PRD is credible;
2. show why AI is useful in this learning experience;
3. show that the idea can be prototyped into a coherent student-facing interaction.

The primary question is learner-facing: does a Grade 3–4 child experience a believable loop of explain → world forms → Jamie acts → a real communication gap appears → the child repairs it → reality changes → a short listener-centered reflection can return the child to play? Protocol checks sit underneath that product behavior as safeguards.

## Run

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v8'
```

Run the golden path first:

```bash
node tests/e2e/run-dify.mjs --label v8 --scenario golden-path-learning-loop
```

Then run the two AI-behavior probes:

```bash
node tests/e2e/run-dify.mjs --label v8 --scenario smart-listener-not-pedantic
node tests/e2e/run-dify.mjs --label v8 --scenario faithful-listener-not-answer-key
```

The repair-depth probe is optional:

```bash
node tests/e2e/run-dify.mjs --label v8 --scenario repair-locate-not-guess
```

The `breadth-*` scenarios are secondary architecture probes. Do not optimize the take-home around them before the learner-facing golden path is credible.

List scenarios:

```bash
node tests/e2e/run-dify.mjs --list
```

## Output

Default terminal output is concise. Full Dify responses and assertion details remain in the JSON trace.

Add `--verbose` for more terminal diagnostics.

Every scenario writes two artifacts under `.artifacts/dify-e2e/`:

- `*.json` — complete technical trace;
- `*__conversation.txt` — Student/Jamie dialogue for quick learner-experience review.

Generated artifacts should not be committed.

## What the three must-run scenarios prove

### 1. `golden-path-learning-loop`

This is the primary demo acceptance path.

The intended path is:

1. The child says the game has cards with matching pictures. The AI may begin a harmless visual representation or leave the world provisional, but it may not invent gameplay state or rules.
2. The child says the cards start face down. By this point a concrete face-down card world must exist.
3. The child says `flip any two cards`. The phrase `any two` already delegates the ordinary player choice, so Jamie chooses two eligible cards and reveals exactly two.
4. After acting, Jamie reaches the genuinely missing outcome rule. The gap must remain open and non-leading rather than being filled from familiar-game knowledge.
5. The harness inspects the actually revealed pair and supplies only the child repair relevant to that branch: match or non-match.
6. Jamie immediately applies that repair to the same visible pair.

The test deliberately does **not** require:

- cards to appear on the first turn;
- a fixed inferred card count;
- a particular internal `phase` or `support.type`;
- one exact sentence such as `What happens now?`;
- the child to explain both outcome branches when only one has been encountered.

The learner-facing behavior is the contract. Internal debug state is used only where it helps diagnose whether that behavior came from a real grounded gap rather than a lucky sentence.

### 2. `smart-listener-not-pedantic`

This proves that Jamie can understand normal Grade 3–4 disfluency and self-correction without manufacturing fake learning problems.

`Flip three—no, sorry, two of them` should resolve to two. Because the child did not say `any two`, Jamie may either make an ordinary choice among equivalent eligible cards or ask a natural `Which two?` clarification. Neither path is automatically a communication failure.

### 3. `faithful-listener-not-answer-key`

This proves that the model's pretrained knowledge of a familiar game does not override the child's version. Jamie may ask about an unstated branch, but must not smuggle a candidate rule into the question or correct the child toward a conventional rulebook.

Together, scenarios 2 and 3 support the central AI design claim: Jamie should be smart enough to understand a child, but constrained enough to remain the listener the child is actually teaching.

## Optional depth and breadth

`repair-locate-not-guess` probes global repair after a vague rejection. It is useful design-depth evidence but is not required before the primary demo path is credible.

The `breadth-*` scenarios probe whether the same listener/world abstraction transfers to structurally different games without game-specific prompting. They should reveal architecture limits, not trigger special-casing.

## Manual PRD acceptance

Some important PRD requirements remain better suited to manual review than to the text-only API harness:

- fresh-listener Independent Performance;
- final Transfer beyond the current game;
- voice ASR vs communication-gap separation;
- the full 8–10 minute lesson experience.

## Implementation safeguards

The runner also protects technical contradictions that directly damage the learner experience, including:

- unsupported or legacy action types;
- actions targeting missing objects;
- runtime actions being pre-applied in `world_patch`;
- a clarification while the world has already silently made the supposedly unresolved choice;
- malformed planner/debug shapes;
- internal pipeline errors being disguised as normal pedagogy;
- obvious unstated gameplay-rule leakage.

These checks are evidence underneath the demo, not the reason the demo exists.

## Runtime and performance

The runner separates behavior failures from infrastructure/provider and other runtime errors. It records latency and token usage so performance regressions stay visible while behavior remains the primary acceptance criterion.

## Version labels

`DIFY_TEST_VERSION` / `--label` is required so traces are not anonymous. The label is supplied by the test runner; by itself it does **not** prove which DSL is actually published in Dify. Runtime identity should eventually also be emitted by the workflow itself in debug output.
