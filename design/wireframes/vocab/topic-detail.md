# Words: topic page (wireframe v1)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` (§3.4 topic page, §3.8 accessibility); data in F-VOC-001, pictures in F-VOC-002, progress in F-VOC-005
Audience: anyone learning Korean words, any age (CLAUDE.md §1). Nothing tells a learner they are behind; collections only grow.
Code: `screens/vocab/VocabTopicScreen.tsx`, `WordWall.tsx`, `logic/vocab/{wall,suggest,topic-view}.ts`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText` (Hangul chip, romanization line, gloss), `[pic]` a WordArt / card-art picture, `o o o . .` a fill-only dots meter.

Split from `topics.md` (section C) when C-4 promoted the wireframes (F-VOC-003 §6). The picker, the Library entry and the shared empty states stay in `topics.md`. The design mock is `design/screens/vocab/topic.md`.

## Scenario (Given-When-Then)

Given: a learner picked a topic in the Words picker
When: the topic page opens
Then: every word of the topic is visible as a picture (collected) or a soft silhouette (not met yet), a plain count says how many are collected, and one suggested activity is highlighted among the three

## Screen goal

"Show the learner their collection for this topic and make the next step obvious, never forced."

---

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

## D. Error and edge states

```
Topic not found (bad link)         Progress not loaded yet
┌───────────────────────┐          ┌───────────────────────┐
│ [<- back]             │          │ same page, meter shows │
│ "Topic not found"     │          │ no filled dots, Learn  │
│ [[ BACK TO WORDS ]]   │          │ works                  │
└───────────────────────┘          └───────────────────────┘
```

- Offline: everything is bundled; the screen is identical.
- 200 % text: tiles grow, the grid drops a column, the page scrolls; buttons stay reachable (sticky bottom bar on the topic page).
- Reduced motion: nothing here animates beyond the existing Hoya pose.

---

## Interaction points

| Where | Action | Result |
|---|---|---|
| Collected tile | tap | `vocab/cards` at that word, back face |
| Learn / Speed round / Match | tap | `vocab/cards` / `vocab/speed-start` / `vocab/match` |
| Back (top-left) | tap | previous screen |

## Navigation graph

Enter from: `vocab/topics` (a tile), the Library Words section (a tile), `home/vocab-card` (due words, F-VOC-005 §3.7), later a teacher plan item (F-PLAN-002).
Exit to: `vocab/cards`, `vocab/speed-start`, `vocab/match`, back.

## Data needs

- `vocabTopic(key)`, `topicItems(key)` (generated content, bundled), the topic's locale overlay (title, Hoya line).
- Per profile: `ProgressSnapshot.vocab` (F-VOC-005): which words are collected, the topic's session row (for the suggestion).
- The learner's level (`levelOrder`): the Speed round's option count (3 or 4) and the chunk a collected word sits in.

## Open questions

1. Whether a collected tile should also show a small "strong" marker for words in a high box (counts only, never a rank): left out of v1 so the wall stays a pure collection.
2. Whether the Hoya intro line should be shown on every visit or only the first of the day.
