#!/usr/bin/env node
// F-I18N-001 §3.11 — i18n regression guards. Walks non-test source under
// apps/, packages/ and scripts/ and enforces:
//   a) no plural-suffix ternaries (`n === 1 ? '' : 's'`, `n !== 1 ? 's' : ''`):
//      a plural is a message function using plural() from @hangul-route/i18n.
//      Code that predates the rule is counted per file in
//      scripts/i18n-migrated.json "pluralTernaryBaseline"; a file may never
//      exceed its baseline, and each extraction PR lowers it.
//   b) on every glob in scripts/i18n-migrated.json "globs" (a ratchet: each
//      surface PR adds its glob), no JSX text with letters and no string-literal
//      label / title / placeholder / alt / accessibilityLabel / accessibilityHint
//      attributes — the text belongs in the dictionary.
//   c) no bare `Intl` outside packages/i18n (formatters live there).
//
// Parses with the repo's `typescript` (resolved through apps/mobile). Source of
// truth: docs/specs/F-I18N-001-ui-locales.md §3.11.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.HANGUL_ROUTE_ROOT
  ? resolve(process.env.HANGUL_ROUTE_ROOT)
  : join(SCRIPT_DIR, "..");

// The repo's TypeScript lives in the workspace packages, not at the root.
function loadTypeScript() {
  for (const pkg of ["apps/mobile", "packages/i18n", "packages/content-schema"]) {
    try {
      return createRequire(join(SCRIPT_DIR, "..", pkg, "package.json"))("typescript");
    } catch {
      // try the next workspace
    }
  }
  console.log("::error::typescript not found; run `pnpm install` first");
  process.exit(1);
}
const ts = loadTypeScript();

const SCAN_DIRS = ["apps", "packages", "scripts"];
const SKIPPED_DIRS = new Set([
  "node_modules", "dist", "build", "out", "coverage", ".next", ".expo", ".turbo",
  "__tests__", "__mocks__", "e2e", ".git",
]);
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const LABEL_ATTRIBUTES = new Set(["label", "title", "placeholder", "alt", "accessibilityLabel", "accessibilityHint"]);
const LETTER = /[A-Za-zÀ-ɏᄀ-ᇿ㄰-㆏가-힯]/;
const MIGRATED_FILE = join(ROOT, "scripts", "i18n-migrated.json");

const problems = [];
const report = (file, line, message) => problems.push({ file, line, message });

function toPosix(path) {
  return path.split(sep).join("/");
}

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).sort()) {
    if (SKIPPED_DIRS.has(name)) continue;
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) yield* walk(full);
    else if (SOURCE_EXT.has(extname(name)) && !name.endsWith(".d.ts") && !TEST_FILE.test(name)) yield full;
  }
}

/** `**` crosses directories, `*` stays inside one. */
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      re += ".*";
      i += 1;
      if (glob[i + 1] === "/") i += 1;
    } else if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function loadMigrated() {
  if (!existsSync(MIGRATED_FILE)) {
    report("scripts/i18n-migrated.json", 1, "missing: the ratchet list of migrated surfaces is required");
    return { globs: [], baseline: {} };
  }
  try {
    const data = JSON.parse(readFileSync(MIGRATED_FILE, "utf8"));
    const globs = Array.isArray(data.globs) ? data.globs.filter((g) => typeof g === "string") : [];
    const baseline = data.pluralTernaryBaseline && typeof data.pluralTernaryBaseline === "object" ? data.pluralTernaryBaseline : {};
    return { globs, baseline };
  } catch (err) {
    report("scripts/i18n-migrated.json", 1, `cannot be read as JSON (${err.message})`);
    return { globs: [], baseline: {} };
  }
}

function scriptKindFor(file) {
  switch (extname(file)) {
    case ".tsx": return ts.ScriptKind.TSX;
    case ".jsx": return ts.ScriptKind.JSX;
    case ".js": case ".mjs": case ".cjs": return ts.ScriptKind.JS;
    default: return ts.ScriptKind.TS;
  }
}

const isStringLike = (node) =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));
const isEmptyString = (node) => isStringLike(node) && node.text === "";
const isOne = (node) => ts.isNumericLiteral(node) && node.text === "1";

/** `x === 1 ? '' : 's'` / `x !== 1 ? 's' : ''` (either operand order, any quote style). */
function isPluralSuffixTernary(node) {
  if (!ts.isConditionalExpression(node)) return false;
  const cond = node.condition;
  if (!ts.isBinaryExpression(cond)) return false;
  const op = cond.operatorToken.kind;
  if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken && op !== ts.SyntaxKind.ExclamationEqualsEqualsToken) return false;
  if (!isOne(cond.left) && !isOne(cond.right)) return false;
  return (
    (isEmptyString(node.whenTrue) && isStringLike(node.whenFalse) && !isEmptyString(node.whenFalse)) ||
    (isEmptyString(node.whenFalse) && isStringLike(node.whenTrue) && !isEmptyString(node.whenTrue))
  );
}

function isBareIntl(node) {
  if (!ts.isIdentifier(node) || node.text !== "Intl") return false;
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent)) return parent.expression === node || parent.name === node;
  if (ts.isQualifiedName(parent)) return parent.left === node;
  return ts.isTypeOfExpression(parent) || ts.isElementAccessExpression(parent) || ts.isCallExpression(parent);
}

function attributeLiteral(init) {
  if (init === undefined) return false;
  if (isStringLike(init)) return true;
  return ts.isJsxExpression(init) && isStringLike(init.expression);
}

function checkFile(file, rel, { checkJsx, inI18nPackage }) {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const pluralLines = [];

  const visit = (node) => {
    if (isPluralSuffixTernary(node)) pluralLines.push(lineOf(node));
    if (!inI18nPackage && isBareIntl(node)) {
      report(rel, lineOf(node), "bare `Intl` outside packages/i18n: use formatDate / formatNumber / formatUsd from @hangul-route/i18n");
    }
    if (checkJsx) {
      if (ts.isJsxText(node) && LETTER.test(node.text)) {
        report(rel, lineOf(node), `JSX text "${node.text.trim().slice(0, 40)}" in a migrated surface: move it to the dictionary`);
      }
      if (ts.isJsxAttribute(node) && LABEL_ATTRIBUTES.has(node.name.getText(source)) && attributeLiteral(node.initializer)) {
        report(rel, lineOf(node), `string-literal \`${node.name.getText(source)}\` in a migrated surface: take it from the dictionary`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return pluralLines;
}

const { globs, baseline } = loadMigrated();
const migrated = globs.map(globToRegExp);
const pluralCounts = new Map();

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = toPosix(relative(ROOT, file));
    const lines = checkFile(file, rel, {
      checkJsx: migrated.some((re) => re.test(rel)),
      inI18nPackage: rel.startsWith("packages/i18n/"),
    });
    if (lines.length === 0) continue;
    const allowed = Number(baseline[rel] ?? 0);
    pluralCounts.set(rel, lines.length);
    if (lines.length > allowed) {
      for (const line of lines) {
        report(rel, line, `plural-suffix ternary (${lines.length} in this file, baseline ${allowed}): use plural() in a message function`);
      }
    }
  }
}

for (const [rel, allowed] of Object.entries(baseline)) {
  const found = pluralCounts.get(rel) ?? 0;
  if (found < Number(allowed)) {
    console.log(`::warning file=${rel}::plural-suffix baseline can be lowered from ${allowed} to ${found} in scripts/i18n-migrated.json`);
  }
}

if (problems.length > 0) {
  for (const p of problems) console.log(`::error file=${p.file},line=${p.line}::${p.message}`);
  console.log(`check-i18n: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("check-i18n: ok");
