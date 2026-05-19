# Tile

**The unit of touch in minigames.** A Korean letter on a generous square, ready to be tapped.

## 1. Context

Tile is the foundational interactive surface for Match Sound (F-001 §3.1), Build a Letter, Trace Stroke, and most Recognition / Construction games. The child taps the right tile to score.

4 states (`idle` / `correct` / `wrong` / `disabled`) × 3 sizes (sm / md / lg).

## 2. Layout

- Square aspect (`size × size`)
- Radius: `lg` (16)
- Border: 2px in state color
- Inner padding: `md` (16)
- Center stack: large Korean glyph + small romanization below
- Glyph size: sm `title`(28) · md `display`(36) · lg `hero`(48)
- Romanization size: `bodySm` (16), `text.muted`, weight 500
- Shadow: `card` (subtle) only in `idle` and on press
- Press transform: `scale(1.04)` (a small "I'm awake" lift)

## 3. State colors

| State | Background | Border | Glyph | Romanization |
|---|---|---|---|---|
| `idle` | `surface.paper` #FFFFFF | `border.subtle` #E8DFCD | `text.primary` #2A1F14 | `text.muted` #8A7860 |
| `correct` | `feedback.successLight` #D6EFDF | `feedback.success` #4FA871 | `feedback.success` | `text.muted` |
| `wrong` | `feedback.nudgeLight` #FCEED1 | `feedback.nudge` #F2B33D | #B5862A (deep amber) | `text.muted` |
| `disabled` | `surface.sunken` #F2EBDE | `border.subtle` | `text.muted` | `text.muted` |

Anti-shame: `wrong` uses amber, never red. Tile shakes ±2px ×3 over 200ms (`shake.gentle`), then settles into `wrong` color until re-tap unlocks `idle`.

## 4. Sizes

- sm: 64dp (CLAUDE.md floor) — distractor tiles, secondary
- md: 80dp (child) — default minigame tile
- lg: 96dp (hero) — jamo prompts, big-letter rounds

## 5. Claude Design prompt

```prompt
Create a Tile component matrix for Hangul Route. Output: one 1600 × 1600
PNG showing the full tile state × size matrix.

Rows: 4 states (idle / correct / wrong / disabled) = 4 rows
Columns: 3 sizes (sm 64 / md 80 / lg 96) = 3 columns
+ 1 extra row at the bottom for "press" state of md size (scale 1.04)

Each tile is a square showing a Korean jamo in the center + romanization
below. Use these sample jamo:
- Row 1 (idle): ㄱ / ㄴ / ㄷ (with rom: giyeok / nieun / digeut)
- Row 2 (correct): ㄱ / ㄴ / ㄷ
- Row 3 (wrong): ㄱ / ㄴ / ㄷ
- Row 4 (disabled): ㄱ / ㄴ / ㄷ
- Bottom row (md press): ㅏ with scale 1.04 transform indicator

Tile dimensions and inner spec:
- sm: 64×64 box, glyph 28sp, rom 16sp, inner padding 16px
- md: 80×80 box, glyph 36sp, rom 16sp, inner padding 16px
- lg: 96×96 box, glyph 48sp, rom 16sp, inner padding 16px

State colors (fill / border-2px / glyph):
- idle: #FFFFFF / #E8DFCD / #2A1F14
- correct: #D6EFDF / #4FA871 / #4FA871
- wrong: #FCEED1 / #F2B33D / #B5862A
- disabled: #F2EBDE / #E8DFCD / #8A7860

All tiles: 16px border-radius (radii.lg).
Background canvas: warm hanji cream #FCF8F1.
Inter-tile gutter: 24px.
Soft warm-dark card shadow (0/2/8, 6% opacity) on idle and press rows only.

Row labels on left in #5C4A36 16sp identify the state.
Column labels on top identify the size.

Anti-patterns:
- Red anywhere (wrong state uses amber, not red)
- Sharp corners
- Glyph touching the tile edge (must respect 16px inner padding)
- Romanization larger than 16sp (must be subordinate to glyph)
- Press state with scale > 1.08 (too jumpy for kids)

Deliverable: 1600 × 1600 PNG tile matrix sheet.
```

## 6. Output path

- `design/components/Tile/matrix__v1__YYYY-MM-DD.png`
