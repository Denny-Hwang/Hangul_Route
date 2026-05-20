# F-PREV-001 — Design Preview Surface

**Status**: `shipped` (back-fill — landed in PR #15, this spec written 2026-05-21)
**Scope**: `apps/web` · MVP
**Owner**: solo dev
**Rollout**: MVP — design system validation surface for non-mobile reviewers

---

## 1. Context

The Hangul Route design system is built primarily for React Native (`apps/mobile`). Designers, parents, and reviewers without an Expo build environment cannot easily QA the system. `/design-preview` is a server-rendered Next.js page that reconstructs every visual primitive in plain HTML/CSS from the same JS token objects (`@hangul-route/design-system/tokens`).

Goal: one URL that any reviewer can open in a browser to see the entire design system render.

Implemented in PR #15 (`design(tokens,web): activate token drift gate + add /design-preview route`) and extended in PR #17 / PR #18 to include Heritage Card art samples.

## 2. User story

> As **a designer or parent reviewer** without a mobile dev environment, I want a single URL where I can see every color swatch, type size, spacing token, and component variant — rendered live from production tokens — so that I can validate the design system without installing Expo.

Companion stories:

- As **a developer**, I want a quick visual smoke test after changing `tokens.ts` — open `/design-preview` and look at the swatch grid.
- As **the design-token-sync CI gate**, I want a public artifact to validate against — if `/design-preview` renders, the tokens at least parse.

## 3. Acceptance criteria

### 3.1 Coverage

`/design-preview` must render sections for:

1. **Brand palette** — 6 swatches (primary / primaryDark / primaryLight / secondary / secondaryDark / secondaryLight)
2. **Surface palette** — 3 hanji swatches (canvas / paper / sunken)
3. **Text palette** — 4 (primary / secondary / muted / inverse)
4. **Feedback palette** — 8 (success / nudge / info / danger × light variants — danger flagged as RESERVED)
5. **Stage axis** — 7 stage tints
6. **Theme axis** — 5 culture-theme tints
7. **Hoya character palette** — 6 (fur / furDark / stripes / belly / cheek / nose)
8. **Rarity palette** — 4 (common / uncommon / rare / legendary)
9. **Typography scale** — 8 sizes (caption through hero), each rendered in English + Korean
10. **Spacing scale** — 9 sizes (xxs through jumbo), each shown as a visible bar
11. **Touch targets** — 3 sizes (min 64 / child 80 / hero 96) with dp labels
12. **Radii** — 8 (xs through circle), each shown as a geometric demo
13. **Shadows** — 3 elevations (card / raised / modal) with recipe captions
14. **Motion durations** — 6 (instant through celebration) with ms labels
15. **Z-layers** — 7 (base through hoyaBubble) as code-formatted text
16. **Buttons** — 5 tones × 4 sizes matrix
17. **Cards** — 5 tones × 3 elevations matrix
18. **Pills** — 6 tones with real app labels
19. **Tiles** — 4 states × 4 jamo grid
20. **Hoya placeholder** — 5 poses inline SVG
21. **Heritage Card art** — 6 sample cards (Tiger / Book / Kimchi / Seollal / Mountain / Yutnori)

### 3.2 Token-only rendering

The page must import **only token objects** from `@hangul-route/design-system/tokens`. No React Native component imports (RN components don't render in Next.js without `react-native-web`, which adds substantial config burden).

All visual primitives — buttons, cards, pills, tiles, Hoya, card art — are re-implemented as plain HTML/CSS using the same token values. The shapes are intentionally identical to the RN versions so `/design-preview` honestly previews what `apps/mobile` renders.

### 3.3 Routing

- Path: `/design-preview`
- Method: GET (server-rendered, no client interactivity needed)
- Prerendered at build time (`○ (Static)` in Next.js output)
- Linked from `/` landing page or accessed directly

### 3.4 Build

- Builds in `next build` without errors.
- Page size budget: ≤ 200 B page-specific + ~96 kB shared First Load JS (Next.js framework baseline).

## 4. Out of scope

- **Client-side interactivity** — page is fully static; tapping a button does nothing.
- **Pose / state animation** — all primitives shown in default state. Press / hover states deferred.
- **All 30 Heritage cards in the mirror** — only the original 6 samples are mirrored; the full 30 are visible only in `apps/mobile` Library tab. Future PR can extend if `/design-preview` becomes public.
- **Multilingual UI** — English only; Korean appears in scale-demo strings.
- **Accessibility deep audit** — page is for designer review, not end-user consumption. Basic semantic HTML used; full a11y audit deferred.
- **Automated visual regression** — manual review only; F-VR-001 will eventually capture snapshots.

## 5. UI sketch

Sections rendered top-to-bottom with hanji-cream canvas background. Each section has a sticky `id` anchor for deep-linking. Layout responsive: swatch grids use `auto-fill, minmax(160px, 1fr)` so the page scales to mobile / tablet / desktop.

## 6. Tests

- **Build verification** — `pnpm --filter @hangul-route/web build` must succeed (CI gate: lint·typecheck·test·build).
- **Token import sanity** (✅ PR #15) — 10 vitest tests in `packages/design-system/src/__tests__/tokens.test.ts` verify the token objects exist and have correct structure. If those tests pass, `/design-preview` will at minimum render without errors.
- **Manual designer review** — open the URL, scroll, sign off.

## 7. Rollout

- **PR #15**: initial 17 sections (everything except Heritage Card art).
- **PR #17**: added "Heritage Card art (6 of 30)" section.
- **PR #18**: kept the 6 sample mirrors; updated section subtitle to note the full 30 ship in mobile.
- Future enhancement: extend mirror to all 30 cards if `/design-preview` becomes a public design-review surface for parents.

## 8. Dependencies

### Upstream (must ship first — all done)

- `tokens.ts` v1 with real values (✅ PR #15).
- `design/tokens/*.v1.md` token spec markdowns (✅ PR #15) — activate drift gate so tokens.ts can't silently change.
- Next.js 14 App Router scaffolding (✅ PR #13).

### Downstream

- Visual regression coverage (F-VR-001).
- Public design-review URL if Cloudflare Pages preview gets a stable domain.

### External

- `next` 14.2 — App Router server components.
- `@hangul-route/design-system/tokens` — single import surface; never RN components.
