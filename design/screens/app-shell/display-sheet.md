# Display sheet: language and text size for everyone on this device (design mock, DN-0)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` sections 3.6 (the control and the sheet), 4 (text size), 10 (strings) · wireframe `design/wireframes/shell/display-sheet.md` (Panels A to D) · rows **DN-3** (learner app), **DN-5** (console), **DN-7** (All lessons), **LV-3** (presenter home and start screen)
Mock: `mock/display-sheet.html` (the sheet over a learner screen), `mock/display-sheet-confirm.html` (the confirm step in the language chosen), `mock/display-sheet-largest.html` (Largest applied to the page behind) · rules `mock/display-nav.css` (loaded after `app-shell.css`)
Shots: `display-sheet-320.png`, `display-sheet-768.png`, `display-sheet-confirm-320.png`, `display-sheet-largest-320.png`, `display-sheet-320-text200.png`

One sheet, drawn the same on every surface of `app.hangulroute.com`: the learner app and All lessons draw it with the design-system `DisplaySheet` (DN-2), the console with its DOM twin (DN-5), the presenter with the learner bundle's (LV-3). The control that opens it is the **Display (Aa)** button at the top right of every header (`ScreenHeader`, the tab roots, All lessons, the presenter home and start screen, the console's AdultFrame).

## Anatomy

1. **Control** (`.aa-btn`): "Aa" (`common.display.button`; ko "가가"), accessible name "Display: language and text size" (`common.display.a11y`); pill, `borderWidth.base` `border.strong` on paper, `touchTarget.min` square at least, `size.bodyLg` bold. It is the last control of a header row.
2. **Sheet** below `layout.breakpoint.regular` (600): a bottom sheet on `surface.paper` with `radii.lg` top corners over `surface.overlay`, at most 92 % of the window tall, scrolling inside. From 600: a centred dialog at most `layout.maxWidth.reading` wide, the two groups side by side (`display-sheet-768.png`).
3. **Display** (h2, `common.display.title`; the heading size follows the text-size half rule).
4. **Language** (`common.display.language`, a fieldset; drawn only when two or more locales are offered): one radio row per offered locale by endonym (`LOCALE_META`), each `lang`-tagged, `touchTarget.min` tall, the chosen one with a `borderWidth.thick` `text.primary` outline (shape, not colour alone).
5. **Text size** (`common.display.textSize`): Standard, Large, Larger, Largest (`common.display.size.*`), **each label drawn at its own size** (body x 1, 1.15, 1.3, 1.5, whatever the page's current size), then the preview line "This is how text looks." (`common.display.preview`) on `surface.sunken` at the chosen size.
6. The note "For everyone on this device. Change it any time." (`common.display.note`, `text.secondary`) and **Done** (`common.buttons.done`, primary).

## Behaviour

- **Language**: choosing another locale replaces the sheet's content with the confirm step **written in that language** (`display-sheet-confirm-320.png`): "¿Usar Español en este dispositivo?" (`common.display.confirm.question`), **Usar Español** (primary, `.confirm.use`) and **Volver a English** (`.confirm.back`, `lang="en"`). Use writes the device record and every open tab follows (`hr-prefs`); the sheet re-renders in the new language. Back returns to the sheet unchanged.
- **Text size**: applies at once to the page behind (no confirm; `display-sheet-largest-320.png` shows the Profile page at Largest behind the sheet, the rows still at their own sizes).
- **Closing**: Done, `Esc`, the backdrop or the back (the history bridge pushes one entry while it is open). Focus returns to the Aa control.
- Not behind the grown-up gate; no telemetry; works offline.

## Constants

| Name | Value | Derived from |
|---|---|---|
| `TEXT_SIZE_FACTOR` | 1, 1.15, 1.3, 1.5 | AMENDMENTS-DISPLAY-NAV section 4 (content-schema constant) |
| `--hr-text-scale` | the factor | the console's html font-size variable (section 4); the learner mocks use it the same way to stand in for `useType()` |
| `--hr-head-ratio` | `(1 + (f - 1) / 2) / f` | title, display and hero grow by half the factor |
| sheet height | 92 % of the window | the top of the page stays visible behind a bottom sheet |
| breakpoint | 600 px (`layout.breakpoint.regular`) | bottom sheet below, dialog from it; a media query cannot read a custom property |

## Measured (Chromium, the pass script)

No sideways scroll at 320, 768 and 320 with 200 % text; every radio row, the Aa control and Done at least 64 px; the smallest UI text 18 px (the Profile's captions behind the sheet are the app's 14 px captions, unchanged); the confirm step's buttons are full width on phones.

## Strings

`common.display.button`, `.a11y`, `.title`, `.language`, `.textSize`, `.size.standard`, `.size.large`, `.size.larger`, `.size.largest`, `.preview`, `.note`, `.confirm.question`, `.confirm.use`, `.confirm.back` (en / es / ko in `AMENDMENTS-DISPLAY-NAV.md` section 10); `common.buttons.done`, `common.buttons.back` (existing). The Profile rows behind the sheet are existing keys and `learner.profile.display.*` (section 10).
