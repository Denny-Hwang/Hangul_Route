# Console/School-admin — class tree, teacher invites, seats (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §1 (P-D), §2 (`parent_space_id`), §3.1 (admin: summary only, invite teachers, manage entitlement), §6 (school paragraph — no individual learner cards, `anonymize_roster` default on), §7 (`school_license` / `school_seat`), §10 S7
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
| [< back to home]   Seoul Hangul School         [ Settings ] |  -> console/space-settings (school)
|                                                            |
|  License   school_license - active - renews Jan 5          |
|  Seats     students 38 / 300     teachers 4 / 10           |  -> console/billing
|  [ Manage billing ]                                        |
|                                                            |
|  Invite a teacher                                          |
|   code  R4WQ2P   (role: teacher) - expires in 22 days      |
|   [ copy ]  [ regenerate ]   1 line: "they sign in, enter this code, then create their class" |
|                                                            |
|  This week (whole school, aggregate)                       |
|   o 31 of 38 students practiced                            |
|   o 3 of 4 classes have a published plan                   |
|                                                            |
|  Classes                                                   |
|  +------------------------------------------------------+  |
|  | Sunday Class A   Ms. Park    12 students   active today   [ Open roster > ] |
|  | Sunday Class B   Mr. Lee     10 students   active Tue     [ Open roster > ] |
|  | Saturday K       (no teacher yet)  0 students           [ Assign teacher ] |
|  | Spring 2025 (archived)  8 students                      [ Open roster > ] |
|  +------------------------------------------------------+  |
|  [ + New class ]                                           |
+------------------------------------------------------------+
```

- Aggregate only: class rows show counts and freshness; no names of students, no per-student numbers. `anonymize_roster` is on by default for school-owned classes, so even `console/roster` opened from here shows nicknames / initials.
- Reading + admin surface, no `[[ ]]` primary CTA; the invite code is the most prominent block when the school is empty.

## Interaction points

- [ Open roster > ] → `console/roster` for that class (admin sees the same summary cards, anonymized; no plan / settings writes unless also that class's teacher)
- [ Assign teacher ] → sheet listing teachers who joined via the code → sets `memberships(role: teacher)` on that class
- [ + New class ] → inline name field → `POST /spaces {kind: class, parent_space_id: school}` → row appears (teacher assigned later)
- [ regenerate ] → confirm → `POST /spaces/:id/code` for the school space (role=teacher code)
- [ Manage billing ] / Seats block → `console/billing` (school plan)
- [ Settings ] → `console/space-settings` (school variant: members = teachers, archive school)
- [< back to home] → `console/home`

## Navigation graph

Enter from: `console/home` (school row) · `console/onboarding-role` (school admin path) · `console/roster` breadcrumb (class opened from here) · `console/billing` (back)
Exit to:    `console/roster` · `console/space-settings` · `console/billing` · `console/home`

## States

- **success**: as above.
- **empty** (no classes, no teachers yet): license + invite code blocks only, invite code rendered large; "This week" and "Classes" replaced by one 2-line guide ("invite a teacher, or create a class and assign one").
- **seats near / at limit**: Seats block shows "290 / 300" with a 1-line note → `console/billing`; at limit, new class joins are refused server-side and the class roster shows the cap banner instead of the teacher-free-cap one.
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
