# DisplaySheet (component spec v1)

Spec: owner items 6 and 7 (one UI language per device and per account; a text size control on every page), spec row OR-0 · related: `docs/specs/F-I18N-001-ui-locales.md` §3.2 / §3.3 (device locale, pickers), `design/screens/browse/lesson-display.md` (the All lessons sheet this one generalises)
Code: `packages/design-system/src/components/DisplaySheet/` (`DisplaySheet.tsx` paint, `model.ts` pure, `types.ts`, `index.ts`), the text size engine `packages/design-system/src/text-size.ts` and `components/TextSize/`; the DOM twin for the grown-up pages is `apps/web/src/components/console/DisplaySheet.tsx`.

## What it is

The Display (Aa) sheet: the device's one UI language and its text size. Every surface on the device opens it and writes the same record (`device:settings`, stored as `hr:device:settings`): the learner app (Profile, the Display row), All lessons (inside Lesson display, under Romanization), the presenter (the Aa button on the home and the start screen) and the grown-up pages (the Aa button in the adult frame header at every width, on `/signin` and on the grown-up lock). Not behind the grown-up gate: display only, reversible, no learner data.

The design system has no copy: every label, the sample line and the Aa glyph come from the caller's dictionary (`common.display`).

## Anatomy

```
 ──── (handle, phone only)
 Display                                  <- title (prompt), names the dialog
 [ caller's rows: All lessons Romanization ]
 Language on this device
 ( English ) ( Español ) ( 한국어 )        <- radiogroup, endonyms, each in its own lang
 [ Back to English ]                      <- after a change only, written in the new language
 Text size
 ( Aa   ) ( Aa    ) ( Aa     ) ( Aa      ) <- radiogroup, each Aa at its own step
 Standard  Large     Larger     Largest
 ┌──────────────────────────────┐
 │ Text looks like this.        │          <- live sample at the chosen size (polite live region)
 └──────────────────────────────┘
 Every screen on this device uses these.  <- note
 [            Done             ]
```

A bottom sheet on phones (`compact`), a centred dialog from the regular class (max width `touchTarget.min * 8` = 512). A choice applies at once; Done only closes. The scrim and Escape (web) close it.

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
- Every option is at least 64 x 64; rows wrap instead of scrolling sideways (360 wide at Largest fits all four steps).
- The Aa glyphs are hidden from assistive tech; the Aa button is named "Display" (`common.display.open`) with `aria-haspopup="dialog"`.
- After a language change the sheet re-renders in the new language and offers "Back to <previous endonym>" (the mis-tap rule of F-I18N-001 §3.3, which used to be a confirm step).
- No motion beyond the platform's modal slide or fade.
