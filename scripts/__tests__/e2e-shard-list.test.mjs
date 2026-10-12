// Self-tests for scripts/e2e-shard-list.mjs (CI speed-up, 2026-10-12).
// Node built-in test runner, no dependencies.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { listedTotal, parseListOutput, pickShard, parseShardArg } from "../e2e-shard-list.mjs";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "e2e-shard-list.mjs");

const LIST = [
  "Listing tests:",
  "  app-host.spec.ts:134:7 › app host (F-APP-001 A-3) › dist holds the merged console",
  "  app-host.spec.ts:140:7 › app host (F-APP-001 A-3) › / is the learner app",
  "  audio.spec.ts:553:7 › bundled clips (A-6) › clip > voice",
  "  layout.spec.ts:10:5 › a test at the top level",
  "  layout.spec.ts:20:5 › another one",
  "  story-reader.spec.ts:106:7 › story reader › opens",
  "  tablet-layout.spec.ts:30:9 › tablet › 1180x820 › Home fits",
  "Total: 7 tests in 5 files",
  "",
].join("\n");

function run(args, input) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { input, encoding: "utf8" });
}

describe("parseListOutput", () => {
  test("keeps one line per test, in the listed order, without the header and the total", () => {
    const tests = parseListOutput(LIST);
    assert.equal(tests.length, 7);
    assert.equal(tests[0], "app-host.spec.ts:134:7 › app host (F-APP-001 A-3) › dist holds the merged console");
    assert.equal(tests[6], "tablet-layout.spec.ts:30:9 › tablet › 1180x820 › Home fits");
  });

  test("keeps a [project] prefix", () => {
    const tests = parseListOutput("Listing tests:\n  [chromium] › a.spec.ts:1:1 › t\nTotal: 1 test in 1 file\n");
    assert.deepEqual(tests, ["[chromium] › a.spec.ts:1:1 › t"]);
  });

  test("an empty list is an empty array", () => {
    assert.deepEqual(parseListOutput("Listing tests:\nTotal: 0 tests in 0 files\n"), []);
  });
});

describe("listedTotal", () => {
  test("sums the Total lines of appended listings", () => {
    assert.equal(listedTotal("Total: 3 tests in 2 files\nTotal: 1 test in 1 file\n"), 4);
  });

  test("is null without a Total line", () => {
    assert.equal(listedTotal("  a.spec.ts:1:1 › t\n"), null);
  });
});

describe("parseShardArg", () => {
  test("reads current/total", () => {
    assert.deepEqual(parseShardArg("2/3"), { current: 2, total: 3 });
  });

  for (const bad of ["0/3", "4/3", "1/0", "x/3", "3", "", undefined]) {
    test(`refuses ${JSON.stringify(bad)}`, () => {
      assert.throws(() => parseShardArg(bad));
    });
  }
});

describe("pickShard", () => {
  test("deals the tests round-robin, so neighbours of one long file land in different shards", () => {
    const tests = ["t0", "t1", "t2", "t3", "t4", "t5", "t6"];
    assert.deepEqual(pickShard(tests, { current: 1, total: 3 }), ["t0", "t3", "t6"]);
    assert.deepEqual(pickShard(tests, { current: 2, total: 3 }), ["t1", "t4"]);
    assert.deepEqual(pickShard(tests, { current: 3, total: 3 }), ["t2", "t5"]);
  });

  test("every test lands in exactly one shard, for any shard count", () => {
    const tests = Array.from({ length: 23 }, (_, i) => `t${i}`);
    for (let total = 1; total <= 6; total++) {
      const all = [];
      for (let current = 1; current <= total; current++) all.push(...pickShard(tests, { current, total }));
      assert.deepEqual([...all].sort(), [...tests].sort(), `total ${total}`);
    }
  });
});

describe("the CLI", () => {
  test("prints the test list of one shard, one test per line", () => {
    const r = run(["--shard", "2/3"], LIST);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      r.stdout,
      [
        "app-host.spec.ts:140:7 › app host (F-APP-001 A-3) › / is the learner app",
        "layout.spec.ts:20:5 › another one",
        "",
      ].join("\n")
    );
  });

  test("fails on a list with no tests (a broken listing must not pass as an empty shard)", () => {
    const r = run(["--shard", "1/2"], "Listing tests:\nTotal: 0 tests in 0 files\n");
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /no tests/);
  });

  test("fails when the listed count disagrees with the Total line", () => {
    const r = run(["--shard", "1/2"], LIST.replace("Total: 7 tests", "Total: 8 tests"));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Total/);
  });

  test("reads several listings appended one after the other (one per filter)", () => {
    const second = "Listing tests:\n  story-order.spec.ts:330:7 › scene art › plays\nTotal: 1 test in 1 file\n";
    const r = run(["--shard", "1/1"], LIST + second);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim().split("\n").length, 8);
    assert.match(r.stdout, /story-order\.spec\.ts:330:7 › scene art › plays\n$/);
  });

  test("fails without a valid --shard", () => {
    assert.notEqual(run([], LIST).status, 0);
    assert.notEqual(run(["--shard", "4/3"], LIST).status, 0);
  });
});
