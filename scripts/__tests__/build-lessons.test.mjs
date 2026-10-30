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
  test("with no lesson cells it writes the manifest, the two title chunks and the three headers chunks", () => {
    const root = makeRoot();
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /wrote 6 lesson modules \(ready cells: 0, drafts left out: 0\)/);
    assert.deepEqual(LESSON_STAGES, [2, 3, 4, 6, 7]);
    assert.equal(CHUNK_DIR, "lesson-chunks");
    const index = read(root, "lessons-index.ts");
    assert.ok(index.startsWith(GENERATED_HEADER));
    assert.match(index, /export const LESSON_EPISODES: LessonManifestEpisode\[\] = \[\];/);
    assert.match(index, /export const LESSON_QUESTS: LessonQuestHeader\[\] = \[\];/);
    assert.match(index, /export const LESSON_CELL_CHUNKS: Readonly<Record<string, string>> = \{\};/);
    assert.doesNotMatch(index, /require\(|^import (?!type )/m);
    for (const locale of ["es", "ko"]) {
      assert.match(index, new RegExp(`return import\\('\\./lesson-chunks/lessons-titles-${locale}'\\);`));
      assert.match(chunk(root, `lessons-titles-${locale}`), /export const LESSON_TITLE_OVERLAYS: LessonTitleChunk\['LESSON_TITLE_OVERLAYS'\] = \{\};/);
    }
    for (const locale of ["en", "es", "ko"]) {
      assert.match(index, new RegExp(`return import\\('\\./lesson-chunks/lessons-headers-${locale}'\\);`));
      assert.match(chunk(root, `lessons-headers-${locale}`), /export const LESSON_HEADER_OVERLAYS: LessonHeaderChunk\['LESSON_HEADER_OVERLAYS'\] = \{\};/);
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
    assert.deepEqual(manifest.map((m) => m.name), [
      "lessons-cell-stage2-rites",
      "lessons-titles-es",
      "lessons-titles-ko",
      "lessons-headers-en",
      "lessons-headers-es",
      "lessons-headers-ko",
    ]);
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

  test("Did you know? (F-CURR-002 row CM-3C): each quest's note rides in its cell's chunk, culture notes first, with its source line", () => {
    const root = makeRoot();
    const src = (publisher, title) => ({ title, publisher, url: "https://folkency.nfm.go.kr/kr/topic/detail/1", accessed: "2026-10-01", quoteOrLocator: "q" });
    const ver = { passes: 3, checkedAt: "2026-10-01", scope: "lesson", notes: "x" };
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites", "ready", {
      culture: [
        { id: "n1", kind: "language", textEn: "A grammar tip.", sources: [src("국립국어원 (National Institute of Korean Language)", "사전")], verification: ver },
        { id: "n2", kind: "culture", textEn: "Kites fly at {ko:설날}.", sources: [src("국립민속박물관 (National Folk Museum of Korea)", "연날리기"), src("b", "c")], verification: ver },
      ],
    }));
    put(root, "content/i18n/es/lessons-stage2-rites.json", overlay("es", "lessons-stage2-rites", {
      "episode:stage2-rites": { title: "Palabras de fiesta", "culture.n2.text": "Las cometas vuelan en {ko:설날}." },
    }));
    assert.equal(run(root).status, 0);
    const body = chunk(root, "lessons-cell-stage2-rites");
    const notes = JSON.parse(/export const LESSON_NOTES: LessonCellChunk\['LESSON_NOTES'\] = (.*);\n/.exec(body)?.[1] ?? "null");
    // Three quests over two notes: the culture note first, then the language note, then round again.
    assert.deepEqual(Object.keys(notes), ["quest:stage2-rites-q1", "quest:stage2-rites-q2", "quest:stage2-rites-q3"]);
    assert.deepEqual(notes["quest:stage2-rites-q1"], {
      id: "n2",
      textEn: "Kites fly at {ko:설날}.",
      citation: { title: "연날리기", publisher: "국립민속박물관 (National Folk Museum of Korea)", more: 1 },
    });
    assert.equal(notes["quest:stage2-rites-q2"].id, "n1");
    assert.equal(notes["quest:stage2-rites-q3"].id, "n2");
    // The note's es text is a body gloss of the cell's chunk, never in the title chunk or the manifest.
    assert.match(body, /"episode:stage2-rites":\{"culture.n2.text":"Las cometas vuelan en \{ko:설날\}."\}/);
    assert.doesNotMatch(chunk(root, "lessons-titles-es"), /cometas/);
    assert.doesNotMatch(read(root, "lessons-index.ts"), /Kites|cometas|LESSON_NOTES =/);
    // The notes are part of the chunk's content hash.
    const plain = planChunks(readCellsOf(root)).cells[0].hash;
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    assert.notEqual(planChunks(readCellsOf(root)).cells[0].hash, plain);
  });

  test("Did you know?: a cell with no notes ships an empty table; a ready cell's note with only a factRef fails (row CM-3C)", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites", "ready", { culture: [] }));
    assert.equal(run(root).status, 0);
    assert.match(chunk(root, "lessons-cell-stage2-rites"), /export const LESSON_NOTES: LessonCellChunk\['LESSON_NOTES'\] = \{\};/);
    const ver = { passes: 3, checkedAt: "2026-10-01", scope: "lesson", notes: "x" };
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites", "ready", { culture: [{ id: "n1", kind: "culture", textEn: "A fact.", factRef: "story:x#f1", verification: ver }] }));
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/episodes\/stage-2\/rites\.json::culture n1 has no sources\[\] of its own/);
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
      // Row CM-30: a round with no gapKind is a word gap (the schema default); a value gap's card rides along.
      [
        { kind: "cloze-pick", rounds: [{ id: "c1" }, { id: "c2", gapKind: "particle" }] },
        { kind: "cloze-pick", rounds: 2, clozePick: { rounds: [{ id: "c1", gapKind: "word" }, { id: "c2", gapKind: "particle" }] } },
      ],
      [
        { kind: "cloze-pick", rounds: [{ id: "c1", gapKind: "value" }], realia },
        { kind: "cloze-pick", rounds: 1, clozePick: { rounds: [{ id: "c1", gapKind: "value" }], realia } },
      ],
      // F-CURR-002 row CM-34: Story Order's rounds as authored.
      [{ kind: "story-order", rounds: [1, 2] }, { kind: "story-order", rounds: 2, storyOrder: { rounds: [1, 2] } }],
      // F-CURR-002 row CM-36: a Hidden Heritage scene plays one round per target found (`scopeRoundCount`).
      [
        { kind: "hidden-heritage", rounds: [{ targets: [1, 2, 3] }, { targets: [4, 5, 6, 7] }] },
        { kind: "hidden-heritage", rounds: 7, hiddenHeritage: { rounds: [{ targets: [1, 2, 3] }, { targets: [4, 5, 6, 7] }] } },
      ],
      // F-CURR-002 row CM-38: a chain plays one round per frame.
      [{ kind: "my-story", frames: [1, 2, 3] }, { kind: "my-story", rounds: 3, myStory: { frames: [1, 2, 3] } }],
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

  test("role-play (row CM-35) keeps the scene as authored and counts the learner turns of a way through it", () => {
    const reply = (id, next) => ({ id, text: kt("네.", "ne", "yes"), kind: "natural", next });
    const nudge = { id: "x", text: kt("아니요.", "aniyo", "no"), kind: "lessNatural", whyEn: "Try another." };
    const turnNode = (id, next) => ({ id, line: kt("뭐예요?", "mwoyeyo", "what is it?"), replies: [reply("a", next), nudge] });
    const scene = { title: kt("도서관", "doseogwan", "At the library"), partner: kt("사서", "saseo", "librarian"), start: "t1", nodes: [turnNode("t1", "t2"), turnNode("t2", "t3"), turnNode("t3", "t4"), turnNode("t4", "end"), { id: "end", end: true, closingEn: "Well done!" }] };
    assert.deepEqual(runtimeScope({ ref, kind: "role-play", scene }, "t"), { kind: "role-play", rounds: 4, rolePlay: { scene } });
    const dead = { ...scene, nodes: scene.nodes.slice(0, 4) };
    assert.throws(() => runtimeScope({ ref, kind: "role-play", scene: dead }, "t"), /role-play-good-endings/);
    const loop = { ...scene, nodes: [turnNode("t1", "t1"), ...scene.nodes.slice(1)] };
    assert.throws(() => runtimeScope({ ref, kind: "role-play", scene: loop }, "t"), /role-play-good-endings/);
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
    assert.match(r.stdout, /lesson-chunks\/lessons-headers-en\.ts {2}\d+ B raw/);
    assert.match(r.stdout, /Budget: 9000 B raw per quest \(cell average\), 60000 B raw for the manifest, 30000 B raw per title chunk, 40000 B raw per headers chunk, 90000 B raw and 16000 B gzip per cell chunk, 220000 B raw and 40000 B gzip per stage, 1400000 B raw and 210000 B gzip in total/);
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
        { name: "lesson-chunks/lessons-headers-en.ts", raw: BUDGET.headersChunkRaw + 1, gzip: 1 },
        { name: "lesson-chunks/lessons-headers-ko.ts", raw: BUDGET.headersChunkRaw, gzip: 1 },
      ],
      perStage: [{ stage: 2, cells: 5, raw: BUDGET.stageRaw + 1, gzip: BUDGET.stageGzip + 1 }],
      total: { raw: BUDGET.totalRaw + 1, gzip: BUDGET.totalGzip + 1 },
    });
    assert.equal(over.length, 10);
    assert.match(over[0], /episode:x is 54001 B raw for 6 quests, over its ceiling of 54000 B/);
    assert.match(over[1], /the start-loaded manifest lessons-index\.ts is 60001 B raw, over the ceiling of 60000 B/);
    assert.match(over[2], /lessons-titles-es\.ts is 30001 B raw, over the title chunk ceiling of 30000 B/);
    assert.match(over[3], /lessons-cell-stage2-rites\.ts is 999999 B raw, over the cell chunk ceiling of 90000 B/);
    assert.match(over[4], /lessons-cell-stage2-rites\.ts is 999999 B gzip, over the cell chunk ceiling of 16000 B/);
    assert.match(over[5], /lessons-headers-en\.ts is 40001 B raw, over the headers chunk ceiling of 40000 B/);
    assert.match(over[6], /the Stage 2 game content is 220001 B raw/);
    assert.deepEqual(BUDGET, {
      perQuestRawAvg: 9_000,
      manifestRaw: 60_000,
      titleChunkRaw: 30_000,
      headersChunkRaw: 40_000,
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
    assert.equal(report.perModule.length, 6);
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

// ---- F-CURR-002 row CM-40: two volumes per cell, and the display lines in a headers chunk per locale ----------

/** A cell's Volume 2 as its file states it: every id gains -v2, and `volume: 2`. */
function volume2(body) {
  const { stage, theme } = body;
  const n = stage.slice(5);
  const text = JSON.stringify(body)
    .split(`quest:${stage}-${theme}-q`)
    .join(`quest:${stage}-${theme}-v2-q`)
    .split(`minigame:s${n}-${theme}-q`)
    .join(`minigame:s${n}-${theme}-v2-q`);
  return { ...JSON.parse(text), id: `episode:${stage}-${theme}-v2`, volume: 2, titleEn: "Holiday Words 2" };
}

describe("build-lessons.mjs: Volume 2 beside Volume 1 (F-CURR-002 row CM-40)", () => {
  test("<theme>.v2.json ships as the cell's second episode, volume 2, with a body chunk of its own and its own overlay file", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    put(root, "content/episodes/stage-2/rites.v2.json", volume2(cell("stage2", "rites")));
    put(root, "content/i18n/es/lessons-stage2-rites-v2.json", overlay("es", "lessons-stage2-rites-v2", {
      "episode:stage2-rites-v2": { title: "Palabras de fiesta 2", subtitle: "Más palabras" },
      "minigame:s2-rites-v2-q1-practice": { "cardPairs.yeon.gloss": "cometa" },
    }));
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /ready cells: 2, drafts left out: 0/);
    const index = read(root, "lessons-index.ts");
    const ids = [...index.matchAll(/"id":"(episode:[^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, ["episode:stage2-rites", "episode:stage2-rites-v2"]);
    assert.match(index, /"id":"episode:stage2-rites-v2","stage":"stage2","theme":"rites","order":3,"titleEn":"Holiday Words 2","questIds":\["quest:stage2-rites-v2-q1","quest:stage2-rites-v2-q2","quest:stage2-rites-v2-q3"\]/);
    assert.match(index, /"status":"shipped","volume":2\}/);
    // Volume 1 says nothing of a volume, so its manifest entry is what it was.
    assert.doesNotMatch(index.slice(0, index.indexOf("episode:stage2-rites-v2")), /"volume"/);
    assert.match(index, /case "episode:stage2-rites-v2":\n {6}return import\('\.\/lesson-chunks\/lessons-cell-stage2-rites-v2'\);/);
    const v1 = chunk(root, "lessons-cell-stage2-rites");
    const v2 = chunk(root, "lessons-cell-stage2-rites-v2");
    assert.doesNotMatch(v1, /-v2/);
    assert.match(v2, /"minigame:s2-rites-v2-q1-practice":\{"kind":"card-match"/);
    assert.match(v2, /"cardPairs.yeon.gloss":"cometa"/);
    assert.doesNotMatch(v2, /"quest:stage2-rites-q1"/);
    assert.equal(cellChunkName("episode:stage2-rites-v2"), "lessons-cell-stage2-rites-v2");
    assert.match(chunk(root, "lessons-titles-es"), /"episode:stage2-rites-v2":\{"title":"Palabras de fiesta 2"\}/);
    assert.match(chunk(root, "lessons-headers-es"), /"episode:stage2-rites-v2":\{"subtitle":"Más palabras"\}/);
    const names = chunkManifest(readCellsOf(root)).map((m) => m.name);
    assert.deepEqual(names.slice(0, 2), ["lessons-cell-stage2-rites", "lessons-cell-stage2-rites-v2"]);
  });

  test("the catalogue rows put a cell's Volume 2 after its Volume 1, its volume last; a draft Volume 2 is left out", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.json", cell("stage2", "rites"));
    put(root, "content/episodes/stage-2/rites.v2.json", volume2(cell("stage2", "rites")));
    put(root, "content/episodes/stage-2/crafts.json", cell("stage2", "crafts", "ready", { order: 5 }));
    put(root, "content/episodes/stage-2/crafts.v2.json", { ...volume2(cell("stage2", "crafts", "draft", { order: 5 })), titleEn: "Draft" });
    const model = catalogueOf({ cells: readCellsOf(root) });
    assert.deepEqual(cellRowsOf(model).map((row) => [row[1], row[2], row[3], row[6]]), [
      ["rites", "Holiday Words", "shipped", undefined],
      ["rites", "Holiday Words 2", "shipped", 2],
      ["crafts", "Holiday Words", "shipped", undefined],
    ]);
    assert.deepEqual(
      model.quests.filter((q) => q.episodeId === "episode:stage2-rites-v2").map((q) => q.id),
      ["quest:stage2-rites-v2-q1", "quest:stage2-rites-v2-q2", "quest:stage2-rites-v2-q3"],
    );
    assert.match(renderCatalogue(model), /\["stage2","rites","Holiday Words 2","shipped",13,\[\["Quest 1",4,\[\]\],\["Quest 2",4,\[\]\],\["Quest 3",4,\[\]\]\],2\],/);
  });

  test("a Volume 2 file must carry its -v2 ids and volume 2; a third volume, or a ready Volume 2 without its Volume 1, fails", () => {
    const fails = (files, pattern) => {
      const root = makeRoot();
      for (const [rel, body] of Object.entries(files)) put(root, rel, body);
      const r = run(root);
      assert.equal(r.status, 1, r.stdout);
      assert.match(r.stdout, pattern);
    };
    const v1 = cell("stage2", "rites");
    fails({ "content/episodes/stage-2/rites.json": v1, "content/episodes/stage-2/rites.v2.json": { ...volume2(v1), id: "episode:stage2-rites" } }, /id must be episode:stage2-rites-v2/);
    fails({ "content/episodes/stage-2/rites.json": v1, "content/episodes/stage-2/rites.v2.json": { ...volume2(v1), volume: undefined } }, /a rites\.v2\.json cell has volume 2/);
    fails({ "content/episodes/stage-2/rites.json": { ...v1, volume: 2 } }, /a Volume 1 cell states no volume/);
    fails({ "content/episodes/stage-2/rites.json": v1, "content/episodes/stage-2/rites.v3.json": volume2(v1) }, /<theme>\.v2\.json for its Volume 2/);
    fails({ "content/episodes/stage-2/rites.v2.json": volume2(v1) }, /::error file=content\/episodes\/stage-2\/rites\.v2\.json::a ready Volume 2 needs its cell's Volume 1 ready/);
    fails({ "content/episodes/stage-2/rites.json": { ...v1, status: "draft" }, "content/episodes/stage-2/rites.v2.json": volume2(v1) }, /a ready Volume 2 needs its cell's Volume 1 ready/);
    const stray = volume2(v1);
    stray.quests[0].scopes[0].ref = "minigame:s2-rites-q1-practice";
    fails({ "content/episodes/stage-2/rites.json": v1, "content/episodes/stage-2/rites.v2.json": stray }, /scope minigame:s2-rites-q1-practice is not named after quest:stage2-rites-v2-q1/);
    // A draft Volume 2 may wait for its Volume 1.
    const root = makeRoot();
    put(root, "content/episodes/stage-2/rites.v2.json", { ...volume2(v1), status: "draft" });
    assert.equal(run(root).status, 0);
  });
});

describe("build-lessons.mjs: the lesson headers chunks (F-CURR-002 §10, row CM-40)", () => {
  test("the display lines leave the manifest and the title chunks for one headers chunk per locale, English included", () => {
    const root = makeRoot();
    const body = cell("stage2", "rites", "ready", { rewardCardIds: ["card:insa"] });
    body.quests[0].blurbEn = "Read the holiday words.";
    body.quests[0].teaserEn = "Next: kites!";
    body.quests[0].rewardCardId = "card:insa";
    put(root, "content/episodes/stage-2/rites.json", body);
    put(root, "content/i18n/es/lessons-stage2-rites.json", overlay("es", "lessons-stage2-rites", {
      "episode:stage2-rites": { title: "Palabras de fiesta", subtitle: "Palabras de las fiestas", hoyaIntro: "¡Leamos!" },
      "quest:stage2-rites-q1": { title: "Misión 1", blurb: "Lee las palabras.", teaser: "Luego: ¡cometas!", "steps.s1.title": "Hola" },
    }));
    assert.equal(run(root).status, 0);
    const index = read(root, "lessons-index.ts");
    assert.doesNotMatch(index, /subtitleEn|hoyaIntroEn|rewardCardIds|blurbEn|teaserEn|Words of the holidays|Read the holiday/);
    // A quest's card stays: the Results award reads it (three shipped taste quests carry one).
    assert.match(index, /\{"id":"quest:stage2-rites-q1","titleEn":"Quest 1","estimatedMinutes":4,"rewardCardId":"card:insa"\}/);
    assert.match(index, /export const LESSON_HEADER_CHUNKS: Readonly<Record<UiLocale, string>> = \{"en":"[0-9a-f]{16}","es":"[0-9a-f]{16}","ko":"[0-9a-f]{16}"\};/);
    const en = chunk(root, "lessons-headers-en");
    assert.match(en, /LESSON_EPISODE_HEADERS: LessonHeaderChunk\['LESSON_EPISODE_HEADERS'\] = \{"episode:stage2-rites":\{"subtitleEn":"Words of the holidays","hoyaIntroEn":"Let us read holiday words!","rewardCardIds":\["card:insa"\]\}\};/);
    assert.match(en, /LESSON_QUEST_HEADERS: LessonHeaderChunk\['LESSON_QUEST_HEADERS'\] = \{"quest:stage2-rites-q1":\{"blurbEn":"Read the holiday words.","teaserEn":"Next: kites!"\}\};/);
    assert.match(en, /LESSON_HEADER_OVERLAYS: LessonHeaderChunk\['LESSON_HEADER_OVERLAYS'\] = \{\};/);
    const es = chunk(root, "lessons-headers-es");
    assert.match(es, /= \{"episode:stage2-rites":\{"hoyaIntro":"¡Leamos!","subtitle":"Palabras de las fiestas"\},"quest:stage2-rites-q1":\{"blurb":"Lee las palabras.","teaser":"Luego: ¡cometas!"\}\};/);
    assert.match(es, /LESSON_EPISODE_HEADERS: LessonHeaderChunk\['LESSON_EPISODE_HEADERS'\] = \{\};/);
    assert.match(chunk(root, "lessons-titles-es"), /= \{"episode:stage2-rites":\{"title":"Palabras de fiesta"\},"quest:stage2-rites-q1":\{"title":"Misión 1"\}\};/);
    assert.doesNotMatch(chunk(root, "lessons-titles-es"), /Lee las|Leamos|Hola/);
    assert.match(chunk(root, "lessons-cell-stage2-rites"), /"steps.s1.title":"Hola"/);
    // Each headers chunk carries the hash the manifest names, and a display line change moves only its hash.
    const hashOf = (name) => /export const CHUNK_HASH = "([0-9a-f]{16})";/.exec(chunk(root, name))?.[1];
    for (const locale of ["en", "es", "ko"]) assert.match(index, new RegExp(`"${locale}":"${hashOf(`lessons-headers-${locale}`)}"`));
    const before = { en: hashOf("lessons-headers-en"), cell: hashOf("lessons-cell-stage2-rites") };
    put(root, "content/episodes/stage-2/rites.json", { ...body, subtitleEn: "New words of the holidays" });
    assert.equal(run(root).status, 0);
    assert.notEqual(hashOf("lessons-headers-en"), before.en);
    assert.equal(hashOf("lessons-cell-stage2-rites"), before.cell);
  });

  test("the repository's manifest keeps no display line, and its headers chunks hold every shipped episode's", () => {
    const index = readFileSync(join(REPO, OUT, "lessons-index.ts"), "utf8");
    assert.doesNotMatch(index, /"subtitleEn"|"hoyaIntroEn"|"rewardCardIds"|"blurbEn"|"teaserEn"/);
    const en = readFileSync(join(REPO, OUT, CHUNK_DIR, "lessons-headers-en.ts"), "utf8");
    const episodes = [...index.matchAll(/"id":"(episode:[^"]+)"/g)].map((m) => m[1]);
    assert.ok(episodes.length >= 25);
    for (const id of episodes) assert.match(en, new RegExp(`"${id}":\\{"subtitleEn":`), id);
  });
});

describe("build-lessons.mjs --include-fixtures: the e2e Volume 2 (row CM-40)", () => {
  test("copies Stage 2 Nature as its Volume 2: -v2 ids, volume 2, its overlays renamed; never with --check or --report", async () => {
    const { FIXTURE_VOLUME2, volume2Fixture } = await import(SCRIPT);
    assert.deepEqual({ ...FIXTURE_VOLUME2 }, { stageNo: 2, theme: "nature" });
    const v1 = cell("stage2", "nature", "ready", { order: 4, titleEn: "Outdoor Words" });
    const { cell: v2, files } = volume2Fixture(v1, [{ rel: "content/i18n/es/lessons-stage2-nature.json", locale: "es", json: overlay("es", "x", { "episode:stage2-nature": { title: "Palabras" }, "quest:stage2-nature-q1": { title: "Uno" } }) }]);
    assert.equal(v2.id, "episode:stage2-nature-v2");
    assert.equal(v2.volume, 2);
    assert.equal(v2.titleEn, "Outdoor Words 2");
    assert.equal(v2.quests[0].id, "quest:stage2-nature-v2-q1");
    assert.ok(v2.quests[0].scopes.every((s) => s.ref.startsWith("minigame:s2-nature-v2-q1-")));
    assert.equal(files[0].rel, "content/i18n/es/lessons-stage2-nature-v2.json");
    assert.deepEqual(Object.keys(files[0].json.entries), ["episode:stage2-nature-v2", "quest:stage2-nature-v2-q1"]);
    const root = makeRoot();
    put(root, "content/episodes/stage-2/nature.json", v1);
    const r = run(root, ["--include-fixtures"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /E2E FIXTURE MODULES/);
    assert.match(read(root, "lessons-index.ts"), /case "episode:stage2-nature-v2"/);
    assert.ok(existsSync(join(root, OUT, CHUNK_DIR, "lessons-cell-stage2-nature-v2.ts")));
    // A plain run removes it again.
    assert.equal(run(root).status, 0);
    assert.ok(!existsSync(join(root, OUT, CHUNK_DIR, "lessons-cell-stage2-nature-v2.ts")));
    assert.equal(run(root, ["--include-fixtures", "--check"]).status, 2);
  });
});

// ---- F-CURR-002 §9.1 (row CM-6): the generated catalogue rows and the addedIn stamps ----------

const { CATALOG_OUT, HAND_STAMPS, HISTORY_LAST_VERSION, addedInStamp, catalogueOf, cellRowsOf, loadSymbolKeys, readHandStamps, renderCatalogue, shapeStoryRow, shapeTopicRow, symbolKeyOf } =
  await import(SCRIPT);

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
  test("the cells and their quests are written as compact rows (ids by position), and a model that would not expand back fails", () => {
    const root = makeRoot();
    put(root, "content/episodes/stage-3/rites.json", cell("stage3", "rites"));
    put(root, "content/episodes/stage-2/life.json", cell("stage2", "life", "draft", { titleEn: "Lunch Box Words" }));
    const model = catalogueOf({ cells: readCellsOf(root) });
    assert.deepEqual(cellRowsOf(model), [
      ["stage2", "life", "Lunch Box Words", "preview", 10, []],
      ["stage3", "rites", "Holiday Words", "shipped", 13, [["Quest 1", 4, []], ["Quest 2", 4, []], ["Quest 3", 4, []]]],
    ]);
    const source = renderCatalogue(model);
    assert.match(source, /export const GENERATED_LESSON_CELL_ROWS: GeneratedCellRow\[\] = \[\n  \["stage2","life","Lunch Box Words","preview",10,\[\]\],\n/);
    assert.doesNotMatch(source, /"episodeId"|"kind"/);
    const moved = { ...model, quests: model.quests.map((q, i) => (i === 0 ? { ...q, id: "quest:stage3-rites-q9" } : q)) };
    assert.throws(() => cellRowsOf(moved), /catalogue cell episode:stage3-rites does not fit a compact row/);
    const stray = { ...model, quests: [...model.quests, { ...model.quests[0], episodeId: "episode:stage9-none" }] };
    assert.throws(() => cellRowsOf(stray), /names no generated cell \(episode:stage9-none\)/);
  });

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

  test("a hand-written quest's stamp (catalog/hand-stamps.json) counts in the version and the additions", () => {
    const root = makeRoot();
    const c = cell("stage3", "rites");
    c.quests[0].addedIn = 20261105;
    put(root, "content/episodes/stage-3/rites.json", c);
    assert.deepEqual(readHandStamps(root), {}, "absent: no hand stamps");
    put(root, HAND_STAMPS, { "quest:story-hangul-letters-read": 20261112, "quest:stage1-letters-q4": 20261105 });
    const handStamps = readHandStamps(root);
    assert.deepEqual(Object.keys(handStamps), ["quest:stage1-letters-q4", "quest:story-hangul-letters-read"], "sorted by id");
    const model = catalogueOf({ cells: readCellsOf(root), handStamps });
    assert.equal(model.version, 20261112);
    assert.deepEqual(model.additions, { 20261105: ["quest:stage1-letters-q4", "quest:stage3-rites-q1"], 20261112: ["quest:story-hangul-letters-read"] });
    assert.throws(
      () => catalogueOf({ cells: readCellsOf(root), handStamps: { "quest:stage3-rites-q2": 20261112 } }),
      /quest:stage3-rites-q2 is a quest of content\/: its addedIn goes in its own content file/,
    );
    put(root, HAND_STAMPS, { "quest:stage1-letters-q4": 2026110 });
    assert.throws(() => readHandStamps(root), /quest:stage1-letters-q4: addedIn must be a date stamp/);
    put(root, HAND_STAMPS, { "stage1-letters-q4": 20261105 });
    assert.throws(() => readHandStamps(root), /is not a quest id/);
    put(root, HAND_STAMPS, "[]");
    assert.throws(() => readHandStamps(root), /holds one object/);
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
    // A story after the frozen shelf names its festival anchor in its own file.
    assert.equal(shapeStoryRow(story("owl", { shelf: { order: 2, anchor: "chuseok" } }), "s.json").anchor, "chuseok");
    assert.equal("anchor" in shapeStoryRow(story("owl"), "s.json"), false);
    assert.throws(() => shapeStoryRow(story("owl", { shelf: { order: 2, anchor: 7 } }), "s.json"), /anchor/);
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
