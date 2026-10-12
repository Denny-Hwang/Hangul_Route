#!/usr/bin/env node
// Story version rules (F-STORY-001 §3.7, PR 1.5).
//
// For every content/stories/*.json in the working tree, compare it with the
// same file on the base ref (`git show <base>:<path>`, default origin/main) and
// enforce the content history rules:
//
//   only when the base file has state 'ready' (a draft has shipped nothing):
//     - content-ver-not-bumped  any change outside {contentVer, errata,
//                               verification, review, shelf, state} without a
//                               strictly greater contentVer
//     - fact-rev-not-bumped     a fact's claimEn / claimKo / sources changed
//                               without a strictly greater rev
//     - fact-removed-silently   a fact id on the base is gone, and no erratum of
//                               kind 'removal' names it
//     - version-decreased       contentVer or a fact rev went down
//   always:
//     - erratum-removed /       errata are append-only: an existing erratum id
//       erratum-changed         stays, with the same date, kind and factIds
//     - new-story-content-ver   a file not on the base starts at contentVer 1
//
// `state` is exempt because a hold (an S1 correction that cannot be made yet)
// changes only state from 'ready' to 'draft' (content/stories/README.md), and a
// draft turning ready keeps its contentVer.
//
// Plain Node over JSON: the story schema is not imported, so this check runs
// without `pnpm install`; validate-content and the content-schema suite own the
// shape. CI runs it from content-validation.yml with `fetch-depth: 0` so the
// base ref exists.
//
// Usage: node scripts/check-story-versions.mjs [--base <ref>]

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : resolve(SCRIPT_DIR, "..");
const STORY_DIR = "content/stories";
const DEFAULT_BASE = "origin/main";

/** Top-level keys whose edits never need a contentVer bump. */
const VERSION_EXEMPT_KEYS = new Set(["contentVer", "errata", "verification", "review", "shelf", "state"]);
/** Fact keys whose edits need a fact rev bump. */
const FACT_REV_KEYS = ["claimEn", "claimKo", "sources"];
/** Erratum keys that never change once merged. */
const ERRATUM_FIXED_KEYS = ["date", "kind", "factIds"];

/** True for a story file: content/stories/<name>.json (not research/, not README). */
export function isStoryFile(relPath) {
  return /^content\/stories\/[^/]+\.json$/.test(relPath);
}

/** JSON with object keys sorted, so key order and whitespace never count as a change. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function same(a, b) {
  return canonical(a) === canonical(b);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parse(text) {
  try {
    const value = JSON.parse(text);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function list(value) {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function byId(items) {
  const out = new Map();
  for (const item of items) if (typeof item.id === "string") out.set(item.id, item);
  return out;
}

function withoutKeys(story, keys) {
  return Object.fromEntries(Object.entries(story).filter(([k]) => !keys.has(k)));
}

function errataRules(path, base, head) {
  const findings = [];
  const headErrata = byId(list(head.errata));
  for (const old of list(base.errata)) {
    if (typeof old.id !== "string") continue;
    const now = headErrata.get(old.id);
    if (!now) {
      findings.push({ path, code: "erratum-removed", message: `erratum ${old.id} is on the base and missing now; errata are append-only` });
      continue;
    }
    const changed = ERRATUM_FIXED_KEYS.filter((k) => !same(old[k], now[k]));
    if (changed.length > 0) {
      findings.push({ path, code: "erratum-changed", message: `erratum ${old.id} changed ${changed.join(", ")}; an existing erratum keeps its date, kind and factIds` });
    }
  }
  return findings;
}

function readyRules(path, base, head) {
  const findings = [];
  const baseVer = base.contentVer;
  const headVer = head.contentVer;
  const verRaised = typeof baseVer === "number" && typeof headVer === "number" && headVer > baseVer;

  if (typeof baseVer === "number" && typeof headVer === "number" && headVer < baseVer) {
    findings.push({ path, code: "version-decreased", message: `contentVer went down: ${baseVer} -> ${headVer}` });
  }

  if (!same(withoutKeys(base, VERSION_EXEMPT_KEYS), withoutKeys(head, VERSION_EXEMPT_KEYS)) && !verRaised) {
    findings.push({
      path,
      code: "content-ver-not-bumped",
      message: `content changed outside errata, verification, review, shelf and state, but contentVer was not raised (base ${baseVer}, now ${headVer})`,
    });
  }

  const headFacts = byId(list(head.facts));
  const removals = new Set(
    list(head.errata)
      .filter((e) => e.kind === "removal" && Array.isArray(e.factIds))
      .flatMap((e) => e.factIds)
  );
  for (const old of list(base.facts)) {
    if (typeof old.id !== "string") continue;
    const now = headFacts.get(old.id);
    if (!now) {
      if (!removals.has(old.id)) {
        findings.push({ path, code: "fact-removed-silently", message: `fact ${old.id} was removed without an erratum of kind "removal" naming it` });
      }
      continue;
    }
    if (typeof old.rev === "number" && typeof now.rev === "number" && now.rev < old.rev) {
      findings.push({ path, code: "version-decreased", message: `fact ${old.id} rev went down: ${old.rev} -> ${now.rev}` });
    }
    const changed = FACT_REV_KEYS.filter((k) => !same(old[k], now[k]));
    const revRaised = typeof old.rev === "number" && typeof now.rev === "number" && now.rev > old.rev;
    if (changed.length > 0 && !revRaised) {
      findings.push({ path, code: "fact-rev-not-bumped", message: `fact ${old.id} changed ${changed.join(", ")} but its rev was not raised (base ${old.rev}, now ${now.rev})` });
    }
  }
  return findings;
}

/**
 * The version findings for one story file.
 * @param {{ path: string, baseText: string | null, headText: string }} input
 *   baseText is null when the file is not on the base ref (a new story).
 * @returns {Array<{ path: string, code: string, message: string }>}
 */
export function checkStoryVersions({ path, baseText, headText }) {
  const head = parse(headText);
  if (!head) return [{ path, code: "invalid-json", message: "the story file is not a JSON object" }];

  if (baseText === null) {
    return head.contentVer === 1
      ? []
      : [{ path, code: "new-story-content-ver", message: `a new story file starts at contentVer: 1 (found ${JSON.stringify(head.contentVer)})` }];
  }

  // A base that does not parse shipped nothing we can compare; validate-content reports it on main.
  const base = parse(baseText);
  if (!base) return [];

  const findings = errataRules(path, base, head);
  if (base.state === "ready") findings.push(...readyRules(path, base, head));
  return findings;
}

// ---- CLI ---------------------------------------------------------------------

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

function baseTextOf(ref, relPath) {
  try {
    return git(["show", `${ref}:${relPath}`]);
  } catch {
    return null; // not on the base: a new file
  }
}

function parseArgs(argv) {
  let base = DEFAULT_BASE;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base" && argv[i + 1]) base = argv[++i];
    else if (argv[i].startsWith("--base=")) base = argv[i].slice("--base=".length);
    else throw new Error(`unknown argument ${argv[i]}; usage: node scripts/check-story-versions.mjs [--base <ref>]`);
  }
  return { base };
}

function main() {
  let base;
  try {
    ({ base } = parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stdout.write(`::error::${error.message}\n`);
    return 1;
  }

  try {
    git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  } catch {
    process.stdout.write(
      `::error::base ref ${base} was not found; in CI the checkout needs fetch-depth: 0 (content-validation.yml), locally run git fetch origin\n`
    );
    return 1;
  }

  const dir = join(ROOT, STORY_DIR);
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => `${STORY_DIR}/${f}`).filter(isStoryFile).sort()
    : [];

  const findings = [];
  for (const rel of files) {
    const headText = readFileSync(join(ROOT, rel), "utf8");
    const baseText = baseTextOf(base, rel);
    if (baseText !== null && baseText === headText) continue;
    findings.push(...checkStoryVersions({ path: rel, baseText, headText }));
  }

  for (const f of findings) process.stdout.write(`::error file=${f.path}::${f.code}: ${f.message}\n`);
  process.stdout.write(`check-story-versions: ${files.length} story file(s) checked against ${base}, ${findings.length} problem(s)\n`);
  if (findings.length > 0) {
    process.stdout.write("See content/stories/README.md (Versions) for when to raise contentVer and a fact's rev.\n");
  }
  return findings.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
