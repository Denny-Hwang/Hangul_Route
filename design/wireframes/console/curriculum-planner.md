# Curriculum planner: console wizard (class and family), week-grouped plan builder and readout, in-app self-route (wireframe v1)

Spec: `docs/specs/F-PLAN-002-curriculum-planner.md` (section 3.3 generator, 3.4 worked examples, 3.7 re-pacing, 3.8 console wizard, 3.9 self-route, 3.10 precedence and visibility)
Audience: **teacher** (class space) and **parent** (family space) in the console; **self-learner** (or a parent on a child's device) in the app. One flow, wording set by the space kind ("students" / "kids" comes from `memberNoun`). Learners never see the wizard; they see a week of items.
Code (planned): `apps/web/src/app/(console)/teach/space/curriculum/page.tsx`, `apps/web/src/app/(console)/teach/space/plan/page.tsx` (week groups, readout, switcher), `apps/web/src/lib/console/curriculum.ts`; `apps/mobile/src/screens/route/{RouteSetupScreen,RoutePreviewScreen,RouteOverviewScreen}.tsx`, `screens/home/HomeScreen.tsx` (route card), `screens/homework/HomeworkScreen.tsx` (week window)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `(o)` / `( )` radio, `[x]` / `[ ]` checkbox or switch, `~~ ko ~~` taught Korean drawn with `KoreanText`. No colours, fonts or pixel sizes; every sentence in a box is a placeholder that says what the sentence does.

This file holds the screens in one place (house style is one file per screen; split when promoted to `design/wireframes/console/curriculum-wizard.md`, `console/plan-builder.md`, `route/setup.md`, `route/overview.md`):

- A. Wizard step 1: starting point
- B. Wizard step 2: length and rhythm
- C. Wizard step 3: goals
- D. Wizard step 4: preview (two variants: class 12 weeks, self 6 months)
- E. Plan builder with week groups and the plan switcher
- F. Published readout and "Re-pace from today"
- G. In-app: set-up, preview, overview
- H. Home route card and the Homework week window
- I. Empty, error and offline states

## Scenario (Given-When-Then)

Given: an adult (or a self-learner) wants a route for a term or a half year instead of picking quests one by one
When: they say where the learners start, how long, how often, and what they care about
Then: they see a week-by-week route that is honest about what exists today, can change anything, and publish it once; devices then show one week at a time and the route quietly moves along when a week is missed

## Screen goal

"Turn four short answers into a route the adult trusts, and make the gaps in today's content visible and calm instead of hidden."

---

## A. Wizard step 1: starting point (`console/curriculum-wizard`)

```
┌────────────────────────────────────────────────────────────────┐
│ [< back]   "Plan a term"      step 1 of 4  · · · ·              │
│ (family space only: "For: [ Sam v ]")                           │
│                                                                │
│ Where do they start?                                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │ ( ) Brand new│ │ ( ) Knows    │ │ ( ) Knows all│              │
│ │              │ │ some letters │ │ the letters  │              │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │ ( ) Reads    │ │ ( ) Reads    │ │ ( ) Reads    │              │
│ │ words        │ │ first words  │ │ first sentences│            │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│ hint (3 or more learners have a result):                        │
│   "Most of your students start here: [Knows some letters]"      │  <- one line, a pre-selection
│ [[ NEXT ]]                                                      │
└────────────────────────────────────────────────────────────────┘
```

- The hint pre-selects a card; the adult always chooses. It never lists learners or levels.
- Each card has a one-line plain description (placeholder), no jargon, no stage numbers.

## B. Wizard step 2: length and rhythm

```
│ How long?        ( ) 4 weeks  (o) 12 weeks  ( ) 6 months  ( ) Choose weeks [ 12 ] │
│ Starts           [ Sun, Oct 18 ]                                               │
│ Days they learn  [Sun][Mon][Tue][Wed][Thu][Fri][Sat]   (class: a class day + a homework day) │
│ Minutes a day    ( ) 5 ( ) 10 (o) 15 ( ) 20 ( ) 30                               │
│ Days off         [ + Add a break ]   Nov 22 - Nov 28  [ x ]                      │
│ note: that is 22 sessions in 12 weeks                                           │
│ [ Back ]  [[ NEXT ]]                                                           │
```

- The note under the form updates live (sessions = days x weeks minus days off). More than 260 items shows one plain sentence and keeps NEXT disabled with the reason beside it.
- Weekday chips show a selected state with text, not colour alone.
- **Amended (F-PLAN-002 FP-B5, FP-B13; F-ROUTE-001 R-0):** step 2 gains pace chips *Gentle* / *Steady* / *Brisk* above the length chips; the recommended pace and length come from `proposeRoute`, are pre-selected and tagged *Suggested*, and each length shows one honest preview line (as in `journey/my-route-overview.md` K2).

## C. Wizard step 3: goals

```
│ What matters most?                                               │
│  (o) A bit of everything   ( ) Read Hangul   ( ) First words   ( ) Culture and stories │
│ Themes to start with (drag or tap in order):                     │
│  [Letters] [Food & Daily Life] [Holidays] [Nature] [Play & Crafts]│
│ [x] Mark Korean holidays (Hangeul Day, Seollal, Chuseok)         │
│ [x] Include lessons that are not released yet                    │
│     one line: new episodes appear as they are released           │
│ [ Back ]  [[ SEE THE ROUTE ]]                                    │
```

- Theme order only changes what comes first after Stage 1 (Stage 1 keeps its order).
- Unchecking "not released yet" shows free practice weeks sooner in the preview.

## D. Wizard step 4: preview

D1. Class, 12 weeks, Pictures first (the first worked example)

```
┌────────────────────────────────────────────────────────────────┐
│ [< back]   "Your route"      step 4 of 4                        │
│ 18 lessons and stories · about 80 minutes · ends in Stage 2     │
│ ┌ Notice ────────────────────────────────────────────────────┐ │
│ │ 2 lessons did not fit. Add a week or a session to include them.│
│ └────────────────────────────────────────────────────────────┘ │
│ Week  Dates          Kind      What                 Items       │
│  1    Oct 18-24      learn     Meet the Letters     Sun Q1 · Wed Q2 │
│  2    Oct 25-31      learn     Meet the Letters     Sun Q3 · Wed Q4 │
│  3    Nov 1-7        learn     Around the Table     Sun Q5 · Wed Q6 │
│  4    Nov 8-14       review    Review and collect   -            │
│  5    Nov 15-21      culture   Culture week: Kim Hong-do's ...  story · Q7 │
│  6    Nov 22-28      days off  -                    -            │
│  ...                                                            │
│ 12    Jan 3-9        learn     Yut, Kites & Paper   Q15 · Stage 2 lesson [Hangul Check]│
│ [ Change something ]   [[ USE THIS ROUTE ]]                      │
└────────────────────────────────────────────────────────────────┘
```

D2. Self-learner / family, 6 months (the second worked example, abbreviated)

```
│ 29 lessons and stories · about 130 minutes · ends in Stage 1       │
│ ┌ Notice ─────────────────────────────────────────────────────┐   │
│ │ No new episodes yet from week 15. Free practice and word topics fill those weeks. │
│ │ 5 episodes are not released yet. They are in the plan and start on their dates.  │
│ │ 3 lessons need Premium and are not in the plan.   [ See plans ]  │ <- class: links to billing
│ └─────────────────────────────────────────────────────────────┘   │
│  1  Oct 12-18   learn    Tigers, Mountains, Moon     3 items       │
│  2  Oct 19-25   learn    Yut, Kites & Paper          3 items   [Hangul Check] │
│  3  Oct 26-1    learn    Heritage stories            3 stories     │
│  4  Nov 2-8     review   Review and collect          -             │
│  ...                                                               │
│ 13  Jan 4-10    learn    Heritage stories + 2 coming soon   [words: Animals] │
│ 15-26 ...       learn    Free practice               -         [words: ...]  │
```

- Badges: kind (learn, culture, review, days off), "coming soon", "optional words"; text, never colour only.
- Warnings are invitations, never alarms. Nothing here says behind, late, missed or overdue.
- USE THIS ROUTE saves a draft plan and opens E; nothing reaches a learner until Publish.

## E. Plan builder with week groups (`console/plan-builder`, changed)

```
┌────────────────────────────────────────────────────────────────┐
│ [< back]  Plan: "Route · 12 weeks"        draft - [[ PUBLISH ]] │
│ Plans:  [Route · 12 weeks (active)] [Week 3] [Draft]   [ + New ] │  <- switcher: active route first
│                                                                │
│ Week 1  Oct 18-24  learn                                        │
│   1. Quest letters-q1   Sun Oct 18  [date] [note] [^][v][x]     │
│   2. Quest letters-q2   Wed Oct 21  [date] [note] [^][v][x]     │
│ Week 4  Nov 8-14  review   no items — catch up or replay        │
│ Week 5  Nov 15-21 culture                                       │
│   ...                                                           │
│ Who is this for:  (o) everyone   ( ) only: [ ] Minho [ ] Suji   │
│ [ Save draft ]  [ Archive ]                                     │
└────────────────────────────────────────────────────────────────┘
```

- Items keep the existing controls (move, remove, date, note). "Spread dates" is hidden for a route because dates come from the calendar; editing one date is allowed.
- A coming-soon item shows the episode title with a "coming soon" tag.

## F. Published readout and re-pace (`console/plan-builder`, published)

```
│ Plan: "Route · 12 weeks"   published Oct 17  [ Edit ] [ Archive ] │
│ This week (week 3)                                                │
│   Minho   ●●○  2 so far · 36 planned     today                    │  <- dots/counts, learners in activity order
│   Suji    ○○○  0 so far                  waiting for the next sync│
│ ▸ All weeks (collapsed list)                                      │
│ [ Re-pace from today ]   one line: keeps what is done, lays the rest from the next session │
```

- No ranking, no percentage, no sort by progress. "so far" because only a week of items exists on a device at a time.
- Re-pace shows a confirm with the new end date before saving; saving bumps the plan so devices pick up new dates.

## G. In-app self-route

G1. Set-up (one screen per step, large chips)

```
┌──────────────────────────────────┐
│ [<]  "Plan my route"  · · · ·     │
│ Where do you start?               │  <- pre-selected from the level check, else "Brand new"
│  ( ) Brand new … ( ) Knows letters … │
│ How much time?                    │
│  minutes ( ) 5 ( ) 10 (o) 15 …    │
│  days    [Mon][Tue][Wed]…         │
│ How long? ( ) 4 weeks (o) 12 weeks ( ) 6 months │
│ What do you like?                 │
│  focus chips + theme chips        │
│ [[ SEE MY ROUTE ]]                │
└──────────────────────────────────┘
```

G2. Preview: the first four weeks expanded, later weeks collapsed, the same notices as D in the app language **except the Premium notice** (a learner never sees it; locked and coming-soon parts read "More lessons are coming"), `[[ START THIS ROUTE ]]` and `[ Change something ]`.

G3. Overview

```
┌──────────────────────────────────┐
│ [<]  "My route"                   │
│ This week  ●●○                    │
│   Mon  quest …                    │
│   Wed  quest …                    │
│   Fri  story …                    │
│ Next weeks (collapsed)            │
│ Words you can try: Food (optional)│  -> Library topic when it exists
│ [ Move my plan along ]            │  -> re-pace now
│ [ Stop this route ]               │  -> confirm; history stays
└──────────────────────────────────┘
```

- A child profile on a family device reaches G1 through the grown-up gate; a self profile goes straight in.
- Copy never says behind, late, overdue or missed; "Hoya moved your plan along" appears once after an automatic re-pace.
- **Amended (F-PLAN-002 FP-B6, FP-B13, FP-B15; F-ROUTE-001 R-0):** learner strings say "weekly plan" / "plan", not "route": the Profile row is "Make a weekly plan", G2's button is **Start this plan**, G3's title is "Your weekly plan" and its stop button **Stop this plan**. The one-tap proposal (`route/proposal`, `journey/my-route-overview.md` K1) comes first; G1 to G3 remain for **Change the plan**. G1 gains the pace chips with the suggested one pre-selected.

## H. Home route card and the Homework week window

```
Home                                              Homework
 Today with Hoya (3 cards)                         Today (at most 3)
 ┌ This week on your route ───────┐                  quest …   From class
 │ ●●○        [ Open route ]      │                  quest …   Your route
 └────────────────────────────────┘                  "More are waiting. They come one at a time."
 Progress bar … Homework card                      Coming up (next 7 days only)
                                                    Later on your route  [ v ]   <- one collapsed row
```

- The route card shows fill-only dots (no fraction text on the card); a screen reader hears "2 of 3 done this week".
- Card (2) takes the highest-ranked pending item due today or earlier: class, then family, then own route. The others wait and come on the following days.
- With no route and one or more quests done: the card reads "Set up my route" instead.
- Between the mission cards and the progress bar only one quiet card shows: the level-check card (`placement.md` H) while it is eligible, then this route card.
- **Amended (F-PLAN-002 FP-B6, FP-B13; F-ROUTE-001 R-0):** the in-plan Home card with week dots is removed. Before a plan exists the Home card is only the prompt "Hoya can make a weekly plan for you" with **Make my plan** and **Not now**; once a plan exists its week is one line in F-ROUTE-001's My route strip ("Week 3 of your weekly plan", `journey/my-route-overview.md` D). Home order: F-ROUTE-001 section 6.4.

## I. Empty, error and offline

- No ready content for the chosen range: the preview shows only the notices and "Change something".
- More than 260 items: step 2 explains in one sentence and disables NEXT.
- Offline in the console: the wizard and preview still work (the generator is local); saving shows the existing "cannot reach" message and keeps the draft in the page.
- Offline in the app: everything works; the route syncs later.
- A catalogue that is older than the app: a "Refresh route" button on E and G3.
- A plan the learner's older app cannot read: it does not arrive; the readout shows "waiting for the next sync" for that learner.

---

## Interaction points

- Starting-point card: selects; the hint only pre-selects.
- Weekday chip, minutes, break range: edit the calendar; the sessions note updates.
- SEE THE ROUTE: runs the generator locally (no network).
- USE THIS ROUTE: saves a draft plan (`PUT /api/spaces/:id/plans`) and opens E.
- Re-pace from today / Move my plan along: regenerates the remaining weeks; same plan id.
- Stop this route: archives the self-route; pending route items disappear; finished items stay.

## Navigation graph

Enter from: `console/roster` ("Plan this term"), `console/plan-builder` empty state ("Start from a template"), `console/home` (family row), `profile/settings` ("Plan my route"), `home/todays-mission` ("Set up my route")
Exit to: `console/plan-builder` (draft), `console/roster`, `console/billing` (Premium note, class), `route/overview`, `home/todays-mission`

## States

- **success**: as drawn.
- **empty**: nothing schedulable (preview shows only notices); no plans yet (E shows the wizard entry).
- **error**: save fails (existing banner); invalid combination (inline reason).
- **offline**: wizard and app work; saving a console plan needs the API.
- **small phone / narrow window**: the week table becomes a list of week cards; chips wrap; NEXT stays reachable.

## Data needs

- reads: the shared catalogue (cells, quests, stories, topics, festival dates), roster summaries (`placement.level`, `stage1.questsDone`), entitlement of the space, the learner's placement result and snapshot (app)
- writes: a plan row with `meta` (console), `selfRoute` and derived homework (app), telemetry `route.created` / `route.repaced` (app only)

## Open questions

- Should the class wizard remember the last term's choices per space? (default: no; a saved-template feature is out of scope)
- Is "Review and collect" the right name for a week with no items? (default: yes until a review item exists)
- Does the Home route card replace the Homework card when a route exists? (default: no, both stay)
