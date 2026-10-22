import { describe, expect, it } from 'vitest';
import { reviewItemsOf, serializeSnapshot, serializeStage1Table, stage1Table } from '../review-items/build';
import type { ItemOccurrence } from '../review-items/extract';
import {
  EMPTY_SNAPSHOT,
  StableIdSnapshotSchema,
  allowedFormats,
  buildReviewItems,
  identityOf,
  koSlug,
  senseFor,
  vocabIndex,
  type StableIdSnapshot,
  type TopicWord,
} from '../review-items/stable-ids';

// F-CURR-002 §4.2 and the `items-stable-id` rule of §9.3 (row CM-10): keys, derived ids, frozen ids,
// aliases and retirements.

const WORDS: TopicWord[] = [
  { id: 'vocab:bae-belly', ko: '배', en: 'belly', senseGroup: 'bae' },
  { id: 'vocab:bae-boat', ko: '배', en: 'boat', senseGroup: 'bae', visual: 'word:travel-boat' },
  { id: 'vocab:eonni', ko: '언니', en: 'older sister (said by a woman or girl)', senseGroup: 'older-sister' },
  { id: 'vocab:nuna', ko: '누나', en: 'older sister (said by a man or boy)', senseGroup: 'older-sister' },
  { id: 'vocab:mul', ko: '물', en: 'water', visual: 'swatch:blue' },
  { id: 'vocab:yeol-ten', ko: '열', en: 'ten', senseGroup: 'yeol' },
];
const GROUPS = [
  {
    group: 'bae',
    members: [
      { id: 'vocab:bae-belly', en: 'belly', state: 'launch' },
      { id: 'vocab:bae-boat', en: 'boat', state: 'launch' },
      { id: 'vocab:bae-pear', en: 'pear', state: 'reserved' },
    ],
  },
  {
    group: 'older-sister',
    members: [
      { id: 'vocab:eonni', en: 'older sister', state: 'launch' },
      { id: 'vocab:nuna', en: 'older sister', state: 'launch' },
    ],
  },
  { group: 'yeol', members: [{ id: 'vocab:yeol-ten', en: 'ten', state: 'launch' }, { id: 'vocab:yeol-fever', en: 'fever, heat', state: 'reserved' }] },
  { group: 'unused', members: [{ id: 'vocab:x-y', en: 'x', state: 'reserved' }] },
];
const vocab = vocabIndex(WORDS, GROUPS);

let n = 0;
const occ = (o: Partial<ItemOccurrence> & Pick<ItemOccurrence, 'kind' | 'ko'>): ItemOccurrence => ({
  romanization: '',
  cell: 'episode:stage2-life',
  home: 'life',
  stage: 2,
  volume: 1,
  source: 'round',
  at: `content/episodes/stage-2/life.json quests[0].scopes[${(n += 1)}]`,
  ...o,
});
const snap = (ids: Record<string, string>, extra: Partial<StableIdSnapshot> = {}): StableIdSnapshot => ({ schemaVersion: 1, ids, alias: {}, retired: [], ...extra });

describe('vocabIndex and senses', () => {
  it('knows a homograph by its spelling, with the reserved senses of its group', () => {
    expect(vocab.senses.get('배')?.map((c) => c.id)).toEqual(['vocab:bae-belly', 'vocab:bae-boat', 'vocab:bae-pear']);
    expect(vocab.senses.get('열')?.map((c) => c.id)).toEqual(['vocab:yeol-ten', 'vocab:yeol-fever']);
    // A group of two spellings holds no homograph: 언니 and 누나 are each one topic word.
    expect(vocab.senses.has('언니')).toBe(false);
    expect(vocab.words.get('언니')?.id).toBe('vocab:eonni');
    expect(vocab.words.get('물')?.id).toBe('vocab:mul');
    expect(vocab.words.has('배')).toBe(false);
  });

  it('reads the sense a gloss names: any of its terms, the earliest winning', () => {
    const bae = vocab.senses.get('배') ?? [];
    expect(senseFor('pear', bae)?.id).toBe('vocab:bae-pear');
    expect(senseFor('a boat (to ride)', bae)?.id).toBe('vocab:bae-boat');
    expect(senseFor('stomach, belly; boat', bae)?.id).toBe('vocab:bae-belly');
    expect(senseFor('heat', vocab.senses.get('열') ?? [])?.id).toBe('vocab:yeol-fever');
    expect(senseFor('ship', bae)).toBeUndefined();
    expect(senseFor(undefined, bae)).toBeUndefined();
  });
});

describe('keys and derived ids', () => {
  it('slugs the F-CNT-002 romanization; a frame slot reads n, both forms of a pair are read', () => {
    expect(koSlug('사과')).toBe('sagwa');
    expect(koSlug('___ 주세요.')).toBe('n-juseyo');
    expect(koSlug('___을/를 좋아해요.')).toBe('n-eul-reul-joahaeyo');
    expect(koSlug('???')).toBe('item');
    const long = koSlug('선생님 안녕하세요 새해 복 많이 받으세요 올해도 건강하세요');
    expect(long.length).toBeLessThanOrEqual(48);
    expect(long.endsWith('-')).toBe(false);
    expect(koSlug('가'.repeat(30)).length).toBe(48);
  });

  it('gives each kind its key and its id', () => {
    expect(identityOf(occ({ kind: 'sym', ko: 'ㅂ', ref: 'jamo:bieup-batchim' }), vocab)).toEqual({ key: 'sym|jamo:bieup-batchim', kind: 'sym', derived: 'sym:bieup-batchim' });
    expect(identityOf(occ({ kind: 'rea', ko: '메뉴', ref: 'realia:menu-prices' }), vocab)).toMatchObject({ derived: 'rea:menu-prices' });
    expect(identityOf(occ({ kind: 'exc', ko: '이게 뭐예요?', reply: { ko: '사과예요.', romanization: '' } }), vocab)).toEqual({ key: 'exc|이게 뭐예요|사과예요', kind: 'exc', derived: 'exc:ige-mwoyeyo' });
    expect(identityOf(occ({ kind: 'pat', ko: '사과 주세요.' }), vocab)).toEqual({ key: 'pat|사과 주세요', kind: 'pat', derived: 'pat:sagwa-juseyo' });
    expect(identityOf(occ({ kind: 'lex', ko: '물', en: 'water' }), vocab)).toEqual({ key: 'lex|물', kind: 'lex', derived: 'lex:mul', vocabId: 'vocab:mul' });
    expect(identityOf(occ({ kind: 'lex', ko: '배', en: 'pear' }), vocab)).toEqual({ key: 'lex|배~pear', kind: 'lex', derived: 'lex:bae~pear' });
    expect(identityOf(occ({ kind: 'lex', ko: '배', en: 'boat' }), vocab)).toEqual({ key: 'lex|배~boat', kind: 'lex', derived: 'lex:bae~boat', vocabId: 'vocab:bae-boat' });
    expect(identityOf(occ({ kind: 'lex', ko: '열', en: 'fever' }), vocab)).toMatchObject({ key: 'lex|열~fever' });
    expect(identityOf(occ({ kind: 'lex', ko: '배', en: 'ship' }), vocab)).toMatchObject({ code: 'sense-missing', cell: 'episode:stage2-life' });
    expect(identityOf(occ({ kind: 'lex', ko: '배' }), vocab)).toMatchObject({ code: 'sense-missing' });
  });
});

describe('allowedFormats (§4.3 rungs by kind, §4.5)', () => {
  const base = { picture: undefined, soundChange: false, homophoneOf: [] as string[], reply: undefined };
  it('asks each kind only in the ways it can be asked', () => {
    expect(allowedFormats({ ...base, kind: 'sym', ko: 'ㅂ' })).toEqual(['hear-pick', 'read-pick', 'syllable-build', 'match-shape']);
    expect(allowedFormats({ ...base, kind: 'syl', ko: '가' })).toEqual(['hear-pick', 'read-pick', 'syllable-build']);
    expect(allowedFormats({ ...base, kind: 'rea', ko: '메뉴' })).toEqual(['read-pick', 'cloze-pick']);
  });
  it('types and dictates a word only when it can be typed and heard without doubt', () => {
    expect(allowedFormats({ ...base, kind: 'lex', ko: '사과', picture: 'word:food-apple' })).toEqual(['hear-pick', 'read-pick', 'type-see', 'type-picture', 'dictation', 'syllable-build']);
    expect(allowedFormats({ ...base, kind: 'lex', ko: '낫', homophoneOf: ['lex:nat~2'], en: 'sickle' })).toEqual(['hear-pick', 'read-pick', 'type-see', 'syllable-build']);
    expect(allowedFormats({ ...base, kind: 'lex', ko: '학교', soundChange: true })).toEqual(['hear-pick', 'read-pick', 'type-see', 'syllable-build']);
    expect(allowedFormats({ ...base, kind: 'lex', ko: '이천 원' })).toEqual(['hear-pick', 'read-pick', 'type-see', 'dictation']);
    expect(allowedFormats({ ...base, kind: 'lex', ko: '5,000 원' })).toEqual(['hear-pick', 'read-pick']);
  });
  it('asks an item with a homophone by ear only when a picture or gloss can settle it (§4.5)', () => {
    expect(allowedFormats({ ...base, kind: 'lex', ko: '낫', homophoneOf: ['lex:nat~2'] })).toEqual(['read-pick', 'type-see', 'syllable-build']);
    expect(allowedFormats({ ...base, kind: 'lex', ko: '낫', homophoneOf: ['lex:nat~2'], picture: 'word:sickle' })).toEqual(['hear-pick', 'read-pick', 'type-see', 'type-picture', 'syllable-build']);
    expect(allowedFormats({ ...base, kind: 'syl', ko: '입', homophoneOf: ['syl:ip~2'] })).toEqual(['read-pick', 'syllable-build']);
    expect(allowedFormats({ ...base, kind: 'pat', ko: '같이 가요.', homophoneOf: ['pat:gachi-gayo~2'] })).toEqual(['read-pick', 'cloze-pick', 'sentence-builder']);
  });
  it('fills a frame, builds a sentence of 2-6 tiles, orders a reply of 2-6 words', () => {
    expect(allowedFormats({ ...base, kind: 'pat', ko: '___ 주세요.' })).toEqual(['read-pick', 'cloze-pick']);
    expect(allowedFormats({ ...base, kind: 'pat', ko: '사과 주세요.' })).toEqual(['hear-pick', 'read-pick', 'cloze-pick', 'sentence-builder']);
    expect(allowedFormats({ ...base, kind: 'pat', ko: '감사합니다.' })).toEqual(['hear-pick', 'read-pick']);
    expect(allowedFormats({ ...base, kind: 'pat', ko: '가 나 다 라 마 바 사' })).toEqual(['hear-pick', 'read-pick', 'cloze-pick']);
    expect(allowedFormats({ ...base, kind: 'exc', ko: '뭐 먹어요?', reply: { ko: '밥 먹어요.', romanization: '' } })).toEqual(['hear-pick', 'read-pick', 'sentence-builder']);
    expect(allowedFormats({ ...base, kind: 'exc', ko: '안녕?', reply: { ko: '안녕!', romanization: '' } })).toEqual(['hear-pick', 'read-pick']);
  });
});

describe('buildReviewItems: merge and frozen ids', () => {
  const occs: ItemOccurrence[] = [
    occ({ kind: 'lex', ko: '사과', romanization: 'sagwa', en: 'apple', loose: true, cell: 'episode:stage3-life', stage: 3 }),
    occ({ kind: 'lex', ko: '사과', romanization: 'sagwa', en: 'an apple', source: 'discover', glossKey: 'quest:stage2-life-q1#steps.s2.discover.pages.0.items.0.word.gloss' }),
    occ({ kind: 'lex', ko: '사과', romanization: 'sagwa', en: 'apple', cell: 'story:sun-and-moon', stage: 2, home: 'nature' }),
    occ({ kind: 'lex', ko: '물', romanization: 'mul', en: 'water (drink)' }),
    occ({ kind: 'lex', ko: '낮', romanization: 'nat', en: 'daytime', source: 'discover', picture: 'word:day' }),
    occ({ kind: 'lex', ko: '낫', romanization: 'nat', en: 'sickle', source: 'discover' }),
    occ({ kind: 'lex', ko: '학교', romanization: '', en: 'school', soundChange: true }),
    occ({ kind: 'pat', ko: '사과 주세요.', romanization: 'sagwa juseyo.', en: 'An apple, please.', source: 'discover' }),
    occ({ kind: 'lex', ko: '사과 주세요', romanization: 'sagwa juseyo', loose: true }),
    occ({ kind: 'exc', ko: '안녕?', romanization: 'annyeong?', reply: { ko: '안녕!', romanization: 'annyeong!' } }),
    occ({ kind: 'exc', ko: '안녕?', romanization: 'annyeong?', reply: { ko: '네.', romanization: 'ne.', glossKey: 'minigame:s2-life-q1-play#dialogue.0.options.ne.gloss' } }),
    occ({ kind: 'exc', ko: '안녕?', romanization: 'annyeong?', reply: { ko: '네.', romanization: 'ne.' } }),
    occ({ kind: 'sym', ko: 'ㅂ', romanization: 'b/p', ref: 'jamo:bieup', cell: 'episode:stage1-life', stage: 1, source: 'discover' }),
    occ({ kind: 'lex', ko: '배', en: 'boat', romanization: 'bae' }),
    occ({ kind: 'lex', ko: '배', en: 'ship', romanization: 'bae' }),
  ];

  it('makes one item per key, in route order, the first Discover occurrence leading', () => {
    const { items, issues, placed } = buildReviewItems(occs, EMPTY_SNAPSHOT, vocab);
    expect(items.map((i) => i.id)).toEqual(['sym:bieup', 'lex:sagwa', 'vocab:mul', 'lex:nat', 'lex:nat~2', 'lex:hakgyo', 'pat:sagwa-juseyo', 'exc:annyeong', 'exc:annyeong~2', 'vocab:bae-boat']);
    expect(issues.filter((i) => i.code !== 'not-frozen')).toEqual([expect.objectContaining({ code: 'sense-missing' })]);
    expect(issues.filter((i) => i.code === 'not-frozen')).toHaveLength(items.length);
    expect(placed).toHaveLength(occs.length - 1);
    const sagwa = items[1];
    expect(sagwa).toMatchObject({
      en: 'an apple',
      glossKey: 'quest:stage2-life-q1#steps.s2.discover.pages.0.items.0.word.gloss',
      home: 'life',
      stage: 2,
      // Taught in its first cell; a later story and cell only ask it again.
      cells: ['episode:stage2-life'],
      asked: ['story:sun-and-moon', 'episode:stage3-life'],
    });
    // A topic word's gloss, gloss key and picture are the topic file's; a swatch is no picture.
    expect(items[2]).toMatchObject({ en: 'water', glossKey: 'vocab:mul#gloss' });
    expect(items[2]?.picture).toBeUndefined();
    expect(items[9]).toMatchObject({ en: 'boat', glossKey: 'vocab:bae-boat#gloss', picture: 'word:travel-boat' });
    // 낮 and 낫 sound alike: neither is dictated.
    expect(items[3]).toMatchObject({ homophoneOf: ['lex:nat~2'], picture: 'word:day' });
    expect(items[3]?.formats).not.toContain('dictation');
    expect(items[5]).toMatchObject({ soundChange: true, romanization: 'hakgyo' });
    // A round's bare 사과 주세요 is the pattern the Discover page teaches.
    expect(placed.filter((p) => p.id === 'pat:sagwa-juseyo')).toHaveLength(2);
    // The exchange with a reply glossed leads with that reply.
    expect(items[8]?.reply).toEqual({ ko: '네.', romanization: 'ne.', glossKey: 'minigame:s2-life-q1-play#dialogue.0.options.ne.gloss' });
  });

  it('counts a later cell as teaching an item only when its Discover page shows it', () => {
    const list = [
      occ({ kind: 'lex', ko: '사과', en: 'apple', cell: 'episode:stage2-life', stage: 2 }),
      occ({ kind: 'lex', ko: '사과', en: 'apple', cell: 'episode:stage2-nature', stage: 2, home: 'nature' }),
      occ({ kind: 'lex', ko: '사과', en: 'apple', cell: 'episode:stage3-life-v2', stage: 3, volume: 2, source: 'discover', glossKey: 'quest:stage3-life-v2-q1#x' }),
    ];
    expect(buildReviewItems(list, EMPTY_SNAPSHOT, vocab).items[0]).toMatchObject({
      cells: ['episode:stage2-life', 'episode:stage3-life-v2'],
      asked: ['episode:stage2-nature'],
      stage: 2,
      volume: 1,
      home: 'life',
    });
    // A story that asks it first has no ring: the first grid cell that asks it teaches it too.
    const storyFirst = [
      occ({ kind: 'lex', ko: '입', en: 'mouth', cell: 'story:shapes', stage: 1, home: 'letters' }),
      occ({ kind: 'lex', ko: '입', en: 'mouth', cell: 'episode:stage2-letters', stage: 2, home: 'letters' }),
      occ({ kind: 'lex', ko: '입', en: 'mouth', cell: 'episode:stage3-letters', stage: 3, home: 'letters' }),
    ];
    expect(buildReviewItems(storyFirst, EMPTY_SNAPSHOT, vocab).items[0]).toMatchObject({
      cells: ['story:shapes', 'episode:stage2-letters'],
      asked: ['episode:stage3-letters'],
      stage: 1,
    });
  });

  it('takes the English and its gloss key from one occurrence, else a field that glosses the same text', () => {
    const paired = buildReviewItems(
      [
        occ({ kind: 'lex', ko: '제기', en: 'foot shuttlecock', glossKey: 'minigame:a#cardPairs.jegi.gloss' }),
        occ({ kind: 'lex', ko: '제기', en: 'a shuttlecock toy you kick', source: 'discover', cell: 'episode:stage3-crafts', stage: 3 }),
        occ({ kind: 'lex', ko: '제기', en: 'a shuttlecock toy you kick', glossKey: 'minigame:b#picWord.boards.0.pairs.p1.word.gloss', cell: 'episode:stage4-crafts', stage: 4 }),
      ],
      EMPTY_SNAPSHOT,
      vocab,
    ).items[0];
    expect(paired).toMatchObject({ en: 'a shuttlecock toy you kick', glossKey: 'minigame:b#picWord.boards.0.pairs.p1.word.gloss' });
    // No occurrence of the item has a key: an exchange reply that glosses the same text lends its own.
    const lent = buildReviewItems(
      [
        occ({ kind: 'exc', ko: '이게 뭐예요?', en: 'What is this?', glossKey: 'minigame:c#dialogue.0.npc', reply: { ko: '지우개예요.', romanization: 'jiugaeyeyo.', en: 'It is an eraser.', glossKey: 'minigame:c#dialogue.0.options.jiugaeyeyo.gloss' } }),
        occ({ kind: 'pat', ko: '지우개예요.', en: 'It is an eraser.' }),
        occ({ kind: 'lex', ko: '물', en: 'water' }),
        occ({ kind: 'lex', ko: '대구', en: 'Daegu (a city)' }),
      ],
      EMPTY_SNAPSHOT,
      vocab,
    ).items;
    expect(lent.map((i) => [i.id, i.glossKey])).toEqual([
      ['exc:ige-mwoyeyo', 'minigame:c#dialogue.0.npc'],
      ['pat:jiugaeyeyo', 'minigame:c#dialogue.0.options.jiugaeyeyo.gloss'],
      ['vocab:mul', 'vocab:mul#gloss'],
      // Nothing glosses it anywhere: no key, never one for another English.
      ['lex:daegu', undefined],
    ]);
  });

  it('keeps each retired id with the Korean its frozen key names, for reports', () => {
    const symbols = [{ id: 'jamo:bieup', char: 'ㅂ', kind: 'consonant' as const, romanization: 'b/p' }];
    const frozen = snap(
      { 'lex|배~pear': 'lex:bae~pear', 'sym|jamo:bieup': 'sym:bieup', 'exc|안녕|안녕': 'exc:annyeong', 'rea|realia:menu-prices': 'rea:menu-prices' },
      { retired: ['sym:bieup', 'lex:bae~pear', 'exc:annyeong', 'rea:menu-prices'] },
    );
    const { retired, issues } = buildReviewItems([], frozen, vocab, symbols);
    expect(issues).toEqual([]);
    expect(retired).toEqual([
      { id: 'exc:annyeong', ko: '안녕', romanization: 'annyeong' },
      { id: 'lex:bae~pear', ko: '배', romanization: 'bae' },
      { id: 'rea:menu-prices', ko: 'realia:menu-prices', romanization: 'realia:menu-prices' },
      { id: 'sym:bieup', ko: 'ㅂ', romanization: 'b/p' },
    ]);
  });

  it('keeps frozen ids whatever the derivation would give, and adds only new ones on --freeze', () => {
    const frozen = snap({ 'lex|사과': 'lex:apple' });
    const { items, issues, frozen: next } = buildReviewItems(occs.slice(0, 3), frozen, vocab);
    expect(items.map((i) => i.id)).toEqual(['lex:apple']);
    expect(issues).toEqual([]);
    expect(next).toEqual(frozen);
    const grown = buildReviewItems(occs.slice(0, 4), frozen, vocab);
    expect(grown.frozen.ids).toEqual({ 'lex|사과': 'lex:apple', 'lex|물': 'vocab:mul' });
    expect(grown.issues).toEqual([expect.objectContaining({ code: 'not-frozen', id: 'vocab:mul', key: 'lex|물' })]);
  });

  it('fails a frozen id that is no longer taught until an alias or a retirement says why', () => {
    const frozen = snap({ 'lex|사과': 'lex:sagwa', 'lex|물맛': 'lex:mul' });
    const edited = [occ({ kind: 'lex', ko: '사과요', en: 'apple' })];
    const vanished = buildReviewItems(edited, frozen, vocab).issues.filter((i) => i.code === 'vanished');
    expect(vanished.map((i) => i.id)).toEqual(['lex:sagwa', 'lex:mul']);
    expect(vanished[0]?.message).toMatch(/alias.*retired/);

    const kept = buildReviewItems(edited, { ...frozen, alias: { 'lex|사과요': 'lex:sagwa' }, retired: ['lex:mul'] }, vocab);
    expect(kept.issues).toEqual([]);
    expect(kept.items.map((i) => [i.id, i.ko])).toEqual([['lex:sagwa', '사과요']]);
    expect(kept.frozen.ids).toEqual(frozen.ids);
  });

  it('refuses a retired id taught again, a retirement or alias naming no frozen id, an alias clash, a taken topic id', () => {
    const codes = (o: ItemOccurrence[], s: StableIdSnapshot) => buildReviewItems(o, s, vocab).issues.map((i) => i.code).sort();
    const sagwa = [occ({ kind: 'lex', ko: '사과', en: 'apple' })];
    expect(codes(sagwa, snap({ 'lex|사과': 'lex:sagwa' }, { retired: ['lex:sagwa'] }))).toEqual(['retired-taught']);
    expect(codes(sagwa, snap({ 'lex|사과': 'lex:sagwa' }, { retired: ['lex:gone'] }))).toEqual(['retired-unknown']);
    expect(codes(sagwa, snap({ 'lex|사과': 'lex:sagwa' }, { alias: { 'lex|사과요': 'lex:nothing' } }))).toEqual(['alias-target-unknown']);
    const both = [...sagwa, occ({ kind: 'lex', ko: '사과요', en: 'apple' })];
    expect(codes(both, snap({ 'lex|사과': 'lex:sagwa' }, { alias: { 'lex|사과요': 'lex:sagwa' } }))).toEqual(['alias-clash']);
    const water = [occ({ kind: 'lex', ko: '물', en: 'water' })];
    expect(codes(water, snap({ 'lex|물물': 'vocab:mul' }, { retired: ['vocab:mul'] }))).toEqual(['id-taken', 'not-frozen', 'retired-taught']);
  });

  it('numbers a second spelling with the same romanization after the frozen one', () => {
    const { items } = buildReviewItems([occ({ kind: 'lex', ko: '낫', en: 'sickle' })], snap({ 'lex|낮': 'lex:nat' }, { retired: ['lex:nat'] }), vocab);
    expect(items.map((i) => i.id)).toEqual(['lex:nat~2']);
    const sense = buildReviewItems([occ({ kind: 'lex', ko: '배', en: 'pear' })], snap({ 'lex|배배~pear': 'lex:bae~pear' }, { retired: ['lex:bae~pear'] }), vocab);
    expect(sense.items.map((i) => i.id)).toEqual(['lex:bae~pear-2']);
  });
});

describe('the committed files', () => {
  it('writes the snapshot one entry per line, sorted, and it parses back', () => {
    const s = snap({ 'lex|ㄴ': 'lex:b', 'lex|ㄱ': 'lex:a' }, { alias: { 'lex|다': 'lex:a', 'lex|가': 'lex:b' }, retired: ['lex:z', 'lex:y'] });
    const text = serializeSnapshot(s);
    expect(text).toBe(
      '{\n  "schemaVersion": 1,\n  "ids": {\n    "lex|ㄱ": "lex:a",\n    "lex|ㄴ": "lex:b"\n  },\n  "alias": {\n    "lex|다": "lex:a",\n    "lex|가": "lex:b"\n  },\n  "retired": [\n    "lex:y",\n    "lex:z"\n  ]\n}\n',
    );
    expect(StableIdSnapshotSchema.safeParse({ schemaVersion: 1, ids: { 'lex|ㄱ': 'lex:a', 'lex|ㄴ': 'lex:a' } }).error?.issues[0]?.message).toBe('lex:a is frozen for lex|ㄱ already');
    expect(StableIdSnapshotSchema.parse(JSON.parse(text))).toEqual({ ...s, retired: ['lex:y', 'lex:z'] });
    expect(serializeSnapshot(EMPTY_SNAPSHOT)).toBe('{\n  "schemaVersion": 1,\n  "ids": {},\n  "alias": {},\n  "retired": []\n}\n');
  });

  it('writes the Stage 1 table one symbol or occurrence per line', () => {
    const table = stage1Table({ symbols: [{ id: 'jamo:a', char: 'ㅏ', kind: 'vowel', romanization: 'a', nameEn: 'a' } as never], quests: [], scopes: {} });
    expect(table).toEqual({ schemaVersion: 1, symbols: [{ id: 'jamo:a', char: 'ㅏ', kind: 'vowel', romanization: 'a' }], occurrences: [] });
    expect(serializeStage1Table(table)).toBe('{\n  "schemaVersion": 1,\n  "symbols": [\n    {"id":"jamo:a","char":"ㅏ","kind":"vowel","romanization":"a"}\n  ],\n  "occurrences": []\n}\n');
  });
});

describe('reviewItemsOf: the three sources merged', () => {
  it('reads Stage 1, a lesson cell and a story into one set of items, a topic word once', () => {
    const symbol = { id: 'jamo:a', char: 'ㅏ', kind: 'vowel' as const, romanization: 'a' };
    const stage1 = {
      schemaVersion: 1 as const,
      symbols: [symbol],
      occurrences: [{ kind: 'sym' as const, ko: 'ㅏ', romanization: 'a', ref: 'jamo:a', cell: 'episode:stage1-letters', home: 'letters', stage: 1, volume: 1, source: 'discover' as const, at: 'quest:stage1-letters-q1 steps[1]' }],
    };
    const word = (ko: string, romanization: string, en: string) => ({ type: 'word', word: { ko, romanization, en } });
    const body = { quests: [{ id: 'quest:stage2-life-q1', steps: [{ id: 's2', kind: 'discover', discover: { pages: [{ items: [word('물', 'mul', 'water'), word('사과', 'sagwa', 'apple')] }] } }] }] };
    const story = { id: 'story:sun-and-moon', theme: 'nature', recommendedStage: 2, tiers: [{ checks: [{ id: 'r1', target: { ko: '물', romanization: 'mul', en: 'water' }, options: [] }] }] };
    const { items, issues } = reviewItemsOf({
      stage1,
      lessons: [{ file: 'content/episodes/stage-2/life.json', body, cellId: 'episode:stage2-life', stage: 2, home: 'life', volume: 1 }],
      stories: [{ file: 'content/stories/sun-and-moon.json', story }],
      topicWords: WORDS,
      senseGroups: GROUPS,
      snapshot: EMPTY_SNAPSHOT,
    });
    expect(items.map((i) => [i.id, i.cells])).toEqual([
      ['sym:a', ['episode:stage1-letters']],
      ['vocab:mul', ['episode:stage2-life']],
      ['lex:sagwa', ['episode:stage2-life']],
    ]);
    expect(items.find((i) => i.id === 'vocab:mul')?.asked).toEqual(['story:sun-and-moon']);
    expect(issues.map((i) => i.code)).toEqual(['not-frozen', 'not-frozen', 'not-frozen']);
  });
});
