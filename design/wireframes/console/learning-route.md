# Learning Route for teachers: one student's road, and the class plan's destination (wireframe v2)

Specs:
- `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md`:
  - section 6.1 (report goal line and stage list);
  - section 6.3 (class plan goal line);
  - section 4.1 (goal).
- `docs/specs/F-ROUTE-001-my-route-overview.md`:
  - section 3.12 (console strip, hard rules);
  - `F-TCH-001` section 3.2 (no ranking).
- Per-learner report: F-REPORT-001 (`reports/learner-report.md`); teacher URL space: F-APP-001; "Preview lessons": F-BROWSE-001.

Builds on:
- `design/wireframes/console/roster.md` (roster card);
- `design/wireframes/journey/my-route-overview.md` I (journey strip);
- `design/wireframes/parent/learning-route.md` R and L2 (the same card and page, family variant).

Audience: a teacher (class space owner or member) in the adult shell. This is the console today, and moves to app.hangulroute.com with F-APP-001.

Code (planned):
- `apps/web/src/lib/console/learning-route-view.ts`, `apps/web/src/lib/console/class-goal-line.ts`;
- the goal line under the report's "Now on Stage" line (F-REPORT-001 RP-7a2 or LR-8, whichever lands second);
- `LearningRoutePage` with the grown-up route card at `/teach/space/route` (the same component as the family path), behind `learningRouteEnabled()`;
- the header line in `apps/web/src/app/(console)/teach/space/page.tsx`;
- `ROUTES.learnerRoute(spaceId, learnerId, 'class')`.
- "Preview lessons" on the stage rows: F-BROWSE-001 BR-11.

Notation: `[pin]` and `[flag]` are drawn glyphs. `{{ Preview lessons }}` is a slot that F-BROWSE-001 renders. Every sentence is a placeholder. "Weekly plan" names every dated curriculum plan.

---

## Scenario (Given-When-Then)

Given: a teacher with a class roster, which may have a weekly plan.
When: they open a student's report ("See report" on the roster card, F-REPORT-001) and its "At a glance" link "Open Learning Route".
Then: they see where that student is, what stage the class's weekly plan reaches, and what each stage builds.
- The page holds no other student's data: no list, no next or previous student, no ranking.
- It never claims to know the student's own goal: a class never receives the student's own or family plan.
- On the roster page, one line states what stage the whole-class plan reaches. It is about the plan, not about the students.

## Screen goal

"Understand one student's place on the road, and the class plan's destination."

---

## T1. Roster page header: class plan goal line (LR-9)

```
┌──────────────────────────────────────────────┐
│ Class 3B                                      │   existing header
│ Join code ...                                 │
│ Your class's weekly plan reaches              │   ONE line: the newest live whole-class plan only
│ Stage 1 · Hangul. Plan ends Dec 20            │
│ [Plan this week] [Plan term] [Re-link] ...    │   existing actions
```

- Only **whole-class** plans count (published, not archived, no target list); the newest `publishedAt` wins. A plan targeted at some students never produces this line. No such plan: no line.
- It is computed from the plan alone (`planGoalStage`).
- It never shows a count of students who reached the stage, a share, or a list.

## T2. Roster card: unchanged by this amendment

```
┌──────────────────────────────────────┐
│ (avatar) Mina          [Some reading] │   existing card (recent-activity order, unchanged)
│ Last active today                     │
│ ...                                   │
│ Learning Route  ■ ■ □ □ □ □ □  On Stage 2   R-9a strip, renamed
│ v Stage by stage                      │
│ [ See report ]  [ Send a note ]       │   F-REPORT-001 and F-FEEDBACK-001; no Learning Route button here
└──────────────────────────────────────┘
```

The Learning Route is reached through the report, so the card does not grow another button.

## T3a. The goal line in the report's "At a glance"

```
┌──────────────────────────────────────────┐
│ Mina · Report                            │   F-REPORT-001 h1
│ Now on Stage 2: Words                    │   F-REPORT-001 report.glance.nowOn
│ Your class's weekly plan reaches         │   THIS amendment's goal line, case 2: this class's live plan that targets Mina
│ Stage 1 · Hangul                         │
│ [ Open Learning Route ]                  │   F-REPORT-001 report.glance.openRoute -> T3
│ Last practice: today                     │   F-REPORT-001
```

- Case 3 (no live class plan for Mina): "Next open stage: Stage {n} · {title}". Never "Mina's goal" and never "Hoya's suggestion" as if it were her goal.
- Several live plans that target Mina: the newest `publishedAt` wins. Drafts and archived plans never count.

## T3. One student's Learning Route (`/teach/space/route?id=&learner=`)

```
┌──────────────────────────────────────────┐
│ [< Back to the report]                   │
│ Mina's Learning Route                    │   initials when the class anonymizes the roster
│ Updated Oct 11                           │
│ ┌──────────────────────────────────────┐ │   the full grown-up route card
│ │ Now   [pin]  Mina is on Stage 2:     │ │
│ │              Words.                  │ │
│ │ Your class's weekly plan reaches     │ │   case 2
│ │ Stage 1 · Hangul. Plan ends Dec 20   │ │
│ │ Mina reached this stage.             │ │   reached variant (the stage is complete or known)
│ └──────────────────────────────────────┘ │
│ Stages                                   │   ordered list
│  1. Hangul · Known from the level check  │
│     Read any Hangul letter and syllable  │   can-do line
│     and know its sound.                  │
│     8 known from the level check         │   the done part left out: it is 0
│     [flag Plan goal] [Mina started here] │
│     {{ Preview lessons }}                │
│  2. Words · A taste                      │
│     Read everyday words and know what    │
│     they mean.                           │
│     1 quest done                         │
│     [Mina is here]                       │
│     {{ Preview lessons }}                │
│  3. Sentences · Coming later             │
│  4. Dialogue · A taste                   │
│     Follow a short greeting conversation │
│     and pick a reply.                    │   no count line: nothing done (never "0")
│     {{ Preview lessons }}                │
│  5 to 7. Coming later                    │
└──────────────────────────────────────────┘
```

- **Never on this page:**
  - another student;
  - a class average or distribution;
  - "ahead" or "behind";
  - a sort by stage;
  - a percentage, "N / M" or a zero count;
  - skills;
  - speaking;
  - a price, a product name, a billing link or a free-lessons line.

## Interaction points

- T3a [ Open Learning Route ] (F-REPORT-001's link) -> T3.
- T3 [< Back to the report] -> the learner report; until F-REPORT-001's page exists, `/teach/space?id=<spaceId>` (the roster).
- `{{ Preview lessons }}` -> F-BROWSE-001 (BR-11, behind `browseEnabled()`), only when it renders the slot.
- Stage rows are text, not buttons.

## Navigation graph

- **Enter T3 from:** the report card (T3a) only.
- **Exit to:** the report (or the roster), F-BROWSE-001's lesson browser through its slot.
- There is no link to another student's page.

## Data needs

- **Existing requests only:**
  - `GET /api/spaces/:id/roster`, for the row with `summary.journey`, `summary.placement` and `lastSyncedAt` (a class never receives `routeGoal` or `selfRoute`);
  - `GET /api/spaces/:id/plans` (published, unarchived; the target rule per student).
- No new endpoint and no new field reach a teacher. The consent text needs no new item.
- `learner` in the query is an opaque roster id.

## States

- **Loading:** header plus placeholder rows (`aria-busy`).
- **Not synced yet / old app:** "The Learning Route appears after Mina's next sync on the newest app." The stage list is hidden.
- **Learner not in this class:** "We could not find this learner in this space." and [< Back to the class].
- **Cannot reach the server:** the existing console wording and [Try again].
- **School space:** no roster, so no report card and no page (`SchoolAdmin` renders instead).

## Open questions (each with the default used until answered)

| Question | Default |
|---|---|
| Show the class plan goal line on the roster? (LR-OD-10) | yes, one line about the newest whole-class plan |
| Should free class accounts see T3? (LR-OD-9) | yes |
