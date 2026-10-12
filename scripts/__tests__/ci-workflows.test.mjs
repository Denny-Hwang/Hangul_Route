// Guards for the CI layout (CI speed-up, 2026-10-12 owner decision).
//
// The ruleset main-protection requires three checks by job name:
//   'lint · typecheck · test · build', 'Build PWA · offline e2e',
//   'Measure coverage vs rolling targets'.
// The work behind them now runs in parallel jobs, and each required name is a
// small job that always runs and passes only when every job it stands for
// passed. These tests keep that true, and keep every test that ran before
// the split running after it (nothing dropped while moving lines around).
//
// Node built-in test runner, no dependencies (the workflows are read as text:
// only the few shapes used here are parsed).

import { strict as assert } from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");

const REQUIRED = [
  "lint · typecheck · test · build",
  "Build PWA · offline e2e",
  "Measure coverage vs rolling targets",
];

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function workflowFiles() {
  return readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
}

/** Top-level block `key:` of a workflow, as its lines (without the key line). */
function topBlock(text, key) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l === `${key}:` || l.startsWith(`${key}: `));
  if (start === -1) return [];
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    out.push(line);
  }
  return out;
}

/** Child blocks at a given indent of a list of lines: { key: lines[] }. */
function children(lines, indent) {
  const pad = " ".repeat(indent);
  const re = new RegExp(`^${pad}([A-Za-z0-9_-]+):\\s*(.*)$`);
  const out = {};
  let current = null;
  for (const line of lines) {
    const m = line.match(re);
    if (m && !line.startsWith(pad + " ")) {
      current = m[1];
      out[current] = [line];
    } else if (current && (line.startsWith(pad + " ") || line.trim() === "")) {
      out[current].push(line);
    } else if (current && line.trim().startsWith("#")) {
      out[current].push(line);
    }
  }
  return out;
}

/** Jobs of a workflow: { id: { name, if, needs[], text } }. */
function jobs(text) {
  const out = {};
  for (const [id, lines] of Object.entries(children(topBlock(text, "jobs"), 2))) {
    const body = lines.join("\n");
    const field = (k) => body.match(new RegExp(`^    ${k}: (.*)$`, "m"))?.[1]?.trim();
    const needsRaw = field("needs");
    let needs = [];
    if (needsRaw) {
      needs = needsRaw.startsWith("[")
        ? needsRaw.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean)
        : [needsRaw];
    }
    out[id] = { name: field("name") ?? id, if: field("if"), needs, text: body };
  }
  return out;
}

function workspaces() {
  const out = [];
  for (const group of ["apps", "packages"]) {
    for (const dir of readdirSync(join(ROOT, group))) {
      const pkg = join(ROOT, group, dir, "package.json");
      if (existsSync(pkg)) out.push({ dir: `${group}/${dir}`, pkg: JSON.parse(readFileSync(pkg, "utf8")) });
    }
  }
  return out;
}

describe("required checks", () => {
  for (const name of REQUIRED) {
    test(`'${name}' is the name of exactly one job, in a workflow that runs on every pull request`, () => {
      const hits = [];
      for (const file of workflowFiles()) {
        const text = read(`.github/workflows/${file}`);
        for (const [id, job] of Object.entries(jobs(text))) {
          if (job.name === name) hits.push({ file, id, text });
        }
      }
      assert.equal(hits.length, 1, `jobs named '${name}': ${JSON.stringify(hits.map((h) => `${h.file}#${h.id}`))}`);
      const pr = children(topBlock(hits[0].text, "on"), 2).pull_request ?? [];
      assert.ok(pr.length > 0, `${hits[0].file} must run on pull_request`);
      assert.ok(
        !pr.some((l) => /^\s+paths(-ignore)?:/.test(l)),
        `${hits[0].file}: a paths filter on pull_request would leave '${name}' pending; detect paths inside the job`
      );
    });

    test(`'${name}' always runs and stands for every job it needs`, () => {
      for (const file of workflowFiles()) {
        const all = jobs(read(`.github/workflows/${file}`));
        const entry = Object.entries(all).find(([, j]) => j.name === name);
        if (!entry) continue;
        const [id, job] = entry;
        const others = Object.keys(all).filter((k) => k !== id);
        assert.ok(others.length > 0, `${file}: '${name}' should gate the parallel jobs of its workflow`);
        assert.match(job.if ?? "", /\balways\(\)/, `${file}#${id}: a skipped required check counts as passing, so it must run with if: always()`);
        assert.ok(job.needs.length > 0, `${file}#${id}: needs the jobs it reports for`);
        assert.match(job.text, /needs\b/, `${file}#${id}: must read the results of its needs`);
      }
    });
  }

  test("'lint · typecheck · test · build' needs every job of ci.yml except the coverage check", () => {
    const all = jobs(read(".github/workflows/ci.yml"));
    const [, gate] = Object.entries(all).find(([, j]) => j.name === REQUIRED[0]);
    const expected = Object.entries(all)
      .filter(([, j]) => !REQUIRED.includes(j.name))
      .map(([id]) => id)
      .sort();
    assert.deepEqual([...gate.needs].sort(), expected);
  });

  test("'Build PWA · offline e2e' needs every other job of web-app.yml", () => {
    const all = jobs(read(".github/workflows/web-app.yml"));
    const [id, gate] = Object.entries(all).find(([, j]) => j.name === REQUIRED[1]);
    const expected = Object.keys(all).filter((k) => k !== id).sort();
    assert.deepEqual([...gate.needs].sort(), expected);
  });
});

describe("unit tests run once, with coverage", () => {
  test("every workspace with a test script also has test:coverage (CI runs the tests through test:coverage)", () => {
    const missing = workspaces()
      .filter(({ pkg }) => pkg.scripts?.test && !pkg.scripts?.["test:coverage"])
      .map(({ dir }) => dir);
    assert.deepEqual(missing, []);
  });

  test("no workflow runs the test task a second time without coverage", () => {
    for (const file of workflowFiles()) {
      const text = read(`.github/workflows/${file}`);
      assert.ok(!/pnpm run test\s*$/m.test(text), `${file}: runs 'pnpm run test'; ci.yml's test:coverage jobs already run every test`);
      assert.ok(!/turbo run test(\s|$)/m.test(text), `${file}: runs 'turbo run test'`);
    }
  });

  test("ci.yml runs test:coverage for the mobile app and for every other workspace", () => {
    const text = read(".github/workflows/ci.yml");
    assert.match(text, /turbo run test:coverage --filter=@hangul-route\/mobile\b/);
    assert.match(text, /turbo run test:coverage --filter='!@hangul-route\/mobile'/);
  });

  test("ci.yml still runs the SQLite API tests and the enforcement-script tests", () => {
    const text = read(".github/workflows/ci.yml");
    assert.match(text, /pnpm --filter @hangul-route\/backend test:sqlite/);
    assert.match(text, /pnpm run test:scripts/);
  });

  test("the coverage check reads the coverage of both test jobs", () => {
    const all = jobs(read(".github/workflows/ci.yml"));
    const [, cov] = Object.entries(all).find(([, j]) => j.name === REQUIRED[2]);
    assert.ok(cov.needs.length > 0);
    assert.match(cov.text, /check-coverage-targets-drift\.mjs/);
    assert.match(cov.text, /coverage-gate\.mjs/);
  });
});

describe("PWA e2e", () => {
  const text = read(".github/workflows/web-app.yml");

  test("the main suite shards cover 1..N of the --shard total", () => {
    const total = Number(text.match(/--shard=\$\{\{ matrix\.shard \}\}\/(\d+)/)?.[1]);
    assert.ok(total >= 2, "main suite runs as --shard=<i>/<N> with N >= 2");
    const list = text.match(/^\s+shard: \[([^\]]+)\]/m)?.[1];
    assert.ok(list, "matrix.shard is listed");
    const shards = list.split(",").map((s) => Number(s.trim()));
    assert.deepEqual(shards, Array.from({ length: total }, (_, i) => i + 1));
  });

  test("the fixture parts cover 1..N of their --shard total", () => {
    const total = Number(text.match(/--shard="\$PART\/(\d+)"/)?.[1]);
    assert.ok(total >= 1);
    const list = text.match(/^\s+part: \[([^\]]+)\]/m)?.[1];
    assert.ok(list, "matrix.part is listed");
    const parts = list.split(",").map((s) => Number(s.trim()));
    assert.deepEqual(parts, Array.from({ length: total }, (_, i) => i + 1));
  });

  test("every spec that needs the fixture bundle runs in a fixture e2e run", () => {
    // Filters: the entries of the `files=( ... )` list and the first argument of
    // every single-group run (`playwright test <file> -g ...`).
    const filters = new Set();
    const arr = text.match(/files=\(\n([\s\S]*?)\n\s*\)/);
    if (arr) {
      for (const line of arr[1].split("\n")) {
        const word = line.replace(/#.*/, "").trim();
        if (word) filters.add(word);
      }
    }
    for (const m of text.matchAll(/playwright test ([a-z0-9-]+) -g /g)) filters.add(m[1]);
    assert.ok(filters.size > 0, "found the fixture runs");

    const dir = join(ROOT, "apps", "mobile", "e2e", "web");
    const needsFixtures = readdirSync(dir)
      .filter((f) => f.endsWith(".spec.ts"))
      .filter((f) => /!\s*FIXTURE_BUILD\b/.test(readFileSync(join(dir, f), "utf8")));
    assert.ok(needsFixtures.length > 0);
    const missing = needsFixtures.filter((f) => ![...filters].some((flt) => f.includes(flt)));
    assert.deepEqual(missing, [], "fixture-only specs that no fixture run picks up");
  });

  test("the fixture runs use the fixture bundle and the main suite the release build", () => {
    assert.match(text, /STORY_FIXTURES: "1"/);
    assert.match(text, /build:web:fixtures/);
    assert.match(text, /build:web\b(?!:)/);
  });
});
