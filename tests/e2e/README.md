# Dify E2E regression harness

This harness replays fixed multi-turn child-language scenarios directly against the currently published Dify app and stores the complete response trace for every turn.

It is intentionally API-first. It protects the Dify/frontend protocol before adding browser automation.

## Run

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v7-fixed2'
node tests/e2e/run-dify.mjs
```

Run one scenario:

```bash
node tests/e2e/run-dify.mjs --label v7-fixed2 --scenario matching-pairs-basic
```

List scenarios:

```bash
node tests/e2e/run-dify.mjs --list
```

Repeat each selected scenario several times to expose nondeterministic regressions:

```bash
node tests/e2e/run-dify.mjs --label v7-fixed2 --repeat 3
```

Generated traces are written to `.artifacts/dify-e2e/` and should not be committed.

## What is checked automatically

Every response is checked for the current atomic frontend action contract and valid object targets. Scenario-specific checks protect:

- no leading gameplay-rule leakage from a matching-picture description;
- true delta semantics for `world_patch`;
- world-definition vs runtime-action separation;
- baseline capture on the first executable action;
- no legacy action types such as `reveal`, `collect`, or `switch_turn`;
- natural self-correction (`three—no, sorry, two`);
- non-blocking choice ambiguity: `Flip one card` / `Flip two cards` may either execute the correct number of reveals or ask a natural clarification preserving that count;
- child-defined variants: Jamie may ask about an unspecified branch (`What if they're the same?`) but must not smuggle a candidate rule (`Do I keep them if they're the same?`).

The distinction matters pedagogically: a listener may make an ordinary player choice or ask for clarification when multiple choices are currently equivalent. Neither path is automatically a communication failure. A true blocking gap is different: Jamie cannot safely continue without information that changes legality, state transition, or gameplay meaning.

Some semantics remain manual-review cases, especially whether an executed player choice used hidden information. If Jamie chooses among face-down cards, the choice must not depend on hidden card identity or another unauthorized field.

## Runtime vs behavior failures

The runner reports three categories separately:

- `Behavior failures`: an assertion about lesson/protocol behavior failed.
- `Infra errors`: network/provider/model configuration failures such as `fetch failed` or `Model ... not exist`.
- `Runtime errors`: other harness/Dify runtime failures.

This prevents provider outages or model configuration problems from being mistaken for lesson-design regressions.

## Performance metrics

Each successful turn records elapsed time plus Dify prompt/completion/total token usage when available. The final summary prints average seconds and average tokens per successful turn, so DSL changes can be compared for both behavior and efficiency.

## Version labels

`DIFY_TEST_VERSION` / `--label` is required. The harness cannot prove which unpublished/imported DSL you selected in the Dify UI, but it refuses anonymous runs so traces cannot silently lose their intended version context.
