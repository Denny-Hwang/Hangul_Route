# Console: the lock with Use a passkey, /account/pin-reset, the set-a-PIN card, the PIN-owner card (screen spec, OA-0b)

Spec: AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.2 (moment 3, amended by this pass), 7.4, 7.5, 7.6, 8.5, CS-9, CS-10, CS-17, 17.5 · wireframe `design/wireframes/profiles/console-pin.md` (new) and `pin-entry-v2.md` Panels D, E · mock `mock/console-pin.html` (boards 1 to 12) · shots `shots/console-pin-320.png`, `-1280.png`, `-320-text200.png` · base `design/screens/app-shell/grown-up-lock.md` · rows OA-3, OA-6

## GrownUpLock (boards 1 to 3)

The shipped card (lock glyph 48 `text.secondary`, **Grown-ups only**, the line for the marker, the 400 px button column). **Use a passkey** (`console.lock.passkey.cta`) is a secondary button under the last button, shown only when `isUserVerifyingPlatformAuthenticatorAvailable()` resolves true **and** the marker is read and is not `pin`. Since `none` and a browser without learner data open grown-up pages without the lock, that is the `nopin` lock (line `noPin`, board 1). A failed read, or a missing marker on a device with profiles (line `signInOnly`, board 2), may be a `pin` browser, so it shows no passkey (fail closed, spec 7.4, CS-17). On a `pin` browser the lock is unchanged (board 3).

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

- **Set a grown-up PIN** (board 9): on a `nopin` browser, the first persona home after a sign-in, once. `pinPromptSeen` is written once the card has been in view in a visible tab (an IntersectionObserver while `document.visibilityState` is `visible`) or when **Open the app** is pressed, never on a render nobody saw; so it needs no dismiss button. A paper card (`radii.lg`, `border.subtle`) with the lock glyph, `pinPrompt.body` and the secondary **Open the app** (`pinPrompt.cta`, to `/?gate=grown-up`).
- **Let this account reset the PIN here** (boards 10 to 12; D13): on the Family or Teacher home, only while the tab's `pin` unlock is under 2 minutes old, the marker is `pin` and this account is not the owner for the current epoch. `pinOwner.hint`, then the signed-in account (`console.adminInvite.signedInAs(who)`, the account's own email, `text.primary` semibold, so a grown-up handed off to the wrong account sees it), then the secondary `pinOwner.cta` and a quiet **Not now** (`pinOwner.notNow`, a quiet button, the lock's quiet style) under it. Not now closes the card for this unlock in this tab and writes nothing else (`sessionStorage` `pinOwnerOfferClosed`, the unlock's time only); the first navigation away from the persona home closes it the same way, so the offer never stays live on a page nobody watches, and a grown-up who sees a wrong account (a child's, CS-10) has a control to press. The card goes at once when the tab's unlock drops (the `hr-grownup` lock message, 5 minutes hidden, 15 idle minutes, sign out) or the 2 minutes run out; while Clerk reverification runs the button is `aria-disabled` and `aria-busy`; when it completes, the `pin` unlock's age and epoch are checked again, and a lapsed one writes nothing and removes the card; success replaces the card's content with the done status (`pinOwner.done`, `feedback.successLight`, check glyph) until the page is left. The two cards never show together (`nopin` against `pin`).

## Accessibility

Headings take focus as the lock does today (drawn as `h2` inside the board; the page's own `h1`). Buttons wrap at 200 % text and keep 64 px. Status lines are polite.
