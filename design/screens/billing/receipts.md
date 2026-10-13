# Receipts: every recorded payment of one space (screen spec v1)

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` sections 4.10, 4.12, 5.3, 8 · wireframe `design/wireframes/billing/receipts.md`
Mocks: `mock/receipts.html` (page), `mock/receipts-states.html` (board) · shots `shots/receipts-375.png`, `-1280.png`, `-320-text200.png`, `receipts-states-*.png`
Code (B-8c): `apps/web/src/app/(console)/account/billing/receipts/page.tsx` at `BILLING_RECEIPTS_PATH?id=<spaceId>`, rows from `receiptRow` (`billing-summary.ts`, B-7) over `GET /api/billing/receipts`, links from `POST /api/billing/receipt-link` behind step-up.

## Anatomy

Inside the adult frame (Billing current), in the reading column (`layout.maxWidth.reading`):

1. **Back to Billing** (`receipts.back.cta`): the `back-link` look, `arrow-left` glyph, `brand.secondaryDark`, underlined, `touchTarget.min` tall.
2. **h1** "{space} · receipts" (`receipts.pageTitle`).
3. **Mode banner** (as on the billing home): "Test mode: no real card is charged."
4. **The table** (caption "Receipts", `receipts.title`; columns `receipts.column.date` / `.what` / `.plan` / `.amount` and an unlabelled action column whose header cell is `<td role="columnheader" aria-hidden="true">`, so no empty cell is announced and each **View receipt** carries its own accessible name), newest first, at most `RECEIPTS_PAGE_LIMIT` (50) rows.
5. At 50 rows: "Older receipts: see Stripe's emails or write to us." (`receipts.beyondLimit`, `text.muted`). The list carries no "more" flag, so the line shows whenever the limit is reached, including a space with exactly 50 rows; it is guidance, true either way.

## A row

| Cell | From `receiptRow` | Look |
|---|---|---|
| date (the row header, `th scope="row"`) | `date`, the UTC calendar day: "Oct 2, 2028" | `text.secondary`, `size.bodySm`, one line in table form |
| what | `kind` ("Payment", "Renewal", "Refund", "Payment didn't go through") and the "test" pill when `testPill` | semibold; the pill `pill-neutral` |
| plan | `plan` ("Family Plan", "Group License"; a legacy one-time row shows the plan name only) | regular |
| amount | `amount` (`formatUsd` for usd, else the stored currency) | semibold, right-aligned, one line |
| action | **View receipt** when `hasReceipt`, accessible name `viewA11y` ("View receipt from Oct 2, 2028 (opens Stripe in a new tab)"); under it a polite line that shows "Can't open this receipt right now." after a failed lookup, on that row only | secondary button |

- A failed payment row is plain text: no red, no failure glyph, the same neutral words as everywhere.
- A row without a receipt (a legacy one-time sandbox payment made free by a 100%-off code) has no button; the rest of the row stays (`Oct 12, 2026 · Payment · Family Plan · $0` in the mock). This is an edge case, not the usual legacy path: a one-time Checkout session opened before BY-1 (#371) stopped creating them and completed, inside Checkout's 24-hour session life, after B-3 (#406) started writing `billing_events` (both merged and deployed Oct 11 to 12, 2026), so it has a recorded row but no receipt. The usual legacy case, a one-time payment with no recorded row at all, is billing home board item 11 (`legacyNoHistory`).
- **View receipt** opens a blank tab inside the tap, then the receipt-link call; the tab goes to Stripe's hosted invoice or charge receipt with the opener cleared; on failure the tab closes and the row's line appears. When step-up is needed (`step-up.md`, board 5) the blank tab is closed before the dialog opens; after step-up the receipt opens in a new tab, and if the browser blocks it (the tap is long gone) the row says "Confirmed. Tap View receipt again to open it." (`receipts.tapAgain`), and that next tap opens it inside the tap. A blank tab the browser blocked gets one more try once the link is here; if that is blocked too, the row says "Can't open this receipt right now."

## Table and list (D10)

One `table` with explicit ARIA roles (`table`, `rowgroup`, `row`, `rowheader`, `columnheader`, `cell`), so a display change keeps its semantics. In a column of 36rem or more (576 px at the default text size) it is a table: header row in `text.muted` `size.caption`, rows on paper split by `border.subtle`. Narrower (phones, 200 % text) each row reflows to a paper block (`radii.lg`, padding `spacing.md` / `spacing.lg`) in two halves: date and what on the first line, plan and amount on the second, the action under them; the header row is visually hidden but read. No sideways scroll at 320 with 200 % text.

## States (board order)

| # | State | What shows |
|---|---|---|
| 1 | loading | back link, h1 "Receipts", three grey row outlines (no motion) |
| 2 | empty, no plan ever bought | "No receipts yet." |
| 3 | empty, an active Stripe plan bought before history began | "Older payments are in the receipt email from Stripe." |
| 4 | not yours (403) or unknown space (404) | h1 "Receipts" (no space name), a panel "This page is for the person who pays for this space." and **Back to Billing** |
| 5 | offline | panel "You're offline. Plans and receipts need a connection." + **Try again** |
| 6 | error | panel "Can't load receipts right now." + **Try again** |
| 7 | 50 rows | the last rows, then the beyond-limit line |
| page | success | Kim family, six rows: a renewal three days after the period end (Oct 5, 2028), the failed attempt on the period end itself (Oct 2, 2028, Stripe's first try), a refund of a duplicate payment, the duplicate (with a failed lookup), the first payment, and the legacy row without a receipt |

Payers only: co-parents and teachers never reach rows (the server answers 403). No Stripe id or URL is ever on the page or in its address; the id in the URL is the opaque space id.
