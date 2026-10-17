// Self-tests for scripts/build-lecture-catalogue.mjs (F-TCH-004 PR 10; the title maps:
// AMENDMENTS-LECTURE-V2 row LV-3, owner report 2026-10-16).

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
const TITLES_OUT_REL = join("apps", "web", "src", "data", "catalogue-titles.generated.ts");

const { GENERATED_HEADER, STORIES_IN_LECTURE, TITLES_HEADER, TITLE_ID_RE, buildCatalogue, buildTitles, isListedStory, renderCatalogue, renderTitles } = await import(SCRIPT);

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
  put(root, "content/i18n/ko/episodes.json", overlay("ko", { "episode:stage1-letters": { title: "글자 만나기", subtitle: "x" }, "episode:shelf-hangeul-day": { title: "책장" } }));
  put(root, "content/i18n/es/stories.json", overlay("es", { "story:hangeul-day": { title: "¡Feliz Día del Hangul!" }, "card:story-hangeul-day": { title: "Una tarjeta" } }));
}

const overlay = (locale, entries) => ({ locale, domain: "test", entries });

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
      storiesInLecture: true,
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

  test("stories are listed now the presenter has its story adapter (F-TCH-004 PR 11 flipped the gate)", () => {
    assert.equal(STORIES_IN_LECTURE, true);
    const model = buildCatalogue({
      stories: [
        { name: "b.json", json: story("sun-moon", "The Sun and the Moon") },
        { name: "c.json", json: story("draft-one", "A Draft", { review: { language: "draft", culture: "draft" } }) },
      ],
      topicFiles: [{ name: "food.json", json: topic("food", 2) }],
    });
    assert.deepEqual(model.stories, [{ id: "story:sun-moon", titleEn: "The Sun and the Moon", minutes: 5 }]);
    assert.deepEqual(model.topics, [{ id: "vocab-topic:food", titleEn: "Food", words: 3 }]);
  });

  test("with the gate off, stories stay out but story files are still shaped", () => {
    const model = buildCatalogue({
      stories: [{ name: "b.json", json: story("sun-moon", "The Sun and the Moon") }],
      topicFiles: [],
      storiesInLecture: false,
    });
    assert.deepEqual(model.stories, []);
    assert.throws(
      () => buildCatalogue({ stories: [{ name: "x.json", json: [] }], topicFiles: [], storiesInLecture: false }),
      /x.json: a story file/,
    );
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

describe("catalogue titles (LV-3: the console's titles in the UI language)", () => {
  test("keeps the title of grid episodes, quests, stories and word topics, per locale and sorted by id", () => {
    const titles = buildTitles({
      overlayFiles: [
        { locale: "ko", name: "ko/b.json", json: overlay("ko", { "quest:stage2-life-q1": { title: "도시락", blurb: "x" }, "episode:stage2-life": { title: "도시락 낱말" } }) },
        { locale: "ko", name: "ko/a.json", json: overlay("ko", { "vocab-topic:food": { title: "음식" }, "story:hangeul-day": { title: "즐거운 한글날!", summary: "x" } }) },
        { locale: "es", name: "es/a.json", json: overlay("es", { "quest:stage2-life-q1": { title: "La lonchera" } }) },
      ],
    });
    assert.deepEqual(titles, {
      es: { "quest:stage2-life-q1": "La lonchera" },
      ko: { "episode:stage2-life": "도시락 낱말", "quest:stage2-life-q1": "도시락", "story:hangeul-day": "즐거운 한글날!", "vocab-topic:food": "음식" },
    });
    assert.deepEqual(Object.keys(titles.ko), Object.keys(titles.ko).sort());
  });

  test("leaves out other ids (cards, jamo, shelf episodes, vocab words) and entries without a title", () => {
    const titles = buildTitles({
      overlayFiles: [
        {
          locale: "ko",
          name: "ko/x.json",
          json: overlay("ko", {
            "card:story-x": { title: "카드" },
            "jamo:g": { title: "기역" },
            "episode:shelf-x": { title: "책장" },
            "vocab:horangi": { gloss: "호랑이" },
            "quest:stage1-life-q1": { blurb: "제목 없음" },
          }),
        },
      ],
    });
    assert.deepEqual(titles, { ko: {} });
    for (const id of ["episode:stage1-letters", "quest:story-hangeul-day-listen", "story:hangeul-day", "vocab-topic:k-culture"]) assert.ok(TITLE_ID_RE.test(id), id);
    for (const id of ["episode:shelf-hangeul-day", "card:x", "topic:food", "quest:", "story:Bad"]) assert.ok(!TITLE_ID_RE.test(id), id);
  });

  test("fails on an overlay file it cannot read, a blank title and two different titles for one id", () => {
    assert.throws(() => buildTitles({ overlayFiles: [{ locale: "ko", name: "ko/x.json", json: [] }] }), /ko\/x.json: an overlay file needs an entries object/);
    assert.throws(() => buildTitles({ overlayFiles: [{ locale: "ko", name: "ko/x.json", json: { entries: [] } }] }), /entries object/);
    assert.throws(() => buildTitles({ overlayFiles: [{ locale: "ko", name: "ko/x.json", json: overlay("ko", { "quest:a": { title: "  " } }) }] }), /quest:a: title must be a non-empty string/);
    assert.throws(() => buildTitles({ overlayFiles: [{ locale: "ko", name: "ko/x.json", json: overlay("ko", { "quest:a": { title: 3 } }) }] }), /non-empty string/);
    const twice = [
      { locale: "ko", name: "ko/x.json", json: overlay("ko", { "quest:a": { title: "가" } }) },
      { locale: "ko", name: "ko/y.json", json: overlay("ko", { "quest:a": { title: "나" } }) },
    ];
    assert.throws(() => buildTitles({ overlayFiles: twice }), /ko\/y.json: quest:a: a second, different title in ko/);
    const same = [twice[0], { ...twice[1], json: overlay("ko", { "quest:a": { title: "가" } }) }];
    assert.deepEqual(buildTitles({ overlayFiles: same }), { ko: { "quest:a": "가" } });
  });

  test("renders a typed module with its generated header", () => {
    const source = renderTitles({ ko: { "quest:a": "가" } });
    assert.ok(source.startsWith(TITLES_HEADER));
    assert.match(source, /export const CATALOGUE_TITLES: Readonly<Record<string, Readonly<Record<string, string>>>> = \{/);
    assert.match(source, /"quest:a": "가"/);
  });

  test("the checked-in titles hold every catalogue id the console draws, in es and ko", () => {
    const source = readFileSync(join(REPO, TITLES_OUT_REL), "utf8");
    for (const id of ['"episode:stage7-crafts"', '"quest:stage1-letters-q1"', '"quest:story-hangeul-day-listen"', '"story:hangeul-day"', '"vocab-topic:science"']) {
      assert.equal(source.split(id).length - 1, 2, `${id} once per locale`);
    }
  });
});

describe("lecture catalogue CLI", () => {
  test("writes the module, then --check passes; a content change makes --check fail", () => {
    const root = makeRoot();
    seed(root);
    const write = run(root);
    assert.equal(write.status, 0, write.stdout + write.stderr);
    assert.match(write.stdout, /2 stories, 2 vocabulary topics, titles: es 1, ko 1/);
    const source = readFileSync(join(root, OUT_REL), "utf8");
    const titles = readFileSync(join(root, TITLES_OUT_REL), "utf8");
    assert.match(titles, /"episode:stage1-letters": "글자 만나기"/);
    assert.match(titles, /"story:hangeul-day": "¡Feliz Día del Hangul!"/);
    assert.doesNotMatch(titles, /shelf|card:/);
    assert.match(source, /"id": "story:hangeul-day"/);
    assert.match(source, /"id": "story:sun-moon"/);
    assert.doesNotMatch(source, /draft-one|vocab-topic:colors/);
    assert.equal(run(root, ["--check"]).status, 0);

    put(root, "content/vocab/food.json", topic("food", 2, "ready", 4));
    const stale = run(root, ["--check"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /lecture catalogue is out of date/);
  });

  test("a changed overlay title makes --check fail on the titles module only", () => {
    const root = makeRoot();
    seed(root);
    assert.equal(run(root).status, 0);
    put(root, "content/i18n/ko/episodes.json", overlay("ko", { "episode:stage1-letters": { title: "글자를 만나요" } }));
    const stale = run(root, ["--check"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /catalogue-titles.generated.ts::catalogue titles is out of date with content\/i18n/);
    assert.doesNotMatch(stale.stdout, /lecture-catalogue.generated.ts/);
    assert.equal(run(root).status, 0);
    assert.equal(run(root, ["--check"]).status, 0);
  });

  test("a broken overlay file fails the build", () => {
    const root = makeRoot();
    seed(root);
    put(root, "content/i18n/es/bad.json", { locale: "es" });
    const bad = run(root);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /content\/i18n\/es\/bad.json: an overlay file needs an entries object/);
  });

  test("--check fails when the module is missing; bad JSON and unknown flags fail", () => {
    const root = makeRoot();
    seed(root);
    const missing = run(root, ["--check"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /lecture catalogue is missing/);
    assert.match(missing.stdout, /catalogue titles is missing/);
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
    assert.match(write.stdout, /0 stories, 0 vocabulary topics, titles: none/);
  });

  test("the checked-in module is up to date with the repo content", () => {
    const check = spawnSync("node", [SCRIPT, "--check"], { encoding: "utf8", env: { ...process.env, HANGUL_ROUTE_ROOT: REPO } });
    assert.equal(check.status, 0, check.stdout);
  });
});
