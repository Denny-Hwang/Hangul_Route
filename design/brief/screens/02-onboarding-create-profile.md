# Screen 02 — Onboarding · Create Profile

**The first decision the child makes.** Name + age + Hoya color.

## 1. Context

- **When**: after Welcome, before any learning starts.
- **Who**: child usually with parent (parent reads the prompts; child picks).
- **Goal**: collect minimum needed identity (name, age band, avatar) with maximum joy.
- **Success**: child sees their chosen Hoya on the next screen and feels ownership.

## 2. Layout (scrollable)

```
┌─────────────────────────────────────┐
│ Who's playing?              (title) │
│ A grown-up can help with this.      │
│                                      │
│ Your name                            │
│ ┌─────────────────────────────────┐ │
│ │  Type your name                 │ │
│ └─────────────────────────────────┘ │
│                                      │
│ How old are you?                     │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │  5–7   │ │  8–9   │ │ 10–11  │    │
│ │ Big    │ │ Some   │ │ Stories│    │
│ │ tiles  │ │ reading│ │ + chat │    │
│ └────────┘ └────────┘ └────────┘    │
│                                      │
│ Pick a Hoya                          │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐            │
│ │🐯│ │🐯│ │🐯│ │🐯│ │🐯│            │
│ │or│ │bl│ │gn│ │pu│ │pk│            │
│ └──┘ └──┘ └──┘ └──┘ └──┘            │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ 🐯 Ready to go!                 │ │
│ │    Your name stays on this dev. │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │     Continue (hero)              │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 3. Visual style

- Background `surface.canvas`, scrollable
- Form field: rounded rect (radii.lg), 2px `border.subtle`, paper fill, 18sp input text, child-height 80
- Age tiles: 3-column row, square-ish (~31% width each), 80px+ tall, `surface.paper` default / `brand.primaryLight` when selected with 2px `brand.primary` border
- Avatar picker: 5 Hoyas in different palette tints, 80px tap targets, selected ring in brand-primary

## 4. Exact copy

- Title: **"Who's playing?"**
- Hint: **"A grown-up can help with this."**
- Field label: **"Your name"** · placeholder **"Type your name"**
- Section label: **"How old are you?"**
- Age groups:
  - 5–7 — "Big tiles, lots of pictures"
  - 8–9 — "Some reading and sentences"
  - 10–11 — "Stories and conversations"
- Section label: **"Pick a Hoya"**
- Summary card title: **"Ready to go!"** with subtitle "Your name and choices stay on this device."
- CTA: **"Continue"**

## 5. Claude Design prompt

```prompt
Design the Create-Profile onboarding screen for Hangul Route. Output:
one 1170 × 3200 PNG (iPhone portrait, scrollable extended height).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar area
2. Title "Who's playing?" — 84sp bold #2A1F14, left-aligned
3. 12px gap
4. Subtitle "A grown-up can help with this." — 54sp regular #5C4A36
5. 72px gap

6. Field label "Your name" — 54sp weight 600 #2A1F14
7. 12px gap
8. Text input box: width = full (minus padding), height 240sp (80sp at
   3x), rounded rect 48px radius (radii.lg), 6px border #E8DFCD, fill
   #FFFFFF, placeholder "Type your name" at 60sp #8A7860, left padding
   48px

9. 72px gap

10. Section "How old are you?" — 54sp weight 600 #2A1F14
11. 24px gap
12. Three age tiles in a row with 24px gutters:
    - Tile dimensions: 31% width × 240sp tall (80sp at 3x)
    - Default state: fill #FFFFFF, 6px border #E8DFCD, radius 48px
    - Selected state (shown the first "5-7" tile as selected): fill
      #FAD9C6, 6px border #E8743B
    - Each tile content (centered): age range in 84sp bold #2A1F14 +
      tiny 42sp muted description below (#8A7860)
    - Three tiles:
      • "5–7" / "Big tiles, lots of pictures"
      • "8–9" / "Some reading and sentences"
      • "10–11" / "Stories and conversations"

13. 72px gap

14. Section "Pick a Hoya" — 54sp weight 600 #2A1F14
15. 24px gap
16. Avatar picker — 5 Hoya thumbnails in a horizontal row:
    - Each 240 × 240 sp (80 at 3x), fill #FFFFFF, 6px border #E8DFCD,
      radius 48px, padding 12px
    - First avatar (orange) is selected: 6px border #E8743B, fill #FAD9C6
    - Each shows a small Hoya idle pose tinted with a different color
      family — but for v1 sheet, all 5 can be the same orange Hoya idle.

17. 96px gap

18. Brand summary card — Card component, padding md, tone "brand"
    (#FAD9C6 fill), no border. Inner row:
    - Left: small Hoya cheering pose, 168 × 168 sp
    - Right: "Ready to go!" 54sp bold #2A1F14 + "Your name and choices
      stay on this device." 42sp muted #8A7860 below

19. 48px gap

20. Primary CTA button: full-width (minus padding), 288sp tall (96sp at
    3x), pill radius 999px, fill #E8743B (disabled until name entered),
    label "Continue" white 66sp weight 600

21. 96px bottom safe-area inset

Background: warm hanji cream #FCF8F1, subtle 4% fiber texture.

Anti-patterns:
- Validation errors shown in red (use amber #F2B33D if needed, or
  disable Continue button)
- Form fields without labels
- Age tiles smaller than 64dp (child fingers!)
- Avatar picker with sharp corners
- Subtle borders that disappear on cream background (use ≥2px @ 1x)

Deliverable: 1170 × 3200 PNG (long-scroll), with first age tile and
first Hoya avatar shown as the selected state.
```

## 6. Acceptance checklist

- [ ] Name input is min 80dp tall
- [ ] All 3 age tiles ≥ 80dp tall, equal width
- [ ] 5 Hoya avatars ≥ 80dp tap targets
- [ ] Selected states use `brand.primary` accents only
- [ ] No red on validation errors
- [ ] CTA disabled state respects opacity 0.6
- [ ] Brand summary card uses `brand` tone (warm orange tint)

## 7. Output path

- `design/screens/onboarding/create-profile__v1__YYYY-MM-DD.png`
