import copy
import json
import re

SCHEMA_VERSION = "v10.1-shadow-1"
SUPPORTED_EFFECTS = {
    "update_object",
    "reveal_object",
    "hide_object",
    "remove_object",
    "set_turn",
    "set_counter",
    "set_status",
    "complete_game",
    "repeat",
}
RULE_KINDS = {"action", "transition", "constraint", "sequence", "termination"}
FORBIDDEN_KEYS = {"code", "source_code", "script", "javascript", "python"}
EFFECTS_BY_ACTION_TYPE = {
    "set_state": {"update_object", "set_status"},
    "reveal": {"reveal_object", "update_object"},
    "hide": {"hide_object", "update_object"},
    "collect": {"remove_object", "update_object", "set_counter"},
    "move": {"update_object"},
    "remove": {"remove_object", "update_object"},
    "switch_turn": {"set_turn"},
    "keep_turn": {"set_turn"},
    "repeat": {"repeat"},
    "finish": {"complete_game", "set_status"},
    "custom": SUPPORTED_EFFECTS - {"complete_game"},
}


def loads(value, default):
    if isinstance(value, (dict, list)):
        return copy.deepcopy(value)
    if value is None:
        return copy.deepcopy(default)
    text = str(value).strip()
    candidates = [text]
    unfenced = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
    unfenced = re.sub(r"\s*```$", "", unfenced)
    if unfenced != text:
        candidates.append(unfenced)
    match = re.search(r"\{.*\}", unfenced, flags=re.S)
    if match:
        candidates.append(match.group(0))
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, (dict, list)):
                return parsed
        except Exception:
            pass
    return copy.deepcopy(default)


def stable_rule_id(semantic_key, turn):
    slug = re.sub(r"[^a-z0-9]+", "_", str(semantic_key or "").lower()).strip("_")
    return "rule_%s_t%s" % ((slug[:56] or "instruction"), int(turn or 0))


def contains_forbidden_key(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if str(key).lower() in FORBIDDEN_KEYS or contains_forbidden_key(child):
                return True
    elif isinstance(value, list):
        return any(contains_forbidden_key(item) for item in value)
    return False


def instruction_map(student, turn):
    result = {}
    for instruction in student.get("instructions", []) or []:
        if not isinstance(instruction, dict):
            continue
        if int(instruction.get("turn", 0) or 0) != turn:
            continue
        key = str(instruction.get("semantic_key") or "").strip()
        if key:
            result[key] = instruction
    return result


def student_message(student, turn):
    for message in reversed(student.get("messages", []) or []):
        if isinstance(message, dict) and int(message.get("turn", 0) or 0) == turn:
            return str(message.get("text") or "").strip()
    return ""


def semantic_signature(rule):
    return json.dumps(
        {
            "kind": rule.get("kind"),
            "when": rule.get("when"),
            "condition": rule.get("condition"),
            "effects": rule.get("effects"),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def validated_rule(candidate, instruction, turn, message):
    if not isinstance(candidate, dict):
        return None, "candidate is not an object"
    semantic_key = str(candidate.get("semantic_key") or "").strip()
    kind = str(candidate.get("kind") or "").strip()
    when = candidate.get("when")
    condition = candidate.get("condition")
    effects = candidate.get("effects")

    if not semantic_key:
        return None, "semantic_key is missing"
    if kind not in RULE_KINDS:
        return None, "unsupported rule kind for %s" % semantic_key
    if not isinstance(when, dict) or not when:
        return None, "when must be a non-empty object for %s" % semantic_key
    if condition is not None and not isinstance(condition, dict):
        return None, "condition must be null or an object for %s" % semantic_key
    if not isinstance(effects, list) or not effects:
        return None, "effects must be a non-empty array for %s" % semantic_key
    if contains_forbidden_key(candidate):
        return None, "executable source code is not allowed in rule %s" % semantic_key
    instruction_action_type = str(instruction.get("action_type") or "custom").strip()
    allowed_effects = EFFECTS_BY_ACTION_TYPE.get(instruction_action_type, EFFECTS_BY_ACTION_TYPE["custom"])
    for effect in effects:
        if not isinstance(effect, dict) or str(effect.get("type") or "") not in SUPPORTED_EFFECTS:
            return None, "unsupported effect in rule %s" % semantic_key
        if str(effect.get("type") or "") not in allowed_effects:
            return None, "effect %s is not grounded by instruction action_type=%s for %s" % (
                effect.get("type"), instruction_action_type, semantic_key
            )

    quote = message or str(instruction.get("evidence") or instruction.get("description") or "").strip()
    rule = {
        "id": stable_rule_id(semantic_key, turn),
        "semantic_key": semantic_key,
        "status": "active",
        "kind": kind,
        "when": copy.deepcopy(when),
        "condition": copy.deepcopy(condition),
        "effects": copy.deepcopy(effects),
        "provenance": {
            "source": "student",
            "evidence": [{"turn_index": turn, "quote": quote}],
            "instruction": {
                "semantic_key": semantic_key,
                "trigger": instruction.get("trigger"),
                "action_type": instruction.get("action_type"),
                "target_description": instruction.get("target_description"),
                "description": instruction.get("description"),
            },
        },
        "supersedes": [],
    }
    return rule, None


def main(compiler_text: str, executable_rule_model_json: str,
         student_model_json: str, summary_json: str) -> dict:
    previous = loads(executable_rule_model_json, {"schema_version": SCHEMA_VERSION, "rules": [], "last_compile_turn": 0})
    student = loads(student_model_json, {"instructions": [], "messages": [], "turn_count": 0})
    summary = loads(summary_json, {})
    compiler = loads(compiler_text, None)

    rules = [copy.deepcopy(rule) for rule in previous.get("rules", []) if isinstance(rule, dict)]
    turn = int(summary.get("turn_count", student.get("turn_count", 0)) or 0)
    current_instructions = instruction_map(student, turn)
    message = student_message(student, turn)
    errors = []
    unsupported = []
    added_ids = []
    superseded_ids = []
    deactivated_ids = []

    if not isinstance(compiler, dict):
        status = "error"
        errors.append("compiler output was not valid JSON")
        proposed = []
        unsupported_raw = []
    elif compiler.get("schema_version") != SCHEMA_VERSION:
        status = "error"
        errors.append("compiler schema_version mismatch")
        proposed = []
        unsupported_raw = []
    else:
        status = str(compiler.get("status") or "error")
        if status not in {"ok", "partial", "unsupported"}:
            errors.append("compiler returned an unknown status")
            status = "error"
        proposed = compiler.get("proposed_rules") if isinstance(compiler.get("proposed_rules"), list) else []
        unsupported_raw = compiler.get("unsupported") if isinstance(compiler.get("unsupported"), list) else []

    proposed_keys = set()
    for candidate in proposed:
        key = str(candidate.get("semantic_key") or "").strip() if isinstance(candidate, dict) else ""
        instruction = current_instructions.get(key)
        if not instruction:
            errors.append("proposed rule is not grounded in a current-turn instruction: %s" % (key or "<missing>"))
            continue
        if key in proposed_keys:
            errors.append("duplicate proposed semantic_key: %s" % key)
            continue
        proposed_keys.add(key)

        rule, error = validated_rule(candidate, instruction, turn, message)
        if error:
            errors.append(error)
            continue

        active_same_key = [
            old for old in rules
            if old.get("status") == "active" and str(old.get("semantic_key") or "") == key
        ]
        if active_same_key and semantic_signature(active_same_key[-1]) == semantic_signature(rule):
            continue

        for old in active_same_key:
            old["status"] = "superseded"
            superseded_ids.append(str(old.get("id")))
            rule["supersedes"].append(str(old.get("id")))
        rules.append(rule)
        added_ids.append(rule["id"])

    for item in unsupported_raw:
        if not isinstance(item, dict):
            continue
        key = str(item.get("semantic_key") or "").strip()
        if key not in current_instructions:
            errors.append("unsupported entry is not grounded in a current-turn instruction: %s" % (key or "<missing>"))
            continue
        unsupported.append({
            "semantic_key": key,
            "reason": str(item.get("reason") or "unsupported semantic condition").strip(),
        })

    accounted = proposed_keys.union(item["semantic_key"] for item in unsupported)
    for key in current_instructions:
        if key not in accounted:
            unsupported.append({"semantic_key": key, "reason": "compiler did not account for this instruction"})

    if status != "error":
        if errors:
            status = "partial" if added_ids else "error"
        elif unsupported and added_ids:
            status = "partial"
        elif unsupported and not added_ids and current_instructions:
            status = "unsupported"
        else:
            status = "ok"

    rules = rules[-80:]
    retained_ids = {str(rule.get("id")) for rule in rules}
    for rule in rules:
        if "supersedes" in rule:
            rule["supersedes"] = [
                old_id for old_id in rule.get("supersedes", [])
                if str(old_id) in retained_ids
            ]
    added_ids = [rule_id for rule_id in added_ids if rule_id in retained_ids]
    superseded_ids = [rule_id for rule_id in superseded_ids if rule_id in retained_ids]
    deactivated_ids = [rule_id for rule_id in deactivated_ids if rule_id in retained_ids]
    model = {
        "schema_version": SCHEMA_VERSION,
        "rules": rules,
        "last_compile_turn": turn,
    }
    shadow = {
        "schema_version": SCHEMA_VERSION,
        "status": status,
        "rules": rules,
        "delta": {
            "added_rule_ids": added_ids,
            "superseded_rule_ids": superseded_ids,
            "deactivated_rule_ids": deactivated_ids,
        },
        "unsupported": unsupported,
        "errors": errors,
    }
    return {
        "executable_rule_model_json": json.dumps(model, ensure_ascii=False),
        "rule_ir_shadow_json": json.dumps(shadow, ensure_ascii=False),
        "compile_status": status,
    }
