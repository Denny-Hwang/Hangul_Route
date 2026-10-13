import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';
import { at, CLASS, classNote, DAY, FAMILY, familyNote, HOUR, iso, learnerRow, MIN, report, seedNotesWorld, SUNI } from './feedback-fixtures';

/**
 * `sentListOfSpace` — F-FEEDBACK-001 section 7.2 (PR FB-3b): a space's sent
 * list in one statement, each `everyone` batch collapsed to one row with its
 * size and live notes and no count of opens or reactions. One contract, two
 * backends.
 */
const NOW = at(0);

function sentListContract(name: string, make: () => Db): void {
  describe(`sentListOfSpace · ${name}`, () => {
    let db: Db;
    beforeEach(async () => {
      db = make();
      await db.reset();
      await seedNotesWorld(db);
    });

    it('collapses an everyone batch to one row, its first note, keeps notes to chosen learners apart, newest first', async () => {
      const a = classNote({ batchId: 'batch:all', batchKind: 'everyone', createdAt: iso(-HOUR) });
      const b = classNote({ batchId: 'batch:all', batchKind: 'everyone', learnerId: MIN, createdAt: iso(-HOUR) });
      const chosen = classNote({ batchId: 'batch:two', createdAt: iso(-2 * HOUR) });
      const chosenToo = classNote({ batchId: 'batch:two', learnerId: MIN, createdAt: iso(-2 * HOUR) });
      expect(await db.insertNotes([a, b], [])).toBe(2);
      expect(await db.insertNotes([chosen, chosenToo], [])).toBe(2);
      await db.insertNotes([familyNote()], []);

      const rows = await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW });
      expect(rows.map((r) => [r.note.id, r.batch])).toEqual([
        [a.id, { size: 2, live: 2, withdrawn: 0 }],
        [[chosen.id, chosenToo.id].sort()[1], null],
        [[chosen.id, chosenToo.id].sort()[0], null],
      ]);
    });

    it('the batch row keeps its first note whatever is taken back; size, live and taken-back follow the rows', async () => {
      const a = classNote({ batchId: 'batch:all', batchKind: 'everyone' });
      const b = classNote({ batchId: 'batch:all', batchKind: 'everyone', learnerId: MIN, createdAt: a.createdAt });
      expect(await db.insertNotes([a, b], [])).toBe(2);
      const view = async () => (await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW })).map((r) => [r.note.id, r.note.status, r.batch]);
      await db.withdrawNote(a.id, NOW);
      expect(await view()).toEqual([[a.id, 'withdrawn', { size: 2, live: 1, withdrawn: 1 }]]);
      expect(await db.insertNoteReport(report(b.id, { learnerId: MIN }))).toBe(true);
      expect(await view()).toEqual([[a.id, 'withdrawn', { size: 2, live: 0, withdrawn: 1 }]]);
    });

    it('a note taken back and then reported still counts as taken back (rule 8.2-c)', async () => {
      const a = classNote({ batchId: 'batch:all', batchKind: 'everyone' });
      const b = classNote({ batchId: 'batch:all', batchKind: 'everyone', learnerId: MIN, createdAt: a.createdAt });
      expect(await db.insertNotes([a, b], [])).toBe(2);
      expect(await db.withdrawBatch('batch:all', a.senderAccountId, NOW)).toBe(2);
      expect(await db.insertNoteReport(report(b.id, { learnerId: MIN, via: 'device', evidence: 'dev-1' }))).toBe(true);
      const [row] = await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW });
      expect(row?.batch).toEqual({ size: 2, live: 0, withdrawn: 2 });
      expect((await db.getNote(b.id))?.withdrawnAt).not.toBeNull();
    });

    it('a first note past retention hands the row to the next visible note of the batch', async () => {
      const a = classNote({ batchId: 'batch:x', batchKind: 'everyone', createdAt: iso(-HOUR) });
      const b = classNote({ batchId: 'batch:x', batchKind: 'everyone', learnerId: MIN, createdAt: a.createdAt });
      expect(await db.insertNotes([a, b], [])).toBe(2);
      expect(await db.insertNoteReport(report(a.id, { createdAt: iso(-HOUR) }))).toBe(true);
      // 91 days later a's report is past its 90 days: b, still within 180 days, is the row
      const later = at(91 * DAY - 2 * HOUR);
      expect((await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: later })).map((r) => [r.note.id, r.batch])).toEqual([[b.id, { size: 1, live: 1, withdrawn: 0 }]]);
    });

    it('applies the retention cut-offs to the rows and to the batch size', async () => {
      const fresh = classNote({ batchId: 'batch:x', batchKind: 'everyone', createdAt: iso(-HOUR) });
      const reported = classNote({ batchId: 'batch:x', batchKind: 'everyone', learnerId: MIN, createdAt: fresh.createdAt });
      expect(await db.insertNotes([fresh, reported], [])).toBe(2);
      expect(await db.insertNoteReport(report(reported.id, { learnerId: MIN, createdAt: iso(-HOUR) }))).toBe(true);
      expect(await db.insertNotes([classNote({ createdAt: iso(-181 * DAY) })], [])).toBe(1);
      // 91 days later the report is past its 90 days: the batch shrinks to one note
      const later = at(91 * DAY - 2 * HOUR);
      expect((await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: later })).map((r) => r.batch)).toEqual([{ size: 1, live: 1, withdrawn: 0 }]);
      expect((await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW })).map((r) => r.batch)).toEqual([{ size: 2, live: 1, withdrawn: 0 }]);
    });

    it('pages by the keyset cursor and the limit', async () => {
      const notes = Array.from({ length: 5 }, (_, i) => classNote({ batchId: `batch:${i}`, createdAt: iso(-(i + 1) * HOUR) }));
      for (const n of notes) expect(await db.insertNotes([n], [])).toBe(1);
      const first = await db.sentListOfSpace(CLASS, { before: null, limit: 2, now: NOW });
      expect(first.map((r) => r.note.id)).toEqual([notes[0]!.id, notes[1]!.id]);
      const last = first[1]!.note;
      const second = await db.sentListOfSpace(CLASS, { before: { createdAt: last.createdAt, id: last.id }, limit: 10, now: NOW });
      expect(second.map((r) => r.note.id)).toEqual(notes.slice(2).map((n) => n.id));
      expect(await db.sentListOfSpace(FAMILY, { before: null, limit: 10, now: NOW })).toEqual([]);
      expect(SUNI).toBe(notes[0]!.learnerId);
    });

    it('a batch on a page boundary is never repeated or skipped when a note of it is taken back between pages', async () => {
      const older = classNote({ batchId: 'batch:older', createdAt: iso(-3 * HOUR) });
      const batch = [SUNI, MIN].map((learnerId) => classNote({ batchId: 'batch:all', batchKind: 'everyone', learnerId, createdAt: iso(-2 * HOUR) }));
      const newer = classNote({ batchId: 'batch:newer', createdAt: iso(-HOUR) });
      expect(await db.insertNotes([older], [])).toBe(1);
      expect(await db.insertNotes(batch, [])).toBe(2);
      expect(await db.insertNotes([newer], [])).toBe(1);
      const first = await db.sentListOfSpace(CLASS, { before: null, limit: 2, now: NOW });
      expect(first.map((r) => r.note.id)).toEqual([newer.id, batch[0]!.id]);
      await db.withdrawNote(batch[0]!.id, NOW);
      const last = first[1]!.note;
      const second = await db.sentListOfSpace(CLASS, { before: { createdAt: last.createdAt, id: last.id }, limit: 2, now: NOW });
      expect(second.map((r) => r.note.id)).toEqual([older.id]);
    });
  });
}

sentListContract('memory', () => new MemoryDb());
sentListContract('d1 (sqlite)', () => new D1Db(openSqliteD1()));

describe('sentListOfSpace on D1 does linear work', () => {
  /** The SQL and params of the one statement `sentListOfSpace` runs, and its query plan. */
  async function planOf(raw: ReturnType<typeof openSqliteD1>, before: { createdAt: string; id: string } | null): Promise<string[]> {
    const seen: Array<{ sql: string; params: unknown[] }> = [];
    const db = new D1Db({
      prepare(sql: string) {
        const stmt = raw.prepare(sql);
        return {
          bind(...params: unknown[]) {
            seen.push({ sql, params });
            stmt.bind(...params);
            return this;
          },
          first: () => stmt.first(),
          all: () => stmt.all(),
          run: () => stmt.run(),
        };
      },
      batch: (statements) => raw.batch(statements),
    });
    await db.sentListOfSpace(CLASS, { before, limit: 50, now: NOW });
    expect(seen).toHaveLength(1);
    const [{ sql, params }] = seen as [{ sql: string; params: unknown[] }];
    const { results } = await raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...params).all<{ detail: string }>();
    return results.map((r) => r.detail);
  }

  it('never scans a notes table: the space index pages, and a batch’s first note is one rowid seek on idx_feedback_notes_batch', async () => {
    const raw = openSqliteD1();
    for (const before of [null, { createdAt: iso(0), id: 'note:x' }]) {
      const plan = await planOf(raw, before);
      expect(plan.filter((d) => /^SCAN /.test(d) && !/USING (COVERING )?INDEX|CONSTANT ROW/.test(d))).toEqual([]);
      expect(plan.join(' | ')).toMatch(/SEARCH n USING INDEX idx_feedback_notes_space/);
      expect(plan.join(' | ')).toMatch(/SEARCH b USING INDEX idx_feedback_notes_batch \(batch_id=\? AND rowid<\?\)/);
    }
    raw.close();
  });

  it('a page of 300-learner class-wide sends stays fast: the batch counts are read once per listed batch, not once per note', async () => {
    const raw = openSqliteD1();
    const db = new D1Db(raw);
    await seedNotesWorld(db);
    const learners = Array.from({ length: 300 }, (_, i) => `profile:big-${String(i).padStart(3, '0')}`);
    for (const learnerId of learners) await db.putLearner(learnerRow(learnerId));
    for (let b = 0; b < 60; b += 1) {
      const createdAt = iso(-(b + 1) * HOUR);
      const rows = learners.map((learnerId) => classNote({ learnerId, batchId: `batch:big-${b}`, batchKind: 'everyone', createdAt }));
      expect(await db.insertNotes(rows, [])).toBe(300);
    }
    /** The fastest of three runs, so a busy runner's pause does not decide the test. */
    const fastest = async (run: () => Promise<unknown>): Promise<number> => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 3; i += 1) {
        const started = performance.now();
        await run();
        best = Math.min(best, performance.now() - started);
      }
      return best;
    };
    const page = await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW });
    expect(page).toHaveLength(50);
    expect(page.every((r) => r.batch?.size === 300 && r.batch.live === 300)).toBe(true);
    // A linear yardstick on the same runner: reading every note of those 50 batches once (15,000 rows).
    const yardstick = await fastest(() => db.notesForSpace(CLASS, { before: null, limit: 15_000, now: NOW }));
    const elapsed = await fastest(() => db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW }));
    // The per-note correlated version cost about 10 yardsticks here (about 4.5M rows read); the linear one is below one.
    expect(elapsed).toBeLessThan(4 * yardstick);
    raw.close();
  }, 60_000);
});
