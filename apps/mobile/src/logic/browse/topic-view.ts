import type { PlaySpec } from '../audio/controller';
import type { ItemAccess } from './access';
import type { TopicWordFact } from './facts';

/**
 * The word topic page of All lessons (F-BROWSE-001 sections 4.2, 4.6 and 4.7;
 * mock `design/screens/browse/topic.md`, BR-9). Every word of the topic with
 * its picture, romanization, gloss and a Hear button. Until F-VOC-003's
 * flashcards come to All lessons (its C-5), this word list with its audio is
 * the topic's preview, so a closed topic keeps every word, picture,
 * romanization and gloss and drops only the Hear buttons (design decision 23).
 * Pure: the screen plays what `topicHearSpec` returns through the learner
 * audio, which writes nothing.
 */

/** The audio surface id (`PlaySpec.source`): a screen name, never a person. */
export const TOPIC_HEAR_SOURCE = 'browse-topic';

/** Hear buttons are the topic's preview: gone only when the pass closes the topic. */
export function topicHearShown(access: ItemAccess): boolean {
  return access !== 'closed';
}

/** One word as the learner hears it: its recording when bundled, else the device voice (`playPrompt`). */
export function topicHearSpec(word: Pick<TopicWordFact, 'speech'>): PlaySpec {
  const { text, audioRef } = word.speech;
  return { text, ...(audioRef !== undefined ? { audioRef } : {}), kind: 'word', source: TOPIC_HEAR_SOURCE };
}
