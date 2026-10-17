# Library/Cards-collected-first — the cards you have first, the ones to earn folded below (wireframe v1)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 9.3 (row DN-9) · amends the order of `library/gallery.md` (Cards tab); earn hints unchanged (`library/earn-hints.md`)
Audience: **learner, any age**
Route: learner app Library tab, Cards section
Mock: `design/screens/learner-shell/library-cards.md`

## Scenario (Given-When-Then)

Given: a learner who has collected some cards opens the Library
When: the Cards tab shows
Then: their own cards come first, newest first; the cards still to earn are one tap away in a folded group, with their hints, never in the way

## Screen goal

"See my cards." (secondary: see what I can earn next)

## Box diagram

Panel A — 360 x 740, two cards collected

```
+--------------------------------+
| Heritage Library   ( Aa )      |  <- root: no Back
| 2 cards collected              |
| (Cards)(Story Time)(Culture)(Words)|  <- section tabs, unchanged
| (All)(Letters)(Food)(Holidays)(Nature)(Play) <- theme chips filter both groups
|--------------------------------|
| [ Tiger  (New) ] [ Book      ] |  <- collected, newest first, full card faces
|--------------------------------|
| [ v Cards to earn ]            |  <- disclosure, closed by default; no count (F-STORY-006 §3.7 D3: no total)
+--------------------------------+
```

Panel B — Cards to earn open

```
| [ - Cards to earn ]            |
| [ lock  Finish the episode:  ] |  <- the locked tiles and their earn hints, as today
| [       Meet the Letters     ] |
| [ lock  Finish every quest   ] |
| [       in Stage 1           ] |
| ...                            |
```

Panel C — nothing collected yet

```
| 0 cards collected              |  <- the existing count line
| [ - Cards to earn ]            |  <- open by default when nothing is collected
| [ lock ... ]                   |
```

## Interaction points

- A collected card → card detail (unchanged).
- [ v Cards to earn ] → opens / closes the group (`aria-expanded`); the open state lasts for the visit.
- A locked tile → its earn hint (unchanged, F-STORY-006).
- Theme chip → filters both groups.

## Navigation graph

Enter from: Library tab · a Results card link · Home pills
Exit to: card detail · the earn hint's target (unchanged)

## States

- **success**: Panels A and B.
- **empty**: Panel C.
- **all collected**: the Cards to earn group is not drawn (no new line is added).
- **wide** (split pane): the same order in the master pane; the detail pane unchanged.

## Data needs

- The learner's collection with `unlockedAt` (`ProgressSnapshot` cards; newest first), the card catalogue, the earn hints (unchanged). Nothing new stored.

## Open questions

- None blocking. The disclosure carries no count: the Library shows the cards held, never a total (F-STORY-006 §3.7, D3); nothing is taken away.
