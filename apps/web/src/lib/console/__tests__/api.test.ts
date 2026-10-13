import type { TeacherVisibleSummaryKey, VocabSummary } from '@hangul-route/content-schema';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createConsoleApi, type RosterLearner } from '../api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const space = { id: 'space:c', kind: 'class', name: 'A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: 't' };

describe('console api (F-CONSOLE-001)', () => {
  it('types roster summaries as the teacher allow-list plus a family\'s own-route counts, Learning Route goal and an optional vocab: no stage1Anchor, no schemaVersion (F-SPACE-002 T-1a, F-PLAN-002 section 3.10, Learning Route LR-W1, F-VOC-005 P-4)', () => {
    expectTypeOf<keyof NonNullable<RosterLearner['summary']>>().toEqualTypeOf<TeacherVisibleSummaryKey | 'selfRoute' | 'routeGoal' | 'vocab'>();
    // Optional: the console shows word lines only when a roster carries it (vocab stays on the hidden list).
    // Without firstTryRate: the rate is a student's detail view only, never a roster's (section 3.8, P-4b).
    expectTypeOf<NonNullable<RosterLearner['summary']>['vocab']>().toEqualTypeOf<Omit<VocabSummary, 'firstTryRate'> | undefined>();
    expectTypeOf<NonNullable<RosterLearner['summary']>['selfRoute']>().toEqualTypeOf<{ done: number; total: number; notReady: number; weeks: number; endsOn: string } | undefined>();
    // Optional: only a family roster carries it, and only from a device on a build that writes it (LR-6).
    expectTypeOf<NonNullable<RosterLearner['summary']>['routeGoal']>().toEqualTypeOf<{ stage: string; from: 'class' | 'school' | 'family' | 'self' | 'default' } | undefined>();
    expectTypeOf<NonNullable<RosterLearner['summary']>>().not.toHaveProperty('stage1Anchor');
    expectTypeOf<NonNullable<RosterLearner['summary']>>().not.toHaveProperty('schemaVersion');
  });

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

describe('console api — entitlements (F-ENT-001)', () => {
  it('lists entitlements, starts checkout and portal, and surfaces server error codes', async () => {
    const e = { id: 'ent:1', subjectKind: 'account', subjectId: 't', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: null, customerRef: 'cus', seats: null, expiresAt: null, promoCode: null, updatedAt: 't', subjectName: null };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { entitlements: [e] } }))
      .mockResolvedValueOnce(json(200, { data: { url: 'https://checkout.stripe.com/c/1' } }))
      .mockResolvedValueOnce(json(500, { error: { code: 'stripe_not_configured' } }))
      .mockResolvedValueOnce(json(200, { data: { url: 'https://billing.stripe.com/p/1' } }))
      .mockResolvedValueOnce(json(404, { error: { code: 'not_found' } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.entitlements()).toEqual({ ok: true, data: [e] });
    expect(await api.checkout({ planKey: 'group_license', subjectKind: 'space', subjectId: 'space:cls' })).toEqual({ ok: true, data: { url: 'https://checkout.stripe.com/c/1' } });
    expect(await api.checkout({ planKey: 'family_lifetime', subjectKind: 'space', subjectId: 'space:fam' })).toEqual({ ok: false, error: 'unknown', status: 500, code: 'stripe_not_configured' });
    expect(await api.portal({ subjectKind: 'account', subjectId: 't' })).toEqual({ ok: true, data: { url: 'https://billing.stripe.com/p/1' } });
    expect(await api.portal({ subjectKind: 'space', subjectId: 's' })).toEqual({ ok: false, error: 'not_found', status: 404, code: 'not_found' });
    const promoView = { promo: { id: 'promo_1', code: 'HOYA20', name: 'Launch', percentOff: 20, amountOffCents: null, duration: 'once' }, price: { planKey: 'family_lifetime', listUsd: 15.3, discountedUsd: 12.24 } };
    fetchImpl.mockResolvedValueOnce(json(200, { ok: true, data: promoView })).mockResolvedValueOnce(json(404, { ok: false, error: { code: 'promo_invalid' } }));
    expect(await api.checkPromo({ code: 'HOYA20', planKey: 'family_lifetime' })).toEqual({ ok: true, data: promoView });
    expect(await api.checkPromo({ code: 'NOPE', planKey: 'family_lifetime' })).toEqual({ ok: false, error: 'not_found', status: 404, code: 'promo_invalid' });
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('https://api.example.com/api/entitlements/stripe/checkout');
  });
});

describe('console api — school (F-SCHOOL-001)', () => {
  it('fetches the school view and assigns teachers', async () => {
    const view = { school: space, invite: { joinCode: 'R4WQ2P', joinCodeExpiresAt: 't' }, license: null, limits: { licensed: false, students: null, teachers: null }, usage: { students: 0, teachers: 0 }, thisWeek: { students: 0, practiced: 0, classes: 0, classesWithPlan: 0 }, classes: [] };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: view }))
      .mockResolvedValueOnce(json(201, { data: { alreadyMember: false } }))
      .mockResolvedValueOnce(json(422, { error: { code: 'not_in_school' } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.school('space:s')).toEqual({ ok: true, data: view });
    expect(await api.addMember('space:c', 'ms-park')).toEqual({ ok: true, data: { alreadyMember: false } });
    expect(await api.addMember('space:c', 'x')).toEqual({ ok: false, error: 'invalid', status: 422, code: 'not_in_school' });
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('https://api.example.com/api/spaces/space%3Ac/members');
  });
});

describe('console api — token provider (F-AUTH-002)', () => {
  it('asks the provider for a fresh token on every call and short-circuits when signed out', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json(200, { data: { spaces: [] } }));
    const getToken = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce('jwt-1').mockResolvedValueOnce('jwt-2').mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('clerk down'));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: getToken, fetchImpl });
    expect(await api.listSpaces()).toEqual({ ok: true, data: [] });
    expect(await api.listSpaces()).toEqual({ ok: true, data: [] });
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jwt-1' });
    expect((fetchImpl.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jwt-2' });
    expect(await api.listSpaces()).toEqual({ ok: false, error: 'unauthorized', status: 401 });
    expect(await api.listSpaces()).toEqual({ ok: false, error: 'unauthorized', status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('console api — billing (F-BILL-002 B-7)', () => {
  const card = { spaceId: 'space:fam', kind: 'family', name: 'Kim family', role: 'owner', archived: false, payer: true, readOnlyReason: null, coverage: { state: 'free' }, usage: { learners: 1, learnerCap: 5, teachers: null, teacherCap: null }, actions: { buy: 'family_lifetime', manage: false, contact: false }, receipts: [], hasReceipts: false, legacyNoHistory: false };
  const receipt = { id: 'bev:r1', kind: 'purchase', planKey: 'family_lifetime', amountCents: 1530, currency: 'usd', livemode: false, occurredAt: '2026-10-01T00:00:00.000Z', hasReceipt: true };
  /** Clerk's reverification hint plus our code, as the Worker answers a stale sign-in (B-5). */
  const hint = { clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } }, ok: false, error: { code: 'reverify_required', message: 'Confirm it is you to continue' } };

  it('reads the summary leniently, and polls with ?poll=1', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { mode: 'test', purchasesOpen: true, cards: [card, { ...card, spaceId: 'space:new', coverage: { state: 'someday' } }], account: [], extra: 1 } }))
      .mockResolvedValueOnce(json(200, { data: { mode: 'quantum', purchasesOpen: true, cards: [], account: [] } }))
      .mockResolvedValueOnce(json(200, { data: { cards: 'nope' } }))
      .mockResolvedValueOnce(json(401, {}));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    // A card this build cannot read is dropped and its siblings stay (parseBillingSummary).
    expect(await api.billingSummary()).toEqual({ ok: true, data: { mode: 'test', purchasesOpen: true, cards: [card], account: [] } });
    expect(await api.billingSummary({ poll: true })).toEqual({ ok: true, data: { mode: 'none', purchasesOpen: true, cards: [], account: [] } });
    expect(await api.billingSummary()).toEqual({ ok: false, error: 'unknown', status: 200, code: 'unreadable_summary' });
    expect(await api.billingSummary()).toEqual({ ok: false, error: 'unauthorized', status: 401 });
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([
      'https://api.example.com/api/billing/summary',
      'https://api.example.com/api/billing/summary?poll=1',
      'https://api.example.com/api/billing/summary',
      'https://api.example.com/api/billing/summary',
    ]);
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
  });

  it('a summary whose every card and account row this build cannot read is unreadable, never the empty state', async () => {
    const unknownCard = { ...card, coverage: { state: 'someday' } };
    const unknownAccount = { coverage: { state: 'someday' }, actions: { manage: true }, receipts: [], legacyNoHistory: false };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { mode: 'test', purchasesOpen: true, cards: [unknownCard, { ...unknownCard, spaceId: 'space:two' }], account: [] } }))
      .mockResolvedValueOnce(json(200, { data: { mode: 'test', purchasesOpen: true, cards: [], account: [unknownAccount] } }))
      .mockResolvedValueOnce(json(200, { data: { mode: 'test', purchasesOpen: true, cards: [], account: [] } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.billingSummary()).toEqual({ ok: false, error: 'unknown', status: 200, code: 'unreadable_summary' });
    expect(await api.billingSummary()).toEqual({ ok: false, error: 'unknown', status: 200, code: 'unreadable_summary' });
    // A real answer with no spaces is still the empty state.
    expect(await api.billingSummary()).toEqual({ ok: true, data: { mode: 'test', purchasesOpen: true, cards: [], account: [] } });
  });

  it('lists one space receipts, dropping rows it cannot read', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { spaceName: 'Kim family', receipts: [receipt, { ...receipt, id: 'bev:r2', kind: 'chargeback' }, { ...receipt, id: 'bev:r3', url: 'https://pay.stripe.com/x' }] } }))
      .mockResolvedValueOnce(json(200, { data: { receipts: [] } }))
      .mockResolvedValueOnce(json(403, { ok: false, error: { code: 'forbidden' } }))
      .mockResolvedValueOnce(json(404, { ok: false, error: { code: 'not_found' } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.receipts('space:fam')).toEqual({ ok: true, data: { spaceName: 'Kim family', receipts: [receipt, { ...receipt, id: 'bev:r3' }] } });
    expect(await api.receipts('space:fam')).toEqual({ ok: false, error: 'unknown', status: 200, code: 'unreadable_receipts' });
    expect(await api.receipts('space:cls')).toEqual({ ok: false, error: 'forbidden', status: 403, code: 'forbidden' });
    expect(await api.receipts('space:nope')).toEqual({ ok: false, error: 'not_found', status: 404, code: 'not_found' });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.com/api/billing/receipts?id=space%3Afam');
  });

  it('asks for a fresh receipt link, and hands back the step-up hint so useReverification can act on it', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { url: 'https://invoice.stripe.com/i/1' } }))
      .mockResolvedValueOnce(json(403, hint))
      .mockResolvedValueOnce(json(502, { ok: false, error: { code: 'receipt_unavailable' } }))
      .mockResolvedValueOnce(json(503, { ok: false, error: { code: 'live_not_enabled' } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.receiptLink('bev:r1')).toEqual({ ok: true, data: { url: 'https://invoice.stripe.com/i/1' } });
    const refused = await api.receiptLink('bev:r1');
    expect(refused).toEqual({ ok: false, error: 'forbidden', status: 403, code: 'reverify_required', clerk_error: hint.clerk_error });
    expect(await api.receiptLink('bev:r1')).toEqual({ ok: false, error: 'unknown', status: 502, code: 'receipt_unavailable' });
    expect(await api.receiptLink('bev:r1')).toEqual({ ok: false, error: 'unknown', status: 503, code: 'live_not_enabled' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/billing/receipt-link');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ id: 'bev:r1' }) });
  });

  it('accepts only an https receipt link: the page navigates a same-origin tab to it', async () => {
    const bad = [{ url: 'javascript:alert(1)' }, { url: 'http://invoice.stripe.com/i/1' }, { url: 42 }, { url: 'not a url' }, {}];
    const fetchImpl = vi.fn<typeof fetch>();
    for (const data of bad) fetchImpl.mockResolvedValueOnce(json(200, { data }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    for (let i = 0; i < bad.length; i += 1) expect(await api.receiptLink('bev:r1')).toEqual({ ok: false, error: 'unknown', status: 200, code: 'unreadable_link' });
  });

  it('passes the hint through on checkout and portal too, and ignores a clerk_error that is not an object', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(403, hint))
      .mockResolvedValueOnce(json(403, hint))
      .mockResolvedValueOnce(json(403, { clerk_error: 'x', error: { code: 'forbidden' } }));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.checkout({ planKey: 'family_lifetime', subjectKind: 'space', subjectId: 'space:fam' })).toMatchObject({ ok: false, code: 'reverify_required', clerk_error: { reason: 'reverification-error' } });
    expect(await api.portal({ subjectKind: 'space', subjectId: 'space:fam' })).toMatchObject({ ok: false, code: 'reverify_required', clerk_error: { type: 'forbidden' } });
    expect(await api.portal({ subjectKind: 'space', subjectId: 'space:fam' })).toEqual({ ok: false, error: 'forbidden', status: 403, code: 'forbidden' });
  });
});

describe('console api — browseScope (F-BROWSE-001 section 5.4)', () => {
  it('reads GET /api/entitlements/browse leniently: full stays full, anything else reads as sampler', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { scope: 'full' } }))
      .mockResolvedValueOnce(json(200, { data: { scope: 'sampler' } }))
      .mockResolvedValueOnce(json(200, { data: { scope: 'gold', extra: 1 } }))
      .mockResolvedValueOnce(json(200, { data: 'full' }))
      .mockResolvedValueOnce(json(503, {}))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createConsoleApi({ endpoint: 'https://api.example.com', token: 't', fetchImpl });
    expect(await api.browseScope()).toEqual({ ok: true, data: { scope: 'full' } });
    expect(await api.browseScope()).toEqual({ ok: true, data: { scope: 'sampler' } });
    expect(await api.browseScope()).toEqual({ ok: true, data: { scope: 'sampler' } });
    expect(await api.browseScope()).toEqual({ ok: true, data: { scope: 'sampler' } });
    expect(await api.browseScope()).toEqual({ ok: false, error: 'unknown', status: 503 });
    expect(await api.browseScope()).toEqual({ ok: false, error: 'network', status: -1 });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/entitlements/browse');
    expect(init.method).toBe('GET');
  });
});
