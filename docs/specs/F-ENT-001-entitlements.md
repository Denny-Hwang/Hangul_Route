# F-ENT-001 — Entitlements: one table, tier from memberships, Stripe on the web

**Status**: `ready`
**Scope**: `packages/content-schema` · `packages/backend` · `apps/api` (D1, Worker secrets) · `apps/mobile` (tier cache, paywall) · `apps/web` (console billing)
**Owner**: solo dev
**Rollout**: Roadmap S6 — PR 1 server + device tier (§3.1–§3.4), PR 2 paywall screen (§3.5), PR 3 console billing (§3.6). Prices stay **placeholders** (owner decision: family price deferred).
**Amended 2026-10-11 [BY]** by `AMENDMENTS-BILLING-FAMILY-YEARLY.md`: the Family plan is a **yearly subscription** ($15.30 / year, renews yearly, cancel any time), no longer a one-time lifetime purchase. The stored key stays `family_lifetime` (BY-D1).
**Amended 2026-10-20 [SA]** by `AMENDMENTS-SEATS-ADMINS.md`: a family holds up to **4** learners, free or paid (`FAMILY_LIFETIME_LEARNERS` 5 → 4); the Group License covers up to **50** students (a stand-alone licensed class, was no cap; a licensed school, was 300); every school holds up to 50 distinct students; seats are taken atomically; checkout and portal need the owner-only `billing.manage`. Prices unchanged.

Parent: roadmap §3.2 (tier rule), §7 (plans), §8 (`/entitlements/*`) · F-SUB-001 (mobile tier consumer) · F-IAP-001 / F-IAP-003 (receipts and lifecycle — converged here through `applyEntitlement`) · wireframes `console/billing.md`, `paywall/upgrade.md`

---

## 1. Context

Who pays is an adult or a space; who benefits is every learner attached to it. One `entitlements` table keyed by subject (account or space) and plan, one pure rule that turns a learner's memberships into a tier, and one apply function that receipts, Stripe webhooks and manual contracts all feed. The child never sees a purchase button.

## 2. User story

> As a teacher on Pro, I want every student in my class to have the full journey while they are enrolled — and as a parent, I want to buy the Family Plan on the web, see the full route on every device my learners use, and cancel any time. [BY]

## 3. Acceptance criteria

### 3.1 Data

- **Products (owner decision #30, 2026-10-06; family term amended 2026-10-11 [BY])**: `family_lifetime` — the **Family Plan**, **$15.30 / year**, renews yearly until cancelled, one family space, up to **4** learners [SA] (`FAMILY_LIFETIME_LEARNERS`), every Stage (new ones included) while active, `expiresAt` = the Stripe subscription's current period end. The key keeps its historical name because D1's CHECK on `plan_key` cannot change additively (BY-D1); rows from the old one-time sandbox checkout (`expiresAt` null) stay readable (BY-D2); `group_license` — **$153 / year**, a stand-alone class (up to **50** students [SA]) or a school (up to 10 teachers / **50** students [SA]); `school_seat` — beyond those caps, by contract (**Contact us**, `manual`). Teacher Pro and monthly intervals are retired. `PLAN_PRICING` in `content-schema` is the one source for the labels.
- `entitlements` (roadmap §2): `id`, `subjectKind` (`account` | `space`), `subjectId`, `planKey` (`family_lifetime` | `group_license` | `school_seat`), `status` (`trial` | `active` | `past_due` | `expired` | `cancelled`), `provider` (`apple` | `google` | `stripe` | `manual`), `providerRef` (subscription / receipt / contract id), `customerRef` (Stripe customer, for the portal), `seats` (school seats, null = unlimited), `expiresAt`, `updatedAt`. Unique per (subject, plan). `schema-v2.sql` mirrors it.
- `applyEntitlement(input, now)` upserts one row; every provider path calls it.

### 3.2 Rules (`lib/entitlement.ts`, pure)

- `isEntitlementActive(e, now)`: `trial` / `active` while `expiresAt` is null or in the future; `cancelled` only while `expiresAt` is in the future (cancel = no renewal, not revoke); `past_due` for **7 days** after `updatedAt`; `expired` never.
- `tierForLearner(learnerId, now)` (roadmap §3.2): **premium** when any of the learner's live spaces is a family with active `family_lifetime`, or a class with its own active `group_license`, or a class under a school with active `group_license` / `school_seat`; otherwise free. Returns the covering space (`kind`, `spaceId`, `name`) as `source`.
- `classCap(space, now)` [SA]: free 20; a stand-alone class with its own group licence 50 (`GROUP_LICENSE_LEARNERS`); a class in a covered school: no class cap, the school cap binds (AMENDMENTS-SEATS-ADMINS section 3.2; was: a licensed class or school → unlimited). Join uses it; lookup reads it only for the advisory `seat` field (AMENDMENTS-SEATS-ADMINS section 3.4). A family space holds at most `FAMILY_LIFETIME_LEARNERS` (4 [SA], was 5) learners (`cap_family` on join).

### 3.3 Routes (`/api/entitlements`)

| Method · path | Who | Result |
|---|---|---|
| `GET /` | account | entitlements for the account itself and for the spaces it owns, each with the space name |
| `POST /verify` `{ spaceId, store, receipt }` | — | **501 `receipt_verification_not_configured`** until F-IAP-002 wires real store verification (audit SEC-1, 2026-10-09: the dev stub granted `family_lifetime` for any JSON blob). Then: verified receipt → `applyEntitlement(space, family_lifetime, apple|google)` |
| `POST /stripe/checkout` `{ planKey, subjectKind: 'space', subjectId }` | space owner (`family_lifetime` → an owned family; `group_license` → an owned stand-alone class or school; a class inside a school is refused 422, the school licence covers it) | Stripe Checkout Session `{ url }`: `mode=subscription` for both plans [BY]: the Family Plan's yearly price `STRIPE_PRICE_FAMILY_YEARLY` (`STRIPE_PRICE_FAMILY_LIFETIME` is ignored) and the licence's `STRIPE_PRICE_GROUP_LICENSE_YEARLY`; subject in the session and `subscription_data` metadata; `409 already_active` when the subject already holds an active Stripe subscription row of that plan, and a later checkout reuses the stored Stripe customer (BY-D4); `stripe_not_configured` without `STRIPE_SECRET_KEY` / the price id |
| `POST /stripe/portal` `{ subjectKind, subjectId }` | account with a Stripe **subscription** row (`providerRef` `sub_…`) on that subject, any plan [BY]; a legacy one-time sandbox row has nothing to manage → 404 | Billing Portal `{ url }`; 503 without keys |
| `POST /stripe/webhook` | Stripe | signature verified with `STRIPE_WEBHOOK_SECRET` (HMAC-SHA256 over `t.body`, 5-minute tolerance, constant-time compare); `checkout.session.completed` → active (`providerRef` = subscription, else payment intent, else session id; a subscription-mode completion leaves `expiresAt` to the subscription events, a legacy payment-mode one keeps it null) [BY]; `customer.subscription.created/updated` → mapped status + the current period end (top level, or `items.data[]` on API 2025-03-31.basil and later); `cancel_at_period_end` or `cancel_at` → `cancelled` until the period end [BY-D5]; `…deleted` → expired; other events → 200 ignored; bad signature → 400; no secret → 503 |
| `GET /api/sync/learners/:id/inbox` | learner device | `tier`, `tierSource`, `tierValidUntil` (= now + 7 days, the offline grace) |

Legacy `/api/subscriptions/*` (v1 family subscription) was removed on 2026-10-09 (audit SEC-1): no shipped client called it, and its receipt stub granted access for any JSON blob. The mobile IAP path arrives through `POST /verify` above with F-IAP-002.

### 3.4 Device

- `tier-store` caches `{ tier, source, validUntil }` per learner from every inbox refresh; `effectiveTier(learnerId, now)` is premium while the cached tier is premium and `validUntil` is in the future (7-day offline grace), or while the legacy family subscription (`account-store`) is premium. `plan-store` unlocks stages from the effective tier.
  > **Amended by AMENDMENTS-ONE-ACCOUNT-MANY-USERS (OA-8, 2026-10-21).** The legacy device subscription is capped like a family: it covers the learners recorded in `account:subscriptionCovers` (grandfathered) and newer learners up to `FAMILY_LIFETIME_LEARNERS` (4), and every profile until that record exists (section 10.5 there).
- Settings plan card shows "Premium · covered by *<space>*" when the tier comes from a class or school.

### 3.5 Paywall (PR 2) — `paywall/upgrade`, PIN-gated

> **Amended by F-ENT-003 (2026-10-11).** F-BILL-002 B-9 replaces this paywall with a status-only Plan screen (no price). While the effective switch (`gatingActive`: `contentGatingEnabled` on the web; never on native until F-IAP-002) is on, its free state reads F-ENT-003's line "Stage 1 is free: {lessons} lessons, {letters} letters, about {minutes} minutes. Everything finished stays." (numbers from data; all of Stage 1 is free and paid plans open Stage 2 onward, owner decision F-ENT-003 OD-1 of 2026-10-11) in place of "Stage 1 is always free", with one extra line for a class learner or finished free lessons; `from` gains `episode`, `home`, `results` (F-ENT-003 §3.9.1, PR E3-8). With the switch off this section is unchanged until B-9.

> **Amended by F-APP-001 (2026-10-11).** On the web with `flags.grownUpHomeEnabled` on, the Plan screen's **Open billing** opens `/account/billing` on the app host **in the same tab** through `openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })`, after a fresh PIN (F-APP-001 sections 3.6, 3.9). With the flag off the console link of F-BILL-002 (`billingUrl()`, new tab) applies. Native builds show no purchase link.

- Entered from a locked Stage 2+ cell on the journey grid and from the settings plan card, through `profiles/pin-entry`.
- States: **covered** (premium via class/school — no prices, "Back to journey"), **already premium** (family), **free** — "Stage 1 is always free" first, 4 bullets (every Stage, cloud save, dashboard, up to **4** learners [SA]), **one Family Plan card ($15.30 / year, "Renews every year. Cancel any time.")** [BY], one button that opens the web console billing (`EXPO_PUBLIC_CONSOLE_URL`, web) or explains the store purchase arrives with F-IAP-002 (native). Never a teacher/school plan on the native app.

### 3.6 Console billing (PR 3) — `/teach/billing`

> **Amended by F-APP-001 (2026-10-11).** Billing lives at **`/account/billing` on `app.hangulroute.com`** for every grown-up (`APP_ROUTES.billing`; F-BILL-002 sets `BILLING_PATH = '/account/billing'` and owns the page content). `/teach/billing` stays on the app host only as a client redirect page to `/account/billing` with the query kept (F-APP-001 A-5c), so in-flight Stripe returns still land; Stripe return URLs move to the app host with F-BILL-002 B-10 (`BILLING_URL`). Until F-SITE-002 S-10 hangulroute.com keeps serving `/teach/billing` itself.

- Current plan card(s) from `GET /entitlements` (a Family Plan reads "active · renews {date}" and has **Manage subscription** like a licence [BY]; a legacy one-time sandbox row reads "active" with no Manage button), plan rows: Family Plan per owned family, Group License per owned stand-alone class and per owned school, School Contract (Contact us) per school; no billing-interval selector. **Choose** → checkout, **Manage subscription** → portal (every subscription, the Family Plan included [BY]), roster cap nudge links here. Home's Billing button becomes live.

## 4. Out of scope

- Real App Store / Play verification (F-IAP-002), invoices list, seat accounting UI (S7), coupons, tax, manual contracts UI (D1 insert by the owner), price decisions.

## 5. Tests

| File | Coverage |
|---|---|
| `content-schema/__tests__/entitlement.test.ts` | schemas, apply input, inbox tier fields default |
| `backend/lib/__tests__/entitlement.test.ts` | `isEntitlementActive` matrix incl. past-due grace, `tierForLearner` for family / class-pro / school-license / none, `classCap` |
| `backend/lib/__tests__/stripe.test.ts` | signature parse + HMAC verify (valid, tampered, stale), status mapping, event → apply input, checkout params |
| `backend/__tests__/entitlements.test.ts` | list, verify (always 501, grants nothing), checkout (rights, 503 without keys, session via injected fetch), portal, webhook (bad signature, unknown event, subscription lifecycle → inbox tier flips), dynamic class cap |
| `mobile/store/__tests__/tier-store.test.ts` | apply from inbox, grace, legacy subscription fallback |
| `mobile/store/__tests__/membership-store.test.ts` / `plan-store.test.ts` | refresh feeds the tier store; unlocked stages follow the effective tier |
