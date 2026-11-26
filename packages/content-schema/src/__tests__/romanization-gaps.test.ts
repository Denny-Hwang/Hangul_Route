import { describe, expect, it } from 'vitest';
import {
  COPULA_FORMS,
  COPULA_STEMS,
  GAP_ARTICLES,
  GRAMMATICAL_TAILS,
  HADA_BLOCKS,
  JUNCTURE_HEADS,
  JUNCTURE_PREFIXES,
  N_INSERTION_HEADS,
  N_INSERTION_WORDS,
  ROMANIZATION_GAPS,
  detectGaps,
  type RomanizationGap,
} from '../index';

/** AMENDMENTS-ROMANIZER-GAPS §3.6 and §3.8: the detector vectors are the spec's. */

describe('the detector lists are data: non-empty, duplicate-free, one token each', () => {
  const lists: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['HADA_BLOCKS', HADA_BLOCKS],
    ['N_INSERTION_HEADS', N_INSERTION_HEADS],
    ['N_INSERTION_WORDS', N_INSERTION_WORDS],
    ['JUNCTURE_HEADS', JUNCTURE_HEADS],
    ['JUNCTURE_PREFIXES', JUNCTURE_PREFIXES],
    ['GRAMMATICAL_TAILS', GRAMMATICAL_TAILS],
    ['COPULA_STEMS', COPULA_STEMS],
    ['COPULA_FORMS', COPULA_FORMS],
    ['ROMANIZATION_GAPS', ROMANIZATION_GAPS],
  ];
  it.each(lists)('%s', (_name, list) => {
    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list).size).toBe(list.length);
    for (const item of list) expect(item, item).toMatch(/^[a-z가-힣-]+$/);
  });

  it('every gap has an article for the R9 message', () => {
    expect(Object.keys(GAP_ARTICLES).sort()).toEqual([...ROMANIZATION_GAPS].sort());
  });
});

describe('detectGaps: fires (the expected gap is included)', () => {
  const fire = (gap: RomanizationGap, words: string): void => {
    for (const word of words.split(' ')) {
      it(`${word} -> ${gap}`, () => {
        expect(detectGaps(word)).toContain(gap);
      });
    }
  };
  // SP 제29항 body, 붙임 1 and 붙임 2 (numerals written as one word), and the 십육 / 큰일 / 볼일 / 일일이 words.
  fire(
    'n-insertion',
    '솜이불 홑이불 막일 삯일 맨입 꽃잎 내복약 한여름 남존여비 신여성 색연필 직행열차 늑막염 콩엿 담요 눈요기 영업용 식용유 백분율 밤윷 ' +
      '들일 솔잎 설익다 물약 불여우 서울역 물엿 휘발유 유들유들 서른여섯 스물여섯 열여섯 열여덟 열일곱 십육 큰일 볼일 일일이 뒷일 옛날이야기',
  );
  // SP 제30항 3.
  fire('saisiot', '깻잎 나뭇잎 뒷윷 베갯잇 뒷일 첫인상');
  // SP 제15항.
  fire('juncture', '맛없어요 덧없다 겉옷 헛웃음 뜻있다 첫아이 첫인상 젖어미 값어치 홑이불');
  // RR 제3장 제1항 4, SP 제12항 붙임 2.
  fire('predicate-h', '못해요 따뜻해요 생각해요 착하다 입학해요 약혼해요 북한산 낙하산 북한산에 기록했어요 기록할까요 척해요');

  it('names two gaps where the word has two (첫인상, 뒷일, 홑이불)', () => {
    expect(detectGaps('첫인상')).toEqual(['saisiot', 'juncture']);
    expect(detectGaps('뒷일')).toEqual(['n-insertion', 'saisiot']);
    expect(detectGaps('홑이불')).toEqual(['n-insertion', 'juncture']);
  });
});

describe('detectGaps: does not fire', () => {
  const quiet: ReadonlyArray<readonly [string, string]> = [
    ['SP 제29항 붙임 2 다만', '송별연 등용문'],
    ['SP 제15항 다만 (맛있다, 멋있다 may be said [마싣따])', '맛있어요 멋있어요'],
    ['a particle or copula after ㅅ or a stop', '옷이 맛이 것이에요 뜻이에요 붓이에요 이곳이 겉은 것인데 것일까요 무엇인가요 곳인가요 것이었습니다 옷이랑 옷이도'],
    ['a listed word not at the start of the token', '받아들일 마지막일 사람들일'],
    ['Sino-Korean 일 / 요', '생일 십일 삼일 월요일 금요일 필요해요 중요해요 민요예요'],
    ['the noun convention outside a 하다 form', '입학 집현전 국화전 풍속화'],
    ['a word with no gap', '읽고 좁히다 한글 강아지 학교'],
  ];
  it.each(quiet)('%s', (_why, words) => {
    for (const word of words.split(' ')) expect(detectGaps(word), word).toEqual([]);
  });

  it('gives [] for two words, one block, a non-Hangul character and the empty token', () => {
    expect(detectGaps('못 해요')).toEqual([]);
    expect(detectGaps('밭 아래')).toEqual([]);
    expect(detectGaps('못')).toEqual([]);
    expect(detectGaps('못해요!')).toEqual([]);
    expect(detectGaps('abc')).toEqual([]);
    expect(detectGaps('ㄱㄴ')).toEqual([]);
    expect(detectGaps('')).toEqual([]);
  });
});
