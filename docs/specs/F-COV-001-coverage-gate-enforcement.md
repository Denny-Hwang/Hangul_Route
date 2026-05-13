# F-COV-001 — Coverage Gate Enforcement

**Status**: `ready`
**Scope**: Infra · CI
**Owner**: solo dev
**Rollout**: MVP (foundational)

---

## 1. Context

`.github/workflows/coverage-gate.yml` was a documented no-op: a TODO comment
where the enforcement script was meant to land (`// TODO(F-COV-001): parse
coverage-summary.json…`). Any PR could lower coverage without consequence —
one of the three "CI gate is a lie" risks called out in the senior service
review.

This spec closes the gate: a tiny Node script reads each workspace's
vitest-generated `coverage-summary.json` and compares against the W4 column
in `docs/tests/coverage-targets.md` (mirrored in
`docs/tests/coverage-targets.json` for machine consumption). If any
workspace falls below its threshold, the workflow fails.

The gate is intentionally permissive in **scope** (only workspaces that
actually produce a coverage report are checked) but strict in **value**
(when a report exists, the threshold is enforced literally). This means
adding a test runner to a new package immediately puts that package under
the gate, while pre-test packages are not blocked.

## 2. User story

> As a solo developer, I want the coverage gate to actually fail PRs that
> drop a package below its W4 target, so that `coverage-targets.md` is a
> contract instead of a wishlist.

## 3. Acceptance criteria

- **Given** `docs/tests/coverage-targets.json` declares
  `"packages/content-schema": 100`,
  **when** `packages/content-schema/coverage/coverage-summary.json` reports
  `total.lines.pct = 100`,
  **then** `node scripts/coverage-gate.mjs` prints a `::notice::` and exits
  `0`.

- **Given** the same config,
  **when** a workspace's `coverage-summary.json` reports
  `total.lines.pct = 78`,
  **then** the script prints a `::error::` GitHub annotation pointing at the
  summary file and exits `1`.

- **Given** no `coverage/coverage-summary.json` exists for a workspace
  (e.g. `packages/design-system` before tests land),
  **when** the script runs,
  **then** that workspace is reported as `::warning::… skipped (no
  coverage/coverage-summary.json)` and **does not** fail the gate.

- **Given** `docs/tests/coverage-targets.json` is missing or malformed,
  **when** the script runs,
  **then** it exits `1` with an `::error::` annotation pointing at the
  config path.

## 4. Out of scope

- **F-COV-002 — Markdown ↔ JSON drift detector** for `coverage-targets.md`
  vs `coverage-targets.json`. Until then the two are kept in sync by hand
  (PR template will gain a checkbox).
- **F-COV-003 — apps/mobile business-vs-platform split.** The markdown
  prescribes splitting `src/logic/` and `src/platform/` into separate
  coverage lanes; this spec treats `apps/mobile` as a single lane (80 %)
  until apps/mobile has any source code to split.
- **Coverage instrumentation install** (`@vitest/coverage-v8`). Tracked as
  T-020 — when it lands, the gate starts measuring real numbers instead
  of skipping every package.
- **Per-file coverage thresholds** — only workspace-aggregate `lines.pct`
  is gated in V1.

## 5. UI sketch

N/A — CI script.

## 6. Tests

- Script self-tests are deferred (T-019). For V1, behaviour is validated
  by inspection:
  - Empty state: script exits `0` with all-skip output (verified locally
    `node scripts/coverage-gate.mjs` → "0 pass · 6 skip · 0 fail").
  - Negative state: dropping a hand-crafted `coverage-summary.json`
    reporting `lines.pct = 50` into any threshold-bearing workspace
    causes exit `1`.

## 7. Rollout

MVP. Lands with the first wave of CI gate enforcement (T-006/007/008).

## 8. Dependencies

- **Upstream**: `vitest.workspace.ts` (PR #8), `docs/tests/coverage-targets.md`
  (already in main).
- **Downstream**:
  - T-020 install `@vitest/coverage-v8` so the gate actually receives data.
  - F-COV-002 markdown/json drift detector.
  - F-COV-003 mobile split.
- **External**: none.
