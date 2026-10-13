import { CATALOG, generateCurriculum, questsPlacedOutAtLevel, routeCatalogOf, type PlacementResult, type RouteProposal } from '@hangul-route/content-schema';
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
import { selfRouteOf } from '../../logic/route/self-route';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../account-store';
import { acceptPlanOffer, applyPlanUpdate, loadPlanOffer, planOfferNow, proposalContextFor } from '../plan-offer-store';
import { usePlanStore } from '../plan-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { useRouteStore } from '../route-store';
import { useTierStore } from '../tier-store';

const NOW = new Date();
const TODAY = dayKey(NOW.toISOString());
const PLACED_AT_BAND_2 = questsPlacedOutAtLevel({ stage: 'stage1', band: 2 }, routeCatalogOf(CATALOG));

function result(over: Partial<PlacementResult> = {}): PlacementResult {
  return {
    id: 'placement:a',
    completedAt: new Date(NOW.getTime() - 86_400_000).toISOString(),
    mode: 'standard',
    bankVersion: 1,
    testLocale: 'en',
    source: 'home',
    level: { stage: 'stage1', band: 0 },
    oralStage: null,
    strands: {},
    gates: [],
    priorityTokens: [],
    placedOutQuestIds: [],
    startQuestId: 'quest:stage1-letters-q1',
    responses: [],
    revealMode: 'tap',
    stopReason: 'complete',
    contentVer: 'test',
    ...over,
  } as unknown as PlacementResult;
}

function seedSnapshot(placements: PlacementResult[]): void {
  useProgressStore.setState({
    byProfile: {
      'profile:a': {
        profileId: 'profile:a',
        updatedAt: NOW.toISOString(),
        episodes: [],
        quests: [],
        cards: [],
        sessions: [],
        homework: [],
        reviews: [],
        streakDays: 0,
        placements,
      },
    },
    hydratedFor: new Set(['profile:a']),
    pendingFor: new Set(),
  });
}

beforeEach(() => {
  mem.clear();
  vi.mocked(track).mockClear();
  useRouteStore.setState({ ui: {} });
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useProfileStore.setState({
    profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', learnerType: 'self', createdAt: 't' }],
    activeId: 'profile:a',
    hydrated: true,
  });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set() });
  useAccountStore.setState({ subscription: null });
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
});

describe('proposalContextFor', () => {
  it('reads the snapshot, the profile level and the tier; null without a profile or a snapshot', () => {
    expect(proposalContextFor('profile:a', NOW)).toBeNull();
    seedSnapshot([result()]);
    const context = proposalContextFor('profile:a', NOW);
    expect(context).toMatchObject({ ageGroup: '8-9', completedQuestIds: [], today: TODAY });
    expect(context?.unlockedStages).toContain('stage1');
    expect(context?.placements).toHaveLength(1);
    expect(proposalContextFor('profile:none', NOW)).toBeNull();
  });
});

describe('loadPlanOffer', () => {
  it('null while the flag is off; a new offer after a check; hidden after Not now until the next result', async () => {
    seedSnapshot([result()]);
    expect(await loadPlanOffer('profile:a', false, NOW)).toBeNull();
    expect((await loadPlanOffer('profile:a', true, NOW))?.kind).toBe('new');
    mem.set('route-ui:profile:a', { dismissedAt: NOW.toISOString() });
    useRouteStore.setState({ ui: {} });
    expect(await loadPlanOffer('profile:a', true, NOW)).toBeNull();
  });

  it('null when the profile is gone', async () => {
    expect(await loadPlanOffer('profile:none', true, NOW)).toBeNull();
  });

  it('planOfferNow reads the dismissal already in memory, without storage', () => {
    seedSnapshot([result()]);
    expect(planOfferNow('profile:a', false, NOW)).toBeNull();
    expect(planOfferNow('profile:a', true, NOW)?.kind).toBe('new');
    useRouteStore.setState({ ui: { 'profile:a': { dismissedAt: NOW.toISOString() } } });
    expect(planOfferNow('profile:a', true, NOW)).toBeNull();
  });
});

describe('acceptPlanOffer (Use this plan, one tap, no PIN: OD-14)', () => {
  it('creates the plan exactly as shown and fires route.created with changed', async () => {
    seedSnapshot([result()]);
    const offer = await loadPlanOffer('profile:a', true, NOW);
    if (offer?.kind !== 'new' || offer.byPace.brisk === undefined) throw new Error('expected a new offer');
    const route = await acceptPlanOffer('profile:a', offer.byPace.brisk, { changed: true }, NOW);
    expect(route?.meta.params.sessionsPerWeek).toBe(4);
    expect(useProgressStore.getState().byProfile['profile:a']?.selfRoute?.id).toBe(route?.id);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: 'route.created', payload: expect.objectContaining({ from: 'proposal', changed: true }) }));
  });

  it('a picked length is kept; a draft that will not lay out stores nothing', async () => {
    seedSnapshot([result()]);
    const offer = await loadPlanOffer('profile:a', true, NOW);
    if (offer?.kind !== 'new' || offer.byPace.steady === undefined) throw new Error('expected a new offer');
    const broken = { ...offer.byPace.steady, params: { ...offer.byPace.steady.params, minutesPerSession: -1 } } as unknown as RouteProposal;
    expect(await acceptPlanOffer('profile:a', broken, { changed: false }, NOW)).toBeNull();
    const route = await acceptPlanOffer('profile:a', offer.byPace.steady, { changed: true, length: '6-month' }, NOW);
    expect(route?.meta.params.weeks).toBe(26);
  });
});

describe('applyPlanUpdate (Update my plan / Update the plan: AM-2)', () => {
  it('re-seeds the active plan after a retake that raised the start and fires route.updated', async () => {
    const draft = generateCurriculum(
      { audience: 'self', level: { stage: 'stage1', band: 0 }, startDate: TODAY, weeks: 12, sessionsPerWeek: 3, minutesPerSession: 15, unlockedStages: ['stage1'] },
      CATALOG,
    );
    const active = selfRouteOf(draft, 'route:abc-0001', new Date(NOW.getTime() - 3_600_000).toISOString());
    seedSnapshot([result(), result({ id: 'placement:b', completedAt: NOW.toISOString(), level: { stage: 'stage1', band: 2 }, placedOutQuestIds: PLACED_AT_BAND_2 })]);
    useProgressStore.getState().setSelfRoute('profile:a', active);
    expect((await loadPlanOffer('profile:a', true, NOW))?.kind).toBe('update');
    expect(await applyPlanUpdate('profile:a', NOW)).toBe(true);
    const stored = useProgressStore.getState().byProfile['profile:a']?.selfRoute;
    expect(stored?.id).toBe(active.id);
    expect(stored?.meta.params.level).toEqual({ stage: 'stage1', band: 2 });
    expect(stored?.meta.params.weeks).toBe(12);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: 'route.updated', profileId: 'profile:a', payload: expect.objectContaining({ source: 'retake' }) }));
    // Applied once: nothing more to update.
    expect(await loadPlanOffer('profile:a', true, NOW)).toBeNull();
    expect(await applyPlanUpdate('profile:a', NOW)).toBe(false);
  });

  it('false without a plan or a profile', async () => {
    seedSnapshot([result()]);
    expect(await applyPlanUpdate('profile:a', NOW)).toBe(false);
    expect(await applyPlanUpdate('profile:none', NOW)).toBe(false);
  });
});
