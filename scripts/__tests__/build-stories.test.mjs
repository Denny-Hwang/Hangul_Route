// Self-tests for scripts/build-stories.mjs (F-STORY-001 PR 1.4; the shelf and per-story chunks of F-CURR-002 CM-8).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "build-stories.mjs");
const FIXTURES = join(
  REPO,
  "packages",
  "content-schema",
  "src",
  "__fixtures__",
  "story"
);
const OUT_REL = join("apps", "mobile", "src", "content", "__generated__");
const GENERATED_REL = join(OUT_REL, "stories-index.ts");
const LEGACY_REL = join("apps", "mobile", "src", "content", "stories.generated.ts");

const {
  GENERATED_HEADER,
  BUDGET,
  SHELF_DEFAULTS,
  STORY_BODY_FIELDS,
  artBytes,
  buildBundle,
  buildModules,
  checkBudget,
  chunkManifest,
  heldStoryCards,
  levelCode,
  offShelfStory,
  planChunks,
  readChunkManifest,
  shelfReview,
  sizes,
  slugOf,
  splitStory,
  storyChunkName,
} = await import(SCRIPT);
const { chunkHash } = await import(join(REPO, "scripts", "build-lessons.mjs"));

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "buildstories-"));
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

function readFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

function putStory(root, story, file = `${story.id.replace("story:", "")}.json`) {
  const dir = join(root, "content", "stories");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), JSON.stringify(story, null, 2));
}

function generatedOf(root, dir = join(root, OUT_REL)) {
  return readFileSync(join(dir, "stories-index.ts"), "utf8");
}

const grab = (source, name) => {
  const m = source.match(new RegExp(`(?:export )?const ${name}[^=]* = (.*);\\n`));
  assert.ok(m, `${name} not found in:\n${source.slice(0, 400)}`);
  return JSON.parse(m[1]);
};

/** A story chunk module's hash and body (plain JSON literals). */
function chunkOf(dir, storyId) {
  const source = readFileSync(join(dir, "story-chunks", `${storyChunkName(storyId)}.ts`), "utf8");
  return { hash: JSON.parse(source.match(/export const CHUNK_HASH = (".*?");/)[1]), body: grab(source, "STORY_BODY"), source };
}

/**
 * The generated modules read back: the shelf entries, each story put back together from its shelf
 * entry and its chunk (as `storiesOverStore` does), and the held cards.
 */
function evaluate(root, dir = join(root, OUT_REL)) {
  const source = generatedOf(root, dir);
  const shelf = grab(source, "STORY_SHELF");
  const storiesAll = shelf.map((entry) => {
    const { levels: _levels, cardKeyword: _cardKeyword, chunk, review: _review, ...rest } = entry;
    const { hash, body } = chunkOf(dir, entry.id);
    assert.equal(hash, chunk, `${entry.id}: the shelf names the hash its chunk carries`);
    return { ...structuredClone(SHELF_DEFAULTS), ...rest, ...body };
  });
  return { shelf, storiesAll, heldStoryCards: grab(source, "HELD_STORY_CARDS"), source };
}

const chunkFiles = (root) => {
  const dir = join(root, OUT_REL, "story-chunks");
  return existsSync(dir) ? readdirSync(dir).sort() : [];
};

function ready(overrides = {}) {
  return { ...readFixture("valid.ready.json"), ...overrides };
}

describe("build-stories.mjs: empty and fixture trees", () => {
  test("no content/stories directory at all: writes an empty shelf, no held cards and no chunk", () => {
    const root = makeRoot();
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const src = generatedOf(root);
    assert.ok(src.startsWith(GENERATED_HEADER));
    assert.match(src, /import type \{ HeldStoryCard \} from '@hangul-route\/content-schema';/);
    assert.match(src, /import type \{ StoryBodyChunk, StoryShelfEntry \} from '\.\.\/\.\.\/logic\/story\/story-chunk-store';/);
    assert.match(src, /export const STORY_SHELF: StoryShelfEntry\[\] = \[\];/);
    assert.match(src, /export const HELD_STORY_CARDS: HeldStoryCard\[\] = \[\];/);
    assert.match(src, /export function loadStoryBody\(storyId: string\): Promise<StoryBodyChunk> \| undefined \{\n {2}switch \(storyId\) \{\n {4}default:\n {6}return undefined;\n {2}\}\n\}\n$/);
    assert.deepEqual(chunkFiles(root), []);
  });

  test("an empty content/stories directory behaves the same", () => {
    const root = makeRoot();
    mkdirSync(join(root, "content", "stories"), { recursive: true });
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(generatedOf(root), buildModules({ stories: [] })["stories-index.ts"]);
  });

  test("non-JSON files and sub-directories (research/) are not read", () => {
    const root = makeRoot();
    const dir = join(root, "content", "stories");
    mkdirSync(join(dir, "research"), { recursive: true });
    writeFileSync(join(dir, "README.md"), "# stories\n");
    writeFileSync(join(dir, "research", "x.final.json"), "{ not json at all");
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(evaluate(root).storiesAll, []);
  });

  test("the three fixtures: only the ready story ships; drafts are dropped", () => {
    const root = makeRoot();
    for (const f of ["valid.ready.json", "valid.draft.json", "valid.tale.json"]) {
      const s = readFixture(f);
      putStory(root, s);
    }
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const out = evaluate(root);
    assert.deepEqual(out.storiesAll.map((s) => s.id), ["story:hangul-day"]);
    // Shelf and chunk together are the story file, field for field.
    assert.deepEqual(out.storiesAll[0], readFixture("valid.ready.json"));
    assert.deepEqual(chunkFiles(root), ["story-hangul-day.ts"]);
    // Neither draft fixture has a card block, so no card is held.
    assert.deepEqual(out.heldStoryCards, []);
  });

  test("a held story (draft with a card and a shelf block) leaves the bundle but keeps its card (F-STORY-006 3.8)", () => {
    const root = makeRoot();
    putStory(root, ready());
    const held = ready({ id: "story:held-one", state: "draft" });
    putStory(root, held);
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const out = evaluate(root);
    assert.deepEqual(out.storiesAll.map((s) => s.id), ["story:hangul-day"]);
    assert.deepEqual(chunkFiles(root), ["story-hangul-day.ts"]);
    const keyword = held.keywords.find((k) => k.id === held.card.keywordId);
    assert.deepEqual(out.heldStoryCards, [
      {
        storyId: "story:held-one",
        titleEn: held.card.titleEn,
        keyword: { ko: keyword.ko, romanization: keyword.romanization },
        summaryEn: held.summaryEn,
        theme: held.theme,
        recommendedStage: held.recommendedStage,
      },
    ]);
    // No fact and no citation: the claims of a held story are under correction.
    assert.equal(JSON.stringify(out.heldStoryCards).includes("claimEn"), false);
  });

  test("heldStoryCards: only drafts with a card and a shelf block whose keyword resolves, sorted by id", () => {
    const draft = (id, edit = {}) => ({ ...ready({ id, state: "draft" }), ...edit });
    const card = ready().card;
    const got = heldStoryCards([
      ready({ id: "story:ready-one" }),
      draft("story:zz-held"),
      draft("story:aa-held"),
      draft("story:no-card", { card: undefined }),
      draft("story:no-shelf", { shelf: undefined }),
      draft("story:bad-keyword", { card: { ...card, keywordId: "nope" } }),
    ]);
    assert.deepEqual(got.map((h) => h.storyId), ["story:aa-held", "story:zz-held"]);
    assert.deepEqual(heldStoryCards([]), []);
  });

  test("stories are sorted by id, not by file name ('-' sorts before '.')", () => {
    const root = makeRoot();
    putStory(root, ready({ id: "story:a-b", shelf: undefined }));
    putStory(root, ready({ id: "story:a", shelf: undefined }));
    putStory(root, ready({ id: "story:z", shelf: undefined }));
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(
      evaluate(root).storiesAll.map((s) => s.id),
      ["story:a", "story:a-b", "story:z"]
    );
    const unsorted = buildBundle([ready({ id: "story:z" }), ready({ id: "story:b" })]);
    assert.deepEqual(unsorted.stories.map((s) => s.id), ["story:b", "story:z"]);
    assert.deepEqual(unsorted.episodes.map((e) => e.id), ["episode:shelf-b", "episode:shelf-z"]);
  });

  test("output is deterministic and ends with a newline", () => {
    const root = makeRoot();
    putStory(root, ready());
    run(root);
    const first = generatedOf(root);
    const chunk = chunkOf(join(root, OUT_REL), "story:hangul-day").source;
    run(root);
    assert.equal(generatedOf(root), first);
    assert.equal(chunkOf(join(root, OUT_REL), "story:hangul-day").source, chunk);
    for (const text of [first, chunk]) assert.ok(text.endsWith("\n") && !text.endsWith("\n\n"));
  });
});

describe("build-stories.mjs: the shelf and the chunks (F-CURR-002 CM-8)", () => {
  test("the shelf keeps each story without its body; the body is one chunk named after the story", () => {
    const story = ready();
    const { shelf, body } = splitStory(story);
    for (const field of STORY_BODY_FIELDS.filter((f) => f !== "review")) {
      assert.equal(field in shelf, false, `${field} is not in the shelf`);
      if (story[field] !== undefined) assert.deepEqual(body[field], story[field], field);
    }
    assert.equal("tiers" in shelf, false);
    assert.deepEqual(shelf.title, story.title);
    assert.deepEqual(shelf.shelf, story.shelf);
    assert.equal(shelf.hoyaIntroEn, story.hoyaIntroEn);
    // The levels of the tiers and their scene counts, so the index and the books need no chunk.
    assert.deepEqual(shelf.levels, story.tiers.map((t) => ({ level: t.level, scenes: t.scenes.length })));
    // The card's keyword, so a card's face needs no chunk.
    assert.deepEqual(shelf.cardKeyword, story.keywords.find((k) => k.id === story.card.keywordId));
    // The review gate in the shelf, the whole block in the body.
    assert.deepEqual(shelf.review, {
      language: story.review.language,
      culture: story.review.culture,
      advisory: story.review.advisory,
      advisoryNoteEn: story.review.advisoryNoteEn,
    });
    assert.equal("reviewedBy" in shelf.review, false);
    assert.deepEqual(body.review, story.review);
    assert.equal(storyChunkName("story:hangul-day"), "story-hangul-day");
  });

  test("shelf fields holding the schema default are left out; others stay", () => {
    const { shelf } = splitStory(ready({ pillarTags: [], companionId: "hoya", cultureNotes: [] }));
    for (const key of Object.keys(SHELF_DEFAULTS)) assert.equal(key in shelf, false, key);
    const tagged = splitStory(ready({ pillarTags: ["A1"] })).shelf;
    assert.deepEqual(tagged.pillarTags, ["A1"]);
    assert.deepEqual(SHELF_DEFAULTS, { pillarTags: [], companionId: "hoya", cultureNotes: [] });
  });

  test("shelfReview keeps the two sign-offs and the advisory only when there is one", () => {
    assert.deepEqual(shelfReview({ language: "native-reviewed", culture: "culture-reviewed", advisory: [], reviewedBy: "MAR", reviewedAt: "2026-10-14" }), {
      language: "native-reviewed",
      culture: "culture-reviewed",
    });
    assert.deepEqual(shelfReview({ language: "draft", culture: "draft", advisory: ["mild-peril"], advisoryNoteEn: "A tiger chases." }), {
      language: "draft",
      culture: "draft",
      advisory: ["mild-peril"],
      advisoryNoteEn: "A tiger chases.",
    });
  });

  test("each chunk carries the hash of its data, and the shelf names it (the same hashing as the lesson chunks)", () => {
    const root = makeRoot();
    putStory(root, ready());
    putStory(root, ready({ id: "story:other", shelf: undefined }));
    assert.equal(run(root).status, 0);
    const { shelf } = evaluate(root);
    const plan = planChunks([ready(), ready({ id: "story:other", shelf: undefined })]);
    for (const c of plan.chunks) {
      const { hash, body } = chunkOf(join(root, OUT_REL), c.id);
      assert.equal(hash, chunkHash(JSON.stringify(body)));
      assert.equal(hash, c.hash);
      assert.equal(shelf.find((e) => e.id === c.id).chunk, hash);
    }
    assert.deepEqual(chunkManifest([ready()]), [{ name: "story-hangul-day", hash: plan.chunks[0].hash }]);
    // A story edit changes its own chunk's hash only.
    const edited = planChunks([ready({ contentVer: 9 }), ready({ id: "story:other", shelf: undefined })]);
    assert.notEqual(edited.chunks[0].hash, plan.chunks[0].hash);
    assert.equal(edited.chunks[1].hash, plan.chunks[1].hash);
  });

  test("the shelf reaches each chunk only through a literal import() of loadStoryBody, never statically", () => {
    const root = makeRoot();
    putStory(root, ready());
    assert.equal(run(root).status, 0);
    const src = generatedOf(root);
    assert.match(src, /case "story:hangul-day":\n {6}return import\('\.\/story-chunks\/story-hangul-day'\);/);
    assert.doesNotMatch(src, /from '\.\/story-chunks/);
    assert.doesNotMatch(src, /"tiers"/);
    const chunk = chunkOf(join(root, OUT_REL), "story:hangul-day").source;
    assert.ok(chunk.startsWith(GENERATED_HEADER));
    assert.match(chunk, /import type \{ StoryBodyChunk \} from '\.\.\/\.\.\/\.\.\/logic\/story\/story-chunk-store';/);
    assert.match(chunk, /export const STORY_BODY: StoryBodyChunk\['STORY_BODY'\] = \{/);
  });

  test("a run removes the chunk of a story that no longer ships, and the one-file bundle of F-STORY-001", () => {
    const root = makeRoot();
    putStory(root, ready());
    putStory(root, ready({ id: "story:gone", shelf: undefined }));
    assert.equal(run(root).status, 0);
    assert.deepEqual(chunkFiles(root), ["story-gone.ts", "story-hangul-day.ts"]);
    putStory(root, ready({ id: "story:gone", shelf: undefined, state: "draft" }));
    mkdirSync(dirname(join(root, LEGACY_REL)), { recursive: true });
    writeFileSync(join(root, LEGACY_REL), "// old bundle\n");
    const check = run(root, ["--check"]);
    assert.equal(check.status, 1);
    assert.match(check.stdout, /story-gone\.ts::generated story module is no longer built/);
    assert.match(check.stdout, /stories\.generated\.ts::the one-file story bundle is no longer built/);
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /removed 1 no longer built/);
    assert.deepEqual(chunkFiles(root), ["story-hangul-day.ts"]);
    assert.equal(existsSync(join(root, LEGACY_REL)), false);
    assert.equal(run(root, ["--check"]).status, 0);
  });

  test("readChunkManifest lists the chunks of the ready stories of content/stories (pwa-postbuild reads it)", () => {
    const root = makeRoot();
    putStory(root, ready());
    putStory(root, ready({ id: "story:draft-one", state: "draft" }));
    assert.deepEqual(readChunkManifest(root), chunkManifest([ready()]));
    assert.deepEqual(readChunkManifest(makeRoot()), []);
  });
});

describe("build-stories.mjs: shelf episodes and quests", () => {
  test("a shelf story derives its episode and its five-step quest (spec 3.9)", () => {
    const story = ready();
    const { episodes, quests } = buildBundle([story]);
    assert.equal(episodes.length, 1);
    assert.deepEqual(episodes[0], {
      id: "episode:shelf-hangul-day",
      stage: "stage1",
      theme: story.theme,
      order: 100 + story.shelf.order,
      titleEn: story.title.en,
      hoyaIntroEn: story.hoyaIntroEn,
      questIds: ["quest:story-hangul-day-listen"],
      rewardCardIds: ["card:story-hangul-day"],
      estimatedMinutes: Math.max(3, story.minutes),
      status: "ready",
      format: "story",
      placement: "shelf",
      pillarTags: ["A1"],
      companionId: "hoya",
    });

    assert.equal(quests.length, 1);
    const q = quests[0];
    assert.equal(q.id, "quest:story-hangul-day-listen");
    assert.equal(q.titleEn, story.title.en);
    assert.equal(q.estimatedMinutes, Math.max(3, story.minutes));
    assert.equal(q.rewardCardId, "card:story-hangul-day");
    assert.deepEqual(
      q.steps.map((s) => [s.id, s.kind]),
      [
        ["s1", "intro"],
        ["s2", "present"],
        ["s3", "practice"],
        ["s4", "apply"],
        ["s5", "reward"],
      ]
    );
    assert.equal(q.steps[0].hoyaLineEn, story.hoyaIntroEn);
    assert.equal(q.steps[4].hoyaLineEn, story.hoyaOutroEn);
    assert.deepEqual(
      q.steps.slice(1, 4).map((s) => [s.titleEn, s.minigameKind, s.minigameRef]),
      [
        ["Read the story", "story-read", "minigame:story-read-listen-hangul-day"],
        ["A few questions", "story-check", "minigame:story-check-listen-hangul-day"],
        ["Put the story in order", "story-sequence", "minigame:story-seq-listen-hangul-day"],
      ]
    );
  });

  test("the shelf episode copies pillarTags and companionId from its story (F-STORY-005 3.2)", () => {
    const tagged = buildBundle([ready({ pillarTags: ["B5", "C1"], companionId: "hoya" })]);
    assert.deepEqual(tagged.episodes[0].pillarTags, ["B5", "C1"]);
    assert.equal(tagged.episodes[0].companionId, "hoya");
    const story = ready({ pillarTags: ["E3"] });
    buildBundle([story]).episodes[0].pillarTags.push("E4");
    assert.deepEqual(story.pillarTags, ["E3"], "the episode holds a copy, not the story's array");
  });

  test("a story file without the catalogue fields gets the schema defaults on its shelf episode", () => {
    const story = ready();
    delete story.pillarTags;
    delete story.companionId;
    const [episode] = buildBundle([story]).episodes;
    assert.deepEqual(episode.pillarTags, []);
    assert.equal(episode.companionId, "hoya");
  });

  test("minutes below 3 are raised to 3 for episode and quest", () => {
    const story = ready({ minutes: 2 });
    const { episodes, quests } = buildBundle([story]);
    assert.equal(episodes[0].estimatedMinutes, 3);
    assert.equal(quests[0].estimatedMinutes, 3);
  });

  test("no rewardCardIds.listen: empty rewardCardIds and no quest rewardCardId", () => {
    const story = ready({ rewardCardIds: { read: "card:book" } });
    const { episodes, quests } = buildBundle([story]);
    assert.deepEqual(episodes[0].rewardCardIds, []);
    assert.equal("rewardCardId" in quests[0], false);
    const none = ready({ rewardCardIds: undefined });
    assert.deepEqual(buildBundle([none]).episodes[0].rewardCardIds, []);
  });

  test("a ready story without a shelf block ships in storiesAll but has no episode or quest", () => {
    const story = ready({ shelf: undefined });
    const b = buildBundle([story]);
    assert.equal(b.stories.length, 1);
    assert.deepEqual(b.episodes, []);
    assert.deepEqual(b.quests, []);
  });

  test("the quest uses the listen tier; a read-along-only story uses the 'along' code", () => {
    const story = ready();
    story.tiers = story.tiers.filter((t) => t.level === "read-along");
    const { quests, episodes } = buildBundle([story]);
    assert.equal(quests[0].id, "quest:story-hangul-day-along");
    assert.equal(episodes[0].questIds[0], "quest:story-hangul-day-along");
    assert.equal(quests[0].steps[1].minigameRef, "minigame:story-read-along-hangul-day");
  });

  test("a shelf story without hoyaIntroEn or hoyaOutroEn is rejected", () => {
    assert.throws(() => buildBundle([ready({ hoyaIntroEn: undefined })]), /hoyaIntroEn/);
    assert.throws(() => buildBundle([ready({ hoyaOutroEn: undefined })]), /hoyaOutroEn/);
  });

  test("a shelf story without tiers is rejected", () => {
    assert.throws(() => buildBundle([ready({ tiers: [] })]), /tier/);
  });

  test("helpers: slugOf and levelCode", () => {
    assert.equal(slugOf("story:seollal-new-year"), "seollal-new-year");
    assert.equal(levelCode("listen"), "listen");
    assert.equal(levelCode("read-along"), "along");
    assert.equal(levelCode("read"), "read");
    assert.throws(() => levelCode("nope"), /level/);
    assert.throws(() => slugOf("seollal"), /story id/);
  });
});

describe("build-stories.mjs: input errors", () => {
  test("invalid JSON fails with an annotation naming the file", () => {
    const root = makeRoot();
    const dir = join(root, "content", "stories");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "broken.json"), "{ nope");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/stories\/broken\.json/);
    assert.equal(existsSync(join(root, GENERATED_REL)), false);
  });

  test("a file name that is not <slug>.json for its id fails", () => {
    const root = makeRoot();
    putStory(root, ready(), "other-name.json");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /hangul-day\.json/);
  });

  test("an unknown state fails", () => {
    const root = makeRoot();
    putStory(root, ready({ state: "published" }));
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /state/);
  });

  test("a malformed id fails", () => {
    const root = makeRoot();
    putStory(root, ready({ id: "hangul-day" }), "hangul-day.json");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /story id/);
  });

  test("a top-level JSON value that is not an object fails", () => {
    const root = makeRoot();
    const dir = join(root, "content", "stories");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "list.json"), "[1, 2]");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /object/);
  });

  test("unknown flags and a missing --out value fail with usage", () => {
    const root = makeRoot();
    const bad = run(root, ["--nope"]);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /Usage/);
    const noOut = run(root, ["--out"]);
    assert.equal(noOut.status, 2);
  });
});

describe("build-stories.mjs: --check", () => {
  test("passes right after a build, and does not write", () => {
    const root = makeRoot();
    putStory(root, ready());
    assert.equal(run(root).status, 0);
    const before = generatedOf(root);
    const r = run(root, ["--check"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(generatedOf(root), before);
  });

  test("passes on an empty tree against an empty checked-in bundle", () => {
    const root = makeRoot();
    assert.equal(run(root).status, 0);
    assert.equal(run(root, ["--check"]).status, 0);
  });

  test("fails when a story changed but the bundle was not rebuilt", () => {
    const root = makeRoot();
    putStory(root, ready());
    run(root);
    putStory(root, ready({ contentVer: 2 }));
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=apps\/mobile\/src\/content\/__generated__\/story-chunks\/story-hangul-day\.ts/);
    assert.match(r.stdout, /node scripts\/build-stories\.mjs/);
  });

  test("fails when the checked-in shelf or a chunk was edited by hand", () => {
    const root = makeRoot();
    putStory(root, ready());
    run(root);
    const file = join(root, GENERATED_REL);
    writeFileSync(file, generatedOf(root) + "// hand edit\n");
    assert.equal(run(root, ["--check"]).status, 1);
    run(root);
    const chunk = join(root, OUT_REL, "story-chunks", "story-hangul-day.ts");
    writeFileSync(chunk, readFileSync(chunk, "utf8") + "// hand edit\n");
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /story-hangul-day\.ts::generated story module is missing or out of date/);
  });

  test("fails when the bundle file is missing", () => {
    const root = makeRoot();
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /missing/);
  });

  test("--check with --out compares against that folder", () => {
    const root = makeRoot();
    putStory(root, ready());
    const out = join(root, "preview");
    assert.equal(run(root, ["--out", out]).status, 0);
    assert.equal(run(root, ["--check", "--out", out]).status, 0);
    assert.equal(existsSync(join(root, GENERATED_REL)), false);
  });
});

describe("build-stories.mjs: --include-drafts and --out", () => {
  test("drafts are included in preview modules written to --out", () => {
    const root = makeRoot();
    putStory(root, readFixture("valid.ready.json"));
    putStory(root, readFixture("valid.draft.json"));
    putStory(root, readFixture("valid.tale.json"));
    const out = join(root, "preview", "stories");
    const r = run(root, ["--include-drafts", "--out", out]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const ids = evaluate(root, out).storiesAll.map((s) => s.id);
    assert.deepEqual(ids, ["story:hangul-day", "story:hangul-day-draft", "story:sun-and-moon-fixture"]);
    assert.equal(existsSync(join(root, GENERATED_REL)), false);
  });

  test("--include-drafts without --out is refused (never writes the app bundle)", () => {
    const root = makeRoot();
    const r = run(root, ["--include-drafts"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--out/);
    assert.equal(existsSync(join(root, GENERATED_REL)), false);
  });

  test("--include-drafts into apps/ is refused", () => {
    const root = makeRoot();
    const r = run(root, ["--include-drafts", "--out", join("apps", "mobile", "x")]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /apps\//);
  });

  test("a relative --out resolves against the repo root", () => {
    const root = makeRoot();
    putStory(root, ready());
    const r = run(root, ["--out", "tmp-out"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.ok(existsSync(join(root, "tmp-out", "stories-index.ts")));
    assert.ok(existsSync(join(root, "tmp-out", "story-chunks", "story-hangul-day.ts")));
  });
});

/** Copy the content-schema story fixtures (and the non-story research file) into a temp root. */
function putFixtures(root, names = ["valid.ready.json", "valid.draft.json", "valid.tale.json", "research-numbers.json"]) {
  const dir = join(root, "packages", "content-schema", "src", "__fixtures__", "story");
  mkdirSync(dir, { recursive: true });
  for (const name of names) writeFileSync(join(dir, name), readFileSync(join(FIXTURES, name), "utf8"));
  return dir;
}

describe("build-stories.mjs: --include-fixtures (F-STORY-002 PR 2.6a, e2e builds only)", () => {
  test("adds the ready fixtures to the shelf with their bodies inline; drafts and non-stories are skipped", () => {
    const root = makeRoot();
    putFixtures(root);
    const content = ready({ id: "story:zz-content", shelf: undefined });
    putStory(root, content);
    const r = run(root, ["--include-fixtures"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const src = generatedOf(root);
    assert.ok(src.startsWith(GENERATED_HEADER));
    assert.match(src, /never commit/);
    // Content stays a typed shelf entry with its chunk; fixtures (input form) go through the schema at load time.
    assert.deepEqual(grab(src, "contentShelf").map((s) => s.id), ["story:zz-content"]);
    assert.deepEqual(chunkFiles(root), ["story-zz-content.ts"]);
    const fixtures = JSON.parse(src.match(/const fixtures = \((.*) as unknown\[\]\)\.map\(\(raw\) => splitStory\(parseStory\(raw\), 'inline'\)\);/)[1]);
    assert.deepEqual(fixtures.map((s) => s.id), ["story:hangul-day"]);
    assert.match(src, /import \{ parseStory, type HeldStoryCard \} from '@hangul-route\/content-schema';/);
    assert.match(src, /export const HELD_STORY_CARDS: HeldStoryCard\[\] = \[\];/);
    assert.match(src, /export const STORY_SHELF: StoryShelfEntry\[\] = \[\.\.\.contentShelf, \.\.\.fixtures\.map\(\(f\) => f\.entry\)\]\.sort/);
    assert.match(src, /export const STORY_INLINE_BODIES: Readonly<Record<string, StoryBody>> = Object\.fromEntries/);
    assert.match(src, /export const STORY_FIXTURE_IDS: string\[\] = \["story:hangul-day"\];/);
    // The content story's chunk loads as in a release build; the fixtures have none.
    assert.match(src, /case "story:zz-content":/);
    assert.doesNotMatch(src, /case "story:hangul-day":/);
    assert.match(r.stdout, /2 stories/);
    assert.match(r.stdout, /do not commit/i);
  });

  test("content stories ship off the shelf: no shelf, card or listen reward, so the fixtures alone fill the shelf (F-STORY-001 PR 1.9)", () => {
    const root = makeRoot();
    putFixtures(root);
    putStory(root, ready({ id: "story:zz-content", rewardCardIds: { listen: "card:story-zz-content" }, card: { titleEn: "Content", keywordId: "sejong", factId: "f1" } }));
    const r = run(root, ["--include-fixtures"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const src = generatedOf(root);
    const [content] = grab(src, "contentShelf");
    assert.equal(content.id, "story:zz-content");
    assert.equal(content.shelf, undefined);
    assert.equal(content.card, undefined);
    assert.equal(content.rewardCardIds?.listen, undefined);
    // So no shelf episode is derived for it (the app derives the episodes from the shelf).
    assert.deepEqual(buildBundle([offShelfStory(ready({ id: "story:zz-content" }))]).episodes, []);
    // The release modules keep the content story on its shelf.
    assert.equal(run(root).status, 0);
    const released = evaluate(root);
    assert.ok(released.storiesAll[0].shelf);
    assert.deepEqual(buildBundle(released.storiesAll).episodes.map((e) => e.id), ["episode:shelf-zz-content"]);
  });

  test("the bundle without the flag never holds a fixture, so --check fails on a fixture bundle", () => {
    const root = makeRoot();
    putFixtures(root);
    assert.equal(run(root, ["--include-fixtures"]).status, 0);
    const check = run(root, ["--check"]);
    assert.equal(check.status, 1);
    assert.equal(run(root).status, 0);
    assert.deepEqual(evaluate(root).storiesAll, []);
    assert.doesNotMatch(generatedOf(root), /STORY_FIXTURE_IDS|STORY_INLINE_BODIES/);
    assert.equal(run(root, ["--check"]).status, 0);
  });

  test("a fixture whose id is also a content story fails (content and fixtures never mix silently)", () => {
    const root = makeRoot();
    putFixtures(root, ["valid.ready.json"]);
    putStory(root, ready());
    const r = run(root, ["--include-fixtures"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /story:hangul-day/);
    assert.match(r.stdout, /fixture/);
  });

  test("is refused with --check, --report or --include-drafts, and without a fixture directory", () => {
    const root = makeRoot();
    for (const other of ["--check", "--report", "--include-drafts"]) {
      const r = run(root, ["--include-fixtures", other]);
      assert.equal(r.status, 2, other);
      assert.match(r.stderr, /--include-fixtures/);
    }
    const missing = run(root, ["--include-fixtures"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /__fixtures__/);
    assert.equal(existsSync(join(root, GENERATED_REL)), false);
  });

  test("a fixture file that is not JSON fails with an annotation naming it", () => {
    const root = makeRoot();
    const dir = putFixtures(root, ["valid.ready.json"]);
    writeFileSync(join(dir, "broken.json"), "{ nope");
    const r = run(root, ["--include-fixtures"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /broken\.json/);
  });
});

describe("build-stories.mjs: --report and the bundle budget", () => {
  test("prints per-story and total bytes raw and gzip, exits 0 under budget, writes nothing", () => {
    const root = makeRoot();
    putStory(root, ready());
    const r = run(root, ["--report"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /story:hangul-day\s+chunk \d+ B raw\s+\d+ B gzip/);
    assert.match(r.stdout, /stories-index\.ts \(start\)\s+\d+ B raw\s+\d+ B gzip/);
    assert.match(r.stdout, /manifest \(start: lessons-index\.ts \d+ B \+ stories-index\.ts\)\s+\d+ B raw \(budget 60000 B\)/);
    assert.match(r.stdout, /total\s+\d+ B raw\s+\d+ B gzip/);
    assert.match(r.stdout, /1 stor(y|ies)/);
    assert.equal(existsSync(join(root, GENERATED_REL)), false);
  });

  test("an empty tree reports zero stories and passes", () => {
    const root = makeRoot();
    const r = run(root, ["--report"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /0 stories/);
  });

  test("a single story over the per-story ceiling fails the report", () => {
    const root = makeRoot();
    putStory(root, ready({ authorNotes: "x".repeat(BUDGET.perStoryRaw + 1) }));
    const r = run(root, ["--report"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error/);
    assert.match(r.stdout, /story:hangul-day/);
  });

  test("checkBudget: a chunk, the manifest or the totals over their ceilings fail, equal-to-ceiling passes", () => {
    const ok = {
      perStory: [{ id: "story:a", raw: BUDGET.perStoryRaw }],
      manifest: { raw: BUDGET.manifestRaw, lessons: 100 },
      total: { raw: BUDGET.totalRaw, gzip: BUDGET.totalGzip },
    };
    assert.deepEqual(checkBudget(ok), []);
    const over = {
      perStory: [{ id: "story:a", raw: BUDGET.perStoryRaw + 1 }],
      manifest: { raw: BUDGET.manifestRaw + 1, lessons: 100 },
      total: { raw: BUDGET.totalRaw + 1, gzip: BUDGET.totalGzip + 1 },
    };
    const problems = checkBudget(over);
    assert.equal(problems.length, 4);
    assert.ok(problems.some((p) => /story:a's chunk/.test(p)));
    assert.ok(problems.some((p) => /start-loaded manifest \(lessons-index\.ts 100 B \+ stories-index\.ts \d+ B\)/.test(p)));
    assert.ok(problems.some((p) => /gzip/.test(p)));
  });

  test("the budget matches the spec (F-CURR-002 section 10: 70 KB per story chunk, 2 MB raw in total, the gzip line from the CM-8 measurement, the 60 KB manifest, 130 KB scene art)", () => {
    assert.equal(BUDGET.perStoryRaw, 70_000);
    assert.equal(BUDGET.totalRaw, 2_000_000);
    // CM-8 measured 869,644 B raw / 220,524 B gzip; the gzip line keeps that ratio up to the raw line.
    assert.equal(BUDGET.totalGzip, 510_000);
    assert.ok(BUDGET.totalGzip >= Math.ceil((220_524 * BUDGET.totalRaw) / 869_644));
    assert.equal(BUDGET.manifestRaw, 60_000);
    assert.equal(BUDGET.artRaw, 130_000);
  });

  test("sizes: each chunk module, the shelf, the manifest with the lessons and the total of every story module", () => {
    const stories = [ready(), ready({ id: "story:b", shelf: undefined })];
    const modules = buildModules({ stories });
    const report = sizes(stories, modules, "x".repeat(10));
    assert.deepEqual(report.perStory.map((s) => s.id), ["story:b", "story:hangul-day"]);
    assert.equal(report.perStory[1].raw, Buffer.byteLength(modules["story-chunks/story-hangul-day.ts"]));
    assert.equal(report.shelf.raw, Buffer.byteLength(modules["stories-index.ts"]));
    assert.deepEqual(report.manifest, { raw: 10 + report.shelf.raw, lessons: 10 });
    assert.equal(report.total.raw, Object.values(modules).reduce((n, m) => n + Buffer.byteLength(m), 0));
  });

  test("artBytes: compact JSON bytes of every scene's art, and the scenes that have it", () => {
    const art = { setting: "scene:hanji-backdrop", layers: [{ ref: "prop:pine", x: 1, y: 2, s: 1 }], altEn: "A pine — on hanji." };
    const story = { id: "story:a", tiers: [{ scenes: [{ id: "s1", art }, { id: "s2", artPending: true }] }, { scenes: [{ id: "s1", art }] }] };
    const one = Buffer.byteLength(JSON.stringify(art), "utf8");
    assert.deepEqual(artBytes([story, { id: "story:b", tiers: [] }]), { raw: 2 * one, scenes: 2 });
    assert.deepEqual(artBytes([]), { raw: 0, scenes: 0 });
  });

  test("checkBudget: scene art over 130 KB raw fails, equal passes, absent is not checked", () => {
    const base = { perStory: [], total: { raw: 1, gzip: 1 } };
    // No manifest measure (a caller without the lessons) is not checked.
    assert.deepEqual(checkBudget(base), []);
    assert.deepEqual(checkBudget({ ...base, art: { raw: BUDGET.artRaw, scenes: 1 } }), []);
    const problems = checkBudget({ ...base, art: { raw: BUDGET.artRaw + 1, scenes: 1 } });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /scene art/);
  });

  test("--report prints the scene-art total of the bundled stories", () => {
    const root = makeRoot();
    putStory(root, ready());
    const r = run(root, ["--report"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /scene art\s+\d+ B raw over 7 scenes \(budget 130000 B\)/);
  });
});

describe("build-stories.mjs: the checked-in modules", () => {
  test("apps/mobile/src/content/__generated__/stories-index.ts and story-chunks/ are in sync with content/stories", () => {
    const r = spawnSync("node", [SCRIPT, "--check"], {
      env: { ...process.env, HANGUL_ROUTE_ROOT: "" },
      encoding: "utf8",
      cwd: REPO,
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
  });
});

describe("build-stories.mjs: offShelfStory (the e2e fixture bundle)", () => {
  const base = { id: "story:x", shelf: { category: "letters" }, card: { titleEn: "X" }, title: { ko: "x" } };

  test("a story without rewardCardIds drops shelf and card and gains no rewardCardIds key", () => {
    const out = offShelfStory(base);
    assert.deepEqual(out, { id: "story:x", title: { ko: "x" } });
    assert.equal("rewardCardIds" in out, false);
  });

  test("a listen-only reward is dropped with the key", () => {
    const out = offShelfStory({ ...base, rewardCardIds: { listen: "card:x" } });
    assert.equal("rewardCardIds" in out, false);
  });

  test("listen plus other rewards keeps the others", () => {
    const out = offShelfStory({ ...base, rewardCardIds: { listen: "card:x", read: "card:y" } });
    assert.deepEqual(out, { id: "story:x", title: { ko: "x" }, rewardCardIds: { read: "card:y" } });
  });

  test("does not change its input", () => {
    const input = { ...base, rewardCardIds: { listen: "card:x" } };
    offShelfStory(input);
    assert.deepEqual(input.rewardCardIds, { listen: "card:x" });
    assert.ok(input.shelf && input.card);
  });
});
