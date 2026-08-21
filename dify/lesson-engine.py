import json
import re
from copy import deepcopy

ALLOWED_SURFACES = {"table", "grid"}
ALLOWED_KINDS = {"card", "token", "piece", "cell", "marker", "object"}
ALLOWED_STATES = {"available", "empty", "face_up", "face_down", "active", "claimed", "removed"}
ALLOWED_ACTIONS = {
    "update_object",
    "reveal_object",
    "hide_object",
    "remove_object",
    "set_turn",
    "set_counter",
    "set_status",
    "wait",
    "reset_to_baseline",
}

TEACHING = {
    "completeness": {
        "headline": "Your friend cannot see the game in your head.",
        "principle": "A new player needs the parts that feel obvious to you too.",
        "question": "What does your friend still need before they can make the next move?",
    },
    "sequencing": {
        "headline": "Give information when the listener needs it.",
        "principle": "A later rule is hard to use if the earlier step it depends on is still missing.",
        "question": "What has to be clear before this step makes sense?",
    },
    "specificity": {
        "headline": "Make the next action unmistakable.",
        "principle": "A useful instruction should let the listener tell what to do without guessing between different actions.",
        "question": "What could you say so Jamie knows exactly what to do next?",
    },
    "relevance": {
        "headline": "Start with information that changes what the listener can do.",
        "principle": "Interesting details can wait if they do not help the new player build or make the next move.",
        "question": "Which part would help Jamie act right now?",
    },
}


def _loads(value, default):
    if value is None or value == "":
        return deepcopy(default)
    if isinstance(value, (dict, list)):
        return deepcopy(value)
    try:
        return json.loads(value)
    except Exception:
        return deepcopy(default)


def _text(value, limit=240):
    return str(value or "").strip()[:limit]


def _bool(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def _bounded_int(value, low, high, default=0):
    try:
        number = int(value)
    except Exception:
        return default
    return max(low, min(high, number))


def _default_world():
    return {
        "name": "Your game",
        "surface": {"type": "table", "rows": 0, "columns": 0},
        "objects": [],
        "counters": [],
        "turn": None,
        "status": "Jamie is waiting for you to describe the game.",
        "ready": False,
    }


def _sanitize_surface(raw):
    raw = raw if isinstance(raw, dict) else {}
    surface_type = raw.get("type") if raw.get("type") in ALLOWED_SURFACES else "table"
    return {
        "type": surface_type,
        "rows": _bounded_int(raw.get("rows"), 0, 8, 0),
        "columns": _bounded_int(raw.get("columns"), 0, 8, 3 if surface_type == "grid" else 0),
    }


def _sanitize_object(raw, partial=False):
    if not isinstance(raw, dict):
        return None
    if not partial and not raw.get("id"):
        return None

    result = {}
    if raw.get("id"):
        result["id"] = re.sub(r"[^a-zA-Z0-9_.:-]", "_", _text(raw.get("id"), 64))
    if not partial or "kind" in raw:
        result["kind"] = raw.get("kind") if raw.get("kind") in ALLOWED_KINDS else "object"
    if not partial or "label" in raw:
        result["label"] = _text(raw.get("label"), 80)
    if not partial or "symbol" in raw:
        result["symbol"] = _text(raw.get("symbol"), 12)
    if not partial or "caption" in raw:
        result["caption"] = _text(raw.get("caption"), 80)
    if not partial or "state" in raw:
        result["state"] = raw.get("state") if raw.get("state") in ALLOWED_STATES else "available"
    if not partial or "row" in raw:
        row = raw.get("row")
        result["row"] = None if row in (None, "") else _bounded_int(row, 1, 8, 1)
    if not partial or "column" in raw:
        column = raw.get("column")
        result["column"] = None if column in (None, "") else _bounded_int(column, 1, 8, 1)
    if not partial or "owner" in raw:
        result["owner"] = None if raw.get("owner") is None else _text(raw.get("owner"), 40)
    if not partial or "interactive" in raw:
        result["interactive"] = _bool(raw.get("interactive"))
    return result


def _sanitize_counter(raw):
    if not isinstance(raw, dict) or not raw.get("id"):
        return None
    value = raw.get("value", 0)
    if not isinstance(value, (str, int, float)):
        value = 0
    return {
        "id": re.sub(r"[^a-zA-Z0-9_.:-]", "_", _text(raw.get("id"), 64)),
        "label": _text(raw.get("label") or raw.get("id"), 40),
        "value": value,
    }


def _sanitize_world(raw):
    world = _default_world()
    if not isinstance(raw, dict):
        return world
    if "name" in raw:
        world["name"] = _text(raw.get("name"), 80) or "Your game"
    if "surface" in raw:
        world["surface"] = _sanitize_surface(raw.get("surface"))
    if isinstance(raw.get("objects"), list):
        world["objects"] = [item for item in (_sanitize_object(x) for x in raw["objects"][:36]) if item]
    if isinstance(raw.get("counters"), list):
        world["counters"] = [item for item in (_sanitize_counter(x) for x in raw["counters"][:8]) if item]
    if "turn" in raw:
        world["turn"] = None if raw.get("turn") is None else _text(raw.get("turn"), 40)
    if "status" in raw:
        world["status"] = _text(raw.get("status"), 180)
    if "ready" in raw:
        world["ready"] = _bool(raw.get("ready"))
    return world


def _sanitize_world_patch(raw):
    patch = _loads(raw, {})
    if not isinstance(patch, dict):
        return {}
    result = {}
    if "replace" in patch and isinstance(patch["replace"], dict):
        result["replace"] = _sanitize_world(patch["replace"])
        return result
    if "name" in patch:
        result["name"] = _text(patch.get("name"), 80)
    if "surface" in patch:
        result["surface"] = _sanitize_surface(patch.get("surface"))
    if "status" in patch:
        result["status"] = _text(patch.get("status"), 180)
    if "ready" in patch:
        result["ready"] = _bool(patch.get("ready"))
    if "turn" in patch:
        result["turn"] = None if patch.get("turn") is None else _text(patch.get("turn"), 40)
    if isinstance(patch.get("add_objects"), list):
        result["add_objects"] = [item for item in (_sanitize_object(x) for x in patch["add_objects"][:36]) if item]
    if isinstance(patch.get("update_objects"), list):
        updates = []
        for raw_item in patch["update_objects"][:36]:
            item = _sanitize_object(raw_item, partial=True)
            if item and item.get("id"):
                updates.append(item)
        result["update_objects"] = updates
    if isinstance(patch.get("remove_object_ids"), list):
        result["remove_object_ids"] = [_text(x, 64) for x in patch["remove_object_ids"][:36] if _text(x, 64)]
    if isinstance(patch.get("counters"), list):
        result["counters"] = [item for item in (_sanitize_counter(x) for x in patch["counters"][:8]) if item]
    return result


def _apply_world_patch(world, patch):
    world = _sanitize_world(world)
    if not patch:
        return world
    if "replace" in patch:
        return _sanitize_world(patch["replace"])

    if "name" in patch and patch["name"]:
        world["name"] = patch["name"]
    if "surface" in patch:
        world["surface"] = patch["surface"]
    if "status" in patch:
        world["status"] = patch["status"]
    if "ready" in patch:
        world["ready"] = patch["ready"]
    if "turn" in patch:
        world["turn"] = patch["turn"]

    by_id = {str(item["id"]): deepcopy(item) for item in world.get("objects", []) if item.get("id")}
    for object_id in patch.get("remove_object_ids", []):
        by_id.pop(str(object_id), None)
    for item in patch.get("add_objects", []):
        by_id[str(item["id"])] = deepcopy(item)
    for update in patch.get("update_objects", []):
        object_id = str(update.get("id", ""))
        if object_id and object_id in by_id:
            by_id[object_id].update({k: v for k, v in update.items() if k != "id"})
    world["objects"] = list(by_id.values())[:36]

    if "counters" in patch:
        world["counters"] = deepcopy(patch["counters"][:8])
    return world


def _sanitize_rule_updates(raw):
    values = _loads(raw, [])
    if not isinstance(values, list):
        return []
    result = []
    for item in values[:24]:
        if not isinstance(item, dict):
            continue
        key = _text(item.get("key"), 96)
        instruction = _text(item.get("instruction"), 300)
        if not key or not instruction:
            continue
        plan = item.get("plan") if isinstance(item.get("plan"), list) else []
        result.append({
            "key": key,
            "instruction": instruction,
            "plan": [_text(step, 160) for step in plan[:12] if _text(step, 160)],
        })
    return result


def _merge_listener_model(model, updates, summary):
    model = model if isinstance(model, dict) else {}
    rules = model.get("rules") if isinstance(model.get("rules"), dict) else {}
    for update in updates:
        rules[update["key"]] = {"instruction": update["instruction"], "plan": update["plan"]}
    model["rules"] = rules
    if summary:
        model["summary"] = _text(summary, 500)
    return model


def _sanitize_action(raw, world):
    if not isinstance(raw, dict) or raw.get("type") not in ALLOWED_ACTIONS:
        return None
    action_type = raw["type"]
    object_ids = {str(item.get("id")) for item in world.get("objects", []) if item.get("id")}

    if action_type in {"reveal_object", "hide_object", "remove_object", "update_object"}:
        object_id = _text(raw.get("object_id"), 64)
        if object_id not in object_ids:
            return None
        action = {"type": action_type, "object_id": object_id}
        if action_type == "update_object":
            patch = _sanitize_object(raw.get("patch", {}), partial=True) or {}
            patch.pop("id", None)
            action["patch"] = patch
        return action

    if action_type == "set_turn":
        return {"type": action_type, "to": _text(raw.get("to"), 40)}
    if action_type == "set_counter":
        counter_id = _text(raw.get("counter_id"), 64)
        if not counter_id:
            return None
        value = raw.get("value", 0)
        if not isinstance(value, (str, int, float)):
            value = 0
        return {"type": action_type, "counter_id": counter_id, "label": _text(raw.get("label"), 40), "value": value}
    if action_type == "set_status":
        return {"type": action_type, "text": _text(raw.get("text"), 180)}
    if action_type == "wait":
        return {"type": action_type, "ms": _bounded_int(raw.get("ms"), 0, 2000, 300)}
    if action_type == "reset_to_baseline":
        return {"type": action_type}
    return None


def _sanitize_actions(raw, world):
    values = _loads(raw, [])
    if not isinstance(values, list):
        return []
    result = []
    for item in values[:12]:
        action = _sanitize_action(item, world)
        if action:
            result.append(action)
    return result


def _apply_action(world, action, baseline=None):
    if action.get("type") == "reset_to_baseline" and baseline:
        return _sanitize_world(deepcopy(baseline))

    world = deepcopy(world)
    objects = {str(item.get("id")): item for item in world.get("objects", []) if item.get("id")}
    action_type = action.get("type")

    if action_type == "reveal_object" and action.get("object_id") in objects:
        objects[action["object_id"]]["state"] = "face_up"
    elif action_type == "hide_object" and action.get("object_id") in objects:
        objects[action["object_id"]]["state"] = "face_down"
    elif action_type == "remove_object" and action.get("object_id") in objects:
        objects[action["object_id"]]["state"] = "removed"
    elif action_type == "update_object" and action.get("object_id") in objects:
        objects[action["object_id"]].update(action.get("patch", {}))
    elif action_type == "set_turn":
        world["turn"] = action.get("to") or None
    elif action_type == "set_status":
        world["status"] = action.get("text", "")
    elif action_type == "set_counter":
        counters = {str(item.get("id")): item for item in world.get("counters", []) if item.get("id")}
        counter_id = action.get("counter_id")
        counters[counter_id] = {
            "id": counter_id,
            "label": action.get("label") or counters.get(counter_id, {}).get("label") or counter_id,
            "value": action.get("value", 0),
        }
        world["counters"] = list(counters.values())[:8]

    world["objects"] = list(objects.values())[:36]
    return world


def _patch_trace(patch, world_before):
    if not patch:
        return []
    if "replace" in patch:
        return ["Rebuild the game world from the corrected description"]
    labels = {str(item.get("id")): item.get("label") or item.get("symbol") or item.get("id") for item in world_before.get("objects", [])}
    trace = []
    if patch.get("name"):
        trace.append(f"Name the game {patch['name']}")
    if patch.get("surface"):
        surface = patch["surface"]
        if surface.get("type") == "grid":
            rows = surface.get("rows") or "?"
            columns = surface.get("columns") or "?"
            trace.append(f"Build a {rows} × {columns} grid")
        else:
            trace.append("Build a tabletop play area")
    for item in patch.get("add_objects", [])[:6]:
        trace.append(f"Add {item.get('label') or item.get('symbol') or item.get('id') or 'a game object'}")
    for item in patch.get("update_objects", [])[:6]:
        trace.append(f"Change {labels.get(str(item.get('id')), item.get('id') or 'a game object')}")
    for object_id in patch.get("remove_object_ids", [])[:6]:
        trace.append(f"Remove {labels.get(str(object_id), object_id)}")
    if patch.get("counters"):
        trace.append("Update the game counters")
    return trace[:12]


def _action_trace(actions, world_before):
    names = {str(item.get("id")): item.get("label") or item.get("symbol") or item.get("id") for item in world_before.get("objects", [])}
    trace = []
    for action in actions:
        kind = action.get("type")
        label = names.get(str(action.get("object_id")), str(action.get("object_id") or "object"))
        if kind == "reveal_object":
            trace.append(f"Reveal {label}")
        elif kind == "hide_object":
            trace.append(f"Hide {label}")
        elif kind == "remove_object":
            trace.append(f"Remove {label}")
        elif kind == "update_object":
            trace.append(f"Change {label}")
        elif kind == "set_turn":
            trace.append(f"Set the turn to {action.get('to') or 'nobody'}")
        elif kind == "set_counter":
            trace.append(f"Update {action.get('label') or action.get('counter_id')}")
        elif kind == "set_status":
            trace.append(action.get("text") or "Update the game")
    return trace[:12]


def _teaching_support(focus, gap, micro=False):
    focus = focus if focus in TEACHING else "completeness"
    teaching = TEACHING[focus]
    return {
        "type": "micro_teach" if micro else "teach_moment",
        "focus": focus,
        "headline": teaching["headline"],
        "principle": teaching["principle"],
        "listener_gap": _text(gap, 180),
        "question": teaching["question"],
    }


def main(
    policy_json: str,
    world_json: str,
    listener_model_json: str,
    baseline_world_json: str,
    scene_snapshot_json: str,
    last_action_trace_json: str,
    repair_count,
    teach_count,
    practice_success_count,
    independent_success_count,
    world_patch_json: str,
    rule_updates_json: str,
    listener_summary: str,
    proposed_actions_json: str,
    communication_focus: str,
    gap_reason: str,
    world_ready,
    guided_success,
    independent_success,
) -> dict:
    policy = _loads(policy_json, {})
    mode = _text(policy.get("mode"), 64) or "continue"
    next_phase = _text(policy.get("next_phase"), 32) or "experience"
    allow_world_patch = _bool(policy.get("allow_world_patch", True))
    allow_actions = _bool(policy.get("allow_actions", False))
    reset_listener = _bool(policy.get("reset_listener", False))
    reset_to_baseline = _bool(policy.get("reset_to_baseline", False))
    repair_mode = _text(policy.get("repair_mode"), 32)
    teach_support = _text(policy.get("teach_support"), 32)

    world = _sanitize_world(_loads(world_json, _default_world()))
    baseline = _loads(baseline_world_json, {})
    baseline = _sanitize_world(baseline) if baseline else None
    scene_snapshot = _loads(scene_snapshot_json, {})
    scene_snapshot = _sanitize_world(scene_snapshot) if scene_snapshot else None
    trace = _loads(last_action_trace_json, [])
    trace = [_text(x, 160) for x in trace[:12] if _text(x, 160)] if isinstance(trace, list) else []
    listener_model = _loads(listener_model_json, {"rules": {}, "summary": "Jamie has not learned any rules yet."})

    repair_count = max(0, _int(repair_count))
    teach_count = max(0, _int(teach_count))
    practice_success_count = max(0, _int(practice_success_count))
    independent_success_count = max(0, _int(independent_success_count))

    raw_patch = _sanitize_world_patch(world_patch_json) if allow_world_patch else {}
    rule_updates = _sanitize_rule_updates(rule_updates_json)

    # Global repair can replay an action scene, while world-construction repair simply patches the visible world.
    frontend_patch = deepcopy(raw_patch)
    if repair_mode == "replay" and scene_snapshot:
        world = _sanitize_world(scene_snapshot)
        world_before_patch = deepcopy(world)
        build_trace = _patch_trace(raw_patch, world_before_patch)
        world = _apply_world_patch(world, raw_patch)
        frontend_patch = {"replace": deepcopy(world)}
    else:
        world_before_patch = deepcopy(world)
        build_trace = _patch_trace(raw_patch, world_before_patch)
        world = _apply_world_patch(world, raw_patch)

    if _bool(world_ready):
        world["ready"] = True
        frontend_patch["ready"] = True

    listener_model = _merge_listener_model(listener_model, rule_updates, listener_summary)

    capture_baseline = False
    if world.get("ready") and not baseline and next_phase in {"experience", "teach", "practice", "independent"}:
        baseline = deepcopy(world)
        capture_baseline = True

    actions = _sanitize_actions(proposed_actions_json, world) if allow_actions else []
    ui_actions = []

    if actions:
        before_actions = deepcopy(world)
        scene_snapshot = deepcopy(before_actions)
        trace = (build_trace + _action_trace(actions, before_actions))[:12]
        ui_actions.extend(actions)
        for action in actions:
            world = _apply_action(world, action, baseline)
    elif build_trace:
        trace = build_trace[:12]

    support = None
    focus = communication_focus if communication_focus in TEACHING else "completeness"
    if teach_support == "main":
        teach_count = max(teach_count, 1)
        support = _teaching_support(focus, gap_reason, micro=False)
    elif teach_support == "micro":
        teach_count += 1
        support = _teaching_support(focus, gap_reason, micro=True)

    if repair_mode == "probe":
        repair_count += 1
    elif repair_mode == "locator":
        repair_count += 1
        support = {
            "type": "locate_step",
            "prompt": "Which part should Jamie change?",
            "steps": trace or ["The last thing Jamie did"],
        }
    elif repair_mode in {"replay", "world"}:
        repair_count = 0

    if mode in {"practice_act", "teach_apply"} and _bool(guided_success):
        practice_success_count += 1
    if mode == "independent_act" and _bool(independent_success):
        independent_success_count += 1

    if reset_listener:
        listener_model = {"rules": {}, "summary": "A fresh listener has not learned any game rules yet."}
        repair_count = 0
        independent_success_count = 0

    if reset_to_baseline and baseline:
        ui_actions.append({"type": "reset_to_baseline"})
        world = deepcopy(baseline)
        scene_snapshot = deepcopy(world)
        trace = []

    ui_action = {"type": "action_sequence", "payload": {"actions": ui_actions}} if ui_actions else {"type": "none", "payload": {}}

    engine_note = {
        "mode": mode,
        "next_phase": next_phase,
        "world_ready": bool(world.get("ready")),
        "world_status": world.get("status", ""),
        "listener_summary": listener_model.get("summary", ""),
        "gap_reason": _text(gap_reason, 180),
        "trace": trace,
        "support_type": support.get("type") if isinstance(support, dict) else None,
    }

    return {
        "world_json": json.dumps(world, ensure_ascii=False),
        "listener_model_json": json.dumps(listener_model, ensure_ascii=False),
        "baseline_world_json": json.dumps(baseline or {}, ensure_ascii=False),
        "scene_snapshot_json": json.dumps(scene_snapshot or {}, ensure_ascii=False),
        "last_action_trace_json": json.dumps(trace, ensure_ascii=False),
        "repair_count": repair_count,
        "teach_count": teach_count,
        "practice_success_count": practice_success_count,
        "independent_success_count": independent_success_count,
        "next_phase": next_phase,
        "world_patch_json": json.dumps(frontend_patch, ensure_ascii=False),
        "ui_action_json": json.dumps(ui_action, ensure_ascii=False),
        "support_json": json.dumps(support, ensure_ascii=False) if support is not None else "null",
        "engine_note_json": json.dumps(engine_note, ensure_ascii=False),
        "capture_baseline": capture_baseline,
    }
