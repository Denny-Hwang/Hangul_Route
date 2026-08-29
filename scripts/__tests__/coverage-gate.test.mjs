// Self-tests for scripts/coverage-gate.mjs (F-COV-001 / T-019).
// Uses Node 20+ built-in test runner (`node --test`). No vitest dep so
// these tests survive a broken pnpm install.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "coverage-gate.mjs"
);

function run(rootDir) {
  return spawnSync("node", [SCRIPT], {
    env: { ...process.env, HANGUL_ROUTE_ROOT: rootDir },
    encoding: "utf8",
  });
}

function makeRoot() {
  return mkdtempSync(join(tmpdir(), "covgate-"));
}

function writeTargets(root, targets) {
  mkdirSync(join(root, "docs", "tests"), { recursive: true });
  writeFileSync(
    join(root, "docs", "tests", "coverage-targets.json"),
    JSON.stringify({ rollingWindow: "test", targets })
  );
}

function writeCoverage(root, pkgPath, linesPct) {
  mkdirSync(join(root, pkgPath, "coverage"), { recursive: true });
  writeFileSync(
    join(root, pkgPath, "coverage", "coverage-summary.json"),
    JSON.stringify({ total: { lines: { pct: linesPct } } })
  );
}

describe("coverage-gate.mjs", () => {
  test("missing config: exit 1 with explicit error", () => {
    const root = makeRoot();
    try {
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /missing coverage targets config/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("empty workspace: all skipped, exit 0", () => {
    const root = makeRoot();
    try {
      writeTargets(root, { "packages/foo": 80, "packages/bar": 90 });
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /0 pass · 2 skip · 0 fail/);
      assert.match(r.stdout, /no coverage\/coverage-summary\.json/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("above threshold: exit 0 with notice", () => {
    const root = makeRoot();
    try {
      writeTargets(root, { "packages/foo": 80 });
      writeCoverage(root, "packages/foo", 95);
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /1 pass · 0 skip · 0 fail/);
      assert.match(r.stdout, /95% ≥ 80%/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("at threshold exactly: exit 0", () => {
    const root = makeRoot();
    try {
      writeTargets(root, { "packages/foo": 80 });
      writeCoverage(root, "packages/foo", 80);
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /1 pass · 0 skip · 0 fail/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("below threshold: exit 1 with error annotation", () => {
    const root = makeRoot();
    try {
      writeTargets(root, { "packages/foo": 100 });
      writeCoverage(root, "packages/foo", 42.5);
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /0 pass · 0 skip · 1 fail/);
      assert.match(r.stdout, /42\.5% < 100%/);
      assert.match(r.stdout, /::error/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("mixed pass / skip / fail: exit 1, summary line accurate", () => {
    const root = makeRoot();
    try {
      writeTargets(root, {
        "packages/good": 80,
        "packages/bad": 90,
        "packages/missing": 70,
      });
      writeCoverage(root, "packages/good", 95);
      writeCoverage(root, "packages/bad", 60);
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /1 pass · 1 skip · 1 fail/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("malformed coverage-summary.json (missing total.lines.pct): skipped", () => {
    const root = makeRoot();
    try {
      writeTargets(root, { "packages/foo": 80 });
      mkdirSync(join(root, "packages/foo/coverage"), { recursive: true });
      writeFileSync(
        join(root, "packages/foo/coverage/coverage-summary.json"),
        JSON.stringify({ total: {} })
      );
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /missing total\.lines\.pct/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // --- F-COV-003 lane targets ----------------------------------------------

  function writeLaneCoverage(root, pkgPath, files) {
    // files: { "src/logic/a.ts": [total, covered], ... }
    mkdirSync(join(root, pkgPath, "coverage"), { recursive: true });
    const summary = { total: { lines: { pct: 0 } } };
    for (const [rel, [total, covered]] of Object.entries(files)) {
      summary[join(root, pkgPath, rel)] = { lines: { total, covered } };
    }
    writeFileSync(
      join(root, pkgPath, "coverage", "coverage-summary.json"),
      JSON.stringify(summary)
    );
  }

  test("lane targets: aggregates per-lane from the workspace summary", () => {
    const root = makeRoot();
    try {
      writeTargets(root, {
        "apps/mobile/src/logic": 90,
        "apps/mobile/src/platform": 70,
      });
      writeLaneCoverage(root, "apps/mobile", {
        "src/logic/score.ts": [100, 95],
        "src/logic/streak.ts": [50, 48],
        "src/platform/storage.ts": [40, 30],
      });
      const r = run(root);
      // logic: 143/150 = 95.33% ≥ 90 · platform: 30/40 = 75% ≥ 70
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /95\.33%.*lane apps\/mobile\/src\/logic.*≥ 90%/);
      assert.match(r.stdout, /75%.*lane apps\/mobile\/src\/platform.*≥ 70%/);
      assert.match(r.stdout, /2 pass · 0 skip · 0 fail/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("lane below its threshold fails while the sibling lane passes", () => {
    const root = makeRoot();
    try {
      writeTargets(root, {
        "apps/mobile/src/logic": 90,
        "apps/mobile/src/platform": 70,
      });
      writeLaneCoverage(root, "apps/mobile", {
        "src/logic/score.ts": [100, 95],
        "src/platform/storage.ts": [100, 50],
      });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /::error.*50%.*lane apps\/mobile\/src\/platform.*< 70%/);
      assert.match(r.stdout, /1 pass · 0 skip · 1 fail/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("lane with no matching files in the summary: skipped, not failed", () => {
    const root = makeRoot();
    try {
      writeTargets(root, { "apps/mobile/src/platform": 70 });
      writeLaneCoverage(root, "apps/mobile", {
        "src/logic/score.ts": [100, 95],
      });
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /no files under lane/);
      assert.match(r.stdout, /0 pass · 1 skip · 0 fail/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("lane prefix does not swallow sibling dirs sharing the prefix string", () => {
    const root = makeRoot();
    try {
      writeTargets(root, { "apps/mobile/src/logic": 90 });
      writeLaneCoverage(root, "apps/mobile", {
        "src/logic/score.ts": [100, 95],
        "src/logic-extra/other.ts": [100, 0],
      });
      const r = run(root);
      // logic-extra must NOT count into the logic lane: 95/100 = 95%
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /95%.*lane apps\/mobile\/src\/logic.*≥ 90%/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
