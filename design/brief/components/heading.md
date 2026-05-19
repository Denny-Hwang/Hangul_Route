# Heading / Body / Caption (Typography)

**The voice of the app.** Three text components covering display, body, and caption tiers.

## 1. Context

Three sister components in one file:
- `Heading` — display / title / prompt levels, headings + accessibility role "header"
- `Body` — body text in 3 sizes (sm / md / lg)
- `Caption` — helper text, captions

## 2. Type scale (from `tokens.typography.size`)

| Component | Level / Size | Size (sp) | Default weight | Default tone |
|---|---|---|---|---|
| Heading | display | 36 | bold (700) | primary |
| Heading | title | 28 | bold | primary |
| Heading | prompt | 22 | bold | primary |
| Heading | body | 18 | bold | primary |
| Heading | caption | 14 | bold | primary |
| Body | sm | 16 | regular (400) | primary |
| Body | md | 18 | regular | primary |
| Body | lg | 20 | regular | primary |
| Caption | (single) | 14 | medium (500) | muted |

## 3. Line height

- Heading: `tight` 1.15
- Body: `normal` 1.35
- Caption: `normal` 1.35

## 4. Tone (color)

| Tone | Color |
|---|---|
| `primary` | `text.primary` #2A1F14 |
| `secondary` | `text.secondary` #5C4A36 |
| `muted` | `text.muted` #8A7860 |
| `inverse` | `text.inverse` #FFFFFF |
| `brand` | `brand.primary` #E8743B |

## 5. Korean text

When Korean appears in a Heading or Body, the visual scale stays the same as English (does NOT auto-bump). Designers must explicitly pick a larger level for Korean if it needs visual prominence (e.g., Korean word as `prompt` 22sp in HoyaBubble).

## 6. Claude Design prompt

```prompt
Create a typography sheet for Hangul Route. Output: one 2000 × 2400 PNG
showing all type scale levels.

LAYOUT
3 sections (top-to-bottom), each on warm hanji cream background #FCF8F1:

SECTION 1 — Heading scale (display / title / prompt / body / caption)
Each row shows the Heading component at one level with two samples:
- Left: English heading "Today's quest"
- Right: Korean heading "오늘의 학습" (using the same size)

Font family: system sans, weight 700 (bold).
Color: #2A1F14 (text.primary).
Line height: 1.15 (tight).

Sizes:
- display: 36sp
- title: 28sp
- prompt: 22sp
- body: 18sp
- caption: 14sp

Vertical spacing between rows: 48px.

SECTION 2 — Body scale (sm / md / lg)
Each row shows the Body component at one size with two samples:
- Left: English "Hoya is the guide of Hangul Route. Tap the letter you hear."
- Right: Korean "호야와 함께 한국어를 배워요" (target language sample)

Font family: system sans, weight 400 (regular).
Color: #2A1F14.
Line height: 1.35 (normal).

Sizes:
- sm: 16sp
- md: 18sp
- lg: 20sp

SECTION 3 — Caption (single size, multiple tones)
4 rows showing Caption at 14sp medium (weight 500), each in a different
tone:
- primary #2A1F14: "Stage 1 progress"
- secondary #5C4A36: "Quest of the day"
- muted #8A7860: "12 minutes left"
- brand #E8743B: "Earn 3 stars to unlock"

Section labels on top of each section in 22sp bold #5C4A36:
"Heading — display to caption", "Body — sm / md / lg", "Caption — tones".

Anti-patterns:
- Body floor below 16sp (must be ≥ 16, body default 18)
- Korean text rendered in a different family
- Italic captions (must be regular or medium)
- Pure black anywhere (always #2A1F14)
- Sample strings in placeholder lorem (use real Hangul Route copy)

Deliverable: 2000 × 2400 PNG type sheet, ready to validate against
packages/design-system/src/components/Heading/Heading.tsx.
```

## 7. Output path

- `design/components/Heading/type-sheet__v1__YYYY-MM-DD.png`
