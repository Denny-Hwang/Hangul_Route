#!/usr/bin/env node
// F-COV-001 — Coverage Gate enforcement.
// Reads <workspace>/coverage/coverage-summary.json (vitest --coverage output)
// and compares each workspace's line-coverage % against the W4 target in
// docs/tests/coverage-targets.json. Exits non-zero if any workspace falls
// below its threshold.
//
// Source of truth: docs/tests/coverage-targets.md (human-readable),
// docs/tests/coverage-targets.json (machine-readable mirror).
// Drift between the two is detected by check-coverage-targets-drift.mjs
// (F-COV-002).
//
// Lane targets (F-COV-003): a target key may point INSIDE a workspace
// (e.g. "apps/mobile/src/logic"). The gate then walks up to the nearest
// coverage/coverage-summary.json and aggregates line coverage over just the
// files under that lane path.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
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

// Walk up from pkgPath to the nearest dir carrying coverage-summary.json.
function findSummary(pkgPath) {
  let dir = pkgPath;
  for (;;) {
    const p = join(ROOT, dir, "coverage", "coverage-summary.json");
    if (existsSync(p)) return { summaryPath: p, baseDir: dir };
    const parent = dirname(dir);
    if (parent === dir || parent === ".") return null;
    dir = parent;
  }
}

// Aggregate line coverage across the per-file entries under lanePrefix.
function lanePct(summary, lanePrefix) {
  let total = 0;
  let covered = 0;
  for (const [file, metrics] of Object.entries(summary)) {
    if (file === "total") continue;
    if (!file.startsWith(lanePrefix + sep) && file !== lanePrefix) continue;
    if (typeof metrics?.lines?.total !== "number") continue;
    total += metrics.lines.total;
    covered += metrics.lines.covered;
  }
  if (total === 0) return null;
  return Math.round((covered / total) * 10000) / 100;
}

for (const [pkgPath, threshold] of Object.entries(cfg.targets)) {
  const found = findSummary(pkgPath);
  if (!found) {
    skipped.push({ pkgPath, reason: "no coverage/coverage-summary.json" });
    continue;
  }
  const { summaryPath, baseDir } = found;
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  let linePct;
  if (baseDir === pkgPath) {
    linePct = summary.total?.lines?.pct;
  } else {
    linePct = lanePct(summary, join(ROOT, pkgPath));
    if (linePct === null) {
      skipped.push({
        pkgPath,
        reason: `no files under lane in ${baseDir}/coverage/coverage-summary.json`,
      });
      continue;
    }
  }
  if (typeof linePct !== "number") {
    skipped.push({ pkgPath, reason: "coverage-summary.json missing total.lines.pct" });
    continue;
  }
  const summaryRel = `${baseDir}/coverage/coverage-summary.json`;
  const label = baseDir === pkgPath ? "" : ` (lane ${pkgPath})`;
  if (linePct < threshold) {
    failures.push({ pkgPath, threshold, actual: linePct, summaryRel, label });
  } else {
    passes.push({ pkgPath, threshold, actual: linePct, summaryRel, label });
  }
}

for (const p of passes) {
  console.log(
    `::notice file=${p.summaryRel}::coverage ${p.actual}%${p.label} ≥ ${p.threshold}% target`
  );
}
for (const s of skipped) {
  console.log(`::warning::${s.pkgPath} — skipped (${s.reason})`);
}
for (const f of failures) {
  console.log(
    `::error file=${f.summaryRel}::coverage ${f.actual}%${f.label} < ${f.threshold}% target (W4)`
  );
}

console.log("");
console.log(
  `Coverage gate (${cfg.rollingWindow}): ${passes.length} pass · ${skipped.length} skip · ${failures.length} fail`
);

if (failures.length > 0) process.exit(1);
