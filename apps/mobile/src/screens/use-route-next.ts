import { useMemo } from 'react';
import { bundleOs, flags, gatingActive } from '../config/flags';
import { episodesAll, questsAll } from '../content';
import { dayKey } from '../logic/homework/mission-builder';
import { planView, routeNext, routeNextInputOf, type PlanView, type RouteNext } from '../logic/route-next';
import { usePlanStore } from '../store/plan-store';
import { activeProfileSelector, useProfileStore } from '../store/profile-store';
import { useProgressStore } from '../store/progress-store';
import { useAccessTier, useQuestAccess } from '../store/tier-store';

/**
 * The active learner's one next and "In your plan" set (F-ENT-003 section 3.5), for a screen that
 * marks plan items (the Library tiles, E3-7): the same input Home, Results and the lesson page
 * build. Null before a snapshot exists, or when it cannot be read (fail open: no tag).
 */
export function useActiveRouteNext(): { next: RouteNext; plan: PlanView } | null {
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const plans = usePlanStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const tier = useAccessTier(profile?.id ?? '');
  const questOpen = useQuestAccess();
  return useMemo(() => {
    if (!profile || !snap) return null;
    try {
      const input = routeNextInputOf({
        snapshot: snap,
        profileId: profile.id,
        today: dayKey(new Date().toISOString()),
        plans,
        quests: questsAll,
        episodes: episodesAll,
        tier,
        gatingActive: gatingActive(flags, bundleOs()),
        isQuestOpen: questOpen,
      });
      return { next: routeNext(input), plan: planView(input) };
    } catch {
      return null;
    }
  }, [profile, snap, plans, tier, questOpen]);
}
