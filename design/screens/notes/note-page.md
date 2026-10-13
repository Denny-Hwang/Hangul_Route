# Notes / Note page (screen spec v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` sections 6.2, 6.5 item 3, 6.6, 6.7, 6.10 items 3 and 4, 6.11, 6.12 · wireframe `design/wireframes/notes/detail.md`
Mock: `mock/note-page.html` (page), `mock/note-page-states.html` (board)
Shots: `shots/note-page-375.png`, `-1280.png`, `-320-text200.png`, `-390-first.png`, `note-page-states-375.png`, `-1280.png`
Code (planned): **FB-8**, stack screen `NoteDetail { noteId }` (`apps/mobile/src/screens/notes/NoteDetailScreen.tsx`) from `noteDetail` and `reactionSeenBy` (`logic/notes/view.ts`)

## Layout (one centred column, at most `layout.maxWidth.reading`)

```
( < )                                       back
        [Hoya cheering, 96]                 one Hoya; static under reduced motion
  Your reading is getting stronger.         the preset: h1, size.title bold, centred
┌ Loved your reading in class today ─────┐  the text as typed (size.bodyLg, lang per 6.11)
│ From Your teacher · Saturday Class B ·  │  learner.notes.detail.from(sender) · date
│ Today                                   │
└─────────────────────────────────────────┘
┌ Try this quest ────────────────────────┐  learner.notes.detail.suggest.title
│ [art 64] Meet o, u, m and the circle    │  quest title from the catalogue
│ (            Start            )         │  the page's only primary, full width
└─────────────────────────────────────────┘
Answer with one tap                         radio group label (learner.notes.detail.reactions.heading)
( o [heart] Thank you              )        four pills, touchTarget.min each
( o [pencil] I will try it         )
( o [check-circle] I did it        )
( o [sparkle] This made me happy   )
Your teacher will see your answer.          learner.notes.reactionSeenBy.*: the group's description
─────────────────────────────────────
Put this note away                          quiet links, text.secondary, under a rule
Tell a grown-up                             "Report this note" on a self-managed profile
```

- With no text the "From" line sits under the preset (frame B). With no open quest there is no primary: reading is the goal.
- **Reactions** are a radio group (`accessibilityRole="radiogroup"`, each pill `radio`): unpicked pills have a `border.strong` ring (decoration) and an empty radio dot (`border.shape`, 4.55:1); the picked pill has a filled `brand.primary` dot, a thick `brand.primary` border, a bold label and the `check` glyph at its end. The heart never fills or changes colour (glyph sheet rule). Picking announces `a11y.notes.reactionPicked(label)`; the pick can change, there is no "remove", nothing prompts a pick.
- **Closed quest** (frame D, F-ENT-003 `isQuestOpen` false): the card keeps its title and art with `learner.notes.detail.suggest.closed` ("Opens with the full route") and no button, no gate, no paywall link, no price. The art tile is the Journey quest row's 64 px square (`brand.primaryLight` with the `book` glyph in `brand.primaryDark` in the mock; FB-8 uses the quest's own Journey art).
- **Quest card name.** The **Start** button's accessible name is its visible label (`learner.notes.detail.suggest.start.cta`), so a voice-control user can say "tap Start" (WCAG 2.5.3); it is described by the quest title (`aria-describedby`, RN `accessibilityHint`). `a11y.notes.questCard(title)` names the card container (`aria-label` on the section, RN `accessibilityLabel` on the container view), never the button.
- **Quiet links**: `learner.notes.detail.putAway.cta` (no gate, local only; `accessibilityRole="button"` drawn as a quiet link, since it hides the note in place and navigates nowhere) and `learner.notes.detail.tellGrownUp.cta`, whose accessible name is `caregiver.audience.gated(label, true)` ("Tell a grown-up (PIN required)") because it opens `PinEntry { next: 'NoteReport', noteId }`. On a self-managed profile the link is `learner.notes.detail.reportSelf.cta` and opens the sheet directly (no gate wording). They are `touchTarget.min` tall, under a `border.subtle` rule, never coloured like a primary.

## States (board)

| State | Drawn |
|---|---|
| A, text and an open quest | page |
| B, preset only | yes, no primary |
| C, after a pick | yes |
| D, closed quest | yes |
| E, put away | `learner.notes.detail.putAwayDone` in a `surface.sunken` status line, then back to My notes; self-managed: `putAwayDoneSelf` |
| family note | `reactionSeenBy.family`; Korean text gets `lang="ko"` |
| class note in Encouragements only | the words are dropped and the line reads `reactionSeenBy.family` (the class sender gets no answer) |
| self-managed adult | `reportSelf`, `putAwayDoneSelf` |
| unknown preset | `common.notes.presetFallback` |
| quest not in this build | no quest card |
| gone (stale route, or taken away while open) | Hoya `idle`, `learner.notes.detail.gone`, `seeMyNotes.cta` |
| error | Hoya `idle`, `learner.notes.detail.error`, `retry.cta` |
| ko, es | A, and es after a pick |

## Measured

- First screen at 390 x 844 (`note-page-390-first.png`): the preset, the words and the "From" line are in view; the quest card starts above the fold.
- 320 at 200 % text: one column, no sideways scroll, the reactions wrap their labels inside the pill.

## Notes for FB-8

- **Open i18n item (ko).** `packages/i18n/src/messages/ko/caregiver.ts` has no `audience.gated` leaf, so the Korean accessible name of Tell a grown-up falls back to "어른에게 알리기 (PIN required)" (drawn as the runtime gives it). Add the ko leaf (`(base, pinRequired, detail) => ...` with `'PIN 필요'`, the same form as `es`) with a ko review entry before `ko` ships; if it has not landed when FB-8 is built, FB-8 adds it as an additive i18n line.

- Opening marks the note read (local first, queued). Telemetry without `profileId`: `notes.note_opened`, `notes.reaction_picked`, `notes.suggest_started`.
- A note whose free text mixes English and Hangul gets `lang="ko"` by section 6.11's rule (FB-7 `textLang`); the fixtures keep each text in one language.
