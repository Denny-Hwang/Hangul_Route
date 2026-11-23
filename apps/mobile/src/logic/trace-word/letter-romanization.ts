import { decomposeSyllable, INITIAL_JAMO, INITIAL_RR, MEDIAL_RR } from '@hangul-route/content-schema';
import { findJamo } from '../../content/jamo';
import type { PlacedLetter } from './block-strokes';

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §3.2 (wireframe minigame/trace-stroke-shape-guide.md §7): the romanization of
 * one letter of a block, for Show me's screen-reader label in letter mode ("o, shape guide."). Never a Hangul glyph:
 * - a vowel (ㅗ, or a compound ㅘ) reads its vowel in the block (`MEDIAL_RR`: "o", "wa");
 * - a plain consonant reads the symbol's own romanization ("h", "silent/ng"; a final its final's: "m");
 * - a double initial reads its initial ("kk"); a double final its parts, in writing order.
 * `fallback` (the block's romanization) when nothing fits.
 */
export function letterRomanization(
  letter: Pick<PlacedLetter, 'role' | 'char' | 'jamoIds'>,
  syllable: string,
  fallback: string,
): string {
  if (letter.role === 'vowel') {
    const parts = decomposeSyllable(syllable);
    return parts ? (MEDIAL_RR[parts.medial] ?? fallback) : fallback;
  }
  const own = (id: string): string | undefined =>
    (letter.role === 'final' ? findJamo(`${id}-batchim`) : undefined)?.romanization ?? findJamo(id)?.romanization;
  if (letter.jamoIds.length === 1) return own(letter.jamoIds[0]!) ?? fallback;
  if (letter.role === 'initial') {
    const i = INITIAL_JAMO.indexOf(letter.char);
    if (i >= 0) return INITIAL_RR[i]!;
  }
  const parts = letter.jamoIds.map(own);
  return parts.length > 0 && parts.every((r) => r !== undefined) ? parts.join('') : fallback;
}
