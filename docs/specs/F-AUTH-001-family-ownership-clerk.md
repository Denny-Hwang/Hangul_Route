# F-AUTH-001 — Family ownership (Clerk)

**Status**: `ready`
**Scope**: Backend
**Owner**: solo dev
**Rollout**: MVP (security)

> **Superseded 2026-10-09 (audit SEC-2).** The dev fallback (bearer string =
> user id when no Clerk key is bound) now runs only when the deployment opts
> in with `ENVIRONMENT=development|test` or `ALLOW_DEV_AUTH=true`
> (`ENVIRONMENT=production` can never opt in). Otherwise a request without
> `CLERK_SECRET_KEY` / `CLERK_JWT_KEY` answers **503 `auth_not_configured`**
> (`packages/backend/src/lib/runtime.ts`). The legacy `/api/subscriptions`
> and `/api/auth` routes this spec gated are unmounted (audit SEC-1, SEC-3);
> the same ownership rule lives in F-ENT-001 and F-SPACE-001.

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

- Mobile Clerk sign-in UI (`@clerk/clerk-expo`) + sending the token on requests → F-AUTH-004 (F-AUTH-002 became the web console sign-in, shipped 2026-10-07).
- Ownership gates on profiles / progress / telemetry → F-AUTH-003.
- Real Clerk keys (provisioned by the operator via `wrangler secret`).

## 5. Tests

- `getAuthUserId` dev-fallback + missing-bearer (unit).
- Subscription routes: owner passes, no-bearer 401, wrong-owner 403, across
  GET/PUT/verify/event. In `apps/api/src/__tests__/subscriptions.test.ts`.

## 6. Dependencies

- **Upstream**: F-INFRA-002, F-IAP-001, F-IAP-003.
- **Downstream**: F-AUTH-002 (console sign-in, web), F-AUTH-004 (mobile sign-in), F-AUTH-003 (other routes).
- **External**: a Clerk app; `CLERK_SECRET_KEY` via `wrangler secret put`.
