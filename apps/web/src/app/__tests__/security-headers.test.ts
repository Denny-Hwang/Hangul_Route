import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-5 (audit SEC-3): `public/_headers` sends the five baseline security headers for
 * every path of the site. Workers static assets merge the rules that match a path and join the values of a header
 * two of them set ("nosniff, nosniff"), so no other rule may set one of the five.
 */
const HEADERS_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', '_headers');

const BASELINE: Array<[string, string]> = [
  ['Strict-Transport-Security', 'max-age=31536000'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['Content-Security-Policy', "frame-ancestors 'self'"],
];

interface Rule {
  pattern: string;
  headers: Array<[string, string]>;
}

/** The rules of a `_headers` text: a line without leading whitespace is a pattern, each indented line under it a header. */
function parseRules(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line, headers: [] });
      continue;
    }
    const colon = line.indexOf(':');
    rules[rules.length - 1]?.headers.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
  }
  return rules;
}

describe('apps/web public/_headers: baseline security headers', () => {
  const rules = parseRules(readFileSync(HEADERS_FILE, 'utf8'));

  it('has one /* rule, and it sets exactly the five headers', () => {
    expect(rules.filter((rule) => rule.pattern === '/*')).toEqual([{ pattern: '/*', headers: BASELINE }]);
  });

  it('no other rule sets one of the five, so none is sent with two joined values', () => {
    const names = new Set(BASELINE.map(([name]) => name.toLowerCase()));
    for (const rule of rules.filter((r) => r.pattern !== '/*')) {
      expect(rule.headers.map(([name]) => name.toLowerCase()).filter((name) => names.has(name)), rule.pattern).toEqual([]);
    }
  });

  it('sets no script-source policy yet (it needs a report-only period first)', () => {
    const csp = rules.flatMap((rule) => rule.headers).filter(([name]) => name.toLowerCase().startsWith('content-security-policy'));
    expect(csp).toEqual([['Content-Security-Policy', "frame-ancestors 'self'"]]);
  });

  it('keeps the cache rules', () => {
    const cache = (pattern: string) => rules.find((rule) => rule.pattern === pattern)?.headers;
    expect(cache('/_next/static/*')).toEqual([['Cache-Control', 'public, max-age=31536000, immutable']]);
    expect(cache('/site/captures/*')).toEqual([['Cache-Control', 'public, max-age=31536000, immutable']]);
  });
});
