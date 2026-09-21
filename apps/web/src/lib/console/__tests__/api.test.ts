import { describe, expect, it, vi } from 'vitest';
import { createConsoleApi } from '../api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const space = { id: 'space:c', kind: 'class', name: 'A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: 't' };

describe('console api (F-CONSOLE-001)', () => {
  it('sends the bearer and maps each method', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { spaces: [{ space, role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: 'K7M2X9', joinCodeExpiresAt: 't' }] } }))
      .mockResolvedValueOnce(json(201, { data: { space, membership: { role: 'owner' }, joinCode: 'K7M2X9', joinCodeExpiresAt: 't' } }))
      .mockResolvedValueOnce(json(200, { data: { joinCode: 'ABCDEF', expiresAt: 't2' } }))
      .mockResolvedValueOnce(json(200, { data: { space, learners: [], joinCode: 'ABCDEF', joinCodeExpiresAt: 't2' } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 'teacher-kim', fetchImpl });

    const list = await api.listSpaces();
    expect(list).toMatchObject({ ok: true, data: [{ role: 'owner', joinCode: 'K7M2X9' }] });
    const created = await api.createSpace({ kind: 'class', name: 'A' });
    expect(created).toMatchObject({ ok: true, data: { joinCode: 'K7M2X9' } });
    expect(await api.regenerateCode('space:c')).toEqual({ ok: true, data: { joinCode: 'ABCDEF', expiresAt: 't2' } });
    expect(await api.roster('space:c')).toMatchObject({ ok: true, data: { learners: [] } });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/spaces');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer teacher-kim');
    expect(fetchImpl.mock.calls[2]?.[0]).toBe('https://api.example.com/api/spaces/space%3Ac/code');
    expect(fetchImpl.mock.calls[3]?.[0]).toBe('https://api.example.com/api/spaces/space%3Ac/roster');
  });

  it('maps 401 / 403 / 404 / 422 / 500 / missing data / network', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(403, {}))
      .mockResolvedValueOnce(json(404, {}))
      .mockResolvedValueOnce(json(422, {}))
      .mockResolvedValueOnce(json(500, {}))
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.listSpaces()).toEqual({ ok: false, error: 'unauthorized', status: 401 });
    expect(await api.roster('x')).toEqual({ ok: false, error: 'forbidden', status: 403 });
    expect(await api.roster('x')).toEqual({ ok: false, error: 'not_found', status: 404 });
    expect(await api.createSpace({ kind: 'class', name: '' })).toEqual({ ok: false, error: 'invalid', status: 422 });
    expect(await api.regenerateCode('x')).toEqual({ ok: false, error: 'unknown', status: 500 });
    expect(await api.listSpaces()).toEqual({ ok: false, error: 'unknown', status: 200 });
    expect(await api.listSpaces()).toEqual({ ok: false, error: 'network', status: -1 });
  });
});

describe('console api — plans (F-PLAN-001)', () => {
  const plan = { id: 'plan:w3', spaceId: 'space:c', authorAccountId: 't', title: 'Week 3', items: [{ kind: 'quest', id: 'quest:a' }], targetLearnerIds: null, publishedAt: null, archivedAt: null, createdAt: 't', updatedAt: 't' };

  it('lists, saves and archives plans', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { plans: [plan] } }))
      .mockResolvedValueOnce(json(201, { data: { plan } }))
      .mockResolvedValueOnce(json(200, { data: { plan: { ...plan, publishedAt: 'p' } } }))
      .mockResolvedValueOnce(json(200, { data: { plan: { ...plan, archivedAt: 'a' } } }))
      .mockResolvedValueOnce(json(403, {}));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.listPlans('space:c')).toEqual({ ok: true, data: [plan] });
    expect(await api.savePlan('space:c', { title: 'Week 3', items: plan.items as never, publish: false })).toEqual({ ok: true, data: plan });
    expect(await api.savePlan('space:c', { id: 'plan:w3', title: 'Week 3', items: plan.items as never, publish: true })).toMatchObject({ ok: true, data: { publishedAt: 'p' } });
    expect(await api.archivePlan('space:c', 'plan:w3')).toMatchObject({ ok: true, data: { archivedAt: 'a' } });
    expect(await api.listPlans('space:c')).toEqual({ ok: false, error: 'forbidden', status: 403 });
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' });
    expect(fetchImpl.mock.calls[3]?.[0]).toBe('https://api.example.com/api/spaces/space%3Ac/plans/plan%3Aw3/archive');
  });
});

describe('console api — settings, members, re-link, rescue (F-TCH-001 §10)', () => {
  it('maps every method', async () => {
    const request = { id: 'relink:1', learnerId: 'profile:m', learnerName: 'Minho', deviceId: 'd', platform: null, requestedAt: 't', expiresAt: 'e', status: 'pending' };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { members: [{ memberKind: 'account', memberId: 'mom', role: 'owner', joinedAt: 't', name: 'Mom', isOwner: true }] } }))
      .mockResolvedValueOnce(json(200, { data: { removed: true } }))
      .mockResolvedValueOnce(json(200, { data: { space: { ...space, settings: { consentMode: 'school', anonymizeRoster: true } } } }))
      .mockResolvedValueOnce(json(200, { data: { space: { ...space, archivedAt: 'a' } } }))
      .mockResolvedValueOnce(json(200, { data: { space } }))
      .mockResolvedValueOnce(json(200, { data: { deleted: true } }))
      .mockResolvedValueOnce(json(200, { data: { requests: [request] } }))
      .mockResolvedValueOnce(json(200, { data: { request: { ...request, status: 'approved' } } }))
      .mockResolvedValueOnce(json(200, { data: { request: { ...request, status: 'denied' } } }))
      .mockResolvedValueOnce(json(201, { data: { code: 'TIGER-MOON-4821', issuedAt: 't' } }))
      .mockResolvedValueOnce(json(403, {}));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.members('space:c')).toMatchObject({ ok: true, data: [{ memberId: 'mom', isOwner: true }] });
    expect(await api.removeMember('space:c', 'learner', 'profile:m')).toEqual({ ok: true, data: { removed: true } });
    expect(await api.patchSettings('space:c', { anonymizeRoster: true, consentMode: 'school' })).toMatchObject({ ok: true, data: { settings: { anonymizeRoster: true } } });
    expect(await api.archiveSpace('space:c', true)).toMatchObject({ ok: true, data: { archivedAt: 'a' } });
    expect(await api.archiveSpace('space:c', false)).toMatchObject({ ok: true, data: { archivedAt: null } });
    expect(await api.deleteLearnerData('space:c', 'profile:m')).toEqual({ ok: true, data: { deleted: true } });
    expect(await api.relinkRequests('space:c')).toMatchObject({ ok: true, data: [{ id: 'relink:1' }] });
    expect(await api.decideRelink('space:c', 'relink:1', true)).toMatchObject({ ok: true, data: { status: 'approved' } });
    expect(await api.decideRelink('space:c', 'relink:1', false)).toMatchObject({ ok: true, data: { status: 'denied' } });
    expect(await api.issueRescueCode('profile:m')).toEqual({ ok: true, data: { code: 'TIGER-MOON-4821', issuedAt: 't' } });
    expect(await api.issueRescueCode('profile:m')).toEqual({ ok: false, error: 'forbidden', status: 403 });
    const urls = fetchImpl.mock.calls.map((c) => c[0]);
    expect(urls[1]).toBe('https://api.example.com/api/spaces/space%3Ac/members/learner/profile%3Am');
    expect(urls[3]).toBe('https://api.example.com/api/spaces/space%3Ac/archive');
    expect(urls[4]).toBe('https://api.example.com/api/spaces/space%3Ac/unarchive');
    expect(urls[5]).toBe('https://api.example.com/api/spaces/space%3Ac/learners/profile%3Am/data');
    expect(urls[7]).toBe('https://api.example.com/api/spaces/space%3Ac/relink-requests/relink%3A1/approve');
    expect(urls[9]).toBe('https://api.example.com/api/recovery/issue');
    expect((fetchImpl.mock.calls[2]?.[1] as RequestInit).method).toBe('PATCH');
  });
});
