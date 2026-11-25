# F-010 — Odd-One-Out & Culture Quiz minigames

**Status**: `ready`
**Scope**: Mobile (minigame)
**Owner**: solo dev
**Rollout**: MVP (gameplay variety)

---

> **Amended 2026-10-31 by `AMENDMENTS-TOUCH.md` [KT]** (owner request: easy selection for children): Odd One Out and Culture Quiz take touches through the shared tap board (commit on release with a generous reach, a 400 ms lock); a locked wrong Odd One Out tile is disabled, so a bounce scores no extra miss (rows KT-2, KT-3).

> **Amended 2026-11-24 by `F-A11Y-001-answer-feedback-and-announcements.md` [AF]** (work order WO-04 of the 2026-11 review: answer feedback you can see without colour, and hear once) (Odd One Out, Culture Quiz and the feedback line, `:43`): in Odd One Out a right tile shows `check` and a missed tile `replay`, the missed tile is `locked` (focusable, never read as disabled), and the advance moves off a bare `setTimeout(…, 700)` onto `pacing.after` (the sound's end, with the 1000 ms floor; row AF-4a). In Culture Quiz the options are `ChoiceCard` rows with `check` or `replay`, named state first, and a miss is no longer `disabled` (that painted the amber as a greyed-out button); the result is said once ("Right answer: sagwa, apple.") and the Hoya bubble is not live; with the reader off the next round waits at least 1000 ms after a right answer (was 700 ms); with a screen reader on, Next shows after a right answer, the last round included (row AF-2).

## 1. Context

Stage 1 ships 6 of the 12 catalog minigames (Match Sound, Build a Letter,
Trace Stroke, Card Match, Story Sequence, Voice Echo). This spec adds two more
from the existing `MinigameKind` enum — no schema change needed:

- **odd-one-out** (Recognition): four jamo, three of one kind and one of the
  other; tap the different one.
- **culture-quiz** (Discovery): a Korean culture word is shown; pick its
  English meaning from four options. Reuses the `cardPairs` already defined in
  `minigame-config.ts`.

Both reuse the established `scope → round-builder → selection UI` pattern
(like Match Sound). No new media assets: jamo + existing card pairs only.

## 2. User story

> As a child, I want a couple of fresh game shapes so practice doesn't feel
> repetitive — spotting the odd letter, and matching a Korean word to its
> meaning.

## 3. Acceptance criteria

- `buildOddOneOutRounds({ scopeJamoIds, rounds })` returns rounds of exactly
  4 tiles where `oddJamo` is the single jamo of the minority kind and is one
  of the 4 tiles.
- `buildCultureQuizRounds({ cardPairs, rounds })` returns rounds with exactly
  one correct option (`isAnswer`) matching the prompt and 3 distractors.
- Both are pure and unit-tested.
- `OddOneOutGame` / `CultureQuizGame` follow the existing game component
  pattern (`scope` + `onFinish`, `useQuestRunStore.recordRound` /
  `markStepComplete`), with idle/correct/wrong feedback and ≥64dp targets.
- `MinigameScreen` dispatches the two new kinds.
- Both games are wired into Stage 1 quests (odd-one-out → letters-q3 practice,
  culture-quiz → nature-q1 apply), replacing duplicate steps.
- mobile typecheck + tests pass.

## 4. Out of scope

- `RoundSchema` fixtures for these kinds (games are scope-driven, not fixture-driven).
- Visual mocks (geometric placeholders until design lands).

## 5. Tests

- `round-builder` unit tests for both builders (tile count, odd membership,
  single answer, distractor count). In `apps/mobile/src/logic/__tests__/round-builder.test.ts`.

## 6. Dependencies

- **Upstream**: F-001 (Match Sound pattern), content-schema `MinigameKind`.
- **Downstream**: optional quest wiring.
