import { FAMILY_LIFETIME_LEARNERS, FREE_CLASS_STUDENT_CAP, GROUP_LICENSE_LEARNERS, LookupSeatSchema, SCHOOL_LEARNER_CAP, type EntitlementApply } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { lookupLimiter } from '../routes/spaces';
import { store } from '../store';
import { testDb as db } from './helpers/db';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS sections 3.2-3.6 and 6.5, through the routes: the learner caps per plan at `/join`,
 * the lookup's `seat`, the roster's `seats`, and the owner-only actions an admin is refused.
 */

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string; details?: Record<string, unknown> } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const deviceAuth = (deviceId: string, secret: string): Record<string, string> => ({ ...json, authorization: `Device ${deviceId}:${secret}` });
const STRIPE_ENV = { STRIPE_SECRET_KEY: 'sk_test_x' };

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env?: Record<string, string>) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
  return { status: res.status, body: (await res.json()) as Envelope };
}
async function createSpace(user: string, kind: string, name: string, parentSpaceId?: string): Promise<{ id: string; joinCode: string }> {
  const r = await call('POST', '/api/spaces', bearer(user), { kind, name, ...(parentSpaceId ? { parentSpaceId } : {}) });
  expect(r.status).toBe(201);
  const id = (r.body.data as { space: { id: string } }).space.id;
  const code = await call('POST', `/api/spaces/${id}/code`, bearer(user));
  return { id, joinCode: (code.body.data as { joinCode: string }).joinCode };
}
let deviceSeq = 0;
async function registerLearner(name = 'Suni') {
  deviceSeq += 1;
  const deviceId = `device-seat${String(deviceSeq).padStart(4, '0')}`;
  const r = await call('POST', '/api/sync/learners', json, { deviceId, learner: { displayName: name, ageGroup: '5-7', avatar: 'hoya-orange' } });
  expect(r.status).toBe(201);
  const data = r.body.data as { learner: { id: string }; device: { secret: string } };
  return { learnerId: data.learner.id, auth: deviceAuth(deviceId, data.device.secret) };
}
const join = (space: { id: string; joinCode: string }, learner: { learnerId: string; auth: Record<string, string> }) =>
  call('POST', `/api/spaces/${space.id}/join`, learner.auth, { code: space.joinCode, learnerId: learner.learnerId });
/** `n` learner memberships seeded straight into the store (seat counts read memberships only). */
async function fill(spaceId: string, n: number, prefix = spaceId.slice(6)): Promise<void> {
  for (let i = 0; i < n; i += 1) await db.addMembership({ spaceId, memberKind: 'learner', memberId: `profile:${prefix}-${i}`, role: 'student', joinedAt: new Date().toISOString() });
}
async function entitle(subjectId: string, over: Partial<EntitlementApply> = {}) {
  return db.applyEntitlement({ subjectKind: 'space', subjectId, planKey: 'group_license', status: 'active', provider: 'manual', ...over }, new Date());
}
const lookup = (code: string, headers: Record<string, string> = json, learnerId?: string) => call('POST', '/api/spaces/lookup', headers, { code, ...(learnerId ? { learnerId } : {}) });
const seatEvents = () => store.events.filter((e) => e.name === 'space.seat_refused').map((e) => e.payload);

beforeEach(async () => {
  await db.reset();
  lookupLimiter.reset();
  store.events.length = 0;
});

describe('[SA] a family holds up to 4 learners (SA-D1)', () => {
  it('refuses the 5th with 409 cap_family and details.cap 4; a member re-joins idempotently', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await fill(fam.id, FAMILY_LIFETIME_LEARNERS - 1);
    const fourth = await registerLearner('Mina');
    expect((await join(fam, fourth)).status).toBe(201);
    const fifth = await registerLearner('Jun');
    const refused = await join(fam, fifth);
    expect([refused.status, refused.body.error?.code, refused.body.error?.details]).toEqual([409, 'cap_family', { cap: 4 }]);
    expect(refused.body.error?.message).toBe('This family has room for 4 learners');
    expect(await db.membership(fam.id, 'learner', fifth.learnerId)).toBeNull();
    // the 4th joins again from another screen: nothing new, 200 alreadyMember
    const again = await join(fam, fourth);
    expect([again.status, again.body.data?.alreadyMember]).toEqual([200, true]);
    expect(seatEvents()).toEqual([{ kind: 'family', reason: 'cap_family', path: 'join' }]);
  });

  it('grandfathers a family above the cap (SA-D7): everyone stays, a member re-joins, a new learner waits', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const old = await registerLearner('Old');
    await db.addMembership({ spaceId: fam.id, memberKind: 'learner', memberId: old.learnerId, role: 'student', joinedAt: new Date().toISOString() });
    await fill(fam.id, 4);
    expect((await db.membersOf(fam.id)).filter((m) => m.memberKind === 'learner')).toHaveLength(5);
    expect((await join(fam, old)).status).toBe(200);
    expect((await join(fam, await registerLearner('New'))).body.error?.code).toBe('cap_family');
    expect((await db.membersOf(fam.id)).filter((m) => m.memberKind === 'learner')).toHaveLength(5);
  });

  it('a second device of the learner that joined between the read and the statement: 200 alreadyMember', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const learner = await registerLearner('Mina');
    const original = db.addLearnerWithinCaps.bind(db);
    db.addLearnerWithinCaps = async (input) => {
      await db.addMembership({ spaceId: input.spaceId, memberKind: 'learner', memberId: input.learnerId, role: 'student', joinedAt: 'other-device' });
      return original(input);
    };
    try {
      const r = await join(fam, learner);
      expect([r.status, r.body.data?.alreadyMember]).toEqual([200, true]);
      expect(r.body.data?.membership).toMatchObject({ joinedAt: 'other-device' });
    } finally {
      db.addLearnerWithinCaps = original;
    }
  });

  it('opens again once a learner leaves', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await fill(fam.id, FAMILY_LIFETIME_LEARNERS);
    const next = await registerLearner();
    expect((await join(fam, next)).status).toBe(409);
    await db.removeMembership(fam.id, 'learner', `profile:${fam.id.slice(6)}-0`);
    expect((await join(fam, next)).status).toBe(201);
  });
});

describe('[SA] classes and schools hold up to 50 (SA-D2, SA-D3)', () => {
  it('a free stand-alone class stops at 20, a licensed one at 50 (was no cap)', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    await fill(cls.id, FREE_CLASS_STUDENT_CAP);
    const r = await join(cls, await registerLearner());
    expect([r.status, r.body.error?.code, r.body.error?.details]).toEqual([409, 'cap_class', { cap: 20 }]);
    await entitle(cls.id);
    await fill(cls.id, GROUP_LICENSE_LEARNERS - FREE_CLASS_STUDENT_CAP - 1, 'more');
    expect((await join(cls, await registerLearner())).status).toBe(201);
    const full = await join(cls, await registerLearner());
    expect([full.status, full.body.error?.code, full.body.error?.details]).toEqual([409, 'cap_class', { cap: 50 }]);
    expect(full.body.error?.message).toBe('This class has room for 50 students');
  });

  it('an unlicensed school holds 50 distinct students, each class 20; a learner already in a sibling class takes no seat', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    const a = await createSpace('principal', 'class', 'A', sch.id);
    const b = await createSpace('principal', 'class', 'B', sch.id);
    const c = await createSpace('principal', 'class', 'C', sch.id);
    await fill(a.id, 20);
    await fill(b.id, 20);
    const sibling = await registerLearner('Sib');
    expect((await join(c, sibling)).status).toBe(201);
    await fill(c.id, 9); // 20 + 20 + 1 + 9 = 50 distinct
    const r = await join(c, await registerLearner());
    expect([r.status, r.body.error?.code, r.body.error?.details]).toEqual([409, 'cap_school', { cap: SCHOOL_LEARNER_CAP }]);
    // the learner of C joins A? A is at 20: the class cap first
    expect((await join(a, sibling)).body.error?.code).toBe('cap_class');
    // a fourth class: the sibling learner holds a school seat already, so it joins
    const d = await createSpace('principal', 'class', 'D', sch.id);
    expect((await join(d, sibling)).status).toBe(201);
    expect(seatEvents()).toEqual([
      { kind: 'class', reason: 'cap_school', path: 'join' },
      { kind: 'class', reason: 'cap_class', path: 'join' },
    ]);
  });

  it('a licensed school holds 50 with no class cap; a contract its seats; an archived class frees its seats', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    const a = await createSpace('principal', 'class', 'A', sch.id);
    const b = await createSpace('principal', 'class', 'B', sch.id);
    await entitle(sch.id);
    await fill(a.id, 30);
    expect((await join(a, await registerLearner())).status).toBe(201); // 31 in one class: no class cap
    await fill(b.id, 19); // 31 + 19 = 50
    expect((await join(b, await registerLearner())).body.error?.code).toBe('cap_school');
    await entitle(sch.id, { planKey: 'school_seat', seats: 60 });
    await entitle(sch.id, { planKey: 'group_license', status: 'expired' });
    expect((await join(b, await registerLearner())).status).toBe(201); // 51 of 60
    expect((await call('POST', `/api/spaces/${a.id}/archive`, bearer('principal'))).status).toBe(200);
    // A's 31 learners no longer count toward the school: B's 20 of 21
    await entitle(sch.id, { planKey: 'school_seat', seats: 21 });
    expect((await join(b, await registerLearner())).status).toBe(201);
    expect((await join(b, await registerLearner())).body.error?.details).toEqual({ cap: 21 });
  });

  it('a class with its own licence in an unlicensed school: 50 in the class, 50 in the school', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    const a = await createSpace('principal', 'class', 'A', sch.id);
    await entitle(a.id);
    await fill(a.id, 49);
    expect((await join(a, await registerLearner())).status).toBe(201);
    const r = await join(a, await registerLearner());
    expect([r.body.error?.code, r.body.error?.details]).toEqual(['cap_class', { cap: 50 }]);
  });

  it('grandfathers a licensed class above 50: members stay and re-join, new students wait', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    await entitle(cls.id);
    const old = await registerLearner('Old');
    await db.addMembership({ spaceId: cls.id, memberKind: 'learner', memberId: old.learnerId, role: 'student', joinedAt: new Date().toISOString() });
    await fill(cls.id, 69);
    expect((await join(cls, old)).status).toBe(200);
    expect((await join(cls, await registerLearner())).body.error?.code).toBe('cap_class');
  });

  it('keeps the learner class cap first, with details.cap 3', async () => {
    const learner = await registerLearner();
    for (const name of ['A', 'B', 'C']) expect((await join(await createSpace('teacher', 'class', name), learner)).status).toBe(201);
    const r = await join(await createSpace('teacher', 'class', 'D'), learner);
    expect([r.body.error?.code, r.body.error?.details]).toEqual(['cap_learner', { cap: 3 }]);
  });
});

describe('[SA] lookup: `full` stays class-only, `seat` is learner-aware (section 3.4)', () => {
  it('a full family: full false (shipped apps), seat full for a new learner, room for a vouched member', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const member = await registerLearner('Mina');
    expect((await join(fam, member)).status).toBe(201);
    await fill(fam.id, FAMILY_LIFETIME_LEARNERS - 1);
    const anon = await lookup(fam.joinCode);
    expect(anon.body.data).toMatchObject({ full: false, seat: { full: true, reason: 'cap_family', cap: 4 } });
    expect(LookupSeatSchema.parse(anon.body.data?.seat)).toEqual({ full: true, reason: 'cap_family', cap: 4 });
    const vouched = await lookup(fam.joinCode, member.auth, member.learnerId);
    expect(vouched.body.data).toMatchObject({ full: false, seat: { full: false, reason: null, cap: null } });
    // another device's secret for that learner is not a voucher: answered as for a new learner, never an error
    const stranger = await registerLearner('Other');
    const unvouched = await lookup(fam.joinCode, stranger.auth, member.learnerId);
    expect(unvouched.status).toBe(200);
    expect(unvouched.body.data).toMatchObject({ full: false, seat: { full: true, reason: 'cap_family' } });
    const noDevice = await lookup(fam.joinCode, json, member.learnerId);
    expect(noDevice.body.data).toMatchObject({ seat: { full: true } });
  });

  it('a school at 50: full for a new learner, room for a learner already in a live sibling class', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    const a = await createSpace('principal', 'class', 'A', sch.id);
    const b = await createSpace('principal', 'class', 'B', sch.id);
    const c = await createSpace('principal', 'class', 'C', sch.id);
    const sibling = await registerLearner('Sib');
    expect((await join(a, sibling)).status).toBe(201);
    await fill(a.id, 19);
    await fill(b.id, 20);
    await fill(c.id, 10);
    const anon = await lookup(c.joinCode);
    expect(anon.body.data).toMatchObject({ full: true, seat: { full: true, reason: 'cap_school', cap: 50 } });
    const vouched = await lookup(c.joinCode, sibling.auth, sibling.learnerId);
    expect(vouched.body.data).toMatchObject({ full: true, seat: { full: false, reason: null, cap: null } });
    expect((await join(c, sibling)).status).toBe(201);
  });

  it('a full class: full and seat.reason cap_class; a class with room: neither', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    expect((await lookup(cls.joinCode)).body.data).toMatchObject({ full: false, seat: { full: false, reason: null, cap: null } });
    await fill(cls.id, 20);
    expect((await lookup(cls.joinCode)).body.data).toMatchObject({ full: true, seat: { full: true, reason: 'cap_class', cap: 20 } });
  });
});

describe('[SA] roster seats (section 3.6)', () => {
  it('a family: n of 4; a class in an unlicensed school: n of 20 and the school n of 50; a licensed school: no class cap', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    await fill(fam.id, 2);
    expect((await call('GET', `/api/spaces/${fam.id}/roster`, bearer('mom'))).body.data?.seats).toEqual({ learners: 2, cap: 4, schoolLearners: null, schoolCap: null });
    const sch = await createSpace('principal', 'school', 'Maple School');
    const a = await createSpace('principal', 'class', 'A', sch.id);
    const b = await createSpace('principal', 'class', 'B', sch.id);
    await fill(a.id, 3);
    await fill(b.id, 4);
    expect((await call('GET', `/api/spaces/${a.id}/roster`, bearer('principal'))).body.data?.seats).toEqual({ learners: 3, cap: 20, schoolLearners: 7, schoolCap: 50 });
    await entitle(sch.id);
    expect((await call('GET', `/api/spaces/${a.id}/roster`, bearer('principal'))).body.data?.seats).toEqual({ learners: 3, cap: null, schoolLearners: 7, schoolCap: 50 });
    const solo = await createSpace('teacher', 'class', 'Solo');
    await entitle(solo.id);
    expect((await call('GET', `/api/spaces/${solo.id}/roster`, bearer('teacher'))).body.data?.seats).toEqual({ learners: 0, cap: 50, schoolLearners: null, schoolCap: null });
  });
});

describe('[SA] owner-only actions: a school admin is refused (section 6.5)', () => {
  it('checkout, portal, receipts, settings, archive and unarchive answer 403 for an admin and work for the owner', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    await db.addMembership({ spaceId: sch.id, memberKind: 'account', memberId: 'dean', role: 'admin', joinedAt: new Date().toISOString() });
    const checkout = { planKey: 'group_license', subjectKind: 'space', subjectId: sch.id };
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('dean'), checkout, STRIPE_ENV)).status).toBe(403);
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('dean'), { subjectKind: 'space', subjectId: sch.id }, STRIPE_ENV)).status).toBe(403);
    expect((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(sch.id)}`, bearer('dean'), undefined, STRIPE_ENV)).status).toBe(403);
    expect((await call('PATCH', `/api/spaces/${sch.id}/settings`, bearer('dean'), { anonymizeRoster: false })).status).toBe(403);
    expect((await call('POST', `/api/spaces/${sch.id}/archive`, bearer('dean'))).status).toBe(403);
    expect((await call('POST', `/api/spaces/${sch.id}/unarchive`, bearer('dean'))).status).toBe(403);
    // an admin still runs the school page and its teacher code
    expect((await call('GET', `/api/spaces/${sch.id}/school`, bearer('dean'))).status).toBe(200);
    expect((await call('POST', `/api/spaces/${sch.id}/code`, bearer('dean'))).status).toBe(200);
    // the owner keeps every one of them
    expect((await call('PATCH', `/api/spaces/${sch.id}/settings`, bearer('principal'), { anonymizeRoster: false })).status).toBe(200);
    expect((await call('POST', `/api/spaces/${sch.id}/archive`, bearer('principal'))).status).toBe(200);
    expect((await call('POST', `/api/spaces/${sch.id}/unarchive`, bearer('principal'))).status).toBe(200);
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('principal'), checkout, STRIPE_ENV)).status).not.toBe(403);
  });
});
