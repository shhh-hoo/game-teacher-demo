# Dify setup

The frontend is intentionally thin. Dify owns lesson state and returns structured `ui_action` commands.

Use a **Chatflow** with this shape:

```text
Start
  ↓
Interpret Student (LLM)
  ↓
Lesson + Game Engine (Code)
  ↓
Save Jamie State (Variable Assigner)
  ↓
Return Frontend JSON (Answer)
```

## Conversation variables

Create these variables:

- `game_id` — string, default `matching_pairs`
- `phase` — string, default `explain`
- `friend_knowledge_json` — string, default `{}`
- `game_state_json` — string, default `{"cards_initialized": false, "face_up": [], "matched": [], "turn": "jamie"}`
- `last_action_trace_json` — string, default `[]`
- `repair_count` — number, default `0`

## LLM node

Use `interpreter-prompt.md` as the system prompt. Pass the current child message as `{{#sys.query#}}`.

The LLM output is consumed by the Code node. It should return JSON only.

## Code node

Copy `lesson-engine.py` into a Python Code node.

Inputs:

- `interpreter_text` ← Interpret Student / text
- `student_message` ← `sys.query`
- `phase` ← conversation variable
- `friend_knowledge_json` ← conversation variable
- `game_state_json` ← conversation variable
- `last_action_trace_json` ← conversation variable
- `repair_count` ← conversation variable

Outputs:

- `reply` string
- `phase` string
- `friend_knowledge_json` string
- `game_state_json` string
- `last_action_trace_json` string
- `repair_count` number
- `ui_action_json` string
- `response_json` string

## Variable Assigner

Overwrite the conversation variables with the corresponding outputs from the Code node.

## Answer node

Return only:

```text
{{#<your-code-node-id>.response_json#}}
```

The Vercel `/api/chat` proxy parses this JSON and forwards it to the browser.

## Frontend action protocol

Currently supported actions:

- `none`
- `setup_cards`
- `flip_cards`
- `flip_two_then_flip_back`
- `flip_back`
- `retry_turn`
- `switch_turn`
- `show_repair_steps`
- `preview_match`
- `complete_play`
- `lesson_complete`

The important boundary is: **Dify decides what Jamie knows and what should happen; the browser only renders the result.**
