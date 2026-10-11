// Self-tests for scripts/build-stories.mjs (F-STORY-001 PR 1.4).

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
const SCRIPT = join(REPO, "scripts", "build-stories.mjs");
const FIXTURES = join(
  REPO,
  "packages",
  "content-schema",
  "src",
  "__fixtures__",
  "story"
);
const GENERATED_REL = join("apps", "mobile", "src", "content", "stories.generated.ts");

const {
  GENERATED_HEADER,
  BUDGET,
  artBytes,
  buildBundle,
  checkBudget,
  levelCode,
  renderBundle,
  slugOf,
} = await import(SCRIPT);

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

function generatedOf(root) {
  return readFileSync(join(root, GENERATED_REL), "utf8");
}

/** Evaluate the generated file's three literals (they are plain JSON). */
function evaluate(source) {
  const grab = (name) => {
    const m = source.match(new RegExp(`export const ${name}: \\w+\\[\\] = ([\\s\\S]*?);\\n(?:\\nexport|$)`));
    assert.ok(m, `export ${name} not found in:\n${source.slice(0, 400)}`);
    return JSON.parse(m[1]);
  };
  return {
    storiesAll: grab("storiesAll"),
    storyEpisodes: grab("storyEpisodes"),
    storyQuests: grab("storyQuests"),
  };
}

function ready(overrides = {}) {
  return { ...readFixture("valid.ready.json"), ...overrides };
}

describe("build-stories.mjs: empty and fixture trees", () => {
  test("no content/stories directory at all: writes three empty arrays", () => {
    const root = makeRoot();
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const src = generatedOf(root);
    assert.ok(src.startsWith(GENERATED_HEADER));
    assert.match(src, /import type \{ Episode, Quest, Story \} from '@hangul-route\/content-schema';/);
    assert.match(src, /export const storiesAll: Story\[\] = \[\];/);
    assert.match(src, /export const storyEpisodes: Episode\[\] = \[\];/);
    assert.match(src, /export const storyQuests: Quest\[\] = \[\];/);
  });

  test("an empty content/stories directory behaves the same", () => {
    const root = makeRoot();
    mkdirSync(join(root, "content", "stories"), { recursive: true });
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(generatedOf(root), renderBundle({ stories: [], episodes: [], quests: [] }));
  });

  test("non-JSON files and sub-directories (research/) are not read", () => {
    const root = makeRoot();
    const dir = join(root, "content", "stories");
    mkdirSync(join(dir, "research"), { recursive: true });
    writeFileSync(join(dir, "README.md"), "# stories\n");
    writeFileSync(join(dir, "research", "x.final.json"), "{ not json at all");
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(evaluate(generatedOf(root)).storiesAll, []);
  });

  test("the three fixtures: only the ready story ships; drafts are dropped", () => {
    const root = makeRoot();
    for (const f of ["valid.ready.json", "valid.draft.json", "valid.tale.json"]) {
      const s = readFixture(f);
      putStory(root, s);
    }
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const out = evaluate(generatedOf(root));
    assert.deepEqual(out.storiesAll.map((s) => s.id), ["story:hangul-day"]);
    assert.deepEqual(out.storiesAll[0], readFixture("valid.ready.json"));
    assert.equal(out.storyEpisodes.length, 1);
    assert.equal(out.storyQuests.length, 1);
  });

  test("stories are sorted by id, not by file name ('-' sorts before '.')", () => {
    const root = makeRoot();
    putStory(root, ready({ id: "story:a-b", shelf: undefined }));
    putStory(root, ready({ id: "story:a", shelf: undefined }));
    putStory(root, ready({ id: "story:z", shelf: undefined }));
    const r = run(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(
      evaluate(generatedOf(root)).storiesAll.map((s) => s.id),
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
    run(root);
    assert.equal(generatedOf(root), first);
    assert.ok(first.endsWith("\n") && !first.endsWith("\n\n"));
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
      rewardCardIds: ["card:hanji"],
      estimatedMinutes: Math.max(3, story.minutes),
      status: "ready",
      format: "story",
      placement: "shelf",
    });

    assert.equal(quests.length, 1);
    const q = quests[0];
    assert.equal(q.id, "quest:story-hangul-day-listen");
    assert.equal(q.titleEn, story.title.en);
    assert.equal(q.estimatedMinutes, Math.max(3, story.minutes));
    assert.equal(q.rewardCardId, "card:hanji");
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
    assert.match(r.stdout, /::error file=apps\/mobile\/src\/content\/stories\.generated\.ts/);
    assert.match(r.stdout, /node scripts\/build-stories\.mjs/);
  });

  test("fails when the checked-in bundle was edited by hand", () => {
    const root = makeRoot();
    run(root);
    const file = join(root, GENERATED_REL);
    writeFileSync(file, generatedOf(root) + "// hand edit\n");
    assert.equal(run(root, ["--check"]).status, 1);
  });

  test("fails when the bundle file is missing", () => {
    const root = makeRoot();
    const r = run(root, ["--check"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /missing/);
  });

  test("--check with --out compares against that path", () => {
    const root = makeRoot();
    putStory(root, ready());
    const out = join(root, "preview.ts");
    assert.equal(run(root, ["--out", out]).status, 0);
    assert.equal(run(root, ["--check", "--out", out]).status, 0);
  });
});

describe("build-stories.mjs: --include-drafts and --out", () => {
  test("drafts are included in a preview bundle written to --out", () => {
    const root = makeRoot();
    putStory(root, readFixture("valid.ready.json"));
    putStory(root, readFixture("valid.draft.json"));
    putStory(root, readFixture("valid.tale.json"));
    const out = join(root, "preview", "stories.preview.ts");
    const r = run(root, ["--include-drafts", "--out", out]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const ids = evaluate(readFileSync(out, "utf8")).storiesAll.map((s) => s.id);
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
    const r = run(root, ["--include-drafts", "--out", join("apps", "mobile", "x.ts")]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /apps\//);
  });

  test("a relative --out resolves against the repo root", () => {
    const root = makeRoot();
    putStory(root, ready());
    const r = run(root, ["--out", join("tmp-out", "bundle.ts")]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.ok(existsSync(join(root, "tmp-out", "bundle.ts")));
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
  test("adds the ready fixtures (and their shelf episode) to the app bundle; drafts and non-stories are skipped", () => {
    const root = makeRoot();
    putFixtures(root);
    const content = ready({ id: "story:zz-content", shelf: undefined });
    putStory(root, content);
    const r = run(root, ["--include-fixtures"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const src = generatedOf(root);
    assert.ok(src.startsWith(GENERATED_HEADER));
    assert.match(src, /never commit/);
    // Content stays a typed literal; fixtures (input form) go through the schema at load time.
    const contentIds = JSON.parse(src.match(/const contentStories: Story\[\] = ([\s\S]*?);\n\n/)[1]);
    assert.deepEqual(contentIds.map((s) => s.id), ["story:zz-content"]);
    const fixtures = JSON.parse(src.match(/const fixtureStories: Story\[\] = \(([\s\S]*?) as unknown\[\]\)\.map\(\(raw\) => parseStory\(raw\)\);/)[1]);
    assert.deepEqual(fixtures.map((s) => s.id), ["story:hangul-day"]);
    assert.match(src, /import \{ parseStory, type Episode, type Quest, type Story \} from '@hangul-route\/content-schema';/);
    assert.match(src, /export const storiesAll: Story\[\] = \[\.\.\.contentStories, \.\.\.fixtureStories\]\.sort/);
    const episodes = JSON.parse(src.match(/export const storyEpisodes: Episode\[\] = ([\s\S]*?);\n\nexport/)[1]);
    assert.deepEqual(episodes.map((e) => e.id), ["episode:shelf-hangul-day"]);
    assert.match(src, /export const storyFixtureIds: string\[\] = \[\n  "story:hangul-day"\n\];\n$/);
    assert.match(r.stdout, /2 stories/);
    assert.match(r.stdout, /do not commit/i);
  });

  test("the bundle without the flag never holds a fixture, so --check fails on a fixture bundle", () => {
    const root = makeRoot();
    putFixtures(root);
    assert.equal(run(root, ["--include-fixtures"]).status, 0);
    const check = run(root, ["--check"]);
    assert.equal(check.status, 1);
    assert.equal(run(root).status, 0);
    assert.deepEqual(evaluate(generatedOf(root)).storiesAll, []);
    assert.doesNotMatch(generatedOf(root), /storyFixtureIds/);
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
    assert.match(r.stdout, /story:hangul-day\s+\d+ B raw\s+\d+ B gzip/);
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

  test("checkBudget: totals over raw or gzip ceilings fail, equal-to-ceiling passes", () => {
    const ok = {
      perStory: [{ id: "story:a", raw: BUDGET.perStoryRaw }],
      total: { raw: BUDGET.totalRaw, gzip: BUDGET.totalGzip },
    };
    assert.deepEqual(checkBudget(ok), []);
    const over = {
      perStory: [{ id: "story:a", raw: BUDGET.perStoryRaw + 1 }],
      total: { raw: BUDGET.totalRaw + 1, gzip: BUDGET.totalGzip + 1 },
    };
    const problems = checkBudget(over);
    assert.equal(problems.length, 3);
    assert.ok(problems.some((p) => /story:a/.test(p)));
    assert.ok(problems.some((p) => /gzip/.test(p)));
  });

  test("the launch budget matches the spec (1.0 MB raw, 260 KB gzip, 60 KB per story, 130 KB scene art)", () => {
    assert.equal(BUDGET.totalRaw, 1_000_000);
    assert.equal(BUDGET.totalGzip, 260_000);
    assert.equal(BUDGET.perStoryRaw, 60_000);
    assert.equal(BUDGET.artRaw, 130_000);
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

describe("build-stories.mjs: the checked-in bundle", () => {
  test("apps/mobile/src/content/stories.generated.ts is in sync with content/stories", () => {
    const r = spawnSync("node", [SCRIPT, "--check"], {
      env: { ...process.env, HANGUL_ROUTE_ROOT: "" },
      encoding: "utf8",
      cwd: REPO,
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
  });
});
