// Self-tests for scripts/overlay-rules.mjs (F-I18N-001 §3.7, PR 12): the validator rules
// for content/i18n/<locale>/<domain>.json. validate-content.test.mjs covers the wiring.

import { strict as assert } from "node:assert";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const { bannedWordIn, checkOverlayTree } = await import(join(resolve(HERE, ".."), "overlay-rules.mjs"));

// ---- a small base tree --------------------------------------------------------------

const cards = [
  { id: "card:gangaji", title: "Puppy", ko: "강아지", romanization: "gangaji", en: "Puppy", blurb: "A dog." },
];
const jamo = [
  {
    id: "jamo:giyeok",
    ko: "ㄱ",
    romanization: "g/k",
    en: "G as in go",
    exampleWord: { ko: "강아지", romanization: "gangaji", en: "puppy" },
  },
];
const vocab = {
  topic: { id: "vocab-topic:food", key: "food", titleEn: "Food", blurbEn: "Words for food." },
  items: [
    { id: "vocab:sagwa", ko: "사과", romanization: "sagwa", en: "apple" },
    { id: "vocab:bap", ko: "밥", romanization: "bap", en: "cooked rice", senseNote: "Also a meal." },
  ],
};
const placement = {
  strand: "vocabulary",
  templates: [
    {
      id: "pitem:vocab-hear-gimchi",
      glossEn: "kimchi (hear)",
      question: { options: [{ id: "kimchi", en: "Kimchi" }, { id: "moon", en: "Moon" }] },
    },
  ],
};
const story = {
  id: "story:demo",
  title: { ko: "데모", romanization: "demo", en: "Demo" },
  summaryEn: "A demo.",
  keywords: [{ id: "dal", ko: "달", romanization: "dal", en: "moon" }],
  tiers: [
    {
      scenes: [{ id: "s1", narrationEn: "Hoya sees the {kw:dal} and the {kw:dal} again." }],
      checks: [{ id: "c1", promptEn: "Which?", options: [{ id: "a", en: "Sun" }, { id: "b", en: "Moon" }] }],
      checkpoints: [],
    },
  ],
  facts: [{ id: "f1", claimEn: "A fact.", claimKo: "사실" }],
  errata: [],
};

function base(extra = {}) {
  return new Map(
    Object.entries({
      "content/episodes/stage-1/cards.json": cards,
      "content/episodes/stage-1/jamo.json": jamo,
      "content/vocab/food.json": vocab,
      "content/placement/vocabulary.json": placement,
      "content/stories/demo.json": story,
      ...extra,
    }),
  );
}

const overlay = (locale, domain, entries, extra = {}) => ({ locale, domain, entries, ...extra });
const es = (entries, domain = "x") => ({ [`content/i18n/es/${domain}.json`]: overlay("es", domain, entries) });
const ko = (entries, domain = "x") => ({ [`content/i18n/ko/${domain}.json`]: overlay("ko", domain, entries) });

const ruleOf = (v) => v.rule.split(":")[0];
const rules = (tree, options) => checkOverlayTree(tree, options).violations.map(ruleOf).sort();

// ---- tests -----------------------------------------------------------------------

describe("overlay-rules: a clean overlay", () => {
  test("Spanish and Korean overlays of every kind pass", () => {
    const tree = base({
      ...es({
        "card:gangaji": { title: "Perrito", blurb: "Un perro." },
        "jamo:giyeok": { gloss: "G de gato", "exampleWord.gloss": "cachorro", soundHint: "como la g de gato" },
        "vocab-topic:food": { title: "Comida" },
        "vocab:bap": { gloss: "arroz cocido", senseNote: "También una comida." },
        "pitem:vocab-hear-gimchi": { gloss: "kimchi (oír)", "options.moon.gloss": "Luna" },
        "story:demo": { title: "Demo", "scenes.s1.narration": "Hoya ve {kw:dal}, otra vez {kw:dal}.", "checks.c1.options.b": "Luna" },
        "episode:s1-letters": { title: "Letras" },
      }),
      ...ko({
        "vocab:sagwa": { gloss: "빨갛고 동그란 과일" },
        "card:gangaji": { title: "강아지" },
        "jamo:giyeok": { gloss: "혀뿌리로 내는 소리", "exampleWord.gloss": "어린 개" },
        "story:demo": { "keywords.dal.gloss": "밤하늘에 뜨는 것" },
      }),
    });
    const result = checkOverlayTree(tree);
    assert.deepEqual(result.violations, []);
  });
});

describe("overlay-rules: overlay-bad-shape", () => {
  test("files outside content/i18n/<locale>/<domain>.json, en and unknown locales", () => {
    assert.deepEqual(rules(base({ "content/i18n/loose.json": overlay("es", "loose", {}) })), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base({ "content/i18n/es/deep/x.json": overlay("es", "x", {}) })), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base({ "content/i18n/en/x.json": overlay("en", "x", {}) })), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base({ "content/i18n/fr/x.json": overlay("fr", "x", {}) })), ["overlay-bad-shape"]);
  });

  test("the body: object, locale = folder, domain = file name, entries an object, no extra keys", () => {
    assert.deepEqual(rules(base({ "content/i18n/es/x.json": [] })), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base({ "content/i18n/es/x.json": overlay("ko", "x", {}) })), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base({ "content/i18n/es/x.json": overlay("es", "y", {}) })), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base({ "content/i18n/es/x.json": overlay("es", "x", []) })), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base({ "content/i18n/es/x.json": overlay("es", "x", {}, { note: "hi" }) })), ["overlay-bad-shape"]);
  });

  test("entries: id grammar, object entries, non-blank string values, one file per entity and locale", () => {
    assert.deepEqual(rules(base(es({ Card: { title: "x" } }))), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base(es({ "card:gangaji": "x" }))), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base(es({ "card:gangaji": { title: 3 } }))), ["overlay-bad-shape"]);
    assert.deepEqual(rules(base(es({ "card:gangaji": { title: "  " } }))), ["overlay-bad-shape"]);
    const twice = base({ ...es({ "card:gangaji": { title: "A" } }, "a"), ...es({ "card:gangaji": { blurb: "B" } }, "b") });
    const v = checkOverlayTree(twice).violations;
    assert.deepEqual(v.map(ruleOf), ["overlay-bad-shape"]);
    assert.match(v[0].rule, /also in content\/i18n\/es\/a\.json/);
    assert.equal(v[0].file, "content/i18n/es/b.json");
  });
});

describe("overlay-rules: overlay-unknown-id", () => {
  test("an id that is in no base entity fails; a TypeScript-resident prefix is left to the mobile test", () => {
    assert.deepEqual(rules(base(es({ "vocab:nope": { gloss: "nada" } }))), ["overlay-unknown-id"]);
    assert.deepEqual(rules(base(es({ "story:ghost": { title: "x" } }))), ["overlay-unknown-id"]);
    assert.deepEqual(rules(base(es({ "pitem:nope": { gloss: "x" } }))), ["overlay-unknown-id"]);
    for (const [id, field] of [
      ["episode:x", "title"],
      ["quest:x", "steps.intro.title"],
      ["minigame:x", "cardPairs.gimchi.gloss"],
      ["stage:stage9", "title"],
      ["theme:x", "oneLiner"],
      ["card:ts-only", "title"],
      ["jamo:ts-only", "soundHint"],
    ]) {
      assert.deepEqual(rules(base(es({ [id]: { [field]: "x" } }))), [], id);
    }
  });

  test("ids listed by a _*.json registry are not entities of their own", () => {
    const tree = base({ "content/vocab/_senses.json": { groups: [{ members: [{ id: "vocab:registry-only", en: "x" }] }] } });
    assert.deepEqual(rules(new Map([...tree, ...Object.entries(es({ "vocab:registry-only": { gloss: "x" } }))])), ["overlay-unknown-id"]);
    assert.equal(checkOverlayTree(tree).warnings.some((w) => w.file === "content/vocab/_senses.json"), false);
  });

  test("ids in content/fixtures are test data, not translatable content", () => {
    const tree = base({ "content/fixtures/demo.json": { id: "vocab:fixture-only", ko: "가", romanization: "ga", en: "ga" } });
    assert.deepEqual(rules(new Map([...tree, ...Object.entries(es({ "vocab:fixture-only": { gloss: "x" } }))])), ["overlay-unknown-id"]);
  });

  test("a path naming an element the entity does not have fails (option, scene, check, keyword)", () => {
    const at = (entries) => checkOverlayTree(base(es(entries))).violations;
    for (const [id, field] of [
      ["pitem:vocab-hear-gimchi", "options.zzz.gloss"],
      ["story:demo", "scenes.s9.narration"],
      ["story:demo", "checks.c9.prompt"],
      ["story:demo", "checks.c1.options.z"],
      ["story:demo", "keywords.sol.gloss"],
      ["story:demo", "errata.e1.summary"],
    ]) {
      const v = at({ [id]: { [field]: "x" } });
      assert.deepEqual(v.map(ruleOf), ["overlay-unknown-id"], field);
      assert.equal(v[0].path, `entries.${id}.${field}`);
    }
  });
});

describe("overlay-rules: overlay-forbidden-field", () => {
  test("taught Korean, romanization, audio, ids, pictures and anything off the allow-list", () => {
    for (const [id, field] of [
      ["card:gangaji", "romanization"],
      ["card:gangaji", "ko"],
      ["card:gangaji", "titleEn"],
      ["jamo:giyeok", "char"],
      ["jamo:giyeok", "audioRef"],
      ["vocab:sagwa", "visual"],
      ["vocab-topic:food", "gloss"],
      ["pitem:vocab-hear-gimchi", "options.moon.pictureRef"],
      ["pitem:vocab-hear-gimchi", "sound"],
      ["story:demo", "facts.f1.claimKo"],
      ["pitem:vocab-hear-gimchi", "ko"],
      ["pitem:vocab-hear-gimchi", "romanization"],
      ["pitem:vocab-hear-gimchi", "options.moon.ko"],
      ["pitem:vocab-hear-gimchi", "options.moon.sound"],
      ["pitem:vocab-hear-gimchi", "title"],
    ]) {
      assert.deepEqual(rules(base(es({ [id]: { [field]: "x" } }))), ["overlay-forbidden-field"], `${id} ${field}`);
    }
  });
});

describe("overlay-rules: korean-in-ui-field", () => {
  test("Spanish overlays never carry Hangul, in any field", () => {
    const v = checkOverlayTree(base(es({ "vocab:sagwa": { gloss: "manzana 사과" } }))).violations;
    assert.deepEqual(v, [{ file: "content/i18n/es/x.json", path: "entries.vocab:sagwa.gloss", rule: "korean-in-ui-field" }]);
    assert.deepEqual(rules(base(es({ "card:gangaji": { romanization: "강" } }))), ["korean-in-ui-field", "overlay-forbidden-field"]);
  });

  test("a lesson Discover note may carry {ko:} tokens in Spanish, and no Hangul outside them (F-CURR-001 §3.4)", () => {
    const note = "steps.s2.discover.pages.0.items.0.note";
    assert.deepEqual(rules(base(es({ "quest:stage3-nature-q1": { [note]: "Usa {ko:이} tras consonante y {ko:가} tras vocal." } }))), []);
    assert.deepEqual(rules(base(es({ "quest:stage3-nature-q1": { [note]: "Usa 이 tras consonante." } }))), ["korean-in-ui-field"]);
    assert.deepEqual(rules(base(es({ "quest:stage3-nature-q1": { title: "{ko:새} y más" } }))), ["korean-in-ui-field"]);
    // Only a lesson quest's note: the same field on another id is still UI text.
    assert.ok(rules(base(es({ "story:demo": { [note]: "Usa {ko:이}." } }))).includes("korean-in-ui-field"));
  });

  test("a lesson note keeps exactly the {ko:} tokens of its noteEn (overlay-token-mismatch)", () => {
    const note = "steps.s2.discover.pages.0.items.0.note";
    const lessonCell = {
      id: "episode:stage3-nature",
      quests: [
        {
          id: "quest:stage3-nature-q1",
          titleEn: "Where Is the Bird?",
          steps: [{ id: "s2", kind: "discover", discover: { pages: [{ items: [{ type: "pattern", noteEn: "Use {ko:이} after a consonant, {ko:가} after a vowel." }] }] } }],
        },
      ],
    };
    const tree = (value) => base({ "content/episodes/stage-3/nature.json": lessonCell, ...es({ "quest:stage3-nature-q1": { [note]: value } }) });
    assert.deepEqual(rules(tree("{ko:가} tras vocal, {ko:이} tras consonante.")), []);
    assert.deepEqual(rules(tree("Usa {ko:이} tras consonante.")), ["overlay-token-mismatch"]);
    assert.deepEqual(rules(tree("Usa {ko:을} y {ko:가}.")), ["overlay-token-mismatch"]);
  });

  test("Korean overlays carry Hangul in translatable fields only", () => {
    assert.deepEqual(rules(base(ko({ "vocab:sagwa": { gloss: "빨갛고 동그란 과일" }, "vocab:bap": { senseNote: "끼니를 뜻하기도 해요." } }))), []);
    assert.deepEqual(rules(base(ko({ "card:gangaji": { ko: "개" } }))), ["korean-in-ui-field", "overlay-forbidden-field"]);
  });
});

describe("overlay-rules: overlay-circular-gloss", () => {
  test("a Korean gloss equal to the taught word fails; one that only wraps it warns; titles are not glosses", () => {
    assert.deepEqual(rules(base(ko({ "vocab:sagwa": { gloss: "사과" } }))), ["overlay-circular-gloss"]);
    assert.deepEqual(rules(base(ko({ "vocab:sagwa": { gloss: " 사과 " } }))), ["overlay-circular-gloss"]);
    assert.deepEqual(rules(base(ko({ "jamo:giyeok": { "exampleWord.gloss": "강아지" } }))), ["overlay-circular-gloss"]);
    assert.deepEqual(rules(base(ko({ "jamo:giyeok": { gloss: "ㄱ" } }))), ["overlay-circular-gloss"]);
    assert.deepEqual(rules(base(ko({ "story:demo": { "keywords.dal.gloss": "달" } }))), ["overlay-circular-gloss"]);
    const wrapped = checkOverlayTree(base(ko({ "vocab:sagwa": { gloss: "'사과'." } })));
    assert.deepEqual(wrapped.violations, []);
    assert.deepEqual(
      wrapped.warnings.filter((w) => w.rule.startsWith("overlay-circular-gloss")).map((w) => w.path),
      ["entries.vocab:sagwa.gloss"],
    );
    assert.deepEqual(rules(base(ko({ "card:gangaji": { title: "강아지" } }))), []);
    assert.deepEqual(rules(base(es({ "vocab:sagwa": { gloss: "sagwa" } }))), []);
  });
});

describe("overlay-rules: overlay-token-mismatch", () => {
  const narr = (text) => base(es({ "story:demo": { "scenes.s1.narration": text } }));
  test("a translated narration keeps exactly the same {kw:id} tokens, in any order", () => {
    assert.deepEqual(rules(narr("{kw:dal} y {kw:dal}: Hoya los ve.")), []);
    assert.deepEqual(rules(narr("Hoya ve {kw:dal}.")), ["overlay-token-mismatch"]);
    assert.deepEqual(rules(narr("Hoya ve {kw:dal}, {kw:dal} y {kw:dal}.")), ["overlay-token-mismatch"]);
    assert.deepEqual(rules(narr("Hoya ve {kw:sol} y {kw:dal}.")), ["overlay-token-mismatch"]);
    const v = checkOverlayTree(narr("Hoya ve la luna.")).violations[0];
    assert.match(v.rule, /overlay-token-mismatch: .*dal, dal/);
  });
});

describe("overlay-rules: a lesson pattern note keeps its {ko:} tokens (F-CURR-001 section 3.4)", () => {
  const cell = {
    id: "episode:stage3-letters",
    quests: [
      {
        id: "quest:stage3-letters-q2",
        titleEn: "There Is a Book",
        steps: [{ id: "s2", kind: "discover", titleEn: "Look", discover: { pages: [{ items: [{ type: "pattern", noteEn: "Use {ko:이} after a final consonant, {ko:가} after a vowel." }] }] } }],
      },
    ],
  };
  const field = "steps.s2.discover.pages.0.items.0.note";
  const note = (overlayOf, text, id = "quest:stage3-letters-q2") =>
    base({ "content/episodes/stage-3/letters.json": cell, ...overlayOf({ [id]: { [field]: text } }) });

  test("Hangul inside the same {ko:} tokens is taught Korean, in es and ko", () => {
    assert.deepEqual(rules(note(es, "Usa {ko:이} después de una consonante final y {ko:가} después de una vocal.")), []);
    assert.deepEqual(rules(note(ko, "받침 뒤에는 {ko:이}, 모음 뒤에는 {ko:가}를 써요.")), []);
  });

  test("Hangul outside a token is still a UI field, and the tokens must match the English note", () => {
    assert.deepEqual(rules(note(es, "Usa {ko:이} o 가.")), ["korean-in-ui-field", "overlay-token-mismatch"]);
    assert.deepEqual(rules(note(es, "Usa {ko:이}, {ko:가} o {ko:을}.")), ["overlay-token-mismatch"]);
    assert.match(checkOverlayTree(note(ko, "받침 뒤에는 이를 써요.")).violations[0].rule, /overlay-token-mismatch: .*가, 이/);
  });

  test("a token lifts nothing outside a lesson quest's Discover note", () => {
    assert.deepEqual(rules(base(es({ "card:gangaji": { blurb: "Di {ko:강아지}." } }))), ["korean-in-ui-field"]);
  });
});

describe("overlay-rules: banned-on-learner-surface", () => {
  test("the locale's learner list from banned-words.json, token match for es, substring for ko", () => {
    assert.deepEqual(rules(base(es({ "card:gangaji": { blurb: "¡Fallaste!" } }))), ["banned-on-learner-surface"]);
    assert.deepEqual(rules(base(es({ "card:gangaji": { blurb: "Los vencidos" } }))), []);
    assert.deepEqual(rules(base(ko({ "card:gangaji": { blurb: "실패했어요" } }))), ["banned-on-learner-surface"]);
    const v = checkOverlayTree(base(es({ "card:gangaji": { blurb: "Está atrasado" } }))).violations[0];
    assert.equal(v.rule, 'banned-on-learner-surface: "atrasado"');
  });

  test("bannedWordIn reads the shared list for every locale", () => {
    assert.equal(bannedWordIn("You missed it", "en"), "missed");
    assert.equal(bannedWordIn("dismissed", "en"), null);
    assert.equal(bannedWordIn("Ya está vencida", "es"), "vencida");
    assert.equal(bannedWordIn("기한 초과예요", "ko"), "기한 초과");
    assert.equal(bannedWordIn("좋아요", "ko"), null);
    assert.equal(bannedWordIn("anything", "fr"), null);
  });
});

describe("overlay-rules: overlay-missing", () => {
  test("counts the translatable English fields an overlay lacks, per locale, as warnings grouped by base file", () => {
    const result = checkOverlayTree(base(es({ "card:gangaji": { title: "Perrito" } })));
    assert.deepEqual(result.violations, []);
    assert.ok(result.missing.es > 0);
    assert.equal(result.missing.ko, result.missing.es + 1);
    const cardWarning = result.warnings.find((w) => w.file === "content/episodes/stage-1/cards.json" && w.rule.includes("es lacks"));
    assert.match(cardWarning.rule, /^overlay-missing: es lacks 1 translatable field\(s\) of 1 entit/);
    assert.match(cardWarning.rule, /card:gangaji\.blurb/);
    assert.ok(!result.warnings.some((w) => w.rule.includes("card:gangaji.title") && w.rule.includes("es lacks")));
  });

  test("a strict locale turns each missing field into an error at the overlay file holding the entity, else its base file", () => {
    const tree = base(es({ "card:gangaji": { title: "Perrito" } }, "cards"));
    const strict = checkOverlayTree(tree, { strictLocales: ["es"] });
    const missing = strict.violations.filter((v) => ruleOf(v) === "overlay-missing");
    assert.ok(missing.some((v) => v.file === "content/vocab/food.json" && v.path === "vocab:sagwa.gloss"));
    assert.deepEqual(
      missing.filter((v) => v.path.startsWith("card:gangaji")).map((v) => [v.file, v.path]),
      [["content/i18n/es/cards.json", "card:gangaji.blurb"]],
    );
    assert.equal(strict.warnings.filter((w) => w.rule.startsWith("overlay-missing: es")).length, 0);
    assert.ok(strict.warnings.some((w) => w.rule.startsWith("overlay-missing: ko")));
  });

  test("nothing to report without base content or overlays", () => {
    assert.deepEqual(checkOverlayTree(new Map()), { violations: [], warnings: [], missing: { es: 0, ko: 0 } });
  });
});
