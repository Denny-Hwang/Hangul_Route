// Self-tests for scripts/placement-rules.mjs (F-PLC-001 PR P-4): the plain-Node
// validator rules for content/placement/**. The `pitem:` overlay fields are checked by
// the shared overlay rules (scripts/__tests__/overlay-rules.test.mjs, F-I18N-001 §3.7).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = resolve(HERE, "..");
const {
  PLACEMENT_BASELINE_FILE,
  PLACEMENT_RULES,
  applyPlacementBaseline,
  checkPlacementLint,
  checkPlacementTree,
  chipParts,
  lintPlacementTree,
  niklIndex,
  repeatsLine,
  wordsMatch,
  wordsOfSentence,
} = await import(join(SCRIPTS, "placement-rules.mjs"));

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
    options: [opt("a", "ㄱ", true), opt("b", "ㅅ"), opt("c", "ㄴ"), opt("d", "ㄷ")],
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

  test("a sentence is ready only with its language review record", () => {
    const sentence = (fn) => rules(edit("content/placement/sentences.json", (f) => fn(f.templates[0])));
    assert.deepEqual(sentence((t) => (t.status = "ready")), ["placement-sentence-ready"]);
    assert.deepEqual(sentence((t) => Object.assign(t, { status: "ready", reviewedBy: "ab" })), ["placement-sentence-ready"]);
    assert.deepEqual(sentence((t) => Object.assign(t, { status: "ready", reviewedAt: "2026-10-11" })), ["placement-sentence-ready"]);
    assert.deepEqual(sentence((t) => Object.assign(t, { status: "ready", reviewedBy: "ab", reviewedAt: "2026-10-11" })), []);
  });

  test("the review record has a short reviewer label and a YYYY-MM-DD date", () => {
    assert.deepEqual(rules(tpl((t) => (t.reviewedBy = " "))), ["placement-review"]);
    assert.deepEqual(rules(tpl((t) => (t.reviewedBy = "x".repeat(17)))), ["placement-review"]);
    assert.deepEqual(rules(tpl((t) => (t.reviewedBy = 3))), ["placement-review"]);
    assert.deepEqual(rules(tpl((t) => (t.reviewedAt = "11/10/2026"))), ["placement-review"]);
    assert.deepEqual(rules(tpl((t) => Object.assign(t, { reviewedBy: "ab", reviewedAt: "2026-10-11" }))), []);
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

describe("placement-rules: overlays are delegated", () => {
  test("content/i18n/<locale>/placement.json is the shared overlay rules' business, not this module's", () => {
    const bad = { locale: "ko", domain: "nope", entries: { "pitem:nope": { romanization: "x" } } };
    assert.deepEqual(rules(tree({ "content/i18n/es/placement.json": bad })), []);
    assert.deepEqual(checkPlacementTree(new Map([["content/i18n/es/placement.json", bad]])), []);
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

  test("a Spanish overlay with Hangul fails the generic language rule; unknown ids and options fail the shared overlay rules", () => {
    const root = mkdtempSync(join(tmpdir(), "valplc-"));
    try {
      write(root, "placement/index.json", { version: 1, warmup: "pitem:warmup-rice", files: ["sound-letter.json"] });
      write(root, "placement/sound-letter.json", { strand: "sound-letter", templates: [hear(), hear("pitem:warmup-rice")] });
      write(root, "i18n/es/placement.json", {
        locale: "es",
        domain: "placement",
        entries: { "pitem:sound-basic-hear-giyeok": { gloss: "가", "options.zzz.gloss": "x", sound: "x" }, "pitem:zzz": { gloss: "x" } },
      });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /korean-in-ui-field at \.entries/);
      assert.match(r.stdout, /::error file=content\/i18n\/es\/placement\.json::overlay-unknown-id: pitem:zzz/);
      assert.match(r.stdout, /overlay-unknown-id: pitem:sound-basic-hear-giyeok has no options element zzz/);
      assert.match(r.stdout, /overlay-forbidden-field: sound cannot be translated/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---- AMENDMENTS-PLC-VALIDITY §3.4 (row PV-3): the item-validity lint -------------------------------------------------

const LINT = (rule, findings) => findings.filter((f) => f.rule === rule).map((f) => f.templateId);
const NIKL = niklIndex({
  entries: [
    [353, "밥", "01", "명", "~을 먹다", "A"],
    [3237, "사과", "05", "명", "沙果", "A"],
    [4064, "사과", "08", "명", "謝過", "C"],
    [2000, "붓", "", "명", "", "B"],
    [3000, "호랑이", "", "명", "", "B"],
    [4000, "청자", "", "명", "", "C"],
    [null, "서울", "", "고", "", "A"],
    ["x", 7, "", "", "", ""],
  ],
});

const act = (predicate, noun) => `word:act-${predicate}-${noun}`;
const pic = (id, pictureRef, isCorrect = false) => ({ id, pictureRef, en: id, isCorrect });
const bankTree = (strands, extra = {}, index = {}) =>
  new Map([
    ["content/placement/index.json", { version: 1, warmup: "pitem:warmup-rice", files: Object.keys(strands), ...index }],
    ...Object.entries(strands).map(([file, templates]) => [`content/placement/${file}`, { strand: "x", templates }]),
    ...Object.entries(extra),
  ]);
const base = (id, gate, form, format, question, status = "ready") => ({
  id,
  strand: "x",
  gate,
  form,
  status,
  reviewedBy: "ab",
  reviewedAt: "2026-11-25",
  glossEn: "g",
  question: { format, options: [], tags: [], requires: { audio: false, picture: null }, leaks: true, ...question },
});
/** A sentence picture item: the right picture, two of its noun, one of another noun. */
const sentence = (id, { form = "read", right, same, other, tags = [] } = {}) =>
  base(id, "sentence", form, form === "read" ? "read-pick-picture" : "hear-pick-picture", {
    prompt: { ko: "곰이 뛰어요", romanization: "gomi ttwieoyo", en: "The bear runs." },
    options: [pic("a", right ?? act("run", "bear"), true), pic("b", same?.[0] ?? act("swim", "bear")), pic("c", same?.[1] ?? act("sleep", "bear")), pic("d", other ?? act("eat", "cat"))],
    tags: ["pattern:n-i-v", "word:gom", ...tags],
  });
const replyItem = (id, line, right, wrong) =>
  base(id, "sentence", "read", "reply-pick", {
    prompt: { ko: line, romanization: "x", en: "x" },
    options: [{ id: "r1", ko: right, romanization: "x", en: "x", isCorrect: true }, ...wrong.map((ko, i) => ({ id: `w${i}`, ko, romanization: "x", en: "x", isCorrect: false }))],
    tags: ["pattern:reply"],
    requires: { audio: true, picture: null },
  });
const heard = (id, ko, tags, refs = ["word:food-rice", "word:school-book", "word:nature-tree", "word:animal-cat"]) =>
  base(id, "vocab", "oral", "hear-pick-picture", {
    prompt: { ko, romanization: "x", en: "x" },
    options: refs.map((ref, i) => pic(`o${i}`, ref, i === 0)),
    tags,
  });
const readWord = (id, tags, refs = ["card:rice", "card:book", "card:tiger", "card:moon"]) =>
  base(id, "vocab", "read", "read-pick-picture", { prompt: { ko: "밥", romanization: "bap", en: "rice" }, options: refs.map((ref, i) => pic(`o${i}`, ref, i === 0)), tags });
const syllable = (id, gate, format, target, others) =>
  base(id, gate, "decode", format, {
    ...(format === "hear-pick-written" ? { spoken: { ko: target, romanization: "x", en: "x" } } : { prompt: { ko: target, romanization: "x", en: "x" } }),
    options: [target, ...others].map((x, i) => (format === "hear-pick-written" ? { id: `o${i}`, ko: x, isCorrect: i === 0 } : { id: `o${i}`, sound: x, isCorrect: i === 0 })),
  });
const letter = (id, gate, target, others) =>
  base(id, gate, "decode", "hear-pick-written", { spoken: { ko: "가", romanization: "ga", en: "ga" }, options: [target, ...others].map((x, i) => ({ id: `o${i}`, ko: x, isCorrect: i === 0 })) });

describe("placement lint: the helpers of the rules", () => {
  test("chipParts reads a Latin chip as initial, vowel and final, and refuses what is not one syllable", () => {
    assert.deepEqual(chipParts("ga"), { initial: "g", medial: "a", final: "" });
    assert.deepEqual(chipParts("eo"), { initial: "", medial: "eo", final: "" });
    assert.deepEqual(chipParts("gang"), { initial: "g", medial: "a", final: "ng" });
    assert.deepEqual(chipParts("kkwal"), { initial: "kk", medial: "wa", final: "l" });
    assert.equal(chipParts("xyz"), null);
    assert.equal(chipParts(""), null);
    assert.equal(chipParts("ga na"), null);
    assert.equal(chipParts(7), null);
    assert.deepEqual(chipParts("deol"), { initial: "d", medial: "eo", final: "l" });
  });

  test("words of a sentence drop punctuation and the echo stop words", () => {
    assert.deepEqual(wordsOfSentence("네, 잘 지냈어요?"), ["잘", "지냈어요"]);
    assert.deepEqual(wordsOfSentence("저도 반가워요."), ["반가워요"]);
    assert.deepEqual(wordsOfSentence("이거 김치예요?"), ["김치예요"]);
    assert.deepEqual(wordsOfSentence("아니요, 저는 학생이에요."), ["학생이에요"]);
  });

  test("two words match on their first two syllables; a one-syllable word on equality after one particle", () => {
    assert.equal(wordsMatch("안녕하세요", "안녕히"), true);
    assert.equal(wordsMatch("먹었어요", "먹어요"), false);
    assert.equal(wordsMatch("김치예요", "김치가"), true);
    assert.equal(wordsMatch("밥", "밥을"), true);
    assert.equal(wordsMatch("밥을", "밥"), true);
    assert.equal(wordsMatch("물", "밥"), false);
    assert.equal(wordsMatch("가", "가요"), false);
    assert.equal(repeatsLine("밥 먹었어요?", "네, 먹었어요."), true);
    assert.equal(repeatsLine("고마워요.", "천만에요."), false);
  });

  test("niklIndex keeps the rank lookups and the grade-A words, and skips rows it cannot read", () => {
    assert.deepEqual(NIKL.byRank.get(353), { word: "밥", grade: "A" });
    assert.equal(NIKL.byRank.has(4064), true);
    assert.equal(NIKL.byRank.size, 6);
    assert.deepEqual([...NIKL.gradeA].sort(), ["밥", "사과", "서울"]);
    assert.equal(niklIndex(undefined).byRank.size, 0);
    assert.equal(niklIndex({ entries: [3, [1, "가"]] }).byRank.size, 0);
  });
});

describe("placement lint: placement-sentence-options (S1)", () => {
  const rule = (templates, extra) => LINT("placement-sentence-options", lintPlacementTree(bankTree({ "sentences.json": templates }, extra), { nikl: NIKL }));

  test("the right picture and two of its noun with three predicates, and one other noun with a fourth predicate, pass", () => {
    assert.deepEqual(rule([sentence("pitem:sent-v-read-a"), sentence("pitem:sent-v-hear-a", { form: "oral" })]), []);
  });

  test("a card picture, a picture of a wrong shape and a wrong number of options fail", () => {
    assert.deepEqual(rule([sentence("pitem:sent-v-read-card", { right: "card:tiger" })]), ["pitem:sent-v-read-card"]);
    assert.deepEqual(rule([sentence("pitem:sent-v-read-two", { right: "word:act-run" })]), ["pitem:sent-v-read-two"]);
    const three = sentence("pitem:sent-v-read-three");
    three.question.options.pop();
    assert.deepEqual(rule([three]), ["pitem:sent-v-read-three"]);
    const none = sentence("pitem:sent-v-read-none");
    none.question.options[0].pictureRef = undefined;
    assert.deepEqual(rule([none]), ["pitem:sent-v-read-none"]);
  });

  test("the noun alone must not decide: three pictures of the noun, a repeated predicate, an echoed predicate", () => {
    assert.deepEqual(rule([sentence("pitem:sent-v-read-noun3", { other: act("eat", "bear") })]), ["pitem:sent-v-read-noun3"]);
    assert.deepEqual(rule([sentence("pitem:sent-v-read-same", { same: [act("run", "bear"), act("sleep", "bear")] })]), ["pitem:sent-v-read-same"]);
    assert.deepEqual(rule([sentence("pitem:sent-v-read-echo", { other: act("swim", "cat") })]), ["pitem:sent-v-read-echo"]);
    const noRight = sentence("pitem:sent-v-read-noright");
    noRight.question.options[0].isCorrect = false;
    assert.deepEqual(rule([noRight]), ["pitem:sent-v-read-noright"]);
  });

  test("a draft is not linted, and the warm-up is exempt", () => {
    const draft = sentence("pitem:sent-v-read-draft", { right: "card:tiger" });
    draft.status = "draft";
    assert.deepEqual(rule([draft]), []);
    assert.deepEqual(rule([sentence("pitem:warmup-rice", { right: "card:tiger" })]), []);
  });
});

describe("placement lint: placement-sentence-family (S5)", () => {
  const FAMILY_NOUNS = [
    ["bear", "gom"],
    ["tiger", "horangi"],
    ["puppy", "gangaji"],
    ["rabbit", "tokki"],
    ["cat", "goyangi"],
    ["monkey", "wonsungi"],
    ["bird", "sae"],
    ["duck", "ori"],
    ["brother", "dongsaeng"],
    ["friend", "chingu"],
  ];
  const PREDICATES = [["run", "swim", "sleep"], ["run", "eat", "sleep"], ["fly", "eat", "sleep"], ["swim", "fly", "sleep"], ["run", "swim", "eat"]];
  const families = (n = 10) =>
    FAMILY_NOUNS.slice(0, n).map(([slug, romanization], i) => ({
      noun: { ko: "곰", romanization, slug },
      predicates: PREDICATES[i % PREDICATES.length].map((p) => ({ ko: "뛰어요", slug: p })),
    }));
  /** One read and one oral template per picture, each with two same-noun distractors and a different-noun one. */
  const templatesFor = (rows) => {
    const out = [];
    rows.forEach((row, i) => {
      const other = rows[(i + 1) % rows.length];
      row.predicates.forEach((p, j) => {
        const right = act(p.slug, row.noun.slug);
        const same = row.predicates.filter((x) => x !== p).map((x) => act(x.slug, row.noun.slug));
        const strange = other.predicates.find((x) => !row.predicates.some((y) => y.slug === x.slug))?.slug ?? "x1";
        for (const form of ["read", "oral"]) {
          out.push(sentence(`pitem:sent-v-${form}-${i}-${j}`, { form, right, same, other: act(strange, other.noun.slug), tags: [] }));
          out[out.length - 1].question.tags = ["pattern:n-i-v", `word:${row.noun.romanization}`];
        }
      });
    });
    return out;
  };
  const make = (rows, templates = templatesFor(rows), index = { families: "sentence-families.json" }) =>
    bankTree({ "sentences.json": templates }, { "content/placement/sentence-families.json": { families: rows } }, index);
  const family = (tree) => lintPlacementTree(tree, { nikl: NIKL }).filter((f) => f.rule === "placement-sentence-family");

  test("ten families of three, every picture right once per form, five predicates, none right in 40 percent: passes", () => {
    const rows = families();
    const tree = make(rows);
    // the fixture's own sentence-options are not the subject here
    assert.deepEqual(family(tree), []);
  });

  test("a bank with sentence pictures and no families file reports the bank once; with no sentence pictures nothing", () => {
    const tree = bankTree({ "sentences.json": [sentence("pitem:sent-v-read-a")] });
    assert.deepEqual(family(tree).map((f) => f.templateId), ["bank:families"]);
    assert.deepEqual(family(bankTree({ "sentences.json": [] })), []);
    assert.deepEqual(family(new Map([["content/placement/sentences.json", { strand: "x", templates: [sentence("pitem:sent-v-read-a")] }]])), []);
  });

  test("fewer than ten families and fewer than five predicates are reported for the bank", () => {
    const rows = families(9);
    assert.deepEqual(family(make(rows)).map((f) => f.templateId), ["bank:families"]);
    const few = families().map((r) => ({ ...r, predicates: ["run", "swim", "sleep"].map((slug) => ({ ko: "x", slug })) }));
    const ids = family(make(few)).map((f) => f.templateId);
    assert.ok(ids.includes("bank:predicates"));
  });

  test("a family row of the wrong shape is named by its place", () => {
    const rows = families();
    rows[2] = { noun: { ko: "곰", romanization: "go-m", slug: "puppy" }, predicates: rows[2].predicates };
    rows[3] = { noun: rows[3].noun, predicates: rows[3].predicates.slice(0, 2) };
    rows[4] = { noun: rows[4].noun, predicates: [rows[4].predicates[0], rows[4].predicates[0], rows[4].predicates[1]] };
    rows[5] = { noun: rows[5].noun, predicates: [{ ko: "x" }, rows[5].predicates[1], rows[5].predicates[2]] };
    rows[6] = 7;
    const ids = family(make(rows, [])).map((f) => f.templateId);
    for (const i of [2, 3, 4, 5, 6]) assert.ok(ids.includes(`family:${i}`), `family:${i}`);
    assert.ok(ids.includes("bank:families"));
  });

  test("an act picture outside every family, and a word: tag that is not the family's noun, fail the template", () => {
    const rows = families();
    const templates = templatesFor(rows);
    templates[0].question.options[3].pictureRef = act("x1", "cat");
    templates[2].question.tags = ["pattern:n-i-v", "word:other"];
    const failing = family(make(rows, templates)).filter((f) => f.templateId.startsWith("pitem:"));
    assert.deepEqual(failing.map((f) => f.templateId).sort(), [templates[0].id, templates[2].id].sort());
  });

  test("a picture that is right in no template, or in two templates of one form, fails", () => {
    const rows = families();
    const templates = templatesFor(rows);
    const dropped = templates.filter((t) => t.id !== "pitem:sent-v-read-0-0");
    assert.ok(family(make(rows, dropped)).some((f) => f.templateId === `picture:read:${act("run", "bear")}`));
    const twice = [...templates, { ...structuredClone(templates[0]), id: "pitem:sent-v-read-0-0-again" }];
    assert.deepEqual(family(make(rows, twice)).filter((f) => f.templateId.startsWith("pitem:")).map((f) => f.templateId), ["pitem:sent-v-read-0-0-again"]);
  });

  test("a predicate right in more than 40 percent of a form's templates fails the bank", () => {
    const rows = families().map((r) => ({ ...r, predicates: [{ ko: "x", slug: "run" }, { ko: "x", slug: "swim" }, { ko: "x", slug: "sleep" }] }));
    const ids = family(make(rows)).map((f) => f.templateId);
    assert.ok(ids.every((id) => !id.startsWith("bank:predicate-share")), "one third each is fine");
    const skew = families();
    const templates = templatesFor(skew);
    // more templates whose right picture shows `sleep` than a third of the read form
    const extra = [];
    skew.forEach((row, i) => {
      extra.push(sentence(`pitem:sent-v-read-more-${i}`, { right: act("sleep", row.noun.slug), same: row.predicates.filter((p) => p.slug !== "sleep").slice(0, 2).map((p) => act(p.slug, row.noun.slug)), other: act("zzz", "cat") }));
      extra[i].question.tags = ["pattern:n-i-v", `word:${row.noun.romanization}`];
    });
    const result = family(make(skew, [...templates, ...extra])).map((f) => f.templateId);
    assert.ok(result.some((id) => id.startsWith("bank:predicate-share:read:")), result.join(" "));
  });
});

describe("placement lint: placement-reply-echo (S6)", () => {
  const rule = (...templates) => LINT("placement-reply-echo", lintPlacementTree(bankTree({ "sentences.json": templates })));

  test("a right reply that is the only one repeating the line fails; a wrong reply that also repeats makes it pass", () => {
    assert.deepEqual(rule(replyItem("pitem:sent-reply-8", "밥 먹었어요?", "네, 먹었어요.", ["안녕히 계세요.", "괜찮아요."])), ["pitem:sent-reply-8"]);
    assert.deepEqual(rule(replyItem("pitem:sent-reply-1", "안녕하세요!", "안녕하세요.", ["안녕히 계세요.", "괜찮아요."])), []);
    assert.deepEqual(rule(replyItem("pitem:sent-reply-3", "만나서 반가워요!", "저도 반가워요.", ["안녕히 계세요.", "괜찮아요."])), ["pitem:sent-reply-3"]);
  });

  test("a right reply that repeats nothing passes, and so does one that shares only a stop word", () => {
    assert.deepEqual(rule(replyItem("pitem:sent-reply-2", "고마워요.", "아니에요.", ["안녕히 계세요.", "괜찮아요."])), []);
    assert.deepEqual(rule(replyItem("pitem:sent-reply-4", "이거 김치예요?", "네, 맛있어요.", ["이거 좋아요.", "괜찮아요."])), []);
  });

  test("a template with no prompt or no Korean right reply is left to the structure rules", () => {
    const noLine = replyItem("pitem:sent-reply-5", "x", "네", []);
    noLine.question.prompt = undefined;
    assert.deepEqual(rule(noLine), []);
    const noKo = replyItem("pitem:sent-reply-6", "밥 먹었어요?", "네", []);
    noKo.question.options[0].ko = undefined;
    assert.deepEqual(rule(noKo), []);
  });
});

describe("placement lint: placement-vocab-frequency and placement-vocab-pictures (W1 to W3)", () => {
  const lintOf = (...templates) => lintPlacementTree(bankTree({ "vocabulary.json": templates }), { nikl: NIKL });
  const freq = (...templates) => LINT("placement-vocab-frequency", lintOf(...templates));
  const pictures = (...templates) => LINT("placement-vocab-pictures", lintOf(...templates));

  test("a heard word needs exactly one nikl tag whose entry is that word", () => {
    assert.deepEqual(freq(heard("pitem:vocab-hear-bap", "밥", ["word:bap", "nikl:353"])), []);
    assert.deepEqual(freq(heard("pitem:vocab-hear-none", "밥", ["word:bap"])), ["pitem:vocab-hear-none"]);
    assert.deepEqual(freq(heard("pitem:vocab-hear-two", "밥", ["nikl:353", "nikl:3237"])), ["pitem:vocab-hear-two"]);
    assert.deepEqual(freq(heard("pitem:vocab-hear-rank", "밥", ["nikl:999999"])), ["pitem:vocab-hear-rank"]);
    assert.deepEqual(freq(heard("pitem:vocab-hear-nan", "밥", ["nikl:abc"])), ["pitem:vocab-hear-nan"]);
    assert.deepEqual(freq(heard("pitem:vocab-hear-other", "사과", ["nikl:353"])), ["pitem:vocab-hear-other"]);
  });

  test("a homograph is told by its rank: 사과 (apple) is grade A, 사과 (apology) is grade C", () => {
    assert.deepEqual(freq(heard("pitem:vocab-hear-sagwa", "사과", ["nikl:3237"])), []);
    assert.deepEqual(freq(heard("pitem:vocab-hear-apology", "사과", ["nikl:4064"])), ["pitem:vocab-hear-apology"]);
  });

  test("grade B passes only when Stage 2 teaches the word (a whole-string ko of an episode); grade C never", () => {
    const stage2 = { "content/episodes/stage-2/life.json": { quests: [{ rounds: [{ ko: "붓", romanization: "but" }, { ko: "호랑이가", romanization: "x" }] }] } };
    const lint = (word, tag, extra) => LINT("placement-vocab-frequency", lintPlacementTree(bankTree({ "vocabulary.json": [heard("pitem:vocab-hear-x", word, [tag])] }, extra), { nikl: NIKL }));
    assert.deepEqual(lint("붓", "nikl:2000", stage2), []);
    assert.deepEqual(lint("붓", "nikl:2000"), ["pitem:vocab-hear-x"]);
    assert.deepEqual(lint("호랑이", "nikl:3000", stage2), ["pitem:vocab-hear-x"], "호랑이가 is not the whole string 호랑이");
    assert.deepEqual(lint("청자", "nikl:4000", { "content/episodes/stage-2/life.json": { ko: "청자" } }), ["pitem:vocab-hear-x"]);
  });

  test("without the list, no rank resolves", () => {
    const tree = bankTree({ "vocabulary.json": [heard("pitem:vocab-hear-bap", "밥", ["nikl:353"])] });
    assert.deepEqual(LINT("placement-vocab-frequency", lintPlacementTree(tree)), ["pitem:vocab-hear-bap"]);
  });

  test("every option is a word: picture, the word is not a homonym, at most one person picture", () => {
    const tags = ["nikl:353"];
    assert.deepEqual(pictures(heard("pitem:vocab-hear-ok", "밥", tags)), []);
    assert.deepEqual(pictures(heard("pitem:vocab-hear-card", "밥", tags, ["card:rice", "word:school-book", "word:nature-tree", "word:animal-cat"])), ["pitem:vocab-hear-card"]);
    assert.deepEqual(pictures(heard("pitem:vocab-hear-homonym", "눈", tags)), ["pitem:vocab-hear-homonym"]);
    assert.deepEqual(pictures(heard("pitem:vocab-hear-people", "엄마", tags, ["word:family-mom", "word:school-teacher", "word:nature-tree", "word:animal-cat"])), ["pitem:vocab-hear-people"]);
    assert.deepEqual(pictures(heard("pitem:vocab-hear-one", "엄마", tags, ["word:family-mom", "word:food-rice", "word:nature-tree", "word:animal-cat"])), []);
  });

  test("the warm-up and read items are not heard words", () => {
    assert.deepEqual(freq(heard("pitem:warmup-rice", "밥", [])), []);
    assert.deepEqual(freq(readWord("pitem:vocab-read-bap", [])), []);
    assert.deepEqual(pictures(readWord("pitem:vocab-read-bap", [])), []);
  });
});

describe("placement lint: placement-text-picture and placement-vocab-read-share (W4)", () => {
  const lintOf = (templates) => lintPlacementTree(bankTree({ "vocabulary.json": templates }), { nikl: NIKL });

  test("a read item never offers a picture that shows letters", () => {
    const bad = readWord("pitem:vocab-read-hangul", [], ["card:hangul-day", "card:book", "card:tiger", "card:moon"]);
    const glyph = readWord("pitem:vocab-read-glyph", [], ["word:culture-hangul", "card:book", "card:tiger", "card:moon"]);
    assert.deepEqual(LINT("placement-text-picture", lintOf([bad, glyph, readWord("pitem:vocab-read-ok", [])])), ["pitem:vocab-read-glyph", "pitem:vocab-read-hangul"]);
  });

  test("at least two thirds of the read words carry a grade A or B nikl tag", () => {
    const words = (tagged) => [...Array(3).keys()].map((i) => readWord(`pitem:vocab-read-${i}`, i < tagged ? ["nikl:353"] : []));
    assert.deepEqual(LINT("placement-vocab-read-share", lintOf(words(2))), []);
    assert.deepEqual(LINT("placement-vocab-read-share", lintOf(words(1))), ["bank:vocab-read-share"]);
    assert.deepEqual(LINT("placement-vocab-read-share", lintOf(words(0))), ["bank:vocab-read-share"]);
    const gradeC = [readWord("pitem:vocab-read-a", ["nikl:4000"]), readWord("pitem:vocab-read-b", ["nikl:abc"]), readWord("pitem:vocab-read-c", ["nikl:353"])];
    assert.deepEqual(LINT("placement-vocab-read-share", lintOf(gradeC)), ["bank:vocab-read-share"]);
    assert.deepEqual(LINT("placement-vocab-read-share", lintOf([])), []);
  });
});

describe("placement lint: placement-decode-balanced (D1) and placement-decode-ear (D2)", () => {
  const lintOf = (...templates) => lintPlacementTree(bankTree({ "syllable-reading.json": templates }));
  const balanced = (...templates) => LINT("placement-decode-balanced", lintOf(...templates));
  const ear = (...templates) => LINT("placement-decode-ear", lintOf(...templates));

  test("an open item offers the 2 x 2 set, heard (written options) or seen (Latin chips)", () => {
    assert.deepEqual(balanced(syllable("pitem:syl-cv-hear-ga", "syl-cv", "hear-pick-written", "가", ["나", "거", "너"])), []);
    assert.deepEqual(balanced(syllable("pitem:syl-cv-see-ga", "syl-cv", "see-pick-sound", "ga", ["na", "geo", "neo"])), []);
    assert.deepEqual(balanced(syllable("pitem:syl-cv-hear-bad", "syl-cv", "hear-pick-written", "가", ["거", "나", "라"])), ["pitem:syl-cv-hear-bad"]);
    assert.deepEqual(balanced(syllable("pitem:syl-cv-see-bad", "syl-cv", "see-pick-sound", "ga", ["geo", "na", "ra"])), ["pitem:syl-cv-see-bad"]);
  });

  test("a closed item offers {CVF, C'V'F, C'VF', CV'F'}: every pair differs in two positions, always with a final", () => {
    assert.deepEqual(balanced(syllable("pitem:syl-cvc-hear-gom", "syl-cvc", "hear-pick-written", "곰", ["둠", "독", "국"])), []);
    assert.deepEqual(balanced(syllable("pitem:syl-cvc-see-gom", "syl-cvc", "see-pick-sound", "gom", ["dum", "dok", "guk"])), []);
    assert.deepEqual(balanced(syllable("pitem:syl-cvc-hear-bad", "syl-cvc", "hear-pick-written", "곰", ["공", "감", "금"])), ["pitem:syl-cvc-hear-bad"]);
    assert.deepEqual(balanced(syllable("pitem:syl-cvc-hear-open", "syl-cvc", "hear-pick-written", "곰", ["둠", "독", "구"])), ["pitem:syl-cvc-hear-open"]);
  });

  test("options that are not four different syllables fail, and so do chips that are not one syllable", () => {
    assert.deepEqual(balanced(syllable("pitem:syl-cv-hear-dup", "syl-cv", "hear-pick-written", "가", ["가", "거", "너"])), ["pitem:syl-cv-hear-dup"]);
    assert.deepEqual(balanced(syllable("pitem:syl-cv-hear-three", "syl-cv", "hear-pick-written", "가", ["나", "거"])), ["pitem:syl-cv-hear-three"]);
    assert.deepEqual(balanced(syllable("pitem:syl-cv-see-chip", "syl-cv", "see-pick-sound", "ga", ["na", "geo", "n?o"])), ["pitem:syl-cv-see-chip"]);
    assert.deepEqual(balanced(syllable("pitem:syl-cv-hear-lone", "syl-cv", "hear-pick-written", "가", ["나", "거", "x"])), ["pitem:syl-cv-hear-lone"]);
  });

  test("the build-syllable and the other strands are not balanced items", () => {
    const build = syllable("pitem:syl-cv-build-ga", "syl-cv", "build-syllable", "가", ["가"]);
    assert.deepEqual(balanced(build), []);
    assert.deepEqual(balanced(letter("pitem:sound-basic-hear-giyeok", "sound-basic", "ㄱ", ["ㅅ", "ㄴ", "ㄷ"])), []);
  });

  test("a heard item never sets a contrast the ear cannot tell next to its target", () => {
    const letters = (gate, target, others) => ear(letter(`pitem:${gate}-hear-x`, gate, target, others));
    assert.deepEqual(letters("sound-basic", "ㄱ", ["ㅅ", "ㄴ", "ㄷ"]), []);
    assert.deepEqual(letters("sound-basic", "ㄱ", ["ㅋ", "ㄴ", "ㄷ"]), ["pitem:sound-basic-hear-x"]);
    assert.deepEqual(letters("sound-basic", "ㄷ", ["ㅌ", "ㄱ", "ㅅ"]), ["pitem:sound-basic-hear-x"]);
    assert.deepEqual(letters("sound-basic", "ㅂ", ["ㅍ", "ㄱ", "ㅅ"]), ["pitem:sound-basic-hear-x"]);
    assert.deepEqual(letters("sound-rest", "ㅈ", ["ㅊ", "ㄱ", "ㅅ"]), ["pitem:sound-rest-hear-x"]);
    assert.deepEqual(letters("sound-rest", "ㅎ", ["ㅇ", "ㄱ", "ㅅ"]), ["pitem:sound-rest-hear-x"]);
    assert.deepEqual(letters("sound-basic", "ㄴ", ["ㄷ", "ㄱ", "ㅅ"]), ["pitem:sound-basic-hear-x"], "held back until the listening pass");
    assert.deepEqual(letters("sound-basic", "ㅁ", ["ㅂ", "ㄱ", "ㅅ"]), ["pitem:sound-basic-hear-x"], "held back until the listening pass");
    assert.deepEqual(letters("sound-rest", "ㅓ", ["ㅗ", "ㅏ", "ㅣ"]), ["pitem:sound-rest-hear-x"]);
    assert.deepEqual(letters("sound-rest", "ㅡ", ["ㅜ", "ㅏ", "ㅣ"]), ["pitem:sound-rest-hear-x"]);
    assert.deepEqual(letters("sound-rest", "ㅕ", ["ㅛ", "ㅏ", "ㅣ"]), ["pitem:sound-rest-hear-x"]);
    assert.deepEqual(letters("sound-rest", "ㅏ", ["ㅓ", "ㅑ", "ㅣ"]), []);
  });

  test("in a syllable the same pairs rule out the option, by the position they differ in; finals by sound class", () => {
    const s = (target, others) => ear(syllable("pitem:syl-cvc-hear-x", "syl-cvc", "hear-pick-written", target, others));
    assert.deepEqual(s("곰", ["둠", "독", "국"]), []);
    assert.deepEqual(s("산", ["삼", "삽", "삭"]), ["pitem:syl-cvc-hear-x"], "ㄴ and ㅁ are both nasals");
    assert.deepEqual(s("달", ["담", "닥", "당"]), [], "the liquid ㄹ is a class of its own");
    assert.deepEqual(s("곰", ["공", "곱", "골"]), ["pitem:syl-cvc-hear-x"], "ㅁ and ㅇ are both nasals");
    assert.deepEqual(s("각", ["갑", "간", "갈"]), ["pitem:syl-cvc-hear-x"], "ㄱ and ㅂ are both stops");
    assert.deepEqual(s("가", ["카", "나", "거"]), ["pitem:syl-cvc-hear-x"]);
    assert.deepEqual(s("거", ["고", "너", "가"]), ["pitem:syl-cvc-hear-x"]);
    assert.deepEqual(s("자", ["차", "나", "거"]), ["pitem:syl-cvc-hear-x"]);
  });

  test("ㅅ against ㅈ or ㅊ before ㅣ or a y-vowel, and ㅈ or ㅊ with a y-vowel, are ruled out; elsewhere they are not", () => {
    const s = (target, others) => ear(syllable("pitem:syl-cv-hear-x", "syl-cv", "hear-pick-written", target, others));
    assert.deepEqual(s("시", ["지", "니", "비"]), ["pitem:syl-cv-hear-x"]);
    assert.deepEqual(s("사", ["자", "나", "바"]), []);
    assert.deepEqual(s("서", ["저", "너", "머"]), [], "ㅅ and ㅈ before ㅓ are told apart");
    assert.deepEqual(s("주", ["저", "라", "마"]), []);
    assert.deepEqual(s("저", ["져", "라", "마"]), ["pitem:syl-cv-hear-x"], "져 sounds as 저");
    assert.deepEqual(s("쇼", ["죠", "라", "마"]), ["pitem:syl-cv-hear-x"]);
  });

  test("an item whose target is not a letter or a syllable, or an option that is not, is left to the structure rules", () => {
    assert.deepEqual(ear(letter("pitem:sound-basic-hear-x", "sound-basic", "x", ["ㄱ"])), []);
    assert.deepEqual(ear(letter("pitem:sound-basic-hear-y", "sound-basic", "ㄱ", ["x", "가"])), []);
  });
});

describe("placement lint: placement-pools (S7, W5)", () => {
  const many = (n, make) => [...Array(n).keys()].map((i) => make(i));
  const bank = (counts) =>
    bankTree({
      "sentences.json": [
        ...many(counts.read, (i) => sentence(`pitem:sent-v-read-${i}`)),
        ...many(counts.reply, (i) => replyItem(`pitem:sent-reply-${i}`, "x", "y", [])),
        ...many(counts.oral, (i) => sentence(`pitem:sent-v-hear-${i}`, { form: "oral" })),
      ],
      "vocabulary.json": [...many(counts.vocabOral, (i) => heard(`pitem:vocab-hear-${i}`, "밥", [])), ...many(counts.vocabRead, (i) => readWord(`pitem:vocab-read-${i}`, []))],
    });
  const pools = (counts) => LINT("placement-pools", lintPlacementTree(bank(counts)));
  const full = { read: 24, reply: 6, oral: 24, vocabOral: 24, vocabRead: 18 };

  test("the pools of S7 and W5 at their minimum pass", () => {
    assert.deepEqual(pools(full), []);
  });

  test("each pool below its minimum is named", () => {
    assert.deepEqual(pools({ ...full, read: 23 }), ["pool:sentence-read-read-pick-picture"]);
    assert.deepEqual(pools({ ...full, reply: 5 }), ["pool:sentence-read-reply-pick"]);
    assert.deepEqual(pools({ ...full, oral: 23 }), ["pool:sentence-oral-hear-pick-picture"]);
    assert.deepEqual(pools({ ...full, vocabOral: 23 }), ["pool:vocab-oral-hear-pick-picture"]);
    assert.deepEqual(pools({ ...full, vocabRead: 17 }), ["pool:vocab-read-read-pick-picture"]);
  });

  test("a draft is not counted, and a tree without a bank is not measured", () => {
    const tree = bank(full);
    tree.get("content/placement/sentences.json").templates[0].status = "draft";
    assert.deepEqual(LINT("placement-pools", lintPlacementTree(tree)), ["pool:sentence-read-read-pick-picture"]);
    assert.deepEqual(lintPlacementTree(new Map([["content/placement/sentences.json", { strand: "x", templates: [sentence("pitem:sent-v-read-a")] }]])).filter((f) => f.rule === "placement-pools"), []);
  });
});

describe("placement lint: the families file of index.json", () => {
  const withFamilies = (families, file = { families: [] }) =>
    tree({
      "content/placement/index.json": { version: 1, warmup: "pitem:warmup-rice", files: ["sound-letter.json", "sentences.json"], ...(families === undefined ? {} : { families }) },
      ...(file === null ? {} : { "content/placement/sentence-families.json": file }),
    });

  test("a families file is data of the lint: it is not a strand file and is not listed in files", () => {
    assert.deepEqual(rules(withFamilies("sentence-families.json")), []);
    assert.deepEqual(rules(withFamilies(undefined)), ["placement-bad-shape", "placement-index"], "without the index naming it, the same file is a strand file nobody lists");
  });

  test("it must be a .json name in the folder, exist, and stay out of files", () => {
    assert.deepEqual(rules(withFamilies(3, null)), ["placement-index"]);
    assert.deepEqual(rules(withFamilies("../x.json", null)), ["placement-index"]);
    assert.deepEqual(rules(withFamilies("missing.json", null)), ["placement-index"]);
    assert.deepEqual(rules(withFamilies("sentences.json", null)), ["placement-index"]);
  });
});

describe("placement lint: the shrinking baseline (PV-OD-10)", () => {
  const findings = (...pairs) => pairs.map(([rule, templateId]) => ({ rule, templateId, file: "content/placement/x.json", path: "templates.0", message: "m" }));

  test("a listed finding is reported, an unlisted one fails", () => {
    const r = applyPlacementBaseline(findings(["placement-pools", "pool:a"], ["placement-pools", "pool:b"]), [{ rule: "placement-pools", templateId: "pool:a" }]);
    assert.deepEqual(r.reported.map((f) => f.templateId), ["pool:a"]);
    assert.deepEqual(r.failures.map((f) => f.templateId), ["pool:b"]);
    assert.deepEqual(r.stale, []);
    assert.deepEqual(r.malformed, []);
  });

  test("a listed pair that no longer fails is stale: it must leave the file", () => {
    const r = applyPlacementBaseline(findings(), [{ rule: "placement-pools", templateId: "pool:a" }]);
    assert.deepEqual(r.stale, [{ index: 0, rule: "placement-pools", templateId: "pool:a" }]);
  });

  test("the same template under another rule is not covered", () => {
    const r = applyPlacementBaseline(findings(["placement-reply-echo", "pitem:x"]), [{ rule: "placement-sentence-options", templateId: "pitem:x" }]);
    assert.equal(r.failures.length, 1);
    assert.equal(r.stale.length, 1);
  });

  test("a baseline that is not a list of pairs, or repeats a pair, is malformed; no baseline is an empty one", () => {
    assert.equal(applyPlacementBaseline([], { rule: "x" }).malformed.length, 1);
    assert.equal(applyPlacementBaseline([], [{ rule: "x" }]).malformed.length, 1);
    assert.equal(applyPlacementBaseline([], [null]).malformed.length, 1);
    const twice = [{ rule: "a", templateId: "b" }, { rule: "a", templateId: "b" }];
    assert.equal(applyPlacementBaseline(findings(["a", "b"]), twice).malformed.length, 1);
    assert.deepEqual(applyPlacementBaseline(findings(["a", "b"]), undefined).failures.length, 1);
  });

  test("checkPlacementLint turns them into violations that name the rule and the template id, and counts the reported ones per rule", () => {
    const tree = bankTree({ "sentences.json": [sentence("pitem:sent-v-read-card", { right: "card:tiger" }), sentence("pitem:sent-v-read-card2", { right: "card:tiger" })] });
    const r = checkPlacementLint(tree, {
      nikl: NIKL,
      baseline: [
        { rule: "placement-sentence-options", templateId: "pitem:sent-v-read-card" },
        { rule: "placement-sentence-family", templateId: "bank:families" },
        { rule: "placement-pools", templateId: "pool:gone" },
        { rule: "placement-pools", templateId: "pool:sentence-read-read-pick-picture" },
        { rule: "placement-pools", templateId: "pool:sentence-oral-hear-pick-picture" },
        { rule: "placement-pools", templateId: "pool:sentence-read-reply-pick" },
      ],
    });
    assert.deepEqual(r.reported, { "placement-pools": 3, "placement-sentence-family": 1, "placement-sentence-options": 1 });
    const text = r.violations.map((v) => `${v.file} ${v.path} ${v.rule}`);
    assert.ok(text.some((t) => t.startsWith("content/placement/sentences.json templates.1 placement-sentence-options: pitem:sent-v-read-card2: ")), text.join("\n"));
    assert.ok(text.some((t) => t.startsWith(`${PLACEMENT_BASELINE_FILE} [2] placement-lint-baseline: placement-pools pool:gone no longer fails`)), text.join("\n"));
    assert.equal(r.violations.length, 2, text.join("\n"));
    assert.equal(checkPlacementLint(tree, { baseline: 7 }).violations.some((v) => v.rule.startsWith("placement-lint-baseline: the baseline is a list")), true);
  });
});

describe("validate-content.mjs runs the placement lint with its baseline", () => {
  const SCRIPT = join(SCRIPTS, "validate-content.mjs");
  const put = (root, rel, body) => {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, typeof body === "string" ? body : JSON.stringify(body));
  };
  const run = (root) => spawnSync("node", [SCRIPT], { env: { ...process.env, HANGUL_ROUTE_ROOT: root }, encoding: "utf8" });
  const withBank = (fn) => {
    const root = mkdtempSync(join(tmpdir(), "valplc-lint-"));
    try {
      put(root, "content/placement/index.json", { version: 1, warmup: "pitem:warmup-rice", files: ["sentences.json"] });
      put(root, "content/placement/sentences.json", {
        strand: "sentences",
        templates: [
          { ...sentence("pitem:sent-v-read-card", { right: "card:tiger" }), strand: "sentences" },
          { ...replyItem("pitem:warmup-rice", "x", "y", ["z", "w"]), strand: "sentences", status: "draft" },
        ],
      });
      fn(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
  const BASELINE = "scripts/placement-lint-baseline.json";

  test("a finding that is not in the baseline fails the run, with the rule, the template id and the file", () => {
    withBank((root) => {
      const r = run(root);
      assert.equal(r.status, 1, r.stdout);
      assert.match(r.stdout, /::error file=content\/placement\/sentences\.json::placement-sentence-options: pitem:sent-v-read-card: /);
    });
  });

  test("a baselined finding is reported in one line, not failed; the file may list pairs only for findings that still fail", () => {
    withBank((root) => {
      const bank = [
        { rule: "placement-sentence-options", templateId: "pitem:sent-v-read-card" },
        { rule: "placement-sentence-family", templateId: "bank:families" },
        { rule: "placement-pools", templateId: "pool:sentence-read-read-pick-picture" },
        { rule: "placement-pools", templateId: "pool:sentence-oral-hear-pick-picture" },
        { rule: "placement-pools", templateId: "pool:sentence-read-reply-pick" },
      ];
      put(root, BASELINE, bank);
      const ok = run(root);
      assert.equal(ok.status, 0, ok.stdout);
      assert.match(ok.stdout, /placement-lint \(baselined\): 5 known finding\(s\), to shrink: placement-pools 3, placement-sentence-family 1, placement-sentence-options 1/);
      put(root, BASELINE, [...bank, { rule: "placement-reply-echo", templateId: "pitem:sent-reply-9" }]);
      const stale = run(root);
      assert.equal(stale.status, 1);
      assert.match(stale.stdout, /::error file=scripts\/placement-lint-baseline\.json::placement-lint-baseline: placement-reply-echo pitem:sent-reply-9 no longer fails/);
      put(root, BASELINE, "{ not json");
      const bad = run(root);
      assert.equal(bad.status, 1);
      assert.match(bad.stdout, /::error file=scripts\/placement-lint-baseline\.json::invalid-json/);
    });
  });
});
