#!/usr/bin/env node
// F-COV-001 — Coverage Gate enforcement.
// Reads <workspace>/coverage/coverage-summary.json (vitest --coverage output)
// and compares each workspace's line-coverage % against the W4 target in
// docs/tests/coverage-targets.json. Exits non-zero if any workspace falls
// below its threshold.
//
// Source of truth: docs/tests/coverage-targets.md (human-readable),
// docs/tests/coverage-targets.json (machine-readable mirror).
// Drift between the two is detected by F-COV-002 (not yet implemented).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.HANGUL_ROUTE_ROOT
  ? resolve(process.env.HANGUL_ROUTE_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(ROOT, "docs", "tests", "coverage-targets.json");

if (!existsSync(CONFIG)) {
  console.log(`::error file=${CONFIG}::missing coverage targets config`);
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
const passes = [];
const skipped = [];
const failures = [];

for (const [pkgPath, threshold] of Object.entries(cfg.targets)) {
  const summaryPath = join(ROOT, pkgPath, "coverage", "coverage-summary.json");
  if (!existsSync(summaryPath)) {
    skipped.push({ pkgPath, reason: "no coverage/coverage-summary.json" });
    continue;
  }
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const linePct = summary.total?.lines?.pct;
  if (typeof linePct !== "number") {
    skipped.push({ pkgPath, reason: "coverage-summary.json missing total.lines.pct" });
    continue;
  }
  if (linePct < threshold) {
    failures.push({ pkgPath, threshold, actual: linePct });
  } else {
    passes.push({ pkgPath, threshold, actual: linePct });
  }
}

for (const p of passes) {
  console.log(
    `::notice file=${p.pkgPath}/coverage/coverage-summary.json::coverage ${p.actual}% ≥ ${p.threshold}% target`
  );
}
for (const s of skipped) {
  console.log(`::warning::${s.pkgPath} — skipped (${s.reason})`);
}
for (const f of failures) {
  console.log(
    `::error file=${f.pkgPath}/coverage/coverage-summary.json::coverage ${f.actual}% < ${f.threshold}% target (W4)`
  );
}

console.log("");
console.log(
  `Coverage gate (${cfg.rollingWindow}): ${passes.length} pass · ${skipped.length} skip · ${failures.length} fail`
);

if (failures.length > 0) process.exit(1);
