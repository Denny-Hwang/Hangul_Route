# Notes / Detail: read a note, answer with one tap (wireframe v2)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.2, §6.5 item 3, §6.6, §6.7, §6.10 items 3-4, §6.11, §6.12
Audience: **learner**, any age. The free text is a grown-up's words, shown as typed.
Code: none yet. New stack screen `NoteDetail { noteId }` (`apps/mobile/src/screens/notes/NoteDetailScreen.tsx`, FB-8), behind `flags.notesEnabled`.
Notation: `[[ X ]]` the one primary action, `( )` a radio choice, `<...>` live data.

All copy in boxes is placeholder (`learner.notes`, `common.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a learner opens a note from Home or from My notes
When: the note page shows
Then: they read the encouragement and the grown-up's words, may start the suggested quest when it is open to them, may pick one answer (and see who will see it), can put the note away on their own, and can always ask a grown-up for help if the note worries them

## Screen goal

"Read the note." Secondary: "Answer with one tap" or "Start the suggested quest".

The primary action is **Start** when an open quest is suggested; otherwise the page has no primary button (reading is the goal) and the reactions are the only actions.

## Box diagram

### A. Note with text and an open suggested quest

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
│  "Answer with one tap"           │
│  ( [heart] Thank you )           │  <- radio group, one pick, can change
│  ( [pencil] I will try it )      │
│  ( [check-circle] I did it )     │
│  ( [sparkle] This made me happy )│
│  "Your teacher will see your     │  <- disclosure, shown before any pick (§6.6)
│   answer."                       │
│                                  │
│  Put this note away              │  <- quiet text link, NO gate (§6.10 item 3)
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
│  "Answer with one tap"           │
│  ( ... four reactions ... )      │
│  "<seen-by line>"                │
│  Put this note away              │
│  Tell a grown-up                 │
└──────────────────────────────────┘
```

### C. After a pick

```
│  "Answer with one tap"           │
│  (•[heart] Thank you [check] )   │  <- check icon plus label, not colour only
│  ( [pencil] I will try it )      │
│  "Your teacher will see your     │  <- the same line; offline: same line (sent later)
│   answer."                       │
```

### D. Suggested quest the learner cannot open (free plan, gating on; F-ENT-003)

```
│ ┌──────────────────────────────┐ │
│ │ "Try this quest"             │ │
│ │ [quest art] <quest title>    │ │
│ │ "Opens with the full route"  │ │  <- caption only: no Start, no button,
│ └──────────────────────────────┘ │     no gate, no paywall link, no price
```

### E. Put away (confirmation line, then back to the list)

```
│  "Put away. A grown-up can still │
│   see it."                       │  -> notes/list (the note is gone from it on this device)
```

### Seen-by line (one line, by note and notes mode)

| Note | Learner's class-notes mode | Line |
|---|---|---|
| class note | `all` | "Your teacher will see your answer." |
| class note | `presets` | "Your family will see your answer." (the class sender gets no answer) |
| family note | any | "Your family will see your answer." |

- Reactions never prompt ("Reply now"), never count down, never come back as a reminder.
- No "report" word on a child's page; "Tell a grown-up" is the path. On a **self-managed** profile (`gateOpensDirectly`, an adult self-learner) the link reads "Report this note" and opens the sheet directly.
- Only one Hoya on the page.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| page open | — | marks the note read (local first, queued to the server); `notes.note_opened` (no profileId) |
| Start (A) | tap / Enter | the quest opens as from Journey (`EpisodeDetail` / `QuestPlayer`); `notes.suggest_started` |
| closed quest card (D) | — | not interactive; nothing opens |
| a reaction | tap / Space / arrows in the group | that pick is saved locally and queued; screen reader: "You picked: Thank you"; `notes.reaction_picked` |
| Put this note away | tap | no gate; the note is hidden on this device only (`putAway`), nothing is sent; line E, then `notes/list` |
| Tell a grown-up | tap | `PinEntry { next: 'NoteReport', noteId }` (a self-managed learner goes straight to the sheet) |
| Back | tap / Escape (web) | previous screen |

## Navigation graph

Enter from: `home/notes-card` (A) · `notes/list`
Exit to: `episode/detail` / `quest/player` (Start) · `notes/list` (Put this note away) · `profiles/pin-entry` -> `parent/note-report` (Tell a grown-up) · back to `notes/list` or `home/todays-mission`

## States

- **success**: A, B or C.
- **empty**: the note id is not in the store (opened from a stale route): the page shows "This note was put away." and [ See my notes ] -> `notes/list`.
- **error**: the store cannot be read: same layout as empty with "This note could not open." and [ Try again ].
- **withdrawn or hidden while open** (an inbox arrives): the page swaps to "This note was put away." with [ See my notes ]; nothing else.
- **suggested quest closed** (F-ENT-003 `isQuestOpen` false): D.
- **suggested quest not in this build** (older app, newer catalogue): the quest card is not drawn; the rest of the note shows.
- **unknown preset id** (older app): the preset line reads "A note for you."
- **offline**: everything works; picks wait in the queue; put away works; the line in C stays the same.
- **wide window**: right pane of the notes split view, or a centred column.
- **reduced motion**: Hoya's cheer is static.

## Data needs

- reads: the note from `notes-store` (preset id, text, `textLocale`, suggest, sender role and label, space id, `createdAt`, `readAt`, `reaction`); memberships (class name); `notePrefs` (seen-by line); the quest catalogue (title, art) for the suggestion; `useQuestAccess()` (F-ENT-003) for open or closed; `gateOpensDirectly` for the link wording
- writes: `markRead(noteId)` on open; `pickReaction(noteId, reaction)`; both queue a `PUT /api/sync/learners/:id/notes/:noteId/state`; `putAway(noteId)` local only
- telemetry (all without profileId): `notes.note_opened { presetId, fromRole, hasText, hasSuggest, suggestOpen }` · `notes.reaction_picked { reaction, fromRole, changed }` · `notes.suggest_started { fromRole }`

## Open questions

1. Should the reaction row hide for an adult self-learner who finds it childish? Default: shown to everyone (same screens for every age, CLAUDE.md §1); the words are plain, not childish, and the heading is "Answer with one tap".
