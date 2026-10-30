# Overlays: timer, blank, pause, grid, help, exit (screen spec v1; the helper picker removed 2026-10-16)

Spec: F-TCH-004 sections 3.5 (overlays, timer, blank, pause, grid, exit; amendment points 1 to 4; the picker removed 2026-10-16), TD5, 3.10, 3.13 · wireframe I, J, L · PR 9 (Exit: PR 6)
Mock: `mock/overlay-*.html` · shots `overlay-*-1280x720.png`, `-1920x1080` for full timer, grid, help; `-gray` for corner timer

Every covering overlay sits over the stage box (the bar stays), on `surface.paper` like the stage (presenter.v1.md amendment 2), except the grid (`surface.sunken`) and the Exit confirm (a dialog over `surface.overlay`). Buttons in overlays are real pixels: `touchTarget.hero` tall, pill, `typography.size.bodyLg` bold. Text the room reads is in stage units. Each overlay is a modal dialog with focus inside; `Esc` and Close close it (section 3.5).

## Timer (a teacher tool, TD5)

- **Corner** (`overlay-timer-corner.html`): a paper card at the bottom right of the stage box, `shadows.card`, holding the ring (160 px, `brand.primary` filling clockwise from 12 o'clock over a `surface.sunken` track) with m:ss inside (`typography.size.display`) and **Pause / Go on**, **+30 s**, **Big**, **Close**. The slide under it still advances.
- **Full** (`overlay-timer-full.html`): the ring at 420 units with m:ss at `presenter.size.display`; beside it the presets **30 s · 1 min · 3 min · 5 min** (the chosen one with a `borderWidth.thick` outline), **+30 s**, **Pause**, **Reset**, **Small**, **Hide numbers**, **Close**. Navigation is swallowed while it is full.
- **Done** (`overlay-timer-done.html`): the ring complete, Hoya `cheering`, "All done!" at `presenter.size.title`, one slow fade pulse (`motion.duration.slow`, none under reduced motion) and the soft chime unless muted. Nothing else: no alarm text, no red.

## ~~Helper picker~~ (removed 2026-10-16)

The presenter no longer draws a helper picker (`docs/specs/AMENDMENTS-LECTURE-V2.md` section 18.5, row LV-M1; F-TCH-004 section 3.10 as amended; TD5 superseded for the picker only). Its mocks (`overlay-picker.html`, `-ready`, `-numbers`, `-empty`) and shots are deleted; the bar has no Helper button and `P` maps to nothing.

- **Chip groups from the keyboard** (the Help overlay's Romanization switch; the presets' length and stage chips): a `radiogroup` with one tab stop. Focus enters on the selected chip; the arrow keys move the selection and select (wrapping); `Space` selects the focused chip. While focus is in the group the arrow keys belong to it (the key input's `onActivatable` covers `role="radio"`), and `Esc`, `H` and the clicker keys keep their section 3.5 meaning.

## Blank and pause

- **Blank** (B or `.`): Hoya `waving` and "Eyes on me" at `presenter.size.title`.
- **Pause**: Hoya `idle` and 잠깐 `jamkkan` "wait a moment" as a `KoreanText` chip (`PAUSE_WORD`, gloss `learner.presenter.pause.gloss`).
- **How Pause opens.** Section 3.5 gives Pause no key and the bar no button, so it opens from the Blank overlay: a ghost **Pause** button (`learner.presenter.blank.pause.cta`, real pixels, `touchTarget.hero`) under "Eyes on me" dispatches `{ overlay: 'pause' }`, which replaces Blank in the one covering slot (`lecture.tool_used` `pause`). Pause has no button of its own; it closes like Blank. The Blank dialog takes focus on its container (`tabindex="-1"`), not on the button, so `Space` and `Enter` from a keyboard or clicker still clear the overlay instead of pressing Pause. The key map of section 3.5 is unchanged.
- Both leave the slide untouched; the first next / back only closes them.

## Grid (G)

- "All slides" (h2), Close, the hint line, then thumbnails (at least 13 rem): number, kind label, title text (a letter's romanization, a word's gloss; nothing for a quiz, which would give the answer away; no Korean, names or notes). The open slide has a `borderWidth.thick` `text.primary` outline and a "Now" pill; a hidden slide is dashed on sunken with a "Hidden" pill and **Show**; others have **Hide**; the End slide has none. A thumbnail is the jump button (it closes the grid); Hide / Show is a separate button. Hidden slides are memory only.

## Help (H or ?)

- "Keys and controls": each key of section 3.5 as key caps (Next: right arrow, down arrow, Space, PageDown, Enter; Previous (was Back until LV-M1, `help.row.back`): left arrow, up arrow, PageUp, Backspace; the up and down caps are the arrow glyph rotated, no new icon) and what it does, two columns from 900 px; "A presentation clicker works with no setup."; in a phone window only, one more line under the title, ~~"On a phone, tap the bottom of the slide to show the controls."~~ (`help.phoneBar`, LV-M1, body size, `text.secondary`; reworded in PN-2 and drawn in the overlay layout only, see "Touch and mouse" below); the Romanization switch (always / hide until tapped; flips the deck's option live; not drawn when Help is opened from the presenter home's **Keys and help**, where no lesson is open); ~~the Presenter language chips (session only)~~ (removed 2026-10-16: the language is the device's, changed from the **Display (Aa)** control on the home and the start screen); **Keep controls visible**; Close. The `P` row is gone with the picker. It scrolls inside the stage box when taller (1280 x 720).

### Touch and mouse (owner report 2026-10-29; `AMENDMENTS-PRESENTER-NAV.md` section 9.2; rows PN-2, PN-3, PN-5)

Mock: `mock/overlay-help-touch.html` (`#lang=es`, `#lang=ko`; a touch window of 568 x 320 draws the overlay layout's line) · shots `overlay-help-touch-1280x720.png`, `-es`, `-ko`; `-1920x1080`, `-es`, `-ko`; `-568x320`, `-es`, `-ko` · wireframe `classroom/lecture-nav.md` Panel F

- **Under the title, in the overlay layout only** (568 x 320 class phones, and every phone while the rail is switched off): `help.phoneBar`, reworded (body size, `text.secondary`). On a docked window and on the rail the line is not drawn: their Previous and Next are always on the screen.
- **A "Touch and mouse" group above the key rows, in every layout**: the heading `help.touch.title` (`typography.size.bodyLg`, bold) and five lines at the body size, in this order: `help.touch.swipe`, `help.touch.buttons`, `help.touch.click`, `help.touch.point` (O2, PN-5), `help.touch.keep` (it explains the Keep controls visible switch further down, for a screen where the buttons fade). Plain lines, not a list of controls: nothing in the group takes input.
- **The key rows gain `point`** right after Previous: key caps `1` `2` `3` `4` and `help.row.point` (O2, PN-5). The other rows, the clicker line, the Romanization switch, Keep controls visible and Close are unchanged.
- Spanish says "mouse" (F-I18N-001 section 3.10), tú; Korean is 해요체 with no particle after a variable. Korean lines break between words only (`KOREAN_LINE_BREAK`, `word-break: keep-all`); at 568 x 320 the longest lines wrap to two inside the dialog, which scrolls (`overlay-help-touch-568x320-ko.png`); nothing is cut.

| Key | en | es | ko |
|---|---|---|---|
| `help.phoneBar` (overlay layout only) | On this phone, swipe to move. Tap the slide to show the controls. | En este teléfono, desliza para avanzar o volver. Toca la diapositiva para ver los controles. | 이 휴대폰에서는 화면을 밀어서 넘겨요. 슬라이드를 누르면 조작 버튼이 보여요. |
| `help.touch.title` | Touch and mouse | Pantalla táctil y mouse | 터치와 마우스 |
| `help.touch.swipe` | Swipe left to go on, right to go back. | Desliza a la izquierda para avanzar y a la derecha para volver. | 왼쪽으로 밀면 다음으로, 오른쪽으로 밀면 이전으로 가요. |
| `help.touch.buttons` | Or tap Previous and Next. | O toca Anterior y Siguiente. | 이전, 다음 버튼을 눌러도 돼요. |
| `help.touch.click` | With a mouse, click the slide to go on (not on question slides). | Con el mouse, haz clic en la diapositiva para avanzar (no en las preguntas). | 마우스로 슬라이드를 클릭하면 다음으로 가요. 문제 슬라이드에서는 안 돼요. |
| `help.touch.point` | Tap an answer to point at it. It does not show the answer. | Toca una opción para señalarla. No muestra la respuesta. | 선택지를 누르면 표시만 돼요. 정답은 보여 주지 않아요. |
| `help.touch.keep` | Keep controls visible shows every button all the time. | Con «Dejar los controles a la vista» activado, todos los botones se ven siempre. | '조작 버튼 계속 보이기'를 켜면 모든 버튼이 계속 보여요. |
| `help.row.point` | Point at an answer | Señalar una opción | 선택지 표시하기 |

The values are the spec's section 13 exactly (copied into `mock/presenter-nav.js` from it); they land in the rows named there, each with its own Spanish and Korean review.

## Exit (PR 6)

- An alert dialog over `surface.overlay`: "Leave the lesson?", "Nothing about anyone's progress changes.", **Keep going** (primary, focused) and **Exit**. Exit leaves fullscreen, releases the wake lock, unlocks the screen orientation, sends `lecture.complete`, applies a waiting update and goes home.
