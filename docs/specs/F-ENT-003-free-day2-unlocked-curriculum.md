Status: ready

# F-ENT-003 — Free plan to about day 2, everything open for subscribers, and one "next" that follows the learner's own plan

> **Status note.** `ready` (revision 2, after two reviews on 2026-10-11; the review log is at the end). `ready` means: every behaviour below is decided, each owner question in section 9 has a default that applies until the owner answers, and no answer blocks a PR outside the rows it names. Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` below is at that commit.
>
> **Owner request 2026-10-11 (binding), items 9 and 10.** Item 9: "Free plan: show a bit more — learnable up to about day 2." Item 10: "Subscribers: do not lock the content; show the whole content, but make it intuitive to learn along their own configured curriculum." This spec turns both into rules. Its siblings from the same request are F-SITE-002 (item 2, the intro site), F-APP-001 (items 3 to 6, persona homes), F-REPORT-001 (items 4 and 6, reports), F-FEEDBACK-001 (item 7), F-BILL-002 (items 8 and 12, billing), the LEARNING ROUTE amendment to F-ROUTE-001 (item 11, `AMENDMENTS-ROUTE-LEARNING-ROUTE.md`, "LR" below) and F-BROWSE-001 (item 14). **This spec owns three shared things the siblings use:** the access predicate (`questAccess`), the one "next" function (`routeNext` with its "In your plan" set), and the glossary of access words (section 3.11). Section 6.4 lists the exact lines each sibling adopts.
>
> **Standing rules that bind this spec.** Stripe Live, real prices on public pages and commercial claims stay off until the owner says (sandbox only). Any age: no shared surface names an age or says "for kids"; a self-only device never says "grown-up" (CLAUDE.md §1). Child safety: the learner never sees a price, a product name, a purchase button or the word "Premium"; every commerce step sits behind the grown-up gate; no recurring prompt asks a learner to get something bought. Anti-shame: nothing earned is ever taken away; no countdown, no "trial ended", no red, no comparison between learners. All copy through `packages/i18n` (English default, Korean and Spanish overlays for native review). Tokens only, no emoji. Reading, listening and writing only; speaking is never measured or shown.

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a design mock and a wireframe)**

| Can start when | PR | Waits for what | Why |
|---|---|---|---|
| now | E3-0 docs | — | this spec, nine wireframes, amendment lines in F-ENT-001, F-STORY-004, F-ROUTE-001, F-PLAN-002, F-PLC-001, telemetry rows |
| after E3-0 | E3-1a route days, E3-1b telemetry names, E3-D design mock | E3-0 merged | new files only; E3-1b deploys the Worker whitelist first |
| after E3-1a | E3-2 access logic and cold-start tier | — | pure module plus bootstrap order; identical behaviour with the switch off (golden) |
| after E3-2 | E3-3 cursor and plans | — | logic only |
| after E3-3 and E3-1b deployed | E3-4 route next | — | logic plus the Home, Results and placement wiring; **before LR-3b** |
| after E3-4, E3-D | E3-5 Journey, E3-6 episode page, E3-7 Home and Library | design mock of the marks | the first PRs that draw something |
| after E3-2 and F-BILL-002 B-9 | E3-8 Plan screen lines | B-9 creates the Plan screen and `caregiver.plan` | contribution to a screen another spec owns |
| after E3-1a | E3-9 console wizard | — | grown-up surface |
| after E3-1a and E3-2 | E3-12 grown-up free-lessons line | F-APP-001 A-5b for the parent home card (the roster card does not wait) | grown-up surfaces |
| last | E3-11 e2e and runbook | all of the above | the switch is flipped only by the owner (OD-2) |

E3-10 (route page hero) is **withdrawn**: the route page's `free-end` state is drawn by LR-5 from `routeNext` (section 6.4).

**Scope**: `packages/content-schema` (new `src/catalog/route-days.ts` and `src/catalog/free-lessons-line.ts`; optional `CurriculumParams.openQuestIds`; telemetry names) · `packages/backend` (telemetry exact-list test only) · `apps/mobile` (`logic/content-access.ts` quest kind, new `logic/route-next.ts`, `logic/next-quest.ts` optional `isQuestOpen`, `logic/cursor-context.ts`, `logic/homework/{gating,plan-derivation,mission-builder}.ts`, `logic/quest-flow/results-teaser.ts`, `logic/access-copy.ts`, `store/{tier-store,plan-store,bootstrap}.ts`, `App.tsx` (bootstrap order), `config/flags.ts`, `screens/{journey,episode,home,library,results,homework,quest,parent}`, the Plan screen of F-BILL-002) · `apps/web` (`lib/console/config.ts` `contentGatingEnabled()`, `lib/console/curriculum.ts`, wizard warning, roster card line) · `packages/i18n` (`learner.access`, `learner.routeNext`, `caregiver.plan.freePlan`, `caregiver.access`, `console.access`, `console.curriculum.freeDays`, `a11y.access`) · `design/wireframes` (nine files, section 3.13)
**Owner**: solo dev
**Rollout**: guidance (item 10) ships to every learner as soon as its PRs merge; the free boundary (item 9) is built, tested and reviewable in preview builds, and is switched on in production only by the owner, in the same release as Stripe Live, and only for the web app until F-IAP-002 ships (OD-2, OD-13). Milestones in section 6.0.

Parent / siblings: F-ENT-001 (tier from memberships, §3.4 device cache) · F-STORY-004 §3.9 (the free-content registry, D5, `contentGatingEnabled`) · F-PLAN-002 (the curriculum, the self plan, precedence §3.6 and §3.10, the shared catalogue) · F-PLAN-001 (plans and device derivation) · F-ROUTE-001 (the one cursor, `cursorContext`, OD-4, R-J; the route page) and its LR amendment · F-QUEST-002 (Stage 1 lessons, the cursor's order) · F-HW-001 (Home's three cards, the day pin) · F-PLC-001 (placed-out quests, the start quest) · F-LEARN-001 (`gateRequired`, the grown-up gate) · F-I18N-001 (messages) · F-SUB-001 (legacy subscription fallback) · F-BILL-002 (the learner Plan screen that replaces the paywall; billing on app.hangulroute.com) · F-APP-001 (parent and teacher homes) · F-REPORT-001 (reports) · F-BROWSE-001 (grown-up lesson browser) · F-SITE-002 (intro site claims)

---

## 1. Context

### 1.1 What the code does today (verified at `ea9049e4`)

- **Two tiers, no "day".** A learner is `free` or `premium` (`apps/mobile/src/logic/entitlement.ts:15`). Premium comes from the server per learner (`tierForLearner`, F-ENT-001 §3.2) through the inbox and the device cache (`store/tier-store.ts:56`, 7-day offline grace), or from the legacy monthly or yearly subscription in `account-store` (F-SUB-001). Nothing counts days, quests or minutes.
- **The device tier cache is never loaded at cold start.** `useTierStore.hydrate` (`store/tier-store.ts:33`) is called only by tests: `hydrateLearnerData` (`store/bootstrap.ts:28-38`) does not call it, and `App.tsx:50` starts `hydrateAccount()` without waiting for it. `App.tsx:59-66` then sets `ready`, runs `rederiveAllLocal()` (plan derivation, which reads `effectiveTier` through `unlockedStagesFor`, `store/plan-store.ts:46`) and only afterwards `syncAll()`. So until the first inbox of a session arrives, and for as long as the device is offline, a learner who is premium through a class or family space reads as `free`. Today this only affects plan items of Stage 2 and later; with a quest-level limit it would affect every lesson past the free ones (section 3.4 fixes it first).
- **The free set is a registry.** `logic/content-access.ts:25-26`: `FREE_STAGE_KEYS = ['stage1']`, `FREE_VOCAB_TOPIC_IDS = ['food', 'animals', 'colors', 'numbers']`, plus stories whose `shelf.sampler` is true (six are flagged in `catalog/data.ts:118-127`; none is bundled today). `isContentLocked` (`:58-66`) locks only stories and word topics, and only when `flags.contentGatingEnabled` is on; it is off by default (`config/flags.ts:91`).
- **Self-play is open to everyone.** `isStagePlayable = () => true` (`entitlement.ts:40`); `CURSOR_STAGE_RULE = 'shipped'` (`cursor-context.ts:32`); Journey draws no lock and no Premium pill (`JourneyScreen.tsx:109-114`, R-J #273); every cell opens `EpisodeDetail` and every quest row has a Start button (`EpisodeDetailView.tsx:186-193`). `QuestPlayer { questId, episodeId }` (`navigation/types.ts:31`) starts any quest it is given. A free learner can play all 12 bundled grid quests (9 Stage 1, 2 Stage 2 tastes, 1 Stage 4 taste).
- **Stage-level gating survives in four places only**: plan derivation (`store/plan-store.ts:46-48` `unlockedStagesFor` -> `logic/homework/gating.ts:45`, a free learner's assigned Stage 2+ quest is `notReady`), the placement start quest (`PlacementScreen.tsx:300`), card earn hints (`CardDetailView.tsx:274`) and the story pick for grid stories (`logic/story/story-pick.ts:180`). The console wizard schedules Stage 1 only for an unlicensed space (`apps/web/src/lib/console/curriculum.ts:232`).
- **The public promise is "Stage 1 is always free"**: paywall bubble (`packages/i18n/src/messages/en/caregiver.ts:144`), F-ENT-001 §3.5, the landing pricing aside (pinned by `apps/web/src/app/__tests__/landing-claims.test.tsx`). Stage 1 has 9 quests today and 15 after F-QUEST-002 Q-7b and Q-8.
- **"Next" is the route cursor, not the learner's plan.** `nextQuestAfter` (`logic/next-quest.ts:51-58`) walks the playable grid quests in content order. Home card (2) shows today's assignment when there is one (`assignmentsForToday`, `assignment-merger.ts:48-56`: items due today or earlier, in precedence teacher > parent > self) and otherwise the cursor; the Results "Next up" teaser always shows the cursor (`results-teaser.ts:79`). A learner whose plan puts a later lesson first (themes order later stages, F-PLAN-002 §3.3 step 4) sees two different "next" quests on two screens, and nothing on the Journey says which cells the plan holds.
- **The default curriculum exists.** `generateCurriculum` (F-PLAN-002 P2-3a, `packages/content-schema/src/curriculum/generate.ts`) with a level of `stage1` band 0 schedules the Stage 1 lessons in canonical order: `letters-q1..q3`, then `life-q1..q3`, then rites, nature, crafts (golden A, F-PLAN-002 §3.4). The shared catalogue lists the cells in that order (`catalog/data.ts:39-44`).
- **Audience variants exist.** `audienceCopy(audience, m.caregiver.audience)` (`logic/audience-copy.ts:57`) picks a `family` or `self` variant per device; `gateOpensDirectly` (`logic/profiles/gate-route.ts:11`) says when a grown-up action skips the PIN screen.

### 1.2 What this spec decides

1. **The free lessons** are the lessons of the first two playable cells of the default route: "Meet the Letters" (`letters-q1..q3`) and "Around the Korean Table" (`life-q1..q3`): 6 lessons, 18 letters, about 25 minutes. Internally each cell is a **route day** (`FREE_ROUTE_DAYS = 2`, OD-1); the word "day" is never shown to anyone, because the free part is a set of content, not a time limit. Free learners also keep the six sampler stories and the four free word topics that D5 already names.
2. **Free learners see the whole route.** Every lesson past the free ones keeps its cell, its title, its Hoya intro, the letters it teaches and the cards it gives. It says **Not open yet** (the same words and the same dotted ring as on the LEARNING ROUTE page). Quests a learner already finished stay playable forever.
3. **Learners who started under "Stage 1 is always free" keep all of Stage 1** (OD-12, default): a profile that existed before the owner flips the switch keeps every Stage 1 lesson open.
4. **Subscribers see no lock and no mark of access anywhere.** Instead the app shows one thing: where their plan goes next. "Next" comes from the learner's plans (class, then family, then their own), else from the default route. Lessons outside the plan stay fully open and look like every other lesson.
5. **One switch.** `contentGatingEnabled` becomes the single switch for every free-tier limit (grid lessons, stories, word topics). It stays **off in production** until the owner turns on Stripe Live (OD-2), and it has **no effect in native store builds** until F-IAP-002 ships (OD-13). With it off, every learner gets exactly today's access, plus the plan guidance of item 10.
6. **Nothing changes on the server.** No D1 migration, no entitlement change, no inbox field, no summary field. Old apps, old consoles and every stored entitlement keep working (section 3.10).

Terms. **Route day**: one entry of `routeDaysOf(catalog)` (section 3.1); an internal content unit, never shown. **Free lessons**: the quests of the first `FREE_ROUTE_DAYS` route days. **Open**: a quest the learner may start. **Kept**: a quest the learner finished before, which stays open whatever the tier. **Promised**: a Stage 1 lesson that stays open for a profile created before the switch was flipped (OD-12). **Closed**: a playable quest a free learner may not start while the switch is on; its page is a **preview**. **Plan source**: one entry of `sourcesOf(plans, selfRoute)` (`plan-derivation.ts:68`): a class, school or family plan, or the learner's own plan. **Leading source**: the plan source that leads by precedence (section 3.5). **Next**: the result of `routeNext` (section 3.5). **In your plan**: the leading source's pending open items inside the derivation horizon (section 3.5). **Off-plan**: an open quest that is not in the plan.

## 2. User story

> As a family trying Hangul Route, I want our learner to really learn something before we decide — the first letters, real quests, real cards — and to see everything the full course holds, so that we know what we would get, without anything being taken away if we wait.

Companion stories:

- As a **learner on the free plan**, I want to finish my first lessons, keep playing what I finished, practise words, and see calmly that more lessons are not open yet, without being asked to get something bought every day.
- As an **adult learning on my own device**, I want the app to talk to me, not tell me to ask a grown-up.
- As a **learner in a free class**, I want to know that my teacher is the one who can open more lessons.
- As a **subscriber** (a paid family, or a learner in a licensed class or school), I want every lesson open with no lock or label in my way, and the app to show me the next step of my own plan on Home, on the Journey, on the lesson page, on the Learning Route and after every quest, so that I never have to work out where I am.
- As a **learner who wanders**, I want to play any open lesson outside my plan without a warning, and afterwards be shown the way back to my plan.
- As a **parent or teacher**, I want to see on my own screens when a learner has finished the free lessons, and on the Plan screen exactly what is free, with no price on a screen my child can reach.
- As a **teacher with a free class**, I want the curriculum wizard to tell me, before I publish, which lessons would not open for my class and how long the plan really is.
- As a **maintainer**, I want one predicate for "may this learner start this quest", one function for "what is next", one set of words for the free limit, and a switch that leaves today's behaviour bit-for-bit when it is off.

## 3. Acceptance criteria

### 3.1 Route days (`packages/content-schema/src/catalog/route-days.ts`, pure, 100 % covered)

```ts
export interface RouteDay {
  day: number;                 // 1-based; internal only, never rendered
  stage: StageKey;
  theme: ThemeKey;
  episodeId: string;
  questIds: readonly string[]; // the cell's lesson quests, in cell order
  minutes: number;             // sum of the quests' catalogue minutes
}
export const FREE_ROUTE_DAYS = 2;
export function routeDaysOf(catalog: Catalog): RouteDay[];
export function freeRouteQuestIds(catalog: Catalog, days?: number): ReadonlySet<string>;   // default FREE_ROUTE_DAYS
export function gridLessonIds(catalog: Catalog): ReadonlySet<string>;                      // every quest of every route day
export function routeDayOfQuest(catalog: Catalog, questId: string): number | null;         // null: not a grid lesson
export interface FreeLessonsFacts { lessons: number; letters: number; minutes: number; episodeIds: readonly string[] }
export function freeLessonsFacts(catalog: Catalog, days?: number): FreeLessonsFacts;       // minutes rounded to the nearest 5
```

- **Order** = the default route: stages 1 to 7, and inside a stage the canonical theme order letters, life, rites, nature, crafts (the order of `catalog.cells`, which is also `routeCatalogOf(catalog).order` and the generator's order for `stage1` band 0 with no theme preference, F-PLAN-002 §3.3 step 4). A theme preference or a placement never changes the days: days are a property of the content, the same for every learner.
- **One day per playable cell**: a cell counts when its status is `shipped` or `ready` and it has at least one lesson quest (`kind: 'lesson'`). Preview cells are not days. Story quests (`kind: 'story'`) are never in a day.
- **Today** (`CATALOG_VERSION` 4): Day 1 `stage1-letters` (3 quests, 15 minutes), Day 2 `stage1-life` (3 quests, 12 minutes), Day 3 `stage1-rites` (3 quests, 14 minutes), Day 4 `stage1-nature`, Day 5 `stage1-crafts`, Day 6 `stage2-life`, Day 7 `stage2-nature`, Day 8 `stage4-rites`.
- **Free lessons today**: `quest:stage1-letters-q1`, `-q2`, `-q3`, `quest:stage1-life-q1`, `-q2`, `-q3`. They teach 18 letters (ㅏ ㅓ ㄱ ㄴ ㅗ ㅜ ㅁ ㅇ ㅡ ㅣ ㄷ ㄹ ㅈ ㅊ ㅂ ㅅ ㅋ ㅌ, `catalog/data.ts:84-89`) and award six cards (`card:book`, `card:hanji`, `card:brush`, `card:kimchi`, `card:family-table`, `card:kimbap`; `content/quests.ts:50-247`). `freeLessonsFacts` = `{ lessons: 6, letters: 18, minutes: 25, episodeIds: ['stage1-letters', 'stage1-life'] }` (27 minutes rounded to 25).
- **Stable while content grows.** F-QUEST-002 Q-7b and Q-8 grow the rites, nature and crafts cells to three quests each; Days 1 and 2 do not move. A test pins the six free quest ids on the live catalogue with the message "The free lessons changed: update F-ENT-003 section 3.1 and the free-plan copy in the same PR"; a second test pins the eight days on the frozen fixture (`__tests__/fixtures/catalog-2026-10.ts`).
- **Against the default curriculum** (documentation, asserted by a golden test): with `stage1` band 0 and no story ready, the free lessons are the first six items of the default self plan (pace `steady`, 3 sessions a week: weeks 1 and 2) and of the default class plan (2 sessions a week: weeks 1 to 3).
- Exported from `src/catalog/index.ts` and `src/index.ts` (append-only lines).

### 3.2 Who gets what

| Learner | Switch off (production default), or any native store build | Switch on (web) |
|---|---|---|
| premium (Family Lifetime, licensed class or school, legacy subscription, cached premium, OD-11) | everything open; plan guidance | everything open; plan guidance; **no access mark anywhere** |
| free, profile created before the flip (OD-12) | everything open (today's behaviour); plan guidance | the free lessons and **all of Stage 1** open; later lessons visible as previews; kept quests open; sampler stories and free word topics open; plan guidance over open quests |
| free, profile created after the flip | everything open (today's behaviour); plan guidance | the free lessons open; later lessons visible as previews; kept quests open; sampler stories and free word topics open; plan guidance over open quests |

- **Free learners in a free class or a family space without a purchase** follow the free rows (OD-5). Their teacher's or parent's items that are closed derive as `notReady` (section 3.6), the console says so before publishing (section 3.9.3), and the grown-up's own screens show one line once the learner has finished what is open (section 3.9.2).
- **Placed-out quests** (F-PLC-001) are not kept and not opened by the level check: a free learner placed into Stage 2 still has the free lessons open. Because a placed-out learner already reads those letters, `routeNext` offers word practice instead of replaying them (section 3.5 step 3).
- **Kept** = the quest has `completedAt` in the learner's snapshot, from any device (sync merges are unions, so a quest finished on a tablet is kept on the phone after the next sync). Its cards and stars are never touched by this spec. A started but unfinished quest is not kept (OD-3).
- **Shelf stories and word topics** keep the D5 rule unchanged (`isContentLocked`), now under the same switch.

### 3.3 Access logic (`apps/mobile/src/logic/content-access.ts`, extended, 100 % covered)

```ts
export type ContentKind = 'stage' | 'story' | 'vocab-topic' | 'quest';           // + 'quest'
export interface FreeContentRegistry {
  stages: ReadonlySet<string>;
  vocabTopics: ReadonlySet<string>;
  samplerStories: ReadonlySet<string>;
  freeQuests: ReadonlySet<string>;    // + freeRouteQuestIds(CATALOG)
  gridLessons: ReadonlySet<string>;   // + gridLessonIds(CATALOG)
  promiseQuests: ReadonlySet<string>; // + Stage 1 quests of gridLessons (OD-12)
}
export type QuestAccess =
  | 'open-premium' | 'open-switch-off' | 'open-kept' | 'open-free' | 'open-not-a-lesson' | 'open-promise' | 'closed';
export interface QuestAccessInput {
  questId: string;
  tier: Tier;
  gatingEnabled: boolean;              // the effective switch (section 3.4), never the raw env value
  completedQuestIds: ReadonlySet<string>;
  keepsStage1Promise: boolean;         // OD-12 (section 3.4)
  registry?: FreeContentRegistry;      // default: defaultRegistry()
}
export function questAccess(i: QuestAccessInput): QuestAccess;
export function isQuestOpen(i: QuestAccessInput): boolean;          // questAccess(i) !== 'closed'
export function questOpenPredicate(i: Omit<QuestAccessInput, 'questId'>): (questId: string) => boolean;
export function browseQuestOpen(scope: 'full' | 'sampler', gatingEnabled: boolean): (questId: string) => boolean;
```

Rules of `questAccess`, first match wins:

1. `tier === 'premium'` -> `open-premium`;
2. `!gatingEnabled` -> `open-switch-off`;
3. `completedQuestIds.has(questId)` -> `open-kept`;
4. `registry.freeQuests.has(questId)` -> `open-free`;
5. `!registry.gridLessons.has(questId)` -> `open-not-a-lesson` (a story quest or an unknown id; stories are decided by `isContentLocked`, section 3.2; an unknown id is never closed by this function, the screens already refuse unknown ids);
6. `keepsStage1Promise && registry.promiseQuests.has(questId)` -> `open-promise`;
7. otherwise `closed`.

- `defaultRegistry()` builds `freeQuests`, `gridLessons` and `promiseQuests` from the shared catalogue once (memoised).
- `isFreeContent('quest', id)` reads `registry.freeQuests`.
- **Grown-up browsing (F-BROWSE-001, item 14).** `browseQuestOpen('full', _)` is `questOpenPredicate({ tier: 'premium', ... })` (everything open). `browseQuestOpen('sampler', gatingEnabled)` is `questOpenPredicate({ tier: 'free', gatingEnabled, completedQuestIds: new Set(), keepsStage1Promise: false })`. With the switch off a free grown-up sees every lesson open, exactly as their learner does; with it on, the free lessons. Browse writes no progress and sends no `access.*` event.
- `isContentLocked` keeps its signature and result for `story` and `vocab-topic` (golden test).
- **`isStageEntitled(stage, tier)` keeps its signature and result** for every stage and tier (golden test over 7 stages x 2 tiers). It stays the stage-level answer for the callers that need one (placement start, card earn hints, the stage list a plan reads) and is documented as "coarse: a free learner's Stage 1 is entitled, but quests are decided by `isQuestOpen`". `FREE_STAGE_KEYS` keeps `['stage1']` for those callers and for old code paths.
- **`isStagePlayable` stays `() => true`**: it answers "does this stage have content the route may show", not "may this learner start it". The route page and `summary.journey` keep binding it (F-ROUTE-001 §3.2).
- **Golden: switch off.** For every bundled quest x {free, premium} x {done, not done} x {promise, no promise}, `isQuestOpen` with `gatingEnabled: false` is true. With the switch off no surface changes access; only the plan guidance of sections 3.5 to 3.8 is new.

### 3.4 The one switch, the tier used for access, and cold start

- **The flag.** `flags.contentGatingEnabled` (`EXPO_PUBLIC_CONTENT_GATING_ENABLED`, launch default `false`) now covers grid lessons too. Its doc comment becomes: "Turns on every free-tier limit on the web app: grid lessons past the free ones (F-ENT-003), non-sampler stories and word topics past the free four (F-STORY-004 D5). Off in production until the owner turns on Stripe Live. Has no effect in native store builds until F-IAP-002 ships." The flag name and the env name do not change.
- **The effective switch** (`gatingActive(flags, platformOs)` in `config/flags.ts`, unit tested): `flags.contentGatingEnabled && platformOs === 'web'`. Native builds (`ios`, `android`) return `false` whatever the env says, because App Review Guideline 3.1.1 and 3.1.3(b) do not allow limiting digital content in the app while the only way to open it is a purchase outside the app (F-BILL-002 §4.8, OD-5). F-IAP-002 changes this one function when the in-app purchase exists. Every caller in this spec (and `isContentLocked`) reads `gatingActive`, never the raw flag.
- The console reads `NEXT_PUBLIC_CONTENT_GATING_ENABLED` through `contentGatingEnabled(env)` in `apps/web/src/lib/console/config.ts` (same `'true' | '1'` parsing as the app). It changes only the wizard's preview and warning (section 3.9.3) and the grown-up line (section 3.9.2); the device stays the authority on what opens.
- **Access tier (OD-11).** `accessTier(learnerId, now)` in `store/tier-store.ts` is `premium` when any of these holds, else `free`:
  1. `effectiveTier(learnerId, now)` is premium (cached premium inside its `validUntil`, or the legacy subscription);
  2. the cached tier is `premium` even after its `validUntil` (the last word from the server was premium and no newer inbox has said free);
  3. **no tier cache entry exists yet** for this learner and the device holds a space membership for them (`membership-store`): the server has never answered for this learner on this device, so access fails open until it does.

  Billing surfaces keep `effectiveTier` (F-ENT-001 §3.4). Reason: a paying family offline for more than seven days, or a licensed-class learner on a new device before the first sync, must not see lessons close; a lapsed licence closes them at the next successful inbox, which is the moment the server says `free`.
- **Cold start order (fixes section 1.1).** `hydrateLearnerData` (`store/bootstrap.ts`) awaits `useAccountStore.getState().hydrate()` and `useTierStore.getState().hydrate(p.id)` for every profile, inside the same `Promise.all` as the progress hydrate, so both have finished before `App.tsx` sets `ready` and runs `rederiveAllLocal()`. `App.tsx` drops its separate fire-and-forget `hydrateAccount()` call (the bootstrap does it). A bootstrap test asserts the order: tier and account hydrate resolve before `rederiveAllLocal` is called.
- **One predicate, two call styles.** `questOpenFor(learnerId, now)` (non-hook, in `store/tier-store.ts`) returns `questOpenPredicate({ tier: accessTier(learnerId, now), gatingEnabled: gatingActive(flags, Platform.OS), completedQuestIds, keepsStage1Promise })` for that learner, reading the snapshot from `progress-store`. Store actions (`plan-store` `deriveFor` and `reconcile`) call it directly. `useQuestAccess()` is the React hook that wraps it for the active profile and recomputes when the tier cache, the snapshot or the profile list changes. **`unlockedStagesFor` (`plan-store.ts:46`) switches from `effectiveTier` to `accessTier`**, so stage access and quest access always come from the same tier.
- **Stage 1 promise (OD-12).** `keepsStage1Promise(profile, snapshot, freePlanSince)` is true when `freePlanSince` is set and the profile's start is before it. The start is the earlier of `profile.createdAt` and the oldest `completedAt` in the snapshot (a profile restored onto a new device keeps its history). `freePlanSince` comes from `EXPO_PUBLIC_FREE_PLAN_SINCE` (an ISO date the owner sets in the same release that flips the switch, E3-11 runbook); unset means no profile keeps the promise. Under OD-12 alternative (b) the owner leaves it unset.

### 3.5 What "next" means (`apps/mobile/src/logic/route-next.ts`, pure, 100 % covered)

**One module, one owner.** `routeNext` and `planView` live only here (E3-4). The LEARNING ROUTE amendment's LR-3b imports them; it does not create `logic/my-route/next.ts` (section 6.4). Every surface that names a next quest or marks "In your plan" calls this module: Home card (2), the Results teaser, the Journey, the episode page, the Library, the Learning Route page and the placement result.

```ts
export type NextSource = 'class' | 'school' | 'family' | 'self' | 'cursor';   // aligned with LR GoalFrom
export type RouteNext =
  | { kind: 'quest'; questId: string; episodeId: string; stage: StageKey; source: NextSource; sourceId: string | null; assignmentId?: string }
  | { kind: 'free-end'; placedOut: boolean }   // effective switch on, free, nothing new is open, a closed lesson exists
  | { kind: 'rest' };                          // nothing open is left to do
export interface RouteNextInput {
  snapshot: ProgressSnapshot;
  profileId: string;
  today: DateKey;
  sources: readonly DeriveSource[];             // sourcesOf(plans, snapshot.selfRoute)
  quests: readonly Quest[];
  episodes: readonly Episode[];
  cursor: CursorContext;                        // from cursorContext (F-ROUTE-001 R-4a), now with isQuestOpen
  isQuestOpen: (questId: string) => boolean;    // questOpenFor / useQuestAccess
  gating: { active: boolean; tier: Tier };      // gatingActive and accessTier
  justCompleted?: string;
}
export function routeNext(i: RouteNextInput): RouteNext;
export interface PlanView {
  leadingSourceId: string | null;
  leadingKind: NextSource | null;               // never 'cursor'
  inPlanQuestIds: ReadonlySet<string>;
  inPlanEpisodeIds: ReadonlySet<string>;
}
export function planView(i: RouteNextInput): PlanView;
```

**The rule** (both specs quote it; a quest qualifies at every step only when it is known, playable, open and not done, `justCompleted` counting as done):

1. **Due now = Home's card.** The first qualifying item of `assignmentsForToday(snapshot.homework, profileId, today)` (`assignment-merger.ts:48`, the same function Home card (2) uses: every assignment due today or earlier, plan-derived and explicit, in precedence teacher > parent > self, then `targetDate`, then `assignedAt`). `source` is the item's plan source kind (from the `<sourceId>#<questId>` id; an explicit assignment maps `teacher` -> `class`, `parent` -> `family`).
2. **Else the leading source.** Rank the plan sources by the derivation rank (`ASSIGNED_BY`, `plan-derivation.ts:59-65`, F-PLAN-002 §3.10): `class` (teacher) first, then `family` and `school` (parent), then the learner's own (`self`); inside one rank the newest `assignedAt` wins (LR §4.1 rule 2). The **leading source** is the first source in that order that has a qualifying pending item (a derived `snapshot.homework` entry `<sourceId>#<questId>` with no `completedAt`). Its next item is its first qualifying item ordered by `targetDate`, then by the source's list order. Dates are **not** a filter: an item dated Wednesday is the next step on Monday, and an item dated last week is the next step today. Nothing is ever "late". Classic plans (no `meta`) count here; they do not count for the Learning Route goal (LR §4.1 rule 1).
3. **Else the default route.** `nextQuestAfter` with `cursor` (F-ROUTE-001 M4 holds: `routeNext` wraps the one cursor and never walks the content itself), `source: 'cursor'`, `sourceId: null`. When the cursor has nothing new and only placed-out quests are left (the F-ROUTE-001 §3.5 fallback): with the effective switch on and a free tier, go to step 4 with `placedOut: true` (a learner who tested out of the free letters gets word practice, not a replay of letters they know); otherwise today's fallback quest, `source: 'cursor'`.
4. **Else** `{ kind: 'free-end', placedOut }` when the effective switch is on, the access tier is free and some playable grid lesson is closed; otherwise `{ kind: 'rest' }`.

**In your plan** (`planView`): the leading source's pending qualifying items whose `targetDate` is inside the derivation horizon (today plus `HORIZON_DAYS`, F-PLAN-002 §3.6 rule 1), as quest ids and as their episode ids. The leading source is the one of step 2, computed even when step 1 hit. The same set drives the Journey ring, the episode page tag, the Library tag and the Learning Route cell rows (LR's `inPlanEpisodeIds` is `planView().inPlanEpisodeIds`). No plan source with a qualifying item: empty set, no marks.

- **`NextQuestInput` gains `isQuestOpen?: (questId: string) => boolean`** (additive; omitted = every quest open), applied in `offerableQuests` after `isEntitled`. **`CursorContext` gains `isQuestOpen`**, filled from `useQuestAccess()`. `CURSOR_STAGE_RULE` stays `'shipped'`.
- **Agreement with Home.** Whenever Home card (2) shows an assignment and the day pin is not holding an older pick (F-HW-001 §3.2), `routeNext` returns the same quest, because step 1 is the same function. Home card (2) without an assignment shows `routeNext` (section 3.7).
- **A plan item the learner cannot open** (free, switch on, closed) never qualifies, is never shown as next, and is already counted `notReady` by derivation (section 3.6). If every plan item is closed, step 3 offers the open default route; if nothing new is open, `free-end`.
- **Cross-spec golden** (`logic/__tests__/route-next.agreement.test.ts`): on a set of snapshots (no plan; self plan; family plan plus a classic class plan; a curriculum and a classic plan in the same rank; free learner at the end of the free lessons; placed-out free learner), Home card (2) (`buildTodaysMission`), the Results teaser target, the Journey mark model, the episode tag model and, once LR-3b has merged, `buildMyRoute().next` and `.inPlanEpisodeIds` all equal `routeNext` and `planView`.

### 3.6 Plans, assignments, placement and play under the switch

- **Derivation.** `DeriveInput` gains `isQuestOpen?: (questId: string) => boolean` (additive; omitted = today's behaviour). `deriveAssignments` treats an item whose quest is closed exactly like a stage-locked item today: not derived, counted in `notReady[source]`, a pending assignment for it is removed by reconcile (F-PLAN-002 §3.6 rule 2). `plan-store` `deriveFor` and `reconcile` pass `questOpenFor(learnerId, now)` (section 3.4). Because the tier cache is loaded before the first derivation and an unknown tier fails open, no premium learner loses a plan item at cold start. When the learner later becomes premium, the next derivation (inbox refresh, app start, foreground) derives the item; nothing else is needed.
- **`canAssignQuest`** (`gating.ts:32`) gains an optional `isQuestOpen` and the rejection `'quest-closed'`; the caregiver message `caregiver.gating['quest-closed'](name)` reads "{name} can play this lesson with Family Lifetime or a Group License." (grown-up surface; no price).
- **Placement.** `effectiveRoute` keeps its stage-level `isEntitled` (the start mark shows where the level check put the learner, F-ROUTE-001 §3.6). The result screen's primary action starts `routeNext` (always open) instead of `startQuestId` when the start quest is closed; at `free-end` with `placedOut` it opens the first free word topic (amendment line to F-PLC-001 §3.1 step 7, landed in **E3-4**, after `routeNext` exists).
- **Home fallbacks.** `buildTodaysMission` picks card (1) replays, the `explore` fallback and story cards only among open quests (a replay is always kept, so card (1) never changes for a learner who already played).
- **Story pick.** `story-pick.ts:180` adds `!isQuestOpen(entry.questId)` for grid stories (none is bundled today; the rule is for Stage 5 books).
- **Guard at the point of play.** `QuestPlayerScreen` checks `isQuestOpen(questId)` on mount: when it is false, it replaces the route with `EpisodeDetail { episodeId }` (the preview). This covers every entry the screens do not (an explicit assignment made before the switch, a Results "Play again" after a lapse, a card earn hint, a future deep link). The Homework screen shows **Not open yet** in place of Start for a closed assignment (no button).

### 3.7 Learner screens: Journey, episode page, Home, Library (any age)

**Marks (one shape each, E3-D mock; never colour alone).** **Next** = the drawn `pin` glyph. **In your plan** = a solid ring (`border.shape`). **Not open yet** = a dotted ring, the same shape as the `later` pip of the Learning Route (LR §4.5) at cell scale. No lock glyph on any learner screen (OD-6).

**Journey** (`screens/journey/JourneyScreen.tsx`, wireframe `journey/grid-plan-and-access.md`)

- **Next.** The cell that holds `routeNext`'s quest carries the `pin`; its accessibility label appends "Next". One cell at most. Hidden at `rest` and `free-end`.
- **In your plan.** Cells in `planView().inPlanEpisodeIds` carry the solid ring and the label suffix "In your plan". Only while a plan exists; no ring for the default route (the route is the whole grid).
- **Not open yet** (effective switch on, free): the cell keeps its art, colour and tap; the dotted ring sits around the cell art and the label reads "{episode}: not open yet. Opens the lesson page." A cell with any kept or promised quest shows no ring. The stage pill keeps the availability word (R-J); no stage row is ever a lock or a door to a purchase.
- **Subscribers and the switch-off state show no access mark at all.** Precedence on one cell: Next > In your plan > Not open yet (a closed cell is never Next or In your plan).

**Episode page** (`screens/episode/EpisodeDetailView.tsx`, wireframe `episode/detail-access-preview.md`)

- **Open quest rows** are unchanged. A row whose quest is `routeNext` carries the tag **Next**; a row in `planView().inPlanQuestIds` carries **In your plan** (drawn shape plus word).
- **Preview** (effective switch on, free, at least one closed quest in the episode): the page shows everything it shows today (pills, title, Hoya intro, the quest list with titles and blurbs, the letters each quest teaches as `KoreanText` chips, the cards to earn). Each closed row replaces its Start button with the caption **Not open yet**; kept rows keep **Play again**. Under the list, one card: Hoya `reading`, the line **This lesson is not open yet. You can still see what it teaches.**, the secondary button **{ask}** (below), and the ghost link **Back to open lessons** -> the `routeNext` episode (or the first free word topic at `free-end`). The page has no primary button in preview.
- **The ask button** (`askFor(audience, classOnly)` in `logic/access-copy.ts`, unit tested):

  | Device and learner | Label | Goes to |
  |---|---|---|
  | family device (`audience === 'family'`), learner with any family membership or none | **Ask a grown-up** | `PinEntry { next: 'Paywall', from }` |
  | family device, learner whose only space membership is a class or school | **Ask your teacher or a grown-up** | `PinEntry { next: 'Paywall', from }`; the Plan screen adds the class line (section 3.9.1) |
  | self-only device (`audience === 'self'`) | **See how to open it** | the Plan screen; directly when `gateOpensDirectly`, else through the settings PIN |

  The route key stays `Paywall` (F-BILL-002 §4.7 keeps it for the Plan screen).
- No price, product name, "Premium", "buy", "trial" or "locked" on the page. Telemetry `access.preview_opened` once per open (section 3.12).

**Home** (`screens/home/HomeScreen.tsx`, `logic/homework/mission-builder.ts`, wireframe `home/next-and-free-end-card.md`)

- Card (2) order: today's assignment (unchanged, F-HW-001 §3.4; it is `routeNext` step 1) -> `routeNext` quest (subtitle **Next in your plan** when `source` is not `cursor`, else today's **New**) -> at `free-end`, the free-end card **once**, then the practice card -> at `rest` today's replay fallback (`mission-builder.ts:120-121`).
- **Free-end card, once per profile and device**: shown only when `free-end-seen:<profileId>` (`platform/storage.ts`, write in try/catch, never synced) is not set; showing it on Home or on Results sets the key. Hoya `cheering`, title **You finished your first lessons!**, line **You played every quest that is open for you.**, primary **Practice words** (the first free word topic playable in this build; when a sampler story is bundled and no topic is, **Read a story**), secondary **Play a favorite again** (the best replay among kept quests, else `letters-q1`), ghost **{ask}** (as on the episode page, `from: 'home'`). For a `placedOut` free-end the line is the same and the primary is **Practice words**.
- **Practice card** (every day after the free-end card was seen, and at `free-end` once the key is set): the first of a free word topic the learner has not finished today, a sampler story, or the best kept replay; title from that item, subtitle **Keep practicing**. **No ask, no grown-up button, no line about what is not open.** The grown-up path stays available only from learner taps on a preview page or a closed Library tile, and from the Profile grown-up zone.
- Shown in slot (2) only; slots (1) and (3) keep their rules, so the three-card invariant holds. Never the words "trial", "ended", "locked", "left", a number of days, or a countdown.
- No change to the greeting, the streak, the Stage 1 progress bar (F-ROUTE-001 R-4b owns it) or the Home stack order (F-ROUTE-001 §6.4).

**Library** (`screens/library/StoryShelf.tsx`, `StoryTile.tsx`, the topic picker, wireframe `library/access-and-plan-tags.md`)

- A closed story or word-topic tile (effective switch on, free, not in the free set) keeps the F-STORY-004 §3.4 route (gate -> Plan screen, `from: 'library'`), now with the ask label of the table above in its accessibility hint. Its word changes from **Locked** to **Not open yet** (`learner.storyTile.state.locked` and the topic tile's twin), and the lock glyph is replaced by the dotted ring, so one word and one shape name the boundary everywhere.
- A story or topic in `planView().inPlanQuestIds` carries **In your plan**.

### 3.8 Results: the way back to the plan, and the end of the free lessons

`logic/quest-flow/results-teaser.ts` (wireframe `results/back-to-plan-and-free-end.md`):

- The teaser target becomes `routeNext` with `justCompleted` (instead of the bare cursor). The caption reads **Next in your plan** when `source` is not `cursor`, else today's **Next up**.
- **Back to your plan.** When the quest just played was off-plan (a leading source exists and the quest was not in `planView().inPlanQuestIds` before it was completed), the caption reads **Back to your plan** and the card names the plan's next quest. No other line; never "you skipped", "wrong lesson" or "not in your plan".
- **End of the free lessons.** When `routeNext` returns `free-end` right after a scored quest and `free-end-seen:<profileId>` is not set: the teaser card is replaced by Hoya `cheering`, **You finished your first lessons!**, the cards the learner earned in the free lessons as a row (up to six; the count of cards when the row does not fit; no row when none was earned), primary **Back home**, secondary **Practice words** (as on Home), ghost **{ask}** (`from: 'results'`). The key is set and `access.free_end_reached` sent once per profile and device.
- **After that** (free-end, key set, for example after a replay): no teaser card; the line **You played every quest that is open for you.** above the existing buttons, with **Practice words** added. No ask.
- Skipped-every-game and no-next states are unchanged (`results/next-quest-teaser.md`).

### 3.9 Grown-up surfaces

#### 3.9.1 The Plan screen's free-plan lines (contribution to F-BILL-002 §4.7; wireframe `billing/plan-status-free-lessons.md`)

F-BILL-002 B-9 replaces the price-bearing paywall with a status-only **Plan** screen (route key `Paywall`, no price anywhere, web-only **Open billing**, nothing on native). That spec owns the screen, its states, its button and its layout. This spec supplies only the lines on what is free, under `caregiver.plan.freePlan` (keys added to the `caregiver.plan` object B-6 creates), and draws no price, no offer and no button.

- **Free state, effective switch on**: under F-BILL-002's title ("{name} is on the free plan." / "You're on the free plan."), the line `freePlan.line(lessons, letters, minutes)` replaces F-BILL-002's `free.open`: **"The first {lessons} lessons are free: {letters} letters, about {minutes} minutes. Everything finished stays."** Numbers come from `freeLessonsFacts(CATALOG)` (today 6, 18, 25), never typed; the letters part is left out while the free lessons teach none.
- **What is free** (optional short list under the line, shown when at least one item has a count): **"{n} short stories"** (sampler stories in this build's bundle), **"{n} word topics"** (free topics playable in this build). A line whose count is 0 is not shown (no story is bundled today).
- **Extra lines by situation** (at most one, in this order):
  - the learner keeps the Stage 1 promise (OD-12): family "All of Stage 1 stays free for {name}." / self "All of Stage 1 stays free for you.";
  - the learner's only space membership is a class or school: family "{name}'s teacher can open every lesson for the class." / self "Your teacher can open every lesson for the class.";
  - the learner has reached `free-end`: family "{name} finished the free lessons." / self "You finished the free lessons.".
- **Effective switch off**: F-BILL-002's `free.open` line stays as it is ("Stage 1 is open to everyone."), because nothing past it is enforced and D5 forbids claiming a limit that does not exist.
- **Premium state with no plan** (item 10 gate, section 3.9.4): one line under F-BILL-002's premium lines, "Set a plan to guide what comes next." with no button on native; on the web, the line names the grown-up page ("Plans are made in the grown-up area: Plan the term.") with no link (F-BILL-002 owns links on this screen).
- "Every lesson of every Stage, now and later" (the old offer bullet) moves to the billing page on app.hangulroute.com, owned by F-BILL-002 (section 6.4).
- `Paywall` and `PinEntry` `from` gain `'episode' | 'home' | 'results'`; `paywall.viewed` carries them (changed payload, no new name; F-BILL-002 keeps the event).

#### 3.9.2 The free-lessons line for parents and teachers (E3-12; wireframe `console/free-lessons-line.md`)

The free limit must be visible on the grown-up side, not only after a learner taps a button. One calm line, built by one pure function, `freeLessonsLine(input)` in `packages/content-schema/src/catalog/free-lessons-line.ts` (100 % covered), which returns a code and params, never a string:

```ts
export type FreeLessonsLine =
  | { code: 'free-end'; product: 'family' | 'class' }                 // finished everything open
  | { code: 'plan-waiting'; product: 'family' | 'class'; closed: number } // every open item of this space's plan is done, closed items remain
  | { code: 'free-plan'; product: 'family' | 'class' }                 // neutral, report page only
  | null;
```

- **When it shows at all**: the switch is on (device: `gatingActive`; console: `contentGatingEnabled()`), the viewer **owns** the space (LR §6.1 rule; never a teacher who does not own the space, never a co-caregiver without billing rights), and the space is not covered (console: the account's own `GET /api/entitlements`, which the console already calls for Billing; device: the learner's `accessTier` is free). The roster carries no tier and none is added.
- **Device** (exact; the snapshot is on the device): the on-device parent dashboard child row (F-PAR-001) and the in-app report (F-REPORT-001 `viewer: 'device'`) show `free-end` when `routeNext` for that learner is `free-end`.
- **Console** (from the existing summary only; no new summary field): the family and class roster cards (and the F-APP-001 parent home child card once A-5b has merged) show `plan-waiting` when a plan of **this** space has `planProgress[planId].notReady > 0` and `done === total` (every derived item is done; `notReady` counts the closed items, section 3.6). With no such plan nothing shows on a card (the console cannot tell from counts which lessons were finished; it never guesses). The F-REPORT-001 learner report adds the neutral `free-plan` line to its next-steps block (section 6.4).
- **Words** (no price, no "Premium", no comparison, third person, product named by space kind: family -> "Family Lifetime", class or school -> "a Group License"):
  - `free-end`: "{name} finished the free lessons. More lessons open with {product}."
  - `plan-waiting`: "{name} finished everything open in this plan. {closed} more lessons open with {product}."
  - `free-plan`: "On the free plan, the first {lessons} lessons are open. More lessons open with {product}."
- A link **Open billing** follows the line for the space owner (F-BILL-002 `billingUrl()` on the device web build; the console's Billing route on the console; nothing on native).

#### 3.9.3 Console curriculum wizard (`apps/web/src/lib/console/curriculum.ts`, `CurriculumParts.tsx`, wireframe `console/curriculum-free-days.md`)

- `CurriculumParamsSchema` gains `openQuestIds: z.array(z.string()).max(400).optional()` (additive; absent = today's stage rule). In step 4 of the generator, a ready cell quest that is not in `openQuestIds` (when present) goes to `locked[]` exactly like a quest of a locked stage, and raises the existing `premium-needed` warning with its count. `GENERATOR_VERSION` stays 1 (absent = identical output; golden tests A and B unchanged).
- The wizard passes `openQuestIds = freeRouteQuestIds(CATALOG)` when `contentGatingEnabled()` is on and the space is unlicensed (`unlockedStagesForSpace` returns `['stage1']` only); a licensed space passes nothing.
- **Warning** (unlicensed, switch on), product by space kind: "The free plan covers the first {lessons} lessons (weeks 1 to {lastWeek}). {n} more lessons open with {product}. They are left out of this plan." `{lastWeek}` is the last week of the draft that holds a lesson. The existing billing link follows.
- **Short plans.** When `lastWeek` is earlier than the plan's last week, the preview shows above Publish: "This plan has lessons until week {lastWeek}. After that it has stories and practice." and, when a shorter length preset holds every lesson (4 weeks today), a secondary button **Use {weeks} weeks** that re-runs the preview with that length. Publishing the long plan stays allowed.
- **Not stored.** `StoredCurriculumParamsSchema` omits `openQuestIds` the way it already omits `completedQuestIds` (`curriculum/params.ts:111-114`): it is a fact of the moment (the space's licence), so the console passes it again to `regenerateFrom` on every re-pace (`regenerateFrom` opts gain `openQuestIds?`). A published plan's `meta` therefore never carries it, and old Workers, old apps and old consoles read the same `meta` as today.

#### 3.9.4 Subscribers without a plan (item 10)

Item 10's guidance needs a configured plan. Class and family plans can be made today (console wizard, F-PLAN-002 P2-6). A self plan needs the self-plan screens of F-PLAN-002 P2-7a, which are not on main.

- **Until P2-7a**: the learner side shows Next from the default route (no "In your plan" marks); no learner screen asks for a plan. The grown-up side shows "Set a plan to guide what comes next." on the Plan screen premium state (section 3.9.1) and, on the console, F-APP-001's parent home already offers **Plan the week** and **Plan the term**.
- **After P2-7a**: the self-plan entry of F-PLAN-002 (its proposal card and Profile row) is the learner's way to set one; this spec adds nothing on learner screens and no commerce word.
- M1 (section 6.0) states this: plan guidance for class and family plans first; self plans after P2-7a.

### 3.10 Old clients, stored entitlements and data

| Case | Behaviour |
|---|---|
| App build before E3-2 (any switch value) | unchanged: no quest-level rule exists; the Worker sends the same inbox |
| Console build before E3-9 | unchanged: wizard schedules Stage 1 for unlicensed spaces; devices with the switch on count closed items as `notReady` |
| Stored `entitlements` rows (`family_lifetime`, `group_license`, `school_seat`, any status) | unchanged; `tierForLearner` unchanged; inbox `tier` / `tierSource` / `tierValidUntil` unchanged |
| Device tier cache `tier:<learnerId>` | now read at cold start (section 3.4); `accessTier` adds the stale-premium and no-cache rules |
| Legacy `SubscriptionState` in `account-store` (F-SUB-001) | still makes `effectiveTier` premium, so access is open |
| Native store builds | the effective switch is off whatever the env says (section 3.4) |
| Snapshot | no new field; `completedAt` decides kept quests; `free-end-seen:<profileId>` is a per-device UI key, never synced |
| Roster summary | no new field; the console line reads `planProgress` only (section 3.9.2) |
| D1 | no migration |
| Worker | only the telemetry whitelist (E3-1b), deployed first |
| Curriculum `meta` | unchanged: `openQuestIds` is a generate-time input, never stored (section 3.9.3) |

### 3.11 Copy, glossary, anti-shame, localization

**Glossary (owned here; F-ROUTE-001 LR, F-BILL-002, F-BROWSE-001, F-SITE-002, F-APP-001 and F-REPORT-001 cite it, section 6.4).** "Route" and "plan" are never used for access: "Route" is the Learning Route page and "plan" is the learner's curriculum ("In your plan").

| Meaning | Learner screens (any age) | Grown-up screens | Shape |
|---|---|---|---|
| a lesson the learner cannot start yet | **Not open yet** (`learner.access.notOpen`; LR's `learner.myRoute.state.notOpen` and `legend.notOpen` carry the same value, asserted by a copy test) | **Opens with Family Lifetime** (family context) · **Opens with a Group License** (class or school context) · **Opens with Family Lifetime or a Group License** (context unknown, for example F-BROWSE-001's sampler or a caregiver message) | dotted ring (learner); none required (grown-up text) |
| the free part | never counted on learner screens; the free-end title says "your first lessons" | **"The first {lessons} lessons are free: {letters} letters, about {minutes} minutes. Everything finished stays."** (numbers from `freeLessonsFacts`); the static site, which cannot read data, says "Start free: the first lessons of Stage 1 are free, and everything finished stays." | — |
| all open quests done | **You finished your first lessons!** (once), then **You played every quest that is open for you.** (`learner.access.openForYou`; LR's `hero.openForYou` uses this key) | "{name} finished the free lessons." | — |
| the learner's curriculum | **In your plan**, **Next in your plan**, **Back to your plan** | "plan" (console wizard, reports) | solid ring |
| the one next quest | **Next** | — | `pin` |
| the way to the grown-up | **Ask a grown-up** / **Ask your teacher or a grown-up** / **See how to open it** (section 3.7 table) | **Open billing** (F-BILL-002's label; never "See plans") | — |
| replay | **Play a favorite again** (`learner.access.replay.cta`, US spelling, shared with LR) | — | — |

- **Messages** (English drafts; Appendix A): `learner.access` (`notOpen`, `cell.notOpenA11y(title)`, `preview.line`, `ask.family`, `ask.class`, `ask.self`, `back.cta` "Back to open lessons", `freeEnd.title`, `openForYou`, `practiceWords.cta`, `readStory.cta`, `replay.cta`, `home.cta` "Back home", `practice.subtitle` "Keep practicing"), `learner.routeNext` (`tag.next`, `tag.inPlan`, `home.subtitle`, `results.caption`, `results.backToPlan`), `caregiver.plan.freePlan` (`line(lessons, letters, minutes)`, `lineNoLetters(lessons, minutes)`, `stories(n)`, `topics(n)`, `promise.family(name)`, `promise.self`, `classLine.family(name)`, `classLine.self`, `freeEnd.family(name)`, `freeEnd.self`, `setPlan`, `setPlanWeb`), `caregiver.access` (`freeEnd(name, product)`, `product.family`, `product.class`, `product.either`), `caregiver.gating['quest-closed']`, `console.access` (`freeEnd`, `planWaiting`, `freePlan`, `product.*`, `openBilling`), `console.curriculum.freeDays` (`warning(lessons, lastWeek, n, product)`, `shortPlan(lastWeek)`, `useWeeks(weeks)`), `a11y.access` (`next`, `inPlan`, `notOpen(title)`). Korean and Spanish overlays follow the F-I18N-001 native-review flow (shipped hidden until reviewed).
- **"Day" is never shown.** No learner or grown-up string says "day 1", "day 2" or "two days"; "route day" is an internal term of section 3.1 only (OD-8).
- **Banned on every learner string of this spec** (a local fixture with es and ko equivalents, `logic/__tests__/access-banned-fixture.ts`, plus the shared lists): `Premium`, `price`, `buy`, `pay`, `trial`, `expired`, `ended`, `locked` (as a word), `unlock`, `left`, `only`, `remaining`, `late`, `skipped`, `wrong`, `not in your plan`, `Family Lifetime`, `Group License`, `day` / `days` (as words), `%`, `\d+ ?/ ?\d+`, digits, emoji and emoji-capable symbols. **On self-audience learner strings also**: `grown-up`.
- **Banned on grown-up copy of this spec**: the F-PAR-001 §3.6 phrases, "trial", "expires", "limited time", any countdown, any price, any comparison with other learners, "day" / "days" (as words).
- Each string passes the length budget (`packages/i18n/src/__tests__/length-budget.test.ts`).

### 3.12 Telemetry (Worker first; rows in `docs/roadmap/TELEMETRY-NAMES-2.md` section N)

| Name | Payload | When |
|---|---|---|
| `access.preview_opened` | `{ stage: StageKey, day: number, from: 'journey' \| 'home' \| 'route' \| 'results' \| 'library' \| 'player' }` | a lesson page opens in preview (`day` is the internal route day) |
| `access.help_asked` | `{ from: 'episode' \| 'home' \| 'results' \| 'library', audience: 'family' \| 'class' \| 'self' }` | the ask button is pressed (before the gate) |
| `access.free_end_reached` | `{ freeDays: number, placedOut: boolean }` | the first time `free-end` is shown on this device for this profile |
| `route.next_started` | `{ source: 'class' \| 'school' \| 'family' \| 'self' \| 'cursor', surface: 'home' \| 'results' \| 'journey' \| 'episode' \| 'route' \| 'placement' }` | a quest that was `routeNext` is started from that surface |
| `route.offplan_finished` | `{ source: 'class' \| 'school' \| 'family' \| 'self', stage: StageKey }` | a quest outside the plan is completed while a leading source exists |

- E3-1b adds the five names to `TELEMETRY_EVENT_NAMES` and the exact-list tests (`packages/content-schema/src/__tests__/telemetry.test.ts`, `packages/backend/src/__tests__/telemetry.test.ts`); the Worker deploys on merge, **before** any app build that sends them (an event the old Worker rejects is dropped, never retried). `paywall.viewed.from` gains three values (changed payload, section D style; the Worker accepts any payload).
- Active profile only, through the existing offline queue; codes, stage keys and counts only; no quest title, no name, no price, no tier word. F-BROWSE-001 sends none of these.

### 3.13 Wireframes (drafted with this spec, promoted in E3-0)

| File | Screen / state | Audience |
|---|---|---|
| `design/wireframes/journey/grid-plan-and-access.md` | Journey marks: Next, In your plan, Not open yet; states per tier and switch | learner |
| `design/wireframes/episode/detail-access-preview.md` | lesson page: plan tags, preview of a closed lesson, ask button by audience | learner |
| `design/wireframes/home/next-and-free-end-card.md` | Home card (2): next in plan, route next, free-end card once, practice card | learner |
| `design/wireframes/results/back-to-plan-and-free-end.md` | Results teaser: next in plan, back to your plan, end of the free lessons | learner |
| `design/wireframes/library/access-and-plan-tags.md` | story and word-topic tiles: Not open yet, In your plan | learner |
| `design/wireframes/billing/plan-status-free-lessons.md` | the free-plan lines inside F-BILL-002's Plan screen (`billing/plan-status.md`) | parent / self-learner behind the gate |
| `design/wireframes/console/curriculum-free-days.md` | wizard preview, warning and short-plan state for an unlicensed space | teacher / parent |
| `design/wireframes/console/free-lessons-line.md` | the free-lessons line on roster cards, the parent home card, the on-device dashboard row and the report | teacher / parent (space owner) |

The draft `paywall/free-plan-days.md` of revision 1 is replaced by `billing/plan-status-free-lessons.md`.

### 3.14 Accessibility

- **No colour-only meaning.** Next = drawn `pin` plus the word in the label; In your plan = solid ring plus the word; Not open yet = dotted ring plus the words on the page and in the cell label. Shapes use `border.shape` (4.55:1 on paper, F-ROUTE-001 R-2b); the E3-D mock checks solid against dotted in greyscale and protanopia at the Journey cell size.
- **Labels equal what is shown.** A cell label reads title, then state words in the order Next, In your plan, not open yet. The preview card is a group whose label reads the line; the buttons are buttons with their text as label.
- **Targets.** Cells keep their size; the ask button, **Back to open lessons**, **Practice words** and **Play a favorite again** use `Button` (`touchTarget.min` or larger). Body text 18 or larger; reflow at 320 x 568, landscape and 200 % text.
- **Focus.** On the preview page focus lands on the title, then the quest list, then the preview card. On the free-end card focus lands on the title.
- **Motion.** Nothing new animates; the free-end card uses the existing Hoya `cheering` pose (static under reduced motion).

### 3.15 Privacy and child safety

- No new data leaves the device. Access is computed on the device from the tier cache, the snapshot and the bundled catalogue; it works offline. The console line reads only counts it already receives.
- The learner never sees a price, a product name, "Premium" or a purchase button. The ask button opens the gate (`PinEntry`); only a self-only device with no PIN opens the Plan screen directly (F-LEARN-001 `gateOpensDirectly`). The Plan screen itself has no price (F-BILL-002).
- **No recurring purchase prompt to a learner.** The ask appears on a learner screen only after the learner taps a closed lesson or tile, and once at the end of the free lessons. Home never shows it twice; Journey and the Learning Route never show it.
- No ads, no third-party call, no new storage outside `platform/storage.ts`.
- Grown-ups learn one thing they could not see before (section 3.9.2), from data they already receive; no new summary field, no learner name in a URL, and never to a teacher who does not own the space.
- Anti-shame: kept quests, cards and stars are never removed; no countdown, no "trial", no streak or day count tied to the boundary; the free-end moment is a celebration of finished lessons.

### 3.16 States, errors, offline

- **New learner, switch on, free**: the free lessons open, Next on `letters-q1`; everything else visible with Not open yet.
- **Free learner in the middle of the free lessons**: Next on the first unfinished free lesson; finishing the last one shows the free-end celebration once (Results or Home, whichever comes first).
- **Free learner who played past the free lessons before the switch turned on**: every finished quest stays open (`open-kept`); with the promise (OD-12 default) every Stage 1 lesson stays open too; the first unfinished closed lesson shows Not open yet; Next points at an open unfinished lesson if one exists, else `free-end`.
- **Free learner in the middle of Stage 1 before the flip** (OD-12 default): nothing changes for them on the flip; the Plan screen adds "All of Stage 1 stays free for {name}."; Stage 2 and Stage 4 tastes show Not open yet. Under OD-12 (b): unfinished Stage 1 lessons past the free ones close; kept ones stay.
- **Placed-out free learner** (tested out of Stage 1): Next offers no placed-out replay; `free-end { placedOut: true }`; the free-end card's primary is **Practice words**; the placement result's primary opens the first free word topic.
- **Free class learner**: the ask reads "Ask your teacher or a grown-up"; the Plan screen adds the class line; the teacher (space owner) sees `plan-waiting` on the roster card once every open plan item is done.
- **Adult learning alone (self-only device)**: the ask reads "See how to open it" and opens the Plan screen; no learner string says "grown-up".
- **Cold start, offline, premium through a space**: the tier cache is loaded before the first render and the first derivation, so every lesson stays open and no plan item is removed; a learner with a membership but no cache yet fails open.
- **Free learner becomes premium** (inbox says premium): every closed lesson opens at the next render; derivation adds the plan items it skipped; no message besides what the Plan screen's covered / premium states already show.
- **Premium lapses** (inbox says free): kept and promised lessons stay open; other unfinished closed lessons close; plan items become `notReady`; no learner-facing message about the change.
- **Offline**: identical to online with the last cached tier (section 3.4).
- **Native store build with the env switch set**: identical to switch off.
- **Catalogue and bundle disagree** (a parity break): `freeQuests` and `gridLessons` come from the shared catalogue, so a quest the bundle has and the catalogue lacks is `open-not-a-lesson` (fails open); the existing parity test fails CI first.
- **No plan**: no In your plan mark; Next comes from the default route.
- **Storage write for `free-end-seen` fails**: the celebration may show again later (acceptable; it never shows more than once per session).

### 3.17 Behaviours (Given / When / Then; counts on today's catalogue)

- **Given** the switch on (web) and a new free learner created after the flip, **when** the Journey opens, **then** `stage1-letters` carries Next, `stage1-letters` and `stage1-life` carry no ring, the other six playable cells carry the dotted ring with the label "not open yet", and no cell is hidden.
- **Given** the same learner opens "New Year & Festivals", **then** the page lists its quest with title, blurb and letters, the row shows "Not open yet" instead of Start, one preview card offers "Ask a grown-up" (family device) and "Back to open lessons", and `access.preview_opened { stage: 'stage1', day: 3, from: 'journey' }` is sent.
- **Given** a self-only device, **then** the same card's button reads "See how to open it" and opens the Plan screen without the PIN when no PIN is set.
- **Given** the learner finishes `life-q3` (the last free lesson), **then** Results shows "You finished your first lessons!" with the cards earned in the free lessons, Back home, Practice words and the ask, and `access.free_end_reached { freeDays: 2, placedOut: false }` is sent once; the next Home shows the practice card with no ask.
- **Given** a free learner created before the flip who finished `stage1-rites-q1` on an older build, **when** the switch turns on, **then** every Stage 1 lesson stays playable, `stage2-life` shows Not open yet, and the card from rites stays in the Library.
- **Given** a premium learner with a self plan whose next item is `stage1-life-q2` dated Wednesday, **when** Home opens on Monday with no assignment for today, **then** card (2) offers `life-q2` with the subtitle "Next in your plan", and the Journey shows Next on `stage1-life` and In your plan on the cells of the items inside the horizon.
- **Given** that learner plays `stage2-nature-q1` (not in the plan), **then** it plays without any warning, Results says "Back to your plan" and names `life-q2`, and `route.offplan_finished { source: 'self', stage: 'stage2' }` is sent.
- **Given** a class item dated Thursday and a family item dated today, **then** Home card (2), the Results teaser, the Journey Next and the Learning Route Continue all name the family item (due first), and In your plan marks the class plan's items (the leading source).
- **Given** a classic class plan and a family curriculum, **then** Next follows the class plan (higher rank) and the Learning Route goal comes from the family curriculum (classic plans set no goal).
- **Given** the switch off, **then** every quest is open for every learner, no ring or preview exists, and the Plan screen says "Stage 1 is open to everyone."; plan marks and Next still show.
- **Given** a native build with `EXPO_PUBLIC_CONTENT_GATING_ENABLED=true`, **then** it behaves exactly as with the switch off.
- **Given** a free class with the switch on in the console, **when** the teacher previews a 12-week plan, **then** the wizard shows "The free plan covers the first 6 lessons (weeks 1 to 3). {n} more lessons open with a Group License. They are left out of this plan.", "This plan has lessons until week 3. After that it has stories and practice." and **Use 4 weeks**.
- **Given** that class learner has done every open item of the published plan, **then** the teacher's roster card shows "{name} finished everything open in this plan. {n} more lessons open with a Group License." with Open billing; a co-teacher who does not own the class sees nothing.
- **Given** a premium family offline for ten days, **then** every lesson stays open (stale premium counts for access); the Plan screen reached through the gate shows the state `effectiveTier` gives.
- **Given** a licensed-class learner on a fresh device that has never synced, **then** every lesson is open (membership, no cache: fail open) and derivation removes no plan item.

## 4. Non-goals and out of scope

- Turning the switch on in production, Stripe Live, real prices on public pages (owner, OD-2).
- The LEARNING ROUTE page, its tab and its rename (LR); this spec supplies `routeNext`, `planView`, the predicate and the glossary, and LR-5 draws the page's free-end state.
- The Plan screen, billing on app.hangulroute.com and the billing page (F-BILL-002); this spec supplies lines only.
- Parent and teacher homes and reports (F-APP-001, F-REPORT-001); this spec supplies one line and its function.
- The grown-up content browser (F-BROWSE-001); it calls `browseQuestOpen` (section 3.3) and writes no progress.
- The intro site's wording (F-SITE-002); the free-plan claim flips in E3-11 with the site's `freePlan: 'firstDays'` claim key and the wording of section 3.11.
- Server-side enforcement, receipts, store purchases (F-IAP-002), any free limit counted in minutes or calendar days, a timed trial.
- New gating of stages for premium learners; any change to `tierForLearner`, entitlement rows, the inbox or the roster summary.
- Changes to the F-PLAN-002 generator beyond the optional `openQuestIds`; the self-plan screens (P2-7a).

## 5. Tests

| File | Level | Coverage |
|---|---|---|
| `content-schema/src/__tests__/route-days.test.ts` | unit, 100 % | order; one day per playable cell; preview cells and story quests excluded; frozen fixture: eight days; live catalogue: the six free ids (failure message names this spec); minutes sums and rounding; `gridLessonIds`; `freeLessonsFacts` = 6 / 18 / 25; `routeDayOfQuest` for a lesson, a story, an unknown id |
| `content-schema/src/__tests__/free-lessons-line.test.ts` | unit, 100 % | each code fires and does not fire at its threshold; switch off, not owner, covered -> null; product by space kind; no string in the output |
| `content-schema/src/__tests__/curriculum-generate.test.ts`, `curriculum-regenerate.test.ts` (extend) | unit | `openQuestIds` absent = byte-identical drafts (goldens A, B unchanged); present = quests outside go to `locked[]` with `premium-needed`; the free lessons equal the first six items of the default self plan (steady) and class plan |
| `content-schema/src/__tests__/telemetry.test.ts`, `backend/src/__tests__/telemetry.test.ts` (extend) | unit, integration | five new names in the exact list; Worker accepts them |
| `mobile/src/logic/__tests__/content-access.test.ts` (extend) | unit, 100 % | `questAccess` rule order for every quest x tier x switch x kept x promise; `browseQuestOpen` full and sampler with the switch on and off; `isContentLocked` golden unchanged; `isStageEntitled` golden 7 x 2 unchanged; switch-off golden: all open |
| `mobile/src/config/__tests__/flags.test.ts` (extend) | unit | `gatingActive`: web on, web off, ios and android always off |
| `mobile/src/store/__tests__/tier-store.test.ts` (extend) | unit | `accessTier`: stale premium counts, a free inbox closes, legacy subscription opens, membership without cache opens, no membership and no cache is free; `questOpenFor` equals the hook's predicate; `keepsStage1Promise` with createdAt, oldest completedAt, unset date |
| `mobile/src/store/__tests__/bootstrap.test.ts` (extend) | unit | account and tier hydrate resolve before `rederiveAllLocal`; a premium-via-space learner offline keeps every plan item after the first derivation |
| `mobile/src/store/__tests__/plan-store.test.ts` (extend) | unit | `unlockedStagesFor` reads `accessTier`; `deriveFor` and `reconcile` use `questOpenFor` |
| `mobile/src/logic/__tests__/next-quest.test.ts`, `cursor-context.test.ts` (extend) | unit | `isQuestOpen` omitted = today; closed quests skipped |
| `mobile/src/logic/__tests__/route-next.test.ts` | unit, 100 % | step 1 equals `assignmentsForToday`; the Thursday-class / today-family example; leading source by rank then newest `assignedAt`; inside a source `targetDate` then list order; classic plans count; dates never filter; closed and unknown items skipped; next source when the leading one has nothing; cursor fallback; placed-out free -> `free-end { placedOut: true }`; placed-out premium -> today's fallback; `free-end` vs `rest`; `justCompleted`; `planView` horizon and leading source |
| `mobile/src/logic/__tests__/route-next.agreement.test.ts` | unit | section 3.5 cross-spec golden (Home, Results, Journey, episode; `buildMyRoute` once LR-3b merges) |
| `mobile/src/logic/homework/__tests__/plan-derivation.test.ts`, `gating.test.ts` (extend) | unit, 100 % | closed items `notReady`, reconcile removes pending closed items, re-derive after premium adds them; `quest-closed` rejection |
| `mobile/src/logic/homework/__tests__/mission-builder.test.ts` (extend) | unit | card (2) order; free-end card once (key unset), practice card after (key set, no ask); replay and explore only among open quests; three cards always |
| `mobile/src/logic/quest-flow/__tests__/results-teaser.test.ts` (extend) | unit | target = `routeNext`; captions; back to your plan; free-end replaces the card once; openForYou line after |
| `mobile/src/logic/__tests__/access-copy.test.ts` | unit | `askFor` table (family, class-only, self); every new learner string in en / es / ko: banned fixture, no digits, no emoji, no "grown-up" on self strings, length budget; grown-up strings: F-PAR-001 list, no "day", no price; `learner.access.notOpen` equals LR's `state.notOpen` and `legend.notOpen` once LR-1 has merged |
| `mobile/src/logic/__tests__/plan-free-lines.test.ts` | unit | the Plan screen lines from data; zero-count lines hidden; promise, class and free-end lines in order; switch-off copy unchanged; no digit typed in a string |
| `web/src/lib/console/__tests__/curriculum.test.ts`, `config.test.ts` (extend) | unit | `openQuestIds` passed only for unlicensed spaces with the switch on; warning text by space kind; last week with a lesson; short-plan suggestion; env parsing |
| `web/src/lib/console/__tests__/free-lessons-line-view.test.ts` | unit | roster card shows `plan-waiting` only for the space owner, uncovered space, switch on, `notReady > 0` and `done === total` |
| `mobile/e2e/web/free-days.spec.ts` | e2e | build with `EXPO_PUBLIC_CONTENT_GATING_ENABLED=true` and `EXPO_PUBLIC_FREE_PLAN_SINCE` set: Journey rings, preview page, gate on the ask button (family and self-only devices), direct navigation to a closed quest lands on the preview, free-end once on Results then the practice card on Home, kept quest replay, a pre-flip profile in the middle of Stage 1 keeps Stage 1, 320 x 568 and 1180 x 820, offline |
| `mobile/e2e/web/plan-next.spec.ts` | e2e | a seeded self plan: Home card (2), Journey Next and In your plan, off-plan quest then Back to your plan; switch-off build shows no ring |

Coverage: new pure modules (`route-days.ts`, `free-lessons-line.ts`, `route-next.ts`, the `content-access.ts` additions) 100 %; `apps/mobile/src/logic` stays at or above its rolling target (`docs/tests/coverage-targets.md`); screens are verified by e2e (the mobile vitest lane does not render components).

## 6. Rollout and PR breakdown

### 6.0 Milestones

| Milestone | What users see | PRs | Production |
|---|---|---|---|
| **M1 "Follow my plan"** (item 10) | one Next on Home, Journey, lesson page, Results and the Learning Route; In your plan marks; Back to your plan; no locks for anyone. Plan guidance for class and family plans first; self plans after F-PLAN-002 P2-7a | E3-0, E3-1a, E3-1b, E3-D, E3-2, E3-3, E3-4, E3-5, E3-6, E3-7 | live on merge (the switch is off, so access is unchanged; E3-2's cold-start fix ships too) |
| **M2 "Free lessons"** (item 9) | previews past the free lessons, the free-end moment, Plan screen lines, console warning and short-plan help, the grown-up line | E3-8, E3-9, E3-12, E3-11 (and the access parts of E3-5 to E3-7, inert while off) | built and tested in preview builds with the switch on; production flip on the web by the owner (OD-2) |

### 6.1 PR table

| PR | Content | Size | Needs |
|---|---|---|---|
| E3-0 | `docs`: this spec; the nine wireframes; amendment lines in F-ENT-001 §3.5 (the paywall is replaced by F-BILL-002's Plan screen; free-plan lines from this spec), F-STORY-004 §3.9 (one switch, "Not open yet", dotted ring), F-ROUTE-001 §3.5 (`routeNext` and `planView` owned here; LR-3b imports; LR-5 draws `free-end`), F-PLAN-002 §3.1 (`openQuestIds`), F-PLC-001 §3.1 step 7; telemetry rows (`TELEMETRY-NAMES-2.md` section N); `docs/specs/README.md` index line | S | — |
| E3-1a | `feat(content-schema)`: `catalog/route-days.ts` (`routeDaysOf`, `FREE_ROUTE_DAYS`, `freeRouteQuestIds`, `gridLessonIds`, `routeDayOfQuest`, `freeLessonsFacts`) + tests + index exports | S | E3-0 |
| E3-1b | `feat(content-schema,backend)`: five telemetry names + exact-list tests. **The Worker deploys on merge, before any app build that sends them** | S | E3-0 |
| E3-D | `design`: mock of the In your plan solid ring, the Not open yet dotted ring, the Next pin on a cell, the preview card, the free-end card and the practice card (`design/components/RouteMarkers/spec.md` + preview), greyscale and protanopia check of solid against dotted | S | E3-0 |
| E3-2 | `feat(mobile)`: `content-access.ts` quest kind, `freeQuests`, `gridLessons`, `promiseQuests`, `questAccess`, `isQuestOpen`, `questOpenPredicate`, `browseQuestOpen`; `config/flags.ts` `gatingActive` and doc comment (`isContentLocked` reads it); `tier-store` `accessTier`, `questOpenFor`, `useQuestAccess`, `keepsStage1Promise`; `plan-store` `unlockedStagesFor` -> `accessTier`; **bootstrap order** (account and tier hydrate before `ready` and `rederiveAllLocal`; `App.tsx`); goldens (switch off, `isContentLocked`, `isStageEntitled`). No UI | M | E3-1a |
| E3-3 | `feat(mobile)`: `NextQuestInput.isQuestOpen`, `CursorContext.isQuestOpen`; `DeriveInput.isQuestOpen` + reconcile through `questOpenFor`; `canAssignQuest` `quest-closed` + `caregiver.gating` string; Home fallbacks among open quests; story-pick grid rule | M | E3-2 |
| E3-4 | `feat(mobile)`: `logic/route-next.ts` (`routeNext`, `planView`) + tests + agreement test; Home card (2) fallback and subtitle; Results teaser target, captions, Back to your plan; placement result primary -> `routeNext` (F-PLC-001 amendment); `learner.routeNext` en strings; `route.next_started`, `route.offplan_finished`. **Merges before LR-3b** | M | E3-3, E3-1b deployed |
| E3-5 | `feat(mobile)`: Journey Next, In your plan ring, Not open yet ring and labels; `a11y.access` en strings | M | E3-4, E3-D |
| E3-6 | `feat(mobile)`: episode page plan tags and preview state (captions, preview card, `askFor` and its audience labels, gate with `from: 'episode'`, Back to open lessons); `QuestPlayer` guard; Homework screen caption; `PinEntry` / `Paywall` `from` values; `learner.access` en strings; `access.preview_opened`, `access.help_asked` | M | E3-4, E3-D, E3-1b deployed |
| E3-7 | `feat(mobile)`: Home free-end card once and practice card; Results end-of-free-lessons card, openForYou line and `free-end-seen` key; Library tile word, dotted ring and In your plan tag; `access.free_end_reached` | M | E3-6 |
| E3-8 | `feat(mobile,i18n)`: `caregiver.plan.freePlan` en strings and the free-plan lines on F-BILL-002's Plan screen (switch on), promise, class and free-end lines, premium no-plan line | S | E3-2, F-BILL-002 B-9 merged |
| E3-9 | `feat(content-schema,web)`: optional `CurriculumParams.openQuestIds` in the generator and `regenerateFrom` (omitted from stored params); console `contentGatingEnabled()`; wizard passes free quest ids for unlicensed spaces; warning by space kind, last week with a lesson, short-plan line and **Use {weeks} weeks** | M | E3-1a |
| E3-12 | `feat(content-schema,mobile,web,i18n)`: `catalog/free-lessons-line.ts`; `caregiver.access` and `console.access` en strings; the line on the on-device parent dashboard child row and the console family and class roster cards (and the F-APP-001 parent home child card when A-5b has merged), owner-only, with Open billing | M | E3-1a, E3-2 |
| E3-11 | `test(e2e)`: `free-days.spec.ts`, `plan-next.spec.ts` with a temporary build flag; `docs/launch/owner-runbook.md` step "Turn on the free plan (web)": set `EXPO_PUBLIC_CONTENT_GATING_ENABLED=true` and `EXPO_PUBLIC_FREE_PLAN_SINCE=<flip date>` on `hangul-route-app` and `NEXT_PUBLIC_CONTENT_GATING_ENABLED=true` on `hangul-route-web` in the same release as Stripe Live; flip F-SITE-002's `freePlan` claim to `'firstDays'` and the landing claim test in the same release; release checklist line: native store builds stay ungated until F-IAP-002 | S | E3-5..E3-9, E3-12 |

E3-10 (route page hero) is withdrawn: LR-5 draws the route page's `free-end` state from `routeNext` with `learner.access.openForYou` (section 6.4).

### 6.2 Sequence notes

- E3-3 to E3-7 touch `HomeScreen.tsx`, `JourneyScreen.tsx`, `EpisodeDetailView.tsx`, `mission-builder.ts`, `results-teaser.ts` and `learner.ts`, which F-ROUTE-001 (R-3 #317, R-4b), F-PLC-001 (P-7, P-8 #312 #314), F-STORY-004 and LR also edit. Keep each edit small and rebase on the newest `origin/main` before review (CLAUDE.md section 10).
- **E3-4 merges before LR-3b**, so LR-3b imports `routeNext` and `planView` instead of writing its own (both PR tables record it).
- **E3-8 merges after F-BILL-002 B-9** (it adds keys to `caregiver.plan`, which B-6 creates, on the screen B-9 builds).
- Shared append-only files: `packages/content-schema/src/index.ts`, `schemas/telemetry.ts` and its test. Append, never reorder.
- The access parts of E3-5 to E3-7 merge while the switch is off; they are inert in production and covered by the e2e build with the switch on.
- **Docs PRs of the 2026-10-11 wave** (they share `docs/specs/README.md`, `design/wireframes/README.md`, `docs/roadmap/TELEMETRY-NAMES-2.md` and `F-ROUTE-001-my-route-overview.md`). Merge order (fixed 2026-10-11): F-APP-001 A-0 (#341) and F-BILL-002 B-0 (#336) are merged; then F-SITE-002 (#335) -> F-REPORT-001 (#337) -> F-FEEDBACK-001 (#338) -> F-ENT-003 E3-0 (#339) -> F-BROWSE-001 (#340) -> LR-0 (#344, after this spec, which owns the shared predicate, `routeNext` and the glossary). Each PR already carries the index lines of the PRs before it exactly as they land on `main`; the telemetry sections are fixed: L F-REPORT-001, M F-FEEDBACK-001, N this spec.

### 6.3 Ownership

| Code | Owner | Others |
|---|---|---|
| "may this learner start this quest" (`questAccess`, `questOpenFor`, `useQuestAccess`, `browseQuestOpen`, `gatingActive`) | this spec (E3-2) | LR (`isQuestOpen` input), F-BROWSE-001 (`browseQuestOpen`); F-STORY-004's `isContentLocked` stays for stories and topics |
| the cursor (`nextQuestAfter`) | F-QUEST-002 / F-ROUTE-001 | this spec adds the optional `isQuestOpen` only |
| "what is next" and "In your plan" (`routeNext`, `planView`) | this spec (E3-4) | Home, Results, Journey, episode page, Library, placement result, the Learning Route (LR-3b imports them) |
| route days and free-lesson facts (`routeDaysOf`, `freeLessonsFacts`) | this spec (E3-1a) | Plan screen lines, console, the grown-up line |
| the access glossary (section 3.11) | this spec | LR, F-BILL-002, F-BROWSE-001, F-SITE-002, F-APP-001, F-REPORT-001 |
| the Plan screen | F-BILL-002 | this spec adds `caregiver.plan.freePlan` lines (E3-8) |
| the grown-up free-lessons line (`freeLessonsLine`) | this spec (E3-12) | F-APP-001 (parent home card), F-REPORT-001 (next-steps block) render it |

### 6.4 Contract with the sibling specs (amendment lines each sibling adopts in its own docs PR)

| Sibling | Section | Line to adopt |
|---|---|---|
| **LR** (`AMENDMENTS-ROUTE-LEARNING-ROUTE.md`) | §2 contracts, §4.4 | "`routeNext` and `planView` come from `apps/mobile/src/logic/route-next.ts` (F-ENT-003 §3.5, E3-4). LR-3b imports them; there is no `logic/my-route/next.ts`. `MyRouteModel.next` is `routeNext` (`source: 'cursor'` reads as `from: 'cursor'`); `inPlanEpisodeIds` is `planView().inPlanEpisodeIds`. E3-4 merges before LR-3b." Remove the line "Home and Results keep calling the shared cursor through their own code"; Home and Results call `routeNext` too. |
| LR | §4.5 | "Not open yet" is `learner.access.notOpen` (F-ENT-003 §3.11); `learner.myRoute.state.notOpen` and `legend.notOpen` carry the same value. The dotted ring is also the Journey's and the Library's shape. "No ask-a-grown-up prompt" holds **on the route page**; a learner who taps a not-open cell row reaches the episode preview, which carries the ask of F-ENT-003 §3.7. `hero.openForYou` uses `learner.access.openForYou` ("You played every quest that is open for you.") with **Practice words** or **Open Library** as the button; "Play a favorite again" is `learner.access.replay.cta`. |
| LR | §6.1, §11.1 | The free allowance line is F-ENT-003's `freeLessonsLine` (`console.access.*`): replace `freeLine` "Some quests open with a plan." and **See plans** with the F-ENT-003 §3.9.2 words and **Open billing**. |
| LR | §13 | LR-3b needs E3-4; LR-5 draws the route page's `free-end` state (F-ENT-003 E3-10 is withdrawn). |
| **F-BILL-002** | §4.7, §6.2, A3 | The free state's line on what is open is `caregiver.plan.freePlan.line(lessons, letters, minutes)` when the effective switch is on, else `free.open`; the promise, class and free-end lines and the premium no-plan line follow F-ENT-003 §3.9.1. E3-8 depends on B-9. |
| F-BILL-002 | §4.3 (billing page offer) | Add the offer line "Every lesson of every Stage, now and later" (moved from the old paywall bullet). |
| **F-BROWSE-001** | §4.2, BD6, §4.13, §10 | Remove "`flags.contentGatingEnabled` is not consulted". The sampler is `browseQuestOpen('sampler', gatingActive)` (F-ENT-003 §3.3): with the switch off a free grown-up sees every lesson open, as their learner does. `access.test.ts` asserts agreement with `questAccess`. |
| F-BROWSE-001 | §4.2 outline, §4.4, §6 | The outline line "Included with a plan" becomes "Opens with Family Lifetime or a Group License"; the button **See plans** becomes **Open billing**. The "Outline" tag stays (it names what the grown-up sees, not an access state). |
| **F-SITE-002** | OD-6, Appendix | `landing.plans.free.firstDays` = "Start free: the first lessons of Stage 1 are free, and everything finished stays." (no "two days", no number); flipped in F-ENT-003 E3-11. |
| **F-APP-001** | §3.8 parent home, §6.4 | The parent home child card renders F-ENT-003's `freeLessonsLine` (owner only) under the card's figures; the teacher roster card does the same. E3-12 adds it to A-5b's card when A-5b has merged, else A-5b adds it. |
| **F-REPORT-001** | §3.6 practice next | Row **P6 `free_plan`**: fires when F-ENT-003 `freeLessonsLine` is not null for this viewer (console: space owner, uncovered space, switch on); text from `console.access.freePlan` (or `planWaiting` when that fires); action **Open billing** for the space owner, none otherwise. Never on a teacher who does not own the space. |

## 7. Dependencies

- **On main:** `content-access.ts`, `entitlement.ts`, `cursor-context.ts` (R-4a #249), the shared catalogue (P2-2 #175), the generator (P2-3a #216), plan meta and the self plan schema (P2-4 #232), derivation with precedence (P2-5 #254), the console wizard (P2-6 #251), Journey without Premium (R-J #273), icons `pin` and the `later` pip shape, `border.shape` (R-2b #253), `audienceCopy`, `gateOpensDirectly`.
- **Not on main:** F-BILL-002 B-6 and B-9 (the Plan screen) for E3-8; LR-3b and LR-5 (the Learning Route's use of `routeNext`, after E3-4); F-APP-001 A-5b (the parent home card) for part of E3-12; the self-plan screens (F-PLAN-002 P2-7a) — without them a self plan exists only through restore or a future build, so M1's plan guidance is visible first for class and family plans; Stage 1 growth (F-QUEST-002 Q-7b, Q-8) does not move the free lessons.
- **External:** the design mock (E3-D); Korean and Spanish review of the new strings; the owner's production switch (OD-2); F-IAP-002 before any native gating (OD-13).

## 8. Decisions

Binding owner decisions applied: **2026-10-11 items 9, 10** (this spec); **D1** any age; **D2/D8** all copy through messages; **D3** anti-shame; **D5** amended: new gating is allowed for grid lessons past the free ones because the owner asked for it, still only behind the one switch, still with no commerce word on learner screens and no claim of a limit that is not enforced; **D7** no emoji; **D9** the 7 x 5 grid stays authoritative; **Stripe Live stays off**.

Spec decisions (engineering, reversible):

| # | Decision | Why |
|---|---|---|
| S1 | A route day is a property of the content (one playable cell in default route order), never shown, never a calendar day | the same boundary for every learner, offline, stable while cells grow, no "trial" reading |
| S2 | Access is quest-level and computed on the device; the server is unchanged | local-first, no migration, old clients untouched |
| S3 | One switch for every free-tier limit, default off, web only until F-IAP-002 | nothing is enforced while nobody can pay; store rules; a preview build shows the whole experience |
| S4 | Fail open: unknown ids, catalogue gaps, stale premium and a learner the server has not answered for yet never close a lesson | a child is never blocked by a data error |
| S5 | `routeNext` wraps the one cursor, reads plans through existing derived assignments, starts with Home's own `assignmentsForToday`, and is the only "next" in the app | one "next" for every surface (F-ROUTE-001 M4), Home and the other surfaces cannot disagree |
| S6 | Off-plan content has no mark; only Next and In your plan are drawn | "show the whole content, unlocked" with guidance, not a fence |
| S7 | One glossary of access words, owned here; "route" and "plan" are never access words | the siblings use the same words; no clash with the Learning Route or "In your plan" |
| S8 | The ask to a grown-up appears only after a learner tap, and once at the end of the free lessons | no pester-power pattern aimed at children |

## 9. Owner decisions and assumptions

**Owner decisions** (each has a default that applies until answered; each gates only the PRs named):

| Id | Question | Default | Alternatives | Gates | Reversible |
|---|---|---|---|---|---|
| OD-1 | What does "learnable up to about day 2" mean? **Note: with the switch on, the default narrows the free offer for new learners from all of Stage 1 (9 quests now, 15 later; the public "Stage 1 is always free" line) to 6 lessons. Please confirm this matches "show a bit more".** | the lessons of the first two playable cells of the default route: 6 lessons, 18 letters, about 25 minutes; previews of everything else ("show a bit more" read as "show everything, open the first part") | (b) all of Stage 1 stays the free plan (`FREE_ROUTE_DAYS` = 5 today); (c) two calendar days of open access (a timed trial; not recommended: anti-pressure rules); (d) one quest per day like Home's New card | E3-1a (one constant or the day rule) | yes |
| OD-2 | When is the free boundary enforced in production? | off until the owner turns on Stripe Live; on in preview builds; the owner flips the web env vars in one release (E3-11 runbook step) | on now, with sandbox checkout only (learners would meet a boundary nobody can pay past) | production flip only | yes |
| OD-3 | What stays open for a free learner who already played past the free lessons? | every quest they finished (any device); cards and stars always stay | also the rest of any lesson they started | E3-2 | yes |
| OD-4 | Free stories and word topics | keep D5: six sampler stories, Food, Animals, Colors, Numbers, under the same switch | more or fewer samplers (a content change in `shelf.sampler`) | none (data) | yes |
| OD-5 | Learners in a free class (no licence) | same rule as every free learner; the wizard warns the teacher; the ask names the teacher | free classes keep all of Stage 1 | E3-2, E3-9 | yes |
| OD-6 | Learner word and shape for a closed lesson | **resolved with LR-OD-8**: "Not open yet" with the dotted ring on the Journey, the Library and the Learning Route; no lock glyph on learner screens | the lock glyph everywhere (then LR changes too) | E3-5, E3-6, E3-7 | yes |
| OD-7 | Where "next" comes from | section 3.5: due today first (Home's card), then the leading plan source, then the default route | the default route always, plans only on Home's dated card (today's behaviour) | E3-4 | yes |
| OD-8 | "Day" on screens | never: no learner or grown-up string says "day"; the free part is named "the first lessons" | show "Day N" on lesson pages | E3-6, E3-7, E3-8 | yes |
| OD-9 | Plan screen free-state wording when the switch is on | the line of section 3.9.1 replaces "Stage 1 is open to everyone." | keep the Stage 1 line and add ours under it (would be untrue for new learners) | E3-8 | yes |
| OD-10 | Plan marks on the Journey | Next pin plus In your plan ring for the leading source's items inside the derivation horizon (7 days) | Next only; or the whole plan | E3-5 | yes |
| OD-11 | Offline premium for access | the last server word wins for access (stale premium keeps lessons open); a learner with a membership and no cache fails open; billing keeps the 7-day grace | 7-day grace for access too | E3-2 | yes |
| OD-12 | Do learners who started under "Stage 1 is always free" keep it? | **yes**: profiles whose start (created, or first finished quest) is before `EXPO_PUBLIC_FREE_PLAN_SINCE` keep every Stage 1 lesson open | (b) no: they follow OD-3 only (finished quests stay; unfinished Stage 1 lessons past the free ones close) | E3-2, E3-11 | yes (one env value) |
| OD-13 | Native store builds and the switch | the effective switch is off on iOS and Android until F-IAP-002 sells Family Lifetime in the app (Guidelines 3.1.1, 3.1.3(b); F-BILL-002 OD-5) | native builds with the switch on go only to TestFlight and internal testing | E3-2, release checklist | yes |

**Assumptions to verify:**

| # | Assumption | Verified in |
|---|---|---|
| a | the six free quest ids stay first after F-QUEST-002 Q-7b and Q-8 (they add quests to later cells only) | E3-1a live-catalogue test |
| b | a solid ring and a dotted ring are told apart at Journey cell size at 320 dp, in greyscale | E3-D mock |
| c | every class, family and self plan item reaches the device as a pending `snapshot.homework` entry `<sourceId>#<questId>` inside the horizon (P2-5) | E3-4 tests on derived fixtures |
| d | a plan generated with `openQuestIds` publishes a `meta` byte-identical in shape to one generated without it (the key is omitted from stored params) | E3-9 content-schema test |
| e | `gateOpensDirectly` already sends a self-only device with no PIN to the `Paywall` route from any `from` | E3-6 e2e |
| f | with the switch on, `planProgress.notReady` counts the closed items of that plan (stage-locked items are a subset of closed ones), and `total` counts derived items only (`summarize.ts:30-47`) | E3-12 test |
| g | a restored profile keeps its `createdAt` (profile schema `createdAt`, `schemas/profile.ts:33`) | E3-2 test |

## Appendix A — draft English strings (final copy is the dictionary's)

`learner.access`: `notOpen` "Not open yet" · `cell.notOpenA11y(title)` "{title}: not open yet. Opens the lesson page." · `preview.line` "This lesson is not open yet. You can still see what it teaches." · `ask.family` "Ask a grown-up" · `ask.class` "Ask your teacher or a grown-up" · `ask.self` "See how to open it" · `back.cta` "Back to open lessons" · `freeEnd.title` "You finished your first lessons!" · `openForYou` "You played every quest that is open for you." · `practiceWords.cta` "Practice words" · `readStory.cta` "Read a story" · `replay.cta` "Play a favorite again" · `home.cta` "Back home" · `practice.subtitle` "Keep practicing"
`learner.routeNext`: `tag.next` "Next" · `tag.inPlan` "In your plan" · `home.subtitle` "Next in your plan" · `results.caption` "Next in your plan" · `results.backToPlan` "Back to your plan"
`learner.storyTile.state.locked` (changed value) "Not open yet"
`caregiver.plan.freePlan`: `line(l, k, m)` "The first {l} lessons are free: {k} letters, about {m} minutes. Everything finished stays." · `lineNoLetters(l, m)` "The first {l} lessons are free: about {m} minutes. Everything finished stays." · `stories(n)` "{n} short stories" · `topics(n)` "{n} word topics" · `promise.family(name)` "All of Stage 1 stays free for {name}." · `promise.self` "All of Stage 1 stays free for you." · `classLine.family(name)` "{name}'s teacher can open every lesson for the class." · `classLine.self` "Your teacher can open every lesson for the class." · `freeEnd.family(name)` "{name} finished the free lessons." · `freeEnd.self` "You finished the free lessons." · `setPlan` "Set a plan to guide what comes next." · `setPlanWeb` "Plans are made in the grown-up area: Plan the term."
`caregiver.access`: `freeEnd(name, product)` "{name} finished the free lessons. More lessons open with {product}." · `product.family` "Family Lifetime" · `product.class` "a Group License" · `product.either` "Family Lifetime or a Group License"
`caregiver.gating['quest-closed'](name)` "{name} can play this lesson with Family Lifetime or a Group License."
`console.access`: `freeEnd(name, product)` "{name} finished the free lessons. More lessons open with {product}." · `planWaiting(name, n, product)` "{name} finished everything open in this plan. {n} more lessons open with {product}." · `freePlan(l, product)` "On the free plan, the first {l} lessons are open. More lessons open with {product}." · `product.family` "Family Lifetime" · `product.class` "a Group License" · `openBilling` "Open billing"
`console.curriculum.freeDays`: `warning(l, w, n, product)` "The free plan covers the first {l} lessons (weeks 1 to {w}). {n} more lessons open with {product}. They are left out of this plan." · `shortPlan(w)` "This plan has lessons until week {w}. After that it has stories and practice." · `useWeeks(n)` "Use {n} weeks"
`a11y.access`: `next` "Next" · `inPlan` "In your plan" · `notOpen(title)` "{title}: not open yet. Opens the lesson page."

## Appendix B — worked example (today's catalogue, web, switch on, free learner created after the flip)

| Step | Journey | Home card (2) | Results |
|---|---|---|---|
| new | Next on Meet the Letters; dotted ring on rites, nature, crafts, Stage 2 life and nature, Stage 4 rites | New: `letters-q1` | — |
| finished `letters-q1..q3` | Next on Around the Korean Table | New: `life-q1` | Next up: `life-q1` |
| finished `life-q3` | no Next; six dotted rings | (the celebration was shown on Results) practice card: Food words, "Keep practicing" | You finished your first lessons! (the cards earned, up to six), Back home, Practice words, Ask a grown-up |
| next day | unchanged | practice card, no ask | after a replay: "You played every quest that is open for you." and Practice words, no ask |
| becomes premium | no rings; Next on New Year & Festivals | New: `rites-q1` | — |

## Review log

**Revision 2 (2026-10-11), after two reviews of revision 1.** Every blocker and major finding is applied; minors are applied unless listed as rejected.

| Review | Finding | Disposition |
|---|---|---|
| 1 | blocker: two `routeNext` functions (this spec and LR §4.4) | applied: one module owned here (§3.5), one written rule with LR's leading-source rule inside step 2, `planView` for every "In your plan", classic plans count for Next and not for the goal, agreement golden, LR lines in §6.4, E3-4 before LR-3b |
| 1 | blocker: paywall section conflicts with F-BILL-002 | applied: §3.9.1 is a contribution to F-BILL-002's Plan screen (`caregiver.plan.freePlan`, no price, no button, no offer); wireframe moved to `billing/plan-status-free-lessons.md`; offer bullet moved to F-BILL-002's billing page |
| 1 | major: different words for the free limit; "the full route" is jargon | applied: glossary in §3.11; learner phrase "Not open yet" everywhere; one shape (dotted ring) on Journey, Library and Route; grown-up phrase names the product by context; "route" and "plan" never access words; sibling lines in §6.4 |
| 1 | major: "Ask a grown-up" breaks the any-age rule | applied: `askFor` by audience (family, class-only, self) in §3.7; banned "grown-up" on self strings; telemetry renamed `access.help_asked` with `audience` |
| 1 | major: "day" will confuse adults and learners | applied: "route day" internal only; grown-up copy "The first {lessons} lessons are free..."; learner title "You finished your first lessons!"; OD-8 resolved; F-SITE-002 OD-6 wording in §6.4; OD-1 lists calendar days as alternative (c) |
| 1 | major: default narrows the public Stage 1 promise silently | applied: OD-1 states it plainly; OD-12 keeps Stage 1 open for profiles that started before the flip (default), with the alternative; §3.16 state and an e2e case |
| 1 | major: Home nags children daily | applied: free-end card with the ask once per profile and device (shared with Results), then a plain practice card with no ask (§3.7, §3.15, S8) |
| 1 | major: free-end screens lead nowhere | applied: **Practice words** / **Read a story** actions; shared `openForYou` line on Home, Results and Route; placed-out free learners get `free-end { placedOut: true }` and word practice (§3.5 step 3) |
| 1 | major: the free limit is invisible on the adult side | applied: §3.9.2 `freeLessonsLine`: exact on the device, from `planProgress` on the console (no new summary field; the console never guesses which lessons were finished), owner only, product named; F-APP-001 and F-REPORT-001 lines in §6.4 |
| 1 | major: disagreement with F-BROWSE-001 | applied: `browseQuestOpen` in §3.3 reads the real switch; §4 and §6.3 corrected; F-BROWSE-001 line in §6.4 |
| 1 | major: console warning leads to empty plans | applied: warning by space kind with the week range, short-plan line and **Use {weeks} weeks** (§3.9.3) |
| 1 | major: item 10 does not work yet for subscribers without a plan | applied: §3.9.4 names P2-7a as the gate for self plans; M1 says so; "Set a plan" line on the Plan screen; learner side unchanged until P2-7a |
| 1 | minor: paywall list uses "quests" and "of the route" | applied: "lessons", letters and minutes from `freeLessonsFacts` |
| 1 | minor: favourite / favorite spelling | applied: US "favorite", shared key `learner.access.replay.cta` |
| 1 | minor: free-class learners get no fitting guidance | applied: class-only ask label and the Plan screen class line |
| 2 | blocker: tier cache never loaded at cold start; plan derivation runs before it; hook used in store actions | applied: §3.4 cold start order, `questOpenFor` (non-hook), `unlockedStagesFor` -> `accessTier`, no-cache fail-open rule, bootstrap test, §3.16 state |
| 2 | blocker: two `routeNext`, two closed-lesson words and glyphs, two owners of the route hero | applied: as review 1 blocker 1; OD-6 resolved to LR's "Not open yet" and dotted ring; E3-10 withdrawn, LR-5 draws the hero |
| 2 | major: `routeNext` disagrees with Home card (2) | applied: step 1 is `assignmentsForToday`; the Thursday / today example is a test and a behaviour |
| 2 | major: E3-8 and the wireframe contradict F-BILL-002 | applied: as review 1 blocker 2; E3-8 depends on B-9 |
| 2 | major: App Store / Google Play rules for the production switch | applied: `gatingActive` keeps native builds ungated until F-IAP-002 (§3.4, OD-13, E3-11 checklist) |
| 2 | major: E3-3 depends on E3-4 (placement) | applied: placement change moved to E3-4 |
| 2 | minor: no check at the point of play | applied: `QuestPlayer` guard and Homework caption (§3.6, E3-6, e2e) |
| 2 | minor: rule 5 needs a lesson set | applied: `gridLessons` in the registry, built from `gridLessonIds` |
| 2 | minor: F-BROWSE-001 contract unclear | applied: as review 1 major |
| 2 | minor: shared docs conflicts; Stage 1 promise on the flip | applied: merge order in §6.2; OD-12 (default keeps Stage 1 for earlier profiles, as review 1 asked) |

Rejected or changed from the suggestion (with reason):

- Review 1 suggested reusing LR's full `hero.openForYou` sentence ("... Play a favorite again or read a story.") on Home and Results. Changed: the shared sentence is "You played every quest that is open for you." and the actions are buttons, because no story is bundled today and the sentence must stay true in every build.
- Review 1 suggested the console line "{name} finished the free lessons" from synced completion. Changed: the roster summary has counts, not quest ids, so the console shows `plan-waiting` from `planProgress` (exact) and nothing when it cannot tell; the exact "finished the free lessons" line is shown on device surfaces, which have the snapshot. Adding a summary field was rejected (migration-free, consent allow-list unchanged).
- Review 2 suggested keeping the OD-3 default for learners who started under the Stage 1 promise. Changed: the default keeps Stage 1 open for them (OD-12), as review 1 asked, because the public promise was made to them; the owner can switch with one env value.
- F-BROWSE-001's "Outline" tag is kept (not renamed to an access word), because it names what the grown-up sees in the browser, not whether the lesson is open.
