# Reports/Learner-Report — one learner's dashboard and reports on the console (wireframe v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` §3.1, §3.2, §3.5, §3.6, §3.10-3.15
Route: `/teach/space/learner?id=<spaceId>&learner=<learnerId>&period=<day|week|month|all>` (`ROUTES.learnerReport`; ids only, never a name)
Audience: **parent** (family space: caregiver or owner) and **teacher** (class space: teacher or owner; a school admin over the class reads it the same way). One component, two variants that differ only in the plan block and the action labels.
Supersedes: `parent/learner-detail.md` for the console (that file stays the reference for the in-app drill-down history; the in-app report is `reports/in-app-report.md`).

## Scenario (Given-When-Then)

Given: a parent (or a teacher before a parent meeting) wants to know how one learner is doing
When: they tap "See report" on that learner's roster card
Then: they see, in under a minute, where the learner is now, what happened in the chosen period (week by default), what went well, and one to three gentle next steps — never a comparison with any other learner, never a percentage, never a red mark

## Screen goal

"Tell a grown-up how one learner is growing, for a period they choose, and offer one next step."

Secondary: print or save the page.

## Box diagram (phone width; wide screens put "At a glance" left and the period report right)

```
+--------------------------------------------------+
| [< back to roster]                  [ Print ]    |  -> console/roster ; print dialog
|                                                  |
|  [avatar chip]  Name : report      (h1)          |  <- rosterName (initials when anonymized)
|  last saved: date  (only when stale, 1 line)     |
|                                                  |
|  AT A GLANCE                         (h2)        |  <- period-independent
|   Now on: Stage N - stage title                  |  <- summary.journey.here
|   Started at: level label (if level check)       |  <- summary.placement.level
|   Letters known well: [ㄱ g][ㄴ n][ㅏ a] ... more  |  <- jamoRecognized (chips w/ romanization)
|   Letters being practiced: [ㅂ b][ㅅ s]           |  <- needsPractice (max 3)
|   Quests: N    Cards: N    Last practice: date   |
|                                                  |
|  [ Today ][[ This week ]][ This month ][ All time ] |  <- tablist; selected = week (default)
|                                                  |
|  HEADLINE (one sentence)                         |  <- e.g. "Name practiced on 3 days this week."
|                                                  |
|  +----------+ +----------+ +----------+          |  <- figures: count + label
|  | days  3  | | min   36 | | quests 2 |          |     "more than last week" under a
|  +----------+ +----------+ +----------+          |     figure ONLY when it grew
|  +----------+ +----------+                       |
|  | cards 1  | | letters 2|                       |
|  +----------+ +----------+                       |
|                                                  |
|  CALENDAR (week: 7 cells, month: 1 per day)      |
|   M   T   W   T   F   S   S                      |
|  [v] [ ] [v] [v] [ ] [ ] [ ]                     |  <- filled + check glyph = practiced;
|  text: "Practiced on Mon, Wed, Thu"              |     outline = neutral, never labelled
|                                                  |
|  WHAT WENT WELL                      (h2)        |
|   o line 1  (e.g. stage finished / new letters)  |  <- up to 3, rule order §3.6
|   o line 2                                       |
|   o line 3                                       |
|                                                  |
|  WHAT TO PRACTICE NEXT               (h2)        |
|   o line 1                [ Add to a plan ]      |  -> console/plan-builder (&add=questId)
|   o line 2 + one fixed tip                       |
|   o line 3                [ Open the plan ]      |  -> console/plan-builder (plan)
|   [action slot: siblings add "Send a note",      |
|    "Preview" later; empty today]                 |
|                                                  |
|  LETTERS THIS PERIOD  [new chips]                |  <- days[].j in window
|  MILESTONES  Stage N finished on date            |  <- only when any in window
|  LEVEL CHECK  date - strand: word status x5      |  <- no counts, no %, no oralStage
|  PLAN                                            |
|   family: family plans + own weekly plan:        |
|           N done, N ready to play                |
|   class:  this class's homework: N done,         |
|           N ready to play                        |
+--------------------------------------------------+
```

**All time** replaces the calendar with a growth block:

```
|  GROWTH (all time)                               |
|   quests ______/‾‾‾‾‾‾/‾‾‾‾  (cumulative, rises)  |  <- never goes down
|   cards  ____/‾‾‾‾‾/‾‾‾‾‾‾                        |
|   [ show as table ]  month | quests | cards       |  <- text alternative
|  MILESTONES  every stage finished, with dates     |
|  Since: first practice date - N practice days    |
```

**Today** shows the figures for today only, no calendar, no comparison; "practice next" keeps only the letters line.

- Variant **parent**: plan block = family plans + self-route counts; actions "Add to a plan" go to the family's plan builder.
- Variant **teacher**: plan block = this class's plans only; same actions on the class plan builder.
- Never on this page: any other learner, any class figure, any average, any rank, the anchor percentage, a down arrow, red, "missed", speaking.

## Interaction points

- Period tab (tap, or arrow keys / Home / End) -> URL `period` changes, data refetches (one `report.viewed` server event), focus stays on the tab, live region says "Showing this month".
- Letter chip -> tooltip / expanded line with romanization and gloss (no audio requirement here).
- [ Add to a plan ] -> `console/plan-builder` with the quest added as a draft item (nothing is published).
- [ Open the plan ] -> `console/plan-builder` with that plan open.
- [ Print ] -> browser print dialog with the print layout (`reports/print.md`).
- [ show as table ] (all time) -> expands the table alternative of the growth line.
- [< back to roster] -> `console/roster` for this space.

## Navigation graph

Enter from: `console/roster` (student card "See report", class and family spaces) · `console/home` (family row "Reports" leads to the family roster, then "See report") · navigation entries the persona app-shell sibling adds to the same route
Exit to: `console/roster` · `console/plan-builder` · `reports/print.md` (print dialog) · `console/home` (unavailable state)

## States

- **loading**: heading + skeleton blocks; tabs disabled.
- **success (ready)**: as above.
- **legacy** (learner's app has no day-by-day data yet): At a glance only, then one line "Day-by-day reports appear after Name's app updates." Tabs hidden.
- **empty** (never practiced): "Name has not practiced yet. Reports appear after the first quest." plus "Next on the route" when known.
- **stale** (last saved more than 7 days ago): everything renders; one neutral line under the name with the date. No warning colour.
- **no practice in the period**: headline "No practice yet this week." then the rhythm line first in "practice next". Figures show 0 without emphasis; the calendar is all outlines.
- **unavailable** (not a member, wrong kind, flag off): one line and a link to console home / roster.
- **error** (network): "Can't load the report right now." + [ TRY AGAIN ]; the last loaded report stays visible if cached.

## Data needs

- reads: `GET /api/spaces/:id/learners/:learnerId/report?period=` -> `space`, `learner` (display name per class setting, avatar, level label, dates), `summary` (roster projection incl. `activity`, `journey`, `placement`, `planProgress`, family: `selfRoute`), `lastSyncedAt`, `serverTime`. Never `payload_json`.
- computed client-side: `learnerReport()` from `packages/content-schema/src/reports/` (pure), catalogue for quest titles; sentences from `packages/i18n` `report.*`.
- writes: none. Telemetry: the Worker records `report.viewed { scope: 'learner', space, period }` (no ids).

## Open questions

- None blocking. Owner decisions with defaults: week = rolling 7 days (OD-1), month = calendar month to date (OD-2), no percentages (OD-6), print only (OD-7), skills not on the console (OD-8).
- Whether the parent home should list every child with a direct "See report" link once the persona app shell designs it: owned by that sibling (OD-16).
