# Site / header with the language control and the phone Start pill (wireframe)

Spec: `docs/specs/AMENDMENTS-SITE-NEWUSER.md` §3.2 (amends F-SITE-002 §3.2), row SN-1. Earlier frame: `header-footer.md`.
Audience: every visitor on every site page; often someone whose language is not English, on a phone.

## User scenario (Given-When-Then)

- Given a Spanish-speaking parent opens an English link to `/parents` on a phone,
- When they look at the top of the page,
- Then they find a language control at once, switch to the same page in Spanish in two taps, and on any page can
  start the app from the header without scrolling.

## Screen goal

1. Change the page's language from any page, at any width.
2. Start learning from the header on phones too.

## Box diagram

Phone, below 30em (480 px): brand mark only. On `/` (review round 3): no Start pill on phones, and the brand name shows from 22.5em (360 px):
`[HR Hangul Route] ....... [globe English][Sign in]`.

```
┌──────────────────────────────────────────┐
│ [HR]          [Start][ (globe) ][Sign in] │  ← one row; every control 64 x 64 at least
│                      [ English ]          │     globe over the endonym, caption size
└──────────────────────────────────────────┘
```

Phone, 30em to 45em: `[HR Hangul Route] ....... [Start][globe English][Sign in]`.

Wide, 45em to 60em (mark only) and 60em up (mark and name):

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [HR Hangul Route] [Start]          Learners  Parents  Teachers [globe English v] [Sign in] │
└────────────────────────────────────────────────────────────────────────────┘
```

Language menu, open (anchored under the control, right-aligned; same on every width):

```
                         ┌────────────────────┐
                         │ English        (✓) │  ← current: bold + check, aria-current="page"
                         │ Español            │  ← lang="es" hreflang="es"
                         │ 한국어             │  ← lang="ko" hreflang="ko"
                         └────────────────────┘
```

Legal variant (`/privacy`, `/terms`): brand, nav (wide), language control; no Start, no Sign in (OD-14 of F-SITE-002).

Locale banner (English pages only, browser prefers es or ko, not dismissed this session), above the page's first block:

```
│ [ Ver en Español                           (x) ] │  ← offers the SAME page: /es/parents, not /es
```

States:
- **Success**: as drawn; menu closed by default.
- **Empty**: only one locale shown (`shownSiteLocales()` length 1): the control is not rendered (as the footer switcher).
- **Error**: none (plain links). Large text (200 %): the row wraps to two rows at 320 px, never sideways; the menu
  grows with the text and stays inside the viewport (max width 100 vw minus the gutters).
- **No JavaScript**: `<details>`/`<summary>` opens and closes natively; with JavaScript, Escape and a tap outside close it
  and return focus to the summary.

## Interaction points

- Start pill → `learnerStart(locale)`; visible label "Start", accessible name "Start learning" (`nav.start`), so the
  visible words are in the name (WCAG 2.5.3).
- Language summary → opens the menu; each item → the same page in that locale (`sitePath(target, page)`), full reload.
- Sign in → `signIn()` (neutral intro), unchanged.
- Banner link → `sitePath(target, page)`; close → dismissed for the session (unchanged storage key).

## Navigation graph

- Enter from: every site page.
- Exit to: learner app, `/signin`, the persona pages, the same page in es / ko / en.

## Data needs

- `LOCALE_META[locale].endonym` and `.htmlLang` (values, never messages), `shownSiteLocales()`, the page path the shell
  already knows (`SiteShell page`), `landing.footer.language` for the summary's hidden prefix, `landing.nav.startShort`.

## Open questions

- OD-SN-1 (default changed after review round 3): on `/` the header Start stays wide-only, as today, because the hero's
  Start learning is on the first screen; every other page has the phone Start pill.
- OD-SN-2 (default changed after review round 3): on `/` the phone header shows the brand name from 22.5em (360 px), so a
  first-time visitor reads "Hangul Route" on the first screen; on other pages the name shows from 30em (480 px), the mark
  alone below. The alternative is a second header row.
