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

- `learners(id, display_name, age_group, avatar, recovery_hash, created_at, last_active_at)`; migration 0010 (additive, 2026-10-14) adds `profile_updated_at TEXT NULL` (§3.7)
- `learner_devices(learner_id, device_id, secret_hash, created_at, last_seen_at)` — the principal for learner traffic.
- `snapshots(learner_id PK, rev, schema_ver, content_ver, device_id, summary_json, payload_json, updated_at)` — one row per learner.
- Legacy v1 tables and routes stay until the client stops using them (they are unused by the shipped client today).

### 3.2 Routes (`/api/sync`)

- `POST /learners` `{ deviceId, learner: { id?, displayName, ageGroup, avatar } }` → 201 `{ learner, device: { deviceId, secret } }`. A client-supplied id (`profile:…`) is kept when unused so a learner keeps its local id. `ageGroup` is an **opaque level id** (`LearnerLevelId`: `5-7`, `8-9`, `10-11`), not an age; display it with `levelLabel()` from `@hangul-route/content-schema`. The learner's `learnerType` (who is learning) stays on the device and is not part of this contract (F-LEARN-001 §3.1, L2).
- `PUT /learners/:id/snapshot` (`Authorization: Device <deviceId>:<secret>`) `{ baseRev, snapshot, summary, schemaVer, contentVer }`
  - `baseRev` equals the stored rev (or 0 with no row) → store, `rev + 1`, 200 `{ rev, updatedAt }`
  - otherwise → **409** `{ rev, snapshot, summary }` so the client merges and retries
  - the rev check and the write are **one compare-and-set** (SYNC-1, 2026-10-09): `INSERT … ON CONFLICT DO NOTHING` for base rev 0, `UPDATE … WHERE learner_id = ? AND rev = ?` otherwise, success only when `meta.changes === 1`. Two devices uploading on the same base rev get one 200 and one 409, never two 200s
  - body validated with `ProgressSnapshotSchema` / `ProgressSummarySchema`; `snapshot.profileId` must equal `:id`
- `GET /learners/:id/snapshot` → `{ rev, snapshot, summary, updatedAt, schemaVer, contentVer }` or 404 `no_snapshot`
- `GET /learners/:id/inbox?since=` → `{ rev, plans: [], memberships: [], tier: 'free', serverTime }` (plans / memberships / tier fill in S3–S6; the shape is fixed now). Since 2026-10-14 a full-scope device also gets `learner: { displayName, ageGroup, avatar, profileUpdatedAt }` (§3.7); a class tablet never does. Sent with `Cache-Control: no-store`.
- `PATCH /learners/:id` → the learner's name, level or picture after registration (§3.7).
- Wrong or missing device secret → 401; a device bound to another learner → 403.

### 3.3 Merge is deterministic (`logic/sync/merge.ts`)

| Field | Rule |
|---|---|
| `quests` | union by `questId`; same id → higher `stars`, tie → higher `accuracy`; `attempts` summed; earliest `startedAt`; earliest defined `completedAt` |
| `episodes` | union by `episodeId`; `questsCompleted` / `totalQuests` max; earliest defined `completedAt` |
| `cards` | union by `cardId`; earliest `unlockedAt`; `newSinceLastView` true only when both sides still have it new ("seen anywhere = seen", F-STORY-006 §3.6 M3) |
| `sessions` | union by `id`, sorted by `startedAt` |
| `homework` | union by `id`; a defined `completedAt` wins |
| `reviews` | union by `id`; higher `resultStars` |
| `streakDays` | recomputed from merged sessions (`computeStreak`) |
| `updatedAt` | max; `profileId` from local |

Merging is idempotent and commutative on the sets above (`merge(a,b) ≡ merge(b,a)` except `profileId`).

`rebaseSnapshot(base, ours, theirs)` folds a server answer into a copy that changed while the request was in flight (F-SYNC-002 §3.2). `base` went up, `theirs` came back and already holds `base`, `ours` is `base` plus the writes made since. It applies the rules above after one step: for each quest `theirs` holds, the `attempts` that `base` already gave it are subtracted from `ours`, so each attempt counts once. A quest whose `completedAt` in `ours` is later than in `base` (finished during the request) keeps the later date; between devices the earliest-`completedAt` rule above still holds.

### 3.4 Summary is client-computed (`logic/sync/summarize.ts`)

`ProgressSummary` (content-schema): `lastActiveAt`, `streakDays`, `stage1 { questsDone, questsTotal, anchorAccuracy | null }`, `cardsUnlocked`, `minutesLast7d`, `jamoRecognized[]`, `needsPractice[]` (≤ 3), `planProgress {}`. Teachers will read only this column (roadmap §3.1).

### 3.5 Sync engine (`logic/sync/engine.ts`)

`syncLearner()` tries `PUT` with the local rev; on 409 it merges with the server snapshot and retries **once**; on a second 409 it returns the merged snapshot with the server rev for the next attempt. Errors never throw into the UI.

### 3.6 File backup (server-less restore path)

- `logic/sync/backup.ts` encodes `{ format: 'hangul-route-backup', version: 1, exportedAt, profile, snapshot }` and decodes/validates with `BackupFileSchema`; unknown versions or malformed JSON produce a typed error, never a throw.
- The file name is `hangul-route-<name>-<date>.hangulroute.json`.

### 3.7 Learner profile edits after registration (SYNC-PROF-1, 2026-10-14)

A learner renamed on the device ("test" → "Sungjoo") kept the old name on the teacher and family consoles: nothing on the server changed `learners.display_name` after registration, and two whole-row writes could undo a concurrent write. Every console view reads the live row, so fixing the row fixes the consoles.

| # | Deliverable | Acceptance |
|---|---|---|
| 1 | `DisplayNameSchema` (content-schema) | The device rule of F-PROF-001 §3.2 (`validateDisplayName`): trim, 1–12, Latin and accents U+00C0–U+024F, Hangul syllables, digits, space, `'` / U+2019, hyphen. Checks a name newly typed in the app's edit screen, on the device. The server checks incoming names on `POST /learners`, `PATCH /learners/:id` and the join with the lenient `LegacyDisplayNameSchema` (trim, 1–20, the bound `ProfileSchema` keeps; no C0/C1 control characters, U+200B, U+200E–U+200F, U+202A–U+202E, U+2060–U+2069 or U+FEFF, which no device rule ever produced and which would reach every console; other characters, emoji included, stay accepted for legacy names), because apps hold legacy names ("Alexandria Mae", "Mina_K") and send them unchanged: a stricter server rule would refuse first-time registration, and the one-time re-push of the current name, on every retry. A stored legacy name is never re-checked or rewritten. Its message is for developers; clients map errors by code through `packages/i18n` |
| 2 | `PATCH /learners/:id` `{ displayName?, ageGroup?, avatar?, at }` | Strict body, at least one field; no rate limit (newest-edit-wins makes a repeat harmless); `learnerType`, `parentPinHash`, consent, `recoveryHash` or any other key → 422 (L2: those stay on the device). Full-scope device only: a class tablet → 403 `scope_limited` (SEC-4); bad secret → 401/403. 422 issues carry path and code only. 200 `{ learner, applied }` |
| 3 | Newest edit wins, by the device clock | `at` is the device's edit time; an `at` in the future is read as server time. Writes only the sent columns plus `profile_updated_at = at`, while the stored value is null or not newer. A stale edit → 200 `applied: false`, nothing changed; the app then adopts `learner` from the response (or the inbox block) as the truth and does not retry (a device clock behind a newer edit). Only PATCH writes `profile_updated_at`, so server time never enters this order |
| 4 | Join repair (`POST /api/spaces/:id/join`, F-SPACE-001 §3) | For app builds that cannot PATCH: a join (first or again) with a `displayName` (trim, 1–20, the lenient server rule of #1) writes the name column only, and only while `profile_updated_at` is null. Once a PATCH has applied, PATCH is the only writer of the name. A legacy name never fails the join and applies as sent. Best effort: a failed name write never fails the join (a fixed log code, never the name) |
| 5 | Column-targeted writes (no lost update) | The snapshot PUT writes `last_active_at` only (`touchLearner`); the Rescue Code issue writes `recovery_hash` only (`setRecoveryHash`); `putLearner` is the first insert only. Both Db adapters, in `db-contract.test.ts` |
| 6 | Inbox `learner` block | Full-scope devices only. Lenient per field in `SyncInboxSchema` (a legacy level reads as null, never hides the name); optional, so older apps parse the inbox |
| 7 | Privacy | The name travels in the JSON body only: never in a URL, a log line, a server event or telemetry |
| 8 | No-store | `Cache-Control: no-store` on every GET under `/api/spaces/*` and on the inbox |
| 9 | Migration and deploy order | Migration 0010 (one `ADD COLUMN`) and this Worker deploy before the app PR that sends the PATCH (PR2). Until PR2, a renamed learner on the current build is repaired by joining again through **new here** → confirm name (picking the old name from the list sends a relink request, not a name). Rollback: an older Worker never reads the column |
| 10 | App one-time repair (`hr:profilePushedV1`, PR2) | On the first sync of the build that sends the PATCH, each registered learner's name, level and cub are checked once against the inbox `learner` block. A row another device's PATCH stamped wins and comes down. On an unstamped row, the values that differ from the device profile go up, the name included. That includes a name a grown-up typed at join on an older build that differs from the profile: the device cannot tell it from a rename that never synced, and the learner has one name everywhere (F-LEARN-001 §3.11). A class that should not see full names uses the space's anonymized roster, and the name can be changed on purpose in Edit profile. A class tablet (scope marker `class`) skips the check with no request and no error; the learner's own device sends the values. Every learner's sync record is read before anything is queued. A learner whose sync record cannot be read (the storage read fails, which is not the same as no record) stops the pass: nothing is queued, no blank record is cached, and the marker stays unset, so the repair runs again on the next start. A learner with no record at all is not registered yet: it is skipped and does not hold the marker back. A stored record that does not parse also counts as no record: it cannot be recovered by reading again. While a learner's record cannot be read, no sync registers that learner or writes its record (a blank record saved over it would lose the device secret). A profile edit made then is not queued: it clears the marker instead, so the next start's repair queues the profile's current values. |

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
| `backend/__tests__/sync.test.ts` | register, device auth (401/403), put/get, 409 conflict + merged retry, concurrent PUTs on one base rev (one wins), inbox shape |
| `backend/db/__tests__/db-contract.test.ts` | `putSnapshot(record, baseRev)` compare-and-set on both backends |
| `backend/__tests__/learner-rename.test.ts` | §3.7: rename shows on every console view (alias too), PATCH refusals, stale and future `at`, slow device clock, join repair and its limits, inbox block, no name in events or logs, lost-update races |
| `backend/db/__tests__/migration-0010.test.ts` | §3.7 #9: one additive column; old rows read `profileUpdatedAt: null` |
| `content-schema/__tests__/display-name.test.ts` | §3.7 #1, #2, #6 |
| `mobile/logic/sync/__tests__/merge.test.ts` | every rule in §3.3, commutativity, idempotence; `rebaseSnapshot` attempts subtraction and kept `completedAt` |
| `mobile/logic/sync/__tests__/summarize.test.ts` | §3.4 fields on fixtures |
| `mobile/logic/sync/__tests__/engine.test.ts` | ok / conflict-then-ok / double conflict / error |
| `mobile/logic/sync/__tests__/backup.test.ts` | round trip, version and shape rejection |

## 7. Rollout

- Backend routes ship behind nothing (no client calls them until F-SYNC-002). D1 stays unbound; the in-memory store mirrors `schema-v2.sql`.

## 8. Dependencies

- Upstream: F-PROF-001 (profile shape), `platform/storage`, roadmap schema v2.
- Downstream: F-SYNC-002, F-RESTORE-001, F-SPACE-001, F-PAR-001 (reads `summary`), F-TCH-001 (reads `summary`).
