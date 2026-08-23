# Teach Me a Game acceptance harness

The active v11 lesson is continuous play: Raku teaches first, the child teaches Raku with a guide, real play exposes genuine gaps, repair changes executable reality, the same game continues while the guide fades, a child-taught ending leads to transfer, and then the lesson completes.

## Current runtime target

```text
debug.dsl_version = v11
debug.build_id = v11-runtime-first-continuous-play-r4-20260823
debug.action_plan._validation.decision_version = 1540-r4-direct-query
```

`main` keeps the locked v10 runtime as the behavioural fallback. Intermediate v10.x migration artifacts and the abandoned fresh-listener lesson are historical only.

## Primary gate

After importing and publishing the r4 DSL:

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v11-continuous-r4'
export DIFY_EXPECT_DSL_VERSION='v11'
export DIFY_EXPECT_BUILD_ID='v11-runtime-first-continuous-play-r4-20260823'

node tests/e2e/run-v11-lesson-contract.mjs --verbose
```

The runner verifies the exact 1540 decision version so a stale selector cannot masquerade as a new packer build.

## Critical gap semantics

A setup/description turn may progress the visible world without giving Raku an executable gameplay action. That is ordinary progressive teaching, not a communication breakdown.

`no_applicable_supported_rule` opens a blocking learner gap only when the current raw query clearly requests execution/continuation (for example `Remove A now`, `Continue`, `Your turn`) or represents a physical world event.

The lesson runner saves the full payload before behavioral assertions, so any failure remains diagnosable.

## Active semantic regressions

```bash
node tests/e2e/run-dify.mjs --version v11 --scenario golden-path-learning-loop
node tests/e2e/run-dify.mjs --version v11 --scenario faithful-listener-not-answer-key
node tests/e2e/run-dify.mjs --version v11 --scenario smart-listener-not-pedantic
```

`repair-locate-not-guess`, breadth probes, Rule IR identity, bounded fallback, ambiguous-target, and runtime-first normal-path tests remain optional/architecture evidence.

The active `scenarios.json` is v11-only. Fresh-listener and staged-migration-only scenarios are not kept in the executable catalog.
