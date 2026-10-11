# Screen 24 — Culture notes (and the Library Culture section)

**The culture facts you found, kept in one place.**

Spec: `docs/specs/F-STORY-004-story-shelf-home-library.md` §3.5 · wireframes: `design/wireframes/story/culture-notes.md` (D), `library/culture.md` (C), the reader's note card `story/reader.md` G1 · code: logic built (`apps/mobile/src/logic/story/culture-notes.ts`), screens planned in PR 4.5 / 4.7 (`CultureSection.tsx`, `CultureNotesScreen.tsx`)

## 1. Context

- **Who**: anyone learning Hangul, at any age.
- **Where**: the Library's Culture section (a "Culture notes" card above the culture stories), the Culture notes screen, links from a story's episode page, the reader's "Did you know?" card and Results.
- **Why**: a story can carry short culture notes. The ones a learner has found are kept here, grouped by theme, with the Korean term to hear, the story they came from and where the facts come from. Notes not found yet are not listed or counted: nothing to spoil, nothing to chase.

## 2. Layout

**Culture section**: the **Culture notes** card on top ("5 found", the two newest titles, a chevron; the whole card is one button), then the culture story tiles exactly as Story Time.

**Culture notes screen** (scrolling): Back and title "Culture notes" with a "5 found" pill · theme headings in order (Letters & Books, Food & Daily Life, Holidays & Traditions, Nature & Animals, Play & Crafts) with a small theme accent · note cards: title, body (up to 220 characters), the term (`KoreanText`) with a speaker, "From the story: <title>" row, card art when the note has a card, a collapsed "Where this comes from" row that expands to plain-text sources ("title, publisher").

**Empty**: one card, "Finish a story to find your first culture note.", primary **Go to Story Time**.

## 3. Visual style

- Note cards `surface.paper` with the `card` shadow; the sources list inset on `surface.sunken`, `text.secondary`.
- Theme accent: a short bar in `colors.theme[theme]` beside each heading (the heading text is the cue; colour only decorates).
- The "found" count is a neutral `Pill`; never a fraction or meter.
- No links anywhere on this surface (sources are text).

## 4. Exact copy

UI strings come from `packages/i18n` (`learner.storyShelf.cultureNotes`); English shown:

- **"Culture notes"**, pill **"5 found"**
- **"From the story: <title>"**
- **"Where this comes from"**; source line **"<title>, <publisher>"**
- **"Hear <romanization>"** (speaker label)
- Empty: **"Finish a story to find your first culture note."**, **"Go to Story Time"**
- Library card: **"Culture notes"**, **"5 found"**; episode line **"Culture notes: N found"**

Note titles, bodies, terms and sources come from the story data.

## 5. Reference

Text references only: a museum gift-shop postcard set; a field notebook with pressed leaves; the Card detail back face.

## 6. Claude Design prompt

```prompt
Design the Culture notes screen for Hangul Route, a Korean-learning app for learners of
every age. Output: three portrait phone frames (390 x 844).

Tokens by name: canvas surface.canvas, note cards surface.paper with the "card" shadow,
inset source list surface.sunken, text text.primary / text.secondary, theme accents
theme.letters, theme.life, theme.rites, theme.nature, theme.crafts (short bars beside
headings only), primary brand.primary. Buttons at least 64 tall.

Frame 1 (list): back arrow, title "Culture notes", pill "5 found"; heading "Holidays &
Traditions" with a theme.rites accent bar; a hypothetical note card (no bundled story has
culture notes yet, so this is placeholder content, not a real note): title "<Note title>",
a two-line placeholder body, a Korean term with romanization, gloss and a speaker icon, a
row "From the story: <story title>" with a chevron, a collapsed row "Where this comes from". Below, heading "Letters & Books"
and the top of another card.
Frame 2: the same card with "Where this comes from" expanded: two plain-text lines
("<title>, <publisher>"), no links.
Frame 3 (empty): one card "Finish a story to find your first culture note." and a large
button "Go to Story Time".

Anti-patterns: locked placeholders, "2 of 12", links or URLs, red, emoji, Korean without
romanization.
```

## 7. Acceptance checklist

- [ ] Only found notes appear; counts are "N found", never fractions
- [ ] Every term has Korean, romanization, gloss and a speaker
- [ ] Sources are plain text; no links on the learner surface
- [ ] Theme headings carry the meaning in words; colour only accents
- [ ] Empty state has one clear button to Story Time

## 8. Output path

- `design/screens/story/culture-notes__v1__YYYY-MM-DD.png`
- `design/screens/library/culture__v1__YYYY-MM-DD.png`
