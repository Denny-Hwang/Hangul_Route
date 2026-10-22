# Site / About's action, the branded 404 and the head assets (wireframe)

Spec: `docs/specs/AMENDMENTS-SITE-NEWUSER.md` §3.7, §3.14 (amends F-SITE-002 §3.7), rows SN-1 (About) and SN-2 (404,
head). Audience: anyone; the 404 visitor followed an old or mistyped link; the head assets serve browsers and link
previews in chat apps.

## User scenario (Given-When-Then)

- Given a visitor reads About to decide whether to trust the product, when they finish the promises, then they can start
  right there.
- Given a visitor follows an old link to `/es/teach-old`, when the page is missing, then they see a friendly page in
  Spanish, inside the site's header and footer, with the home page and Start learning, and nothing of Next's default
  "404 | This page could not be found."
- Given someone shares hangulroute.com in a chat app, when the preview renders, then it shows Hoya and the brand with
  the tagline in the page's language, and the browser tab shows the Hoya icon.

## Screen goal

1. About: one action after the promises (Start learning).
2. 404: get the visitor back on a path (home or start) in one tap.
3. Head: recognisable tab icon, home-screen icon and link preview.

## Box diagram

About (unchanged body; one new button):

```
│ ← Back home                     │
│ H1 About Hangul Route · lead    │
│ Our promises (list)             │
│ [[ START LEARNING ]]            │  ← NEW
│ Have feedback? (box)            │
```

404 (each locale: `/404.html`, `/es/404.html`, `/ko/404.html`):

```
│ header (locale chrome)                   │
│      (Hoya waving, decorative)           │
│      H1: Page not found                  │
│   The link may be old. Try the home      │
│   page or start learning.                │
│        [Go to the home page]             │  ← text link to the locale home
│        [[ START LEARNING ]]              │
│ footer                                    │
```

Head:

```
favicon 32 / 48 (icon.png) · apple-touch-icon 180 (apple-icon.png) · og:image 1200 x 630 per locale
┌──────────────────────────────────────────────┐
│  ( Hoya on a light brand circle )  HR Hangul Route │
│                                    tagline (locale)│
│                                    hangulroute.com │
└──────────────────────────────────────────────┘
```

States:
- **Success**: as drawn.
- **Empty**: none.
- **Error**: a 404 under a hidden locale (pruned) falls back to `/404.html` in English, as today.
- **Dark mode**: the 404 no longer carries Next's inline `prefers-color-scheme: dark` style (today it turns the body
  black under the site's light chrome); the page uses the site's surfaces like every other page.

## Interaction points

- About: START LEARNING → `learnerStart(locale)`.
- 404: home link → `sitePath(locale, '/')`; START LEARNING → `learnerStart(locale)`; header and footer as on every page.

## Navigation graph

- About: enter from the footer and the learner app's About link; exit to the learner app, home, the footer.
- 404: enter from any unknown path (Cloudflare `not_found_handling = "404-page"` serves the nearest `404.html` up the
  path); exit to home or the learner app.

## Data needs

- `landing.notFound.title` (new), `.body` (changed), `.home`, `.start` (unchanged); `landing.captures.og(brand, tagline)`
  for `og:image:alt`; `landing.meta.tagline`.

## Open questions

- OD-SN-7: the 404's Hoya pose. Default: `waving`, the welcome pose of the home hero. `thinking` (row SN-2's first draft, #804) carries a downturned mouth at this size and is the app's "not quite" pose; a missing page is not the visitor's miss, so the mock does not use it.
