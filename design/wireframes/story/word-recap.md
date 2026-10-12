# Story / Word recap: the new words, once more (wireframe v2)

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` §3.6 (word recap), §3.3 (`recap.ts`), §3.10
Audience: anyone learning Hangul, any age (CLAUDE.md §1).
Code: `apps/mobile/src/screens/story/StoryWordRecap.tsx` (planned, PR 3.4b), shown inside `StoryCheckGame`; word list built by `apps/mobile/src/logic/story/recap.ts` (PR 3.2b); chips drawn with `KoreanText`. Brief: part of `design/brief/screens/22-story-check.md` (§2, recap frame).
Notation: `[[ X ]]` the one primary action, `~~ ko ~~` taught Korean drawn with `KoreanText`, `[spk]` speaker.

Promoted by F-STORY-003 PR 3.0 from panel E of the one-file draft (`story/check.md`).

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.story.recap`).

## Scenario (Given-When-Then)

Given: the learner has answered the last story question and tapped Next
When: the story has words to recap
Then: the words from the story show as chips they can hear one by one; nothing is scored and Done always ends the step

## Screen goal

"Hear the new words from this story once more, then move on."

One primary action: **Done**.

---

## E. Word recap

```
┌──────────────────────────────────┐
│ [x]  ====o o o====      3 / 3    │  <- the check bar stays full
│                                  │
│  "Words from this story"          │
│  ┌──────────────┐ ┌──────────────┐│
│  │ ~~ 설날 ~~    │ │ ~~ 세배 ~~   ││  <- chips: Korean (title size), romanization,
│  │ seollal       │ │ sebae        ││     gloss, speaker (64 hit area)
│  │ Lunar New     │ │ New Year bow ││
│  │ Year's Day    │ │ to elders    ││
│  │         [spk] │ │        [spk] ││
│  └──────────────┘ └──────────────┘│
│  ... up to 4 (Listen) or 8        │
│                                  │
│  [[ DONE ]]                       │
└──────────────────────────────────┘
```

- 2 columns from 360 wide, 1 column at 320. A half-width chip must never break a Korean word across lines, so the recap keeps 1 column when its longest word is over 3 glyphs on a phone (5 from 768 wide), and larger device text counts as a narrower window (width / text scale; `recapColumns`, review follow-up to PR #306).
- Unscored, never blocks. Romanization follows the reading-practice setting (hidden until tap only when the learner opted in).
- Duplicates are removed by id; Listen shows the tier's new keywords (at most 4), other levels the keywords used in the tier (at most 8).

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Chip speaker | tap | plays the word once per tap (clip first, else device speech); the speaker is the chip's one play control (the Korean is plain text, one focus stop per word) |
| Show how to say it | tap | reveals that chip's romanization (hide-romanization mode only); its accessible name adds the chip's Korean ("Show how to say it: 세종") |
| Done | tap, Enter | completes the step (`markStepComplete`, `onFinish`) |
| Close | tap | ends the step like Done (every item is answered and the recap is unscored), so a learner is never sent back to replay the questions |

## Navigation graph

Enter from: `story/check` (Next after the last item), same screen
Exit to: `quest/player` next step (`apply`, `story/sequence`), by Done or Close

## States

- **success**: E as drawn.
- **empty**: no words to recap: the recap is skipped and the step ends after the last question.
- **error**: a word without a gloss cannot ship (validator); a missing voice shows the text and the "Say it yourself" chip (the speakers stay, F-AUDIO-004 §3.8; a silent tap records no `story.recap.word_played`).
- **offline**: bundled; no network.
- **200 % text, 320 wide**: one column, chips grow taller, Done stays reachable by scroll.
- **reduced motion**: no chip press animation.

## Data needs

- reads: `recapWords(story, level)` (tier `newKeywordIds` for Listen; tier keywords otherwise), `romanizationMode`
- writes: nothing scored
- telemetry: `story.recap.word_played` `{ storyId, wordId }` once per distinct word tapped while a Korean voice can play it

## Open questions

1. If F-RVW-001's feedback review ships, does the recap hand its words to it (`newElementIds = tier.newKeywordIds`)? Spec default: yes, nothing else changes here.
