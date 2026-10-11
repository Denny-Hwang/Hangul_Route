import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ROMANIZATION_EXCEPTIONS, checkExceptions } from '../index';
import {
  REGISTERED_SOURCES,
  REPO_ROOT,
  ROMANIZATION_SCAN_IGNORE,
  coverageProblems,
  hangulFiles,
  isClassA,
  isIgnored,
  scannedFiles,
  seenExceptionKo,
} from './helpers/romanization-registry';

// F-CNT-002 PR 3 coverage check: the guard for "the validator only saw two files".
// A new Hangul-bearing file must be registered (or ignored with a reason) in the same PR.

const tmpRoots: string[] = [];
afterAll(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});
function tmpTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'romanization-cov-'));
  tmpRoots.push(root);
  for (const [name, body] of Object.entries(files)) {
    const full = join(root, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

describe('romanization coverage of Hangul-bearing files', () => {
  it('every Hangul-bearing file is registered, scanned as class A, or ignored with a reason', () => {
    expect(coverageProblems()).toEqual([]);
  });

  it('the walk finds the known Stage 1 sources', () => {
    const found = hangulFiles();
    for (const path of [
      'apps/mobile/src/content/heritage-cards.ts',
      'apps/mobile/src/content/jamo.ts',
      'apps/mobile/src/logic/minigame-config.ts',
      'apps/web/src/data/stage1-cards.ts',
      'content/episodes/stage-1/cards.json',
    ]) {
      expect(found).toContain(path);
    }
  });

  it('does not walk node_modules, .next, coverage or __tests__', () => {
    const files = scannedFiles();
    expect(files.some((f) => /(^|\/)(node_modules|\.next|coverage|__tests__)\//.test(f))).toBe(false);
  });

  it('registers each source once, ignores each path once, and never both', () => {
    const registered = REGISTERED_SOURCES.map((s) => s.path);
    expect(new Set(registered).size).toBe(registered.length);
    const ignored = ROMANIZATION_SCAN_IGNORE.map((e) => e.path);
    expect(new Set(ignored).size).toBe(ignored.length);
    expect(registered.filter((p) => isIgnored(p) !== undefined)).toEqual([]);
    expect(registered.filter((p) => isClassA(p))).toEqual([]);
  });

  it('handles the files added since PR 2b: spoken forms, vocabulary and story JSON', () => {
    // logic/stage1/spoken.ts holds Hangul only in comments now (the forms are on the jamo records)
    // and is ignored with that reason; logic/audio/spoken.ts holds none. Vocabulary and story JSON
    // are class A, scanned by romanization-content.test.ts.
    expect(isIgnored('apps/mobile/src/logic/stage1/spoken.ts')?.reason).toContain('jamo records');
    expect(hangulFiles()).not.toContain('apps/mobile/src/logic/audio/spoken.ts');
    expect(isClassA('content/vocab/food.json')).toBe(true);
    expect(isClassA('content/stories/hangul-day.json')).toBe(true);
    expect(isClassA('content/stories/research/records-joseon.final.json')).toBe(false);
  });
});

describe('romanization coverage check catches drift (temp-tree fixtures)', () => {
  it('fails on a new Hangul-bearing file outside the registry and names it', () => {
    const root = tmpTree({ 'apps/web/src/components/New.tsx': 'export const x = "안녕";' });
    const problems = coverageProblems(root);
    expect(problems.some((p) => p.includes('::error file=apps/web/src/components/New.tsx::romanization-coverage'))).toBe(true);
  });

  it('does not count isolated jamo, comments-free ASCII files or ignored paths', () => {
    const root = tmpTree({
      'apps/web/src/components/Jamo.tsx': 'export const j = "ㄱ";',
      'apps/web/src/components/Plain.tsx': 'export const p = "hello";',
      'packages/i18n/src/locales.ts': 'export const ko = "한국어";',
      'apps/web/src/components/__tests__/Skipped.test.tsx': 'x("안녕")',
    });
    expect(coverageProblems(root).filter((p) => p.includes('is not registered'))).toEqual([]);
  });

  it('fails when a registered file disappears', () => {
    const missing = coverageProblems(tmpTree({ 'content/README.md': 'x' })).filter((p) => p.includes('registered file is missing'));
    expect(missing.length).toBe(REGISTERED_SOURCES.length);
  });

  it('fails when a registered suite is missing or no longer mentions its file', () => {
    const [first] = REGISTERED_SOURCES;
    if (first === undefined) throw new Error('no registered sources');
    const root = tmpTree({ [first.path]: 'x', [first.suite]: 'nothing here' });
    const problems = coverageProblems(root);
    expect(problems.some((p) => p.includes(`suite does not mention "${first.needle}"`))).toBe(true);
    expect(problems.some((p) => p.includes('is missing'))).toBe(true);
  });

  it('fails on an ignore entry that matches nothing', () => {
    const problems = coverageProblems(tmpTree({ 'content/README.md': 'x' }));
    expect(problems.some((p) => p.includes('::error file=packages/i18n/src/format.ts::romanization-coverage: ignore entry matches nothing'))).toBe(true);
    expect(problems.some((p) => p.includes('file=*.md'))).toBe(false);
  });

  it('matches a suffix pattern ignore only when a file ends with it', () => {
    const problems = coverageProblems(tmpTree({ 'apps/web/src/x.ts': 'x' }));
    expect(problems.some((p) => p.includes('::error file=*.md::romanization-coverage: ignore entry matches nothing'))).toBe(true);
  });
});

describe('romanization exceptions are self-cleaning (R8)', () => {
  it('ships empty, so none is stale', () => {
    expect(ROMANIZATION_EXCEPTIONS).toEqual([]);
    expect(checkExceptions(ROMANIZATION_EXCEPTIONS, seenExceptionKo(ROMANIZATION_EXCEPTIONS))).toEqual([]);
  });

  it('flags an exception that matches no registered source or content file', () => {
    const exceptions = [{ ko: '꽃잎', allowed: ['kkonnip'], reason: 'n-insertion' }];
    expect(checkExceptions(exceptions, seenExceptionKo(exceptions))[0]?.rule).toBe('romanization-exception-stale');
  });

  it('accepts an exception whose Korean string is in a registered source', () => {
    const exceptions = [{ ko: '호랑이', allowed: ['horangi'], reason: 'test' }];
    expect(seenExceptionKo(exceptions)).toEqual(['호랑이']);
    expect(checkExceptions(exceptions, seenExceptionKo(exceptions))).toEqual([]);
  });
});

describe('romanization CI wiring (content-validation.yml)', () => {
  const workflow = readFileSync(join(REPO_ROOT, '.github/workflows/content-validation.yml'), 'utf8');
  const paths = [...workflow.matchAll(/^\s+- "([^"]+)"$/gm)].map((m) => m[1] as string);
  const toRegExp = (glob: string): RegExp =>
    new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')}$`);

  it('triggers on every registered source, so a change to one runs the suites', () => {
    const uncovered = REGISTERED_SOURCES.filter((s) => !paths.some((g) => toRegExp(g).test(s.path))).map((s) => s.path);
    expect(uncovered).toEqual([]);
    expect(paths).toEqual(expect.arrayContaining(['content/**', 'packages/content-schema/**', 'packages/backend/src/routes/content.ts']));
  });

  it('runs the romanization suites of mobile, web and backend', () => {
    for (const pkg of ['mobile', 'web', 'backend']) {
      expect(workflow).toContain(`pnpm --filter @hangul-route/${pkg} test -t romanization`);
    }
  });

  it('keeps F-CNT-001 unchanged: the structural validator still runs', () => {
    expect(workflow).toContain('node scripts/validate-content.mjs');
  });
});
