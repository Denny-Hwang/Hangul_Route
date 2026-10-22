// F-CURR-002 §9.1 (row CM-6): the addedIn stamp order, checked in a required CI job.
//
// scripts/check-added-in.mjs also runs from `build-lessons.mjs --check` in content-validation.yml,
// which is not a required check. This test runs it in the required unit job (`pnpm run test:scripts`,
// ci.yml), with no workflow change: on GitHub Actions it fetches the pull request's base branch
// (GITHUB_BASE_REF, else main; one commit is enough, the check reads only its tree) and checks the
// checked-out tree against it. A pull_request run checks out the merge with main, so the check sees
// the branch as it would merge; the merge watcher's update-branch re-runs it on the latest main.
// Elsewhere it runs only when HANGUL_ROUTE_STAMP_BASE names a ref (e.g. origin/main), else it skips.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = resolve(ROOT, "scripts", "check-added-in.mjs");
const onCi = process.env.GITHUB_ACTIONS === "true";
const local = process.env.HANGUL_ROUTE_STAMP_BASE;

/** The base ref to check against: fetched on CI, named by HANGUL_ROUTE_STAMP_BASE elsewhere. */
function baseRef() {
  if (!onCi) return local;
  const branch = process.env.GITHUB_BASE_REF || "main";
  assert.match(branch, /^[A-Za-z0-9._/-]+$/, `unexpected base branch name ${branch}`);
  const ref = `refs/hangul-route/stamp-base/${branch}`;
  const fetched = spawnSync("git", ["fetch", "--no-tags", "--depth=1", "origin", `+refs/heads/${branch}:${ref}`], { cwd: ROOT, encoding: "utf8" });
  assert.equal(fetched.status, 0, `git fetch of ${branch} failed (the stamp check fails closed on CI): ${fetched.stderr}`);
  return ref;
}

test(
  "addedIn stamps hold the order against the base branch (check-added-in.mjs)",
  { skip: !onCi && (local === undefined || local === "none") ? "not on CI; set HANGUL_ROUTE_STAMP_BASE=origin/main to run it" : false },
  () => {
    const ref = baseRef();
    const run = spawnSync(process.execPath, [SCRIPT, "--base", ref], { cwd: ROOT, encoding: "utf8", env: { ...process.env, HANGUL_ROUTE_ROOT: ROOT } });
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.match(run.stdout, /addedIn stamps hold the order against/);
  },
);
