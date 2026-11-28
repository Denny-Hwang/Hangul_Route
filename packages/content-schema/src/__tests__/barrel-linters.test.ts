import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as barrel from '../index';
import * as lint from '../lesson-lint';
import * as romanizationLint from '../romanization/lint';
import * as storyLint from '../story-lint';

/**
 * AMENDMENTS-FINISH-2026-11 FN-7 (finding F4): the learner app's start bundle carries the package barrel whole (Metro does
 * not drop unused exports), so the content linters, which only the validators, the tests and the console's scene sheet
 * run, are not in it: `story-lint` is the `./story-lint` subpath and `lesson-cell-lint` rides in `./lint`. No module the
 * barrel reaches imports them either.
 */

const SRC = join(__dirname, '..');
const LINTERS = ['story-lint.ts', 'lesson-cell-lint.ts'].map((f) => join(SRC, f));

/** Every file of the package the module reaches through runtime imports (type-only imports are erased). */
function reach(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of text.matchAll(/(?:^|[;\n}])\s*(?:import|export)\s+(type\s+)?[^;'"]*?\s*from\s*['"](\.[^'"]+)['"]/g)) {
      if (m[1] !== undefined) continue;
      const base = resolve(dirname(file), m[2] as string);
      const target = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), base].find((c) => /\.tsx?$/.test(c) && existsSync(c));
      if (target !== undefined) queue.push(target);
    }
  }
  return seen;
}

describe('the content linters stay out of the package barrel (FN-7)', () => {
  it('the barrel exports none of them', () => {
    for (const name of ['lintStory', 'lintStoryCorpus', 'copiedRun', 'designationNumberIn', 'lintLessonCell', 'lintLessonNotes', 'isLessonPublicHost']) {
      expect(name in barrel, name).toBe(false);
    }
  });

  it('no module the barrel reaches imports them', () => {
    const reached = reach(join(SRC, 'index.ts'));
    expect(reached.size).toBeGreaterThan(100);
    for (const linter of LINTERS) expect(reached.has(linter), linter).toBe(false);
  });

  it('their readers find them on the subpaths', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as { exports: Record<string, string> };
    expect(pkg.exports['./story-lint']).toBe('./src/story-lint.ts');
    expect(pkg.exports['./lint']).toBe('./src/lesson-lint.ts');
    expect(typeof storyLint.lintStory).toBe('function');
    expect(typeof storyLint.lintStoryCorpus).toBe('function');
    expect(typeof lint.lintLessonCell).toBe('function');
  });
});

/**
 * AMENDMENTS-START-BUNDLE-2026-11 SB-4a: the romanization lint (the checker, the detectors, the extractors, the finding formatter
 * and the reviewed entries' notes) is the `./romanization-lint` subpath. The converter, the reviewed values and the jamo sound
 * values stay on the barrel, which the learner app's start bundle carries whole.
 */
describe('the romanization lint stays out of the package barrel (SB-4a)', () => {
  const LINT_FILES = ['compare.ts', 'extract.ts', 'gaps.ts', 'report.ts', 'exception-notes.ts'].map((f) => join(SRC, 'romanization', f));
  /** Every runtime name the barrel exported before SB-4a from those files and from `exceptions.ts` (JAMO_NAME_VALUES). */
  const MOVED = [
    'normalizeRomanization',
    'checkRomanization',
    'checkFrameRomanization',
    'checkExceptions',
    'checkConsistency',
    'checkProse',
    'checkJamoRomanization',
    'extractProsePairs',
    'extractKoreanPairs',
    'ROMANIZATION_GAPS',
    'GAP_ARTICLES',
    'N_INSERTION_HEADS',
    'N_INSERTION_WORDS',
    'JUNCTURE_HEADS',
    'JUNCTURE_PREFIXES',
    'GRAMMATICAL_TAILS',
    'COPULA_STEMS',
    'COPULA_FORMS',
    'detectGaps',
    'formatRomanizationFinding',
    'lineOfText',
    'JAMO_NAME_VALUES',
    'ROMANIZATION_EXCEPTION_NOTES',
    'entryWithNote',
  ];
  /** What `romanizeReviewed` and the app read: on the barrel, and (`HADA_BLOCKS`) on the subpath too. */
  const STAYING = ['ROMANIZATION_EXCEPTIONS', 'JAMO_SOUND_VALUES', 'romanizeReviewed', 'wholeEntryKey', 'romanize', 'romanizeWord', 'koTokens', 'syllableSplit', 'HADA_BLOCKS'];

  it('every moved name is on the subpath and none on the barrel; the names that stay are on the barrel', () => {
    for (const name of MOVED) {
      expect(name in romanizationLint, `${name} on the subpath`).toBe(true);
      expect(name in barrel, `${name} off the barrel`).toBe(false);
    }
    for (const name of STAYING) expect(name in barrel, `${name} on the barrel`).toBe(true);
    expect(romanizationLint.HADA_BLOCKS).toBe(barrel.HADA_BLOCKS);
  });

  it('no module the barrel reaches imports a lint module, and rr.ts does not reach gaps.ts', () => {
    const reached = reach(join(SRC, 'index.ts'));
    for (const file of LINT_FILES) expect(reached.has(file), file).toBe(false);
    expect(reach(join(SRC, 'romanization', 'rr.ts')).has(join(SRC, 'romanization', 'gaps.ts'))).toBe(false);
    expect(reach(join(SRC, 'romanization', 'reviewed.ts')).has(join(SRC, 'romanization', 'exception-notes.ts'))).toBe(false);
  });

  it('the subpath is in package.json and reaches the five lint modules', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as { exports: Record<string, string> };
    expect(pkg.exports['./romanization-lint']).toBe('./src/romanization/lint.ts');
    const reached = reach(join(SRC, 'romanization', 'lint.ts'));
    for (const file of LINT_FILES) expect(reached.has(file), file).toBe(true);
  });
});
