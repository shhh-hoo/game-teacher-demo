# v8 rollback baseline

## Decision

The slim/flash v8 experiment is rejected as the active lesson flow. Restore the pre-slim `v8-revised` workflow before making further acceptance-test or latency changes.

The regression is behavioral, not copy-only: the slim run can collapse the planner result to an empty plan, leaving Jamie with no executable actions and falling through to generic `ask_open_next` responses. That breaks the intended loop:

`child explains -> Jamie acts -> world changes -> real next-step gap -> child repairs -> reality changes`

## Canonical rollback artifact

The exact uploaded pre-slim Dify export is stored as three deterministic gzip parts so the repository copy can be integrity-checked without relying on a large single connector upload:

- `gakku-game-teacher-v8-revised.yml.gz.part-01` — 9000 bytes — SHA-256 `3f140122cd8209446dadcf04204ba8eaee831b1404e485ee02b4b552d9a5bdb7`
- `gakku-game-teacher-v8-revised.yml.gz.part-02` — 9000 bytes — SHA-256 `9af842a0514d74888bdb710560c45733489f4b8e3db3e96c01491989409f77b0`
- `gakku-game-teacher-v8-revised.yml.gz.part-03` — 7627 bytes — SHA-256 `89410aedf1384187511ff4f52ceeace54065d640dc9b9748e6d640101d8530af`

Reconstructed deterministic gzip:

`4b5c4e6ba0ce224d6b7b5f7458149c50a51f62ea52ac711a98ba7fc413ec5d6e`

Original YAML SHA-256:

`7c7048cc9d42daac9f45529da5d11404903f2aa840d277813cf479bc2119e4b8`

Restore and verify:

```bash
cat dify/v8/gakku-game-teacher-v8-revised.yml.gz.part-* > /tmp/gakku-game-teacher-v8-revised.yml.gz
shasum -a 256 /tmp/gakku-game-teacher-v8-revised.yml.gz
# expected: 4b5c4e6ba0ce224d6b7b5f7458149c50a51f62ea52ac711a98ba7fc413ec5d6e

gunzip -c /tmp/gakku-game-teacher-v8-revised.yml.gz > dify/v8/gakku-game-teacher-v8-revised.yml
shasum -a 256 dify/v8/gakku-game-teacher-v8-revised.yml
# expected: 7c7048cc9d42daac9f45529da5d11404903f2aa840d277813cf479bc2119e4b8
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
