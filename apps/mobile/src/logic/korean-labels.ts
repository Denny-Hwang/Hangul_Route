import { a11yRomanization } from '@hangul-route/content-schema';
import type { QuestStep } from '@hangul-route/content-schema';

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

/** Screen-reader label of a jamo tile. */
export function jamoTileA11yLabel(romanization: string): string {
  return `Korean letter ${a11yRomanization(romanization)}, tap to select`;
}

/** Screen-reader text of the trace prompt heading. */
export function traceLetterA11yText(romanization: string): string {
  return `Trace the letter ${a11yRomanization(romanization)}`;
}

/** Screen-reader label of the trace canvas. */
export function traceCanvasA11yLabel(romanization: string): string {
  return `Draw the letter ${a11yRomanization(romanization)} with your finger`;
}

export interface NarrativeLine {
  /** English line in Hoya's bubble. */
  message: string;
  /** Korean line, shown with its romanization and gloss. */
  korean?: string;
  romanization?: string;
  glossEn?: string;
}

/** What a narrative (no minigame) quest step shows. */
export function narrativeLine(
  step: Pick<QuestStep, 'hoyaLineEn' | 'bodyEn' | 'hoyaLineKo'>,
): NarrativeLine {
  const { hoyaLineKo } = step;
  const message = step.hoyaLineEn ?? step.bodyEn ?? hoyaLineKo?.en ?? "Let's keep going!";
  if (!hoyaLineKo) return { message };
  const line = { message, korean: hoyaLineKo.ko, romanization: hoyaLineKo.romanization };
  // The gloss is not repeated when it already is the message.
  return message === hoyaLineKo.en ? line : { ...line, glossEn: hoyaLineKo.en };
}
