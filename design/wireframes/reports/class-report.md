# Reports/Class-Report — class statistics for a teacher, aggregates only (wireframe v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` §3.1, §3.2, §3.7, §3.8, §3.10, §3.14
Route: `/teach/space/report?id=<classId>&period=<day|week|month|all>` (`ROUTES.classReport`)
Audience: **teacher** (class teacher or owner; a school admin over the class reads it the same way). Never a parent: a family space has no class report (no sibling comparison).

## Scenario (Given-When-Then)

Given: a teacher wants to see how the week went for the whole class before planning the next lesson
When: they tap "Class report" in the roster's "This week" block
Then: they see how many learners practiced, total time, what the class learned, which letters to revisit together, level-check strand counts and homework progress — as counts for the class, with no list of students, no order of students and no names

## Screen goal

"Show the class as a whole for a chosen period, to plan what to teach together."

## Box diagram

```
+--------------------------------------------------+
| [< back to roster]                  [ Print ]    |  -> console/roster ; print dialog
|                                                  |
|  Class name : class report            (h1)       |
|  N learners - N with an older app (1 line, only  |  <- olderApp / notSaved7d, neutral
|  when > 0) - N not saved in 7 days (only when >0)|
|                                                  |
|  [ Today ][[ This week ]][ This month ][ All time ] |
|                                                  |
|  PRACTICE                             (h2)       |
|   N of M learners practiced this week            |  <- "more than last week" only if up
|   days practiced:                                |
|   [ Not yet : 3 ] [ 1-2 : 4 ] [ 3-4 : 3 ] [ 5-7 : 2 ] |  <- bands as counts (bars or
|   (text list for screen readers)                 |     boxes), "Not yet" never highlighted
|                                                  |
|  TIME                                            |
|   Total minutes: N                               |
|   Typical time for those who practiced: N min    |  <- median; hidden when < 3 practiced
|                                                  |
|  LEARNING                                        |
|   New quests: N    New cards: N                  |
|   Letters the class got strong on:               |
|   [ㄱ g : 6] [ㅏ a : 5] [ㄴ n : 4] ...  (max 5)   |  <- letter : number of learners
|                                                  |
|  LETTERS TO REVISIT TOGETHER                     |
|   [ㅂ b : 4] [ㅅ s : 3] ...  (max 5)              |  -> optional: [ Plan a lesson ]
|                                                  |     -> console/lecture (from=revisit) when
|                                                  |     lecture mode is on; else hidden
|  LEVEL CHECK (learners who took one)             |
|   Letter shapes        secure 8 | getting there 3 | next 1 | not checked 0 |
|   Sound and letter     ...                       |
|   Reading syllables    ...                       |  <- counts only, no names, no levels
|   Words / Sentences    ...                       |
|                                                  |
|  HOMEWORK (newest 3 plans)                       |
|   "Plan title"  assigned N - started N - done N  |  -> console/plan-builder (plan)
|   "Plan title"  ...                              |
|                                                  |
|  STAGE MILESTONES THIS WEEK                      |
|   Stage 1 finished: N times                      |  <- events in the window only
+--------------------------------------------------+
```

- **All time**: practice block shows learners who ever practiced and total practice days; bands hidden; milestones list every stage completion count to date; no growth chart per learner.
- **Today**: "N of M practiced today"; no bands; time total only.
- Never on this page: a student's name, avatar, initials or id; any list or order of students; "top", "most", "least", "best", "lowest"; a standing count of learners per stage or level (OD-4); percentages (OD-6); red; speaking.

## Interaction points

- Period tab -> URL `period` changes, refetch (one `report.viewed { scope: 'class' }` server event), focus stays, live region announces.
- [ Plan a lesson ] (letters to revisit; only when lecture mode is enabled) -> `console/lecture` with `from=revisit` (F-TCH-004).
- Plan row -> `console/plan-builder` with that plan open.
- [ Print ] -> print dialog with the print layout (`reports/print.md`, class variant).
- [< back to roster] -> `console/roster`.

## Navigation graph

Enter from: `console/roster` (roll-up block "Class report", class spaces only) · navigation entries the persona app-shell sibling adds to the same route
Exit to: `console/roster` · `console/plan-builder` · `classroom/lecture-presenter` setup (`console/lecture`) · `reports/print.md`

## States

- **loading**: heading + skeleton blocks.
- **success**: as above.
- **empty** (no learners): "No learners yet." + link back to the roster's join code.
- **all on an older app**: the class line explains; blocks that need day-by-day data show "Appears after learners' apps update"; revisit letters and level-check counts still render (they exist today).
- **no practice in the period**: "No practice yet this week." in the practice block; other blocks render what exists (revisit letters, level check, homework).
- **unavailable** (family or school space, not allowed, flag off): one line + link to console home.
- **error**: "Can't load the report right now." + [ TRY AGAIN ].

## Data needs

- reads: `GET /api/spaces/:id/class-report?period=` -> `space`, `period`, `serverTime`, `report` (`ClassReport`: aggregates only, no learner ids or names; computed on the Worker by `classReport()` from projected summaries and the class's plans).
- writes: none. Telemetry: the Worker records `report.viewed { scope: 'class', space: 'class', period }`.

## Open questions

- None blocking. Owner decisions with defaults: no stage distribution, milestones as events instead (OD-4); level-check strand counts shown (OD-5).
- Small classes: the median hides under 3 learners who practiced; counts still show (the teacher already sees each student on the roster).
