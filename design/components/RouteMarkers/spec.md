# RouteMarkers: Next, In your plan and Not open yet (component spec v1)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.7 (marks, Journey, episode page, Home, Library), §3.8 (Results), §3.11 (glossary), §3.14 (accessibility), PR **E3-D** in §6.1, assumption **b** in §9 · Learning Route: `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md` §4.5 (the shared dotted ring, LR-OD-8)
Wireframes: `design/wireframes/journey/grid-plan-and-access.md`, `episode/detail-access-preview.md`, `home/next-and-free-end-card.md`, `results/back-to-plan-and-free-end.md`, `library/access-and-plan-tags.md`
Reuses: `design/components/PipRow/spec.md` (`pipParts`, `cursorMarkerParts`, `LATER_DASHES`, `PIP_SIZE`), `design/components/Icon/spec.md` (`pin`, `check-circle`), `design/components/StoryTile/spec.md`, `Card`, `Button`, `Hoya`
Built by: **E3-5** (Journey: Next, the two rings, the legend line, labels), **E3-6** (episode page tags, the closed-row caption, the preview card), **E3-7** (Home free-end and practice cards, the Results end-of-free-lessons card, Library tiles), **LR-5a / LR-5b** (the "In your plan" tag and the not-open pip on the Learning Route)
Preview: `route-markers-v1.png` (the mark sheet); the mock pages are in `mock/` and the shots in `shots/` (table at the end).

## What they are

Three learner marks. Each one is **one drawn shape plus its word**, never colour alone, and none of them is a lock, a price or a door to a purchase.

| Mark | Meaning | Shape | Word (key) |
|---|---|---|---|
| **Next** | the one quest `routeNext` returns (F-ENT-003 §3.5) | the **cursor triangle** of the pip row (`cursorMarkerParts`), solid, `text.primary`, pointing down at what it marks | "Next" (`learner.routeNext.tag.next`, `a11y.access.next`) |
| **In your plan** | a cell, quest or tile in `planView()` (the leading plan source, inside the horizon) | a **solid ring**, `border.shape` | "In your plan" (`learner.routeNext.tag.inPlan`, `a11y.access.inPlan`) |
| **Not open yet** | a playable lesson a free learner cannot start while the switch is on (`questAccess` is `closed`) | a **dotted ring**: the `later` pip's pattern (8 dashes, each 55 % of the period) | "Not open yet" (`learner.access.notOpen`; the cell label is `a11y.access.notOpen(title)`, the only key for it, F-ENT-003 rev 3.2) |

Subscribers, anyone while the switch is off, and every native store build see **Next** and **In your plan** only. The dotted ring exists only for a free learner on the web with the effective switch on (`gatingActive`).

## Decisions of this design pass

These settle what the spec left to the E3-D mock. D1, D4 to D7 and D11 change lines of F-ENT-003. This PR writes them back into F-ENT-003 revision 3.2 (§3.7, §3.10, §3.11, §3.14, the test plan, the PR rows E3-5 to E3-7, OD-10 and Appendix A) and into the Journey, episode and browse home wireframes, so the spec and the mock say the same thing.

- **D1. Next is the cursor triangle, not the `pin` glyph.**
  - The spec draft said "Next = the drawn `pin` glyph". On the Journey the `pin` already means **"You started here"**: F-PLC-001 P-7 draws it in the top-left corner of the level check's start cell, and the Journey's own note says "The pin shows where you started." (`learner.journey.how.placement`). The `pin` also means "You started here" on the route page's stage rows (`design/components/Icon/spec.md`), and the Learning Route amendment draws it for **"Now"**, the current stage (`docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md` §4.2, `design/wireframes/journey/learning-route.md`). So the `pin` already carries two meanings on learner screens; a third (Next) would make it worse. That second meaning is listed under "Open items for the owner".
  - For a placed learner the start cell and the Next cell differ after the first lesson, so a pin for Next would put two pins with two meanings on one grid. That breaks "one shape each" (§3.7).
  - The pip rows of the route page already mark the next quest with the cursor triangle (`PipRow` spec, "Markers"). Using it on the Journey and on the episode row gives Next one shape everywhere, by the same rule that makes "Not open yet" the `later` pip at cell scale.
- **D2. The rings follow the layout class; the stroke is `borderWidth.thick`.** 40 dp on a compact cell (the cell initial, `typography.size.title`, plus `spacing.md`), scaled by `useMediaSize` like the pips (48 regular, 56 wide). The dotted ring keeps the `later` pip's pattern exactly. The stroke is `borderWidth.thick` (3, then 4) rather than the pip ratio (size / 10 = 4 on a compact cell), so the ring stays lighter than the 28 dp initial it surrounds: the lesson is the content, the ring is its state (sheet section 1 shows both).
- **D3. Corner glyphs sit over the ring as paper stickers.** On a 54.4 dp cell the ring's top corners pass under the start pin and the placed-out check. Each corner glyph first draws its outline filled and edged in `surface.paper`, then the glyph, so the ring reads as passing behind it (sheet section 3).
- **D4. A legend line on the Journey.** §3.14 asks for the shapes "plus the words on the page", and the cells are too small for words. One line between the intro and the column labels shows each mark the grid currently draws, with its word: Next, In your plan, Not open yet. It shows nothing when no mark is drawn.
- **D5. Coming-later cells lose the lock glyph.** OD-6 (resolved with LR-OD-8) puts no lock glyph on any learner screen. Today a coming-later cell draws `lock`, which would sit beside the new dotted cells and read as "more locked". The cell stays `surface.sunken` with its `border.subtle` edge and is **empty**. Its label and the stage pill ("Coming later") carry the words, and the empty cell (no initial) is its shape.
- **D6. The episode row:** the triangle sits over the row's number disc, the chip "Next" carries the word, the chip "In your plan" carries the ring and the word. A closed row replaces Start with the caption "Not open yet" next to the stage-row `later` pip. The Start buttons keep today's tones (§3.7: open rows are unchanged).
- **D7. On the episode page the waiting card tile draws no glyph.** Today it draws `lock`, which would sit under a "Not open yet" caption (OD-6). The first pass drew the `card` glyph instead, but `card` is a landscape rectangle with a band near the top, the common payment-card icon; in the preview state it would show four times right above "Ask a grown-up" and could read as "pay to open" at the purchase boundary (§3.7, OD-6). So the tile is its `surface.sunken` box with its words ("Finish every quest to earn it"), which carry the meaning, in every state of the page. The Library card gallery keeps F-STORY-006's look (outside this spec; listed under "Open items").
- **D8. The free-end cards are paper `Card`s.** They carry a ghost button (the ask), and a ghost label (`brand.primary`) holds 4.5:1 only on canvas, paper and sunken. Those are the ghost pairs `contrast.test.ts` pins. It is 4.48:1 on `feedback.successLight` and 4.10:1 on `brand.primaryLight`. The celebration is carried by Hoya `cheering` and the title.
- **D9. The Results earned row is one line of 64 dp faces.** As many as fit (at most six: three at 320 dp, four at 375 dp), then `learner.results.extraCards.more(n)` ("and 9 more in your Library"). The row is one image, not buttons, so its faces are `spacing.jumbo` (64), not the 96 dp `CardArtThumb` buttons of the extra-cards banner.
- **D10. The practice card names the topic, not the bare word.** A free word topic card reads "Food words". This needs one key beyond Appendix A: `learner.access.practice.topicTitle(title)` "{title} words" (E3-7). A story keeps its title, a kept replay its quest title.
- **D11. The taste note gives way on a closed row.** A taste row's note reads "A taste of this stage is open now. More episodes are coming." For a free learner with the switch on, every playable cell of Stage 2 and Stage 4 is closed, so the note would contradict the rings under it. The note shows only when **at least one playable cell of the row has a quest whose `questAccess` is not `closed`** (open, or kept because it was finished before). Example: state E of `shots/journey-states.png`, a kept Lunch Box Words with the other Stage 2 cells closed, keeps the note on Stage 2 and leaves it out on Stage 4. Subscribers and anyone with the switch off always see it (states A, B, G). The pill keeps "A taste" (§3.7, R-J). No key changes.
- **D12. In your plan stays a plain solid ring, on purpose.** A reviewer noted that the Learning Route legend calls the plain `open` pip "Ready to play" (`learner.myRoute.legend.open`), so a plain ring has a second meaning on another screen. It stays, because the two never meet: on the Journey and the episode page no pip row is drawn, and on the Learning Route "In your plan" is always the chip with its word, never a bare ring in a pip row (see "Tags, captions and tiles"). A double ring or a notched ring would add a sixth ring shape to learn, would be harder to tell from the dotted ring at 16 dp, and would move LR-D's placeholder (a 16 dp ring, already on its board) away from its final shape. Listed under "Open items for the owner" in case one geometry per meaning across screens is preferred.

## Geometry

Every number is a token or derives from one (see "Constants").

| Part | Size | Stroke | Ink | Source |
|---|---|---|---|---|
| In your plan ring, Journey cell | 40 compact, 48 regular, 56 wide (`useMediaSize(RING_SIZE)`) | `useMediaSize(borderWidth.thick)`: 3, 4, 4 | `border.shape` | a circle, `r = size / 2 - stroke / 2` |
| Not open yet ring, Journey cell | as above | as above | `border.shape` | the same circle with `strokeDasharray` [0.55 p, 0.45 p], `p = 2 pi r / LATER_DASHES` (compact: dash 7.99, gap 6.54) |
| Next, Journey cell | triangle 19.2 x 9.6 (`cursorMarkerParts(spacing.xxl)`), every class | — | `text.primary` | centred on the cell; tip 4 dp below the cell's outer top edge (`borderWidth.base + spacing.xxs`) |
| Next, episode row | the same triangle | — | `text.primary` | centred over the 44 dp number disc, tip `spacing.xxs` above it |
| Tag marks | 16 (`spacing.lg`) | 2 | `border.shape` | In your plan = `pipParts('open', 16)`; Not open yet = `pipParts('later', 16)` (gap 2.47) |
| Closed-row caption mark | 20 (`PIP_SIZE.stage`) | 2 | `border.shape` | `pipParts('later', 20)`, the route page's legend pip |
| Learning Route pips | 20 / 24 (`PIP_SIZE`) | shipped | shipped | a not-open quest is the shipped `later` pip, unchanged |

**Fit at every measured cell size** (GridCell in the web build, 2026-10-12):

| Window | Cell | Inner box (minus 2 x 2 dp border) | Ring | Clearance each side |
|---|---|---|---|---|
| 320 x 568 (compact) | 54.4 | 50.4 | 40 / 3 | 5.2 |
| 360 / 375 (compact) | 62.4 / 65.4 | 58.4 / 61.4 | 40 / 3 | 9.2 / 10.7 |
| 600 / 768 (regular, one pane) | 107.2 / 112 (`journeyCellMax`) | 103.2 / 108 | 48 / 4 | 27.6 / 30 |
| 1180 / 1280 (wide, two panes) | 76.4 | 72.4 | 56 / 4 | 8.2 |

- The ring's inner diameter on a compact cell is 34 dp. That clears the 28 dp initial's cap box (about 20 x 20) with room for a wider Latin capital or a Hangul initial once theme titles are localized.
- The Next triangle reaches 5.6 dp above the cell. The gap under the stage header is `spacing.sm` (8, measured at every class), so it never touches the header. It is not scaled, because that gap is not scaled either.
- The triangle spans x 17.6 to 36.8 on a 54.4 cell and the corner glyphs x 4 to 20. Where they share a column, the triangle is still above the cell, so they never touch.

## On a Journey cell

```
 compact cell, 54.4 dp              coming later (today -> E3-D)
   .-------v-------.   v = Next       .-----------.      .-----------.
   | p   .---.   c |   p = start pin  |   [lock]  |  ->  |           |  sunken, empty
   |    (  F  )    |   c = placed-out '-----------'      '-----------'
   |     '---'     |       check
   '---------------'   ( ) = solid ring, In your plan;  (: :) = dotted ring, Not open yet
```

- **Layers, bottom to top:** the cell (fill, border), the initial, the ring, the corner glyphs (stickers, D3), the Next triangle.
- **Precedence** (§3.7): Next > In your plan > Not open yet. A closed cell is never Next and never In your plan, so the two rings never meet. Next and In your plan can share a cell, and then both are drawn.
- **With today's marks.**
  - The start pin and the placed-out check stay in their corners.
  - A completed cell (`feedback.successLight`) never carries a ring or Next, because nothing in it is pending or closed.
  - A placed-out cell keeps its dashed border. A ring on it (rare: a free learner placed past Stage 2) is a circle inside the square, so it is not confused with the dashed edge.
  - In two panes the selected cell's `border.focus` edge (3 dp) leaves the tip 1 dp inside.
- **Free learner, switch on:** the dotted ring sits around the initial. The cell keeps its paper fill, its stage-coloured border and its tap (§3.7). A cell with any kept quest shows no ring.
- **Coming later:** empty (D5). No mark of this spec is ever drawn on it.
- **Taste note:** left out on a row whose playable cells are all closed for this learner (D11).
- **The legend line (D4).**
  - It sits under the intro, above the column labels. Order: Next, In your plan, Not open yet.
  - Each item is the 16 dp tag mark (the Next triangle centred in the same box), `spacing.xs`, then the word in `bodySm` semibold `text.secondary`. Items are `spacing.lg` apart, wrap, and leave `spacing.md` below.
  - It lists only the marks the grid draws now. It is hidden from screen readers, because every cell label carries its words.
  - It is not a control and has no background, so the triangle is not read as a menu.

## Tags, captions and tiles

- **Tag chip** (episode rows; Library and topic tiles; Learning Route cell rows):
  - The chip is `TagChip`'s look: `radii.pill`, `spacing.xxs` x `spacing.sm` padding, Caption semibold `text.primary`, with `spacing.xs` between the mark and the word.
  - "Next" uses a `brand.primaryLight` chip with the word only; its shape is the triangle over the number disc (D6).
  - "In your plan" uses a `surface.sunken` chip with the 16 dp solid ring.
- **Closed row** (preview page): the Start button gives way to a plain line: the 20 dp dotted pip, `spacing.sm`, then "Not open yet" in Body semibold `text.secondary`. It is text, never a disabled button.
- **Library story tile and topic tile, closed:**
  - The F-STORY-004 tile is unchanged, including its `surface.sunken` fill.
  - In its state line the 16 dp dotted ring replaces the 16 dp lock, and "Not open yet" replaces "Locked". The key is `learner.storyShelf.state.locked` in the dictionary (F-ENT-003 calls it `learner.storyTile.state.locked`); it takes the new value.
  - A topic tile (F-VOC-003, when built) uses the same line in place of its meter and count.
- **Library tile in the plan:** the "In your plan" chip goes on its own line under the minutes line. The state word stays.
- **Learning Route (LR-5a, LR-5b):**
  - Pip rows keep the shipped pips, and a not-open quest is the `later` pip. The legend has two rows with the same dotted pip, "Not open yet" and "Coming later", and the word tells them apart (LR §4.5).
  - "In your plan" on a cell row is the chip above, never a bare ring in the row, where it would look like an `open` pip.
  - The LR-D placeholders (today's `later` pip; a 16 dp ring at `borderWidth.base`) are these final shapes, so LR-D needs no change.

## The cards

| Card | Container | Content, top to bottom | Buttons |
|---|---|---|---|
| **Preview card** (episode page B) | `Card` `sunken`, `md` padding, centred column, `spacing.xl` above | Hoya `reading` 96 · `spacing.md` · `preview.line` in Body semibold, centred | `spacing.lg`, then secondary `md` full width **{ask}** (`askFor`: "Ask a grown-up" / "Ask your teacher or a grown-up" / "See how to open it") · `spacing.sm` · ghost `md` full width "Back to open lessons". No primary on the page |
| **Home free-end card** (card 2, B, once) | `Card` paper, `md` (D8) | Hoya `cheering` `useMediaSize(72)` beside `freeEnd.title` (Body `lg` bold) · `spacing.md` · `openForYou` (Body `text.secondary`) | `spacing.md`, then primary `lg` "Practice words" (or "Read a story") · secondary `md` "Play a favorite again" · ghost `md` **{ask}** |
| **Home practice card** (card 2, C) | today's mission tile (paper) | the 48 dp lead slot draws the topic's cover WordArt (or the story cover, or the replay icon) · title (D10) · subtitle "Keep practicing" | the tile is the button. No ask, no grown-up word, no line about what is not open |
| **Home next in your plan** (card 2, A) | today's mission tile | `play` icon · quest title · subtitle "Next in your plan" (plan source) or today's "Something new today" (`cursor`) | the tile |
| **Results A** | today's `NextUpCard` | caption "Next in your plan", "Back to your plan" or today's "Next up"; title; new letters | unchanged: Play next quest, Back home, Episode page |
| **Results B** (end of the free lessons, once) | `Card` paper, `md` (D8), replaces the teaser card | Hoya `cheering` 64 beside `freeEnd.title` (Heading `prompt`) · `spacing.md` · the earned row (D9) · count line Caption `text.secondary` | page buttons: primary `hero` "Back home" · secondary `md` "Practice words" · ghost `md` **{ask}** |
| **Results C** (free-end, seen) | no card | `openForYou` (Body semibold) | primary `hero` "Practice words" · ghost `md` "Back home" · ghost `md` "Episode page". No ask |

- The ask appears on a learner screen only on the preview card and once on the free-end card (Home or Results, whichever comes first). It is never on the practice card, the Journey, the Library tile face or the Learning Route (§3.15).
- Every button is `Button` (`touchTarget.min` or more). At 200 % text the labels wrap inside the buttons, and nothing scrolls sideways at 320 (shots `episode-preview-320-text200.png`, `cards-320-text200.png`).

## Assumption b: solid against dotted at Journey cell size, 320 dp, in greyscale and protanopia

**Verdict: holds.** The two rings are told apart by their geometry: one unbroken stroke against eight dashes with 6 to 7 dp gaps. Neither vision transform weakens the contrast that carries that shape.

- **How it was checked.**
  - `mock/check.html` draws Stage 1, 2 and 4 of a Journey at 320 dp three times: normal, greyscale and protanopia. Greyscale is relative luminance; protanopia uses the Machado, Oliveira and Fernandes (2009) matrix at severity 1.0. Both are SVG colour matrices in linear RGB, the method and matrix of `packages/design-system/src/word-art/color-science.ts`.
  - The cells are 54.4 dp, the measured compact size.
  - The same page also draws the tag marks (16) and the Learning Route pips (20, 24).
- **Measured on the rendered pixels.**
  - Each probe was rendered in Chromium at 1x, 2x, 2.75x (Pixel 5) and 3x.
  - At 1,440 angles, the darkest device pixel across the stroke width was read and called ink when it was darker than the midpoint between the darkest sample and the paper next to the ring.
  - Pass rule: a dotted ring shows exactly 8 dark runs with a dash-to-gap contrast of at least 3:1 (WCAG 1.4.11), and a solid ring shows one unbroken run.

| Probe (12 renders each: 4 scales x 3 visions) | Dark runs | Ink share | Lowest contrast, normal / greyscale / protanopia | Shortest gap |
|---|---|---|---|---|
| Journey cell, In your plan, solid 40 / 3 | 1 | 1.00 | 4.55 / 4.54 / 4.69 (ink to paper) | none |
| Journey cell, Not open yet, dotted 40 / 3 (Stage 2 and Stage 4 cells) | 8 | 0.57 to 0.61 | 4.55 / 4.54 / 4.69 (dash to gap) | 5.97 dp |
| Tag, In your plan, solid 16 / 2 | 1 | 1.00 | 4.55 / 4.54 / 4.69 | none |
| Tag, Not open yet, dotted 16 / 2 | 8 | 0.60 to 0.64 | 4.55 / 4.54 / 4.69 | 2.11 dp |
| Learning Route pip 20, open / later | 1 / 8 | 1.00 / 0.59 to 0.62 | 4.55 / 4.54 / 4.69 | none / 2.95 dp |
| Learning Route pip 24, open / later | 1 / 8 | 1.00 / 0.58 to 0.64 | 4.55 / 4.54 / 4.69 | none / 3.20 dp |

- **What this means.**
  - Greyscale keeps luminance, so it keeps every contrast ratio: 4.55:1 becomes 4.54:1 after rounding.
  - Protanopia moves both `border.shape` and paper the same way and raises the ratio a little, to 4.69:1.
  - A dash gap on a compact cell is 6.5 dp by design (5.97 dp is the shortest measured, at 1x). At a 30 cm reading distance that is about 12 arcminutes, more than twice the height of a 20/20 letter.
  - At tag size the gap is 2.47 dp, about 4.5 arcminutes. It is still resolved at 1x (8 runs). There it always sits next to its word.
- **What does not carry the distinction.** The stage colours never do: the cell border is drawn in the stage colour, and the rings are always `border.shape` on paper. Under protanopia `stage1` and `stage2` move close to each other (shots `check-320-*.png`), which changes nothing here.

## Contrast of the inks (WCAG 1.4.11 non-text 3:1; text 4.5:1)

| Ink | On | Normal | Protanopia |
|---|---|---|---|
| `border.shape` (rings, tag marks, pips) | paper / canvas / sunken | 4.55 / 4.29 / 3.84 | 4.71 / 4.42 / 3.93 |
| `text.primary` (Next triangle) | canvas (above the cell) / paper | 15.21 / 16.10 | 15.39 / 16.38 |
| `text.primary` (chip words) | `brand.primaryLight` / sunken | 12.12 / 13.58 | 11.87 / 13.68 |
| `text.secondary` (legend, closed caption, state line) | canvas / paper / sunken | 7.97 / 8.44 / 7.12 | 8.25 / 8.78 / 7.33 |
| `brand.primary` (ghost ask label) | paper / canvas / sunken | 5.44 / 5.14 / 4.59 | 6.83 / 6.42 / 5.71 |

`border.shape` pairs are pinned by `contrast.test.ts` (PipRow R-2b). Under 3:1 on purpose and never used for a mark: `border.shape` on the stage colours (1.5 to 1.9), because a ring never touches a cell border.

## Words

Every drawn string is a dictionary value or an F-ENT-003 Appendix A draft, word for word:

- `learner.access`: `notOpen`, `preview.line`, `ask.family`, `ask.class`, `ask.self`, `back.cta`, `freeEnd.title`, `openForYou`, `practiceWords.cta`, `replay.cta`, `home.cta`, `practice.subtitle`;
- `learner.routeNext`: `tag.next`, `tag.inPlan`, `home.subtitle`, `results.caption`, `results.backToPlan`;
- existing keys: `learner.journey.*`, `learner.episode.*`, `learner.results.*`, `learner.home.mission.*`, `learner.storyShelf.*`, `learner.vocab.topics.*`.

One new key is needed (D10): `learner.access.practice.topicTitle(title)` "{title} words" (E3-7). The legend (D4) reuses `tag.next`, `tag.inPlan` and `notOpen`, so it adds no key. The earned row's label reuses `learner.library.collected.line(n)` ("12 cards collected").

No price, product name, "Premium", "buy", "trial", "locked", "left", count of days or countdown appears anywhere in the mock. A self-only device never sees "grown-up" (`ask.self`).

## Accessibility

- **Cell label.**
  - The title, then the state words in the order Next, In your plan, not open yet (`a11y.access`). For example: "Around the Korean Table. Next. In your plan." or "Lunch Box Words: not open yet. Opens the lesson page."
  - Marks, the legend line and the earned faces are hidden from screen readers (the PipRow rule: `importantForAccessibility="no-hide-descendants"`, `accessibilityElementsHidden`, and `aria-hidden` on a wrapping `View` for the web).
- **Episode row label.** It reads the tags as words: "Family at the Table. Next. In your plan." The closed caption is read as text.
- **Focus order.**
  - Preview page: title, quest list, preview card line, ask, Back to open lessons.
  - Free-end card: focus lands on its title.
- **Targets and size.** Cells keep their size and tap. Marks sit inside the cell or in the 8 dp gap above it and add no target. Body text 18 or more on every card. Marks keep their dp size under large text, like the pips; their words grow.
- **Motion.** Nothing animates. Hoya `cheering` is the static pose under reduced motion.

## Rules

- **Drawn, never typed.** The triangle and the rings are `react-native-svg` parts built from `cursorMarkerParts` and the ring geometry. There is no arrow, dingbat or emoji-capable character in any source file.
- **Tokens only.** The inks are `border.shape`, `text.primary` and `surface.paper` (the sticker edge), and the sizes come from the tokens named above. No colour literal (tested).
- **No lock glyph on a learner screen** in any state these rows draw: the Journey, the episode page and Library tiles (D5, D7).
- **Never colour alone.** Each mark is a shape plus a word, either on the page (legend, chips, captions) or in the label.

## Code (planned, E3-5)

- `packages/design-system/src/components/RouteMarkers/`, a design-system component like `PipRow`, because the Journey, the episode page, the Library and the Learning Route draw the same marks:
  - `geometry.ts`, pure: `ROUTE_RING_SIZE` (40), `routeRingParts(kind: 'inPlan' | 'notOpen', size, stroke)`, `NEXT_MARKER_BASE` (`spacing.xxl`), `NEXT_TIP_INSET` (`borderWidth.base + spacing.xxs`), `tagMarkParts(kind)`;
  - `RouteRing.tsx`, `NextMarker.tsx`, `RouteTag.tsx` (the chip), `RouteLegend.tsx`.
- The F-ENT-003 scope line names no design-system path. E3-5 adds this one; the alternative is `apps/mobile/src/components/`, at the cost of a second copy for LR-5a and LR-5b.
- **Tests:**
  - the dotted ring's pattern equals `pipParts('later')` (8 dashes, 55 / 45);
  - the tag marks equal `pipParts('open' | 'later', 16)`;
  - the cell triangle is `cursorMarkerParts(32)`;
  - the ring fits the inner box of the 54.4 dp cell with `spacing.xxs` to spare;
  - the triangle's top stays inside `spacing.sm` above the cell;
  - no colour literal, and no typed glyph character (source scan).
- **E3-5 e2e** (`plan-next.spec.ts`, `free-days.spec.ts`): a 320 x 568 shot with Next, a solid ring and a dotted ring, checked by eye against `shots/journey-free-320-first.png`. It also asserts that the triangle is not clipped by the row.

## Constants

Values that are not tokens, each with what it derives from. E3-5 to E3-7 write them as named constants.

| Where | Value | Derived from |
|---|---|---|
| Ring on a compact cell | 40 | `typography.size.title` + `spacing.md` |
| Ring stroke | 3 (4 on regular and wide) | `borderWidth.thick`, through `useMediaSize` |
| Next triangle | base 32 (19.2 x 9.6 drawn) | `spacing.xxl` through `cursorMarkerParts` |
| Next tip inset | 4 | `borderWidth.base` + `spacing.xxs` |
| Sticker edge | 1 dp beyond the glyph's stroke at 16 dp (1.5 units of the 24 grid) | `spacing.xxs` / 2 |
| Earned face | 64 | `spacing.jumbo` (an image size; `touchTarget.min` stays for interactive targets) |
| Quest number disc | 44 | `EpisodeDetailView` today (unchanged) |
| Measured cell sizes | 54.4, 62.4, 65.4, 107.2, 112, 76.4 | GridCell in the web build at 320, 360, 375, 600, 768 and 1180 / 1280 wide (2026-10-12) |
| Mock frame | 320 px | the 320 dp width the spec checks |
| Mock breakpoints | 600 px, 900 px | `layout.breakpoint` (the app's window classes, in px because they follow the window in dp) |

## Mock and shots

The mock is a design reference, not shipped code. Every value in `mock/route-markers.css` is a token of `packages/design-system/src/tokens.ts`, copied once into a custom property named after it (`--colors-border-shape` is `colors.border.shape`). Text sizes are in rem, so the 200 % shots (the browser's own text size, Chromium `Page.setFontSizes`) enlarge every line, while marks, glyphs and Hoya keep their dp size. The marks are inline SVG generated from the shipped geometry (`PipRow/geometry.ts`, `Icon/glyphs.ts`), Hoya is a static port of `Hoya.tsx`, and WordArt pictures are the shipped renderer's output (its tones are token values). Monospace labels and dashed frames are board notes, not UI. Open any file in a browser; links are placeholders.

| Shot | Viewport | Shows |
|---|---|---|
| `route-markers-v1.png` | board, 1180 | the three marks at 320 dp and 3x; every window class; with the start pin, the placed-out look, completed and selected cells; coming later before and after D5; the tag, legend, closed-caption and Learning Route scales |
| `shots/journey-free-320-first.png` | 320 x 568, first screen | a free learner (switch on): legend, Next on the first unfinished Stage 1 cell, dotted rings on Stage 2 |
| `shots/journey-free-320.png`, `journey-plan-320.png` | 320, full page | the whole Journey for a free learner, and for a subscriber with a family plan (Next and two rings) |
| `shots/journey-plan-1280.png` | 1280, two panes | the wide grid (ring 56) beside the episode page with its tags; the selected cell keeps its focus edge |
| `shots/journey-states.png` | board | states A to G of the wireframe: plan, no plan, free new, free-end, kept Stage 2 quest, free and placed into Stage 2, placed with a plan; the taste note by D11 (shown in A, B and on Stage 2 of E) |
| `shots/episode-plan-320.png` | 320, full page | episode page A: Play again, Next with In your plan, an off-plan row, the waiting tiles with their words and no glyph (D7) |
| `shots/episode-preview-320.png`, `-text200.png` | 320, full page | episode page B: the closed caption, the preview card with the ask and Back to open lessons; the same at 200 % text |
| `shots/cards-320.png`, `-text200.png` | board of 320 frames | Home card 2 (A, B, C), Home at free-end with its three cards, Results A (both captions), B and C, Library story and topic tiles, the ask by device |
| `shots/check-320-1x.png`, `-2x.png` | board | assumption b at 1x and 2x: the grid and the probes in normal, greyscale and protanopia, true size and 4x, and the measured table |

Measured on the mock: no page or board scrolls sideways (`scrollWidth` equals the viewport on all 13 shots). The shots are 2x renders in Chromium, recompressed losslessly (zlib level 9, adaptive filtering), which halves their size without changing a pixel. The 320 x 568 first screen shows the legend, the Next cell and the first dotted ring.

## Notes for later rows

- **E3-5:**
  - Journey marks, legend, D5, D11, the cell label order.
  - Update `logic/journey-grid.ts`'s comment: there is no lock glyph and no "opens with the full route" label for a closed cell.
  - `JourneyCellState` stays `open` / `later`; closed is a mark from `questAccess`, not a new cell state.
- **E3-6:** D6, D7, the preview card, `askFor`.
  - The closed caption keeps the row's stars, which are always empty because the quest is not kept.
  - Letter chips appear only for a quest that teaches letters, and no closed quest does today: all of Stage 1 is free.
- **E3-7:** D8, D9, D10 (one key), the Library state line. The topic picker's tile adopts the same line when F-VOC-003 builds it.
- **LR-5a / LR-5b:** take the shapes above; the LR-D board's placeholders already match them.
- **Open items for the owner** (outside F-ENT-003):
  - The Library card gallery and the card page still draw `lock` for a card not yet earned (F-STORY-006, "Locked card"). OD-6 covers access, not earning, but the owner may want the `card` glyph there too, for one vocabulary on learner screens.
  - **The `pin` has two meanings on learner screens** (D1): "You started here" on the Journey and the route page's stage rows, "Now" on the Learning Route route card. Not changed by this pass; to settle with the Learning Route owner.
  - **The plain ring** means "In your plan" (chip, Journey cell) and, as the `open` pip, "Ready to play" on the Learning Route (D12). Kept on purpose; a double ring is the alternative if one geometry per meaning is wanted.
  - `Pill` tone `success` writes its label in a component constant (`#2F6A47`), not a token. The mock draws it in `feedback.successDark`.

> 2026-10-14: the cell initial these notes mention is now the theme glyph (`design/components/Icon/theme-glyphs.md`), 24 dp scaled by `useMediaSize` (28.8 regular, 33.6 wide). It fits inside the ring's inner diameter (34 dp compact, 40 regular, 48 wide); the layers and ring sizes are unchanged.
