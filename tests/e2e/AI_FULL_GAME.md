# AI full-game smoke — V12

`run-ai-full-game.mjs` provides broad evidence for the final integrated game task while still exercising the full V12 lesson entry path.

Before the AI child starts teaching its game, the runner completes the same two foundation tasks as the browser:

1. Follow Raku to reproduce a hidden target, including one under-specified direction and repair.
2. Reverse roles and guide Raku to a new target, including a real ambiguous placement and correction.
3. Select `Another simple game` without injecting any rules.

Only then does the AI child start teaching one small original game.

## Learner-authority contract

The generated game specification is **only a private creative seed for the simulated AI child**. It is not product truth, not an answer key, and not runtime input for Raku.

Once the child says something in the conversation, that utterance is the authoritative game evidence available to Raku. A later explicit child correction overrides an earlier child statement. AI-inferred layout, quantities, identities, and presentation remain provisional and must not become facts that the child has to satisfy.

The seed may remain in raw trace metadata for debugging the AI-child generator, but `judge.mjs` deliberately removes it before learner-experience evaluation. The evaluator must judge only the child transcript, Raku replies, validated actions, visible world, repair behavior, and grounded completion.

## Pass contract

The run passes only when:

- the V12 foundation tasks complete successfully;
- the learner-authored game reaches a grounded ending based on what the child actually taught;
- grounded `completion_evidence` is non-empty;
- the lesson continues through `transfer` to `phase=complete`;
- no pending listener gap remains;
- no `pipeline_errors` occurred;
- Raku never claims a physical action absent from executable `ui_action`.

## Runtime identity

```bash
export DIFY_TEST_VERSION='v12-r23'
export DIFY_EXPECT_DSL_VERSION='v12'
```

Expected build:

```text
v12-listener-reconstruction-game-r23-learner-authority-20260823
```

## Run directly against Dify

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v12-r23'
export DIFY_EXPECT_DSL_VERSION='v12'

export AI_FULL_GAME_API_KEY='...'
export AI_FULL_GAME_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_FULL_GAME_MODEL='your-model'

node tests/e2e/run-ai-full-game.mjs --verbose
```

## Run through the deployed proxy

```bash
export GAME_TEACHER_PROXY_URL='https://game-teacher-demo.vercel.app/api/chat'
export DIFY_TEST_VERSION='v12-r23'
export DIFY_EXPECT_DSL_VERSION='v12'

export AI_FULL_GAME_API_KEY='...'
export AI_FULL_GAME_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_FULL_GAME_MODEL='your-model'

node tests/e2e/run-ai-full-game.mjs --verbose
```

The default final-game budget remains 14 AI-child turns. Foundation turns are recorded separately and do not consume that budget.

Use `--keep-going` only for deliberate diagnostics after a hard failure. Rolling JSON, live JSONL, and conversation artifacts are written under `.artifacts/dify-e2e/` from the beginning of the run.
