# Console/Roster — class roster, summary only (wireframe v1)

Spec: `docs/specs/F-TCH-001-teacher-classroom.md` §3.1–3.2, §3.6 · `docs/roadmap/multi-persona-sync-platform.md` §3.1 (teacher reads `summary_json` only), §3.3 (`ProgressSummary`), §4 (offline reach), §5 (re-link), §6 step 4, §7 (free cap)
Audience: **teacher** (school admin reaches it per class, read-only)

## Scenario (Given-When-Then)

Given: a teacher opens their class on Sunday afternoon, students have been practicing at home during the week
When: the roster loads
Then: they see the join code, one class roll-up, and one summary card per student sorted by most-recent activity — enough to know who is ready for today, who hasn't synced, and what to plan next; never a raw quest history, never a ranking

## Screen goal

"Show the class at a glance from `summary_json` and route the teacher to plan / approve / settings."

## Box diagram

```
+------------------------------------------------------------+
| [< back to home]   Sunday Class A - 12 students   [ Settings ] |  -> console/space-settings
|                                                            |
|  Join code  K7M2X9   expires in 18 days   [ copy ] [ regenerate ] |
|                                                            |
|  +------------------------------------------------------+  |
|  | Free plan: 12 / 20 students (placeholder cap)   [ Upgrade ] |  <- only when >= 80% of cap
|  +------------------------------------------------------+  |  -> console/billing
|                                                            |
|  This week (whole class)                                   |
|   o 9 of 12 practiced this week                            |
|   o Stage 1 anchor: 71% (was 67%)                          |  <- delta always paired
|   o Jamo to revisit together: [b][s]                       |  <- invitation framing
|   o 3 students haven't synced since Tue (1 line)           |  <- summary.lastActiveAt
|                                                            |
|  [[ PLAN THIS WEEK ]]        [ 1 re-link request ]         |  -> console/plan-builder / console/relink-approval
|                                                            |
|  Students (most recent activity first)                     |
|  +------------------------------------------------------+  |
|  | [avatar] Minho        Stage 1 - Ch 2     today       |  |
|  |  quests  [####....] 7 / 11    plan "Week 3"  2 / 3   |  |  <- summary.stage1 / planProgress
|  |  38 min this week   revisit: [b]        [ rescue code ] |  |
|  +------------------------------------------------------+  |
|  | [avatar] Suji         Stage 1 - Ch 1     Tue         |  |
|  |  quests  [##......] 3 / 11    plan "Week 3"  0 / 3   |  |
|  |  12 min this week   not synced since Tue             |  |  <- hint, no color warning
|  +------------------------------------------------------+  |
|  | ... one card per student ...                          |  |
+------------------------------------------------------------+
```

- Card tap → `parent/learner-detail` in read-only mode (same component, summary fields only, no recent-quest list).
- Anonymize mode (space setting) swaps names for nicknames / initials on every card and in the roll-up.
- Banned on this tree: sort by accuracy, per-student percentile, schedule-pressure wording from the F-PAR-001 §3.6 banned list (F-TCH-001 §3.2).

## Interaction points

- [ regenerate ] → confirm sheet ("the old code stops working") → `POST /spaces/:id/code`; new code replaces inline
- [ copy ] → clipboard
- [[ PLAN THIS WEEK ]] → `console/plan-builder` (class preselected)
- [ 1 re-link request ] → `console/relink-approval` (badge count from pending requests; hidden at 0)
- [ Upgrade ] → `console/billing` (teacher_pro)
- [ Settings ] → `console/space-settings`
- Student card tap → `parent/learner-detail` (read-only)
- [ rescue code ] on a card → in-place sheet showing that learner's Rescue Code (roadmap §5.1 — not progress data, so allowed on a teacher surface)
- [< back to home] → `console/home` (from a school: `console/school-admin`)

## Navigation graph

Enter from: `console/home` (class row) · `console/school-admin` (class in tree) · `console/onboarding-role` (teacher path step 3) · `console/plan-builder` / `console/relink-approval` / `console/space-settings` (back)
Exit to:    `console/plan-builder` · `console/relink-approval` · `console/space-settings` · `parent/learner-detail` · `console/billing` · `console/home` · `console/school-admin`

## States

- **success**: as above.
- **empty** (no students yet): roll-up and cards replaced by one large join-code panel + "write it on the board; students join from Profile Picker > Join a class" (2 lines) + [ regenerate ]. Plan CTA still available (a plan can be drafted before anyone joins).
- **partial / not synced**: cards whose `lastActiveAt` predates the latest published plan show the "not synced since" line; roll-up counts them. No red, no exclamation.
- **cap reached** (free, placeholder 20/20): banner becomes persistent; join attempts beyond the cap are refused server-side and the student app shows "ask your teacher" (roadmap §7).
- **error** (roster fetch fails): header + join code still render from cache; card area shows "can't load the class yet" + [ TRY AGAIN ].

## Data needs

- reads: `GET /spaces/:id/roster` → learners (display_name, avatar, age_group) + `summary_json` per learner — **never** `payload_json` (roadmap §3.1) · latest published plan (title, item count) for the planProgress label · pending re-link requests count · space `join_code`, `join_code_expires_at`, `settings_json.anonymize_roster` · membership count vs cap
- writes: `POST /spaces/:id/code` (regenerate) · telemetry `console_roster_viewed{students, notSynced}`, `console_join_code_regenerated`
- roll-up is computed client-side from the summaries (pure function, `logic/` 100% coverage)

## Open questions

- Teacher free cap: 20 (roadmap §7) vs 30 (roadmap §11 Q4) — **deferred**; the banner threshold is a placeholder.
- F-TCH-001 §3.2 shows "class avg time-on-app" in the roll-up; F-PAR-001 §3.2 bans class averages on the *parent* card. Keep the average here (teacher, whole-class) but never pass it into the shared `parent/learner-detail` component — confirm when F-TCH-001 is promoted to `ready`.
- Should "not synced since" be per card, roll-up only, or both? Default both; measure whether teachers act on it in the pilot.
- F-TCH-001 §5 names `design/wireframes/teacher/roster.md`; app map v1 moved it to `console/roster` — update the spec's §5 paths when promoting.
