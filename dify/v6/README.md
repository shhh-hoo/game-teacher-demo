# GAKKU v6 Dify alpha

This iteration tests the new grounding boundary before the browser is changed.

## What changed

The workflow keeps five state domains separate:

- student model
- render model
- listener model
- game state
- pedagogy/eval state

It adds two explicit leakage guards:

1. **World Leakage Guard** — presentation inference is allowed; unstated game logic is removed.
2. **Response Leakage Guard** — Jamie cannot smuggle a missing rule into a helpful-sounding question.

The visible Dify pedagogy branch is:

`Teach Moment / Repair / Normal Listener`

## First regression test

Start a new conversation and send:

> It uses cards with matching pictures.

Expected:

- the world may render several cards with repeated pictures;
- layout/count/symbol choice may be inferred;
- no face-down state, flip action, "find pairs" goal, keep rule, or win rule is introduced;
- Jamie asks an open question from what is known, such as "What do I do with the cards?";
- `debug.world_guard_violations` should be empty after sanitization;
- if the draft tried to leak a rule, `debug.response_leakage_detected` should be `true` and the final reply should be rewritten.

Then try:

1. `Put them face down.`
2. `Flip one card.`
3. `Flip two cards.`
4. `If they're different, leave them face up.`
5. `No.` / `That's wrong.`

## Current boundary

This PR is intentionally DSL-first. The current v5 browser does not yet render the new generic `world_patch` protocol, so first validate the raw Dify answer. Once the grounding regression cases are stable, the browser can move from the fixed Matching Pairs board to the generic progressive renderer.
