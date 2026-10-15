// Self-tests for scripts/check-locale-export.mjs (F-I18N-001 §3.4, rows 15b / 16b).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "check-locale-export.mjs");
const { checkLocaleExport, SITE_ORIGIN } = await import(SCRIPT);

const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const page = (lang, extra = "") => `<!DOCTYPE html><html lang="${lang}"${extra}><head></head><body></body></html>`;

/** A minimal export: en at the root, `shipped` locales exported, sitemap listing them. */
function makeOut(shipped, { sitemapLocales = shipped, pageFor = (l) => page(l) } = {}) {
  const out = mkdtempSync(join(tmpdir(), "hr-locale-export-"));
  roots.push(out);
  writeFileSync(join(out, "index.html"), page("en"));
  writeFileSync(join(out, "404.html"), page("en"));
  for (const l of shipped) {
    writeFileSync(join(out, `${l}.html`), pageFor(l));
    mkdirSync(join(out, l));
    for (const p of ["about", "privacy"]) writeFileSync(join(out, l, `${p}.html`), pageFor(l));
  }
  const locs = ["", ...sitemapLocales.map((l) => `/${l}`)].map((p) => `<url><loc>${SITE_ORIGIN}${p || "/"}</loc></url>`).join("");
  writeFileSync(join(out, "sitemap.xml"), `<urlset>${locs}</urlset>`);
  return out;
}

describe("checkLocaleExport", () => {
  test("all three shipped and exported: no problems", () => {
    const out = makeOut(["es", "ko"]);
    assert.deepEqual(checkLocaleExport(out, { en: "shipped", es: "shipped", ko: "shipped" }), []);
  });

  test("a rolled-back (hidden) locale that is absent passes; one left in the export fails", () => {
    const out = makeOut(["es"]);
    assert.deepEqual(checkLocaleExport(out, { en: "shipped", es: "shipped", ko: "hidden" }), []);
    assert.deepEqual(checkLocaleExport(out, { en: "shipped", es: "hidden", ko: "hidden" }), [
      "hidden locale es: es.html is in the export",
      "hidden locale es: es is in the export",
    ]);
  });

  test("a shipped locale missing from the export or the sitemap fails", () => {
    const out = makeOut(["es"], { sitemapLocales: [] });
    const errors = checkLocaleExport(out, { en: "shipped", es: "shipped", ko: "shipped" });
    assert.ok(errors.includes("shipped locale es: sitemap.xml does not list /es"));
    assert.ok(errors.includes("shipped locale ko: missing ko.html"));
    assert.ok(errors.includes("shipped locale ko: missing ko/about.html"));
  });

  test("a shipped page with the wrong lang, the hidden marker or noindex fails", () => {
    const out = makeOut(["es"], { pageFor: () => page("en", ' data-hr-hidden-locale="es"') + '<meta name="robots" content="noindex">' });
    const errors = checkLocaleExport(out, { en: "shipped", es: "shipped" });
    assert.ok(errors.includes('shipped locale es: es.html is not <html lang="es">'));
    assert.ok(errors.includes("shipped locale es: es/about.html still carries data-hr-hidden-locale"));
    assert.ok(errors.includes("shipped locale es: es/privacy.html is noindex"));
  });

  test("the root must be English and the default locale shipped; unknown statuses fail", () => {
    const out = makeOut([]);
    writeFileSync(join(out, "index.html"), page("es"));
    rmSync(join(out, "404.html"));
    assert.deepEqual(checkLocaleExport(out, { en: "hidden", es: "beta" }), [
      "the default locale en is not 'shipped' in LOCALE_STATUS",
      'index.html is not <html lang="en">',
      "missing 404.html",
      'locale es has an unknown LOCALE_STATUS "beta"',
    ]);
    assert.deepEqual(checkLocaleExport(join(out, "nope"), { en: "shipped" }), [`no export folder at ${join(out, "nope")} (run next build first)`]);
  });
});

describe("CLI", () => {
  test("reads LOCALE_STATUS from the repository and checks the given folder", () => {
    const out = makeOut(["es", "ko"]);
    const ok = spawnSync("node", [SCRIPT, out], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /export matches/);

    const bad = makeOut([]);
    const failed = spawnSync("node", [SCRIPT, bad], { encoding: "utf8" });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /missing es\.html/);
  });

  test("fails closed when LOCALE_STATUS cannot be read", () => {
    const root = mkdtempSync(join(tmpdir(), "hr-locale-root-"));
    roots.push(root);
    const r = spawnSync("node", [SCRIPT], { encoding: "utf8", env: { ...process.env, HANGUL_ROUTE_ROOT: root } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /cannot read LOCALE_STATUS/);
  });
});
