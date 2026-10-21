#!/usr/bin/env node
// F-CURR-002 §9.1 (row CM-6) — the `addedIn` stamp check.
//
// From CM-6 on, `CATALOG_VERSION` is generated as the largest `addedIn` stamp of a shipped quest
// (scripts/build-lessons.mjs), so a quest added on a branch must carry a stamp that is not lower than
// the version `main` already has: a placement result stored at main's version would otherwise skip
// the new quest as one it already knew (the catalogue-growth rule, F-CURR-001 §3.13). A quest is new
// when the branch ships it and the base does not:
//
//   - a quest of a ready lesson cell, content/episodes/stage-<n>/<theme>.json (its `addedIn`);
//   - the listen quest of a story file, content/stories/<slug>.json (the story's `addedIn`).
//
// The base's version is the largest of 32 (the last hand-kept version), the base's own stamps and,
// before CM-6, the `CATALOG_VERSION` literal of its packages/content-schema/src/catalog/data.ts.
// The fix is a one-field edit in the PR's own content file.
//
// Usage:
//   node scripts/check-added-in.mjs --base <ref>     e.g. --base origin/main (needs the base's history)
//
// `node scripts/build-lessons.mjs --check` (content-validation.yml, a full-history checkout) runs it
// against origin/main. Exit 0 when every new quest is stamped at or above the base's version, 1 when
// one is not, 2 on a usage error or a base ref that does not resolve. HANGUL_ROUTE_ROOT overrides the
// repo root (tests).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ContentError, HISTORY_LAST_VERSION, readCells, shapeStoryRow } from "./build-lessons.mjs";

const USAGE = "Usage: node scripts/check-added-in.mjs --base <ref>";

/** The commit a ref names in the repository at `root`, or null when it does not resolve. */
export function resolveRef(root, ref) {
  const r = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

/**
 * The quests a content tree ships, by id: `{ stamp, file }` (stamp undefined when none is written).
 * Ready lesson cells only (a draft cell ships nothing); every story file (the catalogue lists each).
 */
export function shippedQuests(root) {
  const out = new Map();
  for (const cell of readCells(root)) {
    if (cell.status !== "ready") continue;
    for (const quest of cell.quests) out.set(quest.id, { stamp: cell.stamps[quest.id], file: cell.file });
  }
  const dir = join(root, "content", "stories");
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      const rel = `content/stories/${name}`;
      let json;
      try {
        json = JSON.parse(readFileSync(join(dir, name), "utf8"));
      } catch (error) {
        throw new ContentError(`invalid JSON: ${error.message}`, rel);
      }
      const row = shapeStoryRow(json, rel);
      out.set(`quest:story-${row.slug}-listen`, { stamp: row.addedIn, file: rel });
    }
  }
  return out;
}

/** The catalogue version of a shipped set: the largest stamp, never below the hand-kept history. */
export function versionOf(quests, legacy = HISTORY_LAST_VERSION) {
  return Math.max(HISTORY_LAST_VERSION, legacy, ...[...quests.values()].flatMap((q) => (q.stamp === undefined ? [] : [q.stamp])));
}

/** Pure: the problems of a branch against its base (empty = the stamps hold the order). */
export function stampProblems(head, base, baseVersion) {
  const problems = [];
  for (const [id, { stamp, file }] of [...head].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (base.has(id)) continue;
    if (stamp === undefined) {
      problems.push({ file, message: `${id} is new on this branch and has no addedIn: give it "addedIn": ${baseVersion} or a later date stamp (YYYYMMDD)` });
    } else if (stamp < baseVersion) {
      problems.push({ file, message: `${id} has addedIn ${stamp}, lower than main's catalogue version ${baseVersion}: set it to ${baseVersion} or later (a one-field edit in this file)` });
    }
  }
  return problems;
}

/** The legacy `CATALOG_VERSION = <n>` literal of a tree's catalog/data.ts (before CM-6), else the history floor. */
function legacyVersion(text) {
  const m = /export const CATALOG_VERSION = (\d+);/.exec(text ?? "");
  return m === null ? HISTORY_LAST_VERSION : Number(m[1]);
}

/** The base tree's content (episodes and stories) and its legacy version, extracted to a temp root. */
function withBaseTree(root, ref, use) {
  const tmp = mkdtempSync(join(tmpdir(), "hr-added-in-"));
  try {
    const listed = spawnSync("git", ["ls-tree", "--name-only", ref, "content/"], { cwd: root, encoding: "utf8" });
    const paths = ["content/episodes", "content/stories"].filter((p) => listed.stdout.split("\n").includes(p));
    if (paths.length > 0) {
      const archive = spawnSync("git", ["archive", "--format=tar", ref, ...paths], { cwd: root, maxBuffer: 1 << 30 });
      if (archive.status !== 0) throw new Error(`git archive ${ref} failed: ${archive.stderr}`);
      const untar = spawnSync("tar", ["-x", "-C", tmp], { input: archive.stdout });
      if (untar.status !== 0) throw new Error(`tar failed: ${untar.stderr}`);
    }
    const data = spawnSync("git", ["show", `${ref}:packages/content-schema/src/catalog/data.ts`], { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
    return use(tmp, legacyVersion(data.status === 0 ? data.stdout : ""));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Runs the check of `root`'s working tree against `ref`; prints the problems and returns the exit code. */
export function checkAddedIn(root, ref) {
  if (resolveRef(root, ref) === null) {
    process.stdout.write(`::error::${ref} does not resolve; fetch it first (git fetch origin main)\n`);
    return 2;
  }
  let head;
  let base;
  let baseVersion;
  try {
    head = shippedQuests(root);
    withBaseTree(root, ref, (tmp, legacy) => {
      base = shippedQuests(tmp);
      baseVersion = versionOf(base, legacy);
    });
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    process.stdout.write(`::error file=${error.file}::${error.message}\n`);
    return 1;
  }
  const problems = stampProblems(head, base, baseVersion);
  for (const p of problems) process.stdout.write(`::error file=${p.file}::${p.message}\n`);
  if (problems.length > 0) return 1;
  const added = [...head.keys()].filter((id) => !base.has(id)).length;
  process.stdout.write(`addedIn stamps hold the order against ${ref} (catalogue version ${baseVersion} there), new quests: ${added}\n`);
  return 0;
}

export function main(argv, root) {
  const at = argv.indexOf("--base");
  const ref = at === -1 ? undefined : argv[at + 1];
  if (ref === undefined || ref.startsWith("--") || argv.length !== 2) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  return checkAddedIn(root, ref);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : join(dirname(fileURLToPath(import.meta.url)), "..");
  process.exitCode = main(process.argv.slice(2), root);
}
