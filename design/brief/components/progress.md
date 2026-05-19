# Progress

**The "you're moving" signal.** Two variants: continuous bar (Stage progress) and discrete dots (quest steps).

## 1. Context

Used on Home screen (Stage 1 % complete), Quest player (5-step dots), Library (% cards collected), Minigame screens (round 3 of 5). Always paired with an optional small label.

## 2. Layout

### Bar variant
- Full-width rounded pill track (radii.pill)
- Track fill: `surface.sunken` #F2EBDE
- Bar fill: tone color (`primary` / `secondary` / `success`)
- Height: 12px default (configurable)
- Optional label below, right-aligned, `caption` 14sp `text.muted` ("3 of 5 quests")

### Dots variant
- Horizontal row of `n` small circles (max usually 5)
- Each: 12px diameter (matches `height` prop)
- Filled vs unfilled based on `value` index
- Inter-dot spacing: `sm` (8)
- Optional label inline to the right

## 3. Tones

| Tone | Color | Use |
|---|---|---|
| `primary` | `brand.primary` #E8743B | Default — Stage progress |
| `secondary` | `brand.secondary` #4A9DD6 | Card library % |
| `success` | `feedback.success` #4FA871 | Streak days, achievement |

## 4. Anti-patterns

- Bar fill in red (use `success` for milestones, never red)
- Dots in different colors per state (filled vs unfilled is the only contrast)
- Animated progress that ticks too fast (children need ~600ms to track motion)
- Label inside the bar (always above or below)

## 5. Claude Design prompt

```prompt
Create a Progress component sheet for Hangul Route. Output: one
2000 × 1200 PNG with two sections (top: bar variant, bottom: dots variant).

TOP SECTION — Bar variant matrix (1000 × 1200, left half)
- 3 tones (primary / secondary / success) × 4 fill levels (25% / 50% / 75% / 100%)
- Each bar: 320px wide, 12px tall, pill rounded (radii.pill)
- Track fill: #F2EBDE
- Bar fill colors:
  - primary: #E8743B
  - secondary: #4A9DD6
  - success: #4FA871
- Label below each, right-aligned, 14sp #8A7860 italic:
  "25% — 1 of 4", "50% — 2 of 4", "75% — 3 of 4", "100% — done!"
- Vertical spacing: 32px between rows

BOTTOM SECTION — Dots variant matrix (1000 × 1200, right half)
- 3 tones × 5 fill levels (0/5, 1/5, 2/5, 3/5, 5/5)
- Each row: 5 dots, 12px diameter, 8px spacing
- Filled dot: tone color
- Unfilled dot: #F2EBDE
- Label inline to the right, 14sp #8A7860 italic, "Round X of 5"

Background canvas: warm hanji cream #FCF8F1.
Section labels at the top of each section in #5C4A36 18sp bold.
Tone row labels on the left of each row.

Anti-patterns:
- Red used as a tone (no destructive progress in this app)
- Bar height > 16px (too chunky)
- Dots smaller than 8px (lose visibility)
- Track color matching bar color (must contrast)

Deliverable: 2000 × 1200 PNG Progress component sheet.
```

## 6. Output path

- `design/components/Progress/variants__v1__YYYY-MM-DD.png`
