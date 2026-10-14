import { SyncInboxSchema, TRANSFER_CONSENT_TEXT_VERSION } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { createSyncApi } from '../sync-api';

/*
 * The learner device's class-move calls and the inbox transfer fields —
 * F-SPACE-002 sections 4.4 and 4.12, PR T-7a. Typed results, never throws;
 * every answer the Worker can give maps to a code the screens can word.
 */

const creds = { deviceId: 'device-x', secret: 's3cret' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fail = (status: number, code: string, details?: Record<string, unknown>) => json(status, { ok: false, error: { code, message: 'm', ...(details ? { details } : {}) } });
const BASE = 'https://api.example.com';
const TID = 'transfer:0b6c2f4e-1111-4000-8000-000000000001';

const row = {
  id: TID,
  status: 'requested',
  initiator: 'learner_side',
  from: { spaceId: 'space:a', name: 'Sunday Class A' },
  to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months' },
  learnerState: 'consented',
  sourceState: 'waiting',
  destinationState: 'waiting',
  introduce: false,
  premiumChange: 'none',
  destinationConsentMode: 'parent',
  relinkAffected: false,
  sourcePlansAffected: false,
  visibleToday: [{ kind: 'class', name: 'Sunday Class A', ownerName: 'Mr Han' }],
  blockReason: null,
  executeAfter: '2026-10-13T12:00:00.000Z',
  expiresAt: '2026-10-25T12:00:00.000Z',
  learnerRoute: 'device',
  canVeto: true,
  endedFrom: null,
};

const consent = { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' as const, attest: 'grown_up_pin' as const };

function apiWith(...responses: Array<Response | Error>) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Error) fetchImpl.mockRejectedValueOnce(r);
    else fetchImpl.mockResolvedValueOnce(r);
  }
  return { api: createSyncApi({ endpoint: BASE, fetchImpl }), fetchImpl };
}

const sent = (fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>, i = 0) => {
  const [url, init] = fetchImpl.mock.calls[i] as [string, RequestInit];
  return { url, method: init.method, auth: (init.headers as Record<string, string>).Authorization, body: init.body === undefined ? undefined : JSON.parse(String(init.body)) };
};

describe('getInbox: the transfer fields (section 4.4)', () => {
  const inbox = { rev: 1, plans: [], memberships: [], tier: 'free', serverTime: '2026-10-11T12:00:00.000Z' };

  it('reads them as the Worker sends them', async () => {
    const { api } = apiWith(json(200, { data: { ...inbox, transfersEnabled: true, transferDeviceConsent: true, selfManaged: true, transfers: [row] } }));
    const r = await api.getInbox('profile:a', creds);
    expect(r.status === 'ok' && r.inbox).toMatchObject({ transfersEnabled: true, transferDeviceConsent: true, selfManaged: true, transfers: [{ id: TID, learnerRoute: 'device' }] });
  });

  it('reads the learner count and the sheet digest, and an older Worker without them reads both as null', async () => {
    const digest = 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1';
    const { api } = apiWith(
      json(200, { data: { ...inbox, transfersEnabled: true, transfers: [{ ...row, to: { ...row.to, learnerCount: 12 }, termsDigest: digest }] } }),
      json(200, { data: { ...inbox, transfersEnabled: true, transfers: [row] } }),
    );
    const now = await api.getInbox('profile:a', creds);
    expect(now.status === 'ok' && now.inbox.transfers[0]).toMatchObject({ to: { learnerCount: 12 }, termsDigest: digest });
    const older = await api.getInbox('profile:a', creds);
    expect(older.status === 'ok' && older.inbox.transfers[0]).toMatchObject({ id: TID, to: { learnerCount: null }, termsDigest: null });
  });

  it('an older Worker without them reads off and empty; a malformed row or an unknown status never costs the plans, memberships or tier', async () => {
    const { api } = apiWith(
      json(200, { data: inbox }),
      json(200, { data: { ...inbox, tier: 'premium', memberships: [{ spaceId: 'space:a', kind: 'class', name: 'A', role: 'student', joinedAt: 't' }], transfersEnabled: true, transfers: [{ id: 'bad' }, { ...row, status: 'teleported', learnerRoute: 'carrier-pigeon' }, 7] } }),
    );
    const old = await api.getInbox('profile:a', creds);
    expect(old.status === 'ok' && old.inbox).toMatchObject({ transfersEnabled: false, transferDeviceConsent: false, selfManaged: false, transfers: [] });
    const odd = await api.getInbox('profile:a', creds);
    expect(odd.status).toBe('ok');
    if (odd.status !== 'ok') return;
    expect(odd.inbox.tier).toBe('premium');
    expect(odd.inbox.memberships).toHaveLength(1);
    expect(odd.inbox.transfers.map((t) => [t.status, t.learnerRoute])).toEqual([['teleported', 'carrier-pigeon']]);
    expect(SyncInboxSchema.safeParse({ ...inbox, transfers: 'nope' }).success).toBe(true);
  });
});

describe('previewTransfer', () => {
  const preview = {
    destination: { id: 'space:b', kind: 'class', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 12 },
    premiumChange: 'may_change',
    destinationConsentMode: 'school',
    relinkAffected: true,
    sourcePlansAffected: false,
    visibleToday: [{ kind: 'family', name: 'Kim family', ownerName: null }],
    termsDigest: 'a'.repeat(64),
  };

  it('posts the device body with the device header and reads the learner-side answer', async () => {
    const { api, fetchImpl } = apiWith(json(200, { ok: true, data: preview }));
    const r = await api.previewTransfer('profile:a', { fromSpaceId: 'space:a', code: 'BBBBBB' }, creds);
    expect(r).toEqual({
      status: 'ok',
      preview: {
        destination: { id: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 12 },
        premiumChange: 'may_change',
        destinationConsentMode: 'school',
        relinkAffected: true,
        sourcePlansAffected: false,
        visibleToday: [{ kind: 'family', name: 'Kim family', ownerName: null }],
        termsDigest: 'a'.repeat(64),
        blockReason: null,
      },
    });
    expect(sent(fetchImpl)).toEqual({ url: `${BASE}/api/sync/learners/profile%3Aa/transfer-requests/preview`, method: 'POST', auth: 'Device device-x:s3cret', body: { fromSpaceId: 'space:a', code: 'BBBBBB' } });
  });

  it('is lenient where it can be and refuses an answer it cannot use', async () => {
    const { api } = apiWith(
      json(200, { data: { ...preview, destination: { ...preview.destination, learnerCount: 'x', ageBucket: 7 }, visibleToday: [{ kind: 'class' }, ...preview.visibleToday], termsDigest: 'short', blockReason: 'cap_class' } }),
      json(200, { data: { destination: { id: 'space:b' } } }),
      json(200, {}),
    );
    const lenient = await api.previewTransfer('profile:a', { fromSpaceId: 'space:a', code: 'BBBBBB' }, creds);
    expect(lenient.status === 'ok' && lenient.preview).toMatchObject({ destination: { learnerCount: null, ageBucket: null }, visibleToday: [{ kind: 'family' }], termsDigest: null, blockReason: 'cap_class' });
    expect(await api.previewTransfer('profile:a', { fromSpaceId: 'space:a', code: 'BBBBBB' }, creds)).toEqual({ status: 'error', http: 200, code: 'invalid' });
    expect(await api.previewTransfer('profile:a', { fromSpaceId: 'space:a', code: 'BBBBBB' }, creds)).toEqual({ status: 'error', http: 200, code: 'invalid' });
  });

  it('maps the Worker codes, the retry wait, who started an open request, and no network', async () => {
    const { api } = apiWith(
      fail(422, 'transfers_locked'),
      fail(409, 'caregiver_required'),
      fail(429, 'cooldown', { retryAfterSeconds: 3600 }),
      fail(409, 'already_open', { startedBy: 'class' }),
      fail(409, 'already_open', { startedBy: 'someone_new' }),
      fail(403, 'scope_limited'),
      json(500, {}),
      new Error('offline'),
    );
    const call = () => api.previewTransfer('profile:a', { fromSpaceId: 'space:a', code: 'BBBBBB' }, creds);
    expect(await call()).toEqual({ status: 'error', http: 422, code: 'transfers_locked' });
    expect(await call()).toEqual({ status: 'error', http: 409, code: 'caregiver_required' });
    expect(await call()).toEqual({ status: 'error', http: 429, code: 'cooldown', retryAfterSeconds: 3600 });
    expect(await call()).toEqual({ status: 'error', http: 409, code: 'already_open', startedBy: 'class' });
    expect(await call()).toEqual({ status: 'error', http: 409, code: 'already_open', startedBy: 'learner_side' });
    expect(await call()).toEqual({ status: 'error', http: 403, code: 'scope_limited' });
    expect(await call()).toEqual({ status: 'error', http: 500, code: 'http_500' });
    expect(await call()).toEqual({ status: 'error', http: -1, code: 'network' });
  });
});

describe('createTransfer', () => {
  it('posts the move with the consent claim and reads the request; a repeat answers 200 with the same one', async () => {
    const { api, fetchImpl } = apiWith(json(201, { data: { request: row } }), json(200, { data: { request: row } }));
    const body = { fromSpaceId: 'space:a', destinationSpaceId: 'space:b', code: 'BBBBBB', introduce: true, consent: { ...consent, termsDigest: 'b'.repeat(64) } };
    expect(await api.createTransfer('profile:a', body, creds)).toEqual({ status: 'ok', created: true, request: expect.objectContaining({ id: TID }) });
    expect(sent(fetchImpl)).toEqual({ url: `${BASE}/api/sync/learners/profile%3Aa/transfer-requests`, method: 'POST', auth: 'Device device-x:s3cret', body });
    expect(await api.createTransfer('profile:a', body, creds)).toEqual({ status: 'ok', created: false, request: expect.objectContaining({ id: TID }) });
  });

  it('an answer without a readable request is invalid; refusals keep their code', async () => {
    const { api } = apiWith(json(201, { data: { request: { id: 'x' } } }), fail(422, 'device_consent_locked'), fail(409, 'terms_changed'));
    const body = { fromSpaceId: 'space:a', destinationSpaceId: 'space:b', code: 'BBBBBB', consent };
    expect(await api.createTransfer('profile:a', body, creds)).toEqual({ status: 'error', http: 201, code: 'invalid' });
    expect(await api.createTransfer('profile:a', body, creds)).toEqual({ status: 'error', http: 422, code: 'device_consent_locked' });
    expect(await api.createTransfer('profile:a', body, creds)).toEqual({ status: 'error', http: 409, code: 'terms_changed' });
  });
});

describe('approve, decline and cancel a request (guards 10 and 11)', () => {
  it('approve posts the consent claim to the request; decline and cancel post an empty body', async () => {
    const { api, fetchImpl } = apiWith(json(200, { data: { request: row } }), json(200, { data: { request: { ...row, status: 'declined' } } }), json(200, { data: { request: { ...row, status: 'cancelled' } } }));
    expect(await api.approveTransfer('profile:a', TID, { consent }, creds)).toEqual({ status: 'ok', request: expect.objectContaining({ status: 'requested' }) });
    expect(await api.declineTransfer('profile:a', TID, creds)).toEqual({ status: 'ok', request: expect.objectContaining({ status: 'declined' }) });
    expect(await api.cancelTransfer('profile:a', TID, creds)).toEqual({ status: 'ok', request: expect.objectContaining({ status: 'cancelled' }) });
    const path = `${BASE}/api/sync/learners/profile%3Aa/transfer-requests/${encodeURIComponent(TID)}`;
    expect(sent(fetchImpl, 0)).toEqual({ url: `${path}/approve`, method: 'POST', auth: 'Device device-x:s3cret', body: { consent } });
    expect(sent(fetchImpl, 1)).toEqual({ url: `${path}/decline`, method: 'POST', auth: 'Device device-x:s3cret', body: {} });
    expect(sent(fetchImpl, 2)).toEqual({ url: `${path}/cancel`, method: 'POST', auth: 'Device device-x:s3cret', body: {} });
  });

  it('maps refusals and no network', async () => {
    const { api } = apiWith(fail(409, 'caregiver_required_for_teacher_request'), fail(409, 'not_open'), fail(404, 'not_found'), new Error('offline'), json(200, { data: {} }));
    expect(await api.approveTransfer('profile:a', TID, { consent }, creds)).toEqual({ status: 'error', http: 409, code: 'caregiver_required_for_teacher_request' });
    expect(await api.declineTransfer('profile:a', TID, creds)).toEqual({ status: 'error', http: 409, code: 'not_open' });
    expect(await api.cancelTransfer('profile:a', TID, creds)).toEqual({ status: 'error', http: 404, code: 'not_found' });
    expect(await api.cancelTransfer('profile:a', TID, creds)).toEqual({ status: 'error', http: -1, code: 'network' });
    expect(await api.cancelTransfer('profile:a', TID, creds)).toEqual({ status: 'error', http: 200, code: 'invalid' });
  });
});

describe('putTransferPrefs (guard 13)', () => {
  it('puts the learner switch and reads it back', async () => {
    const { api, fetchImpl } = apiWith(json(200, { data: { prefs: { selfManaged: true } } }), json(200, { data: {} }), fail(422, 'transfers_locked'));
    expect(await api.putTransferPrefs('profile:a', { selfManaged: true }, creds)).toEqual({ status: 'ok', selfManaged: true });
    expect(sent(fetchImpl)).toEqual({ url: `${BASE}/api/sync/learners/profile%3Aa/transfer-prefs`, method: 'PUT', auth: 'Device device-x:s3cret', body: { selfManaged: true } });
    expect(await api.putTransferPrefs('profile:a', { selfManaged: true }, creds)).toEqual({ status: 'error', http: 200, code: 'invalid' });
    expect(await api.putTransferPrefs('profile:a', { selfManaged: true }, creds)).toEqual({ status: 'error', http: 422, code: 'transfers_locked' });
  });
});

describe('[TV] putClassScopeAck (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D4)', () => {
  it('puts the version the inbox named; a class tablet and an older text answer with their codes', async () => {
    const { api, fetchImpl } = apiWith(json(200, { data: { version: 'class-scope-2026-10', ackedAt: 't' } }), fail(403, 'scope_limited'), fail(422, 'class_scope_stale'));
    expect(await api.putClassScopeAck('profile:a', 'class-scope-2026-10', creds)).toEqual({ status: 'ok' });
    expect(sent(fetchImpl)).toEqual({ url: `${BASE}/api/sync/learners/profile%3Aa/class-scope`, method: 'PUT', auth: 'Device device-x:s3cret', body: { version: 'class-scope-2026-10' } });
    expect(await api.putClassScopeAck('profile:a', 'class-scope-2026-10', creds)).toEqual({ status: 'error', http: 403, code: 'scope_limited' });
    expect(await api.putClassScopeAck('profile:a', 'class-scope-2026-10', creds)).toEqual({ status: 'error', http: 422, code: 'class_scope_stale' });
  });
});
