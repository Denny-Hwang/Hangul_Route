import { FINAL_JAMO, INITIAL_JAMO, decomposeSyllable } from '../romanization/hangul';
import { MEDIAL_JAMO } from './compose-typed';

/**
 * The parts of a Syllable Build round (F-CURR-002 section 7.1 F3, row CM-32; design/wireframes/minigame/syllable-build.md):
 * a block split into its first letter, vowel and final, and the final-sound rule the round's tiles keep. Pure,
 * Hermes-safe Unicode arithmetic; no content. Kept lean: the package barrel is in the app's start bundle, so the app's
 * own helpers (sound keys, tile rows) live in its Syllable Build chunk.
 */

export type SyllableZone = 'first' | 'vowel' | 'final';

/** One block as the build zones hold it: compatibility jamo; `final` is null when the block has none. */
export interface BlockParts {
  first: string;
  vowel: string;
  final: string | null;
}

/**
 * A one-letter final: a final that is also a first letter (ㄱ ㄲ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅆ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ). The two-letter finals
 * (ㄳ ㄺ ...) are said as one of the seven sounds, so a heard round never asks them (open question 1).
 */
export const isOneLetterFinal = (f: string): boolean => f !== '' && FINAL_JAMO.includes(f) && INITIAL_JAMO.includes(f);

/** The seven representative final sounds (받침 대표음): the only finals a heard round tells apart by ear. */
export const REPRESENTATIVE_FINALS: readonly string[] = [...'ㄱㄴㄷㄹㅁㅂㅇ'];

/** The one-letter finals by the sound they are said as, that sound first. */
const SOUND_GROUPS = ['ㄱㄲㅋ', 'ㄴ', 'ㄷㅅㅆㅈㅊㅌㅎ', 'ㄹ', 'ㅁ', 'ㅂㅍ', 'ㅇ'];

/** The sound a one-letter final is said as at the end of a block (ㅍ -> ㅂ, ㅅ -> ㄷ); undefined for a letter that is not one. */
export function finalSoundOf(letter: string): string | undefined {
  return letter.length === 1 ? SOUND_GROUPS.find((g) => g.includes(letter))?.[0] : undefined;
}

/** A block split into its zones, or null when `ko` is not exactly one Hangul block or its final is a two-letter one. */
export function blockParts(ko: string): BlockParts | null {
  const p = decomposeSyllable(ko);
  if (p === null || (p.final !== '' && !isOneLetterFinal(p.final))) return null;
  return { first: p.initial, vowel: MEDIAL_JAMO[p.medial] as string, final: p.final === '' ? null : p.final };
}

export interface SyllableBuildTiles {
  target: { ko: string; en?: string | undefined };
  firstTiles: readonly string[];
  vowelTiles: readonly string[];
  finalTiles: readonly string[];
  fixedZone?: SyllableZone | undefined;
}

type Issue = { path: (string | number)[]; message: string };

/**
 * The problems of a Syllable Build round's tiles, each with its path (empty = sound):
 * - each row holds letters of its kind, once; the target is one block with a one-letter final or none, and each of its
 *   parts is a tile of its row;
 * - **`syllable-build-final-distinct`**: no two final tiles sound the same (밥 offers ㅂ, never ㅂ and ㅍ), and every final
 *   tile is one of the seven final sounds, except the target's own final, which may be another letter only when the
 *   round shows the word's meaning (`en`), the cue that settles the spelling (the S2 word families);
 * - a fixed final zone needs a final.
 */
export function syllableBuildIssues(round: SyllableBuildTiles): Issue[] {
  const out: Issue[] = [];
  const kinds = [INITIAL_JAMO, MEDIAL_JAMO, null] as const;
  (['firstTiles', 'vowelTiles', 'finalTiles'] as const).forEach((key, k) => {
    const tiles = round[key];
    tiles.forEach((tile, i) => {
      if (!(kinds[k]?.includes(tile) ?? isOneLetterFinal(tile))) out.push({ path: [key, i], message: `${tile} is not a letter of this row` });
    });
    if (new Set(tiles).size !== tiles.length) out.push({ path: [key], message: 'a tile is listed once in its row' });
  });
  const parts = blockParts(round.target.ko);
  if (parts === null) return [...out, { path: ['target', 'ko'], message: 'the target is one block with a one-letter final or none' }];
  const own = [
    ['firstTiles', parts.first],
    ['vowelTiles', parts.vowel],
    ['finalTiles', parts.final],
  ] as const;
  for (const [key, letter] of own) {
    if (letter !== null && !round[key].includes(letter)) out.push({ path: [key], message: `the target's ${letter} is not a tile` });
  }
  const heard = new Set<string>();
  round.finalTiles.forEach((tile, i) => {
    const sound = finalSoundOf(tile);
    if (sound === undefined) return;
    const odd = !REPRESENTATIVE_FINALS.includes(tile) && !(tile === parts.final && round.target.en !== undefined);
    if (heard.has(sound) || odd) out.push({ path: ['finalTiles', i], message: `syllable-build-final-distinct: ${tile} is heard as ${sound}` });
    heard.add(sound);
  });
  if (round.fixedZone === 'final' && parts.final === null) out.push({ path: ['fixedZone'], message: 'a fixed final zone needs a final' });
  return out;
}
