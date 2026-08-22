#!/usr/bin/env python3

import argparse
import ast
import re
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML is required for Dify DSL preflight (python3 -m pip install PyYAML).", file=sys.stderr)
    raise SystemExit(2)


BUILTIN_SELECTORS = {"conversation", "env", "sys"}
REFERENCE_RE = re.compile(r"\{\{#([^.}]+)\.[^}]+#\}\}")


def node_id(value):
    return str(value) if value is not None else ""


def collect_references(value, found):
    if isinstance(value, dict):
        selector = value.get("value_selector") or value.get("variable_selector")
        if isinstance(selector, list) and selector:
            found.add(str(selector[0]))
        for child in value.values():
            collect_references(child, found)
    elif isinstance(value, list):
        for child in value:
            collect_references(child, found)
    elif isinstance(value, str):
        found.update(REFERENCE_RE.findall(value))


def validate_code(node, errors):
    data = node.get("data", {})
    code = data.get("code")
    language = str(data.get("code_language") or "").lower()
    if not isinstance(code, str) or not code.strip():
        errors.append("Code node %s has no source." % node_id(node.get("id")))
        return
    if language in {"python", "python3"}:
        try:
            ast.parse(code)
        except SyntaxError as error:
            errors.append("Code node %s has invalid Python: %s" % (node_id(node.get("id")), error))
    elif language in {"javascript", "js"}:
        with tempfile.NamedTemporaryFile("w", suffix=".js") as handle:
            handle.write(code)
            handle.flush()
            result = subprocess.run(["node", "--check", handle.name], capture_output=True, text=True)
        if result.returncode:
            errors.append("Code node %s has invalid JavaScript: %s" % (
                node_id(node.get("id")), (result.stderr or result.stdout).strip()
            ))
    else:
        errors.append("Code node %s has unsupported code_language=%r." % (node_id(node.get("id")), language))


def emitted_marker_present(nodes, key, expected):
    quoted_key = re.escape(key)
    quoted_value = re.escape(expected)
    patterns = [
        re.compile(r'["\']%s["\']\s*:\s*["\']%s["\']' % (quoted_key, quoted_value)),
        re.compile(r'\b%s\s*=\s*["\']%s["\']' % (quoted_key, quoted_value)),
    ]
    for node in nodes:
        code = str(node.get("data", {}).get("code") or "")
        if any(pattern.search(code) for pattern in patterns):
            return True
    return False


def validate(document, expected_dsl_version, expected_build_id=None, require_rule_ir_shadow=False):
    errors = []
    workflow = document.get("workflow") if isinstance(document, dict) else None
    if not isinstance(workflow, dict):
        return ["Top-level workflow mapping is missing."]
    graph = workflow.get("graph")
    if not isinstance(graph, dict):
        return ["workflow.graph mapping is missing."]

    nodes = graph.get("nodes")
    edges = graph.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return ["workflow.graph.nodes and workflow.graph.edges must be arrays."]

    ids = [node_id(node.get("id")) for node in nodes if isinstance(node, dict)]
    id_set = set(ids)
    if not ids or any(not item for item in ids):
        errors.append("Every graph node must have a non-empty id.")
    if len(id_set) != len(ids):
        errors.append("Graph node ids must be unique.")

    for edge in edges:
        source = node_id(edge.get("source"))
        target = node_id(edge.get("target"))
        if source not in id_set:
            errors.append("Edge %s references missing source %s." % (edge.get("id"), source))
        if target not in id_set:
            errors.append("Edge %s references missing target %s." % (edge.get("id"), target))

    references = set()
    for node in nodes:
        data = node.get("data", {})
        collect_references(data, references)
        if data.get("type") == "llm":
            thinking = data.get("model", {}).get("completion_params", {}).get("thinking")
            if thinking is not False:
                errors.append("LLM node %s (%s) must set thinking=false; got %r." % (
                    node_id(node.get("id")), data.get("title"), thinking
                ))
        if data.get("type") == "code":
            validate_code(node, errors)

    for reference in sorted(references - BUILTIN_SELECTORS):
        if reference not in id_set:
            errors.append("Workflow variable/prompt reference points to missing node %s." % reference)

    if not emitted_marker_present(nodes, "dsl_version", expected_dsl_version):
        errors.append("No Code node emits debug.dsl_version=%r." % expected_dsl_version)
    if expected_build_id and not emitted_marker_present(nodes, "build_id", expected_build_id):
        errors.append("No Code node emits debug.build_id=%r." % expected_build_id)

    if require_rule_ir_shadow:
        variable_names = {str(item.get("name")) for item in workflow.get("conversation_variables", []) if isinstance(item, dict)}
        if "executable_rule_model_json" not in variable_names:
            errors.append("Conversation variable executable_rule_model_json is missing.")
        titles = {str(node.get("data", {}).get("title")) for node in nodes}
        for title in ["AI · Executable Rule Compiler (Shadow)", "Validate Executable Rule IR (Shadow)"]:
            if title not in titles:
                errors.append("Required shadow node %r is missing." % title)
        if not any("rule_ir_shadow" in str(node.get("data", {}).get("code") or "") for node in nodes):
            errors.append("No Code node exposes rule_ir_shadow telemetry.")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Static preflight for a local Dify workflow export.")
    parser.add_argument("dsl", type=Path)
    parser.add_argument("--expect-dsl-version", required=True)
    parser.add_argument("--expect-build-id")
    parser.add_argument("--require-rule-ir-shadow", action="store_true")
    args = parser.parse_args()

    try:
        document = yaml.safe_load(args.dsl.read_text())
    except Exception as error:
        print("FAIL · DSL did not parse: %s" % error)
        return 1

    errors = validate(
        document,
        expected_dsl_version=args.expect_dsl_version,
        expected_build_id=args.expect_build_id,
        require_rule_ir_shadow=args.require_rule_ir_shadow,
    )
    if errors:
        print("FAIL · %s preflight error(s)" % len(errors))
        for error in errors:
            print("- %s" % error)
        return 1

    nodes = document["workflow"]["graph"]["nodes"]
    llm_count = sum(1 for node in nodes if node.get("data", {}).get("type") == "llm")
    code_count = sum(1 for node in nodes if node.get("data", {}).get("type") == "code")
    print("PASS · DSL parses · %s nodes · %s LLM thinking=false · %s Code nodes valid" % (
        len(nodes), llm_count, code_count
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
