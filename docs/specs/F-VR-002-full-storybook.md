# F-VR-002 — Full Storybook (deferred)

**Status**: `draft` — implementation **deferred** pending team-size + visual-regression-pain triggers (see §7 Ship-when).
**Scope**: `apps/web` (Storybook for web component mirrors) and/or `apps/mobile` (`@storybook/react-native`)
**Owner**: solo dev
**Rollout**: post-MVP — only when current pragmatic surface (F-VR-001) stops catching regressions

---

## 1. Context

PR #24 shipped F-VR-001 — a pragmatic manual-visual-regression surface at `/design-preview/components` + `/design-preview/cards`. The maintainer opens those URLs on a PR's Cloudflare Pages preview and on production, then scroll-diffs in two tabs.

**This works for one maintainer.** It does NOT scale to:
- Multiple contributors landing visual changes in parallel
- Automated CI rejection of regressions
- Per-component story isolation (interactive knobs)

F-VR-002 ships **full Storybook** when that scale is needed.

## 2. User story (when triggered)

> As **a second contributor** modifying a component, I want my PR to fail CI if my change unintentionally altered a different variant — so I don't have to scroll-diff every section of `/design-preview` to find out.

## 3. Acceptance criteria (when implemented)

### 3.1 Storybook setup

- Choose between:
  - **Web-first**: `@storybook/nextjs` (8.x). Stories live in `apps/web/.storybook/` + per-component `*.stories.tsx`. Renders the same inline-SVG HTML re-implementations that `/design-preview` already uses.
  - **Mobile-first**: `@storybook/react-native` (7.x). Stories live in `apps/mobile/storybook/`. Renders the actual RN components.
  - **Both**: separate configurations, separate scripts. Most maintenance, most coverage.

  v2 recommendation: **web-first only**, since:
  - Web stories run in CI without simulators
  - The web mirrors already cover the visual contract
  - Mobile-specific RN behavior is caught by Detox (F-DETOX-001) instead

### 3.2 Story coverage

- Every component in `packages/design-system/src/components/` gets at least one story: `Default.stories.tsx`
- Components with variants (Button, Card, Tile, Pill, HoyaBubble, Hoya) get `Variants.stories.tsx` enumerating the matrix
- HeritageCardArt gets `AllCards.stories.tsx` with all 30 cards

### 3.3 Scripts

- `pnpm --filter @hangul-route/web storybook` — local dev server
- `pnpm --filter @hangul-route/web build-storybook` — static build output
- New CI workflow `.github/workflows/storybook-build.yml` — verifies the static build compiles on every PR (no diff yet — that's F-VR-003)

### 3.4 Coexistence with /design-preview

- `/design-preview` STAYS. It's a long-scroll surface; Storybook is per-component isolation. Both are useful.
- The `design-preview/{components,cards}` pages remain the canonical "manual diff" target.

## 4. Out of scope

- **Visual diff automation** — that's F-VR-003 (Percy/Chromatic/Argos).
- **Mobile-side Storybook** — deferred; web stories cover the contract.
- **Story-level interactive controls** — opinionated; can add `addon-controls` after baseline works.
- **Story authoring tutorial** — kept internal until contributor #2 lands.

## 5. Cost estimate

- Dev time: 1-2 days for web-first Storybook setup + 12 component stories.
- Bundle/dep impact: Storybook adds ~150MB to `apps/web/node_modules`. Build time +30s.
- CI minutes: +1-2 min per PR for `build-storybook` job.
- Maintenance: per-component stories must be kept in sync; ~10 min per new variant.

## 6. Risks

- Storybook 8 + Next.js 14 had compat issues at v1 release; pin to latest patch.
- RN-side Storybook (if chosen) needs separate Metro config; can break Expo Go.
- Visual diff alone (without snapshot tooling) is just a renderer; the value comes only when paired with F-VR-003.

## 7. Ship-when triggers

Implement F-VR-002 when **any** of these is true:

1. **Second active contributor lands** in `packages/design-system` or `apps/mobile/src/screens/` (regular cadence). Two-person teams need automated checks.
2. **A visual regression slips to production** that was visible in `/design-preview` but missed by manual scan. One incident = ship F-VR-002.
3. **Component count exceeds 25** (currently 12). Long-scroll surface becomes unwieldy.
4. **A designer joins the team** who expects Storybook as a deliverable.

Until then, the manual surface is **explicitly the chosen tradeoff** — not technical debt.

## 8. Dependencies

Upstream: F-VR-001 (✅ PR #24). `apps/web` Next.js 14 (✅ PR #13).
Downstream: F-VR-003 (Percy/Chromatic).
External: `storybook`, `@storybook/nextjs`, `@storybook/react`, `@storybook/addon-essentials`.
