# Current manual product acceptance scenarios

These checks cover learner-facing behavior that is not fully captured by the deterministic API harness. They describe the current v10 product, not the older `Teach → Practice → Independent → Transfer` state machine.

The current experience is:

**Explain → Act → Encounter a real gap → Repair → Reality changes → Continue → Reach a child-taught ending**

The product should feel like teaching and playing with a capable but bounded friend. Jamie is not a checklist tutor, and the child is not answering an answer key.

## 1. Progressive world materialization

**Purpose:** Make the AI-native mechanism visible: the child's explanation should change the world Jamie can actually use.

Acceptance:

- The world may start partial after a theme/object description.
- Harmless visual details may be inferred, but gameplay state/rules may not appear before the child teaches them.
- When the child teaches setup or object state, the visible world changes accordingly.
- `world_patch` should define the world; runtime action effects should remain in `ui_action`.
- The child should be able to see that better explanation changes what Jamie can physically do, not merely what Jamie says.

## 2. Capable bounded listener

**Purpose:** Verify that the model uses strong language understanding without becoming a hidden rulebook.

Acceptance:

- Normal fragments, slang, self-correction, pronouns, and ordinary Grade 3–4 disfluency are understood when their meaning is clear.
- Jamie may make ordinary delegated player choices such as choosing among `any two` eligible objects.
- Jamie does not ask for details that the child already delegated to the player.
- Jamie does not use familiar-game priors to suggest missing actions, outcomes, goals, or endings, even as a leading question.
- A child-defined house rule remains authoritative even when it conflicts with the familiar version of a known game.

## 3. Genuine gap → repair → reality change

**Purpose:** Validate the central learning event.

Acceptance:

- A gap appears only when Jamie truly lacks rule-relevant information needed for the next transition.
- The gap is grounded in the state Jamie actually reached.
- Jamie does not supply candidate answers to the child.
- When the child supplies the missing information, the old gap resolves.
- The repair licenses a real action or visible change in the current world.
- The system continues playing instead of immediately switching into a lesson-summary reflection.

A technical model/parser/provider failure is **not** a learner communication gap. It must not increment learner repair/scaffold evidence or blame the child.

## 4. Procedure persistence and continuation

**Purpose:** Check that the child is teaching a reusable procedure, not issuing one-off commands forever.

Acceptance:

- Rules taught earlier remain usable on later turns.
- Sequence, conditions, repetition, and endings are interpreted semantically rather than through game-specific phrase matching.
- Once the child has taught what to do after a state becomes observable, Jamie should use that rule later without requiring it to be re-taught.
- A temporary execution boundary—such as waiting to see the result of a reveal—is not automatically treated as a communication gap when the subsequent branch is already taught.
- Natural continuation cues such as `keep going` or `your turn` should be sufficient when the stored procedure and current world already determine what Jamie may do.

## 5. Physical-action fidelity

**Purpose:** Keep learner-facing dialogue synchronized with the executable world.

Acceptance:

- If Jamie says it flipped, moved, removed, collected, placed, or changed an object, the validated `ui_action` must actually contain that physical action.
- Jamie must not role-play a move in text while the visible world stays unchanged.
- If the planner cannot safely execute a move, Jamie should acknowledge/clarify/retry truthfully rather than pretending the move occurred.
- World animation and Jamie's language should feel like one event rather than two contradictory systems.

## 6. Grounded game ending

**Purpose:** Ensure completion comes from the child's game rather than an arbitrary lesson counter.

Acceptance:

- The child teaches an ending condition before completion.
- The world genuinely reaches that condition through validated actions.
- `game_complete=true` only when current world state and child-taught evidence support it.
- `completion_evidence` is non-empty and cites the child-taught ending rule.
- `phase=complete` and `pending_gap=null` at the end.
- The ending feels like the game naturally finished; Jamie does not ask the child to announce `game over` merely to trigger completion.

The AI full-game smoke automates a broad version of this check, but a human should still review the final transcript and visible world.

## 7. Reflection timing

**Purpose:** Keep pedagogy earned and conversational.

Acceptance:

- Repair may create an internal reflection candidate but does not immediately trigger a lecture.
- Play continues after a successful repair.
- A later grounded ending may surface at most one short, specific reflection if the earlier repair made it meaningful.
- Do not generalize into canned language such as `When you teach someone...`.
- Do not recite the lesson objective or turn Jamie into the teacher.
- It is acceptable to end without reflection when no meaningful repair earned one.

## 8. Voice / ASR vs communication gap

**Purpose:** Prevent recognizer uncertainty from being taught back to the child as poor communication.

Acceptance:

- With a materially uncertain speech transcript, first confirm/recover what was heard.
- ASR/provider failure does not become gap/repair evidence.
- Once the transcript is reliable, normal listener semantics resume.
- Technical retries are owned by the system, not framed as `you did not explain clearly enough`.

## 9. Frontend coherence

**Purpose:** Make the semantic mechanism legible in the actual prototype, not only in debug traces.

Acceptance:

- Progressive world construction is perceptible.
- `face_down → reveal → hide/remove/update` transitions are visually clear.
- Jamie's reply and world action timing are synchronized.
- Loading states do not look like a frozen/broken game.
- No debug/protocol internals leak into the learner UI.
- The UI does not continue to visually imply obsolete lesson phases such as mandatory Teach / Independent / Transfer stages when the runtime is simply playing toward a grounded ending.
- On `phase=complete`, input/action affordances stop cleanly and the finished world remains understandable.

## 10. Full 8–10 minute product review

A final manual run should be judged as one continuous learner experience:

1. The child starts with a familiar/simple game in natural language.
2. The explanation progressively creates the world.
3. Jamie acts as soon as enough is known.
4. If a real missing rule blocks continuation, play exposes that gap naturally.
5. The child repairs the explanation and reality changes.
6. Jamie keeps using the taught procedure without repeated re-teaching.
7. The world reaches the child-taught ending.
8. The close is natural; any reflection is brief and earned.

The build is not product-ready merely because JSON schemas and atomic actions are technically correct. It should also feel like a child is genuinely teaching a friend and seeing communication become executable.

## Current automated coverage vs manual coverage

Automated hard evidence currently covers:

- prior-knowledge suppression;
- delegated player agency;
- progressive world/action separation;
- genuine gap and grounded repair;
- child-defined rule fidelity;
- pipeline/runtime identity;
- unscripted grounded full-game completion.

Manual/frontend review remains especially important for:

- perceived teaching value;
- action/reply timing;
- visual clarity and delight;
- loading/error experience;
- reflection tone;
- whether the interaction feels like a capable friend rather than a tutor/checklist.
