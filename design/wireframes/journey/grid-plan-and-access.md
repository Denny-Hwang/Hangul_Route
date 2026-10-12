# Journey/Grid — Next, In your plan, and lessons that open with the full route (wireframe v1)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.5 (`routeNext`, `planQuestIds`), §3.7 (Journey), §3.14 (accessibility) · extends `journey/grid.md` and `journey/grid-with-stories.md` (cells, stage rows, pills from F-ROUTE-001 R-J)
Audience: **learner (any age; P4/P5/P6)**. No grown-up control on this screen.
Code: `apps/mobile/src/screens/journey/JourneyScreen.tsx` (`GridCell`), `apps/mobile/src/logic/route-next.ts`, `apps/mobile/src/logic/content-access.ts`

## Scenario (Given-When-Then)

Given: a learner opens the Journey tab (a subscriber with a plan, a learner with no plan, or a free learner while the free-plan switch is on)
When: the grid renders
Then: one cell shows where to go next, the cells of this week's plan are marked, every lesson stays visible, and a lesson a free learner cannot start yet says so calmly on the cell — no lock on a stage, no price, no "Premium"

## Screen goal

"Show the one next step on the map, inside a grid that hides nothing."

## Box diagram (phone, compact; the part that changes)

```
+--------------------------------------------+
| Journey (title)                            |
| short intro line                           |
|                                            |
|  Letters  Life  Rites  Nature  Crafts      |  <- column labels (unchanged)
|                                            |
| (1) Hangul ......................[ Open ]  |  <- stage row: plain, never a button
|  +------+ +------+ +------+ +------+ +------+
|  | [pin]| | (o)  | |   [k]| |   [k]| |   [k]|
|  |  L   | |  L   | |  R   | |  N   | |  C   |  <- cell initial (unchanged)
|  +------+ +------+ +------+ +------+ +------+
|   Next    In your                          |
|           plan                             |  <- words live in the a11y label;
|                                            |     on regular / wide windows a
| (2) Word .......................[ A taste ] |     caption row may show them
|  +------+ +------+ +------+ +------+ +------+
|  | soon | |   [k]| | soon | |   [k]| | soon |
|  +------+ +------+ +------+ +------+ +------+
|  ...                                       |
+--------------------------------------------+

[pin] = drawn pin glyph (R-2a), top-left of the cell: the routeNext cell, at most one
(o)   = drawn ring (E3-D mock, border.shape): a cell holding a pending plan item this week
[k]   = small drawn lock glyph, top-right corner: free learner, switch on, no kept quest in the cell
```

- Precedence on one cell: Next > In your plan > closed glyph. A closed cell is never Next and never In your plan.
- A subscriber, or anyone while the switch is off, sees **no** [k] anywhere.
- No ring for the default route (no plan): the whole grid is the route; only [pin] shows.
- Stage rows keep the availability word (Open / A taste / Coming later); a stage is never a lock or a door to the paywall.

## Interaction points

- Tap any cell (including a [k] cell) -> `episode/detail` (one pane) or select it in the right pane (two panes, F-LAYOUT-001 §3.7). A [k] cell opens the preview state of `episode/detail-access-preview`.
- No long-press, no tooltip, no purchase entry on this screen.
- `route.next_started { surface: 'journey' }` fires only when a quest is started from the episode page reached through the [pin] cell (sent by the episode page).

## Navigation graph

Enter from: bottom tab Journey · Results "Episode page" · Home (tab switch) · route page cell rows
Exit to: `episode/detail` (`EpisodeDetail { episodeId }`) · right pane of `journey/grid` (wide) · other tabs

## States

- **Subscriber with a plan**: [pin] on the plan's next cell, (o) on this week's plan cells, no [k].
- **No plan** (subscriber, or free with the switch off): [pin] on the default-route cursor cell, no (o), no [k].
- **Free, switch on, new learner**: [pin] on Meet the Letters; [k] on rites, nature, crafts, Stage 2 life and nature, Stage 4 rites.
- **Free, switch on, Day 2 finished** (`free-end`): no [pin]; [k] on the six closed cells; letters and life cells show their completion tint.
- **Free learner with kept quests past Day 2**: no [k] on a cell that holds any kept quest.
- **Empty** (no playable episode, content failed to load): the existing coming-soon pane; no markers.
- **Error** (tier cache or snapshot unreadable): fail open — treated as the switch-off state; no [k], [pin] from the default route.

## Accessibility

- Cell label = title, then state words in this order: "Next", "In your plan", "opens with the full route. Opens the lesson page." (`a11y.access`). Never colour alone: every state is a drawn shape plus a word.
- Glyphs sit inside the cell's existing touch target; the cell size does not change. Greyscale and protanopia check in E3-D.

## Data needs

- `routeNext(...)` and `planQuestIds(...)` (pure, `logic/route-next.ts`) from the active profile's snapshot, the bundle and `cursorContext` (now with `isQuestOpen`).
- `useQuestAccess()` (tier cache `accessTier`, `flags.contentGatingEnabled`, completed quest ids).
- No network call; works offline.

## Open questions

- OD-10 (default: Next plus this week's plan cells). OD-6 (default: lock glyph plus "opens with the full route").
- Beta check: do learners with a plan follow [pin] more often than the default cursor (`route.next_started` by surface)?
