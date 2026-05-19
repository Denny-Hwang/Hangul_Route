# Screen 14 — Results

**The reward.** Stars + Hoya cheer + card unlocked.

## 1. Context

After all 5 quest steps. Show stars earned, Hoya in matching tone, and announce any unlocked card.

## 2. Layout

```
┌─────────────────────────────────────┐
│                                      │
│         Hoya, 140px CHEERING         │
│                                      │
│         Wonderful!                   │
│         ⭐ ⭐ ⭐                     │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ 🐯 Perfect! You got every one!  │ │
│ └────────────────────────────────┘ │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ Card added to your library!     │ │
│ │ Visit Library to see all cards. │ │
│ └────────────────────────────────┘ │
│                                      │
│ [Back to journey (hero)]             │
│ [Episode page (ghost)]               │
└─────────────────────────────────────┘
```

## 3. Visual style

- Hoya 140px centered (cheering for 2+ stars, thinking for 1)
- Display title — variant by stars: "Wonderful!" / "Great!" / "You tried!"
- Big StarRow 48sp
- HoyaBubble matching tone with cheer message
- Card-unlock card (brand tone) if applicable
- Primary hero CTA + secondary ghost CTA

## 4. Exact copy (3 variants by stars)

- 3 stars title: **"Wonderful!"** · Hoya: **"Perfect! You got every one!"**
- 2 stars title: **"Great!"** · Hoya: **"Nice work! Try one more for three stars."**
- 1 star title: **"You tried!"** · Hoya: **"Good start. Want to play it again?"**
- 0 stars (rare): **"Brave try!"** · Hoya: **"Let's do it together."**
- Card-unlock card title: **"Card added to your library!"** · sub: **"Visit Library to see all your cards."**
- CTAs: **"Back to journey"** (hero primary) · **"Episode page"** (ghost)

## 5. Claude Design prompt

```prompt
Design the Results screen for Hangul Route. Output: 1170 × 2532 PNG
showing the 3-STAR PERFECT variant (most celebratory).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. 96px top gap
3. Hoya CHEERING pose 420 × 420 sp, centered (arms up, sparkles)
4. 48px gap
5. Title "Wonderful!" — 108sp weight 700 #2A1F14 center
6. 24px gap
7. StarRow: 3 amber stars (#F2B33D fill, 1.2px #B5862A stroke), 144sp
   each, 24px gutter, centered

8. 48px gap

9. HoyaBubble (cheering tone): fill #D6EFDF, 6px border #4FA871, 72px
   radius, 48px padding, 216sp Hoya CHEERING + "Perfect! You got every
   one!" — 60sp weight 600 #2A1F14

10. 36px gap

11. Card-unlock Card (Card brand md — fill #FAD9C6, 48px padding):
    - "Card added to your library!" — 60sp weight 600 #2A1F14
    - 12px gap
    - "Visit Library to see all your cards." — 42sp #5C4A36

12. Flex space

13. Hero primary CTA: full-width, 288sp tall, pill, #E8743B, label
    "Back to journey" white 66sp weight 600

14. 24px gap

15. Ghost CTA: full-width, 240sp tall, 6px border #E8743B, transparent
    fill, label "Episode page" #E8743B 60sp weight 600

16. 72px bottom safe-area

VARIANT (1 star, "You tried!"):
- Hoya pose: THINKING (not cheering)
- Title: "You tried!"
- StarRow: 1 filled + 2 unfilled
- HoyaBubble: thinking tone (#FCEED1 / #F2B33D), message "Good start.
  Want to play it again?"
- No card-unlock card (only on 2+ stars typically)

Background:
- For 3-star variant: cream + soft amber radial glow (use
  bg-celebration texture if available — soft #F2B33D glow at 12% +
  scattered amber sparkles at top 40%)
- For 1-star variant: plain hanji cream

Anti-patterns:
- Confetti spam
- "Try again" CTA in red
- StarRow showing more than 3 stars
- Hoya CHEERING for 1-star result (should be thinking — empathetic, not
  fake-cheerful)
- Multiple unlocked cards announcement (one per quest)

Deliverable: 1170 × 2532 PNG showing 3-star variant. Optional second
PNG for 1-star variant.
```

## 6. Acceptance checklist

- [ ] Hoya pose matches result (cheering for 2+, thinking for 1)
- [ ] Title varies by stars
- [ ] Stars amber, max 3
- [ ] Card-unlock card only on 2+ stars
- [ ] Hero + ghost CTA pair (not two primaries)
- [ ] Celebration background only on 3-star

## 7. Output path

- `design/screens/results/3-stars__v1__YYYY-MM-DD.png`
- `design/screens/results/1-star__v1__YYYY-MM-DD.png`
