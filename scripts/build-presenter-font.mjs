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
// the scope fields the slides draw (syllables, card pairs, Pic-Word words, sequence
// labels), Discover words, heritage card subtitles, the Pause word, the words of ready
// vocabulary topics, and the title, keywords, scene Korean and check Korean of the
// stories the Library lists (the same production gate as build-lecture-catalogue.mjs).
//
// Usage:
//   node scripts/build-presenter-font.mjs --source <NotoSansKR-Bold.otf>
//       rebuild: write the glyph list, subset the pinned source with pyftsubset
//       (pip install fonttools brotli; a dev-time tool, CI never needs it), report bytes
//   node scripts/build-presenter-font.mjs --check
//       fail if the committed glyph list differs from the content (CI; plain text, so
//       CI needs neither Python nor a font parser), or a committed file is missing
//   node scripts/build-presenter-font.mjs --report
//       print the font's size and fail over the budget
//
// Over the budget, the §3.6 fallback ladder applies: story body lines (40-unit text)
// leave the glyph list and fall back to the system font; only display-size strings
// keep the subset. Exit 0 when built / in sync, 1 on a content, drift, build or budget
// error, 2 on a usage error. HANGUL_ROUTE_ROOT overrides the repo root.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
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

/** Vocabulary topics the console offers (same gate as build-lecture-catalogue.mjs). */
const LISTED_TOPIC_STATUS = new Set(["ready", "shipped"]);

class ContentError extends Error {}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const list = (value) => (Array.isArray(value) ? value : []);

// ---- glyph list (pure) -------------------------------------------------------------

/**
 * Every Korean string the presenter can draw from this content. Inputs are plain data:
 * `jamo` (jamoAll), `scopes` (minigameScopes), `quests` (questsAll), `cards`
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
  }
  for (const scope of Object.values(isObject(scopes) ? scopes : {})) {
    for (const s of list(scope.syllables)) {
      add(s.ko);
      list(s.jamoChars).forEach(add);
    }
    for (const pair of list(scope.cardPairs)) add(pair.ko);
    for (const board of list(scope.picWord?.boards)) for (const pair of list(board.pairs)) add(pair.word?.ko);
    for (const step of list(scope.storySteps)) add(step.labelKo);
  }
  for (const quest of list(quests)) {
    for (const step of list(quest.steps)) {
      for (const page of list(step.discover?.pages)) {
        for (const item of list(page.items)) if (item.type === "word") add(item.word?.ko);
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
  const [content, config, lecture] = await Promise.all([
    load("apps/mobile/src/content/index.ts"),
    load("apps/mobile/src/logic/minigame-config.ts"),
    load("apps/mobile/src/logic/lecture/content.ts"),
  ]);
  return {
    jamo: content.jamoAll,
    scopes: config.minigameScopes,
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
const REBUILD = `node scripts/build-presenter-font.mjs --source <${SOURCE_FONT.file} from ${SOURCE_FONT.url}>`;
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
    out(`presenter glyph list is up to date (${codePoints.length} code points)\n`);
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
  mkdirSync(dirname(glyphsFile), { recursive: true });
  writeFileSync(glyphsFile, sidecar);
  const fontFile = join(root, ...FONT_REL);
  const result = runSubset([
    source,
    `--unicodes-file=${glyphsFile}`,
    `--output-file=${fontFile}`,
    "--flavor=woff2",
    "--no-ignore-missing-unicodes",
    // Keep the copyright, names, and the licence description and URL (OFL 1.1 travels with the font).
    "--name-IDs=0,1,2,3,4,5,6,13,14",
    "--desubroutinize",
  ]);
  if (result.error || result.status !== 0) {
    const why = result.error ? `${result.error.message}; pip install fonttools brotli (or set PYFTSUBSET)` : String(result.stderr ?? "").trim();
    out(`::error::pyftsubset failed: ${why}\n`);
    return 1;
  }
  out(`wrote ${glyphsRel}: ${codePoints.length} code points\n`);
  return reportSize(root, out);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : join(dirname(fileURLToPath(import.meta.url)), "..");
  process.exitCode = await main(process.argv.slice(2), root);
}
