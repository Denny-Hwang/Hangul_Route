import { TRANSFER_COOLING_OFF_MS, TRANSFER_WINDOW_MS } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';
import type { TransferVia } from '../transfer-types';
import { approvedRequest, at, created, DEST, executeInput, HOUR, LEARNER, learnerSideRow, seedWorld, SOURCE } from './transfer-fixtures';

const ID = 'transfer:0001';

/**
 * A `Db` decorator for race tests (F-SPACE-002 section 4.7): before the
 * wrapped Db's `n`th method call it runs `competitor` against the inner Db to
 * completion, as another isolate answering between two of this handler's
 * awaits would.
 */
function interleave(inner: Db, n: number, competitor: (db: Db) => Promise<unknown>): { db: Db; fired: () => boolean } {
  let calls = 0;
  let fired = false;
  const db = new Proxy(inner, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        calls += 1;
        if (calls === n) {
          fired = true;
          await competitor(inner);
        }
        return (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
      };
    },
  });
  return { db, fired: () => fired };
}

/** How many Db calls a handler makes when nobody interferes. */
async function callsOf(make: () => Promise<Db>, handler: (db: Db) => Promise<unknown>): Promise<number> {
  const inner = await make();
  let calls = 0;
  const counting = new Proxy(inner, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls += 1;
        return (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
      };
    },
  });
  await handler(counting);
  return calls;
}

/*
 * The handlers below compose the Db calls the way the route layer (T-4b/T-5)
 * will: read, compare-and-set, re-read. They hold no row in memory across a
 * write, so the only arbiter is the CAS.
 */
type Outcome = 'ok' | 'lost' | 'not_open';

async function approve(db: Db, slot: 'source' | 'destination', accountId: string, now: Date, via: TransferVia = 'owner'): Promise<Outcome> {
  const row = await db.getTransfer(ID);
  if (!row || (row.status !== 'requested' && row.status !== 'approved')) return 'not_open';
  const changed = await db.consentSlot(ID, { kind: 'teacher', slots: [slot], accountId, via }, now);
  if (changed === 0) return 'lost';
  await db.promoteTransfer(ID, now);
  return 'ok';
}

async function decline(db: Db, now: Date): Promise<Outcome> {
  const row = await db.getTransfer(ID);
  if (!row || (row.status !== 'requested' && row.status !== 'approved')) return 'not_open';
  return (await db.declineSlot(ID, 'source', 'declined_source', 'source', now)) === 1 ? 'ok' : 'lost';
}

async function cancel(db: Db, now: Date): Promise<Outcome> {
  return (await db.cancelTransfer(ID, 'cancelled_initiator', 'family', now)) === 1 ? 'ok' : 'not_open';
}

/** settle's read, the capacity read, then the batch. */
async function execute(db: Db, now: Date): Promise<boolean> {
  const row = await db.getTransfer(ID);
  if (!row || row.status !== 'approved') return false;
  const seats = (await db.membersOf(DEST)).filter((m) => m.memberKind === 'learner').length;
  return (await db.executeTransfer({ ...executeInput(now), destCap: Math.max(20, seats + 1) })).executed;
}

function races(name: string, make: () => Db): void {
  describe(`transfer races · ${name}`, () => {
    let base: Db;
    const fresh = async (): Promise<Db> => {
      await base.reset();
      await seedWorld(base);
      return base;
    };
    beforeEach(() => {
      base = make();
    });

    /** Runs `handler` with `competitor` injected before each of its Db calls, then once after it. */
    async function everyInterleaving(setup: (db: Db) => Promise<void>, handler: (db: Db) => Promise<unknown>, competitor: (db: Db) => Promise<unknown>, check: (db: Db, mine: unknown, fired: boolean) => Promise<void>): Promise<void> {
      const total = await callsOf(async () => {
        const db = await fresh();
        await setup(db);
        return db;
      }, handler);
      expect(total).toBeGreaterThan(0);
      for (let n = 1; n <= total + 1; n += 1) {
        const db = await fresh();
        await setup(db);
        const wrapped = interleave(db, n, competitor);
        const mine = await handler(wrapped.db);
        if (!wrapped.fired()) await competitor(db);
        await check(db, mine, wrapped.fired());
      }
    }

    const sourceIn = async (db: Db): Promise<void> => {
      await db.createTransfer(learnerSideRow(), created);
      await db.consentSlot(ID, { kind: 'teacher', slots: ['destination'], accountId: 'teacher-b', via: 'owner' }, at(HOUR));
    };

    it('decline vs approve: the request ends declined, never approved after a decline', async () => {
      await everyInterleaving(
        sourceIn,
        (db) => approve(db, 'source', 'teacher-a', at(2 * HOUR)),
        (db) => db.declineSlot(ID, 'destination', 'declined_destination', 'destination', at(2 * HOUR)),
        async (db) => {
          const row = await db.getTransfer(ID);
          expect(row?.status).toBe('declined');
          expect(row?.endReason).toBe('declined_destination');
          expect(await db.promoteTransfer(ID, at(3 * HOUR))).toBe(0);
        },
      );
    });

    it('approve vs decline from the same slot: one of them wins, the request never reopens', async () => {
      await everyInterleaving(
        sourceIn,
        (db) => decline(db, at(2 * HOUR)),
        (db) => approve(db, 'source', 'teacher-a', at(2 * HOUR)),
        async (db) => {
          const row = await db.getTransfer(ID);
          expect(row?.status).toBe('declined');
          expect(row?.source.state).toBe('declined');
        },
      );
    });

    it('approve vs approve on one slot: exactly one consent is recorded', async () => {
      let theirs: Outcome = 'not_open';
      await everyInterleaving(
        sourceIn,
        (db) => approve(db, 'source', 'teacher-a', at(2 * HOUR)),
        async (db) => {
          theirs = await approve(db, 'source', 'school-admin', at(2 * HOUR), 'school_admin');
        },
        async (db, mine) => {
          const row = await db.getTransfer(ID);
          expect([mine, theirs].filter((o) => o === 'ok')).toHaveLength(1);
          expect(row?.source.accountId).toBe(mine === 'ok' ? 'teacher-a' : 'school-admin');
          expect(row?.status).toBe('approved');
          expect(row?.rev).toBe(3); // destination, source, promote: one write each
        },
      );
    });

    it('cancel vs approve: the request ends cancelled and nobody moved', async () => {
      await everyInterleaving(
        sourceIn,
        (db) => approve(db, 'source', 'teacher-a', at(2 * HOUR)),
        (db) => cancel(db, at(2 * HOUR)),
        async (db) => {
          expect((await db.getTransfer(ID))?.status).toBe('cancelled');
          expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
          expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
        },
      );
    });

    it('expire vs approve: past the window the request ends expired whatever the order', async () => {
      const late = at(TRANSFER_WINDOW_MS + HOUR);
      await everyInterleaving(
        sourceIn,
        (db) => approve(db, 'source', 'teacher-a', late),
        (db) => db.expireTransfer(ID, late),
        async (db) => {
          const row = await db.getTransfer(ID);
          expect(row?.status).toBe('expired');
          expect(row?.endedAt).toBe(late.toISOString());
        },
      );
    });

    it("cancel between settle's read and the batch: the cancel wins and both memberships are untouched", async () => {
      const due = at(HOUR + TRANSFER_COOLING_OFF_MS);
      await everyInterleaving(
        (db) => approvedRequest(db).then(() => undefined),
        (db) => execute(db, due),
        (db) => cancel(db, due),
        async (db, mine, fired) => {
          const row = await db.getTransfer(ID);
          if (fired) {
            expect(mine).toBe(false);
            expect(row?.status).toBe('cancelled');
            expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
            expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
          } else {
            expect(mine).toBe(true);
            expect(row?.status).toBe('executed');
            expect(await db.membership(SOURCE, 'learner', LEARNER)).toBeNull();
            expect(await db.membership(DEST, 'learner', LEARNER)).not.toBeNull();
          }
        },
      );
    });

    it('execute vs execute: one gate wins, the learner is moved once', async () => {
      const due = at(HOUR + TRANSFER_COOLING_OFF_MS);
      let theirs = false;
      await everyInterleaving(
        (db) => approvedRequest(db).then(() => undefined),
        (db) => execute(db, due),
        async (db) => {
          theirs = await execute(db, due);
        },
        async (db, mine) => {
          expect([mine, theirs].filter(Boolean)).toHaveLength(1);
          expect((await db.transferEvents(ID)).filter((e) => e.event === 'executed')).toHaveLength(1);
          expect((await db.membersOf(DEST)).filter((m) => m.memberKind === 'learner')).toHaveLength(1);
        },
      );
    });
  });
}

races('memory', () => new MemoryDb());
const sqlite = openSqliteD1();
races('sqlite (real migrations)', () => new D1Db(sqlite));
