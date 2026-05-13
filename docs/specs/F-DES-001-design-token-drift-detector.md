# F-DES-001 — Design Token Drift Detector

**Status**: `ready`
**Scope**: Infra · CI · Design system
**Owner**: solo dev
**Rollout**: MVP (foundational)

---

## 1. Context

CLAUDE.md §5 declares "동기화는 CI": the parity between
`design/tokens/*.v*.md` (design source) and
`packages/design-system/src/tokens.ts` (code source) is supposed to be
guarded by `.github/workflows/design-token-sync.yml`. The shipped workflow
listed parity as a TODO and only verified that the file `tokens.ts`
exists — always true. The third no-op in the senior service review.

This spec turns the workflow into a structural-presence checker. For each
`<kind>.v<N>.md` found in `design/tokens/` (`kind ∈
colors | typography | spacing | radii | shadows`), `tokens.ts` MUST export
`<kind>` as a non-empty `{ ... } as const`. The check is "structural"
rather than "value-level": V1 detects "design declared colors but code
exports an empty object", not "design says #FF6B35 but code says #FF6B30".

Value-level drift is the natural follow-up (F-DES-002) once tokens.ts
actually has values to compare.

## 2. User story

> As a solo developer who manually promotes design tokens from the Friday
> design session into `tokens.ts`, I want CI to fail if I forgot to update
> the code side, so that design and implementation never silently diverge.

## 3. Acceptance criteria

- **Given** `design/tokens/` contains only `README.md` (no `<kind>.v<N>.md`
  files),
  **when** `node scripts/check-token-drift.mjs` runs,
  **then** it prints `::notice::no <kind>.v<N>.md files… no-op until W1
  tokens land` and exits `0`.

- **Given** `design/tokens/colors.v1.md` exists **and** `tokens.ts`
  contains `export const colors = {} as const;` (empty body),
  **when** the script runs,
  **then** it prints
  `::error::token drift — colors: ... body is empty` and exits `1`.

- **Given** `design/tokens/colors.v1.md` exists **and** `tokens.ts`
  contains a non-empty `export const colors = { brand: { … } } as const`
  block,
  **when** the script runs,
  **then** that kind is treated as in-sync (no annotation) and the script
  exits `0` if no other kinds fail.

- **Given** `tokens.ts` itself is missing,
  **when** the script runs,
  **then** it exits `1` with an `::error::` annotation.

- **Given** `design/tokens/` is missing entirely,
  **when** the script runs,
  **then** it exits `0` with a `::notice::` (nothing to compare against).

## 4. Out of scope

- **F-DES-002 — value-level parity**: parse each `<kind>.v<N>.md` table /
  YAML front-matter and compare individual values against the keys in
  `tokens.ts`. V1 only checks "non-empty" presence.
- **Versioning / promotion ceremony**: the rules around when v2 supersedes
  v1 are documented in `docs/workflows/design-to-code.md`; this script
  does not enforce them.
- **Non-token design artefacts** (Hoya poses, icons, illustrations) — out
  of scope; tracked separately under `design/characters/`,
  `design/icons/`, etc.

## 5. UI sketch

N/A — CI script.

## 6. Tests

- Script self-tests deferred (T-019). V1 verified by:
  - Empty state (only README in `design/tokens/`): script exits `0`
    (verified locally).
  - Negative state: `touch design/tokens/colors.v1.md` with current
    `tokens.ts` (empty `colors = {} as const`) — script exits `1` with
    `colors: body is empty`.
  - Positive state: same plus a non-empty body in `tokens.ts` — script
    exits `0`.

## 7. Rollout

MVP. Lands with the first wave of CI gate enforcement (T-006/007/008).
The gate is dormant until W1 design tokens are promoted to
`design/tokens/colors.v1.md` (Week 1 Friday roll-up), then activates
automatically.

## 8. Dependencies

- **Upstream**: design playbook `week-01/day-01-monday.md` …
  `day-05-friday.md` (produce the first `.v1.md` artefacts).
- **Downstream**:
  - F-DES-002 value-level parity.
  - F-DES-003 promotion ceremony enforcement.
- **External**: none.
