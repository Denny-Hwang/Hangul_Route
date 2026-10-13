# Home / Notes card (screen spec v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` sections 6.5 item 1, 6.11, 6.12 · wireframe `design/wireframes/home/notes-card.md` · Home order F-ROUTE-001 section 6.4 row **2a**
Mock: `mock/home-card.html` (board) · Shots: `shots/home-card-375.png`, `-1280.png`
Code (planned): **FB-8**, one block in `apps/mobile/src/screens/home/HomeScreen.tsx`, from `homeNotesCard` (`logic/notes/view.ts`, FB-7), behind `flags.notesEnabled`

## Layout

```
Row 1  greeting, streak line                     unchanged
Row 2  Today's three mission cards               unchanged, always first
Row 2a ┌ note card ─────────────────────────────┐ only while an unread live note exists
       │ [note 24]  (New)                        │
       │ A note from Your teacher · Saturday ... │ size.bodyLg bold
       │ Your reading is getting stronger.       │ text.secondary
       │                               ( Read )  │ rn primary pill, end aligned
       └─────────────────────────────────────────┘
Row 3  story card and the rest                   unchanged
```

- The card is `surface.paper`, `radii.lg`, `spacing.lg` padding, `shadows.card`, a `border.subtle` hairline: the Home card look of the app-shell pass. No Hoya (the greeting keeps the one Hoya of Today).
- **One target, one focus stop.** The whole card is the pressable (`accessibilityRole="button"`); the **Read** pill inside is drawn as the primary button but is not a second target. The accessible name is `a11y.notes.card(sender, preset)` ("New note from Your teacher · Saturday Class B: Your reading is getting stronger. Read."); with several new notes `a11y.notes.cardMany(n, sender)`.
- Wide window (`layout.breakpoint.wide`, 900): the card moves to the right column with row 3 and later (layout/wide.md B); rows 1 and 2 stay left.

## Words (all existing keys)

| Part | One new note (A) | Several (B) |
|---|---|---|
| pill | `common.notes.new.pill` | same |
| line 1 | `learner.notes.home.title(sender)` | `learner.notes.home.newCount(n)` |
| line 2 | the preset, `common.notes.presets[id]` (`presetFallback` for an unknown id) | `learner.notes.home.from(sender)` (newest sender) |
| button | `learner.notes.home.read.cta` → `NoteDetail { noteId }` | same → `Notes` |
| sender | `common.notes.teacherLabel(class)` / `teacherOnly`, or `common.notes.familyLabels[label]` (`partner` reads `family` unless the profile is a self learner) | same |

The free text of a note is never on Home, so a sibling glancing at a shared screen sees the encouragement line only.

## States (board)

| State | Drawn |
|---|---|
| A, class note and family note | yes |
| B, two new notes | yes |
| empty, error, flag off | Today without the card |
| offline | same as A, from the cached notes |
| wide | right column |
| ko, es | A and B in both (FB-5b): `쪽지가 왔어요. 보낸 사람: 할머니`, `Una nota de Tu docente · Saturday Class B`; the sender stands before a colon or a middle dot, never before a particle, so the Korean line needs no 이/가 choice |

No dismiss button, no timer, no "you have not read" wording; the card leaves when every note is opened. Reduced motion: no entrance animation in any case.

## Notes for FB-8

- One block in `HomeScreen.tsx` at row 2a; the test asserts the order (after the mission cards, before the story card) and that the card has one accessible element.
- `notes.card_shown { unread }` once per app session when the card first shows (no `profileId`).
