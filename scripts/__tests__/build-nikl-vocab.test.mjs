// Self-tests for scripts/build-nikl-vocab.mjs (AMENDMENTS-PLC-VALIDITY §3.3, row PV-3): the conversion of the NIKL
// 「한국어 학습용 어휘 목록」 text file (CP949, CRLF, tab-separated) to scripts/nikl-vocab-2003.json.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(SCRIPTS, "build-nikl-vocab.mjs");
const { NIKL_SOURCE, decodeList, parseList, renderList } = await import(SCRIPT);

const HEADER = "순위\t단어\t품사\t풀이\t등급\r\n\r\n";
const SMALL = `${HEADER}1195\t가게\t명\t\tA\r\n3237\t사과05\t명\t沙果\tA\r\n\t강원도\t고\t江原道\tB\r\n8408\t사과하다02\t동\t謝過-\tC\r\n`;
const EXPECT = { A: 2, B: 1, C: 1 };

describe("build-nikl-vocab: reading the list", () => {
  test("rows keep rank (or null), the word without its homograph number, the number, part of speech, gloss and grade", () => {
    assert.deepEqual(parseList(SMALL, EXPECT), [
      [1195, "가게", "", "명", "", "A"],
      [3237, "사과", "05", "명", "沙果", "A"],
      [null, "강원도", "", "고", "江原道", "B"],
      [8408, "사과하다", "02", "동", "謝過-", "C"],
    ]);
  });

  test("a word with its own parenthesis is kept whole", () => {
    const rows = parseList(`${HEADER}\t도쿄(동경)\t고\t\tA\r\n`, { A: 1, B: 0, C: 0 });
    assert.deepEqual(rows[0].slice(0, 3), [null, "도쿄(동경)", ""]);
  });

  test("a wrong header, column count, rank, grade, word or grade total is refused", () => {
    assert.throws(() => parseList("rank\tword\r\n", EXPECT), /unexpected header/);
    assert.throws(() => parseList(`${HEADER}1\t가게\t명\tA\r\n`, EXPECT), /4 columns, expected 5/);
    assert.throws(() => parseList(`${HEADER}x\t가게\t명\t\tA\r\n`, EXPECT), /bad rank/);
    assert.throws(() => parseList(`${HEADER}1\t가게\t명\t\tD\r\n`, EXPECT), /bad grade/);
    assert.throws(() => parseList(`${HEADER}1\t05\t명\t\tA\r\n`, EXPECT), /bad word/);
    assert.throws(() => parseList(SMALL, { A: 3, B: 1, C: 1 }), /grade A: 2 words, the list has 3/);
    assert.throws(() => parseList(SMALL), /grade A: 2 words, the list has 982/);
  });

  test("CP949 bytes and UTF-8 text both decode to the same Hangul", () => {
    assert.equal(decodeList(Buffer.from([0xb0, 0xa1, 0xb0, 0xd4])), "가게");
    assert.equal(decodeList(Buffer.from("가게", "utf8")), "가게");
  });
});

describe("build-nikl-vocab: writing the JSON", () => {
  test("the source header names the page, the licence and the attribution; one entry per line", () => {
    const text = renderList(parseList(SMALL, EXPECT));
    const json = JSON.parse(text);
    assert.deepEqual(json.source, JSON.parse(JSON.stringify(NIKL_SOURCE)));
    assert.match(json.source.page, /down_02V\.do\?etc_seq=70$/);
    assert.match(json.source.license, /KOGL.*Type 1/);
    assert.match(json.source.attribution, /국립국어원/);
    assert.deepEqual(json.grades, { A: 982, B: 2111, C: 2872 });
    assert.equal(json.entries.length, 4);
    assert.ok(text.includes('\n    [3237,"사과","05","명","沙果","A"],\n'));
    assert.ok(text.endsWith("]\n}\n"));
  });

  test("the command converts a file, checks it against the committed copy, and exits 2 without an input", () => {
    const dir = mkdtempSync(join(tmpdir(), "nikl-"));
    try {
      const input = join(dir, "list.txt");
      const out = join(dir, "out.json");
      // the real list's totals are required: 982 + 2111 + 2872 rows
      const rows = [];
      for (const [grade, n] of [["A", 982], ["B", 2111], ["C", 2872]]) for (let i = 0; i < n; i += 1) rows.push(`${rows.length + 1}\t가\t명\t\t${grade}`);
      writeFileSync(input, `${HEADER}${rows.join("\r\n")}\r\n`);
      const made = spawnSync("node", [SCRIPT, input, "--out", out], { encoding: "utf8" });
      assert.equal(made.status, 0, made.stderr);
      assert.equal(JSON.parse(readFileSync(out, "utf8")).entries.length, 5965);
      assert.equal(spawnSync("node", [SCRIPT, input, "--out", out, "--check"], { encoding: "utf8" }).status, 0);
      writeFileSync(out, "{}\n");
      assert.equal(spawnSync("node", [SCRIPT, input, "--out", out, "--check"], { encoding: "utf8" }).status, 1);
      assert.equal(spawnSync("node", [SCRIPT], { encoding: "utf8" }).status, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
