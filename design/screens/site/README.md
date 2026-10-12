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
| `persona-page.md` | the persona page frame, drawn on `/parents`; `/learners` and `/teachers` use the same parts |
| `mock/` | a static HTML mock (`home.html`, `parents.html`, `states.html`) on one stylesheet, `site.css` |
| `shots/` | the mock rendered in Chromium at 2x (file names say the page and the viewport width) |

The mock is a design reference, not shipped code. Every value in `mock/site.css` is a token of `packages/design-system/src/tokens.ts`, copied once into a custom property named after it (`--spacing-xl` is `spacing.xl`, `--colors-brand-primary` is `colors.brand.primary`). S-4a / S-5 write the same rules with token imports: inline styles from tokens, and only the properties that change at a breakpoint in `apps/web/src/app/globals.css` (as the landing does today). The only numbers that are not tokens are the breakpoints of the spec (720 px; 360 px for the brand mark, as today; 960 px for the brand name, see `header.md`) and the copied system font stack of `SiteDocument.tsx`.

Open the mock with any browser (`design/screens/site/mock/home.html`); links are placeholders. Strings are the appendix B English strings word for word.

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `shots/home-320-first.png` | 320 x 568, first screen | header, h1, lead, Start learning, the grown-ups link |
| `shots/home-375.png` | 375 x 812, full page | the whole home on a phone |
| `shots/home-720.png` | 720 x 800, full page | the narrowest wide layout (mark-only brand) |
| `shots/home-1280.png` | 1280 x 800, full page | the whole home on a laptop |
| `shots/parents-320-first.png` | 320 x 568, first screen | persona page head with both actions |
| `shots/parents-375.png`, `shots/parents-1280.png` | full page | the persona page frame |
| `shots/header-320.png`, `header-720.png`, `header-1280.png` | header only | phone row, mark-only wide row, full wide row (current page marker on Parents) |
| `shots/header-320-text200.png` | 320, text enlarged | the header wraps to two rows, never sideways |
| `shots/states-375.png` | 375 | persona card rest / hover / focus / pressed, the skip link on focus, a closed and an open fold |

## Measured on the mock (Chromium, every claim off)

| Check (spec section 3.11) | Budget | Mock |
|---|---|---|
| Home height at 375 x 812 | at most 2,900 (headroom 2,750) | 2,650 |
| Home height at 1280 x 800 | at most 2,100 | 1,997 |
| Persona page (`/parents`) height at 375 x 812 | at most 4,060 (headroom 3,700) | 2,541 |
| Persona page height at 1280 x 800 | at most 3,200 | 1,998 |
| Header at 320 and 375 | one row, at most 96 px | one row, 81 px (64 hit area + 2 x `spacing.sm` + `borderWidth.thin`) |
| Header with enlarged text at 320 | at most two rows, no sideways scroll | two rows, no sideways scroll |
| First screen at 320 x 568 contains header, h1, lead, primary action | | home: primary action ends at 457 px; `/parents`: at 415 px |
| Visible words, folds closed | home 280, persona page 550 | home 237, `/parents` 227 (chrome included) |
| Links and buttons under 64 x 64 | none | none |

These are the mock's numbers, not the real export's: S-4a, S-4b and S-5 measure the export in `site-budgets.spec.ts`. The mock confirms spec assumption b (brand and Sign in fit one row at 320 px; the mark steps out below 360 px as today) and gives assumption d room (home at 2,650 px with the 64 px footer links in two columns).

## Decisions taken in this design pass (wireframe open questions)

- **Hoya on phones (home):** kept, under the facts line, in a square capped at 240 px (360 px wide); it does not delay the first screen at 320 x 568.
- **Persona card link label:** the card shows title, line and a chevron; it is one link whose name is the title and the line (spec section 6). `landing.home.who.items.*.linkLabel` is not drawn on the card (it would repeat the title); the old landing header reads it until S-6.
- **Wide header order:** Start sits next to the brand (wireframe default), the persona links and Sign in at the right, with auto margins only (DOM order = visual order).
- **Wide header from 720 to 959 px:** the brand shows the mark only; "Hangul Route" stays the link's accessible name (visually hidden). All items fit one row from 720 px.
- **Footer group order:** Guide, App, Company in the DOM and on screen at every width (phones: Guide and App stacked in the left column, Company on the right, as the wireframe draws; wide: three columns in the same order).
- **Teaser cards on `/learners`:** the first six by unlock order (wireframe default); no mock change needed beyond the persona page frame.
- **Header label:** "Sign in" alone (OD-12 default); the persona pages carry "Sign in as a parent / teacher".
- **No new colour, no new token, no motion.** The fold chevron turns without animation.
