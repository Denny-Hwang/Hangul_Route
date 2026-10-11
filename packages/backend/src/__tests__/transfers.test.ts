import {
  ACCEPTED_CONSENT_TEXT_VERSIONS,
  TRANSFER_CODE_FAILS_PER_DAY,
  TRANSFER_CODE_FAILS_PER_HOUR,
  TRANSFER_CONSENT_TEXT_VERSION,
  TRANSFER_MAX_CREATED_PER_ACCOUNT_PER_DAY,
  TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY,
  TRANSFER_MAX_OPEN_PER_DESTINATION,
  type Space,
} from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transferRateKey, type StoredTransfer } from '../db';
import app from '../index';
import { newRequest } from '../lib/transfer';
import { TRANSFER_CLIENT_LIMIT, transferClientLimiter } from '../routes/transfers';
import { testDb as db } from './helpers/db';

/*
 * Class transfer routes without execution — F-SPACE-002 section 4.4, PR T-5a:
 * preview, create, list, decline, cancel and the guardian's prefs switch, the
 * lock, the failed-code counter and the create limits. Runs in memory and,
 * with HR_TEST_DB=sqlite, against migration 0005 through the shim.
 */

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const ON = { CLASS_TRANSFER: 'enabled' };

/** `LOCKED` sends no Worker vars at all (the production default). */
const LOCKED = 'locked' as const;
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env: Record<string, string> | typeof LOCKED = ON) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env === LOCKED ? undefined : env);
  return { status: res.status, body: (await res.json()) as Envelope };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-10-11T12:00:00.000Z');
const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();
const ahead = (ms: number): string => new Date(NOW.getTime() + ms).toISOString();
const OLD = ago(30 * DAY);

const A = 'space:class-a';
const B = 'space:class-b';
const C = 'space:class-c';
const E = 'space:class-e';
const FAMILY = 'space:family';
const FAMILY2 = 'space:family-two';
const SCHOOL = 'space:school';
const SUNI = 'profile:suni';
const MINA = 'profile:mina';
const CODE_B = 'BBBBBB';
const CODE_C = 'CCCCCC';
const CODE_E = 'EEEEEE';
const CODE_FAMILY = 'FFFFFF';
const CODE_A = 'AAAAAA';

const space = (id: string, kind: Space['kind'], owner: string, over: Partial<Space> = {}): Space => ({
  id,
  kind,
  name: over.name ?? `${id.slice(6)} name`,
  parentSpaceId: null,
  ownerAccountId: owner,
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: OLD,
  ...over,
});

async function member(spaceId: string, kind: 'account' | 'learner', memberId: string, role: 'owner' | 'teacher' | 'caregiver' | 'admin' | 'student', joinedAt = OLD) {
  await db.addMembership({ spaceId, memberKind: kind, memberId, role, joinedAt });
}

/**
 * teacher-a owns class A (Suni is in it), teacher-b owns class B (live code
 * BBBBBB), teacher-c owns C (CCCCCC) and E (expired EEEEEE); mom owns the
 * family (Suni and Mina), dad is a caregiver of it; aunt owns a second family
 * with Mina only. Every membership is 30 days old.
 */
async function seed() {
  for (const [id, name] of [
    ['teacher-a', 'Mr Han'],
    ['teacher-b', 'Ms Park'],
    ['teacher-c', null],
    ['mom', 'Mom'],
    ['dad', null],
    ['aunt', null],
    ['admin', null],
    ['stranger', null],
  ] as const) {
    await db.putAccount({ id, email: `${id}@example.test`, displayName: name, consent: null, createdAt: OLD });
  }
  await db.putSpace(space(A, 'class', 'teacher-a', { name: 'Sunday Class A', joinCode: CODE_A, joinCodeExpiresAt: ahead(20 * DAY) }));
  await db.putSpace(space(B, 'class', 'teacher-b', { name: 'Saturday Class B', joinCode: CODE_B, joinCodeExpiresAt: ahead(20 * DAY), createdAt: ago(90 * DAY) }));
  await db.putSpace(space(C, 'class', 'teacher-c', { joinCode: CODE_C, joinCodeExpiresAt: ahead(20 * DAY) }));
  await db.putSpace(space(E, 'class', 'teacher-c', { joinCode: CODE_E, joinCodeExpiresAt: ago(DAY) }));
  await db.putSpace(space(FAMILY, 'family', 'mom', { name: 'Kim family', joinCode: CODE_FAMILY, joinCodeExpiresAt: ahead(20 * DAY) }));
  await db.putSpace(space(FAMILY2, 'family', 'aunt'));
  await member(A, 'account', 'teacher-a', 'owner');
  await member(B, 'account', 'teacher-b', 'owner');
  await member(C, 'account', 'teacher-c', 'owner');
  await member(E, 'account', 'teacher-c', 'owner');
  await member(FAMILY, 'account', 'mom', 'owner');
  await member(FAMILY, 'account', 'dad', 'caregiver');
  await member(FAMILY2, 'account', 'aunt', 'owner');
  for (const [id, name] of [
    [SUNI, 'Suni Kim'],
    [MINA, 'Mina Kim'],
  ] as const) {
    await db.putLearner({ id, displayName: name, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
  }
  await member(A, 'learner', SUNI, 'student');
  await member(FAMILY, 'learner', SUNI, 'student');
  await member(FAMILY, 'learner', MINA, 'student');
  await member(FAMILY2, 'learner', MINA, 'student');
}

const base = (spaceId: string) => `/api/spaces/${spaceId}/transfer-requests`;
const preview = (spaceId: string, user: string, body: Record<string, unknown>) => call('POST', `${base(spaceId)}/preview`, bearer(user), body);
const create = (spaceId: string, user: string, body: Record<string, unknown>) => call('POST', base(spaceId), bearer(user), body);
const list = (spaceId: string, user: string) => call('GET', base(spaceId), bearer(user));
const decline = (spaceId: string, user: string, tid: string, body: Record<string, unknown>) => call('POST', `${base(spaceId)}/${tid}/decline`, bearer(user), body);
const cancel = (spaceId: string, user: string, tid: string, body: Record<string, unknown> = {}) => call('POST', `${base(spaceId)}/${tid}/cancel`, bearer(user), body);
const prefs = (spaceId: string, learnerId: string, user: string, body: Record<string, unknown>) => call('PUT', `/api/spaces/${spaceId}/learners/${learnerId}/transfer-prefs`, bearer(user), body);

const consent = { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' };
const familyCreate = (over: Record<string, unknown> = {}) => ({ learnerId: SUNI, fromSpaceId: A, destinationSpaceId: B, code: CODE_B, consent, ...over });
const classCreate = (over: Record<string, unknown> = {}) => ({ learnerId: SUNI, destinationSpaceId: B, code: CODE_B, ...over });

type View = Record<string, unknown> & { id: string; status: string };
const requestOf = (r: { body: Envelope }): View => (r.body.data as { request: View }).request;
const requestsOf = (r: { body: Envelope }): View[] => (r.body.data as { requests: View[] }).requests;

async function stored(): Promise<StoredTransfer[]> {
  return db.transfersOfLearner(SUNI);
}

/** A request row created `createdAgo` before now, straight through the Db (for limits, cooldowns and purge). */
async function seedRow(input: { id: string; learnerId?: string; initiator: 'learner_side' | 'source'; account?: string; dest?: string; createdAgo: number }) {
  const at = new Date(NOW.getTime() - input.createdAgo);
  const common = { id: input.id, learnerId: input.learnerId ?? SUNI, sourceSpaceId: A, destSpaceId: input.dest ?? B, introduce: false, now: at };
  const row =
    input.initiator === 'source'
      ? newRequest({ ...common, initiator: 'source', initiatorAccountId: input.account ?? 'teacher-a', via: 'owner' })
      : newRequest({
          ...common,
          initiator: 'learner_side',
          initiatorAccountId: input.account ?? 'mom',
          consent: {
            basis: 'caregiver',
            attest: null,
            evidence: input.account ?? 'mom',
            role: 'owner',
            textVersion: TRANSFER_CONSENT_TEXT_VERSION,
            locale: 'en',
            shown: { lineIds: ['moving'], flags: {} },
            terms: { destNameHash: 'a'.repeat(64), destConsentMode: 'parent', destAnonymize: false, destOwnerId: 'teacher-b', sourceNameHash: 'b'.repeat(64), premiumChange: 'none' },
          },
        });
  expect(await db.createTransfer(row, { at: row.createdAt, actorKind: 'account', actorRef: input.account ?? null, event: 'created', slot: null, detail: null })).toBe('created');
  return row;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await db.reset();
  transferClientLimiter.reset();
  await seed();
});
afterEach(() => vi.useRealTimers());

describe('the release lock (T15)', () => {
  it('every route answers 422 transfers_locked while CLASS_TRANSFER is unset, before auth or body checks', async () => {
    const tid = 'transfer:00000000-0000-4000-8000-000000000000';
    const routes: Array<[string, string]> = [
      ['POST', `${base(A)}/preview`],
      ['POST', base(A)],
      ['GET', base(A)],
      ['POST', `${base(A)}/${tid}/decline`],
      ['POST', `${base(A)}/${tid}/cancel`],
      ['PUT', `/api/spaces/${FAMILY}/learners/${SUNI}/transfer-prefs`],
    ];
    for (const [method, path] of routes) {
      for (const env of [LOCKED, { CLASS_TRANSFER: 'true' }, { CLASS_TRANSFER_DEVICE_CONSENT: 'enabled' }] as Array<Record<string, string> | typeof LOCKED>) {
        const r = await call(method, path, json, method === 'GET' ? undefined : { junk: 1 }, env);
        expect(r.status, `${method} ${path}`).toBe(422);
        expect(r.body.error?.code).toBe('transfers_locked');
      }
    }
    expect(await stored()).toEqual([]);
  });

  it('a signed-out caller gets 401 once the lock is open', async () => {
    expect((await call('POST', `${base(A)}/preview`, json, { learnerId: SUNI, code: CODE_B })).status).toBe(401);
    expect((await call('GET', base(A), json)).status).toBe(401);
  });
});

describe('preview (writes nothing)', () => {
  it('a source-class manager gets the destination id, kind and name only', async () => {
    const r = await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_B.toLowerCase() });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ destination: { id: B, kind: 'class', name: 'Saturday Class B' } });
    expect(await stored()).toEqual([]);
    expect(await db.countRateHits(transferRateKey.codeAccount('teacher-a'), new Date(0))).toBe(0);
  });

  it('a guardian gets what the consent sheet needs, from live values', async () => {
    await db.addMembership({ spaceId: B, memberKind: 'learner', memberId: MINA, role: 'student', joinedAt: OLD });
    const r = await preview(FAMILY, 'mom', { learnerId: SUNI, code: CODE_B, fromSpaceId: A });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({
      destination: { id: B, kind: 'class', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 1 },
      premiumChange: 'none',
      destinationConsentMode: 'parent',
      relinkAffected: false,
      sourcePlansAffected: false,
      visibleToday: expect.arrayContaining([
        { kind: 'class', name: 'Sunday Class A', ownerName: 'Mr Han' },
        { kind: 'family', name: 'Kim family', ownerName: 'Mom' },
      ]),
    });
    expect((r.body.data as { visibleToday: unknown[] }).visibleToday).toHaveLength(2);
    // never an email
    expect(JSON.stringify(r.body)).not.toContain('@example.test');
    expect(await stored()).toEqual([]);
  });

  it('flags a source re-link device, a source plan, a premium change and a school above the destination', async () => {
    await db.putSpace(space(SCHOOL, 'school', 'admin', { name: 'Hana School' }));
    await db.putSpace(space(B, 'class', 'teacher-b', { name: 'Saturday Class B', joinCode: CODE_B, joinCodeExpiresAt: ahead(20 * DAY), parentSpaceId: SCHOOL, settings: { consentMode: 'school', anonymizeRoster: true } }));
    await db.applyEntitlement({ subjectKind: 'space', subjectId: A, planKey: 'group_license', status: 'active', provider: 'manual', expiresAt: ahead(300 * DAY) }, NOW);
    await db.putDevice({ learnerId: SUNI, deviceId: 'tablet-1', secretHash: 'x', scope: 'class', createdAt: OLD, lastSeenAt: OLD });
    await db.putRelink({ id: 'relink:1', spaceId: A, learnerId: SUNI, deviceId: 'tablet-1', platform: null, requestedAt: OLD, expiresAt: OLD, status: 'approved', decidedAt: OLD, secret: null });
    await db.putPlan({ id: 'plan:1', spaceId: A, authorAccountId: 'teacher-a', title: 'Week 1', items: [], targetLearnerIds: null, publishedAt: OLD, archivedAt: null, createdAt: OLD, updatedAt: OLD, meta: null });
    const r = await preview(FAMILY, 'mom', { learnerId: SUNI, code: CODE_B, fromSpaceId: A });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      destination: { schoolName: 'Hana School' },
      premiumChange: 'may_change',
      destinationConsentMode: 'school',
      relinkAffected: true,
      sourcePlansAffected: true,
    });
  });

  it('counts every failed code durably and brakes at 10 an hour, even for a valid code (behaviour 19)', async () => {
    const bad = [
      [{ learnerId: SUNI, code: 'O0O0' }, 422, 'invalid_code'],
      [{ learnerId: SUNI, code: 'ZZZZZZ' }, 404, 'code_not_found'],
      [{ learnerId: SUNI, code: CODE_E }, 404, 'code_expired'],
    ] as const;
    for (const [body, status, code] of bad) {
      const r = await preview(A, 'teacher-a', body);
      expect(r.status, code).toBe(status);
      expect(r.body.error?.code).toBe(code);
    }
    expect(await db.countRateHits(transferRateKey.codeAccount('teacher-a'), new Date(0))).toBe(3);
    for (let i = 3; i < TRANSFER_CODE_FAILS_PER_HOUR; i += 1) expect((await preview(A, 'teacher-a', { learnerId: SUNI, code: 'ZZZZZZ' })).status).toBe(404);
    const braked = await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_B });
    expect(braked.status).toBe(429);
    expect(braked.body.error).toMatchObject({ code: 'too_many_attempts', details: { retryAfterSeconds: expect.any(Number) } });
    // another account is not braked
    await member(A, 'account', 'teacher-c', 'teacher');
    expect((await preview(A, 'teacher-c', { learnerId: SUNI, code: CODE_B })).status).toBe(200);
  });

  it('brakes at 30 failed codes a day across hours', async () => {
    for (let i = 0; i < TRANSFER_CODE_FAILS_PER_DAY; i += 1) await db.recordRateHit(transferRateKey.codeAccount('teacher-a'), new Date(NOW.getTime() - 2 * HOUR - i * 10 * 60 * 1000));
    const r = await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_B });
    expect(r.status).toBe(429);
    expect(r.body.error?.code).toBe('too_many_attempts');
  });

  it('has a per-client in-memory limiter on preview and create', async () => {
    const headers = { ...bearer('teacher-a'), 'cf-connecting-ip': '203.0.113.9' };
    for (let i = 0; i < TRANSFER_CLIENT_LIMIT; i += 1) expect((await call('POST', `${base(A)}/preview`, headers, { learnerId: SUNI, code: CODE_B })).status).toBe(200);
    const r = await call('POST', base(A), headers, classCreate());
    expect(r.status).toBe(429);
    expect(r.body.error?.code).toBe('too_many_attempts');
  });

  it('guard 2: a caller not entitled to the learner learns nothing about the destination and spends no code attempt', async () => {
    for (const [spaceId, user, body] of [
      [A, 'stranger', { learnerId: SUNI, code: CODE_B }],
      [B, 'teacher-b', { learnerId: SUNI, code: CODE_C }],
      [A, 'teacher-a', { learnerId: MINA, code: CODE_B }],
      [FAMILY, 'stranger', { learnerId: SUNI, code: CODE_B, fromSpaceId: A }],
      [FAMILY2, 'aunt', { learnerId: SUNI, code: CODE_B, fromSpaceId: A }],
      [FAMILY, 'mom', { learnerId: SUNI, code: CODE_B, fromSpaceId: C }],
      ['space:nope', 'teacher-a', { learnerId: SUNI, code: CODE_B }],
    ] as const) {
      const r = await preview(spaceId, user, body);
      expect(r.status, `${spaceId} ${user}`).toBe(404);
      expect(r.body.error?.code).toBe('not_found');
    }
    // a wrong code from a stranger is not counted either
    expect((await preview(A, 'stranger', { learnerId: SUNI, code: 'ZZZZZZ' })).status).toBe(404);
    expect(await db.countRateHits(transferRateKey.codeAccount('stranger'), new Date(0))).toBe(0);
  });

  it('a school admin may act for a child class through the cascade; a school itself is never an acting space', async () => {
    await db.putSpace(space(SCHOOL, 'school', 'admin'));
    await db.putSpace(space(A, 'class', 'teacher-a', { name: 'Sunday Class A', parentSpaceId: SCHOOL }));
    await member(SCHOOL, 'account', 'admin', 'owner');
    expect((await preview(A, 'admin', { learnerId: SUNI, code: CODE_B })).status).toBe(200);
    expect((await preview(SCHOOL, 'admin', { learnerId: SUNI, code: CODE_B })).status).toBe(404);
  });

  it('refuses destinations that are not a live class, the source itself, or a class the learner is already in', async () => {
    const r1 = await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_FAMILY });
    expect([r1.status, r1.body.error?.code]).toEqual([422, 'not_transferable']);
    const r2 = await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_A });
    expect([r2.status, r2.body.error?.code]).toEqual([409, 'same_space']);
    await db.addMembership({ spaceId: B, memberKind: 'learner', memberId: SUNI, role: 'student', joinedAt: OLD });
    const r3 = await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_B });
    expect([r3.status, r3.body.error?.code]).toEqual([409, 'already_member']);
    await db.putSpace({ ...space(C, 'class', 'teacher-c', { joinCode: CODE_C, joinCodeExpiresAt: ahead(DAY) }), archivedAt: ago(HOUR) });
    const r4 = await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_C });
    expect([r4.status, r4.body.error?.code]).toEqual([404, 'code_not_found']);
  });

  it('capacity is advisory up front: a full destination answers 409 cap_class', async () => {
    for (let i = 0; i < 20; i += 1) {
      const id = `profile:filler-${i}`;
      await db.putLearner({ id, displayName: `F ${i}`, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
      await member(B, 'learner', id, 'student');
    }
    const r = await preview(FAMILY, 'mom', { learnerId: SUNI, code: CODE_B, fromSpaceId: A });
    expect([r.status, r.body.error?.code]).toEqual([409, 'cap_class']);
  });

  it(`answers 409 destination_busy at ${TRANSFER_MAX_OPEN_PER_DESTINATION} open requests to one class`, async () => {
    for (let i = 0; i < TRANSFER_MAX_OPEN_PER_DESTINATION; i += 1) {
      const id = `profile:busy-${i}`;
      await db.putLearner({ id, displayName: `B ${i}`, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
      await member(A, 'learner', id, 'student');
      await seedRow({ id: `transfer:busy-${i}`, learnerId: id, initiator: 'source', createdAgo: HOUR });
    }
    const r = await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_B });
    expect([r.status, r.body.error?.code]).toEqual([409, 'destination_busy']);
  });

  it('rejects bad bodies: unknown keys, a family field on a class route, a missing source on the family route', async () => {
    for (const [spaceId, user, body] of [
      [A, 'teacher-a', { learnerId: SUNI, code: CODE_B, extra: true }],
      [A, 'teacher-a', { learnerId: SUNI, code: CODE_B, fromSpaceId: A }],
      [FAMILY, 'mom', { learnerId: SUNI, code: CODE_B }],
      [A, 'teacher-a', { learnerId: 'not an id', code: CODE_B }],
    ] as const) {
      const r = await preview(spaceId, user, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      expect(r.body.error?.code).toBe('bad_request');
    }
    expect((await call('POST', `${base(A)}/preview`, bearer('teacher-a'), 'not json')).status).toBe(422);
  });
});

describe('who may start: the matrix of section 4.2', () => {
  it('a teacher cannot send for a learner whose family switched teacher requests off, who manages their own classes, or who refused one in the last 30 days — one neutral answer (behaviour 22)', async () => {
    await db.setTransferPref(SUNI, 'blockTeacherRequests', true, NOW);
    const r1 = await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_B });
    expect([r1.status, r1.body.error?.code]).toEqual([422, 'cannot_send']);
    await db.setTransferPref(SUNI, 'blockTeacherRequests', false, NOW);
    await db.setTransferPref(SUNI, 'selfManaged', true, NOW);
    expect((await create(A, 'teacher-a', classCreate())).body.error?.code).toBe('cannot_send');
    await db.setTransferPref(SUNI, 'selfManaged', false, NOW);
    const refused = await seedRow({ id: 'transfer:refused', initiator: 'source', dest: C, createdAgo: 10 * DAY });
    await db.declineSlot(refused.id, 'learner', 'declined_learner', 'family', new Date(NOW.getTime() - 9 * DAY));
    const r3 = await create(A, 'teacher-a', classCreate());
    expect(r3.body.error).toEqual({ code: 'cannot_send', message: r1.body.error && (r1.body.error as { message?: string }).message });
  });

  it('a teacher-started request needs a family with a caregiver account (422 family_needed)', async () => {
    await db.removeMembership(FAMILY, 'learner', SUNI);
    const r = await create(A, 'teacher-a', classCreate());
    expect([r.status, r.body.error?.code]).toEqual([422, 'family_needed']);
  });

  it('the caregiver route refuses a learner who manages their own classes (409 learner_manages_own)', async () => {
    await db.setTransferPref(SUNI, 'selfManaged', true, NOW);
    const r = await preview(FAMILY, 'mom', { learnerId: SUNI, code: CODE_B, fromSpaceId: A });
    expect([r.status, r.body.error?.code]).toEqual([409, 'learner_manages_own']);
  });

  it('guard 9b: a family set up moments ago does not count (behaviour 5, day one)', async () => {
    await db.removeMembership(FAMILY, 'account', 'dad');
    await member(FAMILY, 'account', 'dad', 'caregiver', ago(HOUR));
    await db.removeMembership(FAMILY, 'account', 'mom');
    await member(FAMILY, 'account', 'mom', 'owner', ago(HOUR));
    const r = await create(FAMILY, 'dad', familyCreate());
    expect([r.status, r.body.error?.code]).toEqual([422, 'family_too_new']);
  });

  it('guard 9c: a teacher of the source who joined the family as caregiver is refused (behaviour 5, after a day)', async () => {
    await member(FAMILY, 'account', 'teacher-a', 'caregiver');
    const r = await create(FAMILY, 'teacher-a', familyCreate());
    expect([r.status, r.body.error?.code]).toEqual([409, 'conflicted_guardian']);
  });

  it('a source that is not a live class is not transferable', async () => {
    await db.putSpace({ ...space(A, 'class', 'teacher-a', { name: 'Sunday Class A' }), archivedAt: ago(HOUR) });
    const r = await preview(FAMILY, 'mom', { learnerId: SUNI, code: CODE_B, fromSpaceId: A });
    expect([r.status, r.body.error?.code]).toEqual([422, 'not_transferable']);
    // an archived class is not an acting space either
    expect((await preview(A, 'teacher-a', { learnerId: SUNI, code: CODE_B })).status).toBe(404);
  });
});

describe('create', () => {
  it('a guardian creates with the consent sheet: learner slot consented on the caregiver basis, cooling-off set (behaviour 1)', async () => {
    const r = await create(FAMILY, 'mom', familyCreate({ introduce: true }));
    expect(r.status).toBe(201);
    const view = requestOf(r);
    expect(view).toMatchObject({
      role: 'learner_side',
      status: 'requested',
      initiator: 'learner_side',
      learner: { id: SUNI, name: 'Suni Kim' },
      from: { spaceId: A, name: 'Sunday Class A' },
      to: { spaceId: B, name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 0 },
      learnerState: 'consented',
      sourceState: 'waiting',
      destinationState: 'waiting',
      introduce: true,
      learnerRoute: 'caregiver',
      endedFrom: null,
      executeAfter: ahead(48 * HOUR),
      expiresAt: ahead(14 * DAY),
    });
    expect(view.id).toMatch(/^transfer:[a-z0-9-]+$/);
    const [row] = await stored();
    expect(row).toMatchObject({
      id: view.id,
      initiator: 'learner_side',
      initiatorAccountId: 'mom',
      sourceSpaceId: A,
      destSpaceId: B,
      introduce: true,
      learner: { state: 'consented', basis: 'caregiver', attest: null, evidence: 'mom', role: 'owner', textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' },
      source: { state: 'pending' },
      destination: { state: 'pending' },
    });
    expect(row?.learner.shown?.lineIds).toEqual(['moving', 'new_teacher', 'old_teacher', 'keeps', 'cooling_off', 'visible_list', 'nothing_else', 'visible_today', 'typed_names', 'cannot_undo', 'introduce']);
    expect(row?.learner.terms).toMatchObject({ destConsentMode: 'parent', destAnonymize: false, destOwnerId: 'teacher-b', premiumChange: 'none', destNameHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await db.transferEvents(view.id)).toEqual([expect.objectContaining({ event: 'created', actorKind: 'account', actorRef: 'mom', slot: 'learner' })]);
    // no name is copied into the row
    expect(JSON.stringify(row)).not.toContain('Suni');
    expect(JSON.stringify(row)).not.toContain('Saturday');
  });

  it('a lost 201 is safe to repeat: the same caller gets 200 and the same request (behaviour 24); another caller gets already_open', async () => {
    const first = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const again = await create(FAMILY, 'mom', familyCreate());
    expect(again.status).toBe(200);
    expect(requestOf(again).id).toBe(first.id);
    const other = await create(FAMILY, 'dad', familyCreate());
    expect(other.status).toBe(409);
    expect(other.body.error).toMatchObject({ code: 'already_open', details: { startedBy: 'learner_side' } });
    const teacher = await create(A, 'teacher-a', classCreate());
    expect(teacher.status).toBe(409);
    expect(teacher.body.error?.code).toBe('already_open');
    expect(teacher.body.error?.details).toBeUndefined();
    expect(await stored()).toHaveLength(1);
  });

  it('a source manager creates: source slot consented by the owner, learner slot pending; the family is told the open one came from the class', async () => {
    const r = await create(A, 'teacher-a', classCreate());
    expect(r.status).toBe(201);
    expect(requestOf(r)).toMatchObject({
      role: 'source',
      status: 'requested',
      initiator: 'source',
      learnerId: SUNI,
      learner: { name: 'Suni Kim', avatar: 'hoya-orange' },
      destination: { spaceId: B, name: 'Saturday Class B' },
      steps: { learner: 'waiting', source: 'yes', destination: 'waiting' },
      scheduledFor: null,
    });
    const [row] = await stored();
    expect(row).toMatchObject({ initiator: 'source', initiatorAccountId: 'teacher-a', learner: { state: 'pending' }, source: { state: 'consented', accountId: 'teacher-a', via: 'owner' }, executeAfter: null });
    const fam = await create(FAMILY, 'mom', familyCreate());
    expect(fam.body.error).toMatchObject({ code: 'already_open', details: { startedBy: 'class' } });
  });

  it('checks the consent record: required on the family route, refused on the class route, stale text and unreviewed locale', async () => {
    const missing = await create(FAMILY, 'mom', familyCreate({ consent: undefined }));
    expect([missing.status, missing.body.error?.code]).toEqual([422, 'bad_request']);
    const onClass = await create(A, 'teacher-a', classCreate({ consent }));
    expect([onClass.status, onClass.body.error?.code]).toEqual([422, 'bad_request']);
    const stale = await create(FAMILY, 'mom', familyCreate({ consent: { textVersion: 'transfer-2020-01', locale: 'en' } }));
    expect(stale.status).toBe(422);
    expect(stale.body.error).toMatchObject({ code: 'consent_text_stale', details: { current: TRANSFER_CONSENT_TEXT_VERSION } });
    expect(ACCEPTED_CONSENT_TEXT_VERSIONS).toContain(TRANSFER_CONSENT_TEXT_VERSION);
    const locale = await create(FAMILY, 'mom', familyCreate({ consent: { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'ko' } }));
    expect([locale.status, locale.body.error?.code]).toEqual([422, 'consent_locale_unavailable']);
    const extra = await create(FAMILY, 'mom', familyCreate({ consent: { ...consent, attest: 'self' } }));
    expect([extra.status, extra.body.error?.code]).toEqual([422, 'bad_request']);
    expect(await stored()).toEqual([]);
  });

  it('the code must still resolve to the class that was previewed (409 destination_changed)', async () => {
    const r = await create(FAMILY, 'mom', familyCreate({ destinationSpaceId: C }));
    expect([r.status, r.body.error?.code]).toEqual([409, 'destination_changed']);
    const wrong = await create(A, 'teacher-a', classCreate({ code: 'ZZZZZZ' }));
    expect([wrong.status, wrong.body.error?.code]).toEqual([404, 'code_not_found']);
    expect(await db.countRateHits(transferRateKey.codeAccount('teacher-a'), new Date(0))).toBe(1);
  });

  it(`limits creates to ${TRANSFER_MAX_CREATED_PER_ACCOUNT_PER_DAY} per account and ${TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY} per learner a day (429 too_many_requests)`, async () => {
    for (let i = 0; i < TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY; i += 1) {
      const row = await seedRow({ id: `transfer:day-${i}`, initiator: 'learner_side', dest: C, account: 'dad', createdAgo: (i + 1) * HOUR });
      await db.cancelTransfer(row.id, 'withdrawn_learner', 'family', new Date(NOW.getTime() - HOUR / 2));
    }
    const perLearner = await create(FAMILY, 'mom', familyCreate());
    expect(perLearner.status).toBe(429);
    expect(perLearner.body.error).toMatchObject({ code: 'too_many_requests', details: { retryAfterSeconds: expect.any(Number) } });

    await db.reset();
    await seed();
    for (let i = 0; i < TRANSFER_MAX_CREATED_PER_ACCOUNT_PER_DAY; i += 1) {
      const id = `profile:acct-${i}`;
      await db.putLearner({ id, displayName: `L ${i}`, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
      await member(A, 'learner', id, 'student');
      const row = await seedRow({ id: `transfer:acct-${i}`, learnerId: id, initiator: 'source', dest: C, createdAgo: (i + 1) * HOUR });
      await db.cancelTransfer(row.id, 'cancelled_initiator', 'source', new Date(NOW.getTime() - HOUR / 4));
    }
    const perAccount = await create(A, 'teacher-a', classCreate());
    expect([perAccount.status, perAccount.body.error?.code]).toEqual([429, 'too_many_requests']);
  });

  it('a learner-side request another side declined puts that destination in a 7-day cooldown; a withdrawal does not', async () => {
    const declined = await seedRow({ id: 'transfer:declined', initiator: 'learner_side', createdAgo: 3 * DAY });
    await db.declineSlot(declined.id, 'destination', 'declined_destination', 'destination', new Date(NOW.getTime() - DAY));
    const r = await create(FAMILY, 'mom', familyCreate());
    expect(r.status).toBe(429);
    expect(r.body.error?.code).toBe('cooldown');
    const retry = r.body.error?.details?.retryAfterSeconds as number;
    expect(retry).toBeGreaterThan(5 * 24 * 3600);
    expect(retry).toBeLessThanOrEqual(6 * 24 * 3600);
    // another destination is fine
    expect((await create(FAMILY, 'mom', familyCreate({ destinationSpaceId: C, code: CODE_C }))).status).toBe(201);
  });

  it('purges old ended rows and old counters on create only, never on a read', async () => {
    const old = await seedRow({ id: 'transfer:old', initiator: 'learner_side', dest: C, createdAgo: 120 * DAY });
    await db.cancelTransfer(old.id, 'withdrawn_learner', 'family', new Date(NOW.getTime() - 100 * DAY));
    await db.recordRateHit(transferRateKey.codeAccount('mom'), new Date(NOW.getTime() - 3 * DAY));
    await list(FAMILY, 'mom');
    expect(await db.getTransfer(old.id)).not.toBeNull();
    expect((await create(FAMILY, 'mom', familyCreate())).status).toBe(201);
    expect(await db.getTransfer(old.id)).toBeNull();
    expect(await db.countRateHits(transferRateKey.codeAccount('mom'), new Date(0))).toBe(0);
  });
});

describe('list and views', () => {
  it('the source sees its card; the destination sees nothing until the learner side consented (behaviour 3)', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    const src = await list(A, 'teacher-a');
    expect(src.status).toBe(200);
    expect(requestsOf(src)).toEqual([expect.objectContaining({ id: created.id, role: 'source', learnerId: SUNI })]);
    expect(requestsOf(await list(B, 'teacher-b'))).toEqual([]);
    const fam = requestsOf(await list(FAMILY, 'mom'));
    expect(fam).toEqual([expect.objectContaining({ id: created.id, role: 'learner_side', initiator: 'source', learnerState: 'pending', sourceState: 'yes' })]);
  });

  it('the destination card shows initials, picture and level only — never the name or the learner id (behaviour 18)', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const r = await list(B, 'teacher-b');
    const [card] = requestsOf(r);
    expect(card).toMatchObject({ id: created.id, role: 'destination', status: 'requested', learner: { name: 'S. K.', avatar: 'hoya-orange', level: '8-9' }, comingFrom: null, steps: { learner: 'yes', source: 'waiting', destination: 'waiting' } });
    const text = JSON.stringify(r.body);
    expect(text).not.toContain('Suni');
    expect(text).not.toContain(SUNI);
    expect(text).not.toContain('Sunday Class A');
    // a learner-side request without "introduce" does not name the destination to the source
    const [srcCard] = requestsOf(await list(A, 'teacher-a'));
    expect(srcCard).toMatchObject({ role: 'source', initiator: 'learner_side', learnerId: null, destination: null, learner: { name: 'Suni Kim' } });
  });

  it('introduce names the source to the destination and the destination to the source', async () => {
    await create(FAMILY, 'mom', familyCreate({ introduce: true }));
    expect(requestsOf(await list(B, 'teacher-b'))[0]).toMatchObject({ comingFrom: { name: 'Sunday Class A' } });
    expect(requestsOf(await list(A, 'teacher-a'))[0]).toMatchObject({ destination: { spaceId: B, name: 'Saturday Class B' } });
  });

  it('the family list carries options (its own learners and their live classes) and the two switches', async () => {
    await db.setTransferPref(MINA, 'selfManaged', true, NOW);
    await db.setTransferPref(SUNI, 'blockTeacherRequests', true, NOW);
    const r = await list(FAMILY, 'dad');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({
      requests: [],
      options: expect.arrayContaining([
        { learnerId: SUNI, name: 'Suni Kim', classes: [{ spaceId: A, name: 'Sunday Class A' }], selfManaged: false, blockTeacherRequests: true },
        { learnerId: MINA, name: 'Mina Kim', classes: [], selfManaged: true, blockTeacherRequests: false },
      ]),
    });
    expect((await list(FAMILY, 'stranger')).status).toBe(404);
    expect((await list(FAMILY, 'teacher-a')).status).toBe(404);
  });

  it('a school sees counts of waiting moves per child class, nothing else', async () => {
    await db.putSpace(space(SCHOOL, 'school', 'admin'));
    await member(SCHOOL, 'account', 'admin', 'owner');
    await db.putSpace(space(A, 'class', 'teacher-a', { name: 'Sunday Class A', parentSpaceId: SCHOOL }));
    await db.putSpace(space(B, 'class', 'teacher-b', { name: 'Saturday Class B', parentSpaceId: SCHOOL, joinCode: CODE_B, joinCodeExpiresAt: ahead(20 * DAY) }));
    await create(FAMILY, 'mom', familyCreate());
    const r = await list(SCHOOL, 'admin');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ requests: [], counts: expect.arrayContaining([{ spaceId: A, waiting: 1 }, { spaceId: B, waiting: 1 }]) });
    expect(JSON.stringify(r.body)).not.toContain('Suni');
    expect((await list(SCHOOL, 'teacher-a')).status).toBe(404);
  });

  it('settles before listing: an expired request reads as ended, an archived destination cancels it', async () => {
    const row = await seedRow({ id: 'transfer:stale', initiator: 'learner_side', createdAgo: 15 * DAY });
    const [card] = requestsOf(await list(FAMILY, 'mom'));
    expect(card).toMatchObject({ id: row.id, status: 'ended', endedFrom: null });
    expect((await db.getTransfer(row.id))?.status).toBe('expired');

    const live = requestOf(await create(FAMILY, 'mom', familyCreate({ destinationSpaceId: C, code: CODE_C })));
    await db.putSpace({ ...space(C, 'class', 'teacher-c', { joinCode: CODE_C, joinCodeExpiresAt: ahead(DAY) }), archivedAt: ago(HOUR) });
    await list(A, 'teacher-a');
    expect(await db.getTransfer(live.id)).toMatchObject({ status: 'cancelled', endReason: 'destination_archived' });
  });

  it('settle does nothing while the lock is closed (rollback is instant)', async () => {
    const row = await seedRow({ id: 'transfer:frozen', initiator: 'learner_side', createdAgo: 15 * DAY });
    expect((await call('GET', base(FAMILY), bearer('mom'), undefined, LOCKED)).status).toBe(422);
    expect((await db.getTransfer(row.id))?.status).toBe('requested');
  });

  it('builds views with set-based reads: 20 source rows cost a bounded number of Db calls', async () => {
    for (let i = 0; i < 20; i += 1) {
      const id = `profile:row-${i}`;
      await db.putLearner({ id, displayName: `Row ${i}`, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
      await member(A, 'learner', id, 'student');
      const row = await seedRow({ id: `transfer:row-${i}`, learnerId: id, initiator: 'source', createdAgo: (i + 1) * HOUR });
      await db.cancelTransfer(row.id, 'cancelled_initiator', 'source', new Date(NOW.getTime() - 10 * 60 * 1000));
    }
    const calls = { n: 0 };
    const spy = new Proxy(db, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver) as unknown;
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          calls.n += 1;
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    });
    const { setFallbackDb, fallbackDb } = await import('../db');
    const before = fallbackDb();
    setFallbackDb(spy);
    try {
      const r = await list(A, 'teacher-a');
      expect(requestsOf(r)).toHaveLength(20);
    } finally {
      setFallbackDb(before);
    }
    expect(calls.n).toBeLessThan(20);
  });
});

describe('decline', () => {
  it('the destination says "no room": the request ends; nobody else learns who or why (behaviour 7)', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const r = await decline(B, 'teacher-b', created.id, { slot: 'destination', reason: 'no_room' });
    expect(r.status).toBe(200);
    expect(requestOf(r)).toMatchObject({ status: 'ended', endedByYou: true, endReason: 'declined_destination', endedAt: NOW.toISOString(), steps: null });
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'declined', endReason: 'declined_destination', endActor: 'destination' });
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'declined', slot: 'destination', actorRef: 'teacher-b', detail: { reason: 'no_room' } }));

    const [src] = requestsOf(await list(A, 'teacher-a'));
    expect(src).toMatchObject({ status: 'ended', endedByYou: false, endReason: null, learner: null, steps: null });
    const [fam] = requestsOf(await list(FAMILY, 'mom'));
    expect(fam).toMatchObject({ status: 'ended', endedFrom: null, sourceState: 'waiting', destinationState: 'waiting' });
    expect(JSON.stringify(fam)).not.toContain('declined');
    expect(JSON.stringify(src)).not.toContain('declined');
    // the decider keeps its own history
    expect(requestsOf(await list(B, 'teacher-b'))[0]).toMatchObject({ endedByYou: true, endReason: 'declined_destination' });
    // deciding again on an ended request
    const again = await decline(B, 'teacher-b', created.id, { slot: 'destination' });
    expect([again.status, again.body.error?.code]).toEqual([409, 'not_open']);
  });

  it('the source says not now on a family request; a guardian declines a teacher request', async () => {
    const fam = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const r1 = await decline(A, 'teacher-a', fam.id, { slot: 'source', reason: undefined });
    expect(r1.status).toBe(200);
    expect(await db.getTransfer(fam.id)).toMatchObject({ status: 'declined', endReason: 'declined_source', endActor: 'source' });

    await db.reset();
    await seed();
    const teacher = requestOf(await create(A, 'teacher-a', classCreate()));
    const r2 = await decline(FAMILY, 'dad', teacher.id, { slot: 'learner' });
    expect(r2.status).toBe(200);
    expect(requestOf(r2)).toMatchObject({ role: 'learner_side', status: 'ended', endedFrom: 'family' });
    expect(await db.getTransfer(teacher.id)).toMatchObject({ status: 'declined', endReason: 'declined_learner', endActor: 'family' });
    // the 30-day rule now stops a new teacher request
    expect((await create(A, 'teacher-a', classCreate())).body.error?.code).toBe('cannot_send');
  });

  it('IDOR: only the slot owner of this request can decline; everyone else gets 404', async () => {
    const fam = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const cases: Array<[string, string, Record<string, unknown>]> = [
      [B, 'teacher-b', { slot: 'source' }], // class B on slot source
      [A, 'teacher-a', { slot: 'destination' }],
      [A, 'teacher-a', { slot: 'learner' }],
      [C, 'teacher-c', { slot: 'destination' }], // foreign :id
      [FAMILY, 'mom', { slot: 'source' }], // a guardian cannot fill a class slot
      [FAMILY2, 'aunt', { slot: 'learner' }], // a guardian of another learner
      [FAMILY, 'stranger', { slot: 'learner' }],
      [A, 'stranger', { slot: 'source' }],
    ];
    for (const [spaceId, user, body] of cases) {
      const r = await decline(spaceId, user, fam.id, body);
      expect(r.status, `${spaceId} ${user} ${JSON.stringify(body)}`).toBe(404);
    }
    expect((await decline(A, 'teacher-a', 'transfer:unknown', { slot: 'source' })).status).toBe(404);
    expect((await db.getTransfer(fam.id))?.status).toBe('requested');
  });

  it('the destination cannot see or decline a request before the learner side consented', async () => {
    const teacher = requestOf(await create(A, 'teacher-a', classCreate()));
    expect((await decline(B, 'teacher-b', teacher.id, { slot: 'destination' })).status).toBe(404);
  });

  it('a reason only on the destination slot; an expired request answers 409 expired', async () => {
    const fam = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const r = await decline(A, 'teacher-a', fam.id, { slot: 'source', reason: 'no_room' });
    expect([r.status, r.body.error?.code]).toEqual([422, 'bad_request']);
    vi.setSystemTime(new Date(NOW.getTime() + 15 * DAY));
    const late = await decline(A, 'teacher-a', fam.id, { slot: 'source' });
    expect([late.status, late.body.error?.code]).toEqual([409, 'expired']);
  });
});

describe('cancel', () => {
  it('the starting class cancels its own request; it cannot cancel a family request', async () => {
    const teacher = requestOf(await create(A, 'teacher-a', classCreate()));
    const r = await cancel(A, 'teacher-a', teacher.id);
    expect(r.status).toBe(200);
    expect(requestOf(r)).toMatchObject({ role: 'source', status: 'ended', endedByYou: true, endReason: 'cancelled_initiator' });
    expect(await db.getTransfer(teacher.id)).toMatchObject({ status: 'cancelled', endReason: 'cancelled_initiator', endActor: 'source' });
    expect(await db.transferEvents(teacher.id)).toContainEqual(expect.objectContaining({ event: 'cancelled', actorRef: 'teacher-a' }));

    const fam = requestOf(await create(FAMILY, 'mom', familyCreate({ destinationSpaceId: C, code: CODE_C })));
    expect((await cancel(A, 'teacher-a', fam.id)).status).toBe(404);
    expect((await cancel(C, 'teacher-c', fam.id)).status).toBe(404);
  });

  it('any guardian of the learner can cancel any request, even one who could not consent (veto needs guard 9a only)', async () => {
    await db.removeMembership(FAMILY, 'account', 'dad');
    await member(FAMILY, 'account', 'dad', 'caregiver', ago(HOUR));
    const teacher = requestOf(await create(A, 'teacher-a', classCreate()));
    const r = await cancel(FAMILY, 'dad', teacher.id);
    expect(r.status).toBe(200);
    expect(requestOf(r)).toMatchObject({ status: 'ended', endedFrom: 'family' });
    expect(await db.getTransfer(teacher.id)).toMatchObject({ status: 'cancelled', endReason: 'withdrawn_learner', endActor: 'family' });
    const again = await cancel(FAMILY, 'dad', teacher.id);
    expect([again.status, again.body.error?.code]).toEqual([409, 'not_open']);
  });

  it('a second guardian cancels the first one\'s request; a guardian of another learner cannot; the body must be empty', async () => {
    const fam = requestOf(await create(FAMILY, 'mom', familyCreate()));
    expect((await cancel(FAMILY2, 'aunt', fam.id)).status).toBe(404);
    expect((await cancel(FAMILY, 'dad', fam.id, { reason: 'x' })).status).toBe(422);
    expect((await cancel(FAMILY, 'dad', fam.id)).status).toBe(200);
    expect(await db.getTransfer(fam.id)).toMatchObject({ status: 'cancelled', endReason: 'withdrawn_learner' });
  });
});

describe('transfer prefs (guardian switch)', () => {
  it('a guardian turns teacher requests off and on; nobody else can', async () => {
    const r = await prefs(FAMILY, SUNI, 'dad', { blockTeacherRequests: true });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ prefs: { blockTeacherRequests: true, selfManaged: false } });
    expect((await db.getTransferPrefs(SUNI)).blockTeacherRequests).toBe(true);
    for (const [spaceId, learnerId, user] of [
      [FAMILY, SUNI, 'stranger'],
      [FAMILY, SUNI, 'teacher-a'],
      [A, SUNI, 'teacher-a'],
      [FAMILY2, SUNI, 'aunt'],
      [FAMILY, 'profile:nobody', 'mom'],
    ] as const) {
      expect((await prefs(spaceId, learnerId, user, { blockTeacherRequests: false })).status, `${spaceId} ${user}`).toBe(404);
    }
    expect((await prefs(FAMILY, SUNI, 'mom', { selfManaged: true })).status).toBe(422);
    expect((await prefs(FAMILY, SUNI, 'mom', { blockTeacherRequests: false })).body.data).toEqual({ prefs: { blockTeacherRequests: false, selfManaged: false } });
  });
});
