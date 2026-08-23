# Repository rules for AI coding agents

## Main branch discipline

`main` is a release branch. Never commit directly to it. Start changes from current `main` on a named branch, open a PR back to `main`, keep the PR draft until relevant validation is complete, and do not weaken learner-facing acceptance criteria merely to make a runtime pass.

## Source-of-truth discipline

Before changing behavior, inspect the actual repository, PR state, published runtime marker, and latest traces. Do not infer current implementation from old chat context or obsolete Dify exports.

The V12 learner-facing lesson is:

```text
Follow (learner is listener)
→ Guide (role reversal)
→ Game (learner teaches Raku)
→ Transfer
→ Complete
```

The two reconstruction tasks are foundation tasks. The final game remains the integrated runtime-first task.

For Dify lesson-flow work:

1. Treat workflow exports as local/deployment artifacts; do not commit generated `.yml` exports.
2. Record durable behavioral contracts, test semantics, observability requirements, and validation evidence in the repository.
3. Treat learner-facing behavior as the primary acceptance criterion.
4. In Guide, the AI listener must not receive the hidden target. Target comparison belongs to deterministic product logic.
5. Game selection supplies only a game label; it must not inject canonical rules.
6. Preserve learner rule authority in the final game: familiar-game pretraining is never evidence that a rule was taught.
7. Preserve ordinary player agency: explicit delegation lets Raku choose among currently eligible equivalent options.
8. An executable taught instruction must not silently degrade to an empty action plan.
9. `action_ready=true` and `post_action_gap!=null` may coexist when Raku can act now but genuinely lacks the subsequent transition.
10. Previously taught procedural rules remain usable later; do not force re-teaching on every iteration.
11. Student evidence, listener memory, render model, actionable game state, and gap/controller state are distinct domains.
12. Corrections replace or supersede contradictory active listener instructions.
13. Hidden object identity must not be available to player-choice planning while hidden.
14. Internal parser/provider/model failures are system failures, not learner communication failures.
15. Raku may never narrate a physical move absent from the validated executable action plan.
16. `game_complete=true` requires a learner-taught ending, a world state that satisfies it, and non-empty grounded `completion_evidence`.
17. Repair may earn a later reflection candidate, but play continues; reflection belongs at an earned ending.
18. Run focused deterministic regressions before breadth/full-game smoke.
19. Regression scenarios are tests, not prompt examples. Do not copy scenario-specific phrases, expected branches, or familiar-game answers into LLM prompts or narrow deterministic fallbacks merely to pass a regression. Encode the general semantic invariant, then validate it against the unchanged scenario.

## Runtime identity

The V12 candidate should emit:

```text
debug.dsl_version = v12
debug.build_id = v12-listener-reconstruction-game-r7-20260823
```

Until that workflow is manually imported and published, the repository may still point at an older deployed Dify app. A local test label is not proof of runtime identity; inspect the emitted debug marker.

All LLM nodes should remain in normal non-thinking JSON mode unless a specific experiment demonstrates a reason to change it.

## Test philosophy

Hard deterministic checks protect target isolation, listener authority, physical reality, runtime identity, grounded repair, and grounded completion. Exact wording and broad conversational naturalness are soft unless wording itself violates a hard boundary.

A harness bug should be fixed as a harness bug. Provider/runtime faults must not be converted into learner failures. AI full-game smoke is broad evidence, not a substitute for focused deterministic regressions.

## Historical files

Old v6/v8 files and prior V10/V11 workflow descriptions are historical references, not active workflow source. Do not revive old lesson state machines or Glowpath-specific teaching logic as current V12 behavior.
