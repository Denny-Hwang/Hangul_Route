Status: ready (applied to `F-ROUTE-001-my-route-overview.md` by LR-0, this docs PR; revised after two reviews, section 16)

> **Applied 2026-10-11 in the LR-0 docs PR.** Every LR item that changes F-ROUTE-001 is now in that spec's text, marked with its id (for example "[LR-A3]"). This file keeps the rationale, the contracts with the sibling specs (section 2), the PR table (section 13), the owner decisions (section 14) and the review log (section 16). Owner decisions do **not** gate the whole amendment: each one gates only the PRs named in section 14, and each has a default that applies until the owner answers.
>
> Basis: `origin/main` `ea9049e4`. Every `file:line` below is at that commit unless it names an open PR. Open PRs it builds on: #317 (F-ROUTE-001 R-3, the screen and its strings) and #313 (R-9a, the console journey strip). Both may adopt the new string values from LR-0 before they merge; LR-1 renames whatever merged with the old values.

# Amendment to F-ROUTE-001: the page becomes LEARNING ROUTE — a learner tab, a destination, and a read-only view for parents and teachers

**Owner request 2026-10-11 (item 11, translated):** "A whole learning map page that shows where I must get to and where I am now. Name it LEARNING ROUTE." It is part of the UX request of the same day: the student side is tuned for learning (item 5), subscribers see all content and follow their own curriculum (item 10), parents and teachers see each student's progress (items 4 and 6), and paying grown-ups can browse what learners learn (item 14).

**Standing rules that apply here:**
- Any age: no age wording on shared surfaces.
- Child safety: grown-up gate, local-first data, no learner names in URLs.
- Anti-shame: no ranking, no comparison between learners, meters only fill, no red X.
- Strings: every UI string goes through `packages/i18n`. English is the default; Korean and Spanish strings come only after native review. Design tokens only, no emoji.
- Skills: reading, listening and writing only. Speaking is never shown (owner decision 2026-10-10).
- Commerce: no price, no product name, no purchase button and no "Premium" on learner screens, and no ask-a-grown-up prompt on the Learning Route page. The free-plan boundary word is F-ENT-003's ("Not open yet", section 4.5). Stripe stays in sandbox.
- D1: additive only. Worker first for every new field and telemetry name.

**Ids.**
- `LR-An` amends a section of F-ROUTE-001.
- `LR-n` is a PR (section 13).
- `LR-OD-n` is an owner decision (section 14).
- F-ROUTE-001's own ids (R-n, OD-n) keep their meaning. F-ENT-003's ids (E3-n, its OD-n) are written with the prefix, for example "F-ENT-003 OD-6".

**Glossary (shared with the sibling specs; also in `docs/specs/README.md`).**
- **Learning Route**: the product name of this page, written in title case in every UI string (LR-OD-1). The tab label is **Route**.
- **Weekly plan**: any dated curriculum plan (F-PLAN-002 OD-7): a class's, a school's, a family's or the learner's own. Never "family plan" or "class plan" in this amendment's strings, because "family plan" names the paid product (F-APP-001, F-BILL-002).
- **Not open yet**: a lesson a free learner cannot start yet (F-ENT-003 section 3.11 owns this and every other access word; learner screens never name a product).

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
   - The owner asks that every persona signs in on app.hangulroute.com and sees screens made for them (items 3, 4, 6; F-APP-001), and that grown-ups can see what each stage teaches (item 14; F-BROWSE-001).

## 2. Contracts with sibling specs (written in parallel; each has a fallback)

Each row names what this amendment takes, what it gives, and what applies until the sibling is `ready` and merged. Where this amendment needs a line in a sibling spec, the row says so; the sibling's next docs revision carries it, and this file is the record until then.

| Spec | This amendment takes | This amendment gives / asks | Fallback until merged |
|---|---|---|---|
| **F-ENT-003** free plan and "next" (owner items 9, 10) | 1. **Access:** `useQuestAccess()` (`store/tier-store.ts`, E3-2) as `MyRouteInput.isQuestOpen`; it reads `gatingActive`, which is false in native store builds until F-IAP-002 (F-ENT-003 OD-13). 2. **Next:** `routeNext` and `planView` (`apps/mobile/src/logic/route-next.ts`, E3-4) and their types `RouteNext`, `NextSource`, `PlanView`. **This amendment has no next function of its own**: `MyRouteModel.next` is `routeNext`'s quest (`source: 'cursor'` reads as `from: 'cursor'`) and `inPlanEpisodeIds` is `planView().inPlanEpisodeIds` (section 4.4). 3. **Learner words** (F-ENT-003 section 3.11 glossary): `learner.access.notOpen` "Not open yet" (cell word, legend row, stage caption; `learner.myRoute.state.notOpen` and `legend.notOpen` carry the same value), `learner.access.openForYou` (the free-end hero), `learner.access.practiceWords.cta`, `learner.routeNext.tag.inPlan` "In your plan", `a11y.access.*`. 4. **Shapes** (E3-D mock): Not open yet = the dotted ring, the same shape as this page's `later` pip; In your plan = the solid ring; no lock glyph on any learner screen (F-ENT-003 OD-6, resolved with LR-OD-8). | 1. The route page's `free-end` state is drawn by LR-5b (F-ENT-003 E3-10 is withdrawn). 2. **No ask on the route page**: a learner who taps a not-open cell row reaches F-ENT-003's episode preview, which carries its ask button. 3. The grown-up free-lessons line is F-ENT-003's `freeLessonsLine` (E3-12) where F-ENT-003 places it (family home card, roster card, F-REPORT-001's next-steps block); this amendment's card and stage list add no second copy (section 6.1). Asks F-ENT-003 to judge "covered" per learner (`tierForLearner`), not only per space, before that line shows (review 2 of this amendment: a learner covered by another space's plan must not see a purchase line). | `isQuestOpen = () => true` (today's behaviour: `isStagePlayable = () => true`, `apps/mobile/src/logic/entitlement.ts:40`; `CURSOR_STAGE_RULE = 'shipped'`, `logic/cursor-context.ts:30`). LR-3b and later wait for E3-4 (section 13), so no second "next" ever ships. |
| **F-APP-001** persona app shell (owner items 1, 3, 12) | 1. The learner shell keeps the bottom tab bar of `navigation/tabs.tsx`; F-APP-001 section 3.6 already names the Route tab. 2. The route table row `/teach/space/route?id=&learner=` with its twin `/parent/space/route`, the `SPACE_PAGES` twin rule (`lib/console/space-pages.ts`), and the builder convention `ROUTES.<name>(..., kind?)` (kind last and optional; omitted = `/teach/space…`, which renders every kind). 3. `learningRouteEnabled()` (`NEXT_PUBLIC_LEARNING_ROUTE_ENABLED`, default off) in `lib/console/config.ts`, which LR-8 reads. 4. The family home card's **Learning Route** link (F-APP-001 owns the card) to `ROUTES.learnerRoute(familyId, learnerId, 'family')`. | 1. One tab in the learner shell (LR-4). 2. `ROUTES.learnerRoute(spaceId, learnerId, kind?)` and the page `LearningRoutePage` under both paths (section 6.1). 3. **No roster-card link** (F-APP-001 section 6.4 assumed one; the report's link replaces it, section 6.1). 4. **No billing link** on any page of this amendment (F-APP-001 section 6.4 mentions "See plans": it is dropped, LR-OD-8), so owner item 12 holds on every host. | LR-8 does not wait for A-5b: before A-5b the builder returns `/teach/space/route` for every kind (it renders a family too); whichever of LR-8 and A-5b lands second adds the `/parent/space/route` twin, which the `SPACE_PAGES` test enforces. Old hangulroute.com addresses of both paths are forwarded with their query by F-SITE-002 S-10. |
| **F-REPORT-001** progress reports (owner items 4, 6) | The per-learner report (RP-7a2 console, RP-9 in-app) and its "At a glance" line `nowOn` "Now on Stage {n}: {stage}" with the link `report.glance.openRoute` **Open Learning Route** (RP-7a2 owns the link; the in-app report's link opens the root-stack read-only page). | **The Learning Route is part of the per-learner report.** One goal line goes directly under `nowOn` (the line of section 6.1, cases 1 to 3), so the report says where the learner is and where they are heading in two lines; the full card (source, can-do line, plan end) is on the stage list page. Owner of the goal line: whichever of LR-8 and RP-7a2 lands second. **No roster-card link** (F-REPORT-001 assumption e expected one; the report's link replaces it). The free-lessons line in the report is F-REPORT-001 P6 / F-ENT-003's `free-plan`, not this amendment's. | Until RP-7a2 merges, the stage list page is reached from F-APP-001's family home card; teachers reach it once the report exists. The page sits behind `learningRouteEnabled()` until then anyway. |
| **F-BROWSE-001** grown-up lesson browser (owner item 14) | `buildBrowseUrl` / `openBrowse` and the target `{ kind: 'stage', stage }`, `source: 'route'` (F-BROWSE-001 section 4.11 item 3). | 1. Each adult stage row (L1 local rows, L2 and T3 summary rows) shows the stage's can-do line (F-ROUTE-001 Appendix A), so an adult sees what each stage builds without leaving the page. 2. Each adult stage row reserves one secondary action slot, **Preview lessons**, rendered **only by F-BROWSE-001**: BR-11 on the stage list page (both paths, behind `browseEnabled()`), BR-12a on the in-app read-only page (gate hand-off). Only through `buildBrowseUrl` / `openBrowse`, never on a learner screen, with F-BROWSE-001's access rules (its pass scope decides what plays). | The slot renders nothing. |
| **F-SITE-002** layered marketing site (owner items 1, 2) | The `learningRoute` site claim flips with R-10 (F-SITE-002 section 3.9). | The name is written **Learning Route** (title case) everywhere, including the site; F-SITE-002 has adopted it, with its own `landing` casing test (S-3). LR-1's casing test also covers `landing`. | If the owner picks all caps under LR-OD-1, both specs change together. |
| **F-PLAN-002** weekly plan | `sourcesOf(plans, selfRoute)` (`apps/mobile/src/logic/homework/plan-derivation.ts:68`) and the precedence teacher > parent > system (`plan-derivation.ts:59-65` maps kinds, `logic/homework/assignment-merger.ts:32-41` ranks; F-PLAN-002 section 3.10). The name **weekly plan** for every dated plan (OD-7). | — | Already on main (P2-5 #254). A self plan exists only after P2-7a; until then the goal comes from a class or family plan, or from the default rule (section 4.1, rule 4). |
| **F-BILL-002** billing for every persona (owner item 8) | — | Nothing: this amendment adds no billing surface (LR-OD-8 default). | — |
| **F-FEEDBACK-001** notes from grown-ups (owner item 7) | — | This amendment adds **no button to the roster card**, which already carries the R-9a strip, "Stage by stage", F-REPORT-001's "See report" and F-FEEDBACK-001's "Send a note". | — |

Nothing in this amendment depends on these specs' private names beyond the table. If one of them renames a function or a path, the PR that consumes it changes one import.

## 3. Goals and non-goals

**Goals.**
1. **G1.** One name everywhere: **Learning Route**. It is a proper name in title case in every UI string set. Code identifiers and telemetry names do not change (section 7.1).
2. **G2.** A learner reaches it in one tap from anywhere in the learner shell, through a **Route** tab (section 5).
3. **G3.** The page states **where you are** and **where you are going** together, at the top, in one card, with a fill-only row that shows how far along the goal stage is. The trail marks the goal stage.
4. **G4.** The goal follows the curriculum the learner actually follows: class plan, then family or school plan, then the learner's own plan. With no plan, a default rule applies (section 4).
5. **G5.** The page's one primary action opens the same next quest Home, Results and the Journey show: F-ENT-003's `routeNext`. Subscribers get the whole road open and are guided along their own curriculum (owner item 10); free learners see the boundary in F-ENT-003's words (owner item 9).
6. **G6.** A parent or teacher sees where a child or student is and where they are heading in the per-learner report, and opens a **read-only stage list** from there or from the family home (section 6). It is built from the summary they already receive plus one small family-only field, and adds no path to a child's full record.
7. **G7.** Every grown-up view shows what each stage builds and leaves room for F-BROWSE-001's "Preview lessons" (owner item 14).

**Non-goals.**
- No class-level route: no distribution of a class over stages, no class average, no sorting by stage (F-ROUTE-001 section 3.12 hard rules, F-TCH-001 section 3.2).
- No change to the Journey grid or its cells: D9, and the GridCell owners in F-ROUTE-001 section 6.3. The Journey markers are F-ENT-003's (E3-5).
- No new skill data. Skills stay on the device (F-ROUTE-001 OD-11).
- No speaking anywhere.
- No dates or countdowns to the goal on learner screens.
- No price, no purchase button and no "Premium" on a learner screen; no billing link on any page of this amendment.
- No new D1 table, migration or endpoint.
- No second "next" function (F-ROUTE-001 M4, F-ENT-003 S5).
- No change to the merged `buildMyRoute` contract beyond the additive fields in section 4.4.
- No rename of code directories (`logic/my-route/`, `screens/my-route/`), message key paths (`learner.myRoute`, `caregiver.journey`, `console.journey`) or telemetry names (`route_map.*`).

## 4. The destination (goal) and the next step

### 4.1 Where the goal comes from (LR-OD-4)

`pickGoal` (pure, `packages/content-schema/src/route/goal.ts`, LR-3a) returns `RouteGoal | null`:

```ts
export type GoalFrom = 'class' | 'school' | 'family' | 'self' | 'default';
export interface GoalSource {
  id: string;
  kind: 'class' | 'school' | 'family' | 'self';
  assignedAt: string;                  // device: sourcesOf(...).assignedAt (publishedAt / createdAt); console: plan.publishedAt
  items: readonly PlanItem[];
  meta: CurriculumMeta | null;
}
export interface RouteGoal {
  stage: StageKey;            // the stage the learner is heading to
  from: GoalFrom;             // which source set it (wording only; never shown as a person)
  sourceId: string | null;    // plan id or self-route id; null for 'default'
  endsOn: DateKey | null;     // last day of the plan (grown-up views only); null for 'default'
  reached: boolean;           // section 4.1 rule 6
  taste: boolean;             // the goal stage's availability is 'taste' ("Explore" wording, section 4.3)
}
export function pickGoal(input: {
  sources: readonly GoalSource[];
  catalog: RouteCatalog;                 // routeCatalogOf(CATALOG)
  stages: readonly { stage: StageKey; state: StageState }[];   // the 7 stage rows (or summary.journey.stages)
  availability: (stage: StageKey) => RouteStageAvailability;   // app: stageAvailability; console: stageAvailabilityOf(CATALOG, ·)
  today: DateKey;
}): RouteGoal | null;
export type RouteStageAvailability = 'open' | 'taste' | 'soon';
export function stageAvailabilityOf(catalog: Catalog, stage: StageKey): RouteStageAvailability;   // every cell ready / some / none
```

`stageAvailabilityOf` is the catalogue twin of the app's `stageAvailability` (`apps/mobile/src/logic/journey.ts:17`, which counts shipped grid episodes per cell); a parity test asserts both agree for the 7 stages on the bundled content, so the console (which has the shared catalogue, not the bundle) words a taste stage exactly as the app does.

**Who passes which sources.**
- **Device** (learner page, L1, the summary writer): `sourcesOf(inboxPlans, snapshot.selfRoute)`. The inbox already holds only published, unarchived plans that target this learner (`inboxPlansFor`, `packages/backend/src/routes/plans.ts:121-133`).
- **Console** (summary page, LR-9 line): only this space's plans with `publishedAt !== null && archivedAt === null`, and, for one learner, `targetLearnerIds === null || targetLearnerIds.includes(learnerId)`. `assignedAt := publishedAt`. This is the `isLive` rule of `apps/web/src/lib/console/curriculum.ts:398`. `GET /api/spaces/:id/plans` returns drafts too (`plans.ts:87-93`), so a draft never sets a goal.

The rules run in this order:

1. **Plan sources.** Only **curriculum** sources count: `meta !== null`, and today on or before the plan's last day. The last day is the last week's `startDate` plus 6 days, computed with `curriculum/dates`. A classic plan without `meta` is homework, not a route. It sets no goal, just as it shows no week (F-ROUTE-001 section 3.9).
2. **Precedence.** Rank by the existing derivation rank: a teacher's plan first (`class`), then a parent's (`family`, `school`), then the learner's own (`self`) (`plan-derivation.ts:59-65`, `assignment-merger.ts:32`). Inside one rank the newest `assignedAt` wins. This is the precedence F-PLAN-002 section 3.10 gives Home and Homework and F-ENT-003 section 3.5 gives `routeNext`, so the page, Home and Results never disagree about which plan leads.
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

### 4.3 The route card (learner, `viewer: 'self'`)

The top of the page becomes one **route card**. It replaces the hero card of F-ROUTE-001 section 3.5 and keeps its single primary action. Under the title the screen shows one purpose line, "Where you are and where you are going." (LR-OD-3).

**Goal stage differs from Now** (for example a class plan that reaches Stage 2 while the learner is in Stage 1):

```
Now    [pin]  Stage 1 · Hangul
Goal   [flag] Stage 2 · Words        From your class's weekly plan
       By the end of this stage you can: Read everyday words and know what they mean.
       (D)(D)(O)(O)(O)                the goal stage's pips: fill only, no numbers
Next: Family at the Table
[[ Continue ]]
```

**Goal stage equals Now** (the usual case early on): the two lines collapse into one, so the card is one line shorter and says the useful thing:

```
[pin][flag] Stage 1 · Hangul: you are in your goal stage      From your class's weekly plan
By the end of this stage you can: Read any Hangul letter and syllable and know its sound.
(D)(D)(D)(D)(O)(O)(O)(O)(O)
Next: Family at the Table
[[ Continue ]]
```

| Case | Goal line | Source line | Below |
|---|---|---|---|
| plan goal, not reached | `Stage {n} · {title}` (or the collapsed line) | `From your class's weekly plan` / `From your school's weekly plan` / `From your family's weekly plan` / `From your own weekly plan` | the can-do line (`learner.myRoute.canDoLead` + `stage.canDo.<n>`), then the goal pips |
| plan goal, reached | `Stage {n} · {title} · reached` | as above | "Keep going: {next title}" when a next quest exists; the goal pips (all filled) |
| default goal, full stage (availability `open`) | `Stage {n} · {title}` (or collapsed) | `Hoya's suggestion` | can-do line, goal pips |
| default goal, taste stage | `Explore Stage {n} · {title}` (or collapsed: `goal.exploreInGoal`) | `Hoya's suggestion` | "Try the first quests of this stage." (no can-do line: a taste does not teach the whole stage); goal pips |
| no goal (`null`) | — (the line is hidden) | — | the card's only sentence is "You reached the end of the open road. More is coming." (the `rest` sentence is dropped, so the card never says it twice) |

- **Now** is the `here` stage of F-ROUTE-001 section 3.3, unchanged. A new learner with nothing done sees "Your Learning Route starts here." instead of a Now line.
- **Goal pips.** The goal stage's quest pips as one fill-only row, the same `Pip` objects and shapes as the trail row of that stage (done, known, open, new, later, not open), with the `isCursor` marker when Next is in that stage. No digits, no "of", no bar that can drop. Accessibility label without digits: "Ready when you are" (none done), "Some quests done, more are ready" (some), "Every quest here is done" (all). Drafts; the dictionary has the final words.
- **Hidden on learner screens:** the plan's dates, `endsOn`, any week count on the card, and any "N stages to go" or "days left".
- **Weekly plan line.** The F-ROUTE-001 section 3.9 line under the card reads only "Week {n} of your weekly plan" with [Open plan] (the Home strip's `home.strip.week(n)` words). It never repeats a "Next" title on this page: the card owns Next, so two different "Next" items can never appear together.
- **Trail marker.** The goal stage's row gets the tag **Your goal** with a drawn flag glyph (`Icon` `flag`, LR-2). It sits after **You are here** and before **You started here** (where you are, where you are going, where you began). A stage can carry all three; at 320 x 568 they take at most two rows at the default text size, and at 200 % text one row each, with nothing cut off (assumption f, as revised by LR-D).
- **Collapsed goal row.** When the goal stage is a compact `later` row, the tag still shows. That can only happen through a plan whose lessons reach a stage with no shipped content.
- **First time a goal is reached.** When `reached` becomes true for a goal not yet in `seen.goalsReached` (section 4.5), Hoya takes the `cheering` pose and the card's Hoya line reads "You reached your goal. Hoya is proud!" for that visit only. `route_map.goal_reached` is sent (section 8). Never in read-only mode. No animation when motion is reduced.
- **Free-end hero** (F-ENT-003 `free-end`, section 4.5): F-ENT-003's calm "open for you" words with one button, the Goal line kept under them, and no ask.
- **Narrow width (LR-11).** Below `PIP_ROW_MIN_WIDTH` (360) a learner card with a button does not draw the can-do lead and line that the table above lists; every other part stays, in the same order. With 15 Stage 1 pips on two lines this keeps the one button fully above the tab bar at 320 x 568 (G2). The can-do lines stay one tap away in the trail: the open `here` row below the card (after the weekly plan line) shows its stage's lines, and when the goal stage is ahead of `here` (A2) the goal stage's row shows the goal's lines when it is opened. A card without a button (read-only) keeps them. The card's label (section 10) never included the can-do lines, so screen-reader output is the same at every width. Layout: `design/screens/learning-route/route-card.md` "Narrow width".

### 4.4 The next step is F-ENT-003's `routeNext` (LR-OD-6)

The page does not compute "next". The screen builds F-ENT-003's `RouteNextInput` (snapshot, profile, today, `sourcesOf(...)`, quests, episodes, the same `cursorContext` Home and Results use, `isQuestOpen`, `gating`) once, calls `routeNext(input)` and `planView(input)`, and passes both results into `buildMyRoute`. Home card (2), the Results teaser, the Journey Next marker, the episode page tag and this page therefore show **one** next quest; F-ENT-003's cross-spec golden (`route-next.agreement.test.ts`) asserts `buildMyRoute().next` and `.inPlanEpisodeIds` once LR-3b has merged.

- **One marker.** The pip of `next` carries `isCursor`. The page never draws a second "next" marker.
- **`here` does not change.** It stays the stage of the catalogue cursor (F-ROUTE-001 section 3.3). The sync store computes `summary.journey.here` without plan sources (`apps/mobile/src/store/sync-store.ts:102`), so the page's **Now** line, the console strip and the grown-up card always name the same stage. When the plan's next quest sits in another stage, the marker sits on that pip and **Now** still names `here`.
- **No pressure.** F-ENT-003 never filters by date: an item whose `targetDate` is past is still "Next", never "late", "missed" or "overdue".

`MyRouteModel` gains these additive fields. No existing field changes:

```ts
interface MyRouteModel {
  // ...F-ROUTE-001 section 3.2 fields unchanged...
  goal: RouteGoal | null;
  goalPips: Pip[];             // the goal stage's pips (same objects as its trail row); [] when goal is null
  next: { questId: string; episodeId: string; stage: StageKey; source: NextSource } | null;  // RouteNext kind 'quest'; null otherwise
  nextKind: 'quest' | 'free-end' | 'rest';                                                  // RouteNext kind
  inPlanEpisodeIds: string[];  // [...planView.inPlanEpisodeIds] (cell rows show "In your plan")
}
// NextSource (F-ENT-003) = 'class' | 'school' | 'family' | 'self' | 'cursor'
// MyRouteInput gains: sources: readonly GoalSource[]; today: DateKey;
//   routeNext: RouteNext; planView: PlanView;                              (from F-ENT-003, computed by the screen)
//   isQuestOpen?: (questId: string) => boolean                             (default () => true)
// Pip gains: laterReason?: 'soon' | 'notOpen'
```

- `cursor` stays as it is. It is the catalogue cursor that `summarizeJourney` and the console already read.
- The hero kind is computed from `nextKind` and `next`: `start` or `continue` for `quest`; `freeEnd` for `free-end`; `rest` or `beyond` (unchanged rules and wording) for `rest`.
- `next.stage` is `RouteNext.stage`.

### 4.5 Free learners and subscribers (F-ENT-003's rules; LR-OD-8)

- **Subscribers, and everyone while F-ENT-003's switch is off.** Every playable quest is open, so every pip of shipped content is `done`, `known`, `open` or `new`. Nothing on the page is marked. Cell rows of episodes in `inPlanEpisodeIds` carry **In your plan** (`learner.routeNext.tag.inPlan`, the solid ring of the E3-D mock plus the word). Together with the goal card and the plan-led **Continue**, that is the "follow your own curriculum" guidance of owner item 10.
- **Free learners past the free lessons** (F-ENT-003's effective switch on, web only). A quest with `isQuestOpen === false` that is not done is a `later` pip with `laterReason: 'notOpen'`.
  - **Shape.** The dotted ring, the same shape as a coming-later pip and as F-ENT-003's not-open Journey cell. No lock glyph (F-ENT-003 OD-6). A kept or promised quest is never not open (F-ENT-003 section 3.3).
  - **Words.** Its cell word, its stage caption when every playable quest of the stage is not open, and the legend row read **Not open yet** (`learner.access.notOpen`; `learner.myRoute.state.notOpen` and `legend.notOpen` carry the same value, asserted by a copy test). The word, not the shape, tells "Not open yet" from "Coming later".
  - **Tapping a not-open cell row** opens `EpisodeDetail`, which F-ENT-003 shows as a preview with its own ask button. The route page itself has **no ask**.
  - **Free-end hero** (`nextKind === 'free-end'`, drawn by LR-5b; F-ENT-003 E3-10 is withdrawn): Hoya, **You played every quest that is open for you.** (`learner.access.openForYou`), the Goal line, and one button: **Practice words** (`learner.access.practiceWords.cta`, the first free word topic playable in this build; when none is, **Open Library**). The once-per-device celebration "You finished your first lessons!" stays on Home and Results (F-ENT-003 `free-end-seen`); the route page never shows it and never sets that key.
  - **Never on this page:** a price, a product name, "Premium", a buy or unlock button, or an ask-a-grown-up prompt.
- **Native builds.** F-ENT-003's `gatingActive` is false on iOS and Android until F-IAP-002 (its OD-13), so no not-open pip or free-end hero exists in a store build. A screen-source test asserts that `screens/my-route/` reads access only through `useQuestAccess()` and renders no billing, plans or ask link.
- **Fill-only.** A `done` pip stays `done` whatever `isQuestOpen` says later, for example after a plan lapses. A latched stage stays Complete (F-ROUTE-001 section 3.4 guarantee 1, section 3.3 latch). `monotonic.test.ts` gains an "access shrinks" step.
- **Seen record.** `seen.ts` (`route-map-ui:<profileId>`, per device, never synced) gains `goalsReached?: string[]`, with keys `${from}:${sourceId ?? '-'}:${stage}`. A missing value reads as `[]`. The write stays inside the existing try/catch. It is written only for the active profile on the tab, never from the root-stack (grown-up) screen.

## 5. The Route tab and the entries (LR-A1; supersedes F-ROUTE-001 OD-2)

### 5.1 Tab

- `MainTabParamList` (`navigation/types.ts:114`) gains `Route: undefined`. `tabs.tsx` adds `<Tab.Screen name="Route" ... />`.
- **Order (LR-OD-2):** **Today · Route · Journey · Library**.
  - Route comes second because it answers "where am I and where am I going" right after today's work.
  - Journey stays the map you act on, by theme (D9).
- **Telling Route and Journey apart (LR-OD-3).** Each tab's header has one purpose line: Route "Where you are and where you are going." (`learner.myRoute.purpose`, new); Journey "Every lesson, by stage and theme." (the value of `learner.journey.intro`, today "7 stages × 5 themes. Draw your own route.", which also stops using the word "route" for the grid). LR-10 runs a 5-second comprehension check on the e2e screenshots (assumption g) before R-10 flips the flag.
- The tab shows only while `flags.myRouteEnabled` is on. With the flag off there are three tabs, exactly as today.
- **Label.** The tab label is **Route** (`a11y.tabs.route`). "Learning Route" has 14 characters, and the tab budget is 12 (`packages/i18n/src/__tests__/length-budget.test.ts:10`, `tab: 12`). The tab's accessibility label is the full name **Learning Route** (`a11y.myRoute.tab`).
- **Icon.** The icon is the new `route` glyph (LR-2): a drawn path with a pin, never an emoji.
- **Fit.** Four tabs at 320 dp give 80 dp per item, above `touchTarget.min`. On wide windows the bar is already centred inside `layout.maxWidth.full` (`tabs.tsx` comment, F-LAYOUT-001 LD6), so F-ROUTE-001's objection to a fourth tab no longer holds.
- **The tab screen** is `MyRouteScreen` with `variant: 'tab'`:
  - no back button;
  - the title "Learning Route" and the purpose line in the header;
  - `route_map.viewed` with `source: 'tab'` on every focus, debounced to once per focus.
- **Root-stack screen: grown-up only, always read-only.** The root-stack `MyRoute` screen exists only for a grown-up looking at a learner's page from the in-app parent dashboard. Its params become `{ profileId: string; viewer: 'grownup' }`, **both required** (#317 has `{ source; profileId?: string }`). `myRouteAccess` (`logic/my-route/access.ts`, #317) gains the entry kind: a grown-up entry resolves to `readOnly` when the gate is open and `gate` otherwise, **even when `profileId` is the active profile**. It never resolves to `self`. So the dashboard can never open the interactive page, play as the child, send the child's telemetry or use up the child's one-time "goal reached" moment. If the root-stack screen is ever reached with an access of `self` (an old call), it calls `navigation.navigate('Main', { screen: 'Route' })` (Today while the tab is off): `navigate` returns to the `Main` route already under it, where `replace` would stack a second `Main` with its own tab bar.

### 5.2 Entries

| Entry | Before | After (LR-4) |
|---|---|---|
| Journey header button (R-3) | `navigate('MyRoute', { source: 'journey' })`, "See my route" | `navigate('Main', { screen: 'Route' })`, **See Learning Route** (LR-OD-11 keeps it) |
| Home strip (R-4b) | root-stack `MyRoute` | the Route tab; strip title **Learning Route**; it gains one line "Goal: Stage {n} · {title}" when a goal exists (LR-A6) |
| Placement result link (F-PLC-001 P-7b; `result-view.ts:170`) | "See my route" -> `MyRoute` | **See Learning Route** -> the Route tab |
| Parent dashboard row (R-9b) | "See journey" -> `MyRoute { profileId }` | **See Learning Route** -> root-stack `MyRoute { profileId, viewer: 'grownup' }`: gated and **forced read-only**, also for the active profile |
| In-app report (F-REPORT-001 RP-9) | — | its **Open Learning Route** link -> the same root-stack `MyRoute { profileId, viewer: 'grownup' }` |

- **One verb per surface type.** "See Learning Route" on learner screens and in-app grown-up screens; "Open Learning Route" in the console (section 6.1).
- There is now one learner page in the history, not two copies (tab plus stack). Back from a quest returns to the tab.
- A screen-source test asserts that no `navigate('MyRoute'` call omits `profileId` and `viewer`.

## 6. Read-only Learning Route for parents and teachers

There are two read-only modes. Both use `viewer: 'grownup'` copy: third person, from the learner's name (F-ROUTE-001 section 3.12). Neither has a button that plays, writes or sends telemetry.

| Mode | Who, where | Data | What it shows |
|---|---|---|---|
| **Local** (exists, R-3; extended by LR-5a) | a grown-up on the learner's own device, gate open, from the parent dashboard row | the local snapshot, the inbox plans, the bundle and the catalogue | the full page: pips, skills, gains, plus the route card in the third person (section 6.2) |
| **Summary** (new, LR-7 / LR-8) | a signed-in parent (family space) or teacher (class space), on any device, in the adult shell | the roster summary the account already receives: `summary.journey`, `summary.placement`, `summary.routeGoal` and `summary.selfRoute` (both family only), and the space's own published plans | one goal line in the per-learner report, and a stage list page (the full grown-up route card and the stages) with no per-quest pips |

### 6.1 The summary views (adult shell; LR-7, LR-8)

**Entries.**
- **The per-learner report** (both personas): F-REPORT-001's "At a glance" line "Now on Stage {n}: {stage}" carries **Open Learning Route** (RP-7a2), and the **goal line** of this section (cases 1 to 3) sits directly under it, so the report says where the learner is and where they are heading in two lines. Owner of the goal line: whichever of LR-8 and RP-7a2 lands second.
- **The family home card** (F-APP-001 owns it): **Learning Route** to `ROUTES.learnerRoute(familyId, learnerId, 'family')`.
- **No roster-card button** (the card already has the strip, Stage by stage, See report and Send a note).
- All entries and the page show only while `learningRouteEnabled()` is on (F-APP-001's reader, `NEXT_PUBLIC_LEARNING_ROUTE_ENABLED`, default off; LR-8 adds the reader if A-5b has not).

**Route.** `ROUTES.learnerRoute(spaceId, learnerId, kind?)` in `apps/web/src/lib/console/routing.ts`, built with F-APP-001's `spacePath('route', query, kind)`:
- `family` -> `/parent/space/route?id=<spaceId>&learner=<learnerId>`;
- `class`, or `kind` omitted -> `/teach/space/route?id=<spaceId>&learner=<learnerId>` (omitted renders every kind, F-APP-001's pre-A-5b rule);
- a school space has no roster (`page.tsx:46`), so no caller passes one.
- One page component, `LearningRoutePage`, under `app/(console)/teach/space/route/` with its twin under `app/(console)/parent/space/route/` (F-APP-001 `SPACE_PAGES`). Ids only, never a name in the URL; the console is a static export, so both are query parameters (F-CONSOLE-001 section 3.6). A routing test asserts that a family space with `kind` passed never yields a `/teach` path and that no name parameter exists.

**Who.** Exactly who can open the roster and the report (`summary.read`): a family organizer or caregiver, a class teacher or owner (LR-OD-9). Free and paid accounts alike: progress visibility is not a paid feature.

**Data.** `GET /api/spaces/:id/roster` (`packages/backend/src/routes/spaces.ts:350-386`) and `GET /api/spaces/:id/plans`, which the roster page already calls. The learner is found by `id` in the roster. **No new endpoint, no new field to teachers, no read of `payload_json`, no entitlements call.**

**The grown-up route card** (in full on the stage list page; the report shows only its goal line):
- **Now:** "{name} is on Stage {n}: {title}." from `summary.journey.here`.
- **Goal.** The card never claims to show the learner's own goal unless it has it. It reads, in this order:
  1. **Family viewer, `summary.routeGoal` present** (LR-W1, written by the device, LR-6): this is the goal the learner's device shows. Line "{name}'s goal: Stage {n} · {title}" with the source "From the class's weekly plan" / "From the school's weekly plan" / "From your family's weekly plan" / "From {name}'s own weekly plan" / "Hoya's suggestion: the next open stage". When this family's own live curriculum plan for the learner exists **and is not the leading source**, one secondary line: "Your family's weekly plan reaches Stage {n} · {title}".
  2. **This space's own live curriculum plan** for the learner (class viewer always; family viewer without `routeGoal`): `pickGoal` over that plan alone, newest `publishedAt` wins among several. The line names the plan, not the learner: "Your class's weekly plan reaches Stage {n} · {title}" / "Your family's weekly plan reaches Stage {n} · {title}". When its stage is reached: "{name} reached this stage."
  3. **Otherwise:** "Next open stage: Stage {n} · {title}" (`pickGoal` over `summary.journey.stages` with no sources). It asserts nothing about the learner's goal.
  A class viewer never receives `routeGoal` or `selfRoute` (projection, section 9) and never reads another space's plans.
- **Goal reached** (case 1): "{name} reached the goal: Stage {n} · {title}."
- **Can-do line** under the goal: "By the end of this stage, {name} can:" + `learner.myRoute.stage.canDo.<n>` (the shared dictionary entry, read through `getMessages(locale)`, never copied). Only while the goal is not reached: case 1 reached and case 2 with "{name} reached this stage." drop it, as the learner card does once a goal is reached (section 4.3; LR-D, `design/screens/learning-route/stage-list.md`).
- **Plan end** (grown-up only, LR-OD-7): "Plan ends {date}" from the plan's `meta` (cases 1 with a family or self source, and 2), or from `selfRoute.endsOn` (case 1, `self`). A date, never "late" or "behind".
- **No summary journey yet** (an old app build, or never synced): "The Learning Route appears after {name}'s next sync on the newest app." It is never worded as "no progress" (F-ROUTE-001 review, R-8 row).

**The stage list page.**
- **Layout.** One reading column. Top to bottom: the header (back, `<h1>` "{name}'s Learning Route"), "Updated {date}" (from `lastSyncedAt`), the grown-up route card, the stage list. Nothing else: **no billing link, no free-allowance line** (LR-OD-8), no "Open on this device" (adults never play as the learner; that is F-BROWSE-001's job).
- **Back.** To the learner report (`ROUTES.learnerReport`) when F-REPORT-001 is in; until then to `ROUTES.space(spaceId, kind)`.
- **Stage rows** come from `summary.journey.stages`, validated by the R-9a strip (`journey-strip.ts`), which ignores unknown stages and states. Each row is an `<li>` with:
  - the badge shape of the state and the state word;
  - the stage's can-do line (`stage.canDo.<n>`), so an adult sees what the stage builds;
  - `console.journey.stageLine` with **every zero part left out**: the known part only when > 0, the done part only when > 0, and no line when both are 0 (the state word "Open" carries the row; never "0 quests done");
  - the tags **{name} is here**, **{name}'s goal** (case 1) or **Plan goal** (case 2; none in case 3), and **{name} started here** when a level check exists (stage = `placementStageNumber(summary.placement.level.stage)`, the helper `apps/web/src/lib/console/placement.ts` already uses);
  - one reserved secondary slot, **Preview lessons**, rendered only by F-BROWSE-001 (section 2).
  - **Rules.** `total` is never shown, there are no pips, and no "N / M". Consecutive `later` stages merge into one row, as on the learner page.
- **Unknown learner.** "We could not find this learner in this space." with a back link. There is no list of other learners.
- **Hard rules (unchanged).** No class average, no distribution, no sort or filter by stage, no "ahead" or "behind"; no comparison with another learner and no link to the next or previous student; no skills (they stay local, OD-11); no telemetry (the console has no telemetry client).
- **No free-lessons line here.** F-ENT-003's `freeLessonsLine` already shows on the family home card, the roster card and the report's next-steps block (E3-12, F-REPORT-001 P6); one copy per screen is enough (LR-OD-8).

### 6.2 Local read-only page (R-3, extended by LR-5a)

The route card in the third person, from the device's own `pickGoal`, so it **is** the learner's goal and may say so:
- "Now: {name} is on Stage {n}: {title}." (or the collapsed line "Stage {n} · {title}: {name} is in the goal stage", or for a taste goal "Explore Stage {n} · {title}: {name} is in the goal stage");
- "Goal: Stage {n} · {title}" with the source line "From the class's weekly plan" / "From the school's weekly plan" / "From the family's weekly plan" / "From {name}'s own weekly plan" / "Hoya's suggestion";
- "Plan ends {date}" (grown-up only);
- the goal pips; "Next: {title}" as text.

There is no button. The first-time reached line, the `seen` write and telemetry stay off (section 5.1 forces read-only). The expanded stages keep their cell rows; F-BROWSE-001 BR-12a may add **Preview lessons** to each stage row.

### 6.3 Class plan goal line (teacher; LR-9; LR-OD-10)

- **Where.** On the class roster page header (`apps/web/src/app/(console)/teach/space/page.tsx`).
- **Which plan.** Only **whole-class** live curriculum plans count: `publishedAt !== null && archivedAt === null && targetLearnerIds === null`, newest `publishedAt` first. Plans targeted at some students never produce the line. With none, no line.
- **What.** One line, **Your class's weekly plan reaches Stage {n} · {title}**, with "Plan ends {date}". It is a statement about the plan, computed from the plan alone (`planGoalStage`). It says nothing about the learners: no count of who reached it, no share, no list.
- **Family spaces** get no header line (the family's plan line lives on each learner's card, section 6.1).

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
| `learner.placement.result.seeMyRoute` (`learner.ts:930`) | See my route | See Learning Route |
| `learner.journey.intro` | 7 stages × 5 themes. Draw your own route. | Every lesson, by stage and theme. |
| `caregiver.journey.viewing(name)` | Viewing {name}'s journey | Viewing {name}'s Learning Route |
| `caregiver.journey.start(name)` | {name}'s Hangul route starts here. | {name}'s Learning Route starts here. |
| parent dashboard row title and button (R-9b, not yet written) | Journey / See journey | Learning Route / See Learning Route |
| Home strip title (R-4b, not yet written) | My route | Learning Route |
| `console.journey.title` (#313) | Journey | Learning Route |
| `a11y.tabs.route` (new) | — | Route |
| `a11y.myRoute.tab` (new) | — | Learning Route |
| `learner.myRoute.purpose` (new) | — | Where you are and where you are going. |
| `landing.*` values of F-SITE-002 that name the page | LEARNING ROUTE | Learning Route |

Unchanged on purpose:
- `learner.placement.result.routeStays` "Your route stays right where it is." It speaks about the start spot, not the page.
- Every other `learner.journey.*` string. They are about the Journey grid.
- F-PLAN-002's "weekly plan" words (OD-7: the dated plan is the weekly plan).

**New keys.** Section 11.1 has their draft English values.
- `learner.myRoute` and `caregiver.journey` route-card keys: in **LR-3b** (its copy selectors need them).
- `console.learningRoute.*` (card, page, class line): in **LR-7** (its view model needs them).
- `a11y.tabs.route`, `a11y.myRoute.tab`, `learner.myRoute.purpose`: in **LR-1**.

### 7.3 Rules and tests

- **Casing.** "Learning Route" is written in title case in English (LR-OD-1). All caps would make screen readers spell it and is harder for early readers.
- **Same access word.** A copy test asserts `learner.myRoute.state.notOpen === learner.myRoute.legend.notOpen === learner.access.notOpen` (F-ENT-003 section 3.11).
- **Banned phrases.** A copy test fails if any English value under `learner.myRoute`, `caregiver.journey`, `console.journey`, `console.learningRoute`, `a11y.myRoute`, `landing`, or `learner.placement.result.seeMyRoute`:
  - contains "my route" (case-insensitive), except `learner.placement.result.routeStays`;
  - contains "learning route" in any casing other than "Learning Route";
  - (all but `landing`) contains "family plan" or "class plan" (they collide with the product name; use "weekly plan").
- **Grown-up honesty.** A copy test fails if a `console.learningRoute` value used in cases 2 or 3 of section 6.1 contains "'s goal" or "goal:" (those cases must not claim to show the learner's own goal).
- **es / ko.** The new values fall back to English until the F-I18N-001 native review, exactly as #317 does. Proposed values go to the reviewer, not into the dictionary: es "Ruta de aprendizaje", tab "Ruta" (4); ko "학습 루트", tab "루트" (2). CLAUDE.md section 8 forbids ad-hoc ko and es strings.
- **Existing checks still apply.** Every new string passes the F-ROUTE-001 section 3.13 rules (`copyViolations`) and the length budget; learner strings also pass F-ENT-003's banned fixture (`logic/__tests__/access-banned-fixture.ts`).
- **Banned fixture.** The my-route fixture (`logic/my-route/__tests__/banned-fixture.ts`) gains `deadline`, `due`, `overdue`, `days left`, `to go`, `away from`.

## 8. Telemetry (Worker first)

| Name | Payload | When | Worker |
|---|---|---|---|
| `route_map.viewed` (exists) | gains `source: 'tab'` and `goalFrom: GoalFrom \| 'none'` | the tab gains focus (active profile only) | **no deploy needed.** The Worker checks the name only and stores the payload object as sent (`packages/backend/src/routes/telemetry.ts:62-79`). The app type in `logic/my-route/telemetry.ts` (#317) widens. |
| `route_map.continue_tapped` (exists) | gains `from: NextSource` (`'class' \| 'school' \| 'family' \| 'self' \| 'cursor'`) | the primary button is pressed | as above |
| `route_map.goal_reached` (**new**) | `{ stage: StageKey, goalFrom: 'class' \| 'school' \| 'family' \| 'self' }` | the first time the tab shows a reached plan goal on this device (section 4.3) | **LR-W1 adds it** to `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts:79` region, appended after `route_map.continue_tapped`) and its exact-list tests. The Worker is deployed before the app build that sends it (LR-5c). |
| F-ENT-003 `route.next_started` | `{ source, surface: 'route' }` (F-ENT-003 section 3.12; the value already exists) | Continue starts the `routeNext` quest | E3-1b |

- **Payloads.** Stage keys, codes and booleans only. No plan id, no date, no name, no learner id beyond the `profileId` the client already attaches. A 4xx makes the client drop the event (`platform/telemetry.ts:54`), so a wrong deploy order loses events but never blocks the queue.
- **Who sends.** Only the tab, for the active profile. The root-stack (grown-up) screen sends nothing. The console sends nothing: it has no telemetry client (F-PLAN-002 section 3.11).
- **Docs.** `docs/roadmap/TELEMETRY-NAMES-2.md` section H gains row 4 (`route_map.goal_reached`) and the widened payloads of rows 1 and 3 (LR-0).

## 9. Data, API and storage (additive only)

| Change | Where | Wire / storage | Deploy |
|---|---|---|---|
| `ProgressSummarySchema.routeGoal` | `packages/content-schema/src/schemas/sync.ts` (next to `journey`) | `routeGoal: z.object({ stage: z.string().max(32), from: z.enum(['class', 'school', 'family', 'self', 'default']) }).optional().catch(undefined)`. The stage is a plain string on the wire, validated as a `StageKey` in the reader, as `journey.stage` is. Malformed means dropped, never a 422. `schemaVersion` stays 1. | **Worker first (LR-W1).** zod strips unknown keys, so an app that sends it before the Worker knows it loses the field and nothing else. |
| family roster projection | `packages/backend/src/lib/roster-summary.ts` (`rosterSummary`) | a family space additionally receives `routeGoal` (projected to `stage` and `from`), like `selfRoute`. It is **not** added to `TEACHER_VISIBLE_SUMMARY_KEYS`: a class or school never receives it | LR-W1 |
| summary writer | `apps/mobile/src/store/sync-store.ts` `summarizeFor` (next to `journey`, the R-8 pattern; `summarize.ts` stays pure) | `routeGoal = pickGoal({ sources: sourcesOf(inboxPlans, snapshot.selfRoute), catalog, stages, today })` reduced to `{ stage, from }`; omitted when `null` | LR-6, after LR-W1 is deployed |
| `pickGoal`, `planGoalStage`, `defaultGoalStage` | `packages/content-schema/src/route/goal.ts` (new), exported from `src/index.ts` (append only) | pure, shared by the app, the console and the summary writer | none |
| `route-map-ui:<profileId>.goalsReached` | `apps/mobile/src/logic/my-route/seen.ts` | per device, optional, never synced | none |

- **Mixed builds.** The stored summary is replaced by each sync except the fields of `ADDITIVE_FIELDS` (`packages/backend/src/lib/additive-fields.ts`). A second device on an older build that syncs a summary without `routeGoal` removes it until the newer device syncs again; the family card then shows case 2 or 3 of section 6.1, which never claims to know the learner's goal. Expected; covered by a view-model test. `routeGoal` is not added to `ADDITIVE_FIELDS` (the newest device's goal is the right one).
- **Unchanged.** No D1 migration, no new endpoint, no change to `ProgressSnapshotSchema`, `JourneySummarySchema`, `SelfRouteSummarySchema` or `TEACHER_VISIBLE_SUMMARY_KEYS`. The consent text needs no new item: it lists what teachers receive (F-SPACE-002 T-1a), and teachers receive nothing new. The family-only field follows the `selfRoute` precedent (F-PLAN-002 D11).
- **Offline.** The learner page works offline from the local snapshot, the inbox copy and the bundle. The adult views need the network; they use the console's existing "can't reach" error path with **Try again**.

## 10. Accessibility

- **Route card.** One `accessibilityRole="summary"` block; focus lands on it when the tab gains focus (it replaces the hero sentence of F-ROUTE-001 section 3.14). Its label reads in order: "Now: Stage 1, Hangul. Goal: Stage 2, Words. From your class's weekly plan. Some quests done, more are ready. Next: Family at the Table." (collapsed form: "Stage 1, Hangul: you are in your goal stage. ..."). The pin, flag and pip glyphs are hidden from screen readers; the goal pips are one label without digits.
- **Stage rows.** A stage row's label gains "Your goal." (or "{name}'s goal." on grown-up pages) after the here part and before the start part, the order the tags show. This is an additive argument to `a11y.myRoute.stage` and `stageGrownup`: a trailing optional `goal = false` after `played`, so existing callers do not change, spoken between the here and start parts. LR-3b's copy test asserts "... You are here. Your goal. You started here. ..." (and "... Sam is here. Sam's goal. Sam started here. ..." for `stageGrownup`).
- **Tab.** Label "Route", accessibility label "Learning Route". Selection state comes from the navigator. While the four-tab bar shows, the native tab label grows with the text size up to 1.3 x caption and then shrinks to fit rather than being cut off (`maxFontSizeMultiplier` 1.3, `numberOfLines` 1, `adjustsFontSizeToFit`; LR-D, `design/screens/learning-route/tab-bar.md`). The three-tab bar with the flag off is unchanged.
- **Shapes and words.** Not-open pips share the dotted ring with coming-later pips; the words and the legend tell them apart, and colour is never the only cue.
- **Adult views.**
  - The stage list is a real `<ol>` and each row is an `<li>` with text.
  - The tags are text, not colour.
  - Targets are at least 44 px.
  - It reflows at 320 px and at 200 % zoom.
  - `<h1>` is "{name}'s Learning Route"; on the report the card sits under the report's own heading as a `section` labelled "Learning Route".
- **Unchanged.** The 18 pt body floor, `touchTarget.min`, reduced motion and the 320 x 568 reflow all stay as in F-ROUTE-001 section 3.14.

## 11. Privacy and safety

- **Child's data.** One new field leaves the device: `summary.routeGoal`, a stage key and a source code, read only by the learner's family space. Teachers receive nothing new.
- **URLs** carry ids only. The adult page heading uses `displayName`, which the roster already anonymizes when `anonymizeRoster` is on (`routes/spaces.ts:374-386`).
- **No learner surface** of this amendment shows a price, a product name, "Premium", a purchase button or an ask prompt. F-ENT-003's episode preview, reached by tapping a not-open row, carries its own gated ask (F-ENT-003 section 3.15). Native builds never show a not-open pip.
- **No billing link** on any surface of this amendment, on any host.
- **Anti-shame.**
  - The goal is a stage with a can-do line. There is no number to the goal, no countdown and no date on learner screens; the goal pips only fill.
  - "Next" is never "late".
  - Reaching a goal is celebrated once. Not reaching it is never mentioned.
  - Adult rows never show "0".
  - The adult views compare no learners.
- **Adults never play or write as the learner.** The root-stack screen is forced read-only; the console views write nothing and send no telemetry.

### 11.1 Draft English strings (final values live in the dictionary)

`learner.myRoute` (LR-3b, except `purpose` in LR-1):
- labels and tags: `now.label` "Now" · `goal.label` "Goal" · `tag.goal` "Your goal" · `purpose` "Where you are and where you are going." · `legend.notOpen` "Not open yet" (equal to `learner.access.notOpen`)
- goal line: `goal.stage(n, title)` "Stage {n} · {title}" · `goal.inGoal(n, title)` "Stage {n} · {title}: you are in your goal stage" · `goal.explore(n, title)` "Explore Stage {n} · {title}" · `goal.exploreInGoal(n, title)` "Explore Stage {n} · {title}: you are in your goal stage" (the collapsed taste line, LR-D) · `goal.tasteLine` "Try the first quests of this stage." (the can-do lead is the existing `canDoLead` "By the end of this stage you can:")
- goal reached: `goal.reachedStage(n, title)` "Stage {n} · {title} · reached" · `goal.keepGoing(title)` "Keep going: {title}" · `goal.reachedHoya` "You reached your goal. Hoya is proud!"
- end of road: `goal.endOfRoad` "You reached the end of the open road. More is coming."
- content cannot be read (F-ROUTE-001 section 3.17, wireframe J; LR-D): `hero.error` "Hoya could not open your Learning Route." with the button `common.buttons.tryAgain`
- source line: `goal.from.class` "From your class's weekly plan" · `goal.from.school` "From your school's weekly plan" · `goal.from.family` "From your family's weekly plan" · `goal.from.self` "From your own weekly plan" · `goal.from.default` "Hoya's suggestion"
- reused from F-ENT-003 (not new here): `learner.access.notOpen`, `learner.access.openForYou`, `learner.access.practiceWords.cta`, `learner.routeNext.tag.inPlan`, `a11y.access.notOpen(title)`

`caregiver.journey` (LR-3b; viewer `grownup`; `here(name, n, title)`, `canDoLead(name)`, `hereTag(name)` already exist):
- `goal.inGoal(name, n, title)` "Stage {n} · {title}: {name} is in the goal stage" · `goal.exploreInGoal(name, n, title)` "Explore Stage {n} · {title}: {name} is in the goal stage" · `error(name)` "Hoya could not open {name}'s Learning Route." (LR-D)
- source line: `goal.from.class` "From the class's weekly plan" · `goal.from.school` "From the school's weekly plan" · `goal.from.family` "From the family's weekly plan" · `goal.from.self(name)` "From {name}'s own weekly plan" · `goal.from.default` "Hoya's suggestion"
- `goal.reached(name, n, title)` "{name} reached the goal: Stage {n} · {title}." · `planEnds(date)` "Plan ends {date}" · `goalTag(name)` "{name}'s goal" · `endOfRoad(name)` "{name} reached the end of the open road. More is coming."
- shared with the learner (no "you"): `now.label`, `goal.label`, `goal.stage`, `goal.reachedStage`, `goal.explore`, `goal.tasteLine`

`console.learningRoute` (LR-7):
- heading and link: `title(name)` "{name}'s Learning Route" · `open` "Open Learning Route" · `section` "Learning Route" · `stagesTitle` "Stages" (the heading over the stage list, LR-D; LR-7 ships it, or LR-8 if LR-7 merged without it). A taste stage's row word is the learner's `learner.myRoute.state.taste` "A taste", read through `getMessages(locale)` (no console key); a merged later run uses the existing `console.journey.stages(from, to, text)` "Stages 5 to 7: Coming later"
- back links: `back.report` "Back to the report" · `back.class` "Back to the class" · `back.family` "Back to the family"
- card, case 1: `now(name, n, title)` "{name} is on Stage {n}: {title}." · `learnerGoal(name, n, title)` "{name}'s goal: Stage {n} · {title}" · `fromLead.class` "From the class's weekly plan" · `fromLead.school` "From the school's weekly plan" · `fromLead.family` "From your family's weekly plan" · `fromLead.self(name)` "From {name}'s own weekly plan" · `fromLead.default` "Hoya's suggestion: the next open stage" · `reached(name, n, title)` "{name} reached the goal: Stage {n} · {title}."
- card, case 2: `planReaches.class(n, title)` "Your class's weekly plan reaches Stage {n} · {title}" · `planReaches.family(n, title)` "Your family's weekly plan reaches Stage {n} · {title}" · `stageReached(name)` "{name} reached this stage."
- card, case 3: `nextOpen(n, title)` "Next open stage: Stage {n} · {title}"
- shared parts: `canDoLead(name)` "By the end of this stage, {name} can:" · `planEnds(date)` "Plan ends {date}" · `endOfRoad(name)` "{name} reached the end of the open road. More is coming."
- stage tags: `hereTag(name)` "{name} is here" · `startTag(name)` "{name} started here" · `goalTag(name)` "{name}'s goal" · `planGoalTag` "Plan goal"
- sync state: `updated(date)` "Updated {date}" · `notSynced(name)` "The Learning Route appears after {name}'s next sync on the newest app."
- errors: `notFound` "We could not find this learner in this space." · `cantReach` (existing console wording)
- class line (LR-9) reuses `planReaches.class` and `planEnds`.

`a11y` (LR-1 and LR-3b):
- `tabs.route` "Route" · `myRoute.tab` "Learning Route"
- `myRoute.routeCard(nowText, goalText, fromText, pipsText, nextText)` joins the visible parts with ". "
- `myRoute.goalPips.none` "Ready when you are" · `.some` "Some quests done, more are ready" · `.all` "Every quest here is done"

## 12. Tests

Counts are asserted on the frozen fixtures of F-ROUTE-001 section 5: `catalog-2026-10.ts`, `bundle-2026-10.ts`, and goldens A and B of F-PLAN-002.

| File | Level | Covers |
|---|---|---|
| `packages/content-schema/src/route/__tests__/goal.test.ts` | unit, 100 % | precedence teacher > parent > system, newest `assignedAt` in a rank; classic plan ignored; finished plans ignored (last day inclusive); `planGoalStage` = highest lesson stage, stories ignored, level stage fallback; default = first `open` stage; taste flag; `reached` per section 4.1 rule 6; `null` at the end of the road |
| `…/route/__tests__/goal-golden.test.ts` | unit | `planGoalStage(toPlanItems(d), toMeta(d), catalog) === d.stats.endsAtStage` for goldens A and B |
| `apps/mobile/src/logic/__tests__/journey-availability-parity.test.ts` | unit | `stageAvailabilityOf(CATALOG, s) === stageAvailability(s, gridEpisodes)` for the 7 stages (LR-3b) |
| `content-schema/src/__tests__/sync.test.ts` (extend) | unit | `routeGoal` optional; a malformed one (unknown `from`, long stage, wrong type) is dropped without dropping the summary |
| `content-schema/src/__tests__/telemetry.test.ts`, `backend/src/__tests__/telemetry.test.ts` (extend) | unit, integration | `route_map.goal_reached` in the exact list |
| `backend/src/lib/__tests__/roster-summary.test.ts`, `backend/src/__tests__/spaces.test.ts` (extend) | unit, integration | a family roster returns `routeGoal`; a class roster of the same learner returns neither `routeGoal` nor `selfRoute`; unknown keys under `routeGoal` never leave |
| `apps/mobile/src/logic/my-route/__tests__/model.test.ts` (extend) | unit, 100 % | `goal`, `goalPips`, `next`, `nextKind`, `inPlanEpisodeIds` on the fixtures with injected `RouteNext` and `PlanView` values (quest from each source including `cursor`, `free-end`, `rest`); hero kind from `nextKind`; `laterReason: 'notOpen'`; kept quests never not open; collapsed goal line when goal equals here; the weekly plan line never carries a Next title; `here` equals `summarizeJourney(...).here` whatever `routeNext` says |
| `…/monotonic.test.ts` (extend) | property | new step "access shrinks" (`isQuestOpen` turns false): done pips and latches unchanged |
| `…/seen.test.ts` (extend) | unit | `goalsReached` missing reads `[]`; written once per key; never from the grown-up entry; failed write swallowed |
| `…/access.test.ts` (extend, #317 file) | unit | grown-up entry for the active profile is `readOnly` (gate open) or `gate` (closed), never `self`; tab entry unchanged |
| `…/copy.test.ts`, `…/dictionary.test.ts` (extend) | unit | the section 7.3 bans (casing, "my route", "family plan", "class plan"); new keys through `copyViolations`, F-ENT-003's banned fixture and the length budget; `a11y.tabs.route` within 12; grown-up twins in the third person; no dates or digits in learner goal strings |
| `…/telemetry.test.ts` (extend, #317 file) | unit | `source: 'tab'`, `goalFrom`, `from`, `goal_reached` once per key, nothing from the grown-up entry |
| `apps/mobile/src/logic/my-route/__tests__/screen-source.test.ts` (extend, #317 file) | unit | Route tab behind the flag; tab variant has no back button; entries for the active profile navigate to the tab; every `navigate('MyRoute'` passes `profileId` and `viewer`; flag and route glyphs come from `Icon`; no billing, plans or ask link under `screens/my-route/`; access read only through `useQuestAccess()` |
| `apps/web/src/lib/console/__tests__/learning-route-view.test.ts` | unit, 100 % | rows from `summary.journey` (unknown stages and states ignored, `later` runs merged, zero parts omitted); goal cases 1 to 3 per viewer; a draft or archived plan never sets a goal; a plan targeted at another learner is ignored; newest `publishedAt` wins; a class viewer never reads `routeGoal` or `selfRoute`; secondary family-plan line only when the family plan does not lead; start stage via `placementStageNumber`; not-synced state; nothing exported that averages, sorts or compares |
| `apps/web/src/lib/console/__tests__/class-goal-line.test.ts` | unit | whole-class plans only; newest `publishedAt`; targeted-only plans give no line; drafts give no line |
| `apps/web/src/lib/console/__tests__/routing.test.ts` (extend) | unit | `learnerRoute(spaceId, learnerId, kind?)` encodes ids; `kind: 'family'` never yields `/teach`; omitted kind yields `/teach/space/route`; no name parameter exists |
| `apps/mobile/e2e/web/my-route.spec.ts` (extend R-10's) | e2e | Route tab at 320 x 568, 375 x 667, 844 x 390, 1180 x 820: four tabs, no horizontal scroll, route card text, goal tag; at 320 x 568, three tags on one row take at most two rows at the default text size (assumption f); each tab label is no wider than its item, per shipped UI locale (`scrollWidth <= clientWidth`); Continue's box is fully above the tab bar's top edge with the longest Stage 1 quest title as Next; a plan fixture shows "From your class's weekly plan" and Continue opens the same quest as Home card (2) |
| `apps/web/e2e/learning-route.spec.ts` | e2e | the stage list page under `/parent/space/route` and `/teach/space/route` on a mocked roster at 320 and 1280: `<ol>` of stages, can-do lines, no `/ \d+` ratio, no "0 quests", no "behind", no billing link, not-found state, back link; the report's At a glance card and its link (once RP-7a is in) |

Coverage: `packages/content-schema` 100 %; `apps/mobile/src/logic/my-route/` 100 %; `apps/web` console logic 90 % or more (`learning-route-view.ts` 100 %).

## 13. PR table

Small rows. Each one is TDD and behind `flags.myRouteEnabled` where it touches the learner UI.

| PR | Content | Size | Needs |
|---|---|---|---|
| **LR-0** | `docs`: this amendment; F-ROUTE-001 edits (LR-A1 to LR-A8); wireframes `journey/learning-route.md`, `parent/learning-route.md`, `console/learning-route.md`; header note on `journey/my-route-overview.md`; `TELEMETRY-NAMES-2.md` section H rows; README index line and glossary | S | — |
| **LR-D** | `design`: mocks in `design/screens/learning-route/` (route card states: goal differs, goal equals now, reached, taste, end of road, free-end; the report's goal line; the stage list page at 320 and 1280; the four-tab bar) and the `route` and `flag` glyph sheet in `design/components/`; closed marker and ring at pip size come from F-ENT-003 E3-D | S | LR-0 |
| **LR-W1** | `feat(content-schema,backend)`: `route_map.goal_reached` name and exact-list tests; `ProgressSummarySchema.routeGoal` (tolerant); family-only `routeGoal` in `rosterSummary`; roster and sync tests. **Deploy the Worker before LR-5c and LR-6 reach an app build.** | S | LR-0 |
| **LR-1** | `feat(i18n,mobile)`: English values of section 7.2 for every key already on main (including `learner.journey.intro` and any `landing.*` value naming the page); `a11y.tabs.route`, `a11y.myRoute.tab`, `learner.myRoute.purpose`; copy test (section 7.3). Includes `console.journey.title` if #313 has merged, else #313 adopts it | S | LR-0, R-3 (#317) merged |
| **LR-2** | `feat(design-system)`: `Icon` glyphs `route` and `flag` (drawn SVG paths, glyph test, entry in the Icon sheet) | S | LR-D |
| **LR-3a** | `feat(content-schema)`: `route/goal.ts` (`pickGoal`, `planGoalStage`, `defaultGoalStage`, `stageAvailabilityOf`, `GoalSource`) + golden parity test; append export to `src/index.ts` | S | LR-0 |
| **LR-3b** | `feat(mobile,i18n)`: `buildMyRoute` gains `goal`, `goalPips`, `next` / `nextKind` (from an injected F-ENT-003 `RouteNext`), `inPlanEpisodeIds` (from an injected `PlanView`), `isQuestOpen` and `laterReason: 'notOpen'`; `seen.goalsReached`; the new `learner.myRoute`, `caregiver.journey` and `a11y.myRoute` keys of section 11.1 and their copy selectors; no UI | M | LR-3a, R-3 merged, F-ENT-003 E3-4 merged |
| **LR-4** | `feat(mobile)`: Route tab (types, `tabs.tsx`, tab variant of `MyRouteScreen`, purpose line, icon, a11y label); active-profile entries go to the tab (Journey header, placement result link); root-stack `MyRoute { profileId, viewer: 'grownup' }` with required params and `myRouteAccess` forced read-only; `route_map.viewed` `source: 'tab'`; behind the flag | M | LR-1, LR-2, R-3 merged; F-APP-001 learner-shell PR if it edits `tabs.tsx` first (rebase only) |
| **LR-5a** | `feat(mobile)`: route card (Now / Goal / source / can-do / goal pips / Next / one button; collapsed line; self and grown-up variants), goal tag on the trail, "In your plan" cell tag, weekly plan line without a Next title, screen wiring of `routeNext` and `planView`, the same goal passed to the Home strip (`homeStripView({ goalStage })`, R-4b) and to the parent dashboard row (`dashboardRowView({ goalStage })`, R-9b), `route_map.continue_tapped.from`, `route.next_started { surface: 'route' }` | M | LR-3b, LR-4, LR-D |
| **LR-5b** | `feat(mobile)`: not-open pips, their legend row and stage caption; the `free-end` hero (`openForYou`, Practice words or Open Library; no ask) — F-ENT-003 E3-10 is withdrawn in its favour; screen-source tests | S | LR-5a, F-ENT-003 E3-2 and E3-D |
| **LR-5c** | `feat(mobile)`: first-time reached Hoya line, `seen.goalsReached` write, `route_map.goal_reached` | S | LR-5a, LR-W1 deployed |
| **LR-6** | `feat(mobile)`: the summary writer adds `summary.routeGoal` in `sync-store.ts` | S | LR-3a, LR-W1 deployed |
| **LR-7** | `feat(web,i18n)`: `lib/console/learning-route-view.ts` (pure view model of section 6.1) and `lib/console/class-goal-line.ts` + tests; `ROUTES.learnerRoute(spaceId, learnerId, kind?)`; `console.learningRoute.*` keys | M | LR-3a, R-9a (#313) merged |
| **LR-8** | `feat(web)`: the stage list page `/teach/space/route` (and its `/parent/space/route` twin when F-APP-001 A-5b has merged, else A-5b adds it), the grown-up route card component, `learningRouteEnabled()` if A-5b has not added it, and the goal line under the report's `nowOn` line when F-REPORT-001 RP-7a2 has merged (else RP-7a2 adds it) | M | LR-7, LR-1, LR-D |
| **LR-9** | `feat(web)`: class plan goal line on the class roster header | S | LR-7 |
| **LR-10** | `test(e2e)`: extends R-10's mobile spec with the tab and the route card; adds `apps/web/e2e/learning-route.spec.ts`; the 5-second comprehension check on the screenshots. Adds to the flag-on block of `apps/mobile/e2e/web/route-tab.spec.ts`: (a) the dashboard row for the active learner, through the gate, opens the read-only page (Go back present, no purpose line, no Continue button, no tab redirect); (b) a finished level check's "See Learning Route" opens the Route tab (purpose line shown, Route tab selected). Before R-10 flips the flag, `route-tab.spec.ts` runs on a build made with `EXPO_PUBLIC_MY_ROUTE_ENABLED=true` (`E2E_MY_ROUTE=1`, plus `EXPO_PUBLIC_SHOW_ALL_LOCALES=1` and `E2E_ALL_LOCALES=1` once ko or es ship) and the run is linked in the flip PR: CI builds with the flag off, so this block is skipped there. The flag flip stays R-10's | S | LR-4, LR-5a, LR-5b, LR-8 |
| **LR-11** | `fix(mobile)`: the route card fits 320 x 568 with 15 Stage 1 pips: Continue (or Start) sits fully above the tab bar with the longest Stage 1 title as Next (G2, "one tap away"); `my-route.spec.ts`'s overlap check turns to `toBeLessThanOrEqual(0)`; `design/screens/learning-route/route-card.md` updated with the narrow-width layout; the 5-second check (assumption g) is run again on the new 320 screenshots (result in the section 16 LR-11 entry). Finding of the LR-10 run, issue #530. **Precondition of R-10's flip** | S | LR-10 |

These PRs edit their rows in F-ROUTE-001 instead of adding new PRs:
- **R-4b** (Home strip): gains the "Goal" line and the new title.
- **R-9b** (parent dashboard row): gains the new title and button (`MyRoute { profileId, viewer: 'grownup' }`) and the goal line "Goal: Stage {n} · {title}" from `pickGoal` over the local model. R-9b ships the line as a slot (`dashboardRowView({ goalStage })`, hidden while absent) because LR-3a is not on main; LR-5a passes the same goal it gives the route card. The row's Started line shows only while the card has no Starting spot row (`flags.placementEnabled` off), so the level check appears once per card; See the check stays on the Starting spot row.
- **R-10**: covers the tab.

**Order.**
- After LR-0: LR-D, LR-W1 and LR-3a in parallel; then LR-2.
- After R-3 merges: LR-1; after R-3 and F-ENT-003 E3-4: LR-3b.
- Then LR-4, then LR-5a; LR-5b after F-ENT-003 E3-2 and E3-D; LR-5c after the LR-W1 deploy.
- LR-6 after LR-3a and the LR-W1 deploy.
- LR-7 and LR-9 once LR-3a and R-9a are in, then LR-8. They do not wait for the learner PRs or for F-APP-001.

**Total:** 17 PRs (one design row; LR-11 added by the LR-10 review), one Worker deploy (LR-W1), no D1 migration, no new endpoint.

## 14. Owner decisions (each has a default that applies until answered)

| Id | Question | Default | Alternative | Gates | Reversible |
|---|---|---|---|---|---|
| LR-OD-1 | How is the name written? | **Learning Route** in title case in every English string, the site included; the tab label is **Route** (tab budget 12) and its accessibility label is "Learning Route" | all caps "LEARNING ROUTE" (screen readers may spell it, harder for early readers; F-SITE-002 changes with it); or a longer tab label with a raised tab budget | LR-1, LR-4 | yes (strings); **answered 2026-10-13: keep the default** (tab label Route for the page Learning Route), knowingly after the LR-11 naming verdict (section 16, R-10b entry) |
| LR-OD-2 | Where does the tab sit? | **Today · Route · Journey · Library** | Today · Journey · Route · Library | LR-4 | yes (one array) |
| LR-OD-3 | Keep the Journey grid as its own tab, and how are the two told apart? | **keep both**; each header gets one purpose line: Route "Where you are and where you are going.", Journey "Every lesson, by stage and theme."; verified by a 5-second comprehension check in LR-10 before the flag flips | (b) relabel the Journey tab "Lessons" (English value only, within 12); (c) later merge both into one tab with a Road / Grid switch (needs a new spec: GridCell has three owners) | LR-1, LR-4 | yes; **answered 2026-10-13: keep default (a)**, both tabs, each with its purpose line, knowingly after the LR-11 naming verdict (section 16, R-10b entry) |
| LR-OD-4 | Which plan sets the goal? | **class > school / family > self**, newest first in a rank (the order Home and `routeNext` already use) | the learner's own plan first (would then also need F-ENT-003 OD-7 to change, so "next" and "goal" agree) | LR-3a | yes (one rank table) |
| LR-OD-5 | Goal with no plan | **the first stage that is still open**: Stage 1 now, then "Explore Stage 2", then Stage 4, then the end-of-road line | always "Finish Stage 1" until F-ROUTE-001 OD-9 defines later levels | LR-3a | yes |
| LR-OD-6 | Does Continue follow the plan? | **decided by F-ENT-003 OD-7** (default yes): the page shows `routeNext` and has no rule of its own | — | — | via F-ENT-003 |
| LR-OD-7 | Show the plan's end date? | **grown-up views only** ("Plan ends {date}"); never on learner screens | also show the date to self learners | LR-5a, LR-7 | yes |
| LR-OD-8 | Lessons outside the free plan (F-ENT-003) | learner page: **"Not open yet" with the dotted ring** (the Journey's word and shape; no lock, no product name), the calm free-end hero, **no ask on this page**; adult views of this amendment: **no line** (F-ENT-003's `freeLessonsLine` shows on the family home card, the roster card and the report) | learner page: the lock glyph everywhere (F-ENT-003 OD-6 alternative; Journey and Library change too); adult views: F-ENT-003's `freeLessonsLine` also on the stage list page, owner only, with **Open billing** on the app host | LR-5b, LR-8 | yes |
| LR-OD-9 | Who may open the adult Learning Route? | **every adult who can open the roster** (`summary.read`), on free and paid accounts: progress visibility is not a paid feature (the paid browse-as-learner section is F-BROWSE-001) | paid accounts only | LR-8 | yes |
| LR-OD-10 | Class plan goal line for teachers | **yes**, one line about the newest whole-class plan, never about learners | no line | LR-9 | yes |
| LR-OD-11 | Keep the Journey header link once the tab exists? | **yes**, "See Learning Route" (one tap from the grid to the road) | remove it | LR-4 | yes |
| LR-OD-12 | Does the parent see the goal the child's device shows? | **yes**: the device sends a family-only `summary.routeGoal` (stage and source code), so the parent's card and the child's tab name the same goal | no new field: the parent sees only "Your family's weekly plan reaches ..." or "Next open stage ..." | LR-W1, LR-6, LR-7 | yes (drop the field from the projection) |

**Assumptions to verify** (with the PR that verifies each):

| # | Assumption | Verified in |
|---|---|---|
| a | Four tab items fit at 320 dp with 200 % text: the label "Route" wraps to no more than one line. Met with the native label cap (1.3 x caption, then shrink to fit; LR-D, `design/screens/learning-route/tab-bar.md`). The web build's text is in px and does not follow the text size, so the web e2e checks the default size per locale and the 200 % case is checked on a device | LR-4 e2e at 320 x 568 (default size); R-10b: at the native label cap (1.3 x caption) in 80 px items on the web build at 320 x 568 (`route-tab.spec.ts`, "at the native label cap"), and at text size 214 % and 264 % on an iOS Simulator build with 94 pt items (section 16, R-10b entry); the native 320 pt / 320 dp check at 200 % is tracked in issue #587 |
| b | `route` and `flag` glyphs read clearly at tab size and at 20 dp in greyscale | LR-D, LR-2 |
| c | Goldens A and B give `planGoalStage === stats.endsAtStage` | LR-3a |
| d | The roster and plans responses the console already loads are enough for the summary views (no new request) | LR-8 |
| e | F-ENT-003's `questOpenPredicate` is quest-level and `RouteNext` carries `episodeId` | LR-3b |
| f | Three tags on one stage row ("You are here", "Your goal", "You started here", in that order) at 320 x 568 take at most two rows at the default text size; at 200 % text each tag takes its own row (a tag may wrap inside itself), nothing is cut off and nothing scrolls sideways. Revised by LR-D: at 200 % no order or layout of these words fits two lines (`design/screens/learning-route/route-card.md`). The 200 % part is a native check: the web build's px text does not follow the text size, and the repo's web 200 % proxy (a halved viewport) would measure a 160 px window instead | LR-D (mock), LR-4 web e2e (default size), at text size 200 % on an iOS Simulator build in R-10b (section 16, R-10b entry) |
| g | A first-time learner tells Route and Journey apart from their purpose lines within 5 seconds | LR-10 (screenshot check or hallway test) |
| h | "Not open yet" and "Coming later" pips, which share the dotted ring, are told apart by their words and the legend at 320 x 568 | LR-10 |

## 15. Amendments applied to F-ROUTE-001 (LR-A)

| Id | F-ROUTE-001 section | Change |
|---|---|---|
| LR-A1 | header, title, scope, 3.1 | Title "Learning Route (code name My route)". Scope gains the tab, the goal and the adult views. Section 3.1: the decision becomes the Route tab; OD-2 is superseded by LR-OD-2; the root-stack screen is grown-up only and always read-only; the entry list follows section 5.2 here |
| LR-A2 | 3.1 naming, 3.13, Appendix B | "My route" becomes "Learning Route" in learner, caregiver and console copy; OD-7 keeps "weekly plan" for every dated plan; the Appendix B values follow section 7.2 here |
| LR-A3 | 3.5 | The hero becomes the route card (section 4.3 here); the hero kind is computed from F-ENT-003's `routeNext` (section 4.4), which wraps the one cursor |
| LR-A4 | 3.2 | Additive `MyRouteModel` and `MyRouteInput` fields (section 4.4) |
| LR-A5 | 3.3, 3.4 | `laterReason: 'notOpen'` and the `isQuestOpen` input with F-ENT-003's word and shape ("Not open yet", dotted ring; section 4.5) |
| LR-A6 | 3.12 | The adult views (section 6): the card in the per-learner report, the stage list page, the forced read-only root-stack screen; the R-9b row and the console strip use the new names; the R-4b strip gains the goal line |
| LR-A7 | 3.16 | `source: 'tab'`, `goalFrom`, `from`, the new name `route_map.goal_reached` |
| LR-A8 | 4, 6.1, 9 | "A fourth tab" leaves Out of scope; the PR table points to section 13 here; OD-2 and OD-7 point to LR-OD-2 and LR-OD-1 |

## 16. Review log

**2026-10-11, first draft** (commit `10f11493`). Two independent reviews: review 1 "NOT READY" (1 blocker, 8 majors, 5 minors), review 2 "APPROVE WITH CHANGES" (5 majors, 9 minors). This revision applies every blocker and major and every minor listed as applied below.

| Finding | Decision | Where |
|---|---|---|
| R1 blocker: two `routeNext` contracts and two free-boundary stories (F-ENT-003) | **applied, aligned with F-ENT-003 revision 2** (written in parallel; it adopted this amendment's "Not open yet" and dotted ring, dropped the lock glyph and withdrew E3-10). No `logic/my-route/next.ts`; `MyRouteModel.next` is F-ENT-003's `routeNext`, `inPlanEpisodeIds` its `planView()`; the words are F-ENT-003's glossary keys (`learner.access.notOpen`, `openForYou`, `practiceWords.cta`, `learner.routeNext.tag.inPlan`); the route page has no ask, the episode preview carries it; LR-5b draws the free-end state; `cell.inPlan` and `goalReachedLine` dropped | sections 2, 4.4, 4.5, 11.1, 13 |
| R1 major: "family plan" collides with the product name | **applied.** Source lines say "weekly plan" ("From your class's weekly plan", ...); glossary; copy test bans "family plan" and "class plan" in this amendment's namespaces; the free line is gone by default and its alternative uses F-ENT-003's phrase | header glossary, 4.3, 6, 7.3, 11.1, LR-OD-8 |
| R1 major: parent page in the teacher URL space | **applied.** `ROUTES.learnerRoute(spaceId, learnerId, kind?)` with F-APP-001's `spacePath`; family under `/parent/space/route` (F-APP-001 lists both paths and enforces twins through `SPACE_PAGES`); routing test | 2, 6.1, 12 |
| R1 major: parents may never find the page; two overlapping per-child pages | **applied.** The report's At a glance carries the link and one goal line (F-REPORT-001 RP-7a2), the full card is on the stage list page; F-APP-001's family home card links straight to it (F-APP-001 revised its card to carry report, note and route links); no roster-card button | 2, 6.1 |
| R1 major: no hook for owner item 14 | **applied, adjusted.** Each adult row shows its can-do line and reserves a "Preview lessons" slot rendered only by F-BROWSE-001 through `buildBrowseUrl`. Visibility follows F-BROWSE-001's own access rules (its pass scope), not a `browseAsLearner` flag: that name is a F-SITE-002 claim, F-BROWSE-001 defines no such app flag | 2, 6.1, 6.2 |
| R1 major: product name casing differs from F-SITE-002 | **applied.** Title case kept; glossary in the specs README; F-SITE-002 revision adopted "Learning Route" with its own casing test; LR-1's casing test also covers `landing` | 2, 7.2, 7.3, README |
| R1 major and R2 major: parent, child and device views disagree on the goal | **applied, combined.** Family-only `summary.routeGoal` from the device (R1, LR-OD-12) so the parent card names the child's real goal; every other case uses scoped wording that never claims the learner's goal (R2: "Your class's weekly plan reaches ...", "Next open stage ..."), with a copy test. Replaces the first draft's `selfRoute.goalStage` | 6.1, 7.3, 9, LR-OD-12 |
| R1 major: the card does not show distance to the goal; Goal = Now repeats | **applied.** Fill-only goal pips with a digit-free label; collapsed line when Goal equals Now | 4.3, 10 |
| R1 major: Route and Journey are near-synonyms | **applied.** LR-OD-3 default: purpose line on both headers (Journey intro drops "route"); alternative "Lessons"; 5-second check in LR-10 | 5.1, LR-OD-3, assumption g |
| R1 minor: two "Next" items on one screen | **applied, stronger.** The weekly plan line on this page never carries a Next title | 4.3 |
| R1 minor: repeated sentences (F, C) | **applied.** End of road: one sentence; reached: the Hoya line in the card, goal line "... · reached" | 4.3 |
| R1 minor and R2 minor: "0 quests done"; vague "Hoya's suggestion" for adults | **applied.** Zero parts omitted, the state word carries the row; adult default worded "Hoya's suggestion: the next open stage" or "Next open stage" | 6.1 |
| R1 minor: inconsistent calls to action; three tags at 320 | **applied.** One verb per surface type; placement "See Learning Route"; assumption f | 5.2, 7.2, 14 |
| R1 minor and R2 minor: several class plans, targeted plans | **applied.** Summary card: plans that target the learner, newest `publishedAt`; class line: whole-class plans only, newest `publishedAt`, else no line | 6.1, 6.3, 12 |
| R2 major: dashboard can open the child's interactive page | **applied.** Root-stack `MyRoute { profileId, viewer: 'grownup' }`, both required; grown-up entry never resolves to `self`; tests for access, telemetry and seen | 5.1, 5.2, 12 |
| R2 major: drafts can set the goal | **applied.** Console sources require `publishedAt !== null && archivedAt === null`; `assignedAt := publishedAt` | 4.1, 6.1, 6.3, 12 |
| R2 major: free-allowance line can push a purchase on a covered learner | **applied.** No line on this amendment's views (LR-OD-8). The line now lives only in F-ENT-003's `freeLessonsLine` (E3-12); F-ENT-003 is asked to judge coverage per learner. F-ENT-003 section 6.4 asked this amendment to show that line on the summary page: **declined**, because the report on the same path already shows it (one copy per screen) | 2, 6.1, LR-OD-8 |
| R2 major: Billing link on hangulroute.com (owner item 12) | **applied.** No billing link on any surface of this amendment, on any host; the page sits behind `learningRouteEnabled()`; old hangulroute.com addresses are forwarded by F-SITE-002 S-10 | 2, 6.1, 11 |
| R2 minor: missing `profileId` opens a second learner page | **applied.** Params required; `replace` to the tab on `self`; screen-source test | 5.1, 5.2 |
| R2 minor: string PR order | **applied.** Learner and caregiver keys in LR-3b; console keys in LR-7 | 7.2, 13 |
| R2 minor: LR-5 too large | **applied.** LR-5a, LR-5b (the free-end state F-ENT-003 E3-10 handed over), LR-5c | 13 |
| R2 minor: missing strings (can-do lead, end of road) | **applied.** `console.learningRoute.canDoLead`, `endOfRoad`; can-do lines read from the shared dictionary entry | 6.1, 11.1 |
| R2 minor: iOS App Review risk | **applied.** F-ENT-003's `gatingActive` keeps native builds ungated until F-IAP-002 (its OD-13); the route page reads access only through `useQuestAccess()` and renders no billing, plans or ask link (test) | 2, 4.5, 12 |
| R2 minor: `selfRoute.goalStage` erased by a pre-LR build | **resolved by removal.** The field is replaced by `summary.routeGoal`; the mixed-build behaviour is documented and falls back to honest wording | 9 |
| R2 minor: undefined owner and start-stage predicates | **applied / moot.** Start stage = `placementStageNumber(summary.placement.level.stage)`. The owner predicate is no longer needed (no owner-only line) | 6.1 |
| R2 minor: no design mock step for the card and the adult page | **applied.** LR-D row; LR-2, LR-5a and LR-8 depend on it | 13 |

**2026-10-12, LR-D design pass** (#399). The mock measured assumption f at 320 (tag row 236 px). In the old order (here, start, goal) the three tags took three rows at the default text size. At 200 % text, "You are here" (173 px) and "Your goal" (152 px) cannot share a row, so no order or layout fits two lines. **Applied:** the goal tag sits between the here and start tags. That gives two rows at the default text size (here and goal 201 px of 236; 230 px with a wide fallback font) and up to 120 % text. Assumption f now asks for two rows at the default size, and one row per tag with nothing cut off at 200 % (sections 4.3, 10, 12, 14). **Also added** to section 11.1, because the mocks need them and no key existed: the collapsed taste line (`goal.exploreInGoal`, learner and grown-up; section 4.3's taste row), the error line of wireframe J (`hero.error`, grown-up `error(name)`), and the stage list heading (`console.learningRoute.stagesTitle`).

**2026-10-12, LR-D review pass** (#399, two reviews). **Applied:** the grown-up card hides the can-do line once the goal is reached, as the learner card does (section 6.1); the spoken goal part of a stage row is a trailing optional `goal` argument, read between the here and start parts (section 10); the four-tab bar's native label grows up to 1.3 x caption and then shrinks to fit, measured with English and with ES and KO drafts, and the flag-off bar is unchanged (section 10, assumption a); assumptions a and f name how 200 % is checked (on a device; the web e2e checks the default size, per locale for the tab labels), and the my-route e2e row adds the tab label fit and Continue above the tab bar (section 12); the console stage list's taste word and later-run words are named (section 11.1).

**2026-10-12, LR-4 review pass** (#428, two reviews; follow-up PR `fix/lr-4-review`). **Applied:** section 5.1 says `navigate`, not `replace`, for an old learner call to the root-stack screen (the code and its screen-source test already did); the LR-10 row names the flag-on `route-tab.spec.ts` run as a precondition of R-10's flip, and adds the grown-up dashboard path and the level-check link to its flag-on block; the mounted Route tab treats every focus as a fresh open: the seen read waits for the previous focus's write (`seenReadAfter`), what is new is measured against this open's record only and only while the tab is in front (`seenForView`), the one-time fill restarts on each open, and screen-reader focus lands on the hero sentence on every focus (section 10); F-ROUTE-001's R-10 row lists `a11y.tabPosition` and `a11y.tabs.route` among the es and ko values before the flip. **Not applied:** a CI leg that builds with the flag on (it edits `.github/workflows`, which this row does not need; the LR-10 precondition covers the flip) and render tests with `@testing-library/react-native` (the mobile vitest lane has no renderer; the per-focus decisions are pure helpers with unit tests).

**2026-10-13, LR-5c and LR-10 review pass** (#509, #526, two reviews each). **Applied (LR-5c):** the first reached visit's Hoya line ("You reached your goal. Hoya is proud!") comes before the rest, beyond and free-end lines on the learner card, so the visit that uses up the moment always shows it (section 4.3); the goal key is recorded once per focus and goal (`goalRecordFor`), also when the goal is reached while the tab is in front (a read, add and write of the stored record after the focus's own write); `route_map.goal_reached` is sent only after the write succeeds, so a failing store never sends it twice. **Applied (LR-10):** the 320 x 568 Continue check measures the overlap with every setup step asserted, instead of a `test.fail` mark that any setup failure would also satisfy; assumption h has its own case on the gating fixture bundle (a free learner: "Not open yet" and "Coming later" told apart by their words and the legend at 320 x 568); the web stage list asserts the updated line, the goal and plan-goal tags, the started-here tag and no line for an empty stage, and the switched-off case asserts the space page it returns to; route-tab case (a) waits for the page to settle instead of a fixed sleep, and case (b) finds each tab label by its words. **Finding recorded:** at 320 x 568 Continue (or Start) ends about 75 px under the tab bar now that Stage 1 has 15 quests; new row LR-11, issue #530, a precondition of R-10's flip. **5-second check (LR-OD-3, assumption g):** run by the LR-10 author on `route-first-*.png` and `journey-first-*.png`: pass for keeping both tabs (Route: title, purpose line, one card with the goal and one Next; Journey: its purpose line and the theme grid; neither uses the other's word for itself). The author knows the app, so LR-11 runs it again on the new 320 screenshots with a reviewer who has not seen the app. **Deferred to R-10 (not run in LR-10):** the native 200 % text checks of assumptions a and f (four tab labels at 320 dp; each of the three tags on its own row, nothing cut off) need a flag-on device or simulator build; the web build's px text does not follow the text size. R-10's row lists them as flip preconditions. **Not applied:** a render-level test of the screen's write and event (the mobile vitest lane has no renderer, as in the LR-4 pass; the decisions are pure helpers with unit tests, and the screen wiring keeps its source check); a per-locale longest-title fit check (en only until R-10 ships es and ko; the test says so).

**2026-10-13, LR-11** (#570, issue #530, two reviews). **Layout:** below 360 the learner card with a button leaves the can-do lines to the trail's stage rows (section 4.3, "Narrow width"), takes `spacing.sm` between its parts and `spacing.md` above the button, and its goal pips reserve the marker bands per line (`PipRow bandsPerLine`). At 320 x 568 on the flag-on web build, Continue with the longest Stage 1 title as Next ends 41 px above the tab bar (was 74 px under) and a new learner's Start 27 px above (was 78 px under); `my-route.spec.ts` asserts both with `toBeLessThanOrEqual(0)`. These two cases run only on a flag-on build until R-10b, whose row now requires them in its flag-on CI run. **5-second check (LR-OD-3, assumption g), run again:** the reviewer was a fresh agent session that had not seen the app or the work, given only the three 320 screenshots `app-route-first-320.png` (A, a new learner's Route tab), `app-route-class-plan-first-320.png` (B, a class-plan learner with the longest Stage 1 title) and `app-journey-first-320.png` (C, the Journey tab), and asked what each screen is for, what the one action is and whether it is fully visible, where the learner is and is heading, whether the tabs differ in purpose, and what confuses. Per question: purpose of the Route tab, pass (A "a personalized learning path ... shows where you are and what to study next", B "the same ... for someone already partway in"); the one action, pass (Start and Continue "fully visible, above the tab bar", each naming the next lesson); Route and Journey told apart by purpose (assumption g's criterion), pass (A/B "a focused 'do the next thing' screen", C "a browse-everything grid ... browsable by stage and theme"). **The reviewer's overall verdict was "FAIL on differentiation", because of the names, not the layout:** the tab label "Route", the page title "Learning Route", the Journey page's "See Learning Route" button and the Journey title "Heritage Journey" "cross-reference each other enough that a newcomer could blur the two"; it asks for "one concept = one word". Other notes: in B the weekly plan line sits half under the tab bar (it is the next block and scrolls into view; nothing on the card is cut off); the pips' meaning is not obvious at a glance (the card's label and the trail legend explain them); Hoya sits in different places in A and B (both follow LR-D). **Reading:** LR-11's layout goal and assumption g's purpose criterion pass, so the naming verdict does not block LR-11. It is not resolved either: it is an **owner input to LR-OD-1** (the "Route" tab label against "Learning Route") **and LR-OD-3** (alternative (b), relabel Journey), to be answered or knowingly kept at their defaults before R-10b flips the flag; R-10b's row in F-ROUTE-001 names it. **Review fixes applied:** this section 4.3 exception and this entry (the narrowing contradicted the case table without an amendment, and the check's result was only in the PR body); the read-only card keeps its can-do lines; the "label still reads them" wording (the label never did) corrected in code, tests and `route-card.md`; `PipRowFitted`'s measuring path has its own unit test; the 360-and-up wording says the wrapped pip line pitch changes there too; the e2e measures after `document.fonts.ready`. **Not applied:** an estimated first-pass width for the measured pip row (the unmeasured pass is the LR-D row, up to 24 px taller for one layout pass before any input; an estimate would copy the screen and card paddings into the row); a separate A2 narrow case (the narrowing depends only on the width and the button, both pinned by `routeCardLook`'s unit tests; opening a stage row is covered by the trail's tests); explicit per-line svg heights in the mock (its route card has no start pin; the app's rule is `pipRowLines`, noted in the CSS).

**2026-10-13, R-10b, the beta flip** (F-ROUTE-001 R-10b, #583; after LR-11 #570 merged). **Flag:** `flags.myRouteEnabled` defaults on; `EXPO_PUBLIC_MY_ROUTE_ENABLED=false` switches it off in a build. **CI:** the `E2E_MY_ROUTE` gates and the `flagOnOnly` exemption are gone, so `route-tab.spec.ts` and `my-route.spec.ts` run on the release build in every PWA e2e run, LR-11's two overlap cases included; route-tab case (b) is its own describe ("the level check entry") in the fixture run; my-route's assumption h case runs in the gating run; the expected gated list names `my-route.spec.ts`. The tripwire in `scripts/__tests__/ci-workflows.test.mjs` now fails if any spec gates a block on `E2E_MY_ROUTE` again while the flag defaults on. The flag-off three-tab case left `route-tab.spec.ts` (no CI build can play it; `mainTabs(false)` is unit-tested), and the browse and tablet layout specs now expect the Route section and the Route tab. **The report's glance link:** the flip also turns on the in-app report's Open Learning Route button (L1, `learningRoute: flags.myRouteEnabled` in `LearnerReportScreen`), which opens the grown-up's read-only page of that profile (`navigate('MyRoute', { profileId, viewer: 'grownup' })`) behind the grown-up gate; `learner-report.spec.ts` plays it (the read-only page, no purpose line, no button on the card, Go back returns to the report). **Native 200 % checks (assumptions a and f):** a flag-on Release build made with xcodebuild (not EAS) on the iOS Simulator, iPhone SE (3rd generation), 375 x 667 pt, a learner with Letters q1 done and a Stage 1 start (the LR-10 seed), driven by a temporary XCUITest target that is not committed. The iOS 26.5 runtime offers no 320 pt device (`simctl` refuses the iPhone SE 1st generation and iPod touch types on it), so the check ran at two text sizes: Accessibility Large (React Native font scale 2.14) and Accessibility Extra Large (2.64; 375 / 2.64 = 142 pt per unit of text, narrower than 320 / 2 = 160, so stricter than 320 at 200 % for uncapped text, which is what f measures). **a, pass, in two parts:** the tab label is capped (`FOUR_TAB_LABEL_FIT`: 1.3 x caption, one line, shrink to fit no lower than 1.0 x), so from a font scale of 1.3 up the label is the same size and only the item width matters; the 375 run is therefore not stricter for a. (1) On the simulator, at both sizes, the four labels Today, Route, Journey and Library are each on one line at the cap inside their 94 pt items, nothing cut off. (2) The 320 case, 80 px items: `route-tab.spec.ts` ("at the native label cap", in every PWA e2e run) sets each label of the web build at 320 x 568 to 1.3 x its caption size and checks each still fits its item on one line with nothing cut off, so the native shrink to fit is never needed and no label can drop below 1.0 x (shot `web-tab-bar-320-cap-en.png`). The web font is not San Francisco, so (2) is a width proxy, not a native measurement; a native 320 pt run is left to the first device test pass on an iPhone SE (1st generation) or a 320 dp Android phone, tracked in issue #587 (before the first native release of this flip). The web check also asserts each label is one line box (its text has one client rect row), not only that it does not overflow sideways. **f, pass:** at both sizes each tag takes its own row in the order here, goal, start; at 2.64 "You started here" wraps inside its own chip; nothing is cut off and nothing scrolls sideways. The stage row reads the three tags in its one label. At these sizes Continue is below the first screen, as expected (G2 is measured at the default size). Shots: `design/screens/learning-route/shots/native-ios-*.png`. **Locales:** the flip is `en` only. es and ko are `hidden` (`LOCALE_STATUS`), so no learner can pick them; their `learner` and `a11y` ledger entries stay "English changed since the review" and are re-signed when those locales are reviewed for shipping (F-I18N-001 section 3.10). **Naming (LR-OD-1, LR-OD-3): answered by the owner on 2026-10-13** (relayed in #583's thread), after reading the LR-11 5-second check's naming verdict ("FAIL on differentiation"). **LR-OD-1:** keep the tab label "Route" for the page "Learning Route". **LR-OD-3:** keep default (a), both tabs, each with its purpose line: Route "Where you are and where you are going." (`learner.myRoute.purpose`, under the title in `MyRouteScreen`) and Journey "Every lesson, by stage and theme." (`learner.journey.intro`, under the title in `JourneyScreen`), both with es and ko values. The owner knowingly keeps both defaults, so no Journey relabel lands before this flip; the reviewer's "one concept = one word" note stays open for a later naming pass. **Rollback:** the flag is read at build time, so switching it off is a PWA rebuild and redeploy with `EXPO_PUBLIC_MY_ROUTE_ENABLED=false` (installed clients pick it up at their next service worker update) and a new app release on native. No CI job builds that flag-off bundle; its three-tab bar, Home progress bar and Journey stage line are unit-tested (`mainTabs`, `journeyStageLine`) but not played end to end, so the kill switch build needs one manual pass before it is shipped: the build command and the three checks are in `docs/launch/owner-runbook.md` ("Learning Route kill switch" under the troubleshooting list). **Native release build:** Xcode 26 rejects expo-localization 16.0.1; the simulator build above was made with a local patch that is not committed, so a native release of this flip waits for that upgrade (issue #263).
