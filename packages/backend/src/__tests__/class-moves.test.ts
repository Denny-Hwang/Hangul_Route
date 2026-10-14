import { CLASS_SCOPE_TEXT_VERSION, type ProgressSummary } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transferRateKey, type NewNote } from '../db';
import { runScheduledPurge } from '../lib/note-retention';
import { hashSecret } from '../lib/device-auth';
import { classMoveClientLimiter } from '../routes/class-moves';
import { transferClientLimiter } from '../routes/transfers';
import { store } from '../store';
import { testDb as db } from './helpers/db';
import {
  A,
  B,
  CODE_B,
  DAY,
  FAMILY,
  FAMILY2,
  LOCKED,
  MINA,
  NOW,
  OLD,
  ON,
  SUNI,
  bearer,
  call,
  consent,
  create as createTransfer,
  approve as approveTransfer,
  classCreate,
  filler,
  json,
  member,
  seed,
  space,
  type Envelope,
} from './helpers/transfer-world';

/*
 * [TV] Teacher moves and the class-scope update — AMENDMENTS-TEACHER-VISIBILITY-TRANSFER
 * sections 2 and 4.3 (owner decisions 2026-10-14). Runs in memory and, with HR_TEST_DB=sqlite,
 * against migration 0009 through the shim.
 *
 * The transfer world: teacher-a owns class A (Suni is in it) and, here, class D; teacher-b owns
 * class B (live code BBBBBB); mom owns the family (Suni and Mina), dad is a caregiver of it; aunt
 * owns a second family with Mina only.
 */

const D = 'space:class-d';
const SCHOOL = 'space:school-x';
const S1 = 'space:school-class-1';
const S2 = 'space:school-class-2';
const PHONE = 'device-phone0001';
const PHONE_SECRET = 'phone-secret';
const TABLET = 'device-tablet001';
const TABLET_SECRET = 'tablet-secret';

const moves = (spaceId: string) => `/api/spaces/${spaceId}/class-moves`;
const post = (path: string, user: string, body: unknown = {}, env?: Record<string, string> | typeof LOCKED) => call('POST', path, bearer(user), body, env);
const get = (path: string, user: string, env?: Record<string, string> | typeof LOCKED) => call('GET', path, bearer(user), undefined, env);
const device = (deviceId: string, secret: string): Record<string, string> => ({ ...json, authorization: `Device ${deviceId}:${secret}` });

type Move = Record<string, unknown> & { id: string; status: string };
const moveOf = (r: { body: Envelope }): Move => (r.body.data as { move: Move }).move;
const listOf = (r: { body: Envelope }) => r.body.data as { outgoing: Move[]; incoming: Move[] };
const isIn = async (spaceId: string, learnerId = SUNI): Promise<boolean> => (await db.membership(spaceId, 'learner', learnerId)) !== null;

const vocab = { collected: 12, strong: 4, topicsStarted: 2, topicsPracticed7d: 1, firstTryRate: 0.75, needsPractice: ['vocab:bap'] };
const summary: ProgressSummary = {
  schemaVersion: 1,
  lastActiveAt: OLD,
  streakDays: 2,
  stage1: { questsDone: 3, questsTotal: 11, anchorAccuracy: 0.8 },
  cardsUnlocked: 4,
  minutesLast7d: 20,
  jamoRecognized: ['ㄱ'],
  needsPractice: [],
  stage1Anchor: { met: true, checkedAt: OLD, tricky: ['ㄹ'] },
  planProgress: {},
  vocab,
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await db.reset();
  transferClientLimiter.reset();
  classMoveClientLimiter.reset();
  store.events.length = 0;
  await seed();
  await db.putSpace(space(D, 'class', 'teacher-a', { name: 'Evening Class D' }));
  await member(D, 'account', 'teacher-a', 'owner');
  await db.putDevice({ learnerId: SUNI, deviceId: PHONE, secretHash: await hashSecret(PHONE_SECRET), scope: 'full', createdAt: OLD, lastSeenAt: OLD });
  await db.putDevice({ learnerId: SUNI, deviceId: TABLET, secretHash: await hashSecret(TABLET_SECRET), scope: 'class', createdAt: OLD, lastSeenAt: OLD });
});
afterEach(() => vi.useRealTimers());

describe('the move lock (CLASS_TRANSFER) covers teacher moves, not the class-scope update', () => {
  it('answers 422 transfers_locked on every move route while locked', async () => {
    const mid = 'move:00000000-0000-4000-8000-000000000000';
    const routes: Array<[string, string]> = [
      ['GET', `${moves(A)}/destinations?learnerId=${SUNI}`],
      ['POST', `${moves(A)}/preview`],
      ['POST', moves(A)],
      ['GET', moves(A)],
      ['POST', `${moves(B)}/${mid}/accept`],
      ['POST', `${moves(B)}/${mid}/decline`],
      ['POST', `${moves(A)}/${mid}/cancel`],
      ['POST', `${moves(FAMILY)}/${mid}/seen`],
    ];
    for (const [method, path] of routes) {
      const r = await call(method, path, bearer('teacher-a'), method === 'GET' ? undefined : {}, LOCKED);
      expect([r.status, r.body.error?.code], `${method} ${path}`).toEqual([422, 'transfers_locked']);
    }
  });

  it('keeps the acknowledgement open while moves are locked', async () => {
    expect((await get(`/api/spaces/${FAMILY}/class-scope`, 'mom', LOCKED)).status).toBe(200);
    const r = await post(`/api/spaces/${FAMILY}/learners/${SUNI}/class-scope`, 'mom', { version: CLASS_SCOPE_TEXT_VERSION }, LOCKED);
    expect(r.status).toBe(200);
  });
});

describe('destinations a teacher may move into directly (TV-D7)', () => {
  it('lists the live classes the teacher manages, other than the source and those the learner is in', async () => {
    const r = await get(`${moves(A)}/destinations?learnerId=${SUNI}`, 'teacher-a');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ destinations: [{ id: D, name: 'Evening Class D' }] });
  });

  it('answers 404 to a caller who does not manage the source, or for a learner who is not in it', async () => {
    expect((await get(`${moves(A)}/destinations?learnerId=${SUNI}`, 'teacher-b')).status).toBe(404);
    expect((await get(`${moves(A)}/destinations?learnerId=${MINA}`, 'teacher-a')).status).toBe(404);
    expect((await get(`${moves(A)}/destinations`, 'teacher-a')).status).toBe(404);
  });

  it("gives a school admin the school's child classes", async () => {
    await db.putSpace(space(SCHOOL, 'school', 'admin'));
    await member(SCHOOL, 'account', 'admin', 'owner');
    await db.putSpace(space(S1, 'class', 'teacher-c', { parentSpaceId: SCHOOL, name: 'School one' }));
    await db.putSpace(space(S2, 'class', 'teacher-b', { parentSpaceId: SCHOOL, name: 'School two' }));
    await member(S1, 'learner', MINA, 'student');
    const r = await get(`${moves(S1)}/destinations?learnerId=${MINA}`, 'admin');
    expect(r.body.data).toEqual({ destinations: [{ id: S2, name: 'School two' }] });
  });
});

describe('a direct move (TV-D7): the teacher manages both classes', () => {
  it('moves the learner at once, with no consent from anyone, and records codes only', async () => {
    const r = await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D });
    expect(r.status).toBe(200);
    expect(moveOf(r)).toMatchObject({ kind: 'direct', status: 'moved', to: { spaceId: D, name: 'Evening Class D' }, learner: null });
    expect(await isIn(D)).toBe(true);
    expect(await isIn(A)).toBe(false);
    expect(await isIn(FAMILY)).toBe(true);
    const stored = await db.getClassMove(moveOf(r).id);
    expect(stored).toMatchObject({ status: 'executed', actorAccountId: 'teacher-a', actorVia: 'owner', decidedAccountId: 'teacher-a', decidedVia: 'owner' });
    expect(store.events.map((e) => [e.name, e.payload, e.profileId])).toEqual([['space.move.completed', { via: 'direct' }, undefined]]);
  });

  it('lets a school admin move a learner between two classes of the school', async () => {
    await db.putSpace(space(SCHOOL, 'school', 'admin'));
    await member(SCHOOL, 'account', 'admin', 'owner');
    await db.putSpace(space(S1, 'class', 'teacher-c', { parentSpaceId: SCHOOL }));
    await db.putSpace(space(S2, 'class', 'teacher-b', { parentSpaceId: SCHOOL }));
    await member(S1, 'learner', MINA, 'student');
    const r = await post(moves(S1), 'admin', { learnerId: MINA, destinationSpaceId: S2 });
    expect(r.status).toBe(200);
    expect(await isIn(S2, MINA)).toBe(true);
    expect((await db.getClassMove(moveOf(r).id))?.actorVia).toBe('school_admin');
  });

  it('lets a plain teacher (not the owner) of both classes move directly', async () => {
    await member(A, 'account', 'teacher-b', 'teacher');
    await member(D, 'account', 'teacher-b', 'teacher');
    const r = await post(moves(A), 'teacher-b', { learnerId: SUNI, destinationSpaceId: D });
    expect(r.status).toBe(200);
    expect(moveOf(r)).toMatchObject({ kind: 'direct', status: 'moved' });
    expect((await db.getClassMove(moveOf(r).id))?.actorVia).toBe('teacher');
    expect(await isIn(D)).toBe(true);
  });

  it('revokes the source class tablet and removes the source class notes, through the route', async () => {
    await db.putRelink({ id: 'relink:tab', spaceId: A, learnerId: SUNI, deviceId: TABLET, platform: null, status: 'approved', requestedAt: OLD, decidedAt: OLD, expiresAt: OLD, secret: null });
    const note: NewNote = { id: 'note:src0000001', learnerId: SUNI, spaceId: A, senderAccountId: 'teacher-a', senderRole: 'teacher', senderLabel: null, batchId: 'notebatch:a', batchKind: 'learners', presetId: 'progress_reading', body: null, bodyLocale: null, suggest: null, createdAt: OLD };
    expect(await db.insertNotes([note], [])).toBe(1);
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D })).status).toBe(200);
    expect(await db.getDevice(SUNI, TABLET)).toBeNull();
    expect(await db.getDevice(SUNI, PHONE)).not.toBeNull();
    expect(await db.getNote(note.id)).toBeNull();
  });

  it('refuses a full destination, an existing member, the same class and a malformed body', async () => {
    for (let i = 0; i < 20; i += 1) await filler(`profile:fill-${String(i).padStart(2, '0')}`, D);
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D })).body.error?.code).toBe('cap_class');
    expect(await isIn(A)).toBe(true);
    await member(B, 'learner', SUNI, 'student');
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: B, code: CODE_B })).body.error?.code).toBe('already_member');
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: A })).body.error?.code).toBe('same_space');
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D, reason: 'x' })).status).toBe(422);
    expect((await post(moves(A), 'teacher-b', { learnerId: SUNI, destinationSpaceId: D })).status).toBe(404);
  });

  it('keeps the learner in the source when the last seat goes between the check and the swap', async () => {
    for (let i = 0; i < 19; i += 1) await filler(`profile:fill-${String(i).padStart(2, '0')}`, D);
    // The gate re-counts inside the batch: a seat taken after the advisory check leaves nothing moved.
    const original = db.createClassMove.bind(db);
    const spy = vi.spyOn(db, 'createClassMove').mockImplementation(async (row) => {
      const out = await original(row);
      await filler('profile:late-one', D);
      return out;
    });
    const r = await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D });
    spy.mockRestore();
    expect([r.status, r.body.error?.code, r.body.error?.details]).toEqual([409, 'move_blocked', { reason: 'cap_class' }]);
    expect(await isIn(A)).toBe(true);
    expect(await isIn(D)).toBe(false);
    expect(await db.openClassMoveOf(SUNI)).toBeNull();
  });
});

describe("a move into another teacher's class (TV-D8): the receiving class accepts", () => {
  async function send(): Promise<Move> {
    const r = await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: B, code: CODE_B.toLowerCase() });
    expect(r.status).toBe(201);
    return moveOf(r);
  }

  it('needs the live code, counts a failed code durably, and refuses a code that opens another class', async () => {
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: B })).body.error?.code).toBe('code_required');
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: B, code: 'ZZZZZZ' })).body.error?.code).toBe('code_not_found');
    expect(await db.countRateHits(transferRateKey.codeAccount('teacher-a'), new Date(0))).toBe(1);
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D, code: CODE_B })).status).toBe(200);
  });

  it('previews the class behind a code: its name and whether the move is direct', async () => {
    const r = await post(`${moves(A)}/preview`, 'teacher-a', { learnerId: SUNI, code: CODE_B });
    expect(r.body.data).toEqual({ destination: { id: B, name: 'Saturday Class B' }, direct: false });
    expect((await post(`${moves(A)}/preview`, 'teacher-b', { learnerId: SUNI, code: CODE_B })).status).toBe(404);
  });

  it('nothing moves until the receiving class accepts; before that it sees initials, picture and level only', async () => {
    const sent = await send();
    expect(sent).toMatchObject({ kind: 'accept', status: 'waiting', to: { spaceId: B, name: 'Saturday Class B' }, learner: { name: 'Suni Kim', avatar: 'hoya-orange' } });
    expect(await isIn(A)).toBe(true);
    expect(await isIn(B)).toBe(false);
    expect(store.events.map((e) => e.name)).toEqual(['space.move.requested']);

    const incoming = listOf(await get(moves(B), 'teacher-b')).incoming;
    expect(incoming).toEqual([expect.objectContaining({ id: sent.id, status: 'waiting', from: { name: 'Sunday Class A' }, learner: { alias: 'S. K.', avatar: 'hoya-orange', level: '8-9' } })]);
    const raw = JSON.stringify(incoming);
    expect(raw).not.toContain('Suni');
    expect(raw).not.toContain(SUNI);

    const accepted = await post(`${moves(B)}/${sent.id}/accept`, 'teacher-b');
    expect(accepted.status).toBe(200);
    expect(moveOf(accepted)).toMatchObject({ status: 'moved', learner: { name: 'Suni Kim' } });
    expect(await isIn(B)).toBe(true);
    expect(await isIn(A)).toBe(false);
    expect(store.events.at(-1)).toMatchObject({ name: 'space.move.completed', payload: { via: 'accepted' } });
    // the source's own history keeps one line and no name
    expect(listOf(await get(moves(A), 'teacher-a')).outgoing).toEqual([expect.objectContaining({ id: sent.id, status: 'moved', learner: null })]);
    // a resent accept answers the move as it is
    expect((await post(`${moves(B)}/${sent.id}/accept`, 'teacher-b')).status).toBe(200);
  });

  it('only the destination accepts or says not now, only the source cancels; anyone else gets 404', async () => {
    const sent = await send();
    expect((await post(`${moves(A)}/${sent.id}/accept`, 'teacher-a')).status).toBe(404);
    expect((await post(`${moves(B)}/${sent.id}/accept`, 'teacher-a')).status).toBe(404);
    expect((await post(`${moves(B)}/${sent.id}/cancel`, 'teacher-b')).status).toBe(404);
    expect((await post(`${moves(A)}/${sent.id}/cancel`, 'stranger')).status).toBe(404);
    expect((await post(`${moves(B)}/move:nope/decline`, 'teacher-b')).status).toBe(404);
    expect((await post(`${moves(B)}/${sent.id}/decline`, 'teacher-b', { reason: 'x' })).status).toBe(422);
  });

  it('not now ends it quietly: the source sees an ended line with no actor or reason, the learner stays', async () => {
    const sent = await send();
    const r = await post(`${moves(B)}/${sent.id}/decline`, 'teacher-b');
    expect(moveOf(r)).toMatchObject({ status: 'ended', learner: null });
    expect(await isIn(A)).toBe(true);
    const out = listOf(await get(moves(A), 'teacher-a')).outgoing[0];
    expect(out).toMatchObject({ status: 'ended' });
    expect(JSON.stringify(out)).not.toMatch(/not_now|teacher-b|declined/);
    expect((await post(`${moves(B)}/${sent.id}/accept`, 'teacher-b')).body.error?.code).toBe('not_open');
    expect(store.events.map((e) => e.name)).toEqual(['space.move.requested', 'space.move.declined']);
  });

  it('the source can cancel while it waits; the cancelled ask leaves the destination page', async () => {
    const sent = await send();
    expect((await post(`${moves(A)}/${sent.id}/cancel`, 'teacher-a')).status).toBe(200);
    expect(listOf(await get(moves(B), 'teacher-b')).incoming).toEqual([]);
    expect((await post(`${moves(A)}/${sent.id}/cancel`, 'teacher-a')).body.error?.code).toBe('not_open');
  });

  it('one open move per learner, of either kind', async () => {
    await send();
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D })).body.error?.code).toBe('already_open');
  });

  it('a family-started request that is still open blocks a teacher move', async () => {
    expect((await createTransfer(FAMILY, 'mom', { learnerId: SUNI, fromSpaceId: A, destinationSpaceId: B, code: CODE_B, consent })).status).toBe(201);
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D })).body.error?.code).toBe('already_open');
  });

  it('an ask still waiting for the receiving class blocks a family-started request too', async () => {
    await send();
    const r = await createTransfer(FAMILY, 'mom', { learnerId: SUNI, fromSpaceId: A, destinationSpaceId: B, code: CODE_B, consent });
    expect([r.status, r.body.error?.code, r.body.error?.details]).toEqual([409, 'already_open', { startedBy: 'class' }]);
    vi.setSystemTime(new Date(NOW.getTime() + 15 * DAY));
    expect((await createTransfer(FAMILY, 'mom', { learnerId: SUNI, fromSpaceId: A, destinationSpaceId: B, code: CODE_B, consent })).status).toBe(201);
  });

  it('expires after 14 days; an expired ask no longer blocks a new move', async () => {
    const sent = await send();
    vi.setSystemTime(new Date(NOW.getTime() + 15 * DAY));
    expect((await post(`${moves(B)}/${sent.id}/accept`, 'teacher-b')).body.error?.code).toBe('expired');
    expect((await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D })).status).toBe(200);
  });

  it('when the class filled up meanwhile, accept answers move_blocked and the ask stays open', async () => {
    const sent = await send();
    for (let i = 0; i < 20; i += 1) await filler(`profile:fill-${String(i).padStart(2, '0')}`, B);
    const r = await post(`${moves(B)}/${sent.id}/accept`, 'teacher-b');
    expect([r.status, r.body.error?.code, r.body.error?.details]).toEqual([409, 'move_blocked', { reason: 'cap_class' }]);
    expect(await isIn(A)).toBe(true);
    expect((await db.getClassMove(sent.id))?.status).toBe('requested');
  });

  it('an ask whose learner left the source ends instead of moving anyone', async () => {
    const sent = await send();
    await db.removeMembership(A, 'learner', SUNI);
    expect((await post(`${moves(B)}/${sent.id}/accept`, 'teacher-b')).body.error?.code).toBe('not_open');
    expect(await isIn(B)).toBe(false);
  });
});

describe('the family sees a one-time notice (TV-D10)', () => {
  it('lists an executed move for the family until a guardian presses OK; nobody else sees it', async () => {
    const moved = moveOf(await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D }));
    const notices = (r: { body: Envelope }) => (r.body.data as { notices: unknown[] }).notices;
    const r = await get(moves(FAMILY), 'dad');
    expect(notices(r)).toEqual([{ id: moved.id, learnerId: SUNI, learnerName: 'Suni Kim', to: { spaceId: D, name: 'Evening Class D' }, executedAt: NOW.toISOString() }]);
    expect((await get(moves(FAMILY2), 'aunt')).body.data).toEqual({ notices: [] });
    expect((await get(moves(FAMILY), 'teacher-a')).status).toBe(404);
    expect((await post(`${moves(FAMILY2)}/${moved.id}/seen`, 'aunt')).status).toBe(404);
    expect((await post(`${moves(FAMILY)}/${moved.id}/seen`, 'mom')).body.data).toEqual({ seen: true });
    expect((await post(`${moves(FAMILY)}/${moved.id}/seen`, 'mom')).status).toBe(200);
    expect(notices(await get(moves(FAMILY), 'mom'))).toEqual([]);
    expect(store.events.filter((e) => e.name === 'space.move.notice_seen')).toHaveLength(1);
  });

  it('records the console OK with seenOn: console only', async () => {
    const moved = moveOf(await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D }));
    await post(`${moves(FAMILY)}/${moved.id}/seen`, 'mom');
    expect(store.events.filter((e) => e.name === 'space.move.notice_seen').map((e) => [e.payload, e.profileId])).toEqual([[{ seenOn: 'console' }, undefined]]);
  });

  it('stops showing a notice after 30 days', async () => {
    await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D });
    vi.setSystemTime(new Date(NOW.getTime() + 31 * DAY));
    expect((await get(moves(FAMILY), 'mom')).body.data).toEqual({ notices: [] });
  });

  it('carries the notice to the learner\'s own device inbox, never to a class tablet', async () => {
    const moved = moveOf(await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D }));
    const phone = await call('GET', `/api/sync/learners/${SUNI}/inbox`, device(PHONE, PHONE_SECRET));
    expect(phone.body.data?.classMoves).toEqual([{ id: moved.id, to: { spaceId: D, name: 'Evening Class D' }, executedAt: NOW.toISOString() }]);
    const tablet = await call('GET', `/api/sync/learners/${SUNI}/inbox`, device(TABLET, TABLET_SECRET));
    expect(tablet.body.data).toMatchObject({ classMoves: [], classScope: null });
    const locked = await call('GET', `/api/sync/learners/${SUNI}/inbox`, device(PHONE, PHONE_SECRET), undefined, LOCKED);
    expect(locked.body.data?.classMoves).toEqual([]);
  });
});

describe('the class-scope update (TV-D2 to TV-D5)', () => {
  const ack = (user: string, learnerId = SUNI, body: unknown = { version: CLASS_SCOPE_TEXT_VERSION }, family = FAMILY) => post(`/api/spaces/${family}/learners/${learnerId}/class-scope`, user, body);
  const rosterRow = async (spaceId: string, user: string) => {
    const r = await get(`/api/spaces/${spaceId}/roster`, user);
    return (r.body.data as { learners: Array<Record<string, unknown> & { summary: Record<string, unknown> }> }).learners.find((l) => l.id === SUNI);
  };

  beforeEach(async () => {
    await db.putSnapshot({ learnerId: SUNI, rev: 1, schemaVer: 1, contentVer: 'c', deviceId: PHONE, summary, payload: {}, updatedAt: NOW.toISOString() }, 0);
  });

  it('lists the learners of the family who are in a class, and whether they need the update', async () => {
    const r = await get(`/api/spaces/${FAMILY}/class-scope`, 'mom');
    expect(r.body.data).toEqual({ current: CLASS_SCOPE_TEXT_VERSION, learners: [{ learnerId: SUNI, name: 'Suni Kim', needed: true }] });
    await ack('dad');
    expect((await get(`/api/spaces/${FAMILY}/class-scope`, 'mom')).body.data).toEqual({ current: CLASS_SCOPE_TEXT_VERSION, learners: [{ learnerId: SUNI, name: 'Suni Kim', needed: false }] });
    expect((await get(`/api/spaces/${FAMILY}/class-scope`, 'teacher-a')).status).toBe(404);
    expect((await get(`/api/spaces/${A}/class-scope`, 'teacher-a')).status).toBe(404);
  });

  it('a teacher reads the base scope until a guardian acknowledges, then the full scope (never firstTryRate on the roster)', async () => {
    const before = await rosterRow(A, 'teacher-a');
    expect(before?.scope).toBe('base');
    expect(before?.summary).not.toHaveProperty('vocab');
    expect(before?.summary).not.toHaveProperty('stage1Anchor');

    const r = await ack('mom');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ version: CLASS_SCOPE_TEXT_VERSION, ackedAt: NOW.toISOString() });
    expect(await db.getClassScopeAck(SUNI)).toEqual({ learnerId: SUNI, textVersion: CLASS_SCOPE_TEXT_VERSION, basis: 'caregiver', evidence: 'mom', ackedAt: NOW.toISOString() });
    expect(store.events.map((e) => [e.name, e.payload])).toEqual([['space.scope.acknowledged', { basis: 'caregiver' }]]);

    const after = await rosterRow(A, 'teacher-a');
    expect(after?.scope).toBe('full');
    const { firstTryRate: _rate, ...rosterVocab } = vocab;
    expect(after?.summary.vocab).toEqual(rosterVocab);
    expect(after?.summary.stage1Anchor).toEqual(summary.stage1Anchor);

    const report = await get(`/api/spaces/${A}/learners/${SUNI}/report`, 'teacher-a');
    expect(report.body.data).toMatchObject({ scope: 'full', settings: { classNotes: 'all' }, summary: { vocab } });
  });

  it('the CLASS_SCOPE_FULL kill switch puts every class reader back on the base scope; the acknowledgement still records', async () => {
    const off = { ...ON, CLASS_SCOPE_FULL: 'disabled' };
    expect((await post(`/api/spaces/${FAMILY}/learners/${SUNI}/class-scope`, 'mom', { version: CLASS_SCOPE_TEXT_VERSION }, off)).status).toBe(200);
    const roster = await get(`/api/spaces/${A}/roster`, 'teacher-a', off);
    const row = (roster.body.data as { learners: Array<Record<string, unknown> & { summary: Record<string, unknown> }> }).learners.find((l) => l.id === SUNI);
    expect(row?.scope).toBe('base');
    expect(row?.summary).not.toHaveProperty('vocab');
    const report = await get(`/api/spaces/${A}/learners/${SUNI}/report`, 'teacher-a', off);
    expect(report.body.data).toMatchObject({ scope: 'base', settings: null });
    // the family still reads everything, and the stored acknowledgement counts again once the switch is back on
    expect((await get(`/api/spaces/${FAMILY}/roster`, 'mom', off)).body.data).toMatchObject({ learners: expect.arrayContaining([expect.objectContaining({ id: SUNI, scope: 'full' })]) });
    expect((await rosterRow(A, 'teacher-a'))?.scope).toBe('full');
  });

  it('a failed acknowledgement read answers the base scope instead of an error (for example before migration 0009)', async () => {
    await ack('mom');
    const spy = vi.spyOn(db, 'classScopeAcksOf').mockRejectedValue(new Error('no such table: class_scope_acks'));
    try {
      const r = await get(`/api/spaces/${A}/roster`, 'teacher-a');
      expect(r.status).toBe(200);
      expect((await rosterRow(A, 'teacher-a'))?.scope).toBe('base');
      expect((await get(`/api/spaces/${A}/learners/${SUNI}/report`, 'teacher-a')).body.data).toMatchObject({ scope: 'base' });
    } finally {
      spy.mockRestore();
    }
  });

  it('answers 404 for an archived family', async () => {
    const family = await db.getSpace(FAMILY);
    if (!family) throw new Error('seed');
    await db.putSpace({ ...family, archivedAt: OLD });
    expect((await get(`/api/spaces/${FAMILY}/class-scope`, 'mom')).status).toBe(404);
    expect((await ack('mom')).status).toBe(404);
  });

  it('the learner report says base and carries no settings before the acknowledgement', async () => {
    const report = await get(`/api/spaces/${A}/learners/${SUNI}/report`, 'teacher-a');
    expect(report.body.data).toMatchObject({ scope: 'base', settings: null });
    expect((report.body.data as { summary: Record<string, unknown> }).summary).not.toHaveProperty('vocab');
  });

  it('refuses a stale version, an outsider and a learner of another family', async () => {
    expect((await ack('mom', SUNI, { version: 'class-scope-2025-01' })).body.error).toMatchObject({ code: 'class_scope_stale', details: { current: CLASS_SCOPE_TEXT_VERSION } });
    expect((await ack('mom', SUNI, { version: CLASS_SCOPE_TEXT_VERSION, extra: true })).status).toBe(422);
    expect((await ack('teacher-a')).status).toBe(404);
    expect((await ack('aunt', SUNI, undefined, FAMILY2)).status).toBe(404);
    expect(await db.getClassScopeAck(SUNI)).toBeNull();
  });

  it("the learner's full-scope device acknowledges; a class tablet cannot", async () => {
    const tablet = await call('PUT', `/api/sync/learners/${SUNI}/class-scope`, device(TABLET, TABLET_SECRET), { version: CLASS_SCOPE_TEXT_VERSION });
    expect([tablet.status, tablet.body.error?.code]).toEqual([403, 'scope_limited']);
    expect((await call('PUT', `/api/sync/learners/${SUNI}/class-scope`, device(PHONE, PHONE_SECRET), { version: 'old' })).body.error?.code).toBe('class_scope_stale');
    const phone = await call('PUT', `/api/sync/learners/${SUNI}/class-scope`, device(PHONE, PHONE_SECRET), { version: CLASS_SCOPE_TEXT_VERSION });
    expect(phone.status).toBe(200);
    expect(await db.getClassScopeAck(SUNI)).toMatchObject({ basis: 'device', evidence: PHONE });
    expect(store.events.at(-1)).toMatchObject({ name: 'space.scope.acknowledged', payload: { basis: 'device' } });
  });

  it('the inbox says whether the update is needed (learners in a class only)', async () => {
    const inbox = async () => (await call('GET', `/api/sync/learners/${SUNI}/inbox`, device(PHONE, PHONE_SECRET))).body.data;
    expect((await inbox())?.classScope).toEqual({ needed: true, current: CLASS_SCOPE_TEXT_VERSION });
    await ack('mom');
    expect((await inbox())?.classScope).toEqual({ needed: false, current: CLASS_SCOPE_TEXT_VERSION });
    await db.removeMembership(A, 'learner', SUNI);
    expect((await inbox())?.classScope).toBeNull();
  });

  it("a guardian's consent to a family-started move at the current transfer text also acknowledges it", async () => {
    expect((await createTransfer(FAMILY, 'mom', { learnerId: SUNI, fromSpaceId: A, destinationSpaceId: B, code: CODE_B, consent })).status).toBe(201);
    expect(await db.getClassScopeAck(SUNI)).toMatchObject({ textVersion: CLASS_SCOPE_TEXT_VERSION, basis: 'caregiver', evidence: 'mom' });
  });

  it("a guardian's consent through the family approve route (a teacher-started request) also acknowledges it", async () => {
    const started = await call('POST', `/api/spaces/${A}/transfer-requests`, bearer('teacher-a'), classCreate());
    expect(started.status).toBe(201);
    const tid = (started.body.data as { request: { id: string } }).request.id;
    expect(await db.getClassScopeAck(SUNI)).toBeNull();
    expect((await approveTransfer(FAMILY, 'mom', tid, { slots: ['learner'], consent })).status).toBe(200);
    expect(await db.getClassScopeAck(SUNI)).toMatchObject({ textVersion: CLASS_SCOPE_TEXT_VERSION, basis: 'caregiver', evidence: 'mom' });
  });

  it('a consent at an older transfer text does not', async () => {
    expect((await createTransfer(FAMILY, 'mom', { learnerId: SUNI, fromSpaceId: A, destinationSpaceId: B, code: CODE_B, consent: { ...consent, textVersion: 'transfer-2026-10c' } })).status).toBe(201);
    expect(await db.getClassScopeAck(SUNI)).toBeNull();
  });
});

describe('telemetry for teacher moves and the update keeps codes only (section 4.4)', () => {
  it('drops every key but via / seenOn / basis, any unknown value, and the profile id', async () => {
    const send = (name: string, payload: Record<string, unknown>) => call('POST', '/api/telemetry', json, { name, payload, profileId: SUNI, at: NOW.toISOString() });
    expect((await send('space.move.notice_seen', { via: 'direct', learnerId: SUNI, spaceId: A })).status).toBe(201);
    expect((await send('space.move.notice_seen', { seenOn: 'device', learnerId: SUNI })).status).toBe(201);
    expect((await send('space.move.notice_seen', { seenOn: 'somewhere' })).status).toBe(201);
    expect((await send('space.move.completed', { via: 'sideways', name: 'Suni' })).status).toBe(201);
    expect((await send('space.scope.acknowledged', { basis: 'device', version: 'x' })).status).toBe(201);
    expect(store.events.map((e) => [e.name, e.payload, e.profileId])).toEqual([
      ['space.move.notice_seen', { via: 'direct' }, undefined],
      ['space.move.notice_seen', { seenOn: 'device' }, undefined],
      ['space.move.notice_seen', undefined, undefined],
      ['space.move.completed', undefined, undefined],
      ['space.scope.acknowledged', { basis: 'device' }, undefined],
    ]);
  });
});

describe('the 90-day record of moves is enforced by the daily purge (TV-D14 privacy promise)', () => {
  it('removes an executed move and an ask that expired unsettled once 90 days have passed, with no new move created', async () => {
    const moved = moveOf(await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D }));
    const ask = await post(moves(D), 'teacher-a', { learnerId: SUNI, destinationSpaceId: B, code: CODE_B });
    expect(ask.status).toBe(201);
    const later = new Date(NOW.getTime() + 89 * DAY);
    expect((await runScheduledPurge(db, later)).classMoves).toBe(0);
    const after = new Date(NOW.getTime() + 105 * DAY);
    expect((await runScheduledPurge(db, after)).classMoves).toBe(2);
    expect(await db.getClassMove(moved.id)).toBeNull();
    expect(await db.getClassMove(moveOf(ask).id)).toBeNull();
  });

  it('a failing class-move step never stops the note purge', async () => {
    const spy = vi.spyOn(db, 'purgeClassMoves').mockRejectedValue(new Error('no such table: class_moves'));
    try {
      expect(await runScheduledPurge(db, NOW)).toMatchObject({ rounds: 1, classMoves: 0 });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('statement budget of the destinations list (section 6)', () => {
  it('stays flat for a school admin who reaches 60 classes', async () => {
    const { openSqliteD1 } = await import('./helpers/sqlite');
    const { D1Db } = await import('../db/d1');
    const { setFallbackDb, fallbackDb } = await import('../db');
    const sqlite = openSqliteD1();
    let prepared = 0;
    let counting = false;
    const counted = {
      prepare(text: string) {
        if (counting) prepared += 1;
        return sqlite.prepare(text);
      },
      batch: (stmts: Parameters<typeof sqlite.batch>[0]) => sqlite.batch(stmts),
    };
    const before = fallbackDb();
    try {
      const d1db = new D1Db(counted);
      setFallbackDb(d1db);
      await d1db.putAccount({ id: 'admin', email: null, displayName: null, consent: null, createdAt: OLD });
      await d1db.putSpace(space(SCHOOL, 'school', 'admin'));
      await d1db.addMembership({ spaceId: SCHOOL, memberKind: 'account', memberId: 'admin', role: 'owner', joinedAt: OLD });
      for (let i = 0; i < 60; i += 1) await d1db.putSpace(space(`space:sc-${String(i).padStart(2, '0')}`, 'class', 'admin', { parentSpaceId: SCHOOL }));
      await d1db.putLearner({ id: SUNI, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
      await d1db.addMembership({ spaceId: 'space:sc-00', memberKind: 'learner', memberId: SUNI, role: 'student', joinedAt: OLD });
      counting = true;
      const r = await get(`${moves('space:sc-00')}/destinations?learnerId=${SUNI}`, 'admin');
      counting = false;
      expect(r.status).toBe(200);
      expect((r.body.data as { destinations: unknown[] }).destinations).toHaveLength(59);
      expect(prepared).toBeLessThan(20);
    } finally {
      setFallbackDb(before);
      sqlite.close();
    }
  });
});

describe('statement budget of a direct move (section 6, Free plan: 50 statements a request)', () => {
  it('prepares fewer than 40 statements, batch statements included', async () => {
    const { openSqliteD1 } = await import('./helpers/sqlite');
    const { D1Db } = await import('../db/d1');
    const { setFallbackDb, fallbackDb } = await import('../db');
    const sqlite = openSqliteD1();
    let prepared = 0;
    let counting = false;
    const counted = {
      prepare(text: string) {
        if (counting) prepared += 1;
        return sqlite.prepare(text);
      },
      batch: (stmts: Parameters<typeof sqlite.batch>[0]) => sqlite.batch(stmts),
    };
    const before = fallbackDb();
    try {
      const d1db = new D1Db(counted);
      setFallbackDb(d1db);
      await d1db.putAccount({ id: 'teacher-a', email: null, displayName: null, consent: null, createdAt: OLD });
      await d1db.putSpace(space(A, 'class', 'teacher-a'));
      await d1db.putSpace(space(D, 'class', 'teacher-a'));
      await d1db.addMembership({ spaceId: A, memberKind: 'account', memberId: 'teacher-a', role: 'owner', joinedAt: OLD });
      await d1db.addMembership({ spaceId: D, memberKind: 'account', memberId: 'teacher-a', role: 'owner', joinedAt: OLD });
      await d1db.putLearner({ id: SUNI, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
      await d1db.addMembership({ spaceId: A, memberKind: 'learner', memberId: SUNI, role: 'student', joinedAt: OLD });
      counting = true;
      const r = await post(moves(A), 'teacher-a', { learnerId: SUNI, destinationSpaceId: D });
      counting = false;
      expect(r.status).toBe(200);
      expect(prepared).toBeGreaterThan(10);
      expect(prepared).toBeLessThan(40);
    } finally {
      setFallbackDb(before);
      sqlite.close();
    }
  });
});
