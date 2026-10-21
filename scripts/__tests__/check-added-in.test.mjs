// Self-tests for scripts/check-added-in.mjs (F-CURR-002 §9.1, row CM-6): a quest added on a branch
// carries an `addedIn` stamp that is not lower than the base's catalogue version.

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
const { stampProblems, versionOf } = await import(SCRIPT);

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
const run = (root, args, env = {}) => spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HANGUL_ROUTE_ROOT: root, ...env }, encoding: "utf8" });
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

  test("a new cell's quests need a stamp; at or above the base version they pass", () => {
    const root = repo({ "content/episodes/stage-3/rites.json": stamped("stage3", "rites", [20261110]) });
    put(root, "content/episodes/stage-3/nature.json", cell("stage3", "nature"));
    const missing = run(root, ["--base", "main"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /::error file=content\/episodes\/stage-3\/nature\.json::quest:stage3-nature-q1 is new on this branch and has no addedIn: give it "addedIn": 20261110/);
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20261110, 20261111, 20261231]));
    const ok = run(root, ["--base", "main"]);
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /against main \(catalogue version 20261110 there\), new quests: 3/);
  });

  test("a stamp lower than main's version fails with the one-field fix", () => {
    const root = repo({ "content/episodes/stage-3/rites.json": stamped("stage3", "rites", [20261110]) });
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20261105, 20261110, 20261110]));
    const r = run(root, ["--base", "main"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /quest:stage3-nature-q1 has addedIn 20261105, lower than main's catalogue version 20261110: set it to 20261110 or later/);
    assert.doesNotMatch(r.stdout, /nature-q2/);
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
    assert.match(r.stdout, /quest:stage3-rites-q1 has addedIn 20261119, lower than main's catalogue version 20261120/);
  });

  test("build-lessons.mjs --check runs it against HANGUL_ROUTE_STAMP_BASE", () => {
    const root = repo({ "content/episodes/stage-3/rites.json": stamped("stage3", "rites", [20261110]) });
    put(root, "content/episodes/stage-3/nature.json", stamped("stage3", "nature", [20261101]));
    const env = { ...process.env, HANGUL_ROUTE_ROOT: root, HANGUL_ROUTE_STAMP_BASE: "main" };
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
      stampProblems(head, base, 20261110).map((p) => p.file),
      ["b.json"],
    );
    assert.equal(versionOf(base), 32);
    assert.equal(versionOf(head), 20261201);
    assert.equal(versionOf(new Map(), 40), 40);
  });
});
