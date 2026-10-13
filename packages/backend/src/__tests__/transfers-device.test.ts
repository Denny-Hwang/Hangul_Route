import { SyncInboxSchema, TRANSFER_CONSENT_TEXT_VERSION, TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY, TRANSFER_MAX_OPEN_PER_DESTINATION } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transferRateKey, type Db } from '../db';
import { hashSecret } from '../lib/device-auth';
import { DEVICE_TRANSFER_LIMIT as DEVICE_LIMIT, deviceTransferLimiter } from '../routes/transfer-device';
import { transferClientLimiter } from '../routes/transfers';
import app from '../index';
import { testDb as db } from './helpers/db';
import {
  A,
  approve,
  B,
  CODE_A,
  CODE_B,
  CODE_C,
  CODE_E,
  C,
  CODE_FAMILY,
  classCreate,
  countDbCalls,
  create,
  DAY,
  decline,
  FAMILY,
  familyCreate,
  filler,
  HOUR,
  member,
  NOW,
  OLD,
  requestOf,
  seed,
  seedRow,
  space,
  SUNI,
  type Envelope,
} from './helpers/transfer-world';

/*
 * Class transfer, the learner's device and the inbox — F-SPACE-002 sections
 * 4.2 (guards 8, 10, 11, 13), 4.4 (device routes, inbox fields) and 4.14
 * (behaviours 9, 10, 11, 13, 20, 21), PR T-5c. The device routes sit behind
 * `CLASS_TRANSFER`; create and approve also behind
 * `CLASS_TRANSFER_DEVICE_CONSENT` (decision A4, flip gate G6). Runs in memory
 * and, with HR_TEST_DB=sqlite, against migration 0005 through the shim.
 */

const ON = { CLASS_TRANSFER: 'enabled' };
const DEVICE_ON = { CLASS_TRANSFER: 'enabled', CLASS_TRANSFER_DEVICE_CONSENT: 'enabled' };
type Env = Record<string, string> | 'locked';

/** Jun is in class A only: no family, so no caregiver route (the device route may answer for him). */
const JUN = 'profile:jun';
const PHONE = 'device-phone001';
const PHONE_SECRET = 'phone-secret';
const TABLET = 'device-tablet01';
const TABLET_SECRET = 'tablet-secret';
const JUN_PHONE = 'device-junphone';
const JUN_SECRET = 'jun-secret';

const deviceHeader = (deviceId: string, secret: string): Record<string, string> => ({ 'content-type': 'application/json', authorization: `Device ${deviceId}:${secret}` });
const suniPhone = deviceHeader(PHONE, PHONE_SECRET);
const suniTablet = deviceHeader(TABLET, TABLET_SECRET);
const junPhone = deviceHeader(JUN_PHONE, JUN_SECRET);

async function dcall(method: string, path: string, headers: Record<string, string>, body?: unknown, env: Env = DEVICE_ON) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env === 'locked' ? undefined : env);
  return { status: res.status, body: (await res.json()) as Envelope };
}

const dbase = (learnerId: string) => `/api/sync/learners/${learnerId}/transfer-requests`;
const dPreview = (learnerId: string, headers: Record<string, string>, body: unknown, env: Env = DEVICE_ON) => dcall('POST', `${dbase(learnerId)}/preview`, headers, body, env);
const dCreate = (learnerId: string, headers: Record<string, string>, body: unknown, env: Env = DEVICE_ON) => dcall('POST', dbase(learnerId), headers, body, env);
const dApprove = (learnerId: string, headers: Record<string, string>, tid: string, body: unknown, env: Env = DEVICE_ON) => dcall('POST', `${dbase(learnerId)}/${tid}/approve`, headers, body, env);
const dDecline = (learnerId: string, headers: Record<string, string>, tid: string, env: Env = DEVICE_ON) => dcall('POST', `${dbase(learnerId)}/${tid}/decline`, headers, {}, env);
const dCancel = (learnerId: string, headers: Record<string, string>, tid: string, env: Env = DEVICE_ON) => dcall('POST', `${dbase(learnerId)}/${tid}/cancel`, headers, {}, env);
const dPrefs = (learnerId: string, headers: Record<string, string>, body: unknown, env: Env = DEVICE_ON) => dcall('PUT', `/api/sync/learners/${learnerId}/transfer-prefs`, headers, body, env);
const inbox = (learnerId: string, headers: Record<string, string>, env: Env = DEVICE_ON) => dcall('GET', `/api/sync/learners/${learnerId}/inbox`, headers, undefined, env);

const pinConsent = { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en', attest: 'grown_up_pin' };
const selfConsent = { ...pinConsent, attest: 'self' };
const junCreate = (over: Record<string, unknown> = {}) => ({ fromSpaceId: A, destinationSpaceId: B, code: CODE_B, consent: pinConsent, ...over });

type InboxRow = Record<string, unknown> & { id: string; status: string; to: Record<string, unknown> };
const transfersOf = (r: { body: Envelope }): InboxRow[] => (r.body.data as { transfers: InboxRow[] }).transfers;
const deviceRequest = (r: { body: Envelope }): InboxRow => (r.body.data as { request: InboxRow }).request;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await db.reset();
  transferClientLimiter.reset();
  deviceTransferLimiter.reset();
  await seed();
  await db.putLearner({ id: JUN, displayName: 'Jun Lee', ageGroup: '10-11', avatar: 'hoya-blue', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
  await member(A, 'learner', JUN, 'student');
  await db.putDevice({ learnerId: SUNI, deviceId: PHONE, secretHash: await hashSecret(PHONE_SECRET), scope: 'full', createdAt: OLD, lastSeenAt: OLD });
  await db.putDevice({ learnerId: SUNI, deviceId: TABLET, secretHash: await hashSecret(TABLET_SECRET), scope: 'class', createdAt: OLD, lastSeenAt: OLD });
  await db.putDevice({ learnerId: JUN, deviceId: JUN_PHONE, secretHash: await hashSecret(JUN_SECRET), scope: 'full', createdAt: OLD, lastSeenAt: OLD });
});
afterEach(() => vi.useRealTimers());

const TID = 'transfer:00000000-0000-4000-8000-000000000000';
const DEVICE_ROUTES: Array<[string, string]> = [
  ['POST', `${dbase(SUNI)}/preview`],
  ['POST', dbase(SUNI)],
  ['POST', `${dbase(SUNI)}/${TID}/approve`],
  ['POST', `${dbase(SUNI)}/${TID}/decline`],
  ['POST', `${dbase(SUNI)}/${TID}/cancel`],
  ['PUT', `/api/sync/learners/${SUNI}/transfer-prefs`],
];

describe('the release locks (T15, decision A4)', () => {
  it('every device route answers 422 transfers_locked while CLASS_TRANSFER is unset, before credentials or the body are read', async () => {
    for (const [method, path] of DEVICE_ROUTES) {
      for (const env of ['locked', { CLASS_TRANSFER: 'true' }, { CLASS_TRANSFER_DEVICE_CONSENT: 'enabled' }] as Env[]) {
        const r = await dcall(method, path, { 'content-type': 'application/json' }, { junk: 1 }, env);
        expect([r.status, r.body.error?.code], `${method} ${path}`).toEqual([422, 'transfers_locked']);
      }
    }
  });

  it('device create and approve answer 422 device_consent_locked while CLASS_TRANSFER_DEVICE_CONSENT is unset, before credentials (behaviour 10)', async () => {
    for (const path of [dbase(SUNI), `${dbase(SUNI)}/${TID}/approve`]) {
      for (const env of [ON, { ...ON, CLASS_TRANSFER_DEVICE_CONSENT: 'true' }]) {
        const r = await dcall('POST', path, { 'content-type': 'application/json' }, { junk: 1 }, env);
        expect([r.status, r.body.error?.code], path).toEqual([422, 'device_consent_locked']);
      }
    }
    expect(await db.transfersOfLearner(JUN)).toEqual([]);
  });

  it('preview, decline, cancel, prefs and the inbox work with device consent off (behaviour 10)', async () => {
    expect((await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B }, ON)).status).toBe(200);
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    expect(transfersOf(await inbox(SUNI, suniPhone, ON)).map((t) => t.id)).toEqual([created.id]);
    expect((await dCancel(SUNI, suniPhone, created.id, ON)).status).toBe(200);
    expect((await dPrefs(SUNI, suniPhone, { selfManaged: true }, ON)).status).toBe(200);
    expect((await dPrefs(SUNI, suniPhone, { selfManaged: false }, ON)).status).toBe(200);
    const teacher = requestOf(await create(A, 'teacher-a', classCreate({ learnerId: SUNI })));
    expect((await dDecline(SUNI, suniPhone, teacher.id, ON)).status).toBe(200);
  });

  it('the inbox reads the lock before the transfer tables: locked, it reports everything off and touches no transfer data', async () => {
    await create(FAMILY, 'mom', familyCreate());
    const touched = await transferCalls(async () => {
      const r = await inbox(SUNI, suniPhone, 'locked');
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ transfersEnabled: false, transferDeviceConsent: false, selfManaged: false, transfers: [] });
    });
    expect(touched).toEqual([]);
  });
});

/** The names of the transfer Db methods `fn` calls (the routes read the fallback Db). */
async function transferCalls(fn: () => Promise<void>): Promise<string[]> {
  const names: string[] = [];
  const spy = new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        if (/transfer/i.test(String(prop))) names.push(String(prop));
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as Db;
  const { setFallbackDb, fallbackDb } = await import('../db');
  const before = fallbackDb();
  setFallbackDb(spy);
  try {
    await fn();
  } finally {
    setFallbackDb(before);
  }
  return names;
}

describe('device credentials (guard 8)', () => {
  it('a class-scoped device can neither start, answer, veto nor set the switch: 403 scope_limited', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const answers = [
      await dPreview(SUNI, suniTablet, { fromSpaceId: A, code: CODE_B }),
      await dCreate(SUNI, suniTablet, junCreate()),
      await dApprove(SUNI, suniTablet, created.id, { consent: pinConsent }),
      await dDecline(SUNI, suniTablet, created.id),
      await dCancel(SUNI, suniTablet, created.id),
      await dPrefs(SUNI, suniTablet, { selfManaged: true }),
    ];
    for (const r of answers) expect([r.status, r.body.error?.code]).toEqual([403, 'scope_limited']);
    expect((await db.getTransfer(created.id))?.status).toBe('requested');
  });

  it('the inbox of a class-scoped device carries no transfers and no learner switch', async () => {
    await create(FAMILY, 'mom', familyCreate());
    const r = await inbox(SUNI, suniTablet);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ transfersEnabled: true, transferDeviceConsent: false, selfManaged: false, transfers: [] });
  });

  it('answers 401 without credentials and 403 for a device bound to another learner', async () => {
    expect((await dPreview(SUNI, { 'content-type': 'application/json' }, { fromSpaceId: A, code: CODE_B })).status).toBe(401);
    expect((await dPreview(SUNI, junPhone, { fromSpaceId: A, code: CODE_B })).status).toBe(403);
  });
});

describe('the inbox (section 4.4)', () => {
  it('lists the open request in the learner-side shape the app parses, with no learner name or id beyond the request', async () => {
    await db.setTransferPref(SUNI, 'selfManaged', false, NOW);
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const r = await inbox(SUNI, suniPhone);
    expect(r.body.data).toMatchObject({ transfersEnabled: true, transferDeviceConsent: true, selfManaged: false });
    const [row] = transfersOf(r);
    expect(row).toMatchObject({
      id: created.id,
      status: 'requested',
      initiator: 'learner_side',
      from: { spaceId: A, name: 'Sunday Class A' },
      to: { spaceId: B, name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months' },
      learnerState: 'consented',
      sourceState: 'waiting',
      destinationState: 'waiting',
      introduce: false,
      premiumChange: 'none',
      destinationConsentMode: 'parent',
      relinkAffected: false,
      sourcePlansAffected: false,
      blockReason: null,
      learnerRoute: 'caregiver',
      canVeto: true,
      endedFrom: null,
      // The learner slot is already consented: nothing left to agree to.
      termsDigest: null,
    });
    expect(row.executeAfter).toBe(new Date(NOW.getTime() + 48 * HOUR).toISOString());
    expect(Array.isArray(row.visibleToday)).toBe(true);
    // Exactly the InboxTransferSchema fields: nothing else rides along.
    expect(Object.keys(row).sort()).toEqual(
      [
        'id',
        'status',
        'initiator',
        'from',
        'to',
        'learnerState',
        'sourceState',
        'destinationState',
        'introduce',
        'premiumChange',
        'destinationConsentMode',
        'relinkAffected',
        'sourcePlansAffected',
        'visibleToday',
        'blockReason',
        'executeAfter',
        'expiresAt',
        'learnerRoute',
        'canVeto',
        'endedFrom',
        'termsDigest',
      ].sort(),
    );
    expect(Object.keys(row.to).sort()).toEqual(['ageBucket', 'name', 'ownerName', 'schoolName', 'spaceId']);
    expect(JSON.stringify(row)).not.toContain('Suni');
    // The installed app's schema keeps the row, memberships, plans and tier.
    const parsed = SyncInboxSchema.parse(r.body.data);
    expect(parsed.transfers.map((t) => t.id)).toEqual([created.id]);
    expect(parsed.memberships.length).toBeGreaterThan(0);
  });

  it('a teacher-started request reads initiator source with the learner slot pending; the device may only veto it', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate({ learnerId: SUNI })));
    const [row] = transfersOf(await inbox(SUNI, suniPhone));
    expect(row).toMatchObject({ id: created.id, initiator: 'source', learnerState: 'pending', sourceState: 'yes', learnerRoute: 'caregiver', canVeto: true });
  });

  it('reports the learner switch and the device lock as they are', async () => {
    await db.setTransferPref(SUNI, 'selfManaged', true, NOW);
    expect((await inbox(SUNI, suniPhone, ON)).body.data).toMatchObject({ transfersEnabled: true, transferDeviceConsent: false, selfManaged: true, transfers: [] });
  });

  it('settles before it answers: an expired request reads ended, with no actor', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    vi.setSystemTime(new Date(NOW.getTime() + 15 * DAY));
    const [row] = transfersOf(await inbox(SUNI, suniPhone));
    expect(row).toMatchObject({ id: created.id, status: 'ended', endedFrom: null, sourceState: 'waiting', destinationState: 'waiting', executeAfter: null });
    expect((await db.getTransfer(created.id))?.status).toBe('expired');
  });

  it('an ending by this side reads endedFrom; an ending by a class does not say who', async () => {
    const mine = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await dCancel(SUNI, suniPhone, mine.id);
    expect(transfersOf(await inbox(SUNI, suniPhone))[0]).toMatchObject({ id: mine.id, status: 'ended', endedFrom: 'device' });
    const theirs = requestOf(await create(FAMILY, 'mom', familyCreate()));
    expect((await decline(A, 'teacher-a', theirs.id, { slot: 'source' })).status).toBe(200);
    const row = transfersOf(await inbox(SUNI, suniPhone)).find((t) => t.id === theirs.id);
    expect(row).toMatchObject({ status: 'ended', endedFrom: null, sourceState: 'waiting' });
  });

  it('shows an executed move, so the app can refresh its classes', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    vi.setSystemTime(new Date(NOW.getTime() + 49 * HOUR));
    const r = await inbox(SUNI, suniPhone);
    const [row] = transfersOf(r);
    expect(row).toMatchObject({ id: created.id, status: 'executed' });
    expect(await db.membership(B, 'learner', SUNI)).not.toBeNull();
    // The same answer already carries the new class and not the old one (sections 4.10, 4.12): the move is
    // settled before the memberships, plans and tier are read, so no second inbox round trip is needed.
    const spaces = SyncInboxSchema.parse(r.body.data).memberships.map((m) => m.spaceId);
    expect(spaces).toContain(B);
    expect(spaces).not.toContain(A);
  });

  it('carries the sheet digest while the learner slot is pending, so a device approve is tied to what was shown (4.11)', async () => {
    const created = deviceRequest(await dCreate(JUN, junPhone, junCreate()));
    expect(transfersOf(await inbox(JUN, junPhone))[0]?.termsDigest).toBeNull();
    expect(await db.resetLearnerConsent(created.id, 'terms_changed', NOW)).toBe(1);
    const r0 = await inbox(JUN, junPhone);
    const [row] = transfersOf(r0);
    expect(row?.termsDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(SyncInboxSchema.parse(r0.body.data).transfers[0]?.termsDigest).toBe(row?.termsDigest);
    // The approve recomputes the digest from live values: the one the inbox carried matches.
    const r = await dApprove(JUN, junPhone, created.id, { consent: { ...pinConsent, termsDigest: row?.termsDigest } });
    expect([r.status, deviceRequest(r).learnerState]).toEqual([200, 'consented']);
  });

  it('reads the destination facts set-wise: many ended requests to different classes cost no more reads than one (D1 statement budget)', async () => {
    const endAt = async (id: string, dest: string): Promise<void> => {
      await seedRow({ id, initiator: 'learner_side', dest, createdAgo: 2 * DAY });
      expect(await db.cancelTransfer(id, 'withdrawn_learner', 'family', new Date(NOW.getTime() - DAY))).toBe(1);
    };
    await endAt('transfer:00000000-0000-4000-8000-000000000001', B);
    const one = await countDbCalls(async () => {
      expect(transfersOf(await inbox(SUNI, suniPhone))).toHaveLength(1);
    });
    for (let i = 2; i <= 7; i += 1) {
      const id = `space:class-d${i}`;
      await db.putAccount({ id: `teacher-d${i}`, email: `d${i}@example.test`, displayName: `Teacher ${i}`, consent: null, createdAt: OLD });
      await db.putSpace(space(id, 'class', `teacher-d${i}`, { parentSpaceId: i % 2 === 0 ? null : A }));
      await endAt(`transfer:00000000-0000-4000-8000-00000000000${i}`, id);
    }
    const many = await countDbCalls(async () => {
      const rows = transfersOf(await inbox(SUNI, suniPhone));
      expect(rows).toHaveLength(7);
      expect(rows.find((t) => t.to.spaceId === 'space:class-d2')?.to).toMatchObject({ ownerName: 'Teacher 2', schoolName: null });
    });
    expect(many).toBe(one);
  });
});

describe('device preview (section 4.4)', () => {
  it('answers the learner-side preview for a learner with no caregiver route and writes nothing', async () => {
    const r = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      destination: { id: B, kind: 'class', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 0 },
      premiumChange: 'none',
      destinationConsentMode: 'parent',
      relinkAffected: false,
      sourcePlansAffected: false,
    });
    expect((r.body.data as { termsDigest: string }).termsDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(await db.transfersOfLearner(JUN)).toEqual([]);
  });

  it('a child with a caregiver account is sent to the grown-up: 409 caregiver_required (behaviour 11); a self-managed learner is not', async () => {
    const r = await dPreview(SUNI, suniPhone, { fromSpaceId: A, code: CODE_B });
    expect([r.status, r.body.error?.code]).toEqual([409, 'caregiver_required']);
    await db.setTransferPref(SUNI, 'selfManaged', true, NOW);
    expect((await dPreview(SUNI, suniPhone, { fromSpaceId: A, code: CODE_B })).status).toBe(200);
  });

  it('a source the learner is not in is 404; a family source is not transferable; a bad body is 422', async () => {
    expect((await dPreview(JUN, junPhone, { fromSpaceId: B, code: CODE_B })).status).toBe(404);
    expect((await dPreview(JUN, junPhone, { fromSpaceId: 'space:nowhere', code: CODE_B })).status).toBe(404);
    await member(FAMILY, 'learner', JUN, 'student');
    const fam = await dPreview(JUN, junPhone, { fromSpaceId: FAMILY, code: CODE_B });
    expect([fam.status, fam.body.error?.code]).toEqual([422, 'not_transferable']);
    const extra = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B, learnerId: JUN });
    expect([extra.status, extra.body.error?.code]).toEqual([422, 'bad_request']);
  });

  it('brakes failed codes per learner, durably: the 11th wrong code in an hour answers 429 too_many_attempts', async () => {
    for (let i = 0; i < 10; i += 1) {
      const r = await dPreview(JUN, junPhone, { fromSpaceId: A, code: 'ZZZZZZ' });
      expect(r.body.error?.code).toBe('code_not_found');
      deviceTransferLimiter.reset();
    }
    const braked = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B });
    expect([braked.status, braked.body.error?.code]).toEqual([429, 'too_many_attempts']);
    expect(await db.countRateHits(transferRateKey.codeLearner(JUN), new Date(NOW.getTime() - HOUR))).toBe(10);
    const malformed = await dPreview(SUNI, suniPhone, { fromSpaceId: A, code: 'bad' });
    expect(malformed.body.error?.code).toBe('caregiver_required');
  });

  it('the in-memory limiter allows 10 starts an hour per device', async () => {
    for (let i = 0; i < 10; i += 1) expect((await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B })).status).toBe(200);
    const r = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B });
    expect([r.status, r.body.error?.code]).toEqual([429, 'too_many_attempts']);
  });
});

describe('device create (sections 4.2 guard 10, 4.4)', () => {
  it('creates a learner-side request consented on the device: basis device_attested, the claim recorded, never a guardian', async () => {
    const r = await dCreate(JUN, junPhone, junCreate({ introduce: true }));
    expect(r.status).toBe(201);
    const view = deviceRequest(r);
    expect(view).toMatchObject({ status: 'requested', initiator: 'learner_side', learnerState: 'consented', learnerRoute: 'device', canVeto: true, introduce: true });
    const [row] = await db.transfersOfLearner(JUN);
    expect(row).toMatchObject({ initiator: 'learner_side', initiatorAccountId: null, introduce: true });
    expect(row?.learner).toMatchObject({ state: 'consented', basis: 'device_attested', attest: 'grown_up_pin', evidence: JUN_PHONE, role: null, textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' });
    expect(row?.executeAfter).toBe(new Date(NOW.getTime() + 48 * HOUR).toISOString());
    const events = await db.transferEvents(row?.id ?? '');
    expect(events[0]).toMatchObject({ actorKind: 'device', actorRef: JUN_PHONE, event: 'created', slot: 'learner', detail: { initiator: 'learner_side', basis: 'device_attested', attest: 'grown_up_pin' } });
    expect(await db.countRateHits(transferRateKey.createLearner(JUN), new Date(NOW.getTime() - DAY))).toBe(1);
  });

  it('a retry of a create whose answer was lost comes back even past the per-device limiter; anything else still meets it', async () => {
    for (let i = 0; i < DEVICE_LIMIT - 1; i += 1) expect((await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B })).status).toBe(200);
    const first = await dCreate(JUN, junPhone, junCreate());
    expect(first.status).toBe(201);
    const retry = await dCreate(JUN, junPhone, junCreate());
    expect(retry.status).toBe(200);
    expect(deviceRequest(retry).id).toBe(deviceRequest(first).id);
    const other = await dCreate(JUN, junPhone, junCreate({ destinationSpaceId: C, code: CODE_C }));
    expect([other.status, other.body.error?.code]).toEqual([429, 'too_many_attempts']);
    const look = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B });
    expect([look.status, look.body.error?.code]).toEqual([429, 'too_many_attempts']);
    await db.putDevice({ learnerId: JUN, deviceId: 'device-junother', secretHash: await hashSecret('other'), scope: 'full', createdAt: OLD, lastSeenAt: OLD });
    for (let i = 0; i < DEVICE_LIMIT; i += 1) deviceTransferLimiter.check(`device:${JUN}:device-junother`);
    const notOwn = await dCreate(JUN, deviceHeader('device-junother', 'other'), junCreate());
    expect([notOwn.status, notOwn.body.error?.code]).toEqual([429, 'too_many_attempts']);
  });

  it('is idempotent for the same device; another device of the learner meets already_open', async () => {
    const first = await dCreate(JUN, junPhone, junCreate());
    const again = await dCreate(JUN, junPhone, junCreate());
    expect(again.status).toBe(200);
    expect(deviceRequest(again).id).toBe(deviceRequest(first).id);
    await db.putDevice({ learnerId: JUN, deviceId: 'device-junother', secretHash: await hashSecret('other'), scope: 'full', createdAt: OLD, lastSeenAt: OLD });
    const other = await dCreate(JUN, deviceHeader('device-junother', 'other'), junCreate());
    expect([other.status, other.body.error?.code]).toEqual([409, 'already_open']);
    expect(other.body.error?.details).toMatchObject({ startedBy: 'learner_side' });
  });

  it('checks the consent text, the locale and the sheet the device showed', async () => {
    const stale = await dCreate(JUN, junPhone, junCreate({ consent: { ...pinConsent, textVersion: 'transfer-1999' } }));
    expect([stale.status, stale.body.error?.code, stale.body.error?.details]).toEqual([422, 'consent_text_stale', { current: TRANSFER_CONSENT_TEXT_VERSION }]);
    // Every UI locale has a consent text (T-6d); a locale outside the UI locales is a bad body.
    const locale = await dCreate(JUN, junPhone, junCreate({ consent: { ...pinConsent, locale: 'fr' as never } }));
    expect([locale.status, locale.body.error?.code]).toEqual([422, 'bad_request']);
    const noAttest = await dCreate(JUN, junPhone, junCreate({ consent: { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' } }));
    expect([noAttest.status, noAttest.body.error?.code]).toEqual([422, 'bad_request']);
    const changed = await dCreate(JUN, junPhone, junCreate({ consent: { ...pinConsent, termsDigest: 'f'.repeat(64) } }));
    expect([changed.status, changed.body.error?.code]).toEqual([409, 'terms_changed']);
    const digest = (await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B })).body.data as { termsDigest: string };
    expect((await dCreate(JUN, junPhone, junCreate({ consent: { ...pinConsent, termsDigest: digest.termsDigest } }))).status).toBe(201);
  });

  it('a child with a caregiver account cannot start a move on the device (behaviour 11); a self-managed learner can, attesting self (behaviour 20)', async () => {
    const refused = await dCreate(SUNI, suniPhone, junCreate());
    expect([refused.status, refused.body.error?.code]).toEqual([409, 'caregiver_required']);
    expect((await dPrefs(SUNI, suniPhone, { selfManaged: true })).status).toBe(200);
    const created = await dCreate(SUNI, suniPhone, junCreate({ consent: selfConsent }));
    expect(created.status).toBe(201);
    expect((await db.transfersOfLearner(SUNI))[0]?.learner).toMatchObject({ basis: 'device_attested', attest: 'self', evidence: PHONE });
    // The caregiver route now refuses (learner_manages_own); the family sees the request.
    const family = await create(FAMILY, 'mom', familyCreate());
    expect(family.body.error?.code).toBe('learner_manages_own');
  });

  it('counts device creates per learner, durably: past the daily limit 429 too_many_requests', async () => {
    for (let i = 0; i < TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY; i += 1) await db.recordRateHit(transferRateKey.createLearner(JUN), NOW);
    const r = await dCreate(JUN, junPhone, junCreate());
    expect([r.status, r.body.error?.code]).toEqual([429, 'too_many_requests']);
    expect(await db.transfersOfLearner(JUN)).toEqual([]);
  });

  it('the source and the destination see a device-started request as they see any learner-side one', async () => {
    const created = deviceRequest(await dCreate(JUN, junPhone, junCreate()));
    const src = await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    expect(src.status).toBe(200);
    const dst = await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    // The console helpers run without CLASS_TRANSFER_DEVICE_CONSENT, so the device consent is held: every
    // slot is in, but the request is not promoted until device consent is on (section 4.6 step 5).
    expect(requestOf(dst)).toMatchObject({ role: 'destination', status: 'requested', learner: { name: 'J. L.' }, steps: { learner: 'yes', source: 'yes', destination: 'yes' } });
  });

  it('a device consent is held while device consent is switched off again, and moves once it is on', async () => {
    const created = deviceRequest(await dCreate(JUN, junPhone, junCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    vi.setSystemTime(new Date(NOW.getTime() + 49 * HOUR));
    await inbox(JUN, junPhone, ON);
    expect(await db.membership(A, 'learner', JUN)).not.toBeNull();
    expect(transfersOf(await inbox(JUN, junPhone, DEVICE_ON))[0]).toMatchObject({ status: 'executed' });
    expect(await db.membership(B, 'learner', JUN)).not.toBeNull();
  });
});

describe('device create: the code and destination guards answer as on the console (section 4.2)', () => {
  it('malformed, expired, re-issued, own-class and family codes', async () => {
    const malformed = await dCreate(JUN, junPhone, junCreate({ code: 'bad' }));
    expect([malformed.status, malformed.body.error?.code]).toEqual([422, 'invalid_code']);
    const expired = await dCreate(JUN, junPhone, junCreate({ code: CODE_E }));
    expect([expired.status, expired.body.error?.code]).toEqual([404, 'code_expired']);
    const reissued = await dCreate(JUN, junPhone, junCreate({ destinationSpaceId: 'space:class-c' }));
    expect([reissued.status, reissued.body.error?.code]).toEqual([409, 'destination_changed']);
    const own = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_A });
    expect([own.status, own.body.error?.code]).toEqual([409, 'same_space']);
    const family = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_FAMILY });
    expect([family.status, family.body.error?.code]).toEqual([422, 'not_transferable']);
    expect(await db.countRateHits(transferRateKey.codeLearner(JUN), new Date(NOW.getTime() - HOUR))).toBe(2);
  });

  it('already a member, no room, and the 7-day cooldown after a class said no', async () => {
    await member(B, 'learner', JUN, 'student');
    const there = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B });
    expect([there.status, there.body.error?.code]).toEqual([409, 'already_member']);
    await db.removeMembership(B, 'learner', JUN);
    for (let i = 0; i < 20; i += 1) await filler(`profile:fill-${String(i).padStart(2, '0')}`, B);
    const full = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B });
    expect([full.status, full.body.error?.code]).toEqual([409, 'cap_class']);
    for (let i = 0; i < 20; i += 1) await db.removeMembership(B, 'learner', `profile:fill-${String(i).padStart(2, '0')}`);
    const created = deviceRequest(await dCreate(JUN, junPhone, junCreate()));
    expect((await decline(A, 'teacher-a', created.id, { slot: 'source' })).status).toBe(200);
    const again = await dCreate(JUN, junPhone, junCreate());
    expect([again.status, again.body.error?.code]).toEqual([429, 'cooldown']);
  });
});

describe('device create: a busy destination (section 4.2)', () => {
  it(`preview and create answer 409 destination_busy at ${TRANSFER_MAX_OPEN_PER_DESTINATION} open requests to the class, and write nothing`, async () => {
    for (let i = 0; i < TRANSFER_MAX_OPEN_PER_DESTINATION; i += 1) {
      const id = `profile:busy-${i}`;
      await filler(id);
      await seedRow({ id: `transfer:busy-${i}`, learnerId: id, initiator: 'source', createdAgo: HOUR });
    }
    const shown = await dPreview(JUN, junPhone, { fromSpaceId: A, code: CODE_B });
    expect([shown.status, shown.body.error?.code]).toEqual([409, 'destination_busy']);
    const made = await dCreate(JUN, junPhone, junCreate());
    expect([made.status, made.body.error?.code]).toEqual([409, 'destination_busy']);
    expect(await db.transfersOfLearner(JUN)).toEqual([]);
  });
});

describe('device approve (section 4.4, guard 10)', () => {
  it('cannot answer for a teacher-started request: 409 caregiver_required_for_teacher_request; the device can still decline it (behaviour 9)', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate({ learnerId: SUNI })));
    const r = await dApprove(SUNI, suniPhone, created.id, { consent: pinConsent });
    expect([r.status, r.body.error?.code]).toEqual([409, 'caregiver_required_for_teacher_request']);
    expect((await db.getTransfer(created.id))?.learner.state).toBe('pending');
    const vetoed = await dDecline(SUNI, suniPhone, created.id);
    expect(vetoed.status).toBe(200);
    expect(deviceRequest(vetoed)).toMatchObject({ status: 'ended', endedFrom: 'device' });
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'declined', endReason: 'declined_learner', endActor: 'device' });
  });

  it('answers again for its own request after the consent was reset', async () => {
    const created = deviceRequest(await dCreate(JUN, junPhone, junCreate()));
    expect(await db.resetLearnerConsent(created.id, 'terms_changed', NOW)).toBe(1);
    vi.setSystemTime(new Date(NOW.getTime() + HOUR));
    const r = await dApprove(JUN, junPhone, created.id, { consent: pinConsent });
    expect(r.status).toBe(200);
    expect(deviceRequest(r)).toMatchObject({ learnerState: 'consented' });
    const row = await db.getTransfer(created.id);
    expect(row?.learner).toMatchObject({ state: 'consented', basis: 'device_attested', evidence: JUN_PHONE });
    expect(row?.executeAfter).toBe(new Date(NOW.getTime() + 49 * HOUR).toISOString());
    const events = await db.transferEvents(created.id);
    expect(events.at(-1)).toMatchObject({ actorKind: 'device', actorRef: JUN_PHONE, event: 'consented', slot: 'learner', detail: { basis: 'device_attested', attest: 'grown_up_pin' } });
    // Idempotent once in.
    expect((await dApprove(JUN, junPhone, created.id, { consent: pinConsent })).status).toBe(200);
  });

  it('a reset guardian-started request of a child with a caregiver account goes back to the console: 409 caregiver_required', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    expect(await db.resetLearnerConsent(created.id, 'terms_changed', NOW)).toBe(1);
    const r = await dApprove(SUNI, suniPhone, created.id, { consent: pinConsent });
    expect([r.status, r.body.error?.code]).toEqual([409, 'caregiver_required']);
  });

  it('checks the consent text and the sheet on approve too, and stays idempotent after the move', async () => {
    const created = deviceRequest(await dCreate(JUN, junPhone, junCreate()));
    expect(await db.resetLearnerConsent(created.id, 'terms_changed', NOW)).toBe(1);
    const stale = await dApprove(JUN, junPhone, created.id, { consent: { ...pinConsent, textVersion: 'transfer-1999' } });
    expect([stale.status, stale.body.error?.code]).toEqual([422, 'consent_text_stale']);
    const changed = await dApprove(JUN, junPhone, created.id, { consent: { ...pinConsent, termsDigest: 'f'.repeat(64) } });
    expect([changed.status, changed.body.error?.code]).toEqual([409, 'terms_changed']);
    for (let i = 0; i < TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY; i += 1) await db.recordRateHit(transferRateKey.createLearner(JUN), NOW);
    const limited = await dApprove(JUN, junPhone, created.id, { consent: pinConsent });
    expect([limited.status, limited.body.error?.code]).toEqual([429, 'too_many_requests']);
    vi.setSystemTime(new Date(NOW.getTime() + 2 * DAY));
    expect((await dApprove(JUN, junPhone, created.id, { consent: pinConsent })).status).toBe(200);
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    vi.setSystemTime(new Date(NOW.getTime() + 5 * DAY));
    expect(transfersOf(await inbox(JUN, junPhone))[0]).toMatchObject({ status: 'executed' });
    const resent = await dApprove(JUN, junPhone, created.id, { consent: pinConsent });
    expect([resent.status, deviceRequest(resent).status]).toEqual([200, 'executed']);
    const cancelled = await dCancel(JUN, junPhone, created.id);
    expect([cancelled.status, cancelled.body.error?.code]).toEqual([409, 'not_open']);
  });

  it("another learner's request, an unknown one and an ended one", async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    expect((await dApprove(JUN, junPhone, created.id, { consent: pinConsent })).status).toBe(404);
    expect((await dDecline(JUN, junPhone, created.id)).status).toBe(404);
    expect((await dCancel(JUN, junPhone, created.id)).status).toBe(404);
    expect((await dCancel(SUNI, suniPhone, TID)).status).toBe(404);
    expect((await dCancel(SUNI, suniPhone, created.id)).status).toBe(200);
    const again = await dDecline(SUNI, suniPhone, created.id);
    expect([again.status, again.body.error?.code]).toEqual([409, 'not_open']);
    const bad = await dApprove(SUNI, suniPhone, created.id, { consent: pinConsent, slots: ['learner'] });
    expect([bad.status, bad.body.error?.code]).toEqual([422, 'bad_request']);
  });
});

describe('the learner veto (guard 11)', () => {
  it('the device declines a request a guardian agreed to: it ends and nothing moves (behaviour 21)', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    const r = await dDecline(SUNI, suniPhone, created.id);
    expect(r.status).toBe(200);
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'declined', endReason: 'declined_learner', endActor: 'device' });
    const events = await db.transferEvents(created.id);
    expect(events.at(-1)).toMatchObject({ actorKind: 'device', actorRef: PHONE, event: 'declined', slot: 'learner' });
    expect(await db.membership(A, 'learner', SUNI)).not.toBeNull();
  });

  it('the device cancels any open request: withdrawn by the learner, ended from the device', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const r = await dCancel(SUNI, suniPhone, created.id);
    expect(deviceRequest(r)).toMatchObject({ status: 'ended', endedFrom: 'device' });
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'cancelled', endReason: 'withdrawn_learner', endActor: 'device' });
    expect((await db.transferEvents(created.id)).at(-1)).toMatchObject({ actorKind: 'device', actorRef: PHONE, event: 'cancelled', slot: 'learner' });
  });

  it('decline and cancel take an empty body only', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const r = await dcall('POST', `${dbase(SUNI)}/${created.id}/decline`, suniPhone, { reason: 'not_now' });
    expect([r.status, r.body.error?.code]).toEqual([422, 'bad_request']);
  });
});

describe('the learner switch (guard 13)', () => {
  it("the device sets selfManaged and never touches the family's switch", async () => {
    await db.setTransferPref(SUNI, 'blockTeacherRequests', true, NOW);
    const r = await dPrefs(SUNI, suniPhone, { selfManaged: true });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ prefs: { selfManaged: true } });
    expect(await db.getTransferPrefs(SUNI)).toMatchObject({ selfManaged: true, blockTeacherRequests: true });
    const other = await dPrefs(SUNI, suniPhone, { blockTeacherRequests: false });
    expect([other.status, other.body.error?.code]).toEqual([422, 'bad_request']);
    expect((await db.getTransferPrefs(SUNI)).blockTeacherRequests).toBe(true);
  });
});
