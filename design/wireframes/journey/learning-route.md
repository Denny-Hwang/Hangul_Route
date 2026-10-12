# Learning Route: the learner's Route tab, with where you are and where you are going (wireframe v1)

Specs:
- `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md`: section 4 (goal and next), section 5 (tab and entries), section 7 (name).
- `docs/specs/F-ROUTE-001-my-route-overview.md`: sections 3.3 to 3.11, the trail, pips, skills and gains, which are unchanged.

Builds on: `design/wireframes/journey/my-route-overview.md`. Screens A to G and L of that file stay valid for the trail, the pips, the expanded stage, the skills and the gains. This file draws only what changes:
- the tab;
- the route card that replaces the hero;
- the goal tag;
- the not-open pips;
- the new states.

Audience: the learner, at any age. The page works for a child alone (big targets, short words) and for an adult (quiet, no baby talk). There are no grown-up controls on this screen.

Code (planned):
- `navigation/tabs.tsx` (Route tab), `navigation/types.ts` (`MainTabParamList.Route`)
- `screens/my-route/MyRouteScreen.tsx` (`variant: 'tab'`), `screens/my-route/RouteCard.tsx`
- `logic/my-route/next.ts`, `packages/content-schema/src/route/goal.ts`

Notation:
- `[[ X ]]` is the one primary action. `[ X ]` is secondary.
- `[pin]` and `[flag]` stand for drawn `Icon` glyphs, never characters.
- Pip letters follow the legend of `my-route-overview.md`: `(D)` done, `(O)` open, `(L)` later or not open, `^` next.

Every sentence below is a placeholder; the final strings are in the dictionary. No colours, fonts or pixel sizes.

**Owner decisions in force:**
- reading, listening and writing only, with no speaking anywhere (2026-10-10);
- the page is named LEARNING ROUTE (2026-10-11).

---

## Scenario (Given-When-Then)

Given: a learner, on a phone, tablet or laptop, with or without a weekly plan from their class, family or themselves.
When: they tap the Route tab, or a "See Learning Route" link.
Then: at the top they see where they are now and where they are going (the goal), with one button for the next step. Below that they see the whole road of seven stages, with the goal stage marked. There are no dates, no countdown and no comparison with anyone.

## Screen goal

"See where I am and where I am going in one look, and take the next step in one tap."

(One primary goal. The secondary goal, opening a stage to look inside, is unchanged from `my-route-overview.md` B.)

---

## A. Route tab, phone, mid-progress, following a class plan (compact, 320 to 599)

Today's bundle. The class curriculum plan reaches Stage 1. Done: `letters-q1..q3` and `life-q1`. The plan's next item is `life-q2`.

```
┌──────────────────────────────────┐
│  Learning Route                  │   tab root: no back button; title = the name
│ ┌──────────────────────────────┐ │   ROUTE CARD (replaces the hero): Hoya + Now + Goal + Next + ONE action
│ │ (Hoya)                       │ │
│ │ Now   [pin]  Stage 1 · Hangul│ │
│ │ Goal  [flag] Stage 1 · Hangul│ │
│ │       From your class plan   │ │   source line: class / school / family / weekly plan / Hoya's suggestion
│ │ By the end you can: read any │ │   the goal stage's can-do line (no number, no target)
│ │ Hangul letter and syllable   │ │
│ │ and know its sound.          │ │
│ │ Next: Family at the Table    │ │
│ │ [[        Continue        ]] │ │   -> QuestPlayer for the plan's next quest
│ └──────────────────────────────┘ │
│  Week 3 · Next in your weekly    │   weekly plan line (F-ROUTE-001 3.9), only for the learner's own plan
│  plan: ...           [Open plan] │
│                                  │
│  (1)━━ Hangul             [Open] │   stage row, unchanged
│   ┃   4 quests played            │
│   ┃          ^                   │   ONE next marker, on the plan's next quest
│   ┃   (D)(D)(D)(D)(O)(O)(O)(O)   │
│   ┃   [You are here] [flag Your goal]   tags: here, start, goal can share a row
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
- **Goal equals Now.** When they are the same stage, both lines show. The pin and the flag tell them apart, not a ratio.
- **The expanded stage** (`my-route-overview.md` B) adds the tag **In your plan** on cell rows whose episode holds a plan item:

```
│   ┃   │ Food & Daily Life      │ │
│   ┃   │ Around the Korean Table│ │
│   ┃   │ (D)(O)  Playing  [In your plan] │
```

## Interaction points (A)

- [[ Continue ]] -> `QuestPlayer { questId, episodeId }` of `next` (the plan's next quest; with no plan, the cursor). Sends `route_map.continue_tapped { stage, hero, from }`.
- Route card body (not the button): not a target. Screen readers read it as one summary.
- Stage row -> expand or collapse, as in F-ROUTE-001.
- [Open plan] -> F-PLAN-002 `RouteOverview`. Shown only for the learner's own plan.
- Tab bar: Today -> Home, Journey -> the grid, Library -> the Library. Tapping Route again scrolls to the top.
- Tab focus -> `route_map.viewed { source: 'tab', goalFrom, ... }`, once per focus.

## B. New learner, no plan (default goal: Hoya's suggestion)

```
┌──────────────────────────────────┐
│  Learning Route                  │
│ ┌──────────────────────────────┐ │
│ │ (Hoya) Your Learning Route   │ │
│ │        starts here.          │ │
│ │ Goal  [flag] Stage 1 · Hangul│ │
│ │       Hoya's suggestion      │ │
│ │ By the end you can: read any │ │
│ │ Hangul letter ...            │ │
│ │ [[          Start         ]] │ │   -> QuestPlayer, first quest
│ └──────────────────────────────┘ │
│  (1)━━ Hangul             [Open] │
│   ┃   Ready when you are         │
│   ┃   ^                          │
│   ┃   (O)(O)(O)(O)(O)(O)(O)(O)   │
│   ┃   [You are here] [flag Your goal]
│  ...                             │
└──────────────────────────────────┘
```

Without a "Now" line: "starts here" says it already. Once a quest is done, the Now line appears.

## C. Goal reached (plan goal; the first time on this device)

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya, cheering)             │ │
│ │ Now   [pin]  Stage 2 · Words │ │
│ │ You reached your goal:       │ │
│ │ [flag] Stage 1 · Hangul      │ │
│ │       From your class plan   │ │
│ │ Keep going: Lunch Box Words  │ │
│ │ [[        Continue        ]] │ │
│ └──────────────────────────────┘ │
│  You reached your goal. Hoya is proud!     one line, once per goal per device; no animation when motion is reduced
```

- It is sent once: `route_map.goal_reached { stage, goalFrom }`.
- Later visits show the card without the extra line.
- When the plan ends, the goal falls to the next source, or to Hoya's suggestion.

## D. Free learner past the free allowance (F-ENT-003; nothing is shown about payment)

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya) You played every quest│ │   'openForYou' wording, only when the open quests are all done
│ │ that is open for you. Play a │ │
│ │ favorite again or read a     │ │
│ │ story.                       │ │
│ │ Goal  [flag] Stage 1 · Hangul│ │
│ │       Hoya's suggestion      │ │
│ │ [[      Open Library      ]] │ │   (Open stories when a reviewed story exists)
│ └──────────────────────────────┘ │
│  (1)━━ Hangul             [Open] │
│   ┃   3 quests played            │
│   ┃   (D)(D)(D)(L)(L)(L)(L)(L)   │   dotted = "Not open yet" for these quests
│   ┃   [You are here] [flag Your goal]
```

- **Expanded stage.** The cell word is "Not open yet". The legend gains a row: dotted ring, "Not open yet".
- **Never on this screen:** a lock, "Premium", a price, a buy or unlock button, or "ask a grown-up".
- **Fill-only.** A quest played before the plan lapsed stays a filled disc.

## E. Default goal is a taste stage (Stage 1 complete, no plan)

```
│ │ Now   [pin]  Stage 2 · Words │ │
│ │ Goal  [flag] Explore Stage 2 · Words
│ │       Hoya's suggestion      │ │
│ │ Try the first quests of this │ │   no can-do line: a taste does not teach the whole stage
│ │ stage.                       │ │
│ │ Next: Lunch Box Words        │ │
│ │ [[        Continue        ]] │ │
```

## F. End of the open road (no plan, every playable stage complete or explored)

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya) You did everything    │ │   F-ROUTE-001 'rest' wording
│ │ that is open right now. More │ │
│ │ is coming.                   │ │
│ │ You reached the end of the   │ │   replaces the Goal line; no flag on any stage
│ │ open road. More is coming.   │ │
│ │ [[      Open Library      ]] │ │
│ └──────────────────────────────┘ │
```

## G. Tab bar with the flag off and on

```
flag off (today):          [Today] [Journey] [Library]
flag on (LR-4):            [Today] [Route] [Journey] [Library]
```

- **Label.** The tab label is "Route", which fits the 12-character tab budget. The screen-reader label is "Learning Route".
- **Icon.** A drawn route glyph.
- **Fit.** At 320 there are four equal items, each one a full touch target. On a wide window the bar stays centred, as today.

## H. Entries that open the tab (active profile)

```
Journey tab header          Home strip (R-4b)                    Level check result
┌──────────────────────┐    ┌──────────────────────────────┐     ┌────────────────────────────┐
│ Heritage Journey     │    │ Learning Route            >  │     │ Hoya found your starting   │
│ 7 stages x 5 themes. │    │ Now: Stage 1 · Hangul        │     │ spot!                      │
│ [See Learning Route] │    │ Goal: Stage 1 · Hangul       │     │ [[ Start here ]]           │
└──────────────────────┘    │ ■ □ □ □ □ □ □  seven stages  │     │ [See your Learning Route]  │
   -> Route tab             │ Week 3 of your weekly plan   │     └────────────────────────────┘
                            └──────────────────────────────┘        -> Route tab
                               -> Route tab
```

A grown-up opening **another** profile goes to the read-only page instead. That is `parent/learning-route.md` L1, behind the gate.

## I. Regular, wide and landscape

- **Regular and wide.** One centred reading column, the same order as A. The route card spans the column. Pips, badges and Hoya scale with the media size; targets stay at least `touchTarget.min`.
- **Phone landscape** (short):

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Learning Route   (Hoya) Now [pin] Stage 1 · Hangul   Goal [flag] Stage 1 · Hangul │
│                  From your class plan   Next: Family at the Table  [[ Continue ]] │
│ (1)━ Hangul [Open]  (D)(D)(D)(D)(O)(O)(O)(O)  [You are here] [flag Your goal]     │
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
- **Offline.** The page is identical. The goal comes from the inbox copy stored on the device.

## Text alternative (screen readers)

- **Route card**, read as one summary: "Now: Stage 1, Hangul. Goal: Stage 1, Hangul. From your class plan. Next: Family at the Table." Then the button "Continue".
- **Stage row:** "Stage 1, Hangul. Open. You are here. Your goal. 4 quests played."
- **Tab:** "Learning Route, tab, 2 of 4".

## Navigation graph

- **Enter from:**
  - the tab bar;
  - Journey header [See Learning Route];
  - the Home strip;
  - the level-check result [See your Learning Route];
  - a back from `QuestPlayer` or `EpisodeDetail` started here.
- **Exit to:**
  - `QuestPlayer` (Continue);
  - `EpisodeDetail` (cell row);
  - `RouteOverview` (Open plan);
  - Library (gains, Open Library);
  - Home, Journey and Library (tabs).

## Data needs

- **Local, read:**
  - the progress snapshot (`quests`, `stageDoneAt`, `placements`, `homework`, `selfRoute`);
  - the inbox plans with `meta` (`store/plan-store.ts`);
  - the bundle (episodes, quests);
  - `routeCatalogOf(CATALOG)`;
  - `isQuestOpen` (F-ENT-003; default: every playable quest is open);
  - `seen` (`route-map-ui:<profileId>`).
- **Derived:** `pickGoal` (sources ranked teacher > parent > system), `routeNext`, and `buildMyRoute` (stages, pips, tags).
- **Local, written:** `seen.goalsReached`, active profile only, wrapped in try/catch.
- **Sent:**
  - `route_map.viewed`, `route_map.continue_tapped`, and `route_map.goal_reached` (the Worker learns this name first, in LR-W1);
  - the summary (`summary.journey`, and `selfRoute.goalStage` for the family space only).

## Open questions (each with the default used until answered)

| Question | Default |
|---|---|
| Name casing: "Learning Route" or "LEARNING ROUTE"? (LR-OD-1) | title case; tab "Route" |
| Tab order (LR-OD-2) | Today · Route · Journey · Library |
| Should Continue follow the plan? (LR-OD-6) | yes |
| Goal with no plan (LR-OD-5) | the first stage that is still open |
| Does the "In your plan" tag help or clutter at 320 with 200 % text? | keep it; verify in the LR-5 e2e shots, and drop the tag if it wraps to a third line |
