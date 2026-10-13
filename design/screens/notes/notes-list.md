# Notes / My notes (screen spec v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` sections 6.5 items 2 and 6, 6.9, 6.11, 6.12 · wireframe `design/wireframes/notes/list.md`
Mock: `mock/notes-list.html` (page), `mock/notes-list-states.html` (board)
Shots: `shots/notes-list-375.png`, `-1280.png`, `-320-text200.png`, `notes-list-states-375.png`, `-1280.png`
Code (planned): **FB-8**, stack screen `Notes` (`apps/mobile/src/screens/notes/NotesScreen.tsx`) from `notesList` (`logic/notes/view.ts`); the **My notes** Profile row from `showMyNotesRow`

## Layout

```
( < )  My notes                       back (rn-back, touchTarget.min) + learner.notes.list.title (size.title)
New                                   learner.notes.list.groups.new (size.bodyLg bold)
┌ [note 20] (New)            Today ┐  one row = one link, at least touchTarget.min tall
│ Your teacher · Saturday Class B  │  sender, bold
│ Your reading is getting stronger.│  preset
│ Loved your reading in class t... │  first words of the text: one line, clamped, text.secondary, lang per 6.11
└──────────────────────────────────┘
Earlier                               learner.notes.list.groups.earlier
┌ [note 20]              Yesterday ┐
│ ...                              │
│ [heart 20] Thank you             │  the learner's own answer: glyph + label, never the glyph alone
└──────────────────────────────────┘
```

- Rows are `surface.paper` cards with a `border.subtle` hairline, `spacing.sm` apart. New first, then Earlier, newest first in each; never sorted by sender. No count in the title.
- Each row's accessible name is `a11y.notes.row(sender, preset, date, isNew)`, followed by `a11y.notes.answer(label)` when the learner answered. The free text is not in the name (it is read on the note page).
- Dates: `common.notes.date.today` / `.yesterday`, otherwise `formatDate(locale, d, 'monthDay')`.
- Wide window (700 px, `layout.sideBySideMin`, when F-LAYOUT-001 `SplitPane` is available): the list on the left at `layout.pane.master` and the open note on the right, the open row marked with a thick `brand.secondaryDark` border and `aria-current`; otherwise full width.

## States (board)

| State | Drawn |
|---|---|
| empty | Hoya `idle` and `learner.notes.list.empty`; no button (the Profile row is hidden without a membership or a cached note, so the line pushes no one to join anything) |
| error | the same layout with `learner.notes.list.error` and `learner.notes.list.retry.cta` (ghost button) |
| only Earlier | yes |
| class note in Encouragements only | the row has no words (the inbox delivers `text: null`) |
| self learner | `familyLabels.partner` ("Your partner") is shown; on a child profile a `partner` label reads "Your family" (both drawn) |
| put away, report waiting | not listed (FB-7 `visibleNotes`); no message when a row disappears |
| offline | as drawn, from the cache; nothing greyed out |
| wide | split pane |
| ko, es | yes |

## Notes for FB-8

- `notes.list_viewed { notes, unread }` on open (no `profileId`).
- The My notes row on Profile uses `learner.notes.profileRow.title` with the `New` pill while something is unread, and sits below the Grown-up home row (the app-shell pass reserved that place, `design/screens/app-shell/mock/learner-entry.html`). Drawn on `mock/notes-list-states.html` ("Profile row" items: unread with the pill, all read, es): the app-shell `rn-row` card unchanged, the `note` glyph in `text.secondary`, the title, the `New` pill before the chevron; the row's name is its visible text.
