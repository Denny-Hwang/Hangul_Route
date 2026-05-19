# Screen 08 — Minigame · Match Sound (F-001)

**The first real gameplay.** Tap the letter you hear.

## 1. Context

- F-001 §3.1 — Recognition family ① "Match Sound."
- 5 rounds per session. Each round: hear a jamo, tap 1 of 4 tiles.
- Anti-shame nudge on wrong (F-001 §3.2): tile shakes 200ms → HoyaBubble thinking → auto-replay after 800ms.

## 2. Layout

```
┌─────────────────────────────────────┐
│ ▓▓▓░░     [2 / 5]                    │
│                                      │
│ Tap the letter you hear              │
│                                      │
│            🔊                        │
│         Tap to replay                │
│                                      │
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│   │ ㄱ │ │ ㄴ │ │ ㄷ │ │ ㄹ │       │
│   │ g  │ │ n  │ │ d  │ │ l  │       │
│   └────┘ └────┘ └────┘ └────┘       │
│                                      │
│  (on wrong answer, below tiles:)     │
│  ┌────────────────────────────────┐ │
│  │ 🐯 Listen again. This one says: │ │
│  │   ㄱ — giyeok                    │ │
│  │   [Hear it]                      │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 3. Visual style

- Top: Progress bar primary + step pill ("2 / 5")
- Prompt heading `prompt` 22sp
- Speaker icon 48dp (tap to replay) + caption "Tap to replay"
- 4 Tiles in row (lg size 96dp), flex wrap if narrow
- (Wrong answer state) HoyaBubble thinking tone with replay CTA

## 4. Exact copy

- Prompt: **"Tap the letter you hear"**
- Speaker caption: **"Tap to replay"**
- Wrong message: **"Listen again. This one says"** + Korean + romanization
- Inline CTA on wrong: **"Hear it"**

## 5. Claude Design prompt

```prompt
Design the Match Sound minigame screen for Hangul Route. Output: TWO
1170 × 2532 PNGs side-by-side — one showing the IDLE state, one showing
the WRONG-answer state.

LAYOUT (both):

1. 60px status bar
2. Progress bar (primary) + step pill row:
   - Bar: 36sp tall, pill, #F2EBDE track, #E8743B fill at 40% (round 2/5)
   - Pill on right: "2 / 5" sm neutral tone
3. 48px gap
4. Prompt heading "Tap the letter you hear" — 66sp weight 700 #2A1F14
5. 36px gap

6. Speaker icon row (centered):
   - Speaker icon 144 × 144 sp (48dp at 3x), color #2A1F14
   - 24px gap below: "Tap to replay" — 42sp #8A7860, italic

7. 72px gap

8. Tile row — 4 tiles, 80sp gutters, equal flex (or wrap to 2x2 if
   needed):
   Each tile: 288 × 288 sp (96dp lg at 3x), fill #FFFFFF, 6px border
   #E8DFCD (idle), 48px radius
   Inside: Korean glyph 144sp weight 700 #2A1F14 + romanization 48sp
   #8A7860 below, centered.

   Tiles content (left to right):
   - "ㄱ" / "g/k"
   - "ㄴ" / "n"
   - "ㄷ" / "d/t"
   - "ㄹ" / "r/l"

LEFT VARIANT (IDLE state):
- All 4 tiles in IDLE state (white fill, subtle border)
- No HoyaBubble shown
- Bottom: flex space + 72px bottom safe-area

RIGHT VARIANT (WRONG-answer state):
- Tile "ㄴ" highlighted as WRONG: fill #FCEED1, 6px border #F2B33D,
  glyph color #B5862A — and subtle "shake" motion indicator (small
  arrows on either side)
- Tile "ㄱ" still IDLE
- Below tiles: HoyaBubble (thinking tone):
  - Container fill #FCEED1, 6px border #F2B33D, 72px radius, 48px padding
  - Left: Hoya THINKING pose 216 × 216 sp (eyes look UP, not down)
  - Right stack:
    • "Listen again. This one says" — 60sp weight 600 #2A1F14
    • "ㄱ" — 66sp weight 700 #E8743B
    • "giyeok" — 42sp italic #5C4A36
    • Inline secondary button: "Hear it" — md secondary tone (#4A9DD6
      fill, white label, pill)
- Bottom: 72px bottom safe-area

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Wrong-tile in red (must be amber #F2B33D)
- Hoya looking sad / down in the WRONG state (must look UP)
- Speaker icon smaller than 32sp at 1x
- HoyaBubble using danger #C84B3D ANYWHERE
- More than 4 tiles
- Tiles touching each other (need ≥ 8dp inter-tile)

Deliverable: 2340 × 2532 PNG (two screens side-by-side, 60px gutter
between them, with labels "IDLE" and "WRONG ANSWER" at the top of each).
```

## 6. Acceptance checklist

- [ ] 4 tiles in lg size (96dp at 1x)
- [ ] Speaker icon centered with caption
- [ ] WRONG state uses amber, never red
- [ ] HoyaBubble thinking with Hoya looking UP
- [ ] Inline "Hear it" CTA in HoyaBubble (replay sound)
- [ ] Progress bar matches current round

## 7. Output path

- `design/screens/minigames/match-sound__v1__YYYY-MM-DD.png`
