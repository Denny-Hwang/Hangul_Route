# Icon: Learning Route glyphs `route` and `flag` (component spec v1, LR-D)

Spec: `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md`:
- section 4.3 (the goal tag and the route card lines);
- section 5.1 (the Route tab icon);
- section 10 (glyphs hidden, words carry the meaning);
- assumption b (both glyphs read clearly at tab size and at 20 dp in greyscale);
- PR LR-2 in section 13.

Wireframes: `design/wireframes/journey/learning-route.md` A, A2, G (`[flag]`, the Route tab), `parent/learning-route.md` R and L2, `console/learning-route.md` T3.
Screens that use them: `design/screens/learning-route/` (`route-card.md`, `stage-list.md`, `tab-bar.md`).
Code (LR-2):
- `packages/design-system/src/components/Icon/glyphs.ts` (geometry, pure data);
- `types.ts` (`IconName` gains `route` and `flag`);
- tests in `Icon/__tests__/glyphs.test.ts`;
- an entry in `spec.md` of this folder (the Icon sheet).

Preview: `learning-route-glyphs-v1.png`, rendered from `learning-route-glyphs.html`. The preview shows:
- both glyphs at 20, 24, 48 and 96 dp, next to `journey`, `pin`, `home`, `library` and `check-circle`;
- the same grid in greyscale;
- each glyph in context: the tab bar at 320, the stage-row tags at 16 dp, and the route card lines at 20 dp;
- the pip-size marks, as placeholders for F-ENT-003 E3-D.

## What they are

| Glyph | Meaning | Where | Look |
|---|---|---|---|
| `route` | The Learning Route page | the Route tab icon (LR-4), 24 dp; selected `brand.primary`, else `text.muted` | a path from a start dot that bends back up to a solid map pin. Filled like the other tab icons (`home`, `library`), so the bar keeps one weight |
| `flag` | The goal stage | the route card's Goal line, 20 dp (LR-5a); the "Your goal", "{name}'s goal" and "Plan goal" tags, 16 dp (LR-5a, LR-8); the report's goal line, 20 dp (LR-8) | a pole with a swallow-tail pennant. The pennant is solid, so it holds at 16 dp |

Both use the same 24 x 24 grid and drawing rules as the existing set: round caps and joins, stroke 2.2 on any line that risks a hairline at 20 dp, and solid filled parts.

```
route: fill circle(5, 20, 2.2)
       + stroke M5 20 H15.75 A3.25 3.25 0 0 0 15.75 13.5 H11.5 (2.2)
       + fill M8.5 14.6 C6.4 12.4 3.4 9.6 3.4 6.8 A5.1 5.1 0 0 1 13.6 6.8 C13.6 9.6 10.6 12.4 8.5 14.6 Z
              M6.7 6.8 A1.8 1.8 0 1 0 10.3 6.8 A1.8 1.8 0 1 0 6.7 6.8 Z
flag:  stroke M6 21.5 V3 (2.2)
       + fill M6 3.5 H18.5 L15.5 8 L18.5 12.5 H6 Z
```

- **The pin's hole.** The pin's hole is a second subpath drawn in the opposite direction to the drop. `react-native-svg`'s default `nonzero` fill rule then leaves it empty, as the browser does in the preview. LR-2 needs no `fillRule` prop. The glyph test pins the hole (see Tests).
- **The path arrives at the pin.** Its round end cap stops 0.3 units from the pin's right side.
  - At 48 and 96 dp a hairline gap shows.
  - At 20 and 24 dp the two parts join, and the glyph reads as one road arriving at the pin (preview, first two rows).
  - The start dot and the bend keep the path readable at every size.
- **Inside the box.** With the stroke caps, `route` spans x 2.8 to 20.1 and y 1.7 to 22.2, and `flag` spans x 4.9 to 18.5 and y 1.9 to 22.6. Both are inside the 24 x 24 grid.

## Why these shapes

- **`route` is not `journey`.** The Journey glyph is a winding line between two equal dots, the grid you move across. The Route glyph adds the pin, so it reads as "where you are on the way". In the preview the two differ in outline at 20 and 24 dp, also in greyscale: the solid pin against two small dots. This keeps the bar's Route and Journey apart by shape, which the purpose lines (LR-OD-3) then confirm in words.
- **`route`'s pin is solid, `pin` is outlined.** The outlined `pin` already means "You started here" (F-ROUTE-001 R-2a). The Route tab never sits next to that tag. The solid drop matches the other filled tab icons, and is the version that holds at 24 dp in `text.muted`.
- **`flag` is a goal, never a warning.** The pennant is the plain "destination" sign. It is never drawn in `feedback.danger` or `feedback.nudge`: it uses `text.primary`, the same ink as the pin beside it. It is not a report or a "flag this" control, and it carries no number.
- **No lock, no star, no trophy.** Reaching the goal is said in words ("reached"); no new reward glyph is added (anti-shame and no-commerce rules, section 11).

## Rules

- **Tokens only.** Callers pass a colour token: `text.primary` on the card and the tags; `brand.primary` or `text.muted` in the tab bar (the bar's existing tints).
- **Never alone.** Every use sits next to its words: "Route" with the accessibility label "Learning Route"; "Goal", "Your goal", "{name}'s goal", "Plan goal", "Sam's goal: Stage 2 · Words". Colour is never the only cue (section 10).
- **Hidden from screen readers.** The tab gets its label from the navigator. Elsewhere the glyph sits inside a labelled row or is wrapped as the Icon spec describes (`spec.md`, "Accessibility").
- **Sizes.**
  - Tab: 24 dp.
  - Route card and report lines: 20 dp.
  - Stage-row tags: 16 dp, the size `TrailRow` already uses for `pin` in "You started here".
  - At 16 dp, a line of `flag` at stroke 2.2 is 1.5 px wide, the same weight as `pin` at that size. The tag's words carry the meaning.
- **No speaking glyph.** Nothing in this sheet suggests a microphone or a mouth (owner decision 2026-10-10).

## Pip-size marks are not in this sheet

The "Not open yet" dotted ring and the "In your plan" solid ring at pip and cell size belong to F-ENT-003 E3-D (`design/components/RouteMarkers/`). The preview draws them only as placeholders, so the glyphs can be judged beside them:
- the dotted ring is today's `later` pip (`PipRow` geometry);
- the solid ring is a 16 px ring at `borderWidth.base` in `border.shape`.

LR-5a and LR-5b take the final shapes from E3-D. The amendment fixes only that "Not open yet" and "Coming later" share the dotted ring, and that the words tell them apart (section 4.5).

## Assumption b (checked on the preview)

| Check | Result |
|---|---|
| `route` at 24 dp in the tab bar, selected and not selected | reads as a pin on a path; distinct from `journey` in outline, also in greyscale |
| `flag` at 20 dp beside `pin` on the route card | distinct silhouettes: a closed drop and an open pennant |
| `flag` at 16 dp in a tag | the pennant stays solid; the pole stays visible |
| Greyscale | both glyphs keep their outline; nothing depends on hue |
| Selected tab in greyscale | told apart only by tint, which is the bar's existing behaviour for every tab. This is noted in `design/screens/learning-route/tab-bar.md`, not changed here |

LR-4's e2e and LR-10's screenshots check the real bar.

## Tests (LR-2)

The existing glyph tests already check every glyph: drawn, valid paths, distinct, inside the 24 x 24 box, stroke 1.5 to 3. LR-2 adds a block that pins:
- **`route`**: one stroke part at width 2.2; a filled start dot; and a filled pin made of two subpaths. The two subpaths must have opposite signed areas (shoelace sum over the path's sampled points), so the hole stays open under `nonzero`.
- **`flag`**: one vertical stroke part (the pole) and one closed filled part (the pennant) whose right edge has a notch: `L15.5 8` lies inside the pennant's bounding box.
- **Both names** are in `IconName`, and both are distinct from `journey` and `pin` (the existing distinctness test).
