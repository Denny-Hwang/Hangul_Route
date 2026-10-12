# Billing/Step-up — confirm it's you before money moves or a receipt opens (wireframe v2)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.4 (OD-7), §4.10, §4.12, §9
Screen ID: `billing/step-up` (a dialog over `billing/billing-home` or `billing/receipts`)
Audience: **parent**, **teacher**, **school admin**, **adult self-learner** on a device that may be shared with a learner (the billing page lives on the learner app's host)

## Scenario (Given-When-Then)

Given: a grown-up session whose last sign-in check is more than 10 minutes old (or whose token does not say)
When: someone presses a buy button, Manage subscription or View receipt
Then: they are asked to confirm it's them before Stripe opens, so a learner using a still-signed-in device cannot start a payment, change a plan or read the payer's receipt details

## Screen goal

"Confirm the grown-up before a payment, a plan change or a receipt, with one way forward and one way out."

## Box diagram

```
+-----------------------------------+
| (page behind is dimmed and inert) |
|  +-----------------------------+  |
|  | Confirm it's you            |  |  <- dialog title (h2)
|  |                             |  |
|  | Before a payment, a plan    |  |
|  | change or a receipt, sign   |  |
|  | in again.                   |  |
|  | This keeps payments safe on |  |  <- reason line
|  | a shared device.            |  |
|  |                             |  |
|  | [[ CONTINUE ]]              |  |  <- opens Clerk reverification
|  | [ Not now ]                 |  |  <- closes, nothing happens
|  +-----------------------------+  |
+-----------------------------------+
```

After `[[ CONTINUE ]]`: Clerk's own reverification UI (password, code or provider, whatever the account uses). On success the original action runs once (checkout, portal or receipt link); on cancel the dialog closes.

```
after cancel or failure (one line on the page)
| Nothing was changed. |

Clerk unreachable, or the retry is refused again
|  Can't confirm right now. Try again in a moment.  |
|  [ Not now ]                                       |
```

## Interaction points

- The Worker answers `403` with Clerk's reverification hint (and our code `reverify_required`) → this dialog
- `[[ CONTINUE ]]` → Clerk reverification → on success, retry the refused action **once** → Stripe
- Retry refused again → the unavailable line; no second prompt, no loop
- `[ Not now ]` or Escape → close; focus returns to the button that was pressed; "Nothing was changed."
- A sign-in completed in this tab less than 10 minutes ago never shows this dialog

## Navigation graph

Enter from: `billing/billing-home` (any buy button, Manage subscription) · `billing/receipts` (View receipt)
Exit to: Stripe Checkout / Portal / receipt page (external) · back to the page it opened over

## States

- **asking**: as drawn.
- **verifying**: Clerk's UI is open; the dialog's buttons are disabled.
- **success**: dialog closes; the action proceeds (no extra message).
- **cancelled / failed**: dialog closes; "Nothing was changed." on the page.
- **unavailable** (Clerk unreachable, offline, or refused after one retry): "Can't confirm right now. Try again in a moment." + `[ Not now ]`.

## Data needs

- reads: the Worker's `403` reverification hint; Clerk's `useReverification` (client)
- writes: none of ours
- telemetry: Worker-side `billing.checkout_refused { reason: 'reverify_required' }`

## Open questions

- 10 minutes is the default window; shorten for schools? Default: one window for everyone.
