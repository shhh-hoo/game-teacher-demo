# PRD-first manual acceptance scenarios

These scenarios are part of the Teach Me a Game product acceptance plan but are not yet suitable for the current text-only Dify API harness. They should remain visible as product requirements rather than disappearing just because they are not automated yet.

## Fresh listener independent performance

**PRD stage:** Independent Performance  
**Hypothesis:** H2  
**Learning purpose:** Check whether the child improved the explanation itself rather than merely repairing one shared conversation.

Run after at least one meaningful breakdown, repair, and Teach Moment.

Acceptance:

- Keep the already constructed game world as the play environment.
- Reset the physical game state to the playable baseline.
- Clear Jamie's learned game rules so the child faces a genuinely fresh listener.
- Fade most scaffolding; Jamie should behave mainly as a novice player/listener.
- Compare the first explanation with the fresh-listener explanation using learner-facing evidence: clarification count, blocked states, how early executable information appears, repair specificity, and consecutive executable game states.
- Improvement should mean the new listener can begin and continue more easily, not simply that the child remembers how to fix the previous Jamie.

## Transfer beyond the current game

**PRD stage:** Transfer  
**Hypothesis:** H2  
**Learning purpose:** Check whether the child can abstract the experience into a portable listener-centered principle.

After Independent Performance, ask a short question such as: “Next time you teach a friend a different game, what should you think about before you start?”

Acceptance:

- The prompt is about a different game or task, not recalling the current game's rules.
- A successful answer may mention what the friend does not know, what they need before starting, putting information in an order they can follow, or being specific enough for them to act.
- Evaluate semantically. Do not require the exact wording “What does my friend need to know before they can make their next move?”

## Voice ASR vs communication gap

**PRD stage:** Voice Interaction / cross-cutting  
**Hypothesis:** H3  
**Learning purpose:** Prevent speech-recognition errors from being taught back to the child as communication failures.

Acceptance:

- With a deliberately low-confidence or materially ambiguous transcript, the product first checks what it heard.
- Only a sufficiently reliable transcript enters listener-understanding and pedagogy evaluation.
- ASR clarification does not increment communication-gap, repair, or scaffold evidence.
- Once the transcript is reliable, normal listener evaluation resumes.

## Full 8–10 minute learning-loop review

This is the final manual product check and should follow the PRD sequence rather than protocol-node coverage:

1. **Experience:** the child's own explanation progressively creates a playable world and Jamie acts when enough is known.
2. **Meaningful breakdown:** the first real problem comes from missing, poorly ordered, vague, or poorly prioritized information—not from the model, renderer, or ASR.
3. **Notice & Teach:** the child sees what happened; the Teach Moment names one bottleneck and returns to the heuristic about the listener's next move.
4. **Guided repair:** the child's new explanation changes reality; the system does not just praise or restate a rule.
5. **Scaffold fade:** later breakdowns receive less help when the child can repair independently.
6. **Fresh listener:** world remains, learned rules reset, and the child explains again from scratch.
7. **Transfer:** the child articulates a listener-centered principle beyond the current game.

A build should not be considered product-ready merely because atomic actions, deltas, and baselines are technically correct. Those are implementation safeguards underneath this learning loop.
