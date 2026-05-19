# HoyaBubble (F-002)

**Hoya's voice.** The single component that carries the anti-shame contract for the entire app.

## 1. Context

HoyaBubble appears in 4+ wireframes: Welcome, FirstQuestPreview, Quest player (prompts + wrong-answer hints), Results screen, Homework empty state. F-002 spec is the contract this brief implements visually.

3 tones (`idle` / `cheering` / `thinking`) × bilingual delivery (English message + optional Korean + romanization).

## 2. Layout

- Horizontal row: Hoya thumbnail (left) + speech content (right) + optional close button (top-right)
- Thumbnail: 72 × 72 of Hoya in pose matching the tone (`idle` → idle, `cheering` → cheering, `thinking` → thinking)
- Speech container: rounded rect, `radii.xl` (24), 2px border in tone color, padding `lg` (16), soft `card` shadow
- Speech content stack:
  - English message — `bodyLg` 20sp, weight 600, `text.primary`
  - Korean (optional) — `prompt` 22sp, weight 700, `brand.primary` (so Korean stands out)
  - Romanization (optional) — `caption` 14sp italic, `text.secondary`
  - CTA inline (optional) — secondary button

## 3. Tones (the anti-shame contract)

| Tone | Background | Border | Hoya pose | When |
|---|---|---|---|---|
| `idle` | `surface.paper` #FFFFFF | `border.subtle` #E8DFCD | idle | Default prompts, narrative steps |
| `cheering` | `feedback.successLight` #D6EFDF | `feedback.success` #4FA871 | cheering | Correct answers, results, card unlocks |
| `thinking` | `feedback.nudgeLight` #FCEED1 | `feedback.nudge` #F2B33D | thinking | **Wrong answers, hints — NEVER red** |

The `thinking` tone is sacred. It must:
- Use amber `nudge`, never red
- NOT auto-dismiss faster than 1500ms (child needs time to read)
- Show Hoya looking UP (thinking), not down (sad)

## 4. Bilingual contract (F-CNT-001 compliance)

When Korean text appears in HoyaBubble:
- It always lives in the `korean` prop / Korean slot
- Romanization MUST accompany (visual spec)
- English message MUST be present and at least as visually prominent
- The Korean is the *learning target*; the English is the UI message

## 5. Claude Design prompt

```prompt
Create a HoyaBubble component sheet for Hangul Route. Output: one
2000 × 2400 PNG showing 6 variant cells in a 2 × 3 grid.

Each cell is 800 × 600 and shows a HoyaBubble with:
- 72 × 72 Hoya thumbnail on the LEFT (specific pose per tone)
- Speech content on the RIGHT in a stacked column
- Optional small close × button top-right of the speech container

Container spec (per cell):
- Rounded rectangle, 24px border-radius
- 2px border in tone color
- 16px inner padding
- Soft warm-dark card shadow (0/2/8, 6% opacity)

The 6 cells (left-to-right, top-to-bottom):

1. Idle / English only — pose: idle, background #FFFFFF border #E8DFCD
   Message: "Tap the letter you hear" — 20sp bold #2A1F14

2. Idle / Korean + Romanization — pose: idle, same colors
   Message: "Listen and tap" — 20sp bold #2A1F14
   Korean: "가" — 22sp bold #E8743B
   Romanization: "ga" — 14sp italic #5C4A36

3. Cheering / Correct — pose: cheering, background #D6EFDF border #4FA871
   Message: "Wonderful! You got it!" — 20sp bold #2A1F14

4. Cheering / Card unlock — pose: cheering, same colors
   Message: "You earned a Heritage card!" — 20sp bold
   Korean: "호랑이" — 22sp bold #E8743B
   Romanization: "horangi" — 14sp italic #5C4A36

5. Thinking / Wrong answer hint (THE SACRED CELL) — pose: thinking,
   background #FCEED1 border #F2B33D
   Message: "Listen again. This one says" — 20sp bold #2A1F14
   Korean: "ㄱ" — 22sp bold #E8743B
   Romanization: "giyeok" — 14sp italic #5C4A36
   Inline CTA: small secondary button "Hear it" 16sp on #4A9DD6 fill,
   white label, 8px pill radius

6. Thinking / Hint with longer message — pose: thinking, same colors
   Message: "Try again — letters go left to right" — 20sp bold #2A1F14

Background canvas: warm hanji cream #FCF8F1.
Inter-cell gutter: 40px.

Anti-patterns to FLAG and reject if generated:
- Cell 5 or 6 background turning red, salmon, or any warm-red
- Hoya frown in any cell (especially thinking — eyes must look UP)
- Thinking cell using "feedback.danger" (#C84B3D) — forbidden
- Korean text without romanization
- English text smaller than Korean (English is UI, must remain at least
  as prominent)
- Close button styled as destructive red X

Style markers:
- 72 × 72 Hoya thumbnails matching the v1 character sheet exactly
- Hand-painted feel — slight wobble on borders
- Soft shadows, never harsh
- Generous internal spacing

Deliverable: 2000 × 2400 PNG HoyaBubble sheet, ready to validate against
packages/design-system/src/components/HoyaBubble/HoyaBubble.tsx and the
F-002 spec contract.
```

## 6. Output path

- `design/components/HoyaBubble/variants__v1__YYYY-MM-DD.png`
