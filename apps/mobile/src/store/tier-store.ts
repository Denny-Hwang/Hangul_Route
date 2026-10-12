import type { ProgressSnapshot, SyncInbox, Tier, TierSource } from '@hangul-route/content-schema';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { bundleOs, flags, gatingActive } from '../config/flags';
import { questOpenPredicate } from '../logic/content-access';
import { entitlementTier } from '../logic/entitlement';
import { readJson, writeJson } from '../platform/storage';
import { useAccountStore } from './account-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * Cached premium per learner — F-ENT-001 §3.4. The server decides the tier
 * from memberships; the device honours it until `validUntil` when offline
 * (7-day grace), and the legacy family subscription still counts.
 */
export interface LearnerTier {
  tier: Tier;
  source: TierSource | null;
  validUntil: string | null;
  fetchedAt: string;
}

interface State {
  byLearner: Record<string, LearnerTier>;
  /**
   * Whether this device holds at least one space membership for the learner.
   * `membership-store` reports it on hydrate and on every change (it owns the
   * rows); `accessTier` reads it while no tier cache exists yet. In memory only.
   */
  spaceMembers: Record<string, boolean>;
}

interface Actions {
  hydrate: (learnerId: string) => Promise<LearnerTier | null>;
  applyInbox: (learnerId: string, inbox: Pick<SyncInbox, 'tier' | 'tierSource' | 'tierValidUntil' | 'serverTime'>) => LearnerTier;
  noteSpaces: (learnerId: string, count: number) => void;
}

const key = (learnerId: string): string => `tier:${learnerId}`;

export const useTierStore = create<State & Actions>((set, get) => ({
  byLearner: {},
  spaceMembers: {},

  hydrate: async (learnerId) => {
    const existing = get().byLearner[learnerId];
    if (existing) return existing;
    const saved = await readJson<LearnerTier>(key(learnerId));
    // An inbox that landed while the read was pending is newer than the saved copy.
    const arrived = get().byLearner[learnerId];
    if (arrived) return arrived;
    if (saved) set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: saved } }));
    return saved ?? null;
  },

  applyInbox: (learnerId, inbox) => {
    const next: LearnerTier = { tier: inbox.tier, source: inbox.tierSource ?? null, validUntil: inbox.tierValidUntil ?? null, fetchedAt: inbox.serverTime };
    set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: next } }));
    void writeJson(key(learnerId), next);
    return next;
  },

  noteSpaces: (learnerId, count) => {
    const member = count > 0;
    if (get().spaceMembers[learnerId] === member) return;
    set((s) => ({ spaceMembers: { ...s.spaceMembers, [learnerId]: member } }));
  },
}));

/** Pure: is a cached tier still good at `now`? */
export function cachedTierIsPremium(cached: LearnerTier | null | undefined, now: Date): boolean {
  if (!cached || cached.tier !== 'premium') return false;
  return !cached.validUntil || Date.parse(cached.validUntil) > now.getTime();
}

/** Premium through a space (cached inbox) or the legacy family subscription. Billing surfaces read this. */
export function effectiveTier(learnerId: string, now: Date): { tier: Tier; source: TierSource | null } {
  const cached = useTierStore.getState().byLearner[learnerId];
  if (cachedTierIsPremium(cached, now)) return { tier: 'premium', source: cached?.source ?? null };
  if (entitlementTier(useAccountStore.getState().subscription, now) === 'premium') return { tier: 'premium', source: null };
  return { tier: 'free', source: null };
}

/**
 * The tier that decides what a learner may open (F-ENT-003 section 3.4, OD-11).
 * Premium when `effectiveTier` is premium; or when the last word from the server
 * was premium, even past its `validUntil` (a paying family offline for more than
 * seven days keeps every lesson); or when the server has never answered for this
 * learner here and the device holds a space membership for them (fail open until
 * the first inbox). A free inbox closes at once. Billing keeps `effectiveTier`.
 */
export function accessTier(learnerId: string, now: Date): Tier {
  if (effectiveTier(learnerId, now).tier === 'premium') return 'premium';
  const { byLearner, spaceMembers } = useTierStore.getState();
  const cached = byLearner[learnerId];
  if (cached) return cached.tier;
  return spaceMembers[learnerId] === true ? 'premium' : 'free';
}

/**
 * "May this learner start this quest?" for store actions and any non-React
 * caller: the access tier, the effective switch and the learner's finished
 * quests (kept for good, from any device once synced). The finished quests
 * come from `snapshot` when given (plan reconcile passes the merged copy a sync
 * is about to save, which may hold a quest finished on another device), else
 * from the learner's snapshot in `progress-store`.
 */
export function questOpenFor(learnerId: string, now: Date, snapshot?: Pick<ProgressSnapshot, 'quests'>): (questId: string) => boolean {
  const quests = (snapshot ?? useProgressStore.getState().byProfile[learnerId])?.quests ?? [];
  return questOpenPredicate({
    tier: accessTier(learnerId, now),
    gatingEnabled: gatingActive(flags, bundleOs()),
    completedQuestIds: new Set(quests.filter((q) => q.completedAt).map((q) => q.questId)),
  });
}

/**
 * What decides the active learner's answer, the clock included (a legacy
 * subscription ends at its `expiresAt`): the learner, the access tier, the
 * effective switch and the finished quests. A snapshot write that finishes no
 * quest leaves it unchanged.
 */
function activeAccessKey(): { key: string; tier: Tier; gatingEnabled: boolean; kept: string[] } {
  const id = useProfileStore.getState().activeId ?? '';
  const tier = accessTier(id, new Date());
  const gatingEnabled = gatingActive(flags, bundleOs());
  const quests = useProgressStore.getState().byProfile[id]?.quests ?? [];
  const kept = [...new Set(quests.filter((q) => q.completedAt).map((q) => q.questId))].sort();
  return { key: JSON.stringify([id, tier, gatingEnabled, kept]), tier, gatingEnabled, kept };
}

let activeAccess: { key: string; open: (questId: string) => boolean } | null = null;

function activeQuestOpen(): (questId: string) => boolean {
  const { key: accessKey, tier, gatingEnabled, kept } = activeAccessKey();
  if (activeAccess?.key === accessKey) return activeAccess.open;
  // The same predicate `questOpenFor` builds, from the values the key holds.
  const open = questOpenPredicate({ tier, gatingEnabled, completedQuestIds: new Set(kept) });
  activeAccess = { key: accessKey, open };
  return open;
}

function subscribeAccess(onChange: () => void): () => void {
  const offs = [useProfileStore.subscribe(onChange), useTierStore.subscribe(onChange), useProgressStore.subscribe(onChange), useAccountStore.subscribe(onChange)];
  return () => {
    for (const off of offs) off();
  };
}

/**
 * `questOpenFor` for the active profile, as a React hook: re-reads when the
 * tier cache, the snapshot, the subscription or the profile list changes, and
 * keeps the same predicate while the answer cannot differ (same learner, access
 * tier, switch and finished quests).
 */
export function useQuestAccess(): (questId: string) => boolean {
  return useSyncExternalStore(subscribeAccess, activeQuestOpen, activeQuestOpen);
}

function subscribeTier(onChange: () => void): () => void {
  const offs = [useTierStore.subscribe(onChange), useAccountStore.subscribe(onChange)];
  return () => {
    for (const off of offs) off();
  };
}

/**
 * `accessTier` for one learner, as a React hook: the tier every learner-facing
 * access read uses (story locks, the cursor's stages, the level check's start
 * quest), re-read when the tier cache, the spaces or the subscription change.
 * Billing surfaces keep `effectiveTier` (F-ENT-003 section 3.4).
 */
export function useAccessTier(learnerId: string): Tier {
  const read = (): Tier => accessTier(learnerId, new Date());
  return useSyncExternalStore(subscribeTier, read, read);
}
