import { localize, type Overlays, type RuntimeVocabItem, type UiLocale, type VocabTopic } from '@hangul-route/content-schema';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { createVocabCatalog, localizedGloss } from '../../vocab/catalog';
import type { LectureVocabTopic } from '../deck-builder';

/**
 * The presenter's vocabulary topic adapter (F-TCH-004 §3.3 rule 4, §8; PR 12):
 * the only file of the presenter that knows `content/vocab/*.json` (F-VOC-001)
 * and its shape. The deck builder reads topics through its `vocabTopic` port.
 *
 * A `ready` or `shipped` topic expands with all of its words in the catalogue
 * order (`topicItems`: file order for a fixed-order topic, otherwise level then
 * file order). A `draft` or `preview` topic is `'not-ready'`; an id the bundle
 * does not know is `undefined`. Entitlement is never consulted (D5).
 *
 * A word's picture comes from its `visual`: `card:<id>` is the heritage card,
 * `word:<key>` its WordArt key (README D9: the `art` build after the gloss);
 * anything else (a colour swatch) leaves the slide text only, and so does a
 * WordArt key the registry has no glyph for (`vocabArt`).
 *
 * Topic text (title, Hoya line) and glosses follow the presenter's language
 * (overlays, F-I18N-001 §3.6); taught Korean and its romanization never change.
 */

export interface LectureVocabSource {
  vocabTopic(id: string): LectureVocabTopic | 'not-ready' | undefined;
}

const WORD_REF = 'word:';

const EXPANDABLE: ReadonlySet<VocabTopic['status']> = new Set(['ready', 'shipped']);

type LectureWord = LectureVocabTopic['words'][number];

function wordOf(item: RuntimeVocabItem, locale: UiLocale): LectureWord {
  const word: LectureWord = { id: item.id, ko: item.ko, romanization: item.romanization, gloss: localizedGloss(item, locale) };
  if (item.visual.startsWith('card:')) return { ...word, cardId: item.visual };
  // The slide draws the key only when the WordArt registry has its glyph (`vocabArt`, slide-view.ts).
  return item.visual.startsWith(WORD_REF) ? { ...word, wordArt: item.visual.slice(WORD_REF.length) } : word;
}

/** The adapter over given topics and items (tests pass their own; the app binds the bundle below). */
export function lectureVocabTopicsFrom(
  topics: readonly VocabTopic[],
  items: readonly RuntimeVocabItem[],
  locale: UiLocale,
  overlays?: Overlays,
): LectureVocabSource {
  // Drafts are looked up too, so a draft topic in a link is counted as not ready rather than unknown.
  const catalog = createVocabCatalog(topics, items, { showDrafts: true });
  const byId = new Map(topics.map((t) => [t.id as string, t]));
  return {
    vocabTopic: (id) => {
      const topic = byId.get(id);
      if (topic === undefined) return undefined;
      if (!EXPANDABLE.has(topic.status)) return 'not-ready';
      const text = localize({ titleEn: topic.titleEn, hoyaIntroEn: topic.hoyaIntroEn }, topic.id, locale, overlays);
      return {
        title: text.titleEn,
        ...(text.hoyaIntroEn !== undefined ? { hoyaLine: text.hoyaIntroEn } : {}),
        words: catalog.topicItems(topic.key).map((item) => wordOf(item, locale)),
      };
    },
  };
}

/** The bundled vocabulary topics in the presenter's language. */
export function lectureVocabTopics(locale: UiLocale, overlays?: Overlays): LectureVocabSource {
  return lectureVocabTopicsFrom(VOCAB_TOPICS, VOCAB_ITEMS, locale, overlays);
}
