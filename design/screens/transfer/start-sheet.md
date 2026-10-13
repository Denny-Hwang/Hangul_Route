# Start a move: the settings row and the start sheet (design mock v1, for T-6c)

Wireframe: `design/wireframes/console/class-transfer.md` screen 1 · spec 4.2 (matrix, guards 1 to 7), 4.8 (settings row, start sheet), 4.9 · mock: `mock/settings.html`, `mock/start-sheet.html`, `mock/start-sheet-states.html` · shots: `shots/settings-375.png`, `-1280.png`, `start-sheet-375.png`, `-1280.png`, `-320-text200.png`, `start-sheet-states-375.png`, `-1280.png`

No new URL: the sheet opens over `/teach/space/settings?id=<space id>`; the learner id travels in the POST body only.

## Settings learner row

```
 Class students (h2)
 +--------------------------------------------------+
 | (chip) Mina                                      |
 |        joined 3 weeks ago                        |
 |  ( Move to another class )  ( Remove from class )|   new button first; both secondary
 +--------------------------------------------------+
 ... Danger zone (unchanged, below): Move is never inside it
```

| Row | Shows |
|---|---|
| class row, live class, online | **Move to another class** before **Remove from class** |
| class row, offline | Move disabled, with "This needs internet." under the buttons as its `aria-describedby` |
| archived class | no Move (and, as today, no Remove); the page stays readable |
| family row, the learner is in a live class | **Move to a class**: opens the family page's start flow with the learner and that class chosen (`family-page.md`) |
| family row, the learner is in no live class | no Move |
| school row | never |

On phones the two buttons share a row and grow to fill it; from 45em the row is one line (name left, buttons right).

## Start sheet

```
 Move Mina to another class                    ( x )   h2 takes focus on open
 1. Ask the other teacher for their class code.
    Class code
    [  K 7 P M 4 Q  ]  (( Find class ))                 the shipped join field; Find class primary
    6 letters or numbers — no O, I, 0 or 1
    {error line, one sentence, role=alert}
 +------------------------------------------------+
 | 2. Move to "Saturday Class B"?                  |    name from the preview, never typed
 |  - The family is asked first. The other class   |
 |    sees nothing until the family says yes. Then |
 |    it sees only initials and a level until the  |
 |    move.                                        |
 |  - Nothing changes until everyone has said yes, |
 |    and then not for 2 days.                     |
 |  - Mina keeps cards and stars. You can cancel   |
 |    any time before the move.                    |
 +------------------------------------------------+
 (( Send request ))                ( Cancel )
```

- **One primary at a time.** Step 1: **Find class** is the primary. Step 2: **Send request** is, and Find class turns secondary (the code can still be edited; a new Find class replaces step 2).
- **The field** is the learner app's join field (`JoinSpaceScreen`): centred `size.display` bold text, `spacing.sm` tracking, `touchTarget.hero` tall, `borderWidth.base` `border.subtle`, `radii.lg`; label "Class code" (`console.space.codeLabel.class`), the rules line under it (the words of `caregiver.join.code.rules`), `autocomplete="off"`, paste fills, upper-case display. One input, never six boxes.
- **Step 2** reads only the preview (`POST …/transfer-requests/preview`, writes nothing). A teacher's preview shows the class name only. Send request creates the request for that exact `destinationSpaceId`.
- **Errors** sit under the field, in `text.primary` semibold, no colour, no icon, one sentence (`role="alert"`, and the field gets `aria-invalid` and `aria-describedby`):

| Answer | Line |
|---|---|
| `code_not_found`, `invalid_code` | "That code didn't work." |
| `code_expired` | "That code is too old. Ask for a new one." |
| `cap_class`, `cap_school` | "That class is full right now." |
| `already_member` | "{Name} is already in that class." |
| `too_many_attempts` | "Too many tries. Try again later." |
| `cannot_send` (teacher requests off, self-managed, 30-day rule) | "This request can't be sent right now." (one message, no reason, no days) |
| `family_needed` | "A family account is needed to answer this. Ask the family to start the move from their app." |
| `409 same_space` (the code of this class) | "That code is for the class {Name} is in now." |
| `409 already_open` | "{Name} already has a move waiting." (the teacher's answer never says who started it) |
| `409 destination_busy` | "That class has many moves waiting. Try again in a few days." |
| `429 too_many_requests` (10 creates per account or 3 per learner a day) | "Too many moves were started today. Try again tomorrow." |
| `422 not_transferable` (the code is not a live class) | "That code can't be used for a move." |
| `destination_changed` (the code now points elsewhere) | nothing is sent; the sheet runs Find class again with the same code and redraws step 2 from the new preview, or shows the matching line above |
| offline / network | "This needs internet." |

- **Busy.** While looking, the button reads "Looking…" (`aria-disabled`); while sending, "Sending…". A lost response is safe to repeat (idempotent create).
- **Sent.** The sheet closes and focus returns to the row's Move button; the settings page shows "Request sent. Nothing changes until everyone says yes." (`role="status"`, `feedback.successLight`) with **View** → the requests page.
- **Dialog rules.** `role="dialog"`, `aria-modal`, labelled by the heading; focus is trapped, Escape and the close button (`close` glyph, accessible name "Close") close it, focus returns to the opener. Below 45em the sheet fills the screen; from 45em it is a centred card at most `layout.maxWidth.reading` wide with `shadows.modal` over `surface.overlay`.

## Tokens

| Part | Tokens |
|---|---|
| Sheet | `surface.paper`; phone padding `spacing.lg` / `layout.gutter.compact`; wide `radii.lg`, padding `spacing.xl` `spacing.xxl`, `shadows.modal`, scrim `surface.overlay`, `z.modal` |
| Heading | `size.prompt` bold |
| Found block | `surface.canvas`, `borderWidth.thin` `border.subtle`, `radii.md`, padding `spacing.lg`; title `size.bodyLg` bold; bullets `text.secondary`, `leading.relaxed` |
| Row help | `size.bodySm` `text.secondary` |
| Done line | `feedback.successLight` fill, `text.primary`, `radii.md` |

## Accessibility

Each row's Move button carries the learner's name: `aria-label="Move {Name} to another class"` (family rows: "Move {Name} to a class"), so the visible label sits inside the name and a screen reader does not hear three identical buttons; the disabled offline button keeps the same name. Every button is at least 64 x 64; the close button is a 64 px circle. At 320 with 200 % text the field takes the full width, Find class wraps under it, and nothing scrolls sideways (`start-sheet-320-text200.png`).
