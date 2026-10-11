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

  it('keeps a stage latch the 409 server copy holds in the retried upload (F-ROUTE-001 section 3.15)', async () => {
    const latch = { stage1: '2026-09-20T10:00:00.000Z' };
    const { api, put } = apiWith([{ status: 'conflict', rev: 7, snapshot: { ...snap(['q2']), stageDoneAt: latch } }, { status: 'ok', rev: 8 }]);
    const out = await syncLearner({ learnerId: 'profile:a', local: snap(['q1']), localRev: 3, api, now: NOW, summarize });
    expect(out.status).toBe('synced');
    if (out.status === 'synced') expect(out.snapshot.stageDoneAt).toEqual(latch);
    expect(put.mock.calls[1]?.[1]).toMatchObject({ baseRev: 7, snapshot: { stageDoneAt: latch } });
  });

  it('reconciles the merged snapshot before the retried upload, so derived homework a plan dropped never comes back (F-PLAN-002 section 3.6)', async () => {
    const stale = { id: 'plan:term#q9', profileId: 'profile:a', questId: 'q9', episodeId: 'e', assignedBy: 'teacher' as const, assignedAt: 't', targetDate: '2026-09-20' };
    const { api, put } = apiWith([{ status: 'conflict', rev: 7, snapshot: { ...snap([]), homework: [stale] } }, { status: 'ok', rev: 8 }]);
    const reconcile = vi.fn((s: ProgressSnapshot) => ({ ...s, homework: s.homework.filter((h) => h.id !== stale.id) }));
    const out = await syncLearner({ learnerId: 'profile:a', local: snap(['q1']), localRev: 3, api, now: NOW, summarize, reconcile });
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[1]?.[1].snapshot.homework).toEqual([]);
    expect(out).toMatchObject({ status: 'synced', merged: true });
    if (out.status === 'synced') expect(out.snapshot.homework).toEqual([]);
  });

  it('a 409 with word progress on both sides uploads the union of the two slices (F-VOC-005 section 3.3)', async () => {
    const word = (id: string, box: number, at: string) => ({ id, first: '2026-09-18', seen: 2, right: 1, bestBox: box, last: '2026-09-20', box, due: '2026-09-22', at });
    const local = { ...snap([]), vocab: { v: 1 as const, items: [word('vocab:sagwa-apple', 3, '2026-09-20T10:00:00.000Z')], topics: [] } };
    const server = { ...snap([]), vocab: { v: 1 as const, items: [word('vocab:sagwa-apple', 1, '2026-09-20T11:00:00.000Z'), word('vocab:nun-eye', 2, '2026-09-19T10:00:00.000Z')], topics: [] } };
    const { api, put } = apiWith([{ status: 'conflict', rev: 7, snapshot: server }, { status: 'ok', rev: 8 }]);
    const out = await syncLearner({ learnerId: 'profile:a', local, localRev: 3, api, now: NOW, summarize });
    expect(out).toMatchObject({ status: 'synced', merged: true });
    const sent = put.mock.calls[1]?.[1].snapshot.vocab;
    expect(sent?.items.map((s) => s.id)).toEqual(['vocab:nun-eye', 'vocab:sagwa-apple']);
    expect(sent?.items[1]).toMatchObject({ box: 1, bestBox: 3 });
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
