// The `_headers` rules of the app host (F-APP-001 sections 3.3 and 3.17, A-3).
//
// Workers static assets read `dist/_headers` (the Pages convention): a line without leading
// whitespace is a URL pattern (`*` a splat over any characters, `:name` one segment), each indented
// `Name: value` line under it a response header, `#` a comment. When several rules match, a header
// they share gets their values joined with ", ". Pure and dependency-free: merge-console.mjs writes
// the grown-up block with it, and scripts/serve-dist.mjs answers e2e requests with the same rules,
// so the merged build's headers are tested as Workers would send them.

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

/** One plain lower-case segment (`/teach`), the shape GROWN_UP_PREFIXES has and scripts/pwa/grown-ups.mjs requires. */
const PREFIX_SHAPE = /^\/[a-z][a-z0-9-]*$/;

/**
 * The grown-up block of `dist/_headers`: two patterns per prefix (`/teach` and `/teach/*`), each with
 * every header of section 3.17. Grown-up pages are online-only and never kept by a cache (`no-store`, which
 * also keeps most browsers from putting them in the back/forward cache), and never framed.
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
    for (const pattern of [prefix, `${prefix}/*`]) {
      lines.push(pattern, ...GROWN_UP_HEADERS.map(([name, value]) => `  ${name}: ${value}`));
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {string} text the content of a `_headers` file
 * @returns {Array<{ pattern: string, headers: Array<[string, string]> }>} its rules, in file order
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
 * The headers the rules give a request path, by lower-case name; a header set by several matching rules
 * has their values joined with ", " in file order.
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
      out[key] = key in out ? `${out[key]}, ${value}` : value;
    }
  }
  return out;
}

/** A file that is not there: what the single-page fallback answers with index.html. */
const MISSING_CONSOLE_FILE = '/_next/static/chunks/hr-missing-chunk.js';

/**
 * Patterns that would give a missing `/_next/` file a year-long cache. On this Worker the single-page
 * fallback answers such a miss with `index.html` (200, `text/html`), so an `immutable` rule there would let a
 * browser keep that page under the chunk URL for a year (section 3.3, 2026-10-12 amendment).
 * @param {ReturnType<typeof parseHeaders>} rules
 * @returns {string[]}
 */
export function immutableConsoleRules(rules) {
  return rules
    .filter((rule) => patternMatches(rule.pattern, MISSING_CONSOLE_FILE))
    .filter((rule) => rule.headers.some(([name, value]) => name.toLowerCase() === 'cache-control' && /\bimmutable\b/i.test(value)))
    .map((rule) => rule.pattern);
}
