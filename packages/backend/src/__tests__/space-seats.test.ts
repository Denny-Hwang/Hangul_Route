import { FAMILY_LIFETIME_LEARNERS, FREE_CLASS_STUDENT_CAP, GROUP_LICENSE_LEARNERS, LookupSeatSchema, SCHOOL_LEARNER_CAP, type EntitlementApply } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { relinkLimiter } from '../routes/relink';
import { lookupLimiter } from '../routes/spaces';
import { store } from '../store';
import { testDb as db } from './helpers/db';
import { countDbCalls } from './helpers/transfer-world';

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
  relinkLimiter.reset();
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
    expect([refused.status, refused.body.error?.code, refused.body.error?.details]).toEqual([409, 'cap_family', { reason: 'cap_family', cap: 4 }]);
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
    expect([r.status, r.body.error?.code, r.body.error?.details]).toEqual([409, 'cap_class', { reason: 'cap_class', cap: 20 }]);
    await entitle(cls.id);
    await fill(cls.id, GROUP_LICENSE_LEARNERS - FREE_CLASS_STUDENT_CAP - 1, 'more');
    expect((await join(cls, await registerLearner())).status).toBe(201);
    const full = await join(cls, await registerLearner());
    expect([full.status, full.body.error?.code, full.body.error?.details]).toEqual([409, 'cap_class', { reason: 'cap_class', cap: 50 }]);
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
    // [SA] section 3.4: shipped apps map only cap_class to the class line, so a school cap answers cap_class with its reason
    expect([r.status, r.body.error?.code, r.body.error?.details]).toEqual([409, 'cap_class', { reason: 'cap_school', cap: SCHOOL_LEARNER_CAP }]);
    expect(r.body.error?.message).toBe('This school has room for 50 students');
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
    expect((await join(b, await registerLearner())).body.error?.details).toEqual({ reason: 'cap_school', cap: 50 });
    await entitle(sch.id, { planKey: 'school_seat', seats: 60 });
    await entitle(sch.id, { planKey: 'group_license', status: 'expired' });
    expect((await join(b, await registerLearner())).status).toBe(201); // 51 of 60
    expect((await call('POST', `/api/spaces/${a.id}/archive`, bearer('principal'))).status).toBe(200);
    // A's 31 learners no longer count toward the school: B's 20 of 21
    await entitle(sch.id, { planKey: 'school_seat', seats: 21 });
    expect((await join(b, await registerLearner())).status).toBe(201);
    expect((await join(b, await registerLearner())).body.error?.details).toEqual({ reason: 'cap_school', cap: 21 });
  });

  it('a class with its own licence in an unlicensed school: 50 in the class, 50 in the school', async () => {
    const sch = await createSpace('principal', 'school', 'Maple School');
    const a = await createSpace('principal', 'class', 'A', sch.id);
    await entitle(a.id);
    await fill(a.id, 49);
    expect((await join(a, await registerLearner())).status).toBe(201);
    const r = await join(a, await registerLearner());
    expect([r.body.error?.code, r.body.error?.details]).toEqual(['cap_class', { reason: 'cap_class', cap: 50 }]);
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
    expect([r.body.error?.code, r.body.error?.details]).toEqual(['cap_learner', { reason: 'cap_learner', cap: 3 }]);
  });
});

describe('[SA] a refused join reads a fixed number of rows, whatever the class count (D1 statement budget)', () => {
  /** A school at 50 across `classes` live classes; the refused join is a new learner into the last one. */
  async function refusedJoinCalls(classes: number): Promise<number> {
    await db.reset();
    const sch = await createSpace('principal', 'school', `School ${classes}`);
    const rows: Array<{ id: string; joinCode: string }> = [];
    for (let i = 0; i < classes; i += 1) rows.push(await createSpace('principal', 'class', `Class ${i + 1}`, sch.id));
    for (let i = 0; i < SCHOOL_LEARNER_CAP; i += 1) {
      const cls = rows[i % rows.length]!;
      await db.addMembership({ spaceId: cls.id, memberKind: 'learner', memberId: `profile:s-${i}`, role: 'student', joinedAt: new Date().toISOString() });
    }
    const target = rows[rows.length - 1]!;
    const learner = await registerLearner('New');
    let code: string | undefined;
    const n = await countDbCalls(async () => {
      code = (await join(target, learner)).body.error?.code;
    });
    expect(code).toBe('cap_class'); // the school cap answered as cap_class with details.reason cap_school
    return n;
  }

  it('20 live classes cost the same reads as 3, inside the Free-plan budget', async () => {
    const few = await refusedJoinCalls(3);
    const many = await refusedJoinCalls(20);
    expect(many).toBe(few);
    expect(many).toBeLessThan(50);
  });
});

describe('[SA] lookup: `full` is always false, `seat` is learner-aware (section 3.4)', () => {
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
    // a malformed learnerId with a valid code is unvouched: 200 with the new-learner seat, never 422 invalid_code
    const malformed = await lookup(fam.joinCode, member.auth, 'account:not-a-learner');
    expect(malformed.status).toBe(200);
    expect(malformed.body.data).toMatchObject({ full: false, seat: { full: true, reason: 'cap_family', cap: 4 } });
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
    expect(anon.body.data).toMatchObject({ full: false, seat: { full: true, reason: 'cap_school', cap: 50 } });
    const vouched = await lookup(c.joinCode, sibling.auth, sibling.learnerId);
    expect(vouched.body.data).toMatchObject({ full: false, seat: { full: false, reason: null, cap: null } });
    expect((await join(c, sibling)).status).toBe(201);
  });

  it('a full class: full stays false, seat.reason cap_class; a class with room: seat not full', async () => {
    const cls = await createSpace('teacher', 'class', 'Room 4');
    expect((await lookup(cls.joinCode)).body.data).toMatchObject({ full: false, seat: { full: false, reason: null, cap: null } });
    await fill(cls.id, 20);
    expect((await lookup(cls.joinCode)).body.data).toMatchObject({ full: false, seat: { full: true, reason: 'cap_class', cap: 20 } });
  });
});

describe('[SA] relink at a cap is never blocked (section 3.4)', () => {
  /** A rostered learner on its first device, then a new device asks to come back through the class roster. */
  async function relinkAt(space: { id: string; joinCode: string }) {
    const learner = await registerLearner('Returning');
    expect((await join(space, learner)).status).toBe(201);
    return learner;
  }
  const relink = (spaceId: string, code: string, learnerId: string, deviceId: string) => call('POST', `/api/spaces/${spaceId}/relink-requests`, json, { code, learnerId, deviceId });

  it('a full licensed class (50) and a class of a school at 50: full false, relink succeeds and takes no seat, a new learner gets cap_class', async () => {
    const solo = await createSpace('teacher', 'class', 'Room 4');
    await entitle(solo.id);
    const sch = await createSpace('principal', 'school', 'Maple School');
    const a = await createSpace('principal', 'class', 'A', sch.id);
    const b = await createSpace('principal', 'class', 'B', sch.id);
    const cases: Array<{ space: { id: string; joinCode: string }; owner: string; fillTo: () => Promise<void>; reason: string }> = [
      { space: solo, owner: 'teacher', fillTo: () => fill(solo.id, 49), reason: 'cap_class' },
      { space: a, owner: 'principal', fillTo: () => fill(b.id, 49), reason: 'cap_school' },
    ];
    let n = 0;
    for (const { space, owner, fillTo, reason } of cases) {
      const back = await relinkAt(space);
      await fillTo(); // the space (or its school) now holds 50
      // the old-shape answer: `full` is false, so a shipped app shows the roster and its relink step
      const old = await lookup(space.joinCode);
      expect(old.body.data).toMatchObject({ full: false, seat: { full: true, reason } });
      n += 1;
      const deviceId = `device-newphone${n}`;
      const created = await relink(space.id, space.joinCode, back.learnerId, deviceId);
      expect(created.status, reason).toBe(201);
      const rid = (created.body.data as { request: { id: string } }).request.id;
      const before = (await db.membersOf(space.id)).filter((m) => m.memberKind === 'learner').length;
      expect((await call('POST', `/api/spaces/${space.id}/relink-requests/${rid}/approve`, bearer(owner))).status).toBe(200);
      expect((await db.membersOf(space.id)).filter((m) => m.memberKind === 'learner').length).toBe(before);
      // a new learner is refused by the atomic join, as cap_class (a school cap carries its reason)
      const fresh = await join(space, await registerLearner('New'));
      expect([fresh.status, fresh.body.error?.code, (fresh.body.error?.details as { reason?: string }).reason]).toEqual([409, 'cap_class', reason]);
    }
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
