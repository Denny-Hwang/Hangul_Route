# Story / Cell page: heritage stories for one grid cell (wireframe v2)

Spec: `docs/specs/F-STORY-005-episode-catalogue-grid.md` §3.6 (map surfaces: cell page, route `CellStories { stage, theme }`), §3.4 (when a story is offered), §3.12; tiles from `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.4 (`StoryTile`)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Any story can be opened without finishing a lesson first; nothing counts what is left.
Code: built (PR 5.5b): `apps/mobile/src/screens/story/CellStoriesScreen.tsx`, the route `CellStories { stage, theme, source }` in `navigation/types.ts` / `root.tsx` (`getId`: one stack entry per cell; tiles and the lesson row push, or go Back to the same episode right under, so Back from a story opened here returns here), `logic/story/cell-stories.ts` (`cellStoriesView`, `cellStoriesOpenedEvent`, the route ids), the lesson row `screens/story/CellLinkRow.tsx`; entries from `entriesForCell(index, stage, theme)` (PR 5.3, in `logic/story/story-index.ts`); tiles through `screens/library/StoryTileGrid.tsx`, the Library's own `StoryTile` grid (F-STORY-004 PR 4.5). On wide windows the body becomes the Journey detail pane once extracted as `CellStoriesView` (F-LAYOUT-001 §3.6). Brief: `design/brief/screens/27-cell-stories.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `[cover]` a `StoryScene` thumbnail.

Promoted by F-STORY-005 PR 5.0 from panel B of the one-file draft (`journey/grid-with-stories.md`).

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.journey`, `learner.storyShelf`).

## Scenario (Given-When-Then)

Given: a grid cell has heritage stories (a stories-only cell, or a lesson cell with a count mark)
When: the learner taps the stories-only cell, the lesson page's stories row, or a story page's home-cell pill
Then: they see the cell's stories on a stable shelf (and the cell's lesson first, if it has one) and can open any of them

## Screen goal

"Pick a heritage story from this cell of the map."

No single primary button: each tile is one button and none is singled out (the Library's "Picked for you" hero lives in the Library, not here). The lesson row, when present, is secondary.

---

## B. Cell page

```
┌──────────────────────────────────┐
│ [<]  Words · Food & Daily Life   │   <- back; "<Stage title> · <Theme title>" on one line
│      "Heritage stories for this  │
│       cell"                      │
│                                  │
│ ┌──────────────────────────────┐ │   <- only if the cell has a lesson or book
│ │ [ Lunch Box Words ]          │ │      secondary row: "<title> — the lesson for this cell";
│ └──────────────────────────────┘ │      a Stage 5 book cell: "<title> — the book for this cell"
│                                  │
│ ┌────────────┐  ┌────────────┐   │   <- StoryTile (F-STORY-004): cover 4:3, title, ~~ ko ~~,
│ │ [cover]    │  │ [cover]    │   │      "about 5 min", state line: New / Keep reading /
│ │ Title      │  │ Title      │   │      Finished (stars when >= 1); "Traditional tale"
│ │ ~~ 한글 ~~ │  │ ~~ 한글 ~~ │   │      pill for tales; whole tile = one button >= 64
│ │ New        │  │ Keep       │   │
│ └────────────┘  └────────────┘   │      1 column at 320, 2 at 360-767, 3-4 from 768
└──────────────────────────────────┘
```

- Stories in `shelf` order; the order never changes with progress.
- The lesson row comes first so the lesson is never hidden by stories. For a `book` cell (F-STORY-005 PR 5.6) the same row names the book: "Festival Tales — the book for this cell" (`learner.journey.cellStories.bookRow`).
- No count of unfinished stories, no "N of M", no recommended-stage label, no timer, no ranking.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Story tile | tap | `EpisodeDetail { episodeId }` (story variant, `episode/detail-story`) |
| Lesson row | tap | `EpisodeDetail { episodeId }` of the lesson or book |
| Back | tap, back gesture | the caller (Journey, the lesson page, or the story page) |

## Navigation graph

Enter from: `journey/grid-with-stories` stories-only cell (`source: 'cell'`) · `episode/detail-cell-stories-row` (`'lesson-row'`) · `episode/detail-story` home-cell pill "Stage 2 · Letters" (`'story-pill'`)
Exit to: `episode/detail-story` · `episode/detail` (lesson) · back

## States

- **success**: B as drawn.
- **empty**: unreachable from the map (placeholder cells are disabled); a stale deep link shows one card, "Nothing here yet", and a Back button.
- **error**: a story or cover that fails to resolve degrades its tile to a theme tint plus the title (F-STORY-004 §3.4); the rest render.
- **locked** (only when content gating is switched on): tiles follow F-STORY-004 §3.4 (lock icon, "Locked", grown-up gate then paywall); never a "Premium" label.
- **offline**: bundled content and local progress.
- **small phone / landscape / 200 % text**: tiles reflow to one column; the header wraps.
- **reduced motion**: no tile press animation.

## Data needs

- reads: `entriesForCell(index, stage, theme)` (story index), the cell's lesson or book episode (`episodesFor`), progress (quests completed, stars), bookmarks, `contentGatingEnabled`
- writes: nothing
- telemetry: `journey.cell_stories_opened` `{ stageKey, themeKey, stories, source: 'cell' | 'lesson-row' | 'story-pill' }` once per open; `story.opened` from the tile's episode page

## Open questions

1. Should a cell with exactly one story skip this page and open the story's episode page directly? Default: no; the page keeps the lesson row and a stable place to come back to.
