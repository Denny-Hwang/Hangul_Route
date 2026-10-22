# People on this device (screen spec, OA-0b)

Spec: AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 8.2, 8.6, 10.4, OA-D5b, OA-D9, OA-D13, CS-12, CS-20, 17.4 · wireframe `design/wireframes/profiles/people-on-device.md` (Panels A to C2; Panels D and E are `who-is-joining.md`) · mock `mock/people-on-device.html` (boards 1 to 9) · shots `shots/people-on-device-320.png`, `-1280.png`, `-320-text200.png` · ConfirmSheet addendum `design/components/ConfirmSheet/spec.md` · rows OA-5, OA-7a, OA-9

Behind the gate. Lock, unlock and Remove ask a PIN, face or fingerprint entered within the last 2 minutes (`GROWN_UP_FRESH_PIN_MS`) before they act; the open session alone is not enough.

## Grown-up area, new top (boards 1, 2)

`ScreenHeader` (Back, Grown-up area, Aa); **Switch user** (`learner.who.switchUser`, full-width ghost; opens the chooser and ends the session); the **People on this device** card (`caregiver.people.title`): one row per learner (cub 40, name `size.body` semibold, the lock glyph for a locked profile, chevron; at least 64 high, `border.subtle` dividers; a locked profile's row is named `a11y.who.lockedRow(name)` "Sora, locked", because here a tap opens the person page without asking the PIN); on native with strong biometrics, the **Face or fingerprint for grown-ups** card (switch, off by default, and the warning `biometric.warning` as its hint). Everything after is unchanged (dashed box).

## One person (boards 3 to 5)

`ScreenHeader` with the learner's name; the lock card: **Lock with the grown-up PIN** (`people.lock`) with the switch and the hint `people.lockHint`; with no PIN the switch is disabled and the hint reads `caregiver.pin.needsPinFirst`, and **Remove from this device** is disabled the same way, with the same line as its description (board 4; spec 10.4, CS-12: Remove needs a fresh PIN, which a device without one cannot give); **Edit profile** (`learner.editProfile.title`); the learner's report row (unchanged); **Remove from this device** (`people.remove`), a full-width secondary paper button (`border.strong`), never red.

## Remove (boards 6 to 9)

| Board | Sheet | Actions, in order |
|---|---|---|
| 6 checking | `removeAsk(name)` and `checking` (`aria-busy`) | Cancel (focused) |
| 7 saved | `removeAsk(name)`, `removeSaved`, `spacesStay` (when the learner has memberships) | Cancel (focused), **Remove** (primary) |
| 8 unsaved | `removeAsk(name)`, `removeUnsaved`, `spacesStay` | **Save progress first** (primary), Cancel (focused), Remove anyway (quiet text) |
| 9 Remove anyway | `removeAnywayAsk` as the title | **Keep** (first, focused), **Remove** in `feedback.danger` |

`spacesStay` sits on the saved and unsaved sheets whenever the learner has memberships. Removing the active learner opens the chooser; removing the last learner opens Welcome.

## Accessibility

Switches are named by their label and announce on and off; the hint is their description. Rows and buttons are at least 64. Each ConfirmSheet (`role="alertdialog"`) is labelled by its title and described by its message lines (`aria-labelledby`, `aria-describedby`; native: the title is the sheet's accessibility label). The sheet traps focus and starts on its safe choice: **Cancel** on the checking, saved and unsaved sheets (never Save progress first, which leaves the sheet, and never Remove anyway, so no single activation from the opening focus removes anything), **Keep** on the Remove anyway step; the mock marks it with the focus ring. It returns focus to Remove from this device on Cancel or Keep. Danger is never the only cue: the word Remove and the question carry it.
