/**
 * Particle and ending allomorphs that follow the word before them (F-CURR-001
 * §3.7, row C-1). A Write Frame shows the form that fits the learner's pick,
 * so the finished sentence is always correct Korean. Pure, Hermes-safe.
 */
import { decomposeSyllable } from '../romanization/hangul';

/**
 * The slot marker, the same `___` as `SLOT_MARKER` in `schemas/quest` (a test
 * checks). Kept here so the round schemas can import this module without a cycle.
 */
const SLOT_MARKER = '___';

/**
 * Every pair a frame may write, as `after a final consonant / after a vowel`.
 * 으로/로 also takes 로 after a final ㄹ (handled in `allomorph`).
 */
export const ALLOMORPH_PAIRS: readonly string[] = [
  '이/가',
  '을/를',
  '은/는',
  '과/와',
  '이에요/예요',
  '이었어요/였어요',
  '이랑/랑',
  '으로/로',
  '아/야',
];

/**
 * The particles and endings a frame may write after a slot that do not change
 * with the word before them. Anything else written right after a slot is a
 * content error (`slotEndingIssues`), so a frame like `___좋아해요` (a missing
 * space) is caught before it reaches a learner.
 */
export const SINGLE_FORMS: readonly string[] = ['에', '에서', '에게', '한테', '하고', '도', '만', '의', '까지', '부터', '처럼', '보다', '마다', '께'];

/** True when the last syllable of `word` has a final consonant (batchim); null when it does not end in a syllable block. */
export function endsWithFinal(word: string): boolean | null {
  const parts = decomposeSyllable(word.slice(-1));
  return parts === null ? null : parts.final !== '';
}

/**
 * The form of `pair` (one of `ALLOMORPH_PAIRS`) that follows `word`. A single
 * form (`에`, `하고`) is returned as it is. Throws on an unknown pair or a word
 * that does not end in a Hangul syllable block: frames and banks are authored
 * content, so either is a content error.
 */
export function allomorph(word: string, pair: string): string {
  if (!pair.includes('/')) return pair;
  if (!ALLOMORPH_PAIRS.includes(pair)) throw new Error(`unknown allomorph pair "${pair}"`);
  const final = endsWithFinal(word);
  if (final === null) throw new Error(`"${word}" does not end in a Hangul syllable block`);
  const [afterConsonant, afterVowel] = pair.split('/') as [string, string];
  if (pair === '으로/로' && decomposeSyllable(word.slice(-1))?.final === 'ㄹ') return afterVowel;
  return final ? afterConsonant : afterVowel;
}

/**
 * Like `allomorph`, but never throws on the word: when `word` does not end in a
 * syllable block (a learner still typing, e.g. `사ㄱ`, or an empty entry) it
 * returns the pair as written (`을/를`), so a free-entry round can always draw.
 */
export function allomorphOrBoth(word: string, pair: string): string {
  if (!pair.includes('/')) return pair;
  if (!ALLOMORPH_PAIRS.includes(pair)) throw new Error(`unknown allomorph pair "${pair}"`);
  return endsWithFinal(word) === null ? pair : allomorph(word, pair);
}

/** What may follow a slot's particle or ending: nothing, a space or sentence punctuation. */
const AFTER_ENDING_RE = /^($|[ .,?!])/;

/**
 * Why a frame's slots cannot be filled, one message per bad slot (none when it
 * is sound): each `___` is followed by a known pair from `ALLOMORPH_PAIRS`, a
 * form from `SINGLE_FORMS`, or a space, punctuation or the end of the frame,
 * and the ending itself ends at a space, punctuation or the end of the frame.
 */
export function slotEndingIssues(frame: string): string[] {
  const parts = frame.split(SLOT_MARKER);
  return parts.slice(1).flatMap((after, i) => {
    const ending = /^[가-힣]+(?:\/[가-힣]+)?/.exec(after)?.[0] ?? '';
    const known = ending === '' || ALLOMORPH_PAIRS.includes(ending) || SINGLE_FORMS.includes(ending);
    if (!known) return [`slot ${i + 1}: "${ending}" after ___ is not a known particle or ending pair`];
    if (!AFTER_ENDING_RE.test(after.slice(ending.length))) return [`slot ${i + 1}: the ending after ___ runs into the next word`];
    return [];
  });
}

/** One slot marker and the particle or ending written right after it (`___을/를`, `___에`, or none). */
const SLOT_RE = new RegExp(`${SLOT_MARKER}([가-힣]+(?:/[가-힣]+)?)?`, 'g');

/**
 * The frame with each slot filled by its pick, in order, and each slot's
 * particle or ending replaced by the form that fits the pick:
 * `fillFrame('저는 ___을/를 좋아해요', ['사과'])` is `저는 사과를 좋아해요`.
 * Throws when the number of picks differs from the number of slots.
 */
export function fillFrame(frame: string, picks: readonly string[]): string {
  const slots = frame.split(SLOT_MARKER).length - 1;
  if (slots !== picks.length) throw new Error(`the frame has ${slots} slot(s) but ${picks.length} pick(s)`);
  let i = 0;
  return frame.replace(SLOT_RE, (_match, ending: string | undefined) => {
    const pick = picks[i++] as string;
    return ending === undefined ? pick : pick + allomorph(pick, ending);
  });
}
