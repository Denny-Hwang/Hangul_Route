# Shell/Parent-home — the family home: each learner one tap from their report, a note and their route (wireframe v2)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.8 (frame, first content and every entry on this page) · the pages it opens belong to F-REPORT-001 (reports), F-FEEDBACK-001 (notes), the Learning Route amendment (route), F-BROWSE-001 (lessons) · replaces the `/parent` demo (`parent/dashboard.md` web part, mock data)
Audience: **parent or caregiver, or an adult who set up a family space for their own learning** (persona "Family")
Route: `/parent` inside `shell/adult-frame` (A-5b)

## Scenario (Given-When-Then)

Given: a parent signs in (or switches to Family) and their account has a family space with two learners
When: `/parent` opens
Then: they see each learner as one calm card with direct ways to that learner's report, a note and their Learning Route, and the family actions underneath; nothing compares or ranks the children

## Screen goal

"Open one learner's report." (secondary: send a note, see the route, browse lessons, plan, manage the family)

## Box diagram

Panel A — family with learners (phone 375), every sibling flag on

```
+-----------------------------------+
| [frame: Family · Back to learning] |
| Home | Reports | Notes | Lessons | Billing
|-----------------------------------|
|  Family name (heading)            |
|  +-----------------------------+  |
|  | [avatar]  Display name      |  |  <- name on screen only, never in a URL
|  | last active: weekday        |  |
|  | Minutes, last 7 days: n     |  |  <- a count, no target, no bar
|  | [[ SEE REPORT ]]            |  |  -> learner report (ids)
|  | ( Send a note ) ( Learning Route ) |  -> notes page · route page
|  +-----------------------------+  |  <- whole first card fits at 375 x 667
|  +-----------------------------+  |
|  | [avatar]  Display name      |  |  <- order = join order (stable), never activity
|  | ...                          |  |
|  +-----------------------------+  |
|                                   |
|  [ Lessons ]                      |  <- opens the lesson browser
|  [ Plan the week ] [ Plan the term ]
|  [ Family settings ] [ Add a learner ]
|                                   |
|  muted: "Also teach a class? Set up a class"
+-----------------------------------+
```

Panel A' — the same card with every sibling flag off (before those pages ship)

```
|  | [avatar]  Display name      |  |
|  | last active · Minutes, last 7 days: n
|  |               [[ OPEN ]]    |  |  -> family roster /parent/space?id=
```

Panel B — wide: cards in two columns, family actions in a side column on the right.

Panel C — family without learners (empty)

```
|  Family name                       |
|  "No learner has joined yet."      |
|  +-----------------------------+   |
|  |  JOIN CODE (large)   [Copy] |   |  <- existing code panel, doubled
|  +-----------------------------+   |
|  1 line: "On the learner's own     |
|  device, open {Join} and enter     |  <- {Join} = the learner app's Join button label
|  this code."                       |
|  [[ OPEN THE APP ON THIS DEVICE ]] |  -> learner app; Join opens with the code filled in
```

Panel D — no family yet (the account holds only the teacher persona, or none of its spaces is a family)

```
|  "You don't have a family space yet."  (heading)
|  [[ SET UP MY FAMILY ]]            |  -> /start?persona=parent
|  [ Go to Classes ]                 |  <- only with the teacher persona
```

## Interaction points

- [[ SEE REPORT ]] (when reports are on) → `/parent/space/learner?id=<familyId>&learner=<learnerId>`; [[ OPEN ]] (reports off) → `/parent/space?id=<familyId>` (family roster)
- ( Send a note ) (notes on) → `/parent/space/notes?id=<familyId>` (learner preselect per F-FEEDBACK-001, ids only)
- ( Learning Route ) (route page on) → `/parent/space/route?id=<familyId>&learner=<learnerId>`
- [ Lessons ] (browse on) → lesson browser in its own window (F-BROWSE-001; full for a paying account, sampler otherwise; no price shown)
- [ Plan the week ] → `/parent/space/plan?id=` · [ Plan the term ] → `/parent/space/curriculum?id=` · [ Family settings ] → `/parent/space/settings?id=`
- [ Add a learner ] → scrolls to / shows the join code panel
- [ Copy ] → copies the code, label changes to "Copied"
- [[ OPEN THE APP ON THIS DEVICE ]] → writes the join hand-off (code only, 30 minutes), clears the unlock and the console session, opens the learner app
- [[ SET UP MY FAMILY ]] → `/start?persona=parent` · [ Go to Classes ] → `shell/teacher-home`
- muted cross-link: "Also teach a class? Set up a class" → `/start?persona=teacher` (no teacher persona) · "Your classes are under Teacher" → switch (teacher persona held)

## Navigation graph

Enter from: `shell/signin` router · persona switch · frame "Home" · `shell/grown-up-lock` after unlock · `console/onboarding-role` after creating a family · `parent/grown-up-home-card` (Profile row, dashboard card)
Exit to:    learner report · notes · Learning Route (adult) · lesson browser · `console/plan-builder` · `console/curriculum-planner` · `console/space-settings` · `console/onboarding-role` · `shell/teacher-home` · learner app `/`

## States

- **success**: Panel A / A' / B.
- **empty**: Panel C. Two family spaces: one section each, in creation order.
- **no persona held**: Panel D.
- **error**: one family's roster fails → that section shows one line + [ Try again ]; other sections render. Spaces fetch fails → page-level line + [ Try again ]. Loading → card outlines without numbers.

## Data needs

- reads: `GET /api/spaces` (family spaces where role is owner or caregiver), `GET /api/spaces/:id/roster` per family (consented allow-list: `joinedAt`, `lastActiveAt`, `minutesLast7d`, avatar, display name), the four console predicates
- writes: shell store `lastPersona = parent` (only when the persona is held); `sessionStorage` `hr:shell:joinCode` from Panel C

## Open questions

- Which figures sit on the card once reports ship is F-REPORT-001's call; default: last active + minutes in the last 7 days (both already on the roster). The card never sorts by them.
