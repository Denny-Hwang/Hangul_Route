# Console / Family notes (screen spec v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` sections 6.1, 6.13, 7.2 (oversight, hide, report, blocks, prefs, note-senders), 7.7, 8.2 to 8.5, 9 · wireframe `design/wireframes/console/family-notes.md`
Mock: `mock/family.html` (Received tab), `mock/family-states.html` (board: sheets, settings, panel D, states)
Shots: `shots/family-375.png`, `-1280.png`, `-320-text200.png`, `-390-first.png`, `family-states-375.png`, `-1280.png`
Code (planned): **FB-12** (Received tab, settings, panel D), **FB-11a** (page, Sent tab), rows from FB-10 `receivedRowView`

## Layout (AdultFrame, Family persona)

```
[frame: Family · Home | Reports | Notes | Billing · Back to learning]
Notes                                   ( Send a note )   family.title; sendNote.cta, the page primary
Learner [ Mina v ]                                        family.learner; hidden with one learner
[ Received ] [ Sent ]                                     tab list, family.tabs.label; arrow keys
┌ Notes from classes: All notes.  ( Keep ) ( Change ) ┐   C, once: family.oneTimeCard
┌ Today · From Saturday Class B (teacher) ────────────┐  date · family.from.class(name): never the teacher's account
│ Your reading is getting stronger.                   │
│ Loved your reading in class today                   │
│ Opened · [heart] Thank you                          │
│ ( Hide ) ( Report ) ( Stop notes from this sender ) │  each described by the row's first line
└─────────────────────────────────────────────────────┘
┌ Yesterday · From home, signed Grandma               ┐  family.from.homeSigned(label)
│ Sent by grandma.park@example.com                    │  family.sentBy(account): adult to adult inside the family
┌ Oct 10 · From home, signed Mom · You sent this ... ( Hide ) ┐   own note: no Report, no Stop
┌ Oct 9 ... Taken back by the sender ( Report ) ( Stop ... ) ┐  kept with its text (8.3)
┌ Oct 8 ... Hidden by Ji-woo Kim ( Report ) ( Stop ... ) ┐
┌ Oct 7 ... Reported by Ji-woo Kim · Our team is looking at it ( Stop ... ) ┐
( Show older )
[ > Settings for Mina ]                                   one disclosure, closed by default
```

- Newest first, never sorted by sender or status; one learner at a time; no counts.
- **Row actions follow FB-10 `receivedRowView`**: Hide while live or opened; Report unless the viewer sent it or it is already reported; Stop unless the viewer sent it. So a taken-back or hidden note keeps Report and Stop (the wireframe drew Report only on a taken-back row and nothing on a hidden one; the shipped view model is the source).
- Status words: `console.notes.status.sent` / `.opened`, `family.withdrawn`, `family.hiddenBy(account)` / `hiddenOnDevice`, `family.reportedBy(account)` / `reportedOnDevice`, `status.not_shown`.

## Sheets

- B, Report: `family.report.*` with the note quoted, the four reasons, primary `submit.cta`, `cancel.cta`, `line`.
- Hide confirm: `family.hideConfirm.*`. Stop confirm: `family.blockConfirm.*` ("The sender is not told.").
- `422 own_note`: `family.report.ownNote`.

## Settings disclosure (open)

`family.settings.classes` with the three options, `familyAlways`, `lastChangedBy(account)` or `lastChangedOnDevice`, `saved` (a `feedback.successDark` check and word, polite), `family.disclosure(name)`; then `settings.stopped.title` with one row per stopped sender (`common.notes.teacherLabel(class)` or the family adult's name) and `allowAgain.cta`. A learner in no class shows only the stopped senders.

## D. Can send notes (family settings page)

`family.senders.title`; the owner's row `senders.you(name)` with `senders.always`; each caregiver row has a `role="switch"` named by the person's name and `senders.canSend` (`aria-labelledby` both), its state a thumb position and a filled `brand.primary` track (off: `border.shape` ring, 4.55:1), no on/off words; `senders.line` under the list. Other caregivers see the same list with the switches disabled.

## States (board)

| State | Drawn |
|---|---|
| empty with one learner | `family.empty(name)`, no Learner select, settings still there |
| caregiver without the send grant | Send a note `aria-disabled` with `composer.errors.notAllowed` under the heading |
| no learners | `family.noLearners` |
| loading / load error | skeleton / `family.error`, `retry.cta` |
| action failed / short wait / report limit | `saveFailed` / `wait` / `report.tooMany` as alert lines |
| Sent tab | `sent-list.md` C |

## Notes for FB-12

- The teacher's account name or email never appears; a family note that a learner reported on a device reads "Not shown" to its own sender (8.2-c) and "Reported on a device" to the other caregivers.
- Hide, report, stop and the setting need the network; their failures use `familyActionProblem`.
