#!/usr/bin/env node
// F-CNT-001 — Content language policy validator.
// Walks content/**/*.json and enforces:
//   - Korean strings (Hangul jamo or syllables) only appear in fields named
//     `ko`, `korean`, `target`, `answer_ko` (or under explicit `lang_ko`
//     sub-objects).
//   - Whenever a Korean string is present, the same object MUST also carry
//     a `romanization` (Revised Romanization, not McCune-Reischauer) and an
//     English gloss in `gloss_en` or `en`.
//   - Learner-facing English copy never contains a shaming word
//     (F-HW-001 §3.3 anti-shame contract).
//   - content/placement/** follows the placement-bank rules in
//     scripts/placement-rules.mjs (F-PLC-001 §3.4).
//   - content/episodes/stage-<n>/*.json (n = 2, 3, 4, 6, 7) are lesson cells (F-CURR-001):
//     the lesson-* rules of packages/content-schema/src/lesson-lint.ts (loaded through
//     scripts/ts-loader.mjs, one implementation): schema, no speaking, review sign-offs,
//     sourced notes, factRefs, source shape, copied sources, designation numbers and
//     verification passes. Their sources, verification and review records are a
//     reference zone (source titles may be Korean), and a `{ko:...}` token in an
//     English field is taught Korean, not a Korean UI string.
//   - A gloss never opens with the romanization of the Korean it glosses ("gimbap (seaweed
//     rice roll)" is "seaweed rice roll"): rule gloss-repeats-romanization, the one
//     implementation in scripts/overlay-rules.mjs (glossRepeatsRomanization, F-CNT-002), with
//     its proper-name allowlist; the overlay rules apply it to the Spanish glosses.
//   - content/i18n/<locale>/*.json are locale overlays, not base content: they
//     follow the overlay rules in scripts/overlay-rules.mjs (F-I18N-001 §3.7),
//     where Korean overlays may hold Hangul in translatable fields (a Korean
//     description is a gloss, not a UI field) and Spanish ones never do.
//     HANGUL_ROUTE_STRICT_LOCALES (comma-separated) makes missing translations
//     of those locales errors.
//
// Source of truth: .claude/skills/content-skill/SKILL.md §3.3,
// docs/specs/F-HW-001-homework-page.md §3.3 / §9.5.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import nodeModule from "node:module";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkPlacementTree } from "./placement-rules.mjs";
import { bannedWordIn, checkOverlayTree, glossRepeatsRomanization, glossRepeatsRule } from "./overlay-rules.mjs";

const ROOT = process.env.HANGUL_ROUTE_ROOT
  ? resolve(process.env.HANGUL_ROUTE_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = join(ROOT, "content");

// Research data that no screen reads (verified story drafts: Korean fields such as
// claim_ko and source titles are data, not UI text). Shipped story content under
// content/stories/*.json is scanned; F-STORY-001 adds its own story rules.
const SKIPPED_DIRS = [join("content", "stories", "research")];

// Locale overlays (F-I18N-001 §3.6) are checked by scripts/overlay-rules.mjs, not as base content.
const OVERLAY_DIR_PREFIX = "content/i18n/";

const KOREAN_RE = /[ㄱ-㆏가-힣]/;
const KOREAN_TARGET_FIELDS = new Set([
  "ko",
  "korean",
  "target",
  "answer_ko",
  "lang_ko",
]);

/**
 * Words a learner must never see (F-HW-001 §3.3): the `en` learner list of
 * packages/i18n/src/banned-words.json (the one list, F-I18N-001 §3.1), matched on
 * whole tokens, so ordinary copy containing them as substrings ("dismissed",
 * "incompletely") does not trip the gate. Overlays use their own locale's list.
 */
const bannedLearnerWord = (text) => bannedWordIn(text, "en");

/** English copy fields that a learner actually reads. */
const LEARNER_TEXT_FIELDS = new Set([
  "en",
  "gloss_en",
  "titleEn",
  "blurbEn",
  "subtitleEn",
  "bodyEn",
  "hoyaLineEn",
  "hoyaIntroEn",
  "labelEn",
  "promptEn",
  "messageEn",
  // F-STORY-001 §3.8: story copy that a learner (or a caregiver reading over
  // their shoulder) sees. Applies in every directory; the set is a union.
  "narrationEn",
  "summaryEn",
  "captionEn",
  "explainEn",
  "hintEn",
  "altEn",
  "claimEn",
  "advisoryNoteEn",
]);

// F-STORY-001 §3.8 reference zone. In shipped story files (content/stories/*.json)
// the top-level keys below hold grown-up / reviewer text and citations, where
// Hangul is allowed (claimKo, source titles and publishers, learning goals written
// as "한글 (romanization)"). Only `korean-in-ui-field` is lifted: the banned-word
// scan still runs on claimEn and errata[].summaryEn, and Korean target objects still
// need romanization and a gloss. Fields learners read (narrationEn, captionEn,
// explainEn, title.en, ...) and every other directory are never in the zone.
const STORY_DIR_PREFIX = "content/stories/";
const REFERENCE_ZONE_KEYS = new Set([
  "facts",
  "referenceDisplay",
  "authorNotes",
  "learningGoalsEn",
  "verification",
  "errata",
]);

function isStoryFile(file) {
  return file.split(sep).join("/").startsWith(STORY_DIR_PREFIX);
}

// F-CURR-001 §3.9: a lesson cell's sources, verification and review records are reference text,
// exactly where the schema puts them: `review` on the cell, `sources` / `verification` on a
// `culture[]` note. The same key anywhere else is checked like any other field.
const LESSON_FILE = /^content\/episodes\/stage-[2-467]\/[a-z]+\.json$/;
const isLessonFile = (file) => LESSON_FILE.test(file.split(sep).join("/"));
const isLessonZone = (path, k) =>
  (path.length === 0 && k === "review") ||
  (path.length === 2 && path[0] === "culture" && (k === "sources" || k === "verification"));
/**
 * `{ko:이}` in an English field of a lesson cell (`...En`) is taught Korean rendered with its
 * romanization (F-CURR-001 §3.4), not a UI string. Only there: the story, vocabulary and other
 * renderers do not read the token, so it stays a `korean-in-ui-field` everywhere else.
 */
const withoutKoTokens = (text) => text.replace(/\{ko:[^}]*\}/g, " ");
const uiText = (file, k, v) => (isLessonFile(file) && k.endsWith("En") ? withoutKoTokens(v) : v);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIPPED_DIRS.some((skip) => full.endsWith(skip))) continue;
      out.push(...walk(full));
      continue;
    }
    if (extname(entry) === ".json") out.push(full);
  }
  return out;
}

function visit(value, path, file, violations, parentObj, inReferenceZone = false) {
  if (Array.isArray(value)) {
    value.forEach((item, i) =>
      visit(item, [...path, String(i)], file, violations, parentObj, inReferenceZone)
    );
    return;
  }
  if (value && typeof value === "object") {
    const obj = value;
    const koreanFields = Object.entries(obj).filter(
      ([k, v]) => typeof v === "string" && KOREAN_RE.test(v) && KOREAN_TARGET_FIELDS.has(k)
    );
    for (const key of ["en", "gloss_en"]) {
      if (glossRepeatsRomanization({ ko: obj.ko, romanization: obj.romanization, gloss: obj[key] })) {
        violations.push({ file, path: [...path, key].join("."), rule: glossRepeatsRule(obj[key], obj.romanization) });
      }
    }
    if (koreanFields.length > 0) {
      if (!("romanization" in obj)) {
        violations.push({
          file,
          path: path.join(".") || "(root)",
          rule: "korean-without-romanization",
        });
      }
      if (!("gloss_en" in obj) && !("en" in obj)) {
        violations.push({
          file,
          path: path.join(".") || "(root)",
          rule: "korean-without-gloss",
        });
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      const zone =
        inReferenceZone ||
        (path.length === 0 && REFERENCE_ZONE_KEYS.has(k) && isStoryFile(file)) ||
        (isLessonFile(file) && isLessonZone(path, k));
      if (
        !zone &&
        typeof v === "string" &&
        KOREAN_RE.test(uiText(file, k, v)) &&
        !KOREAN_TARGET_FIELDS.has(k) &&
        k !== "romanization"
      ) {
        violations.push({
          file,
          path: [...path, k].join("."),
          rule: "korean-in-ui-field",
        });
      }
      const banned = typeof v === "string" && LEARNER_TEXT_FIELDS.has(k) ? bannedLearnerWord(v) : null;
      if (banned !== null) {
        violations.push({
          file,
          path: [...path, k].join("."),
          rule: `banned-on-learner-surface: "${banned}"`,
        });
      }
      visit(v, [...path, k], file, violations, obj, zone);
    }
  }
}

if (!existsSync(CONTENT_DIR)) {
  console.log("::notice::no content/ directory; skipping language policy check");
  process.exit(0);
}

const files = walk(CONTENT_DIR);
if (files.length === 0) {
  console.log("::notice::no .json files under content/; skipping language policy check");
  process.exit(0);
}

const violations = [];
const parsedByRel = new Map();
for (const file of files) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    violations.push({
      file,
      path: "(root)",
      rule: `invalid-json: ${err.message}`,
    });
    continue;
  }
  const rel = relative(ROOT, file).split(sep).join("/");
  if (!rel.startsWith(OVERLAY_DIR_PREFIX)) visit(parsed, [], relative(ROOT, file), violations);
  parsedByRel.set(rel, parsed);
}

// F-PLC-001 §3.4: structure of content/placement/**.
violations.push(...checkPlacementTree(parsedByRel));

// F-CURR-001 section 5: the lesson rules of every lesson cell file.
const lessonFiles = [...parsedByRel.keys()].filter((rel) => LESSON_FILE.test(rel));
if (lessonFiles.length > 0) {
  nodeModule.register(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "ts-loader.mjs")));
  const { lintLessonCell } = await import(
    pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "content-schema", "src", "lesson-lint.ts")).href
  );
  const storyFacts = new Map();
  for (const [rel, json] of parsedByRel) {
    if (!/^content\/stories\/[^/]+\.json$/.test(rel) || typeof json?.id !== "string") continue;
    storyFacts.set(json.id.replace(/^story:/, ""), new Set((json.facts ?? []).map((f) => f.id)));
  }
  // "Not in the future" is read against the latest calendar date on Earth (UTC+14), so a source
  // accessed today in Korea (UTC+9) never fails a CI run that starts before UTC midnight.
  const ctx = { today: new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10), storyFacts };
  for (const rel of lessonFiles) {
    for (const f of lintLessonCell(parsedByRel.get(rel), ctx)) {
      violations.push({ file: rel, path: f.path, rule: `${f.rule}: ${f.message}` });
    }
  }
}

// F-I18N-001 §3.7: content/i18n/<locale>/*.json against the base content.
const strictLocales = (process.env.HANGUL_ROUTE_STRICT_LOCALES ?? "")
  .split(",")
  .map((l) => l.trim())
  .filter(Boolean);
const overlays = checkOverlayTree(parsedByRel, { strictLocales });
violations.push(...overlays.violations);

for (const w of overlays.warnings) {
  console.log(`::warning file=${w.file}::${w.rule} at .${w.path}`);
}
for (const v of violations) {
  console.log(`::error file=${v.file}::${v.rule} at .${v.path}`);
}
console.log("");
const missingSummary = Object.entries(overlays.missing)
  .map(([locale, n]) => `${locale}: ${n} missing`)
  .join(", ");
console.log(
  `Content language policy: ${files.length} file(s) scanned, ${violations.length} violation(s); ${missingSummary}`
);

if (violations.length > 0) process.exit(1);
