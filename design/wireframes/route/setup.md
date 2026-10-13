# Route/Setup — Change the plan in four steps, then the preview of the new plan (wireframe v2, promoted)

Promoted in F-PLAN-002 P2-8 from `console/curriculum-planner.md` G1 and G2 (with the FP-B6, FP-B13, FP-B15 amendments), drawn as P2-7b shipped. The preview is the last screen of this flow (`RoutePreview`), so it lives here.
Spec: `docs/specs/F-PLAN-002-curriculum-planner.md` section 3.9 (Setup, Preview), section 3.8 (the console wizard's steps and defaults, for `self`), section 3.10 (the "theirs comes first" line)
Code: `apps/mobile/src/screens/route/RouteSetupScreen.tsx`, `screens/route/RoutePreviewScreen.tsx`, `screens/route/parts.tsx` (`PlanWeekCard`), `logic/route/setup-flow.ts`, `logic/route/plan-view.ts`; strings `learner.weeklyPlan.setup.*`, `learner.weeklyPlan.planPreview.*`. Behind `flags.routeEnabled`.
Audience: **any learner**; on a child profile a grown-up (the gate opens it). Large chips, one question per step.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `(o)` / `( )` a radio, `[x]` a checkbox. Every sentence is a placeholder.

## Scenario (Given-When-Then)

Given: a learner has a proposal or a plan in force and wants a different start, rhythm, length or theme
When: they tap **More choices** on the proposal or **Change the plan** on the overview
Then: four short steps, prefilled from what is in force, lead to a preview of the new plan they can start or change again

## Screen goal

"Change one thing about the plan without starting from a blank form."

## Box diagram

G1. Set-up, one screen per step (step 2 drawn; the others share the frame)

```
┌──────────────────────────────────┐
│ [<]  Change the plan              │  <- back: the previous step, or where it came from
│ Step 2 of 4                       │
│ How much time?                    │
│  ( ) Gentle, 2 days a week        │
│  (o) Steady, 3 days a week        │
│  ( ) Brisk, 4 days a week         │
│  [x] Mon [ ] Tue [x] Wed ... [x] Sat   "Pick 3 days."
│  ( ) 5 min (o) 15 min ( ) 30 min ...   minutes a day
│ [[            Next            ]]  │
└──────────────────────────────────┘
```

- Step 1 **Where do you start?**: six cards (Brand new, Knows some letters, Knows all the letters, Reads words, Reads first words, Reads first sentences), prefilled from the plan or the level check, else Brand new. With a class or family plan: one line "You have a plan from your class or family too. You can add your own. Theirs comes first."
- Step 2 **How much time?**: as drawn.
- Step 3 **How long?**: 4 weeks, 12 weeks, 6 months, Choose weeks with steppers. A plan longer than the item cap shows one sentence and keeps **Next** disabled.
- Step 4 **What do you like?**: focus (A bit of everything, Read Hangul, First words, Culture and stories) and up to five themes in tap order ("1. Nature", "2. Holidays"). The button reads **See my plan**.

G2. Preview (`RoutePreview`)

```
┌──────────────────────────────────┐
│ [<]  Your new plan                │
│ 30 lessons and stories, about 134 minutes, ends in Stage 1
│ More lessons are coming.          │  <- notices: plain lines, never Premium
│ You know 1 lesson already, so it is not in the plan.
│ ┌ Week 1  Oct 12  [Learn] ───────┐ │
│ │ Mon   <quest title>            │ │
│ │ Wed   <quest title>            │ │
│ │ Sat   <story title>            │ │
│ └────────────────────────────────┘ │
│ (weeks 2 to 4 the same, expanded) │
│ [ Show 22 more weeks ]            │  <- later weeks folded
│ [[       Start this plan      ]]  │
│ [ Change something ]              │  -> back to step 4
└──────────────────────────────────┘
```

- Week kinds are words in a pill (Learn, Culture, Review and collect, Days off), never colour alone. A review or break week says what it is in one line; an empty week says "Free practice. Play anything you like."
- Extras under a week: "Words you can try: Food. You can skip it." and "Hangul Check".
- Notices a learner can see: new lessons on the way from week N, "More lessons are coming.", lessons that did not fit, lessons that may take more than a day, lessons already known. The Premium notice of the console never appears here (FP-B15).

## Interaction points

- Step chips -> update the draft state (no network); **Next** -> the next step; back -> the previous step.
- **See my plan** -> `RoutePreview` with the generated draft (the generator runs on the device).
- Show N more weeks / Hide the next weeks -> folds the weeks after the fourth.
- **Start this plan** -> replaces the plan in force (the old one is archived, finished items stay), derives the first week, fires `route.created`; opens `route/overview`.
- **Change something** -> step 4 with the choices kept.

## Navigation graph

Enter from: `route/proposal` (**More choices**) · `route/overview` (**Change the plan**, through the grown-up gate on a child profile)
Exit to: `route/overview` · `route/proposal` · `parent/gate` (child profile)

## States

- **success**: as drawn.
- **empty** (nothing is ready for this start): the preview shows "Nothing is ready for this start yet. Change something to try another one." and **Change something** only.
- **error**: the save fails -> "That did not work. Try again." above **Start this plan**; the draft stays.
- **busy**: **Start this plan** reads "Starting..." and is disabled.
- **offline**: identical; the plan syncs later.
- **small phone (320 px)**: chips wrap, week cards stack, nothing scrolls sideways (P2-8 checks every step, the preview and the overview in es and ko).

## Data needs

- reads: the plan in force (`selfRoute.meta.params`), the placement level, class and family assignments, the shared catalogue, `unlockedStagesFor`
- writes: `snapshot.selfRoute` (new plan; the old one archived), derived `snapshot.homework`
- telemetry: `route.created`

## Open questions

- None for P2-7b. Weekdays picked here are spread again when a later pace change (the Hoya check-in) changes the number of days (section 3.7 notes).
