import { FAMILY_LIFETIME_LEARNERS, LEARNER_CLASS_CAP, type Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db';
import app from '../index';
import { classCap, schoolIsFull } from '../lib/entitlement';
import { classSeatCheck } from '../lib/seats';
import { testDb as db } from './helpers/db';

/**
 * F-SPACE-002 §4.3 (PR T-4a): `/join` now calls `classSeatCheck`. This pins
 * that the refactor changes nothing a learner can observe: for every case of
 * the matrix the old inline order (frozen below, copied from `routes/spaces.ts`
 * before the refactor) and the live route answer with the same status and
 * error code, and `classSeatCheck` names the same cap.
 */

type Outcome = { status: number; code: string | null };

/**
 * The wording of the seat errors (clients key off the code). [SA] AMENDMENTS-SEATS-ADMINS section 3.4: the messages
 * (logs only, English) name the cap reached, which also comes as `details.cap`.
 */
const SEAT_MESSAGES: Record<string, (cap: number) => string> = {
  cap_learner: (cap) => `A learner can be in at most ${cap} classes`,
  cap_class: (cap) => `This class has room for ${cap} students`,
  cap_school: (cap) => `This school has room for ${cap} students`,
  cap_family: (cap) => `This family has room for ${cap} learners`,
};

/** The pre-refactor learner path of `/join`, after code and device checks. Do not edit: it is the reference. */
async function legacyJoinOutcome(store: Db, space: Space, learnerId: string, now: Date): Promise<Outcome> {
  const studentsIn = async (spaceId: string): Promise<number> => (await store.membersOf(spaceId)).filter((m) => m.memberKind === 'learner').length;
  const activeClassesOf = async (id: string): Promise<number> => {
    let n = 0;
    for (const m of await store.membershipsOf('learner', id)) {
      const s = await store.getSpace(m.spaceId);
      if (s && s.kind === 'class' && !s.archivedAt) n += 1;
    }
    return n;
  };
  if (space.kind === 'school') return { status: 422, code: 'not_joinable' };
  if (await store.membership(space.id, 'learner', learnerId)) return { status: 200, code: null };
  if (space.kind === 'class' && (await activeClassesOf(learnerId)) >= LEARNER_CLASS_CAP) return { status: 409, code: 'cap_learner' };
  if (space.kind === 'class' && (await studentsIn(space.id)) >= (await classCap(store, space, now))) return { status: 409, code: 'cap_class' };
  if (space.kind === 'class' && (await schoolIsFull(store, space, now, learnerId))) return { status: 409, code: 'cap_school' };
  if (space.kind === 'family' && (await studentsIn(space.id)) >= FAMILY_LIFETIME_LEARNERS) return { status: 409, code: 'cap_family' };
  return { status: 201, code: null };
}

const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown): Promise<{ status: number; body: { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string; details?: unknown } } }> {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string; details?: unknown } } };
}
async function createSpace(user: string, kind: Space['kind'], name: string, parentSpaceId?: string): Promise<Space> {
  const r = await call('POST', '/api/spaces', bearer(user), { kind, name, ...(parentSpaceId ? { parentSpaceId } : {}) });
  expect(r.status).toBe(201);
  const id = (r.body.data as { space: { id: string } }).space.id;
  if (kind !== 'class') await call('POST', `/api/spaces/${id}/code`, bearer(user));
  return (await db.getSpace(id)) as Space;
}
let deviceSeq = 0;
async function registerLearner(): Promise<{ learnerId: string; auth: Record<string, string> }> {
  deviceSeq += 1;
  const deviceId = `device-char${String(deviceSeq).padStart(4, '0')}`;
  const r = await call('POST', '/api/sync/learners', json, { deviceId, learner: { displayName: 'Learner', ageGroup: '5-7', avatar: 'hoya-orange' } });
  expect(r.status).toBe(201);
  const data = r.body.data as { learner: { id: string }; device: { secret: string } };
  return { learnerId: data.learner.id, auth: { ...json, authorization: `Device ${deviceId}:${data.device.secret}` } };
}
const addLearner = (spaceId: string, learnerId: string) => db.addMembership({ spaceId, memberKind: 'learner', memberId: learnerId, role: 'student', joinedAt: 't' });
async function fill(spaceId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) await addLearner(spaceId, `profile:fill-${spaceId}-${i}`);
}
async function classesFor(learnerId: string, n: number, archivedIndex = -1): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    const cls = await createSpace(`teacher-other-${i}`, 'class', `Other ${i}`);
    await addLearner(cls.id, learnerId);
    if (i === archivedIndex) await db.putSpace({ ...cls, archivedAt: 't' });
  }
}
async function schoolWithSeats(seats: number): Promise<{ school: Space; cls: Space }> {
  const school = await createSpace('principal', 'school', 'School');
  const cls = await createSpace('principal', 'class', 'School class', school.id);
  await db.applyEntitlement({ subjectKind: 'space', subjectId: school.id, planKey: 'school_seat', status: 'active', provider: 'manual', seats }, new Date());
  return { school, cls: (await db.getSpace(cls.id)) as Space };
}

/** Each case builds its state and returns the space to join and the learner (registered, with a device). */
type Case = { name: string; expected: Outcome; setup: () => Promise<{ space: Space; learnerId: string; auth: Record<string, string> }> };
const cases: Case[] = [
  {
    name: 'a class with room',
    expected: { status: 201, code: null },
    setup: async () => ({ space: await createSpace('teacher', 'class', 'Room'), ...(await registerLearner()) }),
  },
  {
    name: 'learner already in three classes',
    expected: { status: 409, code: 'cap_learner' },
    setup: async () => {
      const l = await registerLearner();
      await classesFor(l.learnerId, 3);
      return { space: await createSpace('teacher', 'class', 'Fourth'), ...l };
    },
  },
  {
    name: 'three classes, one of them archived',
    expected: { status: 201, code: null },
    setup: async () => {
      const l = await registerLearner();
      await classesFor(l.learnerId, 3, 1);
      return { space: await createSpace('teacher', 'class', 'Fourth'), ...l };
    },
  },
  {
    name: 'three classes and a full class: the learner cap answers first',
    expected: { status: 409, code: 'cap_learner' },
    setup: async () => {
      const l = await registerLearner();
      await classesFor(l.learnerId, 3);
      const cls = await createSpace('teacher', 'class', 'Full');
      await fill(cls.id, 20);
      return { space: cls, ...l };
    },
  },
  {
    name: 'three classes and a full school: the learner cap answers first',
    expected: { status: 409, code: 'cap_learner' },
    setup: async () => {
      const l = await registerLearner();
      const { cls } = await schoolWithSeats(2);
      await fill(cls.id, 2);
      await classesFor(l.learnerId, 3);
      return { space: cls, ...l };
    },
  },
  {
    name: 'a full free class',
    expected: { status: 409, code: 'cap_class' },
    setup: async () => {
      const cls = await createSpace('teacher', 'class', 'Full');
      await fill(cls.id, 20);
      return { space: cls, ...(await registerLearner()) };
    },
  },
  {
    name: 'a class one short of the free cap',
    expected: { status: 201, code: null },
    setup: async () => {
      const cls = await createSpace('teacher', 'class', 'Nearly');
      await fill(cls.id, 19);
      return { space: cls, ...(await registerLearner()) };
    },
  },
  {
    name: 'a licensed class past the free cap',
    expected: { status: 201, code: null },
    setup: async () => {
      const cls = await createSpace('teacher', 'class', 'Pro');
      await fill(cls.id, 25);
      await db.applyEntitlement({ subjectKind: 'space', subjectId: cls.id, planKey: 'group_license', status: 'active', provider: 'manual' }, new Date());
      return { space: cls, ...(await registerLearner()) };
    },
  },
  {
    name: 'a full school',
    expected: { status: 409, code: 'cap_school' },
    setup: async () => {
      const { cls } = await schoolWithSeats(2);
      await fill(cls.id, 2);
      return { space: cls, ...(await registerLearner()) };
    },
  },
  {
    name: 'a full school, learner already counted in another of its classes',
    expected: { status: 201, code: null },
    setup: async () => {
      const { school, cls } = await schoolWithSeats(2);
      const l = await registerLearner();
      const sibling = await createSpace('principal', 'class', 'Sibling', school.id);
      await addLearner(sibling.id, l.learnerId);
      await fill(cls.id, 1);
      return { space: cls, ...l };
    },
  },
  {
    name: 'already a member of a full class',
    expected: { status: 200, code: null },
    setup: async () => {
      const l = await registerLearner();
      const cls = await createSpace('teacher', 'class', 'Mine');
      await fill(cls.id, 19);
      await addLearner(cls.id, l.learnerId);
      await classesFor(l.learnerId, 3);
      return { space: cls, ...l };
    },
  },
  {
    name: 'a family at its learner cap',
    expected: { status: 409, code: 'cap_family' },
    setup: async () => {
      const fam = await createSpace('mom', 'family', 'Family');
      await fill(fam.id, FAMILY_LIFETIME_LEARNERS);
      return { space: (await db.getSpace(fam.id)) as Space, ...(await registerLearner()) };
    },
  },
  {
    name: 'a family with room, learner already in three classes',
    expected: { status: 201, code: null },
    setup: async () => {
      const l = await registerLearner();
      await classesFor(l.learnerId, 3);
      const fam = await createSpace('mom', 'family', 'Family');
      await fill(fam.id, FAMILY_LIFETIME_LEARNERS - 1);
      return { space: (await db.getSpace(fam.id)) as Space, ...l };
    },
  },
  {
    name: 'a school (learners join classes)',
    expected: { status: 422, code: 'not_joinable' },
    setup: async () => ({ space: await createSpace('principal', 'school', 'School'), ...(await registerLearner()) }),
  },
];

beforeEach(async () => {
  await db.reset();
});

describe('/join characterization: old inline order vs classSeatCheck (F-SPACE-002 §4.3, T-4a)', () => {
  it.each(cases)('$name', async ({ expected, setup }) => {
    const { space, learnerId, auth } = await setup();
    const now = new Date();
    const legacy = await legacyJoinOutcome(db, space, learnerId, now);
    expect(legacy).toEqual(expected);

    if (space.kind === 'class') {
      const alreadyMember = !!(await db.membership(space.id, 'learner', learnerId));
      const seat = await classSeatCheck(db, space, learnerId, now);
      expect(seat).toBe(alreadyMember || legacy.code === null ? null : legacy.code);
    }

    const r = await call('POST', `/api/spaces/${space.id}/join`, auth, { code: space.joinCode, learnerId });
    expect({ status: r.status, code: r.body.error?.code ?? null }).toEqual(legacy);
    if (legacy.status === 200) expect(r.body.data).toMatchObject({ alreadyMember: true });
    if (legacy.status === 201) expect(await db.membership(space.id, 'learner', learnerId)).toMatchObject({ role: 'student' });
    if (legacy.status === 409) {
      const cap = (r.body.error?.details as { cap?: number } | undefined)?.cap;
      expect(typeof cap).toBe('number');
      expect(r.body.error?.message).toBe(SEAT_MESSAGES[legacy.code as string]?.(cap as number));
      expect(await db.membership(space.id, 'learner', learnerId)).toBeNull();
    }
  });

  it('covers every cap code and both success shapes', () => {
    const codes = new Set(cases.map((c) => c.expected.code ?? String(c.expected.status)));
    for (const code of ['cap_learner', 'cap_class', 'cap_school', 'cap_family', 'not_joinable', '200', '201']) expect(codes).toContain(code);
  });
});
