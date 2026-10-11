# Library / Story Time: the story shelf (wireframe v2)

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.3 (Library sections, `SectionTabs`), §3.4 (Story Time section, `StoryTile`, locked tile), §3.9 (content access), §3.12 (accessibility, locale, offline)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Nothing tells a learner they are behind; finished stories keep their place.
Code: logic built in PR 4.3b: `apps/mobile/src/logic/story/library-sections.ts` (`LIBRARY_SECTIONS`), `story-index.ts`, `story-status.ts`, `story-pick.ts` (`pickedForYou`), `open-story.ts`, `shelf-copy.ts`; screens planned in PR 4.5: `screens/library/LibraryScreen.tsx` (sections), `screens/library/StoryTile.tsx`, design-system `SectionTabs`; cover art `StoryScene variant="thumb"`. Brief: `design/brief/screens/23-library-stories.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `(tab)` a section tab, `~~ ko ~~` taught Korean drawn with `KoreanText`, `[cover]` a 4:3 `StoryScene` thumbnail.

Promoted by F-STORY-004 PR 4.0 from the one-file draft (panels A, B, G and the shelf part of H). The other panels moved: C to `library/culture.md`, D to `story/culture-notes.md`, E to `episode/detail-story.md`, F to `home/story-time-card.md`.

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.storyShelf`, read with `useMessages`).

## Scenario (Given-When-Then)

Given: at least one reviewed story is bundled and the learner opens the Library tab (or follows a "Story Time" link)
When: they pick the Story Time section
Then: one story is picked for them with a single clear button, and every story sits on a stable shelf they can open in any order; with no reviewed story the Library is exactly today's card gallery

## Screen goal

"Make it obvious which story to open next, and let any story be picked from a stable shelf."

One primary action: the hero tile's button (**Start**, **Keep reading** or **Read it again**). Tiles are secondary (each is one button).

---

## A. Library, no stories bundled

```
┌──────────────────────────────────┐
│ "Heritage Library"   12 cards collected │
│ theme filter chips                │
│ card grid ...                     │
│ "How to collect more" card        │
└──────────────────────────────────┘
```

- No tab row at all: only the Cards section is available, so the screen is exactly `library/gallery`.

## B. Library, Story Time

```
┌──────────────────────────────────┐
│ "Heritage Library"                │
│ (Cards) (Story Time) (Culture)    │  <- SectionTabs, >= 64 tall, wrap; only the
│                                   │     available sections are offered
│ ┌ Picked for you ───────────────┐ │
│ │ [cover 4:3]                   │ │
│ │ English title                 │ │
│ │ ~~ ko / romanization ~~       │ │
│ │ about 4 min  [[ KEEP READING ]]│ │  <- Start | Keep reading | Read it again
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

- One column at 320, two at 360-767, three or four from 768. No horizontal scroll.
- A tile is one button with the label "<title>. <state>. About N minutes." (plus "N stars" for a finished story with stars).
- Tiles never re-sort by progress. The hero picks: the story in progress, else the next unfinished one by category order, else a finished one to read again.
- On a wide window (F-LAYOUT-001) Story Time uses the full width with no detail pane; a tile opens its episode page as a screen.

## G. Locked tile (only when content gating is switched on)

```
│ ┌──────────┐                      │
│ │ [cover]  │  [lock] Locked       │  -> grown-up gate (when it applies) -> paywall
│ └──────────┘                      │
```

- With gating off (the default) nothing is locked and no "Premium" label appears anywhere in this feature.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Section tab | tap, arrow keys | switches the section (local state, not remembered, no navigation) |
| Hero button | tap | `QuestPlayer` for the story (with `resume` when a bookmark exists), or `StoryReader` replay for Read it again |
| Tile | tap | `EpisodeDetail { episodeId }` (story variant, `episode/detail-story`) |
| Locked tile | tap | `PinEntry { next: 'Paywall' }` when a gate applies, else `Paywall` |

## Navigation graph

Enter from: `tabs/library` · deep link `Library { section: 'story-time' }` (Home, Results, Culture notes empty state)
Exit to: `quest/player` (hero Start / Keep reading) · `story/reader` (hero Read it again) · `episode/detail-story` (tile) · `library/culture` (tab) · `library/gallery` (Cards tab) · `profiles/pin-entry` → `paywall/upgrade` (locked, gating on only)

## States

- **success**: B as drawn.
- **empty**: no playable story at all: A (no tabs); a category with no playable story: its tab is not offered.
- **error**: a story or cover that cannot be resolved: the tile degrades to a theme tint plus the title; one broken story never blanks the shelf. Unreadable bookmarks: every story reads New or Finished.
- **loading**: none to see; the index is bundled.
- **offline**: bundled content; bookmarks are local.
- **small phone / landscape / 200 % text**: tiles reflow to fewer columns; the hero button wraps under the title.
- **reduced motion**: no tile press animation.

## Data needs

- reads: the story index (shelf stories, category, order, minutes, cover scene, review status), progress snapshot (quests completed, stars), bookmarks (`story:bookmarks:<profileId>`), `contentGatingEnabled`
- writes: nothing here (bookmarks are written by the reader, cleared at Results)
- telemetry: `story.shelf.viewed` `{ section, stories, started, finished }` once per visit, `story.opened` `{ storyId, source: 'library', mode }`, `story.locked.tapped` (gating on only)

## Open questions

1. Once Story Time is all finished, should the hero pick an unfinished story from the Culture category? Default: yes, the next by category order (`pickedForYou`).
