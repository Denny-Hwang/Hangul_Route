// Self-tests for scripts/art-demand.mjs (F-STORY-002 §3.9.8 step 1, PR 2.10a).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "art-demand.mjs");
const LEXICON = join(REPO, "scripts", "art-lexicon.json");

const { demandReport, loadLexicon, matchBrief, readScenes, registryIds, renderReport, wordsOf } = await import(SCRIPT);

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "artdemand-"));
  roots.push(root);
  return root;
}
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function story(id, scenes) {
  return { v: 1, id: `story:${id}`, state: "draft", tiers: [{ level: "listen", scenes }] };
}

/** A tiny repo: one story folder, a lexicon and a registry with two ids. */
function fixtureRoot() {
  const root = makeRoot();
  const stories = join(root, "content", "stories");
  mkdirSync(join(stories, "research"), { recursive: true });
  writeFileSync(join(stories, "research", "skip.json"), "{}");
  writeFileSync(
    join(stories, "a-tale.json"),
    JSON.stringify(
      story("a-tale", [
        { id: "s1", narrationEn: "x", artBrief: "Hoya in a palace hall beside a stack of books." },
        { id: "s2", narrationEn: "x", artBrief: "A brown horse grazing by a pine tree.", art: { setting: "scene:palace-hall", layers: [], altEn: "x" } },
        { id: "s3", narrationEn: "x", artPending: true },
      ])
    )
  );
  const art = join(root, "packages", "design-system", "src", "scene-art");
  mkdirSync(join(art, "props"), { recursive: true });
  writeFileSync(join(art, "hoya.ts"), "export const HOYA_POSES = ['idle', 'cheering', 'thinking', 'reading', 'waving'] as const;\n");
  writeFileSync(join(art, "props", "books.ts"), "export const X = { id: 'prop:books-stack', kind: 'object' };\n");
  writeFileSync(join(art, "settings.ts"), "export const Y = { id: 'scene:palace-hall', kind: 'setting' };\n");
  const lexicon = {
    entries: [
      { match: ["palace hall", "throne"], ids: ["scene:palace-hall"] },
      { match: ["stack of books"], ids: ["prop:books-stack"] },
      { match: ["horse"], ids: ["prop:horse"] },
      { match: ["pine tree", "pine"], ids: ["prop:pine-tree"] },
      { match: ["hoya", "tiger cub"], ids: ["hoya:*"] },
    ],
  };
  writeFileSync(join(root, "lexicon.json"), JSON.stringify(lexicon));
  return root;
}

function run(root, args = []) {
  return spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HANGUL_ROUTE_ROOT: root }, encoding: "utf8" });
}

describe("matchBrief", () => {
  const lex = { entries: [{ match: ["palace hall"], ids: ["scene:palace-hall"] }, { match: ["book", "books"], ids: ["prop:book-thread-bound"] }, { match: ["hoya"], ids: ["hoya:*"] }] };
  test("matches whole words and phrases, case-insensitively, once per id", () => {
    const m = matchBrief("Hoya opens a BOOK in the Palace Hall; more books nearby.", lex);
    assert.deepEqual(m.settings, ["scene:palace-hall"]);
    assert.deepEqual(m.props, ["prop:book-thread-bound"]);
    assert.equal(m.hoya, true);
  });
  test("does not match inside other words", () => {
    const m = matchBrief("A bookcase and a hallway.", lex);
    assert.deepEqual(m.props, []);
    assert.deepEqual(m.settings, []);
    assert.equal(m.hoya, false);
  });
  test("an empty brief matches nothing", () => {
    assert.deepEqual(matchBrief("", lex), { settings: [], props: [], hoya: false, matched: [] });
  });
  test("records every alias of an entry that the brief uses, not only the first", () => {
    const books = { entries: [{ match: ["thread-bound", "books", "book"], ids: ["prop:book-thread-bound"] }] };
    const brief = "A row of old thread-bound books in a wooden case, a young tiger watching";
    const m = matchBrief(brief, books);
    assert.deepEqual(m.matched, ["thread-bound", "books"]);
    const words = wordsOf(brief, m.matched);
    assert.equal(words.includes("books"), false, words.join(","));
    assert.equal(words.includes("thread-bound"), false, words.join(","));
  });
});

describe("wordsOf", () => {
  test("drops stop words, short words and words the matches covered", () => {
    assert.deepEqual(wordsOf("A brown horse grazing by the old pine tree", ["horse", "pine tree"]), ["brown", "grazing"]);
  });
});

describe("registryIds", () => {
  test("collects quoted scene:/prop: ids from the scene-art sources and the Hoya poses", () => {
    const ids = registryIds(fixtureRoot());
    assert.ok(ids.has("prop:books-stack"));
    assert.ok(ids.has("scene:palace-hall"));
    assert.ok(ids.has("hoya:idle") && ids.has("hoya:waving"));
    assert.equal(ids.has("prop:horse"), false);
  });
  test("the real registry has the 2.3b batch", () => {
    const ids = registryIds(REPO);
    for (const id of ["scene:palace-hall", "prop:fig-king", "prop:writing-set", "hoya:reading"]) assert.ok(ids.has(id), id);
  });
});

describe("loadLexicon", () => {
  test("a lexicon without an entries array is rejected", () => {
    const root = makeRoot();
    const path = join(root, "bad.json");
    writeFileSync(path, JSON.stringify({ entries: { match: ["x"] } }));
    assert.throws(() => loadLexicon(path), /"entries" must be an array/);
  });
});

describe("readScenes", () => {
  test("reads top-level story files only, in file order, with art state", () => {
    const scenes = readScenes(join(fixtureRoot(), "content", "stories"));
    assert.deepEqual(
      scenes.map((s) => [s.file, s.sceneId, s.status]),
      [
        ["a-tale.json", "s1", "none"],
        ["a-tale.json", "s2", "art"],
        ["a-tale.json", "s3", "pending"],
      ]
    );
  });
});

describe("demandReport", () => {
  test("lists per scene what it wants and the missing ids by frequency", () => {
    const root = fixtureRoot();
    const report = demandReport(readScenes(join(root, "content", "stories")), loadLexicon(join(root, "lexicon.json")), registryIds(root));
    assert.equal(report.scenes.length, 3);
    assert.deepEqual(report.scenes[0].wants, { settings: ["scene:palace-hall"], props: ["prop:books-stack"], hoya: true });
    assert.deepEqual(report.missing, [
      { id: "prop:horse", count: 1 },
      { id: "prop:pine-tree", count: 1 },
    ]);
    assert.deepEqual(report.counts, { scenes: 3, withArt: 1, pending: 1, noBrief: 1, withHoya: 1 });
    assert.ok(report.unmatched.some((u) => u.word === "brown" && u.count === 1));
  });
  test("the report prints each scene and the missing list", () => {
    const root = fixtureRoot();
    const text = renderReport(demandReport(readScenes(join(root, "content", "stories")), loadLexicon(join(root, "lexicon.json")), registryIds(root)));
    assert.match(text, /a-tale\.json s1 \[none\] setting: scene:palace-hall/);
    assert.match(text, /hoya/);
    assert.match(text, /Missing items by frequency/);
    assert.match(text, /1 {2}prop:horse/);
  });
  test("the report says none when the registry has every candidate id", () => {
    const report = demandReport(
      [{ file: "a.json", storyId: "story:a", level: "listen", sceneId: "s1", brief: "", status: "none" }],
      { entries: [] },
      new Set()
    );
    const text = renderReport(report);
    assert.match(text, /Missing items by frequency[^\n]*:\n {2}none\n/);
    assert.match(text, /no lexicon entry covers[^\n]*:\n {2}none\n/);
  });
});

describe("the shipped lexicon", () => {
  const lexicon = loadLexicon(LEXICON);
  test("every entry has match words and well-formed ids", () => {
    assert.ok(lexicon.entries.length >= 40);
    for (const e of lexicon.entries) {
      assert.ok(e.match.length > 0);
      for (const w of e.match) assert.equal(w, w.toLowerCase());
      for (const id of e.ids) assert.match(id, /^(scene|prop):[a-z]+(-[a-z]+)*$|^hoya:\*$/);
    }
  });
  // later clusters may name ids before their batch exists; a built cluster's must exist
  for (const name of ["records-joseon", "hangul-printing", "science-art-life", "seasons-tales"]) {
    test(`every id the lexicon names for the ${name} cluster is in the registry`, () => {
      const ids = registryIds(REPO);
      const cluster = JSON.parse(readFileSync(LEXICON, "utf8")).clusters[name];
      assert.ok(Array.isArray(cluster) && cluster.length > 0, name);
      assert.deepEqual(cluster.filter((id) => !ids.has(id)), []);
    });
  }
});

describe("cli", () => {
  test("prints the report for --src and exits 0", () => {
    const root = fixtureRoot();
    const r = run(root, ["--src", "content/stories", "--lexicon", "lexicon.json"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Scenes: 3/);
  });
  test("--json prints the report object", () => {
    const root = fixtureRoot();
    const r = run(root, ["--json", "--lexicon", "lexicon.json"]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).counts.scenes, 3);
  });
  test("an unknown flag is a usage error", () => {
    const r = run(fixtureRoot(), ["--nope"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Usage/);
  });
  test("a missing path argument is a usage error", () => {
    assert.equal(run(fixtureRoot(), ["--src"]).status, 2);
  });
  test("runs on the real repository", () => {
    const r = spawnSync("node", [SCRIPT], { encoding: "utf8", cwd: REPO });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Scenes: \d+/);
  });
  test("--json on the real repository writes the whole report through a pipe (over 64 KB)", () => {
    const r = spawnSync("node", [SCRIPT, "--json"], { encoding: "utf8", cwd: REPO, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.length > 64 * 1024, `only ${r.stdout.length} bytes`);
    const report = JSON.parse(r.stdout);
    assert.equal(report.scenes.length, report.counts.scenes);
  });
});
