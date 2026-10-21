import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Membership, Space } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { runScheduledPurge } from '../../lib/note-retention';
import { D1Db } from '../d1';

/**
 * [SA] Migration 0012_admin_invites.sql (AMENDMENTS-SEATS-ADMINS sections 6.1, 6.2). A merge applies it to production
 * before the Worker code (server first), so it must be additive: one nullable column on memberships, one new table and
 * its index, nothing else altered, rewritten or dropped, and no CHECK.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0012_admin_invites.sql';
const statements = readFileSync(join(DIR, FILE), 'utf8')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const T = '2026-10-20T00:00:00.000Z';
const school: Space = { id: 'space:sch', kind: 'school', name: 'Maple School', parentSpaceId: null, ownerAccountId: 'principal', joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: true }, archivedAt: null, createdAt: T };
const teacher: Membership = { spaceId: school.id, memberKind: 'account', memberId: 'kim', role: 'teacher', joinedAt: T };

describe('migration 0012_admin_invites.sql · production safety', () => {
  it('is the only migration with its number', () => {
    expect(readdirSync(DIR).filter((f) => f.startsWith('0012_'))).toEqual([FILE]);
  });

  it('adds one nullable column, one table and one index, and nothing else, with no CHECK', () => {
    expect(statements).toEqual([
      'ALTER TABLE memberships ADD COLUMN promoted_from TEXT',
      expect.stringMatching(/^CREATE TABLE IF NOT EXISTS admin_invites \(/),
      'CREATE INDEX IF NOT EXISTS idx_admin_invites_space ON admin_invites(space_id, created_at)',
    ]);
    expect(statements.join(' ')).not.toMatch(/\bCHECK\b|\bDROP\b|\bUPDATE\b|\bDELETE FROM\b|\bINSERT\b|NOT NULL DEFAULT/i);
    expect(statements[1]).toMatch(/token_hash TEXT NOT NULL UNIQUE/);
    expect(statements[1]).not.toMatch(/\btoken TEXT/);
  });

  it('applies on the database at the previous migration; spaces and memberships read back unchanged', async () => {
    const d1 = openSqliteD1({ before: FILE });
    const before = new D1Db(d1);
    for (const id of ['principal', 'kim']) await before.putAccount({ id, email: null, displayName: null, consent: null, createdAt: T });
    await before.putSpace(school);
    await before.addMembership(teacher);
    await expect(d1.prepare('SELECT * FROM admin_invites').all()).rejects.toThrow(/admin_invites/);
    for (const st of statements) await d1.prepare(st).run();
    const after = new D1Db(d1);
    expect(await after.getSpace(school.id)).toEqual(school);
    expect(await after.membersOf(school.id)).toEqual([teacher]);
    expect(await d1.prepare('SELECT promoted_from FROM memberships WHERE member_id = ?').bind('kim').first()).toEqual({ promoted_from: null });
    d1.close();
  });

  it('a Worker that runs before the migration skips the invite purge and keeps purging the rest', async () => {
    const d1 = openSqliteD1({ before: FILE });
    expect(await runScheduledPurge(new D1Db(d1), new Date())).toMatchObject({ rounds: 1, spaceEvents: 0, adminInvites: 0 });
    d1.close();
  });
});
