import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_PRESETS,
  DECK_ID_RE,
  LECTURE_CONSOLE_ORIGINS,
  LECTURE_DECK_VERSION,
  LECTURE_MAX_BLOCKS,
  LECTURE_MAX_FRAGMENT_CHARS,
  LECTURE_MAX_JSON_BYTES,
  LECTURE_CREATED_AT_RE,
  LECTURE_JAMO_ID_RE,
  LECTURE_MESSAGE_NS,
  LECTURE_REVISIT_CHAR_RE,
  LECTURE_TITLE_RE,
  LECTURE_VOCAB_TOPIC_ID_RE,
  JamoSchema,
  VocabIdSchema,
  VocabTopicSchema,
  LectureBlockSchema,
  LectureCodecError,
  LectureDeckSchema,
  LectureReadyMessageSchema,
  LectureRosterMessageSchema,
  PICKER_LABEL_RE,
  PickerModeSchema,
  decodeDeck,
  encodeDeck,
  type LectureDeckInput,
} from '../index';

const baseDeck = (over: Partial<LectureDeckInput> = {}): LectureDeckInput => ({
  v: 1,
  id: 'lecture:abc123',
  title: 'Week 3: first letters',
  createdAt: '2026-10-11T09:00:00.000Z',
  seed: 42,
  blocks: [{ kind: 'quest', id: 'quest:s1-meet-1' }],
  ...over,
});

/** Base64url of raw bytes, the way the codec writes it (test-side helper). */
function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const fragmentOfJson = (json: string): string => `1.${b64url(new TextEncoder().encode(json))}`;

describe('lecture constants', () => {
  it('pins the limits the spec names', () => {
    expect(LECTURE_DECK_VERSION).toBe(1);
    expect(LECTURE_MAX_BLOCKS).toBe(30);
    expect(LECTURE_MAX_FRAGMENT_CHARS).toBe(8192);
    expect(LECTURE_MAX_JSON_BYTES).toBe(6144);
    expect(ACTIVITY_PRESETS).toEqual(['air-write', 'say-together', 'pair-share', 'copy-on-paper', 'stretch-break']);
    expect(LECTURE_MESSAGE_NS).toBe('hangul-route.lecture');
    expect(LECTURE_CONSOLE_ORIGINS).toEqual([
      'https://hangulroute.com',
      'https://www.hangulroute.com',
      'http://localhost:3000',
    ]);
  });

  it('deck ids are lecture: plus 6-12 lowercase letters or digits', () => {
    expect(DECK_ID_RE.test('lecture:abc123')).toBe(true);
    expect(DECK_ID_RE.test('lecture:abcdefghijkl')).toBe(true);
    expect(DECK_ID_RE.test('lecture:abc12')).toBe(false);
    expect(DECK_ID_RE.test('lecture:abcdefghijklm')).toBe(false);
    expect(DECK_ID_RE.test('lecture:ABC123')).toBe(false);
    expect(DECK_ID_RE.test('deck:abc123')).toBe(false);
  });

  it('picker modes are names, initials and numbers', () => {
    expect(PickerModeSchema.options).toEqual(['names', 'initials', 'numbers']);
  });
});

describe('LectureBlockSchema', () => {
  const ok = (b: unknown) => LectureBlockSchema.safeParse(b).success;

  it('accepts one valid block of every kind', () => {
    expect(ok({ kind: 'episode', id: 'episode:s1-ep1' })).toBe(true);
    expect(ok({ kind: 'quest', id: 'quest:s1-meet-1' })).toBe(true);
    expect(ok({ kind: 'jamo-set', jamoIds: ['jamo:giyeok', 'jamo:a'] })).toBe(true);
    expect(ok({ kind: 'revisit', chars: ['ㄱ', 'ㅏ'] })).toBe(true);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:food' })).toBe(true);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:k-culture', wordIds: ['vocab:sagwa-apple', 'vocab:bap'] })).toBe(true);
    expect(ok({ kind: 'story', storyId: 'story:sun-and-moon' })).toBe(true);
    expect(ok({ kind: 'story', storyId: 'story:sun-and-moon', level: 'read-along', checks: false })).toBe(true);
    expect(ok({ kind: 'cards', cardIds: ['card:hanbok'] })).toBe(true);
    expect(ok({ kind: 'quiz', from: 'previous', rounds: 5 })).toBe(true);
    expect(ok({ kind: 'quiz', from: 'all', rounds: 10 })).toBe(true);
    expect(ok({ kind: 'activity', preset: 'air-write', minutes: 3 })).toBe(true);
    expect(ok({ kind: 'class-code', code: 'ABCD23' })).toBe(true);
  });

  it('defaults story checks to true', () => {
    const r = LectureBlockSchema.parse({ kind: 'story', storyId: 'story:sun-and-moon' });
    expect(r).toEqual({ kind: 'story', storyId: 'story:sun-and-moon', checks: true });
  });

  it('rejects ids of the wrong shape', () => {
    expect(ok({ kind: 'episode', id: 'quest:s1-meet-1' })).toBe(false);
    expect(ok({ kind: 'quest', id: 'quest:S1' })).toBe(false);
    expect(ok({ kind: 'jamo-set', jamoIds: ['giyeok'] })).toBe(false);
    expect(ok({ kind: 'vocab', topicId: 'food' })).toBe(false);
    // F-VOC-001 grammar: topics are vocab-topic:<key>, words are vocab:<slug>; never the other way round.
    expect(ok({ kind: 'vocab', topicId: 'vocab:food' })).toBe(false);
    expect(ok({ kind: 'vocab', topicId: 'vocab:sagwa-apple' })).toBe(false);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab-topic:food'] })).toBe(false);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['kimchi'] })).toBe(false);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['Minho Kim'] })).toBe(false);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: [''] })).toBe(false);
    expect(ok({ kind: 'jamo-set', jamoIds: ['jamo:giyeok-batchim', 'jamo:ssang2'] })).toBe(true);
    expect(ok({ kind: 'jamo-set', jamoIds: ['jamo:Giyeok'] })).toBe(false);
    // revisit holds compatibility jamo only: no syllable, markup, control character or lone surrogate.
    expect(ok({ kind: 'revisit', chars: ['ㄲ', 'ㅘ', 'ㅣ'] })).toBe(true);
    expect(ok({ kind: 'revisit', chars: ['가'] })).toBe(false);
    expect(ok({ kind: 'revisit', chars: ['<'] })).toBe(false);
    expect(ok({ kind: 'revisit', chars: ['\u0007'] })).toBe(false);
    expect(ok({ kind: 'revisit', chars: ['\ud800'] })).toBe(false);
    expect(ok({ kind: 'revisit', chars: ['M'] })).toBe(false);
    expect(ok({ kind: 'story', storyId: 'story:sun--moon' })).toBe(false);
    expect(ok({ kind: 'story', storyId: 'story:-sun' })).toBe(false);
    expect(ok({ kind: 'story', storyId: 'story:sun', level: 'shout' })).toBe(false);
    expect(ok({ kind: 'cards', cardIds: ['hanbok'] })).toBe(false);
    expect(ok({ kind: 'activity', preset: 'race', minutes: 3 })).toBe(false);
    expect(ok({ kind: 'class-code', code: 'ABCD0O' })).toBe(false);
    expect(ok({ kind: 'class-code', code: 'abcd23' })).toBe(false);
    expect(ok({ kind: 'slide', text: 'free text' })).toBe(false);
  });

  it('enforces the array and number bounds', () => {
    const jamo = (n: number) => Array.from({ length: n }, () => 'jamo:a');
    expect(ok({ kind: 'jamo-set', jamoIds: [] })).toBe(false);
    expect(ok({ kind: 'jamo-set', jamoIds: jamo(12) })).toBe(true);
    expect(ok({ kind: 'jamo-set', jamoIds: jamo(13) })).toBe(false);
    expect(ok({ kind: 'revisit', chars: [] })).toBe(false);
    expect(ok({ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ'] })).toBe(true);
    expect(ok({ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ'] })).toBe(false);
    expect(ok({ kind: 'revisit', chars: ['ㄱㄴ'] })).toBe(false);
    expect(ok({ kind: 'revisit', chars: [''] })).toBe(false);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: Array.from({ length: 24 }, () => 'vocab:w') })).toBe(true);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: Array.from({ length: 25 }, () => 'vocab:w') })).toBe(false);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: [`vocab:${'x'.repeat(42)}`] })).toBe(true);
    expect(ok({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: [`vocab:${'x'.repeat(43)}`] })).toBe(false);
    expect(ok({ kind: 'cards', cardIds: [] })).toBe(false);
    expect(ok({ kind: 'cards', cardIds: Array.from({ length: 13 }, () => 'card:a') })).toBe(false);
    expect(ok({ kind: 'quiz', from: 'previous', rounds: 0 })).toBe(false);
    expect(ok({ kind: 'quiz', from: 'previous', rounds: 11 })).toBe(false);
    expect(ok({ kind: 'quiz', from: 'previous', rounds: 2.5 })).toBe(false);
    expect(ok({ kind: 'quiz', from: 'next', rounds: 3 })).toBe(false);
    expect(ok({ kind: 'activity', preset: 'pair-share', minutes: 0 })).toBe(false);
    expect(ok({ kind: 'activity', preset: 'pair-share', minutes: 15 })).toBe(true);
    expect(ok({ kind: 'activity', preset: 'pair-share', minutes: 16 })).toBe(false);
  });

  it('id grammars match the content schemas they point at (no drift)', () => {
    for (const id of ['jamo:giyeok', 'jamo:giyeok-batchim', 'jamo:a2', 'jamo:A', 'giyeok']) {
      expect(LECTURE_JAMO_ID_RE.test(id)).toBe(JamoSchema.innerType().shape.id.safeParse(id).success);
    }
    for (const id of ['vocab-topic:food', 'vocab-topic:k-culture', 'vocab:food', 'vocab-topic:-x']) {
      expect(LECTURE_VOCAB_TOPIC_ID_RE.test(id)).toBe(VocabTopicSchema.innerType().shape.id.safeParse(id).success);
    }
    expect(VocabIdSchema.safeParse('vocab:sagwa-apple').success).toBe(true);
    expect(LECTURE_REVISIT_CHAR_RE.test('ㄱ') && LECTURE_REVISIT_CHAR_RE.test('ㅣ')).toBe(true);
  });

  it('is strict: an unknown key in any block is an error (no free slide text)', () => {
    expect(ok({ kind: 'quest', id: 'quest:s1-meet-1', note: 'private' })).toBe(false);
    expect(ok({ kind: 'activity', preset: 'air-write', minutes: 3, text: 'Write your name' })).toBe(false);
    expect(ok({ kind: 'class-code', code: 'ABCD23', labels: ['Minho'] })).toBe(false);
  });
});

describe('LectureDeckSchema', () => {
  it('parses a minimal deck and fills the defaults', () => {
    const deck = LectureDeckSchema.parse(baseDeck());
    expect(deck.options).toEqual({ romanization: 'always', strokeGuide: true, quizRounds: 5, sound: true });
    expect(deck.picker).toBeNull();
    expect(deck.source).toBeUndefined();
  });

  it('keeps chosen options, picker and source', () => {
    const deck = LectureDeckSchema.parse(
      baseDeck({
        options: { romanization: 'tap', strokeGuide: false, quizRounds: 3, sound: false, uiLocale: 'ko' },
        picker: { mode: 'initials', count: 14 },
        source: 'plan',
      }),
    );
    expect(deck.options).toEqual({ romanization: 'tap', strokeGuide: false, quizRounds: 3, sound: false, uiLocale: 'ko' });
    expect(deck.picker).toEqual({ mode: 'initials', count: 14 });
    expect(deck.source).toBe('plan');
  });

  it('fills defaults inside a partial options object', () => {
    const deck = LectureDeckSchema.parse(baseDeck({ options: { sound: false } }));
    expect(deck.options).toEqual({ romanization: 'always', strokeGuide: true, quizRounds: 5, sound: false });
  });

  it('enforces the block count, seed and picker bounds', () => {
    const block = { kind: 'quest' as const, id: 'quest:s1-meet-1' };
    const ok = (d: LectureDeckInput) => LectureDeckSchema.safeParse(d).success;
    expect(ok(baseDeck({ blocks: [] }))).toBe(false);
    expect(ok(baseDeck({ blocks: Array.from({ length: 30 }, () => block) }))).toBe(true);
    expect(ok(baseDeck({ blocks: Array.from({ length: 31 }, () => block) }))).toBe(false);
    expect(ok(baseDeck({ seed: -1 }))).toBe(false);
    expect(ok(baseDeck({ seed: 0 }))).toBe(true);
    expect(ok(baseDeck({ seed: 2_147_483_647 }))).toBe(true);
    expect(ok(baseDeck({ seed: 2_147_483_648 }))).toBe(false);
    expect(ok(baseDeck({ seed: 1.5 }))).toBe(false);
    expect(ok(baseDeck({ picker: { mode: 'numbers', count: 0 } }))).toBe(false);
    expect(ok(baseDeck({ picker: { mode: 'numbers', count: 60 } }))).toBe(true);
    expect(ok(baseDeck({ picker: { mode: 'numbers', count: 61 } }))).toBe(false);
    expect(ok(baseDeck({ options: { quizRounds: 11 } }))).toBe(false);
    expect(ok(baseDeck({ options: { romanization: 'never' as 'tap' } }))).toBe(false);
    expect(ok(baseDeck({ options: { uiLocale: 'fr' as 'en' } }))).toBe(false);
    expect(ok({ ...baseDeck(), v: 2 as 1 })).toBe(false);
    expect(ok(baseDeck({ id: 'lecture:abc' }))).toBe(false);
    expect(ok(baseDeck({ source: 'console' as 'plan' }))).toBe(false);
  });

  it('createdAt is an ISO date-time with a zone, never free text', () => {
    const ok = (createdAt: string) => LectureDeckSchema.safeParse(baseDeck({ createdAt })).success;
    expect(ok(new Date(0).toISOString())).toBe(true);
    expect(ok('2026-10-11T09:00:00Z')).toBe(true);
    expect(ok('2026-10-11T09:00+09:00')).toBe(true);
    expect(ok('2026-10-11')).toBe(false);
    expect(ok('2026-10-11T09:00:00')).toBe(false);
    expect(ok('Minho Kim')).toBe(false);
    expect(ok('')).toBe(false);
    expect(ok('2026-10-11T09:00:00.000Z\u202e')).toBe(false);
    expect(ok(`2026-10-11T09:00:00.${'1'.repeat(30)}Z`)).toBe(false);
    expect(LECTURE_CREATED_AT_RE.test('2026-10-11T09:00:00.000Z')).toBe(true);
  });

  it('is strict at the top level, in options and in picker: names cannot ride in the deck', () => {
    const fail = (d: unknown) => LectureDeckSchema.safeParse(d).success;
    // the named smuggling attempt: labels inside picker
    expect(fail({ ...baseDeck(), picker: { mode: 'names', count: 2, labels: ['Minho', 'Sora'] } })).toBe(false);
    // a labels-like key anywhere else
    expect(fail({ ...baseDeck(), labels: ['Minho'] })).toBe(false);
    expect(fail({ ...baseDeck(), roster: ['Minho'] })).toBe(false);
    expect(fail({ ...baseDeck(), options: { names: ['Minho'] } })).toBe(false);
    expect(fail({ ...baseDeck(), picker: { mode: 'names', count: 2, names: 'Minho,Sora' } })).toBe(false);
    // a typo is an error, not silently dropped
    expect(fail({ ...baseDeck(), titel: 'x' })).toBe(false);
    expect(fail({ ...baseDeck(), options: { strokeguide: false } })).toBe(false);
  });

  describe('title (TD8)', () => {
    const title = (t: string) => LectureDeckSchema.safeParse(baseDeck({ title: t }));

    it('allows Latin with accents, Hangul syllables, digits and the listed punctuation', () => {
      for (const t of [
        'Week 3: first letters',
        '한글 첫 수업',
        'Lección 2',
        "Zoë's class (Sunday) 1/2 - review!",
        'Ready? Go, again.',
        'It’s time',
      ]) {
        expect(title(t).success).toBe(true);
      }
    });

    it('trims and bounds the length', () => {
      expect(title('  Week 1  ').success && title('  Week 1  ').data?.title).toBe('Week 1');
      expect(title('').success).toBe(false);
      expect(title('   ').success).toBe(false);
      expect(title('a'.repeat(60)).success).toBe(true);
      expect(title('a'.repeat(61)).success).toBe(false);
      expect(title('가'.repeat(60)).success).toBe(true);
    });

    it('rejects emoji, other scripts, control characters and markup', () => {
      for (const t of ['Week 1 🐯', 'Урок 1', 'レッスン', '漢字', 'Week\n1', 'Week\t1', '<b>Week</b>', 'Week #1', 'ㄱ first', 'a&b', 'x"y']) {
        expect(title(t).success).toBe(false);
      }
    });

    it('LECTURE_TITLE_RE is the same class the schema uses', () => {
      expect(LECTURE_TITLE_RE.test('한글 Week 1')).toBe(true);
      expect(LECTURE_TITLE_RE.test('Week 🐯')).toBe(false);
    });
  });
});

describe('console <-> presenter messages', () => {
  const ready = { ns: 'hangul-route.lecture', v: 1, type: 'ready', deckId: 'lecture:abc123' };
  const roster = { ns: 'hangul-route.lecture', v: 1, type: 'roster', deckId: 'lecture:abc123', mode: 'names', labels: ['Minho', 'Sora'] };

  it('ready: accepts the exact shape only', () => {
    expect(LectureReadyMessageSchema.safeParse(ready).success).toBe(true);
    expect(LectureReadyMessageSchema.safeParse({ ...ready, ns: 'other' }).success).toBe(false);
    expect(LectureReadyMessageSchema.safeParse({ ...ready, v: 2 }).success).toBe(false);
    expect(LectureReadyMessageSchema.safeParse({ ...ready, type: 'roster' }).success).toBe(false);
    expect(LectureReadyMessageSchema.safeParse({ ...ready, deckId: 'lecture:x' }).success).toBe(false);
    expect(LectureReadyMessageSchema.safeParse({ ...ready, labels: ['Minho'] }).success).toBe(false);
    expect(LectureReadyMessageSchema.safeParse('ready').success).toBe(false);
  });

  it('roster: accepts names and initials, never numbers', () => {
    expect(LectureRosterMessageSchema.safeParse(roster).success).toBe(true);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, mode: 'initials', labels: ['M. K.', 'S. P.'] }).success).toBe(true);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, mode: 'numbers' }).success).toBe(false);
  });

  it('roster: rejects wrong ns, wrong version, wrong type and extra keys', () => {
    expect(LectureRosterMessageSchema.safeParse({ ...roster, ns: 'hangul-route' }).success).toBe(false);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, v: 2 }).success).toBe(false);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, type: 'ready' }).success).toBe(false);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, summaries: ['x'] }).success).toBe(false);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, deckId: 'deck:1' }).success).toBe(false);
  });

  it('roster: 1..60 labels of 1..20 characters', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `L${i}`);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, labels: [] }).success).toBe(false);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, labels: many(60) }).success).toBe(true);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, labels: many(61) }).success).toBe(false);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, labels: ['a'.repeat(20)] }).success).toBe(true);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, labels: ['a'.repeat(21)] }).success).toBe(false);
    expect(LectureRosterMessageSchema.safeParse({ ...roster, labels: ['   '] }).success).toBe(false);
  });

  it('picker labels: the learner-name class plus "." and "?" for aliases', () => {
    const label = (l: string) => LectureRosterMessageSchema.safeParse({ ...roster, labels: [l] }).success;
    for (const l of ['민호', 'María', 'Zoë', 'M. K.', '?', "O'Neil", 'Anne-Marie', 'Jo’s', 'Kid 7']) {
      expect(label(l)).toBe(true);
      expect(PICKER_LABEL_RE.test(l)).toBe(true);
    }
    for (const l of ['Minho 🐯', 'Миша', '美咲', '<script>', 'a,b', 'x\ny']) {
      expect(label(l)).toBe(false);
    }
  });

  it('trims labels before checking', () => {
    const r = LectureRosterMessageSchema.parse({ ...roster, labels: ['  Minho '] });
    expect(r.labels).toEqual(['Minho']);
  });
});

describe('deck codec', () => {
  it('round-trips a deck and writes the version prefix', () => {
    const input = baseDeck({ picker: { mode: 'numbers', count: 12 }, source: 'quick' });
    const fragment = encodeDeck(input);
    expect(fragment.startsWith('1.')).toBe(true);
    expect(fragment).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    const r = decodeDeck(fragment);
    expect(r).toEqual({ ok: true, deck: LectureDeckSchema.parse(input) });
  });

  it('round-trips a Hangul title through UTF-8', () => {
    const fragment = encodeDeck(baseDeck({ title: '한글학교 3주차: 받침' }));
    const r = decodeDeck(fragment);
    expect(r.ok && r.deck.title).toBe('한글학교 3주차: 받침');
  });

  it('accepts the fragment with or without the leading #d=', () => {
    const fragment = encodeDeck(baseDeck());
    expect(decodeDeck(`#d=${fragment}`).ok).toBe(true);
    expect(decodeDeck(`d=${fragment}`).ok).toBe(true);
    expect(decodeDeck(`#${fragment}`).ok).toBe(true);
  });

  it('keeps the worst case under both limits: 30 blocks of 64-character ids and a 60-character Hangul title', () => {
    const id = `episode:${'a'.repeat(56)}`;
    expect(id).toHaveLength(64);
    const deck = baseDeck({
      id: 'lecture:abcdefghijkl',
      title: '가'.repeat(60),
      createdAt: '2026-10-11T09:00:00.000Z',
      seed: 2_147_483_647,
      blocks: Array.from({ length: 30 }, () => ({ kind: 'episode' as const, id })),
      options: { romanization: 'tap', strokeGuide: false, quizRounds: 10, sound: false, uiLocale: 'es' },
      picker: { mode: 'initials', count: 60 },
      source: 'catalogue',
    });
    const fragment = encodeDeck(deck);
    expect(fragment.length).toBeLessThan(LECTURE_MAX_FRAGMENT_CHARS);
    const json = JSON.stringify(LectureDeckSchema.parse(deck));
    expect(new TextEncoder().encode(json).length).toBeLessThan(LECTURE_MAX_JSON_BYTES);
    expect(decodeDeck(fragment).ok).toBe(true);
  });

  it('refuses to encode an invalid deck', () => {
    expect(() => encodeDeck({ ...baseDeck(), picker: { mode: 'names', count: 1, labels: ['Minho'] } } as LectureDeckInput)).toThrow();
    expect(() => encodeDeck(baseDeck({ title: 'Week 🐯' }))).toThrow();
  });

  it('refuses to encode a deck whose link would be too long', () => {
    const block = {
      kind: 'vocab' as const,
      topicId: 'vocab-topic:food',
      wordIds: Array.from({ length: 24 }, (_, i) => `vocab:${'w'.repeat(37)}-${String(i).padStart(4, '0')}`),
    };
    const big = baseDeck({ blocks: Array.from({ length: 30 }, () => block) });
    expect(LectureDeckSchema.safeParse(big).success).toBe(true);
    let caught: unknown;
    try {
      encodeDeck(big);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LectureCodecError);
    expect((caught as LectureCodecError).reason).toBe('too_large');
  });

  describe('decode failures (never throws)', () => {
    it('empty', () => {
      expect(decodeDeck('')).toEqual({ ok: false, reason: 'empty' });
      expect(decodeDeck('#')).toEqual({ ok: false, reason: 'empty' });
      expect(decodeDeck('#d=')).toEqual({ ok: false, reason: 'empty' });
    });

    it('too_large: over 8192 characters', () => {
      expect(decodeDeck(`1.${'A'.repeat(LECTURE_MAX_FRAGMENT_CHARS)}`)).toEqual({ ok: false, reason: 'too_large' });
    });

    it('bad_encoding: no version prefix, bad base64url, bad UTF-8', () => {
      expect(decodeDeck('eyJ2IjoxfQ')).toEqual({ ok: false, reason: 'bad_encoding' });
      expect(decodeDeck('1.')).toEqual({ ok: false, reason: 'bad_encoding' });
      expect(decodeDeck('.eyJ2IjoxfQ')).toEqual({ ok: false, reason: 'bad_encoding' });
      expect(decodeDeck('v1.eyJ2IjoxfQ')).toEqual({ ok: false, reason: 'bad_encoding' });
      expect(decodeDeck('1.abc+def')).toEqual({ ok: false, reason: 'bad_encoding' });
      expect(decodeDeck('1.abc/def')).toEqual({ ok: false, reason: 'bad_encoding' });
      expect(decodeDeck('1.abc=')).toEqual({ ok: false, reason: 'bad_encoding' });
      expect(decodeDeck('1.abcde')).toEqual({ ok: false, reason: 'bad_encoding' });
      expect(decodeDeck('1.ab cd')).toEqual({ ok: false, reason: 'bad_encoding' });
      // 0xff 0xfe is not UTF-8
      expect(decodeDeck(`1.${b64url(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]))}`)).toEqual({ ok: false, reason: 'bad_encoding' });
    });

    it('unsupported_version: a later prefix or a later deck version', () => {
      expect(decodeDeck(`2.${encodeDeck(baseDeck()).slice(2)}`)).toEqual({ ok: false, reason: 'unsupported_version' });
      expect(decodeDeck(`10.${encodeDeck(baseDeck()).slice(2)}`)).toEqual({ ok: false, reason: 'unsupported_version' });
      expect(decodeDeck(fragmentOfJson(JSON.stringify({ ...baseDeck(), v: 2 })))).toEqual({ ok: false, reason: 'unsupported_version' });
    });

    it('bad_json', () => {
      expect(decodeDeck(fragmentOfJson('{"v":1,'))).toEqual({ ok: false, reason: 'bad_json' });
      expect(decodeDeck(fragmentOfJson('not json'))).toEqual({ ok: false, reason: 'bad_json' });
    });

    it('invalid: schema failures, with issues; a smuggled labels key is invalid', () => {
      const smuggled = decodeDeck(
        fragmentOfJson(JSON.stringify({ ...baseDeck(), picker: { mode: 'names', count: 2, labels: ['Minho', 'Sora'] } })),
      );
      expect(smuggled.ok).toBe(false);
      if (smuggled.ok) throw new Error('unreachable');
      expect(smuggled.reason).toBe('invalid');
      expect(smuggled.issues?.length).toBeGreaterThan(0);
      // Issues carry the path and zod code only, never an input value (a link may hold a name).
      expect(smuggled.issues).toEqual([{ path: ['picker'], code: 'unrecognized_keys' }]);
      const badEnum = decodeDeck(fragmentOfJson(JSON.stringify({ ...baseDeck(), picker: { mode: 'Minho', count: 2 } })));
      expect(badEnum).toEqual({ ok: false, reason: 'invalid', issues: [{ path: ['picker', 'mode'], code: 'invalid_enum_value' }] });
      expect(JSON.stringify(badEnum)).not.toContain('Minho');

      for (const json of [
        JSON.stringify({ ...baseDeck(), labels: ['Minho'] }),
        JSON.stringify({ ...baseDeck(), blocks: [] }),
        JSON.stringify([1, 2, 3]),
        'null',
        '"deck"',
        '42',
        JSON.stringify({ title: 'no version' }),
      ]) {
        const r = decodeDeck(fragmentOfJson(json));
        expect(r.ok === false && r.reason).toBe('invalid');
      }
    });

    it('the fragment limit bounds the decoded JSON at 6144 bytes', () => {
      const payloadChars = LECTURE_MAX_FRAGMENT_CHARS - '1.'.length;
      expect(Math.floor((payloadChars * 3) / 4)).toBeLessThanOrEqual(LECTURE_MAX_JSON_BYTES);
    });

    it('too_large: JSON over 6144 bytes never decodes (its fragment is over 8192 characters)', () => {
      const json = JSON.stringify({ ...baseDeck(), title: 'x', pad: 'p'.repeat(6145) });
      expect(decodeDeck(fragmentOfJson(json))).toEqual({ ok: false, reason: 'too_large' });
    });
  });
});
