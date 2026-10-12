import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The landing's client code must not load the UI dictionary (F-I18N-001 PR 11a review). A value import
 * from `@hangul-route/i18n` pulls in resolve.ts and with it every locale's messages, the Privacy and Terms
 * text, content-schema and zod: about 40 KB gzip on hangulroute.com for a form of ten strings. The server
 * page passes the words as props instead, and the client files import only types from the package.
 *
 * This walks the relative-import graph of every 'use client' file under components/landing and fails on a
 * value import (or re-export) from the package anywhere in it.
 *
 * The same holds for `@hangul-route/content-schema`: its barrel has no `sideEffects: false` and builds zod
 * schemas at module level, so one value import ships all of it. `lib/site-links.ts` (F-SITE-002 §3.8) reads
 * `APP_ROUTES` from it, so the site calls it in server components and hands the href strings to client
 * components as props. The second block finds every client component the site's pages reach (app/(en),
 * app/(loc), components/landing) and fails on such a value import anywhere in its graph.
 */
const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const landingDir = join(webSrc, 'components', 'landing');

const IMPORT = /^\s*(import|export)\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

interface ImportRef {
  typeOnly: boolean;
  spec: string;
}

function importsOf(source: string): ImportRef[] {
  const out: ImportRef[] = [];
  for (const match of source.matchAll(IMPORT)) out.push({ typeOnly: match[2] !== undefined, spec: match[3] ?? '' });
  return out;
}

/** A relative specifier, or the app's `@/` alias for `src/` (tsconfig `paths`). */
const isLocal = (spec: string): boolean => spec.startsWith('.') || spec.startsWith('@/');

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(webSrc, spec.slice(2)) : resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && !candidate.endsWith('/') && /\.tsx?$/.test(candidate)) return candidate;
  }
  return null;
}

const isClient = (source: string): boolean => /^\s*['"]use client['"]/.test(source);

function clientGraph(entries: readonly string[]): Map<string, ImportRef[]> {
  const seen = new Map<string, ImportRef[]>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    const refs = importsOf(readFileSync(file, 'utf8'));
    seen.set(file, refs);
    for (const ref of refs) {
      if (ref.typeOnly || !isLocal(ref.spec)) continue;
      const next = resolveLocal(file, ref.spec);
      if (next) queue.push(next);
    }
  }
  return seen;
}

const isDictionary = (spec: string): boolean => spec === '@hangul-route/i18n' || spec.startsWith('@hangul-route/i18n/src/');
const isSchemaBarrel = (spec: string): boolean =>
  spec === '@hangul-route/content-schema' || spec.startsWith('@hangul-route/content-schema/src/');

/** Every source file under `dir`, tests excluded. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...sourcesUnder(path));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

describe('landing client bundle never loads the UI dictionary', () => {
  const entries = readdirSync(landingDir)
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => join(landingDir, name))
    .filter((file) => isClient(readFileSync(file, 'utf8')));
  const graph = clientGraph(entries);

  it('finds the client form and the modules it imports', () => {
    const files = [...graph.keys()].map((file) => relative(webSrc, file));
    expect(files).toContain(join('components', 'landing', 'WaitlistForm.tsx'));
    expect(files).toContain(join('lib', 'waitlist.ts'));
  });

  for (const [file, refs] of graph) {
    it(`${relative(webSrc, file)} imports only types from @hangul-route/i18n`, () => {
      const valueImports = refs.filter((ref) => isDictionary(ref.spec) && !ref.typeOnly).map((ref) => ref.spec);
      expect(valueImports).toEqual([]);
    });
  }

  it('the scanner tells a value import from a type import (self-check)', () => {
    const refs = importsOf("import { getMessages } from '@hangul-route/i18n';\nimport type { Messages } from '@hangul-route/i18n';\nexport { en } from '@hangul-route/i18n';");
    expect(refs).toEqual([
      { typeOnly: false, spec: '@hangul-route/i18n' },
      { typeOnly: true, spec: '@hangul-route/i18n' },
      { typeOnly: false, spec: '@hangul-route/i18n' },
    ]);
  });
});

describe('client code the site reaches never loads the content-schema barrel', () => {
  const siteRoots = [join(webSrc, 'app', '(en)'), join(webSrc, 'app', '(loc)'), landingDir];
  // Server pages and layouts first, then every 'use client' module they reach: each one starts a client bundle.
  const reached = clientGraph(siteRoots.flatMap(sourcesUnder));
  const clientEntries = [...reached.keys()].filter((file) => isClient(readFileSync(file, 'utf8')));
  const graph = clientGraph(clientEntries);

  it('finds the site pages and the client components they reach', () => {
    const pages = [...reached.keys()].map((file) => relative(webSrc, file));
    expect(pages).toContain(join('app', '(en)', 'page.tsx'));
    const files = [...graph.keys()].map((file) => relative(webSrc, file));
    expect(files).toContain(join('components', 'landing', 'WaitlistForm.tsx'));
  });

  for (const [file, refs] of graph) {
    it(`${relative(webSrc, file)} imports only types from @hangul-route/content-schema`, () => {
      const valueImports = refs.filter((ref) => isSchemaBarrel(ref.spec) && !ref.typeOnly).map((ref) => ref.spec);
      expect(valueImports).toEqual([]);
    });
  }

  it('would catch a client component that imports lib/site-links (self-check)', () => {
    const siteLinks = join(webSrc, 'lib', 'site-links.ts');
    const offenders = [...clientGraph([siteLinks])]
      .filter(([, refs]) => refs.some((ref) => isSchemaBarrel(ref.spec) && !ref.typeOnly))
      .map(([file]) => relative(webSrc, file));
    expect(offenders).toContain(join('lib', 'site-links.ts'));
  });

  it('follows the @/ alias as well as relative paths (self-check)', () => {
    const from = join(webSrc, 'app', '(en)', 'page.tsx');
    expect(resolveLocal(from, '@/lib/site-links')).toBe(join(webSrc, 'lib', 'site-links.ts'));
    expect(resolveLocal(from, '../../lib/site-links')).toBe(join(webSrc, 'lib', 'site-links.ts'));
  });
});
