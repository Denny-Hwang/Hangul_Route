import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, unknown>();
const fail = { write: false, read: false };
let stall: Promise<void> | null = null;
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async (k: string) => {
    if (stall) await stall;
    if (fail.read) throw new Error('storage cannot be read');
    return mem.get(k) ?? null;
  }),
  readJsonExact: vi.fn(async () => null),
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
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));

import { resumableRun, stepsSignature } from '../../logic/quest-flow/saved-run';
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

  it('storage that cannot be read answers null', async () => {
    fail.read = true;
    expect(await readSavedRun('p1')).toBeNull();
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
