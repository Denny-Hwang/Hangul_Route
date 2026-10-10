# Story / Check, Story Order v2, word recap, story Results (wireframe v1)

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` (§3.4 check, §3.5 order, §3.6 recap, §3.7 results)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). A learner who reads little can still play every screen: pictures, a speaker button and large targets carry the meaning. No kids-only or adults-only framing.
Code (planned): `screens/minigames/StoryCheckGame.tsx`, `screens/story/StoryWordRecap.tsx`, `screens/minigames/StorySequenceGame.tsx` (changed in place), `screens/results/StoryResultsExtras.tsx`, design-system `ChoiceCard`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `( )` radio-like option card, `~~ ko ~~` taught Korean drawn with `KoreanText` (Korean + romanization + gloss), `o o .` fill-only dots.

This file holds eight screens or states in one place (house style is one file per screen; split when promoted to `design/wireframes/story/` and `results/`):

- A. Check item, answering
- B. Check item, after a first wrong tap
- C. Check item, resolved (explanation + Next)
- D. Check item with picture options (Listen level)
- E. Word recap
- F. Story Order, start
- G. Story Order, replay
- H. Results, story extras

All copy in boxes is placeholder or an English suggestion; final strings sit in `STORY_CHECK_COPY`.

## Scenario (Given-When-Then)

Given: the learner has read a story and the quest moves to its `practice` step (`story-check`), then `apply` (`story-sequence`)
When: they answer three or more questions, put four pictures in order, and hear the new words
Then: each question scores once on the first tap, a wrong tap only ever says "try another", stars never go down, and Results offers the next story

## Screen goal

"After a story, ask a few easy questions, let a miss feel like a nudge, and always show why the right answer is right."

---

## A. Check item, answering

```
┌──────────────────────────────────┐
│ [x]  ====o o .====      1 / 3    │  <- fill-only bar + position pill
│                                  │
│ [speaker]  "What does the         │
│            {target} mean?"        │  <- prompt; {target} drawn inline
│        ~~ ko / romanization ~~    │     (gloss NOT shown yet)
│                                  │
│  ┌────────────────────────────┐  │
│  │ ( ) option text            │  │  <- ChoiceCard, >= 80 tall,
│  └────────────────────────────┘  │     order shuffled (seeded)
│  ┌────────────────────────────┐  │
│  │ ( ) option text            │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ( ) option text            │  │  <- 3 or 4 options
│  └────────────────────────────┘  │
│                                  │
│  (no Hoya bubble yet, no timer)  │
└──────────────────────────────────┘
```

- The speaker reads the prompt, then the options in order, only on tap. With "Read to me" on, the prompt is read when an item opens.
- The screen scrolls; no fixed heights.

## B. After a first wrong tap

```
│  ┌────────────────────────────┐  │
│  │ ( ) option      Try another │  │  <- amber look + text, locked
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ( ) option                 │  │  <- still tappable
│  └────────────────────────────┘  │
│  [Hoya thinking] hint line        │  <- hint or default line
```

- Amber (`feedback.nudge`), never red, no X. The item stays open.
- A second wrong tap on the same item: the correct option gets a highlight ring and the bubble says to look at it (not scored; it is a retry).

## C. Resolved

```
│  ┌────────────────────────────┐  │
│  │ (v) option      correct     │  │  <- check icon + label, success tone
│  └────────────────────────────┘  │
│  other options disabled          │
│  [Hoya cheering] explanation     │  <- short sentence from a cited fact
│  [[ NEXT ]]                      │  <- takes focus; no auto-advance
```

- Whatever happened before (right first, or after nudges), the explanation shows and Next waits for the learner.
- After the last item, Next opens the recap (E) when there are words to recap, else the step ends.

## D. Picture options (Listen level)

```
│ [speaker]  "Which picture is ...?"│
│  ┌────────────┐  ┌────────────┐  │
│  │  (picture) │  │  (picture) │  │  <- 2 columns, art >= 96
│  │  label     │  │  label     │  │     English label under each
│  └────────────┘  └────────────┘  │
│  ┌────────────┐  ┌────────────┐  │
│  │  (picture) │  │  (picture) │  │
│  └────────────┘  └────────────┘  │
```

- Every picture has a text label (also its accessible name); a missing picture falls back to the label alone.

## E. Word recap

```
│  "Words from this story"          │
│  ┌──────────────┐ ┌──────────────┐│
│  │ ~~ 설날 ~~    │ │ ~~ 세배 ~~   ││  <- chips: Korean, romanization,
│  │ gloss  [spk]  │ │ gloss  [spk] ││     gloss, speaker (64 hit area)
│  └──────────────┘ └──────────────┘│
│  ... up to 4 (Listen) or 8        │
│  [[ DONE ]]                       │
```

- Unscored, never blocks. Romanization follows the reading-practice setting (hidden until tap only when the learner opted in).

## F. Story Order, start

```
│ ====o o . .====           2 / 4   │
│  "Put the story in order"         │
│  slots:  [ 1 ][ 2 ][   ][   ]     │  <- filled left to right
│  cards (never in the right order):│
│  ┌──────────┐ ┌──────────┐        │
│  │ (art)    │ │ (art)    │        │
│  │ ~~ ko ~~ │ │ ~~ ko ~~ │        │  <- Korean large, romanization
│  │ caption  │ │ caption  │        │     upright >= 16, English caption
│  └──────────┘ └──────────┘        │
│  [ Skip this one ]                │
```

- Tap the card that comes next: it moves into the next slot. A wrong card flashes amber briefly and nothing moves; after two wrong taps on a slot the right card gets a ring.
- Cards without art show the text block alone, never a broken image.

## G. Story Order, replay

```
│  full-width card in order         │
│  (art) ~~ ko ~~ caption           │
│  [<] [ pause / play ] [>]         │
│  [ Skip replay ]   [[ DONE ]]     │
```

- Auto-advances about every 2.5 s with a visible Pause; with reduced motion nothing auto-advances. The replay records nothing.

## H. Results, story extras

```
│  Hoya + stars + headline (existing)
│  card reveal + [ See my card ] (existing)
│  ┌ story title ───────────────┐   │
│  │ ~~ ko ~~  English title    │   │
│  │ culture-note line (when F-STORY-004 has one) │
│  └────────────────────────────┘   │
│  [[ NEXT STORY ]]  or [[ BACK HOME ]]
│  [ Read it again ]  [ Episode page ]
```

- No numbers, ratios or percents. 0-1 star copy is encouraging and offers "Read it again" first.

---

## Interaction points

- Option tap: the first tap scores that item (right or wrong); later taps are retries and never change the score.
- Next: always manual. Back/Leave: the existing confirm sheet; scored keys stay scored if the learner returns.
- Speaker buttons: tap to hear; failure or mute is silent and the text stays.
- Recap chip speaker: plays the word once per tap.
- Replay controls: pause, back, next, skip.

## Navigation graph

Enter from: `quest/player` step `practice` (check) and `apply` (order) via the `Minigame` route
Exit to: `quest/player` (step done) - `results/celebrate` (quest done) - `story/reader` ("Read it again", unscored)

## States

- **success**: as drawn.
- **empty/bad data**: a check or order step that resolves to nothing shows one line and a Continue button (never a dead end).
- **error**: unreadable art falls back to text; a missing voice shows the text only (and a "say it yourself" chip for Korean).
- **offline**: everything is bundled; no network.
- **small phone (320 x 568), landscape (844 x 390), 200 % text**: options stack, the step scrolls, Next stays reachable.
- **reduced motion**: no press scale, no fade, no auto-advance in the replay.

## Data needs

- reads: `Story` tier (`checks`, `sequenceSceneIds`, `newKeywordIds`, scenes, facts), `romanizationMode` (F-I18N-001), "Read to me" setting
- writes: `quest-run-store.answerRound` keys (`check:<id>`, slot number, `cp:<id>`); recap and results telemetry
- never persisted: wrong taps, hints shown

## Open questions

- Should the explanation sentence be read aloud automatically after an answer, or only on the speaker tap? (default: only on tap)
- Does the replay need a Korean-only mode for fluent heritage learners? (default: no; romanization follows the setting)
