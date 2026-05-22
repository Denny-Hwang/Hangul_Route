# F-INFRA-002 — D1 binding + subscription persistence

**Status**: `ready`
**Scope**: Infra / Backend
**Owner**: solo dev
**Rollout**: MVP (subscription foundation)

---

## 1. Context

F-INFRA-001 shipped the Worker scaffold and deferred D1 to "F-INFRA-002+".
`apps/api/src/db/schema.sql` already mirrors the in-memory store (families,
profiles, progress, card_unlocks, sessions, events, homework). The
subscription business model (월/연 구독) now needs a persisted subscription
record per family, plus a **declared** D1 binding so the deploy path is ready.

This spec covers:

- a `subscriptions` table + matching store shape and `/api/subscriptions`
  routes (in-memory now, D1-ready),
- a declared (but un-provisioned) `[[d1_databases]]` binding in `wrangler.toml`.

Replacing the in-memory store with real `env.DB` queries, receipt
validation, and auth ownership checks remain downstream.

## 2. User story

> As a parent, I want my subscription status stored against my family so that
> premium content unlocks on every device I sign in on.

## 3. Acceptance criteria

- **Given** a family exists, **when** `GET /api/subscriptions/:familyId` is
  called and no record exists, **then** it returns a default
  `{ status: 'none' }` subscription.
- **Given** an unknown family id, **when** `GET` or `PUT
  /api/subscriptions/:familyId` is called, **then** it returns a 404 envelope.
- **Given** a valid body, **when** `PUT /api/subscriptions/:familyId` is
  called, **then** the record is persisted and returned.
- **Given** an invalid `status`, `plan`, or `store` value, **when** `PUT` is
  called, **then** it returns a 422 envelope.
- **Given** `wrangler.toml`, **then** it declares a `[[d1_databases]]` binding
  named `DB` (database_id is a deploy-time placeholder).
- `pnpm --filter @hangul-route/api typecheck` and `test` pass.

## 4. Out of scope

- Replacing the in-memory store with real `env.DB` D1 queries → F-INFRA-003.
- Apple/Google receipt validation → F-IAP-001.
- Auth / family ownership checks → F-AUTH-001.

## 5. Tests

- Unit (W4 target 90%): subscription GET default, PUT round-trip, enum
  rejection, unknown family. Lives in
  `apps/api/src/__tests__/subscriptions.test.ts`.

## 6. Dependencies

- **Upstream**: F-INFRA-001.
- **Downstream**: F-INFRA-003 (real D1 queries), F-IAP-001 (receipt
  validation), F-AUTH-001 (auth).
- **External**: Cloudflare account; `wrangler d1 create hangul-route` to fill
  the placeholder `database_id`.
