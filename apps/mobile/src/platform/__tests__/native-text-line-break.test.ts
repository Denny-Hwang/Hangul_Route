import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeTextTagNames, textTagsWithoutLineBreak } from '@hangul-route/design-system/line-break';
import { describe, expect, it } from 'vitest';

/**
 * Native Korean line breaking in the learner app (F-I18N-001 §10 reason (5), row 16b). On iOS a `Text` without
 * `lineBreakStrategyIOS: 'hangul-word'` breaks Korean between two syllables of one word ("처음부 / 터"), so every
 * React Native `Text` the app draws (`Text`, an aliased import, `Animated.Text`) spreads `KOREAN_LINE_BREAK` from
 * `@hangul-route/design-system`, as the design system's own components do (`packages/design-system/src/__tests__/
 * line-break.test.ts`). A `Text` from `react-native-svg` is not native text and is not checked.
 */
const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === '__generated__' ? [] : sources(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

const files = sources(srcDir)
  .map((path) => ({ file: relative(srcDir, path).split(sep).join('/'), source: readFileSync(path, 'utf8') }))
  .filter(({ source }) => nativeTextTagNames(source).length > 0);

describe('every native Text in the learner app', () => {
  it('there are Text-drawing screens to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(50);
  });

  it.each(files.map(({ file }) => file))('%s spreads KOREAN_LINE_BREAK on each Text', (file) => {
    const { source } = files.find((f) => f.file === file)!;
    expect(textTagsWithoutLineBreak(source, nativeTextTagNames(source))).toEqual([]);
  });
});
