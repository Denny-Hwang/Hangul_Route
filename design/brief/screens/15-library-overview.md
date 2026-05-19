# Screen 15 — Heritage Library

**The collection home.** 30 of 30 cards, theme-filtered, rarity-bordered.

## 1. Context

Tab "Library." Shows all 30 Stage 1 cards. Unlocked = full art, locked = lock icon + dimmed. Filter by theme.

## 2. Layout

```
┌─────────────────────────────────────┐
│ Heritage Library  (14/30)    [14/30] │
│ 14 of 30 collected.                  │
│                                      │
│ [All] [Letters] [Life] [Rites] [Nat]…│
│                                      │
│ ┌──────────┐ ┌──────────┐           │
│ │ rare     │ │ legendary│           │
│ │   책     │ │   호랑이 │           │
│ │  chaek  │ │  horangi│           │
│ │ Book    │ │ Tiger   │           │
│ └──────────┘ └──────────┘           │
│ ┌──────────┐ ┌──────────┐           │
│ │ 🔒       │ │ common  │           │
│ │ Locked  │ │   밥    │           │
│ │         │ │  bap    │           │
│ └──────────┘ └──────────┘           │
│ ... (scroll)                         │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ How to collect more              │ │
│ │ Finish quests to unlock cards.   │ │
│ └────────────────────────────────┘ │
│ [tab bar — Library active]           │
└─────────────────────────────────────┘
```

## 3. Visual style

- Header: title + collected pill on right (e.g. "14/30")
- Theme filter chips row: All + 5 themes. Active chip = brand-primary fill, white text
- Card grid: 2-column wrap. Each card: paper md, 2px rarity color border (or sunken/subtle border if locked)
- Unlocked card: rarity pill top + Korean (large) + romanization + English title
- Locked card: lock icon + "Locked" caption, sunken fill
- Helper card at bottom (brand tone): how to collect more

## 4. Exact copy

- Title: **"Heritage Library"**
- Caption: **"{n} of {total} collected"**
- Chips: **"All"** · **"Letters"** · **"Life"** · **"Rites"** · **"Nature"** · **"Crafts"**
- Locked label: **"Locked"**
- Helper card title: **"How to collect more"**
- Helper body: **"Finish quests to unlock cards. Legendary cards appear when you complete a whole stage."**

## 5. Claude Design prompt

```prompt
Design the Heritage Library screen for Hangul Route. Output: 1170 × 3600
PNG (long-scroll).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Header row: Left stack (Title "Heritage Library" 84sp bold #2A1F14 +
   caption "14 of 30 collected" 42sp #8A7860) + Right pill "14/30"
   (primary tone, sm)
3. 36px gap

4. Theme filter chips row (horizontal, 12px gutters, wrap if needed):
   - "All" — ACTIVE state: pill fill #E8743B, label white 60sp weight 600
   - "Letters" — INACTIVE: fill #FFFFFF, 3px border #E8DFCD, label
     #2A1F14 60sp weight 600
   - "Life" — INACTIVE
   - "Rites" — INACTIVE
   - "Nature" — INACTIVE
   - "Crafts" — INACTIVE

5. 48px gap

6. Card grid (2 columns, 24px gutter, wrap):
   Each card thumb: ~47% width × 420sp tall, 6px border in rarity color,
   48px radius (lg), 48px padding inside.

   Unlocked card content:
   - Top: rarity pill (sm size) — top-right
   - 24px gap
   - Korean glyph(s) — 84sp weight 700 #2A1F14
   - 6px gap below: romanization — 42sp italic #8A7860
   - English title — 48sp #5C4A36

   Locked card content:
   - Centered lock icon 96 × 96 sp #8A7860
   - 12px gap below: "Locked" — 42sp #8A7860

   Show 8 cards in 4 rows of 2:
   Row 1: [Book uncommon (unlocked) "책 chaek Book"] [Tiger legendary
   (unlocked) "호랑이 horangi Tiger"]
   Row 2: [LOCKED] [Rice common (unlocked) "밥 bap Rice"]
   Row 3: [Kimchi common (unlocked) "김치 gimchi Kimchi"] [LOCKED]
   Row 4: [Magpie uncommon (unlocked) "까치 kkachi Magpie"] [LOCKED]

   Rarity border colors:
   - common #8A7860
   - uncommon #7BB552
   - rare #4A9DD6
   - legendary #E8743B

7. 96px gap

8. Helper Card (Card brand md — fill #FAD9C6, 48px padding):
   - "How to collect more" — 66sp weight 700 #2A1F14
   - 12px gap
   - "Finish quests to unlock cards. Legendary cards appear when you
     complete a whole stage." — 42sp #5C4A36

9. 96px gap + tab bar (Library tab active in #E8743B)

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Locked cards looking interactable (must dim with sunken fill)
- Chip active state in any color other than brand-primary
- Cards without rarity border distinction
- Korean glyph smaller than English title
- More than 6 chips visible (overflow scroll instead)

Deliverable: 1170 × 3600 PNG showing the Library with 4 rows × 2 cards.
```

## 6. Acceptance checklist

- [ ] Chips row scrollable if overflow
- [ ] Active chip primary, others ghost
- [ ] Rarity borders 4 distinct colors
- [ ] Locked cards in sunken style
- [ ] Korean glyph dominant on unlocked cards
- [ ] Helper card uses brand tone

## 7. Output path

- `design/screens/library/overview__v1__YYYY-MM-DD.png`
