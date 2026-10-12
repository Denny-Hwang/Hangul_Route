import { TRANSFER_COOLING_OFF_MS, TRANSFER_WINDOW_MS } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';
import type { LearnerConsentRecord } from '../transfer-types';
import { transferRateKey } from '../transfer-types';
import {
  approvedRequest,
  at,
  consentRecord,
  created,
  DAY,
  DEST,
  executeInput,
  FAMILY,
  fillClass,
  HOUR,
  iso,
  LEARNER,
  learner,
  learnerSideRow,
  seedWorld,
  SOURCE,
  sourceRow,
  T0,
} from './transfer-fixtures';

const ID = 'transfer:0001';
const teacher = (slots: Array<'source' | 'destination'>, accountId = 'teacher-a') => ({ kind: 'teacher' as const, slots, accountId, via: 'owner' as const });

/**
 * Class-transfer persistence — F-SPACE-002 section 4.7 (PR T-3b). One
 * contract, two backends: every CAS method answers the rows it changed and 0
 * on a lost race; `executeTransfer` writes everything or nothing.
 */
/**
 * Removes only the learner row, keeping the rows that point at it: a state the
 * public Db cannot reach (deleteLearner erases the requests too), so the gate's
 * own learner check is decided by a test (section 4.7, "erased learner").
 */
type DropLearnerRowOnly = (db: Db, learnerId: string) => Promise<void>;

function transferContract(name: string, make: () => Db, dropLearnerRowOnly: DropLearnerRowOnly): void {
  describe(`transfer Db contract · ${name}`, () => {
    let db: Db;
    beforeEach(async () => {
      db = make();
      await db.reset();
      await seedWorld(db);
    });

    describe('createTransfer', () => {
      it('stores the row and its created event; every field reads back', async () => {
        const row = learnerSideRow({ introduce: true });
        expect(await db.createTransfer(row, created)).toBe('created');
        expect(await db.getTransfer(ID)).toEqual(row);
        expect(await db.transferEvents(ID)).toEqual([{ id: expect.any(Number), transferId: ID, ...created }]);
        expect(await db.getTransfer('transfer:nope')).toBeNull();
      });

      it('reads are copies: nothing is saved by reference', async () => {
        await db.createTransfer(learnerSideRow(), created);
        const read = await db.getTransfer(ID);
        if (read) {
          read.status = 'executed';
          read.learner.shown?.lineIds.push('extra');
        }
        expect(await db.getTransfer(ID)).toEqual(learnerSideRow());
      });

      it('answers already_open while the learner has an open request, and writes nothing', async () => {
        await db.createTransfer(learnerSideRow(), created);
        expect(await db.createTransfer(learnerSideRow({ id: 'transfer:0002', destSpaceId: 'space:class-c' }), created)).toBe('already_open');
        expect(await db.getTransfer('transfer:0002')).toBeNull();
        expect(await db.transferEvents('transfer:0002')).toEqual([]);
        // an approved request is open too
        await db.consentSlot(ID, teacher(['source', 'destination']), at(HOUR));
        await db.promoteTransfer(ID, at(HOUR));
        expect(await db.createTransfer(sourceRow({ id: 'transfer:0002' }), created)).toBe('already_open');
        // once it ended, a new request may start
        expect(await db.cancelTransfer(ID, 'cancelled_initiator', 'family', at(2 * HOUR))).toBe(1);
        expect(await db.createTransfer(sourceRow({ id: 'transfer:0002' }), created)).toBe('created');
        expect((await db.openTransferOf(LEARNER))?.id).toBe('transfer:0002');
      });

      it('an illegal row is refused by the CHECKs and leaves neither the row nor the event (one transaction)', async () => {
        const unrecorded = { ...learnerSideRow().learner, textVersion: null };
        await expect(db.createTransfer(learnerSideRow({ learner: unrecorded }), created)).rejects.toThrow(/CHECK/i);
        // a move into the class the learner is leaving would end with the learner in no class
        await expect(db.createTransfer(learnerSideRow({ destSpaceId: SOURCE }), created)).rejects.toThrow(/CHECK/i);
        expect(await db.getTransfer(ID)).toBeNull();
        expect(await db.transferEvents(ID)).toEqual([]);
        expect(await db.createTransfer(learnerSideRow(), created)).toBe('created');
      });

      it('inserts only a new requested row: any other status cannot skip the consent and promote steps', async () => {
        const allIn = { learner: learnerSideRow().learner, destination: { state: 'consented' as const, at: T0, accountId: 'teacher-b', via: 'owner' as const } };
        await expect(db.createTransfer(sourceRow({ status: 'approved', ...allIn, approvedAt: T0 }), created)).rejects.toThrow(/requested/);
        await expect(db.createTransfer(learnerSideRow({ status: 'declined', endReason: 'declined_source', endedAt: T0 }), created)).rejects.toThrow(/requested/);
        await expect(db.createTransfer(sourceRow({ status: 'executed', ...allIn, executedAt: T0 }), created)).rejects.toThrow(/requested/);
        expect(await db.getTransfer(ID)).toBeNull();
        expect(await db.transferEvents(ID)).toEqual([]);
        expect(await db.createTransfer(learnerSideRow(), created)).toBe('created');
      });
      it('refuses a new row whose starting slots break the initiator table (section 4.1), and writes nothing', async () => {
        const learnerIn = learnerSideRow().learner;
        const learnerPending = sourceRow().learner;
        const sourceIn = { state: 'consented' as const, at: T0, accountId: 'teacher-a', via: 'owner' as const };
        const destIn = { state: 'consented' as const, at: T0, accountId: 'teacher-b', via: 'owner' as const };
        const bad = [
          learnerSideRow({ destination: destIn }), // the destination slot is never pre-filled
          learnerSideRow({ source: sourceIn }),
          learnerSideRow({ source: { state: 'not_required', at: null, accountId: null, via: null } }), // only the archive transition sets it
          learnerSideRow({ learner: learnerPending, executeAfter: null }), // the learner side consents in the same call
          learnerSideRow({ destination: { state: 'pending', at: T0, accountId: 'teacher-b', via: 'owner' } }), // a pending slot carries no answer
          sourceRow({ destination: destIn }),
          sourceRow({ source: { state: 'pending', at: null, accountId: null, via: null } }),
          sourceRow({ source: { state: 'consented', at: T0, accountId: null, via: null } }), // a consent without its account
          sourceRow({ learner: learnerIn, executeAfter: iso(TRANSFER_COOLING_OFF_MS) }),
          sourceRow({ learner: { ...learnerPending, evidence: 'mom' } }),
        ];
        for (const row of bad) await expect(db.createTransfer(row, created), JSON.stringify(row)).rejects.toThrow(/initiator/);
        expect(await db.getTransfer(ID)).toBeNull();
        expect(await db.transferEvents(ID)).toEqual([]);
      });

      it('refuses a new row whose execute_after is not the learner consent + 48 h, or that carries later-state fields', async () => {
        const bad: Array<[ReturnType<typeof learnerSideRow>, RegExp]> = [
          [learnerSideRow({ executeAfter: null }), /execute_after/],
          [learnerSideRow({ executeAfter: iso(HOUR) }), /execute_after/],
          [sourceRow({ executeAfter: iso(TRANSFER_COOLING_OFF_MS) }), /execute_after/],
          [learnerSideRow({ approvedAt: T0 }), /new request/],
          [learnerSideRow({ executedAt: T0 }), /new request/],
          [learnerSideRow({ endedAt: T0 }), /new request/],
          [learnerSideRow({ endReason: 'expired' }), /new request/],
          [learnerSideRow({ endActor: 'system' }), /new request/],
          [learnerSideRow({ blockReason: 'cap_class' }), /new request/],
          [learnerSideRow({ rev: 3 }), /new request/],
        ];
        for (const [row, message] of bad) await expect(db.createTransfer(row, created), JSON.stringify(row)).rejects.toThrow(message);
        expect(await db.getTransfer(ID)).toBeNull();
        expect(await db.transferEvents(ID)).toEqual([]);
      });

      it('refuses a timestamp that is not the canonical ISO form (text comparisons in SQL rely on it)', async () => {
        const learnerAt = (value: string) => ({ ...learnerSideRow().learner, at: value });
        const bad = [
          learnerSideRow({ createdAt: '2026-10-11T00:00:00Z' }), // no milliseconds: sorts after '.500Z' of the same second
          learnerSideRow({ updatedAt: 'yesterday' }),
          learnerSideRow({ expiresAt: '2026-10-25T00:00:00Z' }),
          learnerSideRow({ expiresAt: '2026-10-25 00:00:00.000Z' }),
          learnerSideRow({ learner: learnerAt('2026-10-11T00:00:00Z'), executeAfter: iso(TRANSFER_COOLING_OFF_MS) }),
          sourceRow({ source: { state: 'consented', at: '2026-10-11T09:00:00+09:00', accountId: 'teacher-a', via: 'owner' } }),
        ];
        for (const row of bad) await expect(db.createTransfer(row, created), JSON.stringify(row)).rejects.toThrow(/timestamp/);
        expect(await db.getTransfer(ID)).toBeNull();
        expect(await db.createTransfer(learnerSideRow(), created)).toBe('created');
      });
    });

    describe('consentSlot', () => {
      it('records the learner consent once, with its evidence and execute_after = now + 48 h', async () => {
        await db.createTransfer(sourceRow(), created);
        const record = consentRecord({ basis: 'device_attested', attest: 'grown_up_pin', evidence: 'device-a', role: null, locale: 'ko' });
        expect(await db.consentSlot(ID, { kind: 'learner', record }, at(HOUR))).toBe(1);
        const read = await db.getTransfer(ID);
        expect(read?.learner).toEqual({ state: 'consented', at: iso(HOUR), basis: 'device_attested', attest: 'grown_up_pin', evidence: 'device-a', role: null, textVersion: record.textVersion, locale: 'ko', shown: record.shown, terms: record.terms });
        expect(read?.executeAfter).toBe(iso(HOUR + TRANSFER_COOLING_OFF_MS));
        expect(read).toMatchObject({ rev: 1, updatedAt: iso(HOUR), status: 'requested' });
        // the second guardian loses the race
        expect(await db.consentSlot(ID, { kind: 'learner', record: consentRecord({ evidence: 'dad' }) }, at(2 * HOUR))).toBe(0);
        expect((await db.getTransfer(ID))?.learner.evidence).toBe('device-a');
      });

      it('records the introduce option with the learner consent; leaving it out keeps the stored choice', async () => {
        await db.createTransfer(sourceRow(), created);
        expect(await db.consentSlot(ID, { kind: 'learner', record: consentRecord(), introduce: true }, at(HOUR))).toBe(1);
        expect((await db.getTransfer(ID))?.introduce).toBe(true);
        await db.cancelTransfer(ID, 'withdrawn_learner', 'family', at(HOUR));
        await db.createTransfer(sourceRow({ id: 'transfer:0002', introduce: true }), created);
        expect(await db.consentSlot('transfer:0002', { kind: 'learner', record: consentRecord() }, at(HOUR))).toBe(1);
        expect((await db.getTransfer('transfer:0002'))?.introduce).toBe(true);
        await db.resetLearnerConsent('transfer:0002', 'terms_changed', at(2 * HOUR));
        expect(await db.consentSlot('transfer:0002', { kind: 'learner', record: consentRecord(), introduce: false }, at(3 * HOUR))).toBe(1);
        expect((await db.getTransfer('transfer:0002'))?.introduce).toBe(false);
      });

      it('fills a teacher slot once; the second answer is a lost race', async () => {
        await db.createTransfer(learnerSideRow(), created);
        expect(await db.consentSlot(ID, teacher(['source']), at(HOUR))).toBe(1);
        expect(await db.consentSlot(ID, teacher(['source'], 'school-admin'), at(HOUR))).toBe(0);
        expect((await db.getTransfer(ID))?.source).toEqual({ state: 'consented', at: iso(HOUR), accountId: 'teacher-a', via: 'owner' });
        expect(await db.consentSlot(ID, { kind: 'teacher', slots: ['destination'], accountId: 'teacher-b', via: 'school_admin' }, at(2 * HOUR))).toBe(1);
        expect((await db.getTransfer(ID))?.destination).toEqual({ state: 'consented', at: iso(2 * HOUR), accountId: 'teacher-b', via: 'school_admin' });
        expect((await db.getTransfer(ID))?.rev).toBe(2);
      });

      it('refuses the destination slot until the learner slot is consented', async () => {
        await db.createTransfer(sourceRow(), created);
        expect(await db.consentSlot(ID, teacher(['destination'], 'teacher-b'), at(HOUR))).toBe(0);
        expect((await db.getTransfer(ID))?.destination.state).toBe('pending');
        await db.consentSlot(ID, { kind: 'learner', record: consentRecord() }, at(HOUR));
        expect(await db.consentSlot(ID, teacher(['destination'], 'teacher-b'), at(2 * HOUR))).toBe(1);
      });

      it('a two-slot approve (T11) sets both teacher slots in one write, or neither', async () => {
        await db.createTransfer(learnerSideRow(), created);
        expect(await db.consentSlot(ID, teacher(['source', 'destination']), at(HOUR))).toBe(1);
        const read = await db.getTransfer(ID);
        expect(read?.source).toEqual({ state: 'consented', at: iso(HOUR), accountId: 'teacher-a', via: 'owner' });
        expect(read?.destination).toEqual({ state: 'consented', at: iso(HOUR), accountId: 'teacher-a', via: 'owner' });
        expect(read?.rev).toBe(1);

        // a source-started request: the source is in, so a two-slot approve changes nothing
        await db.cancelTransfer(ID, 'cancelled_initiator', 'family', at(HOUR));
        await db.createTransfer(sourceRow({ id: 'transfer:0002' }), created);
        expect(await db.consentSlot('transfer:0002', { kind: 'learner', record: consentRecord() }, at(HOUR))).toBe(1);
        expect(await db.consentSlot('transfer:0002', teacher(['destination', 'source']), at(HOUR))).toBe(0);
        expect((await db.getTransfer('transfer:0002'))?.destination.state).toBe('pending');
      });

      it('changes nothing on an ended or unknown request, and refuses an empty or repeated slot list', async () => {
        await db.createTransfer(learnerSideRow(), created);
        await db.declineSlot(ID, 'destination', 'declined_destination', 'destination', at(HOUR));
        expect(await db.consentSlot(ID, teacher(['source']), at(2 * HOUR))).toBe(0);
        expect(await db.consentSlot('transfer:nope', teacher(['source']), at(2 * HOUR))).toBe(0);
        await expect(db.consentSlot(ID, teacher([]), at(2 * HOUR))).rejects.toThrow(/slot/);
        await expect(db.consentSlot(ID, teacher(['source', 'source']), at(2 * HOUR))).rejects.toThrow(/slot/);
      });

      it('writes the consenting events with the CAS, once; a lost race writes none (T-5b audit)', async () => {
        await db.createTransfer(learnerSideRow(), created);
        const source = { at: iso(HOUR), actorKind: 'account' as const, actorRef: 'teacher-a', event: 'consented' as const, slot: 'source' as const, detail: { via: 'owner' } };
        expect(await db.consentSlot(ID, teacher(['source']), at(HOUR), [source])).toBe(1);
        // the same answer again in the same millisecond: the CAS loses and no second event appears
        expect(await db.consentSlot(ID, teacher(['source'], 'school-admin'), at(HOUR), [{ ...source, actorRef: 'school-admin' }])).toBe(0);
        expect((await db.transferEvents(ID)).map((e) => [e.event, e.actorRef, e.slot, e.detail])).toEqual([
          ['created', 'mom', null, null],
          ['consented', 'teacher-a', 'source', { via: 'owner' }],
        ]);
        // the token that guards the events never stays on the row
        expect(await db.getTransfer(ID)).toMatchObject({ blockReason: null, rev: 1 });

        // a two-slot approve (T11) writes one event per slot, in the same transaction
        await db.cancelTransfer(ID, 'withdrawn_learner', 'family', at(HOUR));
        await db.createTransfer(learnerSideRow({ id: 'transfer:0002' }), created);
        const both = [
          { ...source, at: iso(2 * HOUR) },
          { ...source, at: iso(2 * HOUR), slot: 'destination' as const },
        ];
        expect(await db.consentSlot('transfer:0002', teacher(['source', 'destination']), at(2 * HOUR), both)).toBe(1);
        expect((await db.transferEvents('transfer:0002')).map((e) => [e.event, e.slot])).toEqual([
          ['created', null],
          ['consented', 'source'],
          ['consented', 'destination'],
        ]);
      });

      it('a learner consent writes its event once, again after a reset, never for the guardian who lost the race', async () => {
        await db.createTransfer(sourceRow(), created);
        const event = (actorRef: string, ms: number) => ({ at: iso(ms), actorKind: 'account' as const, actorRef, event: 'consented' as const, slot: 'learner' as const, detail: { basis: 'caregiver' } });
        expect(await db.consentSlot(ID, { kind: 'learner', record: consentRecord() }, at(HOUR), [event('mom', HOUR)])).toBe(1);
        expect(await db.consentSlot(ID, { kind: 'learner', record: consentRecord({ evidence: 'dad' }) }, at(HOUR), [event('dad', HOUR)])).toBe(0);
        await db.resetLearnerConsent(ID, 'terms_changed', at(2 * HOUR));
        expect(await db.consentSlot(ID, { kind: 'learner', record: consentRecord({ evidence: 'dad' }) }, at(3 * HOUR), [event('dad', 3 * HOUR)])).toBe(1);
        expect((await db.transferEvents(ID)).map((e) => [e.event, e.actorRef])).toEqual([
          ['created', 'mom'],
          ['consented', 'mom'],
          ['consent_reset', null],
          ['consented', 'dad'],
        ]);
        expect(await db.getTransfer(ID)).toMatchObject({ blockReason: null, learner: { state: 'consented', evidence: 'dad' } });
      });

      it('an event that cannot be written rolls the consent back (one transaction)', async () => {
        await db.createTransfer(learnerSideRow(), created);
        const bad = { at: iso(HOUR), actorKind: 'robot' as never, actorRef: 'teacher-a', event: 'consented' as const, slot: 'source' as const, detail: null };
        await expect(db.consentSlot(ID, teacher(['source']), at(HOUR), [bad])).rejects.toThrow(/CHECK/i);
        expect(await db.getTransfer(ID)).toMatchObject({ status: 'requested', source: { state: 'pending' }, blockReason: null, rev: 0 });
        expect((await db.transferEvents(ID)).map((e) => e.event)).toEqual(['created']);
      });
    });

    describe('ending a request', () => {
      it('declineSlot ends an open request once; a later approve changes nothing', async () => {
        await db.createTransfer(learnerSideRow(), created);
        expect(await db.declineSlot(ID, 'source', 'declined_source', 'source', at(HOUR))).toBe(1);
        expect(await db.getTransfer(ID)).toMatchObject({ status: 'declined', endReason: 'declined_source', endActor: 'source', endedAt: iso(HOUR), rev: 1, source: { state: 'declined' } });
        expect(await db.declineSlot(ID, 'destination', 'declined_destination', 'destination', at(2 * HOUR))).toBe(0);
        expect(await db.consentSlot(ID, teacher(['source']), at(2 * HOUR))).toBe(0);
        expect(await db.openTransferOf(LEARNER)).toBeNull();
      });

      it('declineSlot marks the slot that declined: learner and destination', async () => {
        await db.createTransfer(sourceRow(), created);
        expect(await db.declineSlot(ID, 'learner', 'withdrawn_learner', 'family', at(HOUR))).toBe(1);
        expect(await db.getTransfer(ID)).toMatchObject({ status: 'declined', endReason: 'withdrawn_learner', learner: { state: 'declined' }, source: { state: 'consented' } });
        await db.createTransfer(learnerSideRow({ id: 'transfer:0002' }), created);
        await db.consentSlot('transfer:0002', teacher(['source']), at(HOUR));
        await db.consentSlot('transfer:0002', teacher(['destination'], 'teacher-b'), at(HOUR));
        await db.promoteTransfer('transfer:0002', at(HOUR));
        expect(await db.declineSlot('transfer:0002', 'destination', 'declined_destination', 'destination', at(2 * HOUR))).toBe(1);
        expect(await db.getTransfer('transfer:0002')).toMatchObject({ status: 'declined', destination: { state: 'declined' }, learner: { state: 'consented' } });
      });

      it('declineSlot refuses a slot name it does not know, on both backends alike', async () => {
        await db.createTransfer(learnerSideRow(), created);
        await expect(db.declineSlot(ID, 'toString' as never, 'declined_source', 'source', at(HOUR))).rejects.toThrow(/slot/);
        await expect(db.declineSlot(ID, 'teacher' as never, 'declined_source', 'source', at(HOUR))).rejects.toThrow(/slot/);
        expect((await db.getTransfer(ID))?.status).toBe('requested');
      });

      it('cancelTransfer ends a requested or approved request once', async () => {
        await approvedRequest(db);
        expect(await db.cancelTransfer(ID, 'cancelled_initiator', 'family', at(2 * HOUR))).toBe(1);
        expect(await db.getTransfer(ID)).toMatchObject({ status: 'cancelled', endReason: 'cancelled_initiator', endActor: 'family', endedAt: iso(2 * HOUR) });
        expect(await db.cancelTransfer(ID, 'destination_archived', 'system', at(3 * HOUR))).toBe(0);
        expect((await db.getTransfer(ID))?.endReason).toBe('cancelled_initiator');
      });

      it('declineSlot and cancelTransfer write the deciding event with the CAS, once; a lost race writes none', async () => {
        await db.createTransfer(learnerSideRow(), created);
        const declined = { at: iso(HOUR), actorKind: 'account' as const, actorRef: 'teacher-b', event: 'declined' as const, slot: 'destination' as const, detail: { reason: 'no_room', via: 'school_admin' } };
        expect(await db.declineSlot(ID, 'destination', 'declined_destination', 'destination', at(HOUR), declined)).toBe(1);
        // the same decision again in the same millisecond: the CAS loses and no second event appears
        expect(await db.declineSlot(ID, 'destination', 'declined_destination', 'destination', at(HOUR), { ...declined, actorRef: 'teacher-x' })).toBe(0);
        expect(await db.cancelTransfer(ID, 'withdrawn_learner', 'family', at(HOUR), { ...declined, event: 'cancelled', slot: 'learner', detail: null })).toBe(0);
        expect((await db.transferEvents(ID)).map((e) => [e.event, e.actorRef, e.slot, e.detail])).toEqual([
          ['created', 'mom', null, null],
          ['declined', 'teacher-b', 'destination', { reason: 'no_room', via: 'school_admin' }],
        ]);

        await db.createTransfer(sourceRow({ id: 'transfer:0002', createdAt: iso(2 * HOUR), updatedAt: iso(2 * HOUR) }), created);
        const cancelled = { at: iso(3 * HOUR), actorKind: 'account' as const, actorRef: 'teacher-a', event: 'cancelled' as const, slot: 'source' as const, detail: { via: 'owner' } };
        expect(await db.cancelTransfer('transfer:0002', 'cancelled_initiator', 'source', at(3 * HOUR), cancelled)).toBe(1);
        expect(await db.cancelTransfer('transfer:0002', 'cancelled_initiator', 'source', at(3 * HOUR), cancelled)).toBe(0);
        expect((await db.transferEvents('transfer:0002')).map((e) => e.event)).toEqual(['created', 'cancelled']);
        expect(await db.getTransfer('transfer:0002')).toMatchObject({ status: 'cancelled', endReason: 'cancelled_initiator', endActor: 'source' });
      });

      it('an event that cannot be written rolls the decline or cancel back (one transaction)', async () => {
        await db.createTransfer(learnerSideRow(), created);
        const bad = { at: iso(HOUR), actorKind: 'robot' as never, actorRef: 'teacher-b', event: 'declined' as const, slot: 'destination' as const, detail: null };
        await expect(db.declineSlot(ID, 'destination', 'declined_destination', 'destination', at(HOUR), bad)).rejects.toThrow(/CHECK/i);
        await expect(db.cancelTransfer(ID, 'withdrawn_learner', 'family', at(HOUR), { ...bad, event: 'cancelled' })).rejects.toThrow(/CHECK/i);
        expect(await db.getTransfer(ID)).toMatchObject({ status: 'requested', endReason: null, rev: 0 });
        expect((await db.transferEvents(ID)).map((e) => e.event)).toEqual(['created']);
      });

      it('expireTransfer acts only once expires_at has passed', async () => {
        await db.createTransfer(learnerSideRow(), created);
        expect(await db.expireTransfer(ID, at(TRANSFER_WINDOW_MS - 1))).toBe(0);
        expect(await db.expireTransfer(ID, at(TRANSFER_WINDOW_MS))).toBe(1);
        expect(await db.getTransfer(ID)).toMatchObject({ status: 'expired', endReason: 'expired', endActor: 'system', endedAt: iso(TRANSFER_WINDOW_MS) });
        expect(await db.expireTransfer(ID, at(TRANSFER_WINDOW_MS + DAY))).toBe(0);
      });

      it('expireTransfer writes the system expired event with the CAS, once; an early or repeated call writes none', async () => {
        await db.createTransfer(learnerSideRow(), created);
        const expired = { at: iso(TRANSFER_WINDOW_MS), actorKind: 'system' as const, actorRef: null, event: 'expired' as const, slot: null, detail: null };
        expect(await db.expireTransfer(ID, at(TRANSFER_WINDOW_MS - 1), { ...expired, at: iso(TRANSFER_WINDOW_MS - 1) })).toBe(0);
        expect(await db.expireTransfer(ID, at(TRANSFER_WINDOW_MS), expired)).toBe(1);
        expect(await db.expireTransfer(ID, at(TRANSFER_WINDOW_MS), expired)).toBe(0);
        expect((await db.transferEvents(ID)).map((e) => [e.event, e.actorKind, e.actorRef, e.slot, e.detail])).toEqual([
          ['created', 'account', 'mom', null, null],
          ['expired', 'system', null, null, null],
        ]);
        const bad = { ...expired, actorKind: 'robot' as never };
        expect(await db.createTransfer(sourceRow({ id: 'transfer:0002' }), created)).toBe('created');
        await expect(db.expireTransfer('transfer:0002', at(TRANSFER_WINDOW_MS), bad)).rejects.toThrow(/CHECK/i);
        expect(await db.getTransfer('transfer:0002')).toMatchObject({ status: 'requested', rev: 0 });
      });
    });

    describe('settle steps', () => {
      it('markSourceNotRequired turns only a pending source slot into not_required', async () => {
        await db.createTransfer(learnerSideRow(), created);
        expect(await db.markSourceNotRequired(ID, at(HOUR))).toBe(1);
        expect(await db.getTransfer(ID)).toMatchObject({ source: { state: 'not_required', accountId: null }, rev: 1 });
        expect(await db.markSourceNotRequired(ID, at(HOUR))).toBe(0);
      });

      it('markSourceNotRequired leaves a consented source alone', async () => {
        await db.createTransfer(sourceRow(), created);
        expect(await db.markSourceNotRequired(ID, at(HOUR))).toBe(0);
        expect((await db.getTransfer(ID))?.source.state).toBe('consented');
      });

      it('promoteTransfer needs every slot in; a not_required source counts', async () => {
        await db.createTransfer(learnerSideRow(), created);
        expect(await db.promoteTransfer(ID, at(HOUR))).toBe(0);
        await db.consentSlot(ID, teacher(['destination'], 'teacher-b'), at(HOUR));
        expect(await db.promoteTransfer(ID, at(HOUR))).toBe(0);
        await db.markSourceNotRequired(ID, at(HOUR));
        expect(await db.promoteTransfer(ID, at(2 * HOUR))).toBe(1);
        expect(await db.getTransfer(ID)).toMatchObject({ status: 'approved', approvedAt: iso(2 * HOUR) });
        expect(await db.promoteTransfer(ID, at(3 * HOUR))).toBe(0);
        expect((await db.getTransfer(ID))?.approvedAt).toBe(iso(2 * HOUR));
      });

      it('blockTransfer records the reason on an approved request only', async () => {
        await db.createTransfer(learnerSideRow(), created);
        expect(await db.blockTransfer(ID, 'cap_class', at(HOUR))).toBe(0);
        await db.consentSlot(ID, teacher(['source', 'destination']), at(HOUR));
        await db.promoteTransfer(ID, at(HOUR));
        expect(await db.blockTransfer(ID, 'cap_class', at(2 * HOUR))).toBe(1);
        expect(await db.getTransfer(ID)).toMatchObject({ status: 'approved', blockReason: 'cap_class', updatedAt: iso(2 * HOUR) });
        expect(await db.blockTransfer(ID, 'cap_learner', at(3 * HOUR))).toBe(1);
        expect((await db.getTransfer(ID))?.blockReason).toBe('cap_learner');
      });

      it('blockTransfer changes nothing when the reason is already recorded (one blocked event per reason, even across racing settles)', async () => {
        await approvedRequest(db);
        expect(await db.blockTransfer(ID, 'cap_class', at(2 * HOUR))).toBe(1);
        const once = await db.getTransfer(ID);
        expect(await db.blockTransfer(ID, 'cap_class', at(3 * HOUR))).toBe(0);
        expect(await db.getTransfer(ID)).toEqual(once);
        expect(await db.blockTransfer(ID, 'cap_school', at(3 * HOUR))).toBe(1);
      });

      it('resetLearnerConsent with an expected rev resets only the row version it was decided on', async () => {
        await approvedRequest(db);
        const seen = await db.getTransfer(ID);
        await db.blockTransfer(ID, 'cap_class', at(2 * HOUR));
        expect(await db.resetLearnerConsent(ID, 'terms_changed', at(3 * HOUR), seen?.rev)).toBe(0);
        expect((await db.getTransfer(ID))?.learner.state).toBe('consented');
        expect((await db.transferEvents(ID)).filter((e) => e.event === 'consent_reset')).toEqual([]);
        const now = await db.getTransfer(ID);
        expect(await db.resetLearnerConsent(ID, 'terms_changed', at(3 * HOUR), now?.rev)).toBe(1);
        expect((await db.getTransfer(ID))?.learner.state).toBe('pending');
      });

      it('consentSlot stores only the record fields: a wider runtime object cannot override state or at', async () => {
        await db.createTransfer(sourceRow(), created);
        const wider = { ...consentRecord(), state: 'pending', at: 'not-a-time', extra: 'dropped' } as unknown as LearnerConsentRecord;
        expect(await db.consentSlot(ID, { kind: 'learner', record: wider }, at(HOUR))).toBe(1);
        expect((await db.getTransfer(ID))?.learner).toEqual({ state: 'consented', at: iso(HOUR), ...consentRecord() });
      });

      it('resetLearnerConsent sends an approved request back to requested, clears the record and logs consent_reset once', async () => {
        await approvedRequest(db);
        await db.blockTransfer(ID, 'cap_class', at(2 * HOUR));
        expect(await db.resetLearnerConsent(ID, 'terms_changed', at(3 * HOUR))).toBe(1);
        const read = await db.getTransfer(ID);
        expect(read).toMatchObject({ status: 'requested', approvedAt: null, executeAfter: null, blockReason: null, updatedAt: iso(3 * HOUR) });
        expect(read?.learner).toEqual({ state: 'pending', at: null, basis: null, attest: null, evidence: null, role: null, textVersion: null, locale: null, shown: null, terms: null });
        expect(read?.source.state).toBe('consented');
        expect(read?.destination.state).toBe('consented');
        expect(await db.resetLearnerConsent(ID, 'lapsed', at(4 * HOUR))).toBe(0);
        const resets = (await db.transferEvents(ID)).filter((e) => e.event === 'consent_reset');
        expect(resets).toEqual([{ id: expect.any(Number), transferId: ID, at: iso(3 * HOUR), actorKind: 'system', actorRef: null, event: 'consent_reset', slot: 'learner', detail: { why: 'terms_changed' } }]);
        // the guardian confirms again
        expect(await db.consentSlot(ID, { kind: 'learner', record: consentRecord() }, at(5 * HOUR))).toBe(1);
        expect(await db.promoteTransfer(ID, at(5 * HOUR))).toBe(1);
      });
    });

    describe('executeTransfer (section 4.6 gate)', () => {
      const due = at(HOUR + TRANSFER_COOLING_OFF_MS);

      it('moves the learner: destination joined now as student, source gone, row executed, executed event; nothing else touched', async () => {
        await approvedRequest(db);
        await db.blockTransfer(ID, 'cap_class', at(2 * HOUR));
        await db.addMembership({ spaceId: 'space:class-c', memberKind: 'learner', memberId: LEARNER, role: 'student', joinedAt: T0 });
        await db.putSnapshot({ learnerId: LEARNER, rev: 1, schemaVer: 1, contentVer: '2026.10', deviceId: 'device-a', summary: { stars: 9 }, payload: { cards: ['a'] }, updatedAt: T0 }, 0);
        expect(await db.executeTransfer(executeInput(due))).toEqual({ executed: true, devicesRevoked: 0, relinksClosed: 0 });
        expect(await db.membership(DEST, 'learner', LEARNER)).toEqual({ spaceId: DEST, memberKind: 'learner', memberId: LEARNER, role: 'student', joinedAt: due.toISOString() });
        expect(await db.membership(SOURCE, 'learner', LEARNER)).toBeNull();
        expect(await db.membership(FAMILY, 'learner', LEARNER)).not.toBeNull();
        expect(await db.membership('space:class-c', 'learner', LEARNER)).not.toBeNull();
        expect((await db.getSnapshot(LEARNER))?.summary).toEqual({ stars: 9 });
        const read = await db.getTransfer(ID);
        expect(read).toMatchObject({ status: 'executed', executedAt: due.toISOString(), blockReason: null, updatedAt: due.toISOString() });
        expect((await db.transferEvents(ID)).filter((e) => e.event === 'executed')).toEqual([{ id: expect.any(Number), transferId: ID, at: due.toISOString(), actorKind: 'system', actorRef: null, event: 'executed', slot: null, detail: null }]);
        expect(await db.openTransferOf(LEARNER)).toBeNull();
      });

      it('does nothing before the cooling-off has passed', async () => {
        await approvedRequest(db);
        expect((await db.executeTransfer(executeInput(at(TRANSFER_COOLING_OFF_MS - 1)))).executed).toBe(false);
        expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
        expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
        expect((await db.getTransfer(ID))?.status).toBe('approved');
      });

      it('a cancel that landed before the batch wins: both memberships untouched', async () => {
        await approvedRequest(db);
        await db.cancelTransfer(ID, 'cancelled_initiator', 'family', at(2 * HOUR));
        expect(await db.executeTransfer(executeInput(due))).toEqual({ executed: false, devicesRevoked: 0, relinksClosed: 0 });
        expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
        expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
        expect((await db.getTransfer(ID))?.status).toBe('cancelled');
        expect((await db.transferEvents(ID)).map((e) => e.event)).toEqual(['created']);
      });

      it('a full destination changes nothing and the source membership stays (never in no class)', async () => {
        await approvedRequest(db);
        await fillClass(db, DEST, 2);
        expect((await db.executeTransfer(executeInput(due, { destCap: 2 }))).executed).toBe(false);
        expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
        expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
        expect((await db.getTransfer(ID))?.status).toBe('approved');
        // a seat frees up: the retry moves
        await db.removeMembership(DEST, 'learner', 'profile:class-b-0');
        expect((await db.executeTransfer(executeInput(due, { destCap: 2 }))).executed).toBe(true);
      });

      it('an unlimited destination cap (a Pro class, Number.POSITIVE_INFINITY) never blocks the move', async () => {
        await approvedRequest(db);
        await fillClass(db, DEST, 3);
        expect((await db.executeTransfer(executeInput(due, { destCap: Number.POSITIVE_INFINITY }))).executed).toBe(true);
        expect(await db.membership(DEST, 'learner', LEARNER)).not.toBeNull();
      });

      it('an unlimited learner cap is compared as a finite number on both backends', async () => {
        await approvedRequest(db);
        expect((await db.executeTransfer(executeInput(due, { learnerCap: Number.POSITIVE_INFINITY }))).executed).toBe(true);
        expect(await db.membership(DEST, 'learner', LEARNER)).not.toBeNull();
      });

      it('moves only from a class into a class: a family destination or a source equal to the destination changes nothing', async () => {
        // the learner is already in the family, so without the kind check the gate would pass and drop the class
        await approvedRequest(db, at(HOUR), { destSpaceId: FAMILY });
        expect((await db.executeTransfer({ ...executeInput(due), destSpaceId: FAMILY })).executed).toBe(false);
        expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
        expect((await db.getTransfer(ID))?.status).toBe('approved');
        await db.cancelTransfer(ID, 'cancelled_initiator', 'family', at(2 * HOUR));
        await approvedRequest(db, at(2 * HOUR), { id: 'transfer:0002', sourceSpaceId: FAMILY });
        expect((await db.executeTransfer({ ...executeInput(at(2 * HOUR + TRANSFER_COOLING_OFF_MS)), id: 'transfer:0002', sourceSpaceId: FAMILY })).executed).toBe(false);
        expect(await db.membership(FAMILY, 'learner', LEARNER)).not.toBeNull();
        expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
        await db.cancelTransfer('transfer:0002', 'cancelled_initiator', 'family', at(2 * HOUR));
        await approvedRequest(db, at(3 * HOUR), { id: 'transfer:0003' });
        expect((await db.executeTransfer({ ...executeInput(at(3 * HOUR + TRANSFER_COOLING_OFF_MS)), id: 'transfer:0003', destSpaceId: SOURCE })).executed).toBe(false);
        expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
      });

      it('counts the learner classes as current minus source; archived classes do not count', async () => {
        await approvedRequest(db);
        for (const id of ['space:class-c', 'space:class-d', 'space:class-e']) await db.addMembership({ spaceId: id, memberKind: 'learner', memberId: LEARNER, role: 'student', joinedAt: T0 });
        // A + C + D + E: three other live classes, the cap is 3
        expect((await db.executeTransfer(executeInput(due))).executed).toBe(false);
        const e = await db.getSpace('space:class-e');
        if (e) await db.putSpace({ ...e, archivedAt: T0 });
        expect((await db.executeTransfer(executeInput(due))).executed).toBe(true);
        expect(await db.membership('space:class-c', 'learner', LEARNER)).not.toBeNull();
      });

      it('a second execute is a no-op', async () => {
        await approvedRequest(db);
        expect((await db.executeTransfer(executeInput(due))).executed).toBe(true);
        await db.addMembership({ spaceId: SOURCE, memberKind: 'learner', memberId: LEARNER, role: 'student', joinedAt: T0 }); // rejoined by code
        expect((await db.executeTransfer(executeInput(at(HOUR + TRANSFER_COOLING_OFF_MS + 1)))).executed).toBe(false);
        expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
        expect((await db.membership(DEST, 'learner', LEARNER))?.joinedAt).toBe(due.toISOString());
        expect((await db.transferEvents(ID)).filter((ev) => ev.event === 'executed')).toHaveLength(1);
      });

      it('the gate requires the learner row itself: a learner row gone while the request and memberships stay moves nothing', async () => {
        await approvedRequest(db);
        await dropLearnerRowOnly(db, LEARNER);
        expect(await db.getTransfer(ID)).not.toBeNull(); // the request survived, so only the learner check can refuse
        expect((await db.executeTransfer(executeInput(due))).executed).toBe(false);
        expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
        expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
        expect((await db.getTransfer(ID))?.status).toBe('approved');
        expect((await db.transferEvents(ID)).filter((ev) => ev.event === 'executed')).toEqual([]);
      });

      it('a learner erased mid-way leaves no destination membership', async () => {
        await approvedRequest(db);
        await db.deleteLearner(LEARNER);
        expect((await db.executeTransfer(executeInput(due))).executed).toBe(false);
        expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
        expect(await db.membersOf(DEST)).toHaveLength(1); // the teacher only
      });

      it('a learner already in a full destination: only the source is removed, the destination row is kept as it was', async () => {
        await approvedRequest(db);
        await fillClass(db, DEST, 2);
        await db.addMembership({ spaceId: DEST, memberKind: 'learner', memberId: LEARNER, role: 'student', joinedAt: iso(2 * HOUR) });
        expect((await db.executeTransfer(executeInput(due, { destCap: 2 }))).executed).toBe(true);
        expect((await db.membership(DEST, 'learner', LEARNER))?.joinedAt).toBe(iso(2 * HOUR));
        expect(await db.membership(SOURCE, 'learner', LEARNER)).toBeNull();
        expect((await db.membersOf(DEST)).filter((m) => m.memberKind === 'learner')).toHaveLength(3);
      });

      it('refuses when the destination was archived, the learner left the source, the request expired, or the input does not match the row', async () => {
        await approvedRequest(db);
        expect((await db.executeTransfer(executeInput(due, { learnerId: 'profile:other' }))).executed).toBe(false);
        expect((await db.executeTransfer(executeInput(at(TRANSFER_WINDOW_MS)))).executed).toBe(false);
        expect((await db.executeTransfer({ ...executeInput(due), destSpaceId: 'space:class-c' })).executed).toBe(false);
        await db.removeMembership(SOURCE, 'learner', LEARNER);
        expect((await db.executeTransfer(executeInput(due))).executed).toBe(false);
        await db.addMembership({ spaceId: SOURCE, memberKind: 'learner', memberId: LEARNER, role: 'student', joinedAt: T0 });
        const dest = await db.getSpace(DEST);
        if (dest) await db.putSpace({ ...dest, archivedAt: T0 });
        expect((await db.executeTransfer(executeInput(due))).executed).toBe(false);
        expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
        expect((await db.getTransfer(ID))?.status).toBe('approved');
        if (dest) await db.putSpace({ ...dest, archivedAt: null });
        expect((await db.executeTransfer(executeInput(due))).executed).toBe(true);
      });

      it('revokes class devices bound through the source re-link and closes its pending re-links; keeps every other binding', async () => {
        await approvedRequest(db);
        await db.addMembership({ spaceId: 'space:class-c', memberKind: 'learner', memberId: LEARNER, role: 'student', joinedAt: T0 });
        const relink = (id: string, spaceId: string, deviceId: string, status: 'pending' | 'approved' | 'denied') => ({ id, spaceId, learnerId: LEARNER, deviceId, platform: null, requestedAt: T0, expiresAt: iso(HOUR), status, decidedAt: status === 'pending' ? null : T0, secret: null });
        const device = (deviceId: string, scope: 'full' | 'class') => ({ learnerId: LEARNER, deviceId, secretHash: 'h', scope, createdAt: T0, lastSeenAt: T0 });
        await db.putRelink(relink('relink:a-approved', SOURCE, 'tablet-a', 'approved'));
        await db.putDevice(device('tablet-a', 'class')); // only through A: revoked
        await db.putRelink(relink('relink:a-shared', SOURCE, 'tablet-shared', 'approved'));
        await db.putRelink(relink('relink:c-shared', 'space:class-c', 'tablet-shared', 'approved'));
        await db.putDevice(device('tablet-shared', 'class')); // also approved through class C, still a member: kept
        await db.putRelink(relink('relink:a-full', SOURCE, 'phone', 'approved'));
        await db.putDevice(device('phone', 'full')); // full scope: never touched
        await db.putRelink(relink('relink:a-pending', SOURCE, 'tablet-new', 'pending'));
        await db.putRelink(relink('relink:c-pending', 'space:class-c', 'tablet-c', 'pending'));
        expect(await db.executeTransfer(executeInput(due))).toEqual({ executed: true, devicesRevoked: 1, relinksClosed: 1 });
        expect(await db.getDevice(LEARNER, 'tablet-a')).toBeNull();
        expect(await db.getDevice(LEARNER, 'tablet-shared')).not.toBeNull();
        expect(await db.getDevice(LEARNER, 'phone')).not.toBeNull();
        expect(await db.getRelink('relink:a-pending')).toMatchObject({ status: 'denied', decidedAt: due.toISOString() });
        expect((await db.getRelink('relink:c-pending'))?.status).toBe('pending');
        expect((await db.getRelink('relink:a-approved'))?.status).toBe('approved');
      });

      it('does not revoke a device when the move does not happen', async () => {
        await approvedRequest(db);
        await db.putRelink({ id: 'relink:a', spaceId: SOURCE, learnerId: LEARNER, deviceId: 'tablet-a', platform: null, requestedAt: T0, expiresAt: iso(HOUR), status: 'approved', decidedAt: T0, secret: null });
        await db.putDevice({ learnerId: LEARNER, deviceId: 'tablet-a', secretHash: 'h', scope: 'class', createdAt: T0, lastSeenAt: T0 });
        await db.putRelink({ id: 'relink:p', spaceId: SOURCE, learnerId: LEARNER, deviceId: 'tablet-p', platform: null, requestedAt: T0, expiresAt: iso(HOUR), status: 'pending', decidedAt: null, secret: null });
        await fillClass(db, DEST, 1);
        expect(await db.executeTransfer(executeInput(due, { destCap: 1 }))).toEqual({ executed: false, devicesRevoked: 0, relinksClosed: 0 });
        expect(await db.getDevice(LEARNER, 'tablet-a')).not.toBeNull();
        expect((await db.getRelink('relink:p'))?.status).toBe('pending');
      });
    });

    describe('reads', () => {
      async function three(): Promise<void> {
        await db.putLearner(learner('profile:two'));
        await db.putLearner(learner('profile:three'));
        await db.createTransfer(learnerSideRow({ createdAt: iso(1) }), created);
        await db.createTransfer(learnerSideRow({ id: 'transfer:0002', learnerId: 'profile:two', createdAt: iso(2), initiatorAccountId: 'dad' }), created);
        await db.createTransfer(sourceRow({ id: 'transfer:0003', learnerId: 'profile:three', destSpaceId: 'space:class-c', createdAt: iso(3) }), created);
      }

      it('transfersOfSpace lists by role, newest first, up to the limit', async () => {
        await three();
        expect((await db.transfersOfSpace(SOURCE, 'source', 10)).map((t) => t.id)).toEqual(['transfer:0003', 'transfer:0002', 'transfer:0001']);
        expect((await db.transfersOfSpace(SOURCE, 'source', 2)).map((t) => t.id)).toEqual(['transfer:0003', 'transfer:0002']);
        expect((await db.transfersOfSpace(DEST, 'destination', 10)).map((t) => t.id)).toEqual(['transfer:0002', 'transfer:0001']);
        expect(await db.transfersOfSpace(DEST, 'source', 10)).toEqual([]);
      });

      it('transfersOfLearner and openTransferOf', async () => {
        await db.createTransfer(learnerSideRow({ createdAt: iso(1) }), created);
        await db.cancelTransfer(ID, 'cancelled_initiator', 'family', at(HOUR));
        await db.createTransfer(sourceRow({ id: 'transfer:0002', createdAt: iso(2 * HOUR) }), created);
        expect((await db.transfersOfLearner(LEARNER)).map((t) => t.id)).toEqual(['transfer:0002', 'transfer:0001']);
        expect((await db.openTransferOf(LEARNER))?.id).toBe('transfer:0002');
        expect(await db.transfersOfLearner('profile:nobody')).toEqual([]);
        expect(await db.openTransferOf('profile:nobody')).toBeNull();
      });

      it('lastLearnerRefusal finds a learner-side decline or withdrawal since the given time', async () => {
        await db.createTransfer(sourceRow(), created);
        await db.declineSlot(ID, 'learner', 'withdrawn_learner', 'family', at(DAY));
        await db.createTransfer(sourceRow({ id: 'transfer:0002' }), created);
        await db.declineSlot('transfer:0002', 'learner', 'declined_learner', 'device', at(2 * DAY));
        await db.createTransfer(sourceRow({ id: 'transfer:0003' }), created);
        await db.declineSlot('transfer:0003', 'destination', 'declined_destination', 'destination', at(3 * DAY));
        await db.createTransfer(sourceRow({ id: 'transfer:0004' }), created);
        await db.cancelTransfer('transfer:0004', 'cancelled_initiator', 'source', at(4 * DAY));
        expect((await db.lastLearnerRefusal(LEARNER, at(0)))?.id).toBe('transfer:0002');
        expect((await db.lastLearnerRefusal(LEARNER, at(2 * DAY)))?.id).toBe('transfer:0002');
        expect(await db.lastLearnerRefusal(LEARNER, at(2 * DAY + 1))).toBeNull();
        expect(await db.lastLearnerRefusal('profile:nobody', at(0))).toBeNull();
      });

      it('lastLearnerRefusal counts only refusals of a source-started request, not the learner side ending its own', async () => {
        // the learner side withdraws, and a device vetoes, a request the learner side started: no refusal of a teacher
        await db.createTransfer(learnerSideRow(), created);
        await db.cancelTransfer(ID, 'withdrawn_learner', 'family', at(DAY));
        await db.createTransfer(learnerSideRow({ id: 'transfer:0002' }), created);
        await db.declineSlot('transfer:0002', 'learner', 'declined_learner', 'device', at(2 * DAY));
        expect(await db.lastLearnerRefusal(LEARNER, at(0))).toBeNull();
        // a real refusal of a teacher's request stays visible behind a newer self-withdrawal
        await db.createTransfer(sourceRow({ id: 'transfer:0003' }), created);
        await db.cancelTransfer('transfer:0003', 'withdrawn_learner', 'family', at(3 * DAY));
        await db.createTransfer(learnerSideRow({ id: 'transfer:0004' }), created);
        await db.cancelTransfer('transfer:0004', 'withdrawn_learner', 'family', at(4 * DAY));
        expect((await db.lastLearnerRefusal(LEARNER, at(0)))?.id).toBe('transfer:0003');
      });

      it('lastCooldownDecline finds the latest decline, by another side, of a learner-side request to this destination since a time', async () => {
        // the destination says "not now" to the family's request
        await db.createTransfer(learnerSideRow(), created);
        await db.declineSlot(ID, 'destination', 'declined_destination', 'destination', at(DAY));
        // newer rows that are not a cooldown decline must not hide it
        await db.createTransfer(sourceRow({ id: 'transfer:0002' }), created);
        await db.cancelTransfer('transfer:0002', 'cancelled_initiator', 'source', at(2 * DAY));
        await db.createTransfer(learnerSideRow({ id: 'transfer:0003' }), created);
        await db.expireTransfer('transfer:0003', at(TRANSFER_WINDOW_MS));
        await db.createTransfer(learnerSideRow({ id: 'transfer:0004' }), created);
        await db.cancelTransfer('transfer:0004', 'withdrawn_learner', 'family', at(TRANSFER_WINDOW_MS + DAY));
        await db.createTransfer(sourceRow({ id: 'transfer:0005' }), created);
        await db.declineSlot('transfer:0005', 'source', 'declined_source', 'source', at(TRANSFER_WINDOW_MS + 2 * DAY)); // a teacher-started request
        await db.createTransfer(learnerSideRow({ id: 'transfer:0006', destSpaceId: 'space:class-c' }), created);
        await db.declineSlot('transfer:0006', 'destination', 'declined_destination', 'destination', at(TRANSFER_WINDOW_MS + 3 * DAY)); // another destination
        await db.createTransfer(learnerSideRow({ id: 'transfer:0007' }), created); // open: not ended
        expect((await db.lastCooldownDecline(LEARNER, DEST, at(0)))?.id).toBe(ID);
        expect((await db.lastCooldownDecline(LEARNER, DEST, at(DAY)))?.id).toBe(ID); // inclusive
        expect(await db.lastCooldownDecline(LEARNER, DEST, at(DAY + 1))).toBeNull();
        expect((await db.lastCooldownDecline(LEARNER, 'space:class-c', at(0)))?.id).toBe('transfer:0006');
        expect(await db.lastCooldownDecline(LEARNER, 'space:class-d', at(0))).toBeNull();
        expect(await db.lastCooldownDecline('profile:other', DEST, at(0))).toBeNull();
        // a newer decline by the source class is the latest
        await db.cancelTransfer('transfer:0007', 'withdrawn_learner', 'family', at(TRANSFER_WINDOW_MS + 4 * DAY));
        await db.createTransfer(learnerSideRow({ id: 'transfer:0008' }), created);
        await db.declineSlot('transfer:0008', 'source', 'declined_source', 'source', at(TRANSFER_WINDOW_MS + 5 * DAY));
        expect((await db.lastCooldownDecline(LEARNER, DEST, at(0)))?.id).toBe('transfer:0008');
      });

      it('counts creates per account and per learner since a time, and open requests per destination', async () => {
        await three();
        expect(await db.countTransfersCreatedBy('mom', at(0))).toBe(1);
        expect(await db.countTransfersCreatedBy('mom', at(2))).toBe(0);
        expect(await db.countTransfersCreatedBy('teacher-a', at(3))).toBe(1);
        expect(await db.countTransfersCreatedForLearner(LEARNER, at(1))).toBe(1);
        expect(await db.countTransfersCreatedForLearner(LEARNER, at(2))).toBe(0);
        expect(await db.countOpenTransfersTo(DEST)).toBe(2);
        await db.cancelTransfer('transfer:0002', 'cancelled_initiator', 'family', at(HOUR));
        expect(await db.countOpenTransfersTo(DEST)).toBe(1);
        expect(await db.countOpenTransfersTo('space:class-d')).toBe(0);
      });

      it('countOpenTransfersTo with a time counts only open requests that have not passed expires_at (an unsettled expired row is not waiting)', async () => {
        await db.putLearner(learner('profile:two'));
        await db.createTransfer(learnerSideRow(), created);
        await db.createTransfer(sourceRow({ id: 'transfer:0002', learnerId: 'profile:two', expiresAt: iso(TRANSFER_WINDOW_MS + HOUR) }), created);
        expect(await db.countOpenTransfersTo(DEST, at(TRANSFER_WINDOW_MS - 1))).toBe(2);
        expect(await db.countOpenTransfersTo(DEST, at(TRANSFER_WINDOW_MS))).toBe(1);
        expect(await db.countOpenTransfersTo(DEST, at(TRANSFER_WINDOW_MS + HOUR))).toBe(0);
        expect(await db.countOpenTransfersTo(DEST)).toBe(2);
      });

      it('openTransfersOfSpaces reads every open request of a set of spaces by role, newest first, with no window', async () => {
        await three();
        await db.cancelTransfer('transfer:0002', 'cancelled_initiator', 'family', at(HOUR));
        expect((await db.openTransfersOfSpaces([SOURCE], 'source')).map((t) => t.id)).toEqual(['transfer:0003', 'transfer:0001']);
        expect((await db.openTransfersOfSpaces([DEST, 'space:class-c'], 'destination')).map((t) => t.id)).toEqual(['transfer:0003', 'transfer:0001']);
        expect((await db.openTransfersOfSpaces(['space:class-c'], 'destination')).map((t) => t.id)).toEqual(['transfer:0003']);
        expect(await db.openTransfersOfSpaces([DEST], 'source')).toEqual([]);
        expect(await db.openTransfersOfSpaces([], 'source')).toEqual([]);
      });

      it('transferEvents lists oldest first; addTransferEvent keeps codes and counts', async () => {
        await db.createTransfer(learnerSideRow(), created);
        await db.addTransferEvent({ transferId: ID, at: iso(HOUR), actorKind: 'account', actorRef: 'teacher-a', event: 'consented', slot: 'source', detail: { via: 'owner' } });
        await db.addTransferEvent({ transferId: ID, at: iso(2 * HOUR), actorKind: 'system', actorRef: null, event: 'devices_revoked', slot: null, detail: { count: 2, partial: false } });
        const events = await db.transferEvents(ID);
        expect(events.map((e) => [e.event, e.slot, e.detail])).toEqual([
          ['created', null, null],
          ['consented', 'source', { via: 'owner' }],
          ['devices_revoked', null, { count: 2, partial: false }],
        ]);
        expect(events[0]?.id).toBeLessThan(events[1]?.id ?? 0);
        expect(await db.transferEvents('transfer:nope')).toEqual([]);
      });

      it('getLearners and getSpaces read a set of ids at once, skipping unknown ones', async () => {
        expect(await db.getLearners([])).toEqual([]);
        expect(await db.getSpaces([])).toEqual([]);
        expect((await db.getLearners([LEARNER, 'profile:nobody'])).map((l) => l.id)).toEqual([LEARNER]);
        expect((await db.getSpaces([SOURCE, DEST, 'space:nope', SOURCE])).map((s) => s.id).sort()).toEqual([SOURCE, DEST]);
        const many = Array.from({ length: 150 }, (_, i) => `profile:many-${i}`);
        for (const id of many) await db.putLearner(learner(id));
        expect((await db.getLearners(many)).map((l) => l.id).sort()).toEqual([...many].sort());
        expect((await db.getSpaces([FAMILY]))[0]).toEqual(await db.getSpace(FAMILY));
      });
    });

    describe('retention, counters and prefs', () => {
      it('purgeTransfers removes ended rows before the cutoff and executed rows whose learner left the destination, with their events', async () => {
        await db.putLearner(learner('profile:two'));
        await db.putLearner(learner('profile:three'));
        await db.addMembership({ spaceId: SOURCE, memberKind: 'learner', memberId: 'profile:two', role: 'student', joinedAt: T0 });
        await db.addMembership({ spaceId: SOURCE, memberKind: 'learner', memberId: 'profile:three', role: 'student', joinedAt: T0 });
        // 0001 declined at day 1 (old), 0002 cancelled at day 50 (recent)
        await db.createTransfer(learnerSideRow(), created);
        await db.declineSlot(ID, 'source', 'declined_source', 'source', at(DAY));
        await db.createTransfer(learnerSideRow({ id: 'transfer:0002' }), created);
        await db.cancelTransfer('transfer:0002', 'cancelled_initiator', 'family', at(50 * DAY));
        // 0003 executed for two, who then left the destination; 0004 executed for three, still there
        await approvedRequest(db, at(HOUR), { id: 'transfer:0003', learnerId: 'profile:two' });
        await approvedRequest(db, at(HOUR), { id: 'transfer:0004', learnerId: 'profile:three' });
        const due = at(HOUR + TRANSFER_COOLING_OFF_MS);
        expect((await db.executeTransfer(executeInput(due, { id: 'transfer:0003', learnerId: 'profile:two' }))).executed).toBe(true);
        expect((await db.executeTransfer(executeInput(due, { id: 'transfer:0004', learnerId: 'profile:three' }))).executed).toBe(true);
        await db.removeMembership(DEST, 'learner', 'profile:two');
        // 0005 still open
        await db.createTransfer(learnerSideRow({ id: 'transfer:0005' }), created);

        expect(await db.purgeTransfers(at(10 * DAY), at(10 * DAY), 50)).toBe(2);
        expect(await db.getTransfer(ID)).toBeNull();
        expect(await db.transferEvents(ID)).toEqual([]);
        expect(await db.getTransfer('transfer:0003')).toBeNull();
        expect(await db.transferEvents('transfer:0003')).toEqual([]);
        for (const kept of ['transfer:0002', 'transfer:0004', 'transfer:0005']) expect(await db.getTransfer(kept), kept).not.toBeNull();
        expect(await db.purgeTransfers(at(10 * DAY), at(10 * DAY), 50)).toBe(0);
      });

      it('purgeTransfers is bounded by the limit', async () => {
        for (let i = 1; i <= 3; i += 1) {
          await db.createTransfer(learnerSideRow({ id: `transfer:000${i}` }), created);
          await db.cancelTransfer(`transfer:000${i}`, 'cancelled_initiator', 'family', at(i * HOUR));
        }
        expect(await db.purgeTransfers(at(DAY), at(DAY), 2)).toBe(2);
        expect(await db.transfersOfLearner(LEARNER)).toHaveLength(1);
        expect(await db.purgeTransfers(at(DAY), at(DAY), 2)).toBe(1);
      });

      it('rate hits count per key since a time and purge in bounded steps', async () => {
        const key = transferRateKey.codeAccount('mom');
        await db.recordRateHit(key, at(0));
        await db.recordRateHit(key, at(HOUR));
        await db.recordRateHit(key, at(2 * HOUR));
        await db.recordRateHit(transferRateKey.codeLearner(LEARNER), at(2 * HOUR));
        expect(await db.countRateHits(key, at(0))).toBe(3);
        expect(await db.countRateHits(key, at(HOUR))).toBe(2);
        expect(await db.countRateHits(key, at(3 * HOUR))).toBe(0);
        expect(await db.countRateHits('tcode:acct:nobody', at(0))).toBe(0);
        expect(await db.purgeRateHits(at(2 * HOUR), 1)).toBe(1);
        expect(await db.purgeRateHits(at(2 * HOUR), 10)).toBe(1);
        expect(await db.purgeRateHits(at(2 * HOUR), 10)).toBe(0);
        expect(await db.countRateHits(key, at(0))).toBe(1);
        expect(await db.countRateHits(transferRateKey.codeLearner(LEARNER), at(0))).toBe(1);
      });

      it('prefs default to off; each switch is written alone', async () => {
        expect(await db.getTransferPrefs(LEARNER)).toEqual({ selfManaged: false, blockTeacherRequests: false, updatedAt: null });
        await db.setTransferPref(LEARNER, 'selfManaged', true, at(HOUR));
        expect(await db.getTransferPrefs(LEARNER)).toEqual({ selfManaged: true, blockTeacherRequests: false, updatedAt: iso(HOUR) });
        await db.setTransferPref(LEARNER, 'blockTeacherRequests', true, at(2 * HOUR));
        expect(await db.getTransferPrefs(LEARNER)).toEqual({ selfManaged: true, blockTeacherRequests: true, updatedAt: iso(2 * HOUR) });
        await db.setTransferPref(LEARNER, 'selfManaged', false, at(3 * HOUR));
        expect(await db.getTransferPrefs(LEARNER)).toEqual({ selfManaged: false, blockTeacherRequests: true, updatedAt: iso(3 * HOUR) });
      });

      it('setTransferPref refuses a switch name it does not know, on both backends alike', async () => {
        await expect(db.setTransferPref(LEARNER, 'toString' as never, true, at(HOUR))).rejects.toThrow(/switch/);
        await expect(db.setTransferPref(LEARNER, 'learner_id' as never, true, at(HOUR))).rejects.toThrow(/switch/);
        expect(await db.getTransferPrefs(LEARNER)).toEqual({ selfManaged: false, blockTeacherRequests: false, updatedAt: null });
      });
    });

    describe('erasure and reset', () => {
      it('deleteLearner removes their requests, events, prefs and learner counters; others stay', async () => {
        await db.putLearner(learner('profile:two'));
        await db.createTransfer(learnerSideRow(), created);
        await db.createTransfer(learnerSideRow({ id: 'transfer:0002', learnerId: 'profile:two' }), created);
        await db.setTransferPref(LEARNER, 'blockTeacherRequests', true, at(HOUR));
        await db.setTransferPref('profile:two', 'selfManaged', true, at(HOUR));
        await db.recordRateHit(transferRateKey.codeLearner(LEARNER), at(HOUR));
        await db.recordRateHit(transferRateKey.createLearner(LEARNER), at(HOUR));
        await db.recordRateHit(transferRateKey.codeLearner('profile:two'), at(HOUR));
        await db.recordRateHit(transferRateKey.codeAccount('mom'), at(HOUR));

        expect(await db.deleteLearner(LEARNER)).toBe(true);
        expect(await db.getTransfer(ID)).toBeNull();
        expect(await db.transferEvents(ID)).toEqual([]);
        expect(await db.transfersOfLearner(LEARNER)).toEqual([]);
        expect(await db.getTransferPrefs(LEARNER)).toEqual({ selfManaged: false, blockTeacherRequests: false, updatedAt: null });
        expect(await db.countRateHits(transferRateKey.codeLearner(LEARNER), at(0))).toBe(0);
        expect(await db.countRateHits(transferRateKey.createLearner(LEARNER), at(0))).toBe(0);

        expect(await db.getTransfer('transfer:0002')).not.toBeNull();
        expect(await db.transferEvents('transfer:0002')).toHaveLength(1);
        expect((await db.getTransferPrefs('profile:two')).selfManaged).toBe(true);
        expect(await db.countRateHits(transferRateKey.codeLearner('profile:two'), at(0))).toBe(1);
        expect(await db.countRateHits(transferRateKey.codeAccount('mom'), at(0))).toBe(1);
      });

      it('reset wipes the transfer tables', async () => {
        await db.createTransfer(learnerSideRow(), created);
        await db.setTransferPref(LEARNER, 'selfManaged', true, at(HOUR));
        await db.recordRateHit('tcode:acct:mom', at(HOUR));
        await db.reset();
        expect(await db.getTransfer(ID)).toBeNull();
        expect(await db.transferEvents(ID)).toEqual([]);
        expect(await db.countRateHits('tcode:acct:mom', at(0))).toBe(0);
        expect(await db.getTransferPrefs(LEARNER)).toEqual({ selfManaged: false, blockTeacherRequests: false, updatedAt: null });
      });
    });
  });
}

transferContract('memory', () => new MemoryDb(), async (db, learnerId) => {
  (db as unknown as { learners: Map<string, unknown> }).learners.delete(learnerId);
});
const sqlite = openSqliteD1();
transferContract('sqlite (real migrations)', () => new D1Db(sqlite), async (_db, learnerId) => {
  await sqlite.prepare('PRAGMA foreign_keys = OFF').run();
  await sqlite.prepare('DELETE FROM learners WHERE id = ?').bind(learnerId).run();
  await sqlite.prepare('PRAGMA foreign_keys = ON').run();
});
