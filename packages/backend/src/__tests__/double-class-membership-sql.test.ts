import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Space } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { D1Db } from '../db';
import { openSqliteD1 } from './helpers/sqlite';

/*
 * The owner-run repair of docs/launch/ops/double-class-membership.sql (owner report 2026-10-23), against the real
 * migrations through the node:sqlite shim (in both suite modes: it opens its own database). Step 1 lists the source
 * memberships that came back after a move that still stands; step 2 deletes exactly those, and nothing on a rerun.
 */

const FILE = join(dirname(fileURLToPath(import.meta.url)), '../../../../docs/launch/ops/double-class-membership.sql');

/** The file's statements, comments dropped, in order. */
function statements(): string[] {
  const body = readFileSync(FILE, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
  return body
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const T0 = '2026-09-01T10:00:00.000Z';
const MOVED = '2026-09-10T10:00:00.000Z';
const BACK = '2026-09-20T10:00:00.000Z';
const REJOINED = '2026-09-25T10:00:00.000Z';

const cls = (id: string, name: string): Space => ({
  id,
  kind: 'class',
  name,
  parentSpaceId: null,
  ownerAccountId: 'teacher-a',
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: T0,
});

describe('double class membership repair SQL', () => {
  it('step 1 lists the re-join, step 2 deletes it once, a rerun deletes nothing', async () => {
    const d1 = openSqliteD1();
    const db = new D1Db(d1);
    await db.putAccount({ id: 'teacher-a', email: 'teacher-a@example.test', displayName: null, consent: null, createdAt: T0 });
    for (const [id, name] of [
      ['space:class-a', 'Class A'],
      ['space:class-b', 'Class B'],
      ['space:class-c', 'Class C'],
    ] as const) {
      await db.putSpace(cls(id, name));
    }
    for (const id of ['profile:suni', 'profile:jun']) {
      await db.putLearner({ id, displayName: id, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: T0, lastActiveAt: T0 });
    }
    const move = (id: string, learner: string, from: string, to: string, at: string) =>
      d1
        .prepare(
          `INSERT INTO class_moves (id, learner_id, source_space_id, dest_space_id, kind, status, actor_account_id, actor_via, created_at, updated_at, expires_at, executed_at)
           VALUES (?, ?, ?, ?, 'direct', 'executed', 'teacher-a', 'owner', ?, ?, ?, ?)`,
        )
        .bind(id, learner, from, to, at, at, at, at)
        .run();
    const joined = (space: string, learner: string, at: string) => db.addMembership({ spaceId: space, memberKind: 'learner', memberId: learner, role: 'student', joinedAt: at });

    // Suni: moved A -> B, then back in A by A's old code (the double).
    await move('move:suni-1', 'profile:suni', 'space:class-a', 'space:class-b', MOVED);
    await joined('space:class-b', 'profile:suni', MOVED);
    await joined('space:class-a', 'profile:suni', REJOINED);
    // Jun: moved A -> B, joined C, then moved C -> A by a teacher: in A and B legitimately (a later move into A).
    await move('move:jun-1', 'profile:jun', 'space:class-a', 'space:class-b', MOVED);
    await joined('space:class-b', 'profile:jun', MOVED);
    await move('move:jun-2', 'profile:jun', 'space:class-c', 'space:class-a', BACK);
    await joined('space:class-a', 'profile:jun', BACK);

    const [select = '', remove = ''] = statements();
    expect(statements()).toHaveLength(2);
    expect(select).toMatch(/^SELECT/);
    expect(remove).toMatch(/^DELETE FROM memberships/);
    // The runbook cuts the steps out at the `-- STEP 1` / `-- STEP 2` lines (awk): step 1 must hold no write.
    const lines = readFileSync(FILE, 'utf8').split('\n');
    const at1 = lines.findIndex((l) => l.startsWith('-- STEP 1'));
    const at2 = lines.findIndex((l) => l.startsWith('-- STEP 2'));
    expect([at1 > 0, at2 > at1]).toEqual([true, true]);
    expect(lines.slice(at1 + 1, at2).join('\n')).not.toMatch(/\b(DELETE|UPDATE|INSERT|DROP)\b/i);
    expect(lines.slice(at1 + 1, at2).join('\n')).toContain(select);
    expect(lines.slice(at2 + 1).join('\n')).toContain(remove);

    const listed = (await d1.prepare(select).all<Record<string, unknown>>()).results;
    expect(listed).toEqual([
      {
        learner_id: 'profile:suni',
        source_space_id: 'space:class-a',
        source_name: 'Class A',
        dest_space_id: 'space:class-b',
        dest_name: 'Class B',
        move_kind: 'class_move',
        move_id: 'move:suni-1',
        executed_at: MOVED,
        source_joined_at: REJOINED,
      },
    ]);

    expect((await d1.prepare(remove).run()).meta?.changes).toBe(1);
    expect((await d1.prepare(remove).run()).meta?.changes).toBe(0);
    expect((await d1.prepare(select).all()).results).toEqual([]);
    expect((await db.membershipsOf('learner', 'profile:suni')).map((m) => m.spaceId)).toEqual(['space:class-b']);
    expect((await db.membershipsOf('learner', 'profile:jun')).map((m) => m.spaceId).sort()).toEqual(['space:class-a', 'space:class-b']);
    d1.close();
  });
});
