import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';
import { at, CLASS, classNote, DAY, FAMILY, familyNote, HOUR, iso, MIN, report, seedNotesWorld, SUNI } from './feedback-fixtures';

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

    it('collapses an everyone batch to one row, keeps notes to chosen learners apart, newest first', async () => {
      const a = classNote({ batchId: 'batch:all', batchKind: 'everyone', createdAt: iso(-HOUR) });
      const b = classNote({ batchId: 'batch:all', batchKind: 'everyone', learnerId: MIN, createdAt: iso(-HOUR) });
      const chosen = classNote({ batchId: 'batch:two', createdAt: iso(-2 * HOUR) });
      const chosenToo = classNote({ batchId: 'batch:two', learnerId: MIN, createdAt: iso(-2 * HOUR) });
      expect(await db.insertNotes([a, b], [])).toBe(2);
      expect(await db.insertNotes([chosen, chosenToo], [])).toBe(2);
      await db.insertNotes([familyNote()], []);

      const rows = await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW });
      expect(rows.map((r) => [r.note.id, r.batch])).toEqual([
        [[a.id, b.id].sort()[0], { size: 2, live: 2 }],
        [[chosen.id, chosenToo.id].sort()[1], null],
        [[chosen.id, chosenToo.id].sort()[0], null],
      ]);
    });

    it('the batch row names a live note while any is live, then a withdrawn one; size and live follow the rows', async () => {
      const a = classNote({ batchId: 'batch:all', batchKind: 'everyone' });
      const b = classNote({ batchId: 'batch:all', batchKind: 'everyone', learnerId: MIN, createdAt: a.createdAt });
      expect(await db.insertNotes([a, b], [])).toBe(2);
      await db.withdrawNote(a.id, NOW);
      expect((await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW })).map((r) => [r.note.id, r.batch])).toEqual([[b.id, { size: 2, live: 1 }]]);
      expect(await db.insertNoteReport(report(b.id, { learnerId: MIN }))).toBe(true);
      expect((await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW })).map((r) => [r.note.id, r.note.status, r.batch])).toEqual([[a.id, 'withdrawn', { size: 2, live: 0 }]]);
    });

    it('applies the retention cut-offs to the rows and to the batch size', async () => {
      const fresh = classNote({ batchId: 'batch:x', batchKind: 'everyone', createdAt: iso(-HOUR) });
      const reported = classNote({ batchId: 'batch:x', batchKind: 'everyone', learnerId: MIN, createdAt: fresh.createdAt });
      expect(await db.insertNotes([fresh, reported], [])).toBe(2);
      expect(await db.insertNoteReport(report(reported.id, { learnerId: MIN, createdAt: iso(-HOUR) }))).toBe(true);
      expect(await db.insertNotes([classNote({ createdAt: iso(-181 * DAY) })], [])).toBe(1);
      // 91 days later the report is past its 90 days: the batch shrinks to one note
      const later = at(91 * DAY - 2 * HOUR);
      expect((await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: later })).map((r) => r.batch)).toEqual([{ size: 1, live: 1 }]);
      expect((await db.sentListOfSpace(CLASS, { before: null, limit: 50, now: NOW })).map((r) => r.batch)).toEqual([{ size: 2, live: 1 }]);
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
  });
}

sentListContract('memory', () => new MemoryDb());
sentListContract('d1 (sqlite)', () => new D1Db(openSqliteD1()));

describe('sentListOfSpace on D1 reads indexes only', () => {
  it('never scans a notes table (the batch subqueries use idx_feedback_notes_batch)', async () => {
    const raw = openSqliteD1();
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
    await db.sentListOfSpace(CLASS, { before: { createdAt: iso(0), id: 'note:x' }, limit: 50, now: NOW });
    const [{ sql, params }] = seen as [{ sql: string; params: unknown[] }];
    const { results } = await raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...params).all<{ detail: string }>();
    const scans = results.map((r) => r.detail).filter((d) => /^SCAN /.test(d) && !/USING (COVERING )?INDEX|CONSTANT ROW/.test(d));
    expect(scans).toEqual([]);
    expect(results.map((r) => r.detail).join(' | ')).toMatch(/idx_feedback_notes_batch/);
    raw.close();
  });
});
