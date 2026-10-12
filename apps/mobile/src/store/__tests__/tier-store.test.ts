import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The mobile vitest lane renders no components: the hook's one React call answers with the store snapshot.
const hook = vi.hoisted(() => ({ subscribe: null as null | ((onChange: () => void) => () => void), server: null as null | (() => unknown) }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useSyncExternalStore: <T,>(subscribe: (onChange: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T): T => {
      hook.subscribe = subscribe;
      hook.server = getServerSnapshot ?? null;
      return getSnapshot();
    },
  };
});

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

import { flags } from '../../config/flags';
import { questsAll } from '../../content';
import { useAccountStore } from '../account-store';
import { unlockedStagesFor } from '../plan-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { accessTier, cachedTierIsPremium, effectiveTier, questOpenFor, useQuestAccess, useTierStore } from '../tier-store';

const now = new Date('2026-09-21T12:00:00.000Z');
const source = { kind: 'class' as const, spaceId: 'space:c', name: 'Sunday Class A' };
const ALL_STAGES = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];

const snapshotWith = (profileId: string, quests: ProgressSnapshot['quests']): ProgressSnapshot => ({
  profileId,
  updatedAt: 't',
  episodes: [],
  quests,
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

beforeEach(() => {
  mem.clear();
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
  useAccountStore.setState({ subscription: null });
  useProgressStore.setState({ byProfile: {} });
  useProfileStore.setState({ profiles: [], activeId: null });
});

describe('tier-store (F-ENT-001 §3.4)', () => {
  it('caches the inbox tier with its grace window and persists it', async () => {
    const applied = useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    expect(applied).toEqual({ tier: 'premium', source, validUntil: '2026-09-28T12:00:00.000Z', fetchedAt: 't' });
    expect(mem.get('tier:profile:a')).toEqual(applied);
    useTierStore.setState({ byLearner: {} });
    expect(await useTierStore.getState().hydrate('profile:a')).toEqual(applied);
    expect(await useTierStore.getState().hydrate('profile:a')).toEqual(applied);
    expect(await useTierStore.getState().hydrate('profile:none')).toBeNull();
  });

  it('honours the cache until validUntil for billing, then falls back to the legacy subscription', () => {
    expect(cachedTierIsPremium(undefined, now)).toBe(false);
    expect(cachedTierIsPremium({ tier: 'free', source: null, validUntil: null, fetchedAt: 't' }, now)).toBe(false);
    expect(cachedTierIsPremium({ tier: 'premium', source, validUntil: '2026-09-22T00:00:00.000Z', fetchedAt: 't' }, now)).toBe(true);
    expect(cachedTierIsPremium({ tier: 'premium', source, validUntil: '2026-09-20T00:00:00.000Z', fetchedAt: 't' }, now)).toBe(false);
    expect(cachedTierIsPremium({ tier: 'premium', source, validUntil: null, fetchedAt: 't' }, now)).toBe(true);

    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    expect(effectiveTier('profile:a', now)).toEqual({ tier: 'premium', source });
    expect(effectiveTier('profile:a', new Date('2026-10-01T00:00:00.000Z'))).toEqual({ tier: 'free', source: null });

    useAccountStore.setState({ subscription: { status: 'active', plan: 'monthly', expiresAt: '2027-01-01T00:00:00.000Z' } });
    expect(effectiveTier('profile:b', now)).toEqual({ tier: 'premium', source: null });
  });
});

describe('accessTier (F-ENT-003 section 3.4, OD-11)', () => {
  const later = new Date('2026-10-01T00:00:00.000Z');

  it('a valid cached premium is premium', () => {
    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    expect(accessTier('profile:a', now)).toBe('premium');
  });

  it('stale premium counts for access: the last word from the server was premium', () => {
    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    expect(effectiveTier('profile:a', later).tier).toBe('free');
    expect(accessTier('profile:a', later)).toBe('premium');
  });

  it('a free inbox closes, even for a learner with a membership', () => {
    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    useTierStore.getState().noteSpaces('profile:a', 1);
    useTierStore.getState().applyInbox('profile:a', { tier: 'free', tierSource: null, tierValidUntil: null, serverTime: 't2' });
    expect(accessTier('profile:a', now)).toBe('free');
  });

  it('the legacy subscription opens', () => {
    useAccountStore.setState({ subscription: { status: 'active', plan: 'yearly', expiresAt: '2027-01-01T00:00:00.000Z' } });
    expect(accessTier('profile:a', now)).toBe('premium');
    useTierStore.getState().applyInbox('profile:a', { tier: 'free', tierSource: null, tierValidUntil: null, serverTime: 't' });
    expect(accessTier('profile:a', now)).toBe('premium');
  });

  it('a membership with no tier cache yet fails open until the server answers', () => {
    useTierStore.getState().noteSpaces('profile:a', 1);
    expect(accessTier('profile:a', now)).toBe('premium');
  });

  it('no membership and no cache is free', () => {
    expect(accessTier('profile:a', now)).toBe('free');
    useTierStore.getState().noteSpaces('profile:a', 1);
    useTierStore.getState().noteSpaces('profile:a', 0);
    expect(accessTier('profile:a', now)).toBe('free');
  });

  it('unlockedStagesFor reads the access tier, so stage and quest access come from the same tier', () => {
    expect(unlockedStagesFor(now, 'profile:a')).toEqual(['stage1']);
    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    expect(unlockedStagesFor(now, 'profile:a')).toEqual(ALL_STAGES);
    // Ten days offline: billing says free, access keeps every stage open.
    expect(unlockedStagesFor(later, 'profile:a')).toEqual(ALL_STAGES);
    useTierStore.getState().noteSpaces('profile:b', 1);
    expect(unlockedStagesFor(now, 'profile:b')).toEqual(ALL_STAGES);
    useTierStore.getState().applyInbox('profile:a', { tier: 'free', tierSource: null, tierValidUntil: null, serverTime: 't2' });
    expect(unlockedStagesFor(later, 'profile:a')).toEqual(['stage1']);
  });
});

describe('questOpenFor and useQuestAccess (F-ENT-003 section 3.4)', () => {
  const at = '2026-09-20T09:00:00.000Z';
  const savedOs = process.env.EXPO_OS;
  const switchOn = (os: string): void => {
    flags.contentGatingEnabled = true;
    process.env.EXPO_OS = os;
  };

  afterEach(() => {
    flags.contentGatingEnabled = false;
    if (savedOs === undefined) delete process.env.EXPO_OS;
    else process.env.EXPO_OS = savedOs;
  });

  it('with the switch off every quest is open for a free learner', () => {
    const open = questOpenFor('profile:a', now);
    for (const q of questsAll) expect(open(q.id), q.id).toBe(true);
  });

  it('a native build with the switch set behaves as switch off', () => {
    switchOn('ios');
    expect(questOpenFor('profile:a', now)('quest:stage2-life-q1')).toBe(true);
    switchOn('android');
    expect(questOpenFor('profile:a', now)('quest:stage2-life-q1')).toBe(true);
  });

  it('web, switch on: all of Stage 1 and kept quests open for a free learner; a started quest is not kept', () => {
    switchOn('web');
    useProgressStore.setState({
      byProfile: {
        'profile:a': snapshotWith('profile:a', [
          { questId: 'quest:stage2-life-q1', episodeId: 'episode:stage2-life', startedAt: at, completedAt: at, stars: 2, attempts: 1, accuracy: 1 },
          { questId: 'quest:stage2-nature-q1', episodeId: 'episode:stage2-nature', startedAt: at, stars: 0, attempts: 1, accuracy: 0 },
        ]),
      },
    });
    const open = questOpenFor('profile:a', now);
    expect(open('quest:stage1-letters-q1')).toBe(true);
    expect(open('quest:stage1-crafts-q1')).toBe(true);
    expect(open('quest:stage2-life-q1')).toBe(true);
    expect(open('quest:stage2-nature-q1')).toBe(false);
    expect(open('quest:stage4-rites-q1')).toBe(false);
    // Another learner's finished quest is not kept for this one.
    expect(questOpenFor('profile:b', now)('quest:stage2-life-q1')).toBe(false);
  });

  it('web, switch on: the access tier opens everything (stale premium, membership with no cache)', () => {
    switchOn('web');
    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    expect(questOpenFor('profile:a', new Date('2026-10-05T00:00:00.000Z'))('quest:stage4-rites-q1')).toBe(true);
    useTierStore.getState().noteSpaces('profile:b', 1);
    expect(questOpenFor('profile:b', now)('quest:stage4-rites-q1')).toBe(true);
  });

  it("the hook's predicate equals questOpenFor for the active profile", () => {
    switchOn('web');
    useProfileStore.setState({
      profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }],
      activeId: 'profile:a',
    });
    useProgressStore.setState({
      byProfile: { 'profile:a': snapshotWith('profile:a', [{ questId: 'quest:stage4-rites-q1', episodeId: 'episode:stage4-rites', startedAt: at, completedAt: at, stars: 3, attempts: 1, accuracy: 1 }]) },
    });
    const fromHook = useQuestAccess();
    const direct = questOpenFor('profile:a', new Date());
    for (const q of questsAll) expect(fromHook(q.id), q.id).toBe(direct(q.id));
    expect(fromHook('quest:stage4-rites-q1')).toBe(true);
    expect(fromHook('quest:stage2-life-q1')).toBe(false);
    // Nothing changed: the same predicate comes back, from the server snapshot too.
    expect(useQuestAccess()).toBe(fromHook);
    expect(hook.server?.()).toBe(fromHook);

    // The predicate follows the stores: a premium inbox opens everything on the next render.
    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: null, serverTime: 't' });
    const after = useQuestAccess();
    expect(after).not.toBe(fromHook);
    expect(after('quest:stage2-life-q1')).toBe(true);
  });

  it('the hook re-renders when the tier cache, the snapshot, the subscription or the profile list changes', () => {
    useQuestAccess();
    const onChange = vi.fn();
    const off = hook.subscribe!(onChange);
    useTierStore.getState().noteSpaces('profile:a', 1);
    useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith('profile:a', []) } });
    useAccountStore.setState({ subscription: { status: 'active', plan: 'yearly', expiresAt: '2027-01-01T00:00:00.000Z' } });
    useProfileStore.setState({ activeId: 'profile:a' });
    expect(onChange).toHaveBeenCalledTimes(4);
    off();
    useTierStore.getState().noteSpaces('profile:a', 0);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('with no active profile the hook answers for a learner with nothing kept and no tier', () => {
    switchOn('web');
    const open = useQuestAccess();
    expect(open('quest:stage1-letters-q1')).toBe(true);
    expect(open('quest:stage2-life-q1')).toBe(false);
  });
});
