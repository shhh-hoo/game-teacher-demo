# v6 contracts

The core boundary is:

> Rendered world is evidence of AI interpretation, but it is not automatically knowledge Jamie is allowed to use.

Five state domains remain separate:

1. `student_model_json` — only information grounded in the child's language.
2. `render_model_json` — visual representation plus presentation-only inference.
3. `listener_model_json` — what the current Jamie is allowed to know.
4. `game_state_json` — physical state of the rendered game world.
5. `pedagogy_state_json` — lesson phase, teaching usage, and scaffold state.

## Listener Interpretation Contract

The Listener Interpreter may normalize ordinary child language, resolve a clear local referent, and preserve self-correction. It may not expand a familiar game name or familiar pattern into unstated rules.

Output fields:
- `explicit_facts`
- `instructions`
- `correction`
- `off_topic`
- `blocking_ambiguity`
- `student_intent`

## World Patch + Provenance Contract

The World Builder may infer presentation details that do not change gameplay. The Grounding Guard removes any patch content that adds unstated gameplay logic.

Frontend patch:
- `surface`
- `status`
- `add_objects`
- `update_objects`
- `remove_object_ids`
- `counters`

Guard-only metadata:
- `provenance`
- `violations`

Presentation inference may include layout, art, symbols, or a small demo quantity. It may not include turn mechanics, goal, legal actions, match consequences, or win conditions.

## Pedagogy / Response Intent Contract

The Pedagogy Controller decides the teaching move before Jamie's language is generated.

Response modes:
- `listener`
- `teach`
- `repair`

Listener intents:
- `ask_open_next`
- `act_and_continue`
- `redirect`
- `fresh_listener_transition`
- `transfer_prompt`
- `complete`

The final Response Leakage Guard rewrites any helpful-sounding question that introduces a rule the child never taught.
