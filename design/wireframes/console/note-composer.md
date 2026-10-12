# Console / Note composer: send a short note to one student, a few, or the whole class (wireframe v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.1-6.4, §7.2, §7.3, §8.4, §9, §6.12 (console part)
Audience: **teacher** (class space) · **parent / family caregiver** (family space). Same component; the space kind sets the words ("students" / "learners") and whether "Sign as" shows.
Code: none yet. A section at the top of `/teach/space/notes?id=<spaceId>` and opened from the roster card button **Send a note** with that learner preselected (`&learner=<profile:...>`, an opaque id, never a name) (FB-11), behind `NEXT_PUBLIC_NOTES_ENABLED`.
Notation: `[[ X ]]` the one primary action, `( )` radio, `[ ]` checkbox, `<...>` live data.

All copy in boxes is placeholder (`console.notes`, `common.notes`, FB-5).

## Scenario (Given-When-Then)

Given: a teacher after class (or a grandparent at home) wants to encourage a learner
When: they open Send a note
Then: they pick who gets it, pick one encouragement, may add a few words and a quest, see a preview of what the learner will read, and send; the console says plainly what happened for each learner

## Screen goal

"Send one kind, short note to the right learners."

## Box diagram

### A. Composer (class space, one student preselected)

```
+--------------------------------------------------------------+
| [< back to class]   "Send a note"                            |
|                                                              |
|  1  To                                                       |
|     ( ) Everyone in <class name> (<n> students)              |
|     (•) Choose                                               |
|        [x] <display name>                                    |  <- anonymized when the class setting is on
|        [ ] <display name>                                    |
|        [ ] <display name>   "Notes are off for this student" |  <- disabled row, neutral
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
|  4  Suggest a quest (optional)                               |
|     [ choose a quest v ]  -> catalogue picker (stage / theme) |
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
|                                                              |
|  [[ Send ]]                                    [ Cancel ]    |
+--------------------------------------------------------------+
```

### B. Result line (replaces the Send row; focus moves here)

```
|  "Sent to 17 students."                                      |
|  "1 student has notes off. 1 student gets the encouragement  |
|   only."                                                     |  <- counts only, no names in a batch result
|  [ Send another ]          [ See sent notes ]                |  -> console/notes-sent
```

- The preset list is never ordered or filtered by a learner's progress; there is no "needs encouragement" hint (spec §9).
- Everyone resolves to the current students at send time.
- No price, plan or upgrade line: notes are free (OD-7).

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| To: Everyone / Choose | click / arrows | switches the picker; disabled rows cannot be checked |
| a preset | click / arrows | selects it; preview updates |
| text field | type | live check with the shared guard (`checkNoteText`); counter announced at 100 and 120; Enter does not add a line |
| quest picker | click | a list of catalogue quests by stage and theme; one pick; [ Remove ] clears it |
| Sign as | select | family label id; preview updates |
| Send | click / Enter on the button | `POST /api/spaces/:id/notes`; button busy "Sending…"; then B |
| Cancel | click | back to the roster, nothing sent |

## Navigation graph

Enter from: `console/roster` card button **Send a note** (learner preselected) · `console/notes-sent` [ New note ] · family space page **Send a note**
Exit to: `console/notes-sent` (See sent notes) · `console/roster` (back / Cancel)

## States

- **success**: A then B.
- **empty**: a space with no students: "No students yet. Share the join code first." and a link back to the roster; no form.
- **text problem**: the problem line under the field, the field marked invalid (not red: the standard form-error token used by the console), Send disabled. Lines (placeholder): link "Links can't be sent in a note." · contact "Email addresses, handles and phone numbers can't be sent in a note." · emoji "Please use words instead of emoji." · tone "Please choose a kinder word than "<word>"." · line break "Please keep the note to one line." · too long "Please keep it to 120 characters."
- **server problem**: `422 note_text` shows the same line (the Worker is the authority); `429 too_many` "You have sent many notes today. You can send more tomorrow."; `403 sending_paused` "Sending notes is paused for this account. Write to hello@hangulroute.com."; network "Could not send. Check your connection and try again." The form keeps its content.
- **all chosen learners skipped**: B reads "Nothing was sent. Notes are off or today's limit is reached for these students."
- **archived space**: the composer is replaced by "This class is archived."
- **loading**: recipients loading: a skeleton list; Send disabled.
- **flag off**: no composer, no roster button.
- **narrow window** (320-768): one column; the preview moves under the form; no sideways scroll.

## Data needs

- reads: `GET /api/spaces/:id/notes/recipients` (display names per the anonymize setting, notes mode, today's count); the catalogue (`packages/content-schema/src/catalog`) for the quest picker; dictionary presets in the console locale
- writes: `POST /api/spaces/:id/notes` with `NoteSendSchema` (`textLocale` = console locale)
- telemetry: none (the console has no telemetry client)

## Open questions

1. Should a teacher be able to save favourite presets? Default: no; the list is short enough.
2. Preview of the learner's own UI language: the console cannot know it. Default: preview in the adult's language with the explanatory line drawn above.
