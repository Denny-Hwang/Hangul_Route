// AMENDMENTS-FOLLOWUPS-2026-11 FU-4: the HTML shell preloads the chunks every learner waits for before the first screen.
import { runInNewContext } from 'node:vm';
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

/** Runs the shell's inline preload script against a stand-in document; returns the links it added. */
function runShellScript(html, { controller }) {
  const script = /<script>([\s\S]*?)<\/script>\n<\/head>/.exec(html)?.[1];
  if (script === undefined) throw new Error('no preload script before </head>');
  const added = [];
  const document = { createElement: () => ({}), head: { appendChild: (el) => added.push(el) } };
  const navigator = controller === undefined ? {} : { serviceWorker: { controller } };
  runInNewContext(script, { document, navigator });
  return added;
}

describe('withStartPreloads', () => {
  const html = '<!DOCTYPE html><html><head><title>Hangul Route</title></head><body><script src="/_expo/static/js/web/index-abc.js" defer></script></body></html>';
  const out = withStartPreloads(html, [`/${SHELF}`, `/${HEADERS_EN}`]);

  it('adds, at the end of <head> and before the start bundle, a script that preloads each URL as a script', () => {
    expect(out.indexOf('<script>')).toBeLessThan(out.indexOf('</head>'));
    expect(out.indexOf('</head>')).toBeLessThan(out.indexOf('index-abc.js'));
    expect(runShellScript(out, { controller: null })).toEqual([
      { rel: 'preload', as: 'script', href: `/${SHELF}` },
      { rel: 'preload', as: 'script', href: `/${HEADERS_EN}` },
    ]);
    // No crossorigin: Metro's loader adds a plain same-origin script tag, which only then reuses the preload.
    expect(out).not.toContain('crossorigin');
  });

  it('adds nothing under a service worker (it answers from the precache; a preload would be asked for twice)', () => {
    expect(runShellScript(out, { controller: {} })).toEqual([]);
  });

  it('preloads on a browser with no service worker support at all', () => {
    expect(runShellScript(out, { controller: undefined })).toHaveLength(2);
  });

  it('refuses a page with no head, and a URL that is not a plain path', () => {
    expect(() => withStartPreloads('<html><body></body></html>', [`/${SHELF}`])).toThrow('no </head>');
    expect(() => withStartPreloads(html, ['/x.js"]);alert(1);//'])).toThrow('not a plain path');
  });
});
