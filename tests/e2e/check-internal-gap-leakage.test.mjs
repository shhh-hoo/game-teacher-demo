import assert from 'node:assert/strict';
import { findInternalGapLeakage } from './check-internal-gap-leakage.mjs';

const safe = {
  debug: {
    action_plan: {
      post_action_gap: {
        context: 'Two cards are visible.',
        missing_for_next_action: 'What happens after seeing the two revealed cards?',
        reason: 'The child has not taught the next transition.',
      },
    },
  },
};

const leaking = {
  debug: {
    action_plan: {
      post_action_gap: {
        context: 'Two cards are visible.',
        missing_for_next_action: 'What happens next, e.g. do they stay face up or turn back?',
        reason: 'The next rule is unknown.',
      },
    },
  },
};

assert.equal(findInternalGapLeakage(safe).length, 0);
assert.ok(findInternalGapLeakage(leaking).length > 0);
console.log('internal-gap leakage checker tests: PASS');
