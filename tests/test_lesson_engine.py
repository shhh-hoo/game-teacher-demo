import importlib.util
import json
from pathlib import Path


ENGINE_PATH = Path(__file__).resolve().parents[1] / "dify" / "lesson-engine.py"
spec = importlib.util.spec_from_file_location("lesson_engine", ENGINE_PATH)
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


def run_turn(
    recognized=None,
    *,
    phase="explain",
    knowledge=None,
    game_state=None,
    trace=None,
    repair_count=0,
    intent="teach",
    specificity="none",
    off_topic=False,
    house_rule=None,
    student_message="test",
):
    interpretation = {
        "recognized_rule_ids": recognized or [],
        "student_intent": intent,
        "correction_specificity": specificity,
        "off_topic": off_topic,
        "house_rule": house_rule,
    }
    result = engine.main(
        interpreter_text=json.dumps(interpretation),
        student_message=student_message,
        phase=phase,
        friend_knowledge_json=json.dumps(knowledge or {}),
        game_state_json=json.dumps(
            game_state
            or {"cards_initialized": False, "face_up": [], "matched": [], "turn": "jamie"}
        ),
        last_action_trace_json=json.dumps(trace or []),
        repair_count=repair_count,
    )
    result["payload"] = json.loads(result["response_json"])
    result["knowledge"] = json.loads(result["friend_knowledge_json"])
    return result


def test_partial_explanation_creates_real_gap():
    result = run_turn(["turn.flip_two"])
    assert result["phase"] == "repair"
    assert result["payload"]["ui_action"]["type"] == "flip_cards"
    assert result["payload"]["ui_action"]["payload"]["keep_face_up"] is True
    assert result["payload"]["debug"]["current_gap"] == "result.no_match_flip_back"


def test_clear_no_match_rule_changes_jamies_behavior():
    result = run_turn(["turn.flip_two", "result.no_match_flip_back"])
    assert result["payload"]["ui_action"]["type"] == "flip_two_then_flip_back"
    assert result["phase"] == "try"


def test_first_vague_no_only_asks_for_location():
    result = run_turn(
        phase="repair",
        intent="correct",
        specificity="low",
        repair_count=0,
    )
    assert result["repair_count"] == 1
    assert result["payload"]["ui_action"]["type"] == "none"
    assert "Which part" in result["reply"]


def test_second_vague_no_opens_step_locator():
    trace = [
        "Flip two cards",
        "Check whether they match",
        "Leave both cards face up",
        "End the turn",
    ]
    result = run_turn(
        phase="repair",
        intent="correct",
        specificity="low",
        repair_count=1,
        trace=trace,
    )
    assert result["repair_count"] == 2
    assert result["payload"]["ui_action"]["type"] == "show_repair_steps"
    assert result["payload"]["support"]["steps"] == trace


def test_specific_repair_is_learned_and_replayed():
    result = run_turn(
        ["result.no_match_flip_back"],
        phase="repair",
        intent="correct",
        specificity="specific",
        repair_count=1,
        game_state={"cards_initialized": True, "face_up": [1, 6], "matched": [], "turn": "jamie"},
    )
    assert result["phase"] == "retry"
    assert result["knowledge"]["result.no_match_flip_back"] is True
    assert result["payload"]["ui_action"]["type"] == "flip_back"
    assert result["repair_count"] == 0


def test_complete_first_explanation_does_not_force_friction():
    result = run_turn(
        [
            "setup.face_down",
            "turn.flip_two",
            "result.no_match_flip_back",
            "turn.switch",
        ]
    )
    assert result["phase"] == "play"
    assert result["payload"]["ui_action"]["type"] == "flip_two_then_flip_back"
    assert "don't match" not in result["reply"].lower() or "turned them back" in result["reply"].lower()


def test_off_topic_keeps_current_phase():
    result = run_turn(phase="try", off_topic=True, student_message="My cousin likes Pokemon")
    assert result["phase"] == "try"
    assert result["payload"]["ui_action"]["type"] == "none"


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
    print(f"\n{len(tests)} tests passed")
