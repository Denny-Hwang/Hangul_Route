# Console / Note composer (screen spec v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` sections 6.1 to 6.4, 6.12 (console part), 6.13, 7.2, 7.3, 7.8, 8.4, 9 · wireframe `design/wireframes/console/note-composer.md`
Mock: `mock/composer.html` (class space, one student preselected, over the sent list), `mock/composer-states.html` (board)
Shots: `shots/composer-375.png`, `-1280.png`, `-320-text200.png`, `-390-first.png`, `composer-states-375.png`, `-1280.png`
Code (planned): **FB-11a**, the composer sub-view of the notes page (`&compose=1`), every word and check from FB-10 (`lib/console/notes.ts`: `recipientRows`, `presetGroups`, `textCounter`, `textProblem` / `noteTextMessage`, `composerCheck`, `notePreview`, `sendResultLines`, `sendProblem`, `questClosedLine`)

## Layout

A labelled dialog (`role="dialog"`, `aria-modal`, named by its title): from 45em a card of at most `layout.maxWidth.reading` over the dimmed list (`surface.overlay`, `shadows.modal`, `z.modal`); below 45em a full-height view on `surface.paper` with the list not rendered behind it. Escape, Close and Cancel drop `&compose=1` and return focus to the button that opened it.

```
Send a note                                           [ x ]   composer.title / composer.close
(1) To                                                        composer.to.title (fieldset)
   ( ) Everyone in Saturday Class B (18 students)             to.everyone.class(space, n)
   (•) Choose                                                 to.choose
     | Students                                               to.picker.class
     | [x] Mina Kim
     | [ ] Sora Lee   Notes are off for this student          disabled row, recipientRows line
     | [ ] Ben Cho    Encouragement only                      presets mode
     | [ ] Leo Han    3 notes today. You can send more tomorrow.   at the limit: disabled
(2) Pick an encouragement  Required                           preset.title, preset.required
   Effort / Progress / Next step / Warm                       groups.*: presetGroups(role), catalogue order
   ( ) You keep trying. That is how we learn.  ...
(3) Add a few words (optional)                                text.label
   [ Loved your reading in class today          ]
                                         33 of 120            text.counter, describes the field
(4) Suggest a quest (optional)                                quest.title
   [art] Meet o, u, m and the circle  ( Preview )  ( Remove )   or ( Choose a quest ); Preview: FB-15 only
(5) Sign as  [ Grandma v ]                                    family spaces only: signAs, familyLabels
Preview                                                       preview.title
┌ Your reading is getting stronger. ─────────┐
│ Loved your reading in class today           │
│ From Your teacher · Saturday Class B        │               preview.from(sender)
│ Try this quest: Meet o, u, m and the circle │               preview.quest(title)
└─────────────────────────────────────────────┘
The learner reads the encouragement in their own app language. ...   preview.language
Teachers see the answer a student picks. ...                         preview.disclosure (class only)
(        Send        )  (       Cancel       )                send.cta (one primary) / cancel.cta
```

- Step numbers are decoration (`aria-hidden`); the legends carry the names. Disabled picker rows are described by their line, so the reason is read.
- **Problems** sit under their field on `feedback.nudgeLight` with a `feedback.nudge` bar (decoration, 1.86:1) and `text.primary` words; the field gets `aria-invalid` and a thick `text.primary` border (16:1), never red. Send is `aria-disabled` (still focusable) and described by the problem, by `quest.needed` ("Needed for this encouragement") for `next_try_this` without a quest, or by the server line.
- **Preview (FB-15)**: a picked quest's row carries [ Preview ] between the title and Remove, only with All lessons on for the page (`browseLinksShown()`: `browseEnabled()` on the app origin) and the notes flag on. It is the F-BROWSE-001 BR-11 Preview pill of the plan rows and the report P1 slot (`BrowseLink`, `console.browse.preview.cta`, described by the quest title), opens `openBrowse({ kind: 'quest', id }, 'notes')` in the same tab ([ Close ] there returns to the composer), and a failed plan check or blocked storage shows BR-10's line under it. The link holds the quest id only.
- The closed-quest line (`composer.closedMark`) sits under a picked quest only with content gating on and an unlicensed space; never a price, a plan or a link.
- The presets are never ordered by progress and there is no "needs encouragement" hint; a report prefills the learner and maybe the quest, never the preset.

## States (board)

| State | Drawn |
|---|---|
| family space | Sign as, learners, `warm_learning_together` available (`warm_see_you_in_class` is not), no class disclosure |
| Everyone | the picker folds away |
| `next_try_this` without a quest | Send waits, `quest.needed` |
| closed-quest mark | yes |
| B, result | `sendResultLines`: "Sent to 17 students.", "1 student has notes off.", "1 student gets the encouragement only." in a `feedback.successLight` status block that takes focus; Send another / Done (Done is the primary) |
| all skipped | `result.nothing.class` |
| sending | `composer.sending` on the busy primary |
| loading recipients | skeleton rows, Send waits |
| text problem | the link line quoting the token |
| every guard line | link, contact, emoji, tone, line break, too long, invalid |
| server answers | badPreset, badSuggest, tooMany, wait, notInSpace, paused, notAllowedClass, sendingOff, network, generic |
| switch off | `errors.sendingOff` above Send |
| no students | `composer.empty.class` and `backToRoster.cta` |
| archived | `errors.archived.class` |

## Notes for FB-11a

- The counter is announced politely at 100 and at 120 (`counterAnnouncement`, `text.counterA11y`); after Send focus moves to the result block.
- The picker draws the API order, never a ranking; anonymized classes show initials (`rosterAlias`).
