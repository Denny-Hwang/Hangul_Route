import { CATALOG, SelfRouteSchema, generateCurriculum, toMeta, toPlanItems } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { selfRoute } from '../../homework/__tests__/curriculum-fixture';
import { activeSelfRoute, archivedRoute, newSelfRouteId, selfRouteOf, thisWeekRows } from '../self-route';

const draft = generateCurriculum(
  {
    audience: 'self',
    level: { stage: 'stage1', band: 0 },
    completedQuestIds: ['quest:stage1-letters-q1'],
    startDate: '2026-10-12',
    weeks: 4,
    sessionsPerWeek: 3,
    minutesPerSession: 15,
    unlockedStages: ['stage1'],
  },
  CATALOG,
);

describe('self-route (F-PLAN-002 section 3.5, 3.9)', () => {
  it('an id the schema accepts, from the clock and a random part', () => {
    const id = newSelfRouteId(Date.parse('2026-10-12T09:00:00.000Z'), () => 0.5);
    expect(id).toMatch(/^route:[a-z0-9-]+$/);
    expect(newSelfRouteId(1, () => 0)).toBe('route:1-0000');
    expect(newSelfRouteId(1, () => 0.999999)).toMatch(/^route:1-[a-z0-9]{4}$/);
    expect(newSelfRouteId(Date.now())).toMatch(/^route:[a-z0-9]+-[a-z0-9]{4}$/);
  });

  it('a stored route: the meta without completions, the items by date, active and dated now', () => {
    const route = selfRouteOf(draft, 'route:abc-0001', '2026-10-12T09:00:00.000Z');
    expect(SelfRouteSchema.parse(route)).toEqual(route);
    expect(route).toMatchObject({ id: 'route:abc-0001', createdAt: '2026-10-12T09:00:00.000Z', updatedAt: '2026-10-12T09:00:00.000Z', archivedAt: null });
    expect(route.meta).toEqual(toMeta(draft));
    expect(route.meta.params).not.toHaveProperty('completedQuestIds');
    expect(route.items).toEqual(toPlanItems(draft));
  });

  it('archiving keeps the route and dates the change (never set to null, so the Worker keeps it)', () => {
    const route = selfRoute();
    expect(archivedRoute(route, '2026-10-20T00:00:00.000Z')).toEqual({ ...route, archivedAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z' });
  });

  it('the active route of a snapshot, or null when there is none or it is archived', () => {
    const route = selfRoute();
    expect(activeSelfRoute({ selfRoute: route })).toBe(route);
    expect(activeSelfRoute({ selfRoute: { ...route, archivedAt: 'x' } })).toBeNull();
    expect(activeSelfRoute({ selfRoute: null })).toBeNull();
    expect(activeSelfRoute({})).toBeNull();
    expect(activeSelfRoute(undefined)).toBeNull();
  });

  it('this week of a plan: the items of the plan week that holds today, by date', () => {
    const route = selfRouteOf(draft, 'route:abc-0001', '2026-10-12T09:00:00.000Z');
    const week1 = thisWeekRows(route, '2026-10-14');
    expect(week1.length).toBeGreaterThan(0);
    expect(week1.every((row) => row.date >= '2026-10-12' && row.date <= '2026-10-18')).toBe(true);
    expect(week1).toEqual([...week1].sort((a, b) => a.date.localeCompare(b.date)));
    const week2 = thisWeekRows(route, '2026-10-19');
    expect(week2.every((row) => row.date >= '2026-10-19' && row.date <= '2026-10-25')).toBe(true);
    expect(thisWeekRows(route, '2026-10-01')).toEqual([]);
    expect(thisWeekRows(route, '2027-01-01')).toEqual([]);
    expect(thisWeekRows({ ...route, items: [{ kind: 'quest', id: 'quest:x' }] }, '2026-10-14')).toEqual([]);
  });
});
