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
import { acceptPlanOffer, applyPlanUpdate, keepPlan, loadPlanOffer, planOfferNow, proposalContextFor } from '../plan-offer-store';
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

/** A plan made before any change, at band 0 (or with the given placed-out set). */
function planAt(level: { stage: 'stage1'; band: 0 | 2 }, placedOutQuestIds?: string[]) {
  const draft = generateCurriculum(
    {
      audience: 'self',
      level,
      ...(placedOutQuestIds === undefined ? {} : { placedOutQuestIds }),
      startDate: TODAY,
      weeks: 12,
      sessionsPerWeek: 3,
      minutesPerSession: 15,
      unlockedStages: ['stage1'],
    },
    CATALOG,
  );
  return selfRouteOf(draft, 'route:abc-0003', new Date(NOW.getTime() - 3_600_000).toISOString());
}

const futureIds = (items: readonly { id: string; targetDate?: string | undefined }[] | undefined): string[] =>
  (items ?? []).filter((item) => (item.targetDate ?? '') >= TODAY).map((item) => item.id);

describe('the update after a grown-up override, Keep my plan, the report surface (AM-1, AM-2, AM-6, AM-7)', () => {
  it('an override that put quests back: the future regains them and route.updated { source: override } counts what was stored', async () => {
    const active = planAt({ stage: 'stage1', band: 2 }, PLACED_AT_BAND_2);
    const at = new Date(NOW.getTime() - 60_000).toISOString();
    seedSnapshot([
      result({ level: { stage: 'stage1', band: 2 }, placedOutQuestIds: PLACED_AT_BAND_2, override: { by: 'parent', at, startQuestId: 'quest:stage1-letters-q1' } } as Partial<PlacementResult>),
    ]);
    useProgressStore.getState().setSelfRoute('profile:a', active);
    const offer = await loadPlanOffer('profile:a', true, NOW, 'report');
    if (offer?.kind !== 'update') throw new Error('expected an update');
    expect(offer.source).toBe('override');
    expect(await applyPlanUpdate('profile:a', NOW, 'report')).toBe(true);
    const stored = useProgressStore.getState().byProfile['profile:a']?.selfRoute;
    const before = new Set(futureIds(active.items));
    const after = futureIds(stored?.items);
    const added = after.filter((id) => !before.has(id)).length;
    const removed = [...before].filter((id) => !after.includes(id)).length;
    expect(added).toBeGreaterThan(0);
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'route.updated', payload: { source: 'override', itemsRemoved: offer.proposal.diff?.itemsRemoved ?? 0, itemsAdded: offer.proposal.diff?.itemsAdded ?? 0 } }),
    );
    // The counts sent are the counts of the plan stored.
    expect(offer.proposal.diff?.itemsAdded).toBe(added);
    expect(offer.proposal.diff?.itemsRemoved).toBe(removed);
  });

  it('Keep my plan (or the report Not now) hides the update until the start changes again, on both surfaces', async () => {
    seedSnapshot([result(), result({ id: 'placement:b', completedAt: NOW.toISOString(), level: { stage: 'stage1', band: 2 }, placedOutQuestIds: PLACED_AT_BAND_2 })]);
    useProgressStore.getState().setSelfRoute('profile:a', planAt({ stage: 'stage1', band: 0 }));
    expect((await loadPlanOffer('profile:a', true, NOW, 'report'))?.kind).toBe('update');
    await keepPlan('profile:a');
    expect(await loadPlanOffer('profile:a', true, NOW)).toBeNull();
    expect(await loadPlanOffer('profile:a', true, NOW, 'report')).toBeNull();
    expect(await applyPlanUpdate('profile:a', NOW)).toBe(false);
    expect(mem.get('route-ui:profile:a')).toMatchObject({ keptFor: NOW.toISOString() });
  });

  it('keepPlan without a result stores nothing', async () => {
    seedSnapshot([]);
    await keepPlan('profile:a');
    expect(mem.get('route-ui:profile:a')).toBeUndefined();
  });

  it("the learner's Just start never hides the report card; the report's Not now hides only the report card", async () => {
    seedSnapshot([result()]);
    await useRouteStore.getState().markDismissed('profile:a', NOW.toISOString());
    expect(await loadPlanOffer('profile:a', true, NOW)).toBeNull();
    expect((await loadPlanOffer('profile:a', true, NOW, 'report'))?.kind).toBe('new');
    useRouteStore.setState({ ui: {} });
    mem.clear();
    await useRouteStore.getState().markReportDismissed('profile:a', NOW.toISOString());
    expect(await loadPlanOffer('profile:a', true, NOW, 'report')).toBeNull();
    expect((await loadPlanOffer('profile:a', true, NOW))?.kind).toBe('new');
  });
});
