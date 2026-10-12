# Parent / Notes: one row per learner on the dashboard, then every note for that learner, hide, report, class-notes setting (wireframe v2)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.10, §7.6, §7.7, §8.2-8.4, §9
Audience: **grown-up** behind the gate (parent, guardian, or an adult self-learner whose gate opens directly). Caregiver surface: may address the grown-up directly; caregiver banned-word list applies.
Code: none yet. Rows on `apps/mobile/src/screens/parent/ParentDashboardScreen.tsx` and a new screen `NotesGrownUpScreen` (`apps/mobile/src/screens/parent/NotesGrownUpScreen.tsx`, gate destination `NotesGrownUp { profileId }`) (FB-9), behind `flags.notesEnabled`.
Notation: `[[ X ]]` the one primary action, `( )` a radio choice, `<...>` live data.

All copy in boxes is placeholder (`caregiver.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a grown-up passed the gate on a device where one or more learner profiles receive notes
When: they open the grown-up zone and tap a learner's notes row
Then: they read every note that learner has, with its full text and sender, can hide or report any note, choose what notes from classes may contain, learn what teachers see, and (on web) go to the family notes on app.hangulroute.com to send a note

## Screen goal

"See every note my learner receives and act on one that is not right."

## Box diagram

### A. Dashboard rows (one per local profile with notes or memberships)

```
┌──────────────────────────────────┐
│ [← back]     "Grown-ups"         │
│  [Grown-up home card, F-APP-001] │  <- other specs' blocks, unchanged
│  ... learner cards, See report . │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ [note icon] Notes for <A> (New) > │  -> B for <A>
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ [note icon] Notes for <B>      > │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

The dashboard never lists notes itself, so it does not grow with every note.

### B. Notes for <learner> (`NotesGrownUp`)

```
┌──────────────────────────────────┐
│ [← back]  "Notes for <learner>"  │
│                                  │
│ ┌──────────────────────────────┐ │  <- C, once, only after the first class note
│ │ "Notes from classes: All notes."│
│ │ [ Keep ]   [ Change ]        │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ <sender label> · <date>      │ │  <- "Your teacher · <class name>" / "Grandma"
│ │ "<preset line>"              │ │
│ │ "<full text>"                │ │  <- always full text, also in presets mode
│ │ Opened · <reaction label>    │ │  <- neutral status (family view of its own learner)
│ │ [ Hide from <learner> ]  [ Report ] │  -> hide: confirm sheet D; report: parent/note-report
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ ... a note put away by the   │ │
│ │ learner: "Put away on this   │ │  <- still listed so a grown-up can report it
│ │ device"                      │ │
│ └──────────────────────────────┘ │
│                                  │
│  "Notes from classes"            │
│   (•) All notes                  │  <- notes mode for this learner
│   ( ) Encouragements only        │  <- class notes arrive without the typed words
│   ( ) Off                        │
│   "Notes from your family always arrive."│
│   "Teachers see the answer       │  <- disclosure (§7.7)
│    <learner> picks on their notes."│
│                                  │
│  [ Send a note ]                 │  <- web only: openGrownUpArea -> /parent/notes
└──────────────────────────────────┘
```

### C. One-time class-notes card

Shown once per learner, the first time a class note reaches them while `notePrefs.acknowledged` is false. **Keep** records the acknowledgement; **Change** records it and scrolls to the setting. It never returns, on any device or in the console.

### D. Hide confirm (sheet)

```
┌──────────────────────────────────┐
│ "Hide this note from <learner>?" │
│ "It goes away on every device.   │
│  The sender sees 'Not shown'."   │
│ [[ Hide ]]          [ Cancel ]   │
└──────────────────────────────────┘
```

- Notes are listed newest first, never sorted by sender or status.
- B shows delivered notes (live), put-away ones marked. Hidden, reported and withdrawn notes leave this list; the family view on app.hangulroute.com (`console/family-notes.md`) keeps their history.
- No counts of notes per sender, no statistics.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Notes for <learner> (A) | tap | `NotesGrownUp { profileId }` (B); clears that row's New pill |
| Keep / Change (C) | tap | `PUT /api/sync/learners/:id/note-prefs { classes, acknowledge: true, attest }`; Change also focuses the setting |
| Hide from <learner> | tap | sheet D; Hide -> `POST /api/sync/learners/:id/notes/:noteId/hide`; the note leaves the learner's list at once (local) |
| Report | tap | `parent/note-report { noteId }` |
| a notes-mode choice | tap | `PUT /api/sync/learners/:id/note-prefs { classes, attest }`; `notes.prefs_changed` (no profileId) |
| Send a note (web only) | tap | `openGrownUpArea({ via: 'dashboard', target: '/parent/notes' })` (F-APP-001); hidden on native and until F-APP-001 A-6 ships |

## Navigation graph

Enter from: `profiles/pin-entry` (destination `ParentDashboard`, then row A; or `NotesGrownUp` directly) · `parent/dashboard`
Exit to: `parent/note-report` · `console/notes-hub` on app.hangulroute.com (web, Send a note) · back to `parent/dashboard`

## States

- **success**: A and B as drawn.
- **empty**: a learner with no notes: "No notes for <learner> yet." and the notes-mode choice still shows when the learner is in a class.
- **learner in no class**: the "Notes from classes" choice, the disclosure line and card C are hidden.
- **class-scoped device** (approved through a teacher re-link): the choice is shown read-only with "Change this on a home device." Hide is hidden (full-scope route); Report stays.
- **error** (hide, report or setting call fails): the choice snaps back; one calm line "That did not save. Try again." Never blames.
- **offline**: the list shows the cached notes. **Report stays enabled** (queued, with a local hide at once, as in `parent/note-report`). Hide, card C and the setting are disabled with "Connect to the internet to do this." (they must act on every device).
- **gate timeout** (15 min session): back to the gate as everywhere in the grown-up zone.

## Data needs

- reads: `notes-store` per local profile (incl. `putAway`); `notePrefs` from the last inbox (`classes`, `acknowledged`); device scope from the sync credentials; memberships (whether the learner is in a class)
- writes: device hide, report and prefs routes (spec §7.6), each sent with `attest: 'grown_up_pin'` or `'self'` (self-managed learner)
- telemetry: `notes.prefs_changed { classes }` (no profileId)

## Open questions

1. Should hidden notes stay visible here with an "Undo" for a while? Default: no undo on the device; the family view on app.hangulroute.com lists hidden notes for review, and a hidden note cannot be restored (it must be re-sent), which keeps the rule simple.
