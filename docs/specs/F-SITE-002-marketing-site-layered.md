Status: ready

# F-SITE-002 — hangulroute.com becomes a short, layered intro site (one-screen hero, three persona pages, every account action on app.hangulroute.com)

> **Status note.** `ready` means the spec can be built PR by PR in the order of section 9. Owner decisions do **not** gate the whole spec: each one gates only the PRs named in section 11, and each has a default that applies until the owner answers. Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` below is at that commit. Live measurements are from hangulroute.com on 2026-10-11 (headless Chromium). Revised the same day after two reviews (review log at the end).
>
> **Owner request (2026-10-11), items this spec implements:** 1 (hangulroute.com and app.hangulroute.com get clearly separate roles), 2 (hangulroute.com is an intro and guide site only, with the right explanation for each persona, layered so a first-time visitor understands it at a glance, much less scrolling), 12 (billing only on app.hangulroute.com; hangulroute.com is intro and guide only) and 13 (user-friendly overall). Items 4, 6, 7, 9, 10, 11 and 14 appear on the site only as short, truthful lines that switch on when the features they describe are live (section 3.9, "claims").

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a design mock and a wireframe)**

| Can start when | PR | Waits for what | Why |
|---|---|---|---|
| now | S-0 docs, S-3 strings, S-D design | — | docs, English strings, mocks from the wireframes of this PR |
| after F-APP-001 A-1 merged | S-2 link and claim tables | `APP_ROUTES`, `APP_ORIGIN` in `packages/content-schema` | the site spells no app path itself |
| after F-APP-001 A-4 merged, S-2, S-3, S-D | S-4a, S-4b, S-5 | `/signin` with `?persona=` intros exists in the same Next export | every grown-up link on the site goes to `/signin?persona=…` |
| after S-5 | S-6, S-9 | — | cleanup; robots and sitemap |
| OD-13 | S-7 | — | legal drafts |
| last | S-10 | F-APP-001 M3 live and verified; ships with F-APP-001 A-10 | the code default follows the owner's build variable |

**Scope**: `apps/web` (route groups `(en)` and `(loc)/[locale]` only: a new home body, three new persona pages, `SiteHeader` / `SiteFooter`, `lib/site-links.ts`, `data/site-claims.ts`, `app/robots.ts`, `app/sitemap.ts`, one `env` line in `next.config.js`) · `packages/i18n` (`landing.nav`, new `landing.home`, `landing.persona`, `landing.plans`; old landing keys removed at the end) · `.github/workflows/preview-deploy.yml` (file checks over `out/`) · docs (F-CONSOLE-001 §3.6, F-I18N-001 §3.4 note, `docs/launch/web-app-launch.md`)
**Not in scope**: anything that renders on app.hangulroute.com, and **what hangulroute.com does with old grown-up URLs** (`/teach*`, `/parent*`): F-APP-001 §3.13 owns that with redirect stub pages (A-8, behind the site build variable `CONSOLE_ORIGIN`), and F-BILL-002 §4.1 adds its `/teach/billing` forwarder inside the console code that those stubs replace on the site. This spec builds **no** separate site output folder and **no** `_redirects` file (section 3.10). It never edits `apps/mobile`, the API's `CONSOLE_URL` / `BILLING_URL`, Clerk settings or Stripe, and adds no telemetry.
**Owner**: solo dev
**Rollout**: every PR changes only the pages of the site route groups. Grown-up links go to `/signin?persona=…` on the same origin until the owner sets `CONSOLE_ORIGIN=https://app.hangulroute.com` on the site build (F-APP-001 M3, owner step S-3); from then the same build variable sends the site's links **and** F-APP-001's stubs to the app host together. S-10 makes that origin the code default in the same release as F-APP-001 A-10. Rollback of any PR is one revert.
**Wireframes** (drafted with this spec, revised after review): `design/wireframes/site/home.md` · `design/wireframes/site/learners.md` · `design/wireframes/site/parents.md` · `design/wireframes/site/teachers.md` · `design/wireframes/site/header-footer.md`

Parent / siblings: CLAUDE.md §1 (any age; child safety; anti-shame; UI languages) · F-I18N-001 §3.3 (`?lang=` hand-off), §3.4 (site routes, string rules, PR 11b route groups, prune of hidden locales), L10 (legal English-authoritative) · F-CONSOLE-001 §3.6 (landing nav, **amended** here), §3.7 (static export) · F-ENT-001 §3.5, §3.6 (billing behind sign-in; native in-app purchase plan) · F-SPACE-001 §3.5 (a learner joins a class or family with a code) · `docs/launch/waitlist.md` (launch-news form) · companion specs of the 2026-10-11 request: **F-APP-001** persona app shell (`docs/persona-app-shell`) · **F-BILL-002** billing for every persona (`docs/billing-in-app-all-personas`) · **F-REPORT-001** progress reports (`docs/progress-reports`) · **F-FEEDBACK-001** notes from grown-ups (`docs/adult-feedback-channel`) · **F-ENT-003** free plan, all of Stage 1 (`docs/free-day2-unlocked-curriculum`) · **AMENDMENTS-ROUTE-LEARNING-ROUTE** to F-ROUTE-001 (`docs/learning-route`) · **F-BROWSE-001** lesson browser for grown-ups (`docs/adult-content-browser`)

---

## 1. Problem

Facts on `origin/main` `ea9049e4` and on the live site (2026-10-11):

1. **One site does two jobs.** `apps/web` is one Next static export (`next.config.js:6`, `output: 'export'`) served by one assets Worker, `hangul-route-web` (`apps/web/wrangler.toml:16-23`), on hangulroute.com. It serves the marketing pages (`app/(en)`, `app/(loc)/[locale]`) **and** the whole grown-up console (`app/(console)/teach/*`, including `/teach/billing`), plus a `/parent` demo on mock data (`app/(console)/parent/*`, `data/mock-family.ts`). The landing header and footer link to both (`LandingPage.tsx:117-120`, `:629-634`). The owner wants the marketing site to explain and guide only, and every account action on app.hangulroute.com.
2. **The page is too long and flat.** `/` is 1,132 visible words (1,295 with the folded FAQ answers), 7 H2s, 13 H3s and 36 tiles. At 375 x 812 it is 13,427 px tall, about 16.5 screens; at 1280 x 800 it is 5,621 px, about 7 screens. The Stage 1 card grid alone (all 24 cards, `HeritageCardsPreview.tsx`) is about 4,800 px, 36 % of the page.
3. **No first-glance answer and no persona routing.** The hero names the audience but not what you get; about 75 % of the page speaks to learners; parents get one section (`#parents`); teachers get no explanation at all, only a "For teachers" link into the console sign-in. There is no "Sign in" entry, and nothing tells a parent or teacher where to go next.
4. **Some lines promise more than is built or than the documents support.** The meta description and "How it works" say "7 stages x 5 culture themes" while only Stage 1 is built (`messages/en/landing.ts:36`, `:83`); "COPPA-compliant" is stated as a trust claim (`landing.ts:71`) while the Privacy Policy and Terms are drafts awaiting counsel; "All learning data stays on the device until you sign in" (`landing.ts:137`) is not true for a learner who joins a class with a code (F-SPACE-001 §3.5: the device registers and syncs a summary to the teacher's roster with no grown-up signed in on it); the Privacy Policy and Terms describe App Store and Google Play billing only (`landing.ts:322`, `:379-381`) while the only checkout today is Stripe on the web console; five Stage 1 card blurbs shown on the public page use "kids" or "children" (`data/stage1-cards.ts:26,27,38,46,49`), which the audience guard does not scan.

## 2. Goals and non-goals

### 2.1 Goals

- **G1 — Two roles, one sentence each.** hangulroute.com explains what Hangul Route is and who it is for, and sends each visitor to the app. app.hangulroute.com is where anyone learns, signs in, manages plans and pays. The site's own pages never link to a console page, a billing page or the demo. Old console URLs are forwarded by F-APP-001's stubs (section 3.10).
- **G2 — At a glance.** On the first screen of `/` at 320 x 568, header included, a visitor sees: what it is (one heading), what you do (one sentence), and the primary action. The phone header is one row (section 3.2). At 375 x 812 the persona chooser starts on the first screen or one short scroll below it.
- **G3 — Layered, not short of answers.** Four levels (section 3.1): L0 hero, L1 persona chooser and three short blocks, L2 one short page per persona, L3 details behind native disclosure or on a linked page. Hard budgets, enforced by tests (section 3.11): `/` at most 2,900 px tall at 375 x 812 (about 3.5 screens, against 16.5 today) and at most 280 visible words; each persona page at most 4,060 px (5 screens) and at most 550 visible words.
- **G4 — A page per persona.** `/learners`, `/parents`, `/teachers` (and `/es/...`, `/ko/...` when those locales ship), each with one primary action that fits that persona.
- **G5 — Every account action on the app host.** Every "Start learning" and "Sign in" link on the site comes from one module, `lib/site-links.ts` (section 3.8), which takes its paths from F-APP-001's `APP_ROUTES` and its origin from F-APP-001's site build variable `CONSOLE_ORIGIN`. The site never links to billing (F-BILL-002 §4.1).
- **G6 — Promise only what is live.** Feature lines on the site are tied to a typed claims table (`data/site-claims.ts`, section 3.9). A line about reports, notes, the Learning Route, or browsing lessons as a learner appears only when the companion spec that builds it flips its claim in the same PR that turns the feature on in production. The free-plan line "Stage 1 is free." is true before and after F-ENT-003 turns its free boundary on (F-ENT-003 OD-1: the free plan is all of Stage 1), so it never flips. A line about a paid feature also needs paid plans to be on sale (Stripe Live).
- **G7 — Keep what works.** Legal pages, About, the launch-news form, the i18n route groups and hidden-locale pruning from F-I18N-001 PR 11b, `?lang=` hand-off, the locale banner, the "no prices on the site" rule, and every child-safety promise stay.
- **G8 — Learn whether it works, without tracking anyone.** Page counts come from Cloudflare's own request analytics for the hangulroute.com zone, read by the owner in the Cloudflare dashboard (Analytics, HTTP traffic, by path). The site adds no client script, no cookie, no identifier and no telemetry event (OD-5, assumption c).

### 2.2 Non-goals

- No change to app.hangulroute.com: the persona sign-in and homes (F-APP-001), billing (F-BILL-002), the service-worker denylist, the API `CONSOLE_URL`, Clerk origins and Stripe return URLs belong to the companion specs.
- No forwarding of old grown-up URLs on hangulroute.com (F-APP-001 §3.13 A-8; F-BILL-002 §4.1).
- No prices, no plan amounts, no checkout, no billing link and no "Buy" button on hangulroute.com, ever (owner item 12; OD-7). The site may say what plans exist and that they are managed at app.hangulroute.com.
- No new legal text beyond factual corrections (S-7); the documents stay English-authoritative drafts under their banner (F-I18N-001 L10).
- No es / ko copy: new strings are English; es and ko stay hidden until their native review (F-I18N-001 §3.4). The routes for them exist and are pruned like today.
- No blog, no help centre, no search, no chat widget, no cookie banner (the site sets no cookies), no analytics script.
- No visual redesign of tokens or brand: the design pass (S-D) uses the existing tokens.

## 3. Detailed behaviour

### 3.1 Information architecture (four levels)

```
L0  /  hero ............ what it is (h1) + what you do (1 sentence) + [[Start learning]] + "Parent or teacher? Find your page"
L1  /  persona chooser . Learners | Parents | Teachers  (3 cards, 1 line each, each one link to L2)
    /  how it works .... 3 steps, 1 line each
    /  promises ........ 3 short titles
    /  cost ............ 1 line (no price)
    /  launch news ..... email form (unchanged API)
L2  /learners  /parents  /teachers   one short page each: lead + primary action, 3-5 sections of 1-3 lines,
                                     2-5 folded questions, closing action
L3  <details> inside L2 (all 24 cards, the mini-games, the questions) · /about · /privacy · /terms
```

Rules for every level:

1. One primary action per page, visually the largest. On `/` and `/learners` it is **Start learning** (learner app). On `/parents` it is **Sign in as a parent**, on `/teachers` **Sign in as a teacher** (both through `site-links.ts`), each with **Start learning** as the secondary action.
2. A section has a heading and at most three lines or four bullets visible. Anything longer goes behind a `<details>` (native, works without JavaScript) or onto an L2 page.
3. No section repeats another section's content, on the same page or another page. `/` links to an L2 page instead of summarising it twice (so `/` has no questions block and its promises are titles only; the detail lives on the L2 pages).
4. Every L2 page ends with the same closing block: one line and its primary action.
5. Counts shown on a page come from data (`stage1Cards.length`, the mini-game catalogue), never from typed numbers in copy, as the card and game headings already do (`landing.ts:98`, `:110`).

### 3.2 Header and footer (all site pages)

Wireframe: `design/wireframes/site/header-footer.md`.

- **Header, DOM order = visual order at every width** (WCAG 2.4.3; `globals.css` never uses `order`, as today): skip link "Skip to content" (visible on focus) · brand (link to the locale home) · primary `Start learning` (`siteLinks.learnerStart(locale)`) · nav `Learners` `Parents` `Teachers` (links to L2 pages through `sitePath`) · `Sign in` (grown-up sign-in, `siteLinks.signIn()`).
- **Phone (below 720 px): one row** with the brand and `Sign in` only. `Start learning` and the three persona links are not rendered below 720 px (CSS `display: none` at the breakpoint, so they also leave the Tab order and the DOM order still equals the visual order). On phones a visitor reaches: the learner app through each page's first-screen primary action and the footer; the persona pages through the home hero's in-page link, the `#who` cards and the footer's Guide group. Nothing is hidden behind a menu (no hamburger, no JavaScript needed). Reason: four links with 64 px hit areas need about 330 px, more than the 288 px usable at 320 px, and the header would wrap to three rows before the h1; the persona choice would also appear three times on the home page.
- **Wide (720 px and up): one row** with every item.
- The current page's nav link carries `aria-current="page"` and a non-colour marker. No visually hidden "(current page)" suffix: every major screen reader announces `aria-current`, so a suffix would be read twice (S-3 review 3; `site-chrome.test.tsx` pins the link's accessible name as exactly its label).
- Removed from the header: the anchors `#cards`, `#games`, `#parents`, the `Dashboard` link to `/parent` and the `For teachers` link to `/teach` (F-CONSOLE-001 §3.6 is amended in S-5: the landing no longer links into the console directly; grown-ups reach it through "Sign in").
- **Footer** (three short groups; on phones two columns, Guide and App on the left, Company on the right): *Guide* — Learners, Parents, Teachers · *Company* — About, Privacy, Terms, Contact (`hello@hangulroute.com`, `data/contact.ts`) · *App* — Start learning, Sign in. Then the copyright line and the locale switcher (`LocaleSwitcher`, unchanged: shown only once a second locale ships). Removed: "Heritage cards", "Mini-games" anchors, "Parent dashboard" (`/parent`) and "Teacher console" (`/teach`).
- **Legal pages** (`/privacy`, `/terms`) use `SiteHeader variant="legal"` (brand and the persona links on wide screens; no `Sign in`, no `Start learning`) and a footer without the App group. The learner app, including the native builds, links to `/privacy`; a page it opens does not lead in one tap to sign-in and billing (App Review 3.1.1; OD-14).
- Every link and button on the site, new or changed, has a hit area of at least `touchTarget.min` (64) by 64 (padding, not font size). The ratchet in `e2e/fixtures/landing-touch-allowlist.json` only shrinks: no line is added; lines for controls that are gone or now large are removed in the PR that changes them. The one exception kept on purpose is the unchanged `WaitlistForm` on `/` (section 3.3 block 6): its field and button (48 px) and the two inline links of its consent line keep their existing lines (`input email`, `button submit`, `a mailto:hello@hangulroute.com`, and one `a /privacy`) until a later change to that component makes them 64 x 64; S-5 removes only the lines of the controls it replaces.
- Links between the site and anything outside the site route groups (the console, the app) are plain `<a>`, never `next/link` (F-I18N-001 §3.4 "As shipped in PR 11b"; `route-groups.test.tsx` enforces it). Links to the app open in the same tab.

### 3.3 Home `/` (L0 and L1)

Wireframe: `design/wireframes/site/home.md`. Strings: appendix B.1.

Order (each block is one `<section>` with a heading; the hero heading is the page's only `h1`):

1. **Hero (L0).** h1 = the tagline ("Learn Hangul from zero, at any age."). One sentence of what you do. Primary `Start learning` (learner app, with `?lang=` from `/es` or `/ko` as today, `appEntryUrl`). Secondary text link "Parent or teacher? Find your page" to `#who` (in-page). Facts line: "Runs in your browser · Nothing to install · The app works offline on most devices after your first visit". Hoya waving art (decorative, `aria-hidden`), with the speech bubble that passes the taught letter in with its romanization (`landing.home.hero.bubble(FIRST_LETTER, romanization)`, "Annyeong! Let's meet ㄱ (g/k)."; the romanization is the letter's teaching sound value, `JAMO_SOUND_VALUES['ㄱ'][0]` in `packages/content-schema`; CLAUDE.md §1, F-I18N-001 §3.4 rule 5). The locale banner (`LocaleBanner`, `lib/locale-banner.ts`) stays above the hero, unchanged.
2. **Who is it for? (`#who`, L1).** Three persona cards in a list: Learners, Parents, Teachers. Each card is a single link (whole card clickable) to its L2 page, with a title and one line. Accessible name = title + line. On wide screens three columns; under 720 px one column.
3. **How it works (L1).** Three numbered steps, one line each: open the app; learn in five-minute quests; collect culture cards and keep going. When the `learningRoute` claim is on, step 3's line becomes the Learning Route variant (appendix B.1).
4. **Promises (L1).** Three titles, no body: No ads, ever · Child safety first (replaces "COPPA-compliant", OD-4) · No red marks. Heading visually hidden ("Our promises"). The explanations live on `/parents` and `/learners` (rule 3). "Works offline" is not repeated here; the facts line carries it.
5. **What does it cost? (L1).** One line: the free line ("Stage 1 is free.", the same in every state, F-ENT-003 OD-1), then the paid line the `paidPlans` claim picks (section 3.9). Today: "Stage 1 is free. More stages are coming, with plans for families and classes." No price, ever, and no plan term: the signed-in billing page states that web plans renew yearly (BY-1), and the Terms will from S-7.
6. **Launch news (`#news`).** Heading, one line, the existing `WaitlistForm` (same API, same `source: 'landing'`, same consent line and `CONSENT_TEXT_VERSION`; `docs/launch/waitlist.md` stays true). The component is not changed: its consent and success lines are `text.onPrimary`, so the block keeps today's `brand.primary` band (`#get`) around the heading, the line and the form (design: `design/screens/site/home-hero.md`). The section's old "Play now — free" button and devices line are dropped (the header and hero already carry the action).
7. Footer.

Removed from `/`: the audience badges, the trust strip's long bodies, the 24-card grid (moves to `/learners` behind `<details>`), the mini-games gallery (moves to `/learners` behind `<details>`), Meet Hoya (one line moves to `/learners`), the For parents section (becomes `/parents`), the pricing aside (becomes block 5), the whole Common questions block (the "adult beginner" and "do I need Korean" answers move to `/learners`; "who is it for" is answered by `#who`; "how long is a session" by "five-minute quests"; "what makes this different" and "how much does it cost" are dropped, cost being block 5).

### 3.4 Learners `/learners` (L2)

Wireframe: `design/wireframes/site/learners.md`. Strings: appendix B.2. Audience: anyone learning, any age (no age words, no "kids").

1. h1 "For learners" + one-line lead + primary `Start learning`.
2. **What you learn first.** One line on Stage 1 (the Korean alphabet: letters, their sounds, building syllables) and three bullets: Read, Listen, Write (tracing). No speaking line anywhere (owner decision 2026-10-10).
3. **How most quests work.** Three bullets: Discover (see and hear the letter), Play (mini-games), Check (gentle: wrong answers get an amber nudge and Hoya thinking, never red). The heading says "most" because two Stage 1 quests (`quest:stage1-nature-q1`, `quest:stage1-crafts-q1`) have no Discover and Check steps until F-QUEST-002 Q-8 adds them; Q-8 may then drop the word (one string). One line with the small Hoya art: "Hoya the tiger guides every quest and never says “wrong.”" (replaces the Meet Hoya section). `<details>` "See the mini-games" holds `MiniGamesGallery` (unchanged component, counts from the catalogue).
4. **Collect Korean culture.** One line + a row of six card tiles (the first six of `stage1Cards`) + `<details>` "See all {n} Stage 1 cards" holding the full `HeritageCardsPreview` grid. Closed by default, so its height does not count in the budget.
5. **Your Learning Route** — only when the `learningRoute` claim is on: one line ("One map shows where you started, where you are and what comes next.").
6. Five folded questions: **Is there a sign-in for learners?** (no email or password; open the app and choose your profile, or enter a class or family code; moving to a new device uses a Rescue Code, F-APP-001 §3.5, F-RESTORE-001) · **I have a join code. Where do I enter it?** ("In the app: tap Profile, then go to Classes & family and tap Join a class.": the labels the learner taps, which `console.writeOnBoard` and the learner app's three-classes message `caregiver.audience.shared.joinCodeFull` also name) · **Does it work offline?** (qualified: most devices, a Korean voice may be needed for letter sounds) · **I'm an adult beginner. Will it feel too young?** (today's answer) · **Do I need to know any Korean?** (today's answer). Then the closing block.

Four sections with every claim off, five with `learningRoute` on (L2 rule: 3 to 5).

### 3.5 Parents `/parents` (L2)

Wireframe: `design/wireframes/site/parents.md`. Strings: appendix B.3. Caregiver surface: may address parents and caregivers directly (CLAUDE.md §1, P4 includes grandparents), still no age range.

1. h1 "For parents and caregivers" + lead (names grandparents and other caregivers) + primary `Sign in as a parent` (`siteLinks.signIn('parent')`) + secondary `Start learning`.
2. **What they learn.** One line + link "What learners do" to `/learners`.
3. **Safe by design.** Four bullets: no ads and no data sold; the backup sentence (`safe.bullets.backup`): each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code; a class or family the learner joins with a code sees the name they join with and their progress, and a family's grown-ups can also restore it; a grown-up gate guards anything that costs money or deletes data; siblings can share a device and each learner keeps their own stars and cards. The backup sentence is checked against the code (S-3 review 3): every learner profile and its progress syncs on start and after each write with no sign-in (F-SYNC-002), a Rescue Code is minted after the first cloud save (F-RESTORE-001), and family caregivers hold `snapshot.read` (`can.ts`), as the Privacy Policy's `progressWho` bullet says. S-3 pins it and cross-checks it with `progressWho`; S-4b pins the rendered page.
4. **Follow along.** Base line (true today on the console's family space): "Create a free family space, share its code, and see each learner's week: time practised, quests done and letters to revisit together." Extra lines, each behind its claim (section 3.9): `parentReports` (reports for today, this week, this month and all time, with what went well and what to practise next; F-REPORT-001) · `learningRoute` (open each learner's Learning Route; AMENDMENTS-ROUTE-LEARNING-ROUTE G6) · `feedbackNotes` (send a short note of encouragement; F-FEEDBACK-001) · `browseAsLearner` (with the Family Plan, browse every lesson exactly as your learner sees it; F-BROWSE-001; the product name the app's billing page uses, BY-1; paid line, shown only when `paidPlans` is `inApp`).
5. **Plans.** Two lines: the free line ("Stage 1 is free."), followed by the paid line `plans.paid.coming` only while `paidPlans` is `coming`; then "Plans and billing are managed at app.hangulroute.com after you sign in." (`plans.managedInApp`). With paid plans on sale the block is "Stage 1 is free." + the managed line, so the host is named once (rule 3; `plans.paid.inApp` is the home's line). No price, no billing link. S-3 pins both composed blocks.
6. Three folded questions: does my learner need an account (no: learners never need an email or password); can I learn alongside them (keeps the pinned sentence "Learning Korean yourself? Play the same quests."); what can I see (its own answer, `faq.whatSee.a`, "Each learner's week, in your family space after you sign in. Learners join it with your family code."; `faq.whatSee.reports` while `parentReports` is on; it never repeats the Follow along lines).
7. Closing block with `Sign in as a parent`.

### 3.6 Teachers `/teachers` (L2)

Wireframe: `design/wireframes/site/teachers.md`. Strings: appendix B.4.

1. h1 "For teachers" + lead + primary `Sign in as a teacher` (`siteLinks.signIn('teacher')`) + secondary `Start learning` ("Try it as a learner").
2. **Set up in minutes.** Three numbered steps: sign in and create a class space; share the class code (students enter it in the app; no student emails or accounts); students learn on any device with a browser.
3. **Plan and assign.** Two lines (true today: plan builder F-PLAN-001, term planner F-PLAN-002): pick quests for the week and they appear on each student's homework list; or let the planner build a term route from your class level and rhythm.
4. **See how the class is doing.** Base line (true today, `rollup.ts`): a weekly view shows who practised and which letters to revisit together; never a ranking. Extra lines behind claims: `teacherReports` (reports for each student and statistics for the whole class, by day, week, month or all time; never a ranking; F-REPORT-001) · `learningRoute` (open each student's Learning Route) · `feedbackNotes` (send students a short note) · `browseAsLearner` (with a class or school plan, preview every lesson exactly as students see it; paid line) · `lectureMode` (teach from the front on a projector or TV; F-TCH-004).
5. **Privacy for classes.** Two bullets: show initials only on the class list (anonymize setting, F-TCH-001); no ads and no data sold.
6. **Plans.** The same two lines as `/parents` (free line, `paid.coming` only while plans are coming, then the managed line).
7. Three folded questions: do students need accounts; is there a leaderboard (no: Hangul Route never ranks students against each other); can I try it first (yes, play as a learner).
8. Closing block with `Sign in as a teacher`.

### 3.7 About, Privacy, Terms, 404

- `/about` keeps its body and gets the new header and footer; About's "Back home" link stays. `/privacy` and `/terms` keep their bodies and get the legal header and footer variant (section 3.2).
- **S-7** makes only factual corrections to the drafts, English-authoritative (L10), banner kept, flagged for counsel in the PR (OD-13): "On the web, a grown-up pays through Stripe after signing in at app.hangulroute.com. In the iPhone and Android apps, purchases (when offered) go through the App Store or Google Play." plus, from `AMENDMENTS-BILLING-FAMILY-YEARLY.md` BY-D10 [BY]: "Plans bought on the web (the Family Plan and the Group License) renew every year until cancelled. Cancel any time in Billing, under Manage subscription; the plan stays active until the end of the year already paid." The store subscription-management and auto-renew paragraphs stay, marked as applying to in-app purchases (F-ENT-001 §3.5, F-IAP-002). No price is added to either document. No sentence about site analytics is added (the site adds none; section 7.2). S-7 also corrects the two Privacy Policy sentences that say learning data stays on the device until someone signs in (`legal.privacy.sections.short.paragraphs.p1`, "…until the account holder chooses to sign in", and `where.paragraphs.p1`, "If a parent signs in, progress syncs…"): the app backs up every learner's nickname, level, avatar and progress to our servers (Cloudflare) on start and after each write, with no sign-in, so it can be restored with a Rescue Code (F-SYNC-002, F-RESTORE-001; S-3 review 3). The wording agrees with `landing.persona.parents.safe.bullets.backup` and `progressWho`.
- The exported 404 page (`app/not-found.tsx`) gains links to `/` and `Start learning` (English document, as today).

### 3.8 One module for every link to the app (`apps/web/src/lib/site-links.ts`, S-2)

Pure module, 100 % unit-tested, the only place the site builds an app URL. It spells no path: paths come from F-APP-001's `APP_ROUTES` and the origin constant from `APP_ORIGIN` (`packages/content-schema/src/schemas/app-shell.ts`, F-APP-001 A-1).

```ts
import { APP_ORIGIN, APP_ROUTES } from '@hangul-route/content-schema';

export type GrownUpPersona = 'parent' | 'teacher';
/** '' until S-10, then APP_ORIGIN. A build with CONSOLE_ORIGIN set ignores it. */
export const SITE_DEFAULT_CONSOLE_ORIGIN: '' | typeof APP_ORIGIN = '';
export function grownUpOrigin(env?: { CONSOLE_ORIGIN?: string }): string; // CONSOLE_ORIGIN trimmed, no trailing slash; else the default; '' = same origin
export function learnerStart(locale: UiLocale): string;                     // appEntryUrl(appUrl(), locale), unchanged behaviour
export function signIn(persona?: GrownUpPersona): string;                   // `${grownUpOrigin()}${APP_ROUTES.signIn}` + `?persona=<persona>` when given
```

- **One build variable for links and stubs.** `CONSOLE_ORIGIN` is F-APP-001's site build variable (owner step S-3 of F-APP-001 §6.2). `next.config.js` gains `env: { CONSOLE_ORIGIN: process.env.CONSOLE_ORIGIN ?? '' }` so the value is inlined in server and client code alike. When the owner sets it, F-APP-001's stubs and the site's links move to the app host in the same deploy; when it is unset, both stay on the same origin. The site never has a link that points at a stub.
- **Before M3** (`CONSOLE_ORIGIN` unset, default `''`): `signIn('parent')` is `/signin?persona=parent` on hangulroute.com. That page is F-APP-001 A-4's `/signin`, which exists in the same Next export and therefore on whichever host serves the console; Clerk already works on hangulroute.com, and the grown-up lock is open there (the site origin holds no learner profiles). This is why S-4a, S-4b and S-5 need A-4 merged.
- **After M3**: `https://app.hangulroute.com/signin?persona=parent`, F-APP-001 §6.4 exactly.
- `?persona=parent|teacher` is F-APP-001 §3.7's hint: it picks the sign-in intro and preselects the role card on `/start`. The header and footer use `signIn()` with no hint (the neutral intro).
- **Never `/teach`, never `/parent`, never billing.** The unit test asserts that no output of the module starts with or contains `/teach`, `/parent`, `/account`, `/billing` or `APP_ROUTES.billing`, for both origins. So a parent who taps "Sign in as a parent" never passes through the teacher router (F-APP-001 §3.7 `/teach`), and the site has no billing link (F-BILL-002 §4.1).
- `persona-pages.test.tsx` and `landing-layout.test.tsx` assert that no page module contains a `/teach`, `/parent`, `/account` or `/billing` literal.
- Learners never sign in with an email or password (F-APP-001 OD-2). The learner action is always `learnerStart`; `/learners` explains how a learner picks a profile or uses a code (section 3.4).

### 3.9 Claims: feature lines appear only when the feature is live (`apps/web/src/data/site-claims.ts`, S-2)

```ts
export interface SiteClaims {
  freePlan: 'stage1';                     // the free-plan line: all of Stage 1 is free (F-ENT-003 OD-1, 2026-10-11)
  paidPlans: 'coming' | 'inApp';          // "coming" until the owner turns on Stripe Live, then "managed in the app"
  learningRoute: boolean;                 // Learning Route on for every learner and the grown-up read-only view live
  parentReports: boolean;                 // F-REPORT-001 reports live for parents
  teacherReports: boolean;                // F-REPORT-001 reports and class statistics live for teachers
  feedbackNotes: boolean;                 // F-FEEDBACK-001 notes live
  browseAsLearner: boolean;               // F-BROWSE-001 lesson browser live for paying grown-ups
  lectureMode: boolean;                   // F-TCH-004 presenter on in production
}
export const SITE_CLAIMS: SiteClaims = { freePlan: 'stage1', paidPlans: 'coming', learningRoute: false,
  parentReports: false, teacherReports: false, feedbackNotes: false, browseAsLearner: false, lectureMode: false };

/** A line about a paid feature shows only when its claim is on AND paidPlans === 'inApp'. */
export const CLAIM_REQUIRES_PAID: Record<keyof SiteClaims, boolean> = { freePlan: false, paidPlans: false,
  learningRoute: false, parentReports: false, teacherReports: false, feedbackNotes: false,
  browseAsLearner: true, lectureMode: false };
export function showsClaim(claims: SiteClaims, key: BooleanClaimKey): boolean;
```

- A code constant, not an environment variable, so tests pin every state and a claim cannot be switched on by a stray build variable.
- **Hand-off rule.** The companion spec's flag-flip PR (the one that turns the feature on in production) flips its claim in `site-claims.ts` in the same PR; that PR's checklist names this section. A claim is never flipped ahead of the feature. A companion spec that makes its feature paid-only sets its `CLAIM_REQUIRES_PAID` entry in the same PR and words the line with the plan (no price).

| Claim | Flipped by | Condition |
|---|---|---|
| `learningRoute` | F-ROUTE-001 R-10 flag flip (AMENDMENTS-ROUTE-LEARNING-ROUTE LR-10 keeps it there) | `flags.myRouteEnabled` on in production and LR-8's grown-up summary live; a test fails if `learningRoute` is true while `learner.myRoute.title` is not "Learning Route" |
| `parentReports`, `teacherReports` | F-REPORT-001 RP-11 | both report flags on in production |
| `feedbackNotes` | F-FEEDBACK-001 FB-14 | both notes flags on in production |
| `browseAsLearner` | F-BROWSE-001 BR-14 flag flip (BR-10 only adds the console entry behind `browseEnabled()`, off by default) | the entry on by default in production; shown only with `paidPlans: 'inApp'` (`CLAIM_REQUIRES_PAID`) |
| `lectureMode` | the PR that follows the owner setting `NEXT_PUBLIC_LECTURE_MODE=enabled` on the production console build (F-TCH-004 names no flip PR yet) | presenter on in production |
| `paidPlans: 'inApp'` | a PR after the owner turns on Stripe Live (the claim is a code constant, so the switch alone changes nothing) | standing rule; sandbox checkout does not count |

- Page components take `claims` as a prop defaulting to `SITE_CLAIMS`, so unit tests render every state, including `browseAsLearner: true` with `paidPlans: 'coming'` (line absent) and with `'inApp'` (line present).
- With every claim at its default the pages are complete: no empty section, no "coming soon" teaser for an unbuilt feature (only the paid cost line "More stages are coming, with plans for families and classes." while `paidPlans` is `coming`).
- **Other readers.** F-BILL-002 B-7 reads the boolean claims for the "what the plan includes" lines of the signed-in billing page (F-BILL-002 §4.3). `CLAIM_REQUIRES_PAID` applies only to the public site; the billing page is where a plan is bought, so it reads the booleans directly. F-BILL-002 B-7 therefore waits for S-2, and S-2 waits for F-APP-001 A-1.
- **`freePlan` has one value.** The owner decided F-ENT-003 OD-1 on 2026-10-11: the free plan keeps all of Stage 1 open and paid plans open Stage 2 onward. So "Stage 1 is free." (`landing.plans.free.stage1`) stays true before and after F-ENT-003's switch is turned on, and no release flips this claim. The `'firstDays'` value and its string of revision 2 are dropped. The key stays so a later change to the free plan is one constant and one string. Because the free line never flips, it says nothing about paid plans: what is coming is the paid line's (`landing.plans.paid.coming`), which `paidPlans: 'inApp'` replaces (S-3 rework).

### 3.10 Old grown-up URLs, robots and sitemap

- **Owner of old URLs: F-APP-001.** With `CONSOLE_ORIGIN` set on the site build, F-APP-001 A-8 (`apps/web/scripts/console-split.mjs --role site`) replaces every grown-up page in `out/` (`teach.html`, `teach/**`, `parent.html`, `parent/**`, and the other grown-up prefixes of F-APP-001 R-1) with a static stub that keeps the query and the fragment (F-APP-001 §3.13, OD-5). F-BILL-002's `/teach/billing` forwarder is console code; on hangulroute.com the stub answers first, on the app host the forwarder does (F-BILL-002 §4.1). This spec adds no `_redirects` file, no separate output folder and no second forwarding layer, and changes nothing in `out/` except its own pages, `robots.txt` and `sitemap.xml`.
- **`/design-preview/*` stays on hangulroute.com** (F-APP-001 §3.2 host table; OD-10). `robots.txt` disallows it.
- **S-9** adds Next metadata routes `app/robots.ts` and `app/sitemap.ts` (`export const dynamic = 'force-static'`, so the static export writes `out/robots.txt` and `out/sitemap.xml`):
  - `robots.txt`: `User-agent: *`, `Allow: /`, `Disallow: /design-preview/`, and the sitemap line on `SITE_URL`.
  - `sitemap.xml`: every site page of `SITE_PAGES` (`/`, `/learners`, `/parents`, `/teachers`, `/about`, `/privacy`, `/terms`) in every **shown** locale (`shownSiteLocales()`), absolute URLs on `SITE_URL`, with hreflang alternates when a second locale ships. Never a grown-up path (`isGrownUpPath`) or `/design-preview`.
  - Neither file is a grown-up path, so F-APP-001's console role never copies them to the app host.
- **Path matching** in every test and CI check of this spec uses whole path segments: `teach.html`, `teach/`, `parent.html`, `parent/`, `design-preview/` at the root and at every locale prefix; `teachers.html` and `parents.html` (and `es/teachers.html`) are site pages and must be present.
- **S-10** sets `SITE_DEFAULT_CONSOLE_ORIGIN` to `APP_ORIGIN`, so a site build without the variable still links to the app host. It ships in the same release as F-APP-001 A-10, which makes `https://app.hangulroute.com` the default of the same variable for the stubs. Either merge order is safe: production already has `CONSOLE_ORIGIN` set since M3, so both defaults only matter for a build without the variable. Gate for S-10, all three: (1) F-APP-001 M3 is live and the owner has signed in at `app.hangulroute.com/signin` (F-APP-001 OD-10); (2) on production hangulroute.com, `/teach/space?id=x#y` and `/teach/billing?checkout=cancel` land on the app host with query and fragment (F-APP-001 behaviours 12 and 13); (3) the learner app's Privacy link resolves to `https://hangulroute.com/privacy` (section 4, contract).

### 3.11 Length and glance budgets (enforced)

`apps/web/e2e/site-budgets.spec.ts` (new, S-4a and S-4b for persona pages, S-5 for `/`), over the static export, Chromium:

| Page | Height at 375 x 812 | Height at 1280 x 800 | Visible words (`innerText`, folded `<details>` closed) | First screen at 320 x 568 contains |
|---|---|---|---|---|
| `/` | at most 2,900 px | at most 2,100 px | at most 280 | the header, the `h1`, the one-sentence lead, `Start learning` |
| `/learners`, `/parents`, `/teachers` | at most 4,060 px | at most 3,200 px | at most 550 | the header, the `h1`, the lead, the page's primary action |

- **Header height**: at 320 x 568 and at 375 x 812 the header is one row, at most 96 px tall (64 px targets plus padding); with 200 % text at 320 px and at 720 px it is at most two rows and never scrolls sideways. Measured on every site page.
- **How 200 % text is set** (S-D review): the browser's default font size, through the Chrome DevTools Protocol (`Page.setFontSizes`, standard 32 instead of 16), as a visitor's text-size setting does; never `font-size: 200%` on `html`, because em media queries ignore the `html` font size and the 720 to 959 px enlarged-text case would go untested. This only works if text sizes are rendered in rem (token / 16) and the site's breakpoints are written in em in `globals.css` (`design/screens/site/README.md`, "Enlarged text"); S-4a does both.
- Heights are measured on the real export, so with the claims as they are in `SITE_CLAIMS`. To leave room for claim lines that switch on later, the export must also stay under a **headroom budget** while claims are off: `/` at most 2,750 px and each persona page at most 3,700 px at 375 x 812. Each claim-flip PR (section 3.9) runs this spec with its claim on, so the full budget is checked again at that moment.
- Words are also checked without a browser: `app/__tests__/site-word-budget.test.tsx` renders each page with `ALL_CLAIMS_ON` (a test fixture with every boolean on, `freePlan: 'stage1'` and `paidPlans: 'inApp'`, never imported by a page) through `renderToStaticMarkup`, strips folded `<details>` bodies and display-none phone-only duplicates, and asserts the word budgets above. No build variable switches claims, so a production build can never show an unlaunched claim.
- `landing-layout.spec.ts` keeps its checks (no sideways scroll at 320 / 375 / 768, Tab order = visual order) and its `PAGES` list gains the three persona pages; its "Play now visible" check becomes "the page's primary action visible on the first screen".

### 3.12 Copy truth pass

- **S-5** (with the new home): metadata (`landing.meta`) description and Open Graph lines drop "7 stages and 5 culture themes" and "8 mini-games" counts typed into copy; they say what is built (Stage 1, Korean culture cards, Hoya, no ads). New per-page titles and descriptions for the three persona pages (`siteMetadataFor` gains the pages; `SITE_PAGES` extends, so hreflang alternates cover them when a locale ships). "COPPA-compliant" becomes "Child safety first" (OD-4). The About promise `about.promises.localFirst` ("Local-first: data stays on the device until you sign in.", false today: every learner is backed up without a sign-in) gets a value that agrees with the backup sentence of section 3.5; the old home's `parents.points.localFirst` and `trust` lines leave with the old home body.
- **S-6**: Stage 1 card blurbs (`data/stage1-cards.ts`) lose audience wording while staying accurate (OD-9; content-skill review): gangaji "One of the first words heard in many Korean homes."; nabi "A tiny flying flower that flutters through many Korean songs."; paengi "Wooden tops spun on frozen ground in winter."; usan "Korea's rainy season lasts about a month. Keep one by the door."; ibul "Many Korean homes spread padded blankets on a warm floor to sleep." `audience-copy.test.ts` adds `data/stage1-cards.ts` and the three persona pages to `PUBLIC_SURFACES`.
- **Offline**: no unqualified offline promise remains. The hero facts line says "The app works offline on most devices after your first visit" (S-3 review); the full answer on `/learners` keeps today's qualifier (most devices; letter sounds may need a Korean voice installed, `landing.ts:75`). Offline on iOS 14 is a known open issue (deploy state, 2026-10-11): if the owner wants the facts line off until it is fixed, OD-15 removes it (one string).

## 4. Data and API (additive only)

- **No D1 migration, no new route, no telemetry name, no Worker change.** The site stays a static export.
- **Waitlist**: unchanged (`POST /api/waitlist`, `source: 'landing'`).
- **Config**: no new variable. The site reads F-APP-001's `CONSOLE_ORIGIN` through `next.config.js` `env` (section 3.8).
- **Contract for the learner app's Privacy link** (owned by the companion specs, gate item 3 of S-10): `apps/mobile/src/logic/links.ts` must resolve Privacy to hangulroute.com at every step. F-APP-001 A-7 makes `privacyUrl()` read `EXPO_PUBLIC_SITE_URL` first (default `https://hangulroute.com`); F-BILL-002 §4.7 moves the billing link to `EXPO_PUBLIC_BILLING_URL` and keeps `EXPO_PUBLIC_CONSOLE_URL` meaning "the site root". Rule for both: `EXPO_PUBLIC_CONSOLE_URL` is never pointed at app.hangulroute.com while `privacyUrl()` still reads it. `/privacy` and `/terms` stay only on hangulroute.com.
- **Not touched**: API `CONSOLE_URL`, `BILLING_URL`, `ALLOWED_ORIGINS`, Clerk, Stripe, `apps/mobile`, `apps/web/scripts/console-split.mjs` (F-APP-001), `/teach/billing` (F-BILL-002).

## 5. i18n

All strings go through `packages/i18n` (`messages/en/landing.ts`); English is the source; es and ko overlays stay empty and the locales hidden (F-I18N-001 §3.4). Taught Korean is passed in, never written into a message (rule 5). No Hangul in `en` / `es` messages (tested). Plurals through `plural`.

New and changed keys (S-3 adds; old keys are removed only in S-6, after no page reads them):

| Key | Kind | Notes |
|---|---|---|
| `landing.nav.{label, learners, parents, teachers, signIn, start, skip}` | strings | no "(current page)" suffix: `aria-current="page"` alone (section 3.2) |
| `landing.home.hero.{title, lead, start, grownUps, facts}` and `landing.home.hero.bubble(letter, romanization)` | strings + 1 function | `title` = `landing.meta.tagline` value (S-3 sets the tagline to the comma wording; a test ties them) |
| `landing.home.who.{title, items.{learners,parents,teachers}.{title, body, linkLabel}}` | strings | |
| `landing.home.how.{title, steps.{start,quests,collect}.{title, body}, routeBody}` | strings | `routeBody` only with `learningRoute` |
| `landing.home.promises.{label, items.{ads,safety,noRed}}` | strings | titles only |
| `landing.home.news.{title, body}` | strings | the form keeps `landing.waitlist` |
| `landing.plans.{title, free.stage1, paid.{coming, inApp}, managedInApp}` | strings | the only cost words on the site |
| `landing.persona.learners.*`, `landing.persona.parents.*`, `landing.persona.teachers.*` | strings + count functions | appendix B.2 to B.4; `cards.seeAll(n)` uses `plural`; learner `faq.adult` / `faq.korean` reuse today's `landing.faq.items.adult` / `.korean` text |
| `landing.persona.closing.{learners, parents, teachers}` | strings | closing block lines |
| `landing.persona.{plansTitle, faqTitle}` | strings | the persona pages' "Plans" h2 and visually hidden "Questions" h2 |
| `landing.footer.{guide, app}` | strings | group headings added; `cards`, `games`, `dashboard`, `console` removed in S-6 |
| `landing.notFound.{body, home, start}` | strings | 404 links |
| `landing.meta.pages.{learners,parents,teachers}.{title, description}` | strings | per-page metadata |

- `length-budget.test.ts` gets budgets for nav labels (at most 14 characters in `en`, room for es / ko growth), persona card bodies (at most 90 characters), the persona primary-action labels (at most 24 characters, so "Sign in as a parent" fits one line at 320 px), the text links that are not `cta` leaves (`home.hero.grownUps`, `persona.parents.learn.link`, at most 36) and the skip link and 404 actions (`nav.skip`, `notFound.home`, `notFound.start`, at most 24).
- **Learning Route spelling** (AMENDMENTS-ROUTE-LEARNING-ROUTE G1, LR-OD-1): every `landing.*` value that contains "learning route" in any casing must contain it as "Learning Route" (title case, never capitals); a copy test in S-3 enforces it, the same rule as the amendment's banned-phrase test.
- `landing-banned.ts` (shared by `landing-messages.test.ts` and `audience-copy.test.ts`) gains no new pattern; the existing commercial-claim patterns of `landing-claims.test.tsx` now scan all seven site pages.
- `messages/review-ledger.json`: removed keys are removed from the ledger in S-6 (es / ko have no entries yet, so nothing to re-review).
- The F-APP-001 stub strings (`landing.consoleMoved.*`) are F-APP-001's; this spec adds none for forwarding.

## 6. Accessibility

- One `h1` per page; headings in order; landmarks `header`, `nav` (labelled "Main"), `main` (id `content`, the skip-link target), `footer`.
- Skip link first in Tab order, visible on focus, at least 64 x 64.
- Persona cards: one link each, accessible name = title + line; focus ring on the whole card (`:focus-visible`, token colour).
- `<details>` / `<summary>` for every fold: keyboard and screen-reader support without JavaScript; the summary text names what opens ("See all 24 Stage 1 cards"). The `summary` stays a block; its question and chevron sit in an inner span that does the grid layout, because older WebKit (iOS 14 and 15 Safari) does not reliably lay out a `summary` that is itself a grid or flex container.
- Tab order equals visual order at 320, 375, 768 and 1280 (e2e, existing helper). Phone-hidden header items are `display: none`, so they are out of the Tab order too.
- 200 % text at 320 px and at 720 px: no horizontal scroll, no clipped CTA, header at most two rows (e2e with the browser default font size at 32 through `Page.setFontSizes`, section 3.11; not an `html` font-size override).
- Contrast: token pairs only (`text.primary` / `surface.paper`, `text.onPrimary` / `brand.primary`); no new colour.
- Decorative art (`HoyaSvg`) `aria-hidden`; the taught letter in Hoya's bubble keeps its romanization in the sentence (`bubble(letter, romanization)`).
- Link purpose is clear from the link text alone ("For parents", "Sign in as a teacher", "Parent or teacher? Find your page"); no "Learn more", no "Click here".
- "Learning Route" in title case, so screen readers read it as words (capitals are spelled out by some).
- No motion added; anything animated respects `prefers-reduced-motion`.
- `lang` is correct in the static HTML of every page (F-I18N-001 §3.4).

## 7. Privacy, safety and telemetry

### 7.1 Privacy and child safety

- The site sets **no cookies**, uses **no `localStorage`**, loads **no third-party script, font or pixel**, and shows **no ads**. One `sessionStorage` flag (`hr:site:localeBanner`, `lib/locale-banner.ts`) remembers a dismissed language banner for the visit; it is not an identifier and is unchanged by this spec.
- Nothing on the site asks for a learner's data. The only input stays the launch-news email (grown-up, consent line unchanged, `docs/launch/waitlist.md`).
- No age wording and no kids-only framing on any site page (CLAUDE.md §1; `audience-copy.test.ts` extended to the new pages and to `data/stage1-cards.ts`). Parent and teacher pages address grown-ups directly, still without an age range.
- Anti-shame: no page shows or promises a ranking, a leaderboard or a learner-vs-learner comparison; the teacher page says so plainly, and the report lines say "never a ranking".
- No student name in any URL (the site has none; links carry only `?persona=` and `?lang=`).
- Child-safety promises shown are true and tested: the backup sentence of section 3.5 (nickname and progress kept on the device and backed up to our servers, restored with a Rescue Code; a class or family a learner joins sees the joining name and their progress; family grown-ups can also restore it), the grown-up gate, no ads, siblings keep their own progress. Today's "until you sign in" wording is false (the app backs up every learner without a sign-in): S-5 corrects the About promise and S-7 the two Privacy Policy sentences (sections 3.7, 3.12). The content and safety review signed the backup sentence off in S-3 (review 3), against the code.

### 7.2 Telemetry

None. The site sends no event and has no client measurement code (OD-5). Page counts per path come from Cloudflare's request analytics for the hangulroute.com zone, which the hosting already records for every request with no client code, cookie or identifier; the owner reads them in the Cloudflare dashboard (Analytics, HTTP traffic, filtered by path). Assumption c verifies the current plan shows counts per path; if it does not, G8 waits for a later spec with a readable, owner-only sink, and nothing in this spec changes.

## 8. Tests

TDD: each PR's tests are written first and fail before the implementation.

| Area | Test | PR |
|---|---|---|
| Links | `lib/__tests__/site-links.test.ts`: same-origin default, `CONSOLE_ORIGIN` trimmed and without a trailing slash, `signIn('parent')` = `/signin?persona=parent` and with the app origin `https://app.hangulroute.com/signin?persona=parent`, `signIn()` has no query, unknown persona impossible by type; no output contains `/teach`, `/parent`, `/account`, `/billing` or `APP_ROUTES.billing`; `learnerStart` equals today's `appEntryUrl` output for en / es / ko | S-2 |
| Claims | `data/__tests__/site-claims.test.ts`: defaults exact; `ALL_CLAIMS_ON` covers every key; `CLAIM_REQUIRES_PAID` covers every key and `browseAsLearner` is true; `showsClaim` matrix; no page module imports the fixture; `learningRoute` true implies `en.learner.myRoute.title === 'Learning Route'` | S-2 |
| Strings | `packages/i18n` landing tests: no Hangul in en, banned words, length budgets, plural forms, Learning Route spelling, the backup sentence pinned and cross-checked with the Privacy Policy's `progressWho`, the bubble's romanization, both composed Plans blocks | S-3 |
| Persona pages | `app/__tests__/persona-pages.test.tsx`: each page renders one `h1`, its primary action href from `site-links`, every claim off (no empty section) and every claim on (each claim line present exactly once), `browseAsLearner` on with `paidPlans` `coming` (line absent) and `inApp` (line present, with the plan words), no `/teach`, `/parent`, `/account` or `/billing` literal | S-4a, S-4b |
| Header and footer | `app/__tests__/site-chrome.test.tsx`: DOM order; phone-hidden items carry the breakpoint class; legal variant has no Sign in and no Start learning; footer groups; the current page's link has `aria-current="page"` and an accessible name equal to its label | S-4a |
| Route groups | `route-groups.test.tsx` covers the new pages in `(en)` and `(loc)/[locale]`; no crossing `next/link` | S-4a, S-4b |
| Home | `landing-layout.test.tsx`, `landing-claims.test.tsx` (pinned cost sentence stays on `/`; "Learning Korean yourself? Play the same quests." moves to `/parents`; the commercial-claim scan runs on all seven pages and the metadata), `landing-no-emoji`, `landing-pseudo`, `audience-copy` (new surfaces) | S-4a, S-4b, S-5 |
| Locales | `landing-locales.test.tsx`: `SITE_PAGES` has seven pages; hreflang alternates for the new pages on a QA build; hidden-locale pages are pruned | S-4a, S-4b |
| Budgets | `site-budgets.spec.ts` heights, header rows at 200 % text (browser default font size, 320 and 720 px) and first screen (e2e) and `site-word-budget.test.tsx` words with every claim on (section 3.11) | S-4a, S-4b, S-5 |
| Layout (e2e) | `landing-layout.spec.ts` with seven pages; `landing-locales.spec.ts` touch ratchet (allowlist shrinks only) | S-4a, S-4b, S-5 |
| Legal | `legal-copy.test.tsx`: both payment channels named (Stripe on the web after sign-in at app.hangulroute.com; App Store / Google Play for in-app purchases); store management and auto-renew paragraphs kept and marked for in-app purchases; draft banner kept | S-7 |
| Robots and sitemap | `apps/web/src/__tests__/site-surface.test.ts` (vitest, same pattern as `prune-hidden-locales.test.ts`): `robots()` and `sitemap()` exact; sitemap = `SITE_PAGES` x shown locales; no grown-up path (`isGrownUpPath`) and no `/design-preview` | S-9 |
| CI | `preview-deploy.yml`: `out/index.html`, `learners.html`, `parents.html`, `teachers.html`, `robots.txt`, `sitemap.xml` exist (whole-segment names) | S-9 |
| Flip | `site-links.test.ts`: default origin = `APP_ORIGIN`; `CONSOLE_ORIGIN` still overrides | S-10 |

Coverage: `apps/web` new `lib/` and `data/` modules at 100 % lines (pure); page components covered by the render tests above; no drop against `docs/tests/coverage-targets.md`.

## 9. PR breakdown

### 9.1 Milestones

| Milestone | What a visitor sees at the end | PRs | Production effect |
|---|---|---|---|
| **M1 "Short and layered"** | a one-screen hero, the persona chooser, three persona pages, a header with Sign in, every console link gone from the site's pages (Sign in opens `/signin?persona=…` on the same origin) | S-0, S-2, S-3, S-D, S-4a, S-4b, S-5, S-6 | site pages only; the console keeps working |
| **M2 "Truthful documents"** | corrected payment facts in the draft Privacy Policy and Terms; robots and sitemap | S-7, S-9 | static files only |
| **M3 "Two hosts, two roles"** | the site's Sign in goes to app.hangulroute.com; old console URLs on hangulroute.com land there (F-APP-001 stubs) | owner step F-APP-001 S-3 (`CONSOLE_ORIGIN`), then S-10 with F-APP-001 A-10 | one build variable, then one code default |

### 9.2 PR table

| PR | Content | Size | Needs |
|---|---|---|---|
| S-0 | `docs`: this spec and the five wireframes in `design/wireframes/site/` | S | — |
| S-1 | *removed in review (2026-10-11): no site telemetry (OD-5)* | — | — |
| S-2 | `feat(web)`: `lib/site-links.ts` (on `APP_ROUTES`, `APP_ORIGIN`, `CONSOLE_ORIGIN`), `data/site-claims.ts` (with `CLAIM_REQUIRES_PAID`, `showsClaim`), the `next.config.js` `env` line, tests | S | S-0, F-APP-001 A-1 merged |
| S-3 | `feat(i18n)`: new English keys of section 5 (appendix B), length budgets, Learning Route spelling test, the backup sentence of section 3.5; no key removed | M | S-0 |
| S-D | `design`: mock of the home hero, the one-row phone header, the persona card and a persona page (existing tokens only) in `design/screens/site/` | S | S-0 (wireframes) |
| S-4a | `feat(web)`: `SiteHeader` (with the legal variant) and `SiteFooter`; `/learners` in `(en)` and `(loc)/[locale]`; cards and games folds; `SITE_PAGES` and metadata for `/learners`; budgets, chrome, route-group and audience tests for it | M | S-2, S-3, S-D, F-APP-001 A-4 merged |
| S-4b | `feat(web)`: `/parents` and `/teachers` in both route groups; claim lines with the paid rule; metadata; budgets and tests | M | S-4a |
| S-5 | `feat(web)`: new home body (section 3.3) and the shared header and footer on `/`, About, Privacy, Terms (legal variant), 404; console links removed from site pages; metadata truth pass and "Child safety first" (section 3.12); `landing-claims` / `landing-layout` / e2e updates; touch allowlist shrinks; F-CONSOLE-001 §3.6 amended; F-I18N-001 §3.4 note (seven site pages) | M | S-4b |
| S-6 | `chore(web,i18n)`: remove unused components and keys (`landing.trust`, `landing.how`, `landing.faq`, `landing.parents`, `landing.pricing`, old `nav` / `footer`, `landing.home.who.items.*.linkLabel` (its only reader is the old header; S-D draws the card without it), audience badges, `MeetHoya` if unused), review ledger; card blurbs (OD-9, content-skill review) | S | S-5, OD-9 |
| S-7 | `docs(web)`: Privacy and Terms factual corrections (section 3.7), English-authoritative, banner kept, `legal-copy.test.tsx` cases | S | OD-13 |
| S-8 | *removed in review (2026-10-11): no site telemetry (OD-5)* | — | — |
| S-9 | `feat(web,ci)`: `app/robots.ts`, `app/sitemap.ts`, `site-surface.test.ts`, `preview-deploy.yml` file checks | S | S-5 |
| S-10 | `feat(web)`: `SITE_DEFAULT_CONSOLE_ORIGIN = APP_ORIGIN`; `docs/launch/web-app-launch.md` updated | XS | S-9; the three gate items of section 3.10; same release as F-APP-001 A-10 |
| S-11 | *removed in review (2026-10-11): redirect status belongs to F-APP-001's stubs* | — | — |

**Claim hand-offs (not PRs of this spec):** the table of section 3.9. Each flip PR changes one line of `SITE_CLAIMS` (and `CLAIM_REQUIRES_PAID` when its feature is paid-only) with its copy test and runs `site-budgets.spec.ts` with the claim on.

### 9.3 Sequence notes

- S-2, S-3 and S-D can run in parallel. S-4a, S-4b and S-5 edit `landing.ts`, `LandingPage.tsx` and the landing tests that F-I18N-001 PR 14 / 16 may also touch; keep edits additive until S-6.
- This spec touches none of the shared append-only files (`packages/content-schema/src/index.ts`, `schemas/telemetry.ts`); it only imports `APP_ROUTES` and `APP_ORIGIN`.
- Between F-APP-001 A-4 and A-5b, a parent who signs in from the site lands on F-APP-001's `/parent`, which is still the demo until A-5b. That is no worse than today (the landing header links the demo directly) and ends with A-5b; F-APP-001 owns it.
- S-5 removes the landing's links to `/parent`; F-APP-001 A-5b leaves those links to this spec ("landing links to `/parent` left to the marketing spec"), so whichever lands first, no site link points at a removed page.
- Rollback: each PR reverts alone. Unsetting `CONSOLE_ORIGIN` (F-APP-001 rollback) brings the site's Sign in back to the same origin together with the console pages.

## 10. Dependencies

- **On main:** F-I18N-001 PR 11a / 11b / 11c (route groups, `sitePath`, `appEntryUrl`, hidden-locale prune); `WaitlistForm` and `/api/waitlist`; F-CONSOLE-001 static export; `LocaleBanner`.
- **F-APP-001** (persona app shell): A-1 (`APP_ROUTES`, `APP_ORIGIN`, `isGrownUpPath`) gates S-2 and S-9; A-4 (`/signin` with `?persona=` intros) gates S-4a, S-4b and S-5; A-8 (stubs) and M3 (owner sets `CONSOLE_ORIGIN`) move the site's links to the app host; A-10 ships with S-10. F-APP-001 §6.4 lists this spec's links (`/`, `/signin?persona=parent`, `/signin?persona=teacher`); before M3 the site uses the same paths on its own origin (section 3.8).
- **F-BILL-002** (billing): the site has no billing link and no price (F-BILL-002 §4.1; its B-10 guard test and this spec's `site-links` test both pin it); the `/teach/billing` forwarder and the billing path (`/billing` or `/account/billing`, settled between F-APP-001 and F-BILL-002) are not this spec's.
- **Requests from F-BILL-002 §13.2, answered:** S1 (a `/teach/billing*` rule in `site-routes.json`) is superseded. This spec has no `site-routes.json` and no redirect table. F-APP-001's `legacyConsoleTarget` already maps `/teach/billing` to `/account/billing` in one hop on hangulroute.com, and the site renders no billing link. S2 is accepted: F-BILL-002 B-10's `site-no-billing.test.ts` keeps its link-and-amount scan and allows the S-7 legal prose. This spec's `site-links` and page tests pin the same rule from the site's side. B-10's allowance for "`site-routes.json`" is no longer needed.
- **Claim hand-offs:** F-ROUTE-001 R-10 with AMENDMENTS-ROUTE-LEARNING-ROUTE LR-8 (`learningRoute`) · F-REPORT-001 RP-11 (`parentReports`, `teacherReports`) · F-FEEDBACK-001 FB-14 (`feedbackNotes`) · F-BROWSE-001 BR-10 (`browseAsLearner`, paid line) · F-TCH-004 R-flip (`lectureMode`) · owner Stripe Live (`paidPlans: 'inApp'`).
- **External:** owner answers (section 11; defaults apply); Cloudflare zone analytics (assumption c).

## 11. Owner decisions (each has a default; each gates only the PRs named)

| Id | Question | Default (applies until answered) | Gates | Reversible |
|---|---|---|---|---|
| OD-1 | Persona page names and paths | `/learners` "For learners" (any age; the teacher page says "students"), `/parents` "For parents and caregivers", `/teachers` "For teachers" | S-3, S-4a, S-4b | yes (paths + strings) |
| OD-2 | Where the site's grown-up links go | F-APP-001's `/signin` with `?persona=parent` or `?persona=teacher` (header: no hint), on the same origin until `CONSOLE_ORIGIN` is set, then on app.hangulroute.com; never `/teach`, never billing | S-2, S-4a | yes (one module) |
| OD-3 | *closed in review: the redirect status is F-APP-001's (stub pages, no HTTP redirect)* | — | — | — |
| OD-4 | "COPPA-compliant" on the public site while the legal documents are drafts | replace with "Child safety first"; restore a compliance claim only after counsel signs off | S-3, S-5 | yes |
| OD-5 | Site measurement | no client telemetry, no script, no cookie; page counts from Cloudflare's zone analytics in the dashboard | — | yes (a later spec may add an owner-only sink) |
| OD-6 | Free-plan wording once F-ENT-003's free boundary is enforced | **Closed by F-ENT-003 OD-1 (owner, 2026-10-11)**: the free plan is all of Stage 1, so the site keeps "Stage 1 is free." (`landing.plans.free.stage1`) before and after the boundary is enforced; no `firstDays` line, no claim flip | — | — |
| OD-7 | Prices on hangulroute.com | never: the site names plans without amounts and says they are managed at app.hangulroute.com | — (rule) | yes |
| OD-8 | Launch-news form after launch | keep a short "Get the launch news" block on `/` only, same API and consent line | S-5 | yes |
| OD-9 | Stage 1 card blurbs that say "kids" / "children" | reword the five blurbs as in section 3.12 (accuracy kept, content-skill review) | S-6 | yes |
| OD-10 | `/design-preview/*` | stays on hangulroute.com (F-APP-001 §3.2); `robots.txt` disallows it | S-9 | yes |
| OD-11 | Remember the visitor's persona between visits | no (the site stores nothing but the banner flag) | — | yes |
| OD-12 | What "Sign in" means on the site | grown-ups only (parents, caregivers, teachers); learners use "Start learning", choose their profile in the app, or join a class or family with a code (F-APP-001 OD-2); `/learners` answers "Is there a sign-in for learners?" | S-3, S-4a | yes |
| OD-13 | Factual corrections in the draft Privacy Policy and Terms | name both channels (Stripe on the web after sign-in; App Store / Google Play for in-app purchases when offered), state that web plans renew yearly until cancelled and can be cancelled any time in Billing [BY], keep the store paragraphs for in-app purchases, keep the draft banner, flag for counsel in the PR (including the renewal-notice period for a yearly term) | S-7 | yes |
| OD-14 | Header of the legal pages | no Sign in and no Start learning on `/privacy` and `/terms` (the native app links there) | S-4a, S-5 | yes |
| OD-15 | Offline line while iOS 14 offline is an open issue | keep the offline fact in the facts line, hedged as "The app works offline on most devices after your first visit" (S-3 review), with the full answer on `/learners` | S-3 | yes (one string) |

**Assumptions to verify** (with the PR that verifies each):

| # | Assumption | Verified in |
|---|---|---|
| a | F-APP-001 A-4's `/signin` works on hangulroute.com before M3 (Clerk Production already serves the root domain; the console signs in there today) | S-4a preview: sign in from `/parents` on a `*.workers.dev` preview with the dev auth bridge |
| b | The phone header (brand + Sign in) fits one row at 320 px with 64 px targets | S-4a e2e (if not: the brand shows the mark and a shorter name below 360 px) |
| c | Cloudflare's HTTP traffic analytics for the hangulroute.com zone lists requests per path on the current plan | owner check after S-5 (else G8 waits for a later spec) |
| d | `/` fits 2,900 px at 375 x 812 with the 64 px touch floor on footer links in two columns | S-5 e2e (if not: the footer groups fold into one `<details>` "More links" on narrow screens) |
| e | Removing `/teach` and `/parent` links from site pages before M3 is acceptable because "Sign in" reaches the console through `/signin` | S-5 review |

## 12. Out of scope

Console, sign-in and billing on app.hangulroute.com; forwarding of old grown-up URLs (F-APP-001 A-8, F-BILL-002); the service-worker denylist and manifest scope of the learner PWA; API `CONSOLE_URL`, `BILLING_URL`, Clerk and Stripe settings; es / ko translations; real prices; a help centre or blog; A/B testing; analytics scripts; cookie consent tooling (no cookies are set).

## Appendix A — what each persona page answers

| Page | The question it answers in one look | Primary action | What it never does |
|---|---|---|---|
| `/` | What is this and is it for me? | Start learning | explain any persona in depth |
| `/learners` | What will I do and learn? | Start learning | mention age or price |
| `/parents` | Is it safe, what will I see, what does it cost? | Sign in as a parent | show a price, compare learners |
| `/teachers` | How do I run it with a class? | Sign in as a teacher | promise a feature that is not live, rank students |

## Appendix B — English strings (S-3 writes these into `messages/en/landing.ts`)

### B.1 Home

- nav: label "Main" · learners "Learners" · parents "Parents" · teachers "Teachers" · signIn "Sign in" · start "Start learning" · skip "Skip to content"
- hero.title "Learn Hangul from zero, at any age."
- hero.lead "Short, playful quests teach you to read, hear and write the Korean alphabet, with Hoya the tiger as your guide."
- hero.start "Start learning" · hero.grownUps "Parent or teacher? Find your page"
- hero.facts "Runs in your browser · Nothing to install · The app works offline on most devices after your first visit"
- hero.bubble(letter, romanization) "Annyeong! Let's meet {letter} ({romanization})." (a no-break space between the letter and its romanization keeps them on one line)
- who.title "Who is it for?"
- who.learners: title "Learners" · body "Five-minute quests, a guide who never scolds, and Korean culture cards to collect." · linkLabel "For learners"
- who.parents: title "Parents and caregivers" · body "See what your learner practises, with a grown-up gate and no ads." · linkLabel "For parents"
- who.teachers: title "Teachers" · body "Students join with a class code. No student emails, no accounts." · linkLabel "For teachers"
- how.title "How it works"
- how.start: "Open the app" · "Choose who is learning and begin."
- how.quests: "Learn in five-minute quests" · "Letters, sounds and first words, with sound and pictures on every screen."
- how.collect: "Collect and keep going" · "Earn Korean culture cards. Your progress is saved on your device."
- how.routeBody "Earn Korean culture cards and see your whole Learning Route: where you are and what comes next."
- promises.label "Our promises" · items: ads "No ads, ever" · safety "Child safety first" · noRed "No red marks"
- plans.title "What does it cost?"
- plans.free.stage1 "Stage 1 is free." (every state; F-ENT-003 OD-1)
- plans.paid.coming "More stages are coming, with plans for families and classes."
- plans.paid.inApp "Plans for families and classes are at app.hangulroute.com."
- plans.managedInApp "Plans and billing are managed at app.hangulroute.com after you sign in."
- news.title "Get the launch news" · news.body "Leave your email and we'll send you the launch news. Nothing else."

### B.2 Learners

- title "For learners" · lead "Learn to read, hear and write Hangul, one five-minute quest at a time."
- learn.title "What you learn first" · learn.body "Stage 1 is the Korean alphabet: the letters, their sounds and how they build syllables." · bullets "Read letters and syllables" / "Listen and match sounds" / "Write letters by tracing them"
- quest.title "How most quests work" · bullets "Discover: see and hear a new letter." / "Play: short mini-games that use it." / "Check: a gentle round. Wrong answers get an amber nudge, never red." · hoya "Hoya the tiger guides every quest and never says “wrong.”" · gamesFold "See the mini-games"
- cards.title "Collect Korean culture" · cards.body "Every letter you learn earns a card: a piece of Korean food, art or everyday life." · cards.seeAll(n) "See all {n} Stage 1 cards" (plural; one: "See the Stage 1 card")
- route.title "Your Learning Route" · route.body "One map shows where you started, where you are and what comes next."
- faq: signIn "Is there a sign-in for learners?" / "No email or password needed. Open the app and choose your profile, or enter your class or family code. Moving to a new device? Use your Rescue Code." · code "I have a join code. Where do I enter it?" / "In the app: tap Profile, then go to Classes & family and tap Join a class." (the labels the learner taps; the console's `writeOnBoard` names the same path) · offline "Does it work offline?" / "On most devices, yes: after your first visit the app opens without a connection. Letter sounds may need a Korean voice installed on your device." · adult (today's `landing.faq.items.adult`) · korean (today's `landing.faq.items.korean`)
- closing "Ready for your first letter?"

### B.3 Parents

- title "For parents and caregivers" · lead "For parents, grandparents and every caregiver: short, kind lessons that keep your learner's data private." · signIn "Sign in as a parent"
- learn.title "What they learn" · learn.body "The Korean alphabet first: reading, listening and writing, in five-minute quests." · learn.link "What learners do"
- safe.title "Safe by design" · bullets "No ads, and no data sold." / backup "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code. When a learner joins a class or family with a code, that space sees the name they join with and their progress. A family's grown-ups can also restore their progress." / "A grown-up gate guards anything that costs money or deletes data." / "Siblings can share a device. Each learner keeps their own stars and cards."
- follow.title "Follow along" · follow.body "Create a free family space, share its code, and see each learner's week: time practised, quests done and letters to revisit together."
- follow.reports "Reports for today, this week, this month and all time show what went well and what to practise next."
- follow.route "Open each learner's Learning Route to see where they are and what comes next."
- follow.notes "Send a short note of encouragement that your learner sees in the app."
- follow.browse "With the Family Plan, browse every lesson exactly as your learner sees it."
- faq: account "Does my learner need an account?" / "No. Learners never need an email or a password." · learnAlong "Can I learn alongside them?" / "Yes. Learning Korean yourself? Play the same quests." · whatSee "What can I see?" / a "Each learner's week, in your family space after you sign in. Learners join it with your family code." · reports (while `parentReports` is on) "Each learner's week and reports, in your family space after you sign in. Learners join it with your family code."
- closing "See your learner's week in one place."

### B.4 Teachers

- title "For teachers" · lead "Students join with a code, you plan the week, and everyone learns at their own pace." · signIn "Sign in as a teacher" · tryIt "Try it as a learner"
- setup.title "Set up in minutes" · steps "Sign in and create a class space." / "Share the class code. Students enter it in the app; no student emails or accounts." / "Students learn on any device with a browser."
- plan.title "Plan and assign" · bullets "Pick quests for the week. They appear on each student's homework list." / "Or let the planner build a term route from your class level and rhythm."
- class.title "See how the class is doing" · class.body "A weekly view shows who practised and which letters to revisit together. Never a ranking."
- class.reports "Reports for each student and statistics for the whole class, by day, week, month or all time. Never a ranking."
- class.route "Open each student's Learning Route to see where they are and what comes next."
- class.notes "Send students a short note of encouragement."
- class.browse "With a class or school plan, preview every lesson exactly as students see it."
- class.lecture "Teach from the front on a projector or TV."
- privacy.title "Privacy for classes" · bullets "Show initials only on the class list." / "No ads, and no data sold."
- faq: students "Do students need accounts?" / "No. They join with the class code inside the app." · ranking "Is there a leaderboard?" / "No. Hangul Route never ranks students against each other." · try "Can I try it first?" / "Yes. Open the app and play the first quests as a learner."
- closing "Bring Hangul to your class this week."

## Review log

- 2026-10-11: drafted from the owner request and the five current-system readers (marketing site, domains and deploy, learner app, console, entitlements, reports data); self-reviewed against CLAUDE.md §1 (audience, safety, anti-shame, languages, no speaking), the pricing rule (no amounts, no commercial claims), F-I18N-001 §3.4 (route groups, plain `<a>` across groups, hidden-locale prune) and the touch-target ratchet.
- 2026-10-11, review 1 (cross-spec, UX). Applied:
  - **Blocker, one owner for old grown-up URLs.** F-APP-001's stub pages own them (A-8, `CONSOLE_ORIGIN`). This spec drops `out-site/`, the `_redirects` table, its tests, assumption (a) and S-11. `/design-preview/*` stays on hangulroute.com, as F-APP-001 §3.2 says (OD-10). The S-10 gate now depends on the stubs being live in production (section 3.10). The site's links read the same `CONSOLE_ORIGIN`, so links and stubs move together.
  - **Sign in as a parent.** Links now use `APP_ROUTES.signIn` with `?persona=` (F-APP-001 §3.7). The module never outputs `/teach` and never outputs a billing path; tests pin both.
  - **Free-plan wording** now follows F-ENT-003 OD-8 ("Day 1 and Day 2 of the route"). The flip waits for the E3-11 release that turns `contentGatingEnabled` on with Stripe Live. "No time limit" is left out because F-ENT-003 does not state it. "Short stories" is left out because F-ENT-003 hides the stories line while no story is bundled.
  - **Learning Route in title case** everywhere, with a spelling test and a claim test tied to `learner.myRoute.title`.
  - **Phone header on one row** (brand and Sign in). Persona links are reached through the hero link, `#who` and the footer. The header height is measured in the budgets.
  - **Browse line names the plan** and needs `paidPlans: 'inApp'` (`CLAIM_REQUIRES_PAID`).
  - Report lines now cover all four periods and class statistics.
  - A Learning Route line was added for grown-ups.
  - Home: the questions block is gone and the promises are titles only. Budgets were lowered.
  - `/learners`: Meet Hoya is folded into the quest section and the code question is folded, so the page has 4 to 5 sections.
  - Calls to action: "Find your page"; the offline fact is now about the app; there is a learner sign-in question.
  - Parents page: caregivers are named in the h1 and the lead.
  - Rejected or adjusted:
    - "Keep `/teach` as the same-origin sign-in before the flip": rejected. Once F-APP-001 A-4 merges, `/teach` is the teacher router on both hosts, so a parent would still get the teacher flow. The site uses the same-origin `/signin?persona=` instead and waits for A-4.
    - "Home at about 2,600 px": set to 2,900 px, with a headroom budget of 2,750 px. The 64 px touch floor on footer links costs about 300 px on phones; assumption d records the fallback.
    - "Promises title-only on phones": applied at every width, so phone and wide show the same content.
    - "Sign in as a parent or caregiver" on the button: not used. It overflows one line at 320 px, so caregivers are named in the h1, the lead and the persona card instead.
- 2026-10-11, review 2 (code, safety, legal). Applied:
  - **Local-first sentence** made true for class and family joins (F-SPACE-001 §3.5), removed from the "already true" list, pinned by a test, and given a safety review in S-3.
  - **Legal correction** names both payment channels and keeps the store paragraphs for in-app purchases (F-ENT-001 §3.5, F-IAP-002). `legal-copy.test.tsx` was added to the test table.
  - **Privacy link contract** added (section 4). It is gate item 3 of S-10.
  - **G8**: client telemetry dropped (option a). S-1, S-8, `site-telemetry.ts`, the `site.*` names, the backend allow-list and the page-count sentence in S-7 are gone. Cloudflare zone analytics replace them (assumption c).
  - **Browse claim** gated on paid plans (`CLAIM_REQUIRES_PAID`).
  - **Whole-segment path matching** added. The surface test is now a vitest file in `apps/web/src/__tests__/`.
  - `sessionStorage` banner flag stated in section 7.1.
  - "Managed at app.hangulroute.com" names the host.
  - Legal pages get a header without Sign in (OD-14).
  - The meta truth pass moved to S-5.
  - The offline qualifier is kept on `/learners`, and offline was dropped from the home promises (OD-15).
  - S-4 split into S-4a and S-4b.
  - Parent sign-in now goes to `/signin?persona=parent`, so no neutral label is needed before the flip.
  - Rejected or adjusted:
    - "The app host serves `/privacy` and `/terms` redirects": not chosen. The `privacyUrl()` contract keeps Privacy on hangulroute.com without a second copy.
    - "Analytics Engine or D1 sink": not chosen for this spec (OD-5).
- 2026-10-11, F-ENT-003 OD-1 (owner decision, applied in F-ENT-003 E3-0b): the free plan keeps all of Stage 1 open; paid plans open Stage 2 onward. `freePlan` keeps the single value `'stage1'`; the `'firstDays'` value, its string, its hand-off row and the E3-11 flip are dropped; OD-6 is closed. The "Free-plan wording" item of review 1 above is superseded.
- 2026-10-11, S-3 rework after F-ENT-003 OD-1 and the yearly Family Plan (BY-1; `AMENDMENTS-BILLING-FAMILY-YEARLY.md`, BY-0). `landing.plans.free.firstDays` is not added. `plans.free.stage1` is now just "Stage 1 is free.": it never flips, so its old second sentence ("More stages and classroom plans are coming.") would have been false once `paidPlans` is `inApp`. That sentence moves to `plans.paid.coming` ("More stages are coming, with plans for families and classes."), so today's cost line keeps it. `follow.browse` names "the Family Plan", as the app's billing page does. The S-3 tests now fail on any site string with lifetime, one-time or term wording, or a day-count, trial or time-limited free-plan line.
- 2026-10-12, S-3 review 3 (two reviews of PRs #353 and #354). Applied:
  - **Blocker, the parents page's data sentence.** The sentence said progress is saved to our servers "when a grown-up signs in" and that a join shares "only a short progress summary". The code backs up every learner (nickname, level, avatar, progress) on start and after each write with no sign-in (`flags.syncEnabled` on, `sync-store.ts`), mints a Rescue Code after the first cloud save, and lets family caregivers recover the full snapshot (`can.ts` `snapshot.read`, the Privacy Policy's `progressWho`). The bullet is now `safe.bullets.backup` (section 3.5, appendix B.3), and its tests check it against `progressWho` and the join screen, no longer against the policy paragraph that has the same mistake. S-7 corrects the two policy sentences and S-5 the About promise (sections 3.7, 3.12, 7.1).
  - **Romanization in Hoya's bubble.** `hero.bubble(letter, romanization)` (CLAUDE.md §1, section 6).
  - **The launch-news block keeps the unchanged `WaitlistForm` on its brand band** (section 3.3 block 6); its four small controls keep their allowlist lines (section 3.2).
  - **Plans without repeats:** a persona page's Plans block drops `paid.inApp` once plans are on sale, so the host is named once; both composed blocks are pinned. "What can I see?" has its own answer and a report variant instead of repeating Follow along.
  - **"How most quests work"** until F-QUEST-002 Q-8 gives the nature and crafts quests their Discover and Check steps.
  - **No "(current page)" suffix:** `aria-current` alone; `nav.current` is not added.
  - **200 % text** is set through the browser default font size, also at 720 px (sections 3.11, 6); the fold's `summary` stays a block for older WebKit.
  - The learner app's three-classes message names Profile and Classes & family instead of "Settings"; budgets added for the text links, the skip link and the 404 actions; the frozen key list gains `progressWho` (226 leaves).
  - Rejected: making the frozen key list fail when any landing leaf outside the new prefixes is missing from it. A landing key added on main after S-3 (another spec's legal or claim line) would then fail this spec's test; the list records the tree before S-3, so its exact length (226) and the per-path check are kept.
