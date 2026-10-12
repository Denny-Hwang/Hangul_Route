// Guard: a temporary Playwright config never lands in the repo.
//
// Agents and people run the e2e suites on a spare port with a throwaway
// config (for example apps/mobile/pw.tmp.config.ts). Such a file was once
// committed by accident (F-STORY-005 PR 5.5b review). These tests keep it out:
// .gitignore ignores the names, and no tracked file may carry one (a
// `git add -f` would get past .gitignore, but not past this test).
//
// Node built-in test runner, no dependencies. Skipped when the tree is not a
// git checkout (git is the source of truth for "tracked").

import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IS_GIT = existsSync(join(ROOT, ".git"));

/** Basenames of throwaway Playwright configs: pw.tmp.config.ts, playwright-tmp-4391.config.mjs, ... */
export const TEMP_CONFIG = /(^|\/)(pw|playwright)[.-]tmp[^/]*\.config\.[cm]?[jt]s$/;

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

const SAMPLES = [
  "apps/mobile/pw.tmp.config.ts",
  "apps/mobile/pw.tmp-4391.config.ts",
  "apps/mobile/pw-tmp.config.ts",
  "apps/web/playwright.tmp.config.mjs",
  "apps/web/playwright-tmp.config.js",
];

describe("temporary Playwright configs", () => {
  test("the pattern matches throwaway names and not the real configs", () => {
    for (const p of SAMPLES) assert.match(p, TEMP_CONFIG, p);
    for (const p of ["apps/mobile/playwright.config.ts", "apps/web/playwright.config.ts"]) {
      assert.doesNotMatch(p, TEMP_CONFIG, p);
    }
  });

  test("no tracked file is a temporary Playwright config", { skip: !IS_GIT }, () => {
    const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
    const stray = tracked.filter((p) => TEMP_CONFIG.test(p));
    assert.deepEqual(stray, [], `remove ${stray.join(", ")} (temporary configs stay local)`);
  });

  test(".gitignore ignores every throwaway name", { skip: !IS_GIT }, () => {
    for (const p of SAMPLES) {
      // check-ignore --no-index tests the path itself, tracked or not; exit 0 = ignored.
      let ignored = true;
      try {
        git(["check-ignore", "-q", "--no-index", p]);
      } catch {
        ignored = false;
      }
      assert.ok(ignored, `${p} is not ignored by .gitignore`);
    }
  });
});
