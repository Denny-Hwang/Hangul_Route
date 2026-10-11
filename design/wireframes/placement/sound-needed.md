# Placement: Sound needed (`placement/sound-needed`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.1, 3.2, W-5)
Audience: a grown-up (parent, caregiver or the learner's own adult self). Behind the PIN gate where marked.
Code (planned): `screens/placement/SoundNeededScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section L2 (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: a Short or listen-first check cannot play sound
When: a grown-up sees what is needed
Then: they can turn sound on and try again, start learning, or check without sound in Standard

## Screen goal

"Get sound working, or offer a way forward without it."

## Box diagram

```
L2. Sound needed (a grown-up screen; W-5)
┌──────────────────────────────────┐
│ [icon: speaker off]               │
│ "Turn on sound to play"           │
│ [[ TRY AGAIN ]]                   │
│ [ Start learning ]                │  <- nothing is stored
│  Check without sound   (link)     │  <- back to C2: Standard selected, Short disabled,
└──────────────────────────────────┘     sound guide unanswered, listen-first off; no second warm-up
```

## Interaction points

- TRY AGAIN: re-tests audio; on success returns to the warm-up.
- Start learning: goes to the first-quest preview; nothing is stored.
- Check without sound (link, hit area at least `touchTarget.min`): back to options C2 with Standard selected, Short disabled, sound guide unanswered, listen-first off; no second warm-up.

## Navigation graph

Enter from: `placement/warmup` (sound cannot play in Short or for a listen-first learner), `placement/options`
Exit to: `placement/warmup`, `onboarding/first-quest-preview`, `placement/options`

## States

- **success**: as drawn.
- **sound comes back on TRY AGAIN**: continues to the warm-up.
- **offline**: identical.

## Data needs

- reads: audio capability
- writes: nothing (nothing is stored when leaving from here)

## Open questions

- None open for this screen.
