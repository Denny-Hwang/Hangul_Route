# Journey topic pages, pack page, Hidden Heritage and Passport (design mocks v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md`, row **CM-D3** of the section 17 table, as updated for owner decision OD-2 (2026-10-21). The mocks draw §0 item 6, §6.1 "Journey topic pages", §6.2 (pack order), §6.3 (entitlement), §6.4 (the pack template), §7.1 F7 (Hidden Heritage, OD-10), §7.5 (Passport), §12.2 (`topicPacks`, `pack.<key>` off) and §14 (visual and accessibility).
Wireframes: `design/wireframes/journey/topic-pages.md`, `journey/pack-page.md`, `minigame/hidden-heritage.md` (with the scene style guide), `route/passport.md`; one line of `journey/grid.md` amended.
Built by: CM-50b (topic pages, pack page), CM-36 and CM-37 (Hidden Heritage engine, scenes and slide kind), CM-60 (Passport). The real strings land there with es and ko; every drawn string here is a dictionary value, an OD-12 stage one-liner, or a proposal listed in the wireframes with its intended key.

## What is here

| File | What it shows |
|---|---|
| `mock/topic-pages.html` | the Journey with all eight packs: page 1 (the five themes), page 2 (packs 1-5), page 3 (packs 6-8, a short page); a working pager: swipe (scroll snap), the arrow buttons, Left and Right keys, focus moved to the new page's first column header, the page-change announcement, off-screen pages `inert`; two panes from 900 px with the pack page in the detail pane. Hash options: `#page=2`, `#select=numbers-time` (the selected header), `#peek=0.45` (a frame in the middle of a swipe) |
| `mock/topic-pages-wave1.html` | the first wave (OD-4): page 1 and a short page 2 with three packs, no right arrow |
| `mock/topic-pages-off.html` | `topicPacks` off: page 1 alone, no bar: today's screen |
| `mock/pack-page.html`, `mock/pack-page-preview.html` | the pack page, open (state A, the gating switch off, today) and the free-learner preview (state B) |
| `mock/hidden-heritage.html` | the Food Volume 2 Stage 2 market scene (§5.3: a food stall on a market day, targets 밥, 국, 숟가락 from the taught table set) in tokens; `#state=ask`, `found`, `miss`, `hint`, `end`, and `debug` (every spot outlined) |
| `mock/hidden-heritage-slide.html` | the projector slide on the 1280 presenter stage |
| `mock/passport.html` | this week's quests, milestone stamps, stages |
| `mock/topic-pages.css` | the one stylesheet |
| `shots/` | Chromium renders: 320 px at 2x, 768 and 1280 at 1x; `-text200` is the browser text size at 200 %; `-first` is the first screen only |

**The mock is a design reference, not shipped code.**

- **Tokens.** Every colour in `topic-pages.css` is a token of `packages/design-system/src/tokens.ts`, and so is every size and spacing value except the projector-slide geometry listed under Constants (the presenter stage is drawn in stage units). Each token is copied once into a custom property named after it (generated from the tokens module): `--spacing-xl` is `spacing.xl`, `--colors-theme-life` is `colors.theme.life`. No new token is needed.
- **Drawn parts.** Glyphs come from `Icon/glyphs.ts` (theme glyphs, `arrow-left`, `arrow-right`, `speaker`, `check`, `star`, `book`, `leaf`, `card`, `check-circle`, `flag`, tab glyphs); the Next triangle and the Not open yet dotted ring follow `RouteMarkers/geometry.ts` (8 dashes, 55 / 45); Hoya is the static port of `Hoya.tsx`. The Hidden Heritage scene is drawn by hand in token colours on the 400 x 300 scene-art canvas, as a stand-in for the kit's renderer.
- **Units.** Text is in rem, so the 200 % shots enlarge every line. The Journey cell word, the pack word, page 1's theme labels and the tab labels stay in dp, as the app's web build draws them (the cell and pack words have `maxFontSizeMultiplier` 1; the tab label is capped, LR-4; the web build sets text in px).
- **Annotations.** The monospace line in the detail pane of a page without a selection is a board note, not UI.

Open any file in a browser (`design/screens/journey-topic-pages/mock/topic-pages.html#page=2`). Links and buttons are placeholders except the pager.

## Constants

Values that are not tokens. Each one derives from code or a token; CM-50b, CM-36 and CM-60 write the UI ones as named constants, never as bare literals (CLAUDE.md §4).

| Where | Value | Derived from |
|---|---|---|
| Journey cell, compact / regular / wide | glyph 20 / 24 / 28, ring 40 / 48 / 56, top padding 12 / 10 / 8, smallest height 76.1 / 82.1 / 88.1 | `journeyCellMetrics` and `journeyCellLayout` (`logic/journey-cell-layout.ts`) with `layout.mediaScale`; unchanged |
| Grid width cap | 576 | `journeyGridMaxWidth`: 5 x `layout.columns.journeyCellMax` (112) + 4 x `spacing.xs` |
| Page bar | as wide as the grid (the content width at 320 px, 576 at 768) | the grid, so the arrows sit at the edges of the column-header row |
| Header band while the bar shows | `touchTarget.min` + `spacing.sm` | the pack header's target height and today's gap under the labels |
| Pack page level ring | three segments, the compact cell ring size (40) | placeholder for row CM-D1 / CM-20, which own the mastery ring (§4.4) |
| Pack ring | five segments at 56, stroke 4 (`ROUTE_RING_STROKE` at the regular scale) | one segment per level (§6.4) |
| Hidden Heritage canvas | 400 x 300 (4:3) | the scene-art canvas (F-STORY-002 §3.9) |
| Hidden Heritage spot | at least 75 x 75 canvas units, 11 apart | 54 dp at 320 px (288 dp scene), 64 dp (`touchTarget.min`) at 375 px (343 dp scene); style guide H-1, H-2 |
| Projector slide | scene 720 x 540 stage units; word at `presenter.size.display` (140), romanization at `presenter.size.prompt` (56), meaning at `presenter.size.title` (80), kind label at `presenter.size.caption` (28) | the 1280-unit presenter stage (`presenter.stage`) |
| Projector slide spacing (mock only) | control bar 112 high (2 x `presenter.size.prompt`); slide padding 56 top (`presenter.size.prompt`), 40 sides (`presenter.size.body`), 14 bottom (`presenter.size.caption` / 2); column gap 40 (`presenter.size.body`); kind label top 7 (`presenter.size.caption` / 4); rule margin 28 (`presenter.size.caption`); control gap 14 | presenter sizes reused as stage-unit spacing in the mock; the built slide (CM-36) takes the presenter layout's own named constants (`lecture-presenter.md` C), never these literals |
| Font stack | the system stack | `typography.family.sans` is `'System'` |

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `topic-page1-320-first.png`, `topic-page1-320.png` | 320 x 568 | page 1: today's grid with the Next triangle on Stage 1 Food and the legend; the page bar (no left arrow, "Five themes", three dots, the right arrow) above the theme labels |
| `topic-page2-320.png` | 320, full page | page 2: five pack headers (54 x 64), the stage headers without pills, rows 1 and 5 empty under muted headers with no one-liner (hidden from assistive technology), L1-L5 in rows 2, 3, 4, 6, 7; Numbers & Time L1 completed |
| `topic-page3-320.png` | 320, full page | page 3: three packs at the same width, the rest of each row empty; no right arrow |
| `topic-swipe-320-first.png` | 320 x 568 | the middle of a swipe from page 1 to page 2: every stage row lines up across the two pages |
| `topic-wave1-page2-320.png` | 320, full page | the first wave: two pages, page 2 with three packs |
| `topic-off-320-first.png` | 320 x 568 | `topicPacks` off: today's screen, no bar |
| `topic-page1-320-text200.png`, `topic-page2-320-text200.png` | 320, 200 % text | the stage headers grow alike on both pages; the bar and the headers keep their targets; no sideways scroll |
| `topic-page1-768.png`, `topic-page2-768.png` | 768 x 1024 | one pane, 112 dp cells, the bar as wide as the grid |
| `topic-page2-pack-1280.png` | 1280 x 800 | two panes: page 2 in the 400 dp master pane with Numbers & Time's header selected, the pack page in the detail pane |
| `pack-page-320.png`, `pack-page-768.png`, `pack-page-320-text200.png` | 320, 768, 320 at 200 % | the pack page, open: badge, title, Topic pill, Hoya's intro, the pack ring, five levels (Done, and the pack's own outlined Up next tag), Pack Check, the topic album, Open level 2 |
| `pack-page-preview-320.png` | 320 | the free-learner preview: the dotted ring and "Not open yet" on each level, the album shown, the preview card with See a preview, Ask a grown-up, Back to open lessons; no primary button |
| `hidden-heritage-ask-320.png` | 320 | the prompt 국 (guk) with the Hear button, the market stall, three empty found slots |
| `hidden-heritage-spots-320.png` | 320 | every spot outlined (board view): six spots, each at least 54 dp |
| `hidden-heritage-miss-320.png`, `-hint-320.png` | 320 | 국 (guk) found, its slot showing the word with its romanization; the prompt 밥 (bap); a miss (the amber ring with its casing on the side dishes, Hoya "Look again"), then the look-here ring (`feedback.info`, dashed, inside the spot) on the rice bowl |
| `hidden-heritage-end-320.png` | 320 | You found them all: each word with romanization and its meaning |
| `hidden-heritage-found-768.png` | 768 | the prompt on one row, the scene at 720 |
| `hidden-heritage-slide-1280.png` | 1280 x 720 | the projector slide, build b2 (밥, bap, rice, the ring on the rice bowl) |
| `passport-320.png`, `passport-768.png` | 320, 768 | this week (pips, a collected stamp), milestone stamps shown in advance, stages |

## Measured on the mock (Chromium)

| Check | Target (spec) | Mock |
|---|---|---|
| Sideways scroll of the page | none at 320, 768, 1280 and at 320 with 200 % text (§6.1 page 1 never scrolls sideways) | none: `scrollWidth` equals the viewport on all 25 shots |
| Journey cell at 320 | 54 dp, never under 48 (§6.1, §14) | 54.4 x 76.1 on page 1 and on every pack page; 112 x 112 at 768; 76.8 x 88.1 in the master pane |
| Pack header | 48 dp or more (§6.1) | 54.4 x 64 at 320, 112 x 64 at 768, 76.8 x 64 in the master pane |
| Arrow buttons | 48 dp (§6.1) | 64 x 64 (`touchTarget.min`) everywhere |
| Rows line up across pages | same seven rows at the same heights (§6.1) | the swipe frame and the full-page shots: every stage header and cell row starts at the same height on page 1 and the pack pages, also at 200 % text |
| Hidden Heritage spots | 48 dp (§7.1, §14) | the smallest spot (the 75-unit box rule) is 54 dp at 320; the drawn spots are 56-62 dp at 320, 154 dp and more at 768 |
| Reduced motion | a page change jumps with no slide (§6.1) | the shots run with `prefers-reduced-motion: reduce`; the pager uses `scroll-behavior: auto` and the buttons scroll with `behavior: 'instant'` |
| Keyboard paging (web) | Left and Right page while focus is in the bar or the header row; focus moves to the new page's first header (§6.1, §14) | in `topic-pages.html`: Tab to the right arrow, Enter, focus lands on "Numbers & Time. Opens its levels."; Right arrow from there goes to page 3 and focus lands on "Arts & Music"; Left from page 2's header row goes to page 1 and focus lands on the region named "Five themes, page 1 of 3", with no announcement after it |
| Announcements | page name and number (§6.1) | the live region reads "Topics, page 2 of 3" after the focus move to page 2 or 3; a move back to page 1 is not announced (the region name says it) |

These are the mock's numbers. CM-50b measures the real screens (target-size e2e at 320 and the topic-pages e2e of §14).

## Decisions taken in this design pass

- **D1. The arrows sit at the ends of a page bar directly above the column headers**, with the page name and dots between them. At 320 px the five columns fill the whole column-header row (5 x 54.4 + 4 x 4 = 288 dp), so there is no room for a 48 dp arrow inside it. The spec's §6.1 row "Visible affordance" is written back to say so.
- **D2. Arrows and pack headers are `touchTarget.min` (64) tall**, above the §6.1 48 dp. The pack header's width is the column's, so at 320 px it shares the Journey cell's recorded 54 dp exception (F-LAYOUT-001 audit UX-25); from 375 px it is 65 dp.
- **D3. One header band height on every page while the bar shows.** The pack header needs 64 dp, today's theme labels are about 41, so the band is max(64, page 1's measured label height) + `spacing.sm` on every page and page 1's labels sit at its bottom. The measured term matters on iOS and Android, where page 1's `Caption` labels grow with the system text size; the mock sets those labels in px, as the web build does, so its 200 % shots show the web build only. **Owner to confirm:** this adds space above page 1's labels, and §6.1 says page 1 is "exactly as today"; the §6.1 write-back is marked pending. Page 1's cells, sizes, glyphs, words, states and rings are unchanged; only the space above the labels grows, with the bar. With no packs the band is today's.
- **D4. Pack pages repeat each stage header without its pill and Stage 1 buttons,** keeping page 1's text width and measured row height, so a swipe never moves a row.
- **D5. A short pack word under each pack glyph, taken from the pack's title** (`learner.journey.packWord.<key>`, like `themeWord`): the full title does not fit the 50 dp line ("Numbers" alone estimates 56.8 dp), so the header shows one title word: Time, Family, Feeling, Town, Day, Arts, Science, Body. "Feeling" is the one word that is not a title word as written ("Feelings", 52.9 dp, does not fit; "Me" alone does not name the topic). The full title is in the header's accessible name and on the pack page. No schema field. **Owner to confirm, beside D3:** spec §6.1 "Column header" said "the pack's name"; the row is written back as a CM-D3 proposal pending the owner's confirmation (`journey/topic-pages.md` "The pack word rule").
- **D6. The page bar is not sticky** (open question in the wireframe).
- **D7. Empty column slots are spacers of the column width** (`journeyCellSize`), not flex items that share space, so a page of three packs keeps five-column geometry (in Yoga as in CSS, a bordered `flex: 1` item and an unbordered one do not get the same width).
- **D8. Hidden Heritage spots are at least 75 canvas units**, not 67 (the 48 dp minimum at 320): 75 is 54 dp at 320 and meets `touchTarget.min` from 375 px.
- **D9. The pack page has its own "Up next"** (the first level not Done), a word of its own (`learner.pack.state.upNext`) in an outlined tag, unlike the route's Next triangle and filled chip, so it never reads as the Journey's Next marker, which stays on page 1 (§6.1: packs never move the cursor).
- **D10. Waiting album tiles and the waiting badge are solid outlines**, never dashed or dotted, so they never read as the Not open yet ring.
- **D11. A stamp to collect is a sunken disc with a muted glyph; a collected one is the glyph in its theme ring.** Neither uses the dotted ring.

## Review (CM-D3 design pass)

The independent multi-agent design review of this pass is recorded in the PR description with every finding and its outcome.
