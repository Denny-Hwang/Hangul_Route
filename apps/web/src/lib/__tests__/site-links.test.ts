import { createRequire } from 'node:module';
import { APP_ORIGIN, APP_ROUTES, personaHint } from '@hangul-route/content-schema';
import { LOCALES } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appUrl } from '../console/config';
import { SITE_DEFAULT_CONSOLE_ORIGIN, grownUpOrigin, learnerStart, signIn, type GrownUpPersona } from '../site-links';
import { appEntryUrl } from '../site-path';

/**
 * The only place the site builds an app URL (F-SITE-002 §3.8, PR S-2). Paths come from F-APP-001's
 * `APP_ROUTES`, the grown-up origin from the site build variable `CONSOLE_ORIGIN` (same origin while it is
 * unset), and the learner action from `appEntryUrl(appUrl(), locale)` exactly as the landing builds it today.
 */
const PERSONAS: readonly GrownUpPersona[] = ['parent', 'teacher'];

/** Paths the site must never link to (F-SITE-002 §3.8, F-BILL-002 §4.1). */
const FORBIDDEN = ['/teach', '/parent', '/account', '/billing', APP_ROUTES.billing] as const;

// A shell that exports either build variable must not change these tests.
beforeEach(() => {
  vi.stubEnv('CONSOLE_ORIGIN', '');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('SITE_DEFAULT_CONSOLE_ORIGIN (until S-10)', () => {
  it('is the same origin, so a build without CONSOLE_ORIGIN keeps grown-ups on the site host', () => {
    expect(SITE_DEFAULT_CONSOLE_ORIGIN).toBe('');
  });
});

describe('grownUpOrigin', () => {
  it('is the same origin when CONSOLE_ORIGIN is unset, empty or blank', () => {
    expect(grownUpOrigin({})).toBe('');
    expect(grownUpOrigin({ CONSOLE_ORIGIN: '' })).toBe('');
    expect(grownUpOrigin({ CONSOLE_ORIGIN: '   ' })).toBe('');
  });

  it('trims CONSOLE_ORIGIN and drops a trailing slash', () => {
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'https://app.hangulroute.com' })).toBe(APP_ORIGIN);
    expect(grownUpOrigin({ CONSOLE_ORIGIN: ' https://app.hangulroute.com/ ' })).toBe(APP_ORIGIN);
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'http://localhost:3000/' })).toBe('http://localhost:3000');
  });

  it('keeps only the origin of a value that carries a path, query or fragment', () => {
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'https://app.hangulroute.com/teach?x=1#y' })).toBe(APP_ORIGIN);
  });

  it('falls back to the default for a value that is not an http(s) URL, so a typo never breaks Sign in', () => {
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'app.hangulroute.com' })).toBe(SITE_DEFAULT_CONSOLE_ORIGIN);
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'javascript:alert(1)' })).toBe(SITE_DEFAULT_CONSOLE_ORIGIN);
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'not a url' })).toBe(SITE_DEFAULT_CONSOLE_ORIGIN);
  });

  it('reads the build variable by default', () => {
    expect(grownUpOrigin()).toBe('');
    vi.stubEnv('CONSOLE_ORIGIN', 'https://app.hangulroute.com/');
    expect(grownUpOrigin()).toBe(APP_ORIGIN);
  });
});

describe('signIn (F-APP-001 §3.7 /signin with ?persona=)', () => {
  it('is /signin on the same origin before M3', () => {
    expect(signIn()).toBe('/signin');
    expect(signIn('parent')).toBe('/signin?persona=parent');
    expect(signIn('teacher')).toBe('/signin?persona=teacher');
  });

  it('is /signin on the app host once CONSOLE_ORIGIN is set (F-APP-001 §6.4)', () => {
    vi.stubEnv('CONSOLE_ORIGIN', 'https://app.hangulroute.com');
    expect(signIn()).toBe('https://app.hangulroute.com/signin');
    expect(signIn('parent')).toBe('https://app.hangulroute.com/signin?persona=parent');
    expect(signIn('teacher')).toBe('https://app.hangulroute.com/signin?persona=teacher');
  });

  it('spells no path itself: the path is APP_ROUTES.signIn', () => {
    expect(signIn()).toBe(APP_ROUTES.signIn);
    vi.stubEnv('CONSOLE_ORIGIN', APP_ORIGIN);
    expect(signIn()).toBe(`${APP_ORIGIN}${APP_ROUTES.signIn}`);
  });

  it('without a persona carries no query (the header and footer use the neutral intro)', () => {
    expect(signIn()).not.toContain('?');
    vi.stubEnv('CONSOLE_ORIGIN', APP_ORIGIN);
    expect(signIn()).not.toContain('?');
  });

  it.each(PERSONAS)('the /signin page reads back the %s hint the site writes', (persona) => {
    const url = new URL(signIn(persona), 'https://hangulroute.com');
    expect(personaHint(url.searchParams)).toBe(persona);
  });

  it('takes only a grown-up persona (by type)', () => {
    // @ts-expect-error learners never sign in with an email or password (F-APP-001 OD-2)
    expect(() => signIn('learner')).not.toThrow();
    // @ts-expect-error an unknown persona does not compile
    expect(() => signIn('admin')).not.toThrow();
  });
});

describe('learnerStart (the learner app, unchanged behaviour)', () => {
  it.each(LOCALES)('%s equals the landing hand-off appEntryUrl(appUrl(), locale)', (locale) => {
    expect(learnerStart(locale)).toBe(appEntryUrl(appUrl(), locale));
  });

  it('is the production learner app, with ?lang= from a non-English page', () => {
    expect(learnerStart('en')).toBe('https://app.hangulroute.com');
    expect(learnerStart('es')).toBe('https://app.hangulroute.com?lang=es');
    expect(learnerStart('ko')).toBe('https://app.hangulroute.com?lang=ko');
  });

  it('follows NEXT_PUBLIC_APP_URL, never CONSOLE_ORIGIN', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.app.example.com/');
    vi.stubEnv('CONSOLE_ORIGIN', 'https://console.example.com');
    expect(learnerStart('en')).toBe('https://preview.app.example.com');
    expect(learnerStart('es')).toBe('https://preview.app.example.com?lang=es');
  });
});

describe('never /teach, never /parent, never /account, never billing', () => {
  function everyOutput(): string[] {
    return [signIn(), ...PERSONAS.map((persona) => signIn(persona)), ...LOCALES.map((locale) => learnerStart(locale))];
  }

  it.each([
    ['the same origin', ''],
    ['the app host', APP_ORIGIN],
  ])('on %s', (_label, origin) => {
    vi.stubEnv('CONSOLE_ORIGIN', origin);
    const outputs = everyOutput();
    expect(outputs).toHaveLength(3 + LOCALES.length);
    for (const href of outputs) {
      const { pathname } = new URL(href, 'https://hangulroute.com');
      for (const forbidden of FORBIDDEN) {
        expect(href.startsWith(forbidden), `${href} starts with ${forbidden}`).toBe(false);
        expect(href.includes(forbidden), `${href} contains ${forbidden}`).toBe(false);
        expect(pathname.startsWith(forbidden), `${pathname} starts with ${forbidden}`).toBe(false);
      }
    }
  });
});

describe('next.config.js passes CONSOLE_ORIGIN to server and client code', () => {
  const load = createRequire(import.meta.url);
  const configPath = load.resolve('../../../next.config.js');

  function freshConfig(): { env?: Record<string, string> } {
    delete load.cache[configPath];
    return load(configPath) as { env?: Record<string, string> };
  }

  afterEach(() => {
    delete load.cache[configPath];
  });

  it('inlines the build variable', () => {
    vi.stubEnv('CONSOLE_ORIGIN', 'https://app.hangulroute.com');
    expect(freshConfig().env).toEqual({ CONSOLE_ORIGIN: 'https://app.hangulroute.com' });
  });

  it('inlines an empty string when the variable is not set (same origin)', () => {
    vi.stubEnv('CONSOLE_ORIGIN', undefined);
    expect(freshConfig().env).toEqual({ CONSOLE_ORIGIN: '' });
  });
});
