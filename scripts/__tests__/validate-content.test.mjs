// Self-tests for scripts/validate-content.mjs (F-CNT-001 / T-019).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "validate-content.mjs"
);

function run(rootDir) {
  return spawnSync("node", [SCRIPT], {
    env: { ...process.env, HANGUL_ROUTE_ROOT: rootDir },
    encoding: "utf8",
  });
}

function makeRoot() {
  return mkdtempSync(join(tmpdir(), "valcnt-"));
}

function writeContent(root, relPath, body) {
  const full = join(root, "content", relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, typeof body === "string" ? body : JSON.stringify(body));
}

describe("validate-content.mjs", () => {
  test("no content/ dir: exit 0 with notice", () => {
    const root = makeRoot();
    try {
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /no content\/ directory/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("empty content/: exit 0", () => {
    const root = makeRoot();
    try {
      mkdirSync(join(root, "content"), { recursive: true });
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /no \.json files under content/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("valid: korean target with romanization + gloss: exit 0", () => {
    const root = makeRoot();
    try {
      writeContent(root, "ok.json", {
        ko: "안녕",
        romanization: "annyeong",
        gloss_en: "hello",
      });
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /1 file\(s\) scanned, 0 violation/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("korean target without romanization: exit 1", () => {
    const root = makeRoot();
    try {
      writeContent(root, "missing-romanization.json", {
        ko: "안녕",
        gloss_en: "hello",
      });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /korean-without-romanization/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("korean target without english gloss: exit 1", () => {
    const root = makeRoot();
    try {
      writeContent(root, "missing-gloss.json", {
        ko: "안녕",
        romanization: "annyeong",
      });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /korean-without-gloss/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("'en' (instead of 'gloss_en') satisfies the gloss requirement", () => {
    const root = makeRoot();
    try {
      writeContent(root, "en-gloss.json", {
        ko: "안녕",
        romanization: "annyeong",
        en: "hello",
      });
      const r = run(root);
      assert.equal(r.status, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("korean in non-target UI field: exit 1", () => {
    const root = makeRoot();
    try {
      writeContent(root, "ui-leak.json", { label: "안녕하세요" });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /korean-in-ui-field at \.label/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("malformed JSON: exit 1 with invalid-json", () => {
    const root = makeRoot();
    try {
      writeContent(root, "broken.json", "{ not valid json");
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /invalid-json/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("nested korean in array: violations include array index path", () => {
    const root = makeRoot();
    try {
      writeContent(root, "nested.json", {
        quests: [
          { ko: "가", romanization: "ga", gloss_en: "a" },
          { ko: "나" },
        ],
      });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /quests\.1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // --- F-HW-001 §3.3 banned-on-learner-surface -----------------------------

  test("banned word in a learner-facing field: exit 1 naming the word", () => {
    const root = makeRoot();
    try {
      writeContent(root, "quest.json", {
        titleEn: "You missed yesterday's quest",
      });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /banned-on-learner-surface: "missed"/);
      assert.match(r.stdout, /titleEn/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("all four banned words are caught, case-insensitively", () => {
    for (const word of ["missed", "Incomplete", "FAILED", "overdue"]) {
      const root = makeRoot();
      try {
        writeContent(root, "q.json", { hoyaLineEn: `This is ${word} today` });
        const r = run(root);
        assert.equal(r.status, 1, `expected ${word} to be caught`);
        assert.match(r.stdout, /banned-on-learner-surface/);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("word-boundary matching: 'dismissed' does not trip 'missed'", () => {
    const root = makeRoot();
    try {
      writeContent(root, "ok.json", {
        titleEn: "Hoya dismissed the idea",
        blurbEn: "Incompletely drawn letters are fine",
      });
      const r = run(root);
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /0 violation\(s\)/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a banned word outside learner-facing fields is not flagged", () => {
    const root = makeRoot();
    try {
      // Internal/authoring metadata is not rendered to a child.
      writeContent(root, "meta.json", { editorNote: "quest failed review" });
      const r = run(root);
      assert.equal(r.status, 0, r.stdout);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("content/stories/research is research data, not UI: Korean fields there are not flagged, shipped story JSON still is", () => {
    const root = makeRoot();
    try {
      writeContent(root, "stories/research/x.final.json", { claim_ko: "한글은 1443년에 만들어졌어요", title: "국가유산포털" });
      let r = run(root);
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /no \.json files under content/); // research is skipped: nothing left to scan
      writeContent(root, "stories/shipped.json", { claim_ko: "한글은 1443년에 만들어졌어요" });
      r = run(root);
      assert.notEqual(r.status, 0, r.stdout);
      assert.match(r.stdout + r.stderr, /korean-in-ui-field/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // --- F-STORY-001 PR 1.3: story reference zone + learner fields -----------

  /** A story-shaped file whose reference-zone keys carry Hangul. */
  const referenceZoneStory = () => ({
    id: "story:demo",
    title: { ko: "훈민정음", romanization: "hunminjeongeum", en: "The Correct Sounds" },
    facts: [
      {
        id: "f1",
        claimEn: "King Sejong promulgated the script in 1446.",
        claimKo: "세종대왕이 1446년에 훈민정음을 반포했다.",
        sources: [
          { title: "훈민정음 해례본", publisher: "국가유산청", url: "https://www.heritage.go.kr/" },
        ],
      },
    ],
    referenceDisplay: "Sources: 국가유산청 (Korea Heritage Service)",
    authorNotes: "Omitted the 훈민정음 preface: too long for a child.",
    learningGoalsEn: ["Say 한글 (hangeul) out loud"],
    verification: { passes: 3, notes: "Re-read 훈민정음 해례본 at the source." },
    errata: [{ id: "e1", kind: "year", summaryEn: "We corrected the year.", detailEn: "was 1443, 한글 창제" }],
  });

  test("story reference zone: Hangul under facts, referenceDisplay, authorNotes, learningGoalsEn, verification, errata is allowed in content/stories/", () => {
    const root = makeRoot();
    try {
      writeContent(root, "stories/demo.json", referenceZoneStory());
      const r = run(root);
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /1 file\(s\) scanned, 0 violation/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("story reference zone: each zone key is exempt on its own (string, object and array values)", () => {
    const zone = referenceZoneStory();
    for (const key of ["facts", "referenceDisplay", "authorNotes", "learningGoalsEn", "verification", "errata"]) {
      const root = makeRoot();
      try {
        writeContent(root, "stories/one.json", { id: "story:one", [key]: zone[key] });
        const r = run(root);
        assert.equal(r.status, 0, `${key}: ${r.stdout}`);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("story reference zone does not cover learner fields: narrationEn, captionEn, explainEn and title.en with Hangul still fail", () => {
    const cases = [
      [{ scenes: [{ id: "s1", narrationEn: "These officials were the 사관." }] }, /korean-in-ui-field at \.scenes\.0\.narrationEn/],
      [{ scenes: [{ id: "s1", captionEn: "The 사관 writes" }] }, /korean-in-ui-field at \.scenes\.0\.captionEn/],
      [{ tiers: [{ checks: [{ id: "c1", explainEn: "It was 한글." }] }] }, /korean-in-ui-field at \.tiers\.0\.checks\.0\.explainEn/],
      [{ title: { ko: "한글", romanization: "hangul", en: "한글 day" } }, /korean-in-ui-field at \.title\.en/],
      [{ summaryEn: "A story of 한글" }, /korean-in-ui-field at \.summaryEn/],
    ];
    for (const [body, expected] of cases) {
      const root = makeRoot();
      try {
        writeContent(root, "stories/leak.json", { id: "story:leak", ...body });
        const r = run(root);
        assert.equal(r.status, 1, r.stdout);
        assert.match(r.stdout, expected);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("story reference zone applies only under content/stories/: the same keys elsewhere still fail", () => {
    for (const rel of ["episodes/x.json", "other/x.json", "storiesx/x.json"]) {
      const root = makeRoot();
      try {
        writeContent(root, rel, {
          facts: [{ claimKo: "세종대왕이 반포했다" }],
          referenceDisplay: "Sources: 국가유산청",
          authorNotes: "메모",
        });
        const r = run(root);
        assert.equal(r.status, 1, `${rel}: ${r.stdout}`);
        assert.match(r.stdout, /korean-in-ui-field at \.facts\.0\.claimKo/);
        assert.match(r.stdout, /korean-in-ui-field at \.referenceDisplay/);
        assert.match(r.stdout, /korean-in-ui-field at \.authorNotes/);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
    // Under content/i18n/ the same object is not an overlay at all (F-I18N-001 §3.7).
    const root = makeRoot();
    try {
      writeContent(root, "i18n/es/x.json", { facts: [{ claimKo: "세종대왕이 반포했다" }], referenceDisplay: "Sources: 국가유산청" });
      const r = run(root);
      assert.equal(r.status, 1, r.stdout);
      assert.match(r.stdout, /content\/i18n\/es\/x\.json::overlay-bad-shape/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("story reference zone is the story's own top-level keys: a nested key of the same name is not exempt", () => {
    const root = makeRoot();
    try {
      writeContent(root, "stories/nested.json", {
        id: "story:nested",
        scenes: [{ id: "s1", facts: { note: "한글" }, authorNotes: "한글" }],
      });
      const r = run(root);
      assert.equal(r.status, 1, r.stdout);
      assert.match(r.stdout, /korean-in-ui-field at \.scenes\.0\.facts\.note/);
      assert.match(r.stdout, /korean-in-ui-field at \.scenes\.0\.authorNotes/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("story reference zone still enforces the banned-word scan on claimEn and errata summaryEn", () => {
    const root = makeRoot();
    try {
      writeContent(root, "stories/banned.json", {
        id: "story:banned",
        facts: [{ id: "f1", claimEn: "The first print failed in 1377.", claimKo: "실패" }],
        errata: [{ id: "e1", summaryEn: "You missed the corrected year." }],
      });
      const r = run(root);
      assert.equal(r.status, 1, r.stdout);
      assert.match(r.stdout, /banned-on-learner-surface: "failed"[^\n]*\.facts\.0\.claimEn/);
      assert.match(r.stdout, /banned-on-learner-surface: "missed"[^\n]*\.errata\.0\.summaryEn/);
      assert.doesNotMatch(r.stdout, /korean-in-ui-field/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("story learner fields are in the banned-word scan: narrationEn, summaryEn, captionEn, explainEn, hintEn, altEn, claimEn, advisoryNoteEn", () => {
    for (const field of [
      "narrationEn",
      "summaryEn",
      "captionEn",
      "explainEn",
      "hintEn",
      "altEn",
      "claimEn",
      "advisoryNoteEn",
    ]) {
      const root = makeRoot();
      try {
        writeContent(root, "stories/words.json", { id: "story:words", [field]: "This was overdue" });
        const r = run(root);
        assert.equal(r.status, 1, `${field}: ${r.stdout}`);
        assert.match(r.stdout, new RegExp(`banned-on-learner-surface: "overdue"[^\\n]*\\.${field}`));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("story learner fields: clean English copy passes and word boundaries hold", () => {
    const root = makeRoot();
    try {
      writeContent(root, "stories/clean.json", {
        id: "story:clean",
        scenes: [
          {
            id: "s1",
            narrationEn: "The {kw:sagwan} dismissed nothing and wrote it all down.",
            captionEn: "A historian writes",
            altEn: "A historian kneels with a brush.",
          },
        ],
        summaryEn: "An incompletely known tale, told kindly.",
      });
      const r = run(root);
      assert.equal(r.status, 0, r.stdout);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("story files: Korean target objects still need romanization and a gloss (the zone only lifts korean-in-ui-field)", () => {
    const root = makeRoot();
    try {
      writeContent(root, "stories/ko.json", {
        id: "story:ko",
        keywords: [{ id: "sagwan", ko: "사관" }],
        facts: [{ id: "f1", claimKo: "사관" }],
      });
      const r = run(root);
      assert.equal(r.status, 1, r.stdout);
      assert.match(r.stdout, /korean-without-romanization at \.keywords\.0/);
      assert.match(r.stdout, /korean-without-gloss at \.keywords\.0/);
      assert.doesNotMatch(r.stdout, /facts/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("content/stories/research stays skipped alongside shipped stories (SKIPPED_DIRS is unchanged)", () => {
    const root = makeRoot();
    try {
      writeContent(root, "stories/research/x.final.json", { narrationEn: "사관 이 failed", rr: "bad" });
      writeContent(root, "stories/ok.json", referenceZoneStory());
      const r = run(root);
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /1 file\(s\) scanned, 0 violation/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("validate-content.mjs: locale overlays (F-I18N-001 §3.7)", () => {
  const vocab = {
    topic: { id: "vocab-topic:food", key: "food", titleEn: "Food" },
    items: [{ id: "vocab:sagwa", ko: "사과", romanization: "sagwa", en: "apple" }],
  };
  const overlay = (locale, entries, domain = "vocab-food") => ({ locale, domain, entries });
  const runEnv = (root, env) =>
    spawnSync("node", [SCRIPT], { env: { ...process.env, HANGUL_ROUTE_ROOT: root, ...env }, encoding: "utf8" });

  test("a Korean overlay may hold Hangul in a gloss (it is a Korean description, not a UI field)", () => {
    const root = makeRoot();
    try {
      writeContent(root, "vocab/food.json", vocab);
      writeContent(root, "i18n/ko/vocab-food.json", overlay("ko", { "vocab:sagwa": { gloss: "빨갛고 동그란 과일" } }));
      writeContent(root, "i18n/es/vocab-food.json", overlay("es", { "vocab:sagwa": { gloss: "manzana" }, "vocab-topic:food": { title: "Comida" } }));
      const r = run(root);
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /3 file\(s\) scanned, 0 violation\(s\); es: 0 missing, ko: 1 missing/);
      assert.match(r.stdout, /::warning file=content\/vocab\/food\.json::overlay-missing: ko lacks 1 translatable field/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Hangul in a Spanish overlay, or in a forbidden field of a Korean one, fails with korean-in-ui-field", () => {
    const root = makeRoot();
    try {
      writeContent(root, "vocab/food.json", vocab);
      writeContent(root, "i18n/es/vocab-food.json", overlay("es", { "vocab:sagwa": { gloss: "manzana 사과" } }));
      writeContent(root, "i18n/ko/vocab-food.json", overlay("ko", { "vocab:sagwa": { romanization: "사과" } }));
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /::error file=content\/i18n\/es\/vocab-food\.json::korean-in-ui-field at \.entries\.vocab:sagwa\.gloss/);
      assert.match(r.stdout, /::error file=content\/i18n\/ko\/vocab-food\.json::overlay-forbidden-field: romanization cannot be translated/);
      assert.match(r.stdout, /::error file=content\/i18n\/ko\/vocab-food\.json::korean-in-ui-field at \.entries\.vocab:sagwa\.romanization/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the other overlay rules reach the output: bad shape, unknown id, circular gloss, banned word", () => {
    const root = makeRoot();
    try {
      writeContent(root, "vocab/food.json", vocab);
      writeContent(root, "i18n/en/vocab-food.json", overlay("en", {}));
      writeContent(root, "i18n/ko/vocab-food.json", overlay("ko", { "vocab:sagwa": { gloss: "사과" }, "vocab:nope": { gloss: "x" } }));
      writeContent(root, "i18n/es/vocab-food.json", overlay("es", { "vocab:sagwa": { gloss: "fallaste" } }));
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /content\/i18n\/en\/vocab-food\.json::overlay-bad-shape: English is the source language/);
      assert.match(r.stdout, /overlay-unknown-id: vocab:nope/);
      assert.match(r.stdout, /overlay-circular-gloss/);
      assert.match(r.stdout, /banned-on-learner-surface: "fallaste"/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("HANGUL_ROUTE_STRICT_LOCALES turns overlay-missing into errors for the listed locales", () => {
    const root = makeRoot();
    try {
      writeContent(root, "vocab/food.json", vocab);
      writeContent(root, "i18n/es/vocab-food.json", overlay("es", { "vocab:sagwa": { gloss: "manzana" } }));
      assert.equal(runEnv(root, {}).status, 0);
      const r = runEnv(root, { HANGUL_ROUTE_STRICT_LOCALES: "es" });
      assert.equal(r.status, 1);
      assert.match(r.stdout, /::error file=content\/vocab\/food\.json::overlay-missing: no es translation of vocab-topic:food\.title/);
      assert.equal(runEnv(root, { HANGUL_ROUTE_STRICT_LOCALES: " ko , fr" }).status, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("overlay files are not scanned as base content: Spanish copy needs no romanization, en fields keep their rules", () => {
    const root = makeRoot();
    try {
      writeContent(root, "vocab/food.json", { ...vocab, items: [{ ...vocab.items[0], en: "You missed it" }] });
      writeContent(root, "i18n/es/vocab-food.json", overlay("es", { "vocab:sagwa": { gloss: "manzana" } }));
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /content\/vocab\/food\.json::banned-on-learner-surface: "missed" at \.items\.0\.en/);
      assert.doesNotMatch(r.stdout, /i18n\/es.*::error/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // The mobile overlay test skips the fields of JSON-only Stage 1 cards and jamo glosses
  // (apps/mobile/src/content/__tests__/overlays.test.ts `jsonBaseField`); this validator is what checks them.
  test("a JSON-only Stage 1 card overlay with a field off the allow-list fails with overlay-forbidden-field", () => {
    const root = makeRoot();
    try {
      writeContent(root, "episodes/stage-1/cards.json", [
        { id: "card:gangaji", ko: "강아지", romanization: "gangaji", en: "Puppy", blurb: "A friendly little dog.", fact: "Small dogs are often called gangaji.", theme: "nature", stage: "stage1", rarity: "common", unlockedBy: "jamo:giyeok" },
      ]);
      writeContent(root, "i18n/es/stage1-cards.json", overlay("es", { "card:gangaji": { title: "Perrito", nope: "x" } }, "stage1-cards"));
      const r = run(root);
      assert.match(r.stdout, /content\/i18n\/es\/stage1-cards\.json::overlay-forbidden-field: nope cannot be translated on card:gangaji/);
      assert.doesNotMatch(r.stdout, /forbidden-field: title/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // F-CURR-001 section 5: the lesson rules of content/episodes/stage-<n>/*.json.
  const kt = (ko, romanization, en) => ({ ko, romanization, en });
  const src = (url, title = "Standard Korean Language Dictionary") => ({
    title,
    publisher: "National Institute of Korean Language",
    url,
    accessed: "2026-10-01",
    quoteOrLocator: "entry, sense 1",
  });
  const lpRound = (id) => ({ id, prompt: kt("떡국", "tteokguk", "rice-cake soup"), options: [{ id: "a", pictureRef: "word:soup" }, { id: "b", pictureRef: "word:kite" }], answerId: "a" });
  function lessonQuest(k) {
    const ref = (step) => `minigame:s2-rites-q${k}-${step}`;
    return {
      id: `quest:stage2-rites-q${k}`,
      titleEn: `Quest ${k}`,
      estimatedMinutes: 4,
      steps: [
        { id: "s1", kind: "intro", titleEn: "Hello", durationSeconds: 7 },
        { id: "s2", kind: "discover", titleEn: "Look", durationSeconds: 50, discover: { pages: [{ items: [{ type: "word", word: kt("떡국", "tteokguk", "rice-cake soup"), noteEn: "Say {ko:떡국} at the New Year." }] }] } },
        { id: "s3", kind: "practice", titleEn: "Play", durationSeconds: 80, minigameKind: "listen-pick", minigameRef: ref("practice") },
        { id: "s4", kind: "apply", titleEn: "Build", durationSeconds: 70, minigameKind: "card-match", minigameRef: ref("apply") },
        { id: "s5", kind: "check", titleEn: "Two quick ones", durationSeconds: 35, minigameKind: "listen-pick", minigameRef: ref("check") },
        { id: "s6", kind: "reward", titleEn: "Done", durationSeconds: 8 },
      ],
      scopes: [
        { ref: ref("practice"), kind: "listen-pick", rounds: [1, 2, 3, 4, 5, 6].map((i) => lpRound(`r${i}`)) },
        { ref: ref("apply"), kind: "card-match", pairs: [kt("연", "yeon", "kite"), kt("윷", "yut", "yut sticks")] },
        { ref: ref("check"), kind: "listen-pick", rounds: [lpRound("c1"), lpRound("c2")] },
      ],
    };
  }
  const lessonCell = (over = {}) => ({
    id: "episode:stage2-rites",
    stage: "stage2",
    theme: "rites",
    status: "draft",
    titleEn: "Holiday Words",
    subtitleEn: "Words of Seollal and Chuseok",
    hoyaIntroEn: "Let us read holiday words!",
    order: 3,
    pillarTags: ["B5"],
    quests: [1, 2, 3].map(lessonQuest),
    culture: [
      {
        id: "n1",
        kind: "culture",
        textEn: "Families eat {ko:떡국} on the morning of the New Year.",
        sources: [src("https://stdict.korean.go.kr/x", "표준국어대사전"), src("https://folkency.nfm.go.kr/topic/1")],
        verification: { passes: 1, checkedAt: "2026-10-01", scope: "lesson", notes: "pass 1: 출처 확인" },
      },
    ],
    review: { language: "draft", culture: "draft" },
    contentVer: 1,
    ...over,
  });

  test("a well-formed draft lesson cell passes: {ko:} tokens in English fields and Korean source titles are allowed", () => {
    const root = makeRoot();
    try {
      writeContent(root, "episodes/stage-2/rites.json", lessonCell());
      const r = run(root);
      assert.equal(r.status, 0, r.stdout + r.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("lesson rules fail a ready cell without sign-offs, with one source and with Hangul outside a {ko:} token", () => {
    const root = makeRoot();
    try {
      const cell = lessonCell({ status: "ready" });
      cell.culture[0].sources = [cell.culture[0].sources[1]];
      cell.hoyaIntroEn = "Let us read 설날 words!";
      writeContent(root, "episodes/stage-2/rites.json", cell);
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /lesson-review-unsigned: a ready cell needs both multi-agent review sign-offs/);
      assert.match(r.stdout, /lesson-source-shape: a note needs at least 2 sources/);
      assert.match(r.stdout, /lesson-verification-passes: .* at \.culture\[0\]\.verification\.passes/);
      assert.match(r.stdout, /korean-in-ui-field at \.hoyaIntroEn/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("lesson rules: voice-echo and a broken file are reported; the zone covers only lesson cells", () => {
    const root = makeRoot();
    try {
      const cell = lessonCell();
      cell.quests[0].steps[2].minigameKind = "voice-echo";
      writeContent(root, "episodes/stage-2/rites.json", cell);
      writeContent(root, "episodes/stage-3/life.json", { id: "episode:stage3-life" });
      writeContent(root, "other/x.json", { review: { note: "검토" } });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /file=content\/episodes\/stage-2\/rites\.json::lesson-no-speaking/);
      assert.match(r.stdout, /file=content\/episodes\/stage-3\/life\.json::lesson-schema/);
      assert.match(r.stdout, /file=content\/other\/x\.json::korean-in-ui-field/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a {ko:} token passes only in an English field of a lesson cell; the zone keys only where the schema puts them", () => {
    const root = makeRoot();
    try {
      const cell = lessonCell();
      // Not an ...En field of the cell: the token does not hide the Hangul.
      cell.quests[0].steps[0].bodyNote = "Say {ko:떡국}.";
      // A `review` key inside a quest is not the cell's review record.
      cell.quests[0].review = { note: "검토" };
      writeContent(root, "episodes/stage-2/rites.json", cell);
      // A story field with a token is still Korean in a UI field.
      writeContent(root, "stories/x.json", { id: "story:x", summaryEn: "A story of {ko:한글}" });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /korean-in-ui-field at \.quests\.0\.steps\.0\.bodyNote/);
      assert.match(r.stdout, /korean-in-ui-field at \.quests\.0\.review\.note/);
      assert.match(r.stdout, /file=content\/stories\/x\.json::korean-in-ui-field at \.summaryEn/);
      assert.doesNotMatch(r.stdout, /korean-in-ui-field at \.culture/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a source accessed today in Korea is not in the future (UTC+14 grace)", () => {
    const root = makeRoot();
    try {
      const cell = lessonCell();
      const tomorrowUtc = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
      for (const source of cell.culture[0].sources) source.accessed = tomorrowUtc;
      writeContent(root, "episodes/stage-2/rites.json", cell);
      const r = run(root);
      assert.doesNotMatch(r.stdout, /accessed .* is in the future/, r.stdout);
      cell.culture[0].sources[0].accessed = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      writeContent(root, "episodes/stage-2/rites.json", cell);
      assert.match(run(root).stdout, /is in the future/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
