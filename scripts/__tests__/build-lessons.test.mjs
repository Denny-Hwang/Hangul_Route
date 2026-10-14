// Self-tests for scripts/build-lessons.mjs (F-CURR-001 §3.10, §3.12, row C-2).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "build-lessons.mjs");
const OUT = join("apps", "mobile", "src", "content", "__generated__");

const { BUDGET, GENERATED_HEADER, LESSON_STAGES, buildModules, checkBudget, jamoOf, runtimeScope, shapeCell, sizes } = await import(SCRIPT);

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "buildlessons-"));
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
const read = (root, name) => readFileSync(join(root, OUT, name), "utf8");

const kt = (ko, romanization, en, extra = {}) => ({ ko, romanization, en, ...extra });
const lp = (id) => ({ id, prompt: kt("연", "yeon", "kite"), options: [{ id: "a", pictureRef: "word:kite" }, { id: "b", pictureRef: "word:ball" }], answerId: "a" });

function quest(stage, theme, k, seconds = [7, 50, 80, 70, 35, 8]) {
  const n = stage.slice(5);
  const ref = (step) => `minigame:s${n}-${theme}-q${k}-${step}`;
  const kinds = ["intro", "discover", "practice", "apply", "check", "reward"];
  return {
    id: `quest:${stage}-${theme}-q${k}`,
    titleEn: `Quest ${k}`,
    estimatedMinutes: 4,
    steps: kinds.map((kind, i) => ({
      id: `s${i + 1}`,
      kind,
      titleEn: kind,
      durationSeconds: seconds[i],
      ...(kind === "practice" ? { minigameKind: "card-match", minigameRef: ref("practice") } : {}),
      ...(kind === "apply" ? { minigameKind: "build-letter", minigameRef: ref("apply") } : {}),
      ...(kind === "check" ? { minigameKind: "listen-pick", minigameRef: ref("check") } : {}),
    })),
    scopes: [
      { ref: ref("practice"), kind: "card-match", pairs: [kt("연", "yeon", "kite"), kt("공", "gong", "ball")] },
      { ref: ref("apply"), kind: "build-letter", words: [kt("설날", "seollal", "Lunar New Year", { syllables: ["seol", "lal"] }), kt("연", "yeon", "kite")] },
      { ref: ref("check"), kind: "listen-pick", rounds: [lp("c1"), lp("c2")] },
    ],
  };
}
function cell(stage, theme, status = "ready", extra = {}) {
  return {
    id: `episode:${stage}-${theme}`,
    stage,
    theme,
    status,
    titleEn: "Holiday Words",
    subtitleEn: "Words of the holidays",
    hoyaIntroEn: "Let us read holiday words!",
    order: 3,
    pillarTags: ["B5"],
    quests: [1, 2, 3].map((k) => quest(stage, theme, k)),
    culture: [{ id: "n1", kind: "culture", textEn: "A note.", sources: [{ title: "t", publisher: "p", url: "https://stdict.korean.go.kr/", accessed: "2026-10-01", quoteOrLocator: "q" }], verification: { passes: 3, checkedAt: "2026-10-01", scope: "lesson", notes: "x" } }],
    review: { language: "native-reviewed", culture: "culture-reviewed", reviewedBy: "MAR", reviewedAt: "2026-10-01" },
    contentVer: 1,
    ...extra,
  };
}
const overlay = (locale, domain, entries) => ({ locale, domain, entries });

describe("build-lessons.mjs: empty trees", () => {
  test("with no lesson cells it writes the index and five empty stage modules", () => {
    const root = makeRoot();
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /wrote 6 lesson modules \(ready cells: 0, drafts left out: 0\)/);
    assert.deepEqual(LESSON_STAGES, [2, 3, 4, 6, 7]);
    const index = read(root, "lessons-index.ts");
    assert.ok(index.startsWith(GENERATED_HEADER));
    assert.match(index, /export const LESSON_EPISODES: Episode\[\] = \[\];/);
    assert.match(index, /export const LESSON_QUESTS: Quest\[\] = \[\];/);
    assert.doesNotMatch(index, /from '\.\/lessons-stage|require\(/);
    for (const n of LESSON_STAGES) assert.match(read(root, `lessons-stage${n}.ts`), /export const LESSON_SCOPES: Readonly<Record<string, MinigameScope>> = \{\};/);
  });

  test("the checked-in modules are what the repository's cells build (CI --check)", () => {
    const r = run(REPO, ["--check"]);
    assert.equal(r.status, 0, r.stdout);
  });
});

describe("build-lessons.mjs: cells", () => {
  test("a ready cell ships: episode, quests without scopes, scopes in its stage module; a draft stays out", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    put(root, "content/episodes/stage-2/crafts.json", cell("stage2", "crafts", "draft", { order: 5 }));
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /ready cells: 1, drafts left out: 1/);
    const index = read(root, "lessons-index.ts");
    assert.match(index, /"id":"episode:stage2-rites"/);
    assert.match(index, /"status":"shipped"/);
    // 3 quests x 250 s = 750 s = 12.5 minutes, rounded.
    assert.match(index, /"estimatedMinutes":13/);
    assert.match(index, /"questIds":\["quest:stage2-rites-q1"/);
    assert.doesNotMatch(index, /"scopes"|stage2-crafts|"sources"|stdict/);
    const stage2 = read(root, "lessons-stage2.ts");
    assert.match(stage2, /"minigame:s2-rites-q1-practice":\{"kind":"card-match"/);
    // Compact literals (S4-4): one line per export, no pretty-printing.
    assert.doesNotMatch(index, /\n  "/);
    assert.doesNotMatch(stage2, /stage2-crafts/);
    assert.match(read(root, "lessons-stage3.ts"), /= \{\};/);
  });

  test("cells are written in grid theme order (letters, life, rites, nature, crafts), not file-name order", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/crafts.json", cell("stage2", "crafts", "ready", { order: 5 }));
    put(root, "content/episodes/stage-2/nature.json", cell("stage2", "nature", "ready", { order: 4 }));
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const ids = [...read(root, "lessons-index.ts").matchAll(/"id":"(episode:[^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, ["episode:stage2-rites", "episode:stage2-nature", "episode:stage2-crafts"]);
  });

  test("a ready cell without both review sign-offs fails the build; a draft does not need them (§3.8)", () => {
    const unsigned = [
      { language: "draft", culture: "culture-reviewed", reviewedBy: "MAR", reviewedAt: "2026-10-01" },
      { language: "native-reviewed", culture: "draft", reviewedBy: "MAR", reviewedAt: "2026-10-01" },
      { language: "native-reviewed", culture: "culture-reviewed", reviewedAt: "2026-10-01" },
      { language: "native-reviewed", culture: "culture-reviewed", reviewedBy: "MAR" },
      { language: "native-reviewed", culture: "culture-reviewed", reviewedBy: " ", reviewedAt: "2026-10-01" },
      undefined,
    ];
    for (const review of unsigned) {
      assert.throws(() => shapeCell(cell("stage2", "rites", "ready", { review }), "content/episodes/stage-2/rites.json"), /lesson-review-unsigned/);
    }
    assert.equal(shapeCell(cell("stage2", "rites", "draft", { review: unsigned[0] }), "content/episodes/stage-2/rites.json").status, "draft");
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites", "ready", { review: unsigned[1] }));
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/episodes\/stage-2\/rites.json::lesson-review-unsigned/);
  });

  test("glosses: episode and quest entries go to the index, minigame entries to the stage module; disallowed fields are dropped", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    put(root, "content/i18n/es/lessons-stage2-rites.json", overlay("es", "lessons-stage2-rites", {
      "episode:stage2-rites": { title: "Palabras de fiesta", romanization: "nope" },
      "quest:stage2-rites-q1": { "steps.s1.title": "Hola" },
      "minigame:s2-rites-q1-practice": { "cardPairs.yeon.gloss": "cometa", "cardPairs.gong.gloss": "  " },
    }));
    put(root, "content/i18n/ko/lessons-stage2-rites.json", overlay("ko", "lessons-stage2-rites", { "episode:stage2-rites": { title: "명절 낱말" } }));
    assert.equal(run(root).status, 0);
    const index = read(root, "lessons-index.ts");
    assert.match(index, /"episode:stage2-rites":\{"title":"Palabras de fiesta"\}/);
    assert.match(index, /"title":"명절 낱말"/);
    assert.match(index, /"steps.s1.title":"Hola"/);
    assert.doesNotMatch(index, /nope|cometa/);
    const stage2 = read(root, "lessons-stage2.ts");
    assert.match(stage2, /"cardPairs.yeon.gloss":"cometa"/);
    assert.doesNotMatch(stage2, /cardPairs.gong/);
  });

  test("an overlay naming an entity of another cell, or a malformed overlay file, fails", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    put(root, "content/i18n/es/lessons-stage2-rites.json", overlay("es", "lessons-stage2-rites", { "episode:stage2-crafts": { title: "x" } }));
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/i18n\/es\/lessons-stage2-rites\.json::episode:stage2-crafts is not an entity of episode:stage2-rites/);
    put(root, "content/i18n/es/lessons-stage2-rites.json", overlay("ko", "x", {}));
    assert.match(run(root).stdout, /an overlay file is \{ locale/);
    put(root, "content/i18n/es/lessons-stage2-rites.json", overlay("es", "x", { "episode:stage2-rites": "x" }));
    assert.match(run(root).stdout, /the entry episode:stage2-rites must be an object/);
  });

  test("shape errors name the file: id, stage and theme, status, quest ids, scope refs, unresolved steps, file names, JSON", () => {
    const fails = (rel, body, pattern) => {
      const root = makeRoot();
      put(root, rel, body);
      const r = run(root);
      assert.equal(r.status, 1, `${rel}: ${r.stdout}`);
      assert.match(r.stdout, pattern);
    };
    fails("content/episodes/stage-2/rites.json", cell("stage2", "life"), /id must be episode:stage2-rites/);
    fails("content/episodes/stage-2/rites.json", { ...cell("stage2", "rites"), stage: "stage3" }, /stage and theme must be stage2 and rites/);
    fails("content/episodes/stage-2/rites.json", cell("stage2", "rites", "shipped"), /status must be "draft" or "ready"/);
    fails("content/episodes/stage-2/notes.json", cell("stage2", "rites"), /named after its theme/);
    fails("content/episodes/stage-2/rites.json", "{ nope", /invalid JSON/);
    fails("content/episodes/stage-2/rites.json", [], /a lesson cell is an object/);
    fails("content/episodes/stage-2/rites.json", { ...cell("stage2", "rites"), quests: "x" }, /quests must be a non-empty array/);
    fails("content/episodes/stage-2/rites.json", { ...cell("stage2", "rites"), titleEn: " " }, /titleEn must be a non-empty string/);
    const swapped = cell("stage2", "rites");
    swapped.quests.reverse();
    fails("content/episodes/stage-2/rites.json", swapped, /id must be quest:stage2-rites-q1/);
    const foreign = cell("stage2", "rites");
    foreign.quests[0].scopes[0].ref = "minigame:s2-rites-q2-practice";
    fails("content/episodes/stage-2/rites.json", foreign, /scope minigame:s2-rites-q2-practice is not named after quest:stage2-rites-q1/);
    const twice = cell("stage2", "rites");
    twice.quests[0].scopes.push(twice.quests[0].scopes[0]);
    fails("content/episodes/stage-2/rites.json", twice, /listed twice/);
    const dangling = cell("stage2", "rites");
    dangling.quests[0].scopes.pop();
    fails("content/episodes/stage-2/rites.json", dangling, /step s5 plays minigame:s2-rites-q1-check, which has no scope/);
    const notQuest = cell("stage2", "rites");
    notQuest.quests[0] = "x";
    fails("content/episodes/stage-2/rites.json", notQuest, /a quest is an object/);
  });
});

describe("build-lessons.mjs: runtime scopes (the app's MinigameScope)", () => {
  const ref = "minigame:s2-rites-q1-x";
  test("maps every lesson kind onto the field its game reads, with its round count", () => {
    const realia = { ref: "realia:menu", entries: [{ id: "e", text: kt("김밥", "gimbap", "gimbap") }], altEn: "A menu" };
    const cases = [
      [{ kind: "listen-pick", rounds: [lp("a")] }, { kind: "listen-pick", rounds: 1, listenPick: { rounds: [lp("a")] } }],
      [{ kind: "pic-word-match", boards: [{ pairs: [] }] }, { kind: "pic-word-match", rounds: 1, picWord: { boards: [{ pairs: [] }] } }],
      [{ kind: "card-match", pairs: [kt("연", "yeon", "kite", { audioRef: "x" })] }, { kind: "card-match", rounds: 1, cardPairs: [kt("연", "yeon", "kite")] }],
      // A particle round may leave out its distractors (the schema default): the game reads [].
      [
        { kind: "order-it", rounds: [{ id: "r1", distractors: [kt("물을", "mureul", "water")] }, { id: "r2", particle: { tile: 0 } }] },
        {
          kind: "order-it",
          rounds: 2,
          orderIt: { rounds: [{ id: "r1", distractors: [kt("물을", "mureul", "water")] }, { id: "r2", particle: { tile: 0 }, distractors: [] }] },
        },
      ],
      [{ kind: "realia-read", realia, rounds: [1] }, { kind: "realia-read", rounds: 1, realiaRead: { realia, rounds: [1] } }],
      [{ kind: "type-hangul", rounds: [1] }, { kind: "type-hangul", rounds: 1, typeHangul: { rounds: [1] } }],
      [{ kind: "trace-word", rounds: [1, 2, 3] }, { kind: "trace-word", rounds: 3, traceWord: { rounds: [1, 2, 3] } }],
      [{ kind: "write-frame", rounds: [1] }, { kind: "write-frame", rounds: 1, writeFrame: { rounds: [1] } }],
    ];
    for (const [input, expected] of cases) assert.deepEqual(runtimeScope({ ref, ...input }, "t"), expected, input.kind);
  });

  test("tap-respond becomes dialogue turns; story-sequence becomes step labels", () => {
    const turn = { speakerEn: "Mina", line: kt("매워요?", "maewoyo", "is it spicy?"), replies: [{ id: "a", text: kt("아니요, 안 매워요.", "aniyo an maewoyo", "no, it is not"), correct: true }] };
    assert.deepEqual(runtimeScope({ ref, kind: "tap-respond", turns: [turn] }, "t"), {
      kind: "tap-respond",
      rounds: 1,
      dialogue: [{ npcKo: "매워요?", npcRomanization: "maewoyo", npcEn: "is it spicy?", options: [{ ko: "아니요, 안 매워요.", romanization: "aniyo an maewoyo", en: "no, it is not", isCorrect: true }] }],
    });
    assert.deepEqual(runtimeScope({ ref, kind: "story-sequence", lines: [{ id: "l1", line: kt("안녕하세요.", "annyeonghaseyo", "hello") }] }, "t"), {
      kind: "story-sequence",
      rounds: 1,
      storySteps: [{ id: "l1", labelEn: "hello", labelKo: "안녕하세요.", romanization: "annyeonghaseyo" }],
    });
  });

  test("build-letter builds each word syllable by syllable; a long word needs its syllables split", () => {
    assert.deepEqual(runtimeScope({ ref, kind: "build-letter", words: [kt("설날", "seollal", "x", { syllables: ["seol", "lal"] }), kt("꽃", "kkot", "flower")] }, "t"), {
      kind: "build-letter",
      rounds: 3,
      syllables: [
        { ko: "설", romanization: "seol", jamoChars: ["ㅅ", "ㅓ", "ㄹ"] },
        { ko: "날", romanization: "lal", jamoChars: ["ㄴ", "ㅏ", "ㄹ"] },
        { ko: "꽃", romanization: "kkot", jamoChars: ["ㄲ", "ㅗ", "ㅊ"] },
      ],
    });
    assert.throws(() => runtimeScope({ ref, kind: "build-letter", words: [kt("설날", "seollal", "x")] }, "t"), /needs its syllables split/);
    assert.throws(() => runtimeScope({ ref, kind: "build-letter", words: [kt("A", "a", "x")] }, "t"), /is not a Hangul syllable block/);
  });

  test("voice-echo (and any unknown kind) has no lesson scope", () => {
    assert.throws(() => runtimeScope({ ref, kind: "voice-echo" }, "t"), /lesson-no-speaking/);
  });

  test("jamoOf splits a syllable block into its compatibility jamo", () => {
    assert.deepEqual(jamoOf("가"), ["ㄱ", "ㅏ"]);
    assert.deepEqual(jamoOf("닭"), ["ㄷ", "ㅏ", "ㄺ"]);
    assert.deepEqual(jamoOf("왜"), ["ㅇ", "ㅙ"]);
    assert.equal(jamoOf("ㄱ"), null);
    assert.equal(jamoOf("가나"), null);
  });

  test("shapeCell derives the episode minutes from the quests (never fewer than 3)", () => {
    const short = cell("stage2", "rites");
    for (const q of short.quests) for (const s of q.steps) s.durationSeconds = 10;
    assert.equal(shapeCell(short, "content/episodes/stage-2/rites.json").episode.estimatedMinutes, 3);
    const none = cell("stage2", "rites", "draft", { rewardCardIds: undefined });
    for (const q of none.quests) for (const s of q.steps) delete s.durationSeconds;
    const shaped = shapeCell(none, "content/episodes/stage-2/rites.json");
    assert.equal(shaped.episode.estimatedMinutes, 3);
    assert.deepEqual(shaped.episode.rewardCardIds, []);
  });
});

describe("build-lessons.mjs: --check and --report", () => {
  test("--check passes when in sync and fails on drift or a missing module", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    const missing = run(root, ["--check"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /::error file=apps\/mobile\/src\/content\/__generated__\/lessons-index\.ts::generated lesson module is missing or out of date/);
    assert.equal(run(root).status, 0);
    assert.match(run(root, ["--check"]).stdout, /lesson modules are up to date \(ready cells: 1\)/);
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites", "ready", { titleEn: "Festival Words" }));
    assert.equal(run(root, ["--check"]).status, 1);
    assert.ok(existsSync(join(root, OUT, "lessons-stage7.ts")));
  });

  test("--report prints bytes per cell, per module and in total, and passes within budget", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    const r = run(root, ["--report"]);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /Lesson modules \(ready cells: 1, drafts: 0\):/);
    assert.match(r.stdout, /episode:stage2-rites {2}3 quests {2}\d+ B raw {2}\d+ B gzip/);
    assert.match(r.stdout, /lessons-stage2\.ts {2}\d+ B raw/);
    assert.match(r.stdout, /total {2}\d+ B raw {2}\d+ B gzip/);
    assert.match(r.stdout, /Budget: 9000 B raw per quest/);
  });

  test("--report fails over budget; a draft is never measured", () => {
    const root = makeRoot();
    const big = cell("stage2", "rites");
    big.quests[0].scopes[0].pairs = Array.from({ length: 400 }, (_, i) => kt("연", "yeon", `kite number ${i} with a long gloss to fill bytes`));
    put(root, "content/episodes/stage-2/rites.json", big);
    put(root, "content/episodes/stage-2/crafts.json", cell("stage2", "crafts", "draft", { order: 5 }));
    const r = run(root, ["--report"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=apps\/mobile\/src\/content\/__generated__::episode:stage2-rites is \d+ B raw for 3 quests, over its ceiling of 27000 B/);
    assert.doesNotMatch(r.stdout, /stage2-crafts/);
  });

  test("checkBudget names every ceiling it crosses", () => {
    const over = checkBudget({
      perCell: [{ id: "episode:x", quests: 6, raw: 54_001, gzip: 1 }],
      perModule: [
        { name: "lessons-index.ts", raw: 999_999, gzip: 999_999 },
        { name: "lessons-stage2.ts", raw: BUDGET.stageRaw + 1, gzip: BUDGET.stageGzip + 1 },
      ],
      total: { raw: BUDGET.totalRaw + 1, gzip: BUDGET.totalGzip + 1 },
    });
    assert.equal(over.length, 5);
    assert.match(over[0], /episode:x is 54001 B raw for 6 quests, over its ceiling of 54000 B/);
    assert.deepEqual(checkBudget({ perCell: [], perModule: [], total: { raw: 0, gzip: 0 } }), []);
    const report = sizes([{ status: "draft", episode: { id: "d" }, quests: [], scopes: {} }], buildModules([]));
    assert.deepEqual(report.perCell, []);
    assert.equal(report.perModule.length, 6);
  });

  test("an unknown argument exits 2", () => {
    const r = run(makeRoot(), ["--nope"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Usage: node scripts\/build-lessons\.mjs/);
  });
});
