# radii v1

**Authoritative corner-radius scale for Hangul Route.** Mirrors `packages/design-system/src/tokens.ts` (`radii` export).
Drift detected by `.github/workflows/design-token-sync.yml`.

Last updated: 2026-05-19 · Version: v1

---

## Scale

Generous, paper-card feel. No sharp corners on touchables.

| Token | Value (dp/px) | Common use |
|---|---|---|
| `radii.none` | 0 | Reserved (rare — only for edge-to-edge images) |
| `radii.xs` | 4 | Tiny inline elements, slot bullets |
| `radii.sm` | 8 | Small chips, divider corners |
| `radii.md` | 12 | Compact cards, grid cells |
| `radii.lg` | 16 | Default Card / Tile / Screen children |
| `radii.xl` | 24 | Brand cards, HoyaBubble, modals |
| `radii.xxl` | 32 | Card-detail hero containers |
| `radii.pill` | 999 | Buttons, pills, progress bars |
| `radii.circle` | 9999 | Avatars, stage badges, dot progress |

---

## Rules

1. **No raw radius literals** — always reference `radii.<key>` from tokens.
2. **No sharp corners on touchables** — Buttons / Tiles / Cards must use ≥ `radii.md` (12).
3. **Buttons are always pills** — use `radii.pill` (999), never a specific radius.
4. **Avatars and badges are circles** — `radii.circle` (9999).
5. **Cards default to `radii.lg`** (16). Brand/hero cards bump to `radii.xl` (24) or `radii.xxl` (32).
6. **Modal containers** use `radii.xl` (24) minimum to differentiate from card.

## Promotion path

`design/tokens/radii.v1.md` → `packages/design-system/src/tokens.ts` (`radii` export) → components consume via `radii.<key>`.
