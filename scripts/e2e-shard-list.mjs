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
 * Round-robin: the tests at positions current-1, current-1+total, ... With four shards, shard 2 also runs the weekly
 * plan bundle's specs, which put it at the 20-minute job limit (main 19m06s, 2026-11-05; the CM tail integration timed
 * out twice there with every test passing). So of the tests round-robin deals to shard 2, every tenth one
 * (floor(k / 4) mod 10 = 9) goes to shard 3, the lightest shard (about 15 minutes; handing it every fifth took shard 3
 * to 20m02s and shard 2 down to 14m30s, so one in ten). Every listed test still lands in
 * exactly one shard.
 */
export function pickShard(tests, { current, total }) {
  return tests.filter((_, k) => shardOf(k, total) === current);
}

/** The shard (1-based) that test k of a list goes to. */
export function shardOf(k, total) {
  const dealt = (k % total) + 1;
  if (total === 4 && dealt === 2 && Math.floor(k / 4) % 10 === 9) return 3;
  return dealt;
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
  const mine = pickShard(tests, shard);
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
