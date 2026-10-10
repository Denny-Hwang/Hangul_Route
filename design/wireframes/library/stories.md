# Story shelf / Library sections, Home story card, Culture notes, story episode page (wireframe v1)

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` (§3.3 sections, §3.4 Story Time, §3.5 Culture, §3.6 episode page, §3.7 Home card, §3.8 resume)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Nothing tells a learner they are behind; finished stories keep their place.
Code (planned): `screens/library/LibraryScreen.tsx` (sections), `StoryTile.tsx`, `CultureSection.tsx`, `screens/story/CultureNotesScreen.tsx`, `screens/episode/StoryEpisodeDetail.tsx`, `screens/home/HomeScreen.tsx` + `logic/homework/mission-builder.ts`, design-system `SectionTabs`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `(tab)` a section tab, `~~ ko ~~` taught Korean drawn with `KoreanText`.

This file holds eight screens or states in one place (house style is one file per screen; split when promoted to `design/wireframes/library/`, `story/`, `home/`, `episode/`):

- A. Library with no stories (today's gallery, no tabs)
- B. Library, Story Time section
- C. Library, Culture section
- D. Culture notes screen
- E. Story episode page (new / in progress / finished rows)
- F. Home "Story time" card (continue / next / again)
- G. Locked tile (only when gating is switched on)
- H. Empty and error states

All copy in boxes is placeholder or an English suggestion; final strings sit in `STORY_SHELF_COPY`.

## Scenario (Given-When-Then)

Given: at least one reviewed story is bundled
When: the learner opens Today or the Library
Then: Today offers the story they were in the middle of (or the next one), the Library has Story Time and Culture sections beside Cards, and the Culture notes they have found are one tap away; with no reviewed story the Library is exactly today's gallery

## Screen goal

"Make it obvious which story to open next, let any story be picked from a stable shelf, and keep the facts the learner found in one place."

---

## A. Library, no stories bundled

```
┌──────────────────────────────────┐
│ "Library"                  12 cards │
│ theme filter chips                │
│ card grid ...                     │
│ "How to collect more" card        │
└──────────────────────────────────┘
```

- No tab row at all (only one section is available).

## B. Library, Story Time

```
┌──────────────────────────────────┐
│ "Library"                         │
│ (Cards) (Story Time) (Culture)    │  <- tabs >= 64 tall, wrap; only the
│                                   │     available sections are offered
│ ┌ Picked for you ───────────────┐ │
│ │ [cover 4:3]                   │ │
│ │ English title                 │ │
│ │ ~~ ko / romanization ~~       │ │
│ │ about 4 min   [[ KEEP READING ]]│ │  <- Start | Keep reading | Read it again
│ └───────────────────────────────┘ │
│ grid, fixed order (shelf.order):  │
│ ┌──────────┐ ┌──────────┐         │
│ │ [cover]  │ │ [cover]  │         │
│ │ title    │ │ title    │         │
│ │ ~~ ko ~~ │ │ ~~ ko ~~ │         │
│ │ New      │ │ Finished │         │  <- state line: New | Keep reading |
│ │ about 4m │ │ *** 4m   │         │     Finished + stars (no empty stars)
│ └──────────┘ └──────────┘         │
└──────────────────────────────────┘
```

- One column at 320 dp, two at 360-767, three or four from 768.
- A tile is one button with the label "title. state. About N minutes."
- Tiles never re-sort by progress.

## C. Library, Culture

```
│ (Cards) (Story Time) (Culture)    │
│ ┌ Culture notes ────────────────┐ │
│ │ 5 found                       │ │  <- a count, never a fraction
│ │ newest: title / title    [ > ]│ │
│ └───────────────────────────────┘ │
│ story tiles of the culture category (as B)
```

## D. Culture notes screen

```
┌──────────────────────────────────┐
│ [<]  "Culture notes"              │
│ Letters & Books                   │  <- five theme headings, in order;
│ ┌───────────────────────────────┐ │     only found notes are listed
│ │ note title                    │ │
│ │ body (<= 220 chars)           │ │
│ │ ~~ term: ko / rom / gloss ~~ [spk]│
│ │ from: story title  [ > ]      │ │
│ │ [card art]                    │ │
│ │ v For grown-ups: where this   │ │  <- collapsed; sources as plain text,
│ │   comes from                  │ │     no links
│ └───────────────────────────────┘ │
│ Food & Daily Life ...             │
└──────────────────────────────────┘
```

- No locked placeholders: notes not found yet are not listed or counted.
- Deep link with a note id scrolls to it and expands it.

## E. Story episode page

```
┌──────────────────────────────────┐
│ [<]                               │
│ [Story Time] [Rites] [4 min]      │  <- pills; no stage pill for a shelf story
│ English title (display)           │
│ ~~ ko / romanization ~~           │
│ [Hoya bubble: intro]              │
│                                   │
│ row (new):       cover, titles, [[ START ]]
│ row (in progress): ..  [[ KEEP READING ]]  [ Start over ]
│ row (finished):  ..  *** [ Play again ]  [ Read it again ]
│                                   │
│ Words in this story: chips + speaker
│ Culture notes: 2 found  [ > ]     │  <- only when >= 1
│ Reward cards: earned = art + title; not earned = silhouette, no title
└──────────────────────────────────┘
```

- Only one large button on the screen (first new or in-progress row).

## F. Home "Story time" card

```
 Today with Hoya
 ┌ (1) [cover 48] Title ------ ▸ ┐   <- Keep reading | A short story | Read it again
 ├ (2) quest card (Journey cursor or assigned) ┤
 └ (3) [icon] next story / replay / daily test ┘
```

- A card flips to the collected look when its quest completes today; a "read it again" card is never collected or scored.
- When no story exists, slot 1 shows the "Take a look" episode card instead (no mislabel).

## G. Locked tile (gating switched on only)

```
│ ┌──────────┐                      │
│ │ [cover]  │  [lock] Locked       │  -> grown-up gate -> paywall
│ └──────────┘                      │
```

- With gating off nothing is locked and no "Premium" label appears anywhere in this feature.

## H. Empty and error

- A category with no playable story: its tab is not offered.
- A cover or story that cannot be resolved: the tile degrades to a theme tint plus the title; the shelf never blanks.
- Culture notes empty: one card explaining that notes appear after finishing a story, with a button to Story Time.
- Episode not found: the existing line plus a Back button.

---

## Interaction points

- Tab tap: local state only (not persisted, no navigation).
- Tile tap: opens the story episode page. Hero button: opens the quest player directly (resume when a bookmark exists).
- Start over: clears the bookmark, then starts at scene 0.
- Note source row: expand/collapse.

## Navigation graph

Enter from: `home` (card), `tabs/library`, `results` ("Next story"), deep link `Library { section }`
Exit to: `quest/player` (start, resume), `story/reader` (read again), `story/culture-notes`, `library/card-detail`

## States

- **success**: as drawn.
- **empty**: A; no culture notes; no stories in a category.
- **error**: broken cover/story/note degrade locally; unreadable bookmarks start the story at scene 0.
- **offline**: bundled content; bookmarks are local.
- **small phone / landscape / 200 % text**: tiles reflow, no horizontal scroll.

## Data needs

- reads: story index (shelf stories, review status), progress snapshot (quests completed, stars), bookmarks (`story:bookmarks:<profileId>`), culture notes (derived from completed quests), `contentGatingEnabled`
- writes: bookmarks (on scene change, cleared at Results), telemetry (ids and counts only)

## Open questions

- Should the hero tile pick a story the learner has not finished in the other category once Story Time is done? (default: yes, next by category order)
- Does the Culture section need a short intro line for first-time visitors? (default: no)
