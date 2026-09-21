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

describe('platform/sync-api — spaces (F-SPACE-001)', () => {
  const err = (status: number, code: string) => json(status, { error: { code } });

  it('lookupSpace maps 200 / 404 (not found, expired) / 429 / 422 / other / network', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { space: { id: 'space:c', kind: 'class', name: 'A' }, full: true } }))
      .mockResolvedValueOnce(err(404, 'code_not_found'))
      .mockResolvedValueOnce(err(404, 'code_expired'))
      .mockResolvedValueOnce(err(429, 'too_many_attempts'))
      .mockResolvedValueOnce(err(422, 'invalid_code'))
      .mockResolvedValueOnce(json(500, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'ok', space: { id: 'space:c', kind: 'class', name: 'A' }, full: true, roster: [] });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'code_not_found' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'code_expired' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'too_many_attempts' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'invalid' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'unknown' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'network' });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.com/api/spaces/lookup');
  });

  it('joinSpace sends the device header and maps every outcome', async () => {
    const okBody = { data: { alreadyMember: false, membership: { role: 'student', joinedAt: 't' }, space: { id: 'space:c', kind: 'class', name: 'A' } } };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(201, okBody))
      .mockResolvedValueOnce(json(200, { data: { ...okBody.data, alreadyMember: true } }))
      .mockResolvedValueOnce(err(404, 'code_expired'))
      .mockResolvedValueOnce(err(404, 'code_not_found'))
      .mockResolvedValueOnce(err(409, 'cap_class'))
      .mockResolvedValueOnce(err(409, 'cap_learner'))
      .mockResolvedValueOnce(err(422, 'not_joinable'))
      .mockResolvedValueOnce(err(422, 'invalid_code'))
      .mockResolvedValueOnce(err(429, 'too_many_attempts'))
      .mockResolvedValueOnce(json(401, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    const body = { code: 'K7M2X9', learnerId: 'profile:a', displayName: 'Suni' };
    expect(await api.joinSpace('space:c', body, creds)).toEqual({ status: 'ok', alreadyMember: false, membership: { spaceId: 'space:c', kind: 'class', name: 'A', role: 'student', joinedAt: 't' } });
    expect(await api.joinSpace('space:c', body, creds)).toMatchObject({ status: 'ok', alreadyMember: true });
    for (const code of ['code_expired', 'code_not_found', 'cap_class', 'cap_learner', 'not_joinable', 'invalid', 'too_many_attempts', 'unknown', 'network']) {
      expect(await api.joinSpace('space:c', body, creds)).toEqual({ status: 'error', code });
    }
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Device device-x:s3cret');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.com/api/spaces/space%3Ac/join');
  });

  it('leaveSpace and getInbox map results and validate the inbox shape', async () => {
    const inbox = { rev: 3, plans: [], memberships: [{ spaceId: 'space:c', kind: 'class', name: 'A', role: 'student', joinedAt: 't' }], tier: 'free', serverTime: 't' };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { left: true } }))
      .mockResolvedValueOnce(json(404, {}))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(json(200, { data: inbox }))
      .mockResolvedValueOnce(json(200, { data: { rev: 'nope' } }))
      .mockResolvedValueOnce(json(401, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.leaveSpace('space:c', 'profile:a', creds)).toEqual({ status: 'ok', left: true });
    expect(await api.leaveSpace('space:c', 'profile:a', creds)).toEqual({ status: 'error', code: 'http_404' });
    expect(await api.leaveSpace('space:c', 'profile:a', creds)).toEqual({ status: 'error', code: 'network' });
    expect(await api.getInbox('profile:a', creds)).toEqual({ status: 'ok', inbox });
    expect(await api.getInbox('profile:a', creds)).toEqual({ status: 'error', code: 'invalid' });
    expect(await api.getInbox('profile:a', creds)).toEqual({ status: 'error', code: 'http_401' });
    expect(await api.getInbox('profile:a', creds)).toEqual({ status: 'error', code: 'network' });
    expect(fetchImpl.mock.calls[3]?.[0]).toBe('https://api.example.com/api/sync/learners/profile%3Aa/inbox');
  });
});

describe('platform/sync-api — re-link (F-TCH-001 §10.1)', () => {
  const err = (status: number, code: string) => json(status, { error: { code } });
  const learner = { id: 'profile:m', displayName: 'Minho', ageGroup: '5-7', avatar: 'hoya-orange' };

  it('lookup carries the roster; createRelink maps every outcome', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { space: { id: 'space:c', kind: 'class', name: 'A' }, full: false, roster: [{ learnerId: 'profile:m', name: 'M.' }] } }))
      .mockResolvedValueOnce(json(201, { data: { request: { id: 'relink:1', expiresAt: 'e' } } }))
      .mockResolvedValueOnce(json(200, { data: { request: { id: 'relink:1', expiresAt: 'e' } } }))
      .mockResolvedValueOnce(err(404, 'code_expired'))
      .mockResolvedValueOnce(err(404, 'learner_not_found'))
      .mockResolvedValueOnce(err(404, 'code_not_found'))
      .mockResolvedValueOnce(err(409, 'already_bound'))
      .mockResolvedValueOnce(err(422, 'bad_request'))
      .mockResolvedValueOnce(err(429, 'too_many_attempts'))
      .mockResolvedValueOnce(json(500, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.lookupSpace('K7M2X9')).toMatchObject({ status: 'ok', roster: [{ learnerId: 'profile:m', name: 'M.' }] });
    const body = { code: 'K7M2X9', learnerId: 'profile:m', deviceId: 'device-x' };
    expect(await api.createRelink('space:c', body)).toEqual({ status: 'ok', requestId: 'relink:1', expiresAt: 'e' });
    expect(await api.createRelink('space:c', body)).toEqual({ status: 'ok', requestId: 'relink:1', expiresAt: 'e' });
    for (const code of ['code_expired', 'learner_not_found', 'code_not_found', 'already_bound', 'invalid', 'too_many_attempts', 'unknown', 'network']) {
      expect(await api.createRelink('space:c', body)).toEqual({ status: 'error', code });
    }
  });

  it('pollRelink maps pending / approved (once) / denied / expired / errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { status: 'pending', expiresAt: 'e' } }))
      .mockResolvedValueOnce(json(200, { data: { status: 'approved', expiresAt: 'e', learner, device: { deviceId: 'device-x', secret: 's' }, snapshot: { rev: 2, snapshot, summary: null } } }))
      .mockResolvedValueOnce(json(200, { data: { status: 'approved', expiresAt: 'e' } }))
      .mockResolvedValueOnce(json(200, { data: { status: 'denied', expiresAt: 'e' } }))
      .mockResolvedValueOnce(json(200, { data: { status: 'expired', expiresAt: 'e' } }))
      .mockResolvedValueOnce(json(404, {}))
      .mockResolvedValueOnce(json(500, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.pollRelink('space:c', 'relink:1', 'device-x')).toEqual({ status: 'ok', state: 'pending', expiresAt: 'e' });
    expect(await api.pollRelink('space:c', 'relink:1', 'device-x')).toEqual({ status: 'ok', state: 'approved', learner, secret: 's', snapshot: { rev: 2, snapshot, summary: null } });
    expect(await api.pollRelink('space:c', 'relink:1', 'device-x')).toEqual({ status: 'ok', state: 'pending', expiresAt: 'e' });
    expect(await api.pollRelink('space:c', 'relink:1', 'device-x')).toEqual({ status: 'ok', state: 'denied', expiresAt: 'e' });
    expect(await api.pollRelink('space:c', 'relink:1', 'device-x')).toEqual({ status: 'ok', state: 'expired', expiresAt: 'e' });
    expect(await api.pollRelink('space:c', 'relink:1', 'device-x')).toEqual({ status: 'error', code: 'not_found' });
    expect(await api.pollRelink('space:c', 'relink:1', 'device-x')).toEqual({ status: 'error', code: 'unknown' });
    expect(await api.pollRelink('space:c', 'relink:1', 'device-x')).toEqual({ status: 'error', code: 'network' });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.com/api/spaces/space%3Ac/relink-requests/relink%3A1?deviceId=device-x');
  });
});
