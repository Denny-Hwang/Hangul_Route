// Self-tests for scripts/e2e-shard-list.mjs (CI speed-up, 2026-10-12).
// Node built-in test runner, no dependencies.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { dealByWeight, listedTotal, parseListOutput, pickShard, parseShardArg, shardOf, specFileOf, testKeyOf, weightsFor } from "../e2e-shard-list.mjs";

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

describe("four shards dealt by weight", () => {
  const weigh = (t) => ({ "long.spec.ts": 10, "mid.spec.ts": 3 })[specFileOf(t)] ?? 0.25;

  test("the spec file of a listed test", () => {
    assert.equal(specFileOf("journey-upper-cell.spec.ts:12:3 › a › b"), "journey-upper-cell.spec.ts");
    assert.equal(specFileOf("[chromium] › layout.spec.ts:20:5 › another one"), "layout.spec.ts");
    assert.equal(specFileOf("no file here"), "");
  });

  test("a test weighs its own seconds when the table lists it, else its file's mean, else 0.25 seconds; the run picks its set", () => {
    const table = {
      release: { files: { "a.spec.ts": 5 }, tests: { "a.spec.ts › slow one": 40 } },
      fixture: { files: { "a.spec.ts": 1, "b.spec.ts": 2 } },
    };
    assert.equal(weightsFor("release", table)("a.spec.ts:1:1 › x"), 5);
    assert.equal(weightsFor("release", table)("a.spec.ts:9:3 › slow one"), 40);
    assert.equal(weightsFor("release", table)("b.spec.ts:1:1 › x"), 0.25);
    assert.equal(weightsFor("fixture", table)("b.spec.ts:1:1 › x"), 2);
    assert.equal(weightsFor("fixture", undefined)("b.spec.ts:1:1 › x"), 0.25);
  });

  test("a test's key is its file and the first 70 characters of its title, without the line", () => {
    assert.equal(testKeyOf("a.spec.ts:12:3 › group › title"), "a.spec.ts › group › title");
    assert.equal(testKeyOf(`a.spec.ts:1:1 › ${"x".repeat(100)}`), `a.spec.ts › ${"x".repeat(70)}`);
    assert.equal(testKeyOf("nothing"), "");
  });

  test("the heavy file is spread evenly and the totals come out level", () => {
    const tests = [
      ...Array.from({ length: 12 }, (_, i) => `long.spec.ts:${i + 1}:1 › t`),
      ...Array.from({ length: 20 }, (_, i) => `mid.spec.ts:${i + 1}:1 › t`),
      ...Array.from({ length: 40 }, (_, i) => `tiny.spec.ts:${i + 1}:1 › t`),
    ];
    const shares = [1, 2, 3, 4].map((current) => pickShard(tests, { current, total: 4 }, weigh));
    assert.deepEqual([...shares.flat()].sort(), [...tests].sort());
    const weights = shares.map((share) => share.reduce((n, t) => n + weigh(t), 0));
    assert.ok(Math.max(...weights) - Math.min(...weights) <= 10, `weights ${weights}`);
    for (const share of shares) assert.equal(share.filter((t) => t.startsWith("long")).length, 3);
  });

  test("equal weights deal in turn, and the dealing is the same on every run", () => {
    const tests = Array.from({ length: 9 }, (_, i) => `t${i}`);
    assert.deepEqual(dealByWeight(tests, 4, () => 1), [1, 2, 3, 4, 1, 2, 3, 4, 1]);
    assert.deepEqual(dealByWeight(tests, 4, () => 1), dealByWeight(tests, 4, () => 1));
  });

  test("without a table four shards are plain round-robin, and so is any other count", () => {
    const tests = Array.from({ length: 8 }, (_, i) => `t${i}`);
    assert.deepEqual(pickShard(tests, { current: 2, total: 4 }), ["t1", "t5"]);
    assert.deepEqual(pickShard(tests, { current: 2, total: 3 }, weigh), ["t1", "t4", "t7"]);
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
