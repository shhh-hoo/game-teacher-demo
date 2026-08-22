# Internal gap leakage check

The learner-facing E2E assertions already reject candidate-rule leakage in Jamie's reply. This companion trace check protects hidden planning state as well: `blocked_now`, `post_action_gap`, and `controller.pending_gap` must describe only the listener's missing information, not suggest candidate gameplay rules.

Run it against a generated trace:

```bash
node tests/e2e/check-internal-gap-leakage.mjs .artifacts/dify-e2e/<trace>.json
```

A safe gap such as `What happens after seeing the two revealed cards?` passes. A gap that contains answer suggestions such as `e.g. keep them, turn them back, or remove them` fails.

The checker intentionally operates on saved traces so it can also audit older DSL runs without changing the main E2E scenario semantics.
