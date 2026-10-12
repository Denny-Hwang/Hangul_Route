# Learning Route for parents: a child's road, read only (wireframe v2)

Specs:
- `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md` sections 6.1 (report goal line and stage list), 6.2 (local read-only), 4.1 (goal), 9 (`summary.routeGoal`)
- `docs/specs/F-ROUTE-001-my-route-overview.md` section 3.12 (grown-up views)
- per-learner report: F-REPORT-001 (`reports/learner-report.md`, "At a glance"); family home card and URL space: F-APP-001 (`shell/parent-home.md`); "Preview lessons": F-BROWSE-001 (BR-11, BR-12a)

Builds on:
- `design/wireframes/journey/my-route-overview.md` C7 (read-only page) and H (dashboard row);
- `design/wireframes/journey/learning-route.md` (route card).

Audience: a parent or other caregiver.
- **L1 (local):** on the child's device, behind the grown-up gate, from the in-app parent dashboard.
- **R (report goal line) and L2 (stage list):** signed in, in the adult shell on app.hangulroute.com (F-APP-001), on any device.

Copy is written **about** the child, in the third person, from their name. It may address the parent directly. "Weekly plan" names every dated curriculum plan; "family plan" is never used here (it names the paid product).

Code (planned):
- **L1:** `screens/my-route/MyRouteScreen.tsx` on the root stack, `MyRoute { profileId, viewer: 'grownup' }`, always read-only; `RouteCard.tsx` with `viewer: 'grownup'`.
- **R and L2:**
  - `apps/web/src/lib/console/learning-route-view.ts`;
  - the goal line under the report's "Now on Stage" line (F-REPORT-001 RP-7a2 or LR-8, whichever lands second);
  - the page `LearningRoutePage` with the grown-up route card, served at `/parent/space/route` (family) and `/teach/space/route` (class), behind `learningRouteEnabled()`;
  - the path `ROUTES.learnerRoute(spaceId, learnerId, kind?)`.

Notation: `[[ X ]]` is the one primary action, `[ X ]` is secondary, and `[pin]` and `[flag]` are drawn glyphs. `{{ Preview lessons }}` is a slot that F-BROWSE-001 renders; this spec renders nothing there. Every sentence is a placeholder; final strings are in the dictionary.

---

## Scenario (Given-When-Then)

Given: a parent wants to know how their child is moving through Hangul and what each stage teaches.
When: they open their child's report or the card's "Learning Route" link on the family home (F-APP-001), or "See Learning Route" from the in-app dashboard (L1).
Then: at the top of the report they see where the child is now and the goal the child's own device shows; one link opens every stage of the road with who set the goal and what each stage builds. They cannot change anything, play as the child, or see any other child's position.

## Screen goal

"Understand, in one look, where my child is, where they are heading, and what each stage teaches."

There is no primary action that changes data. L1's only action is "back". R is two lines and one link (F-REPORT-001's). L2 has "back" and, per stage, F-BROWSE-001's slot.

---

## L1. Local read-only page (on the child's device, gate open)

The same page as the learner's, with no button, in the third person, always read-only (also when the child is the device's active profile). It shows pips and skills because the full snapshot is on this device, and the goal is the device's own, so it may say "Goal".

```
┌──────────────────────────────────┐
│ [<]  Learning Route              │   root-stack screen (not the tab), back to the dashboard
│  Viewing Sam's Learning Route    │
│ ┌──────────────────────────────┐ │
│ │ [pin][flag] Stage 1 · Hangul:│ │   collapsed line (goal = now)
│ │ Sam is in the goal stage     │ │
│ │ From the family's weekly plan│ │
│ │ Plan ends Dec 20             │ │   grown-up only: the plan end date (never "late")
│ │ By the end of this stage,    │ │
│ │ Sam can: Read any Hangul ... │ │
│ │ (D)(D)(D)(D)(O)(O)(O)(O)(O)  │ │   goal pips, fill only
│ │ Next: Family at the Table    │ │   text only, no button
│ └──────────────────────────────┘ │
│  (1)━━ Hangul             [Open] │
│   ┃   4 quests played            │
│   ┃   (D)(D)(D)(D)(O)(O)(O)(O)(O)│
│   ┃   [Sam is here] [flag Sam's goal]
│   ┃   {{ Preview lessons }}      │   F-BROWSE-001 BR-12a, web only
│  ...                             │
│  What Sam's quests practice ...  │   unchanged (C7), with the skills note
└──────────────────────────────────┘
```

- **Gate closed:** `PinEntry` opens instead. After the PIN, it returns here.
- **Quiet page:** no telemetry, no `seen` write, no "goal reached" line, no free-end hero, no Ask a grown-up.

## L1a. Dashboard row (R-9b, renamed, with a goal line)

```
│ Learning Route                           │
│ ■ □ □ □ □ □ □   (7 drawn segments)       │
│ Now: Stage 1 · Hangul                    │
│ Goal: Stage 1 · Hangul                   │   from pickGoal over the local model
│ From the family's weekly plan            │
│ Started: Stage 1 · Letters and sounds · Oct 9
│ Read (D)(D)(D)  Listen (D)(D)(D)  Write (D)
│ [ See Learning Route ]                   │   -> L1 (MyRoute { profileId, viewer: 'grownup' })
```

## R. The goal line in the report's "At a glance" (signed in)

F-REPORT-001 keeps "At a glance" short (layer 1, above the fold at 390 x 844). This amendment adds one line under its "Now on Stage" line; F-REPORT-001's own link opens L2.

```
┌──────────────────────────────────────────┐
│ Sam · Report                             │   F-REPORT-001 h1
│ Now on Stage 1: Hangul                   │   F-REPORT-001 report.glance.nowOn
│ Sam's goal: Stage 2 · Words              │   THIS amendment's goal line (case 1 below)
│ [ Open Learning Route ]                  │   F-REPORT-001 report.glance.openRoute -> L2
│ Last practice: Monday                    │   F-REPORT-001
│ (period tabs, headline, ...)             │
```

**Goal line by case** (amendment section 6.1):

| Case | When | Goal line | Source / extra |
|---|---|---|---|
| 1 | `summary.routeGoal` present (newest app on Sam's device) | "Sam's goal: Stage {n} · {title}" | "From the class's weekly plan" / "From the school's weekly plan" / "From your family's weekly plan" / "From Sam's own weekly plan" / "Hoya's suggestion: the next open stage"; plan end when the source is the family or Sam's own plan |
| 2 | no `routeGoal`, the family has a live weekly plan for Sam | "Your family's weekly plan reaches Stage {n} · {title}" | "Plan ends {date}"; "Sam reached this stage." when reached |
| 3 | neither | "Next open stage: Stage {n} · {title}" | — |

Cases 2 and 3 never say "Sam's goal": the page does not know it.

## L2. Stage list page (`/parent/space/route?id=&learner=`), with the full grown-up route card

Built only from what the family space already receives: `summary.journey`, `summary.placement`, `summary.routeGoal`, `summary.selfRoute` and the family's own published plans. No pips (no per-quest data leaves the device), no skills (they stay on the device).

```
┌──────────────────────────────────────────┐
│ [< Back to the report]                   │
│ Sam's Learning Route                     │   h1; the name is from the roster, never from the URL
│ Updated Oct 11                           │   from lastSyncedAt
│ ┌──────────────────────────────────────┐ │
│ │ Now   [pin]  Sam is on Stage 1:      │ │
│ │              Hangul.                 │ │
│ │ Sam's goal: Stage 2 · Words          │ │   case 1: summary.routeGoal (the goal Sam's device shows)
│ │ From the class's weekly plan         │ │
│ │ Your family's weekly plan reaches    │ │   only when the family plan is not the leading one
│ │ Stage 1 · Hangul. Plan ends Dec 20   │ │
│ │ By the end of this stage, Sam can:   │ │
│ │ Read everyday words and know what    │ │
│ │ they mean.                           │ │
│ └──────────────────────────────────────┘ │
│ Stages                                   │   an ordered list
│  1. Hangul · Open                        │
│     Read any Hangul letter and syllable  │   the stage's can-do line
│     and know its sound.                  │
│     4 known from the level check,        │   zero parts left out; never "of N"
│     2 quests done                        │
│     [Sam is here] [Sam started here]     │
│     {{ Preview lessons }}                │   F-BROWSE-001 renders it; nothing until then
│  2. Words · A taste                      │
│     Read everyday words and know what    │
│     they mean.                           │   no count line: nothing done yet (never "0")
│     [flag Sam's goal]                    │
│     {{ Preview lessons }}                │
│  3. Sentences · Coming later             │
│  4. Dialogue · A taste                   │
│     Follow a short greeting conversation │
│     and pick a reply.                    │
│     {{ Preview lessons }}                │
│  5 to 7. Coming later                    │   merged run
└──────────────────────────────────────────┘
```

- **Never on this page:**
  - another child's position;
  - a family average;
  - "ahead" or "behind";
  - a percentage, "N / M" or a zero count;
  - a speaking line;
  - a price, a product name, a billing link or a free-lessons line (F-ENT-003 shows that on the family home card and the report).

## Interaction points

- R [ Open Learning Route ] (F-REPORT-001's link) and the family home card's ( Learning Route ) (F-APP-001's link) -> L2 (`ROUTES.learnerRoute(familyId, learnerId, 'family')`).
- L2 [< Back to the report] -> the learner report (F-REPORT-001); until that page exists, the family home.
- L2 stage rows are text. `{{ Preview lessons }}` -> F-BROWSE-001 (`buildBrowseUrl({ kind: 'stage', stage })`, `source: 'route'`), only when F-BROWSE-001 renders it (BR-11).
- L1 [<] -> the in-app parent dashboard.

## Navigation graph

- **Enter from:**
  - L1: in-app parent dashboard [See Learning Route], through `PinEntry` when the gate is closed.
  - R: the per-learner report, reached from the family home card **See report** (F-APP-001).
  - L2: R [ Open Learning Route ], or the family home card ( Learning Route ). No roster-card button.
- **Exit to:**
  - back (the dashboard, or the report);
  - F-BROWSE-001's lesson browser (its slot, when present).

## Data needs

- **L1:** the local snapshot, the bundle, the catalogue and the inbox plans, as for the learner. Nothing is written.
- **R and L2:** the existing requests only.
  - `GET /api/spaces/:id/roster`: the learner row with `summary.journey`, `summary.placement`, `summary.routeGoal`, `summary.selfRoute` and `lastSyncedAt`.
  - `GET /api/spaces/:id/plans`: this family's plans; only published, unarchived plans that target Sam count.
  - Ids come from the query (`?id=&learner=`). No new endpoint, no entitlements call, no read of the full progress record.

## States

- **Loading (L2):** the header and three placeholder rows, with an `aria-busy` region and no text. On the report, the card follows the report's loading state.
- **Not synced yet:** "The Learning Route appears after Sam's next sync on the newest app." The stage list is hidden. This is never worded as "no progress".
- **Older app on another device** (no `routeGoal` in the latest summary): cases 2 or 3, no error text.
- **Learner not in this space** (old link, removed learner): "We could not find this learner in this space." with [< Back to the family].
- **Cannot reach the server:** the existing console wording with [Try again].
- **No goal** (end of the open road): "Sam reached the end of the open road. More is coming."

## Open questions (each with the default used until answered)

| Question | Default |
|---|---|
| Should free accounts see these views too? (LR-OD-9) | yes, every adult who can open the roster |
| Show the plan end date? (LR-OD-7) | yes, on grown-up views only |
| A line about lessons that open with the full route? (LR-OD-8) | no line on grown-up views |
| Does the parent see the goal Sam's device shows? (LR-OD-12) | yes, through `summary.routeGoal` (family only) |
