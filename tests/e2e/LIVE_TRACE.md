# Live trace behavior

`run-ai-full-game.mjs` persists evidence while the run is still in progress.

At startup it prints three paths under `.artifacts/dify-e2e/`:

- `*.json` — rolling full snapshot, rewritten atomically after each checkpoint;
- `*__live.jsonl` — append-only event log for `tail -f` and crash-safe inspection;
- `*__conversation.txt` — learner/Jamie conversation appended after every completed turn.

The runner checkpoints the generated game spec, each AI-child turn, each Dify turn with full payload/debug/world state, Dify errors, fail-fast decisions, interrupts, and the final result.

By default the run stops immediately after a pipeline error or a phantom physical-action claim because either already makes the hard full-game acceptance impossible. Use `--keep-going` only when deliberately collecting more diagnostic behavior.

Examples:

```bash
node tests/e2e/run-ai-full-game.mjs --verbose
```

In another terminal:

```bash
tail -f .artifacts/dify-e2e/*__live.jsonl
```

For a plain console mirror only, shell `tee` still works:

```bash
node tests/e2e/run-ai-full-game.mjs --verbose 2>&1 | tee .artifacts/dify-e2e/live-console.log
```
