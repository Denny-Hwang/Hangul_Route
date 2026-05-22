# F-SUB-001 — Subscription entitlement

**Status**: `ready`
**Scope**: Mobile
**Owner**: solo dev
**Rollout**: MVP (subscription gating)

---

## 1. Context

F-INFRA-002 stores a subscription per family; F-IAP-001 activates it from a
verified receipt. The mobile app now needs to **consume** that state to decide
what a child can open. Business model: monthly/yearly subscription with
**Stage 1 (Hangul) always free** as the taste, and the rest of the journey
behind premium.

This spec is the pure entitlement layer: a function that maps a subscription
to an access tier, and a function that maps a tier + stage to access. UI
surfaces (Journey lock, paywall) consume it; this PR wires only the
ProfileScreen status display, since Stages 2–7 content is still preview.

## 2. User story

> As a parent, I want Stage 1 free so my child can try it, and the full
> journey to unlock when I subscribe — on every device I sign in on.

## 3. Acceptance criteria

- `entitlementTier(subscription, now)` returns `'premium'` only when status is
  `active` or `trial` **and** `expiresAt` is in the future; otherwise `'free'`
  (including `null` subscription).
- `isStageEntitled(stageKey, tier)` returns `true` for `stage1` regardless of
  tier, and for any stage when tier is `premium`.
- Both functions are pure and unit-tested across all branches.
- `account-store` persists the family subscription and rehydrates it.
- ProfileScreen shows the current plan (Free / Premium) and what it unlocks.
- `pnpm --filter @hangul-route/mobile typecheck` and `test` pass.

## 4. Out of scope

- Paywall / purchase UI and StoreKit/Play Billing → F-IAP-004.
- Journey grid premium lock styling → folds in when Stage 2+ content lands.
- Fetching subscription from the API → needs deploy + auth (F-AUTH-001).

## 5. Tests

- Unit: `entitlementTier` (none/active/trial/expired/cancelled, future vs past
  expiry, null), `isStageEntitled` (stage1 free, stage2 gated, premium opens
  all). In `apps/mobile/src/logic/__tests__/entitlement.test.ts`.

## 6. Dependencies

- **Upstream**: F-INFRA-002, F-IAP-001.
- **Downstream**: F-IAP-004 (paywall), F-AUTH-001 (cross-device sync).
