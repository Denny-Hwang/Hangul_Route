import type { VocabProgress } from '@hangul-route/content-schema';
import { localDay } from './progress';

/**
 * Which activity the topic page suggests — F-VOC-003 section 3.4, T7. Pure.
 *
 * The learner always chooses; the suggestion is only which of the three
 * buttons is the primary one. Match is never the suggestion.
 */

export type VocabActivity = 'learn' | 'speed' | 'match';

/** Collected words before the Speed round at a 4-option level; a 3-option level needs 3 (its `optionCount`). */
export const SPEED_MIN_COLLECTED = 4;
/** Collected words before Match is available. */
export const MATCH_MIN_COLLECTED = 3;

export interface SuggestTopic {
  /** The topic's word ids (`topicItems(key)`). */
  wordIds: readonly string[];
  /** Options per question at the learner's level: the collected words the Speed round needs (as `activityAvailability`). */
  optionCount: 3 | 4;
}

/**
 * `learn` while fewer than `optionCount` words (4, or 3 at a 3-option level) are collected, or while words remain to be
 * met and the topic had no session today; otherwise `speed` (every word is
 * collected, or the learner already practised this topic today). A due word
 * never pulls the learner away from new words on their first visit of the day.
 * "Today" is the device's local day; a topic's session row records cards,
 * speed and match sessions alike (F-VOC-005 section 3.1).
 */
export function suggestActivity(
  topicKey: string,
  progress: VocabProgress,
  now: Date,
  topic: SuggestTopic,
): VocabActivity {
  const today = localDay(now);
  const ids = new Set(topic.wordIds);
  const collected = progress.items.filter((s) => ids.has(s.id)).length;
  if (collected < topic.optionCount) return 'learn';
  const moreToMeet = collected < ids.size;
  const sessionToday = progress.topics.some((t) => t.topic === topicKey && t.last === today);
  // What is left is "every word collected" or "practised today": the spec's third case (a word is due) adds
  // nothing, because a due word with new words still to meet and no session today is the Learn case above.
  return moreToMeet && !sessionToday ? 'learn' : 'speed';
}

export interface ActivityCaps {
  /** Options per question at the learner's level (F-VOC-004). */
  optionCount: 3 | 4;
  /** F-QUEST-002's Pic-Word Match exists in this build. */
  picWordMatch: boolean;
}

export interface ActivityAvailability {
  /** Learn is always available. */
  learn: true;
  /** False: the button stays and sends the learner to Learn ("Learn 4 words first"), never a dead end. */
  speed: boolean;
  /** `hidden` without the game; `not-yet` before 3 collected words. */
  match: 'hidden' | 'not-yet' | 'available';
}

export function activityAvailability(collected: number, caps: ActivityCaps): ActivityAvailability {
  return {
    learn: true,
    speed: collected >= caps.optionCount,
    match: !caps.picWordMatch ? 'hidden' : collected >= MATCH_MIN_COLLECTED ? 'available' : 'not-yet',
  };
}
