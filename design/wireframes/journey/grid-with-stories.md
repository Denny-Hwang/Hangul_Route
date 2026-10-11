# Journey / Grid with stories: where the heritage stories live on the map (wireframe v2)

Specs: `docs/specs/F-STORY-005-episode-catalogue-grid.md` (§3.1 model, §3.4 when a story is offered, §3.5 grid capacity, §3.6 map surfaces, §3.12 accessibility) · the card surfaces D-G belong to `docs/specs/F-STORY-006-card-award-model.md` §3.5, §3.7, §3.8 (their screen files are listed below)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Nothing says a learner is behind; every locked thing says how to open it; a story cell is never routed through the grown-up PIN.
Code: built so far (PRs 5.1-5.2): `apps/mobile/src/content/episodes.ts` (`episodesFor`, `MAX_EPISODES_PER_CELL`, `cellsOverCapacity`), `apps/mobile/src/logic/journey.ts` (cell-based `stageAvailability`, `isCellComplete`), the pillar registry; planned: `apps/mobile/src/logic/journey-cells.ts` (`cellModel`, `cellLabel`) and the `GridCell` looks in `screens/journey/JourneyScreen.tsx` (PR 5.5a), `logic/story/home-cell.ts` (PR 5.3). Base screen: `journey/grid.md`; two panes on wide windows: `layout/wide.md` C. Brief: `design/brief/screens/05-journey-grid.md` (story cells section) and `27-cell-stories.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `(tab)` a section tab, `~~ ko ~~` taught Korean drawn with `KoreanText` (Korean + romanization + gloss), `#n` a small count mark.

Promoted by F-STORY-005 PR 5.0 from the one-file draft (this file, v1). The panel letters are kept so references still resolve:

- A. Journey with stories: the cell looks (this file)
- B. Cell page: **moved to `story/cell-stories.md`**
- C. Lesson page stories row: **moved to `episode/detail-cell-stories-row.md`**
- D-G. The card surfaces of F-STORY-006 (Results extra cards, Home catch-up card, Library earn hints, story card back face): their screen files are `results/extra-cards.md`, `home/cards-catch-up.md`, `library/earn-hints.md` and `library/card-back-citation.md`, promoted by F-STORY-006 PR 6.0 (until that PR merges they are still drawn in this file)
- H. Future: Stage 5 book cell (this file)
- I. States (this file)

All copy in boxes is placeholder or an English suggestion; final strings live in `packages/i18n` (`learner.journey`, read with `useMessages`).

## Scenario (Given-When-Then)

Given: the bundle holds reviewed heritage stories and the learner has played any amount (even nothing)
When: the learner opens the Journey
Then: they can see which cells have stories, open any story cell without finishing a lesson first, and every lesson cell works exactly as before

## Screen goal

"See where stories live on the map and open one."

The map keeps its single job (pick a cell); a cell with stories adds a count mark, and a stories-only cell becomes tappable. No new primary button.

---

## A. Journey with stories

```
┌──────────────────────────────────┐
│ "Heritage Journey"               │
│ "7 stages x 5 themes. Draw your  │
│  own route."                     │
│                                  │
│  Letters Food Holiday Nature Play│   <- 5 column labels (first word of each theme title)
│ (1) Hangul                [Open] │   <- stage row: badge, title, 1-liner, pill
│     [L #5] [F #1] [H #2] [N #1] [P #1]
│                                  │      lesson cells with a count mark (#n = stories)
│ (2) Words             [A taste]  │
│     [lib #2] [F #1] [lib #1] [N #1] [lib #3]
│                                  │      lib = stories-only cell (library icon, no lesson there)
│     "Heritage stories are open   │
│      in the cells with books."   │   <- one muted caption, shown when the row has a stories-only cell
│ (3) Sentences    [Coming later]  │
│     [lib #2] [lib #1] [lock] [lock] [lock]
│ (4) Dialogue          [A taste]  │
│     [lib #1] [lock] [H ] [lock] [lock]
│ (5) Stories      [Coming later]  │
│     [lock] [lock] [lib #1] [lock] [lock]
│ (6) Real-use     [Coming later]  │
│     [lib #1] [lock] [lock] [lock] [lock]
│ (7) Self-expression [Coming later]  │
│     [lock] [lock] [lock] [lock] [lock]
│                                  │
│ ┌──────────────────────────────┐ │
│ │ How the journey works        │ │   <- explainer: "Each cell is one episode.
│ │ (2 lines, no fractions)      │ │      Cells with books also have heritage stories."
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

Cell looks (5): **lesson** (theme initial, stage-tinted border; success tint when complete; `#n` mark when stories exist) · **lesson, complete** · **stories-only** (`library` icon + `#n`, subtle border, paper fill, tappable) · **book** (Stage 5, future: a grid episode of `format: story`; drawn like a lesson cell) · **placeholder** (lock, disabled, "coming soon").

- `#n` is a 20 dp mark in the cell's top-right corner, not a separate target (cells are ~54 dp wide at 320 dp). It reads "5+" from 6 stories. It is inside the cell's accessibility label, not a second element.
- The stage pill (Open / A taste / Coming later) still reflects **lesson/book cells only**; stories-only cells do not change it. No cell is ever routed through the grown-up PIN for being a story cell.
- The stage pill always shows the availability word, never a commerce word: no "Premium" pill on a stage outside the learner's plan (F-ROUTE-001 R-J, OD-8). "Taste" became "A taste" and "Soon" became "Coming later", the My route words.
- The stage header is a plain row, never a button: it does not open the grown-up PIN or the unlock page, and a screen reader hears the title, the one-liner and the same availability word (no "locked" / "unlock"). Plans are reached from the grown-up area only.
- 15 of 35 cells carry stories in the launch data (7 lesson cells + 8 stories-only cells); the other 20 stay locked placeholders.

## Interaction points (A)

- Lesson cell tap → `EpisodeDetail { episodeId }` (unchanged); the `#n` mark does not intercept the tap
- Stories-only cell tap → `CellStories { stage, theme }` (B)
- Placeholder cell: disabled, label "…, coming soon"
- Row header: no-op (as today)

---

## B, C. Moved

- B. Cell page ("Heritage stories for this cell"): **`story/cell-stories.md`** (same letter).
- C. Lesson page stories row: **`episode/detail-cell-stories-row.md`** (same letter).

---

## D-G. Moved (F-STORY-006 PR 6.0)

The card surfaces of F-STORY-006 have their own files now (same letters):

- D. Results, more cards joined your Library: **`results/extra-cards.md`**
- E. Home, the one-time catch-up card: **`home/cards-catch-up.md`**
- F. Library header, New pill, locked tile with its earn hint, honest explainer: **`library/earn-hints.md`**
- G. Card back face of a story card with its citation: **`library/card-back-citation.md`**

---

## H. Future: Stage 5 book cell (layout rule only)

```
(5) Stories
    [book] [book] [book] [lock] [lock]   <- a cell with one book episode (3 story quests)
```

- A book cell looks like a lesson cell (stage-tinted border, theme initial, completion tint). With volumes (later) a cell shows 2 small dots under the initial; a filled dot = that volume complete; tapping opens the first incomplete volume. Not part of this release.

## I. States

- **No reviewed story in the bundle**: the Journey is exactly today's `journey/grid` (no marks, no stories-only or book cells; the golden test in `episodes.test.ts`).
- **Error**: a story or cover that fails to load never changes a cell's look beyond its count; progress unreadable renders cells without the complete look and the usual muted line.
- **Offline**: everything works from bundled content and the local snapshot.
- **Small phone (320 wide), 200 % text**: five columns leave each cell about 54 x 54 (no hit slop), below the 64 floor: a known exception owned by audit UX-25 and out of scope here (F-STORY-005 §3.12). This spec adds no smaller target: the count mark is not a target and its number stays in the cell label. The column labels wrap. The touch-target audit measures 375 and wider, where the cells are about 65.
- **Wide window**: grid in the master pane, the selected cell's content in the detail pane (`layout/wide.md` C); a stories-only cell navigates as on one pane until its view is extracted.
- **Reduced motion**: no cell press animation.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Lesson (or book) cell | tap | `EpisodeDetail { episodeId }` (unchanged); the count mark does not intercept the tap |
| Stories-only cell | tap | `CellStories { stage, theme }` (`story/cell-stories.md`) |
| Placeholder cell | none | disabled; label "<stage> <theme>, coming soon" |
| Row header | none | no-op (as today) |
| Explainer card | none | read only |

## Navigation graph

Enter from: `tabs/journey` · `results/celebrate` (Next up opens the Journey on wide windows) · `home/todays-mission` slot ② (via the episode)
Exit to: `episode/detail` (lesson cell) · `story/cell-stories` (stories-only cell) · the detail pane on wide windows

## Data needs

- reads: `stages[]`, `themes[]`, `episodesFor(stage, theme)`, story index entries with their home cell (`recommendedStage` + pillar home theme), `ProgressSnapshot.quests[]` (cell complete)
- writes: nothing
- telemetry: none on the map itself; `journey.cell_stories_opened` is sent by the cell page (`story/cell-stories.md`)

## Open questions

1. **Count mark size**: 20 dp inside a cell of about 54 dp at 320 wide; confirm it is legible at 200 % text, or move it into the cell label only on narrow widths.
2. **Stage header pill** on a stage whose only open cells are stories-only still reads "Coming later"; follow audit UX-12 / F-STORY-004 §3.9 for the pill rule.
