import { CATALOG, generateCurriculum, type CurriculumDraft } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));

import { dayKey } from '../../logic/homework/mission-builder';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../account-store';
import { usePlanStore } from '../plan-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { useRouteStore } from '../route-store';
import { useTierStore } from '../tier-store';

const NOW = new Date();
const TODAY = dayKey(NOW.toISOString());

function draftFrom(today: string): CurriculumDraft {
  return generateCurriculum(
    { audience: 'self', level: { stage: 'stage1', band: 0 }, startDate: today, weeks: 4, sessionsPerWeek: 3, minutesPerSession: 15, unlockedStages: ['stage1'] },
    CATALOG,
  );
}

beforeEach(() => {
  mem.clear();
  vi.mocked(track).mockClear();
  useRouteStore.setState({ ui: {} });
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', learnerType: 'self', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set() });
  useAccountStore.setState({ subscription: null });
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
});

describe('route-store: the plan prompt dismissal (AM-6, OD-16)', () => {
  it('reads nothing stored as not dismissed, and a malformed record the same way', async () => {
    expect(await useRouteStore.getState().loadUi('profile:a')).toEqual({});
    mem.set('route-ui:profile:a', { dismissedAt: 42 });
    useRouteStore.setState({ ui: {} });
    expect(await useRouteStore.getState().loadUi('profile:a')).toEqual({});
  });

  it('remembers Not now per profile in route-ui:<profileId>', async () => {
    await useRouteStore.getState().markDismissed('profile:a', '2026-10-12T09:00:00.000Z');
    expect(useRouteStore.getState().ui['profile:a']).toEqual({ dismissedAt: '2026-10-12T09:00:00.000Z' });
    expect(mem.get('route-ui:profile:a')).toEqual({ dismissedAt: '2026-10-12T09:00:00.000Z' });
    useRouteStore.setState({ ui: {} });
    expect(await useRouteStore.getState().loadUi('profile:a')).toEqual({ dismissedAt: '2026-10-12T09:00:00.000Z' });
  });

  it('a mark made while the read was in flight wins over storage', async () => {
    mem.set('route-ui:profile:a', { dismissedAt: '2026-10-01T00:00:00.000Z' });
    const reading = useRouteStore.getState().loadUi('profile:a');
    await useRouteStore.getState().markDismissed('profile:a', '2026-10-12T00:00:00.000Z');
    expect(await reading).toEqual({ dismissedAt: '2026-10-12T00:00:00.000Z' });
  });

  it('a failed write keeps the mark for the session', async () => {
    const storage = await import('../../platform/storage');
    vi.mocked(storage.writeJson).mockRejectedValueOnce(new Error('full'));
    await useRouteStore.getState().markDismissed('profile:a', '2026-10-12T00:00:00.000Z');
    expect(useRouteStore.getState().ui['profile:a']?.dismissedAt).toBe('2026-10-12T00:00:00.000Z');
  });
});

describe('route-store: create and archive (F-PLAN-002 section 3.9)', () => {
  it('create stores the route, derives the first week as homework and fires route.created', async () => {
    const draft = draftFrom(TODAY);
    const route = await useRouteStore.getState().create('profile:a', draft, { from: 'proposal', changed: false }, NOW);
    expect(route?.id).toMatch(/^route:[a-z0-9-]+$/);
    const snap = useProgressStore.getState().byProfile['profile:a'];
    expect(snap?.selfRoute).toEqual(route);
    const homework = snap?.homework ?? [];
    expect(homework.length).toBeGreaterThan(0);
    expect(homework.every((h) => h.id.startsWith(`${route?.id}#`) && h.assignedBy === 'system')).toBe(true);
    // Only the one-week horizon is derived (section 3.6 rule 1).
    expect(homework.length).toBeLessThan(draft.items.length);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: 'route.created', profileId: 'profile:a', payload: expect.objectContaining({ audience: 'self', from: 'proposal', changed: false }) }));
  });

  it('create returns null and stores nothing when the route would not parse', async () => {
    const draft = draftFrom(TODAY);
    const broken = { ...draft, weeks: [...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks, ...draft.weeks] };
    expect(await useRouteStore.getState().create('profile:a', broken, { from: 'proposal', changed: true }, NOW)).toBeNull();
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute ?? null).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('create never replaces an active plan: it returns null and keeps the first one (a plan stops only by archiving it)', async () => {
    const first = await useRouteStore.getState().create('profile:a', draftFrom(TODAY), { from: 'proposal', changed: false }, NOW);
    vi.mocked(track).mockClear();
    const later = new Date(NOW.getTime() + 1000);
    expect(await useRouteStore.getState().create('profile:a', draftFrom(TODAY), { from: 'setup', changed: true }, later)).toBeNull();
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute?.id).toBe(first?.id);
    expect(track).not.toHaveBeenCalled();
  });

  it('create replaces the active plan only when told which one (Change the plan); a stale id changes nothing', async () => {
    const first = await useRouteStore.getState().create('profile:a', draftFrom(TODAY), { from: 'proposal', changed: false }, NOW);
    vi.mocked(track).mockClear();
    const later = new Date(NOW.getTime() + 1000);
    expect(await useRouteStore.getState().create('profile:a', draftFrom(TODAY), { from: 'setup', changed: true, replacing: 'route:not-this-one' }, later)).toBeNull();
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute?.id).toBe(first?.id);
    const next = await useRouteStore.getState().create('profile:a', draftFrom(TODAY), { from: 'setup', changed: true, replacing: first?.id }, later);
    expect(next).not.toBeNull();
    expect(next?.id).not.toBe(first?.id);
    const snap = useProgressStore.getState().byProfile['profile:a'];
    expect(snap?.selfRoute?.id).toBe(next?.id);
    // The old plan's pending items leave; the new plan's first week is homework now.
    expect((snap?.homework ?? []).filter((h) => !h.completedAt).every((h) => h.id.startsWith(`${next?.id}#`))).toBe(true);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: 'route.created', payload: expect.objectContaining({ from: 'setup' }) }));
  });

  it('create works again once the active plan is archived', async () => {
    await useRouteStore.getState().create('profile:a', draftFrom(TODAY), { from: 'proposal', changed: false }, NOW);
    await useRouteStore.getState().archive('profile:a', NOW);
    const later = new Date(NOW.getTime() + 1000);
    const next = await useRouteStore.getState().create('profile:a', draftFrom(TODAY), { from: 'proposal', changed: false }, later);
    expect(next).not.toBeNull();
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute?.archivedAt).toBeNull();
  });

  it('archive stops the active plan: pending plan homework goes, history stays', async () => {
    const route = await useRouteStore.getState().create('profile:a', draftFrom(TODAY), { from: 'proposal', changed: false }, NOW);
    expect(await useRouteStore.getState().archive('profile:a', NOW)).toBe(true);
    const snap = useProgressStore.getState().byProfile['profile:a'];
    expect(snap?.selfRoute).toMatchObject({ id: route?.id, archivedAt: NOW.toISOString() });
    expect(snap?.homework.filter((h) => !h.completedAt)).toEqual([]);
    expect(await useRouteStore.getState().archive('profile:a', NOW)).toBe(false);
  });
});

describe('route-store: re-pace and the Hoya check-in (section 3.7, FP-B14)', () => {
  const DAY = 86_400_000;
  const plan = (startOffsetDays: number, weeks = 12): CurriculumDraft =>
    generateCurriculum(
      {
        audience: 'self',
        level: { stage: 'stage1', band: 0 },
        startDate: dayKey(new Date(NOW.getTime() + startOffsetDays * DAY).toISOString()),
        weeks,
        sessionsPerWeek: 3,
        minutesPerSession: 15,
        unlockedStages: ['stage1'],
      },
      CATALOG,
    );

  it('autoRepace moves a plan along once when past items wait, notes it for the overview and fires route.repaced', async () => {
    // A plan that started 10 days ago: its first-week items are past and pending.
    const created = await useRouteStore.getState().create('profile:a', plan(-10), { from: 'setup', changed: true }, new Date(NOW.getTime() - 10 * DAY));
    await usePlanStore.getState().rederive('profile:a');
    vi.mocked(track).mockClear();
    expect(await useRouteStore.getState().autoRepace('profile:a', NOW)).toBe(true);
    const route = useProgressStore.getState().byProfile['profile:a']?.selfRoute;
    expect(route?.id).toBe(created?.id);
    expect(route?.meta.repacedAt).toBe(NOW.toISOString());
    expect(useRouteStore.getState().ui['profile:a']?.movedAt).toBe(NOW.toISOString());
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: 'route.repaced', payload: expect.objectContaining({ mode: 'auto' }) }));
    // Once a day.
    expect(await useRouteStore.getState().autoRepace('profile:a', NOW)).toBe(false);
  });

  it('autoRepace does nothing without a plan, or while a session is open', async () => {
    expect(await useRouteStore.getState().autoRepace('profile:a', NOW)).toBe(false);
    await useRouteStore.getState().create('profile:a', plan(-10), { from: 'setup', changed: true }, new Date(NOW.getTime() - 10 * DAY));
    await usePlanStore.getState().rederive('profile:a');
    useProgressStore.setState({ openSession: { profileId: 'profile:a', sessionId: 's', owner: 'quest:x', streak: true } });
    expect(await useRouteStore.getState().autoRepace('profile:a', NOW)).toBe(false);
    useProgressStore.setState({ openSession: null });
  });

  it('repaceNow moves the plan along by hand (route.repaced manual); false without a plan', async () => {
    expect(await useRouteStore.getState().repaceNow('profile:a', NOW)).toBe(false);
    await useRouteStore.getState().create('profile:a', plan(-3), { from: 'setup', changed: true }, new Date(NOW.getTime() - 3 * DAY));
    vi.mocked(track).mockClear();
    expect(await useRouteStore.getState().repaceNow('profile:a', NOW)).toBe(true);
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute?.meta.repacedAt).toBe(NOW.toISOString());
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: 'route.repaced', payload: expect.objectContaining({ mode: 'manual' }) }));
  });

  it('answerCheckIn applies the new pace with yes, and either answer closes the check-in for this plan', async () => {
    const created = await useRouteStore.getState().create('profile:a', plan(-29), { from: 'setup', changed: true }, new Date(NOW.getTime() - 29 * DAY));
    expect(await useRouteStore.getState().answerCheckIn('profile:a', { kind: 'lighter', pace: 'gentle' }, NOW)).toBe(true);
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute?.meta.params.sessionsPerWeek).toBe(2);
    expect(useRouteStore.getState().ui['profile:a']?.checkInFor).toBe(created?.id);
    // Answered once for this plan: a second card (Home and the overview both drew it) changes nothing.
    const before = useProgressStore.getState().byProfile['profile:a']?.selfRoute;
    expect(await useRouteStore.getState().answerCheckIn('profile:a', { kind: 'faster', pace: 'steady' }, new Date(NOW.getTime() + 1000))).toBe(false);
    expect(await useRouteStore.getState().answerCheckIn('profile:a', null, NOW)).toBe(false);
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute).toEqual(before);
  });

  it('answerCheckIn: two answers that overlap (a fast double tap) apply once', async () => {
    await useRouteStore.getState().create('profile:a', plan(-29), { from: 'setup', changed: true }, new Date(NOW.getTime() - 29 * DAY));
    const offer = { kind: 'lighter', pace: 'gentle' } as const;
    const answers = await Promise.all([useRouteStore.getState().answerCheckIn('profile:a', offer, NOW), useRouteStore.getState().answerCheckIn('profile:a', offer, NOW)]);
    expect(answers.filter(Boolean)).toHaveLength(1);
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute?.meta.params.sessionsPerWeek).toBe(2);
  });

  it('answerCheckIn takes only the offer this plan has now: a card kept from another learner or plan changes nothing', async () => {
    // Week 2 of a plan: there is no check-in yet, so a kept offer (from another profile's card) is not applied.
    await useRouteStore.getState().create('profile:a', plan(-10), { from: 'setup', changed: true }, new Date(NOW.getTime() - 10 * DAY));
    const before = useProgressStore.getState().byProfile['profile:a']?.selfRoute;
    expect(await useRouteStore.getState().answerCheckIn('profile:a', { kind: 'lighter', pace: 'gentle' }, NOW)).toBe(false);
    expect(await useRouteStore.getState().answerCheckIn('profile:a', null, NOW)).toBe(false);
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute).toEqual(before);
    expect(useRouteStore.getState().ui['profile:a']?.checkInFor).toBeUndefined();
  });

  it('answerCheckIn in week 5 with nothing finished takes the lighter offer only, not a faster one', async () => {
    await useRouteStore.getState().create('profile:a', plan(-29), { from: 'setup', changed: true }, new Date(NOW.getTime() - 29 * DAY));
    const before = useProgressStore.getState().byProfile['profile:a']?.selfRoute;
    expect(await useRouteStore.getState().answerCheckIn('profile:a', { kind: 'faster', pace: 'steady' }, NOW)).toBe(false);
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute).toEqual(before);
    expect(useRouteStore.getState().ui['profile:a']?.checkInFor).toBeUndefined();
    expect(await useRouteStore.getState().answerCheckIn('profile:a', { kind: 'lighter', pace: 'gentle' }, NOW)).toBe(true);
  });

  it('repaceDue says whether the automatic re-pace would run, without changing the plan', async () => {
    expect(await useRouteStore.getState().repaceDue('profile:a', NOW)).toBe(false);
    await useRouteStore.getState().create('profile:a', plan(-10), { from: 'setup', changed: true }, new Date(NOW.getTime() - 10 * DAY));
    await usePlanStore.getState().rederive('profile:a');
    const before = useProgressStore.getState().byProfile['profile:a']?.selfRoute;
    expect(await useRouteStore.getState().repaceDue('profile:a', NOW)).toBe(true);
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute).toEqual(before);
    await useRouteStore.getState().autoRepace('profile:a', NOW);
    expect(await useRouteStore.getState().repaceDue('profile:a', NOW)).toBe(false);
  });

  it('a re-pace or a check-in that is not stored fires no event, leaves no moved line and is retried later', async () => {
    await useRouteStore.getState().create('profile:a', plan(-10), { from: 'setup', changed: true }, new Date(NOW.getTime() - 10 * DAY));
    await usePlanStore.getState().rederive('profile:a');
    vi.mocked(track).mockClear();
    const setSelfRoute = vi.spyOn(useProgressStore.getState(), 'setSelfRoute').mockReturnValue(false);
    try {
      expect(await useRouteStore.getState().autoRepace('profile:a', NOW)).toBe(false);
      expect(await useRouteStore.getState().repaceNow('profile:a', NOW)).toBe(false);
      expect(await useRouteStore.getState().answerCheckIn('profile:a', { kind: 'lighter', pace: 'gentle' }, NOW)).toBe(false);
    } finally {
      setSelfRoute.mockRestore();
    }
    expect(track).not.toHaveBeenCalled();
    expect(useRouteStore.getState().ui['profile:a']?.movedAt).toBeUndefined();
    expect(useRouteStore.getState().ui['profile:a']?.checkInFor).toBeUndefined();
    expect(await useRouteStore.getState().repaceDue('profile:a', NOW)).toBe(true);
  });

  it('a check-in yes that is not stored fires nothing and leaves the check-in open', async () => {
    await useRouteStore.getState().create('profile:a', plan(-29), { from: 'setup', changed: true }, new Date(NOW.getTime() - 29 * DAY));
    vi.mocked(track).mockClear();
    const setSelfRoute = vi.spyOn(useProgressStore.getState(), 'setSelfRoute').mockReturnValue(false);
    try {
      expect(await useRouteStore.getState().answerCheckIn('profile:a', { kind: 'lighter', pace: 'gentle' }, NOW)).toBe(false);
    } finally {
      setSelfRoute.mockRestore();
    }
    expect(track).not.toHaveBeenCalled();
    expect(useRouteStore.getState().ui['profile:a']?.checkInFor).toBeUndefined();
  });

  it('answerCheckIn is false without a plan; markMovedSeen remembers the line was seen', async () => {
    expect(await useRouteStore.getState().answerCheckIn('profile:a', null, NOW)).toBe(false);
    await useRouteStore.getState().markMovedSeen('profile:a', NOW.toISOString());
    expect(useRouteStore.getState().ui['profile:a']?.movedSeenAt).toBe(NOW.toISOString());
    expect(mem.get('route-ui:profile:a')).toEqual({ movedSeenAt: NOW.toISOString() });
  });
});

describe('route-store: marks keep what is stored', () => {
  it('a mark made before the record was read keeps the stored Not now', async () => {
    mem.set('route-ui:profile:a', { dismissedAt: '2026-10-01T00:00:00.000Z' });
    await useRouteStore.getState().markMovedSeen('profile:a', NOW.toISOString());
    expect(mem.get('route-ui:profile:a')).toEqual({ dismissedAt: '2026-10-01T00:00:00.000Z', movedSeenAt: NOW.toISOString() });
  });
});
