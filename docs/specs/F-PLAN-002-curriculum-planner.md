Status: ready

# F-PLAN-002 — Curriculum planner: one deterministic route from level, rhythm and goals, for a class, a family or a self-learner

> Start order: P2-1 (shared date helpers) and P2-2 (catalogue + parity tests) have no external dependency. P2-4 (schemas, migration, Worker) must be **deployed before** any console or app build that sends `meta`, `week` or `selfRoute` (the Worker's zod strips unknown keys). P2-3a (the generator) and P2-3b (`proposeRoute`, FP-B11) are pure and can be reviewed alone. The worked examples of section 3.4 are golden tests against a frozen copy of today's catalogue, so they stay true while content grows.

**Scope**: `packages/content-schema` (new `src/curriculum/` generator, new `src/curriculum/propose.ts` (`proposeRoute`, FP-B1), new `src/catalog/` shared catalogue, `schemas/plan.ts` additions, `schemas/progress.ts` / `schemas/sync.ts` additions, telemetry names) · `packages/backend` + `apps/api` (plan `meta`, inbox capability filter, roster redaction, migration `0006_plan_meta.sql` (E-1: `0001`-`0004` are on main, `0004_waitlist.sql` included, and F-SPACE-002 T-3b holds `0005_class_transfer.sql`, so `0006` is the next free number; if another migration lands first, P2-4 takes the next free number when it is opened and the order is decided at merge; `scripts/check-migrations.mjs` fails CI on a duplicate prefix)) · `apps/mobile` (derivation, display fixes, self-route store, `screens/route/` incl. `RouteProposalScreen.tsx`) · `apps/web` (`/teach/space/curriculum` wizard, plan-builder grouping, readout, catalogue adapter) · `packages/i18n` (strings)
**Owner**: solo dev
**Rollout**: console first (class and family), then the in-app self-route; the self-route screens sit behind `flags.routeEnabled` (default on since P2-8b; the learner entries show in English only until the es and ko re-review is signed). PR order in section 6.
**Wireframes**: `wireframes/curriculum-planner.md` (drafted with this spec) -> promoted to `design/wireframes/console/curriculum-wizard.md`, `console/plan-builder.md` (week grouping and readout), `route/setup.md`, `route/overview.md`, `route/proposal.md` (FP-B1; drawn as screen K of `design/wireframes/journey/my-route-overview.md`), `home/todays-mission.md` (route card), `homework/list.md` (week window). `route/overview.md` is the weekly plan; F-ROUTE-001's map of progress is `journey/my-route*.md`, so the files do not collide (E-4)

Parent / siblings: F-PLAN-001 (plans: publish once, derive on the device; **this spec amends its sections 3.1, 3.2, 3.3, 3.5**) · F-ROUTE-001 (My route: the map of progress; shows the plan's week on its Home strip and page; owns the Home stack order; `AMENDMENTS-PLC-PLAN-HANDOFF.md` amends this spec, FP-B1 to FP-B15) · F-HW-001 section 3.3 and 3.4 (anti-shame, one explicit assignment per day, gating) · F-TCH-001 section 3.3, 3.5, 3.6 (class plans, stacking, aggregates only) · F-PLC-001 (the placement level is this spec's `level`; `questsPlacedOutAtLevel`, `RouteCatalog`) · F-QUEST-002 (Stage 1 = 15 quests, `teaches` symbol keys, Hangul Check) · F-STORY-001 / F-STORY-004 / F-STORY-005 (24 heritage stories, shelf, tags) · F-VOC-001..005 (12 vocabulary topics) · F-LEARN-001 (`levelOrder`) · F-I18N-001 (all copy through messages) · F-RVW-001 (review items later) · F-SPACE-001 (spaces) · F-CONSOLE-001 (static export, `?id=` routes) · design inputs `curriculum-planner.md`, `level-test.md` · blueprint 04 section 0.4 (stage order linear, theme order free), section 4.3 (Stage 1 minutes), section 8.1 (motivation) · blueprint 05 section 1.4

---

## 1. Context

A teacher or parent can publish a plan today, but only by picking up to 30 items by hand; a self-learner cannot plan at all. D11 (owner, 2026-10-10) asks for curriculum defaults: inputs (level, a 4-week, 12-week or 6-month preset or custom, sessions per week, minutes per session, goals and themes, start date, holidays), a pure deterministic `generateCurriculum` in `packages/content-schema` (no new package), honest handling of content that is not released yet, a route that is visible to the family space but not the class, and review weeks via a plan item kind later.

What exists (verified on the working tree, `main` after PRs #91-#97):

- **The plan contract.** `PlanItemSchema = { kind: 'quest' | 'episode', id, targetDate?, note? }` (`packages/content-schema/src/schemas/plan.ts:8-13`); `PLAN_MAX_ITEMS = 30` (`:16`); `PlanSchema`, `PlanUpsertSchema`, `InboxPlanSchema` (`:18-52`). One row per plan in D1: `items_json`, `target_learner_ids_json`, `published_at`, `archived_at` (`apps/api/migrations/0002_schema_v2.sql:77-89`); the newest migration is `0003_device_scope.sql`; `putPlan` / `toPlan` map the columns (`packages/backend/src/db/d1.ts:50, 215-226`). `PUT /api/spaces/:id/plans` (`packages/backend/src/routes/plans.ts:24-59`) and `inboxPlansFor` (`:83-95`) copy items through; the inbox route filters family plans away from class-scoped devices (`routes/sync.ts:103-124`).
- **Derivation on the device** (`apps/mobile/src/logic/homework/plan-derivation.ts:45-108`): ids `<planId>#<questId>`; a locked, unknown or preview target is skipped and counted as `notReady` (`:77-81`, `gating.ts:29-58`); a completed quest derives as done; **gaps this spec fixes**: an existing assignment's `targetDate` is never updated (`:84-90`), pending assignments are dropped only when the whole plan leaves the inbox (`:61-67`), and every dated item is derived at once. The summary reads plan progress by the `plan:` id prefix (`:16-21`, `logic/sync/summarize.ts:21-38`).
- **Display gaps.** Home card (2) takes assignments with `targetDate === today` only (`logic/homework/assignment-merger.ts:35-45`) while the Homework list treats past-dated pending items as "today" (`assignment-groups.ts:27-45`); Home counts every incomplete assignment, future ones included (`screens/home/HomeScreen.tsx:105, 222`); the "Coming up" list is unbounded (`screens/homework/HomeworkScreen.tsx:87-93`). A 12-week plan would show "36 to do today".
- **The console.** Plan builder at `/teach/space/plan?id=` (`apps/web/src/app/(console)/teach/space/plan/page.tsx`); pure helpers `addDays`, `spreadDates`, `oneExplicitPerDay`, `currentPlan`, `planReadout`, `readoutLine` in `apps/web/src/lib/console/plans.ts:5-109`; a **hand-kept Stage 1 mirror** of 8 quests / 5 episodes (`apps/web/src/data/stage1-catalog.ts:24-41`); the roster page links the builder (`app/(console)/teach/space/page.tsx:132`); the console is a static export addressed by `?id=` (`lib/console/routing.ts:5-21`).
- **Content reality.** Mobile bundles 11 playable quests today (8 Stage 1, 2 Stage 2, 1 Stage 4; `content/quests.ts:8-184`) and 18 after F-QUEST-002 (15 + 2 + 1); the other 27 grid cells are `preview` placeholders with `questIds: []` (`apps/mobile/src/content/episodes.ts:127-141, 188-206`; `stages.ts:7-97`). 24 researched heritage stories (three verification passes each, 112 minutes, F-STORY-005 section 3.3; native review pending) and 12 vocabulary topics (F-VOC; Food, Animals, Colors, Numbers are the intended free set, D5) are specified but not yet bundled. `FREE_STAGES = {stage1}` (`logic/entitlement.ts:16`); stage gating is enforced today, so a Stage 2+ lesson is genuinely Premium until payments are live (D5 only forbids new gating).
- **Where a summary is read.** The class roster returns each learner's `summary` (`packages/backend/src/routes/spaces.ts:361-390`); there is one summary per learner, shared by every space the learner is in. That is why "visible to the family, not the class" needs a read-time redaction (section 3.10).

**What this spec does.** (1) A **shared catalogue** of the 35 grid cells, the 24 stories and the 12 topics (replacing the web mirror); (2) `generateCurriculum` — pure, deterministic, locale-free; (3) the mapping onto F-PLAN-001 (`plans.meta_json`, `PlanItem.week`, a higher item cap only for curricula, an inbox capability gate so old apps never receive a long plan); (4) **device derivation** upgrades (one-week horizon, reconcile of dates and removals, source precedence) and the three display fixes; (5) **re-pacing** when a learner falls behind or the plan changes; (6) the **console wizard** (class and family) and the **in-app self-route**; (7) route **precedence** and visibility.

Terms. **Level**: where the learner starts, a `PlacementLevel` (`{ stage, band }`, F-PLC-001); not the D1 reading level (*Pictures first* ...), which only sets the pace default. **Session**: one dated slot; one plan item per session (the cap of one explicit assignment per day, F-HW-001 section 3.4). **Week kind**: `learn`, `culture`, `review`, `break`. **Culture week**: a week that leads with a heritage story. **Extras**: optional add-ons of a week (a vocabulary topic, the Hangul Check) that are not plan items and are never counted. **Coming-soon item**: an `episode` item whose episode is not released; it counts as "not ready" until an app update ships it. **Horizon**: how many days ahead a device derives homework (7). **Self-route**: a curriculum stored on the learner's device.

## 2. User story

> As a teacher, a parent or a self-learner, I want to say where we start, how long, how often and what we care about, and get a week-by-week route that is honest about what exists today, that I can adjust and publish once — and that quietly moves along when we miss a week, instead of piling up a list of overdue items.

Companion stories:

- As a **teacher**, I want a 12-week term for a Pictures-first class laid out in one pass, with review weeks and days off, so Sunday prep takes five minutes.
- As a **parent**, I want a plan sized for three short sessions a week that my child's device shows one week at a time.
- As a **self-learner**, I want my own route in the app, without a grown-up gate on a device that has no child profile, that I can re-pace with one tap.
- As a **maintainer**, I want one generator and one catalogue used by the console and the app, tested with golden outputs.

## 3. Acceptance criteria

### 3.1 Inputs, defaults and presets

> **Amended by F-ENT-003 (2026-10-11; revised by its OD-1 decision the same day).** The free plan is all of Stage 1, which is exactly what `unlockedStages: ['stage1']` already schedules for an unlicensed space, so the generator gains nothing: the `openQuestIds` input of F-ENT-003 revision 2 is withdrawn, and goldens A and B, the stored params and `regenerateFrom` are unchanged. The wizard warning names the product by space kind and the week range of the free lessons, and a plan that runs longer than its lessons offers a shorter length (F-ENT-003 §3.9.3, PR E3-9).

`packages/content-schema/src/curriculum/params.ts` (zod, exported from `src/index.ts`):

```ts
export const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);            // UTC day, like every day key in the app
export const WeekdaySchema = z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
export const CurriculumParamsSchema = z.object({
  audience: z.enum(['class', 'family', 'self']),                                  // wording and defaults only
  level: PlacementLevelSchema,                                                    // F-PLC-001 schemas/placement.ts; created here with the same shape if it has not landed
  placedOutQuestIds: z.array(z.string()).max(120).optional(),                     // exact set from a placement result; wins over `level`
  completedQuestIds: z.array(z.string()).max(400).default([]),                    // single learner (family, self); empty for a class
  startDate: DateKeySchema,
  weeks: z.number().int().min(1).max(52),
  sessionsPerWeek: z.number().int().min(1).max(7),
  sessionDays: z.array(WeekdaySchema).min(1).max(7).optional(),                   // if present its length wins over sessionsPerWeek
  minutesPerSession: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  daysOff: z.array(z.object({ from: DateKeySchema, to: DateKeySchema })).max(12).default([]),   // "holidays": no sessions on these days
  goals: z.object({
    focus: z.enum(['reading', 'words', 'culture', 'balanced']).default('balanced'),
    themes: z.array(ThemeKeySchema).max(5).optional(),                            // emphasised first, in this order
    motivation: z.enum(['heritage', 'kculture', 'curious', 'friends']).optional(),
  }).default({ focus: 'balanced' }),
  reviewEvery: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(6)]).optional(),   // default: 4 when weeks >= 12, else 0
  includeComingSoon: z.boolean().default(true),
  culturalAnchors: z.boolean().default(true),                                     // Hangeul Day, Seollal, Chuseok pull their story into their week
  unlockedStages: z.array(StageKeySchema).min(1),                                 // entitlement of the audience; locked lessons are not scheduled
  endStage: StageKeySchema.optional(),
}).superRefine(/* sessionDays unique; weeks * sessions <= 260; each daysOff.from <= to; startDate valid */);
```

Presets and defaults (`curriculum/presets.ts`, exported constants, one test each). Length presets are **choices**; `generateCurriculum` pre-selects none. The **recommended** length comes from `proposeRoute` (section 3.1a): `DEFAULT_SHORT_MAX = 4`, `DEFAULT_TERM_MAX = 16`. **Pace presets** `PACES = { gentle: 2, steady: 3, brisk: 4 }` sessions a week; the default pace is `gentle` for levelOrder 0 and for classes, `steady` otherwise (OD-13, decided 2026-10-12). The audience rhythm row of the defaults table changes accordingly (self 4 -> steady 3). (FP-B2)

| Preset | `weeks` | Meaning |
|---|---|---|
| `4-week` | 4 | one stage of Hangul in a month; `reviewEvery` 0 |
| `12-week` | 12 | one school term; `reviewEvery` 4 |
| `6-month` | 26 | half a year; `reviewEvery` 4 |
| custom | 1 to 52 | wizard number field or end date (rounded up to whole weeks) |

| Audience | Sessions per week | Minutes per session | Notes |
|---|---|---|---|
| `class` | 2 (a class day and a homework day; the wizard asks for the weekdays) | 15 (10 when most of the roster has `levelOrder` 0) | `unlockedStages` from the class's entitlement (`group_license`, `/teach/billing`) |
| `family` | 3 | 10 for *Pictures first*, else 15 | per learner; level prefilled from that learner's summary |
| `self` | 3 (pace `steady`; was 4, FP-B2) | 15 | level prefilled from the newest placement result |

`minutesPerSession` does not add items (one item per session); it feeds the estimates (section 3.3) and the warning `session-too-short`.

### 3.1a `proposeRoute` (`curriculum/propose.ts`, pure, 100 % covered) (FP-B3)

```ts
export interface ProposeInput {
  audience: 'class' | 'family' | 'self';
  seed: Pick<RouteSeed, 'level' | 'oralStage' | 'placedOutQuestIds' | 'themeOrder' | 'startQuestId'> | null;   // effectiveRoute with real completions; null = no level check (stage1 band 0)
  motivation?: Motivation;
  completedQuestIds: readonly string[];          // single learner; empty for a class
  levelOrder: 0 | 1 | 2 | null;                  // D1: pre-selects the pace and minutes only
  pace?: 'gentle' | 'steady' | 'brisk';          // the chip the learner picked; absent = the default
  rosterLevelOrders?: readonly (0 | 1 | 2)[];
  unlockedStages: readonly StageKey[];
  catalog: Catalog; today: DateKey;            // today: the freeze point for an existing plan
  startDate?: DateKey;                           // a new plan's first day, on or after today (class: the next class day, from the wizard); absent or earlier = today
  existing?: { meta: CurriculumMeta; items: PlanItem[] } | null;
}
export type DurationId = '4-week' | '12-week' | '6-month';
export interface DurationOption { id: DurationId; weeks: 4 | 12 | 26; stats: Pick<CurriculumDraft['stats'], 'lessons' | 'stories' | 'comingSoonItems' | 'openSessions' | 'endsAtStage'>; lastLessonWeek: number; lastContentWeek: number; preview: 'lessons-and-stories' | 'lessons-cut-short' | 'lessons-then-free-practice' | 'stories-and-words'; warnings: WarningCode[] }
export interface RouteProposal {
  kind: 'new' | 'update' | 'unchanged';
  headline: 'start-stage1' | 'continue-stage1' | 'continue-lessons' | 'stories-and-words' | 'beyond-content';
  pace: 'gentle' | 'steady' | 'brisk' | null;   // the chip of `params`; null when an existing plan's sessions a week match no chip
  params: CurriculumParams;
  options: readonly [DurationOption, DurationOption, DurationOption];
  defaultId: DurationId;
  diff?: { itemsRemoved: number; itemsAdded: number; newStartQuestId: string | null };   // 'update' only
}
export function proposeRoute(input: ProposeInput): RouteProposal | null;   // null = no plan yet and nothing ready to schedule
```

Rules: (1) `params`: the pace's sessions a week, the minutes of section 3.1, `level`, `placedOutQuestIds`, `goals` from the seed (`focus` = `reading` when `oralStage` is two or more stages above `level.stage`, else `balanced`, F-PLC-001 AM-4), `startDate` from the input when it is after `today`, else `today` (class: the wizard passes the next class day), no `sessionDays`. (2) `defaultId` by the rule of `AMENDMENTS-PLC-PLAN-HANDOFF.md` section 1.1 from a 52-week probe (fewer weeks only when an existing plan's six or seven sessions a week would pass `CURRICULUM_MAX_ITEMS`). (3) `options` are three real drafts; each `preview` code follows section 1.3 of `AMENDMENTS-PLC-PLAN-HANDOFF.md`. (4) With `existing`: `unchanged` when the seed moves neither the stored level (it never goes lower) nor the stored placed-out set, or when `regenerateFrom(..., { mode: 'reseed', paramsPatch, completedQuestIds })` yields the same future items as `regenerateFrom(..., { mode: 'shift', completedQuestIds })` (so a plan extended by weeks, a grown-up's hand edits or new catalogue lessons never read as a new start), else `update` with the length and end date of `existing`; `diff` and `newStartQuestId` leave the learner's finished quests out. `params` is the re-seed on `update` and the stored plan re-paced by `shift` on `unchanged` (never a re-seed it did not take), with the learner's completions. The cards, the probe and `defaultId` are drafted from those `params` starting `today`, at the plan's own sessions a week, minutes, goals and `unlockedStages`; the headline names the first lesson of the future those `params` keep; `pace` is the chip of their sessions a week, `null` off the chips. The input's `pace`, `levelOrder`, `rosterLevelOrders`, `motivation`, `startDate` and `unlockedStages` do not reach an existing plan: an entitlement change is not a new start (the patch has no `unlockedStages`, FP-B4). The function throws a ZodError when its input breaks a params cap (over 400 completions, over 40 placed-out quests). The re-seed's `paramsPatch` carries `level` and `placedOutQuestIds` only: the stored `goals` stay (a re-seed moves the start; a grown-up's themes, focus and motivation change in the wizard or the plan setup, never silently on a retake). **Without an override** the level never decreases and `placedOutQuestIds` is a superset; **with an override** the placed-out set may shrink, the put-back quests go into the future queue, and `diff.itemsAdded` counts them. (5) `null` when no plan exists and the draft schedules no ready item; with `existing` it is always `update` or `unchanged`, and a re-seed whose future holds no lesson or story is `unchanged` (no update empties a plan). Headline: `start-stage1` / `continue-stage1` when the first lesson is the opening or a later Stage 1 lesson, `continue-lessons` when it belongs to a later stage, and with no lesson `stories-and-words` (a level below Stage 3) or `beyond-content` (Stage 3 or higher). (6) No clock, no randomness, no locale.

### 3.2 The shared catalogue (`packages/content-schema/src/catalog/`)

One module replaces `apps/web/src/data/stage1-catalog.ts` (a Stage 1 only, hand-kept mirror) and gives the generator, the wizard preview and F-PLC-001's `RouteCatalog` the same data. Files: `schema.ts` (zod), `data.ts` (the data), `route-catalog.ts` (`routeCatalogOf(catalog): RouteCatalog`), `index.ts`.

```ts
export const CatalogCellSchema = z.object({ stage: StageKeySchema, theme: ThemeKeySchema, episodeId: z.string(), title: z.string(),
  status: EpisodeStatusSchema, minutes: z.number().int(), questIds: z.array(z.string()) });
export const CatalogQuestSchema = z.object({ id: z.string(), episodeId: z.string(), stage: StageKeySchema, theme: ThemeKeySchema, title: z.string(),
  minutes: z.number().int(), teaches: z.array(z.string()) /* symbol keys, F-QUEST-002 */, kind: z.enum(['lesson', 'story']) });
export const CatalogStorySchema = z.object({ id: z.string().regex(/^story:[a-z0-9-]+$/), questId: z.string(), order: z.number().int(), title: z.string(),
  recommendedStage: z.number().int().min(1).max(7), theme: ThemeKeySchema, minutes: z.number().int(),
  anchor: z.enum(['hangeul-day', 'seollal', 'chuseok']).nullable(), sampler: z.boolean(), status: z.enum(['ready', 'draft']) });
export const CatalogTopicSchema = z.object({ id: z.string().regex(/^topic:[a-z0-9-]+$/), key: z.string(), title: z.string(), order: z.number().int(),
  free: z.boolean(), minutes: z.number().int(), questId: z.string().nullable() });
export const FESTIVAL_DATES: Record<'hangeul-day' | 'seollal' | 'chuseok', Record<string, string>>   // year -> solar day, 2026 to 2030
export const CatalogSchema = z.object({ version: z.number().int().positive(), cells: z.array(CatalogCellSchema).length(35), quests: ..., stories: ..., topics: ... })
  .superRefine(/* one cell per (stage, theme); cell.questIds exist; unique ids; story questId = quest:story-<slug>-listen */);
```

- **Content** (initial `data.ts`, appendix A): 35 cells (Stage 1 five lessons of three quests each as F-QUEST-002 section 3.6; `stage2-life`, `stage2-nature`, `stage4-rites` shipped; the other 27 `preview` with the titles of `upperStageTitles`, `episodes.ts:143-186`); 18 lesson quests and 24 story quests (`kind: 'story'`, ids `quest:story-<slug>-listen`, episode `episode:shelf-<slug>`, F-STORY-004 section 3.1); the 24 stories of F-STORY-005 section 3.3 (112 minutes); the 12 topics (Food, Animals, Colors, Numbers free; Family, School, Body, Nature, Travel, Sports, K-culture, Science), `questId: null` until F-VOC registers playable quests.
- **Honest availability** is derived, never stored: a cell is *ready* when its status is `shipped` or `ready`, *coming soon* when `preview` or `draft`; a stage is *locked* when it is not in `unlockedStages`. A story is offered only when `status: 'ready'` (the review gate of F-STORY-004; the catalogue is flipped by whoever signs the review).
- **Parity (the guard that replaces the hand mirror).** `apps/mobile/src/content/__tests__/catalog-parity.test.ts` (imports both) asserts: every mobile episode has a catalogue cell with equal id, stage, theme, title, status class (ready or not), minutes and quest ids; every mobile quest has a catalogue quest with equal id, title and minutes and (once F-QUEST-002 exists) `teaches` equal to `questTeaches`; every shelf story of the bundle has a catalogue story with equal ids, minutes and recommended stage; and nothing in the catalogue is missing from the bundle except `coming soon` cells and `draft` stories. Failure messages print the corrected row. The web console imports the same module (`apps/web/src/data/catalog.ts`, an adapter that keeps the helper names `catalogLabel(kind, id)` and `questsOf(episodeId)` that the plan page uses, `app/teach/space/plan/page.tsx:10, 152, 178-185, 203`); `stage1-catalog.ts` and its test are deleted in PR P2-6, together with the two web-side parity tests that guarded the mirror until now (F-QUEST-002 section 3.7 `apps/web/src/data/__tests__/` and F-STORY-005 section 3.13 `catalogue-parity.test.ts`); this section's `catalog-parity.test.ts` supersedes both, and F-TCH-004's `lecture-catalog.ts` mirrors are replaced by the same adapter.
- `routeCatalogOf` maps catalogue quests to F-PLC-001's `RouteQuest` (`order` = canonical position, `playable` = the cell is ready, `grid` = `kind === 'lesson'`).

### 3.3 `generateCurriculum` (`curriculum/generate.ts`, pure, 100 % covered)

```ts
export function generateCurriculum(params: CurriculumParams, catalog: Catalog, opts?: { freezeBefore?: DateKey; history?: PlanItem[]; historyWeeks?: WeekMeta[] }): CurriculumDraft;
export function toPlanItems(draft: CurriculumDraft): PlanItem[];          // flattened, ordered by date
export function toMeta(draft: CurriculumDraft): CurriculumMeta;
export function regenerateFrom(plan: { meta: CurriculumMeta; items: PlanItem[] }, today: DateKey, catalog: Catalog, opts: { mode: 'shift' | 'requeue' | 'reseed'; completedQuestIds?: string[]; paramsPatch?: Partial<Pick<CurriculumParams, 'level' | 'placedOutQuestIds' | 'goals'>> }): CurriculumDraft;
export const GENERATOR_VERSION = 1;
```

No clock, no randomness, no locale, no catalogue import: the same `(params, catalog)` always returns the same draft. All strings the draft implies are **codes and ids**; the UI renders labels and warnings through messages (`weekLabel(week, catalog, messages)`), so one draft serves every UI language and never leaks Korean into English copy.

**Algorithm** (each step is a unit test):

1. **Normalise.** If `sessionDays` is present, `sessionsPerWeek = sessionDays.length`. `reviewEvery` defaults to 4 for 12 or more weeks, else 0. `endStage` defaults to `stage7`.
2. **Calendar.** Week `i` (1-based) spans `startDate + 7(i-1)` to `+6`. Session dates of a week: with `sessionDays`, every date of the week whose UTC weekday is chosen; otherwise offsets `round(j * 7 / sessionsPerWeek)` for `j < sessionsPerWeek` (the semantics of today's `spreadDates`, `apps/web/src/lib/console/plans.ts:20-30`, which moves to this module in PR P2-1). Dates inside any `daysOff` range are **removed, not moved**. A week with no remaining session is a `break` week. All arithmetic is UTC date keys.
3. **Done set.** `questsPlacedOutAtLevel(level, routeCatalog)` (F-PLC-001 section 3.6) ∪ `placedOutQuestIds` ∪ `completedQuestIds`.
4. **Lesson queue.** Visit grid cells from the level's stage to `endStage`. Stage 1 keeps its **canonical order** (symbols are taught in list order, F-QUEST-002 rule R1); later stages order cells by the theme order (`goals.themes`, else the motivation's theme first — `heritage` and `friends` -> `life`, `kculture` -> `rites`, `curious` -> `letters` (blueprint 04 section 8.1) — then canonical). A ready cell contributes its quests not in the done set; if its stage is not in `unlockedStages` those quests go to `locked[]` and are **not scheduled**. A cell that is not ready contributes one `episode` item to the **coming-soon queue** when `includeComingSoon`, limited to the first `COMING_SOON_MAX = 5` in stage order (so a published plan never reads as mostly placeholders). The lesson queue is the ready quests in this order; coming-soon items always come after every ready lesson and after the stories of step 5.
5. **Story pool.** Stories with `status: 'ready'` whose quest is not done. A story *fits* when `recommendedStage <= reached + 1`, where `reached` starts at the level's stage index and rises to the highest stage of any lesson scheduled so far (the rule of F-STORY-005 section 3.4: fit orders, it never hides). Order: `recommendedStage`, then theme rank, then `order`. **Anchors:** with `culturalAnchors`, a story whose `anchor` festival falls inside the plan (solar dates from `FESTIVAL_DATES`; Hangeul Day is 9 October every year) is *reserved* for the week that contains the festival day (or, when that week has no sessions, the nearest earlier week with sessions) and is kept out of the general pool; a festival outside the plan releases its story to the pool.
6. **Week kinds**, decided week by week in this priority: (a) a reserved anchor falls in this week -> `culture`; (b) `reviewEvery > 0`, `index % reviewEvery === 0`, not the last week and new ready items were scheduled since the last review -> `review`; (c) focus cadence (`reading` 0 culture weeks, `words` 0, `culture` every 2nd learn week, `balanced` every 3rd) reached and a fitting, unreserved story exists -> `culture`; (d) otherwise `learn`. Vocabulary cadence: `reading` 0, `words` every 3rd learn week, `culture` 0, `balanced` every 4th. Only weeks of kind `learn` are counted, and the counter starts at 0 in the first week in which topics are allowed (step 8: no unscheduled lesson still teaches symbols), which is why Example A shows no word topic and Example B (band 3, allowed from week 1) shows the first one in week 6.
7. **Fill sessions** (earliest date first, one item each): `review` and `break` weeks hold no items. A `culture` week gives the first `min(storiesPerCultureWeek, sessions)` sessions to stories (the reserved anchor story first), `storiesPerCultureWeek = min(2, max(1, floor(sessionsPerWeek / 2)))`; remaining sessions and all sessions of a `learn` week take, in order: the next ready lesson; else the next *fitting* story; else the next story of any stage (stories are never gated, so a stretch story beats an empty slot); else the next coming-soon item; else stay empty. Each item is `{ kind, id, targetDate, week }`.
8. **Extras** (never items, never counted): a `learn` week receives the next vocabulary topic when the cadence is reached **and** no unscheduled lesson still teaches symbols (a topic needs reading); topics run free ones first (Food, Animals, Colors, Numbers), then by `order`. A learn week left with no item at all is labelled free practice and receives the next topic (any focus except `reading`) if it has no extra yet. The week containing the last Stage 1 lesson receives `hangul-check` when the plan started in Stage 1.
9. **Output** `CurriculumDraft`:

```ts
export const WeekMetaSchema = z.object({ index: z.number().int().min(1).max(52), startDate: DateKeySchema, kind: z.enum(['learn', 'culture', 'review', 'break']),
  focus: z.object({ episodeId: z.string().nullable(), storyIds: z.array(z.string()).max(3), festival: z.enum(['hangeul-day', 'seollal', 'chuseok']).nullable() }),
  extras: z.array(z.discriminatedUnion('kind', [ z.object({ kind: z.literal('vocab'), topicId: z.string() }), z.object({ kind: z.literal('hangul-check') }) ])).max(2) });
export const CurriculumDraftSchema = z.object({ params: CurriculumParamsSchema, generatorVersion: z.number().int(), catalogVersion: z.number().int(),
  weeks: z.array(WeekMetaSchema), items: z.array(PlanItemSchema.extend({ week: z.number().int() })),
  locked: z.array(z.string()),                       // lesson quest ids not scheduled because their stage is locked
  stats: z.object({ sessions, readyItems, lessons, stories, comingSoonItems, openSessions, minutesPlanned, minutesAvailable, reviewWeeks, breakWeeks, cultureWeeks, vocabWeeks, endsAtStage: StageKeySchema }),
  warnings: z.array(z.object({ code: WarningCodeSchema, week: z.number().int().optional(), count: z.number().int().optional() })) });
```

   Stats: `minutesPlanned` sums catalogue minutes of ready items; `minutesAvailable = sessions * minutesPerSession`; `openSessions` counts non-review, non-break sessions without an item; `endsAtStage` is the highest stage of a ready item.

   **Warnings** (codes; the UI words them invitationally and tests assert both banned-word lists): `content-runs-out` {week of the first empty session}, `coming-soon-included` {first week, count}, `premium-needed` {count of locked lessons}, `fewer-sessions-than-units` {count of ready lessons that did not fit}, `session-too-short` {count of items longer than `1.5 x minutesPerSession`}, `already-done-skipped` {count removed by the done set}.

**Priorities by level** (a consequence of steps 3 to 8, not extra rules; each row is a test in `curriculum-generate.test.ts`):

| Starting level | What leads the route | Notes |
|---|---|---|
| `stage1` band 0 | all 15 Stage 1 lessons in canonical order, with a culture week every third learn week | no word topic is offered until the last symbol-teaching lesson (q10) is scheduled; the Hangul Check closes Stage 1 |
| `stage1` band 1 or 2 | the Stage 1 lessons that are not placed out (usually from q4 or q7) | same cadences, so topics and the check come sooner |
| `stage1` band 3 | the consolidation lessons q11 to q15, the Hangul Check, then stories | word topics start at their cadence from the first week |
| `stage2` band 0 | Stage 2 lessons (locked on a free tier), fitting stories, word topics | Stage 1 is entirely placed out |
| `stage3` band 0 | Stage 3 (coming soon) and the Stage 4 taste, stories up to the fit limit | most weeks are stories and free practice today |

10. **`toPlanItems`** orders by date; a coming-soon item gets `note: "Coming soon"` (the UI shows the episode title from the catalogue); other items have no note. At most 260 items (`CURRICULUM_MAX_ITEMS`).

**`regenerateFrom`** (re-pacing, section 3.7) is the same generator with `freezeBefore = today`: sessions dated before `today` keep their items (history, copied from `plan.items`), week kinds before the current week keep their `WeekMeta`, the cadence counters (`sinceCulture`, `sinceVocab`, `newSinceReview`) are rebuilt from those weeks, and the end date is unchanged. `mode: 'shift'`: the unit queue is the plan's own items dated `today` or later, in their existing order (lessons, stories, coming-soon items), laid onto the remaining sessions; anchor stories whose festival is still ahead keep their anchor week. `mode: 'requeue'`: the queue is rebuilt from the catalogue minus the done set (`completedQuestIds` plus history that is done), so unfinished past items return to the front. Items that no longer fit fall off the tail and raise `fewer-sessions-than-units`; the re-pace dialog offers **Add N weeks** (`params.weeks + N`, same call) to keep them.

`mode: 'reseed'` (after a retake or an override): `paramsPatch` replaces the stored `level` (never lower) and `placedOutQuestIds` (a superset, except after an override, which may remove ids); history before `today` is frozen; the future queue is rebuilt from the catalogue minus the done set, minus the patched placed-out set, minus every item dated before today; the end date is unchanged. A `reseed` with an empty patch equals `shift`. (FP-B4)

### 3.4 Worked examples (golden tests: `__tests__/curriculum-golden.test.ts` with a frozen `fixtures/catalog-2026-10.ts`)

Both examples use the catalogue as specified today: Stage 1 = 15 quests (F-QUEST-002), `stage2-life`, `stage2-nature` and `stage4-rites` shipped, the 27 other cells coming soon, the 24 stories `ready` (assumes the native reviews have passed), 12 topics. Week labels are the English rendering of `weekLabel`.

**A. A 12-week class, level Pictures first (a new class).** `audience: class`, `level: { stage: 'stage1', band: 0 }`, start Sunday 2026-10-18, `sessionDays: ['sun', 'wed']`, 10 minutes, `goals: { focus: 'balanced', motivation: 'heritage' }`, `daysOff: [{ 2026-11-22 to 2026-11-28 }]` (Thanksgiving week), all stages unlocked (a school licence), `reviewEvery` 4. 22 sessions (24 minus the week off).

| Wk | Dates | Kind | Label | Items (date -> item) | Extras |
|---|---|---|---|---|---|
| 1 | 10-18 to 10-24 | learn | Meet the Letters | 10-18 letters-q1; 10-21 letters-q2 | - |
| 2 | 10-25 to 10-31 | learn | Meet the Letters | 10-25 letters-q3; 10-28 life-q1 | - |
| 3 | 11-01 to 11-07 | learn | Around the Korean Table | 11-01 life-q2; 11-04 life-q3 | - |
| 4 | 11-08 to 11-14 | review | Review and collect | - | - |
| 5 | 11-15 to 11-21 | culture | Culture week: Kim Hong-do's Pictures of Everyday Life | 11-15 story kim-hongdo-genre-paintings; 11-18 rites-q1 | - |
| 6 | 11-22 to 11-28 | break | Days off | - | - |
| 7 | 11-29 to 12-05 | learn | New Year & Festivals | 11-29 rites-q2; 12-02 rites-q3 | - |
| 8 | 12-06 to 12-12 | review | Review and collect | - | - |
| 9 | 12-13 to 12-19 | learn | Tigers, Mountains, Moon | 12-13 nature-q1; 12-16 nature-q2 | - |
| 10 | 12-20 to 12-26 | learn | Tigers, Mountains, Moon | 12-20 nature-q3; 12-23 crafts-q1 | - |
| 11 | 12-27 to 01-02 | culture | Culture week: King Sejong's New Letters | 12-27 story sejong-new-letters; 12-30 crafts-q2 | - |
| 12 | 01-03 to 01-09 | learn | Yut, Kites & Paper | 01-03 crafts-q3; 01-06 stage2-life-q1 | Hangul Check |

(All quest ids are `quest:stage1-<episode>-q<n>`.) Stats: 18 items (16 lessons, 2 stories), 79 planned minutes of 220 available, 2 review weeks, 1 break week, 2 culture weeks, 0 open sessions, ends at Stage 2. Warnings: `fewer-sessions-than-units` {2} (`stage2-nature-q1` and `stage4-rites-q1` did not fit). Reading the table: Stage 1 takes eight teaching weeks at two a week; the review weeks are rest-and-collect weeks (no items) until the review item kind exists; the Hangul Check sits in the week of the last Stage 1 lesson. The first item as stored: `{ "kind": "quest", "id": "quest:stage1-letters-q1", "targetDate": "2026-10-18", "week": 1 }`.

**B. A 6-month self-learner, level Reads easily.** `audience: self`, `level: { stage: 'stage1', band: 3 }` (a placement that found the letters and syllables with finals; q1 to q10 placed out), start Monday 2026-10-12, `sessionDays: ['mon', 'wed', 'fri']`, 15 minutes, 26 weeks, `goals: { focus: 'balanced', motivation: 'kculture' }`, free tier (`unlockedStages: ['stage1']`), `reviewEvery` 4. 78 sessions.

| Wk | Dates | Kind | Label | Items | Extras |
|---|---|---|---|---|---|
| 1 | 10-12 to 10-18 | learn | Tigers, Mountains, Moon | nature-q2; nature-q3; crafts-q1 | - |
| 2 | 10-19 to 10-25 | learn | Yut, Kites & Paper | crafts-q2; crafts-q3; story chuseok-ganggangsullae | Hangul Check |
| 3 | 10-26 to 11-01 | learn | Heritage stories | story sejong-new-letters; shapes-of-hangeul; hangeul-day | - |
| 4 | 11-02 to 11-08 | review | Review and collect | - | - |
| 5 | 11-09 to 11-15 | culture | Culture week: Eighty Thousand Woodblocks | story tripitaka-koreana; sillok-royal-historians; kim-hongdo-genre-paintings | - |
| 6 | 11-16 to 11-22 | learn | Heritage stories | story sun-and-moon; cheugugi-rain-gauge; dano-ssireum | words: Food |
| 7 | 11-23 to 11-29 | learn | Heritage stories | story sillok-mountain-archives; jikji-metal-type; gimjang-arirang | - |
| 8 | 11-30 to 12-06 | review | Review and collect | - | - |
| 9 | 12-07 to 12-13 | learn | Heritage stories | story angbuilgu-sundial; janggyeong-panjeon; jagyeongnu-water-clock | - |
| 10 | 12-14 to 12-20 | culture | Culture week: Pansori Tales | story pansori-tales; seungjeongwon-ilgi-every-day; nanjung-ilgi | - |
| 11 | 12-21 to 12-27 | learn | Heritage stories | story donguibogam; ilseongnok-daily-reflection; uigwe-royal-birthday | - |
| 12 | 12-28 to 01-03 | review | Review and collect | - | - |
| 13 | 01-04 to 01-10 | learn | Heritage stories | story joseon-records-today; stage2-rites (coming soon); stage2-letters (coming soon) | words: Animals |
| 14 | 01-11 to 01-17 | learn | New episodes are on the way | stage2-crafts; stage3-rites; stage3-letters (all coming soon) | - |
| 15 | 01-18 to 01-24 | learn | Free practice | - | words: Colors |
| 16 | 01-25 to 01-31 | review | Review and collect | - | - |
| 17 | 02-01 to 02-07 | culture | Culture week: Hoya's Seollal Morning | story seollal-new-year (Seollal is Sunday 7 February 2027 on the Korean calendar) | - |
| 18 to 19 | 02-08 to 02-21 | learn | Free practice | - | words: Numbers; Family |
| 20 | 02-22 to 02-28 | review | Review and collect | - | - |
| 21 to 26 | 03-01 to 04-11 | learn | Free practice | - | words: School; Body; Nature; Travel; Sports; K-culture |

Stats: 29 ready items (5 lessons, 24 stories), 5 coming-soon items, 132 planned minutes of 1,170 available, 5 review weeks, 3 culture weeks, 11 vocabulary weeks, 29 open sessions, ends at Stage 1. `locked`: `quest:stage2-life-q1`, `quest:stage2-nature-q1`, `quest:stage4-rites-q1`. Warnings: `coming-soon-included` {week 13, 5}, `content-runs-out` {week 15}, `premium-needed` {3}. **This is the honest picture of today's content:** about fourteen weeks hold lessons, stories and the first coming-soon items (plus the Seollal story in week 17); free practice starts in week 15, with the 12 word topics. (E-2; the golden test is authoritative.) The preview says so in plain words (section 3.8); it never pads the plan with placeholders beyond five episodes.

### 3.5 Mapping onto F-PLAN-001 plans (additive)

- **`PlanItemSchema`** gains `week: z.number().int().min(1).max(52).optional()`. `kind` stays `'quest' | 'episode'` (stories are shelf quests, coming-soon cells are episodes; a `review` kind comes with F-RVW-001, D11).
- **`CurriculumMetaSchema`** = `{ kind: 'curriculum', generatorVersion, catalogVersion, params, weeks: WeekMeta[], horizonDays: z.number().int().min(1).max(28).default(7), repacedAt: string | null }`. About 10 KB for 52 weeks.
- **Cap.** `CURRICULUM_MAX_ITEMS = 260`. `PlanSchema` and `PlanUpsertSchema` keep `.min(1)` and replace `.max(PLAN_MAX_ITEMS)` by `.max(CURRICULUM_MAX_ITEMS)` plus a `superRefine`: with `meta === null` more than `PLAN_MAX_ITEMS` (30) items is an issue, exactly as today. `PlanSchema` and `InboxPlanSchema` gain `meta: CurriculumMetaSchema.nullable().default(null)`; `PlanUpsertSchema` gains `meta: CurriculumMetaSchema.nullable().optional()` (absent on an update = keep the stored meta, `null` = turn the plan into a classic one, which the item-cap refinement then checks), so an older console or cached page that omits the field cannot silently strip a route's meta. `toMeta` stores `params` without `completedQuestIds` (a device-side fact: it is passed to `regenerateFrom` when needed, never persisted on the server or in a plan row).
- **D1.** Migration `apps/api/migrations/0006_plan_meta.sql` (E-1: the next free number; `0004_waitlist.sql` exists and F-SPACE-002 T-3b holds `0005_class_transfer.sql`; if another migration lands first, P2-4 takes the next free number when it is opened, the order is decided at merge, and `scripts/check-migrations.mjs` fails CI on a duplicate prefix): `ALTER TABLE plans ADD COLUMN meta_json TEXT;` (NULL = a classic plan). `d1.ts` `toPlan` parses `meta_json`, `putPlan` writes it and updates it on conflict (`d1.ts:50, 218-222`); the memory adapter needs no change (`clone`); the db contract test (`db/__tests__/db-contract.test.ts:136-147`) gains a meta round trip.
- **Routes.** `plansRoutes.put('/:id/plans')` copies `meta` through on create and update (the item cap is the schema's); `inboxPlansFor` adds `meta` to the inbox row and passes the `week`-bearing items through (`routes/plans.ts:24-59, 83-95`).
- **Review hardening (P2-4, PR #232).** (a) Every item's `week` must be at most `meta.weeks.length` when the plan has a meta (`curriculumWeekIssue`; `PlanUpsertSchema` checks a sent meta, the route checks the effective one, 422). (b) A **published** classic plan never becomes a curriculum (`409 curriculum_needs_new_plan`): the gate below would hide it from old apps and drop their unfinished homework from it; an unpublished draft may. (c) `inboxPlansFor` holds back a plan whose stored meta does not parse as `CurriculumMetaSchema` and a meta-null plan of more than 30 items (an unreadable `meta_json`), so one bad row never fails a device's strict inbox parse and never reaches an app without the horizon. (d) `selfRoute` and `summary.selfRoute` parse leniently (`.catch`): a malformed route reads as absent and the preserve rule keeps the stored one, instead of failing the whole upload or backup restore. (e) The family roster projects `summary.selfRoute` to its five keys. (f) Rollback: once a curriculum is published, the API Worker is not rolled back below P2-4 (an older Worker has no gate); see the migration comment and `docs/launch/owner-runbook.md`.
- **Capability gate (old apps never see a long plan).** An app that does not know the horizon would derive every dated item at once. The inbox route accepts `?cap=curriculum`; plans with a non-null `meta` are returned **only** when it is present (`routes/sync.ts:103-124`; the app adds the parameter in `platform/sync-api.ts:236`, `getInbox`). Without it a curriculum plan is simply absent, so an old app keeps working on classic plans and the roster shows the plan as "waiting for the next sync" for that learner.
- **Roster redaction.** `routes/spaces.ts:382` returns `summary: redactSummary(snapshot?.summary ?? null, space.kind)`: `selfRoute` is removed unless `space.kind === 'family'` (section 3.10).
- **Snapshot and summary.** `ProgressSnapshotSchema` gains `selfRoute: SelfRouteSchema.nullable().default(null)` where `SelfRouteSchema = { id: /^route:[a-z0-9-]+$/, createdAt, updatedAt, archivedAt: string | null, meta: CurriculumMetaSchema, items: PlanItem[] (max 260) }`; `mergeSnapshots` keeps the route with the newest `updatedAt` (ties: local), `isSubsetOf` compares id and `updatedAt`, `blankSnapshot` adds `selfRoute: null` (`apps/mobile/src/logic/sync/merge.ts:80-111`, `store/progress-store.ts:77-89`). `ProgressSummarySchema` gains optional `selfRoute: { done, total, notReady, weeks, endsOn } | undefined` (`schemas/sync.ts:15-38`, `schemaVersion` stays 1). The Worker must be deployed first (it would strip these keys). **Local copies carry no defaults:** the progress store reads its snapshot unparsed (`store/progress-store.ts:156`), so existing snapshots lack `selfRoute` at runtime; `withSnapshotDefaults` (created by whichever of F-PLC-001 P-5 / this spec's P2-4 / F-VOC-005 P-3 lands first) fills `selfRoute: null` in `hydrate`, `replaceSnapshot`, restore and the server read, and `mergeSnapshots` / `isSubsetOf` treat a missing key as `null`. **Mixed app versions:** the Worker stores the uploaded snapshot wholesale (`routes/sync.ts:71-79`), so an older build re-uploading after a merge would erase `selfRoute` and `summary.selfRoute` from the server copy; P2-4 extends the preserve rule of F-VOC-005 P-1 (one shared helper): an incoming `selfRoute` of `null` never replaces a stored non-null one (a stopped route is archived with `archivedAt`, never set to `null`), and the same for `summary.selfRoute`.

### 3.6 Device derivation (extends F-PLAN-001 section 3.3; `plan-derivation.ts`, pure, 100 %)

`deriveAssignments` takes `sources` (class / family inbox plans plus the self-route as a synthetic source of kind `self` with id `route:<id>`; assignment ids `route:<id>#<questId>`, `assignedBy: 'system'`, so they never match the `plan:` prefix that `planIdOf` and the summary's `planProgress` read, `plan-derivation.ts:16-21`). New rules:

1. **Horizon.** For a source with `meta.horizonDays` (default 7), an item whose `targetDate > today + horizonDays` is not derived and not counted in `total`; items without a date are derived (default today) as before. Classic plans have no horizon.
2. **Reconcile.** For every active source: a *pending* assignment whose item now carries another date gets the new `targetDate` (`redated`); a pending assignment whose item left the plan, left the horizon or became locked is removed (`removed`); completed assignments are never touched; assignments of a source that left the inbox keep today's behaviour (pending dropped, done kept, `:61-67`). The result gains `redated` and `changed` includes it. This is what makes "Re-pace from today" and edits of a published plan reach devices (F-PLAN-001 section 3.2 already bumps `updatedAt`).
3. **Precedence** (also section 3.10): `sourceRank = { teacher: 0, parent: 1, system: 2 }`; ties by earlier `targetDate`, then `assignedAt`.
4. **Notes.** The mapping `assignedBy` becomes `class -> teacher`, `family -> parent`, `self -> system` (a `school` space keeps today's non-class result, `parent`, `plan-derivation.ts:97`).

Display fixes (three commits inside PR P2-5):

- `assignmentsForToday` (`assignment-merger.ts:35-45`) takes pending assignments with `targetDate <= today` (carry-over, matching `groupAssignments`, `assignment-groups.ts:36`), sorted by the precedence of rule 3. A learner who skips a day sees the unfinished item on Home the next day; nothing is shown as late (`dueLabel` already says "Today" for past dates, `:48-53`).
- Home counts `groupAssignments(snap.homework, today).today.length` instead of every pending homework item with no date filter (today's count, `HomeScreen.tsx:110`), and the Homework line (`:215`) uses the same number. (E-3) *Review amendment (PR #254):* past the Today list cap of three, Home and the Hoya bubble on the Homework list use words with no number ("A few to do today", "You have a few things to do today."), because carried-over items have no lower bound (a learner who joins a class mid-term or returns after a gap); `showsTodayCount` in `assignment-groups.ts`.
- The Homework list shows at most three items under "Today" and, below them, one neutral line "More are waiting. They come one at a time." (no number); "Coming up" shows only the next seven days, followed by one collapsed row "Later on your route" (no list of 70) (`HomeworkScreen.tsx:62-93`). The route label `assignedByLabel` returns "Your route" for ids with the `route:` prefix and keeps "From class", "From home" (`assignment-groups.ts:56-65`). *Review amendment (PR #254):* learner copy says "plan", not "route" (OD-7 / FP-B13), so the pill reads "Your plan"; the collapsed row reads "Later", because it can hold class and home items too. The three visible Today rows keep the first class item and the first home item (the F-TCH-001 section 3.5 stacking exception of section 3.10), then fill in precedence order.

*Review amendment (PR #254), when derivation runs:* the horizon moves with the calendar, not only with the inbox. Besides every inbox refresh, the device derives again from the cached plans and the self-route at app start, when the app returns to the foreground, and when an inbox call cannot run (offline, no credentials, an error) (`usePlanStore.rederive`, `rederiveLocal` in `membership-store.ts`). A sync merge is a union, so a merged snapshot is reconciled against the cached plans before it is uploaded (`SyncInput.reconcile`, `usePlanStore.reconcile`) and after a backup restore; a device that has never cached an inbox leaves pending `plan:` items for the next inbox.

`summarize` keeps `planProgress` for `plan:` sources; `total` for a curriculum means "scheduled so far". The console knows the full length from the plan (`items.length`) and words the readout "4 / 6 so far - 36 planned" (section 3.8). `selfRoute` summary is computed by `selfRouteProgressOf(snapshot, notReady)`.

### 3.7 Re-pacing and plan changes

- **When a learner falls behind** nothing is flagged and nothing is lost. Only a week of future items exists on the device (rule 1) and unfinished items carry over (section 3.6). Past-dated items are not bounded by the horizon (a plan joined mid-term derives its earlier items), so the learner screens never show a count above three: the Homework list shows three rows and a neutral line, and Home and the Hoya bubble switch to words with no number (review amendment, PR #254). For a longer gap the route is re-paced:
  - **Class and family** (console): a **Re-pace from today** button on the plan readout runs `regenerateFrom(plan, today, catalog, { mode: 'shift' })` locally: items dated before today stay, the remaining items keep their order and are laid on the session calendar starting at the next session date (days off respected, review and culture weeks re-decided, new weeks re-numbered from the current week), the same plan id is saved with `repacedAt` set. Devices reconcile dates on their next sync (rule 2). Completion is not known to the console (it reads only `planProgress` counts, F-TCH-001 section 3.6), so `shift` is the only console mode; an item a learner already finished stays finished, because derivation marks a completed quest done on any date (F-PLAN-001 section 3.3).
  - **Self-route** (device): `repaceSelfRoute(route, snapshot, today, catalog)` runs `regenerateFrom(..., { mode: 'requeue', completedQuestIds })`: pending past items return to the head of the queue, then the remaining weeks are re-laid. It runs automatically at most once per UTC day when there are three or more pending past-dated items or the oldest is seven days old (never while a quest is open), and by hand from the route overview ("Move my plan along"). A calm line on the Home route card says "Hoya moved your plan along" the next time it is seen; no counts, no "behind".
- **Plan changes.** Editing and re-saving a published plan, changing the date of an item, removing an item or adding days off all go through the same reconcile (rule 2). A plan whose item ids are unknown to an older app counts as not ready, as before.
- **New content.** A coming-soon episode that ships needs no regeneration: its `episode` item expands to the new quests at derivation (`plan-derivation.ts:72`). The wizard offers **Refresh route** (a normal `regenerateFrom` with `mode: 'shift'` and the current catalogue) when `catalogVersion` is older than the app's.
- **Per-learner overrides** inside a class plan stay out of scope (F-PLAN-001 section 4).

**Hoya check-in** (P2-7b, OD-13, decided 2026-10-12): once, at the start of week 5 of an active self plan, a positive card offers a pace change computed from sessions actually finished in weeks 1-4: fewer than half -> "Want a lighter week?" (Gentle); every session -> "Want to go a bit faster?" (one step up). It never names a missed or late session, can be closed with **Not now**, and applies through `regenerateFrom(..., 'shift')` with the new sessions a week. (FP-B14)

P2-7b implementation notes (review of PR #545, 2026-10-13):
- **Offline.** The automatic re-pace syncs first and runs once the sync merged; when the sync does not get through (offline, an error, a conflict to retry later) it runs on the device copy the same day. The merge rule "a stopped copy wins, a later-made plan wins" keeps the next sync right.
- **Yes keeps every lesson.** A lighter pace adds the weeks it needs (Add N weeks), up to 52 weeks and the item cap. When even that cannot hold every remaining item, the check-in is not offered for that plan (`checkInFits`), so yes never drops a lesson.
- **Weekdays.** A pace change has a different number of sessions a week, so the weekdays chosen in Change the plan are spread again for the new pace; the done line says the new number of days.
- **A child's plan.** On a child profile the plan is set by a grown-up: **Stop this plan** and **Change the plan** go through the grown-up gate when the device needs it, and the Hoya check-in shows only while plan changes are open (`planChangesOpen`, the Profile row rule). **OWNER DECISION OD-17 (decided 2026-10-13, recorded; F-ROUTE-001 section 9):** a child does not answer the Hoya check-in alone. On a device that needs the grown-up gate the check-in stays hidden from the child and shows only while plan changes are open, so a grown-up answers it (the behaviour PR #545 shipped; `usePlanSlot` passes `planChangesOpen` to `useCheckInOffer`). No code change follows from the decision; it lifts the gate on the P2-8b flag flip.
- **Accepted limits.** The "answered once" mark of the check-in is kept per device (`route-ui:<profileId>`), so a second device can show it once more for the same plan (a yes there is already reflected in the new pace). Two different plans merge by `createdAt`, so a device whose clock runs far ahead can win a later merge, as with every `updatedAt` rule in the snapshot merge (assumption 6).

### 3.8 Console wizard (class and family): `/teach/space/curriculum?id=`

New page `apps/web/src/app/(console)/teach/space/curriculum/page.tsx` (a client page like the plan builder, `?id=` routing, `ROUTES.spaceCurriculum(id)` in `lib/console/routing.ts`); logic in `apps/web/src/lib/console/curriculum.ts` (pure, tested): `defaultsFor(audience, learners)`, `toParams(state)`, `levelHint(learners)`, `levelFromSummary(summary)`, `previewRows(draft, catalog)`, `weekLabel(...)`, `readoutLine(row, planned)`. Wireframe `curriculum-planner.md`. `unlockedStages` for the generator comes from the space's entitlement: `unlockedStagesForSpace(entitlements, spaceId, now)` in the same file returns all seven stages when `api.entitlements()` (`lib/console/api.ts:193`) holds an active entitlement (`isActive`, `lib/console/billing.ts:44-50`) for this space or its school, else `['stage1']` (assumption 9a).

1. **Starting point.** Six cards (no jargon): *Brand new* (`stage1`/0), *Knows some letters* (`stage1`/1), *Knows all the letters* (`stage1`/2), *Reads words* (`stage1`/3), *Reads first words* (`stage2`/0), *Reads first sentences* (`stage3`/0). A quiet hint when 3 or more learners have a summary: "Most of your students start here: ..." (`levelHint` = the most frequent `summary.placement.level`, else from `stage1.questsDone / questsTotal`; never a list, never a ranking). For a family space the wizard first picks the learner and prefills from that learner's summary. The wizard prefills start, themes, focus and motivation from `proposeRoute` using `levelFromSummary(summary)` (coarse mapping); for a family space the learner is picked first. (FP-B5)
2. **Length and rhythm.** Pace chips *Gentle*, *Steady*, *Brisk* and length chips *4 weeks*, *12 weeks*, *6 months*, *Choose weeks*, with the recommended ones pre-selected and tagged *Suggested*, and one honest preview line under each length (FP-B5); start date; weekday chips (class: a class day + a homework day); minutes per session (5 to 30); *Days off* (add date ranges; shown as removed sessions).
3. **Goals.** Focus chips (*Read Hangul*, *First words*, *Culture and stories*, *A bit of everything*), theme chips (order = priority), *Mark Korean holidays* (culture anchors, default on), and *Include lessons that are not released yet* (default on for every audience, with the line "New episodes appear as they are released.").
4. **Preview.** The week table of section 3.4 (week, dates, kind badge, lesson / story titles in the UI language, extras), stats ("18 lessons and stories - about 80 minutes - ends in Stage 2"), and the warnings in plain words: *No new episodes yet from week 15 - free practice and word topics fill those weeks*, *5 episodes are not released yet and start on their dates once they are*, *3 lessons need Premium and are not in the plan*, *2 lessons did not fit - add a week or a session*. Premium items link to `/teach/billing` for a class. Buttons: **Use this route** and **Change something** (back). Pressing **Use this route** saves a **draft** (`api.savePlan(spaceId, { title, items, meta, publish: false })`) and opens the plan builder on it (`?id=<space>&plan=<planId>`). When a family-space learner has a newer `summary.placement` than the plan's level, the learner card shows 'Sam's newest check found a later place to start' with **Update the plan** (`reseed`, console mode). Class plans are not updated per learner. (FP-B5)
5. **Plan builder** (changes to `plan/page.tsx` and `lib/console/plans.ts`): items of a plan with `meta` are grouped under week headers (label, dates, kind badge, extras); the per-item ↑ ↓ × date and note controls stay; **Spread dates** is hidden for curricula (dates come from the calendar; editing one date is allowed and survives until the next re-pace); a plan switcher lists the active route first, then other live plans, then drafts (replacing "newest only", `plans.ts:60-67`); Publish, Save draft and Archive are unchanged. *Amended 2026-10-17 by `AMENDMENTS-LESSON-CHOOSER.md` (row LV-3a):* the builder's grouped lesson picker lists the stages this step's `unlockedStagesForSpace` gives. On a route draft it never merges lessons into an episode. Lessons that come out of a whole episode keep its date, week and note, and a lesson added beside a lesson of its own episode takes that week and date (sections 4 and 5 there).
6. **Readout** (published): a **This week** block first (the items whose week contains today, per learner `done / so far`), then a collapsible week list; `readoutLine` becomes "4 / 6 so far - 36 planned" when `meta` exists; **Re-pace from today**; no ranking, no percentage, learners in activity order (`plans.ts:89-109`).
7. **Entries.** Roster: **Plan this term** next to the weekly plan button (`app/(console)/teach/space/page.tsx:132`); plan builder empty state: **Start from a template** (the room left in `design/wireframes/console/plan-builder.md`); family home (`/teach/home`): the same link per learner.

**Summary fields the planner reads or adds** (no other field is needed): `ProgressSummary.placement` (F-PLC-001: the level hint and prefill), `stage1.questsDone / questsTotal` (fallback hint), `planProgress[planId] = { done, total, notReady }` (unchanged shape; for a curriculum `total` means "scheduled so far"), and the new optional `selfRoute = { done, total, notReady, weeks, endsOn }` (family only). `lastActiveAt`, `minutesLast7d` and the roster order are unchanged. Nothing per quest, per day or per learner-comparison is added.

Console copy is English in `messages/en/console.ts` (`console.curriculum.*`) and translated with the rest of the console (F-I18N-001); every string passes `isCaregiverSafe` and the F-PAR-001 section 3.6 phrases (`behind`, `falling behind`, `should have`, `missed too many`, `compared to`).

### 3.9 In-app self-route (`screens/route/`, `flags.routeEnabled`)

- **Entry.** Profile -> **Make a weekly plan** (`ProfileScreen.tsx`, a row near the sound switch; a grown-up gate only when `gateRequired` for a child profile, F-LEARN-001; a self profile opens it directly), and the Home prompt **Hoya can make a weekly plan for you** (eligibility and dismissal: F-PLC-001 AM-6), Profile's **Make a weekly plan** row (always), the result-screen strip and the gated report card (AM-1, AM-5). `PinEntry.next` gains `'RouteProposal'` and `'RouteSetup'` (`apps/mobile/src/navigation/types.ts:5`). (FP-B6, FP-B15) New root screens `RouteSetup`, `RoutePreview`, `RouteOverview` (`navigation/root.tsx:47-61`).
- **Proposal.** `RouteProposal { source: 'placement' | 'home' | 'profile' | 'parent', profileId, mode?: 'new' | 'update' }` (`screens/route/RouteProposalScreen.tsx`, wireframe `route/proposal.md`) shows `proposeRoute`: the headline, the pace chips, three length cards (recommended pre-selected, tagged 'Hoya suggests', each with its preview line), the start day, a disclosure **Change days and time**, the first week as a short list, **Start this plan** and **Not now** (dismisses, AM-6). Learner screens never show `premium-needed`, a price or the word Premium. The four setup steps below remain for **Change the plan**, prefilled from the proposal. (FP-B6)
- **Setup** (large-chip steps, the console wizard's four steps with the same defaults for `self`): where to start (prefilled from `effectiveRoute`, else *Brand new*; themes, focus and motivation prefilled too) (FP-B6), time (minutes, days of the week), how long (*4 weeks*, *12 weeks*, *6 months*), what you like (focus and themes). **Preview** shows the first four weeks expanded, the stats and the warnings of section 3.8 in the UI language (the `premium-needed` warning is **never** worded or shown on this learner screen: a learner sees only "More lessons are coming" for the locked and coming-soon parts; the Premium wording exists only in the grown-up console wizard), then **Start this plan** (FP-B15): `routeStore.create(profileId, draft)` stores the `SelfRoute` in the snapshot (`progress-store.setSelfRoute`), derives the first week, fires `route.created`.
- **Home.** Before a plan exists the Home card is only the prompt (above). **Once a plan exists there is no separate Home plan card**: its week appears as one line in F-ROUTE-001's My route strip ('Week 3 of your weekly plan'), and the week dots of the former card are dropped (they fill with calendar time and reset weekly). Card (2) follows the plan through the normal merge (section 3.6); a learner can always play anything else. (FP-B6)
- **Overview.** Weeks as a vertical path (the current week first, later weeks collapsed): labels, kind badges, items, extras (an optional word topic opens the Library topic when F-VOC ships). Buttons: **Move my plan along** (manual re-pace), **Stop this plan** (FP-B15; archives it, pending route assignments are removed, history stays). Never the words behind, late, missed, overdue; the level is never named to a child ("We found a path for you").
- **Storage.** In the progress snapshot (`selfRoute`), so it rides sync, the backup file and Rescue Code restore (`schemas/sync.ts:88-95`); no extra storage key. Derived assignments live in `snapshot.homework` like any other.
- **Class devices and free tier.** `unlockedStages` comes from `unlockedStagesFor(now, learnerId)` (`store/plan-store.ts:34-37`).

### 3.10 Route precedence and visibility

- **Precedence on a day** (Home card (2) and the order of "Today"): class (teacher) > family (parent) > self (system); within a rank the earlier `targetDate`, then the earlier `assignedAt`. Only one assignment takes card (2); the others stay pending and surface on the following days (no data is dropped). A learner with a live class or family route can still create a self-route (the setup says "Your teacher has a route for you. You can add your own; theirs comes first."); the stacking exception of F-TCH-001 section 3.5 (teacher 1 + parent 1 per day) is honoured in the Homework list, not on Home, which keeps its one explicit card (F-HW-001 section 3.4).
- **Visibility (D11).** A self-route is visible to the learner and to the **family space** (the parent's console learner card reads `summary.selfRoute`: "Own route: 7 / 9 so far - 36 planned"), and **not** to a class: the roster handler removes `selfRoute` from the summary of any space whose kind is not `family` (`routes/spaces.ts:382`), and self-route assignment ids never enter `planProgress`, which class rosters read. Test: the same learner in a family and a class space returns the field to one and not the other.
- **Class-scoped devices** (`scope: 'class'`) never receive family plans (`routes/sync.ts:111-116`); a self-route is local and unaffected.

### 3.11 States, accessibility, offline, privacy, telemetry

- **Offline.** The generator and the catalogue are bundled and pure; the wizard preview and the self-route setup work with no network; saving a console plan needs the API (existing error path, `COPY.cantReach`); the self-route is saved locally and syncs later.
- **Empty and error states.** No ready content for the chosen level and stage range -> the preview shows only the warnings and a **Change something** button (never a blank page); `weeks * sessions` above 260 items -> a plain message on step 2 ("That is more than a plan can hold. Choose fewer weeks or sessions."); the wizard does not accept a start date earlier than today (the generator itself accepts any date and treats it as given); an unknown level -> *Brand new*; a stale `catalogVersion` -> **Refresh route**; the catalogue parity test guards drift.
- **Accessibility.** Chips and cards at least 64 dp / 44 px with visible selected state and `role="radio"` / `radio`; the week table is a real table on the web (header cells, row scope) and a list with grouped headings in the app; badges carry text, never colour only; focus order follows the steps; reduced motion has no animation to remove; target sizes and type follow `touchTarget` tokens and the 18 pt body floor; the Home dots are dropped with the Home plan card (FP-B6), so no week count is read out.
- **Privacy.** The route holds only ids, dates and the params above (no names); it never leaves the device except inside the snapshot, and the summary exposes counts only.
- **Copy.** All strings through `messages` (F-I18N-001), plain Pre-A1 English; no "kids", no age, no "behind", "late", "overdue", "missed", "failed", "incomplete", "lazy" and none of the F-PAR-001 phrases in any locale; generated titles and warnings are tested against both lists.
- **Telemetry** (app only; the console has no telemetry client): `route.created` `{ audience: 'self', weeks, sessionsPerWeek, focus, startStage }` and `route.repaced` `{ mode: 'auto' | 'manual', pending }` are added to `TELEMETRY_EVENT_NAMES` (`schemas/telemetry.ts:9-43`) and its exact-list test. `route.proposed` `{ source, kind: 'new' | 'update', defaultWeeks: 4 | 12 | 26, pace?: 'gentle' | 'steady' | 'brisk' }` (`pace` left out when the proposal's `pace` is null: an existing plan off the chips), `route.proposal_skipped` `{ source }` (Just start / Not now), `route.updated` `{ source: 'retake' | 'override', itemsRemoved, itemsAdded }`. `route.created` gains `from: 'proposal' | 'setup'` and `changed: boolean`. Codes and counts only. Added to `TELEMETRY_EVENT_NAMES` and its exact-list test in P2-4, deployed in the shared Worker deploy D2 (F-ROUTE-001 section 6.0). (FP-B7)

### 3.12 Behaviours (Given / When / Then)

- **Given** the same params and catalogue, **when** `generateCurriculum` runs twice, **then** the drafts are deeply equal; **given** a different catalogue version, **then** `catalogVersion` differs and nothing else is assumed.
- **Given** `sessionDays: ['sun', 'wed']` and a start on a Sunday, **then** every item date is a Sunday or Wednesday inside `[start, start + 7 * weeks)`, no two items share a date, and days off contribute no item.
- **Given** a level of `stage1` band 3, **then** `quest:stage1-letters-q1` to `quest:stage1-nature-q1` are not in the plan and the first lesson is `quest:stage1-nature-q2`.
- **Given** a stage not in `unlockedStages`, **then** its lessons are in `locked`, not in `items`, and the warning `premium-needed` carries the count.
- **Given** the plan window contains 7 February 2027 and `culturalAnchors`, **then** `story:seollal-new-year` is scheduled in the week that contains it and nowhere else.
- **Given** a 12-week plan at 3 a week, **when** a device derives it on day 1, **then** only items dated within 7 days become assignments, `total` counts those, and Home shows at most the earliest due item.
- **Given** an author re-paces a published plan, **when** a device syncs, **then** pending assignments take the new dates, removed pending ones disappear, completed ones stay.
- **Given** an old app (no `?cap=curriculum`), **then** its inbox contains no curriculum plan and its classic plans are unchanged.
- **Given** the same learner in a class and a family space with a self-route, **then** the class roster summary has no `selfRoute` and the family roster summary has it.
- **Given** a self-route with four pending past-dated items, **when** the app opens, **then** it re-paces once that day, quietly, and no screen contains a banned word.
- **Given** `stage1` band 0 on the frozen fixture at Steady, **then** `12-week` is recommended; **given** band 3, **then** `4-week`; **given** band 0 on today's 8-lesson bundle at Steady, **then** `4-week` with preview `lessons-then-free-practice`. (FP-B8)
- **Given** a lesson count that makes `lastLessonWeek` 17 or more, **then** `6-month` is recommended without a code change.
- **Given** a retake whose effective level is lower, **then** `kind: 'unchanged'`.
- **Given** any sequence of placement results **without** an override, **then** `level` never decreases and `placedOutQuestIds` only grows; **with** an override, put-back quests reappear in the future queue (property test generates overrides).
- **Given** the console wizard and the app for the same level, pace and tier, **then** `defaultId` and `options` are identical.
- **Given** a 4-week card whose `lastLessonWeek` is greater than 4, **then** its preview is `lessons-cut-short`, never a finish claim.

## 4. Out of scope

- A `review` or `replay` plan item kind (a review week holds no items until F-RVW-001 ships; D11 "later"), a `vocab-topic` item kind (topics are extras until F-VOC registers playable quests).
- Saved or shared templates and a `curriculum_templates` table (a later feature, roadmap section 6 step 5): the three presets and the wizard defaults are the templates for now.
- Per-learner overrides in a class plan, push notifications, a worksheet PDF (F-TCH-003), the Journey 'Your Route' ribbon (owned by F-ROUTE-001: the My route page and its Home strip), holiday tables beyond Hangeul Day, Seollal and Chuseok (Dano and others need a verified lunar table).
- Making class completion visible to the console beyond `planProgress` counts; mixing a class plan and a self-route into one list.
- Changing `PLAN_MAX_ITEMS` for classic plans, the builder's weekly flow, or the 3-card Home budget.
- Fixing the Home 'Stage 1 progress' bar (F-ROUTE-001 R-4b).

## 5. Tests

| File | Level | Coverage |
|---|---|---|
| `content-schema/src/__tests__/curriculum-dates.test.ts` | unit | `addDays`, `dateKey`, `weekdayOf`, `spreadDates` (moved from `apps/web/src/lib/console/plans.ts:5-50` with its existing cases), `oneExplicitPerDay` |
| `…/curriculum-params.test.ts` | unit | schema bounds (weeks 1 and 52, sessions 1 and 7), `sessionDays` wins, daysOff validation, presets and audience defaults |
| `…/catalog-schema.test.ts` | unit | 35 cells exactly, one per (stage, theme), questIds exist, stories 24 / 112 minutes, topics 12 with four free, festival dates for 2026 to 2030, `routeCatalogOf` |
| `…/curriculum-generate.test.ts` | unit, 100 % | each algorithm step: calendar and days off, done set from level, Stage 1 canonical order, theme order by motivation and themes, locked lessons, coming-soon cap of 5 and its position, story fit and stretch, anchor reservation and release, week-kind priority and cadences, culture-week story count by sessions, extras rules, Hangul Check week, open sessions, stats, every warning code, 260-item cap, `toPlanItems` ordering |
| `…/curriculum-properties.test.ts` | property | over the grid weeks {1, 4, 12, 26, 52} x sessions {1, 2, 3, 5, 7} x four levels x four focuses x {free, all stages unlocked} (about 770 combinations, a throwaway prototype passed all): no two items on one date, every date inside the plan window, ids unique, at most 260 items, Stage 1 lessons in canonical order, locked stages never scheduled, review weeks empty, break weeks without sessions |
| `…/curriculum-regenerate.test.ts` | unit | `shift` and `requeue`, history frozen, counters rebuilt from weeks, days off before today ignored, week renumbering, idempotence (`regenerateFrom` of a fresh plan on its start day equals the plan) |
| `…/curriculum-golden.test.ts` | golden | examples A and B of section 3.4 against `fixtures/catalog-2026-10.ts` (item by item, stats, warnings) |
| `…/curriculum-copy.test.ts` | unit | every label and warning message for `weekLabel` / `warningText` in en, es, ko passes both banned lists and the F-PAR-001 phrases |
| `…/plan.test.ts` (extend) | unit | `week`, `meta` nullable default null, 31 to 260 items only with `meta`, inbox plan with `meta`, old payloads parse |
| `…/sync.test.ts` (extend) | unit | `selfRoute` default null, summary `selfRoute` optional |
| `…/telemetry.test.ts` (extend) | unit | the five new names (`route.created`, `route.repaced`; FP-B7 `route.proposed`, `route.proposal_skipped`, `route.updated`) |
| `backend/src/__tests__/plans.test.ts` (extend) | integration | meta round trip, 31 to 260 items accepted only with meta, inbox carries meta only with `?cap=curriculum`, classic plans unchanged without it |
| `backend/src/__tests__/spaces.test.ts` (extend) | integration | roster redaction: family returns `selfRoute`, class and school do not |
| `backend/src/db/__tests__/db-contract.test.ts` (extend) | contract | plans meta for memory and D1 adapters |
| `apps/api/src/__tests__` (migration) | integration | `0006_plan_meta.sql` (or the next free number, E-1) applies on the database at the previous migration; existing rows read with `meta` null |
| `mobile/src/logic/homework/__tests__/plan-derivation.test.ts` (extend) | unit | horizon window, `total` grows with time, redate pending, drop removed pending, keep completed, self source ids and `system`, class / family mapping |
| `…/assignment-merger.test.ts`, `assignment-groups.test.ts` (extend) | unit | carry-over `<= today`, precedence order, Today cap of three, upcoming window, route label |
| `mobile/src/logic/route/__tests__/*.test.ts` | unit, 100 % | `setup-flow` (steps, defaults from placement, validation), `home-card` (dots, visibility), `auto-repace` triggers (3 pending or 7 days, once a day, not during a quest), `summary` (`selfRouteProgressOf`) |
| `mobile/src/store/__tests__/route-store.test.ts`, `plan-store.test.ts` (extend), `progress-store.test.ts` (extend) | integration | create, archive, derive with a route, merge newest `updatedAt`, `isSubsetOf` |
| `mobile/src/content/__tests__/catalog-parity.test.ts` | integration | section 3.2 parity with the bundle |
| `web/src/lib/console/__tests__/curriculum.test.ts` | unit | wizard state to params, `levelHint`, `levelFromSummary`, preview rows, `readoutLine` with planned, plan switcher order |
| `content-schema/src/__tests__/curriculum-propose.test.ts` | unit, 100 % | `defaultId` at the boundaries (LLW 4, 5, 16, 17); `AMENDMENTS-PLC-PLAN-HANDOFF.md` 1.2 column A against `fixtures/catalog-2026-10.ts` and column B against `fixtures/catalog-2026-10-bundle8.ts`; `routeCatalogOf(CATALOG)` checked against the section 1.1 rule (not pinned); three real drafts; preview codes incl. `lessons-cut-short`; `existing` -> `update` / `unchanged`; override shrinks and `itemsAdded`; `null` when nothing is ready; determinism; a micro-benchmark gate on `proposeRoute` time (a new plan: four generator runs; an existing plan: six) (FP-B10) |
| `mobile/src/logic/route/__tests__/proposal-flow.test.ts` | unit, 100 % | entry points; visibility by learner type (not device gate); dismissal for 14 days or until the next result; accept-unchanged vs changed telemetry |
| `web/src/lib/console/__tests__/curriculum.test.ts` (extend, PR P2-6b) | unit | the wizard preselects `proposeRoute`'s pace and length; same input as the app gives the same `defaultId` |
| `…/curriculum-copy.test.ts` (extend) | unit | proposal headline and preview strings in en / es / ko pass both banned lists, never Premium on a learner surface, no speaking words |
| `web/src/data/__tests__/catalog.test.ts` | unit | `catalogLabel`, `questsOf` over the shared catalogue |
| `mobile/e2e/web/route.spec.ts` (CI, shard 2 with `E2E_ROUTE=1`), `mobile/e2e/web/homework-window.spec.ts` (CI; console-published plans as the device keeps them), `web/e2e/curriculum.spec.ts` (manual run on the console e2e export with `CURRICULUM_E2E=1`; a scheduled CI run is a follow-up) | e2e | console: wizard -> preview -> draft -> publish -> a learner device shows this week only; app: setup -> Home card (2) follows the route -> manual re-pace |

Coverage: `packages/content-schema` 100 % (including `curriculum/` and `catalog/`), `apps/mobile/src/logic` >= 90 % with `logic/homework/plan-derivation.ts` and `logic/route/` at 100 %, `apps/web` verification logic >= 90 %, `packages/backend` >= 90 %.

## 6. Rollout and PR breakdown

`flags.routeEnabled` (mobile, default on since P2-8b) shows the self-route entries; the entries read `routeEnabledFor(locale)` (`config/flags.ts`), which holds them back in a UI locale outside `ROUTE_REVIEWED_LOCALES` (`['en', 'es', 'ko']` since the es and ko `learner` re-review was signed by the multi-agent review on 2026-10-13, F-I18N-001 MAR re-review PR #618; the QA build with every locale shown plays them all). Release builds offer only `en` today (`LOCALE_STATUS` hides es and ko), so the locale gate is a guard for the day a locale ships: a locale joins `LOCALE_STATUS` 'shipped' and `ROUTE_REVIEWED_LOCALES` in the same PR (`flags.test.ts` fails otherwise), because the re-pace, Homework and Today's mission follow an existing plan in any locale and the plan must keep its Change and Stop entries. Native builds (Xcode) pick the plan up on their next binary; rollback there is a new binary built with `EXPO_PUBLIC_ROUTE_ENABLED=false` (on the web, the same env on the Pages build), and a native 200% Dynamic Type spot-check of the proposal, set-up, preview and overview is due before the next iOS submit; the console wizard ships when P2-6 merges (it only writes ordinary plans). Beta check: a class term and two family routes from real use; measure how many devices re-pace, and whether any learner screen ever lists more than seven days of items.

| PR | Content | Size | Needs |
|---|---|---|---|
| P2-1 | `refactor`: move `addDays`, `dateKey`, `spreadDates`, `oneExplicitPerDay` from `apps/web/src/lib/console/plans.ts:5-50` into `packages/content-schema/src/curriculum/dates.ts`; web re-exports (own PR, CLAUDE.md section 10) | S | — |
| P2-0 | `docs`: `AMENDMENTS-PLC-PLAN-HANDOFF.md` applied (FP-B1 to FP-B15, errata E-1 to E-5); the same PR is F-ROUTE-001 R-0 and F-PLC-001 P-0b | S | — |
| P2-2 | `feat(content-schema)`: `catalog/` (schema, data, `routeCatalogOf`), mobile parity test, frozen fixture | M | merged (#175) with the 8 shipped quests and a parity test (`catalog/data.ts:9-12`); Q-6a and Q-6b grow `catalog/data.ts` through that test. The F-QUEST-002 dependency for `teaches` is Q-6a (quests 1-3), not Q-6b (E-5) |
| P2-3a | `feat(content-schema)`: generator, presets incl. `PACES`, `toPlanItems`, the existing goldens (FP-B11) | L | P2-1, P2-2, F-PLC-001 P-3 (`questsPlacedOutAtLevel`; the PR adds the same function if absent) |
| P2-3b | `feat(content-schema)`: `propose.ts`, `regenerateFrom` `reseed`, the 1.2 goldens, the benchmark gate (FP-B11) | M | P2-3a (OD-12 and OD-13 decided by the owner 2026-10-12: accepted as proposed) |
| P2-4 | `feat(content-schema,backend,api)`: `PlanItem.week`, `meta`, cap, snapshot / summary `selfRoute`, the Worker preserve rule for `selfRoute` (shared helper with F-VOC-005 P-1 / F-PLC-001 P-2), telemetry names (+ rows in `docs/roadmap/TELEMETRY-NAMES-2.md`), migration `0006` (E-1: or the next free number when opened), inbox `?cap=`, roster redaction; `docs`: the F-PLAN-001 amendments of this spec's header (sections 3.1, 3.2, 3.3, 3.5). **Deploy (migration, then Worker) before any app or console build** | M | P2-3a |
| P2-5 | `feat(mobile)`: `withSnapshotDefaults`, derivation (horizon, reconcile, precedence, sources), display fixes (merger, Home count, Homework list), `cap=curriculum` in `getInbox` | M | P2-4 |
| P2-6 | `feat(web)`: shared catalogue adapter (retires `stage1-catalog.ts`), wizard page (no length pre-selected; the rhythm starts from the audience table of section 3.1), builder week grouping, readout, plan switcher, re-pace (`shift`), entries | L | P2-4 |
| P2-6b | `feat(web)`: the wizard pre-selects pace and length with a *Suggested* tag and a per-length preview line, pace chips, themes / focus / motivation prefilled from `proposeRoute` (section 3.8 steps 1, 2 and 4); family learner card 'Update the plan' (`reseed`); the `curriculum.test.ts (extend)` row of section 5 (FP-B11). Split from P2-6 because it needs `proposeRoute` and the owner decisions (OD-12, OD-13 decided 2026-10-12) | S-M | P2-6, P2-3b |
| P2-7a | `feat(mobile)`: `route-store`, `RouteProposalScreen`, Home prompt with eligibility and dismissal, Profile row, flag (FP-B11). **Lands before F-PLC-001 P-7b**, so the one-tap default plan exists for learners without a level check first | M-L | P2-5, P2-3b |
| P2-7b | `feat(mobile)`: setup steps, preview, overview, auto re-pace, Hoya check-in (FP-B11) | M | P2-7a |
| P2-8 | `test(e2e)` + wireframes promoted + flag flip for beta. Before the flip: a CI job that builds with `EXPO_PUBLIC_ROUTE_ENABLED=true` and runs `route-plan` and `route-proposal` with `E2E_ROUTE=1` (a `.github/workflows` change), a 320 px pass with no horizontal overflow on set-up, preview and overview in es and ko, and the child check-in owner item of section 3.7 (OD-17) settled. **Split (2026-10-13):** P2-8a holds the e2e (`mobile/e2e/web/route.spec.ts`: set-up -> Home card (2) -> manual re-pace, Change, Stop, the seven-day window, the 320 px pass in es and ko; `web/e2e/curriculum.spec.ts`), the CI job (`build:web:route`, `dist-e2e-route/`, shard 2 of web-app.yml) and the promoted wireframes; P2-8b is the flip (`routeEnabled` launch default `true`) once the child check-in item (OD-17) is settled, en only until the es and ko `learner` namespaces carry a signed re-review. **OD-17 decided by the owner 2026-10-13 (recorded): a child does not answer the check-in alone (section 3.7); the flip no longer waits on it.** The es and ko review was stale, so the flip shipped `en` only (`routeEnabledFor`, `ROUTE_REVIEWED_LOCALES = ['en']`). **2026-10-13:** the es and ko `learner` namespaces were re-signed by the multi-agent review (F-I18N-001 MAR re-review, #618), which sets `ROUTE_REVIEWED_LOCALES = ['en', 'es', 'ko']`; this only matters once rows 15b / 16b make es or ko public (`LOCALE_STATUS` unchanged) | S | P2-6, P2-6b, P2-7a, P2-7b |

## 7. Dependencies

- **Upstream:** F-PLAN-001 (plans, inbox, derivation), F-PLC-001 PR P-2 / P-3 (`PlacementLevelSchema`, `RouteCatalog`, `questsPlacedOutAtLevel`), F-QUEST-002 (`teaches`, 15 quests), F-STORY-001 / F-STORY-005 (story ids, recommended stage, anchors), F-VOC (topic ids), F-I18N-001 (messages, `localize`), F-LEARN-001 (`levelOrder`), F-SPACE-001 / F-ENT-001 (spaces, entitlement), F-CONSOLE-001 (static export).
- **Downstream:** F-RVW-001 (a `review` item kind), F-TCH-004 (lecture mode may read the week's items), F-STORY-006 (nothing), the Journey route ribbon (a later spec).
- **External:** Spanish and Korean review of the planner strings; verification of the Seollal and Chuseok solar dates for 2026 to 2030 by an authoritative source (section 9).

## 8. Decisions

Binding owner decisions applied (not re-opened): **D1** audience any age (`level` is Korean level; the reading level only sets pace defaults). **D2/D8** copy through the locale layer, this id. **D3** positive tone: no behind / late / overdue; the home dots only fill. **D4** the catalogue is data, validated by a parity test against the shipped content. **D5** nothing new is gated: stories and topics are always schedulable; Stage 2+ lessons follow the existing stage gate and are listed under *locked*, never presented as a purchase prompt for learners. **D9** the 7 x 5 grid is authoritative; Stage 1 order stays canonical. **D11** shared module in `packages/content-schema` (no new package), presets 4 weeks / 12 weeks / 6 months (+ custom), `includeComingSoon` on with an honest note, self-route visible to the family space and not the class, review weeks through a new item kind later. **D12/D10** the placement level is the planner's default level; class runs and lecture mode never write learner progress (untouched here).

| # | Decision | Why |
|---|---|---|
| Q1 | The generator emits **codes and ids**, never English sentences | One draft for every UI language; no Korean in UI strings (CLAUDE.md section 8) |
| Q2 | One item per session; minutes only feed estimates | F-HW-001 section 3.4 cap of one explicit assignment a day |
| Q3 | Days off remove sessions (no rescheduling) | Predictable; the queue simply continues |
| Q4 | Coming-soon items capped at 5, after all ready content | Honest and bounded: a plan is never mostly placeholders; older apps count them as not ready |
| Q5 | Stories fill empty slots (fit first, then any stage) before placeholders | Stories are free and never gated (D5, F-STORY-005 rule 1); they are real content |
| Q6 | Vocabulary topics and the Hangul Check are **extras**, not items | No topic quest exists yet; keeps `done / total` honest |
| Q7 | Review weeks hold no items | The review kind comes later (D11); until then they are catch-up and replay weeks |
| Q8 | A one-week **horizon** on devices, with an inbox capability gate | Prevents a long plan from flooding a list and protects old apps |
| Q9 | Console re-pace is `shift` only; the device re-paces with `requeue` | The console cannot know completion (aggregates only) |
| Q10 | Precedence class > family > self; self-route coexists | No silent suppression; the 3-card budget decides what is shown |
| Q11 | Visibility of the self-route by read-time redaction | One summary per learner is shared across spaces; the field is removed for non-family spaces |
| Q12 | The catalogue is hand-kept data guarded by a parity test | The mobile content is TypeScript (F-QUEST-002 section 8), so generation would need a TS loader; parity gives the same guarantee |
| Q13 | `PlacementLevel` is the planner's `level` | One notion of "where we start", already on the 7-stage grid |
| Q14 | Anchors limited to Hangeul Day, Seollal and Chuseok | Fixed solar day or a short table; others need a verified lunar table |
| Q15 | 2026-10-13: es and ko join `ROUTE_REVIEWED_LOCALES` (#618) | The es and ko `learner` namespaces carry a signed multi-agent review (owner decision 2026-10-12, F-I18N-001 section 3.10); `LOCALE_STATUS` still hides both until rows 15b / 16b |

## 9. Unverified assumptions

1. **Festival dates (corrected in review, 2026-10-10).** `FESTIVAL_DATES` is: Seollal 2026-02-17, **2027-02-07**, **2028-01-27**, 2029-02-13, 2030-02-03; Chuseok 2026-09-25, 2027-09-15, 2028-10-03, 2029-09-22, 2030-09-12; Hangeul Day 9 October. The draft had 2027-02-06 and 2028-01-26, which are the *Chinese* dates: the new moon falls just after midnight in Korea (UTC+9) but before it in China (2027-02-06 15:56 UTC; 2028-01-26 15:12 UTC), so Korea's first day of the lunar year is the next day. Method: new-moon times computed astronomically (`ephem`) and converted to KST, the same results from the `korean-lunar-calendar` package (KARI/KASI table), the Korean official 2027 calendar (Seollal Sunday 7 February; Korea Aerospace Administration calendar guidelines) and publicholidays.co.kr / timeanddate for 2026 and the Chuseok days. 2028 to 2030 are computed, not yet in an official KASI announcement: PR P2-2 re-checks them against KASI's published table, the test pins the values, and the planner treats a festival date as a one-day anchor only (an error of one day moves nothing across a week unless the festival is on a week boundary). Example B uses 2027-02-07.
2. **The catalogue snapshot** of section 3.4 assumes F-QUEST-002's 15 quests and that all 24 stories have passed review (`ready`); the examples change if reviews are late (the golden fixture is frozen, the product is not).
3. The cadence constants (`cultureEvery` 3, `vocabEvery` 4, `reviewEvery` 4, five coming-soon items, two stories per culture week) are product judgment, not user-tested; they are constants in `presets.ts`, each with one test, so they can change without touching the algorithm.
4. **Premium wording.** Stage 2+ lessons are gated today and can be unlocked by a licence; the planner calls them *locked*, and the console wording must not read as a purchase pitch to a class teacher on a free licence. Confirm with the owner while Stripe Live is on hold. The generator never schedules a locked lesson, shows no price, and the app (learner) never shows the word Premium for a route; whether a placed-out free learner should keep today's open Stage 2 taste quests (the Journey does not block opening them) is the owner's call (see F-PLC-001 assumption 10).
5. `levelFromSummary` is a hint from `stage1.questsDone / questsTotal` and `summary.placement`; the summary has no richer cursor (adding one was avoided on purpose).
6. Pure TypeScript date arithmetic with UTC date keys matches the existing helpers (`plans.ts:5-14`, `HomeworkScreen.tsx:35`, `mission-builder.ts:66`); daylight saving cannot shift a date key. A learner whose device day differs from UTC around midnight can see a one-day offset, as everywhere else in the app.
7. The old `Plan` rows have no `meta_json`; `ALTER TABLE ... ADD COLUMN` on D1 is assumed to need no backfill (NULL).
8. Home dots for the week assume the existing `Progress`/fill components can render dots without a numeric label; if not, a small design-system addition is needed (flagged for the design step).
9. The entitlement lookup assumes `EntitlementView` identifies its subject space (the billing page already labels cards per space, `lib/console/billing.ts:11-20`); the exact field names were not read here.
10. The inbox `?cap=curriculum` approach assumes every shipped app version that can parse `meta` also sends the parameter; an app that parses `meta` without the horizon logic must not ship.
11. **Default length rule and pace chips** — owner decisions OD-12 and OD-13 (F-ROUTE-001 section 9), **decided 2026-10-12: accepted as proposed** (thresholds 4 and 16 weeks; Gentle 2 / Steady 3 / Brisk 4, default Gentle for "Pictures first" and for classes, Steady otherwise; Hoya check-in after week 4); the 1.2 table is hand-estimated and pinned by the P2-3b goldens. (FP-B12)
12. **One-tap plan for a self profile on any device** — OD-14, decided 2026-10-14 (confirmed as proposed).

---

## Appendix A — catalogue data (initial `data.ts`)

**Cells (35).** Stage 1 (all `shipped`): `episode:stage1-letters` Meet the Letters (15 min, quests letters-q1..q3), `stage1-life` Around the Korean Table (12; life-q1..q3), `stage1-rites` New Year & Festivals (14; rites-q1..q3), `stage1-nature` Tigers, Mountains, Moon (12; nature-q1..q3), `stage1-crafts` Yut, Kites & Paper (12; crafts-q1..q3). Shipped elsewhere: `stage2-life` Lunch Box Words (6), `stage2-nature` Outdoor Words (6), `stage4-rites` Greeting Dialogues (5). `preview` (27): stage2 letters Word Builder, rites Holiday Words, crafts Playground Words; stage3 all five (First Sentences, Daily Mini-Sentences, Festival Sentences, Animal Sentences, Game Sentences); stage4 letters Reading Aloud, life Kitchen Talk, nature Park Conversations, crafts Playdate Talk; stage5 (Short Stories, Family Stories, Festival Tales, Nature Tales, Craft Stories; owner decision 2026-10-14, the title was Tiger Folktales; the code took the rename in F-STORY-005 row 5.6c); stage6 (Read the Menu, Order Food, Travel for Chuseok, Hike & Ask, Buy at Market); stage7 (Write Your Name, My Day in Korean, My Holiday Memory, My Favorite Animal, Make & Share). Titles from `apps/mobile/src/content/episodes.ts:143-186` and the shipped episodes (`:10-125`).

**Stage 1 quests (15, minutes, `teaches`)** exactly as F-QUEST-002 section 3.6: letters-q1 5 min ㅏ ㅓ ㄱ ㄴ; letters-q2 5 ㅗ ㅜ ㅁ ㅇ; letters-q3 5 ㅡ ㅣ ㄷ ㄹ; life-q1 4 ㅈ ㅊ; life-q2 4 ㅂ ㅅ; life-q3 4 ㅋ ㅌ; rites-q1 4 ㄴ/final ㄹ/final; rites-q2 5 ㅍ ㅑ ㅕ ㅇ/final; rites-q3 5 ㅎ ㅛ ㅠ ㄱ/final; nature-q1 4 ㅁ/final ㅂ/final; nature-q2, nature-q3, crafts-q1, crafts-q2, crafts-q3: 4 min each, no new symbol. Others: `quest:stage2-life-q1` 5, `quest:stage2-nature-q1` 5, `quest:stage4-rites-q1` 4 (`quests.ts:134-182`).

**Stories (24, 112 minutes).** The placement table of F-STORY-005 section 3.3: slug, title, recommended stage, theme, minutes; anchors `hangeul-day` -> `hangeul-day`, `seollal-new-year` -> `seollal`, `chuseok-ganggangsullae` -> `chuseok`; sampler flags for the six free-sampler stories (1, 3, 7, 8, 9, 10).

**Topics (12).** `topic:food`, `animals`, `colors`, `numbers` (free), `family`, `school`, `body`, `nature`, `travel`, `sports`, `k-culture`, `science`; 5 minutes each; `questId: null`.

**Festival solar dates** per section 9, assumption 1.
