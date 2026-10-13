# Console / Note composer: send a short note to one student, a few, or the whole class (wireframe v2)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.1-6.4, §6.13, §7.2, §7.3, §7.8, §8.4, §9, §6.12 (console part)
Audience: **teacher** (class space) · **family owner or a caregiver the owner allowed** (family space). Same component; the space kind sets the words ("students" / "learners") and whether "Sign as" shows.
Code: none yet. A **sub-view** of the notes page, never inline: `ROUTES.spaceNotes(id, kind, { compose: true, learner?, quest? })` = `/teach/space/notes?id=<classId>&compose=1` or `/parent/space/notes?id=<familyId>&compose=1` on app.hangulroute.com (FB-11a), behind `NEXT_PUBLIC_NOTES_ENABLED`. A modal dialog on wide windows, a full-height view on narrow ones. `learner` is an opaque `profile:` id, never a name.
Notation: `[[ X ]]` the one primary action, `( )` radio, `[ ]` checkbox, `<...>` live data.

All copy in boxes is placeholder (`console.notes`, `common.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a teacher after class (or a grandparent at home, or a parent reading a report) wants to encourage a learner
When: they press Send a note
Then: the composer opens on its own; they pick who gets it, pick one encouragement, may add a few words and a quest, see a preview of what the learner will read, and send; the console says plainly what happened; closing returns to the list they came from

## Screen goal

"Send one kind, short note to the right learners."

## Box diagram

### A. Composer (class space, one student preselected)

```
+--------------------------------------------------------------+
| "Send a note"                                     [ × close ]|  <- dialog title; Escape closes
|                                                              |
|  1  To                                                       |
|     ( ) Everyone in <class name> (<n> students)              |
|     (•) Choose                                               |
|        [x] <display name>                                    |  <- anonymized when the class setting is on
|        [ ] <display name>                                    |
|        [ ] <display name>   "Notes are off for this student" |  <- disabled row, neutral (mode off OR a family block; same words)
|        [ ] <display name>   "Encouragement only"             |  <- presets mode: text will not show
|        [ ] <display name>   "3 notes today"                  |  <- limit reached: disabled
|                                                              |
|  2  Pick an encouragement            (required)              |
|     ( ) You keep trying. That is how we learn.               |  <- in the adult's console language
|     ( ) Your reading is getting stronger.                    |
|     ( ) ... 13 more, grouped: Effort / Progress / Next step / Warm |
|                                                              |
|  3  Add a few words (optional)                               |
|     [ one-line text field                         ] 37 / 120 |
|     (problem line appears here, linked to the field)         |
|                                                              |
|  4  Suggest a quest (optional; needed for "Try this quest next") |
|     [ choose a quest v ]  -> catalogue picker (stage / theme) |
|       <quest title>  [ Preview ]*                            |  <- * FB-15, only after F-BROWSE-001 BR-10
|       "Some learners can open this lesson only with the      |  <- only with gating on and an unlicensed space
|        full route."                                          |
|                                                              |
|  5  Sign as          (family spaces only)                    |
|     [ Your family v ]  Mom · Dad · Grandma · Grandpa · ...   |
|                                                              |
|  Preview (what the learner reads)                            |
|  +--------------------------------------------------------+  |
|  | "Your reading is getting stronger."                    |  |
|  | "<your words>"                                         |  |
|  | From Your teacher · <class name>                        |  |
|  | Try this quest: <quest title>                          |  |
|  +--------------------------------------------------------+  |
|  "The learner reads the encouragement in their own app      |
|   language. Your words show as you typed them."             |
|  "Teachers see the answer a student picks. They do not see  |  <- class spaces only (§7.7)
|   when a note was read."                                    |
|                                                              |
|  [[ Send ]]                                    [ Cancel ]    |
+--------------------------------------------------------------+
```

### B. Result line (replaces the Send row; focus moves here)

```
|  "Sent to 17 students."                                      |
|  "1 student has notes off. 1 student gets the encouragement  |
|   only."                                                     |  <- counts only, no names in a batch result
|  [ Send another ]          [ Done ]                          |  -> Done closes the sub-view to the sent list
```

- The preset list is never ordered or filtered by a learner's progress; there is no "needs encouragement" hint (spec §9). Opened from a report, the learner and maybe a quest are prefilled; the preset never is.
- "Try this quest next" (`next_try_this`) keeps Send disabled until a quest is picked, with "Needed for this encouragement" under step 4.
- The closed-quest line never names a price or a plan and never links to billing; the learner's own device decides what opens (F-ENT-003).
- Everyone resolves to the current students at send time.
- No price, plan or upgrade line: notes are free (OD-7).

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| To: Everyone / Choose | click / arrows | switches the picker; disabled rows cannot be checked |
| a preset | click / arrows | selects it; preview updates; `next_try_this` marks step 4 as needed |
| text field | type | live check with the shared guard (`checkNoteText`, `@hangul-route/i18n/note-text`); counter announced at 100 and 120; Enter does not add a line |
| quest picker | click | a list of catalogue quests by stage and theme; one pick; [ Remove ] clears it; closed-quest line per F-ENT-003 `freeRouteQuestIds` when `contentGatingEnabled()` and the space is unlicensed |
| Preview (FB-15) | click | `openBrowse({ kind: 'quest', id }, 'notes')` (F-BROWSE-001): the lesson exactly as a learner sees it, in the same tab (F-BROWSE-001 section 4.3; [ Close ] returns to the composer) |
| Sign as | select | family label id; preview updates |
| Send | click / Enter on the button | `POST /api/spaces/:id/notes`; button busy "Sending…"; then B |
| Cancel / × / Escape | click / key | closes the sub-view (URL drops `&compose=1`); nothing sent; focus returns to the button that opened it |

## Navigation graph

Enter from: `console/notes-sent` [ New note ] · `console/roster` card **Send a note** (learner preselected) · `console/family-notes` **Send a note** · parent home learner card **Send a note** (F-APP-001) · learner report action slot **Send a note** (F-REPORT-001 §3.6; `&quest=` from a P1 line)
Exit to: the notes page it opened over (`console/notes-sent` or `console/family-notes`)

## States

- **success**: A then B.
- **empty**: a space with no students: "No students yet. Share the join code first." and a link back to the roster; no form.
- **text problem**: the problem line under the field, the field marked invalid (not red: the standard form-error token used by the console), Send disabled. Lines (placeholder): link "Links can't be sent in a note ("<word>")." · contact "Email addresses, handles and phone numbers can't be sent in a note." · emoji "Please use words instead of emoji." · tone "Please choose a kinder word than "<word>"." · line break "Please keep the note to one line." · too long "Please keep it to 120 characters."
- **server problem**: `422 note_text` shows the same line (the Worker is the authority); `422 bad_preset` "Pick a quest for this encouragement."; `429 too_many` "You have sent many notes today. You can send more tomorrow."; `403 sending_paused` "Sending notes is paused for this account. Write to hello@hangulroute.com."; `403 not_allowed` in a family "The family owner can let you send notes."; `404` while the Worker switch is off "Sending notes is not open yet."; network "Could not send. Check your connection and try again." The form keeps its content.
- **all chosen learners skipped**: B reads "Nothing was sent. Notes are off or today's limit is reached for these students."
- **archived space**: the composer is replaced by "This class is archived."
- **loading**: recipients loading: a skeleton list; Send disabled.
- **flag off**: no composer, no entry buttons.
- **narrow window** (320-768): full-height view, one column; the preview moves under the form; no sideways scroll.

## Data needs

- reads: `GET /api/spaces/:id/notes/recipients` (display names per the anonymize setting, notes mode, today's count); the catalogue (`packages/content-schema/src/catalog`) for the quest picker; `freeRouteQuestIds` and the space's licence (`unlockedStagesForSpace`) for the closed-quest line; dictionary presets in the console locale
- writes: `POST /api/spaces/:id/notes` with `NoteSendSchema` (`textLocale` = console locale)
- telemetry: none (the console has no telemetry client)

## Open questions

1. Should a teacher be able to save favourite presets? Default: no; the list is short enough.
2. Preview of the learner's own UI language: the console cannot know it. Default: preview in the adult's language with the explanatory line drawn above.
