# F-SPACE-001 — Spaces, memberships, join code, access rules

**Status**: `ready`
**Scope**: `packages/content-schema` · `packages/backend` · `apps/api` (D1 schema v2) · `apps/mobile` (`sync/join-space`, settings row)
**Owner**: solo dev
**Rollout**: Roadmap S3 (`docs/roadmap/multi-persona-sync-platform.md` §1–§3.1, §6, §8). Owner decisions 2026-09-20: school consent mode **(c) selectable per space** (legal review before school mode ships), teacher free cap **20**.
**Amended 2026-10-20 [SA]** by `AMENDMENTS-SEATS-ADMINS.md`: `PATCH /api/spaces/:id/name` and the action `space.rename`; owner-only actions `billing.manage`, `admin.manage`, `space.settings`, `space.archive`; the learner join takes its seat in one guarded D1 statement (`cap_family` 4, `cap_class`, `cap_school`, each with `details.cap`); lookup keeps `full` for classes (shipped apps) and adds a learner-aware `seat { full, reason, cap }` (optional device-authorized `learnerId`); `putSpace` no longer writes the name on update.

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
- `apps/api/migrations/0002_schema_v2.sql` (formerly `src/db/schema-v2.sql`) mirrors the in-memory store (`packages/backend/src/store.ts`).

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
| `POST /:id/join` `{ code, learnerId?, displayName? }` | learner device (sends `learnerId` — siblings share a device) **or** account | learner → `student` in a `family` or `class` (409 `cap_learner` above **3 classes**, 409 `cap_class` at **20 students** on a class, 422 `not_joinable` for `school`, idempotent 200 `{ alreadyMember: true }`); account → `caregiver` (family) or `teacher` (school); `class` → 403 `co_teacher_unsupported`. Code must match and be unexpired. `displayName` (≤ 20 in the body; never fails the join) updates the learner's roster name (trim, 1–20, the lenient server rule, so a legacy name applies as sent) only while the learner has no PATCH edit yet (F-SYNC-001 §3.7 #4); otherwise the stored name is kept |
| `POST /:id/leave` | learner device | removes that learner's membership (idempotent) |
| `DELETE /:id/members/:kind/:memberId` | account with `roster.manage` | removes a member; the owner cannot be removed (409 `owner`) |
| `GET /:id/roster` | account with `summary.read` | `{ space, learners: [{ id, displayName, ageGroup, avatar, joinedAt, summary, lastSyncedAt }] }` — **never `payload_json`**; sorted by last activity, newest first (F-TCH-001 §3.2: no ranking). `ageGroup` is an opaque level id: clients show `levelLabel(ageGroup)` ("Some reading") and hide the pill for an id they do not know; `avatar` is a free string the console draws as an `AvatarChip` (F-LEARN-001 §3.6, §3.7) |
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
- **Who is joining? for family codes** ([OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D14, OA-D20, sections 10.2, 10.3, 10.6, CS-11; row OA-7b; behind `EXPO_PUBLIC_MULTI_JOIN`, on since OA-10 (a kill switch); off is the one-learner join above). When the lookup finds a **family** and the device holds 2 or more learner profiles, step 2 becomes a checklist of the learner profiles in the chooser's tile order (`logic/spaces/join-batch.ts`, `screens/sync/JoinBatch.tsx`; mock `design/screens/profiles/who-is-joining.md`):
  - Each row is a real check box labelled by the learner's name, with the cub. The active learner starts checked; a locked profile starts unchecked with **Takes a family place.** and the lock glyph; a learner whose link on this device is class-scoped is disabled with **Linked for a class on this device.** (as is a learner whose scope cannot be read: fail closed) On a class device (every learner class-scoped) the checklist never appears. Class codes keep the one-learner flow (OQ-15).
  - **Next** asks a fresh PIN first (within `GROWN_UP_FRESH_PIN_MS`, 2 minutes; the PIN screen's destination `JoinSpace`, which returns here) when the pick includes anyone but the active, unlocked learner (CS-11); joining only the active learner needs no PIN, as today. A first PIN set on that screen counts as fresh; one set at the end of a reset (the 24-hour wait or the Rescue Code) does not, and the PIN is asked once more. Offline, Next stays reachable, does nothing, and reads "Needs the internet".
  - The picked set is frozen once that PIN is accepted: a change of the picks after **Not now** (or after Back to the checklist) asks a fresh PIN again, however recent the last one is; a PIN screen closed without a PIN lets nothing go on.
  - Then a name step once per picked learner in turn that keeps only the fields of the confirm step above (the name field, the same-everywhere line and the name-rule hints) with **Next**, which keeps the name in memory and sends nothing. The confirm step's **That's me** (it calls `join` at once) and **Not this one** (it belongs to class rosters) are not shown here (AMENDMENTS-ONE-ACCOUNT-MANY-USERS 10.3, OA-0b); **Back** returns to the previous learner's name step, or to the checklist from the first. Then one consent step, **Join *<family>*?**, with one line per picked learner ("*<name>*: joining saves their progress to the account."), "The family's grown-ups will see each name and their progress.", **Yes, join** and **Not now** (back to the checklist; nothing is sent and nobody is registered). The consent covers registering each learner that never synced; no learner is registered or joined without being named in it, and no `/join` is sent before **Yes, join**. **Yes, join** checks the PIN again and asks it when the one from Next is no longer fresh or the picks are not the frozen set.
  - The joins run in sequence, one `membership-store.join` (one `/join`) per learner; the Worker takes each seat atomically. A `409` cap is a result line (the name, a colon, then `join.errors.familyFull(cap)`), never an error, and the sequence goes on; so does a failure about one learner (a `401` or `403` from the device check, read as `forbidden`), which is that learner's line in the same colon form. The first other failure stops it: offline, a timeout, a `5xx` or a busy Worker show the lines done so far, "This needs internet. Try again when you are online." and **Try again** for the rest; a code that stopped working shows its own line and **Done**. **Try again** asks the fresh PIN again (CS-11) when the learners left include anyone but the active, unlocked learner. A retry is idempotent: the learner whose answer was lost answers "already a member" and reads joined. One run at a time: a second tap sends nothing more.
  - Results: the heading "*<joined>* of *<picked>* joined." (a polite status, announced once a join has answered; already a member counts as joined), one line per learner ("*<name>* joined.", "*<name>* is already in this family.", or the cap line), then **Done** (Home). `space.join.batch { picked, joined, refused }` (each 0 to 12, counts only, no profile id) once per batch: when it ends, or when the screen is left with Try again showing.
  - The lookup's seat line for the active learner does not stop the checklist: each learner's own `/join` decides (a member keeps its place).
  - A family hand-off code (the family home's **Open the app on this device**) on a shared device with the chooser on opens Join over Home at launch instead of the chooser, held in memory only (never in the address), and is looked up at once, so the checklist opens (OA-D20). A locked active profile keeps the chooser (CS-19), with the code held for the learner picked there. Should the hand-off code turn out to be a class code, it is held and the chooser asks who is joining. The chooser that launch would have shown is not dropped: leaving Join (Done, or Back) opens it, never Home as whoever played last (CS-5).

## 4. Out of scope

- Web console screens (`console/sign-in`, `onboarding-role`, `home`, `roster`) → **F-CONSOLE-001** (next PR; this spec ships their API).
- Plans and homework derivation → F-PLAN-001. Re-link approval → F-TCH-001 §3.5 / S5. Paid caps and `tier` from memberships → F-ENT-001.
- Parent-email capture at join under `consentMode: 'parent'` → F-SPACE-003 once family accounts exist on the mobile side (F-AUTH-002).
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
