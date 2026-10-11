import type { Overlays, SpeechLang, Story, StoryLevel, UiLocale } from '@hangul-route/content-schema';
import { localizeStory } from '../content-locale';
import { narrationSpeechLang } from './scene-audio';

/**
 * The story as the reader shows it (F-STORY-002 §3.2, PR 2.8; the open item of
 * PR 2.6b): both hosts, `StoryReadGame` and `StoryReaderScreen`, apply the UI
 * locale's overlay (`localizeStory`, F-I18N-001 §3.6) and pass, scene by scene,
 * the voice of the narration actually shown. A scene whose narration has no
 * overlay shows the English and is read in `en-US`, never in the UI voice.
 * Taught Korean and its romanization never change.
 */

/** `LOCALE_META[locale].speechLang` as a typed `SpeechLang` (a test keeps the two equal). */
const UI_SPEECH_LANG: Readonly<Record<UiLocale, SpeechLang>> = { en: 'en-US', es: 'es-US', ko: 'ko-KR' };

/** The speech language of a UI locale. */
export function uiSpeechLang(locale: UiLocale): SpeechLang {
  return UI_SPEECH_LANG[locale];
}

export interface ReaderStory {
  /** Undefined passes through: the reader shows its one-line fallback. */
  story: Story | undefined;
  /** The narration voice of each scene of the tier read, by scene index (empty without that tier). */
  narrationLangs: SpeechLang[];
}

export function readerStory(story: Story | undefined, level: StoryLevel, locale: UiLocale, overlays?: Overlays): ReaderStory {
  if (!story) return { story: undefined, narrationLangs: [] };
  const shown = localizeStory(story, locale, overlays);
  // An overlay only replaces text, so the localized story has the same tiers and scenes in the same places.
  const t = story.tiers.findIndex((tier) => tier.level === level);
  const source = story.tiers[t]?.scenes ?? [];
  const localized = shown.tiers[t]?.scenes ?? [];
  const voice = uiSpeechLang(locale);
  const narrationLangs = source.map((scene, i) => narrationSpeechLang(voice, localized[i]?.narrationEn !== scene.narrationEn));
  return { story: shown, narrationLangs };
}
