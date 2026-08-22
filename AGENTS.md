# Repository rules for AI coding agents

## Main branch discipline

`main` is a protected-by-process release branch even if GitHub repository settings do not currently enforce protection.

- Never commit or push changes directly to `main`.
- Start every change from the current `main` on a named feature/fix/rollback branch.
- Open a pull request back to `main` for every code, test, workflow, documentation, or configuration change.
- Keep the PR as draft until the relevant validation is complete.
- Do not merge a PR with known behavior regressions just because structural assertions pass.
- Do not weaken learner-facing acceptance criteria merely to make a broken runtime pass.
- If a trace independently exposes a harness bug, fix the harness and record that distinction instead of treating the test as immutable or blaming the runtime for a test-side error.

Only bypass the PR workflow if the repository owner explicitly instructs you to bypass it in the same task.

## Source-of-truth discipline

Before changing repo behavior, inspect the actual current files, PR/commit state, published runtime marker, and latest trace evidence. Do not infer the implementation from an older chat, an obsolete version label, or a remembered Dify graph.

The current product model is **not** the older Teach → Practice → Independent → Transfer state machine. The current learner-facing loop is:

`child explains → Jamie acts → world changes → real gap if needed → child repairs → reality changes → play continues → child-taught ending`

For Dify lesson-flow work:

1. Treat Dify workflow exports as local/deployment artifacts; do not commit generated `.yml`, compressed, split, or base64 workflow copies to the repository.
2. Record durable behavioral contracts, test semantics, observability requirements, and validation evidence in the repository.
3. Treat learner-facing behavior as the primary acceptance criterion.
4. Preserve child rule authority: familiar-game pretraining is never evidence that a rule was taught.
5. Preserve ordinary player agency: `any one` / `any two` / equivalent delegation lets Jamie choose among currently eligible equivalent options.
6. An executable taught instruction must not silently degrade to an empty action plan.
7. `action_ready=true` and `post_action_gap!=null` may coexist when Jamie can act now but genuinely lacks the subsequent transition.
8. Previously taught procedural rules remain usable later; do not force the child to re-teach a sequence/condition/repetition on every iteration.
9. A temporary execution boundary is not automatically a communication gap when the next branch is already taught.
10. Student evidence, listener memory, render model, actionable world/game state, and gap/controller state are distinct domains. Do not collapse them into one undifferentiated transcript/state blob.
11. Corrections must replace, supersede, or deactivate contradictory active listener instructions rather than merely appending a second conflicting rule.
12. Hidden object identity must not be available to player-choice planning while the object is hidden.
13. Internal model/parser/provider failures must never be presented to the learner as if the child communicated badly or increment learner repair/scaffold evidence.
14. Jamie must never narrate a physical move that is absent from the validated executable action plan.
15. `game_complete=true` requires a child-taught ending condition, a world state that actually satisfies it, and non-empty grounded `completion_evidence`.
16. Repair may earn an internal reflection candidate, but do not force an immediate reflection; play continues and any reflection is deferred to a later earned moment such as grounded completion.
17. Run the focused deterministic regressions before broadening or changing acceptance scenarios; use the AI full-game smoke as broad completion evidence, not as a replacement for deterministic checks.

## Current runtime identity

A test label such as `DIFY_TEST_VERSION=v10-r4` is not proof of what Dify is actually running.

The current validated runtime family emits:

```text
debug.dsl_version = v10
debug.build_id = v10-no-thinking-r4-20260822
```

The build ID may change for a new deployment artifact. The harness should use `DIFY_EXPECT_DSL_VERSION=v10` (and inspect `build_id` when comparing exact builds) so traces cannot silently compare the wrong imported/published workflow.

The current Action Planner intentionally runs with `thinking=false`. Do not re-enable reasoning mode casually: the current DeepSeek/Dify reasoning-output integration produced unreliable structured planner output, while the no-thinking semantic-core path produced schema-valid actions and grounded full-game completion.

## Test philosophy

Hard deterministic checks should protect authority, physical reality, runtime identity, grounded repair, and grounded completion. Exact conversational wording and broad naturalness remain soft unless the wording itself violates a hard product boundary.

- Successful wrapper recovery belongs in `debug.recoveries`, not `pipeline_errors`.
- Unrecoverable structured-output/provider failures belong in `pipeline_errors`.
- AI full-game runs fail fast by default on pipeline errors or phantom physical-action claims; use `--keep-going` only for deliberate diagnostics.
- A random AI full-game failure must be classified before it drives semantic changes: AI-child design, infra/provider, harness, or real product/runtime failure.

## Historical files

`dify/interpreter-prompt.md`, `dify/lesson-engine.py`, and `dify/v8/` are historical references. They document earlier v6/v8 approaches and must not be treated as active v10 workflow source.

The durable current contract is described in `README.md`, `dify/README.md`, and `tests/e2e/`.

## Change hygiene

- Keep rollback/fix work narrow; do not bundle unrelated redesigns.
- Record why a rollback happened and what behavior must be recovered.
- If an external runtime such as Dify must be updated manually, say so explicitly in the PR instead of implying the repository change already changed production/runtime state.
- Do not keep stale DSL generators or archived workflow exports as competing sources of truth when the actual experiment is being iterated elsewhere.
