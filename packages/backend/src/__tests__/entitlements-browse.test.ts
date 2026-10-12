import { BrowseScopeResponseSchema, type EntitlementApply, type Membership, type Space } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFallbackDb, type Db } from '../db';
import app from '../index';
import { accountBrowseScope, adultCoveredAny } from '../lib/entitlement';
import { testDb as db } from './helpers/db';

/**
 * F-BROWSE-001 §4.2 and §5.2 (BR-2): who may preview every lesson. `full`
 * exactly when the account is an adult member (owner, caregiver, teacher,
 * admin) of a covered space, by F-BILL-002 §5.3's card set; `sampler`
 * otherwise. `GET /api/entitlements/browse` answers it and writes nothing
 * for a known account.
 */
type Envelope = { ok: boolean; data?: unknown; error?: { code: string } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });

async function browse(headers: Record<string, string>) {
  const res = await app.request('/api/entitlements/browse', { method: 'GET', headers });
  return { status: res.status, body: (await res.json()) as Envelope };
}

/**
 * `target` seen through a proxy that records each `Db` method the caller
 * invokes, by name. Calls a method makes on its own helpers are not seen, so
 * the list is exactly the route's (or helper's) use of the `Db` interface.
 */
function watching(target: Db): { db: Db; calls: string[] } {
  const calls: string[] = [];
  const proxy = new Proxy<Db>(target, {
    get(t, prop) {
      const value: unknown = Reflect.get(t, prop, t);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]): unknown => {
        calls.push(String(prop));
        return (value as (...a: unknown[]) => unknown).apply(t, args);
      };
    },
  });
  return { db: proxy, calls };
}

/** Every `Db` method that only reads; anything else the route calls is a write (or a new method to classify here). */
const DB_READERS: ReadonlySet<string> = new Set([
  'getAccount',
  'getLearner',
  'learnerByRecoveryHash',
  'getDevice',
  'deviceExists',
  'getSnapshot',
  'getSpace',
  'spaceByCode',
  'childSpaces',
  'spacesOwnedBy',
  'membership',
  'membershipsOf',
  'membersOf',
  'getPlan',
  'plansOf',
  'getRelink',
  'relinksOf',
  'entitlementsFor',
  'waitlistEntries',
  'getTransfer',
  'transfersOfSpace',
  'openTransfersOfSpaces',
  'transfersOfLearner',
  'openTransferOf',
  'lastLearnerRefusal',
  'lastCooldownDecline',
  'countTransfersCreatedBy',
  'countTransfersCreatedForLearner',
  'countOpenTransfersTo',
  'transferEvents',
  'getLearners',
  'getSpaces',
  'countRateHits',
  'getTransferPrefs',
]);

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number): string => new Date(ms).toISOString();

const account = async (id: string): Promise<void> => db.putAccount({ id, email: null, displayName: null, consent: null, createdAt: '2026-01-01T00:00:00.000Z' });

async function space(id: string, kind: Space['kind'], owner: string, opts: { parent?: string; archived?: boolean } = {}): Promise<void> {
  await account(owner);
  await db.putSpace({
    id,
    kind,
    name: id,
    parentSpaceId: opts.parent ?? null,
    ownerAccountId: owner,
    joinCode: null,
    joinCodeExpiresAt: null,
    settings: { consentMode: 'parent', anonymizeRoster: false },
    archivedAt: opts.archived ? '2026-02-01T00:00:00.000Z' : null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  await member(id, owner, 'owner');
}

async function member(spaceId: string, memberId: string, role: Membership['role'], memberKind: Membership['memberKind'] = 'account'): Promise<void> {
  if (memberKind === 'account') await account(memberId);
  await db.addMembership({ spaceId, memberKind, memberId, role, joinedAt: '2026-01-02T00:00:00.000Z' });
}

async function grant(input: Omit<EntitlementApply, 'provider'> & { provider?: EntitlementApply['provider'] }, at: Date): Promise<void> {
  await db.applyEntitlement({ provider: 'stripe', ...input }, at);
}

/**
 * Every coverage fixture of §10, one account each, with the scope §4.2 gives
 * it. Times are relative to `now` so the route (real clock) and the helper
 * (injected clock) read the same world.
 */
async function seedWorld(nowMs: number): Promise<Record<string, 'full' | 'sampler'>> {
  const now = new Date(nowMs);
  const yearAhead = iso(nowMs + 365 * DAY);

  // A family with an active family plan: its owner and its co-parent.
  await space('space:fam', 'family', 'fam-owner');
  await grant({ subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime', status: 'active', expiresAt: yearAhead }, now);
  await member('space:fam', 'fam-carer', 'caregiver');
  // Learner memberships never count, and neither does a `student` role on an account.
  await account('kid');
  await member('space:fam', 'kid', 'student', 'learner');
  await member('space:fam', 'student-account', 'student');

  // A licensed school: its owner, a school-level teacher, a class inside it and that class's co-teacher.
  await space('space:sch', 'school', 'sch-owner');
  await grant({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'group_license', status: 'active', expiresAt: yearAhead }, now);
  await member('space:sch', 'sch-teacher', 'teacher');
  await space('space:cls-in-sch', 'class', 'cls-teacher', { parent: 'space:sch' });
  await member('space:cls-in-sch', 'co-teacher', 'teacher');

  // A school under a seat contract, seen by its admin.
  await space('space:sch-seat', 'school', 'seat-owner');
  await grant({ subjectKind: 'space', subjectId: 'space:sch-seat', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 40, expiresAt: yearAhead }, now);
  await member('space:sch-seat', 'seat-admin', 'admin');

  // An archived school that still holds a licence: its live class is not covered through it,
  // while the payer of the archived space still is (F-BILL-002 §4.2, archived spaces).
  await space('space:sch-arch', 'school', 'arch-sch-owner', { archived: true });
  await grant({ subjectKind: 'space', subjectId: 'space:sch-arch', planKey: 'group_license', status: 'active', expiresAt: yearAhead }, now);
  await member('space:sch-arch', 'arch-sch-teacher', 'teacher');
  await space('space:cls-arch-sch', 'class', 'arch-cls-teacher', { parent: 'space:sch-arch' });

  // A stand-alone class with its own licence; a free class; an archived class still holding its licence.
  await space('space:solo', 'class', 'solo-teacher');
  await grant({ subjectKind: 'space', subjectId: 'space:solo', planKey: 'group_license', status: 'active', expiresAt: yearAhead }, now);
  await space('space:free-cls', 'class', 'free-teacher');
  await space('space:cls-arch', 'class', 'arch-cls-owner', { archived: true });
  await grant({ subjectKind: 'space', subjectId: 'space:cls-arch', planKey: 'group_license', status: 'active', expiresAt: yearAhead }, now);
  await member('space:cls-arch', 'arch-cls-co', 'teacher');

  // An archived family that still holds its plan.
  await space('space:fam-arch', 'family', 'arch-fam-owner', { archived: true });
  await grant({ subjectKind: 'space', subjectId: 'space:fam-arch', planKey: 'family_lifetime', status: 'active', expiresAt: yearAhead }, now);

  // Past due: inside the 7-day grace, and after it.
  await space('space:grace', 'family', 'grace-owner');
  await grant({ subjectKind: 'space', subjectId: 'space:grace', planKey: 'family_lifetime', status: 'past_due', expiresAt: yearAhead }, new Date(nowMs - 3 * DAY));
  await space('space:lapsed', 'family', 'lapsed-owner');
  await grant({ subjectKind: 'space', subjectId: 'space:lapsed', planKey: 'family_lifetime', status: 'past_due', expiresAt: yearAhead }, new Date(nowMs - 10 * DAY));

  // Cancelled: before its period ends, and after.
  await space('space:cancel', 'family', 'cancel-owner');
  await grant({ subjectKind: 'space', subjectId: 'space:cancel', planKey: 'family_lifetime', status: 'cancelled', expiresAt: iso(nowMs + 20 * DAY) }, now);
  await space('space:ended', 'family', 'ended-owner');
  await grant({ subjectKind: 'space', subjectId: 'space:ended', planKey: 'family_lifetime', status: 'cancelled', expiresAt: iso(nowMs - DAY) }, now);

  // A legacy account-subject row; an expired one.
  await account('legacy');
  await grant({ subjectKind: 'account', subjectId: 'legacy', planKey: 'group_license', status: 'active', provider: 'manual', expiresAt: yearAhead }, now);
  await account('legacy-expired');
  await grant({ subjectKind: 'account', subjectId: 'legacy-expired', planKey: 'group_license', status: 'expired', provider: 'manual' }, now);

  // A signed-in adult with no space at all.
  await account('nobody');

  return {
    'fam-owner': 'full',
    'fam-carer': 'full',
    kid: 'sampler',
    'student-account': 'sampler',
    'sch-owner': 'full',
    'sch-teacher': 'full',
    'cls-teacher': 'full',
    'co-teacher': 'full',
    'seat-owner': 'full',
    'seat-admin': 'full',
    'arch-sch-owner': 'full',
    'arch-sch-teacher': 'sampler',
    'arch-cls-teacher': 'sampler',
    'solo-teacher': 'full',
    'free-teacher': 'sampler',
    'arch-cls-owner': 'full',
    'arch-cls-co': 'sampler',
    'arch-fam-owner': 'sampler',
    'grace-owner': 'full',
    'lapsed-owner': 'sampler',
    'cancel-owner': 'full',
    'ended-owner': 'sampler',
    legacy: 'full',
    'legacy-expired': 'sampler',
    nobody: 'sampler',
  };
}

beforeEach(async () => {
  await db.reset();
});
afterEach(() => vi.restoreAllMocks());

describe('accountBrowseScope / adultCoveredAny (F-BROWSE-001 §4.2)', () => {
  it('gives every coverage fixture its scope', async () => {
    const nowMs = Date.now();
    const expected = await seedWorld(nowMs);
    const now = new Date(nowMs);
    for (const [accountId, scope] of Object.entries(expected)) {
      expect(await accountBrowseScope(db, accountId, now), accountId).toBe(scope);
      expect(await adultCoveredAny(db, accountId, now), accountId).toBe(scope === 'full');
    }
  });

  it('follows the clock: a past-due plan leaves the grace and a cancelled one reaches its end', async () => {
    const start = Date.parse('2026-10-01T12:00:00.000Z');
    await space('space:f', 'family', 'mom');
    await grant({ subjectKind: 'space', subjectId: 'space:f', planKey: 'family_lifetime', status: 'past_due', expiresAt: iso(start + 365 * DAY) }, new Date(start));
    expect(await accountBrowseScope(db, 'mom', new Date(start + 6 * DAY))).toBe('full');
    expect(await accountBrowseScope(db, 'mom', new Date(start + 8 * DAY))).toBe('sampler');

    await grant({ subjectKind: 'space', subjectId: 'space:f', planKey: 'family_lifetime', status: 'cancelled', expiresAt: iso(start + 30 * DAY) }, new Date(start));
    expect(await accountBrowseScope(db, 'mom', new Date(start + 29 * DAY))).toBe('full');
    expect(await accountBrowseScope(db, 'mom', new Date(start + 30 * DAY))).toBe('sampler');
  });

  it('counts a class through its school only while the school is live and licensed', async () => {
    const now = new Date('2026-10-11T00:00:00.000Z');
    await space('space:s', 'school', 'principal');
    await space('space:c', 'class', 'ms-park', { parent: 'space:s' });
    expect(await accountBrowseScope(db, 'ms-park', now)).toBe('sampler');
    await grant({ subjectKind: 'space', subjectId: 'space:s', planKey: 'school_seat', status: 'active', provider: 'manual', seats: null }, now);
    expect(await accountBrowseScope(db, 'ms-park', now)).toBe('full');
    const school = (await db.getSpace('space:s')) as Space;
    await db.putSpace({ ...school, archivedAt: '2026-10-10T00:00:00.000Z' });
    expect(await accountBrowseScope(db, 'ms-park', now)).toBe('sampler');
  });

  it('never counts a family plan on a class, or a seat contract on an archived school', async () => {
    const now = new Date('2026-10-11T00:00:00.000Z');
    await space('space:c', 'class', 'mr-lee');
    await grant({ subjectKind: 'space', subjectId: 'space:c', planKey: 'family_lifetime', status: 'active' }, now);
    expect(await accountBrowseScope(db, 'mr-lee', now)).toBe('sampler');
    await space('space:s', 'school', 'head', { archived: true });
    await grant({ subjectKind: 'space', subjectId: 'space:s', planKey: 'school_seat', status: 'active', provider: 'manual' }, now);
    expect(await accountBrowseScope(db, 'head', now)).toBe('sampler');
  });

  it('skips a membership whose space is gone', async () => {
    const now = new Date('2026-10-11T00:00:00.000Z');
    await space('space:f', 'family', 'mom');
    await grant({ subjectKind: 'space', subjectId: 'space:f', planKey: 'family_lifetime', status: 'active' }, now);
    vi.spyOn(db, 'getSpaces').mockResolvedValue([]);
    expect(await accountBrowseScope(db, 'mom', now)).toBe('sampler');
  });

  it('reads the spaces in one call and each space and school once, however many classes (D1 query budget)', async () => {
    const now = new Date('2026-10-11T00:00:00.000Z');
    await space('space:big', 'school', 'principal');
    for (let n = 0; n < 30; n += 1) await space(`space:c${n}`, 'class', 'busy-teacher', { parent: 'space:big' });
    const watched = watching(db);
    expect(await adultCoveredAny(watched.db, 'busy-teacher', now)).toBe(false);
    const count = (name: string): number => watched.calls.filter((c) => c === name).length;
    expect(count('getSpace')).toBe(0);
    expect(count('getSpaces')).toBeLessThanOrEqual(2);
    // the account row, each class once and the school once: 32, never one school read per class
    expect(count('entitlementsFor')).toBe(32);
    expect(watched.calls.length).toBeLessThan(40);
  });
});

describe('GET /api/entitlements/browse (F-BROWSE-001 §5.2)', () => {
  it('answers 401 without a session', async () => {
    const r = await browse(json);
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ ok: false, error: { code: 'unauthorized' } });
  });

  it('answers { scope } in the shape the console parses, and nothing else', async () => {
    await space('space:f', 'family', 'mom');
    await grant({ subjectKind: 'space', subjectId: 'space:f', planKey: 'family_lifetime', status: 'active' }, new Date());
    const full = await browse(bearer('mom'));
    expect(full.status).toBe(200);
    expect(full.body).toMatchObject({ ok: true, data: { scope: 'full' } });
    expect(full.body.data).toEqual({ scope: 'full' });
    expect(BrowseScopeResponseSchema.safeParse(full.body.data).success).toBe(true);

    const first = await browse(bearer('first-visit'));
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ scope: 'sampler' });
    expect(await db.getAccount('first-visit')).not.toBeNull(); // requireAccount's first sign-in upsert, the only write
  });

  it('writes nothing for a seeded existing account: every Db call is a reader', async () => {
    const nowMs = Date.now();
    await seedWorld(nowMs);
    const watched = watching(db);
    setFallbackDb(watched.db);
    try {
      for (const accountId of ['fam-owner', 'sch-teacher', 'arch-cls-owner', 'nobody']) {
        expect((await browse(bearer(accountId))).status).toBe(200);
      }
    } finally {
      setFallbackDb(db);
    }
    expect(watched.calls).toContain('membershipsOf'); // the proxy saw the route
    expect(watched.calls.filter((name) => !DB_READERS.has(name))).toEqual([]);
  });

  it('the watcher catches a write', async () => {
    const watched = watching(db);
    await watched.db.putAccount({ id: 'w', email: null, displayName: null, consent: null, createdAt: '2026-01-01T00:00:00.000Z' });
    expect(watched.calls.filter((name) => !DB_READERS.has(name))).toEqual(['putAccount']);
  });

  it('parity: for every coverage fixture the route says full exactly when adultCoveredAny does', async () => {
    const nowMs = Date.now();
    const expected = await seedWorld(nowMs);
    for (const accountId of Object.keys(expected)) {
      const r = await browse(bearer(accountId));
      expect(r.status, accountId).toBe(200);
      const covered = await adultCoveredAny(db, accountId, new Date());
      expect(r.body.data, accountId).toEqual({ scope: covered ? 'full' : 'sampler' });
      expect(r.body.data, accountId).toEqual({ scope: expected[accountId] });
    }
  });

  it('leaves GET /api/entitlements unchanged', async () => {
    await space('space:f', 'family', 'mom');
    const r = await app.request('/api/entitlements', { method: 'GET', headers: bearer('mom') });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { entitlements: unknown[] } }).data.entitlements).toEqual([]);
  });
});
