# Stage and control bar: every running slide (screen spec v1)

Spec: F-TCH-004 sections 3.5 (controls, auto-hide), 3.6 (stage, units), 3.8 (status chips), 3.13 (accessibility) · wireframe C · PR 6 (chips: PR 9)
Mock: every `slide-*.html` page; `overlay-chips.html` (all chips) · shots `slide-letter-1280x720.png`, `-1920x1080`, `-4x3-1024x768`, `-21x9-2560x1080`, `slide-letter-bar-hidden-1280x720.png`, `bar-chips-1280x720.png`, `bar-chips-1024x768.png`
Code: `screens/presenter/Stage.tsx`, `ControlBar.tsx` (PR 6); `logic/lecture/stage-scale.ts`, `controls.ts`, `keymap.ts` (PR 4)

## Frame

- The window is a column: the **stage box** above (flex 1) and the **bar band** below (`--bar-h`, 120 px for one row of controls). Both on `surface.paper`; the band is `surface.sunken`.
- `stageScale` runs on the stage box (README D1): unit = `min(box width / 1280, box height / 600)`. The stage is 1280 x min(box, 960) units, centred; the rest letterboxes in paper. 1280 x 720 gives unit 1.0; 1920 x 1080 unit 1.5; 1024 x 768 unit 0.8 (taller logical stage); 2560 x 1080 unit 1.6 (letterboxed sides).
- Stage padding `spacing.xxxl` units; the counter "5 / 71" (`learner.presenter.bar.counter`, `presenter.size.caption`, `text.secondary`, tabular figures) sits in the top-right padding, `aria-hidden` (the live region says it).
- `touch-action: manipulation`; taps: right two thirds next, left third back (not on the bar or an overlay); swipe per section 3.5.

## Control bar

- `role="toolbar"`, named "Lesson controls". Left: the status chips. Right: nine buttons, each at least `touchTarget.hero` square (at most 1.5 x wide), `radii.lg`, `borderWidth.base` `border.strong` on paper, a text label at `typography.size.body` bold, a glyph above it where `Icon` has one:
  **Back** (`arrow-left`), **Reveal / Next** (primary: `brand.primaryDark` with `text.onPrimary`, `arrow-right`; Reveal while builds remain), **Sound** (`speaker`, or `speaker-off` when muted), **Timer**, **Helper**, **Blank**, **Slides**, **Full screen** (pressed state: `borderWidth.thick` `text.primary`), **Exit** (`close`).
- Spanish labels wrap to two lines inside the 96 px height ("Pantalla completa").
- **Status chips** (pill, `touchTarget.min`, `borderWidth.base` `border.strong` on paper, `text.primary`, 18 px): "No Korean voice here. You say it!" with `speaker-off`; "Sound is off." with **Turn sound on** (a bordered button inside the chip); "Offline. Everything still works."; "Update ready. It applies when you exit." While muted, "Sound is off." stands in for the no-voice chip, which comes back once sound is on (one sound chip at a time, spec section 3.7). Nothing about students ever appears here. Chips that do not fit beside the controls wrap to a row above them (the band grows; the stage letterboxes).
- **Auto-hide** after `presenter.autoHideMs` (3000 ms) without pointer, touch or key: the band's content fades to transparent (`motion.duration.base`; instant under reduced motion), the band stays. Any input returns it; a focused button keeps it; "Keep controls visible" (Help) turns hiding off.
- Focus ring: `borderWidth.thick` `border.focus` with a `borderWidth.base` offset (3.63:1 on sunken).

## Accessibility

- The stage is `role="main"` with a polite live region: "Slide 5 of 71, Letter, ㄱ, g/k" (`a11y.presenter.slide`; the taught item and the kind label are arguments).
- Focus order: the bar, then the stage. Every key of section 3.5 works without the bar.
