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

Before changing repo behavior, inspect the actual current files, PR/commit state, and runtime evidence. Do not infer the implementation from an older chat, an obsolete version label, or a remembered Dify graph.

For Dify lesson-flow work:

1. Treat Dify workflow exports as local/deployment artifacts; do not commit generated `.yml`, compressed, split, or base64 workflow copies to the repository.
2. Record durable behavioral contracts, test semantics, observability requirements, and the validation evidence needed to compare experiments.
3. Treat learner-facing behavior as the primary acceptance criterion.
4. Preserve the action-first loop: `child explains -> Jamie acts -> world changes -> real gap -> child repairs`.
5. An executable taught instruction must not silently degrade to an empty action plan.
6. `action_ready=true` and `post_action_gap!=null` must be allowed to coexist.
7. Player agency is distinct from rule authority. In particular, `any one` / `any two` delegates the ordinary player choice to Jamie when the eligible options are equivalent under taught rules.
8. Permanent student evidence and resettable Jamie listener memory are different state domains. Do not rebuild a fresh listener by copying the student's entire accumulated history back into it.
9. Corrections must replace, supersede, or deactivate contradictory listener instructions rather than merely appending a second conflicting rule.
10. Hidden object identity must not be available to player-choice planning while the object is hidden.
11. Internal model/parser failures must never be presented to the learner as if the child communicated badly.
12. Run the focused golden-path E2E before broadening or changing acceptance scenarios.

## Runtime identity

A test label such as `DIFY_TEST_VERSION=v8-slim-v5` is not proof of what Dify is actually running.

Every experimental DSL should emit a stable runtime marker such as `debug.dsl_version` (and optionally a build identifier). When the harness supports strict checking, use that marker so traces cannot silently compare the wrong imported/published workflow.

## Change hygiene

- Keep rollback/fix work narrow; do not bundle unrelated redesigns.
- Record why a rollback happened and what behavior must be recovered.
- If an external runtime such as Dify must be updated manually, say so explicitly in the PR instead of implying the repository change already changed production/runtime state.
- Do not keep stale DSL generators or archived workflow exports as competing sources of truth when the actual experiment is being iterated elsewhere.
