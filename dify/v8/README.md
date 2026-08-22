> **ARCHIVED v8 REFERENCE — NOT CURRENT v10 CONTRACT**
>
> This file is retained to explain invariants discovered during the v8 experiments. The active product/runtime contract is now documented in [`../README.md`](../README.md). In particular, fresh-listener/Independent/Transfer progression below is historical and must not be reintroduced merely because it appears in this archive.

# v8 behavioral and runtime contract

## Decision

`v8-revised` remains the historical behavioral reference for semantic-preserving simplification, but no generated Dify workflow export is stored in this repository. DSL files are local/deployment artifacts rather than reviewable source.

The reference export used for comparison is identified by SHA-256:

`7c7048cc9d42daac9f45529da5d11404903f2aa840d277813cf479bc2119e4b8`

Keep the relevant local/Dify export when running an A/B comparison, but do not commit it here.

## Learner-facing behavior that must survive simplification

1. A taught executable instruction causes Jamie to act immediately.
2. `On your turn, flip any two cards.` delegates the ordinary player choice to Jamie; when currently eligible choices are equivalent under taught rules, Jamie should choose two and reveal exactly two instead of asking the child which two.
3. `action_ready=true` and `post_action_gap!=null` may coexist in the same turn: Jamie can know what to do now and still become genuinely stuck after doing it.
4. A post-action gap is not complete merely because it exists in debug state. Jamie must expose it to the learner in a short, open, non-leading response.
5. A repair changes the existing world when the child's new instruction licenses that change.
6. The child's current version of the game outranks familiar-game priors. House rules are not corrected toward a canonical rulebook.
7. Player agency is distinct from rule authority. Jamie may choose among equivalent legal options, but may not invent rules or use hidden information to make the choice.
8. Presentation inference is allowed only when it does not assert gameplay semantics. `status`, object state, ownership, readiness, legal actions, scoring, turn meaning, and win logic are not harmless merely because they are rendered text/metadata.
9. Internal parser/model failures are technical failures, not learner communication failures. They must not generate pedagogical gaps, repair evidence, or learner-facing blame/fallback language.

## State-domain requirements

The workflow must preserve the distinction between:

- **student evidence/model** — durable record of what the child has communicated;
- **listener model** — what the current Jamie is allowed to know;
- **render model** — the visible representation, including safe presentation inference;
- **game state** — physical runtime state after actions;
- **pedagogy/eval state** — gaps, repairs, phase/progression evidence.

A fresh-listener reset clears/rebuilds the **listener model only**. The next turn must not repopulate Jamie by blindly copying all accumulated student evidence back into listener memory.

Specific corrections must replace, supersede, or deactivate contradictory listener instructions. Appending both the old and corrected rule is not a valid repair model.

## Planner input boundary

Player-choice planning should receive one compact actionable-world view, not the full render/game payload.

For hidden objects, omit hidden identity fields such as `symbol` / `caption` from the planner view. The model cannot be trusted to ignore hidden information merely because the prompt tells it not to use it.

## Runtime identity and validation

Every experimental DSL must emit a stable marker such as:

```json
{
  "debug": {
    "dsl_version": "v8-semantic-slim-v5",
    "build_id": "optional-stable-build-id"
  }
}
```

`DIFY_TEST_VERSION` is only a human-supplied trace label. It is not evidence that the intended app/workflow was imported, published, or called.

If a validator/sanitizer node is added, downstream Controller/Pack nodes must consume the **validated output**, not the raw upstream model output. Trace/debug fields should make that data path auditable.

## Workflow artifact policy

Do not commit generated Dify workflow exports (`.yml`, compressed copies, split files, base64 variants) or stale generators that no longer reproduce the active experiment.

Version-control only durable assets that belong here: behavioral contracts, E2E scenarios/assertions, protocol changes, observability requirements, and repository implementation code.
