// Self-tests for scripts/build-review-items.mjs (F-CURR-002 §4.2, §9.3, §10, row CM-10): the review-item
// index over the repository's content, its determinism (two runs give identical bytes), the budget line of
// its chunk, and the frozen ids (an edited string that would change an id stops the build until an alias
// or a retirement says why; --freeze only ever adds ids).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "build-review-items.mjs");
const { BUDGET, CHUNK_DIR, CHUNK_NAME, INDEX_MODULE, OUT_DIR, SNAPSHOT, STAGE1_TABLE, buildModules, chunkSize, isBlocking } = await import(SCRIPT);

const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

/** A tree with the generator's inputs: content/ and the frozen review-item files. */
function inputTree() {
  const root = mkdtempSync(join(tmpdir(), "review-items-"));
  roots.push(root);
  cpSync(join(REPO, "content"), join(root, "content"), { recursive: true });
  for (const rel of [SNAPSHOT, STAGE1_TABLE]) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    cpSync(join(REPO, rel), join(root, rel));
  }
  return root;
}
const run = (root, args = []) => spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HANGUL_ROUTE_ROOT: root }, encoding: "utf8" });
const read = (root, rel) => readFileSync(join(root, ...rel.split("/")), "utf8");
const chunkFile = (root) => read(root, `${OUT_DIR.split("\\").join("/")}/${CHUNK_DIR}/${CHUNK_NAME}.ts`);
const indexFile = (root) => read(root, `${OUT_DIR.split("\\").join("/")}/${INDEX_MODULE}`);

describe("build-review-items.mjs over the repository's content", () => {
  test("writes the index and the chunk; two runs give identical bytes, and --check passes", () => {
    const a = inputTree();
    const b = inputTree();
    const first = run(a);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /wrote the review-item index: \d+ items in one chunk/);
    assert.equal(run(b).status, 0);
    assert.equal(chunkFile(a), chunkFile(b));
    assert.equal(indexFile(a), indexFile(b));
    const again = run(a, ["--check"]);
    assert.equal(again.status, 0, again.stdout + again.stderr);
    // The start-loaded index names the chunk's hash, and only reaches the chunk through a literal import().
    const hash = /export const CHUNK_HASH = "([0-9a-f]{16})"/.exec(chunkFile(a))?.[1];
    assert.ok(hash);
    assert.match(indexFile(a), new RegExp(`REVIEW_ITEMS_HASH = "${hash}"`));
    assert.match(indexFile(a), /return import\('\.\/review-item-chunks\/review-items'\);/);
    assert.doesNotMatch(indexFile(a), /REVIEW_ITEM_ROWS/);
    // pwa-postbuild.mjs reads `CHUNK_HASH = "<hash>"` in the start bundle as a chunk pulled in.
    assert.doesNotMatch(indexFile(a), /CHUNK_HASH\s*=/);
  });

  test("--check fails on a changed module and on a stale one", () => {
    const root = inputTree();
    assert.equal(run(root).status, 0);
    const file = join(root, OUT_DIR, CHUNK_DIR, `${CHUNK_NAME}.ts`);
    writeFileSync(file, `${readFileSync(file, "utf8")}// edited\n`);
    const drift = run(root, ["--check"]);
    assert.equal(drift.status, 1);
    assert.match(drift.stdout, /review-items\.ts::generated module is missing or differs/);
    assert.equal(run(root).status, 0);
    writeFileSync(join(root, OUT_DIR, CHUNK_DIR, "old.ts"), "// old\n");
    const stale = run(root, ["--check"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /old\.ts::generated review-item module is no longer built/);
    assert.equal(run(root).status, 0);
    assert.equal(run(root, ["--check"]).status, 0, "a write removes the stale chunk");
  });

  test("--report holds the chunk to the §10 budget line (150,000 B raw, 30,000 B gzip)", () => {
    assert.deepEqual(BUDGET, { raw: 150_000, gzip: 30_000 });
    const report = run(inputTree(), ["--report"]);
    assert.equal(report.status, 0, report.stdout + report.stderr);
    const [, raw, gzip] = /chunk review-item-chunks\/review-items\.ts (\d+) B raw, (\d+) B gzip/.exec(report.stdout) ?? [];
    assert.ok(Number(raw) > 50_000 && Number(raw) <= BUDGET.raw, raw);
    assert.ok(Number(gzip) > 5_000 && Number(gzip) <= BUDGET.gzip, gzip);
    const over = chunkSize({ [`${CHUNK_DIR}/${CHUNK_NAME}.ts`]: "x".repeat(BUDGET.raw + 1) });
    assert.deepEqual(over.problems, [`the review-item chunk is ${BUDGET.raw + 1} B raw, over its ceiling of ${BUDGET.raw} B`]);
    const noisy = Array.from({ length: 40_000 }, (_, i) => (i * 7919).toString(36)).join("");
    assert.match(chunkSize({ [`${CHUNK_DIR}/${CHUNK_NAME}.ts`]: noisy.slice(0, BUDGET.raw) }).problems.join(), /gzip, over its ceiling of 30000 B/);
  });

  test("an edited word stops the build until an alias keeps its id; --freeze then adds nothing", () => {
    const root = inputTree();
    const rel = "content/episodes/stage-2/life.json";
    const cell = JSON.parse(read(root, rel));
    const page = cell.quests[0].steps.find((s) => s.kind === "discover").discover.pages[0];
    const word = { ko: "솜사탕", romanization: "somsatang", en: "cotton candy" };
    page.items = [...page.items, { type: "word", word }];
    writeFileSync(join(root, rel), JSON.stringify(cell, null, 2));
    assert.equal(run(root, ["--freeze"]).status, 0);
    word.ko = "솜사탕들";
    word.romanization = "somsatangdeul";
    writeFileSync(join(root, rel), JSON.stringify(cell, null, 2));
    const failed = run(root);
    assert.equal(failed.status, 1, failed.stdout);
    assert.match(failed.stdout, /items-stable-id: lex:somsatang \(lex\|솜사탕\) is no longer taught\. If its text was edited, keep the id with an alias/);
    const snapshot = JSON.parse(read(root, SNAPSHOT));
    writeFileSync(join(root, SNAPSHOT), JSON.stringify({ ...snapshot, alias: { "lex|솜사탕들": "lex:somsatang" } }));
    const kept = run(root);
    assert.equal(kept.status, 0, kept.stdout + kept.stderr);
    assert.doesNotMatch(kept.stdout, /::warning/);
    assert.ok(chunkFile(root).includes('"lex:somsatang","솜사탕들"'), "the edited word keeps its frozen id");
    const freeze = run(root, ["--freeze"]);
    assert.equal(freeze.status, 0, freeze.stdout);
    assert.match(freeze.stdout, /^froze 0 new review item ids/);
    assert.deepEqual(JSON.parse(read(root, SNAPSHOT)).ids, snapshot.ids);
  });

  test("a new word is written with a warning until --freeze adds its id; taking it out again needs a retirement", () => {
    const root = inputTree();
    const rel = "content/episodes/stage-2/life.json";
    const cell = JSON.parse(read(root, rel));
    const page = cell.quests[0].steps.find((s) => s.kind === "discover").discover.pages[0];
    const items = [...page.items];
    page.items = [...items, { type: "word", word: { ko: "솜사탕", romanization: "somsatang", en: "cotton candy" } }];
    writeFileSync(join(root, rel), JSON.stringify(cell, null, 2));
    const before = JSON.parse(read(root, SNAPSHOT));
    const warned = run(root);
    assert.equal(warned.status, 0, warned.stdout);
    assert.match(warned.stdout, /::warning file=.*items-stable-id: lex:somsatang \(lex\|솜사탕\) is a new review item/);
    assert.ok(chunkFile(root).includes('"lex:somsatang","솜사탕"'));
    const freeze = run(root, ["--freeze"]);
    assert.match(freeze.stdout, /^froze 1 new review item ids/);
    const frozen = JSON.parse(read(root, SNAPSHOT));
    assert.equal(frozen.ids["lex|솜사탕"], "lex:somsatang");
    assert.equal(Object.keys(frozen.ids).length, Object.keys(before.ids).length + 1, "--freeze never removes an id");
    assert.doesNotMatch(run(root).stdout, /::warning/);
    // A re-authoring row takes the word out of every round: the build stops until the id is retired.
    page.items = items;
    writeFileSync(join(root, rel), JSON.stringify(cell, null, 2));
    const gone = run(root);
    assert.equal(gone.status, 1);
    assert.match(gone.stdout, /lex:somsatang \(lex\|솜사탕\) is no longer taught.*add lex:somsatang to "retired"/);
    writeFileSync(join(root, SNAPSHOT), JSON.stringify({ ...frozen, retired: ["lex:somsatang"] }));
    const retired = run(root);
    assert.equal(retired.status, 0, retired.stdout);
    // The retired item keeps its id and Korean for reports, and is in no row.
    assert.match(chunkFile(root), /export const REVIEW_RETIRED: readonly RetiredItemRow\[\] = \[\["lex:somsatang","솜사탕",""\]\];/);
    const rowsPart = chunkFile(root).split("export const REVIEW_RETIRED")[0];
    assert.ok(!rowsPart.includes('"lex:somsatang"'), "a retired id is in no row");
  });

  test("a broken frozen file is a content error; a usage error exits 2", () => {
    const root = inputTree();
    writeFileSync(join(root, STAGE1_TABLE), "{ not json");
    const broken = run(root);
    assert.equal(broken.status, 1);
    assert.match(broken.stdout, /::error file=packages\/content-schema\/src\/review-items\/stage1-items\.json::invalid JSON/);
    writeFileSync(join(root, STAGE1_TABLE), JSON.stringify({ schemaVersion: 2 }));
    assert.match(run(root).stdout, /stage1-items\.json::schemaVersion: /);
    assert.equal(run(root, ["--nope"]).status, 2);
    assert.equal(run(root, ["--check", "--report"]).status, 2);
  });

  test("only the not-yet-frozen issue lets the build go on", () => {
    assert.equal(isBlocking({ code: "not-frozen" }), false);
    for (const code of ["vanished", "retired-taught", "retired-unknown", "alias-target-unknown", "alias-clash", "sense-missing", "id-taken"]) assert.equal(isBlocking({ code }), true);
  });

  test("the hash covers the tables, the rows and the retired ids", () => {
    const chunk = { tables: { cells: ["stage2-life"], homes: ["life"] }, rows: [["lex:sagwa", "사과", "", "apple", "", 0, 2 | 8, [0], 3, [], 0, "", []]] };
    const a = buildModules(chunk).hash;
    assert.notEqual(buildModules(chunk, [["lex:old", "옛말", ""]]).hash, a);
    assert.notEqual(buildModules({ ...chunk, tables: { cells: ["stage3-life"], homes: ["life"] } }).hash, a);
    assert.equal(buildModules(chunk, []).hash, a);
  });
});
