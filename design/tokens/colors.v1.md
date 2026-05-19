# colors v1

**Authoritative palette for Hangul Route.** Mirrors `packages/design-system/src/tokens.ts` (`colors` export).
Drift between this document and `tokens.ts` is detected by `.github/workflows/design-token-sync.yml` (F-DES-001).

Last updated: 2026-05-19 · Version: v1

---

## Brand

| Token | Hex | Notes |
|---|---|---|
| `brand.primary` | #E8743B | 단청(dancheong) warm orange — primary CTAs, Hoya accents |
| `brand.primaryDark` | #B5562A | Pressed state |
| `brand.primaryLight` | #FAD9C6 | Tinted surfaces, brand cards |
| `brand.secondary` | #4A9DD6 | Hoya sky blue — secondary CTAs, info |
| `brand.secondaryDark` | #2E72A3 | Pressed |
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
| `text.muted` | #8A7860 | Captions, helper |
| `text.inverse` | #FFFFFF | Text on primary/secondary fills |
| `text.onPrimary` | #FFFFFF | Specifically for primary-fill backgrounds |
| `text.onSecondary` | #FFFFFF | Specifically for secondary-fill backgrounds |

## Feedback (anti-shame contract)

| Token | Hex | Use |
|---|---|---|
| `feedback.success` | #4FA871 | Correct answers, completion |
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

## Rarity (Heritage Library card borders)

| Token | Hex |
|---|---|
| `rarity.common` | #8A7860 |
| `rarity.uncommon` | #7BB552 |
| `rarity.rare` | #4A9DD6 |
| `rarity.legendary` | #E8743B |

## Borders / dividers

| Token | Hex | Use |
|---|---|---|
| `border.subtle` | #E8DFCD | Default card borders |
| `border.strong` | #C5B8A1 | Emphasis borders |
| `border.focus` | #4A9DD6 | Keyboard focus ring |

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

## Promotion path

`design/tokens/colors.v1.md` (this doc) → `packages/design-system/src/tokens.ts` (`colors` export) → app surfaces consume.
