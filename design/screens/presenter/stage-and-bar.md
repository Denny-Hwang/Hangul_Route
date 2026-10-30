# Stage and control bar: every running slide (screen spec v1)

Spec: F-TCH-004 sections 3.5 (controls, auto-hide), 3.6 (stage, units), 3.8 (status chips), 3.13 (accessibility) · wireframe C · PR 6 (chips: PR 9) · navigation: `AMENDMENTS-PRESENTER-NAV.md` (owner report 2026-10-29), wireframe `classroom/lecture-nav.md`, rows PN-2 to PN-5, mocks in "Navigation (PN-0b)" below
Mock: every `slide-*.html` page; `overlay-chips.html` (all chips); phone: `stage-phone.html`, `stage-phone-notch.html`; navigation (PN-0b): `nav-quiz.html`, `nav-quiz-listen.html`, `nav-quiz-reply.html`, `nav-title.html`, `nav-rail-labels.html`, `overlay-help-touch.html` (shots `nav-*`, listed in "Navigation (PN-0b)") · shots `slide-letter-1280x720.png`, `-1920x1080`, `-4x3-1024x768`, `-21x9-2560x1080`, `slide-letter-bar-hidden-1280x720.png`, `bar-chips-1280x720.png`, `bar-chips-1024x768.png`; phone: `stage-phone-568x320.png`, `-640x360`, `-844x390`, `stage-phone-bar-hidden-568x320.png`, `-640x360`, `-640x360-gray`, `-844x390`, `stage-phone-notch-844x390.png`, `stage-phone-more-640x360.png`
Code: `screens/presenter/Stage.tsx`, `ControlBar.tsx` (PR 6); `logic/lecture/stage-scale.ts`, `controls.ts`, `keymap.ts` (PR 4)

## Frame

- The window is a column: the **stage box** above (flex 1) and the **bar band** below (`--bar-h`, 120 px for one row of controls). Both on `surface.paper`; the band is `surface.sunken`.
- `stageScale` runs on the stage box (README D1): unit = `min(box width / 1280, box height / 600)`. The stage is 1280 x min(box, 960) units, centred; the rest letterboxes in paper. 1280 x 720 gives unit 1.0; 1920 x 1080 unit 1.5; 1024 x 768 unit 0.8 (taller logical stage); 2560 x 1080 unit 1.6 (letterboxed sides).
- Stage padding `spacing.xxxl` units; the counter "5 / 71" (`learner.presenter.bar.counter`, `presenter.size.caption`, `text.secondary`, tabular figures) sits in the top-right padding, `aria-hidden` (the live region says it).
- `touch-action: manipulation`. ~~Taps: right two thirds next, left third back.~~ **No tap zones** (2026-10-29, `AMENDMENTS-PRESENTER-NAV.md` section 7): a touch tap on the stage never steps (on a docked window or the rail it rings Next for 1 s; in the overlay layout it shows or hides the bar); a tap or click on an answer option points at it (O2), on another content target it does nothing; a mouse click steps forward only on a slide with nothing to point at. Swipe left / right steps everywhere, over options too (section 6 there). See "Navigation (PN-0b)".

## Control bar

- **Order since 2026-10-29 (O6; "Navigation (PN-0b)")**: **Previous** first, the status chips, Exit, Full screen, Slides, Blank, Timer, Sound, **Next / Reveal** last; on a touch window 1600 px wide or more Previous sits just before Next (O9). The order below is the PR 6 order it replaces.
- `role="toolbar"`, named "Lesson controls". Left: the status chips. Right: eight buttons (nine until LV-M1 removes **Helper**, 2026-10-16; every mock bar is redrawn without it), each at least `touchTarget.hero` square (at most 1.5 x wide), `radii.lg`, `borderWidth.base` `border.strong` on paper, a text label at `typography.size.body` bold, a glyph above it where `Icon` has one:
  **Previous** (`arrow-left`; `bar.prev.cta`, renamed from Back 2026-10-16, LV-M1), **Reveal / Next** (primary: `brand.primaryDark` with `text.onPrimary`, `arrow-right`; Reveal while builds remain), **Sound** (`speaker`, or `speaker-off` when muted), **Timer**, ~~**Helper**,~~ **Blank**, **Slides**, **Full screen** (pressed state: `borderWidth.thick` `text.primary`), **Exit** (`close`).
- Spanish labels wrap to two lines inside the 96 px height ("Pantalla completa").
- **Status chips** (pill, `touchTarget.min`, `borderWidth.base` `border.strong` on paper, `text.primary`, 18 px): "No Korean voice here. You say it!" with `speaker-off`; "Sound is off." with **Turn sound on** (a bordered button inside the chip); "Offline. Everything still works."; "Update ready. It applies when you exit." While muted, "Sound is off." stands in for the no-voice chip, which comes back once sound is on (one sound chip at a time, spec section 3.7). Nothing about students ever appears here. Chips that do not fit beside the controls wrap to a row above them (the band grows; the stage letterboxes).
- **Auto-hide** (on touch, since 2026-10-29: Previous and Next never fade and take taps at once; only the chips and the tools below fade; a mouse-only window is unchanged) after `presenter.autoHideMs` (3000 ms) without pointer, touch or key: the band's content fades to transparent (`motion.duration.base`; instant under reduced motion), the band stays. Any input returns it; a focused button keeps it; "Keep controls visible" (Help) turns hiding off.
- Focus ring: `borderWidth.thick` `border.focus` with a `borderWidth.base` offset (3.63:1 on sunken).

## Sound flash (amendment 2026-10-17; F-TCH-004 section 3.7)

- **Sound** (or **S**, or a stage speaker) always answers. Muted: the press turns sound on (the chip's **Turn sound on**) and plays, and the bar's glyph goes back to `speaker`. A lesson set up with sound off (`options.sound: false`): "Sound is off for this lesson." (`bar.deckSoundOff`), whatever the slide. A slide with nothing to play (a title, a story check whose Korean is the answer): "This slide has no sound." A play that did not happen: "No Korean voice here. You say it!" when the device has no Korean voice, "The sound did not play. You say it!" when the browser blocked it or the voice failed.
- Drawn like the phone's no-voice flash: one pill at the top of the stage, centred (`spacing.md` from the top, at most 90 % wide), `surface.paper`, `radii.pill`, `borderWidth.base` `border.strong`, `spacing.xs` x `spacing.lg` padding, `typography.size.body` `text.primary` (chrome, so it follows the chosen text size), `pointer-events: none`, gone after `presenter.autoHideMs`. The same pill on the phone bar and on the docked bar; it covers the top of the slide only while it shows and never moves the stage.
- **A flash belongs to its slide**: a step to another slide, Exit, Start and the way back to the start screen take it away at once, and the presenter (not the pill) keeps its time, so turning a phone upright and back, or a layout switch, never shows an old one again. A play result that comes back after the slide changed flashes nothing.
- **Screen readers**: the pill is drawn only (`aria-hidden`); its words are said by one polite live region (`presenter-sound-live`, visually hidden) that is mounted with the stage and only changes its text, since a status region that arrives already filled is often not read.
- A forward `sound` build never flashes on the docked bar (its chip already shows); on a phone it flashes the no-voice words only on a slide that has a sound.

## Accessibility

- The stage is `role="main"` with a polite live region: "Slide 5 of 71, Letter, ㄱ, g/k" (`a11y.presenter.slide`; the taught item and the kind label are arguments).
- Focus order: the bar, then the stage. Every key of section 3.5 works without the bar.

## Phone (owner report 2026-10-16; F-TCH-004 section 3.6 amendment; row LV-M1)

Wireframe `design/wireframes/classroom/lecture-phone.md` Panels A to D. Rules in `mock/presenter-or.css`.

- **When**: `isPhoneWindow` (the short side under `layout.phoneShortSide`, 600, and the long side at most `layout.phoneMaxLongSide`, 1000). Every other window keeps the frame above exactly.
- **Stage box**: the whole window minus the safe-area insets; **no band**. `--u` is measured on that box (the insets are padding of the size container), so `stageScale` sees what a slide really has. Shots: `stage-phone-844x390.png` (no insets: unit 0.65, 832 x 390 with 6 px bars) and `stage-phone-notch-844x390.png` (47 px left and right, 21 px below: a 750 x 369 box, unit 0.59).
- **Compact bar** (`.cbar`): floats over the stage bottom, centred, `spacing.sm` above the bottom inset; `surface.sunken`, `radii.lg`, `shadows.card`; one row of `touchTarget.min` controls with the glyph beside the label (so the row stays 64 px tall): **Previous** (`bar.prev.cta`; the docked bar's step back is renamed the same, so "Back" only ever means leaving), **Next / Reveal** (primary, at least 1.5 x `touchTarget.min` wide, `--next-min-phone`), **Sound**, **More**. Labels at `typography.size.body`; no control below 64 px.
- **Since PN-0b this floating bar is the overlay layout only** (568 x 320 class phones, and every phone while `EXPO_PUBLIC_PRESENTER_RAIL` is off); a phone with room shows the rail ("Navigation (PN-0b)"). The shots below were taken again without the grabber.
- **Never over a new slide**: the slide is laid out for the whole box, so a showing bar covers its bottom 80 px. **Every step hides the bar at once** (a swipe, a key, Previous / Next / Reveal on the bar), so a new slide is always seen whole (`stage-phone-bar-hidden-*`, `#bar=hidden`). The bar shows at the start of the lesson (3 s), on a **tap on empty stage area** (not an answer option, not the speaker; ~~a tap in its strip, marked by the grabber~~: the strip lay over the bottom answer row and is removed with the grabber, `AMENDMENTS-PRESENTER-NAV.md` section 5.3) and while focus is inside it; otherwise it fades after `presenter.autoHideMs` (`stage-phone-640x360.png` is the shown state). A hidden bar takes no taps (`pointer-events: none`) and stays in the focus order.
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

## Navigation (PN-0b; `docs/specs/AMENDMENTS-PRESENTER-NAV.md`, owner choices decided 2026-10-29)

Wireframe `design/wireframes/classroom/lecture-nav.md` Panels A to G. Rules in `mock/presenter-nav.css`; the helper `mock/presenter-nav.js` picks the layout the way `navLayout` and the rail gate do (spec sections 4 and 5.2) from the window, the pointer and the safe-area insets, so one page draws every layout. Pages: `nav-quiz.html` (the 2 x 2 Match Sound question of `slide-quiz.html`), `nav-quiz-listen.html` (picture grid), `nav-quiz-reply.html` (rows), `nav-title.html` (the first slide, for the start hint), `overlay-help-touch.html` (Help), `nav-rail-labels.html` (the label board). Hash options: `#input=touch|mouse`, `#notch=47|59`, `#rail=off`, `#lang=es|ko`, `#point=n`, `#hint=1`, `#nudge=1`, `#more=1`, `#chip=1`, `#bar=hidden` (the 3 s fade), `#dims=1`, `#projector=1`, `#gray=1`, `#textscale=1.25` (a larger browser text size, for the rail label fallback). Chrome strings are dictionary values or the section 13 keys, copied verbatim from the spec into the helper's dictionary; content in es and ko is the shipped overlays (`content/i18n/*/episodes.json` for the title slide).

### Constants (named once in `mock/presenter-nav.css`)

| Name | Value | Derived from |
|---|---|---|
| `PHONE_RAIL` (`--rail`) | `touchTarget.hero + spacing.sm` = 104 px | section 5.2: the 12 px inert gap (its `border.strong` rule included), an 88 px button, `spacing.xs` on the window side |
| `PHONE_RAIL_COMPACT` (`--rail-compact`) | `touchTarget.min + spacing.md + spacing.xs` = 80 px | the same gap, a 64 px square button, 4 px |
| `PHONE_RAIL_GAP` (`--rail-gap`) | `spacing.md` = 12 px | the rail's stage side, which no button's hit area reaches |
| rail button (`--rail-btn`) | `PHONE_RAIL - PHONE_RAIL_GAP - spacing.xs` = 88 px; Next / Reveal `1.5 x touchTarget.min` = 96 px tall (`--rail-next-h`) | section 5.2 |
| `NAV_CLEARANCE` (`--nav-clearance`) | `spacing.xxl` = 32 window px | section 5.0 |
| wrapped band row gap (`--bar-row-gap`) | `2 x spacing.md` = 24 px | each wrapped row adds one `BAR_BAND` (96 + 2 x 12): a two-row band is 240 px |
| pin (`--pin`) | `max(spacing.xl, presenter.size.body units)`: 40 units, never under 24 px | section 7.3 asks for `presenter.size.caption` (28 units) or larger |
| `WIDE_TOUCH_MIN` (`--wide-touch-min`) | 1600 px | owner choice O9: a touch window this wide (a whiteboard) puts Previous beside Next |
| `--mock-inset-side-lg`, `--mock-projector` | 59 px; `contrast(0.55) brightness(1.2) saturate(0.7)` | mock only: the 932 x 430 notch, and a washed-out projector in a lit room |

### Every layout, measured (Chromium 1x, the macOS system font; `#dims=1` draws each content target box and control hit box and dimensions the closest pair)

How the shots were taken: Playwright Chromium at 1x opens each page with the hash in its file name (`#input=touch` in a context with `hasTouch` and `isMobile`, `#input=mouse` in a plain one), waits for `window.__nav.ready`, reads `window.__nav` (layout, stage, unit, controls, clearance, hint, wrap and fallbacks) and saves a 128-colour palette PNG. Every number below can be read again from `window.__nav` on the same page and window size.

| Window and input | Layout (section 4) | Stage box | Unit | Bar or rail | Inert space, target to control | Shots |
|---|---|---|---|---|---|---|
| 1180 x 820, touch | docked, one row | 1180 x 700 | 0.92 | band 120 | **56.3 px** (stage padding 44.3 + band padding 12) | `nav-docked-1180x820-touch.png`, `-touch-idle` (Previous and Next stay), `-dims`, `-nudge` (the Next ring), `-chip` (offline chip between Previous and the tools), `-touch-es`, `-touch-ko` |
| 1180 x 820, mouse only (a small laptop window) | docked, one row | 1180 x 700 | 0.92 | band 120 | 56.3 px shown; nothing shows after 3 s | `nav-docked-1180x820-mouse.png`, `-mouse-idle` (the whole bar faded, the band stays). A touchscreen tablet with a trackpad matches `any-pointer: coarse` from the start, so it stays in the touch state (section 4) and never reaches this picture |
| 1180 x 820, touch, **es** | docked, **wrapped** | 1180 x 580 | 0.92 | band 240 | 56.3 px | `nav-docked-1180x820-touch-es.png`: the Spanish tool labels do not fit one row, so the tools take a row above and the stage keeps its unit (width-bound) |
| 1024 x 768, touch | docked, wrapped | 1024 x 528 | 0.80 | band 240 | **50.4 px** (38.4 + 12) | `nav-docked-1024x768-touch.png`, `-touch-idle`, `-dims` |
| 820 x 1180 upright, touch | docked, wrapped | 820 x 940 (stage 820 x 615, letterboxed) | 0.64 | band 240 | 205.3 px | `nav-docked-820x1180-touch.png`, `-dims` |
| 768 x 1024 upright, touch | docked, wrapped (en, ko: the tools row is 635 and 622 of 720 px) | 768 x 784 (stage 768 x 576) | 0.60 | band 240 | 144.8 px | `nav-docked-768x1024-touch.png` |
| 768 x 1024 upright, touch, **es** | docked, wrapped, **More fallback** (the tools need 744 of 720 px) | 768 x 784 (stage 768 x 576) | 0.60 | band 240 | 144.8 px | `nav-docked-768x1024-touch-es.png`, `-dims-es`, `-more-es` (More open: Diapositivas, Temporizador, En blanco) |
| 744 x 1133 upright (iPad mini), touch, **es** | docked, wrapped, **More fallback** (744 of 696 px) | 744 x 893 (stage 744 x 558) | 0.58 | band 240 | 207.4 px | `nav-docked-744x1133-touch-es.png`, `-dims-es` |
| 1920 x 1080, touch (a whiteboard) | docked, one row, **O9** | 1920 x 960 | 1.50 | band 120 | **84 px** (72 + 12) | `nav-docked-1920x1080-touch.png`, `-touch-idle`, `-dims` |
| 1920 x 1080, mouse (a laptop at a projector) | docked, one row, O6 | 1920 x 960 | 1.50 | band 120 | 84 px shown; nothing after 3 s | `nav-docked-1920x1080-mouse.png`, `-mouse-idle` |
| 667 x 375, touch | rail | 563 x 375 | 0.44 | rail 104 | **33.1 px** (21.1 + 12): the smallest full rail | `nav-rail-667x375.png`, `-dims` |
| 844 x 390, touch | rail | 740 x 390 | 0.58 | rail 104 | **39.8 px** | `nav-rail-844x390.png`, `-idle` (nothing hides), `-dims`, `-es`, `-ko`, `-more` (the sheet beside the rail, covering the stage) |
| 844 x 390, touch, insets 47 / 47 / 21 | rail | 646 x 369 | 0.50 | rail 104, inside the right inset | **36.2 px** | `nav-rail-844x390-notch.png`, `-notch-dims` |
| 932 x 430, touch, insets 59 / 59 / 21 | rail | 710 x 409 | 0.55 | rail 104 | **38.6 px** | `nav-rail-932x430-notch.png`, `-notch-dims` |
| 844 x 390, touch, browser text at 125 % (`#textscale=1.25`) | rail, **label fallback**: compact rail ("Previous" 93 of 84 px), More as three dots ("More" 55 of 52 px) | 764 x 390 | 0.60 | rail 80 | 40.6 px | `nav-rail-844x390-textscale.png`, `-textscale-es` (Más still fits, so it keeps its text), `-textscale-dims` |
| 640 x 360, touch | **compact rail** | 560 x 360 | 0.44 | rail 80 | **33.0 px** (21 + 12) | `nav-rail-compact-640x360.png`, `-idle`, `-dims`, `-es`, `-ko` |
| 568 x 320, touch | overlay | 568 x 320 | 0.44 | floating bar | **0 px while shown**: the bar covers options 3 and 4 (the known risk, spec section 18, drawn in `feedback.nudge`); hidden after every step, so nothing to measure | `nav-overlay-568x320.png` (start of the lesson), `-idle`, `-dims`, `-hidden-dims` |
| 844 x 390, touch, **`EXPO_PUBLIC_PRESENTER_RAIL` off** | overlay | 832 x 390 | 0.65 | floating bar, no strip, no grabber | 0 px while shown, as 568 x 320 | `nav-railoff-844x390.png`, `-idle` |
| 568 x 320, 640 x 360, 844 x 390, mouse only | not a phone window (`isPhoneWindow` needs a coarse pointer): docked, and the stage under the band is narrower than 600 px | — | — | — | — | `nav-mouse-568x320.png`, `-640x360`, `-844x390`: the too-small page of `states.md`, unchanged; section 4's mouse row applies to docked windows only |

Every frame: the smallest chrome text is 18 px, every control is at least 64 px (docked 96 x 96, Next 144 x 96; full rail 88 x 64, Next 88 x 96; compact rail 64 x 64; the overlay bar 64 tall), no sideways scroll, no console error. The clearance holds on every docked and rail frame; the overlay cannot hold it while its bar shows (spec sections 5.0 and 18).

### Docked bar (section 5.1; O6, O9)

- **Order** (O6): `[ Previous ]` at the start of the band, the status chips (flex, `--status-min` basis), Exit, Full screen, Slides, Blank, Timer, Sound, `[[ Next / Reveal ]]` at the end. On one row the DOM order is the visual and focus order; Exit is never beside Next (Sound sits between). A wrapped band keeps the DOM and focus order Previous, the chips, the tools, (More,) Next on purpose, although the tools row is drawn above: the step pair stays first and last for focus, so PN-3 must not reorder it to match the rows.
- **Pinned pair on touch** (`-touch-idle` shots): after `presenter.autoHideMs` the chips and tools fade and the band stays; Previous and Next keep full opacity and take taps at once (no `BAR_SHOW_GRACE_MS`). On a mouse-only window the whole bar fades as before (`-mouse-idle`).
- **The Next ring** (`nav-docked-1180x820-nudge.png`): a touch tap on empty stage area draws a `border.focus` ring, `borderWidth.thick` wide with a `borderWidth.base` offset (the focus ring's geometry), around Next for `NUDGE_MS` (1 s), at once and gone at once. It steps nothing and is not announced. Kept as the spec draws it (section 7.2) after the PN-0b review asked whether it reads as a focus jump: only a touch tap on the stage draws it, a pointer interaction after which the browser shows no `:focus-visible` ring on a button, so two focus-looking rings at once need a keyboard user who also taps the stage; it lasts 1 s and moves no focus.
- **The wrap rule** is measured, not a breakpoint: the band is laid out in one row; when it cannot hold Previous, the chips' basis, the six tools and Next, the tools take a row above (right-aligned) and Previous and Next stay on the bottom row at its two ends (together at its end under O9). 1024 x 768, upright 820 x 1180 and upright 768 x 1024 wrap in every language; **1180 x 820 wraps in Spanish** ("Temporizador", "Diapositivas", "Pantalla completa" widen their buttons), which the rule covers with no other change. A tool never shrinks and never breaks onto a third row.
- **The More fallback** (section 5.1; `nav-docked-768x1024-touch-es.png`, `nav-docked-744x1133-touch-es.png`): when the tools do not fit their row either (Spanish on an upright iPad: 744 px of tools in 720 px at 768 x 1024, in 696 px at 744 x 1133; en and ko fit, 635 and 622 px), Timer, Blank and Slides move into a **More** button (`bar.more.cta`, the docked button size, text only) on the bottom row just before Next (just before Previous under O9). The tools row keeps Exit, Full screen and Sound. More opens the phone's `MoreSheet` holding the three tools it took (`-more-es`); the band stays two rows (240 px) and the clearance is unchanged (144.8 and 207.4 px). Focus order: Previous, the chips, Exit, Full screen, Sound, More, Next.
- **O9, a teacher at the side of a whiteboard** (`nav-docked-1920x1080-touch.png`): Previous (x 1640 to 1736) and Next (x 1752 to 1896) are the last two buttons of the band, within 280 px of the right edge. On a 75 to 86 inch 16:9 board (1.66 to 1.90 m wide, 0.87 to 0.99 mm per px) that is the last 24 to 28 cm of the board, in its bottom 10 to 12 cm (the band): a teacher standing at the board's right side reaches both without stepping in front of the slide, and the tools are further in. A teacher standing at the left side walks across, as before (the left-handed or left-side choice is spec section 18, O3 (c), not built).

### Phone rail (section 5.2; O1 a, O3 a, O10 a)

- A column at the right of the stage box, inside the right safe-area inset, full height between the top and bottom insets, on `surface.sunken` with a `borderWidth.base` `border.strong` rule on its stage side; the 12 px inert gap includes the rule. Top to bottom: `[ More ]`, the pair `[[ Next / Reveal ]]` and `[ Previous ]` centred in the rail's height, `[ Sound ]`. It never hides (`nav-rail-844x390-idle.png` is the same picture as the shown state). `role="toolbar"`, `aria-orientation="vertical"`, named `bar.label`.
- **Full rail buttons have no side padding** (this pass): the 2 px border is the edge, so a label has 84 px; vertical padding `spacing.xs`. With `spacing.xs` side padding (76 px of room) "Siguiente" and, in Noto Sans, "Previous" do not fit (table below).
- **Compact rail** (640 x 360): Next (`arrow-right` on the primary fill), Previous (`arrow-left`) and Sound (`speaker`) are icon only, 64 x 64, the icon at `spacing.xxl`, the label as the accessible name; More keeps its text label with `spacing.xs` padding (52 px of room).
- **More open** (`nav-rail-844x390-more.png`): the sheet sits over the stage box, beside the rail; the stage left visible above it takes no swipe and no point, and a tap there closes More (section 5.2).

**Rail labels** (`nav-rail-labels.png`, `mock/nav-rail-labels.html`; `typography.size.body` 18 px, `weight.bold`; a word never breaks). Longest word against the room:

| Key | en | es | ko | Room |
|---|---|---|---|---|
| `bar.more.cta` (full rail) | More 44.0 | Más 35.7 | 더 보기 (보기) 31.1 | 84 |
| `bar.reveal.cta` | Reveal 56.7 | Mostrar 67.8 | 다음 보기 (보기) 31.1 | 84 |
| `common.buttons.next` | Next 40.2 | **Siguiente 81.4** | 다음 31.1 | 84 |
| `bar.prev.cta` | Previous 74.7 | Anterior 70.8 | 이전 31.1 | 84 |
| `bar.sound.cta` | Sound 55.2 | Sonido 59.8 | 소리 31.1 | 84 |
| `bar.more.cta` (compact rail, 64 x 64) | More 44.0 | Más 35.7 | 더 보기: 50.6 on one line, two lines in a wider Korean font | 52 |

Every label fits on one line in the system fonts (Korean "다음 보기" and "더 보기" may take two lines, a whole word each), **with almost no margin**: "Siguiente" is 81.4 px in the iOS system font, 76.6 in Roboto (Android), 81.0 in Arial, 74.7 in Apple SD Gothic Neo and 84.8 in Noto Sans (a fallback on some Android builds, 0.8 px over the room); "Previous" is 76.9 in Noto Sans. A larger browser text size (Chrome Android's text scaling) or a wider OEM font widens every word. More fits 64 px in en, es and ko at 18 px.

**The label fallback** (PN-4; `nav-rail-844x390-textscale.png`): the rail measures each label's widest word on the real text; when any full-rail word is wider than its 84 px, the rail draws as the compact rail (80 px; Next, Previous and Sound icon only with the label as the accessible name), and when More's word is wider than the compact rail's 52 px, More shows a `more` (three dots) icon with its label as the accessible name. So no label ever overflows or breaks inside a word, whatever the font or text size. At 125 % text in English both apply ("Previous" 93 px, "More" 55 px); in Spanish the rail goes compact and "Más" keeps its text. **PN-4 adds the `more` glyph** to `packages/design-system` `Icon` (its own test and mock line) for this case only. PN-4 holds it with a Playwright e2e that measures the real text in Chromium and WebKit (en, es, ko at 18 px, and one case at a larger text size that takes the fallback); a jsdom render test cannot measure text.

### Overlay fallback (section 5.3) and the kill switch

- 568 x 320 (`nav-overlay-568x320.png`): the floating bar of `presenter-or.css` without the strip and the grabber (both removed from the CSS and from `stage-phone*.html`); at the lesson start the bar shows for 3 s, a tap on empty stage area shows or hides it, every step hides it (`-idle`). While it shows it covers the bottom option row (`-dims`, 0 px): the remaining risk of spec section 18, now always a bar the teacher made visible.
- `EXPO_PUBLIC_PRESENTER_RAIL` off (`nav-railoff-844x390.png`): every phone window draws this layout; 844 x 390 keeps its whole-window stage (832 x 390, unit 0.65).
- The LV-M1 phone shots (`stage-phone-*.png`) are taken again without the grabber; they now show the overlay layout.

### Start hint (section 9.3; O7 a)

The sound flash's pill (`spacing.md` from the stage top, centred, at most 90 % wide, 18 px, `pointer-events: none`) on the first slide of a lesson, `nav.hint` on docked windows and the rail, `nav.hintOverlay` in the overlay layout.

| Window | en | es | ko | Shots |
|---|---|---|---|---|
| 568 x 320 (overlay; stage padding 21.3 px) | 437 x 33 px, one line, ends 44.7 px from the stage top; covers nothing | 511 x 53 px, **two lines**; covers the slide counter (aria-hidden) and touches 2 px of the deck caption's line box | 467 x 33 px, one line; covers 10 px of the counter | `nav-hint-568x320.png`, `-es`, `-ko` |
| 844 x 390 (rail) | 296 x 33, one line, covers nothing | 315 x 33 | 318 x 33 | `nav-hint-844x390.png`, `-es`, `-ko` |
| 1180 x 820 (docked) | 296 x 33, covers nothing | — | — | `nav-hint-1180x820.png` |

**Accepted as written** (this pass): the hint shows only on a lesson's first slide (the title, whose content is centred below it), for 6 s, takes no taps, and covers no target and no taught Korean; what it covers at 568 x 320 is the counter, which the live region already says, and in Spanish 2 px of the deck caption's line box (not its letters). PN-3's `length-budget.test.ts` holds `nav.hintOverlay` to at most two lines at 568 x 320 in every locale; the acceptance rests on the first slide being the title, so PN-3 also tests that every built deck starts with its title slide, and its e2e checks at 568 x 320 that the pill's box meets no content target and no prompt.

### Decisions this pass takes

- **N1. The pin sits at the marker's top right**, on a paper disc over the marker's own corner, at `max(spacing.xl, 40 units)`; it never covers the Korean or the picture and never moves anything. Details and shots: `slide-quiz.md` "Pointed option".
- **N2. The pointed outline never drops under `STAGE_BORDER_MIN`** (`borderWidth.base`, as the sound table's cells), so it stays visible at a phone's unit (0.44 to 0.58 gives 1.3 to 1.7 px otherwise).
- **N3. Full rail buttons have no side padding** (above).
- **N4. The band wraps by measurement**, not by a width breakpoint (Spanish wraps at 1180 px), and the More fallback is measured the same way (Spanish at 768 x 1024 and 744 x 1133); a tool never shrinks or takes a third row.
- **N5. More keeps its text label on the compact rail** while it fits; the `more` icon is drawn only by the label fallback (N8).
- **N8. The rail label fallback** (above): a word wider than its room turns the full rail compact and More into three dots; PN-4 measures it in a real browser.
- **N9. On rows the pointed outline sits in the middle of the row gap** (`slide-listen-reply.md` "Pointed option"); the grid keeps `spacing.sm` units.
- **N6. The start hint is accepted at 568 x 320** in en, es and ko (above).
- **N7. A mouse-only window of a phone's size stays the too-small page**; nothing in this amendment changes it.

### Observations for other rows (not changed here)

- At 1280 x 720 the merged quiz mock's grid ends 12.8 px inside the stage's bottom padding with this machine's font (the prompt wraps to two lines). It predates this pass (`slide-quiz.html` measures the same) and the as-built fit levels own it; the clearance there is still 47.2 px.
- On the reply rows the pointed outline is centred in the row gap (N9); PN-5 keeps the row gap at `spacing.md` units.
