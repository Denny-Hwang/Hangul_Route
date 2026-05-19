# Screen (container)

**The stage.** The wrapper that gives every screen its hanji cream canvas + safe padding.

## 1. Context

Used as the outer wrapper on every screen in `apps/mobile/src/screens/`. Three tones × scrollable toggle. The Screen component does not have its own visual identity — it's the absence of decoration that makes everything else readable.

## 2. Props

- `tone`: `canvas` (default) / `paper` / `sunken`
- `scrollable`: boolean (renders as ScrollView)
- `padded`: boolean (16px default padding, can disable for full-bleed)

## 3. Tone fills

| Tone | Fill | Use |
|---|---|---|
| `canvas` | `surface.canvas` #FCF8F1 | Default — every regular screen |
| `paper` | `surface.paper` #FFFFFF | Rare — modals presented fullscreen, immersive minigames |
| `sunken` | `surface.sunken` #F2EBDE | Settings, secondary lists |

## 4. Anti-patterns

- Pure white canvas tone (use `paper` if needed, but canvas is the rule)
- Padding > 16px at screen level (use Spacer or Card padding instead)
- Multiple Screen components nested (one per route)

## 5. Claude Design prompt

```prompt
Create a Screen container demo for Hangul Route. Output: one 1600 × 2400
PNG showing 3 screen states side-by-side at iPhone portrait dimensions
(each 480 × 1040 → scaled to fit).

3 columns (left-to-right): canvas / paper / sunken

Each column shows:
1. Status bar area (60px tall, with time + battery icons in #2A1F14)
2. Screen background fill (the tone color)
3. 16px padding inset from edges
4. A sample content stack:
   - Title (28sp bold #2A1F14): "Today"
   - Subtitle (18sp #5C4A36): "Ready for today's quest?"
   - A sample Card (paper, md elevation, brand tone) with two lines
5. Bottom tab bar area (84px tall, 5 icon slots, paper background)

Tone fills (for the screen background):
- canvas: #FCF8F1 (warm hanji cream — this is the default)
- paper: #FFFFFF (rare — for fullscreen modals)
- sunken: #F2EBDE (settings / secondary lists)

Show subtle hanji fiber texture at 4% opacity over the canvas tone only
(not over paper or sunken).

Column labels at the top in 18sp #5C4A36:
"canvas (default)" · "paper" · "sunken"

Anti-patterns to call out:
- White cold backgrounds (canvas is warm cream, never pure white)
- Padding > 16px at screen level (cards handle their own inner padding)
- Multiple stacked Screens (only one wrapper per route)

Deliverable: 1600 × 2400 PNG Screen container demo.
```

## 6. Output path

- `design/components/Screen/variants__v1__YYYY-MM-DD.png`
