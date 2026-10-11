# Results / Story extras: after a story quest (wireframe v2)

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` §3.7 (results and reward flow), §3.2 (stars); next story from `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.2 (`nextStoryAfter`); the reserved "Episode complete" slot is filled by F-STORY-006 (`results/extra-cards.md`)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). No numbers, ratios or percents; a low result is met with "read it again", never with a failure look.
Code: `apps/mobile/src/screens/results/StoryResultsExtras.tsx` (planned, PR 3.7) inside `ResultsScreen.tsx`; pure `apps/mobile/src/logic/story/results-extras.ts` (built, PR 3.2b); best-stars rule built in `store/progress-store.ts` (PR 3.6). Base screen: `results/celebrate.md`. Brief: the story section of `design/brief/screens/22-story-check.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`.

Promoted by F-STORY-003 PR 3.0 from panel H of the one-file draft (`story/check.md`).

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.story.results`) and the existing results copy.

## Scenario (Given-When-Then)

Given: the learner finishes a story quest (its quest has a `story-read` step)
When: Results opens
Then: after the usual stars and card reveal they see the story's title, an optional link to a culture note, and one clear next step: the next story, or home; reading it again is always one tap away and changes nothing

## Screen goal

"Celebrate the story and offer the next one."

One primary action: **Next story** when there is one, otherwise **Back home**. Ghosts: **Read it again**, **Episode page**.

---

## H. Results, story extras

```
┌──────────────────────────────────┐
│  Hoya + stars + headline (existing results/celebrate)
│  card reveal + [ See my card ]   (existing, 2+ stars)
│                                  │
│  ┌ story ──────────────────────┐ │
│  │ ~~ 호야의 설날 아침 ~~       │ │  <- story title: Korean, romanization,
│  │ Hoyaui Seollal achim         │ │     English
│  │ Hoya's Seollal Morning       │ │
│  │ [ Learn about <note title> ] │ │  <- only when F-STORY-004 supplies a culture note
│  └──────────────────────────────┘ │
│  (reserved: "Episode complete" line, F-STORY-006)
│                                  │
│  [[ NEXT STORY ]]                │  <- or [[ BACK HOME ]] when there is no next story
│  [ Read it again ]  [ Episode page ]
└──────────────────────────────────┘

H2  0-1 star finish
│  "Every read helps. Want to read it again?"
│  [ Read it again ] listed first among the ghosts
```

- No numbers, ratios or percents anywhere on Results; copy per star tier is unchanged.
- Replays never lower stars: the stored result keeps the best stars (and its accuracy). A replay of a finished story shows no "new card".
- One primary, at most two ghosts.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Next story | tap | `QuestPlayer` for the next story's quest |
| Back home | tap | Main tabs, Today |
| Read it again | tap | `StoryReader { storyId, level, mode: 'replay' }`: unscored, writes nothing |
| Episode page | tap | `EpisodeDetail` of the story's episode (`episode/detail-story`) |
| Learn about <note> | tap | `CultureNotes { noteId }` once that route exists (F-STORY-004 PR 4.7) |
| See my card | tap | `library/card-detail` (existing) |

## Navigation graph

Enter from: `quest/player` after the last step of a story quest (`story/sequence` replay Done)
Exit to: `quest/player` (next story) · `home/todays-mission` · `story/reader` (replay) · `episode/detail-story` · `story/culture-notes` · `library/card-detail`

## States

- **success**: H as drawn.
- **empty**: no next story (the last of the shelf, or gating): the primary is Back home; no culture note: no link row.
- **error**: an unknown story id: the extras block is not drawn and Results is exactly `results/celebrate`.
- **0-1 star**: H2.
- **replay**: no new card, the stars never go down; the extras still show.
- **offline**: nothing changes (the write is local; sync follows later).
- **reduced motion**: the card reveal is static (existing rule).

## Data needs

- reads: the quest (`storyIdOfQuest`, `levelOfQuest`), the bundled story (title), `nextStoryAfter(questId)`, the culture note of the story (F-STORY-004), the run result (stars)
- writes: none beyond the existing single `recordQuestComplete` (best stars kept) and the card award
- telemetry: `story.results.action` `{ questId, storyId, action: 'next-story' | 'read-again' | 'episode' | 'home' | 'culture-note' }`

## Open questions

1. When the episode also completes (F-STORY-006), does the "Episode complete" line sit above or below the story block? Default: above the actions, under the story block (the reserved slot).
