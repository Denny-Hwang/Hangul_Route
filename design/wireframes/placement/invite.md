# Placement: Fork: "I am new" or "I already know some Korean" (`placement/invite`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.1 step 1, 3.10)
Audience: the learner, any age (CLAUDE.md section 1). Works for a child alone (big targets, spoken prompts) and for an adult (short, quiet).
Code (planned): `screens/onboarding/PlacementInviteScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section A (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: someone has just made a profile
When: they are asked where to start
Then: they pick "I am new to Korean" or "I already know some Korean" with equal ease, and neither looks like a warning or a reward

## Screen goal

"Let the learner choose, in one tap, between starting from zero and taking the level check."

## Box diagram

```
┌──────────────────────────────────┐
│ (no back: the profile exists)     │
│        [Hoya waves]               │
│  "Where should we start?" (hear)  │  <- spoken once, replay button
│                                   │
│ ┌───────────────────────────────┐ │
│ │ [icon: seed]                  │ │
│ │ "I am new to Korean"          │ │  <- equal size, equal weight
│ └───────────────────────────────┘ │
│ ┌───────────────────────────────┐ │
│ │ [icon: speech bubble]         │ │
│ │ "I already know some Korean"  │ │
│ │ a few minutes                 │ │
│ └───────────────────────────────┘ │
│  one line: you can stop any time  │
└──────────────────────────────────┘
```

- "I am new to Korean" -> `onboarding/first-quest-preview` (unchanged); records only that the fork was declined.
- "I already know some Korean" -> B (or C when only one language ships).
- Neither choice is a default; neither looks like a warning or a reward.

## Interaction points

- Tap "I am new to Korean": goes to the first-quest preview; records only that the fork was declined.
- Tap "I already know some Korean": goes to the test language screen (or options when only one language ships).
- Replay button: speaks the question again.

## Navigation graph

Enter from: `profiles/create-learner` (after CreateProfile)
Exit to: `onboarding/first-quest-preview` (new), `placement/language` or `placement/options` (one language)

## States

- **success**: as drawn.
- **empty / error**: the bank cannot load: the fork is not shown and CreateProfile goes straight to the first-quest preview (`placement.md` L).
- **offline**: identical (the bank is bundled).

## Data needs

- reads: whether the placement bank loaded, the number of shipped test languages
- writes: telemetry only (fork shown, fork chosen; ids, no free text)

## Open questions

- None open for this screen.
