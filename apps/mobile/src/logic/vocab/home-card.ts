import type { RuntimeVocabItem, VocabProgress } from '@hangul-route/content-schema';
import { localDay, vocabOf } from './progress';
import { vocabNudge, type NudgeTopicRef, type VocabNudge } from './nudge';

/**
 * The inputs of the Home "Words are ready" card — F-VOC-005 section 3.7, PR P-3. Pure.
 *
 * `topicRefIndex` answers `vocabNudge`'s question "which topic opens this
 * word?" from the topics the picker shows, and `homeVocabNudge` is the one
 * place the flag and the local day are applied, so Home only passes the
 * result to the mission builder (`BuildMissionInput.vocab`).
 */

/** A topic the picker shows: its key and its picker order. */
export interface ShownTopic {
  key: string;
  order: number;
}

/**
 * Maps a word id to the shown, open topic that opens it: its primary topic
 * (`topics[0]`) when that one is shown and open, else the first shown and open
 * topic (picker order) that lists it. `undefined` for a word no such topic
 * holds (a hidden or locked topic, an id from a newer app), which the nudge
 * then does not count. Built once per call; the lookup is a map read.
 */
export function topicRefIndex(
  topics: readonly ShownTopic[],
  wordsOf: (topicKey: string) => readonly Pick<RuntimeVocabItem, 'id' | 'topics'>[],
  isOpen: (topicKey: string) => boolean = () => true,
): (id: string) => NudgeTopicRef | undefined {
  const index = new Map<string, NudgeTopicRef>();
  const open = [...topics].filter((t) => isOpen(t.key)).sort((a, b) => a.order - b.order);
  for (const t of open) {
    const ref: NudgeTopicRef = { key: t.key, order: t.order };
    for (const item of wordsOf(t.key)) {
      if (!index.has(item.id) || item.topics[0] === t.key) index.set(item.id, ref);
    }
  }
  return (id) => index.get(id);
}

/**
 * The nudge for today's plan, or null: with the flag off (Home unchanged),
 * without a snapshot or a slice, or with fewer than three due words that a
 * shown topic opens. `today` is the device's local day (P5), the day the
 * schedule writes `due` in. Home pins the plan, and keys the collected state
 * and the shown event, by the plan's UTC day key (`dayKey`, F-HW-001), so the
 * card uses two day bases: far from UTC the due count frozen into a pinned
 * plan is the local day's count, and the card appears or leaves at the UTC
 * rollover, not at local midnight. Words are never lost and the copy names no
 * day, so this stays until Home moves its pin to the local day.
 */
export function homeVocabNudge(i: {
  enabled: boolean;
  snapshot: { vocab?: VocabProgress } | undefined;
  topicOf: (id: string) => NudgeTopicRef | undefined;
  now: Date;
}): VocabNudge | null {
  if (!i.enabled || i.snapshot === undefined) return null;
  return vocabNudge(vocabOf(i.snapshot), i.topicOf, localDay(i.now));
}
