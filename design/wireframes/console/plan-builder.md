# Console/Plan-builder — pick, order, pace, publish a plan (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §2 (`plans`), §3.3 (`summary.planProgress`), §4 (plan → homework derived on device), §6 step 3–4 · `docs/specs/F-TCH-001-teacher-classroom.md` §3.3, §3.5 · `docs/specs/F-HW-001-homework-page.md` §3.4 (1 explicit assignment / day, gating) · `docs/specs/F-PAR-001-parent-dashboard.md` §3.6
Code (F-PLAN-001, 2026-09-21): `apps/web/src/app/teach/space/[id]/plan/page.tsx` — builder (catalog · ordered items with ↑↓× · date/note · Spread dates · everyone/only · Publish / Save draft) and the published readout (Edit · Archive · New plan · per-learner done / total · not ready yet · last active). Not drawn-as-shipped: drag handle (buttons instead), gating warning (Stage 1 only for now), "send to ready learners only", daily-test / story items, learner-detail tap.
Audience: **teacher** (class space) · **parent** (family space) — same screen, space kind sets the wording ("students" / "kids")

## Scenario (Given-When-Then)

Given: a teacher (or parent) wants next week's learning laid out before Sunday's class
When: they open the plan builder for a space
Then: they pick episodes / quests from the catalog, set an order and target dates (or let "Pace" spread them), choose who it's for, and publish — then later read how far each learner got, without any ranking

## Screen goal

"Turn a few catalog picks into one published plan the learner app can derive homework from."

## Box diagram

```
+------------------------------------------------------------------+
| [< back]   Plan: "Week 3"  (title field)      draft - [ Publish ] |  <- status chip
|                                                                  |
|  Catalog (Stage 1)              |  Your plan (ordered)            |
|  +----------------------------+ |  +----------------------------+ |
|  | > Episode 1.A1  [ + add ]  | |  | 1. Quest 1.A1.2  Sun Sep 21 | |  <- row: drag handle,
|  |    Quest 1.A1.1  [ + add ] | |  | 2. Quest 1.A1.3  Wed Sep 24 | |     target date field,
|  |    Quest 1.A1.2  [ added ] | |  | 3. Episode 1.A2  Sun Sep 28 | |     [ x ] remove
|  | > Episode 1.A2  [ + add ]  | |  |    1 line note (optional)   | |
|  | > Daily test    [ + add ]  | |  +----------------------------+ |
|  | > Story pack    [ + add ]  | |                                 |
|  +----------------------------+ |  Pace helper                    |
|                                 |   start [ date ]  cadence [ 2 / week ] |
|  (locked Stage 2+ items shown   |   [ Spread dates ]              |  <- fills targetDate top-down
|   dimmed with "needs premium")  |                                 |
|                                 |  Who is this for                |
|                                 |   (o) everyone in this space    |
|                                 |   ( ) only: [ ] Minho [ ] Suji  |  <- target_learner_ids
|                                 |                                 |
|                                 |  +----------------------------+ |
|                                 |  | 2 learners haven't reached  | |  <- gating warning
|                                 |  | item 3 yet. They'll get it  | |     (F-TCH-001 sec 3.3)
|                                 |  | when they unlock it.        | |
|                                 |  | [ send to ready learners only ] | |
|                                 |  +----------------------------+ |
|                                 |                                 |
|                                 |  [[ PUBLISH PLAN ]]  [ Save draft ] |
+------------------------------------------------------------------+

Published readout (same screen, plan published):
+------------------------------------------------------------------+
| [< back]   Plan: "Week 3"   published Sep 20   [ Edit ] [ Archive ] |
|  Progress (most recent activity first - not a ranking)           |
|   Minho   [##.]  2 / 3     today                                 |  <- summary.planProgress[planId]
|   Suji    [...]  0 / 3     not synced since Tue                  |
|   ...                                                            |
+------------------------------------------------------------------+
```

- Primary CTA is [[ PUBLISH PLAN ]]; draft save is secondary. A draft never reaches a learner (`published_at` null).
- Pace helper never places two items on the same date for the same learner (F-HW-001 §3.4 cap: 1 explicit / day per source); if manual dates collide, an inline "one per day — the second moves to the next day" line shows.
- Anti-shame: the readout shows done / total and freshness; no percent, no sort by completion, no schedule-pressure wording (F-PAR-001 §3.6 banned list).

## Interaction points

- [ + add ] → appends to the plan with `targetDate` empty · drag handle → reorder · date field → per-item `targetDate` · [ x ] → remove
- [ Spread dates ] → pure function (start, cadence, item count) → fills all empty / all dates (confirm if overwriting)
- "only:" learner checkboxes → `target_learner_ids_json`; "everyone" → null
- Gating warning appears when any targeted learner's `summary.stage1` cursor is before an item (client check from summaries); [ send to ready learners only ] narrows `target_learner_ids` in one tap
- [[ PUBLISH PLAN ]] → `PUT /spaces/:id/plans` with `published_at` → readout view; learner devices derive `HomeworkAssignment` on next sync (roadmap §4)
- [ Save draft ] → same route without `published_at`
- [ Edit ] (published) → back to builder; re-publish bumps `updated_at` so inboxes re-fetch · [ Archive ] → `archived_at`
- Readout row tap → `parent/learner-detail` (read-only for teachers)
- [< back] → `console/roster` (class) · `parent/dashboard` (family)

## Navigation graph

Enter from: `console/roster` [[ PLAN THIS WEEK ]] · `parent/dashboard` "Send homework" / `parent/learner-detail` "+ Assign a quest" (the web mock's placeholder button) · `console/home` (class row when a draft exists)
Exit to:    `console/roster` · `parent/dashboard` · `parent/learner-detail` · `console/billing` (dimmed premium item tap → parent path only; teachers see "teacher_pro")

## States

- **success**: builder (draft) or readout (published).
- **empty** (no plan for this space yet): right column shows 2 suggested starters ("Start with Episode 1.A1", "This week's daily tests") as [ + add ] rows — suggestion, not auto-fill (choose → recommend).
- **gating warning**: block shown above; publishing is still allowed (learners receive items as they unlock — roadmap §4 derives locally; see Open questions for the spec conflict).
- **error**: publish / save fails → stay in builder, inline "didn't save" + [ TRY AGAIN ]; local draft kept in memory. Catalog load fails → left column "can't load the catalog" + [ TRY AGAIN ], plan column still editable.
- **stale content**: a learner's app is older than an item's content id → readout row note "update the app to see this" (roadmap §4).

## Data needs

- reads: content catalog (bundle, `CONTENT_VERSION`: episodes → quests, daily test, story packs) · space learners + `summary_json` (stage1 cursor for gating; `planProgress` for the readout; `lastActiveAt` for sort / sync hint) · existing `plans` for the space
- writes: `PUT /spaces/:id/plans` (title, `items_json` ordered `{episodeId|questId, targetDate, note?}`, `target_learner_ids_json`, `published_at`) · archive
- pure logic (100% coverage): `spreadDates(start, cadence, n)`, `gatingCheck(items, summaries)`, `oneExplicitPerDay(items)`
- telemetry: `console_plan_saved{kind, items, draft}`, `console_plan_published{kind, items, targeted}`, `console_plan_gating_shown`

## Open questions

- **Gating conflict**: F-HW-001 §3.4 says the create call fails fast for a locked target; F-TCH-001 §3.3 says silently skip + footnote; roadmap §4 stores the plan and derives on device (no fail at all). This wireframe follows the roadmap (warn, allow) — needs one ruling before F-PLAN-001.
- Cap stacking: F-TCH-001 §3.5 lets teacher 1 + parent 1 per day; should the parent builder show "your teacher already planned Sunday"? Would leak class data into the family — default no.
- Family builder: does "Send homework" belong on `parent/dashboard` (per card) or only here? Default: dashboard card link opens this screen with that learner preselected.
- Templates / worksheet PDF (F-TCH-002 / 003) are out of scope; leave room in the top bar.
