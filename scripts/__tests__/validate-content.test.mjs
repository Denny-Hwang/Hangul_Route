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
    for (const rel of ["episodes/x.json", "other/x.json", "storiesx/x.json", "i18n/es/x.json"]) {
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
