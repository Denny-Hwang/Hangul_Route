Status: ready (multi-agent review signed off 2026-10-21, section 12; review round 3 changes applied the same day; rows SN-1 and SN-2 implement it)

> **Amended 2026-10-21 by `AMENDMENTS-GUEST-FIRST-LESSON.md` [GU]**: under a new claim `guestLesson` (`false` until row GU-7), `learnerStart` adds `try=1` to every Start learning (section 3.8: the header pill, the hero, the closing band, the persona pages, About and the 404), so it opens Stage 1 quest 1 straight away on a device with no profile; the hero (section 3.3 item 1) gains one line under the facts line, above the two grown-up links, inside the `/` headroom of section 3.11, which GU-7 re-measures with the claim on. Rows GU-6 and GU-7.

Design: row SN-0 (this PR, agent design pass, CLAUDE.md section 5 and the 2026-10-12 owner decision). Wireframes
`design/wireframes/site/newuser-home.md`, `newuser-header-language.md`, `newuser-grown-up-pages.md`,
`newuser-learners-captures.md`, `newuser-about-404-head.md`; mocks `design/screens/site/newuser/` (README, `mock/<locale>/<page>.html`
for en, es and ko, `shots/` at 375 x 812 and 1280 x 800, `captures/`, `head/`, `measurements.json`).

# Amendment to F-SITE-002: the new-visitor pass (site entry, grown-up conversion, product captures, head and 404)

> **Owner request of 2026-10-21 (in chat, translated):** "Review the whole website for wrong content or content written
> for an older version, and improve it so a new user understands it easily and can try the app quickly. Review and
> improve it at the level of a Google principal UX/UI designer."
>
> This file is PR 3 of the six PRs of that review. PRs 1, 2 and 5 are copy and accuracy fixes already open: #806 (site
> facts), #807 (`/learners` in the UI language) and #804 (titles, icons, 404, legal accuracy; it is row SN-2 below). This
> amendment designs what those rows cannot do with copy alone: where a new visitor's eyes and thumbs go.
>
> Every change below that lands in F-SITE-002, a test or a code comment is marked **[SN]**.
>
> Basis: `origin/main` `619f4ae2b` (2026-10-21). Every `file:line` below is at that commit. The mocks are built on that
> commit with #806 and #807 merged locally (their copy, not changed here), so the design is judged against the copy that
> ships first.

**Standing rules that apply here:**
- hangulroute.com is the intro site; the learner app, sign-in, billing and the console live on app.hangulroute.com
  (F-SITE-002 G1, G5). The site never links to billing and never shows a price (OD-7).
- Site claims stay as `apps/web/src/data/site-claims.ts` has them. Nothing here turns a claim on, in words or in
  pictures: a product capture shows only under the claims of the features it depicts (section 3.13), and no capture
  shows a feature whose claim is off. The schools section is not a claim line: every fact in it is live (section 2.1).
- UI strings come from `packages/i18n`, English, Spanish and Korean in the same PR, written to the F-I18N-001 section
  3.10 style guide and glossary. Endonyms, taught Korean, the contact address and the caps are passed in as values,
  never written into a message. Review ledger: the row that changes `messages/en/landing.ts` recomputes `enSha` and signs
  `reviewedBy: MAR` only in its fix stage, after an independent reviewer passed the es and ko strings.
- Tokens only (`packages/design-system`), no emoji, anti-shame, any-age copy (no age words; the persona pages may address
  parents and teachers). No copy claims native-speaker, expert or legal review.
- No telemetry, no cookie, no new script beyond the language menu's small progressive enhancement (section 3.2). The site
  stays a static export.

---

## 1. Decisions

| # | Decision | Replaces | Why |
|---|---|---|---|
| SN-D1 | **A language control in the header of every site page, at every width**: a "Language" disclosure showing the current endonym, opening English / Español / 한국어 as links to the same page in that locale. | The locale switcher in the footer only (`SiteFooter.tsx`), about 2,700 px down on a phone | A visitor who does not read English finds their language on the first screen. The footer switcher stays. |
| SN-D2 | **A small Start pill in the phone header** beside Sign in (it was wide-only), on every page except `/`, where the hero's Start learning is already on the first screen and the phone header keeps the brand name instead (OD-SN-1, OD-SN-2). | `hr-site-wide-only` on the header Start link | A phone visitor on any other page can start without scrolling, and a first-time visitor on `/` reads the product name on the first screen. |
| SN-D3 | **The locale banner shows on every English page**, offering the same page in the suggested locale. | Banner on `/` only, offering the locale's home | A visitor landing on `/teachers` from a link is the one who most needs it. |
| SN-D4 | **Hero: two direct links** "I'm a parent" → `/parents` and "I'm a teacher" → `/teachers`, under the facts line. | "Parent or teacher? Find your page" (scroll to `#who`) | One tap instead of a scroll and a second choice. |
| SN-D5 | **The hero art shows the product**: a phone frame with the first quest's Discover page (real capture, per locale), Hoya waving beside it. | Hoya alone in a square | A new visitor sees what they will do before they tap. |
| SN-D6 | **The page ends on an invitation, not a form**: the brand band becomes the closing call to action (Start learning). The launch-news form moves under it into a quiet plain section, with 64 px controls. | The `brand.primary` band around the launch-news form; the "What does it cost?" block (OD-SN-3) | The last block a visitor sees asks for the one action that matters. The email form stays for those who want news. |
| SN-D7 | **Grown-up pages convert first**: the primary action is "Create a free family space" / "Create a free class" (`/signin?mode=create&persona=<p>`), with "Already have an account? Sign in" under it; the closing blocks change the same way. | "Sign in as a parent / teacher" as the primary action | Almost every visitor of these pages has no account yet; `/signin?mode=create` already opens the create view (`apps/web/src/app/(console)/signin/page.tsx:215`). |
| SN-D8 | **`/teachers` gets "Use it across a whole school"**: school space, up to `SCHOOL_ADMIN_CAP` more administrators by invite link and what they can do, teacher-discretion class moves, `SCHOOL_LEARNER_CAP` students and the School Contract. | Nothing about schools on the site | School administrators, the school cap and class moves are live (section 2.1). A `/schools` page is an owner question (OD-SN-4), not designed here. |
| SN-D9 | **Real product captures** on `/` (1), `/learners` (3), `/parents` (1) and `/teachers` (2), per UI locale, each with alt text from `packages/i18n`, inside a page image budget, each shown only under the claims of what it depicts (`CAPTURE_CLAIMS`, section 3.13). | No product image anywhere on the site | Captures are the most honest promise: what you see is what the app is. Per locale because they hold UI text. |
| SN-D10 | **`/about` ends its promises with Start learning.** | No action on About | About is where a careful visitor decides; the action belongs there. |
| SN-D11 | **Head assets**: favicon and apple-touch icon from `apps/mobile/public/icon-1024.png` (as #804 ships them), and a 1200 x 630 share image per locale (Hoya and the brand with the tagline), with localized alt text. | No favicon (404), no share image | Tabs and chat-app link previews are a first impression too. |
| SN-D12 | **A branded 404 in each locale** inside the site chrome: h1 "Page not found", one line, the home link, Start learning; no Next default block. | Next's English "404 \| This page could not be found." on every path | A lost visitor gets a way on in their language (row SN-2, #804). |

## 2. Where things stand (basis `619f4ae2b`, checked in code and on the export)

### 2.1 Product facts the new copy relies on (each checked in code)

| Fact | Where it is true |
|---|---|
| A school has its owner and up to 2 more administrators, invited by link | `SCHOOL_ADMIN_CAP = 2` (`packages/content-schema/src/schemas/entitlement.ts:178`); SA-2 and SA-4 merged (#758, #760, integrated in #762) |
| A school holds up to 50 students; more through a School Contract | `SCHOOL_LEARNER_CAP = GROUP_LICENSE_LEARNERS` = 50 (`entitlement.ts:176`, `:91`); `console.billing.planTitle.school_seat` "School Contract" |
| Administrators open class lists and reports and move students between the school's classes; billing stays with the owner | AMENDMENTS-SEATS-ADMINS SA-D11; `console.billing.readOnly.schoolAdmin` ("The school's owner manages this plan.") |
| A teacher can move a student to another class; the family gets a notice; the student types no new code | AMENDMENTS-TEACHER-VISIBILITY-TRANSFER; TV-B, TV-C, TV-D merged (#696, #700, #701); `CLASS_TRANSFER` on (owner decision 2026-10-14). Kill switches (`CLASS_TRANSFER=disabled`, `NEXT_PUBLIC_CLASS_TRANSFER`) exist; section 3.6 says what the site does if one is used |
| The console's student cards show a Learning Route row (`JourneyStrip`) and the level check's starting spot (`StartingSpot`, `PlacementParts.tsx`); Learner Home shows "See your Learning Route" and a Route tab | `apps/web/src/app/(console)/teach/space/page.tsx` (roster card); `SITE_CLAIMS.learningRoute: false`, `levelCheck: false`, so no capture shows them (section 3.13) |
| `/signin?mode=create&persona=<p>` opens the grown-up create view with that persona's hint | `apps/web/src/app/(console)/signin/page.tsx:215` (`params.get('mode') === 'create'`), `personaHint(params)`; `lang` travels (`lib/console/signin-flow.ts:254`) |
| UI in English, Spanish and Korean, all shipped | `LOCALE_STATUS` (`packages/i18n/src/locales.ts:31-35`) |
| Learners need no email or password | F-APP-001 OD-2; the learner setup asks a name and a Hoya only (capture walk, `tools/capture-app.mjs`) |
| Lecture mode on by default; class join link and QR code; text size on every page; one UI language per device; inline rename | LV-7 (#750), OR-UX (#734), DN-3b (#733), owner items 6 and 7 (#731), SA-3 (#759) |
| Stripe is sandbox only; plans are not on sale | `SITE_CLAIMS.paidPlans: 'coming'` (`site-claims.ts`) |

### 2.2 What a new visitor meets today (the export of `619f4ae2b`, 375 x 812 unless said)

| # | Finding | Fixed by |
|---|---|---|
| F1 | The only language control is the footer switcher, about 2,700 px down the home on a phone. | SN-1 (SN-D1) |
| F2 | Phones have no Start in the header: on `/parents` or `/teachers` the learner app is two scrolls away or behind the secondary button. | SN-1 (SN-D2) |
| F3 | The locale banner appears on `/` only (`HomePage.tsx`, `locale === DEFAULT_LOCALE && …`); a Spanish visitor landing on `/teachers` never sees it. | SN-1 (SN-D3) |
| F4 | "Parent or teacher? Find your page" scrolls to `#who`, where the visitor chooses again. | SN-1 (SN-D4) |
| F5 | No product is shown anywhere: the hero art is Hoya in a square. | SN-1 (SN-D5, SN-D9) |
| F6 | The page ends on a launch-news band whose button read "Send me the invite" although the app is live. | #806 (copy), SN-1 (layout, SN-D6) |
| F7 | `/parents` and `/teachers` lead with "Sign in as a parent / teacher", a wall for the visitor with no account. | SN-1 (SN-D7) |
| F8 | `/teachers` says nothing about schools, administrators, the school cap or class moves. | SN-1 (SN-D8) |
| F9 | `/about` has no action. | SN-1 (SN-D10) |
| F10 | Every unknown path, `/es/…` and `/ko/…` included, shows Next's English "404 \| This page could not be found." block, whose inline `prefers-color-scheme: dark` style turns the body black under the site's light chrome in dark mode. | SN-2 (#804, SN-D12) |
| F11 | `/favicon.ico` is a 404; the share card has no image; several pages reuse the home title. | SN-2 (#804, SN-D11) |
| F12 | Old-version copy: the About promises say "plain, simple English (CEFR Pre-A1)" and a multiplication gate (the gate is a PIN); the Korean FAQ says instructions are in English; "More stages are coming" while later stages ship; Sign in links drop `lang`. | #806 |
| F13 | `/es/learners` and `/ko/learners` show English card glosses and game blurbs, and list games a Stage 1 learner never plays. | #807 |
| F14 | The app shows "See your Learning Route" on Home while the site's `learningRoute` claim is `false`. | Owner decision (OD-SN-8); no site line changes here, and no capture shows the Learning Route while the claim is off (section 3.13) |

## 3. Behaviour (amends F-SITE-002)

### 3.2 Header and footer [SN] (amends F-SITE-002 §3.2)

Wireframe `newuser-header-language.md`; mock: every `mock/<locale>/*.html`, shots `header-<locale>-*-lang-open.png`.

- **DOM order = visual order at every width:** skip link · brand · Start · nav (`Learners` `Parents` `Teachers`, from
  45em) · **Language** · Sign in. Phones (below 45em): `[brand] … [Start][Language][Sign in]`, the Start link pushed to
  the right with an auto margin; wide: Start beside the brand, the nav pushed right. No `order` in CSS.
- **Start** renders at every width on every page except `/` (it loses `hr-site-wide-only` there); on `/` it keeps
  `hr-site-wide-only`, as today, because the hero's Start learning is on the first screen (OD-SN-1, default after review
  round 3). Visible text `landing.nav.startShort`; accessible name `landing.nav.start` (`aria-label`), which contains the
  visible text in every locale (WCAG 2.5.3). Below 45em: padding `spacing.sm`, text `typography.size.bodySm`; from 45em:
  padding `spacing.xl`, text `body`. Hit area at least 64 x 64. On `/` below 45em the language control takes the auto
  margin that pushes the controls right.
- **Language control** (`LanguageMenu`, new client component in `components/landing/`): a native `<details>` with a
  `<summary>` holding a decorative globe glyph (`currentColor`, `aria-hidden`), the visually hidden word
  `landing.footer.language`, and the current endonym `LOCALE_META[locale].endonym` in a span with `lang`. Below 45em the
  glyph sits over the endonym in `typography.size.caption` inside one 64 x 64 box; from 45em glyph, endonym and a chevron
  sit in a row (`bodySm`). On phones a small chevron sits beside the globe (the disclosure's visual cue); from 45em it follows the endonym. The menu is a list of `shownSiteLocales()`, one plain `<a>` per locale to
  `sitePath(target, page)` (on the 404 pages, whose path is unknown at build time: `sitePath(target, '/')`) with `lang`
  and `hrefLang` set to `LOCALE_META[target].htmlLang`, each at least 64 px tall; the
  current one has `aria-current="page"`, bold text and a check glyph (not colour alone). Menu surface `surface.paper`,
  `border.subtle` hairline, `radii.lg`, `cardShadow()`, `z.sticky`, positioned against the header row (the header's
  wrap is the containing block) at its right content edge, so it stays on screen when large text wraps the control to a
  second row; width at least `min(12rem, 100vw - 2 gutters)` and at most `100vw - 2 gutters` (`layout.gutter.compact`). Endonyms are values from `LOCALE_META`, never message strings.
  Without JavaScript `<details>` opens and closes natively; with it, Escape and a pointer down outside close the menu and
  return focus to the summary. Not rendered while only one locale is shown (as `LocaleSwitcher`).
- **The legal variant** (`/privacy`, `/terms`) gets the language control too; it still has no Start and no Sign in.
- **Brand:** the mark shows at every width, its box sized in rem (3rem, `spacing.xxxl` / 16) so enlarged text cannot
  split it. The name shows from 30em to 45em and from 60em on every page, and **on `/` also from 22.5em (360 px) to
  45em** (OD-SN-2, default after review round 3), so a first-time visitor on a phone reads "Hangul Route" on the first
  screen. Below 45em the header row has no column gap (each control is already a 64 px hit area). Constants: add
  `brandName: 30em` and `brandNameHome: 22.5em` to `SITE_BREAKPOINTS` with these derivations (Spanish labels: with Start,
  mark 64 + Start 82 + Language 64 + Sign in 66 = 276 px of the 288 px inside a 320 px screen, so no name; on `/`, mark 48
  + name about 130 + Language 64 + Sign in 66 = 308 px, more than the 288 px inside a 320 px screen and less than the
  328 px inside a 360 px one). Measured on the mocks: one
  81 px row at 320 and 375 px on every page and locale.
- **Locale banner on every English page** [SN]: `SiteShell` renders `LocaleBanner` for `locale === DEFAULT_LOCALE` on
  every site page (not the legal variant), and `localeBannerOffers(shown, page)` builds `href = sitePath(target, page)`;
  on the English 404 it offers `sitePath(target, '/')` (the unknown path would be another 404). Session dismissal is
  unchanged.
- **Footer:** unchanged (the locale switcher stays).

### 3.3 Home `/` [SN] (amends F-SITE-002 §3.3)

Wireframe `newuser-home.md`; mock `mock/<locale>/home.html`.

1. **Hero.** h1, lead, `PrimaryAction` Start learning (unchanged), then the facts line `home.hero.facts` right under the
   action (as #806 words it), then a row of two text links, each at least 64 px tall: `home.hero.forParents` →
   `sitePath(locale, '/parents')` and `home.hero.forTeachers` → `sitePath(locale, '/teachers')` (`next/link`, inside the
   site). `home.hero.grownUps` and its `#who` link are removed; `#who` keeps `tabIndex={-1}` for old anchors.
2. **Hero art.** The art box keeps `brand.primaryLight` and `radii.xxl`. Inside: a phone frame (bezel `text.primary`,
   `spacing.xs`, top corners `radii.xl`, cut at the box's lower edge) holding the `discover` capture (section 3.13) as an
   `<picture>`: from 45em the `discover` capture (top 650/390 of the screen shown), below 45em the tighter
   `discover-narrow` crop (the title, the first letter's tile and Hear it), so the words stay readable on a phone (review
   round 3). The `<img>` has `width`/`height`, `fetchPriority="high"`, is not lazy, and has alt
   `landing.captures.discover(FIRST_LETTER, romanization)`. Hoya waving (34 % of the box, bottom left) and the speech
   bubble above Hoya stay `aria-hidden`; below 45em the phone frame is 60 % of the box from 40 % and the bubble at most
   34 % wide, so the bubble never covers the frame; from 45em the frame is 52 % from 30 % and the bubble 44 %. Every size
   inside the box is a percentage of it, so 200 % text never widens the page. The capture shows the same letter the
   bubble names (`FIRST_LETTER`, ㅏ since #806).
3. `#who`, How it works and the promises: unchanged.
4. **"What does it cost?" leaves `/`** (OD-SN-3, default): its free line is the first sentence of the closing band; the
   plan lines stay on `/parents` and `/teachers`.
5. **Closing band** (new `section`, `aria-labelledby`): `brand.primary` fill, `radii.xxl`, centred; h2
   `home.closing.title` (`typography.size.title`, `text.onPrimary`), one line `home.closing.body`, and Start learning
   (`learnerStart(locale)`) as a light pill: `surface.paper` fill, `brand.primaryDark` text, `touchTarget.child` tall,
   full width up to 22rem below 45em. Focus ring on the band `text.onPrimary` (the S-D band rule).
6. **Launch news** (`#news`, `#get` kept) becomes a plain `hr-site-section` after the band, set apart by
   `spacing.xl` above its rule so it reads as optional news, not as part of the band's "no email" promise: h2 and line (#806's words),
   then `WaitlistForm` with a new prop `tone: 'band' | 'plain'` (default `'band'`, so no other caller changes). `plain`:
   status, consent and success text `text.secondary`, inline links `brand.primaryDark`, field and button
   `touchTarget.min` (64) tall. The consent words are unchanged (`CONSENT_TEXT_VERSION` stays). SN-1 removes the
   `input email` and `button submit` lines of `/` from `e2e/fixtures/landing-touch-allowlist.json`; the two inline links
   keep theirs.

### 3.4 `/learners` [SN] (amends F-SITE-002 §3.4)

Wireframe `newuser-learners-captures.md`. In "How most quests work", after the steps and Hoya's line and before the
mini-games fold, a list of three phone captures (`home`: the top of Home down to the Start button, without the Learning
Route link or the tab bar; `game`: the first listen-and-pick question; `card`: the tiger card's face), always three
across (each a third of a row at most 34rem wide, top-aligned, each at its own height), bezel 3 px of `text.primary`,
radius `radii.lg`, lazy, each a `<figure>` with a short visible
`<figcaption>` (`landing.captures.caption.*`, caption size, `text.secondary`) so a sighted visitor reads them as a
sampler of real screens, not as pictures of steps 1 to 3 (review 1), and each with its alt text (`landing.captures.home`, `.game`, `.card(word, romanization, meaning)`;
the card's Korean word and romanization are values from the card data, the meaning its gloss in the UI language).
Nothing else changes (#807 owns the folds' language).

### 3.5 `/parents` [SN] (amends F-SITE-002 §3.5)

- Head: primary `PrimaryAction` **`persona.parents.create`** → `siteLinks.createAccount('parent', locale)`; secondary
  Start learning (unchanged, OD-SN-5); under the action row, the text link **`persona.haveAccount`** →
  `siteLinks.signIn('parent', locale)` (64 px tall).
- Follow along: after its lines, the `report` capture in a small phone frame (12rem, or the column if narrower), lazy,
  alt `landing.captures.report`, rendered only when `showsClaim(claims, 'parentReports', locale)` (section 3.13); with the
  claim off the figure is not rendered and nothing is left in its place. The capture runs from the period tabs to the end
  of "What to practice next": no print hint, no "Now on Stage" line, no tiles cut at the bottom (review round 3).
- Closing block: line unchanged; `persona.parents.create`, then `persona.haveAccount` under it.
- `persona.parents.signIn` has no reader after this and is removed (en, es, ko).

### 3.6 `/teachers` [SN] (amends F-SITE-002 §3.6)

- Head and closing: as `/parents` with `persona.teachers.create` and `createAccount('teacher', locale)`; the secondary
  stays "Try it as a learner". `persona.teachers.signIn` is removed.
- **Media row** after Plan and assign / See how the class is doing: the `class-list` capture (review round 3: the class
  page from the class name through the class code, the join link and "This week", **no student cards**, because each
  card carries the Learning Route row and the level check's starting spot, whose claims are off) in a card frame
  (`surface.paper`, `border.subtle`, `radii.lg` on all four corners, `cardShadow()`), as a `<picture>` whose source below
  45em is `class-list-narrow` (the "This week" card alone, taken at 390 px, so it is readable on a phone); and the
  `lecture-slide` capture in a dark screen frame (`text.primary`, padding `spacing.sm`, `radii.lg`); two equal columns
  from 45em, stacked below; lazy; alt `landing.captures.classList`, `.lectureSlide`. The class page capture renders only
  under `showsClaim(claims, 'teacherReports', locale)` (its "This week" summary and Class report are the class
  statistics that claim covers), the slide only under `showsClaim(claims, 'lectureMode', locale)`. With one off, the
  other takes the whole row; with both off the row is not rendered.
- **New section "Use it across a whole school"** (`teachers-schools`, after the media row, before Privacy for classes):
  h2 `persona.teachers.schools.title`, then four sentences as a plain list, in this order: `.space`,
  `.admins(SCHOOL_ADMIN_CAP)`, `.moves` (scoped to the school's classes: a move inside one school needs no code and no
  new join), `.size(SCHOOL_LEARNER_CAP, CONTACT_EMAIL)`. The caps come from
  `@hangul-route/content-schema`, the address from `data/contact.ts`; the address is plain text (the footer's Contact link
  stays the tappable one, so no new small inline link). Not behind a claim (section 2.1). No price, no plan term.
- **Plans words wait for plans** (review round 3): while `paidPlans` is `'coming'` (Stripe sandbox; the Plans block on
  the same page says plans are on the way), the administrators line ends after what administrators can do (T3 applied:
  no "The owner manages the plan.") and the size line invites a message without naming a product ("Need more? Write to
  {email}."). When `paidPlans` becomes `'inApp'`, the line `.ownerPlan` ("The school's owner manages the plan.", as `console.billing.readOnly.schoolAdmin`) follows
  `.admins`, and whether `.size` becomes `.sizeContract` (naming the School Contract) is OD-SN-13; that flip PR changes
  both, with their es and ko.
- **If a production kill switch is used.** The moves line follows `CLASS_TRANSFER`; the administrators line follows
  AMENDMENTS-SEATS-ADMINS SA-D11. Neither is a site claim (both are on by owner decision and a kill switch is for an
  incident), so the rule is the LV-D1 one: switched off for more than a day means a PR removing the moves line (or
  rewording the administrators line to the changed SA-D11 powers) and a site redeploy; the `CLASS_TRANSFER` runbook names
  this step (SN-1 adds one line to it).
- **Word budget** (550): measured 412 (en at 375 px; 417 at 1280; es 437) with this section; within budget. Trims the
  owner may take, not applied: T1 drop "No ads, and no data sold." from Privacy for classes (the home promise and
  `/parents` carry it), T2 fold the initials line into See how the class is doing and drop the Privacy section (about
  130 px on a phone). (T3 is applied, above.) The school cap also appears in #806's Plans line (`plans.freeSizes`); see
  OD-SN-11.

### 3.7 About and 404 [SN] (amends F-SITE-002 §3.7)

- `/about`: after the promises list, `PrimaryAction` Start learning (`landing.nav.start`, `learnerStart(locale)`). Body
  unchanged (#806 corrects its promises).
- **404** (row SN-2, #804): `out/404.html`, `out/es/404.html`, `out/ko/404.html`, served by the Worker's
  `not_found_handling = "404-page"` (nearest `404.html` up the path, status 404). Each is the site header and footer in
  its locale, Hoya **waving** (decorative, OD-SN-7; 4.5rem below 45em and 7rem from 45em, so Start learning ends on the
  first screen at 320 x 568 in every locale, measured 446 / 515 / 488 px en / es / ko), h1 `notFound.title`, line
  `notFound.body`, the text link
  `notFound.home` → `sitePath(locale, '/')`, and `PrimaryAction` `notFound.start` → `learnerStart(locale)`; `robots:
  noindex`; no import of `next/dist/client/components/not-found-error`. The header's language links (and, on the English
  404, the locale banner) go to `sitePath(target, '/')` (section 3.2). #804 rebases onto this design: its art moves from
  `thinking` to `waving`, its home link becomes the text link above the primary action.

### 3.8 Links [SN] (amends F-SITE-002 §3.8)

```ts
/** Grown-up sign-in; with a persona, its intro; `lang` from /es and /ko (#806). */
export function signIn(persona?: GrownUpPersona, locale?: UiLocale): string;
/** [SN] The create view of /signin: `${grownUpOrigin()}${APP_ROUTES.signIn}?mode=create&persona=<p>`, plus `lang` from /es and /ko. */
export function createAccount(persona: GrownUpPersona, locale: UiLocale = DEFAULT_LOCALE): string;
```

`createAccount` follows every rule of `signIn` (never `/teach`, `/parent`, `/account`, `/billing`; one origin variable).

### 3.11 Length, glance and image budgets [SN] (amends F-SITE-002 §3.11)

Measured on the mocks after review round 3 (`design/screens/site/newuser/measurements.json`, macOS Chromium; words are
`innerText` tokens, "375" and "1280" name the viewport): `/` 2,965 px at 375 (es 3,227, ko 2,960) and 2,192 at 1280, 274
words at 375 (278 at 1280); `/teachers` 3,954 at 375 (es 4,187) and 3,453 at 1280, 412 words at 375 (417 at 1280). The
closing band and the hero capture cost about 180 px on a phone and are worth it; the budgets move as follows. Spanish
and Korean keep the 10 % `LOCALE_ALLOWANCE`. The `/` headroom keeps about 185 px above the mock for claim lines that
switch on later (review round 3); SN-1 re-measures every page on the CI image before it fixes the numbers (CI fonts
change heights, F-SITE-002 §3.11), and lowers a budget only with that measurement in its PR.

| Page | Height at 375 x 812 (headroom) | Height at 1280 x 800 | Words | First screen |
|---|---|---|---|---|
| `/` | at most **3,250** (was 2,900); headroom **3,150** (was 2,810) | at most **2,300** (was 2,100) | at most **300** (was 280) | at 320 x 568: header, h1, lead, Start learning (unchanged). At 375 x 812: also the two grown-up links and the brand name, every locale **[SN]** |
| `/learners`, `/parents` | at most 4,060 (headroom 3,700, unchanged) | at most 3,200 | at most 550 | unchanged; `/parents` and `/teachers` at 320 x 568 show the Create button |
| 404 (each locale) | — | — | — | at 320 x 568: header, Hoya, h1, line, home link and Start learning **[SN]** |
| `/teachers` | at most **4,300** (headroom **4,150**) | at most **3,600** | at most 550 | as `/parents` |

- **Header:** at 320 and 375 one row at most 96 px **in every locale** (it now holds four controls on phones, three and
  the brand name on `/`); with 200 % text, at most two rows at 320 px and never sideways (unchanged). Measured: 81 px;
  177 px (two rows) with 200 % text.
- **Images [SN]:** the page's own capture files, one locale, every `<picture>` source counted (a visitor downloads only
  one of each pair), at most: `/` 40 KB, `/learners` 70 KB, `/parents` 60 KB, `/teachers` 80 KB (measured 23.5 / 19.5 /
  30.2 / 43.4 KB en; the largest locale, es, 25.4 / 21.2 / 33.3 / 49.0 KB). Share images at most 60 KB each, icons as
  #804 (under 40 KB).
- `site-word-budget.test.tsx` counts the visually hidden "Language" word and the endonym; the closed language menu's
  items are not counted (closed `<details>`).

### 3.13 Product captures [SN] (new)

- **Files:** `apps/web/public/site/<locale>/<name>.<hash8>.webp` for `discover` (520 px wide), `discover-narrow`,
  `home`, `game`, `card` (400), `report`, `class-list-narrow` (600), `class-list` (720), `lecture-slide` (1080), heights
  as cropped, WebP quality 72; the hash is the file's content
  hash, written to `apps/web/src/data/site-captures.generated.ts` (`{ [locale]: { [name]: { src, width, height } } }`), so
  `public/_headers` can mark `/site/*` `immutable` like `/_next/static/*`.
- **Made by** `apps/web/scripts/site-captures.mjs` (SN-1; from `design/screens/site/newuser/tools/capture-app.mjs` and
  `capture-console.spec.ts`), run on demand by a person, never in CI or a build. It walks the release learner bundle with
  no API (setup as "Me", new to Korean, quest 1) and the console export with the reports e2e fixtures (API mocked), every
  label read from the dictionary in the capture's locale, a silent stand-in speech engine with one Korean voice. Only
  made-up first names appear (Dami; the class Sunflower with Mina, Jun, Ava and others). No real account, no network.
- **Crops** (review round 3; the encoder finds each box in the pixels, so a copy change that moves a line moves the
  crop): `home` from the top to 12 px under the Start button, taken 430 px wide (at 390 the Korean greeting breaks
  before its comma, section 11); `discover-narrow` from the title to under Hear it; `game` from under the Close row to
  the last letter tile; `card` the card face; `report` from the period tabs to the end of "What to practice next";
  `class-list` from the class name to the end of "This week" at 720 px; `class-list-narrow` the "This week" card at
  390 px, 2x.
- **Captures follow claims [SN]:** `apps/web/src/data/site-captures.ts` exports `CAPTURE_CLAIMS: Record<CaptureName,
  readonly BooleanClaimKey[]>`, the claims of every feature a capture shows (`report`: `parentReports`; `class-list` and
  `class-list-narrow`: `teacherReports`; `lecture-slide`: `lectureMode`; `discover`, `discover-narrow`, `home`, `game`,
  `card`: none). A page renders a capture only when `showsClaim(claims, key, locale)` is true for every listed key, so
  `CLAIM_LOCALES` and a rollback (LV-D1) apply to pictures as they do to lines. A capture must not show a feature whose
  claim is off: the Learning Route (`learningRoute`) and the level check's starting spot (`levelCheck`) stay out of every
  crop today. A claim-flip PR may add a capture of its feature with that claim listed (F-SITE-002 §3.9).
- **Markup:** `<img>` (inside `<picture>` with a `(min-width: 45em)` source for `discover` and `class-list`) with
  `width`, `height`, `alt`, `decoding="async"`; `loading="lazy"` except the hero capture (`fetchPriority="high"`). Not
  links. Alt text from `landing.captures.*` in the page's locale; the hero's and the card's taught Korean is passed in
  with its romanization.
- **Refresh** (OD-SN-6): when a captured screen changes visibly, the PR that changes it reruns the script for the
  affected names (its checklist names this section); a stale capture is still the real app, so nothing fails on it. A
  capture is never taken to show a known defect; when a defect that a crop or width works around is fixed (section 11),
  the fixing PR retakes the affected captures at the standard crop.
- **Hidden locales:** pruned with the locale (`prune-hidden-locales.mjs` removes `public/site/<locale>/` from `out/`).

### 3.14 Head assets [SN] (new; row SN-2)

- Icons as #804: `public/favicon.ico` (48), `public/icon.png`, `public/apple-icon.png` (180), from
  `apps/mobile/public/icon-1024.png`, listed in `metadata.icons` on site and 404 pages only.
- **Share image** per shown locale: `public/site/<locale>/og.png`, 1200 x 630 (design `head/og-<locale>.png`): Hoya waving
  on a `brand.primaryLight` circle, the brand mark and name, the locale's `landing.meta.tagline` (Korean breaks between
  words), the host. Made by `apps/web/scripts/site-og.mjs` from the design tool `tools/build-head.mjs`, on demand.
  `openGraph.images: [{ url: absolute, width: 1200, height: 630, alt: landing.captures.og(brandName, tagline) }]` and
  `twitter.card: 'summary_large_image'` with the same image, on every site page of that locale.

## 4. Accessibility

- Every new control at least 64 x 64 (`touchTarget.min`); primary actions `touchTarget.child` where they are the page's
  main action (band, About, 404). The only controls under 64 px stay the two inline links of the unchanged consent line.
- Focus order = DOM order = visual order, including the language control; focus ring `border.focus` (on the band
  `text.onPrimary`). The menu's current item is marked by weight and a check, not colour alone.
- 200 % text (browser default font size, F-SITE-002 §3.11 method): nothing scrolls sideways at 320 px or at 720 px on any
  page in any locale (measured on the mocks); the header wraps to two rows at 320 px.
- Images: every capture has alt text describing what it shows; Hoya, the bubble, glyphs and frames are decorative.
- `lang` on every endonym and every language link; `hreflang` on the language links and the banner link.
- Contrast: only existing token pairs (`text.onPrimary` on `brand.primary`, `brand.primaryDark` on `surface.paper` and
  on `surface.canvas`, `text.secondary` and `text.muted` on `surface.canvas`).

## 5. Privacy, safety and telemetry

No new data, cookie, script beyond `LanguageMenu`'s close handlers, or telemetry. Captures hold made-up names only and are
taken offline. The share image holds no personal data.

## 6. Owner decisions (each has a default; each gates only the row named)

| # | Question | Default (applies until answered) | Gates |
|---|---|---|---|
| OD-SN-1 | Keep the header Start pill on `/` on phones too, or leave it wide-only there (the hero has the big button)? | Wide-only on `/` (changed after review round 3: it costs the brand name on the first screen) | SN-1 |
| OD-SN-2 | On phones the brand name shows from 30em (480 px) on pages with the Start pill, the mark alone below. Or a two-row phone header with the name? | Mark alone below 30em on those pages; on `/` the name from 22.5em (360 px) | SN-1 |
| OD-SN-3 | Remove the "What does it cost?" block from `/` (its free line opens the closing band) or keep it above the band? | Remove | SN-1 |
| OD-SN-4 | A future `/schools` page? | Not now: a section on `/teachers` (SN-D8). Not designed here | — |
| OD-SN-5 | Keep Start learning as the secondary action on `/parents`? | Keep (a parent can try the first quest before creating anything) | SN-1 |
| OD-SN-6 | How often are captures refreshed? | On demand, by the PR that visibly changes a captured screen | SN-1 |
| OD-SN-7 | The 404's Hoya pose? | Waving (thinking is the app's "not quite" face; a missing page is not the visitor's miss) | SN-2 |
| OD-SN-8 | The app shows the Learning Route on Home while `learningRoute` is `false` on the site. Flip the claim (F-ROUTE-001 R-10 rule)? | No change here; the claim stays as it is, and the captures follow it: none shows the Learning Route while it is off (section 3.13) | — |
| OD-SN-9 | The class-moves line says "The family is told": exact for a learner in a family; a learner in no family has nobody else to tell. Keep the owner's wording? | Keep | SN-1 |
| OD-SN-10 | "No email or password" appears in the hero facts line (#806) and again in the closing band. Keep the reprise? | Keep: the band is read by someone who scrolled past the hero | SN-1 |
| OD-SN-11 | The school cap appears twice on `/teachers`: in the schools section (owner's sentence) and in #806's Plans line (`plans.freeSizes`, "…a school up to 50"). Keep both, or drop the school figure from the Plans line on `/teachers`? | Keep both (the schools sentence is the owner's; the Plans line lists every free limit in one place) | SN-1 |
| OD-SN-12 | The hero capture's own heading is "Four New Letters" while the bubble (#806) says "Let's meet ㅏ (a)". Keep the pairing (ㅏ is the first of the four and the largest thing on the screen), or word the bubble in the plural (a #806 copy change)? | Keep | — |
| OD-SN-13 | The owner's size line invites people to "write … about a School Contract". Plans are not on sale (`paidPlans: 'coming'`, Stripe sandbox) and the Plans block on the same page says so. May the site name the School Contract before `paidPlans` is `'inApp'`? | No: until then "Need more? Write to {email}." (`.size`); `.sizeContract` waits for the owner or the `paidPlans` flip | SN-1 |

## 7. PR table

| Row | PR | Needs | Check |
|---|---|---|---|
| SN-0 | `design(site)`: this amendment, the wireframes, the mocks, captures, head drafts, measurements (this PR) | — | multi-agent review (section 12) |
| SN-1 | `feat(web,i18n)`: site entry. §3.2 header (phone Start pill off `/`, `LanguageMenu`, brand rules, banner on every English page), §3.3 home (hero links, hero capture with its phone crop, band, quiet news with `WaitlistForm tone`, cost block off), §3.4 learners captures, §3.5 / §3.6 create-first, media row, schools section, §3.7 About action, §3.8 `createAccount`, §3.11 budgets (re-measured on CI), §3.13 captures (script, generated manifest, `CAPTURE_CLAIMS`, files, `_headers`), appendix A strings (en, es, ko), allowlist shrink, the `CLASS_TRANSFER` runbook line | SN-0; #806 and #807 merged (rebase) | section 8 |
| SN-2 | `fix(web,i18n)`: #804 (titles, icons, 404, legal accuracy) rebased onto this design: the 404 per §3.7 (waving, link then action), plus §3.14 share images per locale and `landing.captures.og` | SN-0 | section 8 |

Order: SN-0, then SN-2 and SN-1 in either order (they share `messages/*/landing.ts` and `site-metadata.ts`; the second
rebases). Each changes `en` landing strings and signs the ledger in its fix stage only.

## 8. Tests per row

| Row | File | What it pins |
|---|---|---|
| SN-1 | `lib/__tests__/site-links.test.ts` | `createAccount(p, l)`: `/signin?mode=create&persona=<p>`, `lang` only off English, both origins, never `/teach`, `/parent`, `/account`, `/billing` |
| SN-1 | `app/__tests__/site-chrome.test.tsx` | header DOM order (skip, brand, Start, nav, Language, Sign in); Start has no `hr-site-wide-only`, visible `startShort`, name `nav.start`; `LanguageMenu`: one `<details>`, endonyms from `LOCALE_META` (a message holding an endonym fails), `lang`/`hrefLang` on each link, `aria-current` on the current one, links to `sitePath(target, page)` on every page; legal variant has Language but no Start or Sign in; not rendered with one shown locale |
| SN-1 | `components/__tests__/LanguageMenu.test.tsx` | Escape and an outside pointer close it and focus the summary; works with JavaScript off (static markup is a `<details>`) |
| SN-1 | `app/__tests__/landing-layout.test.tsx` | hero links to `/parents` and `/teachers` per locale, no `#who` hero link, facts line right after the primary action; capture `img` with alt from `captures.discover` and the `FIRST_LETTER` romanization; band with `closing.*` and the app link; no cost block on `/`; `#news` after the band, `WaitlistForm tone="plain"` |
| SN-1 | `components/__tests__/WaitlistForm.test.tsx` | `tone` default `band` unchanged; `plain` colours from tokens; 64 px field and button; consent text byte-identical |
| SN-1 | `app/__tests__/persona-pages.test.tsx` | Create as the primary action (head and closing) with `createAccount`, the have-account link with `signIn(persona, locale)`, no `persona.*.signIn` key read; teachers schools section: order, values 2, 50 and the address from their constants (changing a constant changes the line), no price, no term, not hidden with every claim off; with `paidPlans: 'coming'` no `.ownerPlan` line and `.size` (not `.sizeContract`), with `'inApp'` the `.ownerPlan` line; media row and report capture with their alt text; **with every claim off** no report, class page or slide capture and no empty media row; with `lectureMode` alone on, the slide alone takes the row; a locale outside `REPORT_REVIEWED_LOCALES` gets no report capture |
| SN-1 | `app/__tests__/site-captures.test.ts` (new) | every shown locale has every capture in the manifest and on disk; width/height match the file; total bytes per page within §3.11; no capture listed for a hidden locale; `CAPTURE_CLAIMS` names every capture, and no capture lists a claim whose `SITE_CLAIMS` value is `false` while a page renders it (a capture of a feature whose claim is off fails) |
| SN-1 | `app/__tests__/site-word-budget.test.tsx` | the new word budgets (home 300) with `ALL_CLAIMS_ON` |
| SN-1 | `packages/i18n` (`landing-messages.test.ts`, `length-budget.test.ts`, `samples.ts`) | appendix A keys in en, es, ko; banned and audience words; no endonym or email typed into a message; es/ko length allow-list where the h1/h2 wraps |
| SN-1 | `e2e/site-budgets.spec.ts` | §3.11 heights, headroom, words, first screens (Create at 320 x 568 on persona pages; grown-up links and the brand name at 375 x 812 on `/`), header one row in every locale, image bytes |
| SN-1 | `e2e/landing-layout.spec.ts`, `landing-locales.spec.ts` | no sideways scroll at 320 / 375 / 768 with the language menu open and closed; Tab order = visual order with the Language control; the allowlist without the field and button lines |
| SN-1 | `e2e/locale-banner.spec.ts` | `/parents` with an `es` browser offers `/es/parents`; dismissal holds across pages in the session |
| SN-1 | `e2e/waitlist.spec.ts` | the form submits in `tone="plain"` (API mocked) |
| SN-2 | #804's tests, plus `lib/__tests__/site-metadata.test.ts` | each shown locale's pages carry an absolute `og:image` 1200 x 630 with alt `captures.og`, `twitter:card` `summary_large_image`; the files exist and are at most 60 KB |
| SN-2 | `e2e/locale-routes.spec.ts` | `/nope`, `/es/nope`, `/ko/nope`: status 404, `lang`, h1, home link and Start learning on the first screen at 320 x 568 and 375 x 812, no `.next-error-h1`; the language links (and the English 404's banner) point at `sitePath(target, '/')` |

## 9. Appendix A — strings (`landing` namespace; en, es, ko)

Values in braces are passed in. New keys unless marked changed or removed.

| Key | en | es | ko |
|---|---|---|---|
| `nav.startShort` | Start | Empezar | 시작 |
| `home.hero.forParents` | I'm a parent | Soy madre, padre o tutor | 부모 또는 보호자예요 |
| `home.hero.forTeachers` | I'm a teacher | Soy docente | 선생님이에요 |
| `home.hero.grownUps` | *(removed)* | *(removed)* | *(removed)* |
| `home.closing.title` | Ready for your first Korean letter? | ¿Vamos por tu primera letra coreana? | 첫 한글 글자를 만나 볼까요? |
| `home.closing.body` | Stage 1 is free. No email or password. Your first quest takes about five minutes. | La Etapa 1 es gratis. Sin correo ni contraseña. Tu primera misión dura unos cinco minutos. | 1단계는 무료예요. 이메일도 비밀번호도 필요 없어요. 첫 퀘스트는 5분 정도면 돼요. |
| `persona.parents.create` | Create a free family space | Crear un espacio familiar gratis | 무료 가족 공간 만들기 |
| `persona.teachers.create` | Create a free class | Crear una clase gratis | 무료 반 만들기 |
| `persona.haveAccount` | Already have an account? Sign in | ¿Ya tienes una cuenta? Entrar | 이미 계정이 있나요? 로그인 |
| `persona.parents.signIn`, `persona.teachers.signIn` | *(removed)* | *(removed)* | *(removed)* |
| `persona.teachers.schools.title` | Use it across a whole school | Úsalo en toda una escuela | 학교 전체에서 함께 써요 |
| `persona.teachers.schools.space` | Create a school space, then invite teachers or create classes for them. | Crea un espacio de escuela y después invita a docentes o crea tú las clases de cada docente. | 학교 공간을 만든 뒤, 선생님을 초대하거나 선생님 대신 반을 만들어요. |
| `persona.teachers.schools.admins(admins)` | Add up to {admins} more administrators with an invite link. They can open class lists and reports and move students between the school's classes. *(one: "1 more administrator")* | Suma hasta {admins} administradores más con un enlace de invitación. Pueden abrir las listas y los informes de las clases y cambiar estudiantes entre las clases de la escuela. *(one: "1 administrador más")* | 초대 링크로 관리자를 {admins}명 더 추가할 수 있어요. 관리자는 반 명단과 리포트를 열고, 학교 안의 반끼리 학생을 옮길 수 있어요. |
| `persona.teachers.schools.ownerPlan` *(shown only with `paidPlans: 'inApp'`)* | The school's owner manages the plan. | El plan lo gestiona quien creó la escuela. | 플랜은 학교를 만든 분이 관리해요. |
| `persona.teachers.schools.moves` | Move a student to another class in the school. Their family is told, and the student never types a new code. | Cambia a un estudiante a otra clase de la escuela. Se avisa a su familia, y el estudiante no tiene que escribir un código nuevo. | 학생을 학교 안의 다른 반으로 옮길 수 있어요. 가족에게 알림이 가고, 학생은 새 코드를 입력하지 않아도 돼요. |
| `persona.teachers.schools.size(students, email)` | A school holds up to {students} students. Need more? Write to {email}. | Una escuela admite hasta {students} estudiantes. ¿Necesitas más? Escribe a {email}. | 학교 하나에 학생은 최대 {students}명이에요. 더 필요하면 {email} 주소로 문의해 주세요. *(no particle on the value, F-I18N-001 §3.10)* |
| `persona.teachers.schools.sizeContract(students, email)` *(OD-SN-13; not rendered until answered)* | A school holds up to {students} students. Need more? Write to {email} about a School Contract. | Una escuela admite hasta {students} estudiantes. ¿Necesitas más? Escribe a {email} para pedir un Contrato Escolar. | 학교 하나에 학생은 최대 {students}명이에요. 더 필요하면 {email} 주소로 학교 계약을 문의해 주세요. |
| `captures.discover(letter, romanization)` | The app on a phone, in the first quest: new letters, starting with {letter} ({romanization}), each with a button to hear it. | La app en un teléfono, en la primera misión: letras nuevas, empezando por {letter} ({romanization}), cada una con un botón para escucharla. | 휴대폰 속 앱의 첫 퀘스트 화면: 새 글자 몇 개와 소리 듣기 버튼. 첫 글자는 {letter}({romanization}). |
| `captures.home` | The learner's home screen: a greeting, the streak and cards so far, and the next lesson with a Start button. | La pantalla de inicio del estudiante: un saludo, la racha y las tarjetas hasta ahora, y la próxima lección con un botón para empezar. | 학습자 홈 화면: 인사, 연속 학습 일수와 모은 카드, 시작 버튼이 있는 다음 레슨. |
| `captures.game` | A mini-game: hear a sound and tap the matching letter. | Un minijuego: escucha un sonido y toca la letra que corresponde. | 미니게임: 소리를 듣고 맞는 글자를 눌러요. |
| `captures.card(word, romanization, meaning)` | A Korean heritage card: {word} ({romanization}), meaning {meaning}. | Una tarjeta de cultura coreana: {word} ({romanization}), que significa {meaning}. | 한국 문화 카드: {word}({romanization}). *(the Korean UI's gloss is the word itself, so the meaning is not repeated)* |
| `captures.report` | A weekly report for one learner: days practiced, what went well and what to practice next. | Un informe semanal de un estudiante: días de práctica, lo que salió bien y qué practicar después. | 학습자 한 명의 주간 리포트: 연습한 날, 잘한 점, 다음에 연습할 점. |
| `captures.classList` | The class page: this week's summary for the whole class. | La página de la clase: el resumen de esta semana de toda la clase. | 반 페이지: 반 전체의 이번 주 요약. |
| `captures.lectureSlide` | A Lecture mode slide on a big screen: a letter, its stroke order and its sound. | Una diapositiva del Modo proyección en pantalla grande: una letra, el orden de sus trazos y su sonido. | 큰 화면에 띄운 강의 모드 슬라이드: 글자, 획순, 소리. |
| `captures.caption.home`, `.game`, `.card` | Home screen · A mini-game · A heritage card | Pantalla de inicio · Un minijuego · Una tarjeta cultural | 홈 화면 · 미니게임 · 문화 카드 |
| `captures.og(brand, tagline)` | Hoya the tiger next to the words {brand}: {tagline} | Hoya, el tigre, junto a las palabras {brand}: {tagline} | 호랑이 호야와 {brand} 로고. 문구: {tagline} |
| `notFound.title` (SN-2, as #804) | Page not found | No encontramos esta página | 페이지를 찾을 수 없어요 |
| `notFound.body` (changed; SN-2, as #804) | The link may be old. Try the home page or start learning. | Puede que el enlace sea antiguo. Prueba la página de inicio o empieza a aprender. | 오래된 링크일 수 있어요. 홈으로 가거나 배우기를 시작해 보세요. |

Reused unchanged: `nav.start` (the Start pill's name, the band, About, 404), `footer.language` (the language control's
hidden word), `home.hero.facts`, `home.news.*` and `waitlist.*` (#806's words), `notFound.home`, `notFound.start`,
`meta.tagline`. Glossary notes: es "Modo proyección" and ko "강의 모드" are the console's own names for Lecture mode; es
"quien creó la escuela" and ko "학교를 만든 분" are the console's words for a school's owner; "Contrato Escolar" /
"학교 계약" are `console.billing.planTitle.school_seat`; es "Entrar" is `landing.nav.signIn`; the es parent link follows
the console's "Soy madre, padre, tutor o docente" (`console.signIn.create.affirm`), the ko links its "…이에요" form.
English uses US spelling ("practiced"), as #806 sets for the site. English says "heritage card", the app's word
(`learner.ts`, `report.ts`) and `/learners`' "Stage 1 Heritage Cards"; es "tarjeta cultural" and ko "문화 카드" are their
apps' words. Spanish buttons use the infinitive ("Crear …", as "Empezar a aprender" and the console's "Crear una clase").

## 10. Out of scope

- A `/schools` page (OD-SN-4); any price, plan term or billing link; any claim flip (OD-SN-8).
- The copy fixes of #806 and #807 and the legal accuracy of #804 (their own rows).
- Learner-app and console screens (other rows own them; see section 11).

## 11. Follow-ups found while capturing (not this amendment; for the rows that own those screens)

- Learner app, Korean UI, Home greeting at 390 px: "안녕하세요" and ", 다미!" break so the comma starts the second line.
  (The `home` capture is taken at 430 px, where it breaks after the comma; retaken at 390 once fixed, section 3.13.)
- Console, Korean UI, learner report: "지금 1단계: Hangul": the stage name stays English in the Korean UI. (The `report`
  crop starts below that line; retaken from the heading once fixed.)
- Console class page at 720 px: the "Notes" chip in the action row is taller than its neighbours.

## 12. Review log

Multi-agent review of the mocks, 2026-10-21 (CLAUDE.md section 5; the 2026-10-12 owner decision). Four independent
reviewers, each read-only over this spec, the wireframes, `mock/strings.js`, `mock/patch.js`, `measurements.json` and the
shots: (1) UX for a new visitor, (2) accessibility (320 px, 200 % text, 64 px targets, focus order, the language
control), (3) English copy (any age, truthful, no price or billing), (4) Spanish and Korean (glossary, the F-I18N-001
section 3.10 particle rule, length in the es and ko shots). No reviewer is a native speaker or a human expert; this is
the project's multi-agent review.

**Round 1: CHANGES (all four).** What changed:

| # | Lens | Finding | Change |
|---|---|---|---|
| R1-1 | UX | `/learners` captures sat under steps 1-2-3 and read as pictures of them | captures moved after Hoya's line, each with a visible caption (`captures.caption.*`, §3.4) |
| R1-2 | UX | `/teachers` states the school cap twice (schools section and #806's Plans line) | OD-SN-11 (default keep both) |
| R1-3 | UX | the class-list frame cut a row of cards | recaptured as the first row of whole cards, all corners rounded (§3.6) |
| R1-4 | UX | the hero capture says "Four New Letters", the bubble one letter | alt text names the new letters starting with ㅏ; the pairing is OD-SN-12 |
| R1-5 | UX | "No email or password" right above the email form | the news section is set apart by `spacing.xl` (§3.3 item 6); the reprise stays OD-SN-10 |
| R1-6 | UX | Start twice on the home's first screen | OD-SN-1 (default keep one header everywhere) |
| R1-7 | a11y | the open language menu overflowed at 320 px with 200 % text | menu positioned against the header row, width capped at the viewport minus the gutters, min width `min(12rem, …)` (§3.2) |
| R1-8 | a11y | no shot or measurement of the open menu at 320 px with 200 % text | `header-<locale>-320-text200-lang-open.png`, `langOpen320text200` in `measurements.json`; the check also fails a visible control off the left edge |
| R1-9 | a11y | no visual cue on the phone language control | a small chevron beside the globe on phones (§3.2) |
| R1-10 | copy | class moves: no family to tell; moves to another teacher's class wait for acceptance | scoped to "another class in the school"; "Their family is told"; OD-SN-9 |
| R1-11 | copy | "Billing stays with the owner." (billing word, register) | "The owner manages the plan." (as `console.billing.readOnly.schoolAdmin`) |
| R1-12 | copy | hero alt named one letter, the screen shows four | "new letters, starting with {letter} ({romanization}), each with a button to hear it" |
| R1-13 | ko | `{email}로`: particle on a value, and wrong after "com" | `{email} 주소로` |
| R1-14 | ko | `{romanization})와`: particle on a value | the letter ends its own sentence: "첫 글자는 {letter}({romanization})." |
| R1-15 | es | "crea sus clases": unclear referent | "crea tú las clases de cada docente" |

**Round 2: PASS (both re-reviewers: UX and accessibility; copy, Spanish and Korean).** Every round-1 item is resolved or
recorded as an owner decision with a default (OD-SN-1, -9, -10, -11, -12). No new blocking problem. Re-measured after the
changes: one header row (81 px) at 320 and 375 px in en, es and ko; no sideways scroll at 320 px, at 320 px with 200 %
text (menu open or closed) or at 720 px with 200 % text, on any page or locale; only the two consent inline links under
64 x 64; heights and words within the section 3.11 budgets in every locale.

Spec marked `ready`.

**Round 3: CHANGES (two independent reviewers, 2026-10-21, on the PR).** Review 1 (UX, claims and copy, with the es and
ko MAR): CHANGES; es MAR CHANGES (one item, R3-11), ko MAR PASS. Review 2 (UX, accessibility and claims): CHANGES. Every
finding was taken; what changed:

| # | Reviews | Finding | Change |
|---|---|---|---|
| R3-1 | 1, 2 (high) | Home and class-list captures show the Learning Route while `learningRoute` is off | Home cropped above the route link and the tab bar; the class page capture is now the class code, join link and "This week" with no student cards (they also showed the level check's starting spot, `levelCheck` off); `CAPTURE_CLAIMS` and a test that fails a capture of a feature whose claim is off (§3.13, §8); OD-SN-8 updated |
| R3-2 | 1, 2 | Report and Lecture mode captures not tied to their claims | each capture renders only under its claims, `CLAIM_LOCALES` included; both states pinned in `persona-pages.test.tsx`; F-SITE-002 §3.9 hand-off rule (§3.5, §3.6, §3.13) |
| R3-3 | 1, 2 | "The owner manages the plan" and "about a School Contract" while plans are not on sale | T3 applied while `paidPlans` is `'coming'` (`.ownerPlan` waits for `'inApp'`); size line "Need more? Write to {email}."; OD-SN-13 for the School Contract wording (`.sizeContract`) |
| R3-4 | 2 | Moves line and admin powers can be switched off in production | recorded: LV-D1-style rule and a `CLASS_TRANSFER` runbook line (§3.6); no new claim (both are on by owner decision) |
| R3-5 | 1 | Phones lose the brand name; Start twice on the home's first screen | OD-SN-1 and OD-SN-2 defaults changed: no phone Start pill on `/`, brand name there from 360 px; re-measured: one 81 px row at 320 and 375 in every locale (§3.2) |
| R3-6 | 1, 2 | Korean captures show known defects; report captures show a clipped print hint and cut tiles | Home taken at 430 px (greeting breaks after the comma); report cropped from the period tabs to the end of "What to practice next" in every locale; refresh rule for defects (§3.13, §11) |
| R3-7 | 2 (medium) | es 404: Start learning below the 320 x 568 first screen (595 px) | Hoya 4.5rem and less padding below 45em: 446 / 515 / 488 px en / es / ko; 404 first screen added to §3.11 |
| R3-8 | 1 | Language links and banner on the 404 have no target | `sitePath(target, '/')`, in the SN-2 e2e (§3.2, §3.7, §8) |
| R3-9 | 1 | Captures unreadable at 375 px; bubble over the frame | `<picture>` phone crops `discover-narrow` and `class-list-narrow`; phone frame moved right, bubble narrower (§3.3, §3.6) |
| R3-10 | 1 | "culture card" in English | "heritage card" (appendix A) |
| R3-11 | 1 (es MAR) | Create buttons in the imperative | "Crear un espacio familiar gratis", "Crear una clase gratis" |
| R3-12 | 1 | "About five minutes" reads as all of Stage 1 | "Your first quest takes about five minutes." (es, ko to match) |
| R3-13 | 1 (ko MAR, optional) | og alt: 글자 for "words" | "호랑이 호야와 {brand} 로고. 문구: {tagline}" |
| R3-14 | 2 | `/` headroom 52 px above the mock, measured on macOS | headroom 3,150, full 3,250; SN-1 re-measures on the CI image (§3.11) |
| R3-15 | 1, 2 | Two word counts for `/teachers`; OD rows out of order | counts labelled by viewport from `measurements.json`; OD rows in order |

The mocks, captures, shots and `measurements.json` are rebuilt after these changes (same base: `619f4ae2b` with #806
and #807 merged locally). No `packages/i18n` file changes in this row, so no ledger entry is signed here; SN-1 and SN-2
recompute `enSha` and sign `reviewedBy: MAR` in their fix stages, after an independent reviewer passes the es and ko
strings of appendix A (round 3 left es with one change, now made, so the es strings need that pass).
