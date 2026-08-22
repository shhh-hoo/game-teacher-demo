import assert from 'node:assert/strict';
import test from 'node:test';

// Smoke-level guard: behavioral validation still happens against a live Dify deployment/provider.
test('AI full-game runner keeps grounded completion gates and live checkpoints', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./run-ai-full-game.mjs', import.meta.url), 'utf8'));

  for (const token of [
    'game_complete',
    'completion_evidence',
    'pending_gap',
    'pipeline_errors',
    'phaseComplete',
    '__live.jsonl',
    'appendLive',
    'writeSnapshot',
    'SIGINT',
    'fail_fast',
    'phantom_action',
  ]) {
    assert.match(source, new RegExp(token));
  }
});
