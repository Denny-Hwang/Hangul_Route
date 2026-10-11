import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFileSchema,
  ProgressSnapshotSchema,
  ProgressSummarySchema,
  VocabItemStateSchema,
  VocabProgressSchema,
  VocabSummarySchema,
  VocabTopicProgressSchema,
  type VocabProgress,
} from '../index';

/** F-VOC-005 section 3.1: the word-progress slice of the snapshot. */

const item = {
  id: 'vocab:sagwa-apple',
  first: '2026-10-10',
  seen: 3,
  right: 2,
  bestBox: 3,
  last: '2026-10-12',
  box: 2,
  due: '2026-10-15',
  at: '2026-10-12T09:00:00.000Z',
};
const topic = { topic: 'food', bestStars: 2, sessions: 4, last: '2026-10-12', bestCaught: 9 };
const slice: VocabProgress = { v: 1, items: [item], topics: [topic] };

const snapshot = {
  profileId: 'profile:abc',
  updatedAt: '2026-10-12T09:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
};
const summary = {
  schemaVersion: 1 as const,
  lastActiveAt: '2026-10-12T09:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};
const vocabSummary = {
  collected: 12,
  strong: 4,
  topicsStarted: 2,
  topicsPracticed7d: 1,
  firstTryRate: 0.75,
  needsPractice: ['vocab:sagwa-apple', 'vocab:nun-eye'],
};

const itemsOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ ...item, id: `vocab:word${i}-gloss` }));

describe('VocabItemStateSchema (F-VOC-005 section 3.1)', () => {
  it('accepts a full state and a not-scheduled one (due null)', () => {
    expect(VocabItemStateSchema.parse(item)).toEqual(item);
    expect(VocabItemStateSchema.parse({ ...item, due: null }).due).toBeNull();
    expect(VocabItemStateSchema.safeParse({ ...item, box: 0, bestBox: 0, seen: 0, right: 0 }).success).toBe(true);
  });

  it('enforces the refinement right <= seen and bestBox >= box', () => {
    expect(VocabItemStateSchema.safeParse({ ...item, right: 4, seen: 3 }).success).toBe(false);
    expect(VocabItemStateSchema.safeParse({ ...item, right: 3, seen: 3 }).success).toBe(true);
    expect(VocabItemStateSchema.safeParse({ ...item, box: 4, bestBox: 3 }).success).toBe(false);
    expect(VocabItemStateSchema.safeParse({ ...item, box: 3, bestBox: 3 }).success).toBe(true);
  });

  it('rejects boxes outside 0-5 and non-integer counts', () => {
    for (const box of [-1, 6, 9, 1.5]) {
      expect(VocabItemStateSchema.safeParse({ ...item, box, bestBox: 5 }).success).toBe(false);
    }
    expect(VocabItemStateSchema.safeParse({ ...item, bestBox: 6 }).success).toBe(false);
    expect(VocabItemStateSchema.safeParse({ ...item, seen: -1 }).success).toBe(false);
    expect(VocabItemStateSchema.safeParse({ ...item, right: 0.5 }).success).toBe(false);
  });

  it('rejects bad day strings and a malformed id', () => {
    for (const day of ['yesterday', '2026-1-01', '2026/10/10', '2026-10-10T00:00:00Z', '']) {
      expect(VocabItemStateSchema.safeParse({ ...item, first: day }).success).toBe(false);
      expect(VocabItemStateSchema.safeParse({ ...item, last: day }).success).toBe(false);
      expect(VocabItemStateSchema.safeParse({ ...item, due: day }).success).toBe(false);
    }
    expect(VocabItemStateSchema.safeParse({ ...item, id: 'sagwa-apple' }).success).toBe(false);
    expect(VocabItemStateSchema.safeParse({ ...item, id: 'vocab:Sagwa' }).success).toBe(false);
    expect(VocabItemStateSchema.safeParse({ ...item, at: 7 }).success).toBe(false);
  });

  it('rejects calendar days that do not exist, so a due day can always come due', () => {
    for (const day of ['2026-13-45', '2026-02-30', '2027-02-29', '9999-99-99', '2026-00-10', '2026-10-00']) {
      expect(VocabItemStateSchema.safeParse({ ...item, first: day }).success).toBe(false);
      expect(VocabItemStateSchema.safeParse({ ...item, last: day }).success).toBe(false);
      expect(VocabItemStateSchema.safeParse({ ...item, due: day }).success).toBe(false);
    }
    expect(VocabItemStateSchema.safeParse({ ...item, first: '2028-02-29', last: '2028-02-29' }).success).toBe(true);
  });

  it('takes `at` only as an ISO date-time (UTC or offset) of at most 40 characters', () => {
    for (const at of ['2026-10-12T09:00:00.000Z', '2026-10-12T09:00:00+09:00', '2026-10-12T09:00Z']) {
      expect(VocabItemStateSchema.safeParse({ ...item, at }).success).toBe(true);
    }
    for (const at of ['zzz', '', '2026-10-12', '2026-10-12 09:00:00', '9999-99-99T99:99:99Z', `2026-10-12T09:00:00.${'1'.repeat(40)}Z`]) {
      expect(VocabItemStateSchema.safeParse({ ...item, at }).success).toBe(false);
    }
  });
});

describe('VocabTopicProgressSchema', () => {
  it('accepts a topic key of the slug shape, including one this build does not know', () => {
    expect(VocabTopicProgressSchema.parse(topic)).toEqual(topic);
    expect(VocabTopicProgressSchema.safeParse({ ...topic, topic: 'body-parts' }).success).toBe(true);
  });

  it('rejects a malformed key, stars outside 0-3, negative counts and a bad day', () => {
    for (const key of ['Food', 'food_', '-food', 'food--x', '']) {
      expect(VocabTopicProgressSchema.safeParse({ ...topic, topic: key }).success).toBe(false);
    }
    expect(VocabTopicProgressSchema.safeParse({ ...topic, bestStars: 4 }).success).toBe(false);
    expect(VocabTopicProgressSchema.safeParse({ ...topic, bestStars: -1 }).success).toBe(false);
    expect(VocabTopicProgressSchema.safeParse({ ...topic, sessions: -1 }).success).toBe(false);
    expect(VocabTopicProgressSchema.safeParse({ ...topic, bestCaught: -2 }).success).toBe(false);
    expect(VocabTopicProgressSchema.safeParse({ ...topic, last: 'today' }).success).toBe(false);
  });
});

describe('VocabProgressSchema', () => {
  it('accepts the slice and the empty slice', () => {
    expect(VocabProgressSchema.parse(slice)).toEqual(slice);
    expect(VocabProgressSchema.parse({ v: 1, items: [], topics: [] })).toEqual({ v: 1, items: [], topics: [] });
  });

  it('pins the version literal', () => {
    expect(VocabProgressSchema.safeParse({ ...slice, v: 2 }).success).toBe(false);
  });

  it('caps items at 1,000 and topics at 100', () => {
    expect(VocabProgressSchema.safeParse({ v: 1, items: itemsOf(1000), topics: [] }).success).toBe(true);
    expect(VocabProgressSchema.safeParse({ v: 1, items: itemsOf(1001), topics: [] }).success).toBe(false);
    const topics = (n: number) => Array.from({ length: n }, (_, i) => ({ ...topic, topic: `t${i}` }));
    expect(VocabProgressSchema.safeParse({ v: 1, items: [], topics: topics(100) }).success).toBe(true);
    expect(VocabProgressSchema.safeParse({ v: 1, items: [], topics: topics(101) }).success).toBe(false);
  });

  it('rejects a duplicate word id or a duplicate topic key', () => {
    expect(VocabProgressSchema.safeParse({ ...slice, items: [item, { ...item, seen: 4 }] }).success).toBe(false);
    expect(VocabProgressSchema.safeParse({ ...slice, topics: [topic, { ...topic, sessions: 1 }] }).success).toBe(false);
    expect(VocabProgressSchema.safeParse({ ...slice, items: [item, { ...item, id: 'vocab:nun-eye' }] }).success).toBe(true);
  });

  it('fails when one item breaks the refinement', () => {
    expect(VocabProgressSchema.safeParse({ ...slice, items: [{ ...item, right: 9 }] }).success).toBe(false);
  });
});

describe('VocabSummarySchema (F-VOC-005 section 3.8)', () => {
  it('accepts counts, a rate and up to three words', () => {
    expect(VocabSummarySchema.parse(vocabSummary)).toEqual(vocabSummary);
    expect(VocabSummarySchema.parse({ ...vocabSummary, firstTryRate: null, needsPractice: [] }).firstTryRate).toBeNull();
  });

  it('rejects a rate outside 0-1, negative counts, more than three words and a non-vocab id', () => {
    expect(VocabSummarySchema.safeParse({ ...vocabSummary, firstTryRate: 1.2 }).success).toBe(false);
    expect(VocabSummarySchema.safeParse({ ...vocabSummary, firstTryRate: -0.1 }).success).toBe(false);
    expect(VocabSummarySchema.safeParse({ ...vocabSummary, collected: -1 }).success).toBe(false);
    expect(VocabSummarySchema.safeParse({ ...vocabSummary, strong: 1.5 }).success).toBe(false);
    expect(
      VocabSummarySchema.safeParse({ ...vocabSummary, needsPractice: ['vocab:a', 'vocab:b', 'vocab:c', 'vocab:d'] }).success,
    ).toBe(false);
    expect(VocabSummarySchema.safeParse({ ...vocabSummary, needsPractice: ['jamo:g'] }).success).toBe(false);
  });
});

describe('the slice on the snapshot, the summary and the backup file', () => {
  it('old snapshots, summaries and backups without the fields still parse, with no vocab key added', () => {
    const snap = ProgressSnapshotSchema.parse(snapshot);
    expect(snap).not.toHaveProperty('vocab');
    const sum = ProgressSummarySchema.parse(summary);
    expect(sum).not.toHaveProperty('vocab');
    const file = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 't',
      profile: { id: 'profile:abc', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', createdAt: 't' },
      snapshot,
    };
    expect(BackupFileSchema.parse(file).snapshot).not.toHaveProperty('vocab');
  });

  it('a snapshot, a summary and a backup with the fields round-trip', () => {
    expect(ProgressSnapshotSchema.parse({ ...snapshot, vocab: slice }).vocab).toEqual(slice);
    expect(ProgressSummarySchema.parse({ ...summary, vocab: vocabSummary }).vocab).toEqual(vocabSummary);
    const file = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 't',
      profile: { id: 'profile:abc', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', createdAt: 't' },
      snapshot: { ...snapshot, vocab: slice },
    };
    const parsed = BackupFileSchema.parse(JSON.parse(JSON.stringify(file)));
    expect(parsed.snapshot.vocab).toEqual(slice);
  });

  it('a malformed slice fails the snapshot (the Worker answers 422, never stores it)', () => {
    expect(ProgressSnapshotSchema.safeParse({ ...snapshot, vocab: { ...slice, items: [{ ...item, box: 9 }] } }).success).toBe(false);
    expect(ProgressSnapshotSchema.safeParse({ ...snapshot, vocab: { ...slice, items: [{ ...item, first: 'yesterday' }] } }).success).toBe(false);
  });

  it('a malformed summary.vocab is dropped, never fatal: the rest of the summary still parses', () => {
    for (const bad of [{ ...vocabSummary, firstTryRate: 1.0000001 }, { ...vocabSummary, needsPractice: ['vocab:a', 'vocab:b', 'vocab:c', 'vocab:d'] }, 'x']) {
      const parsed = ProgressSummarySchema.safeParse({ ...summary, vocab: bad });
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.vocab).toBeUndefined();
      expect(parsed.success && parsed.data.streakDays).toBe(0);
    }
  });

  it('a backup file with a malformed slice still restores everything else, without the slice', () => {
    const quest = { questId: 'quest:s1-q1', episodeId: 'episode:s1', startedAt: 't', stars: 3, attempts: 1, accuracy: 1 };
    const card = { cardId: 'card:sejong', unlockedAt: 't', newSinceLastView: false };
    const file = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 't',
      profile: { id: 'profile:abc', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', createdAt: 't' },
      snapshot: { ...snapshot, quests: [quest], cards: [card] },
    };
    for (const vocab of [{ ...slice, items: [{ ...item, box: 9 }] }, { ...slice, v: 2 }, { ...slice, items: [item, item] }]) {
      const parsed = BackupFileSchema.safeParse({ ...file, snapshot: { ...file.snapshot, vocab } });
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.snapshot.vocab).toBeUndefined();
      expect(parsed.success && parsed.data.snapshot.quests).toHaveLength(1);
      expect(parsed.success && parsed.data.snapshot.cards).toEqual([card]);
    }
    // The sync contract stays strict: the Worker still answers 422 for the same slice.
    expect(ProgressSnapshotSchema.safeParse({ ...snapshot, vocab: { ...slice, v: 2 } }).success).toBe(false);
  });
});
