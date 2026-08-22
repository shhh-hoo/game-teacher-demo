#!/usr/bin/env python3

import argparse
import copy
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = "v10.1-shadow-1"
RULE_MODEL_VARIABLE_ID = "6e112c1f-68cb-4e83-9bf5-e991770b272d"


def node_by_id(graph, node_id):
    return next((node for node in graph.get("nodes", []) if str(node.get("id")) == str(node_id)), None)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def edge(source, target, source_type, target_type):
    return {
        "data": {
            "isInIteration": False,
            "isInLoop": False,
            "sourceType": source_type,
            "targetType": target_type,
        },
        "id": "%s-source-%s-target" % (source, target),
        "source": str(source),
        "sourceHandle": "source",
        "target": str(target),
        "targetHandle": "target",
        "type": "custom",
        "zIndex": 0,
    }


def make_llm_node(template, prompt):
    node = copy.deepcopy(template)
    node["id"] = "1250"
    node["position"] = {"x": 950, "y": 600}
    node["positionAbsolute"] = copy.deepcopy(node["position"])
    data = node["data"]
    data["title"] = "AI · Executable Rule Compiler (Shadow)"
    data["desc"] = "Compile only current-turn child-taught semantics. Shadow-only; never controls behavior."
    data["memory"]["query_prompt_template"] = "{{#sys.query#}}\n"
    data["model"]["completion_params"] = {
        "temperature": 0.1,
        "max_tokens": 2200,
        "thinking": False,
        "response_format": "json_object",
    }
    data["prompt_template"] = [
        {
            "id": "69ae48bf-9e15-4b46-a485-33903e5db409",
            "role": "system",
            "text": "%s\n\nPrevious executable-rule shadow state:\n{{#conversation.executable_rule_model_json#}}\n\nCurrent grounded student model:\n{{#1200.student_model_json#}}\n\nCurrent active listener model:\n{{#1200.listener_model_json#}}\n\nCurrent-turn grounding summary:\n{{#1200.summary_json#}}" % prompt,
        },
        {
            "id": "ea351879-52f8-42b7-8216-1a6861421db9",
            "role": "user",
            "text": "Current child message:\n{{#sys.query#}}",
        },
    ]
    return node


def make_code_node(template, code):
    node = copy.deepcopy(template)
    node["id"] = "1260"
    node["position"] = {"x": 1260, "y": 600}
    node["positionAbsolute"] = copy.deepcopy(node["position"])
    node["height"] = 148
    data = node["data"]
    data["title"] = "Validate Executable Rule IR (Shadow)"
    data["desc"] = "Ground compiler output in current student evidence, merge corrections, and preserve the previous shadow on failure."
    data["code"] = code
    data["variables"] = [
        {"value_selector": ["1250", "text"], "variable": "compiler_text"},
        {"value_selector": ["conversation", "executable_rule_model_json"], "variable": "executable_rule_model_json"},
        {"value_selector": ["1200", "student_model_json"], "variable": "student_model_json"},
        {"value_selector": ["1200", "summary_json"], "variable": "summary_json"},
    ]
    data["outputs"] = {
        "executable_rule_model_json": {"children": None, "type": "string"},
        "rule_ir_shadow_json": {"children": None, "type": "string"},
        "compile_status": {"children": None, "type": "string"},
    }
    return node


def patch_pack_node(node):
    data = node["data"]
    data["variables"].append({
        "value_selector": ["1260", "rule_ir_shadow_json"],
        "variable": "rule_ir_shadow_json",
    })
    code = data["code"]
    old_signature = "last_action_trace_json: str, student_message: str) -> dict:"
    new_signature = "last_action_trace_json: str, student_message: str, rule_ir_shadow_json: str) -> dict:"
    require(old_signature in code, "Pack node signature does not match the v10 r4 baseline")
    code = code.replace(old_signature, new_signature, 1)

    parse_anchor = "gap_evaluation, gap_eval_parse_ok = loads_with_status(gap_evaluation_text)"
    require(parse_anchor in code, "Pack node parse anchor is missing")
    missing_shadow = (
        '{"schema_version": "%s", "status": "error", "rules": [], '
        '"delta": {"added_rule_ids": [], "superseded_rule_ids": [], '
        '"deactivated_rule_ids": []}, "errors": ["shadow output missing"]}'
    ) % SCHEMA_VERSION
    code = code.replace(
        parse_anchor,
        parse_anchor + "\n    rule_ir_shadow = loads(rule_ir_shadow_json, %s)" % missing_shadow,
        1,
    )

    code = code.replace('"dsl_version": "v10",', '"dsl_version": "v10.1",', 1)
    code = code.replace(
        '"build_id": "v10-no-thinking-r4-20260822",',
        '"build_id": "v10.1-rule-ir-shadow-r1-20260822",',
        1,
    )
    debug_anchor = '"action_plan_source": "1510-validated",'
    require(debug_anchor in code, "Pack node debug anchor is missing")
    code = code.replace(
        debug_anchor,
        '"rule_ir_shadow": rule_ir_shadow,\n            "action_source": "legacy_planner",\n            ' + debug_anchor,
        1,
    )
    data["code"] = code


def patch_workflow(document, prompt, code):
    workflow = document.get("workflow")
    require(isinstance(workflow, dict), "Expected a Dify workflow export")
    graph = workflow.get("graph")
    require(isinstance(graph, dict), "Workflow graph is missing")
    require(node_by_id(graph, "1250") is None and node_by_id(graph, "1260") is None, "v10.1 shadow nodes already exist")

    listener_template = node_by_id(graph, "1100")
    code_template = node_by_id(graph, "1200")
    pack_node = node_by_id(graph, "1900")
    save_node = node_by_id(graph, "1950")
    require(listener_template and code_template and pack_node and save_node, "Required v10 r4 baseline nodes are missing")

    llm_nodes = [node for node in graph.get("nodes", []) if node.get("data", {}).get("type") == "llm"]
    require(llm_nodes, "Baseline has no LLM nodes")
    for node in llm_nodes:
        thinking = node.get("data", {}).get("model", {}).get("completion_params", {}).get("thinking")
        require(thinking is False, "Baseline LLM node %s is not thinking=false" % node.get("id"))

    variables = workflow.setdefault("conversation_variables", [])
    require(not any(item.get("name") == "executable_rule_model_json" for item in variables), "Rule model variable already exists")
    variables.append({
        "description": "Validated child-grounded executable rules compiled in shadow; not behavior-authoritative.",
        "id": RULE_MODEL_VARIABLE_ID,
        "name": "executable_rule_model_json",
        "selector": ["conversation", "executable_rule_model_json"],
        "value": '{"schema_version":"%s","rules":[],"last_compile_turn":0}' % SCHEMA_VERSION,
        "value_type": "string",
    })

    for node in graph.get("nodes", []):
        if float(node.get("position", {}).get("x", 0)) >= 950:
            node["position"]["x"] += 620
            node["positionAbsolute"]["x"] += 620

    graph["nodes"].extend([
        make_llm_node(listener_template, prompt),
        make_code_node(code_template, code),
    ])

    graph["edges"] = [
        item for item in graph.get("edges", [])
        if not (str(item.get("source")) == "1200" and str(item.get("target")) == "1300")
    ]
    graph["edges"].extend([
        edge("1200", "1250", "code", "llm"),
        edge("1250", "1260", "llm", "code"),
        edge("1260", "1300", "code", "llm"),
    ])

    patch_pack_node(pack_node)
    save_node["data"]["title"] = "Save v10.1 State"
    save_node["data"]["desc"] = "Persist v10.1 semantic-core state, including non-authoritative executable-rule shadow state."
    save_node["data"]["items"].append({
        "input_type": "variable",
        "operation": "over-write",
        "value": ["1260", "executable_rule_model_json"],
        "variable_selector": ["conversation", "executable_rule_model_json"],
        "write_mode": "over-write",
    })
    save_node["height"] = int(save_node.get("height", 432)) + 36

    document["app"]["name"] = "%s · v10.1 Rule IR Shadow" % document["app"].get("name", "Game Teacher")
    return document


def main():
    parser = argparse.ArgumentParser(description="Build an uncommitted v10.1 Rule IR shadow Dify artifact from the supplied v10 r4 export.")
    parser.add_argument("base", type=Path, help="Path to the v10 semantic-core no-thinking r4 YAML export")
    parser.add_argument("output", type=Path, help="Output YAML path, normally under ignored .artifacts/")
    args = parser.parse_args()

    prompt = (ROOT / "dify/v10_1/rule-ir-compiler-prompt.md").read_text()
    code = (ROOT / "dify/v10_1/rule_ir_shadow_node.py").read_text()
    document = yaml.safe_load(args.base.read_text())
    patched = patch_workflow(document, prompt, code)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(yaml.safe_dump(patched, sort_keys=False, allow_unicode=True, width=120))
    print(args.output)


if __name__ == "__main__":
    main()
