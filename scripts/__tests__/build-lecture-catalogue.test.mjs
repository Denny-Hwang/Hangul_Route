// Self-tests for scripts/build-lecture-catalogue.mjs (F-TCH-004 PR 10).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "build-lecture-catalogue.mjs");
const OUT_REL = join("apps", "web", "src", "data", "lecture-catalogue.generated.ts");

const { GENERATED_HEADER, buildCatalogue, isListedStory, renderCatalogue } = await import(SCRIPT);

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "lecturecat-"));
  roots.push(root);
  return root;
}
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function run(root, args = []) {
  return spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HANGUL_ROUTE_ROOT: root }, encoding: "utf8" });
}

function put(root, rel, value) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

const story = (slug, titleEn, extra = {}) => ({
  id: `story:${slug}`,
  state: "ready",
  title: { ko: "해와 달", romanization: "haewa dal", en: titleEn },
  minutes: 5,
  review: { language: "native-reviewed", culture: "culture-reviewed" },
  ...extra,
});
const topic = (key, order, status = "ready", words = 3) => ({
  topic: { id: `vocab-topic:${key}`, key, order, titleEn: key[0].toUpperCase() + key.slice(1), status },
  items: Array.from({ length: words }, (_, i) => ({ id: `vocab:${key}-${i}` })),
});

function seed(root) {
  put(root, "content/stories/b.json", story("sun-moon", "The Sun and the Moon"));
  put(root, "content/stories/a.json", story("hangeul-day", "Happy Hangul Day!"));
  put(root, "content/stories/c.json", story("draft-one", "A Draft", { review: { language: "draft", culture: "draft" } }));
  put(root, "content/vocab/food.json", topic("food", 2));
  put(root, "content/vocab/animals.json", topic("animals", 1, "shipped", 12));
  put(root, "content/vocab/colors.json", topic("colors", 3, "draft"));
  put(root, "content/vocab/_senses.json", { groups: [] });
}

describe("lecture catalogue shaping (F-TCH-004 §3.11)", () => {
  test("lists only stories the Library would list: ready, language- and culture-reviewed", () => {
    assert.equal(isListedStory(story("a", "A")), true);
    assert.equal(isListedStory(story("a", "A", { state: "draft" })), false);
    assert.equal(isListedStory(story("a", "A", { review: { language: "native-reviewed", culture: "draft" } })), false);
    assert.equal(isListedStory(story("a", "A", { review: { language: "draft", culture: "culture-reviewed" } })), false);
    assert.equal(isListedStory(story("a", "A", { review: undefined })), false);
  });

  test("ids and titles only: stories by title, topics by order, draft topics left out", () => {
    const model = buildCatalogue({
      stories: [
        { name: "b.json", json: story("sun-moon", "The Sun and the Moon") },
        { name: "a.json", json: story("hangeul-day", "Happy Hangul Day!") },
        { name: "c.json", json: story("draft-one", "A Draft", { state: "draft" }) },
      ],
      topicFiles: [
        { name: "food.json", json: topic("food", 2) },
        { name: "animals.json", json: topic("animals", 1, "shipped", 12) },
        { name: "colors.json", json: topic("colors", 3, "preview") },
      ],
    });
    assert.deepEqual(model, {
      stories: [
        { id: "story:hangeul-day", titleEn: "Happy Hangul Day!", minutes: 5 },
        { id: "story:sun-moon", titleEn: "The Sun and the Moon", minutes: 5 },
      ],
      topics: [
        { id: "vocab-topic:animals", titleEn: "Animals", words: 12 },
        { id: "vocab-topic:food", titleEn: "Food", words: 3 },
      ],
    });
  });

  test("fails on a file it cannot shape", () => {
    assert.throws(() => buildCatalogue({ stories: [{ name: "x.json", json: [] }], topicFiles: [] }), /x.json: a story file/);
    assert.throws(() => buildCatalogue({ stories: [{ name: "x.json", json: { id: "story:x", title: {}, minutes: 5 } }], topicFiles: [] }), /title: en/);
    assert.throws(() => buildCatalogue({ stories: [{ name: "x.json", json: story("x", "X", { minutes: "5" }) }], topicFiles: [] }), /minutes must be an integer/);
    assert.throws(() => buildCatalogue({ stories: [], topicFiles: [{ name: "t.json", json: { items: [] } }] }), /t.json: a topic file/);
    assert.throws(() => buildCatalogue({ stories: [], topicFiles: [{ name: "t.json", json: { topic: {}, items: 3 } }] }), /items must be an array/);
    assert.throws(() => buildCatalogue({ stories: [], topicFiles: [{ name: "t.json", json: { topic: { id: "vocab-topic:t", titleEn: "T", order: 1 }, items: [] } }] }), /status/);
  });

  test("renders a typed module with the generated header", () => {
    const source = renderCatalogue({ stories: [], topics: [{ id: "vocab-topic:food", titleEn: "Food", words: 3 }] });
    assert.ok(source.startsWith(GENERATED_HEADER));
    assert.match(source, /export const LECTURE_STORIES: readonly LectureCatalogueStory\[\] = \[\];/);
    assert.match(source, /"id": "vocab-topic:food"/);
  });
});

describe("lecture catalogue CLI", () => {
  test("writes the module, then --check passes; a content change makes --check fail", () => {
    const root = makeRoot();
    seed(root);
    const write = run(root);
    assert.equal(write.status, 0, write.stdout + write.stderr);
    assert.match(write.stdout, /2 stories, 2 vocabulary topics/);
    const source = readFileSync(join(root, OUT_REL), "utf8");
    assert.match(source, /story:hangeul-day/);
    assert.doesNotMatch(source, /draft-one|vocab-topic:colors/);
    assert.equal(run(root, ["--check"]).status, 0);

    put(root, "content/vocab/food.json", topic("food", 2, "ready", 4));
    const stale = run(root, ["--check"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /out of date/);
  });

  test("--check fails when the module is missing; bad JSON and unknown flags fail", () => {
    const root = makeRoot();
    seed(root);
    const missing = run(root, ["--check"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /missing/);
    assert.equal(existsSync(join(root, OUT_REL)), false);

    put(root, "content/stories/z.json", "{ not json");
    const bad = run(root);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /content\/stories\/z.json: not valid JSON/);

    assert.equal(run(root, ["--nope"]).status, 2);
  });

  test("an empty repo writes empty lists", () => {
    const root = makeRoot();
    const write = run(root);
    assert.equal(write.status, 0);
    assert.match(write.stdout, /0 stories, 0 vocabulary topics/);
  });

  test("the checked-in module is up to date with the repo content", () => {
    const check = spawnSync("node", [SCRIPT, "--check"], { encoding: "utf8", env: { ...process.env, HANGUL_ROUTE_ROOT: REPO } });
    assert.equal(check.status, 0, check.stdout);
  });
});
