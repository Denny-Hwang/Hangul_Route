import type { ProgressSnapshot, ProgressSummary } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { syncLearner, type PutResult, type SyncApi } from '../engine';

const NOW = new Date('2026-09-21T12:00:00.000Z');
const snap = (quests: string[]): ProgressSnapshot => ({
  profileId: 'profile:a',
  updatedAt: 't',
  episodes: [],
  quests: quests.map((questId) => ({ questId, episodeId: 'e', startedAt: 't', completedAt: 't', stars: 2 as const, attempts: 1, accuracy: 0.8 })),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});
const summary: ProgressSummary = {
  schemaVersion: 1,
  lastActiveAt: 't',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 0, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};
const summarize = () => summary;

function apiWith(results: PutResult[]) {
  const put = vi.fn<SyncApi['putSnapshot']>(async () => results.shift() ?? ({ status: 'error', code: 'exhausted' } as PutResult));
  return { api: { putSnapshot: put }, put };
}

describe('syncLearner (F-SYNC-001 §3.5)', () => {
  it('uploads with the local rev when the server accepts', async () => {
    const { api, put } = apiWith([{ status: 'ok', rev: 4 }]);
    const out = await syncLearner({ learnerId: 'profile:a', local: snap(['q1']), localRev: 3, api, now: NOW, summarize });
    expect(out).toMatchObject({ status: 'synced', rev: 4, merged: false });
    expect(put).toHaveBeenCalledWith('profile:a', expect.objectContaining({ baseRev: 3 }));
  });

  it('merges the server copy on 409 and retries from the server rev', async () => {
    const { api, put } = apiWith([{ status: 'conflict', rev: 7, snapshot: snap(['q2']) }, { status: 'ok', rev: 8 }]);
    const out = await syncLearner({ learnerId: 'profile:a', local: snap(['q1']), localRev: 3, api, now: NOW, summarize });
    expect(out.status).toBe('synced');
    if (out.status === 'synced') {
      expect(out.merged).toBe(true);
      expect(out.rev).toBe(8);
      expect(out.snapshot.quests.map((q) => q.questId).sort()).toEqual(['q1', 'q2']);
    }
    expect(put.mock.calls[1]?.[1]).toMatchObject({ baseRev: 7 });
  });

  it('gives up after a second conflict, handing back the merged snapshot and server rev', async () => {
    const { api } = apiWith([
      { status: 'conflict', rev: 7, snapshot: snap(['q2']) },
      { status: 'conflict', rev: 9, snapshot: snap(['q3']) },
    ]);
    const out = await syncLearner({ learnerId: 'profile:a', local: snap(['q1']), localRev: 3, api, now: NOW, summarize });
    expect(out.status).toBe('retry-later');
    if (out.status === 'retry-later') {
      expect(out.rev).toBe(9);
      expect(out.snapshot.quests.map((q) => q.questId).sort()).toEqual(['q1', 'q2', 'q3']);
    }
  });

  it('surfaces transport errors without touching the snapshot; a null conflict body keeps local', async () => {
    const { api } = apiWith([{ status: 'error', code: 'network' }]);
    const out = await syncLearner({ learnerId: 'profile:a', local: snap(['q1']), localRev: 0, api, now: NOW, summarize });
    expect(out).toMatchObject({ status: 'error', code: 'network' });
    const { api: api2 } = apiWith([{ status: 'conflict', rev: 2, snapshot: null }, { status: 'ok', rev: 3 }]);
    const out2 = await syncLearner({ learnerId: 'profile:a', local: snap(['q1']), localRev: 0, api: api2, now: NOW, summarize });
    expect(out2).toMatchObject({ status: 'synced', rev: 3, merged: false });
  });
});
