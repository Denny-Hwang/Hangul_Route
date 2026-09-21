# F-PLAN-001 — Plans: publish once, derive homework on the device

**Status**: `ready`
**Scope**: `packages/content-schema` · `packages/backend` · `apps/api` (D1) · `apps/mobile` (derivation, summary, Home) · `apps/web` (plan builder — second PR)
**Owner**: solo dev
**Rollout**: Roadmap S4 — shipped 2026-09-21 (PR 1 server + device §3.1–§3.4; PR 2 console builder + readout §3.5)

Parent: F-SPACE-001 (spaces, `can()`), F-HW-001 §3.4 (assignment merge, gating ruling), F-TCH-001 §3.3 (class plan semantics), roadmap §2 `plans`, §3.3 `planProgress`, §4 (inbox) · wireframes `console/plan-builder.md`, `homework/list.md`, `home/todays-mission.md`

---

## 1. Context

A teacher lays out next week once; thirty children each get their own homework without the server writing thirty rows. The plan is stored once per space, reaches each learner device through the sync inbox, and the device derives `HomeworkAssignment`s with the rules F-HW-001 already has (one explicit assignment per day on card ②, stage gating). Progress flows back through `summary.planProgress` — the only thing the author reads.

## 2. User story

> As a teacher, I want to publish "Week 3" once and later see, per student, how many of its items are done — with children who haven't unlocked an item counted as "not yet ready", never as failing.

## 3. Acceptance criteria

### 3.1 Data

- `plans` row (roadmap §2): `id`, `spaceId`, `authorAccountId`, `title` (≤ 60), `items` (1–30, ordered: `{ kind: 'quest' | 'episode', id, targetDate?, note? }`), `targetLearnerIds` (null = everyone in the space), `publishedAt` (null = draft, never reaches a learner), `archivedAt`, `createdAt`, `updatedAt`. Mirrored in `schema-v2.sql`.
- Inbox row (`InboxPlanSchema`): `{ id, spaceId, spaceKind, spaceName, title, items, publishedAt, updatedAt }`.
- `ProgressSummary.planProgress[planId]` = `{ done, total, notReady }` (`notReady` defaults to 0 so older summaries still parse). `total` counts items the device could assign; `notReady` counts items skipped by gating.

### 3.2 Routes (`/api/spaces/:id/plans`, actor via `can()`)

| Method · path | Who | Result |
|---|---|---|
| `PUT /` `{ id?, title, items, targetLearnerIds?, publish }` | `plan.write` (family owner/caregiver, class owner/teacher) | 201 new / 200 updated `{ plan }`. `publish: true` sets `publishedAt` once; re-saving a published plan keeps it published and bumps `updatedAt`. `targetLearnerIds` must be learner members of the space (422 `unknown_learner`). Unknown `id` → 404 |
| `GET /` | `summary.read` | `{ plans }` newest `updatedAt` first, archived included with `archivedAt` |
| `POST /:planId/archive` | `plan.write` | `{ plan }` with `archivedAt` |
| `GET /api/sync/learners/:id/inbox` | learner device | `plans` = published, non-archived plans of the learner's non-archived spaces where `targetLearnerIds` is null or contains the learner, oldest `publishedAt` first |

### 3.3 Device derivation — `logic/homework/plan-derivation.ts` (pure, 100 %)

- For each inbox plan item: `quest` → that quest; `episode` → the episode's quests in content order. Each quest passes `canAssignQuest` (F-HW-001 gating, `unlockedStages` from the learner's tier); a locked or unknown quest is **skipped silently** and counted in `notReady[planId]` (ruling in F-HW-001 §3.4 / app map §7 #4).
- Assignment id = `<planId>#<questId>` → idempotent: re-applying the same inbox adds nothing. `assignedBy` = `teacher` for class plans, `parent` for family plans. `assignedAt` = `publishedAt`; `targetDate` = the item's date, else today.
- A quest the learner already completed (before or after publishing) is derived as done — the goal is the skill, not repetition. Completing a quest marks every open assignment for that quest done (`progress-store.recordQuestComplete`).
- Pending assignments of a plan that left the inbox (archived, retargeted) are dropped; completed ones stay as history. Non-plan assignments are untouched.
- Runs on every inbox refresh (`membership-store.refresh`, now also triggered after each successful sync); when anything changed the snapshot is replaced and a sync is requested so the author sees progress on the next roster read. `notReady` per plan is kept locally for the summary.

### 3.4 Learner surfaces

- Home card ② (New) is replaced by today's earliest outstanding assignment (`mergeAssignments`, now enabled); extra assignments for the same day queue to later days (F-HW-001 §3.4 cap).
- Homework list shows plan assignments with "From class" / "From home" pills (existing `assignedByLabel`).
- Older app without an item's content id: the item counts as not ready (roadmap §4 "update to see new lessons" banner is a follow-up).

### 3.5 Console (PR 2) — `console/plan-builder`

- `/teach/space/:id/plan`: catalog (Stage 1 episodes → quests, from `apps/web/src/data/stage1-catalog.ts`, a hand-kept mirror), ordered items (↑ ↓ ×, date, note), **Spread dates** (`spreadDates(start, perWeek, n)`, never two on one day; colliding manual dates slide on save with a notice), everyone / only these learners, Publish / Save draft / Archive (confirm), published readout from roster summaries (`done / total`, `n not ready yet`, "waiting for the next sync", last active; roster order, no ranking). Roster's "Plan this week" is live and each student card shows the latest published plan's line.
- Deviations from the wireframe, on purpose: no drag handle (buttons), no client-side gating warning (every catalog item is Stage 1, which every learner has; `notReady` in the readout covers older apps and future premium stages), no "send to ready learners only", no daily-test / story items yet.

## 4. Out of scope

- Daily-test / story-pack items (need F-RVW-001), templates and worksheet PDF (F-TCH-002/003), pace helper beyond even spreading, plan comments, per-learner overrides, push notifications on publish.

## 5. Tests

| File | Coverage |
|---|---|
| `content-schema/__tests__/plan.test.ts` | item / plan / upsert / inbox schemas; `planProgress.notReady` default |
| `backend/__tests__/plans.test.ts` | create draft, publish, update keeps published, archive, target validation, 403 / 404 / 422, GET ordering, inbox filtering (unpublished, archived, targeted, archived space) |
| `mobile/logic/homework/__tests__/plan-derivation.test.ts` | quest + episode items, gating skip → notReady, idempotent, completion carried, vanished plan cleanup, assignedBy per kind, default date |
| `mobile/logic/sync/__tests__/summarize.test.ts` | `planProgress` from plan assignment ids + notReady |
| `mobile/store/__tests__/plan-store.test.ts` | applyPlans derives, persists, replaces the snapshot only when changed |
| `mobile/store/__tests__/membership-store.test.ts` | refresh applies inbox plans and requests a sync |
| `mobile/store/__tests__/sync-store.test.ts` | `onSynced` listeners fire after a successful sync |
| `mobile/store/__tests__/progress-store.test.ts` | completing a quest marks its open assignments done |
