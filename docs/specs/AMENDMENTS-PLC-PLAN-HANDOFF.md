Status: ready (applied by F-ROUTE-001 R-0, which is also F-PLC-001 P-0b and F-PLAN-002 P2-0)

> **Applied 2026-10-11 in the R-0 docs PR.** Every AM-n item is now in the text of `F-PLC-001-placement-test.md` and every FP-Bn item in `F-PLAN-002-curriculum-planner.md` (each marked with its id); errata E-1 to E-5 are applied there and in `F-SPACE-002-class-transfer.md` (E-1). The line numbers below are those of `27c771c`, before the edits. This file stays as the record of the rationale, the length rule (section 1), the gap list (section 4) and the errata, which the specs cite. The E-1 uniqueness check landed in R-0 itself (`scripts/check-migrations.mjs`, run by `pnpm run test:scripts`).

# Amendments to F-PLC-001 and F-PLAN-002: a recommended weekly plan right after the level check

Basis: `origin/main` `27c771c`. `docs/specs/F-PLC-001-placement-test.md` and `docs/specs/F-PLAN-002-curriculum-planner.md` are unchanged since PR #112 (`git diff 33fe533 27c771c` on both is empty), so every line number below is valid at `27c771c`. Companion spec: `F-ROUTE-001-my-route-overview.md`. Wireframes: `wireframes/my-route-overview.md`, screens J and K. Review: `reviews/REVIEW-JOURNEY-OVERVIEW.md`.

**Owner decision 2026-10-10 (binding):** the service focuses on reading, listening and writing. These amendments add no speaking text to any screen; the gap list has no speaking row. The plan for speaking is `docs/roadmap/speaking-later.md` (F-ROUTE-001 section 10).

**Ids.** `AM-n` amends F-PLC-001, `FP-Bn` amends F-PLAN-002, `E-n` are errata, `G-n` are gaps. **Owner decisions** use the single table of F-ROUTE-001 section 9 (`OD-n`); this file only points to them.

**True status of the affected PRs** (from `git log` and `git worktree list`): F-PLC-001 P-1, P-2, P-3 (#168) merged; P-4 in flight (worktree `plc-p4`, branch `content/placement-bank`); P-5 to P-10 not started. F-PLAN-002 P2-1 and P2-2 (#175) merged; P2-3 to P2-8 not started. These amendments change **no merged code** and **no in-flight PR**, with one exception: if the owner picks option (b) of OD-1, P-4's bank and the merged `assessment/select.ts` / `placement/rungs.ts` need an amendment PR (about 1 M PR); the default (c) does not.

**Learner naming (OD-7, default).** In learner copy the dated schedule is the **weekly plan** ("Hoya made a weekly plan for you", "Use this plan", "Open plan"); "My route" is F-ROUTE-001's map of progress. Grown-up and console copy may say "route plan" after introducing "weekly plan". Code names do not change (`proposeRoute`, `route-store`, `screens/route/`).

## 0. What the product does after these amendments

Today the specs stop at the result screen: Start / See the whole map / For grown-ups (F-PLC-001 line 63). The plan wizard is a separate flag-gated entry the learner must find (F-PLAN-002 line 276), its Home card needs one finished quest (line 276), and the length is never pre-selected or tied to the level (lines 77-84).

After these amendments:

1. **One pure function, `proposeRoute`**, turns (level check result, audience, D1 reading level, chosen pace, tier, catalogue) into a **recommended weekly plan**: start, pace, three length options with an honest preview each, one pre-selected. The console wizard and the app call the same function.
2. **Without a level check**, a learner can accept the default plan (stage1 band 0) with one tap from the Home prompt or Profile ("Make a weekly plan"). This ships first (F-PLAN-002 P2-7a).
3. **Right after the level check** a self profile sees "Hoya made a weekly plan for you": length and pace in words, three pace chips, **Use this plan**, **Change**, or **Just start**. A child's grown-up sees the same proposal behind the gate.
4. **A retake re-proposes without moving the start back** (unless a grown-up override did).
5. **Honest result copy when reading was not tested** (OD-1, AM-14).

**Why OD-1 decides the value of all this (data).** With the sound guide visible, every placement template marked `leaks` is unusable (`packages/content-schema/src/placement/run.ts:95`), so decoding is never asked and the run lands at `stage1` band 0 by construction. The merged simulations cover only `revealMode: 'tap'` (`packages/content-schema/src/__tests__/placement-simulated.test.ts:66`), so the share of real learners affected is unmeasured; open item for R-0: add an `always` row to the simulations and report "N of 1,000 runs get band 0" next to OD-1. (Not done in R-0, which is docs-only: it is a test change in `packages/content-schema`; carried to the next placement engine or bank PR, before OD-1 is answered.)

## 1. Default length and pace (OD-12, OD-13)

**Decided by the owner 2026-10-12:** OD-12 (the length rule with the 4 and 16 week thresholds) and OD-13 (the three pace chips Gentle 2 / Steady 3 / Brisk 4, default Gentle for "Pictures first" and for classes, Steady otherwise, and the Hoya check-in after week 4) are accepted as proposed. This section is the rule; P2-3b, P2-6b and P2-7b no longer wait for an owner answer.

### 1.1 The rule (constants in `curriculum/presets.ts`, one test each)

```
pace     = one of three chips, pre-selected (OD-13):
             Gentle  2 days a week   default for D1 "Pictures first" (levelOrder 0) and for classes
             Steady  3 days a week   default otherwise (self and family)
             Brisk   4 days a week   only when the learner or grown-up picks it
minutes  = F-PLAN-002 section 3.1 defaults (10 for levelOrder 0, else 15; class 15, 10 when most of the roster is levelOrder 0)
probe    = generateCurriculum({ ...params, weeks: 52 }, catalog)
lastLessonWeek = week of the last scheduled lesson quest in the probe (0 when none)
defaultId =  '4-week'   when lastLessonWeek <= DEFAULT_SHORT_MAX (4)
             '12-week'  when lastLessonWeek <= DEFAULT_TERM_MAX (16)
             '6-month'  otherwise
```

The length follows **what there is to teach** at the chosen pace. A plan is never padded with free practice by default. Stories fill empty slots only **when reviewed stories are bundled**; on today's bundle (no story, `apps/mobile/src/content/stories.generated.ts:4-8`) the slots after the last lesson are free practice, and the preview says so (`content-runs-out`).

### 1.2 Resulting defaults (pinned by the P2-3b golden test `packages/content-schema/src/__tests__/curriculum-propose.test.ts`, which is authoritative; this table follows it)

Column A: **after F-QUEST-002 Q-8 and reviewed stories** (frozen `packages/content-schema/src/__tests__/fixtures/catalog-2026-10.ts`: 15 Stage 1 quests, 24 stories ready, free tier = Stage 1). Column B: **the bundle shipped when this was written** (frozen `packages/content-schema/src/__tests__/fixtures/catalog-2026-10-bundle8.ts`, the `catalog/data.ts` of #175: 8 Stage 1 lessons with empty `teaches`; no story ready). `LLW` = last lesson week of the 52-week probe. Self learner, free tier = Stage 1 unless noted, start Monday 2026-10-12. P2-3b corrected the hand estimates of band 1 Brisk, band 2 Gentle and Steady and the all-stages Gentle note. The live `catalog/data.ts` (since Q-8: 15 Stage 1 lessons, no story reviewed yet) is checked against the rule in the same test, not pinned, so content PRs never touch it.

| Start | Pace | A: after Q-8 + stories | B: 8-lesson bundle |
|---|---|---|---|
| no check, or `stage1` band 0 | Gentle 2 | **12 weeks** (LLW 11) | **12 weeks** (LLW 5: weeks 1-3, review week 4, week 5) |
| | Steady 3 | **12 weeks** (LLW 7) | **4 weeks** (LLW 3) |
| | Brisk 4 | **12 weeks** (LLW 6) | **4 weeks** (LLW 2) |
| `stage1` band 1 | Gentle / Steady / Brisk | 12 / 12 / 4 (LLW 9 / 6 / 3) | same as band 0 (nothing is placed out while `teaches` is empty) |
| `stage1` band 2 | Gentle / Steady / Brisk | 12 / 4 / 4 (LLW 6 / 3 / 3) | same as band 0 |
| `stage1` band 3 | Gentle / Steady / Brisk | 4 / 4 / 4 (LLW 3 / 2 / 2) | same as band 0 |
| `stage2` band 0 or higher, free tier | any | **4 weeks**, stories and word topics | **no proposal** (`proposeRoute` returns `null`: no lesson, no story) |
| all stages unlocked (a licence), band 0 | Gentle / Steady / Brisk | 12 / 12 / 12 (LLW 13 / 9 / 6; at Gentle the 12-week card still holds every lesson, the last in week 12, because its final week is never a review) | 12 / 12 / 4 (LLW 7 / 5 / 3) |

The 4-week default is not a ceiling: all three lengths are shown, **Choose weeks** allows 1 to 52, and "Add N weeks" extends later (F-PLAN-002 section 3.7).

### 1.3 Options and their previews (all three, in this order)

`options = [4-week, 12-week, 6-month]`, each a `generateCurriculum` draft; each card shows one sentence built from the draft's stats (codes in the draft, words in the messages):

- `lessons-and-stories` {endsAtStage, lastLessonWeek}: "Stage 1 is done around week 7, then heritage stories." (a projection, never a deadline). Used only when `lastLessonWeek <= weeks` and stories are bundled.
- `lessons-cut-short` {lastLessonWeek, weeks}: "The first part of Stage 1 fits in 4 weeks; more weeks finish it." Used when `lastLessonWeek > weeks`.
- `lessons-then-free-practice` {contentWeeks}: "About 3 weeks of lessons are ready now. The rest is free practice." (honest preview, Example B style).
- `stories-and-words` {stories}: a start with no lessons left.
- Test: no card claims a stage finishes when the draft's `endsAtStage` is earlier than that stage or `lastLessonWeek > weeks`.
- Learner screens summarise locked and unreleased parts only as "More lessons are coming."; grown-up screens and the console use the warnings of section 3.3 in plain words, never a price or plan name.

### 1.4 Start day

`Today` (default, OD-15), `Tomorrow`, `Pick a day`; weekdays from `spreadDates` unless the learner opens **Change days and time**. Class: the next class day. Never a start before today.

### 1.5 Why

- 12 weeks is one school term and holds a full Stage 1 at any pace once Q-8 ships.
- On today's 8-lesson bundle, a 12-week default at Steady or Brisk would be mostly empty weeks, so the honest default is 4 weeks; it grows by itself when lessons ship (`lastLessonWeek` rises), with no spec change.
- The pace is the learner's (three chips, one tap to change), not the audience's; the D1 level only pre-selects Gentle for "Pictures first". **Hoya check-in (OD-13, P2-7b):** after week 4 the weekly plan offers, once and positively, "Want a lighter week?" or "Want to go a bit faster?" from the sessions actually finished; it never names a missed session.

## 2. Amendments to F-PLC-001

### AM-1. Section 3.1 step 7 (Result), line 63, the button sentences

REPLACE:

> Primary button: **Start** (resets the stack to Main plus `QuestPlayer` on the start quest, the pattern of `FirstQuestPreviewScreen.tsx:30-41`); secondary **See the whole map** (Journey); text link **For grown-ups** (PIN gate -> `parent/placement-report`).

WITH:

> **Weekly plan strip.** Shown when `flags.routeEnabled`, `proposeRoute` (F-PLAN-002 section 3.1a) returns a proposal, the plan prompt is not dismissed (AM-6), and the profile is a **self** profile (`effectiveLearnerType(profile) === 'self'`, `apps/mobile/src/logic/profiles/learner-type.ts:20`). Visibility does **not** use `gateRequired`, which is device-level (`learner-type.ts:52-57`: true with a PIN or any child on the device); `gateRequired` only decides whether a grown-up destination needs the PIN.
>
> | | device without a PIN, self-only | device with a PIN, or with a child profile |
> |---|---|---|
> | self profile | strip; **Use this plan** with one tap | strip; **Use this plan** with one tap, no PIN (it is the learner's own plan; OD-14) |
> | child profile | cannot occur (a child makes the device "family") | no strip; the link reads **For grown-ups: set up a weekly plan** and the grown-up finds the proposal first on the report (AM-5) |
>
> The strip: "Hoya made a weekly plan for you", the length and pace in words ("4 weeks, 3 days a week, about 15 minutes a day"), three pace chips (Gentle 2 / Steady 3 / Brisk 4, one pre-selected, section 1.1), the primary **Use this plan** (creates the plan with exactly what is shown, derives its first week, fires `route.created`, then opens the start quest, or the first plan item when `startQuestId` is `null`) and a ghost **Change** (opens `RouteProposal`). Below the strip: secondary **Just start** (resets the stack to Main plus `QuestPlayer` on the start quest, the pattern of `FirstQuestPreviewScreen.tsx:30-41`; records `route.proposal_skipped` and dismisses the prompt, AM-6), then the text links **See my route** (F-ROUTE-001 `MyRoute`; **See the whole map** while `flags.myRouteEnabled` is off) and **For grown-ups**. Four actions in all; **Use this plan** is the only primary.
>
> **Without the strip** (flag off, child profile, dismissed, or `proposeRoute` returns `null`): primary **Start**, links **See my route** (or **See the whole map**) and **For grown-ups**.

### AM-2. Section 3.1 step 7, line 63, after "If a retake does not change the route: "Your route stays right where it is.""

APPEND:

> If a retake raises the starting spot and the profile has an active self plan, the strip is replaced by "Hoya found a later place to start." / "Your weekly plan can move ahead and keep the same end date." with **Update my plan** (applies `proposeRoute` with `existing`: the future skips what is now known, length and end date kept, past days keep their items) and the ghost **Keep my plan**. For a retake that changes nothing the learner line becomes "Your plan stays right where it is." A **retake** never moves the start earlier: the level only rises (`higher()`, `placement/route-seed.ts:145-146`) and results only add placed-out ids. A **grown-up override** may move it earlier: it removes ids from the placed-out set (`route-seed.ts:169-178`); the put-back quests then return to the plan's future queue.

### AM-3. Section 3.7, consumer 4 (Home), line 296

REPLACE: "The progress bar "Stage 1 progress" (`HomeScreen.tsx:207-209`, total = every quest, `:103`) is out of scope (a pre-existing mismatch noted in REVIEW-1 section 9); only the **level check card** is added (section 3.10)."

WITH:

> The progress bar "Stage 1 progress" (`HomeScreen.tsx:199-202`, total = every quest, `:108`) is **owned by F-ROUTE-001 (R-4b)**, which replaces it with the My route strip; this spec adds the **level check card** (section 3.10). Home's order is F-ROUTE-001 section 6.4.

### AM-4. Section 3.7, consumer 6 (Plans and curriculum), line 298

REPLACE the bullet WITH:

> *Plans and curriculum.* `proposeRoute` (F-PLAN-002 section 3.1a) reads the effective seed (`effectiveRoute`, never a raw newest result, called with the learner's real completions so the plan starts at the first quest still to play) and returns the recommended plan: `level = seed.level`, `placedOutQuestIds = seed.placedOutQuestIds`, `goals.themes = seed.themeOrder`, `goals.motivation` from "Why Korean?", `goals.focus` = `reading` when `oralStage` is two or more stages above `level.stage`, else `balanced`. (F-ROUTE-001's start marker calls `effectiveRoute` with **no** completions, so its "You started here" stays fixed; the two calls differ on purpose.) The result strip, the report card, the Home prompt and the console wizard show these as changeable pre-selections; `questsPlacedOutAtLevel` is the coarse mapping when only a level is known (the console).

### AM-5. Section 3.9, Parent dashboard (report) bullets

INSERT after the "recommended start" bullet (line 351):

> - a **Suggested weekly plan** card at the top (when `flags.routeEnabled`): "Suggested weekly plan for Sam", the basis in words ("Stage 1 · Letters and sounds, 2 days a week, 10 minutes"), the pace chips and the three lengths with the recommended one selected, the grown-up warnings in plain words (no price, no plan name, no purchase button), **Use this plan** (the grown-up is through the gate), **Change**, **Not now**. After a retake that raised the start: "Sam's newest check found a later place to start" with **Update the plan**.

INSERT after the "what was **not** tested and why" bullet (line 350):

> - the skills note, message key `caregiver.skillsNote` (one string everywhere, F-ROUTE-001 section 3.12): "The level check looks at reading and listening. Writing is practiced with tracing games and is not scored. The rows count finished quests that include these games; a game skipped inside a quest still counts."

### AM-6. Section 3.10, Home card (line 362), "**Order with sibling Home blocks:** ..."

REPLACE from "then at most **one** quiet card" to the end WITH:

> then at most **one** quiet card from {this level-check card, F-PLAN-002's weekly-plan prompt}, the level-check card winning while eligible (it disappears after three quests, a result or "Not now"). The plan prompt ("Hoya can make a weekly plan for you", **Make my plan**, **Not now**) is eligible when `flags.routeEnabled`, no active plan, at least one finished quest **or** a placement result, and the prompt is not dismissed. **Dismissal:** "Not now" on the prompt, "Not now" on the proposal screen, or "Just start" on the result sets `route-ui:<profileId>.dismissedAt`; the prompt and the result strip stay hidden until the next placement result or 14 days later, whichever comes first (OD-16). Profile's **Make a weekly plan** row is always available. One skip label, **Not now**, on every surface except the result screen's **Just start** (which skips and plays). Then the My route strip, then Homework (F-ROUTE-001 section 6.4).

### AM-7. Section 3.14, add Given / When / Then rows

APPEND:

> - **Given** a self profile on a self-only device without a PIN and `flags.routeEnabled`, **when** the result appears, **then** the strip shows the recommended length and pace, **Use this plan** is the only primary, and one tap creates the plan and opens the start quest.
> - **Given** a self profile on a device with a PIN or a child profile, **then** the strip is shown and **Use this plan** needs no PIN.
> - **Given** a child profile, **then** no strip is shown, the primary is **Start**, the link reads **For grown-ups: set up a weekly plan**, and the proposal is the first card of the gated report.
> - **Given** a retake that finds nothing new, **then** no strip and "Your plan stays right where it is." (learner) are shown.
> - **Given** a retake that raises the start and an active self plan, **when** the learner taps **Update my plan**, **then** future items skip the newly known quests, end date and length are unchanged, past items stay, and the start never moves earlier.
> - **Given** a grown-up override that puts quests back, **then** the plan's future queue regains them and `diff` reports items added.
> - **Given** the learner taps **Just start**, **then** no plan is created, `route.proposal_skipped` fires once, and the Home prompt stays hidden for 14 days or until the next result.
> - **Given** decoding strands `not-tested`, **then** the headline is "Here is a good place to start", the listening-and-shapes line and the one-tap retake are shown, and "Hoya found your starting spot!" is not.
> - **Given** a free-tier learner placed at Stage 2+ on today's bundle, **then** no strip is shown (nothing to schedule) and the existing "You know a lot!" screen is unchanged; no learner screen contains "Premium".

### AM-8. Section 4 (Out of scope), line 410

APPEND to the first bullet: "... and writing / tracing (gap list, section 4 of `AMENDMENTS-PLC-PLAN-HANDOFF.md`)." Add a bullet: "The length, pace and start day of a weekly plan are F-PLAN-002's `proposeRoute`; this spec only hosts the strip and the report card."

### AM-9. Section 5 (Tests), the `placement/result-view.ts` row (line 440)

APPEND: "strip visibility matrix (flag x learner type x device has PIN or child x proposal null x dismissed x retake unchanged / raised / override), primary-button identity per cell, the not-tested headline, copy scan of the strip strings (no `%`, no `x / y`, no Premium, no speaking words)".

### AM-10. Section 6 (PR breakdown), lines 463-465

ADD after P-8:

| P-7b | `feat(mobile)`: result weekly-plan strip and not-tested copy, `RouteProposal` entry from the result, report "Suggested weekly plan" card. **Done (#573)**, behind `flags.routeEnabled` | M | P-6, P-8, F-PLAN-002 P2-3b (`proposeRoute`) and P2-7a (`RouteProposal`) |

Change P-10's "Needs" to "P-7, P-7b, P-8" (OD-14 was decided on 2026-10-14, confirmed as proposed, and no longer gates P-10; P-10 still needs the store build listed in F-PLC-001's row). P-6 and P-7 do not wait. Add to P-6's Needs: "OD-1 (sound-guide choice screen)". Add to P-7's Needs: "F-ROUTE-001 R-2a (`pin`, `check-circle` glyphs)".

### AM-11. Section 9 (Unverified assumptions), after line 513

APPEND:

> 15. **Default plan length** — owner decision OD-12 in F-ROUTE-001 section 9, decided 2026-10-12 (accepted as proposed); the pace chips follow OD-13, decided the same day.
> 16. **One-tap plan for a self profile on any device** — OD-14, decided 2026-10-14 (confirmed as proposed).
> 17. **The level check and writing** — the report's skills note (AM-5); gap list in `AMENDMENTS-PLC-PLAN-HANDOFF.md` section 4.

### AM-12. Wireframe `placement.md` G (Result) and J (report)

Replace the button row of G with `wireframes/my-route-overview.md` J1 / J2 and add the "Suggested weekly plan" card to J (K2 there). Promoted files: `design/wireframes/placement/result.md`, `report.md`.

### AM-13. Section 3.7, consumers 1 (Home cursor) and 3 (Journey look), lines 295-297

- Consumer 1: REPLACE the mission-builder change with "P-5 passes `skipQuestIds = seed.placedOutQuestIds` to the shared cursor `nextQuestAfter` (F-ROUTE-001 R-4a adds the option); no second cursor function."
- Consumer 3: APPEND "`logic/placement/cell-look.ts` is a thin adapter over F-ROUTE-001's `pipStateOf` (`logic/my-route/pips.ts`), so 'placed out' has one definition. `GridCell` edits land in the order F-STORY-005 5.5a, P-7, F-QUEST-002 Q-9."

### AM-14. Section 3.1 step 7, the headline (OD-1, default (c))

APPEND: "The options screen asks first whether to show the sound guide, with no pre-selection (one more tap; D2 respected). When the decoding strands are `not-tested`, the result headline is **Here is a good place to start** (not "Hoya found your starting spot!"), followed by 'We checked listening and shapes. To find where to start reading, try the check with the sound guide hidden.' and a text button **Try it with the sound guide hidden** (one-tap retake). The weekly-plan strip, when shown, sits below that line. If the owner picks (b) instead, it is described as meeting the 12-question floor, not as a fix for the level."

## 3. Amendments to F-PLAN-002

### FP-B1. Header (lines 7, 10, 12)

- Line 7 Scope: add "new `src/curriculum/propose.ts` (`proposeRoute`)" and `screens/route/RouteProposalScreen.tsx`; **replace "migration `0004`" with "the next free migration number at the time the PR is opened"** (E-1).
- Line 10 Wireframes: add `route/proposal.md`.
- Line 12 siblings: add "F-ROUTE-001 (My route: the map of progress; shows the plan's week on its Home strip and page; owns the Home stack order)".

### FP-B2. Section 3.1 presets (lines 77-92)

REPLACE the sentence before the first table WITH:

> Presets and defaults (`curriculum/presets.ts`, exported constants, one test each). Length presets are **choices**; `generateCurriculum` pre-selects none. The **recommended** length comes from `proposeRoute` (section 3.1a): `DEFAULT_SHORT_MAX = 4`, `DEFAULT_TERM_MAX = 16`. **Pace presets** `PACES = { gentle: 2, steady: 3, brisk: 4 }` sessions a week; the default pace is `gentle` for levelOrder 0 and for classes, `steady` otherwise (OD-13). The audience rhythm row of the defaults table changes accordingly (self 4 -> steady 3).

### FP-B3. NEW section 3.1a `proposeRoute` (insert after line 92)

> ### 3.1a `proposeRoute` (`curriculum/propose.ts`, pure, 100 % covered)
>
> ```ts
> export interface ProposeInput {
>   audience: 'class' | 'family' | 'self';
>   seed: Pick<RouteSeed, 'level' | 'oralStage' | 'placedOutQuestIds' | 'themeOrder' | 'startQuestId'> | null;   // effectiveRoute with real completions; null = no level check (stage1 band 0)
>   motivation?: Motivation;
>   completedQuestIds: readonly string[];          // single learner; empty for a class
>   levelOrder: 0 | 1 | 2 | null;                  // D1: pre-selects the pace and minutes only
>   pace?: 'gentle' | 'steady' | 'brisk';          // the chip the learner picked; absent = the default
>   rosterLevelOrders?: readonly (0 | 1 | 2)[];
>   unlockedStages: readonly StageKey[];
>   catalog: Catalog; today: DateKey;            // today: the freeze point for an existing plan
>   startDate?: DateKey;                           // a new plan's first day, on or after today (class: the next class day, from the wizard); absent or earlier = today
>   existing?: { meta: CurriculumMeta; items: PlanItem[] } | null;
> }
> export type DurationId = '4-week' | '12-week' | '6-month';
> export interface DurationOption { id: DurationId; weeks: 4 | 12 | 26; stats: Pick<CurriculumDraft['stats'], 'lessons' | 'stories' | 'comingSoonItems' | 'openSessions' | 'endsAtStage'>; lastLessonWeek: number; lastContentWeek: number; preview: 'lessons-and-stories' | 'lessons-cut-short' | 'lessons-then-free-practice' | 'stories-and-words'; warnings: WarningCode[] }
> export interface RouteProposal {
>   kind: 'new' | 'update' | 'unchanged';
>   headline: 'start-stage1' | 'continue-stage1' | 'continue-lessons' | 'stories-and-words' | 'beyond-content';
>   pace: 'gentle' | 'steady' | 'brisk' | null;   // the chip of `params`; null when an existing plan's sessions a week match no chip
>   params: CurriculumParams;
>   options: readonly [DurationOption, DurationOption, DurationOption];
>   defaultId: DurationId;
>   diff?: { itemsRemoved: number; itemsAdded: number; newStartQuestId: string | null };   // 'update' only
> }
> export function proposeRoute(input: ProposeInput): RouteProposal | null;   // null = no plan yet and nothing ready to schedule
> ```
>
> Rules: (1) `params`: the pace's sessions a week, the minutes of section 3.1, `level`, `placedOutQuestIds`, `goals` from the seed (`focus` = `reading` when `oralStage` is two or more stages above `level.stage`, else `balanced`, F-PLC-001 AM-4), `startDate` from the input when it is after `today`, else `today` (class: the wizard passes the next class day), no `sessionDays`. (2) `defaultId` by the rule of the amendments file section 1.1 from a 52-week probe (fewer weeks only when an existing plan's six or seven sessions a week would pass `CURRICULUM_MAX_ITEMS`). (3) `options` are three real drafts; each `preview` code follows section 1.3 of the amendments file. (4) With `existing`: `unchanged` when the seed moves neither the stored level (it never goes lower) nor the stored placed-out set, or when `regenerateFrom(..., { mode: 'reseed', paramsPatch, completedQuestIds })` yields the same future items as `regenerateFrom(..., { mode: 'shift', completedQuestIds })` (so a plan extended by weeks, a grown-up's hand edits or new catalogue lessons never read as a new start), else `update` with the length and end date of `existing`; `diff` and `newStartQuestId` leave the learner's finished quests out. `params` is the re-seed on `update` and the stored plan re-paced by `shift` on `unchanged` (never a re-seed it did not take), with the learner's completions. The cards, the probe and `defaultId` are drafted from those `params` starting `today`, at the plan's own sessions a week, minutes, goals and `unlockedStages`; the headline names the first lesson of the future those `params` keep; `pace` is the chip of their sessions a week, `null` off the chips. The input's `pace`, `levelOrder`, `rosterLevelOrders`, `motivation`, `startDate` and `unlockedStages` do not reach an existing plan: an entitlement change is not a new start (the patch has no `unlockedStages`, FP-B4). The function throws a ZodError when its input breaks a params cap (over 400 completions, over 120 placed-out quests). The re-seed's `paramsPatch` carries `level` and `placedOutQuestIds` only: the stored `goals` stay (a re-seed moves the start; a grown-up's themes, focus and motivation change in the wizard or the plan setup, never silently on a retake). **Without an override** the level never decreases and `placedOutQuestIds` is a superset; **with an override** the placed-out set may shrink, the put-back quests go into the future queue, and `diff.itemsAdded` counts them. (5) `null` when no plan exists and the draft schedules no ready item; with `existing` it is always `update` or `unchanged`, and a re-seed whose future holds no lesson or story is `unchanged` (no update empties a plan). Headline: `start-stage1` / `continue-stage1` when the first lesson is the opening or a later Stage 1 lesson, `continue-lessons` when it belongs to a later stage, and with no lesson `stories-and-words` (a level below Stage 3) or `beyond-content` (Stage 3 or higher). (6) No clock, no randomness, no locale.

### FP-B4. Section 3.3, `regenerateFrom` (line 124 signature, after line 169)

- Line 124: `opts: { mode: 'shift' | 'requeue' | 'reseed'; completedQuestIds?: string[]; paramsPatch?: Partial<Pick<CurriculumParams, 'level' | 'placedOutQuestIds' | 'goals'>> }`.
- After line 169 INSERT: "`mode: 'reseed'` (after a retake or an override): `paramsPatch` replaces the stored `level` (never lower) and `placedOutQuestIds` (a superset, except after an override, which may remove ids); history before `today` is frozen; the future queue is rebuilt from the catalogue minus the done set, minus the patched placed-out set, minus every item dated before today; the end date is unchanged. A `reseed` with an empty patch equals `shift`."

### FP-B5. Section 3.8 console wizard (lines 262-263)

- Step 1: ADD "The wizard prefills start, themes, focus and motivation from `proposeRoute` using `levelFromSummary(summary)` (coarse mapping); for a family space the learner is picked first."
- Step 2: REPLACE "Chips *4 weeks*, *12 weeks*, *6 months*, *Choose weeks*;" WITH "Pace chips *Gentle*, *Steady*, *Brisk* and length chips *4 weeks*, *12 weeks*, *6 months*, *Choose weeks*, with the recommended ones pre-selected and tagged *Suggested*, and one honest preview line under each length;".
- Step 4: ADD "When a family-space learner has a newer `summary.placement` than the plan's level, the learner card shows 'Sam's newest check found a later place to start' with **Update the plan** (`reseed`, console mode). Class plans are not updated per learner."

### FP-B6. Section 3.9 in-app self plan (lines 276-278)

- Line 276 **Entry**: REPLACE the second entry WITH "the Home prompt **Hoya can make a weekly plan for you** (eligibility and dismissal: F-PLC-001 AM-6), Profile's **Make a weekly plan** row (always), the result-screen strip and the gated report card (AM-1, AM-5). `PinEntry.next` gains `'RouteProposal'` and `'RouteSetup'` (`apps/mobile/src/navigation/types.ts:5`)."
- Line 277 **Setup**: INSERT before "Setup (large-chip steps ...": "**Proposal.** `RouteProposal { source: 'placement' | 'home' | 'profile' | 'parent', profileId, mode?: 'new' | 'update' }` (`screens/route/RouteProposalScreen.tsx`, wireframe `route/proposal.md`) shows `proposeRoute`: the headline, the pace chips, three length cards (recommended pre-selected, tagged 'Hoya suggests', each with its preview line), the start day, a disclosure **Change days and time**, the first week as a short list, **Start this plan** and **Not now** (dismisses, AM-6). Learner screens never show `premium-needed`, a price or the word Premium. The four setup steps below remain for **Change the plan**, prefilled from the proposal."
- Line 277 Setup step 1: REPLACE "where to start (prefilled from the newest placement result, else *Brand new*)" WITH "where to start (prefilled from `effectiveRoute`, else *Brand new*; themes, focus and motivation prefilled too)".
- Line 278 **Home**: REPLACE the Home card description WITH "Before a plan exists the Home card is only the prompt (above). **Once a plan exists there is no separate Home plan card**: its week appears as one line in F-ROUTE-001's My route strip ('Week 3 of your weekly plan'), and the week dots of the former card are dropped (they fill with calendar time and reset weekly)."

### FP-B7. Section 3.11 telemetry (line 296)

APPEND: "`route.proposed` `{ source, kind: 'new' | 'update', defaultWeeks: 4 | 12 | 26, pace?: 'gentle' | 'steady' | 'brisk' }` (`pace` left out when the proposal's `pace` is null: an existing plan off the chips), `route.proposal_skipped` `{ source }` (Just start / Not now), `route.updated` `{ source: 'retake' | 'override', itemsRemoved, itemsAdded }`. `route.created` gains `from: 'proposal' | 'setup'` and `changed: boolean`. Codes and counts only." Added to `TELEMETRY_EVENT_NAMES` and its exact-list test in P2-4, deployed in the shared Worker deploy D2 (F-ROUTE-001 section 6.0).

### FP-B8. Section 3.12 behaviours, APPEND

> - **Given** `stage1` band 0 on the frozen fixture at Steady, **then** `12-week` is recommended; **given** band 3, **then** `4-week`; **given** band 0 on today's 8-lesson bundle at Steady, **then** `4-week` with preview `lessons-then-free-practice`.
> - **Given** a lesson count that makes `lastLessonWeek` 17 or more, **then** `6-month` is recommended without a code change.
> - **Given** a retake whose effective level is lower, **then** `kind: 'unchanged'`.
> - **Given** any sequence of placement results **without** an override, **then** `level` never decreases and `placedOutQuestIds` only grows; **with** an override, put-back quests reappear in the future queue (property test generates overrides).
> - **Given** the console wizard and the app for the same level, pace and tier, **then** `defaultId` and `options` are identical.
> - **Given** a 4-week card whose `lastLessonWeek` is greater than 4, **then** its preview is `lessons-cut-short`, never a finish claim.

### FP-B9. Section 4 (Out of scope), lines 315 and 318

- Line 315: REPLACE "the Journey "Your Route" ribbon" WITH "the Journey 'Your Route' ribbon (owned by F-ROUTE-001: the My route page and its Home strip)".
- Line 318: REPLACE "Fixing the Home "Stage 1 progress" bar label (REVIEW-1 section 9)." WITH "Fixing the Home 'Stage 1 progress' bar (F-ROUTE-001 R-4b)."

### FP-B10. Section 5 (Tests), APPEND rows

| `content-schema/src/__tests__/curriculum-propose.test.ts` | unit, 100 % | `defaultId` at the boundaries (LLW 4, 5, 16, 17); section 1.2 column A against `fixtures/catalog-2026-10.ts` and column B against `fixtures/catalog-2026-10-bundle8.ts`; `routeCatalogOf(CATALOG)` checked against the section 1.1 rule (not pinned); three real drafts; preview codes incl. `lessons-cut-short`; `existing` -> `update` / `unchanged`; override shrinks and `itemsAdded`; `null` when nothing is ready; determinism; a micro-benchmark gate on `proposeRoute` time (a new plan: four generator runs; an existing plan: six) |
| `mobile/src/logic/route/__tests__/proposal-flow.test.ts` | unit, 100 % | entry points; visibility by learner type (not device gate); dismissal for 14 days or until the next result; accept-unchanged vs changed telemetry |
| `web/src/lib/console/__tests__/curriculum.test.ts` (extend) | unit | the wizard preselects `proposeRoute`'s pace and length; same input as the app gives the same `defaultId` |
| `…/curriculum-copy.test.ts` (extend) | unit | proposal headline and preview strings in en / es / ko pass both banned lists, never Premium on a learner surface, no speaking words |

### FP-B11. Section 6 (PR breakdown), lines 358 and 362

- **P2-3 splits:** P2-3a `feat(content-schema)`: generator, presets incl. `PACES`, `toPlanItems`, the existing goldens (L). P2-3b `feat(content-schema)`: `propose.ts`, `regenerateFrom` `reseed`, the 1.2 goldens, the benchmark gate (M; needs P2-3a; OD-12 / OD-13 decided 2026-10-12).
- P2-6: append "wizard pre-selects pace and length with a *Suggested* tag; family learner card 'Update the plan'".
- **P2-7 splits:** P2-7a `feat(mobile)`: `route-store`, `RouteProposalScreen`, Home prompt with eligibility and dismissal, Profile row, flag (M-L; needs P2-5, P2-3b). P2-7b `feat(mobile)`: setup steps, preview, overview, auto re-pace, Hoya check-in (M; needs P2-7a). **P2-7a lands before F-PLC-001 P-7b**, so the one-tap default plan exists for learners without a level check first.

### FP-B12. Section 9 (Unverified assumptions), APPEND

> 11. **Default length rule and pace chips** — owner decisions OD-12 and OD-13 (F-ROUTE-001 section 9), decided 2026-10-12 (accepted as proposed); the 1.2 table is hand-estimated and pinned by the P2-3b goldens.
> 12. **One-tap plan for a self profile on any device** — OD-14, decided 2026-10-14 (confirmed as proposed).

### FP-B13. Wireframe `curriculum-planner.md` (promoted to `console/curriculum-wizard.md`, `route/setup.md`)

Add the pace chips, the *Suggested* tags and the preview line per length. Screen H's Home card becomes the prompt only ('Hoya can make a weekly plan for you'); the in-plan Home card with week dots is removed (FP-B6).

### FP-B14. Section 3.7 re-pace, APPEND

> **Hoya check-in** (P2-7b, OD-13, decided 2026-10-12): once, at the start of week 5 of an active self plan, a positive card offers a pace change computed from sessions actually finished in weeks 1-4: fewer than half -> "Want a lighter week?" (Gentle); every session -> "Want to go a bit faster?" (one step up). It never names a missed or late session, can be closed with **Not now**, and applies through `regenerateFrom(..., 'shift')` with the new sessions a week.

### FP-B15. Learner strings (all sections)

In learner-facing strings of sections 3.9 to 3.12 and the wireframes, "route" becomes "weekly plan" / "plan" (OD-7): "Set up my route" -> "Make my plan", "Your route starts on ..." -> "Your weekly plan starts on ...", "Open route" -> "Open plan", "This week on your route" -> removed (FP-B6). Grown-up and console strings may keep "route plan" after introducing "weekly plan". Code identifiers are unchanged.

## 4. Gap list: what the level check and the app cannot see, and what to do

| # | Gap (verified) | Effect on the proposal | What the app does now | Later |
|---|---|---|---|---|
| G1 | The check measures reading (decoding) and listening only (F-PLC-001 line 410). | The proposal is a reading plan. | The report's skills note (AM-5); F-ROUTE-001 shows an inventory of finished quests, never a level. | A per-skill tally in a later `F-SKILL-001`. |
| G2 | No per-skill result is stored: one pooled `stars` / `accuracy` per quest (`schemas/progress.ts:7-15`). | The planner cannot target a weak skill. | `goals.focus` stays `reading \| words \| culture \| balanced`; no `writing` focus. | Add focus values when content and a measure exist. |
| G3 | Writing content is thin and unmeasured: one quest traces today (`content/quests.ts:34`); tracing checks strokes inside the game but stores nothing. | None. | F-ROUTE-001 credits Write to `trace-stroke` only; tile-building is the grown-up line "Spelling with tiles". | More trace steps (F-QUEST-002); a clean-trace count if the owner wants a writing signal. |
| G4 | A game skipped inside a finished quest still counts (`check-launcher.ts:35`; `results-award.ts:39-48` only drops an all-skipped run). | None. | Inventory wording and the grown-up caveat (F-ROUTE-001 3.7). | Additive `QuestProgress.kindsPlayed?` written by `finishQuest`, union merge, `ADDITIVE_FIELDS` entry. |
| G5 | Stage anchors past Stage 3 have no content. | A plan past Stage 3 is coming-soon items only. | Honest previews; at most 5 coming-soon items (F-PLAN-002 Q4). | Content. |
| G6 | With the default visible sound guide the check cannot ask decoding (`run.ts:95`); the level is `stage1` band 0 by construction. | Most learners who just tap Next get a band-0 proposal. | **OD-1** (top of the owner list): default (c) plus honest result copy (AM-14). | Measure with an `always` simulation row (R-0 open item). |
| G7 | Free tier: a learner placed at Stage 2+ gets `startQuestId: null`; on today's bundle there is nothing to schedule. | No proposal today; 4 weeks of stories once stories ship. | "More lessons are coming." on learner screens; OD-4 decides whether Stage 2 / 4 tastes stay on the cursor. | Content, tier decision. |
| G8 | No defined destination: the only defined end is Stage 1 complete (Hangul Check `stage1Anchor`, `schemas/sync.ts:30-36`). | Proposals end at "Stage 1 is done around week N". | F-ROUTE-001 shows the goal line "Your first goal: read every Hangul letter." and a can-do line per stage, no numbers. | **OD-9** defines the end state per skill. |
| G9 | No growth-based pacing: the pace is chosen once; re-pace only shifts for skipped days (F-PLAN-002 section 3.7). | — | Pace chips; one Hoya check-in after week 4 (FP-B14). | Automatic extend or speed-up is a later spec. |

## 5. Owner decisions touched by this file (the questions and defaults are in F-ROUTE-001 section 9)

OD-1 (sound guide; gates P-6), OD-4 (free-tier stages), OD-7 (learner naming), OD-9 (defined level), OD-12 (length rule; decided 2026-10-12, accepted as proposed; no longer gates P2-3b), OD-13 (pace chips and check-in; decided 2026-10-12, accepted as proposed; no longer gates P2-3b / P2-7b), OD-14 (one-tap for self profiles on any device; **decided 2026-10-14 by the owner: confirmed as proposed** (a self profile applies the recommended plan with one tap, **Use this plan**, no PIN, on any device; a child profile still goes through the grown-up gate); the default built behind the flag in P-7b, #573, is the decided behaviour; no longer gates P-10), OD-15 (start day Today), OD-16 (14-day dismissal; gates P2-7a), OD-17 (a child answers the Hoya check-in alone; decided 2026-10-13: no, the check-in stays behind the grown-up gate on a child profile; no longer gates P2-8b, the flag flip).

## 6. Errata (apply in the same docs PR)

- **E-1. Migration number.** F-PLAN-002 says `0004_plan_meta.sql` (lines 7, 226, 338, 359), but `apps/api/migrations/0004_waitlist.sql` exists (0001-0004 on main), and F-SPACE-002 also plans a new migration (`0005_class_transfer.sql`, "number is taken at merge time", `F-SPACE-002-class-transfer.md:11, 126`). Rule for both specs: **each PR takes the next free number when it is opened (0005 if first, else 0006), and the order is decided at merge**; "a v3 database" on line 338 becomes "the database at the previous migration". The test shim applies files in sorted order (`packages/backend/src/__tests__/helpers/sqlite.ts:22`), so add a CI check that migration prefixes are unique (in whichever of P2-4 or T-3b lands first).
- **E-2. Example B narrative.** Line 219 says "about five weeks of lessons and stories at three a week, then free practice", but the table carries items to week 14 (plus week 17) and `content-runs-out` {week 15}. Replace with "about fourteen weeks hold lessons, stories and the first coming-soon items (plus the Seollal story in week 17); free practice starts in week 15". The golden test is authoritative.
- **E-3. Stale line cites.** F-PLC-001 line 296 cites `HomeScreen.tsx:207-209` and `:103` (now `:199-202` and `:108`; AM-3 corrects it); line 362 cites "Stage 1 progress" at `:207` (now `:199`). F-PLAN-002 line 244 cites `HomeScreen.tsx:105` (`groupAssignments`) and `:222`; on main Home counts every pending homework item with no date filter (`HomeScreen.tsx:110`) and the Homework line is `:215`. F-PLC-001 assumption 10 (line 508) cites `JourneyScreen.tsx:100` for the "Premium" pill (now `:104`).
- **E-4. Naming.** F-PLAN-002 line 10 lists `route/overview.md` for the weekly plan; F-ROUTE-001 uses `journey/my-route.md` for the map, so the files do not collide.
- **E-5. P2-2 status.** F-PLAN-002 line 357 says P2-2 needs Q-6b for the 15 quests; P2-2 merged (#175) with the 8 shipped quests and a parity test (`catalog/data.ts:9-12`); Q-6a and Q-6b grow `catalog/data.ts` through that test. The F-QUEST-002 dependency for `teaches` is Q-6a (quests 1-3), not Q-6b.

## 7. Dependencies and order

`proposeRoute` needs F-PLAN-002 P2-3a (generator) and F-PLC-001 P-3 (merged). P2-2 (merged) provides `routeCatalogOf(CATALOG)`. Until P2-3b lands the strip, the report card and the Home prompt do not render. `flags.routeEnabled` does not exist yet (`apps/mobile/src/config/flags.ts:24-72`; P2-7a creates it). Server first: `route.*` names and P2-4's `selfRoute` ride the shared Worker deploy D2 before any app build sends them. Milestone M2 order (F-ROUTE-001 section 6.0): P2-3a -> P2-3b -> P2-4 (deploy D2, migration) -> P2-5 -> P2-7a (default plan without a level check) -> P-5 -> P-6 (after OD-1) -> P-7b -> P2-7b; P-4 (in flight) gates P-6's real bank.

## 8. Later: speaking

Not part of these amendments or of any screen. See F-ROUTE-001 section 10 and `docs/roadmap/speaking-later.md`.

## Review log

- 2026-10-13, docs follow-ups after the 2026-10-13 merges. Row P-7b is marked done (#573). Section 5: OD-14 no longer gates P-7b; its proposed default is built behind `flags.routeEnabled`, and the owner confirms it before P-10 (added to P-10's Needs in section 2).
- 2026-10-14, owner decision OD-14 (answered in chat): confirmed as proposed. A self profile applies the recommended plan with one tap (**Use this plan**, no PIN) on any device, also a family or PIN device; a child profile still needs the grown-up gate. Section 5 records it; section 2 drops OD-14 from P-10's Needs (P-10 still needs P-7, P-7b, P-8, the P-3b Worker deploy and the store build); AM-11 item 16 and FP-B12 item 12 say decided. No code change: P-7b (#573) already built this behaviour.
