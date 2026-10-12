# Words: Library entry and topic picker (wireframe v1)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` (§3.1 entry, §3.3 picker); data in F-VOC-001, pictures in F-VOC-002, progress in F-VOC-005
Audience: anyone learning Korean words, any age (CLAUDE.md §1). Nothing tells a learner they are behind; collections only grow.
Code: `screens/library/LibraryScreen.tsx` (the Words section), `screens/vocab/VocabTopicsScreen.tsx`, `TopicGrid.tsx`, `TopicTile.tsx`, `logic/vocab/{topics,topic-view}.ts`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText` (Hangul chip, romanization line, gloss), `[pic]` a WordArt / card-art picture, `o o o . .` a fill-only dots meter.

This file holds the Library entry and the picker. The topic page (section C) moved to `topic-detail.md` when F-VOC-003 C-4 promoted the wireframes (house style is one file per screen). The design mock is `design/screens/vocab/topics.md`.

- A. Library with the Words entry
- B. Topic picker (`vocab/topics`)
- D. Empty and edge states

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
- **Built (C-4):** the section tabs landed first (F-STORY-004 PR 4.x), so the card is not built (spec T1, §8 item 1). The Library offers a **Words** tab when the flag is on and a topic is ready; it holds the line, the plain count and the topic grid of B:

```
┌──────────────────────────────────┐
│ "Heritage Library"               │
│ [Cards] [Story Time] [Culture] [Words] │  <- Words only with the flag on and a ready topic
│ "Pick a topic. Meet a few words  │
│  at a time."                     │
│ 24 collected                     │  <- a plain count
│ ┌────────────┐ ┌────────────┐    │  <- the picker's grid (B), inline
│ │ [cover pic]│ │ [cover pic]│    │
│ │ ...        │ │ ...        │    │
└──────────────────────────────────┘
```

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

## D. Empty and edge states

```
No ready topic (dev builds only)
┌───────────────────────┐
│ [<- back]             │
│ "Words are on their   │
│  way."                │
└───────────────────────┘
```

- Topic not found and progress not loaded are states of the topic page: `topic-detail.md` D.
- Offline: everything is bundled; the screens are identical.
- 200 % text: tiles grow, the grid drops a column, the page scrolls.
- Reduced motion: nothing here animates.

---

## Interaction points

| Where | Action | Result |
|---|---|---|
| Library Words tab | tap | the Words section (B's grid, inline) |
| Picker or Words-section tile | tap | `vocab/topic { topicKey }`; telemetry `vocab.topic_opened` (`source: 'library'`) |
| Back (top-left) | tap | previous screen |

## Navigation graph

Enter from: `library/gallery` (the Words tab holds the grid itself), `home/vocab-card` (due words, F-VOC-005 §3.7), later a teacher plan item (F-PLAN-002).
Exit to: `vocab/topic` (`topic-detail.md`), back to `library/gallery`.

## Data needs

- `vocabTopics`, `topicItems(key)` (generated content, bundled).
- Per profile: `ProgressSnapshot.vocab` (F-VOC-005): collected count per topic, which words are collected.
- `flags.vocabTopicsEnabled`; `isContentLocked` (always false while gating is off).
- Level (`levelOrder`) is not needed on these screens.

## Open questions

1. ~~The Words card position on Library~~: resolved by T1, Words is its own Library tab (C-4).
