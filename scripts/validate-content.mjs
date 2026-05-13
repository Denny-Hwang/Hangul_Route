#!/usr/bin/env node
// F-CNT-001 — Content language policy validator.
// Walks content/**/*.json and enforces:
//   - Korean strings (Hangul jamo or syllables) only appear in fields named
//     `ko`, `korean`, `target`, `answer_ko` (or under explicit `lang_ko`
//     sub-objects).
//   - Whenever a Korean string is present, the same object MUST also carry
//     a `romanization` (Revised Romanization, not McCune-Reischauer) and an
//     English gloss in `gloss_en` or `en`.
//
// Source of truth: .claude/skills/content-skill/SKILL.md §3.3.

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
