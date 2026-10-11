import { describe, expect, it } from 'vitest';
import { D1Db, type D1Like, type D1PreparedLike, type D1RunResultLike } from '../d1';
import { at, created, executeInput, learnerSideRow } from './transfer-fixtures';

/** A D1 whose run() and batch() answer with whatever `answer` returns, recording the batch sizes. */
function d1Answering(answer: () => unknown): { d1: D1Like; batches: number[] } {
  const batches: number[] = [];
  const prepared: D1PreparedLike = {
    bind: () => prepared,
    first: async () => null,
    all: async () => ({ results: [] }),
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

  it('createTransfer, executeTransfer and purgeTransfers each run as one batch and throw on a missing count', async () => {
    const counted = d1Answering(() => ({ meta: { changes: 1 } }));
    const db = new D1Db(counted.d1);
    expect(await db.createTransfer(learnerSideRow(), created)).toBe('created');
    expect(await db.executeTransfer(executeInput(at(0)))).toEqual({ executed: true, devicesRevoked: 1, relinksClosed: 1 });
    expect(await db.purgeTransfers(at(0), at(0), 50)).toBe(1);
    expect(counted.batches).toEqual([2, 7, 2]);

    const silent = new D1Db(d1Answering(() => ({ meta: {} })).d1);
    await expect(silent.createTransfer(learnerSideRow(), created)).rejects.toThrow(/meta\.changes/);
    await expect(silent.executeTransfer(executeInput(at(0)))).rejects.toThrow(/meta\.changes/);
  });

  it('a gate that changed nothing reports no move, whatever the guarded statements say', async () => {
    let call = 0;
    const db = new D1Db(d1Answering(() => ({ meta: { changes: call++ === 0 ? 0 : 1 } })).d1);
    expect(await db.executeTransfer(executeInput(at(0)))).toEqual({ executed: false, devicesRevoked: 0, relinksClosed: 0 });
  });
});
