# Journey/Mastery ring — three segments round each cell, "Ready to refresh", "New volume" and Words known (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.4 (levels 0-3 and their names, "drawn as a three-segment ring in theme tokens around the 54 dp cell, so it needs no extra width", the started-volume denominator and the "New volume" marker, the `cellBest` latch, "Due items glow ... never drawn as wilting, cracking or loss", Words known and its milestones), §7.7 (anti-shame checklist), §11.3 (`mastery.level_up`), §12.2 (`mastery` off), §14 ("grid with mastery rings at 320 px, cells still 54 dp", contrast of theme tokens, screen-reader labels "Mastered", "Ready to refresh", "New volume")
Extends: `journey/grid.md` (the cell, its corner band, glyph box and word), `journey/grid-plan-and-access.md` (Next, In your plan, Not open yet, the legend line), `journey/grid-with-stories.md` (count mark), `episode/detail.md` (the cell's page), `journey/learning-route.md` (the route card), `results/celebrate.md` (banners). Geometry: `apps/mobile/src/logic/journey-cell-layout.ts` (unchanged by this design)
Audience: **learner, any age** (P4 / P5 / P6). Grown-ups see the same levels in reports (F-REPORT-001, row CM-16).
Mock: `design/screens/mastery-ring/` (shots at 320 and 768) · Built by row **CM-20** (behind `mastery`)

## Scenario (Given-When-Then)

Given: a learner who has finished some cells and reviewed their words over several days
When: they open the Journey map
Then: each started cell shows how well it is known as one, two or three filled segments round the cell (Done, Practiced, Mastered), a mastered cell with items due glows softly as "Ready to refresh", a cell with an unopened new volume shows a small "New volume" marker, and nothing ever looks lost, faded or broken

## Screen goal

"See at a glance which places I have truly mastered." (secondary: see which ones would enjoy a refresh)

## Box diagram

```
A. One cell at 320 px (54 x about 76 dp, unchanged), levels 0 to 3. The track IS the cell's outline.

 level 0 (none)     level 1 (Done)      level 2 (Practiced)  level 3 (Mastered)
 +----------+       +-- ==== --+        +-- ==== --+         #==========#
 |pin    [5]|       |pin    [5]|        |pin    [5]|         #pin    [5]#
 |          |       |          #        |          #         #          #
 |   (gl)   |       |   (gl)   #        |   (gl)   #         #   (gl)   #
 |          |       |          #        #          #         #          #
 |  Letters |       |  Letters |        #  Letters |         #  Letters #
 +----------+       +----------+        #===== ====+         #==========#
 today's border     segment 1 filled    segments 1-2 filled  all three, gaps closed

   +-- = empty segment: the 1 dp keyline (border.shape) alone
   ==, # = filled segment: 3 dp (borderWidth.thick): 2 dp of colors.theme.<column> outside a 1 dp
           border.shape keyline on the inner side
   gaps: 3 gaps of spacing.xs (4 dp) along the outline; the first is centred on the top edge, where the
         Next triangle sits; segments fill clockwise from it (1: top right and right side; 2: bottom;
         3: left side and top left); at level 3 the gaps close into one ring

B. Ready to refresh (a level 3 cell with items due today)
       (*)                <- sparkle sticker (Icon `sparkle` on a paper circle, spacing.lg) centred on the
 .#==========#.              top edge, half outside the cell, like the Next triangle; not drawn on the Next
 :#pin    [5]#:              cell (the triangle owns that spot; the halo and the label still say it)
 :#   (gl)   #:           <- halo: a 2 dp outline just outside the track, in the column's theme token at
 :#  Letters #:              GLOW_OPACITY, inside the grid gap (spacing.xs), so it needs no width
 '#==========#'
   The ring itself never changes: no thinning, fading, desaturating, cracking or wilting. The glow is only
   ever added on top, and it goes away once nothing is due.

C. New volume (a started cell whose next volume has shipped and is not started; `volumes` on)
 +-- ==== --+
 |pin    [5]#
 |   (gl)   #
 |  Letters |
 +----(+)---+             <- New volume marker: a spacing.md circle in brand.secondary with the `plus` glyph
                             in text.onSecondary, centred on the bottom edge, half outside; it never covers
                             the theme word (e2e asserts it). The level is not held back (§4.4 denominator).

D. Next to the other marks (precedence and places, unchanged from grid-plan-and-access.md)
 - Next triangle: top centre over the first gap (the top layer).
 - In your plan (solid) and Not open yet (dotted) rings: round the glyph, inside the cell; different shape
   and place from the outline track. A Not open yet cell has no kept quest, so it is level 0: never both.
 - Start pin, placed-out check, story count: the corner band, unchanged. A placed-out cell keeps its dashed
   border only while it is level 0; from level 1 the track replaces it and the check stays.
 - Completed tint (successLight fill): unchanged; the track replaces only the success border.
 - Selected (two panes, wide): the border.focus outline (borderWidth.base) moves outside the track, into the
   grid gap, so selection never hides a segment; a level 0 cell keeps today's selected border.

E. The cell's page (episode/detail.md; the block under the header, also used by reviews/cell-check.md A)
 +----------------------------+
 | (ring48) Mastered          |  <- the same three segments round a 48 dp circle (the theme glyph inside),
 |          Ready to refresh  |     the level word (bodyLg, semibold), then at most two lines:
 |          New volume        |     "Ready to refresh" (with the sparkle; the same rule as the map: a
                                     level 3 cell with items due) and "New volume" (with the plus)
 | Take the Cell Check to     |  <- one hint line for the next level, below level 3:
 | reach Mastered.            |     0-1: "Keep reviewing to reach Practiced."; 2 without a Cell Check:
 +----------------------------+     this line; 2 with one: "Keep reviewing to reach Mastered."
                                    level 3: no hint line

F. Legend line (grid-plan-and-access.md D4, aria-hidden): lists only the marks drawn now
 |  v Next  (==) In your plan  (seg) Mastery ring  (*) Ready to refresh  (+) New volume |
   wraps to two lines at 320; the mastery entries follow the existing three

G. Words known (Home pill and the Learning Route card)
 Home:          (120 words known) (3 cards) (1 three-star quest)   <- home/goal-ring-weekly-dots.md A
 Route card:    | Words you know: 120 |                            <- one line in the route card
 Milestone (100, 250, 500, 1,000, 2,000), a banner on the Results of the activity that crossed it:
 | [hoya - cheering] 100 words! Hoya is so proud of you. |
 Level up, a banner on the same Results (one at a time, the milestone first):
 | (ring48 fills) Lunch Box Words: Practiced |
```

- **Contrast.** The theme tokens are accents: on `surface.paper` letters is 3.0:1, nature 2.45:1, crafts 2.96:1 and life 1.86:1 (rites 4.58:1). So a filled segment never relies on its colour: every segment, filled or empty, has the `border.shape` keyline (4.55:1 on paper, 4.29:1 on canvas, 3.84:1 on sunken), filled segments are three times as thick, and Mastered closes the gaps. CM-20's contrast test asserts the keyline token, not the theme token, carries the 3:1 non-text contrast, and the 320 visual test is checked in greyscale.
- **No extra width.** The track is drawn in the border box the cell already reserves (`maxEdge` = `borderWidth.thick`), so `journeyCellLayout` returns the same numbers with the ring on: 54 x about 76 dp at 320, 112 x 112 at 768, 76 x about 88 in the wide master pane. The halo, the sparkle and the marker sit in space the grid already has (the `spacing.xs` gap, half outside the top and bottom edges, as the Next triangle does).
- **Never down.** The ring reads `cellBest` only (merged by max). Boxes can fall; the ring cannot. No screen draws a segment emptying, a crack, a wilt or a faded ring.

## Interaction points

- The ring is not a target: the cell stays one button (-> `episode/detail`, or select in two panes).
- E's hint line is text; the Cell Check button under it belongs to `reviews/cell-check.md`.
- G's pill is not a target on Home (the pills row is information); the milestone and level-up banners are not targets.

## Navigation graph

Enter from: `journey/grid` (every cell) · `episode/detail` (E) · Home and Results (G)
Exit to: unchanged: the cell opens `episode/detail`

## States

- **level 0**: today's cell exactly (no track).
- **level 1 / 2 / 3**: A. Level 3 closes the gaps.
- **level up** (`mastery.level_up { cellId, level }`): on the Results of the activity that raised it, the G banner fills the new segment once (`motion.duration.slow`); on the Journey the ring is simply drawn at the new level (no animation on the map).
- **ready to refresh**: B, only on level 3 cells with items due today; gone when nothing is due.
- **new volume**: C, only with `volumes` on.
- **tested out** (`reviews/cell-check.md` F): level 1 like any Done cell.
- **`mastery` off** (§12.2): no track, no glow, no marker, no E block, no G banners; today's cells exactly. `cellBest` stays and shows again when it is back on. Words known (G) is part of `mastery` too.
- **memory not ready** (shadow mode, seeding not finished): rings show `cellBest`, which starts at 1 for every cell done (§4.8 step 6); nothing waits.
- **reduced motion**: the level-up fill and the glow have no animation: they are drawn in their end state at once. The glow never pulses in any mode.
- **200 % text**: the theme word keeps `maxFontSizeMultiplier` 1 (unchanged); E's words wrap beside the 48 dp ring; the legend wraps.
- **768 and wide**: the same track at 3 dp on the bigger outline; the sparkle and the marker scale by `layout.mediaScale` like the glyph.

## Accessibility

- The track, halo, sparkle and marker are hidden from screen readers; the cell's label carries their words after today's state words (Next, In your plan, not open yet): "... Mastered. Ready to refresh. New volume." (`a11y.mastery.*`).
- Level words: "Done", "Practiced", "Mastered"; level 0 adds nothing.
- E is one group read as its words, ring hidden. G's pill reads "120 words known".
- Colour is never the only cue: thickness and closed gaps carry the level, a sparkle shape carries Ready to refresh, a plus shape carries New volume, and the label carries all three.
- Targets unchanged: the cell is 54 dp wide at 320 (at least 48 dp), the ring adds no target.

## Anti-shame checklist (§7.7)

| Rule | Here |
|---|---|
| no red for a miss | the ring uses theme tokens and `border.shape` only |
| no visible decay | the level never drops; due items add a glow, never a wilt, crack or fade |
| no lost streak copy | none |
| no percentage | none: segments and words, never "80 %" |
| no per-question timer | none |
| no random rewards | levels follow the §4.4 rules |
| no purchasable rewards | none |
| no comparison between learners | none: the ring is the learner's own; no class or family map |
| no bad ending | n/a |
| no age wording | none |
| no speaking UI | none |
| no emoji | none: Icon glyphs `sparkle`, `plus` |

## Data needs

- reads: `cellBest` (levels), the memory store's due flag per cell (`hasDueItems(cellId)`), the volume list per cell and `questDoneAt` (New volume), `wordsKnown` (the §4.4 count: `lex` items with best box 2 or higher and at least one real answer), the `mastery` and `volumes` flags
- writes: none on the map; `cellBest` is written by the level derivation (CM-20) when it rises
- telemetry: `mastery.level_up { cellId, level }` (§11.3), sent once per rise

## Constants (not tokens; CM-20 writes them as named constants)

| Name | Value | Why |
|---|---|---|
| `MASTERY_SEGMENTS` | 3 | three levels above none (§4.4) |
| `MASTERY_GAP` | `spacing.xs` | the gap between segments |
| `GLOW_OPACITY` | 0.4 | the halo's opacity over the theme token; the halo is decorative, the sparkle and the label carry the meaning |
| `WORDS_MILESTONES` | 100, 250, 500, 1000, 2000 | §4.4 |

## Proposed copy (English; keys for CM-20, which adds es and ko)

| Key | English |
|---|---|
| `learner.mastery.level.done` / `.practiced` / `.mastered` | Done / Practiced / Mastered |
| `learner.mastery.readyToRefresh` | Ready to refresh |
| `learner.mastery.newVolume` | New volume |
| `learner.mastery.hint.practiced` | Keep reviewing to reach Practiced. |
| `learner.mastery.hint.check` | Take the Cell Check to reach Mastered. |
| `learner.mastery.hint.mastered` | Keep reviewing to reach Mastered. |
| `learner.mastery.legend.ring` | Mastery ring |
| `learner.mastery.levelUp(title, level)` | {title}: {level} |
| `learner.wordsKnown.pill(count)` | 1 word known / {count} words known |
| `learner.wordsKnown.route(count)` | Words you know: {count} |
| `learner.wordsKnown.milestone(count)` | {count} words! Hoya is so proud of you. |
| `a11y.mastery.done` / `.practiced` / `.mastered` | Done / Practiced / Mastered |
| `a11y.mastery.readyToRefresh` | Ready to refresh |
| `a11y.mastery.newVolume` | New volume |

## Open questions

- None blocking CM-20. Spec §4.4 glows only **mastered** cells, and this design follows it on every surface: the map (B), the cell's page (E) and `reviews/cell-check.md` A say "Ready to refresh" only for a level 3 cell with items due. A level 1 or 2 cell's due items reach the learner through the Daily Review, which is how they climb to the next level. Widening the cue to every started cell would be a spec change, not a CM-20 choice.
