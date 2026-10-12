import type { RuntimeVocabItem, VocabTopic } from '@hangul-route/content-schema';
import { flags } from '../../config/flags';
import { visibleItems, vocabTopics } from '../../content/vocab';
import { resolvePicture } from '../../logic/picture-ref';
import { createIntroMemory, wordsOfTopic } from '../../logic/vocab/topic-view';
import { visibleTopics } from '../../logic/vocab/topics';
import { PICTURE_CONTEXT } from '../minigames/PictureArt';

/**
 * The Words screens' binding to the bundle (F-VOC-003 C-4): the topics the
 * picker shows, a topic's words, and the app session's Hoya memory. The
 * decisions are in `logic/vocab/`; this file only wires them to the generated
 * content and the build's flags.
 */

/** A picture the art can draw (T8): a topic is listed only when every word's picture resolves. */
export function canRenderPicture(visual: string): boolean {
  return resolvePicture(visual, PICTURE_CONTEXT).kind !== 'text';
}

const wordsByTopic = new Map<string, readonly RuntimeVocabItem[]>();

/**
 * A topic's words a learner may meet, in file order: the catalogue's
 * `visibleItems` filed under the topic (a word whose own topic is a draft
 * stays out, V12). The bundle is fixed, so each list is built once.
 */
export function topicWords(topicKey: string): readonly RuntimeVocabItem[] {
  let words = wordsByTopic.get(topicKey);
  if (words === undefined) {
    words = wordsOfTopic(visibleItems, topicKey);
    wordsByTopic.set(topicKey, words);
  }
  return words;
}

let cached: readonly VocabTopic[] | undefined;

/**
 * The topics the picker shows, in topic order: `ready` and `shipped` topics
 * whose every picture resolves (T8, V12). A dev build with
 * `flags.vocabShowDrafts` also lists `draft` and `preview` topics (C-3; a
 * release build ignores the env value). The bundle is fixed, so the answer is
 * computed once.
 */
export function pickerTopics(): readonly VocabTopic[] {
  cached ??= visibleTopics(vocabTopics, topicWords, canRenderPicture, {
    drafts: flags.vocabShowDrafts,
    preview: flags.vocabShowDrafts,
  });
  return cached;
}

/** A topic the picker shows, or `undefined` (an unknown key, a draft in a release build, a topic with a missing picture). */
export function pickerTopic(topicKey: string): VocabTopic | undefined {
  return pickerTopics().find((t) => t.key === topicKey);
}

/** Words is on: its flag, and at least one topic to show (T1's `isAvailable`). */
export function wordsOffered(): boolean {
  return flags.vocabTopicsEnabled && pickerTopics().length > 0;
}

/** Hoya's topic line once per topic per app session. */
export const topicIntroMemory = createIntroMemory();
