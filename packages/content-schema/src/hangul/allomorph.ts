/**
 * Particle and ending allomorphs that follow the word before them (F-CURR-001
 * §3.7, row C-1). A Write Frame shows the form that fits the learner's pick,
 * so the finished sentence is always correct Korean. Pure, Hermes-safe.
 */
import { decomposeSyllable } from '../romanization/hangul';
import { SLOT_MARKER } from '../schemas/quest';

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
