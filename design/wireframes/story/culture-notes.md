# Story / Culture notes: the facts you found (wireframe v2)

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.5 (Culture notes screen, route `CultureNotes { storyId?, noteId? }`), §3.12; note data (`cultureNotes[]`, `facts[].sources[]`) in `F-STORY-001-story-schema-pipeline.md`; the reader's "Did you know?" card in `story/reader.md` G1
Audience: anyone learning Hangul, any age (CLAUDE.md §1). The learner surface never leaves the app: sources are plain text, no links.
Code: logic built in PR 4.3b (`apps/mobile/src/logic/story/culture-notes.ts`); screen planned in PR 4.7: `screens/story/CultureNotesScreen.tsx`, route in `navigation/types.ts` / `root.tsx`; the reader's "More in Culture notes" button turns on with `CULTURE_NOTES_ROUTE_AVAILABLE`. Brief: `design/brief/screens/24-culture-notes.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `~~ term: ko / rom / gloss ~~` taught Korean drawn with `KoreanText`, `[v]` a collapsed row.

Promoted by F-STORY-004 PR 4.0 from panel D of the one-file draft (`library/stories.md`).

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.storyShelf.cultureNotes`). Note titles, bodies, terms and sources are content.

## Scenario (Given-When-Then)

Given: the learner has finished stories that carry culture notes
When: they open Culture notes from the Library, a story's episode page, the reader's note card or Results
Then: every note they found is listed under its theme, with the Korean term they can hear, the story it came from, and where the facts come from; notes not found yet are neither listed nor counted

## Screen goal

"Read again the culture facts I found, grouped by theme."

No primary button on the list (it is read and scrolled); each note's story row and speaker are secondary. The empty state has one primary: **Go to Story Time**.

---

## D. Culture notes screen

```
┌──────────────────────────────────┐
│ [<]  "Culture notes"   5 found    │
│ Letters & Books                   │  <- five theme headings, in order;
│ ┌───────────────────────────────┐ │     only themes with found notes
│ │ note title                    │ │
│ │ body (<= 220 chars)           │ │
│ │ ~~ term: ko / rom / gloss ~~ [spk]│
│ │ From the story: <title>  [ > ]│ │  <- opens the story's episode page
│ │ [card art, when it has one]   │ │
│ │ [v] Where this comes from     │ │  <- collapsed; sources as plain text
│ └───────────────────────────────┘ │     ("title, publisher"), de-duplicated, no links
│ Food & Daily Life ...             │
│ Holidays & Traditions ...         │
└──────────────────────────────────┘

D2  Empty (no notes found)
│ ┌───────────────────────────────┐ │
│ │ Finish a story to find your   │ │
│ │ first culture note.           │ │
│ │ [[ GO TO STORY TIME ]]        │ │
│ └───────────────────────────────┘ │
```

- No locked placeholders: nothing to spoil, nothing to chase.
- With `storyId` only that story's notes show; with `noteId` that note is scrolled into view and its sources row expanded.
- Theme accents come from `colors.theme[theme]` beside the heading; never the only cue (the heading has words).

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Back | tap, back gesture | the caller |
| Term speaker | tap | plays the term (clip first, else device speech) |
| From the story | tap | `EpisodeDetail { episodeId }` of that story |
| Where this comes from | tap | expand or collapse the plain-text source list |
| Go to Story Time (empty) | tap | `Library { section: 'story-time' }` |

## Navigation graph

Enter from: `library/culture` (notes card) · `episode/detail-story` (Culture notes line, `storyId`) · `story/reader` G1 "More in Culture notes" (`noteId`) · `results/celebrate-story` "Learn about <note>" (`noteId`)
Exit to: back · `episode/detail-story` · `library/stories` (empty state) · `story/sources` is reachable from the story's episode page, not from here

## States

- **success**: D as drawn.
- **empty**: D2.
- **error**: a note whose story or fact does not resolve is skipped; the rest render. An unknown `noteId` opens the list at the top.
- **offline**: bundled content.
- **muted / no Korean voice**: the shared sound panel; the term text stays.
- **200 % text / 320 wide**: cards grow; the card art moves below the text.
- **reduced motion**: scrolling to a deep-linked note jumps.

## Data needs

- reads: `cultureNotes[]` of bundled stories, found notes (derived from completed story quests), facts behind each note and their `sources[]` (title, publisher)
- writes: nothing
- telemetry: `culture.note.viewed` `{ noteId, storyId }` when opened with a note id

## Open questions

1. Should the newest notes show a small "New" pill until opened once (like cards)? Default: no; the Library card already lists the two newest.
