# Stage and control bar: every running slide (screen spec v1)

Spec: F-TCH-004 sections 3.5 (controls, auto-hide), 3.6 (stage, units), 3.8 (status chips), 3.13 (accessibility) · wireframe C · PR 6 (chips: PR 9)
Mock: every `slide-*.html` page; `overlay-chips.html` (all chips); phone: `stage-phone.html`, `stage-phone-notch.html` · shots `slide-letter-1280x720.png`, `-1920x1080`, `-4x3-1024x768`, `-21x9-2560x1080`, `slide-letter-bar-hidden-1280x720.png`, `bar-chips-1280x720.png`, `bar-chips-1024x768.png`; phone: `stage-phone-568x320.png`, `-640x360`, `-844x390`, `stage-phone-bar-hidden-568x320.png`, `-640x360`, `-640x360-gray`, `-844x390`, `stage-phone-notch-844x390.png`, `stage-phone-more-640x360.png`
Code: `screens/presenter/Stage.tsx`, `ControlBar.tsx` (PR 6); `logic/lecture/stage-scale.ts`, `controls.ts`, `keymap.ts` (PR 4)

## Frame

- The window is a column: the **stage box** above (flex 1) and the **bar band** below (`--bar-h`, 120 px for one row of controls). Both on `surface.paper`; the band is `surface.sunken`.
- `stageScale` runs on the stage box (README D1): unit = `min(box width / 1280, box height / 600)`. The stage is 1280 x min(box, 960) units, centred; the rest letterboxes in paper. 1280 x 720 gives unit 1.0; 1920 x 1080 unit 1.5; 1024 x 768 unit 0.8 (taller logical stage); 2560 x 1080 unit 1.6 (letterboxed sides).
- Stage padding `spacing.xxxl` units; the counter "5 / 71" (`learner.presenter.bar.counter`, `presenter.size.caption`, `text.secondary`, tabular figures) sits in the top-right padding, `aria-hidden` (the live region says it).
- `touch-action: manipulation`; taps: right two thirds next, left third back (not on the bar or an overlay); swipe per section 3.5.

## Control bar

- `role="toolbar"`, named "Lesson controls". Left: the status chips. Right: eight buttons (nine until LV-M1 removes **Helper**, 2026-10-16; every mock bar is redrawn without it), each at least `touchTarget.hero` square (at most 1.5 x wide), `radii.lg`, `borderWidth.base` `border.strong` on paper, a text label at `typography.size.body` bold, a glyph above it where `Icon` has one:
  **Previous** (`arrow-left`; `bar.prev.cta`, renamed from Back 2026-10-16, LV-M1), **Reveal / Next** (primary: `brand.primaryDark` with `text.onPrimary`, `arrow-right`; Reveal while builds remain), **Sound** (`speaker`, or `speaker-off` when muted), **Timer**, ~~**Helper**,~~ **Blank**, **Slides**, **Full screen** (pressed state: `borderWidth.thick` `text.primary`), **Exit** (`close`).
- Spanish labels wrap to two lines inside the 96 px height ("Pantalla completa").
- **Status chips** (pill, `touchTarget.min`, `borderWidth.base` `border.strong` on paper, `text.primary`, 18 px): "No Korean voice here. You say it!" with `speaker-off`; "Sound is off." with **Turn sound on** (a bordered button inside the chip); "Offline. Everything still works."; "Update ready. It applies when you exit." While muted, "Sound is off." stands in for the no-voice chip, which comes back once sound is on (one sound chip at a time, spec section 3.7). Nothing about students ever appears here. Chips that do not fit beside the controls wrap to a row above them (the band grows; the stage letterboxes).
- **Auto-hide** after `presenter.autoHideMs` (3000 ms) without pointer, touch or key: the band's content fades to transparent (`motion.duration.base`; instant under reduced motion), the band stays. Any input returns it; a focused button keeps it; "Keep controls visible" (Help) turns hiding off.
- Focus ring: `borderWidth.thick` `border.focus` with a `borderWidth.base` offset (3.63:1 on sunken).

## Accessibility

- The stage is `role="main"` with a polite live region: "Slide 5 of 71, Letter, ㄱ, g/k" (`a11y.presenter.slide`; the taught item and the kind label are arguments).
- Focus order: the bar, then the stage. Every key of section 3.5 works without the bar.

## Phone (owner report 2026-10-16; F-TCH-004 section 3.6 amendment; row LV-M1)

Wireframe `design/wireframes/classroom/lecture-phone.md` Panels A to D. Rules in `mock/presenter-or.css`.

- **When**: `isPhoneWindow` (the short side under `layout.phoneShortSide`, 600, and the long side at most `layout.phoneMaxLongSide`, 1000). Every other window keeps the frame above exactly.
- **Stage box**: the whole window minus the safe-area insets; **no band**. `--u` is measured on that box (the insets are padding of the size container), so `stageScale` sees what a slide really has. Shots: `stage-phone-844x390.png` (no insets: unit 0.65, 832 x 390 with 6 px bars) and `stage-phone-notch-844x390.png` (47 px left and right, 21 px below: a 750 x 369 box, unit 0.59).
- **Compact bar** (`.cbar`): floats over the stage bottom, centred, `spacing.sm` above the bottom inset; `surface.sunken`, `radii.lg`, `shadows.card`; one row of `touchTarget.min` controls with the glyph beside the label (so the row stays 64 px tall): **Previous** (`bar.prev.cta`; the docked bar's step back is renamed the same, so "Back" only ever means leaving), **Next / Reveal** (primary, at least 1.5 x `touchTarget.min` wide, `--next-min-phone`), **Sound**, **More**. Labels at `typography.size.body`; no control below 64 px.
- **Never over a new slide**: the slide is laid out for the whole box, so a showing bar covers its bottom 80 px. **Every step hides the bar at once** (a stage tap or swipe, a key, Previous / Next / Reveal on the bar), and a stage tap never shows it, so a new slide is always seen whole (`stage-phone-bar-hidden-*`, `#bar=hidden`). The bar shows at the start of the lesson (3 s), on a tap in **its strip** (the bottom 80 px, marked by the **grabber**: `.grabber`, `spacing.xxxl` x `spacing.xs`, `border.strong`, centred in the stage's bottom margin `--stage-pad`, where no slide draws, so it covers nothing) and while focus is inside it; otherwise it fades after `presenter.autoHideMs` (`stage-phone-640x360.png` is the shown state). A hidden bar takes no taps (`pointer-events: none`) and stays in the focus order.
- **More** (`stage-phone-more-640x360.png`): a sheet over the stage (paper, `borderWidth.base` `border.strong`, `radii.lg`), titled "Lesson controls" with **Close** focused, the status chips under the title, then Slides, Timer, Blank, Full screen (only where the browser has the Fullscreen API; never on iPhone), Keys and help, Exit, each `touchTarget.min`. Its width stops at `layout.maxWidth.reading`.
- **Gate**: `PHONE_STAGE_MIN` = 560 (`--phone-stage-min`): 568 x 320 (unit 0.44) draws the slide (`stage-phone-568x320.png`, `-bar-hidden-568x320`); a narrower phone window shows `states.md` "Too small".
- **Stage controls** (the speaker): at least `touchTarget.min` in a phone window instead of `touchTarget.hero`.
- **Measured** (Chromium, the pass script): 568 x 320, 640 x 360, 844 x 390 and the notch case: nothing overflows the content box with the bar hidden, the smallest text is 18 px (caption, romanization and the counter at the floor), every control is at least 64 px, no sideways scroll. Greyscale: `stage-phone-bar-hidden-640x360-gray.png`.

| Window | Box | Unit | Stage | Bar |
|---|---|---|---|---|
| 568 x 320 | 568 x 320 | 0.44 | 568 x 320 | 4 controls, 418 x 80 px |
| 640 x 360 | 640 x 360 | 0.50 | 640 x 360 | the same |
| 844 x 390 | 844 x 390 | 0.65 | 832 x 390 | the same |
| 844 x 390, notch insets | 750 x 369 | 0.59 | 750 x 369 | above the 21 px inset |
