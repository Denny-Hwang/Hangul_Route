// Self-tests for scripts/check-migrations.mjs (F-ROUTE-001 R-0, erratum E-1).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "check-migrations.mjs");
const REPO_ROOT = resolve(dirname(SCRIPT), "..");

function run(rootDir) {
  return spawnSync("node", [SCRIPT], {
    env: { ...process.env, HANGUL_ROUTE_ROOT: rootDir },
    encoding: "utf8",
  });
}

function makeRoot(files) {
  const root = mkdtempSync(join(tmpdir(), "migrations-"));
  if (files) {
    const dir = join(root, "apps", "api", "migrations");
    mkdirSync(dir, { recursive: true });
    for (const f of files) writeFileSync(join(dir, f), "-- test\n");
  }
  return root;
}

function withRoot(files, fn) {
  const root = makeRoot(files);
  try {
    fn(run(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("check-migrations.mjs", () => {
  test("the repository's own migrations pass", () => {
    const r = run(REPO_ROOT);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /prefixes unique/);
  });

  test("unique prefixes: exit 0", () => {
    withRoot(["0001_schema_v1.sql", "0002_schema_v2.sql", "0005_class_transfer.sql", "0006_plan_meta.sql"], (r) => {
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /4 migration\(s\)/);
    });
  });

  test("two files with the same prefix: exit 1 naming both", () => {
    withRoot(["0004_waitlist.sql", "0005_class_transfer.sql", "0005_plan_meta.sql"], (r) => {
      assert.equal(r.status, 1);
      assert.match(r.stdout, /::error file=apps\/api\/migrations\/0005_plan_meta\.sql::/);
      assert.match(r.stdout, /0005_class_transfer\.sql, 0005_plan_meta\.sql/);
    });
  });

  test("a file without a four-digit prefix: exit 1", () => {
    withRoot(["0001_schema_v1.sql", "plan_meta.sql", "12_short.sql"], (r) => {
      assert.equal(r.status, 1);
      assert.match(r.stdout, /"plan_meta\.sql" must be named NNNN_snake_case\.sql/);
      assert.match(r.stdout, /"12_short\.sql" must be named/);
    });
  });

  test("non-sql files are ignored", () => {
    withRoot(["0001_schema_v1.sql", "README.md"], (r) => {
      assert.equal(r.status, 0, r.stdout);
    });
  });

  test("no migration directory: exit 0", () => {
    withRoot(null, (r) => {
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /nothing to check/);
    });
  });
});
