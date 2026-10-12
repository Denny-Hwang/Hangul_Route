// F-APP-001 A-2 (section 3.4, section 5): grown-up paths and the learner service worker.
// The pure helpers of scripts/pwa/grown-ups.mjs are checked against the one R-1
// implementation (`isGrownUpPath`), and the real post-build runs once on a small
// stand-in export so the emitted sw.js text and the generated offline page are read
// exactly as they ship.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GROWN_UP_PREFIXES, LEARNER_ROOTS, isGrownUpPath } from '@hangul-route/content-schema';
import { availableLocales, getMessages } from '@hangul-route/i18n';
import * as designTokens from '@hangul-route/design-system/tokens';
import {
  CONSOLE_ASSET_DIR,
  GROWN_UPS_OFFLINE_FILE,
  GROWN_UPS_OFFLINE_URL,
  consoleLeaks,
  grownUpDenylist,
  grownUpGlobIgnores,
  grownUpNavigationRule,
  grownUpPathPattern,
  renderGrownUpsOffline,
} from '../pwa/grown-ups.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const postbuild = join(here, '..', 'pwa-postbuild.mjs');

/** Paths on both sides of every R-1 boundary, plus the learner roots and near misses. */
const PROBES = [
  '/',
  '/index.html',
  '/signin',
  '/signin?persona=teacher',
  '/signin.html',
  '/signin.txt',
  '/signing',
  '/start',
  '/start/',
  '/starter',
  '/teach',
  '/teach/',
  '/teach?x=1',
  '/teach.html',
  '/teach.txt',
  '/teach/home',
  '/teach/home.txt',
  '/teach/space/plan?id=sp_1',
  '/teacher',
  '/teachers',
  '/Teach',
  '/parent',
  '/parent/space?id=sp_1',
  '/parents',
  '/parentx',
  '/account',
  '/account/billing',
  '/account/billing/receipts?id=sp_1',
  '/accounts',
  '/billing',
  '/present',
  '/present/',
  '/browse',
  '/browse?x=1',
  '/journey',
  '/grown-ups-offline.html',
];

const OFFLINE_KEYS = ['title', 'line', 'back', 'retry'];

const navigate = (path) => ({ request: { mode: 'navigate' }, url: new URL(path, 'https://app.hangulroute.com') });

describe('denylist (navigateFallbackDenylist)', () => {
  const denylist = grownUpDenylist(GROWN_UP_PREFIXES);

  it('has one RegExp per grown-up prefix, in the list order', () => {
    expect(denylist).toHaveLength(GROWN_UP_PREFIXES.length);
    GROWN_UP_PREFIXES.forEach((prefix, i) => {
      expect(denylist[i]).toBeInstanceOf(RegExp);
      expect(denylist[i].test(prefix)).toBe(true);
    });
  });

  it('agrees with isGrownUpPath on both sides of every boundary (Workbox tests pathname + search)', () => {
    for (const path of PROBES) {
      expect(denylist.some((re) => re.test(path)), path).toBe(isGrownUpPath(path));
    }
  });

  it('never denies the learner roots, the app root or the offline page itself', () => {
    for (const path of [...LEARNER_ROOTS, '/', '/index.html', GROWN_UPS_OFFLINE_URL]) {
      expect(denylist.some((re) => re.test(path)), path).toBe(false);
    }
  });

  it('refuses a prefix that is not a plain lower-case path segment (it is written into sw.js)', () => {
    expect(() => grownUpDenylist(['/teach', '/te(ach'])).toThrow(/grown-up prefix/);
    expect(() => grownUpDenylist(['teach'])).toThrow(/grown-up prefix/);
    expect(() => grownUpDenylist(['/Teach'])).toThrow(/grown-up prefix/);
    expect(() => grownUpDenylist(['/teach/home'])).toThrow(/grown-up prefix/);
    expect(() => grownUpDenylist([])).toThrow(/grown-up prefix/);
  });
});

describe('NetworkOnly rule for grown-up navigations', () => {
  const rule = grownUpNavigationRule(GROWN_UP_PREFIXES);
  const pattern = grownUpPathPattern(GROWN_UP_PREFIXES);

  it('is NetworkOnly with the precached offline page as its fallback, and never caches', () => {
    expect(rule.handler).toBe('NetworkOnly');
    expect(rule.options).toEqual({ precacheFallback: { fallbackURL: GROWN_UPS_OFFLINE_URL } });
    expect(GROWN_UPS_OFFLINE_URL).toBe(`/${GROWN_UPS_OFFLINE_FILE}`);
  });

  it('carries the prefix RegExp inlined in its own source (Workbox serialises the function text)', () => {
    const source = rule.urlPattern.toString();
    expect(source).toContain(String(pattern));
    expect(source).not.toMatch(/GROWN_UP_PREFIXES|prefixes/);
    for (const prefix of GROWN_UP_PREFIXES) expect(source).toContain(prefix.slice(1));
  });

  it('matches navigations to grown-up paths only, exactly where isGrownUpPath does', () => {
    for (const path of PROBES) {
      const url = new URL(path, 'https://app.hangulroute.com');
      expect(rule.urlPattern(navigate(path)), path).toBe(isGrownUpPath(url.pathname));
    }
  });

  it('leaves non-navigation requests (RSC payloads, chunks, fetches) to the network untouched', () => {
    for (const mode of ['cors', 'no-cors', 'same-origin']) {
      const request = { mode };
      expect(rule.urlPattern({ request, url: new URL('/teach/home.txt?_rsc=1', 'https://app.hangulroute.com') })).toBe(false);
      expect(rule.urlPattern({ request, url: new URL('/parent', 'https://app.hangulroute.com') })).toBe(false);
    }
  });

  it('still works when evaluated on its own, the way the worker receives it', () => {
    // eslint-disable-next-line no-new-func
    const revived = new Function(`return (${rule.urlPattern.toString()});`)();
    expect(revived(navigate('/account/billing'))).toBe(true);
    expect(revived(navigate('/present'))).toBe(false);
    expect(revived(navigate('/teacher'))).toBe(false);
  });
});

describe('precache exclusions and the consoleLeaks guard', () => {
  it('ignores every grown-up path and the console chunk folder', () => {
    const ignores = grownUpGlobIgnores(GROWN_UP_PREFIXES);
    expect(ignores).toContain(`${CONSOLE_ASSET_DIR}/**`);
    for (const prefix of GROWN_UP_PREFIXES) {
      const bare = prefix.slice(1);
      expect(ignores).toEqual(expect.arrayContaining([bare, `${bare}.*`, `${bare}/**`]));
    }
    expect(ignores.some((glob) => /present|browse|index/.test(glob))).toBe(false);
  });

  it('flags a grown-up path or a console chunk in the precache manifest, sorted', () => {
    const urls = [
      'index.html',
      'teach/home.html',
      '/parent.html',
      '_next/static/chunks/app.js',
      'signin.txt',
      'account/billing.html',
      'start/index.html',
      'teacher.html',
      'parents.html',
      'present.html',
      'browse/index.html',
      'grown-ups-offline.html',
      'assets/_next/x.js',
      '_expo/static/js/web/index.js',
    ];
    expect(consoleLeaks(urls, isGrownUpPath)).toEqual([
      '/parent.html',
      '_next/static/chunks/app.js',
      'account/billing.html',
      'signin.txt',
      'start/index.html',
      'teach/home.html',
    ]);
    expect(consoleLeaks(['index.html', 'sw.js', 'manifest.webmanifest'], isGrownUpPath)).toEqual([]);
  });
});

describe('renderGrownUpsOffline', () => {
  const en = { title: "You're offline", line: 'Grown-up pages need the internet. Learning still works offline.', back: 'Back to learning', retry: 'Try again' };
  const xx = { title: 'Sin conexión <ahora>', line: 'Las páginas para adultos necesitan internet.', back: 'Volver a aprender', retry: 'Intentar de nuevo' };
  const html = renderGrownUpsOffline({
    locales: [
      { locale: 'en', lang: 'en', strings: en },
      { locale: 'es', lang: 'es', strings: xx },
    ],
    tokens: designTokens,
  });

  it('draws the default locale in the HTML itself, so it reads without script', () => {
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>You&#39;re offline</title>');
    expect(html).toMatch(/<h1[^>]*>You&#39;re offline<\/h1>/);
    expect(html).toContain('Grown-up pages need the internet. Learning still works offline.');
  });

  it('holds every locale it was given for the browser-language pick, escaped for a script block', () => {
    for (const value of Object.values(xx)) expect(html).toContain(JSON.stringify(value).slice(1, -1).replace(/</g, '\\u003c').replace(/>/g, '\\u003e'));
    expect(html).not.toContain('<ahora>');
    expect(html).toContain('navigator.languages');
  });

  it('links Back to learning to the learner app and Try again to the same address', () => {
    expect(html).toMatch(/<a class="primary" href="\/" data-k="back">Back to learning<\/a>/);
    expect(html).toMatch(/<a class="secondary" href="" data-k="retry">Try again<\/a>/);
    expect(html.indexOf('data-k="back"')).toBeLessThan(html.indexOf('data-k="retry"'));
  });

  it('is self-contained: no external URL, no linked file, one inline script', () => {
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/(src|href)="\/\//);
    expect(html).not.toMatch(/<link\b|<img\b|\bsrc=|@import|url\(/i);
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it('takes every colour from the design tokens', () => {
    const palette = new Set(
      Object.values(designTokens.colors)
        .flatMap((group) => Object.values(group))
        .map((c) => String(c).toUpperCase()),
    );
    const used = html.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
    expect(used.length).toBeGreaterThan(0);
    for (const colour of used) expect(palette.has(colour.toUpperCase()), colour).toBe(true);
    expect(html).toContain(designTokens.colors.surface.canvas);
    expect(html).toContain(designTokens.colors.brand.primary);
    expect(html).not.toMatch(/rgba?\(/);
  });

  it('meets the touch target floor on both links', () => {
    expect(html).toContain(`min-height: ${designTokens.touchTarget.min}px`);
  });

  it('refuses a locale with a missing string, so a page never ships with a blank button', () => {
    expect(() =>
      renderGrownUpsOffline({ locales: [{ locale: 'en', lang: 'en', strings: { ...en, retry: '' } }], tokens: designTokens }),
    ).toThrow(/retry/);
    expect(() => renderGrownUpsOffline({ locales: [], tokens: designTokens })).toThrow(/locale/);
  });
});

describe('public/_headers', () => {
  const headers = readFileSync(join(here, '..', '..', 'public', '_headers'), 'utf8');

  it('marks the console chunks immutable, as apps/web does', () => {
    expect(headers).toMatch(/^\/_next\/static\/\*\n  Cache-Control: public, max-age=31536000, immutable$/m);
  });

  it('keeps the learner rules (the worker and the shell are never served stale)', () => {
    expect(headers).toMatch(/^\/sw\.js\n  Cache-Control: no-cache$/m);
    expect(headers).toMatch(/^\/index\.html\n  Cache-Control: no-cache$/m);
  });
});

describe('pwa-postbuild.mjs on a stand-in export', () => {
  let dist;
  let run;
  let sw;

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'hr-pwa-shell-'));
    const files = {
      'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
      '_expo/static/js/web/index-abc.js': 'console.info("learner bundle");',
      'teacher.html': '<!doctype html><title>near miss</title>',
      'present.html': '<!doctype html><title>learner root</title>',
      // What A-3 will copy in from the console build: none of it may reach the precache.
      'teach/home.html': '<!doctype html><title>console</title>',
      'teach.html': '<!doctype html><title>console</title>',
      'parent.html': '<!doctype html><title>console</title>',
      'signin.html': '<!doctype html><title>console</title>',
      'start.html': '<!doctype html><title>console</title>',
      'account/billing.html': '<!doctype html><title>console</title>',
      '_next/static/chunks/main-123.js': 'self.console=1;',
    };
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dist, path)), { recursive: true });
      writeFileSync(join(dist, path), body);
    }
    run = spawnSync(process.execPath, [postbuild, dist], { encoding: 'utf8' });
    sw = existsSync(join(dist, 'sw.js')) ? readFileSync(join(dist, 'sw.js'), 'utf8') : '';
  }, 120_000);

  afterAll(() => {
    if (dist) rmSync(dist, { recursive: true, force: true });
  });

  it('succeeds', () => {
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/pwa-postbuild: precached \d+ files/);
  });

  it('writes the denylist into sw.js, one literal per prefix, and never the learner roots', () => {
    for (const re of grownUpDenylist(GROWN_UP_PREFIXES)) expect(sw).toContain(String(re));
    expect(sw).not.toMatch(/\\\/present|\\\/browse/);
  });

  it('writes the NetworkOnly rule with the prefix source inlined and the offline fallback', () => {
    expect(sw).toContain(String(grownUpPathPattern(GROWN_UP_PREFIXES)));
    expect(sw).toContain('"navigate"');
    expect(sw).toContain(GROWN_UPS_OFFLINE_URL);
  });

  it('precaches the offline page and the learner files, and no console file', () => {
    expect(sw).toContain(`"${GROWN_UPS_OFFLINE_FILE}"`);
    expect(sw).toContain('"index.html"');
    expect(sw).toContain('"teacher.html"');
    expect(sw).toContain('"present.html"');
    expect(sw).toContain('_expo/static/js/web/index-abc.js');
    for (const path of ['teach/home.html', 'teach.html', 'parent.html', 'signin.html', 'start.html', 'account/billing.html', '_next/static/chunks/main-123.js']) {
      expect(sw, path).not.toContain(`"${path}"`);
    }
  });

  it('generates the offline page with the strings of every shipped locale', () => {
    const page = readFileSync(join(dist, GROWN_UPS_OFFLINE_FILE), 'utf8');
    const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    for (const locale of availableLocales(false)) {
      const strings = getMessages(locale).console.offline;
      for (const key of OFFLINE_KEYS) {
        expect(typeof strings[key], `${locale}.${key}`).toBe('string');
        expect(page, `${locale}.${key}`).toContain(locale === 'en' ? escape(strings[key]) : JSON.stringify(strings[key]).slice(1, -1));
      }
    }
    expect(page).not.toMatch(/https?:\/\//);
  });

  it('still injects the manifest, the shell styles and the worker registration into index.html', () => {
    const index = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(index).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    expect(index).toContain(`background: ${designTokens.colors.surface.canvas}`);
    expect(index).toContain(`<meta name="theme-color" content="${designTokens.colors.brand.primary}">`);
    expect(index).toContain("register('/sw.js')");
  });
});
