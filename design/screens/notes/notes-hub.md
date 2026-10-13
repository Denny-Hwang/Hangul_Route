# Console / Notes hub (screen spec v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` section 6.13 (entry points 1 and 5) · wireframe `design/wireframes/console/notes-hub.md`
Mock: `mock/hub-states.html` (board) · Shots: `shots/hub-states-375.png`, `-1280.png`
Code (planned): **FB-11b**, `/parent/notes` and `/teach/notes`, the `ADULT_NAV` notes items

## Layout

- **A, one space**: no screen; a client `replace` to `ROUTES.spaceNotes(id, kind)` (family: the Received tab). The hub never stays in history.
- **B, several spaces**: AdultFrame with Notes current; `h1` `console.notes.hub.title`; one `space-row` per space (the teacher home's row look, #420) with the space name and a secondary `hub.open.cta` link with a chevron. API order; archived classes left out; no counts, no unread, no statistics.
- **C, none**: `hub.none.parent` or `hub.none.teacher` with the primary `hub.start.cta` to `/start?persona=`.

## States (board)

| State | Drawn |
|---|---|
| B teacher (three classes), B parent (two families) | yes |
| C parent, C teacher | yes |
| A | the redirect, as a dashed note |
| loading | skeleton rows; no redirect until the spaces are known |
| error | `hub.error`, `hub.retry.cta` |

## Notes for FB-11b

The parent Notes item is already in `ADULT_NAV` (A-5a, `id: 'notes'`, persona parent, behind `notesEnabled`); the teacher frame in these mocks draws the teacher item FB-11b adds (Classes, Notes, Billing). Lessons is left out of the drawn nav (its own flag).
