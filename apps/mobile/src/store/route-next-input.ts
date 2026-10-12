import { bundleOs, flags, gatingActive } from '../config/flags';
import { episodesAll, questsAll } from '../content';
import { dayKey } from '../logic/homework/mission-builder';
import { emptySnapshot } from '../logic/my-route/view';
import { routeNextInputOf, type RouteNextInput } from '../logic/route-next';
import { usePlanStore } from './plan-store';
import { useProgressStore } from './progress-store';
import { accessTier, questOpenFor } from './tier-store';

/**
 * The `routeNext` input for a learner from the stores, outside React (F-ENT-003
 * section 3.5, PR E3-4): the snapshot, the cached inbox plans with the
 * self-route, the access tier, the effective switch and `questOpenFor`. The
 * placement result reads it when its primary action is pressed; screens that
 * re-render build the same input with `routeNextInputOf` from their hooks.
 */
export function routeNextInputFor(learnerId: string, now: Date): RouteNextInput {
  const snapshot = useProgressStore.getState().byProfile[learnerId] ?? emptySnapshot(learnerId);
  return routeNextInputOf({
    snapshot,
    profileId: learnerId,
    today: dayKey(now.toISOString()),
    plans: usePlanStore.getState().byLearner[learnerId],
    quests: questsAll,
    episodes: episodesAll,
    tier: accessTier(learnerId, now),
    gatingActive: gatingActive(flags, bundleOs()),
    isQuestOpen: questOpenFor(learnerId, now, snapshot),
  });
}
