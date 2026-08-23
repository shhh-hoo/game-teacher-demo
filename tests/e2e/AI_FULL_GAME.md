# AI full-game smoke — V12

`run-ai-full-game.mjs` is a **high-cost diagnostic / fuzzing tool**, not a required freeze gate for the take-home.

Before the AI child starts teaching its game, the runner completes the same V12 foundations as the browser:

1. Follow Raku to reproduce a hidden target, including one under-specified direction and repair.
2. Reverse roles and guide Raku to a new target, including a real ambiguous placement and correction.
3. Select `Another simple game` without injecting any rules.

Only then does the AI child start teaching one small original game.

## Learner-authority contract

The generated game specification is **only a private creative seed for the simulated AI child**. It is not product truth, not an answer key, and not runtime input for Raku.

Once the child says something in the conversation, that utterance is the authoritative game evidence available to Raku. A later explicit child correction overrides an earlier child statement. AI-inferred layout, quantities, identities, and presentation remain provisional and must not become facts that the child has to satisfy.

The seed may remain in raw trace metadata for debugging the AI-child generator, but `judge.mjs` deliberately removes it before learner-experience evaluation. The evaluator must judge only the child transcript, Raku replies, validated actions, visible world, repair behavior, and grounded completion.

## Final runtime identity

```bash
export DIFY_TEST_VERSION='v12-r24-final'
export DIFY_EXPECT_DSL_VERSION='v12'
```

Expected build:

```text
v12-listener-reconstruction-game-r24-final-20260824
```

## Final model allocation

The final cost-frozen Dify workflow uses Pro only where semantic reliability matters most:

- `AI · Raku Listener Interpreter` → `deepseek-v4-pro`
- `AI · Executable Rule Compiler` → `deepseek-v4-pro`
- all other seven LLM nodes → `deepseek-v4-flash`
- Thinking remains disabled everywhere.

This is a cost decision, not a new behavioral revision.

## Freeze policy

Do **not** run `npm run test:ai-eval` again as part of routine freeze validation. A 14-turn random game can invoke the semantic pipeline many times with growing context and is intentionally treated as an expensive stress test.

Use the fixed learner-facing gates instead:

```bash
node tests/e2e/run-dify.mjs
npm run test:browser:live
```

Use AI full-game only when deliberately investigating a specific broad-runtime question and the additional token cost is justified.

## Optional diagnostic run

If it is intentionally needed:

```bash
export DIFY_API_KEY='app-...'
export DIFY_TEST_VERSION='v12-r24-final'
export DIFY_EXPECT_DSL_VERSION='v12'

export AI_FULL_GAME_API_KEY='...'
export AI_FULL_GAME_BASE_URL='https://your-openai-compatible-provider.example/v1'
export AI_FULL_GAME_MODEL='your-model'

node tests/e2e/run-ai-full-game.mjs --verbose
```

The default final-game budget remains 14 AI-child turns. Foundation turns are recorded separately and do not consume that budget. Use `--keep-going` only for deliberate diagnostics after a hard failure.
