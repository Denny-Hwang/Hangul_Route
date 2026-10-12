Status: ready

# F-ENT-003 — Free plan to Day 2, everything open for subscribers, and one "next" that follows the learner's own plan

> **Status note.** `ready` means: every behaviour below is decided, each owner question in section 9 has a default that applies until the owner answers, and no answer blocks a PR outside the rows it names. Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` below is at that commit.
>
> **Owner request 2026-10-11 (binding), items 9 and 10.** Item 9: "Free plan: show a bit more — learnable up to about day 2." Item 10: "Subscribers: do not lock the content; show the whole content, but make it intuitive to learn along their own configured curriculum." This spec turns both into rules. Item 11 (the LEARNING ROUTE map), item 12 (billing only on app.hangulroute.com) and item 14 (grown-ups browse the content as the learner sees it) are sibling specs of the same request; this spec gives them one access predicate and one "next" function and does not build their screens.
>
> **Standing rules that bind this spec.** Stripe Live, real prices on public pages and commercial claims stay off until the owner says (sandbox only). Child safety: the learner never sees a price, a purchase button or the word "Premium"; every commerce step sits behind the grown-up gate. Anti-shame: nothing earned is ever taken away, no countdown, no "trial ended", no red. All copy through `packages/i18n` (English default, Korean and Spanish overlays for native review). Tokens only, no emoji. Reading, listening and writing only.

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a design mock and a wireframe)**

| Can start when | PR | Waits for what | Why |
|---|---|---|---|
| now | E3-0 docs | — | this spec, seven wireframes, amendment lines in F-ENT-001, F-STORY-004, F-ROUTE-001, F-PLAN-002, telemetry rows |
| after E3-0 | E3-1a route days, E3-1b telemetry names, E3-D design mock | E3-0 merged | new files only; E3-1b deploys the Worker whitelist first |
| after E3-1a | E3-2 access logic | — | pure module, no UI, identical behaviour with the switch off (golden) |
| after E3-2 | E3-3 cursor and plans, E3-4 route next | — | logic only |
| after E3-1b deployed, E3-3, E3-4, E3-D | E3-5 Journey, E3-6 episode page, E3-7 Home and Library | design mock of the markers | the first PRs that draw something |
| after E3-2 (E3-8) or E3-1a (E3-9) | E3-8 paywall, E3-9 console wizard | OD-9 wording (default applies) | grown-up surfaces |
| after F-ROUTE-001 R-3 (#317) merges | E3-10 route page hero | the route screen exists | amendment to a screen that is not on main yet |
| last | E3-11 e2e and runbook | all of the above | the switch is flipped only by the owner (OD-2) |

**Scope**: `packages/content-schema` (new `src/catalog/route-days.ts`; optional `CurriculumParams.openQuestIds`; telemetry names) · `packages/backend` (telemetry exact-list test only) · `apps/mobile` (`logic/content-access.ts` quest kind, new `logic/route-next.ts`, `logic/next-quest.ts` optional `isQuestOpen`, `logic/cursor-context.ts`, `logic/homework/{gating,plan-derivation,mission-builder}.ts`, `logic/quest-flow/results-teaser.ts`, `store/{tier-store,plan-store}.ts`, `screens/{journey,episode,home,library,results,paywall}`, `config/flags.ts` doc comment) · `apps/web` (`lib/console/config.ts` `contentGatingEnabled()`, `lib/console/curriculum.ts`, wizard warning) · `packages/i18n` (`learner.access`, `learner.routeNext`, `caregiver.paywall.freePlan`, `console.curriculum.freeDays`, `a11y.access`) · `design/wireframes` (seven files, section 3.13)
**Owner**: solo dev
**Rollout**: guidance (item 10) ships to every learner as soon as its PRs merge; the free boundary (item 9) is built, tested and reviewable in preview builds, and is switched on in production only by the owner, in the same release as Stripe Live (OD-2). Milestones in section 6.0.

Parent / siblings: F-ENT-001 (tier from memberships, paywall §3.5, console billing §3.6) · F-STORY-004 §3.9 (the free-content registry, D5, `contentGatingEnabled`) · F-PLAN-002 (the curriculum, the self plan, precedence §3.6 and §3.10, the shared catalogue) · F-PLAN-001 (plans and device derivation) · F-ROUTE-001 (the one cursor, `cursorContext`, OD-4, R-J; the route page) · F-QUEST-002 (Stage 1 lessons, the cursor's order) · F-HW-001 (Home's three cards, the day pin) · F-PLC-001 (placed-out quests, the start quest) · F-LEARN-001 (`gateRequired`, the grown-up gate) · F-I18N-001 (messages) · F-SUB-001 (legacy subscription fallback) · owner items 11, 12, 14 of 2026-10-11 (sibling specs)

---

## 1. Context

### 1.1 What the code does today (verified at `ea9049e4`)

- **Two tiers, no "day".** A learner is `free` or `premium` (`apps/mobile/src/logic/entitlement.ts:15`). Premium comes from the server per learner (`tierForLearner`, F-ENT-001 §3.2) through the inbox and the device cache (`store/tier-store.ts:56`, 7-day offline grace), or from the legacy monthly or yearly subscription in `account-store` (F-SUB-001). Nothing counts days, quests or minutes.
- **The free set is a registry.** `logic/content-access.ts:25-26`: `FREE_STAGE_KEYS = ['stage1']`, `FREE_VOCAB_TOPIC_IDS = ['food', 'animals', 'colors', 'numbers']`, plus stories whose `shelf.sampler` is true (six are flagged in `catalog/data.ts:118-127`). `isContentLocked` (`:58-66`) locks only stories and word topics, and only when `flags.contentGatingEnabled` is on; it is off by default (`config/flags.ts:91`).
- **Self-play is open to everyone.** `isStagePlayable = () => true` (`entitlement.ts:40`); `CURSOR_STAGE_RULE = 'shipped'` (`cursor-context.ts:32`); Journey draws no lock and no Premium pill (`JourneyScreen.tsx:109-114`, R-J #273); every cell opens `EpisodeDetail` and every quest row has a Start button (`EpisodeDetailView.tsx:186-193`). A free learner can play all 12 bundled grid quests (9 Stage 1, 2 Stage 2 tastes, 1 Stage 4 taste).
- **Stage-level gating survives in four places only**: plan derivation (`store/plan-store.ts:46-48` `unlockedStagesFor` -> `logic/homework/gating.ts:45`, a free learner's assigned Stage 2+ quest is `notReady`), the placement start quest (`PlacementScreen.tsx:300`), card earn hints (`CardDetailView.tsx:274`) and the story pick for grid stories (`logic/story/story-pick.ts:180`). The console wizard schedules Stage 1 only for an unlicensed space (`apps/web/src/lib/console/curriculum.ts:232`).
- **The promise in copy is "Stage 1 is always free"**: paywall bubble (`packages/i18n/src/messages/en/caregiver.ts:144`), F-ENT-001 §3.5, the landing pricing aside (pinned by `apps/web/src/app/__tests__/landing-claims.test.tsx`).
- **"Next" is the route cursor, not the learner's plan.** `nextQuestAfter` (`logic/next-quest.ts:51-58`) walks the playable grid quests in content order. Home card (2) shows today's plan assignment when there is one (`assignment-merger.ts:35-45`, precedence teacher > parent > self) and otherwise the cursor; the Results "Next up" teaser always shows the cursor (`results-teaser.ts:79`). A learner whose plan puts a later lesson first (themes order later stages, F-PLAN-002 §3.3 step 4) sees two different "next" quests on two screens, and nothing on the Journey says which cells the plan holds.
- **The default curriculum exists.** `generateCurriculum` (F-PLAN-002 P2-3a, `packages/content-schema/src/curriculum/generate.ts`) with a level of `stage1` band 0 schedules the Stage 1 lessons in canonical order: `letters-q1..q3`, then `life-q1..q3`, then rites, nature, crafts (golden A, F-PLAN-002 §3.4). The shared catalogue lists the cells in that order (`catalog/data.ts:39-44`).

### 1.2 What this spec decides

1. **A route day** is one playable lesson of the default route: one grid cell, about 15 minutes, in route order. Day 1 is "Meet the Letters" (`letters-q1..q3`, 15 minutes, 12 letters), Day 2 is "Around the Korean Table" (`life-q1..q3`, 12 minutes, 6 more letters). The free plan is **Day 1 and Day 2** (`FREE_ROUTE_DAYS = 2`, OD-1), plus the six sampler stories and the four free word topics that D5 already names.
2. **Free learners see the whole route.** Nothing is hidden: every lesson after Day 2 keeps its cell, its title, its Hoya intro, the letters it teaches and the cards it gives. Its page shows them and one quiet line, "This lesson opens with the full route", with one grown-up button. Quests a learner already finished stay playable forever.
3. **Subscribers see no lock, no marker of access, anywhere.** Instead the app shows one thing: where their plan goes next. "Next" comes from the learner's active plan (class, then family, then their own), else from the default route. Lessons outside the plan stay fully open and look like every other lesson.
4. **One switch.** `contentGatingEnabled` becomes the single switch for every free-tier limit (grid quests past Day 2, stories, word topics). It stays **off in production** until the owner turns on Stripe Live (OD-2); with it off, every learner gets exactly today's access, plus the plan guidance of item 10.
5. **Nothing changes on the server.** No D1 migration, no entitlement change, no inbox field. Old apps, old consoles and every stored entitlement keep working (section 3.10).

Terms. **Route day** (or **day**): one entry of `routeDaysOf(catalog)` (section 3.1); a content unit, never a calendar day. **Free days**: the first `FREE_ROUTE_DAYS` route days. **Open**: a quest the learner may start. **Kept**: a quest the learner finished before, which stays open whatever the tier. **Closed**: a playable quest a free learner may not start while the switch is on; its page is a **preview**. **Active plan**: the learner's pending plan assignments (`snapshot.homework` from `plan:` and `route:` sources, F-PLAN-002 §3.6). **Next**: the result of `routeNext` (section 3.5). **Off-plan**: an open quest that is not in the active plan.

## 2. User story

> As a family trying Hangul Route, I want my child to really learn something before we decide — the first letters, real quests, real cards — and to see everything the full route holds, so that we know what we would get, without anything being taken away if we wait.

Companion stories:

- As a **learner on the free plan**, I want to finish my first two days of lessons and then see, calmly, that the next lessons open with the full route, and to keep playing everything I already finished.
- As a **subscriber** (a paid family, or a learner in a licensed class or school), I want every lesson open with no lock or label in my way, and the app to show me the next step of my own plan on Home, on the Journey, on the lesson page and after every quest, so that I never have to work out where I am.
- As a **learner who wanders**, I want to play any open lesson outside my plan without a warning, and afterwards be shown the way back to my plan.
- As a **parent**, I want the paywall to say exactly what is free (Day 1 and Day 2, six stories, four word topics) and what the full route adds, behind the grown-up gate.
- As a **teacher with a free class**, I want the curriculum wizard to tell me which items would not open for my class, before I publish.
- As a **maintainer**, I want one predicate for "may this learner start this quest", one function for "what is next", and a switch that leaves today's behaviour bit-for-bit when it is off.

## 3. Acceptance criteria

### 3.1 Route days (`packages/content-schema/src/catalog/route-days.ts`, pure, 100 % covered)

```ts
export interface RouteDay {
  day: number;                 // 1-based
  stage: StageKey;
  theme: ThemeKey;
  episodeId: string;
  questIds: readonly string[]; // the cell's lesson quests, in cell order
  minutes: number;             // sum of the quests' catalogue minutes
}
export const FREE_ROUTE_DAYS = 2;
export function routeDaysOf(catalog: Catalog): RouteDay[];
export function freeRouteQuestIds(catalog: Catalog, days?: number): ReadonlySet<string>;   // default FREE_ROUTE_DAYS
export function routeDayOfQuest(catalog: Catalog, questId: string): number | null;         // null: not a grid lesson
```

- **Order** = the default route: stages 1 to 7, and inside a stage the canonical theme order letters, life, rites, nature, crafts (the order of `catalog.cells`, which is also `routeCatalogOf(catalog).order` and the generator's order for `stage1` band 0 with no theme preference, F-PLAN-002 §3.3 step 4). A theme preference or a placement never changes the days: days are a property of the content, the same for every learner.
- **One day per playable cell**: a cell counts when its status is `shipped` or `ready` and it has at least one lesson quest (`kind: 'lesson'`). Preview cells are not days. Story quests (`kind: 'story'`) are never in a day.
- **Today** (`CATALOG_VERSION` 3): Day 1 `stage1-letters` (3 quests, 15 minutes), Day 2 `stage1-life` (3 quests, 12 minutes), Day 3 `stage1-rites`, Day 4 `stage1-nature`, Day 5 `stage1-crafts`, Day 6 `stage2-life`, Day 7 `stage2-nature`, Day 8 `stage4-rites`.
- **Free days today**: `quest:stage1-letters-q1`, `-q2`, `-q3`, `quest:stage1-life-q1`, `-q2`, `-q3`. They teach 18 letters (ㅏ ㅓ ㄱ ㄴ ㅗ ㅜ ㅁ ㅇ ㅡ ㅣ ㄷ ㄹ ㅈ ㅊ ㅂ ㅅ ㅋ ㅌ, `catalog/data.ts:84-89`) and award six cards (`card:book`, `card:hanji`, `card:brush`, `card:kimchi`, `card:family-table`, `card:kimbap`; `content/quests.ts:50-247`).
- **Stable while content grows.** F-QUEST-002 Q-7b and Q-8 grow the rites, nature and crafts cells to three quests each; Days 1 and 2 do not move. A test pins the six free quest ids on the live catalogue with the message "The free days changed: update F-ENT-003 section 3.1 and the paywall copy in the same PR"; a second test pins the eight days on the frozen fixture (`__tests__/fixtures/catalog-2026-10.ts`).
- **Against the default curriculum** (documentation, asserted by a golden test): with `stage1` band 0 and no story ready, Day 1 and Day 2 are the first six items of the default self plan (pace `steady`, 3 sessions a week: weeks 1 and 2) and of the default class plan (2 sessions a week: weeks 1 to 3).
- Exported from `src/catalog/index.ts` and `src/index.ts` (append-only lines).

### 3.2 Who gets what

| Learner | Switch off (production default) | Switch on |
|---|---|---|
| premium (family lifetime, licensed class or school, legacy subscription, cached premium, OD-11) | everything open; plan guidance | everything open; plan guidance; **no access marker anywhere** |
| free | everything open (today's behaviour); plan guidance | Day 1 and Day 2 open; later lessons visible as previews; kept quests open; six sampler stories and four word topics open; plan guidance over open quests |

- **Free learners in a free class or a family space without a purchase** follow the free row (OD-5). Their teacher's or parent's items past Day 2 derive as `notReady` (section 3.6) and the console says so before publishing (section 3.9).
- **Placed-out quests** (F-PLC-001) are not kept and not opened by the level check: a free learner placed into Stage 2 still has Day 1 and Day 2 open, and the cursor's existing "only placed-out quests left" fallback (F-ROUTE-001 §3.5) offers them.
- **Kept** = the quest has `completedAt` in the learner's snapshot, from any device (sync merges are unions, so a quest finished on a tablet is kept on the phone after the next sync). Its cards and stars are never touched by this spec. A started but unfinished quest is not kept (OD-3).
- **Shelf stories and word topics** keep the D5 rule unchanged (`isContentLocked`), now under the same switch.

### 3.3 Access logic (`apps/mobile/src/logic/content-access.ts`, extended, 100 % covered)

```ts
export type ContentKind = 'stage' | 'story' | 'vocab-topic' | 'quest';           // + 'quest'
export interface FreeContentRegistry {
  stages: ReadonlySet<string>;
  vocabTopics: ReadonlySet<string>;
  samplerStories: ReadonlySet<string>;
  freeQuests: ReadonlySet<string>;   // + freeRouteQuestIds(CATALOG)
}
export type QuestAccess = 'open-premium' | 'open-switch-off' | 'open-free-day' | 'open-kept' | 'open-not-a-lesson' | 'closed';
export interface QuestAccessInput {
  questId: string;
  tier: Tier;
  gatingEnabled: boolean;
  completedQuestIds: ReadonlySet<string>;
  registry?: FreeContentRegistry;
}
export function questAccess(i: QuestAccessInput): QuestAccess;
export function isQuestOpen(i: QuestAccessInput): boolean;          // questAccess(i) !== 'closed'
export function questOpenPredicate(i: Omit<QuestAccessInput, 'questId'>): (questId: string) => boolean;
```

Rules of `questAccess`, first match wins: (1) `tier === 'premium'` -> `open-premium`; (2) `!gatingEnabled` -> `open-switch-off`; (3) `completedQuestIds.has(questId)` -> `open-kept`; (4) `registry.freeQuests.has(questId)` -> `open-free-day`; (5) the quest is not a grid lesson of the catalogue (a story quest, an unknown id) -> `open-not-a-lesson` (stories are decided by `isContentLocked`, section 3.2; an unknown id is never closed by this function, the screens already refuse unknown ids); (6) otherwise `closed`.

- `isFreeContent('quest', id)` reads `registry.freeQuests`.
- `isContentLocked` keeps its signature and result for `story` and `vocab-topic` (golden test).
- **`isStageEntitled(stage, tier)` keeps its signature and result** for every stage and tier (golden test over 7 stages x 2 tiers). It stays the stage-level answer for the callers that need one (placement start, card earn hints, the stage list a plan reads) and is documented as "coarse: a free learner's Stage 1 is entitled, but quests past Day 2 are decided by `isQuestOpen`". `FREE_STAGE_KEYS` keeps `['stage1']` for those callers and for old code paths.
- **`isStagePlayable` stays `() => true`**: it answers "does this stage have content the route may show", not "may this learner start it". The route page and `summary.journey` keep binding it (F-ROUTE-001 §3.2).
- **Golden: switch off.** For every bundled quest x {free, premium} x {done, not done}, `isQuestOpen` with `gatingEnabled: false` is true. With the switch off no surface changes access; only the plan guidance of sections 3.5 to 3.8 is new.

### 3.4 The one switch and the tier used for access

- `flags.contentGatingEnabled` (`EXPO_PUBLIC_CONTENT_GATING_ENABLED`, launch default `false`) now covers grid quests too. Its doc comment becomes: "Turns on every free-tier limit: grid quests past Day 2 (F-ENT-003), non-sampler stories and word topics past the free four (F-STORY-004 D5). Off in production until the owner turns on Stripe Live." The flag name and the env name do not change.
- The console reads `NEXT_PUBLIC_CONTENT_GATING_ENABLED` through `contentGatingEnabled(env)` in `apps/web/src/lib/console/config.ts` (same `'true' | '1'` parsing as the app). It changes only the wizard's preview and warning (section 3.9); the device stays the authority on what opens.
- **Access tier (OD-11).** `accessTier(learnerId)` in `store/tier-store.ts` is `premium` when `effectiveTier` is premium, **or** when the cached inbox tier is `premium` even after its `validUntil` (the last word from the server was premium and no newer inbox has said free). Billing surfaces keep `effectiveTier` (F-ENT-001 §3.4). Reason: a paying family offline for more than seven days must not see lessons close; a lapsed licence closes them at the next successful inbox, which is the moment the server says `free`.
- Every surface that decides access calls one hook, `useQuestAccess()` (in `store/tier-store.ts` next to `accessTier`), which returns `questOpenPredicate({ tier: accessTier(active), gatingEnabled: flags.contentGatingEnabled, completedQuestIds })` for the active profile, recomputed when the tier cache or the snapshot changes.

### 3.5 What "next" means (`apps/mobile/src/logic/route-next.ts`, pure, 100 % covered)

```ts
export type NextSource = 'class' | 'family' | 'self' | 'route';
export type RouteNext =
  | { kind: 'quest'; questId: string; episodeId: string; source: NextSource; assignmentId?: string }
  | { kind: 'free-end' }    // switch on, free, every open quest done, a closed quest exists
  | { kind: 'rest' };       // nothing open is left to do
export interface RouteNextInput {
  snapshot: ProgressSnapshot;
  profileId: string;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  cursor: CursorContext;                       // from cursorContext (F-ROUTE-001 R-4a), now with isQuestOpen
  justCompleted?: string;
}
export function routeNext(i: RouteNextInput): RouteNext;
export function planQuestIds(snapshot: ProgressSnapshot, profileId: string): ReadonlySet<string>;   // pending plan items in the horizon
```

1. **The active plan first.** Take the learner's pending assignments from plan sources (`snapshot.homework`, `profileId` matches, no `completedAt`, id prefix `plan:` or `route:`), sorted by `compareAssignments` (`assignment-merger.ts:34`: teacher, then parent, then the learner's own plan; then the earlier `targetDate`; then the earlier `assignedAt`). Dates are **not** a filter: an item dated Wednesday is the next step on Monday, and an item dated last week is the next step today. Nothing is ever "late". The first item whose quest is known, playable and open is next; `source` maps `teacher` -> `class`, `parent` -> `family`, `system` -> `self`.
2. **Else the default route.** `nextQuestAfter` with `cursor` (the existing one cursor; F-ROUTE-001 M4 holds: `routeNext` wraps it and never walks the content itself), `source: 'route'`.
3. **Else** `free-end` when the switch is on, the access tier is free and some playable grid quest is closed; otherwise `rest`.

- `planQuestIds` returns the quest ids of step 1 (pending, inside the derivation horizon, F-PLAN-002 §3.6 rule 1). It drives the "In your plan" markers (sections 3.7 and 3.8).
- **`NextQuestInput` gains `isQuestOpen?: (questId: string) => boolean`** (additive; omitted = every quest open), applied in `offerableQuests` after `isEntitled`. **`CursorContext` gains `isQuestOpen`**, filled from `useQuestAccess()`. `CURSOR_STAGE_RULE` stays `'shipped'`.
- **Who uses it.** Home card (2) when today has no assignment (section 3.7); the Results teaser (section 3.8); the Journey "Next" marker; the episode page "Next" tag; the route page hero (E3-10; owner item 11's LEARNING ROUTE spec reads the same function). Home's day pin (F-HW-001 §3.2) still holds card (2) for the day.
- **A plan item the learner cannot open** (free, switch on, item past Day 2) is skipped by step 1, never shown as next, and already counted `notReady` by derivation (section 3.6). If every plan item is closed, step 2 offers the open default route; if nothing is open, `free-end`.

### 3.6 Plans, assignments and placement under the switch

- **Derivation.** `DeriveInput` gains `isQuestOpen?: (questId: string) => boolean` (additive; omitted = today's behaviour). `deriveAssignments` treats an item whose quest is closed exactly like a stage-locked item today: not derived, counted in `notReady[source]`, a pending assignment for it is removed by reconcile (F-PLAN-002 §3.6 rule 2). `plan-store` passes the hook's predicate. When the learner later becomes premium, the next derivation (inbox refresh, app start, foreground) derives the item; nothing else is needed.
- **`canAssignQuest`** (`gating.ts:32`) gains an optional `isQuestOpen` and the rejection `'quest-closed'`; the caregiver message `caregiver.gating['quest-closed'](name)` reads "{name} can play this lesson with the full route." (no price, no "Premium").
- **Placement.** `effectiveRoute` keeps its stage-level `isEntitled` (the start marker shows where the level check put the learner, F-ROUTE-001 §3.6). The result screen's primary action starts `routeNext` (always open) instead of `startQuestId` when the start quest is closed (amendment line to F-PLC-001 §3.1 step 7, landed in E3-3).
- **Home fallbacks.** `buildTodaysMission` picks card (1) replays, the `explore` fallback and story cards only among open quests (a replay is always kept, so card (1) never changes for a learner who already played).
- **Story pick.** `story-pick.ts:180` adds `!isQuestOpen(entry.questId)` for grid stories (none is bundled today; the rule is for Stage 5 books).

### 3.7 Screens: Journey, episode page, Home, Library (learner, any age)

**Journey** (`screens/journey/JourneyScreen.tsx`, wireframe `journey/grid-plan-and-access.md`)

- **Next marker.** The cell that holds `routeNext`'s quest carries the drawn `pin` glyph (R-2a); its accessibility label appends "Next". One cell at most. Hidden at `rest` and `free-end`.
- **In your plan.** Cells holding a quest of `planQuestIds` carry a small drawn ring (shape from the E3-D mock, the `border.shape` token) and the label suffix "In your plan". Only while a plan exists; no ring for the default route (the route is the whole grid).
- **Closed cells** (switch on, free): the cell keeps its art, colour and tap; a small drawn `lock` glyph sits in the corner and the label reads "{episode}: opens with the full route. Opens the lesson page." A cell with any kept quest shows no glyph. The stage pill keeps the availability word (R-J); no stage row is ever a lock or a door to the paywall.
- **Subscribers and the switch-off state show no access glyph at all.** Precedence on one cell: Next > In your plan > closed glyph (a closed cell is never Next or In your plan, section 3.5).

**Episode page** (`screens/episode/EpisodeDetailView.tsx`, wireframe `episode/detail-access-preview.md`)

- **Open quest rows** are unchanged. A row whose quest is `routeNext` carries the tag **Next**; a row in `planQuestIds` carries **In your plan** (drawn shape plus word, never colour alone).
- **Preview** (switch on, free, at least one closed quest in the episode): the page shows everything it shows today (pills, title, Hoya intro, the quest list with titles and blurbs, the letters each quest teaches as `KoreanText` chips, the cards to earn). Each closed row replaces its Start button with the caption **Opens with the full route**; kept rows keep **Play again**. Under the list, one card: Hoya `reading`, the line **This lesson opens with the full route.**, the secondary button **Ask a grown-up** -> `PinEntry { next: 'Paywall', from: 'episode' }` (F-LEARN-001 `gateRequired`: a self-only device with no PIN opens the paywall directly), and the ghost link **Back to your lessons** -> the open `routeNext` episode (or Journey at `free-end`). The page has no primary button in preview.
- No price, no "Premium", no "buy", no "trial" on the page. Telemetry `access.preview_opened` once per open (section 3.12).

**Home** (`screens/home/HomeScreen.tsx`, `logic/homework/mission-builder.ts`, wireframe `home/next-and-free-end-card.md`)

- Card (2) order: today's assignment (unchanged, F-HW-001 §3.4) -> `routeNext` quest (subtitle **Next in your plan** when `source` is not `route`, else today's **New**) -> at `free-end` the **free-end card** -> at `rest` today's replay fallback (`mission-builder.ts:120-121`).
- **Free-end card**: Hoya `cheering`, title **You finished your first two days!**, line **More lessons open with the full route.**, primary **Play a favourite again** (the best replay among kept quests, else `letters-q1`), secondary **Ask a grown-up** (gate, `from: 'home'`). Shown in slot (2) only; slots (1) and (3) keep their rules, so the three-card invariant holds. Never the words "trial", "ended", "locked", "left", a number of days, or a countdown.
- No change to the greeting, the streak, the Stage 1 progress bar (F-ROUTE-001 R-4b owns it) or the Home stack order (F-ROUTE-001 §6.4).

**Library** (`screens/library/StoryShelf.tsx`, `StoryTile.tsx`, wireframe `library/access-and-plan-tags.md`)

- A locked story or word-topic tile (switch on, free, not in the free set) keeps the F-STORY-004 §3.4 behaviour (gate -> paywall, `from: 'library'`) but its word changes from **Locked** to **Opens with the full route** (`learner.storyTile.state.locked` and the topic tile's twin), so one phrase names the boundary everywhere. The lock glyph stays.
- A story or topic that is a pending plan item carries **In your plan**.

### 3.8 Results: the way back to the plan, and the end of Day 2

`logic/quest-flow/results-teaser.ts` (wireframe `results/back-to-plan-and-free-end.md`):

- The teaser target becomes `routeNext` with `justCompleted` (instead of the bare cursor). The caption reads **Next in your plan** when `source` is not `route`, else today's **Next up**.
- **Back to your plan.** When the quest just played was off-plan (a plan exists and the quest is not in `planQuestIds`), the caption reads **Back to your plan** and the card names the plan's next quest. No other line; never "you skipped", "wrong lesson" or "not in your plan".
- **End of Day 2.** When `routeNext` returns `free-end` right after a scored quest, the teaser card is replaced by: Hoya `cheering`, **You finished your first two days!**, the cards the learner earned in Day 1 and Day 2 as a row (up to six; the count of cards when the row does not fit; no row when none was earned), primary **Back home**, secondary **Ask a grown-up** (gate, `from: 'results'`). Telemetry `access.free_end_reached` once per profile and device (key `free-end-seen:<profileId>` through `platform/storage.ts`, write in try/catch, never synced).
- Skipped-every-game and no-next states are unchanged (`results/next-quest-teaser.md`).

### 3.9 Grown-up surfaces: paywall and console wizard

**Paywall, free state** (`screens/paywall/PaywallScreen.tsx`, `logic/paywall.ts`, wireframe `paywall/free-plan-days.md`; behind the gate as today)

- With the switch on, the free state leads with a **What is free** block, built from data (never a typed number): "Day 1 and Day 2 of the route: {quests} quests, {letters} letters" (counts from `freeRouteQuestIds` and the catalogue's `teaches`; the letters part is left out while the free quests teach none), "{stories} short stories" (sampler stories **in this build's bundle**), "{topics} word topics" (free topics **playable in this build**), "Everything your learner finished stays theirs." A line whose count is 0 is not shown (today no story is bundled, so the stories line is hidden until one is) Then the existing offer block (F-ENT-001 §3.5; the price comes from `PLAN_PRICING`, sandbox only) with the first bullet changed to **Every lesson of every Stage, now and later**.
- With the switch off, the free state is unchanged (**Stage 1 is always free.**), because nothing past Day 2 is enforced and D5 forbids claiming a limit that does not exist.
- `Paywall` and `PinEntry` `from` gain `'episode' | 'home' | 'results'`; `paywall.viewed` carries them (changed payload, no new name).
- The button target (today `consoleBillingUrl()`, hangulroute.com) is owned by the owner item 12 spec (billing on app.hangulroute.com); this spec does not change it.

**Console curriculum wizard** (`apps/web/src/lib/console/curriculum.ts`, `CurriculumParts.tsx`, wireframe `console/curriculum-free-days.md`)

- `CurriculumParamsSchema` gains `openQuestIds: z.array(z.string()).max(400).optional()` (additive; absent = today's stage rule). In step 4 of the generator, a ready cell quest that is not in `openQuestIds` (when present) goes to `locked[]` exactly like a quest of a locked stage, and raises the existing `premium-needed` warning with its count. `GENERATOR_VERSION` stays 1 (absent = identical output; golden tests A and B unchanged).
- The wizard passes `openQuestIds = freeRouteQuestIds(CATALOG)` when `contentGatingEnabled()` is on and the space is unlicensed (`unlockedStagesForSpace` returns `['stage1']` only); a licensed space passes nothing. The warning reads, for an unlicensed space: "{n} lessons past Day 2 open with a Family Lifetime or a Group License. They are left out of this plan." with the existing link to billing.
- **Not stored.** `StoredCurriculumParamsSchema` omits `openQuestIds` the way it already omits `completedQuestIds` (`curriculum/params.ts:111-114`): it is a fact of the moment (the space's licence), so the console passes it again to `regenerateFrom` on every re-pace (`regenerateFrom` opts gain `openQuestIds?`). A published plan's `meta` therefore never carries it, and old Workers, old apps and old consoles read the same `meta` as today.

### 3.10 Old clients, stored entitlements and data

| Case | Behaviour |
|---|---|
| App build before E3-2 (any switch value) | unchanged: no quest-level rule exists; the Worker sends the same inbox |
| Console build before E3-9 | unchanged: wizard schedules Stage 1 for unlicensed spaces; devices with the switch on count items past Day 2 as `notReady` |
| Stored `entitlements` rows (`family_lifetime`, `group_license`, `school_seat`, any status) | unchanged; `tierForLearner` unchanged; inbox `tier` / `tierSource` / `tierValidUntil` unchanged |
| Device tier cache `tier:<learnerId>` | read as before; `accessTier` adds only the stale-premium rule (section 3.4) |
| Legacy `SubscriptionState` in `account-store` (F-SUB-001) | still makes `effectiveTier` premium, so access is open |
| Snapshot | no new field; `completedAt` (existing) decides kept quests; `free-end-seen:<profileId>` is a per-device UI key, never synced |
| D1 | no migration |
| Worker | only the telemetry whitelist (E3-1b), deployed first |
| Curriculum `meta` | unchanged: `openQuestIds` is a generate-time input, never stored (section 3.9) |

### 3.11 Copy, anti-shame, localization

- Every string is a message: `learner.access` (`cell.closedA11y`, `quest.closedCaption` "Opens with the full route", `preview.line` "This lesson opens with the full route.", `preview.ask.cta` "Ask a grown-up", `preview.back.cta` "Back to your lessons", `freeEnd.title` "You finished your first two days!", `freeEnd.line` "More lessons open with the full route.", `freeEnd.replay.cta` "Play a favourite again", `freeEnd.home.cta` "Back home"), `learner.routeNext` (`tag.next` "Next", `tag.inPlan` "In your plan", `home.subtitle` "Next in your plan", `results.caption` "Next in your plan", `results.backToPlan` "Back to your plan"), `caregiver.paywall.freePlan` (`title` "What is free", `days(quests, letters)` "Day 1 and Day 2 of the route: {quests} quests, {letters} letters", `stories(n)` "{n} short stories", `topics(n)` "{n} word topics", `kept` "Everything your learner finished stays theirs.", `everyLesson` "Every lesson of every Stage, now and later"), `caregiver.gating['quest-closed']`, `console.curriculum.freeDays.warning(n)`, `a11y.access` (`next` "Next", `inPlan` "In your plan", `closed(title)` "{title}: opens with the full route. Opens the lesson page."). English drafts above; Korean and Spanish overlays follow the F-I18N-001 native-review flow (shipped hidden until reviewed).
- **"Day" appears only on grown-up surfaces** (paywall, console, the landing guide of the owner item 2 spec), as "Day 1 and Day 2 of the route" (OD-8). The learner's free-end title says "your first two days", which reads as the learner's own two days of lessons, never a calendar count; no learner string says "Day {n}".
- **Banned on every learner string of this spec** (a local test fixture with es and ko equivalents, `logic/__tests__/access-banned-fixture.ts`, plus the shared lists): `Premium`, `price`, `buy`, `pay`, `trial`, `expired`, `ended`, `locked` (as a word; the glyph stays), `unlock`, `left`, `only`, `remaining`, `late`, `skipped`, `wrong`, `not in your plan`, `%`, `\d+ ?/ ?\d+`, emoji and emoji-capable symbols. Digits only in grown-up plural helpers.
- **Banned on caregiver copy**: the F-PAR-001 §3.6 phrases, "trial", "expires", "limited time", any countdown, any comparison with other learners.
- Each string passes the length budget (`packages/i18n/src/__tests__/length-budget.test.ts`).

### 3.12 Telemetry (Worker first; rows in `docs/roadmap/TELEMETRY-NAMES-2.md` section L, or the next free letter when E3-0 merges)

| Name | Payload | When |
|---|---|---|
| `access.preview_opened` | `{ stage: StageKey, day: number, from: 'journey' \| 'home' \| 'route' \| 'results' }` | a lesson page opens in preview |
| `access.grownup_asked` | `{ from: 'episode' \| 'home' \| 'results' \| 'library' }` | **Ask a grown-up** is pressed (before the gate) |
| `access.free_end_reached` | `{ freeDays: number }` | the first time `free-end` is reached on this device for this profile |
| `route.next_started` | `{ source: 'class' \| 'family' \| 'self' \| 'route', surface: 'home' \| 'results' \| 'journey' \| 'episode' \| 'route' }` | a quest that was `routeNext` is started from that surface |
| `route.offplan_finished` | `{ source: 'class' \| 'family' \| 'self', stage: StageKey }` | a quest outside the active plan is completed while a plan exists |

- E3-1b adds the five names to `TELEMETRY_EVENT_NAMES` and the exact-list tests (`packages/content-schema/src/__tests__/telemetry.test.ts`, `packages/backend/src/__tests__/telemetry.test.ts`); the Worker deploys on merge, **before** any app build that sends them (an event the old Worker rejects is dropped, never retried). `paywall.viewed.from` gains three values (changed payload, section D style; the Worker accepts any payload).
- Active profile only, through the existing offline queue; codes, stage keys and counts only; no quest title, no name, no price, no tier word.

### 3.13 Wireframes (drafted with this spec, promoted in E3-0)

| File | Screen / state | Audience |
|---|---|---|
| `design/wireframes/journey/grid-plan-and-access.md` | Journey markers: Next, In your plan, closed glyph; states per tier and switch | learner |
| `design/wireframes/episode/detail-access-preview.md` | lesson page: plan tags, preview of a closed lesson | learner |
| `design/wireframes/home/next-and-free-end-card.md` | Home card (2): next in plan, route next, free-end card | learner |
| `design/wireframes/results/back-to-plan-and-free-end.md` | Results teaser: next in plan, back to your plan, end of Day 2 | learner |
| `design/wireframes/library/access-and-plan-tags.md` | story and word-topic tiles: opens with the full route, in your plan | learner |
| `design/wireframes/paywall/free-plan-days.md` | paywall free state with the What is free block | parent / self-learner behind the gate |
| `design/wireframes/console/curriculum-free-days.md` | wizard preview and warning for an unlicensed space | teacher / parent |

### 3.14 Accessibility

- **No colour-only meaning.** Next = drawn `pin` plus the word in the label; In your plan = drawn ring plus the word; closed = drawn `lock` plus the caption "Opens with the full route" on the page and in the cell label. Shapes use `border.shape` (4.55:1 on paper, F-ROUTE-001 R-2b); the E3-D mock checks them in greyscale and protanopia at the Journey cell size.
- **Labels equal what is shown.** A cell label reads title, then state words in the order Next, In your plan, opens with the full route. The preview card is a group whose label reads the line; the two buttons are buttons with their text as label.
- **Targets.** Cells keep their size; **Ask a grown-up**, **Back to your lessons**, **Play a favourite again** use `Button` (`touchTarget.min` or larger). Body text 18 or larger; reflow at 320 x 568, landscape and 200 % text.
- **Focus.** On the preview page focus lands on the title, then the quest list, then the preview card. On the free-end card focus lands on the title.
- **Motion.** Nothing new animates; the free-end card uses the existing Hoya `cheering` pose (static under reduced motion).

### 3.15 Privacy and child safety

- No new data leaves the device. Access is computed on the device from the tier cache, the snapshot and the bundled catalogue; it works offline.
- The learner never sees a price, a plan name, "Premium", or a purchase button. **Ask a grown-up** opens the gate (`PinEntry`); only a self-only device with no PIN opens the paywall directly (F-LEARN-001 `gateOpensDirectly`, the same rule the paywall follows today).
- No ads, no third-party call, no new storage outside `platform/storage.ts`.
- Teachers and parents learn nothing new about a learner: `notReady` counts already reach the console (F-PLAN-001); no new summary field.
- Anti-shame: kept quests, cards and stars are never removed; no countdown, no "trial", no streak or day count tied to the boundary; the free-end moment is a celebration of two finished days.

### 3.16 States, errors, offline

- **New learner, switch on, free**: Day 1 open, Next on `letters-q1`; Day 2 open; everything else visible as previews.
- **Free learner mid Day 2**: Next on the first unfinished Day 2 quest; finishing it moves Next; the last one ends in the free-end card on Results and Home.
- **Free learner who played past Day 2 before the switch turned on**: every finished quest stays open (`open-kept`); the first unfinished quest past Day 2 is closed; Next points at an open unfinished free quest if one exists, else `free-end`.
- **Free learner becomes premium** (inbox says premium): all closed quests open at the next render; derivation adds the plan items it skipped; no message besides what the paywall's covered / premium states already show.
- **Premium lapses** (inbox says free): kept quests stay open; unfinished quests past Day 2 close; plan items past Day 2 become `notReady`; no learner-facing message about the change.
- **Offline**: identical to online with the last cached tier (section 3.4).
- **Catalogue and bundle disagree** (a parity break): `freeQuests` comes from the shared catalogue, so a quest the bundle has and the catalogue lacks is `open-not-a-lesson` (fails open); the existing parity test fails CI first.
- **No plan**: no In your plan marker; Next comes from the default route.

### 3.17 Behaviours (Given / When / Then; counts on today's catalogue)

- **Given** the switch on and a new free learner, **when** the Journey opens, **then** `stage1-letters` carries Next, `stage1-letters` and `stage1-life` show no lock glyph, the other six playable cells show the lock glyph with the label "opens with the full route", and no cell is hidden.
- **Given** the same learner opens "New Year & Festivals", **then** the page lists its quest with title, blurb and letters, the row shows "Opens with the full route" instead of Start, one preview card offers Ask a grown-up and Back to your lessons, and `access.preview_opened { stage: 'stage1', day: 3, from: 'journey' }` is sent.
- **Given** the learner finishes `life-q3` (the last free quest), **then** Results shows "You finished your first two days!" with the cards earned in Day 1 and Day 2, Back home and Ask a grown-up, and `access.free_end_reached { freeDays: 2 }` is sent once; Home card (2) becomes the free-end card the same day.
- **Given** a free learner who finished `stage1-rites-q1` on an older build, **when** the switch turns on, **then** that quest stays playable from the Journey and its episode page shows Play again, and its card stays in the Library.
- **Given** a premium learner with a self plan whose next item is `stage1-life-q2` dated Wednesday, **when** Home opens on Monday with no assignment for today, **then** card (2) offers `life-q2` with the subtitle "Next in your plan", and the Journey shows Next on `stage1-life` and In your plan on the cells of this week's items.
- **Given** that learner plays `stage2-nature-q1` (not in the plan), **then** it plays without any warning, Results says "Back to your plan" and names `life-q2`, and `route.offplan_finished { source: 'self', stage: 'stage2' }` is sent.
- **Given** a learner in a licensed class and a family plan, **then** Next follows the class plan first (teacher > parent > self).
- **Given** the switch off, **then** every quest is open for every learner, no lock glyph or preview exists, and the paywall still says "Stage 1 is always free."; plan markers and Next still show.
- **Given** a free class with the switch on in the console, **when** the teacher previews a 12-week plan, **then** the wizard shows "{n} lessons past Day 2 open with a Family Lifetime or a Group License. They are left out of this plan." and the published plan holds only Day 1 and Day 2 lessons plus stories.
- **Given** a premium family offline for ten days, **then** every lesson stays open (stale premium counts for access); the paywall reached through the gate shows the state `effectiveTier` gives.

## 4. Non-goals and out of scope

- Turning the switch on in production, Stripe Live, real prices on public pages (owner, OD-2).
- The LEARNING ROUTE page and its rename (owner item 11, sibling spec); this spec only adds the `free-end` hero to the existing route screen (E3-10).
- Moving billing or sign-in to app.hangulroute.com (owner item 12); the paywall button keeps its target.
- The grown-up content browser (owner item 14); it will call `questAccess` with `tier: 'premium'` for paying adults and write no progress.
- The marketing-site wording of the free plan (owner item 2 spec); the landing claim switches in the release that turns the switch on (release checklist, E3-11).
- Server-side enforcement, receipts, store purchases (F-IAP-002), any free limit counted in minutes or calendar days, a timed trial.
- New gating of stages for premium learners; any change to `tierForLearner`, entitlement rows or the inbox.
- Changes to the F-PLAN-002 generator beyond the optional `openQuestIds`.

## 5. Tests

| File | Level | Coverage |
|---|---|---|
| `content-schema/src/__tests__/route-days.test.ts` | unit, 100 % | order; one day per playable cell; preview cells and story quests excluded; frozen fixture: eight days; live catalogue: the six free ids (failure message names this spec); minutes sums; `routeDayOfQuest` for a lesson, a story, an unknown id |
| `content-schema/src/__tests__/curriculum-generate.test.ts`, `curriculum-regenerate.test.ts` (extend) | unit | `openQuestIds` absent = byte-identical drafts (goldens A, B unchanged); present = quests outside go to `locked[]` with `premium-needed`; Day 1 and Day 2 equal the first six items of the default self plan (steady) and class plan |
| `content-schema/src/__tests__/telemetry.test.ts`, `backend/src/__tests__/telemetry.test.ts` (extend) | unit, integration | five new names in the exact list; Worker accepts them |
| `mobile/src/logic/__tests__/content-access.test.ts` (extend) | unit, 100 % | `questAccess` rule order for every quest x tier x switch x kept; `isContentLocked` golden unchanged; `isStageEntitled` golden 7 x 2 unchanged; switch-off golden: all open |
| `mobile/src/store/__tests__/tier-store.test.ts` (extend) | unit | `accessTier`: stale premium counts, a free inbox closes, legacy subscription opens |
| `mobile/src/logic/__tests__/next-quest.test.ts`, `cursor-context.test.ts` (extend) | unit | `isQuestOpen` omitted = today; closed quests skipped; placed-out fallback still offers free placed-out quests |
| `mobile/src/logic/__tests__/route-next.test.ts` | unit, 100 % | plan first by precedence; dates never filter; closed and unknown items skipped; route fallback; `free-end` vs `rest`; `justCompleted`; `planQuestIds` horizon |
| `mobile/src/logic/homework/__tests__/plan-derivation.test.ts`, `gating.test.ts` (extend) | unit, 100 % | closed items `notReady`, reconcile removes pending closed items, re-derive after premium adds them; `quest-closed` rejection |
| `mobile/src/logic/homework/__tests__/mission-builder.test.ts` (extend) | unit | card (2) order; free-end card; replay and explore only among open quests; three cards always |
| `mobile/src/logic/quest-flow/__tests__/results-teaser.test.ts` (extend) | unit | target = `routeNext`; captions; back to your plan; free-end replaces the card |
| `mobile/src/logic/__tests__/paywall.test.ts` (extend) | unit | What is free counts from data; zero-count lines hidden; switch-off copy unchanged |
| `mobile/src/logic/__tests__/access-copy.test.ts` | unit | every new learner string in en / es / ko: banned fixture, no digits, no emoji, length budget; caregiver strings: F-PAR-001 list |
| `web/src/lib/console/__tests__/curriculum.test.ts`, `config.test.ts` (extend) | unit | `openQuestIds` passed only for unlicensed spaces with the switch on; warning text; env parsing |
| `mobile/e2e/web/free-days.spec.ts` | e2e | build with `EXPO_PUBLIC_CONTENT_GATING_ENABLED=true`: Journey glyphs, preview page, gate on Ask a grown-up, free-end on Results and Home, kept quest replay, 320 x 568 and 1180 x 820, offline |
| `mobile/e2e/web/plan-next.spec.ts` | e2e | a seeded self plan: Home card (2), Journey Next and In your plan, off-plan quest then Back to your plan; switch-off build shows no glyph |

Coverage: new pure modules (`route-days.ts`, `route-next.ts`, the `content-access.ts` additions) 100 %; `apps/mobile/src/logic` stays at or above its rolling target (`docs/tests/coverage-targets.md`); screens are verified by e2e (the mobile vitest lane does not render components).

## 6. Rollout and PR breakdown

### 6.0 Milestones

| Milestone | What users see | PRs | Production |
|---|---|---|---|
| **M1 "Follow my plan"** (item 10) | one Next on Home, Journey, lesson page and Results; In your plan markers; Back to your plan; no locks for anyone | E3-0, E3-1a, E3-1b, E3-D, E3-2, E3-3, E3-4, E3-5, E3-6, E3-7 | live on merge (the switch is off, so access is unchanged) |
| **M2 "Free to Day 2"** (item 9) | previews past Day 2, the free-end moment, paywall What is free, console warning | E3-8, E3-9, E3-10, E3-11 (and the access parts of E3-5 to E3-7, inert while off) | built and tested in preview builds with the switch on; production flip by the owner (OD-2) |

### 6.1 PR table

| PR | Content | Size | Needs |
|---|---|---|---|
| E3-0 | `docs`: this spec; the seven wireframes; amendment lines in F-ENT-001 §3.5 (free-state copy under the switch), F-STORY-004 §3.9 (one switch, "Opens with the full route"), F-ROUTE-001 §3.5 (`routeNext` wraps the cursor; `free-end` hero), F-PLAN-002 §3.1 (`openQuestIds`), F-PLC-001 §3.1 step 7; telemetry rows (section L); `docs/specs/README.md` index line | S | — |
| E3-1a | `feat(content-schema)`: `catalog/route-days.ts` (`routeDaysOf`, `FREE_ROUTE_DAYS`, `freeRouteQuestIds`, `routeDayOfQuest`) + tests + index exports | S | E3-0 |
| E3-1b | `feat(content-schema,backend)`: five telemetry names + exact-list tests. **The Worker deploys on merge, before any app build that sends them** | S | E3-0 |
| E3-D | `design`: mock of the In your plan ring, the Next pin placement on a cell, the closed glyph on a cell, the preview card and the free-end card (`design/components/RouteMarkers/spec.md` + preview), greyscale and protanopia check | S | E3-0 |
| E3-2 | `feat(mobile)`: `content-access.ts` quest kind, `freeQuests`, `questAccess`, `isQuestOpen`, `questOpenPredicate`; `tier-store` `accessTier` and `useQuestAccess`; flag doc comment; goldens (switch off, `isContentLocked`, `isStageEntitled`). No UI | S | E3-1a |
| E3-3 | `feat(mobile)`: `NextQuestInput.isQuestOpen`, `CursorContext.isQuestOpen`; `DeriveInput.isQuestOpen` + reconcile; `canAssignQuest` `quest-closed` + `caregiver.gating` string; Home fallbacks among open quests; story-pick grid rule; placement result primary -> `routeNext` when the start is closed | M | E3-2 |
| E3-4 | `feat(mobile)`: `logic/route-next.ts` (`routeNext`, `planQuestIds`) + tests; Home card (2) fallback and subtitle; Results teaser target, captions, Back to your plan; `learner.routeNext` en strings; `route.next_started`, `route.offplan_finished` | M | E3-3, E3-1b deployed |
| E3-5 | `feat(mobile)`: Journey Next marker, In your plan ring, closed glyph and labels; `a11y.access` en strings | M | E3-4, E3-D |
| E3-6 | `feat(mobile)`: episode page plan tags and preview state (captions, preview card, gate with `from: 'episode'`, Back to your lessons); `PinEntry` / `Paywall` `from` values; `learner.access` en strings; `access.preview_opened`, `access.grownup_asked` | M | E3-4, E3-D, E3-1b deployed |
| E3-7 | `feat(mobile)`: Home free-end card; Results end-of-Day-2 card and `free-end-seen` key; Library tile word and In your plan tag; `access.free_end_reached` | M | E3-6 |
| E3-8 | `feat(mobile)`: paywall What is free block under the switch, first bullet, `caregiver.paywall.freePlan` en strings | S | E3-2, OD-9 (default applies) |
| E3-9 | `feat(content-schema,web)`: optional `CurriculumParams.openQuestIds` in the generator and `regenerateFrom` (omitted from stored params); console `contentGatingEnabled()`; wizard passes free quest ids for unlicensed spaces; warning string | M | E3-1a |
| E3-10 | `feat(mobile)`: route page hero `free-end` and `isQuestOpen` in the route model's cursor (amendment to F-ROUTE-001 §3.5) | S | F-ROUTE-001 R-3 (#317) merged, E3-4 |
| E3-11 | `test(e2e)`: `free-days.spec.ts`, `plan-next.spec.ts` with a temporary build flag; `docs/launch/owner-runbook.md` step "Turn on the free plan": set `EXPO_PUBLIC_CONTENT_GATING_ENABLED=true` on `hangul-route-app` and `NEXT_PUBLIC_CONTENT_GATING_ENABLED=true` on `hangul-route-web` in the same release as Stripe Live, together with the landing claim change of the owner item 2 spec | S | E3-5..E3-9 |

### 6.2 Sequence notes

- E3-3 to E3-7 touch `HomeScreen.tsx`, `JourneyScreen.tsx`, `EpisodeDetailView.tsx`, `mission-builder.ts`, `results-teaser.ts` and `learner.ts`, which F-ROUTE-001 (R-3 #317, R-4b), F-PLC-001 (P-7, P-8 #312 #314) and F-STORY-004 also edit. Keep each edit small and rebase on the newest `origin/main` before review (CLAUDE.md section 10).
- Shared append-only files: `packages/content-schema/src/index.ts`, `schemas/telemetry.ts` and its test. Append, never reorder.
- The access parts of E3-5 to E3-7 merge while the switch is off; they are inert in production and covered by the e2e build with the switch on.

### 6.3 Ownership

| Code | Owner | Others |
|---|---|---|
| "may this learner start this quest" (`questAccess`) | this spec (E3-2) | the content browser of owner item 14 calls it; F-STORY-004's `isContentLocked` stays for stories and topics |
| the cursor (`nextQuestAfter`) | F-QUEST-002 / F-ROUTE-001 | this spec adds the optional `isQuestOpen` only |
| "what is next" (`routeNext`) | this spec (E3-4) | Home, Results, Journey, episode page, the route page (E3-10) and the LEARNING ROUTE spec read it |
| route days (`routeDaysOf`) | this spec (E3-1a) | paywall, console, landing copy read it |

## 7. Dependencies

- **On main:** `content-access.ts`, `entitlement.ts`, `cursor-context.ts` (R-4a #249), the shared catalogue (P2-2 #175), the generator (P2-3a #216), plan meta and the self plan schema (P2-4 #232), derivation with precedence (P2-5 #254), the console wizard (P2-6 #251), Journey without Premium (R-J #273), icons `pin` and `lock`, `border.shape` (R-2b #253), the paywall (F-ENT-001 PR 2).
- **Not on main:** the route screen (F-ROUTE-001 R-3, #317) for E3-10; the self plan screens (F-PLAN-002 P2-7a) — without them a self plan exists only through restore or a future build, so M1's plan guidance is visible first for class and family plans; Stage 1 growth (F-QUEST-002 Q-7b, Q-8) does not move the free days.
- **External:** the design mock (E3-D); Korean and Spanish review of the new strings; the owner's production switch (OD-2).

## 8. Decisions

Binding owner decisions applied: **2026-10-11 items 9, 10** (this spec); **D1** any age; **D2/D8** all copy through messages; **D3** anti-shame; **D5** amended: new gating is allowed for grid quests past Day 2 because the owner asked for it, still only behind the one switch, still with no commerce word on learner screens and no claim of a limit that is not enforced; **D7** no emoji; **D9** the 7 x 5 grid stays authoritative; **Stripe Live stays off**.

Spec decisions (engineering, reversible):

| # | Decision | Why |
|---|---|---|
| S1 | A day is a property of the content (one playable cell in default route order), not of the learner's calendar or plan | the same boundary for every learner, offline, stable while cells grow |
| S2 | Access is quest-level and computed on the device; the server is unchanged | local-first, no migration, old clients untouched |
| S3 | One switch for every free-tier limit, default off | nothing is enforced while nobody can pay; a preview build shows the whole experience |
| S4 | Fail open: unknown ids, catalogue gaps and stale premium never close a lesson | a child is never blocked by a data error |
| S5 | `routeNext` wraps the one cursor and reads plans through existing derived assignments | one "next" for every surface, no second cursor (F-ROUTE-001 M4) |
| S6 | Off-plan content has no marker; only Next and In your plan are drawn | "show the whole content, unlocked" with guidance, not a fence |

## 9. Owner decisions and assumptions

**Owner decisions** (each has a default that applies until answered; each gates only the PRs named):

| Id | Question | Default | Alternatives | Gates | Reversible |
|---|---|---|---|---|---|
| OD-1 | What is a "day" for the free plan? | one playable lesson (grid cell, about 15 minutes) in default route order; free = Day 1 and Day 2 = `letters-q1..q3` and `life-q1..q3` (6 quests, 18 letters, 6 cards, about 27 minutes) | (b) one quest per day like Home's New card (free = 2 quests); (c) the whole of Stage 1 (today's promise, 9 quests now, 15 later) | E3-1a (one constant `FREE_ROUTE_DAYS` or the day rule) | yes |
| OD-2 | When is the free boundary enforced in production? | off in production until the owner turns on Stripe Live; on in preview builds; the owner flips both env vars in one release (E3-11 runbook step) | on now, with sandbox checkout only (learners would meet a boundary nobody can pay past) | production flip only | yes |
| OD-3 | What stays open for a free learner who already played past Day 2? | every quest they finished (any device); cards and stars always stay | also the rest of any lesson they started | E3-2 | yes |
| OD-4 | Free stories and word topics | keep D5: six sampler stories, Food, Animals, Colors, Numbers, under the same switch | more or fewer samplers (a content change in `shelf.sampler`) | none (data) | yes |
| OD-5 | Learners in a free class (no licence) | same rule as every free learner: Day 1 and Day 2; the wizard warns the teacher | free classes keep all of Stage 1 | E3-2, E3-9 | yes |
| OD-6 | Learner word and glyph for a closed lesson | "Opens with the full route" with the drawn `lock` glyph on the cell and caption on the page | no glyph, words only; another phrase | E3-5, E3-6, E3-7 | yes |
| OD-7 | Where "next" comes from | the active plan by precedence (class, family, own), dates never filter; else the default route | the default route always, plans only on Home's dated card (today's behaviour) | E3-4 | yes |
| OD-8 | "Day 1 / Day 2" on learner screens | no: "Day" only on grown-up surfaces; the learner's free-end title says "your first two days" | show "Day N" on lesson pages and the route | E3-6, E3-7 | yes |
| OD-9 | Paywall free-state wording when the switch is on | the What is free block of section 3.9, replacing "Stage 1 is always free." | keep the Stage 1 line and add the block under it (would be untrue) | E3-8 | yes |
| OD-10 | Plan markers on the Journey | Next pin plus In your plan ring for this week's items (derivation horizon, 7 days) | Next only; or the whole plan | E3-5 | yes |
| OD-11 | Offline premium for access | the last server word wins for access (stale premium keeps lessons open); billing keeps the 7-day grace | 7-day grace for access too | E3-2 | yes |

**Assumptions to verify:**

| # | Assumption | Verified in |
|---|---|---|
| a | the six free quest ids stay first after F-QUEST-002 Q-7b and Q-8 (they add quests to later cells only) | E3-1a live-catalogue test |
| b | a drawn lock glyph and ring fit a Journey cell at 320 dp next to the cell initial | E3-D mock |
| c | every self or family plan item reaches the device as a pending `snapshot.homework` entry inside the horizon (P2-5) | E3-4 tests on derived fixtures |
| d | a plan generated with `openQuestIds` publishes a `meta` byte-identical in shape to one generated without it (the key is omitted from stored params) | E3-9 content-schema test |
| e | `gateOpensDirectly` already sends a self-only device with no PIN to the paywall from any `from` | E3-6 e2e |

## Appendix A — draft English strings (final copy is the dictionary's)

`learner.access`: `quest.closedCaption` "Opens with the full route" · `preview.line` "This lesson opens with the full route." · `preview.ask.cta` "Ask a grown-up" · `preview.back.cta` "Back to your lessons" · `freeEnd.title` "You finished your first two days!" · `freeEnd.line` "More lessons open with the full route." · `freeEnd.replay.cta` "Play a favourite again" · `freeEnd.home.cta` "Back home" · `cell.closedA11y(title)` "{title}: opens with the full route. Opens the lesson page."
`learner.routeNext`: `tag.next` "Next" · `tag.inPlan` "In your plan" · `home.subtitle` "Next in your plan" · `results.caption` "Next in your plan" · `results.backToPlan` "Back to your plan"
`learner.storyTile.state.locked` (changed) "Opens with the full route"
`caregiver.paywall.freePlan`: `title` "What is free" · `days(q, l)` "Day 1 and Day 2 of the route: {q} quests, {l} letters" · `stories(n)` "{n} short stories" · `topics(n)` "{n} word topics" · `kept` "Everything your learner finished stays theirs." · `everyLesson` "Every lesson of every Stage, now and later"
`caregiver.gating['quest-closed'](name)` "{name} can play this lesson with the full route."
`console.curriculum.freeDays.warning(n)` "{n} lessons past Day 2 open with a Family Lifetime or a Group License. They are left out of this plan."
`a11y.access`: `next` "Next" · `inPlan` "In your plan" · `closed(title)` "{title}: opens with the full route. Opens the lesson page."

## Appendix B — worked example (today's catalogue, switch on, free learner)

| Step | Journey | Home card (2) | Results |
|---|---|---|---|
| new | Next on Meet the Letters; lock glyph on rites, nature, crafts, Stage 2 life and nature, Stage 4 rites | New: `letters-q1` | — |
| finished `letters-q1..q3` | Next on Around the Korean Table | New: `life-q1` | Next up: `life-q1` |
| finished `life-q3` | no Next; six lock glyphs | free-end card | You finished your first two days! (the cards earned, up to six) |
| becomes premium | no glyphs; Next on New Year & Festivals | New: `rites-q1` | — |
