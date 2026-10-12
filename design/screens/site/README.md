# Site screens: hangulroute.com as a short, layered intro site (design mocks v1)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` (PR S-D; sections 3.1 to 3.6, 3.11, 6) · strings: appendix B (`landing.home`, `landing.nav`, `landing.persona`, `landing.plans`, written by S-3)
Wireframes: `design/wireframes/site/home.md`, `header-footer.md`, `learners.md`, `parents.md`, `teachers.md`
Built by: S-4a (`SiteHeader`, `SiteFooter`, `/learners`), S-4b (`/parents`, `/teachers`), S-5 (home body, header and footer on every site page)

## What is here

| File | What it fixes |
|---|---|
| `header.md` | the one-row phone header, the wide header, the legal variant and the footer |
| `home-hero.md` | the home hero (L0) and the blocks under it |
| `persona-card.md` | the persona card of `#who`, with its four states |
| `persona-page.md` | the persona page frame, drawn on `/parents` and `/learners`; `/teachers` uses the same parts |
| `mock/` | a static HTML mock (`home.html`, `learners.html`, `parents.html`, `states.html`) on one stylesheet, `site.css` |
| `shots/` | the mock rendered in Chromium at 2x (file names say the page and the viewport width) |

The mock is a design reference, not shipped code. Every value in `mock/site.css` is a token of `packages/design-system/src/tokens.ts`, copied once into a custom property named after it (`--spacing-xl` is `spacing.xl`, `--colors-brand-primary` is `colors.brand.primary`). S-4a / S-5 write the same rules with token imports: inline styles from tokens, and only the properties that change at a breakpoint in `apps/web/src/app/globals.css` (as the landing does today). Text sizes are written in rem (token / 16) and breakpoints in em (px / 16), so a browser text-size setting enlarges every line and moves the layout switches with it. The numbers that are not tokens are listed under "Constants" below, each with the token it derives from; S-4a / S-5 write them as named constants, never as bare literals (CLAUDE.md section 4).

Open the mock with any browser (`design/screens/site/mock/home.html`); links are placeholders. Every drawn string is an S-3 key's English value word for word: appendix B, plus `landing.persona.plansTitle` ("Plans") and `landing.persona.faqTitle` (the visually hidden "Questions"), which the S-3 review added for the persona pages' headings. The closing block is labelled by its own line (`landing.persona.closing.*`), so it needs no extra key. The cost line on `/` and under Plans on `/parents` is two keys in one paragraph: `landing.plans.free.stage1` ("Stage 1 is free.") then `landing.plans.paid.coming` ("More stages are coming, with plans for families and classes."), the S-3 strings after F-ENT-003 OD-1 (the free plan is all of Stage 1) and the yearly Family Plan (BY-1). Once paid plans are on sale, the home's paid line becomes `plans.paid.inApp` and a persona page's Plans block drops its paid line, so `plans.managedInApp` names the host once (spec §3.5). The drawn strings follow S-3 review 3: the parents page's backup sentence (`persona.parents.safe.bullets.backup`), the bubble with its romanization (`home.hero.bubble(letter, romanization)`), the own answer of "What can I see?" (`persona.parents.faq.whatSee.a`) and "How most quests work".

## Constants

| Where | Value | Derived from |
|---|---|---|
| Breakpoint: phone / wide switch | 45em (720 px at default text) | spec section 3.2 (the landing's existing 720 px switch; four 64 px links need it, see `header.md`) |
| Breakpoint: brand name steps to the mark | below 60em (960 px) | measured: the full wide row needs 960 px with the name |
| Breakpoint: mark steps out | below 22.5em (360 px) | today's `hr-landing-logo-mark` rule |
| Breakpoint: gutter `regular` to `wide` | 70em (1120 px) | `layout.maxWidth.full`: the gutter widens once the content reaches its maximum width |
| Hero art cap, phone / wide | 240 px / 360 px | 5 x `spacing.xxxl` / `layout.maxWidth.reading` / 2 |
| Hero text column ratio | 1.4fr | `layout.mediaScale.wide` |
| Hoya inside the art square | 62 % | art proportion: leaves room for the bubble under Hoya |
| Lead measure | 34em | reading measure, about 60 characters a line |
| Footer column minimum | 8rem | 2 x `spacing.jumbo` at default text; in rem so large text falls back to one column |
| Card tile minimum (`/learners`) | 5.5rem | three tiles across at 320 px (88 px each at default text); in rem, so with large text the row drops to two or one tile instead of overflowing |
| Launch news form: max width 480 px, field and button 48 px tall, field basis 240 px | `--wl-*` | not new: the existing `WaitlistForm`'s own values, drawn as it renders today (the component is not changed) |
| Skip link stack level | `--z-sticky` (20) | `z.sticky` |
| Font stack | system stack | copied from `SiteDocument.tsx` |

Breakpoints are written mobile first: every narrow rule is the default and a `min-width` query overrides it. There is no `max-width` query, so no fractional viewport width (browser zoom, display scaling) can fall between two queries (a `max-width: 44.99em` / `min-width: 45em` pair leaves a 0.01em gap where neither applies). S-4a writes `globals.css` the same way.

Why the site does not use `layout.breakpoint` (600 / 900): those are the learner app's window classes (F-LAYOUT-001), chosen for the app's panes and card grid. The site's header switch is set by the spec (section 3.2) at the landing's existing 720 px, because the wide row needs that much room; the gutter steps at `layout.maxWidth.full`. S-4a keeps these in one `SITE_BREAKPOINTS` constant in `apps/web` with this derivation in its comment.

## Enlarged text: how it is measured

The 200 % shots use the browser's own text-size setting (Chromium `Page.setFontSizes`, default font size 32 instead of 16), not page zoom and not a CSS `html { font-size }` override. Because every text size is in rem and every breakpoint in em, the setting enlarges all text and moves the breakpoints with it: at 720 px wide with 200 % text the header uses its phone row (45em is 1,440 px), so it cannot overflow. Note for S-4a: tokens rendered as px inline styles do not respond to that setting, so `site-budgets.spec.ts` must either render text sizes in rem (token / 16) with em breakpoints in `globals.css`, or the enlarged-text check tests nothing. Spec §3.11 and §6 now prescribe this method (browser default font size, at 320 and at 720 px). One trap: Chromium drops the CDP font sizes whenever the view is resized, which a Playwright full-page or element screenshot does; measure before any such capture, or grow the viewport to the page height and set the sizes again (as `learners-320-text200.png` was made).

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `shots/home-320-first.png` | 320 x 568, first screen | header, h1, lead, Start learning, the grown-ups link |
| `shots/home-375.png` | 375 x 812, full page | the whole home on a phone |
| `shots/home-720.png` | 720 x 800, full page | the narrowest wide layout (mark-only brand) |
| `shots/home-1280.png` | 1280 x 800, full page | the whole home on a laptop |
| `shots/parents-320-first.png` | 320 x 568, first screen | persona page head with both actions |
| `shots/parents-375.png`, `shots/parents-1280.png` | full page | the persona page frame |
| `shots/learners-320-first.png` | 320 x 568, first screen | `/learners` head with its one action |
| `shots/learners-375.png`, `shots/learners-1280.png` | full page | `/learners`: the quest steps with the small Hoya, the six card tiles (three across on phones, six on wide screens), the folds |
| `shots/learners-320-text200.png` | 320, text 200 %, full page | the tiles drop to one column, every fold and button grows, nothing scrolls sideways |
| `shots/header-320.png`, `header-720.png`, `header-1280.png` | header only | phone row, mark-only wide row, full wide row (current page marker on Parents) |
| `shots/header-320-text200.png` | 320, text 200 % | the header wraps to two rows, never sideways; every label enlarged |
| `shots/header-720-text200.png` | 720, text 200 % | the em breakpoints keep the phone row (brand and Sign in), so the wide row cannot overflow |
| `shots/states-375.png` | 375 | persona card rest / hover / focus / pressed, the skip link on focus, a closed and an open fold, the launch-news field with keyboard focus on its band |

## Measured on the mock (Chromium, every claim off)

| Check (spec section 3.11) | Budget | Mock |
|---|---|---|
| Home height at 375 x 812 | at most 2,900 (headroom 2,750) | 2,718 |
| Home height at 1280 x 800 | at most 2,100 | 2,068 |
| `/learners` height at 375 x 812 | at most 4,060 (headroom 3,700) | 2,541 |
| `/learners` height at 1280 x 800 | at most 3,200 | 2,485 |
| `/parents` height at 375 x 812 | at most 4,060 (headroom 3,700) | 2,526 |
| `/parents` height at 1280 x 800 | at most 3,200 | 2,070 |
| Header at 320 and 375 | one row, at most 96 px | one row, 81 px (64 hit area + 2 x `spacing.sm` + `borderWidth.thin`) |
| Header with 200 % text at 320, 375, 720 and 1280 | at most two rows, no sideways scroll | 320 / 375: two rows (145 px); 720 / 1280: one row (the phone row); never sideways, on all three pages |
| First screen at 320 x 568 contains header, h1, lead, primary action | | the primary action ends at 457 px on `/`, 346 px on `/learners`, 415 px on `/parents` |
| Visible words, folds closed | home 280, persona page 550 | home 251 (375) / 256 (1280), `/learners` 212 / 217, `/parents` 240 / 245 (whitespace-separated tokens; chrome included; visually hidden text, the skip link, `aria-hidden` art and closed fold bodies excluded) |
| Links and buttons under 64 x 64 | none new (spec §3.2) | none, except the four controls of the unchanged `WaitlistForm` on `/`: its field and button (48 px tall) and the two inline links of its consent line. They keep their existing lines in `landing-touch-allowlist.json` (`input email`, `button submit`, `a mailto:hello@hangulroute.com`, one `a /privacy`); no line is added |

These are the mock's numbers, not the real export's: S-4a, S-4b and S-5 measure the export in `site-budgets.spec.ts`. The mock confirms spec assumption b (brand and Sign in fit one row at 320 px; the mark steps out below 360 px as today) and assumption d (home at 2,718 px with the 64 px footer links in two columns and the real launch-news form). The home is the tightest page: 32 px under its headroom at 375 and 32 px under the 2,100 px budget at 1280, so S-5 checks both with the `learningRoute` line on. Drawing the real form added about 160 px at 375; phone sections use `spacing.lg` above and below (wide screens keep `spacing.xxxl`) and the band follows the cost section without a top margin, which brought the home back under its headroom.

## Decisions taken in this design pass (wireframe open questions)

- **Hoya on phones (home):** kept, under the facts line, in a square capped at 240 px (360 px wide); it does not delay the first screen at 320 x 568.
- **Persona card link label:** the card shows title, line and a chevron; it is one link whose name is the title and the line (spec section 6). `landing.home.who.items.*.linkLabel` is not drawn on the card (it would repeat the title); the old landing header reads it until S-6, which removes it (spec PR table, S-3 review).
- **Wide header order:** Start sits next to the brand (wireframe default), the persona links and Sign in at the right, with auto margins only (DOM order = visual order).
- **Wide header from 720 to 959 px:** the brand shows the mark only; "Hangul Route" stays the link's accessible name (visually hidden). All items fit one row from 720 px.
- **Footer group order:** Guide, App, Company in the DOM and on screen at every width (phones: Guide and App stacked in the left column, Company on the right, as the wireframe draws; wide: three columns in the same order).
- **Teaser cards on `/learners`:** the first six by unlock order (wireframe default), each tile the Korean word with its romanization and English name (CLAUDE.md §1); three across on phones and six on wide screens; with large text the row drops to fewer tiles (`mock/learners.html`).
- **Launch news:** the existing `WaitlistForm`, unchanged, on today's `brand.primary` band, because its consent and success lines are `text.onPrimary`. On the band the focus ring is `text.onPrimary` (`border.focus` is under 3:1 on `brand.primary`), a band rule in `globals.css`, not a change to the form.
- **Header label:** "Sign in" alone (OD-12 default); the persona pages carry "Sign in as a parent / teacher".
- **No new colour, no new token, no motion.** The fold chevron turns without animation.
