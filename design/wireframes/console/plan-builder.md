# Console/Plan-builder — pick, order, pace, publish a plan (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §2 (`plans`), §3.3 (`summary.planProgress`), §4 (plan → homework derived on device), §6 step 3–4 · `docs/specs/F-TCH-001-teacher-classroom.md` §3.3, §3.5 · `docs/specs/F-HW-001-homework-page.md` §3.4 (1 explicit assignment / day, gating) · `docs/specs/F-PAR-001-parent-dashboard.md` §3.6
Code (F-PLAN-001, 2026-09-21): `apps/web/src/app/teach/space/[id]/plan/page.tsx` — builder (catalog · ordered items with ↑↓× · date/note · Spread dates · everyone/only · Publish / Save draft) and the published readout (Edit · Archive · New plan · per-learner done / total · not ready yet · last active). Not drawn-as-shipped: drag handle (buttons instead), gating warning (Stage 1 only for now; since LV-3a the builder lists only the stages the space opens, panels G and H below), "send to ready learners only", daily-test / story items, learner-detail tap.
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
Exit to:    `console/roster` · `parent/dashboard` · `parent/learner-detail` · `console/billing` (dimmed premium item tap → parent path only; teachers see "group_license")

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

---

## F-PLAN-002: week groups, plan switcher, readout and re-pace (promoted in P2-8)

Promoted from `console/curriculum-planner.md` E and F, drawn as P2-6 shipped (`apps/web/src/app/(console)/teach/space/plan/page.tsx`, `apps/web/src/components/console/RoutePlanParts.tsx`, `lib/console/plans.ts`, `lib/console/curriculum.ts`). A plan with `meta` (made by `console/curriculum-wizard.md`) reads as a route; a classic plan keeps the screen above.

E. Draft with week groups and the plan switcher

```
┌────────────────────────────────────────────────────────────────┐
│ ← Back to <space>                                               │
│ Plan: "Route · 12 weeks"                    draft - [[ PUBLISH PLAN ]] │
│ Plans: [Route · 12 weeks (active)] [Week 3] [Draft]   [ + New ] │  <- switcher: active route first
│ Week 1 · Oct 15 – Oct 21 · Learn                                │
│   1. <quest title>   Thu Oct 15  [date] [note] [^][v][x]        │
│   2. <quest title>   Sat Oct 17  [date] [note] [^][v][x]        │
│ Week 4 · Nov 5 – Nov 11 · Review   No items: a week to catch up or replay. │
│ Week 6 · Nov 19 – Nov 25 · Days off   Days off: no sessions this week.     │
│ Not in a week yet   (items added by hand)                       │
│ Who is this for:  (o) everyone   ( ) only: [ ] Minho [ ] Suji   │
│ [ Save draft ]  [ Archive ]                                     │
└────────────────────────────────────────────────────────────────┘
```

- Items keep the existing controls. **Spread dates** is hidden for a route (dates come from the calendar); editing one date is allowed. A coming-soon item shows its title with a "coming soon" tag.

F. Published readout and re-pace

```
│ Route · 12 weeks                         Published Oct 15       │
│ 30 items · for 1 learner                                        │
│ [ Edit ] [ Archive ] [ New plan ]                               │
│ ┌ This week (week 1) ────────────────────────────────────────┐ │
│ │ Week 1 · Oct 15 – Oct 21 · Learn                            │ │
│ │  Oct 15 · <title>   Oct 17 · <title>   Oct 20 · <title>     │ │
│ │ Most recent activity first — not a ranking.                 │ │
│ │ Minho    2 so far · 36 planned · today                      │ │  <- "so far": a device holds one week
│ │ Suji     waiting for the next sync                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ▸ All weeks (collapsed)                                         │
│ [ Re-pace from today ]  Keeps what is done and lays the rest from the next session. │
└────────────────────────────────────────────────────────────────┘
```

- No ranking, no percent, no sort by progress. **Re-pace from today** asks once with the new first date ("Re-pace from today? What is done stays done. The rest moves to the next sessions, from <date>.") and saves the same plan id, still published, so devices pick up the new dates. When no session is left before the end: "No sessions are left before the route ends. Add weeks to keep going." with **Add N weeks and re-pace**.
- A stored meta this build cannot read shows one line and a **Refresh** button instead of the readout; it never crashes.
- States: **success** as drawn; **empty** (no plans) shows **Start from a template** -> `console/curriculum-wizard`; **error** on save or re-pace: one line, the plan unchanged; **offline**: saving needs the API.
- Checked end to end by `apps/web/e2e/curriculum.spec.ts` (P2-8): draft, week groups, publish, readout, at 320 and 1280.
- **Open question (found by P2-8):** the readout lists every learner of the space even for a plan made "only" for one learner, so the other learners read "waiting for the next sync" for a plan they never receive. Default proposal: list only the plan's `targetLearnerIds` when it has them (F-PLAN-001 readout; a follow-up fix, not in P2-8).

---

## AMENDMENTS-LESSON-CHOOSER: the grouped lesson picker and the sticky bar (row LV-3a, 2026-10-17)

Spec `docs/specs/AMENDMENTS-LESSON-CHOOSER.md` (sections 4 to 6). Replaces the box diagram's left column ("Catalog (Stage 1)" with every quest open and `[ + add ]` rows) and its "locked Stage 2+ items shown dimmed" note. Mock and shots: `design/screens/app-shell/lesson-picker.md`. Code: `apps/web/src/components/console/GroupedLessonPicker.tsx`, `apps/web/src/lib/console/lesson-picker.ts`, `app/(console)/teach/space/plan/page.tsx`.

G. Builder with the grouped picker (360 wide, a class a Group License covers)

```
┌──────────────────────────────────────┐
│ ← Back to Sunflower                   │
│ New plan                              │
│ Plan title [ Week 2 words           ] │
│ Lessons                               │  <- h2 (chooser.planTitle)
│ Search lessons                        │
│ [                              ]      │  <- type="search"; title, Hangul, romanization
│ Type a title, Hangul or romanization. │  <- hint (aria-describedby)
│ (Stage 1)(Stage 2)(Stage 3)(Stage 4)  │  <- radio chips, one group at a time;
│ (Stage 5)(Stage 6)(Stage 7)           │     the chosen one has a thick border
│ Stage 2 · 18 lessons                  │  <- h3
│ [-] Word Builder                 [v]  │  <- whole-episode box, mixed: 1 of 6 chosen;
│     6 lessons · about 26 min          │     [v] shows its lessons (aria-expanded)
│   │ [x] <lesson 1>   about 5 min      │
│   │ [ ] <lesson 2>   about 4 min      │
│   │ ...                               │
│ [x] Around the House             [>]  │  <- whole episode chosen: one plan item
│     3 lessons · about 12 min          │
│ [ ] <episode>                    [>]  │
│ ...                                   │
│ Your plan (2)                         │
│  1. <lesson 1>  [date] [note] [^][v][x]│
│  2. Around the House (3 quests) ...   │
│ ...                                   │
╞══════════════════════════════════════╡  <- sticky bar (labelled region "Your choices"),
│ 2 chosen · about 17 min               │     above the home indicator; a focused row
│ [[ Publish plan ]] [ Save draft ]     │     scrolls to stop above it
└──────────────────────────────────────┘
```

H. A class no plan covers (the free-plan switch off)

```
│ Lessons                               │
│ Search lessons [                    ] │
│ (Stage 1)                             │  <- only the stages its learners can open
│ ┃ 92 lessons need Premium and are not │  <- the wizard's left-out line, word for word;
│ ┃ in the plan. See plans              │     switch on: the free plan + Open billing
│ Stage 1 · 15 lessons                  │     (owner), neutral words (anyone else)
│ [ ] Meet the Letters             [>]  │
```

- **Search** (any text): the chips hide, every matching group shows under its heading with only its matching lessons drawn, and a polite status says "4 matches" or "Nothing matches. Try another word, or type it in Hangul.". A press still acts on the whole episode. **Clear** empties the field and keeps focus in it.
- **Ticking a partly chosen episode** on a plan adds its missing lessons next to the chosen ones; the chosen lesson items keep their dates and notes. **Unticking one lesson of a whole episode** puts the other lessons at its place, each with the episode's date, week and note.
- **Full** (a classic plan holds 30 items, a route 260): a box that would add more is off, and "This is full. Remove something to add more." shows. A chosen lesson whose untick would add the episode's other lessons is off too. Removing is never off.
- **States**: loading: Stage 1 only, no line (the entitlement list is not read yet); a stored draft opens on the stage of its first item; error: the page's own error line; a search with no hit: the no-match line.
- Checked by `apps/web/e2e/lesson-picker.spec.ts` (360 covered and uncovered, 1280, 320 with 200 % text) and `plan-builder-wiring.test.tsx`.
