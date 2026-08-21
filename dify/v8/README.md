# v8 rollback baseline

## Decision

The slim/flash v8 experiment is rejected as the active lesson flow. Restore the pre-slim `v8-revised` workflow before making further acceptance-test or latency changes.

The regression is behavioral, not copy-only: the slim run can collapse the planner result to an empty plan, leaving Jamie with no executable actions and falling through to generic `ask_open_next` responses. That breaks the intended loop:

`child explains -> Jamie acts -> world changes -> real next-step gap -> child repairs -> reality changes`

## Canonical rollback artifact

`gakku-game-teacher-v8-revised.yml.gz` is the exact uploaded pre-slim Dify export used for this rollback.

Original YAML SHA-256:

`7c7048cc9d42daac9f45529da5d11404903f2aa840d277813cf479bc2119e4b8`

Restore the importable YAML locally:

```bash
gunzip -k dify/v8/gakku-game-teacher-v8-revised.yml.gz
shasum -a 256 dify/v8/gakku-game-teacher-v8-revised.yml
```

Then import `dify/v8/gakku-game-teacher-v8-revised.yml` into Dify and publish that workflow.

## Required behavior before any new optimization

The golden path must prove all of these before slimming work resumes:

1. A taught executable instruction causes Jamie to act immediately.
2. `On your turn, flip any two cards.` produces two reveal actions.
3. Jamie may act and then expose a `post_action_gap` in the same turn.
4. The question after acting is grounded in the visible result, not a generic request for the next rule.
5. A repair such as `turn both of those cards face down again` changes the existing world state.
6. No planner parse/output failure may silently degrade to an empty plan and continue as if the turn succeeded.

Do not tune the golden-path acceptance scenario around the broken slim runtime. Restore runtime behavior first, then evaluate the scenario.
