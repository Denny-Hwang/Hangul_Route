# Screen 01 — Onboarding · Welcome

**The 3 seconds that decide whether the child smiles.** Cold-launch first impression.

## 1. Context

- **When**: first launch, no profile exists yet.
- **Who**: child (5–11) holding the device, possibly with parent nearby.
- **Goal**: convey warmth + Hoya's friendliness in under 3 seconds; offer one obvious tap.
- **Success**: child taps "Let's start" without parental coaching.

## 2. Layout (iPhone portrait 390 × 844)

```
┌─────────────────────────────────────┐
│         [status bar — auto]          │
│                                      │
│                                      │
│                                      │
│          ┌──────────────┐            │
│          │              │            │
│          │  Hoya, 180px │            │
│          │  WAVING pose │            │
│          │              │            │
│          └──────────────┘            │
│                                      │
│         Hi! I'm Hoya.                │
│         (display 36sp, center)       │
│                                      │
│   Want to learn Korean letters       │
│   with me? It only takes a few       │
│   minutes a day.                     │
│   (body lg 20sp, secondary, center)  │
│                                      │
│                                      │
│   ┌────────────────────────────┐    │
│   │   Let's start              │    │
│   │   (hero button, primary)    │    │
│   └────────────────────────────┘    │
│                                      │
│   Made for kids 5–11. Built with     │
│   kids, parents, and grandparents    │
│   in mind. (caption 14sp muted)      │
│                                      │
│         [home indicator]             │
└─────────────────────────────────────┘
```

## 3. Visual style

- Background: `surface.canvas` #FCF8F1 with subtle 4% hanji fibers (use `bg-hero-welcome` texture if available)
- Hoya: waving pose, 180px tall, centered, with optional 6% ghost-tiger silhouette behind in lower-right (from `bg-hero-welcome`)
- Title `Heading level="display"` (36sp bold #2A1F14) center-aligned
- Body `Body size="lg"` (20sp #5C4A36) center-aligned, max-width 320
- CTA: `Button tone="primary" size="hero" fullWidth` (96px tall pill)
- Microcopy: `Body size="sm" tone="muted"` centered

## 4. Exact copy

- Title: **"Hi! I'm Hoya."**
- Body: **"Want to learn Korean letters with me? It only takes a few minutes a day."**
- CTA label: **"Let's start"**
- Microcopy: **"Made for kids 5–11. Built with kids, parents, and grandparents in mind."**

## 5. Reference / mood

- Studio Ghibli warm light, soft shadows
- Children's picture book first page
- Penguin Little Library cover

## 6. Claude Design prompt

```prompt
Design the Welcome screen for Hangul Route — first cold-launch screen.
Output: one 1170 × 2532 PNG (iPhone portrait at 3x DPR).

Layout (top to bottom, all elements horizontally centered):
1. Empty space (~120px from status bar)
2. Hoya the tiger in the WAVING pose, 540 × 540 (scaled from 180dp at 3x)
3. 80px gap
4. Title "Hi! I'm Hoya." — system sans, weight 700, 108sp (36sp at 3x),
   color #2A1F14
5. 36px gap
6. Body "Want to learn Korean letters with me? It only takes a few
   minutes a day." — system sans, weight 400, 60sp (20sp at 3x),
   color #5C4A36, max-width 960px, center-aligned, line-height 1.35
7. Flex-grow space
8. Primary CTA button: full-width (minus 48px left/right margin), 288px
   tall (96sp child-hero at 3x), pill shape (radius 999px), fill
   #E8743B, label "Let's start" white 66sp weight 600
9. 24px gap
10. Microcopy "Made for kids 5–11. Built with kids, parents, and
    grandparents in mind." — 42sp (14sp at 3x) weight 500, #8A7860,
    center-aligned, max-width 840px
11. 72px bottom safe-area inset

Background:
- Base: warm hanji cream #FCF8F1
- Subtle 4% paper fiber texture across the full canvas
- Optional 6% Hoya silhouette in lower-right (decorative ghost — same
  pose orientation as the foreground waving Hoya, mirrored)

Hoya specification: use the v1 character sheet, WAVING pose. Right paw
raised in a wave gesture, warm soft smile, cheek blush visible. Bigger
than other contexts because this is the hero. Soft radial shadow under
feet at 12% opacity.

Status bar: dark icons on cream background (iOS style, 9:41 time, full
battery).

Anti-patterns:
- White cold background
- More than one CTA (only "Let's start")
- Subtext mentioning age range with shouty type
- Hoya frowning, looking serious, or sleeping
- Korean letters anywhere on this screen (UI = English only at first launch)
- Animated or decorative scrolling text (this is static)

Deliverable: 1170 × 2532 PNG ready as Welcome screen reference.
```

## 7. Acceptance checklist

- [ ] Hoya is in WAVING pose (not idle, not cheering)
- [ ] Single CTA "Let's start"
- [ ] Background uses hanji cream + 4% texture
- [ ] No Korean text anywhere on this screen
- [ ] Title size = display 36sp; body = lg 20sp
- [ ] CTA height = hero 96dp
- [ ] Microcopy at caption 14sp, tone muted
- [ ] No accent colors other than `brand.primary` on CTA

## 8. Output path

- `design/screens/onboarding/welcome__v1__YYYY-MM-DD.png`
