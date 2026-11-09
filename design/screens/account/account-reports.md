# Account reports (screen spec, NS-0b)

Spec: F-AUTH-004 sections 8.1, 8.7, 9.2; F-REPORT-001 sections 3.5, 3.6, 3.8, 3.9 · wireframe `design/wireframes/account/native-homes.md` (Panel E) · mock `mock/reports.html` (boards 1 to 3), es and ko on `mock/lengths.html` rows 31, 32 · shots `shots/reports-320.png`, `-1280.png`, `-320-text200.png` · base screens `design/screens/reports/in-app-report.md`, `class-report.md` · rows NS-5 (learner), NS-6 (class)

## AccountLearnerReport (board 1)

The in-app report's blocks (NS-5 splits `LearnerReportScreen.tsx` into a data-agnostic `report-blocks.tsx`) over `learnerReport()` of the route's answer (`GET /api/spaces/:id/learners/:learnerId/report?period=`), which is the consented roster projection the console reads, not the device's snapshot.

Drawn as in-app: the stack header (Back, `report.title.learner(name)`, Display); `report.glance.lastPractice(date)`; the `SectionTabs` periods (`report.period.day` / `week` / `month` / `all`, every tab a stop); the stepper (`report.step.*`, the range); the headline; **What went well** and **What to practice next** as plain lines; **This period** figures (days, minutes, new quests, new heritage cards) and the calendar; **More detail** (letters, totals, milestones, level check, plan rows as plain text).

Left out on native (struck-through on the board, D14):

| Block | Why |
|---|---|
| "Now on" and **Open Learning Route** | Learning Route pages are not in v1 (ND-2); no control may lead out of the account screens |
| Line actions (Add to a plan, Preview) and **Preview lessons** | plans and Lessons are not in v1 (ND-2) |
| The free-end line `report.insight.free_days_done` ("{name} finished the free lessons.") | on a build where nothing can be bought, a line saying the free part is over reads as pointing elsewhere to buy (3.1.1); the P4 slot shows nothing for `{ end: true }` on native |
| Skills rows | device-only data (F-REPORT-001 OD-8) |
| Dashed "not saved yet" calendar cells | the server's projection has no such days |

## AccountClassReport (board 2)

The console class report's blocks over `reports/class-report.ts` (`GET /api/spaces/:id/class-report?period=`): `report.title.class(name)`, the periods and stepper, the class headline (`report.class.headline`), the letters the class got strong on, Practice together, the bands, time, level-check counts and homework counts. Left out: Send a note, Print, **Plan a lesson**, the homework plan link (its counts stay as text). No learner ranked, ordered by activity or compared (F-REPORT-001).

## States (board 3)

Loading: the shipped report skeleton. Error online: `report.state.error` with **Try again**. Offline: `caregiver.account.home.offline` with **Try again** (as the homes). `401`, `403 native_off`: as the homes (`homes.md`). The report's own empty, no-data, stale and archived lines are unchanged.

## Words

Heritage cards appear here as learning facts (`report.figure.cards`, `report.detail.totals`, `report.insight.cards_new`, `report.class.cardsNew`) in all three languages, so spec 9.2's card words are payment-card phrases, not the bare word (D15).
