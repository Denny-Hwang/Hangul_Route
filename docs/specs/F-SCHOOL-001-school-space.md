# F-SCHOOL-001 — School space: admin view, teacher invites, seats

**Status**: `ready`
**Scope**: `packages/content-schema` · `packages/backend` · `apps/web` (`/teach/space/:id` for school spaces)
**Owner**: solo dev
**Rollout**: Roadmap S7 — the last stage of the multi-persona platform

Parent: F-SPACE-001 (spaces, `class.create`, school join code = teacher invite), F-ENT-001 (`school_license` / `school_seat`), F-CONSOLE-001 (console shell), F-TCH-001 §10 · wireframe `console/school-admin.md`

---

## 1. Context

A 한글학교 organizer runs several classes taught by other teachers. The school is a space whose children are classes; teachers arrive through the school's join code; the licence sets how many students and teachers fit. The admin reads aggregates only — never a student's card — and can open a class roster (anonymized by default for school-owned classes).

## 2. User story

> As a school organizer, I want to invite my teachers with one code, see every class with its teacher and activity, know how many seats are left, and never have to look at an individual child to run the school.

## 3. Acceptance criteria

### 3.1 Limits (`lib/entitlement.ts`)

- `schoolLimits(school, now)`: active `school_license` → **300 students / 10 teachers**; active `school_seat` → `seats` students (null = unlimited) / unlimited teachers; nothing active → not licensed (no school-level caps; each class keeps the free cap).
- `schoolUsage(schoolId)`: distinct learners across the school's live classes (a learner in two classes counts once) and distinct teaching accounts (teacher members of the school plus owners / teachers of its classes, excluding the school owner).
- Learner join into a class under a licensed school is refused with 409 `cap_school` when the school's distinct learners already reach the student limit; the lookup's `full` reflects it.

### 3.2 Routes

| Method · path | Who | Result |
|---|---|---|
| `GET /api/spaces/:id/school` | `space.manage` on the school | `{ school, invite: { joinCode, joinCodeExpiresAt }, license, limits, usage, thisWeek: { students, practiced, classes, classesWithPlan }, classes: [{ space, teacher: { accountId, name } \| null, students, lastActiveAt, hasPublishedPlan }] }` — archived classes last |
| `POST /api/spaces/:id/members` `{ accountId, role: 'teacher' }` | `roster.manage` on the class (admins cascade) | assigns a teacher who is already a member of the parent school (422 `not_in_school` otherwise); idempotent |
| existing | — | classes under a school: `POST /spaces` with `parentSpaceId` (`class.create`); teacher invite code: `POST /spaces/:id/code` on the school; teachers join with `POST /spaces/:id/join` (account path, role teacher) |

### 3.3 Console — `/teach/space/:id` when the space is a school (console/school-admin)

- Licence block (plan, status, **Manage billing** → `/teach/billing`), seats block ("students 38 / 300 · teachers 4 / 10", near-limit note from 90 %), teacher invite code (Copy, Regenerate with confirm, "they sign in, enter this code, then create their class"), this-week aggregate, classes table (teacher, students, last active, plan, **Open roster**, **Assign teacher** from the school's teachers), **+ New class** (inline name), Settings link, empty state with the invite code large.
- Aggregate only: no student names or per-student numbers on this page; rosters opened from here follow the class's anonymize setting (on by default for school-owned classes).

## 4. Out of scope

- SSO, invoices, multi-school organizations (P-E beyond one school), per-class licence overrides, teacher removal from a class (use Settings), admin-level consent record.

## 5. Tests

| File | Coverage |
|---|---|
| `backend/lib/__tests__/entitlement.test.ts` | `schoolLimits` per plan, `schoolUsage` distinct counting |
| `backend/__tests__/school.test.ts` | school view (rights, invite, classes with teachers, aggregates, archived last), assign teacher (rights, not-in-school, idempotent), seat cap on join + lookup |
| `web/src/lib/console/__tests__/school.test.ts` | seat lines, near-limit, class row lines, week line |
| `web/src/lib/console/__tests__/api.test.ts` | school + addMember transport |
