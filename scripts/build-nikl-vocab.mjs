#!/usr/bin/env node
// scripts/nikl-vocab-2003.json from the National Institute of Korean Language's 「한국어 학습용 어휘 목록」
// (May 2003; 5,965 words in grades A 982, B 2,111, C 2,872). AMENDMENTS-PLC-VALIDITY §3.3, row PV-3.
//
// Source: https://www.korean.go.kr/front_eng/down/down_02V.do?etc_seq=70, the text file "한국어 학습용 어휘 목록.txt"
// (CP949, CRLF, tab-separated: 순위, 단어, 품사, 풀이, 등급). KOGL (공공누리) Type 1: reuse with attribution.
//
// Usage: node scripts/build-nikl-vocab.mjs <downloaded.txt> [--out scripts/nikl-vocab-2003.json]
//        node scripts/build-nikl-vocab.mjs <downloaded.txt> --check    (fails when the committed file differs)
//
// The reader is `niklIndex` of scripts/placement-rules.mjs (the placement lint and `freq-coverage`).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const NIKL_FILE = join(HERE, "nikl-vocab-2003.json");

export const NIKL_SOURCE = Object.freeze({
  title: "한국어 학습용 어휘 목록 (Korean Learning Vocabulary List)",
  publisher: "국립국어연구원 (National Institute of Korean Language)",
  published: "2003-05",
  page: "https://www.korean.go.kr/front_eng/down/down_02V.do?etc_seq=70",
  license: "KOGL (공공누리) Type 1: reuse with attribution of the source",
  attribution: "국립국어원, 「한국어 학습용 어휘 목록」(2003), 공공누리 제1유형. Source: National Institute of Korean Language, Korean Learning Vocabulary List (2003), KOGL Type 1.",
  notice: "scripts/third-party-notices/licenses/NIKL-KOGL-Type1.txt",
  convertedBy: "scripts/build-nikl-vocab.mjs",
  columns: ["rank", "word", "homograph", "pos", "gloss", "grade"],
  rankNote: "rank is the frequency rank of the 2002 report 『현대 국어 사용 빈도 조사』; null for the 68 words the list gives no rank (63 proper nouns and 5 others)",
  homographNote: "homograph is the two-digit number of 『표준국어대사전』 after the word (사과05: 沙果, apple; 사과08: 謝過, apology); empty when the word has none",
});

const EXPECTED = Object.freeze({ A: 982, B: 2111, C: 2872 });

/** Decode the downloaded bytes (CP949; a UTF-8 text is read as it is) into text. */
export function decodeList(bytes) {
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  try {
    return utf8.decode(bytes);
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

/** The list's text as rows [rank | null, word, homograph, pos, gloss, grade]; throws on a row it cannot read. */
export function parseList(text, expected = EXPECTED) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (!lines[0].startsWith("순위\t단어\t품사\t풀이\t등급")) throw new Error(`unexpected header: ${lines[0]}`);
  const rows = [];
  lines.slice(1).forEach((line, i) => {
    if (line.trim() === "") return;
    const cells = line.split("\t");
    if (cells.length !== 5) throw new Error(`line ${i + 2}: ${cells.length} columns, expected 5`);
    const [rank, rawWord, pos, gloss, grade] = cells.map((c) => c.trim());
    if (!/^(\d+)?$/.test(rank)) throw new Error(`line ${i + 2}: bad rank ${rank}`);
    if (!(grade in EXPECTED)) throw new Error(`line ${i + 2}: bad grade ${grade}`);
    const m = /^(.*?)(\d{2})?$/.exec(rawWord);
    if (m === null || m[1] === "") throw new Error(`line ${i + 2}: bad word ${rawWord}`);
    rows.push([rank === "" ? null : Number(rank), m[1], m[2] ?? "", pos, gloss, grade]);
  });
  const counts = { A: 0, B: 0, C: 0 };
  for (const row of rows) counts[row[5]] += 1;
  for (const g of Object.keys(expected)) {
    if (counts[g] !== expected[g]) throw new Error(`grade ${g}: ${counts[g]} words, the list has ${expected[g]}`);
  }
  return rows;
}

/** The JSON text: the source header, then one entry per line. */
export function renderList(rows) {
  const head = JSON.stringify({ source: NIKL_SOURCE, grades: EXPECTED }, null, 2);
  const body = rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
  return `${head.slice(0, -2)},\n  "entries": [\n${body}\n  ]\n}\n`;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--out");
  if (input === undefined) {
    console.error("usage: node scripts/build-nikl-vocab.mjs <downloaded.txt> [--out <file>] [--check]");
    process.exit(2);
  }
  const outIndex = args.indexOf("--out");
  const out = outIndex === -1 ? NIKL_FILE : resolve(args[outIndex + 1]);
  const text = renderList(parseList(decodeList(readFileSync(input))));
  if (args.includes("--check")) {
    if (readFileSync(out, "utf8") !== text) {
      console.error(`${out} differs from the conversion of ${input}`);
      process.exit(1);
    }
    console.log(`${out} is the conversion of ${input}`);
  } else {
    writeFileSync(out, text);
    console.log(`wrote ${out}`);
  }
}
