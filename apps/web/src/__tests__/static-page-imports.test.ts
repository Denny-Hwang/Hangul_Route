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
 * A test that resets the registry on purpose imports by a variable path (landing-no-emoji's en-XA check), so it
 * is not matched here.
 */

const SRC = join(__dirname, '..');

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : testFiles(path);
    return /\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const PAGE_IMPORT = /await import\(\s*['"]@\/app\//;

describe('web tests import page modules at the top of the file', () => {
  it('finds the test files to check', () => {
    expect(testFiles(SRC).length).toBeGreaterThan(50);
  });

  it('no test file loads a page with an in-test await import', () => {
    const offenders = testFiles(SRC)
      .filter((path) => path !== __filename)
      .filter((path) => PAGE_IMPORT.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path));
    expect(offenders).toEqual([]);
  });

  it('the pattern matches the in-test form it guards against', () => {
    expect(PAGE_IMPORT.test("const { default: Page } = await import('@/app/(console)/teach/space/notes/page');")).toBe(true);
    expect(PAGE_IMPORT.test("import Page from '@/app/(console)/teach/space/notes/page';")).toBe(false);
  });
});
