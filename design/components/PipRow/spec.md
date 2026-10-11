# PipRow: the drawn pips of My route (component spec v1)

Spec: `docs/specs/F-ROUTE-001-my-route-overview.md` §3.4 (pips and cells), §3.5 (cursor), §3.6 (start marker), §3.14 (no colour-only meaning, border token), PR R-2b in §6.1, assumptions (a) and (b) in §9 · wireframe: `design/wireframes/journey/my-route-overview.md` (pip legend; screens A, B, C2, C3, C5, G)
Code: `packages/design-system/src/components/PipRow/geometry.ts` (pure geometry), `PipRow.tsx`, `Pip.tsx`, `types.ts` · token `colors.border.shape` (`design/tokens/colors.v1.md`) · tests `PipRow/__tests__/geometry.test.ts`, `PipRow/__tests__/PipRow.test.tsx` (element trees: margins, svg height, marker offsets, inks, hiding), `src/__tests__/contrast.test.ts`
Preview: `pip-row-v1.png`. It shows the five shapes at 20, 24 and 48 dp, a done and an open pip in every stage colour and the default accent, the wireframe rows (A mid-progress, a taste stage, C2 placed learner wrapping at 320, C5 the grown group in stage3, C5 wrapping at 320, a cell row; the mid-progress row is also drawn in stage2 and stage3, the two lowest-contrast stage colours), the trail connector, and a row under a 200 % text label. Each is drawn three times: normal, greyscale, and protanopia (Machado 1.0). The page is generated from `geometry.ts`, so the preview is the shipped geometry.

## What it is

One drawn shape per grid quest, in route order. It is **a collection, not a bar**: there is no track behind the pips and no fixed count of empty slots. The row shows what exists and wraps onto more lines when it runs out of width. A done pip never changes, moves or disappears. New content adds pips; it never empties filled ones.

## The five shapes

Drawn in a `size x size` box. `size` is 20 dp in a stage row and 24 dp in a cell row, scaled with the layout class by `useMediaSize`. The ring stroke `w = max(2, size / 10)`, which is 2 dp at 20 dp.

| State | Meaning | Shape | Ink |
|---|---|---|---|
| `done` | the quest has `completedAt` | filled disc with a check inside (an open three-point stroke, width w, round ends, spanning 0.28 to 0.72 size) | fill = the caller's accent (the stage colour, decoration only); edge 0.75 w in `border.shape`; check in `text.primary` |
| `known` | placed out by the level check, **not** done | ring plus a solid inner disc, diameter half the pip, with a visible gap of at least 1 dp | `border.shape` |
| `open` | playable, not done | ring, stroke w | `border.shape` |
| `new` | joined a Complete stage after it was completed | ring plus a four-point sparkle inside (tips 0.3 size from the centre) | `border.shape` |
| `later` | cell not shipped | dotted ring with 8 dashes (dash 55 %, gap 45 % of the period; at least 4 required) | `border.shape` |

**Markers.**
- Cursor: a solid triangle in `text.primary`, centred over the next quest's pip and pointing down at it. It sits in a band 0.45 size tall above the pip.
- Start: a solid map-pin drop in `text.primary` with a paper dot, below the start pip. It sits in a band 0.75 size tall, so the pin is at least 0.6 size tall (12 dp at a 20 dp pip). The pin uses the outline of the `pin` icon glyph, which is also the glyph on the "You started here" tag.
- A row reserves a band only when one of its pips uses that marker.

**Groups.** `groups` are drawn with a wider gap between them: `spacing.md` between groups, `spacing.xs` between pips, and `spacing.xs` between lines. The group gap trails the last pip of a group (a right margin), so a group that wraps onto a new line starts flush left with the lines above. Flex-wrap counts that margin when it decides whether a pip fits, so when the room left on a line is between `size` and `size + (group gap - pip gap)`, the last pip of the group wraps onto the next line early. Order and states are kept; this is accepted as cosmetic (a spacer element would bring the indent back). Both gaps scale with the layout class through `useMediaSize`, like the pips, so the group gap keeps its weight next to 24 and 28 dp pips on regular and wide windows.

**Line pitch.** Every pip cell in a row reserves the same marker bands, so all pips on a line sit at the same height. When a row has a cursor or a start pin and wraps, each line therefore also carries the reserved band room: the visible gap between wrapped lines is `spacing.xs` plus 0.45 size (cursor band) and/or 0.75 size (start band), not `spacing.xs` alone. This is deliberate: reserving a band per line would need layout measurement, and a stage row wraps only in the rare long cases (C2 at 320, a grown group), where the extra room reads as separation, not as a gap in the collection. Wireframe C5 uses this: the earned group first, then the new quests after a gap, so the earned group never looks emptier. The caller can also split quest pips from later pips (wireframe A, Stage 2).

## Design pass (spec §9 assumptions a and b)

- **(a) Distinct without colour.** Every state differs in geometry, not only in ink: the outline (ring or dashed ring) and the interior mark (none, a disc, a filled sparkle or a stroked check). The accent fill is never what tells two states apart. Done is told from open by its check, not by the fill: stage2 (#D89B2B, 2.43:1 on paper) and stage3 (#7BB552, 2.45:1) are below 3:1 on every surface, and stage1, stage4 and stage7 are below it on canvas or sunken. The check is `text.primary`, which is 3.52:1 or more against every stage colour and against the default accent (stage5 is the lowest). Tests: the five geometric signatures are pairwise different, no interior mark uses the accent or paper, open has no interior mark, and for every `colors.stage` value and the default the check holds 3:1 against the fill. The preview checks the same thing by eye at 20 dp in greyscale and protanopia: done (disc with a check), known (ring, gap, disc), open (empty ring), new (ring with a sparkle) and later (dashes) all stay apart, in every stage colour.
- **(a) 200 % text.** Pip size follows the layout class (`useMediaSize`), not the font scale, on purpose: the pips are decoration, the facts are in the row label (which does scale), and scaling the pips with text would double the row length and make it wrap at every width. The preview checks a 20 dp row under a 36 px label (200 % of the 18 body floor): every shape stays distinct and the strokes stay 2 dp, so the row stays legible beside the larger text.
- **The trail connector (§3.14).** R-3 draws it; this pass checks the pairing. The preview draws stage badges joined at the badge centre, 4 dp wide: **solid** in the stage colour down to `trailReached`, **dotted** (round dots every 8 dp) in `border.shape` below. In greyscale and protanopia the two runs stay apart by shape (a continuous line versus a row of dots), so the connector never relies on colour; the dotted run carries the 3:1 `border.shape` ink.
- **(b) The border token.** `border.shape` #857360 measures 4.55:1 on paper, 4.29:1 on canvas, 3.84:1 on sunken and 3.42:1 on `brand.primaryLight`. Every pairing clears the 3:1 non-text minimum (WCAG 1.4.11), and `contrast.test.ts` pins each one. `border.strong` (1.9:1 on paper) stays a quiet divider. The stage colours (stage1-4 at 2.3 to 3.0:1) only fill a done disc, whose edge is always `border.shape` and whose check is always `text.primary`. The cursor and start markers (`text.primary`) are 12.1:1 or more on paper, canvas, sunken and `brand.primaryLight` (tested).

## Rules

- **Drawn, never typed.** Every pip and marker is a `react-native-svg` part. There is no `Text` and no arrow, shape, dingbat or emoji-capable character (such as U+25B6, U+25C0 or U+25BC) in any source file. A test scans the sources.
- **Tokens only.** The inks are `border.shape`, `text.primary` (markers and the done check), `surface.paper` and the caller's accent token. The components contain no colour literal (tested).
- **Decorative.** `PipRow` and `Pip` are hidden from screen readers: `importantForAccessibility="no-hide-descendants"` and `accessibilityElementsHidden` on native, and `aria-hidden` for the web PWA (react-native-web maps only `aria-hidden` to the DOM; `Pip` puts it on a wrapping `View` because the svg may not pass it on). The stage row's accessibility label carries the facts (§3.14). `Pip` draws one shape for the "What the shapes mean" legend, and the caller puts the word next to it.
- **No ratio, no score.** The row never carries a count, a percentage or an `x / y`. Below 360 dp of width, R-3 shows the stage caption and a plain `Progress` bar instead of the row (§3.4).
- **No motion in v1.** The one-time fill of a newly done pip (§3.14) belongs to R-3, and only when motion is not reduced.

## Props

```ts
<PipRow groups={[[{ key, state, isCursor?, isStart? }, ...], ...]} context="stage" | "cell" accent={colors.stage[stage]} />
<Pip state="known" context="stage" />
```
