// Self-tests for scripts/build-vocab.mjs (F-VOC-001 PR V-2a).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "build-vocab.mjs");

const MOBILE_REL = join("apps", "mobile", "src", "content", "__generated__", "vocab.ts");
const WEB_REL = join("apps", "web", "src", "data", "vocab-catalog.ts");

const { GENERATED_HEADER, buildVocab, renderMobile, renderWeb, vocabAudioRef } = await import(SCRIPT);

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "buildvocab-"));
  roots.push(root);
  return root;
}
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function run(root, args = []) {
  return spawnSync("node", [SCRIPT, ...args], {
    env: { ...process.env, HANGUL_ROUTE_ROOT: root },
    encoding: "utf8",
  });
}

function put(root, rel, value) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

const item = (id, ko, romanization, en, extra = {}) => ({
  id,
  ko,
  romanization,
  en,
  topics: ["food"],
  level: 1,
  visual: "card:sagwa",
  ...extra,
});

function topicFile(key, order, items, extra = {}) {
  return {
    schemaVersion: 1,
    topic: {
      id: `vocab-topic:${key}`,
      key,
      order,
      titleEn: key,
      titleKo: { ko: "음식", romanization: "eumsik", en: "food" },
      blurbEn: "Words for a test.",
      hoyaIntroEn: "Hello.",
      tint: "theme.life",
      coverItemId: items[0].id,
      status: "draft",
      ...extra,
    },
    items,
  };
}

const FOOD = () =>
  topicFile("food", 1, [
    item("vocab:sagwa", "사과", "sagwa", "apple"),
    item("vocab:bae-pear", "배", "bae", "pear", { senseGroup: "bae", senseNote: "Also a boat." }),
  ]);
const ANIMALS = () =>
  topicFile(
    "animals",
    2,
    [
      item("vocab:horangi", "호랑이", "horangi", "tiger", { topics: ["animals"], visual: "word:tiger", level: 2, pos: "noun" }),
      item("vocab:bae-boat", "배", "bae", "boat", { topics: ["animals"], senseGroup: "bae" }),
    ],
    { fixedOrder: true }
  );
const SENSES = () => ({
  schemaVersion: 1,
  groups: [
    {
      group: "bae",
      members: [
        { id: "vocab:bae-pear", en: "pear", state: "launch" },
        { id: "vocab:bae-boat", en: "boat", state: "launch" },
      ],
    },
  ],
});
const overlay = (locale, topic, entries) => ({ locale, domain: `vocab-${topic}`, entries });

function seed(root) {
  put(root, "content/vocab/food.json", FOOD());
  put(root, "content/vocab/animals.json", ANIMALS());
  put(root, "content/vocab/_senses.json", SENSES());
}
const mobileOf = (root) => readFileSync(join(root, MOBILE_REL), "utf8");
const webOf = (root) => readFileSync(join(root, WEB_REL), "utf8");

/** Evaluate one `export const NAME: <type> = <json>;` literal of a generated file. */
function grab(source, name) {
  const m = source.match(new RegExp(`export const ${name}: [^=]+ = ([\\s\\S]*?);\\n(?:\\n|$)`));
  assert.ok(m, `export ${name} not found in:\n${source.slice(0, 400)}`);
  return JSON.parse(m[1]);
}

describe("build-vocab.mjs: empty trees", () => {
  test("no content/vocab directory at all: both files are written with empty arrays", () => {
    const root = makeRoot();
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const src = mobileOf(root);
    assert.ok(src.startsWith(GENERATED_HEADER));
    assert.match(src, /import type \{ RuntimeVocabItem, VocabSensesFile, VocabTopic \} from '@hangul-route\/content-schema';/);
    assert.deepEqual(grab(src, "VOCAB_TOPICS"), []);
    assert.deepEqual(grab(src, "VOCAB_ITEMS"), []);
    assert.deepEqual(grab(src, "VOCAB_SENSES"), []);
    assert.deepEqual(grab(webOf(root), "VOCAB_CATALOG"), []);
    assert.match(r.stdout, /0 topics, 0 items/);
  });

  test("README.md, _senses.json and non-JSON files are not read as topics", () => {
    const root = makeRoot();
    put(root, "content/vocab/README.md", "# vocab\n");
    put(root, "content/vocab/_senses.json", SENSES());
    mkdirSync(join(root, "content", "vocab", "sub"), { recursive: true });
    put(root, "content/vocab/sub/x.json", "{ not json");
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(grab(mobileOf(root), "VOCAB_TOPICS"), []);
    assert.equal(grab(mobileOf(root), "VOCAB_SENSES").length, 1);
  });
});

describe("build-vocab.mjs: shaping", () => {
  test("topics ordered by `order`, items by topic order then file order, defaults applied", () => {
    const root = makeRoot();
    // animals has order 2, food order 1: file names sort the other way round.
    seed(root);
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const src = mobileOf(root);
    const topics = grab(src, "VOCAB_TOPICS");
    assert.deepEqual(topics.map((t) => t.key), ["food", "animals"]);
    assert.equal(topics[0].fixedOrder, false);
    assert.equal(topics[1].fixedOrder, true);
    const items = grab(src, "VOCAB_ITEMS");
    assert.deepEqual(items.map((i) => i.id), ["vocab:sagwa", "vocab:bae-pear", "vocab:horangi", "vocab:bae-boat"]);
    assert.equal(items[0].pos, "noun");
    assert.deepEqual(items[0].glosses, { en: "apple" });
    assert.equal(r.stdout.includes("2 topics, 4 items"), true);
  });

  test("topic order decides, not the file name", () => {
    const root = makeRoot();
    put(root, "content/vocab/food.json", topicFile("food", 5, [item("vocab:sagwa", "사과", "sagwa", "apple")]));
    put(root, "content/vocab/animals.json", topicFile("animals", 2, [item("vocab:horangi", "호랑이", "horangi", "tiger")]));
    assert.equal(run(root).status, 0);
    assert.deepEqual(grab(mobileOf(root), "VOCAB_TOPICS").map((t) => t.key), ["animals", "food"]);
  });

  test("only known fields are emitted, in schema order; optional fields are kept", () => {
    const { items, topics } = buildVocab({
      topicFiles: [
        topicFile(
          "food",
          1,
          [
            {
              ...item("vocab:sagwa", "사과", "sagwa", "apple", {
                senseNote: "A note.",
                spokenKo: "사과",
                audioRef: "audio/vocab/sagwa.mp3",
                example: { ko: "사과예요", romanization: "sagwayeyo", en: "It is an apple." },
              }),
              stray: "dropped",
            },
          ],
          { stray: "dropped" }
        ),
      ],
      senses: { schemaVersion: 1, groups: [] },
      overlays: { es: new Map(), ko: new Map() },
    });
    assert.deepEqual(Object.keys(items[0]), [
      "id", "ko", "romanization", "en", "pos", "topics", "level", "visual",
      "senseNote", "spokenKo", "audioRef", "example", "glosses",
    ]);
    assert.deepEqual(Object.keys(topics[0]), [
      "id", "key", "order", "titleEn", "titleKo", "blurbEn", "hoyaIntroEn", "tint", "coverItemId", "status", "fixedOrder",
    ]);
  });

  test("every item carries its audioRef: the one path the schema allows, derived from the id when the file has none", () => {
    assert.equal(vocabAudioRef("vocab:sagwa-apple"), "audio/vocab/sagwa-apple.mp3");
    const { items } = buildVocab({
      topicFiles: [
        topicFile("food", 1, [
          item("vocab:sagwa", "사과", "sagwa", "apple"),
          item("vocab:bae-pear", "배", "bae", "pear", { audioRef: "audio/vocab/bae-pear.mp3" }),
        ]),
      ],
      senses: null,
      overlays: { es: new Map(), ko: new Map() },
    });
    assert.deepEqual(items.map((i) => i.audioRef), ["audio/vocab/sagwa.mp3", "audio/vocab/bae-pear.mp3"]);
    // The derived ref sits where a written one would (schema order), so the output does not reorder.
    assert.deepEqual(Object.keys(items[0]), ["id", "ko", "romanization", "en", "pos", "topics", "level", "visual", "audioRef", "glosses"]);
  });

  test("web catalog holds id, ko, romanization, en, primary topic, visual and the glosses only", () => {
    const root = makeRoot();
    seed(root);
    assert.equal(run(root).status, 0);
    const catalog = grab(webOf(root), "VOCAB_CATALOG");
    assert.deepEqual(catalog[0], {
      id: "vocab:sagwa",
      ko: "사과",
      romanization: "sagwa",
      en: "apple",
      topic: "food",
      visual: "card:sagwa",
      glosses: { en: "apple" },
    });
    assert.equal(catalog.length, 4);
    assert.ok(webOf(root).startsWith(GENERATED_HEADER));
    assert.equal(webOf(root).includes("import "), false);
  });

  test("VOCAB_SENSES is the registry's group list", () => {
    const root = makeRoot();
    seed(root);
    assert.equal(run(root).status, 0);
    assert.deepEqual(grab(mobileOf(root), "VOCAB_SENSES"), SENSES().groups);
  });

  test("topic files with drafts are bundled (the picker hides them, V12)", () => {
    const root = makeRoot();
    seed(root);
    run(root);
    assert.equal(grab(mobileOf(root), "VOCAB_TOPICS")[0].status, "draft");
  });
});

describe("build-vocab.mjs: glosses from overlays", () => {
  test("es and ko gloss assembled; missing entries leave the key out; ids of other prefixes ignored", () => {
    const root = makeRoot();
    seed(root);
    put(
      root,
      "content/i18n/es/vocab-food.json",
      overlay("es", "food", {
        "vocab:sagwa": { gloss: "manzana", senseNote: "ignored here" },
        "vocab-topic:food": { title: "Comida" },
        "card:sagwa": { title: "x" },
      })
    );
    put(root, "content/i18n/ko/vocab-food.json", overlay("ko", "food", { "vocab:sagwa": { gloss: "빨갛고 동그란 과일" } }));
    assert.equal(run(root).status, 0);
    const items = grab(mobileOf(root), "VOCAB_ITEMS");
    assert.deepEqual(items[0].glosses, { en: "apple", es: "manzana", ko: "빨갛고 동그란 과일" });
    assert.deepEqual(items[1].glosses, { en: "pear" });
    assert.deepEqual(items[2].glosses, { en: "tiger" });
  });

  test("an overlay with a non-string gloss contributes nothing", () => {
    const root = makeRoot();
    seed(root);
    put(root, "content/i18n/es/vocab-food.json", overlay("es", "food", { "vocab:sagwa": { gloss: 3 }, "vocab:bae-pear": "x" }));
    assert.equal(run(root).status, 0);
    assert.deepEqual(grab(mobileOf(root), "VOCAB_ITEMS")[0].glosses, { en: "apple" });
  });

  test("overlay files that are not vocab-*.json are ignored", () => {
    const root = makeRoot();
    seed(root);
    put(root, "content/i18n/es/stage1-jamo.json", "{ not json");
    put(root, "content/i18n/es/vocab-food.json", overlay("es", "food", { "vocab:sagwa": { gloss: "manzana" } }));
    assert.equal(run(root).status, 0);
    assert.equal(grab(mobileOf(root), "VOCAB_ITEMS")[0].glosses.es, "manzana");
  });

  test("the web catalog carries the overlay glosses too (F-VOC-005 P-4: the console glosses in its UI language)", () => {
    const root = makeRoot();
    seed(root);
    put(root, "content/i18n/es/vocab-food.json", overlay("es", "food", { "vocab:sagwa": { gloss: "manzana" } }));
    put(root, "content/i18n/ko/vocab-animals.json", overlay("ko", "animals", { "vocab:horangi": { gloss: "호랑이" } }));
    assert.equal(run(root).status, 0);
    const catalog = grab(webOf(root), "VOCAB_CATALOG");
    assert.deepEqual(catalog[0].glosses, { en: "apple", es: "manzana" });
    assert.deepEqual(catalog[1].glosses, { en: "pear" });
    assert.deepEqual(catalog[2].glosses, { en: "tiger", ko: "호랑이" });
  });

  test("the overlay of one topic does not leak into another", () => {
    const root = makeRoot();
    seed(root);
    put(root, "content/i18n/es/vocab-animals.json", overlay("es", "animals", { "vocab:horangi": { gloss: "tigre" } }));
    assert.equal(run(root).status, 0);
    const items = grab(mobileOf(root), "VOCAB_ITEMS");
    assert.equal(items[0].glosses.es, undefined);
    assert.equal(items[2].glosses.es, "tigre");
  });

  test("a malformed overlay fails with an annotation naming the file", () => {
    const root = makeRoot();
    seed(root);
    put(root, "content/i18n/ko/vocab-food.json", "{ nope");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/i18n\/ko\/vocab-food\.json/);
    assert.equal(existsSync(join(root, MOBILE_REL)), false);
  });

  test("an overlay without an entries object fails", () => {
    const root = makeRoot();
    seed(root);
    put(root, "content/i18n/es/vocab-food.json", { locale: "es", domain: "vocab-food" });
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /entries/);
  });
});

describe("build-vocab.mjs: determinism", () => {
  test("output is byte-identical on a second run, ends with one newline, two files", () => {
    const root = makeRoot();
    seed(root);
    put(root, "content/i18n/es/vocab-food.json", overlay("es", "food", { "vocab:sagwa": { gloss: "manzana" } }));
    run(root);
    const first = [mobileOf(root), webOf(root)];
    run(root);
    assert.deepEqual([mobileOf(root), webOf(root)], first);
    for (const text of first) assert.ok(text.endsWith("\n") && !text.endsWith("\n\n"));
  });

  test("pure renderers agree with the written files", () => {
    const root = makeRoot();
    seed(root);
    run(root);
    const model = buildVocab({
      topicFiles: [FOOD(), ANIMALS()],
      senses: SENSES(),
      overlays: { es: new Map(), ko: new Map() },
    });
    assert.equal(renderMobile(model), mobileOf(root));
    assert.equal(renderWeb(model), webOf(root));
  });
});

describe("build-vocab.mjs: input errors", () => {
  test("invalid JSON in a topic file fails with an annotation naming the file; nothing is written", () => {
    const root = makeRoot();
    put(root, "content/vocab/food.json", "{ nope");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/vocab\/food\.json/);
    assert.equal(existsSync(join(root, MOBILE_REL)), false);
    assert.equal(existsSync(join(root, WEB_REL)), false);
  });

  test("invalid JSON in _senses.json fails", () => {
    const root = makeRoot();
    put(root, "content/vocab/_senses.json", "{ nope");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /_senses\.json/);
  });

  test("_senses.json without a groups array fails", () => {
    const root = makeRoot();
    put(root, "content/vocab/_senses.json", { schemaVersion: 1 });
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /groups/);
  });

  test("a top-level JSON value that is not an object fails", () => {
    const root = makeRoot();
    put(root, "content/vocab/list.json", "[1, 2]");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /object/);
  });

  test("a topic file without topic or items fails naming the field", () => {
    const root = makeRoot();
    put(root, "content/vocab/food.json", { schemaVersion: 1, items: [] });
    assert.match(run(root).stdout, /topic/);
    put(root, "content/vocab/food.json", { schemaVersion: 1, topic: FOOD().topic });
    assert.match(run(root).stdout, /items/);
  });

  test("a missing field the generator must emit fails naming the item and the field", () => {
    for (const field of ["id", "ko", "romanization", "en", "visual"]) {
      const root = makeRoot();
      const food = FOOD();
      delete food.items[0][field];
      put(root, "content/vocab/food.json", food);
      const r = run(root);
      assert.equal(r.status, 1, field);
      assert.match(r.stdout, new RegExp(`::error file=content/vocab/food\\.json::.*${field}`), field);
    }
  });

  test("bad level, topics or topic scalar fields fail", () => {
    const cases = [
      (f) => (f.items[0].level = "one"),
      (f) => (f.items[0].topics = "food"),
      (f) => (f.topic.order = "1"),
      (f) => (f.topic.titleKo = "음식"),
      (f) => delete f.topic.tint,
      (f) => (f.topic.fixedOrder = "yes"),
      (f) => (f.items[0].senseNote = 3),
    ];
    for (const [n, mutate] of cases.entries()) {
      const root = makeRoot();
      const food = FOOD();
      mutate(food);
      put(root, "content/vocab/food.json", food);
      assert.equal(run(root).status, 1, `case ${n}`);
    }
  });

  test("unknown flags fail with usage", () => {
    const root = makeRoot();
    const bad = run(root, ["--nope"]);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /Usage/);
  });
});

describe("build-vocab.mjs: --check", () => {
  test("passes right after a build, and does not write", () => {
    const root = makeRoot();
    seed(root);
    assert.equal(run(root).status, 0);
    const before = [mobileOf(root), webOf(root)];
    const r = run(root, ["--check"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /up to date/);
    assert.deepEqual([mobileOf(root), webOf(root)], before);
  });

  test("fails when the generated files are missing, and does not create them", () => {
    const root = makeRoot();
    seed(root);
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=apps\/mobile\/src\/content\/__generated__\/vocab\.ts::.*missing/);
    assert.match(r.stdout, /::error file=apps\/web\/src\/data\/vocab-catalog\.ts::.*missing/);
    assert.equal(existsSync(join(root, MOBILE_REL)), false);
  });

  test("an empty tree: --check passes only after the empty files were generated", () => {
    const root = makeRoot();
    assert.equal(run(root, ["--check"]).status, 1);
    assert.equal(run(root).status, 0);
    assert.equal(run(root, ["--check"]).status, 0);
  });

  test("a content change without a rebuild fails and names the first differing line", () => {
    const root = makeRoot();
    seed(root);
    run(root);
    const food = FOOD();
    food.items[0].en = "red apple";
    put(root, "content/vocab/food.json", food);
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=apps\/mobile\/src\/content\/__generated__\/vocab\.ts::.*out of date/);
    assert.match(r.stdout, /line \d+/);
    assert.match(r.stdout, /red apple/);
    // the web mirror holds `en` too, so it drifts as well
    assert.match(r.stdout, /::error file=apps\/web\/src\/data\/vocab-catalog\.ts::.*out of date/);
  });

  test("an overlay change drifts both modules (each carries the glosses)", () => {
    const root = makeRoot();
    seed(root);
    run(root);
    put(root, "content/i18n/es/vocab-food.json", overlay("es", "food", { "vocab:sagwa": { gloss: "manzana" } }));
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /__generated__\/vocab\.ts::.*out of date/);
    assert.match(r.stdout, /vocab-catalog\.ts::.*out of date/);
  });

  test("hand-editing a generated file is caught", () => {
    const root = makeRoot();
    seed(root);
    run(root);
    writeFileSync(join(root, WEB_REL), `${webOf(root)}// hand edit\n`);
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /vocab-catalog\.ts/);
  });

  test("invalid content fails --check as well", () => {
    const root = makeRoot();
    put(root, "content/vocab/food.json", "{ nope");
    assert.equal(run(root, ["--check"]).status, 1);
  });
});
