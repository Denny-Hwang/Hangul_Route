import type { InboxPlan } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { episodesAll, questsAll, stages } from '../content';
import { entitlementTier, isStageEntitled } from '../logic/entitlement';
import { dayKey } from '../logic/homework/mission-builder';
import { deriveAssignments } from '../logic/homework/plan-derivation';
import { readJson, writeJson } from '../platform/storage';
import { useAccountStore } from './account-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * Plans received for each learner — F-PLAN-001 §3.3. Applying the inbox
 * derives homework into the progress snapshot; `notReady` feeds the summary.
 */
interface State {
  byLearner: Record<string, InboxPlan[]>;
  notReady: Record<string, Record<string, number>>;
}

export interface ApplyOutcome {
  changed: boolean;
  added: number;
  notReady: Record<string, number>;
}

interface Actions {
  hydrate: (learnerId: string) => Promise<InboxPlan[]>;
  applyPlans: (learnerId: string, plans: InboxPlan[]) => Promise<ApplyOutcome>;
}

const key = (learnerId: string): string => `plans:${learnerId}`;

export function unlockedStagesFor(now: Date): string[] {
  const tier = entitlementTier(useAccountStore.getState().subscription, now);
  return stages.filter((s) => isStageEntitled(s.key, tier)).map((s) => s.key);
}

export const usePlanStore = create<State & Actions>((set, get) => ({
  byLearner: {},
  notReady: {},

  hydrate: async (learnerId) => {
    const existing = get().byLearner[learnerId];
    if (existing) return existing;
    const saved = (await readJson<InboxPlan[]>(key(learnerId))) ?? [];
    set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: saved } }));
    return saved;
  },

  applyPlans: async (learnerId, plans) => {
    set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: plans } }));
    void writeJson(key(learnerId), plans);
    const progress = useProgressStore.getState();
    await progress.hydrate(learnerId);
    const snapshot = progress.ensure(learnerId);
    const now = new Date();
    const profile = useProfileStore.getState().profiles.find((p) => p.id === learnerId);
    const result = deriveAssignments({
      plans,
      snapshot,
      profileId: learnerId,
      quests: questsAll,
      episodes: episodesAll,
      unlockedStages: unlockedStagesFor(now),
      today: dayKey(now.toISOString()),
      learnerName: profile?.displayName ?? 'Your learner',
    });
    set((s) => ({ notReady: { ...s.notReady, [learnerId]: result.notReady } }));
    if (result.changed) {
      useProgressStore.getState().replaceSnapshot(learnerId, { ...snapshot, homework: result.homework, updatedAt: now.toISOString() });
    }
    return { changed: result.changed, added: result.added, notReady: result.notReady };
  },
}));
