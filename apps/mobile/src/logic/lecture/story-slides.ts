import type { SpeechLang } from '@hangul-route/content-schema';
import type { PlaySpec } from '../audio/controller';
import type { AudioRunnerPlayOptions } from '../story/audio-runner';
import { stepsForVoice } from '../story/reader-effects';
import type { BuildName, KoLine, NarrationPiece } from './build-steps';
import { splitPrompt } from '../story/check-view';

/**
 * The story slides' pure decisions (F-TCH-004 PR 11; design/screens/presenter/slide-story.md,
 * slide-quiz.md): what Read-to-me says on a story scene, when romanization shows (D2), and the
 * shape-and-number markers of a story check. No React, no platform import.
 */

/** Telemetry surface id of every prompt the presenter plays. */
export const PRESENTER_AUDIO_SOURCE = 'presenter';

/** A chunk worth speaking has a letter or a digit (not just ", " or "!" between keyword chips). */
const SAYABLE = /[\p{L}\p{N}]/u;

/**
 * Read-to-me on a story scene (section 3.4 `story`): the narration as shown, in the voice of its
 * language (`narrationLang`, the overlay language when its text is on screen, else English), with
 * each keyword chip spoken in Korean. Only the story's own text is spoken (D14). Played in order
 * by the story reader's audio runner, which stops the chain when a step does not play (D6: the
 * text is on the slide either way).
 */
export function storyNarrationSteps(narration: readonly NarrationPiece[], narrationLang: SpeechLang): PlaySpec[] {
  return narration.flatMap((piece): PlaySpec[] => {
    if ('ko' in piece) return [{ text: piece.ko, language: 'ko-KR', kind: 'word', source: PRESENTER_AUDIO_SOURCE }];
    return SAYABLE.test(piece.text) ? [{ text: piece.text, language: narrationLang, kind: 'narration', source: PRESENTER_AUDIO_SOURCE }] : [];
  });
}

export interface ReadToMeInput {
  /** The deck's `options.sound`: off means the presenter never speaks. */
  sound: boolean;
  /** A Korean voice is known to be there. */
  canPlayKorean: boolean;
  /** The first voice check has finished. */
  voiceChecked: boolean;
  /** The narration's voice (`LectureSceneView.narrationLang`; English when the scene is not known). */
  narrationLang: SpeechLang;
}

export interface ReadToMePlan {
  steps: PlaySpec[];
  options: AudioRunnerPlayOptions;
}

/**
 * What S or the Sound button plays on a slide (D6), with the story reader's voice rules
 * (F-STORY-002 section 3.4, `use-reader-audio.ts`): with no Korean voice only the English plays
 * (an all-Korean narration still asks, so the fallback is learned); while the voice check has not
 * settled, a Korean step that turns out unavailable is skipped rather than ending the chain.
 * Null when there is nothing to play: sound off, not a story scene, or nothing sayable.
 */
export function readToMePlan(slide: { kind: string; narration?: readonly NarrationPiece[] }, input: ReadToMeInput): ReadToMePlan | null {
  if (!input.sound || slide.kind !== 'story' || !slide.narration) return null;
  const steps = storyNarrationSteps(slide.narration, input.narrationLang);
  if (steps.length === 0) return null;
  const spoken = stepsForVoice(steps, input.canPlayKorean);
  return { steps: spoken.length > 0 ? spoken : steps, options: { skipUnavailableKorean: !input.voiceChecked } };
}

/**
 * Whether the romanization of Korean that appears at build `base` is on screen (D2): with
 * `romanization: 'tap'` the slide has a `rom` build that reveals every romanization on it at once;
 * otherwise it comes with its Korean.
 */
export function romShown(builds: readonly BuildName[], shown: ReadonlySet<BuildName>, base: BuildName): boolean {
  return builds.includes('rom') ? shown.has('rom') : shown.has(base);
}

export type CheckPromptPart = { text: string } | { target: KoLine };

/**
 * A story check's prompt in parts (F-STORY-003): the text around the `{target}` token, with the
 * target word in its place. A prompt without the token keeps its target out of the line (the
 * slide draws it after the question). The learner check's own splitter, so the two never drift.
 */
export function checkPromptParts(text: string, target: KoLine | undefined): CheckPromptPart[] {
  return splitPrompt(text, target);
}
