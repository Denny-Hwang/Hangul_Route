import type { InboxPlan } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

// The real tier store, with `questOpenFor` observable (F-ENT-003 section 3.6).
vi.mock('../tier-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tier-store')>();
  return { ...actual, questOpenFor: vi.fn(actual.questOpenFor) };
});

import { flags } from '../../config/flags';
import { curriculumMeta, selfRoute } from '../../logic/homework/__tests__/curriculum-fixture';
import { useAccountStore } from '../account-store';
import { usePlanStore, unlockedStagesFor } from '../plan-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { questOpenFor, useTierStore } from '../tier-store';

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
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
});

describe('plan-store (F-PLAN-001 §3.3)', () => {
  it('free learners have Stage 1 unlocked only', () => {
    expect(unlockedStagesFor(new Date(), 'profile:a')).toEqual(['stage1']);
  });

  it('applies inbox plans: derives homework, persists plans, records not-ready, syncs only on change', async () => {
    const first = await usePlanStore.getState().applyPlans('profile:a', [plan]);
    expect(first).toEqual({ changed: true, added: 1, removed: 0, redated: 0, notReady: { 'plan:w3': 1 } });
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

  it('derives the active self-route beside the inbox plans (F-PLAN-002 section 3.6)', async () => {
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:stage1-letters-q2' }] });
    useProgressStore.getState().ensure('profile:a');
    const snapshot = useProgressStore.getState().byProfile['profile:a']!;
    useProgressStore.getState().replaceSnapshot('profile:a', { ...snapshot, selfRoute: route });
    const outcome = await usePlanStore.getState().applyPlans('profile:a', [plan]);
    expect(outcome.added).toBe(2);
    const homework = useProgressStore.getState().byProfile['profile:a']?.homework ?? [];
    expect(homework.map((h) => [h.id, h.assignedBy])).toEqual([
      ['plan:w3#quest:stage1-letters-q1', 'teacher'],
      ['route:mine#quest:stage1-letters-q2', 'system'],
    ]);
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute).toEqual(route);
  });

  it('derives a Stage 2 item by the access tier: stale premium and a membership with no cache keep it (F-ENT-003 section 3.4)', async () => {
    const stage2: InboxPlan = { ...plan, items: [{ kind: 'quest', id: 'quest:stage2-life-q1', targetDate: '2026-09-28' }] };
    // Free: the Stage 2 item waits.
    expect((await usePlanStore.getState().applyPlans('profile:a', [stage2])).notReady).toEqual({ 'plan:w3': 1 });
    // The last word from the server was premium, long past its grace window: access keeps it.
    useTierStore.setState({ byLearner: { 'profile:a': { tier: 'premium', source: null, validUntil: '2026-01-01T00:00:00.000Z', fetchedAt: 't' } } });
    expect(await usePlanStore.getState().applyPlans('profile:a', [stage2])).toMatchObject({ added: 1, notReady: {} });
    // A free inbox closes it again.
    useTierStore.setState({ byLearner: { 'profile:a': { tier: 'free', source: null, validUntil: null, fetchedAt: 't2' } } });
    expect(await usePlanStore.getState().applyPlans('profile:a', [stage2])).toMatchObject({ removed: 1, notReady: { 'plan:w3': 1 } });
    // No cache yet, and the device holds a space for the learner: fail open.
    useTierStore.setState({ byLearner: {}, spaceMembers: { 'profile:a': true } });
    expect(await usePlanStore.getState().applyPlans('profile:a', [stage2])).toMatchObject({ added: 1, notReady: {} });
  });

  it('persists a redate-only change and reports it (F-PLAN-002 section 3.6 rule 2)', async () => {
    await usePlanStore.getState().applyPlans('profile:a', [plan]);
    const moved: InboxPlan = { ...plan, items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-30' }] };
    const outcome = await usePlanStore.getState().applyPlans('profile:a', [moved]);
    expect(outcome).toMatchObject({ changed: true, added: 0, removed: 0, redated: 1 });
    expect(useProgressStore.getState().byProfile['profile:a']?.homework.map((h) => h.targetDate)).toEqual(['2026-09-30']);
  });
});

describe('plan-store with no network (F-PLAN-002 section 3.6 rule 1, section 3.11)', () => {
  const at = (iso: string): void => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };
  afterEach(() => {
    vi.useRealTimers();
  });
  const weekly = (): InboxPlan => ({
    ...plan,
    id: 'plan:term',
    items: [
      { kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-22' },
      { kind: 'quest', id: 'quest:stage1-letters-q2', targetDate: '2026-09-30' },
    ],
    meta: curriculumMeta(),
  });

  it('rederives the cached curriculum on a later day with no inbox call: next week arrives', async () => {
    at('2026-09-21T09:00:00.000Z');
    await usePlanStore.getState().applyPlans('profile:a', [weekly()]);
    expect(useProgressStore.getState().byProfile['profile:a']?.homework.map((h) => h.questId)).toEqual(['quest:stage1-letters-q1']);
    // A cold start nine days later, offline: only storage is there.
    usePlanStore.setState({ byLearner: {}, notReady: {} });
    at('2026-09-30T09:00:00.000Z');
    const outcome = await usePlanStore.getState().rederive('profile:a');
    expect(outcome).toMatchObject({ changed: true, added: 1 });
    expect(useProgressStore.getState().byProfile['profile:a']?.homework.map((h) => h.questId)).toEqual(['quest:stage1-letters-q1', 'quest:stage1-letters-q2']);
    expect(usePlanStore.getState().byLearner['profile:a']).toEqual([weekly()]);
  });

  it('advances a self-route with no inbox ever received', async () => {
    at('2026-09-21T09:00:00.000Z');
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-21' }, { kind: 'quest', id: 'quest:stage1-letters-q2', targetDate: '2026-10-01' }] });
    useProgressStore.getState().ensure('profile:a');
    useProgressStore.getState().replaceSnapshot('profile:a', { ...useProgressStore.getState().byProfile['profile:a']!, selfRoute: route });
    expect(await usePlanStore.getState().rederive('profile:a')).toMatchObject({ added: 1 });
    at('2026-09-25T09:00:00.000Z');
    expect(await usePlanStore.getState().rederive('profile:a')).toMatchObject({ added: 1 });
    expect(useProgressStore.getState().byProfile['profile:a']?.homework.map((h) => h.id)).toEqual(['route:mine#quest:stage1-letters-q1', 'route:mine#quest:stage1-letters-q2']);
  });

  it('leaves pending plan homework alone when no plan was ever cached on this device', async () => {
    useProgressStore.getState().ensure('profile:a');
    const pending = { id: 'plan:w3#quest:stage1-letters-q1', profileId: 'profile:a', questId: 'quest:stage1-letters-q1', episodeId: 'episode:stage1-letters', assignedBy: 'teacher' as const, assignedAt: 't', targetDate: '2026-09-28' };
    useProgressStore.getState().replaceSnapshot('profile:a', { ...useProgressStore.getState().byProfile['profile:a']!, homework: [pending] });
    expect(await usePlanStore.getState().rederive('profile:a')).toBeNull();
    expect(usePlanStore.getState().reconcile('profile:a', useProgressStore.getState().byProfile['profile:a']!).homework).toEqual([pending]);
  });

  it('reconciles a merged snapshot against the plans in memory: a dropped pending item stays dropped, a new date holds', async () => {
    at('2026-09-21T09:00:00.000Z');
    const moved: InboxPlan = { ...weekly(), items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-23' }] };
    await usePlanStore.getState().applyPlans('profile:a', [moved]);
    const local = useProgressStore.getState().byProfile['profile:a']!;
    const stale = { id: 'plan:term#quest:stage1-letters-q2', profileId: 'profile:a', questId: 'quest:stage1-letters-q2', episodeId: 'episode:stage1-letters', assignedBy: 'teacher' as const, assignedAt: 't', targetDate: '2026-09-21' };
    const merged = { ...local, homework: [{ ...local.homework[0]!, targetDate: '2026-09-22' }, stale] };
    const reconciled = usePlanStore.getState().reconcile('profile:a', merged);
    expect(reconciled.homework.map((h) => [h.id, h.targetDate])).toEqual([['plan:term#quest:stage1-letters-q1', '2026-09-23']]);
    expect(usePlanStore.getState().reconcile('profile:a', reconciled)).toBe(reconciled);
  });
});

describe('plan-store and quest access (F-ENT-003 section 3.6)', () => {
  const realQuestOpenFor = vi.mocked(questOpenFor).getMockImplementation();
  afterEach(() => {
    if (realQuestOpenFor) vi.mocked(questOpenFor).mockImplementation(realQuestOpenFor);
    vi.mocked(questOpenFor).mockClear();
  });

  const twoStage1: InboxPlan = {
    ...plan,
    items: [
      { kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-28' },
      { kind: 'quest', id: 'quest:stage1-letters-q2', targetDate: '2026-09-29' },
    ],
  };
  const closing = (shut: string) => () => (questId: string) => questId !== shut;

  it('deriveFor asks questOpenFor for the learner at the derivation time; a closed item waits as not ready', async () => {
    vi.mocked(questOpenFor).mockImplementation(closing('quest:stage1-letters-q2'));
    const outcome = await usePlanStore.getState().applyPlans('profile:a', [twoStage1]);
    // The learner, the derivation time and the snapshot derived from (its finished quests are kept).
    expect(questOpenFor).toHaveBeenCalledWith('profile:a', expect.any(Date), expect.objectContaining({ profileId: 'profile:a', quests: [] }));
    expect(outcome).toMatchObject({ added: 1, notReady: { 'plan:w3': 1 } });
    expect(useProgressStore.getState().byProfile['profile:a']?.homework.map((h) => h.questId)).toEqual(['quest:stage1-letters-q1']);
    expect(usePlanStore.getState().notReady['profile:a']).toEqual({ 'plan:w3': 1 });
  });

  it('rederive uses it too, and adds the item once it opens', async () => {
    vi.mocked(questOpenFor).mockImplementation(closing('quest:stage1-letters-q2'));
    await usePlanStore.getState().applyPlans('profile:a', [twoStage1]);
    vi.mocked(questOpenFor).mockImplementation(() => () => true);
    expect(await usePlanStore.getState().rederive('profile:a')).toMatchObject({ added: 1, notReady: {} });
    expect(useProgressStore.getState().byProfile['profile:a']?.homework).toHaveLength(2);
  });

  it('reconcile drops a pending item of a merged snapshot whose quest is closed', async () => {
    await usePlanStore.getState().applyPlans('profile:a', [twoStage1]);
    const merged = useProgressStore.getState().byProfile['profile:a']!;
    expect(merged.homework).toHaveLength(2);
    vi.mocked(questOpenFor).mockClear();
    vi.mocked(questOpenFor).mockImplementation(closing('quest:stage1-letters-q2'));
    const reconciled = usePlanStore.getState().reconcile('profile:a', merged);
    expect(questOpenFor).toHaveBeenCalledWith('profile:a', expect.any(Date), merged);
    expect(reconciled.homework.map((h) => h.questId)).toEqual(['quest:stage1-letters-q1']);
  });

  it('reconcile asks with the merged snapshot, so a quest finished on another device is kept (section 3.2)', async () => {
    await usePlanStore.getState().applyPlans('profile:a', [twoStage1]);
    const local = useProgressStore.getState().byProfile['profile:a']!;
    // Finished on another device: the union of the sync merge brings it in before the store holds it.
    const finishedElsewhere = {
      questId: 'quest:stage1-letters-q2',
      episodeId: 'episode:stage1-letters',
      startedAt: '2026-09-29T08:00:00.000Z',
      completedAt: '2026-09-29T08:05:00.000Z',
      stars: 3 as const,
      attempts: 1,
      accuracy: 1,
    };
    const merged = { ...local, quests: [...local.quests, finishedElsewhere] };
    vi.mocked(questOpenFor).mockClear();
    const reconciled = usePlanStore.getState().reconcile('profile:a', merged);
    expect(questOpenFor).toHaveBeenCalledWith('profile:a', expect.any(Date), merged);
    expect(reconciled.homework.find((h) => h.questId === 'quest:stage1-letters-q2')).toMatchObject({
      id: 'plan:w3#quest:stage1-letters-q2',
      completedAt: '2026-09-29T08:05:00.000Z',
    });
  });

  describe('with the real predicate and the switch on (web)', () => {
    const savedOs = process.env.EXPO_OS;
    beforeEach(() => {
      flags.contentGatingEnabled = true;
      process.env.EXPO_OS = 'web';
    });
    afterEach(() => {
      flags.contentGatingEnabled = false;
      if (savedOs === undefined) delete process.env.EXPO_OS;
      else process.env.EXPO_OS = savedOs;
    });

    it('a free learner keeps every Stage 1 item (all of Stage 1 is free, OD-1); a later stage waits', async () => {
      const mixed: InboxPlan = { ...twoStage1, items: [...twoStage1.items, { kind: 'quest', id: 'quest:stage2-life-q1', targetDate: '2026-09-30' }] };
      vi.mocked(questOpenFor).mockClear();
      const outcome = await usePlanStore.getState().applyPlans('profile:a', [mixed]);
      expect(outcome).toMatchObject({ added: 2, notReady: { 'plan:w3': 1 } });
      // With today's registry (free = all of Stage 1) the stage lock already holds the Stage 2 item back, so the
      // outcome alone cannot tell the two rules apart: check the real predicate deriveFor received agrees with it.
      const received = vi.mocked(questOpenFor).mock.results[0];
      expect(received?.type).toBe('return');
      const isOpen = received?.value as (questId: string) => boolean;
      expect(isOpen('quest:stage1-letters-q1')).toBe(true);
      expect(isOpen('quest:stage1-letters-q2')).toBe(true);
      expect(isOpen('quest:stage2-life-q1')).toBe(false);
    });

    it('a premium learner derives every item', async () => {
      useTierStore.setState({ byLearner: { 'profile:a': { tier: 'premium', source: null, validUntil: null, fetchedAt: 't' } } });
      const mixed: InboxPlan = { ...twoStage1, items: [...twoStage1.items, { kind: 'quest', id: 'quest:stage2-life-q1', targetDate: '2026-09-30' }] };
      expect(await usePlanStore.getState().applyPlans('profile:a', [mixed])).toMatchObject({ added: 3, notReady: {} });
    });
  });
});
