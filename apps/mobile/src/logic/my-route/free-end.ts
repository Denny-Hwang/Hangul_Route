import { isFreeContent } from '../content-access';

/**
 * The free-end hero's one button (AMENDMENTS-ROUTE-LEARNING-ROUTE section 4.5,
 * LR-5b; F-ENT-003 E3-10 is withdrawn in its favour): **Practice words** opens
 * the first free word topic this build lists, in the build's own topic order;
 * with none, the hero offers **Open Library** instead. Word topics that stay
 * free come from F-ENT-003's free-content registry (`isFreeContent`), so this
 * page and the Plan screen's What is free list never disagree. Pure.
 */
export function practiceTopicOf(topicKeys: readonly string[]): string | null {
  return topicKeys.find((key) => isFreeContent('vocab-topic', key)) ?? null;
}
