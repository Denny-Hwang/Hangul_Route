# F-COV-002 — Coverage Targets Drift Detector

**Status**: `shipped` (implemented in the same PR as this spec — T-021)
**Scope**: `scripts/` · `docs/tests/` · `.github/workflows/coverage-gate.yml`
**Owner**: solo dev

Parent docs: `docs/tests/coverage-targets.md` (human source of truth),
`docs/tests/coverage-targets.json` (machine mirror consumed by F-COV-001).

---

## 1. Context

F-COV-001 (`scripts/coverage-gate.mjs`) enforces the numbers in
`docs/tests/coverage-targets.json`. The human-readable rationale lives in
`docs/tests/coverage-targets.md`. Nothing kept the two in sync: a target could
be raised in the markdown during a planning pass and the JSON (the enforced
value) would silently stay stale — or vice versa.

F-COV-002 closes that gap: the markdown gains a machine-checked
**"Enforced W4 gate"** table that exactly mirrors the JSON, and a CI script
fails the Coverage Gate workflow whenever the two disagree.

## 2. Contract

`docs/tests/coverage-targets.md` MUST contain a section headed
`## Enforced W4 gate (machine-checked)` with a two-column table:

```
| Workspace | W4 gate (%) |
|---|---|
| packages/content-schema | 100 |
| ...                     | ... |
```

`scripts/check-coverage-targets-drift.mjs` parses that table and compares it
against `targets` in `docs/tests/coverage-targets.json`:

- **Missing section / unparsable table** → exit 1 (`::error::`).
- **Workspace present in one file but not the other** → exit 1.
- **Same workspace, different value** → exit 1, both values named.
- **Exact match (keys + values)** → exit 0.
- **Missing json or md file** → exit 1 (both are required repo files; there is
  no legitimate "not yet" state, unlike the content/token gates).

The aspirational per-lane table at the top of the markdown (business 90 /
platform 70 for `apps/mobile`, 6-month column) is *not* parsed — lane split
enforcement is F-COV-003 (T-022). Only the "Enforced W4 gate" section is the
mirror.

## 3. Tests

`scripts/__tests__/check-coverage-targets-drift.test.mjs` — Node built-in
`node:test`, `HANGUL_ROUTE_ROOT` env override, same harness as T-019:

- exact mirror → exit 0
- value mismatch → exit 1, names workspace + both values
- workspace only in md → exit 1
- workspace only in json → exit 1
- section heading missing from md → exit 1
- md file missing → exit 1
- real repo files (no env override) → exit 0 (guards the checked-in pair)

## 4. CI wiring

`.github/workflows/coverage-gate.yml` runs the script immediately after
checkout (built-ins only — no `pnpm install` needed), so drift fails fast
before the expensive coverage run.

## 5. Out of scope

- apps/mobile business/platform 2-lane split → F-COV-003 (T-022).
- Auto-fixing either file — the script only detects; humans reconcile.
