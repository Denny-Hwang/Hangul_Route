# Home / Notes card: a new note from your teacher or family (wireframe v2)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.5 item 1, §6.11, §6.12; base screen `home/todays-mission.md`; Home stack order F-ROUTE-001 §6.4 (row **2a**, added by F-FEEDBACK-001 FB-0)
Audience: **learner**, any age (CLAUDE.md §1). Same card for a child and an adult self-learner.
Code: none yet. Planned in FB-8 inside `apps/mobile/src/screens/home/HomeScreen.tsx`, behind `flags.notesEnabled` (default off).
Notation: `[[ X ]]` the one primary action, `( )` a pill, `<...>` live data.

All copy in boxes is placeholder; final strings land in `packages/i18n` (`learner.notes`, `common.notes`, FB-5).

## Scenario (Given-When-Then)

Given: the active learner has at least one live note they have not opened and not put away (sent by their teacher or family)
When: Today (Home) opens
Then: one calm card after the three mission cards shows who wrote and the encouragement line, with one button to read it; the missions stay first and are never interrupted

## Screen goal

"Let me see that someone sent me a note, and open it with one tap."

One primary action: **Read**. No secondary action on the card.

## Box diagram

### A. One new note

```
┌──────────────────────────────────┐
│ "Hi <name>"          streak line │  <- row 1 (unchanged)
│ ── Today's three cards (row 2, unchanged, always first) ──
│ (1) ...  (2) ...  (3) ...         │
│ ┌──────────────────────────────┐ │  <- row 2a: only while an unread live note exists
│ │ [note icon]  (New)           │ │
│ │ "A note from <sender label>" │ │  <- "Your teacher · <class name>" or "Grandma"
│ │ "<preset line>"              │ │  <- one line, in the learner's UI language
│ │ [[ Read ]]                   │ │  -> notes/detail { noteId }
│ └──────────────────────────────┘ │
│ ── story card (row 3) and the rest, unchanged ──
└──────────────────────────────────┘
```

### B. Several new notes

```
┌──────────────────────────────┐
│ [note icon]  (New)           │
│ "<n> new notes"              │  <- count of new notes only, never "of M"
│ "From <newest sender label>" │
│ [[ Read ]]                   │  -> notes/list
└──────────────────────────────┘
```

- No Hoya on this card (the greeting keeps the one Hoya of the screen).
- No dismiss button, no timer, no "you have not read" wording. The card leaves when every note is opened.
- The free text of a note is never shown on Home (only on the note page), so a sibling glancing at a shared screen sees the encouragement line only.

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Read (A) | tap / Enter | `NoteDetail { noteId }` for the newest unread note; opening marks it read |
| Read (B) | tap / Enter | `Notes` (list), New group first |
| Card body | tap | same as Read (one target, one focus stop) |

## Navigation graph

Enter from: `tabs/home` (Today) after an inbox refresh delivered a note · cold launch after the profile pick · return from `notes/detail` while other notes are still new
Exit to: `notes/detail` (A) · `notes/list` (B) · the existing Today exits

## States

- **success**: A or B as drawn.
- **empty**: no unread live note: no card (Today is unchanged). Read notes are found in Profile > My notes.
- **error**: the notes store cannot be read: no card; nothing else on Today changes; the next start tries again.
- **offline**: the card shows from the cached notes; nothing waits on the network.
- **note withdrawn or hidden** while Home is open: the card updates at the next inbox (it may disappear); no message.
- **flag off**: no card.
- **wide window**: the card sits in the right column (rows 4-7 side) per `layout/wide.md` B.
- **reduced motion**: no entrance animation in any case.

## Data needs

- reads: `notes-store` for the active profile: live notes, `readAt` (selector `homeNotesCard` in `logic/notes/view.ts`: newest unread note, unread count); memberships (class name for the teacher label)
- writes: none (opening the note page marks it read)
- telemetry: `notes.card_shown { unread }` once per app session when the card first shows (no profileId)

## Open questions

1. Placement after the mission cards (row 2a) vs under the greeting. Default: after the missions, so learning stays first; the owner can move it with one Home-order edit.
