import type { InboxPlan } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

import { useAccountStore } from '../account-store';
import { usePlanStore, unlockedStagesFor } from '../plan-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';

const plan: InboxPlan = {
  id: 'plan:w3',
  spaceId: 'space:c',
  spaceKind: 'class',
  spaceName: 'A',
  title: 'Week 3',
  items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-28' }, { kind: 'quest', id: 'quest:stage2-nope' }],
  publishedAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

beforeEach(() => {
  mem.clear();
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
  useAccountStore.setState({ subscription: null });
});

describe('plan-store (F-PLAN-001 §3.3)', () => {
  it('free learners have Stage 1 unlocked only', () => {
    expect(unlockedStagesFor(new Date(), 'profile:a')).toEqual(['stage1']);
  });

  it('applies inbox plans: derives homework, persists plans, records not-ready, syncs only on change', async () => {
    const first = await usePlanStore.getState().applyPlans('profile:a', [plan]);
    expect(first).toEqual({ changed: true, added: 1, notReady: { 'plan:w3': 1 } });
    const homework = useProgressStore.getState().byProfile['profile:a']?.homework ?? [];
    expect(homework).toHaveLength(1);
    expect(homework[0]).toMatchObject({ id: 'plan:w3#quest:stage1-letters-q1', assignedBy: 'teacher', targetDate: '2026-09-28', episodeId: 'episode:stage1-letters' });
    expect(mem.get('plans:profile:a')).toEqual([plan]);
    expect(usePlanStore.getState().notReady['profile:a']).toEqual({ 'plan:w3': 1 });

    const again = await usePlanStore.getState().applyPlans('profile:a', [plan]);
    expect(again.changed).toBe(false);
    expect(useProgressStore.getState().byProfile['profile:a']?.homework).toHaveLength(1);

    const cleared = await usePlanStore.getState().applyPlans('profile:a', []);
    expect(cleared.changed).toBe(true);
    expect(useProgressStore.getState().byProfile['profile:a']?.homework).toEqual([]);
  });

  it('hydrates cached plans', async () => {
    mem.set('plans:profile:a', [plan]);
    expect(await usePlanStore.getState().hydrate('profile:a')).toEqual([plan]);
    expect(await usePlanStore.getState().hydrate('profile:a')).toEqual([plan]);
  });
});
