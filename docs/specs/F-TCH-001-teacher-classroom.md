# F-TCH-001 — Teacher / Classroom Management

**Status**: `ready` (promoted 2026-09-21 — §10 is the authoritative S5 scope; §3.1–§3.3 are shipped through F-SPACE-001 / F-CONSOLE-001 / F-PLAN-001, §3.4 stays deferred)
**Scope**: `apps/web` (teacher console) · `apps/mobile` (in-class projection, learner classroom join) · `packages/backend` · Phase 2
**Owner**: solo dev
**Rollout**: Phase 2 (post-MVP). MVP placeholder only — Profile role enum reserves `teacher` and `co-parent`, no UI ships.

Parent doc: `docs/blueprints/09-homework-review-profiles-addendum.md` §3, and `02-core-feature-spec §6` (Classroom).

---

## 1. Context

Korean weekend schools (한글학교) and immersion classrooms are an underserved channel that DinoLingo and others have *flagged* but not delivered. `02-core-feature-spec §6` outlines the Classroom blueprint (Projection · Class Builder · Roster · Worksheets). F-TCH-001 lands the **minimum viable teacher surface** that converts that blueprint into shippable scope:

1. **Class create + 6-digit join code** — the cheapest possible roster mechanism.
2. **Class Roster view** — read-only summary, sibling-style cards to F-PAR-001's parent dashboard but with classroom semantics.
3. **Class-level homework assignment** — one assignment, fan-out to all roster learners.
4. **Projection Mode toggle** on mobile — teacher uses one device to drive the room.

Class Builder (drag templates) and Worksheet PDF generation are explicit out-of-scope here — they get their own specs (F-TCH-002, F-TCH-003) once F-TCH-001 ships.

## 2. User story

> As a **한글학교 teacher** with 12 students, I want to create a class, hand out a 6-digit code, then assign tonight's homework to all 12 in two taps, so my Sunday afternoon prep stays under 5 minutes.

Companion stories:

- As a **teacher**, I want to flip a switch and have the lesson display in 200% font on the classroom TV, so I don't have to fiddle with screen mirroring.
- As a **co-parent of a heritage child**, I want my child's progress in the classroom to also appear on my parent dashboard at home (Phase 3 unlock — flagged here as a known requirement).

## 3. Acceptance criteria

### 3.1 Class creation + join code

> **Migrated to F-SPACE-001 (shipped 2026-09-21)** — spaces / memberships / join code / caps / `can()` and the learner's `sync/join-space` screen live there. The "parent-gated" entry below is superseded by F-SPACE-001 §3.5 (no PIN: the teacher helps in the room; app map §7 #21). This section stays as the original intent.

- **Given** a teacher profile signs up via Clerk (Phase 2 — teacher onboarding is web-first),
  **when** the teacher creates a class,
  **then** a 6-character base32 **join code** is generated (e.g. `K7M2X9`), unique across all active classes, valid for 30 days, regenerable.
- **Given** a learner enters a join code from `profile/settings` → `sync/join-space` (parent-gated on the learner device; wireframe `design/wireframes/sync/join-space.md`),
  **when** the code validates,
  **then** the learner profile becomes a member of that class (membership = `(profileId, classId, role: 'student')`). A learner may belong to at most **3 classes simultaneously** (MVP cap).
- Codes use base32 (no I, O, 1, 0) to avoid confusable characters when read aloud.

### 3.2 Roster view (teacher console — web)

```
┌─────────────────────────────────────────────────┐
│  Sunday Class — 12 students                     │
│  Join code: K7M2X9   [regenerate]               │
├─────────────────────────────────────────────────┤
│  This week (class roll-up)                      │
│   · Class avg time-on-app: 27 min               │
│   · Stage 1 anchor: 71% (was 67%)               │
│   · 3 students need extra ㅂ practice           │
├─────────────────────────────────────────────────┤
│  Students                                       │
│   민호       Stage 1 Ch 2   ▰▰▰▱▱   38 min     │
│   수지       Stage 1 Ch 1   ▰▰▱▱▱   12 min     │
│   ...                                           │
└─────────────────────────────────────────────────┘
```

- Same anti-shame copy rules as F-PAR-001 §3.6.
- Sorted by *most-recent activity* by default (not by accuracy — prevents implicit ranking).
- Teacher may tap a student to see the same drill-down as F-PAR-001 §3 (read-only).

### 3.3 Class-level homework assignment

- **Given** the teacher selects 1 assignable target (Episode / Daily Test / Story / Theme Pack) from the catalog,
  **when** the teacher confirms,
  **then** one **plan** row is published for the class (roadmap `docs/roadmap/multi-persona-sync-platform.md` §2 `plans`); each learner device derives its own `HomeworkAssignment`s (`assignedBy = 'teacher'`) from the plan on its next sync — there is no server-side per-learner fan-out. The plan id plays the role the draft called `assignmentGroupId`.
- **Given** any roster learner has not yet unlocked the target (Stage gating),
  **when** fan-out runs,
  **then** that learner's device skips the locked item when deriving assignments and reports it in `summary.planProgress` as not-ready; the roster shows a "1 student not yet ready" footnote. No error to the teacher. **Ruling (10-app-map §7)**: class plans skip silently on-device; a single caregiver assignment (F-HW-001 §3.4) still fails fast — the two rules coexist because they answer different questions (bulk plan vs one explicit assignment).
- Per F-HW-001 §3.4 the per-learner cap is 1 explicit assignment per day; teacher fan-outs are subject to the same cap.

### 3.4 Projection Mode (mobile)

- **Given** a teacher profile is active on a mobile device,
  **when** the teacher toggles "Projection Mode" in settings,
  **then** all subsequent screens render with: font scale 200 %, tap targets ≥ 128 dp, and an audio boost **where the platform allows it** (Android media gain; iOS cannot exceed the system media volume, so Projection Mode instead shows a "turn up the volume" hint and a larger replay control).
- The Projection Mode flag is per-device, not per-profile — leaving the teacher profile resets it.
- Teacher may use a remote pause / play / next via in-screen controls; learners' on-screen prompts are unaffected (the mode is presentation, not interaction).

### 3.5 Co-parent / shared-learner semantics

- **Given** a learner is a member of a teacher's class **and** linked to a parent on a different device,
  **when** both teacher and parent view dashboards,
  **then** both see the same roll-up (read consistency). Writes (assignment) by teacher and parent are independent: each can assign 1/day under their own source, and the per-day cap stacks (teacher 1 + parent 1 = up to 2 explicit / day in this edge case).
- This is the only case the F-HW-001 §3.4 "1 explicit/day" cap is exceeded — explicitly allowed because both legitimate caregivers are present.

### 3.6 Data residency

- Phase 2 — class metadata + roster live in **Cloudflare D1** as `spaces` / `memberships` / `plans` (schema v2, roadmap `multi-persona-sync-platform.md` §2 — supersedes the five tables the draft listed).
- Learner progress data continues to live local-first; only summary aggregates (`stage_anchor_accuracy`, week summary) are synced to D1 for class roll-up.
- Privacy: a teacher can never read a learner's raw Quest history, only aggregates. Same lint as F-PAR-001 §3.6.

## 4. Out of scope

- **Class Builder** (drag-drop lesson template) → F-TCH-002.
- **Printable worksheets** (Quest → PDF) → F-TCH-003.
- **Paid teacher tier / Pro features** (`02-core-feature-spec §6.6`) → F-ENT-001 (roadmap S6, right after this spec — moved up from Phase 3).
- **Multi-teacher per class** (co-teacher) → Phase 3.
- **Live "screen control"** of student devices → security review needed, deferred indefinitely.
- **In-app parent ↔ teacher messaging** → F-NOTIF-001 family.

## 5. UI sketch

Authored 2026-09-19 (IDs per `docs/blueprints/10-app-map.md` §3.3):

- `design/wireframes/console/sign-in.md` + `console/onboarding-role.md` — Clerk-backed teacher signup + class create (web)
- `design/wireframes/console/roster.md`
- `design/wireframes/console/plan-builder.md` — class-level assignment
- `design/wireframes/console/space-settings.md` · `console/relink-approval.md`
- `design/wireframes/classroom/projection-mode.md` — mobile-side toggle

## 6. Tests

### Unit — `packages/backend/src/classroom/`

| File | Coverage focus |
|---|---|
| `backend/classroom/code-gen.ts` | base32 generation, uniqueness, regeneration invalidates old code |
| `backend/classroom/join.ts` | learner profile join + 3-class cap |
| `backend/classroom/roster-aggregate.ts` | week roll-up + anchor accuracy |
| `backend/classroom/fanout.ts` | §3.3 fan-out + gating skip + assignmentGroupId |

### Unit — `apps/mobile/src/logic/projection/`

| File | Coverage focus |
|---|---|
| `logic/projection/scale.ts` | font-scale, volume boost, tap-target size math |

### Integration

- Create class on web → generate code → mobile learner profile joins → roster shows learner within 1 round-trip.
- Teacher assigns Episode 1.A1 to 12 learners; 2 have not unlocked → 10 created, 2 skipped, footnote shown.
- Toggle Projection Mode → measure font scale at 200%, exit profile → reset.

### E2E (Playwright + Detox, nightly)

- Web teacher onboards via Clerk → creates class → mobile learner enters code → returns to roster → teacher sees joined student.

## 7. Rollout

- **MVP**: this spec ships as `draft` only — placeholder reservation of `teacher` role enum in F-PROF-001 §3.2. No teacher UI in MVP.
- **Phase 2 (post-beta validation of MVP)**: full F-TCH-001 ships. Feature flag: `classroom.enabled` (default `false` in MVP, flipped per-deployment).
- Beta: 3 한글학교 teachers run a 4-week pilot before public release.

## 8. Dependencies

### Upstream

- **F-PROF-001** — `teacher` role + per-device profile primitives.
- **F-HW-001** — assignment model + per-day cap semantics.
- **F-RVW-001** — `ReviewSummary` aggregates roll up to roster view.
- **F-PAR-001** — co-parent semantics + caregiver dashboard primitives shared.
- **F-INFRA-001** Cloudflare Workers + **F-INFRA-004** D1 sync — required for class data residency.
- **Clerk** integration for teacher onboarding (currently optional per `03-engineering-blueprint-v2 §1.2`) — must land before Phase 2.

### Downstream

- **F-TCH-002** Class Builder reuses Roster + Class entity.
- **F-TCH-003** Worksheet PDF generation reuses Episode catalog.

### External

- **Cloudflare D1**: schema v2 (`spaces`, `memberships`, `plans`, `snapshots.summary_json`) — roadmap `multi-persona-sync-platform.md` §2. The draft's five bespoke tables are withdrawn.
- **Clerk** organisation feature for school-tier accounts (Phase 3).

## 10. S5 scope (2026-09-21, promotion to `ready`) — shipped 2026-09-21 (PR 1 server + learner flow, PR 2 console pages); §10.4 remains deferred

What is already shipped: class create + join code (F-SPACE-001), roster summary view and console shell (F-CONSOLE-001), class plans with device-side derivation (F-PLAN-001). This section is the remaining, buildable scope.

### 10.1 Re-link approval (new device for a class student) — roadmap §5 row 2

- `sync/join-space` step 2 offers **"I was already in this class"** when the lookup returns the class roster (display names, or initials when the space anonymizes its roster). Picking a name sends `POST /api/spaces/:id/relink-requests { code, learnerId, deviceId, platform? }` (no auth, rate-limited 10 per client key per hour). The device must not already be bound to that learner (409 `already_bound`); one pending request per learner + device is reused.
- The request lives **10 minutes**. The learner device polls `GET /api/spaces/:id/relink-requests/:rid?deviceId=…` every few seconds and shows "Ask your teacher to approve on their screen" with a coarse countdown.
- Teacher side (`roster.manage`): `GET /api/spaces/:id/relink-requests` lists pending requests with the learner name and timing; `POST …/:rid/approve` binds the device with a fresh secret (delivered **once** through the next poll, together with the learner and the snapshot); `POST …/:rid/deny` closes it. Expired requests report `expired`.
- On approval the device adopts the learner exactly like a Rescue Code claim (`sync-store.adoptServerLearner`): creates or merges the local profile, stores the credentials, requests a sync, refreshes memberships. The temporary profile the child created on the new device stays; the restored one becomes active. Denied → "Ask your teacher." Expired → "That took too long — try again."
- Console page `/teach/space/:id/relink` (console/relink-approval): cards newest first with Approve / Deny, empty and expired states; roster shows a pending count.

### 10.2 Teacher rescue re-issue (app map §7 #24)

- `POST /api/recovery/issue { learnerId }` also accepts an **account** bearer with `roster.manage` over the learner (family caregiver, class teacher, school admin) and returns the plaintext once — the old code stops working. Console: "Issue a new rescue code" on the relink page's learner picker.

### 10.3 Space settings — roadmap §2 `settings_json`, §5.3, wireframe console/space-settings

- `PATCH /api/spaces/:id/settings { anonymizeRoster?, consentMode? }` (`space.manage`). `anonymizeRoster` swaps names for initials in the roster, the lookup roster and the relink list. `consentMode` is writable (owner decision (c)); school mode gates learner-data deletion by teachers.
- `POST /api/spaces/:id/archive` / `/unarchive` (`space.manage`): archived spaces refuse joins, lookups and plan writes; roster and list stay readable, rows dimmed.
- Member removal already exists (`DELETE /:id/members/:kind/:memberId`).
- `DELETE /api/spaces/:id/learners/:learnerId/data` (`learner.delete`: family owner/caregiver; class owner/teacher only when the space's `consentMode` is `school`): removes the learner, devices, snapshot, memberships and relink requests everywhere (GDPR-K / COPPA, roadmap §5.3).
- Console page `/teach/space/:id/settings`: code block, anonymize toggle, consent mode radio (class/school only), members and learners with remove, archive / unarchive, delete a learner's data behind a typed-name confirm.

### 10.4 Deferred

- §3.4 Projection Mode needs a teacher-role profile on the device (F-PROF-001 role UI) → own spec later. Learner detail page on the console, notifications for pending requests (F-NOTIF-001), co-teachers.

### 10.5 Tests

| File | Coverage |
|---|---|
| `content-schema/__tests__/relink.test.ts` | relink create / request schemas, settings patch, roster alias |
| `backend/lib/__tests__/can.test.ts` | `learner.delete` matrix incl. consent mode |
| `backend/__tests__/relink.test.ts` | create (code, membership, bound device, dedupe, rate limit), list (auth), approve → device can sync, one-time pickup, deny, expiry, wrong device |
| `backend/__tests__/spaces.test.ts` | settings patch, archive / unarchive effects, lookup roster + alias, learner data deletion rights + cascade |
| `backend/__tests__/recovery.test.ts` | account re-issue by a teacher, stranger 403 |
| `mobile/platform/__tests__/sync-api.test.ts` | createRelink / pollRelink mapping |
| `mobile/store/__tests__/membership-store.test.ts` | request + poll (approved adopts and refreshes, denied, expired, errors) |
| `mobile/store/__tests__/sync-store.test.ts` | `adoptServerLearner` shared by claim and relink |
