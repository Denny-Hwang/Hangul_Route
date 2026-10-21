# Billing/Checkout return — waiting honestly for the payment to land (wireframe v2)

> **Amended 2026-10-20 [SA]** (`docs/specs/AMENDMENTS-SEATS-ADMINS.md`): a family holds up to **4** learners (was 5); the Group License covers up to **50** students in a class or a school (was no cap for a class and 300 for a school). Only the numbers on this page changed; the new rename and administrator surfaces get their own wireframes and mocks in row SA-0b.

> **Amended 2026-10-11 [BY]** (`docs/specs/AMENDMENTS-BILLING-FAMILY-YEARLY.md`): the family product is the **Family Plan**, $15.30 / year, renews yearly, cancel any time (was the one-time "Family Lifetime"). Lines below are updated.

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.5, §4.12
Screen ID: `billing/checkout-return` (a state of `billing/billing-home`, drawn separately because it has its own flow)
URL on arrival: `https://app.hangulroute.com/account/billing?checkout=success&plan=<planKey>&id=<spaceId>` or `?checkout=cancel` (the query is removed from the address bar right after it is read; the id is opaque, never a name)
Audience: **parent**, **teacher**, **school admin**, **adult self-learner** (the payer who just left for Stripe)

## Scenario (Given-When-Then)

Given: a payer finished or left Stripe Checkout
When: Stripe sends them back to Billing before or after our webhook has run, online or with a flaky connection
Then: the page says plainly what it knows (checking, active, still processing, offline, nothing charged), never claims an active plan before the server confirms it, and shows the next step when the plan has no learner yet

## Screen goal

"Tell the payer the true state of the purchase and land them on the card that changed."

## Box diagram

```
+-----------------------------------+
| (F-APP-001 AdultFrame)            |
| Billing                           |
| ( Test mode: no real card is      |
|   charged. )                      |
|                                   |
| +-------------------------------+ |
| | (spinner glyph) Almost there: | |  <- state: checking (live region, polite)
| |  checking your plan.          | |
| +-------------------------------+ |
|                                   |
| Your plans                        |
| +-------------------------------+ |
| | Family · <space name>         | |  <- the card for <spaceId>, marked by an
| | Free plan                     | |     outline only, not by colour alone; it
| |                               | |     updates in place; buttons disabled
| +-------------------------------+ |
| ... other cards unchanged ...     |
+-----------------------------------+
```

```
state: done
| (check glyph) Thank you. The plan is active.                 |
|   Learners get it the next time they open Hangul Route.      |   focus -> the card heading
| Family · <space name> | Family Plan · Renews on <date>       |

state: done, family with no learner yet (next step on the card)
| Family · <space name> | Family Plan · Renews on <date> | 0 of 4 learners |
| Next: connect a learner to this family.                      |
| [ Connect a learner ]                                         |   -> F-APP-001 family page (join code)

state: still processing (after 10 checks, about 20 seconds online)
| Your payment went through. The plan shows here in a minute.  |
| [ Check again ]                                               |

state: offline (connection dropped while checking)
| You're offline. Plans and receipts need a connection.        |
| [ Try again ]                                                 |   checks pause; they resume by themselves when back online

state: error (a check failed while online)
| Can't check your plan right now.                              |
| [ Try again ]                                                 |

state: cancelled
| Nothing was charged. |                        (cards as before; no highlight)
```

## Interaction points

- On arrival: read `checkout`, `plan`, `id` → remove them from the address bar (`history.replaceState`) → start the state
- checking: poll the billing summary (`?poll=1`) every 2 seconds, at most 10 times; stop as soon as the card for `id` shows `plan` active
- `offline` event → pause, keep the count of attempts; `online` event → resume
- `[ Check again ]` → one more round of up to 10 checks
- `[ Try again ]` (offline or error) → resume checking
- `[ Connect a learner ]` → `/parent/space?id=<spaceId>`
- The notice has no close button; it disappears on the next navigation

## Navigation graph

Enter from: Stripe Checkout success or cancel (external)
Exit to: `billing/billing-home` (the same page, notice gone after navigation) · `billing/receipts` (from the card) · F-APP-001 family page (Connect a learner) · persona home (frame)

## States

- **checking**: as drawn; buttons on the marked card are disabled while checking.
- **done**: success line; focus on the card heading; buttons enabled; next step when the family has no learner.
- **still processing**: neutral line + `[ Check again ]`; no error tone (the webhook is late, not failed).
- **offline**: offline line + `[ Try again ]`; attempts are not used up while offline.
- **error**: "Can't check your plan right now." + `[ Try again ]`; the payment line is not repeated (we do not know).
- **cancelled**: "Nothing was charged."
- **done-unknown** (an older return without `plan` / `id`): reload the summary once, show the done line.

## Data needs

- reads: `GET /api/billing/summary?poll=1` (polled)
- writes: none
- telemetry: none from the page; the Worker records `billing.checkout_completed` when the webhook applies (and skips `billing.summary_viewed` for polls)

## Open questions

- Should "still processing" also show the Stripe receipt email hint? Default: no; one line is enough, and the payment appears in Receipts once recorded.
