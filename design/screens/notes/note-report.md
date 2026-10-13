# Parent / Note report sheet (screen spec v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` sections 6.10 items 2 and 4, 7.6, 8.3, 8.4 · wireframe `design/wireframes/parent/note-report.md`
Mock: `mock/report-sheet.html` (page), `mock/report-sheet-states.html` (board)
Shots: `shots/report-sheet-375.png`, `-1280.png`, `-320-text200.png`, `report-sheet-states-375.png`, `-1280.png`
Code (planned): **FB-9**, the sheet opened with gate destination `NoteReport` and `PinEntry.noteId` (types from FB-7), from the note page or from Report in the grown-up zone

## Layout

A sheet: full height on a phone, a centred card of at most `layout.maxWidth.reading` with `shadows.modal` from 600 px.

```
Report this note                          [ x ]   caregiver.notes.report.title; close = report.close, 64 px
┌ Your teacher · Saturday Class B · Today ────┐   the note quoted on surface.sunken
│ Your reading is getting stronger.           │
│ Loved your reading in class today           │
└─────────────────────────────────────────────┘
Why?                                              report.why (fieldset legend)
( ) Unkind  ( ) Unsafe  ( ) Not meant for Mina  ( ) Something else      report.reasons.*
(            Report and hide            )         primary, report.submit.cta
The note goes away for Mina on every device. Our team looks at every report.   report.line(name), describes the primary
(              Just hide it             )         secondary, report.justHide.cta
```

- Report and hide stays `aria-disabled` (focusable, described by the line) until a reason is picked.
- No free-text field: nothing typed about a learner is collected. The person who reports is never told what happens to the sender.

## States (board)

| State | Drawn |
|---|---|
| no reason yet | primary waits |
| done after Report and hide | `report.reported` and `report.done.cta` |
| done after Unsafe | adds `report.emergency` |
| after Just hide it | `report.hidden` (no team line, no emergency line) |
| already gone | `report.alreadyGone` |
| error or offline after Report and hide | `report.queued` (hidden here at once, one pending report per note) |
| offline before | Just hide it disabled, described by `caregiver.notes.offline` |
| class-scoped device | no Just hide it |
| rate limit | `report.tooMany` |

Just hide it opens the Hide confirm of `grown-up-notes.md` D first.

## Notes for FB-9

- `notes.report_sent { reason, via: 'note_page' | 'grown_up_zone' }` (no `profileId`).
- Done returns to My notes (learner path; the gate session ends) or to Notes for <learner>.
