import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, unknown>();
/** `read`: every read throws; `readOnce`: the first (cached) read throws and the fresh retry works; `parse`: the bytes do not parse. */
const fail = { write: false, read: false, readOnce: false, parse: false };
const reads = { cached: 0, fresh: 0 };
let stall: Promise<void> | null = null;
const readExact = async (k: string): Promise<unknown> => {
  if (stall) await stall;
  if (fail.parse) throw new SyntaxError('Unexpected token');
  return mem.get(k) ?? null;
};
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async (k: string) => {
    if (stall) await stall;
    if (fail.read) throw new Error('storage cannot be read');
    return mem.get(k) ?? null;
  }),
  // [LR] LR-2: the saved run is read through `durableRead` (`readJsonExact`, then one `readJsonExactFresh`).
  readJsonExact: vi.fn(async (k: string) => {
    reads.cached += 1;
    if (fail.read || fail.readOnce) throw new Error('storage cannot be read');
    return readExact(k);
  }),
  readJsonExactFresh: vi.fn(async (k: string) => {
    reads.fresh += 1;
    if (fail.read) throw new Error('storage cannot be read on a fresh connection');
    return readExact(k);
  }),
  keepRawCopy: vi.fn(async () => true),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    if (fail.write) throw new Error('storage is full');
    mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
  listKeys: vi.fn(async () => [...mem.keys()]),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => undefined) }));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));

import { readJsonExact, readJsonExactFresh, keepRawCopy } from '../../platform/storage';
import { track } from '../../platform/telemetry';
import { resumableRun, stepsSignature } from '../../logic/quest-flow/saved-run';
import { useProgressStore } from '../progress-store';
import { notifyProfileRemoved } from '../profile-removal';
import { useProfileStore } from '../profile-store';
import { QUEST_RUN_KEY, clearSavedRun, keepRunSaved, readSavedRun, saveRun, settleSavedRunsForTests } from '../quest-run-saved';
import { useQuestRunStore } from '../quest-run-store';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-12: the run a reload interrupted is kept per learner on this device
 * (`hr:quest-run:<profileId>`), at each step change, and forgotten when the quest finishes, the learner leaves or the
 * learner is removed from the device.
 */
const steps = [
  { id: 's1', kind: 'intro' },
  { id: 's2', kind: 'practice', minigameRef: 'minigame:a' },
  { id: 's3', kind: 'apply', minigameRef: 'minigame:b' },
  { id: 's4', kind: 'check', minigameRef: 'minigame:c' },
  { id: 's5', kind: 'reward' },
] as const;
const quest = { id: 'quest:q1', steps };
const stepsOf = () => steps;
const stored = (id: string): unknown => mem.get(QUEST_RUN_KEY(id)) ?? null;
const stops: Array<() => void> = [];
const keep = (profileId: string, questId: string, of: () => typeof steps | undefined = stepsOf): void => void stops.push(keepRunSaved(profileId, questId, of));

beforeEach(async () => {
  await settleSavedRunsForTests(true);
  mem.clear();
  fail.write = false;
  fail.read = false;
  fail.readOnce = false;
  fail.parse = false;
  reads.cached = 0;
  reads.fresh = 0;
  stall = null;
  useQuestRunStore.getState().reset();
  useProfileStore.setState({ profiles: [], activeId: null });
});
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

describe('the key', () => {
  it('is per profile, with the id at its end (the removal sweep finds it)', () => {
    expect(QUEST_RUN_KEY('profile:jun00001')).toBe('quest-run:profile:jun00001');
  });
});

describe('keepRunSaved', () => {
  it('stores the run when it begins and at each step change, under the learner', async () => {
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1');
    keep('p1', 'quest:q1');
    await settleSavedRunsForTests();
    expect(stored('p1')).toMatchObject({ v: 1, questId: 'quest:q1', episodeId: 'episode:e1', stepIndex: 0, steps: stepsSignature(steps) });

    const store = useQuestRunStore.getState();
    store.goNextStep();
    store.answerRound(0, true);
    store.answerRound(1, false);
    await settleSavedRunsForTests();
    // An answer alone is not a step change: the step starts again after a reload, so nothing of it is stored yet.
    expect(stored('p1')).toMatchObject({ stepIndex: 1, totalCount: 0, scoredRounds: [] });

    store.markStepComplete();
    store.consumePendingAdvance();
    store.markStepSkipped();
    store.goNextStep();
    await settleSavedRunsForTests();
    expect(stored('p1')).toMatchObject({ stepIndex: 3, correctCount: 1, totalCount: 2, scoredRounds: ['1:0', '1:1'], skippedSteps: [2] });
    expect(stored('p2')).toBeNull();
  });

  it('[QB] a step taken back stores the furthest step again, so a reload resumes there (AMENDMENTS-QUEST-SOUND-BACK QB-4)', async () => {
    const store = useQuestRunStore.getState();
    store.beginQuest('quest:q1', 'episode:e1');
    keep('p1', 'quest:q1');
    store.goNextStep();
    store.answerRound(0, true);
    store.markStepComplete();
    store.consumePendingAdvance();
    store.markStepSkipped();
    store.goNextStep();
    await settleSavedRunsForTests();
    expect(stored('p1')).toMatchObject({ stepIndex: 3, skippedSteps: [2] });

    store.goPrevStep();
    store.goPrevStep();
    await settleSavedRunsForTests();
    expect(useQuestRunStore.getState().stepIndex).toBe(1);
    expect(stored('p1')).toMatchObject({ stepIndex: 3, skippedSteps: [2], totalCount: 1 });
    const restore = resumableRun(await readSavedRun('p1'), quest, Date.now());
    expect(restore).toMatchObject({ stepIndex: 3, skippedSteps: [2] });

    // The reload: the run begins again from what was stored, on the furthest step, which is its furthest step again.
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1', restore!.stepIndex, restore!);
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 3, furthestStep: 3, cameBack: false, skippedSteps: [2], totalCount: 1 });
  });

  it('[QB] a skipped game played after all on a revisit is stored as played when the run moves on (QB-3, QB-4)', async () => {
    const store = useQuestRunStore.getState();
    store.beginQuest('quest:q1', 'episode:e1', 2);
    keep('p1', 'quest:q1');
    store.markStepSkipped();
    store.goNextStep();
    store.goPrevStep();
    store.answerRound(0, true);
    store.markStepComplete();
    store.consumePendingAdvance();
    await settleSavedRunsForTests();
    expect(stored('p1')).toMatchObject({ stepIndex: 3, skippedSteps: [], totalCount: 1, scoredRounds: ['2:0'] });
  });

  it('[QB] the step events already sent are stored and restored, so a resumed run does not send them again (QB-3)', async () => {
    const store = useQuestRunStore.getState();
    store.beginQuest('quest:q1', 'episode:e1');
    keep('p1', 'quest:q1');
    store.goNextStep();
    expect(store.reportOnce('quest.discover_completed', 1)).toBe(true);
    store.goNextStep();
    await settleSavedRunsForTests();
    expect(stored('p1')).toMatchObject({ stepIndex: 2, reported: ['quest.discover_completed:1'] });
    const restore = resumableRun(await readSavedRun('p1'), quest, Date.now())!;
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1', restore.stepIndex, restore);
    expect(useQuestRunStore.getState().reportOnce('quest.discover_completed', 1)).toBe(false);
    expect(useQuestRunStore.getState().reportOnce('minigame.finished', 2)).toBe(true);
  });

  it('a run that begins after the player opened is stored too (a lesson whose steps arrive late)', async () => {
    let loaded = false;
    keep('p1', 'quest:q1', () => (loaded ? steps : undefined));
    await settleSavedRunsForTests();
    expect(stored('p1')).toBeNull();
    loaded = true;
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1');
    await settleSavedRunsForTests();
    expect(stored('p1')).toMatchObject({ questId: 'quest:q1', stepIndex: 0 });
  });

  it('a new quest replaces the saved run of another quest', async () => {
    mem.set(QUEST_RUN_KEY('p1'), { v: 1, questId: 'quest:old', stepIndex: 3 });
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1');
    keep('p1', 'quest:q1');
    await settleSavedRunsForTests();
    expect(stored('p1')).toMatchObject({ questId: 'quest:q1', stepIndex: 0 });
  });

  it('what is stored is what resumes: the same step, tallies and start', async () => {
    const store = useQuestRunStore.getState();
    store.beginQuest('quest:q1', 'episode:e1', 1);
    keep('p1', 'quest:q1');
    store.answerRound(0, true);
    store.goNextStep();
    await settleSavedRunsForTests();
    const run = useQuestRunStore.getState();
    expect(resumableRun(await readSavedRun('p1'), quest, Date.now())).toEqual({
      stepIndex: 2,
      correctCount: 1,
      totalCount: 1,
      retryCount: 0,
      scoredRounds: ['1:0'],
      skippedSteps: [],
      startedAt: run.startedAt,
    });
  });

  it('a resumed run keeps its first start when it is stored again', async () => {
    const restore = { stepIndex: 2, correctCount: 1, totalCount: 1, retryCount: 0, scoredRounds: ['1:0'], skippedSteps: [], startedAt: '2026-11-16T09:00:00.000Z' };
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1', 2, restore);
    keep('p1', 'quest:q1');
    useQuestRunStore.getState().goNextStep();
    await settleSavedRunsForTests();
    expect(stored('p1')).toMatchObject({ stepIndex: 3, startedAt: '2026-11-16T09:00:00.000Z', scoredRounds: ['1:0'] });
  });

  it('the run of another quest in the store, a discarded run and a stopped keeper store nothing', async () => {
    useQuestRunStore.getState().beginQuest('quest:other', 'episode:e1');
    keep('p1', 'quest:q1');
    useQuestRunStore.getState().goNextStep();
    await settleSavedRunsForTests();
    expect(stored('p1')).toBeNull();

    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1');
    await settleSavedRunsForTests();
    expect(stored('p1')).toMatchObject({ stepIndex: 0 });
    // Leave: the run is discarded (reset), then cleared; the reset itself stores nothing.
    useQuestRunStore.getState().reset();
    await clearSavedRun('p1');
    expect(stored('p1')).toBeNull();

    for (const stop of stops.splice(0)) stop();
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1');
    useQuestRunStore.getState().goNextStep();
    await settleSavedRunsForTests();
    expect(stored('p1')).toBeNull();
  });

  it('a failed write never stops the quest', async () => {
    fail.write = true;
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1');
    keep('p1', 'quest:q1');
    expect(() => useQuestRunStore.getState().goNextStep()).not.toThrow();
    await settleSavedRunsForTests();
    expect(useQuestRunStore.getState().stepIndex).toBe(1);
    expect(stored('p1')).toBeNull();
  });
});

describe('clearSavedRun', () => {
  it('a clear asked for right after a save lands after it (the quest finished on its last step change)', async () => {
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1');
    keep('p1', 'quest:q1');
    useQuestRunStore.getState().goNextStep();
    void clearSavedRun('p1');
    await settleSavedRunsForTests();
    expect(stored('p1')).toBeNull();
  });

  it('[LR] a read asked right after a clear waits for it and reads nothing (Start again: the player opens on step 1)', async () => {
    mem.set(QUEST_RUN_KEY('p1'), { v: 1, questId: 'quest:q1', stepIndex: 2 });
    void clearSavedRun('p1');
    expect(await readSavedRun('p1')).toBeNull();
    expect(stored('p1')).toBeNull();
  });

  it('clears that learner only', async () => {
    await saveRun('p1', { v: 1, questId: 'quest:q1', episodeId: 'e', steps: '', stepIndex: 0, correctCount: 0, totalCount: 0, retryCount: 0, scoredRounds: [], skippedSteps: [], startedAt: 'x' });
    await saveRun('p2', { v: 1, questId: 'quest:q1', episodeId: 'e', steps: '', stepIndex: 1, correctCount: 0, totalCount: 0, retryCount: 0, scoredRounds: [], skippedSteps: [], startedAt: 'x' });
    await clearSavedRun('p1');
    expect(stored('p1')).toBeNull();
    expect(stored('p2')).toMatchObject({ stepIndex: 1 });
  });
});

describe('readSavedRun', () => {
  it('nothing stored reads as null; a stored run reads as it is', async () => {
    expect(await readSavedRun('p1')).toBeNull();
    mem.set(QUEST_RUN_KEY('p1'), { v: 1, questId: 'quest:q1' });
    expect(await readSavedRun('p1')).toEqual({ v: 1, questId: 'quest:q1' });
  });

  it('[LR] a read that throws twice (the cached read and the fresh retry) answers null, and asked exactly twice', async () => {
    fail.read = true;
    expect(await readSavedRun('p1')).toBeNull();
    expect(reads).toEqual({ cached: 1, fresh: 1 });
  });

  it('[LR] a read that throws once and works on the fresh connection answers the run', async () => {
    mem.set(QUEST_RUN_KEY('p1'), { v: 1, questId: 'quest:q1' });
    fail.readOnce = true;
    expect(await readSavedRun('p1')).toEqual({ v: 1, questId: 'quest:q1' });
    expect(reads).toEqual({ cached: 1, fresh: 1 });
  });

  it('[LR] bytes that do not parse answer null, are not read again and are not kept aside', async () => {
    mem.set(QUEST_RUN_KEY('p1'), { v: 1 });
    fail.parse = true;
    expect(await readSavedRun('p1')).toBeNull();
    expect(reads).toEqual({ cached: 1, fresh: 0 });
    expect(vi.mocked(keepRawCopy)).not.toHaveBeenCalled();
  });

  it('a read that stalls answers null after the wait, so the quest is never held back', async () => {
    let release: () => void = () => undefined;
    stall = new Promise<void>((resolve) => {
      release = resolve;
    });
    mem.set(QUEST_RUN_KEY('p1'), { v: 1 });
    expect(await readSavedRun('p1', 10)).toBeNull();
    release();
  });

  it('[LR] a fresh retry that outlasts the limit answers null: no resume, which is safe', async () => {
    mem.set(QUEST_RUN_KEY('p1'), { v: 1 });
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(readJsonExact).mockImplementationOnce(async () => {
      reads.cached += 1;
      throw new Error('storage cannot be read');
    });
    vi.mocked(readJsonExactFresh).mockImplementationOnce(async () => {
      reads.fresh += 1;
      await slow;
      return { v: 1 };
    });
    expect(await readSavedRun('p1', 10)).toBeNull();
    release();
  });

  it('[LR] a failed read touches nothing else: no progress record, no telemetry', async () => {
    const before = JSON.stringify(useProgressStore.getState());
    fail.read = true;
    await readSavedRun('p1');
    fail.parse = true;
    fail.read = false;
    await readSavedRun('p1');
    expect(JSON.stringify(useProgressStore.getState())).toBe(before);
    expect(track).not.toHaveBeenCalled();
  });
});

describe('a learner removed from this device', () => {
  const jun = { id: 'profile:jun00001', displayName: 'Jun', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, role: 'learner' as const, createdAt: '2026-10-01T00:00:00.000Z' };

  it('loses the saved run, and a save still on its way never writes it back', async () => {
    useProfileStore.setState({ profiles: [jun], activeId: jun.id });
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1');
    keep(jun.id, 'quest:q1');
    await settleSavedRunsForTests();
    expect(stored(jun.id)).not.toBeNull();

    useProfileStore.setState({ profiles: [], activeId: null });
    notifyProfileRemoved(jun.id);
    // The player is still mounted for a moment: its next step change must not store the run again.
    useQuestRunStore.getState().goNextStep();
    await settleSavedRunsForTests();
    expect(stored(jun.id)).toBeNull();
  });

  it('a learner restored under the same id is saved again', async () => {
    notifyProfileRemoved(jun.id);
    useProfileStore.setState({ profiles: [jun], activeId: jun.id });
    useQuestRunStore.getState().beginQuest('quest:q1', 'episode:e1');
    keep(jun.id, 'quest:q1');
    await settleSavedRunsForTests();
    expect(stored(jun.id)).toMatchObject({ questId: 'quest:q1' });
  });
});
