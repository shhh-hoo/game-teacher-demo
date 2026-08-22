# Game Teacher Demo

A short AI-native Lesson Card prototype for US Grade 3–4 learners.

The child teaches Jamie, a capable but bounded same-age friend, a simple game. The child's explanation progressively creates the visible game world Jamie is allowed to understand, Jamie acts only on child-taught rules, real play exposes missing information, and the child repairs the explanation so the world can keep moving.

The current learner loop is:

**Explain → Act → Encounter a real gap → Repair → Reality changes → Continue → Reach a child-taught ending**

The central design boundary is:

> **AI may complete presentation details, but it must not complete the child's game logic.**

Jamie may use ordinary player agency inside rules the child has taught. It may not use pretrained knowledge of a familiar game as a hidden answer key. A phrase such as `any two` delegates the choice of two eligible objects to Jamie; it does not delegate the missing rules of what happens next.

## Current runtime contract

The active experiment line is **v10 semantic-core**. The current validated candidate emits:

```text
debug.dsl_version = v10
debug.build_id = v10-no-thinking-r4-20260822
```

All LLM nodes currently run with `thinking=false`. This is intentional: the DeepSeek/Dify reasoning-output integration proved less reliable than normal JSON mode for the Action Planner, while the no-thinking semantic-core runtime successfully completed an unscripted original full game with grounded completion evidence.

Dify workflow exports are deployment artifacts and are not committed to this repository. A human trace label such as `DIFY_TEST_VERSION=v10-r4` is not proof of the runtime that was actually published; use `DIFY_EXPECT_DSL_VERSION=v10` to check the emitted runtime marker.

### Local v10.1 candidate

The first runtime-migration stage is a local **v10.1 Executable Rule IR Shadow** candidate. It adds a no-thinking semantic rule compiler plus deterministic grounding/merge validation while leaving the v10 Action Planner behavior-authoritative. The generated Dify YAML remains ignored deployment output. See [`dify/v10_1/README.md`](dify/v10_1/README.md) and the [takeover audit](docs/takeover-audit-2026-08-22.md).

## Runtime responsibilities

- **Listener Interpreter** extracts only what the child communicated and maintains grounded listener memory.
- **World Builder + World Guard** progressively materialize a visible world while separating harmless presentation inference from gameplay semantics.
- **Action Planner + Validator** decide what Jamie can physically do now from child-taught procedures and the authorized world state. Structured-output failures are technical failures, not learner failures.
- **Gap Evaluator + Controller** distinguish a genuine communication gap from ordinary player choice, continuation, or pipeline failure.
- **Jamie response + Response Guard** produce short learner-facing dialogue and may not narrate physical actions that the validated plan did not actually authorize.
- **Browser UI** renders `world_patch` first, then executes `ui_action`, so world definition and physical runtime effects remain separate.
- **`/api/chat`** keeps the Dify API key server-side and forwards child messages or game-world events to the published Dify app.

## Completion and reflection

`game_complete=true` is grounded in the game, not in a lesson-state counter. Completion is valid only when:

1. the child taught an ending condition;
2. the authorized world actually reaches that condition; and
3. `completion_evidence` cites child-taught evidence.

A repair may earn an internal `reflection_candidate`, but repair does not immediately trigger a lecture. Any learner-facing reflection is deferred to a later earned moment such as a grounded game ending, stays specific to what happened, and should be at most one short conversational sentence.

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
  "reply": "Okay, I'll water the first flower!",
  "phase": "experience",
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
    "dsl_version": "v10",
    "game_complete": false,
    "completion_evidence": [],
    "pipeline_errors": []
  }
}
```

`world_patch` changes what exists or how the world is defined. `ui_action` changes what physically happens inside that world. Do not pre-apply the same runtime effect in both places.

## Validation

The deterministic E2E harness lives under `tests/e2e/`. The primary regression set is:

```bash
DIFY_TEST_VERSION=v10-r4 DIFY_EXPECT_DSL_VERSION=v10 \
node tests/e2e/run-dify.mjs --scenario golden-path-learning-loop

DIFY_TEST_VERSION=v10-r4 DIFY_EXPECT_DSL_VERSION=v10 \
node tests/e2e/run-dify.mjs --scenario faithful-listener-not-answer-key

DIFY_TEST_VERSION=v10-r4 DIFY_EXPECT_DSL_VERSION=v10 \
node tests/e2e/run-dify.mjs --scenario smart-listener-not-pedantic
```

`tests/e2e/run-ai-full-game.mjs` adds broad unscripted evidence by having an AI child invent and teach a small original game. It passes only on grounded completion with no pending gap or pipeline error. See [`tests/e2e/AI_FULL_GAME.md`](tests/e2e/AI_FULL_GAME.md) and [`tests/e2e/LIVE_TRACE.md`](tests/e2e/LIVE_TRACE.md).

## Repository source of truth

- [`dify/README.md`](dify/README.md) — current v10 runtime architecture and behavioral contract.
- [`tests/e2e/README.md`](tests/e2e/README.md) — deterministic acceptance philosophy and commands.
- [`tests/e2e/AI_FULL_GAME.md`](tests/e2e/AI_FULL_GAME.md) — unscripted full-game completion smoke.
- [`tests/e2e/prd-manual-scenarios.md`](tests/e2e/prd-manual-scenarios.md) — remaining learner-facing/manual QA.
- [`dify/v8/`](dify/v8/) and the old `dify/interpreter-prompt.md` / `dify/lesson-engine.py` files are historical references only; they are not the active v10 workflow source.
