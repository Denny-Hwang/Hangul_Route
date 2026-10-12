# Billing/Receipts — every recorded payment of one space (wireframe v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.10, §5.3 (`GET /api/billing/receipts`)
Screen ID: `billing/receipts` · URL: `https://app.hangulroute.com/billing/receipts?id=<spaceId>` (opaque id; never a name in the URL)
Audience: **payers of the space only** (family owner, class owner, school owner or school admin). Co-parents and teachers never reach it (403 → the page shows the not-yours state).

## Scenario (Given-When-Then)

Given: a payer who needs proof of a payment (an expense claim, a school office, a question about a charge)
When: they open All receipts from a card on Billing
Then: they see each payment, renewal, refund and failed payment with its date and amount, and can open Stripe's receipt or invoice

## Screen goal

"Find a payment and open its receipt."

## Box diagram

Phone (list):

```
+--------------------------------------------+
| [< Billing]   <space name> · receipts      |
| ( Test mode: no real card is charged. )    |
|                                            |
|  +--------------------------------------+  |
|  | <date>               Renewal         |  |
|  | Group License        <amount>        |  |
|  | [ View receipt ]  (opens Stripe)     |  |
|  +--------------------------------------+  |
|  +--------------------------------------+  |
|  | <date>       Payment didn't go through|  |  <- plain text, no red, no icon of failure
|  | Group License        <amount>        |  |
|  | [ View receipt ]                     |  |
|  +--------------------------------------+  |
|  +--------------------------------------+  |
|  | <date>               Payment  (test) |  |  <- "test" pill when recorded in test mode
|  | Family Lifetime · one payment        |  |
|  |                      <amount>        |  |
|  | [ View receipt ]                     |  |
|  +--------------------------------------+  |
|                                            |
|  Older receipts: see Stripe's emails or    |  <- only past 50 rows
|  write to us.                              |
+--------------------------------------------+
```

Wide (table, same data):

```
| Date   | What                         | Plan            | Amount   |               |
|--------|------------------------------|-----------------|----------|---------------|
| <date> | Renewal                      | Group License   | <amount> | View receipt  |
| <date> | Payment didn't go through    | Group License   | <amount> | View receipt  |
| <date> | Refund                       | Family Lifetime | <amount> | View receipt  |
```

Inline variant on `billing/billing-home` (inside a payer card, `> Receipts` open): the latest 3 rows in the list form, then `[ All receipts ]` when there are more.

## Interaction points

- `[ View receipt ]` → Stripe-hosted invoice (licence) or charge receipt (lifetime) in a new tab; for a lifetime payment whose link is not known yet, the Worker fetches and caches it on this request
- `[< Billing]` → `billing/billing-home`

## Navigation graph

Enter from: `billing/billing-home` (All receipts on a payer card)
Exit to: Stripe receipt or invoice page (external, new tab) · `billing/billing-home`

## States

- **loading**: title, three row outlines.
- **success**: as drawn, newest first, at most 50 rows.
- **empty, no plan ever bought**: "No receipts yet."
- **empty, active Stripe plan bought before history began**: "Older payments are in the receipt email from Stripe."
- **receipt link unknown** (Stripe did not answer): the row shows no button; the rest of the row stays.
- **not yours** (403) or **unknown space** (404): "This page is for the person who pays for this space." + `[ Back to Billing ]`.
- **error**: "Can't load receipts right now." + `[ Try again ]`.

## Data needs

- reads: `GET /api/billing/receipts?id=<spaceId>` → `{ spaceName, receipts: ReceiptView[] }` (date, kind, plan, amount, currency, receipt URL or null, livemode)
- reads: the space name for the title comes in the same response (`spaceName`); no extra request
- writes: none (the Worker may cache a receipt URL server-side)
- telemetry: Worker-side `billing.receipts_viewed { rows }`

## Open questions

- Download all receipts as one file for a school office? Default: no; Stripe's invoice pages each have a PDF download.
