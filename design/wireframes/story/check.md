# Story / Check: a few easy questions after a story (wireframe v2)

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` §3.2 (scoring and stars), §3.4 (check screen, `ChoiceCard`), §3.10 (accessibility, locale, offline)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). A learner who reads little can still play every screen: pictures, a speaker button and large targets carry the meaning. No kids-only or adults-only framing.
Code: `apps/mobile/src/screens/minigames/StoryCheckGame.tsx` (planned, PR 3.4a); pure rules built in `apps/mobile/src/logic/story/` (`check-view.ts`, `check-player.ts`, `seeded-order.ts`, `story-ref.ts`, PR 3.2a/3.2b); option card built in `packages/design-system` `ChoiceCard` (PR 3.3, `design/components/ChoiceCard/spec.md`). Brief: `design/brief/screens/22-story-check.md`, component brief `design/brief/components/choice-card.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `( )` an option card (`ChoiceCard`), `~~ ko ~~` taught Korean drawn with `KoreanText` (Korean + romanization + gloss), `====o o .====` fill-only bar.

Promoted by F-STORY-003 PR 3.0 from the one-file draft. The panel letters are kept so references in code and specs still resolve:

- A. Check item, answering
- B. Check item, after a first wrong tap
- C. Check item, resolved (explanation + Next)
- D. Check item with picture options (Listen level)
- E. Word recap: **moved to `story/word-recap.md`**
- F, G. Story Order start and replay: **moved to `story/sequence.md`**
- H. Results, story extras: **moved to `results/celebrate-story.md`**

All copy in boxes is placeholder or an English suggestion; final strings live in `packages/i18n` (`learner.story.check`, read with `useMessages`).

## Scenario (Given-When-Then)

Given: the learner has read a story and the quest moves to its `practice` step (`story-check`)
When: they answer three or more questions about it
Then: each question scores once, on the first tap; a wrong tap only ever says "try another"; the explanation always shows why the right answer is right; nothing times them

## Screen goal

"After a story, ask a few easy questions, let a miss feel like a nudge, and always show why the right answer is right."

One primary action: **Next**, shown only once the item is resolved. Before that the options are the targets.

---

## A. Check item, answering

```
┌──────────────────────────────────┐
│ [x]  ====o o .====      1 / 3    │  <- fill-only bar + position pill
│                                  │
│ [speaker]  "What does the         │
│            {target} mean?"        │  <- prompt; {target} drawn inline
│        ~~ ko / romanization ~~    │     (gloss NOT shown yet: no pre-printed answer)
│                                  │
│  ┌────────────────────────────┐  │
│  │ ( ) option text            │  │  <- ChoiceCard, >= 80 tall,
│  └────────────────────────────┘  │     order shuffled (seeded by story + check id)
│  ┌────────────────────────────┐  │
│  │ ( ) option text            │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ( ) option text            │  │  <- 2 to 4 options
│  └────────────────────────────┘  │
│                                  │
│  (no Hoya bubble yet, no timer)  │
└──────────────────────────────────┘
```

- The speaker reads the prompt, then the options in order, only on tap. With Read to me on, the prompt (and the target word) is read when an item opens; options only on request.
- The screen scrolls; no fixed heights. True-false items keep their authored order.

## B. After a first wrong tap

```
│  ┌────────────────────────────┐  │
│  │ ( ) option      Try another │  │  <- amber look + text, locked
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ( ) option                 │  │  <- still tappable
│  └────────────────────────────┘  │
│  [Hoya thinking] hint line        │  <- the item's hint, or "Not quite. Have another look."
```

- Amber (`feedback.nudge`), never red, no X. The item stays open.
- A second wrong tap on the same item: the correct option gets a highlight ring and the bubble says "This one is worth a look." (not scored; it is a retry).

## C. Resolved

```
│  ┌────────────────────────────┐  │
│  │ (v) option      Correct     │  │  <- check mark + word, success tone
│  └────────────────────────────┘  │
│  other options disabled          │
│  ~~ target: ko / rom / gloss ~~  │  <- the gloss appears now
│  [Hoya cheering] explanation     │  <- short sentence from a cited fact
│  [[ NEXT ]]                      │  <- takes focus; no auto-advance
```

- Whatever happened before (right first, or after nudges), the explanation shows and Next waits for the learner.
- After the last item, Next opens the word recap (`story/word-recap.md`) when there are words to recap, else the step ends.

## D. Picture options (Listen level)

```
│ [speaker]  "Which picture is ...?"│
│  ┌────────────┐  ┌────────────┐  │
│  │  (picture) │  │  (picture) │  │  <- 2 columns, art >= 96
│  │  label     │  │  label     │  │     text label under each
│  └────────────┘  └────────────┘  │
│  ┌────────────┐  ┌────────────┐  │
│  │  (picture) │  │  (picture) │  │
│  └────────────┘  └────────────┘  │
```

- Every picture has a text label (also its accessible name, "Picture: <label>"); a missing picture falls back to the label alone.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Option, first tap | tap | scores the item (right or wrong) through `answerRound('check:<id>', correct)`; right: C, wrong: B |
| Option, later taps | tap | retries: never change the score; a right tap resolves the item (C) |
| Prompt speaker | tap | reads the prompt, then the options |
| Target speaker | tap | plays the Korean word (clip first, else device speech) |
| Show how to say it | tap | reveals the romanization (hide-romanization mode only); stays shown |
| Next | tap, Enter | next item, or the recap, or the step ends |
| Close / back | tap | the existing "Leave this quest?" sheet; scored keys stay scored if the learner comes back |

## Navigation graph

Enter from: `quest/player` step `practice` (the `story-check` kind via the `Minigame` route), after `story/reader`
Exit to: `story/word-recap` (same screen) · `quest/player` next step (`apply`, `story/sequence`) · `quest/player` leave sheet

## States

- **success**: A to D as drawn.
- **empty / bad data**: a step that resolves to zero checks shows one line, "There are no questions for this story yet.", and a Continue button that completes the step (never a dead end).
- **error**: unreadable option art falls back to the label; a missing voice shows the text only and, for Korean, the "Say it yourself" chip.
- **offline**: everything is bundled; no network.
- **small phone (320 x 568), landscape (844 x 390), 200 % text**: options stack, the screen scrolls, Next stays reachable.
- **reduced motion**: no press scale, no fade; state changes are instant.

## Data needs

- reads: the story tier's `checks` (prompt, target, options, hint, explanation), the profile's `romanizationMode` and `readToMe`
- writes: `quest-run-store.answerRound` keys `check:<id>` (first answer only scores)
- never persisted: wrong taps, hints shown
- telemetry: `story.check.answered` `{ storyId, level, checkId, kind, firstTry, taps }`, `story.check.finished` `{ storyId, level, items, firstTryCorrect, retries }`

## Open questions

1. Should the explanation be read aloud automatically after an answer, or only on the speaker tap? Default: only on tap.
