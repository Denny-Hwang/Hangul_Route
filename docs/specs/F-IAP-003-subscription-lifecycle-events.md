# F-IAP-003 — Subscription lifecycle events

**Status**: `ready`
**Scope**: Backend / Mobile
**Owner**: solo dev
**Rollout**: MVP (subscription upkeep)

---

## 1. Context

F-IAP-001 activates a subscription from a receipt. But subscriptions also
**change after purchase**: they renew, the user cancels auto-renew, they
expire, or they're refunded. Apple sends App Store Server Notifications and
Google sends Real-Time Developer Notifications for these. This spec adds the
pure status-transition logic and a `POST /api/subscriptions/:familyId/event`
endpoint that applies a normalized lifecycle event.

Receiving and signature-verifying the real store webhooks needs store
credentials and lands in F-IAP-002. This spec ships the **transition logic +
apply route** so that path is ready and testable now.

It also corrects an entitlement edge case: a **cancelled** subscription must
stay valid until its paid period ends (cancel = "don't auto-renew", not
"revoke now").

## 2. User story

> As a parent who cancelled auto-renew, I want to keep premium until the end
> of the period I already paid for — and to lose it cleanly when it expires.

## 3. Acceptance criteria

- `nextStatusForEvent(event)` is pure: `renewed`/`recovered` → `active`,
  `cancelled` → `cancelled`, `expired`/`refunded` → `expired`.
- `POST /api/subscriptions/:familyId/event` with `{ event, expiresAt? }`:
  - unknown family → 404
  - no existing subscription → 422
  - invalid event → 422
  - `renewed`/`recovered` may update `expiresAt`; other events keep it
  - returns the updated subscription
- `entitlementTier` (mobile) treats `cancelled` with a future `expiresAt` as
  `premium`, and `free` once expired or with no expiry.
- api + mobile typecheck and tests pass.

## 4. Out of scope

- Receiving + verifying real Apple/Google webhooks (signatures, JWS) → F-IAP-002.
- Auth ownership on the event endpoint → F-AUTH-001.
- Dunning / billing-retry UI → later.

## 5. Tests

- Unit (api): `nextStatusForEvent` all branches. `src/lib/__tests__/subscription-events.test.ts`.
- Route (api): renew updates expiry, cancel keeps expiry, expire/refund end it,
  invalid event 422, no-subscription 422, unknown family 404.
- Unit (mobile): `entitlementTier` cancelled-but-unexpired → premium.

## 6. Dependencies

- **Upstream**: F-INFRA-002, F-IAP-001, F-SUB-001.
- **Downstream**: F-IAP-002 (real webhooks + secrets), F-AUTH-001.
