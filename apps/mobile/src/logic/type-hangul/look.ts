import type { RomanizationMode } from '@hangul-route/content-schema';
import { romanizationShown } from '@hangul-route/i18n';

/**
 * What Type Hangul draws of the romanization, before and after the answer (AMENDMENTS-STAGE1-DECODING-CHECK section 3.3,
 * row DC-1c, owner decision OD-DC4). Pure: the game and the romanization-only bot read the same look, so what the bot is
 * shown is what the screen draws.
 *
 * In a quest Check (`hold`: the surface holds, `holdsRomanization('quest-check')`) the question holds the keys to its
 * answer until the round is passed: the shown word's romanization (a `see` round), the picture round's romanization cue
 * (with the cue held, the picture and its meaning stay and the task is spelling from meaning) and the keyboard's Latin sound
 * line. A held line keeps its room, draws nothing and is off the accessibility tree; a held line cannot be revealed by a tap, so
 * the "Show romanization" button is not offered. A missed Done keeps the question open (the result panel names the right
 * word, with its romanization, as the miss line does). A hear (Dictation) round draws no word before its answer and keeps its
 * own hint (recorded as hinted), as in the review rounds. Practice never holds.
 */
export type TypeHangulMode = 'see' | 'picture' | 'hear';

export interface TypeHangulLook {
  /** The shown word's romanization line (or the picture round's cue) is drawn. */
  romanizationVisible: boolean;
  /** The line is held: it keeps its room, draws nothing and is off the accessibility tree. */
  romanizationReserved: boolean;
  /** "Show romanization" is offered (a `see` round whose mode hides the line until a tap, never while it is held). */
  canReveal: boolean;
  /** The keyboard's Latin sound line is held (in a Check, from the first key to the end of the question). */
  keyboardSoundHeld: boolean;
}

export interface TypeHangulLookInput {
  mode: TypeHangulMode;
  /** The surface holds this question while it is open: a quest Check. */
  hold: boolean;
  /** The round has been passed: the answer is in. */
  solved: boolean;
  romanizationMode: RomanizationMode;
  /** The learner tapped "Show romanization" this round. */
  revealed: boolean;
}

export function typeHangulLook({ mode, hold, solved, romanizationMode, revealed }: TypeHangulLookInput): TypeHangulLook {
  const keyboardSoundHeld = hold;
  // A heard word is not drawn before its answer: the Dictation prompt draws its own lines (and keeps its own hint).
  if (mode === 'hear') return { romanizationVisible: false, romanizationReserved: false, canReveal: false, keyboardSoundHeld };
  // A picture round always shows its cue (with the Korean hidden the romanization and meaning are the cue); a Check holds it.
  const heldWord = hold && !solved;
  const modeShows = mode === 'picture' || romanizationShown(romanizationMode, revealed);
  const romanizationVisible = !heldWord && modeShows;
  return {
    romanizationVisible,
    romanizationReserved: heldWord && modeShows,
    canReveal: mode === 'see' && !heldWord && !romanizationVisible,
    keyboardSoundHeld,
  };
}
