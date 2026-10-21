import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { createSyncApi } from '../sync-api';

/*
 * F-CURR-002 section 4.8: a snapshot the server sends is not parsed, so every
 * path that hands one to the app drops a review entry of a kind this build does
 * not know, per entry, and keeps the rest.
 */

const creds = { deviceId: 'device-x', secret: 's3cret' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const review = (id: string, kind: string) => ({ id, kind, generatedAt: 't', scope: 'stage2', itemIds: ['lex:sagwa'] });
const known = [review('review:a', 'daily'), review('review:b', 'cell-check'), review('review:c', 'warmup')];
const fromServer = {
  profileId: 'profile:a',
  updatedAt: 't',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [...known, review('review:d', 'pack-check'), { id: 'review:e' }],
  streakDays: 0,
  cellBest: { 'letters-s2': 2 },
};
const ids = (s: ProgressSnapshot | null | undefined) => s?.reviews.map((r) => r.id);
const learner = { id: 'profile:a', displayName: 'S', ageGroup: '5-7', avatar: 'a' };

describe('platform/sync-api reads review kinds per entry', () => {
  it('snapshot GET', async () => {
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl: vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: { rev: 3, snapshot: fromServer, summary: null } })) });
    const got = await api.getSnapshot('profile:a', creds);
    expect(got.status === 'ok' && ids(got.snapshot)).toEqual(['review:a', 'review:b', 'review:c']);
    expect(got.status === 'ok' && got.snapshot.cellBest).toEqual({ 'letters-s2': 2 });
  });

  it('the snapshot a 409 carries back for the merge', async () => {
    const api = createSyncApi({
      endpoint: 'https://api.example.com',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValueOnce(json(409, { data: { rev: 5, snapshot: fromServer } })).mockResolvedValueOnce(json(409, { data: { rev: 0, snapshot: null } })),
    });
    const body = { baseRev: 1, snapshot: fromServer as unknown as ProgressSnapshot, summary: {} as never };
    const conflict = await api.putSnapshot('profile:a', body, creds);
    expect(conflict.status === 'conflict' && ids(conflict.snapshot)).toEqual(['review:a', 'review:b', 'review:c']);
    expect(await api.putSnapshot('profile:a', body, creds)).toEqual({ status: 'conflict', rev: 0, snapshot: null });
  });

  it('Rescue Code restore', async () => {
    const api = createSyncApi({
      endpoint: 'https://api.example.com',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: { learner, device: { secret: 'x' }, snapshot: { rev: 2, snapshot: fromServer, summary: null } } })),
    });
    const claimed = await api.claimRescueCode('TIGER-MOON-4821', 'device-x');
    expect(claimed.status === 'ok' && ids(claimed.snapshot?.snapshot)).toEqual(['review:a', 'review:b', 'review:c']);
    expect(claimed.status === 'ok' && claimed.snapshot?.rev).toBe(2);
  });

  it('a relink approval, and a copy with nothing to drop stays the same object', async () => {
    const clean = { rev: 2, snapshot: { ...fromServer, reviews: known }, summary: null };
    const api = createSyncApi({
      endpoint: 'https://api.example.com',
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json(200, { data: { status: 'approved', expiresAt: 't', learner, device: { secret: 'x' }, snapshot: { rev: 2, snapshot: fromServer, summary: null } } }))
        .mockResolvedValueOnce(json(200, { data: { status: 'approved', expiresAt: 't', learner, device: { secret: 'x' }, snapshot: clean } }))
        .mockResolvedValueOnce(json(200, { data: { status: 'approved', expiresAt: 't', learner, device: { secret: 'x' } } })),
    });
    const polled = await api.pollRelink('space:1', 'req:1', 'device-x');
    expect(polled.status === 'ok' && polled.state === 'approved' && ids(polled.snapshot?.snapshot)).toEqual(['review:a', 'review:b', 'review:c']);
    const same = await api.pollRelink('space:1', 'req:1', 'device-x');
    expect(same.status === 'ok' && same.state === 'approved' && same.snapshot).toEqual(clean);
    const none = await api.pollRelink('space:1', 'req:1', 'device-x');
    expect(none.status === 'ok' && none.state === 'approved' && none.snapshot).toBeNull();
  });
});
