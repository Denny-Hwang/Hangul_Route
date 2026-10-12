import { SyncInboxSchema, type InboxNote, type Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewNote } from '../db';
import app from '../index';
import { hashSecret } from '../lib/device-auth';
import { testDb as db } from './helpers/db';

/**
 * Notes on the learner's device — F-FEEDBACK-001 sections 6.8 and 7.6 (PR
 * FB-4a): the inbox gains `notes` and `notePrefs` (delivery rules 1-7, one
 * query), and the device writes read state and reactions with
 * `PUT /api/sync/learners/:id/notes/:noteId/state`.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string } };
const json = { 'content-type': 'application/json' };
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Envelope };
}

const T = '2026-01-01T00:00:00.000Z';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number): string => new Date(Date.now() - ms).toISOString();
const SUNI = 'profile:suni';
const FAMILY = 'space:fam';
const CLASS = 'space:cls';

const space = (id: string, kind: Space['kind'], owner: string): Space => ({ id, kind, name: kind === 'class' ? 'Hangul A' : 'Kim family', parentSpaceId: null, ownerAccountId: owner, joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: T });

/** A device bound to Suni with a known secret: `full` (the family's) or `class` (a teacher re-link, SEC-4). */
async function device(deviceId: string, scope: 'full' | 'class'): Promise<Record<string, string>> {
  const secret = `secret-${deviceId}`;
  await db.putDevice({ learnerId: SUNI, deviceId, secretHash: await hashSecret(secret), scope, createdAt: T, lastSeenAt: T });
  return { ...json, authorization: `Device ${deviceId}:${secret}` };
}

let seq = 0;
function note(over: Partial<NewNote> = {}): NewNote {
  seq += 1;
  return {
    id: `note:dev${String(seq).padStart(6, '0')}`,
    learnerId: SUNI,
    spaceId: CLASS,
    senderAccountId: 'teacher',
    senderRole: 'teacher',
    senderLabel: null,
    batchId: 'batch:1',
    batchKind: 'everyone',
    presetId: 'progress_reading',
    body: 'Loved your work on the letters today',
    bodyLocale: 'en',
    suggest: null,
    createdAt: ago(HOUR),
    ...over,
  };
}
const familyNote = (over: Partial<NewNote> = {}): NewNote => note({ spaceId: FAMILY, senderAccountId: 'mom', senderRole: 'family', senderLabel: 'grandma', batchKind: 'learners', presetId: 'warm_learning_together', body: 'See you on Sunday', ...over });

let full: Record<string, string>;
let classOnly: Record<string, string>;

beforeEach(async () => {
  await db.reset();
  for (const accountId of ['mom', 'dad', 'teacher']) await db.putAccount({ id: accountId, email: null, displayName: null, consent: null, createdAt: T });
  await db.putLearner({ id: SUNI, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });
  await db.putSpace(space(FAMILY, 'family', 'mom'));
  await db.putSpace(space(CLASS, 'class', 'teacher'));
  const member = (spaceId: string, memberKind: 'account' | 'learner', memberId: string, role: 'owner' | 'caregiver' | 'student') => db.addMembership({ spaceId, memberKind, memberId, role, joinedAt: T });
  await member(FAMILY, 'account', 'mom', 'owner');
  await member(FAMILY, 'account', 'dad', 'caregiver');
  await member(FAMILY, 'learner', SUNI, 'student');
  await member(CLASS, 'account', 'teacher', 'owner');
  await member(CLASS, 'learner', SUNI, 'student');
  full = await device('device-home0001', 'full');
  classOnly = await device('device-class001', 'class');
});

const inbox = async (auth: Record<string, string> = full) => {
  const res = await call('GET', `/api/sync/learners/${SUNI}/inbox`, auth);
  expect(res.status).toBe(200);
  return res.body.data as { notes: InboxNote[]; notePrefs: { classes: string; acknowledged: boolean } };
};
const noteIds = async (auth: Record<string, string> = full): Promise<string[]> => (await inbox(auth)).notes.map((n) => n.id);
const putState = (noteId: string, body: unknown, auth: Record<string, string> = full) => call('PUT', `/api/sync/learners/${SUNI}/notes/${noteId}/state`, auth, body);

describe('the inbox carries notes (section 6.8)', () => {
  it('delivers a note in the wire shape the app parses, newest first, with the default prefs', async () => {
    const c = note({ suggest: { kind: 'quest', id: 'quest:stage1-letters-q1' }, createdAt: ago(2 * HOUR) });
    const f = familyNote({ body: null, bodyLocale: null });
    await db.insertNotes([c], []);
    await db.insertNotes([f], []);
    const data = await inbox();
    expect(data.notePrefs).toEqual({ classes: 'all', acknowledged: false });
    expect(data.notes).toEqual([
      { id: f.id, spaceId: FAMILY, from: { role: 'family', label: 'grandma' }, presetId: 'warm_learning_together', text: null, textLocale: null, suggest: null, createdAt: f.createdAt, readAt: null, reaction: null },
      { id: c.id, spaceId: CLASS, from: { role: 'teacher', label: null }, presetId: 'progress_reading', text: 'Loved your work on the letters today', textLocale: 'en', suggest: { kind: 'quest', id: 'quest:stage1-letters-q1' }, createdAt: c.createdAt, readAt: null, reaction: null },
    ]);
    // the app's own parser keeps every note
    const parsed = SyncInboxSchema.parse(data);
    expect(parsed.notes).toHaveLength(2);
    expect(parsed.notePrefs).toEqual({ classes: 'all', acknowledged: false });
  });

  it('never sends the sender account, the batch or any state the learner should not see', async () => {
    await db.insertNotes([note()], []);
    const [wire] = (await inbox()).notes;
    expect(Object.keys(wire ?? {}).sort()).toEqual(['createdAt', 'from', 'id', 'presetId', 'reaction', 'readAt', 'spaceId', 'suggest', 'text', 'textLocale']);
    expect(JSON.stringify(wire)).not.toMatch(/batch|senderAccount|actedBy|hidden/);
    expect(wire?.from).toEqual({ role: 'teacher', label: null });
  });

  it('rule 1: hidden, reported, withdrawn and notes older than 180 days are not delivered', async () => {
    const live = note();
    const hidden = note();
    const reported = note();
    const withdrawn = note();
    const old = note({ createdAt: ago(181 * DAY) });
    await db.insertNotes([live, hidden, reported, withdrawn, old], []);
    await db.hideNote(hidden.id, 'family', new Date(), 'mom');
    await db.insertNoteReport({ id: 'notereport:1', noteId: reported.id, learnerId: SUNI, senderAccountId: 'teacher', reason: 'unkind', via: 'device', evidence: 'device-home0001', reporterKey: `family:${FAMILY}`, attest: null, createdAt: ago(0), reviewedAt: null, outcome: null });
    await db.withdrawNote(withdrawn.id, new Date());
    expect(await noteIds()).toEqual([live.id]);
  });

  it('rule 2: notes of a space the learner left, or of an archived space, are not delivered', async () => {
    const c = note();
    const f = familyNote();
    await db.insertNotes([c], []);
    await db.insertNotes([f], []);
    await db.removeMembership(CLASS, 'learner', SUNI);
    expect(await noteIds()).toEqual([f.id]);
    await db.putSpace({ ...space(FAMILY, 'family', 'mom'), archivedAt: ago(0) });
    expect(await noteIds()).toEqual([]);
  });

  it('rule 3: a class-scoped device gets class notes only (and the prefs, which it cannot change)', async () => {
    const c = note();
    const f = familyNote();
    await db.insertNotes([c], []);
    await db.insertNotes([f], []);
    expect(await noteIds(classOnly)).toEqual([c.id]);
    expect((await noteIds(full)).sort()).toEqual([c.id, f.id].sort());
  });

  it('rule 4: in `presets` mode class notes arrive without their text; in `off` they do not arrive; family notes always do', async () => {
    const c = note({ createdAt: ago(2 * HOUR) });
    const f = familyNote();
    await db.insertNotes([c], []);
    await db.insertNotes([f], []);
    await db.putNotePrefs({ learnerId: SUNI, classes: 'presets', acknowledgedAt: ago(HOUR), updatedAt: ago(HOUR), updatedVia: 'family', updatedByAccount: 'mom' });
    const presets = await inbox();
    expect(presets.notePrefs).toEqual({ classes: 'presets', acknowledged: true });
    expect(presets.notes.map((n) => [n.id, n.text, n.textLocale])).toEqual([
      [f.id, 'See you on Sunday', 'en'],
      [c.id, null, null],
    ]);
    await db.putNotePrefs({ learnerId: SUNI, classes: 'off', acknowledgedAt: null, updatedAt: ago(0), updatedVia: 'family', updatedByAccount: 'mom' });
    const off = await inbox();
    expect(off.notePrefs).toEqual({ classes: 'off', acknowledged: true });
    expect(off.notes.map((n) => n.id)).toEqual([f.id]);
  });

  it('rule 5: a family block of the sender stops its notes, earlier ones included', async () => {
    const c = note();
    await db.insertNotes([c], []);
    await db.putBlock({ learnerId: SUNI, senderAccountId: 'teacher', familySpaceId: FAMILY, createdByAccount: 'dad', createdAt: ago(0) });
    expect(await noteIds()).toEqual([]);
  });

  it('rule 6: a sender who lost feedback.send is not delivered (left the class; a caregiver without a grant)', async () => {
    const c = note();
    const fromDad = familyNote({ senderAccountId: 'dad', senderLabel: 'dad' });
    await db.insertNotes([c], []);
    await db.insertNotes([fromDad], []);
    expect(await noteIds()).toEqual([c.id]);
    await db.putSendGrant({ spaceId: FAMILY, accountId: 'dad', grantedBy: 'mom', grantedAt: ago(0) });
    expect((await noteIds()).sort()).toEqual([c.id, fromDad.id].sort());
    await db.removeMembership(CLASS, 'account', 'teacher');
    await db.deleteSendGrant(FAMILY, 'dad');
    expect(await noteIds()).toEqual([]);
  });

  it('rule 7: at most the 30 newest notes', async () => {
    const rows = Array.from({ length: 35 }, (_, i) => note({ createdAt: ago((i + 1) * 60_000) }));
    await db.insertNotes(rows, []);
    expect(await noteIds()).toEqual(rows.slice(0, 30).map((n) => n.id));
  });

  it('delivery is one Db read per inbox', async () => {
    await db.insertNotes([note()], []);
    const spy = vi.spyOn(db, 'notesForLearner');
    await inbox();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.slice(0, 2)).toEqual([SUNI, 'full']);
    spy.mockRestore();
  });
});

describe('PUT /api/sync/learners/:id/notes/:noteId/state (section 7.6)', () => {
  it('sets readAt once (idempotent) and lets the last reaction win', async () => {
    const c = note();
    await db.insertNotes([c], []);
    const read = await putState(c.id, { read: true });
    expect(read.status).toBe(200);
    const readAt = (read.body.data as { readAt: string }).readAt;
    expect(read.body.data).toEqual({ readAt, reaction: null });
    expect(Number.isNaN(Date.parse(readAt))).toBe(false);
    expect((await putState(c.id, { read: true })).body.data).toEqual({ readAt, reaction: null });
    expect((await putState(c.id, { reaction: 'thanks' })).body.data).toEqual({ readAt, reaction: 'thanks' });
    expect((await putState(c.id, { read: true, reaction: 'did_it' })).body.data).toEqual({ readAt, reaction: 'did_it' });
    const [wire] = (await inbox()).notes;
    expect(wire).toMatchObject({ readAt, reaction: 'did_it' });
  });

  it('a reaction alone does not mark the note read', async () => {
    const c = note();
    await db.insertNotes([c], []);
    expect((await putState(c.id, { reaction: 'happy' })).body.data).toEqual({ readAt: null, reaction: 'happy' });
  });

  it('answers 404 for a note that is not delivered to this device: hidden, withdrawn, unknown, another learner, a family note on a class device', async () => {
    const hidden = note();
    const withdrawn = note();
    const f = familyNote();
    await db.insertNotes([hidden, withdrawn], []);
    await db.insertNotes([f], []);
    await db.hideNote(hidden.id, 'device', new Date());
    await db.withdrawNote(withdrawn.id, new Date());
    for (const id of [hidden.id, withdrawn.id, 'note:missing00']) {
      const res = await putState(id, { read: true });
      expect(res.status, id).toBe(404);
      expect(res.body.error?.code).toBe('not_found');
    }
    expect((await putState(f.id, { read: true }, classOnly)).status).toBe(404);
    expect((await putState(f.id, { read: true }, full)).status).toBe(200);
    await db.putLearner({ id: 'profile:min', displayName: 'Min', ageGroup: '5-7', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });
    await db.addMembership({ spaceId: CLASS, memberKind: 'learner', memberId: 'profile:min', role: 'student', joinedAt: T });
    const toMin = note({ learnerId: 'profile:min' });
    await db.insertNotes([toMin], []);
    expect((await putState(toMin.id, { read: true })).status).toBe(404);
    expect((await db.getNote(toMin.id))?.readAt).toBeNull();
  });

  it('a note past the 30 newest (rule 7) is not delivered, so its state write answers 404 and changes nothing', async () => {
    const rows = Array.from({ length: 31 }, (_, i) => note({ createdAt: ago((i + 1) * 60_000) }));
    await db.insertNotes(rows, []);
    const oldest = rows[30]!;
    const res = await putState(oldest.id, { read: true, reaction: 'thanks' });
    expect(res.status).toBe(404);
    expect(await db.getNote(oldest.id)).toMatchObject({ readAt: null, reaction: null });
    expect((await putState(rows[29]!.id, { read: true })).status).toBe(200);
  });

  it('a class-scoped device may write the state of a class note', async () => {
    const c = note();
    await db.insertNotes([c], []);
    const res = await putState(c.id, { reaction: 'will_try' }, classOnly);
    expect(res.status).toBe(200);
    expect((await db.getNote(c.id))?.reaction).toBe('will_try');
  });

  it('refuses a bad body (empty, unknown reaction, unknown key) with 422 and writes nothing', async () => {
    const c = note();
    await db.insertNotes([c], []);
    for (const body of [{}, { reaction: 'angry' }, { read: false }, { read: true, extra: 1 }, null]) {
      const res = await putState(c.id, body);
      expect(res.status, JSON.stringify(body)).toBe(422);
    }
    expect(await db.getNote(c.id)).toMatchObject({ readAt: null, reaction: null });
  });

  it("needs the learner's device credentials", async () => {
    const c = note();
    await db.insertNotes([c], []);
    expect((await putState(c.id, { read: true }, json)).status).toBe(401);
    expect((await putState(c.id, { read: true }, { ...json, authorization: 'Device device-home0001:wrong' })).status).toBe(401);
  });
});
