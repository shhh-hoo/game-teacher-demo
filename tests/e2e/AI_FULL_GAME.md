# AI full-game smoke

`run-ai-full-game.mjs` checks whether an unscripted child-teaches-game interaction can reach a grounded game ending.

Unlike `scenarios.json`, this is intentionally not a fixed transcript. An OpenAI-compatible model first invents one small original game that fits the current renderer/action vocabulary, then acts as the child turn by turn. It sees Jamie's learner-facing reply plus the current visible world, but Jamie never sees the hidden game specification.

The smoke is broad product evidence, not a replacement for deterministic regression scenarios.

## Pass contract

A run passes only when all of the following are true within the turn budget:

- `debug.game_complete === true` (or controller equivalent);
- `phase === "complete"`;
- `completion_evidence` is non-empty;
- `pending_gap === null`;
- no `pipeline_errors` occurred anywhere in the run.

The AI child is explicitly told not to declare victory merely to force completion. It must teach an observable ending condition before the world reaches it, and the world must actually satisfy that condition.

The runner also treats a learner-facing **phantom physical action** as a hard failure: if Jamie claims that it flipped, moved, removed, collected, or otherwise changed a game object while `ui_action` contains no executable physical action, the run should not continue as though play succeeded.

## Current runtime label

The current validated candidate is the no-thinking v10 r4 runtime:

```text
debug.dsl_version = v10
debug.build_id = v10-no-thinking-r4-20260822
```

Use:

```bash
export DIFY_TEST_VERSION='v10-r4'
export DIFY_EXPECT_DSL_VERSION='v10'
```

`DIFY_TEST_VERSION` is only the local artifact label. Strict runtime identity comes from `debug.dsl_version` / `build_id` in the returned payload.

## Run against Dify directly

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v10-r4'
export DIFY_EXPECT_DSL_VERSION='v10'

export AI_FULL_GAME_API_KEY='...'
export AI_FULL_GAME_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_FULL_GAME_MODEL='your-model'

node tests/e2e/run-ai-full-game.mjs --verbose
```

`AI_FULL_GAME_*` may be omitted when `AI_EVAL_API_KEY`, `AI_EVAL_BASE_URL`, and `AI_EVAL_MODEL` are already set; the runner reuses them.

## Run against the deployed frontend proxy

This exercises the same `/api/chat` proxy used by the browser and avoids putting the Dify app key in the local shell:

```bash
export GAME_TEACHER_PROXY_URL='https://game-teacher-demo.vercel.app/api/chat'
export DIFY_TEST_VERSION='v10-r4'
export DIFY_EXPECT_DSL_VERSION='v10'

export AI_FULL_GAME_API_KEY='...'
export AI_FULL_GAME_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_FULL_GAME_MODEL='your-model'

node tests/e2e/run-ai-full-game.mjs --verbose
```

The default cap is 14 child turns. Override it with `--max-turns 18` or `FULL_GAME_MAX_TURNS=18` only when a deliberately longer game needs more room.

## Fail-fast and diagnostic mode

By default the runner stops as soon as the hard full-game contract is already impossible, for example after:

- a `pipeline_error`;
- a phantom physical-action claim;
- a strict runtime identity mismatch.

This prevents an AI child from wasting later turns trying different capitalization or magic wording after the runtime has already failed.

Use `--keep-going` only when deliberately collecting additional broken behavior for diagnosis:

```bash
node tests/e2e/run-ai-full-game.mjs --verbose --keep-going
```

## Live output

The runner creates its artifact paths at startup and persists evidence throughout the run:

- `*__ai-full-game.json` — rolling full snapshot, atomically rewritten after each checkpoint;
- `*__ai-full-game__live.jsonl` — append-only event stream with generated game spec, AI-child turns, Dify payload/debug/world state, errors, fail-fast decisions, interrupts, and final result;
- `*__ai-full-game__conversation.txt` — concise Student/Jamie transcript appended after each completed turn.

This means a Dify 400/504, provider interruption, `Ctrl-C`, or other crash does not discard all earlier evidence.

For live inspection:

```bash
tail -f .artifacts/dify-e2e/*__ai-full-game__live.jsonl
```

See [`LIVE_TRACE.md`](./LIVE_TRACE.md) for details.

## Interpreting a result

A single random failure is not automatically evidence that the DSL should change. First classify it:

- **AI-child/game-design issue** — the generated game exceeds the renderer/action vocabulary or the simulated child behaves unrealistically;
- **infra/provider issue** — Dify/provider/network failed independently of the learner semantics;
- **harness issue** — the runner made an invalid determination;
- **product/runtime issue** — the child taught an actionable rule but Jamie could not execute it, imported an unstated rule, failed to persist a repair, opened a fake gap, or failed to recognize a grounded ending.

Only the last category should normally drive semantic runtime work.

## Current evidence

The no-thinking v10 r4 runtime has completed an AI-generated original game end to end with real visible state transitions, `game_complete=true`, `phase=complete`, non-empty child-taught completion evidence, `pending_gap=null`, and no pipeline errors.

That result shows that the semantic-core architecture can complete at least one arbitrary original game without a game-specific prompt. It does **not** establish production-ready coverage for arbitrary games; breadth scenarios and frontend/manual QA remain separate concerns.
