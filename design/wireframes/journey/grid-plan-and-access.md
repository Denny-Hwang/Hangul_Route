# Journey/Grid — Next, In your plan, and lessons that are not open yet (wireframe v2)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.5 (`routeNext`, `planView`), §3.7 (Journey, marks), §3.11 (glossary), §3.14 (accessibility) · extends `journey/grid.md` and `journey/grid-with-stories.md` (cells, stage rows, pills from F-ROUTE-001 R-J) · same marks as the Learning Route page (`journey/learning-route.md`, LR §4.5)
Audience: **learner (any age; P4/P5/P6)**. No grown-up control on this screen.
Code: `apps/mobile/src/screens/journey/JourneyScreen.tsx` (`GridCell`), `apps/mobile/src/logic/route-next.ts`, `apps/mobile/src/logic/content-access.ts`

## Scenario (Given-When-Then)

Given: a learner opens the Journey tab (a subscriber with a plan, a learner with no plan, or a free learner while the free-plan switch is on in the web app)
When: the grid renders
Then: one cell shows where to go next, the cells of the plan's coming items are marked, every lesson stays visible, and a lesson a free learner cannot start yet says "Not open yet" calmly — no lock, no price, no product name, no "Premium", no request to ask anyone

## Screen goal

"Show the one next step on the map, inside a grid that hides nothing."

## Box diagram (phone, compact; the part that changes)

```
+--------------------------------------------+
| Journey (title)                            |
| short intro line                           |
|  v Next   (==) In your plan  (: :) Not open yet  <- legend line (D4), aria-hidden
|                                            |
|  Letters  Life  Rites  Nature  Crafts      |  <- column labels (unchanged)
|                                            |
| (1) Hangul ......................[ Open ]  |  <- stage row: plain, never a button
|  +------+ +------+ +------+ +------+ +------+
|  |  v   | |(====)| |      | |      | |      |
|  |  L   | |  L   | |  R   | |  N   | |  C   |  <- cell art (since 2026-10-14 the theme glyph, Icon/theme-glyphs.md)
|  +------+ +------+ +------+ +------+ +------+
|   Next    In your   (all of Stage 1 is free:|
|           plan       never a dotted ring)  |  <- words in the a11y label and in
|                                            |     the legend line on every class (D4)
| (2) Word .......................[ A taste ] |  <- taste note left out: every playable
|                                            |     cell of this row is closed (D11)
|  +------+ .------. +------+ .------. +------+
|  | soon | :  L   : | soon | :  N   : | soon |
|  +------+ '------' +------+ '------' +------+
|            not open yet (label)            |
|  ...                                       |
+--------------------------------------------+

  v    = the Next triangle (the pip rows' cursor marker), centred over the top edge of the routeNext cell, at most one
         (E3-D D1: not the `pin`, which marks the level check's start cell on the same grid)
(====) = solid ring (border.shape): a cell holding an In your plan item (leading source, inside the horizon)
:....: = dotted ring around the cell art (the Learning Route "later" pip shape at cell scale):
         free learner, switch on, a cell of Stage 2 onward with no kept quest (F-ENT-003 OD-1: all of
         Stage 1 is free, so a Stage 1 cell never carries it). Art and colour stay.
```

- Precedence on one cell: Next > In your plan > Not open yet. A closed cell is never Next and never In your plan.
- A subscriber, anyone while the switch is off, and every native store build see **no** dotted ring anywhere.
- No solid ring for the default route (no plan): the whole grid is the route; only the Next triangle shows.
- Stage rows keep the availability word (Open / A taste / Coming later); a stage is never a lock or a door to a purchase.
- Never on this screen: a lock glyph, "Ask a grown-up", a price, a product name, "Premium", a count of free lessons.

## Interaction points

- Tap any cell (including a dotted cell) -> `episode/detail` (one pane) or select it in the right pane (two panes, F-LAYOUT-001 §3.7). A dotted cell opens the preview state of `episode/detail-access-preview`.
- No long-press, no tooltip, no purchase entry on this screen.
- `route.next_started { surface: 'journey' }` fires only when a quest is started from the episode page reached through the Next cell (sent by the episode page).

## Navigation graph

Enter from: bottom tab Journey · Results "Episode page" · Home (tab switch) · Learning Route cell rows
Exit to: `episode/detail` (`EpisodeDetail { episodeId }`) · right pane of `journey/grid` (wide) · other tabs

## States

- **Subscriber with a plan**: Next on the `routeNext` cell, solid rings on the leading source's cells inside the horizon, no dotted ring.
- **No plan** (subscriber, or free with the switch off): Next on the default-route cursor cell, no solid ring, no dotted ring.
- **Free, switch on, any learner**: Next on the `routeNext` cell (Meet the Letters for a new learner); no dotted ring on any Stage 1 cell; dotted rings on Stage 2 life and nature and Stage 4 rites (the playable cells past Stage 1 today); the taste note of Stage 2 and Stage 4 is left out, because no playable cell of those rows is open (E3-D D11: the note shows only when at least one playable cell of the row has a quest whose `questAccess` is not `closed`, that is open or kept).
- **Free, switch on, free lessons finished** (`free-end`, all of Stage 1 done): no Next; dotted rings on the closed cells; the Stage 1 cells show their completion tint.
- **Free learner with kept quests past Stage 1** (a taste finished before the switch turned on): no dotted ring on a cell that holds any kept quest, and that row keeps its taste note (D11).
- **Legend line** (E3-D D4, every class): under the intro, above the column labels; it lists only the marks the grid draws now (Next, In your plan, Not open yet), and shows nothing when no mark is drawn. Hidden from screen readers.
- **Empty** (no playable episode, content failed to load): the existing coming-soon pane; no marks.
- **Error** (tier cache or snapshot unreadable): fail open — treated as the switch-off state; no dotted ring, Next from the default route.

## Accessibility

- Cell label = title, then state words in this order: "Next", "In your plan", "not open yet. Opens the lesson page." (`a11y.access`). Never colour alone: every state is a drawn shape plus a word.
- Solid and dotted rings must be told apart in greyscale and protanopia at 320 dp (E3-D check). Marks sit inside the cell's existing touch target; the cell size does not change.

## Data needs

- `routeNext(...)` and `planView(...)` (pure, `logic/route-next.ts`) from the active profile's snapshot, plan sources, the bundle and `cursorContext` (now with `isQuestOpen`).
- `useQuestAccess()` (`accessTier`, `gatingActive`, completed quest ids).
- No network call; works offline.

## Open questions

- OD-10 (default: Next plus the leading source's cells inside the horizon). OD-6 resolved with LR-OD-8 (dotted ring plus "Not open yet").
- Beta check: do learners with a plan follow Next more often than the default cursor (`route.next_started` by surface)?
