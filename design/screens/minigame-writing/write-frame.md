# Minigame / Write Frame and My page (screen spec v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.7, §3.15 behaviours 4 and 10, §5 P-1, OD-6 · wireframe `design/wireframes/minigame/write-frame.md` · built in **G-5** (name round content and P-1 extension in S7-1)
Mock: `mock/write-frame.html` (page), `mock/write-frame-states.html` (board) · Shots: `shots/write-frame-*.png`
Code (planned): `apps/mobile/src/screens/minigames/WriteFrameGame.tsx`; `logic/write-frame/`; the allomorph helper and `composeTyped` (C-1); the keyboard and field of G-3; the canvas of G-4

## Parts

- **Frame card**: `surface.paper`, `border.subtle` hairline, `radii.lg`, `shadows.card`, padding `spacing.md` / `spacing.lg`. Korean line `size.prompt` bold with `word-break: keep-all`; romanization and gloss lines `size.bodySm` `text.secondary`, the blank written `___`.
- **Slot**: at least `touchTarget.min` wide, a `brand.secondaryDark` `borderWidth.thick` underline; empty: no text; picked and still to write: the word in `text.muted` (ghost); written: `brand.secondaryDark`; current (two slots): `brand.secondaryLight` fill. The particle after the slot is `brand.secondaryDark` text, never a control.
- **Word bank**: 2 columns on a phone, 3 regular, 4 wide; cards at least `touchTarget.child` tall, `radii.lg`, `border.subtle` `borderWidth.base`, WordArt at 64, Korean `size.prompt`, romanization and gloss `size.bodySm`. Picked: `brand.secondaryLight` with a `brand.secondaryDark` `borderWidth.thick` border. No card has a wrong look.
- **Change word**: a link (`brand.secondaryDark`, underlined), `touchTarget.min` tall; in the compact row between the count and Skip.
- **My page**: Hoya `cheering` 72, title `size.title`, a sheet (`surface.paper`, `radii.lg`, `shadows.card`) with each sentence (Korean `size.prompt`, romanization, gloss), the quiet line `size.bodySm` `text.secondary`, Continue (`Button` primary, full width). No other control.
- **Name round**: `SectionTabs`-style tabs (`touchTarget.min`, selected: `brand.primary` `borderWidth.thick`), the sound panel (`surface.paper`, scrolls inside the keyboard's height) with tiles at least `touchTarget.min` (`radii.lg`; final tiles `surface.sunken`), its own Del key, and the always-shown Hoya `idle` strip with "There is no wrong way to write your name."

## States (board)

F1 pick · F2 type after a pick · F3 near miss against the pick · F4 finished sentence · F5 trace after a pick · F6 two slots · F7 My page · F8 name round, Blocks · F9 name round, Keyboard. F8 and F9 are drawn taller (700, 760) to show the whole panel; at 320 x 568 the sound panel scrolls inside its height and the keyboard is the same as T2.

## Notes for G-5

- The name and every typed or picked word live in the renderer's React state only; Playwright and screenshots use 호야.
- My page is the step's closing panel (wireframe open question 1): G-5 records the spec wording change in its PR.
