import { describe, expect, it, vi } from 'vitest';
import { createConsoleApi } from '../api';
import { CLASS_REPORT } from './fixtures/class-report';

/** F-REPORT-001 RP-8 (section 3.8): the console client of `GET /api/spaces/:id/class-report?period=&at=`. */

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const body = {
  space: { id: 'space:c', kind: 'class', name: 'Sunflower', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
  period: 'week',
  at: null,
  serverTime: '2026-10-15T12:00:00.000Z',
  report: CLASS_REPORT,
};

describe('getClassReport', () => {
  it('asks for one class, a period and a window, ids encoded, and keeps the space fields the page reads', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: body }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    const res = await api.getClassReport('space:c', 'week', '2026-10-08');
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/spaces/space%3Ac/class-report?period=week&at=2026-10-08');
    expect(res.ok && res.data.space).toEqual({ id: 'space:c', kind: 'class', name: 'Sunflower', archivedAt: null });
    expect(res.ok && res.data.at).toBeNull();
    expect(res.ok && res.data.report.headline).toEqual({ code: 'class_practiced', practiced: 2, learners: 12 });
  });

  it('sends no `at` for the current window or All time', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(200, { data: body }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    await api.getClassReport('space:c', 'month', null);
    await api.getClassReport('space:c', 'all', '2026-10-01');
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.com/api/spaces/space%3Ac/class-report?period=month',
      'https://api.example.com/api/spaces/space%3Ac/class-report?period=all',
    ]);
  });

  it('reads a body without the echoed `at` (a Worker from before RP-5b echoed it) and a widened space setting', async () => {
    const { at: _at, ...old } = body;
    const wider = { ...old, space: { ...body.space, settings: { consentMode: 'district' } } };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(200, { data: wider }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    const res = await api.getClassReport('space:c', 'week', null);
    expect(res.ok && res.data.at).toBeNull();
  });

  it('a body it cannot read is a failed load; Worker errors pass through', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { ...body, report: { v: 2 } } }))
      .mockResolvedValueOnce(json(200, { data: { ...body, space: { ...body.space, kind: 'galaxy' } } }))
      .mockResolvedValueOnce(json(200, { data: 'nope' }))
      .mockResolvedValueOnce(json(409, { error: { code: 'wrong_kind' } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.getClassReport('space:c', 'week', null)).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
    expect(await api.getClassReport('space:c', 'week', null)).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
    expect(await api.getClassReport('space:c', 'week', null)).toEqual({ ok: false, error: 'unknown', status: 200, code: 'bad_response' });
    expect(await api.getClassReport('space:c', 'week', null)).toMatchObject({ ok: false, status: 409, code: 'wrong_kind' });
  });
});
