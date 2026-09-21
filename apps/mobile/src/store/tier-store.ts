import type { SyncInbox, Tier, TierSource } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { entitlementTier } from '../logic/entitlement';
import { readJson, writeJson } from '../platform/storage';
import { useAccountStore } from './account-store';

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
}

interface Actions {
  hydrate: (learnerId: string) => Promise<LearnerTier | null>;
  applyInbox: (learnerId: string, inbox: Pick<SyncInbox, 'tier' | 'tierSource' | 'tierValidUntil' | 'serverTime'>) => LearnerTier;
}

const key = (learnerId: string): string => `tier:${learnerId}`;

export const useTierStore = create<State & Actions>((set, get) => ({
  byLearner: {},

  hydrate: async (learnerId) => {
    const existing = get().byLearner[learnerId];
    if (existing) return existing;
    const saved = await readJson<LearnerTier>(key(learnerId));
    if (saved) set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: saved } }));
    return saved ?? null;
  },

  applyInbox: (learnerId, inbox) => {
    const next: LearnerTier = { tier: inbox.tier, source: inbox.tierSource ?? null, validUntil: inbox.tierValidUntil ?? null, fetchedAt: inbox.serverTime };
    set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: next } }));
    void writeJson(key(learnerId), next);
    return next;
  },
}));

/** Pure: is a cached tier still good at `now`? */
export function cachedTierIsPremium(cached: LearnerTier | null | undefined, now: Date): boolean {
  if (!cached || cached.tier !== 'premium') return false;
  return !cached.validUntil || Date.parse(cached.validUntil) > now.getTime();
}

/** Premium through a space (cached inbox) or the legacy family subscription. */
export function effectiveTier(learnerId: string, now: Date): { tier: Tier; source: TierSource | null } {
  const cached = useTierStore.getState().byLearner[learnerId];
  if (cachedTierIsPremium(cached, now)) return { tier: 'premium', source: cached?.source ?? null };
  if (entitlementTier(useAccountStore.getState().subscription, now) === 'premium') return { tier: 'premium', source: null };
  return { tier: 'free', source: null };
}
