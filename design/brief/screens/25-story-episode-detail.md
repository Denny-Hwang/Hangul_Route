# Screen 25 — Story episode page

**One story, one clear button, and what the story holds.**

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.6, §3.8 · wireframe: `design/wireframes/episode/detail-story.md` (E) · base brief: `06-episode-detail.md` · code: `screens/episode/StoryEpisodeDetail.tsx` (planned, PR 4.6) inside `EpisodeDetailView.tsx`; logic built (`apps/mobile/src/logic/story/open-story.ts`, `story-status.ts`)

## 1. Context

- **Who**: anyone learning Hangul, at any age; the Sources row at the end is for grown-ups and the curious.
- **Where**: from a story tile (Library, a Journey cell page), Home's explore card, Results "Episode page" and Culture notes.
- **Why**: before reading, a learner sees what the story is about and gets one obvious action. After reading, the same page lets them play it again (scored), read it again (unscored), hear its words and see the cards it gives, without spoilers.

## 2. Layout

Top to bottom, one scrolling reading column:

1. Back (top-left) · pills: category (**Story Time** / **Culture**) or the stage title for a book episode, the theme, "4 min".
2. English title (display size), Korean title with romanization.
3. Hoya intro bubble (one Hoya on the page).
4. **Tale rows**: cover thumbnail, English and Korean titles, a state line, actions by state: new **Start** · in progress **Keep reading** plus ghost **Start over** · finished **Play again** (secondary) plus ghost **Read it again**. Only the first new or in-progress row's button is large.
5. **Words in this story**: keyword chips (Korean, romanization, gloss) with speakers.
6. **Culture notes: N found** row (only when at least one; no bundled story has culture notes yet, F-STORY-002 §3.7, so the frames below leave it out).
7. **Cards in this episode**: earned cards (art, title, Korean, romanization); not earned: a silhouette with the rarity border and no title.
8. Ghost **Sources** row (grown-up).

Frames: a new story; the same story in progress; finished with stars and an earned card; a book episode with three rows.

## 3. Visual style

- Canvas `surface.canvas`; rows and chips `surface.paper`; pills per `components/pill.md`.
- The one large button `brand.primary`, `size="hero"`; others secondary or ghost.
- Not-earned cards: `surface.sunken` silhouette with the `rarity.*` border, no text.
- Stars only when earned (`StarRow`); state in words.

## 4. Exact copy

UI strings come from `packages/i18n` (`learner.storyShelf`, `.episode`); English shown:

- Pills: **"Story Time"**, **"Culture"**, **"4 min"**
- Rows: **"New"**, **"Keep reading"**, **"Finished"**; buttons **"Start"**, **"Keep reading"**, **"Start over"**, **"Play again"**, **"Read it again"**
- **"Words in this story"**, speaker **"Hear <romanization>"**
- **"Culture notes: N found"** (a future story with notes)
- **"Sources"**
- Error: **"Episode not found."** and **"Back"**

Titles, the intro line, words and cards come from the episode and story data (mock: `seollal-new-year`).

## 5. Reference

Text references only: `06-episode-detail.md` (the lesson episode page this varies); a picture-book back cover (what is inside, one action).

## 6. Claude Design prompt

```prompt
Design the story episode page for Hangul Route, a Korean-learning app for learners of
every age. Output: three portrait phone frames (390 x 844).

Tokens by name: canvas surface.canvas, cards and rows surface.paper with the "card"
shadow, primary brand.primary (hero size, the only large button), secondary and ghost
buttons per the Button brief, not-earned card silhouette surface.sunken with a rarity.*
border, text text.primary / text.secondary. Controls at least 64 tall.

Frame 1 (new): back arrow; pills "Story Time", "Holidays & Traditions", "4 min"; title "Hoya's Seollal
Morning", Korean 호야의 설날 아침 / Hoyaui Seollal achim; Hoya the tiger in a small intro
bubble; one tale row (cover thumbnail, titles, "New", a large "Start"); "Words in this
story" with chips 설날 seollal, 설빔 seolbim, 세배 sebae, 떡국 tteokguk (each with a
speaker); "Cards in this episode" with one silhouette card (no title); a ghost row
"Sources".
Frame 2 (in progress): the row shows "Keep reading" (large) and a ghost "Start over".
Frame 3 (finished): the row shows three stars, "Finished", a secondary "Play again" and a
ghost "Read it again"; the earned card with art
and its title.

Anti-patterns: more than one large button, a stage pill on a shelf story, card titles on
silhouettes, percentages, red, emoji, Korean without romanization.
```

## 7. Acceptance checklist

- [ ] One large button on the page (first new or in-progress row)
- [ ] Read it again is a ghost and clearly unscored; Play again is secondary
- [ ] No stage pill on a shelf story; a book episode shows its stage title
- [ ] Not-earned cards give no title or art away
- [ ] Every Korean word has romanization and a gloss

## 8. Output path

- `design/screens/episode/detail-story__v1__YYYY-MM-DD.png`
