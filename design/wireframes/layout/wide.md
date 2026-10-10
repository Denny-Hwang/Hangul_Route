# Layout/Wide — tablet, landscape and split panes (wireframe v1)

Spec: `docs/specs/F-LAYOUT-001-responsive-tablet-landscape.md` (§3.1 classes, §3.4 guard, §3.6 per-screen table, §3.7 panes)
Audience: anyone learning Hangul, any age (CLAUDE.md §1), on a phone, an iPad, an Android tablet, a Chromebook or a desktop window. Teachers on classroom tablets are a main case. No separate "tablet mode" the learner has to find. UI strings are English by default with Korean and Spanish selectable; Spanish runs about 30 % longer, so no pane label has a fixed width.
Code (planned): `packages/design-system` `Screen width`, `SplitPane`, `useLayoutClass`; `screens/home/HomeScreen.tsx`, `journey/JourneyScreen.tsx`, `library/LibraryScreen.tsx`, `episode/EpisodeDetailView.tsx`, `library/CardDetailView.tsx`, `components/PortraitGuard.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( )` a tab or toggle, `{ }` content that depends on the class, `<sel>` selected state. No colours, fonts or pixel sizes; relative widths only. All copy is placeholder.

This file holds eight screens or states in one place (house style is one file per screen; split when promoted to `design/wireframes/layout/` and `home/`, `journey/`, `library/`):

- A. The four layout classes at a glance (what changes, what never does)
- B. Home, regular and wide
- C. Journey, wide: two panes
- D. Library, wide: two panes
- E. Phone landscape: the soft portrait guard
- F. Tablet portrait (regular): one pane, centred column
- G. Pane states: loading, empty, error, preview cell
- H. Tab bar and overlays on a wide window

## Scenario (Given-When-Then)

Given: a learner or teacher opens the app on a screen wider than a phone, or turns the device
When: the window is at least 600 wide (regular) or 900 wide and tall enough (wide)
Then: the app uses the whole window: a centred reading column on regular, side-by-side panes on wide, bigger pictures and tiles, the same type sizes and the same 64-point tap targets; on a phone in landscape it asks, once, to turn the phone upright and lets the learner say no

## Screen goal

"Use the extra room for pictures and for seeing two things at once, never for smaller targets or a thin strip down the middle."

---

## A. Classes at a glance

```
compact  (< 600)            regular (600-899)             wide (>= 900, not short)
+------------+              +--------------------+        +--------------+-----------------------+
| one column |              |   centred column   |        | master pane  |     detail pane       |
| full width |              |  (reading width)   |        | (list/grid)  | (episode / card /     |
|            |              |  bigger pictures   |        |              |  story page)          |
+------------+              +--------------------+        +--------------+-----------------------+
  bottom tabs                 bottom tabs, centred          bottom tabs, centred inside the content width

short (window height < 480, any width):   one pane, scrolls, controls beside the content where a screen already has a side mode;
                                          picture-beside-text screens (reader, Discover) still go two columns in landscape (width >= 700)
```

- Never changes with the class: type sizes, 64-point minimum tap target, copy, order of actions.
- Changes with the class: how many columns, how many panes, the size of Hoya / tiles / card art / the Trace canvas.
- The class follows the **window**, so a resized desktop window, iPad Split View and 200 % browser zoom all move between rows live.

## B. Home

```
regular (768 x 1024, portrait)                wide (1180 x 820, landscape)
+----------------------------------+          +--------------------------------------------------------+
| (Hoya)  Hi, Mina!        [Profile]|          | (Hoya)  Hi, Mina!                           [Profile]  |
| streak . cards . stars           |          | streak . cards . stars                                  |
|                                  |          +----------------------------+---------------------------+
| Today with Hoya                  |          | Today with Hoya            | Stage progress            |
| +------------------------------+ |          | +------------------------+ |  ( 1 ) ==----             |
| | [1] replay                   | |          | | [1] replay             | | Homework                  |
| +------------------------------+ |          | +------------------------+ |  from class: 2 waiting     |
| | [2] new                      | |          | | [2] new                | | Tip                        |
| +------------------------------+ |          | +------------------------+ |  (Hoya bubble)             |
| | [3] story                    | |          | | [3] story              | | Recent stars               |
| +------------------------------+ |          | +------------------------+ |                           |
| Stage progress / Homework / Tip  |          |   (left column ~60 %)      |   (right column ~40 %)    |
+----------------------------------+          +----------------------------+---------------------------+
 tabs: Today | Journey | Library               tabs centred under both columns
```

- Compact keeps today's single column in the same order.
- The three mission cards keep their slot order in every class (F-HW-001 §3.2): a collected card never moves.
- `[Profile]` keeps its visible label and the same place (top right) in every class.

## C. Journey, wide

```
+------------------------------------------+-----------------------------------------------+
| Heritage Journey                         |  Meet the Letters                  (Stage 1)  |
| Letters Life Rites Nature Crafts         |  The first 14 consonants come alive.          |
| Stage 1  [ <sel> ][ ][ ][ ][ ]           |                                               |
| Stage 2  [ ][ ][ ][ ][ ]                 |  (Hoya says hello)                            |
| Stage 3  [lock][lock][lock][lock][lock]  |                                               |
| Stage 4  [ ][lock]...                    |  Quests                                       |
|  ...                                     |  [1] Meet g, n, d, l        * * *    [[ Start ]]|
|                                          |  [2] Meet m, b, s, ng       * *      [ Start ]  |
| How the journey works                    |  [3] Meet the Vowels                 [ Start ]  |
|                                          |  Cards in this episode: 5 (3 collected)       |
+------------------------------------------+-----------------------------------------------+
   master pane (grid, cells have a max size)       detail pane = the same episode page as the phone's EpisodeDetail
```

- First selection = the episode of the learner's next quest; selected cell has a border and a "selected" screen-reader state.
- [ Start ] opens the full-screen quest player (a focused activity), back returns here with the same selection.
- On regular / compact the cell opens the episode page as a new screen, exactly like today.
- Cell kinds (F-STORY-005): a lesson cell shows the episode page; a placeholder ("coming soon") cell shows the coming-soon content; a stories-only cell shows its story list once that list is a reusable view, until then it navigates as on one pane and the selection stays where it was.

## D. Library, wide

```
+------------------------------------------+-----------------------------------------------+
| Heritage Library              12 of 42   |   [ card art, large ]                          |
| (All)(Letters)(Life)(Rites)(Nature)(Crafts)|                                              |
| +------+ +------+ +------+               |   Tteokguk                                     |
| |<sel> | | card | | lock |               |   떡국  tteokguk  (rice cake soup)              |
| +------+ +------+ +------+               |   [ Hear it ]  [ Flip ]  [ Share ]            |
| +------+ +------+ +------+               |   fact line                                    |
| | card | | lock | | card |               |                                               |
| ...                                      |                                               |
+------------------------------------------+-----------------------------------------------+
  3 columns in the master pane                detail pane = the card page (front / back)
```

- A locked card in the detail pane shows the card silhouette and where it is earned (no paywall, no "Premium" pill; D5).
- With F-STORY-004 in the build the master pane also holds the section tabs (Cards / Story time / Culture notes / Theme packs) and the Words card above the filter chips; only the Cards section has a detail pane, the other sections show their list at full width and open their screens as today.
- On regular the gallery has 3 columns and a tap opens the card screen; on compact 2 columns as today.

## E. Phone landscape: the soft portrait guard

```
phone in landscape, browser tab or installed app (844 x 390)
+---------------------------------------------------------------+
|                                                               |
|        (Hoya thinking)   (phone icon turning upright)         |
|                "Turn your phone upright"                      |
|                       [ Keep sideways ]                       |
|                                                               |
+---------------------------------------------------------------+
```

- Shown only when: phone-sized (short side under 600, long side at most 1000) AND landscape AND touch input AND not already allowed. (The lecture presenter is a separate root that never mounts the guard.)
- Rotating back upright removes it. [ Keep sideways ] removes it and remembers the choice on this device; every screen then works at this size (one pane, scrolls).
- Never shown on tablets, on a mouse-driven desktop window, or on `/present`.
- On installed Android phones the app tries to stay upright by itself, so this rarely appears there; on iPhone it is the only mechanism.

## F. Tablet portrait (regular)

```
+----------------------------------+
|                                  |   <- background fills the window
|   +--------------------------+   |
|   | centred reading column   |   |   <- ~720 wide at most; bigger gutters
|   | (any screen: quest,      |   |
|   |  results, profile ...)   |   |
|   |                          |   |
|   +--------------------------+   |
|   tabs centred                   |
+----------------------------------+
```

- Every screen that has not been redesigned still looks intentional here: the same phone layout in a centred column, with the page background and the tab bar edge to edge.

## G. Pane states

```
loading            +---- master ----+---- detail -----+
                   | skeleton rows  | skeleton block  |
                   +----------------+-----------------+

empty detail       master has no selectable item (new learner, no shipped episodes)
                   detail: Hoya + "Pick something to see it here" (placeholder)

error              detail failed to render an item: message in the pane only,
                   master keeps working; [ Try again ] in the pane

preview cell       detail: the coming-soon content of the episode (no lock, no paywall)
                   with "New episodes appear as they are released"

rotation           selection kept; going to one pane does not navigate;
                   going back to two panes shows the remembered item
```

## H. Tab bar and overlays on a wide window

```
+------------------------------------------------------------------+
|                         (content, two panes)                     |
+------------------------------------------------------------------+
|        +---------------------------------------------------+     |
|        |     Today        Journey        Library           |     |   <- tab row centred, inside the content width,
|        +---------------------------------------------------+     |      clears a landscape notch and the home bar
+------------------------------------------------------------------+
         [ banner: Offline - everything still works ]   <- centred, above the tab bar, never over a CTA
```

## Interaction points

- Resize / rotate / Split View -> the class is recomputed live; no reload, no flash of the wrong layout (first frame is compact until the window size is known).
- Master item tap (wide) -> detail pane updates, selection state moves, focus stays on the item; (regular / compact) -> navigates to the same content as a full screen (`journey/episode`, `library/card`).
- [ Start ] in the episode pane -> `quest/player` full screen; back -> same screen, same selection.
- Keyboard: Tab / Shift-Tab master then detail; arrow keys move between grid cells; Enter selects; Esc does nothing (no modal on these screens).
- [ Keep sideways ] -> stores the choice (`device:layout`), removes the guard, unlocks orientation.
- Mouse hover: only a subtle state; nothing is hover-only.

## Navigation graph

Enter from: any launch; window resize / rotation (class change); `home/todays-mission`, `journey/grid`, `library/gallery` (existing tabs)
Exit to: `quest/player` (from [ Start ]), `library/card-detail` (single pane), `journey/episode` (single pane), `profile/settings` ([Profile]), `pwa/system-banners` (banners keep their own spec)
Never shown with: `/present` (the lecture presenter owns its own full-bleed layout and ignores the guard)

## States

- **success**: the class is known, the right layout shows, selection is remembered.
- **loading**: skeletons (G); until the window size is known the compact layout renders (no pane flash).
- **empty**: no shipped episode / no card yet -> placeholder in the detail pane (G).
- **error**: pane-local message and retry; the other pane and the tab bar keep working.
- **offline**: nothing changes; everything in these panes is local content.
- **reduced motion**: pane changes are instant; the guard has no turning animation.
- **200 % zoom**: the window counts as half as wide, so a wide layout drops to regular / compact and reflows to one column with no sideways scrolling.

## Data needs

- reads: window size (`useWindowDimensions`), pointer type (`matchMedia('(pointer: coarse)')`), safe-area insets (`SafeAreaInsetsContext`), `device:layout` (allowed sideways), learner progress (next quest, collected cards) for the first selection, the UI locale (copy, string length)
- writes: `device:layout` `{ v: 1, allowedSideways }` only; nothing about layout goes to the server
- telemetry: `layout.observed` (class, form, orientation, panes, standalone), `layout.guard_shown`, `layout.guard_dismissed` (via rotated | keep_sideways)

## Open questions

- Left navigation rail instead of a centred bottom tab bar on wide windows: needs the react-navigation v7 upgrade; confirm the owner wants it later.
- Should Home on wide put the next quest as one large hero card instead of three equal cards (UX-19)? This wireframe keeps the three-card structure.
- Master pane width: 400 is a starting number; try 360 and 440 on a real iPad.
- Should the guard appear on a phone only when the app is installed, never in a browser tab? The spec shows it in both, with the escape button.
