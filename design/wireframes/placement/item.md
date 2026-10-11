# Placement: Items: the question frame and the five formats (`placement/item`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.4 (formats), 3.5 (engine), 3.1)
Audience: the learner, any age (CLAUDE.md section 1). Works for a child alone (big targets, spoken prompts) and for an adult (short, quiet).
Code (planned): `screens/placement/ItemScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section E (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: a Standard or Deep run is in progress
When: the learner answers one question at a time
Then: every answer is final on tap, with no right or wrong signal, and "I am not sure" is always a fine answer

## Screen goal

"Answer one question (or say "not sure") and move on."

## Box diagram

```
┌──────────────────────────────────┐
│ [Let us start learning]   (exit)  │  <- always visible, top left; opens F
│  [Hoya line, one short sentence]  │  <- never names the answer
│                                   │
│  PROMPT (one of the formats below)│
│                                   │
│  CHOICES (2 to 4 big cards)       │
│                                   │
│ [ I am not sure ]                 │  <- same size as a choice, never red
│  footsteps: · · · ·               │  <- fills only; no count
└──────────────────────────────────┘
```

Formats (one frame each; romanization and glosses stay hidden unless the learner taps "Show how it sounds"):

```
1. shape-odd-one-out          2. hear-pick-written
   [Which one is different?]     [ (speaker) ]  [hear it again]
   [ㅂ] [ㅂ] [ㅁ] [ㅂ]            [ㅏ] [ㅓ] [ㅑ] [ㅣ]

3. see-pick-sound             4. build-syllable
   ~~ ㄱ ~~  [Show how it       [ (speaker) ]   slots: [   ][   ]
              sounds]            tiles: [ㄱ] [ㅏ] [ㄴ] [ㅓ]
   [ga] [ka] [na] [da]

5. read / hear-pick-picture   6. reply-pick
   ~~ 김치 ~~ or [ (speaker) ]   [ (speaker) hear the line ]
   [pic] [pic] [pic] [pic]       ~~ 안녕하세요 ~~ ~~ 감사합니다 ~~ ~~ 잘 가요 ~~
   (no labels on pictures)
```

- A choice is final on tap: a neutral "Got it" (not in Short, E2), then the next question. No colour change, no sound for right or wrong, no retry, no hint.
- "Show how it sounds" reveals the romanization for this question only; the answer then counts like "not sure".
- "I am not sure" moves on. Three in a row opens F.
- No per-question timer. 45 seconds without any touch opens the pause sheet (F), records nothing and keeps the question (not with "Take my time"). No timer is shown anywhere.
- Every third question Hoya says one encouraging line, whatever the answers were.
- Prompts play on open (the warm-up tap unlocked audio). The first question after Continue or a cold start plays on a tap of a large speaker. With a screen reader on, nothing auto-plays.
- Screen readers: "Question, four choices"; picture choices read their meaning in the test language; the footsteps are skipped.

## Interaction points

- Tap a choice: final; a neutral "Got it", then the next question.
- "Show how it sounds": reveals the romanization for this question; the answer then counts like "not sure" (assisted).
- "I am not sure": moves on; three in a row open the pause sheet.
- Exit (top left): opens the pause sheet.
- 45 s without a touch: opens the pause sheet and keeps the question (not with Take my time).

## Navigation graph

Enter from: `placement/warmup`, `placement/handoff`, `placement/pause` (Keep going), `placement/language` (Continue a saved run)
Exit to: next `placement/item`, `placement/pause`, `placement/result` (run finished)

## States

- **success**: as drawn.
- **small phone / landscape / 200 % text**: choices stack in one column; the exit and "not sure" stay reachable (the screen scrolls).
- **reduced motion**: Hoya and footsteps change state without animation.
- **no sound**: audio-only formats are not asked.
- **storage full**: the run continues in memory (`placement.md` L).

## Data needs

- reads: the next question from the run (`startRun` / `apply`), run `revealMode`, screen-reader state
- writes: `placement-run:<profileId>` after each answer, `placement-ui:<profileId>`, telemetry (ids and counts only)

## Open questions

- Where in the design system do footsteps live (a new fill-only `TrailDots`), and does it share the Home route card's dots? (default: one component)
