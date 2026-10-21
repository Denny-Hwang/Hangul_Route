# Inline rename: family, class and school names, where they are shown (design mock v1, for SA-3)

Wireframe: `design/wireframes/console/rename-inline.md` · spec `docs/specs/AMENDMENTS-SEATS-ADMINS.md` sections 5.1 to 5.4, 9.3 · mock: `mock/rename-inline.html` (27 boards) · shots: `shots/rename-inline-320.png`, `-1280.png`, `-320-text200.png`

No new URL. The field opens in place on the page that shows the name.

## Anatomy

Closed (boards 1, 8, 9, 16, 19, 20, 22, 24):

```
 < Back to Classes
 Sunday Class A            ( Rename )     h1 (size.title) + secondary button (size.bodySm, touchTarget.min)
 18 students                              the existing line under the title, text.secondary
```

- `.title-row`: flex, wrap, `spacing.md` between the title and the button, `spacing.xs` between rows; on a narrow phone with a long name the button wraps under the title, left-aligned.
- Rename's accessible name is `console.rename.a11y(name)` ("Rename Sunday Class A"); the school's uses the school's name, not the title's " · school".

Open (boards 2 to 7, 10 to 13, 17, 21, 23, 25):

```
 Name                                      label, semibold (console.rename.label)
 [ Sunday Class A                ] (Save) (Cancel)   from a 36rem column: buttons right of the input
 {error line}                               only when invalid or failed
 Students see this name in the app.         console.rename.hint[kind], text.secondary, size.bodySm
 [ Some moves into or out of this space ... ]  console.rename.openMoves, only when openMoves (sunken box)
 18 students
```

Narrower than 36rem (phones, a class row): label, input, the error line, the hints, then Save and Cancel side by side.

| Part | Tokens |
|---|---|
| input | `touchTarget.min` tall, `size.bodyLg` bold, padding `spacing.sm` / `spacing.md`, `radii.md`, `borderWidth.base` `border.shape` on `surface.paper`; read-only while saving: `surface.sunken` |
| invalid input | `borderWidth.thick` `text.primary` (no colour change of meaning) |
| error line | `text.primary` semibold, `leading.relaxed`; first in `aria-describedby` |
| hint | `text.secondary`, `size.bodySm`, `leading.relaxed` |
| openMoves line | `surface.sunken`, `radii.md`, padding `spacing.sm` / `spacing.md`, `text.primary`, `size.bodySm` |
| Save | primary (`brand.primary`, `text.onPrimary`); `aria-disabled="true"` while unchanged or invalid: `surface.sunken`, `text.muted` |
| Cancel | secondary |

## Per surface

| Board | Surface | Notes |
|---|---|---|
| 1, 2 | class page `/teach/space?id=` | with the adult frame; the field replaces the h1, the count line stays under it |
| 3 | class page, `openMoves` | the second hint (an open move would ask its guardian again, section 5.4) |
| 16, 17, 18 | family home `/parent` | Rename right of each family's h2; family hint; none for a caregiver |
| 19, 15 | family page `/parent/space?id=` | owner: Rename; caregiver: the title only |
| 20, 21 | school page title | school hint; the field holds the name only, " · school" comes back after Save |
| 22, 23 | school page class rows | Rename between the teacher button and Open roster; open: the row's buttons step aside (D6); none on an archived row |
| 24, 25, 26 | Settings Name block (first on the page) | heading "Name"; archived: the name and `console.rename.archived`, no button |
| 27 | `/start` name step | unchanged prefill; `console.start.nameLater` under the field |

## States

| Board | State | Drawn |
|---|---|---|
| 2 | open, unchanged | Save aria-disabled |
| 4 | typing | Save enabled |
| 5, 6, 7 | invalid | `empty`, `tooLong(40)`, `invalid` |
| 8 | saving | the field closed at once (optimistic), the new name in the title; **Rename** `aria-disabled` and `aria-busy` until the `PATCH` settles |
| 9 | saved | the new name in the title; the live region (drawn visibly as a board note) says `console.rename.saved` |
| 10 | failed | the last name the server confirmed back in the title, field reopened with the typed value, `console.rename.failed` |
| 11 | offline | `caregiver.retry.offline` |
| 12 | 429 | `caregiver.retry.tooManyAttempts` |
| 13 | 422 archived | `console.rename.archived`, Save unavailable |
| 14 | archived space | no Rename on the page |
| 15, 18 | no right | the name only |

## Behaviour

- **Rename** → the field opens, the value selected, focus in the input.
- **Enter** saves when Save is enabled; **Escape** cancels; either way the field closes and focus returns to Rename (on a class row, the row's Rename).
- **IME**: Enter and Escape are ignored while `event.isComposing` is true (or `keyCode` is 229), and Save reads the committed value after `compositionend`, so a Hangul name pressed Enter on mid-syllable is neither saved clipped nor cancelled.
- **Save** → optimistic: the title, the frame's space switcher, the PageBack labels of the pages under it (`settings.back(name)` and the other `s.back(name)`) and the browser tab title change at once; `PATCH /api/spaces/:id/name`; Rename stays `aria-disabled` and `aria-busy` until it settles (board 8); on failure the name the server last confirmed comes back and the field reopens (boards 10 to 13).
- `200 changed: false` closes the field silently.
- The client normalizes with `SpaceNameSchema` before comparing and sending (NFC, whitespace collapsed, trimmed), so "Sunday  Class A " is unchanged.

## Accessibility

- The field is a labelled `input` (`maxlength` 120: room for a decomposed Hangul paste; the 40 is checked after NFC and shown as `tooLong(40)`, board 6) inside a `form`; its description lists the error line (when any), the kind hint and the openMoves line, in that order.
- One polite live region per page (`role="status"`) announces `saved`; the failure lines are in the field's description and the focus stays in the field, so they are read without an alert.
- `aria-invalid="true"` only for the client checks (`empty`, `tooLong`, `invalid`, boards 5 to 7). A server or network failure (boards 10 to 13) leaves the value valid: its line is only in `aria-describedby`, so a screen reader never says "invalid entry" for it.
- Every control is at least `touchTarget.min` tall; at 320 px with 200 % text nothing scrolls sideways (a long value scrolls inside the input, as any text input does; titles wrap with `overflow-wrap: anywhere`).
- Contrast: see the README.
