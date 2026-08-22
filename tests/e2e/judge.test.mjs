import assert from 'node:assert/strict';
import { compactTraceForJudge, parseJudgeJson } from './judge.mjs';

const parsed = parseJudgeJson(JSON.stringify({
  scores: {
    naturalness: 4,
    listener_centeredness: 4,
    child_agency: 5,
    grounded_repair: 3,
    loop_coherence: 4,
  },
  critical_failure: false,
  critical_issues: [],
  strengths: ['Jamie acts without over-clarifying.'],
  improvements: ['Repair could be clearer.'],
  summary: 'Mostly coherent.',
}));

assert.equal(parsed.status, 'ok');
assert.equal(parsed.overall, 4);
assert.equal(parsed.critical_failure, false);

const compact = compactTraceForJudge({
  scenario: 'golden-path-learning-loop',
  turns: [{
    index: 3,
    query: 'Flip any two cards.',
    payload: {
      reply: "Okay, I'll flip these two.",
      phase: 'experience',
      ui_action: {
        type: 'action_sequence',
        payload: { actions: [{ type: 'reveal_object' }, { type: 'reveal_object' }] },
      },
      debug: {
        controller: {
          pending_gap: {
            context: 'Two cards are revealed.',
            missing_for_next_action: 'What happens after seeing them?',
            reason: 'No outcome rule was taught.',
          },
        },
      },
    },
    assertions: [],
    qualitySignals: [{ name: 'quality.listener-gap-visible', ok: false }],
  }],
});

assert.deepEqual(compact.turns[0].actions, ['reveal_object', 'reveal_object']);
assert.equal(compact.turns[0].internal_gap.missing_for_next_action, 'What happens after seeing them?');
console.log('AI judge helper tests: PASS');
