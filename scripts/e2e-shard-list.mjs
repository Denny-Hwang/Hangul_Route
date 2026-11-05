#!/usr/bin/env node
// Even Playwright shards for the PWA e2e jobs (CI speed-up, 2026-10-12).
//
// `playwright test --shard=i/N` cuts the test list into N contiguous runs. The
// mobile suite lists its fixture-only specs (skipped on the release build)
// next to each other and a few long files next to each other, so contiguous
// shards came out 4:2:1 in time. This script deals the tests round-robin
// instead: test k goes to shard (k mod N) + 1, so every shard gets its share
// of each long file and of the skipped tests. Every listed test lands in
// exactly one shard.
//
// Usage (from apps/mobile, in .github/workflows/web-app.yml):
//   playwright test --list [filters] > all.txt   (several listings may be appended)
//   node ../../scripts/e2e-shard-list.mjs --shard 2/3 < all.txt > shard.txt
//   playwright test --test-list shard.txt
// The output is in the --list format ("file:line:col › describe › title"),
// which --test-list reads back. The workflow checks that the shard list
// selects exactly as many tests as it has lines.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The tests of `playwright test --list` output, one string per test, in listed order. */
export function parseListOutput(text) {
  const tests = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line === "Listing tests:" || /^Total: \d+ tests? in \d+ files?$/.test(line)) continue;
    // "file.spec.ts:12:3 › …" or "[project] › file.spec.ts:12:3 › …"
    if (/^(\[[^\]]+\] › )?\S+:\d+:\d+ › /.test(line)) tests.push(line);
  }
  return tests;
}

/**
 * The sum of the "Total: N tests" lines of `--list` output (several listings may be
 * concatenated, one per filter), or null when there is none.
 */
export function listedTotal(text) {
  const totals = [...text.matchAll(/^\s*Total: (\d+) tests? in \d+ files?\s*$/gm)].map((m) => Number(m[1]));
  return totals.length ? totals.reduce((a, n) => a + n, 0) : null;
}

/** "i/N" with 1 <= i <= N. */
export function parseShardArg(arg) {
  const m = typeof arg === "string" ? arg.match(/^(\d+)\/(\d+)$/) : null;
  if (!m) throw new Error(`--shard must be <current>/<total>, got ${JSON.stringify(arg)}`);
  const current = Number(m[1]);
  const total = Number(m[2]);
  if (total < 1 || current < 1 || current > total) throw new Error(`--shard ${arg}: need 1 <= current <= total`);
  return { current, total };
}

/**
 * Round-robin: the tests at positions current-1, current-1+total, ... With four shards and a table of weights
 * (`e2e-shard-weights.json`) the shares are instead dealt by weight, longest first, each test to the shard that has the
 * least weight so far. Round-robin alone drifts: the long files sit at fixed positions, so every batch of new tests moves
 * them between shards, and the PWA e2e shards (a 20 minute limit, main at 14 to 19 minutes each) ran out of time with
 * every test passing: shard 2 on the CM tail integration (patched by moving every tenth of its tests to shard 3), then
 * shards 3 and 4 on the KT tail integration (release part 15.4 and 14.3 minutes against 11.8 and 11.0), and after the
 * patch shards 1 and 2 (15.7 and 16.8). Replayed on the 1,818 tests of that run with the durations its shards reported, the
 * test time per shard was 25.3, 24.4, 29.7 and 26.1 minutes under round-robin with the old patch and is 26.0 to 27.2 by
 * weight. A test weighs its own seconds when the table lists it (the 102 tests of 12 s or more
 * in the release run, 19 in the fixture run), else its spec file's mean in that run, else 0.25 s (a file the table does
 * not list: its tests are skipped in that run, or it is new). Every listed test still lands in exactly one shard.
 */
export function pickShard(tests, { current, total }, weightOf = null) {
  if (total === 4 && weightOf !== null) {
    const dealt = dealByWeight(tests, total, weightOf);
    return tests.filter((_, k) => dealt[k] === current);
  }
  return tests.filter((_, k) => shardOf(k, total) === current);
}

/** The shard (1-based) that test k of a list goes to, round-robin. */
export function shardOf(k, total) {
  return (k % total) + 1;
}

/** The shard (1-based) of each test, by weight: heaviest first, each to the shard with the least weight so far. */
export function dealByWeight(tests, total, weightOf) {
  const weights = tests.map((t) => weightOf(t));
  const order = tests.map((_, k) => k).sort((a, b) => weights[b] - weights[a] || a - b);
  const load = new Array(total).fill(0);
  const shardOfTest = new Array(tests.length);
  for (const k of order) {
    let best = 0;
    for (let s = 1; s < total; s++) if (load[s] < load[best]) best = s;
    load[best] += weights[k];
    shardOfTest[k] = best + 1;
  }
  return shardOfTest;
}

/** The spec file of a listed test ("[project] › file.spec.ts:12:3 › ..."). */
export function specFileOf(test) {
  const m = test.match(/(?:^|› )([^\s›]+?):\d+:\d+ › /);
  return m ? m[1] : "";
}

/** A listed test as the weights table names it: its spec file, then the first 70 characters of the rest of the line. */
export function testKeyOf(test) {
  const m = test.match(/(?:^|› )([^\s›]+?):\d+:\d+ › (.*)$/);
  return m ? `${m[1]} › ${m[2].slice(0, 70)}` : "";
}

const UNLISTED_SECONDS = 0.25;

/** The weight function for a run: `release` (the first Playwright run of a shard) or `fixture` (STORY_FIXTURES=1). */
export function weightsFor(run, table) {
  const files = table?.[run]?.files ?? {};
  const slow = table?.[run]?.tests ?? {};
  return (test) => slow[testKeyOf(test)] ?? files[specFileOf(test)] ?? UNLISTED_SECONDS;
}

function main(argv) {
  const at = argv.indexOf("--shard");
  const shard = parseShardArg(at === -1 ? undefined : argv[at + 1]);
  const input = readFileSync(0, "utf8");
  const tests = parseListOutput(input);
  if (tests.length === 0) throw new Error("the Playwright list holds no tests");
  const total = listedTotal(input);
  if (total !== null && total !== tests.length) {
    throw new Error(`read ${tests.length} tests but the list says Total: ${total}`);
  }
  const table = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "e2e-shard-weights.json"), "utf8"));
  const fixtures = Object.keys(process.env).some((k) => k.startsWith("STORY_FIXTURES") && process.env[k]);
  const mine = pickShard(tests, shard, weightsFor(fixtures ? "fixture" : "release", table));
  process.stdout.write(mine.map((t) => `${t}\n`).join(""));
  process.stderr.write(`e2e-shard-list: shard ${shard.current}/${shard.total}: ${mine.length} of ${tests.length} tests\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`e2e-shard-list: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
