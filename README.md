# Teach Me a Game - AI Lesson Card Prototype

A short AI-native Lesson Card prototype for US Grade 3-4 learners.

The lesson trains one communication skill:

> **Organize and revise an executable explanation around what the listener currently understands and needs next.**

The product is built around a simple premise: **the child's utterances are the game.** Raku has no hidden canonical rulebook. It acts only from what the learner has actually taught, and later learner corrections override earlier AI inference.

## Lesson flow

```text
Follow
Learner experiences an under-specified instruction from the listener side
        ↓
Guide
Learner sees a hidden target and guides Raku with ordinary language
        ↓
Game
Learner teaches a familiar game while the world becomes playable
        ↓
Notice / Locate / Repair
Raku exposes real communication breakdowns through action or a local gap
        ↓
Transfer → Complete
One short reflection and evidence-based feedback
```

### 1. Follow - listener perspective

Raku owns a hidden target and gives the learner only the information needed for the next placement. The first direction is deliberately compatible with multiple reasonable actions. If the learner chooses a reasonable but unintended interpretation, Raku adds the missing detail instead of simply marking the learner wrong.

### 2. Guide - role reversal

The learner can see a new target that Raku cannot. The learner gives directions in ordinary language; Raku interprets those words and makes one visible action. The learner can then correct Raku. This makes the difference between intended meaning and listener interpretation observable.

### 3. Game - integrated transfer

The learner chooses a familiar simple game and teaches it in any natural order. A lightweight Game Teaching Guide - **Goal / Start / Turn / Special / Ending** - supports attention without becoming a checklist. Raku progressively builds a playable world, acts as soon as the current explanation supports an action, and asks only when the next move genuinely requires more information.

## Core interaction principles

- **Learner authority:** current explicit learner correction > current learner statement > prior learner-taught evidence > AI inference/defaults.
- **Faithful listener, not answer key:** the game label never supplies omitted rules.
- **Player agency:** if the learner gives Raku a legitimate choice, Raku chooses rather than manufacturing a clarification question.
- **Local repair:** when information is genuinely missing, Raku asks for the smallest missing piece rather than requesting a full re-explanation.
- **Visible grounding:** physical-action language is tied to validated visible state changes.
- **Grounded completion:** the lesson only completes after a learner-taught ending is satisfied in the visible world.

## AI / deterministic boundary

AI is used for semantic work that must remain open-ended:

- interpreting child language and corrections;
- maintaining listener-grounded meaning;
- building the learner-described world;
- compiling taught procedures into executable rules;
- resolving bounded semantic actions;
- generating repair and feedback language.

Deterministic logic owns action validation, UI state transitions, progression, and protocol integrity.

## Final runtime

```text
debug.dsl_version = v12
debug.build_id = v12-listener-reconstruction-game-r24-final-20260824
```

Model allocation is intentionally cost-bounded:

- `AI · Raku Listener Interpreter` -> `deepseek-v4-pro`
- `AI · Executable Rule Compiler` -> `deepseek-v4-pro`
- remaining seven LLM nodes -> `deepseek-v4-flash`
- Thinking disabled everywhere

The exported Dify YAML is kept as a submission/deployment artifact rather than committed to the repository.

## Prototype scope

This is a take-home prototype, not a production universal game engine. The prototype validates whether an AI-native lesson can make the learner/listener knowledge boundary visible enough to support this loop:

**explain -> interpret -> act -> notice -> repair -> continue**

The visible runtime intentionally uses a bounded action vocabulary while learner language remains open-ended.

## Repository map

- `docs/PRD.md` - simplified Lesson Card PRD aligned to the take-home brief
- `dify/README.md` - runtime and authority-boundary design
- `tests/e2e/` - fixed behavioral acceptance probes and diagnostic tooling used during development
- `tests/browser/` - learner-facing browser walkthrough coverage
- `AGENTS.md` - repository/runtime invariants

## Run locally

Create `.env.local` from `.env.example`, point it at the published Dify app, then:

```bash
set -a
source .env.local
set +a
npx vercel dev
```

The unscripted AI full-game runner remains in the repo as a diagnostic/fuzzing tool; it is intentionally not treated as a submission or freeze gate because it is high-cost and explores behavior beyond the core Lesson Card acceptance path.
