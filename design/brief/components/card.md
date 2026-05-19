# Card

**The hanji-paper sheet.** Every grouping of related content sits in a Card.

## 1. Context

Cards are everywhere — Today's Quest, Episode summary, Library tiles, Profile cards, Parent Dashboard, Heritage cards (different brief, see illustrations). 5 tones × 3 elevations × 4 padding levels.

## 2. Layout

- Radius: `lg` (16)
- Padding: `none`(0) · `sm`(12) · `md`(16) · `lg`(24)
- Shadow: `flat` (none) · `card` (soft, 2dp elevation) · `raised` (lifted, 6dp)
- Tone: `paper` (default white) · `sunken` (cream inset) · `brand` (warm orange tint) · `success` (green tint) · `nudge` (amber tint)
- Optional `onPress` makes the whole card tappable — scales to 0.98 on press

## 3. Tones

| Tone | Fill | Use |
|---|---|---|
| `paper` | `surface.paper` #FFFFFF | Default content card |
| `sunken` | `surface.sunken` #F2EBDE | Helper/secondary info, inset feel |
| `brand` | `brand.primaryLight` #FAD9C6 | CTAs, brand moment (FirstQuestPreview, "card unlocked!") |
| `success` | `feedback.successLight` #D6EFDF | Completion ("All clear!", "Quest done") |
| `nudge` | `feedback.nudgeLight` #FCEED1 | Gentle prompt ("Listen again") |

## 4. Shadow recipes

- `card` (elevation 2): offset (0, 2), blur 8, color #2A1F14 @ 6%
- `raised` (elevation 6): offset (0, 4), blur 16, color #2A1F14 @ 10%
- All shadows tinted warm-dark (`text.primary` base), never pure black

## 5. Claude Design prompt

```prompt
Create a Card component matrix for Hangul Route. Output: one 2000 × 1600
PNG showing all card variants in a grid.

Rows: 5 tones × 3 elevations = 15 rows
Columns: 4 padding levels (none / sm / md / lg) = 4 columns

Each card is 360 × 200 pixels (representative size).
Each card contains: a 24sp bold title "Hello" (top-left) + a 16sp
secondary line "Hoya says hi" below in #5C4A36.

Tone fills:
- paper: #FFFFFF
- sunken: #F2EBDE
- brand: #FAD9C6
- success: #D6EFDF
- nudge: #FCEED1

Elevations (shadow recipes):
- flat: no shadow
- card: offset (0, 2), blur 8, color #2A1F14 at 6% opacity
- raised: offset (0, 4), blur 16, color #2A1F14 at 10% opacity

Padding (visible content inset from card edge):
- none: 0px (content touches edge — only used for image-first cards)
- sm: 12px
- md: 16px
- lg: 24px

All cards: 16px border-radius (radii.lg).
Background canvas: warm hanji cream #FCF8F1.
Row labels in #5C4A36 16sp identify tone + elevation.
Column labels on top identify padding level.

Anti-patterns:
- Pure black shadows (must be warm-dark tinted)
- Hard 1px borders (cards use shadow elevation, not borders, except sunken
  which has a 1px #E8DFCD subtle border)
- Sharp corners
- Drop shadows below 6% opacity (invisible) or above 10% (too heavy)

Deliverable: 2000 × 1600 PNG card matrix.
```

## 6. Output path

- `design/components/Card/matrix__v1__YYYY-MM-DD.png`
