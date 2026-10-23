import { FINAL_JAMO, INITIAL_JAMO, decomposeSyllable } from '../romanization/hangul';
import { MEDIAL_JAMO } from './compose-typed';

/**
 * The parts of a Syllable Build round (F-CURR-002 section 7.1 F3, row CM-32; design/wireframes/minigame/syllable-build.md):
 * a block split into its first letter, vowel and final, and the final-sound rules the round's tiles keep. Pure,
 * Hermes-safe Unicode arithmetic; no content.
 */

export type SyllableZone = 'first' | 'vowel' | 'final';
export const SYLLABLE_ZONES: readonly SyllableZone[] = ['first', 'vowel', 'final'];

/** One block as the build zones hold it: compatibility jamo; `final` is null when the block has none. */
export interface BlockParts {
  first: string;
  vowel: string;
  final: string | null;
}

/** The two-letter finals (ㄳ ㄺ ...): spoken as one of the seven sounds, so a heard round never asks them (open question 1). */
const DOUBLE_FINALS: ReadonlySet<string> = new Set(['ㄳ', 'ㄵ', 'ㄶ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅄ']);

/** The letters a first-letter tile may carry (the 19 initials). */
export const FIRST_LETTERS: readonly string[] = INITIAL_JAMO;
/** The letters a vowel tile may carry (the 21 vowels). */
export const VOWEL_LETTERS: readonly string[] = MEDIAL_JAMO;
/** The letters a final tile may carry: one letter each, never a two-letter final. */
export const FINAL_LETTERS: readonly string[] = FINAL_JAMO.filter((f) => f !== '' && !DOUBLE_FINALS.has(f));

/** The seven representative final sounds (받침 대표음): the only finals a heard round tells apart by ear. */
export const REPRESENTATIVE_FINALS: readonly string[] = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅇ'];

const FINAL_SOUND: Readonly<Record<string, string>> = {
  ㄱ: 'ㄱ',
  ㄲ: 'ㄱ',
  ㅋ: 'ㄱ',
  ㄴ: 'ㄴ',
  ㄷ: 'ㄷ',
  ㅅ: 'ㄷ',
  ㅆ: 'ㄷ',
  ㅈ: 'ㄷ',
  ㅊ: 'ㄷ',
  ㅌ: 'ㄷ',
  ㅎ: 'ㄷ',
  ㄹ: 'ㄹ',
  ㅁ: 'ㅁ',
  ㅂ: 'ㅂ',
  ㅍ: 'ㅂ',
  ㅇ: 'ㅇ',
};

/** The sound a one-letter final is said as at the end of a block (ㅍ -> ㅂ, ㅅ -> ㄷ); undefined for a letter that is not one. */
export function finalSoundOf(letter: string): string | undefined {
  return FINAL_SOUND[letter];
}

/** A block split into its zones, or null when `ko` is not exactly one Hangul block or its final is a two-letter one. */
export function blockParts(ko: string): BlockParts | null {
  const parts = decomposeSyllable(ko);
  if (parts === null || DOUBLE_FINALS.has(parts.final)) return null;
  return { first: parts.initial, vowel: MEDIAL_JAMO[parts.medial] as string, final: parts.final === '' ? null : parts.final };
}

/** How a block sounds alone: its first letter, vowel and final sound. Two blocks with the same key sound the same (밥 / 밮). */
export function blockSoundKey(parts: BlockParts): string {
  return `${parts.first}${parts.vowel}${parts.final === null ? '' : finalSoundOf(parts.final) ?? parts.final}`;
}

export interface SyllableBuildTiles {
  target: { ko: string; en?: string | undefined };
  firstTiles: readonly string[];
  vowelTiles: readonly string[];
  finalTiles: readonly string[];
  fixedZone?: SyllableZone | undefined;
}

/**
 * The problems of a Syllable Build round's tiles, each with its path (empty = sound):
 * - the target is one block with a one-letter final or none, and each of its parts is a tile of its row;
 * - each row holds letters of its kind, once;
 * - **`syllable-build-final-distinct`**: no two final tiles sound the same (밥 offers ㅂ, never ㅂ and ㅍ), and every final
 *   tile is one of the seven final sounds, except the target's own final, which may be another letter only when the
 *   round shows the word's meaning (`en`), the cue that settles the spelling (the S2 word families);
 * - a fixed final zone needs a final.
 */
export function syllableBuildIssues(round: SyllableBuildTiles): Array<{ path: (string | number)[]; message: string }> {
  const out: Array<{ path: (string | number)[]; message: string }> = [];
  const issue = (path: (string | number)[], message: string): void => {
    out.push({ path, message });
  };
  const rows: ReadonlyArray<readonly ['firstTiles' | 'vowelTiles' | 'finalTiles', readonly string[], string]> = [
    ['firstTiles', FIRST_LETTERS, 'a first letter'],
    ['vowelTiles', VOWEL_LETTERS, 'a vowel'],
    ['finalTiles', FINAL_LETTERS, 'a one-letter final'],
  ];
  for (const [key, allowed, what] of rows) {
    const tiles = round[key];
    tiles.forEach((tile, i) => {
      if (!allowed.includes(tile)) issue([key, i], `${tile} is not ${what}`);
    });
    if (new Set(tiles).size !== tiles.length) issue([key], 'a tile is listed once in its row');
  }
  const parts = blockParts(round.target.ko);
  if (parts === null) {
    issue(['target', 'ko'], 'the target is one Hangul block with a one-letter final or none');
    return out;
  }
  if (!round.firstTiles.includes(parts.first)) issue(['firstTiles'], `the target's first letter ${parts.first} is not a tile`);
  if (!round.vowelTiles.includes(parts.vowel)) issue(['vowelTiles'], `the target's vowel ${parts.vowel} is not a tile`);
  if (parts.final !== null && !round.finalTiles.includes(parts.final)) issue(['finalTiles'], `the target's final ${parts.final} is not a tile`);
  const sounds = new Map<string, string>();
  round.finalTiles.forEach((tile, i) => {
    const sound = finalSoundOf(tile);
    if (sound === undefined) return;
    const other = sounds.get(sound);
    if (other !== undefined) issue(['finalTiles', i], `syllable-build-final-distinct: ${tile} and ${other} sound the same at the end of a block`);
    else sounds.set(sound, tile);
    const own = tile === parts.final;
    if (!REPRESENTATIVE_FINALS.includes(tile) && !(own && round.target.en !== undefined)) {
      issue(['finalTiles', i], `syllable-build-final-distinct: ${tile} is heard as ${sound}; a heard round offers the seven final sounds, and another final only as the target's own with its meaning shown`);
    }
  });
  if (round.fixedZone === 'final' && parts.final === null) issue(['fixedZone'], 'a fixed final zone needs a target with a final');
  return out;
}
