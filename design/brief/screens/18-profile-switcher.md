# Screen 18 — Profile Switcher (Me tab)

**The family switch.** Tap a Hoya to switch learner.

## 1. Context

Tab "Me." Lists all profiles on this device. Active profile shows "Playing now" pill. Includes stats card + add-profile CTA + grown-up zone entry.

## 2. Layout

```
┌─────────────────────────────────────┐
│ Profiles                             │
│ Tap a Hoya to switch.                │
│                                      │
│ ┌──────────┐ ┌──────────┐           │
│ │   🐯     │ │   🐯     │           │
│ │  Mina    │ │  Jun     │           │
│ │ Age 5-7  │ │ Age 8-9  │           │
│ │[Playing] │ │           │           │
│ └──────────┘ └──────────┘           │
│                                      │
│ [+ Add a profile]                    │
│                                      │
│ Mina's stats                         │
│ ┌────────────────────────────────┐ │
│ │ Quests done  Cards   Streak     │ │
│ │      9         14      5        │ │
│ └────────────────────────────────┘ │
│                                      │
│ [Grown-up zone (ghost)]              │
│                                      │
│ [tab bar — Me active]                │
└─────────────────────────────────────┘
```

## 3. Visual style

- Title + sub
- Profile grid: 2 cards per row, square-ish (47% width × 80dp+ tall)
  - Active: brand-primaryLight fill + 2px primary border + Hoya CHEERING pose + "Playing now" pill
  - Inactive: paper fill + Hoya IDLE pose + age caption
- Secondary "Add a profile" CTA (md)
- Stats Card: 3 columns (Quests done / Cards / Streak) with bold values
- Ghost "Grown-up zone" CTA

## 4. Exact copy

- Title: **"Profiles"** · sub **"Tap a Hoya to switch."**
- Profile labels: displayName + "Age {ageGroup}"
- Active pill: **"Playing now"**
- Add CTA: **"+ Add a profile"**
- Stats section title: **"{name}'s stats"**
- Stat labels: **"Quests done"** · **"Cards"** · **"Streak"**
- Parent CTA: **"Grown-up zone"**

## 5. Claude Design prompt

```prompt
Design the Profile Switcher (Me tab) screen for Hangul Route. Output:
1170 × 2532 PNG showing 2 profiles (Mina active, Jun inactive).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Title "Profiles" — 84sp weight 700 #2A1F14
3. 12px gap
4. Sub "Tap a Hoya to switch." — 54sp #5C4A36
5. 48px gap

6. Profile card row (2 cards, 36px gutter):
   Each card: ~47% width × 720sp tall, 6px border, 48px radius (lg),
   48px padding centered column:

   Card 1 — Mina (ACTIVE):
   - Fill #FAD9C6 (brand light), 6px border #E8743B
   - Hoya CHEERING pose 216 × 216 sp
   - 12px gap
   - "Mina" 60sp weight 600 #2A1F14
   - "Age 5-7" 42sp #8A7860
   - 24px gap
   - Pill "Playing now" — sm primary tone

   Card 2 — Jun (INACTIVE):
   - Fill #FFFFFF, 6px border #E8DFCD
   - Hoya IDLE pose 216 × 216 sp
   - "Jun" 60sp weight 600 #2A1F14
   - "Age 8-9" 42sp #8A7860
   - No pill

7. 48px gap

8. Secondary CTA "+ Add a profile" — md size, secondary tone (#4A9DD6
   fill white label), pill, 192sp tall, fullWidth FALSE (auto width
   left-aligned), 60sp weight 600

9. 96px gap

10. Section "Mina's stats" — 66sp weight 700 #2A1F14
11. 24px gap
12. Stats Card (Card paper md, 48px padding):
    Three columns (equal flex) each centered:
    - "9" 60sp weight 700 #2A1F14 + below "Quests done" 42sp #8A7860
    - "14" 60sp weight 700 + "Cards" 42sp #8A7860
    - "5" 60sp weight 700 + "Streak" 42sp #8A7860

13. 48px gap

14. Ghost CTA "Grown-up zone" — md size, transparent fill, 6px border
    #E8743B, label "Grown-up zone" #E8743B 60sp weight 600, autoWidth
    left-aligned

15. Flex space + tab bar (Me active in #E8743B, 5th tab)

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Active profile pill in green (must be brand-primary)
- Inactive Hoya in cheering pose (only active gets the joyful pose)
- Add-profile in primary color (it's secondary action)
- Grown-up zone in destructive red

Deliverable: 1170 × 2532 PNG.
```

## 6. Acceptance checklist

- [ ] Active profile gets brand-primaryLight + cheering Hoya + "Playing now" pill
- [ ] Inactive uses paper + idle Hoya, no pill
- [ ] Add-profile in secondary tone
- [ ] Stats use 3 equal columns
- [ ] Grown-up zone ghost CTA (not destructive)

## 7. Output path

- `design/screens/profile/switcher__v1__YYYY-MM-DD.png`
