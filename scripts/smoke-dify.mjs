#!/usr/bin/env node

const apiKey = process.env.DIFY_API_KEY;
const baseUrl = (process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');

if (!apiKey) {
  console.error('Missing DIFY_API_KEY');
  process.exit(1);
}

const user = `game-teacher-smoke-${Date.now()}`;
let conversationId = '';

const turns = [
  {
    query: 'You flip two cards.',
    expect: payload => payload.phase === 'repair' && payload.ui_action?.type === 'flip_cards',
    note: 'Partial explanation should expose the non-match gap through Jamie\'s action.',
  },
  {
    query: "No, that's wrong.",
    expect: payload => payload.phase === 'repair' && payload.ui_action?.type === 'none',
    note: 'First vague correction should not jump straight to the step picker.',
  },
  {
    query: "No! Don't do that.",
    expect: payload => payload.phase === 'repair' && payload.ui_action?.type === 'show_repair_steps',
    note: 'Second vague correction should escalate to locate-step support.',
  },
  {
    query: "If the cards don't match, turn both of them face down again.",
    expect: payload => payload.phase === 'retry' && payload.ui_action?.type === 'flip_back',
    note: 'Specific repair should update Jamie and visibly repair the action.',
  },
];

async function send(query) {
  const response = await fetch(`${baseUrl}/chat-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: 'blocking',
      conversation_id: conversationId,
      user,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Dify ${response.status}: ${raw}`);
  }

  const data = JSON.parse(raw);
  conversationId = data.conversation_id || conversationId;

  let payload;
  try {
    payload = typeof data.answer === 'string' ? JSON.parse(data.answer) : data.answer;
  } catch {
    throw new Error(`Answer is not frontend JSON:\n${data.answer}`);
  }

  return payload;
}

console.log('Dify smoke test');
console.log(`User: ${user}\n`);

let failures = 0;
for (let index = 0; index < turns.length; index += 1) {
  const turn = turns[index];
  try {
    const payload = await send(turn.query);
    const ok = turn.expect(payload);
    console.log(`${ok ? 'PASS' : 'FAIL'} turn ${index + 1}: ${turn.query}`);
    console.log(`     phase=${payload.phase} action=${payload.ui_action?.type}`);
    console.log(`     Jamie: ${payload.reply}`);
    console.log(`     ${turn.note}\n`);
    if (!ok) failures += 1;
  } catch (error) {
    failures += 1;
    console.error(`FAIL turn ${index + 1}: ${error.message}\n`);
  }
}

if (failures) {
  console.error(`${failures} smoke-test check(s) failed.`);
  process.exit(1);
}

console.log('All Dify smoke-test checks passed.');
