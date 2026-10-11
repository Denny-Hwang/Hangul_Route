# Placement: Options: length, sound guide, take my time (`placement/options`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.1 step 3, 3.2 (sound guide), P14 to P20)
Audience: a grown-up (parent, caregiver or the learner's own adult self). Every label is spoken when tapped, so a learner can follow along.
Code (planned): `screens/placement/OptionsScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section C (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: the test language is chosen
When: a grown-up (or the learner) sets up the check
Then: one length is pre-selected by `defaultMode`, the sound guide is answered before a Standard or Deep run, and nothing names an age or a difficulty

## Screen goal

"Confirm the check length (and, for Standard and Deep, the sound guide) and start."

## Box diagram

```
C1. Pictures first (levelOrder 0) with Short pre-selected — one pre-filled card
┌──────────────────────────────────┐
│ [<]  "Set up the check" (hear)    │
│ ┌───────────────────────────────┐ │
│ │ [icon: ear] Short              │ │  <- pre-selected; help + duration lines
│ │ picture and sound questions    │ │
│ │ just a few minutes   [ Change ]│ │  <- opens C2
│ └───────────────────────────────┘ │
│ [[ (icon) START ]]                │  <- nothing else to read or choose -> C3 hand-off
└──────────────────────────────────┘

C2. Everyone else: Standard pre-selected (any levelOrder), after Change, or after "Check without sound" (L2)
┌──────────────────────────────────┐
│ [<]  "A few choices" (hear)       │
│ How long?                         │
│ ┌────────┐ ┌────────┐ ┌────────┐  │
│ │ Short  │ │Standard│ │ Deep   │  │  <- three equal tiles; one pre-selected; no badge
│ │ (help) │ │ (help) │ │ (help) │  │     duration line under each, hidden with Take my time
│ └────────┘ └────────┘ └────────┘  │     Short disabled + "needs sound" line when no sound/voice
│ Sound guide (Standard and Deep)   │  <- asked first, nothing pre-selected (AM-14)
│  ( ) Always show it               │
│  ( ) Show it only when I tap      │
│  one neutral line (consequence)   │
│ [ ] Take my time (no time limits) │  <- on by default with a screen reader
│ [ ] I use a screen reader         │  <- on when the device reports one; the only way to say so on the web;
│     (questions play on a tap)     │     turning it on also turns on Take my time (post-merge #258)
│ Why Korean? (optional) [family] [K-culture] [curious] [friend] [ Skip ]
│ [[ NEXT ]]                        │  <- disabled until the sound guide is answered (Standard, Deep)
└──────────────────────────────────┘
```

- Pre-selection (`defaultMode`, the first rule that matches, spec section 3.1 step 3): a newest Short whose hint fired -> Standard; a route above `stage1` band 0 -> Standard; *Pictures first* with sound and a voice for the test language -> Short; *Pictures first* without -> Standard; everyone else -> Standard. Deep never. The Short tile is disabled with the "needs sound" line whenever Short is unavailable.
- C1 is shown only when Short is pre-selected. A *Pictures first* learner with Standard pre-selected gets C2, so the sound-guide question is always answered before a Standard or Deep run.
- The three tiles sit side by side only at a content width of 480 pt or more and a font scale of 1.3 or less; otherwise they stack in one full-width column. On wide windows C1 and C2 stay centred in the reading width (F-LAYOUT-001). The tiles are radios with selected and disabled state; a disabled Short tile announces the "needs sound" line.
- Every label is spoken when tapped. No age, no "kids", no "easy" or "hard", no "test". Each choice has a one-sentence helper; none uses words like "test score", "pass" or "fail". The profile's sound-guide setting is never written.
- "Why Korean?" only changes the order of themes on the route.
- NEXT -> C3 when Short is chosen or `levelOrder` is 0, else -> D.

## Interaction points

- C1 START: goes to the hand-off.
- C1 Change: opens C2.
- C2 length tile: selects Short, Standard or Deep; a disabled Short tile announces the "needs sound" line.
- C2 sound guide radio: required before NEXT for Standard and Deep.
- Take my time: hides duration lines and turns off time limits.
- Why Korean? chip: only changes the order of themes on the route; Skip is equal.
- NEXT: hand-off when Short is chosen or `levelOrder` is 0, else the warm-up.

## Navigation graph

Enter from: `placement/language` (or the entry screen with one language), `placement/sound-needed` ("Check without sound")
Exit to: `placement/handoff`, `placement/warmup`, back to `placement/language`

## States

- **success**: C1 or C2 as drawn.
- **no sound or no voice**: Short disabled with the "needs sound" line; Standard pre-selected.
- **after Check without sound**: C2 with Standard selected, Short disabled, sound guide unanswered, listen-first off.
- **large text / narrow**: tiles stack in one full-width column.
- **error / offline**: identical.

## Data needs

- reads: profile `ageGroup` -> level order, the newest placement result (hint fired?), the route position, audio capability and voice for the test language, screen-reader state
- writes: the run's `mode`, `revealMode`, `takeMyTime`, `whyKorean` (never the profile's sound-guide setting)

## Open questions

- Recalibrate the length durations from `placement.item_answered.ms` after beta (spec assumption 4).
