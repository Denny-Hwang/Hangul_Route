import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../messages/en';
import { fallbackPaths, getMessages, resolveLocale } from '../resolve';
import { pseudoText } from '../pseudo';

// A partial Spanish overlay, so the merge and fallback paths run against
// something real. (The shipped es/ko overlays are empty until PR 15/16.)
vi.mock('../messages/es/index', () => ({
  es: {
    common: {
      buttons: { ok: 'Vale' },
      time: { today: 'hoy', yesterday: 'ayer' },
    },
    a11y: { stars: (n: number) => `${n} de 3 estrellas` },
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveLocale', () => {
  it('precedence: profile > device > detected > en', () => {
    expect(resolveLocale({ profile: 'ko', device: 'es', detected: 'en' })).toBe('ko');
    expect(resolveLocale({ profile: undefined, device: 'es', detected: 'en' })).toBe('es');
    expect(resolveLocale({ profile: null, device: null, detected: 'ko' })).toBe('ko');
    expect(resolveLocale({})).toBe('en');
    expect(resolveLocale({ profile: null, device: undefined, detected: undefined })).toBe('en');
  });
});

describe('getMessages', () => {
  it('en is the source dictionary itself', () => {
    expect(getMessages('en')).toBe(en);
  });

  it('es: overlay values win, missing keys fall back to English', () => {
    const es = getMessages('es');
    expect(es.common.buttons.ok).toBe('Vale');
    expect(es.common.time.today).toBe('hoy');
    expect(es.common.time.notYet).toBe(en.common.time.notYet);
    expect(es.common.buttons.cancel).toBe(en.common.buttons.cancel);
    expect(es.a11y.stars(2)).toBe('2 de 3 estrellas');
    expect(es.a11y.tile('x')).toBe(en.a11y.tile('x'));
  });

  it('is memoised per locale and never mutates English', () => {
    expect(getMessages('es')).toBe(getMessages('es'));
    expect(en.common.buttons.ok).toBe('OK');
  });

  it('ko (empty overlay) equals English until PR 16', () => {
    expect(getMessages('ko').common.buttons.ok).toBe(en.common.buttons.ok);
  });

  it('is an explicit-locale API: any locale at any time', () => {
    expect(getMessages('es').common.buttons.ok).toBe('Vale');
    expect(getMessages('en').common.buttons.ok).toBe('OK');
  });

  it('en-XA is pseudo-localised only when the build flag is set', () => {
    expect(getMessages('en-XA')).toBe(en);
    vi.stubEnv('EXPO_PUBLIC_PSEUDO_LOCALE', '1');
    const pseudo = getMessages('en-XA');
    expect(pseudo.common.buttons.ok).toBe(pseudoText('OK'));
    expect(pseudo.a11y.stars(2)).toBe(pseudoText(en.a11y.stars(2)));
    expect(getMessages('en-XA')).toBe(pseudo);
  });
});

describe('fallbackPaths', () => {
  it('lists dotted paths that fell back to English', () => {
    const paths = fallbackPaths('es');
    expect(paths).toContain('common.time.notYet');
    expect(paths).toContain('common.buttons.cancel');
    expect(paths).toContain('a11y.tile');
    expect(paths).not.toContain('common.buttons.ok');
    expect(paths).not.toContain('common.time.today');
    expect(paths).not.toContain('a11y.stars');
  });

  it('ko with no overlay falls back everywhere; en and en-XA never fall back', () => {
    expect(fallbackPaths('ko').length).toBeGreaterThan(0);
    expect(fallbackPaths('ko')).toContain('common.buttons.ok');
    expect(fallbackPaths('en')).toEqual([]);
    expect(fallbackPaths('en-XA')).toEqual([]);
  });
});
