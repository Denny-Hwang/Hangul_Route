# F-INFRA-003 — Persist schema v2 in D1

**Status**: `ready` (shipped 2026-10-07)
**Scope**: `packages/backend` (`src/db/*`, every v2 route and rule, tests) · `apps/api/wrangler.toml` comment · CI
**Owner**: solo dev
**Rollout**: after the owner created D1 `hangul-route` and the Workers Builds deploy command applied `apps/api/migrations` (PR #84)

Parent: F-INFRA-002 (binding + schema) · F-SYNC-001 / F-SPACE-001 / F-PLAN-001 / F-TCH-001 §10 / F-ENT-001 / F-ENT-002 (the data these routes keep)

---

## 1. Context

Until now the API kept everything in process memory: every redeploy — and every new Workers isolate — started empty, so a learner's Rescue Code, a class roster or a paid entitlement could vanish between two requests. The schema already existed in D1 (migrations applied at deploy); this spec moves the reads and writes there without changing any route's contract.

## 2. User story

A parent buys Family Lifetime on Sunday; on Monday, after a deploy, the child's device still syncs, the teacher still sees the roster, and the entitlement still unlocks Stage 2.

## 3. Acceptance criteria

### 3.1 One interface, two backends (`src/db`)

- `Db` (`db/types.ts`): async accessors for accounts, learners, devices, snapshots, spaces, memberships, plans, re-link requests and entitlements, plus `reset()` for tests. Reads return **copies**; callers mutate and `put`. `mergeEntitlement` holds the F-ENT-001 upsert rule for both backends.
- `D1Db` (`db/d1.ts`): SQL against the migrations' tables through the slice of the D1 API this package uses (`prepare → bind → first | all | run`). JSON columns (`settings_json`, `items_json`, `summary_json`, …) round-trip; upserts use `ON CONFLICT … DO UPDATE`; `deleteLearner` removes memberships and relink requests explicitly and lets the schema cascade devices and snapshots.
- `MemoryDb` (`db/memory.ts`): the same contract over Maps, returning `structuredClone`s so a route that forgets to `put` fails in tests exactly as on D1.
- `dbFor(c)` (`db/index.ts`): `env.DB` → a cached `D1Db` per binding; otherwise the fallback (`memoryDb`, or whatever tests set with `setFallbackDb`).

### 3.2 Routes and rules

- `lib/access.ts` (`requireAccount`, `accountActor`, `spaceContext`, `learnerContexts`), `lib/device-auth.ts` (`authorizeDevice` persists `lastSeenAt`), `lib/entitlement.ts` (every rule takes `db`) and the routes `spaces`, `school`, `relink`, `sync`, `plans`, `recovery`, `entitlements` read and write only through `Db`. Response shapes are unchanged (the existing route suites pass untouched except for how they seed data).
- Join codes are unique across all spaces (the column is `UNIQUE`), not only across live codes.
- Expired re-link requests are persisted as `expired` the first time they are read after their window.
- The legacy v1 store (families / profiles / progress / subscriptions / events) stays in memory; no client calls those routes (F-SYNC-001). Dropping them is a later migration.

### 3.3 Tests

- `db/__tests__/db-contract.test.ts` runs one contract against `MemoryDb` and against `D1Db` over a **SQLite shim** (`__tests__/helpers/sqlite.ts`, Node's built-in `node:sqlite`, foreign keys on) that applies the real `apps/api/migrations/*.sql`.
- The whole backend suite runs twice in CI: in-memory (`pnpm test`) and SQLite (`HR_TEST_DB=sqlite`, `test:sqlite`) — the vitest setup file picks the fallback backend, so route tests do not change per backend.

## 4. Out of scope

- v1 tables and routes (`families`, `profiles`, …) → a drop migration once the mobile client's legacy paths are removed.
- D1 batching / transactions (each route is a handful of statements; D1 queries are per-request serial) → revisit with load data.
- Backups / export of D1 → owner runbook item once there is real data.

## 5. Tests

| File | Covers |
|---|---|
| `backend/src/db/__tests__/db-contract.test.ts` | every `Db` method on both backends (16 cases) |
| `backend/src/__tests__/*.test.ts` + `lib/__tests__/entitlement.test.ts` | routes and rules, memory and SQLite (145 each) |
| CI `ci.yml` | `pnpm test` + `test:sqlite`, API `wrangler deploy --dry-run`, migrations applied to a local D1 |
