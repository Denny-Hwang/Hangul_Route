# Parent / Notes: every note to each learner on this device, hide, report, class-notes setting (wireframe v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.10, §7.6, §8.2-8.4, §9
Audience: **grown-up** behind the gate (parent, guardian, or an adult self-learner whose gate opens directly). Caregiver surface: may address the grown-up directly; caregiver banned-word list applies.
Code: none yet. A new section on `apps/mobile/src/screens/parent/ParentDashboardScreen.tsx` (FB-9), reached through `PinEntry` (destination `NotesGrownUp`), behind `flags.notesEnabled`.
Notation: `[[ X ]]` the one primary action, `( )` a radio choice, `<...>` live data.

All copy in boxes is placeholder (`caregiver.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a grown-up passed the gate on a device where one or more learner profiles receive notes
When: they open the grown-up zone
Then: under each learner they can read every note that learner has, with its full text and sender, hide or report any note, and choose what notes from classes may contain

## Screen goal

"See every note my learner receives and act on one that is not right."

## Box diagram

### A. Section inside the grown-up zone

```
┌──────────────────────────────────┐
│ [← back]     "Grown-ups"         │
│  ... existing learner cards ...  │
│                                  │
│  "Notes for <learner>"           │  <- one block per local profile
│ ┌──────────────────────────────┐ │
│ │ <sender label> · <date>      │ │  <- "Your teacher · <class name>" / "Grandma"
│ │ "<preset line>"              │ │
│ │ "<full text>"                │ │  <- always full text, also in presets mode
│ │ Opened · <reaction label>    │ │  <- neutral status
│ │ [ Hide from <learner> ]  [ Report ] │  -> hide: confirm sheet; report: parent/note-report
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ ... next note ...            │ │
│ └──────────────────────────────┘ │
│                                  │
│  "Notes from classes"            │
│   (•) All notes                  │  <- notes mode for this learner
│   ( ) Encouragements only        │  <- class notes arrive without the typed words
│   ( ) Off                        │
│   "Notes from your family always arrive."│
└──────────────────────────────────┘
```

### B. Hide confirm (sheet)

```
┌──────────────────────────────────┐
│ "Hide this note from <learner>?" │
│ "It goes away on every device.   │
│  The sender sees 'Not shown'."   │
│ [[ Hide ]]          [ Cancel ]   │
└──────────────────────────────────┘
```

- Notes are listed newest first, never sorted by sender or status.
- The block shows delivered notes (live). Hidden and reported notes leave this list; the family console view (`console/family-notes.md`) keeps their history.
- No counts of notes per sender, no statistics.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Hide from <learner> | tap | sheet B; Hide -> `POST /api/sync/learners/:id/notes/:noteId/hide`; the note leaves the learner's list at once (local) |
| Report | tap | `parent/note-report { noteId }` |
| a notes-mode choice | tap | `PUT /api/sync/learners/:id/note-prefs { classes, attest }`; `notes.prefs_changed` |

## Navigation graph

Enter from: `profiles/pin-entry` (destination `NotesGrownUp`, from the Profile grown-up button) · `parent/dashboard` scroll
Exit to: `parent/note-report` · back to `profile/settings`

## States

- **success**: A as drawn.
- **empty**: a learner with no notes: "No notes for <learner> yet." and the notes-mode choice still shows when the learner is in a class.
- **learner in no class**: the "Notes from classes" choice is hidden.
- **class-scoped device** (approved through a teacher re-link): the choice is shown read-only with "Change this on a home device." Hide is hidden (full-scope route); Report stays.
- **error** (hide, report or setting call fails): the choice snaps back; one calm line "That did not save. Try again." Never blames.
- **offline**: the list shows the cached notes; Hide, Report and the setting say "Connect to the internet to do this." and are disabled. (Safety actions must reach the server to work on every device.)
- **gate timeout** (15 min session): back to the gate as everywhere in the grown-up zone.

## Data needs

- reads: `notes-store` per local profile; `notePrefs` from the last inbox; device scope from the sync credentials
- writes: device hide, report and prefs routes (spec §7.6), each sent with `attest: 'grown_up_pin'` or `'self'` (self-managed learner)
- telemetry: `notes.prefs_changed { classes }` (no profileId)

## Open questions

1. Should hidden notes stay visible here with an "Undo" for a while? Default: no undo on the device; the family console view lists hidden notes for review, and a hidden note cannot be restored (it must be re-sent), which keeps the rule simple.
