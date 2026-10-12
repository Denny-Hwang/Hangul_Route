import {
  BillingSummarySchema,
  FAMILY_LIFETIME_LEARNERS,
  FREE_CLASS_STUDENT_CAP,
  RECEIPTS_CARD_LIMIT,
  RECEIPTS_PAGE_LIMIT,
  ReceiptViewSchema,
  SCHOOL_LICENSE_STUDENTS,
  SCHOOL_LICENSE_TEACHERS,
  type BillingSpaceCard,
  type BillingSummary,
  type EntitlementApply,
} from '@hangul-route/content-schema';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import type { BillingEventInput, Db } from '../db/types';
import { setReceiptFetchForTests } from '../routes/billing';
import { store } from '../store';
import { clerkTestKeys, type ClerkTestKeys } from './helpers/clerk-token';
import { testDb as db } from './helpers/db';

/**
 * F-BILL-002 B-4: the /api/billing router (section 5.3). Every persona row of
 * section 4.2, payer-only receipts (OD-8), and a receipt link fetched fresh
 * from Stripe behind step-up and the live guard (sections 4.4, 4.9, 4.10).
 */
type Envelope = { ok: boolean; data?: unknown; error?: { code: string } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const TEST_ENV = { STRIPE_SECRET_KEY: 'sk_test_x' };
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env: Record<string, string> = TEST_ENV) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
  return { status: res.status, body: (await res.json()) as Envelope };
}
async function createSpace(user: string, kind: string, name: string, parentSpaceId?: string): Promise<string> {
  const r = await call('POST', '/api/spaces', bearer(user), { kind, name, ...(parentSpaceId ? { parentSpaceId } : {}) });
  return (r.body.data as { space: { id: string } }).space.id;
}
async function summaryOf(user: string, query = '', env: Record<string, string> = TEST_ENV): Promise<BillingSummary> {
  const r = await call('GET', `/api/billing/summary${query}`, bearer(user), undefined, env);
  expect(r.status).toBe(200);
  // The Worker answers the strict contract (the page reads it leniently).
  return BillingSummarySchema.parse(r.body.data);
}
const cardOf = (s: BillingSummary, spaceId: string): BillingSpaceCard => {
  const found = s.cards.find((c) => c.spaceId === spaceId);
  if (!found) throw new Error(`no card for ${spaceId}`);
  return found;
};

const DAY = 86_400_000;
const future = (days = 365) => new Date(Date.now() + days * DAY).toISOString();
async function entitle(subjectId: string, over: Partial<EntitlementApply> = {}, at = new Date()) {
  return db.applyEntitlement({ subjectKind: 'space', subjectId, planKey: 'family_lifetime', status: 'active', provider: 'stripe', providerRef: `sub_${subjectId.slice(6)}`, customerRef: 'cus_1', expiresAt: future(), ...over }, at);
}
let seq = 0;
async function history(subjectId: string, over: Partial<BillingEventInput> = {}) {
  seq += 1;
  return db.recordBillingEvent(
    { subjectKind: 'space', subjectId, planKey: 'family_lifetime', kind: 'purchase', amountCents: 1530, currency: 'usd', provider: 'stripe', providerRef: `in_${seq}`, paymentRef: `pi_${seq}`, livemode: false, occurredAt: new Date(Date.UTC(2026, 0, 1) + seq * DAY).toISOString(), ...over },
    new Date(),
  );
}
async function addLearners(spaceId: string, n: number) {
  for (let i = 0; i < n; i += 1) await db.addMembership({ spaceId, memberKind: 'learner', memberId: `profile:${spaceId.slice(6)}-${i}`, role: 'student', joinedAt: new Date().toISOString() });
}
async function addAdult(spaceId: string, accountId: string, role: 'caregiver' | 'teacher' | 'admin') {
  await db.addMembership({ spaceId, memberKind: 'account', memberId: accountId, role, joinedAt: new Date().toISOString() });
}
const billingEvents = () => store.events.filter((e) => e.name.startsWith('billing.')).map((e) => ({ name: e.name, payload: e.payload }));

/** Records every Db call, so a test can say which ones a route made. */
function watching(target: Db): { db: Db; calls: string[] } {
  const calls: string[] = [];
  const proxy = new Proxy(target, {
    get(obj, prop, receiver) {
      const value: unknown = Reflect.get(obj, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.push(String(prop));
        return (value as (...a: unknown[]) => unknown).apply(obj, args);
      };
    },
  });
  return { db: proxy, calls };
}

let stripe = vi.fn<typeof fetch>();
beforeEach(async () => {
  await db.reset();
  store.reset();
  stripe = vi.fn<typeof fetch>().mockImplementation(async () => new Response('{}', { status: 500 }));
  setReceiptFetchForTests(stripe);
});

describe('GET /api/billing/summary: one card per persona (section 4.2)', () => {
  it('needs a signed-in account', async () => {
    expect((await call('GET', '/api/billing/summary', json)).status).toBe(401);
  });

  it('no spaces: no cards, the mode and whether purchases are open', async () => {
    expect(await summaryOf('nobody')).toEqual({ mode: 'test', purchasesOpen: true, cards: [], account: [] });
    expect(await summaryOf('nobody', '', {})).toMatchObject({ mode: 'none', purchasesOpen: false });
    expect(await summaryOf('nobody', '', { STRIPE_SECRET_KEY: 'sk_live_x' })).toMatchObject({ mode: 'live', purchasesOpen: false });
    expect(await summaryOf('nobody', '', { STRIPE_SECRET_KEY: 'sk_live_x', BILLING_LIVE_ALLOWED: 'true' })).toMatchObject({ mode: 'live', purchasesOpen: true });
  });

  it('owner, free family: usage against the family cap, the Family Plan to buy, no receipts', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await addLearners(fam, 2);
    expect(cardOf(await summaryOf('mom'), fam)).toEqual({
      spaceId: fam,
      kind: 'family',
      name: 'Kim family',
      role: 'owner',
      archived: false,
      payer: true,
      readOnlyReason: null,
      coverage: { state: 'free' },
      usage: { learners: 2, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null },
      actions: { buy: 'family_lifetime', manage: false, contact: false },
      receipts: [],
      hasReceipts: false,
      legacyNoHistory: false,
    });
  });

  it('owner, Family Plan: own coverage, manage, the latest 3 receipts newest first', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await addLearners(fam, 1);
    const at = new Date('2026-10-01T00:00:00.000Z');
    const row = await entitle(fam, {}, at);
    for (let i = 0; i < 4; i += 1) await history(fam, { kind: i === 0 ? 'purchase' : 'renewal' });
    const c = cardOf(await summaryOf('mom'), fam);
    expect(c.coverage).toEqual({ state: 'own', planKey: 'family_lifetime', status: 'active', expiresAt: row.expiresAt, statusSince: row.updatedAt, endsAtPeriodEnd: false });
    expect(c.actions).toEqual({ buy: null, manage: true, contact: false });
    expect(c.receipts).toHaveLength(RECEIPTS_CARD_LIMIT);
    expect(c.receipts.map((r) => r.occurredAt)).toEqual([...c.receipts.map((r) => r.occurredAt)].sort().reverse());
    expect(c.hasReceipts).toBe(true);
    expect(c.legacyNoHistory).toBe(false);
    for (const r of c.receipts) {
      expect(Object.keys(r).sort()).toEqual(Object.keys(ReceiptViewSchema.shape).sort());
      expect(JSON.stringify(r)).not.toMatch(/in_|pi_|sub_|cus_|https?:/);
    }
  });

  it('owner, Family Plan with 0 learners: usage 0 (the page shows Connect a learner); no join code anywhere', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await entitle(fam);
    const s = await summaryOf('mom');
    expect(cardOf(s, fam).usage).toEqual({ learners: 0, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null });
    const code = (await db.getSpace(fam))?.joinCode;
    const text = JSON.stringify(s);
    if (code) expect(text).not.toContain(code);
    expect(text).not.toMatch(/joinCode|customerRef|cus_|promo|amountUsd/);
  });

  it('cancelled in the portal: ends at the period end, still own coverage', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await entitle(fam, { status: 'cancelled' });
    expect(cardOf(await summaryOf('mom'), fam).coverage).toMatchObject({ state: 'own', status: 'cancelled', endsAtPeriodEnd: true });
  });

  it('past due: own coverage while it is shown, nothing to buy; an ended plan reads as free again', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await entitle(fam, { status: 'past_due' }, new Date(Date.now() - 30 * DAY));
    expect(cardOf(await summaryOf('mom'), fam)).toMatchObject({ coverage: { state: 'own', status: 'past_due' }, actions: { buy: null, manage: true } });
    await entitle(fam, { status: 'expired' });
    expect(cardOf(await summaryOf('mom'), fam)).toMatchObject({ coverage: { state: 'free' }, actions: { buy: 'family_lifetime', manage: false } });
  });

  it('a legacy one-time sandbox row with no history: legacyNoHistory, nothing to manage', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await entitle(fam, { providerRef: 'pi_legacy', expiresAt: null });
    expect(cardOf(await summaryOf('mom'), fam)).toMatchObject({ coverage: { state: 'own', expiresAt: null }, actions: { buy: null, manage: false }, legacyNoHistory: true, hasReceipts: false });
  });

  it('caregiver: read-only family card with no receipts, no actions and no amounts', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await addAdult(fam, 'dad', 'caregiver');
    await addLearners(fam, 3);
    await entitle(fam);
    await history(fam);
    const c = cardOf(await summaryOf('dad'), fam);
    expect(c).toMatchObject({ role: 'caregiver', payer: false, readOnlyReason: 'family', actions: { buy: null, manage: false, contact: false }, receipts: [], hasReceipts: false, legacyNoHistory: false });
    // Viewers get the learner count only, never the plan's limit (section 5.3).
    expect(c.usage).toEqual({ learners: 3, learnerCap: null, teachers: null, teacherCap: null });
    expect(JSON.stringify(c)).not.toMatch(/amountCents|1530/);
  });

  it('owner, free stand-alone class: the free student cap and the Group License to buy', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    await addLearners(cls, 14);
    expect(cardOf(await summaryOf('teacher'), cls)).toMatchObject({ payer: true, readOnlyReason: null, coverage: { state: 'free' }, usage: { learners: 14, learnerCap: FREE_CLASS_STUDENT_CAP }, actions: { buy: 'group_license', manage: false, contact: false } });
  });

  it('owner with a license: no cap; co-teacher: read-only class card', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    await addAdult(cls, 'co', 'teacher');
    await addLearners(cls, 23);
    await entitle(cls, { planKey: 'group_license' });
    expect(cardOf(await summaryOf('teacher'), cls)).toMatchObject({ coverage: { state: 'own', planKey: 'group_license' }, usage: { learners: 23, learnerCap: null }, actions: { buy: null, manage: true } });
    expect(cardOf(await summaryOf('co'), cls)).toMatchObject({ role: 'teacher', payer: false, readOnlyReason: 'class', usage: { learners: 23, learnerCap: null }, actions: { buy: null, manage: false, contact: false }, receipts: [] });
  });

  it('co-teacher of a free class: the student count, not the free cap', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    await addAdult(cls, 'co', 'teacher');
    await addLearners(cls, 14);
    expect(cardOf(await summaryOf('co'), cls).usage).toEqual({ learners: 14, learnerCap: null, teachers: null, teacherCap: null });
  });

  it('class inside a school: covered by the school, "Your school manages this plan", nothing to buy', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    // A teacher invited into the school creates their own class there; the school pays.
    await addAdult(sch, 'kim', 'teacher');
    const own = await createSpace('kim', 'class', 'Room 5', sch);
    await addLearners(own, 31);
    const lic = await entitle(sch, { planKey: 'group_license' });
    await history(sch, { planKey: 'group_license' });
    const c = cardOf(await summaryOf('kim'), own);
    // The class owner is a viewer here: the school pays (section 4.2), so no receipts and no payer ordering.
    expect(c).toMatchObject({ payer: false, readOnlyReason: 'school', coverage: { state: 'school', schoolName: 'Maple School', planKey: 'group_license', expiresAt: lic.expiresAt }, usage: { learners: 31, learnerCap: null }, actions: { buy: null, manage: false, contact: false }, receipts: [], hasReceipts: false });
  });

  it('class inside a school under a seat contract: covered by the contract; an archived school covers nothing', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    await addAdult(sch, 'kim', 'teacher');
    const own = await createSpace('kim', 'class', 'Room 5', sch);
    await entitle(sch, { planKey: 'school_seat', provider: 'manual', providerRef: null, customerRef: null, seats: 400 });
    expect(cardOf(await summaryOf('kim'), own).coverage).toMatchObject({ state: 'school', planKey: 'school_seat' });
    expect(cardOf(await summaryOf('kim'), sch).coverage).toMatchObject({ state: 'school', schoolName: 'Maple School', planKey: 'school_seat' });
    expect((await call('POST', `/api/spaces/${sch}/archive`, bearer('principal'))).status).toBe(200);
    expect(cardOf(await summaryOf('kim'), own)).toMatchObject({ coverage: { state: 'free' }, readOnlyReason: 'school', actions: { buy: null } });
  });

  it('a class moved into a school that still holds its own license: its owner stays the payer and can manage it', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    await addAdult(sch, 'kim', 'teacher');
    const own = await createSpace('kim', 'class', 'Room 5', sch);
    await entitle(own, { planKey: 'group_license' });
    expect(cardOf(await summaryOf('kim'), own)).toMatchObject({ payer: true, readOnlyReason: null, coverage: { state: 'own', planKey: 'group_license' }, actions: { buy: null, manage: true } });
  });

  it('class inside a school without a school plan: free, still the school manages it, no buy', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    await addAdult(sch, 'kim', 'teacher');
    const own = await createSpace('kim', 'class', 'Room 5', sch);
    expect(cardOf(await summaryOf('kim'), own)).toMatchObject({ payer: false, readOnlyReason: 'school', coverage: { state: 'free' }, usage: { learnerCap: null }, actions: { buy: null } });
  });

  it('school teacher member: covered by the school, no seat counts', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    await addAdult(sch, 'kim', 'teacher');
    await entitle(sch, { planKey: 'group_license', expiresAt: null });
    expect(cardOf(await summaryOf('kim'), sch)).toMatchObject({ role: 'teacher', payer: false, readOnlyReason: 'school', coverage: { state: 'school', schoolName: 'Maple School', planKey: 'group_license', expiresAt: null }, usage: null, receipts: [] });
    // A license past due beyond the grace week no longer covers the member.
    await entitle(sch, { planKey: 'group_license', status: 'past_due' }, new Date(Date.now() - 30 * DAY));
    expect(cardOf(await summaryOf('kim'), sch)).toMatchObject({ coverage: { state: 'free' }, usage: null });
    // Without a plan the member just sees the free plan, still no seat counts.
    await entitle(sch, { planKey: 'group_license', status: 'expired' });
    expect(cardOf(await summaryOf('kim'), sch)).toMatchObject({ coverage: { state: 'free' }, usage: null, actions: { buy: null } });
  });

  it('school owner and school admin are both payers: seat counts, actions, receipts', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    await addAdult(sch, 'vice', 'admin');
    await addAdult(sch, 'kim', 'teacher');
    const cls = await createSpace('kim', 'class', 'Room 5', sch);
    await addLearners(cls, 4);
    await entitle(sch, { planKey: 'group_license' });
    await history(sch, { planKey: 'group_license', amountCents: 15300 });
    for (const user of ['principal', 'vice']) {
      const c = cardOf(await summaryOf(user), sch);
      expect(c).toMatchObject({ payer: true, readOnlyReason: null, usage: { learners: 4, learnerCap: SCHOOL_LICENSE_STUDENTS, teachers: 1, teacherCap: SCHOOL_LICENSE_TEACHERS }, actions: { buy: null, manage: true, contact: true }, hasReceipts: true });
      expect(c.receipts).toHaveLength(1);
    }
  });

  it('free school owner: Group License to buy, Contact us, counts without caps', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    expect(cardOf(await summaryOf('principal'), sch)).toMatchObject({ coverage: { state: 'free' }, usage: { learners: 0, learnerCap: null, teachers: 0, teacherCap: null }, actions: { buy: 'group_license', manage: false, contact: true } });
  });

  it('a school contract: own coverage for payers, no Stripe manage, Contact us', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    await entitle(sch, { planKey: 'school_seat', provider: 'manual', providerRef: null, customerRef: null, seats: 400 });
    expect(cardOf(await summaryOf('principal'), sch)).toMatchObject({ coverage: { state: 'own', planKey: 'school_seat' }, usage: { learnerCap: 400, teacherCap: null }, actions: { buy: null, manage: false, contact: true }, legacyNoHistory: false });
    // A lapsed license next to the live contract: the card shows the contract.
    await entitle(sch, { planKey: 'group_license', status: 'expired', expiresAt: '2026-01-01T00:00:00.000Z' });
    expect(cardOf(await summaryOf('principal'), sch).coverage).toMatchObject({ state: 'own', planKey: 'school_seat' });
  });

  it('archived: shown to payers only while a live plan still renews, never offered; gone otherwise', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    await addAdult(cls, 'co', 'teacher');
    await entitle(cls, { planKey: 'group_license' });
    const fam = await createSpace('teacher', 'family', 'Lee family');
    await entitle(fam);
    const free = await createSpace('teacher', 'class', 'Room 6');
    for (const id of [cls, fam, free]) expect((await call('POST', `/api/spaces/${id}/archive`, bearer('teacher'))).status).toBe(200);
    const s = await summaryOf('teacher');
    expect(cardOf(s, cls)).toMatchObject({ archived: true, payer: true, actions: { buy: null, manage: true } });
    expect(cardOf(s, fam)).toMatchObject({ archived: true, actions: { buy: null, manage: true } });
    expect(s.cards.some((c) => c.spaceId === free)).toBe(false);
    expect((await summaryOf('co')).cards).toEqual([]);
  });

  it('archived: a legacy one-time Family Plan never renews, so its card goes; a past-due subscription Stripe still retries keeps it', async () => {
    const legacy = await createSpace('mom', 'family', 'Old family');
    await entitle(legacy, { providerRef: 'pi_legacy', expiresAt: null });
    const lapsing = await createSpace('mom', 'family', 'Kim family');
    await entitle(lapsing, { status: 'past_due' }, new Date(Date.now() - 30 * DAY));
    for (const id of [legacy, lapsing]) expect((await call('POST', `/api/spaces/${id}/archive`, bearer('mom'))).status).toBe(200);
    const s = await summaryOf('mom');
    expect(s.cards.map((c) => c.spaceId)).toEqual([lapsing]);
    expect(cardOf(s, lapsing)).toMatchObject({ archived: true, coverage: { state: 'own', status: 'past_due' }, actions: { buy: null, manage: true } });
  });

  it('orders payer cards first, then family, class, school, newest first', async () => {
    // Distinct creation times, oldest first, one day apart. The clock moves
    // instead of rewriting createdAt: the D1 upsert keeps created_at.
    let day = 0;
    const made = async (user: string, kind: string, name: string): Promise<string> => {
      vi.setSystemTime(new Date(Date.UTC(2026, 0, 1 + day++)));
      return createSpace(user, kind, name);
    };
    vi.useFakeTimers({ toFake: ['Date'] });
    let expected: string[];
    try {
      const sch = await made('principal', 'school', 'Maple School');
      await addAdult(sch, 'kim', 'teacher');
      const famOld = await made('kim', 'family', 'Old family');
      const clsA = await made('kim', 'class', 'A');
      const famNew = await made('kim', 'family', 'New family');
      const clsB = await made('kim', 'class', 'B');
      const other = await made('mom', 'family', 'Kim family');
      await addAdult(other, 'kim', 'caregiver');
      expected = [famNew, famOld, clsB, clsA, other, sch];
    } finally {
      vi.useRealTimers();
    }
    const ids = (await summaryOf('kim')).cards.map((c) => c.spaceId);
    expect(ids).toEqual(expected);
  });

  it('an account-subject row (legacy): one extra card for the viewer only', async () => {
    await db.applyEntitlement({ subjectKind: 'account', subjectId: 'solo', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: 'sub_acct', customerRef: 'cus_acct', expiresAt: future() }, new Date());
    await db.recordBillingEvent({ subjectKind: 'account', subjectId: 'solo', planKey: 'group_license', kind: 'purchase', amountCents: 15300, currency: 'usd', provider: 'stripe', providerRef: 'in_acct', paymentRef: null, livemode: false, occurredAt: '2026-01-01T00:00:00.000Z' }, new Date());
    const s = await summaryOf('solo');
    expect(s.account).toEqual([{ coverage: { state: 'own', planKey: 'group_license', status: 'active', expiresAt: expect.any(String), statusSince: expect.any(String), endsAtPeriodEnd: false }, actions: { manage: true }, receipts: [expect.objectContaining({ kind: 'purchase', amountCents: 15300, hasReceipt: true })], legacyNoHistory: false }]);
    expect((await summaryOf('other')).account).toEqual([]);
    // An ended account row is not a card.
    await db.applyEntitlement({ subjectKind: 'account', subjectId: 'solo', planKey: 'group_license', status: 'expired', provider: 'stripe', providerRef: 'sub_acct', customerRef: 'cus_acct', expiresAt: null }, new Date());
    expect((await summaryOf('solo')).account).toEqual([]);
  });

  it('account cards: each plan with its own receipts; past due is a card; no history on an active Stripe row is legacyNoHistory', async () => {
    const acct = (planKey: 'group_license' | 'family_lifetime', status: 'active' | 'past_due') =>
      db.applyEntitlement({ subjectKind: 'account', subjectId: 'solo', planKey, status, provider: 'stripe', providerRef: `sub_${planKey}`, customerRef: 'cus_acct', expiresAt: future() }, new Date());
    await acct('group_license', 'past_due');
    await acct('family_lifetime', 'active');
    await db.recordBillingEvent({ subjectKind: 'account', subjectId: 'solo', planKey: 'group_license', kind: 'failed', amountCents: 15300, currency: 'usd', provider: 'stripe', providerRef: 'in_lic', paymentRef: null, livemode: false, occurredAt: '2026-01-01T00:00:00.000Z' }, new Date());
    const cards = (await summaryOf('solo')).account;
    expect(cards).toHaveLength(2);
    const lic = cards.find((c) => c.coverage.state === 'own' && c.coverage.planKey === 'group_license');
    const fam = cards.find((c) => c.coverage.state === 'own' && c.coverage.planKey === 'family_lifetime');
    expect(lic).toMatchObject({ coverage: { status: 'past_due' }, legacyNoHistory: false });
    expect(lic?.receipts.map((r) => r.planKey)).toEqual(['group_license']);
    expect(fam).toMatchObject({ receipts: [], legacyNoHistory: true });
  });

  it('sends billing.summary_viewed with counts and the mode, but not for a poll', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const other = await createSpace('dad', 'family', 'Lee family');
    await addAdult(other, 'mom', 'caregiver');
    expect(fam).toBeTruthy();
    await summaryOf('mom');
    expect(billingEvents()).toEqual([{ name: 'billing.summary_viewed', payload: { cards: 2, payerCards: 1, mode: 'test' } }]);
    store.reset();
    await summaryOf('mom', '?poll=1');
    expect(billingEvents()).toEqual([]);
  });

  it('keeps the D1 statement count flat however many spaces and classes the account holds (Workers Free: 50 per invocation)', async () => {
    const put = async (id: string, kind: 'family' | 'class' | 'school', owner: string, parent: string | null = null) => {
      await db.putAccount({ id: owner, email: null, displayName: null, consent: null, createdAt: new Date().toISOString() });
      await db.putSpace({ id, kind, name: id, parentSpaceId: parent, ownerAccountId: owner, joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: new Date().toISOString() });
      await db.addMembership({ spaceId: id, memberKind: 'account', memberId: owner, role: 'owner', joinedAt: new Date().toISOString() });
    };
    /** A school with `classes` classes, each with its own teacher and two learners, plus a teacher who owns `classes` classes of their own. */
    const world = async (tag: string, classes: number) => {
      const sch = `space:sch-${tag}`;
      await put(sch, 'school', `principal-${tag}`);
      await entitle(sch, { planKey: 'group_license' });
      await history(sch, { planKey: 'group_license' });
      for (let i = 0; i < classes; i += 1) {
        await put(`space:${tag}-c${i}`, 'class', `t-${tag}-${i}`, sch);
        await addLearners(`space:${tag}-c${i}`, 2);
        await put(`space:${tag}-own${i}`, 'class', `solo-${tag}`);
        await entitle(`space:${tag}-own${i}`, { planKey: 'group_license' });
        await history(`space:${tag}-own${i}`, { planKey: 'group_license' });
      }
    };
    await world('small', 1);
    await world('large', 45);
    const { setFallbackDb, fallbackDb } = await import('../db');
    const original = fallbackDb();
    const count = async (user: string) => {
      await summaryOf(user); // the first-sign-in upsert is not part of the budget
      const watched = watching(original);
      setFallbackDb(watched.db);
      try {
        return { summary: await summaryOf(user), calls: watched.calls.length };
      } finally {
        setFallbackDb(original);
      }
    };
    const small = await count('principal-small');
    const large = await count('principal-large');
    expect(cardOf(large.summary, 'space:sch-large').usage).toEqual({ learners: 90, learnerCap: SCHOOL_LICENSE_STUDENTS, teachers: 45, teacherCap: SCHOOL_LICENSE_TEACHERS });
    expect(cardOf(large.summary, 'space:sch-large').receipts).toHaveLength(1);
    expect(large.calls).toBe(small.calls);
    expect(large.calls).toBeLessThanOrEqual(10);
    const soloSmall = await count('solo-small');
    const soloLarge = await count('solo-large');
    expect(soloLarge.summary.cards).toHaveLength(45);
    expect(soloLarge.summary.cards.every((c) => c.payer && c.receipts.length === 1 && c.coverage.state === 'own')).toBe(true);
    expect(soloLarge.calls).toBe(soloSmall.calls);
    expect(soloLarge.calls).toBeLessThanOrEqual(10);
  });

  it('reads only (no Db write besides the first-sign-in upsert) and makes no outbound call', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await entitle(fam);
    await history(fam);
    const watched = watching(db);
    const { setFallbackDb, fallbackDb } = await import('../db');
    const original = fallbackDb();
    setFallbackDb(watched.db);
    const outbound = vi.spyOn(globalThis, 'fetch');
    try {
      await summaryOf('mom');
      expect((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(fam)}`, bearer('mom'))).status).toBe(200);
      expect(outbound).not.toHaveBeenCalled();
    } finally {
      outbound.mockRestore();
      setFallbackDb(original);
    }
    expect(watched.calls).toContain('membershipsOf'); // the proxy saw the route
    const writes = watched.calls.filter((n) => /^(put|add|apply|record|remove|delete|set|update|upsert|archive)/i.test(n));
    expect(writes).toEqual([]);
    expect(stripe).not.toHaveBeenCalled();
  });
});

describe('GET /api/billing/receipts (payers only, OD-8)', () => {
  it('lists up to 50 rows newest first for the owner and a school admin, with no Stripe call', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    for (let i = 0; i < RECEIPTS_PAGE_LIMIT + 5; i += 1) await history(fam);
    const r = await call('GET', `/api/billing/receipts?id=${encodeURIComponent(fam)}`, bearer('mom'));
    expect(r.status).toBe(200);
    const data = r.body.data as { spaceName: string; receipts: unknown[] };
    expect(data.spaceName).toBe('Kim family');
    expect(data.receipts).toHaveLength(RECEIPTS_PAGE_LIMIT);
    const rows = data.receipts.map((x) => ReceiptViewSchema.strict().parse(x));
    expect(rows.map((x) => x.occurredAt)).toEqual([...rows.map((x) => x.occurredAt)].sort().reverse());
    expect(stripe).not.toHaveBeenCalled();
    expect(billingEvents()).toEqual([{ name: 'billing.receipts_viewed', payload: { rows: RECEIPTS_PAGE_LIMIT } }]);

    const sch = await createSpace('principal', 'school', 'Maple School');
    await addAdult(sch, 'vice', 'admin');
    await history(sch, { planKey: 'group_license' });
    expect(((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(sch)}`, bearer('vice'))).body.data as { receipts: unknown[] }).receipts).toHaveLength(1);
  });

  it('refuses a caregiver, a teacher and a stranger with 403, an unknown space with 404, a missing id with 422', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await addAdult(fam, 'dad', 'caregiver');
    const cls = await createSpace('teacher', 'class', 'Room 4');
    await addAdult(cls, 'co', 'teacher');
    expect((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(fam)}`, bearer('dad'))).status).toBe(403);
    expect((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(cls)}`, bearer('co'))).status).toBe(403);
    expect((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(fam)}`, bearer('stranger'))).status).toBe(403);
    expect((await call('GET', '/api/billing/receipts?id=space%3Anope', bearer('mom'))).status).toBe(404);
    expect((await call('GET', '/api/billing/receipts', bearer('mom'))).status).toBe(422);
    expect((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(fam)}`, json)).status).toBe(401);
    expect(billingEvents()).toEqual([]);
  });

  it('marks which rows have a Stripe receipt: invoices, payment intents and refunds, never a free session', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await history(fam, { providerRef: 'in_a' });
    await history(fam, { providerRef: 'pi_b', paymentRef: null });
    await history(fam, { kind: 'refund', providerRef: 'ch_c:refund:500', amountCents: 500 });
    await history(fam, { providerRef: 'cs_free', amountCents: 0, paymentRef: null });
    await history(fam, { kind: 'refund', providerRef: ':refund:5', amountCents: 5 });
    await history(fam, { provider: 'manual', providerRef: 'in_manual' });
    const rows = ((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(fam)}`, bearer('mom'))).body.data as { receipts: Array<{ hasReceipt: boolean; amountCents: number }> }).receipts;
    expect(rows.map((r) => r.hasReceipt)).toEqual([false, false, false, true, true, true]);
  });

  it('a row of the other Stripe mode has no View receipt: test rows under a live key, live rows under a test key, none without a key', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await history(fam, { providerRef: 'in_live', livemode: true });
    await history(fam, { providerRef: 'in_test', livemode: false });
    const flags = async (env: Record<string, string>) =>
      ((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(fam)}`, bearer('mom'), undefined, env)).body.data as { receipts: Array<{ hasReceipt: boolean; livemode: boolean }> }).receipts.map((r) => [r.livemode, r.hasReceipt]);
    expect(await flags(TEST_ENV)).toEqual([[false, true], [true, false]]);
    expect(await flags({ STRIPE_SECRET_KEY: 'sk_live_x', BILLING_LIVE_ALLOWED: 'true' })).toEqual([[false, false], [true, true]]);
    expect(await flags({})).toEqual([[false, false], [true, false]]);
    // The summary's inline rows say the same.
    expect(cardOf(await summaryOf('mom'), fam).receipts.map((r) => [r.livemode, r.hasReceipt])).toEqual([[false, true], [true, false]]);
  });
});

describe('POST /api/billing/receipt-link (fresh from Stripe, never stored)', () => {
  const stripeAnswers = (body: Record<string, unknown>, status = 200) => vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(body), { status }));

  it('each row kind calls the right Stripe path and returns only { url }', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const invoice = await history(fam, { providerRef: 'in_123' });
    const legacy = await history(fam, { providerRef: 'pi_456', paymentRef: null });
    const refund = await history(fam, { kind: 'refund', providerRef: 'ch_789:refund:500', amountCents: 500 });

    stripe = stripeAnswers({ id: 'in_123', hosted_invoice_url: 'https://invoice.stripe.com/i/1' });
    setReceiptFetchForTests(stripe);
    const a = await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: invoice.id });
    expect(a).toMatchObject({ status: 200, body: { data: { url: 'https://invoice.stripe.com/i/1' } } });
    expect(String(stripe.mock.calls[0]?.[0])).toBe('https://api.stripe.com/v1/invoices/in_123');
    expect((stripe.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sk_test_x' });

    stripe = stripeAnswers({ id: 'pi_456', latest_charge: { id: 'ch_1', receipt_url: 'https://pay.stripe.com/receipts/1' } });
    setReceiptFetchForTests(stripe);
    expect((await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: legacy.id })).body.data).toEqual({ url: 'https://pay.stripe.com/receipts/1' });
    expect(String(stripe.mock.calls[0]?.[0])).toBe('https://api.stripe.com/v1/payment_intents/pi_456?expand%5B%5D=latest_charge');

    stripe = stripeAnswers({ id: 'ch_789', receipt_url: 'https://pay.stripe.com/receipts/2' });
    setReceiptFetchForTests(stripe);
    expect((await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: refund.id })).body.data).toEqual({ url: 'https://pay.stripe.com/receipts/2' });
    expect(String(stripe.mock.calls[0]?.[0])).toBe('https://api.stripe.com/v1/charges/ch_789');

    // Nothing is written: the stored rows are unchanged and hold no URL.
    const stored = await db.billingEventsFor('space', fam, 10);
    expect(JSON.stringify(stored)).not.toContain('https://');
    expect(billingEvents()).toEqual([]);
  });

  it('answers 502 receipt_unavailable on any Stripe trouble', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const invoice = await history(fam, { providerRef: 'in_123' });
    for (const f of [
      stripeAnswers({ error: { message: 'no' } }, 404),
      stripeAnswers({ id: 'in_123' }),
      stripeAnswers({ id: 'in_123', hosted_invoice_url: 42 }),
      vi.fn<typeof fetch>().mockRejectedValue(new Error('network')),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('not json', { status: 200 })),
    ]) {
      setReceiptFetchForTests(f);
      const r = await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: invoice.id });
      expect([r.status, r.body.error?.code]).toEqual([502, 'receipt_unavailable']);
    }
    const legacy = await history(fam, { providerRef: 'pi_9', paymentRef: null });
    setReceiptFetchForTests(stripeAnswers({ id: 'pi_9', latest_charge: 'ch_not_expanded' }));
    expect((await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: legacy.id })).status).toBe(502);
  });

  it('payers only: 403 for a caregiver or a stranger, 404 for an unknown row or one with no receipt, 422 for a bad id', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await addAdult(fam, 'dad', 'caregiver');
    const invoice = await history(fam);
    const free = await history(fam, { providerRef: 'cs_free', amountCents: 0 });
    expect((await call('POST', '/api/billing/receipt-link', bearer('dad'), { id: invoice.id })).status).toBe(403);
    expect((await call('POST', '/api/billing/receipt-link', bearer('stranger'), { id: invoice.id })).status).toBe(403);
    expect((await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: 'bev:nope' })).status).toBe(404);
    const none = await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: free.id });
    expect([none.status, none.body.error?.code]).toEqual([404, 'no_receipt']);
    expect((await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: 'in_123' })).status).toBe(422);
    expect((await call('POST', '/api/billing/receipt-link', bearer('mom'), 'nope')).status).toBe(422);
    expect((await call('POST', '/api/billing/receipt-link', json, { id: invoice.id })).status).toBe(401);
    expect(stripe).not.toHaveBeenCalled();
  });

  it('a row of a space that no longer exists is 404; an account row is its own account only', async () => {
    const orphan = await db.recordBillingEvent({ subjectKind: 'space', subjectId: 'space:gone', planKey: 'family_lifetime', kind: 'purchase', amountCents: 1530, currency: 'usd', provider: 'stripe', providerRef: 'in_gone', paymentRef: null, livemode: false, occurredAt: '2026-01-01T00:00:00.000Z' }, new Date());
    expect((await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: orphan.id })).status).toBe(404);
    const mine = await db.recordBillingEvent({ subjectKind: 'account', subjectId: 'solo', planKey: 'group_license', kind: 'purchase', amountCents: 15300, currency: 'usd', provider: 'stripe', providerRef: 'in_solo', paymentRef: null, livemode: false, occurredAt: '2026-01-01T00:00:00.000Z' }, new Date());
    expect((await call('POST', '/api/billing/receipt-link', bearer('other'), { id: mine.id })).status).toBe(403);
    setReceiptFetchForTests(stripeAnswers({ id: 'in_solo', hosted_invoice_url: 'https://invoice.stripe.com/i/solo' }));
    expect((await call('POST', '/api/billing/receipt-link', bearer('solo'), { id: mine.id })).body.data).toEqual({ url: 'https://invoice.stripe.com/i/solo' });
  });

  it('live guard and configuration: 503 live_not_enabled with a live key, 503 not_configured with none', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const invoice = await history(fam);
    const live = await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: invoice.id }, { STRIPE_SECRET_KEY: 'sk_live_x' });
    expect([live.status, live.body.error?.code]).toEqual([503, 'live_not_enabled']);
    const none = await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: invoice.id }, {});
    expect([none.status, none.body.error?.code]).toEqual([503, 'not_configured']);
    expect(stripe).not.toHaveBeenCalled();
    const liveRow = await history(fam, { providerRef: 'in_live', livemode: true });
    setReceiptFetchForTests(stripeAnswers({ hosted_invoice_url: 'https://invoice.stripe.com/i/live' }));
    expect((await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: liveRow.id }, { STRIPE_SECRET_KEY: 'sk_live_x', BILLING_LIVE_ALLOWED: 'true' })).status).toBe(200);
  });

  it('answers 404 other_mode, without asking Stripe, for a row of the other mode', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const sandbox = await history(fam, { providerRef: 'in_test', livemode: false });
    const live = await history(fam, { providerRef: 'in_live', livemode: true });
    const underLive = await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: sandbox.id }, { STRIPE_SECRET_KEY: 'sk_live_x', BILLING_LIVE_ALLOWED: 'true' });
    expect([underLive.status, underLive.body.error?.code]).toEqual([404, 'other_mode']);
    const underTest = await call('POST', '/api/billing/receipt-link', bearer('mom'), { id: live.id });
    expect([underTest.status, underTest.body.error?.code]).toEqual([404, 'other_mode']);
    expect(stripe).not.toHaveBeenCalled();
  });

  describe('step-up (section 4.4) with real Clerk session tokens', () => {
    let keys: ClerkTestKeys;
    beforeAll(async () => {
      keys = await clerkTestKeys();
    });
    const env = () => ({ ...TEST_ENV, ENVIRONMENT: 'test', CLERK_JWT_KEY: keys.jwtKey });
    const signedIn = async (sub: string, claims: Record<string, unknown>) => ({ ...json, authorization: `Bearer ${await keys.token(sub, claims)}` });

    it('answers the Clerk hint when fva is old or absent, after the payer check, before Stripe', async () => {
      const r = await call('POST', '/api/spaces', await signedIn('user_mom', { fva: [0, -1] }), { kind: 'family', name: 'Kim family' }, env());
      const fam = (r.body.data as { space: { id: string } }).space.id;
      const invoice = await history(fam);
      for (const claims of [{ fva: [11, -1] }, {}]) {
        const res = await app.request('/api/billing/receipt-link', { method: 'POST', headers: await signedIn('user_mom', claims), body: JSON.stringify({ id: invoice.id }) }, env());
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ clerk_error: { type: 'forbidden', reason: 'reverification-error' }, error: { code: 'reverify_required' } });
      }
      // A stranger with a stale sign-in learns nothing more than "forbidden".
      const stranger = await call('POST', '/api/billing/receipt-link', await signedIn('user_x', { fva: [99, -1] }), { id: invoice.id }, env());
      expect([stranger.status, stranger.body.error?.code]).toEqual([403, 'forbidden']);
      expect(stripe).not.toHaveBeenCalled();
      setReceiptFetchForTests(stripeAnswers({ hosted_invoice_url: 'https://invoice.stripe.com/i/fresh' }));
      expect((await call('POST', '/api/billing/receipt-link', await signedIn('user_mom', { fva: [4, -1] }), { id: invoice.id }, env())).body.data).toEqual({ url: 'https://invoice.stripe.com/i/fresh' });
    });

    it('the summary and the receipts list need no step-up (dates and amounts only)', async () => {
      const headers = await signedIn('user_mom', { fva: [500, -1] });
      const r = await call('POST', '/api/spaces', headers, { kind: 'family', name: 'Kim family' }, env());
      const fam = (r.body.data as { space: { id: string } }).space.id;
      await history(fam);
      expect((await call('GET', '/api/billing/summary', headers, undefined, env())).status).toBe(200);
      const list = await call('GET', `/api/billing/receipts?id=${encodeURIComponent(fam)}`, headers, undefined, env());
      expect(list.status).toBe(200);
      expect((list.body.data as { receipts: unknown[] }).receipts).toHaveLength(1);
    });
  });
});
