import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blockParts, REPRESENTATIVE_FINALS, romanizeWord } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { letterName, NAMED_LETTERS } from '../letters';
import { ALLOWLIST_BLOCKS, DRILL_BLOCKS, isProbeBlock, isRealBlock, PROBE_BLOCKS, REAL_BLOCKS, romanizationOf, soundKeyOf, STAGE1_BLOCKS } from '../pool';

/**
 * F-CURR-002 section 7.1 F9 and section 19 assumption 5, row CM-32: the Decoding Sprint and Syllable Build play real
 * blocks only, the Stage 1 table and an allowlist the device voice is tested on, and the probe holds blocks out.
 */
const TABLE = JSON.parse(readFileSync(join(__dirname, '../../../../../../packages/content-schema/src/review-items/stage1-items.json'), 'utf8')) as {
  symbols: Array<{ id: string; char: string; kind: string }>;
  occurrences: Array<{ kind: string; ko: string; romanization: string }>;
};
const CHART_CONSONANTS = [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'];
const CHART_VOWELS = [...'ㅏㅓㅗㅜㅡㅣ'];
/** One-block everyday words of the allowlist (each with a final of the seven sounds): every one is a Korean noun. */
const WORDS = new Set('강 곰 공 국 굴 금 길 김 꿈 남 눈 달 돈 돌 동 등 말 몸 문 물 밤 방 발 밥 뱀 벌 별 병 봄 북 불 빵 산 삼 상 섬 성 손 솔 실 쌀 잠 장 종 줄 짐 창 책 천 춤 칼 콩 탑 톱 팔 풀 학 한 형 힘 땅 떡 숨 술 귤 반 판 편 연 입 집 곧 굽'.split(' '));

describe('the real blocks (allowlist test)', () => {
  it('stage1 is the Stage 1 table: its blocks and one-block words, those whose final can be told by ear', () => {
    const blocks = new Set(TABLE.occurrences.filter((o) => o.kind === 'syl' || (o.kind === 'lex' && [...o.ko].length === 1)).map((o) => o.ko));
    const heard = [...blocks].filter((ko) => {
      const p = blockParts(ko);
      return p !== null && (p.final === null || REPRESENTATIVE_FINALS.includes(p.final));
    });
    expect([...STAGE1_BLOCKS].sort()).toEqual(heard.sort());
    // 붓 and 윷 end in ㅅ and ㅊ, heard as [ㄷ]: a heard round cannot ask them, so they are left out.
    expect(blocks.has('붓') && blocks.has('윷')).toBe(true);
    expect(STAGE1_BLOCKS).not.toContain('붓');
  });

  it('only real syllables: every allowlist block is a chart syllable (a basic consonant and ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ) or a one-block word', () => {
    for (const ko of ALLOWLIST_BLOCKS) {
      const p = blockParts(ko);
      expect(p, ko).not.toBeNull();
      const chart = p!.final === null && CHART_CONSONANTS.includes(p!.first) && CHART_VOWELS.includes(p!.vowel);
      expect(chart || WORDS.has(ko), `${ko} is neither a chart syllable nor a listed word`).toBe(true);
      if (p!.final !== null) expect(REPRESENTATIVE_FINALS, ko).toContain(p!.final);
    }
    // The whole chart is there.
    for (const c of CHART_CONSONANTS) for (const v of CHART_VOWELS) {
      const ko = String.fromCharCode(0xac00 + ('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.indexOf(c) * 21 + 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'.indexOf(v)) * 28);
      expect(REAL_BLOCKS.has(ko), ko).toBe(true);
    }
  });

  it('no pseudo-word: a block outside both lists is not real, and lists hold each block once', () => {
    for (const ko of ['밮', '뷁', '꺍', '갘', '븨', 'ㅂ', 'ab', '']) expect(isRealBlock(ko), ko).toBe(false);
    expect(new Set([...STAGE1_BLOCKS, ...ALLOWLIST_BLOCKS]).size).toBe(STAGE1_BLOCKS.length + ALLOWLIST_BLOCKS.length);
  });

  it('no two real blocks sound the same, so a heard round never asks them apart', () => {
    const keys = [...REAL_BLOCKS].map(soundKeyOf);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every block romanizes with rr.ts', () => {
    for (const ko of REAL_BLOCKS) {
      expect(romanizeWord(ko), ko).not.toBeNull();
      expect(romanizationOf(ko)).toBe(romanizeWord(ko));
    }
    expect(romanizationOf('밥')).toBe('bap');
    const table = new Map(TABLE.occurrences.map((o) => [o.ko, o.romanization]));
    for (const ko of STAGE1_BLOCKS) expect(romanizationOf(ko), ko).toBe(table.get(ko));
  });

  it('the probe is held out: allowlist blocks that are not in the Stage 1 table, and never a drill block', () => {
    expect(PROBE_BLOCKS.length).toBeGreaterThanOrEqual(12);
    for (const ko of PROBE_BLOCKS) {
      expect(ALLOWLIST_BLOCKS, ko).toContain(ko);
      expect(STAGE1_BLOCKS, ko).not.toContain(ko);
      expect(DRILL_BLOCKS, ko).not.toContain(ko);
      expect(isProbeBlock(ko)).toBe(true);
    }
    expect(DRILL_BLOCKS.length + PROBE_BLOCKS.length).toBe(REAL_BLOCKS.size);
    // Open and closed blocks both, so the probe asks finals too.
    expect(PROBE_BLOCKS.some((ko) => blockParts(ko)!.final !== null)).toBe(true);
    expect(PROBE_BLOCKS.some((ko) => blockParts(ko)!.final === null)).toBe(true);
  });
});

describe('letter names', () => {
  it('are the RR names of the Stage 1 symbols, for every first letter and vowel', () => {
    const ids = new Map(TABLE.symbols.filter((s) => s.kind !== 'batchim').map((s) => [s.char, s.id.replace(/^jamo:/, '')]));
    expect(NAMED_LETTERS).toHaveLength(40);
    for (const letter of NAMED_LETTERS) expect(letterName(letter), letter).toBe(ids.get(letter));
    expect(letterName('x')).toBe('x');
  });
});
