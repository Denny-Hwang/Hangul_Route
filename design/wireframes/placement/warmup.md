# Placement: Warm-up question (`placement/warmup`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.1, 3.5, W-5)
Audience: the learner, any age (CLAUDE.md section 1). Works for a child alone (big targets, spoken prompts) and for an adult (short, quiet).
Code (planned): `screens/placement/WarmupScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section D (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: the check is about to start
When: the learner hears a word and taps a picture
Then: audio is unlocked for the run and nothing is scored

## Screen goal

"Unlock audio with one easy, unscored question."

## Box diagram

```
┌──────────────────────────────────┐
│  [Hoya: "Listen, then tap the     │
│          picture."]               │
│        [ ( ) speaker ]            │  <- first audio needs a tap
│ ┌────────┐ ┌────────┐             │
│ │picture │ │picture │             │  <- 3 pictures; one is the heard word
│ └────────┘ └────────┘             │
│ ┌────────┐                        │
│ │picture │                        │
│ └────────┘                        │
│  footsteps: ·                     │
└──────────────────────────────────┘
```

- Not scored. Its tap unlocks audio for the run. If the sound cannot play: in Standard or Deep for a learner who is not listen-first, a line says the check will use pictures and reading, and the audio-only questions are skipped; in Short, or for a listen-first learner, L2 opens instead (W-5).
- Any answer -> E (first scored question).

## Interaction points

- Tap the speaker: plays the word (the first audio needs a tap).
- Tap any picture: goes to the first scored item; the answer is not scored.

## Navigation graph

Enter from: `placement/handoff`, `placement/options`
Exit to: `placement/item` (or `placement/item-short`), `placement/sound-needed` (sound cannot play in Short or for a listen-first learner)

## States

- **success**: as drawn.
- **no sound, Standard or Deep, not listen-first**: one line says the check will use pictures and reading; audio-only questions are skipped.
- **no sound, Short or listen-first**: opens `placement/sound-needed`.
- **offline**: identical.

## Data needs

- reads: the warm-up item (`pitem:warmup-*` from the bank index), audio capability
- writes: audio-unlocked flag for the run

## Open questions

- None open for this screen.
