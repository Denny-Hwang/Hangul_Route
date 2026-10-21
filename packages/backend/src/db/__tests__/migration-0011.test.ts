import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Space, SpaceEvent } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { runScheduledPurge, SPACE_EVENT_RETENTION_DAYS } from '../../lib/note-retention';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';

/**
 * [SA] Migration 0011_space_events.sql (AMENDMENTS-SEATS-ADMINS section 6.2). A merge applies it to production before
 * the Worker code (server first), so it must be additive: one new table and its index, nothing else altered,
 * rewritten or dropped, and no CHECK on `kind` (the zod registry is the check, so later kinds stay additive).
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0011_space_events.sql';
const statements = readFileSync(join(DIR, FILE), 'utf8')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const T = '2026-10-20T00:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;
const school: Space = { id: 'space:sch', kind: 'school', name: 'Maple School', parentSpaceId: null, ownerAccountId: 'principal', joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: true }, archivedAt: null, createdAt: T };
const event = (over: Partial<SpaceEvent> = {}): SpaceEvent => ({ id: 'sev:1', spaceId: school.id, kind: 'renamed', actorAccountId: 'principal', subjectAccountId: null, subjectSpaceId: null, inviteId: null, createdAt: T, ...over });

describe('migration 0011_space_events.sql · production safety', () => {
  it('is the only migration with its number', () => {
    expect(readdirSync(DIR).filter((f) => f.startsWith('0011_'))).toEqual([FILE]);
  });

  it('creates one table and one index and nothing else, with no CHECK', () => {
    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatch(/^CREATE TABLE IF NOT EXISTS space_events \(/);
    expect(statements[1]).toBe('CREATE INDEX IF NOT EXISTS idx_space_events_space ON space_events(space_id, created_at)');
    expect(statements.join(' ')).not.toMatch(/\bCHECK\b|\bALTER\b|\bDROP\b|\bUPDATE\b|\bDELETE FROM\b|\bINSERT\b/i);
    expect(statements[0]).toMatch(/subject_space_id TEXT,/);
  });

  it('applies on the database at the previous migration; spaces read back unchanged', async () => {
    const d1 = openSqliteD1({ before: FILE });
    const before = new D1Db(d1);
    await before.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: T });
    await before.putSpace(school);
    await expect(d1.prepare('SELECT * FROM space_events').all()).rejects.toThrow(/space_events/);
    for (const st of statements) await d1.prepare(st).run();
    const after = new D1Db(d1);
    expect(await after.getSpace(school.id)).toEqual(school);
    await after.addSpaceEvent(event({ subjectSpaceId: 'space:gone-class' })); // no FK on the subject class
    expect(await after.spaceEventsOf(school.id, 5)).toEqual([event({ subjectSpaceId: 'space:gone-class' })]);
    d1.close();
  });

  it('a Worker that runs before the migration skips the event purge and keeps purging the rest', async () => {
    const d1 = openSqliteD1({ before: FILE });
    expect(await runScheduledPurge(new D1Db(d1), new Date())).toMatchObject({ rounds: 1, spaceEvents: 0 });
    d1.close();
  });
});

function eventContract(name: string, make: () => Db): void {
  describe(`space events · ${name}`, () => {
    const seeded = async (): Promise<Db> => {
      const db = make();
      await db.reset();
      await db.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(school);
      return db;
    };

    it('stores ids and a time, newest first, and refuses an unknown kind', async () => {
      const db = await seeded();
      await db.addSpaceEvent(event({ id: 'sev:a', createdAt: '2026-10-19T00:00:00.000Z' }));
      await db.addSpaceEvent(event({ id: 'sev:b', kind: 'class_renamed', subjectSpaceId: 'space:cls' }));
      expect((await db.spaceEventsOf(school.id, 10)).map((e) => e.id)).toEqual(['sev:b', 'sev:a']);
      expect(await db.spaceEventsOf(school.id, 1)).toHaveLength(1);
      await expect(db.addSpaceEvent(event({ id: 'sev:c', kind: 'deleted' as SpaceEvent['kind'] }))).rejects.toThrow();
      await expect(db.addSpaceEvent(event({ id: 'sev:d', spaceId: 'space:nope' }))).rejects.toThrow();
    });

    it(`the daily purge removes rows older than ${SPACE_EVENT_RETENTION_DAYS} days only`, async () => {
      const db = await seeded();
      const now = new Date(T);
      await db.addSpaceEvent(event({ id: 'sev:old', createdAt: new Date(now.getTime() - (SPACE_EVENT_RETENTION_DAYS + 1) * DAY).toISOString() }));
      await db.addSpaceEvent(event({ id: 'sev:kept', createdAt: new Date(now.getTime() - (SPACE_EVENT_RETENTION_DAYS - 1) * DAY).toISOString() }));
      expect(await runScheduledPurge(db, now)).toMatchObject({ spaceEvents: 1 });
      expect((await db.spaceEventsOf(school.id, 10)).map((e) => e.id)).toEqual(['sev:kept']);
      expect(await db.purgeSpaceEvents(now, 0)).toBe(0);
    });
  });
}

eventContract('memory', () => new MemoryDb());
eventContract('D1 (SQLite)', () => new D1Db(openSqliteD1()));
