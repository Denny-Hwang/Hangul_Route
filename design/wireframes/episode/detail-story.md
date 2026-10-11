# Episode / Story episode page (wireframe v2)

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.6 (story episode detail), §3.8 (resume, start over); base page `episode/detail.md`; book episodes (several stories) from `docs/specs/F-STORY-005-episode-catalogue-grid.md`
Audience: anyone learning Hangul, any age (CLAUDE.md §1). The grown-up row (Sources) is secondary and sits at the end.
Code: `screens/episode/StoryEpisodeDetail.tsx` (planned, PR 4.6), rendered by `EpisodeDetailView.tsx` (built, F-LAYOUT-001 PR 4) when `episode.format === 'story'` and the episode is not a preview; pure `apps/mobile/src/logic/story/open-story.ts`, `story-status.ts` (built, PR 4.3b), recap words from `logic/story/recap.ts`. Brief: `design/brief/screens/25-story-episode-detail.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `[cover]` a `StoryScene` thumbnail.

Promoted by F-STORY-004 PR 4.0 from panel E of the one-file draft (`library/stories.md`).

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.storyShelf`, `learner.storyShelf.episode`).

## Scenario (Given-When-Then)

Given: the learner taps a story tile (Library, a Journey cell page) or the explore card
When: the story's episode page opens
Then: they see what the story is about, one clear button to start or keep reading, the words it teaches, the culture notes they found, and its reward cards without spoilers

## Screen goal

"Start (or keep reading) this story, and see what it holds."

One primary action: the button of the first **new** or **in-progress** row. Everything else is secondary or ghost.

---

## E. Story episode page

```
┌──────────────────────────────────┐
│ [<]                               │
│ [Story Time] [Holidays & Traditions] [4 min]  <- pills (theme title); no stage pill for a shelf story
│ English title (display)           │     (a book episode shows its stage title instead)
│ ~~ ko / romanization ~~           │
│ [Hoya bubble: intro]              │  <- one Hoya on the screen
│                                   │
│ row (new):         [cover] titles  New            [[ START ]]
│ row (in progress): [cover] titles  Keep reading   [[ KEEP READING ]]  [ Start over ]
│ row (finished):    [cover] titles  Finished ***   [ Play again ]  [ Read it again ]
│                                   │
│ Words in this story               │  <- keyword chips, each with a speaker
│ [~~ 설날 ~~ spk] [~~ 세배 ~~ spk]   │     (single-story pages only)
│ Culture notes: N found       [ > ]│  <- only when >= 1 (no bundled story has notes yet)
│ Cards in this episode             │
│ [art + title] [silhouette]        │  <- earned: art, title, Korean; not earned: silhouette,
│                                   │     rarity border, no title (no spoilers)
│ [ Sources ]                       │  <- grown-up row: story/sources (from: 'episode')
└──────────────────────────────────┘
```

- A shelf episode is one story (one row); a Stage 5 book episode lists several rows with the same rules.
- Only one large button on the screen: the first new or in-progress row.
- Play again is scored like any quest replay (best stars kept); Read it again is the unscored reader.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Start | tap | `QuestPlayer { questId, episodeId }` |
| Keep reading | tap | `QuestPlayer { questId, episodeId, resume: true }` (opens on the bookmarked scene) |
| Start over | tap | clears the bookmark, then `QuestPlayer` from scene 1 |
| Play again | tap | `QuestPlayer` (scored replay) |
| Read it again | tap | `StoryReader { storyId, level, mode: 'replay' }` |
| Word chip speaker | tap | plays the word |
| Culture notes line | tap | `CultureNotes { storyId }` |
| Earned card | tap | `CardDetail { cardId }` |
| Sources | tap | `StorySources { storyId, from: 'episode' }` |
| Back | tap | the caller |

## Navigation graph

Enter from: `library/stories` / `library/culture` tiles · `story/cell-stories` tiles (F-STORY-005) · `home/story-time-card` explore card · `results/celebrate-story` Episode page · `story/culture-notes` "From the story"
Exit to: `quest/player` · `story/reader` (replay) · `story/culture-notes` · `library/card-detail` · `story/sources` · back

## States

- **success**: E as drawn.
- **empty**: no culture notes found: the line is hidden; a story without keywords: no words section.
- **error**: an unknown episode id: "Episode not found." and a Back button; stories missing from the bundle: the existing quest list (`episode/detail.md`); unreadable progress: rows render as New.
- **preview episode**: the existing coming-soon card (unchanged).
- **offline**: bundled content and local progress.
- **wide window**: as the Journey detail pane when opened from a two-pane Journey (F-LAYOUT-001); otherwise the reading column.
- **200 % text / 320 wide**: row actions wrap under the titles; the primary stays the largest.

## Data needs

- reads: the episode (format, category or stage, theme, minutes, `hoyaIntroEn`, quest ids, `rewardCardIds`), the bundled story (titles, keywords, cover), progress (completed quests, stars, unlocked cards), bookmarks, found culture notes
- writes: clears a bookmark on Start over
- telemetry: `story.opened` `{ storyId, source: 'episode', mode: 'start' | 'continue' | 'restart' | 'play-again' | 'read-again' }`

## Open questions

1. Should the Sources row also show the "Checked in N passes" line here? Default: no, the row only links; the line lives on Sources.
