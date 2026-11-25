# F-012 — Stage 4 taste: Greeting Dialogues + Tap to Respond

**Status**: `ready`
**Scope**: Mobile (minigame + content)
**Owner**: solo dev
**Rollout**: MVP (Stage 4 taste)

---

> **Amended 2026-11-24 by `F-A11Y-001-answer-feedback-and-announcements.md` [AF]** (work order WO-04 of the 2026-11 review: answer feedback you can see without colour, and hear once) ("wrong picks lock + nudge", `:36`): Tap & Respond's replies are `ChoiceCard` rows with `check` or `replay`, named state first; a missed reply stays locked and marked but is no longer `disabled` (that painted the amber as a greyed-out button, and a reader said "dimmed"); the result is said once and the miss bubble is not live; `afterReply` (900 ms) and the 1000 ms floor apply with the reader off, and with a reader on Next shows after a right reply, the last round included (row AF-2).

## 1. Context

CLAUDE.md §1 MVP scope: "Stage 2 / Stage 4 — taste only". This adds the Stage 4
taste plus a new selection-based dialogue minigame.

- **New minigame `tap-respond`** (catalog ⑦ "Tap to Respond"): an NPC line is
  shown; the child picks the fitting Korean reply from options (each option
  carries English gloss). **No STT** — pure selection, so it's testable and
  cheap, unlike Voice Echo.
- content-schema `MinigameKind` gains `tap-respond`.
- `MinigameScope` gains a `dialogue` field; `TapRespondGame` renders NPC line +
  reply buttons, advancing turn by turn (same feedback model as the other
  selection games).
- Stage 4 taste episode `episode:stage4-rites` "Greeting Dialogues" with one
  quest (card-match → tap-respond → culture-quiz) + 4 greeting cards
  (안녕/감사/친구/인사).

## 2. Language policy (content-skill §3.3)

- NPC line + each reply shown as Korean + romanization + English gloss.
- UI strings English (Pre-A1): "Choose your reply", "Someone says".

## 3. Acceptance criteria

- `tap-respond` is a valid `MinigameKind` (content-schema typecheck + tests).
- `TapRespondGame` dispatched by `MinigameScreen`; advances turns, calls
  `onComplete`/`markStepComplete` once at the end; wrong picks lock + nudge.
- `episode:stage4-rites` is `shipped`, surfaced after Stage 1/2 via HomeScreen
  next-quest and JourneyScreen.
- content-integrity test asserts each dialogue turn has exactly one correct
  option.
- content-schema + mobile typecheck + tests pass.

## 4. Out of scope

- Voice Echo / Role Play (STT) — Phase 2+.
- Branching dialogue trees (linear turns only).
- Other Stage 4 themes (still preview).

## 5. Tests

- content-integrity: tap-respond dialogue shape.
- Existing typing covers enum/scope shape.

## 6. Dependencies

- **Upstream**: F-010/F-011 (selection-game pattern), content-schema enum.
- **Downstream**: future real Stage 4 dialogue content.
