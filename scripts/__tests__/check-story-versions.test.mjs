// Self-tests for scripts/check-story-versions.mjs (F-STORY-001 §3.7, PR 1.5).
//
// The rules run on git-less fixtures: the base text (the file on main) and the
// head text (the file in the pull request) are passed in. The fixture is
// story-shaped JSON read as plain JSON (no zod), like the script itself.
// One end-to-end run uses a throwaway git repository for the CLI glue.

import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkRemovedStory, checkStoryVersions, isStoryFile } from "../check-story-versions.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "..", "check-story-versions.mjs");
const WORKFLOW = resolve(HERE, "..", "..", ".github", "workflows", "content-validation.yml");
const BASE_TEXT = readFileSync(join(HERE, "__fixtures__", "story-versions", "ready.json"), "utf8");
const PATH = "content/stories/fixture-rain-gauge.json";

/** A fresh copy of the base story. */
function base() {
  return JSON.parse(BASE_TEXT);
}

function text(story) {
  return `${JSON.stringify(story, null, 2)}\n`;
}

/** Findings for base -> edit(base copy). `baseEdit` changes the base first. */
function check(edit, baseEdit) {
  const b = base();
  if (baseEdit) baseEdit(b);
  const h = structuredClone(b);
  edit(h);
  return checkStoryVersions({ path: PATH, baseText: text(b), headText: text(h) });
}

function codes(findings) {
  return findings.map((f) => f.code).sort();
}

describe("check-story-versions: unchanged and exempt edits", () => {
  test("an unchanged story has no findings", () => {
    assert.deepEqual(check(() => {}), []);
  });

  test("key order and whitespace are not changes", () => {
    const b = base();
    const reordered = Object.fromEntries(Object.entries(b).reverse());
    assert.deepEqual(checkStoryVersions({ path: PATH, baseText: BASE_TEXT, headText: JSON.stringify(reordered) }), []);
  });

  test("edits only to errata (appended), verification, review and shelf need no bump", () => {
    const findings = check((s) => {
      s.errata.push({ id: "e2", date: "2026-10-12", kind: "clarification", factIds: ["f1"], summaryEn: "Clearer.", fixedInVer: 2, show: false });
      s.verification.checkedAt = "2026-10-12";
      s.verification.notes = "Re-read every source.";
      s.review.language = "native-reviewed";
      s.shelf = { order: 1, minutes: 4 };
    });
    assert.deepEqual(findings, []);
  });

  test("raising contentVer alone is allowed", () => {
    assert.deepEqual(check((s) => { s.contentVer = 3; }), []);
  });

  test("a hold (ready to draft, nothing else) needs no bump", () => {
    assert.deepEqual(check((s) => { s.state = "draft"; }), []);
  });
});

describe("check-story-versions: content-ver-not-bumped", () => {
  test("narration edited without raising contentVer (spec §4 case 10)", () => {
    const findings = check((s) => { s.tiers.standard.scenes[1].narrationEn = "They made a bronze cup to catch it."; });
    assert.deepEqual(codes(findings), ["content-ver-not-bumped"]);
    assert.equal(findings[0].path, PATH);
    assert.match(findings[0].message, /contentVer/);
  });

  test("raising contentVer clears it", () => {
    assert.deepEqual(check((s) => {
      s.tiers.standard.scenes[1].narrationEn = "They made a bronze cup to catch it.";
      s.contentVer = 3;
    }), []);
  });

  test("a new keyword, a title change, or a removed top-level field each need a bump", () => {
    assert.deepEqual(codes(check((s) => { s.keywords.push({ id: "cup", ko: "컵", romanization: "keop", en: "cup" }); })), ["content-ver-not-bumped"]);
    assert.deepEqual(codes(check((s) => { s.title.en = "The Rain Cup"; })), ["content-ver-not-bumped"]);
    assert.deepEqual(codes(check((s) => { delete s.summaryEn; })), ["content-ver-not-bumped"]);
  });

  test("a fact change needs both the fact rev and contentVer: rev alone still misses contentVer", () => {
    const findings = check((s) => {
      s.facts[0].claimEn = "Farmers needed to know how much rain had fallen.";
      s.facts[0].rev = 2;
    });
    assert.deepEqual(codes(findings), ["content-ver-not-bumped"]);
  });
});

describe("check-story-versions: fact-rev-not-bumped", () => {
  for (const [label, edit] of [
    ["claimEn", (f) => { f.claimEn = "Farmers wanted to know the rainfall."; }],
    ["claimKo", (f) => { f.claimKo = "농사에는 비의 양이 중요했다."; }],
    ["a source url", (f) => { f.sources[0].url = "https://example.org/one-moved"; }],
    ["a source quote", (f) => { f.sources[0].quoteOrLocator = "section 1, line 2"; }],
    ["an added source", (f) => { f.sources.push({ ...f.sources[0], url: "https://example.org/extra" }); }],
  ]) {
    test(`${label} changed with the same rev`, () => {
      const findings = check((s) => { edit(s.facts[0]); s.contentVer = 3; });
      assert.deepEqual(codes(findings), ["fact-rev-not-bumped"]);
      assert.match(findings[0].message, /f1/);
    });
  }

  test("raising rev (and contentVer) clears it", () => {
    assert.deepEqual(check((s) => { s.facts[0].claimEn = "Farmers wanted to know the rainfall."; s.facts[0].rev = 2; s.contentVer = 3; }), []);
  });

  test("a scope change is not a claim or source change (contentVer only)", () => {
    assert.deepEqual(check((s) => { s.facts[0].scope = "in-the-tale"; s.contentVer = 3; }), []);
  });

  test("a new fact needs no rev check, only the contentVer bump", () => {
    const fact = { ...structuredClone(base().facts[0]), id: "f3", rev: 1 };
    assert.deepEqual(codes(check((s) => { s.facts.push(fact); })), ["content-ver-not-bumped"]);
    assert.deepEqual(check((s) => { s.facts.push(fact); s.contentVer = 3; }), []);
  });
});

describe("check-story-versions: fact-removed-silently", () => {
  test("a fact present on main and missing now, without a removal erratum", () => {
    const findings = check((s) => { s.facts.pop(); s.contentVer = 3; });
    assert.deepEqual(codes(findings), ["fact-removed-silently"]);
    assert.match(findings[0].message, /f2/);
  });

  test("an erratum of another kind naming the fact does not count", () => {
    const findings = check((s) => {
      s.facts.pop();
      s.contentVer = 3;
      s.errata.push({ id: "e2", date: "2026-10-12", kind: "correction", factIds: ["f2"], summaryEn: "x", fixedInVer: 3, show: true });
    });
    assert.deepEqual(codes(findings), ["fact-removed-silently"]);
  });

  test("a removal erratum naming the fact clears it", () => {
    assert.deepEqual(check((s) => {
      s.facts.pop();
      s.contentVer = 3;
      s.errata.push({ id: "e2", date: "2026-10-12", kind: "removal", factIds: ["f2"], summaryEn: "We removed a sentence.", fixedInVer: 3, show: true });
    }), []);
  });
});

describe("check-story-versions: version-decreased", () => {
  test("contentVer going down", () => {
    const findings = check((s) => { s.contentVer = 1; });
    assert.deepEqual(codes(findings), ["version-decreased"]);
    assert.match(findings[0].message, /2 -> 1/);
  });

  test("a fact rev going down", () => {
    const findings = check((s) => { s.facts[1].rev = 1; });
    assert.deepEqual(codes(findings), ["content-ver-not-bumped", "version-decreased"]);
    assert.match(findings.find((f) => f.code === "version-decreased").message, /f2/);
  });
});

describe("check-story-versions: errata are append-only", () => {
  test("an existing erratum removed", () => {
    assert.deepEqual(codes(check((s) => { s.errata = []; })), ["erratum-removed"]);
  });

  for (const [field, value] of [["date", "2026-10-12"], ["kind", "correction"], ["factIds", ["f1"]]]) {
    test(`an existing erratum's ${field} changed`, () => {
      const findings = check((s) => { s.errata[0][field] = value; });
      assert.deepEqual(codes(findings), ["erratum-changed"]);
      assert.match(findings[0].message, new RegExp(`e1.*${field}`));
    });
  }

  test("an erratum's summary wording may be edited", () => {
    assert.deepEqual(check((s) => { s.errata[0].summaryEn = "We described the gauge more clearly."; }), []);
  });

  test("errata stay append-only on a draft story too", () => {
    assert.deepEqual(codes(check((s) => { s.errata = []; }, (b) => { b.state = "draft"; })), ["erratum-removed"]);
  });
});

describe("check-story-versions: base state and new files", () => {
  test("a draft on main can change freely (nothing shipped)", () => {
    const findings = check((s) => {
      s.tiers.standard.scenes[1].narrationEn = "Changed.";
      s.facts[0].claimEn = "Changed.";
      s.facts.pop();
      s.contentVer = 1;
    }, (b) => { b.state = "draft"; });
    assert.deepEqual(findings, []);
  });

  test("a draft turning ready keeps its contentVer", () => {
    assert.deepEqual(check((s) => { s.state = "ready"; }, (b) => { b.state = "draft"; }), []);
  });

  test("a new file must start at contentVer 1", () => {
    const fresh = { ...base(), contentVer: 1 };
    assert.deepEqual(checkStoryVersions({ path: PATH, baseText: null, headText: text(fresh) }), []);
    const findings = checkStoryVersions({ path: PATH, baseText: null, headText: BASE_TEXT });
    assert.deepEqual(codes(findings), ["new-story-content-ver"]);
    assert.match(findings[0].message, /contentVer: 1/);
  });

  test("a new draft file must start at contentVer 1 too", () => {
    const fresh = { ...base(), state: "draft", contentVer: 4 };
    assert.deepEqual(codes(checkStoryVersions({ path: PATH, baseText: null, headText: text(fresh) })), ["new-story-content-ver"]);
  });

  test("head text that is not JSON is reported, not thrown", () => {
    assert.deepEqual(codes(checkStoryVersions({ path: PATH, baseText: BASE_TEXT, headText: "{ nope" })), ["invalid-json"]);
  });

  test("a base text that is not JSON is skipped (validate-content owns parse errors)", () => {
    assert.deepEqual(checkStoryVersions({ path: PATH, baseText: "{ nope", headText: BASE_TEXT }), []);
  });
});

describe("check-story-versions: a held story returning to ready", () => {
  // The S1 hold path (§3.7 step 3): ready vN -> draft vN (hold) -> edited as a
  // draft -> ready again. The return to ready is compared with the last version
  // that was ready, so the edits made while held still need their bumps.
  function heldThenEdited() {
    const lastReady = base();
    const held = structuredClone(lastReady);
    held.state = "draft";
    held.tiers.standard.scenes[1].narrationEn = "They made a bronze cup to catch it.";
    held.facts[0].sources[0].url = "https://example.org/one-moved";
    held.facts.pop();
    return { lastReady, held };
  }

  test("edits made while held are caught when the story turns ready at the same contentVer", () => {
    const { lastReady, held } = heldThenEdited();
    const head = { ...structuredClone(held), state: "ready" };
    const findings = checkStoryVersions({ path: PATH, baseText: text(held), headText: text(head), lastReadyText: text(lastReady) });
    assert.deepEqual(codes(findings), ["content-ver-not-bumped", "fact-removed-silently", "fact-rev-not-bumped"]);
    for (const f of findings) assert.match(f.message, /last version that was ready/);
  });

  test("with contentVer and the fact rev raised and a removal erratum, the return to ready is clean", () => {
    const { lastReady, held } = heldThenEdited();
    const head = structuredClone(held);
    head.state = "ready";
    head.contentVer = 3;
    head.facts[0].rev = 2;
    head.errata.push({ id: "e2", date: "2026-10-12", kind: "removal", factIds: ["f2"], summaryEn: "We removed a claim we could not support.", fixedInVer: 3, show: true });
    assert.deepEqual(checkStoryVersions({ path: PATH, baseText: text(held), headText: text(head), lastReadyText: text(lastReady) }), []);
  });

  test("an erratum dropped while held is reported once", () => {
    const { lastReady } = heldThenEdited();
    const held = { ...structuredClone(lastReady), state: "draft" };
    const head = { ...structuredClone(lastReady), errata: [] };
    const findings = checkStoryVersions({ path: PATH, baseText: text(held), headText: text(head), lastReadyText: text(lastReady) });
    assert.deepEqual(codes(findings), ["erratum-removed"]);
  });

  test("a story that stays a draft is not compared with its last ready version", () => {
    const { lastReady, held } = heldThenEdited();
    const head = structuredClone(held);
    head.tiers.standard.scenes[0].narrationEn = "Still being fixed.";
    assert.deepEqual(checkStoryVersions({ path: PATH, baseText: text(held), headText: text(head), lastReadyText: text(lastReady) }), []);
  });

  test("a story file re-added after a deletion is compared with its last ready version, not reset to 1", () => {
    const { lastReady } = heldThenEdited();
    const head = { ...structuredClone(lastReady), contentVer: 1 };
    const findings = checkStoryVersions({ path: PATH, baseText: null, headText: text(head), lastReadyText: text(lastReady) });
    assert.deepEqual(codes(findings), ["version-decreased"]);
    assert.deepEqual(checkStoryVersions({ path: PATH, baseText: null, headText: text(lastReady), lastReadyText: text(lastReady) }), []);
  });
});

describe("check-story-versions: story-removed", () => {
  test("deleting a ready story file is reported: a shipped story is held, never deleted", () => {
    const findings = checkRemovedStory({ path: PATH, baseText: BASE_TEXT });
    assert.deepEqual(codes(findings), ["story-removed"]);
    assert.match(findings[0].message, /state: "draft"/);
  });

  test("deleting a draft story file is allowed (nothing shipped)", () => {
    assert.deepEqual(checkRemovedStory({ path: PATH, baseText: text({ ...base(), state: "draft" }) }), []);
  });

  test("a base text that is not JSON is skipped", () => {
    assert.deepEqual(checkRemovedStory({ path: PATH, baseText: "{ nope" }), []);
  });
});

describe("isStoryFile", () => {
  test("only top-level content/stories/*.json", () => {
    assert.equal(isStoryFile("content/stories/sun-and-moon.json"), true);
    assert.equal(isStoryFile("content/stories/README.md"), false);
    assert.equal(isStoryFile("content/stories/research/seasons-tales.final.json"), false);
    assert.equal(isStoryFile("content/vocab/family.json"), false);
  });
});

describe("check-story-versions.mjs CLI on a git repository", () => {
  function git(cwd, ...args) {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  }

  function makeRepo() {
    const root = mkdtempSync(join(tmpdir(), "story-versions-"));
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "test@example.invalid");
    git(root, "config", "user.name", "test");
    git(root, "config", "commit.gpgsign", "false");
    mkdirSync(join(root, "content", "stories", "research"), { recursive: true });
    writeFileSync(join(root, "content", "stories", "fixture-rain-gauge.json"), BASE_TEXT);
    writeFileSync(join(root, "content", "stories", "README.md"), "readme\n");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "base");
    return root;
  }

  function run(root, ...args) {
    return spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HANGUL_ROUTE_ROOT: root }, encoding: "utf8" });
  }

  test("passes on an unchanged tree, fails with an annotation on an unbumped edit, passes after the bump", () => {
    const root = makeRepo();
    try {
      let r = run(root, "--base", "main");
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /1 story file\(s\) checked against main/);

      const story = base();
      story.tiers.standard.scenes[0].narrationEn = "Changed narration.";
      writeFileSync(join(root, PATH), text(story));
      writeFileSync(join(root, "content", "stories", "research", "x.final.json"), "{ not json");
      r = run(root, "--base", "main");
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout, /::error file=content\/stories\/fixture-rain-gauge\.json::content-ver-not-bumped:/);

      story.contentVer = 3;
      writeFileSync(join(root, PATH), text(story));
      r = run(root, "--base", "main");
      assert.equal(r.status, 0, r.stdout + r.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a new story file is checked against 'not on the base'", () => {
    const root = makeRepo();
    try {
      writeFileSync(join(root, "content", "stories", "new-one.json"), text({ ...base(), id: "story:new-one", contentVer: 2 }));
      const r = run(root, "--base", "main");
      assert.equal(r.status, 1);
      assert.match(r.stdout, /::error file=content\/stories\/new-one\.json::new-story-content-ver:/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an unknown base ref fails loudly (CI needs fetch-depth: 0)", () => {
    const root = makeRepo();
    try {
      const r = run(root, "--base", "origin/does-not-exist");
      assert.equal(r.status, 1);
      assert.match(r.stdout, /::error::.*origin\/does-not-exist.*fetch-depth: 0/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a ready story deleted outright fails; a held (draft) story deleted passes", () => {
    const root = makeRepo();
    try {
      rmSync(join(root, PATH));
      let r = run(root, "--base", "main");
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout, /::error file=content\/stories\/fixture-rain-gauge\.json::story-removed:/);

      writeFileSync(join(root, PATH), text({ ...base(), state: "draft" }));
      git(root, "commit", "-q", "-am", "hold");
      rmSync(join(root, PATH));
      r = run(root, "--base", "main");
      assert.equal(r.status, 0, r.stdout + r.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a held story edited as a draft on main and set back to ready is compared with its last ready version", () => {
    const root = makeRepo();
    try {
      const held = { ...base(), state: "draft" };
      writeFileSync(join(root, PATH), text(held));
      git(root, "commit", "-q", "-am", "hold");
      held.tiers.standard.scenes[1].narrationEn = "They made a bronze cup to catch it.";
      writeFileSync(join(root, PATH), text(held));
      git(root, "commit", "-q", "-am", "edit while held");

      const head = { ...structuredClone(held), state: "ready" };
      writeFileSync(join(root, PATH), text(head));
      let r = run(root, "--base", "main");
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout, /::error file=content\/stories\/fixture-rain-gauge\.json::content-ver-not-bumped:.*last version that was ready/);

      head.contentVer = 3;
      writeFileSync(join(root, PATH), text(head));
      r = run(root, "--base", "main");
      assert.equal(r.status, 0, r.stdout + r.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the repository's committed stories pass against HEAD", (t) => {
    const dirty = execFileSync("git", ["status", "--porcelain", "--", "content/stories"], { cwd: resolve(HERE, "..", ".."), encoding: "utf8" });
    if (dirty.trim() !== "") {
      t.skip("uncommitted story edits in this working tree");
      return;
    }
    const r = spawnSync("node", [SCRIPT, "--base", "HEAD"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /checked against HEAD, 0 problem\(s\)/);
  });
});

describe("content-validation.yml wiring", () => {
  const yml = readFileSync(WORKFLOW, "utf8");

  test("the checkout fetches full history so origin/main is there", () => {
    assert.match(yml, /uses: actions\/checkout@v4\n\s+with:\n(\s+#.*\n)*\s+fetch-depth: 0\n/);
  });

  test("a step runs the version check against origin/main", () => {
    assert.match(yml, /run: node scripts\/check-story-versions\.mjs --base origin\/main/);
  });

  test("the version step reports even when an earlier step failed", () => {
    assert.match(yml, /- name: Story versions are raised[^\n]*\n(\s+#.*\n)*\s+if: \$\{\{ !cancelled\(\) \}\}\n\s+run: node scripts\/check-story-versions\.mjs/);
  });

  test("a change to the script itself triggers the workflow", () => {
    assert.match(yml, /- "scripts\/check-story-versions\.mjs"/);
  });
});
