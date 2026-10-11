import { a11yRomanization } from '@hangul-route/content-schema';
import type { QuestStep } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * Learner-facing and screen-reader text for taught Korean (F-CNT-002 §3.3, §3.5).
 * Taught Korean always shows its romanization (CLAUDE.md §1); a jamo sound value
 * such as 'silent/ng' is read aloud as 'silent or ng', not "slash".
 */

/** Button label for a Tap & Respond reply: `ko  ·  romanization  ·  gloss`. */
export function replyOptionLabel(option: { ko: string; romanization?: string; en: string }): string {
  const parts = option.romanization ? [option.ko, option.romanization, option.en] : [option.ko, option.en];
  return parts.join('  ·  ');
}

/** Screen-reader label of a jamo tile (`a11y.tile`). */
export function jamoTileA11yLabel(romanization: string, tile: Messages['a11y']['tile']): string {
  return tile(a11yRomanization(romanization));
}

/** Screen-reader text of the trace prompt heading (`a11y.minigame.traceLetter`). */
export function traceLetterA11yText(romanization: string, label: Messages['a11y']['minigame']['traceLetter']): string {
  return label(a11yRomanization(romanization));
}

/** Screen-reader label of the trace canvas (`a11y.minigame.traceCanvas`). */
export function traceCanvasA11yLabel(romanization: string, label: Messages['a11y']['minigame']['traceCanvas']): string {
  return label(a11yRomanization(romanization));
}

export interface NarrativeLine {
  /** English line in Hoya's bubble. */
  message: string;
  /** Korean line, shown with its romanization and gloss. */
  korean?: string;
  romanization?: string;
  glossEn?: string;
}

/**
 * What a narrative (no minigame) quest step shows. `fallback` is Hoya's line for a step that
 * authored none (`learner.quest.keepGoing`).
 */
export function narrativeLine(
  step: Pick<QuestStep, 'hoyaLineEn' | 'bodyEn' | 'hoyaLineKo'>,
  fallback: string,
): NarrativeLine {
  const { hoyaLineKo } = step;
  const message = step.hoyaLineEn ?? step.bodyEn ?? hoyaLineKo?.en ?? fallback;
  if (!hoyaLineKo) return { message };
  const line = { message, korean: hoyaLineKo.ko, romanization: hoyaLineKo.romanization };
  // The gloss is not repeated when it already is the message.
  return message === hoyaLineKo.en ? line : { ...line, glossEn: hoyaLineKo.en };
}
