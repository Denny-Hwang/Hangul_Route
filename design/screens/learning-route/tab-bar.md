# Tab bar: Today · Route · Journey · Library (screen spec v1)

Spec: `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 5.1 (LR-OD-2, LR-OD-3), assumption a · wireframe `design/wireframes/journey/learning-route.md` G
Mock: `mock/tab-bar.html` and the bar under `mock/route-tab.html` · shots `shots/tab-bar-320.png`, `-375.png`, `-1280.png`, `-320-text200.png`, `shots/route-tab-320-first.png`
Code (planned): `navigation/tabs.tsx`, `navigation/types.ts` (LR-4); glyph `route` (LR-2, `design/components/Icon/learning-route-glyphs.md`)

## What changes

- **Flag off:** the three tabs of today, unchanged.
- **Flag on (`flags.myRouteEnabled`):** four tabs in this order: Today, Route, Journey, Library.
- **The new item:** the drawn `route` glyph (24 dp) over the label "Route" (`a11y.tabs.route`). Its accessibility label is "Learning Route" (`a11y.myRoute.tab`).
- **Unchanged look:** `surface.paper`, the `border.subtle` top rule, items of `touchTarget.min`, caption labels at `weight.semibold`, active `brand.primary`, inactive `text.muted`. The bar is centred in `layout.maxWidth.full` on a wide window (`tabBarMetrics`).
- **Fit at 320:** four items of 80 x 64.
- **Headers:** Route shows "Learning Route" over "Where you are and where you are going."; Journey shows "Heritage Journey" over "Every lesson, by stage and theme." (LR-OD-3).

## Large text: a cap on the label (decision for LR-4)

- **The problem.** At 320 with 200 % text, an uncapped caption label is 28 px. "Journey" and "Library" are then wider than their 80 px items: on the mock they overflow, and React Navigation would clip them.
- **The decision.** The label grows with the text size up to 1.3 x caption (18.2 px): LR-4 sets `maxFontSizeMultiplier: 1.3` on the tab label. At that cap every label fits on one line ("Journey" is 69 px of 80; see `shots/tab-bar-320-text200.png`).
- **Why this is acceptable:**
  - the icon and the full accessibility label still carry the meaning;
  - system tab bars do the same (iOS keeps tab labels small and offers the large-content viewer);
  - the screens themselves keep growing without a cap.
- **Assumption a** ("Route" on one line at 320 with 200 % text) holds with the cap. LR-4's e2e at 320 x 568 checks the real bar.

## Observation (not changed here)

In greyscale, the selected tab differs from the others only by its tint, which is the bar's existing behaviour; the navigator does report the selected state to screen readers. The glyph sheet shows this. A second cue (a heavier label weight, or an indicator) would be a change to the existing bar for all tabs, so it is left to a later layout PR, not to LR-4.
