# Account/Native-lock — AccountGate's locked results, the PIN before an account screen, the Grown-up area account card, Sign out and the covers (wireframe v1)

Spec: `docs/specs/F-AUTH-004-native-sign-in.md` sections 6.6, 7.1 (third row), 7.2, 7.3, 7.4, 10 (CS-N2, CS-N3, CS-N11, CS-N12), 14, 17.2 (rows NS-3, NS-4)
Audience: **grown-up**; every panel sits inside the Grown-up area stack, but a child may be holding the device, so a locked panel shows no email, name or account data
Route: `AccountGate` wraps every account route (`AccountHome`, `AccountSpace`, `AccountLearnerReport`, `AccountClassReport`, `AccountSchool`, `SignIn`); `PinEntry { next: 'GrownUpUse', use }`; `ParentDashboard` (the account card); the ConfirmSheet
Mock: `design/screens/account/lock.md` (`mock/lock.html`, boards 1 to 17) (row NS-0b)

## Scenario (Given-When-Then)

Given: a family tablet where the parent signed in last week, and a child who since set a new grown-up PIN through the 24-hour wait
When: the child taps **Family** on the chooser and types the new PIN
Then: the gate shows "The grown-up PIN changed on this device. Sign in again to use it." with **Sign in again**, and nothing of the account; the parent's next sign-in with the email code alone still shows the lock until the password is used (accepted risk R-1)

## Screen goal

"Prove you are the grown-up, every time it matters." A typed PIN within 2 minutes, a matching trust epoch, and nothing of the account shown before both.

## Box diagram

Panel A — the PIN before an account screen (freshness, ND-5)

```
| (x) Close   Family        ( Aa)|  <- titled with the row label (OA-0b D8)
| Enter your 4-digit PIN to      |
| continue.                      |
|  - - - - - - - - - - - - - - - |  <- NO "Use face or fingerprint" here (CS-N11)
|          o  o  o  o            |
|      [1] [2] [3]               |
|      [4] [5] [6]               |  <- shipped PinPad
|      [7] [8] [9]               |
|          [0] [<]               |
| (          Unlock            ) |
| (          Cancel            ) |  <- back to the chooser (or the Grown-up area), never a learner
| (        Forgot PIN?         ) |
```

Panel B — a locked result (one card under the ScreenHeader)

```
| < Back   Family           ( Aa)|  <- the use the grown-up came for
| +----------------------------+ |
| | (lock)                     | |
| | The grown-up PIN changed   | |  <- the result's line, text.primary
| | on this device. Sign in    | |
| | again to use it.           | |
| | (     Sign in again      ) | |  <- primary: signs out on this device, then SignIn
| +----------------------------+ |
```

| Gate result | Line | Buttons |
|---|---|---|
| `unknown` | `caregiver.account.lock.cantCheck` | **Try again** (primary), **Back** |
| `nopin` | no card: the Grown-up area destination runs PIN setup | — |
| `pin`, epoch `0` | `console.lock.pinRenew` | **Back** |
| `pin`, signed in, no trust | `console.lock.firstSignIn` | **Sign in again** |
| `pin`, signed in, other epoch | `console.lock.pinChanged` | **Sign in again** |
| re-trust by email code alone | `caregiver.account.lock.retrustPassword` | **Sign in again** |

Panel C — Grown-up area, the account card (first card on native)

```
| < Back   Grown-up area    ( Aa)|
| (        Switch user         ) |
| +----------------------------+ |
| | Grown-up account           | |  <- signed out
| | Sign in to see your family,| |
| | classes and school here.   | |
| | (        Sign in         ) | |  <- paper secondary; through AccountGate
| +----------------------------+ |
| - People on this device ...  - |  <- unchanged
```

```
| | Grown-up account           | |  <- signed in, past the gate
| | Signed in as               | |
| | dana@example.com           | |  <- only here and only past the gate (CS-N9)
| | [L] Family               > | |  <- one row per known use, each through AccountGate
| | [L] Teacher              > | |
| | On a shared device? Sign   | |
| | out when you are done.     | |
| | (        Sign out        ) | |
```

```
| | Grown-up account           | |  <- signed in, locked by the gate: the lock line and its button, no email
| | The grown-up PIN changed   | |
| | on this device. Sign in    | |
| | again to use it.           | |
| | (     Sign in again      ) | |
```

Offline: **Sign in** and the use rows are aria-disabled with **Needs the internet**; **Sign out** stays enabled (spec 6.6).

Panel D — Sign out (ConfirmSheet)

```
|################################|  <- overlay
| Sign out of this account on    |
| this device?                   |
| [         Cancel           ]   |  <- first and focused
| (        Sign out          )   |  <- primary, no red (nothing is lost)
```

Panel E — the covers (CS-N12)

```
+--------------------------------+
|                                |
|            (Hoya)              |  <- the app's own splash (app.json splash.image on splash.backgroundColor):
|         Hangul Route           |     the iOS native cover in the app-switcher snapshot and the JS cover on
|                                |     AppState change; Android FLAG_SECURE blanks the recents thumbnail itself
+--------------------------------+
```

A focus or `active` decision that locks an open home draws the cover first, then Panel B: the home's content is never visible in between.

## Interaction points

- AccountGate decides on mount, on every focus and on every return of `AppState` to `active` (the table above, spec 7.2); each locked result emits `auth.native.lock { cause }` once per mount.
- Unlock (Panel A): a typed PIN within `GROWN_UP_FRESH_PIN_MS` opens the use's account screen, which the gate then decides; Cancel returns to the chooser or the Grown-up area, never a learner.
- Sign in again: signs out on this device (Clerk `signOut()`, every `hr.clerk` key, the uses and trust records, the account queries), emits `auth.native.signout { via: 'lock' }`, then opens SignIn.
- Try again (`unknown`): reads the stores again and decides again; Back: pops to where the grown-up came from.
- Card Sign in and use rows: through AccountGate (the fresh PIN of Panel A on a `pin` device); Sign out: the ConfirmSheet; Sign out (confirmed): as Sign in again, then the Grown-up area (or Welcome when the device has no learner profile), `auth.native.signout { via: 'user' }`.

## Entry and exit

Enter from: `profiles/who-is-using` (rows) · `parent/dashboard` (the account card) · any account screen (a focus or `active` decision)
Exit to: `account/sign-in` (Sign in again, card Sign in) · `account/home` (an open result) · PIN setup (`nopin`) · back (Back, Cancel)

## States

- Gate: every row of the Panel B table, and the open results (the use's home).
- Card: signed out · signed in (uses known; no use) · locked (each lock line) · `unknown` · offline signed out · offline signed in. Never shown on `nopin`: entering the Grown-up area there runs PIN setup first.
- Sheet: Sign out (Cancel focused).
- Covers: app switcher (iOS native cover, JS cover), recents (Android FLAG_SECURE), a lock decided on focus.

## Data needs

- Reads: `nativeGateState()` (exact reads, never the in-memory marker), whether a Clerk session exists, the trust record `hr:grownup:trust` (a failed or unparsable read is no trust), `ui-store.lastPinTypedAt` and `lastAccountSignInAt`, `account:pinResetByWait` (the re-trust rule), online state.
- Writes: none on a locked result; Sign out and Sign in again delete the records, the Clerk items and the account queries.

## Open questions

- None open. The card with no use row, the lock screen titled with the use, Sign out without the danger colour and the splash as the cover are D6 to D8 and D12 in `design/screens/account/README.md`.

## Accessibility

- A lock card is a group named by the screen title; its line is read before its buttons; focus starts on the ScreenHeader title.
- The PIN keys keep the shipped `a11y.pinDigit` / `a11y.pinDelete` names; the dots read `a11y.pinDots`.
- The ConfirmSheet traps focus, starts on Cancel and returns focus to Sign out on Cancel.
- The covers are `accessibilityElementsHidden` and never announced; no motion beyond the stack's default.
