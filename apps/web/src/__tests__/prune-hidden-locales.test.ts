import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HIDDEN_LOCALE_ATTR } from '../lib/site-locales';
import { pruneHiddenLocales } from '../../scripts/prune-hidden-locales.mjs';

/**
 * F-I18N-001 PR 11b: `/es` and `/ko` are rendered on every build, and a locale that has not shipped is taken
 * out of `out/` before deploy. Its pages carry `HIDDEN_LOCALE_ATTR` on `<html>`; the postbuild step deletes
 * the locale's home (`es.html`, `es.txt`) and folder (`es/`), then fails if a marked page is still there.
 */
const prune = pruneHiddenLocales;
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'prune-hidden-locales.mjs');

let out: string;

const page = (lang: string, hidden: boolean): string =>
  `<!DOCTYPE html><html lang="${lang}"${hidden ? ` ${HIDDEN_LOCALE_ATTR}="${lang}"` : ''}><head></head><body>x</body></html>`;

function put(rel: string, body: string): void {
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  writeFileSync(join(out, rel), body);
}

function files(dir: string = out, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? files(join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]))
    .sort();
}

beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), 'hr-prune-'));
  put('index.html', page('en', false));
  put('index.txt', 'rsc');
  put('about.html', page('en', false));
  put('404.html', page('en', false));
  put('teach/space.html', page('en', false));
  put('_next/static/chunks/app/(loc)/[locale]/page.js', 'chunk');
  put('site/en/og.png', 'png');
});

afterEach(() => rmSync(out, { recursive: true, force: true }));

describe('pruneHiddenLocales', () => {
  it('removes a hidden locale: its home, its payload and its folder', () => {
    for (const locale of ['es', 'ko']) {
      put(`${locale}.html`, page(locale, true));
      put(`${locale}.txt`, 'rsc');
      for (const sub of ['about', 'privacy', 'terms']) {
        put(`${locale}/${sub}.html`, page(locale, true));
        put(`${locale}/${sub}.txt`, 'rsc');
      }
      // Its share image (AMENDMENTS-SITE-NEWUSER §3.14) leaves with its pages.
      put(`site/${locale}/og.png`, 'png');
    }
    expect(prune(out)).toEqual(['es', 'ko']);
    expect(files()).toEqual([
      '404.html',
      '_next/static/chunks/app/(loc)/[locale]/page.js',
      'about.html',
      'index.html',
      'index.txt',
      'site/en/og.png',
      'teach/space.html',
    ]);
  });

  it('keeps a shipped locale (or every locale on a QA build)', () => {
    put('es.html', page('es', false));
    put('es/about.html', page('es', false));
    put('ko.html', page('ko', true));
    put('ko/about.html', page('ko', true));
    put('site/es/og.png', 'png');
    put('site/ko/og.png', 'png');
    expect(prune(out)).toEqual(['ko']);
    expect(existsSync(join(out, 'site', 'es', 'og.png'))).toBe(true);
    expect(existsSync(join(out, 'site', 'ko'))).toBe(false);
    expect(existsSync(join(out, 'es.html'))).toBe(true);
    expect(existsSync(join(out, 'es', 'about.html'))).toBe(true);
    expect(existsSync(join(out, 'ko.html'))).toBe(false);
    expect(existsSync(join(out, 'ko'))).toBe(false);
  });

  it('removes nothing when nothing is hidden', () => {
    const before = files();
    expect(prune(out)).toEqual([]);
    expect(files()).toEqual(before);
  });

  it('fails when a marked page sits where the prune does not reach', () => {
    put('elsewhere/es-copy.html', page('es', true));
    expect(() => prune(out)).toThrow(/elsewhere\/es-copy\.html/);
  });

  it('removes a hidden locale with a region or script tag (pt-BR, zh-Hant)', () => {
    for (const locale of ['pt-BR', 'zh-Hant']) {
      put(`${locale}.html`, page(locale, true));
      put(`${locale}.txt`, 'rsc');
      put(`${locale}/about.html`, page(locale, true));
    }
    expect(prune(out)).toEqual(['pt-BR', 'zh-Hant']);
    expect(files()).toEqual(['404.html', '_next/static/chunks/app/(loc)/[locale]/page.js', 'about.html', 'index.html', 'index.txt', 'site/en/og.png', 'teach/space.html']);
  });

  it.each(['..', '../x', 'es/../..', 'ES', 'e', ''])('fails closed on a marker that is not a locale tag: "%s"', (bad) => {
    put('odd.html', `<!DOCTYPE html><html lang="en" ${HIDDEN_LOCALE_ATTR}="${bad}"><body>x</body></html>`);
    expect(() => prune(out)).toThrow(/not a locale tag/);
    expect(files()).toContain('index.html');
  });

  it('fails when the export folder is missing', () => {
    expect(() => prune(join(out, 'nope'))).toThrow(/no export folder/);
  });
});

describe('prune-hidden-locales.mjs (CLI, run by `pnpm build`)', () => {
  it('prunes the folder it is given and says what it removed', () => {
    put('es.html', page('es', true));
    put('es/about.html', page('es', true));
    const stdout = execFileSync(process.execPath, [SCRIPT, out], { encoding: 'utf8' });
    expect(stdout).toBe('prune-hidden-locales: removed /es (not shipped)\n');
    expect(existsSync(join(out, 'es.html'))).toBe(false);
  });

  it('says so when nothing is hidden', () => {
    expect(execFileSync(process.execPath, [SCRIPT, out], { encoding: 'utf8' })).toBe('prune-hidden-locales: no hidden locale\n');
  });

  it('exits non-zero on a failure', () => {
    expect(() => execFileSync(process.execPath, [SCRIPT, join(out, 'nope')], { stdio: 'pipe' })).toThrow();
  });
});
