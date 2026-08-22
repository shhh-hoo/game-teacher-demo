# Takeover audit — 2026-08-22

## Implemented baseline

The supplied active artifact is `gakku-game-teacher-v10-semantic-core-no-thinking-r4-deepseek-0.0.20.yml`. It contains 22 nodes: eight no-thinking LLM nodes, six Code nodes, an if/else response branch, four assigners, Start, and Answer.

The implemented path is:

```text
Listener Interpreter
→ grounded student + listener models
→ World Builder
→ deterministic world guard / hidden-safe actionable view
→ Action Planner
→ action-plan validator
→ deterministic gap evaluator
→ pedagogy controller
→ response branch + response guard
→ pack state/action/debug
→ persist conversation state
```

The browser applies `world_patch` before `ui_action`. The proxy only transports Dify messages and keeps the API key server-side.

## Pedagogical progression present in code

The frontend contains labels and rendering branches for `experience`, `notice`, `teach`, `practice`, `independent`, and `transfer`. It can render teach/micro-teach support, show a fresh-listener subtitle, capture a baseline, and apply a baseline reset.

The v10 controller retains some state fields for practice, independent evidence, reflection candidates, and listener reset. It also distinguishes student history from active listener memory.

## Unreachable or slimmed away

The published v10 behavior stays in `experience` during play and moves directly to `complete` when the child's game reaches a grounded ending. Therefore the following lesson behavior is not currently reachable end to end:

- Jamie's fixed model game;
- first genuine gap → main teach moment;
- persistent guided-practice scaffold;
- independent fresh-listener attempt with executable-rule reset;
- transfer reflection after game evidence;
- distinct `game_complete` and `lesson_complete` transitions.

The existing frontend phase/support code is passive: it renders backend values but does not own the lesson progression.

## First-stage change: v10.1 Rule IR Shadow

The first stage adds a separate executable-rule state after listener grounding:

```text
grounded listener model
→ no-thinking semantic Rule Compiler
→ deterministic evidence/schema validator
→ persisted executable-rule shadow
```

The compiler can emit only rules tied to a current-turn listener instruction. Deterministic code constructs provenance from the student's stored message, rejects ungrounded semantic keys and unsupported effects, and marks replaced rules `superseded`. Unsupported semantics remain explicit instead of being guessed.

The legacy Action Planner remains the only behavior-authoritative action source. Rule compilation does not change `world_patch`, `ui_action`, gap state, controller decisions, Jamie copy, or completion. Compiler errors preserve the previous shadow state and stay out of learner-facing `pipeline_errors`.

Repository changes include:

- compiler prompt and deterministic validator source;
- a reproducible patcher for the supplied v10 export;
- a static preflight for YAML parsing, graph references, Code syntax, runtime markers, and `thinking=false` on every LLM node;
- Rule IR provenance/correction tests;
- architecture telemetry in deterministic and AI full-game traces;
- opt-in live enforcement with `DIFY_EXPECT_RULE_IR_SHADOW=1`.

The generated YAML is a local deployment artifact under ignored `.artifacts/`; it is not repository source.

## Gate before v10.2

Do not add deterministic runtime shadow evaluation until the v10.1 artifact is imported/published and the unchanged must-run scenarios demonstrate:

1. no learner-facing regression;
2. current-turn rules compile with student-grounded provenance;
3. corrections supersede contradictory active rules;
4. unsupported semantics are reported without rule invention;
5. every response reports `action_source=legacy_planner`;
6. latency/token impact is measured against the same v10 scenarios.
