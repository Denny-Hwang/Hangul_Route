// AMENDMENTS-FINISH-2026-11 FN-2: the HTML shell paints a static splash before the start bundle runs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import * as tokens from '@hangul-route/design-system/tokens';
import { UI_LOCALE_MIRROR_KEY } from '@hangul-route/content-schema';
import { availableLocales, getMessages, LOCALE_META } from '@hangul-route/i18n';
import { SPLASH_BREATHE_FLOOR, STATIC_SPLASH_ID, staticSplash, withStaticSplash } from '../pwa/static-splash.mjs';
import { STATIC_SPLASH_ID as APP_SPLASH_ID } from '../../src/platform/static-splash.web';

const here = dirname(fileURLToPath(import.meta.url));

/** The locales as pwa-postbuild.mjs passes them: every shipped one, English first. */
const LOCALES = availableLocales(false)
  .sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : 0))
  .map((locale) => ({ locale, lang: LOCALE_META[locale].htmlLang, loading: getMessages(locale).common.splash.loading }));
const BRAND = getMessages('en').landing.brand;
const splash = staticSplash({ tokens, brand: BRAND, locales: LOCALES, mirrorKey: UI_LOCALE_MIRROR_KEY });
const SHELL =
  '<!DOCTYPE html><html lang="en"><head><title>Hangul Route</title></head><body><noscript>x</noscript><div id="root"></div>' +
  '<script src="/_expo/static/js/web/index-abc.js" defer></script></body></html>';
const html = withStaticSplash(SHELL, splash);

/**
 * Runs the shell's inline splash script against a stand-in document, browser storage and navigator; returns the line
 * and `<html lang>` it leaves.
 */
function runSplashScript({ stored = null, languages = [], language = '', storageThrows = false } = {}) {
  const script = new RegExp(`<div id="${STATIC_SPLASH_ID}">[\\s\\S]*?<script>([\\s\\S]*?)</script>`).exec(html)?.[1];
  if (script === undefined) throw new Error('no splash script');
  const line = { textContent: LOCALES[0].loading };
  const document = { documentElement: { lang: 'en' }, getElementById: (id) => (id === `${STATIC_SPLASH_ID}-line` ? line : null) };
  const localStorage = {
    getItem: (key) => {
      if (storageThrows) throw new Error('SecurityError');
      return key === `hr:${UI_LOCALE_MIRROR_KEY}` ? stored : null;
    },
  };
  runInNewContext(script, { document, navigator: { languages, language }, window: { localStorage } });
  return { line: line.textContent, lang: document.documentElement.lang };
}

describe('the static splash in the HTML shell', () => {
  it('paints the brand mark, the app name and the English line, before the root and the start bundle, with no script', () => {
    const at = (s) => html.indexOf(s);
    expect(at(`<div id="${STATIC_SPLASH_ID}">`)).toBeGreaterThan(at('<body>'));
    expect(at(`<div id="${STATIC_SPLASH_ID}">`)).toBeLessThan(at('<div id="root">'));
    expect(at('<div id="root">')).toBeLessThan(at('index-abc.js'));
    expect(html).toContain(`<div class="hr-splash-mark" aria-hidden="true">HR</div>`);
    expect(html).toContain('<p class="hr-splash-name">Hangul Route</p>');
    expect(html).toContain(`<p class="hr-splash-line" id="${STATIC_SPLASH_ID}-line">Loading</p>`);
    // Its style is in the head, so the first paint already has it.
    expect(at(`<style id="${STATIC_SPLASH_ID}-style">`)).toBeLessThan(at('</head>'));
  });

  it('uses the design tokens for every colour, size and duration (no colour of its own)', () => {
    const style = splash.style;
    expect(style).toContain(`background: ${tokens.colors.surface.canvas}`);
    expect(style).toContain(`color: ${tokens.colors.text.primary}`);
    expect(style).toContain(`background: ${tokens.colors.brand.primary}; color: ${tokens.colors.text.inverse}`);
    expect(style).toContain(`color: ${tokens.colors.text.secondary}`);
    expect(style).toContain(`width: ${tokens.spacing.jumbo / 16}rem`);
    expect(style).toContain(`font-size: ${tokens.typography.size.title / 16}rem`);
    expect(style).toContain(`font-size: ${tokens.typography.size.body / 16}rem`);
    expect(style).toContain(`${tokens.motion.duration.celebration * 2}ms ${tokens.motion.easing.standard}`);
    const tokenColours = new Set([tokens.colors.surface.canvas, tokens.colors.text.primary, tokens.colors.text.secondary, tokens.colors.brand.primary, tokens.colors.text.inverse].map((c) => c.toLowerCase()));
    const literals = style.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
    expect(literals.length).toBeGreaterThan(0);
    for (const colour of literals) expect(tokenColours.has(colour.toLowerCase()), colour).toBe(true);
  });

  it('breathes only where motion is allowed, and never below 4.5:1 for the line', () => {
    const outside = splash.style.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n    \}\n/, '');
    expect(splash.style).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
    expect(outside).not.toMatch(/animation:/);
    expect(SPLASH_BREATHE_FLOOR).toBe(0.8);
    // text.secondary over canvas at the floor (WCAG relative luminance).
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const mix = (fg, bg, a) => `#${[1, 3, 5].map((i) => Math.round(a * parseInt(fg.slice(i, i + 2), 16) + (1 - a) * parseInt(bg.slice(i, i + 2), 16)).toString(16).padStart(2, '0')).join('')}`;
    const canvas = tokens.colors.surface.canvas;
    const faded = mix(tokens.colors.text.secondary, canvas, SPLASH_BREATHE_FLOOR);
    expect((lum(canvas) + 0.05) / (lum(faded) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it('carries every shipped locale\'s line, from packages/i18n', () => {
    expect(LOCALES.map((l) => l.locale)).toEqual(['en', 'es', 'ko']);
    for (const { loading } of LOCALES) expect(html).toContain(JSON.stringify(loading).slice(1, -1).replace(/</g, '\\u003c'));
  });
});

describe('the splash language: the device\'s choice, else the browser\'s, else English (the record resolution)', () => {
  it('takes the device record\'s mirrored language first, over the browser languages', () => {
    expect(runSplashScript({ stored: 'ko', languages: ['es-MX', 'en'] })).toEqual({ line: '불러오는 중', lang: 'ko' });
    expect(runSplashScript({ stored: 'en', languages: ['ko-KR'] })).toEqual({ line: 'Loading', lang: 'en' });
  });

  it('falls back to the first browser language the app ships, region dropped, as detectLocale does', () => {
    expect(runSplashScript({ languages: ['fr-FR', 'es-MX', 'ko'] })).toEqual({ line: 'Cargando', lang: 'es' });
    expect(runSplashScript({ languages: [], language: 'ko_KR' })).toEqual({ line: '불러오는 중', lang: 'ko' });
  });

  it('ignores a stored value that is not a shipped locale, and storage that cannot be read', () => {
    expect(runSplashScript({ stored: 'fr', languages: ['es'] })).toEqual({ line: 'Cargando', lang: 'es' });
    expect(runSplashScript({ stored: 'ko', storageThrows: true, languages: ['es'] })).toEqual({ line: 'Cargando', lang: 'es' });
  });

  it('stays English when nothing is stored and no browser language ships', () => {
    expect(runSplashScript({ languages: ['fr', 'de'] })).toEqual({ line: 'Loading', lang: 'en' });
    expect(runSplashScript()).toEqual({ line: 'Loading', lang: 'en' });
  });

  it('never throws, even with no splash line on the page', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(splash.markup)?.[1] ?? '';
    expect(() => runInNewContext(script, { document: { getElementById: () => null, documentElement: {} }, navigator: { languages: ['ko'] }, window: {} })).not.toThrow();
  });
});

describe('the splash is removed by the app', () => {
  it('uses the id the app removes', () => {
    expect(APP_SPLASH_ID).toBe(STATIC_SPLASH_ID);
  });

  it('wraps every root index.ts registers (the learner app, the presenter, All lessons, the grown-up bounce)', () => {
    const index = readFileSync(join(here, '..', '..', 'index.ts'), 'utf8');
    expect(index).toMatch(/import \{ withStaticSplashRemoved \} from '\.\/src\/platform\/static-splash';/);
    expect(index).toMatch(/registerRootComponent\(\s*withStaticSplashRemoved\(/);
  });
});

describe('withStaticSplash and staticSplash refuse what they cannot place', () => {
  it('needs a head and the root element; a page with a splash already is left as it is (a second post-build run)', () => {
    expect(() => withStaticSplash('<html><body><div id="root"></div></body></html>', splash)).toThrow('no </head>');
    expect(() => withStaticSplash('<html><head></head><body></body></html>', splash)).toThrow('no <div id="root"></div>');
    expect(withStaticSplash(html, splash)).toBe(html);
  });

  it('needs a line for every locale and the brand', () => {
    expect(() => staticSplash({ tokens, brand: BRAND, locales: [], mirrorKey: UI_LOCALE_MIRROR_KEY })).toThrow('at least one locale');
    expect(() => staticSplash({ tokens, brand: BRAND, locales: [{ locale: 'ko', lang: 'ko', loading: ' ' }], mirrorKey: UI_LOCALE_MIRROR_KEY })).toThrow('locale "ko"');
    expect(() => staticSplash({ tokens, brand: { name: '', mark: 'HR' }, locales: LOCALES, mirrorKey: UI_LOCALE_MIRROR_KEY })).toThrow('brand');
  });

  it('escapes the strings it writes into the HTML and the script', () => {
    const odd = staticSplash({ tokens, brand: { name: 'A <b>', mark: 'H&R' }, locales: [{ locale: 'en', lang: 'en', loading: '</script><x>' }], mirrorKey: UI_LOCALE_MIRROR_KEY });
    expect(odd.markup).toContain('A &lt;b&gt;');
    expect(odd.markup).toContain('H&amp;R');
    expect(odd.markup).not.toContain('</script><x>');
  });
});
