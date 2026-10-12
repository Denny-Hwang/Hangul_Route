import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import {
  allowedFor,
  baselinePage,
  controlKey,
  isSmall,
  LANDING_WIDTHS,
  normalizeHref,
  occurrenceKeys,
  ratchet,
  TARGET_MIN,
  type LandingTouchAllowlist,
} from '../../../e2e/landing-targets';

/**
 * F-I18N-001 §3.11 / PR 14: the landing half of the locale layout matrix
 * (`e2e/landing-locales.spec.ts`). The site's links and buttons predate the
 * `touchTarget.min` floor, so the matrix holds them to a ratchet: the controls
 * under 64 today are listed in `e2e/fixtures/landing-touch-allowlist.json`, a new
 * one fails, and a listed one that grew must leave the list. Keys do not depend on
 * the page's words or locale prefix, so `/es` and `/ko` are held to the English
 * page's list. These tests pin the keys and the comparison without a browser.
 */
const allowlist = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'landing-touch-allowlist.json'), 'utf8'),
) as LandingTouchAllowlist;

describe('matrix shape', () => {
  it('the floor is touchTarget.min and the widths are the landing layout spec ones', () => {
    expect(TARGET_MIN).toBe(touchTarget.min);
    expect([...LANDING_WIDTHS]).toEqual([320, 375, 768]);
  });
});

describe('normalizeHref', () => {
  it('drops the locale prefix of a site path', () => {
    expect(normalizeHref('/es')).toBe('/');
    expect(normalizeHref('/ko/')).toBe('/');
    expect(normalizeHref('/es/about')).toBe('/about');
    expect(normalizeHref('/ko/privacy#data')).toBe('/privacy#data');
    expect(normalizeHref('/about')).toBe('/about');
    // Only a whole first segment is a locale.
    expect(normalizeHref('/essentials')).toBe('/essentials');
  });

  it('drops the ?lang= hand-off from the app link and keeps everything else', () => {
    expect(normalizeHref('https://app.hangulroute.com?lang=ko')).toBe('https://app.hangulroute.com');
    expect(normalizeHref('https://app.hangulroute.com/?lang=es&x=1')).toBe('https://app.hangulroute.com/?x=1');
    expect(normalizeHref('#cards')).toBe('#cards');
    expect(normalizeHref('mailto:hello@hangulroute.com')).toBe('mailto:hello@hangulroute.com');
  });
});

describe('controlKey', () => {
  it('names a control by what it is and where it goes, never by its words', () => {
    expect(controlKey({ tag: 'a', href: '/es/about', hreflang: null, type: null })).toBe('a /about');
    expect(controlKey({ tag: 'a', href: '/ko', hreflang: 'ko', type: null })).toBe('a hreflang=ko');
    expect(controlKey({ tag: 'button', href: null, hreflang: null, type: 'submit' })).toBe('button submit');
    expect(controlKey({ tag: 'input', href: null, hreflang: null, type: 'email' })).toBe('input email');
    expect(controlKey({ tag: 'summary', href: null, hreflang: null, type: null })).toBe('summary');
  });
});

describe('isSmall', () => {
  it('is under the floor in either dimension, sub-pixel rounding aside', () => {
    expect(isSmall({ width: 64, height: 64 })).toBe(false);
    expect(isSmall({ width: 63.6, height: 100 })).toBe(false);
    expect(isSmall({ width: 200, height: 40 })).toBe(true);
    expect(isSmall({ width: 50, height: 80 })).toBe(true);
  });
});

describe('occurrenceKeys', () => {
  it('numbers repeats in document order', () => {
    expect(occurrenceKeys(['summary', 'a /', 'summary', 'summary'])).toEqual(['summary', 'a /', 'summary #2', 'summary #3']);
  });
});

describe('baselinePage', () => {
  it('holds a locale page to the English page of the same name', () => {
    expect(baselinePage('/')).toBe('/');
    expect(baselinePage('/es')).toBe('/');
    expect(baselinePage('/ko/')).toBe('/');
    expect(baselinePage('/es/about')).toBe('/about');
    expect(baselinePage('/about')).toBe('/about');
  });
});

describe('allowedFor', () => {
  const list: LandingTouchAllowlist = { note: '', pages: { '/': ['a /about'] }, shownLocales: { '/': ['a hreflang=es'] } };

  it('a default build allows the page list only; a build that shows every locale adds its switcher lines', () => {
    expect(allowedFor(list, '/', false)).toEqual(['a /about']);
    expect(allowedFor(list, '/', true)).toEqual(['a /about', 'a hreflang=es']);
    expect(allowedFor(list, '/about', true)).toEqual([]);
  });
});

describe('ratchet', () => {
  it('reports new small controls and listed ones that are no longer small', () => {
    expect(ratchet(['a', 'b', 'b'], ['a', 'b'])).toEqual({ added: [], gone: [] });
    expect(ratchet(['a', 'c'], ['a', 'b'])).toEqual({ added: ['c'], gone: ['b'] });
  });
});

describe('e2e/fixtures/landing-touch-allowlist.json', () => {
  it('lists the English pages only, each sorted and unique, and says it only shrinks', () => {
    expect(Object.keys(allowlist.pages).sort()).toEqual(['/', '/about']);
    for (const keys of [...Object.values(allowlist.pages), ...Object.values(allowlist.shownLocales)]) {
      expect(keys).toEqual([...new Set(keys)].sort());
    }
    expect(allowlist.note).toMatch(/only shrinks/);
  });

  it('its switcher lines are the locale links', () => {
    for (const key of Object.values(allowlist.shownLocales).flat()) expect(key).toMatch(/^a hreflang=(en|es|ko)$/);
  });
});
