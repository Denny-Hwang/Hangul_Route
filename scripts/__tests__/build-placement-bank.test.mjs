// Self-tests for scripts/build-placement-bank.mjs (F-PLC-001 PR P-4).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "build-placement-bank.mjs");
const OUT_REL = join("apps", "mobile", "src", "content", "placement.generated.ts");

const { GENERATED_HEADER, buildPlacementBank, renderBank, shapeTemplate } = await import(SCRIPT);

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "buildplc-"));
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

const opt = (id, ko, isCorrect = false) => ({ id, ko, romanization: id, en: `gloss ${id}`, isCorrect });
const hear = (id, extra = {}) => ({
  id: `pitem:${id}`,
  strand: "sound-letter",
  gate: "sound-basic",
  form: "decode",
  status: "ready",
  glossEn: "Hear it",
  question: {
    format: "hear-pick-written",
    spoken: { ko: "가", romanization: "ga", en: "the sound ga" },
    options: [opt("giyeok", "ㄱ", true), opt("kieuk", "ㅋ"), opt("nieun", "ㄴ"), opt("digeut", "ㄷ")],
    tags: ["sym:ㄱ", "group:basic"],
    requires: { audio: true, picture: null },
    leaks: true,
  },
  ...extra,
});
const see = (id) => ({
  id: `pitem:${id}`,
  strand: "sound-letter",
  gate: "sound-basic",
  form: "decode",
  status: "ready",
  glossEn: "See it",
  question: {
    format: "see-pick-sound",
    prompt: { ko: "ㄱ", romanization: "ga", en: "letter giyeok" },
    options: [
      { id: "ga", sound: "ga", isCorrect: true },
      { id: "ka", sound: "ka", isCorrect: false },
    ],
    tags: ["sym:ㄱ", "group:basic"],
    requires: { audio: false, picture: null },
    leaks: true,
  },
});
const warmup = () => ({
  id: "pitem:warmup-rice",
  strand: "vocabulary",
  gate: "vocab",
  form: "oral",
  status: "ready",
  glossEn: "Warm-up: rice",
  question: {
    format: "hear-pick-picture",
    prompt: { ko: "밥", romanization: "bap", en: "rice" },
    options: [
      { id: "rice", pictureRef: "card:rice", en: "Rice", isCorrect: true },
      { id: "tiger", pictureRef: "card:tiger", en: "Tiger", isCorrect: false },
    ],
    tags: ["word:bap", "topic:life"],
    requires: { audio: true, picture: "card" },
    leaks: false,
  },
});
const reply = () => ({
  id: "pitem:sent-reply-1",
  strand: "sentences",
  gate: "sentence",
  form: "read",
  status: "draft",
  glossEn: "Reply to hello",
  incompatibleWith: ["pitem:sent-reply-3"],
  question: {
    format: "reply-pick",
    prompt: { ko: "안녕하세요!", romanization: "annyeonghaseyo", en: "Hello!" },
    options: [opt("reply-1", "안녕하세요", true), opt("reply-2", "저는 호야예요"), opt("reply-5", "안녕히 계세요")],
    tags: ["pattern:reply"],
    requires: { audio: true, picture: null },
    leaks: true,
  },
});

const INDEX = () => ({ version: 3, warmup: "pitem:warmup-rice", files: ["sound-letter.json", "vocabulary.json", "sentences.json"] });
const FILES = () => ({
  "sound-letter.json": { strand: "sound-letter", templates: [hear("sound-basic-hear-giyeok"), see("sound-basic-see-giyeok")] },
  "vocabulary.json": { strand: "vocabulary", templates: [warmup()] },
  "sentences.json": { strand: "sentences", templates: [reply()] },
});
function writeTree(root, index = INDEX(), files = FILES()) {
  put(root, "content/placement/index.json", index);
  for (const [name, body] of Object.entries(files)) put(root, `content/placement/${name}`, body);
}

describe("build-placement-bank.mjs: shaping", () => {
  test("the bank keeps file order, drops the warm-up into its own export and carries the version", () => {
    const m = buildPlacementBank({ index: INDEX(), files: FILES() });
    assert.equal(m.bank.version, 3);
    assert.deepEqual(m.bank.templates.map((t) => t.id), ["pitem:sound-basic-hear-giyeok", "pitem:sound-basic-see-giyeok", "pitem:sent-reply-1"]);
    assert.equal(m.warmup.id, "pitem:warmup-rice");
  });

  test("prompt and spoken objects become promptKo, promptRomanization and spokenKo; the glosses stay in the source", () => {
    const m = buildPlacementBank({ index: INDEX(), files: FILES() });
    const [h, s, r] = m.bank.templates;
    assert.deepEqual(h.question.spokenKo, "가");
    assert.equal(h.question.promptKo, undefined);
    assert.equal(h.question.promptRomanization, "ga");
    assert.equal(s.question.promptKo, "ㄱ");
    assert.equal(s.question.promptRomanization, "ga");
    assert.equal(s.question.spokenKo, undefined);
    assert.equal(r.question.promptKo, "안녕하세요!");
    assert.ok(!JSON.stringify(m).includes("the sound ga"), "the spoken gloss is not emitted");
    assert.ok(!JSON.stringify(m).includes("Hello!"), "the prompt gloss is not emitted");
  });

  test("a prompt romanization wins over the spoken one", () => {
    const t = hear("x");
    t.question.prompt = { ko: "가", romanization: "ka", en: "p" };
    assert.equal(shapeTemplate(t, "f").question.promptRomanization, "ka");
  });

  test("only known fields are emitted, in schema order; options keep their own fields", () => {
    const t = hear("sound-basic-hear-giyeok", { surprise: 1 });
    t.question.extra = true;
    t.question.options[0].more = 1;
    const out = shapeTemplate(t, "f");
    assert.deepEqual(Object.keys(out), ["id", "strand", "gate", "form", "question", "glossEn", "status"]);
    assert.deepEqual(Object.keys(out.question), ["format", "promptRomanization", "spokenKo", "options", "tags", "requires", "leaks"]);
    assert.deepEqual(Object.keys(out.question.options[0]), ["id", "ko", "romanization", "en", "isCorrect"]);
    assert.deepEqual(Object.keys(shapeTemplate(reply(), "f")), ["id", "strand", "gate", "form", "question", "glossEn", "status", "incompatibleWith"]);
    assert.deepEqual(Object.keys(shapeTemplate(warmup(), "f").question.options[0]), ["id", "en", "pictureRef", "isCorrect"]);
  });

  test("the language review record of a sentence is carried into the bank", () => {
    const out = shapeTemplate({ ...reply(), status: "ready", reviewedBy: "ab", reviewedAt: "2026-10-11" }, "f");
    assert.deepEqual(Object.keys(out), ["id", "strand", "gate", "form", "question", "glossEn", "status", "reviewedBy", "reviewedAt", "incompatibleWith"]);
    assert.equal(out.reviewedBy, "ab");
    assert.equal(out.reviewedAt, "2026-10-11");
  });

  test("a picture option and a sound chip option are shaped without Korean", () => {
    const pic = shapeTemplate(warmup(), "f").question.options[0];
    assert.deepEqual(pic, { id: "rice", en: "Rice", pictureRef: "card:rice", isCorrect: true });
    const chip = shapeTemplate(see("x"), "f").question.options[0];
    assert.deepEqual(chip, { id: "ga", sound: "ga", isCorrect: true });
  });

  test("the rendered module holds the header, the typed bank and the typed warm-up", () => {
    const m = buildPlacementBank({ index: INDEX(), files: FILES() });
    const src = renderBank(m);
    assert.ok(src.startsWith(GENERATED_HEADER));
    assert.match(src, /import type \{ PlacementBank, PlacementTemplate \} from '@hangul-route\/content-schema';/);
    assert.match(src, /export const PLACEMENT_BANK: PlacementBank = \{/);
    assert.match(src, /export const PLACEMENT_WARMUP: PlacementTemplate = \{/);
    assert.ok(src.endsWith("};\n"));
    assert.ok(src.includes('"promptKo": "ㄱ"'));
  });

  test("leaf objects print on one line, so a template stays reviewable", () => {
    const src = renderBank(buildPlacementBank({ index: INDEX(), files: FILES() }));
    assert.ok(src.includes('{"id":"giyeok","ko":"ㄱ","romanization":"giyeok","en":"gloss giyeok","isCorrect":true}'));
    assert.ok(src.includes('"requires": {"audio":true,"picture":null}'));
  });
});

describe("build-placement-bank.mjs: input errors", () => {
  const fails = (index, files, part) => {
    assert.throws(() => buildPlacementBank({ index, files }), (error) => {
      assert.match(error.message, part);
      return true;
    });
  };
  const withTemplate = (fn) => {
    const files = FILES();
    fn(files["sound-letter.json"].templates[0]);
    return files;
  };

  test("the index needs a positive version, a warm-up id and a list of json files", () => {
    fails({ ...INDEX(), version: 0 }, FILES(), /version must be a positive integer/);
    fails({ ...INDEX(), warmup: "rice" }, FILES(), /warmup must be a pitem id/);
    fails({ ...INDEX(), files: [] }, FILES(), /files must be a non-empty list/);
    fails({ ...INDEX(), files: ["a.txt"] }, FILES(), /files must be a non-empty list of \.json names/);
    fails({ ...INDEX(), files: ["sound-letter.json", "sound-letter.json", "vocabulary.json"] }, FILES(), /listed twice/);
    fails(null, FILES(), /index.json must hold one JSON object/);
  });

  test("a listed file must exist and hold strand and templates", () => {
    const files = FILES();
    delete files["sentences.json"];
    fails(INDEX(), files, /sentences\.json: listed in index\.json but missing/);
    fails(INDEX(), { ...FILES(), "sentences.json": [] }, /sentences\.json: must hold one JSON object/);
    fails(INDEX(), { ...FILES(), "sentences.json": { strand: "sentences" } }, /templates must be an array/);
    fails(INDEX(), { ...FILES(), "sentences.json": { strand: 4, templates: [] } }, /strand must be a non-empty string/);
  });

  test("every template field the generator emits is checked, naming the template", () => {
    fails(INDEX(), withTemplate((t) => (t.id = "sound-basic")), /id must match pitem:/);
    fails(INDEX(), withTemplate((t) => delete t.glossEn), /pitem:sound-basic-hear-giyeok: glossEn must be a non-empty string/);
    fails(INDEX(), withTemplate((t) => (t.status = "live")), /status must be draft or ready/);
    fails(INDEX(), withTemplate((t) => (t.strand = "vocabulary")), /strand vocabulary is not the strand sound-letter of its file/);
    fails(INDEX(), withTemplate((t) => (t.question = null)), /question must be an object/);
    fails(INDEX(), withTemplate((t) => (t.question.options = [])), /options must be a non-empty array/);
    fails(INDEX(), withTemplate((t) => (t.question.options[0] = 3)), /an option must be an object/);
    fails(INDEX(), withTemplate((t) => (t.question.options[0].isCorrect = "yes")), /isCorrect must be a boolean/);
    fails(INDEX(), withTemplate((t) => (t.question.options[0].ko = 3)), /ko must be a string/);
    fails(INDEX(), withTemplate((t) => (t.question.tags = "x")), /tags must be an array of strings/);
    fails(INDEX(), withTemplate((t) => (t.question.tags = [1])), /tags must be an array of strings/);
    fails(INDEX(), withTemplate((t) => (t.question.requires = { audio: "yes", picture: null })), /requires\.audio must be a boolean/);
    fails(INDEX(), withTemplate((t) => (t.question.requires = { audio: true, picture: "photo" })), /requires\.picture must be null, card or word/);
    fails(INDEX(), withTemplate((t) => (t.question.requires = null)), /requires must be an object/);
    fails(INDEX(), withTemplate((t) => (t.question.leaks = 1)), /leaks must be a boolean/);
    fails(INDEX(), withTemplate((t) => (t.incompatibleWith = "x")), /incompatibleWith must be an array of strings/);
    fails(INDEX(), withTemplate((t) => (t.reviewedBy = 1)), /reviewedBy must be a string/);
    fails(INDEX(), withTemplate((t) => (t.reviewedAt = 1)), /reviewedAt must be a string/);
  });

  test("Korean prompt and spoken objects need ko, romanization and a gloss", () => {
    fails(INDEX(), withTemplate((t) => (t.question.spoken = { ko: "가", romanization: "ga" })), /spoken\.en must be a non-empty string/);
    fails(INDEX(), withTemplate((t) => (t.question.spoken = "가")), /spoken must be an object/);
    fails(INDEX(), withTemplate((t) => (t.question.prompt = { ko: "", romanization: "ga", en: "x" })), /prompt\.ko must be a non-empty string/);
  });

  test("template ids are unique across files, and the warm-up must exist", () => {
    const files = FILES();
    files["sentences.json"].templates.push(files["sound-letter.json"].templates[0]);
    fails(INDEX(), files, /strand sound-letter is not the strand sentences|duplicate template id/);
    const dup = FILES();
    dup["sound-letter.json"].templates.push(dup["sound-letter.json"].templates[0]);
    fails(INDEX(), dup, /duplicate template id pitem:sound-basic-hear-giyeok/);
    fails({ ...INDEX(), warmup: "pitem:warmup-missing" }, FILES(), /warm-up pitem:warmup-missing is not in any file/);
  });
});

describe("build-placement-bank.mjs: files and CLI", () => {
  test("writes the module, byte-identical on a second run, ending with one newline", () => {
    const root = makeRoot();
    writeTree(root);
    const first = run(root);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /wrote apps\/mobile\/src\/content\/placement\.generated\.ts: 3 templates, warm-up pitem:warmup-rice, bank version 3/);
    const out = readFileSync(join(root, OUT_REL), "utf8");
    assert.ok(out.endsWith("\n") && !out.endsWith("\n\n"));
    assert.equal(run(root).status, 0);
    assert.equal(readFileSync(join(root, OUT_REL), "utf8"), out);
  });

  test("invalid JSON in a bank file fails with an annotation naming the file; nothing is written", () => {
    const root = makeRoot();
    writeTree(root);
    put(root, "content/placement/sentences.json", "{ not json");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/placement\/sentences\.json::not valid JSON/);
    assert.ok(!existsSync(join(root, OUT_REL)));
  });

  test("a shape error is annotated with the file that holds it", () => {
    const root = makeRoot();
    const files = FILES();
    files["sentences.json"].templates[0].status = "live";
    writeTree(root, INDEX(), files);
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/placement\/sentences\.json::pitem:sent-reply-1: status must be draft or ready/);
  });

  test("a missing index fails, and so does an invalid one", () => {
    const root = makeRoot();
    const missing = run(root);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /::error file=content\/placement\/index\.json::missing/);
    put(root, "content/placement/index.json", "[");
    assert.match(run(root).stdout, /index\.json::not valid JSON/);
  });

  test("unknown flags fail with usage", () => {
    const r = run(makeRoot(), ["--fix"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /unknown argument --fix/);
    assert.match(r.stderr, /Usage: node scripts\/build-placement-bank\.mjs \[--check\]/);
  });
});

describe("build-placement-bank.mjs: --check", () => {
  test("passes right after a build, and does not write", () => {
    const root = makeRoot();
    writeTree(root);
    assert.equal(run(root).status, 0);
    const before = readFileSync(join(root, OUT_REL), "utf8");
    const r = run(root, ["--check"]);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /placement bank is up to date \(3 templates/);
    assert.equal(readFileSync(join(root, OUT_REL), "utf8"), before);
  });

  test("fails when the module is missing, and does not create it", () => {
    const root = makeRoot();
    writeTree(root);
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /generated placement bank is missing; run node scripts\/build-placement-bank\.mjs/);
    assert.ok(!existsSync(join(root, OUT_REL)));
  });

  test("a content change without a rebuild fails and names the first differing line", () => {
    const root = makeRoot();
    writeTree(root);
    run(root);
    const files = FILES();
    files["sound-letter.json"].templates[0].glossEn = "Changed";
    writeTree(root, INDEX(), files);
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /out of date with content\/placement \(line \d+: expected .*Changed/);
    assert.match(r.stdout, /run pnpm generate \(generators must be deterministic\)/);
  });

  test("hand-editing the module is caught, and invalid content fails --check too", () => {
    const root = makeRoot();
    writeTree(root);
    run(root);
    const file = join(root, OUT_REL);
    writeFileSync(file, readFileSync(file, "utf8") + "// hand edit\n");
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /expected "\(end of file\)"|no difference|expected/);
    put(root, "content/placement/sentences.json", "{ no");
    assert.equal(run(root, ["--check"]).status, 1);
  });
});
