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
//
// Source of truth: .claude/skills/content-skill/SKILL.md §3.3,
// docs/specs/F-HW-001-homework-page.md §3.3 / §9.5.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.HANGUL_ROUTE_ROOT
  ? resolve(process.env.HANGUL_ROUTE_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = join(ROOT, "content");

const KOREAN_RE = /[ㄱ-㆏가-힣]/;
const KOREAN_TARGET_FIELDS = new Set([
  "ko",
  "korean",
  "target",
  "answer_ko",
  "lang_ko",
]);

/**
 * Words a learner must never see (F-HW-001 §3.3). Matched case-insensitively
 * on word boundaries, so ordinary copy containing them as substrings
 * ("dismissed", "incompletely") does not trip the gate.
 *
 * The caregiver-surface list (F-PAR-001 §3.6) is deliberately separate and
 * lands with T-037: a word banned for a child can be necessary for an adult.
 */
const BANNED_LEARNER_WORDS = ["missed", "incomplete", "failed", "overdue"];
const BANNED_LEARNER_RE = new RegExp(
  `\\b(${BANNED_LEARNER_WORDS.join("|")})\\b`,
  "i"
);

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
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (extname(entry) === ".json") out.push(full);
  }
  return out;
}

function visit(value, path, file, violations, parentObj) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => visit(item, [...path, String(i)], file, violations, parentObj));
    return;
  }
  if (value && typeof value === "object") {
    const obj = value;
    const koreanFields = Object.entries(obj).filter(
      ([k, v]) => typeof v === "string" && KOREAN_RE.test(v) && KOREAN_TARGET_FIELDS.has(k)
    );
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
      if (
        typeof v === "string" &&
        KOREAN_RE.test(v) &&
        !KOREAN_TARGET_FIELDS.has(k) &&
        k !== "romanization"
      ) {
        violations.push({
          file,
          path: [...path, k].join("."),
          rule: "korean-in-ui-field",
        });
      }
      if (
        typeof v === "string" &&
        LEARNER_TEXT_FIELDS.has(k) &&
        BANNED_LEARNER_RE.test(v)
      ) {
        const hit = v.match(BANNED_LEARNER_RE);
        violations.push({
          file,
          path: [...path, k].join("."),
          rule: `banned-on-learner-surface: "${hit ? hit[1] : ""}"`,
        });
      }
      visit(v, [...path, k], file, violations, obj);
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
  visit(parsed, [], relative(ROOT, file), violations);
}

for (const v of violations) {
  console.log(`::error file=${v.file}::${v.rule} at .${v.path}`);
}
console.log("");
console.log(
  `Content language policy: ${files.length} file(s) scanned, ${violations.length} violation(s)`
);

if (violations.length > 0) process.exit(1);
