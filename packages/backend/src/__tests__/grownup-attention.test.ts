import type { StoredRelink } from '../db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROSTER_SETTLE_MAX, rosterGates, spacesAttention } from '../lib/attention';
import type { Action } from '../lib/can';
import { newRequest } from '../lib/transfer';
import { classMoveClientLimiter } from '../routes/class-moves';
import { transferClientLimiter } from '../routes/transfers';
import { testDb as db } from './helpers/db';
import {
  A,
  B,
  CODE_B,
  DAY,
  FAMILY,
  LOCKED,
  MINA,
  NOW,
  OLD,
  SCHOOL,
  SUNI,
  ahead,
  approve,
  bearer,
  call,
  cancel,
  classCreate,
  consent,
  create,
  familyCreate,
  list,
  member,
  requestOf,
  requestsOf,
  seed,
  space,
  type Envelope,
} from './helpers/transfer-world';

/*
 * [GX-W] What waits for a grown-up's answer, read by the roster and the spaces list (AMENDMENTS-GROWNUP-UX section 12):
 * `learners[].pending` and `incoming` on `GET /:id/roster`, `attention` on `GET /api/spaces`, the learner id on the
 * open outgoing class moves and on the family-started source views. Runs in memory and, with HR_TEST_DB=sqlite,
 * against the real migrations.
 *
 * The transfer world: teacher-a owns class A (Suni is in it), teacher-b owns class B (live code BBBBBB), mom owns the
 * family (Suni and Mina), dad is a caregiver of it.
 */

type Row = { id: string; displayName: string; pending?: Record<string, Record<string, unknown>> };
type Item = { space: { id: string }; attention?: { relinks: number; moves: number; relinkExpiresAt: string | null } };

const get = (path: string, user: string, env?: Record<string, string> | typeof LOCKED) => call('GET', path, bearer(user), undefined, env);
const post = (path: string, user: string, body: unknown = {}, env?: Record<string, string> | typeof LOCKED) => call('POST', path, bearer(user), body, env);
const roster = (spaceId: string, user: string, env?: Record<string, string> | typeof LOCKED) => get(`/api/spaces/${spaceId}/roster`, user, env);
const spaces = (user: string, env?: Record<string, string> | typeof LOCKED) => get('/api/spaces', user, env);
const moves = (spaceId: string) => `/api/spaces/${spaceId}/class-moves`;
const rowsOf = (r: { body: Envelope }): Row[] => (r.body.data as { learners: Row[] }).learners;
const rowOf = (r: { body: Envelope }, learnerId: string): Row | undefined => rowsOf(r).find((l) => l.id === learnerId);
const attentionOf = (r: { body: Envelope }, spaceId: string) => (r.body.data as { spaces: Item[] }).spaces.find((s) => s.space.id === spaceId)?.attention;
const travel = (ms: number) => vi.setSystemTime(new Date(NOW.getTime() + ms));

const relink = (id: string, spaceId: string, learnerId: string, expiresAt: string, status: StoredRelink['status'] = 'pending'): StoredRelink => ({
  id,
  spaceId,
  learnerId,
  deviceId: `device-${id.slice(7)}0000`,
  platform: null,
  requestedAt: OLD,
  expiresAt,
  status,
  decidedAt: null,
  secret: null,
});

/** teacher-a asks class B (by its code) to take Suni: a teacher move waiting for B (TV-D8). */
async function askB(): Promise<string> {
  const r = await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: B, code: CODE_B });
  expect(r.status).toBe(201);
  return (r.body.data as { move: { id: string } }).move.id;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await db.reset();
  transferClientLimiter.reset();
  classMoveClientLimiter.reset();
  await seed();
});
afterEach(() => vi.useRealTimers());

describe('roster pending.relink (gate: roster.manage)', () => {
  it('names the pending re-link on its learner only, the soonest one first; nothing on the others', async () => {
    await db.putRelink(relink('relink:late', A, SUNI, ahead(9 * 60_000)));
    await db.putRelink(relink('relink:soon', A, SUNI, ahead(8 * 60_000)));
    await member(A, 'learner', MINA, 'student');
    const r = await roster(A, 'teacher-a');
    expect(r.status).toBe(200);
    expect(rowOf(r, SUNI)?.pending).toEqual({ relink: { id: 'relink:soon', expiresAt: ahead(8 * 60_000) } });
    expect(rowOf(r, MINA)).not.toHaveProperty('pending');
    expect(r.body.data).toMatchObject({ incoming: 0 });
  });

  it('settles a re-link past its window before reading (expired as the list route does), and shows none', async () => {
    await db.putRelink(relink('relink:old', A, SUNI, ahead(-60_000)));
    const r = await roster(A, 'teacher-a');
    expect(rowOf(r, SUNI)).not.toHaveProperty('pending');
    expect((await db.getRelink('relink:old'))?.status).toBe('expired');
  });

  it('shows a re-link while class moves are locked; the move fields are then absent', async () => {
    await db.putRelink(relink('relink:1', A, SUNI, ahead(5 * 60_000)));
    const r = await roster(A, 'teacher-a', LOCKED);
    expect(rowOf(r, SUNI)?.pending).toEqual({ relink: { id: 'relink:1', expiresAt: ahead(5 * 60_000) } });
    expect(r.body.data).not.toHaveProperty('incoming');
  });
});

describe('roster pending.move of a family-started transfer (gate: learner.transfer on a class)', () => {
  it('walks the source class through yours, others and scheduled, and the destination counts it as incoming while its step waits', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const a1 = await roster(A, 'teacher-a');
    expect(rowOf(a1, SUNI)?.pending).toEqual({ move: { source: 'transfer', id: created.id, step: 'yours', to: null, on: null, expiresAt: created.expiresAt, waitingOn: ['destination'] } });
    const b1 = await roster(B, 'teacher-b');
    expect(b1.body.data).toMatchObject({ incoming: 1 });

    expect((await approve(A, 'teacher-a', created.id, { slots: ['source'] })).status).toBe(200);
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)?.pending?.move).toMatchObject({ step: 'others', waitingOn: ['destination'] });
    expect((await roster(B, 'teacher-b')).body.data).toMatchObject({ incoming: 1 });

    expect((await approve(B, 'teacher-b', created.id, { slots: ['destination'] })).status).toBe(200);
    const stored = await db.getTransfer(created.id);
    expect(stored?.status).toBe('approved');
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)?.pending?.move).toMatchObject({ step: 'scheduled', on: stored?.executeAfter, waitingOn: [] });
    expect((await roster(B, 'teacher-b')).body.data).toMatchObject({ incoming: 0 });

    await db.blockTransfer(created.id, 'cap_class', new Date());
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)?.pending?.move).toMatchObject({ step: 'room', on: null });
  });

  it('names the destination only when the family introduced the request (TV-D8)', async () => {
    await create(FAMILY, 'mom', familyCreate({ introduce: true }));
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)?.pending?.move).toMatchObject({ step: 'yours', to: 'Saturday Class B' });
  });

  it('a class-started move says who it waits on (review V1-1): the family first, then the destination once it may see it', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    // `to` is the destination the source chose; it is not the one being waited on until the family says yes (T8)
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)?.pending?.move).toMatchObject({ step: 'others', to: 'Saturday Class B', waitingOn: ['learner'] });
    expect((await roster(B, 'teacher-b')).body.data).toMatchObject({ incoming: 0 });
    expect((await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent })).status).toBe(200);
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)?.pending?.move).toMatchObject({ step: 'others', to: 'Saturday Class B', waitingOn: ['destination'] });
    expect((await roster(B, 'teacher-b')).body.data).toMatchObject({ incoming: 1 });
  });

  it('settles before reading the members: a transfer executed on read lists the learner as a member of the destination only', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    travel(3 * DAY);
    const a = await roster(A, 'teacher-a');
    expect(rowOf(a, SUNI)).toBeUndefined();
    expect((await db.getTransfer(created.id))?.status).toBe('executed');
    const b = await roster(B, 'teacher-b');
    expect(rowOf(b, SUNI)).toBeDefined();
    expect(rowOf(b, SUNI)).not.toHaveProperty('pending');
    expect(b.body.data).toMatchObject({ incoming: 0 });
  });

  it('leaves out an expired request without a write (review V1-2): no chip, nothing incoming; the list route ends it', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    travel(15 * DAY);
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)).not.toHaveProperty('pending');
    expect((await roster(B, 'teacher-b')).body.data).toMatchObject({ incoming: 0 });
    expect((await db.getTransfer(created.id))?.status).toBe('requested');
    await list(A, 'teacher-a');
    expect((await db.getTransfer(created.id))?.status).toBe('expired');
  });

  it('leaves out a request whose learner left the source or whose destination was archived', async () => {
    await create(FAMILY, 'mom', familyCreate());
    await db.putSpace({ ...(await db.getSpace(B))!, archivedAt: OLD });
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)).not.toHaveProperty('pending');
    expect(rowOf(await roster(FAMILY, 'mom'), SUNI)).not.toHaveProperty('pending');
  });

  it(`settles at most ${ROSTER_SETTLE_MAX} due requests a read; the rest show as they stand and settle on the next reads`, async () => {
    const learners = ['profile:due-1', 'profile:due-2', 'profile:due-3'];
    for (const id of learners) {
      await db.putLearner({ id, displayName: id, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
      await member(A, 'learner', id, 'student');
      await member(FAMILY, 'learner', id, 'student');
      const created = requestOf(await create(FAMILY, 'mom', familyCreate({ learnerId: id })));
      await approve(A, 'teacher-a', created.id, { slots: ['source'] });
      await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    }
    travel(3 * DAY);
    const first = await roster(A, 'teacher-a');
    expect(learners.filter((id) => rowOf(first, id) === undefined)).toHaveLength(ROSTER_SETTLE_MAX);
    const left = learners.filter((id) => rowOf(first, id) !== undefined);
    for (const id of left) expect(rowOf(first, id)?.pending?.move).toMatchObject({ step: 'scheduled' });
    const second = await roster(A, 'teacher-a');
    expect(learners.filter((id) => rowOf(second, id) !== undefined)).toEqual([]);
  });
});

describe('roster pending.move of a teacher move (TV-D8) and its privacy at the destination', () => {
  it('the source sees others with the class it chose; the destination counts it and learns nothing of the learner', async () => {
    const id = await askB();
    const a = await roster(A, 'teacher-a');
    const move = (await db.getClassMove(id))!;
    expect(rowOf(a, SUNI)?.pending).toEqual({ move: { source: 'teacher', id, step: 'others', to: 'Saturday Class B', on: null, expiresAt: move.expiresAt, waitingOn: ['destination'] } });
    const b = await roster(B, 'teacher-b');
    expect(b.body.data).toMatchObject({ incoming: 1 });
    expect(JSON.stringify(b.body)).not.toMatch(/Suni|profile:suni/);

    expect((await post(`${moves(B)}/${id}/decline`, 'teacher-b')).status).toBe(200);
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)).not.toHaveProperty('pending');
    expect((await roster(B, 'teacher-b')).body.data).toMatchObject({ incoming: 0 });
  });

  it('an ask past its 14 days is left out before reading, without a write', async () => {
    const id = await askB();
    travel(15 * DAY);
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)).not.toHaveProperty('pending');
    expect((await roster(B, 'teacher-b')).body.data).toMatchObject({ incoming: 0 });
    expect((await db.getClassMove(id))?.status).toBe('requested');
  });

  it('an ask whose destination was archived, or whose learner left, shows nowhere', async () => {
    await askB();
    await db.putSpace({ ...(await db.getSpace(B))!, archivedAt: OLD });
    expect(rowOf(await roster(A, 'teacher-a'), SUNI)).not.toHaveProperty('pending');
  });
});

describe('family roster (gate: snapshot.read)', () => {
  it('a teacher-started request waits for the family: yours, with the class named; no incoming on a family', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    const r = await roster(FAMILY, 'dad');
    expect(rowOf(r, SUNI)?.pending).toEqual({ move: { source: 'transfer', id: created.id, step: 'yours', to: 'Saturday Class B', on: null, expiresAt: created.expiresAt, waitingOn: [] } });
    expect(rowOf(r, MINA)).not.toHaveProperty('pending');
    expect(r.body.data).not.toHaveProperty('incoming');
  });

  it('a request the family started waits for the classes: others, naming which classes still answer', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    expect(rowOf(await roster(FAMILY, 'mom'), SUNI)?.pending?.move).toMatchObject({ step: 'others', waitingOn: ['source', 'destination'] });
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    expect(rowOf(await roster(FAMILY, 'mom'), SUNI)?.pending?.move).toMatchObject({ step: 'others', waitingOn: ['destination'] });
  });

  it("shows a child's re-link on the family roster", async () => {
    await db.putRelink(relink('relink:fam', FAMILY, MINA, ahead(4 * 60_000)));
    expect(rowOf(await roster(FAMILY, 'mom'), MINA)?.pending).toEqual({ relink: { id: 'relink:fam', expiresAt: ahead(4 * 60_000) } });
  });
});

describe('rosterGates: each field only with the action that can decide it', () => {
  const set = (...actions: Action[]) => new Set<Action>(actions);
  it('relink needs roster.manage; a class move and incoming need learner.transfer; a family move needs snapshot.read', () => {
    expect(rosterGates('class', set('summary.read'), true)).toEqual({ relink: false, move: false, incoming: false });
    expect(rosterGates('class', set('summary.read', 'roster.manage'), true)).toEqual({ relink: true, move: false, incoming: false });
    expect(rosterGates('class', set('summary.read', 'learner.transfer'), true)).toEqual({ relink: false, move: true, incoming: true });
    expect(rosterGates('family', set('summary.read', 'roster.manage'), true)).toEqual({ relink: true, move: false, incoming: false });
    expect(rosterGates('family', set('summary.read', 'snapshot.read'), true)).toEqual({ relink: false, move: true, incoming: false });
    expect(rosterGates('school', set('summary.read', 'roster.manage', 'learner.transfer', 'snapshot.read'), true)).toEqual({ relink: true, move: false, incoming: false });
  });
  it('no move field while class moves are locked', () => {
    expect(rosterGates('class', set('roster.manage', 'learner.transfer'), false)).toEqual({ relink: true, move: false, incoming: false });
    expect(rosterGates('family', set('roster.manage', 'snapshot.read'), false)).toEqual({ relink: true, move: false, incoming: false });
  });
});

describe('learner ids on the source views the source class already lists (GX-OD-2)', () => {
  it('a family-started request carries the learner id at the source while open, and none once ended; the destination never', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate({ introduce: true })));
    expect(requestsOf(await list(A, 'teacher-a'))[0]).toMatchObject({ role: 'source', initiator: 'learner_side', learnerId: SUNI });
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    expect(JSON.stringify(requestsOf(await list(B, 'teacher-b')))).not.toContain(SUNI);
    expect((await cancel(FAMILY, 'mom', created.id)).status).toBe(200);
    expect(requestsOf(await list(A, 'teacher-a'))[0]).toMatchObject({ status: 'ended', learnerId: null });
  });

  it('an outgoing teacher move carries the learner id while it waits, and none once it ended', async () => {
    const id = await askB();
    const out1 = (await get(moves(A), 'teacher-a')).body.data as { outgoing: Array<Record<string, unknown>>; incoming: Array<Record<string, unknown>> };
    expect(out1.outgoing[0]).toMatchObject({ id, status: 'waiting', learnerId: SUNI });
    const into = (await get(moves(B), 'teacher-b')).body.data as { incoming: Array<Record<string, unknown>> };
    expect(into.incoming[0]).not.toHaveProperty('learnerId');
    await post(`${moves(A)}/${id}/cancel`, 'teacher-a');
    const out2 = (await get(moves(A), 'teacher-a')).body.data as { outgoing: Array<Record<string, unknown>> };
    expect(out2.outgoing[0]).toMatchObject({ id, status: 'ended', learnerId: null });
  });
});

/** The client's count of a class (AMENDMENTS-GROWNUP-UX section 3.4), from the three list routes. */
async function clientCount(spaceId: string, user: string): Promise<{ relinks: number; moves: number }> {
  const relinks = ((await get(`/api/spaces/${spaceId}/relink-requests`, user)).body.data as { requests: unknown[] }).requests.length;
  const views = requestsOf(await list(spaceId, user)) as unknown as Array<{ status: string; role: string; steps: Record<string, string> | null; learnerState?: string }>;
  const own = views.filter((v) => v.status === 'requested' && (v.role === 'learner_side' ? v.learnerState === 'pending' : v.steps?.[v.role] === 'waiting')).length;
  const incoming = ((await get(moves(spaceId), user)).body.data as { incoming: Array<{ status: string; kind: string }> }).incoming.filter((m) => m.status === 'waiting' && m.kind === 'accept').length;
  return { relinks, moves: own + incoming };
}

describe('GET /api/spaces attention', () => {
  it('counts what waits for each class, by the client rule, with the soonest re-link expiry', async () => {
    await db.putRelink(relink('relink:a1', A, SUNI, ahead(7 * 60_000)));
    await db.putRelink(relink('relink:a2', A, SUNI, ahead(3 * 60_000)));
    await create(FAMILY, 'mom', familyCreate());
    await member(A, 'learner', MINA, 'student');
    await post(moves(A), 'teacher-a', { learnerId: MINA, destinationSpaceId: B, code: CODE_B });

    const a = attentionOf(await spaces('teacher-a'), A);
    expect(a).toEqual({ relinks: 2, moves: 1, relinkExpiresAt: ahead(3 * 60_000) });
    expect({ relinks: a?.relinks, moves: a?.moves }).toEqual(await clientCount(A, 'teacher-a'));

    const b = attentionOf(await spaces('teacher-b'), B);
    expect(b).toEqual({ relinks: 0, moves: 2, relinkExpiresAt: null });
    expect({ relinks: b?.relinks, moves: b?.moves }).toEqual(await clientCount(B, 'teacher-b'));
  });

  it('a family counts the moves waiting for its own yes and its children\'s re-links', async () => {
    await create(A, 'teacher-a', classCreate());
    await db.putRelink(relink('relink:fam', FAMILY, MINA, ahead(6 * 60_000)));
    expect(attentionOf(await spaces('dad'), FAMILY)).toEqual({ relinks: 1, moves: 1, relinkExpiresAt: ahead(6 * 60_000) });
    expect(attentionOf(await spaces('mom'), FAMILY)?.moves).toBe(requestsOf(await list(FAMILY, 'mom')).filter((v) => v.status === 'requested' && v.learnerState === 'pending').length);
  });

  it('leaves out a re-link past its window and a move past its 14 days, writes nothing, and still equals the lists after they settle', async () => {
    const id = await askB();
    await db.putRelink(relink('relink:past', B, SUNI, ahead(60_000)));
    travel(15 * DAY);
    const before = { relink: await db.getRelink('relink:past'), move: await db.getClassMove(id) };
    const b = attentionOf(await spaces('teacher-b'), B);
    expect(b).toEqual({ relinks: 0, moves: 0, relinkExpiresAt: null });
    expect({ relink: await db.getRelink('relink:past'), move: await db.getClassMove(id) }).toEqual(before);
    expect(before.move?.status).toBe('requested');
    expect(await clientCount(B, 'teacher-b')).toEqual({ relinks: 0, moves: 0 });
    expect((await db.getClassMove(id))?.status).toBe('expired');
    expect(attentionOf(await spaces('teacher-b'), B)).toEqual(b);
  });

  it('does not count a move whose learner left the source class or whose destination was archived', async () => {
    await askB();
    expect(attentionOf(await spaces('teacher-b'), B)?.moves).toBe(1);
    await db.removeMembership(A, 'learner', SUNI);
    expect(attentionOf(await spaces('teacher-b'), B)?.moves).toBe(0);
  });

  it('does not count a move into an archived destination, nor a family-started request into it', async () => {
    await member(A, 'learner', MINA, 'student');
    await post(moves(A), 'teacher-a', { learnerId: MINA, destinationSpaceId: B, code: CODE_B });
    await create(FAMILY, 'mom', familyCreate());
    await approve(A, 'teacher-a', requestsOf(await list(A, 'teacher-a'))[0]!.id, { slots: ['source'] });
    const items = [{ space: (await db.getSpace(B))!, allowed: new Set<Action>(['roster.manage', 'learner.transfer']) }];
    expect((await spacesAttention(db, items, new Date(), undefined)).get(B)?.moves).toBe(2);
    const archived = { ...(await db.getSpace(B))!, archivedAt: OLD };
    await db.putSpace(archived);
    // counted as the live destination's own row would be, had it not been archived: the rows into it no longer count
    expect((await spacesAttention(db, [{ space: { ...archived, archivedAt: null }, allowed: items[0]!.allowed }], new Date(), undefined)).get(B)?.moves).toBe(0);
  });

  it('counts re-links while class moves are locked; the moves are then 0', async () => {
    await askB();
    await db.putRelink(relink('relink:1', B, SUNI, ahead(5 * 60_000)));
    expect(attentionOf(await spaces('teacher-b', LOCKED), B)).toEqual({ relinks: 1, moves: 0, relinkExpiresAt: ahead(5 * 60_000) });
  });

  it("a school's own row counts the school space only (its classes come from the school's attention read); a school teacher gets none", async () => {
    await schoolWorld();
    expect(attentionOf(await spaces('admin'), SCHOOL)).toEqual({ relinks: 0, moves: 0, relinkExpiresAt: null });
    expect(attentionOf(await spaces('teacher-c'), SCHOOL)).toBeUndefined();
  });

  it('T8: a class-started request whose learner step waits counts 0 for the destination (attention, incoming, list)', async () => {
    await create(A, 'teacher-a', classCreate());
    expect(attentionOf(await spaces('teacher-b'), B)).toEqual({ relinks: 0, moves: 0, relinkExpiresAt: null });
    expect((await roster(B, 'teacher-b')).body.data).toMatchObject({ incoming: 0 });
    expect(requestsOf(await list(B, 'teacher-b'))).toEqual([]);
  });

  it('a move of a self-managed learner counts 0 for the family, and reads as waiting for others on its roster', async () => {
    // asked before the learner took over their own classes: the family can no longer answer it (learnerRoute 'none')
    expect((await create(A, 'teacher-a', classCreate())).status).toBe(201);
    expect(attentionOf(await spaces('mom'), FAMILY)?.moves).toBe(1);
    await db.setTransferPref(SUNI, 'selfManaged', true, NOW);
    expect(requestsOf(await list(FAMILY, 'mom'))[0]).toMatchObject({ learnerState: 'pending', learnerRoute: 'none' });
    expect(attentionOf(await spaces('mom'), FAMILY)?.moves).toBe(0);
    expect(rowOf(await roster(FAMILY, 'mom'), SUNI)?.pending?.move).toMatchObject({ step: 'others', waitingOn: ['learner'] });
  });

  it('leaves attention off an archived space', async () => {
    await db.putRelink(relink('relink:1', A, SUNI, ahead(5 * 60_000)));
    await db.putSpace({ ...(await db.getSpace(A))!, archivedAt: OLD });
    expect(attentionOf(await spaces('teacher-a'), A)).toBeUndefined();
  });

  it('carries counts only: no learner name or id in any attention', async () => {
    await db.putRelink(relink('relink:1', A, SUNI, ahead(5 * 60_000)));
    await askB();
    const r = await spaces('teacher-b');
    expect(JSON.stringify((r.body.data as { spaces: Item[] }).spaces.map((s) => s.attention))).not.toMatch(/Suni|profile:/);
  });
});

/** The school above classes A and B (and an archived class C under it): admin owns it, teacher-c teaches in it. */
async function schoolWorld(): Promise<void> {
  await db.putSpace(space(SCHOOL, 'school', 'admin', { name: 'Hangul School' }));
  await member(SCHOOL, 'account', 'admin', 'owner');
  await member(SCHOOL, 'account', 'teacher-c', 'teacher');
  await db.putSpace({ ...(await db.getSpace(A))!, parentSpaceId: SCHOOL });
  await db.putSpace({ ...(await db.getSpace(B))!, parentSpaceId: SCHOOL });
  await db.putSpace(space('space:class-gone', 'class', 'admin', { parentSpaceId: SCHOOL, archivedAt: OLD }));
}

describe("a school's GET /:id/attention", () => {
  it('gives every live child class to the school owner, who is a member of none of them', async () => {
    await schoolWorld();
    await db.putRelink(relink('relink:a', A, SUNI, ahead(5 * 60_000)));
    await db.putRelink(relink('relink:gone', 'space:class-gone', SUNI, ahead(2 * 60_000)));
    await askB();
    const r = await get(`/api/spaces/${SCHOOL}/attention`, 'admin');
    expect(r.status).toBe(200);
    const classes = (r.body.data as { classes: Array<{ spaceId: string }> }).classes;
    expect([...classes].sort((x, y) => x.spaceId.localeCompare(y.spaceId))).toEqual([
      { spaceId: A, relinks: 1, moves: 0, relinkExpiresAt: ahead(5 * 60_000) },
      { spaceId: B, relinks: 0, moves: 1, relinkExpiresAt: null },
    ]);
    // the same counts as each class's own row for its teacher
    expect(attentionOf(await spaces('teacher-b'), B)).toEqual({ relinks: 0, moves: 1, relinkExpiresAt: null });
    expect(JSON.stringify(r.body)).not.toMatch(/Suni|profile:/);
  });

  it('counts moves 0 while class moves are locked, re-links still', async () => {
    await schoolWorld();
    await db.putRelink(relink('relink:a', A, SUNI, ahead(5 * 60_000)));
    await askB();
    const classes = ((await get(`/api/spaces/${SCHOOL}/attention`, 'admin', LOCKED)).body.data as { classes: Array<{ spaceId: string; moves: number; relinks: number }> }).classes;
    expect(classes.map((x) => [x.spaceId, x.relinks, x.moves]).sort()).toEqual([
      [A, 1, 0],
      [B, 0, 0],
    ]);
  });

  it('answers 404 to anyone else, and for a space that is not a live school', async () => {
    await schoolWorld();
    for (const user of ['teacher-c', 'teacher-a', 'mom', 'stranger']) expect((await get(`/api/spaces/${SCHOOL}/attention`, user)).status, user).toBe(404);
    expect((await get(`/api/spaces/${A}/attention`, 'teacher-a')).status).toBe(404);
    expect((await get('/api/spaces/space:none/attention', 'admin')).status).toBe(404);
    await db.putSpace({ ...(await db.getSpace(SCHOOL))!, archivedAt: OLD });
    expect((await get(`/api/spaces/${SCHOOL}/attention`, 'admin')).status).toBe(404);
    expect((await call('GET', `/api/spaces/${SCHOOL}/attention`, { 'content-type': 'application/json' })).status).toBe(401);
  });
});

describe('statement budget of the attention reads (Workers Free: 50 a request)', () => {
  type D1 = InstanceType<(typeof import('../db/d1'))['D1Db']>;

  /** Builds a world with `setup` on the real SQLite D1, then counts the statements `run` prepares. */
  async function counted(setup: (d1db: D1) => Promise<void>, run: (d1db: D1) => Promise<void>): Promise<number> {
    const { openSqliteD1 } = await import('./helpers/sqlite');
    const { D1Db } = await import('../db/d1');
    const { setFallbackDb, fallbackDb } = await import('../db');
    const sqlite = openSqliteD1();
    let count = 0;
    let counting = false;
    const wrapped = {
      prepare(text: string) {
        if (counting) count += 1;
        return sqlite.prepare(text);
      },
      batch: (stmts: Parameters<typeof sqlite.batch>[0]) => sqlite.batch(stmts),
    };
    const before = fallbackDb();
    try {
      const d1db = new D1Db(wrapped);
      setFallbackDb(d1db);
      await d1db.putAccount({ id: 'admin', email: null, displayName: null, consent: null, createdAt: OLD });
      await d1db.putAccount({ id: 'other', email: null, displayName: null, consent: null, createdAt: OLD });
      await d1db.putSpace(space('space:elsewhere', 'class', 'other'));
      await setup(d1db);
      await spaces('admin'); // the first-sign-in upsert is not part of the budget
      counting = true;
      await run(d1db);
      counting = false;
      return count;
    } finally {
      setFallbackDb(before);
      sqlite.close();
    }
  }

  const cls = (i: number) => `space:sc-${String(i).padStart(2, '0')}`;
  const putLearner = (d1db: D1, id: string) => d1db.putLearner({ id, displayName: id, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
  const askInto = (d1db: D1, id: string, learnerId: string, destSpaceId: string) =>
    d1db.createClassMove({ id, learnerId, sourceSpaceId: 'space:elsewhere', destSpaceId, kind: 'accept', status: 'requested', actorAccountId: 'other', actorVia: 'owner', decidedAccountId: null, decidedVia: null, endReason: null, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), expiresAt: ahead(14 * DAY), executedAt: null, endedAt: null, familySeenAt: null });

  /** A school whose admin owns `classes` classes, each with a learner, a pending re-link and a teacher move waiting for it. */
  async function busySchool(d1db: D1, classes: number): Promise<void> {
    await d1db.putSpace(space(SCHOOL, 'school', 'admin'));
    await d1db.addMembership({ spaceId: SCHOOL, memberKind: 'account', memberId: 'admin', role: 'owner', joinedAt: OLD });
    for (let i = 0; i < classes; i += 1) await d1db.putSpace(space(cls(i), 'class', 'admin', { parentSpaceId: SCHOOL }));
    for (let i = 0; i < classes; i += 1) {
      const learner = `profile:l-${i}`;
      await putLearner(d1db, learner);
      await d1db.addMembership({ spaceId: cls(i), memberKind: 'learner', memberId: learner, role: 'student', joinedAt: OLD });
      await d1db.putRelink(relink(`relink:r${i}`, cls(i), learner, ahead(5 * 60_000)));
      // a learner of a class outside the school, asked into this class (a teacher move waiting for it)
      const outsider = `profile:e-${i}`;
      await putLearner(d1db, outsider);
      await d1db.addMembership({ spaceId: 'space:elsewhere', memberKind: 'learner', memberId: outsider, role: 'student', joinedAt: OLD });
      await askInto(d1db, `move:m${i}`, outsider, cls(i));
    }
  }

  async function prepared(classes: number, path: string): Promise<number> {
    return counted(
      (d1db) => busySchool(d1db, classes),
      async () => {
        const r = await get(path, 'admin');
        expect(r.status).toBe(200);
        if (path.endsWith('/attention')) {
          const rows = (r.body.data as { classes: Array<{ relinks: number; moves: number }> }).classes;
          expect(rows).toHaveLength(classes);
          expect(rows.every((x) => x.relinks === 1 && x.moves === 1)).toBe(true);
        }
      },
    );
  }

  it("a school's attention with 60 busy classes prepares as many statements as with 1, well under 50", async () => {
    const one = await prepared(1, `/api/spaces/${SCHOOL}/attention`);
    const sixty = await prepared(60, `/api/spaces/${SCHOOL}/attention`);
    expect(sixty).toBe(one);
    expect(sixty).toBeLessThanOrEqual(15);
  });

  it("the school admin's spaces list stays flat too", async () => {
    const one = await prepared(1, '/api/spaces');
    const sixty = await prepared(60, '/api/spaces');
    expect(sixty).toBe(one);
    expect(sixty).toBeLessThanOrEqual(15);
  });

  it('the attention of a teacher who holds 60 busy classes takes as many statements as of one class', async () => {
    // spacesAttention itself, for a caller who is a member of every class (the route's own per-space reads are not GX-W's)
    const run = (classes: number) =>
      counted(
        (d1db) => busySchool(d1db, classes),
        async (d1db) => {
          const items = await Promise.all(Array.from({ length: classes }, async (_, i) => ({ space: (await d1db.getSpace(cls(i)))!, allowed: new Set<Action>(['roster.manage', 'learner.transfer']) })));
          const before = Date.now();
          const counts = await spacesAttention(d1db, items, new Date(before), undefined);
          expect([...counts.values()].every((x) => x.relinks === 1 && x.moves === 1)).toBe(true);
        },
      );
    // the item spaces are read inside the counted window: one getSpace each, so subtract them
    const one = (await run(1)) - 1;
    const sixty = (await run(60)) - 60;
    expect(sixty).toBe(one);
    expect(sixty).toBeLessThanOrEqual(10);
  });

  it('the class roster with 20 open requests into it and 20 asks takes as many statements as with 1 of each (review V1-2)', async () => {
    const DEST = 'space:dest';
    const run = (open: number) =>
      counted(
        async (d1db) => {
          await d1db.putSpace(space(DEST, 'class', 'admin'));
          await d1db.addMembership({ spaceId: DEST, memberKind: 'account', memberId: 'admin', role: 'owner', joinedAt: OLD });
          for (let i = 0; i < 3; i += 1) {
            await putLearner(d1db, `profile:m-${i}`);
            await d1db.addMembership({ spaceId: DEST, memberKind: 'learner', memberId: `profile:m-${i}`, role: 'student', joinedAt: OLD });
          }
          for (let i = 0; i < open; i += 1) {
            for (const kind of ['t', 'a'] as const) {
              const learner = `profile:${kind}-${i}`;
              await putLearner(d1db, learner);
              await d1db.addMembership({ spaceId: 'space:elsewhere', memberKind: 'learner', memberId: learner, role: 'student', joinedAt: OLD });
            }
            await askInto(d1db, `move:a${i}`, `profile:a-${i}`, DEST);
            // a family-started request into DEST: the family said yes, so DEST's own step waits (T8)
            const row = newRequest({
              id: `transfer:t${i}`,
              learnerId: `profile:t-${i}`,
              sourceSpaceId: 'space:elsewhere',
              destSpaceId: DEST,
              introduce: false,
              now: NOW,
              initiator: 'learner_side',
              initiatorAccountId: 'other',
              consent: {
                basis: 'caregiver',
                attest: null,
                evidence: 'other',
                role: 'owner',
                textVersion: consent.textVersion,
                locale: 'en',
                shown: { lineIds: ['moving'], flags: {} },
                terms: { destNameHash: 'a'.repeat(64), destConsentMode: 'parent', destAnonymize: false, destOwnerId: 'admin', sourceNameHash: 'b'.repeat(64), premiumChange: 'none' },
              },
            });
            expect(await d1db.createTransfer(row, { at: row.createdAt, actorKind: 'account', actorRef: 'other', event: 'created', slot: null, detail: null })).toBe('created');
          }
        },
        async () => {
          const r = await roster(DEST, 'admin');
          expect(r.status).toBe(200);
          expect(r.body.data).toMatchObject({ incoming: 2 * open });
          expect(rowsOf(r)).toHaveLength(3);
        },
      );
    const one = await run(1);
    const twenty = await run(20);
    expect(twenty).toBe(one);
    // three members (two reads each) and the roster's own reads; the open moves add nothing per row
    expect(twenty).toBeLessThanOrEqual(25);
  });
});
