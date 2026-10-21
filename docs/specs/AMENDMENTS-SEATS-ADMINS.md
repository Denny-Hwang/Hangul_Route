Status: ready (spec only; rows SA-1 to SA-6 implement it)

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
| SA-D1 | **A family holds up to 4 learners**, free or on the Family Plan (`FAMILY_LIFETIME_LEARNERS` 5 → **4**). | F-ENT-001 section 3.1 ("up to 5 learners"), F-BILL-002 AS2 (5 on every family) | Owner request (1). One cap for every family keeps buying the plan from ever lowering a family's room (the reason F-BILL-002 AS2 gave for one cap). **Default, owner may change** (OQ-1). |
| SA-D2 | **The Group License covers up to 50 learners**: a stand-alone class with its own licence holds up to 50 students (was: no cap), and a school with a licence holds up to 50 distinct students across its live classes (was: 300). New constant `GROUP_LICENSE_LEARNERS = 50`; `SCHOOL_LICENSE_STUDENTS` becomes 50. | F-ENT-001 section 3.1 ("up to 10 teachers / 300 students"), F-ENT-001 section 3.2 `classCap` (licensed → unlimited), F-SCHOOL-001 section 3.1 (300) | Owner request (2): the $153 plan is the Group License, sold to a class or a school. |
| SA-D3 | **Every school holds up to 50 distinct students**, licensed or not (`SCHOOL_LEARNER_CAP = 50`). An unlicensed school's classes also keep the free class cap of 20 each. A School Contract (`school_seat`) replaces the 50 with its `seats` (null = no cap). | F-SCHOOL-001 section 3.1 ("nothing active → no school-level caps") | Without it, a school would have more room free than paid, and could fill up free and then buy a licence for any number. Same reasoning as SA-D1. **Default, owner may change** (OQ-2). |
| SA-D4 | **Teachers: unchanged.** A licensed school still holds up to 10 teaching accounts (`SCHOOL_LICENSE_TEACHERS` 10). School administrators (SA-D10) do not count as teachers unless they own or teach a class, exactly as `schoolUsageFrom` counts today. | — | The owner named learners only. **Default, owner may change** (OQ-3). |
| SA-D5 | **What a learner seat is.** A seat is one `memberships` row with `member_kind = 'learner'`: in a family, its learner members; in a stand-alone class, its learner members; in a school, the **distinct** learners across its live (not archived) classes (a learner in two classes of one school takes one seat). Learner profiles kept on a device that never joined a family take no seat. Grown-ups (owner, caregiver, teacher, admin) never take a learner seat. | — | Matches `studentsIn` (`seats.ts:13-15`) and `schoolUsageFrom` (`entitlement.ts:92-104`), the counts the console already shows. |
| SA-D6 | **At the cap, adding is refused, kindly; nobody is removed.** A join, a class move or a family join that would pass a cap is refused with `409` and the cap's code (`cap_family`, `cap_class`, `cap_school`), with `details: { cap }`. The learner app and the console say the limit and what to do, never "error" or "failed". Existing members, their progress, cards and stars are never touched. | `cap_family` mapped to the three-classes message on the learner app (`sync-api.ts:343`), see section 2.4 | Owner request (1), (2); anti-shame. |
| SA-D7 | **Spaces already over a cap are grandfathered.** A family with 5 learners, a licensed class with 70 students, or a school with 120 students when SA-1 deploys keeps every member, read-write, and every member keeps the coverage the plan gives (premium for all of them while the plan is active). It cannot add a learner until it is below the cap. The console says so calmly (section 3.7). | — | Never remove or hide a learner (owner rule). Coverage per seat (only the first 50 covered) is the alternative; it would take premium away from learners who already have it. **Default, owner may change** (OQ-4). |
| SA-D8 | **The Worker enforces caps atomically.** The learner join (family and class), the family-started class transfer and the teacher class move each take a seat in **one D1 statement** whose `WHERE` holds every cap that applies (section 3.3), so two devices joining at once can never both take the last seat. The read-then-insert of today (`spaces.ts:318-324`) goes. | `classSeatCheck` then `addMembership` as two steps; the advisory school check of `transfer.ts:530` | Owner task: "the Worker enforces it atomically". |
| SA-D9 | **Renaming is one tap, where the name is shown.** A new route `PATCH /api/spaces/:id/name` and a new action `space.rename`. The console shows a **Rename** button next to the name on the family home, the class page, the school page, each class row of the school page, and in Settings, which opens an inline field in place (Save, Cancel; Enter saves, Escape cancels). Names follow the create rule (trimmed, 1 to 40 characters) with whitespace collapsed and control characters refused. The new name reaches every grown-up page on its next read and every learner device at its next sync. | — (no rename exists: `PATCH /:id/settings` takes settings only, `spaces.ts:213-227`; the name the start page prefilled from the account name, `routing.ts:182-188`, could never change) | Owner request (3). |
| SA-D10 | **A school has its owner and up to 2 administrators (3 in total).** `SCHOOL_ADMIN_CAP = 2`. Administrators join only through an **invite link** the owner makes: single use, expires after **7 days**, revocable, the token in the link's fragment and only its SHA-256 hash stored, accept needs sign-in, and the cap is checked atomically at accept (section 6). | — (the `admin` role exists in the schema and in `can()`, `can.ts:51-58`, but nothing can create it) | Owner request (4). |
| SA-D11 | **Administrators run the school; the owner keeps billing and the admin list.** An admin can rename the school and its classes, create classes, see and regenerate the teacher invite code, assign and remove teachers, open class rosters and reports, and move students between the school's classes (the cascade of `can.ts:83-89`). Only the **owner** can buy, manage or cancel the plan, open receipts, invite or remove admins, change the school's settings (anonymized roster, consent mode) and archive or unarchive the school. Nobody can remove the owner. An admin can leave at any time. New owner-only actions `billing.manage`, `admin.manage`, `space.settings`, `space.archive` (section 6.5). | F-BILL-002 section 4.2 and OD-8 ("the payer of a school is its owner **and** its admins"): admins become read-only on billing | Receipts show the payer's name, email and address (F-BILL-002 section 4.10), and a plan change spends the owner's money. **Default, owner may change** (OQ-5, OQ-6). No admin row exists in production (nothing can create one at the basis commit), so the change affects nobody today. |
| SA-D12 | **An audit trail for school administration and renames.** One additive table `space_events` records invite made, invite revoked, admin joined, admin removed, admin left and renamed, with account ids and a time, never a name, an email or a token. The school owner sees the last 20 school events on the admins panel. Rows older than 400 days are purged by the daily job. | — | Owner task: audit wording. **Default, owner may change** (OQ-10). |

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
| class in an archived school | as for its own licence, else 20 | none (an archived school takes no joins into itself and its classes keep their own cap) |
| school | learners never join a school directly (`not_joinable`, unchanged) | — |

- `classCap(db, space, now)` returns the learner cap of the table (licensed stand-alone → 50 instead of `Infinity`; class in a covered school → `Infinity`).
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

- **Worker.** `409 { code: 'cap_family' | 'cap_class' | 'cap_school', message, details: { cap } }`. Messages (logs only, English): "This family has room for {cap} learners", "This class has room for {cap} students", "This school has room for {cap} students". `cap_learner` unchanged.
- **Lookup.** `POST /spaces/lookup` returns `full: true` for a family at its cap too (today classes only), so the learner app says it before the name step.
- **Learner app** (`JoinSpaceScreen`, `joinErrorMessage`): `sync-api.ts` maps `cap_family` and `cap_school` to their own codes (today both fall into `cap_learner`); new lines `caregiver.join.errors.familyFull(cap)` and `caregiver.join.errors.schoolFull` (section 9.1). The cap number comes from `details.cap` when present, else from `FAMILY_LIFETIME_LEARNERS`. The code step is kept; the learner can leave with Back. Telemetry `space.join.failed { reason: 'cap_family' | 'cap_school' }` (the existing event, two new reason codes).
- **Console** (grown-up pages):
  - Family home (the join code panel) and family Settings: the count `n of 4 learners` (`console.billing.usage.learners(n, cap)`, reused). At the cap, one line under the code: `console.seats.family.at(cap)`. Over the cap: `console.seats.family.over(n, cap)`. The code stays visible (a learner who is already a member can still use it to come back).
  - Class page (roster): the count from the roster response (`seats`, section 3.6), not the free cap. Free class at 20: the existing `capReached` line. Licensed class at 50: `console.seats.class.at(cap)`. Over: `console.seats.class.over(n, cap)`.
  - School page: `students n / 50 · teachers n / 10` (existing `school.licence.usage`), near-limit at 90 % (existing), at the cap `console.schoolAtLimit` (existing), over the cap `console.seats.school.over(n, cap)`. Unlicensed: `console.schoolNoLicenceCaps(classCap, schoolCap)` replaces `schoolNoLicence(cap)`.
  - Billing page cards: `usage` with the new caps (section 3.6). Contact line: `console.contactLineCaps(students, teachers)` replaces `contactLine`.
- No red, no warning colour beyond the existing note style, no "error", "failed", "limit exceeded", "over capacity" or "you must". Every at-cap line names what to do: remove a learner who no longer needs a place (family), ask the teacher (learner), or write to us for a contract (school).

### 3.5 Grandfathering (SA-D7)

- No migration rewrites or removes a membership. A space whose count is at or above its cap when SA-1 deploys simply refuses new learner joins and moves in.
- Every member keeps premium while the space's plan is active (`classIsPro`, `tierFromSpaces` unchanged).
- Removing a learner (by a grown-up) or a learner leaving lowers the count; joins open again only below the cap.
- Unarchiving a class re-counts its learners into its school. If that puts the school over its cap, the unarchive still succeeds (the learners were already members) and the school is grandfathered as above.

### 3.6 Counts in the API

- `GET /api/spaces/:id/roster` gains `seats: { learners, cap, schoolLearners, schoolCap }` (caps `null` = none; school fields `null` outside a school). Read only, from the same reads the roster already makes plus one school count. The console's `capState` uses it (`rollup.ts:74-78`); a console older than SA-1 ignores the field.
- `GET /api/spaces/:id/school`: `limits.students` per section 3.2 (50, `seats`, or 50 when unlicensed with `licensed: false`).
- `GET /api/billing/summary` (`billing-summary.ts:155-169`): family `learnerCap` 4; stand-alone class `learnerCap` 20 when free and 50 when covered by its own licence; class in a school `learnerCap` null (the school card shows the school count). School cards: seat counts for the **owner and admins** (was payers only; admins are no longer payers, SA-D11), `learnerCap` per section 3.2. Viewers other than these still see the learner count only.

### 3.7 Over-cap and near-cap lines, examples

| State | English line |
|---|---|
| family 3 of 4 | "3 of 4 learners" |
| family at 4 | "This family has 4 learners, the most it can hold. To add someone new, remove a learner in Settings first. Their progress stays on their device." |
| family 5 (grandfathered) | "This family has 5 learners. Everyone keeps their place. New learners can join when there are fewer than 4." |
| licensed class at 50 | "This class has 50 students, the most the Group License holds. New students can join when a place opens." |
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

- Body: `SpaceRenameSchema = { name: SpaceNameSchema }`. `SpaceNameSchema` (content-schema, also used by `SpaceCreateSchema` from SA-1 on): string, every run of whitespace (spaces, tabs, new lines, the ideographic space) collapsed to one space, trimmed, 1 to 40 UTF-16 units (the create rule), no control characters (`\u0000-\u001F`, `\u007F-\u009F`), at least one letter or digit. Invalid → `422 bad_name` with `details: { reason: 'empty' | 'too_long' | 'invalid' }`.
- `404 not_found`, `403 forbidden` (no `space.rename`), `422 archived`.
- Same name as stored (after normalizing) → `200 { space, changed: false }`, nothing written, no event.
- Otherwise one column-only statement `UPDATE spaces SET name = ? WHERE id = ? AND archived_at IS NULL` (new `Db.renameSpace(id, name)`, never `putSpace`, so a concurrent settings PATCH or code regeneration is never overwritten), one `space_events` row (`renamed`), the server event `space.renamed { kind, role }` → `200 { space: publicSpace(space), changed: true }`.
- Last write wins between two grown-ups renaming at once; each sees the stored name in the response.
- Rate limit: 30 renames per account per hour (`createRateLimiter`), `429 too_many_attempts`.

### 5.3 Console (SA-3)

- **One-tap inline rename.** A text button **Rename** (secondary, `touchTarget.min`) next to the page title wherever the signed-in grown-up holds `space.rename`: the family home, the class page (`/teach/space`, `/parent/space`), the school page, and the Name row at the top of Settings. On each class row of the school page, a **Rename** action beside **Open roster**. The button's accessible name is `console.rename.a11y(name)` ("Rename {name}"). The roster and school responses carry `canRename: boolean` so the page does not guess the rule.
- Tap → the title is replaced in place by one `Field` (label `console.rename.label` "Name", the current name selected, `maxLength` 40, a hint `console.rename.hint[kind]`) and **Save** / **Cancel**. Enter saves, Escape cancels, focus returns to the Rename button.
- Validation in the field before sending (the same `SpaceNameSchema`): empty → `console.rename.empty`; too long → `console.rename.tooLong(40)`; no letter or digit → `console.rename.invalid`. Save is disabled while invalid or unchanged.
- Save → the new name shows at once (optimistic), the field closes, a polite live region says `console.rename.saved`. On failure the old name comes back and the field reopens with `console.rename.failed` (or `retry.offline` when offline, `console.rename.archived` on `422 archived`).
- The frame's space switcher, the page title, the Back label (`s.back(name)`) and the browser tab title update from the same state.
- **Creation stays prefilled** from the account name (`prefillName`); the start page gains the line `console.start.nameLater` ("You can change this name later.") under the name field.

### 5.4 Propagation

- Grown-up pages read the name from the API on every load, so other grown-ups see it on their next page load or `visibilitychange` refresh (`use-visible-refresh.ts`).
- Learner devices: the inbox memberships and the tier source carry the space name; `membership-store` replaces its cached list on every inbox refresh (after every successful sync), and `tier-store` replaces the source. SA-5 adds tests that a renamed space shows in Settings ("Classes & family") and on the Plan screen after one refresh, and fixes any place that keeps an older copy of a space name (historic notices, such as a class-move notice, keep the name of the time on purpose).
- Reports, notes and class moves read names at request time; nothing stores a copy of a space name except historic move notices.

### 5.5 Telemetry

Server event `space.renamed` with payload `{ kind: 'family' | 'class' | 'school', role: 'owner' | 'teacher' | 'admin' }` (codes only; never the name, never a space id).

---

## 6. School administrators

### 6.1 Model

- An administrator is a membership row `{ space_id: <school>, member_kind: 'account', role: 'admin' }`. At most `SCHOOL_ADMIN_CAP` (2) such rows per school; the owner is not one of them. Total 3 grown-ups with admin rights.
- Only schools have admins. A family or a class answers `422 not_a_school` on every admin route.
- An account that is already a teacher member of the school becomes an admin by accepting (its row's role changes to `admin`; the classes it owns stay its own; it keeps `class.create`, which admins have). An account that is an admin and later uses the school's teacher code stays an admin (`alreadyMember`, as today).

### 6.2 Data (migrations, additive)

```sql
-- SA-1: 00NN_space_events.sql (the next free number when SA-1 merges; 0011 at the time of writing)
CREATE TABLE IF NOT EXISTS space_events (
  id                 TEXT PRIMARY KEY,                 -- sev:<uuid>
  space_id           TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('renamed', 'admin_invite_created', 'admin_invite_revoked', 'admin_joined', 'admin_removed', 'admin_left')),
  actor_account_id   TEXT NOT NULL,
  subject_account_id TEXT,                             -- the admin joined, removed or leaving
  invite_id          TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_space_events_space ON space_events(space_id, created_at);
```

```sql
-- SA-2: 00NN_admin_invites.sql (the next free number when SA-2 merges)
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

The `space_events.kind` CHECK lists every kind both rows need, so SA-2 needs no change to it. `scheduled.ts` deletes `space_events` rows older than 400 days (SA-1) and `admin_invites` rows whose `expires_at`, `accepted_at` or `revoked_at` is older than 30 days (SA-2). `schema-v2` mirrors and the memory store implement both.

### 6.3 Invite link

- **Token**: 32 random bytes (`crypto.getRandomValues`), base64url, 43 characters. Stored as `token_hash` only. Shown to the owner **once**, in the create response; lost → revoke and make a new one.
- **Link**: `https://app.hangulroute.com/account/invite#t=<token>` (`ADMIN_INVITE_PATH = '/account/invite'`, `adminInviteUrl(appUrl, token)` and `parseAdminInvite(hash)` in content-schema `app-shell.ts`, beside `joinLinkUrl`). The token is in the **fragment**: browsers never send it in a request line or a `Referer`, so it reaches no server log. Nothing else is in the link: no school name, no email, no id.
- **Single use**, **expires** 7 days after creation, **revocable** by the owner until accepted.
- **Open invites count toward the cap at creation**: the owner can make a new invite only while `admins + open invites < 2` (`409 admins_full` otherwise). Accept re-checks the admin count atomically (section 6.4).
- Creating an invite needs a **fresh sign-in** (step-up, `requireStepUp`, F-BILL-002 section 4.4): it hands someone access to the school's rosters. **Default, owner may change** (OQ-7).

### 6.4 Routes

| Method · path | Who | Result |
|---|---|---|
| `GET /api/spaces/:id/admins` | owner or admin of the school | `{ owner: { accountId, name }, admins: [{ accountId, name, joinedAt }], limit: 2, invites: [{ id, createdAt, expiresAt }] (owner only; open ones), events: [{ kind, at, actorName, subjectName }] (owner only; the last 20) }`. `name` = display name, else email, as `GET /:id/members` does. |
| `POST /api/spaces/:id/admin-invites` | owner (`admin.manage`), fresh sign-in | `201 { invite: { id, createdAt, expiresAt }, url }` · `409 admins_full` · `401 reverify_required` (step-up) · `422 not_a_school` · `422 archived` |
| `DELETE /api/spaces/:id/admin-invites/:inviteId` | owner | `200 { revoked: true }` (idempotent; an accepted invite → `409 invite_used`) |
| `POST /api/admin-invites/preview` `{ token }` | signed-in account; 20 per client key per hour | `200 { school: { name }, invitedBy: name, expiresAt, state: 'open' }` · `200 { state: 'already_admin', school: { name } }` · `404 invite_not_found` · `410 invite_used` / `invite_expired` / `invite_revoked` · `409 already_owner` · `409 admins_full` · `429` |
| `POST /api/admin-invites/accept` `{ token }` | signed-in account; same limiter | `200 { space: { id, kind, name }, role: 'admin' }` · the refusals of preview |
| `DELETE /api/spaces/:id/admins/:accountId` | owner | removes that admin's membership of the school (`200 { removed }`); the owner → `409 owner`; not an admin → `404` |
| `POST /api/spaces/:id/admins/leave` | the admin themself | removes their own membership (`200 { left: true }`); the owner → `409 owner` |
| `DELETE /api/spaces/:id/members/account/:memberId` (existing) | `roster.manage` | gains: removing an `admin` needs `admin.manage` (`403 owner_only`) |

The token travels only in the JSON body of preview and accept, never in a path or query.

**Accept, atomically** (`Db.acceptAdminInvite({ inviteId, accountId, now })`, one D1 batch, the gate-then-guarded-writes pattern of F-SPACE-002 section 4.6):

1. Gate: `UPDATE admin_invites SET accepted_by = ?acc, accepted_at = ?now WHERE id = ?inv AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?now AND EXISTS (SELECT 1 FROM spaces WHERE id = ?sp AND kind = 'school' AND archived_at IS NULL AND owner_account_id <> ?acc) AND NOT EXISTS (SELECT 1 FROM memberships WHERE space_id = ?sp AND member_kind = 'account' AND member_id = ?acc AND role = 'admin') AND (SELECT COUNT(*) FROM memberships WHERE space_id = ?sp AND member_kind = 'account' AND role = 'admin') < 2`
2. `INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) SELECT ?sp, 'account', ?acc, 'admin', ?now WHERE EXISTS (SELECT 1 FROM admin_invites WHERE id = ?inv AND accepted_by = ?acc AND accepted_at = ?now) ON CONFLICT(space_id, member_kind, member_id) DO UPDATE SET role = 'admin'`
3. `INSERT INTO space_events (...) SELECT ... 'admin_joined' ... WHERE EXISTS (the same test as 2)`

Then read the invite: `accepted_by = acc` → accepted. Otherwise name the reason from one read: used, revoked, expired, owner, already an admin (`200 already_admin`, the invite stays open), or `admins_full`.

### 6.5 Permissions (`lib/can.ts`)

New actions, each granted to the `owner` role of the space only (any kind; on a family or a class they match `space.manage`, so nothing changes there): `billing.manage`, `admin.manage`, `space.settings`, `space.archive`. New action `space.rename` (section 5.1). Route changes:

| Route | Today | After [SA] |
|---|---|---|
| `POST /entitlements/stripe/checkout`, `/stripe/portal` (`ownedSpace`) | `space.manage` | `billing.manage` |
| `GET /billing/receipts`, `POST /billing/receipt-link` (`paidSpace`) | `space.manage` | `billing.manage` |
| billing summary `payer` | `space.manage` | `billing.manage` |
| `PATCH /spaces/:id/settings` | `space.manage` | `space.settings` |
| `POST /spaces/:id/archive`, `/unarchive` | `space.manage` | `space.archive` |
| `GET /spaces/:id/school`, `POST /spaces/:id/code` | `space.manage` | unchanged (owner and admins) |

| On a school | Owner | Admin | Teacher member |
|---|---|---|---|
| see the school page, licence status, seat counts | yes | yes | no |
| rename the school; rename its classes | yes | yes | own or taught class only |
| create a class | yes | yes | yes |
| see, copy, regenerate the teacher invite code; assign a teacher | yes | yes | no |
| remove a teacher from the school | yes | yes | no |
| open class rosters and reports; move students between the school's classes | yes | yes (cascade) | own or taught class only |
| buy, manage or cancel the plan; receipts | yes | no (read-only card: `billing.readOnly.schoolAdmin`) | no |
| change school settings (anonymized roster, consent mode) | yes | no (read-only) | no |
| archive or unarchive the school | yes | no | no |
| invite, revoke, remove admins; see the admin history | yes | no (sees the admin list) | no |
| leave the school | no (owner) | yes | yes (existing) |
| be removed | never | by the owner | by the owner or an admin |

Transferring ownership is out of scope (OQ-8).

### 6.6 Console (SA-4)

**Admins panel** on the school page (owner and admins), under the teacher invite. Heading `console.admins.title` "Administrators". One row for the owner ("{name} · owner"), one per admin ("{name} · admin · joined {day}"), the count `console.admins.count(n, 2)`, the line `console.admins.about(2)`.

Owner only:
- **Invite an administrator** (primary) while `admins + open invites < 2`; otherwise the line `console.admins.full`. Tap → the step-up dialog when needed (`StepUpDialog`) → the link in a `JoinLinkPanel`-style box (text, **Copy link**, no QR) with the consent lines `console.admins.invite.warning` and `console.admins.invite.once(date)`. Closing the box hides the link for good.
- Open invites: "Invite made {day} · ends {date}" with **Revoke** (confirm sheet `console.admins.revokeAsk`).
- Each admin: **Remove** (confirm sheet `console.admins.removeAsk(name, school)`, with the line `console.admins.removeNote`).
- **History**: the last 20 events, one line each (`console.admins.history.*`), names read at request time, newest first.

Admin only: **Leave this school** (confirm sheet `console.admins.leaveAsk(school)`), then the teacher home.

```
+----------------------------------------------------------+
| Administrators                              2 of 2 added |
|  Ms Park · owner                                          |
|  Mr Lee · admin · joined Oct 3              [ Remove ]    |
|  Dr Cho · admin · joined Oct 18             [ Remove ]    |
|  A school can have 2 administrators besides its owner.    |
|  Both places are taken. Remove an administrator or        |
|  revoke an invite to add someone else.                    |
|  > History                                                |
+----------------------------------------------------------+
```

**Accept page** `app.hangulroute.com/account/invite` (`APP_ROUTES.adminInvite`, console route group):
1. On load: read `#t=` with `parseAdminInvite`, keep the token in `sessionStorage` (`hr:admin-invite`, removed after accept, decline or 30 minutes), and remove the fragment from the address bar (`history.replaceState`), so it is not left in the history or shared by a copied address.
2. Not signed in → `console.adminInvite.signIn` with **Sign in** (Clerk, returns to `/account/invite`).
3. Signed in → `POST /admin-invites/preview` → **"Join {school} as an administrator?"** (`console.adminInvite.title`), "Invited by {name}", the consent block `console.adminInvite.can` / `console.adminInvite.cannot` / `console.adminInvite.leave`, **Accept** (primary) and **Not now**.
4. Accept → the school page with `console.adminInvite.done(school)`.
5. Refusals in one calm line each (`console.adminInvite.used`, `.expired`, `.revoked`, `.full`, `.owner`, `.alreadyAdmin`, `.notFound`), with **Go to my home**.

Billing page, school card for an admin: plan, status, seat counts, no actions, `billing.readOnly.schoolAdmin` ("The school's owner manages this plan."). School Settings for an admin: read-only, with the existing settings shown and no controls.

### 6.7 Privacy text (SA-4, English, `/privacy`, English-authoritative)

Add to the section on what school grown-ups see: "A school's owner can add up to two administrators with an invite link. Administrators see what the owner sees about the school's classes and students, except billing. The owner sees who is an administrator and when they joined or left. We keep this history for 400 days."

### 6.8 Telemetry

Server events, codes only (prefix `space.admin.`): `space.admin.invite_created`, `space.admin.invite_revoked`, `space.admin.joined`, `space.admin.accept_refused { reason: 'used' | 'expired' | 'revoked' | 'full' | 'owner' | 'not_found' }`, `space.admin.removed`, `space.admin.left`. Never a token, a name, an email or an id. `space_events` is the record; telemetry is not evidence.

---

## 7. Data summary (all additive)

| Migration | Row | Contents |
|---|---|---|
| `space_events` table | SA-1 | section 6.2 |
| `admin_invites` table | SA-2 | section 6.2 |

No column changes, no CHECK changes (the `memberships.role` CHECK already allows `admin`), no backfill. Caps are code constants, so no data moves.

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
| `console.seats.school.over(n, cap)` | This school has {n} students. Everyone keeps their place and everything they learned. New students can join when there are fewer than {cap}, or write to us for a contract. | Esta escuela tiene {n} estudiantes. Nadie pierde su lugar ni lo que aprendió. Pueden unirse estudiantes nuevos cuando haya menos de {cap}, o escríbenos para un contrato. | 이 학교에는 학생이 {n}명 있어요. 모두 자리와 배운 내용을 그대로 지켜요. 학생이 {cap}명보다 적어지면 새 학생이 들어올 수 있어요. 더 필요하면 계약을 문의해 주세요. |
| `console.schoolNoLicenceCaps(classCap, schoolCap)` (replaces `schoolNoLicence`) | No licence yet. Each class holds up to {classCap} students, and the school up to {schoolCap}. | Aún no hay licencia. Cada clase admite hasta {classCap} estudiantes, y la escuela hasta {schoolCap}. | 아직 라이선스가 없어요. 반마다 학생 최대 {classCap}명, 학교 전체는 최대 {schoolCap}명이에요. |
| `console.contactLineCaps(students, teachers)` (replaces `contactLine`; stays in `FORMAL_ALLOWED` as `contactLine` was) | More than {students} students or {teachers} teachers? Write to us for a contract. | ¿Más de {students} estudiantes o {teachers} docentes? Escríbenos para un contrato. | 학생 {students}명이나 선생님 {teachers}명보다 많은가요? 계약을 문의해 주세요. |
| `console.billing.includesLines.license.classLearners(n)` (replaces `noCap`) | Up to {n} students in the class | Hasta {n} estudiantes en la clase | 반 하나에 학생 최대 {n}명 |
| `console.billing.readOnly.schoolAdmin` | The school's owner manages this plan. | Quien creó la escuela gestiona este plan. | 학교를 만든 분이 이 플랜을 관리해요. |

Plural forms: the en and es functions use `plural()` where `{n}` / `{cap}` can be 1, as the existing `usage` lines do; the tables show the `other` form.

### 9.3 Rename (SA-3, `console` namespace)

| Key | en | es | ko |
|---|---|---|---|
| `console.rename.cta` | Rename | Cambiar nombre | 이름 바꾸기 |
| `console.rename.a11y(name)` | Rename {name} | Cambiar el nombre de {name} | 이름 바꾸기: {name} |
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
| `console.rename.archived` | Unarchive it first to change the name. | Primero desarchívalo para cambiar el nombre. | 이름을 바꾸려면 먼저 보관을 풀어 주세요. |
| `console.start.nameLater` | You can change this name later. | Puedes cambiar este nombre después. | 이 이름은 나중에 바꿀 수 있어요. |

### 9.4 Administrators (SA-4, `console` namespace)

| Key | en | es | ko |
|---|---|---|---|
| `console.admins.title` | Administrators | Admins | 관리자 |
| `console.admins.count(n, max)` | {n} of {max} added | {n} de {max} agregados | 추가한 관리자: {n}/{max}명 |
| `console.admins.ownerRow(name)` | {name} · owner | {name} · titular | {name} · 소유자 |
| `console.admins.adminRow(name, day)` | {name} · admin · joined {day} | {name} · admin · se unió {day} | {name} · 관리자 · 참여: {day} |
| `console.admins.about(max)` | A school can have {max} administrators besides its owner. | Una escuela puede tener {max} admins además de quien la creó. | 학교에는 만든 분 말고도 관리자를 {max}명까지 둘 수 있어요. |
| `console.admins.full` | Both places are taken. Remove an administrator or revoke an invite to add someone else. | Los dos lugares están ocupados. Quita a un admin o cancela una invitación para sumar a otra persona. | 두 자리가 모두 찼어요. 다른 분을 추가하려면 관리자 한 명을 빼거나 초대를 취소해 주세요. |
| `console.admins.invite.cta` | Invite an administrator | Invitar a un admin | 관리자 초대하기 |
| `console.admins.invite.warning` | Anyone with this link can become an administrator after signing in. Send it only to the person you mean. | Cualquiera con este enlace puede ser admin después de iniciar sesión. Envíalo solo a la persona indicada. | 이 링크가 있으면 누구나 로그인한 뒤 관리자가 될 수 있어요. 초대할 분에게만 보내 주세요. |
| `console.admins.invite.once(date)` | It works once and ends on {date}. It is shown only now: copy it before you close this. | Funciona una vez y vence el {date}. Solo se muestra ahora: cópialo antes de cerrar. | 한 번만 쓸 수 있어요. 끝나는 날: {date}. 지금만 보이니 닫기 전에 복사해 주세요. |
| `console.admins.invite.copy.cta` | Copy link | Copiar enlace | 링크 복사 |
| `console.admins.invite.copied` | Link copied. | Enlace copiado. | 링크를 복사했어요. |
| `console.admins.invite.copyFailed` | Couldn't copy. Select the link and copy it. | No se pudo copiar. Selecciona el enlace y cópialo. | 복사하지 못했어요. 링크를 선택해서 복사해 주세요. |
| `console.admins.invite.failed` | Couldn't make the invite. Try again. | No se pudo crear la invitación. Inténtalo de nuevo. | 초대를 만들지 못했어요. 다시 해 볼까요? |
| `console.admins.openInvite(day, date)` | Invite made {day} · ends {date} | Invitación creada {day} · vence el {date} | 초대 만든 날: {day} · 끝나는 날: {date} |
| `console.admins.revoke.cta` | Revoke | Cancelar invitación | 초대 취소 |
| `console.admins.revokeAsk` | Revoke this invite? The link stops working. | ¿Cancelar esta invitación? El enlace dejará de funcionar. | 이 초대를 취소할까요? 링크를 더는 쓸 수 없어요. |
| `console.admins.remove.cta` | Remove | Quitar | 빼기 |
| `console.admins.removeAsk(name, school)` | Remove {name} as an administrator of {school}? | ¿Quitar a {name} como admin de {school}? | 관리자에서 뺄까요? {name} · {school} |
| `console.admins.removeNote` | They leave the school. Classes they made stay with them. You can invite them again. | Sale de la escuela. Las clases que creó siguen siendo suyas. Puedes invitarle otra vez. | 학교에서 나가게 돼요. 직접 만든 반은 그대로 그분의 반이에요. 다시 초대할 수 있어요. |
| `console.admins.leave.cta` | Leave this school | Salir de esta escuela | 이 학교에서 나가기 |
| `console.admins.leaveAsk(school)` | Leave {school}? You stop being an administrator. Classes you made stay yours. | ¿Salir de {school}? Dejas de ser admin. Las clases que creaste siguen siendo tuyas. | 학교에서 나갈까요? {school}. 관리자 역할이 끝나요. 직접 만든 반은 그대로 내 반이에요. |
| `console.admins.history.title` | History | Historial | 기록 |
| `console.admins.history.inviteCreated(name, day)` | {name} made an invite · {day} | {name} creó una invitación · {day} | 초대 만듦: {name} · {day} |
| `console.admins.history.inviteRevoked(name, day)` | {name} revoked an invite · {day} | {name} canceló una invitación · {day} | 초대 취소: {name} · {day} |
| `console.admins.history.joined(name, day)` | {name} joined as an administrator · {day} | {name} se unió como admin · {day} | 관리자로 참여: {name} · {day} |
| `console.admins.history.removed(name, day)` | {name} was removed as an administrator · {day} | Se quitó a {name} como admin · {day} | 관리자에서 빠짐: {name} · {day} |
| `console.admins.history.left(name, day)` | {name} left the school · {day} | {name} salió de la escuela · {day} | 학교에서 나감: {name} · {day} |
| `console.admins.history.renamed(name, day)` | {name} renamed the school · {day} | {name} cambió el nombre de la escuela · {day} | 학교 이름 바꿈: {name} · {day} |
| `console.adminInvite.pageTitle` | Administrator invite | Invitación de admin | 관리자 초대 |
| `console.adminInvite.signIn` | Sign in to see this invite. | Inicia sesión para ver esta invitación. | 이 초대를 보려면 로그인해 주세요. |
| `console.adminInvite.title(school)` | Join {school} as an administrator? | ¿Unirte a {school} como admin? | 관리자로 참여할까요? {school} |
| `console.adminInvite.invitedBy(name)` | Invited by {name} | Te invitó {name} | 초대한 분: {name} |
| `console.adminInvite.can` | As an administrator you can rename the school and its classes, make classes, invite and assign teachers, open class rosters and reports, and move students between the school's classes. | Como admin puedes cambiar el nombre de la escuela y de sus clases, crear clases, invitar y asignar docentes, abrir listas e informes de clase, y mover estudiantes entre las clases de la escuela. | 관리자는 학교와 반 이름을 바꾸고, 반을 만들고, 선생님을 초대하고 배정하고, 반 명단과 리포트를 열고, 학교 안의 반끼리 학생을 옮길 수 있어요. |
| `console.adminInvite.cannot` | Billing and the list of administrators stay with the school's owner. | La facturación y la lista de admins quedan a cargo de quien creó la escuela. | 결제와 관리자 목록은 학교를 만든 분이 맡아요. |
| `console.adminInvite.leave` | The owner sees that you joined. You can leave at any time, and the owner can remove you. | Quien creó la escuela verá que te uniste. Puedes salir cuando quieras, y esa persona puede quitarte. | 학교를 만든 분이 참여 기록을 볼 수 있어요. 언제든 나갈 수 있고, 만든 분도 관리자에서 뺄 수 있어요. |
| `console.adminInvite.accept.cta` | Accept | Aceptar | 수락 |
| `console.adminInvite.notNow.cta` | Not now | Ahora no | 나중에 |
| `console.adminInvite.done(school)` | You're an administrator of {school}. | Ahora eres admin de {school}. | 이제 관리자예요. {school} |
| `console.adminInvite.used` | This invite was already used. Ask for a new one. | Esta invitación ya se usó. Pide una nueva. | 이미 사용된 초대예요. 새 초대를 받아 주세요. |
| `console.adminInvite.expired` | This invite has ended. Ask for a new one. | Esta invitación venció. Pide una nueva. | 기간이 끝난 초대예요. 새 초대를 받아 주세요. |
| `console.adminInvite.revoked` | This invite was cancelled. Ask for a new one if you need it. | Esta invitación se canceló. Pide una nueva si la necesitas. | 취소된 초대예요. 필요하면 새 초대를 받아 주세요. |
| `console.adminInvite.full` | This school already has two administrators. | Esta escuela ya tiene dos admins. | 이 학교에는 이미 관리자가 두 명 있어요. |
| `console.adminInvite.owner` | You already run this school as its owner. | Ya diriges esta escuela porque la creaste. | 이 학교를 만든 분이라서 이미 관리하고 있어요. |
| `console.adminInvite.alreadyAdmin(school)` | You're already an administrator of {school}. | Ya eres admin de {school}. | 이미 관리자예요. {school} |
| `console.adminInvite.notFound` | This link doesn't open an invite. Check that it was copied whole. | Este enlace no abre ninguna invitación. Revisa que se haya copiado completo. | 이 링크로는 초대를 열 수 없어요. 링크가 모두 복사됐는지 확인해 주세요. |
| `console.adminInvite.home.cta` | Go to my home | Ir a mi inicio | 내 홈으로 |

### 9.5 Site (SA-6, `landing` namespace)

| Key | en | es | ko |
|---|---|---|---|
| `landing.plans.sizes(family, group)` | The Family Plan is for up to {family} learners. The Group License is for up to {group} students in a class or a school. | El Plan Familiar es para hasta {family} estudiantes. La Licencia de Grupo es para hasta {group} estudiantes en una clase o una escuela. | 가족 플랜은 학습자 최대 {family}명이 함께 써요. 그룹 라이선스는 반이나 학교 하나에서 학생 최대 {group}명이 함께 써요. |

The Terms paragraph (section 4) and the privacy paragraph (section 6.7) are English-authoritative legal text (F-I18N-001 L10): es and ko show the English, as `isEnglishAuthoritative` already allows.

---

## 10. PR table (Worker first)

| Row | Type and contents | Depends on | Tests |
|---|---|---|---|
| SA-0 | `docs(specs)`: this amendment; [SA] notes in F-ENT-001, F-SCHOOL-001, F-SPACE-001, F-BILL-002 and the specs README | — | docs only |
| SA-1 | `feat(backend,content-schema,api)`: section 3.1 constants; section 3.2 caps (`classCap`, `schoolLimitsFrom`, `schoolIsFull`, `learnerCapOf`); section 3.3 atomic `addLearnerWithinCaps` (D1 + memory) used by `/join`, the school cap in the `executeTransfer` and class-move gates, `destCap` per section 3.2; section 3.4 Worker codes with `details.cap`, family `full` on lookup; section 3.6 roster `seats` and `canRename`, school limits, billing summary usage (school counts for owner and admins); sections 5.1-5.2 `space.rename`, `SpaceNameSchema`, `PATCH /:id/name`, `Db.renameSpace`; section 6.5 owner-only actions and the route switches (billing, settings, archive); the `space_events` migration and its purge; telemetry `space.seat_refused`, `space.renamed` (registry append) | SA-0 | section 11 |
| SA-2 | `feat(backend,content-schema,api)`: sections 6.1-6.4 admins: `admin_invites` migration, token and hash, `adminInviteUrl` / `parseAdminInvite`, every route of section 6.4, `acceptAdminInvite` batch, member removal rule, invite purge, telemetry `space.admin.*` | SA-1 | section 11 |
| SA-3 | `feat(web,i18n)`: section 5.3 inline rename (family home, class page, school page and class rows, Settings), `nameLater`; section 3.4 console seat lines and counts (`capState` from `seats`, family count, school lines), section 4 billing copy (`classLearners`, `contactLineCaps`, `schoolNoLicenceCaps`, `readOnly.schoolAdmin`, admin read-only school card and settings); strings 9.2, 9.3 | SA-1 | section 11 |
| SA-4 | `feat(web,i18n)`: section 6.6 admins panel, invite box with step-up, revoke, remove, leave, history; accept page `/account/invite`; section 6.7 privacy paragraph; strings 9.4 | SA-2, SA-3 | section 11 |
| SA-5 | `feat(mobile,i18n)`: section 3.4 learner join refusals (`cap_family`, `cap_school` mapped, `familyFull`, `schoolFull`, lookup `full` for a family); section 5.4 name propagation tests and fixes; strings 9.1 | SA-1 | section 11 |
| SA-6 | `feat(web,i18n)`: section 4 site sizes line on the persona Plans blocks, Terms sizes paragraph; strings 9.5 | SA-1 | section 11 |

- **Order.** SA-1 merges and deploys first (it is the Worker, and the constants every client reads). SA-2 follows. SA-3, SA-5 and SA-6 can run in parallel after SA-1; SA-4 after SA-2 and SA-3 (shared console files).
- **A client older than its Worker.** After SA-1, an old console still renders (it ignores `seats` and `canRename`); an old learner app shows the three-classes message for a full family until SA-5 ships (today's behaviour). After SA-2, nothing calls the admin routes until SA-4.
- **Ledger.** SA-3, SA-4, SA-5 and SA-6 change `en` namespace files: each recomputes that namespace's `enSha` and signs `reviewedBy: MAR` with the day's date only in its fix stage, after an independent reviewer passed the es and ko values.

## 11. Tests per row

| Row | File | Covers |
|---|---|---|
| SA-1 | `content-schema/__tests__/entitlement.test.ts`, `space.test.ts` | constants (4, 50, 50, 50, 10, 2); `SpaceNameSchema`: collapse, trim, 1 and 40 accepted, 0 and 41 refused, control characters refused, punctuation-only refused, Hangul and accented names accepted; `PLAN_PRICING` unchanged |
| SA-1 | `backend/lib/__tests__/entitlement.test.ts` | `classCap` per row of section 3.2; `schoolLimitsFrom` licence 50 / contract seats / none 50 unlicensed; `schoolIsFull` for an unlicensed school; a licensed class covers every member above the cap (grandfathered) |
| SA-1 | `backend/__tests__/spaces.test.ts` | family join refused at 4 (`cap_family`, `details.cap` 4), a 5th member kept and its re-join idempotent; licensed stand-alone class refused at 50; unlicensed school refused at 50 distinct with each class at 20; a learner already in a sibling class takes no seat; lookup `full` for a full family; grandfathered spaces keep members and refuse new ones; rename: each role of section 5.1 (allowed and 403), archived 422, invalid 422 reasons, unchanged 200 `changed: false`, rate limit, a settings PATCH and a rename together keep both changes; owner-only actions: an admin gets 403 on checkout, portal, receipts, settings, archive |
| SA-1 | `backend/db/__tests__/d1-seats.test.ts` (new, SQLite-backed like `d1-entitlement-cas.test.ts`) | the single statement under two concurrent joins for the last seat: exactly one `added`; school distinct counting; the `ON CONFLICT` path returns `already`; the transfer and move gates refuse at the school cap |
| SA-1 | `backend/__tests__/billing.test.ts`, `school.test.ts` | usage caps per section 3.6; school seat counts for admins, who are not payers; school view limits |
| SA-1 | `backend/__tests__/class-moves.test.ts`, `transfers.test.ts` | a move into a full school refused `cap_school`; a move inside one school at the cap allowed |
| SA-1 | `backend/lib/__tests__/can.test.ts` | `space.rename`, `billing.manage`, `admin.manage`, `space.settings`, `space.archive` matrix |
| SA-1 | `backend/lib/__tests__/server-events.test.ts` | new events keep codes only |
| SA-2 | `backend/__tests__/admins.test.ts` (new) | create (owner only, step-up, `admins_full` with open invites counted, not a school, archived), token returned once and only its hash stored, revoke, preview states, accept (sign-in, used, expired, revoked, owner, already admin, full), a teacher member becomes admin, remove (owner only; an admin cannot remove an admin through the members route), leave, history (owner only, last 20, names at read time), purge |
| SA-2 | `backend/db/__tests__/d1-admin-invites.test.ts` (new) | two accepts of two invites for the last place at once: one admin added; the batch writes nothing when the gate fails |
| SA-2 | `content-schema/__tests__/app-shell.test.ts` | `adminInviteUrl` puts the token in the fragment only; `parseAdminInvite` accepts only a 43-character base64url token |
| SA-3 | `web/lib/console/__tests__/rename.test.ts` (new), `billing-summary.test.ts`, `school.test.ts`, `rollup.test.ts` | client validation, optimistic save and rollback, per-kind hint, `capState` from `seats`, seat lines at, over and below caps, includes lines and contact line with the new numbers, admin school card read-only |
| SA-3 | `web/app/__tests__/rename-inline.test.tsx` (new) | Rename button only when `canRename`; Enter saves, Escape cancels, focus returns; live region; frame title, Back label and tab title update |
| SA-3 | `i18n/__tests__/console-messages.test.ts`, `billing-messages.test.ts`, `family-yearly-copy.test.ts`, `ko-translation.test.ts` | new keys in en, es, ko; no limit number typed in a string; no banned words; `contactLineCaps` replaces `contactLine` in the BY-D9 scan list and in `FORMAL_ALLOWED` |
| SA-4 | `web/app/__tests__/admins-panel.test.tsx`, `admin-invite-page.test.tsx` (new) | owner and admin views; invite box shown once; step-up; revoke and remove confirms; leave; the accept page reads and clears the fragment, keeps the token across sign-in in `sessionStorage` only, every refusal line; no token in any rendered link, title or telemetry |
| SA-4 | `web/app/__tests__/privacy-statements.test.tsx` | the administrators paragraph |
| SA-5 | `mobile/platform/__tests__/sync-api.test.ts`, `mobile/logic/spaces/__tests__/join-code.test.ts` | `cap_family` and `cap_school` mapped to their own codes and lines; the cap from `details.cap` and the fallback |
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
| OQ-1 | Every family, free or paid, holds up to 4 learners (was 5). | Free families keep 5 and only the Family Plan is 4 (paying would then lower the room). |
| OQ-2 | Every school, licensed or not, holds up to 50 distinct students; an unlicensed school's classes keep 20 each. | No school-wide cap without a licence (a free school could grow past 50 and then buy a licence for all of them). |
| OQ-3 | A licensed school keeps the 10-teacher cap; admins count only when they own or teach a class. | Another teacher number, or admins always counted. |
| OQ-4 | Over-cap spaces are grandfathered: everyone stays and stays covered; no new learner until below the cap. | Cover only the first 50 (or 4) by join date. |
| OQ-5 | Admins see the licence and seat counts but cannot buy, manage, cancel or open receipts (F-BILL-002 OD-8 changed for admins). | Admins as payers, as F-BILL-002 had it. |
| OQ-6 | Admins cannot change school settings (anonymized roster, consent mode), archive the school or manage admins. | Let admins change settings. |
| OQ-7 | Invite links are single use, end after 7 days, and need a fresh sign-in to create. | A longer life, or no step-up. |
| OQ-8 | Removing an admin removes them from the school; ownership cannot be transferred. | Demote to teacher; an ownership transfer flow. |
| OQ-9 | Family: only the owner renames. Class: owner and teachers of the class, and the school's owner and admins. School: owner and admins. | Caregivers rename the family too. |
| OQ-10 | School administration events are kept 400 days. | Another period. |

## 14. Out of scope

- Any price, Stripe Live, Stripe quantities or per-seat billing; a bigger family plan.
- Enforcing the teacher cap atomically (it stays advisory, as today).
- Ownership transfer, more than one school per organization, admins for families or classes, co-owners.
- Email delivery of invites (the owner sends the link themselves); invite by email address.
- Renaming learners (F-LEARN-001 and the profile edit already cover it).

## 15. Review log

- 2026-10-20, author pass against `173f12850`: found that nothing creates an `admin` membership yet while `can()` already makes a school admin a payer (so moving billing to the owner affects no one today); that the family cap is checked after the class checks and is mapped to the three-classes message on the learner app (`sync-api.ts:343`); that a licensed class has no cap at all today; that an unlicensed school has no school-wide cap; that the roster's cap line uses the free cap for every class (`rollup.ts:76`); that the join's read-then-insert lets two devices take one last seat; that `putSpace` rewrites every column, so a rename needs its own column-only statement; and that `console.contactLine` types the old numbers into the English text.
