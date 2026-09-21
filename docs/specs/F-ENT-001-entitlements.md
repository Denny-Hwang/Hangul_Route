# F-ENT-001 — Entitlements: one table, tier from memberships, Stripe on the web

**Status**: `ready`
**Scope**: `packages/content-schema` · `packages/backend` · `apps/api` (D1, Worker secrets) · `apps/mobile` (tier cache, paywall) · `apps/web` (console billing)
**Owner**: solo dev
**Rollout**: Roadmap S6 — PR 1 server + device tier (§3.1–§3.4), PR 2 paywall screen (§3.5), PR 3 console billing (§3.6). Prices stay **placeholders** (owner decision: family price deferred).

Parent: roadmap §3.2 (tier rule), §7 (plans), §8 (`/entitlements/*`) · F-SUB-001 (mobile tier consumer) · F-IAP-001 / F-IAP-003 (receipts and lifecycle — converged here through `applyEntitlement`) · wireframes `console/billing.md`, `paywall/upgrade.md`

---

## 1. Context

Who pays is an adult or a space; who benefits is every learner attached to it. One `entitlements` table keyed by subject (account or space) and plan, one pure rule that turns a learner's memberships into a tier, and one apply function that receipts, Stripe webhooks and manual contracts all feed. The child never sees a purchase button.

## 2. User story

> As a teacher on Pro, I want every student in my class to have the full journey while they are enrolled — and as a parent, I want to pay once on the web and see Premium on every device my kids use.

## 3. Acceptance criteria

### 3.1 Data

- `entitlements` (roadmap §2): `id`, `subjectKind` (`account` | `space`), `subjectId`, `planKey` (`family_premium` | `teacher_pro` | `school_license` | `school_seat`), `status` (`trial` | `active` | `past_due` | `expired` | `cancelled`), `provider` (`apple` | `google` | `stripe` | `manual`), `providerRef` (subscription / receipt / contract id), `customerRef` (Stripe customer, for the portal), `seats` (school seats, null = unlimited), `expiresAt`, `updatedAt`. Unique per (subject, plan). `schema-v2.sql` mirrors it.
- `applyEntitlement(input, now)` upserts one row; every provider path calls it.

### 3.2 Rules (`lib/entitlement.ts`, pure)

- `isEntitlementActive(e, now)`: `trial` / `active` while `expiresAt` is null or in the future; `cancelled` only while `expiresAt` is in the future (cancel = no renewal, not revoke); `past_due` for **7 days** after `updatedAt`; `expired` never.
- `tierForLearner(learnerId, now)` (roadmap §3.2): **premium** when any of the learner's live spaces is a family with active `family_premium`, or a class whose owner has active `teacher_pro`, or a class under a school with active `school_license` / `school_seat`; otherwise free. Returns the covering space (`kind`, `spaceId`, `name`) as `source`.
- `classCap(space, now)`: the free cap (20) unless the class owner has active `teacher_pro` or the parent school is licensed → unlimited. Join and lookup use it.

### 3.3 Routes (`/api/entitlements`)

| Method · path | Who | Result |
|---|---|---|
| `GET /` | account | entitlements for the account itself and for the spaces it owns, each with the space name |
| `POST /verify` `{ spaceId, store, receipt }` | family owner | F-IAP-001 receipt (dev stub until F-IAP-002) → `applyEntitlement(space, family_premium, apple|google)` |
| `POST /stripe/checkout` `{ planKey, interval, subjectKind, subjectId }` | account (`teacher_pro` → self; `family_premium` → an owned family; `school_license` → an owned school) | Stripe Checkout Session `{ url }` with the subject in metadata; 503 `stripe_not_configured` without `STRIPE_SECRET_KEY` / price ids |
| `POST /stripe/portal` `{ subjectKind, subjectId }` | account with an active Stripe entitlement on that subject | Billing Portal `{ url }`; 503 without keys |
| `POST /stripe/webhook` | Stripe | signature verified with `STRIPE_WEBHOOK_SECRET` (HMAC-SHA256 over `t.body`, 5-minute tolerance, constant-time compare); `checkout.session.completed` → active; `customer.subscription.created/updated` → mapped status + `current_period_end`; `…deleted` → expired; other events → 200 ignored; bad signature → 400; no secret → 503 |
| `GET /api/sync/learners/:id/inbox` | learner device | `tier`, `tierSource`, `tierValidUntil` (= now + 7 days, the offline grace) |

Legacy `/api/subscriptions/*` (v1 family subscription) stays untouched until the mobile IAP path moves over (F-IAP-002).

### 3.4 Device

- `tier-store` caches `{ tier, source, validUntil }` per learner from every inbox refresh; `effectiveTier(learnerId, now)` is premium while the cached tier is premium and `validUntil` is in the future (7-day offline grace), or while the legacy family subscription (`account-store`) is premium. `plan-store` unlocks stages from the effective tier.
- Settings plan card shows "Premium · covered by *<space>*" when the tier comes from a class or school.

### 3.5 Paywall (PR 2) — `paywall/upgrade`, PIN-gated

- Entered from a locked Stage 2+ cell on the journey grid and from the settings plan card, through `profiles/pin-entry`.
- States: **covered** (premium via class/school — no prices, "Back to journey"), **already premium** (family), **free** — "Stage 1 is always free" first, 3–4 bullets, monthly / yearly cards with placeholder prices, one button that opens the web console billing (`EXPO_PUBLIC_CONSOLE_URL`, web) or explains the store purchase arrives with F-IAP-002 (native). Never a teacher/school plan on the native app.

### 3.6 Console billing (PR 3) — `/teach/billing`

- Current plan card(s) from `GET /entitlements`, plan rows per role with placeholder prices, **Choose** → checkout, **Manage subscription** → portal, roster cap nudge links here. Home's Billing button becomes live.

## 4. Out of scope

- Real App Store / Play verification (F-IAP-002), invoices list, seat accounting UI (S7), coupons, tax, manual contracts UI (D1 insert by the owner), price decisions.

## 5. Tests

| File | Coverage |
|---|---|
| `content-schema/__tests__/entitlement.test.ts` | schemas, apply input, inbox tier fields default |
| `backend/lib/__tests__/entitlement.test.ts` | `isEntitlementActive` matrix incl. past-due grace, `tierForLearner` for family / class-pro / school-license / none, `classCap` |
| `backend/lib/__tests__/stripe.test.ts` | signature parse + HMAC verify (valid, tampered, stale), status mapping, event → apply input, checkout params |
| `backend/__tests__/entitlements.test.ts` | list, verify (rights + stub), checkout (rights, 503 without keys, session via injected fetch), portal, webhook (bad signature, unknown event, subscription lifecycle → inbox tier flips), dynamic class cap |
| `mobile/store/__tests__/tier-store.test.ts` | apply from inbox, grace, legacy subscription fallback |
| `mobile/store/__tests__/membership-store.test.ts` / `plan-store.test.ts` | refresh feeds the tier store; unlocked stages follow the effective tier |
