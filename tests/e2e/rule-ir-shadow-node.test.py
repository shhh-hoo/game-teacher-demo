import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "dify/v10_1/rule_ir_shadow_node.py"
SPEC = importlib.util.spec_from_file_location("rule_ir_shadow_node", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def student(turn, message, semantic_key="after_water", description="Watering a seed makes it a sprout."):
    return {
        "turn_count": turn,
        "messages": [{"turn": turn, "text": message}],
        "instructions": [
            {
                "turn": turn,
                "source": "student",
                "semantic_key": semantic_key,
                "trigger": "when a seed is watered",
                "action_type": "set_state",
                "target_description": "the watered seed",
                "description": description,
                "evidence": message,
            },
        ],
    }


def compiler(semantic_key="after_water", state="sprout"):
    return {
        "schema_version": MODULE.SCHEMA_VERSION,
        "status": "ok",
        "proposed_rules": [
            {
                "semantic_key": semantic_key,
                "kind": "transition",
                "when": {"event": "water_seed"},
                "condition": None,
                "effects": [
                    {"type": "update_object", "target": {"ref": "event.target"}, "patch": {"state": state}},
                ],
            },
        ],
        "unsupported": [],
    }


class RuleIrShadowNodeTest(unittest.TestCase):
    def run_node(self, compiler_value, model, student_value):
        return MODULE.main(
            compiler_text=json.dumps(compiler_value) if not isinstance(compiler_value, str) else compiler_value,
            executable_rule_model_json=json.dumps(model),
            student_model_json=json.dumps(student_value),
            summary_json=json.dumps({"turn_count": student_value["turn_count"]}),
        )

    def test_adds_only_current_turn_grounded_rule(self):
        message = "If you water a seed, it turns into a sprout."
        result = self.run_node(
            compiler(),
            {"schema_version": MODULE.SCHEMA_VERSION, "rules": [], "last_compile_turn": 0},
            student(1, message),
        )
        shadow = json.loads(result["rule_ir_shadow_json"])
        self.assertEqual(shadow["status"], "ok")
        self.assertEqual(len(shadow["rules"]), 1)
        self.assertEqual(shadow["rules"][0]["provenance"]["source"], "student")
        self.assertEqual(shadow["rules"][0]["provenance"]["evidence"][0]["quote"], message)
        self.assertEqual(shadow["delta"]["added_rule_ids"], ["rule_after_water_t1"])

    def test_correction_supersedes_previous_active_rule(self):
        first = self.run_node(
            compiler(state="sprout"),
            {"schema_version": MODULE.SCHEMA_VERSION, "rules": [], "last_compile_turn": 0},
            student(1, "Watering a seed makes it a sprout."),
        )
        previous = json.loads(first["executable_rule_model_json"])
        second = self.run_node(
            compiler(state="leaf"),
            previous,
            student(2, "Sorry, watering a seed makes it a leaf.", description="Watering a seed makes it a leaf."),
        )
        shadow = json.loads(second["rule_ir_shadow_json"])
        statuses = {rule["id"]: rule["status"] for rule in shadow["rules"]}
        self.assertEqual(statuses["rule_after_water_t1"], "superseded")
        self.assertEqual(statuses["rule_after_water_t2"], "active")
        self.assertEqual(shadow["delta"]["superseded_rule_ids"], ["rule_after_water_t1"])
        self.assertEqual(shadow["rules"][-1]["supersedes"], ["rule_after_water_t1"])

    def test_rejects_rule_without_current_student_instruction(self):
        result = self.run_node(
            compiler(semantic_key="secret_win_rule"),
            {"schema_version": MODULE.SCHEMA_VERSION, "rules": [], "last_compile_turn": 0},
            student(1, "Watering a seed makes it a sprout."),
        )
        shadow = json.loads(result["rule_ir_shadow_json"])
        self.assertEqual(shadow["status"], "error")
        self.assertEqual(shadow["rules"], [])
        self.assertTrue(any("not grounded" in error for error in shadow["errors"]))

    def test_invalid_compiler_output_preserves_previous_rules(self):
        previous = {
            "schema_version": MODULE.SCHEMA_VERSION,
            "rules": [{"id": "existing", "status": "active", "semantic_key": "existing"}],
            "last_compile_turn": 1,
        }
        result = self.run_node("not json", previous, student(2, "Now water it again."))
        shadow = json.loads(result["rule_ir_shadow_json"])
        self.assertEqual(shadow["status"], "error")
        self.assertEqual(shadow["rules"], previous["rules"])

    def test_rejects_effect_family_not_grounded_by_instruction_type(self):
        candidate = compiler()
        candidate["proposed_rules"][0]["effects"] = [{"type": "complete_game"}]
        result = self.run_node(
            candidate,
            {"schema_version": MODULE.SCHEMA_VERSION, "rules": [], "last_compile_turn": 0},
            student(1, "Watering a seed makes it a sprout."),
        )
        shadow = json.loads(result["rule_ir_shadow_json"])
        self.assertEqual(shadow["status"], "error")
        self.assertEqual(shadow["rules"], [])
        self.assertTrue(any("not grounded" in error for error in shadow["errors"]))


if __name__ == "__main__":
    unittest.main()
