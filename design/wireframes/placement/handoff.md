# Placement: Hand-off: "Tap Hoya to start" (`placement/handoff`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.1, W-4)
Audience: the learner, any age (CLAUDE.md section 1). Works for a child alone (big targets, spoken prompts) and for an adult (short, quiet). A one-line note is for a grown-up who is helping.
Code (planned): `screens/placement/HandoffScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section C3 (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: a grown-up set up a Short check or the learner is *Pictures first*
When: the device is handed to the learner
Then: the learner starts by tapping Hoya, with no text to read

## Screen goal

"Hand the device to the learner and start with one big tap."

## Box diagram

```
┌──────────────────────────────────┐
│ [x]                               │  <- exit icon (spoken "Let us start learning"); leaves, nothing recorded
│        [[ (Hoya, big) ]]          │  <- the whole Hoya is the button; spoken:
│   "Ready? Tap Hoya to start."     │     "Ready? Tap Hoya to start."
│                                   │
│  for a grown-up, written + spoken │
│  once: "Helping? Let them choose. │
│  'Not sure' is a fine answer."    │
└──────────────────────────────────┘
```

- Tapping Hoya -> D (after "Check without sound": straight to E, the warm-up is not repeated). No age words and no shame words.
- With a screen reader on, the line is not auto-played; it plays when the focused Hoya button is activated.

## Interaction points

- Tap Hoya (the whole Hoya is the button): goes to the warm-up; after "Check without sound" straight to the first item.
- With a screen reader on, the spoken line plays when the focused Hoya button is activated.

## Navigation graph

Enter from: `placement/options`
Exit to: `placement/warmup`, `placement/item` / `placement/item-short` (after Check without sound)

## States

- **success**: as drawn.
- **screen reader**: nothing auto-plays.
- **error / offline**: identical.

## Data needs

- reads: run mode, whether the warm-up already ran
- writes: nothing

## Open questions

- None open for this screen.
