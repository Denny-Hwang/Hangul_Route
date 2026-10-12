Status: ready (applied to `F-ROUTE-001-my-route-overview.md` by LR-0, this docs PR)

> **Applied 2026-10-11 in the LR-0 docs PR.** Every LR item that changes F-ROUTE-001 is now in that spec's text, marked with its id (for example "[LR-A3]"). This file keeps the rationale, the contracts with the sibling specs (section 2), the PR table (section 13) and the owner decisions (section 14). Owner decisions do **not** gate the whole amendment: each one gates only the PRs named in section 14, and each has a default that applies until the owner answers.
>
> Basis: `origin/main` `ea9049e4`. Every `file:line` below is at that commit unless it names an open PR. Open PRs it builds on: #317 (F-ROUTE-001 R-3, the screen and its strings) and #313 (R-9a, the console journey strip). Both may adopt the new string values from LR-0 before they merge; LR-1 renames whatever merged with the old values.

# Amendment to F-ROUTE-001: the page becomes LEARNING ROUTE — a learner tab, a destination, and a read-only view for parents and teachers

**Owner request 2026-10-11 (item 11, translated):** "A whole learning map page that shows where I must get to and where I am now. Name it LEARNING ROUTE." It is part of the UX request of the same day: the student side is tuned for learning (item 5), subscribers see all content and follow their own curriculum (item 10), and parents and teachers see each student's progress (items 4 and 6).

**Standing rules that apply here:**
- Any age: no age wording on shared surfaces.
- Child safety: grown-up gate, local-first data, no learner names in URLs.
- Anti-shame: no ranking, no comparison between learners, meters only fill, no red X.
- Strings: every UI string goes through `packages/i18n`. English is the default; Korean and Spanish strings come only after native review. Design tokens only, no emoji.
- Skills: reading, listening and writing only. Speaking is never shown (owner decision 2026-10-10).
- Commerce: no commerce on learner screens (F-ROUTE-001 D5). Stripe stays in sandbox.
- D1: additive only.

**Ids.**
- `LR-An` amends a section of F-ROUTE-001.
- `LR-n` is a PR (section 13).
- `LR-OD-n` is an owner decision (section 14).
- F-ROUTE-001's own ids (R-n, OD-n) keep their meaning.

---

## 1. Problem

F-ROUTE-001 built the page the owner asked for on 2026-10-10: **My route**, the whole road at a glance. On `ea9049e4` its logic is merged: R-1a, R-1b, R-2a, R-2b, R-W1, R-4a, R-7a logic, R-8, and the files in `apps/mobile/src/logic/my-route/`. The screen is in open PR #317, behind `flags.myRouteEnabled` (off). Against the 2026-10-11 request, four things are wrong or missing:

1. **The name.** The owner names the page **LEARNING ROUTE**. Every learner, caregiver and console string says "My route" or "journey". Examples:
   - `learner.myRoute.title` "My route" and `open.cta` "See my route" (#317);
   - `learner.placement.result.seeMyRoute` "See my route" (`packages/i18n/src/messages/en/learner.ts:930`);
   - `caregiver.journey.viewing` "Viewing {name}'s journey" (#317);
   - `console.journey.title` "Journey" (#313).
2. **It is hard to find.** F-ROUTE-001 OD-2 made it a root-stack screen behind a secondary button on the Journey tab (section 3.1), with a Home strip later (R-4b). The owner wants it to be a first-class page for learners. The tab bar has three tabs (`apps/mobile/src/navigation/tabs.tsx:61-63`).
3. **There is no destination.** The page answers "where am I" (the `here` stage, the cursor, the trail) but not "where must I get to".
   - The only goal is one fixed line in the `start` hero: "Your first goal: read every Hangul letter." (`learner.myRoute.hero.goal`, #317; F-ROUTE-001 OD-9). It disappears once the learner has started.
   - A learner can follow a curriculum. Class and family plans with a curriculum `meta` already reach the device (F-PLAN-002 P2-5 #254, `InboxPlanSchema.meta` at `packages/content-schema/src/schemas/plan.ts:113`). A self plan lives in `snapshot.selfRoute` (`schemas/progress.ts:125`). Each has a stage it reaches: the generator's `stats.endsAtStage` (`packages/content-schema/src/curriculum/generate.ts:525-542`), bounded by `params.endStage` (`curriculum/params.ts:61`). The page shows none of this.
4. **Parents and teachers cannot open it where they work.**
   - The read-only page exists only on the learner's own device, behind the grown-up gate (F-ROUTE-001 section 3.12).
   - A parent or teacher signed in on another device sees only the seven-segment strip on the roster card (R-9a, #313).
   - The owner asks that every persona signs in on app.hangulroute.com and sees screens made for them (items 3, 4, 6; F-APP-001).

## 2. Contracts with sibling specs (written in parallel; each has a fallback)

| Spec | What this amendment needs from it | Fallback until it is `ready` and merged |
|---|---|---|
| **F-APP-001** persona homes | 1. The learner shell keeps the bottom tab bar of `navigation/tabs.tsx` (Today, Journey, Library). This amendment adds one tab to it. 2. The adult shell (parent home, teacher home) hosts the console pages and links each child or student card to the page in section 6. | The tab goes into today's `tabs.tsx` (LR-4). The adult page goes under today's console path (`apps/web`, `/teach/space/route`, section 6.1). F-APP-001 moves it along with the rest of the console. Only the host path changes; the view model, the strings and the wireframe stay. |
| **F-ENT-003** free and subscriber access | One predicate, `isQuestOpen(questId: string): boolean`, from `apps/mobile/src/logic/content-access.ts`. It is true for every quest a subscriber has, and for the quests inside the free allowance (owner item 9, "about day 2"). | `() => true` for every playable quest. This is today's behaviour: `isStagePlayable = () => true` (`apps/mobile/src/logic/entitlement.ts:40`) and `CURSOR_STAGE_RULE = 'shipped'` (`logic/cursor-context.ts:30`). |
| **F-PLAN-002** weekly plan | `sourcesOf(plans, selfRoute)` (`apps/mobile/src/logic/homework/plan-derivation.ts:68`) and its precedence rank: teacher > parent > system (`plan-derivation.ts:59-65`, F-PLAN-002 section 3.10). | Already on main (P2-5 #254). A self plan exists only after P2-7a; until then the goal comes from a class or family plan, or from the default rule (section 4.1, rule 4). |
| **Progress reports** (parent and teacher dashboards, owner items 4 and 6) | One link, "Open Learning Route", on its per-student page. | The roster card link (LR-8) is the entry. |

Nothing in this amendment depends on these specs' private names beyond the table. If one of them picks a different name for the predicate or the host path, the PR that consumes it changes one import.

## 3. Goals and non-goals

**Goals.**
1. **G1.** One name everywhere: **Learning Route**. It is a proper name in title case in every UI language string set. Code identifiers and telemetry names do not change (section 7.1).
2. **G2.** A learner reaches it in one tap from anywhere in the learner shell, through a **Route** tab (section 5).
3. **G3.** The page states **where you are** and **where you are going** together, at the top, in one card. The trail marks the goal stage.
4. **G4.** The goal follows the curriculum the learner actually follows: class plan, then family plan, then the learner's own plan. With no plan, a default rule applies (section 4).
5. **G5.** With a plan, the page's one primary action opens the plan's next quest. Subscribers get the whole road open and are guided along their own curriculum, which is owner item 10, consistent with F-ENT-003.
6. **G6.** A parent or teacher opens a **read-only Learning Route** for one child or student from their own home. It is built from the summary they already receive (section 6). It adds no new data path to a child's full record.

**Non-goals.**
- No class-level route: no distribution of a class over stages, no class average, no sorting by stage (F-ROUTE-001 section 3.12 hard rules, F-TCH-001 section 3.2).
- No change to the Journey grid or its cells: D9, and the GridCell owners in F-ROUTE-001 section 6.3.
- No new skill data. Skills stay on the device (F-ROUTE-001 OD-11).
- No speaking anywhere.
- No dates or countdowns to the goal on learner screens.
- No price, no lock-for-payment, no purchase button on a learner screen.
- No new D1 table or migration.
- No change to the merged `buildMyRoute` contract beyond the additive fields in section 4.4.
- No rename of code directories (`logic/my-route/`, `screens/my-route/`), message key paths (`learner.myRoute`, `caregiver.journey`, `console.journey`) or telemetry names (`route_map.*`).

## 4. The destination (goal) and the next step

### 4.1 Where the goal comes from (LR-OD-4)

`pickGoal` (pure, `packages/content-schema/src/route/goal.ts`, LR-3a) returns `RouteGoal | null`:

```ts
export type GoalFrom = 'class' | 'school' | 'family' | 'self' | 'default';
export interface RouteGoal {
  stage: StageKey;            // the stage the learner is heading to
  from: GoalFrom;             // which source set it (wording only; never shown as a person)
  sourceId: string | null;    // plan id or self-route id; null for 'default'
  endsOn: DateKey | null;     // last day of the plan (grown-up views only); null for 'default'
  reached: boolean;           // the goal stage's state is complete or known (or explored for a taste stage)
}
export function pickGoal(input: {
  sources: readonly GoalSource[];        // from sourcesOf(...), each { id, kind, assignedAt, items, meta }
  catalog: RouteCatalog;                 // routeCatalogOf(CATALOG)
  stages: readonly { stage: StageKey; state: StageState }[];   // the 7 stage rows (or summary.journey.stages)
  today: DateKey;
}): RouteGoal | null;
```

The rules run in this order:

1. **Plan sources.** Only **curriculum** sources count: `meta !== null`, not archived, and today on or before the plan's last day. The last day is the last week's `startDate` plus 6 days, computed with `curriculum/dates`. A classic plan without `meta` is homework, not a route. It sets no goal, just as it shows no week (F-ROUTE-001 section 3.9).
2. **Precedence.** Rank by the existing derivation rank: a teacher's plan first (`class`), then a parent's (`family`, `school`), then the learner's own (`self`) (`plan-derivation.ts:59-65`). Inside one rank the newest `assignedAt` wins. This is the precedence F-PLAN-002 section 3.10 gives Home and Homework, so the page and Home never disagree about which plan leads.
3. **Plan goal stage.** `planGoalStage(items, meta, catalog)` = the highest stage of the plan's **lesson** items (quest and episode items whose catalogue lesson has a stage). Stories never move it. With no lesson item, the result is `meta.params.level.stage`. This is the generator's own `endsAtStage` rule (`generate.ts:525`). A golden test asserts `planGoalStage(toPlanItems(draft), toMeta(draft), catalog) === draft.stats.endsAtStage` on goldens A and B, so the two cannot drift.
4. **Default goal (no active curriculum source; LR-OD-5).** The first stage, in order 1 to 7, whose state is `open`. That means not `complete`, `known`, `explored` or `later`. Today that is Stage 1. After Stage 1 is complete it is Stage 2 (a taste, worded as "Explore", section 4.3), then Stage 4, then none.
5. **None.** No plan source and no open stage means every stage is complete, known, explored or coming later. The goal is `null`, and the page shows the end-of-road line (section 4.3).
6. **`reached`.**
   - For a plan goal: true when the goal stage's state is `complete` or `known`, or `explored` when its availability is `taste`.
   - For a default goal: never true. The rule moves on to the next open stage instead, so `reached` cannot be true by construction.
   - A reached plan goal stays the goal until the plan ends, then the rule falls to the next source.

### 4.2 Why these rules

- They follow the curriculum the learner already gets on Home: the same sources, the same rank. Owner item 10 asks for "intuitive to learn along their own configured curriculum".
- The goal is a **stage**, not a quest count. A stage has a can-do line with no number (F-ROUTE-001 Appendix A), so the goal never becomes "N quests to go". It also works where only stage-level data exists, on the grown-up summary page (section 6).
- The default rule never names a stage that has no playable content (`later`). It never claims a full Stage 2 when only a taste exists.

### 4.3 What the goal looks like (learner, `viewer: 'self'`)

The top of the page becomes one **route card**. It replaces the hero card of F-ROUTE-001 section 3.5 and keeps its single primary action:

```
Now    [pin]  Stage 1 · Hangul
Goal   [flag] Stage 1 · Hangul      "From your class plan"
       By the end you can: read any Hangul letter and syllable and know its sound.
Next: Family at the Table
[[ Continue ]]
```

| Case | "Goal" line | Source line | Below |
|---|---|---|---|
| plan goal, not reached | `Stage {n} · {title}` | `From your class plan` / `From your school plan` / `From your family plan` / `From your weekly plan` | the goal stage's can-do line, introduced by "By the end you can:" |
| plan goal, reached | `You reached your goal: Stage {n} · {title}` | as above | "Keep going: {next title}" when a next quest exists |
| default goal, full stage (availability `open`) | `Stage {n} · {title}` | `Hoya's suggestion` | can-do line |
| default goal, taste stage | `Explore Stage {n} · {title}` | `Hoya's suggestion` | "Try the first quests of this stage." (no can-do line: a taste does not teach the whole stage) |
| no goal (`null`) | — (the line is hidden) | — | "You reached the end of the open road. More is coming." |

- **"Now"** is the `here` stage of F-ROUTE-001 section 3.3, unchanged.
- **Goal equals Now** (the usual case early on): both lines still show. The learner sees one stage named twice, with the pin and the flag. That says "you are in the stage you are aiming for" without a ratio.
- **Hidden on learner screens:** the plan's dates, `endsOn`, any week count, and any "N stages to go" or "days left". The weekly plan line (F-ROUTE-001 section 3.9, R-7b) stays directly under the card and is the only place a week number appears.
- **Trail marker.** The goal stage's row gets the tag **Your goal** with a drawn flag glyph (`Icon` `flag`, LR-2). It sits next to the existing **You are here** and **You started here** tags. A stage can carry all three. The connector, the pips and the stage states do not change.
- **Collapsed goal row.** When the goal stage is a compact `later` row, the tag still shows. That can only happen through a plan whose lessons reach a stage with no shipped content; the plan's lessons are then coming-soon items.
- **First-time reached line.** When `reached` becomes true for a goal not yet recorded in `seen.goalsReached` (section 4.5), one calm line shows under the card once: "You reached your goal. Hoya is proud!". Hoya uses the `cheering` pose. `route_map.goal_reached` is sent (section 8). The line never appears in read-only mode.

### 4.4 The next step follows the plan (LR-OD-6)

F-ROUTE-001 section 3.5 keeps **one cursor** (`nextQuestAfter`). This amendment adds one wrapper and changes no other caller.

- `routeNext(input)` (`apps/mobile/src/logic/my-route/next.ts`, LR-3b):
  - With an **active curriculum source** that leads by section 4.1, it returns that source's first pending quest item. Pending means the derived `HomeworkAssignment` for that item (`snapshot.homework`, id `<sourceId>#<questId>`, F-PLAN-001 section 3.3) has no `completedAt`, the quest is playable, and `isQuestOpen` is true. Items are ordered by `targetDate`, then by list order. This is the item F-PLAN-002 section 3.9 puts on Home card (2) ("Card (2) follows the plan through the normal merge"), so the page and Home agree.
  - Otherwise, or when the source has no such item, it returns the F-ROUTE-001 cursor.
- **One marker.** The pip of `routeNext` carries `isCursor`. The page never draws a second "next" marker.
- **`here` does not change.** It stays the stage of the catalogue cursor (F-ROUTE-001 section 3.3). The sync store computes `summary.journey.here` without plan sources (`apps/mobile/src/store/sync-store.ts:102`), so the page's **Now** line, the console strip and the summary page always name the same stage. When the plan's next quest sits in another stage, for example a class plan that opens with a Stage 2 taste, the marker sits on that pip and **Now** still names `here`.
- **No pressure.** An item whose `targetDate` is in the past is still "Next". It is never "late", "missed" or "overdue" (F-PLAN-002 section 3.6).
- **Out of scope here.** Home and Results keep calling the shared cursor through their own code; they already follow the plan through the homework merge. If F-ENT-003 later wants Results' "Next up" to follow the plan, it calls `routeNext`.

`MyRouteModel` gains three additive fields. No existing field changes:

```ts
interface MyRouteModel {
  // ...F-ROUTE-001 section 3.2 fields unchanged...
  goal: RouteGoal | null;
  next: { questId: string; episodeId: string; stage: StageKey; from: GoalFrom | 'cursor' } | null;  // equals cursor when from === 'cursor'
  inPlanEpisodeIds: string[];   // episodes that hold an item of the leading source (cell rows show "In your plan")
}
// MyRouteInput gains: sources: readonly GoalSource[]; today: DateKey; isQuestOpen?: (questId: string) => boolean (default () => true)
// Pip gains: laterReason?: 'soon' | 'notOpen'
```

- `cursor` stays as it is. It is the catalogue cursor that `summarizeJourney` and the console already read.
- The hero kind (`start`, `continue`, `rest`, `beyond`) is computed from `next` instead of `cursor`.
- `rest` and `beyond` keep their wording.

### 4.5 Free learners and subscribers (consistent with F-ENT-003; LR-OD-8)

- **Subscribers.** Every playable quest is open, so every pip of shipped content is `done`, `known`, `open` or `new`. Nothing on the page is locked. The cell rows of episodes in the leading plan carry a small tag, **In your plan**. Together with the goal card and the plan-led **Continue**, that is the "follow your own curriculum" guidance of owner item 10.
- **Free learners beyond the free allowance.** A quest with `isQuestOpen === false` that is not done is drawn as the `later` pip (dotted ring) with `laterReason: 'notOpen'`.
  - **Words.** Its cell word, and its stage caption when the whole stage is like that, read **Not open yet** (`learner.myRoute.state.notOpen`, already in #317 for F-ROUTE-001 OD-4's other branch).
  - **Legend.** The pip legend gains the row "Not open yet". The shape is the same as "Coming later" and the word is different.
  - **Commerce.** No price, no lock glyph, no "Premium", no button and no "ask a grown-up" prompt appear on any learner screen (F-ROUTE-001 section 3.3 "Entitlement never shows commerce", D5).
- **Fill-only.** A `done` pip stays `done` whatever `isQuestOpen` says later, for example after a plan lapses. A latched stage stays Complete (F-ROUTE-001 section 3.4 guarantee 1, section 3.3 latch). `monotonic.test.ts` gains an "access shrinks" step.
- **Hero when only not-open quests are left.** The `rest` wording "You did everything that is open right now. More is coming." is replaced in this one case by **"You played every quest that is open for you. Play a favorite again or read a story."**, with **Open Library** (or **Open stories**). It never implies that content is missing for everyone.
- **Seen record.** `seen.ts` (`route-map-ui:<profileId>`, per device, never synced) gains `goalsReached?: string[]`, with keys `${from}:${sourceId ?? '-'}:${stage}`. A missing value reads as `[]`. The write stays inside the existing try/catch. It is written only for the active profile.

## 5. The Route tab and the entries (LR-A1; supersedes F-ROUTE-001 OD-2)

### 5.1 Tab

- `MainTabParamList` (`navigation/types.ts:114`) gains `Route: undefined`. `tabs.tsx` adds `<Tab.Screen name="Route" ... />`.
- **Order (LR-OD-2):** **Today · Route · Journey · Library**.
  - Route comes second because it answers "where am I and where am I going" right after today's work.
  - Journey stays the map you act on, by theme (D9).
- The tab shows only while `flags.myRouteEnabled` is on. With the flag off there are three tabs, exactly as today.
- **Label.** The tab label is **Route** (`a11y.tabs.route`). "Learning Route" has 14 characters, and the tab budget is 12 (`packages/i18n/src/__tests__/length-budget.test.ts:10`, `tab: 12`). The tab's accessibility label is the full name **Learning Route** (`a11y.myRoute.tab`).
- **Icon.** The icon is the new `route` glyph (LR-2): a drawn path with a pin, never an emoji.
- **Fit.** Four tabs at 320 dp give 80 dp per item, above `touchTarget.min`. On wide windows the bar is already centred inside `layout.maxWidth.full` (`tabs.tsx` comment, F-LAYOUT-001 LD6), so F-ROUTE-001's objection to a fourth tab no longer holds.
- **The tab screen** is `MyRouteScreen` with `variant: 'tab'`:
  - no back button;
  - the title "Learning Route" in the header;
  - `route_map.viewed` with `source: 'tab'` on every focus. It is debounced to once per focus, so a re-render does not send it again.
- **Root-stack screen.** The root-stack `MyRoute` screen stays for one case: a grown-up opening **another profile's** page read-only, with the gate check from F-ROUTE-001 section 3.1. In #317 that check is `logic/my-route/access.ts`.

### 5.2 Entries for the active profile go to the tab

| Entry | Before | After (LR-4) |
|---|---|---|
| Journey header button (R-3) | `navigate('MyRoute', { source: 'journey' })`, "See my route" | `navigate('Main', { screen: 'Route' })`, **See Learning Route** (LR-OD-11 keeps it) |
| Home strip (R-4b) | root-stack `MyRoute` | the Route tab; strip title **Learning Route**; it gains one line "Goal: Stage {n} · {title}" when a goal exists (LR-A6) |
| Placement result link (F-PLC-001 P-7b; `result-view.ts:170`) | "See my route" -> `MyRoute` | **See your Learning Route** -> the Route tab |
| Parent dashboard row (R-9b) | "See journey" -> `MyRoute { profileId }` | **See Learning Route** -> root-stack `MyRoute { profileId }` (read-only, gated; unchanged route) |

There is now one learner page in the history, not two copies (tab plus stack). Back from a quest returns to the tab.

## 6. Read-only Learning Route for parents and teachers

There are two read-only modes. Both use `viewer: 'grownup'` copy: third person, from the learner's name (F-ROUTE-001 section 3.12).

| Mode | Who, where | Data | What it shows |
|---|---|---|---|
| **Local** (exists, R-3) | a grown-up on the learner's own device, gate open | the local snapshot, the bundle and the catalogue | the full page: pips, skills, gains, plus the route card in the third person (section 6.2) |
| **Summary** (new, LR-7 / LR-8) | a signed-in parent (family organizer) or teacher, on any device, in the adult shell | the roster summary the account already receives: `summary.journey` (class and family), `summary.selfRoute` (family only), and the space's own plans | seven stage rows from stage-level counts, the route card, and no per-quest pips |

### 6.1 The summary page (adult shell; LR-8)

- **Route.** Path `ROUTES.learnerRoute(spaceId, learnerId)` = `/teach/space/route?id=<spaceId>&learner=<learnerId>`. It is added to `apps/web/src/lib/console/routing.ts` next to `space(id)`.
  - Ids only, never a name in the URL. The console is a static export, so both are query parameters (F-CONSOLE-001 section 3.6).
  - When F-APP-001 rebases the console onto app.hangulroute.com, this path moves with it.
- **Data.** It reuses `GET /api/spaces/:id/roster` (`packages/backend/src/routes/spaces.ts:350-386`) and `GET /api/spaces/:id/plans`, which the roster page already calls.
  - The learner is found by `id` in the roster.
  - **No new endpoint, no new field to teachers, and no read of `payload_json`.**
- **Unknown learner.** The page shows "We could not find this learner in this space." with **Back to the class** (or **Back to the family**). There is no list of other learners.
- **Entries.**
  - On the roster card, under the R-9a strip, a link **Open Learning Route** for class and family spaces. School spaces have no roster (`page.tsx:46`).
  - F-APP-001's parent home child card and teacher home student list.
  - The progress-reports per-student page (section 2).
- **Layout.** One reading column. Top to bottom:
  - the header (back, "{name}'s Learning Route");
  - the route card;
  - seven stage rows;
  - a note that the page shows what the learner's device last sent ("Updated {date}" from `lastSyncedAt`);
  - **Open on this device** is not offered. Adults never play as the learner. That is the browse spec's job (owner item 14).
- **Stage rows** come from `summary.journey.stages`, validated by the R-9a strip (`journey-strip.ts`), which ignores unknown stages and states. Each row has:
  - the badge shape of the state and the state word;
  - the `console.journey.stageLine` ("4 known from the level check, 2 quests done", known part only when > 0);
  - the tags **{name} is here** (`journey.here`) and **Goal** (flag), and **{name} started here** when the placement start is known (`summary.placement`, a stage only).
  - **Rules.** `total` is never shown, there are no pips, and no "N / M". Consecutive `later` stages merge into one row, as on the learner page.
- **Route card (grown-up).**
  - **Now:** `{name} is on Stage {n}: {title}.`
  - **Goal:** found per viewer, in the order below. Plans of other spaces are never read from the wire. This follows the `planProgress` rule that a space sees only its own plans (`packages/backend/src/lib/roster-summary.ts:35-40`).
    1. **This space's own active curriculum plan** for this learner (`targetLearnerIds` null or containing the id), computed in the browser with `planGoalStage` over the plan the console already has. Labelled **From your class plan** / **From your family plan**.
    2. **Family spaces only:** the learner's own plan. It comes from `summary.selfRoute.goalStage` (LR-W1) and is labelled **From {name}'s weekly plan**.
    3. **Default:** `pickGoal` over `summary.journey.stages` with no sources. It is labelled **Hoya's suggestion**.
  - **Plan end** (grown-up only): "Plan ends {date}" from the plan's `meta`, or from `selfRoute.endsOn`. It is a date, never "late" or "behind".
  - **Goal reached:** "{name} reached the goal: Stage {n} · {title}."
  - **No summary journey yet** (an old app build, or never synced): the card shows "The Learning Route appears after {name}'s next sync on the newest app." There are no stage rows. It is never shown as "no progress" (F-ROUTE-001 review, R-8 row).
- **Free allowance line (LR-OD-8).** Shown on the summary page only, and only to the account that owns the space.
  - **When.** When the learner's `tier` is free and the space is not covered. The roster carries no tier (`apps/web/src/lib/console/api.ts:25-34`), so the page reads the account's own `GET /api/entitlements`, which the console already calls for Billing.
  - **What.** One neutral line: "Some quests open with a plan." and a link **See plans**, which goes to Billing in the adult shell (owner items 8 and 12).
  - **Rules.** No price on this page. Never shown to a teacher who does not own the space.
- **Hard rules (unchanged).**
  - No class average, no distribution, no sort or filter by stage, no "ahead" or "behind".
  - No comparison with another learner, and no link to the next or previous student.
  - No skills: they stay local (OD-11).

### 6.2 Local read-only page (R-3, extended by LR-5)

The route card in the third person:
- "Now: {name} is on Stage {n}: {title}."
- "Goal: Stage {n} · {title}", with the same source line.
- "Plan ends {date}" (grown-up only).

There is no button. Both the first-time reached line and telemetry stay off in read-only mode.

### 6.3 Class plan goal line (teacher; LR-9; LR-OD-10)

- **Where.** On the roster page header (`apps/web/src/app/(console)/teach/space/page.tsx`), when the class has an active curriculum plan: one line, **Your class plan reaches Stage {n} · {title}**, with "Plan ends {date}".
- **What it is.** A statement about the plan, computed from the plan alone. It says nothing about the learners: no count of who reached it, no share, no list.

## 7. Renaming (LR-A2; LR-1)

### 7.1 What changes and what does not

- **Changes:** English values only (es and ko follow after native review, section 7.3). Section 7.2 lists them.
- **Does not change:**
  - message key paths (`learner.myRoute.*`, `caregiver.journey.*`, `console.journey.*`, `a11y.myRoute.*`);
  - code directories and identifiers (`logic/my-route/`, `screens/my-route/`, `buildMyRoute`, `MyRoute` route name, `flags.myRouteEnabled`);
  - telemetry names (`route_map.*`);
  - spec ids and file names (F-ROUTE-001 keeps its file name; its title gains "Learning Route").
- **Why keep the identifiers.** Renaming keys and identifiers touches more than 40 files in two open PRs and every my-route test, and gives the learner nothing. Telemetry names are an exact list on the Worker; renaming them needs a deploy and splits the history.

### 7.2 English values (old -> new)

| Key | Old | New |
|---|---|---|
| `learner.myRoute.title` | My route | Learning Route |
| `learner.myRoute.open.cta` | See my route | See Learning Route |
| `learner.myRoute.hero.start` | Your Hangul route starts here. | Your Learning Route starts here. |
| `learner.placement.result.seeMyRoute` (`learner.ts:930`) | See my route | See your Learning Route |
| `caregiver.journey.viewing(name)` | Viewing {name}'s journey | Viewing {name}'s Learning Route |
| `caregiver.journey.start(name)` | {name}'s Hangul route starts here. | {name}'s Learning Route starts here. |
| parent dashboard row title and button (R-9b, not yet written) | Journey / See journey | Learning Route / See Learning Route |
| Home strip title (R-4b, not yet written) | My route | Learning Route |
| `console.journey.title` (#313) | Journey | Learning Route |
| `a11y.tabs.route` (new) | — | Route |
| `a11y.myRoute.tab` (new) | — | Learning Route |

Unchanged on purpose:
- `learner.placement.result.routeStays` "Your route stays right where it is." It speaks about the start spot, not the page.
- Every `learner.journey.*` string. They are about the Journey grid.
- F-PLAN-002's "weekly plan" words (OD-7: the dated plan is the weekly plan).

**New keys (LR-5, LR-8).** Section 11.1 has their draft English values.
- `learner.myRoute`: `now.label`, `goal.label`, `goal.*`, `tag.goal`, `cell.inPlan`, `legend.notOpen`, `hero.openForYou`, `goalReachedLine`
- `caregiver.journey`: `goal.*` (grown-up twins), `planEnds`
- `console.learningRoute`: the summary page and the roster link
- `a11y.myRoute`: `routeCard`, `tab`

### 7.3 Rules and tests

- **Casing.** "Learning Route" is written in title case in English (LR-OD-1). All-caps would make screen readers spell it and is harder for early readers.
- **Banned phrase.** A copy test fails if any English value under `learner.myRoute`, `caregiver.journey`, `console.journey`, `console.learningRoute`, `a11y.myRoute`, or `learner.placement.result.seeMyRoute` contains "my route" (case-insensitive). It also fails if one contains "learning route" in any casing other than "Learning Route".
- **es / ko.** The new values fall back to English until the F-I18N-001 native review, exactly as #317 does. Proposed values go to the reviewer, not into the dictionary:
  - es: "Ruta de aprendizaje", tab "Ruta" (4);
  - ko: "학습 루트", tab "루트" (2).
  CLAUDE.md section 8 forbids ad-hoc ko and es strings.
- **Existing checks still apply.** Every new string passes the F-ROUTE-001 section 3.13 rules (`copyViolations`) and the length budget.
- **Banned fixture.** The my-route fixture (`logic/my-route/__tests__/banned-fixture.ts`) gains `deadline`, `due`, `overdue`, `days left`, `to go`, `away from`.

## 8. Telemetry (Worker first)

| Name | Payload | When | Worker |
|---|---|---|---|
| `route_map.viewed` (exists) | gains `source: 'tab'` and `goalFrom: GoalFrom \| 'none'` | the page opens or the tab gains focus (active profile only) | **no deploy needed.** The Worker checks the name only and stores the payload object as sent (`packages/backend/src/routes/telemetry.ts:68-75`). The app type in `logic/my-route/telemetry.ts` (#317) widens. |
| `route_map.continue_tapped` (exists) | gains `from: GoalFrom \| 'cursor'` | the primary button is pressed | as above |
| `route_map.goal_reached` (**new**) | `{ stage: StageKey, goalFrom: 'class' \| 'school' \| 'family' \| 'self' }` | the first time the page shows a reached plan goal on this device (section 4.3) | **LR-W1 adds it** to `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts:79` region, appended after `route_map.continue_tapped`) and its exact-list test. The Worker is deployed before the app build that sends it (LR-5). |

- **Payloads.** Payloads carry stage keys, codes and booleans only. No plan id, no date, no name, no learner id beyond the `profileId` the client already attaches.
- **Who sends.** Read-only mode sends nothing. The adult summary page sends nothing: the console has no telemetry client (F-PLAN-002 section 3.11).
- **Docs.** `docs/roadmap/TELEMETRY-NAMES-2.md` section H gains row 4 (`route_map.goal_reached`) and the widened payloads of rows 1 and 3 (LR-0).

## 9. Data, API and storage (additive only)

| Change | Where | Wire / storage | Deploy |
|---|---|---|---|
| `SelfRouteSummarySchema.goalStage` | `packages/content-schema/src/schemas/sync.ts:23-29` | `goalStage: z.string().max(32).optional().catch(undefined)`. A plain string on the wire, validated as a `StageKey` in the reader, as `journey.stage` is. Malformed means dropped, never a 422. `schemaVersion` stays 1. | **Worker first (LR-W1).** zod strips unknown keys, so an app that sends it before the Worker knows it loses the field and nothing else. |
| family roster projection | `packages/backend/src/lib/roster-summary.ts:57` | `SELF_ROUTE_KEYS` gains `'goalStage'`. A class or school still never receives `selfRoute` (`rosterSummary` keeps its family check) | LR-W1 |
| summary writer | the PR that first writes `summary.selfRoute` from the device (an F-PLAN-002 PR, expected P2-7a; no device code writes it at `ea9049e4`) | `goalStage = planGoalStage(selfRoute.items, selfRoute.meta, catalog)` | LR-6, after LR-W1 is deployed |
| `pickGoal`, `planGoalStage`, `defaultGoalStage` | `packages/content-schema/src/route/goal.ts` (new), exported from `src/index.ts` (append only) | pure, shared by the app, the console and the summary writer | none |
| `route-map-ui:<profileId>.goalsReached` | `apps/mobile/src/logic/my-route/seen.ts` | per device, optional, never synced | none |

- **Unchanged.** No D1 migration, no new endpoint, no change to `ProgressSnapshotSchema`, `JourneySummarySchema` or `TEACHER_VISIBLE_SUMMARY_KEYS`. The consent text needs no new item: teachers receive nothing new.
- **Offline.** The learner page works offline from the local snapshot, the inbox copy and the bundle. The adult page needs the network; it uses the console's existing "can't reach" error path with **Try again**.

## 10. Accessibility

- **Route card.** It is one `accessibilityRole="summary"` block, and focus lands on it when the page opens (it replaces the hero sentence of F-ROUTE-001 section 3.14). Its label reads in order: "Now: Stage 1, Hangul. Goal: Stage 1, Hangul. From your class plan. Next: Family at the Table." The pin and flag glyphs are hidden from screen readers.
- **Stage rows.** A stage row's label gains "Your goal." (or "{name}'s goal." on grown-up pages) after the here and start parts. This is an additive argument to `a11y.myRoute.stage` and `stageGrownup`.
- **Tab.** The tab has the label "Route" and the accessibility label "Learning Route". Selection state comes from the navigator.
- **Shapes and words.** Not-open pips share the dotted shape with coming-later pips. The words and the legend tell them apart, and colour is never the only cue.
- **Adult page.**
  - The stage list is a real `<ol>` and each row is an `<li>` with text.
  - The tags are text, not colour.
  - Targets are at least 44 px.
  - It reflows at 320 px and at 200 % zoom.
  - `<h1>` is "{name}'s Learning Route".
- **Unchanged.** The 18 pt body floor, `touchTarget.min`, reduced motion (the reached line does not animate when motion is reduced) and the 320 x 568 reflow all stay as in F-ROUTE-001 section 3.14.

## 11. Privacy and safety

- **Child's data.** No new field leaves the device except `selfRoute.goalStage`, a stage key that only the learner's family space reads (F-PLAN-002 D11).
- **Teachers** receive nothing new. The class goal line is computed from the teacher's own plan.
- **URLs** carry ids only. The adult page heading uses `displayName`, which the roster already anonymizes when `anonymizeRoster` is on (`routes/spaces.ts:374-386`).
- **No learner surface** shows commerce, a lock or a prompt to ask for payment. The free-allowance line is on the adult page, for the space owner only.
- **Anti-shame.**
  - The goal is a stage with a can-do line. There is no number to the goal, no countdown and no date on learner screens.
  - "Next" is never "late".
  - Reaching a goal is celebrated once. Not reaching it is never mentioned.
  - The adult page compares no learners.
- **The adult page never lets the adult play or write as the learner.** No progress, no telemetry, no `seen`.

### 11.1 Draft English strings (final values live in the dictionary)

`learner.myRoute`:
- labels and tags: `now.label` "Now" · `goal.label` "Goal" · `tag.goal` "Your goal"
- goal line: `goal.stage(n, title)` "Stage {n} · {title}" · `goal.explore(n, title)` "Explore Stage {n} · {title}" · `goal.tasteLine` "Try the first quests of this stage." · `goal.canDoLead` "By the end you can:"
- goal reached: `goal.reached(n, title)` "You reached your goal: Stage {n} · {title}" · `goal.keepGoing(title)` "Keep going: {title}" · `goalReachedLine` "You reached your goal. Hoya is proud!"
- end of road and free allowance: `goal.endOfRoad` "You reached the end of the open road. More is coming." · `hero.openForYou` "You played every quest that is open for you. Play a favorite again or read a story."
- source line: `goal.from.class` "From your class plan" · `goal.from.school` "From your school plan" · `goal.from.family` "From your family plan" · `goal.from.self` "From your weekly plan" · `goal.from.default` "Hoya's suggestion"
- cells and legend: `cell.inPlan` "In your plan" · `legend.notOpen` "Not open yet"

`caregiver.journey`:
- now and goal: `now(name, n, title)` "{name} is on Stage {n}: {title}." · `goal.stage(n, title)` "Stage {n} · {title}"
- goal reached: `goal.reached(name, n, title)` "{name} reached the goal: Stage {n} · {title}."
- source line: `goal.from.self(name)` "From {name}'s weekly plan" · `goal.from.class` "From the class plan" · `goal.from.family` "From the family plan" · `goal.from.school` "From the school plan" · `goal.from.default` "Hoya's suggestion"
- `planEnds(date)` "Plan ends {date}"
- tag: `goalTag(name)` "{name}'s goal"

`console.learningRoute`:
- heading and roster link: `title(name)` "{name}'s Learning Route" · `open` "Open Learning Route"
- back links: `back.class` "Back to the class" · `back.family` "Back to the family"
- route card: `now(name, n, title)` "{name} is on Stage {n}: {title}." · `goal` "Goal" · `fromClass` "From your class plan" · `fromFamily` "From your family plan" · `fromSelf(name)` "From {name}'s weekly plan" · `fromDefault` "Hoya's suggestion" · `reached(name, n, title)` "{name} reached the goal: Stage {n} · {title}." · `planEnds(date)` "Plan ends {date}"
- stage tags: `hereTag(name)` "{name} is here" · `startTag(name)` "{name} started here" · `goalTag` "Goal"
- sync state: `updated(date)` "Updated {date}" · `notSynced(name)` "The Learning Route appears after {name}'s next sync on the newest app."
- errors: `notFound` "We could not find this learner in this space." · `cantReach` (existing console wording)
- free allowance and class goal: `freeLine` "Some quests open with a plan." · `seePlans` "See plans" · `classGoal(n, title)` "Your class plan reaches Stage {n} · {title}"

`a11y`:
- `tabs.route` "Route" · `myRoute.tab` "Learning Route"
- `myRoute.routeCard(nowText, goalText, fromText, nextText)` joins the visible parts with ". "

## 12. Tests

Counts are asserted on the frozen fixtures of F-ROUTE-001 section 5: `catalog-2026-10.ts`, `bundle-2026-10.ts`, and goldens A and B of F-PLAN-002.

| File | Level | Covers |
|---|---|---|
| `packages/content-schema/src/route/__tests__/goal.test.ts` | unit, 100 % | precedence teacher > parent > system, newest `assignedAt` in a rank; classic plan ignored; archived and finished plans ignored (last day inclusive); `planGoalStage` = highest lesson stage, stories ignored, level stage fallback; default = first `open` stage; taste wording flag; `reached` per section 4.1 rule 6; `null` at the end of the road |
| `…/route/__tests__/goal-golden.test.ts` | unit | `planGoalStage(toPlanItems(d), toMeta(d), catalog) === d.stats.endsAtStage` for goldens A and B |
| `content-schema/src/__tests__/sync.test.ts` (extend) | unit | `selfRoute.goalStage` optional; a malformed one is dropped without dropping `selfRoute` |
| `content-schema/src/__tests__/telemetry.test.ts` (extend) | unit | `route_map.goal_reached` in the exact list |
| `backend/src/lib/__tests__/roster-summary.test.ts`, `backend/src/__tests__/spaces.test.ts` (extend) | unit, integration | a family roster returns `selfRoute.goalStage`; a class roster of the same learner returns no `selfRoute`; unknown keys under `selfRoute` never leave |
| `apps/mobile/src/logic/my-route/__tests__/next.test.ts` | unit, 100 % | plan-led next = first pending item by `targetDate` then list order; past `targetDate` still next; not-open or unplayable items skipped; falls back to the cursor; `here` stays the cursor's stage and equals `summarizeJourney(...).here` |
| `…/model.test.ts` (extend) | unit | `goal`, `next`, `inPlanEpisodeIds` on the fixtures; hero kind from `next`; `laterReason: 'notOpen'`; `openForYou` hero |
| `…/monotonic.test.ts` (extend) | property | new step "access shrinks" (`isQuestOpen` turns false): done pips and latches unchanged |
| `…/seen.test.ts` (extend) | unit | `goalsReached` missing reads `[]`; written once per key; never in read-only; failed write swallowed |
| `…/copy.test.ts`, `…/dictionary.test.ts` (extend) | unit | the section 7.3 casing and "my route" bans; new keys through `copyViolations` and the length budget; `a11y.tabs.route` within 12; grown-up twins in the third person; no dates in learner goal strings |
| `…/telemetry.test.ts` (extend, #317 file) | unit | `source: 'tab'`, `goalFrom`, `goal_reached` once per key, nothing in read-only |
| `apps/mobile/src/logic/my-route/__tests__/screen-source.test.ts` (extend, #317 file) | unit | Route tab behind the flag; tab variant has no back button; entries for the active profile navigate to the tab; flag and route glyphs come from `Icon` |
| `apps/web/src/lib/console/__tests__/learning-route-view.test.ts` | unit, 100 % | rows from `summary.journey` (unknown stages and states ignored, `later` runs merged); goal precedence per viewer (own plan > family self goal > default); class viewer never reads `selfRoute`; not-synced state; free line only for a space owner on a free, uncovered learner; nothing exported that averages, sorts or compares |
| `apps/web/src/lib/console/__tests__/routing.test.ts` (extend) | unit | `learnerRoute(spaceId, learnerId)` encodes ids; no name parameter exists |
| `apps/mobile/e2e/web/my-route.spec.ts` (extend R-10's) | e2e | Route tab at 320 x 568, 375 x 667, 844 x 390, 1180 x 820: four tabs, no horizontal scroll, route card text, goal tag; a plan fixture shows "From your class plan" and Continue opens the plan's next quest |
| `apps/web/e2e/learning-route.spec.ts` | e2e | the summary page on a mocked roster at 320 and 1280: `<ol>` of stages, no `/ \d+` ratio, no "behind", not-found state, back link |

Coverage: `packages/content-schema` 100 %; `apps/mobile/src/logic/my-route/` 100 %; `apps/web` console logic 90 % or more (`learning-route-view.ts` 100 %).

## 13. PR table

Small rows. Each one is TDD and behind `flags.myRouteEnabled` where it touches the learner UI.

| PR | Content | Size | Needs |
|---|---|---|---|
| **LR-0** | `docs`: this amendment; F-ROUTE-001 edits (LR-A1 to LR-A8); wireframes `journey/learning-route.md`, `parent/learning-route.md`, `console/learning-route.md`; header note on `journey/my-route-overview.md`; `TELEMETRY-NAMES-2.md` section H rows; README index line | S | — |
| **LR-W1** | `feat(content-schema,backend)`: `route_map.goal_reached` name and exact-list test; `SelfRouteSummarySchema.goalStage` (tolerant); `SELF_ROUTE_KEYS` += `goalStage`; roster and sync tests. **Deploy the Worker before LR-5 and LR-6 reach an app build.** | S | LR-0 |
| **LR-1** | `feat(i18n,mobile)`: English values of section 7.2 for every key already on main; `a11y.tabs.route`, `a11y.myRoute.tab`; copy test (casing, "my route" ban). Includes `console.journey.title` if #313 has merged, else #313 adopts it | S | LR-0, R-3 (#317) merged |
| **LR-2** | `feat(design-system)`: `Icon` glyphs `route` and `flag` (drawn SVG paths, glyph test, entry in the Icon sheet under `design/components/`) | S | LR-0, glyph mock in `design/components/` |
| **LR-3a** | `feat(content-schema)`: `route/goal.ts` (`pickGoal`, `planGoalStage`, `defaultGoalStage`) + golden parity test; append export to `src/index.ts` | S | LR-0 |
| **LR-3b** | `feat(mobile)`: `logic/my-route/next.ts`; `buildMyRoute` gains `goal`, `next`, `inPlanEpisodeIds`, `isQuestOpen`, `laterReason`; `seen.goalsReached`; copy selectors for the route card (self and grown-up); no UI | M | LR-3a, R-3 merged |
| **LR-4** | `feat(mobile)`: Route tab (types, `tabs.tsx`, tab variant of `MyRouteScreen`, icon, a11y label), active-profile entries go to the tab (Journey header, placement result link), `route_map.viewed` `source: 'tab'`; behind the flag | M | LR-1, LR-2, R-3 merged; F-APP-001 learner-shell PR if it edits `tabs.tsx` first (rebase only) |
| **LR-5** | `feat(mobile)`: route card (Now / Goal / source / can-do / Next / one button), goal tag on the trail, first-time reached line + `route_map.goal_reached`, "In your plan" cell tag, not-open pips and legend row, `openForYou` hero, `learner.myRoute` and `caregiver.journey` new keys | M | LR-3b, LR-2, LR-W1 deployed |
| **LR-6** | `feat(mobile)`: the summary writer adds `selfRoute.goalStage` | S | LR-3a, LR-W1 deployed, the F-PLAN-002 PR that first writes `summary.selfRoute` (expected P2-7a) |
| **LR-7** | `feat(web)`: `lib/console/learning-route-view.ts` (pure view model of section 6.1) + tests; `ROUTES.learnerRoute` | M | LR-3a, R-9a (#313) merged |
| **LR-8** | `feat(web)`: summary page `/teach/space/route`, the roster card link **Open Learning Route**, `console.learningRoute` strings, free-allowance line for the space owner | M | LR-7, LR-1; F-APP-001 adult shell only for the host path (default: current console) |
| **LR-9** | `feat(web)`: class plan goal line on the roster header | S | LR-7 |
| **LR-10** | `test(e2e)`: extends R-10's mobile spec with the tab and the route card; adds `apps/web/e2e/learning-route.spec.ts`. The flag flip stays R-10's | S | LR-4, LR-5, LR-8 |

These PRs edit their rows in F-ROUTE-001 instead of adding new PRs:
- **R-4b** (Home strip): gains the "Goal" line and the new title.
- **R-9b** (parent dashboard row): gains the new title and button, and the goal line "Goal: Stage {n} · {title}" from `pickGoal` over the local model.
- **R-10**: covers the tab.

**Order.**
- Can start after LR-0: LR-0, then LR-W1, LR-2 and LR-3a in parallel.
- After R-3 merges: LR-1 and LR-3b.
- Then LR-4 and LR-5. LR-5 needs the LR-W1 Worker deploy first.
- LR-7, LR-8 and LR-9 can start once LR-3a and R-9a are in. They do not wait for the learner PRs.
- LR-6 waits for the F-PLAN-002 PR that first writes `summary.selfRoute`.

**Total:** 13 PRs, one Worker deploy (LR-W1), no D1 migration.

## 14. Owner decisions (each has a default that applies until answered)

| Id | Question | Default | Alternative | Gates | Reversible |
|---|---|---|---|---|---|
| LR-OD-1 | How is the name written? | **Learning Route** in title case in every English string; the tab label is **Route** (tab budget 12) and its accessibility label is "Learning Route" | all caps "LEARNING ROUTE" (screen readers may spell it, harder for early readers); or a longer tab label with a raised tab budget | LR-1, LR-4 | yes (strings) |
| LR-OD-2 | Where does the tab sit? | **Today · Route · Journey · Library** | Today · Journey · Route · Library | LR-4 | yes (one array) |
| LR-OD-3 | Keep the Journey grid as its own tab? | **yes**: Route = the road by stage with a goal; Journey = the 7 x 5 map you act on (D9) | later merge both into one tab with a Road / Grid switch (needs a new spec: GridCell has three owners) | none in this amendment | yes |
| LR-OD-4 | Which plan sets the goal? | **class > school / family > self**, newest first in a rank (the order Home already uses) | the learner's own plan first | LR-3a | yes (one rank table) |
| LR-OD-5 | Goal with no plan | **the first stage that is still open**: Stage 1 now, then "Explore Stage 2", then Stage 4, then the end-of-road line | always "Finish Stage 1" until F-ROUTE-001 OD-9 defines later levels | LR-3a | yes |
| LR-OD-6 | Does Continue follow the plan? | **yes**: with an active plan the button opens the plan's next quest (as Home card (2) already does) | always the catalogue cursor | LR-3b | yes (one wrapper) |
| LR-OD-7 | Show the plan's end date? | **grown-up views only** ("Plan ends {date}"); never on learner screens | also show the date to self learners | LR-5, LR-8 | yes |
| LR-OD-8 | Quests outside the free allowance (F-ENT-003) | learner page: dotted pip and **Not open yet**, no commerce, no prompt; adult page: one neutral line **Some quests open with a plan.** + **See plans** (space owner only) | no line on the adult page either | LR-5, LR-8 | yes |
| LR-OD-9 | Who may open the adult Learning Route? | **every adult linked to the learner's space** (family organizer, class teacher), on free and paid accounts: progress visibility is not a paid feature (the paid browse-as-learner section is owner item 14, a separate spec) | paid accounts only | LR-8 | yes |
| LR-OD-10 | Class plan goal line for teachers | **yes**, one line about the plan, never about learners | no line | LR-9 | yes |
| LR-OD-11 | Keep the Journey header link once the tab exists? | **yes**, "See Learning Route" (one tap from the grid to the road) | remove it | LR-4 | yes |

**Assumptions to verify** (with the PR that verifies each):

| # | Assumption | Verified in |
|---|---|---|
| a | Four tab items fit at 320 dp with 200 % text: the label "Route" wraps to no more than one line | LR-4 e2e at 320 x 568 |
| b | `route` and `flag` glyphs read clearly at tab size and at 20 dp in greyscale | LR-2 design pass |
| c | Goldens A and B give `planGoalStage === stats.endsAtStage` | LR-3a |
| d | The roster and plans responses the console already loads are enough for the summary page (no new request except entitlements for the owner line) | LR-8 |
| e | F-ENT-003 exports a quest-level predicate; if it exports a stage-level one, `isQuestOpen` wraps it | LR-3b |

## 15. Amendments applied to F-ROUTE-001 (LR-A)

| Id | F-ROUTE-001 section | Change |
|---|---|---|
| LR-A1 | header, title, scope, 3.1 | Title "Learning Route (code name My route)". Scope gains the tab, the goal and the adult summary page. Section 3.1: the recommendation becomes the Route tab; OD-2 is superseded by LR-OD-2; the entry list follows section 5.2 here |
| LR-A2 | 3.1 naming, 3.13, Appendix B | "My route" becomes "Learning Route" in learner, caregiver and console copy; OD-7 keeps "weekly plan" for the dated plan; the Appendix B values follow section 7.2 here |
| LR-A3 | 3.5 | The hero becomes the route card (section 4.3 here); the hero kind is computed from `next`; `routeNext` wraps the one cursor (section 4.4) |
| LR-A4 | 3.2 | Additive `MyRouteModel` and `MyRouteInput` fields (section 4.4) |
| LR-A5 | 3.3, 3.4 | `laterReason: 'notOpen'` and the `isQuestOpen` input (section 4.5); the legend gains "Not open yet" |
| LR-A6 | 3.12 | The adult summary page (section 6); the R-9b row and the console strip use the new names; the R-4b strip gains the goal line |
| LR-A7 | 3.16 | `source: 'tab'`, `goalFrom`, `from`, the new name `route_map.goal_reached` |
| LR-A8 | 4, 6.1, 9 | "A fourth tab" leaves Out of scope; the PR table points to section 13 here; OD-2 and OD-7 point to LR-OD-1 and LR-OD-2 |
