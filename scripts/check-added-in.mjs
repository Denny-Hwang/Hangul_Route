#!/usr/bin/env node
// F-CURR-002 §9.1 (row CM-6) — the `addedIn` stamp check.
//
// From CM-6 on, `CATALOG_VERSION` is generated as the largest `addedIn` stamp of a shipped quest
// (scripts/build-lessons.mjs), so a quest added on a branch must carry a stamp above the version
// `main` already has: a placement result stored at main's version would otherwise skip the new quest
// as one it already knew (the catalogue-growth rule, F-CURR-001 §3.13). A stamp equal to main's
// version fails too: the version would not move, so a result stored between the two deploys would
// miss the new quest. A quest is new when the branch ships it and the base does not:
//
//   - a quest of a ready lesson cell, content/episodes/stage-<n>/<theme>.json (its `addedIn`);
//   - the listen quest of a story file, content/stories/<slug>.json (the story's `addedIn`);
//   - a hand-written quest (Stage 1, the Stage 5 books in catalog/data.ts) listed with its stamp in
//     packages/content-schema/src/catalog/hand-stamps.json, the one place a TypeScript row is stamped.
//
// The base's version is the largest of 32 (the last hand-kept version), the base's own stamps and,
// before CM-6, the `CATALOG_VERSION` literal of its packages/content-schema/src/catalog/data.ts.
// The fix is a one-field edit in the PR's own content file. Four more rules keep the stamps honest:
//
//   - a new quest's stamp is at most FUTURE_DAYS after the first stamp the branch may use (today in
//     UTC, or the day after main's version when that is later), so a typo such as a year ahead cannot
//     raise every later PR's floor, and a run of merges stamped ahead of the calendar still leaves
//     room (HANGUL_ROUTE_TODAY, YYYY-MM-DD, overrides today in tests);
//   - a quest the base already ships keeps the stamp it has there: adding, changing or removing it
//     would rewrite that quest's history after the fact (a quest of the hand-kept history up to 32
//     carries none);
//   - the catalogue version never falls: a branch that stops shipping the quest that holds main's
//     version (a removed story, a ready cell turned back to draft) fails, because a plan or placement
//     stored at the higher version would stop growing;
//   - the base tree is read leniently (cell status, quest ids and stamps, story ids and stamps), so
//     a lesson rule that only this branch enforces cannot fail the check on the base's files.
//
// Usage:
//   node scripts/check-added-in.mjs --base <ref>     e.g. --base origin/main (needs the base's history)
//
// `node scripts/build-lessons.mjs --check` (content-validation.yml, a full-history checkout) runs it
// against origin/main, and scripts/__tests__/stamp-order.test.mjs runs it in the required CI unit job
// (`test:scripts`) against the pull request's base branch, fetched there. Exit 0 when every new quest is stamped above the base's version and every
// shipped quest keeps its stamp, 1 when one does not, 2 on a usage error or a base ref that does not resolve. HANGUL_ROUTE_ROOT overrides the
// repo root (tests).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ContentError, HAND_STAMPS, HISTORY_LAST_VERSION, LESSON_STAGES, readCells, readHandStamps, shapeStoryRow } from "./build-lessons.mjs";

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
  for (const [id, stamp] of Object.entries(readHandStamps(root))) out.set(id, { stamp, file: HAND_STAMPS });
  return out;
}

/**
 * The quests a base tree ships, read leniently: only a cell's `status`, its quests' `id` (or the id
 * its position gives) and `addedIn`, and a story's `id` and `addedIn`, with no lesson rule applied.
 * A file that is not JSON is skipped: the base's own CI ran on it.
 */
export function baseQuests(root) {
  const out = new Map();
  const parse = (file) => {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return undefined;
    }
  };
  const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  for (const n of LESSON_STAGES) {
    const dir = join(root, "content", "episodes", `stage-${n}`);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const rel = `content/episodes/stage-${n}/${name}`;
      const cell = parse(join(dir, name));
      if (!isObject(cell) || cell.status !== "ready" || !Array.isArray(cell.quests)) continue;
      const theme = name.replace(/\.json$/, "");
      cell.quests.forEach((quest, qi) => {
        const id = isObject(quest) && typeof quest.id === "string" ? quest.id : `quest:stage${n}-${theme}-q${qi + 1}`;
        out.set(id, { stamp: isObject(quest) && Number.isInteger(quest.addedIn) ? quest.addedIn : undefined, file: rel });
      });
    }
  }
  const dir = join(root, "content", "stories");
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      const story = parse(join(dir, name));
      const slug = isObject(story) && typeof story.id === "string" ? /^story:([a-z0-9-]+)$/.exec(story.id)?.[1] : undefined;
      if (slug === undefined) continue;
      out.set(`quest:story-${slug}-listen`, { stamp: Number.isInteger(story.addedIn) ? story.addedIn : undefined, file: `content/stories/${name}` });
    }
  }
  const hand = join(root, ...HAND_STAMPS.split("/"));
  const stamps = existsSync(hand) ? parse(hand) : undefined;
  if (isObject(stamps)) {
    for (const [id, stamp] of Object.entries(stamps)) if (Number.isInteger(stamp)) out.set(id, { stamp, file: HAND_STAMPS });
  }
  return out;
}

/** How many days past the first free stamp (suggestedStamp) a new quest's stamp may be: room for a burst of PRs. */
export const FUTURE_DAYS = 14;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A YYYYMMDD stamp -> its UTC date, or null when it is not a calendar date (the history's 9..32). */
function dateOf(stamp) {
  if (!Number.isInteger(stamp) || stamp < 19700101) return null;
  const y = Math.floor(stamp / 10000);
  const m = Math.floor(stamp / 100) % 100;
  const d = stamp % 100;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

const stampOf = (date) => date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
const plusDays = (date, days) => new Date(date.getTime() + days * 86_400_000);

/** Today (UTC) as a stamp; HANGUL_ROUTE_TODAY (YYYY-MM-DD) overrides it. */
export function todayStamp(env = process.env, now = new Date()) {
  const m = ISO_DATE.exec(env.HANGUL_ROUTE_TODAY ?? "");
  const stamp = m === null ? null : Number(`${m[1]}${m[2]}${m[3]}`);
  return stamp !== null && dateOf(stamp) !== null ? stamp : stampOf(now);
}

/** The stamp to suggest for a new quest: today, or the day after the base's version when that is later. */
export function suggestedStamp(baseVersion, today) {
  const base = dateOf(baseVersion);
  if (base === null) return today;
  return Math.max(today, stampOf(plusDays(base, 1)));
}

/**
 * The latest stamp a new quest may carry: FUTURE_DAYS after `first`, the first stamp the branch may use
 * (suggestedStamp). Measured from that stamp, not from today: each stamped merge can move main's version
 * a day ahead of the calendar, and a bound from today would leave no valid stamp after a long burst.
 */
export function latestStamp(first) {
  return stampOf(plusDays(dateOf(first), FUTURE_DAYS));
}

/** The catalogue version of a shipped set: the largest stamp, never below the hand-kept history. */
export function versionOf(quests, legacy = HISTORY_LAST_VERSION) {
  return Math.max(HISTORY_LAST_VERSION, legacy, ...[...quests.values()].flatMap((q) => (q.stamp === undefined ? [] : [q.stamp])));
}

/** Pure: the problems of a branch against its base (empty = the stamps hold the order). */
export function stampProblems(head, base, baseVersion, today = todayStamp()) {
  const problems = [];
  const suggest = suggestedStamp(baseVersion, today);
  const latest = latestStamp(suggest);
  for (const [id, { stamp, file }] of [...head].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (base.has(id)) {
      const was = base.get(id).stamp;
      if (was === stamp) continue;
      const change =
        was === undefined ? `adds addedIn ${stamp}` : stamp === undefined ? `removes its addedIn ${was}` : `changes its addedIn from ${was} to ${stamp}`;
      const keep = was === undefined ? "remove the addedIn field (a quest of the history up to 32 carries none)" : `keep "addedIn": ${was}`;
      problems.push({ file, message: `${id} already ships on main and this branch ${change}: a shipped quest keeps its stamp, so ${keep}` });
    } else if (stamp === undefined) {
      problems.push({ file, message: `${id} is new on this branch and has no addedIn: give it "addedIn": ${suggest} (a date stamp YYYYMMDD above main's catalogue version ${baseVersion})` });
    } else if (stamp <= baseVersion) {
      const relation = stamp === baseVersion ? "equal to" : "lower than";
      problems.push({ file, message: `${id} has addedIn ${stamp}, ${relation} main's catalogue version ${baseVersion}: set it to ${suggest} (a one-field edit in this file)` });
    } else if (stamp > latest) {
      problems.push({
        file,
        message: `${id} has addedIn ${stamp}, more than ${FUTURE_DAYS} days after ${suggest}, the first stamp this branch may use (today ${today}, or the day after main's version): set it to ${suggest}`,
      });
    }
  }
  // The version never falls: a plan or placement stored at main's version would stop growing.
  const headVersion = versionOf(head);
  if (headVersion < baseVersion) {
    const gone = [...base].filter(([id, { stamp }]) => stamp !== undefined && stamp > headVersion && !head.has(id)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const why = `the catalogue version would fall from ${baseVersion} to ${headVersion}, and a plan or placement stored at ${baseVersion} would stop growing`;
    if (gone.length === 0) problems.push({ file: HAND_STAMPS, message: `this branch ships no quest stamped ${baseVersion} or later: ${why}` });
    for (const [id, { stamp, file }] of gone) {
      problems.push({ file, message: `${id} (addedIn ${stamp}) ships on main and not on this branch: ${why}; keep it shipped (a ready cell stays ready, a story file stays)` });
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
    const hand = spawnSync("git", ["show", `${ref}:${HAND_STAMPS}`], { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
    if (hand.status === 0) {
      mkdirSync(join(tmp, ...dirname(HAND_STAMPS).split("/")), { recursive: true });
      writeFileSync(join(tmp, ...HAND_STAMPS.split("/")), hand.stdout);
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
      base = baseQuests(tmp);
      baseVersion = versionOf(base, legacy);
    });
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    process.stdout.write(`::error file=${error.file}::${error.message}\n`);
    return 1;
  }
  const problems = stampProblems(head, base, baseVersion, todayStamp());
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
