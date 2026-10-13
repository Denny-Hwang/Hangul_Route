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
