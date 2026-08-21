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

For the UI-only preview, any static server works:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

The UI falls back to a small local preview script if `/api/chat` is unavailable, so reviewers can still exercise the main interaction without credentials.

For the real Dify integration, use Vercel dev so `/api/chat` is available:

```bash
npx vercel dev
```

Create `.env.local` from `.env.example` and set your Dify API key.

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

The Vercel `/api/chat` proxy parses this JSON and forwards it to the browser.

## Tests

The deterministic lesson/game engine can be tested without an LLM or Dify account:

```bash
python tests/test_lesson_engine.py
```

GitHub Actions runs the same checks on every push. These tests cover partial explanations, specific repair, repeated vague `No`, no forced friction for a complete explanation, and off-topic turns.

`tests/grade3-4-scenarios.md` contains deliberately messy child-like language for live interpreter testing. It is meant to catch the two most important model failures: silently filling in rules the child never said, and being too strict about understandable Grade 3–4 language.

After the Chatflow is published and `DIFY_API_KEY` is available, run a real multi-turn smoke test directly against Dify:

```bash
node scripts/smoke-dify.mjs
```

That script verifies this sequence:

1. partial explanation → Jamie exposes a real rule gap;
2. first vague `No` → one clarification question;
3. second vague `No` → repair-step locator;
4. specific repair → Jamie updates and retries.

## Deploy

Import this repository into Vercel and add:

- `DIFY_API_KEY`
- optional `DIFY_API_BASE_URL` (defaults to `https://api.dify.ai/v1`)

No Dify key is shipped to the client.

## Design boundary

The browser never decides that a student's explanation is right or wrong. It only executes `ui_action` commands. Dify owns Jamie's knowledge state and lesson progression.