# Teach Me a Game acceptance harness

This harness exists to support the take-home prototype, not to prove that the project is a production-grade game engine.

The primary question is learner-facing: does a Grade 3–4 child experience a believable loop of explain → world forms → Jamie acts → a real communication gap appears → the child repairs it → reality changes → a short listener-centered reflection can return the child to play?

Protocol checks sit underneath that product behavior as safeguards.

## Run

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v8'
node tests/e2e/run-dify.mjs --scenario golden-path-learning-loop
```

`DIFY_TEST_VERSION` is only a trace label. It does not prove which workflow is actually published in Dify.

For DSLs that emit `debug.dsl_version`, enable strict runtime-identity checking:

```bash
export DIFY_EXPECT_DSL_VERSION='v8-semantic-slim-v5'
node tests/e2e/run-dify.mjs --scenario golden-path-learning-loop
```

Run the two AI-behavior probes after the golden path:

```bash
node tests/e2e/run-dify.mjs --scenario smart-listener-not-pedantic
node tests/e2e/run-dify.mjs --scenario faithful-listener-not-answer-key
```

`repair-locate-not-guess` is optional design-depth evidence. The `breadth-*` scenarios are secondary architecture probes and should not drive special-casing before the primary lesson path is credible.

## Failure categories

The runner separates four categories:

- **behavior** — the learner-facing or protocol assertion failed;
- **infra** — provider/network/model configuration failure;
- **runtime** — Dify/workflow returned an unexpected runtime result;
- **harness** — the test itself cannot make a reliable determination, for example because a state-dependent repair requires pair identity but the rendered cards expose no usable `symbol` or `caption`.

A harness error must never be silently converted into a product failure or a guessed answer.

## Golden path

`golden-path-learning-loop` intentionally does not prescribe one exact implementation or one exact Jamie sentence.

1. The child says the game has cards with matching pictures. The world may begin visually or stay provisional. It may not invent face-down/up state, readiness, actions, scoring, win logic, or another gameplay fact.
2. The child says the cards start face down. A concrete face-down world must now exist.
3. The child says `flip any two cards`. `Any two` already delegates the ordinary player choice, so Jamie chooses two eligible cards and reveals exactly two.
4. After acting, Jamie must both **have** a grounded post-action listener gap internally and **expose** that gap to the child in the learner-facing reply. An internal debug gap with a reply such as only `Okay, I'll flip these two` is not sufficient.
5. The harness inspects the actually revealed pair and supplies only the branch the child needs to repair. Pair identity is derived from actual visible identity fields (`symbol` / `caption`), never from a generic label such as `Card`.
6. Jamie immediately applies that repair to the same pair.

The test does not require:

- cards to appear on turn 1;
- a fixed inferred card count;
- a particular `phase` or `support.type`;
- one exact phrase such as `What happens now?`;
- the child to explain both outcome branches when only one has been encountered.

## AI-behavior probes

### `smart-listener-not-pedantic`

`Flip three—no, sorry, two of them` must resolve to two. Because the child did not say `any two`, Jamie may either make an ordinary choice among equivalent eligible cards or ask a natural `Which two?` clarification. Normal child disfluency is not itself a communication failure.

### `faithful-listener-not-answer-key`

After Jamie reveals a pair, the harness creates a child-defined house rule that is immediately observable and intentionally conflicts with conventional Matching Pairs:

- matching pair → child says to turn both face down again;
- non-matching pair → child says to take both out.

Jamie must execute the child's version rather than restoring a canonical rulebook.

## Output

Every scenario writes:

- `*.json` — complete technical trace, including reconstructed world state and failure classification;
- `*__conversation.txt` — Student/Jamie dialogue for quick learner-experience review.

Add `--verbose` for detailed terminal diagnostics. Generated artifacts stay under `.artifacts/dify-e2e/` and should not be committed.

## Manual PRD acceptance

Some important requirements remain better suited to manual review than to this text-only API harness:

- fresh-listener Independent Performance;
- final Transfer beyond the current game;
- voice ASR vs communication-gap separation;
- the full 8–10 minute lesson experience.

## Implementation safeguards

The runner also protects contradictions that directly damage the learner experience, including:

- unsupported or legacy action types;
- actions targeting missing objects;
- runtime actions being pre-applied in `world_patch`;
- a clarification while the world has already silently made the unresolved choice;
- malformed planner/debug shapes;
- internal pipeline errors being disguised as normal pedagogy;
- visible-world or dialogue leakage of unstated gameplay logic.

These checks are evidence underneath the demo, not the reason the demo exists.
