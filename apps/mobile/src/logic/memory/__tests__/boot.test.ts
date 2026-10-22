import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The memory store's start-bundle half (F-CURR-002 sections 4.9, 12.2 and 12.3, row CM-12): the
 * gate (`memoryRecord` on, a learner), shadow mode, the flush of the outgoing profile on a switch,
 * and the removal. The runtime chunk is a spy here; `memory-runtime.test.ts` covers what it does.
 */
const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => (disk.has(k) ? JSON.parse(disk.get(k)!) : null)),
  readJsonStrict: vi.fn(async (k: string) => (disk.has(k) ? JSON.parse(disk.get(k)!) : null)),
  readJsonExact: vi.fn(async (k: string) => (disk.has(k) ? JSON.parse(disk.get(k)!) : null)),
  writeJson: vi.fn(async (k: string, v: unknown) => void disk.set(k, JSON.stringify(v))),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (k: string) => void disk.delete(k)),
  listKeys: vi.fn(async () => [...disk.keys()]),
  setWriteFence: vi.fn(),
}));
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined, isAppVisible: () => true }));
vi.mock('../../../platform/app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));
const fake = vi.hoisted(() => ({
  recordRound: vi.fn(async () => undefined),
  recordAnswers: vi.fn(async () => undefined),
  countVocab: vi.fn(async () => undefined),
  ensureSeeded: vi.fn(async () => undefined),
  sendDailyIfDue: vi.fn(async () => undefined),
  sync: vi.fn(async () => undefined),
  pull: vi.fn(async () => undefined),
  backup: vi.fn(async () => ({ stage2: {} })),
  restore: vi.fn(async () => undefined),
  flush: vi.fn(async () => undefined),
  forget: vi.fn(),
  file: vi.fn(async () => null),
  summary: vi.fn(async () => ({ wordsKnown: 3, readyToRefresh: 1, cellBestCounts: [1, 0, 0], stageChecks: 0, weekPoints: 0, topDue: ['lex:bae~pear'] })),
}));
vi.mock('../memory-chunk', () => ({ memoryRuntime: () => fake }));
// The snapshot sync's listeners, to run them as a successful sync does.
const synced = vi.hoisted(() => ({ listeners: new Set<(learnerId: string) => void>() }));
vi.mock('../../../store/sync-store', async (original) => ({
  ...(await original<object>()),
  onSynced: (listener: (learnerId: string) => void) => {
    synced.listeners.add(listener);
    return () => void synced.listeners.delete(listener);
  },
}));

import type { MinigameScope } from '../../minigame-config';
import { memoryForBackup, memorySummaryFor, pullMemoryAfterAdopt, refreshMemorySummary, restoreMemory } from '../../sync/memory-hook';
import { applyVocabEvents } from '../../vocab/progress';
import { notifyProfileRemoved } from '../../../store/profile-removal';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { MEMORY_KEY, activateMemory, memoryRecordsFor, recordAnswers, resetMemoryBootForTests, startMemory } from '../boot';

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};
const base = { ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, createdAt: '2026-10-01T00:00:00.000Z' };
const LEARNER = { ...base, id: 'profile:mina', displayName: 'Mina', role: 'learner' as const };
const OTHER = { ...base, id: 'profile:jun', displayName: 'Jun', role: 'learner' as const };
const PARENT = { ...base, id: 'profile:mum', displayName: 'Mum', role: 'parent' as const };

function memoryRecord(pct: number | 'off'): void {
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { memoryRecord: pct === 'off' ? { on: false, pct: 100 } : { on: true, pct } } } });
}

const scope = { kind: 'pic-word-match', picWord: { boards: [{ pairs: [{ id: 'p1', word: { ko: '배', romanization: 'bae', en: 'pear' } }] }] } } as unknown as MinigameScope;

let stop: () => void = () => undefined;
beforeEach(() => {
  stop();
  disk.clear();
  for (const f of Object.values(fake)) f.mockClear();
  resetMemoryBootForTests();
  resetRemoteConfigForTests();
  useProfileStore.setState({ profiles: [LEARNER, OTHER, PARENT], activeId: LEARNER.id, hydrated: true });
  useQuestRunStore.getState().reset();
  stop = startMemory();
});

describe('the gate', () => {
  it('records for a learner with memoryRecord on, never for a grown-up persona', () => {
    memoryRecord(100);
    expect(memoryRecordsFor(LEARNER.id)).toBe(true);
    expect(memoryRecordsFor(PARENT.id)).toBe(false);
    expect(memoryRecordsFor(null)).toBe(false);
    expect(memoryRecordsFor('profile:unknown')).toBe(false);
  });

  it('memoryRecord off (or never fetched, built-in pct 0) records nothing and deletes nothing', async () => {
    disk.set(MEMORY_KEY(LEARNER.id), JSON.stringify({ v: 1, rows: { 'lex:bae~pear': {} } }));
    for (const state of ['never', 'off', 0] as const) {
      if (state === 'never') useRemoteConfigStore.setState({ hydrated: true, cache: null });
      else memoryRecord(state);
      expect(memoryRecordsFor(LEARNER.id), String(state)).toBe(false);
      useQuestRunStore.getState().beginQuest('quest:stage2-life-q1', 'episode:stage2-life');
      useQuestRunStore.getState().answerRound('p1', true, { scope, itemId: 'p1' });
      await recordAnswers(LEARNER.id, [{ itemId: 'lex:bae~pear', correct: true, rung: 'read' }]);
      activateMemory(LEARNER.id);
      await settle();
    }
    expect(fake.recordRound).not.toHaveBeenCalled();
    expect(fake.recordAnswers).not.toHaveBeenCalled();
    expect(fake.ensureSeeded).not.toHaveBeenCalled();
    expect(disk.get(MEMORY_KEY(LEARNER.id))).toBe(JSON.stringify({ v: 1, rows: { 'lex:bae~pear': {} } }));
  });

  it('a grown-up persona active on the device never records a round', async () => {
    memoryRecord(100);
    useProfileStore.setState({ activeId: PARENT.id });
    await settle();
    useQuestRunStore.getState().beginQuest('quest:stage2-life-q1', 'episode:stage2-life');
    useQuestRunStore.getState().answerRound('p1', true, { scope, itemId: 'p1' });
    await recordAnswers(PARENT.id, [{ itemId: 'lex:bae~pear', correct: true, rung: 'read' }]);
    await settle();
    expect(fake.recordRound).not.toHaveBeenCalled();
    expect(fake.recordAnswers).not.toHaveBeenCalled();
  });
});

describe('recording', () => {
  it('only the first answer of a round reaches the store, with what it asked', async () => {
    memoryRecord(100);
    const run = useQuestRunStore.getState();
    run.beginQuest('quest:stage2-life-q1', 'episode:stage2-life');
    run.answerRound('p1', false, { scope, itemId: 'p1' });
    run.answerRound('p1', true, { scope, itemId: 'p1' });
    run.answerRound(3, true);
    await settle();
    expect(fake.recordRound).toHaveBeenCalledTimes(1);
    expect(fake.recordRound).toHaveBeenCalledWith(LEARNER.id, expect.objectContaining({ questId: 'quest:stage2-life-q1', episodeId: 'episode:stage2-life', correct: false, asked: { scope, itemId: 'p1' } }));
    // The score is the run's as before.
    expect(useQuestRunStore.getState()).toMatchObject({ correctCount: 1, totalCount: 2, retryCount: 1 });
  });

  it('recordAnswers passes the answers on for a learner who records', async () => {
    memoryRecord(100);
    const at = new Date('2026-10-22T09:00:00.000Z');
    await recordAnswers(LEARNER.id, [{ itemId: 'lex:bae~pear', correct: true, rung: 'read' }], at);
    await recordAnswers(LEARNER.id, []);
    expect(fake.recordAnswers).toHaveBeenCalledTimes(1);
    expect(fake.recordAnswers).toHaveBeenCalledWith(LEARNER.id, [{ itemId: 'lex:bae~pear', correct: true, rung: 'read' }], at);
  });

  it('word answers take the spacing rule while the learner records, and are counted for memory.daily', async () => {
    memoryRecord(100);
    const id = LEARNER.id;
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set([id]) });
    useProgressStore.getState().ensure(id);
    useProgressStore.getState().recordVocab(id, [{ type: 'introduced', id: 'vocab:bae-pear' }, { type: 'answer', id: 'vocab:bae-pear', correct: true, source: 'speed' }, { type: 'answer', id: 'vocab:bae-pear', correct: true, source: 'speed' }]);
    await settle();
    expect(useProgressStore.getState().byProfile[id]?.vocab?.items[0]?.box).toBe(1);
    expect(fake.countVocab).toHaveBeenCalledTimes(1);
    // Off, the section 3.2 table applies as before CM-12.
    memoryRecord('off');
    const off = applyVocabEvents({ v: 1, items: [], topics: [] }, [{ type: 'introduced', id: 'vocab:bae-pear' }, { type: 'answer', id: 'vocab:bae-pear', correct: true, source: 'speed' }], new Date());
    useProgressStore.getState().recordVocab(id, [{ type: 'introduced', id: 'vocab:nun-eye' }, { type: 'answer', id: 'vocab:nun-eye', correct: true, source: 'speed' }]);
    await settle();
    expect(useProgressStore.getState().byProfile[id]?.vocab?.items.find((s) => s.id === 'vocab:nun-eye')?.box).toBe(off.items[0]?.box);
    expect(fake.countVocab).toHaveBeenCalledTimes(1);
  });
});

describe('the profile switch and the start', () => {
  it('a switch flushes the outgoing profile’s pending answers first, then starts the next learner', async () => {
    memoryRecord(100);
    await recordAnswers(LEARNER.id, [{ itemId: 'lex:bae~pear', correct: true, rung: 'read' }]);
    fake.ensureSeeded.mockClear();
    useProfileStore.getState().setActive(OTHER.id);
    await settle();
    expect(fake.flush).toHaveBeenCalledWith(LEARNER.id, true);
    expect(fake.ensureSeeded).toHaveBeenCalledWith(OTHER.id);
    expect(fake.flush.mock.invocationCallOrder[0]).toBeLessThan(fake.ensureSeeded.mock.invocationCallOrder[0] as number);
  });

  it('memoryRecord turned off mid-session: a switch saves the outgoing store but sends nothing', async () => {
    memoryRecord(100);
    await recordAnswers(LEARNER.id, [{ itemId: 'lex:bae~pear', correct: true, rung: 'read' }]);
    memoryRecord('off');
    useProfileStore.getState().setActive(OTHER.id);
    await settle();
    expect(fake.flush).toHaveBeenCalledWith(LEARNER.id, false);
    expect(fake.ensureSeeded).not.toHaveBeenCalledWith(OTHER.id);
  });

  it('a successful snapshot sync of a recording learner reaches the store (seeding, then push and pull), and nothing while off', async () => {
    memoryRecord(100);
    for (const listener of synced.listeners) listener(LEARNER.id);
    await settle();
    expect(fake.sync).toHaveBeenCalledWith(LEARNER.id);
    fake.sync.mockClear();
    memoryRecord('off');
    for (const listener of synced.listeners) listener(LEARNER.id);
    await settle();
    expect(fake.sync).not.toHaveBeenCalled();
  });

  it('before the chunk ever loaded, a switch loads nothing', async () => {
    useProfileStore.getState().setActive(OTHER.id);
    await settle();
    expect(fake.flush).not.toHaveBeenCalled();
  });

  it('the remote copy arriving starts the active learner: seeding, then the last day’s memory.daily', async () => {
    memoryRecord(100);
    await settle();
    expect(fake.ensureSeeded).toHaveBeenCalledWith(LEARNER.id);
    expect(fake.sendDailyIfDue).toHaveBeenCalledWith(LEARNER.id);
  });

  it('removal forgets the learner and deletes its stored memory', async () => {
    memoryRecord(100);
    await recordAnswers(LEARNER.id, [{ itemId: 'lex:bae~pear', correct: true, rung: 'read' }]);
    disk.set(MEMORY_KEY(LEARNER.id), '{}');
    notifyProfileRemoved(LEARNER.id);
    await settle();
    expect(fake.forget).toHaveBeenCalledWith(LEARNER.id);
    expect(disk.has(MEMORY_KEY(LEARNER.id))).toBe(false);
  });
});

describe('the backup and Rescue Code hook (row CM-11) is filled', () => {
  it('backup, restore and the adopted pull reach the store', async () => {
    memoryRecord(100);
    expect(await memoryForBackup(LEARNER.id)).toEqual({ stage2: {} });
    await restoreMemory(LEARNER.id, { stage2: { 'lex:a': { b: 1, d: null, c: 0, r: 0, n: 1, f: '2026-10-01', s: 1, at: '2026-10-01T00:00:00.000Z' } } });
    expect(fake.restore).toHaveBeenCalledWith(LEARNER.id, expect.any(Object), true);
    pullMemoryAfterAdopt(LEARNER.id);
    await settle();
    expect(fake.pull).toHaveBeenCalledWith(LEARNER.id);
  });

  it('memoryRecord off: an adopted learner pulls nothing, and a restored file is kept on the device but not sent', async () => {
    memoryRecord('off');
    pullMemoryAfterAdopt(LEARNER.id);
    await settle();
    expect(fake.pull).not.toHaveBeenCalled();
    await restoreMemory(LEARNER.id, { stage2: { 'lex:a': { b: 1, d: null, c: 0, r: 0, n: 1, f: '2026-10-01', s: 1, at: '2026-10-01T00:00:00.000Z' } } });
    expect(fake.restore).toHaveBeenCalledWith(LEARNER.id, expect.any(Object), false);
  });
});

describe('the summary memory block (row CM-16)', () => {
  it('reaches the store for a learner who records, and is forgotten with the learner', async () => {
    memoryRecord(100);
    await refreshMemorySummary(LEARNER.id);
    // dailyReview is not in the copy (built-in pct 0): the shadow period, so the block says no review surface.
    expect(fake.summary).toHaveBeenCalledWith(LEARNER.id, { reviewOn: false });
    expect(memorySummaryFor(LEARNER.id)).toMatchObject({ wordsKnown: 3, topDue: ['lex:bae~pear'] });
    notifyProfileRemoved(LEARNER.id);
    await settle();
    expect(memorySummaryFor(LEARNER.id)).toBeUndefined();
  });

  it('asks for the review surface flag of that profile once dailyReview is on for it', async () => {
    useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { memoryRecord: { on: true, pct: 100 }, dailyReview: { on: true, pct: 100 } } } });
    await refreshMemorySummary(LEARNER.id);
    expect(fake.summary).toHaveBeenCalledWith(LEARNER.id, { reviewOn: true });
  });

  it('memoryRecord off, or a grown-up persona: no block, and the chunk is not asked', async () => {
    memoryRecord('off');
    await refreshMemorySummary(LEARNER.id);
    memoryRecord(100);
    await refreshMemorySummary(PARENT.id);
    expect(fake.summary).not.toHaveBeenCalled();
    expect(memorySummaryFor(LEARNER.id)).toBeUndefined();
    expect(memorySummaryFor(PARENT.id)).toBeUndefined();
  });
});
