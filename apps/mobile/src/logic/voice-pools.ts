import type { Jamo } from '@hangul-route/content-schema';
import { jamoVoice } from './audio/jamo-voice';
import { decompose, type HangulBlock } from './stage1/hangul';

/**
 * Which tiles may sit beside a target in a round asked by ear (AMENDMENTS-AUDIO-CLIPS JV-A3).
 * Pure. Every round builder that asks a jamo by ear (Match Sound, the lecture sound quiz,
 * Listen & Pick letter rounds) draws its distractors through these rules, so no tile but the
 * answer is right by ear (G2).
 *
 * - **Letter question** (rule 1): the voice says the letter's name (`jamoVoice(j, 'letter')`).
 *   No final; every tile's name differs; no vowel tile is the nucleus of a syllable of a
 *   consonant target's name (1b: digeut keeps ㅣ and ㅡ away); no tile's name holds a vowel
 *   target's text as a whole syllable, and ㅇ never sits beside ㅣ or ㅡ (1c: ieung begins
 *   with the vowel ㅣ and ends close to ㅡ).
 * - **Sound question** (rule 2): the voice says the syllable (`jamoVoice(j, 'sound')`). Tiles
 *   are one kind, and no tile but the answer is a component of the spoken syllable in its own
 *   position (a final tile against the final of an, a vowel tile against the vowel of na).
 */
export type PoolQuestion = 'letter' | 'sound';

const syllablesOf = (text: string): HangulBlock[] => [...text].flatMap((ch) => decompose(ch) ?? []);

/** ㅣ and ㅡ: ieung is heard beside them (rule 1c). */
const NEAR_IEUNG = new Set(['jamo:i', 'jamo:eu']);
const IEUNG = 'jamo:ieung';

/** Rule 1, 1b and 1c: may `tile` sit beside `target` in a letter question? */
export function letterTileAllowed(target: Jamo, tile: Jamo): boolean {
  if (target.kind === 'batchim' || tile.kind === 'batchim') return false;
  if (tile.id === target.id) return false;
  const targetText = jamoVoice(target, 'letter').text;
  const tileText = jamoVoice(tile, 'letter').text;
  if (tileText === targetText) return false;
  if (target.kind === 'consonant' && tile.kind === 'vowel') {
    // 1b: a vowel heard inside the consonant's name.
    if (syllablesOf(targetText).some((s) => s.medial === tile.char)) return false;
  }
  if (target.kind === 'vowel') {
    // 1c: the vowel's text heard as a whole syllable of another tile's name, and ㅇ beside ㅣ or ㅡ.
    if ([...tileText].includes(targetText)) return false;
    if (tile.id === IEUNG && NEAR_IEUNG.has(target.id)) return false;
  }
  return true;
}

function componentAt(block: HangulBlock, kind: Jamo['kind']): string | null {
  if (kind === 'consonant') return block.initial;
  if (kind === 'vowel') return block.medial;
  return block.final;
}

/** Rule 2: may `tile` sit beside `target` in a sound question? */
export function soundTileAllowed(target: Jamo, tile: Jamo): boolean {
  if (tile.id === target.id || tile.kind !== target.kind) return false;
  const targetText = jamoVoice(target, 'sound').text;
  if (jamoVoice(tile, 'sound').text === targetText) return false;
  return !syllablesOf(targetText).some((s) => componentAt(s, tile.kind) === tile.char);
}

export function tileAllowed(question: PoolQuestion, target: Jamo, tile: Jamo): boolean {
  return question === 'letter' ? letterTileAllowed(target, tile) : soundTileAllowed(target, tile);
}

/**
 * Why `pool` cannot be asked as `question`, or null. A letter question takes no final; a sound
 * question takes one kind of tile. A builder throws on it, so a content test fails first.
 */
export function poolKindFault(question: PoolQuestion, pool: readonly Jamo[]): string | null {
  if (question === 'letter') {
    const finals = pool.filter((j) => j.kind === 'batchim').map((j) => j.id);
    return finals.length === 0 ? null : `a letter question takes no final (${finals.join(', ')}); ask finals as a sound question`;
  }
  const kinds = [...new Set(pool.map((j) => j.kind))];
  return kinds.length <= 1 ? null : `a sound question takes one kind of tile (found ${kinds.join(', ')})`;
}

/** The pool's tiles that may sit beside `target` (never `target` itself), in pool order. */
export function allowedDistractors(question: PoolQuestion, target: Jamo, pool: readonly Jamo[]): Jamo[] {
  return pool.filter((j) => tileAllowed(question, target, j));
}

/**
 * The targets of `pool` that cannot fill a round of `tileCount` tiles under the rules, each with
 * how many distractors it has. Empty when every target can be asked. The content test runs this
 * on every shipped scope, so a builder never meets a short pool at run time.
 */
export function poolShortfalls(question: PoolQuestion, pool: readonly Jamo[], tileCount: number): Array<{ id: string; allowed: number }> {
  return pool.flatMap((target) => {
    const allowed = allowedDistractors(question, target, pool).length;
    return allowed < tileCount - 1 ? [{ id: target.id, allowed }] : [];
  });
}
