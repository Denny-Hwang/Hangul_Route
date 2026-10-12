# Learning Route for parents: a child's road, read only (wireframe v1)

Specs:
- `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md` sections 6.1 (summary page), 6.2 (local read-only) and 4.1 (goal)
- `docs/specs/F-ROUTE-001-my-route-overview.md` section 3.12 (grown-up views)
- parent home: F-APP-001 (persona homes)

Builds on:
- `design/wireframes/journey/my-route-overview.md` C7 (read-only page) and H (dashboard row);
- `design/wireframes/journey/learning-route.md` (route card).

Audience: a parent or other caregiver.
- **L1 (local):** on the child's device, behind the grown-up gate.
- **L2 (signed in):** in the adult shell on app.hangulroute.com (F-APP-001), on any device.

Copy is written **about** the child, in the third person, from their name. It may address the parent directly.

Code (planned):
- **L1:** `screens/my-route/MyRouteScreen.tsx` read-only and `RouteCard.tsx` with `viewer: 'grownup'`.
- **L2:**
  - `apps/web/src/lib/console/learning-route-view.ts`;
  - the page `apps/web/src/app/(console)/teach/space/route/page.tsx`;
  - the path `ROUTES.learnerRoute(spaceId, learnerId)`.
  - The host path moves with the console when F-APP-001 lands.

Notation: `[[ X ]]` is the one primary action, `[ X ]` is secondary, and `[pin]` and `[flag]` are drawn glyphs. Every sentence is a placeholder; final strings are in the dictionary.

---

## Scenario (Given-When-Then)

Given: a parent wants to know how their child is moving through Hangul.
When: they open "See Learning Route" from the in-app dashboard (L1), or "Learning Route" from the child's card on their parent home (L2).
Then: they see where the child is now, what goal the child is heading to and who set it, and each stage of the road. They cannot change anything, play as the child, or see any other child's position.

## Screen goal

"Understand, in one look, where my child is and where they are heading."

There is no primary action that changes data. L1's only action is "back". L2 has "back" plus, for the space owner of a free and uncovered learner, one neutral link to plans.

---

## L1. Local read-only page (on the child's device, gate open)

The same page as the learner's, with no button, in the third person. It shows pips and skills because the full snapshot is on this device.

```
┌──────────────────────────────────┐
│ [<]  Learning Route              │   root-stack screen (not the tab), back to the dashboard
│  Viewing Sam's Learning Route    │
│ ┌──────────────────────────────┐ │
│ │ Now   [pin]  Sam is on Stage │ │
│ │              1: Hangul.      │ │
│ │ Goal  [flag] Stage 1 · Hangul│ │
│ │       From the family plan   │ │
│ │       Plan ends Dec 20       │ │   grown-up only: the plan end date (never "late")
│ │ By the end of this stage,    │ │
│ │ Sam can: read any Hangul ... │ │
│ │ Next: Family at the Table    │ │   text only, no button
│ └──────────────────────────────┘ │
│  (1)━━ Hangul             [Open] │
│   ┃   4 quests played            │
│   ┃   (D)(D)(D)(D)(O)(O)(O)(O)   │
│   ┃   [Sam is here] [flag Sam's goal]
│  ...                             │
│  What Sam's quests practice ...  │   unchanged (C7), with the skills note
└──────────────────────────────────┘
```

- **Gate closed:** `PinEntry` opens instead. After the PIN, it returns here.
- **Quiet page:** no telemetry, no `seen` write, and no "goal reached" line.

## L1a. Dashboard row (R-9b, renamed, with a goal line)

```
│ Learning Route                           │
│ ■ □ □ □ □ □ □   (7 drawn segments)       │
│ Now: Stage 1 · Hangul                    │
│ Goal: Stage 1 · Hangul (family plan)     │   from pickGoal over the local model
│ Started: Stage 1 · Letters and sounds · Oct 9
│ Read (D)(D)(D)  Listen (D)(D)(D)  Write (D)
│ [ See Learning Route ]                   │   -> L1
```

## L2. Signed-in summary page (adult shell, any device)

It is built only from what the family space already receives: `summary.journey`, `summary.selfRoute` and `summary.placement` for the stage of the start, plus the space's own plans. It has no pips (no per-quest data leaves the device) and no skills (they stay on the device).

```
┌──────────────────────────────────────────┐
│ [< Back to the family]                   │
│ Sam's Learning Route                     │   h1; the name is from the roster, never from the URL
│ Updated Oct 11                           │   from lastSyncedAt
│ ┌──────────────────────────────────────┐ │
│ │ Now   [pin]  Sam is on Stage 1:      │ │
│ │              Hangul.                 │ │
│ │ Goal  [flag] Stage 1 · Hangul        │ │
│ │       From your family plan          │ │   own space's curriculum plan first
│ │       Plan ends Dec 20               │ │
│ │ By the end of this stage, Sam can:   │ │
│ │ read any Hangul letter and syllable  │ │
│ │ and know its sound.                  │ │
│ └──────────────────────────────────────┘ │
│ Stages                                   │   an ordered list
│  1. Hangul · Open                        │
│     4 known from the level check,        │   the known part only when > 0; never "of N"
│     2 quests done                        │
│     [Sam is here] [flag Goal] [Sam started here]
│  2. Words · Open                         │
│     0 quests done                        │
│  3. Sentences · Coming later             │
│  4. Dialogue · Open                      │
│     0 quests done                        │
│  5 to 7. Coming later                    │   merged run
│                                          │
│ Some quests open with a plan. [See plans]│   ONLY for the space owner, learner free and not covered (LR-OD-8)
└──────────────────────────────────────────┘
```

- **Where the goal comes from, in order:**
  1. this family space's own active curriculum plan for Sam;
  2. Sam's own weekly plan (`selfRoute.goalStage`, which only a family space receives), labelled "From Sam's weekly plan";
  3. "Hoya's suggestion", the first stage that is still open.

  A class plan from Sam's school is never read here.
- **Goal reached:** "Sam reached the goal: Stage 1 · Hangul."
- **Never on this page:**
  - another child's position;
  - a family average;
  - "ahead" or "behind";
  - a percentage or "N / M";
  - a speaking line;
  - a price.

## Interaction points

- [< Back to the family] -> the family space's page, or the parent home (F-APP-001).
- [See plans] -> Billing in the adult shell (owner items 8 and 12). Shown to the space owner only.
- Stage rows are text and not buttons. Episode detail is the browse spec's job (owner item 14), not this page's.
- L1 [<] -> the in-app parent dashboard.

## Navigation graph

- **Enter from:**
  - L1: in-app parent dashboard [See Learning Route], through `PinEntry` when the gate is closed.
  - L2: the child card on the parent home (F-APP-001), the family roster card [Open Learning Route], and the per-child report page (progress-reports spec).
- **Exit to:**
  - back (the dashboard, or the family page or parent home);
  - Billing ([See plans], owner only).

## Data needs

- **L1:** the local snapshot, the bundle, the catalogue and the inbox plans, as for the learner. Nothing is written.
- **L2:** the existing requests only.
  - `GET /api/spaces/:id/roster`: the learner row with `summary.journey`, `summary.selfRoute`, `summary.placement` and `lastSyncedAt`.
  - `GET /api/spaces/:id/plans`: this space's plans.
  - `GET /api/entitlements`, only to decide the owner line.
  - Ids come from the query (`?id=&learner=`). No new endpoint, no read of the full progress record.

## States

- **Loading (L2):** the header and three placeholder rows, with an `aria-busy` region and no text.
- **Not synced yet:** "The Learning Route appears after Sam's next sync on the newest app." The stage list is hidden. This is never worded as "no progress".
- **Learner not in this space** (old link, removed learner): "We could not find this learner in this space." with [< Back to the family].
- **Cannot reach the server:** the existing console wording with [Try again].
- **No goal** (end of the open road): the Goal line reads "Sam reached the end of the open road. More is coming."

## Open questions (each with the default used until answered)

| Question | Default |
|---|---|
| Should free accounts see this page too? (LR-OD-9) | yes, every adult linked to the space |
| Show the plan end date? (LR-OD-7) | yes, on grown-up views only |
| Show the "Some quests open with a plan" line? (LR-OD-8) | yes, for the space owner only, with no price |
