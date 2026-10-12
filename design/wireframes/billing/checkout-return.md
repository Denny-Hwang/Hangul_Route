# Billing/Checkout return — waiting honestly for the payment to land (wireframe v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.5
Screen ID: `billing/checkout-return` (a state of `billing/billing-home`, drawn separately because it has its own flow)
URL on arrival: `https://app.hangulroute.com/billing?checkout=success&plan=<planKey>&id=<spaceId>` or `?checkout=cancel` (the query is removed from the address bar right after it is read)
Audience: **parent**, **teacher**, **school admin** (the payer who just left for Stripe)

## Scenario (Given-When-Then)

Given: a payer finished or left Stripe Checkout
When: Stripe sends them back to Billing before or after our webhook has run
Then: the page says plainly what it knows (checking, active, still processing, nothing charged) and never claims an active plan before the server confirms it

## Screen goal

"Tell the payer the true state of the purchase and land them on the card that changed."

## Box diagram

```
+--------------------------------------------+
| [< grown-up home]   Billing     [lang] [out]|
| ( Test mode: no real card is charged. )    |
|                                            |
| +----------------------------------------+ |
| | (spinner glyph)  Almost there:         | |  <- state: checking (live region, polite)
| |                  checking your plan.   | |
| +----------------------------------------+ |
|                                            |
|  Your plans                                |
|  +--------------------------------------+  |
|  | Family · <space name>                |  |  <- the card for <spaceId>, highlighted
|  | Free plan  ->  (updates when ready)  |  |     by an outline only, not by colour alone
|  +--------------------------------------+  |
|  ... other cards unchanged ...             |
+--------------------------------------------+

state: done
| (check glyph) Thank you. The plan is active.        |
|               Learners see it on their next sync.   |   focus -> the card heading
| Family · <space name> | Family Lifetime · yours for good |

state: still processing (after 10 checks, about 20 seconds)
| Your payment went through. The plan shows here in a minute. |
| [ Check again ]                                              |

state: cancelled
| Nothing was charged. |                        (cards as before; no highlight)
```

## Interaction points

- On arrival: read `checkout`, `plan`, `id` → remove them from the address bar (`history.replaceState`) → start the state
- checking: poll the billing summary every 2 seconds, at most 10 times; stop as soon as the card for `id` shows `plan` active
- `[ Check again ]` → one more round of up to 10 checks
- The notice has no close button; it disappears on the next navigation

## Navigation graph

Enter from: Stripe Checkout success or cancel (external)
Exit to: `billing/billing-home` (the same page, notice gone after navigation) · `billing/receipts` (from the card) · SHELL grown-up home

## States

- **checking**: as drawn; buttons on the highlighted card are disabled while checking.
- **done**: success line; focus on the card heading; buttons enabled.
- **still processing**: neutral line + `[ Check again ]`; no error tone (the webhook is late, not failed).
- **cancelled**: "Nothing was charged."
- **done-unknown** (an older return without `plan` / `id`): reload the summary once, show the success line.
- **error** (the summary request itself fails while checking): "Can't check your plan right now." + `[ Try again ]`; the payment line is not repeated (we do not know).

## Data needs

- reads: `GET /api/billing/summary` (polled)
- writes: none
- telemetry: none from the page; the Worker records `billing.checkout_completed` when the webhook applies

## Open questions

- Should "still processing" also show the Stripe receipt email hint? Default: no; one line is enough, and the receipt appears in Receipts once recorded.
