import { describe, expect, it, vi } from 'vitest';
import { buildMyRoute } from '../model';
import type { RouteGoal } from '@hangul-route/content-schema';
import {
  goalReachedKey,
  goalsReachedOf,
  hoyaPoseFor,
  isFirstGoalReached,
  newQuestsLine,
  newlyDoneKeys,
  parseSeen,
  readSeen,
  seenFrom,
  seenKey,
  withGoalReached,
  writeSeen,
  type JsonStorage,
} from '../seen';
import type { SeenRecord } from '../types';
import { BUNDLE_15, BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith, type Bundle } from './fixtures/bundle-2026-10';

const NOW = new Date('2026-10-11T09:30:00.000Z');
const model = (done: string[], seen?: SeenRecord, bundle: Bundle = BUNDLE_8, extra = {}) =>
  buildMyRoute({
    snapshot: snapshotWith(done, extra),
    catalog: catalogOf(bundle),
    episodes: bundle.episodes,
    quests: bundle.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled: () => true,
    route: null,
    ...(seen ? { seen } : {}),
    now: NOW,
  });

const memory = (initial: Record<string, unknown> = {}): JsonStorage & { data: Map<string, unknown> } => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    readJson: async <T,>(key: string) => (data.get(key) as T | undefined) ?? null,
    writeJson: async <T,>(key: string, value: T) => {
      data.set(key, value);
    },
  };
};

describe('seen record (F-ROUTE-001 section 3.10)', () => {
  it('uses the per-device key route-map-ui:<profileId>', () => {
    expect(seenKey('p1')).toBe('route-map-ui:p1');
  });

  it('records the grid quest total per stage, the done pips and the time', () => {
    const record = seenFrom(model(['quest:stage1-letters-q1']), NOW);
    expect(record).toEqual({
      totals: { stage1: 8, stage2: 2, stage3: 0, stage4: 1, stage5: 0, stage6: 0, stage7: 0 },
      doneKeys: ['quest:stage1-letters-q1'],
      at: '2026-10-11T09:30:00.000Z',
    });
  });

  it('counts the new pips of a latched stage in its total', () => {
    expect(seenFrom(model(STAGE1_8, undefined, BUNDLE_15, { stageDoneAt: { stage1: 'x' } }), NOW).totals.stage1).toBe(15);
  });

  it('parses only a well-formed record', () => {
    const good = { totals: { stage1: 8, stage9: 3 }, doneKeys: ['a'], at: 't' };
    expect(parseSeen(good)).toEqual({ totals: { stage1: 8 }, doneKeys: ['a'], at: 't' });
    for (const bad of [null, 'x', 3, [], { totals: {}, doneKeys: 'a', at: 't' }, { totals: [], doneKeys: [], at: 't' }, { totals: {}, doneKeys: [1], at: 't' }, { totals: {}, doneKeys: [], at: 1 }])
      expect(parseSeen(bad)).toBeUndefined();
    expect(parseSeen({ totals: { stage1: -1, stage2: 1.5, stage3: 'x', stage4: 2 }, doneKeys: [], at: 't' })).toEqual({ totals: { stage4: 2 }, doneKeys: [], at: 't' });
  });
});

describe('readSeen / writeSeen', () => {
  it('round-trips through the storage port', async () => {
    const storage = memory();
    const record = seenFrom(model([]), NOW);
    expect(await writeSeen(storage, 'p1', record, { readOnly: false })).toBe(true);
    expect(storage.data.get('route-map-ui:p1')).toEqual(record);
    expect(await readSeen(storage, 'p1')).toEqual(record);
  });

  it('reads nothing for a missing or malformed record', async () => {
    expect(await readSeen(memory(), 'p1')).toBeUndefined();
    expect(await readSeen(memory({ 'route-map-ui:p1': { nope: true } }), 'p1')).toBeUndefined();
  });

  it('swallows a failed read and a failed write', async () => {
    const broken: JsonStorage = {
      readJson: vi.fn(async () => {
        throw new Error('quota');
      }),
      writeJson: vi.fn(async () => {
        throw new Error('quota');
      }),
    };
    expect(await readSeen(broken, 'p1')).toBeUndefined();
    expect(await writeSeen(broken, 'p1', seenFrom(model([]), NOW), { readOnly: false })).toBe(false);
  });

  it('never writes in read-only mode (a grown-up viewing a child)', async () => {
    const storage = memory();
    const writeJson = vi.spyOn(storage, 'writeJson');
    expect(await writeSeen(storage, 'p1', seenFrom(model([]), NOW), { readOnly: true })).toBe(false);
    expect(writeJson).not.toHaveBeenCalled();
  });
});

describe('what the seen record drives', () => {
  it('one new-quests line, for the first stage with a positive number', () => {
    const seen: SeenRecord = { totals: { stage1: 8, stage2: 1 }, doneKeys: [], at: 't' };
    expect(newQuestsLine(model([], seen, BUNDLE_15))).toEqual({ stage: 'stage1', order: 1, count: 7 });
    expect(newQuestsLine(model([], { totals: { stage2: 1 }, doneKeys: [], at: 't' }))).toEqual({ stage: 'stage2', order: 2, count: 1 });
    expect(newQuestsLine(model([], { totals: { stage1: 8 }, doneKeys: [], at: 't' }))).toBeNull();
    expect(newQuestsLine(model([]))).toBeNull();
  });

  it('newly done keys for the one-time fill; none on the very first open', () => {
    const seen: SeenRecord = { totals: {}, doneKeys: ['quest:stage1-letters-q1'], at: 't' };
    expect(newlyDoneKeys(model(['quest:stage1-letters-q1', 'quest:stage1-letters-q2']), seen)).toEqual(['quest:stage1-letters-q2']);
    expect(newlyDoneKeys(model(['quest:stage1-letters-q1']), undefined)).toEqual([]);
  });

  it('Hoya cheers on the first open after a newly completed episode, else idles', () => {
    const before: SeenRecord = { totals: {}, doneKeys: ['quest:stage1-letters-q1', 'quest:stage1-letters-q2'], at: 't' };
    const letters = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'];
    expect(hoyaPoseFor(model(letters), before)).toBe('cheering');
    expect(hoyaPoseFor(model([...letters.slice(0, 2), 'quest:stage1-life-q1']), before)).toBe('idle');
    expect(hoyaPoseFor(model(letters), { ...before, doneKeys: letters })).toBe('idle');
    expect(hoyaPoseFor(model(letters), undefined)).toBe('idle');
  });
});

describe('goalsReached (Learning Route amendment section 4.5, LR-3b)', () => {
  const goal = (o: Partial<RouteGoal> = {}): RouteGoal => ({ stage: 'stage2', from: 'class', sourceId: 'plan:c', endsOn: '2026-11-01', reached: true, taste: true, ...o });
  const base: SeenRecord = { totals: { stage1: 8 }, doneKeys: ['a'], at: 't' };

  it('keys a goal by its source and stage; a default goal has no source id', () => {
    expect(goalReachedKey(goal())).toBe('class:plan:c:stage2');
    expect(goalReachedKey(goal({ from: 'default', sourceId: null, stage: 'stage1' }))).toBe('default:-:stage1');
  });

  it('reads a missing value as [] and keeps a well-formed one; a malformed one is dropped without the record', () => {
    expect(goalsReachedOf(undefined)).toEqual([]);
    expect(goalsReachedOf(base)).toEqual([]);
    expect(parseSeen({ ...base })).toEqual(base);
    expect(parseSeen({ ...base, goalsReached: ['class:plan:c:stage2'] })?.goalsReached).toEqual(['class:plan:c:stage2']);
    expect(parseSeen({ ...base, goalsReached: ['x', 3, null] })?.goalsReached).toEqual(['x']);
    expect(parseSeen({ ...base, goalsReached: 'x' })).toEqual(base);
  });

  it('is the first reached moment only for a reached goal not yet recorded', () => {
    expect(isFirstGoalReached(goal(), undefined)).toBe(true);
    expect(isFirstGoalReached(goal(), base)).toBe(true);
    expect(isFirstGoalReached(goal({ reached: false }), base)).toBe(false);
    expect(isFirstGoalReached(null, base)).toBe(false);
    expect(isFirstGoalReached(goal(), withGoalReached(base, goal()))).toBe(false);
    // A new plan with the same stage is a new goal.
    expect(isFirstGoalReached(goal({ sourceId: 'plan:d' }), withGoalReached(base, goal()))).toBe(true);
  });

  it('adds a key once', () => {
    const once = withGoalReached(base, goal());
    expect(once.goalsReached).toEqual(['class:plan:c:stage2']);
    expect(withGoalReached(once, goal())).toBe(once);
    expect(withGoalReached(once, goal({ stage: 'stage4' })).goalsReached).toEqual(['class:plan:c:stage2', 'class:plan:c:stage4']);
    expect(base.goalsReached).toBeUndefined();
  });

  it('carries the recorded goals over to the next seen record, and adds nothing without one', () => {
    const m = model(['quest:stage1-letters-q1']);
    expect(seenFrom(m, NOW, withGoalReached(base, goal())).goalsReached).toEqual(['class:plan:c:stage2']);
    expect(seenFrom(m, NOW, base)).not.toHaveProperty('goalsReached');
  });

  it('is never written from the grown-up entry, and a failed write is swallowed', async () => {
    const store = memory();
    const record = withGoalReached(base, goal());
    expect(await writeSeen(store, 'p1', record, { readOnly: true })).toBe(false);
    expect(store.data.size).toBe(0);
    expect(await writeSeen(store, 'p1', record, { readOnly: false })).toBe(true);
    expect((await readSeen(store, 'p1'))?.goalsReached).toEqual(['class:plan:c:stage2']);
    const failing: JsonStorage = { readJson: async () => null, writeJson: async () => Promise.reject(new Error('full')) };
    expect(await writeSeen(failing, 'p1', record, { readOnly: false })).toBe(false);
  });
});
