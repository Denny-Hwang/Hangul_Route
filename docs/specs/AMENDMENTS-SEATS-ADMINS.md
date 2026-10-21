Status: ready (spec only; rows SA-0b to SA-6 implement it)

Design: row SA-0b, approved in #753 (agent design pass, multi-agent review, CLAUDE.md section 5, 2026-10-12 owner decision; `design/screens/console/README.md`). Files: wireframes `design/wireframes/console/rename-inline.md`, `design/wireframes/console/admins-panel.md`, `design/wireframes/console/admin-invite-accept.md`; updated `design/wireframes/console/school-admin.md` (admins panel slot, Rename on the title and on each class row, the `seats.school.at` and over-cap lines) and `design/wireframes/billing/billing-home.md` (admin read-only school card); mocks `design/screens/console/rename-inline.md` + `mock/rename-inline.html`, `design/screens/console/admins-panel.md` + `mock/admins-panel.html`, `design/screens/console/admin-invite-accept.md` + `mock/admin-invite-accept.html` (sheet `mock/console.css`, shots in `design/screens/console/shots/`), and the read-only school card, boards 22 and 23 of `design/screens/billing/mock/billing-home-states.html` (`design/screens/billing/billing-home.md`).

# Amendment: learner limits per plan, easy renaming, and school administrators

> **Owner request of 2026-10-20 (in chat, translated):** "Adjust the Stripe plans a little. The $15.30 Family plan can be used by at most 4 people, and the $153 School plan by at most 50. Make it easier to change the school or class name: not only the account name, the school name and the class name must be easy to edit. A school can register up to 2 more administrators (principal, dean), 3 in total, through an invite link."
>
> Every change below is marked **[SA]** where it lands in a spec, test or code comment.
>
> Basis: `origin/main` `173f12850`. Every `file:line` below is at that commit.

**Standing rules that apply here:**
- Stripe stays in **sandbox (test mode)**. No price changes: the Family Plan stays **$15.30 / year** (renews yearly), the Group License stays **$153 / year**. Nothing here touches Stripe Live, a price, a key or a webhook. The only Stripe step is an optional product description edit in the sandbox (section 12).
- D1 changes are **additive only** (a merge applies the migration to production). The Worker deploys before any client that relies on a new route or a new response field.
- No PII in URLs, page titles or telemetry. The admin invite link carries an opaque token in the address **fragment** only; events carry codes only, never a name, an email, a space id or a token.
- UI strings come from `packages/i18n` (`useMessages()`), with English, Spanish and Korean in the same PR (the `es` and `ko` coverage ratchets), written to the F-I18N-001 section 3.10 style guide and glossary. Design-system tokens only. No emoji.
- Audience is any age: no age wording. Anti-shame: a limit is never a failure. Nothing a learner earned is ever removed or hidden, and nobody is removed from a space because of a limit.
- `CLASS_TRANSFER` stays as it is (on, owner decision 2026-10-14). This amendment changes only the seat check a move already runs.

---

## 1. Decisions

| # | Decision | Replaces | Why |
|---|---|---|---|
| SA-D1 | **A family holds up to 4 learners**, free or on the Family Plan (`FAMILY_LIFETIME_LEARNERS` 5 → **4**). | F-ENT-001 section 3.1 ("up to 5 learners"), F-BILL-002 AS2 (5 on every family) | Owner request (1). One cap for every family keeps buying the plan from ever lowering a family's room (the reason F-BILL-002 AS2 gave for one cap). Lowering free families from 5 to 4 goes **beyond the owner's request** (it named the paid plan); families above 4 are grandfathered (SA-D7). The 4 (and the 50 of SA-D2) count **learners only**; grown-ups are not capped (OQ-11). **Default, owner may change** (OQ-1). |
| SA-D2 | **The Group License covers up to 50 learners**: a stand-alone class with its own licence holds up to 50 students (was: no cap), and a school with a licence holds up to 50 distinct students across its live classes (was: 300). New constant `GROUP_LICENSE_LEARNERS = 50`; `SCHOOL_LICENSE_STUDENTS` becomes 50. | F-ENT-001 section 3.1 ("up to 10 teachers / 300 students"), F-ENT-001 section 3.2 `classCap` (licensed → unlimited), F-SCHOOL-001 section 3.1 (300) | Owner request (2): the $153 plan is the Group License, sold to a class or a school. |
| SA-D3 | **Every school holds up to 50 distinct students**, licensed or not (`SCHOOL_LEARNER_CAP = 50`). An unlicensed school's classes also keep the free class cap of 20 each. A School Contract (`school_seat`) replaces the 50 with its `seats` (null = no cap). | F-SCHOOL-001 section 3.1 ("nothing active → no school-level caps") | Without it, a school would have more room free than paid, and could fill up free and then buy a licence for any number. Same reasoning as SA-D1. **This is a new restriction on free schools, beyond the owner's request** (a free school with three classes of 20 holds 60 today); schools above 50 are grandfathered (SA-D7). With it, a licence gives a school premium for every student but no extra student room over free. **Default, owner may change** (OQ-2). |
| SA-D4 | **Teachers: unchanged.** A licensed school still holds up to 10 teaching accounts (`SCHOOL_LICENSE_TEACHERS` 10). School administrators (SA-D10) do not count as teachers unless they own or teach a class, exactly as `schoolUsageFrom` counts today. | — | The owner named learners only. **Default, owner may change** (OQ-3). |
| SA-D5 | **What a learner seat is.** A seat is one `memberships` row with `member_kind = 'learner'`: in a family, its learner members; in a stand-alone class, its learner members; in a school, the **distinct** learners across its live (not archived) classes (a learner in two classes of one school takes one seat). Learner profiles kept on a device that never joined a family take no seat. Grown-ups (owner, caregiver, teacher, admin) never take a learner seat. | — | Matches `studentsIn` (`seats.ts:13-15`) and `schoolUsageFrom` (`entitlement.ts:92-104`), the counts the console already shows. |
| SA-D6 | **At the cap, adding is refused, kindly; nobody is removed.** A join, a class move or a family join that would pass a cap is refused with `409` and the cap's code (`cap_family`, `cap_class`, `cap_school`), with `details: { cap }`; on the learner `/join` a school cap answers `cap_class` with `details: { reason: 'cap_school', cap }`, so shipped apps show the class line (section 3.4). The learner app and the console say the limit and what to do, never "error" or "failed". Existing members, their progress, cards and stars are never touched. | `cap_family` mapped to the three-classes message on the learner app (`sync-api.ts:343`), see section 2.4 | Owner request (1), (2); anti-shame. |
| SA-D7 | **Spaces already over a cap are grandfathered.** A family with 5 learners, a licensed class with 70 students, or a school with 120 students when SA-1 deploys keeps every member, read-write, and every member keeps the coverage the plan gives (premium for all of them while the plan is active). It cannot add a learner until it is below the cap. The console says so calmly (section 3.7). | — | Never remove or hide a learner (owner rule). Coverage per seat (only the first 50 covered) is the alternative; it would take premium away from learners who already have it. **Default, owner may change** (OQ-4). |
| SA-D8 | **The Worker enforces caps atomically.** The learner join (family and class), the family-started class transfer and the teacher class move each take a seat in **one D1 statement** whose `WHERE` holds every cap that applies (section 3.3), so two devices joining at once can never both take the last seat. The read-then-insert of today (`spaces.ts:318-324`) goes. | `classSeatCheck` then `addMembership` as two steps; the advisory school check of `transfer.ts:530` | Owner task: "the Worker enforces it atomically". |
| SA-D9 | **Renaming is one tap, where the name is shown.** A new route `PATCH /api/spaces/:id/name` and a new action `space.rename`. The console shows a **Rename** button next to the name on the family home, the class page, the school page, each class row of the school page, and in Settings, which opens an inline field in place (Save, Cancel; Enter saves, Escape cancels). Names follow the create rule (1 to 40 characters) with Unicode NFC, whitespace collapsed, and control and format characters refused (section 5.2). The name column is written only by create and by the rename's own column-only statement; `putSpace` stops writing it on update, so no other writer can undo a rename. The new name reaches every grown-up page on its next read and every learner device at its next sync. | — (no rename exists: `PATCH /:id/settings` takes settings only, `spaces.ts:213-227`; the name the start page prefilled from the account name, `routing.ts:182-188`, could never change) | Owner request (3). |
| SA-D10 | **A school has its owner and up to 2 administrators (3 in total).** `SCHOOL_ADMIN_CAP = 2`. Administrators join only through an **invite link** the owner makes: single use, expires after **7 days**, revocable, the token in the link's fragment and only its SHA-256 hash stored, accept needs sign-in, and the cap is checked atomically at accept (section 6). | — (the `admin` role exists in the schema and in `can()`, `can.ts:51-58`, but nothing can create it) | Owner request (4). |
| SA-D11 | **Administrators run the school; the owner keeps billing and the admin list.** An admin can rename the school and its classes, create classes, see and regenerate the teacher invite code, assign and remove teachers (never the owner or another admin, at the school or through a class), open class rosters and reports, and move students between the school's classes (the cascade of `can.ts:83-89`). Only the **owner** can buy, manage or cancel the plan, open receipts, invite or remove admins, change the school's settings (anonymized roster, consent mode) and archive or unarchive the school. Nobody can remove the owner. An admin can leave at any time. New owner-only actions `billing.manage`, `admin.manage`, `space.settings`, `space.archive` (section 6.5). | F-BILL-002 section 4.2 and OD-8 ("the payer of a school is its owner **and** its admins"): admins become read-only on billing | Receipts show the payer's name, email and address (F-BILL-002 section 4.10), and a plan change spends the owner's money. **Default, owner may change** (OQ-5, OQ-6). No admin row exists in production (nothing can create one at the basis commit), so the change affects nobody today. |
| SA-D12 | **An audit trail for school administration and school renames.** One additive table `space_events` records, **for schools only**, invite made, invite revoked, admin joined, admin removed, admin left, the school renamed, and a class of the school renamed (on the school's row, with the class as `subject_space_id`), with account ids and a time, never a name, an email or a token. Family and stand-alone class renames are not recorded there (server telemetry codes only, section 5.5). The school owner sees the last 20 school events on the admins panel. Rows older than 400 days are purged by the daily job. | — | Owner task: audit wording. **Default, owner may change** (OQ-10). |

---

## 2. Where things stand (basis `173f12850`)

### 2.1 Plans and caps

- Constants: `FAMILY_LIFETIME_LEARNERS = 5` (`packages/content-schema/src/schemas/entitlement.ts:84`), `SCHOOL_LICENSE_STUDENTS = 300`, `SCHOOL_LICENSE_TEACHERS = 10` (`entitlement.ts:163-164`), `LEARNER_CLASS_CAP = 3`, `FREE_CLASS_STUDENT_CAP = 20` (`space.ts:111-112`). `PLAN_PRICING` holds `$15.30 / year` and `$153 / year` (`entitlement.ts:69-72`) and is unchanged here.
- `classIsPro` (`packages/backend/src/lib/entitlement.ts:43-48`): a class with its own `group_license`, or under a school with `group_license` / `school_seat`. `classCap` (`:51-53`): pro → `Infinity`, else 20.
- `schoolLimitsFrom` (`:69-76`): licence → 300 / 10; contract → `seats` / unlimited; nothing → not licensed, no school cap. `schoolIsFull` (`:108-119`) applies only to a licensed school.
- The family cap is checked in the join route after the class checks, for every family, paid or not (`packages/backend/src/routes/spaces.ts:320-322`), with `cap_family`. The lookup's `full` is computed for classes only (`spaces.ts:190`).
- `classSeatCheck` (`packages/backend/src/lib/seats.ts:41-48`) reads counts, then `/join` inserts (`spaces.ts:323-324`) with `addMembership` (`packages/backend/src/db/d1.ts:683-688`, an upsert). Two joins at once can both pass the read. Class moves pass a `destCap` into one guarded batch (`transfer.ts:552`, `class-moves.ts:100`), but the school seat check stays advisory (`transfer.ts:530`, `class-moves.ts:93`).

### 2.2 Counts shown today

- Billing summary (`packages/backend/src/lib/billing-summary.ts:155-169`): a school's seat counts for payers only; a family `n of 5`; a class `n of 20` until covered, then no cap.
- Billing includes lines (`apps/web/src/lib/console/billing-summary.ts:175-186`): "Up to {n} learners in one family", "No {20}-student cap", "A school holds up to {10} teachers and {300} students". `console.contactLine` types the numbers into English: "More than 300 students or 10 teachers? Write to us for a contract." (`packages/i18n/src/messages/en/console.ts:84`).
- Class roster (`apps/web/src/lib/console/rollup.ts:74-78`): `capState` uses the free cap 20 for every class, licensed or not.
- School page (`apps/web/src/lib/console/school.ts:9-37`): `students n / 300 · teachers n / 10`, near-limit at 90 %, "No licence yet — each class keeps the free cap of 20 students."
- hangulroute.com shows no price and no limit: "Plans for families and classes are at app.hangulroute.com." (`packages/i18n/src/messages/en/landing.ts:163-173`).

### 2.3 Spaces, roles, invites

- Roles `owner | caregiver | teacher | admin | student` (`space.ts:37`); one membership row per member per space (`apps/api/migrations/0002_schema_v2.sql:66-73`).
- `can()` (`packages/backend/src/lib/can.ts`): a school `admin` gets `summary.read`, `roster.manage`, `space.manage`, `class.create`, `teacher.invite`, `entitlement.manage` (`:51-58`); the owner acts as admin plus `space.manage` (`:60`, `:72-73`); a school owner or admin cascades `summary.read`, `roster.manage`, `learner.transfer` onto each class (`:83-89`).
- Nothing creates an `admin` membership: create makes the `owner` (`spaces.ts:129-131`), account join makes `caregiver` (family) or `teacher` (school) (`spaces.ts:328-339`), `POST /:id/members` assigns `teacher` only (`school.ts:84`).
- `DELETE /:id/members/:kind/:memberId` needs `roster.manage` and refuses the owner (`spaces.ts:358-375`). A school admin would pass it for any account, another admin included.
- Teacher invite: the school's 6-character join code (`POST /:id/code`, `space.manage`). Class join link: `app.hangulroute.com/join#c=<code>`, code in the fragment (AMENDMENTS-DISPLAY-NAV, `JoinLinkParts.tsx`).
- Billing payer = `space.manage` (`billing.ts:40-43`, `entitlements.ts:64-70`), so a school admin is a payer today (F-BILL-002 section 4.2).

### 2.4 Names

- A space gets its name once, at creation (`POST /api/spaces`, `SpaceCreateSchema` `name: trim, 1-40`, `space.ts:74-81`). The start page prefills it from the account's display name ("Kim family", `apps/web/src/lib/console/routing.ts:182-188`). No route and no page can change it later; `putSpace` (`d1.ts:665-670`) rewrites every column, so a rename through it would race with a settings change.
- The console reads the name on every page load (`AdultFrame` title, `teach/space/page.tsx:176`, `SchoolAdmin.tsx:75`, parent home).
- The learner app shows a space's name from the inbox memberships cached as `memberships:<learnerId>` (Settings, "Classes & family") and from the tier source (Plan screen, "covered by {space}"); both are replaced on every inbox refresh, which runs after every successful sync (`apps/mobile/src/store/membership-store.ts:555-558`, `tier-store.ts:58`).
- The learner app maps every `409` that is not `cap_class` to the three-classes message (`apps/mobile/src/platform/sync-api.ts:343`), so a full family reads "You're already in three classes", which is wrong.

---

## 3. Learner limits per plan

### 3.1 Constants (`packages/content-schema`)

| Constant | Value | Where it applies |
|---|---|---|
| `FAMILY_LIFETIME_LEARNERS` | **4** (was 5) | every family space, free or on the Family Plan. The name stays (the plan key is `family_lifetime`, BY-D1); its doc comment says [SA] |
| `GROUP_LICENSE_LEARNERS` (new) | **50** | a stand-alone class with an active `group_license` |
| `SCHOOL_LICENSE_STUDENTS` | **50** (was 300), defined as `GROUP_LICENSE_LEARNERS` | a school with an active `group_license` |
| `SCHOOL_LEARNER_CAP` (new) | **50**, defined as `GROUP_LICENSE_LEARNERS` | every school without a School Contract, licensed or not |
| `SCHOOL_LICENSE_TEACHERS` | 10 (unchanged) | a school with an active `group_license` |
| `FREE_CLASS_STUDENT_CAP` | 20 (unchanged) | a class with no cover: stand-alone without a licence, or in a school without a licence or contract |
| `LEARNER_CLASS_CAP` | 3 (unchanged) | a learner's live classes |
| `SCHOOL_ADMIN_CAP` (new) | **2** | administrators besides the owner (SA-D10) |
| `ADMIN_INVITE_TTL_MS` (new) | 7 days | invite link lifetime |

Plan copy reads these numbers; no locale types a limit into its text (the rule F-I18N-001 PR 10b set for billing).

### 3.2 The cap of each space (`lib/entitlement.ts`, pure over `Db`)

| Space | Learner cap | School cap on top |
|---|---|---|
| family | `FAMILY_LIFETIME_LEARNERS` (4) | — |
| stand-alone class, no licence | `FREE_CLASS_STUDENT_CAP` (20) | — |
| stand-alone class, active `group_license` | `GROUP_LICENSE_LEARNERS` (50) | — |
| class in a school, school has nothing active | 20 | `SCHOOL_LEARNER_CAP` (50) distinct across the school |
| class in a school with active `group_license` | none (the school cap binds) | `SCHOOL_LICENSE_STUDENTS` (50) |
| class in a school with active `school_seat` | none | `seats` (null = none) |
| class in a school with its **own** active `group_license`, school has nothing active | `GROUP_LICENSE_LEARNERS` (50, its own licence) | `SCHOOL_LEARNER_CAP` (50) |
| class in a school with its own active `group_license`, school has an active `group_license` or `school_seat` | none (the school's cover decides) | the school's cap (50, or `seats`) |
| class in an archived school | as for its own licence, else 20 | none (an archived school takes no joins into itself and its classes keep their own cap) |
| school | learners never join a school directly (`not_joinable`, unchanged) | — |

- `classCap(db, space, now)` returns the learner cap of the table (licensed stand-alone → 50 instead of `Infinity`; a class with its own licence in an uncovered school → 50; class in a covered school → `Infinity`, whatever the class holds). The school is checked first: a covered school decides; otherwise the class's own licence; otherwise 20.
- `schoolLimitsFrom(rows, now)` returns `{ licensed, students, teachers, license }` with `students` = 50 for a licence, `seats` for a contract, and **50 when nothing is active** (`licensed: false`, `students: SCHOOL_LEARNER_CAP`, `teachers: null`). `schoolIsFull` drops its `!limits.licensed` early return.
- New `learnerCapOf(db, space, now): Promise<{ cap: number | null; schoolId: string | null; schoolCap: number | null }>` gives the join statement every number in one read.
- A covered class keeps `classIsPro` as today: a licensed class or school covers **every** member, grandfathered ones included (SA-D7).

### 3.3 Atomic seat taking (D1 and the memory store)

New `Db.addLearnerWithinCaps(input): Promise<'added' | 'already' | SeatRefusal>` where `input = { spaceId, learnerId, joinedAt, spaceCap, learnerClassCap, schoolId, schoolCap }` (an absent cap is passed as `null`). D1 runs **one** statement:

```sql
INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at)
SELECT ?1, 'learner', ?2, 'student', ?3
WHERE
  -- the space's own cap (family 4, class 20 or 50); NULL = none
  (?4 IS NULL OR (SELECT COUNT(*) FROM memberships WHERE space_id = ?1 AND member_kind = 'learner') < ?4)
  -- the learner's live classes (only when the space is a class); NULL = not a class
  AND (?5 IS NULL OR (SELECT COUNT(*) FROM memberships m JOIN spaces s ON s.id = m.space_id
        WHERE m.member_kind = 'learner' AND m.member_id = ?2 AND s.kind = 'class' AND s.archived_at IS NULL) < ?5)
  -- the school's distinct learners; a learner already in a live sibling class takes no new seat
  AND (?6 IS NULL OR ?7 IS NULL
       OR EXISTS (SELECT 1 FROM memberships m JOIN spaces s ON s.id = m.space_id
                  WHERE s.parent_space_id = ?6 AND s.kind = 'class' AND s.archived_at IS NULL
                    AND m.member_kind = 'learner' AND m.member_id = ?2)
       OR (SELECT COUNT(DISTINCT m.member_id) FROM memberships m JOIN spaces s ON s.id = m.space_id
           WHERE s.parent_space_id = ?6 AND s.kind = 'class' AND s.archived_at IS NULL
             AND m.member_kind = 'learner') < ?7)
ON CONFLICT(space_id, member_kind, member_id) DO NOTHING
```

- SQLite needs the `SELECT` of an upsert to carry a `WHERE` (it does), so `ON CONFLICT` parses as the upsert clause.
- `meta.changes === 1` → `'added'`. `0` → read the membership: present → `'already'` (the idempotent `200 { alreadyMember: true }` of today, the name repair kept); absent → read the counts once in the `/join` order (`cap_learner`, `cap_class`, `cap_school`, `cap_family`) and return the first that is full. If none is full (a seat opened between the statement and the read), retry the statement once, then answer `409` with the code of the space's own cap (`cap_class` for a class, `cap_family` for a family) rather than loop.
- D1 runs one statement at a time per database, so the counts inside the statement see every committed join; this is the whole guarantee.
- `/join` (learner path) calls it in place of `classSeatCheck` + the family check + `addMembership`. `classSeatCheck` stays for the advisory reads (lookup `full`, the console, a transfer's preview).
- **Transfers and moves.** `executeTransfer` (`ExecuteTransferInput`) and the class-move swap gain `destSchoolId` / `destSchoolCap` and the same school subquery in their gate statement (the source membership still exists when the gate runs, so when the source class is a live class of the same school the learner already counts there and a move between two classes of one school takes no new seat, as `classSeatCheck` says today). `destCap` becomes the table's class cap (licensed stand-alone 50). A refused gate answers the existing block reasons `cap_class` / `cap_school`.
- The memory store (`packages/backend/src/store.ts`) implements the same rules in one synchronous step.
- **Account joins are not seats** (caregiver into a family, teacher into a school): unchanged, no learner cap. The teacher cap of a licensed school stays advisory as today (out of scope).

### 3.4 At the cap: what people read

- **Worker.** `409 { code, message, details: { reason, cap } }`. The learner `/join` answers `cap_family` for a family and `cap_class` for a class, **including a school cap** (`details.reason: 'cap_school'`): shipped apps map only `cap_class` to a class line (`sync-api.ts:343`), so a school refusal under its own code would read as the three-classes message. `details.reason` is `cap_family`, `cap_class` or `cap_school`. Transfers and class moves keep their block reasons `cap_class` / `cap_school` (console and guardian surfaces, which read them as today). Messages (logs only, English): "This family has room for {cap} learners", "This class has room for {cap} students", "This school has room for {cap} students". `cap_learner` unchanged.
- **Lookup.** `POST /spaces/lookup` answers `full: false` **always** from SA-1 on (the field stays in the response so shipped apps parse it). Every shipped `JoinSpaceScreen` (`JoinSpaceScreen.tsx:107-110`) stops on `full` **before** it shows the class roster and its "I'm already in this class" relink step. Today that never blocks a relink at a licensed class (`classCap` is `Infinity`) or at an unlicensed school (no school cap); after SA-1 a licensed class at 50 and every class of a school at 50 would be `full`, and a student there who reinstalls or gets a new device (a new learner profile) could no longer reach relink to get their profile back. With `full` false, a shipped app always reaches the roster pick and the name step; relink takes no seat, and the atomic `/join` (section 3.3) refuses a new learner with `cap_class` (also for a school cap, see Worker above), which shipped apps show as "This class is full. Ask your teacher.". The only cost: on a shipped app, a new learner at a full class types a name before reading the class line. A new field `seat: { full: boolean, reason: 'cap_family' | 'cap_class' | 'cap_school' | null, cap: number | null }` is added for SA-5. The lookup body gains an optional `learnerId`; when the request carries the device `Authorization` header and `authorizeDevice` passes for that learner (the `/join` check), `seat.full` is **false** when that learner already holds the seat: already a member of the space (a returning member on the same profile, a grandfathered member), or, for a class in a school, already in a live sibling class of that school (the school cap only). Without a learner, `seat` is computed for a new learner. A reinstall or a new device starts a **new** learner profile, so `seat.full` is true for it at a full space; it comes back through the class roster's relink, which takes no seat, and which no cap line may hide (SA-5 below). An unauthorized `learnerId` is ignored (the answer is as for a new learner), never an error, so the lookup reveals nothing about a learner it cannot vouch for. `full` never reads the learner and is always false (shipped apps reach relink, see above). The atomic `/join` (section 3.3) is still the only gate; lookup is advisory.
- **Learner app** (SA-5, `JoinSpaceScreen`, `joinErrorMessage`): sends its `learnerId` with device auth on lookup; reads `seat` when present (else `full`, as today) and chooses the line from `seat.reason`, not from the space kind guess: `cap_family` → `caregiver.join.errors.familyFull(cap)`, `cap_class` → the existing `classFull`, `cap_school` → `caregiver.join.errors.schoolFull` (section 9.1). When `seat.full` is true at a class with a roster, the screen still shows the roster pick and the relink step, with the at-cap line above the "I'm new" choice (a new learner reads the line; a returning one picks their name); the line never replaces the roster. `sync-api.ts` maps the `/join` code `cap_family` to its own code and `cap_class` by `details.reason` (`cap_school` → its own code); today both fall into the three-classes or the class message. The cap number comes from `seat.cap` / `details.cap` when present, else from `FAMILY_LIFETIME_LEARNERS`. The code step is kept; the learner can leave with Back. Telemetry `space.join.failed { reason: 'cap_family' | 'cap_school' }` (the existing event, two new reason codes).
- **Console** (grown-up pages):
  - Family home (the join code panel) and family Settings: the count `n of 4 learners` (`console.billing.usage.learners(n, cap)`, reused). At the cap, one line under the code: `console.seats.family.at(cap)`. Over the cap: `console.seats.family.over(n, cap)`. The code stays visible (a learner who is already a member can still use it to come back).
  - Class page (roster): the count from the roster response (`seats`, section 3.6), not the free cap. Free class at 20: the existing `capReached` line. Licensed class at 50: `console.seats.class.at(cap)`. Over: `console.seats.class.over(n, cap)`.
  - School page: `students n / 50 · teachers n / 10` (existing `school.licence.usage`), near-limit at 90 % (existing), at the cap: licensed or contracted → `console.schoolAtLimit` (existing, kept for covered schools only), unlicensed → new `console.seats.school.at(cap)`; over the cap `console.seats.school.over(n, cap)`. Unlicensed: `console.schoolNoLicenceCaps(classCap, schoolCap)` replaces `schoolNoLicence(cap)`.
  - Billing page cards: `usage` with the new caps (section 3.6). Contact line: `console.contactLineCaps(students, teachers)` replaces `contactLine` (in SA-1, so the billing page never shows the old 300 next to the new 50, section 10).
- No red, no warning colour beyond the existing note style, no "error", "failed", "limit exceeded", "over capacity" or "you must". Every at-cap line names what to do: remove a learner who no longer needs a place (family), ask the teacher (learner), or write to us for a contract (school).

### 3.5 Grandfathering (SA-D7)

- No migration rewrites or removes a membership. A space whose count is at or above its cap when SA-1 deploys simply refuses new learner joins and moves in.
- Every member keeps premium while the space's plan is active (`classIsPro`, `tierFromSpaces` unchanged).
- Removing a learner (by a grown-up) or a learner leaving lowers the count; joins open again only below the cap.
- Unarchiving a class re-counts its learners into its school. If that puts the school over its cap, the unarchive still succeeds (the learners were already members) and the school is grandfathered as above.

### 3.6 Counts in the API

- `GET /api/spaces/:id/roster` gains `seats: { learners, cap, schoolLearners, schoolCap }` (caps `null` = none; school fields `null` outside a school). Read only, from the same reads the roster already makes plus one school count. The console's `capState` uses it (`rollup.ts:74-78`); a console older than SA-1 ignores the field.
- `GET /api/spaces/:id/school`: `limits.students` per section 3.2 (50, `seats`, or 50 when unlicensed with `licensed: false`). Its `license` becomes an **allow-list** for every caller: `{ planKey, status, seats, expiresAt, active, subjectName }`. Today it spreads the whole Entitlement row (`school.ts:76`), Stripe's `providerRef` and `customerRef` and the `promoCode` included; billing details belong to the owner (SA-D11) and the billing summary already strips Stripe ids. The console reads only `planKey`, `status`, `expiresAt` and `active` (`SchoolAdmin.tsx:156-161`, `billing.ts` `statusLine`).
- `GET /api/billing/summary` (`billing-summary.ts:155-169`): family `learnerCap` 4; stand-alone class `learnerCap` 20 when free and 50 when covered by its own licence; a class in a school that holds its own plan (`billing-summary.ts:123`) `learnerCap` 50 while its school is not covered, null when the school is covered; any other class in a school `learnerCap` null (the school card shows the school count). A school card shows only the school line (`n of 50 students · n of 10 teachers`, or the contract's seats), never per-class lines; a class card shows only its own count (`classLearners`). School cards: seat counts for the **owner and admins** (was payers only; admins are no longer payers, SA-D11), `learnerCap` per section 3.2. Viewers other than these still see the learner count only.

### 3.7 Over-cap and near-cap lines, examples

| State | English line |
|---|---|
| family 3 of 4 | "3 of 4 learners" |
| family at 4 | "This family has 4 learners, the most it can hold. To add someone new, remove a learner in Settings first. Their progress stays on their device." |
| family 5 (grandfathered) | "This family has 5 learners. Everyone keeps their place. New learners can join when there are fewer than 4." |
| licensed class at 50 | "This class has 50 students, the most the Group License holds. New students can join when a place opens." |
| unlicensed school at 50 | "This school has 50 students, the most it holds without a contract. New students can join when a place opens." |
| licensed school at 50 | the existing `console.schoolAtLimit` line |
| school 62 of 50 | "This school has 62 students. Everyone keeps their place and everything they learned. New students can join when there are fewer than 50, or write to us for a contract." |

---

## 4. Plan copy: say the learner limit wherever a plan is described

| Surface | Today | After [SA] |
|---|---|---|
| Billing page, Family Plan includes (`includesLines.family.learners(n)`) | "Up to 5 learners in one family" | "Up to 4 learners in one family" (number from `FAMILY_LIFETIME_LEARNERS`, no string change) |
| Billing page, Group License includes, class (`includesLines.license.noCap(20)`) | "No 20-student cap" | new `includesLines.license.classLearners(50)`: "Up to 50 students in the class" (`noCap` is deleted) |
| Billing page, Group License includes, school (`includesLines.license.school(10, 300)`) | "A school holds up to 10 teachers and 300 students" | "A school holds up to 10 teachers and 50 students" (numbers from constants, no string change) |
| Billing page, contact line (`console.contactLine`) | "More than 300 students or 10 teachers? Write to us for a contract." | `console.contactLineCaps(50, 10)`: "More than 50 students or 10 teachers? Write to us for a contract." (`contactLine` is deleted) |
| Billing page, usage line | "n of 5 learners" · "n of 300 students · n of 10 teachers" | "n of 4 learners" · "n of 50 students" (licensed class) · "n of 50 students · n of 10 teachers" (numbers only) |
| School page, unlicensed note (`schoolNoLicence(20)`) | "No licence yet — each class keeps the free cap of 20 students." | `schoolNoLicenceCaps(20, 50)`: "No licence yet. Each class holds up to 20 students, and the school up to 50." |
| Site persona pages (parents, teachers), Plans block | "Plans for families and classes are at app.hangulroute.com." | the same, then new `landing.plans.sizes(4, 50)`: "The Family Plan is for up to 4 learners. The Group License is for up to 50 students in a class or a school." Shown only while the `paid.inApp` line is (the `paidPlans` claim), never a price, never a term (F-SITE-002 OD-7) |
| Terms (`/terms`, English-authoritative, F-I18N-001 L10) | renewal paragraph only | new paragraph `landing.legal.terms.sections.billing.paragraphs.sizes`: "The Family Plan covers one family with up to 4 learners. The Group License covers one class or one school with up to 50 students; a school also holds up to 10 teachers. A School Contract can cover more. When a family, class or school already has the most learners its plan holds, new learners cannot join until a place opens; nobody already in it is removed." (numbers from constants) |
| Learner app Plan screen | no plan description (status only, F-BILL-002 B-9) | unchanged |
| Native paywall | removed (F-BILL-002 B-9) | unchanged |

The site's word budget and claim tests (`landing-claims.test.tsx`, `site-word-budget.test.tsx`, `site-price-patterns.ts`) must stay green: the sizes line has no price, no "per year", no "lifetime".

---

## 5. Renaming a family, class or school

### 5.1 Who may rename (`space.rename`, `lib/can.ts`)

| Space | May rename | May not |
|---|---|---|
| family | the owner | caregivers (**default, owner may change**, OQ-9) |
| stand-alone class | the owner; a teacher member of the class | — |
| class in a school | the class owner; a teacher member of the class; the school's owner and admins (cascade) | other teachers of the school |
| school | the owner and the admins | teachers of the school |

Archived spaces cannot be renamed (`422 archived`); unarchive first. Learners never rename a space.

### 5.2 Route

`PATCH /api/spaces/:id/name` `{ name }` (signed-in account)

- Body: `SpaceRenameSchema = { name: SpaceNameSchema }`. `SpaceNameSchema` (content-schema) applies these steps **in this order**, and the client (SA-3) runs the same function:
  1. Unicode **NFC** normalization (a decomposed Hangul name and its composed form become the same string, for the length and for "same name").
  2. Every run of JavaScript `\s` whitespace (space, tab, line feed, carriage return, the other ASCII space controls, no-break space, U+2028, U+2029, the ideographic space U+3000, U+FEFF and the other Unicode spaces) becomes one U+0020; then trim. Tabs and new lines are therefore **collapsed, not refused**: the control check of step 4 runs on the collapsed string.
  3. Length 1 to 40 UTF-16 units (the create rule). Empty → `empty`, longer → `too_long`.
  4. Refuse any remaining control or format character, from an **explicit deny-list** (no `\p{...}`, no `u` flag: `SpaceNameSchema` lives in content-schema, which the Expo app also imports, and Hermes support for Unicode property escapes is not guaranteed, F-I18N-001 section 3.9, as `display-name.ts` notes): `SPACE_NAME_FORBIDDEN = /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]/` (C0 and C1 controls, soft hyphen, the Arabic letter mark, the Mongolian vowel separator, zero-width space, direction marks, bidi embeddings, overrides and isolates, invisible operators, the deprecated format characters, the byte order mark, interlinear annotation). U+200C and U+200D (ZWNJ and ZWJ, which some scripts need) stay allowed, as `DISPLAY_NAME_FORBIDDEN` allows them. Refused → `invalid`.
  5. At least one letter or digit, from an **explicit allow-list** (BMP only, no `u` flag): `SPACE_NAME_LETTER = /[A-Za-z0-9\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02AF\u0370-\u03FF\u0400-\u052F\u0590-\u05FF\u0600-\u06FF\u0900-\u0DFF\u0E00-\u0EFF\u1100-\u11FF\u1E00-\u1FFF\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7A3\uF900-\uFAFF\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFDC]/` (Latin with its extensions, Greek, Cyrillic, Hebrew, Arabic, the Indic and Southeast Asian blocks, Hangul jamo and syllables, kana, CJK, full-width letters and digits). The list errs toward accepting: a name with any listed character passes. None → `invalid`.
  The regex literals are plain BMP ranges, so they parse on Hermes; `String.prototype.normalize` (step 1) is called only at run time, by the Worker and the web console (the Expo app never renames a space). A test loads content-schema's space module under the mobile jest config.

  Invalid → `422 bad_name` with `details: { reason: 'empty' | 'too_long' | 'invalid' }`. `SpaceCreateSchema.name` uses the same `SpaceNameSchema` from SA-1 on and **keeps create's existing refusal** (`422 bad_request` with `issues`, `spaces.ts:99`), so the console's create error mapping does not change.
- `404 not_found`, `403 forbidden` (no `space.rename`), `422 archived`.
- Same name as stored (after normalizing) → `200 { space, changed: false }`, nothing written, no event.
- Otherwise one column-only statement `UPDATE spaces SET name = ? WHERE id = ? AND archived_at IS NULL` (new `Db.renameSpace(id, name): Promise<number>`, returning `changes`). `0` (an archive or a delete landed between the read and the write) → re-read the space: archived → `422 archived`, missing → `404 not_found`; neither writes a `space_events` row or `space.renamed`. `1` → for a school or a class of a school one `space_events` row (`renamed`, on the school, section 6.2), the server event `space.renamed { kind, role }` → `200 { space: publicSpace(space), changed: true }`.
- **No other writer touches the name.** Today `PATCH /:id/settings`, `/archive`, `/unarchive` and `POST /:id/code` each read the space and write it back with `putSpace` (`spaces.ts:225/236/247/270`), and `putSpace` upserts every column (`d1.ts:665-670`), so one that read the space before a rename would write the old name back. SA-1 drops `name` from `putSpace`'s `ON CONFLICT ... DO UPDATE SET` list (and the memory store keeps the stored name on update), so the name is written only at insert and by `renameSpace`. A D1-backed test interleaves: read the space, `renameSpace`, `putSpace` with the stale copy, and the stored name is the new one.
- Last write wins between two grown-ups renaming at once; each sees the stored name in the response.
- Rate limit: 30 renames per account per hour (`createRateLimiter`), `429 too_many_attempts`.

### 5.3 Console (SA-3)

- **One-tap inline rename.** A text button **Rename** (secondary, `touchTarget.min`) next to the page title wherever the signed-in grown-up holds `space.rename`: the family home, the class page (`/teach/space`, `/parent/space`), the school page, and the Name row at the top of Settings. On each class row of the school page, a **Rename** action beside **Open roster**. The button's accessible name is `console.rename.a11y(name)` ("Rename {name}"). The roster, family and school responses carry `canRename: boolean` (and the school response one per class row) so the page does not guess the rule, and `openMoves: boolean` (true when the space is the source or destination of an open class transfer, section 5.4), read only for a grown-up who holds `space.rename`.
- When `openMoves` is true, the open field shows one more hint line, `console.rename.openMoves`: "Some moves into or out of this space are waiting. A new name asks their grown-ups to look at the move again."
- Tap → the title is replaced in place by one `Field` (label `console.rename.label` "Name", the current name selected, a hint `console.rename.hint[kind]`) and **Save** / **Cancel**. The input's HTML `maxLength` is 120, not 40: it counts raw UTF-16 units before NFC, and a decomposed Hangul paste (macOS file names) takes up to 3 units per syllable, so a 40 would cut a valid name silently; the 40 is checked after NFC by `SpaceNameSchema` and shown as `tooLong(40)` [SA-0b review]. Enter saves, Escape cancels, focus returns to the Rename button. **IME:** Enter and Escape do nothing while `event.isComposing` is true (or `keyCode` is 229), and Save reads the input's committed value, so a Korean (or any IME) name is never saved or cancelled mid-syllable [SA-0b review].
- Validation in the field before sending (the same `SpaceNameSchema`): empty → `console.rename.empty`; too long → `console.rename.tooLong(40)`; no letter or digit → `console.rename.invalid`. Save is disabled while invalid or unchanged.
- Save → the new name shows at once (optimistic), the field closes, a polite live region says `console.rename.saved`. Until the `PATCH` settles, **Rename** stays `aria-disabled` with `aria-busy`, so a second rename cannot race the first. On failure the name the server last confirmed comes back (not merely the name shown before the click) and the field reopens with `console.rename.failed` (or `retry.offline` when offline, `console.rename.archived` on `422 archived`).
- The frame's space switcher, the page title, the Back label (`s.back(name)`) and the browser tab title update from the same state.
- **Creation stays prefilled** from the account name (`prefillName`); the start page gains the line `console.start.nameLater` ("You can change this name later.") under the name field.

### 5.4 Propagation

- Grown-up pages read the name from the API on every load, so other grown-ups see it on their next page load or `visibilitychange` refresh (`use-visible-refresh.ts`).
- Learner devices: the inbox memberships and the tier source carry the space name; `membership-store` replaces its cached list on every inbox refresh (after every successful sync), and `tier-store` replaces the source. SA-5 adds tests that a renamed space shows in Settings ("Classes & family") and on the Plan screen after one refresh, and fixes any place that keeps an older copy of a space name (historic notices, such as a class-move notice, keep the name of the time on purpose).
- Reports and notes read names at request time.
- **Class transfers keep a hash of both names in the consent terms.** A transfer stores `l_dest_name_hash` and `l_source_name_hash` (migration 0005); `termsStillCovered` / `consentFreshness` (`transfer.ts:217-226`, `:457-463`) answer `terms_changed` when either differs, and `transfers.ts:327` / `:708` refuse a consent sent against older terms with `409 terms_changed`. So renaming a family or class that is the source or destination of an open transfer **resets the learner consent**: the request goes back to the guardian, who sees the new name and is asked again, as F-SPACE-002 section 4.11 intends (the guardian agrees to a move to a named place). This is kept on purpose (no change to the terms); a consent sheet open at that moment answers `terms_changed` and reloads with the new name, the existing behaviour for any terms change. The console warns before saving (`console.rename.openMoves`, section 5.3). SA-1 adds a `transfers.test.ts` case: consent given, the destination renamed, then settle reports `terms_changed` and the request returns to the guardian; and a rename of a space with no open transfer changes nothing in `transfer_requests`.
- Historic move notices keep the name of the time on purpose.

### 5.5 Telemetry

Server event `space.renamed` with payload `{ kind: 'family' | 'class' | 'school', role: 'owner' | 'teacher' | 'admin' }` (codes only; never the name, never a space id).

---

## 6. School administrators

### 6.1 Model

- An administrator is a membership row `{ space_id: <school>, member_kind: 'account', role: 'admin' }`. At most `SCHOOL_ADMIN_CAP` (2) such rows per school; the owner is not one of them. Total 3 grown-ups with admin rights.
- Only schools have admins. A family or a class answers `422 not_a_school` on every admin route.
- An account that is already a teacher member of the school becomes an admin by accepting (its row's role changes from `teacher` to `admin`; the classes it owns stay its own; it keeps `class.create`, which admins have). An account that is an admin and later uses the school's teacher code stays an admin (`alreadyMember`, as today). Because the account path of `/join` reads the membership and then calls `addMembership`, whose D1 upsert rewrites `role = excluded.role` (`d1.ts:683-688`), a teacher-code join that read "no row" just before an accept would demote the new admin to `teacher`. SA-2 adds `Db.addMembershipIfAbsent(m)` (`INSERT ... ON CONFLICT(space_id, member_kind, member_id) DO NOTHING`, memory store alike) and uses it on the account path of `/join` and in `POST /:id/members` (`school.ts:98`), so neither ever rewrites the role of an existing row; when it inserts nothing, the route reads the row and answers `alreadyMember: true`.
- An admin stays assignable to the school's classes: `assignableTeachers` (`apps/web/src/lib/console/school.ts:46`) keeps `role === 'teacher' || role === 'admin' || isOwner` (SA-4, with a test), as the Worker's `POST /:id/members` already accepts them.
- **The role before the promotion is kept.** Accept records it on the membership: one additive column `memberships.promoted_from TEXT` (NULL, or `'teacher'` when accept promoted a teacher row; section 6.2), so a teacher of the school with no class yet who becomes an admin goes back to being a teacher, not out of the school. (`admin_invites` rows are purged 30 days after accept and `space_events` after 400 days, so neither can hold it.)
- **Ending an admin role** (removed by the owner, or the admin leaves): when the school row has `promoted_from = 'teacher'`, or the account owns or is a teacher member of a live class of the school, its school row goes back to `role = 'teacher'`, `promoted_from = NULL` (it stays a teacher of the school and keeps its classes); otherwise the school row is deleted (it leaves the school). One guarded statement each (`UPDATE memberships SET role = 'teacher', promoted_from = NULL WHERE ... AND role = 'admin' AND (promoted_from = 'teacher' OR EXISTS (class test))`, else `DELETE ... WHERE ... AND role = 'admin'`). `staysTeacher` (section 6.4) is the same test. The confirm lines say which happens (`removeNote`, `leaveAsk`, section 9.4).

### 6.2 Data (migrations, additive)

```sql
-- SA-1: 00NN_space_events.sql (the next free number when SA-1 merges; 0011 at the time of writing)
CREATE TABLE IF NOT EXISTS space_events (
  id                 TEXT PRIMARY KEY,                 -- sev:<uuid>
  space_id           TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL,                    -- no CHECK: validated by a zod enum in code, so later kinds stay additive
  actor_account_id   TEXT NOT NULL,
  subject_account_id TEXT,                             -- the admin joined, removed or leaving
  subject_space_id   TEXT,                             -- the class renamed, for a class of the school (no FK: the event outlives the class)
  invite_id          TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_space_events_space ON space_events(space_id, created_at);
```

```sql
-- SA-2: 00NN_admin_invites.sql (the next free number when SA-2 merges)
ALTER TABLE memberships ADD COLUMN promoted_from TEXT;   -- NULL, or 'teacher' when accept promoted a teacher row (section 6.1); additive, no CHECK
CREATE TABLE IF NOT EXISTS admin_invites (
  id           TEXT PRIMARY KEY,                       -- invite:<uuid>
  space_id     TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,                   -- hex SHA-256 of the token; the token is never stored
  created_by   TEXT NOT NULL,                          -- account id of the owner
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  accepted_by  TEXT,
  accepted_at  TEXT,
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_invites_space ON admin_invites(space_id, created_at);
```

`space_events.kind` has **no CHECK** (a later kind would otherwise need a table rebuild, which the additive-only rule forbids): `SpaceEventKindSchema = z.enum(['renamed', 'class_renamed', 'admin_invite_created', 'admin_invite_revoked', 'admin_joined', 'admin_removed', 'admin_left'])` in content-schema is the registry, every insert goes through it, and a test refuses an unknown kind. Rows are written for **schools only**: `renamed` for the school, `class_renamed` (with `subject_space_id`) for a class whose parent is the school, and the admin kinds. `scheduled.ts` deletes `space_events` rows older than 400 days (SA-1) and `admin_invites` rows whose `expires_at`, `accepted_at` or `revoked_at` is older than 30 days (SA-2). `schema-v2` mirrors and the memory store implement both, and `promoted_from`. `ALTER TABLE ... ADD COLUMN` is additive (the repo's 0003, 0006 and 0010 add columns the same way).

**Account ids in these rows.** `space_events.actor_account_id` / `subject_account_id` and `admin_invites.created_by` / `accepted_by` hold account ids for their retention (400 days, 30 days). No route deletes an account today (F-BILL-002 section 1 keeps account deletion out of scope); a later account-deletion spec must delete or null these ids with the account, as it must for `billing_events` (F-BILL-002 section 5). Until then, and for any account row that is missing, the history resolves the name at read time and shows `console.admins.history.someone` ("A former member") in place of a name; never an id.

### 6.3 Invite link

- **Token**: 32 random bytes (`crypto.getRandomValues`), base64url, 43 characters. Stored as `token_hash` only. Shown to the owner **once**, in the create response; lost → revoke and make a new one.
- **Link**: `https://app.hangulroute.com/account/invite#t=<token>` (`ADMIN_INVITE_PATH = '/account/invite'`, `adminInviteUrl(appUrl, token)` and `parseAdminInvite(hash)` in content-schema `app-shell.ts`, beside `joinLinkUrl`). The token is in the **fragment**: browsers never send it in a request line or a `Referer`, so it reaches no server log. Nothing else is in the link: no school name, no email, no id.
- **Single use**, **expires** 7 days after creation, **revocable** by the owner until accepted.
- **Open invites count toward the cap at creation**, in **one guarded statement** so two tabs cannot both pass: `INSERT INTO admin_invites (...) SELECT ?id, ?sp, ?hash, ?by, ?now, ?exp WHERE (SELECT COUNT(*) FROM memberships WHERE space_id = ?sp AND member_kind = 'account' AND role = 'admin') + (SELECT COUNT(*) FROM admin_invites WHERE space_id = ?sp AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?now) < ?cap` (`?cap` = `SCHOOL_ADMIN_CAP`, bound, never a literal); `changes = 0` → `409 admins_full`. Accept re-checks the admin count atomically (section 6.4).
- Creating an invite needs a **fresh sign-in** (step-up, `requireStepUp`, F-BILL-002 section 4.4): it hands someone access to the school's rosters. **Default, owner may change** (OQ-7).
- **Who accepted is checkable.** The link is a bearer link: whoever signs in with it gets school-wide access to rosters and reports, can move and remove students and can approve device re-links (`relink.ts` `requireManager` uses `roster.manage`, which cascades from a school admin). A display name proves nothing (anyone can type the intended person's name). So:
  1. **Accept needs a verified email.** The Worker reads the accepting account's primary email and its verification from Clerk's Backend API (`users.getUser(accountId)` with the already-bound `CLERK_SECRET_KEY`), through a new injectable `IdentityPort` (`packages/backend/src/lib/identity.ts`; tests use a fake). No primary email, or one not `verified` → `403 email_unverified` (the invite stays open). A deployment with only `CLERK_JWT_KEY` bound fails closed: `503 identity_not_configured`. On the dev fallback (never production) the port returns the stored account email as verified, so local runs work. `accounts.email` is not used: it is client-supplied at space creation (`spaces.ts:101`).
  2. **The owner sees each admin's verified sign-in email** next to the display name, on the admins panel and in its history: `GET /:id/admins` adds `email` to each admin row for the owner only, read from the same port at request time. It is never stored by these routes, never in preview, never sent to an admin caller, never in telemetry.
  3. **A one-time notice for the owner.** For 7 days after an `admin_joined` event whose admin still holds the role, the owner's school page shows `console.admins.newAdmin(name, email)` with **Remove** (the admins panel's confirm sheet) and **Got it** (`console.admins.newAdminDismiss.cta`); Got it is remembered per browser by the event's id through the safe storage wrapper (an id, not PII, never in a URL).
  4. The consent block names every power the role carries (`console.adminInvite.can`, section 9.4), and the privacy paragraph says so (section 6.7).
  An owner-approval step (an accepted invite waits until the owner confirms) is not taken: the owner already chose the person by sending the link, and the notice with Remove covers a forwarded link. **Default, owner may change** (OQ-13).

### 6.4 Routes

| Method · path | Who | Result |
|---|---|---|
| `GET /api/spaces/:id/admins` | owner or admin of the school | `{ owner: { accountId, name }, admins: [{ accountId, name, email (owner only, section 6.3), joinedAt, staysTeacher }], limit: 2, invites: [{ id, createdAt, expiresAt }] (owner only; open ones), events: [{ kind, at, actorName, subjectName }] (owner only; the last 20) }`. `name` = display name, else email, as `GET /:id/members` does (these are signed-in members of the school). `joinedAt` is the time of the latest `admin_joined` event for that account (the membership's `joined_at` keeps the teacher join date when a teacher was promoted), else the membership's `joined_at`. A `class_renamed` row shows as `history.renamedClass` (no class name, so a deleted class needs no special case). A missing account shows as `history.someone`. |
| `POST /api/spaces/:id/admin-invites` | owner (`admin.manage`), fresh sign-in | `201 { invite: { id, createdAt, expiresAt }, url }` · `409 admins_full` · `403 reverify_required` (step-up: `requireStepUp`'s Clerk reverification body, `step-up.ts:46-50`, which `useReverification` keys on, as checkout and portal answer) · `422 not_a_school` · `422 archived` |
| `DELETE /api/spaces/:id/admin-invites/:inviteId` | owner | one guarded statement `UPDATE admin_invites SET revoked_at = ?now WHERE id = ? AND space_id = ? AND accepted_at IS NULL AND revoked_at IS NULL`, then one read: revoked (now or before) → `200 { revoked: true }` (idempotent); accepted → `409 invite_used`; not this school's → `404`. A revoke that lands after an accept never stamps `revoked_at` on the accepted row. |
| `POST /api/admin-invites/preview` `{ token }` | signed-in account; 20 per client key per hour | `200 { school: { name }, invitedBy: string \| null, expiresAt, state: 'open' }` · `200 { state: 'already_admin', school: { name } }` · `404 invite_not_found` · `410 invite_used` / `invite_expired` / `invite_revoked` · `409 already_owner` · `409 admins_full` · `429`. `invitedBy` is the owner's **display name, else null**, never an email (a forwarded link must not show the owner's address); null → the page says `console.adminInvite.invitedByOwner`. |
| `POST /api/admin-invites/accept` `{ token }` | signed-in account with a verified primary email (section 6.3); same limiter | `200 { space: { id, kind, name }, role: 'admin' }` · the refusals of preview · `403 email_unverified` · `503 identity_not_configured` |
| `DELETE /api/spaces/:id/admins/:accountId` | owner | ends that admin role (section 6.1: back to teacher when they own or teach a class of the school, else out of the school) → `200 { removed: true, stays: 'teacher' \| 'none' }`; the owner → `409 owner`; not an admin → `404` |
| `POST /api/spaces/:id/admins/leave` | the admin themself | ends their own admin role the same way → `200 { left: true, stays: 'teacher' \| 'none' }`; the owner → `409 owner` |
| `DELETE /api/spaces/:id/members/account/:memberId` (existing) | `roster.manage` | gains: on a school, removing an `admin` needs `admin.manage` (`403 owner_only`), and the owner's call runs the same end-admin-role logic as `DELETE /:id/admins/:accountId` (section 6.1: back to teacher, else out) and answers `200 { removed: true, stays: 'teacher' \| 'none' }`, so both ways give one result; on a **class whose parent is a school**, removing an account that is the school's owner or one of its admins also needs `admin.manage` on the school (`403 owner_only`), so the class cascade (`can.ts:83-89`) cannot be used by one admin to unassign another admin or the owner |
| `GET /api/spaces/:id/members` (existing) | `roster.manage` | gains `canRemove: boolean` per member, computed by the Worker for the caller (a school admin: true for teachers only, never for the owner or another admin), so Settings does not guess (section 6.6) |

The token travels only in the JSON body of preview and accept, never in a path or query.

**Accept, atomically** (`Db.acceptAdminInvite({ inviteId, accountId, now })`, one D1 batch, the gate-then-guarded-writes pattern of F-SPACE-002 section 4.6):

1. Gate: `UPDATE admin_invites SET accepted_by = ?acc, accepted_at = ?now WHERE id = ?inv AND space_id = ?sp AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?now AND EXISTS (SELECT 1 FROM spaces WHERE id = ?sp AND kind = 'school' AND archived_at IS NULL AND owner_account_id <> ?acc) AND NOT EXISTS (SELECT 1 FROM memberships WHERE space_id = ?sp AND member_kind = 'account' AND member_id = ?acc AND role IN ('admin', 'owner')) AND (SELECT COUNT(*) FROM memberships WHERE space_id = ?sp AND member_kind = 'account' AND role = 'admin') < ?cap` (`?cap` = `SCHOOL_ADMIN_CAP`, bound)
2. `INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) SELECT ?sp, 'account', ?acc, 'admin', ?now WHERE EXISTS (SELECT 1 FROM admin_invites WHERE id = ?inv AND accepted_by = ?acc AND accepted_at = ?now) ON CONFLICT(space_id, member_kind, member_id) DO UPDATE SET role = 'admin', promoted_from = 'teacher' WHERE memberships.role = 'teacher'` (only a teacher row is promoted, and it records `promoted_from`; an `owner` row, should it ever disagree with `spaces.owner_account_id`, is never demoted)
3. `INSERT INTO space_events (...) SELECT ... 'admin_joined' ... WHERE EXISTS (the same test as 2)`

Then read the invite: `accepted_by = acc` → accepted. Otherwise name the reason from one read: used, revoked, expired, owner, already an admin (`200 already_admin`, the invite stays open), or `admins_full`.

### 6.5 Permissions (`lib/can.ts`)

New actions, each granted to the `owner` role of the space only (any kind; on a family or a class they match `space.manage`, so nothing changes there): `billing.manage`, `admin.manage`, `space.settings`, `space.archive`. New action `space.rename` (section 5.1). Route changes:

| Route | Today | After [SA] |
|---|---|---|
| `POST /entitlements/stripe/checkout`, `/stripe/portal` (`ownedSpace`) | `space.manage` | `billing.manage` |
| `GET /billing/receipts`, `POST /billing/receipt-link` (`paidSpace`) | `space.manage` | `billing.manage` |
| billing summary `payer` | `space.manage` | `billing.manage` |
| `adultSpacesOf` `payer` (`packages/backend/src/lib/entitlement.ts:244`; browse coverage of an archived space with a live licence, `:254`) | `space.manage` | `billing.manage` (a school admin no longer gets browse coverage from an archived school; the owner still does), with a `can` and an entitlement test |
| `PATCH /spaces/:id/settings` | `space.manage` | `space.settings` |
| `POST /spaces/:id/archive`, `/unarchive` | `space.manage` | `space.archive` |
| `GET /spaces/:id/school` | `space.manage` | unchanged (owner and admins); `license` allow-listed for every caller (section 3.6) |
| `POST /spaces/:id/code` | `space.manage` | unchanged (owner and admins) |

| On a school | Owner | Admin | Teacher member |
|---|---|---|---|
| see the school page, licence status, seat counts | yes | yes | no |
| rename the school; rename its classes | yes | yes | own or taught class only |
| create a class | yes | yes | yes |
| see, copy, regenerate the teacher invite code; assign a teacher | yes | yes | no |
| remove a teacher from the school | yes | yes (teachers only, never the owner or another admin, at the school or through a class) | no |
| open class rosters and reports; move students between the school's classes | yes | yes (cascade) | own or taught class only |
| buy, manage or cancel the plan; receipts | yes | no (read-only card: `billing.readOnly.schoolAdmin`) | no |
| change school settings (anonymized roster, consent mode) | yes | no (read-only) | no |
| archive or unarchive the school | yes | no | no |
| invite, revoke, remove admins; see the admin history | yes | no (sees the admin list) | no |
| leave the admin role / the school | no (owner) | yes (section 6.1: stays a teacher when they were one or have a class there) | no route today (a teacher is removed by the owner or an admin; teacher self-leave is out of scope, section 14) |
| be removed | never | as admin, by the owner only (also through a class of the school, section 6.4) | by the owner or an admin |

Transferring ownership is out of scope (OQ-8).

### 6.6 Console (SA-4)

**Admins panel** on the school page (owner and admins), under the teacher invite. Heading `console.admins.title` "Administrators". One row for the owner ("{name} · owner"), one per admin ("{name} · admin · joined {day}"), the count `console.admins.count(n, 2)`, the line `console.admins.about(2)`.

Owner only:
- Each admin row shows the verified sign-in email under the name (section 6.3).
- The new-admin notice (section 6.3, item 3) above the panel.
- **Invite an administrator** (primary) while `admins + open invites < 2`; otherwise the line `console.admins.full(max)`. Tap → the step-up dialog when needed (`StepUpDialog`) → the link in a `JoinLinkPanel`-style box (text, **Copy link**, no QR) with the consent lines `console.admins.invite.warning` and `console.admins.invite.once(date)`. Closing the box hides the link for good.
- Open invites: "Invite made {day} · ends {date}" with **Revoke** (confirm sheet `console.admins.revokeAsk`: action `console.admins.revoke.cta`, dismiss `console.admins.revokeKeep.cta`, so the sheet never shows two cancel buttons).
- The step-up dialog is the billing `StepUpDialog` with `console.admins.invite.stepUp.body` and `.reason` in place of the billing body and reason (SA-0b D10). After Revoke or Remove the panel says `console.admins.revoked` or `console.admins.removed(name)`; a failed Revoke, Remove or Stop says `console.admins.actionFailed`.
- Each admin: **Remove** (confirm sheet `console.admins.removeAsk(name, school)`, with the line `console.admins.removeNote.staysTeacher` when `staysTeacher` (they own or teach a class of the school), else `console.admins.removeNote.leaves`).
- **History**: the last 20 events, one line each (`console.admins.history.*`), names read at request time, newest first.

Admin only: **Stop being an administrator** (confirm sheet `console.admins.leaveAsk(school)` with `console.admins.leaveNote.staysTeacher` or `.leaves`), then `console.admins.left(school)` (one-shot flash, step 7 below) on: the teacher home when `stays: 'teacher'` (a teacher member cannot open the school page, section 6.5; SA-0b D14); the router's grown-up home when `stays: 'none'` (`/start` when the account holds no space any more).

On an **archived** school the owner keeps **Remove** on each admin row and **Revoke** on each open invite (neither route refuses an archived school, and an owner must be able to take access away while its classes stay live); only **Invite an administrator** is hidden (`422 archived`) [SA-0b review].

A Revoke, Remove or Stop answered `404`, `403` or `409` (already done in another tab, the viewer's role just removed, the owner) reloads the panel, and a viewer who lost the admin role goes to their grown-up home; `console.admins.actionFailed` is only for a network failure or a `5xx` [SA-0b review].

```
+----------------------------------------------------------+
| Administrators                              2 of 2 added |
|  Ms Park · owner                                          |
|  Mr Lee · admin · joined Oct 3              [ Remove ]    |
|    lee@example.org            (owner only)                |
|  Dr Cho · admin · joined Oct 18             [ Remove ]    |
|    cho@example.org            (owner only)                |
|  A school can have 2 administrators besides its owner.    |
|  All 2 places are taken. Remove an administrator or       |
|  revoke an invite to add someone else.                    |
|  > History                                                |
+----------------------------------------------------------+
```

**Accept page** `app.hangulroute.com/account/invite` (`APP_ROUTES.adminInvite`, console route group).

Most invitees are new people who are signed out or have no account yet, and every console page sits inside `GrownUpGate` (`apps/web/src/components/console/GrownUpLayout.tsx:53-93`): signed out, it renders `<Pending/>` and `router.replace(signedOutTarget(pathname, search))`, and `signedOutTarget` (`signin-flow.ts:238`) keeps the path and query only, so the `#t=` fragment would be gone before the page's own code runs; the `GrownUpLock` "Sign in again" and PIN paths lose it the same way, and a sign-up ends on `/start` (`ClerkSignIn.tsx:127`, `signUpFallbackRedirectUrl={startUrl}`). So:

1. **Capture before any gate.** `captureAdminInvite(location)` (`apps/web/src/lib/console/admin-invite.ts`) runs once in a `useState` initializer at the top of `GrownUpGate` (so before its redirect effect, before the lock and before any child renders): when `pathname === ADMIN_INVITE_PATH` and `parseAdminInvite(location.hash)` returns a token, it writes `{ token, savedAt }` to `sessionStorage` key `hr:admin-invite` through the safe storage wrapper (`apps/web/src/lib/i18n/safe-storage.ts`) and removes the fragment with `history.replaceState` (path and query kept). Idempotent; it never runs on another path. The stash is removed after accept, **Not now**, **Go to my home** (in every state, a `429` and a network failure included: the link still works, and a kept stash would make `/start` send an invitee with no space straight back into the same `429`), any sign-out other than **Use another account** (`clearGrownUpTab` in `apps/web/src/lib/console/unlock.ts`, which the frame's Sign out, Back to learning and Open the app on this device call, also removes `hr:admin-invite`, so the next person to sign in in a shared tab is never forwarded to someone else's invite), or 30 minutes. Only **Try again**, **Use another account** and the `GrownUpLock` re-auth keep it [SA-0b review].
2. **Signed out** → the gate's redirect carries `next=/account/invite` (`isGrownUpPath` and so `safeNextPath` accept `/account/invite`; a test pins it). `/signin` shows its own copy, with one more line `console.adminInvite.signIn` ("Sign in to see this invite.") while a live stash exists. After sign-in, Clerk returns to `next`.
3. **Sign-up** → while a live stash exists, `ClerkWidget`'s `signUpFallbackRedirectUrl` is `/account/invite` (not `/start`), and `/start` itself sends a signed-in account with a live stash to `/account/invite` first. An invitee never has to make their own space.
4. **Locked device** (`GrownUpLock`) → the token is already stashed, so "Sign in again" and the PIN return to `/account/invite` and the page reads the stash.
5. **No stash** (a new tab opened by an email verification, more than 30 minutes, another browser) → one calm line `console.adminInvite.reopen` ("Open your invite link again to see it.") with **Go to my home**.
6. **Signed in with a stash** → `POST /admin-invites/preview` → **"Join {school} as an administrator?"** (`console.adminInvite.title`), "Invited by {name}" (`invitedBy`, or `console.adminInvite.invitedByOwner` when null), **"Signed in as {who}"** (`console.adminInvite.signedInAs`, the signed-in account's primary email from Clerk's `useUser()` on the page itself, else its display name; shown only to that person) with **Use another account** (`console.adminInvite.switchAccount.cta`: signs out and keeps the stash, so the sign-in that follows returns to the invite; on a shared computer the person who happens to be signed in sees whose account would become an admin), the consent block `console.adminInvite.can` / `console.adminInvite.cannot` / `console.adminInvite.leave`, **Accept** (primary) and **Not now**.

The token never appears in a URL the app builds: not in `/signin?next=`, not in Clerk's `redirect_url`, not in a page title, not in telemetry. Tests (SA-4, `admin-invite-page.test.tsx`, `signin-flow.test.ts`): signed-out open → sign in → the invite shown; sign-up → the invite shown (not `/start`); locked device → invite shown after unlock; a fresh tab without the stash → `reopen`; the token is absent from the `/signin` URL and from the Clerk redirect.

Then:
7. Accept → the school page with `console.adminInvite.done(school)`. The notice travels as a one-shot flash (`sessionStorage` `hr:console-flash` `{ kind, school }` through the safe storage wrapper, the school's name kept in this tab only, read and removed on the next page's first render), never as a query parameter, so no name is in an address, the history or a log; `console.admins.left(school)` uses the same flash.
8. Refusals in one calm line each (`console.adminInvite.used`, `.expired`, `.revoked`, `.full(max)`, `.owner`, `.alreadyAdmin`, `.notFound`, `.emailUnverified`), with **Go to my home**. A `429` (`caregiver.retry.tooManyAttempts`), a network failure or `503 identity_not_configured` (`console.cantReach`) shows **Try again** and **Go to my home**.

Billing page, school card for an admin: plan, status, seat counts, no actions, `billing.readOnly.schoolAdmin` ("The school's owner manages this plan.").

**School Settings for an admin**, control by control (owner: unchanged):
- Name row: **Rename** shown (admins hold `space.rename` on the school).
- Grown-ups list: **Remove** shown only where the member's `canRemove` (from `GET /:id/members`) is true: teachers yes; the owner and the other admin never. The admins themselves are managed on the admins panel, not here.
- Learners list (a school has none directly): unchanged.
- Anonymized roster and consent mode: the current values shown as read-only text, no switch: consent mode as its option's existing label, Anonymize roster with `console.settings.privacy.anonymizeOn` or `.anonymizeOff`, then one line `console.settings.ownerOnly` (SA-0b D16).
- Danger zone (archive, delete data): hidden.

Tests: `admins-panel.test.tsx` and a settings test (`school-settings-admin.test.tsx`) cover each control for owner, admin and teacher.

### 6.7 Privacy text (SA-4, English, `/privacy`, English-authoritative)

Add to the section on what school grown-ups see: "A school's owner can add up to two administrators with an invite link. Administrators see what the owner sees about the school's classes and students, except billing: they can open class rosters and reports, move students between the school's classes, remove students from a class, and approve a student's request to link a new device. To accept, an administrator needs an account with a verified email. The owner sees who is an administrator, with the email they sign in with, when they joined or left, and who renamed the school or one of its classes. We keep this history for 400 days." (Family and stand-alone class renames keep no such history, SA-D12.)

### 6.8 Telemetry

Server events, codes only (prefix `space.admin.`): `space.admin.invite_created`, `space.admin.invite_revoked`, `space.admin.joined`, `space.admin.accept_refused { reason: 'used' | 'expired' | 'revoked' | 'full' | 'owner' | 'not_found' | 'email_unverified' }`, `space.admin.removed`, `space.admin.left`. Never a token, a name, an email or an id. `space_events` is the record; telemetry is not evidence.

---

## 7. Data summary (all additive)

| Migration | Row | Contents |
|---|---|---|
| `space_events` table | SA-1 | section 6.2 |
| `admin_invites` table | SA-2 | section 6.2 |
| `memberships.promoted_from` column (`ALTER TABLE ... ADD COLUMN`, nullable, no CHECK) | SA-2 | section 6.1 |

One added nullable column and no other column change, no CHECK changes (the `memberships.role` CHECK already allows `admin`), no backfill. Caps are code constants, so no data moves.

---

## 8. Telemetry summary

| Event | Row | Payload |
|---|---|---|
| `space.join.failed` (client, existing) | SA-5 | `reason` gains `cap_family`, `cap_school` |
| `space.seat_refused` (server, new) | SA-1 | `{ kind: 'family' \| 'class', reason: 'cap_family' \| 'cap_class' \| 'cap_school' \| 'cap_learner', path: 'join' \| 'transfer' \| 'move' }` |
| `space.renamed` (server, new) | SA-1 | `{ kind, role }` |
| `space.admin.*` (server, new) | SA-2 | section 6.8 |

Each new name and payload code is added to the content-schema telemetry registry and the server-events filter (shared files, append-only).

---

## 9. Strings (en, es, ko)

Written to the F-I18N-001 section 3.10 style guide: es neutral, "tú", no gender agreement on the reader; ko 해요체, no particle attached to a variable (colon forms where a name or number leads); glossary terms (가족 플랜, 그룹 라이선스, 학습자, 학생, 선생님, 관리자; Plan Familiar, Licencia de Grupo, estudiante, docente, admin). Every row lands in the PR named; the ledger is re-signed in that PR's fix stage after an independent review of the es and ko values, which may still improve the drafts below.

### 9.1 Learner app (SA-5, `caregiver` namespace)

| Key | en | es | ko |
|---|---|---|---|
| `caregiver.join.errors.familyFull(cap)` | This family already has {cap} learners. Ask a grown-up in your family. | Esta familia ya tiene {cap} estudiantes. Pregúntale a un adulto de tu familia. | 이 가족에는 이미 학습자가 {cap}명 있어요. 가족 어른에게 물어봐요. |
| `caregiver.join.errors.schoolFull` | This school is full right now. Ask your teacher. | Esta escuela está llena por ahora. Pregúntale a tu docente. | 이 학교는 지금 자리가 다 찼어요. 선생님에게 물어봐요. |

### 9.2 Seats and plan copy in the console (SA-3, `console` namespace)

| Key | en | es | ko |
|---|---|---|---|
| `console.seats.family.at(cap)` | This family has {cap} learners, the most it can hold. To add someone new, remove a learner in Settings first. Their progress stays on their device. | Esta familia tiene {cap} estudiantes, el máximo posible. Para sumar a alguien, primero quita a un estudiante en Ajustes. Su progreso se queda en su dispositivo. | 이 가족에는 학습자가 {cap}명 있어서 더 들어올 수 없어요. 새로 추가하려면 먼저 설정에서 학습자 한 명을 빼 주세요. 그 학습자의 진도는 기기에 그대로 남아요. |
| `console.seats.family.over(n, cap)` | This family has {n} learners. Everyone keeps their place. New learners can join when there are fewer than {cap}. | Esta familia tiene {n} estudiantes. Nadie pierde su lugar. Pueden unirse estudiantes nuevos cuando haya menos de {cap}. | 이 가족에는 학습자가 {n}명 있어요. 모두 그대로 함께해요. 학습자가 {cap}명보다 적어지면 새 학습자가 들어올 수 있어요. |
| `console.seats.class.at(cap)` | This class has {cap} students, the most the Group License holds. New students can join when a place opens. | Esta clase tiene {cap} estudiantes, el máximo de la Licencia de Grupo. Pueden unirse estudiantes nuevos cuando se libere un lugar. | 이 반에는 학생이 {cap}명 있어요. 그룹 라이선스로 함께할 수 있는 최대 인원이에요. 자리가 나면 새 학생이 들어올 수 있어요. |
| `console.seats.class.over(n, cap)` | This class has {n} students. Everyone keeps their place. New students can join when there are fewer than {cap}. | Esta clase tiene {n} estudiantes. Nadie pierde su lugar. Pueden unirse estudiantes nuevos cuando haya menos de {cap}. | 이 반에는 학생이 {n}명 있어요. 모두 그대로 함께해요. 학생이 {cap}명보다 적어지면 새 학생이 들어올 수 있어요. |
| `console.seats.school.at(cap)` (unlicensed school at its cap; `schoolAtLimit` stays for covered schools) | This school has {cap} students, the most it holds without a contract. New students can join when a place opens. | Esta escuela tiene {cap} estudiantes, el máximo sin contrato. Pueden unirse estudiantes nuevos cuando se libere un lugar. | 이 학교에는 학생이 {cap}명 있어요. 계약 없이 함께할 수 있는 최대 인원이에요. 자리가 나면 새 학생이 들어올 수 있어요. |
| `console.seats.school.over(n, cap)` | This school has {n} students. Everyone keeps their place and everything they learned. New students can join when there are fewer than {cap}, or write to us for a contract. | Esta escuela tiene {n} estudiantes. Nadie pierde su lugar ni lo que aprendió. Pueden unirse estudiantes nuevos cuando haya menos de {cap}, o escríbenos para un contrato. | 이 학교에는 학생이 {n}명 있어요. 모두 자리와 배운 내용을 그대로 지켜요. 학생이 {cap}명보다 적어지면 새 학생이 들어올 수 있어요. 더 필요하면 계약을 문의해 주세요. |
| `console.schoolNoLicenceCaps(classCap, schoolCap)` (replaces `schoolNoLicence`) | No licence yet. Each class holds up to {classCap} students, and the school up to {schoolCap}. | Aún no hay licencia. Cada clase admite hasta {classCap} estudiantes, y la escuela hasta {schoolCap}. | 아직 라이선스가 없어요. 반마다 학생 최대 {classCap}명, 학교 전체는 최대 {schoolCap}명이에요. |
| `console.contactLineCaps(students, teachers)` (replaces `contactLine`; stays in `FORMAL_ALLOWED` as `contactLine` was, so ko reads in 합니다체 like the other plan lines of `ko/console.ts`; `명이` is a literal counter and particle, not a particle on a variable; **lands in SA-1**, section 10) | More than {students} students or {teachers} teachers? Write to us for a contract. | ¿Más de {students} estudiantes o {teachers} docentes? Escríbenos para un contrato. | 학생 {students}명 또는 선생님 {teachers}명이 넘으면 계약 문의를 보내 주십시오. |
| `console.billing.includesLines.license.classLearners(n)` (replaces `noCap`) | Up to {n} students in the class | Hasta {n} estudiantes en la clase | 반 하나에 학생 최대 {n}명 |
| `console.billing.readOnly.schoolAdmin` | The school's owner manages this plan. | Quien creó la escuela gestiona este plan. | 학교를 만든 분이 이 플랜을 관리해요. |

Plural forms: the en and es functions use `plural()` where `{n}` / `{cap}` can be 1, as the existing `usage` lines do; the tables show the `other` form.

### 9.3 Rename (SA-3, `console` namespace)

| Key | en | es | ko |
|---|---|---|---|
| `console.rename.cta` | Rename | Renombrar | 이름 바꾸기 |
| `console.rename.a11y(name)` | Rename {name} | Renombrar {name} | 이름 바꾸기: {name} |
| `console.rename.label` | Name | Nombre | 이름 |
| `console.rename.save.cta` | Save | Guardar | 저장 |
| `console.rename.cancel.cta` | Cancel | Cancelar | 취소 |
| `console.rename.hint.family` | Everyone in the family sees this name. | Todos en la familia ven este nombre. | 가족 모두가 이 이름을 봐요. |
| `console.rename.hint.class` | Students see this name in the app. | Los estudiantes ven este nombre en la app. | 학생들이 앱에서 이 이름을 봐요. |
| `console.rename.hint.school` | Teachers and administrators see this name. | Docentes y admins ven este nombre. | 선생님과 관리자가 이 이름을 봐요. |
| `console.rename.empty` | Type a name. | Escribe un nombre. | 이름을 적어 주세요. |
| `console.rename.tooLong(max)` | Names can be up to {max} characters. | Los nombres pueden tener hasta {max} caracteres. | 이름은 {max}자까지 쓸 수 있어요. |
| `console.rename.invalid` | Use letters or numbers in the name. | Usa letras o números en el nombre. | 이름에 글자나 숫자를 넣어 주세요. |
| `console.rename.saved` | Name saved. | Nombre guardado. | 이름을 저장했어요. |
| `console.rename.failed` | Couldn't save the name. Try again. | No se pudo guardar el nombre. Inténtalo de nuevo. | 이름을 저장하지 못했어요. 다시 해 볼까요? |
| `console.rename.openMoves` | Some moves into or out of this space are waiting. A new name asks their grown-ups to look at the move again. | Hay cambios de clase pendientes que entran o salen de este espacio. Con un nombre nuevo, sus adultos deberán revisar el cambio otra vez. | 이 공간으로 오거나 나가는 이동이 기다리고 있어요. 이름을 바꾸면 그 학습자의 어른이 이동을 다시 확인해야 해요. |
| `console.rename.archived` | Unarchive it first to change the name. | Primero desarchívalo para cambiar el nombre. | 이름을 바꾸려면 먼저 보관을 풀어 주세요. |
| `console.start.nameLater` | You can change this name later. | Puedes cambiar este nombre después. | 이 이름은 나중에 바꿀 수 있어요. |

### 9.4 Administrators (SA-4, `console` namespace)

| Key | en | es | ko |
|---|---|---|---|
| `console.admins.title` | Administrators | Admins | 관리자 |
| `console.admins.count(n, max)` | {n} of {max} added | {n} de {max} agregados | 추가한 관리자: {n}/{max}명 |
| `console.admins.ownerRow(name)` | {name} · owner | {name} · titular | {name} · 소유자 |
| `console.admins.adminRow(name, day)` | {name} · admin · joined {day} | {name} · admin · se unió {day} | {name} · 관리자 · 참여: {day} |
| `console.admins.newAdmin(name, email)` | New administrator: {name} ({email}). If this is not the person you invited, remove them. | Admin nuevo: {name} ({email}). Si no es la persona que invitaste, quítala. | 새 관리자: {name} ({email}). 초대한 분이 아니면 관리자에서 빼 주세요. |
| `console.admins.newAdminDismiss.cta` | Got it | Entendido | 확인 |
| `console.admins.about(max)` | A school can have {max} administrators besides its owner. | Una escuela puede tener {max} admins además de quien la creó. | 학교에는 만든 분 말고도 관리자를 {max}명까지 둘 수 있어요. |
| `console.admins.full(max)` | All {max} places are taken. Remove an administrator or revoke an invite to add someone else. | Los {max} lugares están ocupados. Quita a un admin o anula una invitación para sumar a otra persona. | 관리자 자리 {max}개가 모두 찼어요. 다른 분을 추가하려면 관리자 한 명을 빼거나 초대를 취소해 주세요. |
| `console.admins.invite.cta` | Invite an administrator | Invitar a un admin | 관리자 초대하기 |
| `console.admins.invite.warning` | Anyone with this link can become an administrator after signing in. Send it only to the person you mean. | Cualquiera con este enlace puede ser admin después de iniciar sesión. Envíalo solo a la persona indicada. | 이 링크가 있으면 누구나 로그인한 뒤 관리자가 될 수 있어요. 초대할 분에게만 보내 주세요. |
| `console.admins.invite.once(date)` | It works once and ends on {date}. It is shown only now: copy it before you close this. | Funciona una vez y vence el {date}. Solo se muestra ahora: cópialo antes de cerrar. | 한 번만 쓸 수 있어요. 끝나는 날: {date}. 지금만 보이니 닫기 전에 복사해 주세요. |
| `console.admins.invite.copy.cta` | Copy link | Copiar enlace | 링크 복사 |
| `console.admins.invite.copied` | Link copied. | Enlace copiado. | 링크를 복사했어요. |
| `console.admins.invite.copyFailed` | Couldn't copy. Select the link and copy it. | No se pudo copiar. Selecciona el enlace y cópialo. | 복사하지 못했어요. 링크를 선택해서 복사해 주세요. |
| `console.admins.invite.failed` | Couldn't make the invite. Try again. | No se pudo crear la invitación. Inténtalo de nuevo. | 초대를 만들지 못했어요. 다시 해 볼까요? |
| `console.admins.openInvite(day, date)` | Invite made {day} · ends {date} | Invitación creada {day} · vence el {date} | 초대 만든 날: {day} · 끝나는 날: {date} |
| `console.admins.revoke.cta` | Revoke | Anular | 초대 취소 |
| `console.admins.revokeAsk` | Revoke this invite? The link stops working. | ¿Anular esta invitación? El enlace dejará de funcionar. | 이 초대를 취소할까요? 링크를 더는 쓸 수 없어요. |
| `console.admins.revokeKeep.cta` (the sheet's dismiss button) | Keep it | Mantenerla | 그대로 두기 |
| `console.admins.remove.cta` | Remove | Quitar | 빼기 |
| `console.admins.remove.a11y(name)` (SA-0b review; the accessible name of each row's Remove and the new-admin notice's Remove) | Remove {name} | Quitar a {name} | 관리자에서 빼기: {name} |
| `console.admins.removeAsk(name, school)` | Remove {name} as an administrator of {school}? | ¿Quitar a {name} como admin de {school}? | 관리자에서 뺄까요? {name} · {school} |
| `console.admins.removeNote.staysTeacher` | They stay a teacher of the school, with their classes. You can invite them again. | Sigue como docente de la escuela, con sus clases. Puedes volver a invitar a esa persona. | 학교 선생님으로는 그대로 남고, 반도 그대로예요. 다시 초대할 수 있어요. |
| `console.admins.removeNote.leaves` | They leave the school. You can invite them again. | Sale de la escuela. Puedes volver a invitar a esa persona. | 학교에서 나가게 돼요. 다시 초대할 수 있어요. |
| `console.admins.leave.cta` | Stop being an administrator | Dejar de ser admin | 관리자 그만두기 |
| `console.admins.leaveAsk(school)` | Stop being an administrator of {school}? | ¿Dejar de ser admin de {school}? | 관리자를 그만둘까요? {school} |
| `console.admins.leaveNote.staysTeacher` | You stay a teacher of the school, with your classes. | Sigues como docente de la escuela, con tus clases. | 학교 선생님으로는 그대로 남고, 내 반도 그대로예요. |
| `console.admins.leaveNote.leaves` | You leave the school. | Sales de la escuela. | 학교에서 나가게 돼요. |
| `console.admins.history.title` | History | Historial | 기록 |
| `console.admins.history.inviteCreated(name, day)` | {name} made an invite · {day} | {name} creó una invitación · {day} | 초대 만듦: {name} · {day} |
| `console.admins.history.inviteRevoked(name, day)` | {name} revoked an invite · {day} | {name} anuló una invitación · {day} | 초대 취소: {name} · {day} |
| `console.admins.history.joined(name, day)` | {name} joined as an administrator · {day} | {name} se unió como admin · {day} | 관리자로 참여: {name} · {day} |
| `console.admins.history.removed(name, day)` | {name} was removed as an administrator · {day} | Se quitó a {name} como admin · {day} | 관리자에서 빠짐: {name} · {day} |
| `console.admins.history.left(name, day)` | {name} stopped being an administrator · {day} | {name} dejó de ser admin · {day} | 관리자 그만둠: {name} · {day} |
| `console.admins.history.renamed(name, day)` | {name} renamed the school · {day} | {name} cambió el nombre de la escuela · {day} | 학교 이름 바꿈: {name} · {day} |
| `console.admins.history.renamedClass(name, day)` | {name} renamed a class · {day} | {name} cambió el nombre de una clase · {day} | 반 이름 바꿈: {name} · {day} |
| `console.admins.history.someone` (the `name` of a line whose account no longer exists) | A former member | Alguien que ya salió | 이전 구성원 |
| `console.adminInvite.pageTitle` | Administrator invite | Invitación de admin | 관리자 초대 |
| `console.adminInvite.signIn` | Sign in to see this invite. | Inicia sesión para ver esta invitación. | 이 초대를 보려면 로그인해 주세요. |
| `console.adminInvite.title(school)` | Join {school} as an administrator? | ¿Unirte a {school} como admin? | 관리자로 참여할까요? {school} |
| `console.adminInvite.invitedBy(name)` | Invited by {name} | Te invitó {name} | 초대한 분: {name} |
| `console.adminInvite.invitedByOwner` | Invited by the school's owner | Te invitó quien creó la escuela | 학교를 만든 분이 초대했어요 |
| `console.adminInvite.signedInAs(who)` | Signed in as {who} | Cuenta actual: {who} | 로그인한 계정: {who} |
| `console.adminInvite.switchAccount.cta` | Use another account | Usar otra cuenta | 다른 계정 쓰기 |
| `console.adminInvite.reopen` | Open your invite link again to see it. | Vuelve a abrir el enlace de invitación para verla. | 초대를 보려면 초대 링크를 다시 열어 주세요. |
| `console.adminInvite.can` | As an administrator you can rename the school and its classes, make classes, invite, assign and remove teachers, open class rosters and reports, move students between the school's classes, remove students from a class, and approve a student's request to link a new device. | Como admin puedes cambiar el nombre de la escuela y de sus clases, crear clases, invitar, asignar y quitar docentes, abrir listas e informes de clase, mover estudiantes entre las clases de la escuela, quitar estudiantes de una clase y aprobar la solicitud de un estudiante para vincular un dispositivo nuevo. | 관리자는 학교와 반 이름을 바꾸고, 반을 만들고, 선생님을 초대·배정하거나 빼고, 반 명단과 리포트를 열고, 학교 안의 반끼리 학생을 옮기고, 반에서 학생을 빼고, 학생이 새 기기를 연결하려는 요청을 승인할 수 있어요. |
| `console.adminInvite.cannot` | Billing and the list of administrators stay with the school's owner. | La facturación y la lista de admins quedan a cargo de quien creó la escuela. | 결제와 관리자 목록은 학교를 만든 분이 맡아요. |
| `console.adminInvite.leave` | The owner sees that you joined and the email you sign in with. You can leave at any time, and the owner can remove you. | Quien creó la escuela verá que te uniste y el correo con el que inicias sesión. Puedes salir cuando quieras, y esa persona puede quitarte. | 학교를 만든 분이 참여 기록과 로그인 이메일을 볼 수 있어요. 언제든 나갈 수 있고, 학교를 만든 분이 나를 관리자에서 뺄 수도 있어요. |
| `console.adminInvite.accept.cta` | Accept | Aceptar | 수락 |
| `console.adminInvite.notNow.cta` | Not now | Ahora no | 나중에 |
| `console.adminInvite.done(school)` | You're an administrator of {school}. | Ahora eres admin de {school}. | 이제 관리자예요: {school} |
| `console.adminInvite.used` | This invite was already used. Ask for a new one. | Esta invitación ya se usó. Pide una nueva. | 이미 사용된 초대예요. 새 초대를 요청해 주세요. |
| `console.adminInvite.expired` | This invite has ended. Ask for a new one. | Esta invitación venció. Pide una nueva. | 기간이 끝난 초대예요. 새 초대를 요청해 주세요. |
| `console.adminInvite.revoked` | This invite was cancelled. Ask for a new one if you need it. | Esta invitación se anuló. Pide una nueva si la necesitas. | 취소된 초대예요. 필요하면 새 초대를 요청해 주세요. |
| `console.adminInvite.full(max)` | This school already has {max} administrators. | Esta escuela ya tiene {max} admins. | 이 학교에는 이미 관리자가 {max}명 있어요. |
| `console.adminInvite.owner` | You already run this school as its owner. | Ya diriges esta escuela porque la creaste. | 이 학교를 만든 분이라서 이미 관리하고 있어요. |
| `console.adminInvite.alreadyAdmin(school)` | You're already an administrator of {school}. | Ya eres admin de {school}. | 이미 관리자예요: {school} |
| `console.adminInvite.notFound` | This link doesn't open an invite. Check that it was copied whole. | Este enlace no abre ninguna invitación. Revisa que se haya copiado completo. | 이 링크로는 초대를 열 수 없어요. 링크가 모두 복사됐는지 확인해 주세요. |
| `console.adminInvite.emailUnverified` | To accept, your account needs a verified email. Verify it in your account settings, then open the link again. | Para aceptar, tu cuenta necesita un correo verificado. Verifícalo en los ajustes de tu cuenta y vuelve a abrir el enlace. | 수락하려면 계정 이메일 인증이 필요해요. 계정 설정에서 이메일을 인증한 뒤 링크를 다시 열어 주세요. |
| `console.adminInvite.home.cta` | Go to my home | Ir a mi inicio | 내 홈으로 |
| `console.admins.invite.stepUp.body` (SA-0b) | Before you make an invite link, sign in again. | Antes de crear un enlace de invitación, vuelve a iniciar sesión. | 초대 링크를 만들기 전에 다시 로그인해 주세요. |
| `console.admins.invite.stepUp.reason` (SA-0b) | This keeps the school's rosters safe on a shared device. | Así las listas de la escuela quedan protegidas en un dispositivo compartido. | 공유 기기에서도 학교 명단을 안전하게 지키기 위해서예요. |
| `console.admins.revoked` (SA-0b) | Invite revoked. The link no longer works. | Invitación anulada. El enlace ya no funciona. | 초대를 취소했어요. 이제 링크를 쓸 수 없어요. |
| `console.admins.removed(name)` (SA-0b) | {name} is no longer an administrator. | {name} ya no es admin. | 관리자에서 뺐어요: {name} |
| `console.admins.left(school)` (SA-0b) | You're no longer an administrator of {school}. | Ya no eres admin de {school}. | 관리자를 그만뒀어요: {school} |
| `console.admins.actionFailed` (SA-0b) | Couldn't save that change. Try again. | No se pudo guardar el cambio. Inténtalo de nuevo. | 변경하지 못했어요. 다시 해 볼까요? |
| `console.settings.ownerOnly` (SA-0b) | Only the school's owner can change these settings. | Solo quien creó la escuela puede cambiar estos ajustes. | 이 설정은 학교를 만든 분만 바꿀 수 있어요. |
| `console.settings.privacy.anonymizeOn` (SA-0b) | Rosters show initials. | Las listas muestran iniciales. | 명단에 이니셜만 보여요. |
| `console.settings.privacy.anonymizeOff` (SA-0b) | Rosters show names. | Las listas muestran nombres. | 명단에 이름이 보여요. |

`admins.full(max)`, `adminInvite.full(max)`, `admins.about(max)` and `admins.count(n, max)` take the cap as an argument (callers pass `SCHOOL_ADMIN_CAP`); no string types the number (section 3.1). Every `cta` and short es value above is within the `length-budget.test.ts` rule (`max(8, ceil(en × 1.5))`).

### 9.5 Site (SA-6, `landing` namespace)

| Key | en | es | ko |
|---|---|---|---|
| `landing.plans.sizes(family, group)` | The Family Plan is for up to {family} learners. The Group License is for up to {group} students in a class or a school. | El Plan Familiar es para hasta {family} estudiantes. La Licencia de Grupo es para hasta {group} estudiantes en una clase o una escuela. | 가족 플랜은 학습자 최대 {family}명이 함께 써요. 그룹 라이선스는 반이나 학교 하나에서 학생 최대 {group}명이 함께 써요. |

The Terms paragraph (section 4) and the privacy paragraph (section 6.7) are English-authoritative legal text (F-I18N-001 L10): es and ko show the English, as `isEnglishAuthoritative` already allows.

---

## 10. PR table (Worker first)

| Row | Type and contents | Depends on | Tests |
|---|---|---|---|
| SA-0 | `docs(specs,design,launch)`: this amendment; [SA] notes in F-ENT-001, F-SCHOOL-001, F-SPACE-001, F-BILL-002 and the specs README; the old 5 and 300 edited in place, marked [SA], in the bodies of F-ENT-001 (section 3.1 Products line, the native paywall bullets), F-SCHOOL-001 (section 3.1 limits line, the seats block), F-BILL-002 (the school card row, AS2), `docs/launch/faq.md`, `docs/launch/maker-comment.md`, the billing wireframes (`billing/billing-home.md`, `billing/checkout-return.md`, `console/billing.md`, `console/home.md`, `console/school-admin.md`), `design/screens/billing/billing-home.md` and the billing mocks (`billing-home*.html`, `checkout-return.html`, `step-up.html`): 4 learners, 50 students, "Up to 50 students in the class" | — | docs only; check: `git grep -nE "5 learners\|300 students\|/ 300\|20-student cap\|학습자 5명\|학생 300\|300 상한\|학생 ≤ 300\|학습자 ≤ 5\|cap 5 \|of 20 students · " -- docs design ":!docs/specs/AMENDMENTS-SEATS-ADMINS.md"` finds only the [SA]-marked history rows (AMENDMENTS-BILLING-FAMILY-YEARLY, the `docs/launch/web-app-launch.md` 2026-10-06 row and the [SA] notes that name the old values), and no payer card of a licensed stand-alone class reads a count without its cap (`23 of 50 students`) |
| SA-0b | `design(console,billing)`: agent design pass approved by multi-agent review (CLAUDE.md section 5, the F-SPACE-002 T-0b precedent): new wireframes `console/rename-inline.md` (the Rename button, the open field with hints including `openMoves`, saved and failed states, on the family home, class page, school page title, school class rows and Settings Name row), `console/admins-panel.md` (owner view, admin view, full, the one-time invite box with step-up, open invites, revoke, remove and stop-being-admin sheets, history), `console/admin-invite-accept.md` (signed out, sign-up, locked, no stash, preview, every refusal, done); updated `console/school-admin.md` (admins panel slot, Rename on the title and class rows, the unlicensed at-cap and over-cap lines) and `billing/billing-home.md` (the admin's read-only school card); mocks `design/screens/console/rename-inline.md` + `mock/rename-inline.html`, `admins-panel.md` + `mock/admins-panel.html`, `admin-invite-accept.md` + `mock/admin-invite-accept.html`, and a read-only school card board in `design/screens/billing/mock/billing-home-states.html`; English copy from section 9 only, tokens only, no emoji | SA-0 | design review checklist (tokens, touch targets, focus order, contrast) |
| SA-1 | `feat(backend,content-schema,api,web,i18n)`: section 3.1 constants; section 3.2 caps (`classCap` with the own-licence-in-a-school rows, `schoolLimitsFrom`, `schoolIsFull`, `learnerCapOf`); section 3.3 atomic `addLearnerWithinCaps` (D1 + memory) used by `/join`, the school cap in the `executeTransfer` and class-move gates, `destCap` per section 3.2; section 3.4 Worker codes with `details.cap`; lookup keeps `full` class-only and adds the learner-aware `seat` (optional device-authorized `learnerId`); section 3.6 roster `seats`, `canRename`, `openMoves`, school limits, billing summary usage (school counts for owner and admins; own-plan class in a school 50 or null); sections 5.1-5.2 `space.rename`, `SpaceNameSchema` (NFC, collapse, format characters, the create code kept), `PATCH /:id/name`, `Db.renameSpace`, `putSpace` no longer writes `name` on update (D1 + memory); section 5.4 the transfer consent reset test; section 6.5 owner-only actions and the route switches (billing, settings, archive, `adultSpacesOf` payer); the `space_events` migration (no CHECK on `kind`, `subject_space_id`), `SpaceEventKindSchema`, school and class-of-school rename rows, the purge; telemetry `space.seat_refused`, `space.renamed` (registry append); lookup `full` always false (relink never blocked) and the learner `/join` school cap answered as `cap_class` with `details.reason`; `GET /:id/school` `license` allow-listed; `renameSpace` returns `changes` (0 → re-read, no event); `SpaceNameSchema` with explicit BMP ranges (no `\p{...}`); and the one console string that types a limit, `console.contactLineCaps` replacing `contactLine` (en, es, ko, its caller, `FORMAL_ALLOWED` and the BY-D9 scan list) so the billing page never shows 300 next to 50 | SA-0 | section 11 |
| SA-2 | `feat(backend,content-schema,api)`: sections 6.1-6.4 admins: `admin_invites` migration, token and hash, `adminInviteUrl` / `parseAdminInvite`, every route of section 6.4 (guarded create and revoke, `403 reverify_required`, preview `invitedBy` without email), `acceptAdminInvite` batch (space-pinned gate, bound cap, teacher-only promotion), ending an admin role (back to teacher or out), `staysTeacher`, the member removal rules (school and class-of-school), `canRemove` on `GET /:id/members`, invite purge, telemetry `space.admin.*`; `memberships.promoted_from` (a promoted teacher goes back to teacher); `Db.addMembershipIfAbsent` on the account `/join` path and `POST /:id/members`; the members route on a school runs the end-admin-role logic; `IdentityPort` (verified email at accept, `403 email_unverified`, owner-only `email` on `GET /:id/admins`); `history.someone` fallback | SA-1 | section 11 |
| SA-3 | `feat(web,i18n)`: section 5.3 inline rename (family home, class page, school page and class rows, Settings Name row) with the `openMoves` hint, `nameLater`; section 3.4 console seat lines and counts (`capState` from `seats`, family count, school lines incl. `seats.school.at`), section 4 billing copy (`classLearners`, `schoolNoLicenceCaps`, `readOnly.schoolAdmin`, admin read-only school card); strings 9.2 (less `contactLineCaps`, done in SA-1) and 9.3 | SA-0b, SA-1 | section 11 |
| SA-4 | `feat(web,i18n)`: section 6.6 admins panel, invite box with step-up, revoke, remove, stop being an admin, history; school Settings per control for an admin (`canRemove`); `assignableTeachers` keeps admins; accept page `/account/invite` with the capture before the gate, `next` through sign-in, the sign-up and `/start` redirect, `reopen`, `signedInAs` with Use another account, `emailUnverified`; the owner's new-admin notice and the admin emails on the panel; section 6.7 privacy paragraph; strings 9.4 | SA-0b, SA-2, SA-3 | section 11 |
| SA-5 | `feat(mobile,i18n)`: section 3.4 learner join refusals (`cap_family`, `cap_school` mapped, `familyFull`, `schoolFull`, lookup with `learnerId` and the `seat` field, line chosen from `seat.reason`, the roster pick and relink kept on screen at a full class, `cap_class` read by `details.reason`); section 5.4 name propagation tests and fixes; strings 9.1. Text in the existing join message slot only (no new component, so no design row) | SA-1 | section 11 |
| SA-6 | `feat(web,i18n)`: section 4 site sizes line on the persona Plans blocks, Terms sizes paragraph; strings 9.5. One line in the existing Plans block (no new component) | SA-1 | section 11 |

- **Order.** SA-1 merges and deploys first (it is the Worker, and the constants every client reads). SA-2 follows. SA-0b can run at once (docs only). SA-3 after SA-0b and SA-1; SA-5 and SA-6 in parallel after SA-1; SA-4 after SA-0b, SA-2 and SA-3 (shared console files).
- **A client older than its Worker.** After SA-1, an old console still renders (it ignores `seats`, `canRename`, `openMoves`); an old learner app reads `full`, which is now always false, so it always reaches the roster pick (relink, which takes no seat) and the name step, at a full licensed class and at a school at 50 too. A new learner at a full class or school gets `409 cap_class` from `/join` (a school cap included, `details.reason: 'cap_school'`), which an old app shows as "This class is full. Ask your teacher."; a learner already in a sibling class of a school at 50 joins (they take no new seat). A full family reaches `/join`, whose `409 cap_family` an old app shows as the three-classes message (today's behaviour for every family `409`) until SA-5 ships. After SA-2, nothing calls the admin routes until SA-4.
- **Terms before Live.** The Terms sizes paragraph (SA-6) must merge before Stripe Live is ever enabled; while Stripe is sandbox-only, enforcement (SA-1) may precede it.
- **Ledger.** SA-1 (the `console` namespace, for `contactLineCaps`), SA-3, SA-4, SA-5 and SA-6 change `en` namespace files: each recomputes that namespace's `enSha` and signs `reviewedBy: MAR` with the day's date only in its fix stage, after an independent reviewer passed the es and ko values.

## 11. Tests per row

| Row | File | Covers |
|---|---|---|
| SA-1 | `content-schema/__tests__/entitlement.test.ts`, `space.test.ts` | constants (4, 50, 50, 50, 10, 2); `SpaceNameSchema`: collapse, trim, 1 and 40 accepted, 0 and 41 refused, control characters refused, punctuation-only refused, Hangul and accented names accepted; `PLAN_PRICING` unchanged |
| SA-1 | `backend/lib/__tests__/entitlement.test.ts` | `classCap` per row of section 3.2; `schoolLimitsFrom` licence 50 / contract seats / none 50 unlicensed; `schoolIsFull` for an unlicensed school; a licensed class covers every member above the cap (grandfathered) |
| SA-1 | `backend/__tests__/spaces.test.ts` | family join refused at 4 (`cap_family`, `details.cap` 4), a 5th member kept and its re-join idempotent; licensed stand-alone class refused at 50; unlicensed school refused at 50 distinct with each class at 20; a learner already in a sibling class takes no seat; grandfathered spaces keep members and refuse new ones; rename: each role of section 5.1 (allowed and 403), archived 422, invalid 422 reasons, unchanged 200 `changed: false`, rate limit, a settings PATCH and a rename together keep both changes; owner-only actions: an admin gets 403 on checkout, portal, receipts, settings, archive |
| SA-1 | `backend/db/__tests__/d1-seats.test.ts` (new, SQLite-backed like `d1-entitlement-cas.test.ts`) | the single statement under two concurrent joins for the last seat: exactly one `added`; school distinct counting; the `ON CONFLICT` path returns `already`; the transfer and move gates refuse at the school cap |
| SA-1 | `backend/__tests__/billing.test.ts`, `school.test.ts` | usage caps per section 3.6; school seat counts for admins, who are not payers; school view limits |
| SA-1 | `backend/__tests__/class-moves.test.ts`, `transfers.test.ts` | a move into a full school refused `cap_school`; a move inside one school at the cap allowed |
| SA-1 | `backend/lib/__tests__/can.test.ts` | `space.rename`, `billing.manage`, `admin.manage`, `space.settings`, `space.archive` matrix |
| SA-1 | `backend/lib/__tests__/server-events.test.ts` | new events keep codes only |
| SA-1 | `content-schema/__tests__/space.test.ts` (more) | `SpaceNameSchema` order: NFC first (a decomposed Hangul name equals its composed form and counts the same length), tabs and new lines collapsed then accepted, an RLO (U+202E), an isolate (U+2066) and a zero-width space refused, ZWJ and ZWNJ accepted; `SpaceCreateSchema` failure keeps `422 bad_request`; `SpaceEventKindSchema` refuses an unknown kind |
| SA-1 | `backend/db/__tests__/d1-spaces-name.test.ts` (new, SQLite-backed) | read the space, `renameSpace`, `putSpace` with the stale copy: the stored name is the new one; the same through settings PATCH, archive, unarchive and code regeneration in the memory store |
| SA-1 | `backend/__tests__/spaces.test.ts` (relink at a cap) | lookup `full` is false at a full licensed class (50) and at a class of a school at 50; a relink request (`relink.ts`) from a new device at each succeeds and the approval takes no seat, on the old-shape and the new-shape lookup; a new learner's `/join` there answers `409 cap_class`, with `details.reason: 'cap_school'` for the school case |
| SA-1 | `backend/__tests__/school.test.ts` (licence view) | `GET /:id/school` `license` has exactly `planKey`, `status`, `seats`, `expiresAt`, `active`, `subjectName`: no `providerRef`, `customerRef` or `promoCode`, for the owner and for an admin |
| SA-1 | `backend/db/__tests__/d1-spaces-name.test.ts` (archive race) | an archive between the read and `renameSpace`: `changes` 0, `422 archived`, no `space_events` row and no `space.renamed`; a missing space gives `404` |
| SA-1 | `content-schema/__tests__/space.test.ts` (Hermes-safe) | `SPACE_NAME_FORBIDDEN` and `SPACE_NAME_LETTER` hold no `\p{` and no `u` flag; the space module loads under the mobile jest config |
| SA-1 | `backend/__tests__/spaces.test.ts` (lookup) | `full` stays false for a full family (old clients); `seat.full` true for a new learner at a full family, false with a device-authorized `learnerId` already a member; false for a learner already in a live sibling class of a school at 50; an unauthorized `learnerId` answers as a new learner; `seat.reason` per cap |
| SA-1 | `backend/lib/__tests__/entitlement.test.ts` (own-licence rows) | a class with its own licence in an unlicensed school: `classCap` 50 and the school 50; in a licensed or contracted school: no class cap, the school cap binds; billing summary `learnerCap` 50 or null accordingly; `adultSpacesOf` payer is `billing.manage` (an admin gets no browse coverage from an archived school) |
| SA-1 | `backend/__tests__/transfers.test.ts` (rename) | consent given, the destination renamed, settle reports `terms_changed` and the request returns to the guardian; a consent create with the old `termsDigest` answers `409 terms_changed`; a rename with no open transfer writes nothing to `transfer_requests`; `openMoves` true only while an open transfer names the space |
| SA-1 | `backend/__tests__/spaces.test.ts` (events) | a school rename writes `renamed` on the school, a class-of-school rename writes `class_renamed` on the school with `subject_space_id`, a family or stand-alone class rename writes no `space_events` row |
| SA-2 | `backend/__tests__/admins.test.ts` (new) | create (owner only, step-up, `admins_full` with open invites counted, not a school, archived), remove and revoke succeed on an archived school while accept there is still refused by the gate's `archived_at` check, token returned once and only its hash stored, revoke, preview states, accept (sign-in, used, expired, revoked, owner, already admin, full), a teacher member becomes admin, remove (owner only; an admin cannot remove an admin through the members route), leave, history (owner only, last 20, names at read time), purge |
| SA-2 | `backend/db/__tests__/d1-admin-invites.test.ts` (new) | two accepts of two invites for the last place at once: one admin added; the batch writes nothing when the gate fails; two concurrent creates for the last place: one `201`, one `409 admins_full`; a revoke after an accept leaves `revoked_at` null and answers `409 invite_used`; an invite of another school is refused by the space-pinned gate; an accept by an account whose school row is `owner` changes nothing |
| SA-2 | `backend/__tests__/admins.test.ts` (more) | preview never contains an `@` (owner with no display name → `invitedBy: null`); create's step-up refusal is `403 reverify_required` with Clerk's body; removing or leaving an admin who teaches a class of the school leaves them `teacher` (`stays: 'teacher'`), one with no class leaves (`stays: 'none'`); through a class of the school, an admin removing another admin or the owner gets `403 owner_only`; `canRemove` per member for an admin caller (teachers only); `joinedAt` from the `admin_joined` event for a promoted teacher |
| SA-2 | `backend/db/__tests__/d1-admin-invites.test.ts` (more) | an accept and a teacher-code `/join` of the same account interleaved: the role stays `admin` (`addMembershipIfAbsent`); `POST /:id/members` never rewrites an existing role; a teacher with no class promoted, then removed or leaving, goes back to `teacher` (`promoted_from`), with `stays: 'teacher'` |
| SA-2 | `backend/__tests__/admins.test.ts` (identity) | accept with an unverified or missing primary email → `403 email_unverified`, the invite stays open; no `CLERK_SECRET_KEY` → `503 identity_not_configured`; `GET /:id/admins` carries `email` for the owner only (an admin caller gets none); preview and telemetry never carry an `@`; the owner's members-route removal of an admin answers `stays` like the admins route; a history line whose account row is missing shows `history.someone`, never an id |
| SA-2 | `content-schema/__tests__/app-shell.test.ts` | `adminInviteUrl` puts the token in the fragment only; `parseAdminInvite` accepts only a 43-character base64url token |
| SA-3 | `web/lib/console/__tests__/rename.test.ts` (new), `billing-summary.test.ts`, `school.test.ts`, `rollup.test.ts` | client validation, optimistic save and rollback, per-kind hint, `capState` from `seats`, seat lines at, over and below caps, includes lines and contact line with the new numbers, admin school card read-only |
| SA-3 | `web/app/__tests__/rename-inline.test.tsx` (new) | Rename button only when `canRename`; Enter saves, Escape cancels, focus returns; live region; frame title, Back label and tab title update; IME: `compositionstart`, Enter, then `compositionend` with a full Hangul name saves nothing during composition and the full name on the next Enter (Escape likewise cancels nothing mid-composition); Rename `aria-disabled` until the PATCH settles; a failure reverts to the last confirmed name; a 60-unit NFD Hangul paste is not cut by the input and saves as its NFC form |
| SA-3 | `i18n/__tests__/console-messages.test.ts`, `billing-messages.test.ts`, `family-yearly-copy.test.ts`, `ko-translation.test.ts` | new keys in en, es, ko; no limit number typed in a string; no banned words |
| SA-1 | `i18n/__tests__/billing-messages.test.ts`, `family-yearly-copy.test.ts` | `contactLineCaps` in en, es, ko with no typed number; it replaces `contactLine` in the BY-D9 scan list and in `FORMAL_ALLOWED` |
| SA-4 | `web/app/__tests__/admins-panel.test.tsx`, `admin-invite-page.test.tsx` (new) | owner and admin views; invite box shown once; step-up; revoke and remove confirms; leave (`stays: 'teacher'` → teacher home, `'none'` → the router's home, the notice from the flash, no name in the URL); archived school: Remove and Revoke shown, Invite hidden; a `404`/`403`/`409` reloads the panel instead of `actionFailed`; Go to my home removes the stash after a `429` and a network failure; sign out from the frame, then sign in in the same tab → `reopen` (no preview); the accept page reads and clears the fragment, keeps the token across sign-in in `sessionStorage` only, every refusal line; no token in any rendered link, title or telemetry |
| SA-4 | `web/app/__tests__/privacy-statements.test.tsx` | the administrators paragraph (the powers, the verified email, the owner seeing it) |
| SA-4 | `web/app/__tests__/admins-panel.test.tsx` (more), `admin-invite-page.test.tsx` (more) | the owner's new-admin notice for 7 days with Remove and Got it (remembered per event id), never for an admin caller; emails on the panel for the owner only; the revoke sheet's buttons are Revoke and Keep it; `signedInAs` shows the Clerk primary email, Use another account signs out and keeps the stash; `emailUnverified` line |
| SA-4 | `web/lib/console/__tests__/admin-invite.test.ts`, `signin-flow.test.ts`, `school.test.ts`, `web/app/__tests__/school-settings-admin.test.tsx` (new) | `captureAdminInvite` stashes and strips the fragment before the gate's redirect and the lock; `signedOutTarget` gives `next=/account/invite` with no token; sign-up fallback and `/start` go to the invite while a stash lives; `reopen` without a stash; `assignableTeachers` keeps admins; Settings per control for an admin (Rename shown, Remove for teachers only, settings read-only, danger zone hidden) |
| SA-5 | `mobile/platform/__tests__/sync-api.test.ts`, `mobile/logic/spaces/__tests__/join-code.test.ts` | `cap_family` and `cap_school` mapped to their own codes and lines; the cap from `details.cap` and the fallback; an old-shape lookup response (no `seat`) still works from `full`; a full family shows `familyFull`, never `classFull`; a returning family member and a sibling-class learner at a full school pass lookup (with `learnerId`) and reach `/join` |
| SA-5 | `mobile/screens/sync/__tests__/JoinSpaceScreen.test.tsx` | at a full class with a roster, `seat.full` true: the roster pick and relink stay on screen with the at-cap line above "I'm new"; `cap_class` with `details.reason: 'cap_school'` shows `schoolFull` |
| SA-5 | `mobile/store/__tests__/membership-store.test.ts`, `tier-store.test.ts` | a renamed space's new name replaces the cached one after one inbox refresh, on Settings and the Plan screen |
| SA-6 | `web/app/__tests__/landing-claims.test.tsx`, `persona-pages.test.tsx`, `legal-copy.test.tsx`, `site-word-budget.test.tsx` | the sizes line only while plans are on sale, no price or term, the Terms paragraph, word budget |

## 12. Owner steps (Stripe sandbox only; nothing in Live)

1. **No price, key, variable or webhook changes.** The Family Plan stays $15.30 / year and the Group License $153 / year. Do not touch Stripe Live.
2. **Optional, sandbox (Test mode) only: product descriptions.** If the sandbox products carry a description that mentions a number of learners: Stripe dashboard → turn on **Test mode** → **Product catalog** → **Family Plan** → **Edit product** → Description: `Every lesson for one family, up to 4 learners. Renews every year.` → **Save**. Then **Group License** → **Edit product** → Description: `Every lesson for one class or one school, up to 50 students. Renews every year.` → **Save**. Leave the prices as they are. If the products have no description, skip this step.
3. **After SA-1 deploys (a merge to main deploys the Worker and the console):** open `app.hangulroute.com/account/billing` in test mode and check that the Family Plan reads "Up to 4 learners in one family" and the Group License "A school holds up to 10 teachers and 50 students" (a school); after SA-3, a class reads "Up to 50 students in the class".
4. **Optional, read-only check of spaces over the new caps** (Cloudflare → D1 → the production database → Console; read-only queries):
   - Families with more than 4 learners: `SELECT s.id, COUNT(*) AS learners FROM spaces s JOIN memberships m ON m.space_id = s.id AND m.member_kind = 'learner' WHERE s.kind = 'family' GROUP BY s.id HAVING learners > 4;`
   - Schools with more than 50 students: `SELECT s.parent_space_id AS school, COUNT(DISTINCT m.member_id) AS students FROM spaces s JOIN memberships m ON m.space_id = s.id AND m.member_kind = 'learner' WHERE s.kind = 'class' AND s.archived_at IS NULL AND s.parent_space_id IS NOT NULL GROUP BY s.parent_space_id HAVING students > 50;`
   These spaces are grandfathered (SA-D7); nothing needs to be done.

## 13. Defaults the owner may change

| # | Default taken | Alternative |
|---|---|---|
| OQ-1 | Every family, free or paid, holds up to 4 learners (was 5). **Beyond the request** (free families lose one place; existing ones are grandfathered). | Free families keep 5 and only the Family Plan is 4 (paying would then lower the room). |
| OQ-2 | Every school, licensed or not, holds up to 50 distinct students; an unlicensed school's classes keep 20 each. **Beyond the request**: a new cap on free schools (60 possible today with three classes), and a licence then adds premium but no student room. Existing schools are grandfathered. | No school-wide cap without a licence (a free school could grow past 50 and then buy a licence for all of them). |
| OQ-3 | A licensed school keeps the 10-teacher cap; admins count only when they own or teach a class. | Another teacher number, or admins always counted. |
| OQ-4 | Over-cap spaces are grandfathered: everyone stays and stays covered; no new learner until below the cap. | Cover only the first 50 (or 4) by join date. |
| OQ-5 | Admins see the licence and seat counts but cannot buy, manage, cancel or open receipts (F-BILL-002 OD-8 changed for admins). | Admins as payers, as F-BILL-002 had it. |
| OQ-6 | Admins cannot change school settings (anonymized roster, consent mode), archive the school or manage admins. | Let admins change settings. |
| OQ-7 | Invite links are single use, end after 7 days, and need a fresh sign-in to create. | A longer life, or no step-up. |
| OQ-8 | Ending an admin role leaves the account a teacher of the school when it owns or teaches a class there, else it leaves the school; ownership cannot be transferred. | Always leave the school; an ownership transfer flow. |
| OQ-9 | Family: only the owner renames. Class: owner and teachers of the class, and the school's owner and admins. School: owner and admins. | Caregivers rename the family too. |
| OQ-10 | School administration and school rename events are kept 400 days; family and stand-alone class renames keep no history. | Another period; a history for every space. |
| OQ-11 | The 4 and the 50 count **learners only** (the owner said "4명" and "50명"); grown-ups (owner, caregivers, teachers, admins) are not capped, and caregivers keep premium browse through the family (`adultCoveredAny`). | Count grown-ups too, or cap caregivers. |
| OQ-13 | An accepted admin invite takes effect at once; the owner sees the admin's verified email, a 7-day notice with Remove, and the history. | The accept waits until the owner approves it on the admins panel. |
| OQ-12 | A rename of a space with an open class transfer asks the guardian again (the name is part of the consent terms, F-SPACE-002 section 4.11); the console warns first. | Drop the names from the terms so a rename never resets a consent. |

## 14. Out of scope

- Any price, Stripe Live, Stripe quantities or per-seat billing; a bigger family plan.
- Enforcing the teacher cap atomically (it stays advisory, as today).
- Ownership transfer, more than one school per organization, admins for families or classes, co-owners.
- Email delivery of invites (the owner sends the link themselves); invite by email address.
- Renaming learners (F-LEARN-001 and the profile edit already cover it).
- A teacher leaving a school by themself (no account-level leave route exists; `POST /:id/leave` is learner-only, `spaces.ts:342`). A teacher is removed by the owner or an admin.
- Account deletion (none exists); a later spec handles the account ids kept in `space_events` and `admin_invites` (section 6.2).

## 15. Review log

- 2026-10-20, second round, two independent reviews of PR #746, adjudicated in the same PR: lookup `full` always false so a reinstall or new device always reaches relink at a full licensed class or a school at 50, and the learner `/join` answers a school cap as `cap_class` with `details.reason` (section 3.4, section 10); SA-5 keeps the roster pick on screen at a cap; accept needs a verified email read from Clerk (`IdentityPort`), the owner sees each admin's verified email, a 7-day new-admin notice, and the consent block and privacy paragraph name every power (section 6.3, OQ-13); `GET /:id/school` `license` allow-listed (no Stripe ids, no promo code); `addMembershipIfAbsent` so a teacher-code join cannot demote a new admin; the members route on a school ends an admin role like the admins route; `memberships.promoted_from` so a promoted teacher goes back to teacher; `SpaceNameSchema` with explicit BMP ranges (Hermes); `history.someone` for a missing account; `signedInAs` with Use another account; `renameSpace` returns `changes`; the teacher self-leave cell corrected (no route); `admins.full(max)` and `adminInvite.full(max)` take the cap; the revoke sheet's dismiss `revokeKeep`; es `Renombrar`, `Anular` (length budget); ko `contactLineCaps` in 합니다체; ko colon forms and `요청해 주세요`; billing wireframes and mocks show `23 of 50 students` on licensed class payer cards and `18 of 50` on the free school; F-ENT-001, F-BILL-002 (payer rule, school admin row split, OD-8, section 5.3), the app map row #30, the roadmap and the launch history row marked [SA]; the section 10 check widened. Not taken: none (every finding fixed).
- 2026-10-20, two independent reviews of PR #753 (SA-0b), adjudicated in the same PR: the invite stash is removed by Go to my home in every state and by every sign-out except Use another account (`clearGrownUpTab`), so neither a `429` loop through `/start` nor a shared computer can forward someone to an invite (section 6.6 step 1, step 8); the one-shot flash for `done` and `left` (no name in a URL); Stop with `stays: 'none'` goes to the router's home; on an archived school the owner keeps Remove and Revoke; `404`/`403`/`409` on an admin action reload the panel; rename ignores Enter and Escape during IME composition, keeps Rename busy until the `PATCH` settles and reverts to the last confirmed name, and uses an HTML `maxLength` of 120 with the 40 checked after NFC (section 5.3); `console.admins.remove.a11y(name)` added; `history.left` reworded; es `revoked` uses `anular`, ko `left(school)` colon form, ko `stepUp.reason` `공유 기기`; the tests of SA-2, SA-3 and SA-4 widened (section 11); the header reads approved in #753. Not taken: the CI billing stop (an account setting, not a spec change).
- 2026-10-20, design row SA-0b (agent design pass, `design/screens/console/README.md`): nine strings the mocks need had no row and are added to section 9.4 (the admin step-up body and reason, since the billing ones name payments; revoked, removed, left, actionFailed; the administrator's read-only Settings lines); section 6.6 now sends an administrator who stops to the teacher home in both cases, since a teacher member cannot open the school page; section 6.6 names the step-up lines and the Settings values.

- 2026-10-20, two independent reviews of PR #746, adjudicated in the same PR: added SA-0b (wireframes and mocks before SA-3 and SA-4, CLAUDE.md section 5); widened SA-0 to edit the old 5 and 300 in launch docs, billing wireframes, screens and mocks and in the F-ENT-001, F-SCHOOL-001 and F-BILL-002 bodies; recorded that a rename resets an open transfer's consent (section 5.4, OQ-12) with a hint and a test; kept lookup `full` class-only for shipped apps and added the learner-aware `seat` (section 3.4); added the own-licence-in-a-school cap rows; Settings per control for an admin with `canRemove`; admins stay assignable and ending an admin role keeps a teacher with classes; `seats.school.at` for an unlicensed school; OQ-11; school-only audit with `class_renamed`; the invite fragment captured before `GrownUpGate` with `next`, sign-up and `/start` handling; `putSpace` stops writing the name; guarded invite create and revoke; space-pinned accept gate with teacher-only promotion; no email in preview; `403 reverify_required`; NFC and format characters in names (also the whitespace-then-control order Codex flagged); no CHECK on `space_events.kind`; class-cascade removal of admins refused; `contactLineCaps` moved into SA-1 and Terms before Live.

- 2026-10-20, author pass against `173f12850`: found that nothing creates an `admin` membership yet while `can()` already makes a school admin a payer (so moving billing to the owner affects no one today); that the family cap is checked after the class checks and is mapped to the three-classes message on the learner app (`sync-api.ts:343`); that a licensed class has no cap at all today; that an unlicensed school has no school-wide cap; that the roster's cap line uses the free cap for every class (`rollup.ts:76`); that the join's read-then-insert lets two devices take one last seat; that `putSpace` rewrites every column, so a rename needs its own column-only statement; and that `console.contactLine` types the old numbers into the English text.
