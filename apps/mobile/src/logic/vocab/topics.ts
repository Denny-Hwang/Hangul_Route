import type { RuntimeVocabItem, VocabProgress, VocabTopic } from '@hangul-route/content-schema';

/**
 * The topic picker's decisions — F-VOC-003 section 3.2. Pure: the catalogue,
 * the picture check and the progress slice are passed in.
 */

export interface VisibleTopicsOptions {
  /** Also list `preview` topics (dev and design-preview builds). */
  preview?: boolean;
  /** Also list `draft` topics (`flags.vocabShowDrafts`, dev builds only, F-VOC-001 section 3.7). */
  drafts?: boolean;
}

/**
 * Topics the picker may show, by the topic `order` (fixed; never re-sorted
 * by progress). A topic is shown only when its status
 * allows it and `canRender` can draw **every** item's picture (T8): a topic
 * with one blank tile is skipped, never shown half-empty. A topic with no
 * words is skipped too.
 */
export function visibleTopics(
  topics: readonly VocabTopic[],
  itemsOf: (topicKey: string) => readonly RuntimeVocabItem[],
  canRender: (visual: string) => boolean,
  options: VisibleTopicsOptions = {},
): VocabTopic[] {
  const shown = topics.filter((t) => {
    const allowed =
      t.status === 'ready' ||
      t.status === 'shipped' ||
      (t.status === 'preview' && options.preview === true) ||
      (t.status === 'draft' && options.drafts === true);
    if (!allowed) return false;
    const items = itemsOf(t.key);
    return items.length > 0 && items.every((item) => canRender(item.visual));
  });
  return shown.sort((a, b) => a.order - b.order);
}

/**
 * Counts for a topic's tile and header. No percent and no fraction field: the
 * UI prints "N collected" and the meter takes the two numbers (D3).
 */
export interface TopicState {
  /** Words in the topic. */
  total: number;
  /** Words of the topic with a saved state (collected, F-VOC-005 `introduced`). */
  collected: number;
  /** A word is collected or the topic has a session row. */
  started: boolean;
  /** Every word is collected (a topic with no words never is). */
  complete: boolean;
}

export function topicState(topicKey: string, wordIds: readonly string[], progress: VocabProgress): TopicState {
  const known = new Set(progress.items.map((s) => s.id));
  const ids = new Set(wordIds);
  let collected = 0;
  for (const id of ids) if (known.has(id)) collected += 1;
  const total = ids.size;
  return {
    total,
    collected,
    started: collected > 0 || progress.topics.some((t) => t.topic === topicKey),
    complete: total > 0 && collected === total,
  };
}
