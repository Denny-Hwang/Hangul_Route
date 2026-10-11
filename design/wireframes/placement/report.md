# Placement: Parent report and "Choose a different start" (`placement/report`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.9, AM-5, AM-12, AM-38, W-8)
Audience: a grown-up, behind the PIN gate (`parent/placement-report`).
Code (planned): `screens/parent/PlacementReportScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section J (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: a grown-up opens the report from the dashboard row or the result screen
When: they read what the check saw and where the route starts
Then: they understand it in plain words, can choose a different start, and can offer a new check

## Screen goal

"Explain the check in plain words and let the grown-up adjust the start."

## Box diagram

```
┌──────────────────────────────────┐
│ [<]  Name — "Starting spot"       │
│ Stage 1 · Letters and sounds      │  <- date taken, language of the check
│ What we saw                       │
│  Letters (shapes)     secure      │  <- secure | getting there | not yet | not tested
│  Sounds of letters    getting there  "knows ㅏ ㅓ ㄱ ㄴ; ㅕ ㅠ are new" (KoreanText)
│  Reading syllables    not yet     │
│  Words                not tested  │  <- reason: no sound on this device / sound guide on
│  Sentences            not tested  │
│  Short: "Shapes of letters and sentences are not part of the short check"
│    (both rows read: not tested (short check))
│  Deep: each rung "secure, checked twice" | "not finished";
│    "Spelling with tiles  getting there" when a tile item was asked
│  numbers allowed for Short and Standard, framed as growth ("3 of 3"); Deep shows status words only
│ Where the route starts            │
│  quest title    [ Choose a different start ]
│  note when a stage is not included│  <- plain note, no price, no buy button here
│ [[ TAKE THE CHECK AGAIN ]]        │  <- the length is pre-selected by defaultMode
│  "A new check can only move the route forward."
│  after a Short with the hint: "The short check looks at the   │
│  first letters only. The standard check can find a later      │
│  starting spot."  [ Try the standard check ]                   │
└──────────────────────────────────┘

Choose a different start (sheet)
┌──────────────────────────────────┐
│ the learner's quests in order     │
│  (o) title … (placed out) …       │  <- pick one; everything before it is skipped,
│  [[ SAVE ]]   [ Cancel ]          │     it and everything after stay on the route
└──────────────────────────────────┘
```

- No comparison with other learners, no "behind" wording (F-PAR-001 section 3.6).
- **Amended (F-PLC-001 AM-5, AM-12; F-ROUTE-001 R-0):** the report opens with the "Suggested weekly plan" card of `journey/my-route-overview.md` K2 (when `flags.routeEnabled`) and carries the skills note `caregiver.skillsNote` under "What we saw". Promoted here (F-PLC-001 P-0).

## Interaction points

- Choose a different start: opens the sheet; SAVE skips everything before the picked quest; Cancel closes.
- TAKE THE CHECK AGAIN: starts a new check with the length pre-selected by `defaultMode`.
- Try the standard check (after a Short with the hint): starts a Standard check.
- Back: the parent dashboard.

## Navigation graph

Enter from: `parent/dashboard` (Starting spot row), `placement/result` (For grown-ups, via PIN)
Exit to: `parent/dashboard`, `placement/language` / `placement/options` (retake)

## States

- **success**: as drawn; with `flags.routeEnabled` the report opens with the "Suggested weekly plan" card (`journey/my-route-overview.md` K2) and carries the skills note under "What we saw".
- **empty**: no check taken yet: "No check taken yet" with the take-it button.
- **not tested rows**: each with its reason (no sound, sound guide on, short check, ended early).
- **overridden**: "Changed by a grown-up" next to the start.

## Data needs

- reads: the newest placement result, the route catalogue, the profile, flags
- writes: an override of the start (route seed), telemetry

## Open questions

- None open for this screen.
