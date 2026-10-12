# Episode / Lesson page: the cell's stories row (wireframe v2)

Spec: `docs/specs/F-STORY-005-episode-catalogue-grid.md` §3.6 (lesson page row), §3.12; base page `episode/detail.md`; locked-card earn hints of the same page in F-STORY-006 (`library/earn-hints.md`)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). The row is an invitation beside the lesson, never a requirement.
Code: built (PR 5.5b) inside `apps/mobile/src/screens/episode/EpisodeDetailView.tsx` with `screens/story/CellLinkRow.tsx` and `lessonRowCount` (`logic/story/cell-stories.ts`); a Stage 5 book page gets the same row with the first book (PR 5.6) (the body extracted by F-LAYOUT-001 PR 4, so the row also shows in the Journey detail pane); count from `entriesForCell` (PR 5.3). Brief: `design/brief/screens/06-episode-detail.md` (stories row section).
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

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Stories row | tap, Enter | `CellStories { stage, theme }` (`story/cell-stories.md`) |
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
