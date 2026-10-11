# Home / Story time card: today's story among the three missions (wireframe v2)

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.7 (Home "Story time" card, preference chain, `pickStoryForHome`), §3.8 (continue where you left off); amends `docs/specs/F-HW-001-homework-page.md` §3.1 and §9.2; base screen `home/todays-mission.md`
Audience: anyone learning Hangul, any age (CLAUDE.md §1). A story card is an invitation, never a chore: no counts of unread stories, no "behind".
Code: pure `apps/mobile/src/logic/homework/mission-builder.ts` (`explore` kind, story fields) and `apps/mobile/src/logic/story/story-pick.ts` (built in PR 4.3b); card wiring in `screens/home/HomeScreen.tsx` (PR 4.4a, open as #260). Two-column Home on wide windows: `layout/wide.md` B.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `(n)` a mission slot number, `[cover 48]` a small `StoryScene` thumbnail.

Promoted by F-STORY-004 PR 4.0 from panel F of the one-file draft (`library/stories.md`).

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.storyShelf.home`) and the existing Today copy.

## Scenario (Given-When-Then)

Given: the learner opens Today and at least one playable story exists
When: the day's three mission cards are built
Then: the story they were in the middle of (or the next one) takes slot 1, the Journey quest stays in slot 2, and slot 3 offers another story, a replay or the daily test; the cards stay pinned for the day

## Screen goal

"Show one story to read today, right beside today's quest."

The story card is one of three equal mission cards; each card is one button. The page's single primary is still the first not-yet-collected card.

---

## F. Home "Story time" card

```
┌──────────────────────────────────┐
│ (Hoya)  Hi, <name>       [Profile]│
│ Today with Hoya                   │
│ ┌ (1) [cover 48] Title -------- ▸┐│  <- Keep reading | A short story | Read it again
│ ├ (2) quest card (Journey cursor or assigned) ┤
│ └ (3) [cover 48] next story / [icon] replay / daily test ┘
│ Stage progress / Homework / Tip   │
└──────────────────────────────────┘

F2  No story playable
│ ┌ (1) [journey icon] <episode title> ▸┐   <- the "explore" card: subtitle "Take a look"
```

- Slot ① order: continue story → best replay quest → next story → read-again story → explore. Slot ② unchanged (grid episodes only). Slot ③: the daily test when available, else next story → best remaining replay → read-again story → explore. Day one therefore shows two different stories and the first quest.
- A card flips to the collected look when its quest completes **today**; a "Read it again" card is never collected or scored.
- Pinned all day: the target story does not change; only the reason line may refresh (a "A short story" card becomes "Keep reading" after the learner leaves mid-story).
- The cover thumbnail replaces the icon when the story has cover art.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Story card, continue / next | tap | `QuestPlayer { questId, episodeId, resume }` (`resume` only for continue) |
| Story card, again | tap | `StoryReader { storyId, level, mode: 'replay' }` (unscored) |
| Explore card | tap | `EpisodeDetail { episodeId }` |
| Other cards | tap | unchanged (`home/todays-mission.md`) |

## Navigation graph

Enter from: `tabs/home` (Today), cold launch after the profile pick, `results/celebrate` Back home
Exit to: `quest/player` (resumed at the bookmarked scene for continue) · `story/reader` (replay) · `episode/detail` (explore) · the existing Today exits

## States

- **success**: F as drawn.
- **empty**: no playable story (none reviewed, or all locked): F2, the explore card (the old mislabelled "Story time" episode card is gone).
- **error**: a story id that no longer resolves after a content update: the pinned card falls back to the explore card for the rest of the day; unreadable bookmarks: no continue card.
- **collected**: the card shows the collected look after its quest completes today.
- **offline**: built from bundled content and local progress.
- **wide window**: missions sit in the left column (`layout/wide.md` B); slot order never changes.

## Data needs

- reads: story index entries, bookmarks (`story:bookmarks:<profileId>`), completed quests with `completedAt`, replay candidates, the pinned plan of the day (F-HW-001 §3.2), `isLocked(storyId)`
- writes: the pinned plan (existing); nothing story-specific
- telemetry: `home.story_card.shown` `{ storyId, reason }` once per profile per day when a plan with a story card is first pinned; `story.opened` `{ storyId, source: 'home', mode }`

## Open questions

1. Should a finished-everything learner see a read-again story in slot 1 ahead of a replay quest? Spec order: replay quest first (scored practice) — revisit with beta data.
