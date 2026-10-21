import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

import { bundleOs, flags, gatingActive } from '../../config/flags';
import { questsAll } from '../../content';
import { isContentLocked } from '../../logic/content-access';
import { getMessages } from '@hangul-route/i18n';
import { planCardView } from '../../logic/paywall';
import { readJson } from '../../platform/storage';
import { useAccountStore } from '../account-store';
import { unlockedStagesFor } from '../plan-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { accessTier, cachedTierIsPremium, effectiveTier, questOpenFor, useAccessTier, useQuestAccess, useTierStore, type LearnerTier } from '../tier-store';

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

  it('an inbox that lands while the saved copy is still being read wins over the older copy', async () => {
    const older: LearnerTier = { tier: 'premium', source, validUntil: '2026-09-28T12:00:00.000Z', fetchedAt: 'old' };
    let release: (value: unknown) => void = () => undefined;
    vi.mocked(readJson).mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const pending = useTierStore.getState().hydrate('profile:a');
    const fresh = useTierStore.getState().applyInbox('profile:a', { tier: 'free', tierSource: null, tierValidUntil: null, serverTime: 'new' });
    release(older);
    expect(await pending).toEqual(fresh);
    expect(useTierStore.getState().byLearner['profile:a']).toEqual(fresh);
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

  it('[SA] a renamed space replaces the covering name after one inbox, on the Plan screen and in the saved copy (AMENDMENTS-SEATS-ADMINS section 5.4)', async () => {
    const validUntil = '2026-09-28T12:00:00.000Z';
    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: validUntil, serverTime: 't1' });
    expect(effectiveTier('profile:a', now).source?.name).toBe('Sunday Class A');
    const renamed = { ...source, name: 'Room 3 Tigers' };
    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: renamed, tierValidUntil: validUntil, serverTime: 't2' });
    // The Plan screen's "covered by {space}" reads effectiveTier.
    expect(effectiveTier('profile:a', now)).toEqual({ tier: 'premium', source: renamed });
    expect(mem.get('tier:profile:a')).toMatchObject({ source: renamed });
    const covered = effectiveTier('profile:a', now);
    expect(planCardView(covered.tier, covered.source, getMessages('en').learner.profile.plan).note).toBe('Everything is open, from Room 3 Tigers.');
    // A restart reads the saved copy: the new name, never the old one.
    useTierStore.setState({ byLearner: {} });
    expect((await useTierStore.getState().hydrate('profile:a'))?.source).toEqual(renamed);
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

  it('useAccessTier answers accessTier for a learner and re-renders on the tier store and the subscription', () => {
    expect(useAccessTier('profile:a')).toBe('free');
    useTierStore.getState().noteSpaces('profile:a', 1);
    expect(useAccessTier('profile:a')).toBe('premium');
    // A stale premium past its validUntil still opens, as accessTier does.
    useTierStore.getState().applyInbox('profile:b', { tier: 'premium', tierSource: source, tierValidUntil: '2020-01-01T00:00:00.000Z', serverTime: 't' });
    expect(useAccessTier('profile:b')).toBe('premium');
    expect(hook.server?.()).toBe('premium');
    const onChange = vi.fn();
    const off = hook.subscribe!(onChange);
    useTierStore.getState().noteSpaces('profile:c', 1);
    useAccountStore.setState({ subscription: { status: 'active', plan: 'yearly', expiresAt: '2027-01-01T00:00:00.000Z' } });
    expect(onChange).toHaveBeenCalledTimes(2);
    off();
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

  it('web, switch on: a given snapshot adds its finished quests to the kept ones, so a merged copy keeps a quest finished on another device (F-ENT-003 E3-3)', () => {
    switchOn('web');
    const finished = (questId: string, episodeId: string) => ({ questId, episodeId, startedAt: at, completedAt: at, stars: 2 as const, attempts: 1, accuracy: 1 });
    useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith('profile:a', []) } });
    expect(questOpenFor('profile:a', now)('quest:stage2-life-q1')).toBe(false);
    const merged = snapshotWith('profile:a', [finished('quest:stage2-life-q1', 'episode:stage2-life')]);
    expect(questOpenFor('profile:a', now, merged)('quest:stage2-life-q1')).toBe(true);
    expect(questOpenFor('profile:a', now, merged)('quest:stage2-nature-q1')).toBe(false);
    // Kept is for good: a quest the store finished after the copy was taken stays open too.
    useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith('profile:a', [finished('quest:stage2-nature-q1', 'episode:stage2-nature')]) } });
    const both = questOpenFor('profile:a', now, merged);
    expect(both('quest:stage2-life-q1')).toBe(true);
    expect(both('quest:stage2-nature-q1')).toBe(true);
    expect(both('quest:stage4-rites-q1')).toBe(false);
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

  it('a snapshot write that finishes no quest keeps the same predicate; finishing one builds a new one', () => {
    switchOn('web');
    useProfileStore.setState({
      profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }],
      activeId: 'profile:a',
    });
    const done = { questId: 'quest:stage4-rites-q1', episodeId: 'episode:stage4-rites', startedAt: at, completedAt: at, stars: 3 as const, attempts: 1, accuracy: 1 };
    useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith('profile:a', [done]) } });
    const first = useQuestAccess();
    // A session, a started quest, the same finished quest again: nothing that decides access changed.
    useProgressStore.setState({
      byProfile: {
        'profile:a': {
          ...snapshotWith('profile:a', [{ questId: 'quest:stage2-life-q1', episodeId: 'episode:stage2-life', startedAt: at, stars: 0, attempts: 1, accuracy: 0 }, done, { ...done }]),
          sessions: [{ id: 's1', profileId: 'profile:a', startedAt: at, episodesTouched: [] }],
        },
      },
    });
    expect(useQuestAccess()).toBe(first);
    useProfileStore.setState({ profiles: [...useProfileStore.getState().profiles] });
    expect(useQuestAccess()).toBe(first);
    // Finishing a quest keeps it open: a new predicate.
    useProgressStore.setState({
      byProfile: { 'profile:a': snapshotWith('profile:a', [done, { ...done, questId: 'quest:stage2-life-q1', episodeId: 'episode:stage2-life' }]) },
    });
    const next = useQuestAccess();
    expect(next).not.toBe(first);
    expect(first('quest:stage2-life-q1')).toBe(false);
    expect(next('quest:stage2-life-q1')).toBe(true);
  });

  it('the predicate follows the clock: a legacy subscription that ends mid-session closes on the next read', () => {
    switchOn('web');
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-12-31T23:59:00.000Z'));
      useProfileStore.setState({
        profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }],
        activeId: 'profile:a',
      });
      useAccountStore.setState({ subscription: { status: 'active', plan: 'yearly', expiresAt: '2027-01-01T00:00:00.000Z' } });
      const before = useQuestAccess();
      expect(before('quest:stage2-life-q1')).toBe(true);
      // No store changed; only the time passed the subscription's end.
      vi.setSystemTime(new Date('2027-01-01T00:01:00.000Z'));
      const after = useQuestAccess();
      expect(after).not.toBe(before);
      expect(after('quest:stage2-life-q1')).toBe(false);
      expect(after('quest:stage1-letters-q1')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a stale-premium learner gets the same answer for a story and for a grid lesson (OD-11)', () => {
    switchOn('web');
    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    const tenDaysLater = new Date('2026-10-08T12:00:00.000Z');
    const storyLocked = isContentLocked({ kind: 'story', id: 'story:any-shelf-story', tier: accessTier('profile:a', tenDaysLater), gatingEnabled: gatingActive(flags, bundleOs()) });
    expect(storyLocked).toBe(false);
    expect(questOpenFor('profile:a', tenDaysLater)('quest:stage4-rites-q1')).toBe(true);
    // A free learner with the switch on: both close.
    expect(isContentLocked({ kind: 'story', id: 'story:any-shelf-story', tier: accessTier('profile:b', tenDaysLater), gatingEnabled: gatingActive(flags, bundleOs()) })).toBe(true);
    expect(questOpenFor('profile:b', tenDaysLater)('quest:stage4-rites-q1')).toBe(false);
  });

  it('learner-facing screens read the access tier; only billing surfaces read effectiveTier (F-ENT-003 section 3.4)', () => {
    const root = join(__dirname, '../..');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
    const files = [...walk(join(root, 'screens')), ...walk(join(root, 'components'))].filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'));
    const billing = files.filter((f) => /\beffectiveTier\(/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(root.length + 1).split('\\').join('/'));
    expect(billing.sort()).toEqual(['screens/paywall/PaywallScreen.tsx', 'screens/profile/ProfileScreen.tsx']);
  });

  it('with no active profile the hook answers for a learner with nothing kept and no tier', () => {
    switchOn('web');
    const open = useQuestAccess();
    expect(open('quest:stage1-letters-q1')).toBe(true);
    expect(open('quest:stage2-life-q1')).toBe(false);
  });
});
