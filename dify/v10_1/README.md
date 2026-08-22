# v10.1 — Executable Rule IR Shadow

This stage compiles child-taught semantics into a validated shadow rule model while the existing v10 Action Planner remains behavior-authoritative.

## Durable contract

Every response from the candidate emits:

```text
debug.dsl_version = v10.1
debug.build_id = v10.1-rule-ir-shadow-r1-20260822
debug.action_source = legacy_planner
debug.rule_ir_shadow.schema_version = v10.1-shadow-1
```

`debug.rule_ir_shadow` contains compile status, full bounded rule state, the current delta, unsupported semantics, and compiler errors. Rules require student provenance and typed effects. A correction using the same grounded `semantic_key` marks the old active rule `superseded` and adds the replacement.

The shadow is not an answer key and does not control actions. Compiler failure preserves prior shadow state and does not become a learner communication gap.

## Build the local artifact

PyYAML is required. The source export and generated output are deployment artifacts and must not be committed.

```bash
python3 scripts/build-v10-1-rule-ir-shadow.py \
  /path/to/gakku-game-teacher-v10-semantic-core-no-thinking-r4-deepseek-0.0.20.yml \
  .artifacts/dify-local/gakku-game-teacher-v10.1-rule-ir-shadow-r1.yml
```

The patcher refuses a baseline where any existing LLM node is not explicitly `thinking=false`.

## Static preflight

```bash
python3 tests/e2e/preflight-dsl.py \
  .artifacts/dify-local/gakku-game-teacher-v10.1-rule-ir-shadow-r1.yml \
  --expect-dsl-version v10.1 \
  --expect-build-id v10.1-rule-ir-shadow-r1-20260822 \
  --require-rule-ir-shadow
```

The preflight parses the DSL, validates graph and variable references, parses Code node source, checks runtime identity markers, and requires `thinking=false` on every LLM node.

## Live acceptance after import/publish

```bash
export DIFY_TEST_VERSION='v10.1-rule-ir-shadow-r1'
export DIFY_EXPECT_DSL_VERSION='v10.1'
export DIFY_EXPECT_RULE_IR_SHADOW='1'

node tests/e2e/run-dify.mjs --scenario golden-path-learning-loop
node tests/e2e/run-dify.mjs --scenario faithful-listener-not-answer-key
node tests/e2e/run-dify.mjs --scenario smart-listener-not-pedantic
```

The opt-in flag makes missing, malformed, ungrounded, or failed Rule IR telemetry a hard architecture failure without weakening existing behavioral assertions.
