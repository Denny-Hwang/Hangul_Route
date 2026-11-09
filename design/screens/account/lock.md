# AccountGate, the account card, Sign out and the covers (screen spec, NS-0b)

Spec: F-AUTH-004 sections 6.6, 7.1 (Grown-up area row), 7.2, 7.3, 7.4, 10 (CS-N2, CS-N3, CS-N9, CS-N11, CS-N12), 14, 17.2 · wireframe `design/wireframes/account/native-lock.md` (Panels A to E) · mock `mock/lock.html` (boards 1 to 17), es and ko on `mock/lengths.html` rows 9 to 18, Largest `mock/largest.html` boards 3 and 5 · shots `shots/lock-320.png`, `-1280.png`, `-320-text200.png` · rows NS-3, NS-4

## The PIN before an account screen (board 1)

The shipped `PinEntry` in verify mode (`design/screens/profiles/pin-entry-v2.md`), `next: 'GrownUpUse'`, titled with the row's label (OA-0b D8), with **no Use face or fingerprint** button (ND-5, CS-N11; the struck-through box marks where it would sit). Close and Cancel return to the chooser or the Grown-up area. Forgot PIN? stays (Rescue Code and the 24-hour wait are local; the Sign in to the account reset card is hidden on native, OA-0b D11).

## Locked results (boards 2 to 7)

One screen: the `ScreenHeader` (Back, the title of the use the grown-up came for: `learner.who.use.*`, or **Grown-up account** for an entry with no use, Display) and one **lock card** (`surface.paper`, `border.subtle`, `radii.lg`, padding `spacing.xl` / `spacing.lg`): the lock glyph in a `surface.sunken` circle, the line (`text.primary`, relaxed leading) and the buttons full width (D6). No email, name, space or number anywhere.

| Board | Result | Line | Buttons |
|---|---|---|---|
| 2 | `unknown` | `caregiver.account.lock.cantCheck` | **Try again** (primary), **Back** (paper) |
| 3 | `nopin` | no card: PIN setup (`caregiver.audience.family.pinCreateTitle`) | — |
| 4 | `pin`, epoch `0` | `console.lock.pinRenew` | **Back** (paper) |
| 5 | no trust | `console.lock.firstSignIn` | **Sign in again** (`console.lock.signInAgain.cta`, primary) |
| 6 | other epoch | `console.lock.pinChanged` | **Sign in again** |
| 7 | re-trust by email code alone | `caregiver.account.lock.retrustPassword` | **Sign in again** |

## The Grown-up area account card (boards 8 to 14)

The first card of the native Grown-up area, after **Switch user** and before People on this device (D7). A `rn-card` with the heading **Grown-up account** (`caregiver.account.card.title`, `size.bodyLg` bold).

| Board | State | Content |
|---|---|---|
| 8 | signed out | `card.signedOut`, **Sign in** (`caregiver.account.signIn.submit.cta`, paper; through `AccountGate`) |
| 9 | signed in, trust matches, fresh proof (PIN typed or signed in within 2 min) | `console.adminInvite.signedInAs(email)` (semibold), one `GrownUpRow` per known use (each through `AccountGate`), `console.billing.help.sharedDevice` (`size.bodySm`, secondary), **Sign out** (paper) |
| 10 | signed in, trust matches, no fresh proof (face or fingerprint, or a PIN older than 2 min) | no email line; the use rows (each asks the typed PIN), the shared-device line, Sign out (D7, CS-N9) |
| 12b | signed in, fresh, no space | the email line, no use row, the shared-device line, Sign out |
| 11 | signed in, locked by the gate | the lock line and its button (here `pinChanged`, **Sign in again**, which asks the typed PIN before it signs out); no email |
| 12 | gate `unknown` | `lock.cantCheck`, **Try again**; no email |
| 13 | offline, signed out | Sign in `aria-disabled`, `needsInternet` as its description |
| 14 | offline, signed in | use rows `aria-disabled` with `needsInternet`; **Sign out** enabled (6.6) |

The card never shows on `nopin`: entering the Grown-up area there runs PIN setup first. On an `open` device the signed-in card lists the uses from this run's in-memory spaces query (no record is kept, ND-9); there is no PIN, so the email shows within the sign-in's 2 minutes only. Sign out never asks a PIN (it only deletes).

## Sign out (board 15)

The shipped ConfirmSheet: title `caregiver.account.signOut.ask`, no message, **Cancel** first and focused (paper with the focus ring), **Sign out** (`console.shell.signOut.cta`) as the primary fill. No `feedback.danger`: signing out loses nothing (D8).

## The covers (boards 16, 17)

Both covers draw the app's own splash: `app.json` `splash.image` (`assets/splash.png`, which carries the app name and its English tagline, as at launch) on `splash.backgroundColor` (`surface.canvas`), contain (D12). The iOS native cover is added in `applicationWillResignActive` while an account screen is focused; the JS cover is a `surface.canvas` view with the same image on `AppState` change; Android `FLAG_SECURE` makes the system blank the recents thumbnail and blocks screenshots. Covers are `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`. A decision on focus that locks an open home draws the cover, then the lock card (board 17).

## Accessibility

- Focus starts on the ScreenHeader title; the lock card is read title, line, buttons.
- The PIN keys keep the shipped names; no face or fingerprint control exists on this path.
- The ConfirmSheet is an alert dialog labelled by its title, traps focus, starts on Cancel and returns focus to Sign out.
- Disabled card controls stay in the reading order with their reason as the description.
