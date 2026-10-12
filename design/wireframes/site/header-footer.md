# Site/Header and footer — shared chrome of every hangulroute.com page (wireframe v1)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` §3.2 (header and footer), §3.8 (every app link through `site-links.ts`), §6 (accessibility)
Used by: `site/home`, `site/learners`, `site/parents`, `site/teachers`, `/about`, `/privacy`, `/terms`, the 404 page
Replaces: the landing header (anchors `#cards` `#games` `#parents`, "Dashboard" to `/parent`, "For teachers" to `/teach`) and footer (anchors, "Parent dashboard", "Teacher console")
Audience: **everyone** (shared surface)

## Scenario (Given-When-Then)

Given: a visitor is on any page of hangulroute.com
When: they look for where to go next
Then: they always find the three persona pages, a grown-up "Sign in" and the learner "Start learning" in the same places, and never a console or billing page on this site

## Screen goal

"Give every page the same three choices: learn now, read about my persona, or sign in as a grown-up."

## Box diagram

Header, phone (two rows at 320-719; no hamburger, nothing hidden):

```
+--------------------------------------+
| [skip to content]   <- first Tab stop, shown only on focus
| [HR] Hangul Route        [[ START ]] |  <- brand -> locale home · START -> app (learner)
| Learners  Parents  Teachers  Sign in |  <- -> site pages · Sign in -> app sign-in (grown-ups)
+--------------------------------------+
```

Header, wide (one row):

```
+--------------------------------------------------------------------------+
| [HR] Hangul Route  [[ START ]]   Learners  Parents  Teachers   Sign in   |
+--------------------------------------------------------------------------+
```

- One DOM order for every width, equal to the visual order (WCAG 2.4.3): skip, brand, Start, Learners, Parents, Teachers, Sign in. This is the order today's landing already uses for brand and "Play now" (`LandingPage.tsx:79-121`).
- Current page: its nav link carries `aria-current="page"` and a non-colour marker (underline token).
- Every control at least 64 x 64 hit area.

Footer (all widths; groups wrap):

```
+--------------------------------------+
| Hangul Route · one-line tagline      |
|                                      |
| Guide        Company       App       |
| Learners     About         Start learning
| Parents      Privacy       Sign in   |
| Teachers     Terms                   |
|              Contact (mail)          |
|                                      |
| (c) year Hangul Route   [locale switcher, only once a 2nd locale ships]
+--------------------------------------+
```

## Interaction points

- Skip link → focus moves to `main#content`.
- Brand → locale home (`sitePath(locale, '/')`).
- Learners / Parents / Teachers → `sitePath(locale, '/learners' | '/parents' | '/teachers')` (Next `Link` inside the site route group).
- Sign in → `siteLinks.signIn()` (plain `<a>`; same origin `/teach` until S-10, then app.hangulroute.com). Telemetry `site.cta_tapped {cta:'sign_in', place:'header'|'footer'}`.
- Start / Start learning → `siteLinks.learnerStart(locale)` (plain `<a>`). Telemetry `{cta:'start', place:'header'|'footer'}`.
- Contact → `mailto:` (`data/contact.ts`).
- Locale switcher → the same page in another shipped locale (unchanged component).

## Navigation graph

Enter from: every site page (this is chrome)
Exit to:    learner app · app sign-in · `site/home` · `site/learners` · `site/parents` · `site/teachers` · `/about` · `/privacy` · `/terms` · mail client · the same page in another locale

## States

- **success**: as drawn.
- **one locale shipped** (today): no locale switcher; nothing reserves its space.
- **empty**: not applicable (static).
- **error**: very narrow screen or 200 % text → items wrap to more rows; never a horizontal scroll (e2e at 320 with 200 % text); JavaScript off → every link works.

## Data needs

- reads (build time): `landing.nav`, `landing.footer`, `shownSiteLocales()`, `site-links`.
- writes: anonymous `site.*` telemetry only.

## Open questions

- Header label "Sign in" alone, or "Grown-ups sign in"? Default: "Sign in" (short, fits 320 px); the persona pages carry the explicit "Sign in as a parent / teacher" (spec OD-12).
- Should the wide header put Start at the far right, as many sites do? Default: no — it would make the DOM order differ between widths or put Start last on phones; Start stays next to the brand at every width.
