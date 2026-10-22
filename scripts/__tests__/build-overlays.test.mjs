// Self-tests for scripts/build-overlays.mjs (F-I18N-001 §3.6, PR 12).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "build-overlays.mjs");
const OUT_REL = join("packages", "content-schema", "src", "i18n-overlays.generated.ts");

const { GENERATED_HEADER, buildOverlays, isLessonOverlay, renderOverlays } = await import(SCRIPT);

const roots = [];
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "buildovl-"));
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

function put(root, rel, value) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

const overlay = (locale, domain, entries) => ({ locale, domain, entries });
const file = (rel, json) => ({ rel, json });

describe("build-overlays.mjs: merging (pure)", () => {
  test("merges every file of a locale, sorted by id and field, both locales always present", () => {
    const model = buildOverlays([
      file("content/i18n/es/b.json", overlay("es", "b", { "card:b": { title: "B", blurb: "bb" } })),
      file("content/i18n/es/a.json", overlay("es", "a", { "card:a": { title: "A" } })),
    ]);
    assert.deepEqual(model, { es: { "card:a": { title: "A" }, "card:b": { blurb: "bb", title: "B" } }, ko: {} });
    assert.deepEqual(Object.keys(model.es), ["card:a", "card:b"]);
    assert.deepEqual(Object.keys(model.es["card:b"]), ["blurb", "title"]);
  });

  test("keeps Hangul in ko values and leaves the text untouched", () => {
    const model = buildOverlays([file("content/i18n/ko/vocab-food.json", overlay("ko", "vocab-food", { "vocab:sagwa": { gloss: "빨갛고 동그란 과일" } }))]);
    assert.equal(model.ko["vocab:sagwa"].gloss, "빨갛고 동그란 과일");
  });

  test("drops what the app must never apply: forbidden fields, bad ids, blank or non-string values, empty entries", () => {
    const model = buildOverlays([
      file(
        "content/i18n/es/x.json",
        overlay("es", "x", {
          "card:a": { title: "A", romanization: "a", ko: "가" },
          "Card:bad": { title: "x" },
          "planet:mars": { title: "x" },
          "card:b": { title: "  ", blurb: 3 },
        }),
      ),
    ]);
    assert.deepEqual(model, { es: { "card:a": { title: "A" } }, ko: {} });
  });

  test("an entity in two files of one locale is a content error", () => {
    assert.throws(
      () =>
        buildOverlays([
          file("content/i18n/es/a.json", overlay("es", "a", { "card:a": { title: "A" } })),
          file("content/i18n/es/b.json", overlay("es", "b", { "card:a": { blurb: "B" } })),
        ]),
      /card:a is also in content\/i18n\/es\/a\.json/,
    );
  });

  test("a file that is not { locale, domain, entries } of its folder is a content error", () => {
    assert.throws(() => buildOverlays([file("content/i18n/es/a.json", [])]), /an overlay file is \{ locale, domain, entries \}/);
    assert.throws(() => buildOverlays([file("content/i18n/es/a.json", overlay("ko", "a", {}))]), /locale "ko" differs from its folder es/);
    assert.throws(() => buildOverlays([file("content/i18n/es/a.json", overlay("es", "a", []))]), /entries must be an object/);
    assert.throws(() => buildOverlays([file("content/i18n/es/a.json", overlay("es", "a", { "card:a": "x" }))]), /card:a must be an object/);
  });

  test("renders a typed module with the header, deterministic and ending in a newline", () => {
    const model = buildOverlays([file("content/i18n/es/a.json", overlay("es", "a", { "card:a": { title: "Á" } }))]);
    const source = renderOverlays(model);
    assert.ok(source.startsWith(GENERATED_HEADER));
    assert.match(source, /import type \{ Overlays \} from '\.\/schemas\/locale-overlay';/);
    assert.match(source, /export const OVERLAYS: Overlays = \{/);
    assert.match(source, /"card:a": \{\n {6}"title": "Á"\n {4}\}/);
    assert.ok(source.endsWith("};\n"));
    assert.equal(renderOverlays(model), source);
  });
});

describe("build-overlays.mjs: CLI", () => {
  test("writes the module from content/i18n/es and ko, skipping other folders and loose files", () => {
    const root = makeRoot();
    put(root, "content/i18n/es/cards.json", overlay("es", "cards", { "card:a": { title: "A" } }));
    put(root, "content/i18n/ko/cards.json", overlay("ko", "cards", { "card:a": { title: "가 카드" } }));
    put(root, "content/i18n/en/cards.json", overlay("en", "cards", { "card:a": { title: "nope" } }));
    put(root, "content/i18n/fr/cards.json", "not even json");
    put(root, "content/i18n/loose.json", "{}");
    put(root, "content/i18n/es/README.md", "# notes");
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /wrote .*i18n-overlays\.generated\.ts: es 1 entit/);
    const out = readFileSync(join(root, OUT_REL), "utf8");
    assert.match(out, /"title": "A"/);
    assert.match(out, /"title": "가 카드"/);
    assert.doesNotMatch(out, /nope/);
  });

  test("leaves lesson glosses (lessons-stage<n>-<theme>.json) to build-lessons.mjs (F-CURR-001 §3.10)", () => {
    const root = makeRoot();
    put(root, "content/i18n/es/cards.json", overlay("es", "cards", { "card:a": { title: "A" } }));
    put(root, "content/i18n/es/lessons-stage2-rites.json", overlay("es", "lessons-stage2-rites", { "episode:stage2-rites": { title: "Palabras de fiesta" } }));
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const out = readFileSync(join(root, OUT_REL), "utf8");
    assert.match(out, /"title": "A"/);
    assert.doesNotMatch(out, /Palabras de fiesta/);
    assert.equal(isLessonOverlay("lessons-stage7-crafts.json"), true);
    assert.equal(isLessonOverlay("lessons.json"), false);
    assert.equal(isLessonOverlay("stage1-quests.json"), false);
  });

  test("with no content/i18n it writes empty overlays", () => {
    const root = makeRoot();
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(readFileSync(join(root, OUT_REL), "utf8"), /"es": \{\},\n {2}"ko": \{\}/);
  });

  test("--check passes when in sync and fails (exit 1) on drift or a missing module", () => {
    const root = makeRoot();
    put(root, "content/i18n/es/cards.json", overlay("es", "cards", { "card:a": { title: "A" } }));
    const missing = run(root, ["--check"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /::error file=.*i18n-overlays\.generated\.ts::generated overlays are missing/);
    assert.equal(run(root).status, 0);
    const ok = run(root, ["--check"]);
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /overlays are up to date/);
    put(root, "content/i18n/es/cards.json", overlay("es", "cards", { "card:a": { title: "B" } }));
    const drift = run(root, ["--check"]);
    assert.equal(drift.status, 1);
    assert.match(drift.stdout, /out of date with content\/i18n.*run pnpm generate/);
  });

  test("malformed JSON fails with an annotation naming the file; an unknown argument exits 2", () => {
    const root = makeRoot();
    put(root, "content/i18n/es/bad.json", "{ nope");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error file=content\/i18n\/es\/bad\.json::invalid JSON/);
    assert.equal(existsSync(join(root, OUT_REL)), false);
    assert.equal(run(root, ["--nope"]).status, 2);
  });

  test("the checked-in module matches the repository's content/i18n", () => {
    const r = spawnSync("node", [SCRIPT, "--check"], { encoding: "utf8", env: { ...process.env, HANGUL_ROUTE_ROOT: REPO } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});
