# Screen 12 — Minigame · Story Sequence

**Discovery family ⑪.** Put the story steps in the right order.

## 1. Context

A short cultural story (washing hands → setting table → eating → saying thanks). Shuffled steps appear; child taps them in correct order.

## 2. Layout

```
┌─────────────────────────────────────┐
│ ▓▓░░     [2 / 4]                     │
│                                      │
│ Put the story in order               │
│ Tap each step starting from first.   │
│                                      │
│ Your order:                          │
│ [1. Wash hands]  [2. Set the table]  │
│                                      │
│ Steps:                               │
│ ┌────────────────────────────────┐ │
│ │ → Eat with family                │ │
│ │   같이 먹기                       │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ → Say thanks                     │ │
│ │   잘 먹었습니다                  │ │
│ └────────────────────────────────┘ │
│                                      │
│ 🐯 Read the steps, then pick them    │
│    in the right order.               │
│ [Skip]                               │
└─────────────────────────────────────┘
```

## 3. Visual style

- "Your order" row: pills (success-light) of picked steps with order index
- "Steps" list: cards stacked vertically with arrow icon left + English label + Korean label below in brand-primary
- Used steps appear in `surface.sunken` with opacity 0.5
- Wrong flash: card briefly turns nudge-tinted

## 4. Exact copy

- Title: **"Put the story in order"**
- Sub: **"Tap each step starting from first."**
- Sub-label 1: **"Your order:"**
- Sub-label 2: **"Steps:"**
- Hoya line: **"Read the steps, then pick them in the right order."**

## 5. Claude Design prompt

```prompt
Design the Story-Sequence minigame screen for Hangul Route. Output: 1170
× 2532 PNG showing the IN-PROGRESS state where 2 of 4 steps are picked.

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Progress bar primary + pill "2 / 4" sm neutral
3. 48px gap
4. Title "Put the story in order" — 66sp weight 700 #2A1F14
5. 12px gap
6. Sub "Tap each step starting from first." — 42sp #8A7860

7. 48px gap

8. Sub-label "Your order:" — 42sp #8A7860
9. 12px gap
10. Picked steps row (horizontal, wrap if needed, 12px gutter):
    Each pill: fill #D6EFDF (success light), 6px border #4FA871
    (success), 48px radius (pill), 36px padding-x / 24px padding-y:
    - "1. Wash hands" — 48sp weight 700 #2A1F14
    - "2. Set the table" — same

11. 48px gap

12. Sub-label "Steps:" — 42sp #8A7860
13. 24px gap

14. Remaining step cards (vertical stack, 24px gutter):
    Each card: full width, 48px padding, fill #FFFFFF, 6px border
    #E8DFCD, 48px radius (lg), shadow card:
    - Left: arrow-right icon 60sp #8A7860
    - 36px gap
    - Right stack:
      • English label — 60sp weight 600 #2A1F14
      • Korean label — 48sp #E8743B brand-primary

    Two cards:
    - "Eat with family" / "같이 먹기"
    - "Say thanks" / "잘 먹었습니다"

15. 48px gap

16. HoyaBubble idle: standard layout, message "Read the steps, then
    pick them in the right order."

17. Flex space
18. Ghost Skip CTA full-width md
19. 72px bottom safe-area

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- "Your order" pills rendered as sharp rectangles (must be pills)
- Step cards without arrow indicator
- Korean label larger than English (English is primary UI)
- Wrong-flash state turning cards red

Deliverable: 1170 × 2532 PNG.
```

## 6. Acceptance checklist

- [ ] Picked-step pills use success-light tint
- [ ] Remaining steps in paper cards with arrow indicator
- [ ] Korean appears below English (smaller, brand-primary)
- [ ] Pills are actually pill-shaped
- [ ] Skip ghost button

## 7. Output path

- `design/screens/minigames/story-sequence__v1__YYYY-MM-DD.png`
