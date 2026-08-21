# Game Teacher Demo

A short AI-native Lesson Card prototype for US Grade 3–4 learners.

The student teaches Jamie, a same-age novice friend, a game they already know. In v6, the student's explanation does not merely control Jamie's dialogue: it progressively constructs the visible game world Jamie understands, then Jamie tries to use that world.

The learning loop is:

**Experience a real communication gap → notice it → learn one listener-centered principle → apply it with guidance → explain again to a fresh listener → transfer the idea.**

The central design boundary is:

> **AI may complete presentation details, but it must not complete the child's game logic.**

Visual choices such as colors or decorative symbols can be inferred. Gameplay-relevant facts—legal moves, turn structure, result rules, win conditions, required constraints—must come from the student.

## Responsibilities

- **Dify Chatflow** visibly controls pedagogy: first breakdown, Teach Moment, at most one extra micro-teach, scaffold fading, fresh-listener performance, transfer, and global repair.
- **AI Listener + World Builder** interprets natural child speech, proposes safe world updates, models what Jamie actually knows, and identifies the single biggest communication bottleneck without importing a standard rulebook.
- **World Engine** validates declarative world patches and atomic actions. It controls physical reality, not correctness.
- **AI Jamie** speaks as a same-age novice after pedagogy and world state are already decided.
- **Browser UI** renders the progressively constructed world, atomic actions, teaching support, global repair, voice/text input, and playable object interactions.
- **`/api/chat`** keeps the Dify API key server-side and forwards speech metadata or game-world events when present.

## Run locally

This demo has no local lesson-logic mock. Create `.env.local` from `.env.example`, set the published Dify app API key, then run:

```bash
set -a
source .env.local
set +a
npx vercel dev
```

Open the local URL printed by Vercel.

## Frontend response contract

The browser expects JSON in this shape:

```json
{
  "reply": "I can see the pieces, but I still don't know what I can do first.",
  "phase": "teach",
  "world_patch": {
    "add_objects": [],
    "update_objects": [],
    "ready": false
  },
  "ui_action": {
    "type": "action_sequence",
    "payload": {
      "actions": []
    }
  },
  "support": {
    "type": "teach_moment",
    "focus": "completeness"
  },
  "capture_baseline": false
}
```

`world_patch` changes what exists in the rendered game world. `ui_action` changes what physically happens inside that world. Keeping those separate lets AI infer harmless presentation details without silently inventing gameplay logic.

## Dify source

The readable Dify source lives under `dify/`:

- `dify/interpreter-prompt.md` — AI Listener + World Builder contract
- `dify/lesson-engine.py` — deterministic world patch/action validator used after Dify selects a visible pedagogical policy
- `dify/README.md` — v6 Chatflow topology and state contract

The generated importable v6 DSL should be runtime-tested in Dify before it is committed as the canonical flow.
