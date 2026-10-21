# Console: the lock with Use a passkey, /account/pin-reset, the set-a-PIN card, the PIN-owner card (screen spec, OA-0b)

Spec: AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.2 (moment 3, amended by this pass), 7.4, 7.5, 7.6, 8.5, CS-9, CS-10, CS-17, 17.5 · wireframe `design/wireframes/profiles/console-pin.md` (new) and `pin-entry-v2.md` Panels D, E · mock `mock/console-pin.html` (boards 1 to 12) · shots `shots/console-pin-320.png`, `-1280.png`, `-320-text200.png` · base `design/screens/app-shell/grown-up-lock.md` · rows OA-3, OA-6

## GrownUpLock (boards 1 to 3)

The shipped card (lock glyph 48 `text.secondary`, **Grown-ups only**, the line for the marker, the 400 px button column). **Use a passkey** (`console.lock.passkey.cta`) is a secondary button under the last button, shown only when `isUserVerifyingPlatformAuthenticatorAvailable()` resolves true **and** the marker is not `pin` (`nopin`, absent or unreadable: lines `noPin`, `signInOnly`). On a `pin` browser the lock is unchanged.

## /account/pin-reset (boards 4 to 8)

The lock's single paper card, no frame: **New grown-up PIN** (`console.pinReset.title`) and one line:

| Board | Line | Button |
|---|---|---|
| 4 checks passed | `pinReset.going` (polite status) | none; the page writes the ticket and leaves for `/?gate=pin-reset` |
| 5 another account | `pinReset.notOwner` | Back to learning |
| 6 no owner for this PIN | `pinReset.firstSignIn` | Back to learning |
| 7 marker not `pin` | `pinReset.noPin` | Back to learning |
| 8 flag off, storage unreadable | `pinReset.unavailable` | Back to learning |

No name, email, account or number appears; the page title is the same in every state.

## Persona home cards (boards 9 to 12)

- **Set a grown-up PIN** (board 9): on a `nopin` browser, the first persona home after a sign-in, once (`pinPromptSeen` written when it first renders, so it has no dismiss button). A paper card (`radii.lg`, `border.subtle`) with the lock glyph, `pinPrompt.body` and the secondary **Open the app** (`pinPrompt.cta`, to `/?gate=grown-up`).
- **Let this account reset the PIN here** (boards 10 to 12; D13): on the Family or Teacher home, only while the tab's `pin` unlock is under 2 minutes old, the marker is `pin` and this account is not the owner for the current epoch. `pinOwner.hint` and the secondary `pinOwner.cta`; while Clerk reverification runs the button is `aria-disabled` and `aria-busy`; success replaces both with the done status (`pinOwner.done`, `feedback.successLight`, check glyph) until the page is left. The two cards never show together (`nopin` against `pin`).

## Accessibility

Headings take focus as the lock does today (drawn as `h2` inside the board; the page's own `h1`). Buttons wrap at 200 % text and keep 64 px. Status lines are polite.
