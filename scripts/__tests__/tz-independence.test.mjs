// Guard: the date-dependent unit tests pass in any host time zone (docs/tests/time-zones.md).
//
// CI runs on UTC runners, so a test that builds "today" from a fixed UTC instant while the
// code reads local calendar days stays green there and fails on a laptop in Los Angeles or
// Seoul. This test re-runs the listed vitest files under zones on both sides of UTC.
// Add a file here when it pins a day boundary (relative days, day stamps, due dates).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Zones west and east of UTC, far enough that a mid-day UTC instant changes calendar day. */
export const ZONES = ["America/Los_Angeles", "Asia/Seoul"];

/** Workspace → test files (relative to the workspace) that must hold in every zone. */
export const FILES = {
  "apps/web": [
    "src/lib/console/__tests__/rollup.test.ts",
    "src/components/console/__tests__/console-learning-route-parts.test.tsx",
  ],
  "apps/mobile": [
    "src/logic/vocab/__tests__/progress.test.ts",
    "src/store/__tests__/vocab-run-store.test.ts",
  ],
};

function vitest(workspace, files, tz) {
  const cwd = join(ROOT, workspace);
  const bin = join(cwd, "node_modules", ".bin", "vitest");
  return spawnSync(bin, ["run", "--reporter=dot", ...files], {
    cwd,
    env: { ...process.env, TZ: tz, CI: "true" },
    encoding: "utf8",
    timeout: 300_000,
  });
}

describe("date-dependent unit tests are time-zone independent", () => {
  test("every listed file exists", () => {
    for (const [workspace, files] of Object.entries(FILES)) {
      for (const file of files) assert.ok(existsSync(join(ROOT, workspace, file)), `${workspace}/${file} is missing`);
    }
  });

  for (const tz of ZONES) {
    for (const [workspace, files] of Object.entries(FILES)) {
      test(`${workspace} under TZ=${tz}`, { timeout: 300_000 }, () => {
        const run = vitest(workspace, files, tz);
        assert.equal(run.status, 0, `vitest failed under TZ=${tz} in ${workspace}:\n${run.stdout}\n${run.stderr}`);
      });
    }
  }
});
