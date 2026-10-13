import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';
import type { StoredNote } from '../feedback-types';
import { MemoryDb } from '../memory';
import type { Db } from '../types';
import { at, CLASS, classNote, FAMILY, familyNote, HOUR, iso, report, seedNotesWorld } from './feedback-fixtures';

/**
 * `deleteNotesForMembership` — F-FEEDBACK-001 section 7.5. When a learner leaves a space from its device, its
 * live, hidden and withdrawn notes there go, but a note any report row names stays: a note the owner reviewed
 * (no longer `reported`) keeps its reports, so a leave never resets the report history the hold counts
 * (section 8.4). One contract, two backends; `review` stands in for the owner's runbook update (FB-13), here
 * keeping the note hidden.
 */
function cleanupContract(name: string, make: () => { db: Db; review: (noteId: string) => Promise<void> }): void {
  describe(`deleteNotesForMembership · ${name}`, () => {
    it('deletes the space’s unreported notes, keeps reported and reviewed ones and other spaces’ notes', async () => {
      const { db, review } = make();
      await db.reset();
      await seedNotesWorld(db);
      const live = classNote({ batchId: 'batch:a' });
      const reported = classNote({ batchId: 'batch:b' });
      const reviewed = classNote({ batchId: 'batch:c' });
      const home = familyNote();
      for (const n of [live, reported, reviewed, home]) expect(await db.insertNotes([n], [])).toBe(1);
      expect(await db.insertNoteReport(report(reported.id))).toBe(true);
      expect(await db.insertNoteReport(report(reviewed.id))).toBe(true);
      await review(reviewed.id);

      expect(await db.deleteNotesForMembership(live.learnerId, CLASS)).toBe(1);
      expect(await db.getNote(live.id)).toBeNull();
      expect((await db.getNote(reported.id))?.status).toBe('reported');
      expect((await db.getNote(reviewed.id))?.status).toBe('hidden');
      expect((await db.getNote(home.id))?.spaceId).toBe(FAMILY);
      expect(await db.countReportersAgainst(reviewed.senderAccountId, at(-HOUR))).toBe(1);
    });
  });
}

cleanupContract('memory', () => {
  const db = new MemoryDb();
  const notes = (db as unknown as { notes: Map<string, StoredNote> }).notes;
  return {
    db,
    review: async (noteId) => {
      const row = notes.get(noteId);
      if (row) notes.set(noteId, { ...row, status: 'hidden', hiddenAt: iso(0), hiddenVia: 'family' });
    },
  };
});
cleanupContract('d1 (sqlite)', () => {
  const raw = openSqliteD1();
  return {
    db: new D1Db(raw),
    review: async (noteId) => {
      await raw.prepare("UPDATE feedback_notes SET status = 'hidden', hidden_at = ?, hidden_via = 'family' WHERE id = ?").bind(iso(0), noteId).run();
    },
  };
});
