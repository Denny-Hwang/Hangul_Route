import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db, type D1Like, type D1PreparedLike } from '../d1';
import { NOTE_INBOX_LIMIT, noteRateKey } from '../feedback-types';
import { at, CLASS, classNote, DAY, FAMILY, iso, learnerRow, MIN, MOM, report, seedNotesWorld, SUNI, TEACHER } from './feedback-fixtures';

/**
 * Migration 0008_feedback_notes.sql (F-FEEDBACK-001 section 7.4, PR FB-2). A
 * merge applies it to production before the Worker code (server first), so it
 * must be additive: six new tables and their indexes, nothing existing is
 * altered, rewritten or dropped. Also the statement budget of section 7.4: the
 * set-based methods prepare the same number of statements for 1 learner and
 * for 300.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0008_feedback_notes.sql';
const sql = readFileSync(join(DIR, FILE), 'utf8');
const statements = sql
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const TABLES = ['feedback_notes', 'feedback_reports', 'feedback_sender_holds', 'learner_note_prefs', 'feedback_sender_blocks', 'feedback_send_grants'];
type SqliteD1 = ReturnType<typeof openSqliteD1>;

/** A connection that counts the statements it prepares, and the queries a D1 batch runs. */
function counting(d1: SqliteD1): { d1: D1Like; prepared: () => number; reset: () => void } {
  let n = 0;
  return {
    d1: {
      prepare(text: string): D1PreparedLike {
        n += 1;
        return d1.prepare(text);
      },
      batch: (stmts) => d1.batch(stmts),
    },
    prepared: () => n,
    reset: () => {
      n = 0;
    },
  };
}

describe('migration 0008_feedback_notes.sql · production safety', () => {
  it('is the only migration with its number', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
    expect(files.filter((f) => f.startsWith('0008_'))).toEqual([FILE]);
  });

  it('only creates the six tables and their indexes (additive: nothing altered, dropped or rewritten)', () => {
    const creates = statements.filter((s) => s.startsWith('CREATE TABLE IF NOT EXISTS '));
    expect(creates.map((s) => s.split(' ')[5])).toEqual(TABLES);
    expect(statements.filter((s) => s.startsWith('CREATE INDEX IF NOT EXISTS '))).toEqual([
      'CREATE INDEX IF NOT EXISTS idx_feedback_notes_learner ON feedback_notes(learner_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_notes_space ON feedback_notes(space_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_notes_sender ON feedback_notes(sender_account_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_notes_batch ON feedback_notes(batch_id)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_notes_created ON feedback_notes(created_at, id)',
      "CREATE INDEX IF NOT EXISTS idx_feedback_notes_reported ON feedback_notes(created_at, id) WHERE status = 'reported'",
      'CREATE INDEX IF NOT EXISTS idx_feedback_reports_sender ON feedback_reports(sender_account_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_reports_note ON feedback_reports(note_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_reports_created ON feedback_reports(created_at, id)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_reports_learner ON feedback_reports(learner_id)',
    ]);
    expect(statements).toHaveLength(TABLES.length + 10);
    // `ON DELETE CASCADE` is a foreign-key clause, not a write
    expect(statements.join(';').replace(/ON DELETE CASCADE/g, '')).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|RENAME|ALTER|REPLACE)\b/i);
  });

  it('stores no learner name, email or account name: ids, codes and the adult’s checked text only', () => {
    expect(statements.join(';')).not.toMatch(/display_name|email|\bname\b/i);
  });

  it('applies on the database at the previous migration, twice, and existing rows read back unchanged', async () => {
    const d1 = openSqliteD1({ before: FILE });
    const before = new D1Db(d1);
    await before.putAccount({ id: MOM, email: null, displayName: 'Mom', consent: null, createdAt: iso(0) });
    await before.putLearner(learnerRow(SUNI));
    await before.recordRateHit('tcode:acct:mom', at(0));
    const learner = await before.getLearner(SUNI);
    await expect(d1.prepare('SELECT * FROM feedback_notes').all()).rejects.toThrow(/feedback_notes/);
    for (const st of statements) await d1.prepare(st).run();
    for (const st of statements) await d1.prepare(st).run();
    const after = new D1Db(d1);
    expect(await after.getLearner(SUNI)).toEqual(learner);
    expect(await after.countRateHits('tcode:acct:mom', at(-DAY))).toBe(1);
    d1.close();
  });

  it('enforces the column checks and cascades from learners and spaces', async () => {
    const d1 = openSqliteD1();
    const db = new D1Db(d1);
    await seedNotesWorld(db);
    const insert = (cols: Record<string, unknown>) => {
      const row = { id: 'note:abcdefgh', learner_id: SUNI, space_id: CLASS, sender_account_id: TEACHER, sender_role: 'teacher', sender_label: null, batch_id: 'b', batch_kind: 'learners', preset_id: 'p', status: 'live', hidden_at: null, hidden_via: null, withdrawn_at: null, suggest_kind: null, created_at: iso(0), ...cols };
      const keys = Object.keys(row);
      return d1.prepare(`INSERT INTO feedback_notes (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).bind(...Object.values(row)).run();
    };
    await expect(insert({ sender_role: 'teacher', sender_label: 'mom' })).rejects.toThrow(/CHECK/);
    await expect(insert({ status: 'hidden' })).rejects.toThrow(/CHECK/);
    await expect(insert({ status: 'withdrawn' })).rejects.toThrow(/CHECK/);
    await expect(insert({ batch_kind: 'class' })).rejects.toThrow(/CHECK/);
    await expect(insert({ suggest_kind: 'story' })).rejects.toThrow(/CHECK/);
    await expect(insert({ status: 'hidden', hidden_at: iso(0), hidden_via: 'admin' })).rejects.toThrow(/CHECK/);
    await insert({ status: 'hidden', hidden_at: iso(0), hidden_via: 'device' });
    await expect(d1.prepare("INSERT INTO feedback_sender_holds (account_id, reason, created_at) VALUES ('a', 'angry', ?)").bind(iso(0)).run()).rejects.toThrow(/CHECK/);
    await expect(d1.prepare("INSERT INTO learner_note_prefs (learner_id, classes, updated_at, updated_via) VALUES (?, 'some', ?, 'family')").bind(SUNI, iso(0)).run()).rejects.toThrow(/CHECK/);
    await db.insertNoteReport(report('note:abcdefgh'));
    await db.putBlock({ learnerId: SUNI, senderAccountId: TEACHER, familySpaceId: FAMILY, createdByAccount: MOM, createdAt: iso(0) });
    await db.putSendGrant({ spaceId: FAMILY, accountId: 'acct-dad', grantedBy: MOM, grantedAt: iso(0) });
    // deleting a space or a learner takes their rows along (section 8.7)
    await d1.prepare('DELETE FROM memberships').run();
    await d1.prepare('DELETE FROM spaces WHERE id = ?').bind(FAMILY).run();
    expect(await db.getSendGrant(FAMILY, 'acct-dad')).toBeNull();
    expect(await db.listBlocks(SUNI)).toEqual([]);
    await d1.prepare('DELETE FROM learners WHERE id = ?').bind(SUNI).run();
    expect(await db.getNote('note:abcdefgh')).toBeNull();
    expect(await db.countReportersAgainst(TEACHER, at(-DAY))).toBe(0);
    d1.close();
  });

  it('the inbox, list and send reads use the indexes', async () => {
    const d1 = openSqliteD1();
    const plan = async (text: string, params: unknown[]): Promise<string> => {
      const { results } = await d1.prepare(`EXPLAIN QUERY PLAN ${text}`).bind(...params).all<{ detail: string }>();
      return results.map((r) => r.detail).join(' | ');
    };
    expect(await plan('SELECT id FROM feedback_notes WHERE learner_id = ? AND created_at >= ?', [SUNI, iso(0)])).toMatch(/idx_feedback_notes_learner/);
    expect(await plan('SELECT id FROM feedback_notes WHERE space_id = ? ORDER BY created_at DESC', [CLASS])).toMatch(/idx_feedback_notes_space/);
    expect(await plan('SELECT id FROM feedback_notes WHERE batch_id = ?', ['b'])).toMatch(/idx_feedback_notes_batch/);
    expect(await plan('SELECT COUNT(DISTINCT reporter_key) FROM feedback_reports WHERE sender_account_id = ? AND created_at >= ?', [TEACHER, iso(0)])).toMatch(/idx_feedback_reports_sender/);
    d1.close();
  });

  it('the purge, the retention filter, the report write and the erase never scan a notes table (section 8.7 runs on every send)', async () => {
    const raw = openSqliteD1();
    const seen: Array<{ text: string; params: unknown[] }> = [];
    const inner = new WeakMap<D1PreparedLike, { stmt: D1PreparedLike; text: string; params: unknown[] }>();
    const wrap = (stmt: D1PreparedLike, text: string, params: unknown[]): D1PreparedLike => {
      const outer: D1PreparedLike = {
        bind: (...values: unknown[]) => wrap(stmt.bind(...values), text, values),
        first: () => (seen.push({ text, params }), stmt.first()),
        all: () => (seen.push({ text, params }), stmt.all()),
        run: () => (seen.push({ text, params }), stmt.run()),
      };
      inner.set(outer, { stmt, text, params });
      return outer;
    };
    const recording: D1Like = {
      prepare: (text: string) => wrap(raw.prepare(text), text, []),
      batch: (stmts) =>
        raw.batch(
          stmts.map((outer) => {
            const s = inner.get(outer)!;
            seen.push({ text: s.text, params: s.params });
            return s.stmt;
          }),
        ),
    };
    const db = new D1Db(recording);
    await seedNotesWorld(new D1Db(raw));
    const n = classNote();
    await db.insertNotes([n], []);
    seen.length = 0;
    await db.purgeNotes(at(-180 * DAY), at(-90 * DAY), at(-365 * DAY), 200);
    await db.notesForSpace(CLASS, { before: { createdAt: iso(0), id: 'note:zzzzzzzz' }, limit: 50, now: at(0) });
    await db.notesForOversight(SUNI, { before: null, limit: 50, now: at(0) });
    await db.insertNoteReport(report(n.id));
    await db.deleteLearner(MIN);
    const texts = new Map<string, unknown[]>();
    for (const s of seen) if (/feedback_(notes|reports)/.test(s.text)) texts.set(s.text, s.params);
    expect(texts.size).toBeGreaterThan(0);
    const scans: string[] = [];
    for (const [text, params] of texts) {
      const { results } = await raw.prepare(`EXPLAIN QUERY PLAN ${text}`).bind(...params).all<{ detail: string }>();
      for (const { detail } of results) {
        // a full scan of a table (an index scan names its index; json_each is the bound list)
        if (/^SCAN /.test(detail) && !/USING (COVERING )?INDEX|VIRTUAL TABLE|CONSTANT ROW/.test(detail)) scans.push(`${detail} :: ${text.slice(0, 80)}`);
      }
    }
    expect(scans.filter((s) => !s.includes('feedback_sender_holds'))).toEqual([]);
    // the ON DELETE CASCADE lookups from a note and from a learner use an index
    const plan = async (text: string): Promise<string> => (await raw.prepare(`EXPLAIN QUERY PLAN ${text}`).bind('x').all<{ detail: string }>()).results.map((r) => r.detail).join(' | ');
    expect(await plan('SELECT 1 FROM feedback_reports WHERE note_id = ?')).toMatch(/idx_feedback_reports_note/);
    expect(await plan('SELECT 1 FROM feedback_reports WHERE learner_id = ?')).toMatch(/idx_feedback_reports_learner/);
    raw.close();
  });
});

describe('notes Db · statement budget (section 7.4, D11)', () => {
  it('a send prepares the same statements for 1 learner and for 300, and the reads one statement each', async () => {
    const raw = openSqliteD1();
    const seed = new D1Db(raw);
    await seedNotesWorld(seed);
    const many = Array.from({ length: 300 }, (_, i) => `profile:l${i}`);
    for (const learnerId of many) {
      await seed.putLearner(learnerRow(learnerId));
      await seed.addMembership({ spaceId: CLASS, memberKind: 'learner', memberId: learnerId, role: 'student', joinedAt: iso(0) });
    }
    const counter = counting(raw);
    const db = new D1Db(counter.d1);

    const sendTo = async (learnerIds: string[], batchId: string): Promise<number> => {
      counter.reset();
      const keys = [noteRateKey.account(TEACHER), ...learnerIds.flatMap((l) => [noteRateKey.pair(l, TEACHER), noteRateKey.learner(l)])];
      await db.studentsOf(CLASS, learnerIds);
      await db.notePrefsFor(learnerIds);
      await db.blocksFor(learnerIds, TEACHER);
      await db.countRateHitsByKeys(keys, at(-DAY));
      const written = await db.insertNotes(
        learnerIds.map((learnerId) => classNote({ learnerId, batchId })),
        keys.map((key) => ({ key, at: iso(0) })),
      );
      expect(written).toBe(learnerIds.length);
      return counter.prepared();
    };
    const one = await sendTo([many[0]!], 'batch:one');
    const all = await sendTo(many, 'batch:all');
    expect(all).toBe(one);
    expect(one).toBeLessThanOrEqual(6);
    expect((await seed.countRateHitsByKeys([noteRateKey.account(TEACHER)], at(-DAY))).get(noteRateKey.account(TEACHER))).toBe(2);

    counter.reset();
    const box = await db.notesForLearner(many[5]!, 'full', at(0), NOTE_INBOX_LIMIT);
    expect(box.notes).toHaveLength(1);
    expect(counter.prepared()).toBe(1);
    raw.close();
  });

  it('purgeNotes also drops report rows past 90 days of a note the owner restored', async () => {
    const d1 = openSqliteD1();
    const db = new D1Db(d1);
    await seedNotesWorld(db);
    const n = classNote({ createdAt: iso(-100 * DAY) });
    await db.insertNotes([n], []);
    await db.insertNoteReport(report(n.id, { createdAt: iso(-95 * DAY) }));
    // the runbook's "restored" outcome puts the note back to live
    await d1.prepare("UPDATE feedback_notes SET status = 'live' WHERE id = ?").bind(n.id).run();
    expect(await db.purgeNotes(at(-180 * DAY), at(-90 * DAY), at(-365 * DAY), 10)).toBe(1);
    expect(await db.getNote(n.id)).not.toBeNull();
    expect(await db.countReportersAgainst(TEACHER, at(-400 * DAY))).toBe(0);
    d1.close();
  });
});
