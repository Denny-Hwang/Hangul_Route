import { REPRESENTATIVE_FINALS, syllableBuildIssues, type BlockParts, type SyllableZone } from '@hangul-route/content-schema';
import { seededRandom } from '../listen-pick';
import { finalSound } from './pool';

/**
 * The tile rows of a Syllable Build round the app builds itself (F-CURR-002 row CM-32): a review item at the produce
 * rung and a Decoding Sprint round. A quest round brings its own authored tiles. Each row is the target's letter and
 * others of its kind, in a seeded order: 4 first letters, 4 vowels and 3 finals (the 4th tile of the final row is No
 * final), so four 64 tiles fit the 288 of a 320 window. The finals keep `syllable-build-final-distinct`: the seven final
 * sounds only, never two that sound alike, and the target's own final.
 */

export interface TileRows {
  firstTiles: string[];
  vowelTiles: string[];
  finalTiles: string[];
}

/** The 14 basic consonants and the 10 basic vowels the Stage 1 lessons teach first. */
export const BASIC_FIRST: readonly string[] = [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'];
export const BASIC_VOWELS: readonly string[] = [...'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'];
export const FIRST_ROW = 4;
export const VOWEL_ROW = 4;
export const FINAL_ROW = 3;

/** A seeded shuffle (Fisher-Yates over mulberry32); the input is not changed. */
export function shuffled<T>(list: readonly T[], seed: number): T[] {
  const next = seededRandom(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function row(own: string, pool: readonly string[], size: number, seed: number): string[] {
  const others = shuffled(
    pool.filter((l) => l !== own),
    seed,
  ).slice(0, size - 1);
  return shuffled([own, ...others], seed + 1);
}

/** The tile rows for a target block, deterministic for `seed`; the target's parts are always tiles of their rows. */
export function tilesFor(parts: BlockParts, seed: number): TileRows {
  const own = parts.final;
  const heard = new Set(own === null ? [] : [finalSound(own)]);
  const finals: string[] = own === null ? [] : [own];
  for (const f of shuffled(REPRESENTATIVE_FINALS, seed + 7)) {
    if (finals.length >= FINAL_ROW) break;
    if (heard.has(finalSound(f))) continue;
    heard.add(finalSound(f));
    finals.push(f);
  }
  return {
    firstTiles: row(parts.first, BASIC_FIRST, FIRST_ROW, seed + 11),
    vowelTiles: row(parts.vowel, BASIC_VOWELS, VOWEL_ROW, seed + 23),
    finalTiles: shuffled(finals, seed + 31),
  };
}

/** Whether rows for a target keep every rule of the round schema (the review and the sprint check before they ask). */
export function tilesSound(target: { ko: string; en?: string | undefined }, rows: TileRows, fixedZone?: SyllableZone): boolean {
  return syllableBuildIssues({ target, ...rows, fixedZone }).length === 0;
}
