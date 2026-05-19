# 00 — Visual Identity (Master)

**The single source of truth for Hangul Route's visual language.** Every other brief in `design/brief/` inherits from this document. When in doubt, this wins.

---

## 1. Context

Hangul Route is a Korean learning app for English-speaking children 5–11 (heritage Korean kids and K-culture curious kids). The visual identity must feel:

- **Warm and earned** — not flashy. We earn the child's trust before we earn their points.
- **Paper-like** — hanji (Korean traditional paper) is the metaphor for surfaces. Soft, fibrous, warm cream.
- **Dancheong-inspired** — bold, joyful colors borrowed from temple paintwork, but used sparingly.
- **Anti-shame** — never red for child failure. Amber for "almost." Hoya's face never frowns.
- **Quiet generous** — generous whitespace. Big touch targets. Body type at ≥18sp. Adults find it readable; kids find it inviting.

## 2. Brand voice (visual)

| Adjective | Yes | No |
|---|---|---|
| Warm | hanji cream, gold accents | white-cold, neutral grey |
| Earned | small celebrations, restraint | confetti spam |
| Hand-made | slightly imperfect strokes | machined gradients |
| Playful | rounded everything | sharp corners > 8dp on touchables |
| Generous | 18sp body floor, 24dp gutters | dense info layouts |

## 3. Color palette (authoritative — sync with `packages/design-system/src/tokens.ts`)

### Brand
- `brand.primary` `#E8743B` — dancheong warm orange. Primary CTAs, Hoya accents.
- `brand.primaryDark` `#B5562A` — pressed state.
- `brand.primaryLight` `#FAD9C6` — tinted surfaces, brand cards.
- `brand.secondary` `#4A9DD6` — Hoya sky blue. Secondary CTAs, info.
- `brand.secondaryDark` `#2E72A3` — pressed.
- `brand.secondaryLight` `#CDE5F4` — tinted secondary surfaces.

### Surface (hanji layering)
- `surface.canvas` `#FCF8F1` — app background. Always.
- `surface.paper` `#FFFFFF` — card/sheet that sits on canvas.
- `surface.sunken` `#F2EBDE` — inset / inactive / disabled.
- `surface.overlay` `rgba(20, 14, 8, 0.40)` — modal scrim.

### Text (warm dark, never pure black)
- `text.primary` `#2A1F14` — body text.
- `text.secondary` `#5C4A36` — supporting text.
- `text.muted` `#8A7860` — captions, helper.
- `text.inverse` `#FFFFFF` — text on primary/secondary fills.

### Feedback (anti-shame)
- `feedback.success` `#4FA871` — correct answers, completion.
- `feedback.successLight` `#D6EFDF` — success card tint.
- `feedback.nudge` `#F2B33D` — amber. **The wrong-answer color.** Warm, never alarming.
- `feedback.nudgeLight` `#FCEED1` — nudge surface tint.
- `feedback.info` `#5B8DEF`, `feedback.infoLight` `#D9E5FB`.
- `feedback.danger` `#C84B3D` — RESERVED for parent/admin destructive actions only. **Never for child failure.**

### Stage axis (7 stage tints — Heritage Journey grid)
- `stage1` `#E8743B` Hangul · `stage2` `#D89B2B` Words · `stage3` `#7BB552` Sentences · `stage4` `#4A9DD6` Dialogue · `stage5` `#8265C2` Stories · `stage6` `#C84B7D` Real-use · `stage7` `#3D9B8C` Self-expression.

### Theme axis (5 culture-theme tints)
- `theme.letters` `#E8743B` · `theme.life` `#F2B33D` · `theme.rites` `#8265C2` · `theme.nature` `#7BB552` · `theme.crafts` `#4A9DD6`.

### Hoya character palette
- `hoya.fur` `#F2B33D` (tiger gold) · `hoya.furDark` `#B5862A` (shading) · `hoya.stripes` `#2A1F14` (warm-black) · `hoya.belly` `#FCF8F1` (cream) · `hoya.nose` `#2A1F14` · `hoya.cheek` `#F8B4B4` (soft pink).

### Rarity (Heritage Library card borders)
- `rarity.common` `#8A7860` · `rarity.uncommon` `#7BB552` · `rarity.rare` `#4A9DD6` · `rarity.legendary` `#E8743B`.

## 4. Typography

| Token | Size (sp) | Use |
|---|---|---|
| `caption` | 14 | helper text, age chips |
| `bodySm` | 16 | secondary body |
| `body` | 18 | **floor for all reading text** |
| `bodyLg` | 20 | CTAs, emphasis body |
| `prompt` | 22 | Hoya speech, quiz prompts |
| `title` | 28 | section headers |
| `display` | 36 | page titles, results |
| `hero` | 48 | landing hero, jamo display |

- **Family**: system fallback for now (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`). Custom font deferred.
- **Weights**: 400 / 500 / 600 / 700 only.
- **Line height**: `tight` 1.15 (display), `normal` 1.35 (body), `relaxed` 1.55 (long form).
- **Korean text** uses the same scale but bumps one tier (Korean glyphs are denser).

## 5. Spacing & radii

- 4pt sub-grid (xxs=2, xs=4, sm=8, md=12, lg=16, xl=24, xxl=32, xxxl=48, jumbo=64).
- Radii generous: xs=4, sm=8, md=12, lg=16, xl=24, xxl=32, pill=999, circle=9999.
- Card default: `radii.lg` (16) + `shadows.card` (subtle warm-black).
- Modals: `radii.xl` (24) + `shadows.modal` (deeper).

## 6. Motion

- `duration.instant` 60ms · `fast` 120ms · `base` 200ms · `slow` 320ms · `crawl` 600ms · `celebration` 900ms.
- Default easing: `cubic-bezier(0.2, 0, 0, 1)` (standard).
- Celebrations: `cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy — tasteful overshoot).
- **Always honor `prefers-reduced-motion`** — collapse to instant color change, skip animations.

## 7. Touch targets (ages 5–11)

- `min` 64dp (CLAUDE.md floor) — secondary actions.
- `child` 80dp — primary actions, profile avatars.
- `hero` 96dp — jamo tiles, big "Start" CTAs.
- Inter-tile spacing **minimum 8dp**, prefer 12dp.

## 8. Illustration style (one-line manifesto)

> Geometric, warm, slightly imperfect. Round corners. Visible "brush" thickness. Cream paper backgrounds. Never photorealistic. Never neon. Always smiling (or thinking, never sad).

## 9. Mood references (text only — no real images)

- 한지 (hanji) paper — cream, fibrous texture, slightly uneven edges
- 단청 (dancheong) — temple eave painting: bold red-orange, green, blue, used in pattern
- 호랑이 (Korean tiger folk paintings — minhwa) — round bodies, smiling faces, big eyes
- Penguin / Little Golden Books — generous whitespace, friendly tone
- Studio Ghibli — warm light, soft shadows, hand-painted feel
- Toca Boca — modern, geometric, but warmer
- Khan Academy Kids — kid-typography, generous spacing

---

## 10. Claude Design prompt — Identity exploration sheet

Use this once at the start to lock visual identity. Output goes to `design/brief/__output__/identity-sheet__v1__YYYY-MM-DD.png` and is the reference for every later session.

```prompt
Create a visual identity exploration sheet for "Hangul Route", a Korean
language learning app for English-speaking children ages 5–11.

Layout: one 1600x2000 PNG split into 6 zones, labeled:
  1. Brand palette (10 swatches)
  2. Surface palette (4 hanji-cream swatches)
  3. Feedback palette (success green / amber nudge / info / reserved danger)
  4. Stage axis (7 tints) and Theme axis (5 tints)
  5. Typography scale (sample text at caption / body / prompt / title / display / hero)
  6. Mood collage: 4 small frames showing — hanji paper texture, a Korean
     folk-tiger (minhwa style), a hanji-paper card with a single Korean letter,
     and a warm soft-shadow card stack.

Visual style:
- Warm, paper-like background — hanji cream (#FCF8F1) over a subtle fibrous
  texture.
- Type: friendly sans, generous letter-spacing, weights 400/600/700 only.
- Spacing: 4pt grid, generous gutters (24px).
- Round corners everywhere (8–24px radii).
- Color swatches as rounded squares (radii 16px) with hex labels in muted
  warm-dark (#5C4A36) below.

Exact colors to plot (do not pick others):
  brand.primary #E8743B / primaryDark #B5562A / primaryLight #FAD9C6
  brand.secondary #4A9DD6 / secondaryDark #2E72A3 / secondaryLight #CDE5F4
  surface.canvas #FCF8F1 / paper #FFFFFF / sunken #F2EBDE
  text.primary #2A1F14 / secondary #5C4A36 / muted #8A7860
  feedback.success #4FA871 / nudge #F2B33D / info #5B8DEF / danger #C84B3D
  stage tints: #E8743B #D89B2B #7BB552 #4A9DD6 #8265C2 #C84B7D #3D9B8C
  theme tints: #E8743B #F2B33D #8265C2 #7BB552 #4A9DD6
  hoya: fur #F2B33D, stripes #2A1F14, belly #FCF8F1, cheek #F8B4B4

Anti-patterns (do not produce):
- White cold backgrounds.
- Red used anywhere except the small "danger (reserved)" swatch.
- Drop shadows that read as "Material Design dark."
- Sans-serif at < 14sp.

Deliverable: one PNG identity sheet at 1600x2000, ready to be the cover of
the design/brief/ folder.
```

## 11. Claude Design prompt — Hanji paper texture studies

```prompt
Generate 4 hanji (Korean traditional paper) texture studies, each 600x600,
arranged on a single 1200x1200 sheet.

Characteristics:
- Warm cream base (#FCF8F1 — surface.canvas)
- Subtle long mulberry fibers (#E8DFCD — border.subtle), 1-2px thick,
  random orientations, ~5% coverage
- Tiny natural specks (#8A7860 — text.muted), 1px, ~1% coverage
- No grid pattern, no repetition — each tile feels different
- Soft natural edge fade on the outer 30px (vignette to #F2EBDE)

The 4 variations:
1. Smooth — sparse fibers, calm
2. Layered — two ply visible, slightly more fibrous
3. Aged — extra specks, warmer tint
4. Inked — subtle hint of dancheong orange (#E8743B at 4% opacity) bleed

Deliverable: a single PNG to be used as background textures throughout the
app (export each tile separately too).
```

## 12. Claude Design prompt — Single Hoya thumbnail (smoke test)

Run this first to validate the character pipeline before producing the full character sheet.

```prompt
Draw a single, small (400x400) portrait of Hoya the tiger, the guide
character of Hangul Route.

Character: a friendly young Korean tiger (호랑이), inspired by Korean folk
painting (minhwa) tigers — round body, big eyes, gentle smile, slightly
silly. Not photorealistic. Not anime.

Palette (use only these):
- Fur main: #F2B33D
- Fur shading: #B5862A
- Stripes: #2A1F14 (warm-black, not pure black)
- Belly + face center: #FCF8F1 (cream)
- Cheeks: #F8B4B4 (soft pink, light blush)
- Nose: #2A1F14 (small triangle)

Pose: "idle" — front-facing, head slightly tilted, eyes warm and curious,
mouth a small soft "U" smile. Visible round belly. Two small front paws
resting in front. No background — transparent or solid cream (#FCF8F1).

Style markers:
- Hand-painted, slightly imperfect linework (~3px stroke, slight wobble)
- Round everything — body, head, ears, eyes
- Generous whitespace around the character
- Soft shadow under feet (radial gradient, no hard edge)

Avoid:
- Sharp angles, sharp teeth, intense expression
- Anime "uwu" face, sparkle eyes
- Photorealism, fur strands, fang detail
- Pure black anywhere

Deliverable: 400x400 PNG with Hoya idle pose, cream background, ready to
be cropped into the app's HoyaBubble component thumbnail.
```

---

## 13. Acceptance checklist (apply to every later brief)

- [ ] Uses only colors listed in §3
- [ ] Uses only type sizes listed in §4
- [ ] All radii ∈ {0, 4, 8, 12, 16, 24, 32, 999, 9999}
- [ ] No red for child failure (only `feedback.nudge` amber)
- [ ] All touch targets ≥ 64dp
- [ ] UI text in English (Pre-A1), Korean only for learning target
- [ ] Korean always paired with romanization
- [ ] Hoya never frowns
- [ ] Background is hanji cream, never pure white outside of paper-card surfaces
- [ ] Output path matches `design/screens/...`, `design/characters/...`, or `design/illustrations/...`

## 14. Output path for this brief

- `design/brief/__output__/identity-sheet__v1__YYYY-MM-DD.png`
- `design/brief/__output__/hanji-textures__v1__YYYY-MM-DD.png`
- `design/characters/hoya/v1/idle-smoke-test__YYYY-MM-DD.png`
