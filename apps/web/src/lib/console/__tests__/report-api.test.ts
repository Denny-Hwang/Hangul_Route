import type { LearnerReportResponse } from '@hangul-route/content-schema';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createConsoleApi, type ApiResult } from '../api';

/** F-REPORT-001 section 3.8 (RP-7a1): the console client of `GET /api/spaces/:id/learners/:learnerId/report`. */

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const body: LearnerReportResponse = {
  space: { id: 'space:c', kind: 'class', name: 'Sunflower', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
  learner: { id: 'profile:mina', displayName: 'Mina', avatar: 'tiger', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: '2026-10-15T09:30:00.000Z' },
  summary: { lastActiveAt: '2026-10-15T09:30:00.000Z', jamoRecognized: ['ㄱ'], needsPractice: ['ㅂ'] },
  lastSyncedAt: '2026-10-15T09:31:00.000Z',
  serverTime: '2026-10-15T12:00:00.000Z',
};

describe('getLearnerReport', () => {
  it('asks for one learner and one period, ids encoded, with the bearer', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: body }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 'teacher-kim', fetchImpl });
    const res = await api.getLearnerReport('space:c', 'profile:mina', 'month');
    expect(res).toEqual({ ok: true, data: body });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/spaces/space%3Ac/learners/profile%3Amina/report?period=month');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer teacher-kim');
  });

  it('never sends a name or a learner field beyond the two ids and the period', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: body }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    await api.getLearnerReport('space:a&x=1', 'profile:1#b', 'week');
    const url = new URL((fetchImpl.mock.calls[0] as [string])[0]);
    expect(url.pathname).toBe('/api/spaces/space%3Aa%26x%3D1/learners/profile%3A1%23b/report');
    expect([...url.searchParams.keys()]).toEqual(['period']);
    expect((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body).toBeUndefined();
  });

  it('keeps only the keys the report reads (the schema strips anything else) and types the body', async () => {
    const extra = { ...body, learner: { ...body.learner, ageGroup: 'kids' }, summary: { ...body.summary, schemaVersion: 1, vocab: { known: 3 } }, payload: { secret: 1 } };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: extra }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    const res = await api.getLearnerReport('space:c', 'profile:mina', 'week');
    expect(res).toEqual({ ok: true, data: body });
    expectTypeOf(res).toEqualTypeOf<ApiResult<LearnerReportResponse>>();
  });

  it('reads a malformed `activity` as absent (the legacy state), never as a failure', async () => {
    const withBad = { ...body, summary: { ...body.summary, activity: { v: 2, nonsense: true } } };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: withBad }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    const res = await api.getLearnerReport('space:c', 'profile:mina', 'week');
    expect(res.ok && res.data.summary !== null && 'activity' in res.data.summary ? res.data.summary.activity : undefined).toBeUndefined();
  });

  it('drops only a summary field this bundle cannot read (a Worker deployed first with a wider schema), as the Worker does', async () => {
    const skewed = {
      ...body,
      summary: {
        ...body.summary,
        placement: { status: 'a-status-from-a-newer-worker' },
        needsPractice: 'not a list',
        planProgress: { 'plan:a': { done: 1, total: 2, notReady: 0 }, 'plan:b': { done: 'x' } },
      },
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: skewed }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    const res = await api.getLearnerReport('space:c', 'profile:mina', 'week');
    expect(res).toEqual({
      ok: true,
      data: { ...body, summary: { lastActiveAt: body.summary?.lastActiveAt, jamoRecognized: ['ㄱ'], planProgress: { 'plan:a': { done: 1, total: 2, notReady: 0 } } } },
    });
  });

  it('answers a summary that is neither an object nor null as a failed load (never as the no_data state)', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: { ...body, summary: 'nonsense' } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.getLearnerReport('space:c', 'profile:mina', 'week')).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
  });

  it('answers a body it cannot read (a kind this bundle does not know, a missing learner) as a failed load', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { ...body, space: { ...body.space, kind: 'district' } } }))
      .mockResolvedValueOnce(json(200, { data: { ...body, learner: undefined } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.getLearnerReport('space:c', 'profile:mina', 'week')).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
    expect(await api.getLearnerReport('space:c', 'profile:mina', 'week')).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
  });

  it('passes the Worker failures through with their codes (403 outsider, 404 not_member, 409 wrong_kind, network)', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(403, { error: { code: 'forbidden' } }))
      .mockResolvedValueOnce(json(404, { error: { code: 'not_member' } }))
      .mockResolvedValueOnce(json(409, { error: { code: 'wrong_kind' } }))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.getLearnerReport('s', 'l', 'week')).toEqual({ ok: false, error: 'forbidden', status: 403, code: 'forbidden' });
    expect(await api.getLearnerReport('s', 'l', 'week')).toEqual({ ok: false, error: 'not_found', status: 404, code: 'not_member' });
    expect(await api.getLearnerReport('s', 'l', 'week')).toEqual({ ok: false, error: 'unknown', status: 409, code: 'wrong_kind' });
    expect(await api.getLearnerReport('s', 'l', 'week')).toEqual({ ok: false, error: 'network', status: -1 });
  });
});
