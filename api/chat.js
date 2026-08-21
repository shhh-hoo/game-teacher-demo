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
    message,
    conversationId = '',
    userId = 'game-teacher-demo-user',
    gameId = 'matching_pairs',
  } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          game_id: gameId,
        },
        query: message,
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

    const data = JSON.parse(raw);
    let lessonPayload = data.answer;

    if (typeof lessonPayload === 'string') {
      try {
        lessonPayload = JSON.parse(lessonPayload);
      } catch {
        return res.status(502).json({
          error: 'Dify answer was not valid JSON',
          answer: data.answer,
        });
      }
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
