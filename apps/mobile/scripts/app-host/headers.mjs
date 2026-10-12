// The `_headers` rules of the app host (F-APP-001 sections 3.3 and 3.17, A-3).
//
// Workers static assets read `dist/_headers` (the Pages convention): a line without leading
// whitespace is a URL pattern (`*` a splat over any characters, `:name` one segment), each indented
// `Name: value` line under it a response header, an indented `! Name` line removes that header, `#`
// starts a comment. Matching rules apply in file order; a header that several of them set gets their
// values joined with ", ". Pure, no package import: merge-console.mjs writes the grown-up block with
// it, and scripts/serve-dist.mjs answers e2e requests with the same rules, so the merged build's
// headers are tested as Workers would send them.
import { PREFIX_SHAPE } from '../pwa/grown-ups.mjs';

/** Response headers of every grown-up path (section 3.17), in its order. */
export const GROWN_UP_HEADERS = [
  ['Cache-Control', 'no-store'],
  ['X-Frame-Options', 'DENY'],
  ['Content-Security-Policy', "frame-ancestors 'none'"],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
];

/** First line of the block merge-console.mjs appends; a dist that has it was merged already. */
export const GROWN_UP_HEADERS_MARKER = '# Grown-up pages (F-APP-001 section 3.17): appended by scripts/app-host/merge-console.mjs';

/**
 * The grown-up block of `dist/_headers`: the two patterns of section 3.17 per prefix (`/teach` and
 * `/teach/*`) plus its dotted names (`/teach.*`: the page's RSC payload `/teach.txt`, which R-1 counts
 * as a grown-up path too), each with every header of section 3.17. Grown-up pages are online-only and
 * never kept by a cache (`no-store`, which also keeps most browsers from putting them in the
 * back/forward cache), and never framed.
 *
 * @param {readonly string[]} prefixes GROWN_UP_PREFIXES of packages/content-schema
 * @returns {string}
 */
export function grownUpHeadersBlock(prefixes) {
  if (!Array.isArray(prefixes) || prefixes.length === 0) throw new Error('the grown-up prefix list is empty');
  for (const prefix of prefixes) {
    if (typeof prefix !== 'string' || !PREFIX_SHAPE.test(prefix)) {
      throw new Error(`grown-up prefix "${String(prefix)}" must be one lower-case path segment such as /teach`);
    }
  }
  const lines = [
    GROWN_UP_HEADERS_MARKER,
    '# Generated from GROWN_UP_PREFIXES (packages/content-schema): online-only, never cached, never framed.',
  ];
  for (const prefix of prefixes) {
    for (const pattern of [prefix, `${prefix}/*`, `${prefix}.*`]) {
      lines.push(pattern, ...GROWN_UP_HEADERS.map(([name, value]) => `  ${name}: ${value}`));
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {string} text the content of a `_headers` file
 * @returns {Array<{ pattern: string, headers: Array<[string, string | null]> }>} its rules, in file order;
 *   a `null` value is a detach (`! Name`)
 */
export function parseHeaders(text) {
  const rules = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trimEnd();
    if (line.trim() === '' || line.trim().startsWith('#')) return;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line, headers: [] });
      return;
    }
    const rule = rules[rules.length - 1];
    if (!rule) throw new Error(`_headers line ${index + 1}: a header before any pattern`);
    const detach = /^\s+!\s*([A-Za-z0-9-]+)$/.exec(line);
    if (detach) {
      rule.headers.push([detach[1], null]);
      return;
    }
    const colon = line.indexOf(':');
    const name = colon === -1 ? '' : line.slice(0, colon).trim();
    if (!/^[A-Za-z0-9-]+$/.test(name)) throw new Error(`_headers line ${index + 1}: "${line.trim()}" is not a "Name: value" header`);
    rule.headers.push([name, line.slice(colon + 1).trim()]);
  });
  return rules;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether a rule's pattern matches a request path: `*` is a splat over any characters, `:name` one segment. */
export function patternMatches(pattern, pathname) {
  const source = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => (part === '*' ? '.*' : part.startsWith(':') && part.length > 1 ? '[^/]+' : escapeRegExp(part)))
    .join('');
  return new RegExp(`^${source}$`).test(pathname);
}

/**
 * The headers the rules give a request path, by lower-case name: matching rules apply in file order, a
 * header set by several of them has their values joined with ", ", and a detach removes what came before.
 * @param {ReturnType<typeof parseHeaders>} rules
 * @param {string} pathname
 * @returns {Record<string, string>}
 */
export function headersFor(rules, pathname) {
  const out = {};
  for (const rule of rules) {
    if (!patternMatches(rule.pattern, pathname)) continue;
    for (const [name, value] of rule.headers) {
      const key = name.toLowerCase();
      if (value === null) delete out[key];
      else out[key] = key in out ? `${out[key]}, ${value}` : value;
    }
  }
  return out;
}

/** Console files that are not there, one per kind Next writes: what the single-page fallback answers with index.html. */
const MISSING_CONSOLE_FILES = [
  '/_next/static/chunks/hr-missing-chunk.js',
  '/_next/static/css/hr-missing.css',
  '/_next/static/media/hr-missing.woff2',
  '/_next/static/hr-missing-build/_buildManifest.js',
  '/_next/hr-missing',
];

/** A Cache-Control value that lets a browser keep the answer: `immutable`, or a positive `max-age` / `s-maxage`. */
const KEEPS = (value) => /\bimmutable\b/i.test(value) || /\b(?:max-age|s-maxage)\s*=\s*"?0*[1-9]/i.test(value);

/** Whether a header lets a browser keep the answer: such a Cache-Control, or any `Expires`. */
const keepsAnswer = ([name, value]) => {
  if (value === null) return false;
  const key = name.toLowerCase();
  return (key === 'cache-control' && KEEPS(value)) || key === 'expires';
};

/** The path part of a pattern: Workers also accept absolute URLs (`https://app.hangulroute.com/_next/*`). */
const pathOf = (pattern) => (/^https?:\/\//i.test(pattern) ? pattern.replace(/^https?:\/\/[^/]*/i, '') || '/' : pattern);

/**
 * Patterns that would let a browser keep a missing `/_next/` file. On this Worker the single-page fallback
 * answers such a miss with `index.html` (200, `text/html`), so a long rule there would let a browser keep
 * that page under the chunk URL (section 3.3, 2026-10-12 amendment). A rule counts when its pattern (by its
 * path, for an absolute URL) is under `/_next/` or matches a missing console file, and it sets `Expires` or a
 * Cache-Control that keeps the answer.
 * @param {ReturnType<typeof parseHeaders>} rules
 * @returns {string[]}
 */
export function longCacheConsoleRules(rules) {
  return rules
    .filter((rule) => {
      const path = pathOf(rule.pattern);
      return path.startsWith('/_next/') || MISSING_CONSOLE_FILES.some((file) => patternMatches(path, file));
    })
    .filter((rule) => rule.headers.some(keepsAnswer))
    .map((rule) => rule.pattern);
}
