# F-TCH-001 — Teacher / Classroom Management

**Status**: `draft`
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

- **Given** a teacher profile signs up via Clerk (Phase 2 — teacher onboarding is web-first),
  **when** the teacher creates a class,
  **then** a 6-digit alphanumeric **join code** is generated (e.g. `K7M2X9`), unique across all active classes, valid for 30 days, regenerable.
- **Given** a learner enters a join code from their mobile Profile Picker settings,
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
  **then** F-HW-001 §3.4 fan-outs: one `HomeworkAssignment` is created per roster learner, with `source = 'teacher'` and shared `assignmentGroupId` for class-level tracking.
- **Given** any roster learner has not yet unlocked the target (Stage gating),
  **when** fan-out runs,
  **then** that learner is **silently skipped** in the fan-out (no error to teacher, but the roster card shows "1 student not yet ready" footnote). Teacher can opt to send to *unlocked-only* with one tap.
- Per F-HW-001 §3.4 the per-learner cap is 1 explicit assignment per day; teacher fan-outs are subject to the same cap.

### 3.4 Projection Mode (mobile)

- **Given** a teacher profile is active on a mobile device,
  **when** the teacher toggles "Projection Mode" in settings,
  **then** all subsequent screens render with: font scale 200 %, audio volume +6 dB, tap targets ≥ 128 dp.
- The Projection Mode flag is per-device, not per-profile — leaving the teacher profile resets it.
- Teacher may use a remote pause / play / next via in-screen controls; learners' on-screen prompts are unaffected (the mode is presentation, not interaction).

### 3.5 Co-parent / shared-learner semantics

- **Given** a learner is a member of a teacher's class **and** linked to a parent on a different device,
  **when** both teacher and parent view dashboards,
  **then** both see the same roll-up (read consistency). Writes (assignment) by teacher and parent are independent: each can assign 1/day under their own source, and the per-day cap stacks (teacher 1 + parent 1 = up to 2 explicit / day in this edge case).
- This is the only case the F-HW-001 §3.4 "1 explicit/day" cap is exceeded — explicitly allowed because both legitimate caregivers are present.

### 3.6 Data residency

- Phase 2 — class metadata + roster live in **Cloudflare D1** (per `03-engineering-blueprint-v2 §1.2`).
- Learner progress data continues to live local-first; only summary aggregates (`stage_anchor_accuracy`, week summary) are synced to D1 for class roll-up.
- Privacy: a teacher can never read a learner's raw Quest history, only aggregates. Same lint as F-PAR-001 §3.6.

## 4. Out of scope

- **Class Builder** (drag-drop lesson template) → F-TCH-002.
- **Printable worksheets** (Quest → PDF) → F-TCH-003.
- **Paid teacher tier / Pro features** (`02-core-feature-spec §6.6`) → Phase 3.
- **Multi-teacher per class** (co-teacher) → Phase 3.
- **Live "screen control"** of student devices → security review needed, deferred indefinitely.
- **In-app parent ↔ teacher messaging** → F-NOTIF-001 family.

## 5. UI sketch

To be authored when Phase 2 starts:

- `design/wireframes/teacher/onboarding.md` — Clerk-backed teacher signup (web)
- `design/wireframes/teacher/class-create.md`
- `design/wireframes/teacher/roster.md`
- `design/wireframes/teacher/assign-class-homework.md`
- `design/wireframes/teacher/projection-mode.md` — mobile-side toggle

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

- **Cloudflare D1**: 5 new tables — `classes`, `class_members`, `assignment_groups`, `teacher_profiles`, `roster_summaries_weekly`.
- **Clerk** organisation feature for school-tier accounts (Phase 3).
