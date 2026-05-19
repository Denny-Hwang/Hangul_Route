# Screen 10 — Minigame · Trace Stroke

**Construction family ⑤.** Trace the letter to feel its shape.

## 1. Context

Prototype version: 3 taps on the letter shape = "traced." Real gesture-path matching deferred to F-004.

## 2. Layout

```
┌─────────────────────────────────────┐
│ ▓░░░     [1 / 4]                     │
│                                      │
│ Trace the letter giyeok              │
│ Tap inside the letter 3 times.       │
│                                      │
│                                      │
│        ┌─────────────────┐           │
│        │                  │           │
│        │       ㄱ        │           │
│        │   (240×240)     │           │
│        │                  │           │
│        └─────────────────┘           │
│                                      │
│         2 / 3 taps                   │
│                                      │
│ 🐯 Slowly tap inside the letter.     │
│    Hear the sound and copy it.       │
│                                      │
│ [Skip]                               │
└─────────────────────────────────────┘
```

## 3. Visual style

- Big touchable letter inside a `child` tap-target square, radii.xxl (32)
- Default fill `brand.primaryLight`; turns `successLight` after 3 taps
- Tap counter caption
- HoyaBubble idle for instruction
- Skip ghost button

## 4. Exact copy

- Title (variable): **"Trace the letter {romanization}"** — e.g., "Trace the letter giyeok"
- Caption: **"Tap inside the letter 3 times."**
- Counter: **"{n} / 3 taps"**
- Hoya line: **"Slowly tap inside the letter. Hear the sound and copy it."**

## 5. Claude Design prompt

```prompt
Design the Trace-Stroke minigame screen for Hangul Route. Output:
1170 × 2532 PNG showing the IDLE state at tap count "2 / 3 taps".

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Progress bar primary + pill "1 / 4" sm neutral
3. 48px gap
4. Title "Trace the letter giyeok" — 66sp weight 700 #2A1F14
5. 12px gap
6. Caption "Tap inside the letter 3 times." — 42sp #8A7860
7. 96px gap

8. Big trace zone (centered):
   - 720 × 720 sp square, fill #FAD9C6 (brand primary light), 9px
     border #E8743B (primary), 96px radius (radii.xxl)
   - Inside: enormous "ㄱ" glyph — 540sp weight 800 #2A1F14, centered

9. 36px gap

10. Tap counter: "2 / 3 taps" — 60sp #5C4A36 center

11. 72px gap

12. HoyaBubble (idle tone): fill #FFFFFF, 6px border #E8DFCD, 72px
    radius, 48px padding:
    - Left: 216sp Hoya IDLE pose
    - Right: "Slowly tap inside the letter. Hear the sound and copy it."
      — 60sp weight 600 #2A1F14

13. Flex space

14. Ghost Skip CTA: full-width md (240sp tall), 6px border #E8743B,
    transparent fill, label "Skip" 60sp #E8743B weight 600

15. 72px bottom safe-area

VARIANT (success state after 3 taps):
- Trace zone fill changes to #D6EFDF
- Border to #4FA871 (success)
- Counter updates to "3 / 3 taps" + checkmark icon next to it

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Trace zone smaller than 240sp at 1x (must accommodate kid finger paths)
- Glyph not centered
- Tap counter in red
- "Skip" button in primary color (must be ghost — fallback isn't loud)

Deliverable: 1170 × 2532 PNG.
```

## 6. Acceptance checklist

- [ ] Trace zone ≥ 240dp (kid fingers!)
- [ ] Default fill brand-primaryLight, success state successLight
- [ ] Counter updates inline
- [ ] HoyaBubble idle (no nudge on partial — only success on complete)
- [ ] Skip is ghost

## 7. Output path

- `design/screens/minigames/trace-stroke__v1__YYYY-MM-DD.png`
