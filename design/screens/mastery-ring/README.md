# Mastery ring (design mock v1, row CM-D1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.4, §7.7, §14 (rings at 320 with cells still 54 dp, contrast of theme tokens, labels "Mastered", "Ready to refresh", "New volume"). Wireframe: `design/wireframes/journey/mastery-ring.md`. Built by **CM-20**.
Stylesheet, tokens, constants and the checks made on the shots: `design/screens/daily-review/README.md`.

| File | Shows |
|---|---|
| `mock/mastery-ring.html` | A (one 54 x 76 cell at levels 0 to 3; level 2 in each of the five theme tokens), B and C (Ready to refresh: halo and sparkle; New volume: the plus marker; both), D (two grid rows with the Next triangle, the In your plan ring, the start pin, story counts and the legend line), E (the cell page block), G (Words known: Home pill, milestone and level-up banners, the route card line) |
| `shots/mastery-ring-320.png`, `shots/mastery-ring-768.png` | the page at 320 (2x) and 768 (1x; the grid rows use the 112 dp cell) |

How the track is drawn (SVG in the mock; CM-20 draws it with react-native-svg inside the cell's border box):
- The outline of the cell's rounded rectangle (`radii.md`), started at the top centre and drawn clockwise, is split into three equal segments with three `spacing.xs` gaps; the first gap is centred on the top edge, under the Next triangle.
- A filled segment is a 2 dp band in `colors.theme.<column>` outside a 1 dp `border.shape` keyline; an empty one is the keyline alone. Level 3 draws both with no gaps.
- The halo is a 2 dp outline just outside the cell in the theme token at `GLOW_OPACITY`; the sparkle and the plus are stickers centred on the top and bottom edges.
