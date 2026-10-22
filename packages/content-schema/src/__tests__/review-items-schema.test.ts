import { describe, expect, it } from 'vitest';
import {
  FORMATS_BY_KIND,
  FORMAT_RUNG,
  REVIEW_FORMATS,
  ReviewItemIdSchema,
  ReviewItemSchema,
  decodeReviewItem,
  decodeReviewItems,
  encodeReviewItems,
  formatMask,
  formatsOfMask,
  isRetired,
  kindOfId,
  masteryDenominator,
  packGlossKey,
  selectableIds,
  unpackGlossKey,
  type ReviewItem,
} from '../review-items/review-item';

// F-CURR-002 §4.2, §4.3, §10 (row CM-10): the review-item shape, its ids, its formats and the compact
// rows of the lazy chunk.

const word: ReviewItem = {
  id: 'lex:bae~pear',
  kind: 'lex',
  ko: '배',
  romanization: 'bae',
  en: 'pear',
  glossKey: 'quest:stage2-life-q2#steps.s2.discover.pages.1.items.0.word.gloss',
  picture: 'word:food-pear',
  home: 'life',
  stage: 2,
  volume: 1,
  cells: ['episode:stage2-life', 'story:gimjang-arirang'],
  formats: ['hear-pick', 'read-pick', 'type-see', 'type-picture'],
  soundChange: false,
  homophoneOf: [],
};
const exchange: ReviewItem = {
  id: 'exc:ige-mwoyeyo',
  kind: 'exc',
  ko: '이게 뭐예요?',
  romanization: 'ige mwoyeyo?',
  en: 'What is this?',
  glossKey: 'minigame:s4-letters-q1-play#dialogue.0.npc',
  reply: { ko: '사과예요.', romanization: 'sagwayeyo', en: 'It is an apple.', glossKey: 'minigame:s4-letters-q1-play#dialogue.0.options.sagwayeyo.gloss' },
  home: 'pack:numbers-time',
  stage: 4,
  volume: 2,
  cells: ['episode:pack-numbers-time-s4'],
  formats: ['hear-pick', 'read-pick'],
  soundChange: true,
  homophoneOf: ['exc:other'],
};
const symbol: ReviewItem = {
  id: 'sym:bieup',
  kind: 'sym',
  ko: 'ㅂ',
  romanization: 'b/p',
  home: 'life',
  stage: 1,
  volume: 1,
  cells: ['episode:stage1-life'],
  formats: ['hear-pick', 'read-pick', 'syllable-build', 'match-shape'],
  soundChange: false,
  homophoneOf: [],
};
const topicWord: ReviewItem = { ...word, id: 'vocab:sagwa-apple', ko: '사과', romanization: 'sagwa', en: 'apple', glossKey: 'vocab:sagwa-apple#gloss', cells: ['episode:stage2-life'] };

describe('review-item ids', () => {
  it('reads the kind from the id, and a topic word is a word', () => {
    expect(kindOfId('lex:bae~pear')).toBe('lex');
    expect(kindOfId('pat:n-juseyo')).toBe('pat');
    expect(kindOfId('sym:bieup-batchim')).toBe('sym');
    expect(kindOfId('lex:nat~2')).toBe('lex');
    expect(kindOfId('vocab:sagwa-apple')).toBe('lex');
    expect(kindOfId('word:sagwa')).toBeUndefined();
    expect(kindOfId('lex:Sagwa')).toBeUndefined();
    expect(kindOfId('lex:bae~')).toBeUndefined();
    expect(ReviewItemIdSchema.safeParse('rea:menu-prices').success).toBe(true);
    expect(ReviewItemIdSchema.safeParse('lex:사과').success).toBe(false);
  });
});

describe('ReviewItemSchema', () => {
  it('accepts a word, an exchange and a symbol', () => {
    for (const item of [word, exchange, symbol, topicWord]) expect(ReviewItemSchema.safeParse(item).success, item.id).toBe(true);
  });

  it('refuses an id of another kind, a reply on anything but an exchange, a format the kind never uses, and repeats', () => {
    const messages = (item: unknown): string[] => {
      const r = ReviewItemSchema.safeParse(item);
      return r.success ? [] : r.error.issues.map((i) => i.message);
    };
    expect(messages({ ...word, kind: 'pat' })).toEqual(['the id lex:bae~pear does not name a pat item', 'a pat item is never asked as type-see', 'a pat item is never asked as type-picture']);
    expect(messages({ ...word, reply: exchange.reply })).toEqual(['an exchange (exc) carries its reply, and no other kind does']);
    expect(messages({ ...exchange, reply: undefined })).toEqual(['an exchange (exc) carries its reply, and no other kind does']);
    expect(messages({ ...symbol, formats: ['hear-pick', 'hear-pick'] })).toEqual(['a format is listed once']);
    expect(messages({ ...symbol, cells: ['episode:stage1-life', 'episode:stage1-life'] })).toEqual(['a cell is listed once']);
    expect(messages({ ...symbol, homophoneOf: ['sym:bieup'] })).toEqual(['an item is not its own homophone']);
    expect(messages({ ...symbol, cells: ['quest:stage1-life-q1'] })).toHaveLength(1);
    expect(messages({ ...symbol, home: 'pack:' })).toHaveLength(1);
  });
});

describe('formats', () => {
  it('maps each format to its rung, and each kind to the formats of §4.3', () => {
    expect(REVIEW_FORMATS.filter((f) => FORMAT_RUNG[f] === 'recognize')).toEqual(['hear-pick']);
    expect(REVIEW_FORMATS.filter((f) => FORMAT_RUNG[f] === 'read')).toEqual(['read-pick']);
    expect(FORMATS_BY_KIND.rea).toEqual(['read-pick', 'cloze-pick']);
    expect(Object.values(FORMATS_BY_KIND).every((list) => list.every((f) => REVIEW_FORMATS.includes(f)))).toBe(true);
  });

  it('round-trips a set of formats through its bitmask', () => {
    for (const formats of [[], ['dictation'], [...REVIEW_FORMATS], ['hear-pick', 'cloze-pick']] as const) {
      expect(formatsOfMask(formatMask(formats))).toEqual([...formats]);
    }
  });
});

describe('the chunk rows', () => {
  it('round-trip every field: tables, gloss keys, a reply, derived romanization, flags', () => {
    const items = [word, exchange, symbol, topicWord];
    const { tables, rows } = encodeReviewItems(items);
    expect(tables.cells).toEqual(['stage2-life', 'story:gimjang-arirang', 'pack-numbers-time-s4', 'stage1-life']);
    expect(tables.homes).toEqual(['life', 'pack:numbers-time']);
    expect(decodeReviewItems({ REVIEW_ITEM_TABLES: tables, REVIEW_ITEM_ROWS: rows })).toEqual(items);
    // The converter's reading is not stored; a romanization that differs from it is.
    expect(rows[0]?.[2]).toBe('');
    expect(rows[1]?.[2]).toBe('ige mwoyeyo?');
    expect(rows[2]?.[2]).toBe('b/p');
    // A topic word's gloss key is its own id's.
    expect(rows[3]?.[4]).toBe('=');
    // stage 4, volume 2, sound change
    expect(rows[1]?.[6]).toBe(4 | (2 << 3) | (1 << 8));
  });

  it('decodes a row without gloss, picture or reply', () => {
    const { tables, rows } = encodeReviewItems([{ ...exchange, en: undefined, glossKey: undefined, reply: { ko: '네.', romanization: 'ne' } }]);
    const item = decodeReviewItem(rows[0] as (typeof rows)[number], tables);
    expect(item.en).toBeUndefined();
    expect(item.glossKey).toBeUndefined();
    expect(item.reply).toEqual({ ko: '네.', romanization: 'ne' });
    expect(item.picture).toBeUndefined();
  });

  it('abbreviates a gloss key reversibly, and leaves an unknown token alone', () => {
    const keys = [
      'quest:stage2-life-q1#steps.s2.discover.pages.0.items.1.word.gloss',
      'minigame:s6-life-q2-check#realiaRead.rounds.r1.options.b.text.gloss',
      'minigame:s3-life-q1-apply#orderIt.rounds.o1.sentence.gloss',
      'minigame:s7-letters-q3-apply#writeFrame.rounds.w1.slots.s1.bank.hangeul.gloss',
      'story:sun-and-moon#keywords.dal.gloss',
      'story:sun-and-moon#checks.r1.options.b',
      'minigame:s1-life-q1-apply#picWord.boards.0.pairs.p1.word.gloss',
      'minigame:s1-life-q3-apply#cardPairs.tomato.gloss',
      'minigame:s1-rites-q3-apply#storySteps.a.label',
      'minigame:s2-life-q1-check#listenPick.rounds.r1.prompt',
      'minigame:s4-life-q1-play#dialogue.0.npc',
      'minigame:s7-life-q1-play#typeHangul.rounds.t1.target.gloss',
      'minigame:s7-life-q2-play#traceWord.rounds.t1.word.gloss',
    ];
    for (const key of keys) {
      const packed = packGlossKey(key, 'lex:x');
      expect(packed.length).toBeLessThan(key.length);
      expect(unpackGlossKey(packed, 'lex:x')).toBe(key);
    }
    expect(packGlossKey(undefined, 'lex:x')).toBe('');
    expect(unpackGlossKey('', 'lex:x')).toBeUndefined();
    expect(unpackGlossKey('=', 'vocab:kkot')).toBe('vocab:kkot#gloss');
    expect(unpackGlossKey('vocab:kkot#^z', 'lex:x')).toBe('vocab:kkot#^z');
  });
});

describe('retired ids (§4.2)', () => {
  const items = [word, { ...symbol, cells: ['episode:stage2-life'] }, { ...topicWord, volume: 2 }];
  it('are never selected and stay out of the mastery denominator', () => {
    expect(isRetired('sym:bieup', ['sym:bieup'])).toBe(true);
    expect(isRetired('sym:bieup', new Set<string>())).toBe(false);
    expect(selectableIds(['lex:bae~pear', 'sym:bieup'], new Set(['sym:bieup']))).toEqual(['lex:bae~pear']);
    expect(masteryDenominator(items, 'episode:stage2-life', [1], [])).toEqual(['lex:bae~pear', 'sym:bieup']);
    expect(masteryDenominator(items, 'episode:stage2-life', [1, 2], ['sym:bieup'])).toEqual(['lex:bae~pear', 'vocab:sagwa-apple']);
    expect(masteryDenominator(items, 'episode:stage3-life', [1, 2], [])).toEqual([]);
  });
});
