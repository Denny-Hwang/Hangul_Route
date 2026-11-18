# PWA/Static splash — the HTML shell before the start bundle runs (wireframe v1, web only)

Spec: `docs/specs/AMENDMENTS-FINISH-2026-11.md` row FN-2 (finding F7 of `docs/launch/performance-review-2026-11.md`).
Audience: **everyone** who opens the app host's learner shell: learners of any age on `/`, a teacher on `/present`, a
grown-up on `/browse` (All lessons). Copy is Pre-A1, one word or two; no Hoya pose (Hoya appears with the app itself).
Mock: `design/screens/static-splash/README.md`.

## Scenario (Given-When-Then)

Given: the learner shell (`index.html`) is opened with no service worker in control (a first visit), or on a slow
phone where the start bundle takes seconds to download and run
When: the HTML arrives, before any app script has run
Then: the page shows the brand mark and one short "Loading" line on the canvas, in the language this device chose
before (else the device's own language if the app has it, else English), and the app's first frame replaces it

## Screen goal

"Show at once that the right app is opening, then step aside for the app without a jump."

## Box diagram

```
A. Splash (every width; the group is centred in the window)
+------------------------------------------+
|                                          |
|                                          |
|                  ( HR )                  |  <- brand mark: the site header's
|                                          |     circle sign, larger; decorative
|               Hangul Route               |  <- app name, the same in every locale
|                                          |
|                 Loading                  |  <- one muted line, the UI language;
|                                          |     a gentle fade only when motion is
|                                          |     allowed
|                                          |
+------------------------------------------+

B. The app's first frame (whatever the root draws first)
+------------------------------------------+
|  Welcome / Home / presenter home /       |  <- the splash is gone in the same
|  the shelf's waiting line                |     frame: no blank frame between
+------------------------------------------+
```

- One group, centred in both directions, inside the safe area; nothing is tappable, so no touch target is drawn.
- The mark and the name are the brand sign the grown-up pages and the site header already carry (design pass D1 of
  `design/screens/app-shell/README.md`: no Hoya outside the app's own screens). The splash adds no new art.
- The background is the shell's own page background, so nothing changes behind the group when the app replaces it.

## Interaction points

- None. The splash takes no tap, no key and no focus; it never holds a button.
- The app's first frame removes it (all three roots: the learner app, the presenter, All lessons). A grown-up URL with
  no file of its own bounces away and never needs the splash removed.

## Navigation graph

```
[open the app host: /, /present, /browse, a learner deep link]
        |
        v
  A. Splash  --(the root's first frame)-->  B. the root's first screen
        |
        +--(start bundle never runs)--> stays on A
```

## Data needs

| Data | Source | When |
|---|---|---|
| The device's chosen UI language | a synchronous copy of the device record's language in browser storage, kept by the app and the grown-up pages | read by a tiny inline script before the first paint |
| The browser's languages | `navigator.languages` | when no choice is stored |
| Which UI locales ship | `LOCALE_STATUS`, written into the page at build time | build |
| The strings of every shipped locale | `packages/i18n`, written into the page at build time | build |

## States

| State | What shows |
|---|---|
| Loading (default) | mark, name, "Loading" in the language picked as above |
| Motion reduced (`prefers-reduced-motion: reduce`) | the same, with no fade: everything is still |
| Scripts off or blocked | the splash stays in English (the HTML's own text); the app cannot start either, and nothing else is promised |
| Language read fails (storage blocked, private window) | detection from the browser's languages, else English; never an error |
| Start bundle fails (offline with no service worker, a broken deploy) | the splash stays: the page has nothing better to show, and it never claims progress |
| The app's crash screen | the crash screen is a frame of the app, so the splash is already gone |

## Copy

| Slot | English | Note |
|---|---|---|
| Name | Hangul Route | `landing.brand.name`: the app name in every locale |
| Mark | HR | `landing.brand.mark` |
| Loading line | Loading | new key `common.splash.loading`; es and ko in the same change |

- The name and the line are text, so a screen reader reads "Hangul Route, Loading"; the mark is hidden from it (the
  name says the same).
- `<html lang>` follows the line's language, so a Korean "Loading" is read as Korean.

## Accessibility

- A browser text size enlarges the name and the line; nothing is clipped at 200 % text or on the narrowest phone.
- Text contrast meets 4.5:1 on the page background (values in the mock).
- No live region: the line does not change, and the app's first screen is announced as usual.

## Open questions

- None for this pass. A splash on the site and console pages (`apps/web`) is out of scope: those pages are
  prerendered HTML and paint their own content.
