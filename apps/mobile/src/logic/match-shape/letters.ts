import { JAMO_SOUND_VALUES } from '@hangul-route/content-schema';
import { findJamo } from '../../content/jamo';

/**
 * The letters of Match Shape (F-CURR-002 section 7.1 F4, row CM-33; design/wireframes/minigame/match-shape.md): a tile
 * shows the letter and, on an origin tile and once found on a pair tile, its isolated-letter value (`ㄱ` `g/k`, the
 * `romanization` every Stage 1 symbol carries, from `JAMO_SOUND_VALUES`). A screen reader names a pair tile by its
 * jamo and its romanized letter name (`ㅂ, letter bieup`), never by its sound, so a name never answers the round.
 */

export interface ShapeLetter {
  id: string;
  /** The compatibility jamo (`ㅂ`). */
  char: string;
  /** The romanized letter name (`bieup`; a vowel's name is its sound, `a`). */
  name: string;
  /** The isolated-letter value shown on a tile (`b/p`). */
  sound: string;
}

/** A letter of the app's symbol table; throws on an id that is not a letter (the content tests catch it). */
export function shapeLetter(id: string): ShapeLetter {
  const jamo = findJamo(id);
  if (jamo === undefined || jamo.kind === 'batchim') throw new Error(`${id} is not a letter`);
  return { id, char: jamo.char, name: jamo.nameEn, sound: jamo.romanization };
}

/**
 * Every sound a letter can stand for, its final value included (`ㅂ`: b, p; `ㅇ`: silent, ng). Read Pick never offers a
 * distractor whose sounds meet the target's (`read-pick-values-distinct`): ㅍ `p` is ㅂ's final value, so "p" is not
 * wrong for ㅂ.
 */
export function soundValues(char: string): ReadonlySet<string> {
  return new Set((JAMO_SOUND_VALUES[char] ?? []).flatMap((v) => v.split('/')));
}

/** Two letters whose sounds overlap. */
export function soundsMeet(a: string, b: string): boolean {
  const left = soundValues(a);
  return [...soundValues(b)].some((v) => left.has(v));
}

/** A sound value read as words for a screen reader (`g/k` -> "g or k"). */
export const soundWords = (sound: string): string => sound.split('/').join(' or ');
