# Console / Notes sent: what this space sent and how it was answered (wireframe v2)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.13, §7.2 (list, take back, statuses), §7.7, §8.3, §9
Audience: **teacher** (class space) · **family caregiver** (family space: the **Sent** tab of `console/family-notes.md`).
Code: none yet. The class notes page `/teach/space/notes?id=<classId>` and the family page's Sent tab `/parent/space/notes?id=<familyId>&tab=sent` on app.hangulroute.com (FB-11a), behind `NEXT_PUBLIC_NOTES_ENABLED`. URL carries the space id and, when filtered, an opaque learner id; never a name.
Notation: `[[ X ]]` the one primary action, `<...>` live data.

All copy in boxes is placeholder (`console.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a teacher sent notes this week
When: they open Notes for the class
Then: they see each sent note newest first with a neutral status and any answer the learner picked, and can take back a note they regret; nothing ranks or counts learners

## Screen goal

"See what I sent and take one back if I need to."

Primary action of the page: **New note** (opens the composer sub-view).

## Box diagram

### A. Sent list (class page)

```
+--------------------------------------------------------------+
| [frame: Teacher · nav (Classes, Notes, ...) · Back to learning]|  <- F-APP-001 AdultFrame
| [< back to class]   "Notes · <class name>"     [[ New note ]]|  -> console/note-composer (sub-view)
|                                                              |
|  "Teachers see the answer a student picks. They do not see   |  <- disclosure (§7.7), one line
|   when a note was read."                                     |
|  Show: [ Everyone v ]                                        |  <- filter by one learner (opaque id in URL)
|                                                              |
|  +--------------------------------------------------------+  |
|  | Today                                                  |  |
|  | To everyone (18 students)                              |  |  <- a batch to the whole class: one row
|  | "You keep trying. That is how we learn."               |  |
|  | "Great work on ㄱ and ㄴ today"                         |  |
|  | Sent                                     [ Take back ] |  |  <- no per-learner list for a batch
|  +--------------------------------------------------------+  |
|  | Yesterday                                              |  |
|  | To <display name>                                      |  |
|  | "Your reading is getting stronger."                    |  |
|  | Sent · [heart] Thank you                               |  |  <- the answer as icon + label; never "Opened"
|  |                                          [ Take back ] |  |
|  +--------------------------------------------------------+  |
|  | Mon 12 Oct                                             |  |
|  | To <display name>                                      |  |
|  | "See you in class soon."                               |  |
|  | Not shown                                              |  |  <- hidden, reported, notes off, stopped; no reason given
|  +--------------------------------------------------------+  |
|  | Sun 11 Oct                                             |  |
|  | To <display name>                                      |  |
|  | "..."                                                  |  |
|  | Taken back                                             |  |  <- stays in the list; the family still sees it
|  +--------------------------------------------------------+  |
|  [ Show older ]                                             |
+--------------------------------------------------------------+
```

### B. Take back confirm

```
+-----------------------------------------------+
| "Take back this note?"                        |
| "It goes away from <display name / everyone>'s|
|  app at the next sync. The family can still   |
|  see that it was sent."                       |
| [[ Take back ]]          [ Cancel ]           |
+-----------------------------------------------+
```

### C. Family Sent tab (inside `console/family-notes.md`)

Same rows as A, with "To <display name>", "Signed <label>" and "Sent by <account name>" (adult to adult inside the family), and status words that include **Opened** (the family sees its own learner's reading, spec §7.2).

- Sorted by send time only. No filter or sort by status; no counts; no open rate (spec §9).
- A batch row shows one status line: "Sent" or "Taken back" (never "12 of 18 answered"). Filtering by one learner shows that learner's row of the batch with its own status and answer.
- A class sender never sees "Opened" (OD-8). The answer shows only while the learner's notes mode is "All notes"; otherwise the row shows no answer, the same as a note before any answer.
- Rows sent by a co-adult of the same space carry "Sent by another grown-up of this space" and no Take back.
- "Not shown" never says why.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| New note | click | `console/note-composer` sub-view (`&compose=1`) |
| Show filter | select | reloads with `&learner=<id>` |
| Take back | click | sheet B; confirm -> `POST /api/spaces/:id/notes/:noteId/withdraw` (a batch row sends `batch: true`); row status becomes "Taken back" |
| Show older | click | next page (`before=`) |

## Navigation graph

Enter from: adult nav **Notes** (`console/notes-hub`) · `console/roster` header **Notes** · `console/note-composer` **Done** · family page tab **Sent**
Exit to: `console/note-composer` · back to `console/roster`

## States

- **success**: A as drawn.
- **empty**: "No notes sent yet." [[ New note ]].
- **loading**: skeleton rows.
- **error**: "Notes could not load. Try again." [ Try again ].
- **take back of a reported note**: `409 note_reported`: the row stays and reads "Not shown"; the sheet closes with "This note can no longer be changed."
- **anonymized class**: names follow the class setting everywhere on the page.
- **sending switched off** (Worker `NOTES_SEND` unset): the list works; New note opens the composer, which says "Sending notes is not open yet."
- **flag off**: page renders the console's not-found panel; no entry anywhere.
- **narrow window**: one column, Take back under the status; no sideways scroll.

## Data needs

- reads: `GET /api/spaces/:id/notes?before=&learner=` (status `sent` / `withdrawn` / `not_shown`, plus `opened` in a family space; reaction; `mine`; batch info)
- writes: `POST /api/spaces/:id/notes/:noteId/withdraw`
- telemetry: none (console)

## Open questions

1. Should the teacher see answers to a batch per learner? Default: no on the batch row (avoids a who-did-not-answer list); yes on each learner's own filtered view.
