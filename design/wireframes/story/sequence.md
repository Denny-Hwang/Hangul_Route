# Story / Story Order v2: put the story in order (wireframe v2)

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` §3.2 (scoring), §3.5 (Story Order v2), §3.10; layout columns in `docs/specs/F-LAYOUT-001-responsive-tablet-landscape.md` §3.6
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Pictures and big cards carry the task; the Korean always comes with romanization and a caption.
Code (built, PR 3.5a): `apps/mobile/src/screens/minigames/StorySequenceGame.tsx` (one component for legacy `storySteps` scopes and story scopes), pure rules `apps/mobile/src/logic/story/sequence-player.ts`, `sequence-cards.ts`, `sequence-view.ts`, `seeded-order.ts`; scene art on the cards and the picture replay follow in PR 3.5b. Brief: `design/brief/screens/12-minigame-story-sequence.md` (revised).
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(art)` a `StoryScene` thumbnail, `[ n ]` a numbered slot.

Promoted by F-STORY-003 PR 3.0 from panels F and G of the one-file draft (`story/check.md`); the letters are kept.

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.story.sequence`).

## Scenario (Given-When-Then)

Given: the quest reaches its `apply` step (`story-sequence`) after the story and its questions, or a Stage 1 quest has a legacy story-steps sequence
When: the learner taps the cards in the order things happened
Then: each slot scores once, a wrong card only nudges, the cards never start in the right order, and when the row is full the story replays in order

## Screen goal

"Put the story's pictures in order, then watch it play back."

One primary action at a time: during ordering the next card is the target (no button); in the replay **Done**.

---

## F. Story Order, start

```
┌──────────────────────────────────┐
│ ====o o . .====           2 / 4   │  <- fill-only bar + position pill
│  "Put the story in order"         │
│  Tap each picture, starting with  │  <- "Tap each step, ..." while cards have no art
│  what happened first.             │
│  slots:  [ 1 ][ 2 ][   ][   ]     │  <- filled left to right
│  cards (never in the right order):│
│  ┌──────────┐ ┌──────────┐        │
│  │ (art)    │ │ (art)    │        │
│  │ ~~ ko ~~ │ │ ~~ ko ~~ │        │  <- Korean large, romanization
│  │ caption  │ │ caption  │        │     upright, English caption
│  └──────────┘ └──────────┘        │
│  [ Skip this one ]                │
└──────────────────────────────────┘
```

- Tap the card that comes next: it moves into the next slot. A wrong card flashes amber briefly ("Try another") and nothing moves; after two wrong taps on a slot the right card gets a ring and Hoya says "This one comes next."
- The start order is a derangement: never the correct order and no card in its own place.
- Cards: 1 column at 320, 2 from 360, 3-4 at tablet width. No order numbers on cards.
- Cards without art show the text block alone on `surface.sunken`, never a broken image (this is how the three legacy sequences look until prop art exists).
- Tap only: no drag (a tap path is needed for screen-reader and switch users anyway).

## G. Story Order, replay

```
┌──────────────────────────────────┐
│  "The story, in order"            │
│  ┌──────────────────────────────┐ │
│  │ (art, full width)            │ │
│  │ ~~ ko ~~   caption           │ │  <- the Korean line is spoken
│  └──────────────────────────────┘ │
│  [<] [ Pause / Play ] [>]         │
│  [ Skip replay ]   [[ DONE ]]     │
└──────────────────────────────────┘
```

- Auto-advances about every 2.5 s with a visible Pause; with reduced motion nothing auto-advances. The replay records nothing. Done ends the step (a button, not a timer).

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Card, right | tap | moves to the next slot; `answerRound(slot, true)` for that slot's first answer |
| Card, wrong | tap | amber flash, nothing moves; `answerRound(slot, false)` once per slot |
| Slot | none | slots are read-only (labels "Place 2 of 4: <caption>") |
| Skip this one | tap | completes the step without recording the remaining slots |
| Replay Back / Next / Pause | tap | move or stop the replay |
| Skip replay / Done | tap | complete the step (`markStepComplete`, `onFinish`) |

## Navigation graph

Enter from: `quest/player` step `apply` (the `story-sequence` kind via the `Minigame` route), after `story/check` and `story/word-recap`; legacy Stage 1 quests with a story-steps sequence
Exit to: `quest/player` next step or `results/celebrate` (story quests: `results/celebrate-story`) · `quest/player` leave sheet

## States

- **success**: F, then G.
- **empty / bad data**: a scope with fewer than 3 cards shows one line, "There is nothing to put in order yet.", and Continue (never a dead end).
- **error**: missing art falls back to the text block; a missing voice keeps the caption and the Korean on screen.
- **offline**: bundled; no network.
- **small phone, landscape, 200 % text**: cards stack, slots wrap, the screen scrolls; Skip stays reachable.
- **reduced motion**: no flash animation (the "Try another" text still shows), no auto-advance in the replay.

## Data needs

- reads: story scope: tier `sequenceSceneIds` (scene art, Korean keyword or line, caption); legacy scope: `storySteps` (no art); the profile's `romanizationMode`
- writes: `quest-run-store.answerRound` with `sequenceRoundKey(slot)` (first answer per slot only)
- telemetry: `story.sequence.finished` `{ storyId | null, sequenceId, slots, firstTryCorrect, retries, replayed, skipped }`

## Open questions

1. Does the replay need a Korean-only mode for fluent heritage learners? Default: no; romanization follows the setting.
