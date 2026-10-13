import type { SelfRoute, StageKey } from '@hangul-route/content-schema';
import { useEffect, useMemo } from 'react';
import { proposalInputOf, safePropose, type PlanChoice } from '../../logic/route/proposal-flow';
import { activeSelfRoute, completedQuestIdsOf } from '../../logic/route/self-route';
import { setupBasisOf, type SetupContext, type SetupState } from '../../logic/route/setup-flow';
import { unlockedStagesFor } from '../../store/plan-store';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useAccessTier } from '../../store/tier-store';
import { useToday } from './use-today';

export interface PlanBasis {
  /** False until the profile and its saved snapshot are read. */
  ready: boolean;
  today: string;
  active: SelfRoute | null;
  /** What the set-up answers are planned with, and the first answers; null when nothing can be planned. */
  basis: { ctx: SetupContext; state: SetupState } | null;
}

/**
 * The plan in force, else Hoya's proposal, for the set-up steps and the preview (F-PLAN-002
 * section 3.9): the same `proposeRoute` input as the proposal screen, the learner's completions
 * and the stages open to them today (`unlockedStagesFor`, section 3.9 "Class devices and free tier").
 */
export function usePlanBasis(profileId: string, choice?: PlanChoice): PlanBasis {
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const snapshot = useProgressStore((s) => s.byProfile[profileId]);
  // The access tier re-renders when the inbox or the subscription changes what is open (F-ENT-003 section 3.4).
  const tier = useAccessTier(profileId);
  // Read again on focus and when the app comes back: the steps may stay open across midnight.
  const today = useToday();

  useEffect(() => {
    void useProgressStore.getState().hydrate(profileId);
  }, [profileId]);

  const active = activeSelfRoute(snapshot);
  const basis = useMemo(() => {
    if (profile === null || snapshot === undefined) return null;
    const completedQuestIds = completedQuestIdsOf(snapshot.quests);
    const unlockedStages = unlockedStagesFor(new Date(), profileId) as StageKey[];
    // From the newest level check (`effectiveRoute`), with or without a plan in force: a later place to start moves Change the plan's start.
    const proposal = safePropose(proposalInputOf({ placements: snapshot.placements, completedQuestIds, ageGroup: profile.ageGroup, unlockedStages, today }));
    return setupBasisOf({ active, proposal, ...(choice === undefined ? {} : { choice }), completedQuestIds, unlockedStages, today });
    // `tier` is read through `unlockedStagesFor`; it is listed so a tier change plans again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, snapshot, active, choice, profileId, today, tier]);

  return { ready: profile !== null && snapshot !== undefined, today, active, basis };
}
