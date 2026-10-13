# Console/Curriculum-wizard — Plan a term in four steps for a class or a family (wireframe v2, promoted)

Promoted in F-PLAN-002 P2-8 from `console/curriculum-planner.md` A to D (with the FP-B5 / FP-B13 amendment of step 2), drawn as P2-6 and P2-6b shipped. The plan builder it hands off to is `console/plan-builder.md` (section "Week groups, plan switcher, readout and re-pace"). The free-plan lines of the preview (lessons left out, plans that end early) are `console/curriculum-free-days.md` (F-ENT-003).
Spec: `docs/specs/F-PLAN-002-curriculum-planner.md` section 3.8 (wizard), 3.3 (generator), 3.4 (worked examples), 3.1 (audience defaults) · `docs/specs/AMENDMENTS-PLC-PLAN-HANDOFF.md` FP-B5, FP-B11 (pre-selection from `proposeRoute`)
Code: `apps/web/src/app/(console)/teach/space/curriculum/page.tsx` (`/teach/space/curriculum?id=` and `/parent/space/curriculum?id=`), `apps/web/src/components/console/CurriculumParts.tsx`, `apps/web/src/lib/console/curriculum.ts`; strings `console.curriculum.*`
Audience: **teacher** (class space) and **parent** (family space), signed in to the console on app.hangulroute.com. Learners never see this screen; they see one week of items on their device.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `(o)` / `( )` a radio, `[x]` / `[ ]` a checkbox or switch. Every sentence is a placeholder.

## Scenario (Given-When-Then)

Given: an adult wants a plan for a term or a half year instead of picking quests one by one
When: they say where the learners start, how long and how often, and what they care about
Then: they see a week-by-week plan that is honest about what exists today, save it as a draft, and publish it once from the plan builder

## Screen goal

"Turn four short answers into a draft plan the adult trusts."

## Box diagram

A. Step 1: starting point

```
┌────────────────────────────────────────────────────────────────┐
│ ← Back to <space>                                               │
│ Plan a term                                       Step 1 of 4   │
│ (family only) For: [ Mina v ]                                   │  <- required before Next
│ Where do they start?                                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │ Brand new    │ │ Knows some   │ │ Knows all    │              │
│ │ one line     │ │ letters      │ │ the letters  │              │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │ Reads words  │ │ Reads first  │ │ Reads first  │              │
│ │              │ │ words        │ │ sentences    │              │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│ "Most of your students start here: Knows some letters"          │  <- 3+ results: a pre-selection only
│ [[ Next ]]                                                      │
└────────────────────────────────────────────────────────────────┘
```

B. Step 2: pace, length and rhythm (pre-selected from `proposeRoute`, P2-6b)

```
│ Pace     ( ) Gentle  (o) Steady [Suggested]  ( ) Brisk                     │
│ How long ( ) 4 weeks (o) 12 weeks [Suggested] ( ) 6 months ( ) Choose weeks [ 12 ] │
│          one preview line under each length ("Stage 1 is done around week 7, then heritage stories.") │
│ Starts   [ Thu, Oct 15 ]                                                    │
│ Days     [Sun][Mon][Tue][Wed][Thu][Fri][Sat]   (selected state in words, not colour only) │
│ Minutes  ( ) 5 ( ) 10 (o) 15 ( ) 20 ( ) 30                                   │
│ Days off [ + Add a break ]   Nov 22 - Nov 28  [ x ]                          │
│ note: that is 36 sessions in 12 weeks                                        │
│ [ Back ]  [[ Next ]]                                                         │
```

C. Step 3: goals

```
│ What matters most?  (o) A bit of everything ( ) Read Hangul ( ) First words ( ) Culture and stories │
│ Themes to start with (tap in order): [1. Nature] [2. Holidays] [Letters] [Food and daily life] [Play and crafts] │
│ [x] Mark Korean holidays                                                     │
│ [x] Include lessons that are not released yet                                │
│     one line: they start once they are released                              │
│ [ Back ]  [[ See the route ]]                                                 │
```

D. Step 4: preview

```
┌────────────────────────────────────────────────────────────────┐
│ Your route                                        Step 4 of 4   │
│ 30 lessons and stories · about 134 minutes · ends in Stage 1    │
│ ┌ Notices ───────────────────────────────────────────────────┐ │
│ │ No new lessons yet from week 15. Free practice and word topics fill those weeks. │
│ │ 5 lessons are not released yet. They start once they are.  │ │
│ │ (class) 3 lessons are not included yet.  [ See plans ]     │ │  <- grown-up only; never on a learner screen
│ └────────────────────────────────────────────────────────────┘ │
│ Week  Dates          Kind      What                 Items       │
│  1    Oct 15-21      Learn     Around the Table     Thu · Sat · Tue │
│  4    Nov 5-11       Review    Review and collect   -            │
│  ...  (narrow window: one card per week)                        │
│ one line: a draft; nothing reaches a learner until you publish  │
│ [ Change something ]   [[ Use this route ]]                     │
└────────────────────────────────────────────────────────────────┘
```

- Kinds and tags are words (Learn, Culture, Review and collect, Days off, coming soon, optional words), never colour alone.
- Notices are invitations, never alarms: nothing says behind, late, missed or overdue, and nothing ranks learners.

## Interaction points

- Learner picker (family) -> the plan targets that learner; the start card pre-selects from their level check.
- Start card -> selects; the hint only pre-selects.
- Pace / length / weekday / minutes / break -> the calendar; the sessions note updates live. More than the item cap: one sentence, **Next** disabled with the reason beside it.
- Focus and theme chips -> the generator's goals (theme order changes what comes first after Stage 1 only).
- **See the route** -> runs the generator in the page (no network).
- **Use this route** -> `PUT /api/spaces/:id/plans` as a draft with `meta` (`publish: false`), then the plan builder for that plan.
- **Change something** -> step 3 (or step 2 when the problem is the rhythm).

## Navigation graph

Enter from: `console/roster` (**Plan this term**) · `console/plan-builder` empty state (**Start from a template**) · `console/home` and the family learner card (**Update the plan**, P2-6b)
Exit to: `console/plan-builder` (the saved draft) · `console/roster` / the family space (back) · `console/billing` (**See plans**, class notice only)

## States

- **success**: as drawn.
- **empty**: nothing schedulable for the choices -> the preview shows the reason and **Change something** only.
- **error**: the roster does not load -> "Try again"; the save fails -> one line above the buttons, the draft stays in the page.
- **offline**: the steps and the preview work (the generator is local); saving needs the API.
- **small window (320 px)**: the start cards and chips wrap, the week table becomes week cards, **Next** stays reachable, nothing scrolls sideways (P2-8 `apps/web/e2e/curriculum.spec.ts`).

## Data needs

- reads: the roster (`summary.placement.level`, `stage1.questsDone`), the space's entitlement (`unlockedStagesForSpace`), the shared catalogue, today
- writes: a draft plan row with `meta` (`params`, `weeks`, `horizonDays` = 7) and week-numbered items
- telemetry: none in the console beyond the existing plan saves

## Open questions

- Should a class wizard remember last term's choices per space? (default: no; templates are out of scope)
- Is "Review and collect" the right name for a week with no items? (default: yes until a review item kind exists, F-RVW-001)
