import { TRANSFER_COOLING_OFF_MS, type Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NewNote, StoredNote } from '../db';
import { approvedRequest, at as transferAt, executeInput, HOUR as T_HOUR, LEARNER as T_LEARNER, seedWorld, SOURCE as T_SOURCE, FAMILY as T_FAMILY } from '../db/__tests__/transfer-fixtures';
import app from '../index';
import { hashSecret } from '../lib/device-auth';
import { notesSendLimiter, SENT_LIST_PAGE } from '../routes/notes';
import { testDb as db } from './helpers/db';

/**
 * The sent list, take back and cleanup — F-FEEDBACK-001 sections 6.1 item 6,
 * 7.2, 7.5, 8.3 and 9 (PR FB-3b). Runs on memory and, with `test:sqlite`, on
 * the real migrations.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string } };
type Row = Record<string, unknown>;
const ON = { NOTES_SEND: 'enabled' };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env: Record<string, unknown> = {}) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }, env);
  return { status: res.status, body: (await res.json()) as Envelope };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number): string => new Date(Date.now() - ms).toISOString();
const T = '2026-01-01T00:00:00.000Z';
const CLASS = 'space:cls';
const CLASS_B = 'space:cls-b';
const FAMILY = 'space:fam';
const SCHOOL = 'space:sch';
const SUNI = 'profile:suni';
const MIN = 'profile:min';

const space = (id: string, kind: Space['kind'], owner: string, over: Partial<Space> = {}): Space => ({
  id,
  kind,
  name: id,
  parentSpaceId: null,
  ownerAccountId: owner,
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: T,
  ...over,
});

const learnerRow = (id: string, displayName: string) => ({ id, displayName, ageGroup: '5-7' as const, avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });

beforeEach(async () => {
  await db.reset();
  notesSendLimiter.reset();
  for (const accountId of ['teacher', 'coteacher', 'teacherB', 'mom', 'dad', 'principal', 'stranger']) await db.putAccount({ id: accountId, email: null, displayName: null, consent: null, createdAt: T });
  await db.putSpace(space(SCHOOL, 'school', 'principal'));
  await db.putSpace(space(CLASS, 'class', 'teacher', { parentSpaceId: SCHOOL }));
  await db.putSpace(space(CLASS_B, 'class', 'teacherB'));
  await db.putSpace(space(FAMILY, 'family', 'mom'));
  await db.putLearner(learnerRow(SUNI, 'Suni Kim'));
  await db.putLearner(learnerRow(MIN, 'Min Park'));
  const rows: Array<[string, 'account' | 'learner', string, 'owner' | 'teacher' | 'caregiver' | 'admin' | 'student']> = [
    [SCHOOL, 'account', 'principal', 'owner'],
    [CLASS, 'account', 'teacher', 'owner'],
    [CLASS, 'account', 'coteacher', 'teacher'],
    [CLASS, 'learner', SUNI, 'student'],
    [CLASS, 'learner', MIN, 'student'],
    [CLASS_B, 'account', 'teacherB', 'owner'],
    [CLASS_B, 'learner', SUNI, 'student'],
    [FAMILY, 'account', 'mom', 'owner'],
    [FAMILY, 'account', 'dad', 'caregiver'],
    [FAMILY, 'learner', SUNI, 'student'],
  ];
  for (const [spaceId, memberKind, memberId, role] of rows) await db.addMembership({ spaceId, memberKind, memberId, role, joinedAt: T });
});

let seq = 0;
function note(over: Partial<NewNote> = {}): NewNote {
  seq += 1;
  return {
    id: `note:list${String(seq).padStart(6, '0')}`,
    learnerId: SUNI,
    spaceId: CLASS,
    senderAccountId: 'teacher',
    senderRole: 'teacher',
    senderLabel: null,
    batchId: `notebatch:list-${seq}`,
    batchKind: 'learners',
    presetId: 'progress_reading',
    body: 'Loved your work on the letters today',
    bodyLocale: 'en',
    suggest: null,
    createdAt: ago(HOUR),
    ...over,
  };
}
const familyNote = (over: Partial<NewNote> = {}): NewNote => note({ spaceId: FAMILY, senderAccountId: 'mom', senderRole: 'family', senderLabel: 'grandma', presetId: 'warm_learning_together', body: 'See you on Sunday', ...over });
async function put(...rows: NewNote[]): Promise<void> {
  for (const r of rows) expect(await db.insertNotes([r], [])).toBe(1);
}

const list = (spaceId: string, user: string, query = '') => call('GET', `/api/spaces/${spaceId}/notes${query}`, bearer(user));
const rowsOf = (res: { body: Envelope }): Row[] => (res.body.data as { rows: Row[] }).rows;
const withdraw = (spaceId: string, user: string, noteId: string, body: unknown = {}) => call('POST', `/api/spaces/${spaceId}/notes/${noteId}/withdraw`, bearer(user), body);
const statusOf = async (spaceId: string, user: string, noteId: string): Promise<unknown> => rowsOf(await list(spaceId, user, `?learner=${SUNI}`)).find((r) => r.id === noteId)?.status;
const stored = async (noteId: string): Promise<StoredNote | null> => db.getNote(noteId);
const delivered = async (learnerId = SUNI): Promise<string[]> => (await db.notesForLearner(learnerId, 'full', new Date(), 30)).notes.map((n) => n.id);

describe('GET /:id/notes · who may read the list (section 7.2)', () => {
  it('401 without a session, 404 for a missing space, 403 for an outsider, a school admin or another class’s teacher', async () => {
    expect((await call('GET', `/api/spaces/${CLASS}/notes`, json)).status).toBe(401);
    expect((await list('space:nope', 'teacher')).status).toBe(404);
    for (const user of ['stranger', 'principal', 'teacherB', 'mom']) {
      const res = await list(CLASS, user);
      expect(res.status, user).toBe(403);
      expect(res.body.error?.code).toBe('not_allowed');
    }
  });

  it('the class owner and a co-teacher read it; in a family the owner and a caregiver without the grant (feedback.oversee)', async () => {
    for (const user of ['teacher', 'coteacher']) expect((await list(CLASS, user)).status, user).toBe(200);
    for (const user of ['mom', 'dad']) expect((await list(FAMILY, user)).status, user).toBe(200);
  });

  it('is not switched: it works while NOTES_SEND is off (decision D7), also on an archived space', async () => {
    await put(note());
    await db.putSpace(space(CLASS, 'class', 'teacher', { parentSpaceId: SCHOOL, archivedAt: T }));
    const res = await list(CLASS, 'teacher');
    expect(res.status).toBe(200);
    expect(rowsOf(res)).toHaveLength(1);
  });

  it('refuses a malformed before or learner with 422', async () => {
    for (const query of ['?before=yesterday', '?before=2026-01-01T00:00:00.000Z~bad', '?learner=Suni', `?learner=profile:${'a'.repeat(80)}`]) {
      const res = await list(CLASS, 'teacher', query);
      expect(res.status, query).toBe(422);
      expect(res.body.error?.code).toBe('bad_request');
    }
  });
});

describe('GET /:id/notes · rows (sections 7.2 and 9)', () => {
  it('a send to everyone is one row with its size and no counts of opens or answers; with learner= it splits per learner', async () => {
    const send = await call('POST', `/api/spaces/${CLASS}/notes`, bearer('teacher'), { to: { kind: 'everyone' }, presetId: 'effort_proud', text: 'Great week', textLocale: 'en' }, ON);
    expect(send.status).toBe(201);
    const batchId = send.body.data?.batchId;
    await put(note({ senderAccountId: 'coteacher', learnerId: MIN, presetId: 'progress_writing', createdAt: ago(2 * HOUR) }));

    const rows = rowsOf(await list(CLASS, 'teacher'));
    expect(rows).toHaveLength(2);
    const [batch, single] = rows;
    expect(Object.keys(batch!).sort()).toEqual(['batchId', 'createdAt', 'id', 'label', 'mine', 'presetId', 'size', 'status', 'suggest', 'text', 'to']);
    expect(batch).toMatchObject({ batchId, to: 'everyone', size: 2, presetId: 'effort_proud', text: 'Great week', suggest: null, label: null, status: 'sent', mine: true });
    expect(single).toMatchObject({ to: 'learner', learnerId: MIN, displayName: 'Min Park', presetId: 'progress_writing', status: 'sent', reaction: null, mine: false });
    expect(JSON.stringify(rows)).not.toMatch(/opened|readAt|senderAccountId|"teacher"/);

    const forSuni = rowsOf(await list(CLASS, 'teacher', `?learner=${SUNI}`));
    expect(forSuni).toHaveLength(1);
    expect(forSuni[0]).toMatchObject({ batchId, to: 'learner', learnerId: SUNI, displayName: 'Suni Kim', status: 'sent', mine: true });
    expect(rowsOf(await list(CLASS, 'coteacher', `?learner=${MIN}`)).map((r) => r.mine)).toEqual([false, true]);
  });

  it('the roster name follows anonymizeRoster', async () => {
    await put(note());
    await db.putSpace(space(CLASS, 'class', 'teacher', { parentSpaceId: SCHOOL, settings: { consentMode: 'parent', anonymizeRoster: true } }));
    const [row] = rowsOf(await list(CLASS, 'teacher'));
    expect(row?.displayName).not.toBe('Suni Kim');
    expect(String(row?.displayName)).not.toContain('Kim');
  });

  it('pages 50 rows newest first by a keyset cursor: notes that share one send time are never skipped or repeated', async () => {
    const many = Array.from({ length: 60 }, (_, i) => `profile:p${String(i).padStart(2, '0')}`);
    for (const id of many) {
      await db.putLearner(learnerRow(id, id));
      await db.addMembership({ spaceId: CLASS, memberKind: 'learner', memberId: id, role: 'student', joinedAt: T });
    }
    const sameTime = ago(HOUR);
    expect(await db.insertNotes(many.map((learnerId) => note({ learnerId, batchId: 'notebatch:chosen', createdAt: sameTime })), [])).toBe(60);
    await put(note({ createdAt: ago(10 * HOUR) }));

    const first = await list(CLASS, 'teacher');
    expect(rowsOf(first)).toHaveLength(SENT_LIST_PAGE);
    const next = (first.body.data as { next: string | null }).next;
    expect(next).toEqual(expect.any(String));
    const second = await list(CLASS, 'teacher', `?before=${encodeURIComponent(next!)}`);
    expect(rowsOf(second)).toHaveLength(11);
    expect((second.body.data as { next: string | null }).next).toBeNull();
    const ids = [...rowsOf(first), ...rowsOf(second)].map((r) => r.id);
    expect(new Set(ids).size).toBe(61);
    // newest first: the older single note comes last
    expect(rowsOf(second).at(-1)?.learnerId).toBe(SUNI);
    // a plain ISO time also works as `before`: rows strictly older
    expect(rowsOf(await list(CLASS, 'teacher', `?before=${encodeURIComponent(sameTime)}`))).toHaveLength(1);
  });

  it('a class sender never reads "opened" and sees the reaction only while the learner’s mode is all; presets and off hide it', async () => {
    const n = note();
    await put(n);
    await db.setNoteRead(n.id, new Date());
    await db.setNoteReaction(n.id, 'thanks', new Date());
    expect(rowsOf(await list(CLASS, 'teacher'))[0]).toMatchObject({ status: 'sent', reaction: 'thanks' });

    await db.putNotePrefs({ learnerId: SUNI, classes: 'presets', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    expect(rowsOf(await list(CLASS, 'teacher'))[0]).toMatchObject({ status: 'sent', reaction: null });
    await db.putNotePrefs({ learnerId: SUNI, classes: 'off', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    expect(rowsOf(await list(CLASS, 'teacher'))[0]).toMatchObject({ status: 'not_shown', reaction: null });
  });

  it('hidden, reported, blocked and a sender who lost the right all read not_shown, never which; taken back reads withdrawn', async () => {
    const hidden = note();
    const reported = note();
    const fromCoteacher = note({ senderAccountId: 'coteacher' });
    const blockedNote = note({ learnerId: MIN });
    const taken = note();
    const fine = note();
    await put(hidden, reported, fromCoteacher, blockedNote, taken, fine);
    await db.hideNote(hidden.id, 'family', new Date(), 'mom');
    expect(await db.insertNoteReport({ id: 'notereport:r1', noteId: reported.id, learnerId: SUNI, senderAccountId: 'teacher', reason: 'unkind', via: 'family', evidence: 'mom', reporterKey: `family:${FAMILY}`, attest: null, createdAt: new Date().toISOString(), reviewedAt: null, outcome: null })).toBe(true);
    await db.putBlock({ learnerId: MIN, senderAccountId: 'teacher', familySpaceId: FAMILY, createdByAccount: 'mom', createdAt: T });
    await db.withdrawNote(taken.id, new Date());
    await db.removeMembership(CLASS, 'account', 'coteacher');

    const byId = new Map(rowsOf(await list(CLASS, 'teacher')).map((r) => [r.id, r]));
    expect(byId.get(hidden.id)?.status).toBe('not_shown');
    expect(byId.get(reported.id)?.status).toBe('not_shown');
    expect(byId.get(fromCoteacher.id)?.status).toBe('not_shown');
    expect(byId.get(blockedNote.id)?.status).toBe('not_shown');
    expect(byId.get(taken.id)).toMatchObject({ status: 'withdrawn', text: 'Loved your work on the letters today' });
    expect(byId.get(fine.id)?.status).toBe('sent');
  });

  it('in a family space the list reads "opened" once read, and a caregiver whose grant was withdrawn reads not_shown', async () => {
    const fromMom = familyNote();
    const fromDad = familyNote({ senderAccountId: 'dad', senderLabel: 'dad' });
    await db.putSendGrant({ spaceId: FAMILY, accountId: 'dad', grantedBy: 'mom', grantedAt: T });
    await put(fromMom, fromDad);
    await db.setNoteRead(fromMom.id, new Date());
    await db.setNoteReaction(fromMom.id, 'happy', new Date());
    expect(await statusOf(FAMILY, 'mom', fromMom.id)).toBe('opened');
    expect(await statusOf(FAMILY, 'dad', fromDad.id)).toBe('sent');
    const momRow = rowsOf(await list(FAMILY, 'dad')).find((r) => r.id === fromMom.id);
    expect(momRow).toMatchObject({ label: 'grandma', reaction: 'happy', mine: false });

    await db.deleteSendGrant(FAMILY, 'dad');
    expect(await statusOf(FAMILY, 'mom', fromDad.id)).toBe('not_shown');
  });

  it('lists only this space’s notes and nothing past retention', async () => {
    const mine = note();
    await put(mine, note({ spaceId: CLASS_B, senderAccountId: 'teacherB' }), note({ createdAt: ago(181 * DAY) }));
    expect(rowsOf(await list(CLASS, 'teacher')).map((r) => r.id)).toEqual([mine.id]);
  });
});

describe('POST /:id/notes/:noteId/withdraw · take back is soft (sections 7.2, 8.3, D9)', () => {
  it('takes back the sender’s own note: the row stays with status withdrawn, leaves the inbox and stays in the family view', async () => {
    const n = note();
    await put(n);
    expect(await delivered()).toEqual([n.id]);
    const res = await withdraw(CLASS, 'teacher', n.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ withdrawn: 1 });
    expect(await stored(n.id)).toMatchObject({ status: 'withdrawn', withdrawnAt: expect.any(String), body: n.body });
    expect(await delivered()).toEqual([]);
    expect((await db.notesForOversight(SUNI, { before: null, limit: 10, now: new Date() })).map((x) => [x.id, x.status, x.body])).toEqual([[n.id, 'withdrawn', n.body]]);
    expect(await statusOf(CLASS, 'teacher', n.id)).toBe('withdrawn');
    // again: nothing more to take back
    expect((await withdraw(CLASS, 'teacher', n.id)).body.data).toEqual({ withdrawn: 0 });
  });

  it('is not switched (works while NOTES_SEND is off) and works in an archived space', async () => {
    const n = note();
    await put(n);
    await db.putSpace(space(CLASS, 'class', 'teacher', { parentSpaceId: SCHOOL, archivedAt: T }));
    expect((await withdraw(CLASS, 'teacher', n.id)).status).toBe(200);
  });

  it('a co-adult’s note is 403 not_allowed: only the sender takes a note back', async () => {
    const n = note({ senderAccountId: 'coteacher' });
    await put(n);
    const res = await withdraw(CLASS, 'teacher', n.id);
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('not_allowed');
    expect((await stored(n.id))?.status).toBe('live');
  });

  it('another space’s teacher gets 404 through their own space and 403 through this one; a missing or expired note is 404', async () => {
    const n = note();
    const old = note({ createdAt: ago(181 * DAY) });
    await put(n, old);
    expect((await withdraw(CLASS_B, 'teacherB', n.id)).status).toBe(404);
    expect((await withdraw(CLASS, 'teacherB', n.id)).status).toBe(403);
    expect((await withdraw(CLASS, 'teacher', 'note:missing00')).status).toBe(404);
    expect((await withdraw(CLASS, 'teacher', old.id)).status).toBe(404);
    expect((await call('POST', `/api/spaces/${CLASS}/notes/${n.id}/withdraw`, json, {})).status).toBe(401);
    expect((await stored(n.id))?.status).toBe('live');
  });

  it('take back needs no current feedback.send: a caregiver whose grant was withdrawn, or a teacher made a plain member, takes back its own notes; a non-member gets 403', async () => {
    await db.putSendGrant({ spaceId: FAMILY, accountId: 'dad', grantedBy: 'mom', grantedAt: T });
    const n = familyNote({ senderAccountId: 'dad', senderLabel: 'dad' });
    await put(n);
    await db.deleteSendGrant(FAMILY, 'dad');
    const res = await withdraw(FAMILY, 'dad', n.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ withdrawn: 1 });
    expect((await stored(n.id))?.status).toBe('withdrawn');

    const fromCoteacher = note({ senderAccountId: 'coteacher' });
    await put(fromCoteacher);
    await db.removeMembership(CLASS, 'account', 'coteacher');
    const gone = await withdraw(CLASS, 'coteacher', fromCoteacher.id);
    expect(gone.status).toBe(403);
    expect(gone.body.error?.code).toBe('not_allowed');
    expect((await stored(fromCoteacher.id))?.status).toBe('live');
    expect((await withdraw('space:missing', 'teacher', n.id)).status).toBe(404);
  });

  it('a reported note answers 409 note_reported; a batch take back skips it and takes back the rest', async () => {
    const batchId = 'notebatch:everyone-1';
    const a = note({ batchId, batchKind: 'everyone' });
    const b = note({ batchId, batchKind: 'everyone', learnerId: MIN, createdAt: a.createdAt });
    await put(a, b);
    expect(await db.insertNoteReport({ id: 'notereport:r2', noteId: a.id, learnerId: SUNI, senderAccountId: 'teacher', reason: 'unsafe', via: 'device', evidence: 'device-1', reporterKey: `family:${FAMILY}`, attest: null, createdAt: new Date().toISOString(), reviewedAt: null, outcome: null })).toBe(true);
    const single = await withdraw(CLASS, 'teacher', a.id);
    expect(single.status).toBe(409);
    expect(single.body.error?.code).toBe('note_reported');

    // the batch row keeps its first note (a, reported) as its id; take back names it with batch: true
    const [row] = rowsOf(await list(CLASS, 'teacher'));
    expect(row).toMatchObject({ id: a.id, to: 'everyone', size: 2, status: 'sent' });
    const res = await withdraw(CLASS, 'teacher', String(row!.id), { batch: true });
    expect(res.body.data).toEqual({ withdrawn: 1 });
    expect((await stored(a.id))?.status).toBe('reported');
    expect((await stored(b.id))?.status).toBe('withdrawn');
    expect(rowsOf(await list(CLASS, 'teacher'))[0]).toMatchObject({ to: 'everyone', size: 2, status: 'withdrawn' });
  });

  it('a note taken back and then reported from a device still reads withdrawn to its sender, a family adult included (rule 8.2-c)', async () => {
    const fromMom = familyNote();
    const fromTeacher = note();
    await put(fromMom, fromTeacher);
    for (const [spaceId, user, n] of [[FAMILY, 'mom', fromMom], [CLASS, 'teacher', fromTeacher]] as const) {
      expect((await withdraw(spaceId, user, n.id)).body.data).toEqual({ withdrawn: 1 });
      expect(await db.insertNoteReport({ id: `notereport:${n.id.slice(5)}`, noteId: n.id, learnerId: SUNI, senderAccountId: n.senderAccountId, reason: 'unkind', via: 'device', evidence: 'dev-1', reporterKey: `family:${FAMILY}`, attest: null, createdAt: new Date().toISOString(), reviewedAt: null, outcome: null })).toBe(true);
      expect((await stored(n.id))?.status).toBe('reported');
      expect(await statusOf(spaceId, user, n.id)).toBe('withdrawn');
      expect(rowsOf(await list(spaceId, user)).find((r) => r.id === n.id)?.status).toBe('withdrawn');
    }
    // a batch taken back and then reported still reads withdrawn too
    const batchId = 'notebatch:everyone-2';
    const a = note({ batchId, batchKind: 'everyone' });
    const b = note({ batchId, batchKind: 'everyone', learnerId: MIN, createdAt: a.createdAt });
    await put(a, b);
    expect((await withdraw(CLASS, 'teacher', b.id, { batch: true })).body.data).toEqual({ withdrawn: 2 });
    expect(await db.insertNoteReport({ id: 'notereport:batch2', noteId: a.id, learnerId: SUNI, senderAccountId: 'teacher', reason: 'unkind', via: 'device', evidence: 'dev-1', reporterKey: `family:${FAMILY}`, attest: null, createdAt: new Date().toISOString(), reviewedAt: null, outcome: null })).toBe(true);
    expect(rowsOf(await list(CLASS, 'teacher')).find((r) => r.batchId === batchId)).toMatchObject({ id: a.id, to: 'everyone', size: 2, status: 'withdrawn' });
  });

  it('refuses a body other than {} or { batch: true }', async () => {
    const n = note();
    await put(n);
    for (const body of [{ batch: false }, { batch: true, extra: 1 }, [], 'x', 'null']) expect((await withdraw(CLASS, 'teacher', n.id, body)).status, JSON.stringify(body)).toBe(422);
    expect((await stored(n.id))?.status).toBe('live');
    // no body at all reads as {}
    const bare = await app.request(`/api/spaces/${CLASS}/notes/${n.id}/withdraw`, { method: 'POST', headers: { authorization: 'Bearer teacher' } }, {});
    expect(bare.status).toBe(200);
    expect((await stored(n.id))?.status).toBe('withdrawn');
  });
});

describe('cleanup when a membership ends (section 7.5)', () => {
  it('a device leaving a space deletes its live, hidden and withdrawn notes there; reported ones stay for review; other spaces untouched', async () => {
    const secret = 'secret-dev';
    await db.putDevice({ learnerId: SUNI, deviceId: 'dev-1', secretHash: await hashSecret(secret), scope: 'full', createdAt: T, lastSeenAt: T });
    const live = note();
    const hidden = note();
    const taken = note();
    const reported = note();
    const elsewhere = familyNote();
    await put(live, hidden, taken, reported, elsewhere);
    await db.hideNote(hidden.id, 'device', new Date());
    await db.withdrawNote(taken.id, new Date());
    await db.insertNoteReport({ id: 'notereport:r3', noteId: reported.id, learnerId: SUNI, senderAccountId: 'teacher', reason: 'other', via: 'family', evidence: 'mom', reporterKey: `family:${FAMILY}`, attest: null, createdAt: new Date().toISOString(), reviewedAt: null, outcome: null });

    const res = await call('POST', `/api/spaces/${CLASS}/leave`, { ...json, authorization: `Device dev-1:${secret}` }, { learnerId: SUNI });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ left: true });
    for (const n of [live, hidden, taken]) expect(await stored(n.id), n.id).toBeNull();
    expect((await stored(reported.id))?.status).toBe('reported');
    expect((await stored(elsewhere.id))?.status).toBe('live');
  });

  it('an adult removing a learner keeps that learner’s notes: a teacher cannot erase a taken-back note before the family looks', async () => {
    const harmful = note();
    const other = note();
    await put(harmful, other);
    await db.setNoteRead(harmful.id, new Date());
    expect((await withdraw(CLASS, 'teacher', harmful.id)).status).toBe(200);
    const res = await call('DELETE', `/api/spaces/${CLASS}/members/learner/${SUNI}`, bearer('teacher'));
    expect(res.status).toBe(200);
    expect((await stored(harmful.id))?.status).toBe('withdrawn');
    expect((await stored(other.id))?.status).toBe('live');
    // the family still sees both (D5) and delivery stops (rule 2)
    expect((await db.notesForOversight(SUNI, { before: null, limit: 10, now: new Date() })).map((n) => n.id).sort()).toEqual([harmful.id, other.id].sort());
    expect(await delivered()).toEqual([]);
    // the sender's list reads not_shown for a learner no longer in the space; the taken-back one stays withdrawn
    expect(await statusOf(CLASS, 'teacher', other.id)).toBe('not_shown');
    expect(await statusOf(CLASS, 'teacher', harmful.id)).toBe('withdrawn');
  });

  it('removing a family adult deletes its send grant; a class removal touches no grant', async () => {
    await db.putSendGrant({ spaceId: FAMILY, accountId: 'dad', grantedBy: 'mom', grantedAt: T });
    const fromDad = familyNote({ senderAccountId: 'dad', senderLabel: 'dad' });
    await put(fromDad);
    expect(await delivered()).toEqual([fromDad.id]);
    const res = await call('DELETE', `/api/spaces/${FAMILY}/members/account/dad`, bearer('mom'));
    expect(res.status).toBe(200);
    expect(await db.getSendGrant(FAMILY, 'dad')).toBeNull();
    expect(await delivered()).toEqual([]);
    // the note itself stays for the family's view (delivery rule 6 stops it)
    expect((await stored(fromDad.id))?.status).toBe('live');

    await db.addMembership({ spaceId: FAMILY, memberKind: 'account', memberId: 'dad', role: 'caregiver', joinedAt: T });
    await db.putSendGrant({ spaceId: FAMILY, accountId: 'dad', grantedBy: 'mom', grantedAt: T });
    expect((await call('DELETE', `/api/spaces/${CLASS}/members/account/coteacher`, bearer('teacher'))).status).toBe(200);
    expect(await db.getSendGrant(FAMILY, 'dad')).not.toBeNull();
  });
});

describe('the transfer-completion guard (section 7.5; CLASS_TRANSFER stays off)', () => {
  it('executeTransfer deletes the learner’s live, hidden and withdrawn notes of the source class with the membership; reported and other spaces’ notes stay', async () => {
    await db.reset();
    await seedWorld(db);
    const at = transferAt(0).toISOString();
    const classNote = (over: Partial<NewNote>): NewNote => note({ learnerId: T_LEARNER, spaceId: T_SOURCE, senderAccountId: 'teacher-a', createdAt: at, ...over });
    const live = classNote({});
    const hidden = classNote({});
    const taken = classNote({});
    const reported = classNote({});
    const fromFamily = note({ learnerId: T_LEARNER, spaceId: T_FAMILY, senderAccountId: 'mom', senderRole: 'family', senderLabel: 'mom', createdAt: at });
    await put(live, hidden, taken, reported, fromFamily);
    await db.hideNote(hidden.id, 'family', transferAt(0), 'mom');
    await db.withdrawNote(taken.id, transferAt(0));
    expect(await db.insertNoteReport({ id: 'notereport:r4', noteId: reported.id, learnerId: T_LEARNER, senderAccountId: 'teacher-a', reason: 'unkind', via: 'family', evidence: 'mom', reporterKey: `family:${T_FAMILY}`, attest: null, createdAt: at, reviewedAt: null, outcome: null })).toBe(true);

    await approvedRequest(db);
    expect((await db.executeTransfer(executeInput(transferAt(T_HOUR + TRANSFER_COOLING_OFF_MS)))).executed).toBe(true);
    expect(await db.membership(T_SOURCE, 'learner', T_LEARNER)).toBeNull();
    for (const n of [live, hidden, taken]) expect(await db.getNote(n.id), n.id).toBeNull();
    expect((await db.getNote(reported.id))?.status).toBe('reported');
    expect((await db.getNote(fromFamily.id))?.status).toBe('live');
  });

  it('a move that does not execute deletes no note', async () => {
    await db.reset();
    await seedWorld(db);
    const n = note({ learnerId: T_LEARNER, spaceId: T_SOURCE, senderAccountId: 'teacher-a', createdAt: transferAt(0).toISOString() });
    await put(n);
    await approvedRequest(db);
    expect((await db.executeTransfer(executeInput(transferAt(T_HOUR)))).executed).toBe(false);
    expect((await db.getNote(n.id))?.status).toBe('live');
  });
});
