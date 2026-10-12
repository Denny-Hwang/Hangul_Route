# Site/Home — hangulroute.com `/`, layered intro (wireframe v1)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` §3.1 (levels), §3.3 (blocks), §3.9 (claims), §3.11 (budgets), appendix B.1 (English strings)
Replaces: the 11-section landing (`apps/web/src/components/landing/LandingPage.tsx`), 16.5 phone screens on 2026-10-11
Audience: **first-time visitor of any kind** — a learner of any age, a parent, a teacher. Shared surface: no age words, no "for kids".
Shared chrome: `site/header-footer.md`

## Scenario (Given-When-Then)

Given: someone hears of Hangul Route and opens hangulroute.com for the first time, on a phone or a laptop
When: the page loads
Then: within the first screen they know what it is and can start learning in one tap; within one short scroll a parent or teacher finds the page written for them

## Screen goal

"Say what Hangul Route is in one look, and send each visitor to the next step for them: the app for learners, the persona page for grown-ups."

## Box diagram

Phone (one column; ~4 screens in total):

```
+--------------------------------------+
| [skip to content]  (visible on focus)|
| [HR] Hangul Route     [[ START ]]    |  <- header row 1      -> app (learner start)
| Learners  Parents  Teachers  Sign in |  <- header row 2      -> site/learners · site/parents · site/teachers · app sign-in
+--------------------------------------+
|                                      |
|  H1  one line: what it is            |  <- L0: the tagline
|  one sentence: what you do           |
|                                      |
|  [[ START LEARNING ]]                |  <- primary CTA, largest   -> app (learner start, ?lang= off /en)
|  "Parent or teacher? Start here" v   |  <- in-page link            -> #who
|  three short facts (one line)        |
|                                      |
|        [HOYA ART]  (bubble)          |  <- decorative, taught letter in the bubble
+--------------------------------------+  <- end of first screen at 375 x 812
| H2 Who is it for?           (#who)   |  <- L1 persona chooser
| +----------------------------------+ |
| | Learners                       > | |  -> site/learners   (whole card = one link)
| | one line                         | |
| +----------------------------------+ |
| | Parents                        > | |  -> site/parents
| | one line                         | |
| +----------------------------------+ |
| | Teachers                       > | |  -> site/teachers
| | one line                         | |
| +----------------------------------+ |
+--------------------------------------+
| H2 How it works                      |  <- L1, 3 numbered steps, 1 line each
|  1 title · one line                  |
|  2 title · one line                  |
|  3 title · one line                  |     (3 switches to the LEARNING ROUTE line when its claim is on)
+--------------------------------------+
| (H2 hidden: Our promises)            |  <- L1, 2 x 2 grid of short items
|  [No ads]        [Child safety]      |
|  [Works offline] [No red marks]      |
+--------------------------------------+
| H2 What does it cost?                |  <- one line, no price (claim-driven)
|  one line                            |
+--------------------------------------+
| H2 Common questions                  |  <- L3: 4 folded <details>
|  > who is it for                     |
|  > adult beginners                   |
|  > do I need Korean                  |
|  > how long is a session             |
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
| [ Learners      > ]  [ Parents       > ]  [ Teachers      > ]            |
+--------------------------------------------------------------------------+
| How it works: 1 | 2 | 3            | promises 4 across                   |
| What does it cost? one line        | Common questions (4 folded)         |
| Get the launch news [ email ] [SEND]                                     |
| footer                                                                   |
+--------------------------------------------------------------------------+
```

## Interaction points

- [[ START ]] (header) and [[ START LEARNING ]] (hero) → learner app, same tab; from `/es` or `/ko` the link carries `?lang=` (unchanged behaviour). Telemetry `site.cta_tapped {cta:'start', place:'header'|'hero'}`.
- "Parent or teacher? Start here" → scrolls to `#who` (no JavaScript needed); focus moves to the section heading.
- Persona card (whole card) → `site/learners` / `site/parents` / `site/teachers`. Telemetry `{cta:'persona', place:'who', persona}`.
- Sign in (header) → grown-up sign-in on the app host (before the flip: today's `/teach`). Telemetry `{cta:'sign_in', place:'header'}`.
- A question's summary → opens its answer in place. Telemetry `site.fold_opened` on the first open per load.
- Launch-news SEND → `POST /api/waitlist` (unchanged); success line replaces the form. Telemetry `{cta:'news_submitted'}` on success only.

## Navigation graph

Enter from: search results, shared links, the learner app's "About" links, any site page's brand link, old bookmarks of `/` anchors (`#cards`, `#games`, `#parents` simply land at the top)
Exit to:    learner app (start) · app sign-in · `site/learners` · `site/parents` · `site/teachers` · `/about` · `/privacy` · `/terms` · mail client (contact)

## States

- **success**: as drawn; every claim off is the normal state today.
- **claims on** (longest state, used for the word budget): step 3 shows the LEARNING ROUTE line; the cost line shows the claim's wording. No other block grows.
- **empty**: none of the blocks depends on data that can be missing; card and game counts come from bundled data (never 0).
- **error**:
  - launch-news request fails or is offline → the form's existing inline error line and a retry; the rest of the page is unaffected.
  - JavaScript off → every link, the folds and the form's no-JS message still work (static HTML).
  - app unreachable after tapping Start → the browser's own error page on the app host (the site cannot see it); the site never shows a spinner.
  - hidden locale (`/es`, `/ko` before they ship) → 404 page with links to `/` and Start learning.

## Data needs

- reads: nothing at runtime. Build time: `landing` messages (`packages/i18n`), `SITE_CLAIMS`, `site-routes.json`, `appUrl()`.
- writes: launch-news email only (existing API); anonymous `site.*` telemetry (no cookie, no id; nothing under GPC / Do Not Track).

## Open questions

- Does the hero need the Hoya art on phones, or would the persona chooser fit on the first screen without it? Default: keep the art, capped in height so the h1, lead and CTA fit at 320 x 568 (spec §3.11); revisit with the design pass (S-D).
- Should the four promises be one line each with no body on phones? Default: title + one short body, within the 350-word budget.
