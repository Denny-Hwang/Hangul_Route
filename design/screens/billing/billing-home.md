# Billing home: one billing page for every grown-up persona (screen spec v1)

> **Amended 2026-10-20 [SA]** (`docs/specs/AMENDMENTS-SEATS-ADMINS.md`): a family holds up to **4** learners (was 5); the Group License covers up to **50** students in a class or a school (was no cap for a class and 300 for a school). Only the numbers on this page changed; the new rename and administrator surfaces get their own wireframes and mocks in row SA-0b.

Spec: `docs/specs/F-BILL-002-billing-in-app-all-personas.md` sections 4.2, 4.3, 4.6, 4.9, 4.12, 6.1, 8 · wireframe `design/wireframes/billing/billing-home.md`
Mocks: `mock/billing-home.html` (parent), `mock/billing-home-teacher.html` (teacher), `mock/billing-home-states.html` (board) · shots `shots/billing-home-*.png`, `billing-home-teacher-*.png`, `billing-home-states-*.png`
Code (B-8a): `apps/web/src/app/(console)/account/billing/page.tsx` (replaces F-APP-001 A-5c's re-export), rendering `billingHomeView(parseBillingSummary(raw), { now, locale, promo })` and `summaryFailureNotice(offline)` from `apps/web/src/lib/console/billing-summary.ts` (B-7). The page renders what the view model gives and nothing else.

## Anatomy (top to bottom)

Inside F-APP-001's grown-up layout and `AdultFrame` (Billing current in the tab row). Content column: `layout.maxWidth.full`, gutters `layout.gutter.compact` / `.regular` (45em) / `.wide` (70em), `spacing.lg` between blocks.

1. **h1** "Billing" (`console.billing.title`), `typography.size.title`, bold.
2. **Mode banner** (`view.banner`), one line: `surface.sunken`, `text.secondary`, `size.bodySm`, `radii.md`, padding `spacing.sm` / `spacing.md`, as wide as its text. Neutral, never a warning colour. Test mode (today, always): "Test mode: no real card is charged."; `mode none`: "Payments aren't set up yet. Nothing was charged."; live key, purchases not opened: "Payments are not open yet. Nothing was charged.". No banner only when live and opened (not reachable while Live stays off).
3. **Return notice** (B-8b, `checkout-return.md`).
4. **Notes** (console `Notice`, info tone, `role="status"`): the offline line when the connection dropped after the cards loaded (`console.billing.offline`), "This plan is already active. Nothing was charged." after a `409 already_active`, "Nothing was changed." after a cancelled step-up, and the past-due note (`view.pastDueNote`). Never `feedback.danger`.
5. **Your plans** (h2 `sections.yours`) and the card grid (`minmax(min(100%, 22rem), 1fr)`, gap `spacing.lg`): one `section` per space, labelled by its h3, in the view model's order (payer cards first; family, class, school; the server's newest first). Legacy account cards (`view.accountCards`) follow in the same grid.
6. **Add a plan** (h2 `sections.add`), only when `view.addPlan` is set (two or more payer cards can buy): one box per offer in the card grid's columns (one per row on phones, side by side from about 45em), then the Contact us rows.
7. **Help** (h2 `sections.help`): three lines in `text.secondary`: `help.refund(hello@hangulroute.com)`, `help.learners`, `help.sharedDevice`. Present in every state except the offline and error panels.

## A card

`section.bill-card`: `surface.paper`, `borderWidth.thin` `border.subtle`, `radii.lg`, padding `spacing.lg`, lines `spacing.xs` apart.

| Part | From the view model | Look |
|---|---|---|
| h3 | `heading`: "Family · Kim family", "Class · Spring Class (archived)" | `size.bodyLg`, bold, wraps anywhere |
| plan line | `plan`: "Free plan", "Family Plan", "Group License", "School Contract", "Covered by Maple School's license until Aug 31, 2029" | semibold |
| status line | `status`: "Renews on …", "Ends on …", "payment needs attention · full route kept for a week", or none | `text.secondary`, `size.bodySm` |
| usage line | `usage`: "2 of 4 learners", "14 of 20 students", "23 students", "42 of 50 students · 7 of 10 teachers" | same |
| read-only line | `readOnly` (viewer cards only) | same, above a `border.subtle` rule |
| offer | `offer` (the one buyable card only) | see "The offer" |
| next step | `connectLearner`: "Next: connect a learner to this family." + **Connect a learner** (secondary, link to `/parent/space?id=…`) | above a rule, the line semibold |
| actions | `manage` → **Manage subscription**; `contact` → **Contact us** (mail link, fixed subject, no space name or id) | secondary buttons in a wrapping row |
| receipts | `receipts` (≤ 3, payer only) in a **Receipts** disclosure, then **All receipts** (`allReceiptsHref`) | see "Disclosures" |
| legacy line | `legacyNoHistory` → `receipts.older` | `text.secondary`, `size.bodySm` (D6) |

**Viewer cards** (co-parent, co-teacher, a class its school pays for, a school seen by a teacher member) show the heading, plan, status and usage lines the summary gives and the read-only line. Never an amount, a promo field, a button or a receipt (section 4.2; the view model enforces it whatever the summary says).

Variants on the board: Family Plan with 3 of 4 learners (4), no learner yet (5), cancelled "Ends on" (6), past due (7), school owner with Contact us (8; [SA] a school admin sees this card read only, with no Manage, no Contact us and no Receipts, `billing.readOnly.schoolAdmin`; that board lands in SA-0b), a school on the free plan with the Group License offer, the school line and Contact us (9), archived with a live license, payers only (10), a legacy one-time sandbox Family Plan with no date and no Manage (11), the legacy "Your account" card (12).

## The offer

Inside the one buyable card, under a `border.subtle` rule, or as an **Add a plan** row (`surface.paper` box, `radii.lg`).

1. Title: `offer.title`, an h4 in the card ("Family Plan"), an h3 in Add a plan ("Group License for Room 4"). The offer is a `role="group"` labelled by it.
2. Includes lines (`offer.includes`), one `li` each with the `check` glyph (20, `feedback.success`, decoration). Today, with `SITE_CLAIMS` all off: Family Plan "Every lesson of every Stage, new ones included", "Up to 4 learners in one family", "Cloud save on every device"; Group License "Every lesson for every student while they are enrolled", "Up to 50 students in the class", and for a school "A school holds up to 10 teachers and 50 students". Feature lines (browse, reports, notes) render only once their claim flips (board 21); a line for an unbuilt feature never renders.
3. Price line (`offer.price`): "$15.30 / year", "$153 / year"; `size.prompt`, bold. With a code applied: "$12.24 / year with HOYA20 (20% off, first year), was $15.30 / year" at `size.body` (board 20).
4. Renew line (`offer.renew`): "Renews yearly. Cancel from Manage subscription any time." (D1), `text.secondary`.
5. **Have a code?** (the first offer on the page only, directly under the price it rewrites): the F-ENT-002 form (D4, board 19).
6. The button (`offer.cta`): **Get Family Plan** / **Get Group License**. Exactly one primary on the page (`offer.primary`, the first offer: `brand.primary`, `text.onPrimary`); every other offer button, Manage, Contact us, Connect a learner and All receipts are secondary (paper, `border.strong`). Full width on phones, its own width from 45em.

Prices appear only in an offer and in the payer's receipts. No "best value", "save", countdown, strike-through anchor other than the promo line, urgency colour, comparison, "Premium" or "lifetime".

## Disclosures

Native `details` / `summary`, the summary a `touchTarget.min` row in `brand.secondaryDark`, semibold, with the `arrow-right` glyph turned 90 degrees when open (no animation). Closed by default; their state is per page view.

- **Receipts** (payer card): up to three rows, each date (`text.secondary`), kind, the "test" pill (`pill-neutral`) and the amount at the right (semibold); no plan name, no link (links live on the receipts page behind step-up). Then **All receipts** (secondary) to `/account/billing/receipts?id=…`.
- **Have a code?**: the promo form, its result line in `role="status"`.

## States

| State | Board | What shows |
|---|---|---|
| loading | 1 | the h1, a grey line where the banner goes and three grey card outlines (`surface.sunken`, `radii.lg`) in a region marked `aria-busy="true"`; no numbers, nothing moves, no new string |
| success, one buyable space | page | the offer inside that card; no Add a plan |
| success, several buyable | teacher page | Add a plan, one row per space, the first primary |
| empty | 2 | an h2 "Plans belong to a family or a class." with **Set up for me or my family** (primary) and **Set up a class**; Help stays |
| all read-only | 3 | cards only; no offer, no button |
| not configured (`mode none`) | 13 | its banner; buy, Manage and Apply code disabled (D5); cards render |
| live key, not opened | 14 | its banner; the same buttons disabled. The guard state while `BILLING_LIVE_ALLOWED` is unset; Live stays off |
| already active (409) | 15 | the note above the cards; the summary reloads |
| past due | 7 | the note above the cards; the card's status line; Manage enabled |
| offline (summary failed, browser offline) | 16 | a `panel` with `console.billing.offline` and **Try again**; no cards, no offers, no Help; reloads by itself on `online` |
| error (failed while online) | 17 | the same panel with "Can't check your plan right now." |
| offline after the cards loaded | 18 | the offline line above the cards; buy, Manage and Apply code disabled until `online` (the board draws a free family next to an active class, so the disabled **Manage subscription** sits beside an enabled **Receipts**) |
| signed out, locked, opening the URL offline | not drawn | F-APP-001: `/signin?next=`, the grown-up lock, the grown-up offline page |

Disabled buttons: `surface.sunken`, no border colour of their own, `text.muted` (5.07:1), the native `disabled` attribute.

## Accessibility

- One h1; one h2 per section; one h3 per card (an h4 for the offer inside a card). Cards are `section` elements labelled by their h3.
- Every state is in words: plan, status and usage lines; the pill has text; the marked card's outline is a second cue, never the only one.
- Disclosures are native `details` / `summary`.
- Each page note (offline, already active, Nothing was changed, past due) and each card's promo result line is its own `role="status"` (polite) region. The checkout return uses one region for all of its states, so each change is announced once (`checkout-return.md`); it does not replace the other status regions.
- Every control is at least `touchTarget.min` tall; keyboard order is the visual order; the focus ring is `borderWidth.thick` `border.focus`.
- At 320 px with 200 % text nothing scrolls sideways (`shots/billing-home-320-text200.png`, `billing-home-teacher-320-text200.png`); long space names and the e-mail address wrap.

## What the page must never render

A price, promo field, button or receipt on a viewer card; a second primary button; a line for a feature that is not live; "lifetime", "once", "one payment", "for good", "Premium", "kids" or an age range; a link to Stripe without step-up; the danger colour; any price or plan list on hangulroute.com (this page exists only on app.hangulroute.com).
