# Console / Family notes: every note to my learner, from home and from classes (wireframe v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.1 item 4, §7.2 (oversight, hide, report, prefs), §8.2-8.4, §9
Audience: **family caregiver** (family space owner or caregiver). Caregiver surface: caregiver banned-word list applies.
Code: none yet. The family view of `/teach/space/notes?id=<familySpaceId>` (FB-12), above the sent list, behind `NEXT_PUBLIC_NOTES_ENABLED`. Learner chosen with `&learner=<profile:...>` (opaque id), never a name in the URL.
Notation: `[[ X ]]` the one primary action, `( )` radio, `<...>` live data.

All copy in boxes is placeholder (`console.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a parent whose child is in the family space and in a class
When: they open Notes in the family space
Then: they see, per learner, every note that learner received from the family and from each class, with its full text and status; they can hide or report any note and choose what class notes may contain

## Screen goal

"Stay in charge of the notes my learner receives."

Primary action: **Send a note** (opens the composer for the family). The safety actions sit on each row.

## Box diagram

### A. Family notes view

```
+--------------------------------------------------------------+
| [< back to family]  "Notes"                  [[ Send a note ]]|  -> console/note-composer (family)
|                                                              |
|  Learner: [ <display name> v ]                               |  <- one learner at a time
|                                                              |
|  Notes from classes for <display name>                       |
|   (•) All notes  ( ) Encouragements only  ( ) Off            |  <- PUT note-prefs
|   "Notes from your family always arrive."                    |
|                                                              |
|  Every note to <display name>                                |
|  +--------------------------------------------------------+  |
|  | Today · From class <class name> (teacher)              |  |
|  | "Your reading is getting stronger."                    |  |
|  | "<full text>"                                          |  |
|  | Opened · [heart] Thank you                             |  |
|  |                         [ Hide ]  [ Report ]           |  |
|  +--------------------------------------------------------+  |
|  | Yesterday · From home (signed Grandma)                 |  |
|  | "Thinking of you. Have fun learning today."            |  |
|  | Sent                                                   |  |
|  |                         [ Hide ]  [ Report ]           |  |  <- family notes can be reported too
|  +--------------------------------------------------------+  |
|  | Mon 12 Oct · From class <class name> (teacher)         |  |
|  | "See you in class soon."                               |  |
|  | Hidden by your family                                  |  |  <- status visible to the family only
|  +--------------------------------------------------------+  |
|  | Sun 11 Oct · From class <class name> (teacher)         |  |
|  | "..."                                                  |  |
|  | Reported · Our team is looking at it                   |  |
|  +--------------------------------------------------------+  |
|  [ Show older ]                                             |
|                                                              |
|  Sent from home  (the sent list, console/notes-sent A)       |
+--------------------------------------------------------------+
```

### B. Report sheet (same reasons as the app)

```
+-----------------------------------------------+
| "Report this note"                            |
| <note preview>                                |
| ( ) Unkind ( ) Unsafe ( ) Not meant for <name>|
| ( ) Something else                            |
| [[ Report and hide ]]        [ Cancel ]       |
| "Our team looks at every report."             |
+-----------------------------------------------+
```

- Newest first, never sorted by sender or status.
- No counts, no per-teacher statistics.
- The family never sees who in another family wrote anything; it sees only notes to its own learners.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Learner select | select | reloads with `&learner=<id>` |
| a notes-mode choice | click | `PUT /api/spaces/:familyId/learners/:learnerId/note-prefs`; a quiet "Saved" |
| Hide | click | confirm sheet ("It goes away from <name>'s app at the next sync. The sender sees 'Not shown'.") -> `POST .../notes/:noteId/hide` |
| Report | click | sheet B -> `POST .../notes/:noteId/report { reason }` |
| Send a note | click | `console/note-composer` (family space) |

## Navigation graph

Enter from: family space page (`console/roster` for a family) action **Notes** · `console/home` family row -> family page
Exit to: `console/note-composer` · back to the family page

## States

- **success**: A as drawn.
- **empty**: "No notes for <name> yet." The notes-mode choice still shows when the learner is in a class.
- **learner in no class**: the "Notes from classes" choice is hidden.
- **no learners in the family**: "Add a learner to your family first." with the existing join-code path.
- **loading**: skeleton.
- **error** (load): "Notes could not load. Try again." (action): the change snaps back, "That did not save. Try again."
- **rate limit** (20 family reports a day): "Too many reports today. Write to hello@hangulroute.com if you need help now."
- **flag off**: no Notes action, page shows the console's not-found panel.
- **narrow window**: one column; the radio group stacks; no sideways scroll.

## Data needs

- reads: `GET /api/spaces/:familyId/learners/:learnerId/notes?before=` (all spaces, status live / hidden / reported, full text, space kind and name); `GET .../note-prefs`; roster for the learner select
- writes: hide, report, note-prefs routes (spec §7.2)
- telemetry: none (console)

## Open questions

1. Should the family be able to restore a hidden note? Default: no (spec D8 keeps hide final and simple); the sender can send a new note.
