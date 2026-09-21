# F-SPACE-001 — Spaces, memberships, join code, access rules

**Status**: `ready`
**Scope**: `packages/content-schema` · `packages/backend` · `apps/api` (D1 schema v2) · `apps/mobile` (`sync/join-space`, settings row)
**Owner**: solo dev
**Rollout**: Roadmap S3 (`docs/roadmap/multi-persona-sync-platform.md` §1–§3.1, §6, §8). Owner decisions 2026-09-20: school consent mode **(c) selectable per space** (legal review before school mode ships), teacher free cap **20**.

Parent: F-SYNC-001 / F-RESTORE-001 · **F-TCH-001 §3.1 (class creation + join code) is migrated here** and F-TCH-001 keeps roster / plans / projection · wireframes `design/wireframes/sync/join-space.md`, `profile/settings.md`; server side of `console/onboarding-role.md`, `console/home.md`, `console/roster.md` (the web screens themselves are F-CONSOLE-001).

---

## 1. Context

One learner, one snapshot — but the adults around that learner differ: a parent at home, a teacher on Sunday, a school office above the teacher. The roadmap unifies them as **spaces** (`family` | `class` | `school`) with **memberships** for adults (accounts) and children (learners). A class hands out a **6-character join code** written on the board; a family can do the same for a co-parent. This spec ships the server objects, the one access function every route will call, and the learner-side join screen. Plans (S4), the roster web UI (S5) and paid caps (S6) build on it.

## 2. User story

> As a 한글학교 teacher, I want to create my class and write one code on the board so that every child in the room can join in a minute — with no accounts for kids, and with me seeing only what they did, never their raw history.

## 3. Acceptance criteria

### 3.1 Data (schema v2, additive)

- `accounts` (id = Clerk user id, email?, display_name?, consent_json?, created_at). Upserted on the first authenticated call to `/api/spaces`. Children are never accounts.
- `spaces` (id `space:xxxx`, kind, name ≤ 40, parent_space_id?, owner_account_id, join_code?, join_code_expires_at?, settings_json, archived_at?, created_at). `settings_json` defaults: `{ consentMode: 'parent', anonymizeRoster: kind === 'school' }`.
- `memberships` (space_id, member_kind `account|learner`, member_id, role `owner|caregiver|teacher|admin|student`, joined_at; PK on the first three). **One row per member per space** — the owner's row is `owner`, which `can()` treats as caregiver / teacher / admin according to the space kind.
- `apps/api/src/db/schema-v2.sql` mirrors the in-memory store (`packages/backend/src/store.ts`).

### 3.2 Join code

- 6 characters from the base32 alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I, O, 0, 1). Entry is normalized: upper case, spaces and hyphens removed; any character outside the alphabet → 422 `invalid_code` (nothing is silently mapped).
- Unique among unexpired codes; valid **30 days**; regenerable (`POST /spaces/:id/code`) which invalidates the previous code immediately.
- A `class` gets a code at creation. `family` and `school` get one on demand (co-parent / teacher invite).
- Lookup (`POST /spaces/lookup`) is unauthenticated but rate-limited (20 per client key per hour, same limiter as F-RESTORE-001) and returns only `{ space: { id, kind, name }, full }`.

### 3.3 Routes (`/api/spaces`)

| Method · path | Who | Result |
|---|---|---|
| `POST /` `{ kind, name, email?, displayName? }` | account (bearer) | 201 `{ space, membership, joinCode? }` — owner membership in the same call; class includes the code |
| `GET /` | account | `{ spaces: [{ space, role, counts: { learners, accounts, classes }, joinCode? }] }` — the code only for `space.manage` roles |
| `POST /:id/code` | account with `space.manage` | `{ joinCode, expiresAt }` |
| `POST /lookup` `{ code }` | anyone (rate-limited) | `{ space: { id, kind, name }, full }` · 404 `code_not_found` · 404 `code_expired` · 422 `invalid_code` |
| `POST /:id/join` `{ code, learnerId?, displayName? }` | learner device (sends `learnerId` — siblings share a device) **or** account | learner → `student` in a `family` or `class` (409 `cap_learner` above **3 classes**, 409 `cap_class` at **20 students** on a class, 422 `not_joinable` for `school`, idempotent 200 `{ alreadyMember: true }`); account → `caregiver` (family) or `teacher` (school); `class` → 403 `co_teacher_unsupported`. Code must match and be unexpired. `displayName` (≤ 20) updates the learner's roster name |
| `POST /:id/leave` | learner device | removes that learner's membership (idempotent) |
| `DELETE /:id/members/:kind/:memberId` | account with `roster.manage` | removes a member; the owner cannot be removed (409 `owner`) |
| `GET /:id/roster` | account with `summary.read` | `{ space, learners: [{ id, displayName, ageGroup, avatar, joinedAt, summary, lastSyncedAt }] }` — **never `payload_json`**; sorted by last activity, newest first (F-TCH-001 §3.2: no ranking) |
| `GET /api/sync/learners/:id/inbox` | learner device | `memberships` now filled: `[{ spaceId, kind, name, role, joinedAt }]` |

Errors use the standard envelope. Every space route resolves the actor once and asks `can()`.

### 3.4 Access rules — `lib/can.ts` (pure, 100 % tested)

```
can(actor, action, target)
  actor  = { kind: 'learner', learnerId } | { kind: 'account', accountId, memberships }
  target = { space } | { learnerId, spaces: Space[] (the learner's) }
  actions: snapshot.read · snapshot.write · summary.read · plan.write · roster.manage · space.manage · class.create · teacher.invite · entitlement.manage
```

| Actor | Allowed |
|---|---|
| learner (self) | `snapshot.read`, `snapshot.write` on its own learner id |
| owner / caregiver of a **family** the learner is in | `summary.read`, `snapshot.read`, `plan.write`, `roster.manage`; owner also `space.manage` |
| owner / teacher of a **class** the learner is in | `summary.read`, `plan.write`, `roster.manage`; owner also `space.manage` — **never `snapshot.read`** |
| owner / admin of a **school** | on the school: `space.manage`, `class.create`, `teacher.invite`, `entitlement.manage`; on each child class: `summary.read`, `roster.manage` |
| teacher invited into a **school** | `class.create` on the school (their classes sit under it) |
| anyone else | nothing |

### 3.5 Client — `sync/join-space` (learner device)

- Entered from `profile/settings` row **Join a class** — *not* PIN-gated (a teacher helps the child in the room; F-TCH-001 §3.1's "parent-gated" is superseded — decision logged in `10-app-map.md` §7). Family codes use the same screen.
- Step 1: one code field styled as six boxes (upper case, alphabet-only, auto-submit length 6) → **Join** → lookup. Offline: Join disabled with "This needs internet." and the typed code kept.
- Step 2: "*<name>* found!" · "Your teacher will see you as:" prefilled display name (editable, ≤ 20) → **That's me** → registers the learner if it never synced, then joins.
- Done sheet: "You're in *<name>*." → **Back to today** (Home). Already a member → straight to the done sheet.
- Errors (one line under the field, calm, addressed to the child with the grown-up as the fix): unknown → "That code didn't work. Check it with your teacher." · expired → "That code is too old. Ask for a new one." · `cap_learner` → "You're already in three classes. A grown-up can leave one in settings." · `cap_class` → "This class is full. Ask your teacher." · no API on this build → screen explains and disables Join.
- Settings shows the learner's memberships ("Sunday Class A · class") with **Leave** behind a confirm dialog. Memberships are cached locally (`memberships:<learnerId>`) and refreshed from the inbox when settings opens and after join / leave.
- Telemetry: `space.join.attempted` `{ kind }`, `space.join.succeeded` `{ kind }`, `space.join.failed` `{ reason }`.

## 4. Out of scope

- Web console screens (`console/sign-in`, `onboarding-role`, `home`, `roster`) → **F-CONSOLE-001** (next PR; this spec ships their API).
- Plans and homework derivation → F-PLAN-001. Re-link approval → F-TCH-001 §3.5 / S5. Paid caps and `tier` from memberships → F-ENT-001.
- Parent-email capture at join under `consentMode: 'parent'` → F-SPACE-002 once family accounts exist on the mobile side (F-AUTH-002).
- Co-teachers, archiving a space (column exists; UI in S5), leaving a space from the child surface other than the settings row above.
- Real Clerk keys — dev fallback treats the bearer as the account id (F-AUTH-001).

## 5. Tests

| File | Coverage |
|---|---|
| `content-schema/__tests__/space.test.ts` | join code normalize / validate, Space · Membership · create / join / inbox schemas, profile roles `teacher` / `admin` |
| `backend/lib/__tests__/join-code.test.ts` | alphabet, length, uniqueness against a taken set, expiry |
| `backend/lib/__tests__/can.test.ts` | the matrix in §3.4 including the teacher-never-payload rule |
| `backend/__tests__/spaces.test.ts` | create per kind (+ account upsert, class code), list with counts, regenerate, lookup (404 / expired / 422 / 429), learner join (family, class, caps, idempotent, school 422, wrong code), account join (caregiver, teacher, class 403), leave, remove member (owner 409), roster (summary only, sorted, 403 outsider), inbox memberships |
| `mobile/logic/spaces/__tests__/join-code.test.ts` | clean / validate / error copy |
| `mobile/store/__tests__/membership-store.test.ts` | hydrate, lookup, join (registers first), leave, refresh from inbox, offline / off |
| `mobile/platform/__tests__/sync-api.test.ts` | lookup / join / leave / inbox mapping |
