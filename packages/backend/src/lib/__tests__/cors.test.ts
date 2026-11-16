import { describe, expect, it } from 'vitest';
import { DEFAULT_ORIGINS, allowedOrigin, authorizedPartiesFor, parseAllowedOrigins } from '../cors';

describe('cors allow-list (F-CONSOLE-001 §3.1)', () => {
  it('parses a comma list, trimming and dropping trailing slashes; falls back to defaults', () => {
    expect(parseAllowedOrigins(' https://a.example/, https://b.example ,, ')).toEqual(['https://a.example', 'https://b.example']);
    expect(parseAllowedOrigins(undefined)).toEqual([...DEFAULT_ORIGINS]);
    expect(parseAllowedOrigins('   ')).toEqual([...DEFAULT_ORIGINS]);
  });

  // [AU] AMENDMENTS-AUDIT-2026-11 AU-4 (audit SEC-2).
  it('with no explicit list, in production: the default origins only; no localhost, no workers.dev', () => {
    for (const origin of DEFAULT_ORIGINS) expect(allowedOrigin(origin, undefined, 'production')).toBe(origin);
    expect(allowedOrigin('http://localhost:3000', undefined, 'production')).toBeNull();
    expect(allowedOrigin('http://127.0.0.1:4173', undefined, 'production')).toBeNull();
    expect(allowedOrigin('https://hangul-route-app.denny.workers.dev', undefined, 'production')).toBeNull();
    expect(allowedOrigin('https://attacker.workers.dev', '  ', 'production')).toBeNull();
    expect(allowedOrigin('https://evil.example', undefined, 'production')).toBeNull();
    expect(allowedOrigin(undefined, undefined, 'production')).toBeNull();
  });

  it.each(['development', 'test', 'staging'])('with no explicit list, outside production (%s): the defaults, localhost and workers.dev previews pass', (environment) => {
    expect(allowedOrigin('https://app.hangulroute.com', undefined, environment)).toBe('https://app.hangulroute.com');
    expect(allowedOrigin('http://localhost:3000', undefined, environment)).toBe('http://localhost:3000');
    expect(allowedOrigin('http://127.0.0.1:4173', undefined, environment)).toBe('http://127.0.0.1:4173');
    expect(allowedOrigin('https://hangul-route-app.denny.workers.dev', undefined, environment)).toBe('https://hangul-route-app.denny.workers.dev');
    expect(allowedOrigin('https://evil.example', undefined, environment)).toBeNull();
    expect(allowedOrigin('https://evil.example/workers.dev', undefined, environment)).toBeNull();
    expect(allowedOrigin(undefined, undefined, environment)).toBeNull();
  });

  it.each(['production', 'development'])('with an explicit list only those origins pass, no localhost, no previews (%s)', (environment) => {
    expect(allowedOrigin('https://a.example', 'https://a.example', environment)).toBe('https://a.example');
    expect(allowedOrigin('http://localhost:3000', 'https://a.example', environment)).toBeNull();
    expect(allowedOrigin('https://x.workers.dev', 'https://a.example', environment)).toBeNull();
    expect(allowedOrigin('https://app.hangulroute.com', 'https://a.example', environment)).toBeNull();
  });

  it('an explicit list may name a preview host, which then passes in production', () => {
    const list = 'https://app.hangulroute.com, https://hangul-route-web.denny.workers.dev';
    expect(allowedOrigin('https://hangul-route-web.denny.workers.dev', list, 'production')).toBe('https://hangul-route-web.denny.workers.dev');
    expect(allowedOrigin('https://other.denny.workers.dev', list, 'production')).toBeNull();
  });
});

describe('authorizedPartiesFor: the token side of the same allow-list (F-APP-001 A-9)', () => {
  const explicit = 'https://hangulroute.com, https://app.hangulroute.com/';

  it('with no explicit list, outside production: the defaults, plus a local dev server or workers.dev preview that CORS lets in', () => {
    expect(authorizedPartiesFor(undefined, undefined, 'development')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor('  ', undefined, 'development')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, 'https://app.hangulroute.com', 'development')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, 'http://localhost:3000', 'development')).toEqual([...DEFAULT_ORIGINS, 'http://localhost:3000']);
    expect(authorizedPartiesFor(undefined, 'https://pr-12.hangul-route-web.denny.workers.dev', 'development')).toEqual([
      ...DEFAULT_ORIGINS,
      'https://pr-12.hangul-route-web.denny.workers.dev',
    ]);
  });

  it('never adds a party CORS would refuse', () => {
    expect(authorizedPartiesFor(undefined, 'https://evil.example', 'development')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, 'https://staging.hangulroute.com', 'development')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, '', 'development')).toEqual([...DEFAULT_ORIGINS]);
  });

  it('with no explicit list, in production: the defaults alone, whatever the token claims ([AU] AU-4)', () => {
    expect(authorizedPartiesFor(undefined, undefined, 'production')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, 'https://app.hangulroute.com', 'production')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor(undefined, 'http://localhost:3000', 'production')).toEqual([...DEFAULT_ORIGINS]);
    expect(authorizedPartiesFor('  ', 'https://attacker.workers.dev', 'production')).toEqual([...DEFAULT_ORIGINS]);
  });

  it.each(['production', 'development'])('with an explicit list: exactly that list, whatever the token claims (%s)', (environment) => {
    const list = ['https://hangulroute.com', 'https://app.hangulroute.com'];
    expect(authorizedPartiesFor(explicit, undefined, environment)).toEqual(list);
    expect(authorizedPartiesFor(explicit, 'https://app.hangulroute.com', environment)).toEqual(list);
    expect(authorizedPartiesFor(explicit, 'http://localhost:3000', environment)).toEqual(list);
    expect(authorizedPartiesFor(explicit, 'https://x.workers.dev', environment)).toEqual(list);
    expect(authorizedPartiesFor(explicit, 'https://www.hangulroute.com', environment)).toEqual(list);
  });

  it('returns a fresh array, so a caller cannot change the defaults', () => {
    const parties = authorizedPartiesFor(undefined, undefined, 'development');
    parties.push('https://evil.example');
    expect(authorizedPartiesFor(undefined, undefined, 'development')).toEqual([...DEFAULT_ORIGINS]);
  });
});
