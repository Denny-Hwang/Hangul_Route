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
import { PRECACHE_BUDGET, precacheBudgetProblems, precacheReport, withWholeClipPack } from '../pwa/lesson-chunks.mjs';
import { headersFor, parseHeaders } from '../app-host/headers.mjs';
import { LESSON_MANIFEST, REVIEW_ITEM_MANIFEST, STORY_MANIFEST, lessonBundles } from './helpers/lesson-bundles.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GROWN_UP_PREFIXES, LEARNER_ROOTS, isGrownUpPath } from '@hangul-route/content-schema';
import { availableLocales, getMessages } from '@hangul-route/i18n';
import * as designTokens from '@hangul-route/design-system/tokens';
import {
  CONSOLE_ASSET_DIR,
  GROWN_UPS_OFFLINE_FILE,
  GROWN_UPS_OFFLINE_URL,
  assertLearnerPrecache,
  consoleLeaks,
  consolePages,
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

  // A Next export always writes a root 404.html that loads console code; its path is no
  // grown-up path, so only its content gives it away.
  const NEXT_404 = '<!DOCTYPE html><html><head><link rel="stylesheet" href="/_next/static/css/app.css"></head><body><script src="/_next/static/chunks/main-123.js" async=""></script></body></html>';
  const NEXT_FLIGHT = '<!DOCTYPE html><html><body><script>(self.__next_f=self.__next_f||[]).push([0])</script></body></html>';
  const LEARNER_INDEX = '<!DOCTYPE html><html><head><title>Hangul Route</title></head><body><div id="root"></div><script src="/_expo/static/js/web/index-abc.js" defer></script></body></html>';
  const files = {
    'index.html': LEARNER_INDEX,
    'grown-ups-offline.html': renderGrownUpsOffline({
      locales: [{ locale: 'en', lang: 'en', strings: { title: 'a', line: 'b', back: 'c', retry: 'd' } }],
      tokens: designTokens,
    }),
    'present.html': LEARNER_INDEX,
    '404.html': NEXT_404,
    '_not-found.html': NEXT_FLIGHT,
    'notes/next.html': '<p>Built with Next: chunks live under /_next/ in the console build.</p>',
    'sw.js': 'self.__next_f = 1; importScripts("/_next/static/x.js");',
  };
  const read = (url) => {
    if (!(url in files)) throw new Error(`unexpected read of ${url}`);
    return files[url];
  };

  it('flags a precached HTML page that loads console code, whatever its path, and reads HTML only', () => {
    expect(consolePages(Object.keys(files), read)).toEqual(['404.html', '_not-found.html']);
    expect(consolePages(['index.html', 'present.html', 'grown-ups-offline.html', 'sw.js'], read)).toEqual([]);
  });

  it('passes a learner precache with the offline page in it', () => {
    expect(() => assertLearnerPrecache(['index.html', GROWN_UPS_OFFLINE_FILE, 'present.html', 'sw.js'], isGrownUpPath, read)).not.toThrow();
  });

  it('fails the build on a console file by path, listing every one', () => {
    expect(() =>
      assertLearnerPrecache(['index.html', GROWN_UPS_OFFLINE_FILE, 'teach/home.html', '_next/static/chunks/app.js'], isGrownUpPath, read),
    ).toThrow('pwa-postbuild: console files found in the learner precache: _next/static/chunks/app.js, teach/home.html');
  });

  it('fails the build on a console page by content (a Next 404.html)', () => {
    expect(() => assertLearnerPrecache(['index.html', GROWN_UPS_OFFLINE_FILE, '404.html'], isGrownUpPath, read)).toThrow(
      'pwa-postbuild: console files found in the learner precache: 404.html',
    );
  });

  it('fails the build when the offline page is not precached', () => {
    expect(() => assertLearnerPrecache(['index.html', 'present.html'], isGrownUpPath, read)).toThrow(
      `pwa-postbuild: ${GROWN_UPS_OFFLINE_FILE} is missing from the precache`,
    );
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
    expect(() => renderGrownUpsOffline({ locales: [{ locale: 'en', lang: '', strings: en }], tokens: designTokens })).toThrow(
      /locale "en" has no lang/,
    );
  });
});

describe('the offline page picks its locale from navigator.languages (section 3.16: lang follows the pick)', () => {
  const en = { title: "You're offline", line: 'Grown-up pages need the internet. Learning still works offline.', back: 'Back to learning', retry: 'Try again' };
  const ko = { title: '오프라인이에요', line: '어른 페이지는 인터넷이 필요해요. 학습은 오프라인에서도 돼요.', back: '학습으로 돌아가기', retry: '다시 시도' };
  const html = renderGrownUpsOffline({
    locales: [
      { locale: 'en', lang: 'en', strings: en },
      { locale: 'ko', lang: 'ko', strings: ko },
    ],
    tokens: designTokens,
  });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
  const keys = [...html.matchAll(/data-k="([a-z]+)"/g)].map((m) => m[1]);

  /** Runs the page's own inline script against a stand-in document drawn in English, as the HTML is. */
  function pick(languages, language) {
    const nodes = keys.map((key) => ({ textContent: en[key], getAttribute: (name) => (name === 'data-k' ? key : null) }));
    const doc = { documentElement: { lang: 'en' }, title: en.title, querySelectorAll: (selector) => (selector === '[data-k]' ? nodes : []) };
    // eslint-disable-next-line no-new-func
    new Function('document', 'navigator', script)(doc, { languages, language });
    return { lang: doc.documentElement.lang, title: doc.title, text: Object.fromEntries(nodes.map((n, i) => [keys[i], n.textContent])) };
  }

  it('draws every string of the page under a data-k the script can swap', () => {
    expect(script).not.toBe('');
    expect([...keys].sort()).toEqual([...OFFLINE_KEYS].sort());
  });

  it('takes the first listed language it ships, with its region dropped', () => {
    expect(pick(['ko-KR', 'en'])).toEqual({ lang: 'ko', title: ko.title, text: ko });
    expect(pick(['fr', 'ko'])).toEqual({ lang: 'ko', title: ko.title, text: ko });
  });

  it('matches upper-case and regional tags', () => {
    expect(pick(['EN-us', 'ko'])).toEqual({ lang: 'en', title: en.title, text: en });
    expect(pick(['KO'])).toEqual({ lang: 'ko', title: ko.title, text: ko });
  });

  it('keeps English when no listed language ships, or the list is empty', () => {
    expect(pick(['fr'])).toEqual({ lang: 'en', title: en.title, text: en });
    expect(pick([])).toEqual({ lang: 'en', title: en.title, text: en });
    expect(pick(undefined, undefined)).toEqual({ lang: 'en', title: en.title, text: en });
  });

  it('falls back to navigator.language when navigator.languages is empty', () => {
    expect(pick([], 'ko-KR')).toEqual({ lang: 'ko', title: ko.title, text: ko });
  });
});

describe('public/_headers', () => {
  const headers = readFileSync(join(here, '..', '..', 'public', '_headers'), 'utf8');

  it('gives the console chunks no year-long rule: the single-page fallback answers a missing chunk with index.html (A-3, section 3.3)', () => {
    expect(headers).not.toMatch(/^\/_next\//m);
    expect(headers).not.toMatch(/^\/\*$/m);
  });

  it('keeps the learner rules (the worker and the shell are never served stale)', () => {
    expect(headers).toMatch(/^\/sw\.js\n  Cache-Control: no-cache$/m);
    expect(headers).toMatch(/^\/index\.html\n  Cache-Control: no-cache$/m);
  });

  it('serves every clip group, the say clips included, as immutable for a year, by one rule (AMENDMENTS-AUDIO-CLIPS AC-B6)', () => {
    const rules = parseHeaders(headers);
    const year = 'public, max-age=31536000, immutable';
    for (const path of [
      '/assets/assets/audio/say/1098bbe54520ab2a.0d663d9a0166e1ebe46c80873605ae07.mp3',
      '/assets/assets/audio/jamo/ae.0d663d9a0166e1ebe46c80873605ae07.mp3',
      '/assets/assets/audio/jamo/giyeok.0d663d9a0166e1ebe46c80873605ae07.mp3',
      '/assets/assets/audio/vocab/gangaji.0d663d9a0166e1ebe46c80873605ae07.mp3',
    ]) {
      // Exactly the one value: a second matching rule would join its Cache-Control to it.
      expect(headersFor(rules, path)['cache-control'], path).toBe(year);
    }
  });
});

/** A stand-in clip file of `bytes` bytes (the post-build reads names and sizes, never the audio). */
const clip = (bytes) => 'ID3'.padEnd(bytes, '.');
const HASH = '0d663d9a0166e1ebe46c80873605ae07';

describe('pwa-postbuild.mjs precaches only the jamo-s1 pack (AMENDMENTS-AUDIO-CLIPS AC-B6, G5, row AC-6)', () => {
  let dist;
  let run;
  let sw;
  const files = {
    'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
    'fonts/hr-presenter-kr.woff2': 'wOF2 stand-in',
    ...lessonBundles(),
    // jamo-s1: precached.
    [`assets/assets/audio/jamo/giyeok.${HASH}.mp3`]: clip(9_000),
    [`assets/assets/audio/jamo/giyeok-name.${HASH}.mp3`]: clip(11_000),
    [`assets/e2e/fixtures/audio/jamo/a.${HASH}.mp3`]: clip(7_000),
    // jamo-wb (under audio/jamo/ too), a say clip, a vocabulary clip: runtime-cached.
    [`assets/assets/audio/jamo/ae.${HASH}.mp3`]: clip(8_000),
    [`assets/assets/audio/jamo/ssanggiyeok-name.${HASH}.mp3`]: clip(8_000),
    [`assets/assets/audio/say/1098bbe54520ab2a.${HASH}.mp3`]: clip(6_000),
    [`assets/assets/audio/vocab/gangaji.${HASH}.mp3`]: clip(6_000),
  };

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'hr-pwa-packs-'));
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dist, path)), { recursive: true });
      writeFileSync(join(dist, path), body);
    }
    const { WORKERS_CI: _w, CF_PAGES: _p, ...env } = process.env;
    run = spawnSync(process.execPath, [postbuild, dist, '--budget'], { encoding: 'utf8', env });
    sw = existsSync(join(dist, 'sw.js')) ? readFileSync(join(dist, 'sw.js'), 'utf8') : '';
  }, 120_000);

  afterAll(() => {
    if (dist) rmSync(dist, { recursive: true, force: true });
  });

  it('succeeds with --budget: no gap, no leak, the precached clips under their line', () => {
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('7 audio clips built');
  });

  it('precaches the jamo-s1 clips and no jamo-wb, say or vocabulary clip', () => {
    for (const ref of ['assets/assets/audio/jamo/giyeok.', 'assets/assets/audio/jamo/giyeok-name.', 'assets/e2e/fixtures/audio/jamo/a.']) {
      expect(sw, ref).toContain(`"${ref}${HASH}.mp3"`);
    }
    for (const ref of ['audio/jamo/ae.', 'audio/jamo/ssanggiyeok-name.', 'audio/say/1098bbe54520ab2a.', 'audio/vocab/gangaji.']) {
      expect(sw, ref).not.toContain(`${ref}${HASH}.mp3`);
    }
  });

  it('writes the say cache (hr-audio-say-v1, 1,600 entries) and keeps hr-audio-v1 at 400, both cache-first, audio only', () => {
    expect(sw).toContain('"hr-audio-say-v1"');
    expect(sw).toMatch(/cacheName:\s*"hr-audio-say-v1"[\s\S]{0,400}maxEntries:\s*1600/);
    expect(sw).toMatch(/cacheName:\s*"hr-audio-v1"[\s\S]{0,400}maxEntries:\s*400/);
    expect(sw.match(/"audio\/mpeg"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(sw).toContain('CacheFirst');
  });

  it('reports the precached clips (the G5 growth) against their own line, and the learner precache against its line', () => {
    expect(run.stdout).toContain(`  precached clips  3 files  27000 B  (ceiling ${PRECACHE_BUDGET.precachedClipsRaw} B, jamo-s1 only)`);
    expect(run.stdout).toMatch(/ {2}learner precache {2}\d+ files {2}\d+ B {2}\(ceiling 11287329 B\)/);
    // The built precache plus the jamo-s1 bytes not held yet, which --budget holds under the same line.
    expect(run.stdout).toMatch(/ {2}learner precache with the whole jamo-s1 pack {2}\d+ B {2}\(ceiling 11287329 B\)/);
  });
});

/** A precache report with a small start bundle and nothing else, for the budget's own arithmetic. */
const emptyReport = () => precacheReport({ manifest: [], bundles: [{ url: '_expo/static/js/web/index-0123456789abcdef0123456789abcdef.js', text: 'x' }], precache: { count: 1, size: 1 } });

describe('the offline budget does not move for audio (AMENDMENTS-AUDIO-CLIPS G5, row AC-6)', () => {
  it('keeps learnerPrecacheRaw at 11,287,329 B: CM-5B is never triggered by audio', () => {
    expect(PRECACHE_BUDGET.learnerPrecacheRaw).toBe(11_287_329);
  });

  it('the precached clips have a line of their own, the jamo-s1 set limit (43 clips, at most 520,000 B)', () => {
    expect(PRECACHE_BUDGET.precachedClipsRaw).toBe(520_000);
  });

  it('the budget holds the measured precache plus the jamo-s1 bytes the build does not hold yet under the line', () => {
    const line = PRECACHE_BUDGET.learnerPrecacheRaw;
    const report = (raw, clipBytes) => ({ ...emptyReport(), precache: { count: 1, raw }, clips: { count: clipBytes > 0 ? 1 : 0, bytes: clipBytes } });
    // No recorded clip yet: the whole pack (its line) is counted on top of the measured precache.
    expect(withWholeClipPack(report(9_000_000, 0))).toBe(9_000_000 + PRECACHE_BUDGET.precachedClipsRaw);
    expect(precacheBudgetProblems(report(line - PRECACHE_BUDGET.precachedClipsRaw, 0))).toEqual([]);
    const tight = precacheBudgetProblems(report(line - PRECACHE_BUDGET.precachedClipsRaw + 1, 0));
    expect(tight.join('\n')).toMatch(/with the whole jamo-s1 pack at its line \(520000 B\) it would be 11287330 B, over the ceiling of 11287329 B/);
    // Once the pack is in (its bytes are part of the measured precache), only the measured precache counts.
    expect(withWholeClipPack(report(line, PRECACHE_BUDGET.precachedClipsRaw))).toBe(line);
    expect(precacheBudgetProblems(report(line, PRECACHE_BUDGET.precachedClipsRaw))).toEqual([]);
    // Over the line itself: the CM-5B problem alone, not both.
    const over = precacheBudgetProblems(report(line + 1, 0));
    expect(over).toHaveLength(1);
    expect(over[0]).toMatch(/row CM-5B/);
  });
});

describe('pwa-postbuild.mjs --budget fails precached clips over their line (G5)', () => {
  let dist;
  let run;
  let deploy;

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'hr-pwa-clips-over-'));
    const files = {
      'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
      'fonts/hr-presenter-kr.woff2': 'wOF2 stand-in',
      ...lessonBundles(),
      [`assets/assets/audio/jamo/giyeok.${HASH}.mp3`]: clip(PRECACHE_BUDGET.precachedClipsRaw - 999),
      [`assets/assets/audio/jamo/nieun.${HASH}.mp3`]: clip(1_000),
    };
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dist, path)), { recursive: true });
      writeFileSync(join(dist, path), body);
    }
    const { WORKERS_CI: _w, CF_PAGES: _p, ...env } = process.env;
    run = spawnSync(process.execPath, [postbuild, dist, '--budget'], { encoding: 'utf8', env });
    deploy = spawnSync(process.execPath, [postbuild, dist, '--budget'], { encoding: 'utf8', env: { ...env, WORKERS_CI: '1' } });
  }, 120_000);

  afterAll(() => {
    if (dist) rmSync(dist, { recursive: true, force: true });
  });

  it('fails and says only jamo-s1 is precached, never a reason to move learnerPrecacheRaw', () => {
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(`the precached clips are ${PRECACHE_BUDGET.precachedClipsRaw + 1} B, over their ceiling of ${PRECACHE_BUDGET.precachedClipsRaw} B`);
    expect(run.stderr).toContain('never a reason to move learnerPrecacheRaw');
  });

  it('on the deploy build, warns only', () => {
    expect(deploy.status).toBe(0);
    expect(deploy.stdout).toContain('pwa-postbuild: WARNING over budget');
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
      ...lessonBundles(),
      'teacher.html': '<!doctype html><title>near miss</title>',
      'present.html': '<!doctype html><title>learner root</title>',
      // F-TCH-004 PR 3: expo copies public/fonts/ into the export.
      'fonts/hr-presenter-kr.woff2': 'wOF2 stand-in',
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

  it('precaches every lesson chunk and prints the precache report (F-CURR-002 §10)', () => {
    for (const { name } of LESSON_MANIFEST) expect(sw, name).toMatch(new RegExp(`"_expo/static/js/web/${name}-[0-9a-f]{32}\\.js"`));
    // Row CM-8: every story chunk too.
    expect(STORY_MANIFEST.length).toBeGreaterThan(0);
    for (const { name } of STORY_MANIFEST) expect(sw, name).toMatch(new RegExp(`"_expo/static/js/web/${name}-[0-9a-f]{32}\\.js"`));
    expect(run.stdout).toContain('pwa-postbuild: precache report (F-CURR-002 §10)');
    expect(run.stdout).toMatch(/ {2}start bundle {2}_expo\/static\/js\/web\/index-abc\.js {2}\d+ B raw {2}\d+ B gzip {2}\(ceiling \d+ B raw\)/);
    expect(run.stdout).toContain(`  lesson chunks  ${LESSON_MANIFEST.length} bundles  `);
    expect(run.stdout).toContain(`  story chunks  ${STORY_MANIFEST.length} bundles  `);
    expect(REVIEW_ITEM_MANIFEST).toEqual([{ name: 'review-items', hash: expect.stringMatching(/^[0-9a-f]{16}$/) }]);
    expect(sw).toMatch(/"_expo\/static\/js\/web\/review-items-[0-9a-f]{32}\.js"/);
    expect(run.stdout).toContain('  review-item chunk  1 bundles  ');
    // The locale chunks and the grown-up roots: precached and reported beside them.
    for (const name of ['locale-es', 'locale-ko', 'PresenterApp', 'BrowseApp', 'guest-chunk']) expect(sw, name).toMatch(new RegExp(`"_expo/static/js/web/${name}-[0-9a-f]{32}\\.js"`));
    expect(run.stdout).toContain('  locale chunks  2 bundles  ');
    expect(run.stdout).toContain('  grown-up root chunks  2 bundles  ');
    expect(run.stdout).toMatch(/ {2}learner precache {2}\d+ files {2}\d+ B {2}\(ceiling \d+ B\)/);
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

  it('keeps overscroll-behavior: none on html and body, so a stage swipe never leaves the page (AMENDMENTS-PRESENTER-NAV section 6)', () => {
    // The presenter (/present) is this page too: the single-page fallback serves index.html.
    const index = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(index).toMatch(/html, body \{ overscroll-behavior: none;[^}]*\}/);
    expect(index).toMatch(/body \{[^}]*user-select: none;[^}]*\}/);
  });

  it('wraps Korean at spaces, never inside a word (F-I18N-001 PR 16, the Korean layout review)', () => {
    const index = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(index).toMatch(/:lang\(ko\)\s*\{\s*word-break: keep-all; overflow-wrap: break-word; overflow-wrap: anywhere;\s*\}/);
  });

  it('declares the presenter font in the shell styles and precaches it (F-TCH-004 PR 3)', () => {
    const index = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(index).toContain(`font-family: "${designTokens.presenter.font}";`);
    expect(index).toContain('src: url("/fonts/hr-presenter-kr.woff2") format("woff2");');
    expect(index).toContain('font-display: block;');
    expect(sw).toContain('"fonts/hr-presenter-kr.woff2"');
  });
});

describe('pwa-postbuild.mjs refuses an export that lacks a lesson chunk (F-CURR-002 §10)', () => {
  let dist;
  let run;

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'hr-pwa-nochunk-'));
    const missing = LESSON_MANIFEST[0]?.name;
    const files = {
      'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
      'fonts/hr-presenter-kr.woff2': 'wOF2 stand-in',
      ...lessonBundles(missing),
    };
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dist, path)), { recursive: true });
      writeFileSync(join(dist, path), body);
    }
    run = spawnSync(process.execPath, [postbuild, dist], { encoding: 'utf8' });
  }, 120_000);

  afterAll(() => {
    if (dist) rmSync(dist, { recursive: true, force: true });
  });

  it('fails the build and names the chunk', () => {
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(`${LESSON_MANIFEST[0]?.name} has no web bundle: the chunk is missing from the build`);
    expect(run.stdout).not.toMatch(/pwa-postbuild: precached/);
  });
});

describe('pwa-postbuild.mjs refuses an export that lacks a locale chunk (F-CURR-002 §10)', () => {
  let dist;
  let run;

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'hr-pwa-nolocale-'));
    const files = {
      'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
      'fonts/hr-presenter-kr.woff2': 'wOF2 stand-in',
      ...lessonBundles('locale-ko'),
    };
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dist, path)), { recursive: true });
      writeFileSync(join(dist, path), body);
    }
    run = spawnSync(process.execPath, [postbuild, dist], { encoding: 'utf8' });
  }, 120_000);

  afterAll(() => {
    if (dist) rmSync(dist, { recursive: true, force: true });
  });

  it('fails the build and names the chunk', () => {
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('locale-ko has no web bundle: the chunk is missing from the build');
    expect(run.stdout).not.toMatch(/pwa-postbuild: precached/);
  });
});

describe('pwa-postbuild.mjs --budget fails a start bundle that grew', () => {
  let dist;
  let run;
  let deploy;

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'hr-pwa-budget-'));
    const bundles = lessonBundles();
    // A start bundle one byte over its line: the same hashes, padded.
    const start = bundles['_expo/static/js/web/index-abc.js'];
    bundles['_expo/static/js/web/index-abc.js'] = start + ' '.repeat(Math.max(0, PRECACHE_BUDGET.startBundleRaw + 1 - start.length));
    const files = {
      'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
      'fonts/hr-presenter-kr.woff2': 'wOF2 stand-in',
      ...bundles,
    };
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dist, path)), { recursive: true });
      writeFileSync(join(dist, path), body);
    }
    const { WORKERS_CI: _w, CF_PAGES: _p, ...env } = process.env;
    run = spawnSync(process.execPath, [postbuild, dist, '--budget'], { encoding: 'utf8', env });
    // The deploy's own build (Cloudflare Workers Builds sets WORKERS_CI): the same overrun only warns.
    deploy = spawnSync(process.execPath, [postbuild, dist, '--budget'], { encoding: 'utf8', env: { ...env, WORKERS_CI: '1' } });
  }, 120_000);

  afterAll(() => {
    if (dist) rmSync(dist, { recursive: true, force: true });
  });

  it('fails over the start bundle line and says it must not grow', () => {
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(`the start bundle is ${PRECACHE_BUDGET.startBundleRaw + 1} B raw, over its ceiling of ${PRECACHE_BUDGET.startBundleRaw} B: it must not grow`);
  });

  it('on the deploy build, warns and still finishes, so a budget line never stops a deploy', () => {
    expect(deploy.status).toBe(0);
    expect(deploy.stdout).toContain('pwa-postbuild: WARNING over budget');
    expect(deploy.stdout).toContain(`over its ceiling of ${PRECACHE_BUDGET.startBundleRaw} B`);
    expect(deploy.stdout).toMatch(/pwa-postbuild: precached/);
  });
});

describe('pwa-postbuild.mjs refuses an export without the presenter font', () => {
  let dist;
  let run;

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'hr-pwa-nofont-'));
    writeFileSync(
      join(dist, 'index.html'),
      '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
    );
    run = spawnSync(process.execPath, [postbuild, dist], { encoding: 'utf8' });
  }, 120_000);

  afterAll(() => {
    if (dist) rmSync(dist, { recursive: true, force: true });
  });

  it('fails the build and names the file', () => {
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('pwa-postbuild: the presenter font is not in the learner precache: fonts/hr-presenter-kr.woff2');
  });
});

describe('pwa-postbuild.mjs refuses an export whose precache would carry console code', () => {
  let dist;
  let run;

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'hr-pwa-leak-'));
    const files = {
      'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
      // A Next export's root 404.html: no grown-up path, but it loads the console's code.
      '404.html': '<!DOCTYPE html><html><body><script src="/_next/static/chunks/main-123.js" async=""></script></body></html>',
    };
    for (const [path, body] of Object.entries(files)) writeFileSync(join(dist, path), body);
    run = spawnSync(process.execPath, [postbuild, dist], { encoding: 'utf8' });
  }, 120_000);

  afterAll(() => {
    if (dist) rmSync(dist, { recursive: true, force: true });
  });

  it('fails the build and names the page', () => {
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('pwa-postbuild: console files found in the learner precache: 404.html');
    expect(run.stdout).not.toMatch(/pwa-postbuild: precached/);
  });
});
