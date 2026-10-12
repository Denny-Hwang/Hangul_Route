Status: ready

# F-REPORT-001 — Progress reports: a per-learner dashboard for parents and teachers, day / week / month / all-time reports, "went well" and "practice next", and class statistics without ranking

> **Status note.** `ready` means: every section below is decided, every owner question in section 9 has a default that applies until the owner answers, and no review blocker remains. An owner decision gates only the PRs named next to it, never the whole spec. Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` below is at that commit.
>
> **Binding rules applied.** Owner request 2026-10-11, items 4 and 6 (with 7, 8, 11 and 14 handled by the sibling specs listed in section 7). CLAUDE.md section 1: any age (no age wording), child safety (sign-in or parent gate, no ads, local-first, consent before data reaches an account), anti-shame (no public ranking of children, no learner-vs-learner comparison, meters only fill, no red-X). Owner decision 2026-10-10: **reading, listening and writing only**: nothing in this feature shows, counts or mentions speaking (the level check's `oralStage` is never rendered). UI strings come from `packages/i18n` (English source; Korean and Spanish overlays stay empty until native review). Design tokens only. No emoji.

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a wireframe and a design mock)**

| Can start when | PR | Waits for | Why |
|---|---|---|---|
| now | RP-0 docs | — | this spec, the four wireframes, the telemetry rows |
| after RP-0 | RP-1 schemas, RP-2a windows + learner report, RP-6 strings | RP-0 merged | new files only |
| after RP-1 | RP-W Worker (preserve rule, roster projection, consent line, server event), RP-2b insights, RP-2c class report | RP-1 merged | they import the schemas |
| after RP-W is **deployed** | RP-3a quest latch writer, RP-4 activity summary | the Worker keeps `questDoneAt` and `summary.activity` | zod strips unknown keys (`schemas/sync.ts:16`); an old Worker would drop both |
| after RP-0 | RP-3b session coverage | — | independent of the schema |
| after RP-2a, RP-2c, RP-W deployed | RP-5 report endpoints | — | the endpoints call the pure module |
| after the design pass (`design/screens/reports/`) and RP-5 deployed | RP-7a learner report page, then RP-8 class report page (after RP-7b) | design mock of the report blocks | "no component without a mock" |
| after RP-7a | RP-7b all-time growth line + print stylesheet, RP-10 plan prefill action | — | |
| after RP-2a, RP-2b, RP-4, RP-6 and the design pass | RP-9 in-app report (learner app, behind the grown-up gate) | — | |
| last | RP-11 e2e + flag flip | es / ko string review (else flip for `en` only) | |

**Scope**: `packages/content-schema` (new `schemas/report.ts`; new `reports/` pure module; `ProgressSummary.activity`; `ProgressSnapshot.questDoneAt`; one telemetry name) · `packages/backend` (`ADDITIVE_FIELDS` entry, `activity` projection on the roster allow-list, one consent item sentence, new `routes/space-reports.ts`, a server-side telemetry helper) · `apps/mobile` (`logic/reports/activity.ts`; quest latch writer and merge; sessions for stories, stand-alone games and the level check; `sync-store` passes `activity` into `summarize`; the in-app report screen behind the grown-up gate) · `apps/web` (two console pages, report view helpers, API client, route constants, entries on the roster, print stylesheet, flag) · `packages/i18n` (new `report` namespace; `a11y.report`)
**Owner**: solo dev
**Rollout**: console flag `NEXT_PUBLIC_REPORTS_ENABLED` and learner-app flag `EXPO_PUBLIC_REPORTS_ENABLED`, both default **off**, flipped in RP-11. Data PRs (RP-3a, RP-3b, RP-4) run with the flags off so history builds up before anyone sees a report. The Worker endpoints are always on (they are permission-checked and read only allow-listed data).
**Wireframes** (drafted with this spec, `design/wireframes/reports/`): `learner-report.md` (the per-learner dashboard and report on the console: parent and teacher variants, four periods, every state) · `class-report.md` (class statistics) · `in-app-report.md` (learner app, behind the grown-up gate) · `print.md` (the printed / saved-as-PDF page).

Parent / siblings: CLAUDE.md section 1 · F-SYNC-001 section 3.4 (the summary is the only column grown-ups read) · F-SPACE-002 T-1a (the roster allow-list is tied to the consent text) · F-TCH-001 sections 3.2 and 3.6 (no ranking; aggregates only; the learner detail page deferred in section 10.4 is delivered here) · F-PAR-001 (draft; its digest, section 3.2, and its suggestion engine, section 3.3, are **superseded** by this spec; its voice message, section 3.4, belongs to the feedback-channel sibling) · F-ROUTE-001 (journey summary, skills stay local OD-11, section 3.12 hard rules) · F-PLC-001 section 3.8 (placement summary) · F-VOC-005 section 3.8 and P-4 (word counts reach grown-ups only with their consent item) · F-RVW-001 (draft; review results join later) · F-PLAN-001 / F-PLAN-002 (plan progress, self-route) · F-CONSOLE-001 (static export, `?id=` addressing) · F-I18N-001 (messages, length budget, banned words)

---

## 1. Context

The owner asked (2026-10-11): a parent sees **a dashboard of their child's learning progress** with **daily, weekly, monthly and all-time reports** and an analysis of **what went well and what needs work** (item 4); a teacher sees the same **per student** for their class, **plus class-wide statistics and reports** (item 6).

Facts, verified on `origin/main` `ea9049e4`:

1. **What grown-ups can read today is one overwritten summary per learner.** The device computes `ProgressSummary` (`apps/mobile/src/logic/sync/summarize.ts:91-140`) and uploads it with the snapshot; D1 keeps one row per learner (`apps/api/migrations/0002_schema_v2.sql:32`, `summary_json`). Rosters project it to the allow-list `TEACHER_VISIBLE_SUMMARY_KEYS` (`packages/content-schema/src/schemas/transfer-consent.ts:115-126`, `packages/backend/src/lib/roster-summary.ts`). There is **no history**: the only time figures are `minutesLast7d` and `streakDays`, so no server can answer "this month" or "last week".
2. **The device holds enough to build history**, with two gaps. `sessions[]` is unbounded and unioned on merge (minutes and practice days by day: exact). `cards[].unlockedAt` dates every card. `stageDoneAt` dates stage completions. But a quest keeps only its best run: `completedAt` is the **latest** finish (`apps/mobile/src/logic/quest-progress.ts`), so "quests finished this week" cannot be told from "quests replayed this week". And sessions are recorded only by the quest player (`QuestPlayerScreen.tsx:76-77`), so story, stand-alone game and level-check time is missing.
3. **Accounts never read the full snapshot.** `GET /api/sync/learners/:id/snapshot` is device-only (`packages/backend/src/routes/sync.ts:90`). `can.ts:38` grants family caregivers `snapshot.read`, but no account route uses it, and roadmap section 3.1 keeps it that way.
4. **Adult surfaces today.** The web `/parent` pages are a demo on mock data (`apps/web/src/data/mock-family.ts`). The real family and class view is the roster at `/teach/space?id=` with a "This week" roll-up computed client-side (`apps/web/src/lib/console/rollup.ts:24`). There is no per-student page (F-TCH-001 section 10.4, deferred). The in-app grown-up dashboard (`apps/mobile/src/screens/parent/ParentDashboardScreen.tsx`) shows lifetime totals for local profiles only.
5. **Strength and need signals that exist**: `jamoRecognized` and `needsPractice` (best quest accuracy per taught letter, thresholds 0.8 / 0.6, `summarize.ts:86-87`, topped up with level-check priority symbols); placement strand statuses (`secure`, `getting-there`, `not-yet`, `not-tested`, `schemas/placement.ts:22`); `journey` stage states; `planProgress`; `selfRoute` counts (family only); `vocab` (schema ready, never filled, hidden from every roster until F-VOC-005 P-4); `reviews[]` (schema only, F-RVW-001 draft, always empty).
6. **The console has no telemetry client** (`docs/roadmap/TELEMETRY-NAMES-2.md` section K); the learner app sends through `track()` with an offline queue.

### 1.1 What this spec adds, in one paragraph

The device adds a small, bounded **activity summary** (35 local days, 24 months, all-time totals, stage milestones) to the summary it already uploads. One **pure report module** in `packages/content-schema/src/reports/` turns a summary into a report for a period (figures, a calendar, letters, milestones, plan progress, up to three "went well" and three "practice next" lines) and turns a class's summaries into **aggregate-only class statistics**. Two additive Worker routes serve one learner's report and one class's aggregates. Two console pages and one learner-app screen render them; a print stylesheet makes every report printable. No new D1 table, no migration, no new data leaves the device beyond counts per day.

## 2. User stories

- As a **parent**, I open my child's report once a week and learn in under a minute: did they practice, what did they learn, what is a good next step. I can switch to today, this month or everything so far.
- As a **teacher**, I open one student's report before a parent meeting and print it.
- As a **teacher**, I open my class report on Sunday evening to see how the week went for the class as a whole and which letters to revisit together, without any list that orders my students.
- As a **parent who shares one device** with my child and has no account, I open the same report from the grown-up area of the app.
- As a **learner**, I never see any of this, and nothing I do in the app changes because a grown-up looked at a report.

## 3. Acceptance criteria

### 3.1 Surfaces and entries

| Surface | Who | Route / screen | Entry points |
|---|---|---|---|
| **Learner report** (the per-learner dashboard and its reports) | family caregiver or owner of a family space; teacher or owner of a class; a school admin over that class (read-only, same rule as the roster, OD-14) | console `ROUTES.learnerReport(spaceId, learnerId, period?)` = `/teach/space/learner?id=<spaceId>&learner=<learnerId>&period=<p>` | roster card "See report" (`app/(console)/teach/space/page.tsx`, class and family spaces); console home family row "Reports" -> the family roster, where each learner card has "See report" (the home page keeps its counts-only contract, `teach/home/page.tsx`, so it never needs learner ids) |
| **Class report** (class statistics) | teacher or owner of a class; school admin over it | `ROUTES.classReport(spaceId, period?)` = `/teach/space/report?id=<spaceId>&period=<p>` | roster "This week" roll-up block, link "Class report" (class spaces only) |
| **In-app report** | the grown-up on a shared device, after the grown-up gate | learner-app stack screen `LearnerReport { profileId }` (`GrownUpDestination` gains `'LearnerReport'`) | each profile card on `ParentDashboardScreen` gains "See report" |
| **Print** | same as the page printed | the learner report or class report with the print stylesheet | "Print or save as PDF" button on both console pages |

- Addressing follows F-CONSOLE-001 section 3.6: a static export, so ids ride in the query. **No learner name ever appears in a URL**; `learnerId` is the opaque `profile:` id the roster already carries (`TEACHER_ROSTER_ADDRESS_FIELDS`, `transfer-consent.ts`).
- `period` is one of `day`, `week`, `month`, `all`; anything else reads as `week` (the default).
- **Host.** These are console pages. Where the console is served (today hangulroute.com; the owner wants all signed-in adult screens on app.hangulroute.com, item 3 and 12) is decided by the domain-split and persona app-shell siblings (section 7). This spec does not depend on the host: it adds route constants to `ROUTES` (`apps/web/src/lib/console/routing.ts`), and the shell sibling may add navigation entries that point at them. If the shell sibling moves adult screens into the learner app instead, the pure module (section 3.4) renders there unchanged.
- **Flags.** With `NEXT_PUBLIC_REPORTS_ENABLED` off, the entries are not rendered and the two pages render the "not available yet" state with a link back to the roster. With `EXPO_PUBLIC_REPORTS_ENABLED` off, the dashboard has no "See report" button and the screen is not registered.

### 3.2 Periods and days

All dates in a report are **the learner's local calendar days**, as the learner's device saw them.

| Period | Window (learner-local) | "Previous window" for the up-only line | Data |
|---|---|---|---|
| `day` | today | none (no comparison on a single day) | `activity.days` |
| `week` (default) | the last 7 days, today included (rolling, OD-1) | the 7 days before | `activity.days` (35 days cover both) |
| `month` | the calendar month to date (OD-2) | the whole previous calendar month, shown only when this month already exceeds it ("more than all of last month") | `activity.days` for this month; `activity.months` for the previous one |
| `all` | from the first active day to today | none | `activity.total`, `activity.months`, `activity.milestones` |

- **Today for a viewer** is computed from the viewer's clock and the learner's offset: `todayFor(now, activity.tz)` (`reports/windows.ts`). The device records `tz` (minutes east of UTC, `-new Date().getTimezoneOffset()`) each time it computes the summary. Event days themselves are taken from the device's local calendar at computation time, so DST is handled by the device; only "today" for a remote viewer uses the stored offset (off by at most one hour at a DST edge, documented, not corrected).
- **Streak is unchanged.** `streakDays` keeps its UTC-day rule (`progress-store.ts` `nextStreak`); reports show it only as the encouraging "days in a row" line (W9, section 3.6). Aligning the streak to local days is out of scope (OD-12).
- **A practice day** is a local day with any of: minutes > 0, a quest finished for the first time, a card collected, a word met for the first time. An empty day is **neutral**: it is drawn as an empty dot and never labelled.

### 3.3 The activity summary (device-computed, additive, bounded)

**3.3.1 Snapshot: the quest latch.** One additive record, the twin of `stageDoneAt`:

```ts
// packages/content-schema/src/schemas/progress.ts — ProgressSnapshotSchema gains:
/**
 * Quest latch (F-REPORT-001 section 3.3.1): quest id -> ISO time the quest was
 * first completed. Only ever gains keys; the earliest instant wins on merge.
 * Absent in snapshots written before it; readers treat a missing value as {}.
 */
questDoneAt: z.record(z.string(), z.string()).optional(),
```

- **Writer** (`apps/mobile/src/store/progress-store.ts`, RP-3a): when a quest first gets `completedAt`, write `questDoneAt[questId] = new Date().toISOString()` if absent. **Backfill once** on hydrate: every completed quest without an entry gets its current `completedAt` (an approximation for history before RP-3a, biased late, documented in section 8 as M5; it is written so the day never moves again when the quest is replayed).
- **Merge** (`apps/mobile/src/logic/sync/merge.ts`): union by key, earliest instant wins, same comparator as `mergeStageDoneAt` (`merge.ts:112`).
- **Worker preserve rule** (`packages/backend/src/lib/additive-fields.ts`, RP-W): a new entry `QUEST_DONE_AT { payloadKey: 'questDoneAt', summaryKey: 'activity', isUnset: undefined or empty record, merge: union with earlierLatchTime }` appended to `ADDITIVE_FIELDS`. An old build that re-uploads without the field keeps the stored latch **and** the stored `summary.activity`.

**3.3.2 Sessions everywhere a learner practices** (RP-3b). `beginSession` / `endSession` (`progress-store.ts:413-470`) are also called by `StoryReaderScreen` (`apps/mobile/src/screens/story/StoryReaderScreen.tsx`), the stand-alone `Minigame` screen (`apps/mobile/src/screens/minigames/`) and the level check (`apps/mobile/src/screens/placement/PlacementScreen.tsx`), with the same mount / unmount pattern as `QuestPlayerScreen.tsx:76-77`. A screen opened on top of the quest player (a story inside a quest) does not open a second session: `beginSession` now returns the id of the session it opened, or `null` when the newest session has no `endedAt` and started under 2 hours ago (it joins that one); `endSession(profileId, sessionId)` ends only the session with that id, and a caller that received `null` does nothing on unmount. So the outer screen's session keeps running until the outer screen closes. The existing quest-player call passes the id it received; the old one-argument form is removed in the same PR. Vocabulary rounds (F-VOC-003, not built) call the same pair when they ship; that spec's PR carries the call. A session with no `durationSeconds` (app killed) counts as a practice day with 0 minutes.

**3.3.3 The wire field.**

```ts
// packages/content-schema/src/schemas/report.ts
export const REPORT_DAYS_MAX = 35;        // this week + last week + the calendar month to date
export const REPORT_MONTHS_MAX = 24;
export const REPORT_MILESTONES_MAX = 16;
export const REPORT_DAY_LETTERS_MAX = 12;
const COUNT_MAX = 100_000;
const DayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MonthKeySchema = z.string().regex(/^\d{4}-\d{2}$/);
const Count = z.number().int().nonnegative().max(COUNT_MAX);

export const ActivityDaySchema = z.object({
  d: DayKeySchema,
  min: Count,                                  // minutes: round(sum of session seconds started that day / 60)
  q: Count,                                    // quests finished for the first time that day (questDoneAt)
  c: Count,                                    // cards collected that day (cards[].unlockedAt)
  w: Count,                                    // words met for the first time that day (vocab item `first`); 0 until F-VOC-005 writes the slice
  j: z.array(z.string().max(16)).max(REPORT_DAY_LETTERS_MAX), // letters that first showed as strong that day (3.3.4)
});
export const ActivityMonthSchema = z.object({
  m: MonthKeySchema, min: Count, q: Count, c: Count, w: Count,
  days: z.number().int().nonnegative().max(31), // practice days in that month
});
export const ActivitySummarySchema = z.object({
  v: z.literal(1),
  tz: z.number().int().min(-840).max(840),    // minutes east of UTC when computed
  asOf: DayKeySchema,                          // the device's local today when computed
  days: z.array(ActivityDaySchema).max(REPORT_DAYS_MAX),       // only days with activity, ascending
  months: z.array(ActivityMonthSchema).max(REPORT_MONTHS_MAX), // only months with activity, ascending, newest 24
  total: z.object({ since: DayKeySchema.nullable(), min: Count, q: Count, c: Count, w: Count, days: Count }),
  milestones: z.array(z.object({ stage: z.string().max(32), on: DayKeySchema })).max(REPORT_MILESTONES_MAX),
});
export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;

// packages/content-schema/src/schemas/sync.ts — ProgressSummarySchema gains (schemaVersion stays 1):
activity: ActivitySummarySchema.optional().catch(undefined),
```

- **Tolerant**: a malformed or oversized `activity` is dropped, never a 422 (the pattern of `journey`, `sync.ts:43-48`). Backend test: "malformed activity: PUT still 200, activity dropped".
- **Size**: at most about 4 KB (35 day rows with up to 12 short letter keys each; typical well under 1.5 KB). The bounds stop a tampered client from growing every roster that copies it.
- **Totals are exact and monotonic**: `total` is computed from the whole snapshot (all sessions, all latched quests, all cards, all words), not from the bounded arrays. `total.q`, `total.c`, `total.w` and `total.days` never decrease (property test); `total.min` never decreases because sessions are append-only and unioned.

**3.3.4 How the device computes it** (`apps/mobile/src/logic/reports/activity.ts`, pure, 100 % covered, RP-4): `buildActivity({ snapshot, now, questJamo, localDay })` where `localDay(iso)` is the device's calendar day of an instant (injected for tests).

1. Minutes and practice days: each session's `startedAt` -> `localDay`; seconds summed per day, then rounded to minutes per day.
2. `q`: each `questDoneAt` value -> `localDay`.
3. `c`: each `cards[].unlockedAt` -> `localDay`.
4. `w`: each vocab item's `first` (already a local day key, F-VOC-005) when the slice exists.
5. `j` (letters that became strong): for each letter in `questJamo`, the earliest `questDoneAt` among completed quests that teach it and whose best accuracy is at least `RECOGNIZED_ACCURACY` (0.8, `summarize.ts:86`). The day is the first finish of a quest in which the letter is **now** strong (the best run may be a later replay; documented approximation). A letter appears on at most one day.
6. `milestones`: each `stageDoneAt` entry -> `{ stage, on: localDay }`, ascending by day.
7. `days` keeps the newest 35 local days **ending at `asOf`** that have activity; `months` keeps the newest 24 months with activity; both ascending.

`store/sync-store.ts` computes it next to `journey` and passes it into `summarize` as an input (`SummarizeInput.activity`), so `summarize.ts` stays pure (the F-ROUTE-001 R-8 pattern). The in-app report (section 3.9) calls the same function on the local snapshot.

### 3.4 The pure report module (`packages/content-schema/src/reports/`, 100 % covered)

One module, imported by the Worker (class aggregates), the console (learner report) and the learner app (in-app report), so the three cannot disagree.

| File | Exports | PR |
|---|---|---|
| `windows.ts` | `todayFor(now, tz)`, `windowOf(period, today)` -> `{ from, to, prevFrom?, prevTo? }`, `sumDays(days, from, to)`, `practiceDaysIn(days, from, to)`, `monthOf(day)` | RP-2a |
| `learner-report.ts` | `learnerReport(input): LearnerReport` (section 3.5) | RP-2a |
| `insights.ts` | `wentWell(ctx)`, `practiceNext(ctx)`, `INSIGHT_CODES`, the rule tables of section 3.6 | RP-2b |
| `class-report.ts` | `classReport(input): ClassReport` (section 3.7) | RP-2c |
| `index.ts` | re-exports; added to `packages/content-schema/src/index.ts` (append-only shared file) | RP-2a |

Every function is pure: time comes in as `now`, the catalogue as an argument (`packages/content-schema/src/catalog`, for quest titles and the `teaches` lists), and the result is codes and numbers, never sentences. Sentences are built by the renderer from `packages/i18n` (section 3.11).

### 3.5 The learner report (per-learner dashboard)

**Input** (`LearnerReportInput`): `summary` (the projected roster summary for a console viewer, the full local summary for the in-app viewer), `viewer: 'family' | 'class' | 'device'`, `period`, `now`, `catalog`, `lastSyncedAt` (null on the device). The input type has **no field for any other learner and no class figure**; a test asserts the type's keys (section 5).

**Output** (`LearnerReport`, codes and numbers only):

1. **`state`**: `ready` (an `activity` field is present) · `legacy` (no `activity`: an app build from before RP-4) · `empty` (no summary at all, or nothing ever practiced) · `stale` (ready, but `lastSyncedAt` is more than 7 days old; figures render, with a neutral line).
2. **At a glance** (period-independent; from fields that exist today, so it renders in `legacy` state too): now on (`journey.here`), started at (`placement.level`, when a level check exists), letters strong (`jamoRecognized`, count and up to 24 letters), letters being practiced (`needsPractice`, up to 3), quests finished (`total.q`, else `stage1.questsDone`), cards collected (`total.c`, else `cardsUnlocked`), last practice (`lastActiveAt`).
3. **Headline**: one code chosen by fixed order: `stage_done` (a milestone in the window) > `practiced` (practice days > 0) > `none_yet` (no practice in the window). Params: name, days, quests.
4. **Figures** for the window: practice days, minutes, new quests, new cards, new letters (count of `j`), new words (only when the viewer may see words, section 3.10). Each figure may carry `up: true` when it grew against the previous window (week, month only). A figure that did not grow carries nothing: **no down arrow, no "less than", no red** (OD-11).
5. **Calendar**: `week` -> 7 day cells; `month` -> one cell per day to date; each `{ day, practiced: boolean, minutes }`. `day` and `all` have none.
6. **Growth** (`all` only): cumulative quests and cards per month, from `total` minus the sum of `months` (the "earlier" baseline) and then the running sum of `months`. A cumulative line **only rises** (a meter that only fills; OD-10). No per-month bars.
7. **Letters**: `strong`, `practicing`, `newInWindow` (from `days[].j`).
8. **Milestones** in the window (`all`: every milestone), with stage keys and days.
9. **Level check**: the newest result's `takenAt`, `level` and the strand statuses for `hangul-recognition`, `sound-letter`, `syllable-reading`, `vocabulary`, `sentences`. `oralStage` is never read (speaking rule). No counts, no percentages.
10. **Plan**: `class` viewer -> this class's plans from `planProgress` (already filtered to the viewing space, `roster-summary.ts`); `family` viewer -> the family space's plans plus `selfRoute` counts; `device` viewer -> every plan on the device plus the self-route. Shown as "N done" and "N ready to play"; `notReady` items are omitted, never called "locked".
11. **`wentWell`** (up to 3) and **`practiceNext`** (up to 3): section 3.6.

**Rules that hold for every viewer**

- **No percentages** on a learner report (OD-6): letters are named, strands are words ("secure", "getting there", "next to learn", "not checked yet"). `stage1.anchorAccuracy` is not rendered here (it stays on the existing roster roll-up only).
- **No comparison with anyone else**: no class figure, no "average", no position. The page fetches that learner only (section 3.8).
- **Third person, warm**: "Mina practiced on 3 days this week." The display name is the roster's (initials when the class anonymizes, `rosterName`).
- **Nothing is ever taken away**: figures for a past window never shrink when the learner keeps practicing (property test over random activity sequences: for a fixed window in the past, `days` changes only by adding).

### 3.6 "Went well" and "practice next" (rule-based, deterministic)

Each line is `{ code, params, action? }`. Rules run in table order; the first three that fire are kept; a rule fires only when its data is present (a missing `activity`, `placement`, `journey` or `vocab` silently skips it). `params` holds counts, stage keys, letter keys, strand ids and catalogue quest ids only.

**Went well**

| # | Code | Fires when (in the window) | Params | Periods |
|---|---|---|---|---|
| W1 | `stage_done` | a milestone falls in the window | `stage` | all four |
| W2 | `letters_new` | at least 1 letter in `days[].j` | `letters` (up to 5, in order learned) | all four |
| W3 | `practice_days` | practice days >= 1 (day), >= 2 (week), >= 4 (month), >= 5 (all) | `days` | all four |
| W4 | `minutes_up` | minutes > previous window's minutes, previous > 0 | `minutes` | week, month |
| W5 | `quests_new` | new quests >= 1 | `count` | all four |
| W6 | `cards_new` | new cards >= 1 | `count` | all four |
| W7 | `level_secure` | the newest level check was taken in the window and at least one strand is `secure` | `strands` (up to 2) | week, month, all |
| W8 | `plan_done` | a plan of this viewer has `done == total > 0` | `done` | all four |
| W9 | `streak` | `streakDays >= 3` | `days` | day, week |
| W10 | `words_new` | new words >= 5 (only when words are visible, section 3.10) | `count` | week, month, all |

**Practice next** (an invitation, never a warning)

| # | Code | Fires when | Params | Action |
|---|---|---|---|---|
| P0 | `rhythm` | no practice day in the window (week, month only); when it fires it is always first | — | none |
| P1 | `letters_revisit` | `needsPractice` is not empty | `letters` (up to 3); `questId` = the first catalogue grid quest whose `teaches` contains the first letter (none when no quest teaches it) | `plan` with `questId` (console viewers with `plan.write`); none on the device |
| P2 | `strand_next` | the newest level check has a strand `getting-there` (preferred) or `not-yet`, in the order hangul-recognition, sound-letter, syllable-reading, vocabulary, sentences | `strand` | none (the line carries a fixed tip per strand, section 3.11) |
| P3 | `plan_open` | `total - done > 0` for a plan of this viewer | `count` | `plan` (opens that plan in the builder) for console viewers with `plan.write` |
| P4 | `next_on_route` | `journey.here` is set | `stage` | none |
| P5 | `words_revisit` | `vocab.needsPractice` is not empty and words are visible | `words` (up to 3) | none |

- `day` keeps only W-lines plus P1 (no daily nudging).
- When a learner has fewer than 2 practice days ever, `practiceNext` holds only P4 (or nothing) and the headline uses `getting_started` (the F-PAR-001 "too little data" idea, in this spec's words).
- **Actions** never change learner data by themselves: `plan` opens the plan builder (`ROUTES.spacePlan`) with the quest pre-added as a draft item (RP-10, `&add=<questId>`); nothing is published until the grown-up publishes. The feedback-channel sibling adds a "Send a note" action to this same action slot when it ships; the content-browser sibling may add "Preview" for `questId`. Until they ship, those actions do not render.
- Review-test lines (F-RVW-001) join later as W- and P-rows in a follow-up amendment, once `reviews[]` is written; until then nothing reads it.

### 3.7 Class statistics (teacher; aggregates only)

**Input** (`ClassReportInput`): the class's projected summaries (no ids, no names: the Worker passes summaries only), the class's plans `{ id, title, archivedAt }`, `period`, `now`.

**Output** (`ClassReport`, `v: 1`), every number an aggregate:

| Block | Content | Rule |
|---|---|---|
| Class | `learners` (members), `withActivity` (summaries with `activity`), `olderApp` (summaries without it), `notSaved7d` (`lastSyncedAt` older than 7 days) | `olderApp` gets one neutral line, "N learners have an older app: their day-by-day figures appear after an update" |
| Practice | `practiced` (learners with >= 1 practice day in each learner's own window); `dayBands` — week: `0`, `1-2`, `3-4`, `5-7`; month: `0`, `1-4`, `5-9`, `10+`; day: practiced / not yet; all: omitted | the `0` band is labelled "Not yet" and never highlighted |
| Time | `minutesTotal`; `minutesMedian` over learners who practiced, **null when fewer than 3 practiced** | no mean per learner, no maximum, no minimum |
| Learning | `questsNew`, `cardsNew` (sums); `lettersNew`: up to 5 letters newly strong in the window with the number of learners for each, ordered by count then by letter order | letters are content, not people |
| Revisit together | up to 5 `needsPractice` letters with learner counts (the roll-up's top 3, widened); when `lectureModeEnabled()` the page links "Plan a lesson" to `ROUTES.spaceLecture(id, 'revisit')` (F-TCH-004) | the roll-up stays as is |
| Level check | per strand, counts of `secure`, `getting-there`, `not-yet`, `not-tested` among learners with a check (OD-5) | counts only; no names; no level distribution |
| Plans | up to 3 non-archived plans, newest first: `{ planId, title, assigned, started, finished, itemsDone }` from `planProgress` | `assigned` = learners with `total > 0`; no per-learner rows |
| Milestones | per stage, the number of stage completions that fell in the window (events, not standing positions; OD-4) | celebratory; never "how many are on each stage" |
| Up-only | `practiced`, `minutesTotal`, `questsNew` carry `up: true` when they grew against the previous window | never a down marker |

**Hard rules** (a test per rule, section 5): the result contains **no learner id, no name, no avatar and no per-learner array**; nothing is ordered by any learner's figure; there is no "top", "most", "least", "best" or "lowest" field; no standing distribution by stage or level (OD-4 keeps F-ROUTE-001 section 3.12); the class report is **never shown to a family viewer** and a family space has **no** class report (siblings must never be compared: the endpoint answers 409 for a family space). School-wide statistics stay `SchoolAdmin` (F-SCHOOL-001); a school report is out of scope.

### 3.8 Worker routes (additive; `packages/backend/src/routes/space-reports.ts`, mounted `app.route('/api/spaces', spaceReportRoutes)` in `app.ts` next to the other `/api/spaces` routers, `app.ts:56-66`)

**`GET /api/spaces/:id/learners/:learnerId/report?period=<p>`** (RP-5)

- Auth: Clerk session (as every console route). `findSpace` + `requireCan(..., 'summary.read')` exactly as the roster (`routes/spaces.ts:350-356`).
- 409 `wrong_kind` for a `school` space (its admin uses the class's route). 404 `not_member` when `learnerId` is not a learner member of the space (no hint whether the learner exists elsewhere).
- 200 body (`LearnerReportResponseSchema` in `schemas/report.ts`):
  `{ space: publicSpace(space), learner: { id, displayName: rosterName(space, ...), avatar, ageGroup, joinedAt, lastActiveAt }, summary: rosterSummary(snapshot?.summary, planIds, space.kind), lastSyncedAt, serverTime }`.
  The same projection as the roster, so a report can never show more than the roster's consent allows. `payload_json` is never read.
- `period` is used only for the server event (section 3.13); an unknown value reads as `week`.

**`GET /api/spaces/:id/class-report?period=<p>`** (RP-5)

- Auth as above. 409 `wrong_kind` for `family` and `school`.
- The Worker loads the class's learner members' stored summaries, projects each with `teacherVisibleSummary` (no ids are carried forward), loads `plansOf(space.id)` and returns `{ space: publicSpace(space), period, serverTime, report: classReport(...) }` (`ClassReportResponseSchema`).
- Cost: one summary read per member, the roster's cost (a free class is capped at 20, a licence at 300 seats). No cache in v1.

**Roster projection** (RP-W): `activity` joins `TEACHER_VISIBLE_SUMMARY_KEYS` with item `activity` in `TEACHER_VISIBLE_SUMMARY_ITEMS` (OD-3). `roster-summary.ts` gains `activityOf(value)` that picks known keys at every level (like `journeyOf`) and **sets every `w` to 0 and drops nothing else** while `vocab` is on `TEACHER_HIDDEN_SUMMARY_KEYS`; F-VOC-005 P-4, when it moves `vocab` to the visible list with its consent item, also stops zeroing `w` (a test pins the coupling). The consent item sentence changes (section 3.10).

No D1 migration. No new table. Both routes are read-only.

### 3.9 The in-app report (learner app, behind the grown-up gate; RP-9)

- `ParentDashboardScreen` profile cards gain **See report** -> `PinEntry` when the 15-minute grown-up session has lapsed (`logic/profiles/session.ts`), then `LearnerReport { profileId }`. A self-only device without a PIN opens directly (`gate-route.ts` `gateOpensDirectly`), as the dashboard does today.
- The screen builds the local summary (`summarize` with `buildActivity`) for that profile and renders `learnerReport({ viewer: 'device', ... })` with the same blocks as the console page, single column, plus the device-only **skills** rows ("What the quests practiced: reading, listening, writing", from `logic/my-route/skills.ts`, counts of finished quests, the F-ROUTE-001 `caregiver.skillsNote` sentence; OD-8 keeps skills off the console).
- Offline: works fully offline (local data only). No print button in the app (OD-7); the console prints.
- Read-only: the screen never writes progress, never sends learner telemetry and never changes the active profile.

### 3.10 Privacy and safety

- **Summary only.** Grown-ups read only the projected summary, as today (F-SYNC-001 section 3.4). The new data is **counts per local day** plus the letters that became strong per day. No per-question history, no response times, no free text, no recordings, no location. `payload_json` stays device-only.
- **Consent text stays true** (F-SPACE-002 T-1a). `activity` is on the teacher-visible list, mapped to the item `activity`, whose sentence changes from "When {learner} was last active, minutes this week and days in a row" to **"When {learner} practiced, minutes each day and days in a row"** (Pre-A1, 11 words; the copy test enforces at most 16). Per-day quests, cards and letters are already covered by the items `quests` ("Quests done and how many answers were right") and `cards_letters` ("Cards earned, letters learned and letters that need practice"); words stay zeroed until their own consent item exists (F-VOC-005 P-4). The text is read today only by the class-move sheet, which stays off (CLASS_TRANSFER is never enabled); there is no consent version to bump (`l_shown_json` records line ids, not text).
- **Who can open a report**: exactly who can open the roster (`summary.read`). A learner cannot (learners have no account; device auth never reaches these routes). The in-app report sits behind the existing grown-up gate.
- **Per-student views show only that student.** The learner route returns one learner; the view-model input has no slot for anyone else.
- **Class statistics carry no identifiers** and are never served for a family space (no sibling comparison).
- **Anonymized classes** stay anonymized: the display name comes from `rosterName`, on screen and in print.
- **Print**: the printed page shows what the screen shows, nothing more, with the footer line "Private: shared from Hangul Route" and the print date. Nothing is generated or stored on a server; there is no share link, no email and no CSV in v1 (OD-7).
- **Retention**: the device sends at most 35 days and 24 months; older detail lives only on the device. Deleting a learner (`/teach/space/settings`) or leaving a space removes the report with the summary, as today.
- **No effect on the learner.** Nothing in this spec renders on a learner screen or changes what a learner is offered.

### 3.11 Copy, tone, localization

- Strings live in a new namespace `report` (`packages/i18n/src/messages/en/report.ts`), shared by the console and the learner app, plus `a11y.report` for screen-reader labels. Registered in `messages/en/index.ts`; `ko` and `es` stay `{}` overlays until native review (F-I18N-001 PR 16), falling back to English.
- Every `report.*` and `a11y.report.*` string passes, in en / es / ko: the caregiver banned list (`banned-words.json`, `caregiver` surface, which includes the learner list), plus a report-only list kept in the test (`__tests__/report-messages.test.ts`): `weak`, `weakness`, `poor`, `worst`, `rank`, `ranked`, `ranking`, `leaderboard`, `top`, `bottom`, `below`, `average`, `compared`, `should have`, `struggling`, `falling`, `lowest`, `last place` (and their es / ko equivalents when those overlays land). No word about speaking, pronunciation or voice. No emoji-capable symbol. Length budgets are added to `length-budget.test.ts` for every key.
- **Tone**: warm, plain, Pre-A1 English, third person about the learner, second person to the grown-up only in actions ("Add to a plan"). Invitations, not warnings. Numbers are counts. An empty day, a 0 figure or a first visit is described neutrally ("No practice yet this week." followed by the P0 line).
- Strand tips (fixed, one per strand): hangul-recognition "Letter games help: try Match the Shape." · sound-letter "Listening games help: try Match the Sound." · syllable-reading "Read short words together." · vocabulary "Word cards help: try a word topic." · sentences "Read a short story together."
- English drafts for every key are in Appendix A; final copy is the dictionary's.

### 3.12 Accessibility (WCAG 2.1 AA)

- Period switch: a `role="tablist"` with four tabs, arrow-key and Home / End navigation, the selected period also in the URL; on change, focus stays on the tab and a polite live region announces "Showing this week". The learner app uses `SectionTabs` (`design/components/SectionTabs/spec.md`).
- Calendar cells and the growth line each have a text alternative: a list ("Practiced on Monday, Wednesday and Thursday") and a visually hidden table (month, quests, cards). Colour is never the only signal: practiced cells are filled shapes with a check glyph from `packages/design-system` icons, empty cells are outlines.
- Headings: one `h1` (learner name or class name, plus "Report"), an `h2` per block, in reading order; the at-a-glance block comes first.
- 320 px wide with no horizontal scroll; 200 % text; touch targets `touchTarget`; body text floor 18 (design-system defaults).
- Letters render with the existing `KoreanText` treatment (romanization and gloss per CLAUDE.md section 1 Languages) and a screen-reader label that names the letter and its romanization.
- Print: the token text colour on the paper surface token, no meaning carried by colour, every block within one page width, `break-inside: avoid` per block.

### 3.13 Telemetry (Worker first; `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9`; rows in `docs/roadmap/TELEMETRY-NAMES-2.md` section L)

One name, `report.viewed`, payload `{ scope: 'learner' | 'class', space: 'family' | 'class' | 'device', period: 'day' | 'week' | 'month' | 'all' }`. Codes only: **no profile id, no space id, no learner id, no name**.

- **Console**: the console has no telemetry client, so the **Worker records the event itself** inside the two routes of section 3.8, through a new helper `recordServerEvent(name, payload)` (`packages/backend/src/lib/server-events.ts`) that appends to the same in-memory store as `POST /api/telemetry` (`routes/telemetry.ts`, `store.events`, capped at 10,000) and validates the name with `isTelemetryEventName`. Every period change refetches with the new `period`, so each view is one event.
- **Learner app**: `LearnerReport` sends `report.viewed` with `space: 'device'` through `track()` on open and on each period change, **without** `profileId` (a grown-up event, like `lecture.*`).
- **Worker first**: RP-W adds the name to the shared list and its exact-list test; it is deployed before RP-5 records it and before any app build with RP-9 sends it.

### 3.14 States, errors, offline (console pages)

| State | Learner report | Class report |
|---|---|---|
| loading | skeleton blocks with the page heading; tabs disabled | same |
| ready | section 3.5 | section 3.7 |
| legacy (no `activity`) | at-a-glance only, plus "Day-by-day reports appear after {name}'s app updates." | `olderApp` line; figures from learners with `activity` |
| empty | "{name} has not practiced yet. Reports appear after the first quest." plus the P4 line when `journey` exists | "No learners yet" with the join code link to the roster |
| stale (last saved > 7 days) | figures render; one neutral line "Last saved {date}. Figures are from then." | `notSaved7d` count line |
| not a member / wrong kind | "This report is not available." with a link to console home | same |
| network error | "Can't load the report right now." and Try again; cached last response shown when available (react-query cache) | same |
| flag off | "Reports are not available yet." and a link back to the roster | same |

### 3.15 Behaviours (Given / When / Then; counts on the frozen fixtures of section 5)

1. **Given** a learner who practiced on Mon, Wed and Thu this week for 12, 9 and 15 minutes and finished 2 new quests, **when** a parent opens the week report, **then** the headline reads "Mina practiced on 3 days this week.", figures show 3 days, 36 minutes, 2 quests, and the calendar fills three cells.
2. **Given** last week had 40 minutes and this week has 36, **when** the week report renders, **then** no minutes comparison appears (W4 does not fire) and nothing says "less".
3. **Given** a learner replays a quest finished three weeks ago, **when** today's report renders, **then** `q` for today is 0 (the latch keeps the first day) and the minutes count today.
4. **Given** `needsPractice = ['ㅂ', 'ㅅ']` and the catalogue quest `letters-q2` teaches ㅂ, **when** a teacher opens the report, **then** P1 reads "ㅂ (b) and ㅅ (s): worth another visit." with an "Add to a plan" action that opens the builder with `letters-q2` as a draft item.
5. **Given** a class of 12 where 2 learners practiced this week, **when** the teacher opens the class report, **then** `minutesMedian` is null and the time block shows only the total.
6. **Given** a family space with two siblings, **when** a caregiver requests `/class-report`, **then** the Worker answers 409 `wrong_kind` and the console has no link to it.
7. **Given** a learner on a build without RP-4, **when** the report opens, **then** the state is `legacy`, the at-a-glance block renders from today's summary and no period figure is invented.
8. **Given** an old build uploads a snapshot without `questDoneAt` after a newer build synced, **when** the Worker stores it, **then** the stored `questDoneAt` and `summary.activity` are kept.
9. **Given** a class that anonymizes its roster, **when** the teacher prints a learner report, **then** the printed name is the initials shown on screen.
10. **Given** the newest level check has `sound-letter: getting-there`, **when** the month report renders, **then** P2 reads "Sound and letter matching is next to grow." with the sound-letter tip, and `oralStage` appears nowhere.

## 4. Out of scope

- A learner-facing report, a learner "stats" page, or any change to learner screens (owner item 5 belongs to the learning-route and app-shell siblings).
- Speaking in any form (owner decision 2026-10-10).
- A school-wide report (F-SCHOOL-001's aggregate stays); cross-class comparison of any kind.
- Push notifications, email digests, share links, CSV export (OD-7, OD-15).
- Review-test results (F-RVW-001 draft; a later amendment adds W/P rows).
- Word figures before F-VOC-005 P-4 (zeroed for every roster viewer until then; shown in the in-app report once the slice is written).
- A server-side history table, server reads of `payload_json`, or any D1 migration.
- Changing the streak rule (UTC days) or the roster roll-up.
- The feedback channel, billing views, the adult content browser, the persona shell and the domain move (siblings, section 7).

## 5. Tests

Fixtures: `packages/content-schema/src/reports/__tests__/fixtures/activity-2026-10.ts` (three learners: a steady week, a learner with a gap, a learner on an old build), the frozen catalogue `packages/content-schema/src/__tests__/fixtures/catalog-2026-10.ts`, and a 20-learner class fixture built from them.

| File | Level | Coverage |
|---|---|---|
| `content-schema/src/__tests__/report.test.ts` | unit, 100 % | `ActivitySummarySchema` bounds (35 / 24 / 16 / 12), day and month key formats, `.catch` drops a malformed `activity` from `ProgressSummarySchema`; an old summary parses; response schemas |
| `content-schema/src/__tests__/progress.test.ts` (extend) | unit | `questDoneAt` optional; old snapshot parses |
| `content-schema/src/__tests__/sync.test.ts` (extend) | unit | `activity` optional and tolerant |
| `content-schema/src/reports/__tests__/windows.test.ts` | unit, 100 % | `todayFor` across offsets -840..840 and around midnight; `windowOf` for the four periods incl. month boundaries and leap day; `practiceDaysIn` |
| `…/learner-report.test.ts` | unit, 100 % | the five states; at-a-glance from legacy fields; figures and `up` only on growth; calendar; growth baseline and running sum; no percentage field anywhere in the output (key scan); input type has no class or other-learner key (type test with `expectTypeOf`) |
| `…/insights.test.ts` | unit, 100 % | each W and P rule fires and does not fire at its threshold; order and cap of 3; P0 first; `day` keeps W + P1; getting-started rule; missing data skips; params carry no name or free text (schema check) |
| `…/class-report.test.ts` | unit, 100 % | bands per period; median null under 3; letters and revisit ordering by count then letter; strand counts; plan rows (newest 3, archived skipped); milestones as events; output contains no `id`, `displayName`, `avatar` or array of length `learners` (deep key scan); no field named top / most / least / best / lowest |
| `…/monotonic.test.ts` | property | random activity streams: `total.*` never decreases; a past window's figures never change when later activity is added; the growth line never decreases |
| `content-schema/src/__tests__/telemetry.test.ts` (extend, RP-W) | unit | `report.viewed` in the exact list |
| `content-schema/src/__tests__/transfer-consent.test.ts` (extend) | unit | `activity` on the visible list mapped to `activity`; the new item sentence passes the copy rules; every summary key is on exactly one list |
| `mobile/src/logic/reports/__tests__/activity.test.ts` | unit, 100 % | minutes per local day (injected `localDay`), sessions without duration, latch days, letters on first strong day only, vocab `first`, milestones, newest-35 / newest-24 trimming, totals from the full snapshot, output parses with the schema |
| `mobile/src/logic/sync/__tests__/merge.test.ts` (extend) | unit | `questDoneAt` union, earliest wins, unparseable values |
| `mobile/src/store/__tests__/progress-store.test.ts` (extend) | unit | latch written on first completion only; backfill once on hydrate; replay leaves it; `beginSession` returns null while one is open (under 2 hours) and a new id otherwise; `endSession` with another id leaves the open session running |
| `mobile/src/logic/sync/__tests__/summarize.test.ts` (extend) | unit | `activity` passed through when given, absent otherwise |
| `backend/src/__tests__/sync.test.ts` (extend) | integration | malformed `activity`: 200 and dropped; `questDoneAt` and `summary.activity` preserved from an old client; union on merge |
| `backend/src/lib/__tests__/roster-summary.test.ts` (extend) | unit | `activityOf` picks known keys at every level; `w` zeroed while `vocab` is hidden; coupling test with `TEACHER_HIDDEN_SUMMARY_KEYS` |
| `backend/src/__tests__/space-reports.test.ts` | integration (memory and `test:sqlite`) | learner route: 200 for caregiver / teacher / school admin, 403 for an outsider, 404 `not_member`, 409 school; class route: 200 class, 409 family and school; responses parse with the schemas; no `payload` key; anonymized names; one `report.viewed` event per call with codes only |
| `web/src/lib/console/__tests__/report-view.test.ts` | unit, >= 90 % | sentences from codes for every insight and state, in en; letter labels with romanization; date formatting per locale; action links (`ROUTES.spacePlan` with `add`) |
| `web/src/lib/console/__tests__/routing.test.ts` (extend) | unit | `learnerReport` and `classReport` encode ids, never take a name |
| `i18n/src/__tests__/report-messages.test.ts` | unit | structure; caregiver banned list and the report-only list in en / es / ko; no speaking words; no emoji; length budgets |
| `web/e2e/reports.spec.ts` | e2e (Playwright on `apps/web/out`, API mocked with `page.route`) | 320 x 568, 768 x 1024, 1280 x 800: no horizontal scroll; tab keyboard order; period in URL; legacy, empty, error states; print media emulation shows the footer and hides navigation; class report has no learner names |
| `mobile/e2e/web/learner-report.spec.ts` | e2e (nightly) | dashboard -> gate -> report; period tabs; offline; no `profileId` on the event |

Coverage: `packages/content-schema` 100 %; `packages/backend` >= 90 %; `apps/mobile/src/logic` >= 90 % with `logic/reports/` at 100 %; `apps/web` console logic >= 90 %. Pages and screens are verified by e2e. The preview-deploy gate (`.github/workflows/preview-deploy.yml:57-58`) gains `test -f apps/web/out/teach/space/learner.html` and `.../report.html` (RP-7a, RP-8).

## 6. Rollout and PR breakdown

### 6.0 Milestones

| Milestone | What the user sees at the end | PRs | Deploy gates |
|---|---|---|---|
| **M1 "History builds up"** | nothing visible; devices start sending day-by-day counts | RP-0, RP-1, RP-W, RP-3a, RP-3b, RP-4 | RP-W deployed before an app build with RP-3a / RP-4 |
| **M2 "Per-learner reports"** (owner item 4, and item 6 per student) | parents and teachers open a learner report from the roster, switch periods, print | RP-2a, RP-2b, RP-5, RP-6, RP-7a, RP-7b, RP-10 | RP-5 deployed before the pages ship (pages behind the flag) |
| **M3 "Class statistics"** (owner item 6, class) | teachers open the class report | RP-2c, RP-8 | — |
| **M4 "Shared device and launch"** | the in-app report; flags on | RP-9, RP-11 | es / ko review, else `en` only |

M1 should merge as early as possible: every week it ships earlier is a week of history the first reports can show. Total: 17 PRs, 2 Worker deploys (RP-W, RP-5), no D1 migration.

### 6.1 PR table

| PR | Content | Size | Needs |
|---|---|---|---|
| RP-0 | `docs`: this spec; wireframes `design/wireframes/reports/{learner-report,class-report,in-app-report,print}.md`; `report.viewed` row in `docs/roadmap/TELEMETRY-NAMES-2.md` section L | S | — |
| RP-1 | `feat(content-schema)`: `schemas/report.ts` (activity, learner and class response schemas, `ReportPeriodSchema`), `ProgressSummary.activity`, `ProgressSnapshot.questDoneAt`; exports appended to `src/index.ts` | S | RP-0 |
| RP-W | `feat(backend,content-schema)`: `QUEST_DONE_AT` in `ADDITIVE_FIELDS`; `activity` on `TEACHER_VISIBLE_SUMMARY_KEYS` -> item `activity` with the new sentence; `activityOf` projection with `w` zeroed; `report.viewed` in `TELEMETRY_EVENT_NAMES` + exact-list test; `lib/server-events.ts`; tests (memory + sqlite). **Deploy the Worker before RP-3a / RP-4 ship in an app build** | S | RP-1, OD-3 |
| RP-2a | `feat(content-schema)`: `reports/windows.ts`, `reports/learner-report.ts` (states, at a glance, headline, figures, calendar, growth, letters, milestones, level check, plan), fixtures, tests | M | RP-1, OD-1, OD-2, OD-6, OD-10, OD-11 |
| RP-2b | `feat(content-schema)`: `reports/insights.ts` (W1-W10, P0-P5, caps, order), tests | M | RP-2a |
| RP-2c | `feat(content-schema)`: `reports/class-report.ts`, class fixture, tests (hard rules) | M | RP-2a, OD-4, OD-5 |
| RP-3a | `feat(mobile)`: `questDoneAt` latch writer, one-time backfill on hydrate, `mergeQuestDoneAt` + tests | S | RP-1, RP-W deployed |
| RP-3b | `feat(mobile)`: `beginSession` returns the opened id or null, `endSession(profileId, sessionId)`; sessions in `StoryReaderScreen`, the stand-alone `Minigame` screen and the level check; quest player passes its id; tests | S | RP-0 |
| RP-4 | `feat(mobile)`: `logic/reports/activity.ts` `buildActivity`; `sync-store` passes `activity` into `summarize`; tests | M | RP-1, RP-3a, RP-W deployed |
| RP-5 | `feat(backend)`: `routes/space-reports.ts` (learner route, class route), mount in `app.ts`, server event, tests (memory + sqlite). **Deploy before RP-7a / RP-8 ship** | M | RP-2a, RP-2c, RP-W |
| RP-6 | `feat(i18n)`: `report` namespace (en) and `a11y.report`, registration, `report-messages.test.ts`, length budgets | S | RP-0 |
| RP-7a | `feat(web)`: learner report page `/teach/space/learner` (at a glance, tabs, figures, calendar, letters, milestones, level check, plan, went well / practice next, states), `lib/console/report-view.ts`, API client `getLearnerReport`, `ROUTES.learnerReport`, roster card "See report", console home family row "Reports" (to the roster), `reportsEnabled()` in `config.ts`, preview gate line | L | RP-2a, RP-2b, RP-5 deployed, RP-6, design mock |
| RP-7b | `feat(web)`: all-time growth line with its table alternative; the shared print rules in `apps/web/src/app/globals.css` (`@media print`, layout only: hide `.hr-console-shell-nav` and `.hr-report-actions`, `break-inside: avoid` per block; colours stay inline from tokens, the file's own convention) and "Print or save as PDF" on the learner report | S | RP-7a |
| RP-8 | `feat(web)`: class report page `/teach/space/report`, `getClassReport`, `ROUTES.classReport`, roll-up "Class report" link, the "Plan a lesson" link behind `lectureModeEnabled()`, print button on the class report (reuses the RP-7b stylesheet), preview gate line | M | RP-2c, RP-5 deployed, RP-6, RP-7b, design mock |
| RP-9 | `feat(mobile)`: `LearnerReport` screen (behind the gate), dashboard "See report", skills rows, `report.viewed` without `profileId`, flag | M | RP-2a, RP-2b, RP-4, RP-6, design mock |
| RP-10 | `feat(web)`: plan builder accepts `&add=<questId>` and adds it as a draft item; insight actions link to it | S | RP-7a |
| RP-11 | `test(e2e)`: `web/e2e/reports.spec.ts`, `mobile/e2e/web/learner-report.spec.ts`; flip both flags | S | RP-7b, RP-8, RP-9, es / ko review (else `en` only) |

### 6.2 Sequence notes

- Shared append-only files: `packages/content-schema/src/index.ts`, `schemas/telemetry.ts` and its test, `messages/en/index.ts`. Append, never reorder.
- RP-7a edits `app/(console)/teach/space/page.tsx` (one link on the roster card) and `teach/home/page.tsx` (one link on the family row). The persona app-shell and domain-split siblings also edit console navigation: keep each edit to the link itself.
- RP-3b edits three screens other specs touch (story reader, minigame screen, placement); the change is the two-line mount effect.
- The design pass (`design/screens/reports/`, manual, per `design/playbook/`) must produce the report block mocks before RP-7a, RP-8 and RP-9.

### 6.3 Ownership

| Code | Owner | Others |
|---|---|---|
| `ProgressSummary.activity`, `ActivitySummarySchema` | this spec (RP-1) | F-VOC-005 P-4 stops zeroing `w` |
| quest latch `questDoneAt` | this spec (RP-1, RP-3a, RP-W) | — |
| `reports/*` pure module | this spec | the app-shell sibling may render it in other places; it never forks it |
| the insight action slot on the learner report | this spec (RP-7a) | feedback-channel sibling ("Send a note"), content-browser sibling ("Preview") |
| roster allow-list and consent items | F-SPACE-002 (T-1a) | this spec adds `activity` (RP-W) |

## 7. Dependencies

- **On main** (`ea9049e4`): `summarize.ts`, `ProgressSummarySchema` with `journey` and `placement`, `rosterSummary`, `ADDITIVE_FIELDS` with `earlierLatchTime`, `classRollup`, `PlacementStrandSchema`, the catalogue with `teaches` (F-QUEST-002 Q-6a / Q-6b), `logic/my-route/skills.ts`, `SectionTabs` mock, the console plan builder.
- **Not on main, read when present**: F-ROUTE-001 R-8 is on main (journey summary); R-9a (console strip, PR #313) is independent. F-VOC-005 P-1 (vocab slice writer) and P-4 (consent item). F-RVW-001 (draft).
- **Siblings of the 2026-10-11 owner request** (specs drafted in parallel; their ids are fixed when they merge): persona app shell (`docs/persona-app-shell`: where adults sign in and navigate), domain split and marketing site (`docs/marketing-site-layered`: which host serves the console), adult feedback channel (`docs/adult-feedback-channel`: owner item 7, the "Send a note" action), adult content browser (`docs/adult-content-browser`: owner item 14, the "Preview" action), billing for every persona (`docs/billing-in-app-all-personas`: item 8), free plan and configured curriculum (`docs/free-day2-unlocked-curriculum`: items 9 and 10), LEARNING ROUTE (`docs/learning-route`: item 11; this spec reads `journey` only). None of them blocks this spec; each seam is named in section 6.3.
- **External**: the design pass for the report blocks; es / ko review of `report.*`; owner answers (section 9; defaults apply).

## 8. Decisions

Binding owner decisions applied: audience any age; anti-shame (CLAUDE.md section 1); reading, listening and writing only (2026-10-10); UI strings through `packages/i18n`; tokens only; no emoji; sandbox-only commerce (this spec has no commerce surface); additive-only D1 (this spec adds none).

Spec decisions (engineering, reversible):

| # | Decision | Why |
|---|---|---|
| M1 | Reports are computed from a **device-computed, bounded `activity` field** on the summary grown-ups already read | keeps the summary-only rule (no `payload_json` for accounts); works offline; no new table |
| M2 | **No D1 table, no migration** | the device already holds full history; a server table would duplicate it and need a migration on a live production database |
| M3 | One **pure module in `packages/content-schema/src/reports/`** used by Worker, console and app | three surfaces cannot drift; 100 % coverage lane already exists there |
| M4 | Class statistics are **computed on the Worker** and returned without identifiers | the class page never receives per-learner rows; the no-ranking rule is enforced in one place |
| M5 | A **quest latch** (`questDoneAt`) twin of `stageDoneAt`, backfilled once from `completedAt` | first finishes become exact from RP-3a on; history before it is an approximation that never moves again |
| M6 | Console telemetry is **recorded by the Worker** in the report routes | the console has no telemetry client; codes only |
| M7 | **Print stylesheet**, not file export | nothing generated or stored server-side; no new data path |
| M8 | Up-only comparisons, cumulative growth line, neutral empty days | "meters only fill", no guilt (CLAUDE.md section 1) |

## 9. Owner decisions and assumptions

**Owner decisions** (each has a default that applies until the owner answers, and gates only the named PRs):

| Id | Question | Default | What it changes | Gates | Reversible |
|---|---|---|---|---|---|
| OD-1 | Week window: rolling 7 days or calendar week (Monday start)? | **rolling 7 days ending today** (matches the roster's "minutes this week", `minutesLast7d`) | `windowOf('week')` | RP-2a | yes (one function) |
| OD-2 | Month window: calendar month to date or rolling 30 days? | **calendar month to date** (reads like a monthly report) | `windowOf('month')` | RP-2a | yes |
| OD-3 | Teachers see day-by-day activity (the consent item `activity` sentence changes to "When {learner} practiced, minutes each day and days in a row") | **yes** | roster allow-list, consent text | RP-W | yes (project `activity` for family spaces only, like `selfRoute`; class reports then show the `legacy` state) |
| OD-4 | Class report: show how many learners are on each stage? | **no** (keeps F-ROUTE-001 section 3.12 "no distribution by stage"); show stage **milestone events** in the window instead | class report blocks | RP-2c | yes |
| OD-5 | Class report: level-check strand counts (secure / getting there / next to learn / not checked) | **yes**, counts only | class report blocks | RP-2c | yes |
| OD-6 | Percentages on reports | **none** on learner and class reports (named letters and strand words instead); the roster roll-up keeps its existing anchor percentage | report figures | RP-2a | yes |
| OD-7 | Export | **print / save as PDF only**; no CSV, no share link, no email | print button and stylesheet | RP-7b, RP-8 | yes |
| OD-8 | Read / listen / write practice counts on the console | **no** (F-ROUTE-001 OD-11: skills stay local); shown only in the in-app report | console blocks | RP-7a, RP-9 | yes (needs a consent item) |
| OD-9 | Does a parent see a class's homework progress in the family report? | **no** (T-1a: `planProgress` is filtered to the viewing space); the family report shows family plans and the self-route | plan block | RP-2a | yes (needs a consent change) |
| OD-10 | All-time view | **cumulative line** of quests and cards (only rises); no per-month bars | growth block | RP-2a, RP-7b | yes |
| OD-11 | Comparisons with the learner's own past | **only when up** ("more than last week"); nothing when equal or down | figures, W4 | RP-2a, RP-2b | yes |
| OD-12 | Day boundary | **the learner device's local day** for reports; the streak keeps its UTC rule | windows | RP-2a, RP-4 | yes |
| OD-13 | How much detail the device sends | **35 days, 24 months**, totals and milestones | wire bounds | RP-1 | yes (raise bounds additively) |
| OD-14 | School admins open per-learner reports of their classes | **yes, read-only**, the same rule as the roster today | learner route auth | RP-5 | yes |
| OD-15 | Weekly digest by email or push to parents | **not in v1** (no messaging channel exists; a later notification spec) | — | — | — |
| OD-16 | Where report entries live once the persona shell ships | **roster card and family home row** (this spec); the shell sibling may add navigation entries to the same routes | entries | RP-7a | yes |

**Assumptions to verify**

| # | Assumption | Verified in |
|---|---|---|
| a | `.optional().catch(undefined)` drops a malformed `activity` in the repo's zod version (as for `journey`) | RP-1, RP-W backend test |
| b | A 4 KB worst-case summary stays well inside the Worker body limit and D1 row size | RP-W integration test with a maximal fixture |
| c | Device local days from `Date` getters match the learner's calendar on web, iOS and Android | RP-4 unit tests with injected `localDay`; RP-11 e2e in two time zones |
| d | joining an open session (`beginSession` returns null) prevents double counting a story opened from a quest, and the 2-hour cut-off closes nothing a learner is still using | RP-3b test |
| e | The roster card has room for one "See report" link at 280 px | RP-7a e2e |
| f | The 20-learner class route answers within the roster's latency | RP-5 sqlite test timing note |

## Appendix A — draft English strings (final copy is the dictionary's)

| Key | Draft |
|---|---|
| `report.title.learner` | "{name}: report" |
| `report.title.class` | "{class}: class report" |
| `report.period.day` / `week` / `month` / `all` | "Today" / "This week" / "This month" / "All time" |
| `report.glance.heading` | "At a glance" |
| `report.glance.nowOn` | "Now on Stage {n}: {stage}" |
| `report.glance.startedAt` | "Started at: {level}" |
| `report.glance.lettersStrong` | "Letters {name} knows well" |
| `report.glance.lettersPractising` | "Letters being practiced" |
| `report.glance.lastPractice` | "Last practice: {date}" |
| `report.headline.practiced` | "{name} practiced on {days} days {period}." |
| `report.headline.stageDone` | "{name} finished Stage {n}: {stage} {period}!" |
| `report.headline.noneYet` | "No practice yet {period}." |
| `report.headline.gettingStarted` | "{name} is just getting started." |
| `report.figure.days` / `minutes` / `quests` / `cards` / `letters` / `words` | "Practice days" / "Minutes" / "New quests" / "New cards" / "New letters" / "New words" |
| `report.figure.up` | "More than {previous}" (previous = "last week" / "all of last month") |
| `report.section.wentWell` / `practiceNext` | "What went well" / "What to practice next" |
| `report.insight.stage_done` | "{name} finished Stage {n}: {stage}." |
| `report.insight.letters_new` | "{name} got strong on {letters}." |
| `report.insight.practice_days` | "{name} practiced on {days} days." |
| `report.insight.minutes_up` | "More practice time than last time: {minutes} minutes." |
| `report.insight.quests_new` | "{count} new quests finished." |
| `report.insight.cards_new` | "{count} new heritage cards collected." |
| `report.insight.level_secure` | "Level check: {strands} looks secure." |
| `report.insight.plan_done` | "Every homework item in this plan is done." |
| `report.insight.streak` | "{days} days in a row. Hoya is proud!" |
| `report.insight.words_new` | "{count} new words met." |
| `report.insight.rhythm` | "A short session on two days a week is a great start." |
| `report.insight.letters_revisit` | "{letters}: worth another visit." |
| `report.insight.strand_next` | "{strand} is next to grow." |
| `report.insight.plan_open` | "{count} homework items are ready to play." |
| `report.insight.next_on_route` | "Next on the route: Stage {n}: {stage}." |
| `report.insight.words_revisit` | "{words}: worth another look together." |
| `report.action.addToPlan` | "Add to a plan" |
| `report.action.openPlan` | "Open the plan" |
| `report.strand.<id>.name` | "Letter shapes" / "Sound and letter matching" / "Reading syllables" / "Words" / "Sentences" |
| `report.strand.status.<status>` | "Secure" / "Getting there" / "Next to learn" / "Not checked yet" |
| `report.state.legacy` | "Day-by-day reports appear after {name}'s app updates." |
| `report.state.empty` | "{name} has not practiced yet. Reports appear after the first quest." |
| `report.state.stale` | "Last saved {date}. Figures are from then." |
| `report.state.unavailable` / `error` / `flagOff` | "This report is not available." / "Can't load the report right now." / "Reports are not available yet." |
| `report.class.practiced` | "{count} of {total} learners practiced {period}" |
| `report.class.band.none` | "Not yet" |
| `report.class.olderApp` | "{count} learners have an older app: their day-by-day figures appear after an update." |
| `report.class.revisit` | "Letters to revisit together" |
| `report.class.medianMinutes` | "Typical time for those who practiced: {minutes} minutes" |
| `report.class.planLesson` | "Plan a lesson" |
| `report.class.lettersNew` | "Letters the class got strong on" |
| `report.class.milestones` | "Stage milestones {period}" |
| `report.print.button` | "Print or save as PDF" |
| `report.print.footer` | "Private: shared from Hangul Route on {date}." |
| `a11y.report.calendar` | "Practiced on {days}" |
| `a11y.report.periodChanged` | "Showing {period}" |

## Review log

- 2026-10-11: drafted from the owner request of 2026-10-11 (items 4 and 6) and the current-system map of that day; data model, privacy projection, anti-shame rules and PR order checked against `origin/main` `ea9049e4`. Promoted to `ready` with the defaults of section 9.
