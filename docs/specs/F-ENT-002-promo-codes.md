# F-ENT-002 — Promotion & referral codes at checkout

**Status**: `ready`
**Scope**: `packages/content-schema` (promo schemas, discount math) · `packages/backend` (Stripe lookup, `/stripe/promo`, checkout discount, attribution) · `apps/web` (`/teach/billing` code box) · `apps/mobile` (one hint line on the paywall)
**Owner**: solo dev
**Rollout**: after F-ENT-001 decision #30 (two products) — shipped 2026-10-06

Parent: F-ENT-001 (products, checkout, webhook) · wireframe `design/wireframes/console/billing.md` (promo box note)

---

## 1. Context

The owner hands out codes — on flyers for a Hangul school, in a creator's post, to a referring family — and the buyer types one in. The owner wants to create, change, pause and expire codes and their discounts **without a deploy**. Stripe already has this (Coupon + Promotion code, with expiry, redemption caps, first-purchase-only and minimum-amount rules), so the app keeps **no code table**: the API looks a code up in Stripe, shows what it is worth, applies it at checkout, and remembers which code a purchase used.

## 2. User story

A parent opens Billing, types `HOYA20`, sees "$12.24 once with HOYA20 (20% off), was $15.30 once", presses Choose and pays the discounted amount. The owner later sees `HOYA20` on that entitlement.

## 3. Acceptance criteria

### 3.1 Data (`content-schema/entitlement.ts`)

- `PROMO_CODE_RE` `^[A-Z0-9][A-Z0-9_-]{1,31}$`; `normalizePromoCode` trims, upper-cases, strips spaces (Stripe matches case-insensitively). `PromoCodeFieldSchema` applies both.
- `Promo` = `{ id (promo_…), code, name | null, percentOff | null, amountOffCents | null (USD only), duration: once | forever | repeating }`.
- `discountedUsd(listUsd, promo)` rounds to cents, never below 0; `promoLabel(promo)` → "20% off" / "$5.00 off".
- `Entitlement.promoCode: string | null` (default null) for attribution; `EntitlementApply.promoCode?`; `schema-v2.sql` column `promo_code`.
- `CheckoutCreateSchema.promoCode?` (normalized) · `PromoCheckSchema { code, planKey }`.

### 3.2 API (`packages/backend`)

- `lookupPromotionCode(env, code)` → `GET /v1/promotion_codes?code=&active=true&limit=1`; `promoFromStripe(obj, nowSec)` returns null when inactive, coupon invalid, expired, fully redeemed, or not parseable. Network trouble reads as "no such code".
- `POST /api/entitlements/stripe/promo { code, planKey }` (account): 422 `promo_invalid` for a malformed code, `stripe_not_configured` without the secret key, 404 `promo_invalid` when Stripe has nothing usable, else `{ promo, price: { planKey, listUsd, discountedUsd } }`. Rate-limited **20 / minute per client** (429 `too_many_attempts`, `Retry-After`).
- `POST /stripe/checkout` accepts `promoCode`; it is **looked up again** server-side (a stale or made-up code → 422 `promo_invalid`, Stripe is never asked to apply it). A valid one becomes `discounts[0][promotion_code]` plus `metadata[promoCode]` (and `subscription_data[metadata][promoCode]` for the yearly licence). Without a code the session sets `allow_promotion_codes=true`, so Stripe's own box still works.
- Webhook: `metadata.promoCode` → `promoCode` on the entitlement (`applyEntitlement` keeps it unless replaced).

### 3.3 Console (`/teach/billing`)

- A **Promo or referral code** box above the plan rows: Apply → `checkPromo` against the first purchasable row; success replaces the price line on every purchasable row with `promoPriceLine` ("$12.24 once with HOYA20 (20% off), was $15.30 once"; a yearly licence on a one-charge coupon adds ", first year"); failure shows one calm line (invalid / too many tries / not set up). Choose sends the code; a `promo_invalid` at that point clears it and explains.
- Copy passes the caregiver ban list; no urgency or "limited time" language.

### 3.4 Child app

- The paywall adds one line: "Have a promo or referral code? A grown-up enters it on the web console." No input in the child app — checkout never lives there.

### 3.5 Owner operations (no deploy)

Stripe Dashboard → Product catalog → **Coupons** → New: percent or fixed amount, duration (`once` for the lifetime price and the first year of a licence; `forever` for every renewal), optional redemption limit and expiry → **Add promotion code**: the customer-facing string (e.g. `HOYA20`, `MSPARK` for a referring teacher), optional per-code limits (max redemptions, expiry, first-time customers only, minimum amount). Pausing = set the promotion code inactive. Referral attribution = one promotion code per referrer; purchases carry the code on the entitlement (`GET /api/entitlements` and the Stripe payment metadata).

## 4. Out of scope

- Rewarding the referrer automatically (credit back, free months) → later spec once the first codes run.
- Codes in native IAP (App Store offer codes) → with F-IAP-002.
- A code table or admin page in the console — Stripe is the source of truth by decision.

## 5. Tests

| File | Covers |
|---|---|
| `content-schema/__tests__/entitlement.test.ts` | normalization, body schemas, `discountedUsd`, `promoLabel` |
| `backend/lib/__tests__/stripe.test.ts` | `promoFromStripe` refusals, `lookupPromotionCode` request + failure modes, `checkoutForm` discount vs `allow_promotion_codes`, webhook `promoCode` |
| `backend/__tests__/entitlements.test.ts` | `/stripe/promo` auth · malformed · unconfigured · found · not found · rate limit; checkout re-validation; attribution through the webhook |
| `web/lib/console/__tests__/billing.test.ts` · `api.test.ts` | `promoPriceLine`, `checkPromo` client |
| `mobile/logic/__tests__/paywall.test.ts` | hint line |
