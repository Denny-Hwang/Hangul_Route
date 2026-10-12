import { describe, expect, it } from 'vitest';
import { DEFAULT_ORIGINS, allowedOrigin, authorizedPartiesFor, parseAllowedOrigins } from '../cors';

describe('cors allow-list (F-CONSOLE-001 §3.1)', () => {
  it('parses a comma list, trimming and dropping trailing slashes; falls back to defaults', () => {
    expect(parseAllowedOrigins(' https://a.example/, https://b.example ,, ')).toEqual(['https://a.example', 'https://b.example']);
    expect(parseAllowedOrigins(undefined)).toEqual([...DEFAULT_ORIGINS]);
    expect(parseAllowedOrigins('   ')).toEqual([...DEFAULT_ORIGINS]);
  });

  it('with no explicit list: production hosts, localhost and workers.dev previews pass', () => {
    expect(allowedOrigin('https://app.hangulroute.com', undefined)).toBe('https://app.hangulroute.com');
    expect(allowedOrigin('http://localhost:3000', undefined)).toBe('http://localhost:3000');
    expect(allowedOrigin('http://127.0.0.1:4173', undefined)).toBe('http://127.0.0.1:4173');
    expect(allowedOrigin('https://hangul-route-app.denny.workers.dev', undefined)).toBe('https://hangul-route-app.denny.workers.dev');
    expect(allowedOrigin('https://evil.example', undefined)).toBeNull();
    expect(allowedOrigin('https://evil.example/workers.dev', undefined)).toBeNull();
    expect(allowedOrigin(undefined, undefined)).toBeNull();
  });

  it('with an explicit list only those origins pass — no localhost, no previews', () => {
    expect(allowedOrigin('https://a.example', 'https://a.example')).toBe('https://a.example');
    expect(allowedOrigin('http://localhost:3000', 'https://a.example')).toBeNull();
    expect(allowedOrigin('https://x.workers.dev', 'https://a.example')).toBeNull();
    expect(allowedOrigin('https://app.hangulroute.com', 'https://a.example')).toBeNull();
  });
});

describe('authorizedPartiesFor: the token side of the same allow-list (F-APP-001 A-9)', () => {
  const explicit = 'https://hangulroute.com, https://app.hangulroute.com/';

  it('with no explicit list: the defaults, plus a local dev server or workers.dev preview that CORS lets in', () => {
    expect(authorizedPartiesFor(undefined, undefined)).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor('  ', undefined)).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, 'https://app.hangulroute.com')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, 'http://localhost:3000')).toEqual([...DEFAULT_ORIGINS, 'http://localhost:3000']);
    expect(authorizedPartiesFor(undefined, 'https://pr-12.hangul-route-web.denny.workers.dev')).toEqual([
      ...DEFAULT_ORIGINS,
      'https://pr-12.hangul-route-web.denny.workers.dev',
    ]);
  });

  it('never adds a party CORS would refuse', () => {
    expect(authorizedPartiesFor(undefined, 'https://evil.example')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, 'https://staging.hangulroute.com')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, '')).toEqual([...DEFAULT_ORIGINS]);
  });

  it('with an explicit list: exactly that list, whatever the token claims', () => {
    const list = ['https://hangulroute.com', 'https://app.hangulroute.com'];
    expect(authorizedPartiesFor(explicit, undefined)).toEqual(list);
    expect(authorizedPartiesFor(explicit, 'https://app.hangulroute.com')).toEqual(list);
    expect(authorizedPartiesFor(explicit, 'http://localhost:3000')).toEqual(list);
    expect(authorizedPartiesFor(explicit, 'https://x.workers.dev')).toEqual(list);
    expect(authorizedPartiesFor(explicit, 'https://www.hangulroute.com')).toEqual(list);
  });

  it('returns a fresh array, so a caller cannot change the defaults', () => {
    const parties = authorizedPartiesFor(undefined, undefined);
    parties.push('https://evil.example');
    expect(authorizedPartiesFor(undefined, undefined)).toEqual([...DEFAULT_ORIGINS]);
  });
});
