import type { InboxPlan, ProgressSnapshot } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { episodesAll, questsAll, stages } from '../content';
import { isStageEntitled } from '../logic/entitlement';
import { dayKey } from '../logic/homework/mission-builder';
import { deriveAssignments, planIdOf, sourcesOf, type DeriveResult } from '../logic/homework/plan-derivation';
import { readJson, writeJson } from '../platform/storage';
import { accessTier, questOpenFor } from './tier-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * Plans received for each learner — F-PLAN-001 §3.3. Applying the inbox
 * derives homework into the progress snapshot (with the active self-route,
 * F-PLAN-002 section 3.6); `notReady` feeds the summary. The horizon moves
 * with the calendar, not only with the network: `rederive` runs the same
 * derivation from the cached plans (app start, back in the foreground, an
 * inbox call that could not run), and `reconcile` applies it to a snapshot a
 * sync merge just produced, so a pending item the plan dropped never comes
 * back from another copy.
 */
interface State {
  byLearner: Record<string, InboxPlan[]>;
  notReady: Record<string, Record<string, number>>;
}

export interface ApplyOutcome {
  changed: boolean;
  added: number;
  removed: number;
  redated: number;
  notReady: Record<string, number>;
}

interface Actions {
  hydrate: (learnerId: string) => Promise<InboxPlan[]>;
  applyPlans: (learnerId: string, plans: InboxPlan[]) => Promise<ApplyOutcome>;
  /** Derive again from the cached plans, with no network; null when the device cannot tell what its plans are. */
  rederive: (learnerId: string) => Promise<ApplyOutcome | null>;
  /** The snapshot with its derived homework reconciled against the plans in memory (pure, no write). */
  reconcile: (learnerId: string, snapshot: ProgressSnapshot) => ProgressSnapshot;
}

const key = (learnerId: string): string => `plans:${learnerId}`;

/** The stages a plan may derive from, by the access tier, so stage and quest access agree (F-ENT-003 section 3.4). */
export function unlockedStagesFor(now: Date, learnerId: string): string[] {
  const tier = accessTier(learnerId, now);
  return stages.filter((s) => isStageEntitled(s.key, tier)).map((s) => s.key);
}

function deriveFor(learnerId: string, plans: readonly InboxPlan[], snapshot: ProgressSnapshot, now: Date): DeriveResult {
  const profile = useProfileStore.getState().profiles.find((p) => p.id === learnerId);
  // The learner's own weekly plan rides along as a source of kind `self` (F-PLAN-002 section 3.6).
  return deriveAssignments({
    sources: sourcesOf(plans, snapshot.selfRoute),
    snapshot,
    profileId: learnerId,
    quests: questsAll,
    episodes: episodesAll,
    unlockedStages: unlockedStagesFor(now, learnerId),
    today: dayKey(now.toISOString()),
    learnerName: profile?.displayName ?? 'Your learner',
    // The same access tier as the stages above, plus the switch and the kept quests (F-ENT-003 section 3.6).
    isQuestOpen: questOpenFor(learnerId, now),
  });
}

/** Pending plan homework with no cached plan to check it against: leave it for the next inbox. */
const holdsUncheckablePlanHomework = (snapshot: ProgressSnapshot): boolean =>
  snapshot.homework.some((h) => !h.completedAt && planIdOf(h.id) !== null);

export const usePlanStore = create<State & Actions>((set, get) => {
  const derive = async (learnerId: string, plans: readonly InboxPlan[]): Promise<ApplyOutcome> => {
    const progress = useProgressStore.getState();
    await progress.hydrate(learnerId);
    const snapshot = progress.ensure(learnerId);
    const now = new Date();
    const result = deriveFor(learnerId, plans, snapshot, now);
    set((s) => ({ notReady: { ...s.notReady, [learnerId]: result.notReady } }));
    if (result.changed) {
      useProgressStore.getState().replaceSnapshot(learnerId, { ...snapshot, homework: result.homework, updatedAt: now.toISOString() });
    }
    return { changed: result.changed, added: result.added, removed: result.removed, redated: result.redated, notReady: result.notReady };
  };

  return {
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
      return derive(learnerId, plans);
    },

    rederive: async (learnerId) => {
      const inMemory = get().byLearner[learnerId];
      const cached = inMemory ?? (await readJson<InboxPlan[]>(key(learnerId)));
      if (cached === null) {
        // Never received an inbox here: only the self-route (if any) is known.
        await useProgressStore.getState().hydrate(learnerId);
        if (holdsUncheckablePlanHomework(useProgressStore.getState().ensure(learnerId))) return null;
      } else if (!inMemory) {
        set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: cached } }));
      }
      return derive(learnerId, cached ?? []);
    },

    reconcile: (learnerId, snapshot) => {
      const plans = get().byLearner[learnerId];
      if (!plans && holdsUncheckablePlanHomework(snapshot)) return snapshot;
      const result = deriveFor(learnerId, plans ?? [], snapshot, new Date());
      return result.changed ? { ...snapshot, homework: result.homework } : snapshot;
    },
  };
});
