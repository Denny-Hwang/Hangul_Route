# Placement: Pause sheet and the Deep rest card (`placement/pause`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.1, 3.5, W-6)
Audience: the learner, any age (CLAUDE.md section 1). Works for a child alone (big targets, spoken prompts) and for an adult (short, quiet). One button is for a grown-up and goes through the PIN gate.
Code (planned): `screens/placement/PauseSheet.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section F (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: the learner tapped exit, said "not sure" three times (not in Short), left the screen untouched for 45 s, or reached 18 answers in Deep
When: a calm sheet asks whether to keep going
Then: they can keep going or end with what is known so far, and nothing is lost

## Screen goal

"Offer a break: keep going, or end now with a result from the answers so far."

## Box diagram

```
┌──────────────────────────────────┐
│ [Hoya, calm]                      │
│ "Need a break?"                   │  <- after three "not sure" (not in Short), 45 s untouched, or from the exit
│ [[ (icon) KEEP GOING ]]           │
│ [ (icon) That is enough, start learning ]  -> G with what we know so far
│ [ For grown-ups: finish now ]     │  -> PIN gate -> G
└──────────────────────────────────┘
```

- Also opens when the app goes to the background or the screen locks; it is shown on return, and the hidden clock did not run meanwhile.
- Nothing is lost: ending early still produces a result from the answers so far. "That is enough" (here or on F2) ends the run with the answers so far.
- Closing the app mid-run keeps the run for 24 hours (see L).
- The hidden backstop clock does not run while F or F2 is open (W-6).

```
F2. Rest card (Deep, once, after 18 answers)
┌──────────────────────────────────┐
│ [Hoya stretching]                 │
│ "Hoya is stretching. Keep going?" │  <- spoken; no number
│ [[ (icon) KEEP GOING ]]           │
│ [ (icon) That is enough, start learning ]
└──────────────────────────────────┘
```

## Interaction points

- KEEP GOING: closes the sheet; the same question stays.
- "That is enough, start learning": ends the run with the answers so far -> result.
- "For grown-ups: finish now": PIN gate -> result.
- App to background or screen lock: the sheet is shown on return.

## Navigation graph

Enter from: `placement/item`, `placement/item-short` (exit, three "not sure", idle, app background), Deep after 18 answers (F2)
Exit to: `placement/item` / `placement/item-short` (Keep going), `placement/result`, `profiles/pin-entry` (modal) -> `placement/result`

## States

- **success**: F or F2 as drawn.
- **while open**: the hidden backstop clock does not run (W-6).
- **app closed mid-run**: the run is kept for 24 hours (`placement.md` L).

## Data needs

- reads: run state (answers so far)
- writes: the finished result when the run ends early; the pause reason in telemetry

## Open questions

- None open for this screen.
