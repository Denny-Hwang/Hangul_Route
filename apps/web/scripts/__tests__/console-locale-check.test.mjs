// FN-6 (AMENDMENTS-FINISH-2026-11, finding F5): the console bundle check. No grown-up page loads Spanish or Korean
// messages at start; each language is a chunk of its own, loaded when shown (src/lib/i18n/message-overlays.ts).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isGrownUpPath } from '@hangul-route/content-schema';
import { en } from '@hangul-route/i18n';
import { es } from '@hangul-route/i18n/messages-es';
import { ko } from '@hangul-route/i18n/messages-ko';
import { MIN_PROBE_LENGTH, PROBES_PER_LOCALE, checkConsoleLocales, contentTexts, localeProbes, startChunks, stringLeaves, verdict } from '../console-locale-check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '..', 'console-locale-check.mjs');
const WEB = join(here, '..', '..');

describe('probes', () => {
  it('stringLeaves walks a message tree in path order and skips functions', () => {
    expect(stringLeaves({ b: { y: 'two', x: 'one' }, a: 'zero', f: () => 'fn', n: null })).toEqual([
      ['a', 'zero'],
      ['b.x', 'one'],
      ['b.y', 'two'],
    ]);
  });

  it('each language gives a full set of whole phrases only it has, none a minifier would escape', () => {
    const english = new Set(stringLeaves(en).map(([, t]) => t));
    for (const overlay of [es, ko]) {
      const probes = localeProbes(overlay, en);
      expect(probes).toHaveLength(PROBES_PER_LOCALE);
      expect(new Set(probes).size).toBe(PROBES_PER_LOCALE);
      for (const p of probes) {
        expect(p.length).toBeGreaterThanOrEqual(MIN_PROBE_LENGTH);
        expect(english.has(p)).toBe(false);
        expect(p).not.toMatch(/["'`\\\n]|\$\{/);
      }
    }
    // Spread over the whole dictionary, not one namespace.
    const leaves = new Map(stringLeaves(es).map(([path, text]) => [text, path.split('.')[0]]));
    expect(new Set(localeProbes(es, en).map((p) => leaves.get(p))).size).toBeGreaterThan(3);
  });

  it('a small overlay gives what it has', () => {
    expect(localeProbes({ a: 'Una frase bastante larga', b: 'corta', c: 'Same as English text', d: 'Con "comillas" dentro' }, { c: 'Same as English text' })).toEqual([
      'Una frase bastante larga',
    ]);
  });

  it('contentTexts gathers every string of the content trees once', () => {
    expect(contentTexts({ a: 'one', b: { c: 'two' } }, [{ d: 'one', e: 3 }, 'three'], null)).toEqual(['one', 'two', 'three']);
    expect(contentTexts()).toEqual([]);
  });

  describe('a string the content data also holds is no probe', () => {
    const overlay = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${String(i).padStart(2, '0')}`, `Una frase de la consola numero ${i}`]));
    const inContent = { gloss: 'hangul (Una frase de la consola numero 3)' };

    it('skips a probe inside a content string and picks the next candidate: the count holds', () => {
      const plain = localeProbes(overlay, {}, 5);
      expect(plain).toContain('Una frase de la consola numero 2');
      expect(plain).toContain('Una frase de la consola numero 4');
      const probes = localeProbes(overlay, {}, 5, contentTexts(inContent));
      expect(probes).toHaveLength(5);
      expect(probes).not.toContain('Una frase de la consola numero 3');
      expect(new Set(probes).size).toBe(5);
      for (const p of probes) expect(contentTexts(inContent).some((t) => t.includes(p))).toBe(false);
    });

    it('a probe that is the whole content string is skipped too, and a content string that holds none changes nothing', () => {
      expect(localeProbes(overlay, {}, 20, ['Una frase de la consola numero 7'])).not.toContain('Una frase de la consola numero 7');
      expect(localeProbes(overlay, {}, 5, ['nothing alike'])).toEqual(localeProbes(overlay, {}, 5));
      expect(localeProbes(overlay, {}, 5, [])).toEqual(localeProbes(overlay, {}, 5));
    });

    it('is deterministic, whatever the order of the content', () => {
      const content = ['x', 'hangul (Una frase de la consola numero 3)', 'Una frase de la consola numero 8 ya'];
      expect(localeProbes(overlay, {}, 5, content)).toEqual(localeProbes(overlay, {}, 5, content));
      expect(localeProbes(overlay, {}, 5, content)).toEqual(localeProbes(overlay, {}, 5, [...content].reverse()));
    });

    it('a small overlay gives what is left once the content ones are out', () => {
      expect(localeProbes(overlay, {}, 20, contentTexts(inContent))).toHaveLength(9);
    });

    it('real dictionaries: every language still gives a full set when the content holds a probe of the first pick', () => {
      for (const overlayOfLocale of [es, ko]) {
        const first = localeProbes(overlayOfLocale, en);
        const probes = localeProbes(overlayOfLocale, en, PROBES_PER_LOCALE, [`gloss (${first[0]}) and ${first[10]}`]);
        expect(probes).toHaveLength(PROBES_PER_LOCALE);
        expect(probes).not.toContain(first[0]);
        expect(probes).not.toContain(first[10]);
      }
    });
  });

  it('startChunks reads the chunk scripts of a page, once each', () => {
    const html = '<script src="/_next/static/chunks/a.js" async=""></script><script src="/_next/static/chunks/app/x/page-1.js"></script><script src="/_next/static/chunks/a.js"></script><link href="/_next/static/css/s.css">';
    expect(startChunks(html)).toEqual(['_next/static/chunks/a.js', '_next/static/chunks/app/x/page-1.js']);
  });
});

/** A stand-in export: two grown-up pages, a site page, and the chunks they load. */
let out = '';
function write(rel, body) {
  const file = join(out, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}
const page = (...chunks) => chunks.map((c) => `<script src="/_next/static/chunks/${c}"></script>`).join('');
const PROBES = { es: ['Hola desde la consola'], ko: ['콘솔에서 안녕하세요 여러분'] };

beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), 'console-locale-check-'));
  write('teach.html', page('shared.js', 'teach.js'));
  write('account/billing.html', page('shared.js', 'billing.js'));
  write('index.html', page('site.js'));
  write('_next/static/chunks/shared.js', 'const en="Hello from the console";');
  write('_next/static/chunks/teach.js', 'teach');
  write('_next/static/chunks/billing.js', 'billing');
  write('_next/static/chunks/site.js', `"${PROBES.es[0]}"`);
  write('_next/static/chunks/5586.es.js', `"${PROBES.es[0]}"`);
  write('_next/static/chunks/2099.ko.js', `"${PROBES.ko[0]}"`);
});
afterEach(() => {
  rmSync(out, { recursive: true, force: true });
});

describe('checkConsoleLocales', () => {
  it('passes when every language lives in its own chunk; a site page is not a grown-up page', () => {
    const report = checkConsoleLocales(out, isGrownUpPath, PROBES);
    expect(report.pages).toBe(2);
    expect(report.leaks).toEqual([]);
    expect(report.shared).toEqual({ file: '_next/static/chunks/shared.js', bytes: 34 });
    expect(report.homes).toEqual({ es: ['_next/static/chunks/5586.es.js', '_next/static/chunks/site.js'], ko: ['_next/static/chunks/2099.ko.js'] });
    expect(verdict(report)).toBeNull();
  });

  it('fails when a start chunk of a grown-up page holds a language (the shared chunk before FN-6)', () => {
    write('_next/static/chunks/shared.js', `"Hello";"${PROBES.es[0]}";"${PROBES.ko[0]}"`);
    const report = checkConsoleLocales(out, isGrownUpPath, PROBES);
    expect(report.leaks.map((l) => [l.locale, l.file, l.pages.length])).toEqual([
      ['es', '_next/static/chunks/shared.js', 2],
      ['ko', '_next/static/chunks/shared.js', 2],
    ]);
    expect(verdict(report)).toMatch(/^grown-up pages load es and ko messages at start:\n {2}_next\/static\/chunks\/shared\.js \(es, loaded at start by 2 grown-up pages/);
  });

  it('a chunk only one grown-up page loads counts too', () => {
    write('_next/static/chunks/billing.js', `"${PROBES.ko[0]}"`);
    expect(checkConsoleLocales(out, isGrownUpPath, PROBES).leaks.map((l) => [l.locale, l.file])).toEqual([['ko', '_next/static/chunks/billing.js']]);
  });

  it('fails when no chunk holds a language: the check would otherwise pass on probes that match nothing', () => {
    rmSync(join(out, '_next/static/chunks/2099.ko.js'));
    const report = checkConsoleLocales(out, isGrownUpPath, PROBES);
    expect(report.missing).toEqual(['ko']);
    expect(verdict(report)).toMatch(/no chunk of the export holds the ko messages/);
  });

  it('a script the page names but the export lacks reads as empty', () => {
    write('teach.html', page('shared.js', 'gone.js'));
    expect(checkConsoleLocales(out, isGrownUpPath, PROBES).leaks).toEqual([]);
  });

  it('throws on a missing export or one without grown-up pages', () => {
    expect(() => checkConsoleLocales(join(out, 'nope'), isGrownUpPath, PROBES)).toThrow(/no export folder/);
    rmSync(join(out, 'teach.html'));
    rmSync(join(out, 'account'), { recursive: true });
    expect(() => checkConsoleLocales(out, isGrownUpPath, PROBES)).toThrow(/no grown-up page/);
  });
});

describe('CLI', () => {
  const run = (dir) => spawnSync(process.execPath, [SCRIPT, dir], { cwd: WEB, encoding: 'utf8' });

  it('fails a stand-in export whose shared chunk holds real Spanish messages', () => {
    const probe = localeProbes(es, en)[0];
    write('_next/static/chunks/shared.js', `"${probe}"`);
    const result = run(out);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/^console-locale-check: grown-up pages load es messages at start/);
  });

  it('fails without an export', () => {
    const result = run(join(out, 'nope'));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/^console-locale-check: no export folder/);
  });

  // The real export, when this checkout has one (`pnpm --filter @hangul-route/web build`); the build runs the
  // same CLI on it, so CI checks every built export.
  it.skipIf(!existsSync(join(WEB, 'out', 'teach.html')))('passes the real export: es and ko each in a chunk no grown-up page loads at start', () => {
    const result = run('out');
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/no es \/ ko messages at start; shared chunk .+; es in .+; ko in .+/);
  });
});

describe('next.config.js', () => {
  const nextConfig = createRequire(import.meta.url)(join(WEB, 'next.config.js'));
  class Replacement {
    constructor(test, swap) {
      this.test = test;
      this.swap = swap;
    }
  }
  const configure = (isServer) => nextConfig.webpack({ resolve: { alias: {} }, plugins: [] }, { isServer, webpack: { NormalModuleReplacementPlugin: Replacement } });
  const i18nSrc = join(WEB, '..', '..', 'packages', 'i18n', 'src');

  it('the browser build reads the i18n package\'s web twin of bundled-messages, only there', () => {
    const [plugin] = configure(false).plugins;
    expect(plugin).toBeInstanceOf(Replacement);
    expect(plugin.test.test('./bundled-messages')).toBe(true);
    expect(plugin.test.test('./bundled-messages.web')).toBe(false);
    const inI18n = { request: './bundled-messages', context: i18nSrc };
    plugin.swap(inI18n);
    expect(inI18n.request).toBe('./bundled-messages.web');
    const elsewhere = { request: './bundled-messages', context: join(WEB, 'src') };
    plugin.swap(elsewhere);
    expect(elsewhere.request).toBe('./bundled-messages');
    const nowhere = { request: './bundled-messages', context: join(WEB, 'no-such-folder') };
    plugin.swap(nowhere);
    expect(nowhere.request).toBe('./bundled-messages');
    const noContext = { request: './bundled-messages' };
    plugin.swap(noContext);
    expect(noContext.request).toBe('./bundled-messages');
  });

  it('the server build (the static HTML) keeps every language', () => {
    expect(configure(true).plugins).toEqual([]);
  });
});
