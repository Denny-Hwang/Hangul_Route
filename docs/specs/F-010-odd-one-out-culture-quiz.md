# F-010 — Odd-One-Out & Culture Quiz minigames

**Status**: `ready`
**Scope**: Mobile (minigame)
**Owner**: solo dev
**Rollout**: MVP (gameplay variety)

---

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
