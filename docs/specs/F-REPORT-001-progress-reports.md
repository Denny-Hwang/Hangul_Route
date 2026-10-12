Status: ready

# F-REPORT-001 — Progress reports: a per-learner dashboard for parents and teachers, day / week / month / all-time reports, "went well" and "practice next", and class statistics without ranking

> **Status note.** `ready` means: every section below is decided, every owner question in section 9 has a default that applies until the owner answers, and no review blocker remains (two reviews of 2026-10-11 applied, see the review log). An owner decision gates only the PRs named next to it, never the whole spec. Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` below is at that commit.
>
> **Binding rules applied.** Owner request 2026-10-11, items 4 and 6 (items 3, 7, 8, 9, 10, 11, 12 and 14 are owned by the sibling specs in section 7; this spec joins them at the seams of section 6.3). CLAUDE.md section 1: any age (no age wording), child safety (sign-in or parent gate, no ads, local-first, consent before data reaches an account), anti-shame (no public ranking of children, no learner-vs-learner comparison, meters only fill, no red-X). Owner decision 2026-10-10: **reading, listening and writing only**: nothing in this feature shows, counts or mentions speaking (the level check's `oralStage` is never rendered). UI strings come from `packages/i18n` (English source; Korean and Spanish overlays stay empty until native review). Design tokens only. No emoji. Sandbox-only commerce: this spec adds no purchase surface.

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a wireframe and a design mock)**

| Can start when | PR | Waits for | Why |
|---|---|---|---|
| now | RP-0 docs | — | this spec, the four wireframes, the telemetry row |
| after RP-0 | RP-0b privacy notice, RP-1 schemas, RP-2a windows + learner report, RP-3b session coverage, RP-6 strings | RP-0 merged | new files or independent code |
| after RP-1 | RP-W1 Worker (preserve rule, telemetry name and filter, server events), RP-2b insights, RP-2c class report, RP-5 learner route | RP-1 merged | they import the schemas |
| after RP-W1 is **deployed** and RP-0b is **deployed** | RP-3a quest latch writer, RP-4 activity summary | the Worker keeps `questDoneAt` and `summary.activity`; the privacy page describes the new data before any device sends it | zod strips unknown keys (`schemas/sync.ts:16`); notice before collection |
| after RP-W1, OD-3 and RP-0b deployed | RP-W2 roster projection + consent text version | — | teachers see `activity` only after the notice and the consent text say so |
| after RP-2c and RP-5 | RP-5b class route | — | the route calls `classReport()` |
| after RP-2a, RP-2b, RP-6 | RP-7a1 report view helpers, API client, routes | — | pure web code |
| after the design pass (`design/screens/reports/`) and RP-5 deployed | RP-7a2 learner report page, then RP-7b growth line + print, RP-8 class report page (after RP-5b deployed and RP-7b) | design mock of the report blocks | "no component without a mock" |
| after RP-7a2 and F-APP-001 A-5a + A-5b merged | RP-7c persona shell wiring (`/parent/learner`, parent home **Open**, navigation items) | — | the shell frame and the parent home exist |
| after RP-7a2 | RP-10 plan prefill action; RP-12 **Send a note** (after F-FEEDBACK-001 FB-11); RP-13 Browse links (after F-BROWSE-001 BR-10) | sibling PRs named | each sibling owns its target page |
| after RP-2a, RP-2b, RP-4, RP-6 and the design pass | RP-9 in-app report (learner app, behind the grown-up gate) | — | |
| last | RP-11 e2e + flag flip | es / ko string review (else `en` only, section 3.1) | |

**Scope**: `packages/content-schema` (new `schemas/report.ts`; new `reports/` pure module; `ProgressSummary.activity`; `ProgressSnapshot.questDoneAt`; one telemetry name; consent item sentence and text version) · `packages/backend` (`ADDITIVE_FIELDS` entry, `activity` projection on the roster allow-list, new `routes/space-reports.ts`, batched summary reads in `db/*`, a server-side telemetry helper, a `report.*` telemetry payload filter) · `apps/mobile` (`logic/reports/activity.ts`; quest latch writer and merge; session ownership and sessions for stories, stand-alone games and the level check; `sync-store` passes `activity` into `summarize`; the in-app report screen behind the grown-up gate) · `apps/web` (two console pages served under `/teach/*` and `/parent/*`, two choosers, report view helpers, API client, route constants, entries on the roster, the parent home and the adult navigation, print stylesheet, flag) · `packages/i18n` (new `report` namespace; `a11y.report`; privacy page lines)
**Owner**: solo dev
**Rollout**: console flag `NEXT_PUBLIC_REPORTS_ENABLED` and learner-app flag `EXPO_PUBLIC_REPORTS_ENABLED`, both default **off**, flipped in RP-11. Data PRs (RP-3a, RP-3b, RP-4) run with the flags off so history builds up before anyone sees a report. The Worker endpoints are always on (they are permission-checked and read only allow-listed data).
**Wireframes** (drafted with this spec, `design/wireframes/reports/`): `learner-report.md` (the per-learner dashboard and report on the console: parent and teacher variants, layers, four periods, every state) · `class-report.md` (class statistics) · `in-app-report.md` (learner app, behind the grown-up gate) · `print.md` (the printed / saved-as-PDF page). They supersede `design/wireframes/parent/learner-detail.md` and the web part of `parent/dashboard.md` (together with F-APP-001's `shell/parent-home.md`).

Parent / siblings: CLAUDE.md section 1 · F-SYNC-001 section 3.4 (the summary is the only column grown-ups read) · F-SPACE-002 T-1a (the roster allow-list is tied to the consent text) · F-TCH-001 sections 3.2 and 3.6 (no ranking; aggregates only; the learner detail page deferred in section 10.4 is delivered here) · F-PAR-001 (draft; its digest, section 3.2, and its suggestion engine, section 3.3, are **superseded** by this spec; its voice message, section 3.4, is replaced by F-FEEDBACK-001) · F-ROUTE-001 and its Learning Route amendment (`AMENDMENTS-ROUTE-LEARNING-ROUTE.md`: journey summary, skills stay local OD-11, section 3.12 hard rules, the adult Learning Route page LR-8) · F-PLC-001 section 3.8 (placement summary) · F-VOC-005 section 3.8 and P-4 (word counts reach grown-ups only with their consent item) · F-RVW-001 (draft; review results join later) · F-PLAN-001 / F-PLAN-002 (plan progress, self-route) · F-CONSOLE-001 (static export, `?id=` addressing) · F-I18N-001 (messages, length budget, banned words) · wave 2026-10-11: F-APP-001 (persona shell, app host, route map), F-SITE-002 (intro site, redirects, claims), F-FEEDBACK-001 (notes), F-BROWSE-001 (lesson browser), F-BILL-002 (billing), F-ENT-003 (free plan: all of Stage 1, `routeNext`)

---

## 1. Context

The owner asked (2026-10-11): a parent sees **a dashboard of their child's learning progress** with **daily, weekly, monthly and all-time reports** and an analysis of **what went well and what needs work** (item 4); a teacher sees the same **per student** for their class, **plus class-wide statistics and reports** (item 6). The same request asks that everything be layered, short and readable at a glance (items 2 and 13), that every persona works on app.hangulroute.com (items 3 and 12), and that the whole learning map is called **LEARNING ROUTE** (item 11).

Facts, verified on `origin/main` `ea9049e4`:

1. **What grown-ups can read today is one overwritten summary per learner.** The device computes `ProgressSummary` (`apps/mobile/src/logic/sync/summarize.ts:91-140`) and uploads it with the snapshot; D1 keeps one row per learner (`apps/api/migrations/0002_schema_v2.sql:32`, `summary_json`). Rosters project it to the allow-list `TEACHER_VISIBLE_SUMMARY_KEYS` (`packages/content-schema/src/schemas/transfer-consent.ts:115-126`, `packages/backend/src/lib/roster-summary.ts`). There is **no history**: the only time figures are `minutesLast7d` and `streakDays`, so no server can answer "this month" or "last week".
2. **The device holds enough to build history**, with two gaps. `sessions[]` is unbounded and unioned on merge (minutes and practice days by day: exact). `cards[].unlockedAt` dates every card. `stageDoneAt` dates stage completions. But a quest keeps only its best run: `completedAt` is the **latest** finish (`apps/mobile/src/logic/quest-progress.ts`), so "quests finished this week" cannot be told from "quests replayed this week". And sessions are recorded only by the quest player (`QuestPlayerScreen.tsx:76-77`), so story, stand-alone game and level-check time is missing.
3. **Accounts never read the full snapshot.** `GET /api/sync/learners/:id/snapshot` is device-only (`packages/backend/src/routes/sync.ts:90`). `can.ts:38` grants family caregivers `snapshot.read`, but no account route uses it, and roadmap section 3.1 keeps it that way. The Worker's `db.getSnapshot` is `SELECT *` (`packages/backend/src/db/d1.ts:335-337`), so any route that calls it loads `payload_json` too; the report routes therefore get their own narrow reads (section 3.8).
4. **Adult surfaces today.** The web `/parent` pages are a demo on mock data (`apps/web/src/data/mock-family.ts`); F-APP-001 replaces it with a real parent home at `/parent` on app.hangulroute.com and reserves `/parent/*` and `/teach/*` for this spec (F-APP-001 section 3.2). The real family and class view is the roster at `/teach/space?id=` with a "This week" roll-up computed client-side (`apps/web/src/lib/console/rollup.ts:24`). There is no per-student page (F-TCH-001 section 10.4, deferred). The in-app grown-up dashboard (`apps/mobile/src/screens/parent/ParentDashboardScreen.tsx`) shows lifetime totals for local profiles only.
5. **Strength and need signals that exist**: `jamoRecognized` and `needsPractice` (best quest accuracy per taught letter, thresholds 0.8 / 0.6, `summarize.ts:86-87`, topped up with level-check priority symbols); placement strand statuses (`secure`, `getting-there`, `not-yet`, `not-tested`, `schemas/placement.ts:22`); `journey` stage states; `planProgress`; `selfRoute` counts (family only); `vocab` (schema ready, never filled, hidden from every roster until F-VOC-005 P-4b); `reviews[]` (schema only, F-RVW-001 draft, always empty).
6. **The console has no telemetry client** (`docs/roadmap/TELEMETRY-NAMES-2.md` section K); the learner app sends through `track()` with an offline queue. `POST /api/telemetry` keeps any `profileId` and payload except for `space.transfer.*` (`packages/backend/src/routes/telemetry.ts:44, 74`).
7. **The consent text is versioned.** `TRANSFER_CONSENT_TEXT_VERSION = 'transfer-2026-10'` (`packages/content-schema/src/schemas/transfer.ts:38`), `ACCEPTED_CONSENT_TEXT_VERSIONS` (`:40`), and a test pins a sha256 of every locale's canonical text to the version (`transfer-consent.test.ts:193-198`: "edit the text, bump the version").
8. **The public privacy page** lists progress as quests, stars, cards, streaks and recognised letters "so a parent can see progress" (`packages/i18n/src/messages/en/landing.ts:278-279, 316`); it says nothing about time-on-task history or teacher visibility.

### 1.1 What this spec adds, in one paragraph

The device adds a small, bounded **activity summary** (35 local days, 24 months, all-time totals, stage milestones, the app's own "next" and one revisit quest) to the summary it already uploads. One **pure report module** in `packages/content-schema/src/reports/` turns a summary into a report for a period (a headline, up to three "went well" and three "practice next" lines, figures, a calendar, letters, milestones, plan progress) and turns a class's summaries into **aggregate-only class statistics**. Two additive Worker routes serve one learner's report and one class's aggregates. Two console pages on app.hangulroute.com (reached from the parent home, the adult navigation and the roster) and one learner-app screen render them in **three layers** so the answer is visible without scrolling; a print stylesheet makes every report printable. No new D1 table, no migration, no new data leaves the device beyond counts per day.

## 2. User stories

- As a **parent**, I sign in on app.hangulroute.com, tap **Open** on my child's card and, without scrolling, read one sentence about the week, what went well and one gentle next step. I can switch to today, this month or everything so far, and step back to yesterday or last week.
- As a **teacher**, I open one student's report before a parent meeting and print it.
- As a **teacher**, I open my class report on Sunday evening to see how the week went for the class as a whole and which letters to revisit together, without any list that orders my students.
- As a **parent who shares one device** with my child and has no account, I open the same report from the grown-up area of the app.
- As an **adult learning on my own device**, I can open my own report from the grown-up area; it talks to me ("You practiced on 3 days"), not about me.
- As a **learner** on a shared or class device, I never see any of this, and nothing I do in the app changes because a grown-up looked at a report.

## 3. Acceptance criteria

### 3.1 Surfaces, hosts and entries

| Surface | Who | Route / screen | Entry points |
|---|---|---|---|
| **Learner report** (the per-learner dashboard and its reports) | family caregiver or owner of a family space; teacher or owner of a class; a school admin over that class (read-only, same rule as the roster, OD-14) | `ROUTES.learnerReport({ spaceId, learnerId, kind, period?, at?, from? })` = **family**: `/parent/learner?id=<familyId>&learner=<learnerId>&period=<p>`; **class**: `/teach/space/learner?id=<classId>&learner=<learnerId>&period=<p>` (one page component at both paths, as F-APP-001 section 3.8 does for space pages) | parent home learner card **Open** (F-APP-001 section 3.8; RP-7c points it here, week by default); parent navigation item **Reports** (`ADULT_NAV`, RP-7c); roster card **See report** (class and family spaces, RP-7a2) |
| **Report chooser** (parent) | an account with the parent persona | `/parent/learner` with no `learner`: the learners of the account's family spaces, roster order (most recent activity, never a figure); exactly one learner opens that report directly (`location.replace`) | parent navigation item **Reports** |
| **Class report** (class statistics) | teacher or owner of a class; school admin over it | `ROUTES.classReport({ spaceId, period?, at? })` = `/teach/space/report?id=<classId>&period=<p>` | roster "This week" roll-up block, link **Class report** (class spaces only, RP-8); teacher navigation item **Class reports** (RP-7c or RP-8, whichever merges second) |
| **Class chooser** (teacher) | an account with the teacher persona | `/teach/space/report` with no `id`: the account's class spaces in teacher-home order; exactly one class opens its report directly | teacher navigation item **Class reports** |
| **In-app report** | the grown-up on a shared device, after the grown-up gate; the adult learner on a self-only device | learner-app stack screen `LearnerReport { profileId }` (`GrownUpDestination` gains `'LearnerReport'`) | each profile card on `ParentDashboardScreen` gains **See report** |
| **Print** | same as the page printed | the learner report or class report with the print stylesheet | **Print or save as PDF** in the header of both console pages |

- **Host.** The console pages live on **app.hangulroute.com only**, under the prefixes F-APP-001 section 3.2 reserves for this spec (`/parent/*`, `/teach/*`; owner items 3 and 12). hangulroute.com never links to a report and serves no report page (F-SITE-002). Until F-APP-001 moves the console (its milestones M1 to M3), the same pages are served wherever the console is served today. Old `hangulroute.com/teach/space/*` bookmarks reach the app host through F-SITE-002's `/teach/*` redirect row and F-APP-001's A-8 stubs, which already cover every `/teach/**` path (no new row is needed); `/parent/learner` never existed on the site host.
- **Kind-aware routes.** `ROUTES.learnerReport` follows F-APP-001's `ROUTES.space(id, kind)` rule: `family` goes to `/parent/learner`, `class` to `/teach/space/learner` (a `school` space has no learner report; its admin opens the class's). Until RP-7c (after F-APP-001 A-5b), the family branch returns `/teach/space/learner` too, which F-APP-001 keeps working for family ids; after RP-7c, `/teach/space/learner?id=<family>` still renders the same page, so no link breaks.
- **Addressing** follows F-CONSOLE-001 section 3.6: a static export, so ids ride in the query. **No learner name ever appears in a URL** (F-APP-001 R-2); `learnerId` is the opaque `profile:` id the roster already carries (`TEACHER_ROSTER_ADDRESS_FIELDS`, `transfer-consent.ts`).
- `period` is one of `day`, `week`, `month`, `all`; anything else reads as `week` (the default). `at` is an optional learner-local day key that selects a past window (section 3.2). `from` is an optional code, `home`, `roster` or `nav`, for the back link only.
- **Back link** goes where the grown-up came from: `from=home` to the parent home (`/parent`), `from=roster` to the space's roster (`ROUTES.space(id, kind)`), `from=nav` or absent to the persona home (parent home for a family space, the class roster for a class).
- **Plan and price.** Reports are available to **every grown-up who can open the roster, on any plan**: no entitlement check, no paywall, no price, no purchase surface, no IAP link and no Stripe call (Stripe stays sandbox-only, F-BILL-002; progress visibility is not a paid feature, matching the Learning Route amendment's LR-OD-9). Only the lesson browser is for paying grown-ups (F-BROWSE-001); a report links to it and leaves the access decision to F-BROWSE-001's own access screen, so a report never shows a lock or a price.
- **Flags.** With `NEXT_PUBLIC_REPORTS_ENABLED` off, the entries and navigation items are not rendered (F-APP-001: an item whose page is not built is not shown) and the pages render the "not available yet" state with the back link. `reportsEnabled(locale)` (`apps/web/src/lib/console/config.ts`) returns true only when the flag is on and, until the ko / es review of `report.*` lands, only for the `en` console locale: a ko or es console hides the entries and shows the "not available yet" state on the pages, and reports appear for that locale when its review lands. With `EXPO_PUBLIC_REPORTS_ENABLED` off, the dashboard has no **See report** button and the screen is not registered.

### 3.2 Periods, days and the data horizon

All dates in a report are **the learner's local calendar days**, as the learner's device saw them.

| Period | Window (learner-local) | "Previous window" for the up-only line | Data |
|---|---|---|---|
| `day` | today | none (no comparison on a single day) | `activity.days` |
| `week` (default) | the last 7 days, today included (rolling, OD-1) | the 7 days before | `activity.days` (35 days cover both) |
| `month` | the calendar month to date (OD-2) | the whole previous calendar month, shown only when this month already exceeds it ("more than all of last month") | `activity.days` for this month; `activity.months` for the previous one |
| `all` | from the first active day to today | none | `activity.total`, `activity.months`, `activity.milestones` |

- **Today for a viewer** is computed from the viewer's clock and the learner's offset: `todayFor(now, activity.tz)` (`reports/windows.ts`). The device records `tz` (minutes east of UTC, `-new Date().getTimezoneOffset()`) each time it computes the summary. Event days themselves are taken from the device's local calendar at computation time, so DST is handled by the device; only "today" for a remote viewer uses the stored offset (off by at most one hour at a DST edge, documented, not corrected).
- **Looking back** (OD-18). A **Previous** / **Next** stepper beside the tabs moves the window; the URL carries `at=<dayKey>` (a day, never a name). `day`: any of the 35 local days ending at `asOf`; `week`: the 7 days ending at `at`, within the same 35 days; `month`: any month in `activity.months` (up to 24). A month older than the day rows shows **totals only** (figures from `activity.months`, no calendar, no letters; only the went-well lines that month totals carry: W0, W3, W5, W6). `all` has no stepper. An `at` that is malformed or outside the limits reads as the current window. **Next** is hidden on the current window. The first step back is labelled "Yesterday", "Last week" or "Last month"; further steps show the dates. Each step is one `report.viewed` event with the same period.
- **The data horizon.** The device's data stop at `activity.asOf` (its local today when it last computed the summary). Days after `asOf` are **not saved yet**: the calendar draws them in a third, neutral style (dashed outline; the text alternative says "not saved yet"), and they are left out of figures, the headline, the up-only comparison and P0. When a window reaches past `asOf`, the line "Figures up to {date}." sits under the headline. When the whole window is after `asOf`, the headline is `none_saved` ("Nothing saved from {name}'s device {period} yet.") and no practice-next line refers to it.
- **Streak.** `streakDays` keeps its UTC-day rule for the learner app (`progress-store.ts` `nextStreak`, OD-12). The report's "days in a row" line (W9) is **computed from `activity.days`**: consecutive local practice days ending at `asOf` (or at the day before `asOf` when `asOf` has no practice yet), so it always agrees with the calendar on the same page.
- **A practice day** is a local day with any of: a session started that day (minutes may be 0), a quest finished for the first time, a card collected, a word met for the first time. An empty day is **neutral**: it is drawn as an empty outline and never labelled.

### 3.3 The activity summary (device-computed, additive, bounded)

**3.3.1 Snapshot: the quest latch.** One additive record, the twin of `stageDoneAt`:

```ts
// packages/content-schema/src/schemas/progress.ts — ProgressSnapshotSchema gains:
/**
 * Quest latch (F-REPORT-001 section 3.3.1): quest id -> ISO time the quest was
 * first completed. Only ever gains keys; the earliest instant wins on merge.
 * Absent in snapshots written before it; readers treat a missing value as {}.
 * Builds from RP-3a on always write the key (an empty record when nothing is
 * latched), so "key absent" means "an older build".
 */
questDoneAt: z.record(z.string(), z.string()).optional(),
```

- **Writer** (`apps/mobile/src/store/progress-store.ts`, RP-3a): when a quest first gets `completedAt`, write `questDoneAt[questId] = new Date().toISOString()` if absent. **Backfill once** on hydrate: every completed quest without an entry gets its current `completedAt` (an approximation for history before RP-3a, biased late, documented in section 8 as M5; it is written so the day never moves again when the quest is replayed). An entry never moves **later**: it moves **earlier** only when its quest's `completedAt` is earlier (a merge brought another device's earlier first finish), so a past period's quest count can still change after a sync; held entries the Worker would refuse (its schema bounds) are dropped before a save. Every snapshot the build writes, including the blank snapshot of a profile reset, carries the key.
- **Merge** (`apps/mobile/src/logic/sync/merge.ts`): union by key, earliest instant wins, same comparator as `mergeStageDoneAt` (`merge.ts:112`); both latches sort their keys in code-point order.
- **Worker preserve rule** (`packages/backend/src/lib/additive-fields.ts`, RP-W1): a new entry `QUEST_DONE_AT { payloadKey: 'questDoneAt', summaryKey: 'activity', isUnset: value === undefined, merge: union with earlierLatchTime }` appended to `ADDITIVE_FIELDS`. Only an **absent key** is "unset" (the VOCAB rule, `additive-fields.ts:105-109`), so an old build that re-uploads without the field keeps the stored latch **and** the stored `summary.activity`, including for a learner with sessions but no finished quest (the stored value is `{}`, which is set). A sent record is unioned with the stored one (the STAGE_DONE_AT rule), so a device that upgraded after another device synced never erases that device's first-finish days. A sent `summary.activity` is kept as sent; a sent latch **without** a `summary.activity` keeps the stored one (`keepStoredSummaryWhenSent`), so a build that has RP-3a but not RP-4 (a native build cut between the two merges) never erases the activity another device computed; the stored activity carries its own `asOf`.
- **Profile reset.** A union can bring old latch entries back after a reset. The activity builder therefore counts a latch entry **only while that quest is completed in the snapshot** (section 3.3.4 step 2), so a reset learner's report starts fresh; and a new build always sends a fresh `summary.activity`, which the preserve rule never overwrites. Tests pin both cases (section 5). **Known approximation** (M5): the union never deletes, so the server copy keeps the pre-reset first-finish times, and a quest the learner finishes **again** after the reset keeps its pre-reset entry (the writer writes only when the key is absent): that finish counts on the old day (often outside the 35-day window) and its letters with it, so the post-reset "new quests" figure can read low. RP-3a accepts it (2026-10-12) and adds no reset marker: a reset is a rare grown-up action, the gap only makes the post-reset "new quests" figure read low (never high, and nothing earned is lost), and a marker would be a new snapshot field that needs its own Worker preserve rule deployed first. If it matters later, RP-4 can skip an entry earlier than its quest's `startedAt` (a pre-reset entry is, since a quest record starts at its first finish) with no new field. That heuristic is not sound on its own: `mergeQuest` keeps the earliest `startedAt` across copies, so a pre-reset quest record unioned back from the server keeps its old `startedAt` and the old latch entry passes the check; RP-4 must test it against a reset followed by a sync union before relying on it.

**3.3.2 Sessions everywhere a learner practices** (RP-3b).

- **Callers.** `beginSession` / `endSession` (`progress-store.ts:413-470`) are also called by `StoryReaderScreen` (`apps/mobile/src/screens/story/StoryReaderScreen.tsx`), the stand-alone `Minigame` screen (`apps/mobile/src/screens/minigames/`) and the level check (`apps/mobile/src/screens/placement/PlacementScreen.tsx`), with the same mount / unmount pattern as `QuestPlayerScreen.tsx:76-77`; the three time-only callers hold their session only while their screen is in front (`usePracticeSession`, `holdWhileFocused`): a screen pushed over them (the PIN or the placement report over the level check, Culture notes over a story) ends it and coming back begins a new one, so a grown-up's time never counts as the learner's practice. Vocabulary rounds (F-VOC-003, not built) call the same pair when they ship; that spec's PR carries the call.
- **One owner at a time, in memory.** The store keeps a **non-persisted** `openSession: { profileId, sessionId, owner, streak } | null`. `beginSession(profileId, { owner, streak })` returns the new session id, or `null` when `openSession` already belongs to that profile (a story opened from inside a quest joins the quest's session), except that a `streak: true` request over the profile's time-only session ends it and takes over, so a quest begun over a story or the level check still moves the streak and sends `session.start`. `endSession(profileId, sessionId)` ends only that session and clears `openSession`; a caller that received `null` does nothing on unmount. The old one-argument form is removed in the same PR.
- **Orphans are never joined.** On hydrate, any persisted session without `endedAt` is an orphan (the app was killed or the tab closed): it is never joined and keeps no duration (a practice day with 0 minutes). Joining is decided only by the in-memory `openSession`, which is empty after every start.
- **Background ends a session.** On `AppState` `background` (native) and on `pagehide` / `visibilitychange` to `hidden` (web, `platform/` wrapper), the open session ends with the elapsed time; when the screen becomes visible again while still mounted, it begins a new session. A screen held while the app is already hidden (a tab opened in the background) begins only once it is visible (`isAppVisible`). A write on `pagehide` is best effort (the persisted store may not flush); a lost end leaves an orphan, counted as 0 minutes, never as hours.
- **Cap.** A session's counted seconds are capped at **60 minutes** (`SESSION_COUNT_CAP_S = 3600`), so a tab left open never inflates the minutes.
- **The learner's streak does not change** (OD-19). `streak: true` (the quest player, today's behaviour) advances `streakDays` and sends `session.start` as today; the new callers pass `streak: false`: they record time only, never touch `streakDays` and send no `session.start`. Nothing a learner sees changes. Report practice days and the report's W9 line count story, game and level-check days (section 3.2).
- **Time-only sessions are told apart by their id** (RP-3b). A `streak: false` session's id starts with `session:time:` (`TIME_ONLY_SESSION_PREFIX`, `apps/mobile/src/logic/sessions/session-log.ts`); a quest session keeps today's `session:<startedAt>`. Every streak reader reads only the other sessions: `nextStreak`'s last session day in `beginSession`, `computeStreak` on Home and in the sync merge (`mergeSnapshots`). The id travels through every build and the Worker unchanged, so no new snapshot field or preserve rule is needed. An older build (before RP-3b) that merges a time-only session counts it toward its own streak until it updates (accepted: a learner-visible difference only on an outdated build, and only upward). A time-only session sends no `session.end` either. The stored `durationSeconds` is the elapsed time capped at `SESSION_COUNT_CAP_S`; `countedSeconds(session)` caps again on read, for sessions written by older builds; the grown-up dashboard and `summarize().minutesLast7d` read minutes through it too.
- **Grown-up figures (RP-3b review).** The Parent dashboard's "Sessions" stat counts quest sessions only (`practiceTotals`), so a story, game or level-check visit adds minutes, never a session; its "Minutes" and `summarize().minutesLast7d` (the synced summary, the roster) now include story, game and level-check time (OD-19) and cap each session at 60 minutes. A quest split by a trip to the background still shows as more than one session (one per visible stretch).
- **Telemetry (RP-3b review).** `session.start` / `session.end` stay paired per visible stretch of a quest session: a return from the background sends a new `session.start` (on Android a system permission dialog can also move `AppState` to `background`), and `session.end` `durationSeconds` is capped at 3600 from RP-3b on. Analytics that count `session.start` as visits or average `session.end` durations read a discontinuity at this release.
- **Known risk: `sessions[]` growth.** Each story, game or level-check visit and each return from the background adds a row (about 150 bytes), and `sessions[]` has no retention; the snapshot is one stored value and one D1 `payload_json` row (about 2 MB each at most). At three rows a day that is years away, but a follow-up (not yet a PR row; the owner decides) should compact ended sessions older than the 35-day report window into per-day totals before save and upload.

**3.3.3 The wire field.**

```ts
// packages/content-schema/src/schemas/report.ts
export const REPORT_DAYS_MAX = 35;        // this week + last week + the calendar month to date
export const REPORT_MONTHS_MAX = 24;
export const REPORT_MILESTONES_MAX = 16;
export const REPORT_DAY_LETTERS_MAX = 12;
const COUNT_MAX = 100_000;
const DayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDay); // a real calendar day
const MonthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const ReportLetterSchema = z.string().regex(/^[\u3131-\u318E]{1,2}$/); // Hangul compatibility jamo, never free text
const ReportStageKeySchema = z.string().regex(/^[a-z0-9-]{1,32}$/);
const QuestIdSchema = z.string().min(1).max(64);
const Count = z.number().int().nonnegative().max(COUNT_MAX);

export const ActivityDaySchema = z.object({
  d: DayKeySchema,
  min: Count,                                  // minutes: round(sum of counted session seconds started that day / 60)
  q: Count,                                    // quests finished for the first time that day (questDoneAt)
  c: Count,                                    // cards collected that day (cards[].unlockedAt)
  w: Count,                                    // words met for the first time that day (vocab item `first`); 0 until F-VOC-005 writes the slice
  j: z.array(ReportLetterSchema).max(REPORT_DAY_LETTERS_MAX), // letters that first showed as strong that day (3.3.4)
});
export const ActivityMonthSchema = z.object({
  m: MonthKeySchema, min: Count, q: Count, c: Count, w: Count,
  days: z.number().int().nonnegative().max(31), // practice days in that month
});
export const ActivityNextSchema = z.union([
  z.object({ q: QuestIdSchema, plan: z.boolean() }).strict(), // F-ENT-003 routeNext's quest; plan = it came from the active plan
  z.object({ end: z.literal(true) }).strict(),                // F-ENT-003 'free-end'
]);
export const ActivitySummarySchema = z.object({
  v: z.literal(1),
  tz: z.number().int().min(-840).max(840),    // minutes east of UTC when computed
  asOf: DayKeySchema,                          // the device's local today when computed
  days: z.array(ActivityDaySchema).max(REPORT_DAYS_MAX),       // only days with activity, ascending
  months: z.array(ActivityMonthSchema).max(REPORT_MONTHS_MAX), // only months with activity, ascending, newest 24
  total: z.object({ since: DayKeySchema.nullable(), min: Count, q: Count, c: Count, w: Count, days: Count }),
  milestones: z.array(z.object({ stage: ReportStageKeySchema, on: DayKeySchema })).max(REPORT_MILESTONES_MAX),
  next: ActivityNextSchema.optional(),         // absent before F-ENT-003 E3-4 is on main, and at 'rest'
  revisit: QuestIdSchema.optional(),           // the quest P1 offers (3.3.4 step 9)
}).superRefine(/* days and months strictly ascending, no repeats, nothing after asOf */);
export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;

// packages/content-schema/src/schemas/sync.ts — ProgressSummarySchema gains (schemaVersion stays 1):
activity: ActivitySummarySchema.optional().catch(undefined),
```

- **Tolerant**: a malformed or oversized `activity` is dropped, never a 422 (the pattern of `journey`, `sync.ts:43-48`). Backend test: "malformed activity: PUT still 200, activity dropped". A dropped `activity` reads as the `legacy` state, whose copy is neutral (section 3.14), unless the upload carries the latch and an activity is already stored: then the stored one stays (section 3.3.1).
- **Size**: at most about 4.2 KB (35 day rows with up to 12 short letter keys each; typical well under 1.5 KB). The bounds stop a tampered client from growing every roster that copies it.
- **Totals are exact and monotonic**: `total` is computed from the whole snapshot (all sessions, all latched quests that are completed, all cards, all words), not from the bounded arrays. `total.q`, `total.c`, `total.w` and `total.days` never decrease except after a profile reset (property test); `total.min` never decreases because sessions are append-only and unioned.

**3.3.4 How the device computes it** (`apps/mobile/src/logic/reports/activity.ts`, pure, 100 % covered, RP-4): `buildActivity({ snapshot, now, questJamo, localDay, routeNext?, isQuestOpen? })` where `localDay(iso)` is the device's calendar day of an instant (injected for tests).

1. Minutes and practice days: each session's `startedAt` -> `localDay`; counted seconds (capped, section 3.3.2) summed per day, then rounded to minutes per day.
2. `q`: each `questDoneAt` value **whose quest is completed in the snapshot** -> `localDay`.
3. `c`: each `cards[].unlockedAt` -> `localDay`.
4. `w`: each vocab item's `first` (already a local day key, F-VOC-005) when the slice exists.
5. `j` (letters that became strong): for each letter in `questJamo`, the earliest `questDoneAt` among completed quests that teach it and whose best accuracy is at least `RECOGNIZED_ACCURACY` (0.8, `summarize.ts:86`). The day is the first finish of a quest in which the letter is **now** strong (the best run may be a later replay; documented approximation). A letter appears on at most one day.
6. `milestones`: each `stageDoneAt` entry -> `{ stage, on: localDay }`, ascending by day.
7. `days` keeps the newest 35 local days **ending at `asOf`** that have activity; `months` keeps the newest 24 months with activity; both ascending.
8. `next`: the result of F-ENT-003's `routeNext` with the same input the Home card uses (F-ENT-003 section 3.5): a quest -> `{ q, plan: source !== 'cursor' }` (F-ENT-003's `NextSource` is `'class' | 'school' | 'family' | 'self' | 'cursor'`; `'cursor'` is the default route); `free-end` -> `{ end: true }`; `rest` -> absent. While `routeNext` is not on main (before F-ENT-003 E3-4), `next` is absent and the report shows no "next" line (section 3.6 P4). So the report's next is always the app's next.
9. `revisit`: the first quest in catalogue route order whose `teaches` contains `needsPractice[0]` and that F-ENT-003's `isQuestOpen` allows for this learner (before F-ENT-003 E3-2 every quest is open); absent when none.

`store/sync-store.ts` computes it next to `journey` and passes it into `summarize` as an input (`SummarizeInput.activity`), so `summarize.ts` stays pure (the F-ROUTE-001 R-8 pattern). The in-app report (section 3.9) calls the same function on the local snapshot.

### 3.4 The pure report module (`packages/content-schema/src/reports/`, 100 % covered)

One module, imported by the Worker (class aggregates), the console (learner report) and the learner app (in-app report), so the three cannot disagree.

| File | Exports | PR |
|---|---|---|
| `windows.ts` | `todayFor(now, tz)`, `windowOf(period, today, at?)` -> `{ from, to, prevFrom?, prevTo?, totalsOnly }`, `stepOf(period, today, at, dir, activity)`, `horizonOf(window, asOf)`, `sumDays(days, from, to)`, `practiceDaysIn(days, from, to)`, `localRunEndingAt(days, asOf)`, `monthOf(day)` | RP-2a |
| `learner-report.ts` | `learnerReport(input): LearnerReport` (section 3.5) | RP-2a |
| `insights.ts` | `wentWell(ctx)`, `practiceNext(ctx)`, `INSIGHT_CODES`, the rule tables of section 3.6 | RP-2b |
| `class-report.ts` | `classReport(input): ClassReport` (section 3.7) | RP-2c |
| `index.ts` | re-exports; added to `packages/content-schema/src/index.ts` (append-only shared file) | RP-2a |

Every function is pure: time comes in as `now`, the catalogue as an argument (`packages/content-schema/src/catalog`, for quest titles and the `teaches` lists), and the result is codes and numbers, never sentences. Sentences are built by the renderer from `packages/i18n` (section 3.11).

### 3.5 The learner report (per-learner dashboard)

**Input** (`LearnerReportInput`): `summary` (the projected roster summary for a console viewer, the full local summary for the in-app viewer; `null` when the server holds none), `viewer: 'family' | 'class' | 'device'`, `voice: 'third' | 'second'` (`second` only for the device viewer on a self-only device, section 3.9), `period`, `at?`, `now`, `catalog`, `lastSyncedAt` (null on the device). The input type has **no field for any other learner and no class figure**; a test asserts the type's keys (section 5).

**Output** (`LearnerReport`, codes and numbers only):

1. **`state`**: `no_data` (no summary stored: the learner's device has never saved progress to this space) · `empty` (a summary exists and nothing was ever practiced: `activity.total.days == 0`, or without `activity`, no quest, no card and no `lastActiveAt`) · `legacy` (a summary without `activity`: an app build from before RP-4, or an `activity` the Worker dropped) · `ready`.
2. **`stale`**: `null`, or `{ lastSaved }` when `lastSyncedAt` is more than 7 days before `now` **or** `activity.asOf` is more than 7 days before the viewer's today. Figures still render; one neutral line and an action line (section 3.14).
3. **`horizon`**: `{ asOf, partial }`, `partial` when the window reaches past `asOf` (section 3.2).
4. **At a glance** (two lines, period-independent, rendered in `legacy` too): `nowOn` (`journey.here`, with the **Open Learning Route** link, section 3.6 seams) and `lastPractice` (`lastActiveAt`).
5. **Headline**: one code chosen by fixed order: `stage_done` (a milestone in the window) > `practiced` (practice days > 0) > `none_saved` (the whole window is after `asOf`) > `none_yet` (no practice in the window); `getting_started` replaces `practiced` and `none_yet` while the learner has fewer than 2 practice days ever. Params: name, days, quests, period.
6. **`wentWell`** (up to 3) and **`practiceNext`** (up to 3): section 3.6.
7. **Figures** for the window: practice days, minutes, new quests, new cards, new letters (count of `j`), new words (only when the viewer may see words, section 3.10). Each figure may carry `up: true` when it grew against the previous window (week, month only). A figure that did not grow carries nothing: **no down arrow, no "less than", no red** (OD-11).
8. **Calendar**: `week` -> 7 day cells; `month` -> one cell per day to date (none for a totals-only month); each `{ day, kind: 'practiced' | 'none' | 'not_saved', minutes }`. `day` and `all` have none.
9. **Growth** (`all` only): cumulative quests and cards per month, from `total` minus the sum of `months` (the "earlier" baseline) and then the running sum of `months`. A cumulative line **only rises** (a meter that only fills; OD-10). No per-month bars.
10. **More detail** (one block, collapsed by default): letters `strong` (up to 24), `practicing` (up to 3), `newInWindow` (from `days[].j`); totals since the start (`total.q` else `stage1.questsDone`, `total.c` else `cardsUnlocked`); starting spot (`placement.level`, shown with the roster's own words, section 3.11); milestones in the window (`all`: every milestone); the level check (newest `takenAt`, `level`, strand statuses for `hangul-recognition`, `sound-letter`, `syllable-reading`, `vocabulary`, `sentences`; `oralStage` is never read; no counts, no percentages); the plan (`class` viewer: this class's plans from `planProgress`, already filtered to the viewing space by `roster-summary.ts`; `family` viewer: the family space's plans plus `selfRoute` counts; `device` viewer: every plan on the device plus the self-route; shown as "N done" and "N ready to play"; `notReady` items are omitted, never called "locked").

**Layout: three layers** (owner items 2 and 13; wireframe `reports/learner-report.md`). The grown-up's question is answered before any number.

| Layer | Content | Visible |
|---|---|---|
| 1 | header (back, name + "Report", **Print**, **Send a note** when available), the two at-a-glance lines, the period tabs and stepper, the headline, **What went well**, **What to practice next** | above the fold at 390 x 844 (e2e check: the headline and the first went-well line are visible without scrolling) |
| 2 | **This period**: figures and the calendar (or the growth line for `all`) | next |
| 3 | **More detail**: one disclosure button (`aria-expanded`) holding everything of item 10 | collapsed; opened on demand; always expanded in print |

**Rules that hold for every viewer**

- **No percentages** on a learner report (OD-6): letters are named, strands are words ("secure", "getting there", "next to learn", "not checked yet"). `stage1.anchorAccuracy` is not rendered here (it stays on the existing roster roll-up only).
- **No comparison with anyone else**: no class figure, no "average", no position. The page fetches that learner only (section 3.8).
- **Third person, warm** for grown-ups ("Mina practiced on 3 days this week."); **second person** for a self-only device (section 3.9). The display name is the roster's (initials when the class anonymizes, `rosterName`).
- **Nothing is ever taken away**: figures for a past window never shrink when the learner keeps practicing (property test over random activity sequences: for a fixed window in the past, `days` changes only by adding).

### 3.6 "Went well" and "practice next" (rule-based, deterministic)

Each line is `{ code, params, links? }`. Rules run in table order; the first three that fire are kept; a rule fires only when its data is present (a missing `activity`, `placement`, `journey` or `vocab` silently skips it). `params` holds counts, stage keys, letter keys, strand ids and catalogue quest ids only.

**Went well**

| # | Code | Fires when (in the window, days up to `asOf`) | Params | Periods |
|---|---|---|---|---|
| W1 | `stage_done` | a milestone falls in the window | `stage` | all four |
| W2 | `letters_new` | at least 1 letter in `days[].j` (`all`: the day rows the summary holds, the last 35 days) | `letters` (up to 5, in order learned) | all four (not on a totals-only month) |
| W3 | `practice_days` | practice days >= 1 (day), >= 2 (week), >= 4 (month), >= 5 (all), and the headline is not `practiced` (which already states the days) | `days` | all four |
| W4 | `minutes_up` | minutes > previous window's minutes, previous > 0 | `minutes`, `period` | week, month |
| W5 | `quests_new` | new quests >= 1 | `count` | all four |
| W6 | `cards_new` | new cards >= 1 | `count` | all four |
| W7 | `level_secure` | the newest level check was taken in the window and at least one strand is `secure` | `strands` (up to 2) | week, month, all |
| W8 | `plan_done` | a plan of this viewer has `done == total > 0` | `done`, `kind` (`class` homework or `family` plan) | all four |
| W9 | `streak` | the local run of section 3.2 is >= 3 days | `days` | day, week |
| W10 | `words_new` | new words >= 5 (only when words are visible, section 3.10) | `count` | week, month, all |
| W0 | `showed_up` | **last resort**: no other W-line fired and practice days in the window >= 1 | `days`, `period` | all four |

- **Never empty after practice.** W0 guarantees at least one went-well line whenever any practice happened in the window (one practice day in a week, the common `day` case).
- **No empty heading.** A section with no lines is not rendered at all (no heading, no "nothing here"). With no practice in the window, "What went well" is hidden and the headline carries the neutral sentence: no W-line fires then, whatever else the window holds (a run that ended the day before, a level check, a milestone).

**Practice next** (an invitation, never a warning)

| # | Code | Fires when | Params | Action / link |
|---|---|---|---|---|
| P0 | `rhythm` | no practice day in the window (week, month only) and the window is not after `asOf`; when it fires it is always first | — | none |
| P1 | `letters_revisit` | `needsPractice` is not empty | `letters` (up to 3); `questId` = `activity.revisit` (an open quest that teaches the first letter, section 3.3.4 step 9; none in `legacy`) | **Add to a plan** with `questId` (console viewers with `plan.write`); the sentence names letters only (`letters_revisit` has no quest slot), so the quest travels only in **Add to a plan** and the line's Browse links are its letters (RP-13) |
| P2 | `strand_next` | the newest level check has a strand `getting-there` (preferred) or `not-yet`, in the order hangul-recognition, sound-letter, syllable-reading, vocabulary, sentences | `strand` | the line carries a fixed tip per strand (section 3.11), linked to Browse (RP-13) |
| P3 | `plan_open` | `total - done > 0` for a plan of this viewer | `count`, `kind` | **Open the plan** (opens that plan in the builder) for console viewers with `plan.write` |
| P4 | `next_in_plan` / `next_on_route` / `free_days_done` | `activity.next` is `{ q, plan: true }` / `{ q, plan: false }` / `{ end: true }` | `questId` (the first two) | none; the line names the quest, the same one the learner's Home shows (F-ENT-003); class and school viewers always read `next_on_route` (section 3.8: `plan` is `false` for them) |
| P5 | `words_revisit` | `vocab.needsPractice` is not empty and words are visible | `words` (up to 3) | none |

- `day` keeps only W-lines plus P1 (no daily nudging).
- When a learner has fewer than 2 practice days ever, `practiceNext` holds only P4 (or nothing) and the headline uses `getting_started` (the F-PAR-001 "too little data" idea, in this spec's words).
- **Free plan** (F-ENT-003). P1 offers only a quest that is open to that learner (`activity.revisit`). P4 follows `routeNext`, so the report never names a closed lesson as next and never disagrees with the learner's Home. At `free-end`, P4 reads "{name} finished the free lessons." (family and device viewers; the roster projection drops `next.end` for class viewers, section 3.8, because a family's plan is not a teacher's business). No report line ever mentions a plan to buy, a price or a sales link.
- **Actions** are console actions: a `device` viewer's line carries no `links` (the in-app report is not a plan builder), and a console renderer still shows them only with `plan.write`. They never change learner data by themselves: **Add to a plan** opens the plan builder (`ROUTES.spacePlan`, kind-aware) with the quest pre-added as a draft item (RP-10, `&add=<questId>`); nothing is published until the grown-up publishes.
- **Browse links** (F-BROWSE-001 section 4.11 item 2; RP-13, after BR-10): every letter chip on the page (went-well letters, practice-next letters, More detail letters) calls `openBrowse({ kind: 'char', char }, 'report')`; the P4 quest title calls `openBrowse({ kind: 'quest', id }, 'report')` (P1 names no quest, so it has no quest link); each strand tip calls `openBrowse({ kind: 'stage', stage }, 'report')` with `journey.here` (else `stage1`). The link is **always present** once RP-13 ships, for every viewer: F-BROWSE-001's access screen or sampler answers a grown-up who does not pay, so the report shows no lock and no price. The link carries **content ids only** (F-BROWSE-001 BD7): never a learner id, name or summary value (test). Before RP-13 a chip shows its romanization and gloss on tap.
- Review-test lines (F-RVW-001) join later as W- and P-rows in a follow-up amendment, once `reviews[]` is written; until then nothing reads it.

**Seams on the page (owned here, target pages owned by the siblings)**

- **Open Learning Route** (owner item 11; the Learning Route amendment's section 2 table and LR-8): the at-a-glance line "Now on Stage {n}: {stage}" carries the link **Open Learning Route** to `ROUTES.learnerRoute(spaceId, learnerId)` as the amendment defines it (kind-aware with the same family / class rule once that spec adopts F-APP-001's paths). In the in-app report the same link opens the adult read-only route view of the amendment (when present). The link renders only when that route exists on the build.
- **Send a note** (owner item 7; F-FEEDBACK-001): a header button, **not** in the insight slot, so a note is never tied to a "practice next" line (F-FEEDBACK-001 section 9: the composer never suggests who "needs" a note). It renders when `NEXT_PUBLIC_NOTES_ENABLED` (F-FEEDBACK-001's console flag) is on, the space is not archived, and the viewer's role may send (`feedback.send`: family caregiver or owner, class teacher or owner; never a school admin). It links to F-FEEDBACK-001's composer with the learner preselected: `/teach/space/notes?id=<spaceId>&learner=<learnerId>` (or that spec's kind-aware constant, F-FEEDBACK-001 OD-16). RP-12, after FB-11.

### 3.7 Class statistics (teacher; aggregates only)

**Input** (`ClassReportInput`): the class's projected summaries (no ids, no names: the Worker passes summaries only), the class's plans `{ id, title, archivedAt }`, `period`, `at?`, `now`.

**Output** (`ClassReport`, `v: 1`), every number an aggregate:

| Block | Content | Rule |
|---|---|---|
| Headline | `class_practiced` with `practiced` and `learners` ("{count} of {total} learners practiced this week.") | first line under the tabs; up-only marker when `practiced` grew |
| Class | `learners` (members), `withActivity` (summaries with `activity`), `olderApp` (summaries without it), `notSaved7d` (`lastSyncedAt` or `asOf` older than 7 days) | `olderApp` gets one neutral line, "N learners have an older app: their day-by-day figures appear after an update" |
| What went well (class) | `lettersNew`: up to 5 letters newly strong in the window with the number of learners for each, ordered by count then by letter order; `questsNew`, `cardsNew` (sums); stage milestones (events in the window, OD-4) | labelled "Letters the class got strong on"; letters are content, not people |
| Practice together | up to 5 `needsPractice` letters with learner counts (the roll-up's top 3, widened); when `lectureModeEnabled()` the page links **Plan a lesson** to `ROUTES.spaceLecture(id, 'revisit')` (F-TCH-004) | labelled "Letters to revisit together"; the roll-up stays as is |
| Practice | `practiced` (learners with >= 1 practice day in each learner's own window); `dayBands` — week: `0`, `1-2`, `3-4`, `5-7`; month: `0`, `1-4`, `5-9`, `10+`; day: practiced / not yet; all: omitted | the `0` band is labelled "Not yet" and never highlighted |
| Time | `minutesTotal`; `minutesMedian` over learners who practiced, **null when fewer than 3 practiced** | no mean per learner, no maximum, no minimum |
| Level check | per strand, counts of `secure`, `getting-there`, `not-yet`, `not-tested` among learners with a check (OD-5) | counts only; no names; no level distribution; laid out as a stacked list per strand at phone width |
| Plans | up to 3 non-archived plans, newest first: `{ planId, title, assigned, started, finished, itemsDone }` from `planProgress` | `assigned` = learners with `total > 0`; no per-learner rows |
| Up-only | `practiced`, `minutesTotal`, `questsNew` carry `up: true` when they grew against the previous window | never a down marker |

Layers as on the learner report: layer 1 = headline, what went well (class), practice together; layer 2 = practice bands and time; layer 3 = **More detail** (level check, plans).

**Hard rules** (a test per rule, section 5): the result contains **no learner id, no name, no avatar and no per-learner array**; nothing is ordered by any learner's figure; there is no "top", "most", "least", "best" or "lowest" field; no standing distribution by stage or level (OD-4 keeps F-ROUTE-001 section 3.12); the class report is **never shown to a family viewer** and a family space has **no** class report (siblings must never be compared: the endpoint answers 409 for a family space). School-wide statistics stay `SchoolAdmin` (F-SCHOOL-001); a school report is out of scope.

### 3.8 Worker routes (additive; `packages/backend/src/routes/space-reports.ts`, mounted `app.route('/api/spaces', spaceReportRoutes)` in `app.ts` next to the other `/api/spaces` routers, `app.ts:56-66`)

**Narrow reads** (RP-5, RP-5b). `Db` (`db/types.ts`, `d1.ts`, `memory.ts`) gains `summaryOf(learnerId)` and `summariesOf(learnerIds)`, which select **only** `learner_id, summary_json, updated_at` (never `payload_json`), and `learnersOf(ids)`, all batched as `IN (...)` lists chunked at 100 bound parameters (D1's limit). The report routes never call `getSnapshot` (`SELECT *`). No migration. The roster route keeps its own reads (out of scope).

**`GET /api/spaces/:id/learners/:learnerId/report?period=<p>`** (RP-5)

- Auth: Clerk session (as every console route). `findSpace(c, db, id, true)` + `requireCan(..., 'summary.read')` exactly as the roster (`routes/spaces.ts:350-356`): **archived spaces are served read-only**, like the roster.
- 409 `wrong_kind` for a `school` space (its admin uses the class's route). 404 `not_member` when `learnerId` is not a learner member of the space (no hint whether the learner exists elsewhere).
- 200 body (`LearnerReportResponseSchema` in `schemas/report-response.ts`, next to `ClassReportResponseSchema`; both exported from the package index):
  `{ space: publicSpace(space), learner: { id, displayName: rosterName(space, ...), avatar, joinedAt, lastActiveAt }, summary: rosterSummary(summary, planIds, space.kind, { joinedAt }) | null, lastSyncedAt, serverTime }`. No `ageGroup` (no report block uses it; data minimisation).
  The same projection as the roster, so a report can never show more than the roster's consent allows. `payload_json` is not selected.
- `period` is used only for the server event (section 3.13); an unknown value reads as `week`.

**`GET /api/spaces/:id/class-report?period=<p>&at=<day>`** (RP-5b)

- Auth as above (archived classes read-only). 409 `wrong_kind` for `family` and `school`.
- The Worker loads the class's learner members with `learnersOf`, their stored summaries with one batched `summariesOf`, projects each with `teacherVisibleSummary` (no ids are carried forward), loads `plansOf(space.id)` and returns `{ space: publicSpace(space), period, serverTime, report: classReport(...) }` (`ClassReportResponseSchema`).
- Cost: a constant number of queries per call (at most 3 summary chunks plus one learner chunk per 100 members, plus the space and plan reads). A 300-member sqlite fixture asserts the query count and that `payload_json` is never selected. No cache in v1.

**Roster projection** (RP-W2, gated on OD-3 and on RP-0b being deployed): `activity` moves from `TEACHER_HIDDEN_SUMMARY_KEYS` (where RP-1 puts it) to `TEACHER_VISIBLE_SUMMARY_KEYS`, with item `activity` in `TEACHER_VISIBLE_SUMMARY_ITEMS`. `roster-summary.ts` gains `activityOf(value, { kind, joinedAt })` that picks known keys at every level (like `journeyOf`) and:

- **sets every `w` to 0** while `vocab` is on `TEACHER_HIDDEN_SUMMARY_KEYS`; F-VOC-005 P-4b, when it moves `vocab` to the visible list with its consent item, also stops zeroing `w` (a test pins the coupling);
- for `kind !== 'family'` (class and school viewers), **drops history from before the learner joined**: `days` and `milestones` dated before the local day of the membership's `joinedAt` (using `activity.tz`), and `months` up to and including the join month; `total`'s counts are kept, so the lifetime totals still match the roster, but `total.since` (the first practice day, which can be before the learner joined) is set to `null`; `next.end` is dropped (section 3.6 free plan), and `next.plan` is always `false`, because the flag cannot tell the class's own plan from a family plan or the learner's self-route (F-PLAN-002 section 3.10): a teacher reads the app's next quest, never whether a plan chose it;
- family viewers get the whole activity, as they get `selfRoute`.

Until RP-W2 the roster and the report routes never carry `activity`: the report shows the `legacy` state, which is harmless.

No D1 migration. No new table. Both routes are read-only.

### 3.9 The in-app report (learner app, behind the grown-up gate; RP-9)

- `ParentDashboardScreen` profile cards gain **See report** -> `PinEntry` when the 15-minute grown-up session has lapsed (`logic/profiles/session.ts`), then `LearnerReport { profileId }`. A self-only device without a PIN opens directly (`gate-route.ts` `gateOpensDirectly`), as the dashboard does today.
- **Voice** (OD-17). On a self-only device (`gateOpensDirectly` true for that device), the screen renders `voice: 'second'`: the title is "Your report" and the headline and insight lines use the `report.you.*` variants ("You practiced on 3 days this week."). Elsewhere it is third person, like the console.
- The screen builds the local summary (`summarize` with `buildActivity`) for that profile and renders `learnerReport({ viewer: 'device', ... })` with the same three layers as the console page, single column, plus the device-only **skills** rows in layer 3 ("What the quests practiced: reading, listening, writing", from `logic/my-route/skills.ts`, counts of finished quests, the F-ROUTE-001 `caregiver.skillsNote` sentence; OD-8 keeps skills off the console).
- **Words** stay hidden here too until F-VOC-005 P-4b, so the device and the console never show different figures for the same child.
- Offline: works fully offline (local data only). No print button in the app (OD-7); the console prints. No **Send a note** and no Browse links in the app (F-BROWSE-001 BR-12 owns the in-app Browse entry; letter chips expand to romanization and gloss).
- Read-only: the screen never writes progress, never sends learner telemetry and never changes the active profile.

### 3.10 Privacy and safety

- **Summary only.** Grown-ups read only the projected summary, as today (F-SYNC-001 section 3.4). The new data is **counts per local day** plus the letters that became strong per day, the app's next quest and one revisit quest id. No per-question history, no response times, no free text, no recordings, no location. `payload_json` stays device-only and is not selected by any report route.
- **Privacy notice first** (RP-0b, before RP-4 sends anything). The public privacy page (`landing.ts` privacy section, `:278-279, 316` at `ea9049e4`; F-SITE-002 keeps the legal pages) extends its progress bullet to every `activity` field: for the last 35 days, the days practiced with minutes, quests, cards and words for each; monthly totals for up to 24 months; all-time totals since the first practice day; the day each stage was finished; the letters that became strong each day; the next lesson and one lesson to revisit; and the device's time-zone offset; and says who can see them: the learner's family caregivers, and the teacher of a class the learner joined and the owner and admins of that class's school (day-by-day history from the day they joined), and moves the effective date. Korean and Spanish privacy text goes through the existing legal review (F-I18N-001 L10, English authoritative).
- **Consent text stays true** (F-SPACE-002 T-1a; RP-W2). The item `activity` sentence changes from "When {learner} was last active, minutes this week and days in a row" to **"When {learner} practiced, minutes each day and days in a row"** (Pre-A1, 11 words by the copy test's count; it enforces at most 16). Because the text is pinned to its version, RP-W2 **bumps `TRANSFER_CONSENT_TEXT_VERSION`** to `'transfer-2026-10b'`, adds the new pinned hashes in `transfer-consent.test.ts`, and keeps `'transfer-2026-10'` in `ACCEPTED_CONSENT_TEXT_VERSIONS`, so a client still showing the earlier sheet is not locked out (F-SPACE-002's rule for copy fixes). That list is checked only when a consent is recorded (`routes/transfers.ts`), never against stored records, so whether the earlier version is retired for new consents, because its `activity` line names less than a class now receives, is a counsel decision at gate G2. F-FEEDBACK-001 FB-1 (the `note_replies` item) merged after RP-W2 and bumped the version once more, to `'transfer-2026-10c'`, whose pinned hash covers both text changes; `ACCEPTED_CONSENT_TEXT_VERSIONS` is `['transfer-2026-10c', 'transfer-2026-10b', 'transfer-2026-10']`, and a test asserts that every pinned version stays accepted, so the same G2 decision covers both earlier versions. Per-day quests, cards and letters are already covered by the items `quests` ("Quests done and how many answers were right") and `cards_letters` ("Cards earned, letters learned and letters that need practice"); words stay zeroed until their own consent item exists (F-VOC-005 P-4b). The text is read today only by the class-move sheet, which stays off (CLASS_TRANSFER is never enabled); the edited item goes through the same counsel review as every consent locale (gate G2) before CLASS_TRANSFER could ever use it.
- **Data minimisation for classes**: a class viewer sees day-by-day history only from the day the learner joined (section 3.8); the lifetime totals the roster already shows stay.
- **Who can open a report**: exactly who can open the roster (`summary.read`). A learner cannot (learners have no account; device auth never reaches these routes). The in-app report sits behind the existing grown-up gate; on the app host the grown-up lock of F-APP-001 section 3.9 also applies.
- **Per-student views show only that student.** The learner route returns one learner; the view-model input has no slot for anyone else.
- **Class statistics carry no identifiers** and are never served for a family space (no sibling comparison).
- **Anonymized classes** stay anonymized: the display name comes from `rosterName`, on screen and in print.
- **Print and history**: `document.title` is the generic "Report - Hangul Route" (no learner name, so neither synced browser history nor the browser's print header carries it); the print stylesheet sets `@page { margin: 0 }` with the page padding inside the body, which suppresses the browser's default URL and title header and footer where supported, and the print button's helper line says "Turn off headers and footers in the print dialog". The printed page shows what the screen shows (layer 3 expanded), nothing more, with the footer line "Private: shared from Hangul Route" and the print date. Nothing is generated or stored on a server; there is no share link, no email and no CSV in v1 (OD-7).
- **Telemetry stays code-only on the Worker too**: `POST /api/telemetry` applies a `report.*` allow-list like the transfer one: it keeps only `scope`, `space` and `period` with their enum values and always drops `profileId`; `recordServerEvent` uses the same filter (both live in `packages/backend/src/lib/server-events.ts`, `keptEventFields`).
- **Retention**: the device sends at most 35 days and 24 months; older detail lives only on the device. Deleting a learner (`/teach/space/settings`) or leaving a space removes the report with the summary, as today.
- **No effect on the learner.** Nothing in this spec renders on a learner screen or changes what a learner is offered; the streak is untouched (section 3.3.2).

### 3.11 Copy, tone, localization

- Strings live in a new namespace `report` (`packages/i18n/src/messages/en/report.ts`), shared by the console and the learner app, plus `a11y.report` for screen-reader labels. Registered in `messages/en/index.ts`; `ko` and `es` stay `{}` overlays until native review (F-I18N-001 PR 16), falling back to English (and the console hides reports for those locales until then, section 3.1).
- Every `report.*` and `a11y.report.*` string passes, in en / es / ko: the caregiver banned list (`banned-words.json`, `caregiver` surface, which includes the learner list), plus a report-only list kept in the test (`__tests__/report-messages.test.ts`): `weak`, `weakness`, `poor`, `worst`, `rank`, `ranked`, `ranking`, `leaderboard`, `top`, `bottom`, `below`, `average`, `compared`, `should have`, `struggling`, `falling`, `lowest`, `last place` (and their es / ko equivalents when those overlays land). The report-only list matches **whole words only** (Unicode-aware word boundaries; a test asserts "Stop" and "desktop" pass). No word about speaking, pronunciation or voice. No emoji-capable symbol. Length budgets are added to `length-budget.test.ts` for every key.
- **Counts** use the i18n plural helper (`packages/i18n/src/plural.ts` `plural`) for every count key; a test renders each with 1 and with 2 ("1 day", "2 days").
- **Family words.** Lines about plans have a family variant (`kind: 'family'`): "Everything in this week's plan is done." / "{count} plan items are ready to play."; the class variant keeps "homework". `minutes_up` names the period ("More practice time than last week: {minutes} minutes." / "than last month").
- **Starting spot** reuses the roster's words: `console.placement.startingSpot` with the band label from `learner.placement.band` (the same words the learner saw), never a bare level code. Strand names reuse `caregiver.placementReport.strand` (one source for the five names).
- **Tone**: warm, plain, Pre-A1 English, third person about the learner (second person on a self-only device), second person to the grown-up only in actions ("Add to a plan"). Invitations, not warnings. Numbers are counts. An empty day, a 0 figure or a first visit is described neutrally ("No practice yet this week." followed by the P0 line).
- **Strand tips** (fixed, one per strand, `report.tip.<strand>`): hangul-recognition "Letter games help: try {game}." · sound-letter "Listening games help: try {game}." · syllable-reading "Read short words together." · vocabulary "Word cards help: try a word topic." · sentences "Read a short story together." `{game}` is the game's title from the minigame catalogue (content `minigame-config`, localized by its overlay), never a literal in `report.*`, so a renamed or translated game never leaves a stale tip.
- English drafts for every key are in Appendix A; final copy is the dictionary's.

### 3.12 Accessibility (WCAG 2.1 AA)

- Period switch: a `role="tablist"` with four tabs, arrow-key and Home / End navigation, the selected period also in the URL; on change, focus stays on the tab and a polite live region announces "Showing this week". The stepper buttons have names ("Show last week", "Show next week"). The learner app uses `SectionTabs` (`design/components/SectionTabs/spec.md`).
- Calendar cells and the growth line each have a text alternative: a list ("Practiced on Monday, Wednesday and Thursday. Not saved yet: Saturday, Sunday.") and a visually hidden table (month, quests, cards). Colour is never the only signal: practiced cells are filled shapes with a check glyph from `packages/design-system` icons, empty cells are outlines, not-saved cells are dashed outlines.
- Headings, in reading order: one `h1` (learner name or class name, plus "Report"); the two at-a-glance lines (no heading); the tabs; then `h2` **What went well**, `h2` **What to practice next**, `h2` **This period**, and the **More detail** disclosure button whose panel holds `h3` per block. Hidden sections render no heading.
- 320 px wide with no horizontal scroll; 200 % text; touch targets `touchTarget`; body text floor 18 (design-system defaults).
- Letters render with the existing `KoreanText` treatment (romanization and gloss per CLAUDE.md section 1 Languages) and a screen-reader label that names the letter and its romanization.
- Print: the token text colour on the paper surface token, no meaning carried by colour, every block within one page width, `break-inside: avoid` per block.

### 3.13 Telemetry (Worker first; `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9`; rows in `docs/roadmap/TELEMETRY-NAMES-2.md` section L)

One name, `report.viewed`, payload `{ scope: 'learner' | 'class', space: 'family' | 'class' | 'device', period: 'day' | 'week' | 'month' | 'all' }`. Codes only: **no profile id, no space id, no learner id, no name**, enforced by the Worker filter of section 3.10.

- **Console**: the console has no telemetry client, so the **Worker records the event itself** inside the two routes of section 3.8, through a new helper `recordServerEvent(name, payload)` (`packages/backend/src/lib/server-events.ts`) that appends to the same in-memory store as `POST /api/telemetry` (`routes/telemetry.ts`, `store.events`, capped at 10,000) and validates the name with `isTelemetryEventName`. Every period change or step refetches with the new `period`, so each view is one event.
- **Learner app**: `LearnerReport` sends `report.viewed` with `space: 'device'` through `track()` on open and on each period change or step, **without** `profileId` (a grown-up event, like `lecture.*`).
- **Worker first**: RP-W1 adds the name to the shared list, its exact-list test and the payload filter; it is deployed before RP-5 records it and before any app build with RP-9 sends it.

### 3.14 States, errors, offline (console pages)

| State | Learner report | Class report |
|---|---|---|
| loading | skeleton blocks with the page heading; tabs disabled | same |
| ready | section 3.5 | section 3.7 |
| no_data (no summary stored) | at a glance hidden; "No saved progress from {name}'s device yet." and the action line "Open Hangul Route on that device while online." | — |
| empty (summary, nothing practiced) | "{name} has not started yet. The report fills in after the first practice." plus the P4 line when `activity.next` exists | "No learners yet" with the join code link to the roster |
| legacy (no `activity`) | at a glance, then "Day-by-day figures are not available yet." and the action line "Open Hangul Route on {name}'s device while online to update."; layer 3 (letters, totals, starting spot, level check, plan) renders; tabs hidden | `olderApp` line; figures from learners with `activity` |
| stale (last saved > 7 days, by sync or by `asOf`) | figures render; one neutral line "Last saved {date}." and the same action line as legacy | `notSaved7d` count line |
| partial window (window past `asOf`) | "Figures up to {date}." under the headline; not-saved cells dashed; no P0 when the saved part of the window has practice, P0 when it has none (section 3.2) | each learner's window ends at their own `asOf` |
| no practice in the window | headline "No practice yet {period}."; "What went well" hidden; P0 first (week, month) | "No practice yet {period}." in the practice block; other blocks render what exists |
| not a member / wrong kind | "This report is not available." with a link to the persona home | same |
| network error | "Can't load the report right now." and Try again; cached last response shown when available (react-query cache) | same |
| offline (app host) | F-APP-001 section 3.12: the grown-up offline page | same |
| flag off or locale not reviewed | "Reports are not available yet." and the back link | same |

### 3.15 Behaviours (Given / When / Then; counts on the frozen fixtures of section 5)

1. **Given** a learner who practiced on Mon, Wed and Thu this week for 12, 9 and 15 minutes and finished 2 new quests, **when** a parent opens the week report, **then** the headline reads "Mina practiced on 3 days this week.", the first went-well lines are visible without scrolling at 390 x 844, figures show 3 days, 36 minutes, 2 quests, and the calendar fills three cells.
2. **Given** last week had 40 minutes and this week has 36, **when** the week report renders, **then** no minutes comparison appears (W4 does not fire) and nothing says "less".
3. **Given** a learner replays a quest finished three weeks ago, **when** today's report renders, **then** `q` for today is 0 (the latch keeps the first day) and the minutes count today.
4. **Given** `needsPractice = ['ㅂ', 'ㅅ']` and `activity.revisit = 'letters-q2'` (open, teaches ㅂ), **when** a teacher opens the report, **then** P1 reads "ㅂ (b) and ㅅ (s): worth another visit." with an "Add to a plan" action that opens the builder with `letters-q2` as a draft item.
5. **Given** a class of 12 where 2 learners practiced this week, **when** the teacher opens the class report, **then** the headline reads "2 of 12 learners practiced this week.", `minutesMedian` is null and the time block shows only the total.
6. **Given** a family space with two siblings, **when** a caregiver requests `/class-report`, **then** the Worker answers 409 `wrong_kind` and the console has no link to it.
7. **Given** a learner on a build without RP-4, **when** the report opens, **then** the state is `legacy`, the at-a-glance lines and layer 3 render from today's summary, the action line says how to update, and no period figure is invented.
8. **Given** an old build uploads a snapshot without `questDoneAt` after a newer build synced, **when** the Worker stores it, **then** the stored `questDoneAt` and `summary.activity` are kept (also when the stored latch is `{}`).
9. **Given** a class that anonymizes its roster, **when** the teacher prints a learner report, **then** the printed name is the initials shown on screen and `document.title` holds no name.
10. **Given** the newest level check has `sound-letter: getting-there`, **when** the month report renders, **then** P2 reads "Sounds of letters is next to grow." with the sound-letter tip, and `oralStage` appears nowhere.
11. **Given** a learner who practiced on one day this week only, with no new quest, card or letter, **when** the week report renders, **then** "What went well" holds exactly W0 "Mina practiced on 1 day this week."
12. **Given** a learner who joined the family yesterday and whose device has never synced, **when** the parent opens the report, **then** the state is `no_data` and the page never says the learner has not practiced.
13. **Given** `activity.asOf` is 4 days before the viewer's today and the learner practiced every day up to `asOf`, **when** the week report renders, **then** 3 cells are filled, 4 are dashed "not saved yet", "Figures up to {date}." shows, and no P0 line appears.
14. **Given** a free learner at F-ENT-003's `free-end`, **when** the parent opens the report, **then** P4 reads "Mina finished the free lessons." with no price or link; **when** the class teacher opens it, **then** no P4 line renders.
15. **Given** a learner who joined a class on the 10th and practiced at home on the 3rd, **when** the teacher opens the month report, **then** the 3rd shows as an empty cell and is counted nowhere; `total` matches the roster.
16. **Given** a profile reset after 5 finished quests, **when** the device syncs and the server unions the old latch back, **then** `total.q` on the next summary is 0.

## 4. Out of scope

- A learner-facing report, a learner "stats" page, or any change to learner screens (owner item 5 belongs to F-APP-001 and the Learning Route amendment).
- Speaking in any form (owner decision 2026-10-10).
- A school-wide report (F-SCHOOL-001's aggregate stays); cross-class comparison of any kind.
- Push notifications, email digests, share links, CSV export (OD-7, OD-15).
- Review-test results (F-RVW-001 draft; a later amendment adds W/P rows).
- Word figures before F-VOC-005 P-4b (hidden for every viewer, console and device, until then).
- A server-side history table, server reads of `payload_json`, or any D1 migration.
- Changing the learner's streak rule (UTC days) or the roster roll-up.
- "Previous / Next learner" on the teacher's report (v1 goes back to the roster; a later amendment may add it in roster order, never sorted by a figure).
- The notes composer (F-FEEDBACK-001), billing views (F-BILL-002), the lesson browser (F-BROWSE-001), the persona frame and homes (F-APP-001), the intro site (F-SITE-002) and the Learning Route page (Learning Route amendment): this spec only links to them (section 6.3).

## 5. Tests

Fixtures: `packages/content-schema/src/reports/__tests__/fixtures/activity-2026-10.ts` (four learners: a steady week, a learner with a gap, a learner on an old build, a learner whose `asOf` is 4 days old), the frozen catalogue `packages/content-schema/src/__tests__/fixtures/catalog-2026-10.ts`, a 20-learner class fixture built from them, and a 300-member backend fixture.

| File | Level | Coverage |
|---|---|---|
| `content-schema/src/__tests__/report.test.ts` | unit, 100 % | `ActivitySummarySchema` bounds (35 / 24 / 16 / 12), day and month key formats, `next` union strictness, `.catch` drops a malformed `activity` from `ProgressSummarySchema`; an old summary parses; response schemas (no `ageGroup`) |
| `content-schema/src/__tests__/progress.test.ts` (extend) | unit | `questDoneAt` optional; old snapshot parses |
| `content-schema/src/__tests__/sync.test.ts` (extend) | unit | `activity` optional and tolerant |
| `content-schema/src/reports/__tests__/windows.test.ts` | unit, 100 % | `todayFor` across offsets -840..840 and around midnight; `windowOf` for the four periods incl. month boundaries, leap day and `at`; `stepOf` limits (35 days, 24 months, no step past today); `horizonOf`; `localRunEndingAt` (asOf with and without practice) |
| `…/learner-report.test.ts` | unit, 100 % | the four states and `stale` by sync and by `asOf`; at a glance from legacy fields; figures and `up` only on growth; not-saved days excluded from figures; calendar kinds; growth baseline and running sum; totals-only month; no percentage field anywhere in the output (key scan); input type has no class or other-learner key (type test with `expectTypeOf`) |
| `…/insights.test.ts` | unit, 100 % | each W and P rule fires and does not fire at its threshold; order and cap of 3; P0 first and suppressed past `asOf`; W0 only as last resort and always present after practice; empty sections produce no lines (renderer hides the heading); `day` keeps W + P1; getting-started rule; P4 from `next` (three codes); P1 uses `revisit` only; missing data skips; params carry no name or free text (schema check) |
| `…/class-report.test.ts` | unit, 100 % | headline; bands per period; median null under 3; letters and revisit ordering by count then letter; strand counts; plan rows (newest 3, archived skipped); milestones as events; output contains no `id`, `displayName`, `avatar` or array of length `learners` (deep key scan); no field named top / most / least / best / lowest |
| `…/monotonic.test.ts` | property | random activity streams: `total.*` never decreases without a reset; a past window's figures never change when later activity is added; the growth line never decreases |
| `content-schema/src/__tests__/telemetry.test.ts` (extend, RP-W1) | unit | `report.viewed` in the exact list |
| `content-schema/src/__tests__/transfer-consent.test.ts` (extend) | unit | RP-1: `activity` on the hidden list; RP-W2: `activity` on the visible list mapped to `activity`, the new item sentence passes the copy rules, `transfer-2026-10b` pinned with new hashes; every earlier version stays accepted, also after F-FEEDBACK-001 FB-1 moves the current version to `transfer-2026-10c`; every summary key is on exactly one list |
| `mobile/src/logic/reports/__tests__/activity.test.ts` | unit, 100 % | minutes per local day (injected `localDay`) with the 60-minute cap, sessions without duration, latch days counted only for completed quests (reset case), letters on first strong day only, vocab `first`, milestones, newest-35 / newest-24 trimming, totals from the full snapshot, `next` mapping from `routeNext` (quest, plan, free-end, rest, absent function), `revisit` respects `isQuestOpen`, output parses with the schema |
| `mobile/src/logic/sync/__tests__/merge.test.ts` (extend) | unit | `questDoneAt` union, earliest wins, unparseable values |
| `mobile/src/store/__tests__/progress-store.test.ts` (extend) | unit | latch written on first completion only; key always written (`{}`), also on reset; backfill once on hydrate; replay leaves it; `beginSession` returns null while `openSession` belongs to the profile and a new id otherwise; a persisted open session after hydrate is never joined; `endSession` with another id leaves the open session running; hidden / background ends the session and visible begins a new one; `streak: false` leaves `streakDays` and sends no `session.start` |
| `mobile/src/logic/sync/__tests__/summarize.test.ts` (extend) | unit | `activity` passed through when given, absent otherwise |
| `backend/src/__tests__/sync.test.ts` (extend) | integration | malformed `activity`: 200 and dropped; `questDoneAt` and `summary.activity` preserved from an old client (stored latch non-empty and `{}`); union on merge; an explicit `{}` is a value; a sent latch without `summary.activity` keeps the stored activity |
| `backend/src/lib/__tests__/roster-summary.test.ts` (extend) | unit | `activityOf` picks known keys at every level; `w` zeroed while `vocab` is hidden (coupling test with `TEACHER_HIDDEN_SUMMARY_KEYS`); class kinds drop days, milestones and months before `joinedAt`, `total.since` and `next.end`; family keeps everything |
| `backend/src/__tests__/space-reports.test.ts` | integration (memory and `test:sqlite`) | learner route: 200 for caregiver / teacher / school admin, 200 read-only on an archived space, 403 for an outsider, 404 `not_member`, 409 school, `summary: null` for a learner with no summary; class route: 200 class, 200 archived, 409 family and school; responses parse with the schemas; no `payload` or `ageGroup` key; anonymized names; one `report.viewed` event per call with codes only; 300-member class: bounded query count, `payload_json` never selected |
| `backend/src/__tests__/telemetry.test.ts` (extend) | integration | `report.*` payload filtered to `scope`, `space`, `period` enums; `profileId` dropped |
| `web/src/lib/console/__tests__/report-view.test.ts` | unit, >= 90 % | sentences from codes for every insight and state, in en, third and second voice; plurals with 1; family variants; letter labels with romanization; date formatting per locale; action links (`ROUTES.spacePlan` with `add`); Browse URLs contain content ids only; back link from `from` |
| `web/src/lib/console/__tests__/routing.test.ts` (extend) | unit | `learnerReport` and `classReport` encode ids, never take a name; family -> `/parent/learner` after RP-7c, class -> `/teach/space/learner` |
| `web/src/lib/console/__tests__/shell-nav.test.ts` (extend, RP-7c) | unit | parent **Reports** and teacher **Class reports** items are shown only with the flag on and the locale reviewed |
| `i18n/src/__tests__/report-messages.test.ts` | unit | structure; caregiver banned list and the report-only whole-word list in en / es / ko ("Stop" and "desktop" pass); no speaking words; no emoji; length budgets |
| `web/e2e/reports.spec.ts` | e2e (Playwright on `apps/web/out`, API mocked with `page.route`) | 320 x 568, 390 x 844, 768 x 1024, 1280 x 800: no horizontal scroll; at 390 x 844 the headline and the first went-well line are visible without scrolling; More detail collapsed then expandable; tab keyboard order; period and `at` in URL; legacy, no_data, empty, partial, error states; print media emulation shows the footer, expands layer 3 and hides navigation; `document.title` holds no display name; class report has no learner names |
| `mobile/e2e/web/learner-report.spec.ts` | e2e (nightly) | dashboard -> gate -> report; period tabs and stepper; offline; second voice on a self-only device; no `profileId` on the event |

Coverage: `packages/content-schema` 100 %; `packages/backend` >= 90 %; `apps/mobile/src/logic` >= 90 % with `logic/reports/` at 100 %; `apps/web` console logic >= 90 %. Pages and screens are verified by e2e. The preview-deploy gate (`.github/workflows/preview-deploy.yml:57-58`) gains `test -f apps/web/out/teach/space/learner.html` and `.../report.html` (RP-7a2, RP-8) and, after RP-7c, `test -f apps/web/out/parent/learner.html` (and the `out-console` equivalents once F-APP-001 A-3 is in).

## 6. Rollout and PR breakdown

### 6.0 Milestones

| Milestone | What the user sees at the end | PRs | Deploy gates |
|---|---|---|---|
| **M1 "History builds up"** | nothing visible; devices start sending day-by-day counts | RP-0, RP-0b, RP-1, RP-W1, RP-3a, RP-3b, RP-4 | RP-W1 and RP-0b deployed before an app build with RP-3a / RP-4 |
| **M1b "Teachers may see it"** | nothing visible; the roster carries `activity` | RP-W2 | OD-3; RP-0b deployed |
| **M2 "Per-learner reports"** (owner item 4, and item 6 per student) | parents and teachers open a learner report from the roster (and from the parent home once the shell is in), switch periods, step back, print | RP-2a, RP-2b, RP-5, RP-6, RP-7a1, RP-7a2, RP-7b, RP-7c, RP-10 | RP-5 deployed before the pages ship (pages behind the flag) |
| **M3 "Class statistics"** (owner item 6, class) | teachers open the class report | RP-2c, RP-5b, RP-8 | RP-5b deployed |
| **M4 "Shared device, siblings and launch"** | the in-app report; **Send a note** and Browse links; flags on; site claims on | RP-9, RP-12, RP-13, RP-11 | es / ko review, else `en` only |

M1 should merge as early as possible: every week it ships earlier is a week of history the first reports can show. RP-W1 carries nothing consent-related, so M1 never waits on OD-3. Total: 24 PRs, 4 Worker deploys (RP-W1, RP-W2, RP-5, RP-5b), no D1 migration.

### 6.1 PR table

| PR | Content | Size | Needs |
|---|---|---|---|
| RP-0 | `docs`: this spec; wireframes `design/wireframes/reports/{learner-report,class-report,in-app-report,print}.md`; superseded notes on `parent/learner-detail.md` and `parent/dashboard.md`; `report.viewed` row in `docs/roadmap/TELEMETRY-NAMES-2.md` section L; index rows | S | — |
| RP-0b | `feat(i18n)`: privacy page progress bullet and visibility line (section 3.10) in en; ko / es through legal review; copy test. **Deploy before any app build with RP-4** | S | RP-0 |
| RP-1 | `feat(content-schema)`: `schemas/report.ts` (activity incl. `next` and `revisit`, learner and class response schemas, `ReportPeriodSchema`), `ProgressSummary.activity`, `ProgressSnapshot.questDoneAt`; `activity` on `TEACHER_HIDDEN_SUMMARY_KEYS` with the hidden-list assertion; exports appended to `src/index.ts` | S | RP-0 |
| RP-W1 | `feat(backend,content-schema)`: `QUEST_DONE_AT` in `ADDITIVE_FIELDS`; `report.viewed` in `TELEMETRY_EVENT_NAMES` + exact-list test; `report.*` payload filter in `lib/server-events.ts` (shared by `POST /api/telemetry` and `recordServerEvent`); tests (memory + sqlite). **Deploy the Worker before RP-3a / RP-4 ship in an app build** | S | RP-1 |
| RP-W2 | `feat(backend,content-schema)`: `activity` moves to `TEACHER_VISIBLE_SUMMARY_KEYS` -> item `activity` with the new sentence; `TRANSFER_CONSENT_TEXT_VERSION` = `transfer-2026-10b`, pinned hashes, every earlier version kept in `ACCEPTED_CONSENT_TEXT_VERSIONS` (F-FEEDBACK-001 FB-1, merged after RP-W2, moves the current version on to `transfer-2026-10c` over this text); `activityOf(value, { kind, joinedAt })` (`w` zeroed, join-date clipping, `next.end` dropped for classes), and the roster route (`routes/spaces.ts:350-386`) passes each membership's `joinedAt` to `rosterSummary`, so the roster and the report project alike; tests. Deployed before RP-5b and RP-8 serve teachers with figures | S | RP-W1, OD-3, RP-0b deployed |
| RP-2a | `feat(content-schema)`: `reports/windows.ts` (incl. `at`, steps, horizon, local run), `reports/learner-report.ts` (states, stale, horizon, at a glance, headline, figures, calendar, growth, more detail), fixtures, tests | M | RP-1, OD-1, OD-2, OD-6, OD-10, OD-11, OD-18 |
| RP-2b | `feat(content-schema)`: `reports/insights.ts` (W0-W10, P0-P5, caps, order, family variants), tests | M | RP-2a |
| RP-2c | `feat(content-schema)`: `reports/class-report.ts`, class fixture, tests (hard rules) | M | RP-2a, OD-4, OD-5 |
| RP-3a | `feat(mobile)`: `questDoneAt` latch writer (key always written), one-time backfill on hydrate, `mergeQuestDoneAt` + tests | S | RP-1, RP-W1 deployed |
| RP-3b | `feat(mobile)`: in-memory `openSession`, `beginSession(profileId, { owner, streak })` returns the id or null, `endSession(profileId, sessionId)`, orphans never joined, end on background / hidden, 60-minute cap; sessions in `StoryReaderScreen`, the stand-alone `Minigame` screen and the level check (`streak: false`); quest player passes its id (`streak: true`); tests | M | RP-0, OD-19 |
| RP-4 | `feat(mobile)`: `logic/reports/activity.ts` `buildActivity` (incl. `next` from `routeNext` and `revisit` from `isQuestOpen` when F-ENT-003 E3-2 / E3-4 are on main, else absent / all open); `sync-store` passes `activity` into `summarize`; tests | M | RP-1, RP-3a, RP-W1 deployed, RP-0b deployed |
| RP-5 | `feat(backend)`: `routes/space-reports.ts` learner route, `summaryOf` (narrow select), mount in `app.ts`, server event, archived read-only, tests (memory + sqlite). **Deploy before RP-7a2 ships** | S | RP-1, RP-W1 |
| RP-5b | `feat(backend)`: class route, `summariesOf` / `learnersOf` batched and chunked, 300-member query-count test. **Deploy before RP-8 ships** | M | RP-2c, RP-5 |
| RP-6 | `feat(i18n)`: `report` namespace (en, incl. `report.you.*`, family variants, plurals) and `a11y.report`, registration, `report-messages.test.ts` (whole-word list), length budgets | S | RP-0 |
| RP-7a1 | `feat(web)`: `lib/console/report-view.ts` (sentences, voices, back link, links), API client `getLearnerReport`, `ROUTES.learnerReport` and `ROUTES.classReport` (family branch on `/teach/space/learner` until RP-7c), `reportsEnabled(locale)` in `config.ts`, tests | M | RP-2a, RP-2b, RP-6 |
| RP-7a2 | `feat(web)`: learner report page `/teach/space/learner` in three layers (header with Print, at a glance with **Open Learning Route** when LR-8's route exists, tabs and stepper, headline, went well, practice next, this period, More detail, every state), roster card **See report**, generic `document.title`, preview gate line | M | RP-7a1, RP-5 deployed, design mock |
| RP-7b | `feat(web)`: all-time growth line with its table alternative; the shared print rules in `apps/web/src/app/globals.css` (`@media print`, layout only: hide `.hr-console-shell-nav` / the adult frame navigation and `.hr-report-actions`, expand More detail, `@page { margin: 0 }`, `break-inside: avoid` per block; colours stay inline from tokens, the file's own convention) and **Print or save as PDF** on the learner report | S | RP-7a2 |
| RP-7c | `feat(web)`: `app/(console)/parent/learner/page.tsx` (same component; the parent chooser without `learner`), `ROUTES.learnerReport` family branch -> `/parent/learner`, the parent home card **Open** -> the learner report (week, `from=home`), `ADULT_NAV` parent **Reports** (`/parent/learner`) and, if RP-8 is merged, teacher **Class reports**; back link `from`; preview gate line | S | RP-7a2, F-APP-001 A-5a and A-5b merged |
| RP-8 | `feat(web)`: class report page `/teach/space/report` in layers (and the class chooser without `id`), `getClassReport`, roll-up **Class report** link, **Plan a lesson** behind `lectureModeEnabled()`, print button (reuses the RP-7b stylesheet), teacher **Class reports** nav item if RP-7c is merged, preview gate line | M | RP-2c, RP-5b deployed, RP-6, RP-7b, design mock |
| RP-9 | `feat(mobile)`: `LearnerReport` screen (behind the gate, three layers, second voice on self-only devices, skills rows, words hidden), dashboard **See report**, `report.viewed` without `profileId`, flag | M | RP-2a, RP-2b, RP-4, RP-6, design mock |
| RP-10 | `feat(web)`: plan builder accepts `&add=<questId>` and adds it as a draft item; insight actions link to it | S | RP-7a2 |
| RP-12 | `feat(web)`: **Send a note** header button on the learner report (flag, role and archived rules of section 3.6) linking to F-FEEDBACK-001's composer with the learner preselected; test | S | RP-7a2, F-FEEDBACK-001 FB-11 |
| RP-13 | `feat(web)`: Browse links on letter chips, P1 / P4 quest titles and strand tips through `openBrowse(..., 'report')`; test that URLs hold content ids only | S | RP-7a2, F-BROWSE-001 BR-10 |
| RP-11 | `test(e2e)`: `web/e2e/reports.spec.ts`, `mobile/e2e/web/learner-report.spec.ts`; flip both flags; flip F-SITE-002's `parentReports` and `teacherReports` claims with their copy test (F-SITE-002 claim hand-off) | S | RP-7b, RP-7c, RP-8, RP-9, es / ko review (else `en` only) |

### 6.2 Sequence notes

- Shared append-only files: `packages/content-schema/src/index.ts`, `schemas/telemetry.ts` and its test, `messages/en/index.ts`, `lib/console/shell-nav.ts` (F-APP-001's registry). Append, never reorder.
- RP-7a2 edits `app/(console)/teach/space/page.tsx` (one link on the roster card). F-FEEDBACK-001 FB-11 and the Learning Route amendment's LR-8 add their own one-link edits to the same card: keep each edit to the link itself.
- RP-7c edits F-APP-001's parent home (`/parent`, the **Open** target only) and `shell-nav.ts` (two items); nothing else in the frame. It does **not** touch `teach/home/page.tsx` (F-APP-001 removes its Family group).
- RP-3b edits three screens other specs touch (story reader, minigame screen, placement); the change is the mount effect. F-BROWSE-001's preview ports start no session by construction, so Browse previews never reach these calls.
- The design pass (`design/screens/reports/`, manual, per `design/playbook/`) must produce the report block mocks before RP-7a2, RP-8 and RP-9.

### 6.3 Ownership and seams

| Code / surface | Owner | Others |
|---|---|---|
| `ProgressSummary.activity`, `ActivitySummarySchema` | this spec (RP-1) | F-VOC-005 P-4b stops zeroing `w`; F-ENT-003 provides `routeNext` / `isQuestOpen` that fill `next` / `revisit` |
| quest latch `questDoneAt` | this spec (RP-1, RP-3a, RP-W1) | — |
| `reports/*` pure module | this spec | other specs may render it; they never fork it |
| report pages, choosers, **Open** target on the parent home, `ADULT_NAV` items `reports` (parent) and `classReports` (teacher) | this spec (RP-7a2, RP-7c, RP-8) | F-APP-001 owns the frame, the parent home and the registry |
| **Open Learning Route** link on the report | this spec | Learning Route amendment owns `ROUTES.learnerRoute` and the page (LR-7, LR-8) |
| **Send a note** button on the report | this spec (RP-12) | F-FEEDBACK-001 owns the composer, its route and `feedback.send` |
| Browse links on chips, quests and tips | this spec (RP-13) | F-BROWSE-001 owns the target grammar, `openBrowse` and the access decision |
| the "reports" claim lines on hangulroute.com | F-SITE-002 (copy and claims table) | this spec flips `parentReports` and `teacherReports` in RP-11 |
| roster allow-list and consent items | F-SPACE-002 (T-1a) | this spec adds `activity` (RP-W2) and bumps the text version |
| privacy page | legal pages of the site (`landing.ts`) | this spec adds the lines (RP-0b) |

## 7. Dependencies

- **On main** (`ea9049e4`): `summarize.ts`, `ProgressSummarySchema` with `journey` and `placement`, `rosterSummary`, `ADDITIVE_FIELDS` with `earlierLatchTime`, `classRollup`, `PlacementStrandSchema`, the catalogue with `teaches` (F-QUEST-002 Q-6a / Q-6b), `logic/my-route/skills.ts`, `SectionTabs` mock, the console plan builder, the consent version constants, the i18n plural helper.
- **Not on main, read when present**: F-ROUTE-001 R-8 is on main (journey summary); R-9a (console strip, PR #313) is independent. F-VOC-005 P-1 (vocab slice writer) and P-4 (consent item). F-RVW-001 (draft).
- **Sibling specs of the 2026-10-11 owner request** (written in parallel; each seam is in section 6.3):
  - **F-APP-001** persona app shell (`docs/persona-app-shell`): route map and host (section 3.2), `ROUTES.space(id, kind)`, the parent home **Open** target, `ADULT_NAV` (section 3.8), the grown-up lock and offline page. RP-7c waits for A-5a and A-5b. This spec fulfils F-APP-001 section 6.4's row for reports.
  - **F-SITE-002** layered intro site (`docs/marketing-site-layered`): no report on hangulroute.com; `/teach/*` redirects; the `parentReports` / `teacherReports` claims (RP-11).
  - **F-FEEDBACK-001** notes (`docs/adult-feedback-channel`, owner item 7): composer at `/teach/space/notes?id=&learner=`, `NEXT_PUBLIC_NOTES_ENABLED`, `feedback.send`. RP-12 waits for FB-11.
  - **F-BROWSE-001** lesson browser (`docs/adult-content-browser`, owner item 14): `openBrowse`, `BrowseSource 'report'`, BD7, access screen. RP-13 waits for BR-10.
  - **F-BILL-002** billing for every persona (`docs/billing-in-app-all-personas`, item 8): no seam beyond "reports have no purchase surface".
  - **F-ENT-003** free plan, all of Stage 1 (`docs/free-day2-unlocked-curriculum`, items 9 and 10): `routeNext` (E3-4) and `isQuestOpen` (E3-2) on the device fill `activity.next` and `activity.revisit`; F-ENT-003 adds no summary field itself, this spec carries the result in its own field.
  - **Learning Route amendment to F-ROUTE-001** (`docs/learning-route`, item 11): `ROUTES.learnerRoute`, LR-8 page; this spec reads `journey` and links to the page.
- **External**: the design pass for the report blocks; es / ko review of `report.*`; legal review of the ko / es privacy lines; owner answers (section 9; defaults apply).

## 8. Decisions

Binding owner decisions applied: audience any age; anti-shame (CLAUDE.md section 1); reading, listening and writing only (2026-10-10); UI strings through `packages/i18n`; tokens only; no emoji; sandbox-only commerce (this spec has no commerce surface); additive-only D1 (this spec adds none); grown-up screens on app.hangulroute.com (owner items 3 and 12, via F-APP-001).

Spec decisions (engineering, reversible):

| # | Decision | Why |
|---|---|---|
| M1 | Reports are computed from a **device-computed, bounded `activity` field** on the summary grown-ups already read | keeps the summary-only rule (no `payload_json` for accounts); works offline; no new table |
| M2 | **No D1 table, no migration** | the device already holds full history; a server table would duplicate it and need a migration on a live production database |
| M3 | One **pure module in `packages/content-schema/src/reports/`** used by Worker, console and app | three surfaces cannot drift; 100 % coverage lane already exists there |
| M4 | Class statistics are **computed on the Worker** and returned without identifiers | the class page never receives per-learner rows; the no-ranking rule is enforced in one place |
| M5 | A **quest latch** (`questDoneAt`) twin of `stageDoneAt`, backfilled once from `completedAt`, counted only for completed quests | first finishes become exact from RP-3a on; history before it is an approximation that never moves later (only earlier, when a merge brings another device's earlier finish); a reset reads as a fresh start until a quest is finished again, which keeps its pre-reset first finish (section 3.3.1, known approximation) |
| M6 | Console telemetry is **recorded by the Worker** in the report routes, filtered to codes | the console has no telemetry client; codes only |
| M7 | **Print stylesheet**, not file export | nothing generated or stored server-side; no new data path |
| M8 | Up-only comparisons, cumulative growth line, neutral empty days, a guaranteed went-well line after practice | "meters only fill", no guilt (CLAUDE.md section 1) |
| M9 | **Three layers** on every report page | owner items 2 and 13: the answer before the numbers, no long scroll |
| M10 | The report's "next" is **the device's `routeNext`**, carried in `activity.next` | the report never disagrees with the learner's Home and never names a closed lesson |
| M11 | **Narrow batched reads** for the report routes | no `payload_json` loads; bounded query count for a 300-seat class |
| M12 | Session ownership **in memory**, background ends, 60-minute cap, new callers do not touch the streak | no lost or inflated minutes; no learner-visible change |

## 9. Owner decisions and assumptions

**Owner decisions** (each has a default that applies until the owner answers, and gates only the named PRs):

| Id | Question | Default | What it changes | Gates | Reversible |
|---|---|---|---|---|---|
| OD-1 | Week window: rolling 7 days or calendar week (Monday start)? | **rolling 7 days ending today** (matches the roster's "minutes this week", `minutesLast7d`) | `windowOf('week')` | RP-2a | yes (one function) |
| OD-2 | Month window: calendar month to date or rolling 30 days? | **calendar month to date** (reads like a monthly report) | `windowOf('month')` | RP-2a | yes |
| OD-3 | Teachers see day-by-day activity (the consent item `activity` sentence changes to "When {learner} practiced, minutes each day and days in a row", text version bumped) | **yes**, from the day the learner joined | roster allow-list, consent text, privacy page | RP-W2 | yes (project `activity` for family spaces only, like `selfRoute`; class reports then show the `legacy` state) |
| OD-4 | Class report: show how many learners are on each stage? | **no** (keeps F-ROUTE-001 section 3.12 "no distribution by stage"); show stage **milestone events** in the window instead | class report blocks | RP-2c | yes |
| OD-5 | Class report: level-check strand counts (secure / getting there / next to learn / not checked) | **yes**, counts only | class report blocks | RP-2c | yes |
| OD-6 | Percentages on reports | **none** on learner and class reports (named letters and strand words instead); the roster roll-up keeps its existing anchor percentage | report figures | RP-2a | yes |
| OD-7 | Export | **print / save as PDF only**; no CSV, no share link, no email | print button and stylesheet | RP-7b, RP-8 | yes |
| OD-8 | Read / listen / write practice counts on the console | **no** (F-ROUTE-001 OD-11: skills stay local); shown only in the in-app report | console blocks | RP-7a2, RP-9 | yes (needs a consent item) |
| OD-9 | Does a parent see a class's homework progress in the family report? | **no** (T-1a: `planProgress` is filtered to the viewing space); the family report shows family plans and the self-route | plan block | RP-2a | yes (needs a consent change) |
| OD-10 | All-time view | **cumulative line** of quests and cards (only rises); no per-month bars | growth block | RP-2a, RP-7b | yes |
| OD-11 | Comparisons with the learner's own past | **only when up** ("more than last week"); nothing when equal or down | figures, W4 | RP-2a, RP-2b | yes |
| OD-12 | Day boundary | **the learner device's local day** for reports (the report's own "days in a row" too); the learner app's streak keeps its UTC rule | windows | RP-2a, RP-4 | yes |
| OD-13 | How much detail the device sends | **35 days, 24 months**, totals and milestones, next and one revisit quest | wire bounds | RP-1 | yes (raise bounds additively) |
| OD-14 | School admins open per-learner reports of their classes | **yes, read-only**, the same rule as the roster today | learner route auth | RP-5 | yes |
| OD-15 | Weekly digest by email or push to parents | **not in v1** (no messaging channel exists; a later notification spec) | — | — | — |
| OD-16 | Where report entries live | **parent**: the parent home card **Open** goes straight to the learner report (week) and the parent navigation has **Reports**; **teacher**: the roster card **See report**, the roster's **Class report** link and the navigation item **Class reports**; the roster card keeps **See report** for family spaces too | entries | RP-7a2, RP-7c, RP-8 | yes |
| OD-17 | The in-app report on a self-only device (an adult learning alone) | **second person** ("Your report", "You practiced on 3 days") | voice | RP-6, RP-9 | yes (hide **See report** on self-only devices instead) |
| OD-18 | Looking back at past days, weeks and months | **yes**: a Previous / Next stepper within the 35 day rows and 24 months (older months: totals only) | windows, stepper | RP-2a, RP-7a2 | yes (current window only) |
| OD-19 | Story, stand-alone game and level-check time | **counts toward report minutes and practice days, not toward the learner's streak** (no learner-visible change) | sessions | RP-3b | yes (pass `streak: true`; a learner-facing change that needs owner sign-off) |

**Assumptions to verify**

| # | Assumption | Verified in |
|---|---|---|
| a | `.optional().catch(undefined)` drops a malformed `activity` in the repo's zod version (as for `journey`) | RP-1, RP-W1 backend test |
| b | A 4.2 KB worst-case summary stays well inside the Worker body limit and D1 row size | RP-W1 integration test with a maximal fixture |
| c | Device local days from `Date` getters match the learner's calendar on web, iOS and Android | RP-4 unit tests with injected `localDay`; RP-11 e2e in two time zones |
| d | In-memory session ownership prevents double counting a story opened from a quest, and `pagehide` / `visibilitychange` fire on the PWA's close paths of the target browsers | RP-3b tests; RP-11 e2e on Chromium and WebKit |
| e | The roster card has room for one **See report** link at 280 px next to the Learning Route and notes links | RP-7a2 e2e |
| f | The class route answers within the roster's latency for 300 members with batched reads | RP-5b sqlite test timing note |
| g | D1 accepts 100 bound parameters per statement (chunk size) | RP-5b sqlite and preview test |
| h | `@page { margin: 0 }` suppresses the default print header and footer in Chromium and WebKit; elsewhere the helper line covers it | RP-7b manual check, noted in the PR |

## Appendix A — draft English strings (final copy is the dictionary's)

| Key | Draft |
|---|---|
| `report.documentTitle` | "Report - Hangul Route" |
| `report.title.learner` / `report.you.title` | "{name}: report" / "Your report" |
| `report.title.class` | "{class}: class report" |
| `report.chooser.learner` / `report.chooser.class` | "Whose report?" / "Which class?" |
| `report.period.day` / `week` / `month` / `all` | "Today" / "This week" / "This month" / "All time" |
| `report.step.prevDay` / `prevWeek` / `prevMonth` / `next` | "Yesterday" / "Last week" / "Last month" / "Next" |
| `report.glance.nowOn` | "Now on Stage {n}: {stage}" |
| `report.glance.openRoute` | "Open Learning Route" |
| `report.glance.lastPractice` | "Last practice: {date}" |
| `report.headline.practiced` / `report.you.headline.practiced` | "{name} practiced on {days, plural} {period}." / "You practiced on {days, plural} {period}." |
| `report.headline.stageDone` | "{name} finished Stage {n}: {stage} {period}!" |
| `report.headline.noneYet` | "No practice yet {period}." |
| `report.headline.noneSaved` | "Nothing saved from {name}'s device {period} yet." |
| `report.headline.gettingStarted` | "{name} is just getting started." |
| `report.horizon` | "Figures up to {date}." |
| `report.section.wentWell` / `practiceNext` / `thisPeriod` / `moreDetail` | "What went well" / "What to practice next" / "This period" / "More detail" |
| `report.figure.days` / `minutes` / `quests` / `cards` / `letters` | "Practice days" / "Minutes" / "New quests" / "New cards" / "New letters" |
| `report.figure.up` | "More than {previous}" (previous = "last week" / "all of last month") |
| `report.detail.lettersStrong` / `lettersPractising` / `lettersNew` / `totals` / `milestones` / `levelCheck` / `plan` | "Letters {name} knows well" / "Letters being practiced" / "New letters this period" / "Since the start: {quests} quests, {cards} cards" / "Milestones" / "Level check" / "Plan" |
| `report.insight.showed_up` | "{name} practiced on {days, plural} {period}." |
| `report.insight.stage_done` | "{name} finished Stage {n}: {stage}." |
| `report.insight.letters_new` | "{name} got strong on {letters}." |
| `report.insight.practice_days` | "{name} practiced on {days, plural}." |
| `report.insight.minutes_up` | "More practice time than {previous}: {minutes} minutes." |
| `report.insight.quests_new` | "{count, plural} new quests finished." |
| `report.insight.cards_new` | "{count, plural} new heritage cards collected." |
| `report.insight.level_secure` | "Level check: {strands} looks secure." |
| `report.insight.plan_done.class` / `.family` | "Every homework item in this plan is done." / "Everything in this week's plan is done." |
| `report.insight.streak` | "{days} days in a row. Hoya is proud!" |
| `report.insight.words_new` | "{count, plural} new words met." |
| `report.insight.rhythm` | "A short session on two days a week is a great start." |
| `report.insight.letters_revisit` | "{letters}: worth another visit." |
| `report.insight.strand_next` | "{strand} is next to grow." |
| `report.insight.plan_open.class` / `.family` | "{count, plural} homework items are ready to play." / "{count, plural} plan items are ready to play." |
| `report.insight.next_in_plan` | "Next in the plan: {quest}." |
| `report.insight.next_on_route` | "Next on the Learning Route: {quest}." |
| `report.insight.free_days_done` | "{name} finished the free lessons." |
| `report.insight.words_revisit` | "{words}: worth another look together." |
| `report.you.insight.*` | second-person variants of every insight that names the learner ("You finished Stage {n}: {stage}.", "You got strong on {letters}.", ...) |
| `report.tip.<strand>` | see section 3.11 |
| `report.action.addToPlan` / `openPlan` / `sendNote` | "Add to a plan" / "Open the plan" / "Send a note" |
| `report.strand.status.<status>` | "Secure" / "Getting there" / "Next to learn" / "Not checked yet" |
| `report.state.noData` | "No saved progress from {name}'s device yet." |
| `report.state.noDataAction` | "Open Hangul Route on that device while online." |
| `report.state.empty` | "{name} has not started yet. The report fills in after the first practice." |
| `report.state.legacy` | "Day-by-day figures are not available yet." |
| `report.state.updateAction` | "Open Hangul Route on {name}'s device while online to update." |
| `report.state.stale` | "Last saved {date}." |
| `report.state.unavailable` / `error` / `flagOff` | "This report is not available." / "Can't load the report right now." / "Reports are not available yet." |
| `report.class.headline` | "{count} of {total} learners practiced {period}." |
| `report.class.band.none` | "Not yet" |
| `report.class.olderApp` | "{count, plural} learners have an older app: their day-by-day figures appear after an update." |
| `report.class.lettersNew` | "Letters the class got strong on" |
| `report.class.revisit` | "Letters to revisit together" |
| `report.class.medianMinutes` | "Typical time for those who practiced: {minutes} minutes" |
| `report.class.planLesson` | "Plan a lesson" |
| `report.class.milestones` | "Stage milestones {period}" |
| `report.print.button` | "Print or save as PDF" |
| `report.print.hint` | "Turn off headers and footers in the print dialog." |
| `report.print.footer` | "Private: shared from Hangul Route on {date}." |
| `report.nav.reports` / `report.nav.classReports` | "Reports" / "Class reports" |
| `report.action.seeReport` / `report.class.link` | "See report" / "Class report" (the section 3.1 entries: roster and dashboard cards, the roll-up link) |
| `a11y.report.calendar` | "Practiced on {days}" |
| `a11y.report.notSaved` | "Not saved yet: {days}" |
| `a11y.report.periodChanged` | "Showing {period}" |
| `a11y.report.step` | "Show {window}" |

## Review log

- 2026-10-11: drafted from the owner request of 2026-10-11 (items 4 and 6) and the current-system map of that day; data model, privacy projection, anti-shame rules and PR order checked against `origin/main` `ea9049e4`. Promoted to `ready` with the defaults of section 9.
- 2026-10-11, two reviews (UX and seams; engineering and privacy) applied. **Accepted**: kind-aware `ROUTES.learnerReport` with `/parent/learner` for families, parent home **Open** straight to the report, `ADULT_NAV` items, no edit of `teach/home`, F-APP-001 cited by id, app host only (blocker); three layers with a 390 x 844 above-the-fold check; W0 fallback and hidden empty headings; `no_data` split from `empty` with action lines; **Open Learning Route** link and "Next on the Learning Route"; **Send a note** owned here on the header (RP-12); Browse links owned here (RP-13) with content ids only; reports free on every plan, P1 / P4 from the device's F-ENT-003 results, neutral free-end line; consent text version bump; in-memory session ownership, orphans, background end, 60-minute cap, streak untouched; data horizon at `asOf`; narrow batched reads; privacy notice before collection (RP-0b); RP-W split into RP-W1 / RP-W2; `activity` hidden in RP-1; class history clipped at `joinedAt`; `report.*` telemetry filter; latch reset handling (absent key is the only unset signal; count only completed quests); generic `document.title` and print header note; `ageGroup` dropped; archived spaces read-only; second voice on self-only devices; RP-7a and RP-5 split; `reportsEnabled(locale)`; commerce and redirect lines; neutral legacy copy; Previous / Next stepper (OD-18); class headline and went-well / practice-together labels, stacked strand list; W9 from local days; family copy variants, period-named `minutes_up`, starting spot with the roster's band words, plural helper; whole-word banned list; words hidden on the device too until F-VOC-005 P-4b; sibling ids; superseded parent wireframes; game names from the minigame catalogue and tips linked to Browse.
- **Rejected or deferred, with reasons**: "Previous / Next learner" on the teacher variant: out of scope for v1 (section 4); the roster is one tap away and an order other than the roster's would need its own anti-ranking review. A Worker server event when it drops a malformed `activity`: not added; the neutral `legacy` sentence removes the false "old app" claim, and a new event name would need its own payload review. Lowering W3 to 1 day for every period: not chosen; W0 gives the same guarantee without changing W3's meaning.
- 2026-10-11, RP-1 / RP-0b PR reviews applied. **Accepted**: the two route bodies live in `schemas/report-response.ts` (it reads `sync.ts`, which reads `report.ts`; a single file would be an import cycle); letters (`j`, class `letter`) are Hangul compatibility jamo (`ReportLetterSchema`) and stage keys match `^[a-z0-9-]{1,32}$` (`ReportStageKeySchema`), so no free text reaches a report and the activity stays near its size estimate; day keys must be real calendar days, `days` and `months` strictly ascending with nothing after `asOf` (a violation drops `activity`, never a 422); `ClassReportSchema` checks each period's bands (`CLASS_DAY_BANDS_BY_PERIOD`; `all` has none); `headline.practiced` / `headline.up` are the Practice block's `practiced` and its up-only marker (carried once); class `planId` uses `PlanSchema`'s grammar with no tighter bound; `questDoneAt` keys at most 64 and values at most 40 characters, strict; RP-W2 sets `total.since` to `null` for class and school viewers; the privacy bullet (RP-0b) names every `activity` field, including per-day quests, cards and words, all-time totals since the first practice day, stage finish dates, the revisit lesson and the time-zone offset, and names the school owner among the viewers; the effective date moves with it. **Rejected**: a CI guard tying app writes of `questDoneAt` to the Worker's preserve rule: the PR order already gates it (RP-3a and RP-4 depend on RP-W1 being deployed, section 6.1), and no app code writes the field before then.
- 2026-10-11, F-ENT-003 OD-1 (owner decision, applied in F-ENT-003 E3-0b): the free plan is all of Stage 1. The P4 free-end line reads "{name} finished the free lessons." (no "day" on any grown-up surface); its id `free_days_done` is unchanged.
- 2026-10-12, RP-W1: assumption b verified. A summary with every `activity` bound at its limit (35 day rows with 12 two-jamo letters each, 24 months, 16 milestones, every count at 100,000, 64-character quest ids) is 9.3 KB and round-trips through `PUT` / `GET /api/sync/learners/:id/snapshot` on the memory and sqlite backends; summaries with realistic counts stay near the 4.2 KB estimate of section 3.3.3. The codes-only telemetry filter and the 10,000-event cap moved from `routes/telemetry.ts` into `lib/server-events.ts`, so `POST /api/telemetry` and `recordServerEvent` share one rule; the `report.*` codes live next to the schemas as `REPORT_TELEMETRY_PREFIX` / `REPORT_TELEMETRY_PAYLOAD` (`schemas/report.ts`) for the Worker and RP-9.
- 2026-10-12, RP-W1 PR reviews applied. **Accepted**: a sent latch without a `summary.activity` keeps the stored activity (`keepStoredSummaryWhenSent` on `QUEST_DONE_AT` only; a sent placement list, vocab slice or self-route still travels with exactly the summary sent), so a native build cut between the RP-3a and RP-4 merges never erases the activity an RP-4 device computed; no release gate is needed. The profile-reset gap (a quest finished again after a reset keeps its pre-reset first finish) is recorded as a known approximation in section 3.3.1 and M5; RP-3a decides the remedy. The `report.*` filter location is corrected in section 3.10, the RP-W1 row and `TELEMETRY-NAMES-2.md` section L. Coordination: F-BROWSE-001 BR-2 (#389) and F-FEEDBACK-001 FB-1 (#383) edit the filter that moved; whichever lands after RP-W1 moves its rule into `keptEventFields` in `lib/server-events.ts` and keeps its `POST /api/telemetry` tests.
- 2026-10-12, RP-W2 (OD-3 default "yes" applied; RP-0b live on hangulroute.com/privacy). `activity` is on `TEACHER_VISIBLE_SUMMARY_KEYS` under the item `activity`, whose sentence is now "When {learner} practiced, minutes each day and days in a row" (11 words by the copy test's count, not 9; still under its 16-word cap); `TRANSFER_CONSENT_TEXT_VERSION` is `transfer-2026-10b` with its pinned hash, and `transfer-2026-10` stays accepted. `activityOf(value, { kind, joinedAt })` and an optional `viewer` on `teacherVisibleSummary` (a reader without a known join time is treated as a class with no history: no days, months or milestones, lifetime counts only), so RP-5b can project each summary with the membership's `joinedAt` too. F-FEEDBACK-001 FB-1 also bumps the consent version (`transfer-2026-10-notes`); whichever of the two merges second rebases, re-pins the combined hash under its own version and keeps every earlier version in `ACCEPTED_CONSENT_TEXT_VERSIONS`.
- 2026-10-12, RP-W2 PR reviews applied. **Accepted**: a class or school viewer reads `next` as `{ q, plan: false }` (the flag cannot tell the class's own plan from a family plan or a self-route, F-PLAN-002 section 3.10), so the teacher variant's P4 always reads `next_on_route`; section 3.3.4 step 8 maps `plan` as `source !== 'cursor'` (F-ENT-003 has no `'route'` source, so the old mapping was always true); section 3.10 counts the new sentence as 11 words. **For counsel at gate G2**, the `activity` fields a teacher receives map to consent items as follows: minutes and practice days per local day -> `activity`; the time-zone offset `tz` -> `activity` (it only sets which local day a count falls on); per-day quests, stage finish dates (`milestones`) and the next lesson (`next.q`) -> `quests`; per-day cards and letters and the lesson to revisit (`revisit`, chosen from the letters that need practice) -> `cards_letters`; words stay zeroed. Counsel confirms this mapping or rewords an item (a new version with re-pinned hashes), and decides whether `transfer-2026-10` is retired for new consents; both before CLASS_TRANSFER could ever be enabled. **Rejected**: an opt-in (`?include=activity`) for the roster's `activity`: M1b puts `activity` on the roster, a maximal value is 9.3 KB and a realistic one about 4 KB, and RP-5b's 300-member fixture measures the report routes; revisit if RP-8 shows the roster never renders it.
- 2026-10-12, F-FEEDBACK-001 FB-1 (#383) rebased after RP-W2 (#392) merged. The combined consent text (the RP-W2 `activity` sentence plus the FB-1 `note_replies` item) is pinned under one new version, `transfer-2026-10c`, rather than under FB-1's interim name `transfer-2026-10-notes`, which never reached main and is not accepted. `ACCEPTED_CONSENT_TEXT_VERSIONS` is `['transfer-2026-10c', 'transfer-2026-10b', 'transfer-2026-10']`; the counsel question at gate G2 (whether an earlier version is retired for new consents) now covers both earlier versions. CLASS_TRANSFER stays off.
- 2026-10-12, RP-3a PR reviews applied. **Accepted**: section 3.3.1 and M5 now say a latch entry never moves later and moves earlier only to an earlier merged first finish (so a past period's quest count can change after a sync), and that held entries the Worker would refuse are dropped; the RP-4 `startedAt` heuristic for a reset is marked unsound until tested against a reset followed by a sync union; `mergeStageDoneAt` sorts its keys in code-point order like `mergeQuestDoneAt`.
- 2026-10-12, RP-3b. Session ownership lives in `progress-store` (`openSession`, in memory) and `logic/sessions/hold.ts` (`holdSession`: a caller that joined does nothing, also on background; the owner ends on hidden and begins again on visible while mounted); `platform/app-visibility(.web).ts` maps `AppState` `background` / `active` (native; `inactive` is neither) and `pagehide`, `pageshow` and `visibilitychange` (web). Owners: `quest:<questId>` (streak), `story:<storyId>`, `minigame:<questId>:<stepIndex>`, `placement` (time only). A session of another profile is ended before a new one begins; a profile reset forgets its open session. The story reader and the game screen record nothing on a host other than the learner stack (no `navigation`, the All lessons preview). Time-only ids and the streak readers: section 3.3.2.
- 2026-10-12, RP-3b PR reviews applied. **Accepted**: a quest (`streak: true`) begun over the profile's time-only session takes over instead of joining; the time-only callers hold their session only while their screen is in front (`holdWhileFocused`), so the PIN and the placement report never count as the learner's practice; a screen held while the app is hidden begins only when it is visible; the Parent dashboard's Sessions stat counts quest sessions only and its minutes and `minutesLast7d` are read capped (`countedSeconds`); the practice-session e2e runs in CI (`web-app.yml`, fixture bundle) and covers the level check. **Recorded, not changed**: `session.start` stays paired with `session.end` per visible stretch (suppressing it on a resume would unpair the events), with the cap and the discontinuity noted in section 3.3.2; `sessions[]` retention is a known risk for a follow-up. **Rejected**: a same-owner request ending and restarting the open session (two stacked copies of one screen would leave the lower one without a session, and React runs unmount cleanups before mount effects, so `replace('Placement')` already begins a fresh one).
- 2026-10-12, design pass (`design/screens/reports/`): mocks of the learner report (parent and teacher variants, the four periods, the stepper, every state of section 3.14), the class report, the in-app report (second voice, skills rows) and the print layout, with shots at 375 and 1280 and measurements. The At a glance block reuses LR-D's goal line and its region unchanged. Decisions recorded in its README: the selected window's dates sit in the stepper row (`report.step.range` or a formatted month or date, no new key); the console's period tabs are one segmented row (the learner app keeps `SectionTabs`); the calendar's sentence is visible and is what prints; per-day minutes are not drawn; an archived class's report shows `console.settings.archived.class` and no line actions; `empty` and `no_data` hide the tabs; the print body uses `box-decoration-break: clone` so the repeated footer never covers a block. No string added. At 390 x 844 the first went-well line is above the fold with the adult frame counted (ready parent fixture); in the `stale` state the headline stays visible and the went-well lines follow the data horizon (none for a week wholly after `asOf`, 60 px below the fold for a month partly after it). RP-7a2 (after RP-7a1), RP-8 and RP-9 may now start once their other dependencies are met.
- 2026-10-12, design pass PR reviews applied (#429). **Accepted**: the stale state is drawn on data that can exist (last save = `asOf`, practice on or before it): a week wholly after `asOf` reads `headline.noneSaved` with every cell not saved, no went-well lines, no P0 and no figure tiles, and a month partly after it shows `report.horizon` with figures up to `asOf`; class day bands and the median cover learners with `activity` only (an older-app learner is never "Not yet"); the median shows on Today when 3 or more practiced; legacy has no "New letters this period"; every More detail block has an `h3` (totals under Milestones, the starting spot under Level check); the in-app letter chips that expand are the More detail tiles (disclosure buttons), sentences stay plain; the In-app **Open Learning Route** opens `MyRoute { source: 'parent', profileId, viewer: 'grownup' }` for the report's profile; tabs use manual activation and the report body is their `tabpanel`; Previous is absent on the oldest window `stepOf` allows, and focus moves to the other step button when a step removes the focused one; tile names come from their visible content (no `aria-label`); the console and the app read `console.learningRoute.open` / `.section` (LR-7, #400) for the glance link and region, and RP-7a1 deletes the duplicate `report.glance.openRoute`; section 3.6's P1 row and Browse item now say P1 names no quest (its quest travels in **Add to a plan**; the line's Browse links are its letters). **Recorded, not changed**: the in-app calendar draws no not-saved cells, so on a profile that also practices on another device, days this device has not pulled yet show as empty outlines until the next pull (accepted for v1; RP-9 may instead dash empty days after the sync store's `lastSyncedAt` if its tests show the gap matters); in a week or a month the `practiced` headline and W3 `practice_days` state the same number of days, and whether W3 is skipped when the headline names the days is left to RP-2b (#422), which owns the rule order; the `border.strong` outlines of labelled pill buttons (1.85:1 on canvas) stay, since the text label identifies each control (WCAG 1.4.11) and they are LR-D's unchanged style.
- 2026-10-12, RP-2b (`reports/insights.ts`). `wentWell(ctx)` / `practiceNext(ctx)` take `{ summary, report, catalog }`, where `report` is `learnerReport(...)` of the same summary and catalogue, so the lines read the same window, horizon and figures as the page. Lines are `{ code, params, links? }` and parse with `InsightLineSchema` (strict: letter keys, strand ids, `quest:` and `plan:` ids, word ids and counts only). Readings of section 3.6 applied: a `device` viewer reads the family plan words (`kind: 'family'`) and its self-route, a `class` viewer never reads a self-route; W8 / P3 count the viewer's plans plus, for family and device, the self-route; P3's **Open the plan** link is set only when exactly one plan holds every open item counted (an open self-route drops it); W9 speaks only for a window that holds `asOf`; W7 compares the learner-local day of `placement.takenAt` (in `activity.tz`); P0 reads the saved part of the window (days up to `asOf`) and never a window wholly after `asOf`, so a partial week with no saved practice reads "No practice yet this week." and the P0 line (section 3.11); W8 speaks only for the current window and only when the learner practiced in it (`planProgress` is today's snapshot, and with no practice "What went well" is hidden), so a `legacy` summary has no went-well line; the `empty` state and the getting-started rule hold only P4, on P4's periods (nothing on `day`); a `legacy` summary keeps the practice-next lines that need no day-by-day data (P1 without a quest, P2, P3); P1 and P4 name or link a quest only when this build's catalogue holds its id (a retired quest or one from a newer build is dropped: P1 keeps its letters without the quest). Voice stays with the renderer (`report.you.insight.<code>` when `report.voice` is `second`).
- 2026-10-12, RP-2b PR reviews applied. **Accepted**: W8 no longer fires without practice in the window or on a past window; getting started and `empty` return nothing on `day`; P0 reads the saved part of a partial window (the reading of sections 3.2, 3.6 and 3.11, replacing the stricter whole-window reading); P3's plan link is dropped when the self-route also holds open items; P1 and P4 check catalogue membership (`InsightContext.catalog`), not only the id grammar.
- 2026-10-12, RP-2b second PR reviews applied (#422). **Accepted**: "What went well" is gated once on practice days in the window (section 3.6), so W9 no longer reads "3 days in a row" under "No practice yet today." and W1, W2 and W7 never fire in a window without practice (a check or a milestone merged in from another device); W3 is skipped when the headline is `practiced`, which already states the practice days (the question the design pass #429 left to RP-2b; W0 keeps behaviour 11's wording as the last resort); a `device` viewer's P1 and P3 lines carry no `links` (Add to a plan and Open the plan are console actions); section 3.14's partial-window row now matches the P0 reading of sections 3.2 and 3.6. **Recorded, not changed**: on `all`, W2 lists letters from the day rows the summary holds (the last 35 days, up to 5): every letter it names was learned, the line never claims to be complete, and More detail shows the letters known well (`strong`) for `all`.
