# PipRow: the drawn pips of My route (component spec v1)

Spec: `docs/specs/F-ROUTE-001-my-route-overview.md` §3.4 (pips and cells), §3.5 (cursor), §3.6 (start marker), §3.14 (no colour-only meaning, border token), PR R-2b in §6.1, assumptions (a) and (b) in §9 · wireframe: `design/wireframes/journey/my-route-overview.md` (pip legend; screens A, B, C2, C3, C5, G)
Code: `packages/design-system/src/components/PipRow/geometry.ts` (pure geometry), `PipRow.tsx`, `Pip.tsx`, `types.ts` · token `colors.border.shape` (`design/tokens/colors.v1.md`) · tests `PipRow/__tests__/geometry.test.ts`, `src/__tests__/contrast.test.ts`
Preview: `pip-row-v1.png`. It shows the five shapes at 20, 24 and 48 dp and the wireframe rows (A mid-progress, a taste stage, C2 placed learner wrapping at 320, C5 the grown group, a cell row). Each is drawn three times: normal, greyscale, and protanopia (Machado 1.0). The page is generated from `geometry.ts`, so the preview is the shipped geometry.

## What it is

One drawn shape per grid quest, in route order. It is **a collection, not a bar**: there is no track behind the pips and no fixed count of empty slots. The row shows what exists and wraps onto more lines when it runs out of width. A done pip never changes, moves or disappears. New content adds pips; it never empties filled ones.

## The five shapes

Drawn in a `size x size` box. `size` is 20 dp in a stage row and 24 dp in a cell row, scaled with the layout class by `useMediaSize`. The ring stroke `w = max(2, size / 10)`, which is 2 dp at 20 dp.

| State | Meaning | Shape | Ink |
|---|---|---|---|
| `done` | the quest has `completedAt` | filled disc | fill = the caller's accent (the stage colour, decoration only); edge 0.75 w in `border.shape` |
| `known` | placed out by the level check, **not** done | ring plus a solid inner disc, diameter half the pip, with a visible gap of at least 1 dp | `border.shape` |
| `open` | playable, not done | ring, stroke w | `border.shape` |
| `new` | joined a Complete stage after it was completed | ring plus a four-point sparkle inside (tips 0.3 size from the centre) | `border.shape` |
| `later` | cell not shipped | dotted ring with 8 dashes (dash 55 %, gap 45 % of the period; at least 4 required) | `border.shape` |

**Markers.**
- Cursor: a solid triangle in `text.primary`, centred over the next quest's pip and pointing down at it. It sits in a band 0.45 size tall above the pip.
- Start: a solid map-pin drop in `text.primary` with a paper dot, below the start pip. It sits in a band 0.75 size tall, so the pin is at least 0.6 size tall (12 dp at a 20 dp pip). The pin uses the outline of the `pin` icon glyph, which is also the glyph on the "You started here" tag.
- A row reserves a band only when one of its pips uses that marker.

**Groups.** `groups` are drawn with a wider gap between them: `spacing.md` between groups, `spacing.xs` between pips, and `spacing.xs` between lines. Wireframe C5 uses this: the earned group first, then the new quests after a gap, so the earned group never looks emptier. The caller can also split quest pips from later pips (wireframe A, Stage 2).

## Design pass (spec §9 assumptions a and b)

- **(a) Distinct without colour.** Every state differs in geometry, not only in ink. A test replaces every ink with one colour and asserts that the five silhouettes stay pairwise different. The preview checks the same thing by eye at 20 dp in greyscale and protanopia: done (solid disc), known (ring, gap, disc), open (empty ring), new (ring with a sparkle) and later (dashes) all stay apart.
- **(b) The border token.** `border.shape` #857360 measures 4.55:1 on paper, 4.29:1 on canvas, 3.84:1 on sunken and 3.42:1 on `brand.primaryLight`. Every pairing clears the 3:1 non-text minimum (WCAG 1.4.11), and `contrast.test.ts` pins each one. `border.strong` (1.9:1 on paper) stays a quiet divider. The stage colours (stage1-4 at 2.3 to 3.0:1) only fill a done disc, whose edge is always `border.shape`.

## Rules

- **Drawn, never typed.** Every pip and marker is a `react-native-svg` part. There is no `Text` and no arrow, shape, dingbat or emoji-capable character (such as U+25B6, U+25C0 or U+25BC) in any source file. A test scans the sources.
- **Tokens only.** The inks are `border.shape`, `text.primary`, `surface.paper` and the caller's accent token. The components contain no colour literal (tested).
- **Decorative.** `PipRow` is hidden from screen readers (`importantForAccessibility="no-hide-descendants"`, `accessibilityElementsHidden`). The stage row's accessibility label carries the facts (§3.14). `Pip` draws one shape for the "What the shapes mean" legend, and the caller puts the word next to it.
- **No ratio, no score.** The row never carries a count, a percentage or an `x / y`. Below 360 dp of width, R-3 shows the stage caption and a plain `Progress` bar instead of the row (§3.4).
- **No motion in v1.** The one-time fill of a newly done pip (§3.14) belongs to R-3, and only when motion is not reduced.

## Props

```ts
<PipRow groups={[[{ key, state, isCursor?, isStart? }, ...], ...]} context="stage" | "cell" accent={colors.stage[stage]} />
<Pip state="known" context="stage" />
```
