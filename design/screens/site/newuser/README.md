# Site screens: the new-visitor pass (design mocks v1)

Spec: `docs/specs/AMENDMENTS-SITE-NEWUSER.md` (amends F-SITE-002 §3.2 to §3.7, §3.11; adds §3.13 captures and §3.14 head assets) · rows SN-1 (site entry) and SN-2 (head and 404)
Wireframes: `design/wireframes/site/newuser-home.md`, `newuser-header-language.md`, `newuser-grown-up-pages.md`, `newuser-learners-captures.md`, `newuser-about-404-head.md`
Earlier pass: `design/screens/site/README.md` (S-D, F-SITE-002). Everything it fixed stays unless this file says otherwise.

## How the mocks were made

The mocks are not drawn from scratch. `tools/build-mocks.mjs` opens the **real static export** of every site page in
en, es and ko, runs `mock/patch.js` on it (the new header control, the hero, the band, the captures, the schools section,
the 404), and saves the result with its CSS inlined and its scripts removed as `mock/<locale>/<page>.html`. So every part
this pass does not change is exactly what ships, and the new parts sit in the real layout, at the real text lengths of
each language. Shots and measurements are taken from the saved files.

- **Base export:** `origin/main` `619f4ae2b` with the two open copy rows of the same review merged locally: #806 (site
  facts: hero lead and facts line, the bubble on ㅏ, the launch-news title and button, the Plans lines, the PIN gate
  line) and #807 (`/learners` cards and games in the UI language). Neither is changed here; the mocks carry their copy
  so the design is judged against what will ship first. Neither row's strings are part of this spec's appendix.
- **New strings:** `mock/strings.js`, word for word the spec's appendix A (en, es, ko). Values (taught Korean, endonyms,
  the contact address, the caps) are passed in, never typed into a string.
- **Tokens only:** every value in `patch.js` is a site custom property (`--hr-site-*`, from `siteCssVars()`) or one of
  the token aliases at the top of its stylesheet, each named after its token (`--radii-xxl` is `radii.xxl`,
  `--touch-child` is `touchTarget.child`). No new token, no new colour.
- **Captures:** real screens, see "Product captures" below.

Open any mock from disk, for example `mock/es/teachers.html`. Links are the export's own (they point at site paths).

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `shots/<page>-<locale>-375.png` | 375 x 812, full page | every page (`home`, `learners`, `parents`, `teachers`, `about`, `404`) in en, es, ko |
| `shots/<page>-<locale>-1280.png` | 1280 x 800, full page | the same at laptop width |
| `shots/home-<locale>-320-first.png` | 320 x 568, first screen | header, h1, lead, Start learning, facts line, the two grown-up links |
| `shots/parents-<locale>-320-first.png` | 320 x 568, first screen | the persona head: Create, Start learning, "Already have an account? Sign in" |
| `shots/home-<locale>-320-text200.png` | 320, text 200 % | the header wraps to two rows, nothing scrolls sideways |
| `shots/header-<locale>-320-text200-lang-open.png` | 320, text 200 % | the language menu open on the wrapped header, inside the screen |
| `shots/header-<locale>-375-lang-open.png`, `-1280-lang-open.png` | first 420 px | the language menu open (current language bold with a check) |
| `shots/parents-en-375-banner.png` | 375 x 812 | the locale banner on an English page other than `/`, offering the same page in Spanish |
| `shots/before/*.png` | as named | the same pages on `origin/main` (production copy), for the PR's before / after |
| `head/og-<locale>.png` | 1200 x 630 | the share card per locale |
| `head/icon-32.png`, `icon-48.png`, `apple-icon-180.png` | | the tab and home-screen icons from `apps/mobile/public/icon-1024.png` |

## Decisions in this pass

### Header (every page)

- **DOM order = visual order:** skip link, brand, Start, nav (wide only), Language, Sign in. Phones: `[HR] … [Start][Language][Sign in]`,
  Start pushed right with `margin-left: auto`; wide: Start beside the brand, nav pushed right.
- **Start pill at every width.** Visible label `landing.nav.startShort` ("Start" / "Empezar" / "시작"), accessible name
  `landing.nav.start` ("Start learning"), which contains the visible label (WCAG 2.5.3). Phone padding `spacing.sm`, text
  `typography.size.bodySm`; wide padding `spacing.xl`, text `body`. Min 64 x 64.
- **Language control.** A native `<details>` whose `<summary>` holds a globe glyph (decorative, `currentColor`), the
  visually hidden word `landing.footer.language` and the current endonym in a `lang` span. Phones stack the globe and a
  small chevron over the endonym in `caption` size inside one 64 x 64 box; from 45em the globe, endonym and chevron sit in
  a row. The menu is a
  list of three links, each 64 px tall (positioned against the header row, at most the viewport minus the gutters wide,
  so it stays on screen when 200 % text wraps the control to a second row), `lang` + `hreflang`, the current one `aria-current="page"` with bold text and a
  check glyph (not colour alone). Menu: `surface.paper`, `border.subtle` hairline, `radii.lg`, `cardShadow()`, anchored
  right under the control, min width 12rem. Closed by default; with JavaScript, Escape and an outside tap close it and focus
  returns to the summary.
- **Brand on phones.** The mark shows at every width (its box in rem, 3rem = `spacing.xxxl` / 16, so 200 % text cannot
  break "HR" over two lines); the name shows from 30em to 45em and from 60em. Below 30em the four controls need
  64 + 82 + 64 + 66 px with Spanish labels, which leaves no room for the name; the column gap is 0 below 45em (each hit
  area is already 64 px wide). Measured: one row, 81 px, at 320 and 375 in en, es and ko.
- **Locale banner** on every English page (was `/` only), offering `sitePath(target, page)`, the same page.

### Home

- **Hero:** h1, lead, Start learning (`PrimaryAction`), then the facts line directly under the action (caption,
  `text.muted`), then two text links "I'm a parent" / "I'm a teacher" (64 px tall each, `brand.primaryDark`, underlined)
  to `sitePath(locale, '/parents' | '/teachers')`. They replace "Parent or teacher? Find your page" (`#who`).
- **Hero art:** the art box keeps `brand.primaryLight` and `radii.xxl`; inside, a phone frame (`text.primary` bezel,
  `spacing.xs`, top radius `radii.xl`, cut at the box's bottom edge) holds the quest 1 Discover capture, with Hoya waving at
  the bottom left (34 % of the box, decorative) and the speech bubble above Hoya. The capture is the only `img` with alt
  text in the hero; Hoya and the bubble are `aria-hidden` as today (the bubble's taught letter is the capture's letter, ㅏ).
  All sizes are percentages of the box, so 200 % text never pushes it sideways.
- **Closing band** (replaces the launch-news band): `brand.primary`, `radii.xxl`, centred h2 (`title` size,
  `text.onPrimary`), one line, and Start learning as a light pill (`surface.paper` fill, `brand.primaryDark` text,
  `touchTarget.child` tall, full width up to 22rem on phones). Focus ring on the band: `text.onPrimary` (as the S-D band).
- **Launch news, quiet:** a plain `hr-site-section` after the band: h2, one line, the form with `tone="plain"`: field and
  button **64 px** tall (were 48, so two lines leave `landing-touch-allowlist.json`), consent line in `text.secondary`
  with its two inline links in `brand.primaryDark`. The consent words are byte-identical (CONSENT_TEXT_VERSION unchanged).
- **Cost block removed from `/`** (OD-SN-3 default): the band's line opens with "Stage 1 is free."; the plan lines live
  on `/parents` and `/teachers`.

### `/parents`, `/teachers`

- Head and closing: primary **Create a free family space** / **Create a free class**, then the text link "Already have an
  account? Sign in" under the buttons (head) or under the button (closing). The secondary Start learning / Try it as a
  learner stays.
- `/parents`: the report capture in a small phone frame (12rem, or the column width if smaller) at the end of Follow along.
- `/teachers`: one media row after Plan and assign / See how the class is doing: the class page capture in a card frame
  (`surface.paper`, `border.subtle`, `radii.lg`, `cardShadow()`) and the Lecture mode slide in a dark screen frame
  (`text.primary`, `spacing.sm`); two equal columns from 45em, stacked below.
- `/teachers` **Use it across a whole school**: four plain lines (not bullets, they are sentences), in this order: school
  space, administrators, class moves, size and School Contract. The email address is plain text in the sentence.

### `/learners`

- Three phone captures (Home, a mini-game, the tiger card) in one row after the quest steps and Hoya's line, before the
  mini-games fold, always three across (each a third of a row of at most 34rem), 3 px bezel, `radii.lg`, each with a
  short visible caption (`captures.caption.*`), so they read as a sampler of real screens, not as pictures of steps 1-3.

### About, 404, head

- About: Start learning (`PrimaryAction` size) after the promises, before the feedback box.
- 404 (each locale): Hoya waving (decorative), h1, body, the home text link, Start learning. No Next default block.
- og image: Hoya on a `brand.primaryLight` circle, the brand mark and name, the locale's tagline (`landing.meta.tagline`),
  the host. Korean lines break between words (`word-break: keep-all`).

## Product captures (spec §3.13)

Real screens of the release learner bundle (`apps/mobile` `build:web`, no API) and of the console export built with the
reports e2e fixtures (API mocked, made-up names), per UI locale, because they hold UI text. Made by
`tools/capture-app.mjs` and `tools/capture-console.spec.ts`; SN-1 turns them into `apps/web/scripts/site-captures.mjs`.

| File (`captures/<locale>/`) | Source | Size (en / es / ko) | Used on |
|---|---|---|---|
| `discover.webp` 520 x 1125 | quest 1, Discover page 1 (ㅏ), 390 x 844 at 2x | 15.6 / 16.6 / 14.9 KB | `/` hero |
| `home.webp` 400 x 866 | learner Home after setup | 19.3 / 22.0 / 18.2 KB | `/learners` |
| `game.webp` 400 x 866 | quest 1's first mini-game (listen and pick) | 5.2 / 5.5 / 5.0 KB | `/learners` |
| `card.webp` 400 x 866 | the tiger card (horangi), Library | 11.6 / 13.1 / 11.2 KB | `/learners` |
| `report.webp` 600 x 1298 | a parent's weekly report of one learner | 33.3 / 36.6 / 31.5 KB | `/parents` |
| `class-list.webp` 720 x 456 (ko 432) | a teacher's class page: the first row of student cards, whole | 22.2 / 23.7 / 18.4 KB | `/teachers` |
| `lecture-slide.webp` 1080 x 608 | Lecture mode, quest 1's first letter fully revealed | 14.1 / 16.4 / 14.2 KB | `/teachers` |

Images per page (the page's captures, one locale): `/` 15.6 KB, `/learners` 36.2 KB, `/parents` 33.3 KB, `/teachers`
36.4 KB (en; es is the largest: 16.6, 40.7, 36.6 and 40.1 KB). Spec §3.11 sets the budgets with headroom.

## Measured on the mocks (Chromium, claims as in `SITE_CLAIMS`, base export above)

| Page | 375 x 812 (en / es / ko) | 1280 x 800 (en / es / ko) | Words en (375 / 1280) | Primary action ends at (320 x 568) |
|---|---|---|---|---|
| `/` | 3,008 / 3,241 / 3,004 | 2,164 / 2,254 / 2,183 | 268 / 273 | 429 px |
| `/learners` | 3,015 / 3,077 / 2,954 | 2,962 / 2,974 / 2,923 | 254 / 259 | 346 px |
| `/parents` | 3,506 / 3,582 / 3,250 | 2,649 / 2,622 / 2,538 | 352 / 357 | 415 px |
| `/teachers` | 3,935 / 4,188 / 3,731 | 3,274 / 3,378 / 3,198 | 419 / 424 | 346 px |
| `/about` | 1,856 / 2,043 / 1,801 | 1,331 / 1,386 / 1,303 | 184 / 189 | (after the promises) |
| 404 | 1,179 / 1,221 / 1,179 | 954 / 982 / 954 | 66 / 71 | 526 px |

- Header: one row, 81 px, at 320 and 375 in every locale; with 200 % text, two rows at 320 px (177 px) and one row at
  720 px (113 px); nothing scrolls sideways at 320 px, at 320 px with 200 % text, or at 720 px with 200 % text, on any page.
- Hit areas under 64 x 64: only the two inline links of the unchanged consent line (their existing allowlist lines). The
  launch-news field and button are now 64 px tall.
- The open language menu at 320 px with 200 % text stays inside the screen (`langOpen320text200` in `measurements.json`;
  the check also fails a visible header or menu link that leaves the screen on the left).
- Full numbers, per page and locale: `measurements.json` (words are whitespace-separated tokens of `innerText`, closed
  `<details>` excluded, the visually hidden "Language" word included).

## Review

See the spec's review log (section 12): the multi-agent review of these mocks (UX, accessibility at 320 px, 200 % text and
64 px targets, any-age copy, es and ko length) and the changes it asked for.
