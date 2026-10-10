# Story catalogue on the map, and the card award surfaces (wireframe v1)

Specs: `docs/specs/F-STORY-005-episode-catalogue-grid.md` (§3.5 grid, §3.6 map surfaces) · `docs/specs/F-STORY-006-card-award-model.md` (§3.5 catch-up, §3.7 Library and Results copy, §3.8 story cards)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Nothing says a learner is behind; every locked thing says how to open it.
Code (planned): `screens/journey/JourneyScreen.tsx` (`GridCell`, `logic/journey-cells.ts`), `screens/story/CellStoriesScreen.tsx`, `screens/episode/EpisodeDetailScreen.tsx`, `screens/results/ExtraCardsBanner.tsx`, `screens/home/HomeScreen.tsx` (catch-up card), `screens/library/{LibraryScreen,CardDetailScreen}.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `(tab)` a section tab, `~~ ko ~~` taught Korean drawn with `KoreanText` (Korean + romanization + gloss), `#n` a small count mark.

This file holds nine screens or states in one place (house style is one file per screen; split when promoted):

- A. Journey with stories: the cell looks
- B. Cell page ("Heritage stories for this cell")
- C. Lesson page: the stories row
- D. Results: "more cards joined your Library"
- E. Home: the one-time catch-up card
- F. Library: header, New pill, locked tile with an earn hint, honest explainer
- G. Card back face of a story card (sourced fact and citation)
- H. Future: Stage 5 book cell and volumes (not shipped; for the layout rule only)
- I. Empty and error states

All copy in boxes is placeholder or an English suggestion; final strings sit in `JOURNEY_COPY` / `LIBRARY_COPY` / `results-copy.ts`.

## Scenario (Given-When-Then)

Given: the bundle holds reviewed heritage stories and the learner has played any amount (even nothing)
When: the learner opens the Journey, the Library, Today, or finishes a quest
Then: they can see which cells have stories, open any story without finishing a lesson, receive the cards they earned (and the ones they already earned before this version), and read exactly how to get a card they do not have yet

## Screen goal

"See where stories live on the map and open one; get every card you earned, with a clear reason."

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

## B. Cell page — "Heritage stories for this cell"

```
┌──────────────────────────────────┐
│ [<]  Stage 2 · Words             │   <- back; stage title · theme title
│      "Letters & Books"           │
│      "Heritage stories for this  │
│       cell"                      │
│                                  │
│ ┌──────────────────────────────┐ │   <- only if the cell has a lesson/book
│ │ [ Lunch Box Words ]          │ │      secondary row: "the lesson for this cell"
│ └──────────────────────────────┘ │
│                                  │
│ ┌────────────┐  ┌────────────┐   │   <- StoryTile (F-STORY-004): cover 4:3, title, ~~ ko ~~,
│ │ cover      │  │ cover      │   │      "about 5 min", state line: New / Keep reading / Finished
│ │ Title      │  │ Title      │   │      (stars when >= 1)
│ │ ~~ 한글 ~~ │  │ ~~ 한글 ~~ │   │      whole tile = one button >= 64 dp
│ │ New        │  │ Keep       │   │
│ └────────────┘  └────────────┘   │      1 column at 320 dp, 2 at 360-767, 3-4 from 768
│                                  │
└──────────────────────────────────┘
```

- Stories in `shelf` order; order never changes with progress.
- No count of unfinished stories, no "N of M", no recommended-stage label, no timer.

## Interaction points (B)

- Tile tap → `EpisodeDetail { episodeId }` (story variant, F-STORY-004 §3.6)
- Lesson row tap → `EpisodeDetail { episodeId }` of the lesson
- Back → Journey

## Navigation graph

Enter from: Journey stories-only cell · lesson page stories row (C) · story page home-cell pill
Exit to: `EpisodeDetail` (story or lesson) · Journey

---

## C. Lesson page: stories row

```
┌──────────────────────────────────┐
│ [<]  Meet the Letters            │
│ ... Hoya intro, quests ...       │
│                                  │
│ ┌──────────────────────────────┐ │   <- new row, shown only when the cell has stories
│ │ Heritage stories for this    │ │
│ │ cell                     5 > │ │      count is a plain number; row >= 64 dp
│ └──────────────────────────────┘ │
│                                  │
│ "Cards in this episode"          │
│ [card] [card] [lock: "Finish     │   <- locked card says how to earn it (F)
│                  every quest…"]  │
└──────────────────────────────────┘
```

- Row tap → `CellStories { stage, theme }`. Hidden when the count is 0 (so today's lesson page is unchanged without stories).

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

- **No reviewed story in the bundle**: Journey is exactly today's (no marks, no book cells); `CellStories` is unreachable; Library and Results as today except corrected copy.
- **Empty cell page** (stale deep link): one card "Nothing here yet" and a Back button.
- **Error**: a story or cover that fails to load degrades its tile to tint + title; progress unreadable renders cells without the complete look and the usual muted line.
- **Offline**: all screens work from bundled content and the local snapshot.

## Data needs

- reads: `stages[]`, `themes[]`, `episodesFor(stage, theme)`, story index entries with `recommendedStage` (home cell), `ProgressSnapshot.quests[]` (cell complete, story state), `ProgressSnapshot.cards[]` (owned, New), award world (episodes, quests, cards, sets)
- writes: cards through the store actions `unlockCards`, `reconcileAwards`, `markCardsSeen`; nothing else
- telemetry: `journey.cell_stories_opened`, `card.unlocked` (+ `source`), `episode.complete`, `stage.complete`, `card.catchup_granted`, `card_set.complete`

## Open questions

- **Tiger rarity**: keep `legendary` as authored (default) or demote the welcome card to `rare` so "legendary" stays a milestone? Wording in F already says it is a gift.
- **Count mark size**: 20 dp inside a ~54 dp cell at 320 dp; confirm it is legible at 200 % text or move it to the cell label only on narrow widths.
- **Stage header pill** on a stage whose only open cells are stories-only still reads "Soon"; follow audit UX-12 / F-STORY-004 §3.9 for the pill rule.
- **Catch-up card placement** under the greeting vs below the three mission cards; default: under the greeting, because it is a one-time good-news message.
- **`N/M` pill removal** (F-STORY-006 decision 3): restore as a fill-only meter if preferred.
