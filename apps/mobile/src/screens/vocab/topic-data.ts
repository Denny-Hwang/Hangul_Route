import type { RuntimeVocabItem, VocabTopic } from '@hangul-route/content-schema';
import { flags } from '../../config/flags';
import { VOCAB_ITEMS } from '../../content/__generated__/vocab';
import { topicItems, vocabTopics } from '../../content/vocab';
import { resolvePicture } from '../../logic/picture-ref';
import { createIntroMemory, inFileOrder } from '../../logic/vocab/topic-view';
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

let cached: readonly VocabTopic[] | undefined;

/**
 * The topics the picker shows, in topic order: `ready` and `shipped` topics
 * whose every picture resolves (T8, V12). A dev build with
 * `flags.vocabShowDrafts` also lists `draft` and `preview` topics (C-3; a
 * release build ignores the env value). The bundle is fixed, so the answer is
 * computed once.
 */
export function pickerTopics(): readonly VocabTopic[] {
  cached ??= visibleTopics(vocabTopics, topicItems, canRenderPicture, {
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

/** A topic's words in file order: the word wall's order (section 3.4); `topicItems` is the flashcards' order. */
export function topicWallWords(topicKey: string): RuntimeVocabItem[] {
  return inFileOrder(topicItems(topicKey), VOCAB_ITEMS);
}

/** Hoya's topic line once per topic per app session. */
export const topicIntroMemory = createIntroMemory();
