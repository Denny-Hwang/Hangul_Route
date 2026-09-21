import { describe, expect, it } from 'vitest';
import { DEFAULT_ORIGINS, allowedOrigin, parseAllowedOrigins } from '../cors';

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
