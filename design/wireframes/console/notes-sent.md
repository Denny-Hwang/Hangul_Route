# Console / Notes sent: what this space sent and whether it arrived (wireframe v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §7.2 (list, withdraw, statuses), §7.7, §9
Audience: **teacher** (class space) · **family caregiver** (family space; the family page adds `console/family-notes.md`).
Code: none yet. The list part of `/teach/space/notes?id=<spaceId>` (FB-11), behind `NEXT_PUBLIC_NOTES_ENABLED`. URL carries the space id and, when filtered, an opaque learner id; never a name.
Notation: `[[ X ]]` the one primary action, `<...>` live data.

All copy in boxes is placeholder (`console.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a teacher sent notes this week
When: they open Notes for the class
Then: they see each sent note newest first with a neutral status and any thank-you the learner picked, and can take back a note they regret; nothing ranks or counts learners

## Screen goal

"See what I sent and take one back if I need to."

Primary action of the page: **New note** (opens the composer).

## Box diagram

### A. Sent list

```
+--------------------------------------------------------------+
| [< back to class]   "Notes · <class name>"     [[ New note ]]|  -> console/note-composer
|                                                              |
|  Show: [ Everyone v ]                                        |  <- filter by one learner (opaque id in URL)
|                                                              |
|  +--------------------------------------------------------+  |
|  | Today                                                  |  |
|  | To everyone (18 students)                              |  |  <- a batch to the whole class: one row
|  | "You keep trying. That is how we learn."               |  |
|  | "Great work on ㄱ and ㄴ today"                         |  |
|  | Sent                                     [ Take back ] |  |  <- no per-learner open list for a batch
|  +--------------------------------------------------------+  |
|  | Yesterday                                              |  |
|  | To <display name>                                      |  |
|  | "Your reading is getting stronger."                    |  |
|  | Opened · [heart] Thank you                             |  |  <- reaction as icon + label
|  |                                          [ Take back ] |  |
|  +--------------------------------------------------------+  |
|  | Mon 12 Oct                                             |  |
|  | To <display name>                                      |  |
|  | "See you in class soon."                               |  |
|  | Not shown                                              |  |  <- hidden, reported or notes off; no reason given
|  +--------------------------------------------------------+  |
|  [ Show older ]                                             |
+--------------------------------------------------------------+
```

- Sorted by send time only. No filter or sort by status; no counts of "opened"; no open rate (spec §9).
- A batch row shows one status line: "Sent" (never "12 of 18 opened"). Filtering by one learner shows that learner's row of the batch with its own status.
- Rows sent by a co-adult of the same space carry "Sent by another grown-up of this space" and no Take back.
- "Not shown" never says why.

### B. Take back confirm

```
+-----------------------------------------------+
| "Take back this note?"                        |
| "It goes away from <display name / everyone>'s|
|  app at the next sync."                       |
| [[ Take back ]]          [ Cancel ]           |
+-----------------------------------------------+
```

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| New note | click | `console/note-composer` |
| Show filter | select | reloads with `&learner=<id>` |
| Take back | click | sheet B; confirm -> `POST /api/spaces/:id/notes/:noteId/withdraw` (a batch row withdraws each note of the batch); row removed |
| Show older | click | next page (`before=`) |

## Navigation graph

Enter from: `console/roster` action row **Notes** · `console/note-composer` result **See sent notes** · family space page **Notes**
Exit to: `console/note-composer` · back to `console/roster`

## States

- **success**: A as drawn.
- **empty**: "No notes sent yet." [[ New note ]].
- **loading**: skeleton rows.
- **error**: "Notes could not load. Try again." [ Try again ].
- **take back of a reported note**: `409 note_reported`: the row stays and reads "Not shown"; the sheet closes with "This note can no longer be changed."
- **anonymized class**: names follow the class setting everywhere on the page.
- **flag off**: page renders the console's not-found panel; the roster has no Notes action.
- **narrow window**: one column, Take back under the status; no sideways scroll.

## Data needs

- reads: `GET /api/spaces/:id/notes?before=&learner=` (status `sent` / `opened` / `not_shown`, reaction, `mine`, batch info)
- writes: `POST /api/spaces/:id/notes/:noteId/withdraw`
- telemetry: none (console)

## Open questions

1. Should the teacher see reactions to a batch per learner? Default: no on the batch row (avoids a who-did-not-answer list); yes on each learner's own filtered view.
