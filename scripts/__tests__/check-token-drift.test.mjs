// Self-tests for scripts/check-token-drift.mjs (F-DES-001 / T-019).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "check-token-drift.mjs"
);

function run(rootDir) {
  return spawnSync("node", [SCRIPT], {
    env: { ...process.env, HANGUL_ROUTE_ROOT: rootDir },
    encoding: "utf8",
  });
}

function makeRoot() {
  return mkdtempSync(join(tmpdir(), "tokdrift-"));
}

function writeTokensTs(root, body) {
  const full = join(root, "packages", "design-system", "src", "tokens.ts");
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
}

function writeTokenSourceMd(root, kind, version) {
  const dir = join(root, "design", "tokens");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${kind}.v${version}.md`), `# ${kind} v${version}\n`);
}

describe("check-token-drift.mjs", () => {
  test("no design/tokens dir: exit 0 with notice", () => {
    const root = makeRoot();
    try {
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /design\/tokens\/ does not exist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("design/tokens exists but no <kind>.v<N>.md: exit 0 (dormant)", () => {
    const root = makeRoot();
    try {
      mkdirSync(join(root, "design", "tokens"), { recursive: true });
      writeFileSync(join(root, "design", "tokens", "README.md"), "# README");
      writeTokensTs(root, "export const colors = {} as const;\n");
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /no <kind>\.v<N>\.md/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("design declares colors but tokens.ts is empty: exit 1", () => {
    const root = makeRoot();
    try {
      writeTokenSourceMd(root, "colors", 1);
      writeTokensTs(root, "export const colors = {} as const;\n");
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /token drift — colors/);
      assert.match(r.stdout, /body is empty/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("design declares colors and tokens.ts has non-empty body: exit 0", () => {
    const root = makeRoot();
    try {
      writeTokenSourceMd(root, "colors", 1);
      writeTokensTs(
        root,
        "export const colors = { brand: { primary: '#FF6B35' } } as const;\n"
      );
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /0 drift violation/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("design declares colors but tokens.ts is missing the export: exit 1", () => {
    const root = makeRoot();
    try {
      writeTokenSourceMd(root, "colors", 1);
      writeTokensTs(root, "// no colors export here\n");
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /no `export const colors/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("tokens.ts missing entirely: exit 1", () => {
    const root = makeRoot();
    try {
      mkdirSync(join(root, "design", "tokens"), { recursive: true });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /tokens\.ts missing/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("multiple kinds: typography passes, spacing fails → exit 1", () => {
    const root = makeRoot();
    try {
      writeTokenSourceMd(root, "typography", 1);
      writeTokenSourceMd(root, "spacing", 1);
      writeTokensTs(
        root,
        [
          "export const typography = { body: { size: 16 } } as const;",
          "export const spacing = {} as const;",
        ].join("\n") + "\n"
      );
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /token drift — spacing/);
      assert.doesNotMatch(r.stdout, /token drift — typography/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores unknown kinds in design/tokens/", () => {
    const root = makeRoot();
    try {
      writeTokenSourceMd(root, "unknownkind", 1);
      writeTokensTs(root, "export const colors = {} as const;\n");
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /no <kind>\.v<N>\.md/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
