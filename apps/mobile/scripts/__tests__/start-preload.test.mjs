// AMENDMENTS-FOLLOWUPS-2026-11 FU-4: the HTML shell preloads the chunks every learner waits for before the first screen.
import { describe, expect, it } from 'vitest';
import { START_PRELOAD_CHUNKS, startPreloadUrls, withStartPreloads } from '../pwa/start-preload.mjs';

const SHELF = '_expo/static/js/web/stories-shelf-0123456789abcdef0123456789abcdef.js';
const HEADERS_EN = '_expo/static/js/web/lessons-headers-en-fedcba9876543210fedcba9876543210.js';
const OTHERS = [
  '_expo/static/js/web/index-417330252bde6ef235c0eda4235b59ae.js',
  '_expo/static/js/web/lessons-headers-es-239306f0b9574ba05a2b4bcfa9faab8e.js',
  '_expo/static/js/web/lessons-headers-ko-ee19392cd48f5f772e7256ce0b3a3d27.js',
  '_expo/static/js/web/story-sun-and-moon-c1859b5d616bc8547691e5238ea5d2a5.js',
];

describe('startPreloadUrls', () => {
  it('names the story shelf and the English lesson headers, the two chunks the first screen waits for in every locale', () => {
    expect(START_PRELOAD_CHUNKS).toEqual(['stories-shelf', 'lessons-headers-en']);
    expect(startPreloadUrls([...OTHERS, HEADERS_EN, SHELF])).toEqual([`/${SHELF}`, `/${HEADERS_EN}`]);
  });

  it('never picks another locale\'s headers or a chunk whose name only starts the same', () => {
    expect(() => startPreloadUrls(OTHERS, ['lessons-headers-en'])).toThrow('expected one lessons-headers-en bundle to preload, found 0');
    expect(() => startPreloadUrls(['_expo/static/js/web/stories-shelf-extra-0123456789abcdef0123456789abcdef.js'], ['stories-shelf'])).toThrow(
      'found 0',
    );
  });

  it('fails a build with two bundles of one chunk (a stale file left in the export)', () => {
    const stale = '_expo/static/js/web/stories-shelf-11111111111111111111111111111111.js';
    expect(() => startPreloadUrls([SHELF, stale, HEADERS_EN])).toThrow(`expected one stories-shelf bundle to preload, found 2: ${SHELF}, ${stale}`);
  });
});

describe('withStartPreloads', () => {
  const html = '<!DOCTYPE html><html><head><title>Hangul Route</title></head><body><script src="/_expo/static/js/web/index-abc.js" defer></script></body></html>';

  it('adds one preload link per URL at the end of <head>, before the start bundle', () => {
    const out = withStartPreloads(html, [`/${SHELF}`, `/${HEADERS_EN}`]);
    expect(out).toContain(`<link rel="preload" as="script" href="/${SHELF}">\n  <link rel="preload" as="script" href="/${HEADERS_EN}">\n</head>`);
    expect(out.indexOf('rel="preload"')).toBeLessThan(out.indexOf('index-abc.js'));
    // No crossorigin attribute: Metro's loader adds a plain same-origin script tag, which only then reuses the preload.
    expect(out).not.toContain('crossorigin');
    expect(out.match(/rel="preload"/g)).toHaveLength(2);
  });

  it('refuses a page with no head', () => {
    expect(() => withStartPreloads('<html><body></body></html>', [`/${SHELF}`])).toThrow('no </head>');
  });
});
