# Screen 04 — Main · Home / Today

**The morning landing.** "Hi, you have a streak. Here's today's quest."

## 1. Context

- **When**: every regular app launch after onboarding.
- **Goal**: surface today's most valuable action (next quest) + streak/cards/stars summary.
- **Success**: child taps "Start quest" within 5 seconds of opening the app.

## 2. Layout

```
┌─────────────────────────────────────┐
│ 🐯 Hi, Mina!         (waving)        │
│    Ready for today's quest?          │
│                                      │
│ [Streak 5 days] [14 cards] [3★ quests]│
│                                      │
│ Today's quest                        │
│ ┌────────────────────────────────┐ │
│ │ Meet g, n, d, l                 │ │
│ │ Your first four Korean cons...  │ │
│ │ From Meet the Letters · 4 min   │ │
│ │                                  │ │
│ │  [Start quest]                   │ │
│ └────────────────────────────────┘ │
│                                      │
│ Stage 1 progress                     │
│ ▓▓▓▓▓▓░░░░░░░░░░ 3 of 9 quests      │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ 🐯 Tip — finish today's quest   │ │
│ │   to keep your streak alive!    │ │
│ └────────────────────────────────┘ │
│                                      │
│ Recent stars                         │
│ ⭐⭐⭐                                 │
│                                      │
│ [tab bar: Today · Journey · Library · │
│  Homework · Me]                       │
└─────────────────────────────────────┘
```

## 3. Visual style

- Header row: Hoya 72px waving + greeting + question
- Pills row: 3 horizontal pills (primary/secondary/success tones)
- "Today's quest" Card: paper tone, md padding, quest title prompt, meta caption muted, CTA lg primary fullWidth
- Progress bar: primary tone, label below
- HoyaBubble (tip): idle tone
- "Recent stars" sunken card with StarRow

## 4. Exact copy

- Greeting: **"Hi, {displayName}!"** (placeholder: "Mina")
- Sub: **"Ready for today's quest?"**
- Pills: `Streak 5 days` · `14 cards` · `3★ quests`
- Section: **"Today's quest"**
- Quest title (example): **"Meet g, n, d, l"** · sub **"Your first four Korean consonants."**
- Meta: **"From Meet the Letters · 4 min"**
- CTA: **"Start quest"**
- Section: **"Stage 1 progress"** · label **"3 of 9 quests"**
- Hoya tip: **"Tip — finish today's quest to keep your streak alive!"**
- Section: **"Recent stars"**

## 5. Claude Design prompt

```prompt
Design the Home/Today screen for Hangul Route. Output: 1170 × 2532 PNG.

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Header row: Hoya WAVING pose 216 × 216 sp (left) + text stack (right):
   - "Hi, Mina!" — 84sp bold #2A1F14
   - "Ready for today's quest?" — 54sp #5C4A36
3. 48px gap
4. Three pills in a row (8px gutters):
   - "Streak 5 days" — primary tone (fill #FAD9C6, label #B5562A) — 16sp
     weight 600 — 12px-padX 4px-padY pill
   - "14 cards" — secondary tone (#CDE5F4 / #2E72A3)
   - "3★ quests" — success tone (#D6EFDF / #2F6A47)
5. 48px gap
6. Section "Today's quest" — 66sp weight 700 #2A1F14
7. 24px gap
8. Quest Card (Card paper md):
   - "Meet g, n, d, l" — 60sp weight 700 #2A1F14
   - 6px gap
   - "Your first four Korean consonants." — 54sp #5C4A36
   - 24px gap
   - "From Meet the Letters · 4 min" — 42sp #8A7860
   - 48px gap
   - Primary CTA button (lg fullWidth, 240sp tall, pill, #E8743B, label
     "Start quest" white 60sp weight 600)
9. 72px gap
10. Section "Stage 1 progress" — 66sp weight 700 #2A1F14
11. 24px gap
12. Progress bar (primary tone, 36sp tall, pill radius):
    - Track: #F2EBDE
    - Bar fill: #E8743B at 33% width
    - Right-aligned label below: "3 of 9 quests" — 42sp #8A7860
13. 72px gap

14. HoyaBubble (tone: idle):
    - Container: 72px radius, 6px #E8DFCD border, #FFFFFF fill, 48px
      padding, soft card shadow
    - Left: 216sp Hoya IDLE
    - Right: "Tip — finish today's quest to keep your streak alive!" —
      60sp weight 600 #2A1F14
15. 48px gap

16. Section "Recent stars" Card (sunken tone, fill #F2EBDE, md padding):
    - "Recent stars" — 66sp weight 700 #2A1F14
    - 24px gap
    - StarRow: 3 amber stars (#F2B33D fill, 1.2px #B5862A stroke) at
      84sp each, 24px gutters, left-aligned

17. Flex-grow space

18. Bottom tab bar (252sp tall, paper fill, 1px top border #E8DFCD):
    - 5 tabs, all 72sp icon + 42sp label below
    - 1st tab "Today" — ACTIVE state: home icon #E8743B, label #E8743B
      weight 600
    - 2nd "Journey" — inactive: icon #8A7860, label #8A7860
    - 3rd "Library" — inactive
    - 4th "Homework" — inactive
    - 5th "Me" — inactive
    - Tab spacing: equal flex distribution
    - Bottom safe-area inset: 72sp

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- More than 1 CTA (only "Start quest")
- Streak shown as "0 days" — fill in a non-zero example
- Bar fill in red
- StarRow with > 3 stars
- Tab bar with icons larger than labels

Deliverable: 1170 × 2532 PNG Home/Today reference.
```

## 6. Acceptance checklist

- [ ] Hoya waving in header
- [ ] Single primary CTA "Start quest"
- [ ] 3 summary pills (streak / cards / stars)
- [ ] Progress bar uses primary tone
- [ ] HoyaBubble in idle tone (not cheering)
- [ ] StarRow max 3, amber
- [ ] Tab bar "Today" tab active in primary color

## 7. Output path

- `design/screens/home/today__v1__YYYY-MM-DD.png`
