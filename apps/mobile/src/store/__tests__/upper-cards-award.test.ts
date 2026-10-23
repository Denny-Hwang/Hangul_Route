import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: vi.fn(() => () => undefined), isAppVisible: () => true }));
vi.mock('../../platform/sync-api', () => ({ apiBaseUrl: () => null }));

import { episodesAll } from '../../content/episodes';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../remote-config-store';
import { setUpperCardsSwitch, upperCardsOnFor } from '../upper-cards-switch';
import { wireUpperCards } from '../upper-cards-wiring';

/**
 * The upper-cell card award in the progress store (F-CURR-002 §4.8 step 7 and §12.2, row CM-23): a reconcile reads
 * `upperCards` for the learner; off, it adds no upper-cell card; on, it adds the cards of cells finished before the row
 * shipped, once. When the remote copy turns the switch on after launch, the wiring runs the reconcile then.
 */
const ID = 'profile:a';
const CREATED = '2026-09-01T08:00:00.000Z';
const AT = '2026-10-05T10:00:00.000Z';
const LETTERS = episodesAll.find((e) => e.id === 'episode:stage2-letters')!;

const snapshot = (): ProgressSnapshot => ({
  profileId: ID,
  updatedAt: AT,
  episodes: [],
  quests: LETTERS.questIds.map((questId) => ({ questId, episodeId: LETTERS.id, startedAt: AT, completedAt: AT, stars: 2, attempts: 1, accuracy: 1 })),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  questDoneAt: Object.fromEntries(LETTERS.questIds.map((q) => [q, AT])),
});
const held = (): string[] => (useProgressStore.getState().byProfile[ID]?.cards ?? []).map((c) => c.cardId);
const flags = (pct: number) => ({ v: 1 as const, fetchedAt: Date.now(), maxAgeS: 300, flags: { upperCards: { on: true, pct } } });

beforeEach(() => {
  mem.clear();
  resetRemoteConfigForTests();
  setUpperCardsSwitch(() => false);
  useProfileStore.setState({
    profiles: [{ id: ID, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: CREATED }],
    activeId: ID,
    hydrated: true,
  });
  useProgressStore.setState({ byProfile: { [ID]: snapshot() }, hydratedFor: new Set([ID]), pendingFor: new Set(), catchUp: {}, catchUpFound: {} });
});

describe('the upperCards switch in the store (row CM-23)', () => {
  it('reads off until a reader is registered', () => {
    setUpperCardsSwitch(() => true);
    expect(upperCardsOnFor(ID)).toBe(true);
    setUpperCardsSwitch(() => false);
    expect(upperCardsOnFor(ID)).toBe(false);
  });

  it('off: a reconcile adds no upper-cell card', () => {
    useProgressStore.getState().reconcileAwards(ID);
    expect(held()).not.toContain('card:norae');
  });

  it('on: a reconcile adds the card of a cell finished earlier, dated by its first finishes, once', () => {
    setUpperCardsSwitch((id) => id === ID);
    const added = useProgressStore.getState().reconcileAwards(ID);
    expect(added.map((a) => a.cardId)).toContain('card:norae');
    expect(useProgressStore.getState().byProfile[ID]?.cards.find((c) => c.cardId === 'card:norae')?.unlockedAt).toBe(AT);
    expect(useProgressStore.getState().reconcileAwards(ID)).toEqual([]);
    expect(held().filter((c) => c === 'card:norae')).toHaveLength(1);
  });

  it('turned off again: the held card stays', () => {
    setUpperCardsSwitch(() => true);
    useProgressStore.getState().reconcileAwards(ID);
    setUpperCardsSwitch(() => false);
    useProgressStore.getState().reconcileAwards(ID);
    expect(held()).toContain('card:norae');
  });
});

describe('wireUpperCards (App start)', () => {
  it('a remote copy that turns the switch on after launch brings the card then; pct 0 brings none', () => {
    const unwire = wireUpperCards();
    useRemoteConfigStore.setState({ cache: flags(0), hydrated: true });
    expect(held()).not.toContain('card:norae');
    useRemoteConfigStore.setState({ cache: flags(100) });
    expect(held()).toContain('card:norae');
    unwire();
  });

  it('after the unsubscribe, a new copy runs no reconcile', () => {
    const unwire = wireUpperCards();
    unwire();
    useRemoteConfigStore.setState({ cache: flags(100), hydrated: true });
    expect(held()).not.toContain('card:norae');
  });

  it('a change that leaves the copy as it was runs nothing', () => {
    const unwire = wireUpperCards();
    const spy = vi.spyOn(useProgressStore.getState(), 'reconcileAwards');
    useRemoteConfigStore.setState({ cache: null, hydrated: false });
    expect(spy).not.toHaveBeenCalled();
    unwire();
  });
});
