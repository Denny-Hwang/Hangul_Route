import { blockParts, composeSyllable, finalSoundOf, REPRESENTATIVE_FINALS, romanizeWord, MEDIAL_JAMO, type BlockParts } from '@hangul-route/content-schema';
import pool from './decode-pool.json';

/**
 * The real blocks Syllable Build and the Decoding Sprint may play (F-CURR-002 section 7.1 F3 and F9, section 19
 * assumption 5, row CM-32): never a pseudo-word, because device voices read some non-words unpredictably.
 *
 * - `stage1`: the blocks of the Stage 1 table (the `syl` items and the one-block words of
 *   `packages/content-schema/src/review-items/stage1-items.json`) whose final, if any, is one of the seven final sounds,
 *   so a heard round can tell it apart (붓 and 윷 are left out). A test keeps it equal to the table.
 * - `allowlist`: more real blocks: the chart syllables of the 14 basic consonants with ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ (the rows Korean
 *   primers teach) and one-block everyday words with one of the seven final sounds. The device voice is tested on every
 *   block of both lists (`scripts/decode-voice-check.mjs`: each is said as one syllable, and two blocks sound the same
 *   only when their sound keys match; the spec's CM-32 decision record has the run).
 * - `probe`: the held-out blocks, all from the allowlist and none from the Stage 1 table: the end-of-sprint probe asks
 *   only these, and no drill round ever shows one, as its answer or as an option, so the probe measures decoding of
 *   blocks never drilled in any sprint (G9).
 */

export const STAGE1_BLOCKS: readonly string[] = pool.stage1;
export const ALLOWLIST_BLOCKS: readonly string[] = pool.allowlist;
export const PROBE_BLOCKS: readonly string[] = pool.probe;

/** Every real block: the Stage 1 table and the allowlist. */
export const REAL_BLOCKS: ReadonlySet<string> = new Set([...STAGE1_BLOCKS, ...ALLOWLIST_BLOCKS]);
const PROBE: ReadonlySet<string> = new Set(PROBE_BLOCKS);
/** The blocks a drill round may show: every real block but the held-out probe. */
export const DRILL_BLOCKS: readonly string[] = [...REAL_BLOCKS].filter((b) => !PROBE.has(b));

export const isRealBlock = (ko: string): boolean => REAL_BLOCKS.has(ko);
export const isProbeBlock = (ko: string): boolean => PROBE.has(ko);

/** A block's romanization (rr.ts); every block here has one. */
export function romanizationOf(ko: string): string {
  return romanizeWord(ko) ?? ko;
}

/** The parts of a block of the pool, or of any one-letter-final block. */
export function partsOf(ko: string): BlockParts | null {
  return blockParts(ko);
}

/** The block of three parts, or null (a part that is not a letter of its zone). */
export function blockOf(parts: BlockParts): string | null {
  const medial = MEDIAL_JAMO.indexOf(parts.vowel);
  return composeSyllable({ initial: parts.first, medial, final: parts.final ?? '' });
}

/** Whether a block's final can be told by ear (none, or one of the seven final sounds). */
export function heardFinal(parts: BlockParts): boolean {
  return parts.final === null || REPRESENTATIVE_FINALS.includes(parts.final);
}

/** How a block sounds alone: its first letter, vowel and final sound. Two blocks with the same key sound the same (밥 / 밮). */
export function blockSoundKey(parts: BlockParts): string {
  return `${parts.first}${parts.vowel}${parts.final === null ? '' : finalSoundOf(parts.final) ?? parts.final}`;
}

/** The sound key of a block (two blocks that sound the same share it). */
export function soundKeyOf(ko: string): string {
  const parts = blockParts(ko);
  return parts === null ? ko : blockSoundKey(parts);
}

/** The sound a final is heard as, for the final-distinct rule. */
export const finalSound = (letter: string): string => finalSoundOf(letter) ?? letter;
