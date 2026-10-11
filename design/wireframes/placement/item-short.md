# Placement: Short items: 2 x 2 picture and sound cards (`placement/item-short`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.1 (Short layout, AM-21), acceptance 20 (AM-40), W-4)
Audience: the learner, any age (CLAUDE.md section 1). Works for a child alone (big targets, spoken prompts) and for an adult (short, quiet).
Code (planned): `screens/placement/ItemScreen.tsx` (Short layout)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section E2 (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: a Short run is in progress
When: the learner hears a prompt and taps one of four cards
Then: nothing needs reading, and the only acknowledgement is the footstep trail

## Screen goal

"Tap the card that matches what Hoya said, or "I am not sure"."

## Box diagram

```
E2. Short items, portrait (fits 320 x 568 up to 200 % text without scrolling)
┌──────────────────────────────────┐
│ [(icon) exit] (spoken label)      │  <- opens F as an exit pause
│ [Hoya]  (speaker, plays on open)  │  <- instruction spoken on the first item of a rung only
│ ┌────────────┐ ┌────────────┐     │
│ │   card     │ │   card     │     │  <- 2 x 2, >= touchTarget.child;
│ └────────────┘ └────────────┘     │     enabled when the prompt ends or after the fallback delay
│ ┌────────────┐ ┌────────────┐     │
│ │   card     │ │   card     │     │
│ └────────────┘ └────────────┘     │
│ [ (shrug) I am not sure ] (spoken)│  <- its own full-width row, large, never red
│  footsteps: · · ·                 │  <- the only acknowledgement (no "Got it" word)
└──────────────────────────────────┘
```

```
E2. Short items, landscape (two columns; fits 568 x 320 at the default text size)
┌───────────────────────────────────────────────────────────┐
│ [(icon) exit] (spoken)        ┌────────────┐ ┌────────────┐ │
│                               │   card     │ │   card     │ │
│ [Hoya]                        └────────────┘ └────────────┘ │
│ (speaker, plays on open)      ┌────────────┐ ┌────────────┐ │
│                               │   card     │ │   card     │ │
│  footsteps: · · ·             └────────────┘ └────────────┘ │
│                               [ (shrug) I am not sure ]     │
└───────────────────────────────────────────────────────────┘
```

- Portrait: no scrolling at 320 x 568 up to 200 % text. Landscape: the two-column layout above. Where landscape cannot fit (large text), the grid scrolls while the prompt and "I am not sure" stay pinned.
- The prompt plays on open (the warm-up tap unlocked audio); the first item after Continue or a cold start plays on a tap of a large speaker.
- The cards are enabled when the prompt reports its end or after a fallback delay (the prompt's estimated length plus 3 s, at most 8 s), whichever comes first. "I am not sure" and the exit are always enabled.
- With a screen reader on, the prompt does not auto-play; it plays when the focused speaker is activated.
- Hoya cheers every 2 answers with an effort-only line ("Thanks for listening!").
- No Latin sound chips and no tile building in Short, or for any *Pictures first* learner in any mode.
- No "three not sure" sheet in Short.

## Interaction points

- Tap a card (enabled when the prompt ends, or after the fallback delay): records the answer; the footsteps grow.
- "I am not sure": always enabled; moves on.
- Exit: always enabled; opens the pause sheet as an exit pause.
- Speaker: replays the prompt; with a screen reader on it plays only when activated.

## Navigation graph

Enter from: `placement/warmup`, `placement/handoff`, `placement/pause` (Keep going)
Exit to: next `placement/item-short`, `placement/pause`, `placement/result`

## States

- **success**: portrait and landscape as drawn.
- **200 % text, portrait**: no scrolling at 320 x 568.
- **large text, landscape**: the grid scrolls while the prompt and "I am not sure" stay pinned.
- **reduced motion**: no animation on Hoya or the footsteps.
- **no sound**: Short does not start (`placement/sound-needed`).

## Data needs

- reads: the next question from the run (Short plan), prompt length estimate for the fallback delay
- writes: `placement-run:<profileId>` after each answer, telemetry (ids and counts only)

## Open questions

- None open for this screen; P-6 verifies 320 x 568, 568 x 320 and 200 % text in Playwright.
