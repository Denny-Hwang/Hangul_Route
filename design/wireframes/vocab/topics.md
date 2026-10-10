# Words: Library entry, topic picker, topic page (wireframe v1)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` (§3.1 entry, §3.3 picker, §3.4 topic page); data in F-VOC-001, pictures in F-VOC-002, progress in F-VOC-005
Audience: anyone learning Korean words, any age (CLAUDE.md §1). Nothing tells a learner they are behind; collections only grow.
Code (planned): `screens/library/LibraryScreen.tsx` (Words card), `screens/vocab/VocabTopicsScreen.tsx`, `TopicTile.tsx`, `VocabTopicScreen.tsx`, `WordWall.tsx`, `logic/vocab/{topics,wall,suggest}.ts`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText` (Hangul chip, romanization line, gloss), `[pic]` a WordArt / card-art picture, `o o o . .` a fill-only dots meter.

This file holds three screens and their states in one place (house style is one file per screen; split when promoted to `design/wireframes/vocab/topics.md` and `topic-detail.md`):

- A. Library with the Words entry
- B. Topic picker (`vocab/topics`)
- C. Topic page (`vocab/topic`)
- D. Empty, error and edge states

All copy in boxes is placeholder or an English suggestion; final strings sit in `VOCAB_COPY`.

## Scenario (Given-When-Then)

Given: Words is switched on and at least one topic is ready
When: a learner opens the Library and taps Words
Then: they see a grid of topics, each showing how many words they have collected (a count, never a fraction), pick one freely (nothing is locked), and land on a page where every word of the topic is visible as a picture or a soft silhouette, with one suggested activity highlighted

## Screen goal

"Let the learner choose a topic and see their collection grow; make the next step obvious but never forced."

---

## A. Library with the Words entry

```
┌──────────────────────────────────┐
│ "Heritage Library"      12 cards │  <- today's header (unchanged)
│                                  │
│ ┌ Words ──────────────────────┐  │  <- only when the flag is on and a topic is ready
│ │ [pic row: 3 small pictures] │  │
│ │ "Pick a topic. Meet a few   │  │
│ │  words at a time."          │  │
│ │ 24 collected                │  │  <- a plain count
│ │ [[ OPEN WORDS ]]            │  │  -> vocab/topics
│ └─────────────────────────────┘  │
│ theme filter chips ...           │
│ card grid ...                    │
└──────────────────────────────────┘
```

- With the flag off the screen is exactly today's gallery (no Words card).
- The whole card is one button (>= 64 tall), label "Words. 24 collected. Opens topics."
- When F-STORY-004's section tabs exist, this card becomes the `theme-packs` section ("Words") and the same grid renders inline.

## B. Topic picker (`vocab/topics`)

```
┌──────────────────────────────────┐
│ [<- back]                        │  <- top-left, same place on every screen
│ "Words"                          │
│ "Pick a topic."                  │
│                                  │
│ ┌────────────┐ ┌────────────┐    │  <- 1 column at 320 dp, 2 at 360-767, 3 from 768
│ │ [cover pic]│ │ [cover pic]│    │
│ │ Food       │ │ Animals    │    │
│ │ ~~ 음식 ~~ │ │ ~~ 동물 ~~ │    │  <- Korean title + romanization + gloss
│ │ [=====---] │ │ [==------] │    │  <- fill-only bar (12 dots do not fit a tile) + "5 collected"
│ │ 5 collected│ │ 2 collected│    │
│ └────────────┘ └────────────┘    │
│ ┌────────────┐ ┌────────────┐    │
│ │ Colors     │ │ Numbers    │    │
│ │ ...        │ │ ...        │    │
│ └────────────┘ └────────────┘    │
│   ... 12 tiles, fixed order ...  │
└──────────────────────────────────┘
```

- Each tile is one button (>= 80 tall), label "Food. 5 words collected." The topic tint is a border or fill accent only.
- Order is fixed (topic order); it never re-sorts by progress.
- Tap a tile -> `vocab/topic`.
- No lock, no "Premium" pill (gating is off). If a future PR turns gating on, a locked tile would use F-STORY-004's treatment; nothing is drawn for it here.
- No "n of m", no percent in text. The bar (tile) or the dots (topic page header, full width) show how many words are collected and are hidden from screen readers; the text says "N collected".
- A topic with a missing picture is not listed at all.

## C. Topic page (`vocab/topic`)

```
┌──────────────────────────────────┐
│ [<- back]                        │
│ Food     ~~ 음식 eumsik ~~       │
│ o o o o o . . . . . . .  5 collected │  <- fill-only dots (full width fits 12)
│ (Hoya) "short intro line"        │  <- once per topic per session
│                                  │
│ word wall (file order, stable):  │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │  <- 3 columns at 320 dp, 4 from 360
│ │[pic]│ │[pic]│ │ ░░ │ │ ░░ │      │     collected = picture + word
│ │~~ko~~│ │~~ko~~│ │silh.│ │silh.│    │     new = soft silhouette, no word
│ └────┘ └────┘ └────┘ └────┘      │
│  ... 12 tiles ...                │
│                                  │
│ [[ LEARN ]]                      │  <- the suggested one is primary (changes with progress)
│ [ SPEED ROUND ]   [ MATCH ]      │  <- Match only when the game exists
└──────────────────────────────────┘
```

- A **collected** word tile is tappable: opens that word's flashcard on the back face (`vocab/cards`). A **new** word tile shows a silhouette and the name "Not collected yet"; it is not tappable and shows no Korean (no spoilers).
- **Learn** -> `vocab/cards`. **Speed round** -> `vocab/speed-start` (needs at least 4 collected words; below that the button says "Learn 4 words first" and goes to Learn). **Match** -> `vocab/match` (only when Pic-Word Match exists; needs 3 collected words).
- Which button is primary: Learn when fewer than 4 words are collected or a chunk is waiting and nothing was played today; otherwise Speed round. Match is never primary.
- The wall never shows lock icons, never counts what is left, never re-orders.

## D. Empty, error and edge states

```
No ready topic (dev builds only)      Topic not found (bad link)         Progress not loaded yet
┌───────────────────────┐             ┌───────────────────────┐          ┌───────────────────────┐
│ [<- back]             │             │ [<- back]             │          │ same page, meter shows │
│ "Words are on their   │             │ "Topic not found"     │          │ no filled dots, Learn  │
│  way."                │             │ [[ BACK TO WORDS ]]   │          │ works                  │
└───────────────────────┘             └───────────────────────┘          └───────────────────────┘
```

- Offline: everything is bundled; the screens are identical.
- 200 % text: tiles grow, the grid drops a column, the page scrolls; buttons stay reachable (sticky bottom bar on the topic page).
- Reduced motion: nothing here animates beyond the existing Hoya pose.

---

## Interaction points

| Where | Action | Result |
|---|---|---|
| Library Words card | tap | `vocab/topics` |
| Picker tile | tap | `vocab/topic { topicKey }`; telemetry `vocab.topic_opened` |
| Topic page, collected tile | tap | `vocab/cards` at that word, back face |
| Topic page, Learn / Speed round / Match | tap | `vocab/cards` / `vocab/speed-start` / `vocab/match` |
| Back (top-left) | tap | previous screen |

## Navigation graph

Enter from: `library/gallery` (Words card), `home/vocab-card` (due words, F-VOC-005 §3.7), later a teacher plan item (F-PLAN-002).
Exit to: `vocab/cards`, `vocab/speed-start`, `vocab/match`, back to `vocab/topics` and `library/gallery`.

## Data needs

- `vocabTopics`, `topicItems(key)` (generated content, bundled).
- Per profile: `ProgressSnapshot.vocab` (F-VOC-005): collected count per topic, which words are collected.
- `flags.vocabTopicsEnabled`; `isContentLocked` (always false while gating is off).
- Level (`levelOrder`) is not needed on these screens.

## Open questions

1. Whether a collected tile should also show a small "strong" marker for words in a high box (counts only, never a rank): left out of v1 so the wall stays a pure collection.
2. Whether the Hoya intro line should be shown on every visit or only the first of the day.
3. The Words card position on Library (above the filter chips vs below the gallery) needs a look at the real screen height on a 320 x 568 phone.
