# Shell/Teacher-home — a teacher's first screen: my classes, each with its report one tap away (wireframe v2)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.8 · amends `console/home.md` (Family group moves to the Family persona)
Audience: **teacher, school admin**
Route: `/teach/home` inside `shell/adult-frame` (A-5a)

## Scenario (Given-When-Then)

Given: a teacher signs in (or switches to Teacher); the account has two classes
When: `/teach/home` opens
Then: only classes and schools are listed, each one row with a count, one way in, and the class report and notes one tap away; one quiet line offers a family space

## Screen goal

"Open one class." (secondary: class report, notes, new class)

## Box diagram

Panel A — classes, reports and notes on

```
+-------------------------------------------+
| [frame: Teacher · Back to learning]       |
| Classes | Lessons | Billing               |
|-------------------------------------------|
|  Classes (heading)          [ + New class ]|
|  +-------------------------------------+  |
|  | Class name     12 students  [ OPEN ]|  |  -> console/roster (/teach/space?id=)
|  | ( Class report )  ( Notes )         |  |  <- each only when its flag is on
|  +-------------------------------------+  |
|  +-------------------------------------+  |
|  | Class name      0 students  [ OPEN ]|  |
|  | ( Class report )  ( Notes )         |  |
|  +-------------------------------------+  |
|                                           |
|  School (heading, only if any)            |
|  | School name     4 classes   [ OPEN ]|  |  -> console/school-admin
|                                           |
|  archived rows dimmed, last               |
|  [ Lessons ]                              |  <- lesson browser (flag)
|                                           |
|  muted: "Learning at home too? Set up a   |  <- no family persona
|  family space"                            |
|  (or "Your family is under Family" + switch)
+-------------------------------------------+
```

Panel B — no class yet (the account holds no teacher persona)

```
|  "You don't have a class yet."  (heading) |
|  [[ SET UP A CLASS ]]                     |  -> /start?persona=teacher
|  [ Go to Family ]                         |  <- only with the family persona
```

- No ranking of classes; order = most recent first (as today).

## Interaction points

- [ OPEN ] (class) → `console/roster` `/teach/space?id=`
- ( Class report ) → `/teach/space/report?id=` (F-REPORT-001) · ( Notes ) → `/teach/space/notes?id=` (F-FEEDBACK-001)
- [ OPEN ] (school) → `console/school-admin` `/teach/space?id=`
- [ + New class ] / [[ SET UP A CLASS ]] → `console/onboarding-role` at `/start?persona=teacher` (teacher card preselected; code step after)
- [ Lessons ] → lesson browser window (F-BROWSE-001)
- [ Go to Family ] / switch → `shell/parent-home`
- "Learning at home too? Set up a family space" → `/start?persona=parent`

## Navigation graph

Enter from: `shell/signin` router · `/teach` router · persona switch · frame "Classes" · `shell/grown-up-lock` after unlock
Exit to:    `console/roster` · class report · notes · `console/school-admin` · `console/onboarding-role` · lesson browser · `shell/parent-home`

## States

- **success**: Panel A.
- **empty**: teacher persona exists only through archived spaces → archived rows + [ + New class ] as the main action.
- **no persona held**: Panel B.
- **error**: spaces fetch failed → error card + [ Try again ] (no misleading empty list), as today.

## Data needs

- reads: `GET /api/spaces` (class and school kinds; the family kind only for the cross-link), the console predicates
- writes: shell store `lastPersona = teacher` (only when held)

## Open questions

- Class-wide statistics live on the class report page (F-REPORT-001), reached from each row; this home stays a list.
