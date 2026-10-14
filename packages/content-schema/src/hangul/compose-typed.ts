/**
 * Hangul composition for the in-app two-set (dubeolsik, KS X 5002) keyboard
 * (F-CURR-001 §3.7, rows C-1 and G-3). The keyboard sends one key per jamo
 * (a tense consonant is its own shifted key); this module turns the key
 * sequence into syllable blocks, hands a final consonant over to the next
 * syllable when a vowel follows, and deletes by jamo. Composition is a pure
 * function of the keys, so backspace is "drop the last key and compose again".
 * Pure, dependency-light, Hermes-safe (no Unicode property escapes).
 */
import { composeSyllable, decomposeSyllable, FINAL_JAMO, INITIAL_JAMO } from '../romanization/hangul';

/** The 21 medial vowels as compatibility jamo, in Unicode order (index = medial index). */
export const MEDIAL_JAMO: readonly string[] = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ',
  'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

/** The backspace key. */
export const BACKSPACE = 'Backspace';

/** Two vowel keys that join into one medial. */
const JOINED_VOWELS: Readonly<Record<string, string>> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ',
};
/** Two consonant keys that join into one double final. */
const JOINED_FINALS: Readonly<Record<string, string>> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ',
  'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ',
};
const SPLIT_VOWEL: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(JOINED_VOWELS).map(([k, v]) => [v, k]));
const SPLIT_FINAL: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(JOINED_FINALS).map(([k, v]) => [v, k]));

const isConsonantKey = (key: string): boolean => INITIAL_JAMO.includes(key);
const isVowelKey = (key: string): boolean => MEDIAL_JAMO.includes(key);

/** The syllable being typed: any of its parts may still be missing. */
interface Block {
  initial: string;
  medial: string;
  final: string;
}

function render(b: Block): string {
  if (b.initial !== '' && b.medial !== '') {
    return composeSyllable({ initial: b.initial, medial: MEDIAL_JAMO.indexOf(b.medial), final: b.final }) as string;
  }
  return b.initial + b.medial;
}

const EMPTY: Block = { initial: '', medial: '', final: '' };

/**
 * The text a key sequence composes. Keys are compatibility jamo (one key each,
 * including a joined vowel or double final typed as one key), `' '`, any other
 * character (passed through), or `BACKSPACE`, which deletes the last jamo typed.
 */
export function composeTyped(keys: readonly string[]): string {
  const typed: string[] = [];
  for (const key of keys) {
    if (key === BACKSPACE) typed.pop();
    else typed.push(key);
  }
  let out = '';
  let b: Block = EMPTY;
  const commit = (next: Block = EMPTY): void => {
    out += render(b);
    b = next;
  };
  for (const key of typed) {
    if (isConsonantKey(key)) {
      if (b.initial !== '' && b.medial !== '' && b.final === '' && FINAL_JAMO.includes(key)) {
        b = { ...b, final: key };
      } else if (b.final !== '' && JOINED_FINALS[b.final + key] !== undefined) {
        b = { ...b, final: JOINED_FINALS[b.final + key] as string };
      } else {
        commit({ initial: key, medial: '', final: '' });
      }
    } else if (isVowelKey(key)) {
      if (b.final !== '') {
        // Hand-over: the final (or the second half of a double final) starts the next syllable.
        const split = SPLIT_FINAL[b.final];
        const [stay, move] = split === undefined ? ['', b.final] : [split[0] as string, split[1] as string];
        b = { ...b, final: stay };
        commit({ initial: move, medial: key, final: '' });
      } else if (b.medial !== '' && JOINED_VOWELS[b.medial + key] !== undefined) {
        b = { ...b, medial: JOINED_VOWELS[b.medial + key] as string };
      } else if (b.initial !== '' && b.medial === '') {
        b = { ...b, medial: key };
      } else {
        commit({ initial: '', medial: key, final: '' });
      }
    } else {
      commit();
      out += key;
    }
  }
  commit();
  return out;
}

/**
 * The keys that type `text` on the two-set keyboard: each syllable block as
 * its initial, its vowel (a joined vowel as its two keys) and its final (a
 * double final as its two keys). Characters that are not syllable blocks are
 * one key each. `composeTyped(keysFor(text)) === text` for syllable text.
 */
export function keysFor(text: string): string[] {
  return [...text].flatMap((ch) => {
    const parts = decomposeSyllable(ch);
    if (parts === null) return [ch];
    const medial = MEDIAL_JAMO[parts.medial] as string;
    const vowelKeys = SPLIT_VOWEL[medial]?.split('') ?? [medial];
    const finalKeys = parts.final === '' ? [] : (SPLIT_FINAL[parts.final]?.split('') ?? [parts.final]);
    return [parts.initial, ...vowelKeys, ...finalKeys];
  });
}
