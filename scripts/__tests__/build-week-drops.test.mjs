// Self-tests for scripts/build-week-drops.mjs (F-CURR-002 §5.7, §10, row CM-48): the week-drop chunk over the
// repository's content, its determinism (two runs give identical bytes), its budget line, the start-loaded index
// (the hash, the weeks, one literal import()), and the content errors that stop the build.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "build-week-drops.mjs");
const { BUDGET, CHUNK_DIR, CHUNK_NAME, INDEX_MODULE, OUT_DIR, buildModules, chunkSize, noteParts } = await import(SCRIPT);
const { PRECACHE_BUDGET } = await import(join(REPO, "apps", "mobile", "scripts", "pwa", "lesson-chunks.mjs"));

const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function inputTree() {
  const root = mkdtempSync(join(tmpdir(), "week-drops-"));
  roots.push(root);
  cpSync(join(REPO, "content"), join(root, "content"), { recursive: true });
  return root;
}
const run = (root, args = []) => spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HANGUL_ROUTE_ROOT: root }, encoding: "utf8" });
const read = (root, rel) => readFileSync(join(root, ...rel.split("/")), "utf8");
const out = OUT_DIR.split("\\").join("/");
const chunkFile = (root) => read(root, `${out}/${CHUNK_DIR}/${CHUNK_NAME}.ts`);
const indexFile = (root) => read(root, `${out}/${INDEX_MODULE}`);
const edit = (root, rel, change) => {
  const file = join(root, ...rel.split("/"));
  const json = JSON.parse(readFileSync(file, "utf8"));
  change(json);
  writeFileSync(file, JSON.stringify(json, null, 2));
};

describe("build-week-drops.mjs over the repository's content", () => {
  test("writes the index and the chunk; two runs give identical bytes, and --check passes", () => {
    const a = inputTree();
    const b = inputTree();
    const first = run(a);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /wrote the week drops: 13 drops in one chunk/);
    assert.equal(run(b).status, 0);
    assert.equal(chunkFile(a), chunkFile(b));
    assert.equal(indexFile(a), indexFile(b));
    assert.equal(run(a, ["--check"]).status, 0);
    const hash = /export const CHUNK_HASH = "([0-9a-f]{16})"/.exec(chunkFile(a))?.[1];
    assert.ok(hash);
    assert.match(indexFile(a), new RegExp(`WEEK_DROPS_HASH = "${hash}"`));
    assert.match(indexFile(a), /return import\('\.\/week-drop-chunks\/week-drops'\);/);
    assert.match(indexFile(a), /WEEK_DROP_WEEKS: readonly string\[\] = \["2026-10-26",/);
    // The start-loaded index carries no drop text, and never reads as a chunk's own CHUNK_HASH.
    assert.doesNotMatch(indexFile(a), /WEEK_DROPS\b.*=.*\{/);
    assert.doesNotMatch(indexFile(a), /CHUNK_HASH\s*=/);
    assert.doesNotMatch(indexFile(a), /[가-힣]/);
  });

  test("--check fails on a module that differs from a fresh run", () => {
    const a = inputTree();
    assert.equal(run(a).status, 0);
    writeFileSync(join(a, ...`${out}/${INDEX_MODULE}`.split("/")), "// stale\n");
    const check = run(a, ["--check"]);
    assert.equal(check.status, 1);
    assert.match(check.stdout, /differs from a fresh run/);
  });

  test("--report prints the chunk's bytes under its line, which equals the post-build's", () => {
    const report = run(inputTree(), ["--report"]);
    assert.equal(report.status, 0, report.stdout);
    assert.match(report.stdout, /Week drops: 13 drops; chunk week-drop-chunks\/week-drops\.ts \d+ B raw, \d+ B gzip \(ceiling 60000 B raw, 16000 B gzip\)/);
    assert.equal(PRECACHE_BUDGET.weekDropsRaw, BUDGET.raw);
    assert.equal(PRECACHE_BUDGET.weekDropsGzip, BUDGET.gzip);
    const big = buildModules([{ id: "week:2026-11-02", note: { en: [{ text: "x".repeat(BUDGET.raw) }] } }]);
    assert.deepEqual(chunkSize(big.modules).problems.map((p) => p.replace(/\d+ B raw/, "N B raw")), ["the week-drop chunk is N B raw, over its ceiling of 60000 B"]);
  });

  test("a usage error exits 2", () => {
    assert.equal(run(inputTree(), ["--nope"]).status, 2);
  });
});

describe("content errors stop the build", () => {
  test("an item whose romanization is not the converter's", () => {
    const root = inputTree();
    edit(root, "content/weekly/2026-11-02.json", (d) => {
      d.items[0].romanization = "ibdong";
    });
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /items\.ipdong: the romanization of 입동 is ipdong \(F-CNT-002\), not ibdong/);
  });

  test("an overlay note whose {ko:} tokens differ from the English", () => {
    const root = inputTree();
    edit(root, "content/i18n/es/weekly-2026-10-26.json", (o) => {
      o.entries["week:2026-11-02"].note = "Sin fichas.";
    });
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /the es note of week:2026-11-02 needs exactly the tokens of the English note/);
  });

  test("a drop that is not a drop, one filed under another week, and an overlay entry that is not a week id", () => {
    const bad = inputTree();
    edit(bad, "content/weekly/2026-11-02.json", (d) => {
      d.weekOf = "2026-11-03";
    });
    assert.equal(run(bad).status, 1);
    const moved = inputTree();
    cpSync(join(moved, "content/weekly/2026-11-02.json"), join(moved, "content/weekly/2026-11-09.json"));
    const r = run(moved);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /the file of the week of 2026-11-02 is content\/weekly\/2026-11-02\.json/);
    const stray = inputTree();
    edit(stray, "content/i18n/ko/weekly-2026-10-26.json", (o) => {
      o.entries["quest:x"] = {};
    });
    assert.match(run(stray).stdout, /quest:x is not a week drop id/);
  });

  test("a draft drop is left out of the chunk", () => {
    const root = inputTree();
    edit(root, "content/weekly/2026-11-02.json", (d) => {
      d.status = "draft";
    });
    assert.equal(run(root).status, 0);
    assert.doesNotMatch(indexFile(root), /"2026-11-02"/);
  });
});

describe("noteParts", () => {
  test("splits UI text from taught Korean, each token romanized by the converter", () => {
    const romanize = (ko) => ({ text: ko === "입동" ? "ipdong" : "?" });
    assert.deepEqual(noteParts("{ko:입동} falls on 7 November.", romanize), [{ ko: "입동", romanization: "ipdong" }, { text: " falls on 7 November." }]);
    assert.deepEqual(noteParts("A {ko:입동}", romanize), [{ text: "A " }, { ko: "입동", romanization: "ipdong" }]);
    assert.deepEqual(noteParts("plain", romanize), [{ text: "plain" }]);
  });
});
