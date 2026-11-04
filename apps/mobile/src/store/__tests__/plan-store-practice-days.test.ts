import type { InboxPlan } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND section 9.4 (row BL-8): the learner's own practice days in the derivation. The class
 * plan's practice items move to the learner's days while `flags.routeBlendEnabled` is on, once the practice-days chunk
 * handed in its placer; the write keeps one entry per plan and drops the days of a plan the learner no longer has.
 */

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));

// The chunk loader, without the screen: it hands in the real placer, as the chunk does.
const loads = vi.hoisted(() => ({ count: 0, fail: false }));
vi.mock('../../screens/route/practice-days-load', async () => {
  const { setPracticePlacer } = await import('../../logic/route/practice-days');
  const { placeSourceForLearner } = await import('../../logic/route/place-learner-days');
  return {
    loadPracticeDaysChunk: vi.fn(async () => {
      loads.count += 1;
      if (loads.fail) throw new Error('offline');
      setPracticePlacer(placeSourceForLearner);
      return { placeSourceForLearner };
    }),
  };
});

import { flags } from '../../config/flags';
import { blendedMeta } from '../../logic/homework/__tests__/curriculum-fixture';
import { setPracticePlacer } from '../../logic/route/practice-days';
import { usePlanStore } from '../plan-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';

const TODAY = new Date('2026-11-02T09:00:00.000Z');

const blendPlan: InboxPlan = {
  id: 'plan:thu',
  spaceId: 'space:c',
  spaceKind: 'class',
  spaceName: 'A',
  title: 'Thursday class',
  items: [
    { kind: 'quest', id: 'quest:stage1-letters-q1', lectureDate: '2026-11-05', targetDate: '2026-11-06' },
    { kind: 'quest', id: 'quest:stage1-letters-q2', lectureDate: '2026-11-05', targetDate: '2026-11-08' },
  ],
  publishedAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  meta: blendedMeta({ startDate: '2026-11-02', weeks: 2, lectureDays: ['thu'], practiceDays: ['fri', 'sun', 'tue'] }),
};

const dates = (): Record<string, string> =>
  Object.fromEntries((useProgressStore.getState().byProfile['profile:a']?.homework ?? []).map((h) => [h.questId, h.targetDate]));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  mem.clear();
  loads.count = 0;
  loads.fail = false;
  setPracticePlacer(null);
  flags.routeBlendEnabled = true;
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
});

afterEach(() => {
  vi.useRealTimers();
  flags.routeBlendEnabled = false;
  setPracticePlacer(null);
});

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  await vi.waitFor(() => expect(loads.count).toBeGreaterThan(0));
  await new Promise((r) => setTimeout(r, 0));
};

describe('setPracticeDays', () => {
  it('stores the entry in week order, persists it, and drops the days of a plan the learner left', async () => {
    useProgressStore.getState().ensure('profile:a');
    expect(useProgressStore.getState().setPracticeDays('profile:a', { planId: 'plan:old', days: ['sat'], updatedAt: '2026-11-01T00:00:00.000Z' }, ['plan:old'])).toBe(true);
    expect(useProgressStore.getState().setPracticeDays('profile:a', { planId: 'plan:thu', days: ['sun', 'mon'], updatedAt: '2026-11-02T00:00:00.000Z' }, ['plan:thu'])).toBe(true);
    expect(useProgressStore.getState().byProfile['profile:a']?.practiceDays).toEqual([{ planId: 'plan:thu', days: ['mon', 'sun'], updatedAt: '2026-11-02T00:00:00.000Z' }]);
    await vi.waitFor(() => expect(mem.get('progress:profile:a')).toMatchObject({ practiceDays: [{ planId: 'plan:thu' }] }));
  });

  it('refuses an entry the schema refuses and writes nothing', () => {
    useProgressStore.getState().ensure('profile:a');
    expect(useProgressStore.getState().setPracticeDays('profile:a', { planId: 'plan:thu', days: [], updatedAt: '2026-11-02T00:00:00.000Z' }, ['plan:thu'])).toBe(false);
    expect(useProgressStore.getState().byProfile['profile:a']?.practiceDays).toBeUndefined();
  });
});

describe('derivation with the learner\'s days', () => {
  it('keeps the plan dates without learner days', async () => {
    await usePlanStore.getState().applyPlans('profile:a', [blendPlan]);
    expect(dates()).toEqual({ 'quest:stage1-letters-q1': '2026-11-06', 'quest:stage1-letters-q2': '2026-11-08' });
    expect(loads.count).toBe(0);
  });

  it('loads the placer once the learner moved days, then moves the items to their day', async () => {
    useProgressStore.getState().ensure('profile:a');
    useProgressStore.getState().setPracticeDays('profile:a', { planId: 'plan:thu', days: ['mon'], updatedAt: '2026-11-02T00:00:00.000Z' }, ['plan:thu']);
    await usePlanStore.getState().applyPlans('profile:a', [blendPlan]);
    await settle();
    await vi.waitFor(() => expect(dates()).toEqual({ 'quest:stage1-letters-q1': '2026-11-09', 'quest:stage1-letters-q2': '2026-11-09' }));
  });

  it('a chunk that cannot load leaves the plan dates', async () => {
    loads.fail = true;
    useProgressStore.getState().ensure('profile:a');
    useProgressStore.getState().setPracticeDays('profile:a', { planId: 'plan:thu', days: ['mon'], updatedAt: '2026-11-02T00:00:00.000Z' }, ['plan:thu']);
    await usePlanStore.getState().applyPlans('profile:a', [blendPlan]);
    await settle();
    expect(dates()).toEqual({ 'quest:stage1-letters-q1': '2026-11-06', 'quest:stage1-letters-q2': '2026-11-08' });
  });

  it('with the switch off nothing moves and nothing loads', async () => {
    flags.routeBlendEnabled = false;
    useProgressStore.getState().ensure('profile:a');
    useProgressStore.getState().setPracticeDays('profile:a', { planId: 'plan:thu', days: ['mon'], updatedAt: '2026-11-02T00:00:00.000Z' }, ['plan:thu']);
    await usePlanStore.getState().applyPlans('profile:a', [blendPlan]);
    expect(dates()).toEqual({ 'quest:stage1-letters-q1': '2026-11-06', 'quest:stage1-letters-q2': '2026-11-08' });
    expect(loads.count).toBe(0);
  });
});
