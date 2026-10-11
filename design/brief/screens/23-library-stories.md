# Screen 23 — Library · Story Time

**A stable shelf of stories, with one picked for you.**

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.3, §3.4, §3.9 · wireframes: `design/wireframes/library/stories.md` (A, B, G), `home/story-time-card.md` (the Home card uses the same cover thumbnail) · code: logic built (`apps/mobile/src/logic/story/library-sections.ts`, `story-pick.ts`, `story-status.ts`), screens planned in PR 4.5 (`LibraryScreen` sections, `StoryTile`, design-system `SectionTabs`) · base brief: `15-library-overview.md`

## 1. Context

- **Who**: anyone learning Hangul, at any age.
- **Where**: the Library tab, once at least one reviewed story is bundled. The Library gets section tabs: Cards (today's gallery), Story Time, Culture.
- **Why**: stories should be easy to find and easy to come back to. A stable position is the learner's memory anchor, so tiles never re-sort by progress; one hero tile removes the "which one?" question.

## 2. Layout

Top to bottom, one scrolling column (full width on wide windows, no detail pane):

1. Title "Heritage Library".
2. **Section tabs** (`SectionTabs`): pill chips that wrap, each at least `touchTarget.min` tall; only available sections show.
3. **Picked for you** hero card: cover (4:3 `StoryScene` thumb), English title, Korean title with romanization (`KoreanText`), "about 4 min" pill, one primary button (**Start**, **Keep reading** or **Read it again**).
4. **Shelf grid** in fixed order: tiles with a cover, English title, Korean + romanization, a state line (New / Keep reading / Finished with a `StarRow` when stars are at least 1), "about N min". 1 column at 320, 2 at 360-767, 3-4 from 768.

Frames: Story Time with the hero in each of its three button states; the grid with New, Keep reading and Finished tiles; a tile whose cover failed (theme tint plus the Korean title); the locked tile (gating on only); the Cards section with tabs (today's gallery under the tab row).

## 3. Visual style

- Canvas `surface.canvas`; hero and tiles `surface.paper` with the `card` shadow, radius `radii.lg`.
- Section tabs: selected `brand.primary` fill with `text.onPrimary`; unselected `surface.paper` with `border.subtle` and `text.primary`. Not the 36-point filter chips.
- State line words in `text.secondary`; "Keep reading" adds a small `brand.secondary` dot; Finished shows `StarRow` (no empty stars for a 0-star finish).
- Cover fallback: `colors.theme[theme]` at 0.15 with the Korean title centred.
- Locked (gating on only): `Icon lock` and the word "Locked"; never a "Premium" pill.

## 4. Exact copy

UI strings come from `packages/i18n` (`learner.storyShelf`); English shown:

- Tabs: **"Cards"**, **"Story Time"**, **"Culture"**; tab row label **"Library sections"**
- Hero: **"Picked for you"**, buttons **"Start"**, **"Keep reading"**, **"Read it again"**
- Tile state: **"New"**, **"Keep reading"**, **"Finished"**, **"Locked"**; pill **"about 4 min"**
- Tile label (screen reader): **"Hoya's Seollal Morning. New. About 4 minutes."**

Titles and covers come from the story data (mock: `seollal-new-year`, `sun-and-moon`, `hangeul-day`, `sillok-royal-historians`).

## 5. Reference

Text references only: a children's-library picture-book shelf seen face-on; a streaming app's "continue watching" hero without autoplay; `library/gallery` for the grid rhythm.

## 6. Claude Design prompt

```prompt
Design the Library "Story Time" section for Hangul Route, a Korean-learning app for
learners of every age. Output: three portrait phone frames (390 x 844) and one tablet
frame (768 x 1024).

Tokens by name: canvas surface.canvas, cards surface.paper with the "card" shadow, radius
radii.lg, selected tab brand.primary with text.onPrimary, unselected tab surface.paper with
border.subtle, text text.primary / text.secondary. Tabs and buttons at least 64 tall.

Frame 1: title "Heritage Library"; three pill tabs "Cards", "Story Time" (selected),
"Culture"; a "Picked for you" hero card with a 4:3 flat illustration (a family courtyard on
Lunar New Year morning), English title "Hoya's Seollal Morning", Korean 호야의 설날 아침
with romanization "Hoyaui Seollal achim", a pill "about 4 min" and a large button "Keep
reading"; below, a 2-column grid of four story tiles (cover, English title, Korean with
romanization, a state line: "New", "Keep reading", "Finished" with three small stars,
"New") and "about N min".
Frame 2: the same with the hero button "Start", and one tile whose cover failed: a soft
theme-tinted panel with the Korean title in the middle.
Frame 3: the "Cards" tab selected: today's card gallery under the tab row.
Frame 4 (tablet): the same Story Time section with 3 columns of tiles.

Anti-patterns: tiles sorted by progress, "3 of 24 read", "Premium" labels, red, timers,
Korean without romanization, emoji.
```

## 7. Acceptance checklist

- [ ] Exactly one primary button on the section (the hero's)
- [ ] Tiles in fixed shelf order; state in words; stars only when earned
- [ ] Tabs at least 64 tall and visibly selected by more than colour (fill plus weight)
- [ ] Cover fallback is a tint with the Korean title, never a broken image
- [ ] No counts of what is left, no "Premium"

## 8. Output path

- `design/screens/library/stories__v1__YYYY-MM-DD.png`
