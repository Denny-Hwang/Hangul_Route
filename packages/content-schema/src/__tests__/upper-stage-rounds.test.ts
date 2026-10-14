import { describe, expect, it } from 'vitest';
import {
  DiscoverItemSchema,
  DiscoverPageSchema,
  MinigameKindSchema,
  OrderItRoundSchema,
  REALIA_REF_RE,
  RealiaOptionSchema,
  RealiaReadRoundSchema,
  RealiaSchema,
  RoundSchema,
  SLOT_MARKER,
  TraceWordRoundSchema,
  TypeHangulRoundSchema,
  WriteFrameRoundSchema,
  discoverItemTexts,
  slotCount,
} from '../index';
import { kt } from './helpers/lesson-fixtures';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('minigame kinds (F-CURR-001 §3.10)', () => {
  it('adds realia-read, type-hangul, trace-word and write-frame without removing any kind', () => {
    expect(MinigameKindSchema.options.slice(-4)).toEqual(['realia-read', 'type-hangul', 'trace-word', 'write-frame']);
    expect(MinigameKindSchema.options).toContain('order-it');
    expect(MinigameKindSchema.options).toContain('voice-echo');
  });

  it('carries each new round in RoundSchema under its kind', () => {
    expect(ok(RoundSchema, { kind: 'trace-word', data: { id: 'r', word: kt('호야', 'hoya', 'Hoya') } })).toBe(true);
    expect(ok(RoundSchema, { kind: 'type-hangul', data: { id: 'r', promptEn: 'Type it', target: kt('물', 'mul', 'water') } })).toBe(true);
    expect(ok(RoundSchema, { kind: 'order-it', data: { id: 'r', sentence: kt('물을 마셔요.', 'mureul masyeoyo', 'I drink water') } })).toBe(true);
    expect(ok(RoundSchema, { kind: 'trace-word', data: { id: 'r', target: kt('호야', 'hoya', 'Hoya') } })).toBe(false);
  });
});

describe('Discover item types: sentence, pattern, exchange, realia', () => {
  it('parses a sentence with an optional picture', () => {
    expect(ok(DiscoverItemSchema, { type: 'sentence', sentence: kt('책이 있어요.', 'chaegi isseoyo', 'there is a book'), picture: 'word:book' })).toBe(true);
    expect(ok(DiscoverItemSchema, { type: 'sentence', sentence: kt('책', '', 'book') })).toBe(false);
  });

  it('parses a pattern: one slot marker, a note and exactly two examples', () => {
    const pattern = {
      type: 'pattern',
      frame: kt('___이 있어요', '___i isseoyo', 'there is ___'),
      noteEn: 'Use {ko:이} after a final consonant, {ko:가} after a vowel.',
      examples: [kt('책이 있어요', 'chaegi isseoyo', 'there is a book'), kt('친구가 있어요', 'chinguga isseoyo', 'I have a friend')],
    };
    expect(ok(DiscoverItemSchema, pattern)).toBe(true);
    expect(ok(DiscoverItemSchema, { ...pattern, frame: kt('책이 있어요', 'chaegi isseoyo', 'there is a book') })).toBe(false);
    expect(ok(DiscoverItemSchema, { ...pattern, frame: kt('___하고 ___', '___hago ___', '___ and ___') })).toBe(false);
    expect(ok(DiscoverItemSchema, { ...pattern, examples: [pattern.examples[0]] })).toBe(false);
    expect(ok(DiscoverItemSchema, { ...pattern, noteEn: '' })).toBe(false);
  });

  it('parses an exchange: speaker a then speaker b, each named', () => {
    const exchange = {
      type: 'exchange',
      lines: [
        { speaker: 'a', speakerEn: 'Hoya', line: kt('이게 뭐예요?', 'ige mwoyeyo', 'what is this?') },
        { speaker: 'b', speakerEn: 'Teacher', line: kt('책이에요.', 'chaegieyo', 'it is a book') },
      ],
    };
    expect(ok(DiscoverItemSchema, exchange)).toBe(true);
    expect(ok(DiscoverItemSchema, { ...exchange, lines: [exchange.lines[1], exchange.lines[0]] })).toBe(false);
    expect(ok(DiscoverItemSchema, { ...exchange, lines: [exchange.lines[0]] })).toBe(false);
  });

  it('parses realia: a realia ref and 1-6 key words', () => {
    const words = ['김밥', '라면', '떡볶이', '비빔밥', '물', '차', '우유'].map((w) => kt(w, 'x', 'y'));
    const realia = { type: 'realia', realiaRef: 'realia:snack-menu', keyWords: words.slice(0, 6), captionEn: 'A snack-bar menu board' };
    expect(ok(DiscoverItemSchema, realia)).toBe(true);
    expect(ok(DiscoverItemSchema, { ...realia, keyWords: words })).toBe(false);
    expect(ok(DiscoverItemSchema, { ...realia, keyWords: [] })).toBe(false);
    expect(ok(DiscoverItemSchema, { ...realia, realiaRef: 'scene:menu' })).toBe(false);
    expect(REALIA_REF_RE.test('realia:train-ticket')).toBe(true);
  });

  it('keeps the two-items-per-page cap and the existing jamo and word items', () => {
    const word = { type: 'word', word: kt('연', 'yeon', 'kite') };
    expect(ok(DiscoverPageSchema, { items: [word, word] })).toBe(true);
    expect(ok(DiscoverPageSchema, { items: [word, word, word] })).toBe(false);
  });

  it('discoverItemTexts gives the taught Korean of every item type (a pattern\'s frame is not a word)', () => {
    const t = (ko: string) => kt(ko, 'x', 'y');
    const items = [
      { type: 'jamo', jamoId: 'jamo:a', example: t('나') },
      { type: 'word', word: t('연') },
      { type: 'sentence', sentence: t('책이 있어요.') },
      { type: 'pattern', frame: t('___이에요/예요'), noteEn: 'n', examples: [t('책이에요'), t('학교예요')] },
      {
        type: 'exchange',
        lines: [
          { speaker: 'a', speakerEn: 'Hoya', line: t('이게 뭐예요?') },
          { speaker: 'b', speakerEn: 'Mina', line: t('책이에요.') },
        ],
      },
      { type: 'realia', realiaRef: 'realia:menu', keyWords: [t('김밥'), t('라면')] },
    ].map((i) => DiscoverItemSchema.parse(i));
    expect(items.map((i) => discoverItemTexts(i).map((x) => x.ko))).toEqual([
      ['나'],
      ['연'],
      ['책이 있어요.'],
      ['책이에요', '학교예요'],
      ['이게 뭐예요?', '책이에요.'],
      ['김밥', '라면'],
    ]);
  });

  it('counts slot markers', () => {
    expect(SLOT_MARKER).toBe('___');
    expect(slotCount('___에 ___을/를 먹었어요')).toBe(2);
    expect(slotCount('먹었어요')).toBe(0);
  });
});

describe('OrderItRoundSchema (Sentence Builder)', () => {
  const sentence = kt('친구가 있어요.', 'chinguga isseoyo', 'I have a friend');
  const i = kt('이', 'i', 'subject marker');
  const ga = kt('가', 'ga', 'subject marker');

  it('builds from 2-6 word tiles split at spaces', () => {
    expect(ok(OrderItRoundSchema, { id: 'r', sentence })).toBe(true);
    expect(ok(OrderItRoundSchema, { id: 'r', sentence: kt('맛있어요.', 'masisseoyo', 'it is tasty') })).toBe(false);
    expect(ok(OrderItRoundSchema, { id: 'r', sentence: kt('가 나 다 라 마 바 사', 'x', 'y') })).toBe(false);
  });

  it('takes up to two distractor tiles that are not tiles of the sentence', () => {
    expect(ok(OrderItRoundSchema, { id: 'r', sentence, distractors: [kt('없어요.', 'eopseoyo', 'there is none')] })).toBe(true);
    expect(ok(OrderItRoundSchema, { id: 'r', sentence, distractors: [kt('있어요.', 'isseoyo', 'there is')] })).toBe(false);
    const three = [kt('가', 'ga', 'x'), kt('나', 'na', 'x'), kt('다', 'da', 'x')];
    expect(ok(OrderItRoundSchema, { id: 'r', sentence, distractors: three })).toBe(false);
  });

  it('a particle choice has exactly one choice that ends the chosen tile', () => {
    expect(ok(OrderItRoundSchema, { id: 'r', sentence, particle: { tile: 0, choices: [i, ga] } })).toBe(true);
    expect(ok(OrderItRoundSchema, { id: 'r', sentence, particle: { tile: 0, choices: [ga, ga] } })).toBe(false);
    expect(ok(OrderItRoundSchema, { id: 'r', sentence, particle: { tile: 1, choices: [i, ga] } })).toBe(false);
    expect(ok(OrderItRoundSchema, { id: 'r', sentence, particle: { tile: 5, choices: [i, ga] } })).toBe(false);
  });
});

describe('Realia Read', () => {
  const realia = {
    ref: 'realia:snack-menu',
    title: kt('메뉴', 'menyu', 'menu'),
    entries: [{ id: 'e1', text: kt('김밥', 'gimbap', 'gimbap'), value: kt('천 원', 'cheon won', '1,000 won') }],
    altEn: 'A snack-bar menu board',
  };

  it('parses a drawn text whose entries are real text', () => {
    expect(ok(RealiaSchema, realia)).toBe(true);
    expect(ok(RealiaSchema, { ...realia, entries: [] })).toBe(false);
    expect(ok(RealiaSchema, { ...realia, altEn: '' })).toBe(false);
  });

  it('an option is exactly one of text, a figure without Hangul, or a picture', () => {
    expect(ok(RealiaOptionSchema, { id: 'a', text: kt('김밥', 'gimbap', 'gimbap') })).toBe(true);
    expect(ok(RealiaOptionSchema, { id: 'a', figure: '5,000' })).toBe(true);
    expect(ok(RealiaOptionSchema, { id: 'a', pictureRef: 'word:gimbap' })).toBe(true);
    expect(ok(RealiaOptionSchema, { id: 'a', figure: '천 원' })).toBe(false);
    expect(ok(RealiaOptionSchema, { id: 'a' })).toBe(false);
    expect(ok(RealiaOptionSchema, { id: 'a', figure: '1', pictureRef: 'word:gimbap' })).toBe(false);
  });

  it('a round has unique option ids and an answer among them', () => {
    const round = { id: 'r', questionEn: 'How much is gimbap?', options: [{ id: 'a', figure: '1,000' }, { id: 'b', figure: '5,000' }], answerId: 'a' };
    expect(ok(RealiaReadRoundSchema, round)).toBe(true);
    expect(ok(RealiaReadRoundSchema, { ...round, answerId: 'c' })).toBe(false);
    expect(ok(RealiaReadRoundSchema, { ...round, options: [round.options[0], round.options[0]] })).toBe(false);
  });
});

describe('Type Hangul and Trace a Word', () => {
  it('a typed target is 1-12 characters of syllables and single spaces', () => {
    const round = (ko: string) => ({ id: 'r', promptEn: 'Type it', target: kt(ko, 'x', 'y') });
    expect(ok(TypeHangulRoundSchema, round('김밥 하나'))).toBe(true);
    expect(ok(TypeHangulRoundSchema, round('김밥  하나'))).toBe(false);
    expect(ok(TypeHangulRoundSchema, round('ㄱ'))).toBe(false);
    expect(ok(TypeHangulRoundSchema, round('김밥!'))).toBe(false);
    expect(ok(TypeHangulRoundSchema, round('가'.repeat(13)))).toBe(false);
  });

  it('a traced word is one or two syllable blocks', () => {
    const round = (ko: string) => ({ id: 'r', word: kt(ko, 'x', 'y') });
    expect(ok(TraceWordRoundSchema, round('호'))).toBe(true);
    expect(ok(TraceWordRoundSchema, { ...round('호야'), tolerancePx: 24 })).toBe(true);
    expect(ok(TraceWordRoundSchema, round('한국어'))).toBe(false);
    expect(ok(TraceWordRoundSchema, round('ㅎ'))).toBe(false);
  });
});

describe('WriteFrameRoundSchema', () => {
  const frame = kt('저는 ___을/를 좋아해요', 'jeoneun ___eul/reul joahaeyo', 'I like ___');
  const bank = [kt('사과', 'sagwa', 'apple'), kt('떡', 'tteok', 'rice cake')];

  it('has one bank of 2-6 taught words per slot', () => {
    expect(ok(WriteFrameRoundSchema, { id: 'r', frame, slots: [{ id: 'what', bank }], entry: 'type' })).toBe(true);
    expect(ok(WriteFrameRoundSchema, { id: 'r', frame, slots: [{ id: 'what', bank: [bank[0]] }], entry: 'type' })).toBe(false);
    expect(ok(WriteFrameRoundSchema, { id: 'r', frame, slots: [{ id: 'a', bank }, { id: 'b', bank }], entry: 'type' })).toBe(false);
    expect(ok(WriteFrameRoundSchema, { id: 'r', frame, slots: [{ id: 'what', bank: [...bank, kt('사과!', 'x', 'y')] }], entry: 'trace' })).toBe(false);
    expect(ok(WriteFrameRoundSchema, { id: 'r', frame, slots: [{ id: 'what', bank }], entry: 'speak' })).toBe(false);
  });

  it('takes two slots when the frame has two', () => {
    const two = kt('___에 ___을/를 먹었어요', '___e ___eul/reul meogeosseoyo', 'at ___ I ate ___');
    expect(ok(WriteFrameRoundSchema, { id: 'r', frame: two, slots: [{ id: 'when', bank }, { id: 'what', bank }], entry: 'pick' })).toBe(true);
  });

  it('a free-entry round (Write Your Name q3) has one slot and no bank', () => {
    const name = kt('제 이름은 ___이에요/예요', 'je ireumeun ___ieyo/yeyo', 'my name is ___');
    expect(WriteFrameRoundSchema.parse({ id: 'r', frame: name, slots: [{ id: 'name' }], entry: 'type', freeEntry: true }).slots[0]?.bank).toEqual([]);
    expect(ok(WriteFrameRoundSchema, { id: 'r', frame: name, slots: [{ id: 'name', bank }], entry: 'type', freeEntry: true })).toBe(false);
    const two = kt('___ ___', '___ ___', '___ ___');
    expect(ok(WriteFrameRoundSchema, { id: 'r', frame: two, slots: [{ id: 'a' }, { id: 'b' }], entry: 'type', freeEntry: true })).toBe(false);
    expect(WriteFrameRoundSchema.parse({ id: 'r', frame, slots: [{ id: 'what', bank }], entry: 'type' }).freeEntry).toBe(false);
  });
});
