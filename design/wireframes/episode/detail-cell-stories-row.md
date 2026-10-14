# Episode / Lesson page: the cell's stories row (wireframe v2)

Spec: `docs/specs/F-STORY-005-episode-catalogue-grid.md` §3.6 (lesson page row), §3.12; base page `episode/detail.md`; locked-card earn hints of the same page in F-STORY-006 (`library/earn-hints.md`)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). The row is an invitation beside the lesson, never a requirement.
Code: built (PR 5.5b) inside `apps/mobile/src/screens/episode/EpisodeDetailView.tsx` with `screens/story/CellLinkRow.tsx` and `lessonRowCount` (`logic/story/cell-stories.ts`); the Stage 5 book page (`screens/episode/StoryEpisodeDetail.tsx`) gets the same row with the first book (PR 5.6, panel D) (the body extracted by F-LAYOUT-001 PR 4, so the row also shows in the Journey detail pane); count from `entriesForCell` (PR 5.3). Brief: `design/brief/screens/06-episode-detail.md` (stories row section).
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `n >` a plain count with a chevron.

Promoted by F-STORY-005 PR 5.0 from panel C of the one-file draft (`journey/grid-with-stories.md`).

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.episode`).

## Scenario (Given-When-Then)

Given: a lesson episode sits in a cell that also has heritage stories
When: the learner opens the lesson page
Then: after the quest list, one row tells them this cell has heritage stories and opens them; without stories the page is exactly today's

## Screen goal

The lesson page's goal is unchanged ("start the next quest"); this row adds one secondary path: "See the heritage stories of this cell."

The page's one primary stays the next quest's Start; the row is secondary.

---

## C. Lesson page: stories row

```
┌──────────────────────────────────┐
│ [<]  Meet the Letters            │
│ ... Hoya intro, quests ...       │   <- [[ START ]] on the next quest stays the one primary
│                                  │
│ ┌──────────────────────────────┐ │   <- new row, only when the cell has stories
│ │ Heritage stories for this    │ │
│ │ cell                     5 > │ │      plain count; the row is >= 64 tall
│ └──────────────────────────────┘ │
│                                  │
│ "Cards in this episode"          │
│ [card] [card] [lock + earn hint] │   <- the lock says how to earn it (F-STORY-006)
└──────────────────────────────────┘
```

- Placed after the quest list and before "Cards in this episode".
- Hidden when the count is 0, so today's lesson page is unchanged without stories. The preview (coming-soon) card is unchanged.
- The count is a plain number of stories in the cell, never "N of M" or "unread".

---

## D. Stage 5 book page: stories row (F-STORY-005 PR 5.6)

A book page is the story variant of the episode page (`episode/detail-story.md` E): one tale row per story of the book. A book sits in a grid cell that may also be the home cell of shelf stories (Festival Tales, Stage 5 Rites, is the home of "A Picture Record of a Royal Birthday"), so the page gets the same row.

```
┌──────────────────────────────────┐
│ [<]                              │
│ [Stories] [Holidays & Traditions] [14 min]
│ Festival Tales (display)         │
│ [Hoya bubble: intro]             │
│                                  │
│ row: [cover] Hoya's Seollal ...  │   <- [[ START ]] on the first new or in-progress row
│ row: [cover] Dano Day ...        │      stays the one primary
│ row: [cover] Chuseok ...         │
│                                  │
│ ┌──────────────────────────────┐ │   <- new row, only when the cell has shelf stories
│ │ Heritage stories for this    │ │      the same CellLinkRow as panel C
│ │ cell                     1 > │ │
│ └──────────────────────────────┘ │
│                                  │
│ Cards in this episode            │   <- unchanged (none for a book until F-CARD-S5-001)
│ [ Sources ]                      │   <- single-story pages only (unchanged)
└──────────────────────────────────┘
```

- Placed after the tale rows and before "Culture notes", "Cards in this episode" and Sources, like panel C.
- The count is the cell's shelf stories (`lessonRowCount`: `entriesForCell`), so the book's own Read quests never count; 0 hides the row.
- A one-story shelf page keeps its home-cell pill instead (the row is only for grid pages); a preview page has neither.
- Tapping opens `CellStories { stage, theme, source: 'lesson-row' }`.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Stories row (C, D) | tap, Enter | `CellStories { stage, theme }` (`story/cell-stories.md`) |
| Everything else | tap | unchanged (`episode/detail.md`) |

## Navigation graph

Enter from: `journey/grid-with-stories` lesson cell · `home/todays-mission` slot ② · `results/celebrate` Episode page · the Journey detail pane on wide windows
Exit to: `story/cell-stories` (the row) · the existing exits of `episode/detail`

## States

- **success**: C as drawn.
- **empty**: no stories in the cell: the row is not drawn.
- **error**: the story index cannot be read: the row is not drawn (the lesson page never breaks for a story problem).
- **offline**: bundled content.
- **200 % text / 320 wide**: the label wraps to two lines; the count and chevron stay on the right.
- **wide window**: the same row inside the detail pane; tapping it navigates (the cell page is a stack screen).

## Data needs

- reads: the episode's cell (`stage`, `theme`), `entriesForCell(index, stage, theme).length`
- writes: nothing
- telemetry: the cell page sends `journey.cell_stories_opened` with `source: 'lesson-row'`

## Open questions

1. Should the row show the first story's cover thumbnail to make it more inviting? Default: no; a plain row keeps the lesson page calm.
