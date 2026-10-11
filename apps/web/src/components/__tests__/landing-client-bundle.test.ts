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

function resolveLocal(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
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
      if (ref.typeOnly || !ref.spec.startsWith('.')) continue;
      const next = resolveLocal(file, ref.spec);
      if (next) queue.push(next);
    }
  }
  return seen;
}

const isDictionary = (spec: string): boolean => spec === '@hangul-route/i18n' || spec.startsWith('@hangul-route/i18n/src/');

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
