# Teach Me a Game
## AI Lesson Card PRD

**Target:** US Grade 3-4  
**Duration:** 8-10 minutes  
**Scenario:** You want to play a game with your best friend, but your friend has never played it before. You need to explain the game clearly enough that your friend can understand and start playing with you.

---

## 1. Product thesis

This lesson is not mainly about whether a child can remember a game's rules. It trains a deeper communication skill:

> **Organize and revise an executable explanation around what the listener currently understands and needs next.**

A child may know a game perfectly and still be unable to teach it. The difficulty is perspective-taking: the speaker sees the whole game in their head, while the listener only has the information that has actually been communicated.

The lesson therefore turns communication into an observable loop:

**Explain -> Listener acts -> Notice mismatch -> Locate missing information -> Repair -> Continue**

The AI is useful because it can act as a real listener rather than an answer key. It interprets the child's language, builds only from what the child has said, and exposes misunderstandings through visible action.

### Product truth

**The child's utterances are the game.**

There is no hidden canonical rulebook for Raku to compare the learner against. If the learner explicitly says or corrects something, that becomes the authoritative game evidence. AI-generated presentation choices are provisional and must yield to the learner.

---

## 2. Core ability and learning objective

### Core ability

**Listener-aware procedural communication**: giving enough information for another person to act, monitoring what they understood, and repairing only the part that is missing or misunderstood.

### Why this ability is worth training

This skill combines several transferable competencies:

- **Perspective-taking:** distinguish what I know from what my listener knows.
- **Procedural organization:** turn a complete mental model into actionable steps.
- **Precision:** use references, spatial language, conditions, and sequencing clearly enough to support action.
- **Communication monitoring:** use the listener's behavior as evidence of what was understood.
- **Repair:** locate the exact breakdown and revise the explanation rather than simply repeating it.

These skills transfer beyond games to explaining a science procedure, giving directions, teaching a classmate, collaborating on a task, and debugging misunderstandings in group work.

### What the learner should be able to do after the lesson

By the end of the lesson, the learner should be able to:

1. Give an actionable next instruction instead of only describing the whole idea.
2. Recognize when a listener's action is reasonable given the information provided.
3. Identify what information the listener is missing.
4. Repair a misunderstanding with one useful added detail or correction.
5. Continue the explanation as the shared situation changes.

Success is demonstrated through the interaction, not through a quiz about communication vocabulary.

---

## 3. Student learning difficulties

Grade 3-4 learners may encounter several distinct breakdowns. The lesson should not treat all of them as "wrong answers."

| Typical difficulty | What it means | What the lesson should solve |
|---|---|---|
| **Shared-context assumption** | The child assumes the listener can see or infer something that exists only in the child's head. | Make the listener's knowledge boundary visible. |
| **Under-specified instruction** | "Put it there," "move it up," or "do the next one" may support multiple reasonable interpretations. | Let the listener act on a reasonable interpretation, then make the missing detail noticeable. |
| **Rule dump without action sequence** | The child explains many facts but the listener still cannot tell what to do next. | Shift attention from completeness to executable next steps. |
| **Confusing player choice with missing information** | The child gives the listener a legitimate choice, but an overly literal tutor might ask the child to choose for them. | Preserve Raku's player agency when the rules allow free choice. |
| **Repeating instead of repairing** | The child says the same sentence again without locating what the listener misunderstood. | Prompt for the missing piece, not a full re-explanation. |
| **Self-correction** | The child revises an earlier rule, setup, or state. | Treat the newest explicit correction as authoritative and update the shared world. |

### What this lesson does not need to solve

The lesson is not a vocabulary test, grammar correction exercise, or universal game-engine benchmark. A production version would deliberately bound the visible game affordances; the educational objective is the communication loop, not supporting every imaginable game mechanic.

---

## 4. 8-10 minute Lesson Flow

### Stage 1 - Follow Raku | 0:00-1:30

**Learning Purpose:** Experience the problem from the listener's side before being asked to teach.

**Student Action:** The learner follows Raku's instructions to place simple shapes on a board. The first instruction is intentionally compatible with more than one reasonable interpretation.

**Thinking Process:** "I did something reasonable, but it was not what Raku meant. What information did Raku leave out?"

**AI / System Action:** Raku owns a hidden target and gives only the next instruction. If the learner chooses a reasonable but unintended position, Raku does not mark it simply wrong; it acknowledges the ambiguity and adds the missing detail.

**Progression:** The learner completes the short reconstruction and sees the target.

**Design reason:** This creates a concrete experience of the listener's problem before introducing any teaching language.

### Stage 2 - Guide Raku | 1:30-3:00

**Learning Purpose:** Reverse roles and make the learner responsible for the listener's mental state.

**Student Action:** The learner can see a target arrangement that Raku cannot see and gives ordinary-language placement directions.

**Thinking Process:** "What can Raku actually know from my words? If Raku did something different, what did my instruction allow?"

**AI Action:** AI interprets the learner's direction without seeing the target. Raku performs one reasonable visible action. The learner can then correct the action using more precise information.

**Progression:** The visible board matches the target.

**Design reason:** The learner sees that a communication breakdown is not abstract: it changes what the listener actually does.

### Stage 3 - Choose a game + teaching support | 3:00-3:30

**Learning Purpose:** Transfer the communication skill into a personally familiar context.

**Student Action:** Choose a familiar simple game or "Another simple game" and begin teaching in any natural order.

**Thinking Process:** "What does a new player need first?"

**AI / System Action:** Show a lightweight Game Teaching Guide: **Goal / Start / Turn / Special / Ending**. The guide is an attention scaffold, not a checklist and not a required order.

**Progression:** As soon as the learner provides enough information for a visible action, play begins.

### Stage 4 - Teach, play, notice, repair | 3:30-8:30

**Learning Purpose:** Practice the full communication loop in an authentic, changing situation.

**Student Action:** Teach rules, answer Raku's questions, watch Raku act, correct misunderstandings, and continue playing.

**Thinking Process:** "What does Raku know now? Is this a real missing detail, a choice Raku can make, or something I need to correct?"

**AI Action:** AI performs four key jobs:

1. **Listener interpretation:** extract only meaning supported by the learner's language.
2. **Progressive world building:** turn learner-described objects and states into a visible playable world.
3. **Executable rule modeling:** convert taught procedures into actions Raku can actually perform.
4. **Gap detection and repair:** ask only when the next action genuinely depends on missing information.

Deterministic product logic validates UI actions and progression so generated language cannot silently invent a physical change.

**Scaffold fade:** The Game Teaching Guide begins fully visible, compacts after successful play/repair, and can temporarily re-expand if the learner becomes stuck.

**Progression:** The learner-taught ending condition is reached in the visible world.

### Stage 5 - Complete + transfer | 8:30-10:00

**Learning Purpose:** Make the communication strategy explicit without turning the lesson into a lecture.

**Student Action:** Answer one short reflection/transfer question about what they would make sure a new player understands.

**Thinking Process:** "What made my explanation easier to follow?"

**AI Action:** Give concise evidence-based feedback using the interaction that just happened: one demonstrated strength and one transferable next step. Do not invent praise unsupported by the trace.

**Progression:** Lesson complete.

---

## 5. AI Interaction Design

### Principle A - Raku is a listener, not an answer key

Raku should never use familiar-game knowledge to fill in an omitted rule. A game label provides context for ordinary references, not canonical rules.

If the child says "In my game you get another turn after a match," that is the rule. If the child later says "Actually, you switch turns," the correction replaces the earlier version.

### Principle B - Act whenever the learner has supplied enough information

The lesson should avoid a "teacher asks a question after every sentence" pattern.

If a rule gives Raku a legitimate choice - for example, "pick any card" - Raku should choose and act. It should not manufacture a clarification question simply because multiple valid choices exist.

### Principle C - Use visible interpretation as feedback

When language is sufficient for one reasonable action, Raku acts. A mismatch can be more educational than a pre-emptive clarification because it exposes what the words actually communicated.

**Example**

Learner: "Put the circle at the bottom."  
Raku places it bottom-center.  
Learner: "No, bottom-left."  
Raku moves it immediately.

The learning event is the comparison between intended meaning and listener interpretation.

### Principle D - Ask only for the missing piece

If the next action is genuinely blocked, Raku should identify the local gap rather than restart the explanation.

Bad: "Can you explain the rules again?"  
Better: "I know I flip two cards. What happens if they don't match?"

### Principle E - The child can correct reality

AI-generated world details are provisional. A current explicit learner correction overrides earlier AI inference.

If the AI initially renders five spots and the learner later says "spot 6 is empty," the model should reconcile the world rather than require the child to conform to the old rendering.

### Principle F - Completion must be grounded

Raku should only mark the game complete when:

1. the learner has taught an ending condition;
2. the visible game state satisfies that condition; and
3. the system has evidence connecting the completion to the learner's explanation.

---

## 6. Key response cases

| Learner behavior | Raku behavior |
|---|---|
| **Correct / sufficient** | Act immediately, acknowledge briefly, continue play. |
| **Partially sufficient** | If remaining uncertainty is a legitimate player choice, choose. If it blocks execution, ask only for the missing detail. |
| **Confusing / omitted information** | Reveal the listener gap through a reasonable action or one local clarification. Avoid giving the answer. |
| **Explicit correction** | Accept the correction as authoritative, reconcile the visible state, and continue. |
| **Repeated explanation after unresolved gap** | Locate the specific missing information instead of asking the same broad question again. |
| **Off-topic / unexpected answer** | Preserve current game state, respond naturally, and return to the next actionable need without inventing rules. |
| **Learner-taught ending reached** | Confirm completion from visible evidence, then give one short transfer question and feedback. |

---

## 7. Why AI is necessary here

A deterministic lesson could teach a fixed script, but it would miss the core skill. The educational value comes from the fact that children can explain the same game in many different orders, with fragments, corrections, colloquial references, and unexpected rules.

AI is used where semantic flexibility matters:

- understanding open-ended child language;
- maintaining the listener's current knowledge state;
- turning learner descriptions into a visible world;
- compiling learner-taught procedures into executable actions;
- identifying genuine communication gaps;
- generating local repair dialogue and final evidence-based feedback.

Deterministic logic remains responsible for state transitions, action validity, UI protocol, and progression gates.

This hybrid design lets the lesson remain open-ended without making the visible experience arbitrary.

---

## 8. Prototype scope and product hypothesis

This prototype is intentionally not a production-grade universal game engine. It validates a narrower product hypothesis:

> **Can an AI-native lesson make a child's communication model visible enough that they learn to explain for the listener, not merely from their own point of view?**

The prototype uses a bounded set of visible actions - move/update, reveal/hide, remove, counters/status, and simple state changes - while allowing the learner's language and rules to remain open-ended.

The most important observable signal is not whether every invented game can run indefinitely. It is whether the learner can experience the cycle of **explanation -> interpretation -> breakdown -> repair -> successful shared action** within one short lesson.

---

## 9. Prototype

**Repository:** https://github.com/shhh-hoo/game-teacher-demo  
**Implementation:** V12 - Follow -> Guide -> Game -> Transfer -> Complete  
**Final runtime configuration:** two high-leverage semantic nodes use DeepSeek V4-Pro; remaining language nodes use V4-Flash; Thinking disabled.
