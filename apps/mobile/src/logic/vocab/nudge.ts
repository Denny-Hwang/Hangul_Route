import type { VocabProgress } from '@hangul-route/content-schema';
import { codePoint } from './progress';
import { isDue } from './srs';

/**
 * The Home "Words are ready" nudge — F-VOC-005 section 3.7. Pure.
 *
 * A gift, not a guilt trip: the card appears only when at least three words
 * are due, and this function returns a topic and a count, never how long any
 * word has waited (it reads no date other than `due <= today`). The Home
 * mission builder (P-3) turns the result into the slot 3 card.
 */

/** The card appears from this many due words. */
export const NUDGE_MIN_DUE = 3;

/** A topic the learner can open: its key and its picker `order` (ties). */
export interface NudgeTopicRef {
  key: string;
  order: number;
}

export interface VocabNudge {
  /** The topic with the most due words (ties: topic order, then key). */
  topicKey: string;
  /** Due words across every topic the learner can open. */
  due: number;
}

/**
 * `topicOf` maps a word id to the visible topic that opens it (normally the
 * item's primary topic), or `undefined` when the word cannot be opened (an id
 * from a newer app, a hidden topic); such words are not counted, because the
 * card could not take the learner to them.
 */
export function vocabNudge(
  v: VocabProgress,
  topicOf: (id: string) => NudgeTopicRef | undefined,
  today: string,
): VocabNudge | null {
  const perTopic = new Map<string, { ref: NudgeTopicRef; due: number }>();
  let due = 0;
  for (const s of v.items) {
    if (!isDue(s, today)) continue;
    const ref = topicOf(s.id);
    if (ref === undefined) continue;
    due += 1;
    const row = perTopic.get(ref.key) ?? { ref, due: 0 };
    row.due += 1;
    perTopic.set(ref.key, row);
  }
  if (due < NUDGE_MIN_DUE) return null;
  const [best] = [...perTopic.values()].sort(
    (a, b) => b.due - a.due || a.ref.order - b.ref.order || codePoint(a.ref.key, b.ref.key),
  );
  return { topicKey: best!.ref.key, due };
}
