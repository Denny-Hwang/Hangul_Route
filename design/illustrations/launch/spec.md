# Launch assets v1 — app icon · adaptive icon · splash · PH thumbnail

## Brief source
`design/brief/launch-assets.md` §1 (iOS icon), §2 (Android adaptive), §3 (splash),
§6 (PH thumbnail). Palette + anti-patterns from `design/brief/00-visual-identity.md`
and `design/launch/README.md`.

## Target
- Age: all (5–11) — store surface, parent-facing first impression
- Emotion tone: warm, safe, "this tiger is safe"
- Persona: P4/P5 parents at the App Store / Play listing

## What this v1 is
Vector renders that reuse the **exact Hoya geometry from
`packages/design-system/src/components/Hoya/Hoya.tsx`** (the in-app v1
placeholder character), so the icon, splash, and in-app mascot are the same
character. Head-only composition per brief §1, plus a cream muzzle patch and
a soft `#B5862A` painted outline for definition at icon scale.

When the illustrated 5-pose Hoya sheet lands in `design/characters/hoya/v1/`,
re-run these compositions with the real art (same layout, same palette) and
bump to v2.

## Tokens used (hex-inlined — SVG/PNG assets, not code)
- Background radial: `colors.brand.primary #E8743B` → `colors.brand.primaryDark #B5562A`
- Ring / cream: `colors.hoya.belly #FCF8F1`
- Hoya: `fur #F2B33D`, `furDark #B5862A`, `stripes/nose #2A1F14`, `cheek #F8B4B4`
- Splash text: `text.primary #2A1F14`, tagline `#5C4A36`
- Hanji texture: ~3–5% opacity fiber strokes + specks, deterministic seed

## Files
| File | Size | Wired to |
|---|---|---|
| `app-icon/ios__1024__v1__2026-08-13.png` | 1024² full-bleed | `apps/mobile/assets/icon.png` → `app.json expo.icon` |
| `app-icon/android-foreground__v1__2026-08-13.png` | 1024² transparent, head in inner 66% | `apps/mobile/assets/adaptive-icon.png` → `expo.android.adaptiveIcon.foregroundImage` |
| `app-icon/android-background__v1__2026-08-13.png` | 1024² flat #E8743B + texture | (Expo uses `backgroundColor: #E8743B` instead) |
| `splash__v1__2026-08-13.png` | 1284×2778 | `apps/mobile/assets/splash.png` → `expo.splash.image` |
| `product-hunt/thumbnail__v1__2026-08-13.png` | 240² | PH listing (D-4 checklist item) |

`.svg` sources sit next to each PNG — re-render at any size with any
SVG rasterizer (rendered here with headless Chromium).

## Acceptance (brief §9)
- [x] Icon reads at 60×60 (thumbnail is the same face at 240² → verified legible)
- [x] No text inside icon or thumbnail
- [x] Palette tokens only; no `#000000` (ink is `#2A1F14`); no red beyond `#E8743B`
- [x] Hoya smiling (idle "U" mouth, mouth centered on face axis), no teeth
- [x] Android foreground inside 66% safe zone
- [x] Splash content inside centered 60% safe zone, no spinner
- [ ] Display font for wordmark — splash v1 uses a system bold sans;
      swap to the chosen rounded display font in v2 (font not yet selected)

## Known v1 limits
- Character is the geometric placeholder Hoya, not illustrated art — by design it
  matches the in-app character until the illustrator sheet lands.
- Splash wordmark font is generic (DejaVu Sans Bold at render time).
