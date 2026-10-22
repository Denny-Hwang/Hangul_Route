#!/usr/bin/env node
// Postbuild for the static export (F-I18N-001 §3.4, PR 11b): take every locale that has not shipped out of
// `out/` before deploy. `next build` renders `/es` and `/ko` on every build (Next 14 refuses an empty
// `generateStaticParams` under `output: 'export'`); the pages of a hidden locale carry HIDDEN_LOCALE_ATTR on
// `<html>` (`src/lib/site-locales.ts`), and this deletes the locale's home (`es.html`, `es.txt`) and folder
// (`es/`), and its product captures (`site/es/`, AMENDMENTS-SITE-NEWUSER §3.13). It fails if a marked page is still
// there afterwards, so a hidden locale never reaches the site.
//
//   node scripts/prune-hidden-locales.mjs [out]
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const HIDDEN_LOCALE_ATTR = 'data-hr-hidden-locale';

// Any value, so a marker the prune cannot read fails the build instead of slipping through. The value must
// then be a BCP 47-style tag (`es`, `pt-BR`, `zh-Hant`): it becomes a path below, so `..` never gets there.
const MARKER = new RegExp(`<html[^>]*\\s${HIDDEN_LOCALE_ATTR}="([^"]*)"`);
const LOCALE_TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** @param {string} dir @returns {string[]} */
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

/** @param {string} file @returns {string | null} */
function hiddenLocaleOf(file) {
  const locale = MARKER.exec(readFileSync(file, 'utf8'))?.[1];
  if (locale === undefined) return null;
  if (!LOCALE_TAG.test(locale)) throw new Error(`${file} is marked hidden with "${locale}", which is not a locale tag`);
  return locale;
}

/**
 * Deletes the exported pages of every hidden locale under `outDir`.
 * @param {string} outDir
 * @returns {string[]} the locales removed, sorted
 */
export function pruneHiddenLocales(outDir) {
  if (!existsSync(outDir)) throw new Error(`no export folder at ${outDir} (run next build first)`);
  const hidden = new Set();
  for (const file of htmlFiles(outDir)) {
    const locale = hiddenLocaleOf(file);
    if (locale !== null) hidden.add(locale);
  }
  for (const locale of hidden) {
    rmSync(join(outDir, `${locale}.html`), { force: true });
    rmSync(join(outDir, `${locale}.txt`), { force: true });
    rmSync(join(outDir, locale), { recursive: true, force: true });
    // [SN] The locale's product captures hold its UI text, so they leave with it.
    rmSync(join(outDir, 'site', locale), { recursive: true, force: true });
  }
  const left = htmlFiles(outDir).filter((file) => hiddenLocaleOf(file) !== null);
  if (left.length > 0) {
    throw new Error(`hidden-locale pages are still in the export: ${left.map((file) => relative(outDir, file)).join(', ')}`);
  }
  return [...hidden].sort();
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const removed = pruneHiddenLocales(process.argv[2] ?? 'out');
    process.stdout.write(
      removed.length > 0
        ? `prune-hidden-locales: removed ${removed.map((locale) => `/${locale}`).join(', ')} (not shipped)\n`
        : 'prune-hidden-locales: no hidden locale\n',
    );
  } catch (err) {
    process.stderr.write(`prune-hidden-locales: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
