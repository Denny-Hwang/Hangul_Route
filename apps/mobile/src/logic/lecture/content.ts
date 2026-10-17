import type { Overlays, UiLocale } from '@hangul-route/content-schema';
import { cardById, episodeById, jamoAll, jamoKnown, questById } from '../../content';
import type { AudioCapability } from '../audio/capability';
import type { PlaySpec } from '../audio/controller';
import { spokenFor } from '../audio/spoken';
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

/**
 * Test the sound's greeting on the start screen (section 3.7): 안녕하세요, "hello". It is only heard, never written
 * into a sentence or shown, so it needs no gloss message; it lives here with the taught Korean, so its romanization
 * is checked like the Pause word's.
 */
export const SOUND_CHECK_WORD = { ko: '안녕하세요', romanization: 'annyeonghaseyo', en: 'hello' } as const;

/**
 * What Test the sound plays (section 3.7). The greeting, in the device's Korean voice; but where the voice row reads
 * ready only because of the bundled recordings (no Korean voice: `voiceCheck` kind `clips`), the first Stage 1
 * letter that has a recording, through it, so the test checks what the slides will play there and agrees with the
 * row. `hasClip` is the platform's (a ref with a bundled recording that will be tried first). `source` keeps the
 * test's telemetry apart from the slides'.
 */
export function soundCheckSpec(capability: AudioCapability, hasClip: (ref: string | undefined) => boolean): PlaySpec {
  const greeting: PlaySpec = { text: SOUND_CHECK_WORD.ko, kind: 'word', source: 'presenter-check' };
  if (capability.tts.state === 'ready' || !capability.clips) return greeting;
  for (const jamo of jamoAll) {
    const spoken = spokenFor(jamo, 'sound');
    if (spoken.audioRef !== undefined && hasClip(spoken.audioRef)) {
      return { text: spoken.text, audioRef: spoken.audioRef, kind: 'sound', source: 'presenter-check' };
    }
  }
  return greeting;
}

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
