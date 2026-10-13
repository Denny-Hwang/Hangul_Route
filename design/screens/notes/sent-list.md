# Console / Notes sent (screen spec v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` sections 6.13, 7.2 (list, take back, statuses), 7.7, 8.3, 9 · wireframe `design/wireframes/console/notes-sent.md`
Mock: `mock/sent.html` (class page), `mock/sent-states.html` (board, incl. the family Sent tab)
Shots: `shots/sent-375.png`, `-1280.png`, `-320-text200.png`, `sent-states-375.png`, `-1280.png`
Code (planned): **FB-11a**, `/teach/space/notes?id=<classId>` and the family page's Sent tab, rows from FB-10 `sentRowView` and `groupByDay`

## Layout (inside the F-APP-001 AdultFrame, the app-shell pass #420)

```
[frame: Teacher · Classes | Notes | Billing · Back to learning]   Notes is FB-11b's teacher nav item
< Back to class                                     sent.back.class
Notes · Saturday Class B              ( New note )  sent.title(space); newNote.cta, the page primary
Teachers see the answer a student picks. They do not see when a note was read.   sent.disclosure
Show [ Everyone v ]                                 sent.filter: one learner (opaque id in the URL)
Today                                               groupByDay heading
┌ To everyone (18 students) ──────────────────┐     sent.to.everyone.class(n): one row per batch
│ You keep trying. That is how we learn.      │
│ Great work in class today, everyone         │
│ Sent                          ( Take back ) │     status word; Take back described by the row's "To" line
└─────────────────────────────────────────────┘
┌ To Mina Kim ... Sent · [heart] Thank you  ( Take back ) ┐   the answer: glyph + label
┌ To Jun Park ... Try this quest: Family at the Table ... ┐
┌ To Sora Lee ... Not shown ┐                             never why
┌ To Ben Cho ... Taken back ┐                             stays listed
┌ To Leo Han · Sent by another grown-up of this space · Sent · [check-circle] I did it ┐   no Take back
( Show older )
```

- Send time only; no sort or filter by status; no counts, no open rate. A batch row shows one status ("Sent" or "Taken back") and never who has not answered. A class sender never reads "Opened" (`statusText` maps it to "Sent").
- Statuses are words (`console.notes.status.*`); the answer shows only while the learner's mode is All notes (the API sends `null` otherwise, and the row looks like a note before any answer).

## B. Take back confirm

A sheet: `sent.takeBack.title`, `.body(name)` or `.bodyEveryone` (a batch row sends `batch: true`), primary `.confirm.cta`, `.cancel.cta`.

## States (board)

| State | Drawn |
|---|---|
| filtered by one learner | their row of the batch with its own status and answer |
| take back of a reported note (`409 note_reported`) | the row reads "Not shown" and `takeBack.locked` |
| anonymized class | initials everywhere |
| C, family Sent tab | `sent.signed(label)`, `sent.otherAdult` (no Take back), "Opened", a send to everyone in the family, and the sender's own note reported on a device reading "Not shown" (rule 8.2-c) |
| empty | `sent.empty` with New note |
| loading | skeleton rows |
| error | `sent.error`, `sent.retry.cta` |

## Notes for FB-11a

- The Sent tab reuses these rows inside `family-notes.md`'s tab panel.
- A row of another grown-up never offers Take back (`canTakeBack`).
