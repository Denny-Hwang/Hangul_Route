# Route/Overview — Your weekly plan: this week first, Move my plan along, Change, Stop (wireframe v2, promoted)

Promoted in F-PLAN-002 P2-8 from `console/curriculum-planner.md` G3 (with FP-B6, FP-B13, FP-B14, FP-B15), drawn as P2-7b shipped. This is the weekly plan; F-ROUTE-001's map of progress is `journey/my-route*.md` and `journey/learning-route.md` (E-4: the files do not collide).
Spec: `docs/specs/F-PLAN-002-curriculum-planner.md` section 3.9 (Overview, Storage), section 3.7 (re-pacing, the Hoya check-in and the P2-7b notes)
Code: `apps/mobile/src/screens/route/RouteOverviewScreen.tsx`, `screens/route/CheckInCard.tsx`, `screens/route/parts.tsx`, `logic/route/plan-view.ts`, `logic/route/repace.ts`; strings `learner.weeklyPlan.overview.*`, `learner.weeklyPlan.checkIn.*`. Behind `flags.routeEnabled`.
Audience: **any learner**. On a child profile, **Change the plan**, **Stop this plan** and the check-in are a grown-up's (the gate).
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost. Every sentence is a placeholder.

## Scenario (Given-When-Then)

Given: a learner has a weekly plan
When: they open it from the Profile row **Your weekly plan**, Home's **See my plan**, or after starting a plan
Then: they see this week's items first, can move the plan along, change it or stop it, and are never told they are behind

## Screen goal

"Show this week of the plan, and let the learner move it along without guilt."

## Box diagram

```
┌──────────────────────────────────┐
│ [<]  Your weekly plan             │
│ (Hoya) We found a path for you.   │  <- the level is never named
│ (once, after an automatic re-pace) Hoya moved your plan along.
│ ┌ Hoya check-in (week 5 only) ───┐ │  <- see below
│ └────────────────────────────────┘ │
│ This week                         │
│ ┌ Week 3  Oct 26  [Learn] ───────┐ │
│ │ Mon   <quest title>            │ │
│ │ Wed   <quest title>            │ │
│ │ Sat   <story title>            │ │
│ │ Words you can try: Food. You can skip it.   -> Library topic
│ └────────────────────────────────┘ │
│ [ Show 9 more weeks ]             │  <- later weeks folded
│ [[    Move my plan along     ]]   │  -> re-pace from today, same plan
│ [ Change the plan ]               │  -> route/setup
│ [ Stop this plan ]                │  -> one confirm
└──────────────────────────────────┘
```

Hoya check-in (start of week 5, once per plan, FP-B14):

```
┌────────────────────────────────┐
│ (Hoya) Want a lighter week?    │  or "Want to go a bit faster?"
│ Gentle: 2 days a week.         │
│ [[ Yes, lighter ]]  [ Not now ] │
└────────────────────────────────┘
```

Stop confirm (replaces the stop link):

```
┌────────────────────────────────┐
│ Stop this plan? Everything you finished stays yours.
│ [ Yes, stop it ]  [ Keep my plan ] │
└────────────────────────────────┘
```

- Never the words behind, late, missed, overdue; no counts of skipped days, no percent, no "x / y".
- After **Move my plan along**: "Your plan moved along. It starts again from today." When new lessons joined the catalogue: "New lessons are here. Move your plan along to add them."
- The check-in never names a missed session; a yes keeps every lesson (a lighter pace adds weeks; when even that cannot hold every item, the check-in is not offered). After a yes: "Your plan now has 2 days a week."

## Interaction points

- Show N more weeks / Hide the next weeks -> folds the weeks after this one (only this week shows by default: the seven-day rule of the beta check).
- A word topic line -> the Library topic (when F-VOC ships).
- **Move my plan along** -> `repaceSelfRoute` (`requeue`): pending past items to the head, the rest re-laid from today; same plan id; `route.repaced` (`mode: manual`).
- **Change the plan** -> `route/setup` step 1 (gate first on a child profile).
- **Stop this plan** -> the confirm; **Yes, stop it** archives the plan (history stays, pending plan items leave the lists); **Keep my plan** closes the confirm. Gate first on a child profile.
- Check-in **Yes** -> `regenerateFrom(..., 'shift')` at the new pace; **Not now** -> closed for this plan (`route-ui:<profileId>.checkInFor`).
- [<] -> where it came from.

## Navigation graph

Enter from: `profile/settings` (**Your weekly plan**) · `home/todays-mission` (**See my plan** under "Hoya moved your plan along") · `route/setup` / `route/proposal` (after Start this plan)
Exit to: `route/setup` · `route/proposal` (**Make a new plan**) · `vocab/topic-detail` · `parent/gate` (child profile) · back

## States

- **success**: as drawn.
- **not started yet**: "Your first week" and "Your plan starts on Oct 19." instead of This week.
- **nothing this week** (a review or days-off week): "Nothing is planned this week. Play anything you like."
- **finished**: "You came to the end of your plan. Well done!" and **Make a new plan**.
- **no plan** (stopped, or none yet): "You have no weekly plan right now." with **Make a weekly plan** and **Back**.
- **error**: a write fails -> "That did not work. Try again." under the buttons; nothing is lost.
- **offline**: identical; an automatic re-pace runs on the device copy when the sync does not get through (section 3.7 notes).
- **small phone (320 px)**: week cards and buttons stack full width; P2-8 checks es and ko with no control past the edge.

## Data needs

- reads: `snapshot.selfRoute` (items, meta, `repacedAt`, `archivedAt`), finished quests, today's date key, `route-ui:<profileId>` (check-in answered, moved line seen), the gate state
- writes: `selfRoute` (re-pace, pace change, archive), derived `snapshot.homework`, `route-ui:<profileId>`
- telemetry: `route.repaced` (`mode: manual | auto`, `pending`); a check-in yes and a stop send no event of their own (P2-7b)

## Open questions

- **Owner item (section 3.7 notes, blocks the production flip):** may a child answer the Hoya check-in alone? Until it is decided, the check-in shows on a child profile only while plan changes are open (`planChangesOpen`, the gate), and `flags.routeEnabled` stays off in production.
- The "answered once" mark is per device, so a second device can ask once more (accepted limit).
