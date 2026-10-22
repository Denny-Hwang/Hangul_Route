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
| Column headers | today's theme labels (glyph over the theme word), not buttons | pack headers: the `homeTheme` glyph over the pack word (a word of the pack's title, below), a **button** that opens the pack page |
| Stage rows | today's seven rows: header (number ring, title, one-liner, pill, Stage 1 buttons), five cells, notes | the same seven rows at the same heights; the header without the pill and the Stage 1 buttons; pack cells in rows 2, 3, 4, 6, 7; rows 1 and 5 empty, their headers muted and silent (below) |
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
| [Time ][Family][Feeling][Town][Day ]  over the pack word; tap -> journey/pack-page
|                                  |
| (1) Hangul                       |  <- muted (text.secondary), no one-liner, hidden from assistive technology
|                                  |     (page 1's measured height is kept)
|  ~     ~     ~     ~     ~       |  <- row 1: empty, unlabelled space at cell height (no cell, no "coming later")
| (2) Words                        |
| [gl ][gl ][gl ][gl ][gl ]        |  <- L1 of each pack (levels[].stage = stage2)
| (3) Sentences                    |
| [gl ][gl ][gl ][gl ][gl ]        |  <- L2
| (4) Dialogue                     |
| [gl ][gl ][gl ][gl ][gl ]        |  <- L3
| (5) Stories                      |  <- muted and silent, as row 1
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
| [  Time ][Family ][Feeling][ Town  ][  Day  ]                |
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
| [Time]<sel>[Family][Feeling][Town][Day]| Level 1 . Stage 2 (Count to ten)   (Done)|
| (1) Hangul                            |  Level 2 . Stage 3 (What time is it?)(Up next)|
|  ~    ~    ~    ~    ~                |  ...                                      |
| (2) Words                             | Pack Check (after level 5)                |
| [gl][gl][gl][gl][gl]                  | Topic album: [card] [card] [badge]        |
| ...      master pane 400 dp           |              detail pane                  |
+---------------------------------------+-------------------------------------------+
```

- Two panes: a pack header tap shows the pack page in the detail pane and marks the header selected (`border.focus` at `borderWidth.thick`, the selected-cell look; `accessibilityState { selected: true }` in React Native, `aria-current="true"` on web, because `aria-selected` is not valid on a button). A pack cell tap shows its level's episode page there, as a theme cell does. The master pane pages on its own; the detail pane keeps what it shows until another cell or header is tapped.
- One pane: a header tap pushes `journey/pack-page`; a pack cell tap pushes `episode/detail` for the level, as a theme cell does.

## Header band (one height on every page)

The pack headers are buttons, so they meet the target floor: 64 dp tall (`touchTarget.min`) and the column's width (54 dp at 320 px, above the §6.1 48 dp target; 65 dp from 375 px). Page 1's theme labels are about 41 dp tall today.

- While the page bar shows (two or more pages), every page's header band is **max(`touchTarget.min`, the height of page 1's theme labels as measured)** tall, plus today's `spacing.sm` under it. The labels are measured on page 1 (`onLayout`), the same way the stage rows are, and the band is re-measured on a text-size or window change. Page 1's theme labels sit at the **bottom** of the band, so the distance from the labels to the Stage 1 row is today's. Every stage row then starts at the same height on every page, and nothing moves sideways or up and down during a swipe.
- Why the measured height: page 1's labels are today's `Caption` (`JourneyGrid.tsx`), which sets no `maxFontSizeMultiplier`, so on iOS and Android they grow with the system text size. At 150-200 % a glyph plus a word such as "Holiday" can wrap inside a 54 dp column and pass 64 dp. A fixed 64 dp band would then clip the labels or push them over the Stage 1 row; the measured band grows with them, and the pack headers (64 dp, their word capped at 1x) sit at its bottom too.
- Page 1's cells, sizes, glyphs, words, states and rings are unchanged. Only the space above the theme labels grows, by the same change that adds the page bar. With one page (no packs), there is no bar and the band is today's.
- **Owner to confirm (README D3).** Spec §6.1 says page 1 is "exactly as today". With packs shown, the page bar and this band add space above page 1's labels; nothing else on page 1 changes. The §6.1 write-back is marked as a CM-D3 proposal pending the owner's confirmation.

## Stage rows on a pack page

- **Same heights.** Each stage row of a pack page takes the height of the same row on page 1, measured on page 1 (`onLayout`). A note under a page 1 row (the taste note, the stories note) leaves the same blank space under the pack row, so every row starts at the same height on every page.
- **Stage header** (rows 2, 3, 4, 6 and 7). The number ring, the title and the one-liner, as on page 1. The pill and the Stage 1 buttons (See your prize, Hangul Check) are page 1's: a stage's pill says how far its **themes** are open, which says nothing about a pack. The header's text keeps page 1's width, so it wraps as on page 1.
- **Rows 1 and 5.** An empty, unlabelled space at cell height: no sunken cell, no "coming later", no label, and nothing a screen reader stops on. Packs have no Stage 1 or Stage 5 level (§6.4). Their stage header keeps page 1's measured height but is drawn **muted** (the number ring in `border.subtle`, the title in `text.secondary`) with **no one-liner**, and is hidden from assistive technology on every platform (`aria-hidden` on web, `importantForAccessibility="no-hide-descendants"` on Android, `accessibilityElementsHidden` on iOS; the shared helper of "Accessibility"). So the row numbers still run 1 to 7 down the page, and nothing reads as content that is missing or coming later.
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
- **Page name**: "Five themes" on page 1, "Topics" on every later page (§13: the topic pages are named "Topics" and the first page "Five themes"). Caption size, centred between the arrow slots; it **may wrap to two lines** at large text or in a longer locale (es "Más para aprender" is about 186 dp at 150 %, wider than the space between the arrows), and is never capped with `maxFontSizeMultiplier` or cut. The bar's height is measured once (the tallest page name at the current text size) and shared by every page, so the bar never changes height on a page change and the rows below still line up.
- **Arrows**: `Button`-sized round targets of `touchTarget.min` (64 dp, above the §6.1 48 dp target), the `arrow-left` and `arrow-right` glyphs at 28 dp. The right arrow shows while a later page exists, the left one on every page after page 1. A missing arrow leaves its slot empty, so the page name stays centred and the other arrow never moves.
- **Where**: directly above the column headers, so each arrow sits at an edge of the column-header row. At 320 px the five columns fill the whole row (5 x 54.4 + 4 x 4 = 288 dp), so the arrows cannot sit inside it (spec §6.1 says "at the right edge of the column-header row"; this pass puts them at the ends of the bar just above it and writes that back).
- The bar does not slide with the pages and is not sticky (it scrolls away with the title). A learner scrolled down to Stage 6 pages by swiping; the arrows are one scroll up.

## Interaction points

- **Swipe** (touch, trackpad): a horizontal swipe on the pager (the column headers and the stage rows) moves one whole page and snaps to it (`pagingEnabled`; on web `scroll-snap-type: x mandatory`). The gesture locks direction: a swipe that starts mostly vertical stays a vertical scroll of the screen, and a swipe that starts sideways never scrolls the screen (`directionalLockEnabled` on iOS; the platform's nested-scroll rule on Android; on web the outer page scrolls only vertically and the pager only sideways). A short or slow swipe settles back on the page it started from.
- **Right arrow** → the next page. **Left arrow** → the previous page. Exactly what a swipe does.
- **Arrow keys (web)**: Left and Right change the page while focus is in the page bar, in a pack page's column-header row, or on page 1's region (where focus lands after a page change, below). Up and Down are never taken. Home and End are not used.
- **After any page change** (swipe, arrow button or key): focus moves to the first column header of the new page, and then the page change is announced (below). On page 1, which has no header button, focus moves to page 1's region (focusable by script only, `tabIndex -1`), whose name already says the page ("Five themes, page 1 of 3"), so **no announcement follows**: page 1 is read once. The focus move never scrolls the screen (web `focus({ preventScroll: true })`): a learner who swipes at Stage 6 stays at Stage 6. Only after a keyboard page change (arrow key, or Enter on an arrow button) does the new header scroll into view when it is off screen, so the keyboard user sees where focus went.
- **Pack header** → `journey/pack-page` (one pane) or the pack page in the detail pane (two panes). Sends `pack.opened { packId }` (§11.3, row CM-50b) on the pack page.
- **Pack cell** → `episode/detail` for that level, as a theme cell does (two panes: in the detail pane).
- **Theme cell, stage buttons, the legend, the how-it-works card**: unchanged.
- A page change sends no telemetry and writes nothing: the current page is kept in memory for the app session only.

## Navigation graph

Enter from: `Main` tab bar (Journey), always on **page 1** · `results/celebrate` (tabs reset, page 1) · Back from `journey/pack-page` → the page that holds that pack · Back from a pack level's `episode/detail` → the page it was opened from
Exit to: `episode/detail` (theme or pack cell) · `journey/pack-page` (pack header) · today's exits of `journey/grid.md` (stage prize, Hangul Check)

- **Where it opens**: the Journey tab always opens on page 1, and the Next marker is only ever on page 1 (packs never move the cursor). The rule for a screen the tab bar keeps mounted: **every Journey tab focus** (a tab press, or a return from another tab) resets the pager to page 1 with no animation. The page kept for the session is used only for **Back** from a pack page or a pack level, which returns to the page that holds the pack. It is never stored or sent. Row CM-50b covers both in its e2e (tab away and back lands on page 1; Back from a pack page lands on its page).
- **A pack page opened from outside the Journey** (the Today mission's Explore slot, the grown-up planner's hand-off, a pack card's "from" line on `library/card-detail`) opens the pack page directly (`journey/pack-page.md`). Opening it this way first applies the tab-focus reset and then **sets the session page to the page that holds that pack**, so the pack page's Back lands on that topic page. A plain Journey tab press still opens page 1. A planner hand-off also leaves the grown-up zone and ends the grown-up session first (`journey/pack-page.md` "Navigation graph").

## States

- **Success, three pages**: A, B, C. **Success, two pages (the first wave)**: page 1 and a short page 2.
- **One page** (no pack shown): today's `journey/grid.md`, no bar.
- **A pack hidden by its switch**: its column is skipped and the packs after it move up; a page with no pack left is not drawn, and the dots and arrows count only drawn pages.
- **A switch turns off while the learner is on a topic page** (remote config refetched on foreground): the Journey redraws on page 1; nothing is lost (§12.2). If focus was on a pack header or a pack cell, which no longer exists, focus moves to the screen title ("Heritage Journey", focusable by script only, `tabIndex -1`), because with one page there is no page region; it is read once and nothing is announced.
- **Loading**: the pack list comes from the bundled catalogue, so pages draw with page 1; there is no loading state of their own.
- **Error** (progress unreadable): as `journey/grid.md`, on every page: cells without the completed look, one muted line, and the pages still work.
- **Free learner with gating on** (§6.3; today the switch is off until Stripe Live, so every pack level is open): pack cells of Stages 2-7 draw the Not open yet dotted ring, as theme cells do, and still open their episode page (the preview). Never a lock glyph, never "locked".
- **Large text (200 %)**: the stage headers and notes grow on every page alike (pack rows take page 1's measured heights), and the page name wraps to two lines when it needs to, inside a bar of one measured height ("Page bar"); nothing scrolls sideways inside a page. The 8 dp dots do not grow with text, so a learner at large text tells page 2 from page 3 by the arrow labels and the page name; CM-50b tries the dots at the caption size scaled by the font scale and keeps whichever the 200 % shot reads better (open question below). The pack word under a header glyph keeps the cell word's rule (`maxFontSizeMultiplier` 1, one line inside 50 dp), so a pack header never overflows its column. Page 1's theme labels are today's `Caption` and are not changed by this pass: on web the app sets text in px, so they keep their size (the mock draws them that way, so its 200 % shots show the web build only); on iOS and Android they grow with the system text size, and the header band grows with them ("Header band").

## Reduced motion

With reduced motion on (`useReducedMotion`, `platform/motion.ts`), an arrow button or key jumps to the new page with no slide (`scrollTo({ animated: false })`; web `behavior: 'instant'`). A swipe follows the finger and settles with the platform's own paging (`pagingEnabled`; web scroll snap with `scroll-behavior: auto`): on iOS and Android that short settle is drawn by the OS and cannot be turned off through `pagingEnabled`, and it moves only as far as the finger left it. CM-50b records this in its risks; a custom pager that snaps with `animated: false` on release is the fallback if the settle is ever judged a motion problem. Nothing else on the screen moves.

## Accessibility

- **Regions.** Each page is a labelled region: "Five themes, page 1 of 3" on page 1, "Topics, page 2 of 3" on later pages. Off-screen pages are hidden from assistive technology on every platform (web `aria-hidden` and `inert`; Android `importantForAccessibility="no-hide-descendants"`; iOS `accessibilityElementsHidden`, because the Android prop does nothing for VoiceOver) and from the tab order, so a screen reader never reads a page the learner cannot see. One shared helper sets all three, and rows 1 and 5 of a pack page use the same helper.
- **Arrows** say where they go: on page 1 "More topics, page 2 of 3"; on page 2 the left arrow "Back to the five themes" and the right arrow "More topics, page 3 of 3"; on page 3 the left arrow "Back to topics, page 2 of 3".
- **Announcement** after a page change to page 2 or later, polite and after the focus move: "Topics, page 2 of 3". A change back to page 1 is not announced: focus lands on page 1's region, whose name "Five themes, page 1 of 3" says it once.
- **Pack header**: a button named "Numbers & Time. Opens its levels."; its glyph and word are decorative (the name carries them), as on theme labels. The name never says "topic page", which on these screens names pages 2 and later ("Topics, page 2 of 3") and, in the Library, a word topic's screen. A two-pane selected header carries `accessibilityState { selected: true }` (React Native) and `aria-current="true"` (web); `aria-selected` is not used, because it is not valid on a button.
- **Reading order**: header, legend, page bar (left arrow, right arrow), the page's column headers left to right, then each stage row (header text, cells left to right). On a pack page, rows 1 and 5 contribute nothing: their muted headers are hidden from assistive technology and their space is empty. **Tab stops** are only the controls: the Display button, the arrows, the pack headers, the cells and today's stage buttons. Text, the legend, the dots and empty slots are never focusable; rows 1 and 5 of a pack page hold nothing to read.
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
| `learner.journey.packWord.<key>` | Time · Family · Feeling · Town · Day · Arts · Science · Body | under each pack glyph (header and cell); a word of the pack's title in the UI locale, one word inside the 50 dp cell budget of `journey-theme-word-messages.test.ts`, the same test extended to these keys (rule below) |
| `a11y.journeyTopics.next(n, total)` | More topics, page {n} of {total} | right arrow |
| `a11y.journeyTopics.backToThemes` | Back to the five themes | left arrow on page 2 |
| `a11y.journeyTopics.back(n, total)` | Back to topics, page {n} of {total} | left arrow on page 3 and later |
| `a11y.journeyTopics.region.themes(total)` | Five themes, page 1 of {total} | page 1 region (only while the page bar shows; with one page there is no region) |
| `a11y.journeyTopics.region.topics(n, total)` | Topics, page {n} of {total} | later regions |
| `a11y.journeyTopics.announce(name, n, total)` | {name}, page {n} of {total} | after a page change to page 2 or later (page 1's region name says it, so no announcement there) |
| `a11y.journeyTopics.packHeader(title)` | {title}. Opens its levels. | pack header |

- Pack cells reuse `a11y.journeyCell` with the pack's title as the theme title; no new key.
- The page words never say "locked", "lost", "more to buy" or anything about age.
- 17 new strings on this screen (9 keys plus 8 pack words); with the pack page's 20 the CM-50b row lands **about 37**, each in en, es and ko (spec §17, row CM-50b).

### The pack word rule

The word under a pack glyph is **a word of the pack's title** in the UI locale, so a learner who taps it lands on a page whose title contains it. Where the first title word does not fit the 50 dp line, the next one that does is used.

| Pack (title) | Word | Why this word |
|---|---|---|
| Numbers & Time | Time | "Numbers" estimates 56.8 dp, over the 50 dp line; "Time" is the other title word (31.1 dp) |
| People & Family | Family | "People" fits too (43.6 dp); "Family" matches the reused `family` word topic |
| Feelings & Me | Feeling | "Feelings" estimates 52.9 dp, over the line, and "Me" alone does not name the topic, so the word is the title word's singular "Feeling" (45.9 dp), the one exception to the rule, recorded here |
| Town & Travel · Day & Study · Arts & Music · Science & Inventions · Body & Sports | Town · Day · Arts · Science · Body | the first title word, each inside the line |

- Spanish and Korean follow the same rule against their own titles, which CM-50b writes with the words: Korean drafts `숫자, 가족, 마음, 동네, 하루, 예술, 과학, 몸`, each a word of the spec's Korean title (숫자와 시간, 사람과 가족, 마음과 나, ...): the first word, except 가족 from 사람과 가족, which matches English "Family" and the reused `family` word topic. Spanish drafts `Hora, Familia, Sentir, Ciudad, Día, Artes, Ciencia, Cuerpo`, each to be a word of the Spanish title MAR settles ("Números" 56.8 dp and "Emociones" 69.2 dp do not fit, so the Spanish titles carry "hora" and "sentir"). "Sentir" is the one verb among the column words; MAR in CM-50b first tries the noun "Emoción" against the 50 dp line and keeps "Sentir" only if it does not fit. The earlier drafts "Count", "Moods", "Contar" and "Ánimo" are withdrawn: none is a title word, and "Ánimo" reads as "cheer up".

### Terminology: themes, topics and word topics (for the F-I18N-001 §3.10 glossary, row CM-50b)

The five Journey columns are **themes**; a Topic Pack is a **topic**; the Library's vocabulary sets are **word topics**. Today's dictionary already uses one word for two of these in each locale (es "tema" for both the themes and the word topics; ko 주제 for both), so the topic pages take a word of their own and leave the shipped words alone:

| Concept | English | Spanish | Korean |
|---|---|---|---|
| the five Journey columns (page 1's name) | themes, "Five themes" | temas, "Cinco temas" (the shipped word) | 주제, "다섯 가지 주제" (the shipped word; 가지 counts kinds, as 해요체 UI Korean does; it is the page-bar name, not a 50 dp cell word) |
| a Topic Pack (the pack page's pill, the album, the Passport chip) | Topic, "Topic album", "Topics" | Unidad, "Álbum de la unidad", "Unidades" | 꾸러미, "꾸러미 앨범", "꾸러미" |
| pages 2 and later (page name, regions, arrows) | "Topics", "More topics, page 2 of 3" | "Más para aprender", "Más para aprender, página 2 de 3" | "더 배우기", "더 배우기, 3쪽 중 2쪽" |
| the Library's vocabulary sets (shipped, unchanged) | word topic, "Pick a topic" | tema de palabras | 낱말 주제 |

- Spanish never uses "temas" on the topic pages, and Korean never uses 주제 there, so page 1's name and the later pages' names are never the same word. 꾸러미 (a bundle) is the word Korean schools use for a take-home learning pack (학습 꾸러미); 토픽 is not used, because learners read it as TOPIK, the proficiency test.
- English keeps "Topics" as the page name (§13) and the pill "Topic". These drafts are proposals for MAR in CM-50b, which adds the chosen terms to the §3.10 glossary; they are not signed strings.

## Notes for CM-50b (build risks)

- **Nested scrolling.** A paged horizontal `ScrollView` inside the screen's vertical one is the riskiest part: test the direction lock on iOS (`directionalLockEnabled`), Android (nested scrolling) and web (`scroll-snap-type: x mandatory` on the pager, vertical scroll on the page) in the e2e, including a diagonal swipe that starts mostly vertical.
- **Measured row heights.** Pack rows take page 1's measured heights (`onLayout`). Draw the pack pages only after page 1's first layout (they are off screen until then), so the first swipe never shows rows that jump into place; re-measure on a text-size or window change.
- **Equal columns.** Empty slots are spacers of the column width (`journeyCellSize`), not `flex: 1` items, so a short page keeps five-column geometry (README D7).
- **Header band at large system text.** The band takes max(`touchTarget.min`, page 1's measured label height) + `spacing.sm` on every page and is re-measured on a font-scale change. Add a native (or React Native web with a 2x font scale) e2e at `fontScale` 2 that checks no theme label overlaps the Stage 1 row on page 1 and the pack headers sit at the band's bottom.
- **Android system Back gesture.** With gesture navigation, a horizontal swipe that starts at the screen edge is the system Back, which at the Journey tab root can leave the app or switch tabs. Start the pager's gesture region inside the system-gesture insets, so edge swipes stay the system's, and rely on a swipe from inside the grid or on the arrow buttons for paging. The Android e2e covers an edge swipe (system Back, no page change) and an inside swipe (one page).
- **Focus without scrolling.** The focus move after a page change never scrolls the screen; only a keyboard page change scrolls the new header into view ("Interaction points"). The web e2e checks both: a swipe at Stage 6 keeps the scroll position, Right arrow from the bar shows the focused header.
- **Tab focus resets the page.** Every Journey tab focus resets to page 1; Back from a pack page or a pack level returns to the session's page ("Navigation graph"). Both are e2e cases, plus: Explore slot, then the pack page, then Back lands on the pack's topic page (not page 1).
- **Focus and announcement rule.** A unit test of the pager's focus rule: a change to page 2 or later focuses the first header and announces once; a change to page 1 focuses the region named "Five themes, page 1 of N" and announces nothing; a switch-off under focus moves focus to the title and announces nothing. A render test checks that off-screen pages and rows 1 and 5 carry `aria-hidden`, `importantForAccessibility="no-hide-descendants"` and `accessibilityElementsHidden` together (through the shared helper).
- **Large text in Spanish.** Add an es 200 % shot or e2e: the page name wraps inside the bar and never overlaps an arrow.
- **A switch off under focus.** When a remote-config refetch hides the focused pack, focus moves to page 1's region ("States"); a unit test of the pager's focus rule covers it.

## Open questions

- **Sticky page bar.** The bar scrolls away with the title. A sticky bar would keep the arrows and pack names in reach at Stage 7, but it would also stick on page 1, which today has no sticky part. Default: not sticky; revisit after the first wave's numbers (`pack.opened`).
- **Same glyph twice.** Numbers & Time and People & Family both borrow `life`, so page 2 starts with two rice bowls; Town & Travel and Body & Sports both borrow `nature`. On the Journey only the glyph repeats (headers and cells draw no theme colour; cell borders are the stage's); on the pack page the badge colour repeats too. The pack words and titles tell them apart, and the first-wave reading of `pack.opened` should keep this in mind. A per-pack glyph would need new glyphs in `Icon/glyphs.ts` (not tokens); left for a later pass if the first wave shows confusion.
- **"Topic" twice in English.** The Library's word topics ("Pick a topic", "New topic") and the Topic Packs share the English word "topic" (Spanish and Korean now use different words, above). The packs reuse word topics through `vocabTopicKey`, so a "numbers" word topic sits next to the "Numbers & Time" topic. Default: keep "Topics" (§13); the first-wave data watches for confusion (support notes and `pack.opened` against word-topic opens), and a rename is a later copy pass.
- **Dots at large text.** The 8 dp dots do not grow with text. Default: keep them 8 dp and rely on the page name and the arrow labels; CM-50b may scale them with the font scale if the 200 % shot shows that helps.
- **Discovery.** Whether learners find the topic pages from the dots and the arrow alone is a new hypothesis for this app (blueprint 01 has no sideways-paged map). The first release measures it: the share of learners with any `pack.opened` within 14 days of the first wave.
