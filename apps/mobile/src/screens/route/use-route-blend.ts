import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { useMemo, useSyncExternalStore } from 'react';
import { flags } from '../../config/flags';
import { episodesAll } from '../../content';
import type { DeriveSource } from '../../logic/homework/plan-derivation';
import { practicePlacerReady, subscribePlacer, withLearnerDays } from '../../logic/route/practice-days';
import { blendHomeOf, cellCheckOpener, NO_BLEND_HOME, type BlendHome } from '../../logic/route/blend-view';
import { useSwitches } from '../cell-check/cell-check-entry';

/**
 * Home's class days and practice days pieces (AMENDMENTS-ROUTE-CLASS-BLEND section 7, row BL-7): "Class today." and
 * today's Refresh step, from the same sources as card (2) (`routeNextInputOf`). Nothing while `flags.routeBlendEnabled`
 * is off. Refresh opens a cell's Cell Check only while the Check is on for this learner and the cell is open to them.
 */
export function useRouteBlendHome(
  profileId: string | null,
  snapshot: ProgressSnapshot | undefined,
  sources: readonly DeriveSource[] | undefined,
  today: string,
  isQuestOpen: (questId: string) => boolean,
): BlendHome {
  const [checkOn] = useSwitches(profileId);
  // The placer arrives with the practice-days chunk after the first frame; Refresh re-dates once it is in, even when
  // the derivation that follows writes no new snapshot (all homework already done).
  const placerIn = useSyncExternalStore(subscribePlacer, practicePlacerReady);
  return useMemo(() => {
    if (!flags.routeBlendEnabled || sources === undefined || snapshot === undefined) return NO_BLEND_HOME;
    const doneQuestIds = new Set(snapshot.quests.filter((q) => q.stars > 0).map((q) => q.questId));
    const isCellCheckOpen = cellCheckOpener({ checkOn, episodes: episodesAll, doneQuestIds, testedOut: snapshot.testedOut, isQuestOpen });
    // Refresh moves with the learner's own practice days (section 9.4, invariant 5).
    return blendHomeOf({ enabled: true, sources: withLearnerDays(sources, snapshot.practiceDays, today), today, isCellCheckOpen });
  }, [checkOn, snapshot, sources, today, isQuestOpen, placerIn]);
}
