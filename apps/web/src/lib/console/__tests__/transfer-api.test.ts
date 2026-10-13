import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConsoleApi } from '../api';
import { resetTransferLockForTests, transfersLockedThisSession } from '../transfer-lock';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const sourceView = {
  id: 'transfer:1',
  role: 'source',
  status: 'requested',
  steps: { learner: 'yes', source: 'waiting', destination: 'waiting' },
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  createdAt: '2026-10-10T12:00:00.000Z',
  expiresAt: '2026-10-24T12:00:00.000Z',
  executedAt: null,
  endedAt: null,
  endedByYou: false,
  endReason: null,
  initiator: 'learner_side',
  learnerId: null,
  learner: { name: 'Jun', avatar: 'tiger' },
  destination: null,
};

function apiWith(...responses: Response[]) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const r of responses) fetchImpl.mockResolvedValueOnce(r);
  return { api: createConsoleApi({ endpoint: 'https://api.example.com', token: 'tok', fetchImpl }), fetchImpl };
}

const call = (fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>, i: number) => {
  const [url, init] = fetchImpl.mock.calls[i] as [string, RequestInit];
  return { url, method: init.method, body: init.body === undefined ? undefined : JSON.parse(String(init.body)) };
};

describe('console api: class moves (F-SPACE-002 section 4.4, T-6a)', () => {
  afterEach(() => resetTransferLockForTests());

  it('sends each route to /api/spaces/:id/transfer-requests with the learner id in the body only', async () => {
    const { api, fetchImpl } = apiWith(
      json(200, { data: { destination: { id: 'space:b', kind: 'class', name: 'Saturday Class B' } } }),
      json(201, { data: { request: sourceView } }),
      json(200, { data: { requests: [sourceView] } }),
      json(200, { data: { request: { ...sourceView, steps: { learner: 'yes', source: 'yes', destination: 'waiting' } } } }),
      json(200, { data: { request: { ...sourceView, status: 'ended', steps: null } } }),
      json(200, { data: { request: { ...sourceView, status: 'ended', steps: null } } }),
      json(200, { data: { request: { ...sourceView, status: 'executed' } } }),
      json(200, { data: { prefs: { blockTeacherRequests: true, selfManaged: false } } }),
    );

    const preview = await api.previewTransfer('space:a', { learnerId: 'profile:jun', code: 'K7PM4Q' });
    expect(preview).toEqual({ ok: true, data: { destination: { id: 'space:b', kind: 'class', name: 'Saturday Class B' } } });
    expect(call(fetchImpl, 0)).toEqual({ url: 'https://api.example.com/api/spaces/space%3Aa/transfer-requests/preview', method: 'POST', body: { learnerId: 'profile:jun', code: 'K7PM4Q' } });

    const created = await api.createTransfer('space:a', { learnerId: 'profile:jun', destinationSpaceId: 'space:b', code: 'K7PM4Q' });
    expect(created).toMatchObject({ ok: true, data: { id: 'transfer:1', role: 'source' } });
    expect(call(fetchImpl, 1)).toMatchObject({ url: 'https://api.example.com/api/spaces/space%3Aa/transfer-requests', method: 'POST' });

    expect(await api.transferRequests('space:a')).toMatchObject({ ok: true, data: { requests: [{ id: 'transfer:1' }] } });
    expect(call(fetchImpl, 2)).toEqual({ url: 'https://api.example.com/api/spaces/space%3Aa/transfer-requests', method: 'GET', body: undefined });

    expect(await api.approveTransfer('space:a', 'transfer:1', { slots: ['source'] })).toMatchObject({ ok: true, data: { steps: { source: 'yes' } } });
    expect(call(fetchImpl, 3)).toEqual({ url: 'https://api.example.com/api/spaces/space%3Aa/transfer-requests/transfer%3A1/approve', method: 'POST', body: { slots: ['source'] } });

    await api.declineTransfer('space:b', 'transfer:1', { slot: 'destination', reason: 'no_room' });
    expect(call(fetchImpl, 4)).toEqual({ url: 'https://api.example.com/api/spaces/space%3Ab/transfer-requests/transfer%3A1/decline', method: 'POST', body: { slot: 'destination', reason: 'no_room' } });

    await api.cancelTransfer('space:a', 'transfer:1');
    expect(call(fetchImpl, 5)).toEqual({ url: 'https://api.example.com/api/spaces/space%3Aa/transfer-requests/transfer%3A1/cancel', method: 'POST', body: {} });

    await api.retryTransfer('space:b', 'transfer:1');
    expect(call(fetchImpl, 6)).toEqual({ url: 'https://api.example.com/api/spaces/space%3Ab/transfer-requests/transfer%3A1/retry', method: 'POST', body: {} });

    expect(await api.setTransferPrefs('space:f', 'profile:jun', { blockTeacherRequests: true })).toEqual({ ok: true, data: { blockTeacherRequests: true, selfManaged: false } });
    expect(call(fetchImpl, 7)).toEqual({ url: 'https://api.example.com/api/spaces/space%3Af/learners/profile%3Ajun/transfer-prefs', method: 'PUT', body: { blockTeacherRequests: true } });

    for (const { url } of fetchImpl.mock.calls.map((_, i) => call(fetchImpl, i))) expect(url).not.toMatch(/Jun|Saturday|Class/);
  });

  it('keeps the server error code and its details (already_open startedBy, consent_text_stale current, retryAfterSeconds)', async () => {
    const { api } = apiWith(
      json(409, { ok: false, error: { code: 'already_open', message: 'x', details: { startedBy: 'class' } } }),
      json(429, { ok: false, error: { code: 'cooldown', message: 'x', details: { retryAfterSeconds: 600 } } }),
      json(404, { ok: false, error: { code: 'code_not_found', message: 'x' } }),
    );
    expect(await api.createTransfer('space:f', { learnerId: 'profile:jun', destinationSpaceId: 'space:b', code: 'K7PM4Q' })).toEqual({
      ok: false,
      error: 'unknown',
      status: 409,
      code: 'already_open',
      details: { startedBy: 'class' },
    });
    expect(await api.previewTransfer('space:f', { learnerId: 'profile:jun', code: 'K7PM4Q' })).toMatchObject({ code: 'cooldown', details: { retryAfterSeconds: 600 } });
    expect(await api.previewTransfer('space:f', { learnerId: 'profile:jun', code: 'K7PM4Q' })).toEqual({ ok: false, error: 'not_found', status: 404, code: 'code_not_found' });
  });

  it('the first 422 transfers_locked from any transfer call locks the entry points for the session', async () => {
    const { api } = apiWith(json(422, { ok: false, error: { code: 'transfers_locked', message: 'x' } }));
    expect(transfersLockedThisSession()).toBe(false);
    expect(await api.transferRequests('space:a')).toMatchObject({ ok: false, code: 'transfers_locked' });
    expect(transfersLockedThisSession()).toBe(true);
  });

  it('reads a list leniently: a row of an unknown role or status is dropped, its siblings stay', async () => {
    const { api } = apiWith(
      json(200, {
        data: {
          requests: [sourceView, { ...sourceView, id: 'transfer:2', role: 'auditor' }, { ...sourceView, id: 'transfer:3', status: 'paused' }, null, 'x', { ...sourceView, id: 7 }],
          options: [{ learnerId: 'profile:jun', name: 'Jun', classes: [{ spaceId: 'space:a', name: 'A' }], selfManaged: false, blockTeacherRequests: false }, { bad: true }],
          counts: [{ spaceId: 'space:c', waiting: 2 }, { spaceId: 1 }],
        },
      }),
      json(200, { data: { nope: true } }),
    );
    const list = await api.transferRequests('space:f');
    expect(list.ok && list.data.requests.map((r) => r.id)).toEqual(['transfer:1']);
    expect(list.ok && list.data.options?.map((o) => o.learnerId)).toEqual(['profile:jun']);
    expect(list.ok && list.data.counts).toEqual([{ spaceId: 'space:c', waiting: 2 }]);
    expect(await api.transferRequests('space:f')).toEqual({ ok: true, data: { requests: [] } });
  });

  it('a request view this build cannot read is a failed answer, never a crash', async () => {
    const { api } = apiWith(json(200, { data: { request: { id: 'transfer:1', role: 'auditor' } } }), json(200, { data: { prefs: null } }));
    expect(await api.cancelTransfer('space:a', 'transfer:1')).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
    expect(await api.setTransferPrefs('space:f', 'profile:jun', { blockTeacherRequests: false })).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
  });
});
