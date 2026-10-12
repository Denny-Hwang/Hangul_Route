# Billing/Step-up — confirm it's you before money moves (wireframe v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.4 (OD-7), §9
Screen ID: `billing/step-up` (a dialog over `billing/billing-home`)
Audience: **parent**, **teacher**, **school admin** on a device that may be shared with a learner (the billing page now lives on the learner app's host)

## Scenario (Given-When-Then)

Given: a grown-up session that signed in more than 10 minutes ago
When: someone presses a buy button or Manage subscription
Then: they are asked to sign in again before Stripe opens, so a learner using a still-signed-in device cannot start a payment or change a plan

## Screen goal

"Confirm the grown-up before a payment or a plan change, with one way forward and one way out."

## Box diagram

```
+--------------------------------------------+
|  (page behind is dimmed and inert)         |
|   +------------------------------------+   |
|   |  Confirm it's you                  |   |  <- dialog title (h2)
|   |                                    |   |
|   |  Before a payment or a plan        |   |
|   |  change, sign in again.            |   |
|   |                                    |   |
|   |  [[ CONTINUE ]]                    |   |  <- opens Clerk reverification
|   |  [ Not now ]                       |   |  <- closes, nothing happens
|   +------------------------------------+   |
+--------------------------------------------+
```

After `[[ CONTINUE ]]`: Clerk's own reverification UI (password, code or provider, whatever the account uses). On success the original action runs once (checkout or portal); on cancel the dialog closes.

## Interaction points

- `[[ CONTINUE ]]` → Clerk reverification → on success, retry the action that was refused (`403 reverify_required`) once → Stripe
- `[ Not now ]` or Escape → close; focus returns to the button that was pressed
- Reverification fails or is cancelled → close with the one-line note "Nothing was changed."

## Navigation graph

Enter from: `billing/billing-home` (any buy button, Manage subscription) when the Worker answers `reverify_required`, or before the call when the client already knows the sign-in is older than 10 minutes
Exit to: Stripe Checkout / Portal (external) · `billing/billing-home`

## States

- **asking**: as drawn.
- **verifying**: Clerk's UI is open; the dialog's buttons are disabled.
- **success**: dialog closes; the action proceeds (no extra message).
- **cancelled / failed**: dialog closes; "Nothing was changed." on the page.
- **error** (Clerk unavailable): "Can't confirm right now. Try again in a moment." + `[ Not now ]`.

## Data needs

- reads: the Clerk session (client) and the Worker's `403 reverify_required` answer
- writes: none of ours
- telemetry: Worker-side `billing.checkout_refused { reason: 'reverify_required' }`

## Open questions

- 10 minutes is the default window; shorten for schools? Default: one window for everyone.
