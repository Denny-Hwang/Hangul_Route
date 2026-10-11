// Self-tests for scripts/placement-rules.mjs (F-PLC-001 PR P-4): the plain-Node
// validator rules for content/placement/** and the `pitem:` overlay fields.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = resolve(HERE, "..");
const { checkPlacementTree, PLACEMENT_RULES } = await import(join(SCRIPTS, "placement-rules.mjs"));

const opt = (id, ko, isCorrect = false) => ({ id, ko, romanization: id, en: id, isCorrect });
const hear = (id = "pitem:sound-basic-hear-giyeok") => ({
  id,
  strand: "sound-letter",
  gate: "sound-basic",
  form: "decode",
  status: "ready",
  glossEn: "g",
  question: {
    format: "hear-pick-written",
    spoken: { ko: "가", romanization: "ga", en: "ga" },
    options: [opt("a", "ㄱ", true), opt("b", "ㅋ"), opt("c", "ㄴ"), opt("d", "ㄷ")],
    tags: ["sym:ㄱ", "group:basic"],
    requires: { audio: true, picture: null },
    leaks: true,
  },
});
const reply = (id = "pitem:sent-reply-1") => ({
  id,
  strand: "sentences",
  gate: "sentence",
  form: "read",
  status: "draft",
  glossEn: "r",
  question: {
    format: "reply-pick",
    prompt: { ko: "안녕하세요!", romanization: "annyeonghaseyo", en: "Hello" },
    options: [opt("a", "안녕하세요", true), opt("b", "아니에요"), opt("c", "괜찮아요")],
    tags: ["pattern:reply"],
    requires: { audio: true, picture: null },
    leaks: true,
  },
});

const tree = (over = {}) =>
  new Map(
    Object.entries({
      "content/placement/index.json": { version: 1, warmup: "pitem:warmup-rice", files: ["sound-letter.json", "sentences.json"] },
      "content/placement/sound-letter.json": { strand: "sound-letter", templates: [hear(), { ...hear("pitem:warmup-rice") }] },
      "content/placement/sentences.json": { strand: "sentences", templates: [reply()] },
      ...over,
    }),
  );
const rules = (m) => checkPlacementTree(m).map((v) => v.rule.split(":")[0]);
const edit = (rel, fn, base = tree()) => {
  const m = base;
  const file = structuredClone(m.get(rel));
  fn(file);
  m.set(rel, file);
  return m;
};
const tpl = (change) => edit("content/placement/sound-letter.json", (f) => change(f.templates[0]));

describe("placement-rules: the shipped shape passes", () => {
  test("a small valid tree has no findings, and so does an empty one", () => {
    assert.deepEqual(checkPlacementTree(tree()), []);
    assert.deepEqual(checkPlacementTree(new Map()), []);
    assert.deepEqual(checkPlacementTree(new Map([["content/other.json", { a: 1 }]])), []);
  });

  test("the rule tables list every gate, form and format", () => {
    assert.deepEqual(Object.keys(PLACEMENT_RULES.formats).sort(), ["recog", "sentence", "sound-basic", "sound-rest", "syl-cv", "syl-cvc", "vocab"]);
    assert.ok(PLACEMENT_RULES.audioFormats.includes("build-syllable"));
    assert.ok(PLACEMENT_RULES.noLeakFormats.includes("hear-pick-picture"));
  });
});

describe("placement-rules: strand files", () => {
  test("a file that is not { strand, templates } is a bad shape", () => {
    assert.deepEqual(rules(tree({ "content/placement/sentences.json": [] })), ["placement-bad-shape"]);
    assert.deepEqual(rules(tree({ "content/placement/sentences.json": { strand: "sentences" } })), ["placement-bad-shape"]);
    assert.deepEqual(rules(edit("content/placement/sentences.json", (f) => f.templates.push(3))), ["placement-bad-shape"]);
  });

  test("ids: format and uniqueness across the whole tree", () => {
    assert.deepEqual(rules(tpl((t) => (t.id = "sound-basic"))), ["placement-id"]);
    const dup = edit("content/placement/sentences.json", (f) => f.templates.push({ ...reply(), id: "pitem:warmup-rice" }));
    assert.deepEqual(rules(dup), ["placement-id"]);
  });

  test("strand, form and format follow the gate table", () => {
    assert.deepEqual(rules(tpl((t) => (t.strand = "vocabulary"))), ["placement-gate"]);
    assert.deepEqual(rules(tpl((t) => (t.form = "read"))), ["placement-gate"]);
    assert.deepEqual(rules(tpl((t) => (t.gate = "nope"))), ["placement-gate"]);
    assert.deepEqual(rules(tpl((t) => (t.question.format = "see-pick-sound"))).filter((r) => r === "placement-gate"), []);
    assert.ok(rules(tpl((t) => (t.question.format = "reply-pick"))).includes("placement-gate"));
  });

  test("leaks and requires.audio come from the format", () => {
    assert.deepEqual(rules(tpl((t) => (t.question.leaks = false))), ["placement-leaks"]);
    assert.deepEqual(rules(tpl((t) => (t.question.requires.audio = false))), ["placement-audio"]);
    assert.deepEqual(rules(tpl((t) => (t.question = { ...t.question, requires: null }))), ["placement-bad-shape"]);
  });

  test("options: count and exactly one correct", () => {
    assert.deepEqual(rules(tpl((t) => t.question.options.pop())), ["placement-options"]);
    assert.deepEqual(rules(tpl((t) => (t.question.options[1].isCorrect = true))), ["placement-options"]);
    const three = edit("content/placement/sentences.json", (f) => f.templates[0].question.options.pop());
    assert.deepEqual(rules(three), ["placement-options"]);
    const ok = edit("content/placement/sentences.json", (f) => f.templates[0].question.options.push(opt("d", "고마워요")));
    assert.deepEqual(rules(ok), []);
  });

  test("a sentence is never ready until the reviewedBy ledger exists", () => {
    assert.deepEqual(rules(edit("content/placement/sentences.json", (f) => (f.templates[0].status = "ready"))), ["placement-sentence-ready"]);
  });

  test("status must be draft or ready", () => {
    assert.deepEqual(rules(tpl((t) => (t.status = "live"))), ["placement-status"]);
  });
});

describe("placement-rules: index.json", () => {
  test("version, warm-up and file list are checked against the tree", () => {
    const idx = (fn) => edit("content/placement/index.json", fn);
    assert.deepEqual(rules(idx((i) => (i.version = 0))), ["placement-index"]);
    assert.deepEqual(rules(idx((i) => (i.warmup = "pitem:nope"))), ["placement-index"]);
    assert.deepEqual(rules(idx((i) => i.files.push("vocabulary.json"))), ["placement-index"]);
    assert.deepEqual(rules(idx((i) => (i.files = []))), ["placement-index"]);
    assert.deepEqual(rules(tree({ "content/placement/index.json": 3 })), ["placement-index"]);
    const extra = tree({ "content/placement/vocabulary.json": { strand: "vocabulary", templates: [] } });
    assert.deepEqual(rules(extra), ["placement-index"]);
  });

  test("a bank without an index is reported once", () => {
    const m = tree();
    m.delete("content/placement/index.json");
    assert.deepEqual(rules(m), ["placement-index"]);
  });
});

describe("placement-rules: overlays", () => {
  const overlay = (entries, extra = {}) => ({ locale: "es", domain: "placement", entries, ...extra });
  const withOverlay = (body, file = "content/i18n/es/placement.json") => tree({ [file]: body });

  test("a gloss and an option gloss are allowed", () => {
    const m = withOverlay(overlay({ "pitem:sound-basic-hear-giyeok": { gloss: "Escucha", "options.a.gloss": "x" } }));
    assert.deepEqual(rules(m), []);
  });

  test("shape: locale must match the folder, domain placement, entries an object", () => {
    assert.deepEqual(rules(withOverlay(overlay({}, { locale: "ko" }))), ["overlay-bad-shape"]);
    assert.deepEqual(rules(withOverlay(overlay({}, { domain: "vocab" }))), ["overlay-bad-shape"]);
    assert.deepEqual(rules(withOverlay({ locale: "es", domain: "placement" })), ["overlay-bad-shape"]);
    assert.deepEqual(rules(withOverlay(overlay({ "pitem:sound-basic-hear-giyeok": 3 }))), ["overlay-bad-shape"]);
    assert.deepEqual(rules(withOverlay(overlay({}), "content/i18n/en/placement.json")), ["overlay-bad-shape"]);
  });

  test("an entry for an id that is not in the bank is unknown", () => {
    assert.deepEqual(rules(withOverlay(overlay({ "pitem:nope": { gloss: "x" } }))), ["overlay-unknown-id"]);
  });

  test("only gloss and options.<id>.gloss may be translated; Korean and ids never", () => {
    const id = "pitem:sound-basic-hear-giyeok";
    for (const field of ["ko", "romanization", "sound", "pictureRef", "options.a.ko", "options.a.sound", "title"]) {
      assert.deepEqual(rules(withOverlay(overlay({ [id]: { [field]: "x" } }))), ["overlay-forbidden-field"], field);
    }
  });

  test("an option gloss must name an option of the template, and the value must be a string", () => {
    const id = "pitem:sound-basic-hear-giyeok";
    assert.deepEqual(rules(withOverlay(overlay({ [id]: { "options.zzz.gloss": "x" } }))), ["overlay-unknown-option"]);
    assert.deepEqual(rules(withOverlay(overlay({ [id]: { gloss: 3 } }))), ["overlay-bad-shape"]);
  });

  test("other overlay domains and ids of other prefixes are not this module's business", () => {
    const m = tree({ "content/i18n/es/vocab-food.json": { locale: "es", domain: "vocab-food", entries: { "vocab:sagwa": { gloss: "manzana" } } } });
    assert.deepEqual(rules(m), []);
  });
});

describe("validate-content.mjs runs the placement rules", () => {
  const SCRIPT = join(SCRIPTS, "validate-content.mjs");
  const write = (root, rel, body) => {
    const full = join(root, "content", rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, JSON.stringify(body));
  };
  const run = (root) => spawnSync("node", [SCRIPT], { env: { ...process.env, HANGUL_ROUTE_ROOT: root }, encoding: "utf8" });

  test("a clean bank passes; a bad template fails with a rule name and its file", () => {
    const root = mkdtempSync(join(tmpdir(), "valplc-"));
    try {
      write(root, "placement/index.json", { version: 1, warmup: "pitem:warmup-rice", files: ["sound-letter.json"] });
      write(root, "placement/sound-letter.json", { strand: "sound-letter", templates: [hear(), hear("pitem:warmup-rice")] });
      const ok = run(root);
      assert.equal(ok.status, 0, ok.stdout);
      const bad = hear("pitem:warmup-rice");
      bad.question.leaks = false;
      write(root, "placement/sound-letter.json", { strand: "sound-letter", templates: [hear(), bad] });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /::error file=content\/placement\/sound-letter\.json::placement-leaks/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a Spanish overlay with Hangul fails the generic language rule; an unknown id fails the overlay rule", () => {
    const root = mkdtempSync(join(tmpdir(), "valplc-"));
    try {
      write(root, "placement/index.json", { version: 1, warmup: "pitem:warmup-rice", files: ["sound-letter.json"] });
      write(root, "placement/sound-letter.json", { strand: "sound-letter", templates: [hear(), hear("pitem:warmup-rice")] });
      write(root, "i18n/es/placement.json", { locale: "es", domain: "placement", entries: { "pitem:sound-basic-hear-giyeok": { gloss: "가" }, "pitem:zzz": { gloss: "x" } } });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /korean-in-ui-field at \.entries/);
      assert.match(r.stdout, /::error file=content\/i18n\/es\/placement\.json::overlay-unknown-id/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
