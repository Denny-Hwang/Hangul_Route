Status: ready

# F-SITE-002 — hangulroute.com becomes a short, layered intro site (one-screen hero, three persona pages, every account action on app.hangulroute.com)

> **Status note.** `ready` means the spec can be built PR by PR in the order of section 9. Owner decisions do **not** gate the whole spec: each one gates only the PRs named in section 11, and each has a default that applies until the owner answers. Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` below is at that commit. Live measurements are from hangulroute.com on 2026-10-11 (headless Chromium).
>
> **Owner request (2026-10-11), items this spec implements:** 1 (hangulroute.com and app.hangulroute.com get clearly separate roles), 2 (hangulroute.com is an intro and guide site only, with the right explanation for each persona, layered so a first-time visitor understands it at a glance, much less scrolling), 12 (billing only on app.hangulroute.com; hangulroute.com is intro and guide only) and 13 (user-friendly overall). Items 9, 10, 11 and 14 appear on the site only as short, truthful lines that switch on when the features they describe are live (section 3.9, "claims").

**Scope**: `apps/web` (route groups `(en)` and `(loc)/[locale]` only: a new home body, three new persona pages, header and footer, `data/site-routes.json`, `lib/site-links.ts`, `data/site-claims.ts`, `lib/site-telemetry.ts`, a postbuild step that writes the site-only output `out-site/` with `_redirects`, `robots.txt` and `sitemap.xml`; `wrangler.toml` points at `out-site/` in the last PR) · `packages/i18n` (`landing.nav`, new `landing.home`, `landing.persona`, `landing.plans`; old landing keys removed at the end) · `packages/content-schema` (three `site.*` telemetry names) · `packages/backend` (a payload allow-list for `site.*` telemetry, like the one for `space.transfer.*`) · `.github/workflows/preview-deploy.yml` (checks of `out-site/`) · docs (F-CONSOLE-001 §3.6, F-I18N-001 §3.4 note, `docs/roadmap/TELEMETRY-NAMES-2.md`, `docs/launch/web-app-launch.md`)
**Not in scope**: anything that renders on app.hangulroute.com. Where the grown-up console, sign-in and billing live on the app host, and how the learner PWA's service worker leaves them alone, is owned by the companion specs of the same owner request (persona app shell, branch `docs/persona-app-shell`; billing for every persona, branch `docs/billing-in-app-all-personas`). This spec consumes one contract from them (section 3.8) and never edits `apps/mobile`, the API's `CONSOLE_URL`, Clerk settings or Stripe.
**Owner**: solo dev
**Rollout**: every PR before S-10 changes only what hangulroute.com shows; the console keeps working at hangulroute.com/teach exactly as today. S-10 (the flip) switches the Worker to the site-only output and turns on the redirects; it waits for the companion spec's "console is live on app.hangulroute.com" milestone. Rollback of the flip is one revert.
**Wireframes** (drafted with this spec): `design/wireframes/site/home.md` · `design/wireframes/site/learners.md` · `design/wireframes/site/parents.md` · `design/wireframes/site/teachers.md` · `design/wireframes/site/header-footer.md`

Parent / siblings: CLAUDE.md §1 (any age; child safety; anti-shame; UI languages) · F-I18N-001 §3.3 (`?lang=` hand-off), §3.4 (site routes, string rules, PR 11b route groups, prune of hidden locales), L10 (legal English-authoritative) · F-CONSOLE-001 §3.6 (landing nav, **amended** here), §3.7 (static export) · F-ENT-001 §3.5, §3.6 (billing is web-only and behind sign-in) · F-AUTH-002 (console sign-in) · F-PWA-001 §3.2 (telemetry intake) · F-SPACE-002 (server-side payload filter precedent) · `docs/launch/waitlist.md` (launch-news form) · companion specs of the 2026-10-11 request (persona app shell; billing for every persona; progress reports; feedback channel; free plan and unlocked curriculum; LEARNING ROUTE; adult content browser)

---

## 1. Problem

Facts on `origin/main` `ea9049e4` and on the live site (2026-10-11):

1. **One site does two jobs.** `apps/web` is one Next static export (`next.config.js:6`, `output: 'export'`) served by one assets Worker, `hangul-route-web` (`apps/web/wrangler.toml:16-23`), on hangulroute.com. It serves the marketing pages (`app/(en)`, `app/(loc)/[locale]`) **and** the whole grown-up console (`app/(console)/teach/*`, including `/teach/billing`), plus a `/parent` demo on mock data (`app/(console)/parent/*`, `data/mock-family.ts`). The landing header and footer link to both (`LandingPage.tsx:117-120`, `:629-634`). The owner wants the marketing site to explain and guide only, and every account action on app.hangulroute.com.
2. **The page is too long and flat.** `/` is 1,132 visible words (1,295 with the folded FAQ answers), 7 H2s, 13 H3s and 36 tiles. At 375 x 812 it is 13,427 px tall, about 16.5 screens; at 1280 x 800 it is 5,621 px, about 7 screens. The Stage 1 card grid alone (all 24 cards, `HeritageCardsPreview.tsx`) is about 4,800 px, 36 % of the page.
3. **No first-glance answer and no persona routing.** The hero names the audience but not what you get; about 75 % of the page speaks to learners; parents get one section (`#parents`); teachers get no explanation at all, only a "For teachers" link into the console sign-in. There is no "Sign in" entry, and nothing tells a parent or teacher where to go next.
4. **Some lines promise more than is built or than the documents support.** The meta description and "How it works" say "7 stages x 5 culture themes" while only Stage 1 is built (`messages/en/landing.ts:36`, `:83`); "COPPA-compliant" is stated as a trust claim (`landing.ts:71`) while the Privacy Policy and Terms are drafts awaiting counsel; the Privacy Policy and Terms say subscriptions are billed through the App Store and Google Play, but the only checkout is Stripe on the web console; five Stage 1 card blurbs shown on the public page use "kids" or "children" (`data/stage1-cards.ts:26,27,38,46,49`), which the audience guard does not scan.
5. **Nothing measures the site.** The site sends no telemetry, so nobody knows whether visitors find their persona page or the app.

## 2. Goals and non-goals

### 2.1 Goals

- **G1 — Two roles, one sentence each.** hangulroute.com explains what Hangul Route is and who it is for, and sends each visitor to the app. app.hangulroute.com is where anyone learns, signs in, manages plans and pays. After S-10 the marketing Worker serves no console page, no billing page and no demo; old console URLs redirect to the app host.
- **G2 — At a glance.** On the first screen of `/` at 320 x 568 a visitor sees: what it is (one heading), what you do (one sentence), and the primary action. At 375 x 812 the persona chooser starts on the first screen or one short scroll below it.
- **G3 — Layered, not long.** Four levels (section 3.1): L0 hero, L1 persona chooser and three short blocks, L2 one short page per persona, L3 details behind native disclosure or on a linked page. Hard budgets, enforced by e2e (section 3.11): `/` at most 3,250 px tall at 375 x 812 (4 screens) and at most 350 visible words; each persona page at most 4,060 px (5 screens) and at most 550 visible words.
- **G4 — A page per persona.** `/learners`, `/parents`, `/teachers` (and `/es/...`, `/ko/...` when those locales ship), each with one primary action that fits that persona.
- **G5 — Every account action on the app host.** Every "Start", "Sign in", "Plans" and "Billing" link on the site goes through one table, `lib/site-links.ts` (section 3.8). Before S-10 its grown-up links stay on the same origin (today's `/teach`); S-10 points them at app.hangulroute.com in one change.
- **G6 — Promise only what is live.** Feature lines on the site are tied to a typed claims table (`data/site-claims.ts`, section 3.9). A line about reports, notes, the LEARNING ROUTE, browsing lessons as a learner, or a new free-plan boundary appears only when the companion spec that builds it flips its claim in the same PR that ships the feature.
- **G7 — Keep what works.** Legal pages, About, the launch-news form, the i18n route groups and hidden-locale pruning from F-I18N-001 PR 11b, `?lang=` hand-off, the "no prices on the site" rule, and every child-safety promise stay.
- **G8 — Learn whether it works, without tracking anyone.** Three anonymous, cookie-less `site.*` events (section 7) answer "do visitors reach their persona page and the app?"

### 2.2 Non-goals

- No change to app.hangulroute.com: the console's new home, the persona sign-in chooser, the service-worker denylist, billing pages, the API `CONSOLE_URL`, Clerk origins and Stripe return URLs belong to the companion specs.
- No prices, no plan amounts, no checkout and no "Buy" button on hangulroute.com, ever (owner item 12; OD-7). The site may say what plans exist and that they live in the app.
- No new legal text beyond factual corrections (S-7); the documents stay English-authoritative drafts under their banner (F-I18N-001 L10).
- No es / ko copy: new strings are English; es and ko stay hidden until their native review (F-I18N-001 §3.4). The routes for them exist and are pruned like today.
- No blog, no help centre, no search, no chat widget, no cookie banner (the site sets no cookies).
- No visual redesign of tokens or brand: the design pass (S-D) uses the existing tokens.

## 3. Detailed behaviour

### 3.1 Information architecture (four levels)

```
L0  /  hero ............ what it is (h1) + what you do (1 sentence) + [[Start learning]] + "Parent or teacher? Start here"
L1  /  persona chooser . Learners | Parents | Teachers  (3 cards, 1 line each, each one link to L2)
    /  how it works .... 3 steps, 1 line each
    /  promises ........ 4 short items
    /  cost ............ 1 line (no price)
    /  questions ....... 4 folded questions (L3)
    /  launch news ..... email form (unchanged API)
L2  /learners  /parents  /teachers   one short page each: lead + primary action, 3-5 sections of 1-3 lines,
                                     2-3 folded questions, closing action
L3  <details> inside L2 (all 24 cards, the mini-games, more questions) · /about · /privacy · /terms
```

Rules for every level:

1. One primary action per page, visually the largest. On `/` and `/learners` it is **Start learning** (learner app). On `/parents` it is **Sign in as a parent**, on `/teachers` **Sign in as a teacher** (both through `site-links.ts`), each with **Start learning** as the secondary action.
2. A section has a heading and at most three lines or three bullets visible. Anything longer goes behind a `<details>` (native, works without JavaScript) or onto an L2 page.
3. No section repeats another page's content. `/` links to an L2 page instead of summarising it twice.
4. Every L2 page ends with the same closing block: one line and its primary action.
5. Counts shown on a page come from data (`stage1Cards.length`, the mini-game catalogue), never from typed numbers in copy, as the card and game headings already do (`landing.ts:98`, `:110`).

### 3.2 Header and footer (all site pages)

Wireframe: `design/wireframes/site/header-footer.md`.

- **Header, DOM order = visual order at every width** (WCAG 2.4.3; `globals.css` never uses `order`, as today): skip link "Skip to content" (visible on focus) · brand (link to the locale home) · primary `Start learning` (`siteLinks.learnerStart(locale)`) · nav `Learners` `Parents` `Teachers` (links to L2 pages through `sitePath`) · `Sign in` (grown-up sign-in, `siteLinks.signIn()`). Start stays next to the brand at every width, as "Play now" does today (`LandingPage.tsx:79-121`), so one DOM order serves phone and wide.
- The current page's nav link carries `aria-current="page"`.
- Removed from the header: the anchors `#cards`, `#games`, `#parents`, the `Dashboard` link to `/parent` and the `For teachers` link to `/teach` (F-CONSOLE-001 §3.6 is amended in S-5: the landing no longer links into the console directly; grown-ups reach it through "Sign in").
- Below 720 px the header wraps to two rows (brand + Start learning; nav + Sign in) with no horizontal scroll; no hamburger menu (no JavaScript needed, no hidden navigation).
- **Footer** (three short groups): *Guide* — Learners, Parents, Teachers · *Company* — About, Privacy, Terms, Contact (`hello@hangulroute.com`, `data/contact.ts`) · *App* — Start learning, Sign in. Then the copyright line and the locale switcher (`LocaleSwitcher`, unchanged: shown only once a second locale ships). Removed: "Heritage cards", "Mini-games" anchors, "Parent dashboard" (`/parent`) and "Teacher console" (`/teach`).
- Every link and button on the site, new or changed, has a hit area of at least `touchTarget.min` (64) by 64 (padding, not font size). The ratchet in `e2e/fixtures/landing-touch-allowlist.json` only shrinks: no line is added; lines for controls that are gone or now large are removed in the PR that changes them.
- Links between the site and anything outside the site route groups (the console before S-10, the app) are plain `<a>`, never `next/link` (F-I18N-001 §3.4 "As shipped in PR 11b"; `route-groups.test.tsx` enforces it). Links to the app open in the same tab.

### 3.3 Home `/` (L0 and L1)

Wireframe: `design/wireframes/site/home.md`. Strings: appendix B.1.

Order (each block is one `<section>` with a heading; the hero heading is the page's only `h1`):

1. **Hero (L0).** h1 = the tagline ("Learn Hangul from zero, at any age."). One sentence of what you do. Primary `Start learning` (learner app, with `?lang=` from `/es` or `/ko` as today, `appEntryUrl`). Secondary text link "Parent or teacher? Start here" to `#who` (in-page). Facts line (three short facts, unchanged meaning: runs in the browser, no ads, works offline after the first visit). Hoya waving art (decorative, `aria-hidden`), with the speech bubble that passes the taught letter in (`FIRST_LETTER`, F-I18N-001 §3.4 rule 5) and stays as today.
2. **Who is it for? (`#who`, L1).** Three persona cards in a list: Learners, Parents, Teachers. Each card is a single link (whole card clickable) to its L2 page, with a title and one line. Accessible name = title + line. On wide screens three columns; at under 720 px one column.
3. **How it works (L1).** Three numbered steps, one line each: start in the browser; learn in five-minute quests; collect culture cards and keep going. When the `learningRoute` claim is on, step 3's line becomes the LEARNING ROUTE variant (appendix B.1).
4. **Promises (L1).** Four items, title + one line: No ads, ever · Child safety first (replaces "COPPA-compliant", OD-4) · Works offline · No red marks. Heading visually hidden ("Our promises").
5. **What does it cost? (L1).** One line from the `freePlan` and `paidPlans` claims (section 3.9). Today: "Stage 1 is free. More stages and classroom plans are coming." No price, ever.
6. **Common questions (L3 inside L1).** Four `<details>`: who it is for; adult beginners; do I need any Korean; how long is a session. ("What makes this different" and "How much does it cost" leave the home: cost is block 5.)
7. **Launch news (`#news`).** Heading, one line, the existing `WaitlistForm` (same API, same `source: 'landing'`, same consent line and `CONSENT_TEXT_VERSION`; `docs/launch/waitlist.md` stays true). The section's old "Play now — free" button and devices line are dropped (the header and hero already carry the action).
8. Footer.

Removed from `/`: the audience badges, the trust strip's long bodies, the 24-card grid (moves to `/learners` behind `<details>`), the mini-games gallery (moves to `/learners` behind `<details>`), Meet Hoya (a short version moves to `/learners`), the For parents section (becomes `/parents`), the pricing aside (becomes block 5), two FAQ items.

### 3.4 Learners `/learners` (L2)

Wireframe: `design/wireframes/site/learners.md`. Strings: appendix B.2. Audience: anyone learning, any age (no age words, no "kids").

1. h1 "For learners" + one-line lead + primary `Start learning`.
2. **What you learn first.** One line on Stage 1 (the Korean alphabet: letters, their sounds, building syllables) and three bullets: Read, Listen, Write (tracing). No speaking line anywhere (owner decision 2026-10-10).
3. **How a quest works.** Three bullets: Discover (see and hear the letter), Play (mini-games), Check (gentle: wrong answers get an amber nudge and Hoya thinking, never red). `<details>` "See the mini-games" holds `MiniGamesGallery` (unchanged component, counts from the catalogue).
4. **Collect Korean culture.** One line + a row of six card tiles (the first six of `stage1Cards`) + `<details>` "See all {n} Stage 1 cards" holding the full `HeritageCardsPreview` grid. Closed by default, so its height does not count in the budget.
5. **Meet Hoya.** Two lines and the small art (a trimmed `MeetHoya`: title + one body line + the three points folded into one line each).
6. **Your LEARNING ROUTE** — only when the `learningRoute` claim is on: one line ("One map shows where you started, where you are and what comes next.").
7. **Learning with a class or family?** One line: ask your teacher or parent for the join code and enter it in the app.
8. Two folded questions (do I need an account; does it work offline) + closing block.

### 3.5 Parents `/parents` (L2)

Wireframe: `design/wireframes/site/parents.md`. Strings: appendix B.3. Caregiver surface: may address parents directly (CLAUDE.md §1), still no age range.

1. h1 "For parents" + lead + primary `Sign in as a parent` (`siteLinks.signIn('parent')`) + secondary `Start learning`.
2. **What they learn.** One line + link "What learners do" to `/learners`.
3. **Safe by design.** Three bullets, each a promise already made on today's landing and already guarded by `landing-claims.test.tsx`: no ads and no data sold; learning data stays on the device until a grown-up signs in; a grown-up gate guards anything that costs money or deletes data. Plus "Siblings can share a device; each learner keeps their own stars and cards."
4. **Follow along.** Base line (true today on the console's family space): "Create a free family space, share its code, and see each learner's week: time practiced, quests done and letters to revisit together." Extra lines, each behind its claim: `parentReports` (daily, weekly, monthly reports with what went well and what to practise next) · `feedbackNotes` (send a short note of encouragement) · `browseAsLearner` (browse every lesson exactly as your learner sees it; owner request item 14).
5. **Plans.** The cost line (section 3.9) + "Plans and billing are managed in the app after you sign in." No price.
6. Three folded questions: does my learner need an account (no: learners never need an email or password); can I learn alongside them (keeps the pinned sentence "Learning Korean yourself? Play the same quests."); what can I see (the base line, plus the report line when its claim is on).
7. Closing block with `Sign in as a parent`.

### 3.6 Teachers `/teachers` (L2)

Wireframe: `design/wireframes/site/teachers.md`. Strings: appendix B.4.

1. h1 "For teachers" + lead + primary `Sign in as a teacher` (`siteLinks.signIn('teacher')`) + secondary `Start learning` ("Try it as a learner").
2. **Set up in minutes.** Three numbered steps: sign in and create a class space; share the class code (students enter it in the app; no student emails or accounts); students learn on any device with a browser.
3. **Plan and assign.** Two lines (true today: plan builder F-PLAN-001, term planner F-PLAN-002): pick quests for the week and they appear on each student's homework list; or let the planner build a term route from your class level and rhythm.
4. **See how the class is doing.** Base line (true today, `rollup.ts`): a weekly view shows who practised and which letters to revisit together; never a ranking. Extra lines behind claims: `teacherReports` (per-student and whole-class reports for any week or month) · `feedbackNotes` (send students a short note) · `browseAsLearner` (preview every lesson as students see it) · `lectureMode` (teach from the front on a projector or TV; F-TCH-004).
5. **Privacy for classes.** Two bullets: show initials only on the class list (anonymize setting, F-TCH-001); no ads and no data sold.
6. **Plans.** Cost line + the same "managed in the app" line.
7. Three folded questions: do students need accounts; is there a leaderboard (no: Hangul Route never ranks students against each other); can I try it first (yes, play as a learner).
8. Closing block with `Sign in as a teacher`.

### 3.7 About, Privacy, Terms, 404

- `/about`, `/privacy`, `/terms` keep their bodies and get the new header and footer. About's "Back home" link stays.
- S-7 makes only factual corrections to the drafts, English-authoritative (L10), banner kept: payments for paid plans are made on the web through Stripe after a grown-up signs in to the app (not through the App Store or Google Play); the site counts page views anonymously with no cookies, identifiers or third parties (section 7). Gated by OD-13.
- The exported 404 page (`app/not-found.tsx`) gains links to `/` and `Start learning` (English document, as today).

### 3.8 One table for every link to the app (`apps/web/src/lib/site-links.ts`, S-2)

Pure module, 100 % unit-tested, the only place the site spells an app URL or a grown-up path. Its constants live in `apps/web/src/data/site-routes.json`, so the postbuild script of 3.10 reads the same values without TypeScript:

```json
{
  "defaultGrownUpOrigin": "",
  "redirectStatus": 302,
  "paths": { "signIn": "/teach", "billing": "/teach/billing", "parentHome": "/parent", "teacherHome": "/teach/home" },
  "redirects": [
    { "from": "/teach", "to": "{origin}/teach" },
    { "from": "/teach/*", "to": "{origin}/teach/:splat" },
    { "from": "/parent", "to": "{origin}{parentHome}" },
    { "from": "/parent/*", "to": "{origin}{parentHome}" },
    { "from": "/design-preview/*", "to": "{origin}/design-preview/:splat" }
  ]
}
```

```ts
export type GrownUpPersona = 'parent' | 'teacher';
export const GROWN_UP_PATHS = routes.paths;   // signIn (today: console sign-in, F-AUTH-002), billing (F-ENT-001 §3.6),
                                              // parentHome (companion spec), teacherHome
export function grownUpOrigin(env?): string;            // NEXT_PUBLIC_GROWN_UP_ORIGIN, trimmed, no trailing slash; '' = same origin
export function learnerStart(locale: UiLocale): string;  // appEntryUrl(appUrl(), locale) — unchanged behaviour
export function signIn(persona?: GrownUpPersona): string; // `${grownUpOrigin()}${GROWN_UP_PATHS.signIn}` + `?as=<persona>` when given
export function billing(): string;
export function redirects(env?): ReadonlyArray<{ from: string; to: string; status: 302 | 301 }>; // section 3.10, `{origin}` and `{parentHome}` filled in
```

- **Contract with the persona app shell spec.** That spec owns the paths on app.hangulroute.com. If its paths differ from `GROWN_UP_PATHS`, the PR that makes them live changes these constants (one line each) and the unit test's expected table; nothing else in the site changes. `?as=parent|teacher` is a hint the app may use to preselect the persona and must ignore when unknown (the site never depends on it).
- **Before S-10**, `defaultGrownUpOrigin` is `""` and `NEXT_PUBLIC_GROWN_UP_ORIGIN` is unset on the production build, so `signIn()` is the same-origin `/teach` (the console as today). **S-10** sets `defaultGrownUpOrigin` to `https://app.hangulroute.com` (the variable still overrides it for previews). The redirect status (302, later 301, OD-3) is a field of the same file.
- Learners never sign in: "Sign in" is for grown-ups. The learner action is always `learnerStart`.

### 3.9 Claims: feature lines appear only when the feature is live (`apps/web/src/data/site-claims.ts`, S-2)

```ts
export interface SiteClaims {
  freePlan: 'stage1' | 'firstDays';       // which free-plan line the site shows
  paidPlans: 'coming' | 'inApp';          // "coming" until Stripe Live is on (owner), then "see plans in the app"
  learningRoute: boolean;                 // LEARNING ROUTE screen is on for every learner in production
  parentReports: boolean;                 // period reports for parents are live
  teacherReports: boolean;                // per-student and class reports are live
  feedbackNotes: boolean;                 // grown-up to learner notes are live
  browseAsLearner: boolean;               // paying grown-ups can browse lessons as a learner sees them
  lectureMode: boolean;                   // F-TCH-004 presenter is on in production
}
export const SITE_CLAIMS: SiteClaims = { freePlan: 'stage1', paidPlans: 'coming', learningRoute: false,
  parentReports: false, teacherReports: false, feedbackNotes: false, browseAsLearner: false, lectureMode: false };
```

- A code constant, not an environment variable, so tests pin every state and a claim cannot be switched on by a stray build variable.
- **Hand-off rule.** The companion spec's flag-flip PR (the one that turns the feature on in production) flips its claim in `site-claims.ts` in the same PR; that PR's checklist names this section. A claim is never flipped ahead of the feature.
- Page components take `claims` as a prop defaulting to `SITE_CLAIMS`, so unit tests render every state.
- With every claim at its default the pages are complete: no empty section, no "coming soon" teaser for an unbuilt feature (only the existing "more stages and classroom plans are coming" cost line).
- `paidPlans: 'inApp'` waits for the owner turning on Stripe Live (standing rule); until then the line stays "coming" even though sandbox checkout exists on the console.
- `freePlan: 'firstDays'` is flipped by the free-plan companion spec when its boundary ships, because "Stage 1 is free" stops being exact then (OD-6 holds the wording).

### 3.10 The site-only output and the redirects (S-9 builds, S-10 switches)

- **S-9** adds `apps/web/scripts/build-site-surface.mjs`, run after `prune-hidden-locales.mjs` in `pnpm build`. It copies from `out/` to `out-site/` only: the site pages (`index.html`, `about.html`, `privacy.html`, `terms.html`, `learners.html`, `parents.html`, `teachers.html`, and the shipped locale copies), `404.html`, `_next/`, `_headers`, any public assets; never `teach*`, `parent*` or `design-preview*`. It then writes:
  - `out-site/_redirects` from `apps/web/src/data/site-routes.json` (section 3.8: the one file both `site-links.ts`, through `resolveJsonModule` in `tsconfig.base.json`, and this plain Node script, through `JSON.parse(readFileSync(...))`, read; the origin is `NEXT_PUBLIC_GROWN_UP_ORIGIN` when set, else the file's `defaultGrownUpOrigin`; the unit test compares the written file to the table);
  - `out-site/robots.txt` (`Allow: /`, sitemap line) and `out-site/sitemap.xml` (every exported site page in every shown locale, absolute URLs on `SITE_URL`).
  - With an empty origin (every build before S-10 that does not set `NEXT_PUBLIC_GROWN_UP_ORIGIN`) it writes **no** `_redirects` (a same-origin rule would loop) and prints one line saying so; `preview-deploy.yml` runs a second `build-site-surface.mjs` pass with `NEXT_PUBLIC_GROWN_UP_ORIGIN=https://app.hangulroute.com` into a scratch directory to check the rules the flip will ship.
  - It fails the build if `out-site/` contains a console path, if a redirect source collides with a site page, or if `_redirects` exceeds the platform limits (2,000 static rules; we use fewer than 10).
- `out/` stays complete (the console build and every existing CI check keep working), so S-9 changes nothing in production.
- **Redirect table** (status from OD-3, default **302** for the first 30 days, then **301** in S-11):

| From (hangulroute.com) | To | Why |
|---|---|---|
| `/teach` | `{grownUpOrigin}/teach` | old sign-in bookmarks, Clerk `afterSignOutUrl` from older builds |
| `/teach/*` | `{grownUpOrigin}/teach/:splat` | console deep links, the learner app's paywall link (`apps/mobile/src/logic/paywall.ts:48-55`) until its companion change ships, Stripe success / cancel / portal returns of sessions started before the API's `CONSOLE_URL` changes |
| `/parent` and `/parent/*` | `{grownUpOrigin}{GROWN_UP_PATHS.parentHome}` | the demo goes away; parents land on the real parent home |
| `/design-preview/*` | `{grownUpOrigin}/design-preview/:splat` | internal contact sheets (F-PREV-001) follow the console |

  Query strings must survive (`?checkout=success`, `?id=`). Cloudflare static-asset redirects are expected to keep the query string; S-9's preview verification step checks it on a `*.workers.dev` preview (assumption a). If it does not hold, S-9 instead exports tiny stub pages at those paths that call `location.replace(target + location.search + location.hash)` with a `<noscript>` link (no visible copy beyond "Opening the app" and the link; strings in `landing.redirect`).
- **S-10** (the flip): `apps/web/wrangler.toml` `[assets] directory = "./out-site"`; `site-routes.json` `defaultGrownUpOrigin` = `https://app.hangulroute.com`; `preview-deploy.yml` dry run uses the new directory. The console itself is then served on the app host by whatever the persona app shell spec chose; **the `hangul-route-web` Worker must not be the one serving the console on the app host**, because `_redirects` cannot match on host and would loop (contract; the companion spec confirms it in its PR table).
- Gate for S-10, all three: (1) the companion milestone "console live on app.hangulroute.com" is verified in production by signing in there; (2) a preview of the `out-site/` Worker shows each redirect row landing on the app with its query; (3) the owner has not answered OD-2 with different paths, or `GROWN_UP_PATHS` already carries the answer.

### 3.11 Length and glance budgets (enforced)

`apps/web/e2e/site-budgets.spec.ts` (new, S-4 for persona pages, S-5 for `/`), over the static export, Chromium:

| Page | Height at 375 x 812 | Height at 1280 x 800 | Visible words (`innerText`, folded `<details>` closed) | First screen at 320 x 568 contains |
|---|---|---|---|---|
| `/` | at most 3,250 px | at most 2,400 px | at most 350 | the `h1`, the one-sentence lead, `Start learning` |
| `/learners`, `/parents`, `/teachers` | at most 4,060 px | at most 3,200 px | at most 550 | the `h1`, the lead, the page's primary action |

- Heights are measured on the real export, so with the claims as they are in `SITE_CLAIMS`. To leave room for claim lines that switch on later, the export must also stay under a **headroom budget** while claims are off: `/` at most 3,000 px and each persona page at most 3,700 px at 375 x 812. Each claim-flip PR (section 9.2, "claim hand-offs") runs this spec with its claim on, so the full budget is checked again at that moment.
- Words are also checked without a browser: `app/__tests__/site-word-budget.test.tsx` renders each page with `ALL_CLAIMS_ON` (a test fixture, never imported by a page) through `renderToStaticMarkup`, strips folded `<details>` bodies, and asserts the word budgets above. No build variable switches claims, so a production build can never show an unlaunched claim.
- `landing-layout.spec.ts` keeps its checks (no sideways scroll at 320 / 375 / 768, Tab order = visual order) and its `PAGES` list gains the three persona pages; its "Play now visible" check becomes "Start learning visible".

### 3.12 Copy truth pass

- Metadata (`landing.meta`): description and Open Graph lines drop "7 stages and 5 culture themes" and "8 mini-games" counts typed into copy; they say what is built (Stage 1, Korean culture cards, Hoya, no ads). New per-page titles and descriptions for the three persona pages (`siteMetadataFor` gains the pages; `SITE_PAGES` extends, so hreflang alternates cover them when a locale ships).
- "COPPA-compliant" becomes "Child safety first" with the body "No third-party tracking or ads. A grown-up gate guards anything that costs money or deletes data." (OD-4).
- Stage 1 card blurbs (`data/stage1-cards.ts`) lose audience wording while staying accurate (OD-9; S-6, content-skill review): gangaji "One of the first words heard in many Korean homes."; nabi "A tiny flying flower that flutters through many Korean songs."; paengi "Wooden tops spun on frozen ground in winter."; usan "Korea's rainy season lasts about a month. Keep one by the door."; ibul "Many Korean homes spread padded blankets on a warm floor to sleep." `audience-copy.test.ts` adds `data/stage1-cards.ts` and the three persona pages to `PUBLIC_SURFACES`.

## 4. Data and API (additive only)

- **No D1 migration, no new route.** The site stays a static export.
- **Telemetry (S-1, Worker first).** `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts`) appends three names (section 7). `packages/backend/src/routes/telemetry.ts` gains a payload allow-list for the `site.` prefix, built the same way as `TRANSFER_PAYLOAD_VALUES` (`telemetry.ts:45-60`): only known keys with known values are kept, `profileId` is always dropped for `site.*`, anything else is discarded. The route already accepts anonymous callers and CORS already allows hangulroute.com (`packages/backend/src/lib/cors.ts`).
- **Waitlist**: unchanged (`POST /api/waitlist`, `source: 'landing'`).
- **Config**: one new build variable, `NEXT_PUBLIC_GROWN_UP_ORIGIN` (optional; read only in `site-links.ts` through `buildEnv()`-style literal access, `lib/console/config.ts:20-30` pattern).
- **Not touched**: API `CONSOLE_URL`, `ALLOWED_ORIGINS`, Clerk, Stripe, `apps/mobile` env (`EXPO_PUBLIC_CONSOLE_URL`), the learner app's `/privacy` link (Privacy stays on hangulroute.com).

## 5. i18n

All strings go through `packages/i18n` (`messages/en/landing.ts`); English is the source; es and ko overlays stay empty and the locales hidden (F-I18N-001 §3.4). Taught Korean is passed in, never written into a message (rule 5). No Hangul in `en` / `es` messages (tested). Plurals through `plural`.

New and changed keys (S-3 adds; old keys are removed only in S-6, after no page reads them):

| Key | Kind | Notes |
|---|---|---|
| `landing.nav.{label, learners, parents, teachers, signIn, start, skip, current}` | strings | `current` is the visually hidden "(current page)" suffix where `aria-current` is not announced |
| `landing.home.hero.{title, lead, start, grownUps, facts}` and `landing.home.hero.bubble(letter)` | strings + 1 function | `title` = `landing.meta.tagline` value |
| `landing.home.who.{title, items.{learners,parents,teachers}.{title, body, linkLabel}}` | strings | |
| `landing.home.how.{title, steps.{start,quests,collect}.{title, body}, routeBody}` | strings | `routeBody` only with `learningRoute` |
| `landing.home.promises.{label, items.{ads,safety,offline,noRed}.{title, body}}` | strings | |
| `landing.home.faq.{title, items.{who,adult,korean,session}.{q,a}}` | strings | answers reuse today's English |
| `landing.home.news.{title, body}` | strings | the form keeps `landing.waitlist` |
| `landing.plans.{title, free.{stage1, firstDays}, paid.{coming, inApp}, managedInApp}` | strings | the only cost words on the site |
| `landing.persona.learners.*`, `landing.persona.parents.*`, `landing.persona.teachers.*` | strings + count functions | appendix B.2 to B.4; `cards.seeAll(n)` uses `plural` |
| `landing.persona.closing.{learners, parents, teachers}` | strings | closing block lines |
| `landing.footer.{guide, app}` | strings | group headings added; `cards`, `games`, `dashboard`, `console` removed in S-6 |
| `landing.notFound.{body, home, start}` | strings | 404 links |
| `landing.redirect.{opening, link}` | strings | only if the stub fallback of 3.10 is used |
| `landing.meta.pages.{learners,parents,teachers}.{title, description}` | strings | per-page metadata |

- `length-budget.test.ts` gets budgets for nav labels (at most 14 characters in `en`, room for es / ko growth) and persona card bodies (at most 90 characters).
- `landing-banned.ts` (shared by `landing-messages.test.ts` and `audience-copy.test.ts`) gains no new pattern; the existing commercial-claim patterns of `landing-claims.test.tsx` now scan all seven site pages.
- `messages/review-ledger.json`: removed keys are removed from the ledger in S-6 (es / ko have no entries yet, so nothing to re-review).

## 6. Accessibility

- One `h1` per page; headings in order; landmarks `header`, `nav` (labelled "Main"), `main` (id `content`, the skip-link target), `footer`.
- Skip link first in Tab order, visible on focus, at least 64 x 64.
- Persona cards: one link each, accessible name = title + line; focus ring on the whole card (`:focus-visible`, token colour).
- `<details>` / `<summary>` for every fold: keyboard and screen-reader support without JavaScript; the summary text names what opens ("See all 24 Stage 1 cards").
- Tab order equals visual order at 320, 375, 768 and 1280 (e2e, existing helper).
- 200 % text zoom at 320 px: no horizontal scroll, no clipped CTA (e2e at 320 with `font-size: 200%` on `html`).
- Contrast: token pairs only (`text.primary` / `surface.paper`, `text.onPrimary` / `brand.primary`); no new colour.
- Decorative art (`HoyaSvg`) `aria-hidden`; the taught letter in Hoya's bubble keeps its romanization in the sentence.
- Link purpose is clear from the link text alone ("For parents", "Sign in as a teacher"); no "Learn more", no "Click here".
- No motion added; anything animated respects `prefers-reduced-motion`.
- `lang` is correct in the static HTML of every page (F-I18N-001 §3.4).

## 7. Privacy, safety and telemetry

### 7.1 Privacy and child safety

- The site sets **no cookies**, uses **no `localStorage` or `sessionStorage`**, loads **no third-party script, font or pixel**, and shows **no ads**.
- Nothing on the site asks for a learner's data. The only input stays the launch-news email (grown-up, consent line unchanged, `docs/launch/waitlist.md`).
- No age wording and no kids-only framing on any site page (CLAUDE.md §1; `audience-copy.test.ts` extended to the new pages and to `data/stage1-cards.ts`). Parent and teacher pages address grown-ups directly, still without an age range.
- Anti-shame: no page shows or promises a ranking, a leaderboard or a learner-vs-learner comparison; the teacher page says so plainly.
- No student name in any URL (the site has none; the `/parent/<demo slug>` pages leave the site in S-10).
- Child-safety promises shown are only those already true and already tested: local-first until a grown-up signs in, the grown-up gate, no ads, siblings keep their own progress.

### 7.2 Telemetry (Worker first)

Three names, appended to `TELEMETRY_EVENT_NAMES` in S-1 and deployed to the Worker before S-8 emits them (`docs/roadmap/TELEMETRY-NAMES-2.md` rule 1; S-1 adds a section for them):

| Name | Payload (allow-listed keys and values; anything else dropped by the Worker) | When |
|---|---|---|
| `site.page_viewed` | `{ page: 'home' \| 'learners' \| 'parents' \| 'teachers' \| 'about' \| 'privacy' \| 'terms' \| 'not_found', locale: 'en' \| 'es' \| 'ko' }` | once per page load |
| `site.cta_tapped` | `{ cta: 'start' \| 'sign_in' \| 'persona' \| 'news_submitted', page: <as above>, place: 'header' \| 'hero' \| 'who' \| 'section' \| 'closing' \| 'footer', persona?: 'learners' \| 'parents' \| 'teachers' }` | on activation of a tracked link or a successful launch-news submit |
| `site.fold_opened` | `{ fold: 'faq_who' \| 'faq_adult' \| 'faq_korean' \| 'faq_session' \| 'cards_all' \| 'games_all' \| 'faq_account' \| 'faq_offline' \| 'faq_learn_along' \| 'faq_what_see' \| 'faq_students' \| 'faq_ranking' \| 'faq_try', page }` | first open of a `<details>` per page load |

Sender (`lib/site-telemetry.ts`, S-2 pure, S-8 wired):

- `fetch(`${apiBaseUrl()}/api/telemetry`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ name, payload, at }) })`: a CORS "simple" request, so no preflight; the route parses the body as JSON regardless of content type (assumption b, verified by a backend test in S-1).
- Sends **nothing** when `navigator.globalPrivacyControl === true`, when `navigator.doNotTrack === '1'`, when no API base is configured (local, tests, previews without the variable), or when JavaScript is off.
- No identifier of any kind: no `profileId`, no session id, no device id, no referrer, no URL query, no user agent field. Failures are swallowed; nothing is retried or queued.
- Link clicks are never delayed for telemetry (`keepalive` lets the request finish after navigation).
- The Worker keeps events only in its capped in-memory log (no D1 table, no read route, audit SEC-3), as for every other name.

## 8. Tests

TDD: each PR's tests are written first and fail before the implementation.

| Area | Test | PR |
|---|---|---|
| Names | `packages/content-schema/src/__tests__/telemetry.test.ts` exact list + the three names | S-1 |
| Worker filter | `packages/backend/src/__tests__/telemetry.test.ts`: `site.*` keeps only allow-listed keys and values, drops `profileId`, accepts a `text/plain` JSON body, still 422 for unknown names | S-1 |
| Links | `lib/__tests__/site-links.test.ts`: same-origin default, env origin trimmed, `?as=` only for known personas, `learnerStart` equals today's `appEntryUrl` output for en / es / ko, `redirects()` exact for both origins | S-2 |
| Claims | `data/__tests__/site-claims.test.ts`: defaults exact; `ALL_CLAIMS_ON` fixture covers every key; no page module imports the fixture | S-2 |
| Telemetry sender | `lib/__tests__/site-telemetry.test.ts`: GPC, DNT, no API base, payload shape, no identifiers, errors swallowed | S-2 |
| Strings | `packages/i18n` landing tests: no Hangul in en, banned words, length budgets, plural forms | S-3 |
| Persona pages | `app/__tests__/persona-pages.test.tsx`: each page renders one `h1`, its primary action href from `site-links`, every claim off (no empty section) and every claim on (each claim line present exactly once), no `/teach` or `/parent` literal outside `site-links` | S-4 |
| Route groups | `route-groups.test.tsx` covers the new pages in `(en)` and `(loc)/[locale]`; no crossing `next/link` | S-4 |
| Home | `landing-layout.test.tsx`, `landing-claims.test.tsx` (pinned cost sentence stays on `/`; "Learning Korean yourself? Play the same quests." moves to `/parents`; the commercial-claim scan runs on all seven pages and the metadata), `landing-no-emoji`, `landing-pseudo`, `audience-copy` (new surfaces) | S-4, S-5 |
| Locales | `landing-locales.test.tsx`: `SITE_PAGES` has seven pages; hreflang alternates for the new pages on a QA build; hidden-locale pages are pruned | S-4 |
| Budgets | `site-budgets.spec.ts` heights and first screen (e2e) and `site-word-budget.test.tsx` words with every claim on (section 3.11) | S-4, S-5 |
| Layout (e2e) | `landing-layout.spec.ts` with seven pages; `landing-locales.spec.ts` touch ratchet (allowlist shrinks only) | S-4, S-5 |
| Telemetry wiring | `app/__tests__/site-telemetry-wiring.test.tsx`: tracked controls carry the right `data-` codes; one `page_viewed` per load (jsdom) | S-8 |
| Site output | `scripts/__tests__/build-site-surface.test.mjs` (run by `pnpm run test:scripts`): copies only site files, writes `_redirects` equal to `redirects()` for the same `site-routes.json`, `robots.txt`, `sitemap.xml`; fails on a console file or a colliding redirect | S-9 |
| CI | `preview-deploy.yml`: `out-site/index.html`, `learners.html`, `parents.html`, `teachers.html` exist; `out-site/teach*`, `parent*`, `design-preview*` absent; `_redirects` lines match | S-9 |
| Flip | `wrangler.toml` directory; `site-links` default origin; redirect table points at app.hangulroute.com | S-10 |

Coverage: `apps/web` new `lib/` and `data/` modules at 100 % lines (pure); page components covered by the render tests above; no drop against `docs/tests/coverage-targets.md`.

## 9. PR breakdown

### 9.1 Milestones

| Milestone | What a visitor sees at the end | PRs | Production effect |
|---|---|---|---|
| **M1 "Short and layered"** | a one-screen hero, the persona chooser, three persona pages, a header with Sign in and Start learning, every console link gone from the site's pages (Sign in still opens today's `/teach`) | S-0, S-2, S-3, S-4, S-5, S-6, S-D | site pages only; the console keeps working |
| **M2 "Measured and truthful"** | the same, with corrected legal facts and anonymous page counts | S-1, S-7, S-8 | one Worker deploy (S-1) before S-8 |
| **M3 "Two hosts, two roles"** | hangulroute.com serves only the intro site; `/teach`, `/parent` and their deep links land on app.hangulroute.com | S-9, S-10, S-11 | the flip (S-10) after the companion milestone |

### 9.2 PR table

| PR | Content | Size | Needs |
|---|---|---|---|
| S-0 | `docs`: this spec and the five wireframes in `design/wireframes/site/` | S | — |
| S-1 | `feat(content-schema,backend)`: three `site.*` names; Worker payload allow-list for `site.*` (drops `profileId`); `text/plain` JSON body test; `TELEMETRY-NAMES-2.md` new section. **Deploy the Worker before S-8 merges** | S | S-0 |
| S-2 | `feat(web)`: `data/site-routes.json`, `lib/site-links.ts`, `data/site-claims.ts`, `lib/site-telemetry.ts` (pure; not wired), tests | S | S-0 |
| S-3 | `feat(i18n)`: new English keys of section 5 (appendix B), length budgets; no key removed | M | S-0 |
| S-D | `design`: mock of the home hero, persona card and persona page (existing tokens only) in `design/screens/site/` | S | S-0 (wireframes) |
| S-4 | `feat(web)`: `/learners`, `/parents`, `/teachers` in `(en)` and `(loc)/[locale]`; shared `SiteHeader` / `SiteFooter` used by these pages; `SITE_PAGES` and metadata extended; cards and games folds; tests and budgets for the three pages; audience and route-group lists | L | S-2, S-3, S-D |
| S-5 | `feat(web)`: new home body (section 3.3) and the shared header and footer on `/`, About, Privacy, Terms, 404; console links removed from site pages; `landing-claims` / `landing-layout` / e2e updates; touch allowlist shrinks; F-CONSOLE-001 §3.6 amended; F-I18N-001 §3.4 note (seven site pages) | M | S-4 |
| S-6 | `chore(web,i18n)`: remove unused components and keys (`landing.trust`, `landing.how`, old `nav` / `footer` / `parents` / `pricing` / `faq.items.{different,cost}`, audience badges), review ledger; metadata truth pass (3.12); card blurbs (OD-9, content-skill review) | S | S-5, OD-9 |
| S-7 | `docs(web)`: Privacy and Terms factual corrections (3.7), English-authoritative, banner kept | S | OD-13 |
| S-8 | `feat(web)`: wire `site-telemetry` into the seven pages (page view, tracked CTAs, first fold open) | S | S-1 deployed, S-5, S-7 merged, OD-5 |
| S-9 | `feat(web,ci)`: `scripts/build-site-surface.mjs` writes `out-site/` with `_redirects`, `robots.txt`, `sitemap.xml`; `preview-deploy.yml` checks; preview verification of query-preserving redirects (else the stub fallback) | M | S-5 |
| S-10 | `feat(web)`: the flip — `wrangler.toml` serves `./out-site`; `site-routes.json` `defaultGrownUpOrigin` = `https://app.hangulroute.com`; `web-app-launch.md` and `owner-runbook.md` updated | S | S-9; companion milestone "console live on app.hangulroute.com" verified in production; OD-2 answer or default in `GROWN_UP_PATHS`; OD-3 |
| S-11 | `chore(web)`: `site-routes.json` redirect status 302 to 301 after 30 days without a path change | XS | S-10 + 30 days, OD-3 |

**Claim hand-offs (not PRs of this spec):** each companion spec's flag-flip PR flips one line of `SITE_CLAIMS` with its copy test — LEARNING ROUTE (`learningRoute`), progress reports (`parentReports`, `teacherReports`), feedback channel (`feedbackNotes`), adult content browser (`browseAsLearner`), free plan (`freePlan: 'firstDays'`), F-TCH-004 R-flip (`lectureMode`); Stripe Live (owner) flips `paidPlans: 'inApp'`.

### 9.3 Sequence notes

- S-2, S-3 and S-1 can run in parallel. S-4 and S-5 edit `landing.ts`, `LandingPage.tsx` and the landing tests that F-I18N-001 PR 14 / 16 may also touch; keep edits additive until S-6.
- S-1 appends to the shared `TELEMETRY_EVENT_NAMES` array and its exact-list test; rebase conflicts with sibling specs are mechanical (append, never reorder).
- S-10 is the only PR that changes what hangulroute.com serves for console paths. Rollback: revert S-10 (the Worker serves `out/` again and the site's Sign in goes back to same-origin `/teach`).

## 10. Dependencies

- **On main:** F-I18N-001 PR 11a / 11b / 11c (route groups, `sitePath`, `appEntryUrl`, hidden-locale prune); `WaitlistForm` and `/api/waitlist`; F-CONSOLE-001 static export; `/api/telemetry` (anonymous, CORS allows hangulroute.com).
- **Companion specs (same owner request, written in parallel):** persona app shell (console and sign-in on app.hangulroute.com; the contract of 3.8 and 3.10; gates S-10) · billing for every persona (API `CONSOLE_URL`, paywall link; not a gate for S-10 because the redirects cover old URLs) · progress reports, feedback channel, free plan, LEARNING ROUTE, adult content browser (claim hand-offs only).
- **External:** owner answers (section 11; defaults apply); a `*.workers.dev` preview of `out-site/` for S-9 / S-10 verification (Workers Builds preview, no local wrangler needed).

## 11. Owner decisions (each has a default; each gates only the PRs named)

| Id | Question | Default (applies until answered) | Gates | Reversible |
|---|---|---|---|---|
| OD-1 | Persona page names and paths | `/learners` "For learners" (any age; the teacher page says "students"), `/parents`, `/teachers` | S-3, S-4 | yes (paths + strings) |
| OD-2 | Paths on app.hangulroute.com for grown-up sign-in, billing and the parent home | `/teach`, `/teach/billing`, `/parent` (today's console paths), with an `?as=parent\|teacher` hint; the persona app shell spec may replace them in `GROWN_UP_PATHS` | S-10 | yes (one constant) |
| OD-3 | Redirect status | 302 for the first 30 days after S-10, then 301 (S-11) | S-10, S-11 | yes |
| OD-4 | "COPPA-compliant" on the public site while the legal documents are drafts | replace with "Child safety first" + "No third-party tracking or ads. A grown-up gate guards anything that costs money or deletes data."; restore a compliance claim only after counsel signs off | S-3, S-5 | yes |
| OD-5 | Anonymous site telemetry | on: three `site.*` names, no cookies, no identifiers, nothing sent under GPC or Do Not Track | S-8 | yes (S-8 can be reverted alone) |
| OD-6 | Free-plan wording once the "about day 2" boundary ships | "Start free: your first two days of lessons are free." (`landing.plans.free.firstDays`); until then "Stage 1 is free. More stages and classroom plans are coming." | the free-plan spec's claim flip | yes |
| OD-7 | Prices on hangulroute.com | never: the site names plans without amounts and says they are managed in the app | — (rule) | yes |
| OD-8 | Launch-news form after launch | keep a short "Get the launch news" block on `/` only, same API and consent line | S-5 | yes |
| OD-9 | Stage 1 card blurbs that say "kids" / "children" | reword the five blurbs as in 3.12 (accuracy kept, content-skill review) | S-6 | yes |
| OD-10 | `/design-preview/*` | leaves hangulroute.com with the console; redirected to the grown-up origin | S-9, S-10 | yes |
| OD-11 | Remember the visitor's persona between visits | no (the site stores nothing) | — | yes |
| OD-12 | What "Sign in" means on the site | grown-ups only (parents, teachers); learners use "Start learning" and join a class or family with a code inside the app | S-3, S-5 | yes |
| OD-13 | Factual corrections in the draft Privacy Policy and Terms (Stripe web billing; anonymous page counts) | make them, keep the draft banner, flag for counsel in the PR | S-7 (and so S-8) | yes |

**Assumptions to verify** (with the PR that verifies each):

| # | Assumption | Verified in |
|---|---|---|
| a | Cloudflare static-asset `_redirects` with `:splat` keeps the query string | S-9 preview (else stub fallback, 3.10) |
| b | `POST /api/telemetry` parses a `text/plain` JSON body (Hono `c.req.json()` does not check the content type) | S-1 backend test |
| c | The companion spec does not serve the console on the app host from the `hangul-route-web` Worker | S-10 gate |
| d | `/` fits 3,250 px at 375 x 812 with the 64 px touch floor on footer links | S-5 e2e (if not, the footer groups fold into one `<details>` "More links" on narrow screens) |
| e | Removing `/teach` and `/parent` links from site pages before S-10 is acceptable because "Sign in" still reaches `/teach` | S-5 review |

## 12. Out of scope

Console, sign-in chooser and billing on app.hangulroute.com; the service-worker denylist and manifest scope of the learner PWA; API `CONSOLE_URL`, Clerk and Stripe settings; es / ko translations; real prices; a help centre or blog; A/B testing; cookie consent tooling (no cookies are set).

## Appendix A — what each persona page answers

| Page | The question it answers in one look | Primary action | What it never does |
|---|---|---|---|
| `/` | What is this and is it for me? | Start learning | explain any persona in depth |
| `/learners` | What will I do and learn? | Start learning | mention age, price or accounts |
| `/parents` | Is it safe, what will I see, what does it cost? | Sign in as a parent | show a price, compare learners |
| `/teachers` | How do I run it with a class? | Sign in as a teacher | promise a feature that is not live, rank students |

## Appendix B — English strings (S-3 writes these into `messages/en/landing.ts`)

### B.1 Home

- nav: label "Main" · learners "Learners" · parents "Parents" · teachers "Teachers" · signIn "Sign in" · start "Start learning" · skip "Skip to content" · current "(current page)"
- hero.title "Learn Hangul from zero, at any age."
- hero.lead "Short, playful quests teach you to read, hear and write the Korean alphabet, with Hoya the tiger as your guide."
- hero.start "Start learning" · hero.grownUps "Parent or teacher? Start here"
- hero.facts "Runs in your browser · No ads · Works offline after your first visit"
- hero.bubble(letter) "Annyeong! Let's meet {letter}."
- who.title "Who is it for?"
- who.learners: title "Learners" · body "Five-minute quests, a guide who never scolds, and Korean culture cards to collect." · linkLabel "For learners"
- who.parents: title "Parents" · body "See what your learner practises, with a grown-up gate and no ads." · linkLabel "For parents"
- who.teachers: title "Teachers" · body "Students join with a class code. No student emails, no accounts." · linkLabel "For teachers"
- how.title "How it works"
- how.start: "Open the app" · "Nothing to install. Choose who is learning and begin."
- how.quests: "Learn in five-minute quests" · "Letters, sounds and first words, with sound and pictures on every screen."
- how.collect: "Collect and keep going" · "Earn Korean culture cards. Your progress stays on your device."
- how.routeBody "Earn Korean culture cards and see your whole LEARNING ROUTE: where you are and what comes next."
- promises.label "Our promises"
- promises.ads "No ads, ever" · "No third-party ads. No data sold."
- promises.safety "Child safety first" · "No third-party tracking or ads. A grown-up gate guards anything that costs money or deletes data."
- promises.offline "Works offline" · "After your first visit the app opens without a connection."
- promises.noRed "No red marks" · "Wrong answers get an amber nudge from Hoya. Never a frown."
- plans.title "What does it cost?"
- plans.free.stage1 "Stage 1 is free. More stages and classroom plans are coming."
- plans.free.firstDays "Start free: your first two days of lessons are free."
- plans.paid.coming "Plans for families and classes are coming."
- plans.paid.inApp "Plans for families and classes are in the app."
- plans.managedInApp "Plans and billing are managed in the app after you sign in."
- faq.title "Common questions"; items who / adult / korean / session: today's questions and answers (`landing.faq.items.*`), with the "who" answer unchanged.
- news.title "Get the launch news" · news.body "Leave your email and we'll send you the launch news. Nothing else."

### B.2 Learners

- title "For learners" · lead "Learn to read, hear and write Hangul, one five-minute quest at a time."
- learn.title "What you learn first" · learn.body "Stage 1 is the Korean alphabet: the letters, their sounds and how they build syllables." · bullets "Read letters and syllables" / "Listen and match sounds" / "Write letters by tracing them"
- quest.title "How a quest works" · bullets "Discover: see and hear a new letter." / "Play: short mini-games that use it." / "Check: a gentle round. Wrong answers get an amber nudge, never red." · gamesFold "See the mini-games"
- cards.title "Collect Korean culture" · cards.body "Every letter you learn earns a card: a piece of Korean food, art or everyday life." · cards.seeAll(n) "See all {n} Stage 1 cards" (plural)
- hoya.title "Meet Hoya" · hoya.body "Hoya is a young tiger and your guide. Hoya cheers you on and never says “wrong.”"
- route.title "Your LEARNING ROUTE" · route.body "One map shows where you started, where you are and what comes next."
- code.title "Learning with a class or family?" · code.body "Ask your teacher or parent for the join code, then enter it in the app."
- faq: account "Do I need an account?" / "No. Open the app and start. A grown-up can link progress later." · offline "Does it work offline?" / "Yes. After your first visit the app opens without a connection."
- closing "Ready for your first letter?"

### B.3 Parents

- title "For parents" · lead "Short, kind lessons that keep your learner's data private. Here is what they do and what you can see." · signIn "Sign in as a parent"
- learn.title "What they learn" · learn.body "The Korean alphabet first: reading, listening and writing, in five-minute quests." · learn.link "What learners do"
- safe.title "Safe by design" · bullets "No ads, and no data sold." / "Learning data stays on the device until a grown-up signs in." / "A grown-up gate guards anything that costs money or deletes data." / "Siblings can share a device. Each learner keeps their own stars and cards."
- follow.title "Follow along" · follow.body "Create a free family space, share its code, and see each learner's week: time practised, quests done and letters to revisit together."
- follow.reports "Daily, weekly and monthly reports show what went well and what to practise next."
- follow.notes "Send a short note of encouragement that your learner sees in the app."
- follow.browse "Browse every lesson exactly as your learner sees it."
- faq: account "Does my learner need an account?" / "No. Learners never need an email or a password." · learnAlong "Can I learn alongside them?" / "Yes. Learning Korean yourself? Play the same quests." · whatSee "What can I see?" / follow.body (and follow.reports when its claim is on)
- closing "See your learner's week in one place."

### B.4 Teachers

- title "For teachers" · lead "Students join with a code, you plan the week, and everyone learns at their own pace." · signIn "Sign in as a teacher" · tryIt "Try it as a learner"
- setup.title "Set up in minutes" · steps "Sign in and create a class space." / "Share the class code. Students enter it in the app; no student emails or accounts." / "Students learn on any device with a browser."
- plan.title "Plan and assign" · bullets "Pick quests for the week. They appear on each student's homework list." / "Or let the planner build a term route from your class level and rhythm."
- class.title "See how the class is doing" · class.body "A weekly view shows who practised and which letters to revisit together. Never a ranking."
- class.reports "Per-student and whole-class reports for any week or month."
- class.notes "Send students a short note of encouragement."
- class.browse "Preview every lesson exactly as students see it."
- class.lecture "Teach from the front on a projector or TV."
- privacy.title "Privacy for classes" · bullets "Show initials only on the class list." / "No ads, and no data sold."
- faq: students "Do students need accounts?" / "No. They join with the class code inside the app." · ranking "Is there a leaderboard?" / "No. Hangul Route never ranks students against each other." · try "Can I try it first?" / "Yes. Open the app and play the first quests as a learner."
- closing "Bring Hangul to your class this week."

## Review log

- 2026-10-11: drafted from the owner request and the five current-system readers (marketing site, domains and deploy, learner app, console, entitlements, reports data); self-reviewed against CLAUDE.md §1 (audience, safety, anti-shame, languages, no speaking), the pricing rule (no amounts, no commercial claims), F-I18N-001 §3.4 (route groups, plain `<a>` across groups, hidden-locale prune) and the touch-target ratchet.
