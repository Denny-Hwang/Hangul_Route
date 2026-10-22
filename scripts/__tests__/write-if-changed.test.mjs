// Self-tests for scripts/write-if-changed.mjs (F-CURR-002 §9.1, row CM-6): a generated module is
// written only when its bytes change, through a temporary file renamed into place.

import { strict as assert } from "node:assert";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { writeIfChanged } from "../write-if-changed.mjs";

const root = mkdtempSync(join(tmpdir(), "write-if-changed-"));
after(() => rmSync(root, { recursive: true, force: true }));

describe("write-if-changed.mjs", () => {
  test("creates the folder and the file, then leaves an unchanged file alone", () => {
    const file = join(root, "a", "b", "module.ts");
    assert.equal(writeIfChanged(file, "export const A = 1;\n"), true);
    assert.equal(readFileSync(file, "utf8"), "export const A = 1;\n");
    const before = statSync(file).mtimeMs;
    assert.equal(writeIfChanged(file, "export const A = 1;\n"), false);
    assert.equal(statSync(file).mtimeMs, before);
  });

  test("replaces a changed file through a renamed temporary file and leaves no temporary file behind", () => {
    const file = join(root, "c", "module.ts");
    writeIfChanged(file, "old\n");
    assert.equal(writeIfChanged(file, "new\n"), true);
    assert.equal(readFileSync(file, "utf8"), "new\n");
    assert.deepEqual(readdirSync(join(root, "c")), ["module.ts"]);
  });

  test("a stale temporary file of the same process is replaced, not left", () => {
    const file = join(root, "d.ts");
    writeFileSync(`${file}.tmp-${process.pid}`, "half");
    writeIfChanged(file, "whole\n");
    assert.equal(readFileSync(file, "utf8"), "whole\n");
    assert.deepEqual(readdirSync(root).filter((n) => n.startsWith("d.ts")), ["d.ts"]);
  });
});
