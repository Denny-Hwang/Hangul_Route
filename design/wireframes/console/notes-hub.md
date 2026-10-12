# Console / Notes hub: the nav entry for notes, per persona (wireframe v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.13 (entry points 1 and 5)
Audience: **parent** (`/parent/notes`) · **teacher** (`/teach/notes`). Caregiver / teacher surface.
Code: none yet. `apps/web/src/app/(console)/parent/notes/page.tsx` and `.../teach/notes/page.tsx` on app.hangulroute.com (FB-11b), registered in F-APP-001's `ADULT_NAV` as `parentNotes` and `teacherNotes`, behind `NEXT_PUBLIC_NOTES_ENABLED`.
Notation: `[[ X ]]` the one primary action, `<...>` live data.

All copy in boxes is placeholder (`console.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a signed-in grown-up taps **Notes** in the adult nav (or the in-app grown-up zone sent them to `/parent/notes`)
When: the hub loads their spaces
Then: with exactly one space of that persona they land on its notes page at once; with several they pick one; with none they learn how to start

## Screen goal

"Get me to the right notes page in one step."

## Box diagram

### A. One space (most families, most single-class teachers)

No screen: a client `replace` to `ROUTES.spaceNotes(id, kind)` (family: `/parent/space/notes?id=` Received tab; class: `/teach/space/notes?id=`). The hub never stays in the browser history.

### B. Several spaces

```
+--------------------------------------------------------------+
| [frame: Teacher · nav (Classes, Notes, ...) · Back to learning]|
| "Notes"                                                      |
|  +--------------------------------------------------------+  |
|  | <class name>                               [ Notes > ] |  |  -> /teach/space/notes?id=<classId>
|  +--------------------------------------------------------+  |
|  | <class name>                               [ Notes > ] |  |
|  +--------------------------------------------------------+  |
+--------------------------------------------------------------+
```

The parent hub lists family spaces the same way (usually one, so A applies).

### C. None

```
| "Notes"                                                      |
| Parent: "Create your family space to send notes." [[ Start ]]|  -> /start?persona=parent
| Teacher: "Create a class to send notes."         [[ Start ]] |  -> /start?persona=teacher
```

- Rows keep the API order; no counts of notes, no "unread", no statistics.
- Archived classes are left out.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Notes (B) | click / Enter | that space's notes page |
| Start (C) | click | `/start` with the persona (F-APP-001) |

## Navigation graph

Enter from: adult nav **Notes** · in-app grown-up zone **Send a note** (web, `openGrownUpArea({ via: 'dashboard', target: '/parent/notes' })`)
Exit to: `console/family-notes` · `console/notes-sent` · `/start`

## States

- **success**: A (redirect) or B.
- **empty**: C.
- **loading**: skeleton rows (no redirect until spaces are known).
- **error**: "Could not load your spaces. Try again." [ Try again ].
- **flag off**: no nav item; the page shows the console's not-found panel.
- **narrow window**: one column; no sideways scroll.

## Data needs

- reads: `GET /api/spaces` (kind, role, archived); a family where the account may oversee, a class where it may send
- writes: none
- telemetry: none (console)

## Open questions

None.
