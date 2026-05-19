# Screen 11 — Minigame · Card Match

**Discovery family ⑩.** Match Korean words to English meanings.

## 1. Context

Two columns: Korean words (left) and English meanings (right, shuffled). Tap Korean → tap matching English. Hoya guides between taps.

## 2. Layout

```
┌─────────────────────────────────────┐
│ ▓▓░░     [2 / 4]                     │
│                                      │
│ Match the meaning                    │
│ Tap a Korean word, then its meaning. │
│                                      │
│ ┌────────────┐  ┌────────────┐      │
│ │ 김치       │  │ Rice       │      │
│ │ gimchi    │  │            │      │
│ └────────────┘  └────────────┘      │
│ ┌────────────┐  ┌────────────┐      │
│ │ 밥         │  │ Chopsticks │      │
│ │ bap       │  │            │      │
│ └────────────┘  └────────────┘      │
│ ┌────────────┐  ┌────────────┐      │
│ │ 김밥       │  │ Kimchi     │      │
│ │ gimbap    │  │            │      │
│ └────────────┘  └────────────┘      │
│ ┌────────────┐  ┌────────────┐      │
│ │ 젓가락     │  │ Kimbap     │      │
│ │ jeotgarak │  │            │      │
│ └────────────┘  └────────────┘      │
│                                      │
│ 🐯 Now tap its meaning on the right. │
│ [Skip]                               │
└─────────────────────────────────────┘
```

## 3. Visual style

- 2-column layout, equal flex
- Each card: paper md, rounded lg
- Korean cell: large Korean word + small romanization below
- English cell: English meaning, plain
- States: idle / selected (Korean) / matched (both green tint) / wrong-flash (both amber for 600ms)

## 4. Exact copy

- Title: **"Match the meaning"**
- Sub: **"Tap a Korean word, then its meaning."**
- Hoya prompt (when Korean selected): **"Now tap its meaning on the right."**
- Skip: **"Skip"**

## 5. Claude Design prompt

```prompt
Design the Card Match minigame screen for Hangul Route. Output: 1170 ×
2532 PNG. Show the IN-PROGRESS state where the user has tapped "김치" on
the left and is about to tap a meaning on the right.

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Progress bar primary + pill "2 / 4" sm neutral (showing 2 of 4 pairs
   matched)
3. 48px gap
4. Title "Match the meaning" — 66sp weight 700 #2A1F14
5. 12px gap
6. Sub "Tap a Korean word, then its meaning." — 42sp #8A7860

7. 72px gap

8. Two-column matching area, equal flex with 36px gutter:
   - LEFT column (4 Korean cells, 24px gutter between):
     1. "김치" / "gimchi" — SELECTED state: fill #FAD9C6 (brand light),
        6px border #E8743B (primary), Korean 60sp weight 700 #2A1F14,
        rom 42sp italic #5C4A36 below
     2. "밥" / "bap" — MATCHED state: fill #D6EFDF (success light),
        6px border #4FA871 (success), opacity 0.5
     3. "김밥" / "gimbap" — IDLE state: fill #FFFFFF, 6px border
        #E8DFCD
     4. "젓가락" / "jeotgarak" — IDLE
   - RIGHT column (4 English cells, 24px gutter, shuffled order):
     1. "Rice" — MATCHED with row 2 left, success state, 0.5 opacity
     2. "Chopsticks" — IDLE
     3. "Kimchi" — IDLE (this is the target the user should tap next)
     4. "Kimbap" — IDLE

   Each cell: 36px padding, 48px radius (lg), 60sp weight 600 #2A1F14
   English text.

9. 48px gap

10. HoyaBubble idle: fill #FFFFFF, 6px border #E8DFCD, 72px radius,
    48px padding:
    - Left: 216sp Hoya IDLE
    - Right: "Now tap its meaning on the right." — 60sp weight 600

11. Flex space
12. Ghost Skip CTA full-width md
13. 72px bottom safe-area

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Wrong-flash state in red (must be amber #FCEED1 fill / #F2B33D border)
- Matched cells fully invisible (opacity 0 — should be 0.5 so child can
  see progress)
- Korean and English using the same font weight (Korean larger and bolder)
- 2-column gap too narrow (must be ≥ 24px)

Deliverable: 1170 × 2532 PNG.
```

## 6. Acceptance checklist

- [ ] 2-column equal-flex layout
- [ ] Korean column shows romanization below Korean
- [ ] Selected state uses brand primary border
- [ ] Matched state uses success colors at 0.5 opacity
- [ ] No red anywhere

## 7. Output path

- `design/screens/minigames/card-match__v1__YYYY-MM-DD.png`
