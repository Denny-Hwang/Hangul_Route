# Button

**The most-touched element in the app.** If a Button feels right, the rest follows.

## 1. Context

5 tones (`primary` / `secondary` / `ghost` / `success` / `nudge`) × 4 sizes (`sm` / `md` / `lg` / `hero`) × 3 states (default / pressed / disabled) = 60 cells in the matrix. Most-used: `primary lg fullWidth` (Quest start, Continue).

## 2. Layout per cell

- Pill shape (`radii.pill`)
- Horizontal padding: sm `lg`(16) · md `xl`(24) · lg `xl`(24) · hero `xxl`(32)
- Vertical padding: `sm`(8)
- Min height: sm `min`(64) · md `min`(64) · lg `child`(80) · hero `hero`(96)
- Label: centered, `body`(18) / `bodyLg`(20) / `prompt`(22) by size, weight 600
- Optional `leading` icon (left) / `trailing` icon (right) with `sm`(8) spacing

## 3. Tones

| Tone | Fill | Pressed | Label | Use |
|---|---|---|---|---|
| `primary` | `brand.primary` #E8743B | `brand.primaryDark` #B5562A | `text.onPrimary` white | Default CTAs |
| `secondary` | `brand.secondary` #4A9DD6 | `brand.secondaryDark` #2E72A3 | white | Alt CTAs, info |
| `ghost` | transparent | `brand.primaryLight` #FAD9C6 | `brand.primary` | Cancel, secondary nav |
| `success` | `feedback.success` #4FA871 | #3F8A5C | white | Completion confirm |
| `nudge` | `feedback.nudge` #F2B33D | #D89B2B | `text.primary` | Soft prompt, "try again" |

Disabled: fill becomes `surface.sunken` #F2EBDE, label `text.muted` #8A7860, opacity 0.6.

## 4. Anti-patterns

- Sharp corners (must be pill)
- More than 2 lines of label text
- Ghost button with red border (no red anywhere)
- Hero size on non-primary action
- Trailing arrow icon on every button (use only when navigation forward)

## 5. Claude Design prompt

```prompt
Create a Button component matrix for Hangul Route. Output: one 2000 × 2400
PNG showing the full button matrix arranged in a grid.

Rows: 5 tones × 3 states = 15 rows
Columns: 4 sizes (sm / md / lg / hero) = 4 columns
Total: 60 cells

Sizes (height × min padding-x):
- sm: 64h × 16px-padX, label 16sp
- md: 64h × 24px-padX, label 18sp
- lg: 80h × 24px-padX, label 20sp
- hero: 96h × 32px-padX, label 22sp

All buttons are pill shape (border-radius 999px).
Label weight 600, centered.

Tone colors (fill / pressed-fill / label-color):
- primary: #E8743B / #B5562A / #FFFFFF
- secondary: #4A9DD6 / #2E72A3 / #FFFFFF
- ghost: transparent (2px border #E8743B) / #FAD9C6 / #E8743B
- success: #4FA871 / #3F8A5C / #FFFFFF
- nudge: #F2B33D / #D89B2B / #2A1F14

States (left-to-right within each row):
1. Default
2. Pressed (use pressed fill, scale 0.98)
3. Disabled (fill #F2EBDE, label #8A7860, opacity 0.6)

Sample labels per size:
- sm: "Skip"
- md: "Continue"
- lg: "Start quest"
- hero: "Let's start"

Background: warm hanji cream #FCF8F1
Cell margin: 24px between buttons
Row labels on left in #5C4A36 16sp identifying tone + state
Column labels on top in #5C4A36 16sp identifying size

Anti-patterns:
- Sharp corners (must be pill — border-radius 999)
- Drop shadows that look like Material Design
- Red on any button
- White background

Deliverable: 2000 × 2400 PNG button matrix sheet, ready to validate against
packages/design-system/src/components/Button/Button.tsx.
```

## 6. Output path

- `design/components/Button/matrix__v1__YYYY-MM-DD.png`
