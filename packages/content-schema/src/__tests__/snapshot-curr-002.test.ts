import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFileSchema,
  DAY_LOG_DAYS,
  DAY_LOG_INSTALL_KEYS_MAX,
  DayLogSchema,
  MemoryBackupSchema,
  PROGRESS_RECORD_MAX,
  ProgressSnapshotSchema,
  ProgressSummarySchema,
  ReviewKindSchema,
  ReviewListSchema,
  SessionLogSchema,
  SnapshotPutSchema,
  capRecord,
  readSnapshotCopy,
  trimDayLog,
  withKnownReviews,
  type ProgressSnapshot,
} from '../index';

/** A snapshot shaped like the ones every build before F-CURR-002 stores. */
const legacy = {
  profileId: 'profile:one',
  updatedAt: '2026-10-10T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
};
const summary = {
  schemaVersion: 1,
  lastActiveAt: '2026-10-10T00:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 8, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};
const put = (snapshot: unknown, sum: unknown = summary) => SnapshotPutSchema.parse({ baseRev: 0, snapshot, summary: sum, schemaVer: 1, contentVer: '2026.10' });
const backup = (snapshot: unknown, extra: Record<string, unknown> = {}) => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: '2026-10-21T00:00:00.000Z',
  profile: { id: 'profile:one', displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', createdAt: '2026-09-01T00:00:00.000Z' },
  snapshot,
  ...extra,
});

const review = (id: string, kind: string) => ({ id, kind, generatedAt: '2026-10-21T00:00:00.000Z', scope: 'stage2', itemIds: ['lex:sagwa'] });
/** Two known entries, one of each new kind, one from a newer build and one malformed. */
const mixedReviews = [
  review('review:a', 'daily'),
  review('review:b', 'cell-check'),
  review('review:c', 'warmup'),
  review('review:d', 'pack-check'),
  { id: 'review:e', kind: 'daily' },
  review('review:f', 'stage-certificate'),
];
const keptIds = ['review:a', 'review:b', 'review:c', 'review:f'];

/** Every F-CURR-002 snapshot field, well formed. */
const full = {
  cellBest: { 'letters-s2': 2, 'pack:numbers-time:1': 1 },
  cellCheckAt: { 'letters-s2': '2026-10-20T09:00:00.000Z' },
  stageCheckAt: { stage2: '2026-10-21T09:00:00.000Z' },
  testedOut: { 'life-s3': '2026-10-19T09:00:00.000Z' },
  goals: { daily: 6, weeklyDays: 5, setAt: '2026-10-18T09:00:00.000Z' },
  dayLog: { '2026-10-20': { 'install-a': 3 }, '2026-10-21': { 'install-a': 6, 'install-b': 2 } },
  streakLocal: { run: 4, lastDay: '2026-10-21' },
  streakBest: 9,
  stamps: { 'first-cell': '2026-10-15T09:00:00.000Z' },
  memSeededAt: '2026-10-14T09:00:00.000Z',
};
const NEW_KEYS = Object.keys(full);

describe('ReviewKindSchema (F-CURR-002 section 4.8)', () => {
  it('knows the two new kinds next to the existing three', () => {
    expect(ReviewKindSchema.options).toEqual(['daily', 'feedback', 'stage-certificate', 'cell-check', 'warmup']);
  });
});

describe('the reviews array is lenient per entry on every read path', () => {
  it('drops only an entry of an unknown kind or a malformed one in a snapshot', () => {
    expect(ProgressSnapshotSchema.parse({ ...legacy, reviews: mixedReviews }).reviews.map((r) => r.id)).toEqual(keptIds);
  });

  it('drops it in a snapshot upload body (PUT), and the rest of the body parses', () => {
    const body = put({ ...legacy, reviews: mixedReviews, streakDays: 3 });
    expect(body.snapshot.reviews.map((r) => r.id)).toEqual(keptIds);
    expect(body.snapshot.streakDays).toBe(3);
  });

  it('drops it in a backup file, which still restores', () => {
    const file = BackupFileSchema.parse(backup({ ...legacy, reviews: mixedReviews }));
    expect(file.snapshot.reviews.map((r) => r.id)).toEqual(keptIds);
    expect(file.profile.displayName).toBe('Suni');
  });

  it('is lenient per entry only: a missing or non-array list still fails, so it can never clear stored reviews', () => {
    const { reviews: _drop, ...noReviews } = legacy;
    expect(ProgressSnapshotSchema.safeParse(noReviews).success).toBe(false);
    for (const reviews of [null, 'x', {}]) {
      expect(ProgressSnapshotSchema.safeParse({ ...legacy, reviews }).success).toBe(false);
      expect(() => put({ ...legacy, reviews })).toThrow();
    }
    expect(ReviewListSchema.safeParse(null).success).toBe(false);
    expect(ReviewListSchema.parse([])).toEqual([]);
  });

  it('withKnownReviews drops unknown kinds from an unparsed copy (snapshot GET, Rescue Code restore)', () => {
    const fromServer = { ...legacy, reviews: mixedReviews } as unknown as ProgressSnapshot;
    const read = withKnownReviews(fromServer);
    expect(read.reviews.map((r) => r.id)).toEqual(keptIds);
    expect(read).not.toBe(fromServer);
    expect(fromServer.reviews).toHaveLength(mixedReviews.length);
  });

  it('readSnapshotCopy reads reviews per entry and each new field through its lenient schema', () => {
    const fromServer = {
      ...legacy,
      reviews: mixedReviews,
      cellBest: { a: 4, b: 2 },
      goals: { daily: 12, weeklyDays: 7, setAt: '2026-10-21T09:00:00.000Z' },
      streakBest: 9,
      stamps: { s1: '2026-10-21T09:00:00' },
    } as unknown as ProgressSnapshot;
    const read = readSnapshotCopy(fromServer);
    expect(read.reviews.map((r) => r.id)).toEqual(keptIds);
    expect(read.cellBest).toEqual({ b: 2 });
    expect(read).not.toHaveProperty('goals');
    expect(read.streakBest).toBe(9);
    expect(read.stamps).toEqual({});
    const fine = { ...legacy, cellBest: { b: 2 }, streakBest: 3 } as unknown as ProgressSnapshot;
    expect(readSnapshotCopy(fine)).toBe(fine);
  });

  it('withKnownReviews returns the same object when every entry is readable', () => {
    const fine = { ...legacy, reviews: [review('review:a', 'warmup')] } as unknown as ProgressSnapshot;
    expect(withKnownReviews(fine)).toBe(fine);
    const odd = withKnownReviews({ reviews: 'x' } as { reviews: unknown });
    expect(odd.reviews).toEqual([]);
  });
});

describe('the F-CURR-002 snapshot fields are optional, additive and lenient on read', () => {
  it('an older-client snapshot parses unchanged and round-trips without inventing any key', () => {
    const parsed = ProgressSnapshotSchema.parse(legacy);
    for (const key of NEW_KEYS) expect(parsed).not.toHaveProperty(key);
    const again = ProgressSnapshotSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(again).toEqual(parsed);
    const body = put(legacy);
    for (const key of NEW_KEYS) expect(body.snapshot).not.toHaveProperty(key);
    const old: ProgressSnapshot = legacy;
    expect(old.cellBest ?? {}).toEqual({});
  });

  it('carries every field through a snapshot, an upload body and a backup file', () => {
    expect(ProgressSnapshotSchema.parse({ ...legacy, ...full })).toEqual({ ...legacy, placements: [], selfRoute: null, ...full });
    expect(put({ ...legacy, ...full }).snapshot).toMatchObject(full);
    expect(BackupFileSchema.parse(backup({ ...legacy, ...full })).snapshot).toMatchObject(full);
  });

  it('drops a bad entry on its own and keeps the rest of the record', () => {
    const parsed = ProgressSnapshotSchema.parse({
      ...legacy,
      cellBest: { a: 3, b: 4, c: -1, d: 1.5, e: '2', '': 1, ['x'.repeat(65)]: 1 },
      cellCheckAt: { a: '2026-10-20T00:00:00.000Z', b: 7, c: '', d: 'x'.repeat(41) },
      stamps: { s1: '2026-10-20T00:00:00.000Z', s2: null },
      dayLog: { '2026-10-21': { k: 2, bad: -1, frac: 0.5, huge: 10_001 }, '2026-02-30': { k: 1 }, 'not-a-day': { k: 1 }, '2026-10-20': 'x' },
    });
    expect(parsed.cellBest).toEqual({ a: 3 });
    expect(parsed.cellCheckAt).toEqual({ a: '2026-10-20T00:00:00.000Z' });
    expect(parsed.stamps).toEqual({ s1: '2026-10-20T00:00:00.000Z' });
    expect(parsed.dayLog).toEqual({ '2026-10-21': { k: 2 } });
  });

  it('reads a bad value as absent, never failing the snapshot', () => {
    for (const bad of [null, [], true, -1.5]) {
      const parsed = ProgressSnapshotSchema.parse({
        ...legacy,
        cellBest: bad,
        cellCheckAt: bad,
        stageCheckAt: bad,
        testedOut: bad,
        goals: bad,
        dayLog: bad,
        streakLocal: bad,
        streakBest: bad,
        stamps: bad,
        memSeededAt: bad,
      });
      for (const key of NEW_KEYS) expect(parsed[key as keyof typeof parsed]).toBeUndefined();
    }
    // A text where a record belongs reads as absent; memSeededAt must be a strict ISO instant.
    const text = ProgressSnapshotSchema.parse({ ...legacy, cellBest: 'x', dayLog: 'x', goals: 'x', streakLocal: 'x', streakBest: 'x', memSeededAt: 'x' });
    expect([text.cellBest, text.dayLog, text.goals, text.streakLocal, text.streakBest, text.memSeededAt]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
    const odd = ProgressSnapshotSchema.parse({
      ...legacy,
      goals: { daily: 5, weeklyDays: 5, setAt: 't' },
      streakLocal: { run: -1, lastDay: '2026-10-21' },
      streakBest: -2,
      memSeededAt: '',
    });
    expect([odd.goals, odd.streakLocal, odd.streakBest, odd.memSeededAt]).toEqual([undefined, undefined, undefined, undefined]);
    expect(ProgressSnapshotSchema.parse({ ...legacy, streakLocal: { run: 2, lastDay: '2026-13-01' } }).streakLocal).toBeUndefined();
    const setAt = '2026-10-21T09:00:00.000Z';
    expect(ProgressSnapshotSchema.parse({ ...legacy, goals: { daily: 10, weeklyDays: 7, setAt } }).goals).toEqual({ daily: 10, weeklyDays: 7, setAt });
  });

  it('reads only strict ISO instants with Z or an offset, so every engine orders them the same', () => {
    for (const at of ['2026-10-21T09:00:00Z', '2026-10-21T18:00:00+09:00', '2026-10-21T09:00:00.123Z']) {
      const parsed = ProgressSnapshotSchema.parse({ ...legacy, memSeededAt: at, stamps: { s1: at }, goals: { daily: 3, weeklyDays: 3, setAt: at } });
      expect([parsed.memSeededAt, parsed.stamps, parsed.goals?.setAt]).toEqual([at, { s1: at }, at]);
    }
    // No offset (local time on a device, UTC on the Worker), a space, RFC 2822: dropped on read.
    // Outside the ECMAScript format or off the calendar: +02 and +0200 offsets, a 6- or 9-digit fraction, 30 February, hour 24.
    for (const at of [
      '2026-10-21T09:00:00',
      '2026-10-21 09:00:00Z',
      'Wed, 21 Oct 2026 09:00:00 GMT',
      '2026-10-21',
      '2026-10-21T00:00:00+02',
      '2026-10-21T08:00:00+0900',
      '2026-10-21T09:00:00.123456Z',
      '2026-10-21T09:00:00.123456789Z',
      '2026-02-30T00:00:00Z',
      '2026-10-21T24:00:00Z',
      '2026-10-21T09:60:00Z',
      '2026-10-21T09:00:00+24:00',
    ]) {
      const parsed = ProgressSnapshotSchema.parse({ ...legacy, memSeededAt: at, stamps: { s1: at, s2: '2026-10-21T09:00:00Z' }, goals: { daily: 3, weeklyDays: 3, setAt: at } });
      expect([parsed.memSeededAt, parsed.stamps, parsed.goals]).toEqual([undefined, { s2: '2026-10-21T09:00:00Z' }, undefined]);
    }
  });

  it('reads a session localDay that does not exist on the calendar as absent', () => {
    const session = { id: 's1', profileId: 'p1', startedAt: '2026-02-28T09:00:00.000Z', episodesTouched: [] };
    const parsed = ProgressSnapshotSchema.parse({ ...legacy, sessions: [{ ...session, localDay: '2026-02-30' }, { ...session, id: 's2', localDay: '2026-02-28' }] });
    expect(parsed.sessions.map((x) => x.localDay)).toEqual([undefined, '2026-02-28']);
  });

  it('keeps at most PROGRESS_RECORD_MAX entries, in key order', () => {
    const many = Object.fromEntries(Array.from({ length: PROGRESS_RECORD_MAX + 5 }, (_, i) => [`c${String(i).padStart(5, '0')}`, 1]));
    const parsed = ProgressSnapshotSchema.parse({ ...legacy, cellBest: many }).cellBest ?? {};
    expect(Object.keys(parsed)).toHaveLength(PROGRESS_RECORD_MAX);
    expect(Object.keys(parsed)[0]).toBe('c00000');
    expect(parsed).not.toHaveProperty(`c${String(PROGRESS_RECORD_MAX).padStart(5, '0')}`);
  });

  it('keeps own keys named like Object.prototype members as plain entries', () => {
    const parsed = ProgressSnapshotSchema.parse(JSON.parse('{"profileId":"p","updatedAt":"t","episodes":[],"quests":[],"cards":[],"sessions":[],"homework":[],"reviews":[],"streakDays":0,"cellBest":{"__proto__":2,"constructor":1}}'));
    expect(Object.keys(parsed.cellBest ?? {})).toEqual(['__proto__', 'constructor']);
    expect(Object.getPrototypeOf(parsed.cellBest)).toBe(Object.prototype);
  });
});

describe('dayLog keeps the last 70 days and the install keys inside the snapshot', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);

  it('keeps the newest DAY_LOG_DAYS days that hold points, by count', () => {
    const log = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [day(i), { k: 1 }]));
    const parsed = DayLogSchema.parse(log) ?? {};
    expect(Object.keys(parsed)).toHaveLength(DAY_LOG_DAYS);
    expect(Object.keys(parsed)[0]).toBe(day(100 - DAY_LOG_DAYS));
    // Gaps do not count: days far apart are all kept while there are at most DAY_LOG_DAYS of them.
    expect(trimDayLog({ [day(200)]: { k: 2 }, [day(0)]: { k: 1 }, [day(69)]: { k: 1 } })).toEqual({ [day(0)]: { k: 1 }, [day(69)]: { k: 1 }, [day(200)]: { k: 2 } });
    expect(trimDayLog({})).toEqual({});
  });

  it('a far-future day evicts at most one real day, and an empty day is never kept', () => {
    const real = Object.fromEntries(Array.from({ length: DAY_LOG_DAYS }, (_, i) => [day(i), { k: i + 1 }]));
    const trimmed = trimDayLog({ ...real, '2099-01-01': { b: 1 } });
    expect(Object.keys(trimmed)).toHaveLength(DAY_LOG_DAYS);
    expect(trimmed).not.toHaveProperty(day(0));
    expect(trimmed[day(1)]).toEqual({ k: 2 });
    expect(trimmed['2099-01-01']).toEqual({ b: 1 });
    // An empty day cannot become the newest day or take a place.
    expect(trimDayLog({ [day(1)]: { k: 1 }, '2099-01-01': {} })).toEqual({ [day(1)]: { k: 1 } });
  });

  it('keeps at most DAY_LOG_INSTALL_KEYS_MAX install keys a day, in key order', () => {
    const keys = Object.fromEntries(Array.from({ length: DAY_LOG_INSTALL_KEYS_MAX + 3 }, (_, i) => [`k${String(i).padStart(3, '0')}`, 1]));
    const parsed = DayLogSchema.parse({ '2026-10-21': keys }) ?? {};
    expect(Object.keys(parsed['2026-10-21'] ?? {})).toHaveLength(DAY_LOG_INSTALL_KEYS_MAX);
  });

  it('never puts an install key in the summary schema', () => {
    const parsed = ProgressSummarySchema.parse({ ...summary, dayLog: full.dayLog, installKey: 'install-a' });
    expect(JSON.stringify(parsed)).not.toContain('install-a');
  });
});

describe('record helpers', () => {
  it('reads only real calendar days as local days', () => {
    for (const ok of ['2026-10-21', '2024-02-29']) expect(ProgressSnapshotSchema.parse({ ...legacy, streakLocal: { run: 1, lastDay: ok } }).streakLocal?.lastDay).toBe(ok);
    for (const bad of ['2026-02-29', '2026-13-01', '2026-1-01']) expect(ProgressSnapshotSchema.parse({ ...legacy, streakLocal: { run: 1, lastDay: bad } }).streakLocal).toBeUndefined();
  });

  it('capRecord sorts in code-point order and cuts', () => {
    expect(capRecord([['b', 1], ['a', 2], ['B', 3]], 2)).toEqual({ B: 3, a: 2 });
    expect(Object.keys(capRecord([['b', 1], ['a', 2], ['b', 4]], 5))).toEqual(['a', 'b']);
  });
});

describe('SessionLog.localDay (F-CURR-002 section 4.8)', () => {
  const session = { id: 'session:1', profileId: 'profile:one', startedAt: '2026-10-21T23:30:00.000Z', episodesTouched: [] };

  it('is optional and kept when well formed', () => {
    expect(SessionLogSchema.parse(session)).not.toHaveProperty('localDay');
    expect(SessionLogSchema.parse({ ...session, localDay: '2026-10-22' }).localDay).toBe('2026-10-22');
    expect(put({ ...legacy, sessions: [{ ...session, localDay: '2026-10-22' }] }).snapshot.sessions[0]?.localDay).toBe('2026-10-22');
  });

  it('reads a malformed value as absent and keeps the session', () => {
    for (const bad of ['22-10-2026', 7, null]) {
      const parsed = SessionLogSchema.parse({ ...session, localDay: bad });
      expect(parsed.id).toBe('session:1');
      expect(parsed.localDay).toBeUndefined();
    }
  });
});

describe('summary.memory (F-CURR-002 section 4.8)', () => {
  const memory = { wordsKnown: 42, readyToRefresh: 7, cellBestCounts: [5, 2, 1], stageChecks: 1, weekPoints: 18, topDue: ['lex:sagwa', 'sym:ㅂ'] };

  it('is optional: an older summary parses without it', () => {
    expect(ProgressSummarySchema.parse(summary)).not.toHaveProperty('memory');
  });

  it('carries a well-formed block through the upload body', () => {
    expect(put(legacy, { ...summary, memory }).summary.memory).toEqual(memory);
    const most = { ...memory, topDue: Array.from({ length: 8 }, (_, i) => `lex:w${i}`) };
    expect(ProgressSummarySchema.parse({ ...summary, memory: most }).memory?.topDue).toHaveLength(8);
  });

  it('drops a malformed or oversized block and keeps the rest of the summary (never a 422)', () => {
    for (const bad of [
      null,
      'x',
      { ...memory, topDue: Array.from({ length: 9 }, (_, i) => `lex:w${i}`) },
      { ...memory, cellBestCounts: [1, 2] },
      { ...memory, wordsKnown: -1 },
      { ...memory, weekPoints: 100_001 },
      { ...memory, topDue: [''] },
    ]) {
      const parsed = put(legacy, { ...summary, memory: bad }).summary;
      expect(parsed.memory).toBeUndefined();
      expect(parsed.streakDays).toBe(0);
    }
  });
});

describe('the backup memory key (F-CURR-002 section 4.8, F-SYNC-002, F-RESTORE-001)', () => {
  const state = { b: 3, d: '2026-10-25', c: 2, r: 3, n: 4, f: '2026-10-01', s: 4, at: '2026-10-21T09:00:00.000Z' };

  it('keeps BACKUP_VERSION at 1 and restores a file without the key', () => {
    expect(BACKUP_VERSION).toBe(1);
    expect(BackupFileSchema.parse(backup(legacy))).not.toHaveProperty('memory');
  });

  it('carries a readable memory store', () => {
    const memory = { stage2: { 'lex:sagwa': state }, 'pack:numbers-time': { 'rea:price-won': { ...state, d: null } } };
    expect(BackupFileSchema.parse(backup(legacy, { memory })).memory).toEqual(memory);
    expect(MemoryBackupSchema.parse({})).toEqual({});
  });

  it('drops an unreadable key without failing the file', () => {
    for (const memory of [null, 'x', []]) {
      const file = BackupFileSchema.parse(backup({ ...legacy, reviews: mixedReviews }, { memory }));
      expect(file.memory).toBeUndefined();
      expect(file.snapshot.reviews.map((r) => r.id)).toEqual(keptIds);
    }
  });

  it('reads per entry: a bad item drops only itself and a bad shard only that shard', () => {
    const memory = {
      stage2: {
        'lex:sagwa': state,
        'lex:bad': { ...state, b: 8 },
        'lex:feb': { ...state, d: '2026-02-30' },
        'lex:first': { ...state, f: '2026-13-01' },
        // A local-time clock would order differently on Hermes and V8: the item drops, its siblings stay.
        'lex:local': { ...state, at: '2026-10-21T09:00:00' },
        'lex:offset': { ...state, at: '2026-10-21T18:00:00+0900' },
      },
      'pack:numbers-time': { 'rea:price-won': { ...state, d: null } },
      week: 'x',
    };
    const file = BackupFileSchema.parse(backup(legacy, { memory }));
    expect(file.memory).toEqual({ 'pack:numbers-time': { 'rea:price-won': { ...state, d: null } }, stage2: { 'lex:sagwa': state } });
  });
});
