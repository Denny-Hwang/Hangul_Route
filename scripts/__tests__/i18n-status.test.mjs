// Self-tests for scripts/i18n-status.mjs (F-I18N-001 §3.10, PR 13).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "i18n-status.mjs");

const { computeStatus, countStrictDeclarations, escapeAnnotation, hashEnglishSource, parseLocaleStatusSource, parseStrictLocales, renderReport, validateLedger } =
  await import(SCRIPT);

const sha = (text) => createHash("sha256").update(text).digest("hex");
const SHA_A = sha("a");
const SHA_B = sha("b");

const roots = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function run(root, args = [], script = SCRIPT) {
  return spawnSync("node", [script, ...args], {
    cwd: root,
    env: { ...process.env, HANGUL_ROUTE_ROOT: root },
    encoding: "utf8",
  });
}

const BASE = {
  locales: ["en", "es", "ko"],
  status: { en: "shipped", es: "hidden", ko: "hidden" },
  namespaces: ["common", "learner"],
  fallbacks: { es: ["common.ok", "learner.home.title"], ko: [] },
  enShas: { common: SHA_A, learner: SHA_B },
  ledger: { es: {}, ko: {} },
  strictLocales: [],
};
const status = (over = {}) => computeStatus({ ...BASE, ...over });
const entry = (enSha, extra = {}) => ({ enSha, reviewedBy: "SH", reviewedAt: "2026-11-02", ...extra });

describe("parseStrictLocales (content-validation.yml)", () => {
  test("reads the quoted or bare comma list, ignoring spaces and empties", () => {
    assert.deepEqual(parseStrictLocales('env:\n  HANGUL_ROUTE_STRICT_LOCALES: "es, ko"\n'), ["es", "ko"]);
    assert.deepEqual(parseStrictLocales("env:\n  HANGUL_ROUTE_STRICT_LOCALES: es\n"), ["es"]);
    assert.deepEqual(parseStrictLocales("  HANGUL_ROUTE_STRICT_LOCALES: 'ko,'  # comment\n"), ["ko"]);
  });

  test("an empty value or no line at all means no strict locale", () => {
    assert.deepEqual(parseStrictLocales('  HANGUL_ROUTE_STRICT_LOCALES: ""\n'), []);
    assert.deepEqual(parseStrictLocales("name: x\n"), []);
  });

  test("content-validation.yml declares the list (empty until a locale ships)", () => {
    const text = readFileSync(join(REPO, ".github/workflows/content-validation.yml"), "utf8");
    assert.match(text, /^[ \t]*HANGUL_ROUTE_STRICT_LOCALES:/m);
  });

  test("a commented-out line does not count", () => {
    assert.deepEqual(parseStrictLocales('  # HANGUL_ROUTE_STRICT_LOCALES: "es"\n'), []);
  });

  test("countStrictDeclarations counts every uncommented declaration", () => {
    assert.equal(countStrictDeclarations("name: x\n"), 0);
    assert.equal(countStrictDeclarations('env:\n  HANGUL_ROUTE_STRICT_LOCALES: "es"\n  # HANGUL_ROUTE_STRICT_LOCALES: ""\n'), 1);
    const twice = 'env:\n  HANGUL_ROUTE_STRICT_LOCALES: "es"\njobs:\n  v:\n    env:\n      HANGUL_ROUTE_STRICT_LOCALES: ""\n';
    assert.equal(countStrictDeclarations(twice), 2);
  });

  test("content-validation.yml declares the list exactly once", () => {
    const text = readFileSync(join(REPO, ".github/workflows/content-validation.yml"), "utf8");
    assert.equal(countStrictDeclarations(text), 1);
  });
});

describe("parseLocaleStatusSource (LOCALE_STATUS at the base ref)", () => {
  test("reads the object literal of locales.ts, quoted or bare keys", () => {
    const ts = "export const LOCALE_STATUS: Record<UiLocale, LocaleStatus> = {\n  en: 'shipped',\n  es: \"hidden\",\n  ko: 'hidden',\n};\n";
    assert.deepEqual(parseLocaleStatusSource(ts), { en: "shipped", es: "hidden", ko: "hidden" });
    assert.deepEqual(parseLocaleStatusSource('export const LOCALE_STATUS = {"en":"shipped","es":"shipped"};'), { en: "shipped", es: "shipped" });
  });

  test("no LOCALE_STATUS literal gives null", () => {
    assert.equal(parseLocaleStatusSource("export const X = 1;\n"), null);
  });

  test("the repository's locales.ts parses to the live LOCALE_STATUS keys", () => {
    const parsed = parseLocaleStatusSource(readFileSync(join(REPO, "packages/i18n/src/locales.ts"), "utf8"));
    assert.deepEqual(Object.keys(parsed ?? {}), ["en", "es", "ko"]);
  });
});

describe("hashEnglishSource and escapeAnnotation", () => {
  test("the hash ignores CRLF vs LF line endings", () => {
    assert.equal(hashEnglishSource(Buffer.from("a\r\nb\r\n")), hashEnglishSource(Buffer.from("a\nb\n")));
    assert.equal(hashEnglishSource(Buffer.from("a\nb\n")), sha("a\nb\n"));
  });

  test("annotation text escapes %, CR and LF so a value cannot start a new workflow command", () => {
    assert.equal(escapeAnnotation("50%\r\n::error::x"), "50%25%0D%0A::error::x");
  });
});

describe("validateLedger", () => {
  const opts = { overlayLocales: ["es", "ko"], namespaces: ["common", "learner"] };

  test("the empty ledger and a well-formed entry pass", () => {
    assert.deepEqual(validateLedger({ es: {}, ko: {} }, opts), []);
    assert.deepEqual(validateLedger({ es: { common: entry(SHA_A) } }, opts), []);
  });

  test("not an object, or a locale value that is not an object", () => {
    assert.equal(validateLedger([], opts).length, 1);
    assert.equal(validateLedger({ es: "x" }, opts).length, 1);
  });

  test("an unknown or source locale is refused", () => {
    assert.match(validateLedger({ en: {} }, opts)[0], /"en" is not an overlay locale/);
    assert.match(validateLedger({ fr: {} }, opts)[0], /"fr" is not an overlay locale/);
  });

  test("an unknown namespace is refused (granularity is the namespace file)", () => {
    assert.match(validateLedger({ es: { "learner.home": entry(SHA_A) } }, opts)[0], /learner\.home/);
  });

  test("each field is checked: sha, initials, date, no extra fields", () => {
    assert.match(validateLedger({ es: { common: entry("abc") } }, opts)[0], /enSha/);
    assert.match(validateLedger({ es: { common: entry(SHA_A, { reviewedBy: " " }) } }, opts)[0], /reviewedBy/);
    for (const reviewedBy of ["Sam Hill", "sam@example.com", "sh", "S", "ABCDE", "S\nH"]) {
      assert.match(validateLedger({ es: { common: entry(SHA_A, { reviewedBy }) } }, opts)[0] ?? "", /reviewedBy.*initials.*public/, reviewedBy);
    }
    assert.deepEqual(validateLedger({ es: { common: entry(SHA_A, { reviewedBy: "JMR" }) } }, opts), []);
    assert.match(validateLedger({ es: { common: entry(SHA_A, { reviewedAt: "2026-13-40" }) } }, opts)[0], /reviewedAt/);
    assert.match(validateLedger({ es: { common: entry(SHA_A, { reviewedAt: "11/02/2026" }) } }, opts)[0], /reviewedAt/);
    assert.match(validateLedger({ es: { common: entry(SHA_A, { note: "x" }) } }, opts)[0], /note/);
    assert.match(validateLedger({ es: { common: "x" } }, opts)[0], /common/);
  });
});

describe("computeStatus", () => {
  test("hidden locales report missing keys without failing", () => {
    const r = status();
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    const es = r.locales.find((l) => l.locale === "es");
    assert.equal(es.status, "hidden");
    assert.equal(es.missing, 2);
    assert.deepEqual(es.namespaces.map((n) => [n.namespace, n.missing.length, n.review]), [
      ["common", 1, "unreviewed"],
      ["learner", 1, "unreviewed"],
    ]);
  });

  test("the source locale is listed as the source, with no namespaces", () => {
    const en = status().locales.find((l) => l.locale === "en");
    assert.equal(en.source, true);
    assert.deepEqual(en.namespaces, []);
  });

  test("a ledger entry whose enSha matches is current; a different one is stale and warns", () => {
    const r = status({ ledger: { es: { common: entry(SHA_A), learner: entry(SHA_A) } } });
    const es = r.locales.find((l) => l.locale === "es");
    assert.deepEqual(es.namespaces.map((n) => n.review), ["current", "stale"]);
    assert.equal(r.errors.length, 0);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /es.*learner/);
  });

  test("missing keys in a shipped locale fail and name the keys", () => {
    const r = status({ status: { ...BASE.status, es: "shipped" }, strictLocales: ["es"] });
    assert.ok(r.errors.some((e) => /es.*missing.*learner\.home\.title/.test(e)), r.errors.join("\n"));
  });

  test("the release gate: a shipped locale needs a ledger entry per namespace and a strict validator", () => {
    const r = status({ status: { ...BASE.status, ko: "shipped" } });
    assert.ok(r.errors.some((e) => /ko.*common.*review/.test(e)), r.errors.join("\n"));
    assert.ok(r.errors.some((e) => /ko.*HANGUL_ROUTE_STRICT_LOCALES/.test(e)), r.errors.join("\n"));
  });

  test("a fully translated, reviewed and strict shipped locale passes", () => {
    const r = status({
      status: { ...BASE.status, ko: "shipped" },
      ledger: { ko: { common: entry(SHA_A), learner: entry(SHA_B) } },
      strictLocales: ["ko"],
    });
    assert.deepEqual(r.errors, []);
  });

  test("a stale namespace in a shipped locale warns but does not fail", () => {
    const r = status({
      status: { ...BASE.status, ko: "shipped" },
      ledger: { ko: { common: entry(SHA_B), learner: entry(SHA_B) } },
      strictLocales: ["ko"],
    });
    assert.deepEqual(r.errors, []);
    assert.equal(r.warnings.length, 1);
  });

  test("a strict locale that is the source or unknown is a typo and fails", () => {
    assert.ok(status({ strictLocales: ["en"] }).errors.some((e) => /HANGUL_ROUTE_STRICT_LOCALES lists "en"/.test(e)));
    assert.ok(status({ strictLocales: ["fr"] }).errors.some((e) => /HANGUL_ROUTE_STRICT_LOCALES lists "fr"/.test(e)));
  });

  test("a strict hidden locale is allowed (strict before shipping)", () => {
    assert.deepEqual(status({ strictLocales: ["es"] }).errors, []);
  });

  test("flipping a locale to shipped needs every review current; a stale (or forged) enSha fails the flip", () => {
    const flip = {
      status: { ...BASE.status, ko: "shipped" },
      ledger: { ko: { common: entry(SHA_A), learner: entry("0".repeat(64)) } },
      strictLocales: ["ko"],
    };
    const r = status({ ...flip, baseStatus: { en: "shipped", es: "hidden", ko: "hidden" } });
    assert.ok(r.errors.some((e) => /ko flips to shipped but learner.*enSha/.test(e)), r.errors.join("\n"));
    assert.ok(!r.errors.some((e) => /common/.test(e)), r.errors.join("\n"));
    assert.deepEqual(status({ ...flip, baseStatus: { en: "shipped", es: "hidden", ko: "shipped" } }).errors, []);
    assert.deepEqual(status(flip).errors, [], "no base ref (push to main, local run): stale only warns");
  });

  test("more than one HANGUL_ROUTE_STRICT_LOCALES declaration fails", () => {
    assert.ok(status({ strictDeclarations: 2 }).errors.some((e) => /declare HANGUL_ROUTE_STRICT_LOCALES once/.test(e)));
    assert.deepEqual(status({ strictDeclarations: 1 }).errors, []);
  });

  test("ledger shape errors are reported", () => {
    assert.ok(status({ ledger: { es: { common: entry("bad") } } }).errors.some((e) => /enSha/.test(e)));
  });

  test("a namespace without an English file fails", () => {
    assert.ok(status({ enShas: { common: SHA_A } }).errors.some((e) => /learner/.test(e)));
  });
});

describe("renderReport", () => {
  test("prints each locale's status and each namespace, and the missing paths with list", () => {
    const r = status({ ledger: { es: { common: entry(SHA_A) } } });
    const text = renderReport(r, { list: false, englishAuthoritative: ["landing.legal.privacy."] });
    assert.match(text, /en\s+shipped\s+source/);
    assert.match(text, /es\s+hidden\s+2 missing/);
    assert.match(text, /common\s+1 missing\s+reviewed by SH on 2026-11-02/);
    assert.match(text, /learner\s+1 missing\s+not reviewed/);
    assert.match(text, /ko\s+hidden\s+0 missing/);
    assert.match(text, /landing\.legal\.privacy\.\*/);
    assert.doesNotMatch(text, /learner\.home\.title/);
    assert.match(renderReport(r, { list: true, englishAuthoritative: [] }), /learner\.home\.title/);
  });

  test("prints the current enSha of every English namespace for the ledger", () => {
    const text = renderReport(status(), { list: false, englishAuthoritative: [] });
    assert.match(text, new RegExp(`common\\s+enSha ${SHA_A}`));
    assert.match(text, new RegExp(`learner\\s+enSha ${SHA_B}`));
  });

  test("a stale namespace says the English changed since review", () => {
    const r = status({ ledger: { es: { learner: entry(SHA_A) } } });
    assert.match(renderReport(r, { list: false, englishAuthoritative: [] }), /learner.*English changed since/);
  });
});

/** A tiny TypeScript i18n package and the files the script reads, so main() runs end to end. */
function makeRoot({ status: localeStatus = { en: "shipped", es: "hidden", ko: "hidden" }, esFallbacks = ["learner.title"], ledger = { es: {}, ko: {} }, strict = "" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "i18nstatus-"));
  roots.push(root);
  const files = {
    "packages/i18n/src/messages/en/common.ts": "export const common = { ok: 'OK' } as const;\n",
    "packages/i18n/src/messages/en/learner.ts": "export const learner = { title: 'Home' } as const;\n",
    "packages/i18n/src/messages/en/index.ts":
      "import { common } from './common';\nimport { learner } from './learner';\nexport const en = { common, learner } as const;\n",
    "packages/i18n/src/index.ts": [
      "import type { Messages } from './types';",
      "export { en } from './messages/en';",
      "export { LOCALE_STATUS } from './locales';",
      "export const ENGLISH_AUTHORITATIVE_PREFIXES = ['landing.legal.privacy.'] as const;",
      "const FALLBACKS: Record<string, string[]> = " + JSON.stringify({ es: esFallbacks, ko: [] }) + ";",
      "export function fallbackPaths(locale: string): string[] { return FALLBACKS[locale] ?? []; }",
      "export type Unused = Messages;",
      "",
    ].join("\n"),
    "packages/i18n/src/locales.ts": "export const LOCALE_STATUS: Record<string, 'shipped' | 'hidden'> = " + JSON.stringify(localeStatus) + ";\n",
    "packages/i18n/src/types.ts": "export type Messages = Record<string, unknown>;\n",
    "packages/i18n/src/messages/review-ledger.json": JSON.stringify(ledger),
    ".github/workflows/content-validation.yml": `env:\n  HANGUL_ROUTE_STRICT_LOCALES: "${strict}"\n`,
  };
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

const fileSha = (root, ns) => sha(readFileSync(join(root, "packages/i18n/src/messages/en", `${ns}.ts`)));
const git = (root, ...args) => {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

describe("main (end to end, TypeScript loaded through ts-loader.mjs)", () => {
  test("hidden locales: exit 0 with the report", () => {
    const r = run(makeRoot());
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /es\s+hidden\s+1 missing/);
    assert.doesNotMatch(r.stdout, /::error::/);
  });

  test("--list prints the missing paths", () => {
    const r = run(makeRoot(), ["--list"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /learner\.title/);
  });

  test("a shipped locale with a missing key fails with an annotation", () => {
    const r = run(makeRoot({ status: { en: "shipped", es: "shipped", ko: "hidden" }, strict: "es" }));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error::.*es.*learner\.title/);
  });

  test("a shipped, complete, reviewed, strict locale passes; a stale review warns", () => {
    const base = makeRoot({ status: { en: "shipped", es: "shipped", ko: "hidden" }, esFallbacks: [], strict: "es" });
    const ledger = { es: { common: entry(fileSha(base, "common")), learner: entry(fileSha(base, "learner")) } };
    writeFileSync(join(base, "packages/i18n/src/messages/review-ledger.json"), JSON.stringify(ledger));
    const ok = run(base);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.doesNotMatch(ok.stdout, /::(error|warning)::/);

    writeFileSync(join(base, "packages/i18n/src/messages/en/learner.ts"), "export const learner = { title: 'Start' } as const;\n");
    const stale = run(base);
    assert.equal(stale.status, 0, stale.stdout + stale.stderr);
    assert.match(stale.stdout, /::warning::.*es.*learner/);
  });

  test("an unreadable ledger fails", () => {
    const root = makeRoot();
    writeFileSync(join(root, "packages/i18n/src/messages/review-ledger.json"), "{ nope");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error[^:]*::.*review-ledger\.json is not readable JSON/);
  });

  test("an unknown option fails, and --base needs a ref", () => {
    assert.equal(run(makeRoot(), ["--nope"]).status, 1);
    const r = run(makeRoot(), ["--base"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /--base needs a git ref/);
  });

  test("--base: a flip with a stale review fails; the same ledger passes once the locale was already shipped", () => {
    const root = makeRoot({ esFallbacks: [], strict: "es" });
    const ledger = { es: { common: entry(fileSha(root, "common")), learner: entry(sha("an older learner.ts")) } };
    writeFileSync(join(root, "packages/i18n/src/messages/review-ledger.json"), JSON.stringify(ledger));
    git(root, "init", "-q");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "base");
    const base = git(root, "rev-parse", "HEAD");
    const locales = join(root, "packages/i18n/src/locales.ts");
    writeFileSync(locales, readFileSync(locales, "utf8").replace('"es":"hidden"', '"es":"shipped"'));

    const flip = run(root, ["--base", base]);
    assert.equal(flip.status, 1, flip.stdout + flip.stderr);
    assert.match(flip.stdout, /::error::es flips to shipped but learner/);

    git(root, "commit", "-qam", "ship es");
    const later = run(root, ["--base", git(root, "rev-parse", "HEAD")]);
    assert.equal(later.status, 0, later.stdout + later.stderr);
    assert.match(later.stdout, /::warning::.*es.*learner/);
  });

  test("--base with an unreadable ref fails closed", () => {
    const root = makeRoot();
    git(root, "init", "-q");
    const r = run(root, ["--base", "no-such-ref"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error::.*LOCALE_STATUS at no-such-ref/);
  });

  test("two HANGUL_ROUTE_STRICT_LOCALES declarations fail end to end", () => {
    const root = makeRoot();
    writeFileSync(join(root, ".github/workflows/content-validation.yml"), 'env:\n  HANGUL_ROUTE_STRICT_LOCALES: "es"\njobs:\n  v:\n    env:\n      HANGUL_ROUTE_STRICT_LOCALES: ""\n');
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error::.*declare HANGUL_ROUTE_STRICT_LOCALES once/);
  });

  test("no content-validation.yml: a shipped locale fails on the strict list", () => {
    const root = makeRoot({ status: { en: "shipped", es: "shipped", ko: "hidden" }, esFallbacks: [] });
    unlinkSync(join(root, ".github/workflows/content-validation.yml"));
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error::es is shipped but not in HANGUL_ROUTE_STRICT_LOCALES/);
  });

  test("a namespace whose English file is missing on disk fails", () => {
    const root = makeRoot();
    const en = join(root, "packages/i18n/src/messages/en");
    writeFileSync(join(en, "index.ts"), "import { common } from './common';\nexport const en = { common, learner: { title: 'Home' } } as const;\n");
    unlinkSync(join(en, "learner.ts"));
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error::namespace "learner" has no English file/);
  });

  test("ts-loader: a JSON file imported from TypeScript without attributes is the default export", () => {
    const root = makeRoot({ esFallbacks: [] });
    writeFileSync(join(root, "packages/i18n/src/data.json"), JSON.stringify({ fallbacks: ["learner.title"] }));
    const index = join(root, "packages/i18n/src/index.ts");
    const text = readFileSync(index, "utf8")
      .replace("import type { Messages } from './types';", "import type { Messages } from './types';\nimport data from './data.json';")
      .replace('const FALLBACKS: Record<string, string[]> = {"es":[],"ko":[]};', "const FALLBACKS: Record<string, string[]> = { es: data.fallbacks, ko: [] };");
    writeFileSync(index, text);
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /es\s+hidden\s+1 missing/);
  });

  test("run through a symlinked path, the script still runs (it does not exit 0 silently)", () => {
    const link = join(mkdtempSync(join(tmpdir(), "i18nstatus-link-")), "i18n-status.mjs");
    roots.push(dirname(link));
    symlinkSync(SCRIPT, link);
    const r = run(makeRoot(), ["--bogus"], link);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /unknown option/);
  });

  // PR 15 / PR 16 update this test when they flip es / ko to 'shipped'.
  test("the repository itself: es and ko hidden, exit 0, every namespace listed", () => {
    const r = spawnSync("node", [SCRIPT], { encoding: "utf8", env: { ...process.env, HANGUL_ROUTE_ROOT: "" } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /es\s+hidden/);
    assert.match(r.stdout, /ko\s+hidden/);
    for (const ns of ["common", "a11y", "learner", "caregiver", "console", "landing"]) assert.match(r.stdout, new RegExp(`\\b${ns}\\b`));
    assert.match(r.stdout, /landing\.legal\.privacy\.\*/);
  });
});
