import type { ProgressSnapshot, ProgressSummary } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onInboxRead } from '../inbox-events';
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
    const learner = { id: 'profile:a', displayName: 'Suni', ageGroup: '5-7' as const, avatar: 'hoya-orange' };
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
    // An old-shape answer (no `seat`, before AMENDMENTS-SEATS-ADMINS SA-1) still reads, with `seat` null.
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'ok', space: { id: 'space:c', kind: 'class', name: 'A' }, full: true, seat: null, roster: [] });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'code_not_found' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'code_expired' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'too_many_attempts' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'invalid' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'unknown' });
    expect(await api.lookupSpace('K7M2X9')).toEqual({ status: 'error', code: 'network' });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.com/api/spaces/lookup');
  });

  it('[SA] lookupSpace sends the learner with the device header when it has one, and reads seat leniently', async () => {
    const space = { id: 'space:f', kind: 'family', name: 'Kim family' };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { space, full: false, seat: { full: true, reason: 'cap_family', cap: 4 } } }))
      .mockResolvedValueOnce(json(200, { data: { space, full: false, seat: { full: false, reason: null, cap: 4 } } }))
      .mockResolvedValueOnce(json(200, { data: { space, full: false, seat: { full: 'yes', reason: 'cap_x' } } }));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.lookupSpace('K7M2X9', { learnerId: 'profile:a', creds })).toEqual({ status: 'ok', space, full: false, seat: { full: true, reason: 'cap_family', cap: 4 }, roster: [] });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Device device-x:s3cret');
    expect(JSON.parse(String(init.body))).toEqual({ code: 'K7M2X9', learnerId: 'profile:a' });
    // Without a learner: no header, no learnerId, the answer is for a new learner.
    expect(await api.lookupSpace('K7M2X9')).toMatchObject({ seat: { full: false, reason: null, cap: 4 } });
    const bare = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    expect((bare.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(String(bare.body))).toEqual({ code: 'K7M2X9' });
    // A seat this app cannot read is dropped (null), never a failure: the screen falls back to `full`.
    expect(await api.lookupSpace('K7M2X9')).toMatchObject({ status: 'ok', seat: null });
  });

  it('[SA] joinSpace maps cap_family and cap_school (cap_class with details.reason) to their own codes, with the cap', async () => {
    const capErr = (code: string, details?: unknown) => json(409, { error: { code, message: 'm', ...(details === undefined ? {} : { details }) } });
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(capErr('cap_family', { reason: 'cap_family', cap: 4 }))
      .mockResolvedValueOnce(capErr('cap_family'))
      .mockResolvedValueOnce(capErr('cap_class', { reason: 'cap_school', cap: 50 }))
      .mockResolvedValueOnce(capErr('cap_class', { reason: 'cap_class', cap: 50 }))
      .mockResolvedValueOnce(capErr('cap_class'))
      .mockResolvedValueOnce(capErr('cap_school', { cap: 50 }))
      .mockResolvedValueOnce(capErr('cap_learner', { reason: 'cap_learner', cap: 3 }))
      .mockResolvedValueOnce(capErr('cap_family', { reason: 'cap_family', cap: 'four' }));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    const body = { code: 'K7M2X9', learnerId: 'profile:a' };
    expect(await api.joinSpace('space:f', body, creds)).toEqual({ status: 'error', code: 'cap_family', cap: 4 });
    expect(await api.joinSpace('space:f', body, creds)).toEqual({ status: 'error', code: 'cap_family' });
    expect(await api.joinSpace('space:c', body, creds)).toEqual({ status: 'error', code: 'cap_school', cap: 50 });
    expect(await api.joinSpace('space:c', body, creds)).toEqual({ status: 'error', code: 'cap_class', cap: 50 });
    expect(await api.joinSpace('space:c', body, creds)).toEqual({ status: 'error', code: 'cap_class' });
    expect(await api.joinSpace('space:c', body, creds)).toEqual({ status: 'error', code: 'cap_school', cap: 50 });
    expect(await api.joinSpace('space:c', body, creds)).toEqual({ status: 'error', code: 'cap_learner' });
    // A cap this app cannot read is left out: the line falls back to FAMILY_LIFETIME_LEARNERS.
    expect(await api.joinSpace('space:f', body, creds)).toEqual({ status: 'error', code: 'cap_family' });
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
    // An inbox from a Worker without the F-SPACE-002 fields reads with transfers off and empty,
    // and without the F-FEEDBACK-001 fields with no notes and the default class-notes setting.
    expect(await api.getInbox('profile:a', creds)).toEqual({
      status: 'ok',
      inbox: {
        ...inbox,
        tierSource: null,
        tierValidUntil: null,
        transfersEnabled: false,
        transferDeviceConsent: false,
        selfManaged: false,
        transfers: [],
        deviceScope: null,
        // [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.3: lenient defaults when an older Worker omits them
        classScope: null,
        classMoves: [],
        notes: [],
        notePrefs: { classes: 'all', acknowledged: false },
      },
    });
    expect(await api.getInbox('profile:a', creds)).toEqual({ status: 'error', code: 'invalid' });
    expect(await api.getInbox('profile:a', creds)).toEqual({ status: 'error', code: 'http_401' });
    expect(await api.getInbox('profile:a', creds)).toEqual({ status: 'error', code: 'network' });
    // F-PLAN-002 section 3.5: this build derives with a horizon, so it asks for curriculum plans.
    expect(fetchImpl.mock.calls[3]?.[0]).toBe('https://api.example.com/api/sync/learners/profile%3Aa/inbox?cap=curriculum');
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

/** F-FEEDBACK-001 section 7.6 (FB-7): the device note routes. Typed results with the HTTP status the queue reads. */
describe('platform/sync-api note routes', () => {
  const base = 'https://api.example.com/api/sync/learners/profile%3Aa';

  it('putNoteState sends the device header and the body, and answers the stored state', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { readAt: '2026-10-12T09:00:00.000Z', reaction: 'thanks' } }))
      .mockResolvedValueOnce(json(404, { error: { code: 'not_found' } }))
      .mockResolvedValueOnce(json(503, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.putNoteState('profile:a', 'note:aaaaaaaa', { read: true, reaction: 'thanks' }, creds)).toEqual({
      status: 'ok',
      http: 200,
      readAt: '2026-10-12T09:00:00.000Z',
      reaction: 'thanks',
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/notes/note%3Aaaaaaaaa/state`);
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Device device-x:s3cret');
    expect(JSON.parse(String(init.body))).toEqual({ read: true, reaction: 'thanks' });
    expect(await api.putNoteState('profile:a', 'note:aaaaaaaa', { read: true }, creds)).toEqual({ status: 'error', http: 404, code: 'not_found' });
    expect(await api.putNoteState('profile:a', 'note:aaaaaaaa', { read: true }, creds)).toEqual({ status: 'error', http: 503, code: 'http_503' });
    expect(await api.putNoteState('profile:a', 'note:aaaaaaaa', { read: true }, creds)).toEqual({ status: 'error', http: -1, code: 'network' });
  });

  it('putNoteState reads a missing or odd answer body as nulls', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: { readAt: 5 } })).mockResolvedValueOnce(json(200, {}));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.putNoteState('profile:a', 'note:aaaaaaaa', { read: true }, creds)).toEqual({ status: 'ok', http: 200, readAt: null, reaction: null });
    expect(await api.putNoteState('profile:a', 'note:aaaaaaaa', { read: true }, creds)).toEqual({ status: 'ok', http: 200, readAt: null, reaction: null });
  });

  it('reportNote posts the reason and attestation; 201 is ok, 429 carries the code', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(201, { data: {} }))
      .mockResolvedValueOnce(json(429, { error: { code: 'too_many' } }));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.reportNote('profile:a', 'note:aaaaaaaa', { reason: 'unkind', attest: 'grown_up_pin' }, creds)).toEqual({ status: 'ok', http: 201 });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/notes/note%3Aaaaaaaaa/report`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'unkind', attest: 'grown_up_pin' });
    expect(await api.reportNote('profile:a', 'note:aaaaaaaa', { reason: 'other' }, creds)).toEqual({ status: 'error', http: 429, code: 'too_many' });
  });

  it('hideNote posts with no body; putNotePrefs sends the mode, the acknowledgement and the attestation', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: {} }))
      .mockResolvedValueOnce(json(200, { data: { classes: 'presets', acknowledged: true } }))
      .mockResolvedValueOnce(json(403, { error: { code: 'scope' } }))
      .mockResolvedValueOnce(json(404, {}));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    expect(await api.hideNote('profile:a', 'note:aaaaaaaa', creds)).toEqual({ status: 'ok', http: 200 });
    const [hideUrl, hideInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(hideUrl).toBe(`${base}/notes/note%3Aaaaaaaaa/hide`);
    expect(hideInit.method).toBe('POST');
    expect(hideInit.body).toBeUndefined();
    expect(await api.putNotePrefs('profile:a', { classes: 'presets', acknowledge: true, attest: 'self' }, creds)).toEqual({ status: 'ok', http: 200 });
    const [prefsUrl, prefsInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(prefsUrl).toBe(`${base}/note-prefs`);
    expect(prefsInit.method).toBe('PUT');
    expect(JSON.parse(String(prefsInit.body))).toEqual({ classes: 'presets', acknowledge: true, attest: 'self' });
    expect(await api.putNotePrefs('profile:a', { classes: 'off' }, creds)).toEqual({ status: 'error', http: 403, code: 'scope' });
    expect(await api.hideNote('profile:a', 'note:aaaaaaaa', creds)).toEqual({ status: 'error', http: 404, code: 'http_404' });
  });

  it('updateLearnerProfile PATCHes only name, level, avatar and at with the device header', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(200, { data: { learner: { id: 'profile:a' }, applied: true } }));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    const extra = { learnerType: 'self', parentPinHash: 'h', consent: { guardian: 't' } } as unknown as Record<string, never>;
    const result = await api.updateLearnerProfile('profile:a', 's3cret', 'device-x', { displayName: 'Sungjoo', avatar: 'hoya-orange', at: '2026-10-14T00:00:00.000Z', ...extra });
    expect(result).toEqual({ status: 'ok', applied: true, profileUpdatedAt: null, learner: null });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.com/api/sync/learners/profile%3Aa');
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>).Authorization).toBe('Device device-x:s3cret');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toEqual({ displayName: 'Sungjoo', avatar: 'hoya-orange', at: '2026-10-14T00:00:00.000Z' });
    for (const key of ['learnerType', 'parentPinHash', 'consent']) expect(body).not.toHaveProperty(key);
  });

  it('updateLearnerProfile maps applied false, scope_limited, 422, 5xx, other 403 and no network', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { applied: false } }))
      .mockResolvedValueOnce(json(200, { data: {} }))
      .mockResolvedValueOnce(json(403, { error: { code: 'scope_limited' } }))
      .mockResolvedValueOnce(json(422, { error: { code: 'bad_request' } }))
      .mockResolvedValueOnce(json(400, {}))
      .mockResolvedValueOnce(json(503, {}))
      .mockResolvedValueOnce(json(403, { error: { code: 'forbidden' } }))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    const send = () => api.updateLearnerProfile('profile:a', 's', 'device-x', { ageGroup: '8-9', at: '2026-10-14T00:00:00.000Z' });
    expect(await send()).toEqual({ status: 'ok', applied: false, profileUpdatedAt: null, learner: null });
    expect(await send()).toEqual({ status: 'ok', applied: true, profileUpdatedAt: null, learner: null });
    expect(await send()).toEqual({ status: 'scope_limited' });
    expect(await send()).toEqual({ status: 'invalid', code: 'bad_request' });
    expect(await send()).toEqual({ status: 'invalid', code: 'http_400' });
    expect(await send()).toEqual({ status: 'error', code: 'http_503' });
    expect(await send()).toEqual({ status: 'error', code: 'forbidden' });
    expect(await send()).toEqual({ status: 'error', code: 'network' });
  });

  it('updateLearnerProfile reads the stored edit time and the row the server holds, leniently', async () => {
    const row = { id: 'profile:a', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', createdAt: 't', lastActiveAt: 't' };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { learner: row, applied: false, profileUpdatedAt: '2026-10-14T01:00:00.000Z' } }))
      .mockResolvedValueOnce(json(200, { data: { learner: { ...row, ageGroup: 7 }, applied: true, profileUpdatedAt: 42 } }));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    const send = () => api.updateLearnerProfile('profile:a', 's', 'device-x', { displayName: 'Sungjoo', at: '2026-10-14T00:00:00.000Z' });
    expect(await send()).toEqual({ status: 'ok', applied: false, profileUpdatedAt: '2026-10-14T01:00:00.000Z', learner: { displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange' } });
    // A stamp or level the app cannot read is null; the request still counts as done.
    expect(await send()).toEqual({ status: 'ok', applied: true, profileUpdatedAt: null, learner: { displayName: 'Mina', ageGroup: null, avatar: 'hoya-orange' } });
  });

  it('getInbox announces every inbox it reads, with its learner row', async () => {
    const inbox = { rev: 0, plans: [], memberships: [], tier: 'free', serverTime: 't', learner: { displayName: 'Sungjoo', ageGroup: '8-9', avatar: 'hoya-orange', profileUpdatedAt: '2026-10-14T00:00:00.000Z' } };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: inbox })).mockResolvedValueOnce(json(200, { data: { rev: 'x' } }));
    const seen: Array<[string, unknown]> = [];
    const off = onInboxRead((id, read) => seen.push([id, read.learner]));
    const api = createSyncApi({ endpoint: 'https://api.example.com', fetchImpl });
    await api.getInbox('profile:a', creds);
    await api.getInbox('profile:a', creds);
    off();
    expect(seen).toEqual([['profile:a', inbox.learner]]);
  });
});
