# Screen 07 — Quest Player (5-step orchestrator)

**The arc.** intro → present → practice → apply → reward.

## 1. Context

- **When**: tapping "Start" / "Play again" on an episode quest.
- **Goal**: hold the 5-step contract — Hoya intro, present, practice (minigame), apply (minigame), reward.
- **Success**: child completes all 5 steps in ≤5 minutes.

This brief covers the **narrative step UI** (intro / present / reward). Minigame steps are their own briefs (08–13).

## 2. Layout (narrative step)

```
┌─────────────────────────────────────┐
│  ●●●○○         [2 / 5]               │
│                                      │
│  Intro                               │
│  [pill kind="intro"]                 │
│                                      │
│  Hi from Hoya  (title)               │
│                                      │
│  ┌────────────────────────────────┐ │
│  │      Hoya, waving (120)         │ │
│  │                                  │ │
│  │  🐯 These four letters say a lot! │ │
│  │     (HoyaBubble idle)            │ │
│  └────────────────────────────────┘ │
│                                      │
│                                      │
│                                      │
│  [Continue (hero)]                   │
└─────────────────────────────────────┘
```

## 3. Visual style

- Top row: Progress dots (5 max, value = current step + 1, tone primary) on the left + small step pill ("2 / 5") on the right
- Step title (title 28sp) + step kind pill
- Big Hoya in a tone-tinted Card (brand for normal, success for reward steps)
- HoyaBubble below the Hoya inside the same Card (avoids redundant double-bubble)
- Flex-grow space
- Hero CTA ("Continue" or "See results" on reward step)

## 4. Exact copy

- Step kind pills: "intro" / "present" / "practice" / "apply" / "reward"
- Step titles + Hoya lines from `apps/mobile/src/content/quests.ts` per quest
- Continue CTA: **"Continue"** (or **"See results"** on the final reward step)

## 5. Claude Design prompt

```prompt
Design the Quest Player narrative step screen for Hangul Route. Output:
1170 × 2532 PNG showing step 2 of 5 (intro step).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Top row: Progress dots row (left, flex 1) + step counter pill (right)
   - 5 dots, 36sp diameter, 24px gutter
   - First 2 dots filled #E8743B (primary tone), last 3 unfilled #F2EBDE
   - Pill: "2 / 5" — sm neutral tone (fill #F2EBDE text #5C4A36)
3. 48px gap

4. Step title "Hi from Hoya" — 84sp weight 700 #2A1F14
5. 12px gap
6. Step kind pill: "intro" — sm primary tone (fill #FAD9C6 text #B5562A)

7. 48px gap

8. Brand Card (Card brand md — fill #FAD9C6, no border, 48px radius,
   48px padding):
   - Center top: Hoya WAVING 360 × 360 sp
   - 36px gap
   - HoyaBubble (tone idle, but sit inside the brand card):
     - Container: 72px radius, 6px border #E8DFCD, fill #FFFFFF, 48px
       padding, card shadow
     - Left: 216sp Hoya IDLE
     - Right: "These four letters say a lot!" — 60sp weight 600 #2A1F14

9. Flex-grow space

10. Primary CTA: full-width, 288sp tall, pill, #E8743B, label "Continue"
    white 66sp weight 600

11. 72px bottom safe-area

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Two HoyaBubbles stacked
- Progress dots in red
- Step pill in a tone that conflicts with the step kind
- More than one CTA
- Hoya without a tone-matching Card behind

VARIANT (reward step): same layout but
- step kind pill: "reward" success tone (fill #D6EFDF text #2F6A47)
- Brand card → use success tone instead (fill #D6EFDF)
- Hoya pose CHEERING instead of WAVING
- HoyaBubble tone cheering (fill #D6EFDF border #4FA871)
- CTA label "See results"

Deliverable: 1170 × 2532 PNG showing the intro step. Optionally include a
second 1170 × 2532 PNG showing the reward variant on the right.
```

## 6. Acceptance checklist

- [ ] Progress dots show real position (first 2 filled, last 3 empty)
- [ ] Step pill matches step kind
- [ ] Hoya pose matches step (waving for intro, cheering for reward)
- [ ] Single CTA
- [ ] Brand Card houses Hoya + HoyaBubble (no orphan elements)

## 7. Output path

- `design/screens/quest/player-narrative__v1__YYYY-MM-DD.png`
- `design/screens/quest/player-reward__v1__YYYY-MM-DD.png`
