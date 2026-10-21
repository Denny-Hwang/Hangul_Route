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

const { BUDGET, CHUNK_DIR, GENERATED_HEADER, LESSON_STAGES, buildModules, cellChunkName, chunkHash, chunkManifest, checkBudget, discoverJamo, jamoOf, planChunks, runtimeScope, shapeCell, sizes } =
  await import(SCRIPT);

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "buildlessons-"));
  roots.push(root);
  return root;
}
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

// GITHUB_ACTIONS is cleared: a CI run fails the stamp check closed where origin/main does not resolve,
// and these runs test the generator as a local run (the CI case has its own test below).
function run(root, args = [], env = {}) {
  return spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HANGUL_ROUTE_ROOT: root, GITHUB_ACTIONS: "", ...env }, encoding: "utf8" });
}
function put(root, rel, value) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value, null, 2));
}
const read = (root, name) => readFileSync(join(root, OUT, name), "utf8");
const chunk = (root, name) => read(root, `lesson-chunks/${name}.ts`);

import { cell, kt, lp, quest } from "./helpers/lesson-fixtures.mjs";

const overlay = (locale, domain, entries) => ({ locale, domain, entries });
const { readCells } = await import(SCRIPT);
const readCellsOf = (root) => readCells(root);

describe("build-lessons.mjs: empty trees", () => {
  test("with no lesson cells it writes the manifest and the two title chunks", () => {
    const root = makeRoot();
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /wrote 3 lesson modules \(ready cells: 0, drafts left out: 0\)/);
    assert.deepEqual(LESSON_STAGES, [2, 3, 4, 6, 7]);
    assert.equal(CHUNK_DIR, "lesson-chunks");
    const index = read(root, "lessons-index.ts");
    assert.ok(index.startsWith(GENERATED_HEADER));
    assert.match(index, /export const LESSON_EPISODES: Episode\[\] = \[\];/);
    assert.match(index, /export const LESSON_QUESTS: LessonQuestHeader\[\] = \[\];/);
    assert.match(index, /export const LESSON_CELL_CHUNKS: Readonly<Record<string, string>> = \{\};/);
    assert.doesNotMatch(index, /require\(|^import (?!type )/m);
    for (const locale of ["es", "ko"]) {
      assert.match(index, new RegExp(`return import\\('\\./lesson-chunks/lessons-titles-${locale}'\\);`));
      assert.match(chunk(root, `lessons-titles-${locale}`), /export const LESSON_TITLE_OVERLAYS: LessonTitleChunk\['LESSON_TITLE_OVERLAYS'\] = \{\};/);
    }
  });

  test("the generated modules on disk are what a fresh run builds (determinism, CI --check)", () => {
    const r = run(REPO, ["--check"]);
    assert.equal(r.status, 0, r.stdout);
  });
});

describe("build-lessons.mjs: cells", () => {
  test("a ready cell ships: episode and quest headers in the manifest, steps and scopes in its own chunk; a draft stays out", () => {
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
    assert.match(index, /\{"id":"quest:stage2-rites-q1","titleEn":"Quest 1","estimatedMinutes":4\}/);
    assert.doesNotMatch(index, /"scopes"|"steps"|stage2-crafts|"sources"|stdict/);
    // One literal import() of the cell's chunk, named by the cell; nothing imports it statically.
    assert.match(index, /case "episode:stage2-rites":\n {6}return import\('\.\/lesson-chunks\/lessons-cell-stage2-rites'\);/);
    const body = chunk(root, "lessons-cell-stage2-rites");
    assert.match(body, /"minigame:s2-rites-q1-practice":\{"kind":"card-match"/);
    assert.match(body, /export const LESSON_STEPS: LessonCellChunk\['LESSON_STEPS'\] = \{"quest:stage2-rites-q1":\[\{"id":"s1","kind":"intro"/);
    // Compact literals (S4-4): one line per export, no pretty-printing.
    assert.doesNotMatch(index, /\n  "/);
    assert.doesNotMatch(body, /stage2-crafts|\n  "/);
    assert.ok(!existsSync(join(root, OUT, CHUNK_DIR, "lessons-cell-stage2-crafts.ts")));
  });

  test("the manifest lists the jamo each quest's Discover step teaches, only for the quests that teach some", () => {
    const root = makeRoot();
    const taught = cell("stage2", "letters");
    const discover = taught.quests[0].steps.find((s) => s.kind === "discover");
    discover.discover = {
      pages: [
        { items: [{ type: "jamo", jamoId: "jamo:ae" }, { type: "word", wordId: "word:gae" }] },
        { items: [{ type: "jamo", jamoId: "jamo:e" }] },
      ],
    };
    put(root, "content/episodes/stage-2/letters.json", { ...taught, order: 1 });
    // The catalogue rows resolve the Discover jamo to the app's symbol keys (row CM-6).
    put(root, "apps/mobile/src/content/jamo.ts", readFileSync(join(REPO, "apps", "mobile", "src", "content", "jamo.ts"), "utf8"));
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const index = read(root, "lessons-index.ts");
    assert.match(index, /export const LESSON_TEACHES: Readonly<Record<string, readonly string\[\]>> = \{"quest:stage2-letters-q1":\["jamo:ae","jamo:e"\]\};/);
    assert.deepEqual(discoverJamo(taught.quests[0].steps), ["jamo:ae", "jamo:e"]);
    assert.deepEqual(discoverJamo(taught.quests[1].steps), []);
  });

  test("each chunk carries the hash the manifest names: the sha256 of its data, 16 hex", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    assert.equal(run(root).status, 0);
    const index = read(root, "lessons-index.ts");
    const hash = /export const CHUNK_HASH = "([0-9a-f]{16})";/.exec(chunk(root, "lessons-cell-stage2-rites"))?.[1];
    assert.ok(hash);
    assert.match(index, new RegExp(`LESSON_CELL_CHUNKS: Readonly<Record<string, string>> = \\{"episode:stage2-rites":"${hash}"\\}`));
    for (const locale of ["es", "ko"]) {
      const titleHash = /export const CHUNK_HASH = "([0-9a-f]{16})";/.exec(chunk(root, `lessons-titles-${locale}`))?.[1];
      assert.match(index, new RegExp(`"${locale}":"${titleHash}"`));
    }
    assert.equal(chunkHash("x"), "2d711642b726b044");
    assert.equal(cellChunkName("episode:stage6-life"), "lessons-cell-stage6-life");
    // A content change moves the hash; the same content keeps it (the build is deterministic).
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites", "ready", { titleEn: "Festival Words" }));
    assert.equal(run(root).status, 0);
    assert.match(chunk(root, "lessons-cell-stage2-rites"), new RegExp(`CHUNK_HASH = "${hash}"`));
    const changed = cell("stage2", "rites");
    changed.quests[0].steps[0].titleEn = "Hello again";
    put(root, "content/episodes/stage-2/rites.json", changed);
    assert.equal(run(root).status, 0);
    assert.doesNotMatch(chunk(root, "lessons-cell-stage2-rites"), new RegExp(`CHUNK_HASH = "${hash}"`));
    const manifest = chunkManifest([{ ...shapeCell(cell("stage2", "rites"), "content/episodes/stage-2/rites.json"), overlays: { es: {}, ko: {} } }]);
    assert.deepEqual(manifest.map((m) => m.name), ["lessons-cell-stage2-rites", "lessons-titles-es", "lessons-titles-ko"]);
    assert.equal(manifest[0].hash, hash);
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

  test("glosses: titles go to their locale's title chunk, step and minigame glosses to the cell's chunk; disallowed fields are dropped", () => {
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
    assert.doesNotMatch(index, /Palabras|명절|Hola|nope|cometa/);
    const es = chunk(root, "lessons-titles-es");
    assert.match(es, /= \{"episode:stage2-rites":\{"title":"Palabras de fiesta"\}\};/);
    assert.doesNotMatch(es, /Hola|nope|cometa|명절/);
    assert.match(chunk(root, "lessons-titles-ko"), /= \{"episode:stage2-rites":\{"title":"명절 낱말"\}\};/);
    const body = chunk(root, "lessons-cell-stage2-rites");
    assert.match(body, /"quest:stage2-rites-q1":\{"steps.s1.title":"Hola"\}/);
    assert.match(body, /"cardPairs.yeon.gloss":"cometa"/);
    assert.doesNotMatch(body, /cardPairs.gong|Palabras|nope/);
    const plan = planChunks(readCellsOf(root));
    assert.deepEqual(plan.titles.map((t) => t.locale), ["es", "ko"]);
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
      // The spoken form and the recording ride along (F-AUDIO-004 §3.5); a teaching-only field does not.
      [
        { kind: "card-match", pairs: [kt("연", "yeon", "kite", { audioRef: "audio/vocab/yeon-kite.mp3", spokenKo: "연", syllables: ["yeon"] })] },
        { kind: "card-match", rounds: 1, cardPairs: [kt("연", "yeon", "kite", { audioRef: "audio/vocab/yeon-kite.mp3", spokenKo: "연" })] },
      ],
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
    const spoken = {
      speakerEn: "Mina",
      line: kt("매워요?", "maewoyo", "is it spicy?", { spokenKo: "매워요", audioRef: "audio/dialogue/maewoyo.mp3" }),
      replies: [{ id: "a", text: kt("네.", "ne", "yes", { audioRef: "audio/dialogue/ne.mp3" }), correct: true }],
    };
    assert.deepEqual(runtimeScope({ ref, kind: "tap-respond", turns: [spoken] }, "t").dialogue, [
      {
        npcKo: "매워요?",
        npcRomanization: "maewoyo",
        npcEn: "is it spicy?",
        npcSpokenKo: "매워요",
        npcAudioRef: "audio/dialogue/maewoyo.mp3",
        options: [{ ko: "네.", romanization: "ne", en: "yes", isCorrect: true, audioRef: "audio/dialogue/ne.mp3" }],
      },
    ]);
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
  test("--check passes when in sync and fails on drift, a missing module or one no longer built", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    const missing = run(root, ["--check"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /::error file=apps\/mobile\/src\/content\/__generated__\/lessons-index\.ts::generated module is missing or differs from a fresh run/);
    assert.match(missing.stdout, /::error file=packages\/content-schema\/src\/catalog\/catalog\.generated\.ts::generated module is missing/);
    assert.match(missing.stdout, /run pnpm generate/);
    assert.equal(run(root).status, 0);
    assert.match(run(root, ["--check"]).stdout, /lesson modules and catalogue are deterministic \(ready cells: 1\)/);
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites", "ready", { titleEn: "Festival Words" }));
    assert.equal(run(root, ["--check"]).status, 1);
    assert.equal(run(root).status, 0);
    // A stage module of F-CURR-001, or the chunk of a cell that went back to draft, is stale: --check fails, a build removes it.
    put(root, `${OUT}/lessons-stage7.ts`, "export {};\n");
    put(root, `${OUT}/lesson-chunks/lessons-cell-stage2-life.ts`, "export {};\n");
    const stale = run(root, ["--check"]);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /::error file=apps\/mobile\/src\/content\/__generated__\/lessons-stage7\.ts::generated lesson module is no longer built; run pnpm generate/);
    assert.match(stale.stdout, /lesson-chunks\/lessons-cell-stage2-life\.ts::generated lesson module is no longer built/);
    assert.match(run(root).stdout, /removed 2 no longer built/);
    assert.ok(!existsSync(join(root, OUT, "lessons-stage7.ts")));
    assert.equal(run(root, ["--check"]).status, 0);
  });

  test("--report prints bytes per cell, per module and in total, and passes within budget", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    const r = run(root, ["--report"]);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /Lesson modules \(ready cells: 1, drafts: 0\):/);
    assert.match(r.stdout, /episode:stage2-rites {2}3 quests {2}\d+ B raw {2}\d+ B gzip/);
    assert.match(r.stdout, /lessons-index\.ts {2}\d+ B raw/);
    assert.match(r.stdout, /lesson-chunks\/lessons-cell-stage2-rites\.ts {2}\d+ B raw/);
    assert.match(r.stdout, /lesson-chunks\/lessons-titles-ko\.ts {2}\d+ B raw/);
    assert.match(r.stdout, /stage 2 game content {2}1 cells {2}\d+ B raw {2}\d+ B gzip/);
    assert.match(r.stdout, /stage 3 game content {2}0 cells {2}0 B raw/);
    assert.match(r.stdout, /total {2}\d+ B raw {2}\d+ B gzip/);
    assert.match(r.stdout, /Budget: 9000 B raw per quest \(cell average\), 60000 B raw for the manifest, 30000 B raw per title chunk, 90000 B raw and 16000 B gzip per cell chunk, 220000 B raw and 40000 B gzip per stage, 1400000 B raw and 210000 B gzip in total/);
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

  test("checkBudget names every ceiling it crosses (F-CURR-002 §10 lines)", () => {
    const over = checkBudget({
      perCell: [{ id: "episode:x", quests: 6, raw: 54_001, gzip: 1 }],
      perModule: [
        { name: "lessons-index.ts", raw: BUDGET.manifestRaw + 1, gzip: 1 },
        { name: "lesson-chunks/lessons-titles-es.ts", raw: BUDGET.titleChunkRaw + 1, gzip: 1 },
        { name: "lesson-chunks/lessons-titles-ko.ts", raw: BUDGET.titleChunkRaw, gzip: 1 },
        { name: "lesson-chunks/lessons-cell-stage2-rites.ts", raw: 999_999, gzip: 999_999 },
      ],
      perStage: [{ stage: 2, cells: 5, raw: BUDGET.stageRaw + 1, gzip: BUDGET.stageGzip + 1 }],
      total: { raw: BUDGET.totalRaw + 1, gzip: BUDGET.totalGzip + 1 },
    });
    assert.equal(over.length, 9);
    assert.match(over[0], /episode:x is 54001 B raw for 6 quests, over its ceiling of 54000 B/);
    assert.match(over[1], /the start-loaded manifest lessons-index\.ts is 60001 B raw, over the ceiling of 60000 B/);
    assert.match(over[2], /lessons-titles-es\.ts is 30001 B raw, over the title chunk ceiling of 30000 B/);
    assert.match(over[3], /lessons-cell-stage2-rites\.ts is 999999 B raw, over the cell chunk ceiling of 90000 B/);
    assert.match(over[4], /lessons-cell-stage2-rites\.ts is 999999 B gzip, over the cell chunk ceiling of 16000 B/);
    assert.match(over[5], /the Stage 2 game content is 220001 B raw/);
    assert.deepEqual(BUDGET, {
      perQuestRawAvg: 9_000,
      manifestRaw: 60_000,
      titleChunkRaw: 30_000,
      cellChunkRaw: 90_000,
      cellChunkGzip: 16_000,
      stageRaw: 220_000,
      stageGzip: 40_000,
      totalRaw: 1_400_000,
      totalGzip: 210_000,
    });
    // A cell chunk at its line passes it.
    assert.deepEqual(checkBudget({ perCell: [], perModule: [{ name: "lesson-chunks/lessons-cell-stage2-rites.ts", raw: BUDGET.cellChunkRaw, gzip: BUDGET.cellChunkGzip }], total: { raw: 0, gzip: 0 } }), []);
    assert.deepEqual(checkBudget({ perCell: [], perModule: [], total: { raw: 0, gzip: 0 } }), []);
    const report = sizes([{ status: "draft", episode: { id: "d" }, quests: [], scopes: {} }], buildModules([]));
    assert.deepEqual(report.perCell, []);
    assert.equal(report.perModule.length, 3);
    assert.deepEqual(report.perStage.map((s) => [s.stage, s.raw]), LESSON_STAGES.map((n) => [n, 0]));
  });

  test("the repository's manifest and chunks are within the F-CURR-002 §10 lines", () => {
    const r = run(REPO, ["--report"]);
    assert.equal(r.status, 0, r.stdout);
  });

  test("an unknown argument exits 2", () => {
    const r = run(makeRoot(), ["--nope"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Usage: node scripts\/build-lessons\.mjs/);
  });
});

// ---- F-CURR-002 §9.1 (row CM-6): the generated catalogue rows and the addedIn stamps ----------

const { CATALOG_OUT, HISTORY_LAST_VERSION, addedInStamp, catalogueOf, loadSymbolKeys, renderCatalogue, shapeStoryRow, shapeTopicRow, symbolKeyOf } = await import(SCRIPT);

const story = (slug, extra = {}) => ({
  id: `story:${slug}`,
  state: "ready",
  title: { ko: "이야기", romanization: "iyagi", en: `Tale ${slug}` },
  recommendedStage: 2,
  theme: "nature",
  minutes: 5,
  shelf: { order: 1, sampler: true },
  review: { language: "native-reviewed", culture: "culture-reviewed" },
  ...extra,
});
const topicFile = (key, order) => ({ topic: { id: `vocab-topic:${key}`, key, order, titleEn: key.toUpperCase() }, items: [] });
const discoverStepOf = (ids) => ({ id: "s2", kind: "discover", titleEn: "Meet", discover: { pages: [{ items: ids.map((jamoId) => ({ type: "jamo", jamoId })) }] } });

describe("build-lessons.mjs: the catalogue rows (F-CURR-002 row CM-6)", () => {
  test("a ready cell gives a shipped catalogue cell and its quests, a draft cell a 'Coming soon' one with no quests", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-3/rites.json", cell("stage3", "rites"));
    put(root, "content/episodes/stage-2/life.json", cell("stage2", "life", "draft", { titleEn: "Lunch Box Words" }));
    const model = catalogueOf({ cells: readCellsOf(root) });
    assert.deepEqual(model.cells, [
      { stage: "stage2", theme: "life", episodeId: "episode:stage2-life", title: "Lunch Box Words", status: "preview", minutes: 10, questIds: [] },
      {
        stage: "stage3",
        theme: "rites",
        episodeId: "episode:stage3-rites",
        title: "Holiday Words",
        status: "shipped",
        minutes: 13,
        questIds: ["quest:stage3-rites-q1", "quest:stage3-rites-q2", "quest:stage3-rites-q3"],
      },
    ]);
    assert.deepEqual(model.quests[0], {
      id: "quest:stage3-rites-q1",
      episodeId: "episode:stage3-rites",
      stage: "stage3",
      theme: "rites",
      title: "Quest 1",
      minutes: 4,
      teaches: [],
      kind: "lesson",
    });
    assert.equal(model.quests.length, 3);
    assert.equal(model.version, HISTORY_LAST_VERSION);
    assert.deepEqual(model.additions, {});
  });

  test("teaches is the symbol keys of the Discover jamo items; an unknown jamo fails", () => {
    const root = makeRoot();
    const c = cell("stage2", "letters");
    c.quests[0].steps[1] = { ...c.quests[0].steps[1], ...discoverStepOf(["jamo:ae", "jamo:nieun-batchim"]) };
    put(root, "content/episodes/stage-2/letters.json", c);
    const symbolKeys = new Map([["jamo:ae", "ㅐ"], ["jamo:nieun-batchim", "ㄴ/final"]]);
    assert.deepEqual(catalogueOf({ cells: readCellsOf(root), symbolKeys }).quests[0].teaches, ["ㅐ", "ㄴ/final"]);
    assert.throws(() => catalogueOf({ cells: readCellsOf(root) }), /Discover teaches jamo:ae, which the app's jamo/);
    assert.equal(symbolKeyOf({ char: "ㄴ", kind: "batchim" }), "ㄴ/final");
    assert.equal(symbolKeyOf({ char: "ㅐ", kind: "vowel" }), "ㅐ");
  });

  test("the version is the largest addedIn stamp, and the additions list each stamp's quests", () => {
    const root = makeRoot();
    const c = cell("stage3", "rites");
    c.quests[1].addedIn = 20261110;
    c.quests[2].addedIn = 20261105;
    put(root, "content/episodes/stage-3/rites.json", c);
    const model = catalogueOf({ cells: readCellsOf(root), stories: [shapeStoryRow(story("owl", { addedIn: 20261110 }), "s.json")] });
    assert.equal(model.version, 20261110);
    assert.deepEqual(model.additions, { 20261105: ["quest:stage3-rites-q3"], 20261110: ["quest:stage3-rites-q2", "quest:story-owl-listen"] });
    // A story keeps its stamp: the catalogue orders the stories after the frozen shelf by it.
    assert.deepEqual(Object.keys(model.stories[0]).sort(), ["addedIn", "minutes", "recommendedStage", "sampler", "slug", "status", "theme", "title"]);
    assert.match(renderCatalogue(model), /"slug":"owl"[^\n]*"addedIn":20261110|"addedIn":20261110[^\n]*"slug":"owl"/);
    const source = renderCatalogue(model);
    assert.match(source, /export const GENERATED_CATALOG_VERSION = 20261110;/);
    assert.match(source, /  20261105: \["quest:stage3-rites-q3"\],/);
  });

  test("a stamp in a draft cell does not count until the cell ships", () => {
    const root = makeRoot();
    const c = cell("stage3", "rites", "draft");
    c.quests[0].addedIn = 20261201;
    put(root, "content/episodes/stage-3/rites.json", c);
    assert.equal(catalogueOf({ cells: readCellsOf(root) }).version, HISTORY_LAST_VERSION);
  });

  test("addedIn must be a real YYYYMMDD date", () => {
    for (const ok of [20260101, 20261105, 20280229]) assert.equal(addedInStamp(ok, "x"), ok);
    for (const bad of [32, "20261105", 20261332, 20260230, 20251231, 2026110, 20261105.5]) {
      assert.throws(() => addedInStamp(bad, "x"), /addedIn must be a date stamp YYYYMMDD/, String(bad));
    }
    const root = makeRoot();
    const c = cell("stage3", "rites");
    c.quests[0].addedIn = 20261340;
    put(root, "content/episodes/stage-3/rites.json", c);
    assert.throws(() => readCellsOf(root), /addedIn must be a date stamp/);
    assert.throws(() => shapeStoryRow(story("owl", { addedIn: 1 }), "s.json"), /addedIn must be a date stamp/);
  });

  test("a story row carries the catalogue's offer status rule and the shelf sampler; a topic row its key, title and order", () => {
    assert.deepEqual(shapeStoryRow(story("owl"), "s.json"), { slug: "owl", title: "Tale owl", recommendedStage: 2, theme: "nature", minutes: 5, sampler: true, status: "ready" });
    assert.equal(shapeStoryRow(story("owl", { shelf: undefined }), "s.json").status, "draft");
    assert.equal(shapeStoryRow(story("owl", { state: "draft" }), "s.json").status, "draft");
    assert.equal(shapeStoryRow(story("owl", { review: { language: "draft", culture: "culture-reviewed" } }), "s.json").status, "draft");
    assert.equal(shapeStoryRow(story("owl", { shelf: { order: 2 } }), "s.json").sampler, false);
    assert.throws(() => shapeStoryRow(story("owl", { id: "owl" }), "s.json"), /must be story:<slug>/);
    assert.throws(() => shapeStoryRow([], "s.json"), /a story file holds one object/);
    assert.throws(() => shapeStoryRow(story("owl", { title: "Owl" }), "s.json"), /title must be an object/);
    assert.deepEqual(shapeTopicRow(topicFile("food", 1), "t.json"), { id: "topic:food", key: "food", title: "FOOD", order: 1 });
    assert.throws(() => shapeTopicRow({}, "t.json"), /a topic file needs a topic object/);
  });

  test("the CLI writes the catalogue module beside catalog/data.ts, sorted, and --check holds it to a fresh run", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-3/rites.json", cell("stage3", "rites"));
    put(root, "content/stories/zeta.json", story("zeta"));
    put(root, "content/stories/alpha.json", story("alpha"));
    put(root, "content/vocab/colors.json", topicFile("colors", 2));
    put(root, "content/vocab/food.json", topicFile("food", 1));
    put(root, "content/vocab/_senses.json", { groups: [] });
    assert.equal(run(root).status, 0);
    const source = readFileSync(join(root, CATALOG_OUT), "utf8");
    assert.match(source, /^\/\/ GENERATED by scripts\/build-lessons\.mjs — do not edit\./);
    assert.match(source, /export const GENERATED_CATALOG_VERSION = 32;/);
    assert.match(source, /export const GENERATED_QUEST_ADDITIONS: Readonly<Record<number, readonly string\[\]>> = \{\};/);
    assert.ok(source.indexOf('"slug":"alpha"') < source.indexOf('"slug":"zeta"'));
    assert.ok(source.indexOf('"key":"food"') < source.indexOf('"key":"colors"'));
    assert.equal(run(root, ["--check"]).status, 0);
    writeFileSync(join(root, CATALOG_OUT), source.replace("= 32;", "= 33;"));
    const drift = run(root, ["--check"]);
    assert.equal(drift.status, 1);
    assert.match(drift.stdout, /catalog\.generated\.ts::generated module is missing or differs from a fresh run/);
  });

  test("the repository's jamo give their symbol keys (Stage 1 and Word Builder)", async () => {
    const keys = await loadSymbolKeys(REPO);
    assert.equal(keys.get("jamo:ae"), "ㅐ");
    assert.equal(keys.get("jamo:nieun-batchim"), "ㄴ/final");
    assert.equal(keys.get("jamo:giyeok"), "ㄱ");
    assert.equal((await loadSymbolKeys(makeRoot())).size, 0);
  });

  test("--check skips the stamp check where origin/main does not resolve, and HANGUL_ROUTE_STAMP_BASE=none turns it off", () => {
    const root = makeRoot();
    assert.equal(run(root).status, 0);
    const skipped = run(root, ["--check"]);
    assert.equal(skipped.status, 0, skipped.stdout);
    assert.match(skipped.stdout, /addedIn stamp check skipped: origin\/main does not resolve here/);
    const off = run(root, ["--check"], { HANGUL_ROUTE_STAMP_BASE: "none" });
    assert.equal(off.status, 0);
    assert.doesNotMatch(off.stdout, /addedIn/);
  });

  test("on CI (GITHUB_ACTIONS=true) a base that does not resolve fails the stamp check closed", () => {
    const root = makeRoot();
    assert.equal(run(root).status, 0);
    const ci = run(root, ["--check"], { GITHUB_ACTIONS: "true" });
    assert.equal(ci.status, 1, ci.stdout);
    assert.match(ci.stdout, /::error::addedIn stamp check: origin\/main does not resolve/);
    assert.equal(run(root, ["--check"], { GITHUB_ACTIONS: "true", HANGUL_ROUTE_STAMP_BASE: "none" }).status, 0);
  });
});
