import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import { describe, expect, it } from 'vitest';
import type { EngineContext, ReviewQuestion } from '../engine';
import { MAX_ORDER_TILES, NO_GAME_FORMATS, SURFACE_FORMATS, glossFrom, roundFor, surfaceFormats, surfaceIndex, type BuildRound, type OrderRound, type PickRound, type RoundInput, type ShapeRound, type TypeRound } from '../review-rounds';

/**
 * F-CURR-002 sections 4.3 and 4.5 (row CM-14): the rounds of a Daily Review. Only the formats whose rounds have
 * shipped are drawn; a heard round never asks two spellings of one sound apart; a sound round hides the options'
 * romanization; Sentence Builder never hands over the order; every round carries the answer Hoya shows after a miss.
 */

const ALL: Readonly<Record<ReviewItemKind, readonly ReviewFormat[]>> = {
  sym: ['hear-pick', 'read-pick', 'syllable-build', 'match-shape'],
  syl: ['hear-pick', 'read-pick', 'syllable-build'],
  lex: ['hear-pick', 'read-pick', 'type-see', 'type-picture', 'dictation', 'syllable-build'],
  pat: ['hear-pick', 'read-pick', 'cloze-pick', 'sentence-builder'],
  exc: ['hear-pick', 'read-pick', 'sentence-builder'],
  rea: ['read-pick', 'cloze-pick'],
};

function mk(id: string, over: Partial<ReviewItem> = {}): ReviewItem {
  const kind = id.slice(0, 3) as ReviewItemKind;
  return { id, kind, ko: '가', romanization: 'ga', home: 'life', stage: 2, volume: 1, cells: ['episode:stage2-life'], asked: [], formats: [...ALL[kind]], soundChange: false, homophoneOf: [], ...over };
}

const indexOf = (items: readonly ReviewItem[]): EngineContext['index'] => ({ items, byId: new Map(items.map((i) => [i.id, i])), retired: new Set() });
const q = (itemId: string, format: ReviewFormat, over: Partial<ReviewQuestion> = {}): ReviewQuestion => ({
  itemId,
  kind: itemId.slice(0, 3) as ReviewItemKind,
  rung: format === 'hear-pick' ? 'recognize' : format === 'read-pick' ? 'read' : 'produce',
  format,
  theme: 'life',
  stretch: false,
  voiceFallback: false,
  ...over,
});

const WORDS = [
  mk('lex:sagwa', { ko: '사과', romanization: 'sagwa', en: 'apple', picture: 'card:apple' }),
  mk('lex:bae~pear', { ko: '배', romanization: 'bae', en: 'pear', picture: 'card:pear', homophoneOf: ['lex:bae~boat'] }),
  mk('lex:bae~boat', { ko: '배', romanization: 'bae', en: 'boat', home: 'nature', homophoneOf: ['lex:bae~pear'] }),
  mk('lex:bap', { ko: '밥', romanization: 'bap', en: 'cooked rice', picture: 'card:rice' }),
  mk('lex:tteok', { ko: '떡', romanization: 'tteok', en: 'rice cake', picture: 'card:tteok' }),
  mk('lex:namu', { ko: '나무', romanization: 'namu', en: 'tree', home: 'nature' }),
  mk('lex:nat', { ko: '낫', romanization: 'nat', en: 'sickle', homophoneOf: ['lex:nat~2'] }),
  mk('lex:nat~2', { ko: '낮', romanization: 'nat', en: 'daytime', homophoneOf: ['lex:nat'] }),
];
const SYMS = [mk('sym:giyeok', { ko: 'ㄱ', romanization: 'g/k' }), mk('sym:nieun', { ko: 'ㄴ', romanization: 'n' }), mk('sym:a', { ko: 'ㅏ', romanization: 'a' }), mk('sym:o', { ko: 'ㅗ', romanization: 'o' })];
const PATS = [
  mk('pat:gabangieyo', { ko: '가방이에요.', romanization: 'gabangieyo', en: 'It is a bag.' }),
  mk('pat:sagwa-juseyo', { ko: '사과 주세요.', romanization: 'sagwa juseyo', en: 'An apple, please.' }),
  mk('pat:n-juseyo', { ko: '___ 주세요.', romanization: '___ juseyo', en: '___, please.' }),
  mk('pat:ne-chaegieyo', { ko: '네, 책이에요.', romanization: 'ne, chaegieyo', en: 'Yes, it is a book.' }),
];
const EXCS = [
  mk('exc:ige-mwoyeyo', { ko: '이게 뭐예요?', romanization: 'ige mwoyeyo?', en: 'What is this?', reply: { ko: '지우개예요.', romanization: 'jiugaeyeyo.', en: 'It is an eraser.' } }),
  mk('exc:nuguyeyo', { ko: '누구예요?', romanization: 'nuguyeyo?', en: 'Who is it?', reply: { ko: '할머니예요.', romanization: 'halmeoniyeyo.', en: 'It is Grandma.' } }),
  mk('exc:annyeong', { ko: '안녕하세요!', romanization: 'annyeonghaseyo!', en: 'Hello!', reply: { ko: '네, 안녕하세요.', romanization: 'ne, annyeonghaseyo.', en: 'Yes, hello.' } }),
];
const REA = [mk('rea:menu', { ko: '메뉴', romanization: 'menyu', en: 'A menu on the table.' })];
const INDEX = surfaceIndex(indexOf([...WORDS, ...SYMS, ...PATS, ...EXCS, ...REA]));
const input = (over: Partial<RoundInput> = {}): RoundInput => ({ index: INDEX, gloss: (_k, en) => en, seed: 's', ...over });

describe('the formats this surface draws', () => {
  it('are the shipped rounds only: Listen and Pick, the read pick, Type Hangul see and picture, Sentence Builder', () => {
    expect([...SURFACE_FORMATS].sort()).toEqual(['hear-pick', 'read-pick', 'sentence-builder', 'type-picture', 'type-see']);
  });

  it('a symbol is never heard, a frame is never heard or ordered, a realia card is left to its own surfaces', () => {
    expect(surfaceFormats(mk('sym:a'))).toEqual(['read-pick']);
    expect(surfaceFormats(mk('pat:n-juseyo', { ko: '___ 주세요.' }))).toEqual(['read-pick']);
    expect(surfaceFormats(mk('pat:x', { ko: '사과 주세요.' }))).toEqual(['hear-pick', 'read-pick', 'sentence-builder']);
    expect(surfaceFormats(mk('rea:menu'))).toEqual([]);
    expect(surfaceFormats(mk('lex:x'))).toEqual(['hear-pick', 'read-pick', 'type-see']);
    expect(surfaceFormats(mk('lex:x', { picture: 'card:x' }))).toEqual(['hear-pick', 'read-pick', 'type-see', 'type-picture']);
  });

  it('surfaceIndex keeps an item that loses no format as it is, drops one left with none, and is cached per index', () => {
    const base = indexOf([mk('syl:ga'), mk('rea:menu'), mk('lex:x', { picture: 'card:x' })]);
    const cut = surfaceIndex(base);
    expect(cut.items.map((i) => i.id)).toEqual(['syl:ga', 'lex:x']);
    expect(cut.byId.get('syl:ga')?.formats).toEqual(['hear-pick', 'read-pick']);
    expect(cut.byId.has('rea:menu')).toBe(false);
    expect(cut.retired).toBe(base.retired);
    expect(surfaceIndex(base)).toBe(cut);
    const whole = indexOf([mk('lex:y', { formats: ['read-pick'] })]);
    expect(surfaceIndex(whole).items[0]).toBe(whole.items[0]);
  });
});

describe('pick rounds', () => {
  it('a heard word: spellings with romanization; never a homophone or a same spelling; the answer among them', () => {
    const round = roundFor(q('lex:sagwa', 'hear-pick'), input()) as PickRound;
    expect(round).toMatchObject({ type: 'pick', heard: true, ask: 'spelling', prompt: { ko: '사과', romanization: 'sagwa' }, answerId: 'lex:sagwa' });
    expect(round.options.length).toBeGreaterThanOrEqual(2);
    expect(round.options.length).toBeLessThanOrEqual(4);
    expect(round.options.map((o) => o.id)).toContain('lex:sagwa');
    expect(round.options.every((o) => o.ko !== undefined && o.label === undefined)).toBe(true);
    expect(new Set(round.options.map((o) => o.ko?.ko)).size).toBe(round.options.length);
    expect(round.answer).toEqual({ ko: { ko: '사과', romanization: 'sagwa' }, gloss: 'apple' });
    // 낫 heard: 낮 sounds the same, so it is never an option.
    const nat = roundFor(q('lex:nat', 'hear-pick', { cue: 'gloss' }), input()) as PickRound;
    expect(nat.options.map((o) => o.id)).not.toContain('lex:nat~2');
    expect(nat.cue).toEqual({ gloss: 'sickle' });
  });

  it('the same theme comes first among the other options', () => {
    const round = roundFor(q('lex:sagwa', 'hear-pick'), input()) as PickRound;
    const others = round.options.filter((o) => o.id !== 'lex:sagwa').map((o) => INDEX.byId.get(o.id)?.home);
    expect(others.filter((h) => h === 'life').length).toBeGreaterThanOrEqual(2);
  });

  it('a heard homophone shows its picture cue, or its gloss; with neither the round cannot be played', () => {
    expect((roundFor(q('lex:bae~pear', 'hear-pick', { cue: 'picture' }), input()) as PickRound).cue).toEqual({ picture: 'card:pear' });
    expect((roundFor(q('lex:bae~boat', 'hear-pick', { cue: 'gloss' }), input()) as PickRound).cue).toEqual({ gloss: 'boat' });
    expect(roundFor(q('lex:bae~boat', 'hear-pick', { cue: 'gloss' }), input({ gloss: () => undefined }))).toBeNull();
  });

  it('a read word: its meanings in the UI language, with pictures only when every option has one', () => {
    const round = roundFor(q('lex:sagwa', 'read-pick'), input()) as PickRound;
    expect(round).toMatchObject({ heard: false, ask: 'meaning' });
    expect(round.options.every((o) => typeof o.label === 'string' && o.ko === undefined)).toBe(true);
    expect(round.options.find((o) => o.id === 'lex:sagwa')?.label).toBe('apple');
    const allPictures = round.options.every((o) => o.picture !== undefined);
    const nonePictures = round.options.every((o) => o.picture === undefined);
    expect(allPictures || nonePictures).toBe(true);
    const es = roundFor(q('lex:sagwa', 'read-pick'), input({ gloss: (_k, en) => (en === 'apple' ? 'manzana' : en === undefined ? undefined : `${en}-es`) })) as PickRound;
    expect(es.options.find((o) => o.id === 'lex:sagwa')?.label).toBe('manzana');
    expect(es.answer.gloss).toBe('manzana');
  });

  it('a read symbol: the sound is shown and the options are letters (their romanization would be the answer)', () => {
    const round = roundFor(q('sym:giyeok', 'read-pick'), input()) as PickRound;
    expect(round).toMatchObject({ ask: 'sound', prompt: { ko: 'ㄱ', romanization: 'g/k' } });
    expect(round.options.every((o) => o.ko !== undefined)).toBe(true);
    expect(new Set(round.options.map((o) => o.ko?.romanization)).size).toBe(round.options.length);
  });

  it('an exchange: the line, then its reply among other replies; the answer is the reply', () => {
    const round = roundFor(q('exc:ige-mwoyeyo', 'read-pick'), input()) as PickRound;
    expect(round).toMatchObject({ ask: 'reply', prompt: { ko: '이게 뭐예요?' }, answer: { ko: { ko: '지우개예요.' }, gloss: 'It is an eraser.' } });
    expect(round.options.map((o) => o.ko?.ko)).toContain('지우개예요.');
    expect((roundFor(q('exc:nuguyeyo', 'hear-pick'), input()) as PickRound).ask).toBe('reply');
  });

  it('a kind with no other item to pick from cannot be played', () => {
    const lone = surfaceIndex(indexOf([mk('syl:ga')]));
    expect(roundFor(q('syl:ga', 'read-pick'), input({ index: lone }))).toBeNull();
    expect(roundFor(q('lex:none', 'read-pick'), input())).toBeNull();
  });

  it('is deterministic for a seed', () => {
    expect(roundFor(q('lex:sagwa', 'hear-pick'), input())).toEqual(roundFor(q('lex:sagwa', 'hear-pick'), input()));
  });
});

describe('type rounds', () => {
  it('see and picture, with the answer Hoya shows', () => {
    expect(roundFor(q('lex:sagwa', 'type-see'), input())).toMatchObject({ type: 'type', mode: 'see', target: '사과', answer: { gloss: 'apple' } });
    const pic = roundFor(q('lex:sagwa', 'type-picture'), input()) as TypeRound;
    expect(pic).toMatchObject({ mode: 'picture', picture: 'card:apple' });
    expect(roundFor(q('lex:namu', 'type-picture'), input())).toBeNull();
  });
});

describe('order rounds (Sentence Builder)', () => {
  it('the words of a sentence, shuffled, never already in order, with the meaning', () => {
    const round = roundFor(q('pat:sagwa-juseyo', 'sentence-builder'), input()) as OrderRound;
    expect(round).toMatchObject({ type: 'order', words: ['사과', '주세요.'], meaning: 'An apple, please.' });
    expect(round.tiles.map((t) => t.ko)).not.toEqual(round.words);
    expect([...round.tiles.map((t) => t.ko)].sort()).toEqual([...round.words].sort());
    expect(new Set(round.tiles.map((t) => t.key)).size).toBe(round.tiles.length);
    expect(round.line).toBeUndefined();
  });

  it("an exchange's reply, under its line", () => {
    const round = roundFor(q('exc:annyeong', 'sentence-builder'), input()) as OrderRound;
    expect(round).toMatchObject({ line: { ko: '안녕하세요!' }, words: ['네,', '안녕하세요.'], meaning: 'Yes, hello.' });
  });

  it('one word, or more than the column holds, cannot be ordered', () => {
    expect(roundFor(q('pat:gabangieyo', 'sentence-builder'), input())).toBeNull();
    const long = surfaceIndex(indexOf([mk('pat:long', { ko: Array.from({ length: MAX_ORDER_TILES + 1 }, (_, i) => `w${i}`).join(' ') })]));
    expect(roundFor(q('pat:long', 'sentence-builder'), input({ index: long }))).toBeNull();
    expect(roundFor(q('lex:sagwa', 'syllable-build'), input())).toBeNull();
  });
});

describe('glossFrom', () => {
  it('reads <entity>#<field> from the locale overlays, and never falls back to the English there', () => {
    const gloss = glossFrom({ 'vocab:sagwa-apple': { gloss: 'manzana', empty: '' } });
    expect(gloss('vocab:sagwa-apple#gloss', 'apple')).toBe('manzana');
    expect(gloss('vocab:sagwa-apple#empty', 'apple')).toBeUndefined();
    expect(gloss('vocab:other#gloss', 'pear')).toBeUndefined();
    expect(gloss('nohash', 'x')).toBeUndefined();
    expect(gloss(undefined, 'y')).toBeUndefined();
    // English: the meaning as authored.
    expect(glossFrom(undefined)('vocab:sagwa-apple#gloss', 'apple')).toBe('apple');
    expect(glossFrom(undefined)(undefined, 'apple')).toBe('apple');
  });
});

describe('Syllable Build at the produce rung (row CM-32, behind game.syllable-build)', () => {
  const ON = new Set(['syllable-build'] as const);
  const BLOCKS = [
    mk('syl:bap', { ko: '밥', romanization: 'bap' }),
    mk('syl:san', { ko: '산', romanization: 'san' }),
    mk('syl:go', { ko: '고', romanization: 'go' }),
    mk('lex:but', { ko: '붓', romanization: 'but', en: 'writing brush' }),
    mk('lex:but2', { ko: '붓', romanization: 'but' }),
    mk('lex:hanbok', { ko: '한복', romanization: 'hanbok', en: 'hanbok' }),
    mk('sym:bieup', { ko: 'ㅂ', romanization: 'b/p' }),
    mk('sym:o2', { ko: 'ㅗ', romanization: 'o' }),
    mk('sym:nieun-batchim', { ko: 'ㄴ', romanization: 'n' }),
    mk('sym:kieuk', { ko: 'ㅋ', romanization: 'k' }),
  ];
  const games = surfaceIndex(indexOf(BLOCKS), ON);
  const gameInput = (over: Partial<RoundInput> = {}): RoundInput => ({ index: games, gloss: (_k, en) => en, seed: 's', ...over });

  it('is off until its switch is on: the engine never picks it, so the item is asked another way', () => {
    expect(surfaceFormats(mk('syl:bap', { ko: '밥' }))).not.toContain('syllable-build');
    expect(surfaceFormats(mk('syl:bap', { ko: '밥' }), NO_GAME_FORMATS)).not.toContain('syllable-build');
    expect(surfaceFormats(mk('syl:bap', { ko: '밥' }), ON)).toEqual(['hear-pick', 'read-pick', 'syllable-build']);
    expect(surfaceIndex(indexOf(BLOCKS))).not.toBe(games);
    expect(surfaceIndex(indexOf(BLOCKS), ON)).not.toBe(games);
    const base = indexOf(BLOCKS);
    expect(surfaceIndex(base, ON)).toBe(surfaceIndex(base, new Set(['syllable-build'] as const)));
  });

  it('asks a symbol, a block and a one-block word; never a word of two blocks; a final heard as another only with the meaning', () => {
    expect(surfaceFormats(mk('sym:a', { ko: 'ㅏ' }), ON)).toEqual(['read-pick', 'syllable-build']);
    expect(surfaceFormats(mk('lex:hanbok', { ko: '한복', en: 'hanbok' }), ON)).not.toContain('syllable-build');
    expect(surfaceFormats(mk('lex:but', { ko: '붓', en: 'writing brush' }), ON)).toContain('syllable-build');
    expect(surfaceFormats(mk('syl:but', { ko: '붓' }), ON)).not.toContain('syllable-build');
    expect(surfaceFormats(mk('syl:dalk', { ko: '닭' }), ON)).not.toContain('syllable-build');
  });

  it('a block round builds the item itself, with its meaning when it is a word; the tiles are the round screen own', () => {
    const r = roundFor(q('syl:bap', 'syllable-build'), gameInput()) as BuildRound;
    expect(r).toEqual({ type: 'build', question: q('syl:bap', 'syllable-build'), target: { ko: '밥', romanization: 'bap' }, answer: { ko: { ko: '밥', romanization: 'bap' } } });
    const w = roundFor(q('lex:but', 'syllable-build'), gameInput()) as BuildRound;
    expect(w).toMatchObject({ target: { ko: '붓' }, gloss: 'writing brush', answer: { gloss: 'writing brush' } });
    // In es or ko with the meaning not loaded, a final heard as another is not built (no settling cue).
    expect(roundFor(q('lex:but', 'syllable-build'), gameInput({ gloss: () => undefined }))).toBeNull();
    expect(roundFor(q('lex:hanbok', 'syllable-build'), gameInput())).toBeNull();
  });

  it('a symbol round builds a taught block with the symbol already in its zone: first letter, vowel or final', () => {
    const first = roundFor(q('sym:bieup', 'syllable-build'), gameInput()) as BuildRound;
    expect(first).toMatchObject({ type: 'build', target: { ko: '밥' }, fixed: 'first' });
    const vowel = roundFor(q('sym:o2', 'syllable-build'), gameInput()) as BuildRound;
    expect(vowel).toMatchObject({ target: { ko: '고' }, fixed: 'vowel' });
    const final = roundFor(q('sym:nieun-batchim', 'syllable-build'), gameInput()) as BuildRound;
    expect(final).toMatchObject({ target: { ko: '산' }, fixed: 'final' });
    // No taught block holds ㅋ: the surface index leaves the format out, so the engine asks it at read and the session
    // never drops it for want of a round; a symbol a block holds keeps it.
    expect(games.byId.get('sym:kieuk')?.formats).toEqual(['read-pick']);
    expect(games.byId.get('sym:bieup')?.formats).toEqual(['read-pick', 'syllable-build']);
    expect(roundFor(q('sym:kieuk', 'syllable-build'), gameInput())).toBeNull();
  });
});
describe('Match Shape at the produce rung (row CM-33, behind game.match-shape)', () => {
  const GAMES = new Set<ReviewFormat>(['match-shape']);
  const letter = (id: string, ko: string, romanization: string): ReviewItem => mk(id, { ko, romanization, home: 'letters', stage: 1, cells: ['episode:stage1-letters'] });
  const LETTERS = [
    letter('sym:bieup', 'ㅂ', 'b/p'),
    letter('sym:pieup', 'ㅍ', 'p'),
    letter('sym:eo', 'ㅓ', 'eo'),
    letter('sym:o', 'ㅗ', 'o'),
    letter('sym:rieul', 'ㄹ', 'r/l'),
    letter('sym:bieup-batchim', 'ㅂ', 'p'),
    letter('sym:siot', 'ㅅ', 's'),
  ];

  it('is drawn only while the switch is on, for a letter with a look-alike, never a final', () => {
    expect(surfaceFormats(LETTERS[0]!)).toEqual(['read-pick']);
    expect(surfaceFormats(LETTERS[0]!, NO_GAME_FORMATS)).toEqual(['read-pick']);
    expect(surfaceFormats(LETTERS[0]!, GAMES)).toEqual(['read-pick', 'match-shape']);
    expect(surfaceFormats(LETTERS[5]!, GAMES)).toEqual(['read-pick']);
    expect(surfaceFormats(LETTERS[6]!, GAMES)).toEqual(['read-pick']);
  });

  it('surfaceIndex keeps one cut per set of games', () => {
    const base = indexOf(LETTERS);
    const off = surfaceIndex(base);
    const on = surfaceIndex(base, GAMES);
    expect(on).not.toBe(off);
    expect(surfaceIndex(base, new Set<ReviewFormat>(['match-shape']))).toBe(on);
    expect(off.byId.get('sym:bieup')?.formats).toEqual(['read-pick']);
    expect(on.byId.get('sym:bieup')?.formats).toEqual(['read-pick', 'match-shape']);
  });

  it('a pair round of the letter and its taught look-alike, the answer its letter', () => {
    const index = surfaceIndex(indexOf(LETTERS), GAMES);
    const round = roundFor(q('sym:bieup', 'match-shape'), { index, gloss: (_k, en) => en, seed: 's' }) as ShapeRound;
    expect(round).toMatchObject({ type: 'shape', target: 'jamo:bieup', lookAlike: 'jamo:pieup', answer: { ko: { ko: 'ㅂ', romanization: 'b/p' } } });
    const other = roundFor(q('sym:eo', 'match-shape'), { index, gloss: (_k, en) => en, seed: 's' }) as ShapeRound;
    expect([other.target, other.lookAlike]).toEqual(['jamo:eo', 'jamo:o']);
  });

  it('with the learner\'s states, a letter is asked as a pair round only once its look-alike is met (box 1 or more)', () => {
    const base = indexOf(LETTERS);
    const row = (b: number) => ({ st: { b, d: null, c: 0, r: 0, n: 0, f: '2026-10-01', s: b, at: '' } });
    // ㅂ met, ㅍ not met yet (no state, then box 0): ㅂ is asked another way, so no pair round shows ㅍ untaught.
    for (const states of [{ 'sym:bieup': row(3) }, { 'sym:bieup': row(3), 'sym:pieup': row(0) }]) {
      const index = surfaceIndex(base, GAMES, states);
      expect(index.byId.get('sym:bieup')?.formats).toEqual(['read-pick']);
    }
    // Both met: the pair round is open; the per-learner cut is never the shared cached one.
    const met = surfaceIndex(base, GAMES, { 'sym:bieup': row(3), 'sym:pieup': row(1) });
    expect(met.byId.get('sym:bieup')?.formats).toEqual(['read-pick', 'match-shape']);
    expect(met).not.toBe(surfaceIndex(base, GAMES));
    // With the switch off the states change nothing.
    expect(surfaceIndex(base, NO_GAME_FORMATS, { 'sym:bieup': row(3) })).toBe(surfaceIndex(base));
  });

  it('cannot be played when the look-alike is not taught, or the item is not a letter with one', () => {
    const index = surfaceIndex(indexOf(LETTERS.filter((i) => i.id !== 'sym:pieup')), GAMES);
    const input = { index, gloss: (_k: string | undefined, en: string | undefined) => en, seed: 's' };
    expect(roundFor(q('sym:bieup', 'match-shape'), input)).toBeNull();
    expect(roundFor(q('sym:rieul', 'match-shape'), input)).toBeNull();
    expect(roundFor(q('sym:siot', 'match-shape'), input)).toBeNull();
  });
});
