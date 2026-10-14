import type { KoText, OrderItRound } from '@hangul-route/content-schema';
import { shuffle } from '../shuffle';

/**
 * Sentence Builder rounds (F-CURR-001 §3.4, §3.7; wireframe minigame/sentence-builder.md,
 * "Data needs"): what one `order-it` round of the C-1 schema becomes on screen. Pure.
 *
 * - A word is one 어절 of `sentence.ko` split at its spaces, with the romanized word at the
 *   same index of `sentence.romanization` (nothing is computed). The sentence mark (. ? !)
 *   stays on the whole sentence and is left off the tiles.
 * - An order round opens every word; the tray holds the words and the distractors in a
 *   deranged order (never already the sentence).
 * - A round with `particle` is particle-only: every other word is pre-placed, the particle
 *   word shows its stem (Korean only) with one attached slot, and the tray holds the two
 *   choices in a random order. A particle round never carries distractors.
 */

export interface SbWord {
  ko: string;
  /** The romanized word; empty when the sentence's romanization does not split one word per word. */
  romanization: string;
}

export interface SbTile {
  /** `w<i>` a word of the sentence, `d<i>` a distractor, `c<i>` a particle choice. */
  id: string;
  ko: string;
  romanization: string;
}

export interface SbParticle {
  /** The word (0-based) whose ending the learner picks. */
  word: number;
  /** The word without its ending: drawn as a given, Korean only. */
  stem: string;
  /** The choice that ends the word. */
  answer: string;
}

export interface SbRound {
  id: string;
  sentence: KoText;
  pictureRef?: string;
  words: SbWord[];
  /** The word indexes the learner fills, in order: every word, or the particle word alone. */
  open: number[];
  particle?: SbParticle;
  /** The tiles to tap, in tray order. */
  tray: SbTile[];
}

/** A sentence holds 2-6 word tiles (C-1). */
export const MIN_WORDS = 2;
export const MAX_WORDS = 6;

const SENTENCE_MARK = /[.?!]+$/;

/** A word or a romanized word without the sentence mark it ends with. */
export const withoutMark = (text: string): string => text.replace(SENTENCE_MARK, '');

function wordsOf(sentence: KoText): SbWord[] {
  const kos = sentence.ko.trim().split(/\s+/).map(withoutMark);
  const roms = sentence.romanization.trim().split(/\s+/).map(withoutMark);
  const paired = roms.length === kos.length;
  return kos.map((ko, i) => ({ ko, romanization: paired ? (roms[i] as string) : '' }));
}

/** Whether the tiles of the sentence sit in the tray in the sentence's own order. */
function inSentenceOrder(tray: readonly SbTile[], words: readonly SbWord[]): boolean {
  const order = tray.filter((t) => t.id.startsWith('w')).map((t) => t.ko);
  return order.every((ko, i) => ko === words[i]?.ko);
}

/**
 * The seeded shuffle, turned until the sentence's tiles are out of order. Rotating moves the
 * first tile to the end, so a run of rotations always breaks the order unless every word reads
 * the same (then no order can differ and the shuffle stands).
 */
export function derange(tiles: readonly SbTile[], words: readonly SbWord[], seed: number): SbTile[] {
  let tray = shuffle(tiles, seed);
  for (let turn = 0; turn < tray.length && inSentenceOrder(tray, words); turn++) {
    tray = [...tray.slice(1), tray[0] as SbTile];
  }
  return tray;
}

function particleOf(round: OrderItRound, words: readonly SbWord[]): SbParticle | null | undefined {
  const { particle } = round;
  if (!particle) return undefined;
  const word = words[particle.tile];
  if (!word) return null;
  const fitting = particle.choices.filter((c) => word.ko.endsWith(c.ko) && word.ko.length > c.ko.length);
  if (fitting.length !== 1 || particle.choices[0].ko === particle.choices[1].ko) return null;
  const answer = (fitting[0] as KoText).ko;
  return { word: particle.tile, stem: word.ko.slice(0, -answer.length), answer };
}

/** One playable round, or null when the round cannot be played (the empty state, wireframe "States"). */
export function buildRound(round: OrderItRound, seed: number): SbRound | null {
  const words = wordsOf(round.sentence);
  if (words.length < MIN_WORDS || words.length > MAX_WORDS) return null;
  const base = {
    id: round.id,
    sentence: round.sentence,
    ...(round.pictureRef === undefined ? {} : { pictureRef: round.pictureRef }),
    words,
  };
  const particle = particleOf(round, words);
  if (particle === null) return null;
  if (particle) {
    const choices = round.particle!.choices.map((c, i) => ({ id: `c${i}`, ko: c.ko, romanization: withoutMark(c.romanization) }));
    return { ...base, open: [particle.word], particle, tray: shuffle(choices, seed) };
  }
  const tiles: SbTile[] = [
    ...words.map((w, i) => ({ id: `w${i}`, ko: w.ko, romanization: w.romanization })),
    ...round.distractors.map((d, i) => ({ id: `d${i}`, ko: withoutMark(d.ko), romanization: withoutMark(d.romanization) })),
  ];
  return { ...base, open: words.map((_, i) => i), tray: derange(tiles, words, seed) };
}

/** The scope's playable rounds, each shuffled from `seed + its index`. */
export function buildRounds(rounds: readonly OrderItRound[] | undefined, seed: number): SbRound[] {
  return (rounds ?? []).flatMap((r, i) => {
    const built = buildRound(r, seed + i);
    return built ? [built] : [];
  });
}
