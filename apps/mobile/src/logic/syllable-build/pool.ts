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
 * - `probeForms`: the held-out blocks, all from the allowlist and none from the Stage 1 table, in 4 matched forms of 6
 *   (each: an open block with ㅗ, one with ㅜ and one with ㅣ, and a closed block ending in ㄴ or ㄹ, one in ㅁ and one
 *   in ㅇ). A sprint's probe asks one whole form, the n-th sprint form (n - 1) mod 4, so the first four sprints each
 *   probe blocks never shown before and G9's first sprint is read against the fourth on blocks new to both. No drill
 *   round ever shows a probe block, as its answer or as an option, and no probe round offers another probe block. No
 *   probe block is a review item or a taught word of any stage (`items-stable-id.json`, the vocab topics); the open
 *   ones are chart syllables, which only the Stage 7 letters review and the placement check also print.
 */

export const STAGE1_BLOCKS: readonly string[] = pool.stage1;
export const ALLOWLIST_BLOCKS: readonly string[] = pool.allowlist;
/** The probe's matched forms, in the order sprints take them. */
export const PROBE_FORMS: readonly (readonly string[])[] = pool.probeForms;
export const PROBE_BLOCKS: readonly string[] = PROBE_FORMS.flat();

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
