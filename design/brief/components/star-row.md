# StarRow

**The earned reward signal.** 3 stars max per quest. Hand-painted, never digital.

## 1. Context

Used on Quest Results screen (big stars, 48px), Episode quest list (small stars, 18px), Home screen "Recent stars" card. The 3-tier reward per F-001 §3.1: 3 stars = perfect, 2 = good, 1 = tried.

## 2. Layout

- Horizontal row of 3 star glyphs
- Filled stars: `feedback.nudge` #F2B33D fill, 1.2px `#B5862A` stroke
- Unfilled stars: `surface.sunken` #F2EBDE fill, 1.2px `border.strong` #C5B8A1 stroke
- Inter-star spacing: `sm` (8)
- Size prop: 18 / 28 / 32 / 48 typical
- Always center-aligned (group)

## 3. Star shape spec

A classic 5-point star, slightly rounded at the points (not razor sharp).
Outer radius : inner radius = 2.6 : 1 (warmer feel than the classic 2.0 : 1 which is too pointy for kids).

## 4. Anti-patterns

- Stars filled with primary orange (must be amber `nudge`)
- More than 3 stars in a row (the contract is 3 max)
- Stars with hard digital glints
- Asymmetric arrangement (always centered, evenly spaced)
- Stars at sizes < 16px (lose star shape, become blobs)

## 5. Claude Design prompt

```prompt
Create a StarRow component sheet for Hangul Route. Output: one
1600 × 1200 PNG showing all star-row variants.

A "star row" is a horizontal arrangement of exactly 3 star glyphs.

Show 4 reward tiers × 4 sizes = 16 cells in a grid:
- Rows (4 reward tiers): 0/3 / 1/3 / 2/3 / 3/3 filled stars
- Columns (4 sizes): 18 / 28 / 32 / 48 pixels per star

Star glyph spec:
- 5-point classic star with slightly rounded points (NOT razor sharp)
- Outer-to-inner radius ratio: 2.6 : 1 (warmer than classic 2.0)
- Filled state: #F2B33D fill, 1.2px #B5862A stroke
- Unfilled state: #F2EBDE fill, 1.2px #C5B8A1 stroke
- Inter-star spacing: 8px

All star rows center-aligned within their cells.
Background canvas: warm hanji cream #FCF8F1.
Row labels on left in #5C4A36 16sp: "0 stars" "1 star" "2 stars" "3 stars".
Column labels on top: "18px" "28px" "32px" "48px".

Sample-row labels below each row showing context phrase:
- "0/3 — brave try" (cell color hint of muted text)
- "1/3 — good start"
- "2/3 — great"
- "3/3 — wonderful!"

Anti-patterns:
- Razor sharp star points (must have ~3% corner radius on each point)
- Stars filled with red, primary orange, or any non-amber color
- Stars with digital glint/sparkle highlights
- Inconsistent stroke widths across sizes
- Asymmetric placement within cells

Deliverable: 1600 × 1200 PNG star-row sheet, ready to validate against
packages/design-system/src/components/StarRow/StarRow.tsx.
```

## 6. Output path

- `design/components/StarRow/variants__v1__YYYY-MM-DD.png`
