# Billing/Receipts — every recorded payment of one space (wireframe v2)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` §4.10, §4.12, §5.3 (`GET /api/billing/receipts`, `POST /api/billing/receipt-link`)
Screen ID: `billing/receipts` · URL: `https://app.hangulroute.com/account/billing/receipts?id=<spaceId>` (`BILLING_RECEIPTS_PATH`; opaque id, never a name in the URL)
Audience: **payers of the space only** (family owner, class owner, school owner or school admin, adult self-learner who owns their family). Co-parents and teachers never reach it (403 → the not-yours state).

## Scenario (Given-When-Then)

Given: a payer who needs proof of a payment (an expense claim, a school office, a question about a charge)
When: they open All receipts from a card on Billing
Then: they see each payment, renewal, refund and failed payment with its date and amount, and after confirming it's them can open Stripe's receipt or invoice

## Screen goal

"Find a payment and open its receipt."

## Box diagram

Phone (list):

```
+-----------------------------------+
| (F-APP-001 AdultFrame)            |
| [< Back to Billing]               |
| <space name> · receipts           |  <- h1
| ( Test mode: no real card is      |
|   charged. )                      |
|                                   |
| +-------------------------------+ |
| | <date>              Renewal   | |
| | Group License       <amount>  | |
| | [ View receipt ]              | |  <- a11y: "View receipt from <date> (opens Stripe in a new tab)"
| +-------------------------------+ |
| +-------------------------------+ |
| | <date>  Payment didn't go     | |  <- plain text, no red, no failure icon
| |         through               | |
| | Group License       <amount>  | |
| | [ View receipt ]              | |
| +-------------------------------+ |
| +-------------------------------+ |
| | <date>       Payment  (test)  | |  <- "test" pill when recorded in test mode
| | Family Lifetime · one payment | |
| |                     <amount>  | |
| | [ View receipt ]              | |
| |   Can't open this receipt     | |  <- only after a failed lookup, on that row
| |   right now.                  | |
| +-------------------------------+ |
|                                   |
| Older receipts: see Stripe's      |  <- only past 50 rows
| emails or write to us.            |
+-----------------------------------+
```

Wide (table, same data; caption "Receipts", date is the row header):

```
| Date   | What                         | Plan            | Amount   |               |
|--------|------------------------------|-----------------|----------|---------------|
| <date> | Renewal                      | Group License   | <amount> | View receipt  |
| <date> | Payment didn't go through    | Group License   | <amount> | View receipt  |
| <date> | Refund                       | Family Lifetime | <amount> | View receipt  |
```

Inline variant on `billing/billing-home` (inside a payer card, `> Receipts` open): the latest 3 rows in the list form **without** View receipt, then `[ All receipts ]`.

## Interaction points

- `[ View receipt ]` → opens a blank tab at once (not blocked as a pop-up) → `POST /api/billing/receipt-link { id }` → `billing/step-up` if the sign-in is older than 10 minutes → the tab goes to Stripe's hosted invoice (license) or charge receipt (lifetime, refund), with the opener cleared; on failure the blank tab closes and the row shows "Can't open this receipt right now."
- `[< Back to Billing]` → `billing/billing-home`

## Navigation graph

Enter from: `billing/billing-home` (All receipts on a payer card)
Exit to: Stripe receipt or invoice page (external, new tab) · `billing/step-up` · `billing/billing-home`

## States

- **loading**: title, three row outlines.
- **success**: as drawn, newest first, at most 50 rows.
- **empty, no plan ever bought**: "No receipts yet."
- **empty, active Stripe plan bought before history began**: "Older payments are in the receipt email from Stripe."
- **row without a receipt** (a 100%-off code made the payment free): the row shows no button; the rest of the row stays.
- **link failed** (Stripe did not answer): "Can't open this receipt right now." on that row only.
- **not yours** (403) or **unknown space** (404): "This page is for the person who pays for this space." + `[ Back to Billing ]`.
- **offline**: "You're offline. Plans and receipts need a connection." + `[ Try again ]`.
- **error**: "Can't load receipts right now." + `[ Try again ]`.

## Data needs

- reads: `GET /api/billing/receipts?id=<spaceId>` → `{ spaceName, receipts: ReceiptView[] }` (id, date, kind, plan, amount, currency, livemode, hasReceipt; no URL, no Stripe id)
- writes: `POST /api/billing/receipt-link { id }` → `{ url }` (fresh from Stripe, never stored, step-up first)
- telemetry: Worker-side `billing.receipts_viewed { rows }`

## Open questions

- Download all receipts as one file for a school office? Default: no; Stripe's invoice pages each have a PDF download.
