# Home/Todays-Mission — the 3-card surface (wireframe v1)

Spec: `docs/specs/F-HW-001-homework-page.md` §3.1–3.3
Code (F-PLAN-001, 2026-09-21): card ② now takes the day's earliest outstanding assignment — from a parent, or derived on the device from a published class/family plan (`logic/homework/assignment-merger.ts`, enabled in `HomeScreen`). Extra assignments for the same day queue to later days.
Audience: **learner (P4/P5 child, 5–11)** — a pre-reader must know where to tap without scanning

## Scenario (Given-When-Then)

Given: a learner profile is active and opens the app in the morning
When: the home screen renders
Then: exactly three cards say what Hoya wants to do today, in a fixed order that does not move for the rest of the day

## Screen goal

"Show three things to do today — tap one and start."

## Box diagram

```
┌──────────────────────────────────┐
│ [hoya]  Hi, <name>!      [avatar]│  ← existing header, unchanged
│                                  │
│  "Today with Hoya" (section      │
│   heading placeholder)           │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ ①  [icon]  card title        │ │  ← min height = touchTarget.hero
│ │            short subtitle    │ │     (96dp ≥ the 88dp floor)
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ ②  [icon]  card title        │ │
│ │            short subtitle    │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ ③  [icon]  card title    ✨  │ │  ← collected: success tone
│ │            short subtitle    │ │     + sparkle, still in slot ③
│ └──────────────────────────────┘ │
│                                  │
│  (rest of home: progress, etc.)  │
└──────────────────────────────────┘
```

- Three cards, always. A card the learner skipped yesterday looks exactly
  like any other card — no red badge, no count, no "1 left" (§3.3).
- A finished card stays **in its slot** and switches to the collected look;
  the others do not move up (§3.2). Position is the child's memory anchor.
- Slot numbers are shown as illustration order, not as a checklist count.

## Interaction points

- Card ① / ② tap → `QuestPlayer` (questId, episodeId)
- Story card tap → `EpisodeDetail` (episodeId)
- Daily-test card tap → Daily Test surface (F-RVW-001; not built yet, so the
  builder does not emit this card — see spec §9.2)
- A collected card stays tappable (a child may replay for fun); replaying
  never subtracts anything

## Navigation graph

Enter from: `Main` tab bar (Home), profile switch, quest completion return
Exit to: `QuestPlayer` · `EpisodeDetail`

## States

- **success**: three cards, zero or more collected.
- **empty** (day one, no history): still three cards — slot ① becomes Story
  Time, so the row is never short (§3.1 fallback).
- **error** (content or progress unreadable): the section is omitted entirely
  rather than rendering an empty frame; the rest of home still works.

## Data needs

- reads: active profile (F-PROF-001), `ProgressSnapshot` for that profile,
  the quest + episode content lists
- computed by `logic/homework/mission-builder` — the screen renders, it does
  not decide
- writes: none directly; completion is recorded by the Quest flow

## Open questions

- Should the collected card show the earned Heritage card thumbnail instead of
  a sparkle? (richer reward echo, but risks pulling attention off the
  remaining cards — beta)
- Persisting the day's plan: currently rebuilt per render from the pinned plan
  passed in. Where the pin lives (progress store vs a homework store) is a
  storage decision, deliberately left to the wiring task.
