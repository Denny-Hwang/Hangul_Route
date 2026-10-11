import { describe, expect, it } from 'vitest';
import {
  VOCAB_AGE_WORDS,
  VOCAB_BANNED_LEARNER_WORDS,
  VOCAB_TOPIC_KEYS,
  VocabIdSchema,
  VocabItemSchema,
  VocabPosSchema,
  VocabSensesFileSchema,
  VocabTopicFileSchema,
  VocabTopicKeySchema,
  VocabTopicSchema,
  findVocabBannedWord,
  type RuntimeVocabItem,
  type VocabItem,
  type VocabTopic,
} from '../index';

const item = (over: Record<string, unknown> = {}) => ({
  id: 'vocab:sagwa',
  ko: '사과',
  romanization: 'sagwa',
  en: 'apple',
  topics: ['food'],
  level: 1,
  visual: 'card:sagwa',
  ...over,
});

const topic = (over: Record<string, unknown> = {}) => ({
  id: 'vocab-topic:food',
  key: 'food',
  order: 1,
  titleEn: 'Food',
  titleKo: { ko: '음식', romanization: 'eumsik', en: 'food' },
  blurbEn: 'Words for what we eat.',
  hoyaIntroEn: 'Hungry? Let us name the tastiest things.',
  tint: 'theme.life',
  coverItemId: 'vocab:sagwa',
  status: 'draft',
  ...over,
});

const items = (n: number, firstId = 'vocab:sagwa') =>
  Array.from({ length: n }, (_, i) =>
    i === 0 ? item({ id: firstId }) : item({ id: `vocab:word${i}`, ko: '우유', romanization: `word${i}` }),
  );

const file = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  topic: topic(),
  items: items(12),
  ...over,
});

describe('topic keys, ids and parts of speech', () => {
  it('lists the twelve launch topics in table order', () => {
    expect([...VOCAB_TOPIC_KEYS]).toEqual([
      'food', 'animals', 'family', 'school', 'body', 'colors', 'numbers', 'nature', 'travel', 'sports', 'k-culture', 'science',
    ]);
    for (const key of VOCAB_TOPIC_KEYS) expect(VocabTopicKeySchema.parse(key)).toBe(key);
    expect(VocabTopicKeySchema.safeParse('home').success).toBe(false);
  });

  it.each(['vocab:sagwa', 'vocab:nun-eye', 'vocab:i-tooth', 'vocab:yunnori'])('accepts id %s', (id) => {
    expect(VocabIdSchema.parse(id)).toBe(id);
  });

  it.each(['sagwa', 'vocab:', 'vocab:Sagwa', 'vocab:nun-', 'vocab:-nun', 'vocab:nun--eye', 'vocab:nun eye', 'vocab-topic:food'])(
    'rejects id %s',
    (id) => {
      expect(VocabIdSchema.safeParse(id).success).toBe(false);
    },
  );

  it('accepts the six parts of speech only', () => {
    for (const pos of ['noun', 'pronoun', 'verb', 'adjective', 'number', 'expression']) {
      expect(VocabPosSchema.parse(pos)).toBe(pos);
    }
    expect(VocabPosSchema.safeParse('adverb').success).toBe(false);
  });
});

describe('VocabItemSchema', () => {
  it('accepts the minimal item and defaults pos to noun', () => {
    const parsed = VocabItemSchema.parse(item());
    expect(parsed.pos).toBe('noun');
    expect(parsed.ko).toBe('사과');
  });

  it('accepts every optional field', () => {
    const full = item({
      id: 'vocab:nun-eye',
      ko: '눈',
      romanization: 'nun',
      en: 'eye',
      pos: 'noun',
      topics: ['body', 'nature', 'science'],
      level: 2,
      visual: 'word:body-eye',
      senseNote: 'The part of the face you see with.',
      senseGroup: 'nun',
      spokenKo: '눈',
      audioRef: 'audio/vocab/nun-eye.mp3',
      example: { ko: '눈이 커요', romanization: 'nuni keoyo', en: 'The eyes are big.' },
    });
    expect(VocabItemSchema.parse(full)).toEqual(full);
  });

  it('infers a VocabItem type usable as a RuntimeVocabItem base', () => {
    const parsed: VocabItem = VocabItemSchema.parse(item());
    const runtime: RuntimeVocabItem = { ...parsed, glosses: { en: parsed.en } };
    expect(runtime.glosses.es).toBeUndefined();
  });

  it.each(['id', 'ko', 'romanization', 'en', 'topics', 'level', 'visual'])('requires %s', (field) => {
    const { [field]: _omitted, ...rest } = item() as Record<string, unknown>;
    expect(VocabItemSchema.safeParse(rest).success).toBe(false);
  });

  it('enforces the length bounds', () => {
    expect(VocabItemSchema.safeParse(item({ ko: '' })).success).toBe(false);
    expect(VocabItemSchema.safeParse(item({ ko: '가'.repeat(13) })).success).toBe(false);
    expect(VocabItemSchema.safeParse(item({ ko: '가'.repeat(12) })).success).toBe(true);
    expect(VocabItemSchema.safeParse(item({ romanization: 'a'.repeat(41) })).success).toBe(false);
    expect(VocabItemSchema.safeParse(item({ en: 'a'.repeat(41) })).success).toBe(false);
    expect(VocabItemSchema.safeParse(item({ senseNote: 'a'.repeat(91) })).success).toBe(false);
    expect(VocabItemSchema.safeParse(item({ senseNote: 'a'.repeat(90) })).success).toBe(true);
  });

  it('allows one to three topics, all known', () => {
    expect(VocabItemSchema.safeParse(item({ topics: [] })).success).toBe(false);
    expect(VocabItemSchema.safeParse(item({ topics: ['food', 'body', 'nature', 'travel'] })).success).toBe(false);
    expect(VocabItemSchema.safeParse(item({ topics: ['pets'] })).success).toBe(false);
  });

  it('allows levels 1, 2 and 3 only', () => {
    for (const level of [1, 2, 3]) expect(VocabItemSchema.safeParse(item({ level })).success).toBe(true);
    for (const level of [0, 4, '1']) expect(VocabItemSchema.safeParse(item({ level })).success).toBe(false);
  });

  it('rejects a bad sense group slug', () => {
    expect(VocabItemSchema.safeParse(item({ senseGroup: 'Nun' })).success).toBe(false);
    expect(VocabItemSchema.safeParse(item({ senseGroup: 'older-sister' })).success).toBe(true);
  });

  it('rejects an empty spokenKo', () => {
    expect(VocabItemSchema.safeParse(item({ spokenKo: '' })).success).toBe(false);
  });

  it('requires a full example', () => {
    expect(VocabItemSchema.safeParse(item({ example: { ko: '사과예요' } })).success).toBe(false);
  });

  describe('rule 1: ko is completed Hangul syllables and single spaces only', () => {
    it.each(['한국 문화', '사과', '가'])('accepts %s', (ko) => {
      expect(VocabItemSchema.safeParse(item({ ko })).success).toBe(true);
    });
    it.each(['ㅅㅏ', 'apple', '사과1', '사과 ', ' 사과', '사과  배', '사과!', '사ㄱ'])('rejects %j', (ko) => {
      const r = VocabItemSchema.safeParse(item({ ko }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(['ko']);
    });
  });

  describe('rule 3: visual is card: or word:', () => {
    it.each(['card:sagwa', 'word:food-apple'])('accepts %s', (visual) => {
      expect(VocabItemSchema.safeParse(item({ visual })).success).toBe(true);
    });
    it('rejects swatch refs with a path on visual', () => {
      const r = VocabItemSchema.safeParse(item({ visual: 'swatch:red' }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(['visual']);
    });
    it('rejects emoji and malformed refs', () => {
      expect(VocabItemSchema.safeParse(item({ visual: 'emoji:apple' })).success).toBe(false);
      expect(VocabItemSchema.safeParse(item({ visual: 'card:' })).success).toBe(false);
    });
  });

  describe('rule 4: audioRef is audio/vocab/<id slug>.mp3', () => {
    it('accepts the item own slug', () => {
      expect(VocabItemSchema.safeParse(item({ audioRef: 'audio/vocab/sagwa.mp3' })).success).toBe(true);
    });
    it.each([
      'audio/vocab/other.mp3',
      'audio/jamo/sagwa.mp3',
      'audio/vocab/sagwa.wav',
      'audio/vocab/Sagwa.mp3',
      'sagwa.mp3',
    ])('rejects %s', (audioRef) => {
      const r = VocabItemSchema.safeParse(item({ audioRef }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(['audioRef']);
    });
    it('rejects a slug-correct ref that is not a valid audio ref path', () => {
      expect(VocabItemSchema.safeParse(item({ id: 'vocab:sagwa', audioRef: 'audio/vocab/sagwa.mp3.mp3' })).success).toBe(
        false,
      );
    });
  });

  describe('rule 5: learner English has no Hangul and no banned word', () => {
    it('rejects Hangul in en and senseNote', () => {
      const a = VocabItemSchema.safeParse(item({ en: '사과' }));
      expect(a.success).toBe(false);
      if (!a.success) expect(a.error.issues[0]?.path).toEqual(['en']);
      const b = VocabItemSchema.safeParse(item({ senseNote: 'also 사과' }));
      expect(b.success).toBe(false);
      if (!b.success) expect(b.error.issues[0]?.path).toEqual(['senseNote']);
    });
    it('rejects banned and age words in en and senseNote', () => {
      for (const word of ['failed', 'Missed', 'kids', 'children', 'ages', 'baby talk']) {
        const a = VocabItemSchema.safeParse(item({ en: `a ${word}` }));
        expect(a.success, word).toBe(false);
        const b = VocabItemSchema.safeParse(item({ senseNote: `${word} here` }));
        expect(b.success, word).toBe(false);
        if (!b.success) expect(b.error.issues[0]?.path).toEqual(['senseNote']);
      }
    });
    it('does not trip on substrings of ordinary words', () => {
      expect(VocabItemSchema.safeParse(item({ en: 'image', senseNote: 'Dismissed or stages.' })).success).toBe(true);
    });
  });
});

describe('findVocabBannedWord', () => {
  it('finds banned learner words and age words on word boundaries, case-insensitively', () => {
    expect(findVocabBannedWord('So Overdue!')).toBe('overdue');
    expect(findVocabBannedWord('for kids')).toBe('kids');
    expect(findVocabBannedWord('Baby   Talk')).toBe('baby talk');
    expect(findVocabBannedWord('baby talk')).toBe('baby talk');
    expect(findVocabBannedWord('image, stages, dismissed')).toBeNull();
  });
  it('exposes both lists', () => {
    expect([...VOCAB_BANNED_LEARNER_WORDS]).toEqual(['missed', 'incomplete', 'failed', 'overdue']);
    expect([...VOCAB_AGE_WORDS]).toEqual(['kids', 'children', 'ages', 'baby talk']);
  });
});

describe('VocabTopicSchema', () => {
  it('accepts a topic and defaults fixedOrder to false', () => {
    const parsed = VocabTopicSchema.parse(topic());
    expect(parsed.fixedOrder).toBe(false);
    const t: VocabTopic = parsed;
    expect(t.key).toBe('food');
  });

  it('accepts hyphenated keys and fixedOrder true', () => {
    const t = VocabTopicSchema.parse(
      topic({ id: 'vocab-topic:k-culture', key: 'k-culture', fixedOrder: true, tint: 'theme.rites' }),
    );
    expect(t.fixedOrder).toBe(true);
  });

  it('accepts all six tints and rejects others', () => {
    for (const tint of ['theme.letters', 'theme.life', 'theme.rites', 'theme.nature', 'theme.crafts', 'stage.stage2']) {
      expect(VocabTopicSchema.safeParse(topic({ tint })).success).toBe(true);
    }
    expect(VocabTopicSchema.safeParse(topic({ tint: 'stage.stage3' })).success).toBe(false);
    expect(VocabTopicSchema.safeParse(topic({ tint: '#ffffff' })).success).toBe(false);
  });

  it('enforces order, length and status bounds', () => {
    expect(VocabTopicSchema.safeParse(topic({ order: 0 })).success).toBe(false);
    expect(VocabTopicSchema.safeParse(topic({ order: 100 })).success).toBe(false);
    expect(VocabTopicSchema.safeParse(topic({ order: 1.5 })).success).toBe(false);
    expect(VocabTopicSchema.safeParse(topic({ titleEn: '' })).success).toBe(false);
    expect(VocabTopicSchema.safeParse(topic({ titleEn: 'a'.repeat(25) })).success).toBe(false);
    expect(VocabTopicSchema.safeParse(topic({ blurbEn: 'a'.repeat(71) })).success).toBe(false);
    expect(VocabTopicSchema.safeParse(topic({ hoyaIntroEn: 'a'.repeat(91) })).success).toBe(false);
    expect(VocabTopicSchema.safeParse(topic({ status: 'live' })).success).toBe(false);
    for (const status of ['draft', 'ready', 'shipped', 'preview']) {
      expect(VocabTopicSchema.safeParse(topic({ status })).success).toBe(true);
    }
  });

  it('requires titleKo to be a KoText', () => {
    expect(VocabTopicSchema.safeParse(topic({ titleKo: { ko: '음식' } })).success).toBe(false);
    expect(
      VocabTopicSchema.safeParse(
        topic({ titleKo: { ko: '음식', romanization: 'eumsik', en: 'food', syllables: ['x'] } }),
      ).success,
    ).toBe(false);
  });

  it('requires id to equal vocab-topic:<key>', () => {
    const r = VocabTopicSchema.safeParse(topic({ id: 'vocab-topic:animals' }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['id']);
    expect(VocabTopicSchema.safeParse(topic({ id: 'food' })).success).toBe(false);
  });

  it('rejects a bad cover item id', () => {
    expect(VocabTopicSchema.safeParse(topic({ coverItemId: 'sagwa' })).success).toBe(false);
  });

  it('rejects Hangul and banned words in learner English fields', () => {
    for (const field of ['titleEn', 'blurbEn', 'hoyaIntroEn'] as const) {
      const hangul = VocabTopicSchema.safeParse(topic({ [field]: '음식' }));
      expect(hangul.success, field).toBe(false);
      if (!hangul.success) expect(hangul.error.issues[0]?.path).toEqual([field]);
      const banned = VocabTopicSchema.safeParse(topic({ [field]: 'Fun for kids' }));
      expect(banned.success, field).toBe(false);
      if (!banned.success) expect(banned.error.issues[0]?.path).toEqual([field]);
    }
  });
});

describe('VocabTopicFileSchema', () => {
  it('accepts a topic file with 12 items', () => {
    expect(VocabTopicFileSchema.safeParse(file()).success).toBe(true);
  });

  it('allows 8 to 60 items', () => {
    expect(VocabTopicFileSchema.safeParse(file({ items: items(8) })).success).toBe(true);
    expect(VocabTopicFileSchema.safeParse(file({ items: items(60) })).success).toBe(true);
    expect(VocabTopicFileSchema.safeParse(file({ items: items(7) })).success).toBe(false);
    expect(VocabTopicFileSchema.safeParse(file({ items: items(61) })).success).toBe(false);
  });

  it('requires schemaVersion 1', () => {
    expect(VocabTopicFileSchema.safeParse(file({ schemaVersion: 2 })).success).toBe(false);
  });

  it('requires the cover item to be one of the items', () => {
    const r = VocabTopicFileSchema.safeParse(file({ topic: topic({ coverItemId: 'vocab:missing' }) }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['topic', 'coverItemId']);
  });

  it('rejects duplicate item ids inside the file', () => {
    const dup = items(12);
    dup[5] = dup[0]!;
    const r = VocabTopicFileSchema.safeParse(file({ items: dup }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['items', 5, 'id']);
  });

  it('surfaces item-level failures with their path', () => {
    const bad = items(12);
    bad[3] = item({ id: 'vocab:word3', visual: 'swatch:red' });
    const r = VocabTopicFileSchema.safeParse(file({ items: bad }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['items', 3, 'visual']);
  });

  it('surfaces a topic id that does not match its key', () => {
    const r = VocabTopicFileSchema.safeParse(file({ topic: topic({ id: 'vocab-topic:animals' }) }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['topic', 'id']);
  });
});

describe('VocabSensesFileSchema', () => {
  const senses = {
    schemaVersion: 1,
    groups: [
      {
        group: 'bae',
        members: [
          { id: 'vocab:bae-belly', en: 'belly', state: 'launch' },
          { id: 'vocab:bae-pear', en: 'pear', state: 'reserved' },
        ],
      },
      { group: 'pyo', members: [{ id: 'vocab:pyo-ticket', en: 'ticket', state: 'launch' }] },
    ],
  };

  it('accepts launch and reserved members, and an empty group list', () => {
    expect(VocabSensesFileSchema.parse(senses)).toEqual(senses);
    expect(VocabSensesFileSchema.safeParse({ schemaVersion: 1, groups: [] }).success).toBe(true);
  });

  it('requires at least one member per group', () => {
    expect(VocabSensesFileSchema.safeParse({ schemaVersion: 1, groups: [{ group: 'bae', members: [] }] }).success).toBe(false);
  });

  it('rejects a bad group slug, member id, state and schemaVersion', () => {
    const member = { id: 'vocab:bae-belly', en: 'belly', state: 'launch' };
    expect(VocabSensesFileSchema.safeParse({ schemaVersion: 1, groups: [{ group: 'Bae', members: [member] }] }).success).toBe(false);
    expect(VocabSensesFileSchema.safeParse({ schemaVersion: 1, groups: [{ group: 'bae', members: [{ ...member, id: 'bae' }] }] }).success).toBe(false);
    expect(VocabSensesFileSchema.safeParse({ schemaVersion: 1, groups: [{ group: 'bae', members: [{ ...member, state: 'live' }] }] }).success).toBe(false);
    expect(VocabSensesFileSchema.safeParse({ ...senses, schemaVersion: 2 }).success).toBe(false);
  });
});
