import type { OrderItRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { buildRound, buildRounds, derange, withoutMark, type SbTile } from '../progression';
import { BOOK_PARTICLE, EAT_RICE, LIKE_TTEOKGUK } from './fixtures';

const koOrder = (tray: readonly SbTile[]): string[] => tray.filter((t) => t.id.startsWith('w')).map((t) => t.ko);

describe('buildRound: an order round', () => {
  it('splits the sentence into its words with the romanized word at the same index, the mark left off', () => {
    const round = buildRound(EAT_RICE, 1)!;
    expect(round.words).toEqual([
      { ko: '밥을', romanization: 'babeul' },
      { ko: '먹어요', romanization: 'meogeoyo' },
    ]);
    expect(round.open).toEqual([0, 1]);
    expect(round.particle).toBeUndefined();
    expect(round.sentence.ko).toBe('밥을 먹어요.');
    expect(round.pictureRef).toBe('card:rice');
  });

  it('puts the words and the extra tile in the tray, never in the sentence order', () => {
    for (let seed = 0; seed < 50; seed++) {
      const round = buildRound(EAT_RICE, seed)!;
      expect(round.tray.map((t) => t.id).sort()).toEqual(['d0', 'w0', 'w1']);
      expect(koOrder(round.tray)).not.toEqual(['밥을', '먹어요']);
      const three = buildRound(LIKE_TTEOKGUK, seed)!;
      expect(koOrder(three.tray)).not.toEqual(['저는', '떡국을', '좋아해요']);
    }
  });

  it('gives each tile its own romanization and leaves the picture out when there is none', () => {
    const round = buildRound(LIKE_TTEOKGUK, 3)!;
    expect(round.tray.find((t) => t.ko === '떡국을')?.romanization).toBe('tteokgugeul');
    expect('pictureRef' in round).toBe(false);
    expect(buildRound(EAT_RICE, 3)!.tray.find((t) => t.id === 'd0')).toEqual({ id: 'd0', ko: '물을', romanization: 'mureul' });
  });

  it('draws no romanization on the tiles when the romanization does not split one word per word', () => {
    const odd = { ...EAT_RICE, sentence: { ...EAT_RICE.sentence, romanization: 'babeulmeogeoyo' } };
    expect(buildRound(odd, 1)!.words.map((w) => w.romanization)).toEqual(['', '']);
  });

  it('cannot be played with fewer than two or more than six words', () => {
    const one = { ...EAT_RICE, sentence: { ko: '좋아요.', romanization: 'joayo', en: 'Good.' } };
    const seven = { ...EAT_RICE, sentence: { ko: '가 나 다 라 마 바 사', romanization: 'ga na da ra ma ba sa', en: 'x' } };
    expect(buildRound(one, 1)).toBeNull();
    expect(buildRound(seven, 1)).toBeNull();
  });
});

describe('buildRound: a particle round', () => {
  it('opens only the particle word, with its stem and the fitting choice', () => {
    const round = buildRound(BOOK_PARTICLE, 1)!;
    expect(round.open).toEqual([0]);
    expect(round.particle).toEqual({ word: 0, stem: '책', answer: '이' });
    expect(round.tray.map((t) => t.ko).sort()).toEqual(['가', '이']);
    expect(round.tray.map((t) => t.id).sort()).toEqual(['c0', 'c1']);
  });

  it('cannot be played when the particle word is missing or no single choice ends it', () => {
    const base = BOOK_PARTICLE as OrderItRound;
    const outOfRange = { ...base, particle: { ...base.particle!, tile: 5 } };
    const neither = { ...base, particle: { ...base.particle!, choices: [base.particle!.choices[1], { ...base.particle!.choices[1], ko: '을' }] } };
    const same = { ...base, particle: { ...base.particle!, choices: [base.particle!.choices[0], base.particle!.choices[0]] } };
    const whole = { ...base, sentence: { ko: '이 있어요', romanization: 'i isseoyo', en: 'x' } };
    expect(buildRound(outOfRange as OrderItRound, 1)).toBeNull();
    expect(buildRound(neither as OrderItRound, 1)).toBeNull();
    expect(buildRound(same as OrderItRound, 1)).toBeNull();
    expect(buildRound(whole as OrderItRound, 1)).toBeNull();
  });
});

describe('buildRounds', () => {
  it('keeps the playable rounds in order and drops the rest', () => {
    const broken = { ...EAT_RICE, id: 'broken', sentence: { ko: '좋아요', romanization: 'joayo', en: 'Good.' } };
    expect(buildRounds([EAT_RICE, broken, BOOK_PARTICLE], 4).map((r) => r.id)).toEqual(['r-eat-rice', 'r-book-i']);
    expect(buildRounds(undefined, 4)).toEqual([]);
  });
});

describe('derange', () => {
  it('turns an in-order tray until the sentence is out of order', () => {
    const words = [
      { ko: 'a', romanization: '' },
      { ko: 'b', romanization: '' },
    ];
    const tiles = words.map((w, i) => ({ id: `w${i}`, ko: w.ko, romanization: '' }));
    for (let seed = 0; seed < 20; seed++) expect(koOrder(derange(tiles, words, seed))).toEqual(['b', 'a']);
  });

  it('stops when every word reads the same (no order can differ)', () => {
    const words = [
      { ko: 'a', romanization: '' },
      { ko: 'a', romanization: '' },
    ];
    const tiles = words.map((w, i) => ({ id: `w${i}`, ko: w.ko, romanization: '' }));
    expect(derange(tiles, words, 1)).toHaveLength(2);
  });
});

describe('withoutMark', () => {
  it('drops a sentence mark at the end only', () => {
    expect(withoutMark('먹어요.')).toBe('먹어요');
    expect(withoutMark('뭐예요?!')).toBe('뭐예요');
    expect(withoutMark('a.b')).toBe('a.b');
  });
});
