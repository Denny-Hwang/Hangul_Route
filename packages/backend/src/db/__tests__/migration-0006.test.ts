import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CurriculumMeta } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';

/**
 * Migration 0006_plan_meta.sql (F-PLAN-002 section 3.5, erratum E-1: the next
 * free number when P2-4 was opened). A merge applies it to production, so it
 * must be additive: one nullable column, no backfill, nothing rewritten.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0006_plan_meta.sql';
const sql = readFileSync(join(DIR, FILE), 'utf8');
const statements = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

const T = '2026-10-11T00:00:00.000Z';
const meta: CurriculumMeta = {
  kind: 'curriculum',
  generatorVersion: 1,
  catalogVersion: 1,
  params: { audience: 'family', level: { stage: 'stage1', band: 0 }, startDate: '2026-10-18', weeks: 1, sessionsPerWeek: 3, minutesPerSession: 10, daysOff: [], goals: { focus: 'balanced' }, includeComingSoon: true, culturalAnchors: true, unlockedStages: ['stage1'] },
  weeks: [{ index: 1, startDate: '2026-10-18', kind: 'learn', focus: { episodeId: 'episode:stage1-letters', storyIds: [], festival: null }, extras: [] }],
  horizonDays: 7,
  repacedAt: null,
};

async function seedLegacyPlan(d1: ReturnType<typeof openSqliteD1>): Promise<void> {
  await d1.prepare("INSERT INTO accounts (id, created_at) VALUES ('t', ?)").bind(T).run();
  await d1
    .prepare("INSERT INTO spaces (id, kind, name, owner_account_id, settings_json, created_at) VALUES ('space:c', 'class', 'A', 't', '{}', ?)")
    .bind(T)
    .run();
  await d1
    .prepare('INSERT INTO plans (id, space_id, author_account_id, title, items_json, target_learner_ids_json, published_at, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind('plan:old', 'space:c', 't', 'Week 3', JSON.stringify([{ kind: 'quest', id: 'quest:a', targetDate: '2026-10-10' }]), null, T, null, T, T)
    .run();
}

describe('migration 0006_plan_meta.sql · production safety', () => {
  it('is the only migration with its number', () => {
    expect(readdirSync(DIR).filter((f) => f.startsWith('0006_'))).toEqual([FILE]);
  });

  it('only adds one nullable column to plans (additive: no backfill, no rewrite, no drop)', () => {
    expect(statements).toEqual(['ALTER TABLE plans ADD COLUMN meta_json TEXT']);
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|RENAME|NOT NULL|DEFAULT)\b/i);
  });

  it('applies on the database at the previous migration; existing rows read back as classic plans (meta null)', async () => {
    const d1 = openSqliteD1({ before: FILE });
    await seedLegacyPlan(d1);
    // The Worker's adapter must not be used before the column exists: it writes meta_json.
    await expect(new D1Db(d1).putPlan({ id: 'plan:new', spaceId: 'space:c', authorAccountId: 't', title: 'x', items: [{ kind: 'quest', id: 'quest:a' }], targetLearnerIds: null, publishedAt: null, archivedAt: null, createdAt: T, updatedAt: T, meta: null })).rejects.toThrow(/meta_json/);
    for (const st of statements) await d1.prepare(st).run();
    const db = new D1Db(d1);
    expect(await db.getPlan('plan:old')).toEqual({
      id: 'plan:old',
      spaceId: 'space:c',
      authorAccountId: 't',
      title: 'Week 3',
      items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-10-10' }],
      targetLearnerIds: null,
      publishedAt: T,
      archivedAt: null,
      createdAt: T,
      updatedAt: T,
      meta: null,
    });
    // ... and a route can be written next to them.
    const old = await db.getPlan('plan:old');
    if (old) await db.putPlan({ ...old, meta });
    expect((await db.getPlan('plan:old'))?.meta).toEqual(meta);
    d1.close();
  });

  it('reads a meta_json that is not valid JSON as a classic plan instead of failing the whole space', async () => {
    const d1 = openSqliteD1();
    await seedLegacyPlan(d1);
    await d1.prepare("UPDATE plans SET meta_json = '{not json' WHERE id = 'plan:old'").run();
    expect((await new D1Db(d1).getPlan('plan:old'))?.meta).toBeNull();
    d1.close();
  });
});
