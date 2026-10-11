import { readFileSync } from 'node:fs';
import { checkRomanization, extractKoreanPairs } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';

// F-CNT-002 PR 2b: the inline Korean strings in the landing and design-preview pages are
// Revised Romanization. (The repo-wide, registered version of this check is PR 3.)
const FILES = [
  'components/landing/MeetHoya.tsx',
  'app/design-preview/page.tsx',
  'app/design-preview/cards/page.tsx',
  'app/design-preview/components/page.tsx',
];
const read = (rel: string): string => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

describe('inline page romanization (F-CNT-002)', () => {
  it.each(FILES)('%s has no wrong or hyphenated romanization', (rel) => {
    const found = extractKoreanPairs(read(rel), rel).flatMap((p) =>
      checkRomanization(p.ko, p.romanization).map((f) => `${rel}:${p.line}: ${f.rule} ${f.message}`),
    );
    expect(found).toEqual([]);
  });

  it('the Hoya landing line is the natural, encouraging 거의 다 했어!', () => {
    const src = read('components/landing/MeetHoya.tsx');
    expect(src).toContain('거의 다 했어! · geoui da haesseo · almost there!');
    expect(src).toContain('&ldquo;거의 다 했어!&rdquo;');
    expect(src).not.toContain('geo-eui');
  });
});
