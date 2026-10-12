import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';
import { NOTE_INBOX_LIMIT, noteRateKey, type DeliveredNote, type NewNote, type StoredNote } from '../feedback-types';
import { MemoryDb } from '../memory';
import type { Db } from '../types';
import {
  at,
  CLASS,
  CLASS_B,
  classNote,
  COTEACHER,
  DAD,
  DAY,
  FAMILY,
  familyNote,
  GRANDMA,
  HOUR,
  iso,
  MIN,
  MOM,
  report,
  seedNotesWorld,
  SUNI,
  TEACHER,
  TEACHER_B,
} from './feedback-fixtures';

/** What a fresh row reads back as: the sent fields plus empty state. */
const stored = (n: NewNote, over: Partial<StoredNote> = {}): StoredNote => ({
  ...n,
  status: 'live',
  hiddenVia: null,
  actedByAccountId: null,
  readAt: null,
  reaction: null,
  reactionAt: null,
  hiddenAt: null,
  withdrawnAt: null,
  ...over,
});
/** What the inbox delivers of a fresh row: the learner-facing fields only, never the sender's account (section 8.1). */
const delivered = (n: NewNote, over: Partial<DeliveredNote> = {}): DeliveredNote => ({
  id: n.id,
  spaceId: n.spaceId,
  senderRole: n.senderRole,
  senderLabel: n.senderLabel,
  presetId: n.presetId,
  body: n.body,
  bodyLocale: n.bodyLocale,
  suggest: n.suggest,
  createdAt: n.createdAt,
  readAt: null,
  reaction: null,
  ...over,
});
const ids = (notes: ReadonlyArray<{ id: string }>): string[] => notes.map((n) => n.id);
const NOW = at(0);

/**
 * Notes persistence — F-FEEDBACK-001 section 7.4 (PR FB-2). One contract, two
 * backends: the in-memory stand-in and D1 over the real migrations, so the
 * routes of FB-3a / FB-4a can rely on either.
 */
function feedbackContract(name: string, make: () => Db): void {
  describe(`notes Db contract · ${name}`, () => {
    let db: Db;
    const send = async (...rows: NewNote[]): Promise<number> => db.insertNotes(rows, []);
    beforeEach(async () => {
      db = make();
      await db.reset();
      await seedNotesWorld(db);
    });

    describe('insertNotes', () => {
      it('writes every row and its counter hits; each reads back as a live, unread note', async () => {
        const a = classNote({ suggest: { kind: 'quest', id: 'quest-1' } });
        const b = classNote({ learnerId: MIN, body: null, bodyLocale: null });
        const hits = [noteRateKey.account(TEACHER), noteRateKey.pair(SUNI, TEACHER), noteRateKey.pair(MIN, TEACHER)].map((key) => ({ key, at: iso(-HOUR) }));
        expect(await db.insertNotes([a, b], hits)).toBe(2);
        expect(await db.getNote(a.id)).toEqual(stored(a));
        expect(await db.getNote(b.id)).toEqual(stored(b));
        expect(await db.getNote('note:missing0')).toBeNull();
        const counts = await db.countRateHitsByKeys(hits.map((h) => h.key), at(-DAY));
        expect(Object.fromEntries(counts)).toEqual({ [hits[0]!.key]: 1, [hits[1]!.key]: 1, [hits[2]!.key]: 1 });
        expect(await db.insertNotes([], [])).toBe(0);
      });

      it('reads are copies: nothing is saved by reference', async () => {
        const a = classNote({ suggest: { kind: 'quest', id: 'quest-1' } });
        await send(a);
        const read = await db.getNote(a.id);
        if (read?.suggest) {
          read.suggest.id = 'changed';
          read.status = 'hidden';
        }
        expect(await db.getNote(a.id)).toEqual(stored(a));
      });

      it('writes nothing, not even the counters, while the sender has an active hold; a lifted hold lets it through', async () => {
        await db.putSenderHold({ accountId: TEACHER, reason: 'reports', createdAt: iso(-DAY), liftedAt: null });
        const a = classNote();
        const hit = [{ key: noteRateKey.account(TEACHER), at: iso(0) }];
        expect(await db.insertNotes([a], hit)).toBe(0);
        expect(await db.getNote(a.id)).toBeNull();
        expect((await db.countRateHitsByKeys([hit[0]!.key], at(-DAY))).size).toBe(0);
        // another account is not held
        expect(await send(familyNote())).toBe(1);
        // lifting is the owner's runbook step; a lifted hold no longer blocks
        await db.putSenderHold({ accountId: COTEACHER, reason: 'reports', createdAt: iso(-DAY), liftedAt: iso(-HOUR) });
        expect(await db.insertNotes([classNote({ senderAccountId: COTEACHER })], [{ key: noteRateKey.account(COTEACHER), at: iso(0) }])).toBe(1);
        expect((await db.countRateHitsByKeys([noteRateKey.account(COTEACHER)], at(-DAY))).get(noteRateKey.account(COTEACHER))).toBe(1);
      });

      it('refuses a send that mixes senders', async () => {
        await expect(send(classNote(), familyNote())).rejects.toThrow(/one sender/);
      });

      it('is all-or-nothing: a row naming an unknown learner writes no note and no counter', async () => {
        const good = classNote();
        const hit = [{ key: noteRateKey.account(TEACHER), at: iso(0) }];
        await expect(db.insertNotes([good, classNote({ learnerId: 'profile:nobody' })], hit)).rejects.toThrow(/FOREIGN KEY/);
        expect(await db.getNote(good.id)).toBeNull();
        expect((await db.countRateHitsByKeys([hit[0]!.key], at(-DAY))).size).toBe(0);
      });

      it('enforces the row checks: no label on a teacher note, a known role, a unique id', async () => {
        await expect(send(classNote({ senderLabel: 'mom' }))).rejects.toThrow(/CHECK/);
        await expect(send(classNote({ senderRole: 'admin' as never }))).rejects.toThrow(/CHECK/);
        const a = classNote();
        await send(a);
        await expect(send({ ...a })).rejects.toThrow(/UNIQUE|PRIMARY KEY/);
      });
    });

    describe('set-based reads for a send', () => {
      it('studentsOf answers only current students of that space', async () => {
        await db.removeMembership(CLASS, 'learner', MIN);
        expect((await db.studentsOf(CLASS, [SUNI, MIN, 'profile:nobody', TEACHER])).sort()).toEqual([SUNI]);
        expect((await db.studentsOf(CLASS_B, [SUNI, MIN])).sort()).toEqual([SUNI]);
        expect(await db.studentsOf(CLASS, [])).toEqual([]);
      });

      it('notePrefsFor answers the rows that exist', async () => {
        await db.putNotePrefs({ learnerId: SUNI, classes: 'presets', acknowledgedAt: null, updatedAt: iso(0), updatedVia: 'family', updatedByAccount: MOM });
        expect(await db.notePrefsFor([SUNI, MIN])).toEqual([{ learnerId: SUNI, classes: 'presets', acknowledgedAt: null, updatedAt: iso(0), updatedVia: 'family', updatedByAccount: MOM }]);
        expect(await db.notePrefsFor([])).toEqual([]);
      });

      it('blocksFor answers the learners that stopped this sender only', async () => {
        await db.putBlock({ learnerId: SUNI, senderAccountId: TEACHER, familySpaceId: FAMILY, createdByAccount: MOM, createdAt: iso(0) });
        expect(await db.blocksFor([SUNI, MIN], TEACHER)).toEqual([SUNI]);
        expect(await db.blocksFor([SUNI, MIN], COTEACHER)).toEqual([]);
        expect(await db.blocksFor([], TEACHER)).toEqual([]);
      });

      it('countRateHitsByKeys counts per key from `since` on; addRateHits writes a list', async () => {
        const k1 = noteRateKey.learner(SUNI);
        const k2 = noteRateKey.learner(MIN);
        await db.addRateHits([
          { key: k1, at: iso(-2 * DAY) },
          { key: k1, at: iso(-HOUR) },
          { key: k1, at: iso(0) },
          { key: k2, at: iso(-HOUR) },
        ]);
        await db.addRateHits([]);
        expect(Object.fromEntries(await db.countRateHitsByKeys([k1, k2, 'note:acct:nobody'], at(-DAY)))).toEqual({ [k1]: 2, [k2]: 1 });
        expect((await db.countRateHitsByKeys([], at(-DAY))).size).toBe(0);
        expect(await db.countRateHits(k1, at(-3 * DAY))).toBe(3);
      });
    });

    describe('notesForLearner (the inbox, section 6.8)', () => {
      const inbox = async (scope: 'full' | 'class' = 'full', learnerId = SUNI) => db.notesForLearner(learnerId, scope, NOW, NOTE_INBOX_LIMIT);

      it('delivers live notes newest first with no prefs row', async () => {
        const older = classNote({ createdAt: iso(-2 * HOUR) });
        const newer = familyNote({ createdAt: iso(-HOUR) });
        await send(older);
        await send(newer);
        const box = await inbox();
        expect(box.prefs).toBeNull();
        expect(box.notes).toEqual([delivered(newer), delivered(older)]);
        // the sender's account, the batch and the moderation columns never reach the device
        for (const n of box.notes) expect(Object.keys(n).sort()).toEqual(Object.keys(delivered(newer)).sort());
        expect(await inbox('full', MIN)).toEqual({ notes: [], prefs: null });
        expect(await inbox('full', 'profile:nobody')).toEqual({ notes: [], prefs: null });
      });

      it('rule 1: only live notes of the last 180 days', async () => {
        const live = classNote();
        const hidden = classNote();
        const reported = classNote();
        const withdrawn = classNote();
        const old = classNote({ createdAt: iso(-181 * DAY) });
        const edge = classNote({ createdAt: iso(-180 * DAY) });
        for (const n of [live, hidden, reported, withdrawn, old, edge]) await send(n);
        await db.hideNote(hidden.id, 'device', NOW);
        await db.insertNoteReport(report(reported.id));
        await db.withdrawNote(withdrawn.id, NOW);
        expect(ids((await inbox()).notes)).toEqual([live.id, edge.id]);
      });

      it('rule 2: the learner is still a student of the space, and the space is not archived', async () => {
        const inClass = classNote();
        const inClassB = classNote({ spaceId: CLASS_B, senderAccountId: TEACHER_B, batchId: 'batch:b' });
        await send(inClass);
        await send(inClassB);
        await db.removeMembership(CLASS, 'learner', SUNI);
        const b = await db.getSpace(CLASS_B);
        if (b) await db.putSpace({ ...b, archivedAt: iso(-HOUR) });
        expect((await inbox()).notes).toEqual([]);
      });

      it('rule 3: a class-scoped device sees class notes only', async () => {
        const c = classNote();
        const f = familyNote();
        await send(c);
        await send(f);
        expect(ids((await inbox('class')).notes)).toEqual([c.id]);
        expect(ids((await inbox('full')).notes).sort()).toEqual([c.id, f.id].sort());
      });

      it('rule 4: class notes follow the mode; `presets` drops the text of class notes only, `off` drops class notes', async () => {
        const c = classNote({ createdAt: iso(-2 * HOUR) });
        const f = familyNote({ createdAt: iso(-HOUR) });
        await send(c);
        await send(f);
        const prefs = { learnerId: SUNI, acknowledgedAt: null, updatedAt: iso(0), updatedVia: 'family' as const, updatedByAccount: MOM };
        await db.putNotePrefs({ ...prefs, classes: 'presets' });
        const presets = await inbox();
        expect(presets.prefs).toEqual({ ...prefs, classes: 'presets' });
        expect(presets.notes).toEqual([delivered(f), delivered(c, { body: null })]);
        // the stored row keeps the text for the sender and the family
        expect((await db.getNote(c.id))?.body).toBe('Loved your work today');
        await db.putNotePrefs({ ...prefs, classes: 'off' });
        expect((await inbox()).notes).toEqual([delivered(f)]);
        await db.putNotePrefs({ ...prefs, classes: 'all' });
        expect(ids((await inbox()).notes)).toEqual([f.id, c.id]);
      });

      it('rule 5: a family block of the sender stops every note from that sender, earlier ones included', async () => {
        const c = classNote();
        const co = classNote({ senderAccountId: COTEACHER, batchId: 'batch:co' });
        await send(c);
        await send(co);
        await db.putBlock({ learnerId: SUNI, senderAccountId: TEACHER, familySpaceId: FAMILY, createdByAccount: DAD, createdAt: iso(0) });
        expect(ids((await inbox()).notes)).toEqual([co.id]);
        expect(await db.deleteBlock(SUNI, TEACHER)).toBe(true);
        expect((await inbox()).notes).toHaveLength(2);
      });

      it('rule 6: only while the sender still holds feedback.send in the space', async () => {
        const fromOwner = classNote({ createdAt: iso(-5 * HOUR) });
        const fromCoteacher = classNote({ senderAccountId: COTEACHER, batchId: 'batch:co', createdAt: iso(-4 * HOUR) });
        const fromMom = familyNote({ createdAt: iso(-3 * HOUR) });
        const fromDad = familyNote({ senderAccountId: DAD, senderLabel: 'dad', batchId: 'batch:dad', createdAt: iso(-2 * HOUR) });
        const fromGrandma = familyNote({ senderAccountId: GRANDMA, senderLabel: 'grandma', batchId: 'batch:grandma', createdAt: iso(-HOUR) });
        for (const n of [fromOwner, fromCoteacher, fromMom, fromDad, fromGrandma]) await send(n);
        // caregivers without a grant are not delivered (OD-17); the owner always is
        expect(ids((await inbox()).notes)).toEqual([fromMom.id, fromCoteacher.id, fromOwner.id]);
        await db.putSendGrant({ spaceId: FAMILY, accountId: GRANDMA, grantedBy: MOM, grantedAt: iso(0) });
        expect(ids((await inbox()).notes)).toEqual([fromGrandma.id, fromMom.id, fromCoteacher.id, fromOwner.id]);
        // the co-teacher leaves the class; the grant is withdrawn
        await db.removeMembership(CLASS, 'account', COTEACHER);
        expect(await db.deleteSendGrant(FAMILY, GRANDMA)).toBe(true);
        expect(await db.deleteSendGrant(FAMILY, GRANDMA)).toBe(false);
        expect(ids((await inbox()).notes)).toEqual([fromMom.id, fromOwner.id]);
        // a family role never sends as a teacher, and a teacher role never as a family member
        await db.addMembership({ spaceId: CLASS, memberKind: 'account', memberId: DAD, role: 'caregiver', joinedAt: iso(0) });
        await send(classNote({ senderAccountId: DAD, batchId: 'batch:dad-class' }));
        expect(ids((await inbox()).notes)).toEqual([fromMom.id, fromOwner.id]);
      });

      it('rule 7: at most the newest `limit` notes', async () => {
        const rows = Array.from({ length: NOTE_INBOX_LIMIT + 5 }, (_, i) => classNote({ learnerId: MIN, createdAt: iso(-(i + 1) * 60_000) }));
        expect(await db.insertNotes(rows, [])).toBe(rows.length);
        const box = await db.notesForLearner(MIN, 'full', NOW, NOTE_INBOX_LIMIT);
        expect(ids(box.notes)).toEqual(ids(rows.slice(0, NOTE_INBOX_LIMIT)));
        // ties on createdAt are ordered by id, newest id first
        const tie = [classNote({ createdAt: iso(0) }), classNote({ createdAt: iso(0) })];
        await db.insertNotes(tie, []);
        expect(ids((await db.notesForLearner(SUNI, 'full', NOW, 2)).notes)).toEqual([tie[1]!.id, tie[0]!.id]);
      });
    });

    describe('note state', () => {
      it('setNoteRead sets readAt once; setNoteReaction lets the last pick win; neither touches a note that is not live', async () => {
        const a = classNote();
        const b = classNote();
        await send(a);
        await send(b);
        expect(await db.setNoteRead(a.id, at(HOUR))).toBe(1);
        expect(await db.setNoteRead(a.id, at(2 * HOUR))).toBe(0);
        expect(await db.setNoteReaction(a.id, 'thanks', at(HOUR))).toBe(1);
        expect(await db.setNoteReaction(a.id, 'did_it', at(3 * HOUR))).toBe(1);
        expect(await db.getNote(a.id)).toEqual(stored(a, { readAt: iso(HOUR), reaction: 'did_it', reactionAt: iso(3 * HOUR) }));
        await db.withdrawNote(b.id, NOW);
        expect(await db.setNoteRead(b.id, NOW)).toBe(0);
        expect(await db.setNoteReaction(b.id, 'thanks', NOW)).toBe(0);
        expect(await db.setNoteRead('note:missing0', NOW)).toBe(0);
      });

      it('hideNote: a live note only, naming the caregiver for a family hide and nobody for a device hide', async () => {
        const a = classNote();
        const b = classNote();
        await send(a);
        await send(b);
        expect(await db.hideNote(a.id, 'family', NOW, DAD)).toBe(1);
        expect(await db.hideNote(a.id, 'device', NOW)).toBe(0);
        expect(await db.hideNote(b.id, 'device', NOW, DAD)).toBe(1);
        expect(await db.getNote(a.id)).toEqual(stored(a, { status: 'hidden', hiddenVia: 'family', actedByAccountId: DAD, hiddenAt: iso(0) }));
        expect(await db.getNote(b.id)).toEqual(stored(b, { status: 'hidden', hiddenVia: 'device', actedByAccountId: null, hiddenAt: iso(0) }));
      });

      it("withdrawNote is soft and live-only; withdrawBatch takes back only the sender's live rows of that batch", async () => {
        const a = classNote({ batchId: 'batch:x' });
        const b = classNote({ batchId: 'batch:x', learnerId: MIN });
        const c = classNote({ batchId: 'batch:x' });
        const other = classNote({ batchId: 'batch:y' });
        for (const n of [a, b, c, other]) await send(n);
        await db.insertNoteReport(report(c.id));
        expect(await db.withdrawBatch('batch:x', COTEACHER, NOW)).toBe(0);
        expect(await db.withdrawBatch('batch:x', TEACHER, NOW)).toBe(2);
        expect(await db.getNote(a.id)).toEqual(stored(a, { status: 'withdrawn', withdrawnAt: iso(0) }));
        expect((await db.getNote(c.id))?.status).toBe('reported');
        expect((await db.getNote(other.id))?.status).toBe('live');
        expect(await db.withdrawNote(a.id, NOW)).toBe(0);
        expect(await db.withdrawNote(other.id, NOW)).toBe(1);
      });
    });

    describe('reports and holds (section 8.4)', () => {
      it('insertNoteReport writes the row and marks the note reported, from any status', async () => {
        const a = classNote();
        const b = familyNote();
        await send(a);
        await send(b);
        await db.withdrawNote(b.id, NOW);
        await db.insertNoteReport(report(a.id));
        await db.insertNoteReport(report(b.id, { senderAccountId: MOM, via: 'device', evidence: 'device-1', reporterKey: `family:${FAMILY}`, attest: 'grown_up_pin', reason: 'unsafe' }));
        expect((await db.getNote(a.id))?.status).toBe('reported');
        expect(await db.getNote(b.id)).toEqual(stored(b, { status: 'reported', withdrawnAt: iso(0) }));
        expect(await db.insertNoteReport(report('note:missing0', { id: 'notereport:x' }))).toBe(false);
        expect(await db.countReportersAgainst(TEACHER, at(-DAY))).toBe(1);
      });

      it('insertNoteReport records nothing on a note already past retention at the report time, so it never comes back (section 8.7)', async () => {
        const expired = classNote({ createdAt: iso(-181 * DAY) });
        const stale = classNote({ createdAt: iso(-100 * DAY) });
        await send(expired);
        await send(stale);
        // a reported note whose only report is past 90 days is gone too, even before the purge
        expect(await db.insertNoteReport(report(stale.id, { createdAt: iso(-91 * DAY) }))).toBe(true);
        expect(await db.insertNoteReport(report(expired.id))).toBe(false);
        expect(await db.insertNoteReport(report(stale.id, { id: 'notereport:again' }))).toBe(false);
        expect((await db.getNote(expired.id))?.status).toBe('live');
        expect(await db.notesForSpace(CLASS, { before: null, limit: 50, now: NOW })).toEqual([]);
        expect(await db.notesForOversight(SUNI, { before: null, limit: 50, now: NOW })).toEqual([]);
        expect(await db.countReportersAgainst(TEACHER, at(-DAY))).toBe(0);
        // the edge: a note exactly 180 days old at the report time is still reportable
        const edge = classNote({ createdAt: iso(-180 * DAY) });
        await send(edge);
        expect(await db.insertNoteReport(report(edge.id))).toBe(true);
        expect(ids(await db.notesForOversight(SUNI, { before: null, limit: 50, now: NOW }))).toEqual([edge.id]);
      });

      it('countReportersAgainst counts distinct reporting families from `since` on', async () => {
        const notes = [classNote(), classNote(), classNote({ learnerId: MIN }), classNote({ senderAccountId: COTEACHER, batchId: 'batch:co' })];
        for (const n of notes) await send(n);
        await db.insertNoteReport(report(notes[0]!.id, { reporterKey: 'family:space:family' }));
        await db.insertNoteReport(report(notes[1]!.id, { reporterKey: 'family:space:family', via: 'device', evidence: 'device-1' }));
        await db.insertNoteReport(report(notes[2]!.id, { learnerId: MIN, reporterKey: 'device:device-9', via: 'device', evidence: 'device-9', createdAt: iso(-31 * DAY) }));
        await db.insertNoteReport(report(notes[3]!.id, { senderAccountId: COTEACHER, reporterKey: 'family:space:other' }));
        expect(await db.countReportersAgainst(TEACHER, at(-30 * DAY))).toBe(1);
        expect(await db.countReportersAgainst(TEACHER, at(-40 * DAY))).toBe(2);
        expect(await db.countReportersAgainst(MOM, at(-40 * DAY))).toBe(0);
      });

      it('putSenderHold never rewrites an active hold and replaces a lifted one', async () => {
        expect(await db.getSenderHold(TEACHER)).toBeNull();
        expect(await db.putSenderHold({ accountId: TEACHER, reason: 'unsafe', createdAt: iso(-DAY), liftedAt: null })).toBe(true);
        expect(await db.putSenderHold({ accountId: TEACHER, reason: 'reports', createdAt: iso(0), liftedAt: null })).toBe(false);
        expect(await db.getSenderHold(TEACHER)).toEqual({ accountId: TEACHER, reason: 'unsafe', createdAt: iso(-DAY), liftedAt: null });
        // the owner lifts it in the runbook (a direct UPDATE); modelled here by a lifted row
        await db.reset();
        await seedNotesWorld(db);
        expect(await db.putSenderHold({ accountId: TEACHER, reason: 'owner', createdAt: iso(-2 * DAY), liftedAt: iso(-DAY) })).toBe(true);
        expect(await db.putSenderHold({ accountId: TEACHER, reason: 'reports', createdAt: iso(0), liftedAt: null })).toBe(true);
        expect(await db.getSenderHold(TEACHER)).toEqual({ accountId: TEACHER, reason: 'reports', createdAt: iso(0), liftedAt: null });
      });
    });

    describe('prefs, blocks and grants', () => {
      it('putNotePrefs upserts and keeps an acknowledgement once given', async () => {
        expect(await db.getNotePrefs(SUNI)).toBeNull();
        await db.putNotePrefs({ learnerId: SUNI, classes: 'all', acknowledgedAt: iso(0), updatedAt: iso(0), updatedVia: 'device', updatedByAccount: null });
        await db.putNotePrefs({ learnerId: SUNI, classes: 'off', acknowledgedAt: null, updatedAt: iso(HOUR), updatedVia: 'family', updatedByAccount: DAD });
        expect(await db.getNotePrefs(SUNI)).toEqual({ learnerId: SUNI, classes: 'off', acknowledgedAt: iso(0), updatedAt: iso(HOUR), updatedVia: 'family', updatedByAccount: DAD });
        await expect(db.putNotePrefs({ learnerId: 'profile:nobody', classes: 'all', acknowledgedAt: null, updatedAt: iso(0), updatedVia: 'device', updatedByAccount: null })).rejects.toThrow(/FOREIGN KEY/);
      });

      it('putBlock is insert-if-absent; listBlocks is newest first; deleteBlock answers whether one existed', async () => {
        await db.putBlock({ learnerId: SUNI, senderAccountId: TEACHER, familySpaceId: FAMILY, createdByAccount: MOM, createdAt: iso(-HOUR) });
        await db.putBlock({ learnerId: SUNI, senderAccountId: TEACHER, familySpaceId: FAMILY, createdByAccount: DAD, createdAt: iso(0) });
        await db.putBlock({ learnerId: SUNI, senderAccountId: GRANDMA, familySpaceId: FAMILY, createdByAccount: MOM, createdAt: iso(0) });
        await db.putBlock({ learnerId: MIN, senderAccountId: TEACHER, familySpaceId: FAMILY, createdByAccount: MOM, createdAt: iso(0) });
        expect(await db.listBlocks(SUNI)).toEqual([
          { learnerId: SUNI, senderAccountId: GRANDMA, familySpaceId: FAMILY, createdByAccount: MOM, createdAt: iso(0) },
          { learnerId: SUNI, senderAccountId: TEACHER, familySpaceId: FAMILY, createdByAccount: MOM, createdAt: iso(-HOUR) },
        ]);
        expect(await db.deleteBlock(SUNI, TEACHER)).toBe(true);
        expect(await db.deleteBlock(SUNI, TEACHER)).toBe(false);
        expect(await db.listBlocks(SUNI)).toHaveLength(1);
      });

      it('send grants put, read and delete', async () => {
        expect(await db.getSendGrant(FAMILY, DAD)).toBeNull();
        await db.putSendGrant({ spaceId: FAMILY, accountId: DAD, grantedBy: MOM, grantedAt: iso(-HOUR) });
        await db.putSendGrant({ spaceId: FAMILY, accountId: DAD, grantedBy: MOM, grantedAt: iso(0) });
        expect(await db.getSendGrant(FAMILY, DAD)).toEqual({ spaceId: FAMILY, accountId: DAD, grantedBy: MOM, grantedAt: iso(0) });
        expect(await db.deleteSendGrant(FAMILY, DAD)).toBe(true);
        expect(await db.getSendGrant(FAMILY, DAD)).toBeNull();
        await expect(db.putSendGrant({ spaceId: 'space:nope', accountId: DAD, grantedBy: MOM, grantedAt: iso(0) })).rejects.toThrow(/FOREIGN KEY/);
      });
    });

    describe('lists', () => {
      it('notesForSpace: newest first, keyset paging that never skips a batch sharing one time, optional learner filter', async () => {
        const batch = Array.from({ length: 5 }, (_, i) => classNote({ learnerId: i % 2 === 0 ? SUNI : MIN, createdAt: iso(-HOUR), batchId: 'batch:same' }));
        const later = classNote({ createdAt: iso(-60_000) });
        await db.insertNotes(batch, []);
        await send(later);
        await send(familyNote());
        const page1 = await db.notesForSpace(CLASS, { before: null, limit: 3, now: NOW });
        const last = page1[page1.length - 1]!;
        const page2 = await db.notesForSpace(CLASS, { before: { createdAt: last.createdAt, id: last.id }, limit: 3, now: NOW });
        const all = [...ids(page1), ...ids(page2)];
        expect(all).toEqual([later.id, ...ids(batch).sort().reverse()]);
        expect(ids(await db.notesForSpace(CLASS, { before: null, limit: 50, now: NOW, learnerId: MIN })).sort()).toEqual(ids(batch.filter((n) => n.learnerId === MIN)).sort());
        expect(ids(await db.notesForSpace(FAMILY, { before: null, limit: 50, now: NOW }))).toHaveLength(1);
      });

      it('every list hides rows past retention: 180 days for a note, 90 days after the newest report for a reported one', async () => {
        const fresh = classNote();
        const old = classNote({ createdAt: iso(-181 * DAY) });
        const reportedRecently = classNote({ createdAt: iso(-170 * DAY) });
        const reportedLongAgo = classNote({ createdAt: iso(-100 * DAY) });
        const reportedOldNote = classNote({ createdAt: iso(-200 * DAY) });
        for (const n of [fresh, old, reportedRecently, reportedLongAgo, reportedOldNote]) await send(n);
        await db.insertNoteReport(report(reportedRecently.id, { createdAt: iso(-10 * DAY) }));
        await db.insertNoteReport(report(reportedLongAgo.id, { createdAt: iso(-91 * DAY) }));
        await db.insertNoteReport(report(reportedOldNote.id, { createdAt: iso(-89 * DAY) }));
        const expected = [fresh.id, reportedRecently.id, reportedOldNote.id];
        expect(ids(await db.notesForSpace(CLASS, { before: null, limit: 50, now: NOW }))).toEqual(expected);
        expect(ids(await db.notesForOversight(SUNI, { before: null, limit: 50, now: NOW }))).toEqual(expected);
      });

      it('notesForOversight: every note to the learner from every space, every status, with paging', async () => {
        const c = classNote({ createdAt: iso(-3 * HOUR) });
        const b = classNote({ spaceId: CLASS_B, senderAccountId: TEACHER_B, batchId: 'batch:b', createdAt: iso(-2 * HOUR) });
        const f = familyNote({ createdAt: iso(-HOUR) });
        const toMin = classNote({ learnerId: MIN });
        for (const n of [c, b, f, toMin]) await send(n);
        await db.withdrawNote(f.id, NOW);
        await db.hideNote(b.id, 'family', NOW, MOM);
        const rows = await db.notesForOversight(SUNI, { before: null, limit: 50, now: NOW });
        expect(rows.map((n) => [n.id, n.status])).toEqual([
          [f.id, 'withdrawn'],
          [b.id, 'hidden'],
          [c.id, 'live'],
        ]);
        expect(ids(await db.notesForOversight(SUNI, { before: { createdAt: f.createdAt, id: f.id }, limit: 1, now: NOW }))).toEqual([b.id]);
      });
    });

    describe('cleanup and retention', () => {
      it('deleteNotesForMembership removes live, hidden and withdrawn notes of that space only; reported ones stay', async () => {
        const live = classNote();
        const hidden = classNote();
        const withdrawn = classNote();
        const reported = classNote();
        const otherSpace = classNote({ spaceId: CLASS_B, senderAccountId: TEACHER_B, batchId: 'batch:b' });
        const otherLearner = classNote({ learnerId: MIN });
        for (const n of [live, hidden, withdrawn, reported, otherSpace, otherLearner]) await send(n);
        await db.hideNote(hidden.id, 'family', NOW, MOM);
        await db.withdrawNote(withdrawn.id, NOW);
        await db.insertNoteReport(report(reported.id));
        expect(await db.deleteNotesForMembership(SUNI, CLASS)).toBe(3);
        for (const n of [live, hidden, withdrawn]) expect(await db.getNote(n.id)).toBeNull();
        for (const n of [reported, otherSpace, otherLearner]) expect(await db.getNote(n.id)).not.toBeNull();
      });

      it('purgeNotes removes what retention allows, at most `limit` rows per step', async () => {
        const old = [classNote({ createdAt: iso(-200 * DAY) }), classNote({ createdAt: iso(-190 * DAY) }), classNote({ createdAt: iso(-181 * DAY) })];
        const fresh = classNote({ createdAt: iso(-179 * DAY) });
        const reportedGone = classNote({ createdAt: iso(-100 * DAY) });
        const reportedKept = classNote({ createdAt: iso(-200 * DAY) });
        for (const n of [...old, fresh, reportedGone, reportedKept]) await send(n);
        await db.insertNoteReport(report(reportedGone.id, { createdAt: iso(-91 * DAY) }));
        await db.insertNoteReport(report(reportedKept.id, { createdAt: iso(-89 * DAY) }));
        await db.putSenderHold({ accountId: 'acct-gone', reason: 'owner', createdAt: iso(-400 * DAY), liftedAt: iso(-366 * DAY) });
        await db.putSenderHold({ accountId: 'acct-kept', reason: 'owner', createdAt: iso(-400 * DAY), liftedAt: iso(-364 * DAY) });
        await db.putSenderHold({ accountId: 'acct-active', reason: 'owner', createdAt: iso(-400 * DAY), liftedAt: null });
        const cut = (days: number) => at(-days * DAY);
        // limit 2: two of the three old notes, the reported note (its report goes with it), the lifted hold
        expect(await db.purgeNotes(cut(180), cut(90), cut(365), 2)).toBe(2 + 1 + 1);
        expect((await Promise.all(old.map((n) => db.getNote(n.id)))).filter(Boolean)).toHaveLength(1);
        expect(await db.purgeNotes(cut(180), cut(90), cut(365), 2)).toBe(1);
        expect(await db.purgeNotes(cut(180), cut(90), cut(365), 2)).toBe(0);
        for (const n of [...old, reportedGone]) expect(await db.getNote(n.id)).toBeNull();
        for (const n of [fresh, reportedKept]) expect(await db.getNote(n.id)).not.toBeNull();
        expect(await db.getSenderHold('acct-gone')).toBeNull();
        expect(await db.getSenderHold('acct-kept')).not.toBeNull();
        expect(await db.getSenderHold('acct-active')).not.toBeNull();
        expect(await db.countReportersAgainst(TEACHER, cut(400))).toBe(1);
      });

      it('purgeNotes keeps every report of a note still under review, and drops a stale reported note with its reports', async () => {
        const underReview = classNote({ createdAt: iso(-150 * DAY) });
        const stale = classNote({ createdAt: iso(-150 * DAY) });
        for (const n of [underReview, stale]) await send(n);
        await db.insertNoteReport(report(underReview.id, { id: 'notereport:first', createdAt: iso(-95 * DAY), reporterKey: 'family:first' }));
        await db.insertNoteReport(report(underReview.id, { id: 'notereport:second', createdAt: iso(-10 * DAY), reporterKey: 'family:second' }));
        await db.insertNoteReport(report(stale.id, { id: 'notereport:stale', createdAt: iso(-120 * DAY), reporterKey: 'family:stale' }));
        const cut = (days: number) => at(-days * DAY);
        // only the stale note goes (its report with it); the first report of the note under review stays for the owner's queue
        expect(await db.purgeNotes(cut(180), cut(90), cut(365), 10)).toBe(1);
        expect(await db.getNote(stale.id)).toBeNull();
        expect((await db.getNote(underReview.id))?.status).toBe('reported');
        expect(await db.countReportersAgainst(TEACHER, cut(400))).toBe(2);
        expect(await db.purgeNotes(cut(180), cut(90), cut(365), 10)).toBe(0);
      });

      it("deleteLearner erases the learner's notes, reports, prefs, blocks and note counters, and nobody else's", async () => {
        const toSuni = classNote();
        const toMin = classNote({ learnerId: MIN });
        await send(toSuni);
        await send(toMin);
        await db.insertNoteReport(report(toSuni.id));
        await db.putNotePrefs({ learnerId: SUNI, classes: 'off', acknowledgedAt: null, updatedAt: iso(0), updatedVia: 'family', updatedByAccount: MOM });
        await db.putBlock({ learnerId: SUNI, senderAccountId: TEACHER, familySpaceId: FAMILY, createdByAccount: MOM, createdAt: iso(0) });
        await db.putSendGrant({ spaceId: FAMILY, accountId: DAD, grantedBy: MOM, grantedAt: iso(0) });
        // a learner whose id extends Suni's must keep its counters
        await db.putLearner({ id: 'profile:suni-2', displayName: 'S2', ageGroup: '8-9', avatar: 'x', recoveryHash: null, createdAt: iso(0), lastActiveAt: iso(0) });
        const erased = [noteRateKey.learner(SUNI), noteRateKey.reportLearner(SUNI), noteRateKey.pair(SUNI, TEACHER), noteRateKey.pair(SUNI, MOM)];
        const kept = [noteRateKey.learner(MIN), noteRateKey.pair(MIN, TEACHER), noteRateKey.pair('profile:suni-2', TEACHER), noteRateKey.account(TEACHER), noteRateKey.reportAccount(MOM)];
        await db.addRateHits([...erased, ...kept].map((key) => ({ key, at: iso(0) })));
        expect(await db.deleteLearner(SUNI)).toBe(true);
        expect(await db.getNote(toSuni.id)).toBeNull();
        expect(await db.getNote(toMin.id)).not.toBeNull();
        expect(await db.getNotePrefs(SUNI)).toBeNull();
        expect(await db.listBlocks(SUNI)).toEqual([]);
        expect(await db.countReportersAgainst(TEACHER, at(-DAY))).toBe(0);
        expect(Object.fromEntries(await db.countRateHitsByKeys([...erased, ...kept], at(-DAY)))).toEqual(Object.fromEntries(kept.map((k) => [k, 1])));
        // the family's grant is not the learner's
        expect(await db.getSendGrant(FAMILY, DAD)).not.toBeNull();
      });

      it('reset empties the six tables', async () => {
        const n = classNote();
        await send(n);
        await db.insertNoteReport(report(n.id));
        await db.putSenderHold({ accountId: TEACHER, reason: 'owner', createdAt: iso(0), liftedAt: null });
        await db.putNotePrefs({ learnerId: SUNI, classes: 'off', acknowledgedAt: null, updatedAt: iso(0), updatedVia: 'family', updatedByAccount: MOM });
        await db.putBlock({ learnerId: SUNI, senderAccountId: TEACHER, familySpaceId: FAMILY, createdByAccount: MOM, createdAt: iso(0) });
        await db.putSendGrant({ spaceId: FAMILY, accountId: DAD, grantedBy: MOM, grantedAt: iso(0) });
        await db.reset();
        await seedNotesWorld(db);
        expect(await db.getNote(n.id)).toBeNull();
        expect(await db.countReportersAgainst(TEACHER, at(-DAY))).toBe(0);
        expect(await db.getSenderHold(TEACHER)).toBeNull();
        expect(await db.getNotePrefs(SUNI)).toBeNull();
        expect(await db.listBlocks(SUNI)).toEqual([]);
        expect(await db.getSendGrant(FAMILY, DAD)).toBeNull();
      });
    });
  });
}

feedbackContract('memory', () => new MemoryDb());
const sqlite = openSqliteD1();
feedbackContract('sqlite (real migrations)', () => new D1Db(sqlite));
