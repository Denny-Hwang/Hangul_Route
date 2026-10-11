# Library / Culture section (wireframe v2)

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.3 (sections), §3.5 (Culture section and Culture notes), §3.4 (story tiles)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Counts of what was found, never fractions of what is left.
Code: logic built in PR 4.3b (`apps/mobile/src/logic/story/library-sections.ts`, `culture-notes.ts`, `story-index.ts`); screen planned in PR 4.5 / 4.7: `screens/library/CultureSection.tsx` inside `LibraryScreen.tsx`, tiles from `StoryTile.tsx`. Brief: `design/brief/screens/24-culture-notes.md` (Culture section frame).
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `(tab)` a section tab, `~~ ko ~~` taught Korean drawn with `KoreanText`, `[cover]` a story cover.

Promoted by F-STORY-004 PR 4.0 from panel C of the one-file draft (`library/stories.md`).

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.storyShelf`).

## Scenario (Given-When-Then)

Given: the bundle has a culture-category story or at least one culture note
When: the learner opens the Library and picks the Culture section
Then: the culture notes they have found are one tap away, and the culture stories sit on the same stable shelf as Story Time

## Screen goal

"Keep the facts I found in one place, next to the culture stories."

One primary action: the **Culture notes** card (opens the notes). Story tiles are secondary.

---

## C. Library, Culture

```
┌──────────────────────────────────┐
│ "Heritage Library"                │
│ (Cards) (Story Time) (Culture)    │
│ ┌ Culture notes ────────────────┐ │
│ │ 5 found                       │ │  <- a count, never a fraction
│ │ newest: title · title     [ > ]│ │  <- the two newest note titles
│ └───────────────────────────────┘ │
│ ┌──────────┐ ┌──────────┐         │  <- culture story tiles, exactly as
│ │ [cover]  │ │ [cover]  │         │     library/stories.md B (fixed order,
│ │ title    │ │ title    │         │     state line, one button each)
│ │ ~~ ko ~~ │ │ ~~ ko ~~ │         │
│ │ New      │ │ Finished │         │
│ └──────────┘ └──────────┘         │
└──────────────────────────────────┘

C2  No notes found yet
│ ┌ Culture notes ────────────────┐ │
│ │ Finish a story to find your   │ │
│ │ first culture note.           │ │
│ └───────────────────────────────┘ │
```

- The Culture notes card is the whole tappable card (at least 64 tall).
- With no culture-category story the section shows only the notes card.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Culture notes card | tap | `CultureNotes` (all found notes) |
| Story tile | tap | `EpisodeDetail { episodeId }` (story variant) |
| Section tab | tap | switches section (local state) |

## Navigation graph

Enter from: `library/stories` or `library/gallery` (Culture tab) · deep link `Library { section: 'culture' }`
Exit to: `story/culture-notes` · `episode/detail-story` · other sections

## States

- **success**: C as drawn.
- **empty**: no notes found: C2 (the card stays, the line explains how notes appear); no culture stories and no notes in the bundle: the tab is not offered.
- **error**: a note whose story does not resolve is not counted; a broken cover degrades to tint plus title.
- **offline**: bundled content; found notes are derived from local progress.
- **200 % text / 320 wide**: the newest titles wrap to two lines, then truncate with the full text in the accessible label.

## Data needs

- reads: culture notes of the bundle, found notes (derived from completed story quests, newest first), culture shelf stories, progress, bookmarks
- writes: nothing
- telemetry: `story.shelf.viewed` `{ section: 'culture', ... }` once per visit

## Open questions

1. Does the Culture section need a short intro line for first-time visitors? Default: no; the notes card's empty line does that job.
