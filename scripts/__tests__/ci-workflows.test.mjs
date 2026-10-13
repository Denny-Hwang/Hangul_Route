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
        for (const need of job.needs) {
          assert.ok(
            job.text.includes(`needs.${need}.result`),
            `${file}#${id}: must read needs.${need}.result (the job it stands for)`
          );
        }
        assert.match(job.text, /!= success[\s\S]*?exit 1/, `${file}#${id}: must fail (exit 1) when a job it stands for did not succeed`);
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

  test("a coverage report lost between the jobs fails the check instead of being skipped", () => {
    const text = read(".github/workflows/ci.yml");
    const all = jobs(text);
    const [, cov] = Object.entries(all).find(([, j]) => j.name === REQUIRED[2]);
    assert.match(cov.text, /node scripts\/coverage-gate\.mjs --fail-on-skip/);
    // tar writes an archive from an empty list, so the pack step checks the list itself.
    assert.match(all.unit.text, /if \[ ! -s coverage-files\.txt \]; then[\s\S]*?exit 1/);
  });

  test("web typecheck runs before the web build (tsc reads .next/types, which next build rewrites)", () => {
    const turbo = JSON.parse(read("turbo.json"));
    assert.ok(turbo.tasks["@hangul-route/web#build"].dependsOn.includes("typecheck"));
  });
});

describe("workflow hygiene", () => {
  test("ci.yml and web-app.yml give their token read-only contents access", () => {
    for (const file of ["ci.yml", "web-app.yml"]) {
      const perms = topBlock(read(`.github/workflows/${file}`), "permissions").map((l) => l.trim()).filter(Boolean);
      assert.deepEqual(perms, ["contents: read"], file);
    }
  });

  test("every artifact upload in ci.yml and web-app.yml can be re-run (overwrite: true)", () => {
    for (const file of ["ci.yml", "web-app.yml"]) {
      const steps = read(`.github/workflows/${file}`).split(/\n(?=\s+- name: )/);
      const uploads = steps.filter((st) => /uses: actions\/upload-artifact@/.test(st));
      assert.ok(uploads.length > 0, file);
      for (const st of uploads) {
        assert.match(st, /overwrite: true/, `${file}: ${st.trim().split("\n")[0]}`);
      }
    }
  });
});

describe("PWA e2e", () => {
  const text = read(".github/workflows/web-app.yml");

  test("the release-build share and the fixture share use the same shards, 1..N of N", () => {
    const shards = [...text.matchAll(/SHARD: \$\{\{ matrix\.(\w+) \}\}\/(\d+)/g)].map((m) => ({ key: m[1], total: Number(m[2]) }));
    assert.equal(shards.length, 2, "one SHARD for the release-build list, one for the fixture list");
    assert.deepEqual(shards[0], shards[1]);
    const { key, total } = shards[0];
    assert.ok(total >= 2);
    const list = text.match(new RegExp(`^\\s+${key}: \\[([^\\]]+)\\]`, "m"))?.[1];
    assert.ok(list, `matrix.${key} is listed`);
    assert.deepEqual(list.split(",").map((v) => Number(v.trim())), Array.from({ length: total }, (_, i) => i + 1));
  });

  test("the fixture share runs even when the release-build share failed", () => {
    const step = text.slice(text.indexOf("- name: Offline e2e (fixture bundle"));
    assert.match(step.split("\n").slice(0, 3).join("\n"), /if: \$\{\{ !cancelled\(\) \}\}/);
  });

  test("each e2e job runs its round-robin share of one full listing, checked before it runs", () => {
    assert.equal(text.match(/e2e-shard-list\.mjs --shard "\$SHARD" < "\$RUNNER_TEMP\/all-tests\.txt"/g)?.length, 2);
    assert.equal(text.match(/selected=\$\(pnpm exec playwright test --list --test-list /g)?.length, 2);
    assert.equal(text.match(/pnpm exec playwright test --fully-parallel --test-list "\$RUNNER_TEMP\/shard-tests\.txt"/g)?.length, 2);
  });

  test("every test that needs the fixture bundle runs in a fixture e2e run", () => {
    // Whole files: the entries of the `files=( ... )` list. Single groups:
    // `list <file> -g "<grep>"`, which covers a file only inside the top-level
    // describe blocks whose title the grep matches.
    const wholeFiles = new Set();
    const arr = text.match(/files=\(\n([\s\S]*?)\n\s*\)/);
    if (arr) {
      for (const line of arr[1].split("\n")) {
        const word = line.replace(/#.*/, "").trim();
        if (word) wholeFiles.add(word);
      }
    }
    const groups = [...text.matchAll(/\blist ([a-z0-9-]+) -g "([^"]+)"/g)].map((m) => ({ file: m[1], grep: new RegExp(m[2]) }));
    assert.ok(wholeFiles.size > 0 && groups.length > 0, "found the fixture runs");

    const dir = join(ROOT, "apps", "mobile", "e2e", "web");
    const missing = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".spec.ts"))) {
      if ([...wholeFiles].some((flt) => f.includes(flt))) continue;
      const lines = readFileSync(join(dir, f), "utf8").split("\n");
      const mine = groups.filter((g) => f.includes(g.file));
      let describe = null;
      lines.forEach((line, i) => {
        const d = line.match(/^test\.describe\((['"`])(.*?)\1/);
        if (d) describe = d[2];
        else if (/^\S/.test(line) && !/^\}\)/.test(line)) describe = null;
        if (!/!\s*FIXTURE_BUILD\b/.test(line)) return;
        if (describe !== null && mine.some((g) => g.grep.test(describe))) return;
        missing.push(`${f}:${i + 1} (${describe === null ? "outside a describe" : `in '${describe}'`})`);
      });
    }
    assert.deepEqual(missing, [], "tests that need the fixture bundle but no fixture run selects");
  });

  test("the fixture runs use the fixture bundle and the main suite the release build", () => {
    assert.match(text, /STORY_FIXTURES: "1"/);
    assert.match(text, /build:web:fixtures/);
    assert.match(text, /build:web\b(?!:)/);
  });
  // F-STORY-004 PR 4.8b: the gating fixture bundle (fixtures + EXPO_PUBLIC_CONTENT_GATING_ENABLED=true,
  // dist-e2e-gated/) has its own build, its own artifact and its own e2e line; neither fixture run
  // picks up the other bundle's spec files.
  test("the gating fixture bundle is built into its own directory with content gating on", () => {
    const step = text.slice(text.indexOf("- name: Build the gating fixture bundle"));
    assert.ok(text.includes("- name: Build the gating fixture bundle"), "a build step for the gating fixture bundle");
    assert.match(step.split("\n- name:")[0], /pnpm --filter @hangul-route\/mobile build:web:fixtures:gated/);
    const pkg = JSON.parse(read("apps/mobile/package.json"));
    assert.match(pkg.scripts["build:web:fixtures:gated"], /build-web-fixtures\.mjs dist-e2e-gated --content-gating$/);
    assert.match(text, /name: pwa-dist-e2e-gated\n\s+path: apps\/mobile\/dist-e2e-gated/);
  });

  test("the gating run serves the gating bundle and lists only the gated spec", () => {
    const at = text.indexOf("- name: Offline e2e (gating fixture bundle");
    assert.ok(at >= 0, "an e2e step for the gating fixture bundle");
    const step = text.slice(at).split(/\n\s+- name: /)[0];
    assert.match(step, /if: \$\{\{ !cancelled\(\) && matrix\.shard == 1 \}\}/);
    assert.match(step, /STORY_FIXTURES_GATED: "1"/);
    assert.doesNotMatch(step, /STORY_FIXTURES: "1"/);
    assert.match(step, /pnpm exec playwright test story-shelf-gated\.spec\b/);
    assert.match(read("apps/mobile/playwright.config.ts"), /STORY_FIXTURES_GATED === '1'[\s\S]*?dist-e2e-gated/);
  });

  test("the regular fixture list names story-shelf anchored, so the gated spec never runs on it", () => {
    const arr = text.match(/files=\(\n([\s\S]*?)\n\s*\)/)?.[1] ?? "";
    const words = arr.split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
    assert.ok(words.includes("story-shelf.spec"));
    assert.deepEqual(words.filter((w) => "story-shelf-gated.spec.ts".includes(w)), [], "an entry that matches the gated spec");
  });

  test("every spec that needs the gating bundle runs in the gating run", () => {
    const dir = join(ROOT, "apps", "mobile", "e2e", "web");
    const gated = readdirSync(dir).filter((n) => n.endsWith(".spec.ts") && /!\s*GATED_BUILD\b/.test(readFileSync(join(dir, n), "utf8")));
    assert.deepEqual(gated, ["story-shelf-gated.spec.ts"]);
  });
});
