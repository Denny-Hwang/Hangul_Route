# F-AUTH-001 — Family ownership (Clerk)

**Status**: `ready`
**Scope**: Backend
**Owner**: solo dev
**Rollout**: MVP (security)

---

## 1. Context

Today any caller who knows a `familyId` can read or mutate that family's
subscription (`/api/subscriptions/:familyId` GET/PUT/verify/event) — a real
authorization hole. This spec gates those routes behind **family ownership**:
the authenticated parent (a Clerk user) must own the family.

Auth method: **Clerk** (decided). `@clerk/backend` `verifyToken` runs in
Workers and verifies a session JWT with `CLERK_SECRET_KEY` / `CLERK_JWT_KEY`
(bound via `wrangler secret`). When no keys are bound (local dev / tests) the
resolver falls back to treating the bearer token as the user id — **never a
production path**.

Children stay anonymous and local-first; only the **parent** authenticates,
and only the parent account maps to Clerk. Child PII never leaves our D1.

## 2. User story

> As a parent, I want only my own account to see or change my family's
> subscription — not anyone who guesses our id.

## 3. Acceptance criteria

- `getAuthUserId(c)` returns the Clerk user id from a verified bearer JWT;
  with no keys bound, returns the bearer string (dev fallback); no/!bearer → null.
- `POST /api/auth/family` records `ownerId` from the authenticated user (if any).
- `/api/subscriptions/:familyId` GET/PUT/verify/event:
  - no bearer → 401
  - bearer that isn't the family owner → 403
  - the owner → proceeds as before
- `families.owner_id` column added to the D1 schema.
- api typecheck + tests pass (dev-fallback bearer simulates the owner).

## 4. Out of scope

- Mobile Clerk sign-in UI (`@clerk/clerk-expo`) + sending the token on requests → F-AUTH-002.
- Ownership gates on profiles / progress / telemetry → F-AUTH-003.
- Real Clerk keys (provisioned by the operator via `wrangler secret`).

## 5. Tests

- `getAuthUserId` dev-fallback + missing-bearer (unit).
- Subscription routes: owner passes, no-bearer 401, wrong-owner 403, across
  GET/PUT/verify/event. In `apps/api/src/__tests__/subscriptions.test.ts`.

## 6. Dependencies

- **Upstream**: F-INFRA-002, F-IAP-001, F-IAP-003.
- **Downstream**: F-AUTH-002 (mobile sign-in), F-AUTH-003 (other routes).
- **External**: a Clerk app; `CLERK_SECRET_KEY` via `wrangler secret put`.
