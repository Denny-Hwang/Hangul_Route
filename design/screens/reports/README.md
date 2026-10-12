# Report screens: the learner report, the class report, the in-app report and the printed page (design mocks v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md`. This is the **design pass** that the start-order table ("after the design pass (`design/screens/reports/`)") and section 6.2 ("must produce the report block mocks before RP-7a2, RP-8 and RP-9") require under CLAUDE.md section 5. The mocks draw sections 3.5 (layers), 3.6 (insight lines and their actions), 3.7 (class statistics), 3.9 (in-app report), 3.10 (print and privacy), 3.12 (accessibility) and 3.14 (states).
Wireframes: `design/wireframes/reports/` `learner-report.md`, `class-report.md`, `in-app-report.md`, `print.md`.
Reused, not redrawn: the report's At a glance block with its goal line and **Open Learning Route** (LR-D, #399: `design/screens/learning-route/stage-list.md` "The goal line in the per-learner report", `mock/report.html`). Its stylesheet is imported unchanged and its markup is copied as it is.
Built by:
- **RP-7a2**: the learner report page (header, at a glance, tabs and stepper, headline, went well, practice next, this period, More detail, every state), the roster card **See report** → `learner-report.md`.
- **RP-7b**: the all-time growth line and its table, the print rules and **Print or save as PDF** → `learner-report.md` ("All time"), `print.md`.
- **RP-8**: the class report page, the class chooser, the roll-up **Class report** link, **Plan a lesson**, print → `class-report.md`, `print.md`.
- **RP-9**: `LearnerReport` in the learner app, the dashboard **See report** → `in-app-report.md`.
- RP-7c (parent chooser, Reports navigation item), RP-10 (Add to a plan target), RP-12 (Send a note) and RP-13 (Browse links) take their place from the same mocks; each is named where it appears.

## What is here

| File | What it fixes |
|---|---|
| `learner-report.md` | the console learner report: the three layers at 390 and 1280, the parent and teacher variants, the four periods, the stepper, the calendar, figures, the growth line, More detail, every state, the parent chooser |
| `class-report.md` | the console class report: headline, what went well (class), practice together, bands, time, level-check counts, homework, every state, the class chooser and the entries |
| `in-app-report.md` | the learner-app screen behind the grown-up gate: SectionTabs, the second voice on a self-only device, the skills rows, letter tap, states, the dashboard entry |
| `print.md` | the paper copy of both pages: what prints, what hides, the footer, page breaks |
| `mock/` | static HTML on one stylesheet, `reports.css` (which imports `../../learning-route/mock/learning-route.css`): `learner-report.html` (parent, week), `learner-report-teacher.html` (teacher, month), `learner-report-all.html` (all time), `learner-report-states.html` (board), `class-report.html`, `class-report-states.html` (board), `in-app-report.html`, `in-app-report-states.html` (board) |
| `shots/` | the mock rendered in Chromium. Page shots at 2x, the three state boards at 1x (they are long), stored as palette PNGs. File names give the page and the viewport width; `-first` is the first screen only; `-text200` is the browser text size at 200 %; `print-*-a4-p1` and `-p2` are the two pages of Chromium's A4 PDF of that page (print media, `preferCSSPageSize`), rasterized page by page |

**The mock is a design reference, not shipped code.**

- **Tokens.** Every value in `mock/reports.css` is a token of `packages/design-system/src/tokens.ts`, through the custom properties that `learning-route.css` defines once (named after the token: `--spacing-xl` is `spacing.xl`). They were checked against `tokens.ts` on this commit: every colour and spacing value matches. RP-7a2, RP-7b, RP-8 and RP-9 write the same values with token imports. The few numbers that are not tokens are under "Constants".
- **Units.** Console pages: text in rem, layout switches in em (45em is the adult frame's phone / wide switch, F-APP-001 section 3.8; 60em is the report's two-column body), mobile first, so a browser text size moves the switches with the text. The learner-app screen follows the app's window classes in px, as LR-D does.
- **Drawn parts.** Glyphs are `Icon/glyphs.ts` paths (`arrow-left`, `arrow-right`, `check`, `note`, `book`, `ear`, `pencil`), rendered from the module itself by the generator. The flag is LR-D's drawing (LR-2 ships it). Skills marks are the `PipRow` done pip without the cursor head-room, as `SkillsCard` draws them. The learner avatar is a placeholder disc at `AvatarChip`'s 28 px.
- **The adult frame** (F-APP-001 A-5a, section 3.8) is drawn as two dashed placeholder rows at its real phone height (one header row plus the tab row, 145 px), so the first-screen budget below counts it. Its design is pending in #420 (`design/screens/app-shell/`, not on main yet); until it merges, F-APP-001 section 3.8 is the reference.
- **Words.** Every drawn UI string is a value of `packages/i18n` (English) on this commit, read by the generator from the dictionary itself: `report.*` and `a11y.report.*` (RP-6, #401), `caregiver.placementReport.strand`, `caregiver.journey` (skills rows), `caregiver.skillsNote`, `learner.myRoute.skill*`, `learner.placement.band`, `console.placement.startingSpot`, `console.settings.archived.class`, `console.learningRoute.open` and `.section`, `common.buttons.tryAgain`. The two goal lines are LR-D's (amendment section 11.1 drafts). Content values are content: quest titles from the catalogue, the minigame name in the strand tip (`Listen and pick`, standing in for the minigame catalogue title the tip takes), plan titles, names, dates and counts are fixture data. **This pass adds no string.**
- **Annotations.** Dashed boxes and monospace labels are design-board notes, not UI.

Open any file in a browser (`design/screens/reports/mock/learner-report.html`). Links are placeholders. The disclosure and the growth-table toggle work (a few lines of script in the mock); `#open` in the URL opens them, which the full-page shots use.

## Constants

Values that are not tokens. Each one derives from a token, the content or a measurement; the PRs write them as named constants, never as bare literals (CLAUDE.md section 4).

| Where | Value | Derived from |
|---|---|---|
| Two-column report body | from 60em (960 px at the default text size) | measured: layer 1 needs about 26rem for an insight line with its action beside it, layer 2 needs 7 calendar cells and three figure tiles; below 60em the body is one column. Layer 1 left, layer 2 right, layer 3 full width (wireframe) |
| Frame phone / wide switch, gutters | 45em, then `layout.gutter.compact` / `.regular` / `.wide` (70em) | F-APP-001 section 3.8; the app-shell mock's constants (#420) |
| Period tab minimum width | 4.5rem | four tabs in one row at 375 and 390 (each about 80 px, "This month" on two lines); three and one at 320; one per row at 320 with 200 % text, never sideways |
| Figure tile minimum | 7rem | two tiles a row at 375, three in the 1280 right column |
| Print hint width | 8rem minimum, 14rem maximum | the hint stays beside the button down to 375; with large text it moves under it |
| Insight sentence minimum | 14rem | below it the line's action (Add to a plan, Open the plan) moves under the sentence |
| More detail columns | 22rem | one column on phones, two in the 1280 body (the board column of LR-D) |
| Strand columns (class level check) | 12rem | one strand per row on phones, two to five across on wide screens |
| Calendar mark | the column width, at most `spacing.xxxl` (48 px), square, `radii.sm` | seven columns at 320 (37 px each) to 1280 |
| Learner avatar chip | 28 px | `AVATAR_CHIP_SIZE` (`AvatarChip.tsx`, unchanged) |
| Growth chart drawing box | 300 x 150 | an SVG `viewBox`; it scales to the column width. Points sit at the centres of equal columns so the HTML month labels sit under them |
| Font stack | the system stack | `typography.family.sans` is `'System'`; from `learning-route.css` |

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `learner-report-390-first.png` | 390 x 844, first screen | the first-screen budget: frame, header, at a glance, tabs, stepper, headline and the What went well lines |
| `learner-report-375.png`, `-1280.png` | page, More detail open | parent variant, week: Sam, three went-well lines, three practice-next lines with Add to a plan and Open the plan, figures with "More than last week", the week calendar, More detail |
| `learner-report-320-text200.png` | 320, text 200 % | the same page, every line enlarged, one column, no sideways scroll |
| `learner-report-teacher-375.png`, `-1280.png` | page, More detail open | teacher variant, month: Mina in a class, homework words, the level-check tip line, the month calendar to date, the class's plan row |
| `learner-report-all-375.png`, `-1280.png` | page, More detail open | All time: the cumulative growth line with its legend, the axis, "Since", and the table toggle; no stepper |
| `learner-report-states-375.png`, `-1280.png` | board, 1x | loading, no_data, empty, legacy, stale (This week, wholly after `asOf`), stale (This month, partly after `asOf`), partial window, no practice, archived class, anonymized class, Today, a step back, the oldest week, a totals-only month, getting started, stage finished, free-end, unavailable, error, flag off, the parent chooser |
| `class-report-390-first.png` | 390 x 844, first screen | headline and the class's new letters in the first screen |
| `class-report-375.png`, `-1280.png` | page, More detail open | Sunflower class, week: class lines, headline with its up-only line, what went well (class), practice together with Plan a lesson, bands, time, level-check counts, homework |
| `class-report-320-text200.png` | 320, text 200 % | the same, enlarged |
| `class-report-states-375.png`, `-1280.png` | board, 1x | loading, empty, all on an older app, no practice, Today, All time, small month (median hidden), unavailable, error, the class chooser, the two entries |
| `in-app-report-390-first.png` | 390 x 844, first screen | the in-app first screen |
| `in-app-report-375.png`, `-1280.png` | page, More detail open | `LearnerReport` on a shared device: third person, SectionTabs, stepper, three layers, skills rows |
| `in-app-report-states-375.png`, `-1280.png` | board, 1x | self-only device in the second voice, empty (both voices), no practice, All time, a letter tile tapped, error, the dashboard entry |
| `print-learner-a4-p1.png`, `-p2.png`, `print-class-a4-p1.png`, `-p2.png`, `print-learner-all-a4-p1.png`, `-p2.png` | A4 pages of the PDF | the paper copy page by page: no frame, no buttons, the selected period as text, More detail expanded, the calendar as text, the growth line as its table, the footer at the bottom of each page with nothing under it |

## Measured on the mock (Chromium)

| Check | Target (spec) | Mock |
|---|---|---|
| First screen, learner report at 390 x 844 | the headline and the first went-well line visible without scrolling (section 3.5, e2e) | **met with the frame counted** (parent variant, ready): the headline ends at 690 px and the first went-well line at 761 px of 844. The frame takes 145, the header (back, Send a note, Print) 132, at a glance 194, tabs and stepper 140. **Stale** (measured on full pages built from the board's two stale examples): the stale block under the glance (about 100 px) moves the headline to end at 793 px, still on the first screen. In the This week example the whole week is after `asOf`, so there is no went-well line (the `none_saved` headline, no What went well); in the This month example the first went-well line ends at 904 px, 60 px below the fold, under the "Figures up to Oct 2." line. The stale lines are the more important news in that state, so they stay where the wireframe puts them. **Teacher variant, month**: the class goal line takes two lines, and the first went-well line ends at 854 px, 10 px below; the headline (782) is on the first screen. The spec's e2e check uses the ready parent fixture, and RP-7a2's e2e asserts that case as written |
| First screen, class report at 390 x 844 | wireframe: how many practiced and what the class got strong on, without scrolling | **met**: headline ends at 670, the new-letter chips at 838 of 844 (tight; the class name takes two lines here). RP-8's e2e asserts the headline only |
| First screen, in-app at 390 x 844 | as the console (section 3.9: the same three layers) | **met**: the headline ends at 541 and the first went-well line at 612 (no frame on a learner-app screen; the stack header is the back button) |
| Sideways scroll | none at 320, 390, 768 and 1280 (section 3.12, e2e) | none on any of the 21 screen shots (`scrollWidth` equals the viewport), including 320 with 200 % text, nor in the three print emulations at 794 px |
| Targets | `touchTarget` (section 3.12) | every button, tab, link button and letter tile on the five page mocks is at least 64 x 64 (measured); letters and quest titles inside a sentence are inline text links, which WCAG 2.5.8 exempts |
| Print | one or two pages, layer 3 expanded, footer on every page, no navigation (section 3.10, print wireframe) | Chromium A4 PDF of each page mock: two pages each, footer on both pages, no block under the footer, nothing from the frame or the buttons (the `print-*-a4-p1` / `-p2` shots are those pages); see `print.md` |
| Colour as the only signal | never (section 3.12) | practiced cells are filled and carry the check, empty ones are outlines, not-saved ones dashed; the selected tab is paper, bold and outlined; the two growth lines differ by dash and by their legend values; every calendar has its sentence |

### Contrast (WCAG 2.1, from the token values)

| Pair | Ratio | Floor |
|---|---|---|
| Practiced cell fill (`brand.secondary`) on paper / on canvas | 5.20 / 4.91 | 3:1 (non-text) |
| Check (`text.onSecondary`) on the practiced fill | 5.20 | 3:1 |
| Empty and not-saved outline (`border.shape`) on paper / on canvas | 4.55 / 4.29 | 3:1 |
| "More than last week" (`feedback.successDark`) on paper | 7.55 | 4.5:1 |
| Selected tab outline (`brand.primary`) on the tab row (`surface.sunken`) | 4.59 | 3:1 |
| Unselected tab label (`text.secondary`) on `surface.sunken` | 7.12 | 4.5:1 |
| Print hint (`text.muted`) on canvas | 5.68 | 4.5:1 |
| Window dates (`text.secondary`) on canvas | 7.97 | 4.5:1 |
| Action label (`brand.primaryDark`) on `brand.primaryLight` | 5.76 | 4.5:1 |
| Growth lines: quests (`brand.primary`) / cards (`brand.secondary`) on paper | 5.44 / 5.20 | 3:1 |
| Pill and disclosure outlines (`border.strong`: Print, the step buttons, Open Learning Route, More detail, letter tiles) on canvas / on paper | 1.85 / 1.95 | not required: each of these controls is identified by its visible text label (WCAG 1.4.11 asks for 3:1 only for the visual information needed to identify a control, and a text label does that); the outline is decoration, as in LR-D's `link-button`, which the report reuses unchanged. The selected tab, whose state is shown by its outline, uses `brand.primary` (4.59, above) |

The two growth-line colours pass the dataviz validator for a two-series categorical palette (CVD separation ΔE 20.1, normal-vision ΔE 25.5) and are told apart by the dash too. No red anywhere: `feedback.danger` is not used on any report surface.

## Enlarged text

The 200 % shots use the browser's own text-size setting (Chromium `Page.setFontSizes`, default 32 instead of 16), as the site, Learning Route and app-shell mocks do: each `-text200` shot grows the viewport to the page height and sets the sizes again before the capture, because Chromium drops them on a resize. The console renders tokens as px inline styles today, which this setting does not enlarge; RP-7a2 and RP-8 write text in rem and the layout switches in em in `globals.css` where they touch layout, as F-SITE-002 and F-APP-001 do.

## Decisions taken in this design pass

- **At a glance is LR-D's block.** "Now on", the goal line and **Open Learning Route** form the `section` labelled "Learning Route" under the `h1`. Its two words are `console.learningRoute.open` (the link) and `console.learningRoute.section` (the region's `aria-label`), which LR-7 (#400) added for this link; `report.glance.openRoute` (RP-6) says the same thing, so RP-7a2 and RP-9 read the console keys and RP-7a1 deletes `report.glance.openRoute` (en, ko, es) in its i18n edit, so the shipped page never carries two copies of one string; "Last practice" sits outside it (LR-D moved the link from the end of the "Now on" line, which the report wireframe drew, to under the goal line). The avatar chip joins the `h1` row. The in-app report draws "Now on" and the link without a goal line: LR-D's goal cases are the console's (they read the projected summary), and the link opens the local page L1, which shows the device's own goal with its source.
- **Header on phones: two rows.** Back link and **Send a note** share the first row; **Print or save as PDF** with its hint is the second. On wide screens all three are one row with the actions on the right. The print hint stays beside the button (spec section 3.10 helper line), never in a tooltip. With Send a note hidden (flag off, archived, a school admin) the header is the back link and Print.
- **The selected window's dates sit in the stepper row** ("Oct 6 to Oct 12", "October 2026", "Oct 12"), between Previous and Next, so a grown-up who stepped back always sees which window the figures are for. The text is `report.step.range` (a week) or a formatted month or date, so it needs no new key. Next sits at the row's end and is absent on the current window; Previous is absent (not disabled) on the oldest window `stepOf` allows (the week or day inside the 35 day rows, the 24th month). The previous button names the window it opens ("Last week", then dates), and its accessible name is `a11y.report.step`. **Focus**: when a step removes the focused button (Next on reaching the current window, Previous on reaching the oldest), focus moves to the other step button, so it never drops to the page body.
- **Period tabs on the console are one segmented row**, not the learner app's pill `SectionTabs`: four tabs fit one row at 375 and 390, which the first-screen budget needs. The learner app keeps `SectionTabs` (spec section 3.12), which wrap to two rows.
- **Tabs and their panel.** Every tab has `aria-controls` naming one panel, and the report below the controls is that panel (`role="tabpanel"`, `aria-labelledby` the selected tab), in both apps. Activation is **manual**: arrow keys, Home and End move focus along the row, Enter or Space selects (and loads that period), so arrowing past three tabs never fires three report loads. Focus stays on the selected tab and the live region announces `a11y.report.periodChanged`.
- **Insight lines.** A small disc marks each line (brand colour for What went well, the shape colour for What to practice next), never a check or a star that would grade. The line's action sits to the right of its sentence on wide screens and under it on phones. Letters inside a sentence are inline text links ("ㅂ (b)") with the letter marked `lang="ko"`; quest titles in the P4 line are links too (RP-13). The strand tip is a second, smaller line under P2, linked as a whole.
- **Figures** are tiles: the count large, the label under it, and "More than {previous}" under the label only when the figure grew (OD-11). A zero is drawn like any other number, with no emphasis.
- **The calendar** is a row of seven square marks (week) or a month grid to date from Monday, each with its date above it (a narrow weekday letter in the week). Per-day minutes are not drawn: they are in the data, but a number in every cell crowds a 37 px column at 320 and adds nothing the Minutes figure does not say. The sentence under the calendar (`a11y.report.calendar`, `notSaved`, `calendarNone`) is visible, not only for screen readers, and it is what prints.
- **More detail** is one full-width disclosure button (`aria-expanded`), collapsed by default; its panel is a grid of `h3` blocks, one column on phones and two on wide screens. Every block has its `h3` from an existing key: "Since the start" sits in the **Milestones** block (`report.detail.milestones`, first line, then the window's milestones), and the starting spot leads the **Level check** block (it comes from the first level check). Letter tiles are 64 px squares (letter over romanization) whose accessible name is their visible content (the letter in `lang="ko"` and its romanization, no `aria-label` that would drop the language); links on the console (Browse after RP-13) and disclosure buttons in the app (`aria-expanded`, expanding to the content romanization and gloss). **New letters this period** is hidden when the window has none and when there is no `activity` (legacy).
- **Archived class**: the report is read-only. **Send a note**, **Add to a plan** and **Open the plan** are not drawn, and the console's existing archived sentence (`console.settings.archived.class`) sits under the glance, in the neutral state style. RP-7a2 reuses that key.
- **Empty and no_data have no tabs**: no period has anything to show. Legacy hides them too (spec section 3.14).
- **State lines** (stale, legacy, no_data, empty, archived, errors) are one neutral block on `surface.sunken`: no warning colour, no icon.
- **A window wholly after `asOf`** (the stale This week example): the `none_saved` headline, every calendar cell dashed with `a11y.report.notSaved`, no What went well, no rhythm line, and **no figure tiles**: not-saved days are left out of the figures (section 3.2), and a row of zeros would read as "did not practice". Practice next keeps the lines that do not depend on the window (P1, P3, P4). A window partly after `asOf` draws the figures up to `asOf` with `report.horizon` under the headline and no "more than".
- **Class figures count learners with `activity`.** The day bands, the median and the other day-by-day blocks cover `withActivity` (11 of 12 in the mock, so the bands add up to 11); the headline's total is `learners` (members), as behaviour 5 says. A learner on an older app is never counted in "Not yet".
- **The headline and W3.** In a week or a month the `practiced` headline and the W3 line state the same number of days ("Sam practiced on 3 days this week.", then "Sam practiced on 3 days."). The mock draws what section 3.6's rules give today; whether W3 is skipped when the headline already names the days is recorded in the spec's review log for RP-2b (#422), which owns the rule order. RP-2b decided it: W3 is skipped under a `practiced` headline and the next went-well rule moves up (W0 stays the last resort); the mocks are not redrawn, so where they show the W3 line after a `practiced` headline, RP-7a1 renders the next rule's line instead.
- **Class letters are counted chips** ("ㅂ (b): 5", `report.class.count`), in the module's order (count, then letter order). Bands and strand statuses are plain text rows; no bars, so no band or status looks bigger than another and "Not yet" is never highlighted.
- **Plan a lesson** sits at the end of Practice together, the only action on the class page besides Print.
