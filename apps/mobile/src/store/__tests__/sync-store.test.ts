import { JourneySummarySchema, ProgressSummarySchema, type CurriculumMeta, type ProgressSnapshot, type ProgressSummary } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/sync-api', () => ({
  apiBaseUrl: vi.fn(() => 'https://api.example.com'),
  createSyncApi: vi.fn(),
}));
vi.mock('../../config/flags', () => ({ flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false } }));

import { apiBaseUrl } from '../../platform/sync-api';
import { result } from '../../logic/my-route/__tests__/fixtures/route';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { usePlanStore } from '../plan-store';
import { onSynced, setSyncApiForTests, useSyncStore } from '../sync-store';

const snap = (quests: string[]): ProgressSnapshot => ({
  profileId: 'profile:a',
  updatedAt: 't',
  episodes: [],
  quests: quests.map((questId) => ({ questId, episodeId: 'e', startedAt: 't', completedAt: 't', stars: 2 as const, attempts: 1, accuracy: 0.9 })),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

function fakeApi(over: Partial<{ register: unknown; putSnapshot: unknown; issueRescueCode: unknown; claimRescueCode: unknown }> = {}) {
  return {
    register: vi.fn(async () => ({ status: 'ok', learnerId: 'profile:a', secret: 'sec' })),
    putSnapshot: vi.fn(async () => ({ status: 'ok', rev: 1 })),
    getSnapshot: vi.fn(),
    issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'TIGER-MOON-4821' })),
    claimRescueCode: vi.fn(),
    ...over,
  };
}

describe('sync-store (F-SYNC-002)', () => {
  beforeEach(() => {
    mem.clear();
    useSyncStore.setState({ byLearner: {} });
    useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
    useProgressStore.setState({ byProfile: { 'profile:a': snap(['q1']) }, hydratedFor: new Set(['profile:a']) });
    // No inbox plans loaded unless a test sets them, so a failed test never leaks plans into the next one.
    usePlanStore.setState({ byLearner: {}, notReady: {} });
    vi.mocked(apiBaseUrl).mockReturnValue('https://api.example.com');
  });

  it('registers on first sync, stores the secret, uploads and records the rev', async () => {
    const api = fakeApi();
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'profile:a', displayName: 'Suni' }), 'device-test');
    expect(api.putSnapshot).toHaveBeenCalledWith('profile:a', expect.objectContaining({ baseRev: 0 }), { deviceId: 'device-test', secret: 'sec' });
    expect(state).toMatchObject({ status: 'synced', rev: 1, secret: 'sec' });
    expect((mem.get('sync:profile:a') as { rev: number }).rev).toBe(1);
  });

  it('uploads summary.journey computed from the stores and the bundle (F-ROUTE-001 R-8)', async () => {
    const quest = snap(['quest:stage1-letters-q1']).quests[0];
    useProgressStore.setState({ byProfile: { 'profile:a': { ...snap([]), quests: quest ? [{ ...quest, episodeId: 'episode:stage1-letters' }] : [] } } });
    const putSnapshot = vi.fn(async (_id: string, _body: { summary: ProgressSummary }) => ({ status: 'ok', rev: 1 }));
    setSyncApiForTests(fakeApi({ putSnapshot }) as never);
    await useSyncStore.getState().syncNow('profile:a');
    const journey = putSnapshot.mock.calls[0]?.[1].summary.journey;
    expect(JourneySummarySchema.parse(journey)).toEqual(journey);
    expect(journey?.here).toBe('stage1');
    expect(journey?.stages.map((s) => s.stage)).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
    expect(journey?.stages[0]?.done).toBe(1);
    expect(journey?.stages.every((s) => s.known === 0)).toBe(true);
  });

  it('summary.journey counts the quests a stored level check placed out as known (F-ROUTE-001 R-7a)', async () => {
    const placedOut = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'];
    useProgressStore.setState({ byProfile: { 'profile:a': { ...snap([]), placements: [result({ placedOutQuestIds: placedOut })] } } });
    const putSnapshot = vi.fn(async (_id: string, _body: { summary: ProgressSummary }) => ({ status: 'ok', rev: 1 }));
    setSyncApiForTests(fakeApi({ putSnapshot }) as never);
    await useSyncStore.getState().syncNow('profile:a');
    const journey = putSnapshot.mock.calls[0]?.[1].summary.journey;
    expect(JourneySummarySchema.parse(journey)).toEqual(journey);
    expect(journey?.stages[0]).toMatchObject({ stage: 'stage1', done: 0, known: 3 });
    expect(journey?.stages.slice(1).every((s) => s.known === 0)).toBe(true);
  });

  it("uploads summary.routeGoal from the inbox plans and the bundle, Hoya's default with an empty inbox (Learning Route LR-6)", async () => {
    usePlanStore.setState({ byLearner: { 'profile:a': [] }, notReady: {} });
    const putSnapshot = vi.fn(async (_id: string, _body: { summary: ProgressSummary }) => ({ status: 'ok', rev: 1 }));
    setSyncApiForTests(fakeApi({ putSnapshot }) as never);
    await useSyncStore.getState().syncNow('profile:a');
    expect(putSnapshot.mock.calls[0]?.[1].summary.routeGoal).toEqual({ stage: 'stage1', from: 'default' });
  });

  it('leaves summary.routeGoal out while this device does not know the learner\'s plans yet, never a guessed default (Learning Route LR-6)', async () => {
    // No inbox has reached this device (or its plans are not loaded): a class plan may still lead, so no goal is claimed.
    const putSnapshot = vi.fn(async (_id: string, _body: { summary: ProgressSummary }) => ({ status: 'ok', rev: 1 }));
    setSyncApiForTests(fakeApi({ putSnapshot }) as never);
    await useSyncStore.getState().syncNow('profile:a');
    const summary = putSnapshot.mock.calls[0]?.[1].summary;
    expect(summary).not.toHaveProperty('routeGoal');
    // Everything else still goes up.
    expect(summary?.journey?.v).toBe(1);
  });

  it('summary.routeGoal follows a live class curriculum plan in the inbox to the stage it reaches (Learning Route LR-6)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.parse(`${today}T00:00:00.000Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
    const meta: CurriculumMeta = {
      kind: 'curriculum',
      generatorVersion: 1,
      catalogVersion: 4,
      params: {
        audience: 'class',
        level: { stage: 'stage1', band: 0 },
        startDate,
        weeks: 4,
        sessionsPerWeek: 2,
        minutesPerSession: 10,
        daysOff: [],
        goals: { focus: 'balanced' },
        includeComingSoon: true,
        culturalAnchors: true,
        unlockedStages: ['stage1'],
      },
      weeks: [0, 1, 2, 3].map((i) => ({
        index: i + 1,
        startDate: new Date(Date.parse(`${startDate}T00:00:00.000Z`) + 7 * i * 86_400_000).toISOString().slice(0, 10),
        kind: 'learn' as const,
        focus: { episodeId: null, storyIds: [], festival: null },
        extras: [],
      })),
      horizonDays: 7,
      repacedAt: null,
    };
    usePlanStore.setState({
      byLearner: {
        'profile:a': [
          {
            id: 'plan:c',
            spaceId: 'space:c',
            spaceKind: 'class',
            spaceName: 'Class',
            title: 'Weekly plan',
            items: [{ kind: 'quest', id: 'quest:stage2-life-q1' }],
            publishedAt: '2026-10-01T09:00:00.000Z',
            updatedAt: '2026-10-01T09:00:00.000Z',
            meta,
          },
        ],
      },
      notReady: {},
    });
    const putSnapshot = vi.fn(async (_id: string, _body: { summary: ProgressSummary }) => ({ status: 'ok', rev: 1 }));
    setSyncApiForTests(fakeApi({ putSnapshot }) as never);
    await useSyncStore.getState().syncNow('profile:a');
    const summary = putSnapshot.mock.calls[0]?.[1].summary;
    expect(summary?.routeGoal).toEqual({ stage: 'stage2', from: 'class' });
    expect(ProgressSummarySchema.parse(summary).routeGoal).toEqual({ stage: 'stage2', from: 'class' });
  });

  it('applies a merged snapshot back into progress on conflict', async () => {
    mem.set('sync:profile:a', { secret: 'sec', rev: 3, lastSyncedAt: null });
    const api = fakeApi({
      putSnapshot: vi.fn()
        .mockResolvedValueOnce({ status: 'conflict', rev: 7, snapshot: snap(['q2']) })
        .mockResolvedValueOnce({ status: 'ok', rev: 8 }),
    });
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(state).toMatchObject({ status: 'synced', rev: 8 });
    expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1', 'q2']);
    expect(api.register).not.toHaveBeenCalled();
  });

  describe('a progress write that lands while the request is in flight (issue #262)', () => {
    const resultDuringRequest = (rev: number) => async () => {
      useProgressStore.getState().recordQuestComplete('profile:a', { questId: 'q3', episodeId: 'e', stars: 3, accuracy: 1, attempts: 1 });
      useProgressStore.getState().markCardsSeen('profile:a', ['card:a']);
      return { status: 'ok', rev };
    };
    const withCard = (s: ProgressSnapshot): ProgressSnapshot => ({ ...s, cards: [{ cardId: 'card:a', unlockedAt: 't', newSinceLastView: true }] });

    beforeEach(() => {
      mem.set('sync:profile:a', { secret: 'sec', rev: 3, lastSyncedAt: null });
      useProgressStore.setState({ byProfile: { 'profile:a': withCard(snap(['q1'])) } });
    });

    it('is kept, in memory and in storage, when a merged snapshot comes back; attempts count once; another sync is requested', async () => {
      const putSnapshot = vi.fn()
        .mockResolvedValueOnce({ status: 'conflict', rev: 7, snapshot: withCard(snap(['q2'])) })
        .mockImplementationOnce(resultDuringRequest(8));
      setSyncApiForTests(fakeApi({ putSnapshot }) as never);
      const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync').mockImplementation(() => undefined);
      try {
        const state = await useSyncStore.getState().syncNow('profile:a');
        expect(state).toMatchObject({ status: 'synced', rev: 8 });
        const held = useProgressStore.getState().byProfile['profile:a'];
        expect(held?.quests.map((q) => q.questId)).toEqual(['q1', 'q2', 'q3']);
        expect(held?.quests.find((q) => q.questId === 'q1')?.attempts).toBe(1);
        expect(held?.cards.find((c) => c.cardId === 'card:a')?.newSinceLastView).toBe(false);
        const saved = mem.get('progress:profile:a') as ProgressSnapshot;
        expect(saved.quests.map((q) => q.questId)).toEqual(['q1', 'q2', 'q3']);
        // The server does not hold the new result yet.
        expect(requestSync).toHaveBeenCalledWith('profile:a');
      } finally {
        requestSync.mockRestore();
      }
    });

    it('the fold is reconciled with the cached plans, so a dropped plan item does not come back (F-PLAN-002 section 3.6)', async () => {
      usePlanStore.setState({ byLearner: { 'profile:a': [] }, notReady: {} });
      const stale = { id: 'plan:gone#quest:stage1-letters-q1', profileId: 'profile:a', questId: 'quest:stage1-letters-q1', episodeId: 'episode:stage1-letters', assignedBy: 'teacher' as const, assignedAt: 't', targetDate: '2026-09-20' };
      useProgressStore.setState({ byProfile: { 'profile:a': { ...withCard(snap(['q1'])), homework: [stale] } } });
      const putSnapshot = vi.fn()
        .mockResolvedValueOnce({ status: 'conflict', rev: 7, snapshot: snap(['q2']) })
        .mockImplementationOnce(resultDuringRequest(8));
      setSyncApiForTests(fakeApi({ putSnapshot }) as never);
      const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync').mockImplementation(() => undefined);
      try {
        await useSyncStore.getState().syncNow('profile:a');
        const held = useProgressStore.getState().byProfile['profile:a'];
        expect(held?.homework).toEqual([]);
        expect(held?.quests.map((q) => q.questId)).toEqual(['q1', 'q2', 'q3']);
      } finally {
        requestSync.mockRestore();
      }
    });

    it('is kept when the sync gives up after a second conflict (retry-later)', async () => {
      const putSnapshot = vi.fn()
        .mockResolvedValueOnce({ status: 'conflict', rev: 7, snapshot: withCard(snap(['q2'])) })
        .mockImplementationOnce(async () => {
          await resultDuringRequest(0)();
          return { status: 'conflict', rev: 9, snapshot: null };
        });
      setSyncApiForTests(fakeApi({ putSnapshot }) as never);
      const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync').mockImplementation(() => undefined);
      try {
        const state = await useSyncStore.getState().syncNow('profile:a');
        expect(state).toMatchObject({ status: 'idle', rev: 9, lastError: 'conflict' });
        expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1', 'q2', 'q3']);
        expect((mem.get('progress:profile:a') as ProgressSnapshot).quests.map((q) => q.questId)).toEqual(['q1', 'q2', 'q3']);
        expect(requestSync).toHaveBeenCalledWith('profile:a');
      } finally {
        requestSync.mockRestore();
      }
    });

    it('is kept when nothing was merged, and no extra sync is requested when nothing landed', async () => {
      setSyncApiForTests(fakeApi({ putSnapshot: vi.fn().mockImplementationOnce(resultDuringRequest(4)) }) as never);
      await useSyncStore.getState().syncNow('profile:a');
      expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1', 'q3']);

      const putSnapshot = vi.fn()
        .mockResolvedValueOnce({ status: 'conflict', rev: 7, snapshot: snap(['q2']) })
        .mockResolvedValueOnce({ status: 'ok', rev: 8 });
      setSyncApiForTests(fakeApi({ putSnapshot }) as never);
      const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync').mockImplementation(() => undefined);
      try {
        await useSyncStore.getState().syncNow('profile:a');
        expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1', 'q2', 'q3']);
        expect(requestSync).not.toHaveBeenCalled();
      } finally {
        requestSync.mockRestore();
      }
    });
  });

  describe('one sync at a time per learner', () => {
    beforeEach(() => {
      mem.set('sync:profile:a', { secret: 'sec', rev: 3, lastSyncedAt: null });
    });

    it('a syncNow made while one is in flight joins it, and one more run follows when it settles', async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const putSnapshot = vi.fn()
        .mockImplementationOnce(async () => {
          await gate;
          return { status: 'ok', rev: 4 };
        })
        .mockResolvedValue({ status: 'ok', rev: 5 });
      setSyncApiForTests(fakeApi({ putSnapshot }) as never);
      const first = useSyncStore.getState().syncNow('profile:a');
      await vi.waitFor(() => expect(putSnapshot).toHaveBeenCalledTimes(1));
      const second = useSyncStore.getState().syncNow('profile:a');
      const third = useSyncStore.getState().syncNow('profile:a');
      await new Promise((resolve) => setTimeout(resolve, 0));
      const callsWhileInFlight = putSnapshot.mock.calls.length;
      release();
      expect(callsWhileInFlight).toBe(1);
      const [a, b, c] = await Promise.all([first, second, third]);
      expect(b).toBe(a);
      expect(c).toBe(a);
      expect(a).toMatchObject({ status: 'synced', rev: 4 });
      // The two joined calls ask for one more run, not two; it goes up at the new rev.
      await vi.waitFor(() => expect(useSyncStore.getState().byLearner['profile:a']?.rev).toBe(5));
      expect(putSnapshot).toHaveBeenCalledTimes(2);
      expect(putSnapshot.mock.calls[1]?.[1]).toMatchObject({ baseRev: 4 });
    });

    it('syncAll does not start a second sync for a learner the pending-write flush just started, so attempts are not doubled', async () => {
      let server: { rev: number; snapshot: ProgressSnapshot } = { rev: 3, snapshot: snap(['q1']) };
      const putSnapshot = vi.fn(async (_id: string, body: { baseRev: number; snapshot: ProgressSnapshot }) => {
        await Promise.resolve();
        if (body.baseRev !== server.rev) return { status: 'conflict', rev: server.rev, snapshot: server.snapshot };
        server = { rev: server.rev + 1, snapshot: body.snapshot };
        return { status: 'ok', rev: server.rev };
      });
      setSyncApiForTests(fakeApi({ putSnapshot }) as never);
      useSyncStore.getState().requestSync('profile:a');
      await useSyncStore.getState().syncAll();
      expect(putSnapshot).toHaveBeenCalledTimes(1);
      expect(server.snapshot.quests.find((q) => q.questId === 'q1')?.attempts).toBe(1);
      expect(useProgressStore.getState().byProfile['profile:a']?.quests.find((q) => q.questId === 'q1')?.attempts).toBe(1);
    });

    it('a restore for a learner with a sync in flight waits for it, so the fold never reads the restore as a local write', async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const putSnapshot = vi.fn().mockImplementationOnce(async () => {
        await gate;
        return { status: 'ok', rev: 4 };
      });
      setSyncApiForTests(fakeApi({ putSnapshot }) as never);
      const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync').mockImplementation(() => undefined);
      try {
        const sync = useSyncStore.getState().syncNow('profile:a');
        await vi.waitFor(() => expect(putSnapshot).toHaveBeenCalledTimes(1));
        let restored = false;
        const restore = useSyncStore
          .getState()
          .adoptServerLearner({ learner: { id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' }, secret: 'sec', snapshot: { rev: 9, snapshot: snap(['q2']) } })
          .then(() => {
            restored = true;
          });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(restored).toBe(false);
        release();
        await Promise.all([sync, restore]);
        expect(useSyncStore.getState().byLearner['profile:a']?.rev).toBe(9);
        expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1', 'q2']);
      } finally {
        // Never leave a request hanging: a stuck run would make every later test join it.
        release();
        requestSync.mockRestore();
      }
    });
  });

  describe('a learner removed while the request is in flight', () => {
    beforeEach(() => {
      mem.set('sync:profile:a', { secret: 'sec', rev: 3, lastSyncedAt: null });
    });

    it('the server answer is dropped: the removed learner\'s progress is not written back', async () => {
      const putSnapshot = vi.fn()
        .mockImplementationOnce(async () => {
          useProfileStore.setState({ profiles: [], activeId: null });
          return { status: 'conflict', rev: 7, snapshot: snap(['q2']) };
        })
        .mockResolvedValueOnce({ status: 'ok', rev: 8 });
      setSyncApiForTests(fakeApi({ putSnapshot }) as never);
      await useSyncStore.getState().syncNow('profile:a');
      expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1']);
      expect(mem.has('progress:profile:a')).toBe(false);
    });

    it('a snapshot gone from memory while the profile still exists takes the server answer', async () => {
      const putSnapshot = vi.fn()
        .mockImplementationOnce(async () => {
          useProgressStore.setState({ byProfile: {} });
          return { status: 'conflict', rev: 7, snapshot: snap(['q2']) };
        })
        .mockResolvedValueOnce({ status: 'ok', rev: 8 });
      setSyncApiForTests(fakeApi({ putSnapshot }) as never);
      await useSyncStore.getState().syncNow('profile:a');
      expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1', 'q2']);
    });
  });

  it('drops a pending plan item the cached plans no longer hold when a conflict merge brings it back (F-PLAN-002 section 3.6)', async () => {
    mem.set('sync:profile:a', { secret: 'sec', rev: 3, lastSyncedAt: null });
    usePlanStore.setState({ byLearner: { 'profile:a': [] }, notReady: {} });
    const stale = { id: 'plan:gone#quest:stage1-letters-q1', profileId: 'profile:a', questId: 'quest:stage1-letters-q1', episodeId: 'episode:stage1-letters', assignedBy: 'teacher' as const, assignedAt: 't', targetDate: '2026-09-20' };
    const putSnapshot = vi.fn()
      .mockResolvedValueOnce({ status: 'conflict', rev: 7, snapshot: { ...snap(['q2']), homework: [stale] } })
      .mockResolvedValueOnce({ status: 'ok', rev: 8 });
    setSyncApiForTests(fakeApi({ putSnapshot }) as never);
    await useSyncStore.getState().syncNow('profile:a');
    expect(putSnapshot.mock.calls[1]?.[1]).toMatchObject({ snapshot: { homework: [] } });
    expect(useProgressStore.getState().byProfile['profile:a']?.homework).toEqual([]);
  });

  it('keeps local data and records the error when the transport fails; off when no API', async () => {
    mem.set('sync:profile:a', { secret: 'sec', rev: 3, lastSyncedAt: null });
    setSyncApiForTests(fakeApi({ putSnapshot: vi.fn(async () => ({ status: 'error', code: 'network' })) }) as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(state).toMatchObject({ status: 'error', lastError: 'network', rev: 3 });
    expect(useProgressStore.getState().byProfile['profile:a']?.quests).toHaveLength(1);

    vi.mocked(apiBaseUrl).mockReturnValue(null);
    setSyncApiForTests(null);
    useSyncStore.setState({ byLearner: {} });
    expect((await useSyncStore.getState().syncNow('profile:a')).status).toBe('off');
  });

  it('a registration conflict marks the learner as registered elsewhere', async () => {
    setSyncApiForTests(fakeApi({ register: vi.fn(async () => ({ status: 'conflict' })) }) as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(state).toMatchObject({ status: 'error', lastError: 'registered-elsewhere', secret: null });
  });

  it('never uploads before saved progress has loaded: the saved copy goes up, not a blank one (audit UX-01)', async () => {
    mem.set('sync:profile:a', { secret: 'sec', rev: 3, lastSyncedAt: null });
    mem.set('progress:profile:a', snap(['q1', 'q2']));
    // Cold start: nothing loaded yet, and a screen has put a blank record in memory.
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set() });
    useProgressStore.getState().ensure('profile:a');
    const putSnapshot = vi.fn(async (_id: string, _body: { baseRev: number; snapshot: ProgressSnapshot }) => ({ status: 'ok', rev: 4 }));
    setSyncApiForTests(fakeApi({ putSnapshot }) as never);
    await useSyncStore.getState().syncNow('profile:a');
    expect(putSnapshot).toHaveBeenCalledTimes(1);
    const body = putSnapshot.mock.calls[0]?.[1];
    expect(body?.baseRev).toBe(3);
    expect(body?.snapshot.quests.map((q) => q.questId)).toEqual(['q1', 'q2']);
  });

  it('a learner with no progress record in memory (nothing saved, nothing written) is not registered or uploaded', async () => {
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set() });
    const api = fakeApi();
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(api.register).not.toHaveBeenCalled();
    expect(api.putSnapshot).not.toHaveBeenCalled();
    expect(state).toMatchObject({ secret: null, rev: 0 });
  });

  it('syncAll covers every learner and adoptCredentials seeds a learner', async () => {
    const api = fakeApi();
    setSyncApiForTests(api as never);
    useSyncStore.getState().adoptCredentials('profile:a', 'adopted', 4);
    await useSyncStore.getState().syncAll();
    expect(api.register).not.toHaveBeenCalled();
    expect(api.putSnapshot).toHaveBeenCalledWith('profile:a', expect.objectContaining({ baseRev: 4 }), expect.objectContaining({ secret: 'adopted' }));
  });
});

describe('synced listeners (F-PLAN-001 §3.3)', () => {
  it('fires after a successful sync and stops after unsubscribe', async () => {
    setSyncApiForTests(fakeApi() as never);
    const seen: string[] = [];
    const off = onSynced((id) => seen.push(id));
    await useSyncStore.getState().syncNow('profile:a');
    expect(seen).toEqual(['profile:a']);
    off();
    await useSyncStore.getState().syncNow('profile:a');
    expect(seen).toEqual(['profile:a']);
    setSyncApiForTests(fakeApi({ putSnapshot: vi.fn(async () => ({ status: 'error', code: 'network' })) }) as never);
    const late = onSynced((id) => seen.push(`late:${id}`));
    await useSyncStore.getState().syncNow('profile:a');
    expect(seen).toEqual(['profile:a']);
    late();
  });
});

describe('rescue code lifecycle (F-RESTORE-001)', () => {
  beforeEach(() => {
    mem.clear();
    useSyncStore.setState({ byLearner: {} });
    useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
    useProgressStore.setState({ byProfile: { 'profile:a': snap(['q1']) }, hydratedFor: new Set(['profile:a']) });
    // No inbox plans loaded unless a test sets them, so a failed test never leaks plans into the next one.
    usePlanStore.setState({ byLearner: {}, notReady: {} });
    vi.mocked(apiBaseUrl).mockReturnValue('https://api.example.com');
  });

  it('issues a rescue code after the first successful sync and keeps it locally', async () => {
    const api = { ...fakeApi(), issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'TIGER-MOON-4821' })), claimRescueCode: vi.fn() };
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(state.rescueCode).toBe('TIGER-MOON-4821');
    expect(api.issueRescueCode).toHaveBeenCalledWith('profile:a', { deviceId: 'device-test', secret: 'sec' });
    expect((mem.get('sync:profile:a') as { rescueCode: string }).rescueCode).toBe('TIGER-MOON-4821');
    // a second sync does not re-issue
    await useSyncStore.getState().syncNow('profile:a');
    expect(api.issueRescueCode).toHaveBeenCalledTimes(1);
    // explicit rotation does
    const rotated = { ...api, issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'OTTER-RAIN-0001' })) };
    setSyncApiForTests(rotated as never);
    expect(await useSyncStore.getState().issueRescueCode('profile:a')).toBe('OTTER-RAIN-0001');
  });

  it('claim adopts a learner that is new to this device and seeds its credentials', async () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
    const api = {
      ...fakeApi(),
      claimRescueCode: vi.fn(async () => ({
        status: 'ok',
        learner: { id: 'profile:z', displayName: 'Zed', ageGroup: '8-9', avatar: 'hoya-blue' },
        secret: 'zs',
        snapshot: { rev: 4, snapshot: { ...snap(['q7']), profileId: 'profile:z' }, summary: null },
      })),
    };
    setSyncApiForTests(api as never);
    const result = await useSyncStore.getState().claimRescueCode('tiger moon 4821');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.action).toBe('create');
      expect(result.plan.added.quests).toBe(1);
    }
    expect(api.claimRescueCode).toHaveBeenCalledWith('tiger moon 4821', 'device-test');
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual(['profile:z']);
    expect(useProgressStore.getState().byProfile['profile:z']?.quests[0]?.questId).toBe('q7');
    expect(useSyncStore.getState().byLearner['profile:z']).toMatchObject({ secret: 'zs', rev: 4, rescueCode: 'TIGER-MOON-4821' });
    // The next sync must not rotate the code the parent wrote down.
    await useSyncStore.getState().syncNow('profile:z');
    expect(api.issueRescueCode).not.toHaveBeenCalled();
    expect(useSyncStore.getState().byLearner['profile:z']?.rescueCode).toBe('TIGER-MOON-4821');
  });

  it('claim merges into an existing local profile and maps errors', async () => {
    const api = {
      ...fakeApi(),
      claimRescueCode: vi.fn(async () => ({
        status: 'ok',
        learner: { id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' },
        secret: 'as',
        snapshot: { rev: 2, snapshot: snap(['q2']), summary: null },
      })),
    };
    setSyncApiForTests(api as never);
    const result = await useSyncStore.getState().claimRescueCode('TIGER-MOON-4821');
    expect(result.ok && result.plan.action).toBe('merge');
    expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1', 'q2']);

    setSyncApiForTests({ ...fakeApi(), claimRescueCode: vi.fn(async () => ({ status: 'error', code: 'code_not_found' })) } as never);
    expect(await useSyncStore.getState().claimRescueCode('X-Y-0000')).toEqual({ ok: false, error: 'code_not_found' });
    vi.mocked(apiBaseUrl).mockReturnValue(null);
    setSyncApiForTests(null);
    expect(await useSyncStore.getState().claimRescueCode('X-Y-0000')).toEqual({ ok: false, error: 'off' });
  });

  it('claim stores the merged snapshot, so a server copy with fewer or later cards never reduces the device cards (F-STORY-006 section 3.6 M6)', async () => {
    const card = (cardId: string, unlockedAt: string, newSinceLastView: boolean) => ({ cardId, unlockedAt, newSinceLastView });
    const local = [card('card:a', '2026-09-18T00:00:00.000Z', false), card('card:b', '2026-09-19T00:00:00.000Z', true)];
    useProgressStore.setState({ byProfile: { 'profile:a': { ...snap(['q1']), cards: local } }, hydratedFor: new Set(['profile:a']) });
    const server = { ...snap([]), cards: [card('card:a', '2026-09-20T00:00:00.000Z', true), card('card:c', '2026-09-17T00:00:00.000Z', true)] };
    setSyncApiForTests({
      ...fakeApi(),
      claimRescueCode: vi.fn(async () => ({
        status: 'ok',
        learner: { id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' },
        secret: 'as',
        snapshot: { rev: 3, snapshot: server, summary: null },
      })),
    } as never);
    const result = await useSyncStore.getState().claimRescueCode('TIGER-MOON-4821');
    expect(result.ok && result.plan.action).toBe('merge');
    const stored = new Map((useProgressStore.getState().byProfile['profile:a']?.cards ?? []).map((c) => [c.cardId, c]));
    for (const c of local) {
      expect(stored.has(c.cardId)).toBe(true);
      expect((stored.get(c.cardId)?.unlockedAt ?? '') <= c.unlockedAt).toBe(true);
      if (!c.newSinceLastView) expect(stored.get(c.cardId)?.newSinceLastView).toBe(false);
    }
    expect(stored.get('card:a')).toEqual(card('card:a', '2026-09-18T00:00:00.000Z', false));
    expect(stored.get('card:c')).toEqual(card('card:c', '2026-09-17T00:00:00.000Z', true));
  });

  it('claim with no server snapshot keeps or creates a blank local snapshot', async () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
    setSyncApiForTests({
      ...fakeApi(),
      claimRescueCode: vi.fn(async () => ({ status: 'ok', learner: { id: 'profile:n', displayName: 'New', ageGroup: '5-7', avatar: 'hoya-pink' }, secret: 'ns', snapshot: null })),
    } as never);
    const result = await useSyncStore.getState().claimRescueCode('A-B-0000');
    expect(result.ok && result.plan.action).toBe('create');
    expect(useProgressStore.getState().byProfile['profile:n']?.quests).toEqual([]);
  });
});
