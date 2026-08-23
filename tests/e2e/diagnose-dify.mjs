#!/usr/bin/env node

import process from 'node:process';

const args = process.argv.slice(2);
const getArg = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const apiKey = String(process.env.DIFY_API_KEY || '').trim();
const baseUrl = String(process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').trim().replace(/\/$/, '');
const conversationId = String(getArg('--conversation-id') || '').trim();
const user = String(getArg('--user') || `game-teacher-diagnose-${Date.now()}`).trim();
const literalQuery = getArg('--query');
const query = literalQuery || '[[GAME_TEACHER_EVENT]]\n{"type":"lesson_start"}';

if (!apiKey) {
  console.error('Missing DIFY_API_KEY.');
  process.exit(2);
}

function header(response, name) {
  return response.headers.get(name) || null;
}

const startedAt = Date.now();
let response;
try {
  response = await fetch(`${baseUrl}/chat-messages`, {
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
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    layer: 'network_before_http',
    elapsedMs: Date.now() - startedAt,
    conversationId: conversationId || null,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}

const raw = await response.text();
const elapsedMs = Date.now() - startedAt;
const upstream = {
  status: response.status,
  cfRay: header(response, 'cf-ray'),
  server: header(response, 'server'),
  requestId: header(response, 'x-request-id') || header(response, 'x-trace-id'),
  retryAfter: header(response, 'retry-after'),
  contentType: header(response, 'content-type'),
};

let parsed = null;
try {
  parsed = JSON.parse(raw);
} catch {
  // HTML/text errors are expected during gateway failures.
}

const answer = typeof parsed?.answer === 'string' ? parsed.answer : '';
let buildId = null;
try {
  const payload = JSON.parse(answer);
  buildId = payload?.debug?.build_id || null;
} catch {
  // A failed or non-frontend response has no runtime marker.
}

console.log(JSON.stringify({
  ok: response.ok,
  elapsedMs,
  requestConversationId: conversationId || null,
  responseConversationId: parsed?.conversation_id || null,
  messageId: parsed?.message_id || null,
  buildId,
  upstream,
  bodyPreview: raw.slice(0, 1200),
}, null, 2));

process.exit(response.ok ? 0 : 1);
