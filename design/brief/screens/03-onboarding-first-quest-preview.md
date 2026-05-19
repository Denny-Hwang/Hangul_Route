# Screen 03 — Onboarding · First Quest Preview

**The first promise.** Show the child what they'll get from their first quest.

## 1. Context

- **When**: after profile creation, before entering the Main app.
- **Goal**: build anticipation by previewing Episode 1 (Meet the Letters) and the cards waiting.
- **Success**: child taps "Start my journey" eagerly.

## 2. Layout

```
┌─────────────────────────────────────┐
│       (hero spacing, 32 top)         │
│      ┌─────────────┐                 │
│      │ Hoya, 120px │                 │
│      │ CHEERING    │                 │
│      └─────────────┘                 │
│                                      │
│  Your first card is waiting.         │
│  (title 28sp center)                 │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ 🐯 In your first quest you'll   │ │
│  │   meet four Korean letters       │ │
│  │   and earn a Heritage card.     │ │
│  │   (HoyaBubble — idle)            │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ Episode 1 · Meet the Letters   │ │
│  │ 3 quests · about 12 min · 5     │ │
│  │ cards waiting                    │ │
│  │                                  │ │
│  │ You'll learn                     │ │
│  │ ㄱ ㄴ ㄷ ㄹ → g, n, d, l         │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Start my journey (hero)        │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 3. Visual style

- Background `surface.canvas`, scrollable
- Hoya in `cheering` pose, 120px, centered top
- Title centered, `display` 36sp
- HoyaBubble `tone="idle"` with `idle` Hoya thumbnail
- Episode info card: `paper` tone, md padding — title `prompt` 22sp, meta `caption` muted, then "You'll learn" label + Korean letters in `prompt` 22sp `brand.primary` followed by their romanizations
- CTA hero, primary

## 4. Exact copy

- Title: **"Your first card is waiting."**
- HoyaBubble: **"In your first quest you'll meet four Korean letters and earn a Heritage card."**
- Card title: **"Episode 1 · Meet the Letters"**
- Card meta: **"3 quests · about 12 minutes total · 5 cards waiting"**
- "You'll learn" section
- Korean: **"ㄱ ㄴ ㄷ ㄹ"** with rom **"→ g, n, d, l"**
- CTA: **"Start my journey"**

## 5. Claude Design prompt

```prompt
Design the First-Quest-Preview onboarding screen for Hangul Route.
Output: 1170 × 2532 PNG.

Layout (top to bottom, 48px horizontal padding):
1. 96px status bar area
2. 96px gap
3. Hoya in CHEERING pose, 360 × 360 sp, centered
4. 36px gap
5. Title "Your first card is waiting." — 84sp bold #2A1F14, center
6. 72px gap

7. HoyaBubble (tone: idle):
   - Container: rounded rect 72px radius, 6px border #E8DFCD, fill
     #FFFFFF, padding 48px, soft warm-dark card shadow
   - Left: 216 × 216 sp Hoya in IDLE pose
   - Right stack: 60sp weight 600 #2A1F14 message:
     "In your first quest you'll meet four Korean letters and earn a
     Heritage card."

8. 48px gap

9. Episode info card (Card component, tone paper, padding md):
   - Title: "Episode 1 · Meet the Letters" — 66sp bold #2A1F14
   - 12px gap
   - Meta: "3 quests · about 12 minutes total · 5 cards waiting" — 54sp
     #5C4A36
   - 48px gap
   - Label: "You'll learn" — 54sp weight 600 #2A1F14
   - 6px gap
   - Korean letters row: "ㄱ ㄴ ㄷ ㄹ" — 84sp weight 700 #E8743B (the
     letters themselves prominent)
   - Below in 48sp italic muted #5C4A36: "→ g, n, d, l"

10. Flex-grow gap

11. Primary CTA button: full-width, 288sp tall, pill radius 999px, fill
    #E8743B, label "Start my journey" white 66sp weight 600

12. 96px bottom safe-area inset

Background: warm hanji cream #FCF8F1, subtle 4% fiber texture.

Anti-patterns:
- Multiple bubbles
- "Start" button before all visual rest steps
- Korean letters at smaller size than English text (they should be the
  star)
- Pure white background
- Hoya in idle or thinking pose (must be cheering — this is anticipation)

Deliverable: 1170 × 2532 PNG.
```

## 6. Acceptance checklist

- [ ] Hoya is CHEERING pose at top
- [ ] HoyaBubble uses IDLE tone (anticipation, not celebration yet)
- [ ] Korean letters visually larger than English fallback
- [ ] CTA hero size
- [ ] Episode meta uses caption tone (muted)
- [ ] No bottom tab bar (this is pre-main)

## 7. Output path

- `design/screens/onboarding/first-quest-preview__v1__YYYY-MM-DD.png`
