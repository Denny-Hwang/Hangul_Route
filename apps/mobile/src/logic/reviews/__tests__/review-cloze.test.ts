import type { MemoryItemState } from '@hangul-route/content-schema';
import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import { describe, expect, it } from 'vitest';
import { buildDailyReview, type EngineContext, type EngineRow, type ReviewQuestion } from '../engine';
import { CLOZE_SURFACE_FORMATS, SURFACE_FORMATS, clozeWords, roundFor, surfaceFormats, surfaceIndex, type ClozeRound, type RoundInput } from '../review-rounds';

/**
 * F-CURR-002 section 4.3 rungs by kind (row CM-30): Cloze Pick is the produce rung of a sentence (`pat`) while
 * `game.cloze-pick` is on. Off, the engine falls back to another produce format (Sentence Builder) or the read rung;
 * on, the round leaves out one word, keeps the meaning, and offers word tiles that the meaning settles. A realia card
 * (`rea`) needs its card, so the review surfaces keep leaving it to Realia Read and Cloze Pick in lessons.
 */

const FORMATS: Readonly<Record<ReviewItemKind, readonly ReviewFormat[]>> = {
  sym: ['hear-pick', 'read-pick', 'syllable-build', 'match-shape'],
  syl: ['hear-pick', 'read-pick', 'syllable-build'],
  lex: ['hear-pick', 'read-pick', 'type-see', 'type-picture', 'dictation', 'syllable-build'],
  pat: ['hear-pick', 'read-pick', 'cloze-pick', 'sentence-builder'],
  exc: ['hear-pick', 'read-pick', 'sentence-builder'],
  rea: ['read-pick', 'cloze-pick'],
};
const TODAY = '2026-11-10';

function mk(id: string, over: Partial<ReviewItem> = {}): ReviewItem {
  const kind = id.slice(0, 3) as ReviewItemKind;
  return { id, kind, ko: '가', romanization: 'ga', home: 'letters', stage: 3, volume: 1, cells: ['episode:stage3-letters'], asked: [], formats: [...FORMATS[kind]], soundChange: false, homophoneOf: [], ...over };
}
const indexOf = (items: readonly ReviewItem[]): EngineContext['index'] => ({ items, byId: new Map(items.map((i) => [i.id, i])), retired: new Set() });

// Shipped-shape sentences (their romanization as the converter gives it: no closing mark).
const PATS = [
  mk('pat:chaegi-isseoyo', { ko: '책이 있어요.', romanization: 'chaegi isseoyo', en: 'There is a book.' }),
  mk('pat:yeonpiri-eopseoyo', { ko: '연필이 없어요.', romanization: 'yeonpiri eopseoyo', en: 'There is no pencil.' }),
  mk('pat:chinguga-isseoyo', { ko: '친구가 있어요.', romanization: 'chinguga isseoyo', en: 'I have a friend.' }),
  mk('pat:gabangi-isseoyo', { ko: '가방이 있어요.', romanization: 'gabangi isseoyo', en: 'There is a bag.' }),
  mk('pat:mureul-masyeoyo', { ko: '물을 마셔요.', romanization: 'mureul masyeoyo', en: 'I drink water.', home: 'life' }),
  mk('pat:chaegi-eopseoyo', { ko: '책이 없어요.', romanization: 'chaegi eopseoyo', en: 'There is no book.' }),
  // One word: even listed with Cloze Pick, the surface cannot leave a word out of it.
  mk('pat:gabangieyo', { ko: '가방이에요.', romanization: 'gabangieyo', en: 'It is a bag.', formats: ['hear-pick', 'read-pick', 'cloze-pick'] }),
  mk('pat:n-juseyo', { ko: '___ 주세요.', romanization: '___ juseyo', en: '___, please.' }),
];
const REA = mk('rea:menu', { ko: '메뉴', romanization: 'menyu', en: 'A menu.' });
const ITEMS = [...PATS, REA];
const ON = surfaceIndex(indexOf(ITEMS), { clozePick: true });
const OFF = surfaceIndex(indexOf(ITEMS));
const input = (index = ON, over: Partial<RoundInput> = {}): RoundInput => ({ index, gloss: (_k, en) => en, seed: 's', ...over });
const q = (itemId: string): ReviewQuestion => ({ itemId, kind: 'pat', rung: 'produce', format: 'cloze-pick', theme: 'letters', stretch: false, voiceFallback: false });

describe('the review surface and game.cloze-pick', () => {
  it('off: Cloze Pick is not a review format; on: it joins the shipped ones', () => {
    expect(SURFACE_FORMATS.has('cloze-pick')).toBe(false);
    expect([...CLOZE_SURFACE_FORMATS].filter((f) => !SURFACE_FORMATS.has(f))).toEqual(['cloze-pick']);
    expect(OFF.byId.get('pat:chaegi-isseoyo')?.formats).not.toContain('cloze-pick');
    expect(ON.byId.get('pat:chaegi-isseoyo')?.formats).toContain('cloze-pick');
  });

  it('only a sentence of two or more words whose romanization lines up; never a frame or a realia card', () => {
    expect(surfaceFormats(PATS[6] as ReviewItem, CLOZE_SURFACE_FORMATS)).not.toContain('cloze-pick');
    expect(surfaceFormats(PATS[7] as ReviewItem, CLOZE_SURFACE_FORMATS)).not.toContain('cloze-pick');
    expect(surfaceFormats(mk('pat:odd', { ko: '책이 있어요.', romanization: 'chaegiisseoyo' }), CLOZE_SURFACE_FORMATS)).not.toContain('cloze-pick');
    expect(surfaceFormats(REA, CLOZE_SURFACE_FORMATS)).toEqual([]);
    expect(ON.byId.has('rea:menu')).toBe(false);
  });

  it('caches each surface on the same index', () => {
    const index = indexOf(ITEMS);
    expect(surfaceIndex(index, { clozePick: true })).toBe(surfaceIndex(index, { clozePick: true }));
    expect(surfaceIndex(index)).toBe(surfaceIndex(index, { clozePick: false }));
    expect(surfaceIndex(index)).not.toBe(surfaceIndex(index, { clozePick: true }));
  });

  it('lines up words and romanization, edge marks off', () => {
    expect(clozeWords({ ko: '네, 책이에요.', romanization: 'ne, chaegieyo' })).toEqual([
      { ko: '네', romanization: 'ne' },
      { ko: '책이에요', romanization: 'chaegieyo' },
    ]);
    expect(clozeWords({ ko: '가방이에요.', romanization: 'gabangieyo' })).toBeNull();
    expect(clozeWords({ ko: '___ 주세요.', romanization: '___ juseyo' })).toBeNull();
  });
});

describe('the engine at the produce rung of a sentence', () => {
  const st = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 3, d: TODAY, c: 2, r: 3, n: 4, f: '2026-10-01', s: 3, at: '2026-11-09T09:00:00.000Z', ...over });
  const states = (ids: readonly string[]): Record<string, EngineRow> => Object.fromEntries(ids.map((id) => [id, { st: st() }]));
  const formatsOf = (index: EngineContext['index'], seed: string): ReviewFormat[] => {
    const ctx: EngineContext = { index, states: states(['pat:chaegi-isseoyo']), today: TODAY, voice: true, seed };
    return buildDailyReview(ctx).questions.map((x) => x.format);
  };

  it('off: never Cloze Pick; Sentence Builder holds the produce rung', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) expect(formatsOf(OFF, seed)).toEqual(['sentence-builder']);
  });

  it('on: Cloze Pick or Sentence Builder, by the seed, always at produce', () => {
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap((seed) => formatsOf(ON, seed)));
    expect(seen).toEqual(new Set(['cloze-pick', 'sentence-builder']));
  });

  it('a one-word sentence has no produce format here and is asked at read', () => {
    const ctx: EngineContext = { index: ON, states: { 'pat:gabangieyo': { st: st() } }, today: TODAY, voice: true, seed: 's' };
    expect(buildDailyReview(ctx).questions.map((x) => [x.format, x.rung])).toEqual([['read-pick', 'read']]);
  });
});

describe('the Cloze Pick round of a review', () => {
  it('leaves out one word, keeps the meaning, and offers 3 or 4 word tiles of which one fits', () => {
    const round = roundFor(q('pat:chaegi-isseoyo'), input()) as ClozeRound;
    expect(round.type).toBe('cloze');
    expect(round.meaning).toBe('There is a book.');
    expect(round.gapped.ko.split('___')).toHaveLength(2);
    expect(round.gapped.romanization.split('___')).toHaveLength(2);
    expect(round.tiles.length).toBeGreaterThanOrEqual(3);
    expect(round.tiles.length).toBeLessThanOrEqual(4);
    const answer = round.tiles.find((t) => t.id === round.answerId);
    expect(round.gapped.ko.replace('___', answer?.ko?.ko ?? '')).toBe('책이 있어요.');
    expect(round.gapped.romanization.replace('___', answer?.ko?.romanization ?? '')).toBe('chaegi isseoyo');
    expect(round.answer).toEqual({ ko: { ko: '책이 있어요.', romanization: 'chaegi isseoyo' }, gloss: 'There is a book.' });
    for (const tile of round.tiles) expect(tile.ko?.romanization).not.toBe('');
  });

  it('never offers a tile the meaning would not settle, one already in the sentence, or a sentence of the same meaning', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
      const round = roundFor(q('pat:chaegi-isseoyo'), input(ON, { seed })) as ClozeRound;
      const answer = round.tiles.find((t) => t.id === round.answerId)?.ko?.ko as string;
      const others = round.tiles.filter((t) => t.id !== round.answerId).map((t) => t.ko?.ko as string);
      for (const other of others) {
        expect(other[0]).not.toBe(answer[0]);
        expect(['책이', '있어요']).not.toContain(other);
      }
      // 친구가 있어요 / 가방이 있어요: the tile at the same place counted from the end.
      if (answer === '있어요') expect(others.every((o) => ['없어요', '마셔요'].includes(o))).toBe(true);
    }
  });

  it('is the same for the same seed; with no word of two tiles it is asked as Sentence Builder, or not at all', () => {
    expect(roundFor(q('pat:chaegi-isseoyo'), input())).toEqual(roundFor(q('pat:chaegi-isseoyo'), input()));
    const lone = surfaceIndex(indexOf([PATS[0] as ReviewItem, PATS[4] as ReviewItem]), { clozePick: true });
    expect(roundFor(q('pat:chaegi-isseoyo'), input(lone))?.type).toBe('order');
    expect(roundFor(q('pat:gabangieyo'), input())).toBeNull();
  });

  it('without the meaning in the UI language it is no Cloze round: the tiles would not be settled, so Sentence Builder asks it', () => {
    // 책이 ___ takes 있어요 and 없어요 alike: only the meaning decides, so a missing es or ko meaning is never a cloze gap.
    const round = roundFor(q('pat:chaegi-isseoyo'), input(ON, { gloss: () => undefined }));
    expect(round?.type).toBe('order');
    expect(round?.question).toMatchObject({ rung: 'produce', format: 'sentence-builder' });
    // A sentence too long for Sentence Builder has no other produce round here: it is skipped, never shown unsettled.
    const long = mk('pat:long', { ko: '저는 오늘 학교에서 친구와 같이 책을 읽어요.', romanization: 'jeoneun oneul hakgyoeseo chinguwa gachi chaegeul ilgeoyo', en: 'Today I read a book with a friend at school.', formats: ['hear-pick', 'read-pick', 'cloze-pick'] });
    const longIndex = surfaceIndex(indexOf([...ITEMS, long]), { clozePick: true });
    expect(roundFor({ ...q('pat:long') }, input(longIndex, { gloss: () => undefined }))).toBeNull();
  });
});

describe('a sentence no word of which has two fair tiles (section 4.5: asked another way, never dropped)', () => {
  // 물을 마셔요 alone in its pool: no other sentence offers a word at either place, so no Cloze round can be built.
  const lonely = surfaceIndex(indexOf([PATS[0] as ReviewItem, PATS[4] as ReviewItem]), { clozePick: true });
  const st = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 3, d: TODAY, c: 2, r: 3, n: 4, f: '2026-10-01', s: 3, at: '2026-11-09T09:00:00.000Z', ...over });

  it('the surface drops Cloze Pick from it and keeps its other formats', () => {
    expect(lonely.byId.get('pat:mureul-masyeoyo')?.formats).not.toContain('cloze-pick');
    expect(lonely.byId.get('pat:mureul-masyeoyo')?.formats).toContain('sentence-builder');
    // With a fuller pool the same sentence keeps it.
    expect(ON.byId.get('pat:chaegi-isseoyo')?.formats).toContain('cloze-pick');
  });

  it('the engine asks it as Sentence Builder at produce, for every seed', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const ctx: EngineContext = { index: lonely, states: { 'pat:mureul-masyeoyo': { st: st() } }, today: TODAY, voice: true, seed };
      const questions = buildDailyReview(ctx).questions;
      expect(questions.map((x) => [x.format, x.rung])).toEqual([['sentence-builder', 'produce']]);
      expect(roundFor(questions[0] as ReviewQuestion, input(lonely, { seed }))?.type).toBe('order');
    }
  });

  it('a long sentence with Cloze Pick as its only produce format is asked at read', () => {
    const long = mk('pat:long', { ko: '저는 오늘 학교에서 친구와 같이 책을 읽어요.', romanization: 'jeoneun oneul hakgyoeseo chinguwa gachi chaegeul ilgeoyo', en: 'Today I read a book with a friend at school.', formats: ['hear-pick', 'read-pick', 'cloze-pick'] });
    const index = surfaceIndex(indexOf([long, PATS[4] as ReviewItem]), { clozePick: true });
    expect(index.byId.get('pat:long')?.formats).toEqual(['hear-pick', 'read-pick']);
    const ctx: EngineContext = { index, states: { 'pat:long': { st: st() } }, today: TODAY, voice: true, seed: 's' };
    const questions = buildDailyReview(ctx).questions;
    expect(questions.map((x) => x.rung)).toEqual(['read']);
    expect(roundFor(questions[0] as ReviewQuestion, input(index))).not.toBeNull();
  });
});
