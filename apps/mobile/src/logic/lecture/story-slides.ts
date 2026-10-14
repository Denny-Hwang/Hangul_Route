import type { RomanizationMode, SpeechLang } from '@hangul-route/content-schema';
import type { PlaySpec } from '../audio/controller';
import type { BuildName, NarrationPiece } from './build-steps';

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

/**
 * Whether the romanization of Korean that appears at build `base` is on screen (D2): with
 * `romanization: 'tap'` the slide has a `rom` build that reveals every romanization on it at once;
 * otherwise it comes with its Korean.
 */
export function romShown(builds: readonly BuildName[], shown: ReadonlySet<BuildName>, base: BuildName): boolean {
  return builds.includes('rom') ? shown.has('rom') : shown.has(base);
}

/** A quiz option's romanization: at once by default, at the answer build with `tap` (section 3.4). */
export function quizOptionRomShown(mode: RomanizationMode, shown: ReadonlySet<BuildName>): boolean {
  return mode === 'tap' ? shown.has('answer') : true;
}

export const QUIZ_MARKERS = ['circle', 'triangle', 'square', 'star'] as const;
export type QuizMarkerShape = (typeof QUIZ_MARKERS)[number];

/** The marker of the option at `index`: circle 1, triangle 2, square 3, star 4 (section 3.4). */
export function quizMarker(index: number): { shape: QuizMarkerShape; n: number } {
  return { shape: QUIZ_MARKERS[index % QUIZ_MARKERS.length]!, n: index + 1 };
}
