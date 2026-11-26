import { holdsRomanization, type HoldSurface } from '../locale/check-hold';
import type { ReviewRound } from './review-rounds';

/**
 * What a review round draws of the romanization, before and after the answer (AMENDMENTS-STAGE1-DECODING-CHECK section 3.1
 * and 3.3, row DC-1b). Pure: the rounds of `ReviewRounds.tsx` and the romanization-only bot read the same look, so what
 * the bot is shown is what the screen draws.
 *
 * `ReviewRounds` never reads the learner's romanization mode: once the question is answered every line shows. While it is
 * open, a surface that holds (`holdsRomanization(surface, rung)`) draws no romanization line of the question's taught
 * Korean (the prompt or stimulus and every option or tile) but keeps its room, and the line stays off the accessibility
 * tree (the screen-reader names keep the romanization: the hold is visual).
 */
export interface RoundLook {
  /** The surface holds this question and it is still open: a held line keeps its room and draws nothing. */
  held: boolean;
  /** The prompt, stimulus or sentence line draws its romanization (a Sound round's romanization is the stimulus, always drawn). */
  promptRomanization: boolean;
  /** The options or tiles draw their romanization (a Sound round's options never do: the romanization would be the answer). */
  optionRomanization: boolean;
  /**
   * The text that stands in for a sound while the question is open (Show the letters, Sound off, no voice, a failed or
   * blocked play) is the romanization only, never the Hangul (section 3.2).
   */
  askedRomanizationOnly: boolean;
}

/** Whether the surface holds this round's question while it is open: the round's own rung decides for the Daily Review. */
export function roundHolds(surface: HoldSurface, round: Pick<ReviewRound, 'question'>): boolean {
  return holdsRomanization(surface, round.question.rung);
}

/**
 * Whether the keyboard's Latin sound line is held in this round (section 3.1): in a Check, yes; the Daily Review keeps it
 * even at the produce rung, because it is practice and the line is how a learner finds the keys (OD-DC12). A surface that
 * holds nothing draws it.
 */
export function keyboardSoundHeld(surface: HoldSurface, round: Pick<ReviewRound, 'question'>): boolean {
  return surface !== 'daily-review' && roundHolds(surface, round);
}

/**
 * The look of a round. `solved`: the round has resolved (the right answer; for a typed round, a right or a one-letter-slip
 * answer, which show the word). Syllable Build and Match Shape draw their own boards (their chunks hold the block's
 * romanization until it is built), so they are never held here; a Sound round's romanization is its stimulus.
 */
export function roundLook(round: ReviewRound, { surface, solved }: { surface: HoldSurface; solved: boolean }): RoundLook {
  const sound = round.type === 'pick' && round.ask === 'sound';
  const own = round.type === 'build' || round.type === 'shape' || sound;
  const held = !own && !solved && roundHolds(surface, round);
  return {
    held,
    promptRomanization: !held,
    optionRomanization: !sound && !held,
    askedRomanizationOnly: held && round.type === 'pick' && round.heard,
  };
}
