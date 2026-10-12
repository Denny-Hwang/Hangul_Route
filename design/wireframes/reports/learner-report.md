# Reports/Learner-Report — one learner's dashboard and reports on the console (wireframe v2)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` §3.1, §3.2, §3.5, §3.6, §3.10-3.15
Route: app.hangulroute.com only (F-APP-001 §3.2). `ROUTES.learnerReport` = family: `/parent/learner?id=<familyId>&learner=<learnerId>&period=<day|week|month|all>[&at=<day>][&from=home|roster|nav]`; class: `/teach/space/learner?id=<classId>&learner=<learnerId>&...` (one component at both paths; ids only, never a name)
Audience: **parent** (family space: caregiver or owner) and **teacher** (class space: teacher or owner; a school admin over the class reads it the same way). One component, two variants that differ only in the plan block, the plan words and the action labels.
Supersedes: `parent/learner-detail.md` and the web part of `parent/dashboard.md` (with F-APP-001 `shell/parent-home.md`). The in-app report is `reports/in-app-report.md`.

## Scenario (Given-When-Then)

Given: a parent (or a teacher before a parent meeting) wants to know how one learner is doing
When: the parent taps **Open** on the child's card on the parent home (or **Reports** in the navigation); the teacher taps **See report** on the roster card
Then: without scrolling, they read one sentence about the chosen period (week by default), what went well and one to three gentle next steps; figures and a calendar follow; everything else waits behind **More detail** — never a comparison with any other learner, never a percentage, never a red mark

## Screen goal

"Tell a grown-up, at a glance, how one learner is growing in a period they choose, and offer one next step."

Secondary: look back a day, week or month; open the Learning Route; send a note; print.

## Box diagram (phone width, 390 x 844; wide screens keep layer 1 left and layer 2 right, layer 3 full width)

```
+--------------------------------------------------+
| [< back]                [ Send a note ] [ Print ]|  -> parent home / roster (from=) ;
|                                                  |     notes composer (learner preselected) ;
|  [avatar chip]  Name : report      (h1)          |     print dialog. Send a note only when
|  Now on Stage N: title  - Open Learning Route    |     the notes flag is on and the viewer may
|  Last practice: date                             |     send (never a school admin)
|  (stale only) Last saved date. Open Hangul Route |  <- action line, neutral, no warning colour
|   on Name's device while online to update.       |
|                                                  |
|  [ Today ][[ This week ]][ This month ][ All time ] |  <- tablist; selected = week (default)
|  [ < Last week ]                                 |  <- stepper; Next hidden on the current window
|                                                  |
|  HEADLINE (one sentence)                         |  <- e.g. "Name practiced on 3 days this week."
|  (partial only) Figures up to date.              |
|                                                  |
|  WHAT WENT WELL                      (h2)        |  <- LAYER 1 ends with these two blocks
|   o line 1  (e.g. stage finished / new letters)  |     up to 3, rule order §3.6; W0 when
|   o line 2   letter chips are links to Browse    |     nothing else fired; hidden when empty
|                                                  |
|  WHAT TO PRACTICE NEXT               (h2)        |
|   o line 1                [ Add to a plan ]      |  -> plan builder (&add=questId), draft only
|   o line 2 + one fixed tip (link to Browse)      |
|   o Next in the plan: quest title                |  <- the app's own next (F-ENT-003)
|                                                  |
|- - - - - - - - - - - - - - - - - - - - - - - - - |  (fold at 844)
|  THIS PERIOD                         (h2)        |  <- LAYER 2
|  +----------+ +----------+ +----------+          |  <- figures: count + label
|  | days  3  | | min   36 | | quests 2 |          |     "more than last week" under a
|  +----------+ +----------+ +----------+          |     figure ONLY when it grew
|  +----------+ +----------+                       |
|  | cards 1  | | letters 2|                       |
|  +----------+ +----------+                       |
|   M   T   W   T   F   S   S                      |
|  [v] [ ] [v] [v] [ ] [:] [:]                     |  <- filled + check = practiced; outline =
|  text: "Practiced on Mon, Wed, Thu.              |     neutral; dashed [:] = not saved yet
|         Not saved yet: Sat, Sun."                |     (after asOf); never labelled "missed"
|                                                  |
|  [ More detail  v ]                              |  <- LAYER 3: disclosure, collapsed
|   Letters Name knows well: [ㄱ g][ㄴ n] ... more |     chips with romanization (Browse links)
|   Letters being practiced: [ㅂ b][ㅅ s]          |
|   New letters this period: [ㅏ a][ㅓ eo]         |
|   Since the start: N quests, N cards             |
|   Starting spot: Stage 1 - band words - date     |
|   Milestones: Stage N finished on date           |
|   Level check: date - strand: word status x5     |  <- no counts, no %, no oralStage
|   Plan: family: this week's plan + own plan:     |
|         N done, N ready to play                  |
|         class: this class's homework: N done,    |
|         N ready to play                          |
+--------------------------------------------------+
```

**All time** replaces the calendar with a growth block in layer 2 (no stepper):

```
|  THIS PERIOD (all time)                          |
|   quests ______/‾‾‾‾‾‾/‾‾‾‾  (cumulative, rises)  |  <- never goes down
|   cards  ____/‾‾‾‾‾/‾‾‾‾‾‾                        |
|   [ show as table ]  month | quests | cards       |  <- text alternative
|   Since: first practice date - N practice days   |
```

**Today** shows today's figures only, no calendar, no comparison; "practice next" keeps only the letters line. **A month older than 35 days** (stepper) shows totals only: figures, no calendar, no letters.

- Variant **parent**: plan words "plan" ("Everything in this week's plan is done."); plan block = family plans + own plan; actions go to the family's plan builder. Back link to the parent home.
- Variant **teacher**: plan words "homework"; plan block = this class's plans only; same actions on the class plan builder. Back link to the roster.
- Never on this page: any other learner, any class figure, any average, any rank, the anchor percentage, a down arrow, red, "missed", a price, a lock, speaking.

## Interaction points

- Period tab (tap, or arrow keys / Home / End) -> URL `period` changes, data refetches (one `report.viewed` server event), focus stays on the tab, live region says "Showing this month".
- [ < Last week ] / [ Next > ] -> URL `at` changes, refetch (one event); limited to the saved 35 days and 24 months.
- Open Learning Route -> the adult Learning Route page of the same learner (Learning Route amendment LR-8).
- Letter chip, quest title, strand tip -> the lesson browser (`openBrowse`, source `report`, content id only); before Browse ships, a chip expands to romanization and gloss.
- [ Add to a plan ] -> plan builder with the quest added as a draft item (nothing is published).
- [ Open the plan ] -> plan builder with that plan open.
- [ Send a note ] -> F-FEEDBACK-001 composer with this learner preselected.
- [ More detail ] -> expands layer 3 (`aria-expanded`); always expanded in print.
- [ Print ] -> browser print dialog with the print layout (`reports/print.md`).
- [ show as table ] (all time) -> expands the table alternative of the growth line.
- [< back] -> where the grown-up came from (`from`: parent home, roster; else the persona home).

## Navigation graph

Enter from: `shell/parent-home` (learner card **Open**, `from=home`) · adult navigation **Reports** (parent; a chooser when the account has more than one learner) · `console/roster` (student card **See report**, class and family spaces, `from=roster`)
Exit to: `shell/parent-home` · `console/roster` · `console/plan-builder` · `console/learning-route` · `console/note-composer` · browse (new tab) · `reports/print.md` (print dialog)

## States

- **loading**: heading + skeleton blocks; tabs disabled.
- **success (ready)**: as above.
- **no_data** (the device never saved progress to this space): no glance lines; "No saved progress from Name's device yet." + "Open Hangul Route on that device while online." Tabs hidden.
- **empty** (summary exists, never practiced): "Name has not started yet. The report fills in after the first practice." plus the next line when the app has one.
- **legacy** (no day-by-day data): glance lines, then "Day-by-day figures are not available yet." + "Open Hangul Route on Name's device while online to update."; More detail renders (letters, totals, starting spot, level check, plan). Tabs hidden.
- **stale** (last saved more than 7 days ago, by sync or by the device's last day): everything renders; the neutral line and action line under the name. No warning colour.
- **partial window** (window reaches past the device's last saved day): "Figures up to date." under the headline; those days dashed; no rhythm line.
- **no practice in the period**: headline "No practice yet this week."; "What went well" is not rendered; the rhythm line first in "practice next". Figures show 0 without emphasis; the calendar is all outlines.
- **unavailable** (not a member, wrong kind, flag off, locale not reviewed): one line and the back link.
- **error** (network): "Can't load the report right now." + [ TRY AGAIN ]; the last loaded report stays visible if cached.
- **offline** (app host): the grown-up offline page of F-APP-001.

## Data needs

- reads: `GET /api/spaces/:id/learners/:learnerId/report?period=` -> `space`, `learner` (display name per class setting, avatar, dates), `summary` (roster projection incl. `activity`, `journey`, `placement`, `planProgress`, family: `selfRoute`; or null), `lastSyncedAt`, `serverTime`. Never `payload_json`.
- computed client-side: `learnerReport()` from `packages/content-schema/src/reports/` (pure), catalogue for quest titles; sentences from `packages/i18n` `report.*`.
- writes: none. Telemetry: the Worker records `report.viewed { scope: 'learner', space, period }` (no ids).
- `document.title`: "Report - Hangul Route" (no name).

## Open questions

- None blocking. Owner decisions with defaults: week = rolling 7 days (OD-1), month = calendar month to date (OD-2), no percentages (OD-6), print only (OD-7), skills not on the console (OD-8), entries (OD-16), looking back (OD-18).
