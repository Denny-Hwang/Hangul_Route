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

const PAGE_IMPORT = /\bimport\(\s*['"](?:@\/app\/|(?:\.\.?\/)+[^'"]*\bpage['"])/;

/**
 * landing-locales maps each marketing route to a lazy page loader so a table-driven test renders the en and
 * localized page of the same route. The marketing pages are static and light (no console hooks), so their load
 * stays well inside the 5 s budget.
 */
const ALLOWED = new Set(['app/__tests__/landing-locales.test.tsx']);

describe('web tests import page modules at the top of the file', () => {
  it('finds the test files to check', () => {
    expect(testFiles(SRC).length).toBeGreaterThan(50);
  });

  it('no test file loads a page with an in-test dynamic import', () => {
    const offenders = testFiles(SRC)
      .filter((path) => path !== __filename)
      .filter((path) => PAGE_IMPORT.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path).split('\\').join('/'))
      .filter((path) => !ALLOWED.has(path));
    expect(offenders).toEqual([]);
  });

  it('the pattern matches the in-test forms it guards against', () => {
    expect(PAGE_IMPORT.test("const { default: Page } = await import('@/app/(console)/teach/space/notes/page');")).toBe(true);
    expect(PAGE_IMPORT.test("const load = () => import('@/app/(console)/teach/space/notes/page');")).toBe(true);
    expect(PAGE_IMPORT.test("const { default: Page } = await import('../page');")).toBe(true);
    expect(PAGE_IMPORT.test("import('../../app/(en)/about/page').then((m) => m.default);")).toBe(true);
  });

  it('the pattern lets top-level imports and non-page modules through', () => {
    expect(PAGE_IMPORT.test("import Page from '@/app/(console)/teach/space/notes/page';")).toBe(false);
    expect(PAGE_IMPORT.test("import Page from '../page';")).toBe(false);
    expect(PAGE_IMPORT.test("const actual = await import('../pager-utils');")).toBe(false);
    expect(PAGE_IMPORT.test("const catalog = await import('@hangul-route/i18n');")).toBe(false);
  });

  it('every allowlisted file still exists and still needs its exemption', () => {
    for (const path of ALLOWED) {
      expect(PAGE_IMPORT.test(readFileSync(join(SRC, path), 'utf8'))).toBe(true);
    }
  });
});
