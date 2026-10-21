import { describe, expect, it } from 'vitest';
import { ADDITIVE_FIELDS, preserveAdditiveFields } from '../additive-fields';

/*
 * F-CURR-002 section 4.8 and row CM-3b: the Worker keeps and merges the new
 * snapshot fields before any app writes them (Worker first).
 */

const stored = (payload: unknown, summary: unknown) => ({ payload, summary });
const incoming = (payload: Record<string, unknown>, summary: Record<string, unknown>) => ({ payload, summary });

const NEW_KEYS = ['cellBest', 'cellCheckAt', 'stageCheckAt', 'testedOut', 'goals', 'dayLog', 'streakLocal', 'streakBest', 'stamps', 'memSeededAt'];
const fields = {
  cellBest: { 'letters-s2': 2, 'life-s3': 1 },
  cellCheckAt: { 'letters-s2': '2026-10-20T09:00:00.000Z' },
  stageCheckAt: { stage2: '2026-10-21T09:00:00.000Z' },
  testedOut: { 'life-s3': '2026-10-19T09:00:00.000Z' },
  goals: { daily: 6, weeklyDays: 5, setAt: '2026-10-18T09:00:00.000Z' },
  dayLog: { '2026-10-21': { 'install-a': 6 } },
  streakLocal: { run: 4, lastDay: '2026-10-21' },
  streakBest: 9,
  stamps: { 'first-cell': '2026-10-15T09:00:00.000Z' },
  memSeededAt: '2026-10-14T09:00:00.000Z',
};
const memory = { wordsKnown: 42, readyToRefresh: 7, cellBestCounts: [5, 2, 1], stageChecks: 1, weekPoints: 18, topDue: ['lex:sagwa'] };

describe('preserveAdditiveFields (F-CURR-002 section 4.8 fields)', () => {
  it('lists every new field after the earlier ones, each with a merge and absent-only as unset', () => {
    const keys = ADDITIVE_FIELDS.map((f) => f.payloadKey);
    expect(keys.slice(0, 6)).toEqual(['placements', 'stageDoneAt', 'selfRoute', 'vocab', 'questDoneAt', 'sessions']);
    expect(keys.slice(6)).toEqual(NEW_KEYS);
    for (const key of NEW_KEYS) {
      const field = ADDITIVE_FIELDS.find((f) => f.payloadKey === key);
      expect(field?.merge).toBeDefined();
      expect(field?.isUnset(undefined)).toBe(true);
      for (const value of [{}, 0, null, 'x']) expect(field?.isUnset(value)).toBe(false);
    }
    expect(ADDITIVE_FIELDS.find((f) => f.payloadKey === 'memSeededAt')?.summaryKey).toBe('memory');
  });

  it('keeps every stored field when an older build leaves the keys out, and never clears one', () => {
    const out = preserveAdditiveFields(incoming({ quests: ['new'] }, { streakDays: 3 }), stored({ quests: ['old'], ...fields }, { streakDays: 1, memory }));
    expect(out.payload).toEqual({ quests: ['new'], ...fields });
    expect(out.summary).toEqual({ streakDays: 3, memory });
  });

  it('invents nothing when nothing is stored, and returns the sent objects as is', () => {
    const inc = incoming({ quests: [] }, { streakDays: 0 });
    for (const prior of [null, stored({ quests: [] }, { memory }), stored({}, null)]) {
      const out = preserveAdditiveFields(inc, prior);
      expect(out.payload).toBe(inc.payload);
      expect(out.summary).toBe(inc.summary);
    }
  });

  it('returns the sent payload itself when the stored values add nothing', () => {
    const inc = incoming({ ...fields }, { memory });
    const out = preserveAdditiveFields(inc, stored({ ...fields }, { memory }));
    expect(out.payload).toBe(inc.payload);
    expect(out.summary).toBe(inc.summary);
  });

  it('merges a sent value with the stored one by the shared rule (a lagging device lowers nothing)', () => {
    const sent = {
      cellBest: { 'letters-s2': 1, 'nature-s2': 3 },
      cellCheckAt: { 'letters-s2': '2026-10-21T00:00:00.000Z' },
      stageCheckAt: { stage3: '2026-10-22T00:00:00.000Z' },
      testedOut: {},
      goals: { daily: 3, weeklyDays: 3, setAt: '2026-10-17T00:00:00.000Z' },
      dayLog: { '2026-10-21': { 'install-a': 2, 'install-b': 3 } },
      streakLocal: { run: 9, lastDay: '2026-10-20' },
      streakBest: 5,
      stamps: { 'first-album': '2026-10-21T00:00:00.000Z' },
      memSeededAt: '2026-10-16T00:00:00.000Z',
    };
    const out = preserveAdditiveFields(incoming(sent, {}), stored(fields, {}));
    expect(out.payload).toEqual({
      cellBest: { 'letters-s2': 2, 'life-s3': 1, 'nature-s2': 3 },
      cellCheckAt: { 'letters-s2': '2026-10-20T09:00:00.000Z' },
      stageCheckAt: { stage2: '2026-10-21T09:00:00.000Z', stage3: '2026-10-22T00:00:00.000Z' },
      testedOut: { 'life-s3': '2026-10-19T09:00:00.000Z' },
      // The later setAt wins, even with lower goals.
      goals: { daily: 6, weeklyDays: 5, setAt: '2026-10-18T09:00:00.000Z' },
      dayLog: { '2026-10-21': { 'install-a': 6, 'install-b': 3 } },
      // The later lastDay wins, even with a lower run.
      streakLocal: { run: 4, lastDay: '2026-10-21' },
      streakBest: 9,
      stamps: { 'first-album': '2026-10-21T00:00:00.000Z', 'first-cell': '2026-10-15T09:00:00.000Z' },
      memSeededAt: '2026-10-14T09:00:00.000Z',
    });
  });

  it('a sync from an older build never lowers streakBest, whether it leaves the key out or sends a lower one', () => {
    const absent = preserveAdditiveFields(incoming({ streakDays: 1 }, {}), stored({ streakBest: 12 }, {}));
    expect(absent.payload).toEqual({ streakDays: 1, streakBest: 12 });
    const lower = preserveAdditiveFields(incoming({ streakBest: 3 }, {}), stored({ streakBest: 12 }, {}));
    expect(lower.payload).toEqual({ streakBest: 12 });
    const higher = preserveAdditiveFields(incoming({ streakBest: 14 }, {}), stored({ streakBest: 12 }, {}));
    expect(higher.payload).toEqual({ streakBest: 14 });
  });

  it('reads an unreadable stored value as none: the sent value is kept', () => {
    const out = preserveAdditiveFields(incoming({ cellBest: { a: 2 }, goals: { daily: 3, weeklyDays: 3, setAt: 't' } }, {}), stored({ cellBest: 'junk', goals: 7 }, {}));
    expect(out.payload).toEqual({ cellBest: { a: 2 }, goals: { daily: 3, weeklyDays: 3, setAt: 't' } });
  });

  it('summary.memory travels with memSeededAt: a sent marker without a block keeps the stored block', () => {
    const kept = preserveAdditiveFields(incoming({ memSeededAt: fields.memSeededAt }, {}), stored({ memSeededAt: fields.memSeededAt }, { memory }));
    expect(kept.summary).toEqual({ memory });
    const next = { ...memory, wordsKnown: 50 };
    const sent = preserveAdditiveFields(incoming({ memSeededAt: fields.memSeededAt }, { memory: next }), stored({ memSeededAt: fields.memSeededAt }, { memory }));
    expect(sent.summary).toEqual({ memory: next });
  });
});

describe('preserveAdditiveFields (sessions[].localDay, F-CURR-002 section 4.8)', () => {
  const session = (id: string, localDay?: string) => ({ id, profileId: 'profile:one', startedAt: 't', episodesTouched: [], ...(localDay ? { localDay } : {}) });

  it('fills a session an older build re-uploaded without its localDay from the stored copy', () => {
    const out = preserveAdditiveFields(
      incoming({ sessions: [session('s1'), session('s2', '2026-10-21'), session('s3')] }, {}),
      stored({ sessions: [session('s1', '2026-10-20'), session('s2', '2026-10-19'), 'junk'] }, {}),
    );
    // A sent day is never overwritten, and a session the server does not hold is left alone.
    expect(out.payload).toEqual({ sessions: [session('s1', '2026-10-20'), session('s2', '2026-10-21'), session('s3')] });
  });

  it('never adds or removes a session, and leaves an unchanged list as the same object', () => {
    const empty = incoming({ sessions: [] }, {});
    expect(preserveAdditiveFields(empty, stored({ sessions: [session('s1', '2026-10-20')] }, {})).payload).toBe(empty.payload);
    const same = incoming({ sessions: [session('s1', '2026-10-20')] }, {});
    expect(preserveAdditiveFields(same, stored({ sessions: [session('s1', '2026-10-20')] }, {})).payload).toBe(same.payload);
    expect(preserveAdditiveFields(same, stored({ sessions: 'x' }, {})).payload).toBe(same.payload);
  });
});
