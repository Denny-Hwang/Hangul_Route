# Profiles/Console-PIN — the console side of the grown-up PIN: Use a passkey, the reset page, the set-a-PIN card, the PIN-owner card (wireframe v1)

Spec: `docs/specs/AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` sections 7.2, 7.4, 7.5, 7.6, 8.5, 17.5 (rows OA-3, OA-6) · extends `shell/grown-up-lock.md` (Panel A and B unchanged) · the reset page's lines are also Panels D and E of `profiles/pin-entry-v2.md`
Audience: **grown-up** (app.hangulroute.com; the lock and the reset page are also what a child meets on a shared computer, so they show no name, no email and no number)
Routes: the console lock (`GrownUpLock`, every grown-up page), `/account/pin-reset`, the persona homes (`/parent`, `/teach`)
Mock: `design/screens/profiles/console-pin.md` (row OA-0b)

## Scenario (Given-When-Then)

Given: a parent who just entered the grown-up PIN in the learner app and arrived on the family home in the same tab
When: they choose to let this account reset the PIN, and weeks later forget the PIN
Then: on the web they sign in to the same account and choose a new PIN, while a child's own account can never do it

## Screen goal

"Let the right grown-up back in, and never let a child's account in." Every line is calm; nothing names an account.

## Box diagram

Panel A — the lock on a browser whose marker is not `pin`, where a platform authenticator is offered

```
 [< Back to learning]
 +----------------------------------+
 |            [lock]                |
 |         Grown-ups only           |
 |  Set a grown-up PIN in the app,  |  <- the existing line for the marker (noPin, signInOnly)
 |  or sign in again.               |
 |  [[ Sign in again        ]]      |
 |  [  Use a passkey        ]       |  <- only when isUserVerifyingPlatformAuthenticatorAvailable() and marker != pin
 +----------------------------------+
```

On a `pin` browser the lock is unchanged (Use the grown-up PIN, Sign in again); no Use a passkey.

Panel B — `/account/pin-reset` (no frame; the lock's single paper card)

```
 +----------------------------------+
 |  New grown-up PIN                |
 |  one line, chosen by the checks: |
 |   going      -> no button, then /?gate=pin-reset
 |   notOwner   -> [ Back to learning ]
 |   firstSignIn-> [ Back to learning ]
 |   noPin      -> [ Back to learning ]
 |   unavailable-> [ Back to learning ]  (flag off, storage unreadable)
 +----------------------------------+
```

Panel C — a persona home on a `nopin` browser, the first one after a sign-in (once per browser, `pinPromptSeen`)

```
 | (adult frame, home title: unchanged)        |
 | +-----------------------------------------+ |
 | | [lock] Set a grown-up PIN in the app so | |
 | |        only grown-ups open these pages. | |
 | | [ Open the app ]                        | |  -> /?gate=grown-up (runs setup)
 | +-----------------------------------------+ |
 | (home cards: unchanged)                     |
```

Panel D — a persona home in a tab whose PIN hand-off is under 2 minutes old, for an account that is not yet the PIN owner (section 7.2 moment 3)

```
 | +-----------------------------------------+ |
 | | If the grown-up PIN is forgotten,       | |
 | | signing in to this account can set a    | |
 | | new one on this device.                 | |
 | | [ Let this account reset the PIN here ] | |  -> Clerk reverification (password, email or phone code)
 | +-----------------------------------------+ |
 |  then:  [check] Done. This account can reset the PIN here.
```

## Interaction points

- Use a passkey: Clerk reverification with the passkey first factor; success writes the `signin` unlock and opens the page; a refusal returns to the lock with its existing line.
- `/account/pin-reset`: the checks of spec section 8.5 step 3 decide the line; nothing is written on a refusal; going writes the ticket and leaves.
- Open the app: `/?gate=grown-up`; the card is marked seen when it first renders, so it never shows twice in this browser.
- Let this account reset the PIN here: reverification (never a passkey); success writes `pinOwner` and shows the done line until the page is left.

## Entry and exit

Enter from: any grown-up page (the lock) · `/signin?next=/account/pin-reset` (the reset leg) · the persona homes (the two cards)
Exit to: the grown-up page that was locked · `/?gate=pin-reset` · the learner app (Back to learning, Open the app)

## States

- Lock: marker `pin` (no passkey) · `nopin` / absent / unreadable with the passkey when offered · passkey refused (the existing line).
- Reset page: going · notOwner · firstSignIn · noPin · unavailable.
- Set-a-PIN card: shown once on `nopin` · never on `pin` or `none`.
- PIN-owner card: offer · reverifying · done · hidden (no fresh hand-off, already owner, flag off, marker not `pin`).

## Data needs

- Reads: the device gate marker and its `pinEpoch` (`hr-shell`), `pinOwner` and `pinPromptSeen` (`hr-shell` / `kv`), the tab's grown-up unlock (`hr:grownup:unlock`, its kind and `at`), the signed-in account's id (fingerprinted, never shown), `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`.
- Writes: the `signin` unlock (passkey), the ticket `hr:shell:pinReset` (going only), `pinOwner` (done only), `pinPromptSeen` (`true`). No API call.

## Open questions

- None open: the spec's section 7.2 moment 3 named an Account page that does not exist at `a384759ca`; this design pass puts the offer on the persona homes (decision D13 in `design/screens/profiles/README.md`, spec section 7.2 amended in OA-0b).

## Accessibility

- The lock's heading takes focus (unchanged). The reset page's going line is a polite status. The done line is a polite status with a check glyph that is decoration. Buttons are at least `touchTarget.min` and wrap their words at 200 % text.
