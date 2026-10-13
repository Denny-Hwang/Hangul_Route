import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';
import { classNote, familyNote, iso, HOUR, MIN, report, seedNotesWorld } from './feedback-fixtures';

/**
 * `reportsForNotes` — F-FEEDBACK-001 section 7.2 (PR FB-4b-family): the report
 * rows behind the family view's "reported by", in one statement, oldest first.
 * One contract, two backends.
 */
function contract(name: string, make: () => Db): void {
  describe(`reportsForNotes · ${name}`, () => {
    let db: Db;
    beforeEach(async () => {
      db = make();
      await db.reset();
      await seedNotesWorld(db);
    });

    it('answers the rows of the asked notes only, oldest first, and nothing for an empty list', async () => {
      const a = classNote();
      const b = familyNote();
      const c = classNote({ learnerId: MIN });
      for (const n of [a, b, c]) expect(await db.insertNotes([n], [])).toBe(1);
      expect(await db.insertNoteReport(report(a.id, { id: 'notereport:a2', createdAt: iso(-HOUR / 2) }))).toBe(true);
      expect(await db.insertNoteReport(report(a.id, { id: 'notereport:a1', via: 'device', evidence: 'device-1', createdAt: iso(-HOUR + 1) }))).toBe(true);
      expect(await db.insertNoteReport(report(b.id, { id: 'notereport:b1', createdAt: iso(-HOUR / 3) }))).toBe(true);
      expect(await db.insertNoteReport(report(c.id, { id: 'notereport:c1', learnerId: MIN }))).toBe(true);
      const rows = await db.reportsForNotes([a.id, b.id, a.id]);
      expect(rows.map((r) => r.id)).toEqual(['notereport:a1', 'notereport:a2', 'notereport:b1']);
      expect(rows[0]).toEqual(report(a.id, { id: 'notereport:a1', via: 'device', evidence: 'device-1', createdAt: iso(-HOUR + 1) }));
      expect(await db.reportsForNotes([])).toEqual([]);
    });
  });
}

contract('memory', () => new MemoryDb());
contract('d1 (sqlite)', () => new D1Db(openSqliteD1()));
