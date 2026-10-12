import type { RuntimeVocabItem, UiLocale, VocabTopic } from '@hangul-route/content-schema';

/**
 * Vocabulary accessors (F-VOC-001 §3.7). Pure: the generated arrays are passed
 * in, so this module counts towards the business-logic coverage lane while
 * `content/vocab.ts` stays a thin binding. Nothing here is reachable by a
 * learner until F-VOC-003 adds the picker behind `flags.vocabTopicsEnabled`.
 */

export interface VocabCatalogOptions {
  /**
   * Include `status: 'draft'` topics. Default false: draft topics ship in the
   * bundle but never reach the picker (V12). F-VOC-003 PR C-3 wires this to the
   * dev-build flag `vocabShowDrafts`.
   */
  showDrafts?: boolean;
}

export interface VocabCatalog {
  /** Topics the picker may list: everything but `draft` unless `showDrafts`. */
  readonly vocabTopics: readonly VocabTopic[];
  /**
   * Items whose primary topic (`topics[0]`) is in `vocabTopics`, in file order.
   * Every learner pool and distractor universe drawn from the whole catalogue
   * (F-VOC-004 mixed review, F-VOC-005, F-RVW-001) uses this, never the raw
   * item list, so unreviewed draft words never reach a learner (V12).
   */
  readonly visibleItems: readonly RuntimeVocabItem[];
  /** Any topic by key (draft included; the picker uses `vocabTopics`). */
  vocabTopic(key: string): VocabTopic | undefined;
  /**
   * Items listing `key` among their topics: file order for a `fixedOrder`
   * topic, otherwise level then file order (stable sort).
   */
  topicItems(key: string): readonly RuntimeVocabItem[];
  vocabItem(id: string): RuntimeVocabItem | undefined;
}

export function createVocabCatalog(
  topics: readonly VocabTopic[],
  items: readonly RuntimeVocabItem[],
  options: VocabCatalogOptions = {},
): VocabCatalog {
  const showDrafts = options.showDrafts ?? false;
  const visibleTopics = topics.filter((t) => showDrafts || t.status !== 'draft');
  const topicsByKey = new Map(topics.map((t) => [t.key as string, t]));
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const visibleKeys = new Set<string>(visibleTopics.map((t) => t.key));

  return {
    vocabTopics: visibleTopics,
    visibleItems: items.filter((i) => visibleKeys.has(i.topics[0]!)), // topics has at least one entry (VocabItemSchema)
    vocabTopic: (key) => topicsByKey.get(key),
    topicItems: (key) => {
      const inTopic = items.filter((i) => (i.topics as readonly string[]).includes(key));
      if (topicsByKey.get(key)?.fixedOrder === true) return inTopic;
      // Array.prototype.sort is stable, so equal levels keep file order.
      return [...inTopic].sort((a, b) => a.level - b.level);
    },
    vocabItem: (id) => itemsById.get(id),
  };
}

/** The gloss in the learner's locale, else the English base gloss. */
export function localizedGloss(item: RuntimeVocabItem, locale: UiLocale): string {
  return item.glosses[locale] ?? item.glosses.en;
}

/** Same Korean word (homonym) or same sense group: never both options in one question. */
export function sameSense(a: RuntimeVocabItem, b: RuntimeVocabItem): boolean {
  if (a.ko === b.ko) return true;
  return a.senseGroup !== undefined && a.senseGroup === b.senseGroup;
}

/** `card:*` is heritage card art, anything else (`word:*`) is WordArt. */
export function pictureKind(ref: string): 'card' | 'word' {
  return ref.startsWith('card:') ? 'card' : 'word';
}
