# Parent / Notes in the grown-up zone (screen spec v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` sections 6.10, 7.6, 7.7, 8.2 to 8.4, 9 · wireframe `design/wireframes/parent/notes.md`
Mock: `mock/grown-up.html` (page B), `mock/grown-up-states.html` (board: A, D, every state)
Shots: `shots/grown-up-375.png`, `-1280.png`, `-320-text200.png`, `grown-up-states-375.png`, `-1280.png`
Code (planned): **FB-9**, rows on `ParentDashboardScreen.tsx` (one block) and `screens/parent/NotesGrownUpScreen.tsx` (`NotesGrownUp { profileId }`)

## Look

The in-app report's look (`design/screens/reports/in-app-report.md`, #429): a round `icon-button` back control (`touchTarget.min`, `surface.paper`, hairline), the `h1` at `size.title`, one centred column of at most `layout.maxWidth.reading` with gutters `layout.gutter.compact` / `.regular` (600) / `.wide` (900), sections `spacing.lg` apart. Third person about the learner; caregiver banned list.

## A. Dashboard rows

One row per local profile with notes or memberships, after the blocks other specs own (Grown-up home card, learner cards, See report, Learning Route; drawn dashed): `[note 24]` + `caregiver.notes.row.title(name)` + the `New` pill while a note arrived since the grown-up last opened that learner's notes (`grownUpSeenAt`, FB-9) + a chevron. The dashboard never lists notes itself.

## B. Notes for <learner>

```
( < )
Notes for Mina                                   caregiver.notes.title(name)
┌ Notes from classes: All notes. ─────────────┐  C, once (brand.secondaryLight)
│ ( Keep )            ( Change )               │  two equal secondary buttons
└──────────────────────────────────────────────┘
┌ Your teacher · Saturday Class B · Today ─────┐  sender label · date (text.secondary)
│ Your reading is getting stronger.            │  preset, bold
│ Loved your reading in class today            │  full text, also in Encouragements only
│ Opened · [heart] Thank you                   │  caregiver.notes.status.opened, the answer
│ ( Hide from Mina )  ( Report )               │  described by the row's first line
└──────────────────────────────────────────────┘
┌ ... surface.sunken ... Put away on this device ┐ caregiver.notes.putAway: still listed so it can be reported
Notes from classes                               caregiver.notes.mode.title (fieldset legend)
( • All notes ) ( Encouragements only ) ( Off )  mode.options, radio rows, touchTarget.min
Notes from your family always arrive.            mode.familyAlways
Teachers see the answer Mina picks on their notes.  caregiver.notes.disclosure(name)
( Send a note )                                  web only, after F-APP-001 A-6
```

- Newest first, never sorted by sender or status; no counts. Hidden, reported and taken-back notes leave this list (the family view keeps their history).
- Every Hide and Report button is described by its row's first line (`aria-describedby`), so a screen reader hears which note they act on.
- One-time card C: `caregiver.notes.oneTimeCard.line(mode)` with `keep.cta` / `change.cta`; either records the acknowledgement (`acknowledge: true`); Change also moves focus to the setting. Never shown while `notePrefs.classes` is `null`.

## D. Hide confirm

A sheet: `caregiver.notes.hide.confirm.title(name)`, `.body`, primary `.cta`, `.cancel.cta`.

## States (board)

| State | Drawn |
|---|---|
| empty, learner in a class | `caregiver.notes.empty(name)`; the setting still shows |
| learner in no class | no setting, no disclosure, no card C |
| class-scoped device | the setting disabled with `caregiver.notes.mode.classScoped` as its description; Hide not shown; Report stays |
| offline | `caregiver.notes.offline` once at the top; Hide, card C and the setting disabled and described by it; Report stays enabled (queued with a local hide) |
| a call failed | the choice snaps back; `caregiver.notes.saveFailed` as an alert line (amber bar, never red) |
| native build | no Send a note |
| self-managed adult | the same screen for the adult's own notes (gate opens directly) |
| unknown mode (`classes: null`) | the setting row is left out (not drawn; nothing to draw) |

## Notes for FB-9

- `notes.prefs_changed { classes }` (no `profileId`); device routes send `attest: 'grown_up_pin'` or `'self'`.
- One block in `ParentDashboardScreen.tsx` (the rows), as section 14.2 asks.
