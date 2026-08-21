# Repository rules for AI coding agents

## Main branch discipline

`main` is a protected-by-process release branch even if GitHub repository settings do not currently enforce protection.

- Never commit or push changes directly to `main`.
- Start every change from the current `main` on a named feature/fix/rollback branch.
- Open a pull request back to `main` for every code, test, workflow, documentation, or configuration change.
- Keep the PR as draft until the relevant validation is complete.
- Do not merge a PR with known behavior regressions just because structural assertions pass.
- Do not rewrite acceptance tests to accommodate a broken runtime. Restore the intended product behavior first, then revisit the tests.

Only bypass the PR workflow if the repository owner explicitly instructs you to bypass it in the same task.

## Source-of-truth discipline

Before changing repo behavior, inspect the actual current files and relevant PR/commit state. Do not infer the implementation from an older chat, an obsolete Dify version label, or a remembered architecture.

For Dify lesson-flow work:

1. Preserve the exact workflow export used as the baseline.
2. Treat learner-facing behavior as the primary acceptance criterion.
3. Preserve the action-first loop: `child explains -> Jamie acts -> world changes -> real gap -> child repairs`.
4. An executable taught instruction must not silently degrade to an empty action plan.
5. Latency/node-count optimization is subordinate to preserving `action_ready`, physical world actions, and `post_action_gap` semantics.
6. Run the focused golden-path E2E before broadening or changing acceptance scenarios.

## Change hygiene

- Keep rollback/fix work narrow; do not bundle unrelated redesigns.
- Record why a rollback happened and what behavior must be recovered.
- If an external runtime such as Dify must be updated manually, say so explicitly in the PR instead of implying the repository change already changed production/runtime state.
