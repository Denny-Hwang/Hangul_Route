# colors v1

**Authoritative palette for Hangul Route.** Mirrors `packages/design-system/src/tokens.ts` (`colors` export).
Drift between this document and `tokens.ts` is detected by `.github/workflows/design-token-sync.yml` (F-DES-001).

Last updated: 2026-10-11 · Version: v1 (AA contrast revision, see below; `vocab` group added for WordArt, F-VOC-002; `border.shape` added for My route pips, F-ROUTE-001 R-2b)

---

## Brand

| Token | Hex | Notes |
|---|---|---|
| `brand.primary` | #B24915 | 단청(dancheong) deep vermilion orange — primary CTAs, ghost-button text, Hoya accents. White on it 5.44:1, it on canvas 5.14:1 |
| `brand.primaryDark` | #8D3A11 | Pressed state; Pill text on `primaryLight` (5.76:1) |
| `brand.primaryLight` | #FAD9C6 | Tinted surfaces, brand cards |
| `brand.secondary` | #2672A6 | Hoya sky blue — secondary CTAs, info. White on it 5.20:1 |
| `brand.secondaryDark` | #1D5881 | Pressed; Pill text on `secondaryLight` (5.83:1) |
| `brand.secondaryLight` | #CDE5F4 | Tinted secondary surfaces |

## Surface (hanji layering)

| Token | Hex | Use |
|---|---|---|
| `surface.canvas` | #FCF8F1 | App background base |
| `surface.paper` | #FFFFFF | Card / sheet |
| `surface.sunken` | #F2EBDE | Inset / inactive |
| `surface.overlay` | rgba(20, 14, 8, 0.40) | Modal scrim |
| `surface.inkScrim` | rgba(20, 14, 8, 0.06) | Subtle dividers / inks |

## Text (warm dark, never pure black)

| Token | Hex | Use |
|---|---|---|
| `text.primary` | #2A1F14 | Body text |
| `text.secondary` | #5C4A36 | Supporting text |
| `text.muted` | #6F614D | Captions, helper, placeholders, inactive tabs. ≥ 4.5:1 on canvas (5.68), paper (6.01), sunken (5.07), primaryLight (4.52) |
| `text.inverse` | #FFFFFF | Text on primary/secondary fills |
| `text.onPrimary` | #FFFFFF | Specifically for primary-fill backgrounds |
| `text.onSecondary` | #FFFFFF | Specifically for secondary-fill backgrounds |

## Feedback (anti-shame contract)

| Token | Hex | Use |
|---|---|---|
| `feedback.success` | #397952 | Correct answers, completion. White on it 5.21:1 |
| `feedback.successDark` | #2C5E3F | Pressed success fill |
| `feedback.successLight` | #D6EFDF | Success card tint |
| `feedback.nudge` | #F2B33D | Amber. **The wrong-answer color.** Warm, never alarming |
| `feedback.nudgeLight` | #FCEED1 | Nudge surface tint |
| `feedback.info` | #5B8DEF | Info / metadata |
| `feedback.infoLight` | #D9E5FB | Info surface tint |
| `feedback.danger` | #C84B3D | **RESERVED for parent/admin destructive only — never on child failure** |
| `feedback.dangerLight` | #F8DBD8 | Danger surface tint (admin/parent contexts only) |

## Stage axis (7 stage tints — Heritage Journey grid)

| Token | Hex | Stage |
|---|---|---|
| `stage.stage1` | #E8743B | Hangul |
| `stage.stage2` | #D89B2B | Words |
| `stage.stage3` | #7BB552 | Sentences |
| `stage.stage4` | #4A9DD6 | Dialogue |
| `stage.stage5` | #8265C2 | Stories |
| `stage.stage6` | #C84B7D | Real-use |
| `stage.stage7` | #3D9B8C | Self-expression |

## Theme axis (5 culture-theme tints)

| Token | Hex | Theme |
|---|---|---|
| `theme.letters` | #E8743B | Letters & Books |
| `theme.life` | #F2B33D | Food & Daily Life |
| `theme.rites` | #8265C2 | Holidays & Traditions |
| `theme.nature` | #7BB552 | Nature & Animals |
| `theme.crafts` | #4A9DD6 | Play & Crafts |

## Hoya character palette

| Token | Hex | Use |
|---|---|---|
| `hoya.fur` | #F2B33D | Tiger gold — main body fill |
| `hoya.furDark` | #B5862A | Shading |
| `hoya.stripes` | #2A1F14 | Stripes, eyes, mouth (warm-black) |
| `hoya.belly` | #FCF8F1 | Belly + face center |
| `hoya.nose` | #2A1F14 | Nose triangle |
| `hoya.cheek` | #F8B4B4 | Soft pink cheek blush |

### Hoya variants (learner's cub — F-LEARN-001 §3.6)

The learner picks one of five tinted cubs; the **avatar name decides the colour** (`hoya-blue` is blue), not the Pillar theme. Orange is the existing gold cub (`hoya.fur` / `hoya.furDark`, unchanged). The other four are **flat keys of the `hoya` group** so `tokens-parity.test.ts` pins every one. `hoyaVariantColors(variant)` in `tokens.ts` maps `orange | blue | green | purple | pink` to a `{ fur, furDark }` pair. Stripes, nose, cheek and belly are shared by all variants.

| Token | Hex | Use |
|---|---|---|
| `hoya.furBlue` | #4891CB | Blue cub body fill. Stripes on it 4.7:1, on canvas 3.2:1 |
| `hoya.furBlueDark` | #2E6A9E | Blue cub shading and avatar ring |
| `hoya.furGreen` | #5E9E3E | Green cub body fill. Stripes on it 4.9:1, on canvas 3.1:1 |
| `hoya.furGreenDark` | #437A2A | Green cub shading and avatar ring |
| `hoya.furPurple` | #7C57C0 | Purple cub body fill. Stripes on it 3.1:1, on canvas 5.0:1 |
| `hoya.furPurpleDark` | #5B3F9A | Purple cub shading and avatar ring |
| `hoya.furPink` | #D0527F | Pink cub body fill. Stripes on it 4.0:1, on canvas 3.8:1 |
| `hoya.furPinkDark` | #A33A62 | Pink cub shading and avatar ring |

Rules for the variants:

- The fur is a **fill, not text** (the rule above stands: never set text in a Hoya colour). The bar is the 3:1 non-text minimum (WCAG 1.4.11), enforced in `contrast.test.ts`: every fur against `hoya.stripes`; the four new furs and **every** `*Dark` shade against `surface.paper` and `surface.canvas`.
- The gold orange fur is 1.8:1 on canvas, so the **avatar ring and any chip use the `*Dark` shade** (orange `furDark` is 3.1:1 on canvas, 3.3:1 on paper); the cub inside is drawn in the fur.
- Colour is never the only cue (WCAG 1.4.1): every cub carries its English label (Book Tiger, Home Tiger, Feast Tiger, Mountain Tiger, Craft Tiger) wherever it is picked. The fur lightness differs per variant on purpose (the lightness band is limited to what the 3:1 rules allow), and a colour-blind simulation (Machado deuteranopia / protanopia, CIELAB distance) keeps every pair apart: the closest pairs are blue and purple (about 15) and orange and green under protanopia (about 22); a distance below about 10 would be unreadable and none is.
- The avatar's Pillar `theme` colour (`theme.*`) no longer colours the learner's cub.

## Rarity (Heritage Library card borders)

| Token | Hex |
|---|---|
| `rarity.common` | #8A7860 |
| `rarity.uncommon` | #7BB552 |
| `rarity.rare` | #4A9DD6 |
| `rarity.legendary` | #E8743B |

## Vocab (WordArt content colours, F-VOC-002 §3.4)

The colour words the Colors topic teaches, and the content colours of word pictures (apple red,
crow black, flower pink). They are **content, not feedback**: they are drawn only inside WordArt
(`packages/design-system/src/word-art/` and `components/WordArt/`), and an import-guard test
(F-VOC-002 PR W-1b) fails when any other file reads `colors.vocab` or a `'vocab.'` tone. `vocab.red`
is never a failure colour and never stands in for `feedback.danger` or `feedback.nudge`.

| Token | Hex | Notes (contrast on `surface.canvas`) |
|---|---|---|
| `vocab.red` | #D83A34 | Content red (apple, strawberry). 4.34:1. CIEDE2000 3.4 from `feedback.danger`, so the import guard, not the hue, keeps them apart |
| `vocab.orange` | #F28C28 | 2.32:1, outline required |
| `vocab.yellow` | #F6D32D | 1.39:1, outline required |
| `vocab.green` | #3FA34D | 3.03:1 |
| `vocab.blue` | #2F6BD0 | 4.80:1 |
| `vocab.purple` | #8E44AD | 5.54:1 |
| `vocab.skyBlue` | #8FD0F5 | 1.59:1, outline required |
| `vocab.brown` | #8B5A2B | 5.52:1 |
| `vocab.gray` | #9E9E9E | 2.53:1, outline required |
| `vocab.white` | #FFFFFF | 1.06:1, outline required. Same value as `surface.paper`; a content white, never a surface |
| `vocab.black` | #1F1A17 | 16.28:1. A warm black, never #000000 (rule 3) |
| `vocab.pink` | #F58FB5 | 2.09:1, outline required |

Rules for the vocab tones:

- **Fills, never text.** Like the stage, theme, rarity and Hoya tints, no text is set in a vocab tone.
- **The outline carries the edge.** Six tones are below the 3:1 non-text minimum on canvas (WCAG 1.4.11),
  so every swatch and every word picture is outlined in `text.primary` (15.2:1 on canvas, 3 units of 100
  for the main silhouette); a fill is never relied on for a shape's boundary.
- **Colour is never the only cue** (WCAG 1.4.1). Measured on these values (CIE Lab, CIEDE2000; Machado
  colour-vision simulation at severity 1.0 in linear RGB): the closest pair under normal vision is
  skyBlue/gray at 21.1 (distinct). Under protanopia red/brown (2.4) and orange/green (5.8) collapse;
  under deuteranopia blue/purple (5.0), red/green (6.3) and pink/gray (6.8); under tritanopia orange/pink
  (7.6). So every colour swatch carries an object (apple, tangerine, crow, ...), and a quiz never offers
  two of these pairs as the only difference (`COLOR_CONFUSION_PAIRS`, F-VOC-002 §3.4, recomputed by a test).
- **One deliberate deviation** from `design/brief/illustrations/heritage-card-art.md` §3 ("no red except
  dancheong orange"): content reds, blacks and pinks come from `colors.vocab`, and only inside WordArt.

## Borders / dividers

| Token | Hex | Use |
|---|---|---|
| `border.subtle` | #E8DFCD | Default card borders |
| `border.strong` | #C5B8A1 | Emphasis borders |
| `border.focus` | #3A7FB5 | Keyboard focus ring. 4.06:1 on canvas, 3.63:1 on sunken, 4.30:1 on paper (3:1 non-text minimum) |
| `border.shape` | #857360 | Outlines of drawn shapes that carry meaning: My route pips (open, known, new, later rings and the edge of a done disc), the dotted trail connector (F-ROUTE-001 R-2b, `design/components/PipRow/spec.md`). 4.55:1 on paper, 4.29:1 on canvas, 3.84:1 on sunken, 3.42:1 on `brand.primaryLight` (3:1 non-text minimum). `border.strong` (1.9:1) stays a quiet divider |

---

## Rules

1. **No raw hex literals in code** — always reference `colors.<key>` from `@hangul-route/design-system/tokens`.
2. **No red for child failure** — wrong answers use `feedback.nudge` amber. `feedback.danger` is reserved for parent/admin destructive actions.
3. **No pure black** — text uses `text.primary` #2A1F14, never #000000.
4. **No pure white background** — app canvas is `surface.canvas` #FCF8F1; `surface.paper` is for card/sheet layers only.
5. **Drift policy** — adding a new color requires:
   - Update this document
   - Update `packages/design-system/src/tokens.ts` in the same PR
   - Update brief docs that reference it
   - CI gate (`design-token-sync.yml`) blocks merge if the structural drift is unresolved.

## Contrast (WCAG AA) — 2026-10-09 revision

Audit UX-10 measured the v1 palette below AA: white on `brand.primary` #E8743B 3.0:1, on
`brand.secondary` #4A9DD6 2.96:1, on `feedback.success` #4FA871 2.93:1; ghost text (primary on
canvas) 2.84:1; `text.muted` #8A7860 4.02:1 on canvas and 3.59:1 on sunken. The fills, ghost
text and muted captions were deepened (same hues) until every pairing the components render
meets 4.5:1. Korean inside Hoya bubbles now uses `text.primary` instead of brand orange.

`packages/design-system/src/__tests__/contrast.test.ts` enforces the pairings and
`tokens-parity.test.ts` pins this table to `tokens.ts` value-for-value.

Stage, theme, rarity and Hoya tints are unchanged, and several of them are **below AA as text**
(stage1-4 and every theme tint but rites are 1.8-3.0:1 on canvas). They are accents for fills,
borders and small shapes only. **Rule: text is never set in a stage, theme, rarity or Hoya colour.**
The Episode heading and the Journey grid letters use `text.primary` with the stage colour as a
border or accent bar; the stage badge number sits on paper inside a stage-coloured ring; letters on
a theme-coloured card tile use `text.primary` (3.5:1 or better, tested as large text). Pressed ghost
buttons switch their label to `brand.primaryDark` (5.76:1 on `primaryLight`; `brand.primary` there
is 4.10:1). `border.focus` was deepened from #4A9DD6 (2.80:1) to clear the 3:1 non-text minimum.

## Promotion path

`design/tokens/colors.v1.md` (this doc) → `packages/design-system/src/tokens.ts` (`colors` export) → app surfaces consume.
