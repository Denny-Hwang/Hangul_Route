# Journey/Route-tab-collapsed — the Learning Route tab with one open stage and the others one row each (wireframe v1)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 9.6 (row DN-9) · amends the trail of `journey/learning-route.md` and `journey/my-route-overview.md` (learner Route tab only; the grown-up Learning Route views are unchanged) · F-ROUTE-001 anti-pressure rules unchanged (no ratio, no percent, nothing "left")
Audience: **learner, any age**
Route: learner app, Route tab
Mock: `design/screens/learning-route/route-tab-collapsed.md`

## Scenario (Given-When-Then)

Given: a learner on Stage 1 opens the Route tab (the curriculum is unlocked, F-ENT-003, so every stage is open)
When: the trail shows
Then: the stage they are on is open with its lessons; every other stage is one quiet row they can open; no row repeats "Open"; "You are here" and "Your goal" each show once

## Screen goal

"See where I am on the route." (secondary: look into another stage)

## Box diagram

Panel A — 360 x 740, Stage 1 current (and the goal), 4 quests played, 2 played in Stage 2

```
+--------------------------------+
| Learning Route (h1)     ( Aa ) |  <- root header: no Back; Display at the top right
| Where you are and where you    |
| are going.                     |
| +----------------------------+ |
| | route card: unchanged      | |  <- where, source, can-do, pips, Next, [ Continue ]
| +----------------------------+ |
| Week 3 of your weekly plan     |  <- unchanged
|                                |
| (1) Hangul                  ^  |  <- current stage: OPEN (aria-expanded=true); no "Open" pill
|  :  4 quests played            |  <- absolute count, never "4 of N"
|  :  (o)(o)(o)(o)( )( )...      |  <- pips (unchanged rules)
|  :  [You are here] [Your goal] |  <- each tag once, on its own stage
|  :  +------------------------+ |
|  :  | Letters & Books        | |  <- a lesson group row: a status only when it is not open
|  :  | Meet the Letters       | |
|  :  | (Complete)             | |
|  :  +------------------------+ |
|  :  | Food & Daily Life      | |
|  :  | Around the Korean Table| |
|  :  | (Playing) ( ) In your plan|
|  :  +------------------------+ |
|  :  | New Year & Festivals   | |  <- open: no word at all
|  :  ...                      | |
| (2) Words                   v  |  <- collapsed: name, played count (only when > 0), chevron
|  :  2 quests played            |
| (3) Sentences               v  |  <- collapsed, nothing played: name and chevron only
| (4) Dialogue                v  |
| (5) Stories                 v  |
| (6) Real-use                v  |
| (7) Self-expression         v  |
| [ skills card and gains: unchanged ]
|================================|
| Today | Route | Journey | Library |
+--------------------------------+
```

Panel B — a collapsed row with a state word (a stage the learner placed out of, or finished)

```
| (4) Dialogue  (You knew this) v |  <- learner.myRoute.state.* only when the stage is not open
| (2) Words  (Complete)         v |
|  :  12 quests played            |
```

Panel C — 768 wide: the same single column at `layout.maxWidth.reading`, centred; nothing else changes

## Interaction points

- Tap a collapsed stage row (the whole row, at least `touchTarget.min` tall) → it opens in place (chevron up, `aria-expanded="true"`) and shows its pips, tags and lesson groups; the stage that was open stays open (the learner's choice is kept for this visit; on the next visit only the current stage is open).
- Tap the open stage's row → it folds to one row.
- Tap a lesson group row → as today (the Journey at that cell).
- (Aa) → `shell/display-sheet.md`.

## Navigation graph

Enter from: the Route tab · "See your Learning Route" on Home (`home/next-lesson-hero.md`)
Exit to: the Journey at a cell · Display sheet · the other tabs

## States

- **success**: Panel A (and B for a stage with a state word).
- **a learner on a later stage**: that stage is the open one; Stage 1 is one row, with its "Complete" or "You knew this" word.
- **no goal source**: no "Your goal" tag anywhere.
- **a stage not open yet** (a build where a stage is still coming): its row reads its existing word ("Coming later", "A taste") and stays one row; it cannot be opened when it has nothing to show.
- **route cannot be read**: the shipped error card (F-ROUTE-001 section 3.17), unchanged.
- **200 % or Largest text at 320**: names and counts wrap; the badge and chevron keep their size; nothing scrolls sideways (`route-tab-collapsed-320-text200.png`).

## Data needs

- The shipped Route tab model (`logic/my-route/view.ts`): stage rows with `state`, `done`, `here`, the goal stage, pips and cells. No new data. Copy: `learner.myRoute.state.*`, `learner.myRoute.caption.played`, `learner.myRoute.tag.*`, `learner.routeNext.tag.inPlan`, `learner.myRoute.cell.playing`; no new key.

## Open questions

- None blocking.

---

## Revision 2026-10-17: owner decision (where you are now, the next three lessons, the goal)

Owner decision 2026-10-17 (row OR-UX): keep the four learner tabs, and simplify the Route tab to **where you are now + the next three lessons + the goal**; the full map of the seven stages stays only in the Journey tab. **Panel D replaces Panels A to C on the learner's Route tab.** Panels A to C (one open stage, the others one row each, no "Open", no ratio) now describe the trail of the grown-up's read-only Learning Route page (`MyRoute`, behind the gate), which keeps the trail, the skills, the gains and the stories note.

Panel D — 360 x 740, a learner in Stage 1 with a class plan

```
+--------------------------------+
| Learning Route (h1)     ( Aa ) |  <- root header, as before
| Where you are and where you    |
| are going.                     |
| +----------------------------+ |
| | (pin)(flag) Stage 1 ·      | |  <- route card: where you are and the goal (unchanged words and pips)
| |   Hangul: you are in your  | |
| |   goal stage               | |
| | From your class's weekly   | |
| |   plan                     | |
| | (o)( )( )( )( )( )...      | |  <- goal pips that only fill
| | [        Continue        ] | |  <- the one button: starts the first lesson below
| +----------------------------+ |  <- the card no longer repeats "Next: <title>" (the list names it)
| Week 1 of your weekly plan     |  <- unchanged; Open plan for the learner's own plan
|                                |
| Your next lessons (h2)         |
| +----------------------------+ |
| | (Next)                     | |  <- the card's lesson (routeNext), brand outline
| | Meet o, u, m and the    >  | |
| |   circle                   | |
| | Stage 1 · Meet the Letters | |  <- stage and episode only: never "lesson 2 of 3" on the Route page
| +----------------------------+ |
| | Meet eu, i, d, r        >  | |  <- the lesson after it (upcomingLessons)
| | Stage 1 · Meet the Letters | |
| +----------------------------+ |
| | (In your plan)             | |  <- a later row the plan holds
| | Around the Korean Table >  | |
| | Stage 1 · Food & Daily Life| |
| +----------------------------+ |
| ( Letter wall )                |  <- Stage 1 only: the R-7c wall, closed until tapped
| (journey) See every stage in   |  <- the one way to the whole map
|   Journey                      |
|================================|
| Today | Route | Journey | Library |
+--------------------------------+
```

### Interaction points (Panel D)

- The card's **Continue** (or **Start**) opens the first lesson of the list (unchanged: `route_map.continue_tapped`, `route.next_started`).
- A lesson row (the whole row, at least `touchTarget.min`) opens its lesson in the quest player; the first row counts as `route.next_started { surface: 'route' }`, the others send nothing.
- **Letter wall** opens and closes the wall in place (R-7c, unchanged).
- **See every stage in Journey** opens the Journey tab (the seven stages and every lesson).

### States (Panel D)

- **a new learner**: the card's start line, the goal (Hoya's suggestion) and Start; the three lessons of Meet the Letters.
- **fewer than three lessons left**: as many rows as there are; **rest** or **the end of the free lessons**: no list, the card shows that state's line and button.
- **a learner past Stage 1**: no letter wall (it belongs to Stage 1).
- **Largest text at 320**: titles and the stage and episode line wrap; the chevron keeps its size; nothing scrolls sideways.

### Data needs (Panel D)

- `upcomingLessons(input, 3)` (`logic/route-next.ts`): `routeNext` and the quests it would name next if each earlier one were done; `planView(input).inPlanQuestIds` for "In your plan". Copy: `learner.myRoute.nextLessons.title`, `.where`, `.row` (the row's accessible name), `learner.myRoute.journey.cta`, `learner.routeNext.tag.next` / `.inPlan`.
