# Class report: class statistics for a teacher, aggregates only (screen spec v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` sections 3.1, 3.7, 3.8, 3.10, 3.14 · wireframe `design/wireframes/reports/class-report.md`
Mock: `mock/class-report.html` (week, More detail open with `#open`), `mock/class-report-states.html` (board)
Shots: `shots/class-report-390-first.png`, `-375.png`, `-1280.png`, `-320-text200.png`, `class-report-states-375.png`, `-1280.png`
Code (planned): RP-8, the page under `app/(console)/teach/space/report/` and the class chooser; print through RP-7b's rules

## Layout

The learner report's frame, header, tabs, stepper and body grid (`learner-report.md`), with the class blocks:

```
[< Back to Sunflower class]                          row 1 on phones: the back link alone
[Print or save as PDF] Turn off headers and ...      row 2: Print with its hint beside it; one row from 45em
Sunflower class: class report                       h1 (no avatar)
12 learners                                          report.class.learners
1 learner has an older app: their day-by-day ...     report.class.olderApp   (only when > 0)
2 learners last saved more than 7 days ago.          report.class.notSaved   (only when > 0)
[ Today |[This week]| This month | All time ]
( < Last week )  Oct 6 to Oct 12
8 of 12 learners practiced this week.                report.class.headline   \
More than last week                                  only when it grew        |
What went well                     (h2)                                       |
  Letters the class got strong on  (h3)  (ㅂ (b): 5) (ㅅ (s): 4) ...  max 5  | layer 1
  New quests: 14  More than last week / New cards: 9                          |
  Stage milestones this week       (h3)  Stage 1: Hangul, finished by 2 learners
Practice together                  (h2)                                       |
  Letters to revisit together      (h3)  (ㅊ (ch): 4) ...  max 5              |
  ( Plan a lesson )                      lecture mode only                   /
This period                        (h2)                                      layer 2
  Days practiced (h3): Not yet: 3 / 1 to 2 days: 3 / 3 to 4 days: 3 / 5 to 7 days: 2   (11 with activity)
  Time (h3): Total time: 212 minutes  More than last week / Typical time for those who practiced: 24 minutes
[ More detail  v ]                                                           layer 3
  Level check (learners who took one) (h3): per strand (h4) four count rows
  Homework (h3): [ plan title / Assigned to 12, started by 9, finished by 6 ]   one link block per plan
```

From 60em: layer 1 left, layer 2 right, More detail across. The class-level lines sit under the `h1` at `size.bodySm` `text.muted`, one per line, neutral.

## Parts

| Part | Drawn as |
|---|---|
| Headline | `report.class.headline(count, total, when)` at `size.prompt` bold; `report.figure.up(previous)` under it (`size.caption` semibold `feedback.successDark`) only when `practiced` grew |
| Letter count chips | one pill per letter, `surface.sunken`, `size.bodySm` semibold: `report.class.count(report.letter(letter, romanization), learners)`, the letter `lang="ko"`. Order: the module's (count, then letter order); at most 5. Not links: they are counts, and Browse links belong to the learner report (RP-13 adds them there) |
| New quests / New cards | `report.class.questsNew`, `cardsNew` as body lines; the up-only line after New quests when it grew |
| Milestones | `report.class.milestones(when)` as `h3`, then `report.class.milestone(n, stage, count)` per stage finished in the window. Events only, never a standing count per stage (OD-4). Hidden when none |
| Plan a lesson | ghost pill as the learner report's actions, at the end of Practice together, only when `lectureModeEnabled()` |
| Bands | `report.class.section.daysPracticed` as `h3`, then one text row per band. The bands count learners with `activity` only (`withActivity`), so they add up to 11 in the mock, where 1 of the 12 members has an older app: a learner without day-by-day data is never counted in "Not yet". The same holds for every day-by-day block (the median, new quests and cards, new letters); the headline's total is `learners` (members), as behaviour 5 says (`report.class.count(band label, n)`), separated by `border.subtle` rules, no bar and no highlight on any row. Week: `band.none`, `range(1, 2)`, `range(3, 4)`, `range(5, 7)`; month: `none`, `range(1, 4)`, `range(5, 9)`, `atLeast(10)`; day: `band.practiced`, `band.none`; all: no bands |
| Time | `report.class.section.time` as `h3`; `minutesTotal` (with the up-only line when it grew) and `medianMinutes` over the learners who practiced, hidden when fewer than 3 practiced, on every period including Today (section 3.7) |
| Level check | `report.class.section.levelCheck` as `h3`, then a grid of strands (one per row on phones): `h4` strand name (`caregiver.placementReport.strand`) and four rows `report.class.count(report.strand.status.*, n)`. Counts only (OD-5); no names, no levels, no percentages |
| Homework | `report.class.section.homework` as `h3`; up to three plans, newest first, each **one link block** to the plan builder, at least `touchTarget.min` tall (paper, `border.subtle` thin, `radii.md`, padding `spacing.xs` x `spacing.md`): the title in `brand.secondaryDark` bold, underlined, over `report.class.planRow(assigned, started, finished)` at `size.bodySm`. The accessible name is the title and the counts. On paper the block prints as its two text lines |

**First screen at 390 x 844** (frame counted): the headline ends at 670 px and the letter chips at 838 px. The header is two rows on a phone (the back link, then Print with its hint), whatever the class name: "Back to Saturday Heritage School class 3B" measures the same. RP-8's e2e asserts the headline at 390 x 844.

## States (board `mock/class-report-states.html`)

| State | Drawn |
|---|---|
| loading (first load) | header with Print disabled, `h1`, the tab row disabled, a visually hidden `role="status"` line `a11y.report.loading` right before the panel (its sibling, outside the busy panel), the panel `aria-busy="true"` with skeletons; later period changes keep the tabs enabled (as the learner report) |
| empty (no learners) | `report.class.empty` in a neutral block; the back link goes to the roster, where the join code is. No Print |
| every learner on an older app | the class lines explain (`olderApp`); This period shows `report.class.afterUpdate`; revisit letters (and level-check counts in More detail) still render |
| no practice in the window | headline "0 of 12 learners practiced this week."; What went well hidden; Practice together renders; This period says `report.headline.noneYet(when)` |
| Today | `headline` with `when.day`; bands Practiced / Not yet; total time, and the typical time when at least 3 practiced (3 in the example) |
| All time | `headline` with `when.all`; no bands; milestones to date as events with `when.all`; no stepper |
| month, under 3 practiced | the median line is not drawn; the total stays (behaviour 5) |
| unavailable | a family or a school space, or not allowed: `report.state.unavailable` as the page's `h1` (no class name is known) and the back link. No Print |
| network error | `report.state.error` as the `h1`, `common.buttons.tryAgain`; Print disabled |
| class chooser | `report.chooser.class` as the `h1`, one row per class in teacher-home order |
| entries | the roster's "This week" roll-up gains **Class report** (`report.class.link`), a `link-button`; the roster card gains **See report** (`report.action.seeReport`), the same look. Each is one link added to the existing block |

## Hard rules, as drawn

- No learner's name, initials, avatar or id anywhere on the page or its print.
- No list or order of learners; every list is letters, bands, strands or plans.
- No "top", "most", "least", "best", "lowest"; no average per learner, no maximum, no minimum.
- No count of learners per stage or level (OD-4); no percentages (OD-6); no red; nothing about speaking.
- Up-only markers only on the headline, Total time and New quests; never a down marker.
- **Small classes** (README, decisions): only the median is hidden under 3 learners who practiced (section 3.7). Bands, level-check counts and homework counts show in a class of 1 or 2 too; this is accepted for v1 because the page and its print are the teacher's, who can open each learner's own report anyway, and a suppression rule would change RP-2c's output.
