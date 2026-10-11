// Self-tests for scripts/import-heritage.mjs (F-STORY-001 PR 1.6).
// mapEpisode is pure; the CLI is exercised through temporary repo roots.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "import-heritage.mjs");
const JAMO_FILE = join(REPO, "content", "episodes", "stage-1", "jamo.json");

const { mapEpisode, scanAdvisories, slugify } = await import(SCRIPT);

const jamo = JSON.parse(readFileSync(JAMO_FILE, "utf8"));
const CLUSTER = {
  cluster: "demo",
  fileDate: "2026-10-10",
  verification: { passes: 3, checked_at: "2026-10-10", notes: "Three passes." },
};

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "importheritage-"));
  roots.push(root);
  mkdirSync(join(root, "content", "episodes", "stage-1"), { recursive: true });
  writeFileSync(join(root, "content", "episodes", "stage-1", "jamo.json"), JSON.stringify(jamo));
  return root;
}
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

// ---- fixtures ---------------------------------------------------------------

const SOURCE = {
  title: "Source",
  publisher: "Korea Heritage Service",
  url: "https://www.heritage.go.kr/x",
  accessed: "2026-10-09",
  quote_or_locator: "a locator",
};
const WORDS = [
  ["사과", "sagwa", "apple"],
  ["바나나", "banana", "banana"],
  ["포도", "podo", "grape"],
  ["딸기", "ttalgi", "strawberry"],
  ["수박", "subak", "watermelon"],
  ["참외", "chamoe", "melon"],
  ["감", "gam", "persimmon"],
  ["배", "bae", "pear"],
];

function sceneOf(n, over = {}) {
  const [ko, rr, en] = WORDS[n - 1];
  return {
    n,
    narration_en: `Scene ${n} says something about fruit.`,
    korean: ko,
    romanization: rr,
    gloss_en: en,
    illustration: `Picture ${n}.`,
    fact_ids: ["f1"],
    ...over,
  };
}
function episodeOf(over = {}) {
  const sceneCount = over.sceneCount ?? 7;
  return {
    id: "story-demo-fruit",
    title_en: "Fruit Day",
    title_ko: "과일의 날",
    theme: "life",
    heritage_type: "documentary",
    recommended_stage: 1,
    minutes: 4,
    summary_en: "A short summary.",
    learning_goals: ["Say 사과 (sagwa).", "Say the fruit names."],
    scenes: Array.from({ length: sceneCount }, (_, i) => sceneOf(i + 1)),
    facts: [
      {
        id: "f1",
        claim_en: "Apples are fruit.",
        claim_ko: "사과는 과일이다.",
        sources: [SOURCE],
      },
    ],
    vocab: [{ ko: "사과", rr: "sagwa", en: "apple" }],
    checks: [1, 2, 3].map((i) => ({
      q_en: `Question ${i}?`,
      options: ["Yes", "No", "Maybe"],
      answer_index: i - 1,
      fact_id: "f1",
    })),
    reference_display: "Sources: 국가유산청",
    notes: "Author notes.",
    ...over,
  };
}
const map = (raw, cluster = CLUSTER, options) => mapEpisode(raw, cluster, jamo, options);
const tierOf = (story) => story.tiers[0];
const keywordOf = (story, ko) => story.keywords.find((k) => k.ko === ko);

describe("mapEpisode: one research field to one story field", () => {
  test("ids, camelCase keys, rr to romanization, defaults materialised", () => {
    const { story } = map(episodeOf());
    assert.equal(story.v, 1);
    assert.equal(story.id, "story:demo-fruit");
    assert.equal(story.state, "draft");
    assert.equal(story.contentVer, 1);
    assert.deepEqual(story.title, { ko: "과일의 날", romanization: "", en: "Fruit Day" });
    assert.equal(story.summaryEn, "A short summary.");
    assert.equal(story.theme, "life");
    assert.equal(story.kind, "documentary");
    assert.equal(story.recommendedStage, 1);
    assert.equal(story.minutes, 4);
    assert.deepEqual(story.learningGoalsEn, ["Say 사과 (sagwa).", "Say the fruit names."]);
    assert.equal(story.referenceDisplay, "Sources: 국가유산청");
    assert.equal(story.authorNotes, "Author notes.");
    assert.deepEqual(story.cultureNotes, []);
    assert.deepEqual(story.pillarTags, []);
    assert.equal(story.companionId, "hoya");
    assert.deepEqual(story.errata, []);
    assert.equal(story.shelf, undefined);
    assert.equal(story.card, undefined);
    assert.deepEqual(story.facts[0], {
      id: "f1",
      rev: 1,
      scope: "documented",
      claimEn: "Apples are fruit.",
      claimKo: "사과는 과일이다.",
      sources: [
        {
          title: "Source",
          publisher: "Korea Heritage Service",
          url: "https://www.heritage.go.kr/x",
          accessed: "2026-10-09",
          quoteOrLocator: "a locator",
        },
      ],
    });
    assert.deepEqual(story.keywords[0], {
      id: "sagwa",
      ko: "사과",
      romanization: "sagwa",
      en: "apple",
      kind: "word",
    });
  });

  test("the single tier is a listen tier; scenes keep the research order and the illustration becomes artBrief", () => {
    const { story } = map(episodeOf());
    assert.equal(story.tiers.length, 1);
    assert.equal(tierOf(story).level, "listen");
    assert.deepEqual(
      tierOf(story).scenes.map((s) => s.id),
      ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]
    );
    const s2 = tierOf(story).scenes[1];
    assert.equal(s2.artBrief, "Picture 2.");
    assert.deepEqual(s2.factIds, ["f1"]);
    assert.equal(s2.framing, false);
    assert.deepEqual(s2.approximations, []);
    assert.deepEqual(Object.keys(s2), [
      "id",
      "narrationEn",
      "keyword",
      "factIds",
      "framing",
      "approximations",
      "artBrief",
    ]);
  });

  test("a scene with no fact_ids is a framing scene", () => {
    const raw = episodeOf();
    raw.scenes[0].fact_ids = [];
    const { story } = map(raw);
    assert.equal(tierOf(story).scenes[0].framing, true);
    assert.deepEqual(tierOf(story).scenes[0].factIds, []);
    assert.equal(tierOf(story).scenes[1].framing, false);
  });

  test("derived defaults: cover, sequence (first, 1/3, 2/3, last) and the review block", () => {
    const seven = map(episodeOf({ sceneCount: 7 })).story;
    assert.equal(seven.coverSceneId, "s1");
    assert.deepEqual(tierOf(seven).sequenceSceneIds, ["s1", "s3", "s5", "s7"]);
    const eight = map(episodeOf({ sceneCount: 8 })).story;
    assert.deepEqual(tierOf(eight).sequenceSceneIds, ["s1", "s3", "s6", "s8"]);
    assert.equal(seven.review.language, "draft");
    assert.equal(seven.review.culture, "draft");
    assert.deepEqual(seven.review.advisory, []);
    assert.equal(seven.review.advisoryNoteEn, undefined);
  });

  test("newKeywordIds: the first four vocab keywords that are a scene focus, in scene order", () => {
    const raw = episodeOf({
      vocab: WORDS.slice(0, 6).map(([ko, rr, en]) => ({ ko, rr, en })),
    });
    // scene 2 (banana) is not in vocab-first order: shuffle vocab to prove scene order wins
    raw.vocab.reverse();
    const { story } = map(raw);
    assert.deepEqual(tierOf(story).newKeywordIds, ["sagwa", "banana", "podo", "ttalgi"]);
    const none = map(episodeOf({ vocab: [{ ko: "배", rr: "bae", en: "pear" }] })).story;
    assert.deepEqual(tierOf(none).newKeywordIds, []);
  });

  test("heritage_type maps to kind; folk-tale is traditional, the rest documented", () => {
    for (const type of ["documentary", "site", "intangible", "object", "science", "art"]) {
      const { story } = map(episodeOf({ heritage_type: type }));
      assert.equal(story.kind, type);
      assert.equal(story.origin.type, "documented");
      assert.equal(story.origin.retellingNoteEn, undefined);
      assert.ok(story.origin.noteEn.length > 0);
    }
    const tale = map(episodeOf({ heritage_type: "folk-tale" })).story;
    assert.equal(tale.kind, "folk-tale");
    assert.equal(tale.origin.type, "traditional");
    assert.match(tale.origin.retellingNoteEn, /gentler/);
    assert.deepEqual(tale.review.advisory, ["mild-peril", "trickery"]);
    assert.ok(tale.review.advisoryNoteEn.length > 0 && tale.review.advisoryNoteEn.length <= 140);
    assert.throws(() => map(episodeOf({ heritage_type: "poem" })), /heritage_type/);
  });

  test("fact scope: folk-tale facts are in-the-tale unless they carry a year, UNESCO, designated or National", () => {
    const raw = episodeOf({ heritage_type: "folk-tale" });
    const claims = [
      "A tiger meets a mother on the road.",
      "The tale was told in 1900.",
      "UNESCO listed the tradition.",
      "It was designated a heritage item.",
      "It is a National Intangible Heritage.",
    ];
    raw.facts = claims.map((claim, i) => ({
      id: `f${i + 1}`,
      claim_en: claim,
      claim_ko: "주장",
      sources: [SOURCE],
    }));
    raw.scenes.forEach((s) => (s.fact_ids = ["f1"]));
    const { story, report } = map(raw);
    assert.deepEqual(
      story.facts.map((f) => f.scope),
      ["in-the-tale", "documented", "documented", "documented", "documented"]
    );
    assert.deepEqual(report.taleScope, [{ factId: "f1", scope: "in-the-tale" }]);
    const documentary = map(episodeOf()).story;
    assert.equal(documentary.facts[0].scope, "documented");
  });

  test("verification: the cluster record is copied with scope cluster", () => {
    const { story } = map(episodeOf());
    assert.deepEqual(story.verification, {
      passes: 3,
      checkedAt: "2026-10-10",
      scope: "cluster",
      notes: "Three passes.",
    });
  });

  test("a cluster file without a verification record imports as passes 0", () => {
    const { story } = map(episodeOf(), { cluster: "demo", fileDate: "2026-10-08" });
    assert.deepEqual(story.verification, {
      passes: 0,
      checkedAt: "2026-10-08",
      scope: "cluster",
      notes: "Imported from a file with no recorded verification pass.",
    });
  });

  test("an unfinal cluster file imports with passes 0 but keeps its notes", () => {
    const { story } = map(episodeOf(), { ...CLUSTER, unfinal: true });
    assert.equal(story.verification.passes, 0);
    assert.equal(story.verification.checkedAt, "2026-10-10");
    assert.equal(story.verification.notes, "Three passes.");
  });

  test("refuses a research episode that is not shaped like the research files", () => {
    assert.throws(() => map({ ...episodeOf(), id: "demo" }), /story-/);
    assert.throws(() => map({ ...episodeOf(), scenes: "no" }), /scenes/);
    assert.throws(() => map(null), /episode/);
    const noN = episodeOf();
    delete noN.scenes[0].n;
    assert.throws(() => map(noN), /scene/);
  });
});

describe("mapEpisode: keywords and the keyword / line split", () => {
  test("ids come from the romanization, lower-cased; a collision gets a -2 suffix", () => {
    const raw = episodeOf({
      vocab: [
        { ko: "세종대왕", rr: "Sejong Daewang", en: "King Sejong the Great" },
        { ko: "세종", rr: "Sejong  Daewang", en: "Sejong" },
        { ko: "한글", rr: "Hangeul", en: "the Korean alphabet" },
      ],
    });
    const { story } = map(raw);
    assert.deepEqual(
      story.keywords.slice(0, 3).map((k) => k.id),
      ["sejong-daewang", "sejong-daewang-2", "hangeul"]
    );
  });

  test("scene Korean that is not in vocab is appended to keywords[]", () => {
    const { story } = map(episodeOf());
    assert.deepEqual(
      story.keywords.map((k) => k.ko),
      ["사과", "바나나", "포도", "딸기", "수박", "참외", "감"]
    );
    assert.equal(keywordOf(story, "바나나").romanization, "banana");
  });

  test("a vocab word that no scene focuses stays in the glossary", () => {
    const raw = episodeOf({ vocab: [{ ko: "복숭아", rr: "boksunga", en: "peach" }] });
    const { story } = map(raw);
    assert.ok(keywordOf(story, "복숭아"));
  });

  test("the scene keeps its own gloss and capitalisation; keywords[] keeps the vocab entry", () => {
    const raw = episodeOf({
      vocab: [{ ko: "사과", rr: "Sagwa", en: "apple" }],
    });
    raw.scenes[0].gloss_en = "an apple (the fruit)";
    raw.scenes[0].romanization = "sagwa";
    const { story } = map(raw);
    assert.equal(keywordOf(story, "사과").en, "apple");
    assert.equal(keywordOf(story, "사과").romanization, "Sagwa");
    const sceneKeyword = tierOf(story).scenes[0].keyword;
    assert.deepEqual(sceneKeyword, {
      id: "sagwa",
      ko: "사과",
      romanization: "sagwa",
      en: "an apple (the fruit)",
      kind: "word",
    });
  });

  test("a sentence (ends . ? ! or has 3+ words) is a line, a single term or pair is a keyword", () => {
    const raw = episodeOf();
    raw.scenes[0].korean = "고마워요!";
    raw.scenes[0].romanization = "Gomawoyo!";
    raw.scenes[0].gloss_en = "Thank you!";
    raw.scenes[1].korean = "하늘, 땅, 사람";
    raw.scenes[1].romanization = "haneul, ttang, saram";
    raw.scenes[1].gloss_en = "sky, earth, person";
    raw.scenes[2].korean = "자음과 모음";
    raw.scenes[2].romanization = "jaeumgwa moeum";
    raw.scenes[2].gloss_en = "consonants and vowels";
    raw.scenes[3].korean = "왜 기록할까요?";
    raw.scenes[3].romanization = "Wae girokalkkayo?";
    raw.scenes[3].gloss_en = "Why do we keep records?";
    const { story } = map(raw);
    const scenes = tierOf(story).scenes;
    assert.deepEqual(scenes[0].line, {
      ko: "고마워요!",
      romanization: "Gomawoyo!",
      en: "Thank you!",
      speaker: "narrator",
    });
    assert.equal(scenes[0].keyword, undefined);
    assert.ok(scenes[1].line, "a 3-word list is a line");
    assert.equal(scenes[2].keyword.ko, "자음과 모음", "two words stay a keyword");
    assert.ok(scenes[3].line);
    assert.equal(scenes[4].line, undefined);
    assert.equal(scenes[4].keyword.ko, "수박");
    // a line's text is also a phrase keyword so the one keyword list stays complete
    assert.equal(keywordOf(story, "고마워요!").kind, "phrase");
    assert.equal(keywordOf(story, "하늘, 땅, 사람").kind, "phrase");
    assert.equal(keywordOf(story, "자음과 모음").kind, "word");
  });

  test("a vocab entry whose text is a sentence is a phrase keyword too", () => {
    const raw = episodeOf({ vocab: [{ ko: "고마워요!", rr: "Gomawoyo!", en: "Thank you!" }] });
    const { story } = map(raw);
    assert.equal(keywordOf(story, "고마워요!").kind, "phrase");
  });

  test("isolated jamo are keywords of kind jamo with the id jamo-<sound>", () => {
    const raw = episodeOf();
    raw.scenes[0].korean = "ㄱ";
    raw.scenes[0].romanization = "giyeok";
    raw.scenes[0].gloss_en = "giyeok, the letter for the g/k sound";
    const { story } = map(raw);
    const k = keywordOf(story, "ㄱ");
    assert.equal(k.kind, "jamo");
    assert.equal(k.id, "jamo-g");
    assert.equal(k.romanization, "giyeok");
    assert.equal(tierOf(story).scenes[0].keyword.id, "jamo-g");
  });

  test("a romanization hyphen is removed (Revised Romanization is unhyphenated)", () => {
    const raw = episodeOf();
    raw.scenes[0].romanization = "Jang Yeong-sil";
    const { story, report } = map(raw);
    assert.equal(tierOf(story).scenes[0].keyword.romanization, "Jang Yeongsil");
    assert.equal(keywordOf(story, "사과").romanization, "sagwa");
    assert.equal(report.resolved.filter((r) => r.kind === "romanization-hyphen").length, 1);
    const kept = map(raw, CLUSTER, { resolve: false }).story;
    assert.equal(tierOf(kept).scenes[0].keyword.romanization, "Jang Yeong-sil");
  });

  test("slugify makes ids from romanizations", () => {
    assert.equal(slugify("Sejong Daewang"), "sejong-daewang");
    assert.equal(slugify("do, gae, geol"), "do-gae-geol");
    assert.equal(slugify("  Wae girokalkkayo? "), "wae-girokalkkayo");
    assert.equal(slugify("???"), "");
  });
});

describe("mapEpisode: Hangul in narration becomes {kw:id} tokens (section 3.4)", () => {
  test("a word that is in the vocab becomes its token", () => {
    const raw = episodeOf();
    raw.scenes[0].narration_en = "These are the 사과, the apples.";
    const { story } = map(raw);
    assert.equal(tierOf(story).scenes[0].narrationEn, "These are the {kw:sagwa}, the apples.");
  });

  test("resolution order: vocab, then scene Korean, then jamo.json", () => {
    const raw = episodeOf({ vocab: [{ ko: "사과", rr: "Vocab Form", en: "apple (vocab)" }] });
    raw.scenes[0].narration_en = "The 사과, the 바나나 and ㄴ.";
    const { story, report } = map(raw);
    assert.equal(
      tierOf(story).scenes[0].narrationEn,
      "The {kw:vocab-form}, the {kw:banana} and {kw:jamo-n}."
    );
    const n = keywordOf(story, "ㄴ");
    assert.deepEqual(
      { kind: n.kind, romanization: n.romanization, en: n.en },
      { kind: "jamo", romanization: "n", en: "the consonant letter nieun" }
    );
    assert.deepEqual(report.unresolvedTerms, []);
  });

  test("the longest span wins: a quoted phrase is one token and its end punctuation is part of it", () => {
    const raw = episodeOf();
    raw.scenes[0].korean = "지금 몇 시예요?";
    raw.scenes[0].romanization = "jigeum myeot siyeyo?";
    raw.scenes[0].gloss_en = "What time is it now?";
    raw.scenes[0].narration_en = 'Hoya asks, "지금 몇 시예요?" That means, "What time is it now?"';
    const { story } = map(raw);
    assert.equal(
      tierOf(story).scenes[0].narrationEn,
      'Hoya asks, "{kw:jigeum-myeot-siyeyo}" That means, "What time is it now?"'
    );
    assert.equal(keywordOf(story, "지금 몇 시예요?").kind, "phrase");
  });

  test("a phrase quoted without its end punctuation still resolves to the phrase", () => {
    const raw = episodeOf();
    raw.scenes[0].korean = "비가 와요!";
    raw.scenes[0].romanization = "biga wayo!";
    raw.scenes[0].gloss_en = "It is raining!";
    raw.scenes[0].narration_en = "Say 비가 와요 when it rains.";
    const { story } = map(raw);
    assert.equal(tierOf(story).scenes[0].narrationEn, "Say {kw:biga-wayo} when it rains.");
  });

  test("a span that is not one keyword is split word by word; a jamo list becomes adjacent tokens", () => {
    const raw = episodeOf();
    raw.scenes[0].narration_en = "The five letters, ㄱ ㄴ ㅁ ㅅ ㅇ, copy the body.";
    raw.scenes[1].narration_en = "Both 사과 바나나 are fruit.";
    const { story } = map(raw);
    assert.equal(
      tierOf(story).scenes[0].narrationEn,
      "The five letters, {kw:jamo-g} {kw:jamo-n} {kw:jamo-m} {kw:jamo-s} {kw:jamo-silent-ng}, copy the body."
    );
    assert.equal(tierOf(story).scenes[1].narrationEn, "Both {kw:sagwa} {kw:banana} are fruit.");
    for (const ko of ["ㄱ", "ㄴ", "ㅁ", "ㅅ", "ㅇ"]) assert.equal(keywordOf(story, ko).kind, "jamo");
  });

  test("a term that matches nothing is reported and gets a term keyword with an empty romanization", () => {
    const raw = episodeOf();
    raw.scenes[2].narration_en = "The 허준 wrote it, and 허준 is famous.";
    raw.scenes[3].narration_en = "Then came 수원화성문화제 and 낯선말.";
    const { story, report } = map(raw);
    assert.equal(
      tierOf(story).scenes[2].narrationEn,
      "The {kw:heo-jun} wrote it, and {kw:heo-jun} is famous."
    );
    const heo = keywordOf(story, "허준");
    assert.deepEqual(heo, { id: "heo-jun", ko: "허준", romanization: "", en: "", kind: "term" });
    assert.match(tierOf(story).scenes[3].narrationEn, /\{kw:suwon-hwaseong-munhwaje\} and \{kw:term-1\}\./);
    assert.deepEqual(
      report.unresolvedTerms.map((t) => [t.ko, t.id, t.scene]),
      [
        ["허준", "heo-jun", 3],
        ["수원화성문화제", "suwon-hwaseong-munhwaje", 4],
        ["낯선말", "term-1", 4],
      ]
    );
  });

  test("a narration with no Hangul is unchanged", () => {
    const { story } = map(episodeOf());
    assert.equal(tierOf(story).scenes[0].narrationEn, "Scene 1 says something about fruit.");
  });
});

describe("mapEpisode: the known lint classes of section 3.14 are resolved as the spec says", () => {
  const sourceWithHttp = (url) => ({ ...SOURCE, url });

  test("the one http:// source is upgraded to the same page over https and reported", () => {
    const raw = episodeOf();
    const http = "http://treestory.forest.or.kr/v1/bbs/bbs.php?cmd=view&board_name=b44&bid=672&curpage=1&count=y";
    raw.facts[0].sources = [SOURCE, sourceWithHttp(http)];
    const { story, report } = map(raw);
    assert.equal(story.facts[0].sources[1].url, http.replace("http:", "https:"));
    assert.deepEqual(report.resolved.filter((r) => r.kind === "source-url-https").map((r) => r.where), [
      "facts[0].sources[1].url",
    ]);
    assert.equal(story.facts[0].sources.length, 2, "no source is dropped");
    const raw2 = map(raw, CLUSTER, { resolve: false }).story;
    assert.equal(raw2.facts[0].sources[1].url, http);
  });

  test("any other http:// URL is left as written and flagged for the author", () => {
    const raw = episodeOf();
    raw.facts[0].sources = [SOURCE, sourceWithHttp("http://example.go.kr/page")];
    const { story, report } = map(raw);
    assert.equal(story.facts[0].sources[1].url, "http://example.go.kr/page");
    assert.deepEqual(report.flags.filter((f) => f.rule === "source-url-not-https").map((f) => f.where), [
      "facts[0].sources[1].url",
    ]);
  });

  test("a gloss with Hangul takes the vocab gloss of the same word when that has none", () => {
    const raw = episodeOf({ vocab: [{ ko: "사과", rr: "sagwa", en: "apple; also 'forgiveness'" }] });
    raw.scenes[0].gloss_en = "apple (사과 can also mean 'forgiveness')";
    const { story, report } = map(raw);
    assert.equal(tierOf(story).scenes[0].keyword.en, "apple; also 'forgiveness'");
    assert.deepEqual(report.resolved.filter((r) => r.kind === "gloss-hangul").map((r) => r.where), [
      "tiers[0].scenes[0].keyword.en",
    ]);
    const kept = map(raw, CLUSTER, { resolve: false }).story;
    assert.match(tierOf(kept).scenes[0].keyword.en, /사과/);
  });

  test("without a clean vocab gloss the parenthetical that holds the Hangul is dropped", () => {
    const raw = episodeOf({ vocab: [] });
    raw.scenes[1].gloss_en = "banana (Koreans say 바나나)";
    const { story } = map(raw);
    assert.equal(tierOf(story).scenes[1].keyword.en, "banana");
  });

  test("a gloss that cannot be cleaned is flagged, not guessed", () => {
    const raw = episodeOf({ vocab: [] });
    raw.scenes[1].gloss_en = "바나나 means banana";
    const { story, report } = map(raw);
    assert.equal(tierOf(story).scenes[1].keyword.en, "바나나 means banana");
    assert.deepEqual(report.flags.filter((f) => f.rule === "gloss-contains-hangul").length, 1);
  });

  // The four derived-number sentences of the research set (F-STORY-001 section 1).
  const numbers = [
    {
      id: "story-sejong-new-letters",
      n: 1,
      narration: "We land in Joseon, Korea, almost 600 years ago. Here lived King Sejong.",
      claims: ["King Sejong reigned from 1418 to 1450.", "In 1443, King Sejong created 28 letters."],
      text: "almost 600 years",
      factIds: ["f2"],
      timeRelative: true,
    },
    {
      id: "story-sillok-mountain-archives",
      n: 4,
      narration: "During a great war in the 1590s, the copies were lost.",
      claims: ["The Imjin War began in 1592 and the copies were lost."],
      text: "1590s",
      factIds: ["f1"],
      timeRelative: false,
    },
    {
      id: "story-joseon-records-today",
      n: 5,
      narration: "Weather notes were written day after day for nearly 300 years.",
      claims: ["The diary recorded the weather daily over 288 years (1623-1910)."],
      text: "nearly 300 years",
      factIds: ["f1"],
      timeRelative: false,
    },
    {
      id: "story-tripitaka-koreana",
      n: 8,
      narration: "Almost 800 years later, the blocks are still kept safe at Haeinsa.",
      claims: ["The blocks are kept at Haeinsa.", "They were carved between 1237 and 1248."],
      text: "Almost 800 years",
      factIds: ["f2"],
      timeRelative: true,
    },
  ];
  for (const c of numbers) {
    test(`${c.id} scene ${c.n}: "${c.text}" gets an approximations entry from the fact it derives from`, () => {
      const raw = episodeOf({ id: c.id, sceneCount: 8 });
      raw.facts = c.claims.map((claim, i) => ({
        id: `f${i + 1}`,
        claim_en: claim,
        claim_ko: "주장",
        sources: [SOURCE, SOURCE],
      }));
      const scene = raw.scenes[c.n - 1];
      scene.narration_en = c.narration;
      scene.fact_ids = raw.facts.map((f) => f.id);
      const { story, report } = map(raw);
      const approximations = tierOf(story).scenes[c.n - 1].approximations;
      assert.equal(approximations.length, 1);
      assert.equal(approximations[0].text, c.text);
      assert.ok(tierOf(story).scenes[c.n - 1].narrationEn.includes(c.text));
      assert.deepEqual(approximations[0].factIds, c.factIds);
      assert.equal(approximations[0].timeRelative, c.timeRelative);
      assert.ok(approximations[0].rationaleEn.length > 0 && approximations[0].rationaleEn.length <= 160);
      assert.equal(report.resolved.filter((r) => r.kind === "approximation").length, 1);
      const kept = map(raw, CLUSTER, { resolve: false }).story;
      assert.deepEqual(tierOf(kept).scenes[c.n - 1].approximations, []);
    });
  }

  test("a derived number whose supporting fact is not cited stays unmarked and is flagged", () => {
    const raw = episodeOf({ id: "story-sejong-new-letters", sceneCount: 7 });
    raw.scenes[0].narration_en = "We land in Joseon, almost 600 years ago.";
    const { story, report } = map(raw);
    assert.deepEqual(tierOf(story).scenes[0].approximations, []);
    assert.deepEqual(report.flags.filter((f) => f.rule === "approximation-source-missing").map((f) => f.where), [
      "tiers[0].scenes[0]",
    ]);
  });

  test("a derived number whose narration changed is flagged, not applied", () => {
    const raw = episodeOf({ id: "story-sejong-new-letters", sceneCount: 7 });
    raw.facts[0].claim_en = "In 1443, King Sejong created 28 letters.";
    raw.scenes[0].narration_en = "We land in Joseon about six hundred years ago.";
    const { report } = map(raw);
    assert.deepEqual(report.flags.filter((f) => f.rule === "approximation-text-missing").length, 1);
  });
});

describe("mapEpisode: checks", () => {
  test("options become a..d with one isCorrect; fact_id becomes factIds; no explainEn in a draft", () => {
    const raw = episodeOf();
    raw.checks[0].options = ["A", "B", "C", "D"];
    raw.checks[0].answer_index = 3;
    const { story } = map(raw);
    const check = tierOf(story).checks[0];
    assert.deepEqual(check, {
      id: "c1",
      kind: "detail",
      promptEn: "Question 1?",
      options: [
        { id: "a", en: "A", isCorrect: false },
        { id: "b", en: "B", isCorrect: false },
        { id: "c", en: "C", isCorrect: false },
        { id: "d", en: "D", isCorrect: true },
      ],
      factIds: ["f1"],
    });
    assert.deepEqual(tierOf(story).checkpoints, []);
    assert.equal(tierOf(story).checks.length, 3);
    assert.equal(tierOf(story).checks[1].options.length, 3);
  });

  test("Hangul in a prompt is lifted to target + {target}; a trailing Latin parenthetical moves into the target", () => {
    const raw = episodeOf();
    raw.checks[0].q_en = "What is 사과 (sagwa)?";
    raw.checks[1].q_en = "Who ate the fruit called 바나나 yesterday?";
    raw.checks[2].q_en = "Which one is ㅁ?";
    const { story, report } = map(raw);
    const [c1, c2, c3] = tierOf(story).checks;
    assert.equal(c1.promptEn, "What is {target}?");
    assert.equal(c1.kind, "pick-meaning");
    assert.deepEqual(c1.target, { ko: "사과", romanization: "sagwa", en: "apple" });
    assert.equal(c2.promptEn, "Who ate the fruit called {target} yesterday?");
    assert.equal(c2.kind, "detail");
    assert.deepEqual(c2.target, { ko: "바나나", romanization: "banana", en: "banana" });
    assert.equal(c3.promptEn, "Which one is {target}?");
    assert.deepEqual(c3.target, { ko: "ㅁ", romanization: "m", en: "the consonant letter mieum" });
    assert.equal(report.resolved.filter((r) => r.kind === "check-target").length, 3);
  });

  test("a second isolated jamo in the prompt is written as its letter name (one {target} per prompt)", () => {
    const raw = episodeOf();
    raw.checks[0].q_en = "How do you get ㄷ from ㄴ?";
    const { story } = map(raw);
    const check = tierOf(story).checks[0];
    assert.equal(check.promptEn, "How do you get {target} from the letter nieun?");
    assert.deepEqual(check.target, { ko: "ㄷ", romanization: "d", en: "the consonant letter digeut" });
  });

  test("the target of a prompt in parentheses keeps the parentheses", () => {
    const raw = episodeOf();
    raw.checks[0].q_en = "Who could read the notes (사과)?";
    const { story } = map(raw);
    assert.equal(tierOf(story).checks[0].promptEn, "Who could read the notes ({target})?");
  });

  test("a Hangul-only option becomes a ko option with the jamo romanization and name", () => {
    const raw = episodeOf();
    raw.checks[0].options = ["·", "ㅣ", "ㅡ", "ㅏ"];
    raw.checks[0].answer_index = 1;
    const { story } = map(raw);
    assert.deepEqual(tierOf(story).checks[0].options, [
      { id: "a", en: "·", isCorrect: false },
      { id: "b", ko: "ㅣ", romanization: "i", en: "the vowel letter i", isCorrect: true },
      { id: "c", ko: "ㅡ", romanization: "eu", en: "the vowel letter eu", isCorrect: false },
      { id: "d", ko: "ㅏ", romanization: "a", en: "the vowel letter a", isCorrect: false },
    ]);
  });

  test("a prompt or option with Hangul that the importer cannot place stops the import with a clear message", () => {
    const unknownTarget = episodeOf();
    unknownTarget.checks[0].q_en = "What is 낯선말?";
    assert.throws(() => map(unknownTarget), /check 1.*낯선말/);
    const twoTargets = episodeOf();
    twoTargets.checks[0].q_en = "Is 사과 or 바나나 a fruit?";
    assert.throws(() => map(twoTargets), /check 1.*one Korean/);
    const badOption = episodeOf();
    badOption.checks[0].options = ["Yes", "사과가 좋아요", "Maybe"];
    assert.throws(() => map(badOption), /check 1.*option/);
    const noAnswer = episodeOf();
    noAnswer.checks[0].answer_index = 7;
    assert.throws(() => map(noAnswer), /answer_index/);
  });
});

describe("scanAdvisories: a keyword scan the author accepts or clears", () => {
  const scenes = (...texts) => texts.map((narration_en, i) => ({ n: i + 1, narration_en }));

  test("war and loss words propose advisories and name the scenes", () => {
    const scan = scanAdvisories(
      scenes(
        "A quiet morning.",
        "During the Imjin War the copies were lost.",
        "The Mongol army invaded Goryeo.",
        "When a king died, an office opened.",
        "The temple was lost in a fire."
      )
    );
    assert.deepEqual(scan.advisory, ["war", "loss"]);
    assert.deepEqual(scan.scenes, [2, 3, 4, 5]);
    assert.ok(scan.noteEn.length > 0 && scan.noteEn.length <= 140);
  });

  test("a story with none of those words proposes nothing", () => {
    const scan = scanAdvisories(scenes("A quiet morning.", "Soldiers? No, only tea."));
    assert.deepEqual(scan, { advisory: [], scenes: [], noteEn: undefined });
  });

  test("the advisory comes through mapEpisode with its note", () => {
    const raw = episodeOf();
    raw.scenes[2].narration_en = "Then came the war.";
    const { story, report } = map(raw);
    assert.deepEqual(story.review.advisory, ["war"]);
    assert.ok(story.review.advisoryNoteEn);
    assert.deepEqual(report.advisoryScenes, [3]);
  });
});

describe("report", () => {
  test("counts what the author still has to write", () => {
    const { report } = map(episodeOf());
    assert.equal(report.id, "story:demo-fruit");
    assert.deepEqual(report.counts, { scenes: 7, facts: 1, sources: 1, keywords: 7, checks: 3 });
    assert.deepEqual(report.todo, {
      captionEn: 7,
      explainEn: 3,
      art: 7,
      titleRomanization: 1,
      termGlosses: 0,
    });
    assert.deepEqual(report.defaulted.sort(), ["coverSceneId", "newKeywordIds", "sequenceSceneIds"]);
  });
});

// ---- CLI ----------------------------------------------------------------------

function run(root, args = []) {
  return spawnSync("node", [SCRIPT, ...args], {
    env: { ...process.env, HANGUL_ROUTE_ROOT: root },
    encoding: "utf8",
  });
}

function putSource(dir, name, cluster, episodes, verification) {
  mkdirSync(dir, { recursive: true });
  const doc = { cluster, episodes };
  if (verification !== undefined) doc.verification = verification;
  writeFileSync(join(dir, name), JSON.stringify(doc));
}

function sourceDir(root) {
  const dir = join(root, "src");
  putSource(
    dir,
    "demo.final.json",
    "demo",
    [episodeOf(), episodeOf({ id: "story-demo-two", title_en: "Two" })],
    { passes: 3, checked_at: "2026-10-10", notes: "Three passes." }
  );
  return dir;
}

describe("CLI", () => {
  test("--dry-run reports the counts and writes nothing", () => {
    const root = makeRoot();
    const src = sourceDir(root);
    const r = run(root, ["--src", src, "--dry-run"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /demo\.final\.json/);
    assert.match(r.stdout, /2 stories, 14 scenes, 2 facts, 2 sources/);
    assert.match(r.stdout, /dry run/i);
    assert.equal(existsSync(join(root, "content", "stories")), false);
  });

  test("without --write the run is a dry run too", () => {
    const root = makeRoot();
    const r = run(root, ["--src", sourceDir(root)]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(existsSync(join(root, "content", "stories", "demo-fruit.json")), false);
  });

  test("--write writes content/stories/<slug>.json as draft, two-space JSON with a trailing newline", () => {
    const root = makeRoot();
    const r = run(root, ["--src", sourceDir(root), "--write"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const text = readFileSync(join(root, "content", "stories", "demo-fruit.json"), "utf8");
    assert.ok(text.endsWith("}\n"));
    const story = JSON.parse(text);
    assert.equal(story.state, "draft");
    assert.equal(story.id, "story:demo-fruit");
    assert.equal(text, JSON.stringify(story, null, 2) + "\n");
    assert.ok(existsSync(join(root, "content", "stories", "demo-two.json")));
  });

  test("--dry-run with --write is a usage error", () => {
    const root = makeRoot();
    const r = run(root, ["--src", sourceDir(root), "--dry-run", "--write"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--dry-run/);
  });

  test("a missing --src or an unknown flag is a usage error", () => {
    const root = makeRoot();
    assert.equal(run(root, ["--write"]).status, 2);
    assert.equal(run(root, ["--src", join(root, "nowhere")]).status, 2);
    assert.equal(run(root, ["--src", sourceDir(root), "--nope"]).status, 2);
  });

  test("it refuses to overwrite an existing story and writes nothing at all", () => {
    const root = makeRoot();
    const src = sourceDir(root);
    const dir = join(root, "content", "stories");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "demo-two.json"), JSON.stringify({ state: "draft", contentVer: 1, authored: true }));
    const r = run(root, ["--src", src, "--write"]);
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.match(r.stderr, /demo-two\.json.*exists/);
    assert.equal(existsSync(join(dir, "demo-fruit.json")), false);
    assert.equal(JSON.parse(readFileSync(join(dir, "demo-two.json"), "utf8")).authored, true);
  });

  test("--force-draft overwrites a story that is still a draft at contentVer 1, and only that", () => {
    const root = makeRoot();
    const src = sourceDir(root);
    const dir = join(root, "content", "stories");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "demo-two.json"), JSON.stringify({ state: "draft", contentVer: 1, authored: true }));
    const ok = run(root, ["--src", src, "--write", "--force-draft"]);
    assert.equal(ok.status, 0, ok.stderr + ok.stdout);
    assert.equal(JSON.parse(readFileSync(join(dir, "demo-two.json"), "utf8")).id, "story:demo-two");

    writeFileSync(join(dir, "demo-two.json"), JSON.stringify({ state: "draft", contentVer: 2 }));
    assert.equal(run(root, ["--src", src, "--write", "--force-draft"]).status, 1);
    writeFileSync(join(dir, "demo-two.json"), JSON.stringify({ state: "ready", contentVer: 1 }));
    assert.equal(run(root, ["--src", src, "--write", "--force-draft"]).status, 1);
    writeFileSync(join(dir, "demo-two.json"), "{ not json");
    assert.equal(run(root, ["--src", src, "--write", "--force-draft"]).status, 1);
  });

  test("a .revised.json or .draft.json cluster is refused unless --allow-unfinal", () => {
    const root = makeRoot();
    const src = join(root, "src");
    putSource(src, "later.revised.json", "later", [episodeOf({ id: "story-later-one" })], {
      passes: 2,
      checked_at: "2026-10-10",
      notes: "Two passes.",
    });
    putSource(src, "wip.draft.json", "wip", [episodeOf({ id: "story-wip-one" })]);
    const refused = run(root, ["--src", src, "--write"]);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /later\.revised\.json.*--allow-unfinal/);
    assert.equal(existsSync(join(root, "content", "stories")), false);

    const allowed = run(root, ["--src", src, "--write", "--allow-unfinal"]);
    assert.equal(allowed.status, 0, allowed.stderr + allowed.stdout);
    const story = JSON.parse(readFileSync(join(root, "content", "stories", "later-one.json"), "utf8"));
    assert.equal(story.verification.passes, 0);
    assert.equal(story.verification.scope, "cluster");
  });

  test("a final file wins over a revised file of the same cluster", () => {
    const root = makeRoot();
    const src = sourceDir(root);
    putSource(src, "demo.revised.json", "demo", [episodeOf({ id: "story-stale-one" })]);
    const r = run(root, ["--src", src, "--write"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(existsSync(join(root, "content", "stories", "stale-one.json")), false);
  });

  test("a cluster file without a verification record imports with passes 0", () => {
    const root = makeRoot();
    const src = join(root, "src");
    putSource(src, "bare.final.json", "bare", [episodeOf({ id: "story-bare-one" })]);
    assert.equal(run(root, ["--src", src, "--write"]).status, 0);
    const story = JSON.parse(readFileSync(join(root, "content", "stories", "bare-one.json"), "utf8"));
    assert.equal(story.verification.passes, 0);
    assert.match(story.verification.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("an empty source directory, invalid JSON and a duplicate story id are errors", () => {
    const root = makeRoot();
    const empty = join(root, "empty");
    mkdirSync(empty);
    assert.equal(run(root, ["--src", empty]).status, 2);

    const bad = join(root, "bad");
    mkdirSync(bad);
    writeFileSync(join(bad, "x.final.json"), "{ nope");
    const r = run(root, ["--src", bad]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /x\.final\.json/);

    const dup = join(root, "dup");
    putSource(dup, "a.final.json", "a", [episodeOf()], { passes: 3, checked_at: "2026-10-10", notes: "n" });
    putSource(dup, "b.final.json", "b", [episodeOf()], { passes: 3, checked_at: "2026-10-10", notes: "n" });
    const d = run(root, ["--src", dup]);
    assert.equal(d.status, 1);
    assert.match(d.stderr, /story:demo-fruit/);
  });

  test("an episode the importer cannot map names the file and the episode", () => {
    const root = makeRoot();
    const src = join(root, "src");
    putSource(src, "x.final.json", "x", [episodeOf({ heritage_type: "poem" })]);
    const r = run(root, ["--src", src]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /x\.final\.json.*story-demo-fruit.*heritage_type/);
  });

  test("the report lists the findings the author works through", () => {
    const root = makeRoot();
    const src = join(root, "src");
    const raw = episodeOf();
    raw.scenes[0].narration_en = "Then came the 허준 in the war.";
    putSource(src, "x.final.json", "x", [raw], { passes: 3, checked_at: "2026-10-10", notes: "n" });
    const r = run(root, ["--src", src]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /import-report/);
    assert.match(r.stdout, /허준/);
    assert.match(r.stdout, /advisor/i);
    assert.match(r.stdout, /captionEn/);
  });
});
