# Learner report: one learner's dashboard on the console (screen spec v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` sections 3.1, 3.2, 3.5, 3.6, 3.10, 3.12, 3.14, 3.15 · wireframe `design/wireframes/reports/learner-report.md`
Mock: `mock/learner-report.html` (parent, week), `mock/learner-report-teacher.html` (teacher, month), `mock/learner-report-all.html` (all time), `mock/learner-report-states.html` (board)
Shots: `shots/learner-report-390-first.png`, `-375.png`, `-1280.png`, `-320-text200.png`, `learner-report-teacher-375.png`, `-1280.png`, `learner-report-all-375.png`, `-1280.png`, `learner-report-states-375.png`, `-1280.png`
Code (planned): RP-7a2 the page under `app/(console)/teach/space/learner/` (and `/parent/learner` in RP-7c), sentences from `lib/console/report-view.ts` (RP-7a1); RP-7b the growth block and the print rules

## Layout

Inside the adult frame (F-APP-001 A-5a), one `main` at most `layout.maxWidth.full`, padding `spacing.md` top and `layout.gutter.*` inline, parts `spacing.sm` apart.

```
[< Back to home]                    [Send a note]      <- row 1 on phones
[Print or save as PDF] Turn off headers and footers... <- row 2 on phones; one row with row 1 from ~45em
(o) Sam: report                                   h1
Now on Stage 1: Hangul                            \
[flag] Sam's goal: Stage 2 · Words                 } LR-D's "Learning Route" region, unchanged
( Open Learning Route )                           /
Last practice: Oct 12
[ Today |[This week]| This month | All time ]      <- tablist
( < Last week )  Oct 6 to Oct 12        ( Next > ) <- stepper; Next only on a past window
Sam practiced on 3 days this week.                 <- headline (layer 1)
What went well            (h2)  o o o
What to practice next     (h2)  o line  ( Add to a plan )
                                o line  ( Open the plan )
                                o Next in the plan: Family at the Table.
This period               (h2)  figure tiles, then the calendar (layer 2)
[ More detail          v ]      disclosure (layer 3), collapsed
```

From 60em the body below the stepper is two columns: layer 1 left (6fr), layer 2 right (5fr), layer 3 across both. The header, the glance and the tabs stay full width above them.

## Parts and tokens

| Part | Drawn as |
|---|---|
| Back link | LR-D's `back-link`: `arrow-left` 20, `brand.secondaryDark` underlined semibold, `touchTarget.min` tall. Text `report.back.home` (`from=home`) or `report.back.space(space)` (`from=roster`) |
| Send a note | ghost pill (`brand.primaryLight` fill, `brand.primaryDark` bold label `size.bodySm`), `note` glyph 20, `touchTarget.min` tall. Only when RP-12's rules allow it (notes flag on, space not archived, viewer may send) |
| Print or save as PDF | LR-D's `link-button` (paper, `borderWidth.thin` `border.strong`, `radii.pill`, bold `size.bodySm`), with `report.print.hint` beside it at `size.caption` `text.muted`. Disabled (sunken, muted label) while the report loads or failed |
| Title | `h1` `size.title` bold, `report.title.learner(name)`, the roster's name (initials when the class anonymizes). The 28 px avatar chip sits before it, `aria-hidden` |
| At a glance | LR-D's block (`design/screens/learning-route/stage-list.md`): a `section` labelled `console.learningRoute.section` holding `report.glance.nowOn`, the goal line and the link `console.learningRoute.open` (not `report.glance.openRoute`, which RP-7a1 deletes; README, decisions), then `report.glance.lastPractice` at `size.bodySm` `text.muted`. Not rendered in `no_data` |
| Period tabs | `role="tablist"` labelled `a11y.report.periods`; a `surface.sunken` row, `radii.lg`, padding `spacing.xs`; four tabs at least 4.5rem wide and `touchTarget.min` tall, `size.bodySm` semibold `text.secondary`. Selected: paper fill, `borderWidth.base` `brand.primary`, bold `text.primary`. Each tab has an `id` and `aria-controls` naming the report panel; only the selected tab is in the tab order (`tabindex="-1"` on the others). **Manual activation**: arrow keys, Home and End move focus; Enter or Space selects and loads the period. Focus stays on the selected tab; the polite live region says `a11y.report.periodChanged` |
| Report panel | everything below the controls (the stepper's window, the headline, the three layers) is one `role="tabpanel"` with `aria-labelledby` the selected tab. It adds no box of its own |
| Stepper | step buttons (paper, `border.strong` thin outline, pill, `arrow-left` / `arrow-right` 20, bold `size.bodySm`, `touchTarget.min`). Between them the window's dates at `size.bodySm` `text.secondary`. Previous reads `report.step.prevDay` / `prevWeek` / `prevMonth` for the first step back, then the dates of the window it opens (`report.step.range` or a formatted month); Next reads `report.step.next` and is absent on the current window; Previous is absent (not disabled) on the oldest window `stepOf` allows (35 day rows for a day or a week, 24 months). When a step removes the focused button, focus moves to the other step button, never to the page body. Accessible names `a11y.report.step(window)`. No stepper on All time |
| Headline | `size.prompt` bold, `leading.tight`. `report.horizon(date)` under it at body size `text.secondary` when the window reaches past `asOf` |
| Section headings | `h2` `size.bodyLg` bold. A section with no lines renders no heading |
| Insight line | a list item: an 8 px disc (`brand.primary` in What went well, `border.shape` in What to practice next) on the first line, the sentence at body size, and the action (ghost pill as Send a note) beside it from about 14rem of sentence width, under it below that. The strand tip (`report.tip.*`) is a second line at `size.bodySm` `text.secondary`, a `brand.secondaryDark` link |
| Letters in a sentence | `report.letter(letter, romanization)`, the letter in `lang="ko"` bold, the whole as an inline text link (`brand.secondaryDark`, thin underline). Never wraps inside |
| Figure tile | paper, `border.subtle` thin, `radii.md`, padding `spacing.sm` x `spacing.md`; the count at `size.title` bold over the label (`report.figure.*`, `size.bodySm` `text.secondary`); `report.figure.up(previous)` under it at `size.caption` semibold `feedback.successDark` only when the figure grew. Tiles at least 7rem, auto-filled |
| Calendar | see "Calendar" below |
| More detail | one disclosure button (paper, `border.strong`, `radii.md`, `size.bodyLg` bold, `arrow-right` turned down / up), `aria-expanded`, `aria-controls` its panel; the panel holds the items of spec section 3.5 item 10 as blocks, each under an `h3` (layer 3 row below) |

## The three layers

| Layer | What | Why here |
|---|---|---|
| 1 | header, at a glance, tabs and stepper, headline, What went well, What to practice next | the answer before any number (owner items 2 and 13) |
| 2 | This period: figures, then the calendar (week, month) or the growth block (all) | the numbers behind the sentence |
| 3 | More detail, collapsed. Blocks and their `h3`: **letters known well** (`report.detail.lettersStrong`, up to 24); **letters being practiced** (`lettersPractising`, up to 3); **new letters this period** (`lettersNew`, the window's letters from `activity.days[].j`; hidden when empty and when there is no `activity`); **Milestones** (`report.detail.milestones`: `report.detail.totals` first, then the window's milestones, every milestone on All time); **Level check** (`report.detail.levelCheck`: the starting spot first, `console.placement.startingSpot` with `learner.placement.band`, then `report.detail.levelCheckOn` and one `report.detail.strand` line per strand with `caregiver.placementReport.strand` and `report.strand.status`; hidden with no level check); **Plan** (`report.detail.plan`: `planRow.family` and `.self` for a family, `.class` for a class) | the rest, one tap away; always expanded in print |

**First screen at 390 x 844** (frame counted): the headline ends at 690 px and the first went-well line at 761 px (README, "Measured on the mock"). In the stale state the headline stays visible (it ends at 793 px); a stale week has no went-well line (the week is after `asOf`), and in a stale month the first went-well line ends 60 px below the fold. The teacher variant's two-line goal puts its first went-well line 10 px below.

## Calendar

| Kind | Mark | Text alternative |
|---|---|---|
| practiced | a square (the column width, at most 48 px, `radii.sm`) filled `brand.secondary`, outlined `brand.secondaryDark` `borderWidth.base`, with the `check` glyph in `text.onSecondary` at 60 % | listed in `a11y.report.calendar(days)` |
| none (an empty day) | the same square on paper, outlined `border.shape` `borderWidth.base` | not named (an empty day is never labelled) |
| not saved yet (after `asOf`) | the same square, transparent, dashed `border.shape` | `a11y.report.notSaved(days)` |

- **Week**: seven columns, the rolling window's days in order (OD-1), each labelled with a narrow weekday letter over the day of the month (`size.caption`; the weekday from `Intl`, so it follows the console locale).
- **Month**: a weekday header row (narrow letters, Monday first), blank cells before the 1st, one cell per day to date (OD-2). A totals-only month has no calendar.
- The sentence under the calendar is visible (`size.bodySm` `text.secondary`), lists the days by weekday name in a week and by date in a month, and is what prints. With no practice it reads `a11y.report.calendarNone`. The grid itself is `aria-hidden`.
- Per-day minutes are not drawn (README, decisions).

## All time: the growth block (RP-7b)

- A legend row first: a 24 px line sample and the series name with its latest value in bold (`report.growth.quests` 6, `report.growth.cards` 5): quests solid `brand.primary`, cards dashed `brand.secondary`.
- The chart: paper, `border.subtle`, `radii.md`; recessive horizontal grid lines (`border.subtle` 1 px), two cumulative lines at 2 px with 8 px markers ringed in paper, one point per month in `activity.months` after the "earlier" baseline. The lines only rise (OD-10). No per-month bars, no y-axis numbers (the legend and the table carry the values). The month labels sit under their points (`size.caption` `text.muted`).
- `report.growth.since(date, days)` under it, then the toggle `report.growth.showTable` / `hideTable` (`aria-expanded`), then the table (`caption` `a11y.report.growthTable`; columns `report.growth.month`, `quests`, `cards`; cumulative values). The SVG is `role="img"` named `a11y.report.growthTable`.
- A hover layer (a crosshair with the month's two values) may be added in RP-7b; the table is the required alternative and is enough for v1.

## Variants

| | Parent (family space) | Teacher (class space) |
|---|---|---|
| Back | `report.back.home` (from the parent home) or the space | `report.back.space(class)` (from the roster) |
| Goal line | LR-D case 1 (the learner's own goal) or 2 or 3 | LR-D class case 2 or 3 |
| Plan words | `insight.plan_open.family`, `plan_done.family`, `detail.planRow.family` and `.self` | `.class` (homework) |
| P4 | `next_in_plan`, `next_on_route` or `free_days_done` | always `next_on_route`; no free-end line |
| Send a note | caregiver or owner | teacher or owner; never a school admin |

Both variants show the same layers; nothing else differs. Neither shows a class figure, an average or another learner.

## States (board `mock/learner-report-states.html`)

| State | Drawn |
|---|---|
| loading | the header (Print disabled), the `h1`, the tab row disabled with `aria-busy` and the label `a11y.report.loading`, three skeleton blocks |
| no_data | the `h1`, then one neutral block: `report.state.noData(name)` and `report.state.noDataAction`. No glance, no tabs, never "has not practiced" (behaviour 12) |
| empty | the glance without "Last practice", `report.state.empty(name)`, then the P4 line when the app has one (`next_on_route`). No tabs |
| legacy | the glance, `report.state.legacy` and `report.state.updateAction(name)`, then More detail (open on the board) from today's summary fields: letters, totals, starting spot, level check, plan. No **New letters this period** (it needs `activity`). No tabs |
| stale | under the glance one neutral block with `report.state.stale(date)` and `report.state.updateAction(name)`; the window follows the data horizon. Two examples, last saved Oct 2 (`asOf` Oct 2, last practice Oct 2): **This week** (Oct 6 to Oct 12, wholly after `asOf`): `report.headline.noneSaved(name, when)`, seven dashed cells with `a11y.report.notSaved`, no What went well, no P0, no figure tiles, P1 kept. **This month** (October, partly after `asOf`): `report.horizon('Oct 2')` under the headline, figures up to Oct 2 without "more than", Oct 3 to Oct 12 dashed, both calendar sentences, no P0 |
| partial window | `report.horizon(date)` under the headline; dashed cells after `asOf`; both calendar sentences; no rhythm line (behaviour 13) |
| no practice in the window | headline `report.headline.noneYet(when)`; no What went well; `insight.rhythm` first; figures at 0 drawn like any number; all outlines; `a11y.report.calendarNone` |
| archived class | no Send a note, no line actions; `console.settings.archived.class` in a neutral block under the glance |
| anonymized class | the roster's initials in the `h1` (and in print); `document.title` stays `report.documentTitle` |
| Today | `headline.practicedOn`, W-lines (`practice_day` for W3), only P1 in practice next, figures without "more than", no calendar |
| a step back | Previous shows the dates of the window before, Next returns; figures compare with `report.previous.weekBefore` / `monthBefore` |
| the oldest window | Previous absent (the week Sep 8 to Sep 14 is the last one inside the 35 day rows); Next returns. The headline names the window (`report.when.weekTo`) |
| a month older than the day rows | totals only: figures from `activity.months` (no letters), no calendar; only W0, W3, W5, W6 |
| getting started | `headline.gettingStarted`; practice next holds only P4 |
| stage finished | `headline.stageDone` and W1 |
| free-end | P4 `free_days_done` (family and device only); no price, no link, no lock |
| unavailable / flag off | the back link and one block: `report.state.unavailable` / `report.state.flagOff`. No actions |
| network error | `report.state.error` and `common.buttons.tryAgain`; Print disabled; a cached report stays visible above when there is one |
| parent chooser | `report.chooser.learner` as the `h1`, one row per learner (avatar, name, `arrow-right`), at least `touchTarget.min` tall, roster order, never a figure |

## Accessibility

- Reading order = visual order: back, Send a note, Print, `h1`, the Learning Route region, Last practice, the tabs, the stepper, the headline, `h2` What went well, `h2` What to practice next, `h2` This period, the More detail button and its `h3` blocks.
- Every target is at least `touchTarget.min` (measured on the mock); inline letter and quest links are text links inside sentences.
- Letters: the letter is `lang="ko"`; its accessible name says the letter and its romanization. On a tile the name is the visible content (the `lang="ko"` letter and the romanization span), never an `aria-label`, which would replace the content and lose the language switch; RP-7a1's label helper returns the two parts, not one string.
- Colour never carries meaning alone (README, contrast table). No `feedback.danger`, no down arrow, no "less".
- 200 % text at 320: one column, the tabs drop to fewer per row, the header wraps; nothing scrolls sideways (`shots/learner-report-320-text200.png`).

## Notes for the PRs

- **RP-7a1**: the window line in the stepper row is `report.step.range(from, to)` for every week window (the current one too), a formatted month for a month and a formatted date for a day. The current window's Next is absent, not disabled, and so is the oldest window's Previous. Update the doc comment of `report.step.range` ("A week window older than the first step") to say it also names the current window, and have the KO / ES review check the wording in that use.
- **RP-7a2**: when a step removes the focused step button, move focus to the other step button; the e2e asserts `document.activeElement` is not `body` after stepping forward to the current window. Tabs use manual activation and the report body is the `tabpanel` (Parts).
- **RP-7a1**: letters inside sentences use `report.letter` with the short sound value the spec's behaviour 4 shows ("ㅂ (b)"); the letter tile shows the same value under the letter. The full content romanization ("b/p (bieup)") and the gloss appear where a letter expands (before RP-13).
- **RP-7a2**: the goal line under "Now on" is LR-8's or RP-7a2's, whichever lands second (LR-D, `stage-list.md`); until then the region holds "Now on" and the link.
- **RP-7a2**: the P1 sentence names letters only. Its quest (`activity.revisit`) travels in **Add to a plan**; `report.insight.letters_revisit` has no quest slot, so P1 has no quest title to link. The spec's section 3.6 now says so (P1 row and the Browse links item; review log): RP-13 links P1's letters, not a quest title.
- **RP-12**: Send a note's place is the header, beside Print, never in an insight line.
- **RP-13**: letter links, the P4 quest title and the strand tip become `openBrowse` links; their look is drawn here.
