# spacing v1

**Authoritative spacing scale for Hangul Route.** Mirrors `packages/design-system/src/tokens.ts` (`spacing` export).
Drift detected by `.github/workflows/design-token-sync.yml`.

Last updated: 2026-05-19 · Version: v1

---

## Scale

4pt sub-grid for fine spacing, 8pt grid for layout-level spacing.

| Token | Value (dp/px) | Common use |
|---|---|---|
| `spacing.none` | 0 | No spacing |
| `spacing.xxs` | 2 | Hairline gaps, inline accents |
| `spacing.xs` | 4 | Tight stacks, label-to-input gap |
| `spacing.sm` | 8 | Default chip padding, inline gaps |
| `spacing.md` | 12 | Default card inner padding |
| `spacing.lg` | 16 | Default screen edge padding |
| `spacing.xl` | 24 | Section gaps, button horizontal padding |
| `spacing.xxl` | 32 | Major section gaps |
| `spacing.xxxl` | 48 | Hero spacing |
| `spacing.jumbo` | 64 | Landing page spacing, hero-to-CTA gaps |

## Touch targets

Separate token family — used for tappable surface minimums. Ages 5–11 require more generous targets than adults.

| Token | Value (dp) | Use |
|---|---|---|
| `touchTarget.min` | 64 | CLAUDE.md floor — secondary actions |
| `touchTarget.child` | 80 | Primary actions, profile avatars (children 5–7 motor calibration) |
| `touchTarget.hero` | 96 | Jamo tiles, big "Start" CTAs |

Inter-tile spacing: minimum 8dp (`spacing.sm`), prefer 12dp (`spacing.md`).

---

## Rules

1. **No raw spacing literals** — always reference `spacing.<key>` from tokens.
2. **No fractional values** — every spacing is one of the 10 tokens above.
3. **No values outside the scale** — adding a new size requires CLAUDE.md amendment + token update + design brief audit.
4. **Inter-tile spacing ≥ 8dp** — minigame tiles must respect this (F-001 §3.4 a11y).
5. **Screen edge padding** = `spacing.lg` (16) default. Override only for full-bleed surfaces (hero illustrations).

## Promotion path

`design/tokens/spacing.v1.md` → `packages/design-system/src/tokens.ts` (`spacing` + `touchTarget` exports) → components consume via `spacing.<key>` / `touchTarget.<key>`.
