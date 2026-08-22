import assert from 'node:assert/strict';
import test from 'node:test';

// Smoke-level guard: the runner is intentionally standalone and should stay parseable.
// Behavioral validation happens against a live Dify deployment/provider.
test('AI full-game runner source exists with grounded completion gates', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./run-ai-full-game.mjs', import.meta.url), 'utf8'));
  for (const token of ['game_complete', 'completion_evidence', 'pending_gap', 'pipeline_errors', 'phaseComplete']) {
    assert.match(source, new RegExp(token));
  }
});
