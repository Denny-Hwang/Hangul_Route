// Self-tests for scripts/generate.mjs (F-CURR-002 §9.1, row CM-6): every module generated from
// content/ is gitignored and written by `pnpm generate`; CI replaced the drift checks of the
// committed modules with this determinism test (two runs give identical bytes).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "generate.mjs");
const REVERSE = pathToFileURL(join(HERE, "helpers", "reverse-readdir.mjs")).href;
const { GENERATED_PATHS, GENERATORS, digest, generatedFiles } = await import(SCRIPT);

const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

/** A tree holding the generators' inputs: content/ and the app's jamo (the catalogue's `teaches`). */
function inputTree() {
  const root = mkdtempSync(join(tmpdir(), "generate-"));
  roots.push(root);
  cpSync(join(REPO, "content"), join(root, "content"), { recursive: true });
  const jamo = join("apps", "mobile", "src", "content", "jamo.ts");
  mkdirSync(dirname(join(root, jamo)), { recursive: true });
  cpSync(join(REPO, jamo), join(root, jamo));
  return root;
}
const run = (root, args = [], env = {}) =>
  spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HANGUL_ROUTE_ROOT: root, HANGUL_ROUTE_STAMP_BASE: "none", ...env }, encoding: "utf8" });

describe("generate.mjs: determinism", () => {
  test("two runs over the repository's content give identical bytes, even when every folder lists in reverse or the locale differs", () => {
    const a = inputTree();
    const b = inputTree();
    const first = run(a);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const once = digest(a);
    assert.ok(Object.keys(once).length >= 30, `generated ${Object.keys(once).length} files`);
    assert.equal(run(a).status, 0);
    assert.deepEqual(digest(a), once, "a second run in the same tree changed bytes");
    const reversed = run(b, [], { NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import ${REVERSE}`.trim() });
    assert.equal(reversed.status, 0, reversed.stdout + reversed.stderr);
    assert.deepEqual(digest(b), once, "the output depends on the order the file system lists a folder");
    // Estonian collation sorts z between s and t: a sort that leans on the default locale would differ.
    const c = inputTree();
    const estonian = run(c, [], { LC_ALL: "et_EE.UTF-8", LANG: "et_EE.UTF-8" });
    assert.equal(estonian.status, 0, estonian.stdout + estonian.stderr);
    assert.deepEqual(digest(c), once, "the output depends on the runtime's default locale");
    for (const rel of GENERATED_PATHS) assert.ok(existsSync(join(a, ...rel.split("/"))), `${rel} was written`);
  });

  test("a run whose output is unchanged touches no file, so dev servers and watchers stay quiet", () => {
    const root = inputTree();
    assert.equal(run(root).status, 0);
    const past = new Date(Date.UTC(2026, 0, 1));
    const files = generatedFiles(root).map((rel) => join(root, ...rel.split("/")));
    for (const file of files) utimesSync(file, past, past);
    assert.equal(run(root).status, 0);
    const touched = files.filter((file) => statSync(file).mtimeMs !== past.getTime());
    assert.deepEqual(touched, [], "an unchanged module was rewritten");
    const stories = join(root, "apps", "mobile", "src", "content", "stories.generated.ts");
    writeFileSync(stories, "// stale\n");
    utimesSync(stories, past, past);
    assert.equal(run(root).status, 0);
    assert.notEqual(statSync(stories).mtimeMs, past.getTime(), "a changed module is written");
    assert.notEqual(readFileSync(stories, "utf8"), "// stale\n");
  });

  test("--check passes on a tree an earlier run wrote and fails when a generated module was changed", () => {
    const root = inputTree();
    assert.equal(run(root).status, 0);
    const ok = run(root, ["--check"]);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const file = join(root, "apps", "mobile", "src", "content", "stories.generated.ts");
    writeFileSync(file, readFileSync(file, "utf8") + "// edited\n");
    const drift = run(root, ["--check"]);
    assert.equal(drift.status, 1);
    assert.match(drift.stderr, /scripts\/build-stories\.mjs --check failed/);
  });

  test("a content error stops the run with the generator's annotation", () => {
    const root = inputTree();
    writeFileSync(join(root, "content", "episodes", "stage-2", "life.json"), "{ not json");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/episodes\/stage-2\/life\.json::invalid JSON/);
    assert.match(r.stderr, /scripts\/build-lessons\.mjs failed \(exit 1\); fix it and run pnpm generate/);
    assert.equal(run(root, ["--nope"]).status, 2);
  });
});

describe("generate.mjs: the modules are never committed", () => {
  test("every generated path is gitignored and none is tracked", () => {
    for (const rel of GENERATED_PATHS) {
      const ignored = spawnSync("git", ["check-ignore", "-q", rel], { cwd: REPO });
      assert.equal(ignored.status, 0, `${rel} is not gitignored`);
      const tracked = spawnSync("git", ["ls-files", "--", rel], { cwd: REPO, encoding: "utf8" });
      assert.equal(tracked.stdout, "", `${rel} is committed`);
    }
  });

  test(".gitignore lists exactly the generated paths, and turbo's generate task declares them as outputs", () => {
    const gitignore = readFileSync(join(REPO, ".gitignore"), "utf8").split("\n");
    const start = gitignore.findIndex((line) => line.startsWith("# Generated from content/"));
    assert.ok(start !== -1);
    const block = [];
    for (const line of gitignore.slice(start + 1)) {
      if (line.trim() === "" || (line.startsWith("#") && block.length > 0)) break;
      if (!line.startsWith("#")) block.push(line.replace(/\/$/, ""));
    }
    assert.deepEqual(block, [...GENERATED_PATHS]);
    const turbo = JSON.parse(readFileSync(join(REPO, "turbo.json"), "utf8"));
    const task = turbo.tasks["//#generate"];
    assert.deepEqual(task.outputs.map((o) => o.replace(/\/\*\*$/, "")), [...GENERATED_PATHS]);
    for (const name of ["build", "typecheck", "test", "test:coverage", "dev", "@hangul-route/web#build", "@hangul-route/web#test", "@hangul-route/web#test:coverage"]) {
      assert.ok(turbo.tasks[name].dependsOn.includes("//#generate"), `${name} depends on generate`);
    }
  });

  test("pnpm generate and the postinstall run it, and every generator's outputs are listed once", () => {
    const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
    assert.equal(pkg.scripts.generate, "node scripts/generate.mjs");
    assert.equal(pkg.scripts.postinstall, "node scripts/generate.mjs");
    assert.equal(new Set(GENERATED_PATHS).size, GENERATED_PATHS.length);
    for (const { script } of GENERATORS) assert.ok(existsSync(join(REPO, "scripts", script)), script);
  });

  test("Metro runs it before it bundles: expo start, expo export and the Xcode bundle phase load apps/mobile/metro.config.js", () => {
    const config = readFileSync(join(REPO, "apps", "mobile", "metro.config.js"), "utf8");
    assert.match(config, /execFileSync\(process\.execPath, \[path\.join\(__dirname, '\.\.', '\.\.', 'scripts', 'generate\.mjs'\)\]/);
    assert.match(config, /module\.exports = getDefaultConfig\(__dirname\);/);
    assert.ok(config.indexOf("execFileSync(") < config.indexOf("module.exports"), "the generators run before Metro gets its config");
  });

  test("the e2e fixture build writes the modules itself and keeps Metro from writing the release stories over its fixtures", () => {
    const config = readFileSync(join(REPO, "apps", "mobile", "metro.config.js"), "utf8");
    assert.match(config, /if \(process\.env\.HANGUL_ROUTE_GENERATE !== 'off'\) \{\n\s+execFileSync\(/);
    const build = readFileSync(join(REPO, "apps", "mobile", "scripts", "build-web-fixtures.mjs"), "utf8");
    const generateAt = build.indexOf("run(process.execPath, [generateAll])");
    const fixturesAt = build.indexOf("run(process.execPath, [generator, '--include-fixtures'])");
    assert.ok(generateAt !== -1 && fixturesAt !== -1 && generateAt < fixturesAt, "generate.mjs runs before the fixture stories are written");
  });

  test("generatedFiles walks a folder output and skips what is absent", () => {
    const root = mkdtempSync(join(tmpdir(), "generate-files-"));
    roots.push(root);
    assert.deepEqual(generatedFiles(root), []);
    const chunk = join(root, "apps", "mobile", "src", "content", "__generated__", "lesson-chunks", "b.ts");
    mkdirSync(dirname(chunk), { recursive: true });
    writeFileSync(chunk, "b");
    writeFileSync(join(dirname(chunk), "a.ts"), "a");
    assert.deepEqual(generatedFiles(root), ["apps/mobile/src/content/__generated__/lesson-chunks/a.ts", "apps/mobile/src/content/__generated__/lesson-chunks/b.ts"]);
  });
});
