Status: ready

# F-ROUTE-001 — Learning Route (code name "My route"): the whole journey at a glance (where you started, where you are, where you are going, what your quests practiced, what comes next)

> **Status note.** `ready` means: the independent review (`docs/roadmap/spec-review-route-001.md`) is applied and no review blocker remains. Owner decisions do **not** gate the whole spec; each one gates only the PRs named in the section 9 table, and each has a stated default. Basis: `origin/main` `27c771c` (P-3 #168, layout PR 2a #174, layout PR 4 #170, i18n PR 7a #171, P2-2 #175 merged; i18n PR 8a #172 open). Every `file:line` below is at that commit.
>
> **Owner decision 2026-10-10 (binding):** this feature tracks **reading, listening and writing** only. Speaking is not shown anywhere in its UI: no speak meter, no badge, no explanatory line, no "not measured" text. The plan for speaking is recorded in section 10 (**Later: speaking**) and in `docs/roadmap/speaking-later.md`; it is out of scope for UI now.

> **Amended 2026-10-11 (owner request item 11: "a whole learning map page showing where I must get to and where I am now; name it LEARNING ROUTE").** `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` is applied here; each change is marked [LR-An]. In short: the page is named **Learning Route** in every UI string (code names, message key paths and `route_map.*` telemetry names stay); it is a **Route** tab for learners (supersedes OD-2); the top of the page is a **route card** with Now, Goal (from the class, school, family or own weekly plan, else Hoya's suggestion), a fill-only row of the goal stage's pips and the one next step, which is F-ENT-003's `routeNext` (the same next quest Home and Results show); parents and teachers see the goal in the per-learner report (F-REPORT-001) and open a **read-only stage list** from it or from the family home in the adult shell (F-APP-001). Its PRs are LR-0 to LR-10 (that file, section 13) and its owner decisions LR-OD-1 to LR-OD-12 (section 14).

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a design mock and a wireframe)**

| Can start when | PR | Waits for what | Why |
|---|---|---|---|
| now (this review applied) | R-0 docs | — | promotes the spec, wireframes, amendments, telemetry rows, roadmap file |
| after R-0 | R-1a logic, R-1b copy + seen + latch writer, R-2a icons, R-W1 additive field + telemetry names | R-0 merged | new files only; R-2a lands before F-PLC-001 P-6 (it needs `pin`, `check-circle`) |
| after the design pass | R-2b `PipRow` | design mock of the pip shapes and the border token (`design/components/`) | CLAUDE.md section 5 "no component without a mock" |
| after R-1a, R-1b, R-2b, R-W1 deployed | R-3 screen + Journey header entry | OD-2 changes only the entries | the screen needs the model, the pips and the telemetry names on the Worker |
| after OD-4 (default applied: every shipped stage playable) | R-4a cursor logic | owner answer on free-tier stages; the documented default applies until the owner answers | Home already offered free learners the Stage 2 / 4 tastes; under the default R-4a also lets the Results "Next up" teaser offer them (before R-4a it stopped at Stage 1 for a free learner, F-QUEST-002 §3.5) |
| after OD-3, R-3, F-STORY-004 4.4a, F-LAYOUT-001 5c | R-4b Home strip | Home rewrites by two other specs | one Home edit, after theirs |
| after F-PLC-001 P-5 and F-QUEST-002 Q-6a | R-7a start marker | `recordPlacement`; a non-empty `teaches` in `catalog/data.ts` | before Q-6a no Stage 1 quest can be placed out (section 3.6) |
| after F-PLAN-002 P2-7a | R-7b weekly-plan line | `selfRoute` types and store | |
| after F-QUEST-002 Q-6a (partial), Q-8 (complete) | R-7c letter wall | discover steps | |
| after the shared Worker deploy D2 | R-8 summary, then R-9a console strip | `summary.journey` on the Worker | zod strips unknown keys (`schemas/sync.ts:16-48`) |
| after i18n PR 8a (#172) | R-9b parent row | dashboard strings in the dictionary | avoids a conflict |
| after OD-8 | R-J Journey pill wording | owner answer | |
| last | R-10a e2e and es / ko values, then R-10b flag flip | LR-11, device 200 % checks, es / ko string review (else flip for `en` only) | |
| after LR-0 | LR-D, LR-W1, LR-3a, then LR-2; LR-1 (after R-3); LR-3b (after R-3 and F-ENT-003 E3-4); LR-4, LR-5a to LR-5c, LR-6; LR-7, LR-8 and LR-9 (after R-9a) | see `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 13 | Learning Route: tab, goal, adult summary page [LR-A8] |

**Scope**: `apps/mobile` (new `logic/my-route/`, new `screens/my-route/`; the **Route tab** and the route card over F-ENT-003's `routeNext` [LR-A1, LR-A3]; entries: Journey header (R-3), Home strip (R-4b), placement result link (F-PLC-001 P-7b), parent dashboard row (R-9b); `logic/next-quest.ts` gains `skipQuestIds`; `store/sync-store.ts` computes `summary.journey`; `store/progress-store.ts` latch writer; flag) · `packages/design-system` (icons `pin`, `check-circle`, `book`, `ear`, `pencil`; `PipRow`; one border token through `design/tokens/` and `design-token-sync`) · `packages/content-schema` (`schemas/progress.ts`: optional `stageDoneAt`; `schemas/sync.ts`: tolerant optional `journey`; telemetry names) · `packages/backend` (`ADDITIVE_FIELDS` entry for `stageDoneAt`; round-trip tests) · `apps/web` (`lib/console/journey-strip.ts`, a strip on the roster card in `app/teach/space/page.tsx` for class and family spaces only) · `packages/i18n` (`learner.myRoute`, `caregiver.journey`, `console.journey`, `a11y.myRoute`; `console.learningRoute`, `a11y.tabs.route` [LR-A2]) · `packages/content-schema` `route/goal.ts` (`pickGoal`, `planGoalStage`) and the family-only `ProgressSummary.routeGoal` [LR-A4, LR-A6] · `apps/web` goal line in the per-learner report and the stage list page with the grown-up route card at `/parent/space/route` (family) and `/teach/space/route` (class) [LR-A6]
**Owner**: solo dev
**Rollout**: `flags.myRouteEnabled` (mobile), default on since R-10b flipped it for the beta (`en` only: es and ko are hidden locales, AMENDMENTS-ROUTE-LEARNING-ROUTE section 16, R-10b entry); `EXPO_PUBLIC_MY_ROUTE_ENABLED=false` switches it off in a build. The latch writer (R-1b) runs with the flag off. Milestones and PR order in section 6.
**Wireframes**: [LR-A1] `design/wireframes/journey/learning-route.md` (Route tab, route card, goal, not-open pips), `design/wireframes/parent/learning-route.md` (local read-only, the report's goal line and the signed-in stage list), `design/wireframes/console/learning-route.md` (teacher report goal line and stage list, class plan goal line); earlier: `wireframes/my-route-overview.md` (drafted with this spec) -> promoted in R-0 as one file, `design/wireframes/journey/my-route-overview.md` (screens A to L, the way the other spec PRs promoted theirs); split per screen when the screens are built: `journey/my-route.md` (A to G: phone, regular, wide, landscape), `parent/dashboard.md` (H, compact row), `console/roster.md` (I, strip), `placement/result.md` (J) and `route/proposal.md` (K) (J and K are owned by `AMENDMENTS-PLC-PLAN-HANDOFF.md`)

Parent / siblings: CLAUDE.md section 1 (grid, Route, anti-shame, any age, UI languages) · F-QUEST-002 (3.8 stage completion and the Stage 1 prize, 3.9 Hangul Check, Q-6a / Q-6b / Q-8 content) · F-STORY-004 / F-STORY-005 (grid vs shelf; map rules: no unfinished counts, no N of M; 5.5a `journey-cells.ts`) · F-STORY-006 (stage cards; no fractions) · F-PLC-001 (start marker, placed-out, `effectiveRoute`) · F-PLAN-002 (the dated **weekly plan**; `screens/route/` is **its** directory) · F-LAYOUT-001 (width classes; `SplitPane` is PR 5a) · F-I18N-001 (messages) · F-PAR-001 (caregiver anti-shame list) · F-TCH-001 (aggregates only) · F-LEARN-001 (`effectiveLearnerType`, `gateRequired`) · F-VOC-005 / F-RVW-001 (later rows)

---

## 1. Context

The owner asked for a page where a learner sees, at one glance, **where they are in the whole learning journey**. On 2026-10-11 the owner named it **LEARNING ROUTE** and added **where I must get to** (the destination) and read-only views for parents and teachers (`AMENDMENTS-ROUTE-LEARNING-ROUTE.md`). The product goal behind it: someone of any level starts at any time and is taken, at a pace that suits them, to a defined level of reading, listening and writing Hangul. This spec is the "where am I" half. The "what should my plan be after the level check" half is in `AMENDMENTS-PLC-PLAN-HANDOFF.md` (edits to F-PLC-001 and F-PLAN-002).

Facts, verified on `origin/main` `27c771c`:

**What the learner can see today.**

- **Journey grid.** Seven stage rows x five theme cells (`apps/mobile/src/screens/journey/JourneyScreen.tsx:66-125`). A cell is binary: complete only when every quest of its episode is done (`JourneyScreen.tsx:157`, `logic/journey.ts:27-36`), drawn as a tint (`JourneyScreen.tsx:170-172`); 0 of 3 and 2 of 3 look the same. The cell's accessibility label has no completion state (`packages/i18n/src/messages/en/a11y.ts:21-22`). The stage pill shows content availability Open / Taste / Soon (`logic/journey.ts:10-17`, words at `packages/i18n/src/messages/en/learner.ts:139`) or "Premium" for a stage the tier does not include (`JourneyScreen.tsx:104`, word at `learner.ts:137`); R-J (OD-8) replaces these with Open / A taste / Coming later and no Premium. **There is no "you are here" marker.**
- **The cursor exists but is shown only as one card.** `nextQuestAfter` (`logic/next-quest.ts:44-48`) is the first offerable quest not done, in `questsAll` order filtered by playable episodes (`next-quest.ts:23-31`). Results passes the tier (`logic/quest-flow/results-teaser.ts:77`, `ResultsScreen.tsx:138`). Home does not, and falls back to the last offerable quest (`logic/homework/mission-builder.ts:115-122`).
- **Entitlement is enforced only in three places**: Results (`ResultsScreen.tsx:138`), the Journey stage header pill (`JourneyScreen.tsx:69`) and the plan store (`store/plan-store.ts:36`). Journey cells open `EpisodeDetail` for every shipped cell (`JourneyScreen.tsx:115`). `FREE_STAGE_KEYS` is `['stage1']` (`logic/content-access.ts:25`) and payments are not live, so almost every learner is "free" while still able to play the Stage 2 and 4 tastes from the Journey and from Home.
- **Home "progress" is mislabelled.** The bar under "Stage 1 progress" divides by `questsAll.length` (`screens/home/HomeScreen.tsx:108, 199-202`): 11 quests today (8 Stage 1 + 2 Stage 2 + 1 Stage 4; `content/quests.ts:185`), more once story quests bundle. F-PLC-001 and F-PLAN-002 both defer the fix; **this spec owns it** (R-4b).
- **Other counts.** Profile shows three counts (`ProfileScreen.tsx:149-163`); the in-app parent dashboard shows hard-coded Quests / Cards / Sessions / Minutes (`ParentDashboardScreen.tsx:70-73`; PR 8a #172 moves them to the dictionary); the console roster card shows "Quests X / Y" where Y is **Stage 1 only** (`apps/web/src/app/teach/space/page.tsx:165`, `logic/sync/summarize.ts:73-77`).
- **Completion logic exists but nothing draws it, and nothing awards the stage prize.** `completionState` / `isStageComplete` (`logic/stage1/completion.ts:22-41`) are used by no screen. The three `unlockedBy: 'stage1-complete'` cards (`content/heritage-cards.ts:35, 51, 67`) are awarded by nothing today: `logic/results-award.ts` unlocks only the quest's own reward card.

**What the data can answer.**

- `ProgressSnapshot` holds `quests[]` (best stars, `completedAt`, attempts, accuracy; `packages/content-schema/src/schemas/progress.ts:7-15`), `cards[]`, `sessions[]`, `homework[]`, `placements[]` (`progress.ts:78-99`). Episode state is derived from `quests[]`, as `isEpisodeComplete` does.
- Content: 35 grid cells, 8 shipped (Stage 1 x5, `stage2-life`, `stage2-nature`, `stage4-rites`), the rest preview placeholders (`content/episodes.ts:128` `makePreviewEpisode`); 11 playable quests; no story is bundled (`content/stories.generated.ts:4-8`, empty arrays). **`Episode` is `z.input<...>` (`schemas/episode.ts:50`), so `placement` is optional on every hand-written bundled episode** (the default `'grid'` at `episode.ts:28` applies only when parsed, and the bundle is not parsed).
- **The shared route catalogue is merged** (F-PLAN-002 P2-2): `routeCatalogOf(catalog)` (`packages/content-schema/src/catalog/route-catalog.ts:15-46`) over `CATALOG` (`catalog/data.ts:175`), guarded by `apps/mobile/src/content/__tests__/catalog-parity.test.ts`. Its `order` is stage, then theme, then the cell's quest list. **Every lesson's `teaches` is empty today** (`catalog/data.ts:81-91`).
- **Placement engine is merged** (F-PLC-001 P-3, #168). `effectiveRoute(placements, catalog, opts)` (`placement/route-seed.ts:156-191`) returns a `RouteSeed` (`route-seed.ts:28-41`) with `startQuestId` = the first playable grid quest that is **not placed out, not in `opts.completedQuestIds`, and entitled** (`route-seed.ts:105-110`); `beyondContent` and `needsStage` are separate fields. A parent override **removes** ids from the placed-out set (`route-seed.ts:169-178`). A Stage 1 quest is placed out only when its `teaches` is non-empty and covered (`placement/level-map.ts:62-74`), so on today's catalogue only a Stage 2+ level places anything out.
- **No skill is measured.** A quest run stores one pooled `stars` and `accuracy` (`progress.ts:7-15`). Each quest step names a `minigameKind` (`content/quests.ts:18-178`), so the games a finished quest contains can be listed; whether each game was played cannot: a game can be skipped (`logic/quest-flow/check-launcher.ts:35`, button at `QuestPlayerScreen.tsx:282`) and the quest still completes unless every game was skipped (`logic/results-award.ts:39-48`). Today only `quest:stage1-letters-q2` has a `trace-stroke` step (`quests.ts:34`).
- Layout: `useLayoutClass` and `layoutClassFor` are on main (`packages/design-system/src/components/Layout/LayoutProvider.tsx:26`, `src/layout.ts:131`). `SplitPane` is F-LAYOUT-001 **PR 5a** (`docs/specs/F-LAYOUT-001-responsive-tablet-landscape.md:260`, needs PR 1 and PR 4), in flight. Tabs are three (`navigation/tabs.tsx:42-44`).
- Adults: teachers read `ProgressSummary` only (`packages/backend/src/routes/spaces.ts:374-386`; row type `apps/web/src/lib/console/api.ts:25-34`, which carries **no tier**). The Worker rejects the whole snapshot PUT with 422 when the summary fails zod (`packages/backend/src/routes/sync.ts:50-51`). The preserve rule keeps additive payload fields an old client leaves out (`packages/backend/src/lib/additive-fields.ts:28-34`).

**What this spec does.** (1) A pure view-model `logic/my-route/` that turns the snapshot, the bundled content and the route catalogue into one `MyRouteModel`: seven stage rows, one **pip** per grid quest, the cursor, an optional start marker, three skill rows (read, listen, write), gains. (2) A screen `MyRoute` (phone, regular, wide as one reading column). (3) A small additive **stage latch** so "Complete" is never taken away. (4) Grown-up views (in-app dashboard; console roster strip from one tolerant additive `summary.journey`). (5) The anti-shame, accessibility and copy rules that make a progress picture safe for any age.

Terms. **Pip**: one drawn shape for one grid quest (or one not-yet-shipped cell). **Cursor**: the quest the learner would play next. **Known**: a quest the level check placed out; it is not done and never counts as done. **Rest**: no offerable quest is left. **Latched**: a stage the learner once completed (`stageDoneAt`); it stays Complete. **New pip**: a quest that joined a latched stage after it was completed.

### 1.1 Product fit (what each milestone answers, and what is still missing)

| Owner words | Answered by | Still missing (owner decision) |
|---|---|---|
| "where they are in the whole journey, at a glance" | M1: the page, Home strip, Journey entry | — |
| "starts at any level" | M2: the level-check result proposes a weekly plan; M3: start marker on the page | Stage 1 placement only works after F-QUEST-002 Q-6a fills `teaches` |
| "a default curriculum after the level test" | M2 (amendments) | OD-1 (sound guide); OD-12 (length rule) and OD-13 (pace) decided 2026-10-12 |
| "a pace that suits their level and growth" | M2: three pace chips; later a week-4 check-in | growth-based re-pacing is a later spec (gap G9) |
| "a defined level of reading, listening, writing" | v1 goal line "Finish Stage 1"; can-do line per stage | OD-9 defines the end state per skill |

## 2. User story

> As someone learning Hangul at any age, I want one calm page that shows the whole road — the seven stages, where I started, where I am now, what I have already done and what is next — so that I always know where I stand without a score and without being compared to anyone.

Companion stories:

- As a **learner who has just taken the level check**, I want my start spot marked and what I already know shown as known (not as something I earned), so that I trust the check and still enjoy every quest I play.
- As a **learner on a weekly plan**, I want to see which week I am in and what is next, without any word or dot that says I am late.
- As a **parent**, I want, behind the grown-up gate, the same picture for each child, written about the child (not to me as if I were the child), plus a plain note on what the skill rows count.
- As a **teacher or a family organizer**, I want a small strip per student showing the stage they are in and how many quests they have done and already knew in each stage, with no class average, no ranking and no sort by stage.
- As a **maintainer**, I want one cursor function and one pure module that Home, Journey, the page, the parent dashboard and the sync summary all share.

## 3. Acceptance criteria

### 3.1 Where it lives (recommendation, OD-2) and entries

**[LR-A1] Decision (supersedes the OD-2 recommendation below): a Route tab.** The learner tab bar becomes **Today · Route · Journey · Library** (LR-OD-2) while `flags.myRouteEnabled` is on; the tab label is **Route** (the tab budget is 12 characters, `packages/i18n/src/__tests__/length-budget.test.ts:10`) and its accessibility label **Learning Route**. The tab renders `MyRouteScreen` with `variant: 'tab'` (no back button). The root-stack `MyRoute` screen stays only for a grown-up from the in-app parent dashboard: its params become `{ profileId: string; viewer: 'grownup' }` (both required) and it is **always read-only**, also for the active profile (`myRouteAccess` never resolves a grown-up entry to `self`; amendment section 5.1). Entries for the active profile navigate to the tab (amendment section 5.2). The bar is already centred on wide windows (`tabs.tsx`, F-LAYOUT-001 LD6), so four items fit (80 dp each at 320 dp).

*Original recommendation (2026-10-10, superseded):* a root-stack screen `MyRoute`, not a fourth tab and not a replacement of the Journey tab. A fourth tab is a navigation change the bottom tabs cannot lay out on wide windows (`navigation/tabs.tsx:42-44`, F-LAYOUT-001 LD6); a stack screen can be opened from several places and costs no tab.

**Not the Journey.** The Journey tab is the *map you act on*, by theme (open a cell, start an episode); CLAUDE.md section 1 and D9 make the 7 x 5 grid authoritative. My route is *orientation*, by stage. My route never renders a theme grid; an expanded stage shows one-line cell rows that open the same `EpisodeDetail` the Journey opens. This spec does **not** edit Journey cells (`GridCell` belongs to F-STORY-005 5.5a, then F-PLC-001 P-7, then F-QUEST-002 Q-9, in that order; section 6.3).

Route: `MyRoute: { profileId?: string }` in `RootStackParamList` (`navigation/types.ts:7`) and the root stack next to `EpisodeDetail` (`navigation/root.tsx:51`). `profileId` absent = the active profile. A `profileId` that is not the active profile opens the page **read-only** (no hero button, no telemetry, grown-up wording, section 3.12) **only when the grown-up gate session is open**; otherwise the screen replaces itself with `PinEntry` (`navigation/types.ts:24-30`). There is no linking config today, so this is not reachable by URL now; the check exists so a later deep link cannot show a sibling's progress without the gate.

Entries (all behind `flags.myRouteEnabled`):

1. **Journey tab header button** (R-3): a secondary button **See my route** under the intro line (`JourneyScreen.tsx:52`). The first entry, because it needs no other spec and no owner answer.
2. **Home route strip** (R-4b, OD-3): replaces the "Stage 1 progress" heading and bar (`HomeScreen.tsx:199-202`) with one tappable card: "You are on Stage N: Title", the current stage's `PipRow`, a chevron, and, when a weekly plan exists, one line "Week 3 of your weekly plan" (section 3.9). If the owner keeps the bar, R-4b only fixes its label and denominator and adds the card below it.
3. **Placement result** (F-PLC-001 P-7b, amendment AM-1): the text link **See my route** replaces **See the whole map** (the page links to the Journey itself).
4. **In-app parent dashboard** (R-9b, M3): a "Journey" row per profile -> `MyRoute { profileId }` read-only.

No Profile row for My route (Profile keeps F-PLAN-002's weekly-plan row, "Make a weekly plan").

**[LR-A2] Naming (2026-10-11, owner).** The page is **Learning Route** in every learner, caregiver and console string (title case, LR-OD-1); "My route" no longer appears in any UI string (copy test). The dated schedule stays the **weekly plan**. Code names do not change. The text that follows is the original OD-7 rule with "My route" read as "Learning Route".

**Naming (OD-7, default).** In learner copy, **"My route" is the map of progress** (CLAUDE.md section 1: the learner draws their own Route on the grid). The dated schedule of F-PLAN-002 is the **"weekly plan"** in learner copy ("Hoya made a weekly plan for you", "Open plan"); grown-up and console copy may say "route plan" after introducing "weekly plan". Code names stay as they are: F-PLAN-002 owns `screens/route/` and `logic/route/`; this spec owns `screens/my-route/` and `logic/my-route/`.

### 3.2 The view-model (`apps/mobile/src/logic/my-route/`, pure, 100 % covered)

No React, no platform, no clock read except an injected `now`, no randomness. R-1a files: `model.ts` (`buildMyRoute`), `order.ts`, `stage-rows.ts`, `pips.ts`, `cursor.ts`, `skills.ts`, `gains.ts`, `summary.ts` (`summarizeJourney`), `index.ts`. R-1b: `copy.ts` (message selectors, `viewer`-aware), `seen.ts`, `latch.ts`. R-7a adds `start-marker.ts`; R-7b adds `routeWeekOf` in `route-input.ts` over LR-5a's `plan-week.ts` (section 3.9 as-built note; written against the merged types, never a structural stand-in).

```ts
export type Skill = 'read' | 'listen' | 'write';
export type PipState = 'done' | 'known' | 'open' | 'new' | 'later';
export interface Pip { key: string; kind: 'quest' | 'cell'; questId?: string; episodeId?: string; state: PipState; isCursor: boolean; isStart: boolean }
export type StageState = 'complete' | 'known' | 'explored' | 'open' | 'later';
export interface CellRow { stage: StageKey; theme: ThemeKey; episodeId: string | null; title: string; pips: Pip[]; done: number; state: 'complete' | 'partial' | 'known' | 'open' | 'later' }
export interface StageRow {
  stage: StageKey; order: 1 | 2 | 3 | 4 | 5 | 6 | 7; title: string;
  state: StageState; availability: StageAvailability; latched: boolean;
  here: boolean; isStart: boolean;
  pips: Pip[];            // earned and open pips, in route order
  newPips: Pip[];         // state 'new', drawn as their own group after a gap; empty unless latched
  cells: CellRow[]; done: number; known: number; newSinceSeen: number;
  builds: Skill[];        // static intent, Appendix A
}
export interface SkillRow { skill: Skill; marks: 0 | 1 | 2 | 3 | 4 | 5; nextReachable: boolean; quests: number }
export interface MyRouteModel {
  hero: 'start' | 'continue' | 'rest' | 'beyond';
  cursor: { questId: string; episodeId: string; stage: StageKey } | null;
  stages: StageRow[];                    // always 7
  trailReached: number;                  // 0..6
  skills: SkillRow[];                    // always 3: read, listen, write
  tiles: number;                         // finished quests with a tile-building game (grown-up view only)
  gains: { stars: number; cards: number; storiesRead: number };
  start: { stage: StageKey; questId: string | null } | null;
  latchesToWrite: StageKey[];            // stages complete now and not yet in stageDoneAt
}
export function buildMyRoute(input: MyRouteInput): MyRouteModel;
```

`MyRouteInput` = `{ snapshot, catalog: RouteCatalog, episodes, quests, cards, stages, themes, isEntitled: (stage: StageKey) => boolean, route: RouteSeed | null, seen?: SeenRecord, now: Date }`.

[LR-A4] Additive (LR-3b): `MyRouteInput` gains `sources` (from `sourcesOf`), `today`, `routeNext` and `planQuestIds` (F-ENT-003's, computed by the screen) and `isQuestOpen?: (questId) => boolean` (F-ENT-003 `useQuestAccess()`; default every playable quest); `MyRouteModel` gains `goal: RouteGoal | null`, `goalPips`, `next` (`{ questId, episodeId, stage, source }`), `nextKind` (`'quest' | 'free-end' | 'rest'`) and `inPlanEpisodeIds`; `Pip` gains `laterReason?: 'soon' | 'closed'`. No existing field changes.

- `catalog` is `routeCatalogOf(CATALOG)` (`catalog/route-catalog.ts:15`, `catalog/data.ts:175`), computed once per build of the app.
- `isEntitled` is **injected**, and R-1 / R-3 pass the rule the app enforces where the learner plays today: **every shipped stage is playable** (Journey cells and Home offer Stage 2 and 4; `JourneyScreen.tsx:115`, `mission-builder.ts:115-122`). The page therefore agrees with Journey and Home until the owner answers OD-4; R-4a then switches all three surfaces to the same predicate in one PR.
- `route` is `effectiveRoute(placements, catalog, { isEntitled, completedQuestIds: new Set() })`: computed with **no completions**, so `startQuestId` ("You started here") never moves because the learner played. It moves with a better retake or a grown-up override, and it is read against today's bundle and tier (section 3.6). `null` until R-7a.
- `snapshot.stageDoneAt` (section 3.15) may be absent (old local copies); treated as `{}`.

**One ordered list.** `order.ts` builds the grid quest list once, in `RouteQuest.order` (stage, theme, cell quest list; `route-catalog.ts:20-23`). Pips, cursor and start all read it. A unit test asserts that the cursor equals `nextQuestAfter` and the first open pip on the 8-quest bundle and the 15-quest frozen fixture.

**Grid only.** An episode is a grid episode when `(e.placement ?? 'grid') === 'grid'` (the bundle is unparsed, section 1); F-STORY-004's `gridEpisodes` replaces the predicate when it lands, with the same `?? 'grid'`. A test runs the real bundled `episodesAll` (not a parsed fixture) and expects 8 + 2 + 1 quest pips. Shelf stories are never pips and never move a stage; they appear only in `gains.storiesRead`.

**Done** = the quest has `completedAt`, at any star count. **Playable** episode = `shipped` or `ready` (`next-quest.ts:13-15`).

### 3.3 Stage state

For each stage, from `stageAvailability` (`logic/journey.ts:12-17`), `isEntitled`, the latch and the grid episodes. First matching row wins:

| `state` | Rule | Learner word | Non-colour cue |
|---|---|---|---|
| `complete` | the stage is **latched** (`stageDoneAt[stage]` exists), **or** availability `open` and every grid episode complete, **or** the learner owns a card whose `unlockedBy` is `stage<N>-complete` | **Complete** | check-in-circle badge |
| `known` | every **quest** pip of the stage is `known` or `done`, at least one is `known`, and the stage is not complete (the `later` pips of cells that are not playable are not counted) | **You knew this** | ring-with-disc badge (never the check-in-circle) |
| `explored` | availability `taste` and every **playable** (shipped or ready) grid episode complete, at least one | **Explored** | check mark on the badge |
| `later` | availability `soon` and no playable cell (no quest pip), or not entitled and no done quest in it | **Coming later** | dotted-ring badge |
| `open` | everything else | **Open** (availability `open`) or **A taste** (availability `taste`) | numbered badge |

- **`known` never awards anything.** It never writes `stageDoneAt`, never triggers a card, is never called Complete, and none of its known pips count in "N quests played". `here` and the hero move past it.
- **"Has content" means playable** (amended in R-1a review). Pips, the cursor and `explored` all count playable episodes (`status` `shipped` or `ready`, `playableEpisodes`), so a stage whose only playable cell is `ready` has quest pips, can hold the cursor and reads `open`, not `later`. `stageAvailability` (shipped only) still decides `open` / `taste` / `soon` for the pill and the derived complete rule. `explored` is computed in `stage-rows.ts` (`allPlayableDone`), not from `completionState(...).stageComplete`, which the award engine answers only for a fully shipped stage (#220).
- **A `taste` stage is never `complete`** (F-STORY-006 line 51: the stage must be fully shipped; `completionState` counts only playable episodes, `completion.ts:27-31`). Test.
- `here`: exactly one stage. The stage of the cursor; with no cursor (rest), the highest-order stage with a done pip; with nothing done, the stage of the start marker (section 3.6, the same stage the **You started here** tag sits on, also when `startQuestId` is null), else Stage 1. A stage can be `complete` and `here`. Tag: **You are here**.
- **Entitlement never shows commerce.** With the default predicate no shipped stage is `later` for entitlement reasons. If the owner chooses the other branch of OD-4, an unentitled stage reads `later` with the neutral caption **"Not open yet"** (never "coming", which would be false for shipped content), and never "Premium", a price, a lock-for-payment or a purchase button.
- **Latch (OD-6, default).** When a stage becomes `complete` by the derived rule, `latchesToWrite` names it and the store writes `stageDoneAt[stage] = now` once (R-1b `latch.ts`, called after each quest result, once on app start and when sync or restore replaces the snapshot, with the flag off too; best effort: an error leaves the snapshot unchanged and never blocks a hydrate or a save). The latch is written from the derived rule only; a learner who earned the stage card on an older build and first runs a latching build after Stage 1 grew is not latched, and stays Complete through the card (`cardComplete`), which syncs with the snapshot (accepted in R-1b review). From then on the stage stays `complete` whatever content ships. Quests that join a latched stage are `new` pips (section 3.4), and the caption adds **"New quests joined"**. **Release rule:** the latch writer must reach learners in an app build **before** any build that adds Stage 1 quests (F-QUEST-002 Q-6a..Q-8); otherwise a learner who finished 8 of 8 is never latched. This is a line in the R-10 / release checklist and in F-QUEST-002's dependency list (amendment in R-0).

### 3.4 Pips and cells (a collection of shapes, not a bar)

A stage row has **one pip per grid quest of each playable cell, in route order, and one `later` pip per cell that is not playable**. Stage 1 today: 8 pips (letters 3, life 2, rites 1, nature 1, crafts 1). Stage 2 today: 2 quest pips + 3 `later` pips.

**Pips are a collection of drawn shapes, not a bar.** No container row, no track behind them, no fixed count of empty slots: the row shows what exists. Pips, the cursor marker and the start marker are drawn with `View` or SVG parts from `packages/design-system` (`PipRow`), **never text characters**; a test asserts that no learner string and no component source contains U+25B6, U+25C0, U+25BC or another emoji-capable symbol.

| Pip state | Meaning | Drawn shape (size: 20 dp in a stage row, 24 dp in a cell row) |
|---|---|---|
| `done` | the quest has `completedAt` | filled disc |
| `known` | placed out by the level check, not done | ring with a thick inner disc (half the diameter) |
| `open` | playable, not done, not known | ring, 2 dp stroke |
| `new` | joined a latched stage after it was completed, not done | ring with a sparkle drawn inside; grouped after a visible gap |
| `later` | cell not shipped (or not entitled under OD-4's other branch) | dotted ring, at least 4 visible dashes |

[LR-A5] A quest that is playable but not open to this learner (`isQuestOpen` false, F-ENT-003 free allowance, switch on) and not done is a `later` pip with `laterReason: 'notOpen'`: the dotted shape (the same shape as F-ENT-003's not-open Journey cell; no lock glyph, F-ENT-003 OD-6), the word **Not open yet** (`learner.access.notOpen`, which `state.notOpen` and `legend.notOpen` equal) and a legend row of its own; never a price, a product name, "Premium", a purchase button or an ask prompt on this page (F-ENT-003's episode preview carries the ask). The `free-end` hero (drawn by LR-5b; F-ENT-003 E3-10 withdrawn) reads "You played every quest that is open for you." with one button, Practice words or Open Library. Native store builds never show these (F-ENT-003 `gatingActive`, OD-13). A done pip stays done when access shrinks.

Precedence: `done` > `known` > `new` > `open` > `later`. The cursor pip carries `isCursor` (a drawn marker above it); the start pip carries `isStart`.

**Fill-only guarantees (tests, section 5).**

1. A `done` pip never becomes anything else, moves or disappears. New content adds pips at the end of their cell; in a latched stage they go to `newPips`, drawn after a gap, so the earned group never looks emptier.
2. No percentage and no `x / y` is rendered on the learner page (F-STORY-006, F-STORY-005 map rules).
3. A render-model test: across "ship content" steps, no **latched** row's earned group loses filled share (it stays fully filled; new pips are their own group). An unlatched row that gains a cell gains open pips, so its share can go down; that is "the row shows what exists", not a loss: its done pips never change (guarantee 1). Amended in R-1a review; the property test checks done pips and latched rows, not the share of unlatched rows.
4. `known` -> `open` happens only through the grown-up override (`route-seed.ts:169-178`). `known` is not an earned item.
5. The trail connector fills down to `trailReached` = the highest-order stage with a `done` or `known` pip, plus every quest any stored placement ever placed out (so an override that puts quests back does not retract it). Accepted limit (R-1a review): `placements` keeps the last 10 entries (`PLACEMENT_KEEP`); after more than 10 level checks, a prefix that only a trimmed placement placed out (and that is neither done nor placed out now) no longer counts, so the trail can draw shorter. Done pips are never affected.

A **cell row** (expanded stage) shows the theme label, the episode title, its pips and a word: **Complete** / **Playing** / **You knew this** / **Open** / **Coming later**. A playable cell row opens `EpisodeDetail { episodeId }`; a `later` cell is not a button. Pip ids absent from the bundle (an old placement naming a removed quest) are ignored (test).

Below 360 dp of available width, a stage row shows its count caption and the `Progress` fill bar (`packages/design-system` `Progress`, no label, never a ratio text) instead of the pip row; the stage sheet still shows the pips. The stage sheet has a pip legend (drawn shapes plus words).

### 3.5 The cursor and the hero

> **Amended by F-ENT-003 (2026-10-11).** `NextQuestInput` and `CursorContext` gain an optional `isQuestOpen`. `routeNext` and `planView` (`logic/route-next.ts`, F-ENT-003 §3.5, PR E3-4) wrap the one cursor: due-today assignments first (Home's `assignmentsForToday`), then the leading plan source (class, family, own; newest inside a rank), then the cursor. Home card (2), the Results teaser, the Journey, the episode page and this page (LR-3b imports them; no second next function) show the same next quest and the same "In your plan" set. A free learner's not-open quests use "Not open yet" and the dotted pip (F-ENT-003 §3.11, LR §4.5); this page's `free-end` state is drawn by LR-5 with `learner.access.openForYou`.

**One cursor.** `nextQuestAfter` (`logic/next-quest.ts:44-48`) is the only cursor. R-4a extends `NextQuestInput` with `skipQuestIds?: ReadonlySet<string>` (placed-out quests) and makes Home and Results pass the **same** `isEntitled` and `skipQuestIds`. `logic/my-route/cursor.ts` is a thin wrapper that calls it; it returns `undefined` at rest. Home keeps its replay fallback **inside** `mission-builder.ts` (`:120-121`), wrapping the shared cursor, so Home's card (2) does not disappear at rest. Landed in R-4a: `logic/cursor-context.ts` `cursorContext({ tier, placements, quests, episodes })` returns the `{ isEntitled, skipQuestIds }` pair that Home, Results and My route (R-3) all spread into the cursor; `CURSOR_STAGE_RULE` holds OD-4 (`'shipped'` = the default, every shipped stage playable; `'tier'` = the alternative), so switching OD-4 is one constant (Home and Results both re-render on a tier change; Home's day pin keeps card (2) until the next day, so a switch to `'tier'` should also re-pin it on a tier change).

Two surface-specific fallbacks sit **around** the one cursor and are accepted (R-4a review):
- **Home's day pin** (F-HW-001 §3.2) keeps card (2) for the day, with one exception: when a level check places out the pinned "New" quest and it was not played today, card (2) moves to the cursor (`repinPlacedOut` in `mission-builder.ts`). Cards (1) and (3) never move.
- **Only placed-out quests left.** When every offerable quest is done or placed out and some placed-out quest was never played, Home's card (2) and the Results teaser offer that placed-out quest (F-PLC-001 §3.7: a placed-out quest never played comes before nothing), while `routeCursor` returns `undefined` and My route shows the `rest` or `beyond` hero, with the known pips visible on the trail. This keeps the `beyond` hero meaningful for a learner the level check placed past all content. `cursor-context.test.ts` pins this divergence.

**[LR-A3] Route card and plan-led next step.** The hero card becomes the **route card**: **Now** (the `here` stage), **Goal** (`pickGoal`: the leading curriculum plan's highest lesson stage, ranked teacher > parent > system; else the first stage still `open`, "Hoya's suggestion"; else none) with its source line and can-do line, **Next**, and the one button. When Goal and Now are the same stage they collapse into one line; under the goal a fill-only row of the goal stage's pips shows how far along it is, without numbers. The button opens F-ENT-003's `routeNext` quest (`logic/route-next.ts`, which wraps the one cursor below and puts the active plan first), so this page, Home and Results show one next quest; the page has no next function of its own (LR-OD-6 is F-ENT-003 OD-7), and the one next marker sits on that pip. No date, week count or "to go" appears on the learner card, and the weekly plan line on this page carries no Next title. Details: `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 4. The hero kinds below stay and gain `freeEnd`; they are computed from `nextKind`.

Hero (one sentence, one button; the single primary action of the page):

| `hero` | When | Sentence (draft) | Button |
|---|---|---|---|
| `start` | nothing done, no start marker | "Your Learning Route starts here." (was "Your Hangul route starts here."; AMENDMENTS-ROUTE-LEARNING-ROUTE §7.2, LR-1) + goal line "Your first goal: read every Hangul letter." | **Start** -> the cursor quest |
| `continue` | a cursor exists | "You are on Stage N: Title." + "Next: quest title" | **Continue** -> `QuestPlayer` for the cursor |
| `rest` | no cursor, at least one quest done, `route?.beyondContent` not true | "You did everything that is open right now. More is coming." | **Open stories** when a reviewed shelf story exists, else **Open Library** |
| `beyond` | no cursor and `route.beyondContent` is true | "You know a lot! More adventures are coming." (F-PLC-001 section 3.1 step 7 wording) | same as `rest` |

`needsStage !== null` (placed at a stage the tier lacks) uses the `rest` wording, never `beyond`. Read-only mode hides the button. Hoya pose `idle`; `cheering` on the first open after a newly completed episode (from `seen.doneKeys`, section 3.10).

### 3.6 Start marker and known pips (R-7a: needs F-PLC-001 P-5 and F-QUEST-002 Q-6a)

- With `route`: pips in `route.placedOutQuestIds` that are not done are `known`; the pip of `route.startQuestId` has `isStart`; the tag **You started here** sits on the stage of `startQuestId`, else on the highest stage holding a quest the level check placed out (known, or done since), so the tag never moves as those quests are finished.
- **Limit, stated plainly.** On the shipped catalogue every lesson's `teaches` is empty (`catalog/data.ts:81-91`), and a Stage 1 quest is placed out only when it teaches something covered (`level-map.ts:72`). So a Stage 1 level check places out nothing until Q-6a fills `teaches` for quests 1-3 (and the parity test mirrors them into `catalog/data.ts`); only a Stage 2+ level marks the Stage 1 pips `known`. R-7a ships after Q-6a so the feature is not inert.
- Learner wording never names a level or a band on this page ("You started here", "You knew this"). Grown-up views may name the stage and band (section 3.12).
- With no placement there is no start marker. A retake never moves the start earlier; **a grown-up override may** (it puts quests back, `route-seed.ts:169-178`).
- The start is read against **today's** bundle and tier, the same way `effectiveRoute` picks where the app starts the learner, so the pip always agrees with where play begins. A quest that joins the bundle ahead of the old start, or a stage the learner is newly entitled to, can become the start, because it was never placed out. Pinned in `start-marker.test.ts`.

### 3.7 What your quests practice: read, listen, write (an inventory, not a score)

Three rows: **Read**, **Listen**, **Write**. Speaking is not a row (owner decision; section 10).

- **Source.** `SKILL_OF_KIND: Record<MinigameKind, readonly Skill[]>` in `skills.ts`, **exhaustive over `MinigameKindSchema.options`** (`schemas/minigame.ts`; a unit test iterates the enum, so a new kind fails the build until mapped). Default (OD-5):

| Kind | Tracked skill | Why |
|---|---|---|
| `match-sound`, `tap-respond` | read, listen | hear a sound, find the written form |
| `listen-pick` | listen | |
| `match-shape`, `odd-one-out`, `pic-word-match`, `story-read` | read | needs decoding Hangul |
| `trace-stroke` | write | the owner's definition of writing: trace games |
| `build-letter`, `syllable-build` | none (counted only in the grown-up line **Spelling with tiles**) | spelling from tiles, not handwriting |
| `card-match`, `culture-quiz`, `story-sequence`, `story-check` | none ("words and culture") | do not need decoding |
| `voice-echo` | none | speaking is not tracked in this feature |
| `tap-rhythm`, `order-it` | none | enum only, no renderer |

- A finished quest counts for a skill when one of its steps has a mapped kind. `quests` = the number of **distinct finished quests** (grid and shelf) that count. Marks = how many thresholds of `SKILL_THRESHOLDS = [1, 2, 4, 6, 8]` are reached.
- **No permanent empty slots.** A row shows its earned marks (filled discs) and **at most one faint "next" slot, only when it is reachable**: when the quests open to this learner that count for the skill number at least the next threshold. A skill whose next mark cannot be earned with today's content shows no empty slot at all. A row with zero quests shows only the word and "Ready when you are". Test: for every fixture, no visible slot is unreachable with the content open to the learner.
- Today's bundle (11 quests): Read counts in 8 (letters q1-q3, life q1, rites q1, nature q1, crafts q1, stage4-rites q1), Listen in 8 (the same), Write in 1 (letters q2), Spelling with tiles in 4 (letters q1, q3, both Stage 2 quests). Tests pin these on the **frozen fixture** only (section 5).
- **Inventory wording.** Under the skill word a row reads **"In 4 quests you finished"** (an absolute count; never a ratio, never "4 of N"). The section title is **"What your quests practice"**. Never "level", "score", "mastered", a percentage. Tapping a row opens a sheet listing the game names that count (static text from the table).
- **Skipped games.** A game skipped inside a finished quest still counts (section 1). The grown-up view says so (section 3.12). Claiming "you practiced" needs step-level data: a later additive `QuestProgress.kindsPlayed?: MinigameKind[]` written by `finishQuest`, with a union merge and an `ADDITIVE_FIELDS` entry (gap G4; not in v1).
- **What is not measured (gap list, grown-up and docs only).** (1) The level check measures reading and listening only. (2) Nothing stores per-skill results. (3) Tracing checks strokes inside the game but stores nothing per skill, and only one quest traces today. (4) Skipped games still count. (5) Stage anchors past Stage 3 have no content. Plan: a later `F-SKILL-001` may add an optional per-skill tally; `kindsPlayed` first.

### 3.8 Gains

Three tiles, each an icon and an absolute number, shown only when greater than zero: **Stars** (sum of best stars; `recordBestQuest` keeps the best, `logic/quest-progress.ts:19-34`), **Cards** (`snapshot.cards.length`, no total), **Stories read** (distinct finished shelf quests). Cards opens the Library; Stories opens the Library stories shelf when it exists. All zero: section hidden.

### 3.9 Weekly plan line (R-7b: needs F-PLAN-002 P2-7a; hidden while no plan exists)

`plan-position.ts` takes the newest active source (the self plan, else the newest inbox plan with `meta`) and returns `{ state: 'upcoming' | 'active' | 'finished', week, nextTitle }`.

- **One line under the hero:** "Week 3" and "Next in your weekly plan: <title>" with the link **Open plan** (-> F-PLAN-002 `RouteOverview`). **No dots, no week-pip strip, no "This week" count**: those fill with calendar time or reset each week, and a skipped Monday would draw empty dots. The accessibility label equals the visible text (no "of 12", no "of 3").
- `upcoming`: "Your weekly plan starts on Mon, Oct 12." `finished`: "Your weekly plan is finished." with **Make a new plan**. A classic plan without `meta` shows no week.
- With no plan, `flags.routeEnabled`, and (a placement result or a finished quest), and not dismissed (amendments AM-6): a quiet line **Hoya can make a weekly plan for you** -> the proposal.
- **Home:** when a plan exists, its week line lives in the Home route strip (section 3.1 entry 2) and F-PLAN-002's Home card does not repeat it; without a plan, F-PLAN-002's Home card shows only the make-a-plan prompt (amendment FP-B6).

**As built (R-7b, #535; amendment `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 4.3 supersedes the bullets above where they differ).** `plan-position.ts` was not written: the week is `routeWeekOf(model, next)` in `logic/my-route/route-input.ts`, over LR-5a's `planWeekOf` (`logic/my-route/plan-week.ts`), and the page line and the Home strip (`homeStripView({ week })`) both read it from the same F-ENT-003 input. The week is the week of the goal's own plan (amendment 4.1: a class plan leads the learner's own, even one that has not started yet, so the line is then hidden until the class plan starts). The line reads only "Week {n} of your weekly plan": no Next title, no "N of M" count. It is hidden with no plan, an archived plan, a classic plan without `meta`, before the plan starts and after it ends; the "starts on {date}" and "is finished / Make a new plan" lines were dropped (their `plan.starts`, `plan.finished`, `plan.new` keys are unused). The **Open plan** link is deferred: F-PLAN-002's `RouteOverview` is not yet in the mobile navigator, so row R-7d wires it. **As built (R-7d, #566):** **Open plan** (`learner.myRoute.plan.open`, testID `my-route-plan-open`, `LinkButton`, its accessible name the visible words) shows under the line only for the learner's own plan (`goal.from === 'self'`) and only while `flags.routeEnabled` mounts `RouteOverview`; a class, family or school plan line has no link. It navigates to `RouteOverview { profileId }` for the profile the page shows, and never appears on the grown-up read-only page.

### 3.10 "New quests joined" (growth without loss)

`seen.ts` keeps `route-map-ui:<profileId> = { totals: Partial<Record<StageKey, number>>, doneKeys: string[], at }` through `platform/storage.ts` (`readJson` / `writeJson`). On open: `newSinceSeen = max(0, currentGridQuests - seenTotal)` per stage when a total exists; one calm line under the hero for the first stage with a positive number ("3 new quests joined Stage 1.", sparkle icon). `doneKeys` drives Hoya `cheering` and the one-time fill. **The write is wrapped in try/catch** (`writeJson` does not catch, `platform/storage.ts:19-21`); a failed read or write shows nothing. **`seen` is written only for the active profile**, never in read-only mode. The line never says "left", "remaining", "incomplete", or "only".

### 3.11 The screen (phone, regular, wide)

**Phone (compact, < 600).** One column in `Screen` (tokens only). Order: header (back, "My route") -> hero card -> weekly plan line (if any) -> new-quests line (if any) -> the **trail** -> "What your quests practice" -> gains -> stories note.

- **Trail.** Stage rows joined by a vertical connector at the badge centre: **solid** in the stage colour (`colors.stage[stage]`) down to `trailReached`, **dotted** in the border token below it (shape as well as colour). A stage row is one `Pressable` of at least 64 dp: badge (40 dp), title, caption, the state word as a `Pill`, the tags, and the `PipRow`. Tapping expands it in place; one row open at a time; the `here` stage is open on first view.
- **Coming-later rows are compact.** A `later` stage is a one-line row without pips; **consecutive** `later` stages merge into one row ("Stages 5 to 7 · Coming later") that expands on tap. Today: Stage 3 is one compact row, Stages 5 to 7 one merged row. The Home strip and the parent dashboard keep a seven-segment overview so the whole journey is still visible in one look.
- **Captions** (absolute, positive): `done > 0`: "N quests played" (plural helper); `done = 0` on an open stage: "Ready when you are"; `explored`: "You explored everything that is open right now"; `known`: "You knew this"; `later`: the stage's can-do line (below) plus "Coming later". **`stages.ts` `oneLinerEn` is never shown** (it carries an unsettled number, `content/stages.ts:20`).
- **Can-do line.** Each stage has one `learner.myRoute.stage.canDo.<n>` string with no number (Appendix A). It is shown in the expanded stage ("By the end of this stage you can: ...") and as the caption of a `later` stage; the hero `start` shows Stage 1's goal line.
- **Letter wall** (R-7c, Stage 1 expanded): the 30 symbols, lit when met (taught by a finished quest: the union of `questTeaches` over the done Stage 1 quests, which equals `symbolsMetThrough` for in-order play), outlined when covered by the level check. "Covered" is derived from the `teaches` of **placed-out quests** (the result stores no symbol list). `questTeaches` returns jamo ids (`logic/stage1/curriculum.ts:23-33`) while `RouteQuest.teaches` uses symbol keys, so R-7c adds a `jamoIdToSymbolKey` adapter with a test. Drawn with `KoreanText` (romanization and gloss). As built: closed by default behind a ghost "Letter wall" disclosure button (like the pip legend), the legend lists only the states shown, romanization always shows on the wall (the letters are taught content), and a finished later quest never lights earlier letters, so placed-out letters stay outlined.
- **Stories note.** One muted line when stories exist: "Heritage stories are open any time." with a link.

**Regular (600 to 899) and wide (>= 900).** The same single column inside `Screen width="reading"` (F-LAYOUT-001 PR 1, on main); pips and badges scale with `mediaScale`. **No two-pane layout in v1** (R-6 removed; a two-pane variant may be revisited after F-LAYOUT-001 PR 5a lands, and only with stage chips and skills in the detail pane, never a theme grid). A phone in landscape stays one column.

**Chrome.** Back = previous screen. Tab bar unchanged. Hoya appears in the hero only. No emoji; `Icon` glyphs and drawn shapes only.

### 3.12 Grown-up views

**Viewer-aware copy.** Copy selectors take `viewer: 'self' | 'grownup'`. In read-only mode (a grown-up viewing a child) every learner sentence is third person from the profile name: "Sam is on Stage 1: Hangul.", "Sam started here.", "Sam already knew this.", "In 4 quests Sam finished". These strings live in `caregiver.journey` and are tested in both lists (section 3.13).

**Skills note (one key, everywhere).** `caregiver.skillsNote`: "The level check looks at reading and listening. Writing is practiced with tracing games and is not scored. The rows count finished quests that include these games; a game skipped inside a quest still counts." Used on the read-only page under "What Sam's quests practice", on the dashboard row, on the placement report (amendment AM-5) and in the proposal's grown-up variant. No other wording of this sentence exists.

**In-app parent dashboard (R-9b, M3, behind the existing gate).** Each profile card (`ParentDashboardScreen.tsx:70-73` region) gains a **Journey** row: seven segments (drawn state shape per stage, a text list for screen readers), "Now: Stage N · Title", "Started: Stage N · band label · date" (from `placements`), three mini rows (read, listen, write) plus "Spelling with tiles: N quests", the skills note, and **See journey** -> `MyRoute { profileId }` read-only. Builds on PR 8a (#172), which moves that screen's strings to `caregiver.*`. Caregiver banned phrases apply.

**[LR-A6] Learning Route names and the adult summary page.** The dashboard row title becomes **Learning Route**, its button **See Learning Route**, and it gains a line "Goal: Stage N · Title" from `pickGoal` (R-9b). The console strip title becomes **Learning Route** (R-9a). The R-9b button opens root-stack `MyRoute { profileId, viewer: 'grownup' }`, forced read-only. A signed-in parent or teacher sees one **goal line** under the per-learner report's "Now on Stage" line, whose **Open Learning Route** link (F-REPORT-001) opens **one learner's read-only stage list** at `ROUTES.learnerRoute(spaceId, learnerId, kind?)`: `/parent/space/route?id=&learner=` for a family, `/teach/space/route?id=&learner=` for a class (ids only); the family home card links there too (F-APP-001). It is built from the roster summary already received: stage rows from `summary.journey` with each stage's can-do line and a slot for F-BROWSE-001's Preview lessons; the goal from the family-only `summary.routeGoal` (the goal the learner's device shows), else worded as the viewing space's own plan ("Your class's weekly plan reaches ..."), else "Next open stage"; no pips, no skills, no zero counts, no billing link, no other learner and no comparison. Details and states: `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 6, wireframes `parent/learning-route.md` and `console/learning-route.md`. The Home strip (R-4b) gains the title **Learning Route** and the line "Goal: Stage N · Title".

**Console strip (R-8 summary, R-9a web).** One additive optional field on `ProgressSummary`, tolerant on the wire:

```ts
// packages/content-schema/src/schemas/sync.ts
export const JourneySummarySchema = z.object({
  v: z.literal(1),
  here: z.string().max(32).nullable(),
  stages: z.array(z.object({
    stage: z.string().max(32),                   // validated against StageKey in the web strip, not on the wire
    state: z.string().max(32),                   // 'complete' | 'known' | 'explored' | 'open' | 'later', validated in the strip
    done: z.number().int().nonnegative().max(10000),   // done grid quests in that stage
    known: z.number().int().nonnegative().max(10000),  // placed out and not done
    total: z.number().int().nonnegative().max(10000),  // grid quests this build offers there (sizes the segment, never shown as a goal)
  })).max(16),                                   // bounds only stop a tampered client growing every roster; an oversized journey is dropped
  seeded: z.literal(true).optional().catch(undefined), // R-7a follow-up: set by builds that read the stored level check; a bad value drops only the marker
});
// ProgressSummarySchema gains: journey: JourneySummarySchema.optional().catch(undefined)   (schemaVersion stays 1)
```

- A malformed `journey` is dropped, never a 422 (`routes/sync.ts:50-51` would otherwise reject the whole snapshot). Backend test: "malformed journey: PUT still 200, journey dropped". "At most seven entries" is a client-side invariant test, not a wire rule.
- **Computed in `store/sync-store.ts`** (where the stores, tier and placements are available) from `summarizeJourney(buildMyRoute(...))` and passed into `summarize` as an input, like `planNotReady` (`sync-store.ts:92-93`); `summarize.ts` stays pure. No `locked` field: the roster carries no tier (`api.ts:25-34`), and with the default entitlement predicate nothing is locked.
- **`seeded`.** `journeySummaryOf` sets `seeded: true` once it builds the route from the stored level check and takes `here` from the start marker (R-7a and its follow-up). A journey from an older build has no marker: its `known` counts are always 0 and its `here` ignores the start. The R-9a strip treats a journey without `seeded` next to a `placement` as skewed: it leaves out "On Stage N" and the per-stage lines and never shows the zero `known` counts as fact. The Worker ships the field (same deploy as the web app) before a client's marker can survive the roster projection, since zod strips unknown keys.
- Size: about 300 bytes; stage-level counts only (`summarize.ts:5-8`: no per-quest detail). Skills stay local (OD-11).
- **Roster card only.** `apps/web/src/lib/console/journey-strip.ts` (pure, tested) renders seven segments (shape + word list), "On Stage N", and a `<details>` with one line per stage: **"4 known from the level check, 2 quests done"** (known shown only when > 0). Rendered in the roster card of `app/teach/space/page.tsx` (`:161-168`) for **class and family** spaces. **Not** on `app/teach/home/page.tsx` (its contract is counts only, no names, `:15`). **Not** for a `school` space (it renders `SchoolAdmin` before any roster, `page.tsx:46`).
- **Hard rules.** No class average, no distribution, no sort or filter by stage, no "ahead" / "behind"; cards stay in recent-activity order (`routes/spaces.ts:386`); `total` is never shown as a goal. No "not included" line in v1.

### 3.13 Copy, anti-shame, localization

- Every string is a message (`learner.myRoute`, `caregiver.journey`, `console.journey`, `a11y.myRoute`), English default, plain Pre-A1 (Appendix B). No Korean typed in UI strings; the letter wall uses `KoreanText`. Each string passes the length-budget test (`packages/i18n/src/__tests__/length-budget.test.ts`).
- **Banned on learner copy.** The shared lists apply (`logic/homework/banned-text.ts:10, 30-37`; `packages/i18n/src/banned-words.json`). The longer list of this page (`behind`, `late`, `catch up`, `left`, `remaining`, `still to go`, `only`, `ahead of`, `compared`, `rank`, `score`, `level` as a grade, `Premium`, `price`, `unlock` as a commerce word, `%`, `\d+ ?/ ?\d+`, emoji, emoji-capable symbols) is a **my-route-local test fixture with es / ko equivalents** (`logic/my-route/__tests__/banned-fixture.ts`), not a change to `banned-words.json` (which would break existing copy).
- **Digits:** allowed only in plural helpers for absolute counts, in `Stage {n}`, in `Week {n}`, in dates, and in a11y strings. A copy test enforces it.
- **No speaking words.** No `learner.myRoute`, `caregiver.journey` or `console.journey` string contains "speak", "speaking", "say it", "pronounce" or "microphone" (and the es / ko equivalents). Test.
- **Banned on caregiver copy:** the F-PAR-001 section 3.6 phrases and the learner fixture minus `level`.
- **Allowed and used:** positive nudges ("3 new quests joined Stage 1.", "Ready when you are.").

### 3.14 Accessibility

- **Text alternative.** The trail is a list (`accessibilityRole="list"`); each stage row label reads the row: "Stage 1, Hangul. Open. You are here. You started here. 5 quests played." Pips are `importantForAccessibility="no"`.
- **No colour-only meaning.** Every state has a drawn shape (section 3.4), a word and, on the badge, a glyph. Stage colours decorate only (`packages/design-system/src/tokens.ts:61-71`: stage1-4 are 2.3 to 3.0:1 on canvas). Pip outlines and the dotted connector use a **new border token** that meets 3:1 on `surface.paper`, added through `design/tokens/` and checked by `design-token-sync` (R-2b scope). R-2b acceptance includes a greyscale and protanopia check of all five pip shapes at 20 dp and of the connector. Landed in R-2b: the token is `colors.border.shape` (#857360, 4.55:1 on paper), and the shapes, markers and the design pass are recorded in `design/components/PipRow/spec.md` with the preview `pip-row-v1.png`, which also checks the trail connector (solid in the stage colour, dotted in `border.shape`) in greyscale and protanopia. A done pip carries a drawn check in `text.primary` (3.5:1 or more on every stage colour), so done never relies on the stage fill.
- Targets: stage rows, cell rows, hero button, skill rows >= `touchTarget.min`. Body text >= 18; reflow at 320 x 568, landscape and 200 % text.
- **Reduced motion:** nothing animates by default; the one-time fill of a newly done pip (from `seen.doneKeys`) only when motion is not reduced.
- Screen-reader order: hero, weekly plan line, trail, practice, gains. Focus lands on the hero sentence.

### 3.15 Data, storage, sync, privacy

- **One additive payload field: `stageDoneAt`.** `ProgressSnapshotSchema` gains `stageDoneAt: z.record(z.string(), z.string()).optional()` (stage key -> ISO time). Merge (`logic/sync/merge.ts`): key union, earliest time wins (an earned latch is never removed). Worker: one `ADDITIVE_FIELDS` entry `{ payloadKey: 'stageDoneAt', isUnset: v === undefined || empty object }` (`additive-fields.ts:34`), with a `merge` that unions a sent record with the stored one by the same rule (a device that synced on an old build and then upgraded must not erase another device's latch; R-W1 review). Times are `toISOString()` from the writer; both merges compare instants (`Date.parse`), and a value that does not parse never beats one that does. The writer (R-1b) only adds keys to the hydrated snapshot, never builds a fresh record. **Deploy the Worker before any app build that writes it** (R-W1). Readers treat a missing value as `{}`.
- **Everything else is derived** from the local snapshot, the bundle, the catalogue and the tier; it works offline. The per-device key `route-map-ui:<profileId>` is never synced.
- **`summary.journey`** (R-8): optional, tolerant (section 3.12), `schemaVersion` stays 1, no D1 migration (summary is a JSON column), no preserve entry (recomputed from the payload every build uploads). Deploy in the shared deploy D2 (section 6.0).
- **Privacy.** Stage keys and counts only. `learnerType` is never sent. Telemetry carries stage keys, booleans and ids only.

### 3.16 Telemetry (`TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9`, exact-list test; Worker first in R-W1; rows added to `docs/roadmap/TELEMETRY-NAMES-2.md` section H in R-0)

| Name | Payload | When |
|---|---|---|
| `route_map.viewed` | `{ source: 'home' \| 'journey' \| 'result' \| 'parent', stage: StageKey, hasStart: boolean, hasPlan: boolean }` | the page opens (active profile only) |
| `route_map.stage_opened` | `{ stage: StageKey }` | a stage row is expanded |
| `route_map.continue_tapped` | `{ stage: StageKey, hero: 'start' \| 'continue' }` | the hero button is pressed |

[LR-A7] `route_map.viewed.source` gains `'tab'` and the payload gains `goalFrom`; `route_map.continue_tapped` gains `from` (F-ENT-003's `NextSource`: `'class' | 'family' | 'self' | 'route'`). These need no Worker change (the Worker validates names only). One new name, `route_map.goal_reached { stage, goalFrom }`, sent once per reached plan goal per device, is added Worker first in LR-W1.

### 3.17 States, errors, offline

- **New profile**: hero `start`; Stage 1 open with ring pips; skill rows show the word and "Ready when you are" with no slots; gains hidden.
- **Content cannot be read**: hero and an inline retry; selectors never throw.
- **Offline**: identical. **Read-only**: no hero button, no telemetry, no `seen` write, grown-up wording.
- **Tier changes mid-session**: the model recomputes; done pips and latches stay.
- **Unknown stage key or state from a newer build** (console): the strip ignores the entry.

### 3.18 Behaviours (Given / When / Then; counts are on the frozen fixtures)

- **Given** a new learner, **then** the hero offers **Start** with the goal line, Stage 1 is `here` and `open` with ring pips, Stage 3 is one compact "Coming later" row and Stages 5 to 7 one merged row, and no number or percent appears.
- **Given** `letters-q1..q3` and `life-q1` done (8-quest bundle), **then** Stage 1 shows four discs and four rings, the cursor marker is on `life-q2`, the caption reads "4 quests played", Read and Listen show 3 marks each with a faint next slot, Write shows 1 mark and **no** empty slot (no second trace quest exists).
- **Given** Stage 1 latched at 8 of 8 and then 7 quests join it, **then** the eight discs stay one full group, the seven new pips appear as a separate group with sparkle rings after a gap, the state stays **Complete**, the caption adds "New quests joined", and "7 new quests joined Stage 1." appears once.
- **Given** a learner placed into Stage 2 (Stage 1 fully placed out, nothing done), **then** Stage 1 reads **You knew this** with ring-and-disc pips, none counts in "N quests played", no latch or card is written, `here` is Stage 2, and the connector passes through Stage 1.
- **Given** Stage 2 has two shipped cells of five and both are done, **then** it reads **Explored**, never **Complete**.
- **Given** a parent override puts quests back, **then** those pips return from `known` to `open`, every `done` pip stays, the connector does not retract.
- **Given** a weekly plan in week 3, **then** one line reads "Week 3" and "Next in your weekly plan: <title>" with no dots; its screen-reader label equals the visible text.
- **Given** a parent opens a child's page from the dashboard with the gate open, **then** it is read-only, written about the child ("Sam is on Stage 1"), shows the skills note, sends no telemetry and writes no `seen`; **given** the gate is closed, **then** `PinEntry` opens instead.
- **Given** a new `MinigameKind` not in `SKILL_OF_KIND`, **then** the unit test fails.
- **Given** a teacher's class roster, **then** each card shows the strip and "N known from the level check, M quests done", no `total` as a goal, no aggregate, unchanged order; a malformed `journey` from a device never fails that device's sync.

## 4. Out of scope

- **Speaking** in any form in this feature's UI (owner decision 2026-10-10; plan in section 10). A level per skill, a pronunciation score, any numeric anchor target (Stage 2 is "60 words" in `content/stages.ts:20-21` and 200 in blueprint 04, OD-10). No CEFR or TOPIK label.
- A side rail, removing or editing the Journey grid, a two-pane page. ([LR-A8] "A fourth tab" left this list: the Route tab is in scope.)
- The F-PLC-001 flow, the F-PLAN-002 planner and its weekly overview, F-QUEST-002 content, F-STORY-006 awards: read (guarded), changed only as `AMENDMENTS-PLC-PLAN-HANDOFF.md` lists.
- A per-learner console page; skills in the console summary; tier wording in the console; class averages; sorting by stage.
- A streak or day count on this page; push notifications; sharing the page as an image.
- Word-topic progress and review counts (F-VOC-005, F-RVW-001: later rows, as gains, never as debts).

## 5. Tests

All counts are asserted on **frozen fixtures** (`packages/content-schema/src/__tests__/fixtures/catalog-2026-10.ts`, plus a frozen copy of today's 8-quest bundle in `logic/my-route/__tests__/fixtures/bundle-2026-10.ts`). One smoke test runs the live bundle and asserts invariants only (exhaustive mapping, grid predicate finds the shipped quests, no slot unreachable, no ratio).

| File | Level | Coverage |
|---|---|---|
| `mobile/src/logic/my-route/__tests__/order.test.ts` | unit | route order; cursor = `nextQuestAfter` = first open pip on both fixtures |
| `…/stage-rows.test.ts` | unit, 100 % | five states for every availability x entitlement x done x known x latch combination; taste never `complete`; `known` never latches; `here` rules |
| `…/pips.test.ts` | unit | grid predicate on the real unparsed `episodesAll` (8 + 2 + 1); precedence; `new` group only when latched; ids absent from the bundle ignored |
| `…/monotonic.test.ts` | property | over random "finish a quest", "ship a cell", "grow a cell", "entitlement change", "placement", "override": done pips only grow, latched stays complete, no row's filled share goes down, `trailReached` never decreases; `known` -> `open` only through an override |
| `…/cursor.test.ts` | unit | wrapper returns `undefined` at rest; `skipQuestIds`; tier-aware |
| `…/skills.test.ts` | unit | `SKILL_OF_KIND` exhaustive; `voice-echo` maps to none; thresholds; next slot only when reachable; fixture counts |
| `…/gains.test.ts` | unit | sum of best stars; zero tiles hidden |
| `…/latch.test.ts` | unit | `latchesToWrite` on transition and on first run; never for `known` or taste |
| `…/seen.test.ts` | unit | one line; failed write swallowed; never written in read-only |
| `…/copy.test.ts` | unit | every `learner.myRoute`, `caregiver.journey`, `console.journey` string in en / es / ko: banned fixture, digit rule, no speaking words, no emoji-capable symbol, length budget; `viewer: 'grownup'` uses third person. **Split by PR:** R-1b runs the rules (`__tests__/copy-rules.ts` `copyViolations`) on the Appendix B English drafts with realistic per-key samples, and runs every selector with `viewer: 'grownup'`; R-3 runs `copyViolations` and the length budget on the real `learner.myRoute` / `a11y.myRoute` dictionary in en / es / ko, R-9b on `caregiver.journey`, R-9a on `console.journey`. |
| `…/summary.test.ts` | unit | `summarizeJourney` equals the rows; parses with `JourneySummarySchema`; at most 7 entries |
| `…/start-marker.test.ts` (R-7a), `…/route-input.test.ts` `routeWeekOf` (R-7b; replaces `plan-position.test.ts`) | unit | start fixed while quests are completed; moves with a higher retake; override moves it; `beyondContent` vs `needsStage`; the week holding today, null before the start and after the end |
| `content-schema/src/__tests__/sync.test.ts`, `progress.test.ts` (extend) | unit | `journey` optional and `.catch`; old summary parses; `stageDoneAt` optional |
| `content-schema/src/__tests__/telemetry.test.ts` (extend) | unit | three new names in the exact list |
| `backend/src/__tests__/sync.test.ts`, `spaces.test.ts` (extend) | integration | malformed `journey`: 200 and dropped; `journey` reaches the roster; `stageDoneAt` preserved from an old client |
| `design-system/src/components/PipRow/__tests__/*.test.ts` | unit (logic) | five drawn shapes; no text glyphs; size per context |
| `design-system/src/components/Icon/__tests__/glyphs.test.ts` (extend) | unit | five new glyphs |
| `web/src/lib/console/__tests__/journey-strip.test.ts` | unit | segments, text list, known line, unknown entries ignored, no aggregate or sort exported |
| `mobile/e2e/web/my-route.spec.ts` | e2e (nightly) | 320x568, 375x667, 844x390, 1180x820: reachable from the Journey header and Home, no horizontal scroll, trail text list, read-only and gate redirect, hero opens the cursor quest, offline |

Coverage: `apps/mobile/src/logic` >= 90 % with `logic/my-route/` at 100 %; `packages/content-schema` 100 %; `apps/web` console logic >= 90 %. Screens are verified by e2e (the mobile vitest lane does not render components).

## 6. Rollout and PR breakdown

### 6.0 Critical path and milestones

| Milestone | What the user sees at the end | PRs (this spec unless named) | Count | Deploy gates |
|---|---|---|---|---|
| **M1 "Where am I"** (the owner's ask) | My route from the Journey header, then from the Home strip; Home's wrong bar is gone; "Complete" can never be taken away | R-0, R-1a, R-1b, R-W1, R-2a, R-2b, R-3, R-4a, R-4b | 9 | R-W1 (Worker: `stageDoneAt` preserve + `route_map.*` names) |
| **M2 "Default weekly plan"** (default curriculum after the level check) | a weekly plan proposed with one tap from Home / Profile even without a level check (stage1 band 0), then right after the level check; the plan's week on My route | F-PLAN-002 P2-3a, P2-3b, P2-4, P2-5, P2-7a, P2-7b; F-PLC-001 P-4 (in flight), P-5, P-6, P-7b; R-7b | 11 | D2 (shared Worker deploy: P2-4 `selfRoute` + migration, `route.*` names, R-8 `summary.journey`, Q-10a) |
| **M3 "Adults and polish"** | start marker and known pips, letter wall, parent row, console strip, Journey pill wording, beta flag | R-7a, R-7c, R-8, R-9a, R-9b, R-J, R-10a, R-10b | 8 | R-8 rides D2 |

**Total: about 27 PRs (17 of this spec, 10 on sibling specs' paths), 2 Worker deploys (R-W1, D2) plus one D1 migration (P2-4).** M1 has no dependency on another spec except R-4b's Home sequencing. M2 does not wait for M1. The one-tap weekly plan without a level check (P2-7a) lands before the result strip (P-7b), so the default exists for everyone first.

### 6.1 PR table

| PR | Content | Size | Needs |
|---|---|---|---|
| R-0 | `docs`: this spec, wireframes promoted, `AMENDMENTS-PLC-PLAN-HANDOFF.md` applied to F-PLC-001 / F-PLAN-002 (AM / FP items; the same PR is F-PLC-001 P-0b and F-PLAN-002 P2-0), F-QUEST-002 dependency line for the latch, `route_map.*` rows in `TELEMETRY-NAMES-2.md`, `docs/roadmap/speaking-later.md` | S | this review |
| R-1a | `feat(mobile)`: `logic/my-route/` order, stage rows, pips, cursor wrapper, skills, gains, summary + tests; no UI | M | R-0, OD-5 (default applies) |
| R-1b | `feat(mobile)`: copy selectors (`viewer`), `seen.ts`, `latch.ts` + store writer (runs with the flag off) | S | R-1a, R-W1 deployed |
| R-W1 | `feat(content-schema,backend)`: `ProgressSnapshot.stageDoneAt` + merge + `ADDITIVE_FIELDS` entry; `route_map.*` telemetry names. **Deploy the Worker before R-1b ships in an app build** | S | R-0 |
| R-2a | `feat(design-system)`: icons `pin`, `check-circle`, `book`, `ear`, `pencil` (one PR; lands before F-PLC-001 P-6) | S | R-0 |
| R-2b | `feat(design-system)`: `PipRow` (five drawn shapes, cursor and start markers), border token via `design/tokens/` + `design-token-sync` | M | design mock |
| R-3 | `feat(mobile)`: `MyRoute` screen (phone / regular / wide single column), navigation + gate check, `learner.myRoute` / `a11y.myRoute` en strings, Journey header button, flag | L | R-1a, R-1b, R-2b, R-W1 deployed, R-4a (so Home and My route share one cursor for a placed-out learner) |
| R-4a | `feat(mobile)`: `NextQuestInput.skipQuestIds`; Home and Results pass the same `isEntitled` / `skipQuestIds`; Home keeps its replay fallback; the one predicate is `logic/entitlement.ts` `isStagePlayable`, which `content/sync-context.ts` `journeyContent` (`summary.journey`, R-8) already binds | S | OD-4 |
| R-4b | `feat(mobile)`: Home route strip replaces the bar (`HomeScreen.tsx:199-202`): the here stage's pips and the seven-segment overview (`StageSegments` in `packages/design-system`, the PipRow shape vocabulary); `logic/my-route/home-strip.ts` takes optional `goalStage` and `week`, fed by LR-5a and R-7b; the page and the strip share one model input (`logic/my-route/route-input.ts`) | M | R-3, OD-3, F-STORY-004 4.4a, F-LAYOUT-001 5c |
| R-7a | `feat(mobile)`: start marker and known pips; once `summary.journey` carries a non-zero `known`, re-check its consent item (`transfer-consent.ts` maps `journey` to `quests`, while `known` comes from the level check) | S | F-PLC-001 P-5, F-QUEST-002 Q-6a |
| R-7b | `feat(mobile)`: weekly plan line, and the same week passed to the Home strip (`homeStripView({ week })`). As built: `routeWeekOf` replaces `plan-position.ts` (section 3.9 as-built note) | S | F-PLAN-002 P2-7a |
| R-7d | `feat(mobile)`: the **Open plan** link on `my-route-plan-line` -> F-PLAN-002 `RouteOverview` (deferred from R-7b) | S | F-PLAN-002 P2-7b (adds `RouteOverview`) |
| R-7c | `feat(mobile)`: letter wall + jamo-id adapter | S | Q-6a (partial), Q-8 (complete) |
| R-8 | `feat(content-schema,mobile)`: `JourneySummarySchema`, sync-store input, backend tests | M | R-1a; deploy in D2 |
| R-9a | `feat(web)`: `journey-strip.ts`, roster card strip (class and family) | M | R-8 deployed |
| R-9b | `feat(mobile)`: parent dashboard Learning Route row (`logic/my-route/dashboard-row.ts`, `screens/parent/LearningRouteRow.tsx`), read-only page through `MyRoute { profileId, viewer: 'grownup' }` (optional `viewer` until LR-4 makes it required); `dashboardRowView` takes an optional `goalStage`, fed by LR-5a; the Started line is left to the Starting spot row while `flags.placementEnabled` shows it (one level check per card); the read-only page has no episode, tile or stories link | M | R-3, PR 8a (#172) |
| R-J | `feat(mobile)`: Journey pill wording (no "Premium" on a learner screen; "Taste" -> "A taste"; "Soon" -> "Coming later"); the stage header is a plain row, never a lock or a paywall door (review) | S | OD-8 |
| R-10a | `test(e2e)`, `feat(i18n)`: `my-route.spec.ts` runs a flag-on build and covers the Home strip entry too (strip visible, no "Stage 1 progress", its one-button label, no horizontal scroll at 320 and 844x390, tap opens the page with `source: 'home'`; [LR-A1] since LR-4 the tap opens the Route tab, which sends `route_map.viewed` with `source: 'tab'`, and the e2e asserts that exactly once, in a case reported as skipped without `E2E_TELEMETRY=1`); es and ko values for the R-3 and R-4b strings (`learner.myRoute.*`, `a11y.myRoute.*`, including `home.strip.*` and `homeStrip*`) and for the Route tab's `a11y.tabs.route` and `a11y.tabPosition` (LR-4), held by `route-flip-locales.test.ts`; carries LR-10's e2e (#526 closed into it). The flag stays off | S | R-3, R-4b, LR-4, LR-5a, LR-5b |
| R-10b | flag flip for beta: `flags.myRouteEnabled` defaults on; the `E2E_MY_ROUTE` gates and the `flagOnOnly` exemption in `scripts/__tests__/ci-workflows.test.mjs` are removed (its tripwire fails while the flag defaults on and a block is still exempt), route-tab case (b) joins the fixture run and the `my-route.spec.ts` assumption h describe joins the gating run in `web-app.yml`, with the expected gated list extended; the flag-on `route-tab.spec.ts` and `my-route.spec.ts` run (with `E2E_TELEMETRY=1`) is linked in the flip PR; before the flip, LR-11 has merged (Continue above the tab bar at 320 x 568, issue #530) and its two `my-route.spec.ts` overlap cases (Continue with the longest Stage 1 title, a new learner's Start) run in the flip's flag-on CI e2e, and the owner has answered or knowingly kept the defaults of LR-OD-1 and LR-OD-3 after the LR-11 5-second check's naming verdict (amendment section 16, LR-11 entry) and the native 200 % text checks of the amendment's assumptions a and f have passed on a flag-on device or simulator build (screenshots in the flip PR); the flip is `en` only unless the es / ko review of the R-10a values is signed again | S | R-10a, LR-11, device 200 % checks, es / ko review (else `en` only) |

[LR-A8] The Learning Route PRs (LR-0 to LR-10) are listed in `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 13. R-4b, R-9a, R-9b and R-10 above take the new names; R-4b and R-9b also take the goal line; R-9b's button opens `MyRoute { profileId, viewer: 'grownup' }`; R-10 also covers the tab.

Removed after review: R-5 (Journey cell edits: duplicates the Journey and collides with four specs), R-6 (two panes: wrong dependency, duplicates F-LAYOUT-001 5a).

### 6.2 Sequence notes

R-3 and R-4b edit `JourneyScreen.tsx`, `HomeScreen.tsx` and `learner.ts`, which other specs also edit; keep each edit small (CLAUDE.md section 10). Open PRs to rebase around: #172 (i18n PR 8a, parent dashboard) and #176 (F-SPACE-002 docs). Worktrees in flight that touch shared code: `plc-p4` (P-4 bank), `layout-pr5a` (SplitPane), `story-pr61` (F-STORY-006 PR 6.1).

### 6.3 Ownership (one owner per piece of shared code)

| Code | Owner | Others |
|---|---|---|
| the cursor (`logic/next-quest.ts` `nextQuestAfter`) | F-QUEST-002 (exists); R-4a adds `skipQuestIds` | F-PLC-001 P-5's mission-builder change passes `skipQuestIds` (no second cursor); `logic/my-route/cursor.ts` only wraps it |
| "placed out / known" per quest | `logic/my-route/pips.ts` `pipStateOf` (R-1a) | F-PLC-001 P-7's `logic/placement/cell-look.ts` imports it (thin adapter for `GridCell`), amendment AM-13 |
| `GridCell` | F-STORY-005 5.5a (`journey-cells.ts`) | then F-PLC-001 P-7, then F-QUEST-002 Q-9; F-ROUTE-001 none |
| stage completion (`completionState`) | F-QUEST-002 (exists) | latch: this spec (R-W1, R-1b); card award: F-STORY-006 |
| Home stack order | this spec (6.4) | edits by F-STORY-004 4.4a, F-LAYOUT-001 5c, F-PLC-001 P-7, F-PLAN-002 P2-7a, F-STORY-006 6.5c, R-4b, F-FEEDBACK-001 FB-8 (row 2a) |

### 6.4 Home stack order (one table, referenced by the other specs)

| # | Block | Owner | Shown when |
|---|---|---|---|
| 1 | greeting and streak (existing) | Home | always |
| 2 | Today mission cards | F-STORY-004 4.4a | always |
| 2a | notes card (a new note from a teacher or the family) | F-FEEDBACK-001 FB-8 | an unread live note exists for the active profile and `flags.notesEnabled` is on |
| 3 | story card | F-STORY-004 | a reviewed story exists |
| 4 | **one** quiet card: the level-check card, else the weekly-plan prompt | F-PLC-001 P-7 / F-PLAN-002 P2-7a | level-check card while eligible; plan prompt per AM-6 |
| 5 | **My route strip** (with "Week N of your weekly plan" when a plan exists) | R-4b | flag on |
| 6 | Homework card | Home | as today |
| 7 | catch-up card | F-STORY-006 6.5c | session-only |

Wide (F-LAYOUT-001 5c): blocks 1-3 in the left column, 2a and 4-7 in the right.

## 7. Dependencies (status at `27c771c`)

- **On main:** `logic/journey.ts`, `logic/next-quest.ts`, `logic/stage1/completion.ts`, F-PLC-001 P-3 (`effectiveRoute`, `RouteSeed`), F-PLAN-002 P2-2 (`routeCatalogOf`, `CATALOG`, frozen fixture), F-LAYOUT-001 PR 1 / 2a / 4, F-I18N-001 PR 6a / 6b / 7a, `Progress` and `Pill`, `colors.stage`.
- **Not on main:** F-PLC-001 P-4 (worktree `plc-p4`), P-5 (`recordPlacement`, merge, summarize, mission-builder), P-6, P-7, P-8; F-PLAN-002 P2-3 onward; F-QUEST-002 Q-6a..Q-9; F-LAYOUT-001 5a (worktree `layout-pr5a`), 5c; F-STORY-004 4.4a; F-STORY-005 5.5a; F-STORY-006 (worktree `story-pr61`); i18n PR 8a (#172).
- **External:** es / ko review of the strings; the design pass for `PipRow` and the border token; owner answers (section 9).

## 8. Decisions

Binding owner decisions applied: **D1** audience any age; **D2/D8** all copy through messages; **D3** anti-shame; **D5** nothing new is gated, no commerce words on learner screens; **D7** no raster art, no emoji; **D9** the 7 x 5 grid is authoritative; **D12** layout classes; **2026-10-10** reading, listening, writing only (section 10).

Spec decisions (reversible, engineering only; product calls are in section 9):

| # | Decision | Why |
|---|---|---|
| M1 | Derived view-model; one additive latch; one per-device UI key | offline, cannot drift; the latch keeps earned "Complete" |
| M2 | Pips are drawn shapes in a collection, never a bar or a ratio | a growing denominator must not make a filled row look emptier |
| M3 | `known` and `new` are their own pip states; `known` is its own stage state | placed out is not done; joined content is not a loss |
| M4 | One cursor (`nextQuestAfter` + `skipQuestIds`); one ordered list | Home, Results and the page agree |
| M5 | Skill rows are an inventory of finished quests, earned marks plus a reachable next slot only | no skill is measured; no permanent empty slots |
| M6 | Tolerant wire field, computed in sync-store | a bad summary must never block sync |
| M7 | Own directories `screens/my-route/`, `logic/my-route/` | F-PLAN-002 owns `screens/route/` |

## 9. Owner decisions and assumptions

**Owner decisions** (one list for this spec and the amendments; each has a default that applies if unanswered, and gates only the named PRs):

**Answered 2026-10-12 (owner):** OD-12 and OD-13 are accepted as proposed (rows below). Their gates on F-PLAN-002 P2-3b, P2-6b and P2-7b and on the amendments are lifted; those rows now wait only for their code dependencies.

| Id | Question | Default | What it changes | Gates | Reversible |
|---|---|---|---|---|---|
| OD-1 | Sound-guide default before the level check (F-PLC-001 assumption 11; gap G6) | (c) hiding the guide is an explicit first choice with no pre-selection, plus honest result copy for not-tested runs (AM-14) | whether most learners get a real reading level | F-PLC-001 P-6 (and P-4 only if (b) is chosen: an amendment PR to merged `assessment/select.ts` / `placement/rungs.ts` plus a bank change, about 1 M PR) | yes |
| OD-2 | Where My route lives | **superseded 2026-10-11 by LR-OD-2** (Route tab; the root-stack screen stays for grown-up use and is always read-only) | entries only | R-3 entries, LR-4 | yes |
| OD-3 | Replace Home's "Stage 1 progress" bar with the strip | replace | Home | R-4b | yes |
| OD-4 | Free-tier stages on the cursor and the page | keep today's Home and Journey behaviour: every shipped stage is playable (Stage 2 / 4 tastes stay on Home's cursor). Consequence: the Results "Next up" teaser, which used to stop at Stage 1 for a free learner, now also teases the Stage 2 taste after Stage 1 (F-QUEST-002 §3.5 amended in R-4a) | what free learners are offered on Home and Results; alternative skips unentitled stages everywhere (then the page shows "Not open yet" and Results teases nothing past Stage 1) | R-4a | yes |
| OD-5 | Skill mapping | Read = decoding kinds; Write = trace games only; tiles = grown-up "Spelling with tiles"; thresholds `[1,2,4,6,8]` | the three rows | R-1a `skills.ts` | yes (one constant) |
| OD-6 | Stage latch | additive `stageDoneAt` (earned "Complete" stays) | snapshot field, Worker preserve rule | R-W1 | additive only |
| OD-7 | Naming | **amended 2026-10-11 (LR-OD-1):** "Learning Route" = the map; "weekly plan" = every dated plan (class, school, family or own) in learner and grown-up copy, never "family plan" or "class plan" (the paid product is the family plan) | strings in both specs | R-0 strings, FP-B15, LR-1 | yes |
| OD-8 | Journey "Premium" pill (`JourneyScreen.tsx:104`) | show the availability word instead; "Soon" becomes "Coming later" | Journey copy | R-J | yes |
| OD-9 | The defined level per skill | v1: reading and listening = Stage 1 complete (Hangul Check met); writing = the Stage 1 trace games; speaking = not in this version (roadmap) | goal line, can-do lines | R-3 goal line | yes |
| OD-10 | Stage 2 anchor (60 or 200 words) | no number shown anywhere | nothing in v1 | — | yes |
| OD-11 | `summary.journey` visible to class teachers (not only family organizers); skills stay local | yes, like `stage1` | console | R-8, R-9a | yes |
| OD-12 | Default plan length rule (thresholds 4 and 16 weeks) | **Decided by the owner (2026-10-12): accepted as proposed.** The length rule of `AMENDMENTS-PLC-PLAN-HANDOFF.md` section 1 applies with `DEFAULT_SHORT_MAX = 4` and `DEFAULT_TERM_MAX = 16` weeks (recommended 4 / 12 / 26 weeks) | proposal | F-PLAN-002 P2-3b, P2-6b (no longer gated) | yes |
| OD-13 | Pace: three chips (Gentle 2 / Steady 3 / Brisk 4); default Gentle for "Pictures first" and for classes, Steady otherwise (self moves from 4 to 3); a positive "Hoya check-in" after week 4 | **Decided by the owner (2026-10-12): accepted as proposed.** `PACES = { gentle: 2, steady: 3, brisk: 4 }` sessions a week; default `gentle` for "Pictures first" (levelOrder 0) and for classes, `steady` otherwise (self moves from 4 to 3); the positive Hoya check-in once at the start of week 5 (`AMENDMENTS-PLC-PLAN-HANDOFF.md` section 1.1, F-PLAN-002 section 3.7) | proposal, presets | P2-3b (chips), P2-6b, P2-7b (check-in) (no longer gated) | yes |
| OD-14 | One-tap plan for a **self** profile on any device (also a family or PIN device); a child profile only through the grown-up | yes | result strip visibility | F-PLC-001 P-7b | yes |
| OD-15 | Start day "Today" for self and family | yes | proposal | P2-7a | yes |
| OD-16 | After "Not now" / "Just start", hide the plan prompt until the next placement result or 14 days | 14 days | Home card, strip | P2-7a | yes |
| OD-17 | May a child answer the Hoya check-in alone (F-PLAN-002 section 3.7, "A child's plan")? | no: on a child profile the check-in shows only while plan changes are open (`planChangesOpen`, the Profile row rule), so a grown-up opens it | the check-in on child profiles | F-PLAN-002 P2-8b (the `routeEnabled` flip waits for an answer; the default is what ships until then, with the flag off) | yes |

**Assumptions to verify** (with the PR that verifies each):

| # | Assumption | Verified in |
|---|---|---|
| a | 20 dp drawn pips are distinct at 320 dp, 200 % text, greyscale and protanopia | R-2b design pass |
| b | a border token at 3:1 on `surface.paper` fits the palette | R-2b, `design-token-sync` |
| c | Q-6a fills `teaches` for quests 1-3 in `catalog/data.ts` | R-7a |
| d | `route-map-ui` through `platform/storage.ts` is acceptable for a UI key | R-1b |
| e | the roster card has room for the strip at 280 px | R-9a |
| f | the hand-estimated plan lengths (amendments 1.2) match the generator | F-PLAN-002 P2-3b goldens |
| g | `.optional().catch(undefined)` drops a malformed `journey` in the repo's zod version | R-8 backend test |
| h | the latch writer ships in a build before Stage 1 grows | release checklist, R-10 |

## 10. Later: speaking (plan only; out of scope for UI now)

Owner decision 2026-10-10: the service focuses on reading, listening and writing. Nothing in this feature shows, counts or mentions speaking. This section only records the plan for future development (the same text, slightly longer, is `docs/roadmap/speaking-later.md`):

- **Pronunciation support through what already exists.** Every taught item keeps romanization and its audio (CLAUDE.md section 1; F-CNT-002, F-AUDIO-004). A later spec may add spoken forms (sound-change notes such as 국물 -> [궁물]) as listening aids. No scoring.
- **Teacher- and parent-assisted practice.** A later spec may give teachers (F-TCH-004 lecture mode) and parents an off-screen "say it together" activity, recorded by the grown-up as done, never scored by the app.
- **Possible future work.** Voice Echo (`voice-echo`, behind `flags.voiceEchoEnabled`, default off, `config/flags.ts:30, 66`) stays off. Any speech recognition needs its own spec, the T-013 decision, child-privacy review (no audio leaves the device without verifiable consent) and evidence that recognition works for young learners' voices. A speaking skill row would be added to `SKILL_OF_KIND` only then, as a new owner decision.

---

## Appendix A — what each stage builds and the can-do line (static intent; no numbers)

From the stage titles and anchors (`apps/mobile/src/content/stages.ts:9-61`). Design intent shown as chips, not a claim that content exists.

| Stage | Title | Builds | `stage.canDo.<n>` (draft) |
|---|---|---|---|
| 1 | Hangul | Read, Listen, Write | "Read any Hangul letter and syllable and know its sound." |
| 2 | Words | Read, Listen, Write | "Read everyday words and know what they mean." |
| 3 | Sentences | Read, Write | "Read and build short, simple sentences." |
| 4 | Dialogue | Listen, Read | "Follow a short greeting conversation and pick a reply." |
| 5 | Stories | Read, Listen | "Read a short story from start to end." |
| 6 | Real-use | Read, Write | "Read menus, signs and short messages." |
| 7 | Self-expression | Write | "Write a few sentences about daily life and favorite things." (no "you": the grown-up view shows the same line) |

## Appendix B — draft English strings (final copy is the dictionary's)

[LR-A2] Values as amended 2026-10-11 (the old values are in `AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 7.2; new keys of the route card are in its section 11.1).

`learner.myRoute`: `title` "Learning Route" · `purpose` "Where you are and where you are going." · `open.cta` "See Learning Route" · `hero.start` "Your Learning Route starts here." · `hero.goal` "Your first goal: read every Hangul letter." · `hero.here(n, title)` "You are on Stage {n}: {title}." · `hero.next(title)` "Next: {title}" · `hero.cta.start` "Start" · `hero.cta.continue` "Continue" · `hero.rest` "You did everything that is open right now. More is coming." · `hero.beyond` "You know a lot! More adventures are coming." · `cta.stories` "Open stories" · `cta.library` "Open Library" · `state.complete` "Complete" · `state.known` "You knew this" · `state.explored` "Explored" · `state.open` "Open" · `state.taste` "A taste" · `state.later` "Coming later" · `state.notOpen` "Not open yet" (OD-4 alternative only) · `tag.here` "You are here" · `tag.start` "You started here" · `cell.playing` "Playing" · `caption.played(n)` "{n} quests played" · `caption.ready` "Ready when you are" · `caption.explored` "You explored everything that is open right now" · `caption.newJoined` "New quests joined" · `canDoLead` "By the end of this stage you can:" · `stage.canDo.<n>` (Appendix A) · `laterGroup(from, to)` "Stages {from} to {to}" · `newQuests(n, stage)` "{n} new quests joined Stage {stage}." · `skills.title` "What your quests practice" · `skill.read` "Read" · `skill.listen` "Listen" · `skill.write` "Write" · `skill.quests(n)` "In {n} quests you finished" · `plan.week(n)` "Week {n}" · `plan.next(title)` "Next in your weekly plan: {title}" · `plan.open` "Open plan" · `plan.starts(date)` "Your weekly plan starts on {date}." · `plan.finished` "Your weekly plan is finished." · `plan.new` "Make a new plan" · `plan.offer` "Hoya can make a weekly plan for you" · `storiesNote` "Heritage stories are open any time." · `home.strip.week(n)` "Week {n} of your weekly plan"

`caregiver.journey` (viewer `grownup`): `here(name, n, title)` "{name} is on Stage {n}: {title}." · `started(name)` "{name} started here." · `known(name)` "{name} already knew this." · `quests(name, n)` "In {n} quests {name} finished" · `viewing(name)` "Viewing {name}'s Learning Route" · `tiles(n)` "Spelling with tiles: {n} quests" · `caregiver.skillsNote` (section 3.12)

Added in R-1b (the grown-up twin of every learner sentence that says "you"; the selectors and `GrownupJourneyMessages` in `logic/my-route/copy.ts` need them): `next(title)` "Next: {title}" · `canDoLead(name)` "By the end of this stage, {name} can:" · `start(name)` "{name}'s Learning Route starts here." · `goal` "First goal: read every Hangul letter." · `rest(name)` "{name} did everything that is open right now. More is coming." · `beyond(name)` "{name} knows a lot! More adventures are coming." · `hereTag(name)` "{name} is here" · `ready(name)` "Ready when {name} is" · `explored(name)` "{name} explored everything that is open right now" · `skillsTitle(name)` "What {name}'s quests practice". `a11y.myRoute.stageGrownup(name, order, title, stateWord, here, start, played)` is the grown-up row label. Learner words that never say "you" (state words, `cell.playing`, `caption.played`, `caption.newJoined`, `laterGroup`, skill labels, `stage.canDo.<n>`) are shared by both viewers.

`console.journey`: `title` "Learning Route" · `onStage(n)` "On Stage {n}" · `stageLine(known, done)` "{known} known from the level check, {done} quests done" (known part omitted when 0)

`a11y.myRoute.stage(order, title, stateWord, here, start, played)` composes the row label.

## Appendix C — worked example (frozen 8-quest bundle fixture)

A learner has done `quest:stage1-letters-q1..q3` and `quest:stage1-life-q1`, no placement, default entitlement:

- Cursor `quest:stage1-life-q2`. Hero `continue`: "You are on Stage 1: Hangul." / "Next: Family at the Table" / **Continue**.
- Stage 1: `open`, `here`; pips: four discs, four rings; caption "4 quests played". Stage 2: `open`, word **A taste**, 2 ring pips + 3 dotted pips, "Ready when you are". Stage 3: compact "Coming later" row. Stage 4: **A taste**, 1 ring + 4 dotted. Stages 5 to 7: one merged "Coming later" row.
- Practice: Read in 4 quests -> 3 marks (1, 2, 4 reached), next slot shown (8 reading quests are open, threshold 6 reachable); Listen the same; Write in 1 quest -> 1 mark, no slot (only one trace quest exists). Grown-up only: Spelling with tiles 2 quests.
- Summary: `{ v: 1, here: 'stage1', stages: [{ stage: 'stage1', state: 'open', done: 4, known: 0, total: 8 }, { stage: 'stage2', state: 'open', done: 0, known: 0, total: 2 }, ...] }`; strip text "On Stage 1", "4 quests done".

## Review log

Independent review applied 2026-10-10 (`docs/roadmap/spec-review-route-001.md`, 63 findings: 2 blockers, 39 majors, 22 minors). Every blocker and major is fixed. Findings not applied as written, and why:

| Finding | Outcome | Reason |
|---|---|---|
| UX blocker: false "speaking is practiced" sentence; proposed two-sentence replacement and a copy test tied to `voice-echo` | fixed differently | superseded by the owner decision: no speaking text at all; the skills note covers reading, listening and writing; a copy test bans speaking words instead |
| UX: "Speaking is not in the app yet" line for Stages 4, 6, 7 (can-do finding, oneLiner finding) | rejected (that part) | owner decision; the can-do lines and the no-digit captions are applied |
| UX: Speak row sheet and mic glyph | superseded | no Speak row; `mic` dropped from R-2a |
| UX: skill ladder test "at least 4 of 5 pips on each skill with content" | adapted | there is no fixed row of five any more; the invariant is "no visible slot is unreachable", and the next slot appears only when reachable |
| Scope: rename the page "Where I am" and keep "route" for the plan | rejected, recorded as the alternative of OD-7 | CLAUDE.md section 1 names the learner's Route on the grid; F-PLAN-002's learner screens are not built, so renaming the plan copy ("weekly plan") costs least; the ribbon reduction from the same finding is applied |
| UX: drop dots but keep a week-pip strip "for weeks on your route" | rejected (strip) | it still fills with calendar time; one text line is enough |
| Scope: v1 entries Home strip and result link only | adapted | the Journey header button stays as the first entry because the Home strip waits on OD-3 and two Home rewrites, and the result link waits on P-6; the Profile row is dropped; the parent row moves to M3 |
| Data: delete `cell-look.ts` from F-PLC-001 | adapted | P-7 owns the `GridCell` look; `cell-look.ts` stays as a thin adapter over `pipStateOf`, so there is one predicate |
| UX: "Not included" line once per class page | adapted | the roster carries no tier (`api.ts:25-34`) and `locked` is dropped from the wire, so v1 shows no such line at all |
| UX: Journey Open / Taste / Soon renamed to the My route set | partial | "Soon" -> "Coming later" and "Premium" removed (R-J, OD-8); "Taste" stays as availability ("A taste" on both screens) because it describes content, not the learner |
| R-J review: unentitled stage header still a button announced "locked. Opens the unlock page." that opened PIN then Paywall | fixed in R-J | with the Premium pill gone it was an invisible lock-for-payment door (section 3.3); the header is a plain row on the learner Journey, plans stay reachable from the grown-up area (Profile) |
| R-J review: episode-level "Coming soon" (episode page, its pane, the grid cell label, preview subtitles) | deferred | R-J and OD-8 cover the stage pill only; the episode-level words are F-STORY-005 content and change in one sweep with their tests |
| UX: pace "Hoya check-in after week 4" in v1 | deferred | recorded as OD-13 (accepted by the owner 2026-10-12) and placed in P2-7b, not in the one-tap path |
| Data: R-7a after Q-6b | changed to Q-6a | Q-6a delivers quests 1-3 with the first non-empty `teaches` (`F-QUEST-002` line 454); scope finding agrees |
| R-8 review: a device missing another device's `stageDoneAt` latch uploads a journey whose stage is not yet `complete` while the Worker keeps the latch | accepted | `summary` is the client aggregate by design (no server recompute); the stale state lasts until that device pulls the merged payload on its next conflict and re-summarizes; an old build next to a new one also makes `journey` come and go. The R-9a strip must not treat a missing journey as "no progress" |
| R-8 review: log or count a failed `journeySummaryOf` | adapted | app code has no console or error channel (CLAUDE.md) and a telemetry name needs its own spec row; instead `content/__tests__/sync-context.test.ts` runs it over the live bundle for an empty and a full learner, so a bundle change that breaks it fails CI |
| R-7a review: tag fallback on the highest stage with a `known` pip | adapted | the fallback is the highest stage holding a placed-out quest (known, or done since); a known-only rule would move or drop the tag as the learner finishes those quests, breaking "start fixed while quests are completed" (section 3.6 updated) |
| R-7a review: `here` with nothing done came from a separate catalogue lookup of `startQuestId` | fixed in the R-7a follow-up | a learner placed past every quest, or at a stage the tier lacks, had `here` on Stage 1 while the tag sat higher, and the console read "On Stage 1"; `here` now uses the one start marker (section 3.3) |
| R-7a review: the start also moves with a bundle update or a tier change, which the R-7a text did not say | adapted (documented) | the start follows today's bundle and tier, like `effectiveRoute`, so the pip agrees with where play begins; anchoring it apart from the route would show a start the app does not use. Section 3.6 and the code comment say so; tests pin both cases |
| R-7a review: the console cannot tell a journey built before R-7a (known always 0) from a new one; deploy order between R-7a and R-9a | fixed (producer side) | `JourneySummarySchema` gains the optional `seeded: true` marker, and `journeySummaryOf` sets it; the R-9a strip reads it (section 3.12). R-7a reached main before R-9a, so the PWA builds that carry it deploy first |
| R-7a review: per-stage `known` counts are new level-check data while `placement` is documented "newest result, no counts" | accepted, no consent change | the counts are stage-level and come from the level check, which the teacher already sees under the "Level check results" item (`placement` maps to `level_check`); recorded in F-PLC-001 section 8 (P21); the transfer-consent test pins that `placement` stays on the allow-list mapped to `level_check` |
| R-7c review: lit rule "`symbolsMetThrough` the furthest finished Stage 1 quest" | adapted | all of Stage 1 is open (free tier, unlocked curriculum), so out-of-order play is normal; the furthest-quest rule lit letters never taught (finishing the last letters quest lit all 30) and turned placed-out letters lit. A letter is lit when a finished quest teaches it; for in-order play this is the same set |
| R-7c: the wall is closed by default behind a ghost "Letter wall" button | adapted | 30 tiles make the open Stage 1 too long on a phone; it opens in place, as the pip legend does |
| R-7c: the wall's romanization shows in every romanization mode | adapted | the letters are taught content (CLAUDE.md section 1), so the sound and the "at the end" gloss always show |
