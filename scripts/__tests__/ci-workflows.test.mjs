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
    const gated = readdirSync(dir).filter((n) => {
      if (!n.endsWith(".spec.ts")) return false;
      return readFileSync(join(dir, n), "utf8").split("\n").some((line) => /!\s*GATED_BUILD\b/.test(line));
    });
    assert.deepEqual(gated, ["my-route.spec.ts", "story-shelf-gated.spec.ts"]);
  });

  test("the gating run plays the my-route assumption h case (F-ROUTE-001 R-10b)", () => {
    const at = text.indexOf("- name: Offline e2e (gating fixture bundle");
    const step = text.slice(at).split(/\n\s+- name: /)[0];
    assert.match(step, /pnpm exec playwright test my-route\.spec -g "assumption h"/);
    const grep = step.match(/my-route\.spec -g "([^"]+)"/)[1];
    const lines = read("apps/mobile/e2e/web/my-route.spec.ts").split("\n");
    const skips = lines.flatMap((l, i) => (/!\s*GATED_BUILD\b/.test(l) ? [i] : []));
    assert.ok(skips.length > 0, "my-route.spec.ts has a GATED_BUILD skip");
    const indent = (l) => l.length - l.trimStart().length;
    for (const at of skips) {
      // Every gating-only block must be one the gating run's -g picks, or it runs nowhere in CI. The block is the
      // nearest test( or test.describe( above the skip that encloses it (less indented), so a describe-level skip
      // is checked against its describe's title, never against an unrelated test above it.
      const title =
        lines
          .slice(0, at)
          .reverse()
          .find((l) => /^\s*test(\.describe)?\(/.test(l) && indent(l) < indent(lines[at])) ?? "";
      assert.ok(title.includes(grep), `the GATED_BUILD skip on line ${at + 1} sits in a block the gating run's -g "${grep}" plays`);
    }
  });

  test("no Learning Route flag-on gate is left while flags.myRouteEnabled defaults to on (F-ROUTE-001 R-10b)", () => {
    // R-10b removed the E2E_MY_ROUTE (ROUTE_TAB) gates and the exemption that let their blocks skip every CI run.
    // A spec that gates a block on a flag-on build again would run nowhere in CI, so this tripwire fails on it.
    const flags = read("apps/mobile/src/config/flags.ts");
    const defaults = flags.slice(flags.indexOf("launchDefaults"));
    const value = defaults.slice(0, defaults.indexOf("};")).match(/myRouteEnabled:\s*(true|false)\b/);
    assert.ok(value, "launchDefaults in flags.ts names myRouteEnabled");
    assert.equal(value[1], "true", "R-10b: flags.myRouteEnabled defaults to on");
    const dir = join(ROOT, "apps", "mobile", "e2e", "web");
    const stillGated = readdirSync(dir).filter((n) => {
      if (!n.endsWith(".spec.ts")) return false;
      const src = readFileSync(join(dir, n), "utf8");
      // Any env variable whose name holds MY_ROUTE read by a spec (E2E_MY_ROUTE or a renamed one), or the old ROUTE_TAB gate.
      return /\bE2E_MY_ROUTE\b/.test(src) || /process\.env\.\w*MY_ROUTE\w*/.test(src) || /test\.skip\(\s*!?ROUTE_TAB\b/.test(src);
    });
    assert.deepEqual(stillGated, [], "a Learning Route block skips unless E2E_MY_ROUTE=1, so no CI run plays it");
  });

  // F-PLAN-002 P2-8 (section 6, the pre-flip CI job): the weekly plan bundle (release content with
  // EXPO_PUBLIC_ROUTE_ENABLED=true and es / ko shown, dist-e2e-route/) has its own build, its own artifact
  // and its own e2e line with E2E_ROUTE=1, which plays every spec gated on E2E_ROUTE.
  test("the weekly plan bundle is built into its own directory with the plan flag on, on a Metro cache of its own", () => {
    assert.ok(text.includes("- name: Build the weekly plan bundle"), "a build step for the weekly plan bundle");
    const step = text.slice(text.indexOf("- name: Build the weekly plan bundle"));
    assert.match(step.split("\n- name:")[0], /pnpm --filter @hangul-route\/mobile build:web:route/);
    const pkg = JSON.parse(read("apps/mobile/package.json"));
    assert.equal(pkg.scripts["build:web:route"], "node scripts/build-web-route.mjs");
    const script = read("apps/mobile/scripts/build-web-route.mjs");
    assert.match(script, /EXPO_PUBLIC_ROUTE_ENABLED: 'true'/);
    assert.match(script, /EXPO_PUBLIC_SHOW_ALL_LOCALES: '1'/);
    assert.match(script, /TMPDIR: ownTmp/);
    assert.match(script, /const out = 'dist-e2e-route';/);
    assert.match(text, /name: pwa-dist-e2e-route\n\s+path: apps\/mobile\/dist-e2e-route/);
    assert.match(read("apps/mobile/playwright.config.ts"), /E2E_ROUTE === '1'\) return 'dist-e2e-route'/);
  });

  test("the weekly plan run serves its bundle with E2E_ROUTE=1 and plays every spec gated on E2E_ROUTE", () => {
    const at = text.indexOf("- name: Offline e2e (weekly plan bundle");
    assert.ok(at >= 0, "an e2e step for the weekly plan bundle");
    const step = text.slice(at).split(/\n\s+- name: /)[0];
    assert.match(step, /if: \$\{\{ !cancelled\(\) && matrix\.shard == 2 \}\}/);
    assert.match(step, /E2E_ROUTE: "1"/);
    assert.doesNotMatch(step, /STORY_FIXTURES/);
    const run = step.match(/pnpm exec playwright test ([^\n]+)/)?.[1] ?? "";
    const listed = run.split(/\s+/).filter(Boolean);
    const dir = join(ROOT, "apps", "mobile", "e2e", "web");
    const routeSpecs = readdirSync(dir).filter((n) => n.endsWith(".spec.ts") && /process\.env\.E2E_ROUTE === '1'/.test(readFileSync(join(dir, n), "utf8")));
    // A spec that also needs STORY_FIXTURES=1 runs on the fixture bundle exported with the plan flag on
    // (placement-plan.spec.ts, F-PLC-001 P-7b; P-10 adds it to the nightly run), not on dist-e2e-route/.
    const needsFixtures = (n) => /process\.env\.STORY_FIXTURES === '1'/.test(readFileSync(join(dir, n), "utf8"));
    assert.deepEqual(routeSpecs.filter(needsFixtures).sort(), ["placement-plan.spec.ts"]);
    const gated = routeSpecs.filter((n) => !needsFixtures(n));
    assert.deepEqual(gated.sort(), ["route-plan.spec.ts", "route-proposal.spec.ts", "route.spec.ts"]);
    for (const spec of gated) {
      const selectors = listed.filter((s) => `e2e/web/${spec}`.includes(s));
      assert.equal(selectors.length, 1, `exactly one selector of the weekly plan run matches ${spec}`);
    }
    // No selector pulls in another spec (my-route.spec.ts holds "route.spec").
    for (const s of listed) {
      const hits = readdirSync(dir).filter((n) => n.endsWith(".spec.ts") && `e2e/web/${n}`.includes(s));
      assert.equal(hits.length, 1, `${s} selects exactly one spec file, got ${hits.join(", ")}`);
    }
  });
});

// F-ENT-003 E3-13: the switch-on e2e lane. Its own workflow (switch-on-e2e.yml), nightly and on demand,
// that builds dist/ with both content gating switches on (the production switch-on values, OD-2) on a
// cleared Metro cache, and runs every spec that reads E2E_CONTENT_GATING with E2E_CONTENT_GATING=1, so the
// switch-on halves stay current with main before the owner's switch-on step. It is not a required check,
// and it lives outside web-app.yml so a schedule or dispatch run never posts the required check's name
// on a commit it did not build (review of E3-13).
describe("switch-on e2e lane (F-ENT-003 E3-13)", () => {
  const FILE = ".github/workflows/switch-on-e2e.yml";
  const text = read(FILE);
  const all = jobs(text);
  const lane = all["switch-on"];
  const on = children(topBlock(text, "on"), 2);
  /** One step of the lane, by the start of its name. */
  const step = (name) => {
    const at = lane.text.indexOf(`- name: ${name}`);
    assert.ok(at >= 0, `a switch-on step named '${name}...'`);
    return lane.text.slice(at).split(/\n\s+- name: /)[0];
  };

  test("the lane's workflow runs only on demand and nightly, never on pull requests or pushes", () => {
    assert.deepEqual(Object.keys(on).sort(), ["schedule", "workflow_dispatch"]);
    assert.match((on.schedule ?? []).join("\n"), /- cron: "[^"]+"/);
    assert.deepEqual(Object.keys(all), ["switch-on"], "the lane is the only job of its workflow");
    assert.deepEqual(topBlock(text, "permissions").map((l) => l.trim()).filter(Boolean), ["contents: read"]);
    assert.match(lane.text, /^    timeout-minutes: \d+$/m);
  });

  test("web-app.yml (the required check's workflow) never runs on a schedule or dispatch event", () => {
    const webOn = children(topBlock(read(".github/workflows/web-app.yml"), "on"), 2);
    assert.deepEqual(Object.keys(webOn).sort(), ["pull_request", "push"]);
    assert.ok(!REQUIRED.includes(lane.name), "the lane is not a required check");
  });

  test("the switch-on build is dist/ with both production switches on, on a cleared Metro and Next cache and no restored cache", () => {
    const build = step("Build the switch-on bundle");
    assert.match(build, /EXPO_PUBLIC_CONTENT_GATING_ENABLED: "true"/);
    assert.match(build, /NEXT_PUBLIC_CONTENT_GATING_ENABLED: "true"/);
    assert.match(build, /rm -rf \/tmp\/metro-cache apps\/web\/\.next\/cache/);
    assert.match(build, /export TMPDIR="\$RUNNER_TEMP\/switch-on-tmp"/);
    assert.match(build, /pnpm --filter @hangul-route\/mobile build:web$/m);
    assert.doesNotMatch(lane.text, /actions\/cache(\/restore)?@/, "a restored Metro or Next cache could serve a switch-off bundle");
    // The shared setup step may cache the pnpm store only.
    const setup = read(".github/actions/setup-workspace/action.yml");
    assert.doesNotMatch(setup, /actions\/cache|metro-cache|\.next\/cache/);
  });

  test("the notes flags go on only when the on-demand run asks for it, for the app and the console twin", () => {
    assert.match(on.workflow_dispatch.join("\n"), /notes:[\s\S]*?type: boolean[\s\S]*?default: false/);
    assert.match(lane.text, /NOTES: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.notes && 'true' \|\| 'false' \}\}/);
    assert.match(step("Build the switch-on bundle"), /if \[ "\$NOTES" = true \]; then\s+export EXPO_PUBLIC_NOTES_ENABLED=true NEXT_PUBLIC_NOTES_ENABLED=true/);
    const run = step("Switch-on e2e (release dist");
    assert.match(run, /if \[ "\$NOTES" = true \]; then\s+export E2E_NOTES=1/);
    assert.match(run, /git grep -l E2E_NOTES -- 'e2e\/web\/\*\.spec\.ts'/);
  });

  test("the lane runs every spec that reads E2E_CONTENT_GATING, with E2E_CONTENT_GATING=1, on the release dist", () => {
    const run = step("Switch-on e2e (release dist");
    assert.match(run, /E2E_CONTENT_GATING: "1"/);
    assert.match(run, /git grep -l E2E_CONTENT_GATING -- 'e2e\/web\/\*\.spec\.ts'/);
    assert.match(run, /\$\{#specs\[@\]\}" -eq 0[\s\S]*?exit 1/, "an empty list fails the lane instead of running every spec");
    assert.doesNotMatch(run, /STORY_FIXTURES/, "the switch-on specs run on dist/, not a fixture bundle");
    assert.match(run, /pnpm exec playwright test --output test-results\/switch-on "\$\{specs\[@\]\}"/);
    // The grep finds these today (the list in the spec row); a spec that stops reading the variable fails here.
    const dir = join(ROOT, "apps", "mobile", "e2e", "web");
    const reads = readdirSync(dir).filter((n) => n.endsWith(".spec.ts") && readFileSync(join(dir, n), "utf8").includes("E2E_CONTENT_GATING"));
    for (const f of [
      "browse.spec.ts",
      "dashboard-free-line.spec.ts",
      "episode-access.spec.ts",
      "free-days.spec.ts",
      "free-end.spec.ts",
      "notes-screens.spec.ts",
      "plan-free-lines.spec.ts",
      "plan-next.spec.ts",
    ]) {
      assert.ok(reads.includes(f), `${f} reads E2E_CONTENT_GATING`);
    }
  });

  test("the lane also runs the gating fixture bundle specs, in their own output folder, and uploads results on failure", () => {
    assert.match(step("Build the gating fixture bundle"), /pnpm --filter @hangul-route\/mobile build:web:fixtures:gated/);
    const run = step("Switch-on e2e (gating fixture bundle");
    assert.match(run, /STORY_FIXTURES_GATED: "1"/);
    assert.match(run, /pnpm exec playwright test --output test-results\/gated story-shelf-gated\.spec free-days\.spec/);
    assert.match(run, /if: \$\{\{ !cancelled\(\) \}\}/);
    const upload = step("Upload the Playwright results");
    assert.match(upload, /if: failure\(\)/);
    assert.match(upload, /uses: actions\/upload-artifact@/);
    assert.match(upload, /path: apps\/mobile\/test-results/);
    assert.match(upload, /overwrite: true/);
  });
});

// F-BILL-002 B-14: the billing and grown-up home lane. A job of web-app.yml (so the required check
// 'Build PWA · offline e2e' stands for it) that builds F-APP-001's merged app-host dist with an API base at a
// mock host and the grown-up home flag on, on a Metro cache of its own, then runs the web billing specs
// against that dist (BILLING_E2E=1, E2E_OUT=../mobile/dist) and the flag-on PWA specs (E2E_GROWN_UP_HOME=1).
// Before B-14 these ran by hand only (B-11).
describe("billing and grown-up home e2e (F-BILL-002 B-14)", () => {
  const text = read(".github/workflows/web-app.yml");
  const all = jobs(text);
  const lane = all["billing-e2e"];
  /** One step of the lane, by the start of its name. */
  const step = (name) => {
    const at = lane.text.indexOf(`- name: ${name}`);
    assert.ok(at >= 0, `a billing e2e step named '${name}...'`);
    return lane.text.slice(at).split(/\n\s+- name: /)[0];
  };
  const MOCK_API = "https://api.billing-e2e.test";
  /** The spec paths a step passes to playwright test (its --output folder left out). */
  const specArgs = (run) =>
    (run.match(/pnpm exec playwright test ([^\n]+)/)?.[1] ?? "").replace(/--output \S+/, "").split(/\s+/).filter(Boolean);

  test("the lane is a job of web-app.yml that the required PWA check stands for, skipped with the PWA build", () => {
    assert.ok(lane, "web-app.yml has a billing-e2e job");
    assert.ok(!REQUIRED.includes(lane.name), "the lane is not itself a required check name");
    // It waits only for the small change detection job, never for the build job, so its own cold build runs
    // beside the release build instead of after it (the required check's slowest path stays the build + shards).
    assert.deepEqual(lane.needs, ["changes"]);
    assert.equal(lane.if, "needs.changes.outputs.run == 'true'");
    assert.match(lane.text, /^    timeout-minutes: \d+$/m);
    const [, gate] = Object.entries(all).find(([, j]) => j.name === REQUIRED[1]);
    assert.ok(gate.needs.includes("billing-e2e"));
    assert.ok(gate.needs.includes("changes"));
  });

  test("one change detection job answers for the build job, the shards (through the build job) and the lane", () => {
    const changes = all.changes;
    assert.ok(changes, "web-app.yml has a changes job");
    assert.deepEqual(changes.needs, []);
    assert.match(changes.text, /^      run: \$\{\{ steps\.changes\.outputs\.run \}\}$/m);
    assert.match(changes.text, /id: changes/);
    assert.deepEqual(all.build.needs, ["changes"]);
    assert.match(all.build.text, /^      run: \$\{\{ needs\.changes\.outputs\.run \}\}$/m);
    assert.doesNotMatch(all.build.text, /steps\.changes\./, "the build job has no change detection step of its own");
    assert.doesNotMatch(lane.text, /needs\.build\./, "the lane never waits for the build job");
  });

  test("the app-host build is dist/ with the API base at the mock host and the grown-up home flag on, on a Metro cache of its own", () => {
    const build = step("Build the app-host bundle");
    assert.match(build, new RegExp(`EXPO_PUBLIC_API_BASE_URL: "${MOCK_API.replace(/[.]/g, "\\.")}"`));
    assert.match(build, /EXPO_PUBLIC_GROWN_UP_HOME: "true"/);
    assert.match(build, /export TMPDIR="\$RUNNER_TEMP\/billing-e2e-tmp"/);
    assert.match(build, /pnpm --filter @hangul-route\/mobile build:web$/m);
    // Whatever the step's layout: no actions/cache step of the lane touches a Metro or Next cache.
    const cacheSteps = lane.text
      .split(/\n(?=      - )/)
      .filter((st) => /^\s+(- )?uses: actions\/cache(\/\w+)?@/m.test(st));
    for (const st of cacheSteps) {
      assert.doesNotMatch(st, /metro-cache|\.next\/cache/, `a restored Metro or Next cache could serve flag-off values:\n${st}`);
    }
    // The specs mock this host; merge-console.mjs passes it to the console as NEXT_PUBLIC_API_BASE_URL.
    assert.ok(read("apps/web/e2e/billing-step-up.spec.ts").includes(`const API = '${MOCK_API}';`));
    assert.match(read("apps/mobile/scripts/app-host/merge-console.mjs"), /out\.NEXT_PUBLIC_API_BASE_URL = env\.EXPO_PUBLIC_API_BASE_URL/);
  });

  test("the web billing run plays every spec that reads BILLING_E2E, on the merged dist", () => {
    const run = step("Billing e2e (web specs");
    assert.match(run, /working-directory: apps\/web/);
    assert.match(run, /BILLING_E2E: "1"/);
    assert.match(run, /E2E_OUT: \.\.\/mobile\/dist/);
    const listed = specArgs(run);
    const dir = join(ROOT, "apps", "web", "e2e");
    const reads = readdirSync(dir).filter((n) => n.endsWith(".spec.ts") && readFileSync(join(dir, n), "utf8").includes("BILLING_E2E"));
    assert.deepEqual(reads.sort(), ["billing-step-up.spec.ts", "billing.spec.ts"]);
    assert.deepEqual(listed.sort(), reads.map((n) => `e2e/${n}`).sort());
  });

  test("the PWA run plays every spec with a flag-on block (test.skip(!ON)) with E2E_GROWN_UP_HOME=1, on the same dist", () => {
    const run = step("Grown-up home e2e (flag-on PWA specs");
    assert.match(run, /if: \$\{\{ !cancelled\(\) \}\}/, "runs even when the web billing run failed");
    assert.match(run, /working-directory: apps\/mobile/);
    assert.match(run, /E2E_GROWN_UP_HOME: "1"/);
    assert.doesNotMatch(run, /STORY_FIXTURES|E2E_ROUTE/, "serves dist/, not a fixture or plan bundle");
    const listed = specArgs(run);
    const dir = join(ROOT, "apps", "mobile", "e2e", "web");
    // Every spec that mentions E2E_GROWN_UP_HOME, however it gates on it, is either in the lane or one that only
    // skips itself when the flag is on (it runs in the release-build shards instead).
    const SKIP_ONLY_WHEN_ON = ["plan-screen.spec.ts"];
    const mentions = readdirSync(dir).filter(
      (n) => n.endsWith(".spec.ts") && readFileSync(join(dir, n), "utf8").includes("E2E_GROWN_UP_HOME")
    );
    for (const n of SKIP_ONLY_WHEN_ON) {
      const src = readFileSync(join(dir, n), "utf8");
      assert.ok(mentions.includes(n), `${n} still reads E2E_GROWN_UP_HOME`);
      assert.match(src, /test\.skip\(\s*ON\b/, `${n} skips itself when the flag is on`);
      assert.doesNotMatch(src, /test\.skip\(\s*!ON\b/, `${n} has a flag-on block, so it belongs in the lane`);
    }
    const flagOn = mentions.filter((n) => !SKIP_ONLY_WHEN_ON.includes(n));
    assert.deepEqual(flagOn.sort(), ["grown-up-entries.spec.ts", "plan-screen-same-tab.spec.ts", "plan-status.spec.ts"]);
    assert.deepEqual(listed.sort(), flagOn.map((n) => `e2e/web/${n}`).sort());
  });

  test("apps/web and apps/mobile pin the same @playwright/test (the lane installs one Chromium for both runs)", () => {
    const pin = (dir) => JSON.parse(read(`${dir}/package.json`)).devDependencies?.["@playwright/test"];
    assert.ok(pin("apps/mobile"), "apps/mobile pins @playwright/test");
    assert.equal(pin("apps/web"), pin("apps/mobile"));
    assert.match(lane.text, /apps\/mobile\/node_modules\/@playwright\/test\/package\.json/);
  });

  test("both runs keep their own output folder and the results upload on failure", () => {
    assert.match(step("Billing e2e (web specs"), /--output test-results\/billing/);
    assert.match(step("Grown-up home e2e (flag-on PWA specs"), /--output test-results\/grown-up-home/);
    const upload = step("Upload the billing e2e results");
    assert.match(upload, /if: failure\(\)/);
    assert.match(upload, /uses: actions\/upload-artifact@/);
    assert.match(upload, /apps\/web\/test-results/);
    assert.match(upload, /apps\/mobile\/test-results/);
    assert.match(upload, /overwrite: true/);
  });
});
