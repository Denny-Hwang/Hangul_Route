# Notes / Detail: read a note, send a thank-you (wireframe v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.5 item 3, §6.6, §6.7, §6.10 item 2, §6.11, §6.12
Audience: **learner**, any age. The free text is a grown-up's words, shown as typed.
Code: none yet. New stack screen `NoteDetail { noteId }` (`apps/mobile/src/screens/notes/NoteDetailScreen.tsx`, FB-8), behind `flags.notesEnabled`.
Notation: `[[ X ]]` the one primary action, `( )` a radio choice, `<...>` live data.

All copy in boxes is placeholder (`learner.notes`, `common.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a learner opens a note from Home or from My notes
When: the note page shows
Then: they read the encouragement and the grown-up's words, may start the suggested quest, may pick one thank-you, and can always ask a grown-up for help if the note worries them

## Screen goal

"Read the note." Secondary: "Say thank you with one tap" or "Start the suggested quest".

The primary action is **Start** when a quest is suggested; with no suggestion the page has no primary button (reading is the goal) and the reactions are the only actions.

## Box diagram

### A. Note with text and a suggested quest

```
┌──────────────────────────────────┐
│ [← back]                         │
│                                  │
│        [Hoya cheer]              │
│                                  │
│   "<preset line, large>"         │  <- learner's UI language
│                                  │
│ ┌──────────────────────────────┐ │
│ │ "<text as typed, ≤120 chars>"│ │  <- lang="ko" when it has Hangul
│ │ From <sender label>  <date>  │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ "Try this quest"             │ │
│ │ [quest art] <quest title>    │ │
│ │ [[ Start ]]                  │ │  -> episode/detail or quest/player (as Journey)
│ └──────────────────────────────┘ │
│                                  │
│  "Send a thank-you"              │
│  ( [heart] Thank you )           │  <- radio group, one pick, can change
│  ( [pencil] I will try it )      │
│  ( [check-circle] I did it )     │
│  ( [sparkle] This made me happy )│
│                                  │
│  Tell a grown-up                 │  <- quiet text link -> profiles/pin-entry -> parent/note-report
└──────────────────────────────────┘
```

### B. Preset only (no text, no quest)

```
┌──────────────────────────────────┐
│ [← back]                         │
│        [Hoya cheer]              │
│   "<preset line, large>"         │
│   From <sender label>  <date>    │
│  "Send a thank-you"              │
│  ( ... four reactions ... )      │
│  Tell a grown-up                 │
└──────────────────────────────────┘
```

### C. After a pick

```
│  "Send a thank-you"              │
│  (•[heart] Thank you [check] )   │  <- check icon plus label, not colour only
│  ( [pencil] I will try it )      │
│  "<sender label> will see it."   │  <- one calm line; offline: same line (sent later)
```

- Reactions never prompt ("Reply now"), never count down, never come back as a reminder.
- No "report" word on the learner page; "Tell a grown-up" is the only path.
- Only one Hoya on the page.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| page open | — | marks the note read (local first, queued to the server); `notes.note_opened` |
| Start | tap / Enter | the quest opens as from Journey (`EpisodeDetail` / `QuestPlayer`); `notes.suggest_started` |
| a reaction | tap / Space / arrows in the group | that pick is saved locally and queued; screen reader: "You picked: Thank you"; `notes.reaction_picked` |
| Tell a grown-up | tap | `PinEntry` with destination `NoteReport { noteId }` (a self-managed learner goes straight to the sheet) |
| Back | tap / Escape (web) | previous screen |

## Navigation graph

Enter from: `home/notes-card` (A) · `notes/list`
Exit to: `episode/detail` / `quest/player` (Start) · `profiles/pin-entry` -> `parent/note-report` (Tell a grown-up) · back to `notes/list` or `home/todays-mission`

## States

- **success**: A, B or C.
- **empty**: the note id is not in the store (opened from a stale route): the page shows "This note was put away." and [ See my notes ] -> `notes/list`.
- **error**: the store cannot be read: same layout as empty with "This note could not open." and [ Try again ].
- **withdrawn or hidden while open** (an inbox arrives): the page swaps to "This note was put away." with [ See my notes ]; nothing else.
- **suggested quest not in this build** (older app, newer catalogue): the quest card is not drawn; the rest of the note shows.
- **unknown preset id** (older app): the preset line reads "A note for you."
- **offline**: everything works; picks wait in the queue; the line in C stays the same.
- **wide window**: right pane of the notes split view, or a centred column.
- **reduced motion**: Hoya's cheer is static.

## Data needs

- reads: the note from `notes-store` (preset id, text, `textLocale`, suggest, sender role and label, space id, `createdAt`, `readAt`, `reaction`); memberships (class name); the quest catalogue (title, art) for the suggestion
- writes: `markRead(noteId)` on open; `pickReaction(noteId, reaction)`; both queue a `PUT /api/sync/learners/:id/notes/:noteId/state`
- telemetry: `notes.note_opened { presetId, fromRole, hasText, hasSuggest, firstOpen }` · `notes.reaction_picked { reaction, fromRole, changed }` · `notes.suggest_started { fromRole }`

## Open questions

1. Should the reaction row hide for an adult self-learner who finds it childish? Default: shown to everyone (same screens for every age, CLAUDE.md §1); the words are plain, not childish.
