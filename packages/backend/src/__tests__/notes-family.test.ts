import type { Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewNote } from '../db';
import app from '../index';
import { hashSecret } from '../lib/device-auth';
import { notesSendLimiter } from '../routes/notes';
import { testDb as db } from './helpers/db';

/**
 * The family's oversight — F-FEEDBACK-001 sections 6.1, 7.2, 8.2, 8.4 and 8.5
 * (PR FB-4b-family): every note to the learner with who sent and who acted,
 * hide, report, stop a sender and allow again, the class-notes setting, and
 * the owner's "Can send notes" switches (rule 8.2-c included). Runs on memory
 * and, with `test:sqlite`, on the real migrations.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
type Row = Record<string, unknown>;
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
const FAMILY = 'space:fam';
const FAMILY_B = 'space:fam-b';
const CLASS = 'space:cls';
const SUNI = 'profile:suni';
const MIN = 'profile:min';

const space = (id: string, kind: Space['kind'], owner: string, over: Partial<Space> = {}): Space => ({
  id,
  kind,
  name: kind === 'class' ? 'Hangul A' : 'Kim family',
  parentSpaceId: null,
  ownerAccountId: owner,
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: T,
  ...over,
});
const learnerRow = (id: string) => ({ id, displayName: id, ageGroup: '5-7' as const, avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });

beforeEach(async () => {
  await db.reset();
  notesSendLimiter.reset();
  const accounts: Array<[string, string | null, string | null]> = [
    ['mom', 'mina@example.com', 'Mina Kim'],
    ['dad', 'dad@example.com', null],
    ['grandma', null, 'Grandma Kim'],
    ['teacher', 'teacher@school.example', 'Ms Lee'],
    ['otherParent', null, 'Other Parent'],
    ['stranger', null, 'Stranger'],
  ];
  for (const [id, email, displayName] of accounts) await db.putAccount({ id, email, displayName, consent: null, createdAt: T });
  await db.putSpace(space(FAMILY, 'family', 'mom'));
  await db.putSpace(space(FAMILY_B, 'family', 'otherParent', { name: 'Park family' }));
  await db.putSpace(space(CLASS, 'class', 'teacher'));
  await db.putLearner(learnerRow(SUNI));
  await db.putLearner(learnerRow(MIN));
  const rows: Array<[string, 'account' | 'learner', string, 'owner' | 'caregiver' | 'student']> = [
    [FAMILY, 'account', 'mom', 'owner'],
    [FAMILY, 'account', 'dad', 'caregiver'],
    [FAMILY, 'account', 'grandma', 'caregiver'],
    [FAMILY, 'learner', SUNI, 'student'],
    [FAMILY_B, 'account', 'otherParent', 'owner'],
    [FAMILY_B, 'learner', MIN, 'student'],
    [CLASS, 'account', 'teacher', 'owner'],
    [CLASS, 'learner', SUNI, 'student'],
    [CLASS, 'learner', MIN, 'student'],
  ];
  for (const [spaceId, memberKind, memberId, role] of rows) await db.addMembership({ spaceId, memberKind, memberId, role, joinedAt: T });
  // dad may send in the family (OD-17); grandma may not
  await db.putSendGrant({ spaceId: FAMILY, accountId: 'dad', grantedBy: 'mom', grantedAt: T });
});

let seq = 0;
function note(over: Partial<NewNote> = {}): NewNote {
  seq += 1;
  return {
    id: `note:fam${String(seq).padStart(7, '0')}`,
    learnerId: SUNI,
    spaceId: CLASS,
    senderAccountId: 'teacher',
    senderRole: 'teacher',
    senderLabel: null,
    batchId: `notebatch:fam-${seq}`,
    batchKind: 'learners',
    presetId: 'progress_reading',
    body: 'Loved your work on the letters today',
    bodyLocale: 'en',
    suggest: null,
    createdAt: ago(HOUR + seq * 1000),
    ...over,
  };
}
const familyNote = (over: Partial<NewNote> = {}): NewNote => note({ spaceId: FAMILY, senderAccountId: 'dad', senderRole: 'family', senderLabel: 'dad', presetId: 'warm_learning_together', body: 'See you on Sunday', ...over });
async function put(...rows: NewNote[]): Promise<void> {
  for (const r of rows) expect(await db.insertNotes([r], [])).toBe(1);
}

const base = (learnerId = SUNI, familyId = FAMILY) => `/api/spaces/${familyId}/learners/${learnerId}`;
const oversight = (user: string, query = '', learnerId = SUNI, familyId = FAMILY) => call('GET', `${base(learnerId, familyId)}/notes${query}`, bearer(user));
const rowsOf = (res: { body: Envelope }): Row[] => (res.body.data as { rows: Row[] }).rows;
const rowOf = async (user: string, noteId: string): Promise<Row | undefined> => rowsOf(await oversight(user)).find((r) => r.id === noteId);
const hide = (user: string, noteId: string, learnerId = SUNI) => call('POST', `${base(learnerId)}/notes/${noteId}/hide`, bearer(user));
const report = (user: string, noteId: string, body: unknown = { reason: 'unkind' }, learnerId = SUNI, familyId = FAMILY) => call('POST', `${base(learnerId, familyId)}/notes/${noteId}/report`, bearer(user), body);
const block = (user: string, body: unknown) => call('POST', `${base()}/blocks`, bearer(user), body);
const blocks = async (user = 'mom'): Promise<Row[]> => ((await call('GET', `${base()}/blocks`, bearer(user))).body.data as { blocks: Row[] }).blocks;
const delivered = async (learnerId = SUNI): Promise<string[]> => (await db.notesForLearner(learnerId, 'full', new Date(), 30)).notes.map((n) => n.id);
const reporters = (accountId: string): Promise<number> => db.countReportersAgainst(accountId, new Date(Date.now() - 30 * DAY));
const held = async (accountId: string): Promise<string | null> => {
  const h = await db.getSenderHold(accountId);
  return h && h.liftedAt === null ? h.reason : null;
};

describe('who oversees (sections 6.1 and 7.2)', () => {
  it('every family caregiver, granted or not, and the owner; 401 without a session', async () => {
    for (const user of ['mom', 'dad', 'grandma']) expect((await oversight(user)).status, user).toBe(200);
    expect((await call('GET', `${base()}/notes`, json)).status).toBe(401);
  });

  it('403 for a teacher of the learner, another family or a stranger; 404 for a class space or a learner who is not the family’s student', async () => {
    for (const user of ['teacher', 'otherParent', 'stranger']) {
      const res = await oversight(user);
      expect(res.status, user).toBe(403);
      expect(res.body.error?.code).toBe('not_allowed');
    }
    expect((await call('GET', `/api/spaces/${CLASS}/learners/${SUNI}/notes`, bearer('teacher'))).status).toBe(404);
    expect((await oversight('mom', '', MIN)).status).toBe(404);
    expect((await oversight('mom', '', SUNI, 'space:nope')).status).toBe(404);
  });
});

describe('GET …/learners/:learnerId/notes · the family view (sections 7.2 and 8.2)', () => {
  it('lists every note from every space with text and label, the sending account’s name on family notes and never on class notes', async () => {
    const fromClass = note();
    const fromDad = familyNote();
    const fromMom = familyNote({ senderAccountId: 'mom', senderLabel: 'mom', body: null, bodyLocale: null });
    await put(fromClass, fromDad, fromMom);
    const rows = rowsOf(await oversight('grandma'));
    expect(rows.map((r) => r.id)).toEqual([fromClass.id, fromDad.id, fromMom.id]);
    expect(rows[0]).toEqual({
      id: fromClass.id,
      spaceId: CLASS,
      spaceKind: 'class',
      spaceName: 'Hangul A',
      from: { role: 'teacher', label: null },
      senderName: null,
      mine: false,
      presetId: 'progress_reading',
      text: 'Loved your work on the letters today',
      suggest: null,
      createdAt: fromClass.createdAt,
      status: 'live',
      reaction: null,
      hiddenBy: null,
      reportedBy: null,
    });
    expect(rows[1]).toMatchObject({ spaceKind: 'family', spaceName: 'Kim family', from: { role: 'family', label: 'dad' }, senderName: 'dad@example.com', text: 'See you on Sunday' });
    expect(rows[2]).toMatchObject({ senderName: 'Mina Kim', text: null });
    expect(JSON.stringify(rows)).not.toMatch(/Ms Lee|teacher@school|"teacher"[^,]*Account/);
    expect(rowsOf(await oversight('mom')).find((r) => r.id === fromMom.id)?.mine).toBe(true);
  });

  it('keeps a taken-back note with its text (status withdrawn); opened, reactions and hides show with who acted', async () => {
    const taken = note();
    const read = note();
    const hiddenByMom = note();
    const hiddenOnDevice = note();
    await put(taken, read, hiddenByMom, hiddenOnDevice);
    await db.withdrawNote(taken.id, new Date());
    await db.setNoteRead(read.id, new Date());
    await db.setNoteReaction(read.id, 'thanks', new Date());
    await db.hideNote(hiddenByMom.id, 'family', new Date(), 'mom');
    await db.hideNote(hiddenOnDevice.id, 'device', new Date());
    const byId = new Map(rowsOf(await oversight('dad')).map((r) => [r.id, r]));
    expect(byId.get(taken.id)).toMatchObject({ status: 'withdrawn', text: 'Loved your work on the letters today' });
    expect(byId.get(read.id)).toMatchObject({ status: 'opened', reaction: 'thanks' });
    expect(byId.get(hiddenByMom.id)).toMatchObject({ status: 'hidden', hiddenBy: 'Mina Kim' });
    expect(byId.get(hiddenOnDevice.id)).toMatchObject({ status: 'hidden', hiddenBy: 'device' });
  });

  it('a note delivery would not show reads not_shown: class notes off, a stopped sender, a sender who lost the right, an archived space', async () => {
    const offNote = note();
    await put(offNote);
    await db.putNotePrefs({ learnerId: SUNI, classes: 'off', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    expect((await rowOf('mom', offNote.id))?.status).toBe('not_shown');
    await db.putNotePrefs({ learnerId: SUNI, classes: 'presets', acknowledgedAt: null, updatedAt: T, updatedVia: 'family', updatedByAccount: 'mom' });
    expect(await rowOf('mom', offNote.id)).toMatchObject({ status: 'live', text: 'Loved your work on the letters today' });

    const fromDad = familyNote();
    const fromGrandma = familyNote({ senderAccountId: 'grandma', senderLabel: 'grandma' });
    await put(fromDad, fromGrandma);
    expect((await rowOf('mom', fromGrandma.id))?.status).toBe('not_shown');
    await db.putBlock({ learnerId: SUNI, senderAccountId: 'dad', familySpaceId: FAMILY, createdByAccount: 'mom', createdAt: T });
    expect((await rowOf('mom', fromDad.id))?.status).toBe('not_shown');
    await db.putSpace(space(CLASS, 'class', 'teacher', { archivedAt: T }));
    expect((await rowOf('mom', offNote.id))?.status).toBe('not_shown');
  });

  it('rule 8.2-c: a family note reported on a device reads not_shown to its sender and "reported on a device" to another caregiver', async () => {
    const fromDad = familyNote();
    await put(fromDad);
    expect(await db.insertNoteReport({ id: 'notereport:dev1', noteId: fromDad.id, learnerId: SUNI, senderAccountId: 'dad', reason: 'unkind', via: 'device', evidence: 'device-1', reporterKey: `family:${FAMILY}`, attest: null, createdAt: new Date().toISOString(), reviewedAt: null, outcome: null })).toBe(true);
    expect(await rowOf('dad', fromDad.id)).toMatchObject({ status: 'not_shown', reportedBy: null, mine: true });
    expect(JSON.stringify(rowsOf(await oversight('dad')))).not.toMatch(/"reported"|"device"/);
    expect(await rowOf('mom', fromDad.id)).toMatchObject({ status: 'reported', reportedBy: 'device' });
  });

  it('a family report names the reporting account, also to the reported sender (adult to adult)', async () => {
    const fromDad = familyNote();
    await put(fromDad);
    expect((await report('mom', fromDad.id)).status).toBe(201);
    expect(await rowOf('grandma', fromDad.id)).toMatchObject({ status: 'reported', reportedBy: 'Mina Kim' });
    expect(await rowOf('dad', fromDad.id)).toMatchObject({ status: 'reported', reportedBy: 'Mina Kim' });
  });

  it('pages 50 rows newest first with a cursor; refuses a malformed before', async () => {
    const many = Array.from({ length: 51 }, (_, i) => note({ createdAt: ago(HOUR + i * 1000) }));
    expect(await db.insertNotes(many, [])).toBe(51);
    const first = await oversight('mom');
    expect(rowsOf(first)).toHaveLength(50);
    const next = (first.body.data as { next: string }).next;
    const second = await oversight('mom', `?before=${encodeURIComponent(next)}`);
    expect(rowsOf(second).map((r) => r.id)).toEqual([many[50]!.id]);
    expect((second.body.data as { next: string | null }).next).toBeNull();
    expect((await oversight('mom', '?before=soon')).status).toBe(422);
  });
});

describe('POST …/notes/:noteId/hide (sections 6.10 and 8.3, D8)', () => {
  it('hides the note on every device, names the acting caregiver, and is not a report', async () => {
    const n = note();
    await put(n);
    const res = await hide('grandma', n.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ hidden: true });
    expect(await db.getNote(n.id)).toMatchObject({ status: 'hidden', hiddenVia: 'family', actedByAccountId: 'grandma' });
    expect(await delivered()).toEqual([]);
    expect(await reporters('teacher')).toBe(0);
    expect(await held('teacher')).toBeNull();
    expect((await hide('mom', n.id)).status).toBe(200);
  });

  it('a taken-back or reported note answers 409; another learner’s note, an unknown or expired one 404; outsiders 403', async () => {
    const taken = note();
    const other = note({ learnerId: MIN });
    const old = note({ createdAt: ago(181 * DAY) });
    await put(taken, other, old);
    await db.withdrawNote(taken.id, new Date());
    const res = await hide('mom', taken.id);
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('not_live');
    expect((await hide('mom', other.id)).status).toBe(404);
    expect((await hide('mom', old.id)).status).toBe(404);
    expect((await hide('mom', 'note:missing00')).status).toBe(404);
    expect((await hide('teacher', other.id, SUNI)).status).toBe(403);
    expect((await db.getNote(other.id))?.status).toBe('live');
  });
});

describe('POST …/notes/:noteId/report (sections 7.2 and 8.4)', () => {
  it('reports any note to the learner, a family note and a taken-back note included: 201, status reported, a report row', async () => {
    const fromDad = familyNote();
    const taken = note();
    await put(fromDad, taken);
    await db.withdrawNote(taken.id, new Date());
    const res = await report('grandma', fromDad.id, { reason: 'not_for_me' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ reported: true });
    expect((await db.getNote(fromDad.id))?.status).toBe('reported');
    expect((await report('mom', taken.id)).status).toBe(201);
    expect((await db.getNote(taken.id))?.status).toBe('reported');
    expect(await reporters('teacher')).toBe(1);
  });

  it('the reporter’s own note is 422 own_note (take it back instead); attest is refused; outsiders 403; unknown 404', async () => {
    const fromDad = familyNote();
    await put(fromDad);
    const own = await report('dad', fromDad.id);
    expect(own.status).toBe(422);
    expect(own.body.error?.code).toBe('own_note');
    expect((await report('mom', fromDad.id, { reason: 'unkind', attest: 'grown_up_pin' })).status).toBe(422);
    expect((await report('mom', fromDad.id, { reason: 'mean' })).status).toBe(422);
    expect((await report('teacher', fromDad.id)).status).toBe(403);
    expect((await report('mom', 'note:missing00')).status).toBe(404);
    expect((await db.getNote(fromDad.id))?.status).toBe('live');
  });

  it('an unsafe report from a family account holds the sender at once; sending then answers 403 sending_paused', async () => {
    const n = note();
    await put(n);
    expect((await report('mom', n.id, { reason: 'unsafe' })).status).toBe(201);
    expect(await held('teacher')).toBe('unsafe');
    const send = await call('POST', `/api/spaces/${CLASS}/notes`, bearer('teacher'), { to: { kind: 'learners', ids: [MIN] }, presetId: 'effort_proud' }, { NOTES_SEND: 'enabled' });
    expect(send.status).toBe(403);
    expect(send.body.error?.code).toBe('sending_paused');
  });

  it('reports from 2 distinct families hold the sender; two caregivers of one family count once', async () => {
    const a = note();
    const b = note();
    const c = note({ learnerId: MIN });
    await put(a, b, c);
    expect((await report('mom', a.id)).status).toBe(201);
    expect((await report('dad', b.id)).status).toBe(201);
    expect(await reporters('teacher')).toBe(1);
    expect(await held('teacher')).toBeNull();
    expect((await report('otherParent', c.id, { reason: 'unkind' }, MIN, FAMILY_B)).status).toBe(201);
    expect(await held('teacher')).toBe('reports');
  });

  it('a device report and a family report of the same family count once', async () => {
    const a = note();
    const b = note();
    await put(a, b);
    const secret = 'secret-home';
    await db.putDevice({ learnerId: SUNI, deviceId: 'device-home', secretHash: await hashSecret(secret), scope: 'full', createdAt: T, lastSeenAt: T });
    expect((await call('POST', `/api/sync/learners/${SUNI}/notes/${a.id}/report`, { ...json, authorization: `Device device-home:${secret}` }, { reason: 'unkind' })).status).toBe(201);
    expect((await report('mom', b.id)).status).toBe(201);
    expect(await reporters('teacher')).toBe(1);
    expect(await held('teacher')).toBeNull();
  });

  it('twenty family reports per account per day, then 429 too_many with scope account', async () => {
    const notes = Array.from({ length: 21 }, () => note());
    expect(await db.insertNotes(notes, [])).toBe(21);
    for (const n of notes.slice(0, 20)) expect((await report('mom', n.id, { reason: 'other' })).status).toBe(201);
    const res = await report('mom', notes[20]!.id, { reason: 'other' });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: 'too_many', details: { scope: 'account', retryAfter: 86400 } });
    expect((await db.getNote(notes[20]!.id))?.status).toBe('live');
  });
});

describe('stop a sender and allow again (section 8.5)', () => {
  it('blocks the sender of a note: an opaque senderRef, the sender’s notes stop reaching the learner (earlier ones too), and allow again restores them', async () => {
    const first = note();
    const second = note();
    await put(first, second);
    const res = await block('dad', { noteId: first.id });
    expect(res.status).toBe(201);
    const senderRef = String(res.body.data?.senderRef);
    expect(senderRef).toMatch(/^[0-9a-f]{32}$/);
    expect(senderRef).not.toContain('teacher');
    expect(await delivered()).toEqual([]);
    // it is not a report and holds nobody
    expect(await reporters('teacher')).toBe(0);
    // the composer sees "off", never "blocked"
    const recipients = await call('GET', `/api/spaces/${CLASS}/notes/recipients`, bearer('teacher'), undefined, { NOTES_SEND: 'enabled' });
    expect((recipients.body.data as { learners: Row[] }).learners.find((l) => l.id === SUNI)?.notes).toBe('off');

    expect(await blocks('grandma')).toEqual([{ senderRef, label: 'Your teacher · Hangul A', role: 'teacher', name: 'Hangul A', createdAt: expect.any(String) }]);
    const allow = await call('DELETE', `${base()}/blocks/${senderRef}`, bearer('mom'));
    expect(allow.status).toBe(200);
    expect(allow.body.data).toEqual({ removed: true });
    expect(await blocks()).toEqual([]);
    expect((await delivered()).sort()).toEqual([first.id, second.id].sort());
    expect((await call('DELETE', `${base()}/blocks/${senderRef}`, bearer('mom'))).status).toBe(404);
  });

  it('a family adult is listed by account name; the reference differs per family and never equals the account id', async () => {
    const fromDad = familyNote();
    await put(fromDad);
    expect((await block('mom', { noteId: fromDad.id })).status).toBe(201);
    const [listed] = await blocks();
    expect(listed).toMatchObject({ label: 'dad@example.com', role: 'family', name: 'dad@example.com' });
    expect(listed?.senderRef).not.toBe('dad');
    // another family of the learner neither lists this family's block nor lifts it
    await db.addMembership({ spaceId: FAMILY_B, memberKind: 'learner', memberId: SUNI, role: 'student', joinedAt: T });
    expect(((await call('GET', `${base(SUNI, FAMILY_B)}/blocks`, bearer('otherParent'))).body.data as { blocks: Row[] }).blocks).toEqual([]);
    expect((await call('DELETE', `${base(SUNI, FAMILY_B)}/blocks/${String(listed?.senderRef)}`, bearer('otherParent'))).status).toBe(404);
    expect(await blocks()).toHaveLength(1);
  });

  it('refuses the viewer’s own note (422), a bad body (422), another learner’s note (404); outsiders 403', async () => {
    const fromDad = familyNote();
    const other = note({ learnerId: MIN });
    await put(fromDad, other);
    expect((await block('dad', { noteId: fromDad.id })).body.error?.code).toBe('own_note');
    for (const body of [{}, { noteId: 'nope' }, { noteId: fromDad.id, extra: 1 }, null]) expect((await block('mom', body)).status, JSON.stringify(body)).toBe(422);
    expect((await block('mom', { noteId: other.id })).status).toBe(404);
    expect((await block('teacher', { noteId: fromDad.id })).status).toBe(403);
    expect(await blocks()).toEqual([]);
  });
});

describe('GET / PUT …/note-prefs (sections 6.10 and 7.2)', () => {
  it('reads the defaults, then the family’s change with who made it; acknowledge answers the one-time card for good', async () => {
    expect((await call('GET', `${base()}/note-prefs`, bearer('grandma'))).body.data).toEqual({ classes: 'all', acknowledged: false, updatedBy: null });
    const res = await call('PUT', `${base()}/note-prefs`, bearer('mom'), { classes: 'presets', acknowledge: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ classes: 'presets', acknowledged: true, updatedBy: 'Mina Kim' });
    expect(await db.getNotePrefs(SUNI)).toMatchObject({ updatedVia: 'family', updatedByAccount: 'mom' });
    expect((await call('PUT', `${base()}/note-prefs`, bearer('dad'), { classes: 'off' })).body.data).toEqual({ classes: 'off', acknowledged: true, updatedBy: 'dad@example.com' });
    await db.putNotePrefs({ learnerId: SUNI, classes: 'all', acknowledgedAt: null, updatedAt: T, updatedVia: 'device', updatedByAccount: null });
    expect((await call('GET', `${base()}/note-prefs`, bearer('mom'))).body.data).toEqual({ classes: 'all', acknowledged: true, updatedBy: 'device' });
  });

  it('refuses a bad body (attest is a device field) with 422; outsiders 403', async () => {
    for (const body of [{}, { classes: 'some' }, { classes: 'off', attest: 'grown_up_pin' }, null]) expect((await call('PUT', `${base()}/note-prefs`, bearer('mom'), body)).status, JSON.stringify(body)).toBe(422);
    expect((await call('PUT', `${base()}/note-prefs`, bearer('teacher'), { classes: 'off' })).status).toBe(403);
    expect((await call('GET', `${base()}/note-prefs`, bearer('stranger'))).status).toBe(403);
    expect(await db.getNotePrefs(SUNI)).toBeNull();
  });
});

describe('the family owner’s "Can send notes" switches (sections 6.1 and 8.2-b, OD-17)', () => {
  const senders = (user = 'mom') => call('GET', `/api/spaces/${FAMILY}/note-senders`, bearer(user));
  const setSender = (accountId: string, body: unknown, user = 'mom') => call('PUT', `/api/spaces/${FAMILY}/note-senders/${accountId}`, bearer(user), body);
  const familySend = (user: string) => call('POST', `/api/spaces/${FAMILY}/notes`, bearer(user), { to: { kind: 'learners', ids: [SUNI] }, presetId: 'warm_learning_together' }, { NOTES_SEND: 'enabled' });

  it('lists the family’s adults, the owner first and always able to send', async () => {
    const res = await senders();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      senders: [
        { accountId: 'mom', name: 'Mina Kim', isOwner: true, canSend: true },
        { accountId: 'dad', name: 'dad@example.com', isOwner: false, canSend: true },
        { accountId: 'grandma', name: 'Grandma Kim', isOwner: false, canSend: false },
      ],
    });
  });

  it('turning a caregiver on lets it send; off takes the grant away and its notes stop reaching the learner', async () => {
    expect((await familySend('grandma')).status).toBe(403);
    const on = await setSender('grandma', { canSend: true });
    expect(on.status).toBe(200);
    expect(on.body.data).toEqual({ canSend: true });
    expect(await db.getSendGrant(FAMILY, 'grandma')).toMatchObject({ grantedBy: 'mom' });
    expect((await familySend('grandma')).status).toBe(201);
    expect(await delivered()).toHaveLength(1);

    expect((await setSender('grandma', { canSend: false })).body.data).toEqual({ canSend: false });
    expect(await db.getSendGrant(FAMILY, 'grandma')).toBeNull();
    expect(await delivered()).toEqual([]);
    expect((await familySend('grandma')).status).toBe(403);
  });

  it('every caregiver reads the list (rule 8.2-b); only the owner changes it (403); the owner cannot be turned off (409); 404 for a non-member or a class; 422 for a bad body', async () => {
    const owners = await senders();
    for (const user of ['dad', 'grandma']) {
      const res = await senders(user);
      expect(res.status, user).toBe(200);
      expect(res.body.data).toEqual(owners.body.data);
    }
    for (const user of ['teacher', 'otherParent', 'stranger']) expect((await senders(user)).status, user).toBe(403);
    expect((await setSender('grandma', { canSend: true }, 'dad')).status).toBe(403);
    expect((await setSender('mom', { canSend: false })).body.error?.code).toBe('owner');
    expect((await setSender('mom', { canSend: true })).status).toBe(200);
    expect((await setSender('stranger', { canSend: true })).status).toBe(404);
    expect((await call('GET', `/api/spaces/${CLASS}/note-senders`, bearer('teacher'))).status).toBe(404);
    for (const body of [{}, { canSend: 'yes' }, { canSend: true, extra: 1 }, null]) expect((await setSender('grandma', body)).status, JSON.stringify(body)).toBe(422);
    expect(await db.getSendGrant(FAMILY, 'grandma')).toBeNull();
  });
});

// A minute ago, so a family report made in the test is always the later one.
const deviceReport = (noteId: string, senderAccountId: string, id = 'notereport:dev1') =>
  db.insertNoteReport({ id, noteId, learnerId: SUNI, senderAccountId, reason: 'unkind', via: 'device', evidence: 'device-1', reporterKey: `family:${FAMILY}`, attest: null, createdAt: ago(60_000), reviewedAt: null, outcome: null });

describe('rule 8.2-c: a device report never changes what the sender saw before it', () => {
  it('a note taken back, then reported on a device, still reads withdrawn to its sender, in the family view and the sent list', async () => {
    const fromDad = familyNote();
    await put(fromDad);
    expect((await call('POST', `/api/spaces/${FAMILY}/notes/${fromDad.id}/withdraw`, bearer('dad'), {})).status).toBe(200);
    expect(await deviceReport(fromDad.id, 'dad')).toBe(true);
    expect(await rowOf('dad', fromDad.id)).toMatchObject({ status: 'withdrawn', hiddenBy: null, reportedBy: null });
    expect(JSON.stringify(rowsOf(await oversight('dad')))).not.toMatch(/"reported"|"device"|not_shown/);
    const sent = await call('GET', `/api/spaces/${FAMILY}/notes?learner=${encodeURIComponent(SUNI)}`, bearer('dad'));
    expect(((sent.body.data as { rows: Row[] }).rows.find((r) => r.id === fromDad.id))?.status).toBe('withdrawn');
    expect(await rowOf('mom', fromDad.id)).toMatchObject({ status: 'reported', reportedBy: 'device' });
  });

  it('a note hidden by a caregiver, then reported on a device, still reads hidden to its sender', async () => {
    const fromDad = familyNote();
    await put(fromDad);
    expect((await hide('mom', fromDad.id)).status).toBe(200);
    expect(await deviceReport(fromDad.id, 'dad')).toBe(true);
    expect(await rowOf('dad', fromDad.id)).toMatchObject({ status: 'hidden', hiddenBy: 'Mina Kim', reportedBy: null });
    expect(await rowOf('grandma', fromDad.id)).toMatchObject({ status: 'reported', reportedBy: 'device' });
  });

  it('a device report and a later family report: still not_shown to the sender, with no actor', async () => {
    const fromDad = familyNote();
    await put(fromDad);
    expect(await deviceReport(fromDad.id, 'dad')).toBe(true);
    expect((await report('mom', fromDad.id)).status).toBe(201);
    expect(await rowOf('dad', fromDad.id)).toMatchObject({ status: 'not_shown', reportedBy: null, hiddenBy: null });
    expect(await rowOf('grandma', fromDad.id)).toMatchObject({ status: 'reported', reportedBy: 'device' });
  });

  it('hide of the sender’s own not_shown note answers one 409 whether a device report or a delivery rule hides it', async () => {
    const reported = familyNote();
    const ungranted = familyNote();
    const shown = familyNote();
    await put(reported, ungranted, shown);
    expect(await deviceReport(reported.id, 'dad')).toBe(true);
    const viaReport = await hide('dad', reported.id);
    expect((await rowOf('dad', shown.id))?.status).toBe('live');
    await db.deleteSendGrant(FAMILY, 'dad');
    expect((await rowOf('dad', ungranted.id))?.status).toBe('not_shown');
    const viaRule = await hide('dad', ungranted.id);
    expect(viaReport.status).toBe(409);
    expect(viaRule.status).toBe(viaReport.status);
    expect(viaRule.body.error).toEqual(viaReport.body.error);
    expect((await db.getNote(ungranted.id))?.status).toBe('live');
    await db.putSendGrant({ spaceId: FAMILY, accountId: 'dad', grantedBy: 'mom', grantedAt: T });
    expect((await hide('dad', shown.id)).status).toBe(200);
    expect((await rowOf('dad', shown.id))).toMatchObject({ status: 'hidden', hiddenBy: 'dad@example.com' });
  });
});

describe('a learner who is a student of two families (section 8.2: adult to adult inside the family)', () => {
  beforeEach(async () => {
    await db.addMembership({ spaceId: FAMILY_B, memberKind: 'learner', memberId: SUNI, role: 'student', joinedAt: T });
  });

  it('another family’s adults are never named: no sender name, and their hides and reports read that family’s space name', async () => {
    const fromB = note({ spaceId: FAMILY_B, senderAccountId: 'otherParent', senderRole: 'family', senderLabel: 'mom', presetId: 'warm_learning_together' });
    const hiddenByB = note();
    const reportedByB = note();
    await put(fromB, hiddenByB, reportedByB);
    expect((await hide('otherParent', hiddenByB.id, SUNI)).status).toBe(403);
    expect((await call('POST', `${base(SUNI, FAMILY_B)}/notes/${hiddenByB.id}/hide`, bearer('otherParent'))).status).toBe(200);
    expect((await report('otherParent', reportedByB.id, { reason: 'unkind' }, SUNI, FAMILY_B)).status).toBe(201);
    const rows = rowsOf(await oversight('mom'));
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(fromB.id)).toMatchObject({ spaceKind: 'family', spaceName: 'Park family', senderName: null, mine: false });
    expect(byId.get(hiddenByB.id)).toMatchObject({ status: 'hidden', hiddenBy: 'Park family' });
    expect(byId.get(reportedByB.id)).toMatchObject({ status: 'reported', reportedBy: 'Park family' });
    expect(JSON.stringify(rows)).not.toContain('Other Parent');
    // the other family names its own adult
    const theirs = ((await call('GET', `${base(SUNI, FAMILY_B)}/notes`, bearer('otherParent'))).body.data as { rows: Row[] }).rows;
    expect(theirs.find((r) => r.id === hiddenByB.id)).toMatchObject({ hiddenBy: 'Other Parent' });
  });

  it('each family lists and lifts only its own blocks; a blocked adult of the other family reads that family’s name', async () => {
    const fromTeacher = note();
    const fromB = note({ spaceId: FAMILY_B, senderAccountId: 'otherParent', senderRole: 'family', senderLabel: 'mom', presetId: 'warm_learning_together' });
    await put(fromTeacher, fromB);
    const placed = await call('POST', `${base(SUNI, FAMILY_B)}/blocks`, bearer('otherParent'), { noteId: fromTeacher.id });
    expect(placed.status).toBe(201);
    expect(await blocks()).toEqual([]);
    const theirRef = String(placed.body.data?.senderRef);
    expect((await call('DELETE', `${base()}/blocks/${theirRef}`, bearer('mom'))).status).toBe(404);
    expect(await db.listBlocks(SUNI)).toHaveLength(1);
    expect((await block('mom', { noteId: fromB.id })).status).toBe(201);
    expect(await blocks()).toEqual([{ senderRef: expect.any(String), label: 'Park family', role: 'family', name: 'Park family', createdAt: expect.any(String) }]);
  });
});

describe('the remaining branches of the family view', () => {
  it('a blocked teacher who left every shared class reads former; a second report adds a row and names one reporter', async () => {
    const n = note();
    await put(n);
    expect((await block('mom', { noteId: n.id })).status).toBe(201);
    await db.removeMembership(CLASS, 'account', 'teacher');
    expect(await blocks()).toEqual([{ senderRef: expect.any(String), label: 'A former sender', role: 'former', name: null, createdAt: expect.any(String) }]);

    const twice = note({ senderAccountId: 'stranger' });
    await put(twice);
    expect((await report('mom', twice.id)).status).toBe(201);
    expect((await report('grandma', twice.id)).status).toBe(201);
    expect(await db.reportsForNotes([twice.id])).toHaveLength(2);
    const row = await rowOf('dad', twice.id);
    expect(row?.status).toBe('reported');
    expect(['Mina Kim', 'Grandma Kim']).toContain(row?.reportedBy);
    expect(await reporters('stranger')).toBe(1);
  });

  it('a caregiver hides a live note that delivery does not show (no grant): 200, hidden', async () => {
    const fromGrandma = familyNote({ senderAccountId: 'grandma', senderLabel: 'grandma' });
    await put(fromGrandma);
    expect((await rowOf('mom', fromGrandma.id))?.status).toBe('not_shown');
    expect((await hide('mom', fromGrandma.id)).status).toBe(200);
    expect(await rowOf('mom', fromGrandma.id)).toMatchObject({ status: 'hidden', hiddenBy: 'Mina Kim' });
  });
});

describe('the family view stays within the per-request query budget', () => {
  it('a page of 50 notes from one caregiver without a grant reads the grant once', async () => {
    const many = Array.from({ length: 50 }, (_, i) => familyNote({ senderAccountId: 'grandma', senderLabel: 'grandma', createdAt: ago(HOUR + i * 1000) }));
    expect(await db.insertNotes(many, [])).toBe(50);
    const spy = vi.spyOn(db, 'getSendGrant');
    const rows = rowsOf(await oversight('mom'));
    expect(rows).toHaveLength(50);
    expect(rows.every((r) => r.status === 'not_shown')).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
