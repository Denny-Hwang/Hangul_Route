import { romanizeWord, type KoText, type TraceWordRound } from '@hangul-route/content-schema';
import { placeWordStrokes, type PlacedBlock, type StrokeLookup } from './block-strokes';

/**
 * Trace a Word rounds (F-CURR-001 §3.7 item 3; wireframe minigame/trace-word.md): each
 * authored round with its blocks placed from the jamo stroke data. A word the stroke data
 * cannot draw is left out (never a canvas with a missing letter); no word left is the
 * shell's empty state. Pure.
 */

/** `block`: the whole block over its ghost; `letter`: one letter at a time in its zone (§9 assumption 3). */
export type TraceWordMode = 'block' | 'letter';

export interface TraceWordBlock {
  syllable: string;
  /** The block said on its own (the chip plays it alone): the second block of `ireum` is `reum`. */
  romanization: string;
  placed: PlacedBlock;
}

export interface TraceWordPlayRound {
  id: string;
  word: KoText;
  mode: TraceWordMode;
  blocks: TraceWordBlock[];
  /** The round's own coverage tolerance (viewBox units), when the content sets one. */
  tolerance?: number;
}

export function buildTraceWordRounds(rounds: readonly TraceWordRound[], lookup: StrokeLookup): TraceWordPlayRound[] {
  const out: TraceWordPlayRound[] = [];
  for (const round of rounds) {
    const placed = placeWordStrokes(round.word.ko, lookup);
    if (!placed) continue;
    const blocks = placed.map((block) => ({
      syllable: block.syllable,
      // A placed block is always one Hangul syllable, which always romanizes.
      romanization: romanizeWord(block.syllable) as string,
      placed: block,
    }));
    out.push({
      id: round.id,
      word: round.word,
      mode: round.mode ?? 'block',
      blocks,
      ...(round.tolerancePx === undefined ? {} : { tolerance: round.tolerancePx }),
    });
  }
  return out;
}

/** How many letters each block has: the steps of a letter-mode round. */
export function letterCounts(round: Pick<TraceWordPlayRound, 'blocks'>): number[] {
  return round.blocks.map((b) => b.placed.letters.length);
}
