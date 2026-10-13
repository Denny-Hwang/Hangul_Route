import type { LearnerReportResponse } from '@hangul-route/content-schema';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createConsoleApi, type ApiResult, type LearnerReportBody } from '../api';

/** F-REPORT-001 section 3.8 (RP-7a1): the console client of `GET /api/spaces/:id/learners/:learnerId/report`. */

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const body: LearnerReportResponse = {
  space: { id: 'space:c', kind: 'class', name: 'Sunflower', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
  learner: { id: 'profile:mina', displayName: 'Mina', avatar: 'tiger', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: '2026-10-15T09:30:00.000Z' },
  summary: { lastActiveAt: '2026-10-15T09:30:00.000Z', jamoRecognized: ['ㄱ'], needsPractice: ['ㅂ'] },
  lastSyncedAt: '2026-10-15T09:31:00.000Z',
  serverTime: '2026-10-15T12:00:00.000Z',
};

/** What the client keeps of `body`: the envelope fields the report reads, and the summary. */
const kept = (from: LearnerReportResponse): LearnerReportBody => ({
  space: { id: from.space.id, kind: from.space.kind, name: from.space.name, archivedAt: from.space.archivedAt },
  learner: { id: from.learner.id, displayName: from.learner.displayName, avatar: from.learner.avatar },
  summary: from.summary,
  lastSyncedAt: from.lastSyncedAt,
  serverTime: from.serverTime,
});

describe('getLearnerReport', () => {
  it('asks for one learner and one period, ids encoded, with the bearer', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: body }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 'teacher-kim', fetchImpl });
    const res = await api.getLearnerReport('space:c', 'profile:mina', 'month');
    expect(res).toEqual({ ok: true, data: kept(body) });
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
    expect(res).toEqual({ ok: true, data: kept(body) });
    expectTypeOf(res).toEqualTypeOf<ApiResult<LearnerReportBody>>();
  });

  it('reads a malformed `activity` as absent (the legacy state), never as a failure', async () => {
    const withBad = { ...body, summary: { ...body.summary, activity: { v: 2, nonsense: true } } };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: withBad }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    const res = await api.getLearnerReport('space:c', 'profile:mina', 'week');
    expect(res.ok).toBe(true);
    expect(res).toEqual({ ok: true, data: kept(body) });
  });

  it('never fails a report on an envelope field it does not read (a Worker deployed first that widens one)', async () => {
    const wider = {
      ...body,
      space: { ...body.space, name: 'S'.repeat(60), settings: { consentMode: 'district-managed' }, parentSpaceId: 42, createdAt: undefined },
      learner: { ...body.learner, avatar: { kind: 'new' }, joinedAt: null },
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: wider }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    const res = await api.getLearnerReport('space:c', 'profile:mina', 'week');
    // The avatar is read only for the title's chip (RP-7a2): a shape this bundle does not know reads as none.
    expect(res).toEqual({ ok: true, data: { ...kept(body), space: { ...kept(body).space, name: 'S'.repeat(60) }, learner: { ...kept(body).learner, avatar: null } } });
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
      data: { ...kept(body), summary: { lastActiveAt: body.summary?.lastActiveAt, jamoRecognized: ['ㄱ'], planProgress: { 'plan:a': { done: 1, total: 2, notReady: 0 } } } },
    });
  });

  it('answers a summary that is neither an object nor null as a failed load (never as the no_data state)', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: { ...body, summary: 'nonsense' } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.getLearnerReport('space:c', 'profile:mina', 'week')).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
  });

  it('answers a body it cannot read (a kind this bundle does not know, a missing or mistyped read field) as a failed load', async () => {
    const unreadable = [
      { ...body, space: { ...body.space, kind: 'district' } },
      { ...body, learner: undefined },
      { ...body, learner: { ...body.learner, displayName: 7 } },
      { ...body, space: { ...body.space, archivedAt: undefined } },
      { ...body, serverTime: null },
      'nonsense',
    ];
    const fetchImpl = vi.fn<typeof fetch>();
    for (const data of unreadable) fetchImpl.mockResolvedValueOnce(json(200, { data }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    for (let i = 0; i < unreadable.length; i += 1) {
      expect(await api.getLearnerReport('space:c', 'profile:mina', 'week')).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
    }
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
