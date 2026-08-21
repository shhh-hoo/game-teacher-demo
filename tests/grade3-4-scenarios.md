# Grade 3–4 torture-test scenarios

These are not model answers. They are deliberately messy child-like inputs for checking whether the Dify interpreter identifies only what was actually communicated and whether the lesson engine creates natural consequences.

## A. Partial but usable

Child:

> You flip two cards.

Expected interpreter idea:

- `turn.flip_two`
- no inferred rule for a non-match

Expected lesson behavior:

- Jamie flips two non-matching cards
- leaves them visible
- asks what happens next

## B. Clear enough despite imperfect grammar

Child:

> If different you put them down again.

Expected interpreter idea:

- `result.no_match_flip_back`
- should count as clear enough despite grammar

Expected lesson behavior:

- Jamie updates the missing rule
- replay visibly changes

## C. Out-of-order explanation

Child:

> The person with the most pairs wins and you remember where the cards are and you flip two cards.

Expected interpreter idea:

- `goal.most_pairs`
- `strategy.memory`
- `turn.flip_two`
- do not invent setup or non-match behavior

Expected lesson behavior:

- Jamie can attempt a turn
- gap still appears when the two cards do not match

## D. Too much strategy before the basic rule

Child:

> Try to remember all the pictures so you know where the matching one is.

Expected interpreter idea:

- `strategy.memory`
- no basic turn rule inferred

Expected lesson behavior:

- Jamie should still need to know what to do first

## E. Vague correction #1

Child:

> No, that's wrong.

Expected interpreter idea:

- intent = `correct`
- correction specificity = `low`

Expected lesson behavior:

- Jamie asks which part was wrong
- no step picker yet

## F. Vague correction #2

Child:

> No! Don't do that.

Expected interpreter idea:

- intent = `correct`
- correction specificity = `low`

Expected lesson behavior:

- after a second vague correction, show the actual action trace as clickable repair steps

## G. Specific correction

Child:

> No, the cards are different, so turn both of them face down again.

Expected interpreter idea:

- intent = `correct`
- specificity = `specific`
- `result.no_match_flip_back`

Expected lesson behavior:

- no step picker needed
- Jamie immediately repairs and retries

## H. Ambiguous pronoun/reference

Child:

> Put them back.

Expected interpreter idea:

- should NOT confidently add `result.no_match_flip_back` unless current context makes "them" and the condition sufficiently clear

Expected lesson behavior:

- if context is insufficient, Jamie asks a small clarification rather than assuming the entire rule

## I. Minor off-topic turn

Child:

> My cousin has this game too.

Expected interpreter idea:

- `off_topic = true`
- no rules inferred

Expected lesson behavior:

- briefly acknowledge and return to the current action

## J. House rule

Child:

> In our version, if you get a pair you go again.

Expected interpreter idea:

- treat as a possible house rule, not as an error

Expected lesson behavior:

- Jamie confirms that this is the child's version and uses it for the current game

## K. Complete first explanation

Child:

> Put all the cards face down. On your turn, flip two cards. If they match, keep the pair. If they don't match, turn them face down again. Then the other person goes. The person with the most pairs wins.

Expected interpreter idea:

- setup + turn + match + non-match + switch + goal

Expected lesson behavior:

- Jamie acts correctly
- do not deliberately create a misunderstanding merely to force the repair feature
- move naturally toward play / strategy

## L. Child language that should still work

Child:

> You get two. Same ones you keep. Not same, hide them again. Then me.

Expected interpreter idea:

- likely `turn.flip_two`
- `result.match_keep`
- `result.no_match_flip_back`
- `turn.switch`

Expected lesson behavior:

- accept meaning if clear; do not correct grammar

## What to watch during live Dify testing

The most important failure modes are:

1. The interpreter silently fills in a rule the child did not say.
2. The interpreter is too strict about Grade 3–4 grammar and misses understandable meaning.
3. Jamie asks generic teacher-like questions rather than letting the game expose the gap.
4. Jamie creates friction even when the first explanation was sufficient.
5. Repeated vague correction does not escalate to the step locator.
6. A house rule is incorrectly labeled as wrong.
7. The response stops being valid frontend JSON.
