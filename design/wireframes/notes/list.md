# Notes / List: every note for me, newest first (wireframe v2)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.5 item 2, §6.9, §6.11, §6.12
Audience: **learner**, any age.
Code: none yet. New stack screen `Notes` (`apps/mobile/src/screens/notes/NotesScreen.tsx`, FB-8), behind `flags.notesEnabled`.
Notation: `[[ X ]]` the one primary action, `( )` a pill, `<...>` live data.

All copy in boxes is placeholder (`learner.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a learner has notes from their teacher and/or family
When: they open My notes from Profile or Read from the Home card with several new notes
Then: they see new notes first, then earlier ones (except notes they put away on this device), each with who sent it and the encouragement line, and open any note with one tap

## Screen goal

"Find and open a note."

## Box diagram

### A. New and earlier notes

```
┌──────────────────────────────────┐
│ [← back]      "My notes"         │  <- back always top left
│                                  │
│  New                             │
│ ┌──────────────────────────────┐ │
│ │ [note icon] (New)  <date>    │ │  -> notes/detail { noteId }
│ │ "<sender label>"             │ │
│ │ "<preset line>"              │ │
│ │ "<first words of the text…>" │ │  <- only when the note has text
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ ... next new note ...        │ │
│ └──────────────────────────────┘ │
│                                  │
│  Earlier                         │
│ ┌──────────────────────────────┐ │
│ │ [note icon]        <date>    │ │
│ │ "<sender label>"             │ │
│ │ "<preset line>"              │ │
│ │ [heart] "Thank you"          │ │  <- the learner's own reaction, if picked
│ └──────────────────────────────┘ │
│  ... (scroll) ...                │
└──────────────────────────────────┘
```

- Order: New (unread) newest first, then Earlier (read) newest first. Never sorted by sender.
- Dates: "Today", "Yesterday", else a short date.
- No counters of "unread" in the title; the New group heading is enough.
- No delete, no archive (spec §6.5 item 6). A note the learner put away on this device (`notes/detail` E) is not listed here; a grown-up still sees it in `parent/notes`.
- The **My notes** row on Profile is shown only when the flag is on and the profile has at least one class or family membership or at least one cached note (spec §6.5 item 2).

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| A note row | tap / Enter | `NoteDetail { noteId }` |
| Back | tap / Escape (web) | previous screen (Profile or Home) |

## Navigation graph

Enter from: `home/notes-card` (B, several new notes) · `profile/settings` (My notes row)
Exit to: `notes/detail` · back to `profile/settings` or `home/todays-mission`

## States

- **success**: A as drawn (either group may be absent).
- **empty**: Hoya `idle`, one line "No notes yet. Notes from your teacher or family will show here." No button. (Reached only by a learner with a class or family membership, because the Profile row is hidden otherwise; the line does not push anyone to join anything.)
- **error**: the store cannot be read: the empty layout with "Your notes could not open. Try again later." and a [ Try again ] button that re-reads the store.
- **offline**: the cached notes show; nothing is greyed out.
- **a note disappears** after an inbox (hidden, reported, withdrawn, expired, blocked, the sender lost the right, learner left the class) or after Put this note away: the row is gone at the next render; no message.
- **wide window**: the list on the left pane and the open note on the right (`layout/wide.md` split pane), when F-LAYOUT-001 5a `SplitPane` is available; else full width.

## Data needs

- reads: `notes-store` (live notes, `readAt`, `reaction`, `putAway`) through `logic/notes/view.ts` `notesList` (grouping, put-away notes left out, sender labels from memberships, unknown preset fallback "A note for you")
- writes: none
- telemetry: `notes.list_viewed { notes, unread }` on open (no profileId)

## Open questions

1. Should "Earlier" fold after a number of notes (for example 20)? Default: no folding; retention keeps the list to 180 days and the inbox to 30 notes.
