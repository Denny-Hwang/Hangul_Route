# Route/Proposal — the one-tap weekly plan Hoya suggests (wireframe v2, promoted)

Promoted in F-PLAN-002 P2-8 from `journey/my-route-overview.md` K1 and K3 (FP-B1, FP-B6), with what P2-7a and P2-7b shipped. That file keeps the drawing of the grown-up variant (K2), which belongs to the console wizard (`console/curriculum-wizard.md` B).
Spec: `docs/specs/F-PLAN-002-curriculum-planner.md` section 3.9 (Proposal), section 3.10 (precedence) · `docs/specs/AMENDMENTS-PLC-PLAN-HANDOFF.md` FP-B1, FP-B6, AM-6 (eligibility and dismissal) · F-PLC-001 AM-1 / AM-5 (the result strip and the report card that open it)
Code: `apps/mobile/src/screens/route/RouteProposalScreen.tsx`, `screens/route/PlanPromptCard.tsx` (the Home prompt), `logic/route/proposal-flow.ts`, `proposeRoute` (`packages/content-schema/src/curriculum/propose.ts`); strings `learner.weeklyPlan.proposal.*`. Behind `flags.routeEnabled`.
Audience: **any learner** (self profile directly; a child profile through the grown-up gate). No Premium, price or level word on this screen.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `(o)` / `( )` a radio, `[x]` a checkbox, `v` a disclosure. Every sentence is a placeholder; the final words are in the dictionary.

## Scenario (Given-When-Then)

Given: a learner has finished a quest (or the level check) and has no weekly plan yet
When: they tap **Make my plan** on Home, the Profile row **Make a weekly plan**, the result strip or the report card
Then: Hoya shows one ready plan they can start with one tap, or change the pace, the length and the start day first

## Screen goal

"Start a weekly plan with one tap, with every choice already made and changeable."

## Box diagram

```
┌──────────────────────────────────┐
│ [<]  Your weekly plan             │  <- title; back = Not now
│ (Hoya) Hoya made a weekly plan for you.
│ (one line, only with a class or home plan: theirs comes first)
│ "We go on with Hangul from where you are."   <- headline from a code, never a level
│  How many days a week?            │
│  ( ) Gentle, 2 days a week        │
│  (o) Steady, 3 days a week        │  <- pre-selected from proposeRoute
│  ( ) Brisk, 4 days a week         │
│  How long?                        │
│  (o) 4 weeks        [Hoya suggests]   one preview line under each length
│  ( ) 12 weeks                     │
│  ( ) 6 months                     │
│  ( ) Choose weeks  [ - ] 12 [ + ] │
│  Starts  (o) Today ( ) Tomorrow ( ) Pick a day
│  v Change days and time           │  <- disclosure: weekday checkboxes, minutes
│  First week                       │
│   Mon  <quest title>              │
│   Wed  <quest title>              │
│   Sat  <quest title>              │
│ [[       Start this plan      ]]  │
│ [ More choices ]                  │  -> route/setup (prefilled from this proposal)
│ [ Not now ]                       │  -> back; hides the Home prompt (AM-6)
└──────────────────────────────────┘
```

- A child profile on a family device reaches this screen through the grown-up gate (`PinEntry.next: 'RouteProposal'`); a self profile goes straight in.
- With the disclosure open: `[x] Mon [ ] Tue [x] Wed ...` and "Pick 3 days." Unticking a day leaves **Start this plan** disabled with "Pick 3 days." beside it, never "free practice".
- Update after a retake (K3): when a plan exists and the new level moves it, the same screen opens in `mode: 'update'` with "Hoya found a later place to start." and **Update my plan** / **Keep my plan**. A retake never moves the start earlier.

## Interaction points

- Pace radio -> redraws the first week and the length lines (a new draft, no network).
- Length radio / Choose weeks steppers -> the plan length; the suggested one carries the "Hoya suggests" pill.
- Start day radio / Pick a day -> the first day (never before today).
- Change days and time -> shows weekday checkboxes (as many as the pace) and the minutes chips.
- **Start this plan** -> `routeStore.create`: stores `selfRoute` in the snapshot, derives the first week, fires `route.proposed` and `route.created`; back to the screen it came from (Home for the prompt).
- **More choices** -> `route/setup` step 1, prefilled.
- **Not now** -> back; `route-ui:<profileId>.dismissedAt` hides the Home prompt for 14 days or until the next result (AM-6); the Profile row stays.

## Navigation graph

Enter from: `home/todays-mission` (plan prompt **Make my plan**) · `profile/settings` (**Make a weekly plan**) · `placement/result` (plan strip) · `placement/report` (gated card) · `route/overview` (**Make a new plan** after a stop or the end)
Exit to: `home/todays-mission` · `profile/settings` · `route/setup` · `route/overview` (the Profile entry, once a plan exists) · `parent/gate` (child profile)

## States

- **success**: as drawn.
- **empty** (`proposeRoute` returns null: nothing is ready for this start): one line "New lessons are on the way. Hoya can make a plan when they are here." and **Back**; no Start button.
- **error** (the snapshot write fails): "That did not work. Try again." beside **Start this plan**; the choices stay.
- **busy**: **Start this plan** reads "Starting..." and is disabled while the write runs.
- **offline**: identical; the plan is made on the device and syncs later.
- **small phone (320 px)**: radios stack full width, the preview lines wrap, nothing scrolls sideways (P2-8 checks es and ko).

## Data needs

- reads: the progress snapshot (finished quests, placement level, an existing `selfRoute`), class and family assignments (for the "theirs comes first" line), the shared catalogue, `unlockedStagesFor(now, learnerId)`, today's date key
- writes: `snapshot.selfRoute`, the derived `snapshot.homework` items, `route-ui:<profileId>` (dismissal)
- telemetry: `route.proposed` (accepted unchanged or changed), `route.proposal_skipped`, `route.created`

## Open questions

- None open for P2-7a. The child check-in question belongs to `route/overview.md`.
