# Console/Rename-inline — one-tap rename of a family, class or school, where its name is shown (wireframe v1)

> **New 2026-10-20 [SA]** (`docs/specs/AMENDMENTS-SEATS-ADMINS.md` sections 5.1 to 5.4, SA-D9; design row SA-0b). Built by SA-3 after SA-1 (the route `PATCH /api/spaces/:id/name`, `canRename`, `openMoves`). Mock: `design/screens/console/rename-inline.md`, `mock/rename-inline.html`.

Spec: `docs/specs/AMENDMENTS-SEATS-ADMINS.md` §5.1 (who may rename), §5.2 (route, `SpaceNameSchema`, `422 bad_name` / `archived`, `429`), §5.3 (console), §5.4 (propagation, the consent reset of an open move), §9.3 (strings)
Code today: no rename anywhere. A space gets its name once, at creation (`/start`, prefilled from the account name by `prefillName`); `PATCH /:id/settings` takes settings only.
Audience: **family owner** (family home, family page, family Settings), **class owner or teacher of the class** (class page, class Settings), **school owner or administrator** (school page title, each class row of the school page, school Settings). Caregivers, teachers of other classes and learners never see the button.

## Scenario (Given-When-Then)

Given: a grown-up who holds `space.rename` on a family, class or school (`canRename: true` in the page's response)
When: they press **Rename** next to the name
Then: the name turns into a text field in the same place, with Save and Cancel; Save shows the new name at once everywhere on the page, and every other grown-up and learner device gets it on their next load or sync

## Screen goal

"Fix a name in two taps, in the place where the name is read, without going to another page."

## Where the button sits

| Surface | URL | Name shown as | Rename placed | Shown when |
|---|---|---|---|---|
| Family home | `/parent` | each family section's heading (h2) | right of the heading (wraps under it on phones) | the viewer owns that family |
| Family page | `/parent/space?id=` | the page title (h1) | right of the title | owner |
| Class page | `/teach/space?id=` (class) | the page title (h1), the count on the line under it | right of the title | class owner, a teacher of the class, the school's owner or an administrator |
| School page | `/teach/space?id=` (school) | the page title (h1) | right of the title | school owner or administrator |
| School page, class rows | same | each row's class name | a **Rename** button beside **Open roster** | as for the class page |
| Settings | `/teach/space/settings?id=`, `/parent/space/settings?id=` | a new **Name** row, first block of the page | right of the name | as for that space |

Never on an archived space (the archived banner is shown instead; Settings says `console.rename.archived` in the Name row), never for a learner, never on the learner app.

## Box diagram

Class page, phone (375), closed:

```
+-----------------------------------+
| (AdultFrame: Teacher, Aa, Learner app)
| Classes | Lessons | Lecture | Billing
|-----------------------------------|
| < Back to Classes                 |  <- PageBack
| Sunday Class A        ( Rename )  |  <- h1 + secondary button, touchTarget.min; aria-label "Rename Sunday Class A"
| 12 students                       |  <- the count line, unchanged
| ...roster (unchanged)             |
+-----------------------------------+
```

Class page, open (Rename pressed):

```
+-----------------------------------+
| < Back to Classes                 |
| Name                              |  <- Field label (console.rename.label)
| [ Sunday Class A______________ ]  |  <- the current name, selected; HTML maxLength 120 (the 40 is checked after NFC)
| Students see this name in the app.|  <- console.rename.hint.class
| Some moves into or out of this    |  <- only when openMoves (console.rename.openMoves)
| space are waiting. A new name asks|
| their grown-ups to look at the    |
| move again.                       |
| (( Save ))  ( Cancel )            |  <- Save primary (disabled while unchanged or invalid)
| 12 students                       |
+-----------------------------------+
```

Wide (1280): the same field sits on the title's row at `layout.maxWidth.reading` (720 px) wide, the buttons to its right when they fit, else under it.

Family home heading and school class row:

```
 Kim family                      ( Rename )        <- family section heading (h2), family home
 +------------------------------------------------------------------+
 | Sunday Class B                                                    |  <- school page class row
 | Mr Lee · 10 students · active Tue                                 |
 | ( Change teacher )  ( Rename )  ( Open roster -> )                |
 +------------------------------------------------------------------+
   open: the row's name and line become the field, with the class hint
   (and openMoves when it applies), Save, Cancel; the row's other
   buttons step aside until Save or Cancel (one task per row)
```

Settings, first block:

```
 Name
  Sunday Class A                  ( Rename )
  archived:  Sunday Class A
             Unarchive it first to change the name.   <- console.rename.archived, no button
```

## Interaction points

- **Rename** → the field opens in place, the current name selected, focus in the field. The button is gone while the field is open.
- Typing → client validation with `SpaceNameSchema` (NFC, whitespace collapsed, trimmed): empty → `console.rename.empty`; longer than 40 → `console.rename.tooLong(40)`; no letter or digit (or a control or format character) → `console.rename.invalid`. The line sits under the field as its description. **Save** is disabled while the value is invalid or the same as the stored name (after normalizing).
- **Save** or Enter → the new name shows at once (optimistic) in the title, the frame's space switcher, the PageBack label (`s.back(name)`) of the pages under it and the tab title; the field closes; focus goes back to **Rename**, which stays `aria-disabled` with `aria-busy` until the `PATCH` settles (so a second rename cannot race the first); a polite live region says `console.rename.saved` once it settles.
- **Cancel** or Escape → the field closes with no change; focus back to **Rename**.
- **IME composition** (Korean, Japanese, Chinese and any other IME): Enter and Escape do nothing while `event.isComposing` is true (or `keyCode` is 229); Save reads the input's committed value after `compositionend`. The form's implicit submit is handled in the same keydown check, so a Hangul name is never saved without its last syllable.
- **Length**: the input's HTML `maxLength` is 120, not 40. It counts raw UTF-16 units before NFC, and a decomposed (NFD) Hangul paste, common from macOS file names, takes up to 3 units per syllable, so a cap of 40 would cut a valid name silently. `SpaceNameSchema` checks the 40 after NFC and the field shows `console.rename.tooLong(40)` for a longer name, typed or pasted.
- Save fails → the name the server last confirmed comes back (not merely the one shown before the click), the field reopens with the typed value and one line: `console.rename.failed` (any error), `caregiver.retry.offline` (offline), `console.rename.archived` (`422 archived`, the space was archived in another tab), `caregiver.retry.tooManyAttempts` (`429`). `422 bad_name` cannot reach the page (the client runs the same function) and reads as `failed`.
- `200 changed: false` (the same name after normalizing) → the field closes, nothing is announced.

## Navigation graph

Enter from: any of the six surfaces above (no new page, no URL change)
Exit to: the same page (the field closes in place)

## States

- **closed**: name + **Rename** (only with `canRename`).
- **open**: the field with the current name, the kind hint, the openMoves hint when `openMoves`, Save disabled until changed.
- **invalid**: one of `empty`, `tooLong`, `invalid` under the field; Save disabled.
- **saving**: the field has closed (optimistic) and the new name is in the title; **Rename** is `aria-disabled` and `aria-busy` until the `PATCH` settles; nothing else on the page waits.
- **saved**: the new name; `saved` in the live region (no visible toast).
- **failed**: the old name back, the field open with the typed value and the failure line.
- **archived**: no button on the page; the Settings Name row reads the name and `console.rename.archived`.
- **no right** (caregiver, a teacher of another class of the school, the space loaded without `canRename`): the name only, exactly as today.

## Data needs

- reads: `canRename`, `openMoves` on the roster, family and school responses (the school response per class row) (SA-1)
- writes: `PATCH /api/spaces/:id/name { name }` → `200 { space, changed }` · `404` · `403` · `422 bad_name { reason }` · `422 archived` · `429 too_many_attempts`
- telemetry: none from the page; the Worker sends `space.renamed { kind, role }` (codes only, never the name or a space id)

## Open questions

- None open for SA-3. Decisions taken in the mock (README "Decisions") are D1 to D6 of `design/screens/console/README.md`.
