import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The learner PWA still opens on iOS 14 and Safari 15.0-15.3, and the package
 * root is in the startup bundle of every screen (Metro does not tree-shake;
 * babel-preset-expo adds no polyfills and the repo has no core-js). A built-in
 * those browsers lack throws as soon as the module that calls it loads, and the
 * whole app never opens. This scan keeps them out of every non-test source of
 * the design system: `Object.hasOwn`, `Array.prototype.at`, `findLast`,
 * `structuredClone`, the change-array-by-copy methods and `Object.groupBy`
 * (all Safari 15.4 or later). Use `Object.prototype.hasOwnProperty.call(o, k)`
 * and `a[a.length - 1]` instead.
 */

const SRC = join(__dirname, '..');
const SKIP_DIRS = new Set(['__tests__', '__golden__', 'node_modules']);

export const LEGACY_SAFARI_MISSING: ReadonlyArray<readonly [string, RegExp]> = [
  ['Object.hasOwn', /\bObject\s*\.\s*hasOwn\s*\(/],
  ['.at()', /(?<![.\w$])\s*\.at\s*\(|(?<=[\w$)\]])\.at\s*\(/],
  ['.findLast()', /\.findLast(?:Index)?\s*\(/],
  ['structuredClone', /\bstructuredClone\s*\(/],
  ['.toSorted() / .toReversed() / .toSpliced()', /\.to(?:Sorted|Reversed|Spliced)\s*\(/],
  ['Object.groupBy', /\b(?:Object|Map)\s*\.\s*groupBy\s*\(/],
];

/** The built-ins in `source` that iOS 14 and Safari 15.0-15.3 lack. */
export function legacySafariMissing(source: string): string[] {
  return LEGACY_SAFARI_MISSING.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : sources(path);
    return /\.(?:[cm]?[jt]s|[jt]sx)$/.test(name) && !/\.test\.[jt]sx?$/.test(name) ? [path] : [];
  });
}

describe('legacySafariMissing', () => {
  it.each([
    ['if (Object.hasOwn(out, key)) return;', 'Object.hasOwn'],
    ['const last = items.at(-1);', '.at()'],
    ['const last = rows[0].at(-1);', '.at()'],
    ['const last = list().at(0);', '.at()'],
    ['const hit = items.findLast((x) => x);', '.findLast()'],
    ['const i = items.findLastIndex((x) => x);', '.findLast()'],
    ['const copy = structuredClone(value);', 'structuredClone'],
    ['const sorted = items.toSorted();', '.toSorted() / .toReversed() / .toSpliced()'],
    ['const groups = Object.groupBy(items, (x) => x.kind);', 'Object.groupBy'],
  ])('flags %s', (source, name) => {
    expect(legacySafariMissing(source)).toEqual([name]);
  });

  it.each([
    'Object.prototype.hasOwnProperty.call(out, key)',
    "head: { view: 'body', ...at(0, -82), r: 15 },",
    'const at = (x: number) => x;',
    'items[items.length - 1]',
    "const label = 'look at (this)';",
  ])('lets %s through', (source) => {
    expect(legacySafariMissing(source)).toEqual([]);
  });
});

describe('the design system loads on iOS 14 and Safari 15.0-15.3', () => {
  it('no non-test source calls a built-in those browsers lack', () => {
    const offenders = sources(SRC)
      .map((file) => ({ file: relative(SRC, file).split(sep).join('/'), found: legacySafariMissing(readFileSync(file, 'utf8')) }))
      .filter(({ found }) => found.length > 0);
    expect(offenders).toEqual([]);
  });
});
