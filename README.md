# Game Teacher Demo

A short AI-native Lesson Card prototype for US Grade 3–4 learners.

The child first experiences Jamie giving one short, complete procedure for a tiny fixed game. The roles then reverse: the child teaches Jamie a game they know, Jamie acts only on child-taught rules, real play exposes missing information, and the child repairs the explanation until Jamie can play. Guided support then disappears and a fresh-listener Jamie must be taught again before the lesson can finish.

The v11 learner loop is:

**Model → Experience → Real gap → Teach/Repair → Guided replay → Fresh-listener independent replay → Transfer → Complete**

The central design boundary is:

> **AI may complete presentation details, but it must not complete the child's game logic.**

Jamie may use ordinary player agency inside rules the child has taught. It may not use pretrained knowledge of a familiar game as a hidden answer key. A phrase such as `any two` delegates the choice of two eligible objects to Jamie; it does not delegate missing gameplay rules.

## Runtime status

`main` remains the locked v10 behavioural fallback:

```text
debug.dsl_version = v10
debug.build_id = v10-no-thinking-r4-20260822
```

This branch is the direct v11 delivery path. Intermediate v10.1/v10.2/v10.3 workflows are architecture references, not deployment milestones. The target v11 runtime identity is:

```text
debug.dsl_version = v11
debug.build_id = v11-runtime-first-mastery-gate-r1-20260823
```

All LLM nodes run with `thinking=false`.

Dify workflow exports are deployment artifacts and are intentionally not committed to this repository. Human trace labels are not proof of what is published; the harness checks the emitted `debug.dsl_version` and can also require `debug.build_id`.

## v11 runtime responsibilities

- **Listener Interpreter** extracts only what the child communicated. Durable student evidence and the active Jamie listener model are separate states.
- **World Builder + World Guard** progressively materialize a visible world while separating harmless presentation inference from gameplay semantics.
- **Executable Rule Compiler + Validator** compile only current child-taught gameplay meaning into a limited Rule IR. Corrections supersede earlier rules rather than silently mutating history.
- **Deterministic Runtime Primary** owns supported physical transitions from validated Rule IR and authorized world state.
- **Bounded Semantic Resolver** is used only when the deterministic Runtime cannot safely execute an existing grounded transition. It may not become a second rule compiler.
- **Gap Evaluator + Full-Lesson Controller** distinguish real communication gaps from ordinary player choice or technical failure and own phase progression.
- **Jamie response + Response Guard** produce short learner-facing dialogue and may not narrate physical actions that the validated plan did not authorize.
- **Browser UI** renders definition deltas separately from physical actions. When a completed replay triggers a reset, the final grounded action is shown first, then the world resets.
- **`/api/chat`** keeps the Dify API key server-side and forwards child messages or game-world events to the published Dify app.

## Lesson and mastery contract

The fixed Rabbit Star Hop model gives its complete four-step procedure before the learner acts. Jamie does not reveal a new rule after every click; the model is meant to demonstrate what a usable procedure sounds like.

The first genuine blocking listener gap earns the explicit teaching moment. Repair must change executable behaviour and play must continue.

Practice remains scaffolded until the child-taught ending is actually reached. v11 requires **one complete, grounded guided replay**, which may span multiple actions. Individual successful actions are evidence, but they do not advance the learner to independent practice by themselves.

The independent phase uses a fresh listener: durable student evidence remains available for evaluation, but active listener knowledge, executable Rule IR, pending gap state, and game progress are reset to the preserved baseline. Support is removed. A bare `Go ahead` may not reuse the previous Jamie's rules.

`game_complete` and `lesson_complete` are separate. A child-grounded ending can complete a game; the lesson completes only after the fresh-listener replay and a short substantive transfer response.

## Run locally

This demo has no local lesson-logic mock. Create `.env.local` from `.env.example`, point it at the published Dify app, then run:

```bash
set -a
source .env.local
set +a
npx vercel dev
```

Open the local URL printed by Vercel.

## Frontend response contract

The browser expects a payload in this shape:

```json
{
  "reply": "Okay, I'll move now.",
  "phase": "practice",
  "world_patch": {
    "add_objects": [],
    "update_objects": [],
    "ready": true
  },
  "ui_action": {
    "type": "action_sequence",
    "payload": {
      "actions": []
    }
  },
  "support": null,
  "capture_baseline": false,
  "debug": {
    "dsl_version": "v11",
    "build_id": "v11-runtime-first-mastery-gate-r1-20260823",
    "game_complete": false,
    "completion_evidence": [],
    "pipeline_errors": []
  }
}
```

`world_patch` changes what exists or how the world is defined. `ui_action` changes what physically happens inside that world. Do not pre-apply the same runtime effect in both places.

## Validation

During implementation, prefer structural/micro checks. Once the v11 vertical slice is coherent, run the direct v11 lesson contract and then one regression pass rather than repeatedly deploying intermediate architectures.

```bash
DIFY_TEST_VERSION=v11-direct \
DIFY_EXPECT_DSL_VERSION=v11 \
DIFY_EXPECT_BUILD_ID=v11-runtime-first-mastery-gate-r1-20260823 \
node tests/e2e/run-v11-lesson-contract.mjs --verbose

DIFY_TEST_VERSION=v11-direct \
DIFY_EXPECT_DSL_VERSION=v11 \
DIFY_EXPECT_BUILD_ID=v11-runtime-first-mastery-gate-r1-20260823 \
node tests/e2e/run-dify.mjs --version v11 --scenario golden-path-learning-loop
```

The dedicated v11 lesson runner is authoritative for the mastery gate: ordinary successful actions must remain in guided `practice`; only a grounded completed replay may trigger the fresh-listener reset.

`tests/e2e/run-ai-full-game.mjs` remains broad unscripted evidence, but its v10 completion semantics must not be treated as a v11 lesson-completion gate until it is updated to continue through independent + transfer.

## Repository source of truth

- [`AGENTS.md`](AGENTS.md) — behavioural and repository invariants.
- [`dify/README.md`](dify/README.md) — locked v10 baseline and Dify architecture context.
- [`tests/e2e/README.md`](tests/e2e/README.md) — deterministic acceptance philosophy and commands.
- [`tests/e2e/AI_FULL_GAME.md`](tests/e2e/AI_FULL_GAME.md) — unscripted full-game completion smoke.
- [`tests/e2e/prd-manual-scenarios.md`](tests/e2e/prd-manual-scenarios.md) — learner-facing/manual QA.
- [`dify/v8/`](dify/v8/) and the old `dify/interpreter-prompt.md` / `dify/lesson-engine.py` files are historical references only.
