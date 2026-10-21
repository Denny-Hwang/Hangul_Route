# Profiles/PIN-entry v2 — longer pauses, reset by signing in, face or fingerprint (wireframe v1)

Spec: `docs/specs/AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` section 8 (rows OA-2, OA-6, OA-9) · extends `profiles/pin-entry.md` (layout, dots, pad and Forgot PIN? unchanged)
Audience: **grown-up** (it is also the screen a child meets, so it shows nothing about anyone)
Route: learner app `PinEntry` (modal) and `PinReset`; console `/account/pin-reset`
Mock: `design/screens/profiles/pin-entry-v2.md` (row OA-0b)

## Scenario (Given-When-Then)

Given: a family tablet with a grown-up PIN
When: someone types wrong PINs again and again, or the grown-up has forgotten the PIN
Then: the pauses grow calmly (30 s, 1 min, 5 min, 15 min, then 60 min), face or fingerprint and the Rescue Code (its own counter) still work during a pause, and on the web the grown-up can sign in to the account to choose a new PIN

## Screen goal

"Prove a grown-up is here, calmly." No red, no "failed", no countdown that shames.

## Box diagram

Panel A — verify, native, face or fingerprint turned on for this device

```
+--------------------------------+
| [x Close]  Grown-up area       |
|                                |
| Enter your 4-digit PIN.        |
|  ( Use face or fingerprint )   |  <- above the pad; cancel or failure leaves the pad, not a miss
|        o  o  o  o              |
|   [1] [2] [3]                  |
|   [4] [5] [6]                  |
|   [7] [8] [9]                  |
|       [0] [<]                  |
|  Forgot PIN?                   |
+--------------------------------+
```

Panel B — third pause (5 min) and later, Grown-up area destination (the help line is never shown on a locked tile, a Family/Teacher/School row or Cancel the wait)

```
|        o  o  o  o              |
| Let's take a short break.      |  <- polite live region, updated once a minute
| Try again in 5 min.            |
| You can also set a new PIN     |  <- from the 3rd pause on
| with Forgot PIN?               |
|   (pad disabled)               |
|  ( Use face or fingerprint )   |  <- native, when on: still works during a pause; success resets the steps
|  Forgot PIN?                   |  <- stays enabled during every pause; the Rescue Code has its own counter
```

Panel C — Forgot PIN? on the web, online (PinReset)

```
+--------------------------------+
| [< Back] Reset the PIN         |
| Your learners, cards and       |
| progress stay.                 |
|--------------------------------|
| Sign in to the account         |  <- web, online, flag on; first option
| Sign in as the grown-up who    |
| uses this device. Then choose  |
| a new PIN.                     |
| [[ Sign in ]]                  |  -> /signin?next=/account/pin-reset
|--------------------------------|
| Use a Rescue Code   (existing; |
|   own counter, works during a  |
|   PIN pause)                   |
|--------------------------------|
| Wait 24 hours       (existing) |
+--------------------------------+
```

Panel D — console `/account/pin-reset`, checks passed

```
+--------------------------------+
| New grown-up PIN               |
| Opening the app so you can     |
| choose a new PIN.              |  -> /?gate=pin-reset (ticket in sessionStorage, 2 min)
+--------------------------------+
```

Panel E — console `/account/pin-reset`, refused (one line, chosen by cause)

```
| New grown-up PIN               |
| one of:                        |
|  - This works after a grown-up |
|    has opened the grown-up     |
|    pages here with the PIN...  |  (no PIN owner for this PIN)
|  - Only the grown-up account   |
|    that last used this PIN     |
|    here can do this...         |  (another account)
|  - This device has no grown-up |
|    PIN to reset.               |  (marker not `pin`)
| [ Back to learning ]           |
```

Panel F — learner app after the ticket: `PinEntry` setup-1, title **Choose a new grown-up PIN**; an expired or reused ticket shows instead "That took a while. Sign in again to set a new PIN." over the normal start.

## Interaction points

- Wrong PIN: the existing "tries left" line; the 5th miss in 60 s starts the next pause step (`pin.paused { step }`).
- Correct PIN, face or fingerprint, or a finished reset: steps go back to the first.
- Use face or fingerprint: reads the SecureStore item, so the system prompt runs with no passcode fallback; an enrolment change since it was turned on shows "Face or fingerprint changed on this device. Enter the PIN." and turns it off.
- Sign in to the account: password, email code or phone code only (never a passkey).

## States

- verify, setup-1, setup-2 (existing) · pause steps 1 to 5 · reset choice (web online / web offline / native) · console reset page: going, refused (3 lines) · ticket expired.

## Accessibility

- The pad stays for anyone who cannot use face or fingerprint. Pause lines are a polite live region. Disabled pad keys keep their names and say "paused".
