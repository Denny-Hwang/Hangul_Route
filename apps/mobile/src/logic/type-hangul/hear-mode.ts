import { decomposeSyllable, type TypeHangulRound } from '@hangul-route/content-schema';
import type { KoVoiceStatus } from '../audio/capability';

/**
 * Type Hangul `hear` mode, Dictation (F-CURR-002 section 7.1 F2, row CM-31; design/wireframes/minigame/type-hangul.md
 * "Hear mode: Dictation", audio-fallback.md W11). Pure: the dictation chunk's prompt and the review's hear round render
 * what this decides. Nothing here is in the start bundle (only `screens/minigames/dictation-chunk.tsx` imports it).
 *
 * - **Decided at round open.** A hear round opens as `hear` when the word can be heard, and as a `see` round with the
 *   visible sound notice when it cannot (no Korean voice and no recording, or sound off), so the screen never changes
 *   under the learner. While the device's voice list is still `unknown` the round **holds** its opening, at most
 *   `HEAR_HOLD_MS`, and opens once; still unknown then, it opens as `hear`.
 * - **A second failed play** in one hear round turns it into `see` with the notice ("The sound did not play.").
 * - **Memory** (section 4.3): a right first Done after "Show how it sounds", or a first Done one jamo away from the
 *   word, is recorded as hinted (no promotion, no demotion). The stars follow the shell rule: only a match first time
 *   is a right round.
 */

/** How long a hear round waits for the voice list before it opens anyway (the capability's 1.5 s read). */
export const HEAR_HOLD_MS = 1500;
/** Failed plays in one hear round before it becomes a `see` round. */
export const HEAR_FAILURES_TO_SEE = 2;

export type HearSeeReason = 'no_voice' | 'muted' | 'error';
export type HearOpening = { kind: 'hold' } | { kind: 'hear' } | { kind: 'see'; reason: HearSeeReason };

export interface HearOpeningInput {
  tts: KoVoiceStatus['state'];
  /** The round's recording is bundled (it plays with no voice). */
  hasClip: boolean;
  muted: boolean;
  /** The hold has run its `HEAR_HOLD_MS`. */
  held: boolean;
}

/** How a hear round opens now: hold, hear, or see with the reason for the notice. */
export function hearOpening({ tts, hasClip, muted, held }: HearOpeningInput): HearOpening {
  if (muted) return { kind: 'see', reason: 'muted' };
  if (hasClip || tts === 'ready') return { kind: 'hear' };
  if (tts === 'none') return { kind: 'see', reason: 'no_voice' };
  return held ? { kind: 'hear' } : { kind: 'hold' };
}

/** After a play: a second failure in the round makes it a `see` round. */
export function afterFailedPlay(failures: number): HearOpening {
  return failures >= HEAR_FAILURES_TO_SEE ? { kind: 'see', reason: 'error' } : { kind: 'hear' };
}

/** What the word's speaker plays: the round's recording, else the target's, else the device voice on its text. */
export function hearSpeech(round: Pick<TypeHangulRound, 'audioRef' | 'target'>): { text: string; audioRef?: string } {
  const audioRef = round.audioRef ?? round.target.audioRef;
  const text = round.target.spokenKo ?? round.target.ko;
  return audioRef === undefined ? { text } : { text, audioRef };
}

/**
 * The section 4.3 tolerance, kept equal to the review engine's `gradeTyped` (`reviews/engine.ts`): one rule, so a
 * typed answer grades the same in a quest's Dictation round and in a review. It is a copy, not an import, because a
 * module shared by the dictation chunk and the memory chunk would be carried by the start bundle; the parity test in
 * `__tests__/hear-mode.test.ts` runs both over the same answers. The steps are the engine's: the asked form (NFC,
 * single spaces, no edge punctuation), then each block as its first letter, vowel and final (an initial and a final
 * are different letters), a lone letter in its own place, and any other character as itself.
 */
const EDGE_PUNCTUATION = /^["'\u201c\u201d\u2018\u2019(]+|[.!?~\u2026,"'\u201c\u201d\u2018\u2019)]+$/g;
/** The compatibility letters that stand as a first letter (U+3131 to U+314E, the 19 initials) and the vowels. */
const INITIAL_LETTERS = new Set([0x3131, 0x3132, 0x3134, 0x3137, 0x3138, 0x3139, 0x3141, 0x3142, 0x3143, 0x3145, 0x3146, 0x3147, 0x3148, 0x3149, 0x314a, 0x314b, 0x314c, 0x314d, 0x314e]);
const VOWEL_FIRST = 0x314f;
const VOWEL_LAST = 0x3163;

function askedForm(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim().replace(EDGE_PUNCTUATION, '').trim();
}

function lettersOf(text: string): string[] {
  const out: string[] = [];
  for (const ch of askedForm(text).replace(/\s+/g, '')) {
    const parts = decomposeSyllable(ch);
    if (parts !== null) {
      out.push(`i${parts.initial}`, `m${parts.medial}`);
      if (parts.final !== '') out.push(`f${parts.final}`);
      continue;
    }
    const code = ch.charCodeAt(0);
    if (INITIAL_LETTERS.has(code)) out.push(`i${ch}`);
    else if (code >= VOWEL_FIRST && code <= VOWEL_LAST) out.push(`m${code - VOWEL_FIRST}`);
    else out.push(ch);
  }
  return out;
}

/** Edit distance over two letter lists (insert, delete, change one). */
function distance(a: readonly string[], b: readonly string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min((prev[j] as number) + 1, (row[j - 1] as number) + 1, (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length] as number;
}

/** Section 4.3's tolerance: the same letters are right, one letter away is hinted, more (or nothing typed) a miss. */
export function typedTolerance(target: string, typed: string): 'right' | 'hinted' | 'miss' {
  const got = lettersOf(typed);
  if (got.length === 0) return 'miss';
  const d = distance(lettersOf(target), got);
  return d === 0 ? 'right' : d === 1 ? 'hinted' : 'miss';
}

/**
 * The memory store's reading of a hear round's first Done. `hinted` is a right answer given with help (the
 * romanization was shown, or one letter was off): the store neither promotes nor demotes it. Undefined: as scored.
 */
export function hearAnswerHinted(target: string, typed: string, revealed: boolean): boolean {
  const grade = typedTolerance(target, typed);
  return grade === 'hinted' || (grade === 'right' && revealed);
}
