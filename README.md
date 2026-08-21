# Game Teacher Demo

A small AI Lesson Card prototype for US Grade 3–4 learners.

The student teaches Jamie, a same-age novice friend, how to play a familiar game. The core interaction is:

**Explain → Jamie acts → notice what happened → repair if needed → try again → share a strategy.**

This repo intentionally keeps responsibilities separate:

- **Dify Chatflow**: interprets the student's language, remembers what Jamie has actually learned, chooses the next lesson/game action, and returns structured UI actions.
- **Browser UI**: renders the game, chat, animations, repair-step picker, and completion state. It does not decide whether the student's explanation is correct.
- **`/api/chat`**: a thin server-side proxy so the Dify API key never appears in browser code.

## Current MVP

Matching Pairs is the fully implemented path. The home screen keeps the multi-game model visible so more games can reuse the same protocol later.

## Run locally

For the UI-only preview, any static server works:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

For the real Dify integration, use Vercel dev so `/api/chat` is available:

```bash
npx vercel dev
```

Create `.env.local` from `.env.example` and set your Dify API key.

## Dify

Import `dify/matching-pairs-chatflow.yml` into Dify, configure the LLM node with a model available in your workspace, publish the Chatflow, and copy the app API key into `DIFY_API_KEY`.

The frontend expects the Chatflow answer to be JSON with this shape:

```json
{
  "reply": "What do I do with these now?",
  "phase": "repair",
  "ui_action": {
    "type": "flip_cards",
    "payload": {
      "cards": [1, 6],
      "match": false,
      "keep_face_up": true
    }
  },
  "support": null
}
```

## Deploy

Import this repository into Vercel and add:

- `DIFY_API_KEY`
- optional `DIFY_API_BASE_URL` (defaults to `https://api.dify.ai/v1`)

No Dify key is shipped to the client.
