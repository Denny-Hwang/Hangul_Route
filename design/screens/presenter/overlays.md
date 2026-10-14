# Overlays: timer, helper picker, blank, pause, grid, help, exit (screen spec v1)

Spec: F-TCH-004 sections 3.5 (overlays, timer, picker, blank, pause, grid, exit; amendment points 1 to 4), TD5, 3.10, 3.13 · wireframe I, J, L · PR 9 (Exit: PR 6)
Mock: `mock/overlay-*.html` · shots `overlay-*-1280x720.png`, `-1920x1080` for picker, full timer, grid, help; `-gray` for corner timer and picker

Every covering overlay sits over the stage box (the bar stays), on `surface.paper` like the stage (presenter.v1.md amendment 2), except the grid (`surface.sunken`) and the Exit confirm (a dialog over `surface.overlay`). Buttons in overlays are real pixels: `touchTarget.hero` tall, pill, `typography.size.bodyLg` bold. Text the room reads is in stage units. Each overlay is a modal dialog with focus inside; `Esc` and Close close it (section 3.5).

## Timer (a teacher tool, TD5)

- **Corner** (`overlay-timer-corner.html`): a paper card at the bottom right of the stage box, `shadows.card`, holding the ring (160 px, `brand.primary` filling clockwise from 12 o'clock over a `surface.sunken` track) with m:ss inside (`typography.size.display`) and **Pause / Go on**, **+30 s**, **Big**, **Close**. The slide under it still advances.
- **Full** (`overlay-timer-full.html`): the ring at 420 units with m:ss at `presenter.size.display`; beside it the presets **30 s · 1 min · 3 min · 5 min** (the chosen one with a `borderWidth.thick` outline), **+30 s**, **Pause**, **Reset**, **Small**, **Hide numbers**, **Close**. Navigation is swallowed while it is full.
- **Done** (`overlay-timer-done.html`): the ring complete, Hoya `cheering`, "All done!" at `presenter.size.title`, one slow fade pulse (`motion.duration.slow`, none under reduced motion) and the soft chime unless muted. Nothing else: no alarm text, no red.

## Helper picker (a teacher tool, TD5)

- "Who's helping next?" (`presenter.size.prompt`), the label box (480 x 140 units at least, `presenter.size.title`, a polite live region), **Draw** (primary), **Undo**, **Another**, **Close**, and the mode chips of the modes the presenter has (the received mode and numbers; `names` only when names arrived).
- Before the first draw: "Choose Draw." in the box; Undo and Another disabled (`overlay-picker-ready.html`, initials mode).
- Drawn: the label only, a first name, initials or a number (`overlay-picker.html` "Mina", a fixture; `overlay-picker-numbers.html` "7").
- Empty bag: "Everyone has had a turn", Hoya cheering, **Start again** (`overlay-picker-empty.html`).
- **Mode chips from the keyboard** (also the Help overlay's Romanization switch and language chips): a `radiogroup` with one tab stop. Focus enters on the selected chip; the arrow keys move the selection and select (wrapping); `Space` selects the focused chip. While focus is in the group the arrow keys belong to it (the key input's `onActivatable` covers `role="radio"`, PR 6 extends its list), and `P`, `Esc`, `H` and the clicker keys keep their section 3.5 meaning.
- Never shown: how many are left, who has gone, who was passed over, any count, list, history, score or ranking. Another gives no reason. The shuffle is `motion.duration.crawl`; instant under reduced motion.

## Blank and pause

- **Blank** (B or `.`): Hoya `waving` and "Eyes on me" at `presenter.size.title`.
- **Pause**: Hoya `idle` and 잠깐 `jamkkan` "wait a moment" as a `KoreanText` chip (`PAUSE_WORD`, gloss `learner.presenter.pause.gloss`).
- **How Pause opens.** Section 3.5 gives Pause no key and the bar no button, so it opens from the Blank overlay: a ghost **Pause** button (`learner.presenter.blank.pause.cta`, real pixels, `touchTarget.hero`) under "Eyes on me" dispatches `{ overlay: 'pause' }`, which replaces Blank in the one covering slot (`lecture.tool_used` `pause`). Pause has no button of its own; it closes like Blank. The Blank dialog takes focus on its container (`tabindex="-1"`), not on the button, so `Space` and `Enter` from a keyboard or clicker still clear the overlay instead of pressing Pause. The key map of section 3.5 is unchanged.
- Both leave the slide untouched; the first next / back only closes them.

## Grid (G)

- "All slides" (h2), Close, the hint line, then thumbnails (at least 13 rem): number, kind label, title text (a letter's romanization, a word's gloss; nothing for a quiz, which would give the answer away; no Korean, names or notes). The open slide has a `borderWidth.thick` `text.primary` outline and a "Now" pill; a hidden slide is dashed on sunken with a "Hidden" pill and **Show**; others have **Hide**; the End slide has none. A thumbnail is the jump button (it closes the grid); Hide / Show is a separate button. Hidden slides are memory only.

## Help (H or ?)

- "Keys and controls": each key of section 3.5 as key caps (Next: right arrow, down arrow, Space, PageDown, Enter; Back: left arrow, up arrow, PageUp, Backspace; the up and down caps are the arrow glyph rotated, no new icon) and what it does, two columns from 900 px; "A presentation clicker works with no setup."; the Romanization switch (always / hide until tapped; flips the deck's option live); the Presenter language chips (session only); **Keep controls visible**; Close. It scrolls inside the stage box when taller (1280 x 720).

## Exit (PR 6)

- An alert dialog over `surface.overlay`: "Leave the lesson?", "Nothing about anyone's progress changes.", **Keep going** (primary, focused) and **Exit**. Exit leaves fullscreen, releases the wake lock, unlocks the screen orientation, sends `lecture.complete`, applies a waiting update and goes home.
