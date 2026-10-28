import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import { describe, expect, it } from 'vitest';
import { buildDailyReview, type EngineContext } from '../engine';
import { glossFrom, roundFor, surfaceFormats, surfaceIndex, type TypeRound } from '../review-rounds';

/**
 * F-CURR-002 sections 4.3 and 4.5 (row CM-31): Dictation (Type Hangul `hear`) at the produce rung of a `lex` item,
 * drawn by the review surface only with `game.type-hangul-hear` on. The engine keeps it to an item that passes
 * `dictation-unambiguous` (no homophone, no sound change) on a device with a voice.
 */

const LEX: readonly ReviewFormat[] = ['hear-pick', 'read-pick', 'type-see', 'type-picture', 'dictation', 'syllable-build'];
function mk(id: string, over: Partial<ReviewItem> = {}): ReviewItem {
  const kind = id.slice(0, 3) as ReviewItemKind;
  return { id, kind, ko: '사과', romanization: 'sagwa', en: 'apple', home: 'life', stage: 2, volume: 1, cells: ['episode:stage2-life'], asked: [], formats: [...LEX], soundChange: false, homophoneOf: [], ...over };
}
const indexOf = (items: readonly ReviewItem[]): EngineContext['index'] => ({ items, byId: new Map(items.map((i) => [i.id, i])), retired: new Set() });
const TODAY = '2026-10-23';
const atProduce = { st: { b: 4, d: TODAY, c: 2, r: 0b011, n: 4, f: '2026-09-01', s: 4, at: '2026-10-01T09:00:00.000Z' } };

describe('the review surface and Dictation', () => {
  it('draws Dictation only with the switch on, for a word, never for a frame or another kind', () => {
    expect(surfaceFormats(mk('lex:sagwa'))).not.toContain('dictation');
    expect(surfaceFormats(mk('lex:sagwa'), { dictation: true })).toEqual(['hear-pick', 'read-pick', 'type-see', 'dictation']);
    expect(surfaceFormats(mk('lex:frame', { ko: '___ 주세요' }), { dictation: true })).not.toContain('dictation');
    expect(surfaceFormats(mk('pat:x', { ko: '사과 주세요.', formats: ['read-pick', 'dictation'] }), { dictation: true })).toEqual(['read-pick']);
  });

  it('keeps a cut index per switch value, each cached', () => {
    const base = indexOf([mk('lex:sagwa')]);
    const off = surfaceIndex(base);
    const on = surfaceIndex(base, { dictation: true });
    expect(off.items[0]?.formats).not.toContain('dictation');
    expect(on.items[0]?.formats).toContain('dictation');
    expect(surfaceIndex(base, { dictation: true })).toBe(on);
    expect(surfaceIndex(base, {})).toBe(off);
  });

  it('a Dictation question is a hear type round of the word, with the answer Hoya shows', () => {
    const index = surfaceIndex(indexOf([mk('lex:sagwa')]), { dictation: true });
    const round = roundFor(
      { itemId: 'lex:sagwa', kind: 'lex', rung: 'produce', format: 'dictation', theme: 'life', stretch: false, voiceFallback: false },
      { index, gloss: glossFrom(undefined), seed: 's' },
    ) as TypeRound;
    expect(round).toMatchObject({ type: 'type', mode: 'hear', target: '사과', answer: { ko: { ko: '사과', romanization: 'sagwa' }, gloss: 'apple' } });
    expect(round.picture).toBeUndefined();
  });

  it('the engine asks Dictation at the produce rung for a word that passes the rule, with a voice and the switch on', () => {
    const ask = (item: ReviewItem, dictation: boolean, voice: boolean): ReviewFormat[] => {
      const formats = new Set<ReviewFormat>();
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const ctx: EngineContext = { index: surfaceIndex(indexOf([item]), { dictation }), states: { [item.id]: atProduce }, today: TODAY, voice, seed };
        for (const q of buildDailyReview(ctx).questions) formats.add(q.format);
      }
      return [...formats];
    };
    const apple = mk('lex:sagwa');
    expect(ask(apple, true, true)).toContain('dictation');
    expect(ask(apple, false, true)).not.toContain('dictation');
    expect(ask(apple, true, false)).not.toContain('dictation');
    // 낫 has a homophone (낮); 학교 is said [학꾜]: neither is ever asked by ear in Dictation.
    expect(ask(mk('lex:nat', { ko: '낫', romanization: 'nat', homophoneOf: ['lex:nat~2'] }), true, true)).not.toContain('dictation');
    expect(ask(mk('lex:hakgyo', { ko: '학교', romanization: 'hakgyo', soundChange: true }), true, true)).not.toContain('dictation');
  });
});
