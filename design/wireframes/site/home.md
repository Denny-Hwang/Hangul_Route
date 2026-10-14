# Site/Home — hangulroute.com `/`, layered intro (wireframe v2)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` §3.1 (levels), §3.3 (blocks), §3.9 (claims), §3.11 (budgets), appendix B.1 (English strings)
Replaces: the 11-section landing (`apps/web/src/components/landing/LandingPage.tsx`), 16.5 phone screens on 2026-10-11
Audience: **first-time visitor of any kind** — a learner of any age, a parent or caregiver, a teacher. Shared surface: no age words, no "for kids".
Shared chrome: `site/header-footer.md`

## Scenario (Given-When-Then)

Given: someone hears of Hangul Route and opens hangulroute.com for the first time, on a phone or a laptop
When: the page loads
Then: within the first screen they know what it is and can start learning in one tap; within one short scroll a parent or teacher finds the page written for them

## Screen goal

"Say what Hangul Route is in one look, and send each visitor to the next step for them: the app for learners, the persona page for grown-ups."

## Box diagram

Phone (one column; about 3.5 screens in total, budget 2,900 px at 375 x 812):

```
+--------------------------------------+
| [skip to content]  (visible on focus)|
| [HR] Hangul Route          [Sign in] |  <- header, one row     -> app sign-in (grown-ups)
+--------------------------------------+
| (locale banner, only when it applies; unchanged)
|                                      |
|  H1  one line: what it is            |  <- L0: the tagline
|  one sentence: what you do           |
|                                      |
|  [[ START LEARNING ]]                |  <- primary CTA, largest   -> app (learner start, ?lang= off /en)
|  "Parent or teacher? Find your page" v  <- in-page link        -> #who
|  three short facts (one line)        |     browser · nothing to install · the app works offline
|                                      |
|        [HOYA ART]  (bubble)          |  <- decorative, taught letter and its romanization in the bubble
+--------------------------------------+  <- end of first screen at 375 x 812
| H2 Who is it for?           (#who)   |  <- L1 persona chooser
| +----------------------------------+ |
| | Learners                       > | |  -> site/learners   (whole card = one link)
| | one line                         | |
| +----------------------------------+ |
| | Parents and caregivers         > | |  -> site/parents
| | one line                         | |
| +----------------------------------+ |
| | Teachers                       > | |  -> site/teachers
| | one line                         | |
| +----------------------------------+ |
+--------------------------------------+
| H2 How it works                      |  <- L1, 3 numbered steps, 1 line each
|  1 title · one line                  |
|  2 title · one line                  |
|  3 title · one line                  |     (3 switches to the Learning Route line when its claim is on)
+--------------------------------------+
| (H2 hidden: Our promises)            |  <- L1, three titles, no body
|  No ads, ever · Child safety first · No red marks
+--------------------------------------+
| H2 What does it cost?                |  <- one line, no price (claim-driven)
|  one line                            |
+--------------------------------------+
| H2 Get the launch news     (#news)   |
|  one line                            |
|  [ email ................ ] [SEND]   |  <- existing WaitlistForm, same consent line
+--------------------------------------+
| footer (site/header-footer)          |
+--------------------------------------+
```

Wide (>= 720; at 1280 x 800 the hero and the persona row share the first screen):

```
+--------------------------------------------------------------------------+
| [HR] Hangul Route  [[ START ]]   Learners  Parents  Teachers   Sign in   |
+--------------------------------------------------------------------------+
|  H1 what it is                               |                           |
|  one sentence                                |       [HOYA ART]          |
|  [[ START LEARNING ]]  Parent or teacher? v  |        (bubble)           |
|  facts line                                  |                           |
+--------------------------------------------------------------------------+
| H2 Who is it for?                                                        |
| [ Learners      > ]  [ Parents and caregivers > ]  [ Teachers      > ]   |
+--------------------------------------------------------------------------+
| How it works: 1 | 2 | 3            | promises: three titles in a row     |
| What does it cost? one line                                              |
| Get the launch news [ email ] [SEND]                                     |
| footer                                                                   |
+--------------------------------------------------------------------------+
```

There is no questions block on `/`: each question now lives on the persona page it belongs to (spec §3.3, rule 3 of §3.1).

## Interaction points

- [[ START ]] (wide header) and [[ START LEARNING ]] (hero) → learner app, same tab; from `/es` or `/ko` the link carries `?lang=` (unchanged behaviour).
- "Parent or teacher? Find your page" → scrolls to `#who` (no JavaScript needed); focus moves to the section heading.
- Persona card (whole card) → `site/learners` / `site/parents` / `site/teachers`.
- Sign in (header) → app.hangulroute.com/signin by default (F-SITE-002 S-10); `/signin` on the same origin only with the kill switch `CONSOLE_ORIGIN=false` (F-APP-001). Never `/teach`.
- Launch-news SEND → `POST /api/waitlist` (unchanged); success line replaces the form.

## Navigation graph

Enter from: search results, shared links, the learner app's "About" links, any site page's brand link, old bookmarks of `/` anchors (`#cards`, `#games`, `#parents` simply land at the top)
Exit to:    learner app (start) · app sign-in · `site/learners` · `site/parents` · `site/teachers` · `/about` · `/privacy` · `/terms` · mail client (contact)

## States

- **success**: as drawn; every claim off is the normal state today.
- **claims on** (longest state, used for the word budget): step 3 shows the Learning Route line; the cost line shows the paid-plans wording ("…at app.hangulroute.com"); the free line stays "Stage 1 is free." in every state (F-ENT-003 OD-1). No other block grows.
- **empty**: none of the blocks depends on data that can be missing.
- **error**:
  - launch-news request fails or is offline → the form's existing inline error line and a retry; the rest of the page is unaffected.
  - JavaScript off → every link and the form's no-JS message still work (static HTML).
  - app unreachable after tapping Start → the browser's own error page on the app host (the site cannot see it); the site never shows a spinner.
  - hidden locale (`/es`, `/ko` before they ship) → 404 page with links to `/` and Start learning.

## Data needs

- reads: nothing at runtime. Build time: `landing` messages (`packages/i18n`), `SITE_CLAIMS`, `site-links` (`APP_ROUTES`, `CONSOLE_ORIGIN`), `appUrl()`.
- writes: launch-news email only (existing API). No telemetry, no cookie; the locale banner keeps its one `sessionStorage` flag.

## Open questions

- Does the hero need the Hoya art on phones, or would the persona chooser fit on the first screen without it? Default: keep the art, capped in height so the header, h1, lead and CTA fit at 320 x 568 (spec §3.11); revisit with the design pass (S-D).
- Resolved in v2: the four promises became three titles with no body at every width (the details live on `/parents` and `/learners`), and "Works offline" moved to the facts line so it is not said twice.
