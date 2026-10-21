# Journey/Topic pages — the five themes on page 1, Topic Pack columns on the pages beside it (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §0 item 6, §6.1 "Journey topic pages", §6.2 (pack order), §6.3 (entitlement), §12.2 (`topicPacks`, `pack.<key>` off), §13, §14 (visual and accessibility) · owner decision OD-2 (2026-10-21) · amends one line of `design/wireframes/journey/grid.md` (horizontal scroll) · extends `journey/grid.md`, `journey/grid-with-stories.md`, `journey/grid-plan-and-access.md` and `layout/wide.md` C
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone.
Code (row CM-50b): `apps/mobile/src/screens/journey/JourneyScreen.tsx`, `apps/mobile/src/components/JourneyGrid.tsx`, the pure layout in `apps/mobile/src/logic/journey-grid.ts` and `logic/layout/pane-sizes.ts` (`journeyCellSize`, `journeyGridMaxWidth`), the pack order from `content/packs/order.json` through `CatalogPack.order` (row CM-50a)
Mock: `design/screens/journey-topic-pages/` (`mock/topic-pages.html`; shots at 320, 768 and the two-pane 1280 window)
Notation: `[[ X ]]` the one primary action, `[ X ]` a button, `( x )` a text placeholder, `{ x }` content-driven, `<x>` a runtime state, `~` an empty, unlabelled space.

## Scenario (Given-When-Then)

Given: a learner opens the Journey tab, and at least one Topic Pack is shown (status `ready`, `topicPacks` and `pack.<key>` on)
When: the Journey renders
Then: page 1 is the five themes exactly as today; a row of page dots and an arrow button show that more topics sit to the side; a swipe, an arrow button or (on web) an arrow key moves one whole page; each later page holds up to five pack columns with the same seven stage rows, and a pack's column header opens its pack page

## Screen goal

"Pick one cell to open." (secondary: see that more topics sit beside the five themes, and open one of them)

## What changes and what does not

| Part | Page 1 | Pages 2 and later |
|---|---|---|
| Title, purpose line, legend | today's, above the pager; never move | the same, shared |
| Page bar (dots, page name, arrows) | new, between the legend and the column headers, **only with two or more pages** | the same bar; it does not slide |
| Column headers | today's theme labels (glyph over the theme word), not buttons | pack headers: the `homeTheme` glyph over the pack word, a **button** that opens the pack page |
| Stage rows | today's seven rows: header (number ring, title, one-liner, pill, Stage 1 buttons), five cells, notes | the same seven rows at the same heights; the header without the pill and the Stage 1 buttons; pack cells in rows 2, 3, 4, 6, 7; rows 1 and 5 empty |
| Cell size | `journeyCellSize` (54 dp wide at 320 px, 112 at 768, 76 in the 400 dp master pane) | the same width, the same heights |
| "How the journey works" card | under the pager, unchanged | the same card (it is outside the pager) |

With no pack to show (`topicPacks` off, every `pack.<key>` off, or no pack `ready`) the Journey is page 1 alone with no page bar: **exactly today's screen**, byte for byte the same layout.

## Box diagram — A. page 1 at 320 x 568, three pages (all eight packs shown)

```
+----------------------------------+
| Heritage Journey            (Aa) |  <- unchanged header
| (Every lesson, by stage and theme)|
| (legend: Next, In your plan)     |  <- unchanged; only when a mark is drawn
|                                  |
| ~~~~~~   (Five themes)   [  >  ] |  <- page bar: no left arrow on page 1 (its slot stays empty),
|          (*)( )( )               |     page name and dots centred, right arrow at the right end
|                                  |
|  gl    gl    gl    gl    gl      |  <- theme labels (not buttons), at the bottom of the header band
| Letters Food Holiday Nature Play |     (the band is one height on every page, see "Header band")
|                                  |
| (1) Hangul               (Open)  |  <- stage row, unchanged
|     (one-liner)                  |
| [gl ][gl ][gl ][gl ][gl ]        |  <- five theme cells, 54 dp wide, unchanged
| (2) Words                (Open)  |
| [gl ][gl ][gl ][gl ][gl ]        |
| ...  rows 3 to 7, unchanged      |
|                                  |
| +------------------------------+ |
| | How the journey works        | |  <- unchanged, outside the pager
| +------------------------------+ |
+----------------------------------+
  tabs (unchanged)
```

## Box diagram — B. page 2 at 320 x 568 (packs 1 to 5)

```
+----------------------------------+
| Heritage Journey            (Aa) |
| (Every lesson, by stage and theme)|
|                                  |
| [  <  ]    (Topics)      [  >  ] |  <- left arrow "Back to the five themes", right arrow "More topics, page 3 of 3"
|          ( )(*)( )               |
|                                  |
| [ gl  ][ gl  ][ gl  ][ gl  ][ gl  ] <- pack headers: buttons, 54 dp wide x 64 tall, homeTheme glyph
| [Count][Family][Moods][Town ][Day ]   over the pack word; tap -> journey/pack-page
|                                  |
| (1) Hangul                       |  <- stage header without pill
|     (one-liner)                  |
|  ~     ~     ~     ~     ~       |  <- row 1: empty, unlabelled space at cell height (no cell, no "coming later")
| (2) Words                        |
| [gl ][gl ][gl ][gl ][gl ]        |  <- L1 of each pack (levels[].stage = stage2)
| (3) Sentences                    |
| [gl ][gl ][gl ][gl ][gl ]        |  <- L2
| (4) Dialogue                     |
| [gl ][gl ][gl ][gl ][gl ]        |  <- L3
| (5) Stories                      |
|  ~     ~     ~     ~     ~       |  <- row 5: empty
| (6) Real use                     |
| [gl ][gl ][gl ][gl ][gl ]        |  <- L4
| (7) Self-expression              |
| [gl ][gl ][gl ][gl ][gl ]        |  <- L5
| +------------------------------+ |
| | How the journey works        | |
| +------------------------------+ |
+----------------------------------+
```

## Box diagram — C. page 3 at 320 x 568, a short page (packs 6 to 8)

```
| [  <  ]    (Topics)      ~~~~~~  |  <- left arrow "Back to topics, page 2 of 3"; last page: no right arrow
|          ( )( )(*)               |
| [ gl  ][ gl  ][ gl  ]  ~     ~   |  <- three pack headers at the same width; the rest of the row stays empty
| [Arts ][Science][Body]           |
| (2) Words                        |
| [gl ][gl ][gl ]  ~     ~         |  <- columns never stretch or shrink to fill the page
```

The first wave (OD-4) ships three packs, so the first release has **two** pages: page 2 holds Numbers & Time, People & Family and Feelings & Me and leaves two column slots empty. It has no right arrow, and its left arrow reads "Back to the five themes".

## Box diagram — D. 768 x 1024 (regular, one pane), page 2

```
+--------------------------------------------------------------+
| Heritage Journey                                        (Aa) |
| (Every lesson, by stage and theme)                           |
| [  <  ]          (Topics)          [  >  ]                   |  <- the bar is as wide as the grid (576), not the column (720)
|               ( )(*)( )                                       |
| [  gl   ][  gl   ][  gl   ][  gl   ][  gl   ]                |  <- pack headers 112 wide x 64 tall
| [ Count ][Family ][ Moods ][ Town  ][  Day  ]                |
| (1) Hangul                                                   |
|  ~          ~          ~          ~          ~               |
| (2) Words                                                    |
| [  gl  ][  gl  ][  gl  ][  gl  ][  gl  ]                     |  <- 112 dp square cells, as page 1
| ...                                                          |
+--------------------------------------------------------------+
```

## Box diagram — E. wide window, two panes (1280 x 800), page 2 with a pack page open

```
+---------------------------------------+-------------------------------------------+
| Heritage Journey                      | [<-]                                      |
| (Every lesson, by stage and theme)    | (badge) Numbers & Time                    |
| [ < ]      (Topics)       [ > ]       | ( Hoya intro bubble )                     |
|          ( )(*)( )                    | (ring) (2 levels done)                    |
| [ gl ][ gl ][ gl ][ gl ][ gl ]        | Levels                                    |
| [Count]<sel>[Family][Moods][Town][Day]|  Level 1 . Stage 2 (Count to ten)   (Done)|
| (1) Hangul                            |  Level 2 . Stage 3 (What time is it?)(Next)|
|  ~    ~    ~    ~    ~                |  ...                                      |
| (2) Words                             | Pack Check (after level 5)                |
| [gl][gl][gl][gl][gl]                  | Topic album: [card] [card] [badge]        |
| ...      master pane 400 dp           |              detail pane                  |
+---------------------------------------+-------------------------------------------+
```

- Two panes: a pack header tap shows the pack page in the detail pane and marks the header selected (`border.focus` at `borderWidth.thick`, the selected-cell look). A pack cell tap shows its level's episode page there, as a theme cell does. The master pane pages on its own; the detail pane keeps what it shows until another cell or header is tapped.
- One pane: a header tap pushes `journey/pack-page`; a pack cell tap pushes `episode/detail` for the level, as a theme cell does.

## Header band (one height on every page)

The pack headers are buttons, so they meet the target floor: 64 dp tall (`touchTarget.min`) and the column's width (54 dp at 320 px, above the §6.1 48 dp target; 65 dp from 375 px). Page 1's theme labels are about 41 dp tall today.

- While the page bar shows (two or more pages), every page's header band is `touchTarget.min` tall, plus today's `spacing.sm` under it. Page 1's theme labels sit at the **bottom** of the band, so the distance from the labels to the Stage 1 row is today's. Every stage row then starts at the same height on every page, and nothing moves sideways or up and down during a swipe.
- Page 1's cells, sizes, glyphs, words, states and rings are unchanged. Only the space above the theme labels grows, by the same change that adds the page bar. With one page (no packs), there is no bar and the band is today's.

## Stage rows on a pack page

- **Same heights.** Each stage row of a pack page takes the height of the same row on page 1, measured on page 1 (`onLayout`). A note under a page 1 row (the taste note, the stories note) leaves the same blank space under the pack row, so every row starts at the same height on every page.
- **Stage header.** The number ring, the title and the one-liner, as on page 1. The pill and the Stage 1 buttons (See your prize, Hangul Check) are page 1's: a stage's pill says how far its **themes** are open, which says nothing about a pack. The header's text keeps page 1's width, so it wraps as on page 1.
- **Rows 1 and 5.** An empty, unlabelled space at cell height: no sunken cell, no "coming later", no label, and nothing a screen reader stops on. Packs have no Stage 1 or Stage 5 level (§6.4).
- **Pack cell.** Drawn and labelled like a theme cell (`GridCell`): its stage-tinted border, its `homeTheme` glyph and the pack word under it, and the same marks (Next never, because packs never move the cursor; In your plan when a grown-up's plan holds the level; Not open yet under §6.3; the mastery ring of its pack level from row CM-20, §4.4). The label uses the theme-cell pattern with the pack's title in place of the theme's: "Stage 2 Words, Numbers & Time: lesson".

## Page order and what shows

- Pages 2 and later fill **five columns a page** in the order of `content/packs/order.json` (`CatalogPack.order`), skipping any pack not shown. With all eight packs: page 2 holds packs 1-5, page 3 holds packs 6-8.
- A pack is shown when its status is `ready` and both `topicPacks` and `pack.<key>` are on (§12.2). A hidden pack's column is skipped, so the packs after it move up one slot; a page left with no pack is not drawn.
- `topicPacks` off: page 1 alone, no bar. Progress, cards and badges stay (§12.2).

## Page bar

```
[ < ]   (page name)   [ > ]        <- one row, as wide as the grid
        ( )(*)( )                  <- the dots, under the page name
```

- **Dots**: one per page, the current one filled (`text.primary`), the others an outline (`border.shape`). Decorative: a screen reader reads the page from the arrows, the region names and the page-change announcement, so the dots are hidden from it.
- **Page name**: "Five themes" on page 1, "Topics" on every later page (§13: the topic pages are named "Topics" and the first page "Five themes"). One line at the caption size.
- **Arrows**: `Button`-sized round targets of `touchTarget.min` (64 dp, above the §6.1 48 dp target), the `arrow-left` and `arrow-right` glyphs at 28 dp. The right arrow shows while a later page exists, the left one on every page after page 1. A missing arrow leaves its slot empty, so the page name stays centred and the other arrow never moves.
- **Where**: directly above the column headers, so each arrow sits at an edge of the column-header row. At 320 px the five columns fill the whole row (5 x 54.4 + 4 x 4 = 288 dp), so the arrows cannot sit inside it (spec §6.1 says "at the right edge of the column-header row"; this pass puts them at the ends of the bar just above it and writes that back).
- The bar does not slide with the pages and is not sticky (it scrolls away with the title). A learner scrolled down to Stage 6 pages by swiping; the arrows are one scroll up.

## Interaction points

- **Swipe** (touch, trackpad): a horizontal swipe on the pager (the column headers and the stage rows) moves one whole page and snaps to it (`pagingEnabled`; on web `scroll-snap-type: x mandatory`). The gesture locks direction: a swipe that starts mostly vertical stays a vertical scroll of the screen, and a swipe that starts sideways never scrolls the screen (`directionalLockEnabled` on iOS; the platform's nested-scroll rule on Android; on web the outer page scrolls only vertically and the pager only sideways). A short or slow swipe settles back on the page it started from.
- **Right arrow** → the next page. **Left arrow** → the previous page. Exactly what a swipe does.
- **Arrow keys (web)**: Left and Right change the page while focus is in the page bar, in a pack page's column-header row, or on page 1's region (where focus lands after a page change, below). Up and Down are never taken. Home and End are not used.
- **After any page change** (swipe, arrow button or key): focus moves to the first column header of the new page; on page 1, which has no header button, to page 1's region (focusable by script only, `tabIndex -1`), which is read by its name. Then the page change is announced (below).
- **Pack header** → `journey/pack-page` (one pane) or the pack page in the detail pane (two panes). Sends `pack.opened { packId }` (§11.3, row CM-50b) on the pack page.
- **Pack cell** → `episode/detail` for that level, as a theme cell does (two panes: in the detail pane).
- **Theme cell, stage buttons, the legend, the how-it-works card**: unchanged.
- A page change sends no telemetry and writes nothing: the current page is kept in memory for the app session only.

## Navigation graph

Enter from: `Main` tab bar (Journey), always on **page 1** · `results/celebrate` (tabs reset, page 1) · Back from `journey/pack-page` → the page that holds that pack · Back from a pack level's `episode/detail` → the page it was opened from
Exit to: `episode/detail` (theme or pack cell) · `journey/pack-page` (pack header) · today's exits of `journey/grid.md` (stage prize, Hangul Check)

- **Where it opens**: the Journey tab always opens on page 1, and the Next marker is only ever on page 1 (packs never move the cursor). Coming back from a pack page or a pack level returns to the page that holds the pack. The current page is kept for the session only; it is never stored or sent.
- The Today mission's Explore slot and the grown-up planner open the pack page directly (`journey/pack-page.md`); its Back then lands on the Journey page that holds the pack.

## States

- **Success, three pages**: A, B, C. **Success, two pages (the first wave)**: page 1 and a short page 2.
- **One page** (no pack shown): today's `journey/grid.md`, no bar.
- **A pack hidden by its switch**: its column is skipped and the packs after it move up; a page with no pack left is not drawn, and the dots and arrows count only drawn pages.
- **A switch turns off while the learner is on a topic page** (remote config refetched on foreground): the Journey redraws on page 1 with no announcement; nothing is lost (§12.2).
- **Loading**: the pack list comes from the bundled catalogue, so pages draw with page 1; there is no loading state of their own.
- **Error** (progress unreadable): as `journey/grid.md`, on every page: cells without the completed look, one muted line, and the pages still work.
- **Free learner with gating on** (§6.3; today the switch is off until Stripe Live, so every pack level is open): pack cells of Stages 2-7 draw the Not open yet dotted ring, as theme cells do, and still open their episode page (the preview). Never a lock glyph, never "locked".
- **Large text (200 %)**: the stage headers and notes grow on every page alike (pack rows take page 1's measured heights), and the page name stays one line; nothing scrolls sideways inside a page. The pack word under a header glyph keeps the cell word's rule (`maxFontSizeMultiplier` 1, one line inside 50 dp), so a pack header never overflows its column. Page 1's theme labels are today's `Caption` and are not changed by this pass (on web the app sets text in px, so they keep their size; the mock draws them that way).

## Reduced motion

With reduced motion on (`useReducedMotion`, `platform/motion.ts`), an arrow button or key jumps to the new page with no slide (`scrollTo` without animation), and a swipe still works and settles on its page without the snap animation. Nothing else on the screen moves.

## Accessibility

- **Regions.** Each page is a labelled region: "Five themes" on page 1, "Topics, page 2 of 3" on later pages. Off-screen pages are hidden from assistive technology (`aria-hidden`, `importantForAccessibility="no-hide-descendants"`) and from the tab order, so a screen reader never reads a page the learner cannot see.
- **Arrows** say where they go: on page 1 "More topics, page 2 of 3"; on page 2 the left arrow "Back to the five themes" and the right arrow "More topics, page 3 of 3"; on page 3 the left arrow "Back to topics, page 2 of 3".
- **Announcement** after a page change, polite and after the focus move: "Topics, page 2 of 3" or "Five themes, page 1 of 3".
- **Pack header**: a button named "Numbers & Time. Opens the topic page."; its glyph and word are decorative (the name carries them), as on theme labels. A two-pane selected header is `aria-selected`.
- **Reading order**: header, legend, page bar (left arrow, right arrow), the page's column headers left to right, then each stage row (header text, cells left to right). **Tab stops** are only the controls: the Display button, the arrows, the pack headers, the cells and today's stage buttons. Text, the legend, the dots and empty slots are never focusable; rows 1 and 5 of a pack page hold nothing to read.
- **Tab moves between the pack headers**; Left and Right never move between headers, they page (as the spec says). From any header, a page change puts focus on the new page's first header, so focus is never stranded on a page that slid away.
- **Targets**: arrows and pack headers at least `touchTarget.min` (64) tall; pack headers and cells are the column's width, 54 dp at 320 px (above the §6.1 48 dp target), 64 or more from 375 px. Pack cells are Journey cells, so they share the recorded Journey-cell exception at 320 (F-LAYOUT-001 audit UX-25). The pack headers are a new kind of target in the same columns: row CM-50b widens that recorded exception to name them explicitly (by their `journey-pack-head-<key>` test ids), never as a blanket skip.
- **Contrast**: the filled dot `text.primary` and the outline dots `border.shape` on `surface.canvas`; the arrow glyphs `text.primary` in a `border.strong` ring; the pack word `text.primary`, the header glyph `text.secondary`.

## Data needs

- reads: the generated catalogue's `CatalogPack[]` (`order`, `key`, `titleEn` in the UI locale, `homeTheme`, `levels[].stage`, `levels[].episodeId`, `status`) · remote config `topicPacks` and `pack.<key>` (§12.2) · the learner's progress, plan and access marks as for theme cells · `useReducedMotion`
- writes: none (the current page lives in screen state for the session)
- telemetry: none for paging; `pack.opened { packId }` from the pack page (row CM-50b)

## Proposed copy (row CM-50b lands the strings with es and ko)

| Intended key | English | Where |
|---|---|---|
| `learner.journey.topics.pageName.themes` | Five themes | page bar, page 1 |
| `learner.journey.topics.pageName.topics` | Topics | page bar, later pages |
| `learner.journey.packWord.<key>` | Count · Family · Moods · Town · Day · Arts · Science · Body | under each pack glyph (header and cell); one word inside the 50 dp cell budget of `journey-theme-word-messages.test.ts`, the same test extended to these keys |
| `a11y.journeyTopics.next(n, total)` | More topics, page {n} of {total} | right arrow |
| `a11y.journeyTopics.backToThemes` | Back to the five themes | left arrow on page 2 |
| `a11y.journeyTopics.back(n, total)` | Back to topics, page {n} of {total} | left arrow on page 3 and later |
| `a11y.journeyTopics.region.themes` | Five themes | page 1 region |
| `a11y.journeyTopics.region.topics(n, total)` | Topics, page {n} of {total} | later regions |
| `a11y.journeyTopics.announce(name, n, total)` | {name}, page {n} of {total} | after a page change |
| `a11y.journeyTopics.packHeader(title)` | {title}. Opens the topic page. | pack header |

- Pack cells reuse `a11y.journeyCell` with the pack's title as the theme title; no new key.
- The page words never say "locked", "lost", "more to buy" or anything about age.
- Spanish and Korean drafts, for the length check only (MAR reviews the real ones in CM-50b): pack words `Contar, Familia, Ánimo, Ciudad, Día, Artes, Ciencia, Cuerpo` and `숫자, 가족, 마음, 동네, 하루, 예술, 과학, 몸`, every one inside the 50 dp budget. Spanish uses "temas" for the five themes; the topic pages need a different word ("Más temas" is one draft), because "Topics" and "themes" are both "temas".

## Notes for CM-50b (build risks)

- **Nested scrolling.** A paged horizontal `ScrollView` inside the screen's vertical one is the riskiest part: test the direction lock on iOS (`directionalLockEnabled`), Android (nested scrolling) and web (`scroll-snap-type: x mandatory` on the pager, vertical scroll on the page) in the e2e, including a diagonal swipe that starts mostly vertical.
- **Measured row heights.** Pack rows take page 1's measured heights (`onLayout`). Draw the pack pages only after page 1's first layout (they are off screen until then), so the first swipe never shows rows that jump into place; re-measure on a text-size or window change.
- **Equal columns.** Empty slots are spacers of the column width (`journeyCellSize`), not `flex: 1` items, so a short page keeps five-column geometry (README D7).

## Open questions

- **Sticky page bar.** The bar scrolls away with the title. A sticky bar would keep the arrows and pack names in reach at Stage 7, but it would also stick on page 1, which today has no sticky part. Default: not sticky; revisit after the first wave's numbers (`pack.opened`).
- **Same glyph twice.** Numbers & Time and People & Family both borrow `life`, so page 2 starts with two rice bowls; Town & Travel and Body & Sports both borrow `nature`. On the Journey only the glyph repeats (headers and cells draw no theme colour; cell borders are the stage's); on the pack page the badge colour repeats too. The pack words and titles tell them apart, and the first-wave reading of `pack.opened` should keep this in mind. A per-pack glyph would need new glyphs in `Icon/glyphs.ts` (not tokens); left for a later pass if the first wave shows confusion.
- **Discovery.** Whether learners find the topic pages from the dots and the arrow alone is a new hypothesis for this app (blueprint 01 has no sideways-paged map). The first release measures it: the share of learners with any `pack.opened` within 14 days of the first wave.
