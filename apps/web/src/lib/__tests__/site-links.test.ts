import { createRequire } from 'node:module';
import { APP_ORIGIN, APP_ROUTES, personaHint } from '@hangul-route/content-schema';
import { LOCALES } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { appUrl } from '../console/config';
import { CONSOLE_ORIGIN_OFF, SITE_DEFAULT_CONSOLE_ORIGIN, createAccount, grownUpOrigin, learnerStart, parseConsoleOrigin, signIn, type GrownUpPersona } from '../site-links';
import { appEntryUrl } from '../site-path';

/**
 * The only place the site builds an app URL (F-SITE-002 §3.8, PR S-2). Paths come from F-APP-001's
 * `APP_ROUTES`, the grown-up origin from the site build variable `CONSOLE_ORIGIN` (the app host while it is
 * unset since S-10, the site's own origin for the kill switch `false`, `0`, `off` or `no`, any case, trimmed), and the learner action from `appEntryUrl(appUrl(), locale)` exactly as the landing builds it today.
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

describe('SITE_DEFAULT_CONSOLE_ORIGIN (S-10)', () => {
  it('is the app host, so a build without CONSOLE_ORIGIN sends grown-ups where production moved them at M3', () => {
    expect(SITE_DEFAULT_CONSOLE_ORIGIN).toBe(APP_ORIGIN);
  });

  it('keeps the kill switch: false, 0, off or no (any case, trimmed, as the app\'s parseKillSwitch) means the site\'s own origin', () => {
    expect(CONSOLE_ORIGIN_OFF).toEqual(['false', '0', 'off', 'no']);
    for (const off of ['false', '0', 'FALSE', ' False ', ' 0 ', 'off', 'OFF', ' Off ', 'no', 'NO', ' No ']) {
      expect(grownUpOrigin({ CONSOLE_ORIGIN: off }), off).toBe('');
    }
  });
});

describe('grownUpOrigin', () => {
  it('is the app host when CONSOLE_ORIGIN is unset, empty or blank', () => {
    expect(grownUpOrigin({})).toBe(APP_ORIGIN);
    expect(grownUpOrigin({ CONSOLE_ORIGIN: '' })).toBe(APP_ORIGIN);
    expect(grownUpOrigin({ CONSOLE_ORIGIN: '   ' })).toBe(APP_ORIGIN);
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

  it('takes plain http only on this machine, so Sign in links never go out over plaintext', () => {
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'http://app.hangulroute.com' })).toBe(SITE_DEFAULT_CONSOLE_ORIGIN);
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'http://example.com:8080/' })).toBe(SITE_DEFAULT_CONSOLE_ORIGIN);
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'http://localhost:3000/' })).toBe('http://localhost:3000');
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'http://127.0.0.1:3000' })).toBe('http://127.0.0.1:3000');
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'http://[::1]:3000' })).toBe('http://[::1]:3000');
  });

  it('ignores an https host outside hangulroute.com, so a mistyped domain never receives grown-ups', () => {
    for (const value of ['https://app.hangulroute.co', 'https://app-hangulroute.com', 'https://hangulroute.com.example.com', 'https://evilhangulroute.com', 'https://console.example.com']) {
      expect(grownUpOrigin({ CONSOLE_ORIGIN: value }), value).toBe(SITE_DEFAULT_CONSOLE_ORIGIN);
    }
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'https://hangulroute.com' })).toBe('https://hangulroute.com');
    expect(grownUpOrigin({ CONSOLE_ORIGIN: 'https://preview.app.hangulroute.com' })).toBe('https://preview.app.hangulroute.com');
  });

  it('reads the build variable by default', () => {
    expect(grownUpOrigin()).toBe(APP_ORIGIN);
    vi.stubEnv('CONSOLE_ORIGIN', 'false');
    expect(grownUpOrigin()).toBe('');
    vi.stubEnv('CONSOLE_ORIGIN', 'https://app.hangulroute.com/');
    expect(grownUpOrigin()).toBe(APP_ORIGIN);
  });
});

describe('signIn (F-APP-001 §3.7 /signin with ?persona=)', () => {
  it('is /signin on the same origin with the kill switch CONSOLE_ORIGIN=false', () => {
    vi.stubEnv('CONSOLE_ORIGIN', 'false');
    expect(signIn()).toBe('/signin');
    expect(signIn('parent')).toBe('/signin?persona=parent');
    expect(signIn('teacher')).toBe('/signin?persona=teacher');
  });

  it('is /signin on the app host by default (S-10) and with CONSOLE_ORIGIN set (F-APP-001 §6.4)', () => {
    expect(signIn('parent')).toBe('https://app.hangulroute.com/signin?persona=parent');
    vi.stubEnv('CONSOLE_ORIGIN', 'https://app.hangulroute.com');
    expect(signIn()).toBe('https://app.hangulroute.com/signin');
    expect(signIn('parent')).toBe('https://app.hangulroute.com/signin?persona=parent');
    expect(signIn('teacher')).toBe('https://app.hangulroute.com/signin?persona=teacher');
  });

  it('spells no path itself: the path is APP_ROUTES.signIn', () => {
    vi.stubEnv('CONSOLE_ORIGIN', 'false');
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
    expectTypeOf<GrownUpPersona>().toEqualTypeOf<'parent' | 'teacher'>();
    // @ts-expect-error learners never sign in with an email or password (F-APP-001 OD-2)
    expect(() => signIn('learner')).not.toThrow();
    // @ts-expect-error an unknown persona does not compile
    expect(() => signIn('admin')).not.toThrow();
  });
});

describe('signIn from a locale page carries ?lang= (the sign-in page opens in the language being read)', () => {
  it('adds lang only off English, after the persona', () => {
    vi.stubEnv('CONSOLE_ORIGIN', 'false');
    expect(signIn(undefined, 'en')).toBe('/signin');
    expect(signIn('parent', 'en')).toBe('/signin?persona=parent');
    expect(signIn('parent', 'es')).toBe('/signin?persona=parent&lang=es');
    expect(signIn(undefined, 'ko')).toBe('/signin?lang=ko');
  });
});

/** [SN] AMENDMENTS-SITE-NEWUSER §3.8: the create view of /signin, the grown-up pages' primary action. */
describe('createAccount (/signin?mode=create&persona=<p>)', () => {
  it.each(PERSONAS)('%s: the create view with the persona hint, lang only off English, on the site origin with the kill switch', (persona) => {
    vi.stubEnv('CONSOLE_ORIGIN', 'false');
    expect(createAccount(persona)).toBe(`${APP_ROUTES.signIn}?mode=create&persona=${persona}`);
    expect(createAccount(persona, 'en')).toBe(`${APP_ROUTES.signIn}?mode=create&persona=${persona}`);
    expect(createAccount(persona, 'es')).toBe(`${APP_ROUTES.signIn}?mode=create&persona=${persona}&lang=es`);
    expect(createAccount(persona, 'ko')).toBe(`${APP_ROUTES.signIn}?mode=create&persona=${persona}&lang=ko`);
  });

  it.each(PERSONAS)('%s: on the app host by default (S-10) and with CONSOLE_ORIGIN set', (persona) => {
    expect(createAccount(persona)).toBe(`${APP_ORIGIN}${APP_ROUTES.signIn}?mode=create&persona=${persona}`);
    vi.stubEnv('CONSOLE_ORIGIN', 'https://app.hangulroute.com');
    expect(createAccount(persona, 'es')).toBe(`${APP_ORIGIN}${APP_ROUTES.signIn}?mode=create&persona=${persona}&lang=es`);
  });

  it.each(PERSONAS)('%s: the /signin page reads mode=create and the persona hint back', (persona) => {
    const url = new URL(createAccount(persona, 'ko'), 'https://hangulroute.com');
    expect(url.searchParams.get('mode')).toBe('create');
    expect(personaHint(url.searchParams)).toBe(persona);
    expect(url.searchParams.get('lang')).toBe('ko');
  });

  it('takes only a grown-up persona (by type)', () => {
    // @ts-expect-error learners never create an account (F-APP-001 OD-2)
    expect(() => createAccount('learner')).not.toThrow();
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
    return [
      signIn(),
      ...PERSONAS.map((persona) => signIn(persona)),
      ...LOCALES.map((locale) => learnerStart(locale)),
      ...PERSONAS.flatMap((persona) => LOCALES.map((locale) => createAccount(persona, locale))),
    ];
  }

  it.each([
    ['the same origin', 'false'],
    ['the default (the app host)', ''],
    ['the app host', APP_ORIGIN],
  ])('on %s', (_label, origin) => {
    vi.stubEnv('CONSOLE_ORIGIN', origin);
    const outputs = everyOutput();
    expect(outputs).toHaveLength(3 + LOCALES.length + PERSONAS.length * LOCALES.length);
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

  it('inlines an empty string when the variable is not set (the default, the app host)', () => {
    vi.stubEnv('CONSOLE_ORIGIN', undefined);
    expect(freshConfig().env).toEqual({ CONSOLE_ORIGIN: '' });
  });

  it('inlines a blank value as it is (grownUpOrigin reads it as unset)', () => {
    vi.stubEnv('CONSOLE_ORIGIN', '  ');
    expect(freshConfig().env).toEqual({ CONSOLE_ORIGIN: '  ' });
  });

  it.each(['false', '0', ' FALSE ', 'off', ' OFF ', 'no', ' No '])('inlines the kill switch %j as it is (grownUpOrigin reads it as the site)', (value) => {
    vi.stubEnv('CONSOLE_ORIGIN', value);
    expect(freshConfig().env).toEqual({ CONSOLE_ORIGIN: value });
  });

  it.each(['app.hangulroute.com', 'http://app.hangulroute.com', 'not a url', 'javascript:alert(1)', 'https://app.hangulroute.co', 'https://app-hangulroute.com'])(
    'fails the build for %j, so a mistyped origin never ships links that silently stay on the site',
    (value) => {
      vi.stubEnv('CONSOLE_ORIGIN', value);
      expect(() => freshConfig()).toThrow(/CONSOLE_ORIGIN/);
    },
  );

  // next.config.js is CommonJS and cannot import this module, so it repeats the rule. Both must agree: a
  // non-blank value fails the build exactly when parseConsoleOrigin would ignore it.
  it.each([
    'https://app.hangulroute.com',
    ' https://app.hangulroute.com/ ',
    'https://app.hangulroute.com/teach?x=1#y',
    'http://localhost:3000/',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
    'app.hangulroute.com',
    'http://app.hangulroute.com',
    'ftp://app.hangulroute.com',
    'https://app.hangulroute.co',
    'https://app-hangulroute.com',
    'https://hangulroute.com.example.com',
    'javascript:alert(1)',
    'not a url',
    'false',
    ' 0 ',
    'off',
    ' OFF ',
    'no',
    ' No ',
    'yes',
    'disabled',
  ])('agrees with parseConsoleOrigin on %j', (value) => {
    vi.stubEnv('CONSOLE_ORIGIN', value);
    const ignored = parseConsoleOrigin(value) === undefined;
    if (ignored) expect(() => freshConfig()).toThrow(/CONSOLE_ORIGIN/);
    else expect(freshConfig().env).toEqual({ CONSOLE_ORIGIN: value });
  });
});

describe('turbo passes CONSOLE_ORIGIN to the site build', () => {
  // Turbo runs in strict env mode: a variable that is not NEXT_PUBLIC_ and not listed is dropped from the task
  // and left out of its cache key, so `pnpm run build` would inline '' or replay an out/ built for another value.
  it('lists the variable on the @hangul-route/web#build task', () => {
    const load = createRequire(import.meta.url);
    const turbo = load('../../../../../turbo.json') as { tasks: Record<string, { env?: string[] }> };
    expect(turbo.tasks['@hangul-route/web#build']?.env).toContain('CONSOLE_ORIGIN');
  });
});
