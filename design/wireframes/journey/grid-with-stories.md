# Journey / Grid with stories: where the heritage stories live on the map (wireframe v2)

Specs: `docs/specs/F-STORY-005-episode-catalogue-grid.md` (§3.1 model, §3.4 when a story is offered, §3.5 grid capacity, §3.6 map surfaces, §3.12 accessibility) · the card surfaces below (D-G) are `docs/specs/F-STORY-006-card-award-model.md` §3.5, §3.7, §3.8
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Nothing says a learner is behind; every locked thing says how to open it; a story cell is never routed through the grown-up PIN.
Code: built so far: `apps/mobile/src/logic/journey.ts` (`episodesFor`, cell-based `stageAvailability`, `MAX_EPISODES_PER_CELL`, PR 5.2), the pillar registry (PR 5.1); planned: `apps/mobile/src/logic/journey-cells.ts` (`cellModel`, `cellLabel`) and the `GridCell` looks in `screens/journey/JourneyScreen.tsx` (PR 5.5a), `logic/story/home-cell.ts` (PR 5.3). Base screen: `journey/grid.md`; two panes on wide windows: `layout/wide.md` C. Brief: `design/brief/screens/05-journey-grid.md` (story cells section) and `27-cell-stories.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `(tab)` a section tab, `~~ ko ~~` taught Korean drawn with `KoreanText` (Korean + romanization + gloss), `#n` a small count mark.

Promoted by F-STORY-005 PR 5.0 from the one-file draft `wireframes/story-catalogue.md`. The panel letters are kept so references still resolve:

- A. Journey with stories: the cell looks (this file)
- B. Cell page: **moved to `story/cell-stories.md`**
- C. Lesson page stories row: **moved to `episode/detail-cell-stories-row.md`**
- D-G. The card surfaces of F-STORY-006 (Results extra cards, Home catch-up card, Library earn hints, story card back face): below until F-STORY-006 PR 6.0 promotes them to `results/extra-cards.md`, `home/cards-catch-up.md`, `library/earn-hints.md` and `library/card-back-citation.md`
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
│ (2) Words               [Taste]  │
│     [lib #2] [F #1] [lib #1] [N #1] [lib #3]
│                                  │      lib = stories-only cell (library icon, no lesson there)
│     "Heritage stories are open   │
│      in the cells with books."   │   <- one muted caption, shown when the row has a stories-only cell
│ (3) Sentences            [Soon]  │
│     [lib #2] [lib #1] [lock] [lock] [lock]
│ (4) Dialogue             [Soon]  │
│     [lib #1] [lock] [H ] [lock] [lock]
│ (5) Stories              [Soon]  │
│     [lock] [lock] [lib #1] [lock] [lock]
│ (6) Real-use             [Soon]  │
│     [lib #1] [lock] [lock] [lock] [lock]
│ (7) Self-expression      [Soon]  │
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
- The stage pill (Open / Taste / Soon) still reflects **lesson/book cells only**; stories-only cells do not change it. No cell is ever routed through the grown-up PIN for being a story cell.
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

## D. Results: more cards joined your Library

```
┌──────────────────────────────────┐
│        Hoya (cheering)           │
│        "<headline>"              │
│        * * *   (stars)           │
│ [Hoya bubble: cheer line]        │
│                                  │
│ ┌──────────────────────────────┐ │   <- existing quest card banner (2+ stars), unchanged
│ │ New card for your library!   │ │
│ │ [art] Kimchi  김치  gimchi   │ │
│ │ [ See my card ]              │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │   <- NEW: only when an episode / stage / set just completed
│ │ "You finished <episode>!"    │ │      (live region, announced as one sentence)
│ │ "4 more cards joined your    │ │
│ │  Library!"                   │ │
│ │ [art][art][art][art]  (each  │ │      <= 6 thumbs, wrap, each tappable -> CardDetail
│ │  96 dp tile, rarity border)  │ │
│ └──────────────────────────────┘ │
│                                  │
│ [[ Back home ]]  / on stage 1 completion: [[ See your Stage 1 prize ]] (F-QUEST-002)
│ [ Episode page ]                 │
└──────────────────────────────────┘
```

- Appears only on the run that completes the episode (or stage). A replay, or an episode that was already complete, shows nothing new.
- A 1-star finish still shows the extras (completion is not star-gated); the quest card banner shows only at 2+ stars.
- Reduced motion: static. Sparkles stay on the quest card at 3 stars only (unchanged).

## Interaction points (D)

- Thumb tap → `CardDetail { cardId }`
- Stage completion → primary button opens `StageComplete` (F-QUEST-002); the extras banner still shows above it

---

## E. Home: the one-time catch-up card

```
┌──────────────────────────────────┐
│ "Hi <name>"          streak line │
│ ┌──────────────────────────────┐ │   <- NEW: once per app session, only if reconcile added
│ │ [Hoya cheering]              │ │      earned cards other than the welcome card
│ │ "Hoya found 22 cards you     │ │
│ │  already earned!"            │ │
│ │ [[ See my cards ]]           │ │      -> Library; marks those cards seen
│ └──────────────────────────────┘ │
│ ── Today's three cards (unchanged, never interrupted by the catch-up card) ──
└──────────────────────────────────┘
```

- No dismiss timer, no remaining counter. If the app closes first, the Library "New" pills remain.

---

## F. Library: header, New pill, locked tile, honest explainer

```
┌──────────────────────────────────┐
│ "Heritage Library"               │
│ "12 cards collected"             │   <- plain count; no N/M pill
│ chips: All Letters Food Holiday Nature Play
│ ┌──────────┐ ┌──────────┐        │
│ │ [art]    │ │ lock     │        │
│ │ 김치     │ │ "Finish  │        │   <- locked tile: the earn hint, <= 2 lines
│ │ gimchi   │ │  the     │        │      accessibility label: "Locked card. Finish the
│ │ Kimchi   │ │  episode:│        │      episode: Around the Korean Table"
│ │ [New]    │ │  Around… │        │      [New] = newSinceLastView (cleared when opened)
│ └──────────┘ └──────────┘        │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ How to collect more          │ │
│ │ Finish a quest to earn its   │ │
│ │ card.                        │ │
│ │ Finish every quest in an     │ │
│ │ episode to earn more cards.  │ │
│ │ Finish all of Stage 1 for    │ │
│ │ the legendary cards.         │ │   <- + "Finish a story to earn its card." when a story is playable
│ │ Hoya's tiger card is a       │ │
│ │ welcome gift.                │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

Earn hints by rule: episode → "Finish the episode: …" · story → "Finish the story: …" · stage → "Finish every quest in Stage 1" · welcome → "A welcome gift from Hoya" · set → "Collect every card from the … stories".

- Only obtainable-or-owned cards are listed; a held or unreviewed story's card never appears as a lock.
- Locked card detail (`CardDetail`) shows the same hint under the lock; the flip stays disabled.

## Interaction points (F)

- Tile tap → `CardDetail { cardId }` · chip tap → local filter (as today)
- Opening an owned card clears its New pill

---

## G. Card back face of a story card

```
┌──────────────────────────────────┐   (tap to flip; front = art + title + ~~ ko ~~)
│        ~~ 측우기 ~~              │   <- headword: Korean large, romanization, gloss
│        cheugugi                  │
│                                  │
│ Rain Gauge                       │   <- English title
│ "<summary: 1-2 sentences>"       │   <- story summary (verified wording)
│                                  │
│ ┌──────────────────────────────┐ │
│ │ (sparkle) <the sourced fact, │ │   <- verbatim claim, <= 180 characters
│ │  verbatim claim>             │ │
│ │ Source: <publisher>, <title> │ │   <- <= 2 lines, muted
│ │ and 3 more sources           │ │      only when the fact has more; no URL, no link
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

- A card with no citation (the 42 older cards, set cards) keeps today's three bands.
- The grown-up Sources row on the story page lists every source; the learner surface never leaves the app.

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
- **Small phone (320 wide), 200 % text**: cells keep the 64 floor (about 54 dp of art plus the hit slop of today's grid); the count mark stays inside the cell label; the column labels wrap.
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
2. **Stage header pill** on a stage whose only open cells are stories-only still reads "Soon"; follow audit UX-12 / F-STORY-004 §3.9 for the pill rule.
