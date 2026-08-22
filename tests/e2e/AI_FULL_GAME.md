# AI full-game smoke

`run-ai-full-game.mjs` checks whether an unscripted child-teaches-game interaction can reach a grounded game ending.

Unlike `scenarios.json`, this is intentionally not a fixed transcript. An OpenAI-compatible model first invents one small original game that fits the current renderer/action vocabulary, then acts as the child turn by turn. It sees Jamie's learner-facing reply plus the current visible world, but Jamie never sees the hidden game specification.

The smoke passes only when the interaction reaches all of these conditions within the turn budget:

- `debug.game_complete === true` (or controller equivalent);
- `phase === "complete"`;
- `completion_evidence` is non-empty;
- `pending_gap === null`;
- no `pipeline_errors` occurred anywhere in the run.

The AI child is told not to declare victory just to force completion. The child must teach an observable ending condition before the world reaches it.

## Run against Dify directly

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v10-thinking-planner'
export DIFY_EXPECT_DSL_VERSION='v10'

export AI_FULL_GAME_API_KEY='...'
export AI_FULL_GAME_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_FULL_GAME_MODEL='your-model'

node tests/e2e/run-ai-full-game.mjs --verbose
```

`AI_FULL_GAME_*` may be omitted when `AI_EVAL_API_KEY`, `AI_EVAL_BASE_URL`, and `AI_EVAL_MODEL` are already set; the runner reuses them.

## Run against the deployed frontend proxy

This avoids putting the Dify app key in the local shell and tests the same `/api/chat` proxy used by the browser:

```bash
export GAME_TEACHER_PROXY_URL='https://game-teacher-demo.vercel.app/api/chat'
export DIFY_TEST_VERSION='v10-thinking-planner'
export DIFY_EXPECT_DSL_VERSION='v10'

export AI_FULL_GAME_API_KEY='...'
export AI_FULL_GAME_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_FULL_GAME_MODEL='your-model'

node tests/e2e/run-ai-full-game.mjs --verbose
```

The default cap is 14 child turns. Override it with `--max-turns 18` or `FULL_GAME_MAX_TURNS=18` when investigating a longer run.

## Output

Each run writes both files under `.artifacts/dify-e2e/`:

- `*__ai-full-game.json` — full game specification, per-turn payload/debug/world state, completion result, and hard failures;
- `*__ai-full-game__conversation.txt` — concise Student/Jamie transcript.

This smoke is deliberately broad evidence, not a replacement for deterministic regression scenarios. A random failure should be inspected before changing the DSL; only a learner-facing semantic failure that reproduces or clearly violates the product contract should drive a prompt/runtime change.
