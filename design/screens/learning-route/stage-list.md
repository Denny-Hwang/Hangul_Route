# Grown-up summary views: the goal line in the per-learner report, and the stage list page (screen spec v1)

Spec: `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md`:
- section 2 (F-REPORT-001 and F-BROWSE-001 rows);
- section 6.1 (entries, goal cases 1 to 3, page, card, rows, states);
- section 7.3 (grown-up honesty);
- section 10 (adult views);
- section 11.1 (`console.learningRoute.*` drafts).

F-REPORT-001: section 3.6 and Appendix A (`report.title.learner`, `report.glance.nowOn`, `report.glance.openRoute`, `report.glance.lastPractice`).
Wireframes: `parent/learning-route.md` R and L2, `console/learning-route.md` T3a and T3, `reports/learner-report.md` (header block).
Mock:
- `mock/report.html` (the goal line, every case);
- `mock/stage-list-family.html`, `mock/stage-list-class.html` (the page);
- `mock/stage-list-states.html` (card cases and page states).

Shots:
- `shots/report-goal-line-375.png`, `-1280.png`;
- `shots/stage-list-family-320.png`, `-1280.png`, `-320-text200.png`;
- `shots/stage-list-class-320.png`, `-1280.png`;
- `shots/stage-list-states-375.png`.

Code (planned):
- LR-7: the words, the goal case and the rows, from `learning-route-view.ts`.
- LR-8: `LearningRoutePage` under `app/(console)/parent/space/route/` and `app/(console)/teach/space/route/`, and the grown-up route card component. It also adds the goal line under the report's `nowOn` line, or RP-7a2 adds it (whichever lands second).

## Goal cases (shared by the report line and the card)

The report line and the stage list card always show the same case. LR-7 computes it once.

| Case | When | Goal line | Glyph |
|---|---|---|---|
| 1 | Family viewer, `summary.routeGoal` present (the goal the learner's device shows) | "Sam's goal: Stage 2 · Words" (`learnerGoal`) | flag |
| 1, reached | as 1, and the goal stage is complete or known | "Sam reached the goal: Stage 1 · Hangul." (`reached`) | flag |
| 2 | No `routeGoal`, and this space has a live curriculum plan that targets the learner (the newest `publishedAt` wins) | "Your family's weekly plan reaches Stage 1 · Hangul" or "Your class's weekly plan reaches Stage 1 · Hangul" (`planReaches.*`) | flag |
| 3 | Neither | "Next open stage: Stage {n} · {title}" (`nextOpen`), also when that stage is the Now stage (below) | none |
| No goal | `pickGoal` returns null: every stage is complete, known, explored or later | "Sam reached the end of the open road. More is coming." (`endOfRoad`) | none |

- **Flag.** Only lines that name a goal or a plan's destination carry the flag (cases 1 and 2). Case 3 and the end of the road name no goal, so they have no flag.
- **Never "Sam's goal" in cases 2 and 3.** Neither case knows the learner's goal (section 7.3 tests this).
- **Teachers** never get case 1, because a class never receives `routeGoal` (section 9).
- **Older app on a second device.** Its sync removes `routeGoal`, so the view falls to case 2 or 3. There is no error text and no "unknown" (section 9, mixed builds).

### Case 3 when the next open stage is the Now stage

- **Two rules, usually one stage.** Case 3 is `pickGoal` over `summary.journey.stages` with no sources: the first stage whose state is `open`. The Now stage is `summary.journey.here`, the stage of the catalogue cursor. For a learner with no plan these are usually the same stage, so a teacher reads "Now on Stage 1: Hangul" and then "Next open stage: Stage 1 · Hangul".
- **The line stays.** Section 6.1 asks for it in every case-3 view, and the report needs it to say where the learner is heading. It is true: Stage 1 is still the stage to finish. It names no goal and no person, so it keeps the grown-up honesty rule (section 7.3).
- **When they differ.** For example, a level check started Mina in Stage 2 while Stage 1 is still open: "Now on Stage 2: Words", then "Next open stage: Stage 1 · Hangul". The board draws both.
- **Not a design choice.** Hiding the line when it names the Now stage would change section 6.1. If the owner wants that, it is a spec change with its own test in LR-7, not something LR-7 or LR-8 decide alone.

## The goal line in the per-learner report

The report gets one line, directly under its "Now on Stage {n}: {stage}". The report then says where the learner is and where they are heading in two lines. The source, the can-do line and the plan end stay on the stage list page, one tap away.

```
Sam: report                         h1 (F-REPORT-001)
Now on Stage 1: Hangul              report.glance.nowOn
[flag] Sam's goal: Stage 2 · Words  the goal line (case 1)
( Open Learning Route )             report.glance.openRoute -> the stage list page
Last practice: Monday               report.glance.lastPractice
```

- **Block.** These are the report's own "At a glance" lines, `spacing.xs` apart, under the report's `h1`. "Now on", the goal line and the link sit in one `section` labelled "Learning Route" (section 10). "Last practice" stays outside it. The section has no heading, no panel and no source line, so it looks like the lines it replaces.
- **Goal line.**
  - `body` size, `weight.semibold`, `text.primary`. It is one step heavier than "Now on" (`regular`), so it reads as the second half of one statement, not as a heading.
  - The flag is 20 dp, `aria-hidden`, and top-aligned with the first text line.
  - The text wraps under itself, never under the flag. At 375 px a case 2 line takes two lines.
- **The link.**
  - **Open Learning Route** (F-REPORT-001's link) comes after the goal line, so it reads as the action for both lines.
  - It is `touchTarget.min` tall: a quiet outline pill (`border.strong` on `surface.paper`, `text.primary`, bold).
  - F-REPORT-001's own wireframe puts the link at the end of the "Now on" line. When the goal line arrives, the PR that adds it (LR-8 or RP-7a2) moves the link under it, so "Now" and the goal line stay together.
- **Never on this line:** a source line, a date, "behind", "late", or "N stages to go".
- **In-app report (RP-9).** Its **Open Learning Route** opens the local read-only page L1 (`route-card.md`), which shows the device's own goal with its source and plan end. This board draws the console report, the one the summary cases above apply to.
- **Screen readers.** The section adds a landmark but no heading, so the report's heading order (F-REPORT-001) does not change. The reading order is "Sam: report", then the "Learning Route" region with "Now on Stage 1: Hangul", "Sam's goal: Stage 2 · Words" and the link, then "Last practice".

## The stage list page

### Layout

There is one reading column (`layout.maxWidth.reading`, centred). The gutter is `layout.gutter.compact` below 600 px and `regular` from 600 px. From top to bottom:

1. **The adult shell header** (F-APP-001). The page adds nothing to it: no billing link, no free-lessons line (LR-OD-8).
2. **Back link**: "Back to the report". Until F-REPORT-001's page exists, it reads "Back to the family" or "Back to the class". It is `touchTarget.min` tall, with an `arrow-left` glyph and underlined `brand.secondaryDark` text.
3. **Heading**: `h1` "{name}'s Learning Route" at `title` size, then "Updated {date}" (`bodySm`, muted).
4. **The grown-up route card**: a panel (`surface.paper`, `border.subtle`, `radii.lg`, padding `spacing.lg`).
5. **"Stages"** (`h2`), then an `ol`.

### The grown-up route card

| Line | Family (case 1, Sam) | Class (case 2, Mina) |
|---|---|---|
| Now | `[pin]` "Sam is on Stage 1: Hangul." | `[pin]` "Mina is on Stage 2: Words." |
| Goal | `[flag]` "Sam's goal: Stage 2 · Words" | `[flag]` "Your class's weekly plan reaches Stage 1 · Hangul" |
| Source or plan end | "From the class's weekly plan" | "Plan ends Dec 20" |
| Reached | — | "Mina reached this stage." |
| Can-do | "By the end of this stage, Sam can:" + the stage 2 line | "By the end of this stage, Mina can:" + the stage 1 line |
| Secondary (family only, when the family plan does not lead) | "Your family's weekly plan reaches Stage 1 · Hangul. Plan ends Dec 20", above a thin rule | — |

- **Type.** Now and Goal are `bodyLg`, bold, with 20 dp glyphs. The source and plan end lines are `bodySm` in `text.secondary`. The can-do lead is caption, semibold and muted.
- **Plan end** shows for a family or self source (case 1) and in case 2, never for a class source in case 1 (section 6.1).
- **Case 3**: the Now line, then "Next open stage: Stage {n} · {title}" with no flag, then that stage's can-do line. This is the same when the next open stage is the Now stage.
- **No goal**: the Now line, then "{name} reached the end of the open road. More is coming."

The states board draws case 3 (both forms), case 1 with "Hoya's suggestion: the next open stage" as the source, and the end of the road.

### Stage rows

Each row is an `li`: a paper panel, `radii.md`, `border.subtle`, padding `spacing.md`. It holds:

- **The state shape**: the R-9a strip's segment at 24 dp (`stageSegmentParts`).
  - Complete: a disc with a check.
  - Known: a ring with a disc.
  - Explored: the bare check.
  - Open: a ring.
  - Later: the dotted ring.
- **Name and state word**: "1. Hangul · Open", with the name bold and the word in `text.secondary`. A taste stage reads "A taste"; known reads "Known from the level check".
- **The can-do line** (`learner.myRoute.stage.canDo.<n>`, read from the dictionary).
- **The count line**, with every zero part left out: "4 known from the level check, 2 quests done", "8 known from the level check", "1 quest done". There is no line when both are 0, and never "0" or "of N".
- **Tags** (the same chips and order as the learner page): "{name} is here", then "{name}'s goal" (flag, case 1) or "Plan goal" (flag, case 2), then "{name} started here" (pin).
- **The reserved slot** "Preview lessons" (dashed, `touchTarget.min`): F-BROWSE-001 renders it. Until then it renders **nothing**. The mock draws it only to show where it goes.

**Later stages.** Their rows are quiet: a dashed border, no fill, only the name and "Coming later". Consecutive later stages merge into one row ("Stages 5 to 7 · Coming later").

**Never on the page:** another learner, an average, a sort, "ahead" or "behind", a percentage, "N / M", a zero count, skills, speaking, a price, a product name, a billing link or a free-lessons line.

### Notes for LR-7 (words)

- **Count line.** `console.journey.stageLine(known, done)` on main leaves out only the known part. With `done` at 0 it still prints "0 quests done", for example "8 known from the level check, 0 quests done".
  - The page needs "8 known from the level check", and no line at all when both are 0 (section 6.1).
  - LR-7 either adds a `console.learningRoute` count key that leaves out both zero parts, or the view model passes only the non-zero parts.
  - The roster strip's own use of `stageLine` is not changed by this page.
- **A taste.** `console.journey.state` has no word for a taste stage, because the summary states are `complete`, `known`, `explored`, `open` and `later`.
  - The row shows "A taste" when the stage's state is `open` and `stageAvailabilityOf(CATALOG, stage)` is `taste`.
  - This is the learner page's word (`learner.myRoute.state.taste`). LR-7 adds the console key.

### States (board)

- **Loading**: the back link and three `surface.sunken` placeholder rows (`aria-busy`, no text).
- **Not synced yet** (or an older app): the back link, the heading, then the notice "The Learning Route appears after Sam's next sync on the newest app." The stage list is hidden. It is never worded "no progress". Every state keeps the back link, so no state is a dead end.
- **Learner not in this space**: "We could not find this learner in this space." and "Back to the family" (or "Back to the class"). There is no list of other learners.
- **Cannot reach the server**: the back link, then the existing console wording, "Can't reach the console right now.", and Try again.

## Accessibility

- The stage list is a real `ol`, and each row is an `li` with text. Tags are text, not colour.
- Shapes and glyphs are `aria-hidden`.
- Targets are at least 44 px. The mock uses `touchTarget.min` (64) for every link and for the slot.
- On the report, "Now on", the goal line and the link form a `section` labelled "Learning Route", under the report's own heading (section 10). On the stage list page the card is a `section` labelled "Learning Route" under the `h1` "{name}'s Learning Route".
- Both views reflow to one column at 320 and at 200 % text, with no sideways scroll (measured, README).
