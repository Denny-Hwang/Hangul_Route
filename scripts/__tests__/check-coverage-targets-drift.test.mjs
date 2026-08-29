// Self-tests for scripts/check-coverage-targets-drift.mjs (F-COV-002 / T-021).

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
  "check-coverage-targets-drift.mjs"
);
const REPO_ROOT = resolve(dirname(SCRIPT), "..");

function run(rootDir) {
  return spawnSync("node", [SCRIPT], {
    env: rootDir
      ? { ...process.env, HANGUL_ROUTE_ROOT: rootDir }
      : { ...process.env, HANGUL_ROUTE_ROOT: REPO_ROOT },
    encoding: "utf8",
  });
}

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "covdrift-"));
  mkdirSync(join(root, "docs", "tests"), { recursive: true });
  return root;
}

function writeMd(root, rows) {
  const table = rows.map(([w, v]) => `| ${w} | ${v} |`).join("\n");
  writeFileSync(
    join(root, "docs", "tests", "coverage-targets.md"),
    [
      "# Coverage Targets",
      "",
      "## Enforced W4 gate (machine-checked)",
      "",
      "| Workspace | W4 gate (%) |",
      "|---|---|",
      table,
      "",
      "## Rolling 의미",
      "",
    ].join("\n")
  );
}

function writeJson(root, targets) {
  writeFileSync(
    join(root, "docs", "tests", "coverage-targets.json"),
    JSON.stringify({ rollingWindow: "W4 (alpha)", targets }, null, 2)
  );
}

describe("check-coverage-targets-drift.mjs", () => {
  test("exact mirror: exit 0", () => {
    const root = makeRoot();
    try {
      writeMd(root, [
        ["packages/content-schema", 100],
        ["apps/mobile", 80],
      ]);
      writeJson(root, { "packages/content-schema": 100, "apps/mobile": 80 });
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /drift check OK — 2 workspaces/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("value mismatch: exit 1 naming workspace and both values", () => {
    const root = makeRoot();
    try {
      writeMd(root, [["apps/mobile", 90]]);
      writeJson(root, { "apps/mobile": 80 });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /drift on "apps\/mobile": md says 90%, json says 80%/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("workspace only in md: exit 1", () => {
    const root = makeRoot();
    try {
      writeMd(root, [
        ["apps/mobile", 80],
        ["apps/web", 90],
      ]);
      writeJson(root, { "apps/mobile": 80 });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /"apps\/web" is in coverage-targets\.md but missing/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("workspace only in json: exit 1", () => {
    const root = makeRoot();
    try {
      writeMd(root, [["apps/mobile", 80]]);
      writeJson(root, { "apps/mobile": 80, "packages/backend": 90 });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(
        r.stdout,
        /"packages\/backend" is in coverage-targets\.json but missing/
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("section heading missing: exit 1", () => {
    const root = makeRoot();
    try {
      writeFileSync(
        join(root, "docs", "tests", "coverage-targets.md"),
        "# Coverage Targets\n\nno gate section here\n"
      );
      writeJson(root, { "apps/mobile": 80 });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /section "## Enforced W4 gate \(machine-checked\)" not found/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("md file missing: exit 1", () => {
    const root = makeRoot();
    try {
      writeJson(root, { "apps/mobile": 80 });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /coverage-targets\.md is missing/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checked-in repo files are mirror-consistent: exit 0", () => {
    const r = run(null);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /drift check OK/);
  });
});
