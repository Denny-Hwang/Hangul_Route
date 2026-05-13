// Self-tests for scripts/validate-content.mjs (F-CNT-001 / T-019).

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
  "validate-content.mjs"
);

function run(rootDir) {
  return spawnSync("node", [SCRIPT], {
    env: { ...process.env, HANGUL_ROUTE_ROOT: rootDir },
    encoding: "utf8",
  });
}

function makeRoot() {
  return mkdtempSync(join(tmpdir(), "valcnt-"));
}

function writeContent(root, relPath, body) {
  const full = join(root, "content", relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, typeof body === "string" ? body : JSON.stringify(body));
}

describe("validate-content.mjs", () => {
  test("no content/ dir: exit 0 with notice", () => {
    const root = makeRoot();
    try {
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /no content\/ directory/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("empty content/: exit 0", () => {
    const root = makeRoot();
    try {
      mkdirSync(join(root, "content"), { recursive: true });
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /no \.json files under content/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("valid: korean target with romanization + gloss: exit 0", () => {
    const root = makeRoot();
    try {
      writeContent(root, "ok.json", {
        ko: "안녕",
        romanization: "annyeong",
        gloss_en: "hello",
      });
      const r = run(root);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /1 file\(s\) scanned, 0 violation/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("korean target without romanization: exit 1", () => {
    const root = makeRoot();
    try {
      writeContent(root, "missing-romanization.json", {
        ko: "안녕",
        gloss_en: "hello",
      });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /korean-without-romanization/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("korean target without english gloss: exit 1", () => {
    const root = makeRoot();
    try {
      writeContent(root, "missing-gloss.json", {
        ko: "안녕",
        romanization: "annyeong",
      });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /korean-without-gloss/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("'en' (instead of 'gloss_en') satisfies the gloss requirement", () => {
    const root = makeRoot();
    try {
      writeContent(root, "en-gloss.json", {
        ko: "안녕",
        romanization: "annyeong",
        en: "hello",
      });
      const r = run(root);
      assert.equal(r.status, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("korean in non-target UI field: exit 1", () => {
    const root = makeRoot();
    try {
      writeContent(root, "ui-leak.json", { label: "안녕하세요" });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /korean-in-ui-field at \.label/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("malformed JSON: exit 1 with invalid-json", () => {
    const root = makeRoot();
    try {
      writeContent(root, "broken.json", "{ not valid json");
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /invalid-json/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("nested korean in array: violations include array index path", () => {
    const root = makeRoot();
    try {
      writeContent(root, "nested.json", {
        quests: [
          { ko: "가", romanization: "ga", gloss_en: "a" },
          { ko: "나" },
        ],
      });
      const r = run(root);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /quests\.1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
