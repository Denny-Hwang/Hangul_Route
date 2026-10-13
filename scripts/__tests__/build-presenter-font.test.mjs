// Self-tests for scripts/build-presenter-font.mjs (F-TCH-004 §3.6, PR 3).
//
// The glyph list is derived from fixtures here (pure functions), the WOFF2 cmap reader
// runs on small fonts built here (Brotli from node:zlib), `--check` runs on a temp root
// with an injected content loader, and the last block checks the repository itself: the
// committed sidecar matches the shipped content, the committed font maps exactly that
// list, it is within the budget and its licence file ships beside it. No Python is
// needed: the subsetter is injected wherever a build runs.

import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { brotliCompressSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "build-presenter-font.mjs");

const {
  BUDGET_BYTES,
  FONT_REL,
  GLYPHS_REL,
  LICENSE_REL,
  SOURCE_FONT,
  SUBSET_TOOLCHAIN,
  glyphList,
  main,
  presenterStrings,
  renderGlyphs,
  woff2CodePoints,
} = await import(SCRIPT);

// ---- tiny WOFF2 fonts (only what the cmap reader looks at) -----------------------------

function base128(n) {
  const bytes = [];
  do {
    bytes.unshift(n & 0x7f);
    n = Math.floor(n / 128);
  } while (n > 0);
  return bytes.map((b, i) => (i < bytes.length - 1 ? b | 0x80 : b));
}

const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

function cmapTable(subtable) {
  return Buffer.from([...u16(0), ...u16(1), ...u16(3), ...u16(10), ...u32(12), ...subtable]);
}

/** Format 12: one group per code point, glyph ids from 1. */
function cmap12(codePoints) {
  const groups = codePoints.flatMap((cp, i) => [...u32(cp), ...u32(cp), ...u32(i + 1)]);
  return cmapTable([...u16(12), ...u16(0), ...u32(16 + groups.length), ...u32(0), ...u32(codePoints.length), ...groups]);
}

/**
 * Format 4: one segment per code point plus the closing 0xFFFF segment. `viaRange`
 * looks glyphs up through idRangeOffset / glyphIdArray; `unmapped` code points get a
 * segment whose glyph is 0 (.notdef), which a reader must not count.
 */
function cmap4(codePoints, { viaRange = false, unmapped = [] } = {}) {
  const segs = [...codePoints.map((cp, i) => ({ cp, glyph: i + 1 })), ...unmapped.map((cp) => ({ cp, glyph: 0 }))].sort((a, b) => a.cp - b.cp);
  const segCount = segs.length + 1;
  const ends = [...segs.map((s) => s.cp), 0xffff];
  const starts = [...segs.map((s) => s.cp), 0xffff];
  const deltas = [...segs.map((s) => (viaRange ? 0 : (s.glyph - s.cp) & 0xffff)), 1];
  const rangeOffsets = [...segs.map(() => (viaRange ? segCount * 2 : 0)), 0];
  const glyphIds = viaRange ? [...segs.map((s) => s.glyph), 0] : [];
  if (!viaRange && unmapped.length > 0) throw new Error("unmapped code points need viaRange");
  const body = [
    ...u16(segCount * 2), ...u16(0), ...u16(0), ...u16(0),
    ...ends.flatMap(u16), ...u16(0), ...starts.flatMap(u16), ...deltas.flatMap(u16), ...rangeOffsets.flatMap(u16), ...glyphIds.flatMap(u16),
  ];
  return cmapTable([...u16(4), ...u16(6 + body.length), ...u16(0), ...body]);
}

/**
 * A WOFF2 file: an arbitrary-tag table, a transformed glyf table (it carries a
 * transformLength) and the cmap, so the reader must walk the directory to find it.
 */
function woff2(cmap) {
  const tables = [
    { dir: [0x3f, ..."TEST".split("").map((c) => c.charCodeAt(0)), ...base128(5)], data: Buffer.alloc(5, 7) },
    { dir: [10, ...base128(300), ...base128(3)], data: Buffer.alloc(3, 9) },
    { dir: [0, ...base128(cmap.length)], data: cmap },
  ];
  const directory = Buffer.from(tables.flatMap((t) => t.dir));
  const compressed = brotliCompressSync(Buffer.concat(tables.map((t) => t.data)));
  const header = Buffer.alloc(48);
  header.write("wOF2", 0, "latin1");
  header.write("OTTO", 4, "latin1");
  header.writeUInt32BE(48 + directory.length + compressed.length, 8);
  header.writeUInt16BE(tables.length, 12);
  header.writeUInt32BE(compressed.length, 20);
  return Buffer.concat([header, directory, compressed]);
}

const fontFor = (codePoints) => woff2(cmap12(codePoints));

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "presenterfont-"));
  roots.push(root);
  return root;
}
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function put(root, rel, value) {
  const file = join(root, ...(Array.isArray(rel) ? rel : [rel]));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, value);
}

/** Runs main() with writers that collect its stdout / stderr. */
async function capture(fn) {
  const out = [];
  const err = [];
  const io = { stdout: (text) => out.push(text), stderr: (text) => err.push(text) };
  const status = await fn(io);
  return { status, stdout: out.join(""), stderr: err.join("") };
}

const story = (slug, extra = {}) => ({
  id: `story:${slug}`,
  state: "ready",
  title: { ko: "해와 달", romanization: "haewa dal", en: "The Sun and the Moon" },
  keywords: [{ id: "kw-1", ko: "호랑이", romanization: "horangi", en: "tiger" }],
  tiers: [
    {
      level: "listen",
      scenes: [
        { id: "s1", keyword: { ko: "떡", romanization: "tteok", en: "rice cake" } },
        { id: "s2", line: { ko: "엄마!", romanization: "eomma!", en: "Mom!" } },
      ],
      checks: [
        {
          id: "c1",
          target: { ko: "밧줄", romanization: "batjul", en: "rope" },
          options: [{ ko: "하늘", romanization: "haneul", en: "sky", isCorrect: true }, { en: "sea", isCorrect: false }],
        },
      ],
    },
  ],
  facts: [{ claimKo: "사실 문장은 발표 화면에 나오지 않는다" }],
  review: { language: "native-reviewed", culture: "culture-reviewed" },
  ...extra,
});

const topic = (key, status, words) => ({
  topic: { id: `vocab-topic:${key}`, key, status },
  items: words.map((ko, i) => ({ id: `vocab:${key}-${i}`, ko, romanization: "x", en: "x" })),
});

const FIXTURE = {
  jamo: [
    { id: "a", char: "ㅏ", exampleWordKo: "아이", spokenKo: "아" },
    { id: "kieuk", char: "ㅋ", spokenKo: "카", nameKo: "키읔" },
    { id: "giyeok", char: "ㄱ" },
  ],
  scopes: {
    "minigame:q1": {
      kind: "build-letter",
      syllables: [{ ko: "가", romanization: "ga", jamoChars: ["ㄱ", "ㅓ"] }],
      cardPairs: [{ ko: "나무", en: "tree", romanization: "namu" }],
      storySteps: [{ id: "st1", labelEn: "Wake up", labelKo: "일어나요", romanization: "ireonayo" }, { id: "st2", labelEn: "Eat" }],
      picWord: { boards: [{ pairs: [{ word: { ko: "곰", romanization: "gom", en: "bear" } }] }] },
      dialogue: [{ npcKo: "대화는안나옴", npcEn: "dialogue is not presented", options: [] }],
    },
  },
  quests: [
    {
      steps: [
        { kind: "intro" },
        { kind: "discover", discover: { pages: [{ items: [{ type: "jamo", jamoId: "a" }, { type: "word", word: { ko: "밥", romanization: "bap", en: "rice" } }] }] } },
      ],
    },
  ],
  cards: [{ id: "card:a", subtitleKo: "한복" }, { id: "card:b" }],
  extra: ["잠깐"],
  topicFiles: [
    { name: "content/vocab/food.json", json: topic("food", "ready", ["사과"]) },
    { name: "content/vocab/sports.json", json: topic("sports", "shipped", ["축구"]) },
    { name: "content/vocab/space.json", json: topic("space", "draft", ["우주"]) },
  ],
  stories: [
    { name: "content/stories/sun-moon.json", json: story("sun-moon") },
    { name: "content/stories/draft.json", json: story("draft", { title: { ko: "초안", romanization: "choan", en: "Draft" }, review: { language: "draft", culture: "draft" } }) },
  ],
};

const chars = (strings) => new Set(strings.join(""));

describe("presenterStrings (what the presenter draws in large Korean)", () => {
  const strings = presenterStrings(FIXTURE);
  const all = chars(strings);

  test("takes the letters, their example words and every scope field the slides show", () => {
    for (const s of ["ㅏ", "ㄱ", "아이", "가", "ㅓ", "나무", "일어나요", "곰"]) assert.ok(strings.includes(s), s);
  });

  test("takes each letter's spoken carrier syllable (teacher-says text, Match Sound text prompt), not its name", () => {
    assert.ok(strings.includes("카"));
    assert.ok(!all.has("읔"), "the letter name is never projected (the deck builder speaks in sound mode)");
  });

  test("takes Discover words, card subtitles and the extra presenter words", () => {
    for (const s of ["밥", "한복", "잠깐"]) assert.ok(strings.includes(s), s);
  });

  test("takes vocabulary words of ready and shipped topics only", () => {
    assert.ok(strings.includes("사과"));
    assert.ok(strings.includes("축구"));
    assert.ok(!all.has("우"), "a draft topic's word is not bundled");
  });

  test("takes a listed story's title, keywords, scene Korean and check Korean only", () => {
    for (const s of ["해와 달", "호랑이", "떡", "엄마!", "밧줄", "하늘"]) assert.ok(strings.includes(s), s);
    assert.ok(!all.has("초"), "a story outside the Library gate is not bundled");
    assert.ok(!all.has("실"), "fact text is never presented");
  });

  test("leaves out what the presenter never draws (dialogue)", () => {
    assert.ok(!all.has("대"));
  });

  test("tolerates missing optional fields", () => {
    assert.deepEqual(presenterStrings({}), []);
    assert.deepEqual(presenterStrings({ scopes: { x: { kind: "match-sound" } }, quests: [{ steps: [{ kind: "discover" }] }] }), []);
  });

  test("refuses a story or topic file that is not an object", () => {
    assert.throws(() => presenterStrings({ stories: [{ name: "content/stories/x.json", json: [] }] }), /content\/stories\/x.json/);
    assert.throws(() => presenterStrings({ topicFiles: [{ name: "content/vocab/x.json", json: { items: [] } }] }), /content\/vocab\/x.json/);
  });
});

describe("glyphList and renderGlyphs", () => {
  test("is the sorted set of code points, without control characters", () => {
    assert.deepEqual(glyphList(["나무", "가 나", "\n\t", "가"]), [0x20, 0xac00, 0xb098, 0xbb34]);
  });

  test("reads characters outside the BMP as one code point", () => {
    assert.deepEqual(glyphList(["\u{20000}"]), [0x20000]);
  });

  test("writes one U+ line per code point with the character as a comment, after a header", () => {
    const text = renderGlyphs([0x20, 0x23, 0xac00]);
    const lines = text.trimEnd().split("\n");
    assert.match(lines[0], /^# GENERATED by scripts\/build-presenter-font\.mjs/);
    assert.ok(lines.includes("U+0020  # space"));
    assert.ok(lines.includes("U+0023  # #"));
    assert.ok(lines.includes("U+AC00  # 가"));
    assert.match(text, /3 code points/);
    assert.ok(lines.includes(`# Subsetter: pyftsubset (pip install ${SUBSET_TOOLCHAIN}).`), "names the pinned toolchain");
    assert.match(SUBSET_TOOLCHAIN, /^fonttools==\d+\.\d+\.\d+ brotli==\d+\.\d+\.\d+$/);
    assert.ok(text.endsWith("\n"));
    assert.equal(renderGlyphs([0x20, 0x23, 0xac00]), text, "deterministic");
  });

  test("every non-comment part of the sidecar parses as pyftsubset reads it (text before '#')", () => {
    const text = renderGlyphs(glyphList(["가#나 다"]));
    const parsed = text
      .split("\n")
      .map((l) => l.split("#")[0].trim())
      .filter(Boolean)
      .map((l) => parseInt(l.slice(2), 16));
    assert.deepEqual(parsed, glyphList(["가#나 다"]));
  });
});

describe("woff2CodePoints (the font's character map, read in plain Node)", () => {
  const cps = [0x20, 0x21, 0x3131, 0xac00, 0xd7a3];

  test("reads a format 12 cmap", () => {
    assert.deepEqual([...woff2CodePoints(woff2(cmap12([...cps, 0x20000])))].sort((a, b) => a - b), [...cps, 0x20000]);
  });

  test("reads a format 4 cmap through idDelta and through idRangeOffset, without .notdef entries", () => {
    assert.deepEqual([...woff2CodePoints(woff2(cmap4(cps)))].sort((a, b) => a - b), cps);
    assert.deepEqual([...woff2CodePoints(woff2(cmap4(cps, { viaRange: true, unmapped: [0xb098] })))].sort((a, b) => a - b), cps);
  });

  test("refuses a file that is not a readable WOFF2 font", () => {
    assert.throws(() => woff2CodePoints(Buffer.alloc(1000)), /not a WOFF2 file/);
    const font = fontFor(cps);
    assert.throws(() => woff2CodePoints(font.subarray(0, 52)), /cut short|UIntBase128/);
    const garbled = Buffer.from(font);
    garbled.fill(0xab, garbled.length - 10);
    assert.throws(() => woff2CodePoints(garbled), /decompress|cmap/);
    const collection = Buffer.from(font);
    collection.write("ttcf", 4, "latin1");
    assert.throws(() => woff2CodePoints(collection), /collection/);
  });

  test("refuses a font without a cmap table", () => {
    const header = Buffer.alloc(48);
    header.write("wOF2", 0, "latin1");
    const data = brotliCompressSync(Buffer.alloc(4));
    header.writeUInt16BE(1, 12);
    header.writeUInt32BE(data.length, 20);
    assert.throws(() => woff2CodePoints(Buffer.concat([header, Buffer.from([1, 4]), data])), /no cmap/);
  });
});

describe("main on a temp root (injected content)", () => {
  const loadContent = async () => FIXTURE;
  const fixtureCps = glyphList(presenterStrings(FIXTURE));
  const sidecar = renderGlyphs(fixtureCps);
  const fixtureFont = fontFor(fixtureCps);

  function seeded({ glyphs = sidecar, font = fixtureFont, license = "SIL OPEN FONT LICENSE Version 1.1\n" } = {}) {
    const root = makeRoot();
    if (glyphs !== null) put(root, GLYPHS_REL, glyphs);
    if (font !== null) put(root, FONT_REL, font);
    if (license !== null) put(root, LICENSE_REL, license);
    return root;
  }

  test("--check passes when the sidecar matches the content and the font maps exactly that list", async () => {
    const r = await capture((io) => main(["--check"], seeded(), { ...io, loadContent }));
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /glyph list and font are up to date/);
  });

  test("--check fails when the list was edited by hand and the font not rebuilt", async () => {
    const stale = fontFor(fixtureCps.filter((cp) => cp !== 0xce74));
    const r = await capture((io) => main(["--check"], seeded({ font: stale }), { ...io, loadContent }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=apps\/mobile\/public\/fonts\/hr-presenter-kr\.woff2::the presenter font was not rebuilt/);
    assert.match(r.stdout, /the font lacks U\+CE74 카/);
  });

  test("--check fails when the font maps more than the list", async () => {
    const r = await capture((io) => main(["--check"], seeded({ font: fontFor([...fixtureCps, 0xd7a3]) }), { ...io, loadContent }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /the font also maps U\+D7A3/);
  });

  test("--check fails on a font file it cannot read", async () => {
    const r = await capture((io) => main(["--check"], seeded({ font: Buffer.alloc(1000) }), { ...io, loadContent }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /cannot be read \(not a WOFF2 file\)/);
  });

  test("--check fails when the sidecar's text differs although its code points match", async () => {
    const r = await capture((io) => main(["--check"], seeded({ glyphs: sidecar.replace("# GENERATED", "# EDITED") }), { ...io, loadContent }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /differs from the generated text/);
  });

  test("--check fails on a missing glyph and says how to rebuild", async () => {
    const lines = sidecar.split("\n").filter((l) => !l.startsWith("U+AC00"));
    const r = await capture((io) => main(["--check"], seeded({ glyphs: lines.join("\n") }), { ...io, loadContent }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=apps\/mobile\/public\/fonts\/hr-presenter-kr\.glyphs\.txt::/);
    assert.match(r.stdout, /U\+AC00 가/);
    assert.match(r.stdout, /node scripts\/build-presenter-font\.mjs --source/);
  });

  test("--check names a glyph the content no longer uses", async () => {
    const r = await capture((io) => main(["--check"], seeded({ glyphs: renderGlyphs([...glyphList(presenterStrings(FIXTURE)), 0xd7a3]) }), { ...io, loadContent }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /no longer used: U\+D7A3/);
  });

  test("--check fails when the sidecar, the font or the licence file is missing", async () => {
    for (const missing of ["glyphs", "font", "license"]) {
      const r = await capture((io) => main(["--check"], seeded({ [missing]: null }), { ...io, loadContent }));
      assert.equal(r.status, 1, missing);
      assert.match(r.stdout, /::error/);
    }
  });

  test("--check reports a content error", async () => {
    const broken = async () => ({ stories: [{ name: "content/stories/x.json", json: null }] });
    const r = await capture((io) => main(["--check"], seeded(), { ...io, loadContent: broken }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error::content\/stories\/x.json/);
  });

  test("--report prints the size against the budget and fails over it", async () => {
    const ok = await capture((io) => main(["--report"], seeded({ font: Buffer.alloc(1000) }), { ...io, loadContent }));
    assert.equal(ok.status, 0);
    assert.match(ok.stdout, /1000 bytes .* budget 150000 bytes/);
    const big = await capture((io) => main(["--report"], seeded({ font: Buffer.alloc(BUDGET_BYTES + 1) }), { ...io, loadContent }));
    assert.equal(big.status, 1);
    assert.match(big.stdout, /over the 150000-byte budget/);
    assert.match(big.stdout, /story body lines/);
    const none = await capture((io) => main(["--report"], seeded({ font: null }), { ...io, loadContent }));
    assert.equal(none.status, 1);
  });

  test("usage errors exit 2", async () => {
    assert.equal((await capture((io) => main(["--nope"], seeded(), { ...io, loadContent }))).status, 2);
    assert.equal((await capture((io) => main(["--source"], seeded(), { ...io, loadContent }))).status, 2);
    const noSource = await capture((io) => main([], seeded(), { ...io, loadContent }));
    assert.equal(noSource.status, 2);
    assert.match(noSource.stderr, /--source/);
  });

  test("a build refuses a source font that is not the pinned release file", async () => {
    const root = seeded();
    const src = join(root, "NotoSansKR-Bold.otf");
    writeFileSync(src, "not the font");
    let ran = false;
    const r = await capture((io) => main(["--source", src], root, { ...io, loadContent, runSubset: () => { ran = true; return { status: 0 }; } }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /SHA-256/);
    assert.match(r.stdout, new RegExp(SOURCE_FONT.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(ran, false);
  });

  test("a build refuses a missing source file", async () => {
    const r = await capture((io) => main(["--source", "/nope/NotoSansKR-Bold.otf"], seeded(), { ...io, loadContent }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /not found/);
  });

  const outputOf = (args) => args.find((a) => a.startsWith("--output-file=")).slice("--output-file=".length);
  const listOf = (args) => args.find((a) => a.startsWith("--unicodes-file=")).slice("--unicodes-file=".length);

  /** A subsetter that writes `font` (default: a font of the list it was given). */
  const fakeSubset = (calls, font) => (args) => {
    const listed = readFileSync(listOf(args), "utf8");
    calls.push({ args, listed });
    const cps = listed.split("\n").map((l) => l.split("#")[0].trim()).filter(Boolean).map((l) => parseInt(l.slice(2), 16));
    writeFileSync(outputOf(args), font ?? fontFor(cps));
    return { status: 0 };
  };

  test("a build runs the subsetter on a temporary list, then writes the font and the sidecar and reports the size", async () => {
    const root = seeded({ glyphs: null, font: null });
    const src = join(root, "src.otf");
    writeFileSync(src, "pinned bytes");
    const sha = createHash("sha256").update("pinned bytes").digest("hex");
    const calls = [];
    const r = await capture((io) => main(["--source", src], root, { ...io, loadContent, runSubset: fakeSubset(calls), expectedSha256: sha }));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(readFileSync(join(root, ...GLYPHS_REL), "utf8"), sidecar);
    assert.deepEqual(readFileSync(join(root, ...FONT_REL)), fixtureFont);
    assert.equal(calls.length, 1);
    const [{ args, listed }] = calls;
    assert.equal(args[0], src);
    assert.equal(listed, sidecar, "the subsetter reads the generated list");
    assert.notEqual(listOf(args), join(root, ...GLYPHS_REL), "the committed sidecar is not written before the subset");
    assert.notEqual(outputOf(args), join(root, ...FONT_REL), "the committed font is not written before the subset");
    assert.equal(existsSync(listOf(args)), false, "the temporary files are removed");
    assert.ok(args.includes("--flavor=woff2"));
    assert.ok(args.includes("--no-ignore-missing-unicodes"), "a glyph missing from the source fails the build");
    assert.ok(args.some((a) => a.startsWith("--name-IDs=") && a.includes("13") && a.includes("14")), "keeps the licence name records");
    assert.match(r.stdout, new RegExp(`${fixtureFont.length} bytes`));
    const again = await capture((io) => main(["--check"], root, { ...io, loadContent }));
    assert.equal(again.status, 0, again.stdout);
  });

  test("a failed or wrong subset leaves the committed font and sidecar as they were", async () => {
    const oldGlyphs = renderGlyphs(fixtureCps.filter((cp) => cp !== 0xce74));
    const oldFont = fontFor(fixtureCps.filter((cp) => cp !== 0xce74));
    const root = seeded({ glyphs: oldGlyphs, font: oldFont });
    const src = join(root, "src.otf");
    writeFileSync(src, "pinned bytes");
    const sha = createHash("sha256").update("pinned bytes").digest("hex");
    const unchanged = (label) => {
      assert.equal(readFileSync(join(root, ...GLYPHS_REL), "utf8"), oldGlyphs, label);
      assert.deepEqual(readFileSync(join(root, ...FONT_REL)), oldFont, label);
    };
    const failed = await capture((io) => main(["--source", src], root, { ...io, loadContent, expectedSha256: sha, runSubset: () => ({ status: 1, stderr: "brotli not installed" }) }));
    assert.equal(failed.status, 1);
    unchanged("subsetter exit 1");
    const missingTool = await capture((io) => main(["--source", src], root, { ...io, loadContent, expectedSha256: sha, runSubset: () => ({ status: null, error: new Error("spawn pyftsubset ENOENT") }) }));
    assert.equal(missingTool.status, 1);
    unchanged("subsetter missing");
    const wrong = await capture((io) => main(["--source", src], root, { ...io, loadContent, expectedSha256: sha, runSubset: fakeSubset([], oldFont) }));
    assert.equal(wrong.status, 1);
    assert.match(wrong.stdout, /character map is not the glyph list \(lacks U\+CE74/);
    unchanged("font without the new glyph");
    const unreadable = await capture((io) => main(["--source", src], root, { ...io, loadContent, expectedSha256: sha, runSubset: fakeSubset([], Buffer.alloc(10)) }));
    assert.equal(unreadable.status, 1);
    assert.match(unreadable.stdout, /cannot be read/);
    unchanged("unreadable font");
    const check = await capture((io) => main(["--check"], root, { ...io, loadContent }));
    assert.equal(check.status, 1, "--check still fails after the failed builds");
  });

  test("a build fails when the subsetter fails or the result is over the budget", async () => {
    const root = seeded({ font: null });
    const src = join(root, "src.otf");
    writeFileSync(src, "pinned bytes");
    const sha = createHash("sha256").update("pinned bytes").digest("hex");
    const failed = await capture((io) => main(["--source", src], root, { ...io, loadContent, expectedSha256: sha, runSubset: () => ({ status: 1, stderr: "boom" }) }));
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, /pyftsubset failed/);
    const missingTool = await capture((io) => main(["--source", src], root, { ...io, loadContent, expectedSha256: sha, runSubset: () => ({ status: null, error: new Error("spawn pyftsubset ENOENT") }) }));
    assert.equal(missingTool.status, 1);
    assert.match(missingTool.stdout, new RegExp(`pip install ${SUBSET_TOOLCHAIN.replace(/[.]/g, "\\.")}`));
    const big = await capture((io) =>
      main(["--source", src], root, {
        ...io,
        loadContent,
        expectedSha256: sha,
        runSubset: (args) => {
          // A font of the right list, padded past the budget (the reader stops at the compressed data).
          writeFileSync(outputOf(args), Buffer.concat([fixtureFont, Buffer.alloc(BUDGET_BYTES)]));
          return { status: 0 };
        },
      })
    );
    assert.equal(big.status, 1);
    assert.match(big.stdout, /over the 150000-byte budget/);
  });
});

describe("the repository", () => {
  test("the committed glyph list is up to date with the shipped content (--check)", async () => {
    const r = await capture((io) => main(["--check"], REPO, io));
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  test("the committed font maps exactly the committed glyph list", () => {
    const listed = readFileSync(join(REPO, ...GLYPHS_REL), "utf8")
      .split("\n")
      .map((l) => l.split("#")[0].trim())
      .filter(Boolean)
      .map((l) => parseInt(l.slice(2), 16));
    const mapped = [...woff2CodePoints(readFileSync(join(REPO, ...FONT_REL)))].sort((a, b) => a - b);
    assert.deepEqual(mapped, listed);
  });

  test("the committed font is within the budget and is a WOFF2 file", () => {
    const font = readFileSync(join(REPO, ...FONT_REL));
    assert.ok(font.length > 0 && font.length <= BUDGET_BYTES, `${font.length} bytes`);
    assert.equal(font.subarray(0, 4).toString("latin1"), "wOF2");
  });

  test("the SIL Open Font License 1.1 ships beside the font, with the copyright line", () => {
    const text = readFileSync(join(REPO, ...LICENSE_REL), "utf8");
    assert.match(text, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.match(text, /Adobe/);
  });

  test("the register of shipped assets lists the font with its licence and source", () => {
    const rows = readFileSync(join(REPO, "content", "assets-license.csv"), "utf8").trim().split("\n");
    const row = rows.find((r) => r.startsWith(`${FONT_REL.join("/")},`));
    assert.ok(row, "a row for the font");
    assert.match(row, /,font,/);
    assert.match(row, /SIL OFL 1\.1/);
    assert.ok(row.includes(SOURCE_FONT.url));
    assert.ok(existsSync(join(REPO, ...GLYPHS_REL)));
  });
});
