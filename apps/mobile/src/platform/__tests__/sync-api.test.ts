import type { ProgressSnapshot, ProgressSummary } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl, createSyncApi } from '../sync-api';

const snapshot: ProgressSnapshot = { profileId: 'profile:a', updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 };
const summary: ProgressSummary = { schemaVersion: 1, lastActiveAt: 't', streakDays: 0, stage1: { questsDone: 0, questsTotal: 0, anchorAccuracy: null }, cardsUnlocked: 0, minutesLast7d: 0, jamoRecognized: [], needsPractice: [], planProgress: {} };
const creds = { deviceId: 'device-x', secret: 's3cret' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('platform/sync-api', () => {
  const ORIGINAL = process.env.EXPO_PUBLIC_API_BASE_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL;
  });

  it('apiBaseUrl is null for the placeholder or when unset, trimmed otherwise', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(apiBaseUrl()).toBeNull();
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.hangulroute.example';
    expect(apiBaseUrl()).toBeNull();
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com/';
    expect(apiBaseUrl()).toBe('https://api.example.com');
  });

  it('register maps 201 / 409 / other / network', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(201, { data: { learner: { id: 'profile:a' }, device: { secret: 'sec' } } }))
      .mockResolvedValueOnce(json(409, {}))
      .mockResolvedValueOnce(json(500, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    const learner = { id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' };
    expect(await api.register(learner, 'device-x')).toEqual({ status: 'ok', learnerId: 'profile:a', secret: 'sec' });
    expect(await api.register(learner, 'device-x')).toEqual({ status: 'conflict' });
    expect(await api.register(learner, 'device-x')).toEqual({ status: 'error', code: 'http_500' });
    expect(await api.register(learner, 'device-x')).toEqual({ status: 'error', code: 'network' });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.com/api/sync/learners');
  });

  it('putSnapshot sends the device header and maps 200 / 409 / other', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { rev: 2 } }))
      .mockResolvedValueOnce(json(409, { data: { rev: 5, snapshot } }))
      .mockResolvedValueOnce(json(401, {}));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.putSnapshot('profile:a', { baseRev: 1, snapshot, summary }, creds)).toEqual({ status: 'ok', rev: 2 });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Device device-x:s3cret');
    expect(JSON.parse(String(init.body))).toMatchObject({ baseRev: 1, schemaVer: 1, contentVer: '2026.09' });
    expect(await api.putSnapshot('profile:a', { baseRev: 1, snapshot, summary }, creds)).toEqual({ status: 'conflict', rev: 5, snapshot });
    expect(await api.putSnapshot('profile:a', { baseRev: 1, snapshot, summary }, creds)).toEqual({ status: 'error', code: 'http_401' });
  });

  it('getSnapshot maps 200 / 404 / other / network', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { rev: 3, snapshot, summary: null } }))
      .mockResolvedValueOnce(json(404, {}))
      .mockResolvedValueOnce(json(403, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.getSnapshot('profile:a', creds)).toEqual({ status: 'ok', rev: 3, snapshot, summary: null });
    expect(await api.getSnapshot('profile:a', creds)).toEqual({ status: 'none' });
    expect(await api.getSnapshot('profile:a', creds)).toEqual({ status: 'error', code: 'http_403' });
    expect(await api.getSnapshot('profile:a', creds)).toEqual({ status: 'error', code: 'network' });
  });
});

describe('platform/sync-api recovery', () => {
  it('issue and claim map their statuses', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(201, { data: { code: 'TIGER-MOON-4821' } }))
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { data: { learner: { id: 'profile:a', displayName: 'S', ageGroup: '5-7', avatar: 'a' }, device: { secret: 'x' }, snapshot: null } }))
      .mockResolvedValueOnce(json(404, {}))
      .mockResolvedValueOnce(json(429, {}))
      .mockResolvedValueOnce(json(422, {}))
      .mockResolvedValueOnce(json(500, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.issueRescueCode('profile:a', creds)).toEqual({ status: 'ok', code: 'TIGER-MOON-4821' });
    expect(await api.issueRescueCode('profile:a', creds)).toEqual({ status: 'error', code: 'http_401' });
    expect(await api.claimRescueCode('TIGER-MOON-4821', 'device-x')).toMatchObject({ status: 'ok', secret: 'x', snapshot: null });
    expect(await api.claimRescueCode('a', 'd')).toEqual({ status: 'error', code: 'code_not_found' });
    expect(await api.claimRescueCode('a', 'd')).toEqual({ status: 'error', code: 'too_many_attempts' });
    expect(await api.claimRescueCode('a', 'd')).toEqual({ status: 'error', code: 'invalid' });
    expect(await api.claimRescueCode('a', 'd')).toEqual({ status: 'error', code: 'unknown' });
    expect(await api.claimRescueCode('a', 'd')).toEqual({ status: 'error', code: 'network' });
  });
});
