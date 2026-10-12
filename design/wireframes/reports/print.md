# Reports/Print — the printed or saved-as-PDF report (wireframe v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` §3.1, §3.10, §3.12 (print), OD-7
Surface: the learner report or the class report rendered with the console's `@media print` rules (no separate route)
Audience: **parent** and **teacher** (whoever printed it). The paper copy is private; it shows exactly what the screen shows.

## Scenario (Given-When-Then)

Given: a teacher preparing a parent meeting (or a parent keeping a record) has a report open for a period
When: they press "Print or save as PDF"
Then: the browser print dialog shows a clean one- or two-page document with the same blocks as the screen, the period and dates, and a private footer — no navigation, no buttons, nothing more than the screen showed

## Screen goal

"Produce a readable paper or PDF copy of the report on screen."

## Box diagram (A4 / Letter portrait; learner variant)

```
+--------------------------------------------------+
|  Hangul Route - Name : report                    |  <- display name as on screen (initials
|  This week: date - date   (printed: date)        |     when the class anonymizes)
|--------------------------------------------------|
|  AT A GLANCE                                     |
|   Now on ... / Started at ... / Letters ... /    |
|   Quests N - Cards N - Last practice date        |
|                                                  |
|  HEADLINE                                        |
|  Practice days 3 | Minutes 36 | New quests 2 |   |
|  New cards 1 | New letters 2                     |
|  Practiced on: Mon, Wed, Thu (text, not dots)    |
|                                                  |
|  WHAT WENT WELL      o o o                       |
|  WHAT TO PRACTICE NEXT  o o o  (no buttons)      |
|  LETTERS / MILESTONES / LEVEL CHECK / PLAN       |
|--------------------------------------------------|
|  Private: shared from Hangul Route on date.      |  <- footer on every page
+--------------------------------------------------+
```

Class variant: same frame with the class blocks of `reports/class-report.md` (practice bands as a small text table, time, learning, letters to revisit, level-check counts, homework rows, milestones). Still no student names.

- Hidden in print: console navigation, tabs, action buttons, the action slot, tooltips, "show as table" toggles (the table itself prints instead of the growth line when the line cannot print clearly).
- Each block avoids page breaks inside it; colour carries no meaning; text uses the token text colour on the paper surface token.

## Interaction points

- "Print or save as PDF" (on the page) -> `window.print()`; the browser dialog handles printer or PDF.
- No interaction on paper; links print as plain text without URLs.

## Navigation graph

Enter from: `reports/learner-report.md` · `reports/class-report.md` (print button)
Exit to: back to the same page when the dialog closes

## States

- **success**: as above.
- **legacy / empty / no practice**: the same state text as the screen, printed as-is (one short page).
- **error**: the print button is disabled while the report is loading or failed; nothing prints an error page.

## Data needs

- reads: nothing new; prints the already loaded report.
- writes: none. Nothing is generated or stored on a server; no share link, no email, no CSV (OD-7). No telemetry (the console has no client; the page view was already recorded by the Worker).

## Open questions

- None blocking. If the owner later wants a CSV for teachers (OD-7), it gets its own wireframe and a consent review first.
