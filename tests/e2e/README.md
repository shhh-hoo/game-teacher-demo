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

Every response is checked for the current atomic frontend action contract and valid object targets. Scenario-specific checks currently protect:

- no leading gameplay-rule leakage from a matching-picture description;
- one-card vs two-card atomic reveal counts;
- self-correction (`three—no, sorry, two`);
- true delta semantics for `world_patch`;
- world-definition vs runtime-action separation;
- baseline capture on the first executable action;
- no legacy action types such as `reveal`, `collect`, or `switch_turn`.

Some semantics remain manual-review cases for now (for example, whether a child-defined variant is respected and whether hidden information influenced which face-down cards Jamie selected). The raw trace is preserved so those can later become stronger automated assertions.

## Version labels

`DIFY_TEST_VERSION` / `--label` is required. The harness cannot prove which unpublished/imported DSL you selected in the Dify UI, but it refuses anonymous runs so traces cannot silently lose their intended version context.
