# Scene Backgrounds & Textures

**The quiet stage.** Backgrounds should never compete with Hoya or content. They establish warmth and disappear.

---

## 1. Context

Hangul Route uses backgrounds in three contexts:

1. **App canvas** — every screen sits on `surface.canvas` #FCF8F1 with optional 4% hanji fiber texture.
2. **Onboarding hero** — Welcome screen has a richer background to set tone before the child enters the learning loop.
3. **Stage / Theme entry transitions** — when navigating into a new stage or theme, a brief "tinted hanji" background shows for context (e.g., entering Stage 1 = warm orange-tinted hanji).

## 2. Backgrounds catalog

| ID | Purpose | Tint | Density |
|---|---|---|---|
| `bg-canvas-base` | Default app background | none (`surface.canvas`) | 4% fibers |
| `bg-canvas-quiet` | Reading/quiet screens | none | 2% fibers |
| `bg-hero-welcome` | Welcome screen full-bleed | warm cream + tiger silhouette ghost | richer |
| `bg-stage-1` Hangul | Stage 1 entry overlay | `stage1` orange tint at 8% | 4% fibers |
| `bg-stage-2` Words | Stage 2 entry overlay | `stage2` mustard tint at 8% | 4% fibers |
| `bg-stage-3` Sentences | Stage 3 entry overlay | `stage3` green tint at 8% | 4% fibers |
| `bg-stage-4` Dialogue | Stage 4 entry overlay | `stage4` sky tint at 8% | 4% fibers |
| `bg-stage-5` Stories | Stage 5 entry overlay | `stage5` purple tint at 8% | 4% fibers |
| `bg-stage-6` Real-use | Stage 6 entry overlay | `stage6` pink tint at 8% | 4% fibers |
| `bg-stage-7` Self-expression | Stage 7 entry overlay | `stage7` teal tint at 8% | 4% fibers |
| `bg-night-rest` | Streak-break / sleep mode | deep `text.primary` cream-on-dark | 6% fibers |
| `bg-celebration` | Results screen on 3-star wins | cream + soft amber radial glow + 5 sparkles | richer |

## 3. Universal background spec

- **Base color**: `surface.canvas` #FCF8F1 (or tinted variant — never pure white)
- **Hanji fibers**: long thin lines, `border.subtle` #E8DFCD, 1-2px thick, random orientation, 2–6% area coverage depending on density
- **Specks**: tiny dots `text.muted` #8A7860, 1px, ~1% coverage on richer variants only
- **Vignette**: optional soft fade on outer 60px to `surface.sunken` #F2EBDE, only for hero backgrounds
- **No grid pattern, no repetition** — each tile must feel hand-made
- **No motion** — backgrounds are always static (motion is reserved for foreground)

## 4. Tinted hanji (stage backgrounds)

When entering a stage, the canvas takes on a subtle tint of the stage color. The recipe:

```
Base layer:   surface.canvas (#FCF8F1)
Tint layer:   stageN color at 8% opacity (multiplied over base)
Fiber layer:  border.subtle fibers at 4% coverage
Vignette:     stageN color at 15% on outer 80px corners
```

Result: a soft, warm wash that signals "you're in Stage X" without overwhelming.

## 5. Hero / celebration backgrounds

These get more visual production:

- **`bg-hero-welcome`** — adds a ghost tiger silhouette (Hoya outline only, `hoya.fur` at 6% opacity) in the lower-right quadrant, looking up at the user.
- **`bg-celebration`** — adds a centered soft radial glow in `feedback.nudge` at 12% opacity, plus 5 small `feedback.nudge` 4-point star shapes scattered across the top 40%.

---

## 6. Claude Design prompt — Hanji texture pack

```prompt
Generate a hanji (Korean traditional paper) texture pack for Hangul Route.
Output: one 2400 × 1600 PNG with 6 textures in a 3 × 2 grid, each 800 × 800.

The 6 textures:
1. Canvas Base (4% fiber density) — default app background
2. Canvas Quiet (2% fiber density) — reading screens
3. Tinted Orange (Stage 1) — canvas + 8% #E8743B wash + 4% fibers
4. Tinted Purple (Stage 5) — canvas + 8% #8265C2 wash + 4% fibers
5. Hero Cream (richer, with ghost tiger silhouette) — see details below
6. Celebration (with amber glow + 5 stars) — see details below

Universal recipe for all 6:
- Base color: warm hanji cream #FCF8F1
- Fibers: long thin lines #E8DFCD (border.subtle), 1-2px wide, 30-200px long,
  random orientations, no grid pattern
- Specks: tiny 1px dots #8A7860 (text.muted) at 1% coverage on textures 5 and 6 only
- No repetition — each tile feels distinct and hand-made

Texture 5 details (Hero Cream):
- Standard 4% fibers
- Add a faint ghost silhouette of a tiger outline in the lower-right
  quadrant, using #F2B33D (hoya.fur) at 6% opacity. The silhouette is
  Hoya in idle pose, looking up toward the upper-left of the frame.
- Soft 80px vignette to #F2EBDE on the outer corners

Texture 6 details (Celebration):
- Standard 4% fibers
- Centered soft radial glow in #F2B33D at 12% opacity, ~600px diameter
- 5 small 4-point star shapes in #F2B33D at 80% opacity scattered across
  the top 40% of the frame, sizes 12-24px

Anti-patterns:
- Repeating wallpaper patterns
- Visible tile seams
- Sharp geometric noise (perlin / digital)
- Fibers all running the same direction
- Pure white background
- Heavy texture that competes with foreground

Style: feels like real handmade Korean paper photographed under soft north
window light. Subtle, warm, generous.

Deliverable: one 2400 × 1600 PNG with 6 labeled tiles, ready to be split
into 6 separate 800 × 800 background textures.
```

## 7. Claude Design prompt — Stage entry tint (parameterized)

Replace `{STAGE_NAME}` and `{STAGE_HEX}` per stage.

```prompt
Generate a tinted hanji background for the Stage {STAGE_NAME} entry
transition in Hangul Route.

Output: 1170 × 2532 PNG (iPhone portrait dimensions) showing the full-
screen background only (no UI, no text).

Recipe:
- Base layer: warm hanji cream #FCF8F1
- Tint layer: {STAGE_HEX} at 8% opacity, multiplied over base
- Fiber layer: thin lines #E8DFCD at 4% coverage, random orientations,
  hand-painted feel
- Vignette: {STAGE_HEX} at 15% opacity on outer 80px corners, soft falloff

No imagery, no text. Just the warm tinted paper.

The result should feel like opening a fresh sheet of cream paper that has
just enough color to signal "you're entering Stage {STAGE_NAME}" without
shouting.

Deliverable: 1170 × 2532 PNG ready as a React Native ImageBackground.
```

## 8. Acceptance checklist

- [ ] All textures use warm hanji cream base (never pure white)
- [ ] Fibers are long thin lines, NOT digital noise
- [ ] No visible tile repetition
- [ ] Specks only on hero / celebration textures (1% max)
- [ ] Vignettes are soft (>40px fade)
- [ ] Tints stay ≤8% wash (background must not compete)
- [ ] Ghost tiger silhouette ≤6% opacity (hero only)
- [ ] Celebration glow ≤12% opacity, stars ≤80% opacity
- [ ] No motion (static backgrounds only)
- [ ] No grid pattern, no perlin noise

## 9. Output path

- Texture pack: `design/illustrations/backgrounds/_texture-pack__v1__YYYY-MM-DD.png`
- Individual: `design/illustrations/backgrounds/{id}__v1__YYYY-MM-DD.png`

Examples:
- `design/illustrations/backgrounds/bg-canvas-base__v1__2026-05-25.png`
- `design/illustrations/backgrounds/bg-stage-1__v1__2026-05-25.png`
- `design/illustrations/backgrounds/bg-hero-welcome__v1__2026-05-25.png`
- `design/illustrations/backgrounds/bg-celebration__v1__2026-05-25.png`
