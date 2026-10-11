#!/usr/bin/env node
// Migration prefix check (F-ROUTE-001 R-0, erratum E-1 of
// docs/specs/AMENDMENTS-PLC-PLAN-HANDOFF.md).
//
// Two specs plan a new D1 migration at the same time (F-SPACE-002 T-3b
// `0005_class_transfer.sql`, F-PLAN-002 P2-4 `0006_plan_meta.sql`). Wrangler
// and the SQLite test shim (packages/backend/src/__tests__/helpers/sqlite.ts)
// apply `apps/api/migrations/*.sql` in sorted order, so two files with the same
// number would apply in an order nobody chose. This check fails when:
//   - a `.sql` file does not start with a four-digit prefix and `_`
//     (`NNNN_snake_case.sql`), or
//   - two files share the same four-digit prefix.
// No migration directory: nothing to check, exit 0.

import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.HANGUL_ROUTE_ROOT
  ? resolve(process.env.HANGUL_ROUTE_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "apps", "api", "migrations");
const NAME = /^(\d{4})_[a-z0-9_]+\.sql$/;

function fail(file, message) {
  console.log(`::error file=${relative(ROOT, file)}::${message}`);
  process.exitCode = 1;
}

if (!existsSync(DIR)) {
  console.log("check-migrations: no apps/api/migrations directory, nothing to check");
  process.exit(0);
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const byPrefix = new Map();

for (const file of files) {
  const m = file.match(NAME);
  if (!m) {
    fail(join(DIR, file), `migration "${file}" must be named NNNN_snake_case.sql`);
    continue;
  }
  const list = byPrefix.get(m[1]) ?? [];
  list.push(file);
  byPrefix.set(m[1], list);
}

for (const [prefix, list] of byPrefix) {
  if (list.length > 1) {
    fail(
      join(DIR, list[1]),
      `migration prefix ${prefix} is used by ${list.length} files (${list.join(", ")}); take the next free number`
    );
  }
}

if (!process.exitCode) {
  console.log(`check-migrations: ${files.length} migration(s), prefixes unique`);
}
