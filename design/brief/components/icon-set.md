# Icon Set

**19 geometric icons.** Hand-painted feel, single-stroke, recognizable at 24dp.

## 1. Context

The Icon component currently ships 19 named icons (play / pause / speaker / replay / check / close / arrow-left / arrow-right / lock / star / card / home / journey / library / parent / settings / profile / plus / sparkle) — see `packages/design-system/src/components/Icon/types.ts`.

Used in: tab bar (home / journey / library / card / profile), buttons (close / replay / speaker), navigation (arrow-left for back, lock for preview cells), feedback (check / star / sparkle).

## 2. Universal spec

- Canvas: 24 × 24 viewBox
- Stroke: 2px (or 3px for `check`, `close`, `arrow-*`, `plus` — bolder for action)
- Color: parameterized — defaults to `text.primary` #2A1F14 when not provided
- Style: geometric, slightly rounded at line caps and corners (no razor edges)
- No fills except where shape requires (e.g., `play`, `lock`, `home`, `star`)
- All icons share visual weight — none "louder" than another

## 3. Icon list (19)

| Name | Use | Notes |
|---|---|---|
| `play` | Audio replay button | Filled triangle, no border |
| `pause` | Audio pause | Two vertical rounded bars |
| `speaker` | "Hear it" button | Speaker box + 2 arc waves |
| `replay` | Replay icon | Circular arrow CCW |
| `check` | Correct answer marker | 3px bold stroke, no fill |
| `close` | Dismiss / cancel | 3px bold stroke X |
| `arrow-left` | Back navigation | 3px bold stroke |
| `arrow-right` | Forward navigation, step indicator | 3px bold stroke |
| `lock` | Preview / locked cells | Filled keyhole + arch |
| `star` | Rating, favorite | Filled 5-point star |
| `card` | Heritage card concept | Rounded rect + middle line |
| `home` | Tab bar — Today | Filled house silhouette |
| `journey` | Tab bar — Journey | Three horizontal bars (grid hint) |
| `library` | Tab bar — Library | Three book spines + tilted book |
| `parent` | Parent gate / dashboard | Filled circle (head) — minimal |
| `settings` | Settings | Open ring (cog placeholder) |
| `profile` | Tab bar — Me | Head + shoulders silhouette |
| `plus` | Add (profile, etc.) | 3px bold stroke + symbol |
| `sparkle` | Celebration accent | 4-point pinwheel star |

## 4. Anti-patterns

- Multi-color icons (single color, parameterized via prop)
- Icons under 16px size (lose recognizability)
- Sharp corners on action icons (round line caps)
- "Material Design" filled icons (we lean geometric/stroke)
- Inconsistent stroke widths across the set

## 5. Claude Design prompt

```prompt
Create the Hangul Route Icon Set sheet. Output: one 2000 × 1200 PNG
showing all 19 icons in a grid.

Layout: 5 rows × 4 columns (= 20 cells; 19 icons + 1 blank for spacing).
Each cell is 400 × 240, with the icon rendered at 96 × 96 centered, and
the icon name below in 16sp #5C4A36.

Universal spec for all 19 icons:
- 24 × 24 viewBox, rendered at 96px for the sheet
- Single color: #2A1F14 (text.primary)
- Stroke width: 2px default, 3px for action icons (check / close /
  arrow-left / arrow-right / plus)
- Round line caps and round joins everywhere
- Geometric, hand-painted feel with very slight wobble (~1px max)
- Fills only where shape requires (play / lock / home / star / library
  spines / parent / profile / sparkle)
- No multi-color, no gradients, no shadows

The 19 icons (specific designs):

1. play — Filled rightward triangle, vertices at (8,5) (19,12) (8,19)
2. pause — Two filled vertical rounded bars, 4px wide, at x=6 and x=14,
   spanning y=5 to y=19, 2px corner radius
3. speaker — Speaker box trapezoid + 2 sound-wave arcs to the right
4. replay — Circular arrow going counter-clockwise, arrowhead at top
5. check — 3px stroke checkmark: M5,12 L10,17 L19,7 (no fill)
6. close — 3px stroke X: two crossing diagonals
7. arrow-left — 3px stroke chevron pointing left
8. arrow-right — 3px stroke chevron pointing right
9. lock — Filled keyhole body (rounded rect) + arch above
10. star — Filled 5-point classic star with slightly rounded points
11. card — Rounded rect (3px border, no fill) + horizontal middle line
12. home — Filled house silhouette: triangle roof + square body + door cutout
13. journey — Three horizontal bars (3px stroke) — like a grid hint
14. library — Three vertical book spines + one tilted book leaning right
15. parent — Small filled circle (a head) at center — minimal placeholder
16. settings — Open ring (cog placeholder) — circle outline
17. profile — Head circle + curved shoulder shape below
18. plus — 3px stroke + sign, equal arms
19. sparkle — 4-point pinwheel star, filled

Background canvas: warm hanji cream #FCF8F1.
Inter-cell gutter: subtle 1px #E8DFCD divider lines.
Sheet title at the top: "Icon Set v1 — 19 geometric icons" in 24sp bold #2A1F14.

Anti-patterns:
- Multi-color icons
- Stroke widths < 2px or > 3px
- Sharp line caps (must be round)
- Icons that look like Material Design (we lean geometric/stroke)
- Inconsistent visual weight (one icon louder than others)
- Pure black anywhere (use #2A1F14)

Deliverable: 2000 × 1200 PNG icon set sheet, ready to validate against
packages/design-system/src/components/Icon/Icon.tsx.
```

## 6. Output path

- `design/components/Icon/set__v1__YYYY-MM-DD.png`
- Individual SVGs at `design/components/Icon/svg/{name}.svg`
