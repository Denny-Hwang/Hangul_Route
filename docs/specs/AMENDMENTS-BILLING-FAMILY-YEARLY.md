Status: ready (applied in the BY-0 docs PR to F-ENT-001, F-ENT-002, F-BILL-002, F-SUB-001, F-SITE-002, F-BROWSE-001, F-ENT-003, the wireframes and the launch docs; F-SPACE-002 in the follow-up docs PR #385)

# Amendment: the Family plan renews yearly — $15.30 a year, cancel any time

> **Applied 2026-10-11 in the BY-0 docs PR.** Every spec, wireframe and launch document that described the family product as a one-time lifetime purchase now describes the yearly plan, marked with "[BY]". This file keeps the decision, the reasons, the exact Stripe behaviour, the owner's Stripe checklist, and the PR table.
>
> Basis: `origin/main` `ba78478c`. Every `file:line` below is at that commit.

**Owner decision 2026-10-11 (translated):** "Billing is currently one payment for lifetime use. That should not be. Keep the price and change it to a 1-year term. Fix the price description page, and tell me what I have to change in Stripe."

**Standing rules that apply here:**
- Stripe stays in **sandbox (test mode)**. Stripe Live, real prices and commercial claims stay off until the owner says so (F-BILL-002 OD-12). No real customer exists, so no customer is migrated.
- hangulroute.com shows no price, ever (F-SITE-002 OD-7). Prices appear only on the signed-in billing page, under the test-mode banner (F-BILL-002 OD-2), and on the learner paywall until F-BILL-002 B-9 removes it.
- D1 changes are additive only. A merge applies migrations to production.
- Any age: no age wording. Anti-shame: when a plan ends, learners keep every star, card and progress item.
- UI strings go through `packages/i18n`. English first; Korean and Spanish only after native review.

---

## 1. The decision

| | Before (decision #30, 2026-10-06) | After (this amendment, 2026-10-11) |
|---|---|---|
| Product name (UI) | Family Lifetime | **Family Plan** |
| Price | $15.30 once | **$15.30 / year** (USD), the same amount |
| Term | never lapses (`expiresAt` null) | **1 year**, renews every year until cancelled |
| Stripe | Checkout `mode=payment`, one-off price | Checkout **`mode=subscription`**, a **recurring yearly** price, the same mechanism the Group License ($153 / year) already uses |
| Cancel | nothing to cancel | **any time** in the Stripe Billing Portal (**Manage subscription**); access continues to the end of the paid year |
| Covers | one family space, up to 5 learners, every Stage | unchanged: one family space, up to `FAMILY_LIFETIME_LEARNERS` (5) learners, every Stage, new ones included while the plan is active |
| Group License, School contract | $153 / year; Contact us | unchanged |

## 2. Decisions taken in this amendment

### BY-D1. The stored plan key stays `family_lifetime` (no `family_yearly` key)

The obvious move is a new key `family_yearly`. It cannot be done additively:

- `entitlements.plan_key` carries `CHECK (plan_key IN ('family_lifetime', 'group_license', 'school_seat'))` (`apps/api/migrations/0002_schema_v2.sql:111`). SQLite cannot change a CHECK constraint in place; the only way is to rebuild the table (create, copy, drop, rename). That is not an additive migration, and a merge would run it against production.
- The in-flight `billing_events` table (F-BILL-002 B-2, `0007_billing_events.sql`) carries the same three values in its own CHECK.

So the **key is an identifier, not a description**: `family_lifetime` stays the one stored and API key of the Family Plan, in D1, in `PlanKeySchema`, in Stripe `metadata[planKey]`, in `PLAN_PRICING` and in i18n key paths. Its term comes from Stripe (the subscription's period end in `expiresAt`), not from its name. The UI never shows the key; it says **Family Plan**. The code documents the historical name next to `PlanKeySchema`. Nothing in D1 changes, and B-2's migration needs no edit.

Considered and rejected: a table rebuild (not additive; production risk for zero customers' benefit); a second table or a mapping layer that writes `family_lifetime` and reads `family_yearly` (two names for one row, easy to get wrong); a new `term` column (the term is already in `expiresAt` and `providerRef`).

### BY-D2. Old sandbox rows stay readable

Rows written by the old one-time checkout (`status: 'active'`, `expiresAt: null`, `providerRef` a `pi_…` payment intent or a `cs_…` session) exist only in the sandbox. They keep their meaning read-only: `isEntitlementActive` is unchanged, so they keep covering their family; the console shows them as "active" with no date and no **Manage subscription** button (there is no subscription to manage). No code writes such a row any more. The owner may delete them from the sandbox D1, but nothing requires it. A family holding one that buys the yearly plan simply has its row replaced (one row per space and plan key).

### BY-D3. Environment variable

- New Worker variable **`STRIPE_PRICE_FAMILY_YEARLY`** (Type Text, `hangul-route-api`): the id of the recurring yearly $15.30 price.
- `STRIPE_PRICE_FAMILY_LIFETIME` is **ignored** by the code from BY-1 on. Its old one-off price cannot be used in subscription mode, so there is no fallback. The owner deletes the variable (harmless if left).
- Without `STRIPE_PRICE_FAMILY_YEARLY`, a Family Plan checkout answers `stripe_not_configured` exactly as a missing price does today.

### BY-D4. Checkout

- Both purchasable plans use `mode=subscription` (`checkoutMode` always returns `subscription`).
- The session carries `metadata[subjectKind|subjectId|planKey]` and `subscription_data[metadata][subjectKind|subjectId|planKey]` (plus `promoCode` when a code was applied), so every subscription event maps back to the family without a table lookup.
- `payment_method_collection`: **`always` for the Family Plan**, `if_required` for the Group License (unchanged). A family always saves a card, so a 100%-off *Once* code gives a free first year that then renews at $15.30 like any other year, and "renews {date}" on the card stays true. A sponsored class licence with a 100%-off code still needs no card; it lapses at the end of its year unless the payer adds one in **Manage subscription** (the upcoming-renewal email of section 4 step 6 asks them to).
- `customer_creation=always` is dropped for the family: subscription mode always creates a Stripe customer, and Stripe refuses that field in subscription mode.
- **One Stripe customer per subject.** When the subject already has a Stripe subscription row of the same plan with a `customerRef` (a plan that lapsed, or a legacy row), the session is created with `customer=cus_…` and without `customer_email`, so a renewed purchase lands on the same customer and the portal shows every invoice.
- `allow_promotion_codes=true` when no code was applied; `discounts[0][promotion_code]` when one was (F-ENT-002, unchanged).
- **Already active (landed in BY-1, #371).** When the subject already holds a Stripe subscription row (`sub_…`) of the same plan that `isEntitlementActive` accepts, the Worker answers `409 already_active` and creates no session. A legacy one-time sandbox row (BY-D2) or a manual contract row does not block a checkout, so the family can move to the yearly plan and its row is replaced. With a yearly price a second purchase would renew every year, so this part of F-BILL-002 B-5 moves into BY-1. B-5 keeps the rest of its row: the live guard, step-up, the success suffix and the `billing.checkout_refused` telemetry (which then reports this 409), and B-8 adds the page's "This plan is already active. Nothing was charged." note; until then the old page shows its generic checkout error. Two checkouts opened before either is paid can still both complete; the webhook rule "a superseded subscription never ends a covering row" (BY-D5) keeps the family covered, and the owner refunds and cancels the duplicate (runbook Step 8).

### BY-D5. Webhook mapping, renewal, cancel and expiry

`entitlementFromStripeEvent` (`packages/backend/src/lib/stripe.ts`):

| Stripe event | Entitlement row |
|---|---|
| `checkout.session.completed`, `mode=subscription` | Applied with the **checkout merge**: on a row that already carries this subscription id (`customer.subscription.created` landed first) it only fills `customerRef` and `promoCode`; **status and `expiresAt` stay as the subscription events set them** (writing `active` / `null` here would erase the period end or undo a cancel). With no row, or a row of another subscription or a legacy payment (a plan bought again after it lapsed), it writes `active`, `providerRef` = the subscription id (`sub_…`), `customerRef`, `promoCode` and **`expiresAt` null**, so the family is covered at once even when the stored row still carries an old, past end; the subscription event sets the real period end, usually within seconds. |
| `checkout.session.completed`, `mode=payment` (legacy, no longer created) | as before: `active`, `expiresAt` null |
| `customer.subscription.created` / `.updated` | status from Stripe (`trialing` → `trial`, `active` → `active`, `past_due` → `past_due`, `canceled` → `cancelled`, `unpaid` / `incomplete_expired` / `paused` → `expired`; `incomplete` is ignored), **`expiresAt` = the current period end** |
| same, with `cancel_at_period_end === true` or a numeric `cancel_at`, while Stripe says `active` or `trialing` | **`cancelled`**, `expiresAt` = the period end (or `cancel_at` when that is earlier). `cancelled` stays active until `expiresAt` (F-ENT-001 §3.2), so the family keeps everything to the end of the paid year and the console says "Ends on {date}". Undoing the cancel in the portal sends another `.updated` with the flag off → back to `active`, "Renews on {date}". |
| `customer.subscription.deleted` | `expired` (the year ran out after a cancel, retries were exhausted, or the owner cancelled it immediately in the dashboard) |

- **Fresh state, not event order.** Stripe does not promise delivery order and retries failed deliveries for days, so an old `customer.subscription.updated` (say, the cancel) can land after a newer one (the undo). For `customer.subscription.created` and `.updated` the Worker therefore reads the subscription again (`GET /v1/subscriptions/{id}`, Stripe's recommended pattern) and maps that object; only when the read fails does it map the event's own copy. `.deleted` is final and is mapped as delivered.
- **Concurrent deliveries.** Stripe sends `customer.subscription.created` and `checkout.session.completed` within milliseconds and the Worker may handle both at once. D1's `applyEntitlement` is a compare-and-set: it reads the row, merges in code (`mergeEntitlement`, shared with the memory store), and writes with `INSERT … ON CONFLICT DO NOTHING` (no row yet) or `UPDATE … WHERE` every column still equals what it read; a lost race reads again and re-merges (up to five tries, then the request fails with 500 and Stripe retries it). A field the event leaves out is therefore never replaced by a stale copy.
- **A superseded subscription never ends a covering row.** One row is kept per space and plan. If a family ends up with two subscriptions (two checkouts paid before either landed), an event for a subscription other than the one the row carries may move the row to itself only when that does not take the family out of cover: a `deleted`, `expired` or similar event for the other subscription is ignored while the row still covers. The owner refunds and cancels the duplicate in the dashboard.
- **Period end location.** Stripe API versions before 2025-03-31.basil put `current_period_end` on the subscription; basil and later (including the 2025-09-30.clover version a new sandbox defaults to) put it on each item, `items.data[i].current_period_end`. The mapper reads the top level first, then the latest item period end. Without this, a new sandbox's events would leave `expiresAt` null and a yearly plan would never lapse. This fixes the Group License the same way.
- **Renewal.** At the period end Stripe charges the saved card, creates the next invoice and sends `invoice.paid` and `customer.subscription.updated` with the new period end. `expiresAt` moves forward one year. Learners notice nothing.
- **Failed renewal.** Stripe sets the subscription `past_due` and retries (Smart Retries). The row becomes `past_due` and stays active for the 7-day grace (`PAST_DUE_GRACE_MS`); the console asks the payer to update the card in **Manage subscription**. When Stripe's retries end it cancels the subscription (dashboard setting, section 4 step 6) → `deleted` → `expired`.
- **Expiry.** After `expiresAt` (or on `expired`), the family is no longer covered: `tierForLearner` returns free, devices see it at their next inbox refresh, and the cached tier keeps the full route for at most the 7-day offline grace (`tierValidUntil`). **Learners keep every star, card, collection item and finished lesson.** Only lessons past the free set follow F-ENT-003's rules again. Buying again restores the full route at once.
- Events the Worker needs today: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. F-BILL-002 B-3 adds `invoice.paid`, `invoice.payment_failed`, `charge.refunded` for receipts and history. The owner can subscribe all seven now: until B-3 deploys the Worker answers the extra three with `200 { applied: false }`.

### BY-D6. Portal

- `POST /api/entitlements/stripe/portal` opens the Billing Portal for any Stripe row on the subject whose `providerRef` is a subscription (`sub_…`) and that has a `customerRef`, whatever its plan. A legacy one-time row (`pi_…`, `cs_…`) has nothing to manage → 404, as before.
- The console shows **Manage subscription** on a Family Plan card exactly as on a license card.
- Portal settings the owner turns on: cancel at the end of the billing period, update the payment method, show the invoice history (section 4 step 5).

### BY-D7. Receipts and invoices

- A subscription creates a Stripe **invoice** for the first year and for every renewal, each with a hosted invoice page and a PDF. Stripe emails a receipt for each successful payment when the dashboard's customer email settings are on (section 4 step 6). The portal lists every invoice.
- F-BILL-002 §4.10 and §5.4 apply to the family exactly as to the license: the first `invoice.paid` (`billing_reason: subscription_create`) is the **Payment** row, later ones are **Renewal** rows, and the receipt link is the invoice's `hosted_invoice_url`. The "one payment" row label and the payment-intent receipt path are kept only for legacy sandbox rows.
- Renewal reminder: the owner turns on Stripe's upcoming-renewal email (section 4 step 6), so no family is charged for a new year without notice. This is also what consumer auto-renewal rules expect for a yearly term; counsel checks the exact notice period before Stripe Live (F-SITE-002 OD-13).

### BY-D8. Refunds (replaces F-BILL-002 OD-6's default)

A refund never changes coverage by itself, for either product. Status follows Stripe's subscription events only. To end a refunded plan at once, the owner cancels the subscription **immediately** (not at period end) in the Stripe dashboard; `customer.subscription.deleted` then expires the row. A legacy one-time row is ended by the owner by hand in the sandbox if needed. Learners keep everything they earned.

### BY-D9. Copy (English; ko / es follow native review)

| Where | Key | Before | After |
|---|---|---|---|
| console | `billing.planTitle.family_lifetime` | Family Lifetime | Family Plan |
| console | `billing.includes.family_lifetime(n)` | Every Stage, now and later, for one family: up to {n} learners, cloud sync, grown-up dashboard and plans | Every Stage, new ones included, for one family: up to {n} learners, cloud sync, grown-up dashboard and plans |
| console | `lifetimeLine` (deleted) → `familyLine` (new) | One payment. No renewal, no subscription to cancel. | Renews yearly. Cancel from Manage subscription any time. |
| console | `entitlementStatus.activeForGood` (deleted) | active · yours for good | (a Family Plan uses `activeRenews(date)` "active · renews {date}"; a legacy row without a date uses `active`) |
| console | `price.once` | {amount} once | kept for type completeness, no plan uses it |
| console promo line | `promoPrice(…)` | "$12.24 once with HOYA20 (20% off), was $15.30 once" | "$12.24 / year with HOYA20 (20% off, first year), was $15.30 / year" on a once-duration code (same rule as the license) |
| paywall | `caregiver.paywall.offer.name` | Family Lifetime | Family Plan |
| paywall | `caregiver.paywall.offer.line` | One payment. No subscription, nothing to cancel. | Renews every year. Cancel any time. |
| paywall | `caregiver.paywall.free.terms` | One payment, no renewal. Terms and privacy are on the website. | Renews yearly until cancelled. Terms and privacy are on the website. |
| paywall | `caregiver.paywall.bullets.everyStage` | Every Stage, now and later | Every Stage, new ones included |
| paywall | `caregiver.paywall.free.unlocks(offer)` | What {offer} unlocks | What the {offer} unlocks ("What the Family Plan unlocks") |
| paywall | `caregiver.audience.shared.paywallBuyOnWeb` / `.paywallBuyLater` | Buy it once on the web console, … / … you can buy it once on the web console. | Buy it on the web console, … / … you can buy it on the web console. |
| a11y | `lifetimeOffer` (renamed `familyOffer`) | {name}, {price} | {name}, {price} |
| F-BILL-002 (not yet built) | `coverage.lifetime` → `coverage.family` | Family Lifetime · yours for good | Family Plan |
| F-BILL-002 | `buy.family_lifetime.cta` | Get Family Lifetime | Get Family Plan |
| F-BILL-002 | `includesLines.family.everyLesson` | Every lesson of every Stage, now and later | Every lesson of every Stage, new ones included |
| F-BILL-002 | `full.fromFamily.family` / `.self` | From your family's Family Lifetime plan. / From your Family Lifetime plan. | From your family's Family Plan. / From your Family Plan. |
| F-BILL-002 | `receipts.oneTime` | one payment | deleted (legacy rows show the plan name only) |
| F-ENT-003 | `caregiver.access.product.family` / `.either`, `caregiver.gating['quest-closed']`, `console.access.product.family` | Family Lifetime | the Family Plan ("More lessons open with the Family Plan.") |

- Words never used about the Family Plan from now on: "lifetime", "once", "one payment", "pay once", "for good", "forever", "nothing to cancel". A test in BY-1 scans the shipped English dictionary for them in billing and paywall strings.
- No urgency, no "save", no countdown, no "you will lose" (F-BILL-002 §4.3, §9).

### BY-D10. Marketing site and legal text

- **hangulroute.com**: no change. It shows no price, and `landing-claims.test.tsx` already forbids "lifetime", "subscription", "pay once" and any per-year price on the page and in the metadata.
- **Privacy Policy and Terms** contain no "lifetime" wording today; they describe store subscriptions only. F-SITE-002 S-7 (the factual legal correction, flagged for counsel, OD-13) gains one fact: web plans (Family Plan and Group License) renew yearly until cancelled, cancel any time in Billing → Manage subscription, access continues to the end of the paid year. BY-1 does not edit the legal text; S-7 does.

### BY-D11. Native apps

F-IAP-002 will sell the Family Plan as an **auto-renewable yearly subscription** in the App Store and Google Play (it was planned as a non-consumable). F-BILL-002 OD-5 and F-ENT-003 OD-13 are reworded to match; nothing ships to the stores before F-IAP-002.

## 3. Out of scope

- Monthly billing, a second price, trials, proration, plan switching between family and license (the portal is configured without plan switching).
- Migrating customers: none exist (sandbox only).
- Stripe Live, `BILLING_LIVE_ALLOWED`, real prices on any public page.
- Receipts and history UI (F-BILL-002 B-3, B-4, B-8c), which now cover the family through invoices.

## 4. Owner checklist: what to change in Stripe

Do this in the **sandbox (Test mode) now**. Repeat steps 1, 2, 4, 5, 6 and 7 in **Live mode only when the owner turns Live on** (Live has its own products, prices, keys, webhook endpoint and portal settings). The Korean step-by-step version is `docs/launch/owner-runbook.md` Step 8.

1. **Create the yearly price.** Product catalog → open the product used for the family (rename it **Family Plan**, or create a new product **Family Plan**) → **Add another price**: Pricing model *Flat rate*, **Recurring**, Billing period **Yearly**, Amount **15.30**, Currency **USD**, Tax behaviour as for the license price → Save → copy the price id (`price_…`).
2. **Archive the old one-off price.** On the same product, the old **$15.30 One-off** price → **Archive price**. Archiving keeps old payments readable and stops new use. If the product was named "Family Lifetime", rename it **Family Plan** (product names show on Checkout, invoices and receipts).
3. **Set the Worker variable.** Cloudflare → `hangul-route-api` → Settings → Variables and Secrets → Add → Type **Text** → name **`STRIPE_PRICE_FAMILY_YEARLY`** → value: the price id from step 1 → Deploy. **Do this only after the BY-1 merge has deployed both the API Worker and the web console** (a merge to main deploys both; check that the billing page shows "$15.30 / year"). Until the variable is set, a Family Plan checkout answers `stripe_not_configured`, which is the intended safe window, so the old "$15.30 once" page can never start a yearly subscription. Then **delete** `STRIPE_PRICE_FAMILY_LIFETIME` (the code no longer reads it). Keep `STRIPE_PRICE_GROUP_LICENSE_YEARLY`, `CONSOLE_URL`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as they are.
4. **Webhook endpoint events.** Developers → Webhooks → the endpoint `https://hangul-route-api.<account>.workers.dev/api/entitlements/stripe/webhook` → **Select events**: keep `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and add `invoice.paid`, `invoice.payment_failed`, `charge.refunded` (receipts and history, F-BILL-002 B-3; answered `applied: false` until B-3 deploys). Note the endpoint's **API version** in the runbook. The signing secret does not change.
5. **Customer portal.** Settings → Billing → **Customer portal**: turn on **Cancel subscriptions** with *Cancel at end of billing period* (not immediately), turn on **Update payment methods**, turn on **Invoice history**, leave **Switch plans** off, leave quantity changes off. Set the business name, privacy policy link `https://hangulroute.com/privacy` and terms link `https://hangulroute.com/terms`. Save.
6. **Subscriptions and emails.** Settings → Billing → **Subscriptions and emails**: turn on **Send emails about upcoming renewals** (choose 30 days before renewal; counsel confirms the period before Live), **Successful payments** receipts, and **Failed payments** emails with the link to update the card. Under **Manage failed payments**, keep Smart Retries and set *If all retries for a payment fail* → **Cancel the subscription**.
7. **Test it (sandbox).** Billing page → Family Plan → Choose → card `4242 4242 4242 4242` → back on the page the card says "active · renews {date one year ahead}". Then Manage subscription → Cancel → the card says "cancelled · ends {date}". Optional: Developers → **Test clocks** advance a subscription one year to see a renewal.
8. **Nothing else changes.** Group License price, coupons and promotion codes stay as they are. A coupon's *Duration* now means for the Family Plan what it already meant for the license: **Once** = the first year only, **Forever** = every renewal, **Repeating** = a number of months.
   - A **100%-off Once** code on the **Family Plan** still asks for a card (BY-D4, `payment_method_collection=always`): the first year is free and the plan then renews at $15.30 with that card, after the upcoming-renewal email.
   - A **100%-off Once** code on the **Group License** saves **no card** (`if_required`). At the first renewal Stripe cannot charge, so the license goes `past_due` and is cancelled when retries run out (step 6). The upcoming-renewal email asks the payer to add a card in **Manage subscription**; without one the license ends after the free year. Use a **Forever** code for a class that should stay sponsored.
9. **Duplicates.** If a family or a class ever shows two active subscriptions for one space (two checkouts paid in two tabs before either landed), refund the newer one's invoice and **cancel it immediately** in Customers → that customer → Subscriptions. The space stays covered by the other one (BY-D5).

### Before Stripe Live (blocking, in addition to F-BILL-002 OD-12)

- **Terms with the renewal terms.** F-SITE-002 S-7 must ship first: the Terms say that web plans renew yearly until cancelled, how to cancel (Billing → Manage subscription), that access continues to the end of the paid year, and the renewal notice period counsel confirms (OD-13). The portal links to `/terms`, so Live stays off until that page carries these terms.
- **F-BILL-002 B-5's live guard** (`BILLING_LIVE_ALLOWED`) and step-up.
- Steps 1, 2, 4, 5, 6 and 7 above repeated in Live mode, and step 3 with the Live price id.

## 5. PR table

| PR | Type and contents | Size | Depends on |
|---|---|---|---|
| BY-0 | `docs`: this amendment; the [BY] edits in F-ENT-001, F-ENT-002, F-BILL-002, F-SUB-001, F-SITE-002, F-BROWSE-001, F-ENT-003, `docs/specs/README.md`, the billing, console and paywall wireframes, `docs/blueprints/10-app-map.md`, `docs/roadmap/multi-persona-sync-platform.md`, `F-INFRA-003` (one story line), the launch docs (owner-runbook Step 8 owner checklist, web-app-launch, faq, maker-comment), `docs/tasks/INBOX.md` | S | — |
| BY-1 | `feat(backend,web,mobile,i18n)`: `PLAN_PRICING.family_lifetime` → `$15.30 / year`; `StripeEnv.STRIPE_PRICE_FAMILY_YEARLY`, `priceIdFor`, `checkoutMode` (subscription for both), `checkoutForm` (no `customer_creation`, `payment_method_collection` `always` for the family, `customer` reused for a subject that already has one); checkout `409 already_active` (moved from F-BILL-002 B-5, BY-D4); `entitlementFromStripeEvent` (subscription completion with the checkout merge, `cancel_at_period_end` / `cancel_at` → `cancelled`, period end from the top level or the items); the webhook re-reads the subscription for `created` / `updated`; `mergeEntitlement` checkout merge and the superseded-subscription rule; D1 `applyEntitlement` as a compare-and-set; portal for any `sub_…` row; console `billing.ts` (status line, Manage for the family) and `BillingParts`; mobile `familyOffer`; i18n values of BY-D9 and the banned-words scan; `wrangler.toml` comments; tests updated and added, none weakened | M | BY-0 |

- **F-BILL-002 B-3** no longer owns the `cancel_at_period_end` / `cancel_at` mapping and the period-end location: BY-1 lands them (they are needed for the Family Plan to lapse). B-3 keeps history recording, the refund handling of BY-D8 and everything else in its row.
- **F-BILL-002 B-2** is unchanged (its CHECK keeps the same three plan keys, BY-D1).
- **F-BILL-002 B-6, B-8a, B-9** and **F-ENT-003 E3-8 / E3-12** use the BY-D9 words.

## 6. Tests BY-1 adds or changes

| File | Covers |
|---|---|
| `content-schema/__tests__/entitlement.test.ts` | `PLAN_PRICING.family_lifetime` is `{ amountUsd: 15.3, per: 'year', label: '$15.30 / year' }`; both purchasable plans are yearly |
| `backend/lib/__tests__/stripe.test.ts` | `priceIdFor` reads `STRIPE_PRICE_FAMILY_YEARLY` and ignores `STRIPE_PRICE_FAMILY_LIFETIME`; `checkoutMode` is `subscription` for both; family `checkoutForm` has `subscription_data[metadata]`, `payment_method_collection=always` (the license `if_required`), no `customer_creation`, `customer` instead of `customer_email` when one is given; the subscription re-read (fresh object, failure → null); subscription completion leaves `expiresAt` undefined, payment completion keeps null; `cancel_at_period_end` → `cancelled` with the period end; `cancel_at` earlier than the period end; reactivation → `active`; period end at the top level and in `items.data`; `incomplete` ignored |
| `backend/__tests__/entitlements.test.ts` | family checkout posts `mode=subscription` with the yearly price; `stripe_not_configured` with only the old variable; webhook lifecycle for a family: completion → created (period end) → updated with cancel at period end (still premium) → deleted (free); a legacy one-time row still covers; portal opens for a family `sub_…` row and 404s for a `pi_…` row; concurrent `created` and completion (both orders) keep the period end; a completion after a cancel keeps `cancelled` and its end; a plan bought again after it lapsed covers at once, then takes the new end; a second subscription's `deleted` does not end a row another subscription covers; `409 already_active` while covered, a new checkout after a lapse reuses the customer; a stale `updated` is replaced by the re-read subscription, and a failed re-read falls back to the event |
| `backend/db/__tests__/d1-entitlement-cas.test.ts` | D1 `applyEntitlement`: `INSERT … DO NOTHING` for a new row, `UPDATE … WHERE` the read values for an existing one, a lost race re-reads and re-merges, five lost races throw |
| `web/lib/console/__tests__/billing.test.ts` | Family Plan price "$15.30 / year", status "active · renews {date}", legacy row "active", Manage shown for a family subscription and not for a legacy row, promo line with ", first year" |
| `mobile/logic/__tests__/paywall.test.ts` | `familyOffer`: name "Family Plan", price "$15.30 / year", the renew line |
| `i18n/__tests__/*-messages.test.ts` | new values; no billing or paywall string says "lifetime", "once", "one payment", "for good" or "nothing to cancel" |

## 7. Review log

- 2026-10-11, author pass against the code at `ba78478c`: found the D1 CHECK on `plan_key` (BY-D1), the subscription-completion overwrite of `expiresAt` (BY-D5, first row), the basil period-end location that would have left yearly plans without an end date on a new sandbox (BY-D5), and Stripe's refusal of `customer_creation` in subscription mode (BY-D4).
- 2026-10-11, two independent reviews of BY-0 and BY-1. Applied: the D1 read-then-upsert race between `customer.subscription.created` and the completion (now a compare-and-set, BY-D5); the stale past `expiresAt` on a plan bought again after it lapsed (checkout merge writes null on a new subscription); the missing `409 already_active` (moved into BY-1) and the superseded-subscription rule, with one customer per subject (BY-D4, BY-D5); out-of-order subscription events (re-read, BY-D5); a $0 family first year without a card (`always`, BY-D4, step 8); deploy order before the variable (step 3); the Terms prerequisite before Live; the account subdomain in the webhook URL (placeholder); leftover wording in F-ENT-001 §3.3 and F-ENT-003; F-BILL-002's `items.data[0]` (now the latest item, as the code reads).
- 2026-10-11, merge verifier of BY-1 (#371) and BY-0 (#369), fixed in the docs follow-up PR #385: the F-BILL-002 B-5 PR row and its `entitlements.test.ts` test row still listed `409 already_active` as B-5 work (now marked landed in BY-1; B-5 keeps the `billing.checkout_refused` event that reports it); `design/wireframes/billing/receipts.md` still sent a "lifetime" purchase to the charge receipt (a Family Plan receipt is the hosted invoice, F-BILL-002 §4.10; the charge receipt is for refunds and legacy one-time sandbox payments); F-SPACE-002 tied its "never lost" guarantee to `family_lifetime` (T6b, §4.3, behaviour 12, the entitlement test row and A1 now say: learners keep everything they earned, and access follows the active plan). Two independent reviews of #385 then applied: T6b and behaviour 12 say that when the Family Plan ends, access follows any other active plan that covers the learner (a licensed class or its school), else the free rules; the F-SPACE-002 test row names the existing cases that cover a yearly row through a move; A1 keeps the owner's "lifelong" reason and marks it as no longer true; the receipts wireframe keeps View receipt on a Family Plan year made free and on a failed invoice; the past tense "landed in BY-1" in F-BILL-002 §4.4, the §5.3 checkout row and the `stripe.test.ts` row and in this file's Already active heading; F-BROWSE-001's grown-up line "Opens with Family Lifetime or a Group License" is now "Opens with the Family Plan or a Group License"; F-SPACE-002 added to the README index and to the Status line above.
