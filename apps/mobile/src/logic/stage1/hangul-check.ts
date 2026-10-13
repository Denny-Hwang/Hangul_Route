import type { KoText, ListenPickRound, PictureRef, ThemeKey } from '@hangul-route/content-schema';
import { findJamo, jamoAll } from '../../content/jamo';
import { seededRandom, shuffleOptions } from '../listen-pick';
import { lp } from '../scope-builders';

/**
 * The Hangul Check (F-QUEST-002 §3.9): the Stage 1 configuration of F-RVW-001's Stage Review.
 * 35 items, pure and deterministic by seed: one per symbol (30) and one word per theme episode
 * (5), in 5 chunks of 7 (6 symbols, then the chunk's word). A consonant or vowel is heard as its
 * sound and picked among the target and its first three confusables; a final is heard as the
 * syllable ㅇ + ㅏ + final and picked among syllables that differ only in the final; a word is
 * heard and its picture picked. Each round's id is the item id, so the review host credits the
 * right item. Taught Korean here is registered with F-CNT-002 (romanization-registry).
 */

export const HANGUL_CHECK_CHUNK = 7;
/** Symbols per chunk; the chunk's last item is its word. */
const SYMBOLS_PER_CHUNK = 6;

export type HangulCheckItemKind = 'symbol' | 'word';

export interface HangulCheckItem {
  /** A jamo id for a symbol (`jamo:giyeok`, `jamo:nieun-batchim`), `word:<romanization>` for a word. */
  id: string;
  kind: HangulCheckItemKind;
  round: ListenPickRound;
}

export interface HangulCheck {
  items: HangulCheckItem[];
  chunks: HangulCheckItem[][];
}

export interface HangulCheckWord {
  id: string;
  theme: ThemeKey;
  text: KoText;
  picture: PictureRef;
}

/** One word per theme episode, each with its card picture (F-QUEST-002 §3.9). */
export const HANGUL_CHECK_WORDS: readonly HangulCheckWord[] = [
  { id: 'word:hangeul', theme: 'letters', text: { ko: '한글', romanization: 'hangeul', en: 'the Korean alphabet' }, picture: 'card:hangul-day' },
  { id: 'word:bap', theme: 'life', text: { ko: '밥', romanization: 'bap', en: 'rice' }, picture: 'card:rice' },
  { id: 'word:hanbok', theme: 'rites', text: { ko: '한복', romanization: 'hanbok', en: 'hanbok' }, picture: 'card:hanbok' },
  { id: 'word:san', theme: 'nature', text: { ko: '산', romanization: 'san', en: 'mountain' }, picture: 'card:mountain' },
  { id: 'word:yeon', theme: 'crafts', text: { ko: '연', romanization: 'yeon', en: 'kite' }, picture: 'card:kite' },
];

/**
 * The three other syllables a final is told apart from: no final (아) and two finals that sound
 * close to it (a stop with its nasal, the two liquids and nasals). Same initial and vowel.
 */
const FINAL_DISTRACTORS: Readonly<Record<string, readonly [string, string, string]>> = {
  'jamo:giyeok-batchim': ['아', '앙', '압'],
  'jamo:nieun-batchim': ['아', '알', '앙'],
  'jamo:rieul-batchim': ['아', '안', '암'],
  'jamo:mieum-batchim': ['아', '압', '안'],
  'jamo:bieup-batchim': ['아', '암', '악'],
  'jamo:ieung-batchim': ['아', '안', '악'],
};

const ALL_SYMBOL_IDS: readonly string[] = jamoAll.map((j) => j.id);

/** A symbol item id (a jamo id); anything else is a word item. */
export function isSymbolItem(id: string): boolean {
  return id.startsWith('jamo:');
}

function symbolRound(jamoId: string): ListenPickRound {
  const jamo = findJamo(jamoId);
  if (!jamo) throw new Error(`Unknown symbol ${jamoId}`);
  if (jamo.kind !== 'batchim') return { ...lp.sym(jamoId, ALL_SYMBOL_IDS), id: jamoId };
  const distractors = FINAL_DISTRACTORS[jamoId];
  if (!distractors || jamo.spokenKo === undefined) throw new Error(`No final syllables for ${jamoId}`);
  return { ...lp.syl(jamo.spokenKo, distractors), id: jamoId };
}

function wordRound(word: HangulCheckWord, rnd: () => number): ListenPickRound {
  // Four of the five pictures: the answer and three others (one other left out per attempt).
  const others = HANGUL_CHECK_WORDS.filter((w) => w.id !== word.id);
  const dropped = Math.floor(rnd() * others.length);
  const pictures = [word.picture, ...others.filter((_, i) => i !== dropped).map((w) => w.picture)];
  return { ...lp.pic(word.text, pictures), id: word.id };
}

function shuffled<T>(list: readonly T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function buildHangulCheck({ seed }: { seed: number }): HangulCheck {
  const rnd = seededRandom(seed);
  const symbolIds = shuffled(ALL_SYMBOL_IDS, rnd);
  const chunks = HANGUL_CHECK_WORDS.map((word, c) => {
    const symbols = symbolIds
      .slice(c * SYMBOLS_PER_CHUNK, (c + 1) * SYMBOLS_PER_CHUNK)
      .map((id): HangulCheckItem => ({ id, kind: 'symbol', round: symbolRound(id) }));
    return [...symbols, { id: word.id, kind: 'word' as const, round: wordRound(word, rnd) }];
  });
  // Option order per attempt: the builders put the answer first; the seed moves it.
  const seeded = chunks.map((chunk, c) =>
    chunk.map((item, i) => ({ ...item, round: shuffleOptions(item.round, seed * 64 + c * HANGUL_CHECK_CHUNK + i) })),
  );
  return { items: seeded.flat(), chunks: seeded };
}
