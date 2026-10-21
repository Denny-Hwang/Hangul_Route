// Self-tests for scripts/check-added-in.mjs (F-CURR-002 §9.1, row CM-6): a quest added on a branch
// carries an `addedIn` stamp above the base's catalogue version and at most FUTURE_DAYS after today,
// and a quest the base already ships keeps its stamp.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { cell } from "./helpers/lesson-fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "..", "check-added-in.mjs");
const LESSONS = resolve(HERE, "..", "build-lessons.mjs");
const { FUTURE_DAYS, latestStamp, stampProblems, suggestedStamp, todayStamp, versionOf } = await import(SCRIPT);

/** The date every run of the script treats as today (HANGUL_ROUTE_TODAY). */
const TODAY = "2026-11-12";

const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const git = (root, ...args) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
};
function put(root, rel, value) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value, null, 2));
}
/** A git repository whose `main` holds `base` (path -> JSON), checked out on a branch. */
function repo(base) {
  const root = mkdtempSync(join(tmpdir(), "addedin-"));
  roots.push(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "user.name", "test");
  git(root, "config", "commit.gpgsign", "false");
  for (const [rel, value] of Object.entries(base)) put(root, rel, value);
  put(root, "README.md", "base\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  git(root, "checkout", "-q", "-b", "branch");
  return root;
}
const run = (root, args, env = {}) =>
  spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HANGUL_ROUTE_ROOT: root, HANGUL_ROUTE_TODAY: TODAY, ...env }, encoding: "utf8" });
/** Commits the working tree on the current branch. */
const commit = (root, message) => {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
};
const stamped = (stage, theme, stamps) => {
  const c = cell(stage, theme);
  stamps.forEach((stamp, i) => {
    if (stamp !== undefined) c.quests[i].addedIn = stamp;
  });
  return c;
};
const story = (slug, extra = {}) => ({
  id: `story:${slug}`,
  state: "ready",
  title: { ko: "이야기", romanization: "iyagi", en: slug },
  recommendedStage: 2,
  theme: "nature",
  minutes: 5,
  review: { language: "draft", culture: "draft" },
  ...extra,
});

describe("check-added-in.mjs", () => {
  test("passes with no new quest; the base version is 32 without stamps", () => {
    const root = repo({ "content/episodes/stage-3/rites.json": cell("stage3", "rites") });
    const r = run(root, ["--base", "main"]);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /against main \(catalogue version 32 there\), new quests: 0/);
  });

  test("a new cell's quests need a stamp; equal to the base version fails, above it they pass", () => {
    const root = repo({ "content/episodes/stage-3/rites.json": stamped("stage3", "rites", [20261110]) });
    put(root, "content/episodes/stage-3/nature.json", cell("stage3", "nature"));
    const missing = run(root, ["--base", "main"]);
    assert.equal(missing.status, 1);
    assert.match(
      missing.stdout,
      /::error file=content\/episodes\/stage-3\/nature\.json::quest:stage3-nature-q1 is new on this branch and has no addedIn: give it "addedIn": 20261112 \(a date stamp YYYYMMDD above main's catalogue version 20261110\)/,
    );
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20261110, 20261111, 20261112]));
    const equal = run(root, ["--base", "main"]);
    assert.equal(equal.status, 1);
    assert.match(equal.stdout, /quest:stage3-nature-q1 has addedIn 20261110, equal to main's catalogue version 20261110: set it to 20261112/);
    assert.doesNotMatch(equal.stdout, /nature-q[23]/);
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20261111, 20261111, 20261112]));
    const ok = run(root, ["--base", "main"]);
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /against main \(catalogue version 20261110 there\), new quests: 3/);
  });

  test("a stamp lower than main's version fails with the one-field fix", () => {
    const root = repo({ "content/episodes/stage-3/rites.json": stamped("stage3", "rites", [20261110]) });
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20261105, 20261111, 20261111]));
    const r = run(root, ["--base", "main"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /quest:stage3-nature-q1 has addedIn 20261105, lower than main's catalogue version 20261110: set it to 20261112 \(a one-field edit in this file\)/);
    assert.doesNotMatch(r.stdout, /nature-q2/);
  });

  test("two branches that share one stamp: the second fails once it is brought up to date with main", () => {
    const root = repo({ "content/episodes/stage-3/rites.json": stamped("stage3", "rites", [20261110]) });
    git(root, "checkout", "-q", "-b", "second", "main");
    put(root, "content/episodes/stage-3/crafts.json", stamped("stage3", "crafts", [20261111, 20261111, 20261111]));
    commit(root, "second cell");
    assert.equal(run(root, ["--base", "main"]).status, 0, "green against the main it branched from");
    git(root, "checkout", "-q", "branch");
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20261111, 20261111, 20261111]));
    commit(root, "first cell");
    assert.equal(run(root, ["--base", "main"]).status, 0);
    git(root, "checkout", "-q", "main");
    git(root, "merge", "-q", "--ff-only", "branch");
    git(root, "checkout", "-q", "second");
    git(root, "merge", "-q", "--no-edit", "main");
    const updated = run(root, ["--base", "main"]);
    assert.equal(updated.status, 1, updated.stdout);
    assert.match(updated.stdout, /quest:stage3-crafts-q1 has addedIn 20261111, equal to main's catalogue version 20261111: set it to 20261112/);
    assert.doesNotMatch(updated.stdout, /stage3-nature/);
  });

  test(`a stamp more than ${FUTURE_DAYS} days after today fails, so a typo cannot raise every later floor`, () => {
    const root = repo({ "content/episodes/stage-3/rites.json": stamped("stage3", "rites", [20261110]) });
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20271112, 20261126, 20261127]));
    const r = run(root, ["--base", "main"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /quest:stage3-nature-q1 has addedIn 20271112, more than 14 days after today \(20261112\): set it to 20261112/);
    assert.match(r.stdout, /quest:stage3-nature-q3 has addedIn 20261127, more than 14 days/);
    assert.doesNotMatch(r.stdout, /nature-q2/);
  });

  test("a quest main already ships keeps its stamp: adding, changing or removing it fails", () => {
    const root = repo({
      "content/episodes/stage-3/rites.json": stamped("stage3", "rites", [20261110, 20261110]),
      "content/episodes/stage-2/life.json": cell("stage2", "life"),
      "content/stories/owl.json": story("owl"),
    });
    put(root, "content/episodes/stage-3/rites.json", stamped("stage3", "rites", [20261111]));
    put(root, "content/episodes/stage-2/life.json", stamped("stage2", "life", [20261111]));
    put(root, "content/stories/owl.json", story("owl", { addedIn: 20261111 }));
    const r = run(root, ["--base", "main"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /quest:stage3-rites-q1 already ships on main and this branch changes its addedIn from 20261110 to 20261111: a shipped quest keeps its stamp, so keep "addedIn": 20261110/);
    assert.match(r.stdout, /quest:stage3-rites-q2 already ships on main and this branch removes its addedIn 20261110/);
    assert.match(r.stdout, /quest:stage2-life-q1 already ships on main and this branch adds addedIn 20261111: a shipped quest keeps its stamp, so remove the addedIn field/);
    assert.match(r.stdout, /content\/stories\/owl\.json::quest:story-owl-listen already ships on main and this branch adds addedIn 20261111/);
  });

  test("the base is read leniently: a lesson rule only this branch enforces does not fail on main's files", () => {
    const unsigned = stamped("stage3", "rites", [20261110]);
    unsigned.review = { language: "draft", culture: "draft" };
    unsigned.extraField = { anything: true };
    const root = repo({ "content/episodes/stage-3/rites.json": unsigned, "content/stories/bad.json": "{ not json" });
    git(root, "rm", "-q", "content/stories/bad.json");
    put(root, "content/episodes/stage-3/rites.json", stamped("stage3", "rites", [20261110]));
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20261111, 20261111, 20261111]));
    const r = run(root, ["--base", "main"]);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /against main \(catalogue version 20261110 there\), new quests: 3/);
  });

  test("a new story's listen quest counts, and a cell that turns ready on the branch counts as new", () => {
    const root = repo({ "content/episodes/stage-3/rites.json": cell("stage3", "rites", "draft"), "content/stories/owl.json": story("owl") });
    put(root, "content/stories/fox.json", story("fox"));
    put(root, "content/episodes/stage-3/rites.json", cell("stage3", "rites"));
    const r = run(root, ["--base", "main"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /content\/stories\/fox\.json::quest:story-fox-listen is new/);
    assert.match(r.stdout, /quest:stage3-rites-q1 is new/);
    assert.doesNotMatch(r.stdout, /story-owl/);
  });

  test("before CM-6 the base's version is its CATALOG_VERSION literal", () => {
    const root = repo({ "packages/content-schema/src/catalog/data.ts": "export const CATALOG_VERSION = 20261120;\n" });
    put(root, "content/episodes/stage-3/rites.json", stamped("stage3", "rites", [20261119, 20261120, 20261121]));
    const r = run(root, ["--base", "main"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /quest:stage3-rites-q1 has addedIn 20261119, lower than main's catalogue version 20261120: set it to 20261121/);
    assert.match(r.stdout, /quest:stage3-rites-q2 has addedIn 20261120, equal to main's catalogue version 20261120/);
    assert.doesNotMatch(r.stdout, /rites-q3/);
  });

  test("build-lessons.mjs --check runs it against HANGUL_ROUTE_STAMP_BASE", () => {
    const root = repo({ "content/episodes/stage-3/rites.json": stamped("stage3", "rites", [20261110]) });
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20261101]));
    const env = { ...process.env, HANGUL_ROUTE_ROOT: root, HANGUL_ROUTE_STAMP_BASE: "main", HANGUL_ROUTE_TODAY: TODAY };
    assert.equal(spawnSync("node", [LESSONS], { env, encoding: "utf8" }).status, 0);
    const r = spawnSync("node", [LESSONS, "--check"], { env, encoding: "utf8" });
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /lesson modules and catalogue are deterministic/);
    assert.match(r.stdout, /has addedIn 20261101, lower than main's catalogue version 20261110/);
  });

  test("usage errors and a base that does not resolve exit 2; a broken file exits 1", () => {
    const root = repo({});
    assert.equal(run(root, []).status, 2);
    assert.equal(run(root, ["--base"]).status, 2);
    assert.equal(run(root, ["--base", "--x"]).status, 2);
    const unknown = run(root, ["--base", "no-such-ref"]);
    assert.equal(unknown.status, 2);
    assert.match(unknown.stdout, /no-such-ref does not resolve/);
    put(root, "content/stories/bad.json", "{ not json");
    const broken = run(root, ["--base", "main"]);
    assert.equal(broken.status, 1);
    assert.match(broken.stdout, /::error file=content\/stories\/bad\.json::invalid JSON/);
  });

  test("pure: stampProblems and versionOf", () => {
    const head = new Map([
      ["quest:a", { stamp: undefined, file: "a.json" }],
      ["quest:b", { stamp: 20261101, file: "b.json" }],
      ["quest:c", { stamp: 20261201, file: "c.json" }],
    ]);
    const base = new Map([["quest:a", { stamp: undefined, file: "a.json" }]]);
    assert.deepEqual(
      stampProblems(head, base, 20261110, 20261125).map((p) => p.file),
      ["b.json"],
    );
    assert.deepEqual(
      stampProblems(head, base, 20261110, 20261101).map((p) => p.file),
      ["b.json", "c.json"],
      "20261201 is more than 14 days after 20261101",
    );
    assert.equal(suggestedStamp(32, 20261112), 20261112);
    assert.equal(suggestedStamp(20261110, 20261112), 20261112);
    assert.equal(suggestedStamp(20261112, 20261112), 20261113);
    assert.equal(suggestedStamp(20261130, 20261112), 20261201);
    assert.equal(suggestedStamp(20261231, 20261112), 20270101);
    assert.equal(latestStamp(20261225), 20270108);
    assert.equal(todayStamp({ HANGUL_ROUTE_TODAY: "2026-11-05" }), 20261105);
    assert.equal(todayStamp({ HANGUL_ROUTE_TODAY: "2026-02-30" }, new Date(Date.UTC(2026, 9, 21))), 20261021);
    assert.equal(todayStamp({}, new Date(Date.UTC(2026, 9, 21, 23, 59))), 20261021);
    assert.equal(versionOf(base), 32);
    assert.equal(versionOf(head), 20261201);
    assert.equal(versionOf(new Map(), 40), 40);
  });
});
