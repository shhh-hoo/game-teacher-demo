#!/usr/bin/env node

const apiKey = process.env.DIFY_API_KEY;
const baseUrl = (process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');

if (!apiKey) {
  console.error('Missing DIFY_API_KEY');
  process.exit(1);
}

const response = await fetch(`${baseUrl}/chat-messages`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    inputs: {},
    query: process.argv.slice(2).join(' ') || 'You flip two cards.',
    response_mode: 'blocking',
    conversation_id: '',
    user: `game-teacher-inspect-${Date.now()}`,
  }),
});

const raw = await response.text();
console.log(`HTTP ${response.status}`);

try {
  const data = JSON.parse(raw);
  console.log('\nDify answer exactly as returned:\n');
  console.log(data.answer);
  console.log('\nFull top-level response keys:');
  console.log(Object.keys(data));
} catch {
  console.log('\nRaw response:\n');
  console.log(raw);
}
