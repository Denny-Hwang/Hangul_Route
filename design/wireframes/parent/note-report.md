# Parent / Note report: get a note away and tell us why (wireframe v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.10 item 2, §7.6, §8.3, §8.4
Audience: **grown-up** behind the gate (or an adult self-learner, gate opens directly). Caregiver surface.
Code: none yet. A sheet opened with gate destination `NoteReport { noteId }` (FB-9), from the learner's note page ("Tell a grown-up") or from `parent/notes`.
Notation: `[[ X ]]` the one primary action, `( )` a radio choice.

All copy in boxes is placeholder (`caregiver.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a learner tapped "Tell a grown-up" on a note, or a grown-up chose Report in the grown-up zone
When: the gate is passed
Then: the grown-up sees the note, picks one reason and reports it; the note leaves the learner's app on every device and the report reaches the Hangul Route team

## Screen goal

"Report this note and make it go away."

## Box diagram

### A. Report sheet

```
┌──────────────────────────────────┐
│ [× close]                        │
│ "Report this note"               │
│ ┌──────────────────────────────┐ │
│ │ <sender label> · <date>      │ │
│ │ "<preset line>"              │ │
│ │ "<full text>"                │ │
│ └──────────────────────────────┘ │
│ "Why?"                           │
│  ( ) Unkind                      │
│  ( ) Unsafe                      │
│  ( ) Not meant for <learner>     │
│  ( ) Something else              │
│                                  │
│ [[ Report and hide ]]            │  <- enabled once a reason is picked
│ "The note goes away for <learner>│
│  on every device. Our team looks │
│  at every report."               │
└──────────────────────────────────┘
```

### B. Done

```
┌──────────────────────────────────┐
│ "Thank you. The note is gone."   │
│ "If someone is in danger, contact│
│  local emergency services."      │  <- shown only after reason Unsafe
│ [[ Done ]]                       │  -> back where the grown-up came from
└──────────────────────────────────┘
```

- No free-text field (nothing typed about a child is collected).
- The reporter is never told what happens to the sender, and the sender is never told who reported.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| a reason | tap | selects it |
| Report and hide | tap | `POST /api/sync/learners/:id/notes/:noteId/report { reason, attest }`; local copy removed at once; `notes.report_sent { reason, via }` (no profileId) |
| Done | tap | back to `notes/list` (learner path, gate session ends) or `parent/notes` |
| close | tap | back, nothing sent |

## Navigation graph

Enter from: `notes/detail` -> `profiles/pin-entry` (destination `NoteReport`) · `parent/notes` (Report)
Exit to: `notes/list` · `parent/notes`

## States

- **success**: A then B.
- **empty**: the note is no longer on the device (removed by an inbox meanwhile): "This note is already gone." [[ Done ]].
- **error**: the call fails: the note stays hidden locally, a calm line "We could not send the report. We will try again when you are online." and the report is queued (one pending report per note) and sent at the next sync.
- **offline**: same as error: hidden locally at once, report queued.
- **rate limit** (10 device reports per learner per day): "Too many reports today. The note is hidden on this device." The note stays hidden locally.
- **class-scoped device**: allowed (spec §7.6: a learner on a class tablet can always get a note away).

## Data needs

- reads: the note from `notes-store`
- writes: the device report route; a queued report when offline
- telemetry: `notes.report_sent { reason, via: 'note_page' | 'grown_up_zone' }`, sent without profileId

## Open questions

1. Offline report: the spec's rule for safety actions is "online only" for hide and the setting (`parent/notes` offline state), but a report is queued so a worried learner is never stuck. Default: queue reports, require online for hide and the setting.
