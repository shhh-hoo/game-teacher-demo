function parseDifyAnswer(answer) {
  if (answer && typeof answer === 'object') return answer;
  if (typeof answer !== 'string') {
    throw new Error(`Dify answer has unexpected type: ${typeof answer}`);
  }

  const original = answer;
  const trimmed = original.trim();
  const candidates = [trimmed];

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidates.push(fenced[1].trim());

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of [...new Set(candidates)]) {
    try {
      let parsed = JSON.parse(candidate);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // Try the next candidate.
    }
  }

  const preview = original.length > 1200 ? `${original.slice(0, 1200)}…` : original;
  const error = new Error('Dify answer was not valid frontend JSON');
  error.rawAnswer = preview;
  throw error;
}

function buildDifyQuery({ message, event, speech }) {
  if (event && typeof event === 'object') {
    return [
      '[[GAME_TEACHER_EVENT]]',
      JSON.stringify(event).slice(0, 2400),
    ].join('\n');
  }

  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (!cleanMessage) return '';

  if (speech && typeof speech === 'object') {
    const safeSpeech = {
      confidence: Number.isFinite(Number(speech.confidence)) ? Number(speech.confidence) : null,
      alternatives: Array.isArray(speech.alternatives)
        ? speech.alternatives.map(String).slice(0, 3)
        : [],
      is_final: Boolean(speech.is_final),
    };
    return `[[SPEECH_META]] ${JSON.stringify(safeSpeech)}\n${cleanMessage}`;
  }

  return cleanMessage;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DIFY_API_KEY;
  const baseUrl = (process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');

  if (!apiKey) {
    return res.status(503).json({ error: 'DIFY_API_KEY is not configured' });
  }

  const {
    message = '',
    event = null,
    speech = null,
    conversationId = '',
    userId = 'game-teacher-demo-user',
  } = req.body || {};

  const query = buildDifyQuery({ message, event, speech });
  if (!query) {
    return res.status(400).json({ error: 'message or event is required' });
  }

  try {
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
        conversation_id: conversationId || '',
        user: userId,
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Dify request failed',
        detail: raw,
      });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error: 'Dify API response was not JSON',
        detail: raw.slice(0, 1200),
      });
    }

    let lessonPayload;
    try {
      lessonPayload = parseDifyAnswer(data.answer);
    } catch (error) {
      return res.status(502).json({
        error: 'Dify answer was not valid frontend JSON',
        detail: `${error.message}. Raw Dify answer: ${error.rawAnswer ?? String(data.answer)}`,
        conversationId: data.conversation_id,
        messageId: data.message_id,
      });
    }

    return res.status(200).json({
      ...lessonPayload,
      conversationId: data.conversation_id,
      messageId: data.message_id,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected proxy error',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
