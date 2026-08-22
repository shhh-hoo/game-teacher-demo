#!/usr/bin/env python3

import ast
import re
import sys
from pathlib import Path

import yaml


if len(sys.argv) != 3:
    raise SystemExit("Usage: check-dify-dsl.py candidate.yml expected-version")

path = Path(sys.argv[1])
expected_version = sys.argv[2]
document = yaml.safe_load(path.read_text())
graph = document["workflow"]["graph"]
nodes = graph["nodes"]
node_ids = {str(node["id"]) for node in nodes}
errors = []

for edge in graph["edges"]:
    if str(edge.get("source")) not in node_ids:
        errors.append("missing edge source %s" % edge.get("source"))
    if str(edge.get("target")) not in node_ids:
        errors.append("missing edge target %s" % edge.get("target"))

for node in nodes:
    data = node.get("data", {})
    title = data.get("title", node.get("id"))
    if data.get("type") == "llm":
        thinking = data.get("model", {}).get("completion_params", {}).get("thinking")
        if thinking is not False:
            errors.append("%s must set thinking=false" % title)
    if data.get("type") == "code":
        try:
            ast.parse(data.get("code", ""))
        except SyntaxError as error:
            errors.append("%s has invalid Python: %s" % (title, error))

code_text = "\n".join(
    str(node.get("data", {}).get("code", ""))
    for node in nodes
    if node.get("data", {}).get("type") == "code"
)
marker = re.compile(
    r'["\']dsl_version["\']\s*:\s*["\']%s["\']' % re.escape(expected_version)
)
if not marker.search(code_text):
    errors.append("missing dsl_version=%s marker" % expected_version)

if errors:
    for error in errors:
        print("FAIL · %s" % error)
    raise SystemExit(1)

llm_count = sum(node.get("data", {}).get("type") == "llm" for node in nodes)
print("PASS · %s nodes · %s LLM nodes thinking=false" % (len(nodes), llm_count))
