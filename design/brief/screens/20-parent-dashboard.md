# Screen 20 — Parent Dashboard (mobile)

**The grown-up view.** Per-profile stats, recent quests, privacy reminder.

## 1. Context

- **When**: after passing Parent Gate from Profile tab.
- **Goal**: show family-level progress + per-kid summary, in a quieter visual style.
- **Success**: parent leaves feeling informed, not anxious.

## 2. Layout

```
┌─────────────────────────────────────┐
│ ← Family Dashboard                   │
│ Read-only — settings live on web.    │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ Mina         [Age 5-7]          │ │
│ │ 9 quests · 14 cards · 5d streak │ │
│ │ Recent:                          │ │
│ │  Meet g, n, d, l       3★       │ │
│ │  Bow & Eat Tteokguk    2★       │ │
│ └────────────────────────────────┘ │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ Jun           [Age 8-9]         │ │
│ │ 12 quests · 19 cards · 7d streak│ │
│ │ Recent:                          │ │
│ │  Meet the Vowels       3★       │ │
│ │  Hello Kimchi & Rice   2★       │ │
│ └────────────────────────────────┘ │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ Privacy                          │ │
│ │ All learning data stays on this  │ │
│ │ device unless you sign in.       │ │
│ └────────────────────────────────┘ │
│                                      │
│ [Open settings (md secondary)]       │
└─────────────────────────────────────┘
```

## 3. Visual style

- Back chevron + title row
- One Card per profile: paper md, title row (name + age pill) + summary line + recent quest list with star count
- Privacy Card: sunken tone (calmer)
- Secondary "Open settings" CTA (currently no-op — points to web)

## 4. Exact copy

- Title: **"Family Dashboard"** · sub: **"Read-only — settings live on the web."**
- Per-profile summary: **"{quests} quests · {cards} cards · {streak}d streak"**
- "Recent" sub-label
- Privacy title: **"Privacy"** · body: **"All learning data stays on this device unless you sign in. We do not share with third parties."**
- CTA: **"Open settings"**

## 5. Claude Design prompt

```prompt
Design the Parent Dashboard screen for Hangul Route (mobile in-app).
Output: 1170 × 3000 PNG (long-scroll).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Header row: Back chevron 84sp tap (left) + 24px gap + stack:
   - "Family Dashboard" — 84sp weight 700 #2A1F14
   - "Read-only — settings live on the web." — 42sp #8A7860
3. 48px gap

4. Two profile Cards (Card paper md, 48px padding, 36px gutter between):

   Card 1 — Mina:
   - Header row: "Mina" 60sp weight 700 #2A1F14 (left) + pill "Age 5-7"
     sm neutral tone (right)
   - 24px gap
   - 4-stat row (equal flex): "9 / Quests" "14 / Cards" "5 / Sessions"
     "42 / Minutes" — each centered, value 60sp bold + label 42sp muted
   - 36px gap
   - "Recent" caption — 42sp #8A7860
   - 12px gap
   - List of 3 recent quest rows (each with 1px bottom border #E8DFCD):
     - Row: "Meet g, n, d, l" 48sp #2A1F14 (left) + "3★" 42sp #B5862A
       (right), 24px vertical padding
     - Row: "Bow & Eat Tteokguk" + "2★"
     - Row: "Tiger, Magpie, Moon" + "3★"

   Card 2 — Jun:
   - Header: "Jun" + pill "Age 8-9"
   - Stats: "12 / Quests" "19 / Cards" "7 / Sessions" "108 / Minutes"
   - "Recent" + 3 rows:
     - "Meet the Vowels" + "3★"
     - "Yut, Kite, Top" + "3★"
     - "Hello Kimchi & Rice" + "2★"

5. 48px gap

6. Privacy Card (Card sunken md, 48px padding):
   - "Privacy" — 66sp weight 700 #2A1F14
   - 12px gap
   - "All learning data stays on this device unless you sign in. We do
     not share with third parties." — 42sp #5C4A36

7. 48px gap

8. Secondary CTA "Open settings" — md, secondary tone (#4A9DD6 fill,
   white label), pill, autoWidth left-aligned, 60sp weight 600

9. 96px bottom safe-area

Background: warm hanji cream #FCF8F1.
No tab bar (this is a stack screen behind the parent gate).

Anti-patterns:
- Bright celebratory colors (parents see this — quieter than child UI)
- Star count in red
- Privacy section worded scary
- "Open settings" in destructive color

Deliverable: 1170 × 3000 PNG.
```

## 6. Acceptance checklist

- [ ] No tab bar (stack-presented screen)
- [ ] 4-stat row per profile equal flex
- [ ] Recent rows with bottom dividers
- [ ] Star counts in amber (not red)
- [ ] Privacy card sunken (calm tone)
- [ ] Settings CTA secondary not destructive

## 7. Output path

- `design/screens/parent/dashboard-mobile__v1__YYYY-MM-DD.png`
