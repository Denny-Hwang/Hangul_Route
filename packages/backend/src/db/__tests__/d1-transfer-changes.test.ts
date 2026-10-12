import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db, type D1Like, type D1PreparedLike, type D1RunResultLike } from '../d1';
import { at, created, executeInput, learnerSideRow, T0 } from './transfer-fixtures';

/** A D1 whose run() and batch() answer with whatever `answer` returns, recording the batch sizes. */
function d1Answering(answer: () => unknown): { d1: D1Like; batches: number[] } {
  const batches: number[] = [];
  const prepared: D1PreparedLike = {
    bind: () => prepared,
    first: async () => null,
    // every read of a list answers the four tables of migration 0005, so deleteLearner names them all
    all: async <T,>() => ({ results: ['transfer_events', 'transfer_requests', 'learner_transfer_prefs', 'rate_hits'].map((name) => ({ name })) as T[] }),
    run: async () => answer() as D1RunResultLike,
  };
  const d1: D1Like = {
    prepare: () => prepared,
    batch: async (statements) => {
      batches.push(statements.length);
      return statements.map(() => answer() as D1RunResultLike);
    },
  };
  return { d1, batches };
}

/**
 * The class-transfer writes of D1Db (F-SPACE-002 T-3b) read `meta.changes`
 * for every compare-and-set and every batch statement. A binding that does
 * not report it is an error, never "lost the race": guessing 0 would turn
 * every approve into a silent no-op.
 */
describe('D1Db transfer writes read meta.changes', () => {
  it('a CAS method answers the reported row count', async () => {
    expect(await new D1Db(d1Answering(() => ({ meta: { changes: 1 } })).d1).cancelTransfer('transfer:1', 'cancelled_initiator', 'family', at(0))).toBe(1);
    expect(await new D1Db(d1Answering(() => ({ meta: { changes: 0 } })).d1).promoteTransfer('transfer:1', at(0))).toBe(0);
  });

  it('a CAS method throws when the binding reports no count', async () => {
    await expect(new D1Db(d1Answering(() => ({})).d1).expireTransfer('transfer:1', at(0))).rejects.toThrow(/meta\.changes/);
    await expect(new D1Db(d1Answering(() => undefined).d1).markSourceNotRequired('transfer:1', at(0))).rejects.toThrow(/meta\.changes/);
  });

  it('createTransfer, resetLearnerConsent, executeTransfer and deleteLearner each run as one batch; a missing count throws', async () => {
    const counted = d1Answering(() => ({ meta: { changes: 1 } }));
    const db = new D1Db(counted.d1);
    expect(await db.createTransfer(learnerSideRow(), created)).toBe('created');
    expect(await db.resetLearnerConsent('transfer:1', 'lapsed', at(0))).toBe(1);
    expect(await db.executeTransfer(executeInput(at(0)))).toEqual({ executed: true, devicesRevoked: 1, relinksClosed: 1 });
    await db.deleteLearner('profile:suni');
    expect(await db.purgeTransfers(at(0), at(0), 50)).toBe(1);
    expect(counted.batches).toEqual([2, 3, 7, 9]);

    const silent = new D1Db(d1Answering(() => ({ meta: {} })).d1);
    await expect(silent.createTransfer(learnerSideRow(), created)).rejects.toThrow(/meta\.changes/);
    await expect(silent.resetLearnerConsent('transfer:1', 'lapsed', at(0))).rejects.toThrow(/meta\.changes/);
    await expect(silent.executeTransfer(executeInput(at(0)))).rejects.toThrow(/meta\.changes/);
    await expect(silent.purgeTransfers(at(0), at(0), 50)).rejects.toThrow(/meta\.changes/);
  });

  it('declineSlot and cancelTransfer with an event run the CAS and the event as one batch; without one, a single statement', async () => {
    const counted = d1Answering(() => ({ meta: { changes: 1 } }));
    const db = new D1Db(counted.d1);
    const event = { at: T0, actorKind: 'account' as const, actorRef: 'teacher-b', event: 'declined' as const, slot: 'destination' as const, detail: { reason: 'no_room' } };
    expect(await db.declineSlot('transfer:1', 'destination', 'declined_destination', 'destination', at(0), event)).toBe(1);
    expect(await db.cancelTransfer('transfer:1', 'withdrawn_learner', 'family', at(0), { ...event, event: 'cancelled', slot: 'learner', detail: null })).toBe(1);
    expect(await db.declineSlot('transfer:1', 'source', 'declined_source', 'source', at(0))).toBe(1);
    expect(counted.batches).toEqual([2, 2]);
    const silent = new D1Db(d1Answering(() => ({ meta: {} })).d1);
    await expect(silent.declineSlot('transfer:1', 'destination', 'declined_destination', 'destination', at(0), event)).rejects.toThrow(/meta\.changes/);
  });

  it('a row whose consent-time terms are incomplete reads with terms null, never empty strings', async () => {
    const d1 = openSqliteD1();
    await d1.prepare("INSERT INTO accounts (id, created_at) VALUES ('t', ?)").bind(T0).run();
    for (const id of ['space:a', 'space:b']) await d1.prepare("INSERT INTO spaces (id, kind, name, owner_account_id, created_at) VALUES (?, 'class', ?, 't', ?)").bind(id, id, T0).run();
    await d1.prepare("INSERT INTO learners (id, display_name, age_group, avatar, created_at, last_active_at) VALUES ('profile:a', 'A', '8-9', 'x', ?, ?)").bind(T0, T0).run();
    await d1
      .prepare("INSERT INTO transfer_requests (id, learner_id, source_space_id, dest_space_id, initiator, status, l_state, l_at, l_basis, l_text_version, l_locale, l_evidence, l_dest_name_hash, created_at, updated_at, expires_at) VALUES ('transfer:1', 'profile:a', 'space:a', 'space:b', 'learner_side', 'requested', 'consented', ?, 'caregiver', 'v', 'en', 'mom', 'abc', ?, ?, ?)")
      .bind(T0, T0, T0, T0)
      .run();
    const read = await new D1Db(d1).getTransfer('transfer:1');
    expect(read?.learner).toMatchObject({ state: 'consented', evidence: 'mom', terms: null, shown: null });
    d1.close();
  });

  it('a gate that changed nothing reports no move, whatever the guarded statements say', async () => {
    let call = 0;
    const db = new D1Db(d1Answering(() => ({ meta: { changes: call++ === 0 ? 0 : 1 } })).d1);
    expect(await db.executeTransfer(executeInput(at(0)))).toEqual({ executed: false, devicesRevoked: 0, relinksClosed: 0 });
  });
});
