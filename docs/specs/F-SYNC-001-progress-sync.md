# F-SYNC-001 — Progress sync (snapshot upload · merge · summary · file backup)

**Status**: `ready`
**Scope**: `packages/content-schema` · `packages/backend` · `apps/api` (schema v2) · `apps/mobile`
**Owner**: solo dev
**Rollout**: Roadmap S1 (`docs/roadmap/multi-persona-sync-platform.md` §2–§4); first of the restore track

---

## 1. Context

Everything a learner earns lives only on the device (`platform/storage`). That is the right default for a kids' app, but it means a deleted app, a new phone, or an iOS storage eviction erases the collection, and no adult can ever see a summary. S1 adds the **one server object** that makes restore, Rescue Code (S2), caregiver dashboards and teacher rosters possible: a per-learner **snapshot** with a client-computed **summary** column, plus a deterministic **merge** so two devices never overwrite each other.

The learner device is unauthenticated (children have no accounts), so the device itself is the principal: registering a learner from a device returns a **device secret** bound to `(learnerId, deviceId)`. Rescue Code (S2) and teacher re-link (S5) mint new bindings for new devices.

## 2. User story

> As a parent, I want my child's cards and stars to survive a lost phone, and I want the app to combine what they did on the tablet and on my phone instead of picking one.

## 3. Acceptance criteria

### 3.1 Schema v2 (additive)

- `learners(id, display_name, age_group, avatar, recovery_hash, created_at, last_active_at)`
- `learner_devices(learner_id, device_id, secret_hash, created_at, last_seen_at)` — the principal for learner traffic.
- `snapshots(learner_id PK, rev, schema_ver, content_ver, device_id, summary_json, payload_json, updated_at)` — one row per learner.
- Legacy v1 tables and routes stay until the client stops using them (they are unused by the shipped client today).

### 3.2 Routes (`/api/sync`)

- `POST /learners` `{ deviceId, learner: { id?, displayName, ageGroup, avatar } }` → 201 `{ learner, device: { deviceId, secret } }`. A client-supplied id (`profile:…`) is kept when unused so a learner keeps its local id.
- `PUT /learners/:id/snapshot` (`Authorization: Device <deviceId>:<secret>`) `{ baseRev, snapshot, summary, schemaVer, contentVer }`
  - `baseRev` equals the stored rev (or 0 with no row) → store, `rev + 1`, 200 `{ rev, updatedAt }`
  - otherwise → **409** `{ rev, snapshot, summary }` so the client merges and retries
  - body validated with `ProgressSnapshotSchema` / `ProgressSummarySchema`; `snapshot.profileId` must equal `:id`
- `GET /learners/:id/snapshot` → `{ rev, snapshot, summary, updatedAt, schemaVer, contentVer }` or 404 `no_snapshot`
- `GET /learners/:id/inbox?since=` → `{ rev, plans: [], memberships: [], tier: 'free', serverTime }` (plans / memberships / tier fill in S3–S6; the shape is fixed now)
- Wrong or missing device secret → 401; a device bound to another learner → 403.

### 3.3 Merge is deterministic (`logic/sync/merge.ts`)

| Field | Rule |
|---|---|
| `quests` | union by `questId`; same id → higher `stars`, tie → higher `accuracy`; `attempts` summed; earliest `startedAt`; earliest defined `completedAt` |
| `episodes` | union by `episodeId`; `questsCompleted` / `totalQuests` max; earliest defined `completedAt` |
| `cards` | union by `cardId`; earliest `unlockedAt`; `newSinceLastView` from local when present |
| `sessions` | union by `id`, sorted by `startedAt` |
| `homework` | union by `id`; a defined `completedAt` wins |
| `reviews` | union by `id`; higher `resultStars` |
| `streakDays` | recomputed from merged sessions (`computeStreak`) |
| `updatedAt` | max; `profileId` from local |

Merging is idempotent and commutative on the sets above (`merge(a,b) ≡ merge(b,a)` except `profileId`).

### 3.4 Summary is client-computed (`logic/sync/summarize.ts`)

`ProgressSummary` (content-schema): `lastActiveAt`, `streakDays`, `stage1 { questsDone, questsTotal, anchorAccuracy | null }`, `cardsUnlocked`, `minutesLast7d`, `jamoRecognized[]`, `needsPractice[]` (≤ 3), `planProgress {}`. Teachers will read only this column (roadmap §3.1).

### 3.5 Sync engine (`logic/sync/engine.ts`)

`syncLearner()` tries `PUT` with the local rev; on 409 it merges with the server snapshot and retries **once**; on a second 409 it returns the merged snapshot with the server rev for the next attempt. Errors never throw into the UI.

### 3.6 File backup (server-less restore path)

- `logic/sync/backup.ts` encodes `{ format: 'hangul-route-backup', version: 1, exportedAt, profile, snapshot }` and decodes/validates with `BackupFileSchema`; unknown versions or malformed JSON produce a typed error, never a throw.
- The file name is `hangul-route-<name>-<date>.hangulroute.json`.

## 4. Out of scope (later stages)

- Client wiring (upload triggers, sync store, settings rows, file pickers) → F-SYNC-002 (same roadmap S1, second PR).
- Rescue Code → F-RESTORE-001 (S2). Spaces / caregiver access → F-SPACE-001 (S3). Plans → F-PLAN-001 (S4). Entitlements → F-ENT-001 (S6).
- Rate limiting on `/api/sync` (arrives with Rescue Code, where it matters).

## 5. UI sketch

- `design/wireframes/sync/save-progress.md`, `sync/restore.md`, `sync/merge-notice.md` (S1 has no new screens; S1-b adds settings rows).

## 6. Tests

| File | Coverage |
|---|---|
| `content-schema/__tests__/sync.test.ts` | summary / put body / backup file schemas parse and reject |
| `backend/__tests__/sync.test.ts` | register, device auth (401/403), put/get, 409 conflict + merged retry, inbox shape |
| `mobile/logic/sync/__tests__/merge.test.ts` | every rule in §3.3, commutativity, idempotence |
| `mobile/logic/sync/__tests__/summarize.test.ts` | §3.4 fields on fixtures |
| `mobile/logic/sync/__tests__/engine.test.ts` | ok / conflict-then-ok / double conflict / error |
| `mobile/logic/sync/__tests__/backup.test.ts` | round trip, version and shape rejection |

## 7. Rollout

- Backend routes ship behind nothing (no client calls them until F-SYNC-002). D1 stays unbound; the in-memory store mirrors `schema-v2.sql`.

## 8. Dependencies

- Upstream: F-PROF-001 (profile shape), `platform/storage`, roadmap schema v2.
- Downstream: F-SYNC-002, F-RESTORE-001, F-SPACE-001, F-PAR-001 (reads `summary`), F-TCH-001 (reads `summary`).
