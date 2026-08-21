import json
import re

RULES = {
    "setup.face_down",
    "turn.flip_two",
    "result.match_keep",
    "result.no_match_flip_back",
    "turn.switch",
    "goal.most_pairs",
    "strategy.memory",
}


def _loads(value, default):
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _parse_llm_json(text):
    if not text:
        return {}
    if isinstance(text, dict):
        return text
    value = str(text).strip()
    value = re.sub(r"^```(?:json)?\s*", "", value, flags=re.I)
    value = re.sub(r"\s*```$", "", value)
    try:
        return json.loads(value)
    except Exception:
        match = re.search(r"\{.*\}", value, flags=re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
    return {}


def _frontend_payload(reply, phase, ui_action, support, knowledge, gap, recognized):
    return json.dumps(
        {
            "reply": reply,
            "phase": phase,
            "ui_action": ui_action,
            "support": support,
            "debug": {
                "recognized_rules": recognized,
                "friend_knows": sorted([key for key, value in knowledge.items() if value]),
                "current_gap": gap,
            },
        },
        ensure_ascii=False,
    )


def main(
    interpreter_text: str,
    student_message: str,
    phase: str,
    friend_knowledge_json: str,
    game_state_json: str,
    last_action_trace_json: str,
    repair_count,
) -> dict:
    interpretation = _parse_llm_json(interpreter_text)
    knowledge = _loads(friend_knowledge_json, {})
    game_state = _loads(
        game_state_json,
        {"cards_initialized": False, "face_up": [], "matched": [], "turn": "jamie"},
    )
    trace = _loads(last_action_trace_json, [])
    phase = phase or "explain"

    try:
        repair_count = int(repair_count or 0)
    except Exception:
        repair_count = 0

    recognized = [
        rule_id
        for rule_id in interpretation.get("recognized_rule_ids", [])
        if rule_id in RULES
    ]
    for rule_id in recognized:
        knowledge[rule_id] = True

    intent = interpretation.get("student_intent", "teach")
    specificity = interpretation.get("correction_specificity", "none")
    off_topic = bool(interpretation.get("off_topic", False))
    house_rule = interpretation.get("house_rule")

    ui_action = {"type": "none", "payload": {}}
    support = None
    gap = None
    reply = ""

    if off_topic and not recognized:
        reply = "That sounds fun. What should I do with the cards now?"
        return _finish(reply, phase, ui_action, support, knowledge, game_state, trace, repair_count, gap, recognized)

    if house_rule:
        reply = "Oh, is that how you play it? Okay—I’ll use that rule for this game."
        return _finish(reply, phase, ui_action, support, knowledge, game_state, trace, repair_count, gap, recognized)

    if phase == "explain":
        repair_count = 0

        if knowledge.get("setup.face_down") and not game_state.get("cards_initialized"):
            game_state["cards_initialized"] = True
            ui_action = {"type": "setup_cards", "payload": {"count": 8, "face_down": True}}

        if not knowledge.get("turn.flip_two"):
            if knowledge.get("setup.face_down"):
                reply = "Okay, the cards start face down. What do I do on my turn?"
            elif recognized:
                reply = "Got it. What should I do first on my turn?"
            else:
                reply = "What do I do first?"
        else:
            game_state["cards_initialized"] = True
            game_state["face_up"] = [1, 6]
            trace = [
                "Flip card 1",
                "Flip card 6",
                "Check whether the two cards match",
                "Leave both cards face up",
                "End the turn",
            ]

            if knowledge.get("result.no_match_flip_back"):
                game_state["face_up"] = []
                ui_action = {
                    "type": "flip_two_then_flip_back",
                    "payload": {"cards": [1, 6], "match": False},
                }
                if knowledge.get("turn.switch"):
                    phase = "play"
                    reply = "Okay—I flipped two different cards, turned them back over, and now it’s your turn. I think I can play a turn!"
                else:
                    phase = "try"
                    gap = "turn.switch"
                    reply = "I flipped two different cards and turned them back over. What happens after my turn?"
            else:
                ui_action = {
                    "type": "flip_cards",
                    "payload": {"cards": [1, 6], "match": False, "keep_face_up": True},
                }
                phase = "repair"
                gap = "result.no_match_flip_back"
                reply = "I flipped two cards. They don’t match. What do I do with these now?"

    elif phase == "try":
        if knowledge.get("turn.switch"):
            phase = "play"
            reply = "Got it—after my turn, it’s your turn. I think I can play now."
            ui_action = {"type": "switch_turn", "payload": {"to": "student"}}
        else:
            gap = "turn.switch"
            reply = "What happens after I finish my turn?"

    elif phase == "repair":
        gap = "result.no_match_flip_back"

        if knowledge.get("result.no_match_flip_back"):
            repair_count = 0
            game_state["face_up"] = []
            phase = "retry"
            ui_action = {"type": "flip_back", "payload": {"cards": [1, 6]}}
            reply = "Oh! If they don’t match, I turn both cards face down again. Let me fix that."

        elif intent == "correct" and specificity == "low":
            repair_count += 1
            if repair_count >= 2:
                support = {
                    "type": "locate_step",
                    "prompt": "Which step should Jamie change?",
                    "steps": trace
                    or [
                        "Flip two cards",
                        "Check whether they match",
                        "Leave both cards face up",
                        "End the turn",
                    ],
                }
                ui_action = {"type": "show_repair_steps", "payload": support}
                reply = "Can you point to the step I should change?"
            else:
                reply = "Which part did I get wrong?"
        else:
            reply = "What should I do with the two cards when they don’t match?"

    elif phase == "retry":
        game_state["face_up"] = []
        ui_action = {
            "type": "retry_turn",
            "payload": {"cards": [2, 7], "match": False, "turn_back_after": True},
        }
        if knowledge.get("turn.switch"):
            phase = "play"
            reply = "That worked! I flipped two, they didn’t match, so I turned them back. Now it’s your turn."
        else:
            phase = "try"
            gap = "turn.switch"
            reply = "That worked! After I turn them back, whose turn is it?"

    elif phase == "play":
        if not knowledge.get("result.match_keep"):
            gap = "result.match_keep"
            reply = "What if the two cards are the same?"
            ui_action = {"type": "preview_match", "payload": {"cards": [3, 5], "match": True}}
        elif not knowledge.get("goal.most_pairs"):
            gap = "goal.most_pairs"
            reply = "Okay, I keep matching pairs. How do we know who wins?"
        else:
            phase = "tip"
            reply = "I think I’ve got it! Do you have one tip that could help me play better?"
            ui_action = {"type": "complete_play", "payload": {}}

    elif phase == "tip":
        phase = "complete"
        if knowledge.get("strategy.memory") or intent == "tip":
            reply = "That’s a good tip. I’ll try to remember where the cards are. Thanks for teaching me!"
        else:
            reply = "Thanks! I can play now. The part that helped most was when you explained what to do after two cards didn’t match."
        ui_action = {"type": "lesson_complete", "payload": {}}

    else:
        reply = "I’m ready to keep playing."

    return _finish(reply, phase, ui_action, support, knowledge, game_state, trace, repair_count, gap, recognized)


def _finish(reply, phase, ui_action, support, knowledge, game_state, trace, repair_count, gap, recognized):
    response_json = _frontend_payload(reply, phase, ui_action, support, knowledge, gap, recognized)
    return {
        "reply": reply,
        "phase": phase,
        "friend_knowledge_json": json.dumps(knowledge, ensure_ascii=False),
        "game_state_json": json.dumps(game_state, ensure_ascii=False),
        "last_action_trace_json": json.dumps(trace, ensure_ascii=False),
        "repair_count": repair_count,
        "ui_action_json": json.dumps(ui_action, ensure_ascii=False),
        "response_json": response_json,
    }
