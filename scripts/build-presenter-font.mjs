#!/usr/bin/env node
// F-TCH-004 §3.6 (TD4) — the lecture presenter's Hangul subset font (PR 3).
//
// Large Korean on a projector (letter glyph, syllable, vocabulary word, story keyword,
// quiz option) is drawn with "HR Presenter KR": a subset of Noto Sans KR Bold (SIL Open
// Font License 1.1) holding only the characters the presenter can show. Both outputs are
// committed beside the licence:
//
//   apps/mobile/public/fonts/hr-presenter-kr.woff2        the subset (budget 150 000 bytes)
//   apps/mobile/public/fonts/hr-presenter-kr.glyphs.txt   the code points it was built from
//   apps/mobile/public/fonts/OFL.txt                      the licence (shipped with the font)
//
// The glyph list is derived from shipped content: every Hangul letter, its example word,
// its spoken carrier syllable (the teacher-says text and the Match Sound text prompt,
// §3.7 / §3.3), the scope fields the slides draw (syllables, card pairs, Pic-Word words, sequence
// labels), Discover words, heritage card subtitles, the Pause word, the words of ready
// vocabulary topics, and the title, keywords, scene Korean and check Korean of the
// stories the Library lists (the same production gate as build-lecture-catalogue.mjs).
// Only taught Korean uses the subset: UI-language text (titles, card facts, glosses) and
// the teacher-typed deck title use the system Korean stack, so they are not in the list.
// apps/mobile/src/logic/lecture/__tests__/presenter-glyphs.test.ts expands every shipped
// quest and episode with the deck builder and fails on a projected Hangul glyph that is
// not in the sidecar, so this field list cannot quietly fall behind the slides.
//
// Usage:
//   node scripts/build-presenter-font.mjs --source <NotoSansKR-Bold.otf>
//       rebuild: subset the pinned source with pyftsubset (pip install fonttools==4.66.1
//       brotli==1.2.0; a dev-time tool, CI never needs it), then write the glyph list
//       (only after the subset succeeded) and report bytes
//   node scripts/build-presenter-font.mjs --check
//       fail if the committed glyph list differs from the content, if the committed font's
//       character map is not exactly that list, or if a committed file is missing (CI;
//       plain Node: node:zlib decompresses the WOFF2 tables and the cmap is read here, so
//       CI needs no Python)
//   node scripts/build-presenter-font.mjs --report
//       print the font's size and fail over the budget
//
// Over the budget, the §3.6 fallback ladder applies: story body lines (40-unit text)
// leave the glyph list and fall back to the system font; only display-size strings
// keep the subset. Exit 0 when built / in sync, 1 on a content, drift, build or budget
// error, 2 on a usage error. HANGUL_ROUTE_ROOT overrides the repo root.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isListedStory } from "./build-lecture-catalogue.mjs";

const FONT_DIR = ["apps", "mobile", "public", "fonts"];
export const FONT_REL = [...FONT_DIR, "hr-presenter-kr.woff2"];
export const GLYPHS_REL = [...FONT_DIR, "hr-presenter-kr.glyphs.txt"];
export const LICENSE_REL = [...FONT_DIR, "OFL.txt"];

/** §3.6 budget: 150 KB, counted as 150 000 bytes (the stricter reading). */
export const BUDGET_BYTES = 150_000;

/** The one source file a build accepts (official notofonts release; licence re-confirmed from the shipped LICENSE and name ID 13). */
export const SOURCE_FONT = {
  file: "NotoSansKR-Bold.otf",
  release: "notofonts/noto-cjk Sans2.004",
  archive: "17_NotoSansKR.zip",
  url: "https://github.com/notofonts/noto-cjk/releases/download/Sans2.004/17_NotoSansKR.zip",
  sha256: "5a6ceb287ed2fc6cfc6213144ebea68cbd94b20fc9eb873d8486493bf02d9bda",
};

/** The subsetter a build was made with; pinned so a rebuild of the same list gives the same bytes. */
export const SUBSET_TOOLCHAIN = "fonttools==4.66.1 brotli==1.2.0";

/** Vocabulary topics the console offers (same gate as build-lecture-catalogue.mjs). */
const LISTED_TOPIC_STATUS = new Set(["ready", "shipped"]);

class ContentError extends Error {}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const list = (value) => (Array.isArray(value) ? value : []);

// ---- glyph list (pure) -------------------------------------------------------------

/**
 * Every Korean string the presenter can draw from this content. Inputs are plain data:
 * `jamo` (jamoKnown), `scopes` (minigameScopes), `quests` (questsAll), `cards`
 * (heritageCardsAll), `extra` (presenter words such as the Pause word), `topicFiles`
 * and `stories` ({ name, json } per content file).
 */
export function presenterStrings({ jamo, scopes, quests, cards, extra, topicFiles, stories } = {}) {
  const out = [];
  const add = (value) => {
    if (typeof value === "string" && value.length > 0) out.push(value);
  };

  for (const j of list(jamo)) {
    add(j.char);
    add(j.exampleWordKo);
    add(j.spokenKo);
  }
  for (const scope of Object.values(isObject(scopes) ? scopes : {})) {
    for (const s of list(scope.syllables)) {
      add(s.ko);
      list(s.jamoChars).forEach(add);
    }
    for (const pair of list(scope.cardPairs)) add(pair.ko);
    for (const board of list(scope.picWord?.boards)) for (const pair of list(board.pairs)) add(pair.word?.ko);
    for (const step of list(scope.storySteps)) add(step.labelKo);
    // F-CURR-001 §3.12: the Korean of the upper-stage lesson scopes (build-lessons.mjs runtime shape).
    for (const round of list(scope.orderIt?.rounds)) {
      add(round.sentence?.ko);
      list(round.distractors).forEach((d) => add(d?.ko));
      list(round.particle?.choices).forEach((c) => add(c?.ko));
    }
    const realia = scope.realiaRead?.realia;
    add(realia?.title?.ko);
    for (const entry of list(realia?.entries)) {
      add(entry.text?.ko);
      add(entry.value?.ko);
    }
    for (const round of list(scope.realiaRead?.rounds)) for (const option of list(round.options)) add(option.text?.ko);
    for (const round of list(scope.typeHangul?.rounds)) add(round.target?.ko);
    for (const round of list(scope.traceWord?.rounds)) add(round.word?.ko);
    for (const round of list(scope.writeFrame?.rounds)) {
      add(round.frame?.ko);
      for (const slot of list(round.slots)) list(slot.bank).forEach((w) => add(w?.ko));
    }
  }
  for (const quest of list(quests)) {
    for (const step of list(quest.steps)) {
      for (const page of list(step.discover?.pages)) {
        for (const item of list(page.items)) {
          if (item.type === "word") add(item.word?.ko);
          // F-CURR-001 §3.10: the upper-stage Discover items the lecture deck shows (discoverItemTexts).
          if (item.type === "sentence") add(item.sentence?.ko);
          if (item.type === "pattern") list(item.examples).forEach((e) => add(e?.ko));
          if (item.type === "exchange") list(item.lines).forEach((l) => add(l?.line?.ko));
          if (item.type === "realia") list(item.keyWords).forEach((w) => add(w?.ko));
        }
      }
    }
  }
  for (const card of list(cards)) add(card.subtitleKo);
  list(extra).forEach(add);

  for (const { name, json } of list(topicFiles)) {
    if (!isObject(json) || !isObject(json.topic)) throw new ContentError(`${name}: a topic file needs a topic object`);
    if (!LISTED_TOPIC_STATUS.has(json.topic.status)) continue;
    for (const item of list(json.items)) add(item.ko);
  }
  for (const { name, json } of list(stories)) {
    if (!isObject(json)) throw new ContentError(`${name}: a story file must hold one JSON object`);
    if (!isListedStory(json)) continue;
    add(json.title?.ko);
    for (const kw of list(json.keywords)) add(kw.ko);
    for (const tier of list(json.tiers)) {
      for (const scene of list(tier.scenes)) {
        add(scene.line?.ko);
        add(scene.keyword?.ko);
      }
      for (const check of list(tier.checks)) {
        add(check.target?.ko);
        for (const option of list(check.options)) add(option.ko);
      }
    }
  }
  return out;
}

/** The sorted set of code points in `strings`, without control characters. */
export function glyphList(strings) {
  const set = new Set();
  for (const s of strings) {
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x20 && !(cp >= 0x7f && cp < 0xa0)) set.add(cp);
    }
  }
  return [...set].sort((a, b) => a - b);
}

const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
const shown = (cp) => (cp === 0x20 ? "space" : String.fromCodePoint(cp));

/** The sidecar text: pyftsubset reads it with --unicodes-file (anything after '#' is a comment). */
export function renderGlyphs(codePoints) {
  return [
    "# GENERATED by scripts/build-presenter-font.mjs — do not edit.",
    `# Glyph list of hr-presenter-kr.woff2 (F-TCH-004 §3.6): ${codePoints.length} code points.`,
    "# Rebuild with `node scripts/build-presenter-font.mjs --source <NotoSansKR-Bold.otf>` after a content change.",
    `# Subsetter: pyftsubset (pip install ${SUBSET_TOOLCHAIN}).`,
    ...codePoints.map((cp) => `${hex(cp)}  # ${shown(cp)}`),
    "",
  ].join("\n");
}

function parseGlyphs(text) {
  return new Set(
    text
      .split("\n")
      .map((line) => line.split("#")[0].trim())
      .filter((part) => /^U\+[0-9A-F]{4,6}$/i.test(part))
      .map((part) => parseInt(part.slice(2), 16))
  );
}

// ---- WOFF2 character map (pure) --------------------------------------------------------

/** WOFF2 known-table index of glyf / loca (their transform version 0 means "transformed"). */
const GLYF_LOCA = new Set([10, 11]);

class FontError extends Error {}

function readBase128(buf, at) {
  let value = 0;
  for (let i = 0; i < 5; i += 1) {
    if (at.pos >= buf.length) break;
    const byte = buf[at.pos++];
    if (i === 0 && byte === 0x80) throw new FontError("bad UIntBase128 in the WOFF2 table directory");
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new FontError("bad UIntBase128 in the WOFF2 table directory");
}

function cmapCodePoints(cmap) {
  const set = new Set();
  if (cmap.length < 4) throw new FontError("the cmap table is too short");
  const numTables = cmap.readUInt16BE(2);
  for (let t = 0; t < numTables; t += 1) {
    const offset = cmap.readUInt32BE(4 + t * 8 + 4);
    const format = cmap.readUInt16BE(offset);
    if (format === 4) {
      const segCount = cmap.readUInt16BE(offset + 6) / 2;
      const ends = offset + 14;
      const starts = ends + segCount * 2 + 2;
      const deltas = starts + segCount * 2;
      const ranges = deltas + segCount * 2;
      for (let i = 0; i < segCount; i += 1) {
        const end = cmap.readUInt16BE(ends + i * 2);
        const start = cmap.readUInt16BE(starts + i * 2);
        const delta = cmap.readUInt16BE(deltas + i * 2);
        const rangeAt = ranges + i * 2;
        const rangeOffset = cmap.readUInt16BE(rangeAt);
        for (let c = start; c <= end && c !== 0xffff; c += 1) {
          let glyph;
          if (rangeOffset === 0) glyph = (c + delta) & 0xffff;
          else {
            const raw = cmap.readUInt16BE(rangeAt + rangeOffset + (c - start) * 2);
            glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
          }
          if (glyph !== 0) set.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(offset + 12);
      for (let g = 0; g < groups; g += 1) {
        const at = offset + 16 + g * 12;
        const start = cmap.readUInt32BE(at);
        const end = cmap.readUInt32BE(at + 4);
        const startGlyph = cmap.readUInt32BE(at + 8);
        for (let c = start; c <= end; c += 1) if (startGlyph + (c - start) !== 0) set.add(c);
      }
    }
  }
  return set;
}

/**
 * The code points a WOFF2 font maps to a glyph (its cmap, formats 4 and 12). Tables sit
 * unpadded in the Brotli stream in directory order; cmap is never transformed.
 */
export function woff2CodePoints(buf) {
  if (buf.length < 48 || buf.toString("latin1", 0, 4) !== "wOF2") throw new FontError("not a WOFF2 file");
  if (buf.toString("latin1", 4, 8) === "ttcf") throw new FontError("a font collection is not supported");
  const numTables = buf.readUInt16BE(12);
  const compressedLength = buf.readUInt32BE(20);
  const at = { pos: 48 };
  let offset = 0;
  let cmap;
  for (let i = 0; i < numTables; i += 1) {
    if (at.pos >= buf.length) throw new FontError("the WOFF2 table directory is cut short");
    const flags = buf[at.pos++];
    const index = flags & 0x3f;
    const version = flags >> 6;
    let tag = index;
    if (index === 0x3f) {
      tag = buf.toString("latin1", at.pos, at.pos + 4);
      at.pos += 4;
    }
    const origLength = readBase128(buf, at);
    const transformed = GLYF_LOCA.has(index) ? version === 0 : version !== 0;
    const length = transformed ? readBase128(buf, at) : origLength;
    if (tag === 0 || tag === "cmap") cmap = { offset, length };
    offset += length;
  }
  if (cmap === undefined) throw new FontError("the font has no cmap table");
  let data;
  try {
    data = brotliDecompressSync(buf.subarray(at.pos, at.pos + compressedLength));
  } catch (error) {
    throw new FontError(`the WOFF2 data does not decompress: ${error.message}`);
  }
  if (cmap.offset + cmap.length > data.length) throw new FontError("the cmap table runs past the font data");
  try {
    return cmapCodePoints(data.subarray(cmap.offset, cmap.offset + cmap.length));
  } catch (error) {
    if (error instanceof FontError) throw error;
    throw new FontError(`the cmap table is malformed: ${error.message}`);
  }
}

/** The font's code points against the list: what it lacks and what it has beyond it. */
function fontDiff(fontFile, codePoints) {
  const have = woff2CodePoints(readFileSync(fontFile));
  const want = new Set(codePoints);
  return {
    lacks: codePoints.filter((cp) => !have.has(cp)),
    extra: [...have].filter((cp) => !want.has(cp)).sort((a, b) => a - b),
  };
}

// ---- content loading (file system) ---------------------------------------------------

function readJsonDir(root, rel, accept) {
  const dir = join(root, ...rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".json") && accept(e.name))
    .map((e) => e.name)
    .sort()
    .map((name) => {
      const file = join(dir, name);
      const relName = relative(root, file).split(sep).join("/");
      try {
        return { name: relName, json: JSON.parse(readFileSync(file, "utf8")) };
      } catch (error) {
        throw new ContentError(`${relName}: not valid JSON: ${error.message}`);
      }
    });
}

let loaderRegistered = false;

/** The bundled learner content (TypeScript, through scripts/ts-loader.mjs) plus the story and vocabulary JSON. */
export async function loadRepoContent(root) {
  if (!loaderRegistered) {
    register(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "ts-loader.mjs")));
    loaderRegistered = true;
  }
  const load = (rel) => import(pathToFileURL(join(root, ...rel.split("/"))).href);
  const [content, config, lecture, ...lessonStages] = await Promise.all([
    load("apps/mobile/src/content/index.ts"),
    load("apps/mobile/src/logic/minigame-config.ts"),
    load("apps/mobile/src/logic/lecture/content.ts"),
    // F-CURR-001 §3.12: the scopes of the generated lesson modules (the lesson quests come with questsAll).
    ...[2, 3, 4, 6, 7].map((n) => load(`apps/mobile/src/content/__generated__/lessons-stage${n}.ts`)),
  ]);
  return {
    jamo: content.jamoKnown, // the Stage 1 symbols and the Word Builder ones (F-CURR-001 S2-1)
    scopes: Object.assign({}, config.minigameScopes, ...lessonStages.map((m) => m.LESSON_SCOPES)),
    quests: content.questsAll,
    cards: content.heritageCardsAll,
    extra: [lecture.PAUSE_WORD.ko],
    topicFiles: readJsonDir(root, ["content", "vocab"], (name) => !name.startsWith("_")),
    stories: readJsonDir(root, ["content", "stories"], () => true),
  };
}

function defaultRunSubset(args) {
  // PYTHONUTF8: the sidecar's comments hold Hangul; pyftsubset opens it with the locale encoding.
  return spawnSync(process.env.PYFTSUBSET ?? "pyftsubset", args, { encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" } });
}

// ---- CLI -------------------------------------------------------------------------------

const USAGE = "Usage: node scripts/build-presenter-font.mjs --source <NotoSansKR-Bold.otf> | --check | --report";
const REBUILD = `node scripts/build-presenter-font.mjs --source <${SOURCE_FONT.file} from ${SOURCE_FONT.url}> (pip install ${SUBSET_TOOLCHAIN})`;
const LADDER =
  "F-TCH-004 §3.6 fallback ladder: leave story body lines (40-unit text) out of the glyph list so they use the system font, and keep the subset for display-size strings";

function relOf(root, rel) {
  return relative(root, join(root, ...rel)).split(sep).join("/");
}

function reportSize(root, out) {
  const file = join(root, ...FONT_REL);
  const rel = relOf(root, FONT_REL);
  if (!existsSync(file)) {
    out(`::error file=${rel}::presenter font is missing; run ${REBUILD}\n`);
    return 1;
  }
  const bytes = statSync(file).size;
  if (bytes > BUDGET_BYTES) {
    out(`::error file=${rel}::${bytes} bytes is over the ${BUDGET_BYTES}-byte budget. ${LADDER}.\n`);
    return 1;
  }
  out(`${rel}: ${bytes} bytes (${((100 * bytes) / BUDGET_BYTES).toFixed(1)} % of the budget ${BUDGET_BYTES} bytes)\n`);
  return 0;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/**
 * `deps` (tests): `loadContent(root)`, `runSubset(args)` (returns spawnSync's shape) and
 * `expectedSha256` (the pinned source hash); `stdout` / `stderr` writers.
 */
export async function main(argv, root, deps = {}) {
  const { loadContent = loadRepoContent, runSubset = defaultRunSubset, expectedSha256 = SOURCE_FONT.sha256 } = deps;
  const out = deps.stdout ?? ((text) => process.stdout.write(text));
  const err = deps.stderr ?? ((text) => process.stderr.write(text));
  let mode = "build";
  let source;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") mode = "check";
    else if (arg === "--report") mode = "report";
    else if (arg === "--source" && argv[i + 1] !== undefined) source = argv[++i];
    else {
      err(`unknown or incomplete argument ${arg}\n${USAGE}\n`);
      return 2;
    }
  }
  if (mode === "report") return reportSize(root, out);
  if (mode === "build" && source === undefined) {
    err(`a build needs --source <${SOURCE_FONT.file}> (${SOURCE_FONT.release}: ${SOURCE_FONT.url})\n${USAGE}\n`);
    return 2;
  }

  let codePoints;
  try {
    codePoints = glyphList(presenterStrings(await loadContent(root)));
  } catch (error) {
    out(`::error::${error.message}\n`);
    return 1;
  }
  const sidecar = renderGlyphs(codePoints);
  const glyphsFile = join(root, ...GLYPHS_REL);
  const glyphsRel = relOf(root, GLYPHS_REL);

  if (mode === "check") {
    if (!existsSync(glyphsFile)) {
      out(`::error file=${glyphsRel}::presenter glyph list is missing; run ${REBUILD}\n`);
      return 1;
    }
    const committed = readFileSync(glyphsFile, "utf8");
    if (committed !== sidecar) {
      const have = parseGlyphs(committed);
      const want = new Set(codePoints);
      const missing = codePoints.filter((cp) => !have.has(cp));
      const unused = [...have].filter((cp) => !want.has(cp)).sort((a, b) => a - b);
      const parts = [];
      if (missing.length > 0) parts.push(`missing from the font: ${missing.map((cp) => `${hex(cp)} ${shown(cp)}`).join(", ")}`);
      if (unused.length > 0) parts.push(`no longer used: ${unused.map((cp) => `${hex(cp)} ${shown(cp)}`).join(", ")}`);
      if (parts.length === 0) parts.push("the file differs from the generated text");
      out(
        `::error file=${glyphsRel}::presenter glyph list is out of date with the shipped content (${parts.join("; ")}); run ${REBUILD} and commit the font and the list\n`
      );
      return 1;
    }
    for (const rel of [FONT_REL, LICENSE_REL]) {
      if (!existsSync(join(root, ...rel))) {
        out(`::error file=${relOf(root, rel)}::${relOf(root, rel)} is missing; run ${REBUILD}\n`);
        return 1;
      }
    }
    const fontRel = relOf(root, FONT_REL);
    let diff;
    try {
      diff = fontDiff(join(root, ...FONT_REL), codePoints);
    } catch (error) {
      out(`::error file=${fontRel}::the presenter font cannot be read (${error.message}); run ${REBUILD}\n`);
      return 1;
    }
    if (diff.lacks.length > 0 || diff.extra.length > 0) {
      const parts = [];
      if (diff.lacks.length > 0) parts.push(`the font lacks ${diff.lacks.map((cp) => `${hex(cp)} ${shown(cp)}`).join(", ")}`);
      if (diff.extra.length > 0) parts.push(`the font also maps ${diff.extra.map((cp) => `${hex(cp)} ${shown(cp)}`).join(", ")}`);
      out(
        `::error file=${fontRel}::the presenter font was not rebuilt from the glyph list (${parts.join("; ")}); run ${REBUILD} and commit the font and the list\n`
      );
      return 1;
    }
    out(`presenter glyph list and font are up to date (${codePoints.length} code points)\n`);
    return 0;
  }

  // build
  if (!existsSync(source)) {
    out(`::error::source font ${source} not found; download ${SOURCE_FONT.archive} from ${SOURCE_FONT.url}\n`);
    return 1;
  }
  const actual = sha256(source);
  if (actual !== expectedSha256) {
    out(
      `::error::${source} has SHA-256 ${actual}, not the pinned ${SOURCE_FONT.file} of ${SOURCE_FONT.release} (${expectedSha256}); download ${SOURCE_FONT.url}\n`
    );
    return 1;
  }
  // The subsetter reads a temporary copy of the list and writes a temporary font; the committed
  // font and sidecar change together, and only once the subset is built and verified.
  const fontFile = join(root, ...FONT_REL);
  const work = mkdtempSync(join(tmpdir(), "hr-presenter-font-"));
  try {
    const listFile = join(work, "glyphs.txt");
    const builtFile = join(work, "font.woff2");
    writeFileSync(listFile, sidecar);
    const result = runSubset([
      source,
      `--unicodes-file=${listFile}`,
      `--output-file=${builtFile}`,
      "--flavor=woff2",
      "--no-ignore-missing-unicodes",
      // Keep the copyright, names, and the licence description and URL (OFL 1.1 travels with the font).
      "--name-IDs=0,1,2,3,4,5,6,13,14",
      "--desubroutinize",
    ]);
    if (result.error || result.status !== 0) {
      const why = result.error ? `${result.error.message}; pip install ${SUBSET_TOOLCHAIN} (or set PYFTSUBSET)` : String(result.stderr ?? "").trim();
      out(`::error::pyftsubset failed: ${why}\n`);
      return 1;
    }
    let diff;
    try {
      diff = fontDiff(builtFile, codePoints);
    } catch (error) {
      out(`::error::pyftsubset wrote a font that cannot be read: ${error.message}\n`);
      return 1;
    }
    if (diff.lacks.length > 0 || diff.extra.length > 0) {
      out(`::error::pyftsubset wrote a font whose character map is not the glyph list (lacks ${diff.lacks.map(hex).join(", ") || "none"}; extra ${diff.extra.map(hex).join(", ") || "none"})\n`);
      return 1;
    }
    mkdirSync(dirname(glyphsFile), { recursive: true });
    writeFileSync(fontFile, readFileSync(builtFile));
    writeFileSync(glyphsFile, sidecar);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  out(`wrote ${glyphsRel}: ${codePoints.length} code points\n`);
  return reportSize(root, out);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : join(dirname(fileURLToPath(import.meta.url)), "..");
  process.exitCode = await main(process.argv.slice(2), root);
}
