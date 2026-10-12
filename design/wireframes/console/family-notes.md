# Console / Family notes: Received and Sent, for one learner at a time (wireframe v2)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.1, §6.13, §7.2 (oversight, hide, report, blocks, prefs, note-senders), §7.7, §8.2-8.5, §9
Audience: **family caregiver** (family space owner or caregiver). Caregiver surface: caregiver banned-word list applies.
Code: none yet. `/parent/space/notes?id=<familySpaceId>` on app.hangulroute.com (F-APP-001 persona prefix): tab **Received** (`&tab=received`, default, FB-12) and tab **Sent** (`&tab=sent`, the list of `console/notes-sent.md` C, FB-11a), behind `NEXT_PUBLIC_NOTES_ENABLED`. Learner chosen with `&learner=<profile:...>` (opaque id), never a name in the URL. Panel D lives on the family settings page `/parent/space/settings?id=` (FB-12).
Notation: `[[ X ]]` the one primary action, `( )` radio, `<...>` live data.

All copy in boxes is placeholder (`console.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a parent whose child is in the family space and in a class
When: they open Notes from the nav, the parent home or the family page
Then: they see one learner at a time; Received lists every note that learner got from the family and from each class, also notes a sender took back, with full text, status and which family account wrote it; they can hide, report or stop any sender and choose what class notes may contain; Sent lists what the family sent; the composer opens on its own when they choose Send a note

## Screen goal

"Stay in charge of the notes my learner receives."

Primary action: **Send a note** (opens the composer sub-view for the family). The safety actions sit on each row.

## Box diagram

### A. Received tab

```
+--------------------------------------------------------------+
| [frame: Parent · nav (Home, Reports, Notes, ...) · Back to learning] |  <- F-APP-001 AdultFrame
| "Notes"                                       [[ Send a note ]]|  -> console/note-composer (sub-view)
|  Learner: [ <display name> v ]                               |  <- hidden when the family has one learner (auto-selected)
|  [ Received ]  [ Sent ]                                      |  <- tab list
|                                                              |
|  +--------------------------------------------------------+  |  <- C: once, after the first class note
|  | "Notes from classes: All notes."   [ Keep ] [ Change ] |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  +--------------------------------------------------------+  |
|  | Today · From class <class name> (teacher)              |  |
|  | "Your reading is getting stronger."                    |  |
|  | "<full text>"                                          |  |
|  | Opened · [heart] Thank you                             |  |
|  |   [ Hide ]  [ Report ]  [ Stop notes from this sender ] |  |
|  +--------------------------------------------------------+  |
|  | Yesterday · From home · signed Grandma                 |  |
|  | Sent by <account name or email>                        |  |  <- adult to adult inside the family (§8.2)
|  | "Thinking of you. Have fun learning today."            |  |
|  | You sent this                                          |  |  <- marker when the viewer is the sender
|  +--------------------------------------------------------+  |
|  | Mon 12 Oct · From class <class name> (teacher)         |  |
|  | "..."                                                  |  |
|  | Taken back by the sender                   [ Report ]  |  |  <- withdrawn: kept with its text (§8.3)
|  +--------------------------------------------------------+  |
|  | Sun 11 Oct · From class <class name> (teacher)         |  |
|  | "See you in class soon."                               |  |
|  | Hidden by <account name>                               |  |  <- or "Hidden on a device"
|  +--------------------------------------------------------+  |
|  | Sat 10 Oct · From class <class name> (teacher)         |  |
|  | "..."                                                  |  |
|  | Reported by <account name> · Our team is looking at it |  |  <- or "Reported on a device"
|  +--------------------------------------------------------+  |
|  [ Show older ]                                             |
|                                                              |
|  > Settings for <display name>                               |  <- collapsed by default (one disclosure)
|     Notes from classes                                       |
|      (•) All notes  ( ) Encouragements only  ( ) Off         |  <- PUT note-prefs
|      "Notes from your family always arrive."                 |
|      "Last changed by <account name>"                        |
|     "Teachers see the answer <display name> picks on their   |  <- disclosure (§7.7)
|      notes. They do not see when a note was read."           |
|     Stopped senders                                          |
|      Your teacher · <class name>          [ Allow again ]    |
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

### C. One-time class-notes card

Shown once per learner, the first time a class note reaches them while the family has not answered it on any device. **Keep** records the acknowledgement; **Change** records it and opens the settings disclosure. It never returns.

### D. Family settings page: who can send notes (`/parent/space/settings?id=`)

```
+--------------------------------------------------------------+
|  Grown-ups in this family                                    |
|  <owner name> (you)          Can send notes: always          |
|  <caregiver name or email>   Can send notes  [ off | on ]    |  <- owner only; default off for code-joined accounts
|  <caregiver name or email>   Can send notes  [ off | on ]    |
|  "Anyone with the family code can join. Only grown-ups you   |
|   turn on here can send notes."                              |
+--------------------------------------------------------------+
```

Other caregivers see the same list read-only.

- Newest first, never sorted by sender or status. One learner at a time, so the page stays short; older notes come with Show older.
- The family's own notes appear once, in Received, with "You sent this" or "Sent by <account>"; the Sent tab is the sender's list (`console/notes-sent.md` C).
- A note a learner reported from a device reads "Not shown" to its own sender (§8.2-c); other caregivers see "Reported on a device".
- No counts, no per-teacher statistics. The teacher's account name or email is never shown; a class note is "From class <class name> (teacher)".
- The family never sees anything about another family's learners.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Learner select | select | reloads with `&learner=<id>` |
| Received / Sent | click / arrows | switches `&tab=` |
| Keep / Change (C) | click | `PUT /api/spaces/:familyId/learners/:learnerId/note-prefs { classes, acknowledge: true }` |
| a notes-mode choice | click | `PUT …/note-prefs`; a quiet "Saved" |
| Hide | click | confirm ("It goes away from <name>'s app at the next sync. The sender sees 'Not shown'.") -> `POST …/notes/:noteId/hide` |
| Report | click | sheet B -> `POST …/notes/:noteId/report { reason }` |
| Stop notes from this sender | click | confirm ("<name> will not get notes from this sender. The sender is not told.") -> `POST …/blocks { noteId }` |
| Allow again | click | `DELETE …/blocks/:senderRef` |
| Send a note | click | `console/note-composer` sub-view (family space, learner preselected) |
| Can send notes (D) | toggle | `PUT /api/spaces/:familyId/note-senders/:accountId { canSend }` (owner only) |

## Navigation graph

Enter from: adult nav **Notes** (`console/notes-hub`, one family: straight here) · parent home learner card **Send a note** (opens the composer over this page) · family roster header **Notes**
Exit to: `console/note-composer` · family settings (D) · back to the parent home

## States

- **success**: A as drawn.
- **empty**: "No notes for <name> yet." The settings disclosure still shows when the learner is in a class.
- **learner in no class**: the class-notes choice, the disclosure line and card C are hidden.
- **no learners in the family**: "Add a learner to your family first." with the existing join-code path.
- **caregiver without the send grant**: Send a note shows "The family owner can let you send notes." instead of opening the composer.
- **loading**: skeleton.
- **error** (load): "Notes could not load. Try again." (action): the change snaps back, "That did not save. Try again."
- **rate limit** (20 family reports a day): "Too many reports today. Write to hello@hangulroute.com if you need help now."
- **flag off**: no Notes entry anywhere; the page shows the console's not-found panel.
- **narrow window**: one column; the tabs stay one row; the row actions wrap under the status; no sideways scroll.

## Data needs

- reads: `GET /api/spaces/:familyId/learners/:learnerId/notes?before=` (all spaces, every status incl. withdrawn, full text, space kind and name, sender account name for family notes, acting account names); `GET …/note-prefs` (incl. `acknowledged`, `updatedBy`); `GET …/blocks`; roster for the learner select; `GET /api/spaces/:familyId/note-senders` (panel D)
- writes: hide, report, blocks, note-prefs, note-senders routes (spec §7.2)
- telemetry: none (console)

## Open questions

1. Should the family be able to restore a hidden note? Default: no (spec D8 keeps hide final and simple); the sender can send a new note.
