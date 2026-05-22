# F-IAP-001 — In-app purchase receipt verification

**Status**: `ready`
**Scope**: Backend
**Owner**: solo dev
**Rollout**: MVP (subscription activation)

---

## 1. Context

F-INFRA-002 added subscription storage (`subscriptions` table + GET/PUT).
But clients must **not** be trusted to PUT their own `active` status —
activation has to come from a verified store receipt. This spec adds
`POST /api/subscriptions/:familyId/verify`, which takes a store receipt,
verifies it, derives the subscription state from its expiry, and writes it.

Provider verification is a **dev stub** here (it parses a JSON receipt).
Real App Store Server API / Google Play Developer API calls require store
credentials and land in F-IAP-002 behind env secrets.

## 2. User story

> As a parent who just subscribed in the App Store, I want the app to verify
> my receipt so my family's subscription turns active automatically — without
> me (or the client) being able to fake it.

## 3. Acceptance criteria

- `POST /api/subscriptions/:familyId/verify` with `{ store, receipt }`:
  - unknown family → 404
  - missing/invalid `store` (not `apple` | `google`) → 422
  - empty / non-string `receipt` → 422
  - unverifiable receipt → 422
  - valid receipt → subscription stored; `status` derived from expiry; returned
- `statusFromVerification` is a **pure** function, unit-tested (active before
  expiry, expired after).
- `pnpm --filter @hangul-route/api typecheck` and `test` pass.

## 4. Out of scope

- Real Apple/Google verification calls + secrets → F-IAP-002.
- Renewal / cancellation webhooks → F-IAP-003.
- Auth ownership (who may verify for a family) → F-AUTH-001.

## 5. Tests

- Unit: `statusFromVerification` (active/expired around `now`),
  `verifyReceiptStub` (valid JSON vs garbage). In
  `apps/api/src/lib/__tests__/receipt.test.ts`.
- Route: verify happy path, enum/format rejection, unknown family, expired
  receipt. In `apps/api/src/__tests__/subscriptions.test.ts`.

## 6. Dependencies

- **Upstream**: F-INFRA-002.
- **Downstream**: F-IAP-002 (real store verification + secrets), F-IAP-003
  (renewal webhooks), F-AUTH-001 (ownership).
