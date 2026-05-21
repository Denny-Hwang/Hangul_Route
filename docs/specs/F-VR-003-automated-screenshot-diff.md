# F-VR-003 — Automated Screenshot Diff (deferred)

**Status**: `draft` — implementation **deferred** until F-VR-002 ships AND budget/account for diff service is approved
**Scope**: `.github/workflows/` · Storybook stories from F-VR-002 · CI integration
**Owner**: solo dev
**Rollout**: post-MVP — pairs with F-VR-002 when team size or regression frequency demands it

---

## 1. Context

F-VR-002 ships Storybook (per-component story isolation). F-VR-003 wires Storybook outputs to a **screenshot diff service** so every PR gets an automated visual-regression report. The maintainer no longer scrolls — the bot does.

Service options:

| Service | Cost | Tradeoffs |
|---|---|---|
| **Chromatic** | Free 5000 snapshots/mo, paid above | Industry standard, tight Storybook integration, hosted UI |
| **Percy** (BrowserStack) | Free for open-source, paid for private | Same idea, different UI |
| **Argos** | Free 5000 builds/mo (OSS), paid above | Open-source alternative, GitHub-native, no separate dashboard |
| **DIY** (puppeteer + pixelmatch + Cloudflare) | Free | Most work, no hosted UI |

v3 recommendation: **Argos** — free for OSS, GitHub-native, minimal setup.

## 2. User story (when triggered)

> As **the maintainer** reviewing a PR that touched `packages/design-system`, I want a comment on the PR with side-by-side screenshots of every changed variant — pre vs post — so I approve in 30 seconds, not 5 minutes of scrolling.

## 3. Acceptance criteria (when implemented)

### 3.1 Workflow

- New `.github/workflows/visual-regression.yml`:
  1. Triggers on every PR
  2. Builds Storybook (depends on F-VR-002)
  3. Uses `argos-cli` to upload story snapshots
  4. Argos compares against the baseline (main branch's last successful build)
  5. PR comment lists changed variants with image diffs

### 3.2 Baseline strategy

- Baseline is taken automatically when a PR merges to `main`.
- New variants (added components / new stories) are auto-approved into the baseline; they don't fail the PR.
- Removed variants are flagged as informational, not failing.

### 3.3 Failure handling

- "Status: pending review" comment on PR if any visual diff > threshold (e.g., 0.5% pixel change).
- Reviewer can approve specific diffs in the Argos UI; that approval auto-updates the PR status to passing.
- No diff = green CI check.

### 3.4 Scope

- Web Storybook stories only (per F-VR-002 web-first decision).
- Mobile screens NOT covered (Detox handles RN-specific behavior).
- Heritage card art is covered automatically via the `AllCards` story.

### 3.5 Secrets

- `ARGOS_TOKEN` (or `CHROMATIC_PROJECT_TOKEN` if Chromatic chosen) stored as a GitHub Actions secret.
- Document key creation flow in `docs/workflows/visual-regression.md` when implemented.

## 4. Out of scope

- **Mobile screenshot diffing** — Detox `screen.matchSnapshot()` future spec.
- **Cross-browser diffing** (Chrome vs Firefox vs Safari) — single-browser snapshots sufficient.
- **Accessibility-only diffing** — separate accessibility audit tool.
- **Self-hosting** the diff service — pay-as-you-go is cheaper for one-maintainer cadence.

## 5. Cost estimate (Argos free tier)

- 5000 builds/mo free; ~30 stories × ~50 PRs/mo = 1500 snapshots/mo. Well within free.
- Dev time: 1 day for workflow + Argos token setup.
- CI minute impact: +2-3 min per PR (Storybook build + screenshot upload).

## 6. Ship-when triggers

Implement F-VR-003 when **all** are true:

1. **F-VR-002 has shipped** (Storybook stories exist).
2. **Team size or PR cadence** justifies automation (currently solo + ~5 PRs/wk — manual scan is faster).
3. **A regression has bypassed manual review** at least once.

## 7. Dependencies

Upstream: F-VR-002.
Downstream: Detox screenshot tests (mobile-side counterpart).
External: `@argos-ci/cli`, GitHub Actions secret for the token.

## 8. Non-decision: do NOT ship without F-VR-002

Visual diff without Storybook is wasted infrastructure. Both ship together, in order. If F-VR-002 stays deferred, F-VR-003 stays deferred.
