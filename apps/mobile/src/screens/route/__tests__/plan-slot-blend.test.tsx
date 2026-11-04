import type { InboxPlan, Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
// The switch as BL-10 will set it: the blend pieces on, and the weekly plan words open in this locale.
vi.mock('../../../config/flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/flags')>();
  return { ...actual, flags: { ...actual.flags, routeBlendEnabled: true }, routeEnabledFor: () => true };
});

import { selfRoute } from '../../../logic/homework/__tests__/curriculum-fixture';
import { OWN_PLAN_BACK_FRESH_MS } from '../../../logic/route/layer';
import { track } from '../../../platform/telemetry';
import { usePlanStore } from '../../../store/plan-store';
import { useRouteStore } from '../../../store/route-store';
import { byTestId, cleanup, press, render } from '../../../test-support/render';
import { PlanSlotCard, usePlanSlot } from '../PlanPromptCard';

/**
 * Home's plan slot with the class plan with practice days (AMENDMENTS-ROUTE-CLASS-BLEND section 8, row BL-7), on the
 * real route store: "Your own weekly plan is back." stays drawn for the visit after drawing marks it seen, a resume
 * long past never surfaces, and Not now on the class-plan line hides it without counting a proposal skip.
 */

const PROFILE = { id: 'profile:a', displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', learnerType: 'self', createdAt: 't' } as unknown as Profile;
const SNAPSHOT = { quests: [], placements: [], homework: [], selfRoute: selfRoute() } as unknown as ProgressSnapshot;
const PLANS: InboxPlan[] = [];

function Slot(): ReactElement | null {
  const { slot, closeCheckIn } = usePlanSlot(PROFILE, SNAPSHOT, PLANS);
  if (slot === null) return null;
  return <PlanSlotCard slot={slot} profileId={PROFILE.id} onOpen={() => undefined} onOverview={() => undefined} onCloseCheckIn={closeCheckIn} />;
}

beforeEach(() => {
  mem.clear();
  vi.mocked(track).mockClear();
  useRouteStore.setState({ ui: {} });
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  usePlanStore.setState({ hydrate: async () => [] });
});

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

describe('the own plan back line on Home', () => {
  it('is still drawn after drawing it marks it seen, and the store says it was seen', async () => {
    const backAt = new Date(Date.now() - 60_000).toISOString();
    useRouteStore.setState({ ui: { [PROFILE.id]: { backAt, checkInFor: 'route:mine' } } });
    const r = await render(<Slot />);
    expect(byTestId(r.root, 'home-plan-back')).toHaveLength(1);
    const seen = useRouteStore.getState().ui[PROFILE.id]?.backSeenAt;
    expect(seen).toBeDefined();
    expect(seen! >= backAt).toBe(true);
    // Still there in the same visit: the line is kept for the visit, not read live.
    expect(byTestId(r.root, 'home-plan-back')).toHaveLength(1);
  });

  it('is gone on the next visit once seen', async () => {
    const backAt = new Date(Date.now() - 60_000).toISOString();
    useRouteStore.setState({ ui: { [PROFILE.id]: { backAt, backSeenAt: new Date().toISOString(), checkInFor: 'route:mine' } } });
    const r = await render(<Slot />);
    expect(byTestId(r.root, 'home-plan-back')).toHaveLength(0);
  });

  it('never shows for a resume older than 7 days (written while the switch was off)', async () => {
    const backAt = new Date(Date.now() - OWN_PLAN_BACK_FRESH_MS - 60_000).toISOString();
    useRouteStore.setState({ ui: { [PROFILE.id]: { backAt, checkInFor: 'route:mine' } } });
    const r = await render(<Slot />);
    expect(byTestId(r.root, 'home-plan-back')).toHaveLength(0);
  });
});

describe('Not now on the class-plan line', () => {
  it('hides the line (dismissal stored) and sends no route.proposal_skipped', async () => {
    useRouteStore.setState({ ui: { [PROFILE.id]: {} } });
    const r = await render(<PlanSlotCard slot={{ kind: 'instead' }} profileId={PROFILE.id} onOpen={() => undefined} onOverview={() => undefined} onCloseCheckIn={() => undefined} />);
    const [notNow] = byTestId(r.root, 'home-plan-instead-not-now');
    expect(notNow).toBeDefined();
    await press(notNow!);
    expect(useRouteStore.getState().ui[PROFILE.id]?.dismissedAt).toBeDefined();
    expect(vi.mocked(track)).not.toHaveBeenCalled();
  });

  it('the proposal prompt Not now still counts its skip', async () => {
    useRouteStore.setState({ ui: { [PROFILE.id]: {} } });
    const r = await render(<PlanSlotCard slot={{ kind: 'prompt' }} profileId={PROFILE.id} onOpen={() => undefined} onOverview={() => undefined} onCloseCheckIn={() => undefined} />);
    await press(byTestId(r.root, 'home-plan-prompt-not-now')[0]!);
    expect(vi.mocked(track)).toHaveBeenCalledWith(expect.objectContaining({ name: 'route.proposal_skipped' }));
  });
});
