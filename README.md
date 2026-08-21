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

The repo includes the Dify node source under `dify/`:

- `dify/interpreter-prompt.md`
- `dify/lesson-engine.py`
- `dify/README.md` with the exact Chatflow wiring

## Run locally

This demo intentionally has **no local lesson-logic mock**. The browser requires the real Dify-backed `/api/chat` endpoint.

Create `.env.local` from `.env.example` and set your Dify API key, then run:

```bash
npx vercel dev
```

Open the local URL printed by Vercel.

If `/api/chat` is unavailable or `DIFY_API_KEY` is missing, the UI reports a Dify connection error and does not simulate a response locally.

## Dify

Create/import a Chatflow using the wiring in `dify/README.md`. The LLM node uses `dify/interpreter-prompt.md`; the deterministic Code node uses `dify/lesson-engine.py`.

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

The importable Dify DSL for this same Matching Pairs Chatflow can be used directly; the source files here are kept readable so the behavior is easy to review and modify.

## Deploy

Import this repository into Vercel and add:

- `DIFY_API_KEY`
- optional `DIFY_API_BASE_URL` (defaults to `https://api.dify.ai/v1`)

No Dify key is shipped to the client.

## Design boundary

The browser never decides that a student's explanation is right or wrong. It only executes `ui_action` commands. Dify owns Jamie's knowledge state and lesson progression.
