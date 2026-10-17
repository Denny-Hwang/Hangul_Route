import type { Overlays, UiLocale } from '@hangul-route/content-schema';
import { cardById, episodeById, jamoKnown, questById } from '../../content';
import { reviewedStrokeIds, strokesForJamo } from '../../content/jamo-strokes';
import { localizeCard, localizeEpisode, localizeJamo, localizeQuest, localizeScope } from '../content-locale';
import { scopeFor } from '../minigame-config';
import type { LectureBundle } from './deck-builder';
import { lectureStories } from './sources/story';
import { lectureVocabTopics } from './sources/vocab';

/**
 * The presenter's content (F-TCH-004 §3.3, §3.13).
 *
 * Korean the presenter shows outside a deck's own content lives here as
 * taught content (with romanization and a gloss), never in a UI message: no
 * Hangul is allowed in an `en` or `es` message (F-I18N-001 §3.4 rule 5).
 *
 * `lectureBundle(locale)` is the deck builder's view of the bundled content,
 * with content text in the presenter's language (overlays, F-I18N-001 §3.6);
 * taught Korean and its romanization never change. Stories come through
 * their adapter (`sources/story.ts`, PR 11: the Library's review gate);
 * vocabulary topics come through theirs (`sources/vocab.ts`, PR 12).
 */

/**
 * The Pause overlay word: 잠깐, "wait a moment" (drawn with `KoreanText`). The
 * gloss follows the presenter locale through `glossKey` (§3.13; the message
 * lands with the overlay strings, PR 9); `en` is the English fallback.
 */
export const PAUSE_WORD = {
  ko: '잠깐',
  romanization: 'jamkkan',
  glossKey: 'learner.presenter.pause.gloss',
  en: 'wait a moment',
} as const;

export function lectureBundle(locale: UiLocale, overlays?: Overlays): LectureBundle {
  const reviewed = new Set(reviewedStrokeIds);
  const stories = lectureStories(locale, overlays);
  const topics = lectureVocabTopics(locale, overlays);
  // The Stage 1 symbols, then the Word Builder ones (F-CURR-001 S2-1), so a Word Builder Discover gets its letter slides.
  const localizedJamo = locale === 'en' ? jamoKnown : jamoKnown.map((j) => localizeJamo(j, locale, overlays));
  return {
    jamoAll: localizedJamo,
    scopeFor: (ref) => {
      const scope = scopeFor(ref);
      return scope && localizeScope(scope, ref, locale, overlays);
    },
    questById: (id) => {
      const quest = questById(id);
      return quest && localizeQuest(quest, locale, overlays);
    },
    episodeById: (id) => {
      const episode = episodeById(id);
      return episode && localizeEpisode(episode, locale, overlays);
    },
    cardById: (id) => {
      const card = cardById(id);
      return card && localizeCard(card, locale, overlays);
    },
    hasStrokes: (id) => strokesForJamo(id) !== undefined,
    strokeReviewed: (id) => reviewed.has(id),
    story: stories.story,
    vocabTopic: topics.vocabTopic,
    vocabWord: topics.vocabWord,
  };
}
