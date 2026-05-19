# Screen 17 — Homework

**The parent/teacher channel.** What's due today, what's done.

## 1. Context

Tab "Homework." Shows assigned quests (by parent / teacher / system) split into "Today" and "Recently done." Empty state shows Hoya suggesting a daily review.

## 2. Layout

```
┌─────────────────────────────────────┐
│ Homework                             │
│ Set by your grown-up — or Hoya if    │
│ you have a streak.                   │
│                                      │
│ 🐯 You have 2 things to do today.    │
│                                      │
│ Today                                │
│ ┌────────────────────────────────┐ │
│ │ Meet g, n, d, l       [parent]  │ │
│ │ Due today                        │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ Build "가"           [system]   │ │
│ │ Due today                        │ │
│ └────────────────────────────────┘ │
│                                      │
│ Recently done                        │
│ ┌────────────────────────────────┐ │
│ │ Tiger, Magpie, Moon ✓ (success) │ │
│ └────────────────────────────────┘ │
│                                      │
│ [tab bar — Homework active]          │
└─────────────────────────────────────┘
```

## 3. Visual style

- Title + sub
- HoyaBubble idle (count-aware message — pluralization handled in copy)
- "Today" section: paper cards with quest title + assigned-by pill (parent/teacher/system) + due caption
- "Recently done" section: success-tinted small cards
- Empty state variant: brand card with Hoya cheering + "All clear" copy

## 4. Exact copy

- Title: **"Homework"**
- Sub: **"Set by your grown-up — or Hoya if you have a streak."**
- Hoya (count > 0): **"You have {n} thing(s) to do today."**
- Hoya (count = 0): **"No homework today! Want to do a quick review?"**
- Section: **"Today"** · **"Recently done"**
- Empty state: **"All clear!"** + **"Hoya suggests a 3-minute review."**

## 5. Claude Design prompt

```prompt
Design the Homework screen for Hangul Route. Output: TWO 1170 × 2532
PNGs side-by-side — one showing the "DUE" state (2 items), one showing
the "EMPTY" state (0 items, Hoya cheering).

Layout (both, top to bottom, 48px horizontal padding):

1. 60px status bar
2. Title "Homework" — 84sp weight 700 #2A1F14
3. 12px gap
4. Sub "Set by your grown-up — or Hoya if you have a streak." — 54sp
   #5C4A36
5. 48px gap

DUE VARIANT (left):

6. HoyaBubble idle: fill #FFFFFF, 6px border #E8DFCD, 72px radius,
   48px padding, 216sp Hoya IDLE + "You have 2 things to do today." —
   60sp weight 600

7. 48px gap

8. Section "Today" — 66sp weight 700 #2A1F14
9. 24px gap

10. Two Cards stacked (Card paper md, 24px gutter):
    Card 1:
    - Row: "Meet g, n, d, l" 60sp weight 600 #2A1F14 (left) + pill
      "parent" sm nudge tone (right)
    - 12px gap
    - "Due today" — 42sp #8A7860

    Card 2:
    - "Build 가" 60sp weight 600 + pill "system" sm nudge tone
    - "Due today" 42sp #8A7860

11. 48px gap

12. Section "Recently done" — 66sp weight 700 #2A1F14
13. 24px gap

14. Done Card (Card success sm — fill #D6EFDF, 36px padding):
    - "Tiger, Magpie, Moon ✓" — 48sp #2A1F14

15. Flex space + 96px bottom inset + tab bar

EMPTY VARIANT (right):

6. HoyaBubble idle: 216sp Hoya IDLE + "No homework today! Want to do a
   quick review?" — 60sp weight 600

7. 48px gap

8. Section "Today" — 66sp weight 700 #2A1F14
9. 24px gap

10. Empty-state Card (Card brand md — fill #FAD9C6, 48px padding):
    - Row: Left 168 × 168 sp Hoya CHEERING + Right stack:
      • "All clear!" — 60sp weight 600 #2A1F14
      • "Hoya suggests a 3-minute review." — 42sp #5C4A36 italic

11. 48px gap

12. Section "Recently done" — 66sp weight 700 #2A1F14
13. 24px gap
14. Caption "Nothing yet — finish today's to see them here." — 42sp
    #8A7860

15. Flex space + tab bar

Background (both): warm hanji cream #FCF8F1.
Tab bar at bottom: Homework tab active in #E8743B (4th tab).

Anti-patterns:
- "Due today" pill in red (use nudge tone amber)
- Empty state with sad Hoya
- Done section in primary color (success tint only)

Deliverable: 2340 × 2532 PNG (two screens side-by-side, 60px gutter,
labels "DUE" and "EMPTY").
```

## 6. Acceptance checklist

- [ ] HoyaBubble copy pluralizes correctly
- [ ] Empty state uses cheering Hoya + brand tone
- [ ] Assigned-by pills (parent/teacher/system) in nudge tone
- [ ] Recently done in success-light
- [ ] Tab bar Homework active

## 7. Output path

- `design/screens/homework/due__v1__YYYY-MM-DD.png`
- `design/screens/homework/empty__v1__YYYY-MM-DD.png`
