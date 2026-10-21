# Site / home `/` — new-visitor pass (wireframe)

Spec: `docs/specs/AMENDMENTS-SITE-NEWUSER.md` (amends F-SITE-002 §3.3), rows SN-1. Earlier frame: `home.md`.
Audience: a first-time visitor of any age, often on a phone; a parent or a teacher arriving from a search or a link.

## User scenario (Given-When-Then)

- Given a visitor who has never seen Hangul Route lands on `/` (or `/es`, `/ko`) on a phone,
- When they read the first screen,
- Then they know what it is, see the app itself, can start the first quest in one tap, and a parent or a teacher can
  jump to their own page in one tap, without scrolling past the learner story.
- And after scrolling to the end, the last thing they meet is an invitation to start, not an email form.

## Screen goal

1. Primary: start the first quest (learner app, `learnerStart(locale)`).
2. Secondary: a parent or a teacher goes straight to `/parents` or `/teachers`.

## Box diagram

Phone (below 45em), first screen at 320 x 568 and 375 x 812:

```
┌──────────────────────────────────┐
│ [HR]        [Start] [🌐 lang] [Sign in] │  ← header, one row (header-language.md)
├──────────────────────────────────┤
│ H1: what it is (tagline)          │
│ Lead: what you do (1 sentence)    │
│ [[ START LEARNING ]]              │  ← primary, full width
│ facts line (caption)              │  ← reassurance right under the action
│ [I'm a parent]  [I'm a teacher]   │  ← two text links, 64 px tall each
├──────────────────────────────────┤
│ ┌ art ─────────────────────────┐ │
│ │ (bubble: taught letter +     │ │
│ │  romanization)  ┌─phone──┐   │ │  ← capture of quest 1, Discover page
│ │                 │ capture│   │ │     (alt text, see captures)
│ │  (Hoya waving)  │        │   │ │
│ └───────────────── ┴────────┴ ─┘ │
└──────────────────────────────────┘
```

Wide (45em and up): text column left (1.4fr), art right, as today. Below the hero, unchanged blocks, then the new end:

```
│ Who is it for?  [Learners >] [Parents >] [Teachers >]        │  ← unchanged (#who)
│ How it works   1 · 2 · 3                                      │  ← unchanged
│ (No ads, ever) (Child safety first) (No red marks)            │  ← unchanged
│ ╔══════════════ brand band (closing CTA) ══════════════╗     │
│ ║ H2: ready for your first Korean letter?             ║     │
│ ║ one line: free, no email or password, ~5 minutes    ║     │
│ ║ [[ START LEARNING ]]  (light pill on the band)      ║     │
│ ╚═════════════════════════════════════════════════════╝     │
│ H2: launch news (plain section)                               │
│ one line                                                      │
│ [ email field ][ submit ]                                     │
│ consent line (unchanged words)                                │
│ footer                                                        │
```

The old "What does it cost?" block is gone from `/`: its free line now opens the band's line (OD-SN-3).

States:
- **Success**: as drawn.
- **Empty**: none (static page). With the browser preferring es or ko, the locale banner sits above the h1
  (`header-language.md`).
- **Error**: a capture that fails to load shows the phone frame with its alt text and the art box colour; the layout
  keeps its size (the `img` carries `width` and `height`). The launch-news form keeps its own error lines (unchanged).
- **No JavaScript**: everything works; the language menu is a native disclosure.

## Interaction points

- START LEARNING (hero and band) → the learner app in the page's locale (`learnerStart(locale)`), same tab.
- "I'm a parent" → `sitePath(locale, '/parents')`; "I'm a teacher" → `sitePath(locale, '/teachers')` (in-site links).
- Persona cards → their pages (unchanged).
- Email field + submit → `POST /api/waitlist` (unchanged `WaitlistForm`, new `tone="plain"`).
- The capture and Hoya are not links (a capture that looks tappable but is not is a dead end; the actions sit beside it).

## Navigation graph

- Enter from: a search result, a shared link (og image, `head-assets` in `newuser-about-404-head.md`), the learner app's
  About link, the 404 page's home link, the brand in the header.
- Exit to: learner app (start), `/parents`, `/teachers`, `/learners` (cards), `/signin` (header), the same page in
  another locale (language menu).

## Data needs

- None at run time. Strings from `landing.home.*` (appendix A of the spec), the first letter and its romanization from
  `JAMO_SOUND_VALUES` (taught Korean passed as values), the capture files per locale from `public/site/<locale>/`.

## Open questions

- OD-SN-3: drop the cost block from `/` (default) or keep it above the band.
- OD-SN-6: the hero capture is the Discover page of quest 1; refresh rule when that page changes (default: SN-1's
  capture script runs on demand; a stale capture is still the real app).
- Beta check: do first-time visitors tap "I'm a parent / teacher" more than the old "Find your page" link? (Cloudflare
  path counts only, F-SITE-002 G8.)
