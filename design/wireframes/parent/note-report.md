# Parent / Note report: get a note away and tell us why, or just hide it (wireframe v2)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.10 items 2 and 4, §7.6, §8.3, §8.4
Audience: **grown-up** behind the gate (or an adult self-learner, gate opens directly). Caregiver surface.
Code: none yet. A sheet opened with gate destination `NoteReport` and `PinEntry.noteId` (FB-9; the types land in FB-7), from the learner's note page ("Tell a grown-up", or "Report this note" on a self-managed profile) or from `parent/notes`.
Notation: `[[ X ]]` the one primary action, `( )` a radio choice.

All copy in boxes is placeholder (`caregiver.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a learner tapped "Tell a grown-up" on a note, or a grown-up chose Report in the grown-up zone
When: the gate is passed
Then: the grown-up sees the note and either picks one reason and reports it, or just hides it without a report; the note leaves the learner's app on every device, and a report reaches the Hangul Route team

## Screen goal

"Report this note and make it go away" (primary) or "just make it go away" (secondary, no mark against the sender, spec D8).

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
│                                  │
│ [ Just hide it ]                 │  <- secondary: hide, no report (full-scope device, online)
└──────────────────────────────────┘
```

### B. Done

```
┌──────────────────────────────────┐
│ "Thank you. The note is gone."   │  <- after Report and hide
│ "If someone is in danger, contact│
│  local emergency services."      │  <- shown only after reason Unsafe
│ [[ Done ]]                       │  -> back where the grown-up came from
└──────────────────────────────────┘
```

After **Just hide it** the same sheet shows "The note is hidden." and [[ Done ]] (no team line, no emergency line).

- No free-text field (nothing typed about a child is collected).
- The reporter is never told what happens to the sender, and the sender is never told who reported (a device-reported family note reads "Not shown" to its sender, spec §8.2-c).

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| a reason | tap | selects it |
| Report and hide | tap | `POST /api/sync/learners/:id/notes/:noteId/report { reason, attest }`; local copy removed at once; `notes.report_sent { reason, via }` (no profileId) |
| Just hide it | tap | the confirm of `parent/notes` D, then `POST /api/sync/learners/:id/notes/:noteId/hide`; no report row, counts toward no hold |
| Done | tap | back to `notes/list` (learner path, gate session ends) or `parent/notes` |
| close | tap | back, nothing sent |

## Navigation graph

Enter from: `notes/detail` -> `profiles/pin-entry` (destination `NoteReport`, `noteId`) · `parent/notes` (Report)
Exit to: `notes/list` · `parent/notes`

## States

- **success**: A then B.
- **empty**: the note is no longer on the device (removed by an inbox meanwhile): "This note is already gone." [[ Done ]].
- **error** (report): the call fails: the note stays hidden locally, a calm line "We could not send the report. We will try again when you are online." and the report is queued (one pending report per note) and sent at the next sync.
- **offline**: Report and hide works as in error (hidden locally at once, report queued). **Just hide it** is disabled with "Connect to the internet to do this." (a hide must act on every device).
- **class-scoped device**: Report allowed (spec §7.6: a learner on a class tablet can always get a note away); Just hide it is not shown (full-scope route).
- **rate limit** (10 device reports per learner per day): "Too many reports today. The note is hidden on this device." The note stays hidden locally.

## Data needs

- reads: the note from `notes-store`; device scope; connectivity
- writes: the device report route (queued when offline); the device hide route (online only)
- telemetry: `notes.report_sent { reason, via: 'note_page' | 'grown_up_zone' }`, sent without profileId

## Open questions

None. (Resolved in spec revision 2026-10-11: reports are queued offline with a local hide; hide and the setting need a connection.)
