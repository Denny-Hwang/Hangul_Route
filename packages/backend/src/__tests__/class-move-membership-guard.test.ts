import { TRANSFER_CONSENT_TEXT_VERSION } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSecret } from '../lib/device-auth';
import { classMoveClientLimiter } from '../routes/class-moves';
import { lookupLimiter } from '../routes/spaces';
import { deviceTransferLimiter } from '../routes/transfer-device';
import { transferClientLimiter } from '../routes/transfers';
import { testDb as db } from './helpers/db';
import {
  A,
  B,
  C,
  CODE_A,
  CODE_B,
  CODE_C,
  DAY,
  FAMILY,
  HOUR,
  NOW,
  OLD,
  SUNI,
  ahead,
  approve,
  bearer,
  call,
  create as createTransfer,
  familyCreate,
  json,
  list,
  member,
  requestOf,
  seed,
  space,
  type Envelope,
} from './helpers/transfer-world';

/*
 * Owner report 2026-10-23: a learner moved from class A to class B showed up in both. The move itself is one guarded
 * batch; the double membership came from the paths around it. These tests hold the server to one rule: a learner is
 * never left in both the source and the destination of a move (a teacher move, direct or accepted, and a family-started
 * F-SPACE-002 transfer). Runs in memory and, with HR_TEST_DB=sqlite, against the real migrations.
 */

const D = 'space:class-d';
const CODE_D = 'DDDDDD';
const PHONE = 'device-phone0001';
const device = { ...json, authorization: `Device ${PHONE}:s` };
const DEVICE_ON = { CLASS_TRANSFER: 'enabled', CLASS_TRANSFER_DEVICE_CONSENT: 'enabled' };

/** The learner's classes (the family left out), sorted. */
const classes = async (): Promise<string[]> =>
  (await db.membershipsOf('learner', SUNI))
    .map((m) => m.spaceId)
    .filter((s) => s !== FAMILY)
    .sort();
const moves = (spaceId: string) => `/api/spaces/${spaceId}/class-moves`;
const join = (spaceId: string, code: string) => call('POST', `/api/spaces/${spaceId}/join`, device, { code, learnerId: SUNI });
const moveId = (r: { body: Envelope }): string => (r.body.data as { move: { id: string } }).move.id;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await db.reset();
  transferClientLimiter.reset();
  classMoveClientLimiter.reset();
  deviceTransferLimiter.reset();
  lookupLimiter.reset();
  await seed();
  await db.putSpace(space(D, 'class', 'teacher-a', { name: 'Evening Class D', joinCode: CODE_D, joinCodeExpiresAt: ahead(20 * DAY) }));
  await member(D, 'account', 'teacher-a', 'owner');
  await db.putDevice({ learnerId: SUNI, deviceId: PHONE, secretHash: await hashSecret('s'), scope: 'full', createdAt: OLD, lastSeenAt: OLD });
});
afterEach(() => vi.useRealTimers());

/** teacher-a moves Suni A -> D directly (teacher-a runs both). */
async function directMoveToD(): Promise<void> {
  const r = await call('POST', moves(A), bearer('teacher-a'), { learnerId: SUNI, destinationSpaceId: D });
  expect(r.status).toBe(200);
  expect(await classes()).toEqual([D]);
}

/** teacher-a asks class B (teacher-b's) to take Suni; the ask waits. */
async function askB(): Promise<string> {
  const r = await call('POST', moves(A), bearer('teacher-a'), { learnerId: SUNI, destinationSpaceId: B, code: CODE_B });
  expect(r.status).toBe(201);
  expect((r.body.data as { move: { status: string } }).move.status).toBe('waiting');
  return moveId(r);
}

/** A family-started transfer A -> B with both teachers in, then past the cooling-off: executed by the settle on a list. */
async function familyTransferToB(): Promise<void> {
  const created = await openFamilyTransferToB();
  await finishFamilyTransfer(created);
}

async function openFamilyTransferToB(): Promise<string> {
  const r = await createTransfer(FAMILY, 'mom', familyCreate());
  expect(r.status).toBe(201);
  return requestOf(r).id;
}

async function finishFamilyTransfer(id: string): Promise<void> {
  expect((await approve(A, 'teacher-a', id, { slots: ['source'] })).status).toBe(200);
  expect((await approve(B, 'teacher-b', id, { slots: ['destination'] })).status).toBe(200);
  vi.setSystemTime(new Date(NOW.getTime() + 49 * HOUR));
  expect((await list(FAMILY, 'mom')).status).toBe(200);
  expect((await db.getTransfer(id))?.status).toBe('executed');
}

describe('(a) a join with the old class code after a move answers 409 moved_out', () => {
  it('after a direct teacher move A -> D', async () => {
    await directMoveToD();
    const r = await join(A, CODE_A);
    expect([r.status, r.body.error?.code]).toEqual([409, 'moved_out']);
    expect(r.body.error?.details).toEqual({ to: { spaceId: D, name: 'Evening Class D' } });
    expect(await classes()).toEqual([D]);
  });

  it('after an accepted teacher move A -> B', async () => {
    const id = await askB();
    expect((await call('POST', `${moves(B)}/${id}/accept`, bearer('teacher-b'), {})).status).toBe(200);
    expect(await classes()).toEqual([B]);
    const r = await join(A, CODE_A);
    expect([r.status, r.body.error?.code]).toEqual([409, 'moved_out']);
    expect(r.body.error?.details).toEqual({ to: { spaceId: B, name: 'Saturday Class B' } });
    expect(await classes()).toEqual([B]);
  });

  it('after an executed family-started transfer A -> B (F-SPACE-002)', async () => {
    await familyTransferToB();
    expect(await classes()).toEqual([B]);
    const r = await join(A, CODE_A);
    expect([r.status, r.body.error?.code]).toEqual([409, 'moved_out']);
    expect(r.body.error?.details).toEqual({ to: { spaceId: B, name: 'Saturday Class B' } });
    expect(await classes()).toEqual([B]);
  });
});

describe('(b) the guard holds only while the move stands', () => {
  it('after leaving the destination, the old class code joins again (201)', async () => {
    await directMoveToD();
    expect((await call('POST', `/api/spaces/${D}/leave`, device, { learnerId: SUNI })).body.data).toEqual({ left: true });
    const r = await join(A, CODE_A);
    expect(r.status).toBe(201);
    expect(await classes()).toEqual([A]);
  });

  it('an archived destination no longer holds the learner out of the source', async () => {
    await directMoveToD();
    expect((await call('POST', `/api/spaces/${D}/archive`, bearer('teacher-a'), {})).status).toBe(200);
    expect((await join(A, CODE_A)).status).toBe(201);
  });

  it('a later move into the source lifts the guard of the earlier move out of it', async () => {
    await directMoveToD();
    expect((await join(C, CODE_C)).status).toBe(201);
    vi.setSystemTime(new Date(NOW.getTime() + HOUR));
    // teacher-c asks class A to take Suni from C; teacher-a accepts: Suni is in A again by a move, and still in D
    const ask = await call('POST', moves(C), bearer('teacher-c'), { learnerId: SUNI, destinationSpaceId: A, code: CODE_A });
    expect(ask.status).toBe(201);
    expect((await call('POST', `${moves(A)}/${moveId(ask)}/accept`, bearer('teacher-a'), {})).status).toBe(200);
    expect(await classes()).toEqual([A, D]);
    // leaving A and coming back is the learner's own choice: the move A -> D no longer stands for A
    expect((await call('POST', `/api/spaces/${A}/leave`, device, { learnerId: SUNI })).status).toBe(200);
    expect((await join(A, CODE_A)).status).toBe(201);
  });
});

describe('(c) a join into the destination of a waiting move answers 409 move_waiting', () => {
  it('a teacher accept move A -> B: the code join is refused, the accept then moves the learner', async () => {
    const id = await askB();
    const r = await join(B, CODE_B);
    expect([r.status, r.body.error?.code]).toEqual([409, 'move_waiting']);
    expect(r.body.error?.details).toEqual({ from: { spaceId: A, name: 'Sunday Class A' } });
    expect(await classes()).toEqual([A]);
    expect((await call('POST', `${moves(B)}/${id}/accept`, bearer('teacher-b'), {})).status).toBe(200);
    expect(await classes()).toEqual([B]);
  });

  it('a declined ask no longer blocks the join', async () => {
    const id = await askB();
    expect((await call('POST', `${moves(B)}/${id}/decline`, bearer('teacher-b'), {})).status).toBe(200);
    expect((await join(B, CODE_B)).status).toBe(201);
    expect(await classes()).toEqual([A, B]);
  });

  it('an open family transfer A -> B: the code join is refused, the executed transfer then leaves B only', async () => {
    const id = await openFamilyTransferToB();
    const r = await join(B, CODE_B);
    expect([r.status, r.body.error?.code]).toEqual([409, 'move_waiting']);
    expect(r.body.error?.details).toEqual({ from: { spaceId: A, name: 'Sunday Class A' } });
    expect(await classes()).toEqual([A]);
    await finishFamilyTransfer(id);
    expect(await classes()).toEqual([B]);
  });
});

describe('(d) unarchive never brings a class back past the 3-class cap', () => {
  it('409 unarchive_over_cap when a learner already holds 3 live classes; the class stays archived', async () => {
    expect((await call('POST', `/api/spaces/${A}/archive`, bearer('teacher-a'), {})).status).toBe(200);
    for (const [id, code] of [
      [B, CODE_B],
      [C, CODE_C],
      [D, CODE_D],
    ] as const) {
      expect((await join(id, code)).status).toBe(201);
    }
    const r = await call('POST', `/api/spaces/${A}/unarchive`, bearer('teacher-a'), {});
    expect([r.status, r.body.error?.code]).toEqual([409, 'unarchive_over_cap']);
    expect(r.body.error?.details).toEqual({ learners: 1 });
    expect((await db.getSpace(A))?.archivedAt).not.toBeNull();
    const live = (await db.getSpaces(await classes())).filter((s) => s.kind === 'class' && !s.archivedAt);
    expect(live).toHaveLength(3);
  });

  it('a learner under the cap: the class comes back', async () => {
    expect((await call('POST', `/api/spaces/${A}/archive`, bearer('teacher-a'), {})).status).toBe(200);
    expect((await join(B, CODE_B)).status).toBe(201);
    const r = await call('POST', `/api/spaces/${A}/unarchive`, bearer('teacher-a'), {});
    expect(r.status).toBe(200);
    expect((await db.getSpace(A))?.archivedAt).toBeNull();
  });
});

describe('(e) a device move start meets an open teacher move', () => {
  it('409 already_open, started by the class', async () => {
    await askB();
    await db.setTransferPref(SUNI, 'selfManaged', true, NOW);
    const consent = { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en', attest: 'self' };
    const r = await call('POST', `/api/sync/learners/${SUNI}/transfer-requests`, device, { fromSpaceId: A, destinationSpaceId: C, code: CODE_C, consent }, DEVICE_ON);
    expect([r.status, r.body.error?.code]).toEqual([409, 'already_open']);
    expect(r.body.error?.details).toEqual({ startedBy: 'class' });
    expect(await db.transfersOfLearner(SUNI)).toEqual([]);
  });
});

describe('(f) a direct move racing an accept ask', () => {
  it('leaves no waiting ask for a learner who already left the source', async () => {
    const [direct, ask] = await Promise.all([
      call('POST', moves(A), bearer('teacher-a'), { learnerId: SUNI, destinationSpaceId: D }),
      call('POST', moves(A), bearer('teacher-a'), { learnerId: SUNI, destinationSpaceId: B, code: CODE_B }),
    ]);
    expect(direct.status).toBe(200);
    expect([404, 409]).toContain(ask.status);
    expect(await db.openClassMoveOf(SUNI)).toBeNull();
    expect(await classes()).toEqual([D]);
  });
});

describe('(g) the /join answers carry the inbox memberships', () => {
  it('201 and the 200 alreadyMember answer equal the inbox list', async () => {
    const first = await join(B, CODE_B);
    expect(first.status).toBe(201);
    const inbox = await call('GET', `/api/sync/learners/${SUNI}/inbox`, device);
    const expected = (inbox.body.data as { memberships: unknown[] }).memberships;
    expect(expected.length).toBeGreaterThan(1);
    expect((first.body.data as { memberships: unknown[] }).memberships).toEqual(expected);
    const again = await join(B, CODE_B);
    expect([again.status, (again.body.data as { alreadyMember: boolean }).alreadyMember]).toEqual([200, true]);
    expect((again.body.data as { memberships: unknown[] }).memberships).toEqual(expected);
  });
});

describe('(h) the lookup tells a vouched learner about a standing or waiting move', () => {
  const lookup = (code: string, headers: Record<string, string> = device) => call('POST', '/api/spaces/lookup', headers, { code, learnerId: SUNI });

  it('moved: the old class code after a move; seat unchanged', async () => {
    const before = (await lookup(CODE_A)).body.data as Record<string, unknown>;
    expect(before.moved).toBeUndefined();
    await directMoveToD();
    const after = (await lookup(CODE_A)).body.data as Record<string, unknown>;
    expect(after.moved).toEqual({ to: { spaceId: D, name: 'Evening Class D' } });
    expect(after.seat).toEqual(before.seat);
    expect(after.seat).toEqual({ full: false, reason: null, cap: null });
    // never for an unvouched caller
    expect(((await lookup(CODE_A, json)).body.data as Record<string, unknown>).moved).toBeUndefined();
  });

  it('moveWaiting: the destination code while an ask waits', async () => {
    await askB();
    const r = (await lookup(CODE_B)).body.data as Record<string, unknown>;
    expect(r.moveWaiting).toEqual({ from: { spaceId: A, name: 'Sunday Class A' } });
    expect(r.seat).toEqual({ full: false, reason: null, cap: null });
    expect(((await lookup(CODE_B, json)).body.data as Record<string, unknown>).moveWaiting).toBeUndefined();
  });
});

describe('inbox class moves name the class moved from', () => {
  it('classMoves[].from carries the source and its live name', async () => {
    await directMoveToD();
    const inbox = await call('GET', `/api/sync/learners/${SUNI}/inbox`, device);
    const [notice] = (inbox.body.data as { classMoves: Array<Record<string, unknown>> }).classMoves;
    expect(notice).toMatchObject({ to: { spaceId: D, name: 'Evening Class D' }, from: { spaceId: A, name: 'Sunday Class A' } });
  });
});
