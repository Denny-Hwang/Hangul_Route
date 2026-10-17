# DisplaySheet (component spec v1)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` sections 3.6 and 4 (owner items 6 and 7: one UI language per device and per account; a text size control on every page) · wireframe `design/wireframes/shell/display-sheet.md` · related: `docs/specs/F-I18N-001-ui-locales.md` §3.2 / §3.3 (device locale, pickers)
Code: `packages/design-system/src/components/DisplaySheet/` (`DisplaySheet.tsx` paint, `model.ts` pure, `types.ts`, `index.ts`), the text size engine `packages/design-system/src/text-size.ts` and `components/TextSize/`; the DOM twin for the grown-up pages is `apps/web/src/components/console/DisplaySheet.tsx`.

## What it is

The Display (Aa) sheet: the device's one UI language and its text size. Every surface on the device opens it and writes the same record (`device:settings`, stored as `hr:device:settings`): the learner app (Home's Aa beside Profile, Profile's Display row), All lessons (the Aa beside Romanization in its header), the presenter (the Aa button on the home and the start screen) and the grown-up pages (the Aa button in the adult frame header at every width, on `/signin` and on the grown-up lock). Not behind the grown-up gate: display only, reversible, no learner data.

The design system has no copy: every label, the preview line and the Aa glyph come from the caller's dictionary (`common.display`; Korean draws "가가").

## Anatomy

```
 ──── (handle, phone only)
 Display                                  <- title (prompt), names the dialog
 [ caller's rows: All lessons Romanization ]
 Language
 ( English ) ( Español ) ( 한국어 )        <- radiogroup, endonyms, each in its own lang
   another language: in place of the radios, written in that language
   ¿Usar Español en este dispositivo?
   [[ Usar Español ]]  [ Volver a English ]
 Text size
 ( Aa  Standard ) ( Aa  Large   )          <- radiogroup, each Aa at its own step;
 ( Aa  Larger   ) ( Aa  Largest )             two per row on a phone, four in the dialog
 ┌──────────────────────────────┐
 │ This is how text looks.      │          <- live preview at the chosen size (polite live region)
 └──────────────────────────────┘
 For everyone on this device. Change it any time.   <- note
 [            Done             ]
```

A bottom sheet below `layout.breakpoint.regular` (600), a centred dialog from it, at most `layout.maxWidth.reading` (720) wide (AMENDMENTS-DISPLAY-NAV section 3.6; the grown-up pages' DOM twin uses the same 600 px breakpoint and width). A text size applies at once; another language first asks in that language (Use writes it, Back changes nothing; the F-I18N-001 §3.3 safety rule). Done only closes. The scrim and Escape (web) close it.

## Text size steps

| Step | Factor `f` | caption | bodySm | body | bodyLg | prompt | title | display | hero |
|---|---|---|---|---|---|---|---|---|---|
| Standard | 1 | 14 | 16 | 18 | 20 | 22 | 28 | 36 | 48 |
| Large | 1.15 | 16 | 18 | 21 | 23 | 25 | 30 | 39 | 52 |
| Larger | 1.3 | 18 | 21 | 23 | 26 | 29 | 32 | 41 | 55 |
| Largest | 1.5 | 21 | 24 | 27 | 30 | 33 | 35 | 45 | 60 |

Reading sizes (caption to prompt) take `f`; large type (title, display, hero) takes `1 + (f - 1) / 2`; every size is rounded and the line height comes from the scaled size (`useTypeScale`, pinned in `text-size.test.ts`). Standard is the token scale exactly. `Heading`, `Body`, `Caption`, `Button`, `Pill`, `ChoiceCard`, `Tile`, `SectionTabs` and `KoreanText` (`koreanTextSizes`) read it. The layouts that switched on the OS text size read `useEffectiveFontScale()` = OS fontScale x f. A native `maxFontSizeMultiplier` cap stays a budget for OS x f together (`cappedFont`, `scaledFontCap` = cap / f, never below 1). Presenter slides keep their stage units. The grown-up pages set `--hr-text-scale` and `font-size: calc(100% * var(--hr-text-scale, 1))` on `<html>`; their type is in rem.

## Tokens (no literals)

| Part | Selected | Not selected |
|---|---|---|
| Segment fill | `brand.primary` | `surface.paper` |
| Segment border | `brand.primary`, `borderWidth.base` (`thick` on focus, `border.focus`) | `border.strong`, `borderWidth.base` |
| Segment label | `text.onPrimary`, `weight.semibold`, `bodySm` at the step | `text.primary` |
| Segment shape | `radii.lg`, min `touchTarget.min` x `touchTarget.min`, padding `spacing.sm` x `spacing.xs`, gap `spacing.xs` | same |
| Aa glyph | `weight.bold`, the `body` size of that step | same |
| Sample | `surface.sunken`, `radii.md`, padding `spacing.md`, `Body size="lg"` | |
| Sheet | `surface.paper`, `radii.xl` top (all corners as a dialog), `shadows.modal`, scrim `surface.overlay` | |

## Accessibility

- The sheet is `role="dialog"` with `aria-modal`, named by its title.
- Each control is a `radiogroup` named by its row label; each option is a `radio` with its checked state; a language option is named by its endonym and carries its `lang` (`accessibilityLanguage` on iOS).
- Roving focus on the web (WAI-ARIA radio group, `radioAfter` in `model.ts`): only the selected radio is a Tab stop; the arrows (wrapping), Home and End move focus and the selection together.
- When the confirm step opens, focus moves to its question; when Use or Back closes it, focus returns to the selected language radio (the control that had focus has unmounted). The grown-up pages' sheet moves focus to Use, then back to the selected language, and its Tab trap counts only Tab stops.
- Every option is at least 64 x 64; rows wrap instead of scrolling sideways (360 wide at Largest fits all four steps).
- The Aa glyphs are hidden from assistive tech; the Aa button is named `common.display.a11y` ("Aa, Display: language and text size": the name begins with the visible sign, WCAG 2.5.3 Label in Name) with `aria-haspopup="dialog"`.
- Another language first shows the confirm step in that language (`lang`-tagged, a polite live region); Use writes the record and the sheet re-renders in the new language; Back changes nothing (the mis-tap rule of F-I18N-001 §3.3).
- No motion beyond the platform's modal slide or fade.
