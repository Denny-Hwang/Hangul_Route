# Grown-up PIN v2 (screen spec, OA-0b)

Spec: AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 8.2 to 8.6, CS-8, CS-13, CS-18, CS-21, 17.3 · wireframe `design/wireframes/profiles/pin-entry-v2.md` (Panels A to F) · mock `mock/pin-entry-v2.html` (boards 1 to 12) · shots `shots/pin-entry-v2-320.png`, `-1280.png`, `-320-text200.png` · rows OA-2, OA-6, OA-9

The shipped `PinEntryScreen` layout stays: `ScreenHeader` (Close, the title inline, Aa), the subtitle block (whose place a hint or a pause line takes, polite live region), four dots (`brand.primary`), the 3 x 4 pad (keys `touchTarget.child` on a phone, `size.prompt` bold), **Unlock** (primary, `aria-disabled` until four digits), **Cancel** and **Forgot PIN?** (ghost: `brand.primary` outline and text).

## What changes

| Piece | Drawn | Key |
|---|---|---|
| Title per destination | Grown-up area (zone name), Family / Teacher / School / Sign in as a grown-up, the learner's name (locked tile), Cancel the wait, Choose a new grown-up PIN | existing, `learner.who.use.*`, `learner.who.resetCancel`, `caregiver.pin.reset.signIn.newPinTitle` |
| Pause, under a minute | Let's take a short break. Try again in 30s. | `caregiver.pin.cooldown(seconds)` (existing) |
| Pause, a minute or more | Let's take a short break. Try again in 5 min. | `cooldownMinutes(n)`; updated once a minute |
| Help line | You can also set a new PIN with Forgot PIN? | `cooldownHelp`; Grown-up area destination only, from the 3rd pause |
| Face or fingerprint | full-width secondary button above the dots (native, when on) | `biometric.cta` |
| Enrolment changed | the line in the subtitle's place; the button gone | `biometric.changed` |
| Reset choice (web, online, flag on) | first card: Sign in to the account, caption, primary Sign in | `reset.signIn.heading`, `.caption`, `.button` |
| After the ticket | setup-1 titled Choose a new grown-up PIN, no Forgot PIN? | `reset.signIn.newPinTitle` |
| Ticket refused | an info notice over the normal start | `reset.signIn.expired` |
| Reset by the wait | an info notice at the top of the Grown-up area with primary Change PIN | `resetByWaitNotice`, `resetByWaitChange` |

## Boards

1 verify with face or fingerprint · 2 pause 30 s · 3 pause 5 min on the Grown-up area (help line, face or fingerprint enabled, Forgot PIN? enabled) · 4 pause 60 min on a locked tile (no help line) · 5 pause 15 min on a Family row (no help line) · 6 enrolment changed · 7 reset choice on the web, online · 8 reset choice offline or native (no sign-in card) · 9 Choose a new grown-up PIN · 10 expired ticket over the chooser · 11 reset-by-wait notice · 12 Cancel the wait.

## Rules the boards fix

- During a pause the keys are `aria-disabled` and keep their names with ", paused"; Unlock is disabled; Cancel, Forgot PIN? and Use face or fingerprint stay enabled (no hard lock, OA-D7).
- Never red, never "failed", never a count of tries during a pause; the existing "tries left" line before a pause is unchanged.
- The help line never appears on `LockedProfile`, `GrownUpUse` or `CancelReset` (CS-21).
- On 320 with 200 % text the header's title keeps 8rem and the Aa control wraps under it; the pad keeps 80 px keys (264 of 288).

## Tokens

Lines `text.secondary` (7.97 on canvas), pause line `size.bodySm` semibold, help `size.bodySm` regular; secondary button `brand.secondary` with `text.onSecondary` (5.20); notices `feedback.infoLight` with `text.primary` (12.69); cards `surface.paper` `radii.lg` `shadows.card`.
