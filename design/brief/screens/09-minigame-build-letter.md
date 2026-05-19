# Screen 09 — Minigame · Build a Letter

**Construction family ④.** Assemble a syllable from jamo tiles.

## 1. Context

Tap jamo in correct order (consonant first, then vowel, optionally batchim) to build a target syllable like 가 (ga).

## 2. Layout

```
┌─────────────────────────────────────┐
│ ▓▓░░░     [1 / 4]                    │
│                                      │
│ Build this letter                    │
│                                      │
│   ┌─────────────┐                    │
│   │     가      │                    │
│   │     ga      │                    │
│   └─────────────┘                    │
│                                      │
│ Slots:                               │
│   [   ] [   ]                        │
│                                      │
│ Tiles                                │
│   [ㄱ] [ㅏ] [ㄴ] [ㅓ]                │
│                                      │
│ (wrong state)                        │
│ 🐯 Not quite. Try again —            │
│    letters go left to right.         │
└─────────────────────────────────────┘
```

## 3. Visual style

- Top: progress + step pill
- Target syllable card: large square (160×160 at 1x), thick primary border, syllable in 80sp + romanization
- Slot row: 2-3 dashed-border boxes 72px each, fill brand-primaryLight when populated
- Tile row: 4-5 medium tiles (md 80dp), wrap if needed
- HoyaBubble thinking on wrong (replaces the slots briefly)

## 4. Exact copy

- Prompt: **"Build this letter"**
- Caption: **"Slots:"** · **"Tiles"**
- Wrong: **"Not quite. Try again — letters go left to right."**

## 5. Claude Design prompt

```prompt
Design the Build-a-Letter minigame screen for Hangul Route. Output:
1170 × 2532 PNG showing the IDLE state with empty slots.

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Top row: Progress bar (primary, 36sp tall, pill, #E8743B fill 25%
   for round 1/4) + pill "1 / 4" sm neutral
3. 48px gap
4. Prompt "Build this letter" — 66sp weight 700 #2A1F14
5. 36px gap

6. Target syllable card (centered):
   - 480 × 480 sp box, fill #FFFFFF, 9px border #E8743B (primary), 72px
     radius (radii.xl)
   - Inside: large "가" syllable — 240sp weight 800 #2A1F14, centered
   - Below: "ga" — 42sp italic #5C4A36

7. 48px gap

8. Caption: "Slots:" — 42sp #8A7860 center
9. 12px gap

10. Empty slot row (centered, 24px gutter):
    - 2 slots, 216 × 216 sp each, 6px DASHED border #C5B8A1, fill
      #FFFFFF, 48px radius (radii.lg)
    - Empty inside

11. 48px gap

12. Caption: "Tiles" — 42sp #8A7860 center
13. 12px gap

14. Tile row (centered, 24px gutter, wrap if needed):
    - 4 tiles, md size 240 × 240 sp (80dp child at 3x), fill #FFFFFF,
      6px border #E8DFCD, 48px radius
    - Each shows a jamo + romanization below:
      "ㄱ" / "g/k"
      "ㅏ" / "a"
      "ㄴ" / "n"
      "ㅓ" / "eo"
    - Glyph 108sp weight 700, rom 48sp #8A7860

15. Flex space
16. Ghost CTA "Skip" — full-width md (240sp tall), pill, transparent fill,
    6px border #E8743B, label "Skip" 60sp weight 600 #E8743B
17. 72px bottom safe-area

VARIANT (optional second panel showing wrong state):
- Slots remain empty (after auto-clear)
- HoyaBubble thinking below tiles: "Not quite. Try again — letters go
  left to right."

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Slots indistinguishable from tiles (slot has dashed border, tile has
  solid)
- Target syllable too small (must be 240sp)
- Wrong-state turning the target card red
- Tile rom larger than glyph

Deliverable: 1170 × 2532 PNG.
```

## 6. Acceptance checklist

- [ ] Target syllable card has primary border (not stage color)
- [ ] Slots use dashed border (visual cue: empty container)
- [ ] Tiles use solid border
- [ ] Wrong-answer flow shows HoyaBubble thinking only — slots auto-clear
- [ ] Skip is ghost (allows fallback without shame)

## 7. Output path

- `design/screens/minigames/build-letter__v1__YYYY-MM-DD.png`
