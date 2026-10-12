# Screen 27 — Cell page: heritage stories for this cell

**The stories of one grid cell, on a stable shelf, with the cell's lesson first.**

Spec: `docs/specs/F-STORY-005-episode-catalogue-grid.md` §3.6 · wireframe: `design/wireframes/story/cell-stories.md` (B) · tile: `23-library-stories.md` (the same `StoryTile`) · map: `05-journey-grid.md` §8 · code: `screens/story/CellStoriesScreen.tsx`, `screens/story/CellLinkRow.tsx`, `screens/library/StoryTileGrid.tsx`, `logic/story/cell-stories.ts` (built, PR 5.5b)

## 1. Context

- **Who**: anyone learning Hangul, at any age.
- **Where**: from a stories-only cell on the Journey, the "Heritage stories for this cell" row of a lesson page, and the home-cell pill of a story's episode page.
- **Why**: the 24 heritage stories live on the 7 x 5 map, so a learner can find them by stage and theme. A cell can hold a lesson and several stories; this page shows them together without hiding the lesson and without telling anyone what they have not read.

## 2. Layout

Top to bottom, one scrolling column:

1. Back (top-left); "Words · Food & Daily Life" (stage title · theme title on one line, F-STORY-005 §3.6), then the line "Heritage stories for this cell".
2. **Lesson row** (only when the cell has a lesson or book): a secondary full-width row "<episode title> — the lesson for this cell".
3. **Story tiles** (`StoryTile`, as in the Library): cover 4:3, English title, Korean with romanization, "about N min", the state line (New / Keep reading / Finished with stars), the "Traditional tale" pill for tales. 1 column at 320, 2 at 360-767, 3-4 from 768.

Frames: a stories-only cell with two tiles; a lesson cell's page with the lesson row and one tile; the stale-link empty card.

## 3. Visual style

- Canvas `surface.canvas`; tiles `surface.paper` with the `card` shadow, radius `radii.lg`; the lesson row `surface.paper` with secondary button weight.
- No primary button on the page; tiles are equal.
- Header line `text.secondary`; a small `colors.theme[theme]` accent beside the theme name (decorative).
- Empty card `surface.sunken`.

## 4. Exact copy

UI strings come from `packages/i18n` (`learner.journey`, `learner.storyShelf`); English shown:

- **"Heritage stories for this cell"**
- Lesson row: **"<episode title> — the lesson for this cell"**
- Tiles: as `23-library-stories.md` (**"New"**, **"Keep reading"**, **"Finished"**, **"about 5 min"**, **"Traditional tale"**)
- Empty: **"Nothing here yet"**, **"Back"**

Stage and theme titles come from the catalogue; stories from the bundle. Mock: the Stage 2 Letters & Books cell (stories only: `jikji-metal-type`, `sillok-mountain-archives`) and the Stage 2 Food & Daily Life cell (lesson "Lunch Box Words" plus `gimjang-arirang`).

## 5. Reference

Text references only: a museum room label listing the objects in one case; `23-library-stories.md` for the tile grid.

## 6. Claude Design prompt

```prompt
Design the "Heritage stories for this cell" page for Hangul Route, a Korean-learning app
for learners of every age. Output: two portrait phone frames (390 x 844) and one tablet
frame (768 x 1024).

Tokens by name: canvas surface.canvas, tiles surface.paper with the "card" shadow, radius
radii.lg, text text.primary / text.secondary, a small theme.letters accent beside the
theme name. Every control at least 64 tall. No primary button: tiles are equal.

Frame 1 (stories-only cell): back arrow; "Words · Letters & Books" on one line; the line
"Heritage stories for this cell"; a 2-column grid of two story tiles (4:3 flat cover
illustration, English title, Korean title with romanization, "about 5 min", state lines):
"Jikji: Printed with Metal Type" / 직지, 금속활자로 찍은 책 / Jikji, geumsokhwaljaro jjigeun
chaek / "New", and "The Annals Hide in the Mountains" / 산으로 간 실록 / Saneuro gan sillok /
"Finished" with three small stars.
Frame 2 (lesson cell): "Words · Food & Daily Life"; the same line; a full-width
secondary row "Lunch Box Words — the lesson for this cell"; one tile "Gimjang Day: Sharing
Kimchi, Singing Arirang" / 김장하는 날과 아리랑 / Gimjanghaneun nalgwa Arirang / "Keep
reading".
Frame 3 (tablet): Frame 1 in a 3-column grid.

Anti-patterns: "2 of 3 read", a recommended-stage label, a timer, a big primary button,
locks on story tiles, red, emoji, Korean without romanization.
```

## 7. Acceptance checklist

- [ ] The lesson row comes before the stories when the cell has a lesson
- [ ] Tiles match the Library's `StoryTile` exactly
- [ ] No counts of unread stories, no ranking, no timer
- [ ] Empty (stale link) is a calm card with Back

## 8. Output path

- `design/screens/story/cell-stories__v1__YYYY-MM-DD.png`
