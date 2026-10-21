# Console/School-admin — class tree, teacher invites, seats (wireframe v1)

> **Amended 2026-10-20 [SA]** (`docs/specs/AMENDMENTS-SEATS-ADMINS.md`): a family holds up to **4** learners (was 5); the Group License covers up to **50** students in a class or a school (was no cap for a class and 300 for a school). Only the numbers on this page changed; the new rename and administrator surfaces get their own wireframes and mocks in row SA-0b.
>
> **Amended 2026-10-20 [SA] (design row SA-0b)**: the page gains **Rename** next to the school's title and on each class row (`console/rename-inline`), the **Administrators** panel under the teacher invite (`console/admins-panel`), and the learner-limit lines of AMENDMENTS-SEATS-ADMINS section 3.4: an unlicensed school holds up to 50 students (each class up to 20), at the cap `console.seats.school.at(cap)`, over it `console.seats.school.over(n, cap)`. A school administrator sees the same page without **Manage billing** (billing stays with the owner). Mock: `design/screens/console/admins-panel.md`, `mock/admins-panel.html`.

Spec: `docs/roadmap/multi-persona-sync-platform.md` §1 (P-D), §2 (`parent_space_id`), §3.1 (admin: summary only, invite teachers, manage entitlement), §6 (school paragraph — no individual learner cards, `anonymize_roster` default on), §7 (`school_license` / `school_seat`), §10 S7
Code (F-SCHOOL-001, 2026-09-21): `apps/web/src/components/console/SchoolAdmin.tsx` rendered by `/teach/space/[id]` for school spaces — licence + seats (near / at limit notes), teacher invite code (copy, regenerate), this-week aggregate, class rows (teacher, students, last active, plan; Assign / Change teacher from the school's teachers; Open roster), + New class, empty state. Server: `GET /spaces/:id/school`, `POST /spaces/:id/members`, seat cap on join. Not yet: SSO, admin consent record, per-class licence.
Audience: **school admin** (한글학교 organizer)

## Scenario (Given-When-Then)

Given: a school admin owns a school space with several classes taught by other teachers
When: they open the school view
Then: they see the class tree with aggregate activity, can invite a teacher with a code, and know how many seats the license has left — without ever opening an individual student's card

## Screen goal

"Run the school as a set of classes: invite teachers, watch seat usage, open a class roster when needed."

## Box diagram

```
+------------------------------------------------------------+
| < Back to Classes                                          |  <- PageBack
| Seoul Hangul School · school               ( Rename )      |  -> console/rename-inline (owner and admins)
|                                                            |
|  License   group_license - active - renews Jan 5           |
|  Seats     students 38 / 50      teachers 4 / 10           |  -> console/billing
|  [ Manage billing ]                                        |  <- owner only [SA]
|                                                            |
|  Invite a teacher                                          |
|   code  R4WQ2P   (role: teacher) - expires in 22 days      |
|   [ copy ]  [ regenerate ]   1 line: "they sign in, enter this code, then create their class" |
|                                                            |
|  Administrators                          1 of 2 added      |  -> console/admins-panel [SA]
|   Ms Park · owner                                          |
|   Mr Lee · admin · joined Oct 3              [ Remove ]    |
|     lee@example.org   (owner only)                         |
|   A school can have 2 administrators besides its owner.    |
|   [[ Invite an administrator ]]   > History                |
|                                                            |
|  This week (whole school, aggregate)                       |
|   o 31 of 38 students practiced                            |
|   o 3 of 4 classes have a published plan                   |
|                                                            |
|  Classes                                                   |
|  +------------------------------------------------------+  |
|  | Sunday Class A   Ms. Park    12 students   active today |
|  |   [ Change teacher ] [ Rename ] [ Open roster > ]    |  |  <- Rename [SA]
|  | Sunday Class B   Mr. Lee     10 students   active Tue   |
|  |   [ Change teacher ] [ Rename ] [ Open roster > ]    |  |
|  | Saturday K       (no teacher yet)  0 students        |  |
|  |   [ Assign teacher ] [ Rename ] [ Open roster > ]    |  |
|  | Spring 2025 (archived)  8 students                   |  |
|  |   [ Open roster > ]                                  |  |  <- archived: no Rename
|  +------------------------------------------------------+  |
|  [ + New class ]                                           |
+------------------------------------------------------------+
```
- Aggregate only: class rows show counts and freshness; no names of students, no per-student numbers. `anonymize_roster` is on by default for school-owned classes, so even `console/roster` opened from here shows nicknames / initials.
- Reading + admin surface; the one `[[ ]]` primary is the owner's **Invite an administrator** [SA] (none for an admin); the invite code is the most prominent block when the school is empty.

## Interaction points

- [ Open roster > ] → `console/roster` for that class (admin sees the same summary cards, anonymized; no plan / settings writes unless also that class's teacher)
- [ Assign teacher ] → sheet listing teachers who joined via the code → sets `memberships(role: teacher)` on that class
- [ + New class ] → inline name field → `POST /spaces {kind: class, parent_space_id: school}` → row appears (teacher assigned later)
- [ regenerate ] → confirm → `POST /spaces/:id/code` for the school space (role=teacher code)
- [ Manage billing ] / Seats block → `console/billing` (school plan)
- [ Settings ] → `console/space-settings` (school variant: members = teachers, archive school)
- [< back to home] → `console/home`
- [ Rename ] (title or a class row) [SA] → the inline field of `console/rename-inline` (school hint on the title, class hint on a row)
- Administrators panel [SA] → `console/admins-panel` (invite, revoke, remove, stop being an administrator, history)

## Navigation graph

Enter from: `console/home` (school row) · `console/onboarding-role` (school admin path) · `console/roster` breadcrumb (class opened from here) · `console/billing` (back)
Exit to:    `console/roster` · `console/space-settings` · `console/billing` · `console/home`

## States

- **success**: as above.
- **empty** (no classes, no teachers yet): license + invite code blocks only, invite code rendered large; "This week" and "Classes" replaced by one 2-line guide ("invite a teacher, or create a class and assign one").
- **seats near / at limit**: Seats block shows "45 / 50" with a 1-line note → `console/billing`; at limit, new class joins are refused server-side and the class roster shows the cap banner instead of the teacher-free-cap one.
- **unlicensed** [SA]: Seats `students 18 / 50 · teachers 2`; the note `console.schoolNoLicenceCaps(20, 50)`: "No licence yet. Each class holds up to 20 students, and the school up to 50."
- **unlicensed, at 50** [SA]: `console.seats.school.at(50)`: "This school has 50 students, the most it holds without a contract. New students can join when a place opens." (`console.schoolAtLimit` stays for a licensed or contracted school at its cap)
- **over the cap** [SA] (grandfathered, SA-D7): `console.seats.school.over(62, 50)`: "This school has 62 students. Everyone keeps their place and everything they learned. New students can join when there are fewer than 50, or write to us for a contract." Neutral note style, never a warning colour.
- **viewer is an administrator** [SA]: no Manage billing; Rename shown; the Administrators panel in its admin view (list, Stop being an administrator).
- **error** (tree fetch fails): license + invite code from cache; class list shows "can't load classes yet" + [ TRY AGAIN ].
- **license past_due / expired**: banner at top → `console/billing`; classes keep reading access; premium tier for students lapses per roadmap §3.2 (7-day offline grace) — the banner says "students keep Stage 1 either way".

## Data needs

- reads: school `spaces` row + join_code (teacher role) · child `spaces` (kind=class, parent_space_id) with teacher membership, learner count, `max(summary.lastActiveAt)`, has-published-plan · `entitlements` for the school (plan_key, status, seats, expires_at) · seat usage = distinct learners across child classes; teacher usage = distinct teacher memberships
- writes: `POST /spaces` (class under school) · teacher membership assign · `POST /spaces/:id/code`
- telemetry: `console_school_admin_viewed{classes, seatsUsed}`, `console_teacher_invite_regenerated`, `console_class_created{by: admin}`

## Open questions

- Teacher invite code vs class join code both live in `spaces.join_code` — a school space's code is always role=teacher; is that clear enough, or should the join route take an explicit role? Flag for F-SPACE-001.
- **School consent mode** (roadmap §11 Q1) — **deferred**; if "school attests", an admin-level consent record block would be added here (placeholder only in `console/space-settings` for now).
- Can an admin open `parent/learner-detail` at all? Roadmap §6 says individual cards are not opened by admins — this wireframe lets them open the *roster* (anonymized) but the card tap should be disabled for admins. Confirm at S7.
- Seat counting for a learner in two classes of the same school: count once (default) — verify against `school_seat` contract language.
