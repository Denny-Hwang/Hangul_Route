# F-COV-003 — apps/mobile Two-Lane Coverage Gate

**Status**: `shipped` (implemented in the same PR as this spec — T-022)
**Scope**: `scripts/coverage-gate.mjs` · `apps/mobile` vitest config · `docs/tests/`
**Owner**: solo dev

Parent docs: `docs/tests/coverage-targets.md` §"분리 규칙", CLAUDE.md §6.

---

## 1. Context

CLAUDE.md and `coverage-targets.md` have always specified split targets for
`apps/mobile` — business logic (`src/logic/`, 90%) vs platform-dependent
wrappers (`src/platform/`, 70%) — but the gate enforced a single blended 80%
workspace number, and `src/platform/` was not even instrumented. A coverage
collapse in the platform wrappers could hide behind strong logic coverage.

F-COV-003 makes the documented split real.

## 2. Contract

### 2.1 Lane targets in config

`docs/tests/coverage-targets.json` `targets` keys may point **inside** a
workspace: `"apps/mobile/src/logic": 90`, `"apps/mobile/src/platform": 70`.
The flat-key shape is unchanged, so the F-COV-002 drift mirror needs no new
syntax — the markdown table simply carries the lane rows.

### 2.2 Gate resolution (`scripts/coverage-gate.mjs`)

For each target key:
1. Walk up from the key path to the nearest `coverage/coverage-summary.json`.
2. If the summary sits at the key path itself → use `total.lines.pct`
   (unchanged workspace behavior).
3. Otherwise (lane key) → aggregate `lines.total` / `lines.covered` across
   the summary's per-file entries whose paths fall under the lane directory
   (path-segment prefix match — `src/logic-extra` never counts into
   `src/logic`), and compute the lane percentage (2 decimals).
4. A lane with no matching files → **skip** with a warning, same posture as
   a missing workspace report.

### 2.3 Instrumentation (`apps/mobile/vitest.config.ts`)

`coverage.include` covers both `src/logic/**/*.ts` and `src/platform/**/*.ts`.
Exclusions (documented in the config and `coverage-targets.md`):
- `src/logic/minigame-config.ts` — pure data registry.
- `src/platform/motion.ts` — a React hook over `AccessibilityInfo` events;
  needs a renderer harness, covered by Detox nightly instead.

### 2.4 Platform lane tests

`src/platform/__tests__/`: storage / haptics / audio / sharing wrappers unit
tested with mocked expo modules (no native or network access), joining the
existing telemetry tests. Measured at ship time: logic lane 97.28% ≥ 90,
platform lane 100% (lines) ≥ 70.

## 3. Tests

`scripts/__tests__/coverage-gate.test.mjs` gains 4 lane cases (node:test,
`HANGUL_ROUTE_ROOT` harness): both lanes pass with correct aggregation ·
one lane fails independently · empty lane skips · prefix does not swallow
sibling dirs. Existing 7 workspace cases unchanged.

## 4. Out of scope

- Per-lane targets for other workspaces (none documented yet).
- `src/store/` zustand stores — tested but not lane-gated; they fold into a
  future lane once `coverage-targets.md` assigns one.
- Detox nightly wiring for `motion.ts` / RN components.
