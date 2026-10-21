import type { Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { D1Db, type NewNote } from '../db';
import type { D1Like, D1PreparedLike } from '../db/d1';
import app, { scheduled } from '../index';
import { NOTE_PURGE_LIMIT, runScheduledPurge, SCHEDULED_PURGE_ROUNDS } from '../lib/note-retention';
import { notesSendLimiter } from '../routes/notes';
import { testDb as db } from './helpers/db';
import { openSqliteD1 } from './helpers/sqlite';

/**
 * Retention through the routes and the Worker's schedule — F-FEEDBACK-001
 * section 8.7 (PR FB-3b): the lazy purge on every send, and the daily
 * `scheduled` handler (bounded: at most 5 rounds of 200 rows). The Db level
 * (cut-offs, the reported 90-day rule, the purge bounds) is FB-2's
 * `db/__tests__/feedback-contract.test.ts`.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T = '2026-01-01T00:00:00.000Z';
const CLASS = 'space:cls';
const FAMILY = 'space:fam';
const SUNI = 'profile:suni';
const ago = (ms: number, now = Date.now()): string => new Date(now - ms).toISOString();

const space = (id: string, kind: Space['kind'], owner: string): Space => ({ id, kind, name: id, parentSpaceId: null, ownerAccountId: owner, joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: T });

async function seed(target: typeof db): Promise<void> {
  for (const accountId of ['teacher', 'mom']) await target.putAccount({ id: accountId, email: null, displayName: null, consent: null, createdAt: T });
  await target.putSpace(space(CLASS, 'class', 'teacher'));
  await target.putSpace(space(FAMILY, 'family', 'mom'));
  await target.putLearner({ id: SUNI, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });
  for (const [spaceId, memberKind, memberId, role] of [
    [CLASS, 'account', 'teacher', 'owner'],
    [CLASS, 'learner', SUNI, 'student'],
    [FAMILY, 'account', 'mom', 'owner'],
    [FAMILY, 'learner', SUNI, 'student'],
  ] as const) await target.addMembership({ spaceId, memberKind, memberId, role, joinedAt: T });
}

beforeEach(async () => {
  await db.reset();
  notesSendLimiter.reset();
  await seed(db);
});

let seq = 0;
const note = (over: Partial<NewNote> = {}): NewNote => {
  seq += 1;
  return {
    id: `note:ret${String(seq).padStart(7, '0')}`,
    learnerId: SUNI,
    spaceId: CLASS,
    senderAccountId: 'teacher',
    senderRole: 'teacher',
    senderLabel: null,
    batchId: 'notebatch:old',
    batchKind: 'learners',
    presetId: 'progress_reading',
    body: null,
    bodyLocale: null,
    suggest: null,
    createdAt: ago(HOUR),
    ...over,
  };
};
/** `count` live notes created `age` ago, in one insert. */
const old = (count: number, age: number, now = Date.now()): NewNote[] => Array.from({ length: count }, () => note({ createdAt: ago(age, now) }));
const countNotes = async (): Promise<number> => (await db.notesForOversight(SUNI, { before: null, limit: 5000, now: new Date(Date.parse(T) - 400 * DAY) })).length;

describe('the lazy purge on every send (section 8.7 item 1)', () => {
  it('one bounded step per POST /:id/notes: 200 of the notes past 180 days go, younger ones stay', async () => {
    expect(await db.insertNotes(old(250, 181 * DAY), [])).toBe(250);
    const young = note({ createdAt: ago(179 * DAY) });
    expect(await db.insertNotes([young], [])).toBe(1);
    expect(await countNotes()).toBe(251);

    const res = await app.request(`/api/spaces/${CLASS}/notes`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer teacher' }, body: JSON.stringify({ to: { kind: 'learners', ids: [SUNI] }, presetId: 'effort_proud' }) }, { NOTES_SEND: 'enabled' });
    expect(res.status).toBe(201);
    // 50 old + the young one + the new note
    expect(await countNotes()).toBe(52);
    expect((await db.getNote(young.id))?.status).toBe('live');
  });

  it('also drops a reported note 90 days after its newest report, and a hold lifted more than 365 days ago', async () => {
    const reported = note({ createdAt: ago(100 * DAY) });
    expect(await db.insertNotes([reported], [])).toBe(1);
    expect(await db.insertNoteReport({ id: 'notereport:old', noteId: reported.id, learnerId: SUNI, senderAccountId: 'teacher', reason: 'unkind', via: 'family', evidence: 'mom', reporterKey: `family:${FAMILY}`, attest: null, createdAt: ago(95 * DAY), reviewedAt: null, outcome: null })).toBe(true);
    await db.putSenderHold({ accountId: 'someone', reason: 'owner', createdAt: ago(800 * DAY), liftedAt: ago(366 * DAY) });

    const res = await app.request(`/api/spaces/${CLASS}/notes`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer teacher' }, body: JSON.stringify({ to: { kind: 'learners', ids: [SUNI] }, presetId: 'effort_proud' }) }, { NOTES_SEND: 'enabled' });
    expect(res.status).toBe(201);
    expect(await db.getNote(reported.id)).toBeNull();
    expect(await db.getSenderHold('someone')).toBeNull();
  });

  it('a failed purge step never fails the send: the note is written and the next send or daily run retries', async () => {
    const purge = vi.spyOn(db, 'purgeNotes').mockRejectedValueOnce(new Error('D1_ERROR: timeout'));
    const res = await app.request(`/api/spaces/${CLASS}/notes`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer teacher' }, body: JSON.stringify({ to: { kind: 'learners', ids: [SUNI] }, presetId: 'effort_proud' }) }, { NOTES_SEND: 'enabled' });
    expect(purge).toHaveBeenCalledTimes(1);
    purge.mockRestore();
    expect(res.status).toBe(201);
    expect(((await res.json()) as { data: { sent: number } }).data.sent).toBe(1);
  });

  it('a send refused before the insert (switch off) purges nothing', async () => {
    expect(await db.insertNotes(old(3, 181 * DAY), [])).toBe(3);
    const res = await app.request(`/api/spaces/${CLASS}/notes`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer teacher' }, body: JSON.stringify({ to: { kind: 'learners', ids: [SUNI] }, presetId: 'effort_proud' }) }, {});
    expect(res.status).toBe(404);
    expect(await countNotes()).toBe(3);
  });
});

describe('the lazy purge on every family oversight read (section 8.7 item 1, PR FB-4b-family)', () => {
  it('one bounded step per GET …/learners/:learnerId/notes', async () => {
    expect(await db.insertNotes(old(230, 181 * DAY), [])).toBe(230);
    const res = await app.request(`/api/spaces/${FAMILY}/learners/${SUNI}/notes`, { headers: { authorization: 'Bearer mom' } }, {});
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { rows: unknown[] } }).data.rows).toEqual([]);
    expect(await countNotes()).toBe(30);
  });
});

describe('the daily scheduled handler (section 8.7 item 2)', () => {
  it('runs at most 5 rounds of 200 rows: 1,000 of 1,100 expired notes go today, the rest tomorrow; live notes and fresh counters stay', async () => {
    const now = Date.now();
    expect(await db.insertNotes(old(1100, 200 * DAY, now), [])).toBe(1100);
    const keep = note({ createdAt: ago(DAY, now) });
    expect(await db.insertNotes([keep], [])).toBe(1);
    await db.addRateHits([...Array.from({ length: 1050 }, () => ({ key: 'note:acct:teacher', at: ago(2 * DAY, now) })), { key: 'note:acct:teacher', at: ago(HOUR, now) }]);

    const waitUntil = vi.fn();
    await scheduled({ scheduledTime: now }, {}, { waitUntil });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(await countNotes()).toBe(101);
    // rate hits: 1,000 of the 1,050 dead rows are gone; the fresh one counts
    expect(await db.countRateHits('note:acct:teacher', new Date(now - 3 * DAY))).toBe(51);

    await scheduled({ scheduledTime: now }, {});
    expect(await countNotes()).toBe(1);
    expect((await db.getNote(keep.id))?.status).toBe('live');
    expect(await db.countRateHits('note:acct:teacher', new Date(now - 3 * DAY))).toBe(1);
  });

  it('stops after the first round that leaves nothing to purge', async () => {
    const now = new Date();
    expect(await db.insertNotes(old(10, 200 * DAY, now.getTime()), [])).toBe(10);
    expect(await runScheduledPurge(db, now)).toEqual({ rounds: 1, notes: 10, rateHits: 0, classMoves: 0, spaceEvents: 0 });
    expect(await runScheduledPurge(db, now)).toEqual({ rounds: 1, notes: 0, rateHits: 0, classMoves: 0, spaceEvents: 0 });
    expect(SCHEDULED_PURGE_ROUNDS * NOTE_PURGE_LIMIT).toBe(1000);
  });

  it('on D1 one run prepares at most 35 statements (5 rounds of the 4-statement note step, the counter step, the class-move step and [SA] the space-event step), under the 50 a Free-plan invocation allows', async () => {
    const raw = openSqliteD1();
    const own = new D1Db(raw);
    await seed(own);
    const now = Date.now();
    expect(await own.insertNotes(old(1100, 200 * DAY, now), [])).toBe(1100);
    let prepared = 0;
    const binding: D1Like = {
      prepare(sql: string): D1PreparedLike {
        prepared += 1;
        return raw.prepare(sql);
      },
      batch: (statements) => raw.batch(statements),
    };
    await scheduled({ scheduledTime: now }, { DB: binding });
    expect(prepared).toBe(SCHEDULED_PURGE_ROUNDS * 7);
    expect(prepared).toBeLessThan(50);
    expect((await own.notesForOversight(SUNI, { before: null, limit: 5000, now: new Date(now - 400 * DAY) })).length).toBe(100);
    raw.close();
  });
});
