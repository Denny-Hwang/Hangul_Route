# F-VR-001 — Visual Regression Surface (pragmatic)

**Status**: `ready`
**Scope**: `apps/web` · `/design-preview/components` · `/design-preview/cards` · MVP polish
**Owner**: solo dev
**Rollout**: MVP

---

## 1. Context

A solo dev project doesn't have the bandwidth to operate Storybook + Chromatic + screenshot-diff infrastructure (~3 days setup + per-PR maintenance). But it DOES need a way to catch visual regressions before they ship.

**Pragmatic alternative**: extend `/design-preview` (PR #15) into a multi-page **manual visual regression surface**:

- `/design-preview` — token palettes, type scale, spacing, primitives (existing)
- `/design-preview/components` — every component × every variant on a single scrollable page (NEW)
- `/design-preview/cards` — all 30 Heritage cards in a grid (NEW)

After every PR that touches `packages/design-system` or content, the maintainer opens `/design-preview/{components,cards}` and visually scans for unexpected changes. Cloudflare Pages preview deploys each PR's version, so before/after comparison is a tab-switch away.

**Why not full Storybook**: heavy install, RN incompatibility (separate `@storybook/react-native` toolchain), per-component story files to maintain. Pragmatic surface gives 80% of the value at 5% of the cost. **Full Storybook can ship later** as F-VR-002 if visual regression bites us.

## 2. User story

> As **a solo dev**, I want to open one URL after every design-touching PR to scan for unexpected visual changes, so that I catch regressions before merge without paying the Storybook setup tax.

Companion stories:

- As **a designer reviewing a PR**, I want to compare the Cloudflare Pages preview URL of the PR to the production URL side-by-side, scrolling the same page.
- As **a future contributor**, I want one place to find every component variant rendered with its name so I learn the system without spelunking.

## 3. Acceptance criteria

### 3.1 `/design-preview/components`

A new Next.js route that renders **every component × every variant** in a single long scrollable page:

- Button: 5 tones × 4 sizes × 3 states (default / pressed / disabled) = 60 cells
- Card: 5 tones × 3 elevations × 4 padding = 60 cells
- Tile: 4 states × 3 sizes × 4 sample jamo = 48 cells
- HoyaBubble: 3 tones × 2 content variants (English only / English + Korean) = 6 cells
- Progress: bar / dots × 3 tones × 4 fill levels = 24 cells
- StarRow: 4 tiers × 4 sizes = 16 cells
- Pill: 6 tones × 2 sizes = 12 cells
- Heading / Body / Caption: full type scale per tone (already in `/design-preview`)
- Hoya: 5 poses × 2 sizes = 10 cells
- Icon: all 19 glyphs × 3 sizes = 57 cells

Each cell is labeled with its variant name (e.g., `primary / hero / pressed`) so the diff is obvious.

### 3.2 `/design-preview/cards`

A new Next.js route showing **all 30 Heritage card art** in a 4-column grid:

- Each card rendered at 160 × 160 inline SVG
- Below: Korean / romanization / English title / rarity pill
- Grouped by theme (5 sections: Letters / Life / Rites / Nature / Crafts)
- All 6 themes from `supportedCardIds` rendered (was 6 of 30 previously)

### 3.3 Navigation between preview pages

- `/design-preview` adds a top-of-page nav: links to `/design-preview/components` and `/design-preview/cards`
- All three pages have a "← back to design preview" link

### 3.4 Static rendering

- All three pages are server-rendered statically (`○ (Static)` in Next.js output) — no client interactivity.
- Build time should not measurably increase beyond ~1s.

### 3.5 Token-only

Same rule as F-PREV-001: import only `@hangul-route/design-system/tokens`. No RN component imports.

The new component / card cells are HTML/CSS re-implementations using the same token values — honest mirror of what RN renders.

### 3.6 Cloudflare Pages preview

- The existing Cloudflare Pages preview workflow already deploys every PR. After this PR lands, the preview URL has 3 design-preview pages reviewers can open.

## 4. Out of scope

- **Full Storybook setup** (RN or web) — F-VR-002 if needed later.
- **Automated screenshot diff** — F-VR-003 if needed later. The OS / Cloudflare Pages preview combination is sufficient for manual diff.
- **Interactive controls** (knobs / args) — pages are static.
- **Per-component permalink anchors** — section IDs only.
- **Visual diff with overlay** — out of scope; reviewer uses tab-switch or PR preview Cloudflare's diff feature.

## 5. UI sketch

```
┌─ /design-preview ────────────────────┐
│ [→ components] [→ cards]              │
│ Brand palette                         │
│ Surface palette                       │
│ Feedback                              │
│ ...                                   │
└──────────────────────────────────────┘

┌─ /design-preview/components ─────────┐
│ [← back to design preview]            │
│                                       │
│ ## Button                             │
│ [60-cell matrix]                      │
│                                       │
│ ## Card                               │
│ [60-cell matrix]                      │
│                                       │
│ ...                                   │
└──────────────────────────────────────┘

┌─ /design-preview/cards ──────────────┐
│ [← back to design preview]            │
│ All 30 Heritage cards                  │
│                                       │
│ ## Letters                            │
│ [4-column card grid]                  │
│                                       │
│ ## Life                               │
│ [4-column card grid]                  │
│                                       │
│ ...                                   │
└──────────────────────────────────────┘
```

## 6. Tests

- Manual: `pnpm --filter @hangul-route/web build` succeeds with 8 routes
  (was 6 → adds 2 new pages)
- Manual: open each of 3 preview pages, verify all cells render
- Typecheck: 8 packages clean
- CI: existing `lint·typecheck·test·build` + Coverage + Cloudflare Pages preview

## 7. Rollout

- Ships immediately. Internal-facing surface only (not linked from main site nav).

## 8. Dependencies

### Upstream (must ship — all done)

- F-PREV-001 `/design-preview` route (✅ PR #15).
- F-CARD-001 all 30 cards (✅ PRs #17, #18).
- Tokens v1 (✅ PR #15).

### Downstream

- F-VR-002 Full Storybook (if manual surface proves insufficient).
- F-VR-003 Automated screenshot diff (Percy / Chromatic / Argos).

### External

- `next` 14 App Router server components only.
