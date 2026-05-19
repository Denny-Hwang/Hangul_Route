# Screen 06 — Episode Detail

**The lobby.** Pick a quest from this episode + see the cards you can earn.

## 1. Context

- **When**: tapping a Stage 1 cell from Journey.
- **Goal**: show episode intro from Hoya, list quests with star status, preview reward cards.
- **Success**: child taps "Start" on the next quest.

## 2. Layout

```
┌─────────────────────────────────────┐
│ ← (back)                             │
│ [Hangul] [Letters]                   │
│ Meet the Letters     (display)       │
│ The first 14 consonants come alive.  │
│                                      │
│ 🐯 Hi! I am Hoya. Want to meet my   │
│    favorite Korean letters?          │
│    (HoyaBubble idle)                 │
│                                      │
│ Quests                               │
│ ┌────────────────────────────────┐ │
│ │ ① Meet g, n, d, l        ⭐⭐⭐  │ │
│ │   Your first four Korean cons.. │ │
│ │   [Play again]                   │ │
│ └────────────────────────────────┘ │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ ② Meet m, b, s, ng       ⭐⭐    │ │
│ │   Four more consonants, ...     │ │
│ │   [Play again]                   │ │
│ └────────────────────────────────┘ │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ ③ Meet the Vowels        ☆☆☆   │ │
│ │   ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ — sing!     │ │
│ │   [Start]                        │ │
│ └────────────────────────────────┘ │
│                                      │
│ Cards in this episode                │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│ │ Book│ │Hanji│ │Brush│ │ Ink │ │Origami│
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ │
└─────────────────────────────────────┘
```

## 3. Visual style

- Back icon top-left, no header bar (clean)
- Stage + Theme pills row
- Title in stage color (`stage1` orange)
- HoyaBubble idle with episode's `hoyaIntroEn`
- Quest cards: paper md, number badge + title + sub + star row + CTA (Play again if completed, Start if new)
- Reward card grid: 2-column wrap, mini cards with name + Korean + rarity pill

## 4. Exact copy (example: Stage 1 Letters)

- Pills: **"Hangul"** · **"Letters & Books"**
- Title: **"Meet the Letters"**
- Sub: **"The first 14 consonants come alive."**
- Hoya intro: **"Hi! I am Hoya. Want to meet my favorite Korean letters?"**
- Quest 1 title: **"Meet g, n, d, l"** · sub **"Your first four Korean consonants."**
- Quest 2 title: **"Meet m, b, s, ng"** · sub **"Four more consonants, four more sounds."**
- Quest 3 title: **"Meet the Vowels"** · sub **"ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ — open your mouth and sing."**
- Section: **"Cards in this episode"**

## 5. Claude Design prompt

```prompt
Design the Episode Detail screen for Hangul Route. Output: 1170 × 3400
PNG (long-scroll).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Back chevron (left arrow icon, 84sp tap target) in #2A1F14
3. 24px gap
4. Pills row: "Hangul" (primary tone) + 24px gap + "Letters & Books"
   (secondary tone), both sm size
5. 36px gap
6. Title "Meet the Letters" — 108sp weight 700, color #E8743B (stage1
   color)
7. 12px gap
8. Subtitle "The first 14 consonants come alive." — 54sp #5C4A36
9. 48px gap

10. HoyaBubble (idle tone): fill #FFFFFF, 6px border #E8DFCD, 72px
    radius, 48px padding, 216sp Hoya idle left + message "Hi! I am
    Hoya. Want to meet my favorite Korean letters?" 60sp weight 600

11. 48px gap

12. Section "Quests" — 66sp weight 700 #2A1F14
13. 24px gap

14. THREE quest cards (each Card paper md, 24px between):
    a. Quest card layout (3 cards):
       - Row 1: circular 132 × 132 badge (left, fill #D6EFDF if completed
         OR #F2EBDE if new, with bold number) + title (right, 60sp weight
         600 #2A1F14) + sub (54sp #8A7860 below title) + StarRow on the
         right showing earned stars (small 54sp size)
       - 24px gap
       - CTA button (md secondary tone if completed, primary if new):
         "Play again" or "Start" — 240sp tall, pill, fullWidth

    Quest 1 (completed, 3 stars):
      Badge: #D6EFDF / "1"
      Title: "Meet g, n, d, l"
      Sub: "Your first four Korean consonants."
      Stars: ⭐⭐⭐ (3 filled)
      CTA: "Play again" (secondary tone #4A9DD6)

    Quest 2 (completed, 2 stars):
      Badge: #D6EFDF / "2"
      Title: "Meet m, b, s, ng"
      Sub: "Four more consonants, four more sounds."
      Stars: ⭐⭐☆ (2 filled, 1 unfilled)
      CTA: "Play again" (secondary tone)

    Quest 3 (new, 0 stars):
      Badge: #F2EBDE / "3"
      Title: "Meet the Vowels"
      Sub: "ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ — open your mouth and sing."
      Stars: ☆☆☆ (all unfilled)
      CTA: "Start" (primary tone #E8743B)

15. 96px gap

16. Section "Cards in this episode" — 66sp weight 700 #2A1F14
17. 24px gap

18. Card grid: 2 columns, 24px gutter — 5 mini reward cards:
    Each mini card: ~47% width × 360sp tall, paper fill, 1px #E8DFCD
    border, 36px radius (radii.md), 48px padding inside:
    - Card title (60sp weight 600 #2A1F14)
    - Korean subtitle below (60sp weight 600 #E8743B brand-primary)
    - Pill at the bottom-left: rarity name (sm, neutral tone)

    Five reward cards (one row of 2, one row of 2, one row of 1):
    - "Book" / "책" / common
    - "Hanji Paper" / "한지" / uncommon
    - "Calligraphy Brush" / "붓" / uncommon
    - "Ink Stick" / "먹" / common
    - "Paper Folding" / "종이접기" / rare

19. 96px bottom gap (no tab bar — this is a stack screen)

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Cards in this episode shown locked (we preview, not lock here)
- Star colors not amber (must be #F2B33D)
- "Start" button in green (use primary orange)
- Episode title in primary text color (must be stage color #E8743B)
- Pills with sharp corners

Deliverable: 1170 × 3400 PNG.
```

## 6. Acceptance checklist

- [ ] Title color = stage1 #E8743B
- [ ] HoyaBubble idle tone
- [ ] Quest cards show real star state (mix completed + new)
- [ ] New quest CTA is "Start" primary, completed is "Play again" secondary
- [ ] Reward cards show Korean + rarity, no lock state
- [ ] Back chevron top-left

## 7. Output path

- `design/screens/episode/detail__v1__YYYY-MM-DD.png`
