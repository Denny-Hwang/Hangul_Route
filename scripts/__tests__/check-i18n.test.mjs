// Self-tests for scripts/check-i18n.mjs (F-I18N-001 §3.11 / T-019).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "check-i18n.mjs");

function run(root) {
  return spawnSync("node", [SCRIPT], {
    env: { ...process.env, HANGUL_ROUTE_ROOT: root },
    encoding: "utf8",
  });
}

/** files: { "apps/x/y.tsx": "source", "scripts/i18n-migrated.json": "{...}" } */
function makeRoot(files) {
  const root = mkdtempSync(join(tmpdir(), "chki18n-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

const MIGRATED = (extra = {}) =>
  JSON.stringify({ globs: [], pluralTernaryBaseline: {}, ...extra });

describe("check-i18n: a) plural-suffix ternaries", () => {
  test("a clean tree passes", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/mobile/src/a.ts": "export const a = (n: number) => n;\n",
    });
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  test("fails on `=== 1 ? '' : 's'` and names file and line", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/mobile/src/a.ts":
        "export const f = (n: number) =>\n  `${n} day${n === 1 ? '' : 's'}`;\n",
    });
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /apps\/mobile\/src\/a\.ts/);
    assert.match(r.stdout, /line=2/);
  });

  test("fails on `!== 1 ? 's' : ''` (either operand order) and on template/double-quoted branches", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/web/src/a.tsx": "export const f = (n: number) => `x${n !== 1 ? 's' : ''}`;\n",
      "apps/web/src/b.ts": 'export const g = (n: number) => `x${1 === n ? "" : "es"}`;\n',
      "apps/web/src/c.ts": "export const h = (n: number) => `x${n === 1 ? `` : `s`}`;\n",
    });
    const r = run(root);
    assert.equal(r.status, 1);
    for (const f of ["a.tsx", "b.ts", "c.ts"]) assert.match(r.stdout, new RegExp(f.replace(".", "\\.")));
  });

  test("does not flag ternaries that are not plural suffixes", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/mobile/src/a.ts": [
        "export const a = (n: number) => (n === 1 ? 'card' : 'cards');",
        "export const b = (n: number) => (n === 2 ? '' : 's');",
        "export const c = (n: number) => (n > 1 ? 's' : '');",
        "export const d = (n: number) => (n === 1 ? '' : n);",
      ].join("\n"),
    });
    assert.equal(run(root).status, 0);
  });

  test("ignores test files, e2e and node_modules", () => {
    const bad = "export const f = (n: number) => `d${n === 1 ? '' : 's'}`;\n";
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/mobile/src/__tests__/a.test.ts": bad,
      "apps/mobile/src/b.test.ts": bad,
      "apps/web/e2e/c.spec.ts": bad,
      "apps/web/node_modules/x/index.js": bad,
      "apps/web/.next/x.js": bad,
    });
    assert.equal(run(root).status, 0);
  });

  test("ignores build outputs, the console role's out-console/ included (F-APP-001 A-3)", () => {
    const bundled = "export const f = () => new Intl.NumberFormat('en').format(1);\n";
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/mobile/dist/_next/static/chunks/a.js": bundled,
      "apps/mobile/dist-e2e/b.js": bundled,
      "apps/web/out/_next/static/chunks/c.js": bundled,
      "apps/web/out-console/_next/static/chunks/d.js": bundled,
    });
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  test("a file within its baseline passes (legacy), one over it fails", () => {
    const two =
      "export const a = (n: number) => `d${n === 1 ? '' : 's'}`;\nexport const b = (n: number) => `d${n === 1 ? '' : 's'}`;\n";
    const within = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED({ pluralTernaryBaseline: { "apps/mobile/src/a.ts": 2 } }),
      "apps/mobile/src/a.ts": two,
    });
    assert.equal(run(within).status, 0);
    const over = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED({ pluralTernaryBaseline: { "apps/mobile/src/a.ts": 1 } }),
      "apps/mobile/src/a.ts": two,
    });
    const r = run(over);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /baseline/i);
  });

  test("a baseline that can be lowered is a warning, not a failure", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED({ pluralTernaryBaseline: { "apps/mobile/src/a.ts": 3 } }),
      "apps/mobile/src/a.ts": "export const a = 1;\n",
    });
    const r = run(root);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /::warning/);
  });
});

describe("check-i18n: b) migrated surfaces (JSX literals)", () => {
  const SURFACE = {
    "scripts/i18n-migrated.json": MIGRATED({ globs: ["apps/mobile/src/screens/home/**"] }),
  };

  test("an empty migrated list checks nothing", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/mobile/src/screens/home/H.tsx": "export const H = () => <Text>Hello there</Text>;\n",
    });
    assert.equal(run(root).status, 0);
  });

  test("fails on JSX text with letters in a migrated glob", () => {
    const root = makeRoot({
      ...SURFACE,
      "apps/mobile/src/screens/home/H.tsx":
        "export const H = () => (\n  <View>\n    <Text>Hello there</Text>\n  </View>\n);\n",
    });
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /screens\/home\/H\.tsx/);
    assert.match(r.stdout, /line=3/);
  });

  test("fails on Hangul and accented JSX text too", () => {
    const root = makeRoot({
      ...SURFACE,
      "apps/mobile/src/screens/home/A.tsx": "export const A = () => <Text>안녕</Text>;\n",
      "apps/mobile/src/screens/home/B.tsx": "export const B = () => <Text>Hola, mamá</Text>;\n",
    });
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /A\.tsx/);
    assert.match(r.stdout, /B\.tsx/);
  });

  test("passes JSX text without letters, and expression children", () => {
    const root = makeRoot({
      ...SURFACE,
      "apps/mobile/src/screens/home/H.tsx":
        "export const H = ({ m }) => (\n  <View>\n    <Text>{m.title}</Text>\n    <Text> · 3 / 4 </Text>\n    <Text>{'x'}</Text>\n  </View>\n);\n",
    });
    assert.equal(run(root).status, 0);
  });

  test("fails on string-literal label, title, placeholder, alt, accessibilityLabel and accessibilityHint attributes", () => {
    for (const attr of ["label", "title", "placeholder", "alt", "accessibilityLabel", "accessibilityHint"]) {
      const root = makeRoot({
        ...SURFACE,
        "apps/mobile/src/screens/home/H.tsx": `export const H = () => <Thing ${attr}="Play" />;\n`,
      });
      const r = run(root);
      assert.equal(r.status, 1, attr);
      assert.match(r.stdout, new RegExp(attr), attr);
    }
  });

  test("fails on a braced string literal attribute, passes on expressions and other attributes", () => {
    const braced = makeRoot({
      ...SURFACE,
      "apps/mobile/src/screens/home/H.tsx": "export const H = () => <Thing label={'Play'} />;\n",
    });
    assert.equal(run(braced).status, 1);
    const ok = makeRoot({
      ...SURFACE,
      "apps/mobile/src/screens/home/H.tsx":
        'export const H = ({ m }) => <Thing label={m.play} testID="home-play" tone="primary" />;\n',
    });
    assert.equal(run(ok).status, 0);
  });

  test("files outside the migrated globs are not checked", () => {
    const root = makeRoot({
      ...SURFACE,
      "apps/mobile/src/screens/other/O.tsx": "export const O = () => <Text>Hello</Text>;\n",
    });
    assert.equal(run(root).status, 0);
  });
});

describe("check-i18n: c) bare Intl", () => {
  test("fails on Intl outside packages/i18n", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/web/src/a.ts": "export const f = () => new Intl.NumberFormat('en').format(1);\n",
      "apps/web/src/b.ts": "export const g = (o: Intl.DateTimeFormatOptions) => o;\n",
      "apps/web/src/c.ts": "export const h = () => globalThis.Intl;\n",
    });
    const r = run(root);
    assert.equal(r.status, 1);
    for (const f of ["a.ts", "b.ts", "c.ts"]) assert.match(r.stdout, new RegExp(f.replace(".", "\\.")));
  });

  test("allows Intl inside packages/i18n", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "packages/i18n/src/format.ts": "export const f = () => new Intl.NumberFormat('en').format(1);\n",
    });
    assert.equal(run(root).status, 0);
  });

  test("does not flag the word Intl in strings, comments or unrelated property names", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/web/src/a.ts": "// uses Intl later\nexport const s = 'Intl.NumberFormat';\nexport const o = { Intl: 1 };\n",
    });
    assert.equal(run(root).status, 0);
  });
});

describe("check-i18n: robustness", () => {
  test("a missing i18n-migrated.json is an error", () => {
    const root = makeRoot({ "apps/mobile/src/a.ts": "export const a = 1;\n" });
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /i18n-migrated\.json/);
  });

  test("a malformed i18n-migrated.json is an error", () => {
    const root = makeRoot({ "scripts/i18n-migrated.json": "{ nope" });
    assert.equal(run(root).status, 1);
  });

  test("files that do not parse are reported but do not crash the run", () => {
    const root = makeRoot({
      "scripts/i18n-migrated.json": MIGRATED(),
      "apps/mobile/src/a.ts": "export const a = (((;\n",
    });
    const r = run(root);
    assert.notEqual(r.status, null);
    assert.doesNotMatch(r.stderr, /TypeError/);
  });
});
