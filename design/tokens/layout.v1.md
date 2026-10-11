# layout v1

**Authoritative layout scale for Hangul Route.** Mirrors `packages/design-system/src/tokens.ts` (`layout` export, also part of the `tokens` aggregate). Behaviour lives in `packages/design-system/src/layout.ts` (`layoutClassFor`).
Drift detected by `.github/workflows/design-token-sync.yml` (the `layout` export must exist) and pinned value by value in `packages/design-system/src/__tests__/tokens-parity.test.ts`.

Spec: `docs/specs/F-LAYOUT-001-responsive-tablet-landscape.md` §3.1 · Wireframe: `design/wireframes/layout/wide.md`

Last updated: 2026-10-10 · Version: v1

Units are CSS px / dp. Every value is a plain number; where the code references `spacing`, the resolved number is listed and the source is named in the last column. Rows are `layout.<path>` so the parity test can compare them to the flattened export.

---

## Width classes

The class follows the **window** width, never the device: a resized desktop window, iPad Split View and 200 % browser zoom move between classes live. Boundaries are inclusive on the upper class (`width >= 600` is `regular`).

| Token | Value (px) | Meaning |
|---|---|---|
| `layout.breakpoint.regular` | 600 | window width at or above this is `regular` (below is `compact`) |
| `layout.breakpoint.wide` | 900 | window width at or above this is `wide` |
| `layout.shortHeight` | 480 | window height below this is `short` (any width) |

## Phone or tablet

`form` is `phone` when the short side is under `phoneShortSide` and the long side is at most `phoneMaxLongSide`; otherwise `tablet`. A 1100x500 desktop window is a tablet form, not a phone.

| Token | Value (px) | Meaning |
|---|---|---|
| `layout.phoneShortSide` | 600 | min(width, height) below this can be a phone |
| `layout.phoneMaxLongSide` | 1000 | ... only if max(width, height) is at most this |

## Side by side

| Token | Value (px) | Meaning |
|---|---|---|
| `layout.sideBySideMin` | 700 | landscape and window width at or above this: picture left, text right (F-STORY-002 §3.3), any height |

## Content width (cap inside `Screen`, never on `#root`)

| Token | Value (px) | Meaning |
|---|---|---|
| `layout.maxWidth.reading` | 720 | default `Screen width="reading"` |
| `layout.maxWidth.full` | 1120 | `Screen width="full"` (pane screens) |

`Screen width="bleed"` has no cap (presenter stage, full-screen art). Backgrounds stay full-bleed in every case.

## Gutter (screen edge padding per class)

| Token | Value (px) | Source |
|---|---|---|
| `layout.gutter.compact` | 16 | `spacing.lg` (today's screen edge padding) |
| `layout.gutter.regular` | 24 | `spacing.xl` |
| `layout.gutter.wide` | 32 | `spacing.xxl` |

## Panes (wide and not short)

| Token | Value (px) | Source |
|---|---|---|
| `layout.pane.master` | 400 | master pane width; the detail pane takes the rest |
| `layout.pane.gap` | 24 | `spacing.xl` |

## Media scale (media scales, text does not)

Hoya, tiles, card art, the Trace canvas and the PIN keys scale by `mediaScale` through `useMediaSize`. Type tokens and the 64 touch-target floor never change. A `short` window forces the scale to 1.

| Token | Value (x) | Meaning |
|---|---|---|
| `layout.mediaScale.compact` | 1 | phone portrait |
| `layout.mediaScale.regular` | 1.2 | tablet portrait, phone landscape |
| `layout.mediaScale.wide` | 1.4 | tablet landscape, desktop |

## Columns

| Token | Value | Meaning |
|---|---|---|
| `layout.columns.cards.compact` | 2 | Library gallery columns |
| `layout.columns.cards.regular` | 3 | Library gallery columns |
| `layout.columns.cards.wide` | 3 | Library gallery columns (inside the master pane) |
| `layout.columns.journeyCellMax` | 112 | largest Journey cell, px |

---

## Rules

1. **No raw breakpoints in screens.** Read `useLayoutClass()`; never `useWindowDimensions` directly (F-LAYOUT-001 §3.12).
2. **No raw window-derived sizes.** Scale media with `useMediaSize(base)`; never `* 1.4` in a screen.
3. **The 64 touch-target floor and the type tokens do not change with the class** (`touchTarget.min`, `typography.size.body`).
4. **Only these numbers.** A new breakpoint, cap or scale needs a spec change, this table and `tokens.ts` in the same PR.
5. **Breakpoints are runtime, not CSS.** The PWA shell reads nothing from this table; a `#root` max-width rule must never come back.

## Promotion path

`design/tokens/layout.v1.md` → `packages/design-system/src/tokens.ts` (`layout` export, in the `tokens` aggregate) → `layoutClassFor` / `useLayoutClass` / `useMediaSize` / `Screen` consume it.
