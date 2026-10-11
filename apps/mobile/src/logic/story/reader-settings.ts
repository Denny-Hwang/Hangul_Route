import { levelOrder } from '@hangul-route/content-schema';

/**
 * Read to me defaults (F-STORY-002 §3.2, D1). The default depends on the
 * profile's learner level read through `levelOrder()`, never the raw id or an
 * age: "Pictures first" (order 0) starts with the story read aloud, every
 * other level starts silent. An id this build does not know is silent.
 */
export function readToMeDefault(learnerLevelId: string): boolean {
  return levelOrder(learnerLevelId) === 0;
}

/** The stored `ProfileSettings.readToMe`, or the level default while the learner never chose. */
export function effectiveReadToMe(setting: boolean | undefined, learnerLevelId: string): boolean {
  return setting ?? readToMeDefault(learnerLevelId);
}
