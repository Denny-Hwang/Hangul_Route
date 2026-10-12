# Learner report: one learner's dashboard on the console (screen spec v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` sections 3.1, 3.2, 3.5, 3.6, 3.10, 3.12, 3.14, 3.15 · wireframe `design/wireframes/reports/learner-report.md`
Mock: `mock/learner-report.html` (parent, week), `mock/learner-report-teacher.html` (teacher, month), `mock/learner-report-all.html` (all time), `mock/learner-report-states.html` (board)
Shots: `shots/learner-report-390-first.png`, `-375.png`, `-1280.png`, `-320-text200.png`, `learner-report-teacher-375.png`, `-1280.png`, `learner-report-all-375.png`, `-1280.png`, `learner-report-states-375.png`, `-1280.png`
Code (planned): RP-7a2 the page under `app/(console)/teach/space/learner/` (and `/parent/learner` in RP-7c), sentences from `lib/console/report-view.ts` (RP-7a1); RP-7b the growth block and the print rules

## Layout

Inside the adult frame (F-APP-001 A-5a), one `main` at most `layout.maxWidth.full`, padding `spacing.md` top and `layout.gutter.*` inline, parts `spacing.sm` apart.

```
[< Back to home]                                       <- row 1 on phones: the back link alone (a long name wraps here)
[Send a note] [Print or save as PDF]                   <- row 2 on phones
Turn off headers and footers in the print dialog.      <- the hint, under row 2 (beside Print when it fits); all one row from 45em
(o) Sam: report                                   h1
Now on Stage 1: Hangul                            \
[flag] Sam's goal: Stage 2 · Words                 } LR-D's "Learning Route" region, unchanged
( Open Learning Route )                           /
Last practice: Oct 12
[ Today |[This week]| This month | All time ]      <- tablist
( < Last week )  Oct 6 to Oct 12        ( Next > ) <- stepper; Next only on a past window
Sam practiced on 3 days this week.                 <- headline (layer 1)
What went well            (h2)  o o o
What to practice next     (h2)  o line  ( Add to a plan ) ( Preview )   <- P1; Preview behind browseEnabled()
                                o line  ( Open the plan )
                                o Next in the plan: Family at the Table.
This period               (h2)  figure tiles, then the calendar (layer 2)
[ More detail          v ]      disclosure (layer 3), collapsed
```

From 60em the body below the stepper is two columns: layer 1 left (6fr), layer 2 right (5fr), layer 3 across both. The header, the glance and the tabs stay full width above them.

## Parts and tokens

| Part | Drawn as |
|---|---|
| Back link | LR-D's `back-link`: `arrow-left` 20, `brand.secondaryDark` underlined semibold, `touchTarget.min` tall. Text `report.back.home` (`from=home`) or `report.back.space(space)` (`from=roster`). On a phone it has the header's first row to itself and wraps inside it, so a long space name never pushes Send a note and Print onto a third row |
| Send a note | ghost pill (`brand.primaryLight` fill, `brand.primaryDark` bold label `size.bodySm`), `note` glyph 20, `touchTarget.min` tall. Only when RP-12's rules allow it (notes flag on, space not archived, viewer may send) |
| Print or save as PDF | LR-D's `link-button` (paper, `borderWidth.thin` `border.strong`, `radii.pill`, bold `size.bodySm`), `aria-describedby` naming `report.print.hint`, which sits at `size.caption` `text.muted` under the Send a note and Print row on a phone (beside Print when there is room, and from 45em). Disabled (sunken, muted label) while the report loads or failed |
| Title | `h1` `size.title` bold, `report.title.learner(name)`, the roster's name (initials when the class anonymizes). The 28 px avatar chip sits before it, `aria-hidden` |
| At a glance | LR-D's block (`design/screens/learning-route/stage-list.md`): a `section` labelled `console.learningRoute.section` holding `report.glance.nowOn`, the goal line and the link `console.learningRoute.open` (the console never reads `report.glance.openRoute`, which is the learner app's word for the same link; README, decisions), then `report.glance.lastPractice` at `size.bodySm` `text.muted`. Not rendered in `no_data` |
| Period tabs | `role="tablist"` labelled `a11y.report.periods`; a `surface.sunken` row, `radii.lg`, padding `spacing.xs`; four tabs at least 4.5rem wide and `touchTarget.min` tall, `size.bodySm` semibold `text.secondary`. Selected: paper fill, `borderWidth.base` `brand.primary`, bold `text.primary`. Each tab has an `id` and `aria-controls` naming the report panel; only the selected tab is in the tab order (`tabindex="-1"` on the others). **Manual activation**: arrow keys, Home and End move focus; Enter or Space selects and loads the period. Focus stays on the selected tab; the polite live region says `a11y.report.periodChanged`. The row is drawn disabled only on the first load; while a new period or step loads, the tabs stay enabled and only the panel is busy (README, decisions) |
| Report panel | everything below the tab row and the stepper (the headline and the three layers) is one `role="tabpanel"` with `aria-labelledby` the selected tab. The tab row and the stepper are its controls and sit above it, outside it (the mocks' `.report-controls`); the step buttons carry `aria-controls` naming the panel. It adds no box of its own |
| Stepper | step buttons (paper, `border.strong` thin outline, pill, `arrow-left` / `arrow-right` 20, bold `size.bodySm`, `touchTarget.min`). Between them the window's dates at `size.bodySm` `text.secondary`. Previous reads `report.step.prevDay` / `prevWeek` / `prevMonth` for the first step back, then the dates of the window it opens (`report.step.range` or a formatted month); Next reads `report.step.next` and is absent on the current window; Previous is absent (not disabled) on the oldest window `stepOf` allows (35 day rows for a day or a week, 24 months). When a step removes the focused button, focus moves to the other step button, never to the page body. Accessible names `a11y.report.step(window)`; `aria-controls` the report panel. No stepper on All time |
| Headline | `size.prompt` bold, `leading.tight`. `report.horizon(date)` under it at body size `text.secondary` when the window reaches past `asOf` |
| Section headings | `h2` `size.bodyLg` bold. A section with no lines renders no heading |
| Insight line | a list item: an 8 px disc (`brand.primary` in What went well, `border.shape` in What to practice next) on the first line, the sentence at body size, and the actions beside it from about 14rem of sentence width, under it below that. One action is a ghost pill as Send a note; P1 has two side by side in one group, **Add to a plan** (ghost pill) and **Preview** (LR-D's outlined `link-button`, behind `browseEnabled()`, F-BROWSE-001 BR-11), both `touchTarget.min` tall. The strand tip (`report.tip.*`) is a second line at `size.bodySm` `text.secondary`, a `brand.secondaryDark` link that is a link on its own line, so it is an `inline-flex` box `touchTarget.min` tall |
| Letters in a sentence | `report.letter(letter, romanization)`, the letter in `lang="ko"` bold, the whole as an inline text link (`brand.secondaryDark`, thin underline). Never wraps inside |
| Figure tile | paper, `border.subtle` thin, `radii.md`, padding `spacing.sm` x `spacing.md`; the count at `size.title` bold over the label (`report.figure.*`, `size.bodySm` `text.secondary`); `report.figure.up(previous)` under it at `size.caption` semibold `feedback.successDark` only when the figure grew. Tiles at least 7rem, auto-filled |
| Calendar | see "Calendar" below |
| More detail | one disclosure button (paper, `border.strong`, `radii.md`, `size.bodyLg` bold, `arrow-right` turned down / up), `aria-expanded`, `aria-controls` its panel; the panel holds the items of spec section 3.5 item 10 as blocks, each under an `h3` (layer 3 row below) |

## The three layers

| Layer | What | Why here |
|---|---|---|
| 1 | header, at a glance, tabs and stepper, headline, What went well, What to practice next | the answer before any number (owner items 2 and 13) |
| 2 | This period: figures, then the calendar (week, month) or the growth block (all) | the numbers behind the sentence |
| 3 | More detail, collapsed. Blocks and their `h3`: **letters known well** (`report.detail.lettersStrong`, up to 24); **letters being practiced** (`lettersPractising`, up to 3); **new letters this period** (`lettersNew`, the window's letters from `activity.days[].j`; hidden when empty and when there is no `activity`); the totals (`report.detail.totals`, "Since the start: ...") as the panel's first line across its columns, with no `h3`; **Milestones** (`report.detail.milestones`, the window's milestones, every milestone on All time; the block and its `h3` render only when there is one); **Level check** (`report.detail.levelCheck`: the starting spot first, `console.placement.startingSpot` with `learner.placement.band`, then `report.detail.levelCheckOn` and one `report.detail.strand` line per strand with `caregiver.placementReport.strand` and `report.strand.status`; hidden with no level check); **Plan** (`report.detail.plan`: `planRow.family` and `.self` for a family, `.class` for a class) | the rest, one tap away; always expanded in print |

**First screen at 390 x 844** (frame counted): the headline ends at 708 px and the first went-well line at 779 px (README, "Measured on the mock"). The teacher variant (month, class goal line on two lines) ends its first went-well line at 804 px, with "Sunflower class" and with longer class names alike, because the back link has its own header row. In the stale state the headline stays visible (it ends at 811 px); a stale week has no went-well line (the week is after `asOf`), and in a stale month the first went-well line ends 79 px below the fold.

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
| loading (first load) | the header (Print disabled), the `h1`, the tab row disabled, a visually hidden `role="status"` line `a11y.report.loading` as the panel's sibling right before it (never inside the busy panel), and the panel with `aria-busy="true"` holding three skeleton blocks. A later period or step change keeps the tabs and step buttons enabled and only marks the panel busy |
| no_data | the `h1`, then one neutral block: `report.state.noData(name)` and `report.state.noDataAction`. No glance, no tabs, never "has not practiced" (behaviour 12) |
| empty | the glance without "Last practice", `report.state.empty(name)`, then the P4 line when the app has one (`next_on_route`) under its `h2` What to practice next (a section with a line always has its heading). No tabs |
| legacy | the glance, `report.state.legacy` and `report.state.updateAction(name)`, then More detail (open on the board) from today's summary fields: letters, totals, starting spot, level check, plan. No **New letters this period** (it needs `activity`). No tabs |
| stale | under the glance one neutral block with `report.state.stale(date)` and `report.state.updateAction(name)`; the window follows the data horizon. Two examples, last saved Oct 2 (`asOf` Oct 2, last practice Oct 2): **This week** (Oct 6 to Oct 12, wholly after `asOf`): `report.headline.noneSaved(name, when)`, seven dashed cells with `a11y.report.notSaved`, no What went well, no P0, no figure tiles, P1 kept. **This month** (October, partly after `asOf`): `report.horizon('Oct 2')` under the headline, figures up to Oct 2 without "more than", Oct 3 to Oct 12 dashed, both calendar sentences, no P0 |
| partial window | `report.horizon(date)` under the headline; dashed cells after `asOf`; both calendar sentences; no rhythm line (behaviour 13) |
| no practice in the window | headline `report.headline.noneYet(when)`; no What went well; `insight.rhythm` first; figures at 0 drawn like any number; all outlines; `a11y.report.calendarNone` |
| archived class | no Send a note, no Add to a plan or Open the plan; **Preview** stays (read-only); `console.settings.archived.class` in a neutral block under the glance for a viewer with `space.manage`, the neutral `report.state.archived.class` (RP-7a1) for everyone else |
| anonymized class | the roster's initials in the `h1` (and in print); `document.title` stays `report.documentTitle` |
| Today | `headline.practicedOn`, W-lines (`practice_day` for W3), only P1 in practice next, figures without "more than", no calendar |
| a step back | Previous shows the dates of the window before, Next returns; figures compare with `report.previous.weekBefore` / `monthBefore` |
| the oldest window | Previous absent (the week Sep 8 to Sep 14 is the last one inside the 35 day rows); Next returns. The headline names the window (`report.when.weekTo`) |
| a month older than the day rows | totals only: figures from `activity.months` (no letters), no calendar; only W0, W3, W5, W6 |
| getting started | `headline.gettingStarted`; practice next holds only P4 |
| stage finished | `headline.stageDone`, then W1, W3 and W5 in table order: finishing a stage finishes its last quest, so `quests_new` always fires; with no new letters there is no W2, and the streak (W9) comes after the first three |
| free-end | P4 `free_days_done` (family and device only); no price, no link, no lock |
| unavailable / flag off | the back link and one block whose sentence is the page's `h1` (`report.state.unavailable` / `report.state.flagOff`; no learner name is known). No actions |
| network error | `report.state.error` as the `h1` (the first load failed, so no name is known) and `common.buttons.tryAgain`; Print disabled; a cached report stays visible above when there is one, under its own `h1` |
| parent chooser | `report.chooser.learner` as the `h1`, one row per learner (avatar, name, `arrow-right`), at least `touchTarget.min` tall, roster order, never a figure |

## Accessibility

- Reading order = visual order: back, Send a note, Print, `h1`, the Learning Route region, Last practice, the tabs, the stepper, the headline, `h2` What went well, `h2` What to practice next, `h2` This period, the More detail button and its `h3` blocks.
- Every target is at least `touchTarget.min` (measured on the mock), the strand-tip link included; only the letter links and the P4 quest title, links inside a sentence, are exempt.
- Letters: the letter is `lang="ko"`; its accessible name says the letter and its romanization. On a tile the name is the visible content (the `lang="ko"` letter and the romanization span), never an `aria-label`, which would replace the content and lose the language switch; RP-7a1's label helper returns the two parts, not one string.
- Colour never carries meaning alone (README, contrast table). No `feedback.danger`, no down arrow, no "less".
- 200 % text at 320: one column, the tabs drop to fewer per row, the header wraps; nothing scrolls sideways (`shots/learner-report-320-text200.png`).

## Notes for the PRs

- **RP-7a1**: the window line in the stepper row is `report.step.range(from, to)` for every week window (the current one too), a formatted month for a month and a formatted date for a day. The current window's Next is absent, not disabled, and so is the oldest window's Previous. Update the doc comment of `report.step.range` ("A week window older than the first step") to say it also names the current window, and have the KO / ES review check the wording in that use.
- **RP-7a2**: when a step removes the focused step button, move focus to the other step button; the e2e asserts `document.activeElement` is not `body` after stepping forward to the current window. Tabs use manual activation and the report body is the `tabpanel` (Parts). After switching periods the e2e asserts `document.activeElement` is the selected tab (the tabs stay enabled while the period loads).
- **RP-7a2**: the first-screen e2e (section 3.5) asserts two fixtures at 390 x 844: the ready parent fixture (`report.back.home`) and the class-viewer fixture with `report.back.space`, so the teacher header (back link row, then Send a note and Print) is checked too.
- **RP-7a1**: the All-time `practiced` headline is `report.headline.practiced(name, days, report.when.all)` ("Sam practiced on 23 days so far.", `mock/learner-report-all.html`); `stageDone` on All time is `stageDoneAll` and no practice is `noneEver`. Update the doc comment on `report.headline` ("never `when.all`") to say `practiced` takes `when.all` on the `all` period.
- **RP-7a1**: add `report.state.archived.{family,class}` (neutral, without "until you unarchive it") for archived-report viewers without `space.manage` (README, decisions); RP-7a2 picks the sentence by that permission.
- **RP-7a1**: letters inside sentences use `report.letter` with the short sound value the spec's behaviour 4 shows ("ㅂ (b)"); the letter tile shows the same value under the letter. The full content romanization ("b/p (bieup)") and the gloss appear where a letter expands (before RP-13).
- **RP-7a2**: the goal line under "Now on" is LR-8's or RP-7a2's, whichever lands second (LR-D, `stage-list.md`); until then the region holds "Now on" and the link.
- **RP-7a2**: the P1 sentence names letters only. Its quest (`activity.revisit`) travels in **Add to a plan** and in **Preview**; `report.insight.letters_revisit` has no quest slot, so P1 has no quest title to link. RP-7a2 lays out the action group with room for both; F-BROWSE-001 BR-11 adds **Preview** behind `browseEnabled()` (`openBrowse({ kind: 'quest', id }, 'report')`, content ids only). RP-13 links P1's letters.
- **RP-12**: Send a note's place is the header, beside Print, never in an insight line.
- **RP-13**: letter links, the P4 quest title and the strand tip become `openBrowse` links; their look is drawn here. P1's quest goes through the BR-11 **Preview** action, not RP-13.
