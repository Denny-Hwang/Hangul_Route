# Site/Header and footer — shared chrome of every hangulroute.com page (wireframe v2)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` §3.2 (header and footer), §3.8 (every app link through `site-links.ts`), §6 (accessibility)
Used by: `site/home`, `site/learners`, `site/parents`, `site/teachers`, `/about`, the 404 page; `/privacy` and `/terms` use the legal variant (below)
Replaces: the landing header (anchors `#cards` `#games` `#parents`, "Dashboard" to `/parent`, "For teachers" to `/teach`) and footer (anchors, "Parent dashboard", "Teacher console")
Audience: **everyone** (shared surface)

## Scenario (Given-When-Then)

Given: a visitor is on any page of hangulroute.com
When: they look for where to go next
Then: they always find a grown-up "Sign in" in the same place, the learner "Start learning" on the first screen of the page, and the three persona pages in the footer (and in the header on wide screens); never a console or billing page on this site

## Screen goal

"Give every page the same three choices: learn now, read about my persona, or sign in as a grown-up."

## Box diagram

Header, phone (one row below 720 px; no hamburger, nothing behind a menu):

```
+--------------------------------------+
| [skip to content]   <- first Tab stop, shown only on focus
| [HR] Hangul Route          [Sign in] |  <- brand -> locale home · Sign in -> app sign-in (grown-ups, no persona hint)
+--------------------------------------+
```

- Below 720 px, Start learning and the persona links are not rendered (`display: none`, so they also leave the Tab order). Four links at 64 px hit areas need about 330 px; 320 px leaves 288 px, and the header would wrap to three rows before the h1.
- On phones the learner app is reached through each page's first-screen primary action and the footer; the persona pages through the home hero link "Parent or teacher? Find your page", the `#who` cards and the footer's Guide group.

Header, wide (720 px and up, one row):

```
+--------------------------------------------------------------------------+
| [HR] Hangul Route  [[ START ]]   Learners  Parents  Teachers   Sign in   |
+--------------------------------------------------------------------------+
```

Header, legal variant (`/privacy`, `/terms`; the learner app, including native builds, links here):

```
+--------------------------------------+
| [HR] Hangul Route                    |  <- phone: brand only
+--------------------------------------+
| [HR] Hangul Route   Learners  Parents  Teachers |  <- wide: no Start, no Sign in
```

- One DOM order for every width, equal to the visual order (WCAG 2.4.3): skip, brand, Start, Learners, Parents, Teachers, Sign in. Items hidden on phones are removed from layout and Tab order, so the order of what remains is still the visual order.
- Current page: its nav link carries `aria-current="page"` and a non-colour marker (underline token).
- Every control at least 64 x 64 hit area. Header height at 320 x 568: one row, at most 96 px; at 200 % text, at most two rows (spec §3.11).

Footer (phones: two columns, Guide and App left, Company right; wide: three columns):

```
+--------------------------------------+
| Hangul Route · one-line tagline      |
|                                      |
| Guide            Company             |
| Learners         About               |
| Parents          Privacy             |
| Teachers         Terms               |
|                  Contact (mail)      |
| App                                  |
| Start learning                       |
| Sign in                              |
|                                      |
| (c) year Hangul Route   [locale switcher, only once a 2nd locale ships]
+--------------------------------------+
```

## Interaction points

- Skip link → focus moves to `main#content`.
- Brand → locale home (`sitePath(locale, '/')`).
- Learners / Parents / Teachers → `sitePath(locale, '/learners' | '/parents' | '/teachers')` (Next `Link` inside the site route group).
- Sign in → `siteLinks.signIn()` (plain `<a>`): `https://app.hangulroute.com/signin` by default (F-SITE-002 S-10); `/signin` on the same origin only with the kill switch `CONSOLE_ORIGIN=false` (F-APP-001 §3.7; neutral intro, no persona hint). Never `/teach`.
- Start / Start learning (wide header, footer) → `siteLinks.learnerStart(locale)` (plain `<a>`).
- Legal variant: the footer has no App group.
- Contact → `mailto:` (`data/contact.ts`).
- Locale switcher → the same page in another shipped locale (unchanged component).

## Navigation graph

Enter from: every site page (this is chrome)
Exit to:    learner app · app sign-in · `site/home` · `site/learners` · `site/parents` · `site/teachers` · `/about` · `/privacy` · `/terms` · mail client · the same page in another locale

## States

- **success**: as drawn.
- **one locale shipped** (today): no locale switcher; nothing reserves its space.
- **legal page**: legal variant of header and footer (no Sign in, no Start learning).
- **empty**: not applicable (static).
- **error**: very narrow screen or 200 % text → at most two header rows; never a horizontal scroll (e2e at 320 with 200 % text); JavaScript off → every link works.

## Data needs

- reads (build time): `landing.nav`, `landing.footer`, `shownSiteLocales()`, `site-links`.
- writes: nothing (the site sends no telemetry; spec §7.2).

## Open questions

- Header label "Sign in" alone, or "Grown-ups sign in"? Default: "Sign in" (short, fits 320 px); the persona pages carry the explicit "Sign in as a parent / teacher", and `/learners` answers "Is there a sign-in for learners?" (spec OD-12).
- Should the wide header put Start at the far right, as many sites do? Default: no — Start stays next to the brand so the DOM order matches the visual order.
- If brand + Sign in do not fit one row at 320 px (spec assumption b): below 360 px the brand shows the mark and a shorter name.
