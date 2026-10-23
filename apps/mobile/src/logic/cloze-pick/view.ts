import { CLOZE_GAP, type ClozeGapKind, type ClozePickRound, type RomanizationMode } from '@hangul-route/content-schema';
import type { HostMode } from '../../screens/minigames/host';
import type { ClozeFlowState } from './flow';
import { filledSentence, labelSentence, spokenGap } from './round';

/**
 * What the Cloze Pick prompt card and its Hoya line show (F-CURR-002 row CM-30; design/wireframes/minigame/
 * cloze-pick.md, States and Accessibility). Pure: the screen draws what this returns.
 *
 * - **asking**: the Korean with an empty gap slot, the romanization with `___`, the meaning (the input the round
 *   reads from). No sound and no gloss on the tiles.
 * - **miss**: the gap stays empty; Hoya (amber, `thinking`) says the line of the gap's kind: a word gap "Read the
 *   sentence again", a particle gap Sentence Builder's "Look at how the word before it ends", a value gap the
 *   Realia Read line. The second miss rings the tile that fits and Hoya says "This one fits here". Not inside a
 *   review session, which gives no per-item line (Listen & Pick's rule).
 * - **found**: the gap holds the tile with the check glyph, the romanization and a value gap's meaning complete,
 *   and Hear it replays the sentence.
 * - With `romanizationMode: 'tap'` the sentence's romanization waits for the answer, as the tiles' does.
 */

export type ClozeHoyaLine = 'miss' | 'missParticle' | 'missValue' | 'lookHere';

export interface ClozePromptView {
  /** The Korean before and after the gap. */
  before: string;
  after: string;
  /** The tile's Korean in the gap once found; null while asking. */
  gapText: string | null;
  found: boolean;
  /** The romanization line: with `___` while asking, completed once found; '' while `tap` mode hides it. */
  romanization: string;
  /** The meaning line in the UI language: a value gap keeps its gap until found. */
  meaning: string;
  /** The card's accessible name: the romanization with its gap read as a word, and the meaning. */
  label: string;
  /** Which instruction sits under the card. */
  instruction: ClozeGapKind;
  /** Hoya's line, or null. */
  hoya: ClozeHoyaLine | null;
  /** Hear it shows (after the right tile). */
  hearIt: boolean;
}

export interface ClozeViewContext {
  mode: HostMode;
  romanizationMode: RomanizationMode;
  /** `a11y.minigame.clozePick`: the group label and the word read for the gap. */
  a11y: {
    sentence: (sentence: string, meaning: string) => string;
    sentenceDone: (sentence: string, meaning: string) => string;
    blank: string;
  };
}

const isFound = (state: ClozeFlowState): boolean => state.status === 'resolved' || state.status === 'done';

/** Hoya's line in the current state: none before a miss, after the answer, or in a review session. */
export function hoyaLineOf(round: ClozePickRound, state: ClozeFlowState, mode: HostMode): ClozeHoyaLine | null {
  if (mode === 'review' || state.status !== 'asking' || state.wrongIds.length === 0) return null;
  if (state.hint) return 'lookHere';
  return round.gapKind === 'particle' ? 'missParticle' : round.gapKind === 'value' ? 'missValue' : 'miss';
}

export function clozeView(round: ClozePickRound, state: ClozeFlowState, ctx: ClozeViewContext): ClozePromptView {
  const found = isFound(state);
  const done = filledSentence(round);
  const [before = '', after = ''] = round.sentence.ko.split(CLOZE_GAP);
  const romanization = found ? done.romanization : round.sentence.romanization;
  const meaning = found ? done.en : round.sentence.en;
  const label = found
    ? ctx.a11y.sentenceDone(labelSentence(done.romanization, ctx.a11y.blank), done.en)
    : ctx.a11y.sentence(labelSentence(round.sentence.romanization, ctx.a11y.blank), spokenGap(round.sentence.en, ctx.a11y.blank));
  return {
    before,
    after,
    gapText: found ? (round.tiles[round.answerIndex]?.ko ?? null) : null,
    found,
    romanization: ctx.romanizationMode === 'always' || found ? romanization : '',
    meaning,
    label,
    instruction: round.gapKind,
    hoya: hoyaLineOf(round, state, ctx.mode),
    hearIt: found,
  };
}

/** A tile of at most this many blocks (a particle, an ending) sits two to a row at any width. */
const SHORT_TILE_BLOCKS = 2;
/** Word tiles sit two to a row from this width (the regular class). */
const REGULAR_WIDTH = 600;

/**
 * Tile columns (wireframe Box diagram): two for one- or two-block tiles (particles) at every width; word tiles one
 * column on a phone and two from the regular width.
 */
export function clozeColumns(round: Pick<ClozePickRound, 'tiles'>, width: number): 1 | 2 {
  const longest = Math.max(...round.tiles.map((t) => [...t.ko].length));
  if (longest <= SHORT_TILE_BLOCKS) return 2;
  return width >= REGULAR_WIDTH ? 2 : 1;
}
