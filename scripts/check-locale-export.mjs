#!/usr/bin/env node
// Checks the site's static export against LOCALE_STATUS (F-I18N-001 §3.4, rows 11b / 15b / 16b).
// `.github/workflows/preview-deploy.yml` runs it on the default build, so the expected set of exported
// locales follows `packages/i18n/src/locales.ts` instead of a hand-kept list in the workflow:
//
//   - the default locale (`en`) is the root: `index.html` and `404.html` carry `<html lang="en">`;
//   - a `'shipped'` locale has its home (`es.html`) and its `about`, `privacy` pages, each with its own
//     `<html lang>`, no hidden-locale marker and no `noindex`, and `sitemap.xml` lists its home;
//   - a `'hidden'` locale is not in the export at all (`scripts/prune-hidden-locales.mjs` removed it).
//
// Rolling a locale back (runbook §I: set it to 'hidden') therefore keeps this check green.
//
//   node scripts/check-locale-export.mjs [out]      (default: apps/web/out)
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALE_STATUS_REL, parseLocaleStatusSource } from "./i18n-status.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const SITE_ORIGIN = "https://hangulroute.com";
export const DEFAULT_LOCALE = "en";
/** Pages besides the home that every shipped locale must export (whole-segment names under `<locale>/`). */
export const SHIPPED_PAGES = ["about", "privacy"];
const HIDDEN_LOCALE_ATTR = "data-hr-hidden-locale";

const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : null);
const hasLang = (html, locale) => html.includes(`<html lang="${locale}"`);

/**
 * @param {string} outDir the static export
 * @param {Record<string, string>} status LOCALE_STATUS
 * @param {{ defaultLocale?: string }} [options]
 * @returns {string[]} problems (empty when the export matches)
 */
export function checkLocaleExport(outDir, status, { defaultLocale = DEFAULT_LOCALE } = {}) {
  const errors = [];
  if (!existsSync(outDir)) return [`no export folder at ${outDir} (run next build first)`];
  if (status[defaultLocale] !== "shipped") errors.push(`the default locale ${defaultLocale} is not 'shipped' in LOCALE_STATUS`);

  for (const page of ["index.html", "404.html"]) {
    const html = read(join(outDir, page));
    if (html === null) errors.push(`missing ${page}`);
    else if (!hasLang(html, defaultLocale)) errors.push(`${page} is not <html lang="${defaultLocale}">`);
  }

  const sitemap = read(join(outDir, "sitemap.xml"));
  for (const [locale, value] of Object.entries(status)) {
    if (locale === defaultLocale) continue;
    if (value === "shipped") {
      for (const rel of [`${locale}.html`, ...SHIPPED_PAGES.map((p) => `${locale}/${p}.html`)]) {
        const html = read(join(outDir, rel));
        if (html === null) {
          errors.push(`shipped locale ${locale}: missing ${rel}`);
          continue;
        }
        if (!hasLang(html, locale)) errors.push(`shipped locale ${locale}: ${rel} is not <html lang="${locale}">`);
        if (html.includes(HIDDEN_LOCALE_ATTR)) errors.push(`shipped locale ${locale}: ${rel} still carries ${HIDDEN_LOCALE_ATTR}`);
        if (/noindex/.test(html)) errors.push(`shipped locale ${locale}: ${rel} is noindex`);
      }
      if (sitemap === null) errors.push("missing sitemap.xml");
      else if (!sitemap.includes(`<loc>${SITE_ORIGIN}/${locale}</loc>`)) errors.push(`shipped locale ${locale}: sitemap.xml does not list /${locale}`);
    } else if (value === "hidden") {
      for (const rel of [`${locale}.html`, locale]) {
        if (existsSync(join(outDir, rel))) errors.push(`hidden locale ${locale}: ${rel} is in the export`);
      }
    } else {
      errors.push(`locale ${locale} has an unknown LOCALE_STATUS "${value}"`);
    }
  }
  return errors;
}

/** @param {string[]} argv @param {string} root */
export function main(argv, root) {
  const outDir = resolve(root, argv[0] ?? "apps/web/out");
  const source = read(join(root, LOCALE_STATUS_REL));
  const status = source === null ? null : parseLocaleStatusSource(source);
  if (!status || Object.keys(status).length === 0) {
    console.error(`check-locale-export: cannot read LOCALE_STATUS from ${LOCALE_STATUS_REL}`);
    return 1;
  }
  const errors = checkLocaleExport(outDir, status);
  for (const error of errors) console.error(`check-locale-export: ${error}`);
  if (errors.length === 0) {
    const shipped = Object.keys(status).filter((l) => status[l] === "shipped");
    const hidden = Object.keys(status).filter((l) => status[l] === "hidden");
    console.log(`check-locale-export: shipped ${shipped.join(", ") || "none"}; hidden ${hidden.join(", ") || "none"}; export matches`);
  }
  return errors.length > 0 ? 1 : 0;
}

const isMain = Boolean(process.argv[1]) && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isMain) {
  const root = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : join(SCRIPT_DIR, "..");
  process.exitCode = main(process.argv.slice(2), root);
}
