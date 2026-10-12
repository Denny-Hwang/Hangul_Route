# Learning Route: the learner's Route tab, with where you are and where you are going (wireframe v2)

Specs:
- `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md`: section 4 (goal, route card, next), section 5 (tab and entries), section 7 (name).
- `docs/specs/F-ROUTE-001-my-route-overview.md`: sections 3.3 to 3.11, the trail, pips, skills and gains, which are unchanged.
- F-ENT-003 (free plan and "next"): `routeNext`, `planView`, the word "Not open yet" and its dotted ring, "In your plan", the "open for you" line. Its wireframes `journey/grid-plan-and-access.md` and `home/next-and-free-end-card.md` draw the same words and shapes on the Journey and Home.

Builds on: `design/wireframes/journey/my-route-overview.md`. Screens A to G and L of that file stay valid for the trail, the pips, the expanded stage, the skills and the gains. This file draws only what changes:
- the tab and its purpose line;
- the route card that replaces the hero (with the goal stage's pips);
- the goal tag;
- the not-open pips and the free-end hero (F-ENT-003's words);
- the new states.

Audience: the learner, at any age. The page works for a child alone (big targets, short words) and for an adult (quiet, no baby talk). There are no grown-up controls on this screen.

Code (planned):
- `navigation/tabs.tsx` (Route tab), `navigation/types.ts` (`MainTabParamList.Route`)
- `screens/my-route/MyRouteScreen.tsx` (`variant: 'tab'`), `screens/my-route/RouteCard.tsx`
- `packages/content-schema/src/route/goal.ts`; "next" is F-ENT-003's `logic/route-next.ts` (this page has no next function of its own)

Notation:
- `[[ X ]]` is the one primary action. `[ X ]` is secondary.
- `[pin]` and `[flag]` stand for drawn `Icon` glyphs, never characters.
- Pip letters follow the legend of `my-route-overview.md`: `(D)` done, `(O)` open, `(L)` coming later or not open yet (the same dotted ring; the word tells them apart), `^` next.

Every sentence below is a placeholder; the final strings are in the dictionary. No colours, fonts or pixel sizes.

**Owner decisions in force:**
- reading, listening and writing only, with no speaking anywhere (2026-10-10);
- the page is named LEARNING ROUTE (2026-10-11), written "Learning Route" in UI strings (LR-OD-1 default).

---

## Scenario (Given-When-Then)

Given: a learner, on a phone, tablet or laptop, with or without a weekly plan from their class, family or themselves.
When: they tap the Route tab, or a "See Learning Route" link.
Then: at the top they see where they are now and where they are going (the goal), how far along the goal stage they are (pips that only fill), and one button for the same next step Home shows. Below that they see the whole road of seven stages, with the goal stage marked. There are no dates, no countdown and no comparison with anyone.

## Screen goal

"See where I am and where I am going in one look, and take the next step in one tap."

(One primary goal. The secondary goal, opening a stage to look inside, is unchanged from `my-route-overview.md` B.)

---

## A. Route tab, phone, the goal stage is the current stage (compact, 320 to 599)

Today's bundle. The class weekly plan reaches Stage 1. Done: `letters-q1..q3` and `life-q1`. `routeNext` (F-ENT-003) returns `life-q2` from the class plan. This is the usual case early on, so Now and Goal collapse into one line.

```
┌──────────────────────────────────┐
│  Learning Route                  │   tab root: no back button; title = the name
│  Where you are and where you are │   purpose line (LR-OD-3)
│  going.                          │
│ ┌──────────────────────────────┐ │   ROUTE CARD (replaces the hero): ONE action
│ │ (Hoya)                       │ │
│ │ [pin][flag] Stage 1 · Hangul:│ │   collapsed line: Goal equals Now
│ │ you are in your goal stage   │ │
│ │ From your class's weekly plan│ │   source line (never "family plan" / "class plan")
│ │ By the end of this stage you │ │   the goal stage's can-do line (no number)
│ │ can: Read any Hangul letter  │ │
│ │ and syllable and know its    │ │
│ │ sound.                       │ │
│ │ (D)(D)(D)(D)(O)(O)(O)(O)(O)  │ │   goal pips: fill only, no digits, no "of"
│ │          ^                   │ │   next marker on the routeNext pip
│ │ Next: Family at the Table    │ │
│ │ [[        Continue        ]] │ │   -> QuestPlayer for routeNext's quest
│ └──────────────────────────────┘ │
│  Week 3 of your weekly plan      │   weekly plan line: no "Next" title on this page
│                      [Open plan] │   (only when the learner has their own plan)
│                                  │
│  (1)━━ Hangul             [Open] │   stage row, unchanged
│   ┃   4 quests played            │
│   ┃   (D)(D)(D)(D)(O)(O)(O)(O)(O)│
│   ┃   [You are here] [flag Your goal]   here, start and goal tags: at most two lines
│  (2)┄┄ Words           [A taste] │
│   ┆   (O)(O) (L)(L)(L)           │
│  (3)┄┄ Sentences · Coming later  │
│  (4)┄┄ Dialogue        [A taste] │
│  (5-7) Stages 5 to 7 · Coming later   v
│                                  │
│  What your quests practice  ...  │   unchanged (read, listen, write)
│  [star] 9   [card] 3             │   unchanged
├──────────────────────────────────┤
│ [Today] [Route] [Journey] [Library]   four tabs; Route is selected
└──────────────────────────────────┘
```

- **No dates on this screen.** There is no plan end, no "N stages to go" and no percentage. The week number appears only in the weekly plan line.
- **One Next.** The card's Next is the same quest as Home card (2) and the Results teaser (F-ENT-003 `routeNext`). The weekly plan line never names a second one.
- **The expanded stage** (`my-route-overview.md` B) adds the tag **In your plan** (F-ENT-003 `learner.routeNext.tag.inPlan`, drawn ring plus word) on cell rows whose episode holds a pending plan item:

```
│   ┃   │ Food & Daily Life      │ │
│   ┃   │ Around the Korean Table│ │
│   ┃   │ (D)(O)  Playing  [ring In your plan] │
```

## A2. The goal stage is ahead of the current stage

A class weekly plan reaches Stage 2. Now is Stage 1.

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya)                       │ │
│ │ Now   [pin]  Stage 1 · Hangul│ │
│ │ Goal  [flag] Stage 2 · Words │ │
│ │ From your class's weekly plan│ │
│ │ By the end of this stage you │ │
│ │ can: Read everyday words and │ │
│ │ know what they mean.         │ │
│ │ (O)(O)(L)(L)(L)              │ │   the goal stage's pips (Stage 2), fill only
│ │ Next: Family at the Table    │ │   Next can sit in another stage than the goal
│ │ [[        Continue        ]] │ │
│ └──────────────────────────────┘ │
```

## Interaction points (A, A2)

- [[ Continue ]] -> `QuestPlayer { questId, episodeId }` of `routeNext`'s quest. Sends `route_map.continue_tapped { stage, hero, from }` and F-ENT-003's `route.next_started { source, surface: 'route' }`.
- Route card body (not the button): not a target. Screen readers read it as one summary.
- Stage row -> expand or collapse, as in F-ROUTE-001.
- [Open plan] -> F-PLAN-002 `RouteOverview`. Shown only for the learner's own plan.
- Tab bar: Today -> Home, Journey -> the grid, Library -> the Library. Tapping Route again scrolls to the top.
- Tab focus -> `route_map.viewed { source: 'tab', goalFrom, ... }`, once per focus.

## B. New learner, no plan (default goal: Hoya's suggestion)

```
┌──────────────────────────────────┐
│  Learning Route                  │
│  Where you are and where you are │
│  going.                          │
│ ┌──────────────────────────────┐ │
│ │ (Hoya) Your Learning Route   │ │   no Now line yet: "starts here" says it
│ │        starts here.          │ │
│ │ Goal  [flag] Stage 1 · Hangul│ │
│ │       Hoya's suggestion      │ │
│ │ By the end of this stage you │ │
│ │ can: Read any Hangul ...     │ │
│ │ (O)(O)(O)(O)(O)(O)(O)(O)(O)  │ │   "Ready when you are" for screen readers
│ │ [[          Start         ]] │ │   -> QuestPlayer, first quest
│ └──────────────────────────────┘ │
│  (1)━━ Hangul             [Open] │
│   ┃   Ready when you are         │
│   ┃   ^                          │
│   ┃   (O)(O)(O)(O)(O)(O)(O)(O)(O)│
│   ┃   [You are here] [flag Your goal]
│  ...                             │
└──────────────────────────────────┘
```

Once a quest is done, the collapsed line of A appears.

## C. Goal reached (plan goal; the first time on this device)

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya, cheering) You reached │ │   Hoya line, this visit only; static when motion is reduced
│ │ your goal. Hoya is proud!    │ │
│ │ Now   [pin]  Stage 2 · Words │ │
│ │ Goal  [flag] Stage 1 · Hangul│ │
│ │       · reached              │ │
│ │ From your class's weekly plan│ │
│ │ (D)(D)(D)(D)(D)(D)(D)(D)(D)  │ │   all filled
│ │ Keep going: Lunch Box Words  │ │
│ │ [[        Continue        ]] │ │
│ └──────────────────────────────┘ │
```

- It is sent once: `route_map.goal_reached { stage, goalFrom }`.
- Later visits show the card without the Hoya line, with the plain Hoya pose.
- When the plan ends, the goal falls to the next source, or to Hoya's suggestion.

## D. Free learner past the free lessons (F-ENT-003, switch on; web only)

`routeNext` returns `free-end`: every open quest is done and lessons that are not open yet exist. Drawn by LR-5b (F-ENT-003 E3-10 is withdrawn).

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya) You played every quest│ │   F-ENT-003 learner.access.openForYou
│ │ that is open for you.        │ │
│ │ Goal  [flag] Stage 2 · Words │ │   the goal stays visible
│ │       Hoya's suggestion      │ │
│ │ [[     Practice words     ]] │ │   first free word topic in this build; else Open Library
│ └──────────────────────────────┘ │
│  (1)━━ Hangul             [Open] │
│   ┃   9 quests played            │   all of Stage 1 is free (F-ENT-003 OD-1): every pip filled
│   ┃   (D)(D)(D)(D)(D)(D)(D)(D)(D)│
│  (2)━━ Words           [A taste] │
│   ┃   (L)(L)                     │   dotted ring = "Not open yet" for these quests
│   ┃   [You are here] [flag Your goal]
```

- **Expanded stage.** A not-open cell's word is "Not open yet" (the Journey's and the Library's word). A cell with any finished quest is not marked. The legend gains a row: dotted ring, "Not open yet".
- **Tap a not-open cell row** -> `EpisodeDetail`, which F-ENT-003 shows as a preview with its own ask button. This page has no ask.
- **Never on this screen:** a price, a product name, "Premium", a buy or unlock button, an ask-a-grown-up prompt, a lock glyph.
- **"You finished your first lessons!"** is Home's and Results' once-only moment (F-ENT-003); this page never shows it.
- **Native builds** never show this screen: F-ENT-003 keeps every lesson open there until in-app purchase exists.
- **Fill-only.** A quest played before the plan lapsed stays a filled disc.
- **Mid-way** (some open quests left): the card is screen A; only the not-open pips and the legend row differ.

## E. Default goal is a taste stage (Stage 1 complete, no plan)

```
│ │ Now   [pin]  Stage 2 · Words │ │
│ │ Goal  [flag] Explore Stage 2 · Words
│ │       Hoya's suggestion      │ │
│ │ Try the first quests of this │ │   no can-do line: a taste does not teach the whole stage
│ │ stage.                       │ │
│ │ (O)(O)                       │ │
│ │ Next: Lunch Box Words        │ │
│ │ [[        Continue        ]] │ │
```

(When Now is also Stage 2, the collapsed form reads "[pin][flag] Explore Stage 2 · Words: you are in your goal stage".)

## F. End of the open road (no plan, every playable stage complete or explored)

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya) You reached the end   │ │   one sentence only (the "rest" sentence is dropped)
│ │ of the open road. More is    │ │
│ │ coming.                      │ │
│ │ [[      Open Library      ]] │ │   (Open stories when a reviewed story exists)
│ └──────────────────────────────┘ │
```

No flag on any stage.

## G. Tab bar with the flag off and on, and the two purpose lines

```
flag off (today):          [Today] [Journey] [Library]
flag on (LR-4):            [Today] [Route] [Journey] [Library]

Route header:    Learning Route / "Where you are and where you are going."
Journey header:  Heritage Journey / "Every lesson, by stage and theme."
```

- **Label.** The tab label is "Route", which fits the 12-character tab budget. The screen-reader label is "Learning Route".
- **Icon.** A drawn route glyph.
- **Fit.** At 320 there are four equal items, each one a full touch target. On a wide window the bar stays centred, as today.
- **Check.** LR-10 shows both headers to first-time readers for 5 seconds before the flag flips (LR-OD-3; alternative: the Journey tab label becomes "Lessons").

## H. Entries that open the tab (active profile)

```
Journey tab header          Home strip (R-4b)                    Level check result
┌──────────────────────┐    ┌──────────────────────────────┐     ┌────────────────────────────┐
│ Heritage Journey     │    │ Learning Route            >  │     │ Hoya found your starting   │
│ Every lesson, by     │    │ Now: Stage 1 · Hangul        │     │ spot!                      │
│ stage and theme.     │    │ Goal: Stage 1 · Hangul       │     │ [[ Start here ]]           │
│ [See Learning Route] │    │ ■ □ □ □ □ □ □  seven stages  │     │ [See Learning Route]       │
└──────────────────────┘    │ Week 3 of your weekly plan   │     └────────────────────────────┘
   -> Route tab             └──────────────────────────────┘        -> Route tab
                               -> Route tab
```

A grown-up on the in-app parent dashboard goes to the read-only page instead, always read-only, behind the gate: `parent/learning-route.md` L1.

## I. Regular, wide and landscape

- **Regular and wide.** One centred reading column, the same order as A. The route card spans the column. Pips, badges and Hoya scale with the media size; targets stay at least `touchTarget.min`.
- **Phone landscape** (short):

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Learning Route  (Hoya) [pin][flag] Stage 1 · Hangul: you are in your goal stage │
│   From your class's weekly plan  (D)(D)(D)(D)(O)(O)(O)(O)(O)  Next: Family at the Table  [[ Continue ]] │
│ (1)━ Hangul [Open]  (D)(D)(D)(D)(O)(O)(O)(O)(O)  [You are here] [flag Your goal] │
├────────────────────────────────────────────────────────────────────────────┤
│ [Today] [Route] [Journey] [Library]                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

## J. Loading, empty, error, offline

- **Loading.** None visible: the page reads only local data (snapshot, inbox copy, bundle). If the stores are still hydrating on a cold start, the trail shows its F-ROUTE-001 skeleton rows and the route card shows Hoya with no text. There is no spinner word.
- **Empty.** This is the new learner of screen B. There is never a blank page.
- **Error** (content cannot be read):

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya) Hoya could not open   │ │
│ │ your Learning Route.         │ │
│ │ [[        Try again       ]] │ │
│ └──────────────────────────────┘ │
```

- **A plan that cannot be read** (a malformed meta, already dropped by the lenient schemas): the goal falls back to Hoya's suggestion. There is no error text.
- **Offline.** The page is identical. The goal comes from the inbox copy stored on the device; access from the cached tier (F-ENT-003).

## Text alternative (screen readers)

- **Route card**, read as one summary: "Stage 1, Hangul: you are in your goal stage. From your class's weekly plan. Some quests done, more are ready. Next: Family at the Table." Then the button "Continue". (A2: "Now: Stage 1, Hangul. Goal: Stage 2, Words. ...")
- **Stage row:** "Stage 1, Hangul. Open. You are here. Your goal. 4 quests played."
- **Not-open cell row:** "New Year & Festivals: not open yet. Opens the lesson page." (F-ENT-003 `a11y.access.notOpen`).
- **Tab:** "Learning Route, tab, 2 of 4".

## Navigation graph

- **Enter from:**
  - the tab bar;
  - Journey header [See Learning Route];
  - the Home strip;
  - the level-check result [See Learning Route];
  - a back from `QuestPlayer` or `EpisodeDetail` started here.
- **Exit to:**
  - `QuestPlayer` (Continue);
  - `EpisodeDetail` (cell row; a not-open lesson opens F-ENT-003's preview page);
  - `RouteOverview` (Open plan);
  - a word topic (Practice words, free-end only);
  - Library (gains, Open Library);
  - Home, Journey and Library (tabs).

## Data needs

- **Local, read:**
  - the progress snapshot (`quests`, `stageDoneAt`, `placements`, `homework`, `selfRoute`);
  - the inbox plans with `meta` (`store/plan-store.ts`);
  - the bundle (episodes, quests);
  - `routeCatalogOf(CATALOG)`;
  - F-ENT-003: `useQuestAccess()` (`isQuestOpen`), `routeNext`, `planView`;
  - `seen` (`route-map-ui:<profileId>`).
- **Derived:** `pickGoal` (sources ranked teacher > parent > system) and `buildMyRoute` (stages, pips, goal pips, tags).
- **Local, written:** `seen.goalsReached`, active profile on the tab only, wrapped in try/catch.
- **Sent:**
  - `route_map.viewed`, `route_map.continue_tapped`, `route_map.goal_reached` (the Worker learns this name first, in LR-W1); F-ENT-003's `route.next_started` (`surface: 'route'`);
  - the summary (`summary.journey`, and `summary.routeGoal`, which only the family space receives).

## Open questions (each with the default used until answered)

| Question | Default |
|---|---|
| Name casing: "Learning Route" or "LEARNING ROUTE"? (LR-OD-1) | title case; tab "Route" |
| Tab order (LR-OD-2) | Today · Route · Journey · Library |
| How are Route and Journey told apart? (LR-OD-3) | a purpose line on each header; check in LR-10 |
| Should Continue follow the plan? (F-ENT-003 OD-7) | yes |
| Goal with no plan (LR-OD-5) | the first stage that is still open |
| Not-open shape (F-ENT-003 OD-6, LR-OD-8) | the dotted ring, no lock glyph |
| Does the "In your plan" tag help or clutter at 320 with 200 % text? | keep it; verify in the LR-10 shots, and drop the tag if it wraps to a third line |
