# Learning Route for teachers: one student's road, and the class plan's goal (wireframe v1)

Specs:
- `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md`:
  - section 6.1 (summary page);
  - section 6.3 (class plan goal line);
  - section 4.1 (goal).
- `docs/specs/F-ROUTE-001-my-route-overview.md`:
  - section 3.12 (console strip, hard rules);
  - `F-TCH-001` section 3.2 (no ranking).
- Teacher home: F-APP-001 (persona homes).

Builds on:
- `design/wireframes/console/roster.md` (roster card);
- `design/wireframes/journey/my-route-overview.md` I (journey strip);
- `design/wireframes/parent/learning-route.md` L2 (the same page, family variant).

Audience: a teacher (class space owner or member) in the adult shell. This is the console today, and moves to app.hangulroute.com with F-APP-001.

Code (planned):
- `apps/web/src/lib/console/learning-route-view.ts`;
- `apps/web/src/app/(console)/teach/space/route/page.tsx`;
- the roster card link and header line in `apps/web/src/app/(console)/teach/space/page.tsx`;
- `ROUTES.learnerRoute`.

Notation: `[pin]` and `[flag]` are drawn glyphs. Every sentence is a placeholder.

---

## Scenario (Given-When-Then)

Given: a teacher with a class roster, which may have a curriculum plan.
When: they open "Open Learning Route" on one student's card.
Then: they see where that student is, what goal the class plan sets, and each stage of the road.
- The page holds no other student's data: no list, no next or previous student, no ranking.
- On the roster page, one line states what stage the class plan reaches. It is about the plan, not about the students.

## Screen goal

"Understand one student's place on the road, and the class plan's destination."

---

## T1. Roster page header: class plan goal line (LR-9)

```
┌──────────────────────────────────────────────┐
│ Class 3B                                      │   existing header
│ Join code ...                                 │
│ Your class plan reaches Stage 1 · Hangul      │   ONE line, only with an active curriculum plan
│ Plan ends Dec 20                              │
│ [Plan this week] [Plan term] [Re-link] ...    │   existing actions
```

- It is computed from the plan alone (`planGoalStage`).
- It never shows a count of students who reached the goal, a share, or a list.

## T2. Roster card: the link (LR-8)

```
┌──────────────────────────────────────┐
│ (avatar) Mina          [Some reading] │   existing card (recent-activity order, unchanged)
│ Last active today                     │
│ ...                                   │
│ Learning Route  ■ ■ □ □ □ □ □  On Stage 2   R-9a strip, renamed
│ v Stage by stage                      │
│ [ Open Learning Route ]               │   -> T3 for this student (ids in the URL only)
└──────────────────────────────────────┘
```

## T3. One student's Learning Route (summary page)

```
┌──────────────────────────────────────────┐
│ [< Back to the class]                    │
│ Mina's Learning Route                    │   initials when the class anonymizes the roster
│ Updated Oct 11                           │
│ ┌──────────────────────────────────────┐ │
│ │ Now   [pin]  Mina is on Stage 2:     │ │
│ │              Words.                  │ │
│ │ Goal  [flag] Stage 1 · Hangul        │ │
│ │       From your class plan           │ │
│ │       Plan ends Dec 20               │ │
│ │ Mina reached the goal: Stage 1 ·     │ │   reached variant (the goal stage is complete or known)
│ │ Hangul.                              │ │
│ └──────────────────────────────────────┘ │
│ Stages                                   │   ordered list
│  1. Hangul · Known from the level check  │
│     8 known from the level check,        │
│     0 quests done                        │
│     [flag Goal] [Mina started here]      │
│  2. Words · Open                         │
│     1 quest done                         │
│     [Mina is here]                       │
│  3. Sentences · Coming later             │
│  4. Dialogue · Open                      │
│  5 to 7. Coming later                    │
└──────────────────────────────────────────┘
```

- **Goal, for a class viewer:**
  1. this class's own active curriculum plan, if it targets everyone or names Mina;
  2. otherwise "Hoya's suggestion", the first stage that is still open in `summary.journey`.

  The page never reads Mina's own or family plan: a class never receives `selfRoute`.
- **Never on this page:**
  - another student;
  - a class average or distribution;
  - "ahead" or "behind";
  - a sort by stage;
  - a percentage or "N / M";
  - skills;
  - speaking;
  - a price.
- **No free-allowance line** for a teacher who does not own the space (LR-OD-8). A class owner on a free class sees the same neutral line as a parent ("Some quests open with a plan." [See plans]) when the learner is free and not covered.

## Interaction points

- [< Back to the class] -> `/teach/space?id=<spaceId>`, the roster.
- [Open Learning Route] (T2) -> T3.
- [See plans] (owner only) -> Billing in the adult shell.
- Stage rows are text, not buttons.

## Navigation graph

- **Enter T3 from:**
  - the roster card [Open Learning Route];
  - the teacher home's student list (F-APP-001);
  - the per-student report page (progress-reports spec).
- **Exit to:** the roster, or Billing for the owner only.
- There is no link to another student's page.

## Data needs

- **Existing requests only:**
  - `GET /api/spaces/:id/roster`, for the row with `summary.journey`, `summary.placement` and `lastSyncedAt`;
  - `GET /api/spaces/:id/plans`;
  - `GET /api/entitlements`, for the owner line only.
- No new endpoint and no new field reach a teacher. The consent text needs no new item.
- `learner` in the query is an opaque roster id.

## States

- **Loading:** header plus placeholder rows (`aria-busy`).
- **Not synced yet / old app:** "The Learning Route appears after Mina's next sync on the newest app." The stage list is hidden.
- **Learner not in this class:** "We could not find this learner in this space." and [< Back to the class].
- **Cannot reach the server:** the existing console wording and [Try again].
- **School space:** no roster, so no link and no page (`SchoolAdmin` renders instead).

## Open questions (each with the default used until answered)

| Question | Default |
|---|---|
| Show the class plan goal line on the roster? (LR-OD-10) | yes, one line about the plan |
| Should free class accounts see T3? (LR-OD-9) | yes |
