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

assert.deepEqual(compact.turns[0].action_types, ['reveal_object', 'reveal_object']);
assert.deepEqual(compact.turns[0].actions.map(action => action.type), ['reveal_object', 'reveal_object']);
assert.equal(compact.turns[0].internal_gap.missing_for_next_action, 'What happens after seeing them?');

const hiddenSeed = 'SECRET ANSWER KEY: eight alternating objects';
const fullGameCompact = compactTraceForJudge({
  kind: 'ai-full-game',
  gameSpec: {
    name: 'Seed Only',
    notes: hiddenSeed,
  },
  completion: { ok: false },
  hardFailures: [],
  turns: [{
    index: 1,
    student: 'There are three suns and one empty spot.',
    jamie: 'Got it.',
    payload: {
      reply: 'Got it.',
      phase: 'student_teaching',
      ui_action: { type: 'none', payload: {} },
    },
    world_after: {
      name: 'Child-authored game',
      objects: [],
      counters: [],
    },
  }],
});

assert.equal('game_spec' in fullGameCompact, false);
assert.equal('gameSpec' in fullGameCompact, false);
assert.equal(JSON.stringify(fullGameCompact).includes(hiddenSeed), false);
assert.equal(fullGameCompact.turns[0].student, 'There are three suns and one empty spot.');

console.log('AI judge helper tests: PASS');
