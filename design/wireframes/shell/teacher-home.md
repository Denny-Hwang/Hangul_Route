# Shell/Teacher-home — a teacher's first screen: my classes (wireframe v1)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.8 · amends `console/home.md` (Family group moves to the parent persona)
Audience: **teacher, school admin**
Route: `/teach/home` inside `shell/adult-frame` (A-5a)

## Scenario (Given-When-Then)

Given: a teacher signs in (or switches to Teacher); the account has two classes and also a family
When: `/teach/home` opens
Then: only classes and schools are listed, each one row with a count and one way in; one quiet line says the family is under Parent

## Screen goal

"Open one class." (secondary: make a new class)

## Box diagram

```
+-------------------------------------------+
| [frame: Teacher · nav · Back to learning] |
|-------------------------------------------|
|  Classes (heading)          [ + New class ]|
|  +-------------------------------------+  |
|  | Class name     12 students  [ OPEN ]|  |  -> console/roster (/teach/space?id=)
|  +-------------------------------------+  |
|  +-------------------------------------+  |
|  | Class name      0 students  [ OPEN ]|  |
|  +-------------------------------------+  |
|                                           |
|  School (heading, only if any)            |
|  | School name     4 classes   [ OPEN ]|  |  -> console/school-admin
|                                           |
|  archived rows dimmed, last               |
|                                           |
|  1 muted line: "Your family is under      |  <- only when the account also has a family
|  Parent."  ( Go to Parent )               |
+-------------------------------------------+
```

- No ranking of classes; order = most recent first (as today).

## Interaction points

- [ OPEN ] (class) → `console/roster` `/teach/space?id=`
- [ OPEN ] (school) → `console/school-admin` `/teach/space?id=`
- [ + New class ] → `console/onboarding-role` at `/start?persona=teacher` (teacher card preselected; code step after)
- ( Go to Parent ) → persona switch to `shell/parent-home`

## Navigation graph

Enter from: `shell/signin` router · `/teach` router · persona switch · frame "Classes" · `shell/grown-up-lock` after unlock
Exit to:    `console/roster` · `console/school-admin` · `console/onboarding-role` · `shell/parent-home`

## States

- **success**: as drawn.
- **empty**: teacher persona exists only through archived spaces → archived rows + [ + New class ] as the main action.
- **error**: spaces fetch failed → error card + [ Try again ] (no misleading empty list), as today.

## Data needs

- reads: `GET /api/spaces` (class and school kinds; the family kind only for the cross-link)
- writes: IndexedDB `hr:shell:lastPersona = teacher`

## Open questions

- Class statistics and reports placement on this home belong to the reports spec; default: they open from each class row, not here.
