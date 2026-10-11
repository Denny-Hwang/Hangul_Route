import { readFileSync } from 'node:fs';
import {
  ROMANIZATION_EXCEPTIONS,
  checkRomanization,
  extractKoreanPairs,
  formatRomanizationFinding,
} from '@hangul-route/content-schema';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MeetHoya } from '../components/landing/MeetHoya';

// F-CNT-002 PR 3, source class C: Korean written inline in pages. The scanner finds
// `ko: '…'` … `romanization: '…'` object literals and the `한글 · romanized · gloss`
// JSX pattern; each pair must be Revised Romanization (R1 to R3).

const REPO = new URL('../../../../', import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, REPO), 'utf8');

/** Files with the least number of pairs the scanner must find in them (0: Korean without a paired romanization). */
const FILES: ReadonlyArray<{ path: string; minPairs: number }> = [
  { path: 'apps/web/src/components/landing/MeetHoya.tsx', minPairs: 1 },
  { path: 'apps/web/src/app/design-preview/page.tsx', minPairs: 6 },
  { path: 'apps/web/src/app/design-preview/cards/page.tsx', minPairs: 30 },
  { path: 'apps/web/src/app/design-preview/components/page.tsx', minPairs: 0 },
  { path: 'apps/web/src/app/page.tsx', minPairs: 0 },
  { path: 'apps/mobile/src/screens/minigames/VoiceEchoGame.tsx', minPairs: 0 },
];

const check = (path: string, source: string): string[] =>
  extractKoreanPairs(source, path).flatMap((p) =>
    checkRomanization(p.ko, p.romanization, { exceptions: ROMANIZATION_EXCEPTIONS }).map((i) =>
      formatRomanizationFinding(path, p.line, i),
    ),
  );

describe('inline page romanization (class C)', () => {
  it.each(FILES)('$path has no wrong or hyphenated romanization', ({ path, minPairs }) => {
    const source = read(path);
    expect(extractKoreanPairs(source, path).length).toBeGreaterThanOrEqual(minPairs);
    expect(check(path, source)).toEqual([]);
  });

  it('the Hoya landing line is the natural, encouraging 거의 다 했어!', () => {
    // F-I18N-001 PR 11a: the sentence is a message; the taught phrase and its romanization stay in the component.
    const src = read('apps/web/src/components/landing/MeetHoya.tsx');
    expect(src).toContain("ko: '거의 다 했어!', romanization: 'geoui da haesseo'");
    expect(src).not.toContain('geo-eui');
    const html = renderToStaticMarkup(createElement(MeetHoya));
    expect(html).toContain('거의 다 했어! · geoui da haesseo · almost there!');
    expect(html).toContain('“거의 다 했어!”');
  });

  it('page.tsx writes only isolated jamo, no Korean word (so it needs no romanization)', () => {
    expect(/[가-힣]/.test(read('apps/web/src/app/page.tsx'))).toBe(false);
  });

  it('a wrong inline pair would fail, naming file and line', () => {
    const bad = [
      "const cards = [",
      "  { ko: '윷놀이', romanization: 'yutnori' },",
      '];',
      '<p>거의! · geo-eui · almost!</p>',
    ].join('\n');
    expect(check('apps/web/src/components/Bad.tsx', bad)).toEqual([
      '::error file=apps/web/src/components/Bad.tsx,line=2::romanization-mismatch: 윷놀이: given "yutnori", Revised Romanization is "yunnori"',
      '::error file=apps/web/src/components/Bad.tsx,line=4::romanization-hyphen: geo-eui: remove hyphens → "geoeui"',
      '::error file=apps/web/src/components/Bad.tsx,line=4::romanization-mismatch: 거의!: given "geo-eui", Revised Romanization is "geoui"',
    ]);
  });
});
