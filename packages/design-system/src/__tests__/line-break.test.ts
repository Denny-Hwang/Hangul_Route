import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KOREAN_LINE_BREAK, textTagsWithoutLineBreak } from '../line-break';

/**
 * Native Korean line breaking (F-I18N-001 §10 reason (5), row 16b). The web wraps `:lang(ko)` at spaces in CSS;
 * the native iOS build needs `lineBreakStrategyIOS: 'hangul-word'` on each `Text`, or Korean breaks inside a word
 * ("처음부 / 터"). Every `Text` the design system draws spreads `KOREAN_LINE_BREAK`.
 */
const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '..', 'components');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('KOREAN_LINE_BREAK', () => {
  it("keeps a Korean word whole on iOS (NSLineBreakStrategyHangulWordPriority)", () => {
    expect(KOREAN_LINE_BREAK).toEqual({ lineBreakStrategyIOS: 'hangul-word' });
  });

  it('is frozen, so no caller can change it for every other Text', () => {
    expect(Object.isFrozen(KOREAN_LINE_BREAK)).toBe(true);
  });
});

describe('textTagsWithoutLineBreak', () => {
  it('flags a Text opening tag that does not spread KOREAN_LINE_BREAK', () => {
    expect(textTagsWithoutLineBreak('<Text style={s}>hi</Text>')).toEqual(['<Text style={s}>']);
    expect(textTagsWithoutLineBreak('<Text\n  testID="a"\n  style={[a, b]}\n>')).toHaveLength(1);
  });

  it('lets a tag through that spreads it, on one line or many', () => {
    expect(textTagsWithoutLineBreak('<Text {...KOREAN_LINE_BREAK} style={s}>hi</Text>')).toEqual([]);
    expect(textTagsWithoutLineBreak('<Text\n  {...KOREAN_LINE_BREAK}\n  style={{ a: b > c ? 1 : 2 }}\n>')).toEqual([]);
  });

  it('ignores other components and closing tags', () => {
    expect(textTagsWithoutLineBreak('<TextInput value={v} /></Text><KoreanText text="가" />')).toEqual([]);
  });
});

describe('every Text in the design system', () => {
  const files = sources(componentsDir).filter((path) => /<Text\b/.test(readFileSync(path, 'utf8')));

  it('there are Text-drawing components to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files.map((path) => relative(componentsDir, path).split(sep).join('/')))('%s spreads KOREAN_LINE_BREAK on each Text', (file) => {
    expect(textTagsWithoutLineBreak(readFileSync(join(componentsDir, file), 'utf8'))).toEqual([]);
  });
});
