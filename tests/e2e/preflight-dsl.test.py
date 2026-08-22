import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml


HERE = Path(__file__).resolve().parent
PREFLIGHT = HERE / "preflight-dsl.py"


def fixture(thinking=False, target="pack"):
    return {
        "app": {"name": "synthetic preflight fixture"},
        "workflow": {
            "conversation_variables": [
                {"name": "executable_rule_model_json", "value_type": "string", "value": "{}"},
            ],
            "graph": {
                "nodes": [
                    {
                        "id": "compiler",
                        "data": {
                            "type": "llm",
                            "title": "AI · Executable Rule Compiler (Shadow)",
                            "model": {"completion_params": {"thinking": thinking}},
                            "prompt_template": [{"text": "{{#sys.query#}}"}],
                        },
                    },
                    {
                        "id": "validator",
                        "data": {
                            "type": "code",
                            "title": "Validate Executable Rule IR (Shadow)",
                            "code_language": "python3",
                            "code": "def main():\n    rule_ir_shadow = {}\n    return {'rule_ir_shadow': rule_ir_shadow}\n",
                            "variables": [{"variable": "text", "value_selector": ["compiler", "text"]}],
                        },
                    },
                    {
                        "id": "pack",
                        "data": {
                            "type": "code",
                            "title": "Pack",
                            "code_language": "python3",
                            "code": "def main():\n    return {'dsl_version': 'v10.1', 'build_id': 'fixture-r1'}\n",
                            "variables": [{"variable": "shadow", "value_selector": ["validator", "rule_ir_shadow"]}],
                        },
                    },
                ],
                "edges": [
                    {"id": "one", "source": "compiler", "target": "validator"},
                    {"id": "two", "source": "validator", "target": target},
                ],
            },
        },
    }


def run_preflight(document):
    with tempfile.NamedTemporaryFile("w", suffix=".yml") as handle:
        yaml.safe_dump(document, handle)
        handle.flush()
        return subprocess.run(
            [
                "python3", str(PREFLIGHT), handle.name,
                "--expect-dsl-version", "v10.1",
                "--expect-build-id", "fixture-r1",
                "--require-rule-ir-shadow",
            ],
            capture_output=True,
            text=True,
        )


class PreflightTest(unittest.TestCase):
    def test_accepts_valid_no_thinking_graph(self):
        result = run_preflight(fixture())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_rejects_thinking_llm(self):
        result = run_preflight(fixture(thinking=True))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("thinking=false", result.stdout)

    def test_rejects_missing_graph_reference(self):
        result = run_preflight(fixture(target="missing"))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing target", result.stdout)


if __name__ == "__main__":
    unittest.main()
