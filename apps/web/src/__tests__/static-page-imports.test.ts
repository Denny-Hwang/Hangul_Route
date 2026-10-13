import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Test reliability guard (follow-up to #431). A page module under `src/app` pulls in the whole page graph
 * (i18n dictionaries, content-schema, design-system, the console hooks). An `await import('@/app/...')` inside a
 * test body or helper loads that graph the first time a test runs, and the load counts against the 5 s per-test
 * timeout: under a parallel `turbo run test:coverage` it took over 5 s and the first test of notes-page,
 * report-page-wiring and learning-route-page-wiring timed out. A top-level import loads the same graph during file
 * collection, which has no per-test timeout, and gives the same module instance (none of these files resets the
 * module registry), with the hoisted `vi.mock` calls still applied.
 *
 * The guard matches any dynamic import of a page module, awaited or not (a lazy thunk or `.then` loads the same
 * graph inside the test), by the `@/app/` alias or by a relative path ending in `page`. A test that resets the
 * registry on purpose imports by a variable path (landing-no-emoji's en-XA check), so it is not matched here.
 * The allowlist below names the only files that load pages lazily on purpose, each with its reason.
 */

const SRC = join(__dirname, '..');

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : testFiles(path);
    return /\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * A dynamic import whose specifier is a page module: the `@/app/` alias, or a relative path whose last segment is
 * `page` (with or without a `.ts`/`.tsx` extension). Quoted or template-literal specifiers both count. A type-only
 * `typeof import('...')` loads nothing at runtime, so it is skipped. Group 1 is the specifier.
 */
const PAGE_IMPORT = /(?<!typeof\s*)\bimport\(\s*['"`]((?:@\/app\/[^'"`]*|(?:\.\.?\/)+[^'"`]*\bpage(?:\.tsx?)?))['"`]/g;

function pageImports(source: string): string[] {
  return Array.from(source.matchAll(PAGE_IMPORT), (match) => match[1] ?? '');
}

function isPageImport(source: string): boolean {
  return pageImports(source).length > 0;
}

/**
 * Files that load some pages lazily on purpose, each with the only specifiers it may load that way.
 * landing-locales maps each marketing route to a lazy page loader so a table-driven test renders the en and
 * localized page of the same route. The marketing pages under `(en)` and `(loc)` are static and light (no console
 * hooks), so their load stays inside the 5 s budget. Any other lazy page import in that file still fails.
 */
const ALLOWED: ReadonlyMap<string, RegExp> = new Map([
  ['app/__tests__/landing-locales.test.tsx', /^\.\.\/\((?:en|loc)\)\//],
]);

describe('web tests import page modules at the top of the file', () => {
  it('finds the test files to check', () => {
    expect(testFiles(SRC).length).toBeGreaterThan(50);
  });

  it('no test file loads a page with an in-test dynamic import', () => {
    const offenders = testFiles(SRC)
      .filter((path) => path !== __filename)
      .flatMap((path) => {
        const rel = relative(SRC, path).split('\\').join('/');
        const allowed = ALLOWED.get(rel);
        return pageImports(readFileSync(path, 'utf8'))
          .filter((specifier) => !allowed?.test(specifier))
          .map((specifier) => `${rel}: ${specifier}`);
      });
    expect(offenders).toEqual([]);
  });

  it('the pattern matches the in-test forms it guards against', () => {
    expect(isPageImport("const { default: Page } = await import('@/app/(console)/teach/space/notes/page');")).toBe(true);
    expect(isPageImport("const load = () => import('@/app/(console)/teach/space/notes/page');")).toBe(true);
    expect(isPageImport("const { default: Page } = await import('../page');")).toBe(true);
    expect(isPageImport("import('../../app/(en)/about/page').then((m) => m.default);")).toBe(true);
    expect(isPageImport('const { default: Page } = await import(`@/app/(console)/teach/space/page`);')).toBe(true);
    expect(isPageImport("const { default: Page } = await import('../page.tsx');")).toBe(true);
  });

  it('the pattern lets top-level imports and non-page modules through', () => {
    expect(isPageImport("import Page from '@/app/(console)/teach/space/notes/page';")).toBe(false);
    expect(isPageImport("import Page from '../page';")).toBe(false);
    expect(isPageImport("const actual = await import('../pager-utils');")).toBe(false);
    expect(isPageImport("const catalog = await import('@hangul-route/i18n');")).toBe(false);
    expect(isPageImport("const actual = await importOriginal<typeof import('@/app/(console)/teach/space/page')>();")).toBe(
      false,
    );
  });

  it('the landing-locales exemption covers only the marketing pages', () => {
    const allowed = ALLOWED.get('app/__tests__/landing-locales.test.tsx');
    expect(allowed?.test('../(en)/about/page')).toBe(true);
    expect(allowed?.test('../(loc)/[locale]/about/page')).toBe(true);
    expect(allowed?.test('@/app/(console)/teach/space/page')).toBe(false);
    expect(allowed?.test('../(console)/teach/space/page')).toBe(false);
  });

  it('every allowlisted file still exists and still needs its exemption', () => {
    for (const [path, allowed] of ALLOWED) {
      const specifiers = pageImports(readFileSync(join(SRC, path), 'utf8'));
      expect(specifiers.some((specifier) => allowed.test(specifier))).toBe(true);
    }
  });
});
