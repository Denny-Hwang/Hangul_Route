#!/usr/bin/env node
// F-I18N-001 §3.10 step 4 — translation status of the UI dictionary.
//
// Prints, per locale and namespace (one namespace = one file under
// packages/i18n/src/messages/en/):
//   - missing keys: the dotted paths that fall back to English (`fallbackPaths`
//     from @hangul-route/i18n; the English-authoritative legal text is never
//     counted, decision L10);
//   - review state from packages/i18n/src/messages/review-ledger.json:
//     current (ledger `enSha` = sha256 of the English file, LF line endings),
//     stale (the English changed since the native review) or not reviewed;
//   - the locale's LOCALE_STATUS;
//   - the current enSha of every English namespace (reviewers copy it into the
//     ledger).
//
// Fails (exit 1, `::error::`) on:
//   - missing keys in a 'shipped' locale;
//   - the automatable parts of the §3.10 step 5 release gate for a 'shipped'
//     locale: a ledger entry for every namespace, and the locale listed in
//     HANGUL_ROUTE_STRICT_LOCALES of .github/workflows/content-validation.yml
//     (so the content validator treats its missing overlays as errors);
//   - with `--base <ref>` (CI on a pull request): a locale that is 'shipped'
//     here but not at <ref> (the flip PR) whose ledger entries do not all match
//     the current English (a stale or made-up enSha cannot pass the flip);
//   - a malformed ledger, a strict locale that is the source or unknown, more
//     than one HANGUL_ROUTE_STRICT_LOCALES declaration, a namespace with no
//     English file.
// Stale namespaces of an already-shipped locale only warn (`::warning::`).
// Not checked here: the §3.11 layout matrix (nightly e2e, PR 14) stays a manual
// gate for the flip PRs (PR 15 / PR 16).
//
// `--list` also prints every missing path (the R8 Translation Sync routine
// uses it to pick what to draft: routines/R8-translation-sync.md).
//
// The dictionary is TypeScript; it is loaded through scripts/ts-loader.mjs
// with the repo's `typescript`. Source of truth:
// docs/specs/F-I18N-001-ui-locales.md §3.10.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import * as nodeModule from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export const LEDGER_REL = "packages/i18n/src/messages/review-ledger.json";
export const WORKFLOW_REL = ".github/workflows/content-validation.yml";
export const LOCALE_STATUS_REL = "packages/i18n/src/locales.ts";
const EN_DIR_REL = "packages/i18n/src/messages/en";
const SOURCE_LOCALE = "en";
const SHA = /^[0-9a-f]{64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// Initials only: the repo is public, so no reviewer names or emails.
const INITIALS = /^[A-Z]{2,4}$/;
const ENTRY_FIELDS = new Set(["enSha", "reviewedBy", "reviewedAt"]);
const SAMPLE = 3;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const STRICT_LINE = /^[ \t]*HANGUL_ROUTE_STRICT_LOCALES:/gm;

/** How many uncommented `HANGUL_ROUTE_STRICT_LOCALES:` declarations a workflow has (must be one). */
export function countStrictDeclarations(workflowText) {
  return (workflowText.match(STRICT_LINE) ?? []).length;
}

/** The `LOCALE_STATUS` object literal of locales.ts source text, or null. */
export function parseLocaleStatusSource(tsText) {
  const block = /\bLOCALE_STATUS\b[^=]*=\s*\{([^}]*)\}/.exec(tsText);
  if (!block) return null;
  const status = {};
  for (const m of block[1].matchAll(/["']?([A-Za-z][\w-]*)["']?\s*:\s*["'](\w+)["']/g)) status[m[1]] = m[2];
  return status;
}

/** sha256 of an English namespace file, with CRLF normalised to LF so a Windows checkout hashes like CI. */
export function hashEnglishSource(buffer) {
  return createHash("sha256").update(buffer.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
}

/** Escapes workflow-command text (GitHub: % -> %25, CR -> %0D, LF -> %0A). */
export function escapeAnnotation(text) {
  return String(text).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

const annotate = (kind, text, props = "") => console.log(`::${kind}${props}::${escapeAnnotation(text)}`);

/** The comma list of the (uncommented) `HANGUL_ROUTE_STRICT_LOCALES:` line of a workflow. */
export function parseStrictLocales(workflowText) {
  const line = /^[ \t]*HANGUL_ROUTE_STRICT_LOCALES:[ \t]*(.*)$/m.exec(workflowText);
  if (!line) return [];
  const value = line[1].replace(/[ \t]+#.*$/, "").trim().replace(/^(["'])(.*)\1$/, "$2");
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function isRealDate(text) {
  const m = DATE.exec(text);
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCFullYear() === Number(m[1]) && date.getUTCMonth() === Number(m[2]) - 1 && date.getUTCDate() === Number(m[3]);
}

/** Shape errors of the review ledger `{ <locale>: { <namespace>: { enSha, reviewedBy, reviewedAt } } }`. */
export function validateLedger(ledger, { overlayLocales, namespaces }) {
  if (!isObject(ledger)) return [`${LEDGER_REL}: expected an object keyed by locale`];
  const errors = [];
  for (const [locale, entries] of Object.entries(ledger)) {
    if (!overlayLocales.includes(locale)) {
      errors.push(`${LEDGER_REL}: "${locale}" is not an overlay locale (${overlayLocales.join(", ")})`);
      continue;
    }
    if (!isObject(entries)) {
      errors.push(`${LEDGER_REL}: ${locale} must be an object keyed by namespace`);
      continue;
    }
    for (const [namespace, entry] of Object.entries(entries)) {
      const at = `${LEDGER_REL}: ${locale}.${namespace}`;
      if (!namespaces.includes(namespace)) {
        errors.push(`${at}: unknown namespace (one entry per namespace file: ${namespaces.join(", ")})`);
        continue;
      }
      if (!isObject(entry)) {
        errors.push(`${at}: expected { enSha, reviewedBy, reviewedAt }`);
        continue;
      }
      if (typeof entry.enSha !== "string" || !SHA.test(entry.enSha)) errors.push(`${at}: enSha must be the sha256 (64 hex) of messages/en/${namespace}.ts`);
      if (typeof entry.reviewedBy !== "string" || !INITIALS.test(entry.reviewedBy)) {
        errors.push(`${at}: reviewedBy must be the reviewer's initials, 2-4 capital letters (public repo: no names or emails)`);
      }
      if (typeof entry.reviewedAt !== "string" || !isRealDate(entry.reviewedAt)) errors.push(`${at}: reviewedAt must be a YYYY-MM-DD date`);
      for (const field of Object.keys(entry)) if (!ENTRY_FIELDS.has(field)) errors.push(`${at}: unexpected field "${field}"`);
    }
  }
  return errors;
}

/**
 * Status of every locale. Pure: the caller loads the dictionary and the files.
 * fallbacks: { <locale>: dotted paths falling back to English }; enShas: { <namespace>: sha256 | undefined };
 * strictDeclarations: how many HANGUL_ROUTE_STRICT_LOCALES lines the workflow has;
 * baseStatus: LOCALE_STATUS at the PR's base ref (undefined outside a pull request).
 */
export function computeStatus({ locales, status, namespaces, fallbacks, enShas, ledger, strictLocales, strictDeclarations = 1, baseStatus }) {
  const overlayLocales = locales.filter((l) => l !== SOURCE_LOCALE);
  const errors = validateLedger(ledger, { overlayLocales, namespaces });
  const warnings = [];
  const goodLedger = errors.length === 0 ? ledger : {};

  for (const namespace of namespaces) {
    if (!enShas[namespace]) errors.push(`namespace "${namespace}" has no English file ${EN_DIR_REL}/${namespace}.ts`);
  }
  if (strictDeclarations > 1) {
    errors.push(`${WORKFLOW_REL}: declare HANGUL_ROUTE_STRICT_LOCALES once, at workflow level (found ${strictDeclarations}); a job or step override would make i18n-status read a different list than the validator uses`);
  }
  for (const locale of strictLocales) {
    if (!overlayLocales.includes(locale)) {
      errors.push(`${WORKFLOW_REL}: HANGUL_ROUTE_STRICT_LOCALES lists "${locale}", which is not an overlay locale (${overlayLocales.join(", ")})`);
    }
  }

  const rows = locales.map((locale) => {
    if (locale === SOURCE_LOCALE) return { locale, status: status[locale], source: true, missing: 0, namespaces: [] };
    const paths = fallbacks[locale] ?? [];
    const reviews = isObject(goodLedger[locale]) ? goodLedger[locale] : {};
    const rowNamespaces = namespaces.map((namespace) => {
      const missing = paths.filter((p) => p === namespace || p.startsWith(`${namespace}.`));
      const entry = reviews[namespace];
      let review = "unreviewed";
      if (entry) review = entry.enSha === enShas[namespace] ? "current" : "stale";
      return { namespace, missing, review, entry };
    });
    return { locale, status: status[locale], source: false, missing: paths.length, namespaces: rowNamespaces };
  });

  for (const row of rows) {
    if (row.source) continue;
    for (const ns of row.namespaces) {
      if (ns.review === "stale") {
        warnings.push(`${row.locale}.${ns.namespace}: English changed since the review by ${ns.entry.reviewedBy} on ${ns.entry.reviewedAt}; re-review and update ${LEDGER_REL}`);
      }
    }
    if (row.status !== "shipped") continue;
    for (const ns of row.namespaces) {
      if (ns.missing.length > 0) {
        const sample = ns.missing.slice(0, SAMPLE).join(", ");
        errors.push(`${row.locale} is shipped but ${ns.namespace} has ${ns.missing.length} missing key(s): ${sample}${ns.missing.length > SAMPLE ? ", ..." : ""}`);
      }
      if (ns.review === "unreviewed") errors.push(`${row.locale} is shipped but ${ns.namespace} has no native review in ${LEDGER_REL}`);
      const flipping = baseStatus !== undefined && baseStatus[row.locale] !== "shipped";
      if (flipping && ns.review === "stale") {
        errors.push(`${row.locale} flips to shipped but ${ns.namespace}'s ledger enSha does not match the current English; review the current text and record the enSha this report prints`);
      }
    }
    if (!strictLocales.includes(row.locale)) {
      errors.push(`${row.locale} is shipped but not in HANGUL_ROUTE_STRICT_LOCALES (${WORKFLOW_REL}); missing overlays must be errors for a shipped locale`);
    }
  }
  return { locales: rows, enShas, errors, warnings };
}

function reviewText(ns) {
  if (ns.review === "unreviewed") return "not reviewed";
  const by = `reviewed by ${ns.entry.reviewedBy} on ${ns.entry.reviewedAt}`;
  return ns.review === "stale" ? `${by}, English changed since` : by;
}

/** Human-readable report. `list` adds every missing path. */
export function renderReport(result, { list, englishAuthoritative }) {
  const width = Math.max(0, ...result.locales.flatMap((l) => l.namespaces.map((n) => n.namespace.length)));
  const lines = ["UI dictionary translation status (F-I18N-001 §3.10)"];
  for (const row of result.locales) {
    if (row.source) {
      lines.push(`${row.locale}  ${row.status}  source`);
      for (const [namespace, hash] of Object.entries(result.enShas ?? {})) {
        if (hash) lines.push(`  ${namespace.padEnd(width)}  enSha ${hash}`);
      }
      continue;
    }
    const reviewed = row.namespaces.filter((n) => n.review === "current").length;
    lines.push(`${row.locale}  ${row.status}  ${row.missing} missing  ${reviewed}/${row.namespaces.length} namespace(s) reviewed`);
    for (const ns of row.namespaces) {
      lines.push(`  ${ns.namespace.padEnd(width)}  ${ns.missing.length} missing  ${reviewText(ns)}`);
      if (list) for (const path of ns.missing) lines.push(`    ${path}`);
    }
  }
  if (englishAuthoritative.length > 0) {
    lines.push(`English in every locale by design, not counted (L10): ${englishAuthoritative.map((p) => `${p}*`).join(", ")}`);
  }
  return lines.join("\n");
}

function readJson(path) {
  try {
    return { value: JSON.parse(readFileSync(path, "utf8")) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const USAGE = "usage: node scripts/i18n-status.mjs [--list] [--base <git ref>]";

function parseArgs(argv) {
  const args = { list: false, base: undefined, unknown: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--list") args.list = true;
    else if (argv[i] === "--base") {
      const ref = argv[i + 1];
      if (!ref || ref.startsWith("-")) return { error: `--base needs a git ref (${USAGE})` };
      args.base = ref;
      i += 1;
    } else args.unknown.push(argv[i]);
  }
  if (args.unknown.length > 0) return { error: `unknown option(s) ${args.unknown.join(" ")} (${USAGE})` };
  return args;
}

/** LOCALE_STATUS at a git ref, read with `git show` (fails closed). */
function readBaseStatus(root, ref) {
  const shown = spawnSync("git", ["show", `${ref}:${LOCALE_STATUS_REL}`], { cwd: root, encoding: "utf8" });
  const parsed = shown.status === 0 ? parseLocaleStatusSource(shown.stdout) : null;
  if (!parsed) return { error: `cannot read LOCALE_STATUS at ${ref} (${LOCALE_STATUS_REL}): ${(shown.stderr || "no LOCALE_STATUS literal").trim()}` };
  return { value: parsed };
}

export async function main(argv, root) {
  const args = parseArgs(argv);
  if (args.error) {
    annotate("error", `i18n-status: ${args.error}`);
    return 1;
  }
  const { list } = args;

  if (typeof nodeModule.register !== "function") {
    annotate("error", `i18n-status needs Node 20.6+ (module.register); this is ${process.version}`);
    return 1;
  }
  nodeModule.register(pathToFileURL(join(SCRIPT_DIR, "ts-loader.mjs")));
  const i18n = await import(pathToFileURL(join(root, "packages/i18n/src/index.ts")).href);

  const locales = Object.keys(i18n.LOCALE_STATUS);
  const namespaces = Object.keys(i18n.en);
  const fallbacks = Object.fromEntries(locales.map((l) => [l, i18n.fallbackPaths(l)]));
  const enShas = Object.fromEntries(
    namespaces.map((ns) => {
      const file = join(root, EN_DIR_REL, `${ns}.ts`);
      return [ns, existsSync(file) ? hashEnglishSource(readFileSync(file)) : undefined];
    }),
  );

  const ledgerRead = readJson(join(root, LEDGER_REL));
  if (ledgerRead.error) {
    annotate("error", `${LEDGER_REL} is not readable JSON: ${ledgerRead.error}`, ` file=${LEDGER_REL}`);
    return 1;
  }
  const workflowPath = join(root, WORKFLOW_REL);
  const workflowText = existsSync(workflowPath) ? readFileSync(workflowPath, "utf8") : "";
  const strictLocales = parseStrictLocales(workflowText);
  const strictDeclarations = countStrictDeclarations(workflowText);

  let baseStatus;
  if (args.base) {
    const base = readBaseStatus(root, args.base);
    if (base.error) {
      annotate("error", base.error);
      return 1;
    }
    baseStatus = base.value;
  }

  const result = computeStatus({
    locales,
    status: i18n.LOCALE_STATUS,
    namespaces,
    fallbacks,
    enShas,
    ledger: ledgerRead.value,
    strictLocales,
    strictDeclarations,
    baseStatus,
  });
  console.log(renderReport(result, { list, englishAuthoritative: [...(i18n.ENGLISH_AUTHORITATIVE_PREFIXES ?? [])] }));
  for (const warning of result.warnings) annotate("warning", warning);
  for (const error of result.errors) annotate("error", error);
  return result.errors.length > 0 ? 1 : 0;
}

// Real paths on both sides: Node resolves symlinks in import.meta.url but not in argv[1]
// (macOS /tmp -> /private/tmp), and a gate must not exit 0 silently.
const isMain = Boolean(process.argv[1]) && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isMain) {
  const root = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : join(SCRIPT_DIR, "..");
  process.exitCode = await main(process.argv.slice(2), root);
}
