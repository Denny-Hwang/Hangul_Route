# Shell/Parent-home — a parent's first screen: my learners at a glance (wireframe v1)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.8 (frame and first content) · reports spec (branch `docs/progress-reports`) owns the reports it links to · replaces the `/parent` demo (`parent/dashboard.md` web part, mock data)
Audience: **parent or caregiver**
Route: `/parent` inside `shell/adult-frame` (A-5b)

## Scenario (Given-When-Then)

Given: a parent signs in (or switches to Parent) and their account has a family space with two learners
When: `/parent` opens
Then: they see each learner as one calm card (when they last learned, minutes this week) with one way in, and the family actions underneath; nothing compares the children

## Screen goal

"Open one learner's progress." (secondary: plan or manage the family)

## Box diagram

Panel A — family with learners (phone)

```
+-----------------------------------+
| [frame: Parent · nav · Back to learning]
|-----------------------------------|
|  Family name (heading)            |
|                                   |
|  +-----------------------------+  |
|  | [avatar]  Display name      |  |  <- name shown on screen only, never in a URL
|  | last active: weekday        |  |
|  | minutes this week: n        |  |  <- a count, no target, no bar that drops
|  |              [[ OPEN ]]     |  |  -> reports child page (id) / family space page until it lands
|  +-----------------------------+  |
|  +-----------------------------+  |
|  | [avatar]  Display name      |  |  <- order = API order (most recent activity), no "best"
|  | ...                [[ OPEN ]] |  |
|  +-----------------------------+  |
|                                   |
|  [ Plan the week ] [ Plan the term ]
|  [ Family settings ] [ Add a learner ]
+-----------------------------------+
```

Panel B — wide: cards in two columns, actions in a side column on the right.

Panel C — family without learners (empty)

```
|  Family name                       |
|  "No learner has joined yet."      |
|  +-----------------------------+   |
|  |  JOIN CODE (large)   [Copy] |   |  <- existing code panel, doubled
|  +-----------------------------+   |
|  1-2 lines: how to join on the     |
|  learner's device (Profile ->      |
|  Classes and family -> Join)       |
|  [[ OPEN THE APP ON THIS DEVICE ]] |  -> learner app /
```

## Interaction points

- [[ OPEN ]] → the reports spec's child page (`?id=<learnerId>`); before it lands → `/parent/space?id=<familyId>` (existing family roster)
- [ Plan the week ] → `/parent/space/plan?id=` (existing plan builder)
- [ Plan the term ] → `/parent/space/curriculum?id=` (existing wizard)
- [ Family settings ] → `/parent/space/settings?id=`
- [ Add a learner ] → scrolls to / shows the join code panel
- [ Copy ] → copies the code, label changes to "Copied"
- [[ OPEN THE APP ON THIS DEVICE ]] → learner app `/` (clears the unlock like Back to learning)

## Navigation graph

Enter from: `shell/signin` router · persona switch · frame "Home" · `shell/grown-up-lock` after unlock · `console/onboarding-role` after creating a family
Exit to:    reports child page · `console/plan-builder` · `console/curriculum-planner` · `console/space-settings` · learner app `/`

## States

- **success**: Panel A / B.
- **empty**: Panel C. Two family spaces: one section each, newest first.
- **error**: one family's roster fails → that section shows one line + [ Try again ]; other sections render. Spaces fetch fails → page-level line + [ Try again ]. Loading → card outlines without numbers.

## Data needs

- reads: `GET /api/spaces` (family spaces where role is owner or caregiver), `GET /api/spaces/:id/roster` per family (consented allow-list: `lastActiveAt`, `minutesLast7d`, avatar, display name)
- writes: IndexedDB `hr:shell:lastPersona = parent`

## Open questions

- Which two numbers sit on the card is the reports spec's call once its child page exists; default: last active + minutes this week (both already on the roster, both "only fill" within a week).
