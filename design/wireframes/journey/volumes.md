# Journey / Volumes: a cell's two volumes on the map and on its page (wireframe v1)

Specs: `docs/specs/F-STORY-005-episode-catalogue-grid.md` §3.1 rules 1, 2 and 5, §3.5 and PR 5.8 (`MAX_EPISODES_PER_CELL = 2`, the volume dots, the "first incomplete volume" open rule; the look reads Volume 1, row CM-40 fix stage) · `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §5.1 (Volume 2 is a second episode in the same cell), §6.2 (ids), §4.4 and `journey/mastery-ring.md` C (the New volume marker), §12.2 (`volumes` off)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). A second volume is more to enjoy in a place the learner knows, never a debt: nothing says "unfinished", nothing drops, and a finished stage stays Complete.
Code: built by row CM-40 part 2: `content/episodes.ts` (`volumeEpisodes`, `withVolumes`, `episodesFor`), `logic/journey-cells.ts` (`CellModel.volumes`, the open rule), `logic/journey-grid.ts` (`openId`), `components/JourneyGrid.tsx` (`VolumeDots`), `logic/episode/volumes.ts` and `screens/episode/VolumeTabs.tsx` (the page's tabs, on `SectionTabs`). Base screens: `journey/grid.md` (the cell), `episode/detail.md` (the page), `layout/wide.md` C (two panes).
Notation: `( Vol 1 )` a section tab, `o` an open volume dot, `*` a done volume dot.

## Scenario (Given-When-Then)

Given: `volumes` is on and a cell has shipped its Volume 2
When: the learner opens the Journey map and taps that cell
Then: the cell shows one small dot per volume (filled once that volume is done), the tap opens the first volume not done (Volume 2 once Volume 1 is), and the page shows "Vol 1" and "Vol 2" tabs to move between them

## A. The cell (54 x about 76 dp at 320 px, unchanged)

```
 +----------------+
 |pin          #1 |   <- corner band (pin, placed-out check, count mark): unchanged
 |     (glyph)    |
 |      * o       |   <- the volume dots: in the glyph box, under the glyph, centred; spacing.xs each,
 |  Food & Daily  |      spacing.xxs apart; a done volume is filled text.primary, an open one an empty ring
 +-------(+)------+      in border.shape (borderWidth.thin), so the state never rests on colour alone
                         (+) the mastery ring's New volume marker (mastery-ring.md C), unchanged
```

- **When drawn**: a lesson or book cell with two or more playable volumes, only while `volumes` is on (the screen passes the later volumes then). Never on a coming-later or stories-only cell.
- **Where**: inside the glyph box, under the glyph: clear of every corner mark (the band holds the pin, the check and the count mark) and inside the In your plan / Not open yet ring, so no mark covers another. The cell keeps its size.
- **Tap**: opens the first volume that is not complete, or Volume 1 when every one is (F-STORY-005 PR 5.8).
- **Complete look**: the cell's Volume 1 done (`CellModel.completed`, the same value `learnerCellMarks` tints by), and the label's ", complete" reads that one value too, so the colour and the spoken label never disagree. A cell that turned complete stays complete when a Volume 2 ships or `volumes` turns on (F-CURR-002 §7.7: nothing drops); a Volume 2's own state is its volume dot and the "Opens Volume 2" sentence. The stage's completion reads each cell's Volume 1 as well (row CM-40 part 2), so a Volume 2 never holds a stage back.
- **Two panes**: the cell is selected while the right pane shows any of its volumes.
- **Accessibility**: the dots are hidden from screen readers; the cell's label adds one sentence, "Opens Volume 2." (`a11y.journeyVolume`), after the mastery words.

## B. The cell's page (the lesson page or the Stage 5 book page)

```
 ( Stage 2 Words )( Nature & Animals )     <- pills, unchanged
 ( Vol 1 )  ( Vol 2 )                      <- SectionTabs under the pills: the shown volume selected (filled, bold);
                                              64 dp tall, wraps at 320 px and 200 % text
 Outdoor Words 2                           <- the volume's own page: title, subtitle, Hoya, quests, cards
```

- **When drawn**: two or more playable volumes and `volumes` on; a cell of one volume shows no tabs.
- **Tap**: the other tab opens that volume's page (the stack screen swaps its episode; the Journey pane selects it). The shown tab does nothing.
- **Accessibility**: a `tablist` named "Volumes"; each tab is read "Volume 1" / "Volume 2" (`learner.episode.volumes.tabA11y`), shown "Vol 1" / "Vol 2" (`tab`).

## C. States

- **`volumes` off** (F-CURR-002 §12.2): no dots, no tabs, no volume sentence; a cell opens its Volume 1, and a page asked for a Volume 2 (an older link, the back stack) shows the cell's Volume 1. Progress, cards and memory states of Volume 2 stay.
- **Volume 2 draft or preview**: not playable, so the cell is one volume.
- **Offline**: Volume 2's body is a precached chunk of its own (`lessons-cell-stage<n>-<theme>-v2`), so it plays offline like Volume 1.
- **768 and wide**: the dots scale by `layout.mediaScale` with the glyph.
- **Reduced motion**: nothing here moves.
