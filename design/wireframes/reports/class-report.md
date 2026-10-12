# Reports/Class-Report — class statistics for a teacher, aggregates only (wireframe v2)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` §3.1, §3.2, §3.7, §3.8, §3.10, §3.14
Route: app.hangulroute.com only. `/teach/space/report?id=<classId>&period=<day|week|month|all>[&at=<day>]` (`ROUTES.classReport`); without `id`, a chooser of the teacher's classes (one class opens directly)
Audience: **teacher** (class teacher or owner; a school admin over the class reads it the same way). Never a parent: a family space has no class report (no sibling comparison).

## Scenario (Given-When-Then)

Given: a teacher wants to see how the week went for the whole class before planning the next lesson
When: they tap "Class report" in the roster's "This week" block, or **Class reports** in the navigation
Then: without scrolling they read how many learners practiced, what the class got strong on and which letters to revisit together; practice bands and time follow; level-check counts and homework sit behind More detail — counts for the class, no list of students, no order of students, no names

## Screen goal

"Show the class as a whole for a chosen period, to plan what to teach together."

## Box diagram (phone width)

```
+--------------------------------------------------+
| [< back to roster]                  [ Print ]    |  -> console/roster ; print dialog
|                                                  |
|  Class name : class report            (h1)       |
|  N learners - N with an older app (1 line, only  |  <- olderApp / notSaved7d, neutral
|  when > 0) - N not saved in 7 days (only when >0)|
|                                                  |
|  [ Today ][[ This week ]][ This month ][ All time ] |
|  [ < Last week ]                                 |  <- stepper
|                                                  |
|  N of M learners practiced this week.            |  <- class headline; "more than last
|                                                  |     week" only if up
|  WHAT WENT WELL (CLASS)               (h2)       |  <- LAYER 1
|   Letters the class got strong on:               |
|   [ㄱ g : 6] [ㅏ a : 5] [ㄴ n : 4] ...  (max 5)   |  <- letter : number of learners
|   New quests: N - New cards: N                   |
|   Stage 1 finished: N times (events this week)   |
|                                                  |
|  PRACTICE TOGETHER                    (h2)       |
|   Letters to revisit together:                   |
|   [ㅂ b : 4] [ㅅ s : 3] ...  (max 5)              |  -> optional: [ Plan a lesson ]
|                                                  |     (lecture mode on; else hidden)
|- - - - - - - - - - - - - - - - - - - - - - - - - |
|  THIS PERIOD                          (h2)       |  <- LAYER 2
|   days practiced:                                |
|   Not yet  : 3                                   |  <- bands as counts, one per row at
|   1-2 days : 4                                   |     phone width; "Not yet" never
|   3-4 days : 3                                   |     highlighted; text list for
|   5-7 days : 2                                   |     screen readers
|   Total minutes: N                               |
|   Typical time for those who practiced: N min    |  <- median; hidden when < 3 practiced
|                                                  |
|  [ More detail  v ]                              |  <- LAYER 3, collapsed
|   LEVEL CHECK (learners who took one)            |
|   Letters (shapes)                               |  <- stacked list per strand:
|     secure 8                                     |     counts only, no names,
|     getting there 3                              |     no levels
|     next to learn 1                              |
|     not checked 0                                |
|   Sounds of letters ... (same 4 rows)            |
|   Reading syllables / Words / Sentences ...      |
|   HOMEWORK (newest 3 plans)                      |
|   "Plan title"  assigned N - started N - done N  |  -> console/plan-builder (plan)
+--------------------------------------------------+
```

- **All time**: the headline counts learners who ever practiced; bands hidden; milestones list every stage completion count to date; no growth chart per learner.
- **Today**: "N of M practiced today."; no bands; time total only.
- Each learner's window ends at that learner's own last saved day (a device that has not synced counts in `notSaved7d`, never as "did not practice").
- Never on this page: a student's name, avatar, initials or id; any list or order of students; "top", "most", "least", "best", "lowest"; a standing count of learners per stage or level (OD-4); percentages (OD-6); red; speaking.

## Interaction points

- Period tab or stepper -> URL `period` / `at` changes, refetch (one `report.viewed { scope: 'class' }` server event), focus stays, live region announces.
- [ Plan a lesson ] (letters to revisit; only when lecture mode is enabled) -> `console/lecture` with `from=revisit` (F-TCH-004).
- Plan row -> `console/plan-builder` with that plan open.
- [ More detail ] -> expands layer 3; always expanded in print.
- [ Print ] -> print dialog with the print layout (`reports/print.md`, class variant).
- [< back to roster] -> `console/roster` (from the navigation: the teacher home).

## Navigation graph

Enter from: `console/roster` (roll-up block "Class report", class spaces only) · adult navigation **Class reports** (teacher; chooser when more than one class)
Exit to: `console/roster` · `shell/teacher-home` · `console/plan-builder` · `console/lecture` · `reports/print.md`

## States

- **loading**: heading + skeleton blocks.
- **success**: as above.
- **empty** (no learners): "No learners yet." + link back to the roster's join code.
- **all on an older app**: the class line explains; blocks that need day-by-day data show "Appears after learners' apps update"; revisit letters and level-check counts still render (they exist today).
- **no practice in the period**: "No practice yet this week." as the headline; went-well block hidden; other blocks render what exists (revisit letters, level check, homework).
- **unavailable** (family or school space, not allowed, flag off, locale not reviewed): one line + link to the teacher home.
- **error**: "Can't load the report right now." + [ TRY AGAIN ].
- **offline** (app host): the grown-up offline page of F-APP-001.

## Data needs

- reads: `GET /api/spaces/:id/class-report?period=&at=` -> `space`, `period`, `serverTime`, `report` (`ClassReport`: aggregates only, no learner ids or names; computed on the Worker by `classReport()` from projected summaries and the class's plans).
- writes: none. Telemetry: the Worker records `report.viewed { scope: 'class', space: 'class', period }`.

## Open questions

- None blocking. Owner decisions with defaults: no stage distribution, milestones as events instead (OD-4); level-check strand counts shown (OD-5).
- Small classes: the median hides under 3 learners who practiced; counts still show (the teacher already sees each student on the roster).
