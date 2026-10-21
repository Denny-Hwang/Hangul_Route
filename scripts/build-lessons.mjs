#!/usr/bin/env node
// F-CURR-001 §3.10, §3.12 — lesson bundle generator (row C-2); split into a manifest and
// content-hashed chunks by F-CURR-002 §10 (row CM-5).
//
// Reads the upper-stage lesson cells, content/episodes/stage-<n>/<theme>.json for
// n in 2, 3, 4, 6, 7 (Stage 1 is hand-written TypeScript, Stage 5 holds the story
// books), drops `status: "draft"` cells (they stay "Coming later"), reads the es / ko
// glosses of content/i18n/<locale>/lessons-stage<n>-<theme>.json and writes, under
// apps/mobile/src/content/__generated__/:
//
//   lessons-index.ts                                  the manifest (imported at start)
//       LESSON_EPISODES        Episode[]               one shipped grid episode per ready cell
//       LESSON_QUESTS          LessonQuestHeader[]     its quests: ids, English titles, blurbs, minutes, cards (no steps)
//       LESSON_TEACHES         Record<quest, jamo[]>   the jamo ids each quest's Discover step teaches (only quests that teach)
//       LESSON_CELL_CHUNKS     Record<episode, hash>   the hash of each cell's body chunk
//       LESSON_TITLE_CHUNKS    Record<locale, hash>    the hash of each locale's title chunk
//       loadLessonCell / loadLessonTitles             one literal `import()` per chunk
//   lesson-chunks/lessons-cell-stage<n>-<theme>.ts    one body chunk per ready cell (on demand)
//       CHUNK_HASH, LESSON_STEPS (by quest id), LESSON_SCOPES (by minigame ref),
//       LESSON_OVERLAYS (es / ko of the steps and the minigame entities)
//   lesson-chunks/lessons-titles-<locale>.ts          one title chunk per overlay locale (active locale only)
//       CHUNK_HASH, LESSON_TITLE_OVERLAYS (the episode and quest titles, subtitles, intros, blurbs, teasers)
//
// and the catalogue rows that come from content/ (F-CURR-002 §9.1, row CM-6), under
// packages/content-schema/src/catalog/:
//
//   catalog.generated.ts
//       GENERATED_CATALOG_VERSION   the largest `addedIn` stamp of a shipped quest, else 32 (the last
//                                   hand-kept version; every stamp is a YYYYMMDD date, so larger)
//       GENERATED_QUEST_ADDITIONS   the shipped quest ids by their `addedIn` stamp
//       GENERATED_LESSON_CELL_ROWS  one compact row per upper-stage cell file (a draft is "Coming soon"),
//                                   with its quests' titles, minutes and `teaches` (Discover symbols);
//                                   expandCellRows (catalog/assemble.ts) gives the ids, cells and kinds
//       GENERATED_STORIES           one row per content/stories/*.json (the offer status rule of the catalogue)
//       GENERATED_TOPICS            one row per content/vocab/<topic>.json
//   catalog/data.ts adds the hand-written Stage 1 and Stage 5 rows and the frozen shelf order of the
//   first 24 stories, so a content PR touches only its own files under content/ (§9.1 target).
//
// Every one of these modules is generated, never committed (row CM-6): `pnpm generate`
// (scripts/generate.mjs) writes them, the turbo `generate` task runs it before dev, build,
// typecheck and test, and the root `postinstall` runs it after every `pnpm install` (CI jobs and
// the Workers Builds deploys install first).
//
// Nothing imports a chunk statically: Metro splits every `import()` of the manifest into its own
// web bundle (the PWA precaches it, the app loads it on demand) and keeps them all in the one
// native bundle. The hash is the sha256 of the chunk's data; pwa-postbuild.mjs checks every
// manifest entry against the web bundle that carries it (F-CURR-002 §10 decision record).
//
// This is a shaper, like build-stories.mjs: it checks what it emits (ids, statuses,
// refs, the fields it reads, and the two review sign-offs of a ready cell, §3.8), maps
// each lesson scope onto the app's MinigameScope and fails on JSON it cannot read. The
// content gates are the zod schema (`LessonCellSchema`) run by the `lesson-*` rules of
// validate-content.mjs, and apps/mobile/src/content/__tests__/upper-stage-curriculum.test.ts
// (U-1 .. U-10); the literals are typed by contextual typing, so `tsc --noEmit` is a
// further gate. Culture-note sources never reach the bundle (§3.10).
//
// Usage:
//   node scripts/build-lessons.mjs            write the modules (and remove the ones no longer built)
//   node scripts/build-lessons.mjs --check    determinism (CI): fail if a module on disk (written by an earlier
//                                             run, e.g. the postinstall) differs from this run or is no longer
//                                             built; then the addedIn stamp check against origin/main
//                                             (scripts/check-added-in.mjs) when that ref exists
//   node scripts/build-lessons.mjs --report   print raw and gzip bytes per cell, per module, per stage
//                                             and in total; fail over budget (CI)
//
// Dependency-free Node. Exit 0 when written / in sync / within budget, 1 on a content,
// drift or budget error, 2 on a usage error. HANGUL_ROUTE_ROOT overrides the repo root (tests).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { register } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { OVERLAY_LOCALES, isOverlayFieldAllowed, overlayPrefix } from "./overlay-fields.mjs";
import { writeIfChanged } from "./write-if-changed.mjs";

export const GENERATED_HEADER =
  "// GENERATED by scripts/build-lessons.mjs — do not edit. Source: content/episodes/stage-<n>/*.json, content/i18n/{es,ko}/lessons-*.json (F-CURR-001, F-CURR-002)\n";

/** The stages that hold lesson cells, in grid order. */
export const LESSON_STAGES = Object.freeze([2, 3, 4, 6, 7]);
export const THEMES = Object.freeze(["letters", "life", "rites", "nature", "crafts"]);
export const OUT_DIR = join("apps", "mobile", "src", "content", "__generated__");
/** The chunks' folder under OUT_DIR. */
export const CHUNK_DIR = "lesson-chunks";

/**
 * Bundle budget (F-CURR-001 §3.12, F-CURR-002 §10 and OD-5). Raising a ceiling is a reviewed
 * one-line change with the measured numbers in the PR.
 */
export const BUDGET = Object.freeze({
  perQuestRawAvg: 9_000, // average per quest in a cell (S4-1 raise, measured Stage 4 cells 24.1-25.8 KB for three): 54 KB for six, 27 KB for three
  manifestRaw: 60_000, // F-CURR-002 CM-5: the start-loaded lessons-index.ts (372,236 B before the split)
  titleChunkRaw: 30_000, // F-CURR-002 CM-5: one locale's title chunk
  cellChunkRaw: 90_000, // F-CURR-002 CM-5: one cell's body chunk module as emitted (largest at CM-5: stage2-letters, 61,381 B for six quests)
  cellChunkGzip: 16_000, // F-CURR-002 CM-5: the same, gzip (largest at CM-5: stage2-letters, 11,070 B)
  stageRaw: 220_000, // F-CURR-002 CM-5 (OD-5): a stage's game scopes and their glosses (was 150,000 for the stage module)
  stageGzip: 40_000, // F-CURR-002 CM-5 (OD-5): was 32,000
  totalRaw: 1_400_000, // F-CURR-002 CM-5 (OD-5): Volume 1 and 2, manifest and all chunks (was 950,000)
  totalGzip: 210_000, // F-CURR-002 CM-5 (OD-5): was 140,000
});

export class ContentError extends Error {
  constructor(message, file) {
    super(message);
    this.file = file;
  }
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// Compact literals (F-CURR-001 S2-3): pretty-printing doubled a cell's raw bytes with whitespace alone
// (Playground Words: 31,812 B pretty, 14,759 B compact), and the §3.12 budget measures what is emitted.
const literal = (value) => JSON.stringify(value);
const bytes = (text) => Buffer.byteLength(text, "utf8");

function need(obj, field, where, kind = "string") {
  const value = obj[field];
  const ok = kind === "array" ? Array.isArray(value) : kind === "object" ? isObject(value) : typeof value === kind;
  if (!ok || (kind === "string" && value.trim() === "")) throw new ContentError(`${field} must be a non-empty ${kind}`, where);
  return value;
}

// ---- Hangul (the build-letter tiles) -------------------------------------------------

const INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const MEDIALS = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const FINALS = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

/** One syllable block as its compatibility jamo [initial, vowel, final?]; null when `ch` is not one. */
export function jamoOf(ch) {
  const code = ch.codePointAt(0) - 0xac00;
  if (ch.length !== 1 || code < 0 || code > 11171) return null;
  const final = FINALS[code % 28];
  return [INITIALS[Math.floor(code / 588)], MEDIALS[Math.floor((code % 588) / 28)], ...(final === "" ? [] : [final])];
}

// ---- scopes: lesson shape -> the app's MinigameScope (apps/mobile/src/logic/minigame-config.ts) ----

function buildLetterSyllables(words, where) {
  return words.flatMap((word, wi) => {
    const syllables = [...word.ko];
    const roman = syllables.length === 1 ? [word.romanization] : word.syllables;
    if (!Array.isArray(roman) || roman.length !== syllables.length) {
      throw new ContentError(`words[${wi}] ${word.ko}: a word of more than one syllable needs its syllables split`, where);
    }
    return syllables.map((ko, si) => {
      const jamoChars = jamoOf(ko);
      if (jamoChars === null) throw new ContentError(`words[${wi}] ${word.ko}: ${ko} is not a Hangul syllable block`, where);
      return { ko, romanization: roman[si], jamoChars };
    });
  });
}


/**
 * The spoken form and recording of a piece of taught Korean, only the keys the content has
 * (F-AUDIO-004 §3.5): the card-match pairs and the dialogue lines and replies keep them, so the
 * games say `spokenKo` and play the clip once it is bundled.
 */
function speechOf(text) {
  return {
    ...(typeof text.spokenKo === "string" ? { spokenKo: text.spokenKo } : {}),
    ...(typeof text.audioRef === "string" ? { audioRef: text.audioRef } : {}),
  };
}
/** The runtime scope of one lesson scope; `rounds` is what the §3.1 table counts. */
export function runtimeScope(scope, where) {
  const { kind } = scope;
  switch (kind) {
    case "listen-pick":
      return { kind, rounds: scope.rounds.length, listenPick: { rounds: scope.rounds } };
    case "pic-word-match":
      return { kind, rounds: scope.boards.length, picWord: { boards: scope.boards } };
    case "build-letter": {
      const syllables = buildLetterSyllables(scope.words, where);
      return { kind, rounds: syllables.length, syllables };
    }
    case "card-match":
      return {
        kind,
        rounds: scope.pairs.length,
        cardPairs: scope.pairs.map(({ ko, romanization, en, spokenKo, audioRef }) => ({ ko, romanization, en, ...speechOf({ spokenKo, audioRef }) })),
      };
    case "tap-respond":
      return {
        kind,
        rounds: scope.turns.length,
        dialogue: scope.turns.map((turn) => {
          const line = speechOf(turn.line);
          return {
            npcKo: turn.line.ko,
            npcRomanization: turn.line.romanization,
            npcEn: turn.line.en,
            ...(line.spokenKo === undefined ? {} : { npcSpokenKo: line.spokenKo }),
            ...(line.audioRef === undefined ? {} : { npcAudioRef: line.audioRef }),
            options: turn.replies.map((r) => ({ ko: r.text.ko, romanization: r.text.romanization, en: r.text.en, isCorrect: r.correct, ...speechOf(r.text) })),
          };
        }),
      };
    case "story-sequence":
      return {
        kind,
        rounds: 1,
        storySteps: scope.lines.map((l) => ({ id: l.id, labelEn: l.line.en, labelKo: l.line.ko, romanization: l.line.romanization })),
      };
    case "order-it":
      // OrderItRoundSchema's default: a particle round may leave out its distractor tiles; the game reads [].
      return { kind, rounds: scope.rounds.length, orderIt: { rounds: scope.rounds.map((r) => ({ ...r, distractors: r.distractors ?? [] })) } };
    case "realia-read":
      return { kind, rounds: scope.rounds.length, realiaRead: { realia: scope.realia, rounds: scope.rounds } };
    case "type-hangul":
      return { kind, rounds: scope.rounds.length, typeHangul: { rounds: scope.rounds } };
    case "trace-word":
      return { kind, rounds: scope.rounds.length, traceWord: { rounds: scope.rounds } };
    case "write-frame":
      return { kind, rounds: scope.rounds.length, writeFrame: { rounds: scope.rounds } };
    default:
      throw new ContentError(`scope kind ${JSON.stringify(kind)} has no lesson scope (lesson-no-speaking for voice-echo)`, where);
  }
}

// ---- cells -------------------------------------------------------------------------------

/** Both multi-agent review sign-offs: mirrors `isLessonSignedOff` (packages/content-schema/src/schemas/lesson.ts). */
export const isSignedOff = (review) =>
  isObject(review) &&
  review.language === "native-reviewed" &&
  review.culture === "culture-reviewed" &&
  typeof review.reviewedBy === "string" &&
  review.reviewedBy.trim() !== "" &&
  typeof review.reviewedAt === "string" &&
  review.reviewedAt !== "";

const PICK_QUEST = ["id", "titleEn", "blurbEn", "teaserEn", "estimatedMinutes", "steps", "rewardCardId"];

/** One parsed cell file -> its episode, quests and scopes; throws ContentError on what it cannot emit. */
export function shapeCell(cell, rel) {
  if (!isObject(cell)) throw new ContentError("a lesson cell is an object", rel);
  const stageNo = Number(/stage-(\d)\//.exec(rel)?.[1]);
  const theme = rel.split("/").pop().replace(/\.json$/, "");
  const stage = `stage${stageNo}`;
  const id = `episode:${stage}-${theme}`;
  if (cell.id !== id) throw new ContentError(`id must be ${id} (the file's stage and theme)`, rel);
  if (cell.stage !== stage || cell.theme !== theme) throw new ContentError(`stage and theme must be ${stage} and ${theme}`, rel);
  if (cell.status !== "draft" && cell.status !== "ready") throw new ContentError('status must be "draft" or "ready"', rel);
  if (cell.status === "ready" && !isSignedOff(cell.review)) {
    throw new ContentError(
      'lesson-review-unsigned: a ready cell needs review.language "native-reviewed", review.culture "culture-reviewed", reviewedBy and reviewedAt (F-CURR-001 §3.8)',
      rel,
    );
  }
  const quests = need(cell, "quests", rel, "array");
  const scopes = {};
  const stamps = {};
  const shapedQuests = quests.map((quest, qi) => {
    const where = `${rel} quests[${qi}]`;
    if (!isObject(quest)) throw new ContentError("a quest is an object", where);
    const questId = `quest:${stage}-${theme}-q${qi + 1}`;
    if (quest.id !== questId) throw new ContentError(`id must be ${questId}`, where);
    if (quest.addedIn !== undefined) stamps[questId] = addedInStamp(quest.addedIn, where);
    const steps = need(quest, "steps", where, "array");
    for (const scope of need(quest, "scopes", where, "array")) {
      const ref = need(scope, "ref", where);
      if (!ref.startsWith(`minigame:s${stageNo}-${theme}-q${qi + 1}-`)) throw new ContentError(`scope ${ref} is not named after ${questId}`, where);
      if (scopes[ref] !== undefined) throw new ContentError(`scope ${ref} is listed twice`, where);
      scopes[ref] = runtimeScope(scope, `${where} ${ref}`);
    }
    for (const step of steps) {
      if (step.minigameRef !== undefined && scopes[step.minigameRef] === undefined) {
        throw new ContentError(`step ${step.id} plays ${step.minigameRef}, which has no scope in this quest`, where);
      }
    }
    return Object.fromEntries(PICK_QUEST.filter((k) => quest[k] !== undefined).map((k) => [k, quest[k]]));
  });
  const seconds = shapedQuests.flatMap((q) => q.steps).reduce((sum, step) => sum + (step.durationSeconds ?? 0), 0);
  const episode = {
    id,
    stage,
    theme,
    order: need(cell, "order", rel, "number"),
    titleEn: need(cell, "titleEn", rel),
    subtitleEn: need(cell, "subtitleEn", rel),
    hoyaIntroEn: need(cell, "hoyaIntroEn", rel),
    questIds: shapedQuests.map((q) => q.id),
    rewardCardIds: cell.rewardCardIds ?? [],
    estimatedMinutes: Math.max(3, Math.round(seconds / 60)),
    pillarTags: need(cell, "pillarTags", rel, "array"),
    status: "shipped",
  };
  return { status: cell.status, stageNo, episode, quests: shapedQuests, scopes, stamps, file: rel };
}

/** The ids an overlay of this cell may name: its episode, its quests and its scope refs. */
const cellEntityIds = (shaped) => new Set([shaped.episode.id, ...shaped.quests.map((q) => q.id), ...Object.keys(shaped.scopes)]);

/**
 * The glosses of one cell's overlay files, `{ es: { id: { field: text } }, ko: ... }`:
 * only fields OVERLAY_FIELDS allows, only ids of the cell, non-blank strings, sorted.
 * The language rules (Hangul, circular glosses, banned words, completeness) are
 * validate-content.mjs's job.
 */
export function cellOverlays(shaped, files) {
  const ids = cellEntityIds(shaped);
  const out = Object.fromEntries(OVERLAY_LOCALES.map((l) => [l, {}]));
  for (const { rel, locale, json } of files) {
    if (!isObject(json) || json.locale !== locale || !isObject(json.entries)) {
      throw new ContentError("an overlay file is { locale (= its folder), domain, entries }", rel);
    }
    for (const [id, entry] of Object.entries(json.entries)) {
      if (!ids.has(id)) throw new ContentError(`${id} is not an entity of ${shaped.episode.id}`, rel);
      if (!isObject(entry)) throw new ContentError(`the entry ${id} must be an object of translated fields`, rel);
      const fields = Object.entries(entry)
        .filter(([field, text]) => isOverlayFieldAllowed(id, field) && typeof text === "string" && text.trim() !== "")
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      if (fields.length > 0) out[locale][id] = Object.fromEntries(fields);
    }
  }
  return out;
}

const sortedKeys = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));

// ---- chunks (F-CURR-002 §10, row CM-5) -----------------------------------------------------

/** The quest fields the start-loaded manifest keeps; `steps` goes to the cell's body chunk. */
const QUEST_HEADER = PICK_QUEST.filter((k) => k !== "steps");

/** A quest overlay field of the body chunk (`steps.<stepId>....`); every other episode or quest field is a title. */
const isBodyField = (id, field) => overlayPrefix(id) === "minigame" || field.startsWith("steps.");

/**
 * The jamo ids a quest's Discover step introduces, in page order: `questTeaches`
 * (apps/mobile/src/logic/stage1/curriculum.ts) over its steps. The manifest keeps them, so the
 * screens that name a quest's letters before its chunk loads (a closed quest's preview on the
 * lesson page, the results teaser, the placement and letter-wall catalogues) read them at start.
 */
export function discoverJamo(steps) {
  const ids = [];
  for (const step of steps) {
    for (const page of step.discover?.pages ?? []) {
      for (const item of page.items ?? []) if (item.type === "jamo") ids.push(item.jamoId);
    }
  }
  return ids;
}

/** The content hash a chunk module carries (`CHUNK_HASH`) and the manifest names: sha256 of its data literal, 16 hex. */
export const chunkHash = (text) => createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);

/** `episode:stage2-letters` -> `lessons-cell-stage2-letters` (the file, and the name of its web bundle). */
export const cellChunkName = (episodeId) => `lessons-cell-${episodeId.replace(/^episode:/, "")}`;
export const titleChunkName = (locale) => `lessons-titles-${locale}`;

const emptyOverlays = () => Object.fromEntries(OVERLAY_LOCALES.map((l) => [l, {}]));
const overlaysLiteral = (o) => literal(Object.fromEntries(OVERLAY_LOCALES.map((l) => [l, sortedKeys(o[l])])));

/**
 * Pure: ready shaped cells -> what each chunk holds and its hash.
 *   manifest  the episodes and the quest headers (no steps), English only
 *   cells     one body per cell: steps by quest id, scopes by ref, the es / ko glosses of both
 *   titles    one table per locale: the episode and quest titles, subtitles, intros, blurbs, teasers
 */
export function planChunks(cells) {
  const ready = cells.filter((c) => c.status === "ready");
  const titles = emptyOverlays();
  const cellChunks = ready.map((cell) => {
    const overlays = emptyOverlays();
    for (const locale of OVERLAY_LOCALES) {
      for (const [id, entry] of Object.entries(cell.overlays[locale])) {
        const body = Object.entries(entry).filter(([field]) => isBodyField(id, field));
        const title = Object.entries(entry).filter(([field]) => !isBodyField(id, field));
        if (body.length > 0) overlays[locale][id] = Object.fromEntries(body);
        if (title.length > 0) titles[locale][id] = Object.fromEntries(title);
      }
    }
    const steps = literal(Object.fromEntries(cell.quests.map((q) => [q.id, q.steps])));
    const scopes = literal(sortedKeys(cell.scopes));
    const glosses = overlaysLiteral(overlays);
    return {
      id: cell.episode.id,
      stageNo: cell.stageNo,
      name: cellChunkName(cell.episode.id),
      hash: chunkHash(steps + scopes + glosses),
      literals: { steps, scopes, glosses },
    };
  });
  const titleChunks = OVERLAY_LOCALES.map((locale) => {
    const table = literal(sortedKeys(titles[locale]));
    return { locale, name: titleChunkName(locale), hash: chunkHash(table), literal: table };
  });
  return {
    episodes: ready.map((c) => c.episode),
    quests: ready.flatMap((c) => c.quests.map((q) => Object.fromEntries(QUEST_HEADER.filter((k) => q[k] !== undefined).map((k) => [k, q[k]])))),
    teaches: Object.fromEntries(ready.flatMap((c) => c.quests.map((q) => [q.id, discoverJamo(q.steps)]).filter(([, ids]) => ids.length > 0))),
    cells: cellChunks,
    titles: titleChunks,
  };
}

/** Pure: the chunk names and hashes the manifest lists (pwa-postbuild.mjs checks the web bundles against them). */
export function chunkManifest(cells) {
  const plan = planChunks(cells);
  return [...plan.cells, ...plan.titles].map(({ name, hash }) => ({ name, hash }));
}

const q = (s) => JSON.stringify(s);

/** Pure: ready shaped cells (with their overlays) -> the module sources by path under OUT_DIR. */
export function buildModules(cells) {
  const plan = planChunks(cells);
  const cellCases = plan.cells.map((c) => `    case ${q(c.id)}:\n      return import('./${CHUNK_DIR}/${c.name}');\n`).join("");
  const titleCases = plan.titles.map((t) => `    case ${q(t.locale)}:\n      return import('./${CHUNK_DIR}/${t.name}');\n`).join("");
  const modules = {
    "lessons-index.ts":
      GENERATED_HEADER +
      "import type { Episode, OverlayLocale } from '@hangul-route/content-schema';\n" +
      "import type { LessonCellChunk, LessonQuestHeader, LessonTitleChunk } from '../../logic/lessons/lesson-store';\n\n" +
      "/**\n" +
      " * The start-loaded lesson manifest (F-CURR-002 §10, row CM-5): the shipped upper-stage cells and their\n" +
      " * quests, English headers only. Each cell's steps, scopes and glosses are one content-hashed chunk, and\n" +
      " * the es / ko titles one chunk per locale, reached only through the literal `import()`s below: Metro\n" +
      " * emits each as its own web bundle (precached by the service worker, loaded on demand) and keeps them\n" +
      " * in the one native bundle.\n" +
      " */\n" +
      `export const LESSON_EPISODES: Episode[] = ${literal(plan.episodes)};\n\n` +
      `export const LESSON_QUESTS: LessonQuestHeader[] = ${literal(plan.quests)};\n\n` +
      "/** The jamo ids each lesson quest's Discover step teaches, in page order (only the quests that teach some): read before any chunk loads. */\n" +
      `export const LESSON_TEACHES: Readonly<Record<string, readonly string[]>> = ${literal(plan.teaches)};\n\n` +
      "/** Each cell's body chunk by episode id: the hash its module carries as `CHUNK_HASH`. */\n" +
      `export const LESSON_CELL_CHUNKS: Readonly<Record<string, string>> = ${literal(Object.fromEntries(plan.cells.map((c) => [c.id, c.hash])))};\n\n` +
      "/** The title chunk of each overlay locale: the hash its module carries as `CHUNK_HASH`. */\n" +
      `export const LESSON_TITLE_CHUNKS: Readonly<Record<OverlayLocale, string>> = ${literal(Object.fromEntries(plan.titles.map((t) => [t.locale, t.hash])))};\n\n` +
      "/** The body chunk of a shipped cell; undefined for any other id. One literal `import()` per chunk (Metro resolves only literals). */\n" +
      "export function loadLessonCell(cellId: string): Promise<LessonCellChunk> | undefined {\n" +
      "  switch (cellId) {\n" +
      cellCases +
      "    default:\n" +
      "      return undefined;\n" +
      "  }\n" +
      "}\n\n" +
      "/** The title chunk of an overlay locale (English titles are in the manifest). */\n" +
      "export function loadLessonTitles(locale: OverlayLocale): Promise<LessonTitleChunk> {\n" +
      "  switch (locale) {\n" +
      titleCases +
      "  }\n" +
      "}\n",
  };
  const chunkHeader = (what) =>
    GENERATED_HEADER +
    `import type { ${what} } from '../../../logic/lessons/lesson-store';\n\n`;
  for (const c of plan.cells) {
    modules[`${CHUNK_DIR}/${c.name}.ts`] =
      chunkHeader("LessonCellChunk") +
      `/** The body of ${c.id} (F-CURR-002 §10): reached only through \`loadLessonCell\` in ../lessons-index.ts, never imported statically. */\n` +
      `export const CHUNK_HASH = ${q(c.hash)};\n\n` +
      `export const LESSON_STEPS: LessonCellChunk['LESSON_STEPS'] = ${c.literals.steps};\n\n` +
      `export const LESSON_SCOPES: LessonCellChunk['LESSON_SCOPES'] = ${c.literals.scopes};\n\n` +
      `export const LESSON_OVERLAYS: LessonCellChunk['LESSON_OVERLAYS'] = ${c.literals.glosses};\n`;
  }
  for (const t of plan.titles) {
    modules[`${CHUNK_DIR}/${t.name}.ts`] =
      chunkHeader("LessonTitleChunk") +
      `/** The ${t.locale} titles of the lesson cells and quests (F-CURR-002 §10): loaded for the active UI locale only, through \`loadLessonTitles\`. */\n` +
      `export const CHUNK_HASH = ${q(t.hash)};\n\n` +
      `export const LESSON_TITLE_OVERLAYS: LessonTitleChunk['LESSON_TITLE_OVERLAYS'] = ${t.literal};\n`;
  }
  return modules;
}

// ---- catalogue rows (F-CURR-002 §9.1, row CM-6) ----------------------------------------------

/** The catalogue module, beside catalog/data.ts in the content-schema package. */
export const CATALOG_OUT = join("packages", "content-schema", "src", "catalog", "catalog.generated.ts");

export const CATALOG_HEADER =
  "// GENERATED by scripts/build-lessons.mjs — do not edit. Source: content/episodes/stage-<n>/*.json, content/stories/*.json, content/vocab/*.json (F-CURR-002 §9.1, row CM-6)\n";

/**
 * The last hand-kept catalogue version (F-CURR-001 S7-5). Versions up to it keep their integers
 * (`CATALOG_QUEST_ADDITIONS` in versions.ts); a quest added after it carries an `addedIn` date stamp,
 * and every stamp is larger, so the order of versions holds.
 */
export const HISTORY_LAST_VERSION = 32;

/** The span of an `addedIn` stamp: a calendar date written YYYYMMDD. */
const STAMP_MIN = 20260101;
const STAMP_MAX = 20991231;

/** An `addedIn` value checked as a real YYYYMMDD date; throws ContentError otherwise. */
export function addedInStamp(value, where) {
  const ok =
    Number.isInteger(value) &&
    value >= STAMP_MIN &&
    value <= STAMP_MAX &&
    (() => {
      const y = Math.floor(value / 10000);
      const m = Math.floor(value / 100) % 100;
      const d = value % 100;
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
    })();
  if (!ok) throw new ContentError(`addedIn must be a date stamp YYYYMMDD (an integer such as 20261105), not ${JSON.stringify(value)}`, where);
  return value;
}

/** A content/stories file -> its catalogue row, the fields catalog/data.ts cannot know. */
export function shapeStoryRow(story, rel) {
  if (!isObject(story)) throw new ContentError("a story file holds one object", rel);
  const id = need(story, "id", rel);
  const slug = /^story:([a-z0-9-]+)$/.exec(id)?.[1];
  if (slug === undefined) throw new ContentError(`id ${JSON.stringify(id)} must be story:<slug>`, rel);
  if (!isObject(story.title)) throw new ContentError("title must be an object with en", rel);
  const review = isObject(story.review) ? story.review : {};
  const row = {
    slug,
    title: need(story.title, "en", rel),
    recommendedStage: need(story, "recommendedStage", rel, "number"),
    theme: need(story, "theme", rel),
    minutes: need(story, "minutes", rel, "number"),
    sampler: isObject(story.shelf) && story.shelf.sampler === true,
    // catalogStatusOfStory (catalog/schema.ts): ready, with a shelf block and both review sign-offs.
    status:
      story.state === "ready" && isObject(story.shelf) && review.language === "native-reviewed" && review.culture === "culture-reviewed" ? "ready" : "draft",
  };
  return story.addedIn === undefined ? row : { ...row, addedIn: addedInStamp(story.addedIn, rel) };
}

/** A content/vocab/<topic>.json file -> its catalogue row (id, key, title, order). */
export function shapeTopicRow(file, rel) {
  if (!isObject(file) || !isObject(file.topic)) throw new ContentError("a topic file needs a topic object", rel);
  const key = need(file.topic, "key", rel);
  return { id: `topic:${key}`, key, title: need(file.topic, "titleEn", rel), order: need(file.topic, "order", rel, "number") };
}

/** The symbol keys of the quest's Discover jamo items (`questTeaches` + the catalogue spelling). */
function teachesOf(quest, symbolKeys, where) {
  const keys = [];
  for (const step of quest.steps) {
    for (const page of isObject(step.discover) && Array.isArray(step.discover.pages) ? step.discover.pages : []) {
      for (const item of Array.isArray(page?.items) ? page.items : []) {
        if (item?.type !== "jamo") continue;
        const key = symbolKeys.get(item.jamoId);
        if (key === undefined) throw new ContentError(`Discover teaches ${item.jamoId}, which the app's jamo (apps/mobile/src/content/jamo.ts) do not know`, where);
        keys.push(key);
      }
    }
  }
  return keys;
}

/** A jamo's symbol key as the catalogue spells it: the letter, or `<letter>/final` for a batchim. */
export const symbolKeyOf = (jamo) => (jamo.kind === "batchim" ? `${jamo.char}/final` : jamo.char);

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Pure: shaped cells, story rows and topic rows -> the generated catalogue model.
 * `symbolKeys` maps a jamo id to its symbol key (the app's `jamoKnown`).
 */
export function catalogueOf({ cells, stories = [], topics = [], symbolKeys = new Map() }) {
  const lessonCells = [];
  const lessonQuests = [];
  const stamps = [];
  const sortedCells = [...cells].sort((a, b) => a.stageNo - b.stageNo || THEMES.indexOf(a.episode.theme) - THEMES.indexOf(b.episode.theme));
  for (const cell of sortedCells) {
    const { episode } = cell;
    if (cell.status !== "ready") {
      // A draft cell stays the bundle's "Coming soon" placeholder (`makePreviewEpisode`: 10 minutes, no quests).
      lessonCells.push({ stage: episode.stage, theme: episode.theme, episodeId: episode.id, title: episode.titleEn, status: "preview", minutes: 10, questIds: [] });
      continue;
    }
    lessonCells.push({
      stage: episode.stage,
      theme: episode.theme,
      episodeId: episode.id,
      title: episode.titleEn,
      status: "shipped",
      minutes: episode.estimatedMinutes,
      questIds: episode.questIds,
    });
    for (const quest of cell.quests) {
      lessonQuests.push({
        id: quest.id,
        episodeId: episode.id,
        stage: episode.stage,
        theme: episode.theme,
        title: quest.titleEn,
        minutes: quest.estimatedMinutes,
        teaches: teachesOf(quest, symbolKeys, `${cell.file ?? episode.id} ${quest.id}`),
        kind: "lesson",
      });
      if (cell.stamps?.[quest.id] !== undefined) stamps.push([cell.stamps[quest.id], quest.id]);
    }
  }
  const storyRows = [...stories].sort((a, b) => byString(a.slug, b.slug));
  for (const story of storyRows) if (story.addedIn !== undefined) stamps.push([story.addedIn, `quest:story-${story.slug}-listen`]);
  const additions = {};
  for (const [stamp, id] of stamps.sort((a, b) => a[0] - b[0] || byString(a[1], b[1]))) (additions[stamp] ??= []).push(id);
  return {
    version: Math.max(HISTORY_LAST_VERSION, ...stamps.map(([stamp]) => stamp)),
    additions,
    cells: lessonCells,
    quests: lessonQuests,
    // A story keeps its stamp: assembleCatalog orders the stories after the frozen shelf by it.
    stories: storyRows,
    topics: [...topics].sort((a, b) => a.order - b.order || byString(a.key, b.key)),
  };
}

/**
 * Pure: the model's cells and quests -> the compact cell rows of catalog.generated.ts. Throws when a
 * row would not expand back to the model (a quest id off its position, a quest of another cell).
 */
export function cellRowsOf(model) {
  const byCell = new Map(model.cells.map((cell) => [cell.episodeId, []]));
  for (const quest of model.quests) {
    const list = byCell.get(quest.episodeId);
    if (list === undefined) throw new Error(`catalogue quest ${quest.id} names no generated cell (${quest.episodeId})`);
    list.push(quest);
  }
  return model.cells.map((cell) => {
    const quests = byCell.get(cell.episodeId);
    const ids = quests.map((_, i) => `quest:${cell.stage}-${cell.theme}-q${i + 1}`);
    const fits =
      cell.episodeId === `episode:${cell.stage}-${cell.theme}` &&
      cell.questIds.length === ids.length &&
      cell.questIds.every((id, i) => id === ids[i]) &&
      quests.every((q, i) => q.id === ids[i] && q.stage === cell.stage && q.theme === cell.theme && q.kind === "lesson");
    if (!fits) throw new Error(`catalogue cell ${cell.episodeId} does not fit a compact row (ids by position, one cell)`);
    return [cell.stage, cell.theme, cell.title, cell.status, cell.minutes, quests.map((q) => [q.title, q.minutes, q.teaches])];
  });
}

/** Pure: the catalogue model -> the source of catalog.generated.ts. */
export function renderCatalogue(model) {
  const rows = (items) => (items.length === 0 ? "[]" : `[\n${items.map((item) => `  ${literal(item)},`).join("\n")}\n]`);
  const additions = Object.entries(model.additions);
  return (
    CATALOG_HEADER +
    "import type { GeneratedCellRow, GeneratedStoryRow, GeneratedTopicRow } from './assemble';\n\n" +
    "/**\n" +
    " * The catalogue rows content/ defines (F-CURR-002 §9.1, row CM-6), assembled with the hand-written\n" +
    " * Stage 1 and Stage 5 rows by ./data.ts. Gitignored: `pnpm generate` writes it.\n" +
    " */\n\n" +
    `/** The largest \`addedIn\` stamp of a shipped quest, or ${HISTORY_LAST_VERSION} (the last hand-kept version) when none carries one. */\n` +
    `export const GENERATED_CATALOG_VERSION = ${model.version};\n\n` +
    "/** The shipped quests that carry an `addedIn` stamp, by stamp (versions.ts appends them to the history). */\n" +
    "export const GENERATED_QUEST_ADDITIONS: Readonly<Record<number, readonly string[]>> = " +
    (additions.length === 0 ? "{}" : `{\n${additions.map(([stamp, ids]) => `  ${stamp}: ${literal(ids)},`).join("\n")}\n}`) +
    ";\n\n" +
    "/**\n" +
    " * One row per upper-stage cell file (stages 2, 3, 4, 6 and 7), in grid order:\n" +
    " * [stage, theme, title, status, minutes, quests], a quest being [title, minutes, teaches].\n" +
    " * Compact for the start bundle; expandCellRows (./assemble.ts) gives the ids, cells and kinds.\n" +
    " */\n" +
    `export const GENERATED_LESSON_CELL_ROWS: GeneratedCellRow[] = ${rows(cellRowsOf(model))};\n\n` +
    "/** One row per story file, by slug; ./data.ts gives each its shelf order and festival anchor. */\n" +
    `export const GENERATED_STORIES: GeneratedStoryRow[] = ${rows(model.stories)};\n\n` +
    "/** One row per vocabulary topic file, in topic order. */\n" +
    `export const GENERATED_TOPICS: GeneratedTopicRow[] = ${rows(model.topics)};\n`
  );
}

/** Every content/stories/*.json (not recursive: research/ is provenance) as a catalogue row, by file name. */
export function readStoryRows(root) {
  const dir = join(root, "content", "stories");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort(byString)
    .map((name) => {
      const { rel, json } = readJson(root, join(dir, name));
      return shapeStoryRow(json, rel);
    });
}

/** Every content/vocab/<topic>.json (not the `_` registries) as a catalogue row. */
export function readTopicRows(root) {
  const dir = join(root, "content", "vocab");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .sort(byString)
    .map((name) => {
      const { rel, json } = readJson(root, join(dir, name));
      return shapeTopicRow(json, rel);
    });
}

let loaderRegistered = false;

/**
 * The app's jamo symbol keys (`jamoKnown` of apps/mobile/src/content/jamo.ts, read through
 * scripts/ts-loader.mjs): the Stage 1 symbols and the Word Builder ones. An empty map when the
 * file is absent (a test tree with no Discover jamo).
 */
export async function loadSymbolKeys(root) {
  const file = join(root, "apps", "mobile", "src", "content", "jamo.ts");
  if (!existsSync(file)) return new Map();
  if (!loaderRegistered) {
    register(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "ts-loader.mjs")));
    loaderRegistered = true;
  }
  const { jamoKnown } = await import(pathToFileURL(file).href);
  return new Map(jamoKnown.map((jamo) => [jamo.id, symbolKeyOf(jamo)]));
}

// ---- budget -------------------------------------------------------------------------------

const measure = (name, text) => ({ name, raw: bytes(text), gzip: gzipSync(text).length });

/**
 * Pure: bytes per ready cell (its quests and scopes as authored, English), per module, per stage
 * and in total. A stage is measured as F-CURR-001 §3.12 measured its stage module: the game
 * scopes of its cells and their es / ko glosses (the steps now ride in the same chunks and count
 * in the per-quest average and the total). Each gzip figure is of the concatenation, as before.
 */
export function sizes(cells, modules) {
  const ready = cells.filter((c) => c.status === "ready");
  const perCell = ready.map((c) => {
    const text = literal(c.quests) + literal(c.scopes);
    return { id: c.episode.id, quests: c.quests.length, raw: bytes(text), gzip: gzipSync(text).length };
  });
  const perModule = Object.entries(modules).map(([name, text]) => measure(name, text));
  const perStage = LESSON_STAGES.map((n) => {
    const own = ready.filter((c) => c.stageNo === n);
    const glosses = emptyOverlays();
    for (const c of own) {
      for (const locale of OVERLAY_LOCALES) {
        for (const [id, entry] of Object.entries(c.overlays[locale])) if (overlayPrefix(id) === "minigame") glosses[locale][id] = entry;
      }
    }
    const text = literal(sortedKeys(Object.assign({}, ...own.map((c) => c.scopes)))) + overlaysLiteral(glosses);
    return { stage: n, cells: own.length, ...measure(`stage ${n}`, own.length === 0 ? "" : text) };
  });
  const all = Object.values(modules).join("");
  return { perCell, perModule, perStage, total: { raw: bytes(all), gzip: gzipSync(all).length } };
}

/** Pure: size problems as human-readable strings (empty = within budget). */
export function checkBudget({ perCell, perModule, perStage = [], total }) {
  const problems = [];
  for (const c of perCell) {
    const cap = BUDGET.perQuestRawAvg * c.quests;
    if (c.raw > cap) problems.push(`${c.id} is ${c.raw} B raw for ${c.quests} quests, over its ceiling of ${cap} B (${BUDGET.perQuestRawAvg} B per quest)`);
  }
  for (const m of perModule) {
    if (m.name === "lessons-index.ts" && m.raw > BUDGET.manifestRaw) {
      problems.push(`the start-loaded manifest lessons-index.ts is ${m.raw} B raw, over the ceiling of ${BUDGET.manifestRaw} B`);
    }
    if (m.name.startsWith(`${CHUNK_DIR}/lessons-titles-`) && m.raw > BUDGET.titleChunkRaw) {
      problems.push(`${m.name} is ${m.raw} B raw, over the title chunk ceiling of ${BUDGET.titleChunkRaw} B`);
    }
    if (m.name.startsWith(`${CHUNK_DIR}/lessons-cell-`)) {
      if (m.raw > BUDGET.cellChunkRaw) problems.push(`${m.name} is ${m.raw} B raw, over the cell chunk ceiling of ${BUDGET.cellChunkRaw} B`);
      if (m.gzip > BUDGET.cellChunkGzip) problems.push(`${m.name} is ${m.gzip} B gzip, over the cell chunk ceiling of ${BUDGET.cellChunkGzip} B`);
    }
  }
  for (const s of perStage) {
    if (s.raw > BUDGET.stageRaw) problems.push(`the Stage ${s.stage} game content is ${s.raw} B raw, over the ceiling of ${BUDGET.stageRaw} B`);
    if (s.gzip > BUDGET.stageGzip) problems.push(`the Stage ${s.stage} game content is ${s.gzip} B gzip, over the ceiling of ${BUDGET.stageGzip} B`);
  }
  if (total.raw > BUDGET.totalRaw) problems.push(`the lesson modules are ${total.raw} B raw, over the ceiling of ${BUDGET.totalRaw} B`);
  if (total.gzip > BUDGET.totalGzip) problems.push(`the lesson modules are ${total.gzip} B gzip, over the ceiling of ${BUDGET.totalGzip} B`);
  return problems;
}

// ---- file system and CLI --------------------------------------------------------------------

const relOf = (root, file) => relative(root, file).split(sep).join("/");

function readJson(root, full) {
  const rel = relOf(root, full);
  try {
    return { rel, json: JSON.parse(readFileSync(full, "utf8")) };
  } catch (error) {
    throw new ContentError(`invalid JSON: ${error.message}`, rel);
  }
}

/** Every cell file, shaped, with its overlays; a file that is not a theme name fails. */
export function readCells(root) {
  const cells = [];
  for (const n of LESSON_STAGES) {
    const dir = join(root, "content", "episodes", `stage-${n}`);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    // Grid theme order (letters, life, rites, nature, crafts), not file-name order: the app's quest cursor
    // walks a stage's generated cells in this order, so a stage starts at its letters cell (F-CURR-001 T-2).
    const rank = (f) => {
      const i = THEMES.indexOf(f.replace(/\.json$/, ""));
      return i === -1 ? THEMES.length : i;
    };
    const names = readdirSync(dir).filter((f) => f.endsWith(".json")).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
    for (const name of names) {
      const theme = name.replace(/\.json$/, "");
      const { rel, json } = readJson(root, join(dir, name));
      if (!THEMES.includes(theme)) throw new ContentError(`a lesson cell file is named after its theme (${THEMES.join(", ")})`, rel);
      const shaped = shapeCell(json, rel);
      const files = OVERLAY_LOCALES.flatMap((locale) => {
        const full = join(root, "content", "i18n", locale, `lessons-stage${n}-${theme}.json`);
        return existsSync(full) ? [{ ...readJson(root, full), locale }] : [];
      });
      cells.push({ ...shaped, overlays: cellOverlays(shaped, files) });
    }
  }
  return cells;
}

/**
 * The generated lesson files that are on disk but no longer built: the per-stage modules of
 * F-CURR-001 (`lessons-stage<n>.ts`) and the chunk of a cell that is no longer ready.
 */
export function staleFiles(root, modules) {
  const out = [];
  const dir = join(root, OUT_DIR);
  if (existsSync(dir)) out.push(...readdirSync(dir).filter((f) => /^lessons-stage\d\.ts$/.test(f)));
  const chunks = join(dir, CHUNK_DIR);
  if (existsSync(chunks)) out.push(...readdirSync(chunks).filter((f) => f.endsWith(".ts")).map((f) => `${CHUNK_DIR}/${f}`));
  return out.filter((name) => modules[name] === undefined);
}

const USAGE = "Usage: node scripts/build-lessons.mjs [--check] [--report]";

/** Every file this generator writes, by path relative to the root: the lesson modules and the catalogue. */
export async function generatedOutputs(root, cells = readCells(root)) {
  const modules = buildModules(cells);
  const catalogue = catalogueOf({ cells, stories: readStoryRows(root), topics: readTopicRows(root), symbolKeys: await loadSymbolKeys(root) });
  const outputs = {};
  for (const [name, source] of Object.entries(modules)) outputs[join(OUT_DIR, name)] = source;
  outputs[CATALOG_OUT] = renderCatalogue(catalogue);
  return { modules, outputs };
}

export async function main(argv, root) {
  const opts = { check: false, report: false };
  for (const arg of argv) {
    if (arg === "--check") opts.check = true;
    else if (arg === "--report") opts.report = true;
    else {
      process.stderr.write(`unknown argument ${arg}\n${USAGE}\n`);
      return 2;
    }
  }
  let cells;
  let generated;
  try {
    cells = readCells(root);
    generated = await generatedOutputs(root, cells);
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    process.stdout.write(`::error file=${error.file}::${error.message}\n`);
    return 1;
  }
  const { modules, outputs } = generated;
  const ready = cells.filter((c) => c.status === "ready").length;
  const outRel = OUT_DIR.split(sep).join("/");

  if (opts.report) {
    const report = sizes(cells, modules);
    process.stdout.write(`Lesson modules (ready cells: ${ready}, drafts: ${cells.length - ready}):\n`);
    for (const c of report.perCell) process.stdout.write(`  ${c.id}  ${c.quests} quests  ${c.raw} B raw  ${c.gzip} B gzip\n`);
    for (const m of report.perModule) process.stdout.write(`  ${m.name}  ${m.raw} B raw  ${m.gzip} B gzip\n`);
    for (const s of report.perStage) process.stdout.write(`  stage ${s.stage} game content  ${s.cells} cells  ${s.raw} B raw  ${s.gzip} B gzip\n`);
    process.stdout.write(`  total  ${report.total.raw} B raw  ${report.total.gzip} B gzip\n`);
    process.stdout.write(
      `Budget: ${BUDGET.perQuestRawAvg} B raw per quest (cell average), ${BUDGET.manifestRaw} B raw for the manifest, ${BUDGET.titleChunkRaw} B raw per title chunk, ` +
        `${BUDGET.cellChunkRaw} B raw and ${BUDGET.cellChunkGzip} B gzip per cell chunk, ` +
        `${BUDGET.stageRaw} B raw and ${BUDGET.stageGzip} B gzip per stage, ${BUDGET.totalRaw} B raw and ${BUDGET.totalGzip} B gzip in total\n`,
    );
    const problems = checkBudget(report);
    for (const p of problems) process.stdout.write(`::error file=${outRel}::${p}\n`);
    return problems.length === 0 ? 0 : 1;
  }

  const stale = staleFiles(root, modules);
  if (opts.check) {
    // Determinism (F-CURR-002 §9.1): the files on disk come from an earlier run (`pnpm generate`, the postinstall);
    // this run must give the same bytes. The modules are generated, never committed.
    let drift = 0;
    for (const [name, source] of Object.entries(outputs)) {
      const target = join(root, name);
      if (!existsSync(target) || readFileSync(target, "utf8") !== source) {
        drift += 1;
        process.stdout.write(
          `::error file=${relOf(root, target)}::generated module is missing or differs from a fresh run of scripts/build-lessons.mjs (generators must be deterministic); run pnpm generate\n`,
        );
      }
    }
    for (const name of stale) {
      drift += 1;
      process.stdout.write(`::error file=${outRel}/${name}::generated lesson module is no longer built; run pnpm generate (it removes it)\n`);
    }
    if (drift > 0) return 1;
    process.stdout.write(`lesson modules and catalogue are deterministic (ready cells: ${ready})\n`);
    return checkStampsAgainstBase(root);
  }

  mkdirSync(join(root, OUT_DIR, CHUNK_DIR), { recursive: true });
  for (const name of stale) rmSync(join(root, OUT_DIR, name));
  for (const [name, source] of Object.entries(outputs)) {
    writeIfChanged(join(root, name), source);
  }
  process.stdout.write(
    `wrote ${Object.keys(modules).length} lesson modules (ready cells: ${ready}, drafts left out: ${cells.length - ready}) and the catalogue rows` +
      (stale.length > 0 ? `, removed ${stale.length} no longer built\n` : "\n"),
  );
  return 0;
}

/**
 * The addedIn stamp check of `--check` (scripts/check-added-in.mjs): against HANGUL_ROUTE_STAMP_BASE,
 * default origin/main. When that ref does not resolve, a local run skips it with a notice and a CI
 * run (GITHUB_ACTIONS=true) fails, so a changed checkout cannot turn the check off unseen.
 * HANGUL_ROUTE_STAMP_BASE=none skips it.
 */
function checkStampsAgainstBase(root) {
  const base = process.env.HANGUL_ROUTE_STAMP_BASE ?? "origin/main";
  if (base === "none") return 0;
  const known = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${base}^{commit}`], { cwd: root, encoding: "utf8" });
  if (known.status !== 0) {
    if (process.env.GITHUB_ACTIONS === "true") {
      process.stdout.write(`::error::addedIn stamp check: ${base} does not resolve; the job needs the base branch's history (content-validation.yml checks out fetch-depth 0)\n`);
      return 1;
    }
    process.stdout.write(`addedIn stamp check skipped: ${base} does not resolve here (content-validation.yml checks out the full history)\n`);
    return 0;
  }
  // A child process: check-added-in.mjs imports this module, which is still evaluating here.
  const script = join(dirname(fileURLToPath(import.meta.url)), "check-added-in.mjs");
  const run = spawnSync(process.execPath, [script, "--base", base], { cwd: root, encoding: "utf8", env: { ...process.env, HANGUL_ROUTE_ROOT: root } });
  process.stdout.write(run.stdout ?? "");
  process.stderr.write(run.stderr ?? "");
  return run.status ?? 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = process.env.HANGUL_ROUTE_ROOT
    ? resolve(process.env.HANGUL_ROUTE_ROOT)
    : join(dirname(fileURLToPath(import.meta.url)), "..");
  process.exitCode = await main(process.argv.slice(2), root);
}
