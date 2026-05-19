# Screen 19 — Parent Gate (math challenge)

**The "are you a grown-up?" door.** Apple/Google children category requirement.

## 1. Context

- **When**: tapping "Grown-up zone" CTA on Profile screen, or any commerce/destructive action in future.
- **Goal**: prevent a 5-year-old from bypassing this — but be friendly to the parent.
- **Success**: parent solves a 2-digit multiplication; child cannot.

## 2. Layout

```
┌─────────────────────────────────────┐
│ ×                                    │
│                                      │
│ Grown-up zone                        │
│ Quick check — please solve to        │
│ continue.                            │
│                                      │
│ ┌────────────────────────────────┐ │
│ │                                  │ │
│ │       9 × 14 = ?                │ │
│ │                                  │ │
│ │   [1][2][3][4][5]                │ │
│ │   [6][7][8][9][0]                │ │
│ │                                  │ │
│ │   Entered: 1 2 6                 │ │
│ └────────────────────────────────┘ │
│                                      │
│ [Check (hero)]                       │
│ [Cancel (ghost)]                     │
└─────────────────────────────────────┘
```

## 3. Visual style

- Close × top-left (modal)
- Title + sub explaining the gate
- Big brand-tone Card with the math problem (display sized) + 10-key keypad (5 columns × 2 rows)
- Keypad keys: child touch target 80dp, paper fill, neutral border, big number centered
- Entered display: caption muted
- Primary hero "Check" + ghost "Cancel"

## 4. Exact copy

- Title: **"Grown-up zone"**
- Sub: **"Quick check — please solve to continue."**
- Problem (variable): **"{a} × {b} = ?"** (e.g., 9 × 14)
- Entered label: **"Entered: {value}"** or **"Entered: —"** when empty
- CTAs: **"Check"** (hero) · **"Cancel"** (ghost)
- On wrong: **"Not quite. Try again — only grown-ups can pass this."**

## 5. Claude Design prompt

```prompt
Design the Parent Gate screen for Hangul Route. Output: 1170 × 2532 PNG
showing the IDLE state (problem visible, "Entered: 1 2 6" partially
typed, before tapping Check).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Close × top-left, 84sp tap target, #2A1F14
3. 48px gap
4. Title "Grown-up zone" — 84sp weight 700 #2A1F14
5. 12px gap
6. Sub "Quick check — please solve to continue." — 54sp #5C4A36
7. 72px gap

8. Brand Card (Card brand lg — fill #FAD9C6, 48px padding):
   - Centered problem: "9 × 14 = ?" — 108sp display weight 700 #2A1F14
   - 48px gap
   - Keypad grid: 5 columns × 2 rows (10 keys: 1 2 3 4 5 6 7 8 9 0)
     - Each key: 240 × 240 sp (80dp at 3x), fill #FFFFFF, 3px border
       #E8DFCD, 48px radius (lg)
     - Inside: bold number 84sp weight 700 #2A1F14, centered
     - 24px gutter horizontal and vertical
   - 36px gap
   - Centered caption "Entered: 1 2 6" — 42sp #8A7860 (use "—" if
     empty)

9. 48px gap

10. Primary CTA "Check" — full-width hero 288sp tall pill #E8743B
    fill, label white 66sp weight 600. (Disabled if "Entered: —".)
11. 24px gap
12. Ghost CTA "Cancel" — full-width md 240sp tall, 6px border #E8743B,
    transparent fill, label #E8743B 60sp weight 600

13. 72px bottom safe-area

VARIANT (after wrong tap):
- Below the brand card, before CTAs:
  Caption (center-aligned) "Not quite. Try again — only grown-ups can
  pass this." — 42sp #8A7860 italic

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Math problem with single-digit operands (must be 2-digit to filter
  out advanced kids — keep it ≥ 7 × 11 typically)
- Keypad keys smaller than 64dp (must be at least 80dp child target)
- "Cancel" in destructive red (it's just go-back, ghost is right)
- Wrong-state turning the brand card red

Deliverable: 1170 × 2532 PNG.
```

## 6. Acceptance checklist

- [ ] 2-digit × 1-digit math (or 2 × 2) — challenging enough for kids
- [ ] Keypad keys ≥ 80dp child target
- [ ] Entered display caption muted
- [ ] Wrong state shows hint at the bottom (amber tone)
- [ ] Cancel ghost (not destructive)

## 7. Output path

- `design/screens/parent/gate__v1__YYYY-MM-DD.png`
